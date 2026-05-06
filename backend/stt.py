import asyncio

import numpy as np
import whisper

from config import settings

_model = None


def _get_model():
    global _model
    if _model is None:
        _model = whisper.load_model(settings.whisper_model)
    return _model


async def transcribe_pcm(pcm_bytes: bytes, sample_rate: int = 16000) -> str:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _transcribe_sync, pcm_bytes, sample_rate)


def _transcribe_sync(pcm_bytes: bytes, sample_rate: int) -> str:
    audio_array = np.frombuffer(pcm_bytes, dtype=np.int16).astype(np.float32) / 32768.0
    if sample_rate != 16000:
        import librosa
        audio_array = librosa.resample(audio_array, orig_sr=sample_rate, target_sr=16000)
    model = _get_model()
    result = model.transcribe(audio_array, fp16=False)
    return result["text"].strip()
