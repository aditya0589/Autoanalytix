from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
from langchain_core.language_models.chat_models import BaseChatModel

class BaseAIProviderAdapter(ABC):
    provider_id: str
    display_name: str
    recommended_models: List[str]

    @abstractmethod
    def get_chat_model(self, api_key: str, model_name: str, custom_endpoint: Optional[str] = None) -> BaseChatModel:
        """Instantiates a LangChain Chat Model using decrypted credentials."""
        pass

    @abstractmethod
    def test_connection(self, api_key: str, model_name: str, custom_endpoint: Optional[str] = None) -> Dict[str, Any]:
        """Runs a minimal test prompt to verify credentials and quota."""
        pass
