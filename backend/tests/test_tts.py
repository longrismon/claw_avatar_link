import asyncio
import os
import sys
import wave
import io

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def test_tts_returns_wav_bytes():
    from tts import synthesize
    result = asyncio.get_event_loop().run_until_complete(synthesize("Hello from Hermes."))
    assert isinstance(result, bytes)
    assert len(result) > 44  # WAV header is 44 bytes minimum
    # Verify it's a valid WAV file
    with wave.open(io.BytesIO(result)) as wf:
        assert wf.getsampwidth() == 2
        assert wf.getnchannels() == 1


def test_tts_empty_string_returns_silence_wav():
    from tts import synthesize
    result = asyncio.get_event_loop().run_until_complete(synthesize(""))
    assert isinstance(result, bytes)
    with wave.open(io.BytesIO(result)) as wf:
        assert wf.getnchannels() == 1
