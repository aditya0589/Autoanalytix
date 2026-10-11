import os
import uuid
from typing import Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.dynamodb import dynamodb_store
from app.core.s3_storage import s3_storage
from app.schemas.all_schemas import (
    AnalyticsQueryRequest,
    AnalyticsResponse,
    ChartSpec
)
from app.api.deps import get_current_user, get_current_workspace, ItemObject
from app.ai.providers.factory import get_chat_model_for_config
from app.ai.agents.analytics_graph import AnalyticsWorkflow
from app.analytics.engine import analytics_engine

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.post("/query", response_model=AnalyticsResponse)
def execute_analytics_query(
    req: AnalyticsQueryRequest,
    current_user: ItemObject = Depends(get_current_user)
):
    get_current_workspace(req.workspace_id, current_user)

    dataset = dynamodb_store.get_dataset_by_id(req.dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found.")

    # 1. Resolve AI Provider Configuration (BYOK Requirement)
    ai_config_dict = None
    if req.provider_config_id:
        ai_config_dict = dynamodb_store.get_ai_config(req.workspace_id, req.provider_config_id)
    else:
        configs = dynamodb_store.list_ai_configs(req.workspace_id)
        if configs:
            default_cfgs = [c for c in configs if c.get("is_default")]
            ai_config_dict = default_cfgs[0] if default_cfgs else configs[0]

    if not ai_config_dict:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "NO_AI_PROVIDER",
                "message": (
                    "Connect your own AI provider and API key to use natural-language analytics. "
                    "Your AI usage is billed directly by your selected provider."
                ),
                "redirect_url": "/settings/ai-providers"
            }
        )

    # Decrypt key inside backend and instantiate LangChain Chat Model
    try:
        chat_model = get_chat_model_for_config(ItemObject(ai_config_dict))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to initialize AI provider '{ai_config_dict.get('provider')}': {str(e)}"
        )

    # 2. Ensure DuckDB table is loaded from local or S3 cache
    local_path = s3_storage.ensure_local_cache(dataset.get("file_path", ""))
    analytics_engine.register_dataset(dataset["duckdb_table_name"], local_path, "parquet")

    # 3. Retrieve or create Conversation
    conversation = None
    if req.conversation_id:
        conversation = dynamodb_store.get_conversation_by_id(req.conversation_id)
    
    now_str = datetime.now(timezone.utc).isoformat()
    if not conversation:
        conv_id = str(uuid.uuid4())
        conversation = dynamodb_store.create_conversation({
            "id": conv_id,
            "workspace_id": req.workspace_id,
            "dataset_id": req.dataset_id,
            "user_id": current_user.id,
            "title": req.question[:50],
            "messages": [],
            "created_at": now_str,
            "updated_at": now_str
        })

    # 4. Fetch Conversation History
    messages_history = conversation.get("messages", [])[-10:]
    history_list = [{"role": m["role"], "content": m["content"]} for m in messages_history]

    # 5. Fetch Column Schema
    columns = dataset.get("columns", [])
    schema_list = [
        {
            "name": c["name"],
            "data_type": c.get("data_type", "categorical"),
            "duckdb_type": c.get("duckdb_type", "VARCHAR"),
            "stats": c.get("stats") or {}
        }
        for c in columns
    ]

    # 6. Execute LangGraph Analytics Workflow
    workflow = AnalyticsWorkflow(llm=chat_model)
    app_graph = workflow.build_graph()

    initial_state = {
        "user_id": current_user.id,
        "workspace_id": req.workspace_id,
        "dataset_id": dataset["id"],
        "dataset_table_name": dataset["duckdb_table_name"],
        "conversation_id": conversation["id"],
        "provider_config_id": ai_config_dict["id"],
        "user_question": req.question,
        "conversation_history": history_list,
        "dataset_schema": schema_list,
        "dataset_profile": dataset.get("profile_summary") or {},
        "analysis_plan": None,
        "generated_sql": None,
        "sql_retry_count": 0,
        "query_result": None,
        "chart_specification": None,
        "insights": [],
        "clarification_question": None,
        "clarification_options": [],
        "error": None,
        "status": "started"
    }

    try:
        final_state = app_graph.invoke(initial_state)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Analytics workflow failed: {str(e)}"
        )

    # 7. Check for errors
    if final_state.get("status") == "failed" or final_state.get("error"):
        error_msg = final_state.get("error") or "Unknown error occurred during analysis."
        
        # Save user & assistant error message
        dynamodb_store.append_message(req.workspace_id, conversation["id"], {
            "id": str(uuid.uuid4()),
            "role": "user",
            "content": req.question,
            "created_at": now_str
        })
        dynamodb_store.append_message(req.workspace_id, conversation["id"], {
            "id": str(uuid.uuid4()),
            "role": "assistant",
            "content": f"Analysis error: {error_msg}",
            "created_at": now_str
        })

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg
        )

    # 8. Check for clarification
    if final_state.get("status") == "clarification":
        clarification_q = final_state.get("clarification_question")
        clarification_opts = final_state.get("clarification_options", [])
        
        dynamodb_store.append_message(req.workspace_id, conversation["id"], {
            "id": str(uuid.uuid4()),
            "role": "user",
            "content": req.question,
            "created_at": now_str
        })
        dynamodb_store.append_message(req.workspace_id, conversation["id"], {
            "id": str(uuid.uuid4()),
            "role": "assistant",
            "content": clarification_q,
            "clarification_options": clarification_opts,
            "created_at": now_str
        })

        return AnalyticsResponse(
            analysis_id="",
            conversation_id=conversation["id"],
            question=req.question,
            query_status="clarification",
            execution_time_ms=0.0,
            row_count=0,
            insights=[],
            clarification_options=clarification_opts,
            error_details=clarification_q
        )

    # 9. Persist Analysis and Messages
    q_result = final_state.get("query_result", {})
    chart_spec_dict = final_state.get("chart_specification")
    plan = final_state.get("analysis_plan", {})

    analysis_id = str(uuid.uuid4())
    analysis_dict = {
        "id": analysis_id,
        "workspace_id": req.workspace_id,
        "dataset_id": dataset["id"],
        "conversation_id": conversation["id"],
        "user_id": current_user.id,
        "question": req.question,
        "intent": plan.get("intent", "analysis"),
        "structured_plan": plan,
        "generated_sql": final_state.get("generated_sql"),
        "query_status": "success",
        "execution_time_ms": q_result.get("execution_time_ms", 0.0),
        "row_count": q_result.get("row_count", 0),
        "result_data": q_result,
        "chart_spec": chart_spec_dict,
        "insights": final_state.get("insights", []),
        "created_at": now_str
    }
    dynamodb_store.create_analysis(analysis_dict)

    # Save user message & assistant message
    explanation_text = final_state.get("explanation")
    summary_text = "\n".join(final_state.get("insights", []))
    content_to_save = explanation_text if explanation_text else (summary_text or f"Generated analysis for: {req.question}")

    dynamodb_store.append_message(req.workspace_id, conversation["id"], {
        "id": str(uuid.uuid4()),
        "role": "user",
        "content": req.question,
        "created_at": now_str
    })
    dynamodb_store.append_message(req.workspace_id, conversation["id"], {
        "id": str(uuid.uuid4()),
        "role": "assistant",
        "content": content_to_save,
        "analysis_id": analysis_id,
        "created_at": now_str
    })

    chart_spec = ChartSpec(**chart_spec_dict) if chart_spec_dict else None

    return AnalyticsResponse(
        analysis_id=analysis_id,
        conversation_id=conversation["id"],
        question=req.question,
        intent=analysis_dict["intent"],
        generated_sql=analysis_dict["generated_sql"],
        query_status="success",
        execution_time_ms=analysis_dict["execution_time_ms"],
        row_count=analysis_dict["row_count"],
        chart_spec=chart_spec,
        insights=analysis_dict["insights"] or [],
        explanation=explanation_text,
        clarification_options=None,
        error_details=None
    )

@router.get("/{analysis_id}", response_model=AnalyticsResponse)
def get_analysis(
    analysis_id: str,
    current_user: ItemObject = Depends(get_current_user)
):
    analysis = dynamodb_store.get_analysis_by_id(analysis_id)
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found.")
    get_current_workspace(analysis["workspace_id"], current_user)

    chart_spec = ChartSpec(**analysis["chart_spec"]) if analysis.get("chart_spec") else None
    return AnalyticsResponse(
        analysis_id=analysis["id"],
        conversation_id=analysis.get("conversation_id", ""),
        question=analysis.get("question", ""),
        intent=analysis.get("intent"),
        generated_sql=analysis.get("generated_sql"),
        query_status=analysis.get("query_status", "success"),
        execution_time_ms=analysis.get("execution_time_ms", 0.0),
        row_count=analysis.get("row_count", 0),
        chart_spec=chart_spec,
        insights=analysis.get("insights", []),
        clarification_options=None,
        error_details=analysis.get("error_details")
    )
