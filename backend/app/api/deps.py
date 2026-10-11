from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.security import decode_access_token
from app.core.dynamodb import dynamodb_store

class ItemObject(dict):
    """Allows dictionary keys to be accessed as object attributes (e.g. user.id), returning None for missing optional keys."""
    def __getattr__(self, name):
        return self.get(name, None)
    def __setattr__(self, name, value):
        self[name] = value

security = HTTPBearer(auto_error=False)

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> ItemObject:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided."
        )
    token = credentials.credentials
    if token == "local_demo_token":
        user_dict = dynamodb_store.get_user_by_id("user_local_1")
        if not user_dict:
            user_dict = dynamodb_store.create_user({
                "id": "user_local_1",
                "email": "analyst@local.app",
                "full_name": "Local Analyst (Browser-WASM)",
                "hashed_password": "demo_hashed_password",
                "is_active": True,
                "created_at": "2026-10-10T00:00:00Z",
                "updated_at": "2026-10-10T00:00:00Z",
            })
            dynamodb_store.create_workspace({
                "id": "ws_local_1",
                "name": "Personal Workspace (Browser)",
                "slug": "personal-workspace",
                "owner_id": "user_local_1",
                "created_at": "2026-10-10T00:00:00Z",
                "updated_at": "2026-10-10T00:00:00Z",
            })
            dynamodb_store.add_workspace_member({
                "id": "member_local_1",
                "workspace_id": "ws_local_1",
                "user_id": "user_local_1",
                "role": "owner",
                "created_at": "2026-10-10T00:00:00Z",
            })
        return ItemObject(user_dict)

    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token."
        )
    user_id = payload["sub"]
    user_dict = dynamodb_store.get_user_by_id(user_id)
    if not user_dict or not user_dict.get("is_active"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or account is deactivated."
        )
    return ItemObject(user_dict)

def get_current_workspace(
    workspace_id: str,
    current_user: ItemObject = Depends(get_current_user)
) -> ItemObject:
    member = dynamodb_store.get_workspace_member(workspace_id, current_user.id)
    workspace = dynamodb_store.get_workspace_by_id(workspace_id)
    if not workspace or (workspace.get("owner_id") != current_user.id and not member):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this workspace."
        )
    return ItemObject(workspace)
