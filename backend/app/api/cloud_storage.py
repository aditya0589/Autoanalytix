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
from app.core.storage.customer_gcs import CustomerGCSStorageService
from app.core.storage.customer_azure import CustomerAzureBlobStorageService
from app.core.storage.factory import get_storage_service, get_platform_storage

router = APIRouter(prefix="/workspaces/{workspace_id}/storage-config", tags=["Cloud Storage BYOC"])

DEFAULT_PLATFORM_ACCOUNT_ID = getattr(
    settings,
    "AWS_ACCOUNT_ID",
    os.environ.get("AWS_ACCOUNT_ID", "")
)
DEFAULT_BACKEND_ROLE_ARN = getattr(
    settings,
    "AUTOANALYTIX_BACKEND_ROLE_ARN",
    os.environ.get(
        "AUTOANALYTIX_BACKEND_ROLE_ARN",
        f"arn:aws:iam::{DEFAULT_PLATFORM_ACCOUNT_ID}:role/autoanalytix-lambda-role" if DEFAULT_PLATFORM_ACCOUNT_ID else ""
    )
)

def _encrypt_secret(val: Optional[str]) -> Optional[str]:
    """Encrypts a sensitive BYOC cloud secret at rest with AES-GCM."""
    if not val or not isinstance(val, str) or val.startswith("ENC:"):
        return val
    try:
        from app.core.security import encrypt_credential
        return f"ENC:{encrypt_credential(val)}"
    except Exception:
        return val

def _decrypt_secret(val: Optional[str]) -> Optional[str]:
    """Decrypts a sensitive BYOC cloud secret in-memory for driver connection testing."""
    if not val or not isinstance(val, str):
        return val
    if val.startswith("ENC:"):
        try:
            from app.core.security import decrypt_credential
            return decrypt_credential(val[4:])
        except Exception:
            return val
    return val

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
    
    if provider == "AWS_S3":
        mode = "BYOS_AWS_S3"
    elif provider in ("GCP_GCS", "GCS"):
        mode = "BYOS_GCP_GCS"
    elif provider in ("AZURE_BLOB", "AZURE"):
        mode = "BYOS_AZURE_BLOB"
    else:
        mode = "PLATFORM_DEFAULT"

    quick_link = build_cloudformation_quick_link(
        external_id=external_id,
        region=cfg.get("region", "us-east-1"),
        bucket=cfg.get("bucket_name", "")
    )

    # Azure masked values
    azure_sas = _decrypt_secret(cfg.get("azure_sas_token") or cfg.get("sas_token"))
    azure_conn = _decrypt_secret(cfg.get("azure_connection_string") or cfg.get("connection_string"))
    azure_sas_masked = (f"***{azure_sas[-6:]}") if azure_sas and len(azure_sas) > 6 else (("***") if azure_sas else None)
    azure_conn_masked = (f"***{azure_conn[-8:]}") if azure_conn and len(azure_conn) > 8 else (("***") if azure_conn else None)

    azure_auth = "sas_token" if azure_sas else (
        "sas_url" if (cfg.get("azure_sas_url") or cfg.get("sas_url")) else (
            "connection_string" if azure_conn else (
                "service_principal" if (cfg.get("azure_tenant_id") or cfg.get("tenant_id")) else None
            )
        )
    )

    return CloudStorageConfigResponse(
        mode=mode,
        provider=provider,
        external_id=external_id,
        bucket_name=cfg.get("bucket_name") or cfg.get("gcp_bucket_name") or cfg.get("azure_container_name"),
        region=cfg.get("region") or cfg.get("gcp_location") or "us-east-1",
        role_arn=cfg.get("role_arn"),
        prefix=cfg.get("prefix", "autoanalytix"),
        kms_key_arn=cfg.get("kms_key_arn"),
        status=cfg.get("status", "active" if provider == "PLATFORM_DEFAULT" else "unverified"),
        verified=cfg.get("verified", provider == "PLATFORM_DEFAULT"),
        verified_at=cfg.get("verified_at"),
        last_error=cfg.get("last_error"),
        platform_account_id=DEFAULT_PLATFORM_ACCOUNT_ID,
        backend_role_arn=DEFAULT_BACKEND_ROLE_ARN,
        cloudformation_quick_link=quick_link,
        # GCP
        gcp_project_id=cfg.get("gcp_project_id") or cfg.get("project_id"),
        gcp_bucket_name=cfg.get("gcp_bucket_name") or (cfg.get("bucket_name") if provider in ("GCP_GCS", "GCS") else None),
        gcp_location=cfg.get("gcp_location") or cfg.get("location") or cfg.get("region", "us-central1"),
        has_gcp_credentials=bool(cfg.get("gcp_credentials_json") or cfg.get("credentials_json")),
        # Azure
        azure_account_name=cfg.get("azure_account_name") or cfg.get("account_name"),
        azure_container_name=cfg.get("azure_container_name") or cfg.get("container_name") or (cfg.get("bucket_name") if provider in ("AZURE_BLOB", "AZURE") else None),
        azure_sas_token_masked=azure_sas_masked,
        azure_connection_string_masked=azure_conn_masked,
        azure_auth_type=azure_auth
    )

@router.post("/test", response_model=CloudStorageProbeResult)
def test_storage_connection(
    workspace_id: str,
    test_in: CloudStorageTestRequest,
    current_user: ItemObject = Depends(get_current_user)
):
    """Executes real-time 4-step probe test against customer cloud storage (AWS, GCP, or Azure)."""
    workspace = get_current_workspace(workspace_id, current_user)
    external_id = workspace.get("external_id")
    if not external_id:
        import uuid
        external_id = f"aa_ws_{uuid.uuid4().hex}"
        workspace["external_id"] = external_id

    cfg = workspace.get("cloud_storage_config") or {}

    # 1. AWS S3
    if test_in.provider == "AWS_S3":
        if not test_in.role_arn or not test_in.bucket_name:
            raise HTTPException(status_code=400, detail="role_arn and bucket_name are required for AWS S3 testing.")
        customer_service = CustomerS3StorageService(
            role_arn=test_in.role_arn,
            external_id=external_id,
            bucket_name=test_in.bucket_name,
            region=test_in.region or "us-east-1",
            prefix=test_in.prefix or "autoanalytix",
            kms_key_arn=test_in.kms_key_arn
        )
        probe_result = customer_service.test_connection()
        return CloudStorageProbeResult(**probe_result)

    # 2. GCP Cloud Storage
    elif test_in.provider in ("GCP_GCS", "GCS"):
        bucket_name = test_in.gcp_bucket_name or test_in.bucket_name
        if not bucket_name:
            raise HTTPException(status_code=400, detail="gcp_bucket_name is required for GCP GCS testing.")
        
        raw_creds = test_in.gcp_credentials_json or cfg.get("gcp_credentials_json") or cfg.get("credentials_json")
        creds = _decrypt_secret(raw_creds)
        project_id = test_in.gcp_project_id or cfg.get("gcp_project_id") or cfg.get("project_id")

        customer_service = CustomerGCSStorageService(
            bucket_name=bucket_name,
            project_id=project_id,
            credentials_json=creds,
            prefix=test_in.prefix or "autoanalytix",
            location=test_in.gcp_location or test_in.region or "us-central1"
        )
        probe_result = customer_service.test_connection()
        return CloudStorageProbeResult(**probe_result)

    # 3. Azure Blob Storage
    elif test_in.provider in ("AZURE_BLOB", "AZURE"):
        container_name = test_in.azure_container_name or test_in.bucket_name
        if not container_name:
            raise HTTPException(status_code=400, detail="azure_container_name is required for Azure Blob testing.")

        account_name = test_in.azure_account_name or cfg.get("azure_account_name")
        sas_token = test_in.azure_sas_token or _decrypt_secret(cfg.get("azure_sas_token"))
        sas_url = test_in.azure_sas_url or cfg.get("azure_sas_url")
        connection_string = test_in.azure_connection_string or _decrypt_secret(cfg.get("azure_connection_string"))
        tenant_id = test_in.azure_tenant_id or cfg.get("azure_tenant_id")
        client_id = test_in.azure_client_id or cfg.get("azure_client_id")
        client_secret = test_in.azure_client_secret or _decrypt_secret(cfg.get("azure_client_secret"))

        customer_service = CustomerAzureBlobStorageService(
            container_name=container_name,
            account_name=account_name,
            sas_token=sas_token,
            sas_url=sas_url,
            connection_string=connection_string,
            tenant_id=tenant_id,
            client_id=client_id,
            client_secret=client_secret,
            prefix=test_in.prefix or "autoanalytix",
            region=test_in.region or "eastus"
        )
        probe_result = customer_service.test_connection()
        return CloudStorageProbeResult(**probe_result)

    else:
        raise HTTPException(status_code=400, detail=f"Testing for provider '{test_in.provider}' is not supported yet.")

@router.post("", response_model=CloudStorageConfigResponse)
def update_storage_config(
    workspace_id: str,
    update_in: CloudStorageConfigUpdate,
    current_user: ItemObject = Depends(get_current_user)
):
    """
    Saves or switches storage configuration.
    Supports PLATFORM_DEFAULT, AWS_S3, GCP_GCS, and AZURE_BLOB.
    """
    workspace = get_current_workspace(workspace_id, current_user)
    external_id = workspace.get("external_id")
    if not external_id:
        import uuid
        external_id = f"aa_ws_{uuid.uuid4().hex}"
        workspace["external_id"] = external_id

    existing_cfg = workspace.get("cloud_storage_config") or {}
    now = datetime.now(timezone.utc).isoformat()

    # Option 1: Revert to PLATFORM_DEFAULT
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

    # Option 2: BYOC AWS S3
    elif update_in.provider == "AWS_S3":
        if not update_in.bucket_name or not update_in.role_arn:
            raise HTTPException(
                status_code=400,
                detail="Both 'bucket_name' and 'role_arn' are mandatory for BYOC AWS S3 configuration."
            )

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

    # Option 3: BYOC Google Cloud Storage (GCP_GCS)
    elif update_in.provider in ("GCP_GCS", "GCS"):
        bucket_name = (update_in.gcp_bucket_name or update_in.bucket_name or "").strip()
        if not bucket_name:
            raise HTTPException(
                status_code=400,
                detail="GCS bucket name is mandatory for BYOC Google Cloud Storage."
            )

        # Retain existing credentials if user didn't re-upload
        raw_creds = update_in.gcp_credentials_json or existing_cfg.get("gcp_credentials_json") or existing_cfg.get("credentials_json")
        creds_json = _decrypt_secret(raw_creds)
        project_id = (update_in.gcp_project_id or existing_cfg.get("gcp_project_id") or "").strip() or None
        location = (update_in.gcp_location or update_in.region or "us-central1").strip()

        verified = True if update_in.skip_verification else False
        last_error = None
        if not update_in.skip_verification:
            customer_service = CustomerGCSStorageService(
                bucket_name=bucket_name,
                project_id=project_id,
                credentials_json=creds_json,
                prefix=update_in.prefix or "autoanalytix",
                location=location
            )
            probe = customer_service.test_connection()
            if not probe.get("healthy"):
                error_msg = probe.get("error") or "Failed to verify connection to customer GCS bucket."
                raise HTTPException(
                    status_code=400,
                    detail=f"GCP Connection verification failed: {error_msg}. Please verify your bucket and Service Account credentials."
                )
            verified = True

        new_config = {
            "provider": "GCP_GCS",
            "bucket_name": bucket_name,
            "gcp_bucket_name": bucket_name,
            "gcp_project_id": project_id,
            "gcp_credentials_json": _encrypt_secret(creds_json),
            "gcp_location": location,
            "region": location,
            "prefix": (update_in.prefix or "autoanalytix").strip("/"),
            "status": "active" if verified else "unverified",
            "verified": verified,
            "verified_at": now if verified else None,
            "last_error": last_error,
            "updated_at": now
        }
        dynamodb_store.update_workspace_storage_config(workspace_id, new_config)
        return get_storage_config(workspace_id, current_user)

    # Option 4: BYOC Azure Blob Storage (AZURE_BLOB)
    elif update_in.provider in ("AZURE_BLOB", "AZURE"):
        container_name = (update_in.azure_container_name or update_in.bucket_name or "").strip()
        if not container_name:
            raise HTTPException(
                status_code=400,
                detail="Azure Blob container name is mandatory for BYOC Azure configuration."
            )

        account_name = (update_in.azure_account_name or existing_cfg.get("azure_account_name") or "").strip() or None
        sas_token = update_in.azure_sas_token or _decrypt_secret(existing_cfg.get("azure_sas_token"))
        sas_url = update_in.azure_sas_url or existing_cfg.get("azure_sas_url")
        connection_string = update_in.azure_connection_string or _decrypt_secret(existing_cfg.get("azure_connection_string"))
        tenant_id = update_in.azure_tenant_id or existing_cfg.get("azure_tenant_id")
        client_id = update_in.azure_client_id or existing_cfg.get("azure_client_id")
        client_secret = update_in.azure_client_secret or _decrypt_secret(existing_cfg.get("azure_client_secret"))

        verified = True if update_in.skip_verification else False
        last_error = None
        if not update_in.skip_verification:
            customer_service = CustomerAzureBlobStorageService(
                container_name=container_name,
                account_name=account_name,
                sas_token=sas_token,
                sas_url=sas_url,
                connection_string=connection_string,
                tenant_id=tenant_id,
                client_id=client_id,
                client_secret=client_secret,
                prefix=update_in.prefix or "autoanalytix",
                region=update_in.region or "eastus"
            )
            probe = customer_service.test_connection()
            if not probe.get("healthy"):
                error_msg = probe.get("error") or "Failed to verify connection to customer Azure Blob container."
                raise HTTPException(
                    status_code=400,
                    detail=f"Azure Connection verification failed: {error_msg}. Please check your SAS token, connection string, or container permissions."
                )
            verified = True

        new_config = {
            "provider": "AZURE_BLOB",
            "bucket_name": container_name,
            "container_name": container_name,
            "azure_container_name": container_name,
            "azure_account_name": account_name,
            "azure_sas_token": _encrypt_secret(sas_token),
            "azure_sas_url": sas_url,
            "azure_connection_string": _encrypt_secret(connection_string),
            "azure_tenant_id": tenant_id,
            "azure_client_id": client_id,
            "azure_client_secret": _encrypt_secret(client_secret),
            "region": (update_in.region or "eastus").strip(),
            "prefix": (update_in.prefix or "autoanalytix").strip("/"),
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
            detail=f"Provider '{update_in.provider}' is not supported. Supported: PLATFORM_DEFAULT, AWS_S3, GCP_GCS, AZURE_BLOB."
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

@router.get("/gcp-script")
def get_gcp_setup_script(
    workspace_id: str,
    bucket: Optional[str] = Query("my-company-analytics-bucket"),
    project_id: Optional[str] = Query("my-gcp-project"),
    current_user: ItemObject = Depends(get_current_user)
):
    """Generates copyable gcloud CLI bash script and Terraform snippet for automated GCP Service Account & GCS setup."""
    workspace = get_current_workspace(workspace_id, current_user)
    external_id = workspace.get("external_id") or "aa_ws_default"

    sa_name = f"autoanalytix-byoc-{external_id[-8:]}"

    gcloud_script = f"""#!/bin/bash
# Autoanalytix GCP BYOC 1-Click Provisioning Script
# Workspace External ID: {external_id}

PROJECT_ID="{project_id}"
BUCKET_NAME="{bucket}"
SA_NAME="{sa_name}"
SA_EMAIL="${{SA_NAME}}@${{PROJECT_ID}}.iam.gserviceaccount.com"

echo "==> Configuring GCP Project: ${{PROJECT_ID}}"
gcloud config set project "${{PROJECT_ID}}"

echo "==> Ensuring GCS Bucket exists: gs://${{BUCKET_NAME}}"
gcloud storage buckets create "gs://${{BUCKET_NAME}}" --project="${{PROJECT_ID}}" --location=US --uniform-bucket-level-access 2>/dev/null || true

echo "==> Creating Autoanalytix Service Account: ${{SA_NAME}}"
gcloud iam service-accounts create "${{SA_NAME}}" \\
    --display-name="Autoanalytix BYOC Storage Service Account" \\
    --description="Allows Autoanalytix zero-retention analytics to stream datasets to gs://${{BUCKET_NAME}}" 2>/dev/null || true

echo "==> Granting storage.objectAdmin role on bucket"
gcloud storage buckets add-iam-policy-binding "gs://${{BUCKET_NAME}}" \\
    --member="serviceAccount:${{SA_EMAIL}}" \\
    --role="roles/storage.objectAdmin"

echo "==> Generating Service Account Key (autoanalytix-key.json)"
gcloud iam service-accounts keys create autoanalytix-key.json \\
    --iam-account="${{SA_EMAIL}}"

echo "SUCCESS! Upload autoanalytix-key.json into Autoanalytix Cloud Storage Settings."
"""

    terraform_script = f"""# Terraform configuration for Autoanalytix GCP BYOC
# Workspace External ID: {external_id}

variable "project_id" {{
  type    = string
  default = "{project_id}"
}}

variable "bucket_name" {{
  type    = string
  default = "{bucket}"
}}

resource "google_storage_bucket" "analytics_bucket" {{
  name          = var.bucket_name
  location      = "US"
  project       = var.project_id
  force_destroy = false
  uniform_bucket_level_access = true
}}

resource "google_service_account" "autoanalytix_sa" {{
  account_id   = "{sa_name}"
  display_name = "Autoanalytix BYOC Storage"
  project      = var.project_id
}}

resource "google_storage_bucket_iam_member" "sa_storage_admin" {{
  bucket = google_storage_bucket.analytics_bucket.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${{google_service_account.autoanalytix_sa.email}}"
}}

resource "google_service_account_key" "sa_key" {{
  service_account_id = google_service_account.autoanalytix_sa.name
}}

output "service_account_key_json" {{
  value     = base64decode(google_service_account_key.sa_key.private_key)
  sensitive = true
}}
"""

    return {
        "external_id": external_id,
        "gcloud_bash_script": gcloud_script,
        "terraform_configuration": terraform_script
    }

@router.get("/azure-script")
def get_azure_setup_script(
    workspace_id: str,
    account_name: Optional[str] = Query("myanalyticsstorage"),
    container_name: Optional[str] = Query("autoanalytix"),
    current_user: ItemObject = Depends(get_current_user)
):
    """Generates copyable Azure CLI script to create container and generate scoped SAS token."""
    workspace = get_current_workspace(workspace_id, current_user)
    external_id = workspace.get("external_id") or "aa_ws_default"

    az_script = f"""# Azure CLI Setup for Autoanalytix BYOC (Zero Master Secrets)
# Workspace External ID: {external_id}

ACCOUNT_NAME="{account_name}"
CONTAINER_NAME="{container_name}"
EXPIRY_DATE=$(date -u -d "+1 year" '+%Y-%m-%dT%H:%MZ' 2>/dev/null || date -u -v+1y '+%Y-%m-%dT%H:%MZ')

echo "==> Ensuring Azure Storage container '${{CONTAINER_NAME}}' exists"
az storage container create \\
  --name "${{CONTAINER_NAME}}" \\
  --account-name "${{ACCOUNT_NAME}}" \\
  --auth-mode login

echo "==> Generating scoped SAS Token (Read, Write, Delete, List) for container '${{CONTAINER_NAME}}'"
SAS_TOKEN=$(az storage container generate-sas \\
  --account-name "${{ACCOUNT_NAME}}" \\
  --name "${{CONTAINER_NAME}}" \\
  --permissions racwdl \\
  --expiry "${{EXPIRY_DATE}}" \\
  --auth-mode login \\
  --as-user \\
  --output tsv)

echo "SUCCESS! Container SAS Token:"
echo "?${{SAS_TOKEN}}"
echo "Copy the token above and paste it into Autoanalytix Cloud Storage Settings."
"""

    return {
        "external_id": external_id,
        "azure_cli_script": az_script,
        "account_name": account_name,
        "container_name": container_name
    }

@router.post("/migrate")
def migrate_existing_datasets(
    workspace_id: str,
    current_user: ItemObject = Depends(get_current_user)
):
    """
    Transfers historical datasets from Platform storage into the customer's BYOC cloud storage
    (AWS S3, GCP GCS, or Azure Blob) and updates dataset records.
    """
    workspace = get_current_workspace(workspace_id, current_user)
    cfg = workspace.get("cloud_storage_config") or {}
    provider = cfg.get("provider", "PLATFORM_DEFAULT")
    
    if provider not in ("AWS_S3", "GCP_GCS", "GCS", "AZURE_BLOB", "AZURE") or not cfg.get("verified"):
        raise HTTPException(
            status_code=400,
            detail="BYOC cloud storage (AWS, GCP, or Azure) must be configured and verified before migrating datasets."
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
                # Upload to customer BYOC storage
                new_key = customer_service.upload_file(local_cached, relative_key)
                # Update dataset record
                ds["file_path"] = new_key
                ds["storage_provider"] = f"BYOS_{provider}"
                dynamodb_store.create_dataset(ds)  # overwrites/updates dataset
                migrated_count += 1
        except Exception as e:
            errors.append(f"Failed to migrate dataset '{ds.get('name', ds.get('id'))}': {str(e)}")

    provider_label = "AWS S3" if provider == "AWS_S3" else ("GCP Cloud Storage" if provider in ("GCP_GCS", "GCS") else "Azure Blob Storage")

    return {
        "success": len(errors) == 0,
        "migrated_count": migrated_count,
        "total_datasets": len(datasets),
        "errors": errors,
        "message": f"Successfully migrated {migrated_count} of {len(datasets)} datasets to your private {provider_label} bucket/container."
    }

