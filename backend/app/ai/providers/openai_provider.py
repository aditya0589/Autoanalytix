import time
from typing import Dict, Any, List, Optional
from langchain_openai import ChatOpenAI
from app.ai.providers.base import BaseAIProviderAdapter

class OpenAIProviderAdapter(BaseAIProviderAdapter):
    provider_id = "openai"
    display_name = "OpenAI"
    recommended_models = [
        "gpt-4o",
        "gpt-4o-mini",
        "gpt-4-turbo",
        "o1-mini"
    ]

    def get_chat_model(self, api_key: str, model_name: str, custom_endpoint: Optional[str] = None) -> ChatOpenAI:
        kwargs: Dict[str, Any] = {
            "model": model_name or "gpt-4o-mini",
            "api_key": api_key,
            "temperature": 0.1,
            "max_retries": 2
        }
        if custom_endpoint:
            kwargs["base_url"] = custom_endpoint
        return ChatOpenAI(**kwargs)

    def test_connection(self, api_key: str, model_name: str, custom_endpoint: Optional[str] = None) -> Dict[str, Any]:
        start = time.time()
        try:
            llm = self.get_chat_model(api_key, model_name, custom_endpoint)
            res = llm.invoke("Respond with the single word: OK")
            latency_ms = round((time.time() - start) * 1000, 2)
            return {
                "success": True,
                "message": f"Successfully connected to OpenAI ({model_name}).",
                "latency_ms": latency_ms
            }
        except Exception as e:
            err = str(e)
            if "Incorrect API key" in err or "invalid_api_key" in err:
                msg = "Invalid OpenAI API key. Please check your key at platform.openai.com."
            elif "insufficient_quota" in err:
                msg = "OpenAI account has insufficient quota or credits."
            else:
                msg = f"Connection error: {err}"
            return {
                "success": False,
                "message": msg,
                "latency_ms": None
            }
