import asyncio
import logging

import numpy as np

from config import settings

logger = logging.getLogger(__name__)

_model = None


def _get_model():
    global _model
    if _model is None:
        import whisper  # lazy — avoid requiring torch at import time
        _model = whisper.load_model(settings.whisper_model)
    return _model


async def transcribe_pcm(pcm_bytes: bytes, sample_rate: int = 16000) -> str:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _transcribe_sync, pcm_bytes, sample_rate)


def _transcribe_sync(pcm_bytes: bytes, sample_rate: int) -> str:
    try:
        audio_array = np.frombuffer(pcm_bytes, dtype=np.int16).astype(np.float32) / 32768.0
        if sample_rate != 16000:
            import librosa
            audio_array = librosa.resample(audio_array, orig_sr=sample_rate, target_sr=16000)
        model = _get_model()
        lang = None if settings.language == "auto" else settings.language
        result = model.transcribe(audio_array, fp16=False, language=lang)
        return result["text"].strip()
    except Exception as exc:
        logger.error("STT transcription failed: %s", exc)
        return ""
