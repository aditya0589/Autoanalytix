from typing import Dict, Any, List, Optional
from app.core.security import decrypt_credential

_ADAPTER_INSTANCES: Dict[str, Any] = {}

def _load_gemini():
    from app.ai.providers.gemini import GeminiProviderAdapter
    return GeminiProviderAdapter()

def _load_openai():
    from app.ai.providers.openai_provider import OpenAIProviderAdapter
    return OpenAIProviderAdapter()

def _load_anthropic():
    from app.ai.providers.anthropic_provider import AnthropicProviderAdapter
    return AnthropicProviderAdapter()

def _load_groq():
    from app.ai.providers.groq_provider import GroqProviderAdapter
    return GroqProviderAdapter()

def _load_openrouter():
    from app.ai.providers.openrouter_provider import OpenRouterProviderAdapter
    return OpenRouterProviderAdapter()

_ADAPTER_LOADERS = {
    "gemini": _load_gemini,
    "openai": _load_openai,
    "anthropic": _load_anthropic,
    "groq": _load_groq,
    "openrouter": _load_openrouter
}

SUPPORTED_PROVIDERS_METADATA: List[Dict[str, Any]] = [
    {
        "id": "gemini",
        "name": "Google Gemini",
        "models": ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-1.5-pro", "gemini-1.5-flash"]
    },
    {
        "id": "openai",
        "name": "OpenAI",
        "models": ["gpt-4o", "gpt-4o-mini", "o1", "o3-mini"]
    },
    {
        "id": "anthropic",
        "name": "Anthropic Claude",
        "models": ["claude-3-7-sonnet-latest", "claude-3-5-sonnet-latest", "claude-3-5-haiku-latest"]
    },
    {
        "id": "groq",
        "name": "Groq",
        "models": ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768", "deepseek-r1-distill-llama-70b"]
    },
    {
        "id": "openrouter",
        "name": "OpenRouter",
        "models": ["anthropic/claude-3.5-sonnet", "openai/gpt-4o", "deepseek/deepseek-r1", "meta-llama/llama-3.3-70b-instruct"]
    }
]

def get_provider_adapter(provider: str):
    p_key = provider.lower() if provider else ""
    if p_key not in _ADAPTER_LOADERS:
        raise ValueError(f"Unsupported AI provider '{provider}'. Supported providers: {list(_ADAPTER_LOADERS.keys())}")
    if p_key not in _ADAPTER_INSTANCES:
        _ADAPTER_INSTANCES[p_key] = _ADAPTER_LOADERS[p_key]()
    return _ADAPTER_INSTANCES[p_key]

def list_supported_providers() -> List[Dict[str, Any]]:
    return SUPPORTED_PROVIDERS_METADATA

def get_chat_model_for_config(ai_config) -> Any:
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
