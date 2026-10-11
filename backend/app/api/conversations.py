import uuid
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.dynamodb import dynamodb_store
from app.schemas.all_schemas import (
    ConversationResponse,
    ConversationListItem,
    ConversationCreate,
    ConversationUpdate,
    MessageResponse,
    AnalyticsResponse,
    ChartSpec
)
from app.api.deps import get_current_user, get_current_workspace, ItemObject

router = APIRouter(prefix="/conversations", tags=["Conversations"])

@router.get("", response_model=List[ConversationListItem])
def list_conversations(
    workspace_id: str,
    dataset_id: Optional[str] = None,
    current_user: ItemObject = Depends(get_current_user)
):
    get_current_workspace(workspace_id, current_user)
    convs = dynamodb_store.list_conversations(workspace_id, dataset_id)
    convs.sort(key=lambda c: str(c.get("updated_at", c.get("created_at", ""))), reverse=True)

    # Fetch dataset names for display
    dataset_cache = {}
    items = []
    for c in convs:
        ds_id = c.get("dataset_id")
        ds_name = None
        if ds_id:
            if ds_id not in dataset_cache:
                ds = dynamodb_store.get_dataset(workspace_id, ds_id)
                dataset_cache[ds_id] = ds.get("name") if ds else None
            ds_name = dataset_cache[ds_id]

        items.append(
            ConversationListItem(
                id=c["id"],
                workspace_id=c["workspace_id"],
                dataset_id=c["dataset_id"],
                dataset_name=ds_name,
                title=c.get("title", "New Chat"),
                created_at=c.get("created_at") or datetime.now(timezone.utc),
                updated_at=c.get("updated_at") or datetime.now(timezone.utc),
                message_count=len(c.get("messages", []))
            )
        )
    return items

@router.post("", response_model=ConversationListItem, status_code=status.HTTP_201_CREATED)
def create_conversation(
    req: ConversationCreate,
    current_user: ItemObject = Depends(get_current_user)
):
    get_current_workspace(req.workspace_id, current_user)
    dataset = dynamodb_store.get_dataset(req.workspace_id, req.dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found in this workspace.")

    conv_id = str(uuid.uuid4())
    now_str = datetime.now(timezone.utc).isoformat()
    conv_dict = {
        "id": conv_id,
        "workspace_id": req.workspace_id,
        "dataset_id": req.dataset_id,
        "user_id": current_user.id,
        "title": req.title or "New Chat",
        "messages": [],
        "created_at": now_str,
        "updated_at": now_str
    }

    created = dynamodb_store.create_conversation(conv_dict)
    return ConversationListItem(
        id=created["id"],
        workspace_id=created["workspace_id"],
        dataset_id=created["dataset_id"],
        dataset_name=dataset.get("name"),
        title=created["title"],
        created_at=created["created_at"],
        updated_at=created["updated_at"],
        message_count=0
    )

@router.get("/{conversation_id}", response_model=ConversationResponse)
def get_conversation(
    conversation_id: str,
    current_user: ItemObject = Depends(get_current_user)
):
    conv = dynamodb_store.get_conversation_by_id(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    get_current_workspace(conv["workspace_id"], current_user)

    messages = conv.get("messages", [])
    msg_responses = []
    for m in messages:
        analysis_resp = None
        if m.get("analysis"):
            analysis_resp = AnalyticsResponse.model_validate(m["analysis"])
        elif m.get("analysis_id"):
            a = dynamodb_store.get_analysis_by_id(m["analysis_id"])
            if a:
                cs = ChartSpec(**a["chart_spec"]) if a.get("chart_spec") else None
                analysis_resp = AnalyticsResponse(
                    analysis_id=a["id"],
                    conversation_id=a.get("conversation_id", ""),
                    question=a.get("question", ""),
                    intent=a.get("intent"),
                    generated_sql=a.get("generated_sql"),
                    query_status=a.get("query_status", "success"),
                    execution_time_ms=a.get("execution_time_ms", 0.0),
                    row_count=a.get("row_count", 0),
                    chart_spec=cs,
                    insights=a.get("insights", []),
                    explanation=m.get("content") if m.get("role") == "assistant" else None,
                    clarification_options=m.get("clarification_options")
                )

        msg_responses.append(
            MessageResponse(
                id=m.get("id", str(uuid.uuid4())),
                conversation_id=conversation_id,
                role=m["role"],
                content=m["content"],
                analysis=analysis_resp,
                clarification_options=m.get("clarification_options"),
                created_at=m.get("created_at") or datetime.now(timezone.utc)
            )
        )

    return ConversationResponse(
        id=conv["id"],
        workspace_id=conv["workspace_id"],
        dataset_id=conv["dataset_id"],
        title=conv.get("title", "New Chat"),
        created_at=conv.get("created_at") or datetime.now(timezone.utc),
        updated_at=conv.get("updated_at") or datetime.now(timezone.utc),
        messages=msg_responses
    )

@router.patch("/{conversation_id}", response_model=ConversationListItem)
def update_conversation(
    conversation_id: str,
    req: ConversationUpdate,
    current_user: ItemObject = Depends(get_current_user)
):
    conv = dynamodb_store.get_conversation_by_id(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    get_current_workspace(conv["workspace_id"], current_user)

    conv["title"] = req.title.strip()
    conv["updated_at"] = datetime.now(timezone.utc).isoformat()
    updated = dynamodb_store.create_conversation(conv)

    return ConversationListItem(
        id=updated["id"],
        workspace_id=updated["workspace_id"],
        dataset_id=updated["dataset_id"],
        title=updated["title"],
        created_at=updated["created_at"],
        updated_at=updated["updated_at"],
        message_count=len(updated.get("messages", []))
    )

@router.delete("/{conversation_id}")
def delete_conversation(
    conversation_id: str,
    current_user: ItemObject = Depends(get_current_user)
):
    conv = dynamodb_store.get_conversation_by_id(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    get_current_workspace(conv["workspace_id"], current_user)

    dynamodb_store.delete_conversation(conv["workspace_id"], conversation_id)
    return {"message": "Conversation successfully deleted."}
