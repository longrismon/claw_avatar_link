import asyncio
import logging
from dataclasses import dataclass, field
from typing import Dict, List

import numpy as np

from config import settings

logger = logging.getLogger(__name__)

# ARKit viseme blend shape names used by Ready Player Me
VISEME_KEYS = [
    "mouthClose", "mouthFunnel", "mouthPucker", "mouthLeft", "mouthRight",
    "mouthSmileLeft", "mouthSmileRight", "mouthFrownLeft", "mouthFrownRight",
    "mouthDimpleLeft", "mouthDimpleRight", "mouthStretchLeft", "mouthStretchRight",
    "mouthRollLower", "mouthRollUpper", "mouthShrugLower", "mouthShrugUpper",
    "mouthPressLeft", "mouthPressRight", "mouthLowerDownLeft", "mouthLowerDownRight",
    "mouthUpperUpLeft", "mouthUpperUpRight", "jawOpen",
]


@dataclass
class BlendFrame:
    time_ms: int
    weights: Dict[str, float] = field(default_factory=dict)


async def audio_to_blend_frames(pcm_bytes: bytes, sample_rate: int = 16000) -> List[BlendFrame]:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _infer_sync, pcm_bytes, sample_rate)


def _infer_sync(pcm_bytes: bytes, sample_rate: int) -> List[BlendFrame]:
    try:
        return _latentsync_infer(pcm_bytes, sample_rate)
    except Exception as exc:
        logger.warning("LatentSync unavailable (%s) — using energy-based fallback", exc)
        return _fallback_energy_visemes(pcm_bytes, sample_rate)


def _latentsync_infer(pcm_bytes: bytes, sample_rate: int) -> List[BlendFrame]:
    """Run LatentSync model inference. Requires model at settings.lipsync_model_path."""
    import sys
    import importlib
    sys.path.insert(0, settings.lipsync_model_path)
    latentsync = importlib.import_module("latentsync.infer")
    audio_np = np.frombuffer(pcm_bytes, dtype=np.int16).astype(np.float32) / 32768.0
    device = settings.lipsync_device
    raw_frames = latentsync.audio_to_blendshapes(audio_np, sample_rate=sample_rate, device=device)
    frames = []
    for i, weights_dict in enumerate(raw_frames):
        frames.append(BlendFrame(
            time_ms=int(i * (1000 / 25)),  # 25 fps
            weights={k: float(np.clip(v, 0.0, 1.0)) for k, v in weights_dict.items()},
        ))
    return frames


def _fallback_energy_visemes(pcm_bytes: bytes, sample_rate: int) -> List[BlendFrame]:
    """Energy-based fallback: drives jawOpen from RMS energy when LatentSync unavailable."""
    audio = np.frombuffer(pcm_bytes, dtype=np.int16).astype(np.float32) / 32768.0
    fps = 25
    frame_size = sample_rate // fps
    frames = []
    for i in range(0, len(audio) - frame_size, frame_size):
        chunk = audio[i:i + frame_size]
        rms = float(np.sqrt(np.mean(chunk ** 2)))
        jaw = float(np.clip(rms * 8, 0.0, 1.0))
        frames.append(BlendFrame(
            time_ms=int(i / sample_rate * 1000),
            weights={"jawOpen": jaw, "mouthOpen": jaw * 0.6},
        ))
    return frames
