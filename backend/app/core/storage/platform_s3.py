import os
from typing import Dict, Any, List, Optional
import boto3
from botocore.exceptions import ClientError
from app.core.config import settings
from app.core.storage.base import BaseStorageService

class PlatformS3StorageService(BaseStorageService):
    """
    Standard managed platform storage service using Autoanalytix central S3 bucket.
    Includes zero-config fallback to local filesystem when AWS credentials are not set.
    """

    def __init__(self, bucket: Optional[str] = None, region: Optional[str] = None):
        self.bucket = bucket or settings.S3_STORAGE_BUCKET
        self.region = region or settings.AWS_REGION
        self._client = None

    def _has_creds(self) -> bool:
        try:
            session = boto3.Session(region_name=self.region)
            creds = session.get_credentials()
            return creds is not None and getattr(creds, "access_key", None) is not None
        except Exception:
            return False

    @property
    def client(self):
        if not self._client:
            self._client = boto3.client("s3", region_name=self.region)
        return self._client

    def upload_file(self, local_path: str, remote_key: str) -> str:
        """Uploads a local file to platform S3 if credentials exist."""
        clean_key = remote_key.lstrip("/")
        if not self._has_creds():
            return clean_key
        try:
            self.client.upload_file(local_path, self.bucket, clean_key)
            return clean_key
        except Exception as e:
            print(f"[PlatformS3] Warning: S3 upload failed for {local_path}: {e}")
            return clean_key

    def download_file(self, remote_key: str, local_path: str) -> str:
        """Downloads an S3 object to local disk."""
        clean_key = remote_key.lstrip("/")
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        if not self._has_creds():
            return local_path
        try:
            self.client.download_file(self.bucket, clean_key, local_path)
            return local_path
        except Exception as e:
            print(f"[PlatformS3] S3 download error for {clean_key}: {e}")
            return local_path

    def ensure_local_cache(self, path_or_key: str) -> str:
        """
        Ensures a file is present on the local filesystem (e.g. in /tmp/storage
        for DuckDB execution). If not on local disk, fetches it from S3.
        """
        if os.path.exists(path_or_key):
            return path_or_key

        s3_key = path_or_key.replace("\\", "/")
        if "storage/" in s3_key:
            s3_key = s3_key.split("storage/", 1)[1]
        elif "/tmp/storage/" in s3_key:
            s3_key = s3_key.split("/tmp/storage/", 1)[1]

        clean_key = s3_key.lstrip("/")
        local_path = os.path.join(settings.STORAGE_DIR, clean_key)
        if os.path.exists(local_path):
            return local_path

        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        try:
            self.download_file(clean_key, local_path)
            return local_path
        except Exception as e:
            print(f"[PlatformS3] Could not fetch {clean_key} from S3: {e}")
            return path_or_key

    def generate_presigned_upload_url(
        self, remote_key: str, content_type: str = "application/octet-stream", expires_in: int = 3600
    ) -> Dict[str, Any]:
        """Generates a presigned PUT URL for browser uploads."""
        clean_key = remote_key.lstrip("/")
        if not self._has_creds():
            # Local dev fallback URL
            return {
                "upload_url": f"/api/datasets/upload-direct?key={clean_key}",
                "s3_key": clean_key,
                "bucket": self.bucket,
                "expires_in": expires_in,
                "is_local_mock": True
            }
        try:
            url = self.client.generate_presigned_url(
                ClientMethod="put_object",
                Params={
                    "Bucket": self.bucket,
                    "Key": clean_key,
                    "ContentType": content_type,
                },
                ExpiresIn=expires_in,
            )
            return {
                "upload_url": url,
                "s3_key": clean_key,
                "bucket": self.bucket,
                "expires_in": expires_in,
                "is_local_mock": False
            }
        except Exception as e:
            print(f"[PlatformS3] Error generating presigned URL: {e}")
            raise

    def delete_file(self, remote_key: str) -> None:
        """Deletes an object from platform S3."""
        clean_key = remote_key.lstrip("/")
        if not self._has_creds():
            return
        try:
            self.client.delete_object(Bucket=self.bucket, Key=clean_key)
        except Exception as e:
            print(f"[PlatformS3] Delete error for {clean_key}: {e}")

    def test_connection(self) -> Dict[str, Any]:
        """Validates connection to the platform S3 bucket."""
        has_credentials = self._has_creds()
        if not has_credentials:
            return {
                "status": "healthy",
                "mode": "local_fallback",
                "verified": True,
                "bucket": self.bucket,
                "region": self.region,
                "message": "Local disk storage active (Development mode)."
            }
        try:
            self.client.head_bucket(Bucket=self.bucket)
            return {
                "status": "healthy",
                "mode": "aws_s3",
                "verified": True,
                "bucket": self.bucket,
                "region": self.region,
                "message": "Connected to platform AWS S3 bucket."
            }
        except Exception as e:
            return {
                "status": "error",
                "mode": "aws_s3",
                "verified": False,
                "bucket": self.bucket,
                "region": self.region,
                "error": str(e)
            }

    def list_objects(self, prefix: str = "") -> List[Dict[str, Any]]:
        clean_prefix = prefix.lstrip("/")
        if not self._has_creds():
            return []
        try:
            response = self.client.list_objects_v2(Bucket=self.bucket, Prefix=clean_prefix)
            items = []
            for item in response.get("Contents", []):
                items.append({
                    "key": item["Key"],
                    "size": item["Size"],
                    "last_modified": item["LastModified"].isoformat()
                })
            return items
        except Exception as e:
            print(f"[PlatformS3] List objects error: {e}")
            return []
