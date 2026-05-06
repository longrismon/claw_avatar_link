import asyncio
import io
import struct
import wave

from config import settings

# Multilingual Coqui model used when language is not English
_COQUI_MULTILINGUAL_MODEL = "tts_models/multilingual/multi-dataset/xtts_v2"
_COQUI_EN_MODEL = "tts_models/en/ljspeech/tacotron2-DDC"


async def synthesize(text: str) -> bytes:
    """Return WAV-encoded audio bytes (16-bit, 16 kHz, mono) for the given text."""
    if not text:
        return _silence_wav()
    provider = settings.tts_provider.lower()
    if provider == "elevenlabs":
        return await _elevenlabs(text)
    elif provider == "openai":
        return await _openai_tts(text)
    else:
        return await _coqui(text)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _pcm_to_wav(pcm_bytes: bytes, sample_rate: int = 16000, channels: int = 1) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(channels)
        wf.setsampwidth(2)  # 16-bit
        wf.setframerate(sample_rate)
        wf.writeframes(pcm_bytes)
    return buf.getvalue()


def _silence_wav(duration_ms: int = 100, sample_rate: int = 16000) -> bytes:
    num_samples = int(sample_rate * duration_ms / 1000)
    pcm = struct.pack(f"<{num_samples}h", *([0] * num_samples))
    return _pcm_to_wav(pcm, sample_rate)


# ---------------------------------------------------------------------------
# TTS backends
# ---------------------------------------------------------------------------

async def _coqui(text: str) -> bytes:
    from TTS.api import TTS as CoquiTTS
    import numpy as np

    loop = asyncio.get_event_loop()
    lang = settings.language if settings.language not in ("auto", "en") else "en"
    use_multilingual = lang != "en"

    def _run():
        model_name = _COQUI_MULTILINGUAL_MODEL if use_multilingual else _COQUI_EN_MODEL
        tts = CoquiTTS(model_name)
        if use_multilingual:
            wav = tts.tts(text=text, language=lang)
        else:
            wav = tts.tts(text=text)
        arr = (np.array(wav) * 32767).astype(np.int16)
        return _pcm_to_wav(arr.tobytes())

    return await loop.run_in_executor(None, _run)


async def _elevenlabs(text: str) -> bytes:
    """ElevenLabs returns MP3; convert to WAV via pydub so the frontend always gets WAV."""
    import httpx
    from pydub import AudioSegment

    voice_settings: dict = {"stability": 0.5, "similarity_boost": 0.75}
    payload: dict = {
        "text": text,
        "model_id": "eleven_multilingual_v2" if settings.language not in ("auto", "en") else "eleven_monolingual_v1",
        "voice_settings": voice_settings,
    }
    if settings.language not in ("auto", "en"):
        payload["language_code"] = settings.language

    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"https://api.elevenlabs.io/v1/text-to-speech/{settings.elevenlabs_voice_id}/stream",
            headers={"xi-api-key": settings.elevenlabs_api_key},
            json=payload,
        )
        r.raise_for_status()

    seg = AudioSegment.from_mp3(io.BytesIO(r.content))
    seg = seg.set_frame_rate(16000).set_channels(1).set_sample_width(2)
    buf = io.BytesIO()
    seg.export(buf, format="wav")
    return buf.getvalue()


async def _openai_tts(text: str) -> bytes:
    """OpenAI TTS returns MP3; convert to WAV via pydub."""
    import httpx
    from pydub import AudioSegment

    payload: dict = {"model": "tts-1", "input": text, "voice": "nova"}
    if settings.language not in ("auto", "en"):
        payload["language"] = settings.language

    async with httpx.AsyncClient() as client:
        r = await client.post(
            "https://api.openai.com/v1/audio/speech",
            headers={"Authorization": f"Bearer {settings.openai_api_key}"},
            json=payload,
        )
        r.raise_for_status()

    seg = AudioSegment.from_mp3(io.BytesIO(r.content))
    seg = seg.set_frame_rate(16000).set_channels(1).set_sample_width(2)
    buf = io.BytesIO()
    seg.export(buf, format="wav")
    return buf.getvalue()
