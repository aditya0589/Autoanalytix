import os
import time
import urllib.parse
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Union

from app.core.config import settings
from app.core.storage.base import BaseStorageService

class CustomerAzureBlobStorageService(BaseStorageService):
    """
    BYOC (Bring Your Own Cloud) Storage Service for Customer-owned Azure Blob Storage containers.
    Supports SAS URL, Container SAS Token, Connection String, or Service Principal (Azure Entra ID).
    Zero persistent raw data stored on Autoanalytix platform.
    """

    def __init__(
        self,
        container_name: str,
        account_name: Optional[str] = None,
        sas_token: Optional[str] = None,
        sas_url: Optional[str] = None,
        connection_string: Optional[str] = None,
        tenant_id: Optional[str] = None,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None,
        prefix: str = "autoanalytix",
        region: str = "eastus"
    ):
        self.container_name = container_name.strip()
        self.account_name = account_name.strip() if account_name else None
        self.sas_token = sas_token.strip() if sas_token else None
        self.sas_url = sas_url.strip() if sas_url else None
        self.connection_string = connection_string.strip() if connection_string else None
        self.tenant_id = tenant_id.strip() if tenant_id else None
        self.client_id = client_id.strip() if client_id else None
        self.client_secret = client_secret.strip() if client_secret else None
        self.prefix = (prefix or "autoanalytix").strip("/")
        self.region = (region or "eastus").strip()

        # If user gave a full SAS URL that contains account and container, infer them
        if self.sas_url and not self.account_name:
            try:
                parsed = urllib.parse.urlparse(self.sas_url)
                host_parts = parsed.netloc.split(".")
                if host_parts:
                    self.account_name = host_parts[0]
                path_parts = parsed.path.strip("/").split("/")
                if path_parts and path_parts[0]:
                    self.container_name = path_parts[0]
            except Exception:
                pass

        self._container_client = None

    def _qualify_key(self, remote_key: str) -> str:
        """Ensures the object key is nested inside the workspace customer prefix."""
        clean = remote_key.lstrip("/")
        if self.prefix and not clean.startswith(f"{self.prefix}/") and clean != self.prefix:
            return f"{self.prefix}/{clean}"
        return clean

    @property
    def container_client(self):
        if self._container_client is not None:
            return self._container_client

        from azure.storage.blob import ContainerClient, BlobServiceClient

        try:
            # 1. Full Container SAS URL
            if self.sas_url:
                self._container_client = ContainerClient.from_container_url(self.sas_url)
                return self._container_client

            # 2. Connection String
            if self.connection_string:
                bsc = BlobServiceClient.from_connection_string(self.connection_string)
                self._container_client = bsc.get_container_client(self.container_name)
                return self._container_client

            # 3. SAS Token + Account Name
            if self.sas_token and self.account_name:
                clean_sas = self.sas_token.lstrip("?")
                account_url = f"https://{self.account_name}.blob.core.windows.net"
                self._container_client = ContainerClient(
                    account_url=account_url,
                    container_name=self.container_name,
                    credential=clean_sas
                )
                return self._container_client

            # 4. Azure Entra ID Service Principal
            if self.tenant_id and self.client_id and self.client_secret and self.account_name:
                from azure.identity import ClientSecretCredential
                cred = ClientSecretCredential(
                    tenant_id=self.tenant_id,
                    client_id=self.client_id,
                    client_secret=self.client_secret
                )
                account_url = f"https://{self.account_name}.blob.core.windows.net"
                bsc = BlobServiceClient(account_url=account_url, credential=cred)
                self._container_client = bsc.get_container_client(self.container_name)
                return self._container_client

            raise ValueError("Insufficient Azure credentials. Provide SAS Token/URL, Connection String, or Service Principal.")

        except Exception as e:
            raise RuntimeError(f"Failed to initialize Azure Container Client: {str(e)}")

    def upload_file(self, local_path: str, remote_key: str) -> str:
        """Uploads a local file directly into customer's Azure Blob container."""
        target_key = self._qualify_key(remote_key)
        blob_client = self.container_client.get_blob_client(target_key)
        with open(local_path, "rb") as f:
            blob_client.upload_blob(f, overwrite=True)
        return target_key

    def download_file(self, remote_key: str, local_path: str) -> str:
        """Downloads a blob from customer Azure container to local disk."""
        target_key = self._qualify_key(remote_key)
        os.makedirs(os.path.dirname(os.path.abspath(local_path)), exist_ok=True)
        blob_client = self.container_client.get_blob_client(target_key)
        with open(local_path, "wb") as f:
            stream = blob_client.download_blob()
            stream.readinto(f)
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

        local_cache_dir = os.path.join(settings.LOCAL_STORAGE_DIR, "azure_cache")
        os.makedirs(local_cache_dir, exist_ok=True)

        # Build local cached target path
        cached_filename = clean_key.replace("/", "_")
        local_target = os.path.join(local_cache_dir, cached_filename)

        if os.path.exists(local_target) and os.path.getsize(local_target) > 0:
            return local_target

        target_key = self._qualify_key(clean_key)
        try:
            self.download_file(target_key, local_target)
            return local_target
        except Exception:
            self.download_file(clean_key, local_target)
            return local_target

    def generate_presigned_upload_url(
        self, remote_key: str, content_type: str = "application/octet-stream", expires_in: int = 3600
    ) -> Dict[str, Any]:
        """
        Generates direct client upload URL for browser zero-transit uploads to Azure Blob.
        """
        target_key = self._qualify_key(remote_key)
        blob_client = self.container_client.get_blob_client(target_key)

        # If container was initialized with a SAS url or SAS token, blob_client.url already includes the SAS token
        url = blob_client.url

        # Check if we need to generate a SAS token dynamically
        if "?" not in url and self.account_name:
            try:
                # If connection_string with AccountKey was supplied
                if self.connection_string and "AccountKey=" in self.connection_string:
                    from azure.storage.blob import generate_blob_sas, BlobSasPermissions
                    # Extract account key
                    key_match = [part.split("AccountKey=", 1)[1] for part in self.connection_string.split(";") if part.startswith("AccountKey=")]
                    if key_match:
                        account_key = key_match[0]
                        sas = generate_blob_sas(
                            account_name=self.account_name,
                            container_name=self.container_name,
                            blob_name=target_key,
                            account_key=account_key,
                            permission=BlobSasPermissions(read=True, write=True, create=True),
                            expiry=datetime.now(timezone.utc) + timedelta(seconds=expires_in)
                        )
                        url = f"{blob_client.url}?{sas}"
            except Exception as e:
                print(f"[CustomerAzure] Could not generate dynamic blob SAS: {e}")

        return {
            "url": url,
            "fields": {},
            "method": "PUT",
            "headers": {
                "x-ms-blob-type": "BlockBlob",
                "Content-Type": content_type
            },
            "key": target_key,
            "provider": "AZURE_BLOB",
            "bucket": self.container_name
        }

    def delete_file(self, remote_key: str) -> None:
        """Deletes a blob from customer Azure Blob container."""
        target_key = self._qualify_key(remote_key)
        blob_client = self.container_client.get_blob_client(target_key)
        if blob_client.exists():
            blob_client.delete_blob()

    def list_objects(self, prefix: str = "") -> List[Dict[str, Any]]:
        """Lists blobs under customer prefix."""
        search_prefix = self._qualify_key(prefix) if prefix else self.prefix
        blobs = self.container_client.list_blobs(name_starts_with=search_prefix)
        results = []
        for b in blobs:
            results.append({
                "key": b.name,
                "size": b.size,
                "last_modified": b.last_modified.isoformat() if b.last_modified else None,
                "content_type": b.content_settings.content_type if hasattr(b, "content_settings") and b.content_settings else None
            })
        return results

    def test_connection(self) -> Dict[str, Any]:
        """
        Executes a 4-step probe test against customer Azure Blob container:
        1. Authentication & Container Existence check
        2. PutBlob (Write test probe)
        3. GetBlob (Read round-trip verification)
        4. DeleteBlob (Clean up probe artifact)
        """
        start_time = time.time()
        probe_key = self._qualify_key(f"_autoanalytix_probe_test_{int(start_time)}.txt")
        steps = {
            "azure_auth": {"passed": False, "message": "Pending"},
            "azure_put_blob": {"passed": False, "message": "Pending"},
            "azure_get_blob": {"passed": False, "message": "Pending"},
            "azure_delete_blob": {"passed": False, "message": "Pending"},
        }

        # Step 1: Authentication & Container existence
        try:
            props = self.container_client.get_container_properties()
            steps["azure_auth"] = {
                "passed": True,
                "message": f"Successfully authenticated with Azure. Container '{self.container_name}' exists."
            }
        except Exception as e:
            steps["azure_auth"] = {
                "passed": False,
                "message": f"Azure authentication / container check failed: {str(e)}"
            }
            return {
                "healthy": False,
                "verified": False,
                "provider": "AZURE_BLOB",
                "bucket": self.container_name,
                "region": self.region,
                "role_arn": None,
                "steps": steps,
                "error": f"Failed to connect to Azure container: {str(e)}",
                "latency_ms": round((time.time() - start_time) * 1000, 2),
                "message": f"Azure probe failed: {str(e)}"
            }

        # Step 2: Write probe
        blob_client = self.container_client.get_blob_client(probe_key)
        try:
            probe_content = f"Autoanalytix Connection Probe: {datetime.now(timezone.utc).isoformat()}".encode("utf-8")
            blob_client.upload_blob(probe_content, overwrite=True)
            steps["azure_put_blob"] = {
                "passed": True,
                "message": f"Successfully wrote probe to container '{self.container_name}' at '{probe_key}'"
            }
        except Exception as e:
            steps["azure_put_blob"] = {
                "passed": False,
                "message": f"Azure PutBlob failed: {str(e)}"
            }
            return {
                "healthy": False,
                "verified": False,
                "provider": "AZURE_BLOB",
                "bucket": self.container_name,
                "region": self.region,
                "role_arn": None,
                "steps": steps,
                "error": f"Write test failed: {str(e)}",
                "latency_ms": round((time.time() - start_time) * 1000, 2),
                "message": f"Azure write permission check failed: {str(e)}"
            }

        # Step 3: Read probe
        try:
            downloaded = blob_client.download_blob().readall()
            if b"Autoanalytix Connection Probe" in downloaded:
                steps["azure_get_blob"] = {
                    "passed": True,
                    "message": "Successfully read and verified probe payload from Azure container."
                }
            else:
                steps["azure_get_blob"] = {
                    "passed": False,
                    "message": "Probe payload mismatch."
                }
        except Exception as e:
            steps["azure_get_blob"] = {
                "passed": False,
                "message": f"Azure GetBlob failed: {str(e)}"
            }

        # Step 4: Delete probe
        try:
            blob_client.delete_blob()
            steps["azure_delete_blob"] = {
                "passed": True,
                "message": "Successfully purged probe blob (Zero residual footprint)."
            }
        except Exception as e:
            steps["azure_delete_blob"] = {
                "passed": False,
                "message": f"Azure DeleteBlob warning: {str(e)}"
            }

        overall_healthy = (
            steps["azure_auth"]["passed"]
            and steps["azure_put_blob"]["passed"]
            and steps["azure_get_blob"]["passed"]
        )

        return {
            "healthy": overall_healthy,
            "verified": overall_healthy,
            "provider": "AZURE_BLOB",
            "bucket": self.container_name,
            "region": self.region,
            "role_arn": None,
            "prefix": self.prefix,
            "steps": steps,
            "latency_ms": round((time.time() - start_time) * 1000, 2),
            "message": "Azure Blob Storage connection verified successfully." if overall_healthy else "Azure probe completed with warnings.",
            "error": None if overall_healthy else "One or more probe steps failed."
        }
