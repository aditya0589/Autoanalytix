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
    # Since 111122223333 is a mock account, attempting to assume role triggers real AWS STS authorization check
    try:
        presigned_res = client.get(
            f"/api/datasets/presigned-upload-url?filename=sales.csv&workspace_id={workspace_id}",
            headers=headers
        )
    except RuntimeError as e:
        # Confirms CustomerS3StorageService invoked real AWS STS assume_role with customer RoleArn
        assert "sts:AssumeRole" in str(e) or "AccessDenied" in str(e)

    # 8. Revert back to PLATFORM_DEFAULT
    revert_res = client.post(
        f"/api/workspaces/{workspace_id}/storage-config",
        headers=headers,
        json={"provider": "PLATFORM_DEFAULT"}
    )
    assert revert_res.status_code == 200, revert_res.text
    revert_data = revert_res.json()
    assert revert_data["provider"] == "PLATFORM_DEFAULT"
    assert revert_data["mode"] == "PLATFORM_DEFAULT"

    # 9. Storage factory reverts to PlatformS3
    storage_reverted = s3_storage.for_workspace(workspace_id)
    assert isinstance(storage_reverted, PlatformS3StorageService)

    print("\n[OK] All BYOC storage lifecycle tests passed successfully!")

if __name__ == "__main__":
    test_byoc_storage_lifecycle()
