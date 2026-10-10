from abc import ABC, abstractmethod
from typing import Dict, Any, List, Tuple
import polars as pl

class BaseDataConnector(ABC):
    connector_type: str
    display_name: str

    @abstractmethod
    def test_connection(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Tests connectivity to the remote source."""
        pass

    @abstractmethod
    def list_tables(self, config: Dict[str, Any]) -> List[str]:
        """Lists available tables or sheets."""
        pass

    @abstractmethod
    def get_table_schema(self, config: Dict[str, Any], table_name: str) -> List[Dict[str, str]]:
        """Returns column names and types for a selected table."""
        pass

    @abstractmethod
    def extract_data(self, config: Dict[str, Any], table_name: str, limit: int = 10000) -> pl.DataFrame:
        """Extracts table data into a Polars DataFrame for DuckDB ingestion."""
        pass
