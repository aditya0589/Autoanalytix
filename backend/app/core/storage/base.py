import os
from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional

class BaseStorageService(ABC):
    """
    Abstract Base Class for Autoanalytix Cloud Storage backends.
    Supports Platform-managed S3 and Customer-owned BYOC S3 (with future support for GCS and Azure Blob).
    """

    @abstractmethod
    def upload_file(self, local_path: str, remote_key: str) -> str:
        """Uploads a local file to cloud storage. Returns the remote key."""
        pass

    @abstractmethod
    def download_file(self, remote_key: str, local_path: str) -> str:
        """Downloads a cloud object to local disk. Returns local_path."""
        pass

    @abstractmethod
    def ensure_local_cache(self, path_or_key: str) -> str:
        """
        Ensures a file is present on the local filesystem (e.g. in /tmp/storage
        for DuckDB execution). If not on local disk, fetches it from cloud storage.
        """
        pass

    @abstractmethod
    def generate_presigned_upload_url(
        self, remote_key: str, content_type: str = "application/octet-stream", expires_in: int = 3600
    ) -> Dict[str, Any]:
        """Generates direct client upload URL for browser zero-transit uploads."""
        pass

    @abstractmethod
    def delete_file(self, remote_key: str) -> None:
        """Deletes a cloud object."""
        pass

    @abstractmethod
    def test_connection(self) -> Dict[str, Any]:
        """
        Validates credentials and permissions (read, write, delete).
        Returns a dictionary detailing connectivity status and probe diagnostics.
        """
        pass

    @abstractmethod
    def list_objects(self, prefix: str = "") -> List[Dict[str, Any]]:
        """Lists objects under a given prefix."""
        pass
