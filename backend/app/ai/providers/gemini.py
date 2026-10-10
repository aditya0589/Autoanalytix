import time
from typing import Dict, Any, List, Optional
from langchain_google_genai import ChatGoogleGenerativeAI
from app.ai.providers.base import BaseAIProviderAdapter

class GeminiProviderAdapter(BaseAIProviderAdapter):
    provider_id = "gemini"
    display_name = "Google Gemini"
    recommended_models = [
        "gemini-2.5-flash",
        "gemini-2.5-pro",
        "gemini-1.5-flash",
        "gemini-1.5-pro"
    ]

    def get_chat_model(self, api_key: str, model_name: str, custom_endpoint: Optional[str] = None) -> ChatGoogleGenerativeAI:
        return ChatGoogleGenerativeAI(
            model=model_name or "gemini-2.5-flash",
            google_api_key=api_key,
            temperature=0.1,
            max_retries=2
        )

    def test_connection(self, api_key: str, model_name: str, custom_endpoint: Optional[str] = None) -> Dict[str, Any]:
        start = time.time()
        try:
            llm = self.get_chat_model(api_key, model_name)
            res = llm.invoke("Respond with the single word: OK")
            latency_ms = round((time.time() - start) * 1000, 2)
            return {
                "success": True,
                "message": f"Successfully connected to Google Gemini ({model_name}).",
                "latency_ms": latency_ms
            }
        except Exception as e:
            err = str(e)
            if "API_KEY_INVALID" in err or "API key not valid" in err:
                msg = "Invalid Google Gemini API key. Please verify your credentials in Google AI Studio."
            elif "RESOURCE_EXHAUSTED" in err:
                msg = "Google Gemini quota exhausted for this API key."
            else:
                msg = f"Connection error: {err}"
            return {
                "success": False,
                "message": msg,
                "latency_ms": None
            }
