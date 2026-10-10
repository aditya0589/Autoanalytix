import os
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.all_models import (
    Dataset,
    DatasetColumn,
    AIProviderConfig,
    Conversation,
    Message,
    Analysis,
    User
)
from app.schemas.all_schemas import (
    AnalyticsQueryRequest,
    AnalyticsResponse,
    ChartSpec
)
from app.api.deps import get_current_user, get_current_workspace
from app.ai.providers.factory import get_chat_model_for_config
from app.ai.agents.analytics_graph import AnalyticsWorkflow
from app.analytics.engine import analytics_engine

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.post("/query", response_model=AnalyticsResponse)
def execute_analytics_query(
    req: AnalyticsQueryRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    get_current_workspace(req.workspace_id, current_user, db)

    dataset = db.query(Dataset).filter(Dataset.id == req.dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found.")

    # 1. Resolve AI Provider Configuration (BYOK Requirement)
    ai_config = None
    if req.provider_config_id:
        ai_config = db.query(AIProviderConfig).filter(
            AIProviderConfig.id == req.provider_config_id,
            AIProviderConfig.workspace_id == req.workspace_id
        ).first()
    else:
        # Get default provider or latest
        ai_config = (
            db.query(AIProviderConfig)
            .filter(AIProviderConfig.workspace_id == req.workspace_id)
            .order_by(AIProviderConfig.is_default.desc(), AIProviderConfig.created_at.desc())
            .first()
        )

    if not ai_config:
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
        chat_model = get_chat_model_for_config(ai_config)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to initialize AI provider '{ai_config.provider}': {str(e)}"
        )

    # 2. Ensure DuckDB table is loaded
    if os.path.exists(dataset.file_path):
        analytics_engine.register_dataset(dataset.duckdb_table_name, dataset.file_path, "parquet")

    # 3. Retrieve or create Conversation
    conversation = None
    if req.conversation_id:
        conversation = db.query(Conversation).filter(Conversation.id == req.conversation_id).first()
    
    if not conversation:
        conversation = Conversation(
            workspace_id=req.workspace_id,
            dataset_id=req.dataset_id,
            user_id=current_user.id,
            title=req.question[:50]
        )
        db.add(conversation)
        db.commit()
        db.refresh(conversation)

    # 4. Fetch Conversation History
    history_messages = (
        db.query(Message)
        .filter(Message.conversation_id == conversation.id)
        .order_by(Message.created_at.asc())
        .limit(10)
        .all()
    )
    history_list = [{"role": m.role, "content": m.content} for m in history_messages]

    # 5. Fetch Column Schema
    columns = db.query(DatasetColumn).filter(DatasetColumn.dataset_id == dataset.id).all()
    schema_list = [
        {
            "name": c.name,
            "data_type": c.data_type,
            "duckdb_type": c.duckdb_type,
            "stats": c.stats or {}
        }
        for c in columns
    ]

    # 6. Execute LangGraph Analytics Workflow
    workflow = AnalyticsWorkflow(llm=chat_model)
    app_graph = workflow.build_graph()

    initial_state = {
        "user_id": current_user.id,
        "workspace_id": req.workspace_id,
        "dataset_id": dataset.id,
        "dataset_table_name": dataset.duckdb_table_name,
        "conversation_id": conversation.id,
        "provider_config_id": ai_config.id,
        "user_question": req.question,
        "conversation_history": history_list,
        "dataset_schema": schema_list,
        "dataset_profile": dataset.profile_summary or {},
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
        
        # Save user message
        db.add(Message(conversation_id=conversation.id, role="user", content=req.question))
        db.add(Message(conversation_id=conversation.id, role="assistant", content=f"Analysis error: {error_msg}"))
        db.commit()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg
        )

    # 8. Check for clarification
    if final_state.get("status") == "clarification":
        clarification_q = final_state.get("clarification_question")
        clarification_opts = final_state.get("clarification_options", [])
        
        db.add(Message(conversation_id=conversation.id, role="user", content=req.question))
        db.add(Message(
            conversation_id=conversation.id,
            role="assistant",
            content=clarification_q,
            clarification_options=clarification_opts
        ))
        db.commit()

        return AnalyticsResponse(
            analysis_id="",
            conversation_id=conversation.id,
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

    analysis = Analysis(
        workspace_id=req.workspace_id,
        dataset_id=dataset.id,
        conversation_id=conversation.id,
        user_id=current_user.id,
        question=req.question,
        intent=plan.get("intent", "analysis"),
        structured_plan=plan,
        generated_sql=final_state.get("generated_sql"),
        query_status="success",
        execution_time_ms=q_result.get("execution_time_ms", 0.0),
        row_count=q_result.get("row_count", 0),
        result_data=q_result,
        chart_spec=chart_spec_dict,
        insights=final_state.get("insights", [])
    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)

    # Save user message & assistant message
    db.add(Message(conversation_id=conversation.id, role="user", content=req.question))
    explanation_text = final_state.get("explanation")
    summary_text = "\n".join(final_state.get("insights", []))
    content_to_save = explanation_text if explanation_text else (summary_text or f"Generated analysis for: {req.question}")
    db.add(Message(
        conversation_id=conversation.id,
        role="assistant",
        content=content_to_save,
        analysis_id=analysis.id
    ))
    db.commit()

    chart_spec = ChartSpec(**chart_spec_dict) if chart_spec_dict else None

    return AnalyticsResponse(
        analysis_id=analysis.id,
        conversation_id=conversation.id,
        question=req.question,
        intent=analysis.intent,
        generated_sql=analysis.generated_sql,
        query_status=analysis.query_status,
        execution_time_ms=analysis.execution_time_ms,
        row_count=analysis.row_count,
        chart_spec=chart_spec,
        insights=analysis.insights or [],
        explanation=explanation_text,
        clarification_options=None,
        error_details=None
    )

@router.get("/{analysis_id}", response_model=AnalyticsResponse)
def get_analysis(
    analysis_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found.")
    get_current_workspace(analysis.workspace_id, current_user, db)

    chart_spec = ChartSpec(**analysis.chart_spec) if analysis.chart_spec else None
    return AnalyticsResponse(
        analysis_id=analysis.id,
        conversation_id=analysis.conversation_id or "",
        question=analysis.question,
        intent=analysis.intent,
        generated_sql=analysis.generated_sql,
        query_status=analysis.query_status,
        execution_time_ms=analysis.execution_time_ms,
        row_count=analysis.row_count,
        chart_spec=chart_spec,
        insights=analysis.insights or [],
        clarification_options=None,
        error_details=analysis.error_details
    )
