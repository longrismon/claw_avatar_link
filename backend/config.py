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

    class Config:
        env_file = ".env"


settings = Settings()
