from typing import Dict, Any, Optional, Union
from app.core.config import settings
from app.core.storage.base import BaseStorageService
from app.core.storage.platform_s3 import PlatformS3StorageService
from app.core.storage.customer_s3 import CustomerS3StorageService
from app.core.storage.customer_gcs import CustomerGCSStorageService
from app.core.storage.customer_azure import CustomerAzureBlobStorageService

_default_platform_storage: Optional[PlatformS3StorageService] = None

def get_platform_storage() -> PlatformS3StorageService:
    global _default_platform_storage
    if _default_platform_storage is None:
        _default_platform_storage = PlatformS3StorageService()
    return _default_platform_storage

def get_storage_service(workspace_or_id: Optional[Union[Dict[str, Any], str]] = None) -> BaseStorageService:
    """
    Dynamically resolves the storage service (Platform S3 vs Customer BYOC S3 / GCS / Azure Blob)
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

    provider = (config.get("provider") or "PLATFORM_DEFAULT").upper()
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
            print(f"[StorageFactory] Incomplete BYOC AWS config for workspace {workspace_record.get('id')}; falling back to platform.")
            return get_platform_storage()

    # If workspace configured BYOC Google Cloud Storage (GCP_GCS or GCS)
    elif provider in ("GCP_GCS", "GCS") and status in ("active", "configured"):
        bucket_name = config.get("bucket_name") or config.get("gcp_bucket_name")
        project_id = config.get("project_id") or config.get("gcp_project_id")
        credentials_json = config.get("credentials_json") or config.get("gcp_credentials_json")

        if bucket_name:
            return CustomerGCSStorageService(
                bucket_name=bucket_name,
                project_id=project_id,
                credentials_json=credentials_json,
                prefix=config.get("prefix", "autoanalytix"),
                location=config.get("location") or config.get("region", "us-central1")
            )
        else:
            print(f"[StorageFactory] Incomplete BYOC GCS config for workspace {workspace_record.get('id')}; falling back to platform.")
            return get_platform_storage()

    # If workspace configured BYOC Azure Blob Storage (AZURE_BLOB or AZURE)
    elif provider in ("AZURE_BLOB", "AZURE") and status in ("active", "configured"):
        container_name = config.get("container_name") or config.get("azure_container_name") or config.get("bucket_name")
        account_name = config.get("account_name") or config.get("azure_account_name")
        sas_token = config.get("sas_token") or config.get("azure_sas_token")
        sas_url = config.get("sas_url") or config.get("azure_sas_url")
        connection_string = config.get("connection_string") or config.get("azure_connection_string")
        tenant_id = config.get("tenant_id") or config.get("azure_tenant_id")
        client_id = config.get("client_id") or config.get("azure_client_id")
        client_secret = config.get("client_secret") or config.get("azure_client_secret")

        if container_name and (sas_token or sas_url or connection_string or (tenant_id and client_id and client_secret)):
            return CustomerAzureBlobStorageService(
                container_name=container_name,
                account_name=account_name,
                sas_token=sas_token,
                sas_url=sas_url,
                connection_string=connection_string,
                tenant_id=tenant_id,
                client_id=client_id,
                client_secret=client_secret,
                prefix=config.get("prefix", "autoanalytix"),
                region=config.get("region", "eastus")
            )
        else:
            print(f"[StorageFactory] Incomplete BYOC Azure config for workspace {workspace_record.get('id')}; falling back to platform.")
            return get_platform_storage()

    return get_platform_storage()

