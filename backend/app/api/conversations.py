from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.all_models import Conversation, Message, Analysis, User, Dataset
from app.schemas.all_schemas import (
    ConversationResponse,
    ConversationListItem,
    ConversationCreate,
    ConversationUpdate,
    MessageResponse,
    AnalyticsResponse,
    ChartSpec
)
from app.api.deps import get_current_user, get_current_workspace

router = APIRouter(prefix="/conversations", tags=["Conversations"])

@router.get("", response_model=List[ConversationListItem])
def list_conversations(
    workspace_id: str,
    dataset_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    get_current_workspace(workspace_id, current_user, db)
    query = db.query(Conversation).filter(Conversation.workspace_id == workspace_id)
    if dataset_id:
        query = query.filter(Conversation.dataset_id == dataset_id)
    convs = query.order_by(Conversation.updated_at.desc()).all()
    
    return [
        ConversationListItem(
            id=c.id,
            workspace_id=c.workspace_id,
            dataset_id=c.dataset_id,
            dataset_name=c.dataset.name if c.dataset else None,
            title=c.title,
            created_at=c.created_at,
            updated_at=c.updated_at,
            message_count=len(c.messages) if c.messages else 0
        )
        for c in convs
    ]

@router.post("", response_model=ConversationListItem, status_code=status.HTTP_201_CREATED)
def create_conversation(
    req: ConversationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    get_current_workspace(req.workspace_id, current_user, db)
    dataset = db.query(Dataset).filter(Dataset.id == req.dataset_id, Dataset.workspace_id == req.workspace_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found in this workspace.")

    conv = Conversation(
        workspace_id=req.workspace_id,
        dataset_id=req.dataset_id,
        user_id=current_user.id,
        title=req.title or "New Chat"
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return ConversationListItem(
        id=conv.id,
        workspace_id=conv.workspace_id,
        dataset_id=conv.dataset_id,
        dataset_name=dataset.name,
        title=conv.title,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        message_count=0
    )

@router.get("/{conversation_id}", response_model=ConversationResponse)
def get_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    get_current_workspace(conv.workspace_id, current_user, db)

    messages = (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
        .all()
    )

    msg_responses = []
    for m in messages:
        analysis_resp = None
        if m.analysis:
            a = m.analysis
            cs = ChartSpec(**a.chart_spec) if a.chart_spec else None
            analysis_resp = AnalyticsResponse(
                analysis_id=a.id,
                conversation_id=a.conversation_id or "",
                question=a.question,
                intent=a.intent,
                generated_sql=a.generated_sql,
                query_status=a.query_status,
                execution_time_ms=a.execution_time_ms,
                row_count=a.row_count,
                chart_spec=cs,
                insights=a.insights or [],
                explanation=m.content if m.role == "assistant" else None,
                clarification_options=m.clarification_options
            )

        msg_responses.append(
            MessageResponse(
                id=m.id,
                conversation_id=m.conversation_id,
                role=m.role,
                content=m.content,
                analysis=analysis_resp,
                clarification_options=m.clarification_options,
                created_at=m.created_at
            )
        )

    return ConversationResponse(
        id=conv.id,
        workspace_id=conv.workspace_id,
        dataset_id=conv.dataset_id,
        title=conv.title,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        messages=msg_responses
    )

@router.patch("/{conversation_id}", response_model=ConversationListItem)
def update_conversation(
    conversation_id: str,
    req: ConversationUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    get_current_workspace(conv.workspace_id, current_user, db)

    conv.title = req.title.strip()
    conv.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(conv)
    return ConversationListItem(
        id=conv.id,
        workspace_id=conv.workspace_id,
        dataset_id=conv.dataset_id,
        title=conv.title,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        message_count=len(conv.messages) if conv.messages else 0
    )

@router.delete("/{conversation_id}")
def delete_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    get_current_workspace(conv.workspace_id, current_user, db)

    db.delete(conv)
    db.commit()
    return {"message": "Conversation successfully deleted."}
