import time
from typing import Dict, Any, List, Optional
from langchain_anthropic import ChatAnthropic
from app.ai.providers.base import BaseAIProviderAdapter

class AnthropicProviderAdapter(BaseAIProviderAdapter):
    provider_id = "anthropic"
    display_name = "Anthropic Claude"
    recommended_models = [
        "claude-3-5-sonnet-20241022",
        "claude-3-5-haiku-20241022",
        "claude-3-opus-20240229"
    ]

    def get_chat_model(self, api_key: str, model_name: str, custom_endpoint: Optional[str] = None) -> ChatAnthropic:
        kwargs: Dict[str, Any] = {
            "model_name": model_name or "claude-3-5-haiku-20241022",
            "api_key": api_key,
            "temperature": 0.1,
            "max_retries": 2
        }
        if custom_endpoint:
            kwargs["anthropic_api_url"] = custom_endpoint
        return ChatAnthropic(**kwargs)

    def test_connection(self, api_key: str, model_name: str, custom_endpoint: Optional[str] = None) -> Dict[str, Any]:
        start = time.time()
        try:
            llm = self.get_chat_model(api_key, model_name, custom_endpoint)
            res = llm.invoke("Respond with the single word: OK")
            latency_ms = round((time.time() - start) * 1000, 2)
            return {
                "success": True,
                "message": f"Successfully connected to Anthropic Claude ({model_name}).",
                "latency_ms": latency_ms
            }
        except Exception as e:
            err = str(e)
            if "authentication_error" in err or "invalid x-api-key" in err:
                msg = "Invalid Anthropic API key. Please check your key at console.anthropic.com."
            elif "credit balance is too low" in err or "rate_limit_error" in err:
                msg = "Anthropic account has insufficient credits or is rate limited."
            else:
                msg = f"Connection error: {err}"
            return {
                "success": False,
                "message": msg,
                "latency_ms": None
            }
