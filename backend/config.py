from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    hermes_api_url: str = "http://localhost:7000"
    hermes_api_key: str = ""
    tts_provider: str = "coqui"
    elevenlabs_api_key: str = ""
    elevenlabs_voice_id: str = ""
    openai_api_key: str = ""
    whisper_model: str = "base"
    lipsync_device: str = "cpu"
    lipsync_model_path: str = "/models/lipsync"
    default_avatar_url: str = ""
    # Conversation memory
    max_memory_turns: int = 10  # number of user+assistant turn pairs to retain per session
    # Comma-separated allowed CORS origins; "*" permits all (development only)
    allowed_origins: str = "*"
    # Language: "auto" for Whisper auto-detect, or ISO 639-1 code e.g. "es", "fr", "ja"
    language: str = "auto"
    # Max text input length (chars) and audio buffer size (bytes)
    max_text_length: int = 2000
    max_audio_bytes: int = 10_485_760  # 10 MB

    class Config:
        env_file = ".env"


settings = Settings()
