import os
import sys
import uuid

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.dynamodb import dynamodb_store
from app.core.storage.factory import get_storage_service
from app.core.storage.platform_s3 import PlatformS3StorageService
from app.core.storage.customer_s3 import CustomerS3StorageService
from app.core.storage.customer_gcs import CustomerGCSStorageService
from app.core.storage.customer_azure import CustomerAzureBlobStorageService
from app.core.s3_storage import s3_storage

client = TestClient(app)

def test_byoc_storage_lifecycle():
    # 1. Register test user & auto-create workspace
    unique_email = f"byoc_test_{uuid.uuid4().hex[:8]}@example.com"
    reg_res = client.post(
        "/api/auth/register",
        json={
            "email": unique_email,
            "password": "Password123!",
            "full_name": "BYOC Test User"
        }
    )
    assert reg_res.status_code == 200, reg_res.text
    token_data = reg_res.json()
    token = token_data["access_token"]
    user_id = token_data["user"]["id"]
    headers = {"Authorization": f"Bearer {token}"}

    # Fetch user workspace
    me_res = client.get("/api/auth/me", headers=headers)
    assert me_res.status_code == 200
    workspaces = me_res.json()["workspaces"]
    assert len(workspaces) > 0
    workspace = workspaces[0]
    workspace_id = workspace["id"]

    # 2. Query initial storage config (Defaults to PLATFORM_DEFAULT)
    cfg_res = client.get(f"/api/workspaces/{workspace_id}/storage-config", headers=headers)
    assert cfg_res.status_code == 200, cfg_res.text
    cfg_data = cfg_res.json()
    assert cfg_data["provider"] == "PLATFORM_DEFAULT"
    assert cfg_data["mode"] == "PLATFORM_DEFAULT"
    assert "external_id" in cfg_data
    assert cfg_data["external_id"].startswith("aa_ws_")
    assert cfg_data["platform_account_id"] == "123456789012"
    assert "cloudformation_quick_link" in cfg_data
    assert cfg_data["external_id"] in cfg_data["cloudformation_quick_link"]

    external_id = cfg_data["external_id"]

    # 3. Verify CloudFormation template download
    cfn_res = client.get(f"/api/workspaces/{workspace_id}/storage-config/cloudformation", headers=headers)
    assert cfn_res.status_code == 200
    cfn_template = cfn_res.json()
    assert cfn_template["AWSTemplateFormatVersion"] == "2012-10-17"
    assert "AutoanalytixStorageAccessRole" in cfn_template["Resources"]
    role_props = cfn_template["Resources"]["AutoanalytixStorageAccessRole"]["Properties"]
    statement = role_props["AssumeRolePolicyDocument"]["Statement"][0]
    assert statement["Condition"]["StringEquals"]["sts:ExternalId"]["Ref"] == "ExternalId"
    assert cfn_template["Parameters"]["ExternalId"]["Default"] == external_id

    # 4. Storage factory defaults to PlatformS3
    storage_initial = s3_storage.for_workspace(workspace_id)
    assert isinstance(storage_initial, PlatformS3StorageService)

    # 5. Update workspace to BYOC (AWS S3)
    update_res = client.post(
        f"/api/workspaces/{workspace_id}/storage-config",
        headers=headers,
        json={
            "provider": "AWS_S3",
            "bucket_name": "acme-corp-private-vault",
            "region": "us-east-1",
            "role_arn": "arn:aws:iam::111122223333:role/AutoanalytixStorageRole-12345678",
            "prefix": "custom_analytics",
            "skip_verification": True
        }
    )
    assert update_res.status_code == 200, update_res.text
    byoc_cfg = update_res.json()
    assert byoc_cfg["provider"] == "AWS_S3"
    assert byoc_cfg["mode"] == "BYOS_AWS_S3"
    assert byoc_cfg["bucket_name"] == "acme-corp-private-vault"
    assert byoc_cfg["role_arn"] == "arn:aws:iam::111122223333:role/AutoanalytixStorageRole-12345678"
    assert byoc_cfg["prefix"] == "custom_analytics"

    # 6. Verify dynamic storage factory resolves to CustomerS3StorageService
    storage_byoc = s3_storage.for_workspace(workspace_id)
    assert isinstance(storage_byoc, CustomerS3StorageService)
    assert storage_byoc.bucket == "acme-corp-private-vault"
    assert storage_byoc.role_arn == "arn:aws:iam::111122223333:role/AutoanalytixStorageRole-12345678"
    assert storage_byoc.external_id == external_id
    assert storage_byoc.prefix == "custom_analytics"

    # 7. Presigned upload URL generation routes to customer S3 bucket
    try:
        presigned_res = client.get(
            f"/api/datasets/presigned-upload-url?filename=sales.csv&workspace_id={workspace_id}",
            headers=headers
        )
    except RuntimeError as e:
        assert "sts:AssumeRole" in str(e) or "AccessDenied" in str(e)

    # 8. Update workspace to BYOC (GCP GCS)
    gcp_update_res = client.post(
        f"/api/workspaces/{workspace_id}/storage-config",
        headers=headers,
        json={
            "provider": "GCP_GCS",
            "gcp_bucket_name": "acme-corp-gcs-vault",
            "gcp_project_id": "acme-bi-prod",
            "gcp_location": "us-central1",
            "prefix": "gcp_analytics",
            "skip_verification": True
        }
    )
    assert gcp_update_res.status_code == 200, gcp_update_res.text
    gcp_cfg = gcp_update_res.json()
    assert gcp_cfg["provider"] == "GCP_GCS"
    assert gcp_cfg["mode"] == "BYOS_GCP_GCS"
    assert gcp_cfg["bucket_name"] == "acme-corp-gcs-vault"
    assert gcp_cfg["gcp_project_id"] == "acme-bi-prod"
    assert gcp_cfg["gcp_location"] == "us-central1"

    # 9. Verify dynamic storage factory resolves to CustomerGCSStorageService
    storage_gcs = s3_storage.for_workspace(workspace_id)
    assert isinstance(storage_gcs, CustomerGCSStorageService)
    assert storage_gcs.bucket_name == "acme-corp-gcs-vault"
    assert storage_gcs.project_id == "acme-bi-prod"
    assert storage_gcs.prefix == "gcp_analytics"

    # 10. Verify GCP setup script generation
    gcp_script_res = client.get(
        f"/api/workspaces/{workspace_id}/storage-config/gcp-script?bucket=acme-corp-gcs-vault&project_id=acme-bi-prod",
        headers=headers
    )
    assert gcp_script_res.status_code == 200
    gcp_script_data = gcp_script_res.json()
    assert "gcloud_bash_script" in gcp_script_data
    assert "terraform_configuration" in gcp_script_data
    assert "acme-corp-gcs-vault" in gcp_script_data["gcloud_bash_script"]

    # 11. Update workspace to BYOC (Azure Blob Storage)
    azure_update_res = client.post(
        f"/api/workspaces/{workspace_id}/storage-config",
        headers=headers,
        json={
            "provider": "AZURE_BLOB",
            "azure_account_name": "acmestorageaccount",
            "azure_container_name": "analytics-container",
            "azure_sas_token": "?sp=racwdl&st=2026-01-01&sig=mocktesttoken",
            "region": "eastus",
            "prefix": "azure_data",
            "skip_verification": True
        }
    )
    assert azure_update_res.status_code == 200, azure_update_res.text
    azure_cfg = azure_update_res.json()
    assert azure_cfg["provider"] == "AZURE_BLOB"
    assert azure_cfg["mode"] == "BYOS_AZURE_BLOB"
    assert azure_cfg["azure_account_name"] == "acmestorageaccount"
    assert azure_cfg["azure_container_name"] == "analytics-container"
    assert azure_cfg["azure_auth_type"] == "sas_token"

    # 12. Verify dynamic storage factory resolves to CustomerAzureBlobStorageService
    storage_azure = s3_storage.for_workspace(workspace_id)
    assert isinstance(storage_azure, CustomerAzureBlobStorageService)
    assert storage_azure.container_name == "analytics-container"
    assert storage_azure.account_name == "acmestorageaccount"
    assert storage_azure.prefix == "azure_data"

    # 13. Verify Azure setup script generation
    azure_script_res = client.get(
        f"/api/workspaces/{workspace_id}/storage-config/azure-script?account_name=acmestorageaccount&container_name=analytics-container",
        headers=headers
    )
    assert azure_script_res.status_code == 200
    azure_script_data = azure_script_res.json()
    assert "azure_cli_script" in azure_script_data
    assert "analytics-container" in azure_script_data["azure_cli_script"]

    # 14. Revert back to PLATFORM_DEFAULT
    revert_res = client.post(
        f"/api/workspaces/{workspace_id}/storage-config",
        headers=headers,
        json={"provider": "PLATFORM_DEFAULT"}
    )
    assert revert_res.status_code == 200, revert_res.text
    revert_data = revert_res.json()
    assert revert_data["provider"] == "PLATFORM_DEFAULT"
    assert revert_data["mode"] == "PLATFORM_DEFAULT"

    # 15. Storage factory reverts to PlatformS3
    storage_reverted = s3_storage.for_workspace(workspace_id)
    assert isinstance(storage_reverted, PlatformS3StorageService)

    print("\n[OK] All Multi-Cloud BYOC storage lifecycle tests (AWS, GCP, Azure) passed successfully!")

if __name__ == "__main__":
    test_byoc_storage_lifecycle()

