import os
from typing import Dict, Any, Optional, Union
from app.core.storage.factory import get_platform_storage, get_storage_service
from app.core.storage.base import BaseStorageService

class S3StorageServiceProxy:
    """
    Backwards-compatible proxy for s3_storage.
    Delegates to the platform S3 service by default, or to a workspace-specific
    BYOC storage service when for_workspace() is invoked.
    """

    @property
    def default_service(self) -> BaseStorageService:
        return get_platform_storage()

    @property
    def bucket(self) -> str:
        return getattr(self.default_service, "bucket", "")

    @property
    def region(self) -> str:
        return getattr(self.default_service, "region", "us-east-1")

    @property
    def client(self):
        return getattr(self.default_service, "client", None)

    def for_workspace(self, workspace_or_id: Optional[Union[Dict[str, Any], str]] = None) -> BaseStorageService:
        """Returns the appropriate storage service (Platform vs Customer BYOC) for a workspace."""
        return get_storage_service(workspace_or_id)

    def upload_file(self, local_path: str, s3_key: str) -> str:
        return self.default_service.upload_file(local_path, s3_key)

    def download_file(self, s3_key: str, local_path: str) -> str:
        return self.default_service.download_file(s3_key, local_path)

    def ensure_local_cache(self, path_or_key: str) -> str:
        return self.default_service.ensure_local_cache(path_or_key)

    def generate_presigned_upload_url(
        self, s3_key: str, content_type: str = "application/octet-stream", expires_in: int = 3600
    ) -> Dict[str, Any]:
        return self.default_service.generate_presigned_upload_url(s3_key, content_type, expires_in)

    def delete_file(self, s3_key: str) -> None:
        self.default_service.delete_file(s3_key)

    def test_connection(self) -> Dict[str, Any]:
        return self.default_service.test_connection()

s3_storage = S3StorageServiceProxy()
