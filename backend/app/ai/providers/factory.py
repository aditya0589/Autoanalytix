from typing import Dict, Any, List, Optional
from langchain_core.language_models.chat_models import BaseChatModel
from app.ai.providers.base import BaseAIProviderAdapter
from app.ai.providers.gemini import GeminiProviderAdapter
from app.ai.providers.openai_provider import OpenAIProviderAdapter
from app.ai.providers.anthropic_provider import AnthropicProviderAdapter
from app.ai.providers.groq_provider import GroqProviderAdapter
from app.ai.providers.openrouter_provider import OpenRouterProviderAdapter
from app.core.security import decrypt_credential

ADAPTERS: Dict[str, BaseAIProviderAdapter] = {
    "gemini": GeminiProviderAdapter(),
    "openai": OpenAIProviderAdapter(),
    "anthropic": AnthropicProviderAdapter(),
    "groq": GroqProviderAdapter(),
    "openrouter": OpenRouterProviderAdapter()
}

def get_provider_adapter(provider: str) -> BaseAIProviderAdapter:
    adapter = ADAPTERS.get(provider.lower())
    if not adapter:
        raise ValueError(f"Unsupported AI provider '{provider}'. Supported providers: {list(ADAPTERS.keys())}")
    return adapter

def list_supported_providers() -> List[Dict[str, Any]]:
    return [
        {
            "id": p_id,
            "name": adapter.display_name,
            "models": adapter.recommended_models
        }
        for p_id, adapter in ADAPTERS.items()
    ]

def get_chat_model_for_config(ai_config) -> BaseChatModel:
    """
    Decrypts the user's authorized API key inside the backend process only,
    and returns the configured LangChain chat model.
    """
    provider = getattr(ai_config, "provider", None) or (ai_config.get("provider") if isinstance(ai_config, dict) else None)
    adapter = get_provider_adapter(provider)
    enc_key = getattr(ai_config, "encrypted_api_key", None) or (ai_config.get("encrypted_api_key") if isinstance(ai_config, dict) else None)
    decrypted_key = decrypt_credential(enc_key)
    model_name = getattr(ai_config, "model_name", None) or (ai_config.get("model_name") if isinstance(ai_config, dict) else None)
    custom_endpoint = getattr(ai_config, "custom_endpoint", None) or (ai_config.get("custom_endpoint") if isinstance(ai_config, dict) else None)
    return adapter.get_chat_model(
        api_key=decrypted_key,
        model_name=model_name,
        custom_endpoint=custom_endpoint
    )
