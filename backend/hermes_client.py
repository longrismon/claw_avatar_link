import httpx

from config import settings


async def send_message(text: str, session_id: str) -> str:
    """Send user text to Hermes Agent API and return the reply text."""
    headers = {}
    if settings.hermes_api_key:
        headers["Authorization"] = f"Bearer {settings.hermes_api_key}"

    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.post(
            f"{settings.hermes_api_url}/v1/chat",
            headers=headers,
            json={"message": text, "session_id": session_id},
        )
        r.raise_for_status()
        data = r.json()
        # Support both Hermes native {"reply": "..."} and OpenAI-compat {"choices": [...]}
        if "reply" in data:
            return str(data["reply"])
        if "choices" in data:
            return str(data["choices"][0]["message"]["content"])
        return str(data)
