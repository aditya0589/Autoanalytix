import time
from typing import Dict, Any, List, Optional
from langchain_openai import ChatOpenAI
from app.ai.providers.base import BaseAIProviderAdapter

class OpenRouterProviderAdapter(BaseAIProviderAdapter):
    provider_id = "openrouter"
    display_name = "OpenRouter"
    recommended_models = [
        "anthropic/claude-3.5-sonnet",
        "openai/gpt-4o",
        "openai/gpt-4o-mini",
        "meta-llama/llama-3.3-70b-instruct",
        "deepseek/deepseek-chat",
        "google/gemini-2.0-flash-exp:free",
        "mistralai/mistral-large"
    ]

    def get_chat_model(self, api_key: str, model_name: str, custom_endpoint: Optional[str] = None) -> ChatOpenAI:
        base_url = custom_endpoint.strip() if custom_endpoint and custom_endpoint.strip() else "https://openrouter.ai/api/v1"
        return ChatOpenAI(
            model=model_name or "anthropic/claude-3.5-sonnet",
            api_key=api_key,
            base_url=base_url,
            temperature=0.1,
            max_retries=2,
            default_headers={
                "HTTP-Referer": "https://autoanalytix.io",
                "X-Title": "Autoanalytix"
            }
        )

    def test_connection(self, api_key: str, model_name: str, custom_endpoint: Optional[str] = None) -> Dict[str, Any]:
        start = time.time()
        try:
            target_model = model_name or "openai/gpt-4o-mini"
            llm = self.get_chat_model(api_key, target_model, custom_endpoint)
            res = llm.invoke("Respond with the single word: OK")
            latency_ms = round((time.time() - start) * 1000, 2)
            return {
                "success": True,
                "message": f"Successfully connected to OpenRouter ({target_model}).",
                "latency_ms": latency_ms
            }
        except Exception as e:
            err = str(e)
            if "unauthorized" in err.lower() or "401" in err or "key" in err.lower():
                msg = "Invalid OpenRouter API key. Please check your key at openrouter.ai/keys."
            elif "credit" in err.lower() or "quota" in err.lower() or "402" in err:
                msg = "Insufficient OpenRouter account credits."
            else:
                msg = f"OpenRouter connection error: {err}"
            return {
                "success": False,
                "message": msg,
                "latency_ms": None
            }
