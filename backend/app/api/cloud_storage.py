import os
import json
import urllib.parse
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Response

from app.core.config import settings
from app.core.dynamodb import dynamodb_store
from app.api.deps import get_current_user, get_current_workspace, ItemObject
from app.schemas.all_schemas import (
    CloudStorageConfigUpdate,
    CloudStorageTestRequest,
    CloudStorageConfigResponse,
    CloudStorageProbeResult
)
from app.core.storage.customer_s3 import CustomerS3StorageService
from app.core.storage.factory import get_storage_service, get_platform_storage

router = APIRouter(prefix="/workspaces/{workspace_id}/storage-config", tags=["Cloud Storage BYOC"])

DEFAULT_PLATFORM_ACCOUNT_ID = "123456789012"
DEFAULT_BACKEND_ROLE_ARN = getattr(
    settings,
    "AUTOANALYTIX_BACKEND_ROLE_ARN",
    f"arn:aws:iam::{DEFAULT_PLATFORM_ACCOUNT_ID}:role/autoanalytix-lambda-role"
)

def generate_cloudformation_template(external_id: str, default_bucket: str = "", default_prefix: str = "autoanalytix") -> Dict[str, Any]:
    """Generates the AWS CloudFormation template for 1-click customer IAM role provisioning."""
    return {
        "AWSTemplateFormatVersion": "2012-10-17",
        "Description": f"Autoanalytix Bring Your Own Cloud (BYOC) Cross-Account IAM Role for Workspace ExternalId: {external_id}",
        "Parameters": {
            "BucketName": {
                "Type": "String",
                "Default": default_bucket,
                "Description": "Name of your existing S3 bucket to store analytical datasets and Parquet files."
            },
            "AutoanalytixBackendRoleArn": {
                "Type": "String",
                "Default": DEFAULT_BACKEND_ROLE_ARN,
                "Description": "Autoanalytix SaaS Backend Execution Role ARN permitted to assume this role."
            },
            "ExternalId": {
                "Type": "String",
                "Default": external_id,
                "Description": "Unique Autoanalytix Workspace External ID (prevents Confused Deputy attacks)."
            },
            "ObjectPrefix": {
                "Type": "String",
                "Default": default_prefix,
                "Description": "S3 folder prefix where Autoanalytix will store objects."
            }
        },
        "Resources": {
            "AutoanalytixStorageAccessRole": {
                "Type": "AWS::IAM::Role",
                "Properties": {
                    "RoleName": f"AutoanalytixStorageRole-{external_id[-8:]}",
                    "Description": "Delegated access role for Autoanalytix zero-retention analytical data processing.",
                    "AssumeRolePolicyDocument": {
                        "Version": "2012-10-17",
                        "Statement": [
                            {
                                "Effect": "Allow",
                                "Principal": {
                                    "AWS": {"Ref": "AutoanalytixBackendRoleArn"}
                                },
                                "Action": "sts:AssumeRole",
                                "Condition": {
                                    "StringEquals": {
                                        "sts:ExternalId": {"Ref": "ExternalId"}
                                    }
                                }
                            }
                        ]
                    },
                    "Policies": [
                        {
                            "PolicyName": "AutoanalytixScopedStorageAccess",
                            "PolicyDocument": {
                                "Version": "2012-10-17",
                                "Statement": [
                                    {
                                        "Sid": "BucketLocationAndList",
                                        "Effect": "Allow",
                                        "Action": [
                                            "s3:ListBucket",
                                            "s3:GetBucketLocation"
                                        ],
                                        "Resource": {
                                            "Fn::Sub": "arn:aws:s3:::${BucketName}"
                                        }
                                    },
                                    {
                                        "Sid": "ScopedObjectAccess",
                                        "Effect": "Allow",
                                        "Action": [
                                            "s3:GetObject",
                                            "s3:PutObject",
                                            "s3:DeleteObject",
                                            "s3:AbortMultipartUpload"
                                        ],
                                        "Resource": {
                                            "Fn::Sub": "arn:aws:s3:::${BucketName}/${ObjectPrefix}/*"
                                        }
                                    }
                                ]
                            }
                        }
                    ]
                }
            }
        },
        "Outputs": {
            "RoleArn": {
                "Description": "The ARN of the newly created IAM role. Copy this back to Autoanalytix Settings.",
                "Value": {"Fn::GetAtt": ["AutoanalytixStorageAccessRole", "Arn"]}
            },
            "BucketName": {
                "Description": "Your dedicated S3 bucket name.",
                "Value": {"Ref": "BucketName"}
            },
            "ExternalId": {
                "Description": "The configured Workspace External ID.",
                "Value": {"Ref": "ExternalId"}
            }
        }
    }

def build_cloudformation_quick_link(external_id: str, region: str = "us-east-1", bucket: str = "") -> str:
    """Builds pre-filled 1-click AWS Management Console CloudFormation quick-create URL."""
    base_url = f"https://console.aws.amazon.com/cloudformation/home?region={region}#/stacks/quickcreate"
    stack_name = f"Autoanalytix-BYOC-{external_id[-8:]}"
    params = {
        "stackName": stack_name,
        "param_ExternalId": external_id,
        "param_AutoanalytixBackendRoleArn": DEFAULT_BACKEND_ROLE_ARN,
        "param_BucketName": bucket,
        "param_ObjectPrefix": "autoanalytix",
    }
    return f"{base_url}?{urllib.parse.urlencode(params)}"

@router.get("", response_model=CloudStorageConfigResponse)
def get_storage_config(
    workspace_id: str,
    current_user: ItemObject = Depends(get_current_user)
):
    """Retrieves current storage configuration, workspace external ID, and connection status."""
    workspace = get_current_workspace(workspace_id, current_user)
    external_id = workspace.get("external_id")
    if not external_id:
        import uuid
        external_id = f"aa_ws_{uuid.uuid4().hex}"
        workspace["external_id"] = external_id
        dynamodb_store.update_workspace_storage_config(workspace_id, workspace.get("cloud_storage_config") or {})

    cfg = workspace.get("cloud_storage_config") or {}
    provider = cfg.get("provider", "PLATFORM_DEFAULT")
    mode = "BYOS_AWS_S3" if provider == "AWS_S3" else "PLATFORM_DEFAULT"

    quick_link = build_cloudformation_quick_link(
        external_id=external_id,
        region=cfg.get("region", "us-east-1"),
        bucket=cfg.get("bucket_name", "")
    )

    return CloudStorageConfigResponse(
        mode=mode,
        provider=provider,
        external_id=external_id,
        bucket_name=cfg.get("bucket_name"),
        region=cfg.get("region", "us-east-1"),
        role_arn=cfg.get("role_arn"),
        prefix=cfg.get("prefix", "autoanalytix"),
        kms_key_arn=cfg.get("kms_key_arn"),
        status=cfg.get("status", "active" if provider == "PLATFORM_DEFAULT" else "unverified"),
        verified=cfg.get("verified", provider == "PLATFORM_DEFAULT"),
        verified_at=cfg.get("verified_at"),
        last_error=cfg.get("last_error"),
        platform_account_id=DEFAULT_PLATFORM_ACCOUNT_ID,
        backend_role_arn=DEFAULT_BACKEND_ROLE_ARN,
        cloudformation_quick_link=quick_link
    )

@router.post("/test", response_model=CloudStorageProbeResult)
def test_storage_connection(
    workspace_id: str,
    test_in: CloudStorageTestRequest,
    current_user: ItemObject = Depends(get_current_user)
):
    """Executes real-time 4-step probe test against customer AWS IAM role and S3 bucket."""
    workspace = get_current_workspace(workspace_id, current_user)
    external_id = workspace.get("external_id")
    if not external_id:
        import uuid
        external_id = f"aa_ws_{uuid.uuid4().hex}"
        workspace["external_id"] = external_id

    if test_in.provider != "AWS_S3":
        raise HTTPException(status_code=400, detail=f"Testing for provider '{test_in.provider}' is not supported yet.")

    customer_service = CustomerS3StorageService(
        role_arn=test_in.role_arn,
        external_id=external_id,
        bucket_name=test_in.bucket_name,
        region=test_in.region,
        prefix=test_in.prefix or "autoanalytix",
        kms_key_arn=test_in.kms_key_arn
    )

    probe_result = customer_service.test_connection()
    return CloudStorageProbeResult(**probe_result)

@router.post("", response_model=CloudStorageConfigResponse)
def update_storage_config(
    workspace_id: str,
    update_in: CloudStorageConfigUpdate,
    current_user: ItemObject = Depends(get_current_user)
):
    """
    Saves or switches storage configuration.
    Switching to BYOS (AWS S3) or reverting to PLATFORM_DEFAULT.
    """
    workspace = get_current_workspace(workspace_id, current_user)
    external_id = workspace.get("external_id")
    if not external_id:
        import uuid
        external_id = f"aa_ws_{uuid.uuid4().hex}"
        workspace["external_id"] = external_id

    now = datetime.now(timezone.utc).isoformat()

    if update_in.provider == "PLATFORM_DEFAULT":
        new_config = {
            "provider": "PLATFORM_DEFAULT",
            "status": "active",
            "verified": True,
            "verified_at": now,
            "updated_at": now,
            "bucket_name": None,
            "role_arn": None,
            "prefix": "autoanalytix",
            "kms_key_arn": None,
            "last_error": None
        }
        dynamodb_store.update_workspace_storage_config(workspace_id, new_config)
        return get_storage_config(workspace_id, current_user)

    elif update_in.provider == "AWS_S3":
        if not update_in.bucket_name or not update_in.role_arn:
            raise HTTPException(
                status_code=400,
                detail="Both 'bucket_name' and 'role_arn' are mandatory for BYOC AWS S3 configuration."
            )

        # Test connection unless skip_verification is requested
        verified = True if update_in.skip_verification else False
        last_error = None
        if not update_in.skip_verification:
            customer_service = CustomerS3StorageService(
                role_arn=update_in.role_arn,
                external_id=external_id,
                bucket_name=update_in.bucket_name,
                region=update_in.region or "us-east-1",
                prefix=update_in.prefix or "autoanalytix",
                kms_key_arn=update_in.kms_key_arn
            )
            probe = customer_service.test_connection()
            if not probe.get("healthy"):
                error_msg = probe.get("error") or "Failed to verify connection to customer AWS S3 bucket."
                raise HTTPException(
                    status_code=400,
                    detail=f"Connection verification failed: {error_msg}. Please ensure your CloudFormation stack is deployed and the role trusts Autoanalytix."
                )
            verified = True

        new_config = {
            "provider": "AWS_S3",
            "bucket_name": update_in.bucket_name.strip(),
            "region": (update_in.region or "us-east-1").strip(),
            "role_arn": update_in.role_arn.strip(),
            "prefix": (update_in.prefix or "autoanalytix").strip("/"),
            "kms_key_arn": update_in.kms_key_arn.strip() if update_in.kms_key_arn else None,
            "status": "active" if verified else "unverified",
            "verified": verified,
            "verified_at": now if verified else None,
            "last_error": last_error,
            "updated_at": now
        }
        dynamodb_store.update_workspace_storage_config(workspace_id, new_config)
        return get_storage_config(workspace_id, current_user)

    else:
        raise HTTPException(
            status_code=400,
            detail=f"Provider '{update_in.provider}' is not supported yet. Supported: PLATFORM_DEFAULT, AWS_S3."
        )

@router.get("/cloudformation")
def get_cloudformation_template(
    workspace_id: str,
    bucket: Optional[str] = Query(None),
    prefix: Optional[str] = Query("autoanalytix"),
    format: str = Query("json"),  # "json" or "yaml"
    current_user: ItemObject = Depends(get_current_user)
):
    """Returns downloadable CloudFormation template customized with the workspace's External ID."""
    workspace = get_current_workspace(workspace_id, current_user)
    external_id = workspace.get("external_id")
    if not external_id:
        import uuid
        external_id = f"aa_ws_{uuid.uuid4().hex}"
        workspace["external_id"] = external_id
        dynamodb_store.update_workspace_storage_config(workspace_id, workspace.get("cloud_storage_config") or {})

    tmpl = generate_cloudformation_template(
        external_id=external_id,
        default_bucket=bucket or "",
        default_prefix=prefix or "autoanalytix"
    )

    if format.lower() == "yaml":
        try:
            import yaml
            content = yaml.dump(tmpl, sort_keys=False)
            return Response(
                content=content,
                media_type="text/yaml",
                headers={"Content-Disposition": f"attachment; filename=autoanalytix-byoc-{external_id[-8:]}.yaml"}
            )
        except ImportError:
            pass

    return Response(
        content=json.dumps(tmpl, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=autoanalytix-byoc-{external_id[-8:]}.json"}
    )

@router.post("/migrate")
def migrate_existing_datasets(
    workspace_id: str,
    current_user: ItemObject = Depends(get_current_user)
):
    """
    Transfers historical datasets from Platform storage into the customer's BYOC S3 bucket
    and updates dataset records to point to customer storage.
    """
    workspace = get_current_workspace(workspace_id, current_user)
    cfg = workspace.get("cloud_storage_config") or {}
    if cfg.get("provider") != "AWS_S3" or not cfg.get("verified"):
        raise HTTPException(
            status_code=400,
            detail="BYOC AWS S3 must be configured and verified before migrating datasets."
        )

    customer_service = get_storage_service(workspace)
    platform_service = get_platform_storage()
    datasets = dynamodb_store.list_datasets(workspace_id)

    migrated_count = 0
    errors = []

    for ds in datasets:
        file_path = ds.get("file_path", "")
        clean_key = file_path.replace("\\", "/")
        if "uploads/" in clean_key:
            relative_key = "uploads/" + clean_key.split("uploads/", 1)[1]
        else:
            relative_key = clean_key.lstrip("/")

        try:
            local_cached = platform_service.ensure_local_cache(relative_key)
            if local_cached and os.path.exists(local_cached):
                # Upload to customer S3
                new_key = customer_service.upload_file(local_cached, relative_key)
                # Update dataset record
                ds["file_path"] = new_key
                ds["storage_provider"] = "BYOS_AWS_S3"
                dynamodb_store.create_dataset(ds)  # overwrites/updates dataset
                migrated_count += 1
        except Exception as e:
            errors.append(f"Failed to migrate dataset '{ds.get('name', ds.get('id'))}': {str(e)}")

    return {
        "success": len(errors) == 0,
        "migrated_count": migrated_count,
        "total_datasets": len(datasets),
        "errors": errors,
        "message": f"Successfully migrated {migrated_count} of {len(datasets)} datasets to your private S3 bucket."
    }
