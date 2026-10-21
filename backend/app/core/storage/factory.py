from typing import Dict, Any, Optional, Union
from app.core.config import settings
from app.core.storage.base import BaseStorageService
from app.core.storage.platform_s3 import PlatformS3StorageService
from app.core.storage.customer_s3 import CustomerS3StorageService

_default_platform_storage: Optional[PlatformS3StorageService] = None

def get_platform_storage() -> PlatformS3StorageService:
    global _default_platform_storage
    if _default_platform_storage is None:
        _default_platform_storage = PlatformS3StorageService()
    return _default_platform_storage

def get_storage_service(workspace_or_id: Optional[Union[Dict[str, Any], str]] = None) -> BaseStorageService:
    """
    Dynamically resolves the storage service (Platform S3 vs Customer BYOC S3)
    based on the workspace's cloud storage configuration.
    """
    if not workspace_or_id:
        return get_platform_storage()

    workspace_record = None
    if isinstance(workspace_or_id, str):
        # Resolve from database
        try:
            from app.core.dynamodb import dynamodb_store
            workspace_record = dynamodb_store.get_workspace_by_id(workspace_or_id)
        except Exception as e:
            print(f"[StorageFactory] Warning resolving workspace {workspace_or_id}: {e}")
            return get_platform_storage()
    elif isinstance(workspace_or_id, dict):
        workspace_record = workspace_or_id

    if not workspace_record:
        return get_platform_storage()

    config = workspace_record.get("cloud_storage_config")
    if not config or not isinstance(config, dict):
        return get_platform_storage()

    provider = config.get("provider", "PLATFORM_DEFAULT")
    status = config.get("status", "active")

    # If workspace configured BYOC AWS S3 and is enabled
    if provider == "AWS_S3" and status in ("active", "configured"):
        role_arn = config.get("role_arn")
        bucket_name = config.get("bucket_name")
        external_id = workspace_record.get("external_id") or config.get("external_id")

        if role_arn and bucket_name and external_id:
            return CustomerS3StorageService(
                role_arn=role_arn,
                external_id=external_id,
                bucket_name=bucket_name,
                region=config.get("region", "us-east-1"),
                prefix=config.get("prefix", "autoanalytix"),
                kms_key_arn=config.get("kms_key_arn")
            )
        else:
            print(f"[StorageFactory] Incomplete BYOC config for workspace {workspace_record.get('id')}; falling back to platform.")
            return get_platform_storage()

    return get_platform_storage()
