from datetime import datetime, timezone
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import encrypt_credential, decrypt_credential, mask_api_key
from app.models.all_models import AIProviderConfig, User
from app.schemas.all_schemas import (
    AIProviderConfigCreate,
    AIProviderConfigUpdate,
    AIProviderConfigResponse,
    AIProviderTestRequest,
    AIProviderTestResponse
)
from app.api.deps import get_current_user, get_current_workspace
from app.ai.providers.factory import list_supported_providers, get_provider_adapter

router = APIRouter(prefix="/ai", tags=["AI Providers"])

@router.get("/providers")
def get_providers():
    """Returns available AI providers and their model catalogue."""
    return list_supported_providers()

@router.get("/configurations", response_model=List[AIProviderConfigResponse])
def list_configurations(
    workspace_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    get_current_workspace(workspace_id, current_user, db)
    configs = (
        db.query(AIProviderConfig)
        .filter(AIProviderConfig.workspace_id == workspace_id)
        .order_by(AIProviderConfig.is_default.desc(), AIProviderConfig.created_at.desc())
        .all()
    )

    results = []
    for c in configs:
        masked = ""
        try:
            plain = decrypt_credential(c.encrypted_api_key)
            masked = mask_api_key(plain)
        except Exception:
            masked = "••••••••"

        results.append(
            AIProviderConfigResponse(
                id=c.id,
                workspace_id=c.workspace_id,
                provider=c.provider,
                model_name=c.model_name,
                masked_key=masked,
                is_default=c.is_default,
                connection_status=c.connection_status,
                last_tested_at=c.last_tested_at,
                custom_endpoint=c.custom_endpoint,
                created_at=c.created_at
            )
        )
    return results

@router.post("/configurations", response_model=AIProviderConfigResponse)
def create_configuration(
    workspace_id: str,
    config_in: AIProviderConfigCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    get_current_workspace(workspace_id, current_user, db)

    # Encrypt the user's API key using AES-GCM
    encrypted_key = encrypt_credential(config_in.api_key)

    # Check if there are existing configurations
    existing_count = (
        db.query(AIProviderConfig)
        .filter(AIProviderConfig.workspace_id == workspace_id)
        .count()
    )

    is_default = config_in.is_default or (existing_count == 0)

    # If setting default, unset existing default
    if is_default:
        db.query(AIProviderConfig).filter(AIProviderConfig.workspace_id == workspace_id).update({"is_default": False})

    new_config = AIProviderConfig(
        workspace_id=workspace_id,
        user_id=current_user.id,
        provider=config_in.provider.lower(),
        model_name=config_in.model_name,
        encrypted_api_key=encrypted_key,
        is_default=is_default,
        connection_status="untested",
        custom_endpoint=config_in.custom_endpoint
    )
    db.add(new_config)
    db.commit()
    db.refresh(new_config)

    return AIProviderConfigResponse(
        id=new_config.id,
        workspace_id=new_config.workspace_id,
        provider=new_config.provider,
        model_name=new_config.model_name,
        masked_key=mask_api_key(config_in.api_key),
        is_default=new_config.is_default,
        connection_status=new_config.connection_status,
        last_tested_at=new_config.last_tested_at,
        custom_endpoint=new_config.custom_endpoint,
        created_at=new_config.created_at
    )

@router.put("/configurations/{config_id}", response_model=AIProviderConfigResponse)
def update_configuration(
    config_id: str,
    config_in: AIProviderConfigUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    c = db.query(AIProviderConfig).filter(AIProviderConfig.id == config_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Configuration not found.")
    get_current_workspace(c.workspace_id, current_user, db)

    if config_in.model_name is not None:
        c.model_name = config_in.model_name
    if config_in.custom_endpoint is not None:
        c.custom_endpoint = config_in.custom_endpoint
    if config_in.api_key:
        c.encrypted_api_key = encrypt_credential(config_in.api_key)
        c.connection_status = "untested"
        c.last_tested_at = None

    if config_in.is_default:
        db.query(AIProviderConfig).filter(AIProviderConfig.workspace_id == c.workspace_id).update({"is_default": False})
        c.is_default = True

    db.commit()
    db.refresh(c)

    plain = decrypt_credential(c.encrypted_api_key)
    return AIProviderConfigResponse(
        id=c.id,
        workspace_id=c.workspace_id,
        provider=c.provider,
        model_name=c.model_name,
        masked_key=mask_api_key(plain),
        is_default=c.is_default,
        connection_status=c.connection_status,
        last_tested_at=c.last_tested_at,
        custom_endpoint=c.custom_endpoint,
        created_at=c.created_at
    )

@router.delete("/configurations/{config_id}")
def delete_configuration(
    config_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    c = db.query(AIProviderConfig).filter(AIProviderConfig.id == config_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Configuration not found.")
    get_current_workspace(c.workspace_id, current_user, db)

    db.delete(c)
    db.commit()
    return {"message": "Configuration successfully deleted."}

@router.post("/configurations/{config_id}/default")
def set_default_configuration(
    config_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    c = db.query(AIProviderConfig).filter(AIProviderConfig.id == config_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Configuration not found.")
    get_current_workspace(c.workspace_id, current_user, db)

    db.query(AIProviderConfig).filter(AIProviderConfig.workspace_id == c.workspace_id).update({"is_default": False})
    c.is_default = True
    db.commit()
    return {"message": f"Default provider set to {c.provider} ({c.model_name})."}

@router.post("/configurations/{config_id}/test", response_model=AIProviderTestResponse)
def test_saved_configuration(
    config_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    c = db.query(AIProviderConfig).filter(AIProviderConfig.id == config_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Configuration not found.")
    get_current_workspace(c.workspace_id, current_user, db)

    try:
        plain_key = decrypt_credential(c.encrypted_api_key)
        adapter = get_provider_adapter(c.provider)
        res = adapter.test_connection(plain_key, c.model_name, c.custom_endpoint)

        c.connection_status = "connected" if res.get("success") else "failed"
        c.last_tested_at = datetime.now(timezone.utc)
        db.commit()

        return AIProviderTestResponse(
            success=res["success"],
            message=res["message"],
            latency_ms=res.get("latency_ms")
        )
    except Exception as e:
        c.connection_status = "failed"
        c.last_tested_at = datetime.now(timezone.utc)
        db.commit()
        return AIProviderTestResponse(
            success=False,
            message=f"Connection test failed: {str(e)}",
            latency_ms=None
        )

@router.post("/configurations/test-adhoc", response_model=AIProviderTestResponse)
def test_adhoc_configuration(
    req: AIProviderTestRequest,
    current_user: User = Depends(get_current_user)
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
