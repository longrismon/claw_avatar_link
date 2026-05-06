import asyncio
import os
import struct
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from lipsync import audio_to_blend_frames, BlendFrame


def make_silence_pcm(duration_s: int = 1, sample_rate: int = 16000) -> bytes:
    n = duration_s * sample_rate
    return struct.pack(f"<{n}h", *([0] * n))


def test_returns_list_of_blend_frames():
    pcm = make_silence_pcm(1)
    frames = asyncio.get_event_loop().run_until_complete(audio_to_blend_frames(pcm))
    assert isinstance(frames, list)


def test_frames_have_correct_keys():
    pcm = make_silence_pcm(1)
    frames = asyncio.get_event_loop().run_until_complete(audio_to_blend_frames(pcm))
    for f in frames:
        assert isinstance(f, BlendFrame)
        assert isinstance(f.time_ms, int)
        assert isinstance(f.weights, dict)
        for k, v in f.weights.items():
            assert isinstance(k, str)
            assert 0.0 <= v <= 1.0
