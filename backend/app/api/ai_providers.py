import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import encrypt_credential, decrypt_credential, mask_api_key
from app.schemas.all_schemas import (
    AIProviderConfigCreate,
    AIProviderConfigUpdate,
    AIProviderConfigResponse,
    AIProviderTestRequest,
    AIProviderTestResponse
)
from app.api.deps import get_current_user, get_current_workspace, ItemObject
from app.ai.providers.factory import list_supported_providers, get_provider_adapter
from app.core.dynamodb import dynamodb_store

router = APIRouter(prefix="/ai", tags=["AI Providers"])

@router.get("/providers")
def get_providers():
    """Returns available AI providers and their model catalogue."""
    return list_supported_providers()

@router.get("/configurations", response_model=List[AIProviderConfigResponse])
def list_configurations(
    workspace_id: str,
    current_user: ItemObject = Depends(get_current_user)
):
    get_current_workspace(workspace_id, current_user)
    configs = dynamodb_store.list_ai_configs(workspace_id)
    configs.sort(key=lambda c: (c.get("is_default", False), c.get("created_at", "")), reverse=True)

    results = []
    for c in configs:
        masked = ""
        try:
            plain = decrypt_credential(c["encrypted_api_key"])
            masked = mask_api_key(plain)
        except Exception:
            masked = "••••••••"

        results.append(
            AIProviderConfigResponse(
                id=c["id"],
                workspace_id=c["workspace_id"],
                provider=c["provider"],
                model_name=c["model_name"],
                masked_key=masked,
                is_default=c.get("is_default", False),
                connection_status=c.get("connection_status", "untested"),
                last_tested_at=c.get("last_tested_at"),
                custom_endpoint=c.get("custom_endpoint"),
                created_at=c.get("created_at")
            )
        )
    return results

@router.post("/configurations", response_model=AIProviderConfigResponse)
def create_configuration(
    workspace_id: str,
    config_in: AIProviderConfigCreate,
    current_user: ItemObject = Depends(get_current_user)
):
    get_current_workspace(workspace_id, current_user)

    encrypted_key = encrypt_credential(config_in.api_key)
    existing_configs = dynamodb_store.list_ai_configs(workspace_id)
    is_default = config_in.is_default or (len(existing_configs) == 0)

    if is_default:
        for ex in existing_configs:
            if ex.get("is_default"):
                dynamodb_store.update_ai_config(workspace_id, ex["id"], {"is_default": False})

    config_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    new_config = {
        "id": config_id,
        "workspace_id": workspace_id,
        "user_id": current_user.id,
        "provider": config_in.provider.lower(),
        "model_name": config_in.model_name,
        "encrypted_api_key": encrypted_key,
        "is_default": is_default,
        "connection_status": "untested",
        "custom_endpoint": config_in.custom_endpoint,
        "created_at": now,
        "updated_at": now,
    }
    saved = dynamodb_store.create_ai_config(new_config)

    return AIProviderConfigResponse(
        id=saved["id"],
        workspace_id=saved["workspace_id"],
        provider=saved["provider"],
        model_name=saved["model_name"],
        masked_key=mask_api_key(config_in.api_key),
        is_default=saved["is_default"],
        connection_status=saved["connection_status"],
        last_tested_at=saved.get("last_tested_at"),
        custom_endpoint=saved.get("custom_endpoint"),
        created_at=saved["created_at"]
    )

@router.put("/configurations/{config_id}", response_model=AIProviderConfigResponse)
def update_configuration(
    config_id: str,
    config_in: AIProviderConfigUpdate,
    workspace_id: str,
    current_user: ItemObject = Depends(get_current_user)
):
    c = dynamodb_store.get_ai_config(workspace_id, config_id)
    if not c:
        raise HTTPException(status_code=404, detail="Configuration not found.")
    get_current_workspace(workspace_id, current_user)

    updates = {}
    if config_in.model_name is not None:
        updates["model_name"] = config_in.model_name
    if config_in.custom_endpoint is not None:
        updates["custom_endpoint"] = config_in.custom_endpoint
    if config_in.api_key:
        updates["encrypted_api_key"] = encrypt_credential(config_in.api_key)
        updates["connection_status"] = "untested"
        updates["last_tested_at"] = None

    if config_in.is_default:
        existing_configs = dynamodb_store.list_ai_configs(workspace_id)
        for ex in existing_configs:
            if ex.get("is_default") and ex["id"] != config_id:
                dynamodb_store.update_ai_config(workspace_id, ex["id"], {"is_default": False})
        updates["is_default"] = True

    updated = dynamodb_store.update_ai_config(workspace_id, config_id, updates)
    plain = decrypt_credential(updated["encrypted_api_key"])
    return AIProviderConfigResponse(
        id=updated["id"],
        workspace_id=updated["workspace_id"],
        provider=updated["provider"],
        model_name=updated["model_name"],
        masked_key=mask_api_key(plain),
        is_default=updated["is_default"],
        connection_status=updated["connection_status"],
        last_tested_at=updated.get("last_tested_at"),
        custom_endpoint=updated.get("custom_endpoint"),
        created_at=updated["created_at"]
    )

@router.delete("/configurations/{config_id}")
def delete_configuration(
    config_id: str,
    workspace_id: str,
    current_user: ItemObject = Depends(get_current_user)
):
    get_current_workspace(workspace_id, current_user)
    dynamodb_store.delete_ai_config(workspace_id, config_id)
    return {"message": "Configuration successfully deleted."}

@router.post("/configurations/{config_id}/default")
def set_default_configuration(
    config_id: str,
    workspace_id: str,
    current_user: ItemObject = Depends(get_current_user)
):
    c = dynamodb_store.get_ai_config(workspace_id, config_id)
    if not c:
        raise HTTPException(status_code=404, detail="Configuration not found.")
    get_current_workspace(workspace_id, current_user)

    existing_configs = dynamodb_store.list_ai_configs(workspace_id)
    for ex in existing_configs:
        if ex.get("is_default") and ex["id"] != config_id:
            dynamodb_store.update_ai_config(workspace_id, ex["id"], {"is_default": False})
    dynamodb_store.update_ai_config(workspace_id, config_id, {"is_default": True})
    return {"message": f"Default provider set to {c['provider']} ({c['model_name']})."}

@router.post("/configurations/{config_id}/test", response_model=AIProviderTestResponse)
def test_saved_configuration(
    config_id: str,
    workspace_id: str,
    current_user: ItemObject = Depends(get_current_user)
):
    c = dynamodb_store.get_ai_config(workspace_id, config_id)
    if not c:
        raise HTTPException(status_code=404, detail="Configuration not found.")
    get_current_workspace(workspace_id, current_user)

    try:
        plain_key = decrypt_credential(c["encrypted_api_key"])
        adapter = get_provider_adapter(c["provider"])
        res = adapter.test_connection(plain_key, c["model_name"], c.get("custom_endpoint"))

        status_val = "connected" if res.get("success") else "failed"
        dynamodb_store.update_ai_config(workspace_id, config_id, {
            "connection_status": status_val,
            "last_tested_at": datetime.now(timezone.utc).isoformat()
        })

        return AIProviderTestResponse(
            success=res["success"],
            message=res["message"],
            latency_ms=res.get("latency_ms")
        )
    except Exception as e:
        dynamodb_store.update_ai_config(workspace_id, config_id, {
            "connection_status": "failed",
            "last_tested_at": datetime.now(timezone.utc).isoformat()
        })
        return AIProviderTestResponse(
            success=False,
            message=f"Connection test failed: {str(e)}",
            latency_ms=None
        )

@router.post("/configurations/test-adhoc", response_model=AIProviderTestResponse)
def test_adhoc_configuration(
    req: AIProviderTestRequest,
    current_user: ItemObject = Depends(get_current_user)
):
    if not req.api_key:
        raise HTTPException(status_code=400, detail="API key is required for connectivity test.")
    try:
        adapter = get_provider_adapter(req.provider)
        res = adapter.test_connection(req.api_key, req.model_name, req.custom_endpoint)
        return AIProviderTestResponse(
            success=res["success"],
            message=res["message"],
            latency_ms=res.get("latency_ms")
        )
    except Exception as e:
        return AIProviderTestResponse(
            success=False,
            message=f"Connection test failed: {str(e)}",
            latency_ms=None
        )
