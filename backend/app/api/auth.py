import re
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from app.core.security import verify_password, get_password_hash, create_access_token
from app.schemas.all_schemas import UserCreate, UserLogin, UserResponse, Token
from app.api.deps import get_current_user, ItemObject
from app.core.dynamodb import dynamodb_store

router = APIRouter(prefix="/auth", tags=["Authentication"])

def slugify(text: str) -> str:
    cleaned = re.sub(r"[^\w\s-]", "", text).strip().lower()
    return re.sub(r"[-\s]+", "-", cleaned)

@router.post("/register", response_model=Token)
def register(user_in: UserCreate):
    existing = dynamodb_store.get_user_by_email(user_in.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists."
        )

    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    full_name = user_in.full_name or user_in.email.split("@")[0].title()

    user_data = {
        "id": user_id,
        "email": user_in.email.strip().lower(),
        "hashed_password": get_password_hash(user_in.password),
        "full_name": full_name,
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }
    user = dynamodb_store.create_user(user_data)

    # Automatically create default workspace for the user
    ws_id = str(uuid.uuid4())
    ws_name = f"{full_name}'s Workspace"
    base_slug = slugify(ws_name)
    slug = f"{base_slug}-{user_id[:6]}"

    ws_data = {
        "id": ws_id,
        "name": ws_name,
        "slug": slug,
        "owner_id": user_id,
        "created_at": now,
        "updated_at": now,
    }
    dynamodb_store.create_workspace(ws_data)

    member_data = {
        "id": str(uuid.uuid4()),
        "workspace_id": ws_id,
        "user_id": user_id,
        "role": "owner",
        "created_at": now,
    }
    dynamodb_store.add_workspace_member(member_data)

    access_token = create_access_token(user_id)
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )

@router.post("/login", response_model=Token)
def login(login_in: UserLogin):
    user = dynamodb_store.get_user_by_email(login_in.email)
    if not user or not verify_password(login_in.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )
    if not user.get("is_active"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account is inactive."
        )

    access_token = create_access_token(user["id"])
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )

@router.get("/me")
def get_me(current_user: ItemObject = Depends(get_current_user)):
    workspaces = dynamodb_store.list_user_workspaces(current_user.id)
    return {
        "user": UserResponse.model_validate(dict(current_user)),
        "workspaces": workspaces
    }
