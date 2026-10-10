import time
from typing import Dict, Any, List, Optional
from langchain_openai import ChatOpenAI
from app.ai.providers.base import BaseAIProviderAdapter

class GroqProviderAdapter(BaseAIProviderAdapter):
    provider_id = "groq"
    display_name = "Groq"
    recommended_models = [
        "openai/gpt-oss-120b",
        "qwen/qwen3.8-27b",
        "allam-2-7b",
        "canopylabs/orpheus-v1-english",
        "canopylabs/orpheus-arabic-saudi"
    ]

    def get_chat_model(self, api_key: str, model_name: str, custom_endpoint: Optional[str] = None) -> ChatOpenAI:
        base_url = custom_endpoint.strip() if custom_endpoint and custom_endpoint.strip() else "https://api.groq.com/openai/v1"
        return ChatOpenAI(
            model=model_name or "openai/gpt-oss-120b",
            api_key=api_key,
            base_url=base_url,
            temperature=0.1,
            max_retries=2
        )

    def test_connection(self, api_key: str, model_name: str, custom_endpoint: Optional[str] = None) -> Dict[str, Any]:
        import urllib.request
        import json

        base_url = custom_endpoint.strip() if custom_endpoint and custom_endpoint.strip() else "https://api.groq.com/openai/v1"
        start = time.time()
        target_model = model_name or "llama-3.1-8b-instant"

        # First, try to fetch available models from Groq /models endpoint using the provided API key
        available_models = []
        try:
            req = urllib.request.Request(
                f"{base_url.rstrip('/')}/models",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "User-Agent": "Autoanalytix"
                }
            )
            with urllib.request.urlopen(req, timeout=5) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    available_models = [m.get("id") for m in data.get("data", []) if m.get("id")]
        except Exception:
            pass

        # If user model was not accessible and we retrieved available models, inform user or test the active one
        if available_models and target_model not in available_models:
            # Pick a text/chat model from available_models
            text_candidates = [m for m in available_models if not any(w in m for w in ["whisper", "guard", "embed"])]
            sample_candidates = text_candidates[:5] if text_candidates else available_models[:5]
            return {
                "success": False,
                "message": (
                    f"Model '{target_model}' is not in your Groq account's active model list. "
                    f"Your accessible models are: {', '.join(sample_candidates)}. "
                    f"Please choose one of these in the Custom Model field or dropdown."
                ),
                "latency_ms": None
            }

        try:
            llm = self.get_chat_model(api_key, target_model, custom_endpoint)
            res = llm.invoke("Respond with the single word: OK")
            latency_ms = round((time.time() - start) * 1000, 2)
            return {
                "success": True,
                "message": f"Successfully connected to Groq ({target_model}).",
                "latency_ms": latency_ms
            }
        except Exception as e:
            err = str(e)
            if "model_not_found" in err or "does not exist or you do not have access" in err:
                extra = f" Available on your key: {', '.join(available_models[:4])}." if available_models else ""
                msg = (
                    f"Model '{target_model}' is not accessible on your Groq tier.{extra} "
                    f"Please check console.groq.com/docs/models."
                )
            elif "invalid_api_key" in err.lower() or "unauthorized" in err.lower() or "401" in err:
                msg = "Invalid Groq API key. Please check your key at console.groq.com/keys."
            elif "rate_limit" in err.lower() or "429" in err:
                msg = "Groq rate limit exceeded. Please wait or check your organization quota."
            else:
                msg = f"Groq connection error: {err}"
            return {
                "success": False,
                "message": msg,
                "latency_ms": None
            }
