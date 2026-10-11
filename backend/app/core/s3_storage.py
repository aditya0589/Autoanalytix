import os
import boto3
from botocore.exceptions import ClientError
from app.core.config import settings

class S3StorageService:
    def __init__(self):
        self.bucket = settings.S3_STORAGE_BUCKET
        self.region = settings.AWS_REGION
        self._client = None

    @property
    def client(self):
        if not self._client:
            self._client = boto3.client("s3", region_name=self.region)
        return self._client

    def upload_file(self, local_path: str, s3_key: str) -> str:
        """Uploads a local file to S3."""
        try:
            self.client.upload_file(local_path, self.bucket, s3_key)
            return s3_key
        except Exception as e:
            print(f"[!] S3 upload error for {local_path}: {e}")
            raise

    def download_file(self, s3_key: str, local_path: str) -> str:
        """Downloads an S3 object to local path."""
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        try:
            self.client.download_file(self.bucket, s3_key, local_path)
            return local_path
        except Exception as e:
            print(f"[!] S3 download error for {s3_key}: {e}")
            raise

    def ensure_local_cache(self, path_or_key: str) -> str:
        """
        Ensures a file is present on the local filesystem (e.g., in /tmp/storage
        for DuckDB execution). If not on local disk, fetches it from S3.
        """
        if os.path.exists(path_or_key):
            return path_or_key

        # Extract S3 key
        s3_key = path_or_key.replace("\\", "/")
        if "storage/" in s3_key:
            s3_key = s3_key.split("storage/", 1)[1]
        elif "/tmp/storage/" in s3_key:
            s3_key = s3_key.split("/tmp/storage/", 1)[1]

        local_path = os.path.join(settings.STORAGE_DIR, s3_key)
        if os.path.exists(local_path):
            return local_path

        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        try:
            self.download_file(s3_key, local_path)
            return local_path
        except Exception as e:
            print(f"[!] Could not fetch {s3_key} from S3: {e}")
            return path_or_key

    def generate_presigned_upload_url(self, s3_key: str, content_type: str = "application/octet-stream", expires_in: int = 3600) -> dict:
        """Generates a presigned PUT URL for browser direct uploads."""
        try:
            url = self.client.generate_presigned_url(
                ClientMethod="put_object",
                Params={
                    "Bucket": self.bucket,
                    "Key": s3_key,
                    "ContentType": content_type,
                },
                ExpiresIn=expires_in,
            )
            return {
                "upload_url": url,
                "s3_key": s3_key,
                "bucket": self.bucket,
                "expires_in": expires_in,
            }
        except Exception as e:
            print(f"[!] Error generating presigned URL: {e}")
            raise

    def delete_file(self, s3_key: str):
        """Deletes an object from S3."""
        try:
            self.client.delete_object(Bucket=self.bucket, Key=s3_key)
        except Exception as e:
            print(f"[!] S3 delete error for {s3_key}: {e}")

s3_storage = S3StorageService()
