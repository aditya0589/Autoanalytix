import os
import json
import time
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Union

from app.core.config import settings
from app.core.storage.base import BaseStorageService

class CustomerGCSStorageService(BaseStorageService):
    """
    BYOC (Bring Your Own Cloud) Storage Service for Customer-owned Google Cloud Storage (GCS) buckets.
    Supports Customer Service Account JSON credentials, ADC, or service account impersonation.
    Zero persistent raw data stored on Autoanalytix platform.
    """

    def __init__(
        self,
        bucket_name: str,
        project_id: Optional[str] = None,
        credentials_json: Optional[Union[Dict[str, Any], str]] = None,
        prefix: str = "autoanalytix",
        location: str = "us-central1"
    ):
        self.bucket_name = bucket_name.strip()
        self.project_id = project_id.strip() if project_id else None
        self.prefix = (prefix or "autoanalytix").strip("/")
        self.location = (location or "us-central1").strip()
        self._raw_creds = credentials_json
        self._client = None

    def _qualify_key(self, remote_key: str) -> str:
        """Ensures the object key is nested inside the workspace customer prefix."""
        clean = remote_key.lstrip("/")
        if self.prefix and not clean.startswith(f"{self.prefix}/") and clean != self.prefix:
            return f"{self.prefix}/{clean}"
        return clean

    @property
    def client(self):
        if self._client is not None:
            return self._client

        from google.cloud import storage

        if self._raw_creds:
            try:
                from google.oauth2 import service_account
                if isinstance(self._raw_creds, str):
                    info = json.loads(self._raw_creds)
                elif isinstance(self._raw_creds, dict):
                    info = self._raw_creds
                else:
                    raise ValueError("credentials_json must be a dict or valid JSON string.")
                
                creds = service_account.Credentials.from_service_account_info(info)
                proj = self.project_id or info.get("project_id")
                self._client = storage.Client(project=proj, credentials=creds)
                return self._client
            except Exception as e:
                raise RuntimeError(f"Failed to initialize GCP Storage Client with provided credentials: {e}")

        # Fallback to default credentials
        self._client = storage.Client(project=self.project_id)
        return self._client

    @property
    def bucket(self):
        return self.client.bucket(self.bucket_name)

    def upload_file(self, local_path: str, remote_key: str) -> str:
        """Uploads a local file directly into customer's GCS bucket."""
        target_key = self._qualify_key(remote_key)
        blob = self.bucket.blob(target_key)
        blob.upload_from_filename(local_path)
        return target_key

    def download_file(self, remote_key: str, local_path: str) -> str:
        """Downloads a cloud object from customer GCS to local disk."""
        target_key = self._qualify_key(remote_key)
        os.makedirs(os.path.dirname(os.path.abspath(local_path)), exist_ok=True)
        blob = self.bucket.blob(target_key)
        blob.download_to_filename(local_path)
        return local_path

    def ensure_local_cache(self, path_or_key: str) -> str:
        """
        Ensures the dataset parquet/csv is cached in local temporary directory
        for high-performance DuckDB query execution.
        """
        clean_key = path_or_key.replace("\\", "/").lstrip("/")
        
        # Check if file exists directly on disk
        if os.path.exists(path_or_key) and not os.path.isdir(path_or_key):
            return path_or_key

        local_cache_dir = os.path.join(settings.LOCAL_STORAGE_DIR, "gcs_cache")
        os.makedirs(local_cache_dir, exist_ok=True)

        # Build local cached target path
        cached_filename = clean_key.replace("/", "_")
        local_target = os.path.join(local_cache_dir, cached_filename)

        if os.path.exists(local_target) and os.path.getsize(local_target) > 0:
            return local_target

        # Download from GCS
        target_key = self._qualify_key(clean_key)
        try:
            self.download_file(target_key, local_target)
            return local_target
        except Exception:
            # Try without qualify if key was already qualified
            self.download_file(clean_key, local_target)
            return local_target

    def generate_presigned_upload_url(
        self, remote_key: str, content_type: str = "application/octet-stream", expires_in: int = 3600
    ) -> Dict[str, Any]:
        """
        Generates direct client signed upload URL for browser zero-transit uploads.
        The client browser uploads straight to customer GCS.
        """
        target_key = self._qualify_key(remote_key)
        blob = self.bucket.blob(target_key)
        try:
            signed_url = blob.generate_signed_url(
                version="v4",
                expiration=timedelta(seconds=expires_in),
                method="PUT",
                content_type=content_type
            )
            return {
                "url": signed_url,
                "fields": {},
                "method": "PUT",
                "headers": {"Content-Type": content_type},
                "key": target_key,
                "provider": "GCP_GCS",
                "bucket": self.bucket_name
            }
        except Exception as e:
            # If signed URL cannot be created with service account (e.g. missing private_key),
            # provide structured fallback info
            raise RuntimeError(f"Failed to generate GCS signed URL: {str(e)}")

    def delete_file(self, remote_key: str) -> None:
        """Deletes a cloud object from customer GCS bucket."""
        target_key = self._qualify_key(remote_key)
        blob = self.bucket.blob(target_key)
        if blob.exists(self.client):
            blob.delete(self.client)

    def list_objects(self, prefix: str = "") -> List[Dict[str, Any]]:
        """Lists objects under customer prefix."""
        search_prefix = self._qualify_key(prefix) if prefix else self.prefix
        blobs = self.client.list_blobs(self.bucket_name, prefix=search_prefix)
        results = []
        for b in blobs:
            results.append({
                "key": b.name,
                "size": b.size,
                "last_modified": b.updated.isoformat() if b.updated else None,
                "content_type": b.content_type
            })
        return results

    def test_connection(self) -> Dict[str, Any]:
        """
        Executes a 4-step probe test against customer GCS bucket:
        1. Service Account Authentication & Bucket Existence check
        2. PutObject (Write test probe)
        3. GetObject (Read round-trip verification)
        4. DeleteObject (Clean up probe artifact)
        """
        start_time = time.time()
        probe_key = self._qualify_key(f"_autoanalytix_probe_test_{int(start_time)}.txt")
        steps = {
            "gcp_auth": {"passed": False, "message": "Pending"},
            "gcs_put_object": {"passed": False, "message": "Pending"},
            "gcs_get_object": {"passed": False, "message": "Pending"},
            "gcs_delete_object": {"passed": False, "message": "Pending"},
        }

        # Step 1: Authentication & Bucket check
        try:
            b = self.client.get_bucket(self.bucket_name)
            steps["gcp_auth"] = {
                "passed": True,
                "message": f"Successfully authenticated with GCP. Bucket 'gs://{self.bucket_name}' verified (Location: {b.location})."
            }
        except Exception as e:
            steps["gcp_auth"] = {
                "passed": False,
                "message": f"GCP authentication / bucket verification failed: {str(e)}"
            }
            return {
                "healthy": False,
                "verified": False,
                "provider": "GCP_GCS",
                "bucket": self.bucket_name,
                "region": self.location,
                "role_arn": None,
                "steps": steps,
                "error": f"Failed to connect to GCS bucket: {str(e)}",
                "latency_ms": round((time.time() - start_time) * 1000, 2),
                "message": f"GCP GCS probe failed: {str(e)}"
            }

        # Step 2: Write probe
        try:
            probe_content = f"Autoanalytix Connection Probe: {datetime.now(timezone.utc).isoformat()}".encode("utf-8")
            blob = b.blob(probe_key)
            blob.upload_from_string(probe_content, content_type="text/plain")
            steps["gcs_put_object"] = {
                "passed": True,
                "message": f"Successfully wrote probe to gs://{self.bucket_name}/{probe_key}"
            }
        except Exception as e:
            steps["gcs_put_object"] = {
                "passed": False,
                "message": f"GCS PutObject failed: {str(e)}"
            }
            return {
                "healthy": False,
                "verified": False,
                "provider": "GCP_GCS",
                "bucket": self.bucket_name,
                "region": self.location,
                "role_arn": None,
                "steps": steps,
                "error": f"Write test failed: {str(e)}",
                "latency_ms": round((time.time() - start_time) * 1000, 2),
                "message": f"GCS Write permission check failed: {str(e)}"
            }

        # Step 3: Read probe
        try:
            downloaded = blob.download_as_bytes()
            if b"Autoanalytix Connection Probe" in downloaded:
                steps["gcs_get_object"] = {
                    "passed": True,
                    "message": "Successfully read and verified probe payload from customer GCS bucket."
                }
            else:
                steps["gcs_get_object"] = {
                    "passed": False,
                    "message": "Probe payload mismatch."
                }
        except Exception as e:
            steps["gcs_get_object"] = {
                "passed": False,
                "message": f"GCS GetObject failed: {str(e)}"
            }

        # Step 4: Delete probe
        try:
            blob.delete()
            steps["gcs_delete_object"] = {
                "passed": True,
                "message": "Successfully purged probe object (Zero residual footprint)."
            }
        except Exception as e:
            steps["gcs_delete_object"] = {
                "passed": False,
                "message": f"GCS DeleteObject warning: {str(e)}"
            }

        overall_healthy = (
            steps["gcp_auth"]["passed"]
            and steps["gcs_put_object"]["passed"]
            and steps["gcs_get_object"]["passed"]
        )

        return {
            "healthy": overall_healthy,
            "verified": overall_healthy,
            "provider": "GCP_GCS",
            "bucket": self.bucket_name,
            "region": self.location,
            "role_arn": None,
            "prefix": self.prefix,
            "steps": steps,
            "latency_ms": round((time.time() - start_time) * 1000, 2),
            "message": "GCP Cloud Storage connection verified successfully." if overall_healthy else "GCS probe completed with warnings.",
            "error": None if overall_healthy else "One or more probe steps failed."
        }
