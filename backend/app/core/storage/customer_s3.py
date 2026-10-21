import os
import time
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import boto3
from botocore.exceptions import ClientError
from app.core.config import settings
from app.core.storage.base import BaseStorageService

class CustomerS3StorageService(BaseStorageService):
    """
    BYOC (Bring Your Own Cloud) Storage Service for Customer-owned AWS S3 buckets.
    Uses temporary STS AssumeRole credentials scoped with the Workspace's unique External ID.
    Zero persistent credentials stored on Autoanalytix platform.
    """

    def __init__(
        self,
        role_arn: str,
        external_id: str,
        bucket_name: str,
        region: str = "us-east-1",
        prefix: str = "autoanalytix",
        kms_key_arn: Optional[str] = None
    ):
        self.role_arn = role_arn.strip()
        self.external_id = external_id.strip()
        self.bucket = bucket_name.strip()
        self.region = (region or "us-east-1").strip()
        self.prefix = (prefix or "autoanalytix").strip("/")
        self.kms_key_arn = kms_key_arn.strip() if kms_key_arn else None
        
        self._credentials = None
        self._creds_expiration = 0
        self._s3_client = None

    def _qualify_key(self, remote_key: str) -> str:
        """Ensures the object key is nested inside the workspace customer prefix."""
        clean = remote_key.lstrip("/")
        if self.prefix and not clean.startswith(f"{self.prefix}/") and clean != self.prefix:
            return f"{self.prefix}/{clean}"
        return clean

    def _get_assumed_credentials(self) -> Dict[str, str]:
        """
        Assumes the customer's IAM Role using AWS STS and the workspace External ID.
        Caches temporary credentials with a safety buffer before expiration.
        """
        now = time.time()
        if self._credentials and now < (self._creds_expiration - 300):
            return self._credentials

        sts_client = boto3.client("sts", region_name=self.region)
        try:
            assumed = sts_client.assume_role(
                RoleArn=self.role_arn,
                RoleSessionName="AutoanalytixBYOCSession",
                ExternalId=self.external_id,
                DurationSeconds=3600  # 1 hour lease
            )
            creds = assumed["Credentials"]
            self._credentials = {
                "aws_access_key_id": creds["AccessKeyId"],
                "aws_secret_access_key": creds["SecretAccessKey"],
                "aws_session_token": creds["SessionToken"]
            }
            # creds["Expiration"] is a datetime object
            if isinstance(creds.get("Expiration"), datetime):
                self._creds_expiration = creds["Expiration"].timestamp()
            else:
                self._creds_expiration = now + 3600

            self._s3_client = None  # Reset client to use fresh credentials
            return self._credentials
        except ClientError as e:
            code = e.response.get("Error", {}).get("Code", "STSError")
            msg = e.response.get("Error", {}).get("Message", str(e))
            raise RuntimeError(f"STS AssumeRole failed ({code}): {msg}")

    @property
    def client(self):
        if not self._s3_client:
            creds = self._get_assumed_credentials()
            self._s3_client = boto3.client(
                "s3",
                region_name=self.region,
                **creds
            )
        return self._s3_client

    def upload_file(self, local_path: str, remote_key: str) -> str:
        """Uploads a local file directly into customer's S3 bucket."""
        target_key = self._qualify_key(remote_key)
        extra_args = {}
        if self.kms_key_arn:
            extra_args["ServerSideEncryption"] = "aws:kms"
            extra_args["SSEKMSKeyId"] = self.kms_key_arn

        self.client.upload_file(
            local_path,
            self.bucket,
            target_key,
            ExtraArgs=extra_args if extra_args else None
        )
        return target_key

    def download_file(self, remote_key: str, local_path: str) -> str:
        """Downloads an object from customer's S3 bucket to local ephemeral disk."""
        target_key = self._qualify_key(remote_key)
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        self.client.download_file(self.bucket, target_key, local_path)
        return local_path

    def ensure_local_cache(self, path_or_key: str) -> str:
        """
        Ensures a dataset file is cached locally in /tmp/storage for DuckDB execution.
        Downloads on-demand from the customer's S3 bucket using temporary assumed role credentials.
        """
        if os.path.exists(path_or_key):
            return path_or_key

        s3_key = path_or_key.replace("\\", "/")
        if "storage/" in s3_key:
            s3_key = s3_key.split("storage/", 1)[1]
        elif "/tmp/storage/" in s3_key:
            s3_key = s3_key.split("/tmp/storage/", 1)[1]

        target_key = self._qualify_key(s3_key)
        local_path = os.path.join(settings.STORAGE_DIR, target_key)
        if os.path.exists(local_path):
            return local_path

        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        try:
            self.download_file(target_key, local_path)
            return local_path
        except Exception as e:
            print(f"[CustomerS3] Warning: could not download {target_key} from customer bucket {self.bucket}: {e}")
            return path_or_key

    def generate_presigned_upload_url(
        self, remote_key: str, content_type: str = "application/octet-stream", expires_in: int = 3600
    ) -> Dict[str, Any]:
        """
        Generates a direct browser-to-customer-S3 presigned PUT URL.
        Zero bytes of data travel through the Autoanalytix backend server.
        """
        target_key = self._qualify_key(remote_key)
        params = {
            "Bucket": self.bucket,
            "Key": target_key,
            "ContentType": content_type,
        }
        if self.kms_key_arn:
            params["ServerSideEncryption"] = "aws:kms"
            params["SSEKMSKeyId"] = self.kms_key_arn

        url = self.client.generate_presigned_url(
            ClientMethod="put_object",
            Params=params,
            ExpiresIn=expires_in,
        )
        return {
            "upload_url": url,
            "s3_key": target_key,
            "bucket": self.bucket,
            "region": self.region,
            "expires_in": expires_in,
            "is_byoc": True
        }

    def delete_file(self, remote_key: str) -> None:
        """Deletes an object from the customer's S3 bucket."""
        target_key = self._qualify_key(remote_key)
        self.client.delete_object(Bucket=self.bucket, Key=target_key)

    def test_connection(self) -> Dict[str, Any]:
        """
        Executes a 4-step live probe against the customer's AWS account:
        1. sts:AssumeRole with ExternalId
        2. s3:PutObject to write test probe
        3. s3:GetObject to verify round-trip read
        4. s3:DeleteObject to clean up probe artifact
        """
        start_time = time.time()
        probe_key = self._qualify_key("_autoanalytix_probe_test.txt")
        steps = {
            "sts_assume_role": {"passed": False, "message": "Pending"},
            "s3_put_object": {"passed": False, "message": "Pending"},
            "s3_get_object": {"passed": False, "message": "Pending"},
            "s3_delete_object": {"passed": False, "message": "Pending"},
        }

        # Step 1: STS AssumeRole
        try:
            creds = self._get_assumed_credentials()
            steps["sts_assume_role"] = {
                "passed": True,
                "message": f"Successfully assumed IAM role '{self.role_arn}' using ExternalId."
            }
        except Exception as e:
            steps["sts_assume_role"] = {
                "passed": False,
                "message": f"STS AssumeRole failed: {str(e)}"
            }
            return {
                "healthy": False,
                "verified": False,
                "provider": "AWS_S3",
                "bucket": self.bucket,
                "region": self.region,
                "role_arn": self.role_arn,
                "steps": steps,
                "error": f"Failed to assume role: {str(e)}",
                "latency_ms": round((time.time() - start_time) * 1000, 2)
            }

        # Step 2: S3 PutObject
        try:
            probe_content = f"Autoanalytix Connection Probe: {datetime.now(timezone.utc).isoformat()}".encode("utf-8")
            put_kwargs = {
                "Bucket": self.bucket,
                "Key": probe_key,
                "Body": probe_content
            }
            if self.kms_key_arn:
                put_kwargs["ServerSideEncryption"] = "aws:kms"
                put_kwargs["SSEKMSKeyId"] = self.kms_key_arn

            self.client.put_object(**put_kwargs)
            steps["s3_put_object"] = {
                "passed": True,
                "message": f"Successfully wrote probe to s3://{self.bucket}/{probe_key}"
            }
        except ClientError as e:
            code = e.response.get("Error", {}).get("Code", "PutError")
            msg = e.response.get("Error", {}).get("Message", str(e))
            steps["s3_put_object"] = {
                "passed": False,
                "message": f"PutObject failed ({code}): {msg}"
            }
            return {
                "healthy": False,
                "verified": False,
                "provider": "AWS_S3",
                "bucket": self.bucket,
                "region": self.region,
                "role_arn": self.role_arn,
                "steps": steps,
                "error": f"Write test failed: {code} - {msg}",
                "latency_ms": round((time.time() - start_time) * 1000, 2)
            }

        # Step 3: S3 GetObject
        try:
            res = self.client.get_object(Bucket=self.bucket, Key=probe_key)
            read_bytes = res["Body"].read()
            if b"Autoanalytix Connection Probe" in read_bytes:
                steps["s3_get_object"] = {
                    "passed": True,
                    "message": "Successfully read and verified probe payload from bucket."
                }
            else:
                steps["s3_get_object"] = {
                    "passed": False,
                    "message": "Probe payload mismatch."
                }
        except ClientError as e:
            code = e.response.get("Error", {}).get("Code", "GetError")
            msg = e.response.get("Error", {}).get("Message", str(e))
            steps["s3_get_object"] = {
                "passed": False,
                "message": f"GetObject failed ({code}): {msg}"
            }

        # Step 4: S3 DeleteObject
        try:
            self.client.delete_object(Bucket=self.bucket, Key=probe_key)
            steps["s3_delete_object"] = {
                "passed": True,
                "message": "Successfully purged probe object (Zero residual footprint)."
            }
        except ClientError as e:
            code = e.response.get("Error", {}).get("Code", "DeleteError")
            msg = e.response.get("Error", {}).get("Message", str(e))
            steps["s3_delete_object"] = {
                "passed": False,
                "message": f"DeleteObject warning ({code}): {msg}"
            }

        overall_healthy = (
            steps["sts_assume_role"]["passed"]
            and steps["s3_put_object"]["passed"]
            and steps["s3_get_object"]["passed"]
        )

        return {
            "healthy": overall_healthy,
            "verified": overall_healthy,
            "provider": "AWS_S3",
            "bucket": self.bucket,
            "region": self.region,
            "role_arn": self.role_arn,
            "prefix": self.prefix,
            "steps": steps,
            "latency_ms": round((time.time() - start_time) * 1000, 2),
            "message": "BYOC S3 connection verified successfully." if overall_healthy else "Connection check encountered issues."
        }

    def list_objects(self, prefix: str = "") -> List[Dict[str, Any]]:
        target_prefix = self._qualify_key(prefix)
        try:
            response = self.client.list_objects_v2(Bucket=self.bucket, Prefix=target_prefix)
            items = []
            for item in response.get("Contents", []):
                items.append({
                    "key": item["Key"],
                    "size": item["Size"],
                    "last_modified": item["LastModified"].isoformat()
                })
            return items
        except Exception as e:
            print(f"[CustomerS3] List objects error: {e}")
            return []
