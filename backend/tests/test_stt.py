import asyncio
import os
import struct
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

whisper = pytest.importorskip("whisper", reason="whisper/torch not installed")

from stt import transcribe_pcm


def make_silence_pcm(duration_s: int = 1, sample_rate: int = 16000) -> bytes:
    num_samples = duration_s * sample_rate
    return struct.pack(f"<{num_samples}h", *([0] * num_samples))


def test_transcribe_returns_string():
    pcm = make_silence_pcm()
    result = asyncio.get_event_loop().run_until_complete(transcribe_pcm(pcm, sample_rate=16000))
    assert isinstance(result, str)


def test_transcribe_silence_is_empty_or_short():
    pcm = make_silence_pcm()
    result = asyncio.get_event_loop().run_until_complete(transcribe_pcm(pcm, sample_rate=16000))
    assert len(result) < 50
