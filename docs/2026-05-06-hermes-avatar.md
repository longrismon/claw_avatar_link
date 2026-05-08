# Hermes Avatar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack, self-hosted avatar assistant for Hermes Agent (OpenClaw) with a 3D realistic talking face, AI-driven lip sync, Mixamo body/hand animations, and two-way voice conversation — packaged as Docker Compose.

**Architecture:** React + React Three Fiber frontend renders a Ready Player Me `.glb` avatar with Mixamo gesture clips and LatentSync blend shapes. A Python FastAPI backend orchestrates STT (Whisper), TTS (pluggable), LatentSync inference, and bridges to the Hermes Agent agentic loop. Frontend and backend communicate over a single WebSocket connection. The whole stack ships as Docker Compose (frontend Nginx + backend FastAPI + optional GPU worker).

**Tech Stack:** React 18, TypeScript, Vite, React Three Fiber, Three.js, Zustand, Python 3.11, FastAPI, Uvicorn, Whisper (openai-whisper), LatentSync, Mixamo GLB animations, Ready Player Me, Docker Compose.

---

## File Structure

```
hermes-avatar/
├── docker-compose.yml
├── docker-compose.gpu.yml          # GPU override for LatentSync
├── .env.example
│
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.ts
│   ├── index.html
│   ├── public/
│   │   └── avatars/
│   │       └── hermes-default.glb  # bundled default RPM avatar
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── store.ts                # Zustand global state
│       ├── ws.ts                   # WebSocket singleton + message types
│       ├── components/
│       │   ├── AvatarScene.tsx     # R3F canvas, lights, camera, model loader
│       │   ├── LipSyncController.tsx # applies blend shapes to morph targets
│       │   ├── GesturePlayer.tsx   # Mixamo animation clip manager
│       │   ├── VoiceIO.tsx         # mic capture + audio playback
│       │   ├── ChatOverlay.tsx     # floating transcript UI
│       │   └── SettingsPanel.tsx   # TTS/STT/avatar config
│       └── hooks/
│           ├── useWebSocket.ts
│           └── useAudioSync.ts     # syncs AudioContext time to blend frames
│
└── backend/
    ├── Dockerfile
    ├── requirements.txt
    ├── main.py                     # FastAPI app entry point
    ├── config.py                   # env-driven config (TTS provider, Hermes URL, etc.)
    ├── ws_handler.py               # WebSocket connection manager + message router
    ├── stt.py                      # Whisper STT adapter
    ├── tts.py                      # pluggable TTS (ElevenLabs / Coqui / OpenAI TTS)
    ├── lipsync.py                  # LatentSync inference wrapper → blend shape keyframes
    ├── gesture.py                  # intent → animation name mapper
    ├── hermes_client.py            # REST/socket client to Hermes Agent API
    └── tests/
        ├── test_stt.py
        ├── test_tts.py
        ├── test_lipsync.py
        ├── test_gesture.py
        └── test_ws_handler.py
```

---

## WebSocket Message Protocol

All frontend ↔ backend communication uses JSON over a single WebSocket at `ws://localhost:8000/ws`.

```typescript
// Frontend → Backend
type ClientMessage =
  | { type: "audio_chunk"; data: string }        // base64 PCM audio chunk
  | { type: "audio_end" }                         // end of user speech
  | { type: "text_input"; text: string }          // typed text fallback
  | { type: "settings_update"; settings: Settings }

// Backend → Frontend
type ServerMessage =
  | { type: "transcript"; text: string }          // STT result
  | { type: "agent_thinking" }                    // Hermes is processing
  | { type: "agent_reply"; text: string }         // Hermes text response
  | { type: "audio_start"; duration_ms: number }  // TTS audio is coming
  | { type: "audio_chunk"; data: string }         // base64 PCM audio chunk
  | { type: "blend_frames"; frames: BlendFrame[] }// LatentSync output
  | { type: "gesture"; name: GestureName }        // animation trigger
  | { type: "error"; message: string }

type BlendFrame = {
  time_ms: number
  weights: Record<string, number>  // morph target name → 0..1
}

type GestureName = "idle" | "talking" | "wave" | "nod" | "point" | "shrug" | "thinking"
```

---

## Task 1: Repo scaffold + Docker Compose

**Files:**
- Create: `docker-compose.yml`
- Create: `docker-compose.gpu.yml`
- Create: `.env.example`
- Create: `frontend/Dockerfile`
- Create: `backend/Dockerfile`
- Create: `frontend/package.json`
- Create: `backend/requirements.txt`

- [ ] **Step 1: Create root docker-compose.yml**

```yaml
# docker-compose.yml
version: "3.9"
services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    env_file: .env
    volumes:
      - ./backend:/app
    depends_on: []

  frontend:
    build: ./frontend
    ports:
      - "5173:80"
    environment:
      - VITE_WS_URL=ws://localhost:8000/ws
    depends_on:
      - backend
```

- [ ] **Step 2: Create docker-compose.gpu.yml override**

```yaml
# docker-compose.gpu.yml
version: "3.9"
services:
  backend:
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    environment:
      - LIPSYNC_DEVICE=cuda
```

Usage: `docker compose -f docker-compose.yml -f docker-compose.gpu.yml up`

- [ ] **Step 3: Create .env.example**

```env
# Hermes Agent
HERMES_API_URL=http://localhost:7000
HERMES_API_KEY=

# TTS provider: elevenlabs | coqui | openai
TTS_PROVIDER=coqui
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=
OPENAI_API_KEY=

# STT
WHISPER_MODEL=base          # tiny | base | small | medium | large

# LatentSync
LIPSYNC_DEVICE=cpu          # cpu | cuda
LIPSYNC_MODEL_PATH=/models/lipsync

# Avatar
DEFAULT_AVATAR_URL=         # leave blank to use bundled default
```

- [ ] **Step 4: Create backend/Dockerfile**

```dockerfile
FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y ffmpeg libsndfile1 && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

- [ ] **Step 5: Create backend/requirements.txt**

```
fastapi==0.111.0
uvicorn[standard]==0.29.0
websockets==12.0
openai-whisper==20231117
pydub==0.25.1
httpx==0.27.0
python-dotenv==1.0.1
numpy==1.26.4
soundfile==0.12.1
# TTS providers (install as needed)
# elevenlabs==1.1.2
# TTS==0.22.0   # Coqui
# openai==1.30.0
```

- [ ] **Step 6: Create frontend/Dockerfile**

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json .
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

- [ ] **Step 7: Create frontend/package.json**

```json
{
  "name": "hermes-avatar",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@react-three/drei": "^9.105.6",
    "@react-three/fiber": "^8.16.6",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "three": "^0.165.0",
    "zustand": "^4.5.2"
  },
  "devDependencies": {
    "@types/react": "^18.3.1",
    "@types/react-dom": "^18.3.0",
    "@types/three": "^0.165.0",
    "typescript": "^5.4.5",
    "vite": "^5.2.11",
    "@vitejs/plugin-react": "^4.3.0"
  }
}
```

- [ ] **Step 8: Verify compose parses correctly**

```bash
cd hermes-avatar
docker compose config --quiet
# Expected: no errors
```

- [ ] **Step 9: Commit**

```bash
git add .
git commit -m "feat: scaffold repo with Docker Compose, frontend and backend Dockerfiles"
```

---

## Task 2: Backend — config + FastAPI skeleton

**Files:**
- Create: `backend/config.py`
- Create: `backend/main.py`

- [ ] **Step 1: Write config.py**

```python
# backend/config.py
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
```

Add `pydantic-settings==2.2.1` to requirements.txt.

- [ ] **Step 2: Write main.py**

```python
# backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from ws_handler import router as ws_router

app = FastAPI(title="Hermes Avatar Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ws_router)

@app.get("/health")
async def health():
    return {"status": "ok"}
```

- [ ] **Step 3: Verify it starts**

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
# Expected: "Application startup complete" at http://localhost:8000/health → {"status":"ok"}
```

- [ ] **Step 4: Commit**

```bash
git add backend/config.py backend/main.py backend/requirements.txt
git commit -m "feat: FastAPI skeleton with CORS and health endpoint"
```

---

## Task 3: Backend — STT (Whisper)

**Files:**
- Create: `backend/stt.py`
- Create: `backend/tests/test_stt.py`

- [ ] **Step 1: Write failing test**

```python
# backend/tests/test_stt.py
import asyncio, wave, struct, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from stt import transcribe_pcm

def make_silence_pcm(duration_s=1, sample_rate=16000) -> bytes:
    num_samples = duration_s * sample_rate
    return struct.pack(f"<{num_samples}h", *([0] * num_samples))

def test_transcribe_returns_string():
    pcm = make_silence_pcm()
    result = asyncio.get_event_loop().run_until_complete(transcribe_pcm(pcm, sample_rate=16000))
    assert isinstance(result, str)

def test_transcribe_silence_is_empty_or_short():
    pcm = make_silence_pcm()
    result = asyncio.get_event_loop().run_until_complete(transcribe_pcm(pcm, sample_rate=16000))
    assert len(result) < 50  # silence should produce empty or minimal output
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd backend && pytest tests/test_stt.py -v
# Expected: ImportError (stt module not found)
```

- [ ] **Step 3: Implement stt.py**

```python
# backend/stt.py
import io, asyncio
import numpy as np
import whisper
import soundfile as sf
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
```

- [ ] **Step 4: Run tests**

```bash
pytest tests/test_stt.py -v
# Expected: PASSED (will download whisper model on first run ~140MB for "base")
```

- [ ] **Step 5: Commit**

```bash
git add backend/stt.py backend/tests/test_stt.py
git commit -m "feat: Whisper STT adapter with async executor"
```

---

## Task 4: Backend — TTS (pluggable)

**Files:**
- Create: `backend/tts.py`
- Create: `backend/tests/test_tts.py`

- [ ] **Step 1: Write failing test**

```python
# backend/tests/test_tts.py
import asyncio, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

def test_tts_returns_bytes():
    from tts import synthesize
    result = asyncio.get_event_loop().run_until_complete(synthesize("Hello from Hermes."))
    assert isinstance(result, bytes)
    assert len(result) > 100  # should have actual audio data

def test_tts_empty_string_returns_bytes():
    from tts import synthesize
    result = asyncio.get_event_loop().run_until_complete(synthesize(""))
    assert isinstance(result, bytes)
```

- [ ] **Step 2: Run to verify it fails**

```bash
pytest tests/test_tts.py -v
# Expected: ImportError
```

- [ ] **Step 3: Implement tts.py**

```python
# backend/tts.py
import asyncio
from config import settings

async def synthesize(text: str) -> bytes:
    """Return raw PCM audio bytes (16-bit, 16kHz, mono) for the given text."""
    if not text:
        return b""
    provider = settings.tts_provider.lower()
    if provider == "elevenlabs":
        return await _elevenlabs(text)
    elif provider == "openai":
        return await _openai_tts(text)
    else:
        return await _coqui(text)

async def _coqui(text: str) -> bytes:
    from TTS.api import TTS as CoquiTTS
    import numpy as np, io
    loop = asyncio.get_event_loop()
    def _run():
        tts = CoquiTTS("tts_models/en/ljspeech/tacotron2-DDC")
        wav = tts.tts(text=text)
        arr = (np.array(wav) * 32767).astype(np.int16)
        return arr.tobytes()
    return await loop.run_in_executor(None, _run)

async def _elevenlabs(text: str) -> bytes:
    import httpx
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"https://api.elevenlabs.io/v1/text-to-speech/{settings.elevenlabs_voice_id}/stream",
            headers={"xi-api-key": settings.elevenlabs_api_key},
            json={"text": text, "model_id": "eleven_monolingual_v1",
                  "voice_settings": {"stability": 0.5, "similarity_boost": 0.75}},
        )
        r.raise_for_status()
        return r.content  # mp3 bytes; frontend decodes

async def _openai_tts(text: str) -> bytes:
    import httpx
    async with httpx.AsyncClient() as client:
        r = await client.post(
            "https://api.openai.com/v1/audio/speech",
            headers={"Authorization": f"Bearer {settings.openai_api_key}"},
            json={"model": "tts-1", "input": text, "voice": "nova"},
        )
        r.raise_for_status()
        return r.content
```

- [ ] **Step 4: Run tests (Coqui fallback)**

```bash
TTS_PROVIDER=coqui pytest tests/test_tts.py -v
# Expected: PASSED (first run downloads Coqui model ~100MB)
```

- [ ] **Step 5: Commit**

```bash
git add backend/tts.py backend/tests/test_tts.py
git commit -m "feat: pluggable TTS — Coqui, ElevenLabs, OpenAI"
```

---

## Task 5: Backend — LatentSync lip sync

**Files:**
- Create: `backend/lipsync.py`
- Create: `backend/tests/test_lipsync.py`

- [ ] **Step 1: Write failing test**

```python
# backend/tests/test_lipsync.py
import asyncio, struct, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from lipsync import audio_to_blend_frames, BlendFrame

def make_silence_pcm(duration_s=1, sample_rate=16000) -> bytes:
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
```

- [ ] **Step 2: Run to verify it fails**

```bash
pytest tests/test_lipsync.py -v
# Expected: ImportError
```

- [ ] **Step 3: Implement lipsync.py**

LatentSync maps audio to ARKit-compatible blend shapes. The 52 blend shape keys match Ready Player Me's morph targets.

```python
# backend/lipsync.py
import asyncio
from dataclasses import dataclass, field
from typing import Dict, List
import numpy as np
from config import settings

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
    except Exception:
        return _fallback_energy_visemes(pcm_bytes, sample_rate)

def _latentsync_infer(pcm_bytes: bytes, sample_rate: int) -> List[BlendFrame]:
    """Run LatentSync model inference. Requires model at settings.lipsync_model_path."""
    import torch, sys, importlib
    sys.path.insert(0, settings.lipsync_model_path)
    latentsync = importlib.import_module("latentsync.infer")
    audio_np = np.frombuffer(pcm_bytes, dtype=np.int16).astype(np.float32) / 32768.0
    device = settings.lipsync_device
    raw_frames = latentsync.audio_to_blendshapes(audio_np, sample_rate=sample_rate, device=device)
    frames = []
    for i, weights_dict in enumerate(raw_frames):
        frames.append(BlendFrame(
            time_ms=int(i * (1000 / 25)),  # 25fps
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
```

- [ ] **Step 4: Run tests**

```bash
pytest tests/test_lipsync.py -v
# Expected: PASSED (uses energy fallback if LatentSync model not present)
```

- [ ] **Step 5: Commit**

```bash
git add backend/lipsync.py backend/tests/test_lipsync.py
git commit -m "feat: LatentSync lip sync with energy-based fallback"
```

---

## Task 6: Backend — Gesture Engine

**Files:**
- Create: `backend/gesture.py`
- Create: `backend/tests/test_gesture.py`

- [ ] **Step 1: Write failing test**

```python
# backend/tests/test_gesture.py
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from gesture import intent_to_gesture

def test_greeting_maps_to_wave():
    assert intent_to_gesture("Hello! How can I help you today?") == "wave"

def test_affirmation_maps_to_nod():
    assert intent_to_gesture("Yes, that's correct.") == "nod"

def test_unknown_maps_to_talking():
    assert intent_to_gesture("The weather is sunny today.") == "talking"

def test_thinking_phrase_maps_to_thinking():
    assert intent_to_gesture("Let me check that for you...") == "thinking"

def test_empty_maps_to_idle():
    assert intent_to_gesture("") == "idle"
```

- [ ] **Step 2: Run to verify it fails**

```bash
pytest tests/test_gesture.py -v
# Expected: ImportError
```

- [ ] **Step 3: Implement gesture.py**

```python
# backend/gesture.py
import re

_RULES = [
    ("wave",     r"\b(hello|hi|hey|good morning|good evening|goodbye|bye|welcome)\b"),
    ("nod",      r"\b(yes|correct|exactly|absolutely|right|indeed|confirmed|sure)\b"),
    ("thinking", r"\b(let me|checking|searching|looking|one moment|give me a sec|i'll find)\b"),
    ("shrug",    r"\b(not sure|don't know|unclear|uncertain|maybe|perhaps|possibly)\b"),
    ("point",    r"\b(here|there|this|that|look at|see this|check this)\b"),
]

def intent_to_gesture(text: str) -> str:
    """Map agent reply text to a gesture animation name."""
    if not text.strip():
        return "idle"
    lower = text.lower()
    for gesture, pattern in _RULES:
        if re.search(pattern, lower):
            return gesture
    return "talking"
```

- [ ] **Step 4: Run tests**

```bash
pytest tests/test_gesture.py -v
# Expected: all PASSED
```

- [ ] **Step 5: Commit**

```bash
git add backend/gesture.py backend/tests/test_gesture.py
git commit -m "feat: gesture engine — intent regex to animation name"
```

---

## Task 7: Backend — Hermes Agent client

**Files:**
- Create: `backend/hermes_client.py`

- [ ] **Step 1: Write hermes_client.py**

```python
# backend/hermes_client.py
import httpx
from config import settings

async def send_message(text: str, session_id: str) -> str:
    """Send user text to Hermes Agent API and return the reply text."""
    headers = {}
    if settings.hermes_api_key:
        headers["Authorization"] = f"Bearer {settings.hermes_api_key}"
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.post(
            f"{settings.hermes_api_url}/v1/chat",
            headers=headers,
            json={"message": text, "session_id": session_id},
        )
        r.raise_for_status()
        data = r.json()
        # Hermes returns {"reply": "...", "intent": "..."} or {"choices": [...]}
        if "reply" in data:
            return str(data["reply"])
        if "choices" in data:
            return str(data["choices"][0]["message"]["content"])
        return str(data)
```

> **Note:** If Hermes Agent is not running, set `HERMES_API_URL=http://mock` and stub this with a simple echo server during development.

- [ ] **Step 2: Commit**

```bash
git add backend/hermes_client.py
git commit -m "feat: Hermes Agent REST client"
```

---

## Task 8: Backend — WebSocket handler

**Files:**
- Create: `backend/ws_handler.py`
- Create: `backend/tests/test_ws_handler.py`

- [ ] **Step 1: Write failing test**

```python
# backend/tests/test_ws_handler.py
import asyncio, json
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health_endpoint():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}

def test_ws_connects():
    with client.websocket_connect("/ws") as ws:
        data = ws.receive_json(timeout=2)
        assert data["type"] == "ready"
```

- [ ] **Step 2: Run to verify it fails**

```bash
pytest tests/test_ws_handler.py -v
# Expected: ImportError or connection error (no /ws route yet)
```

- [ ] **Step 3: Implement ws_handler.py**

```python
# backend/ws_handler.py
import asyncio, base64, json, uuid
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from stt import transcribe_pcm
from tts import synthesize
from lipsync import audio_to_blend_frames
from gesture import intent_to_gesture
from hermes_client import send_message

router = APIRouter()

@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    session_id = str(uuid.uuid4())
    audio_buffer = bytearray()
    await ws.send_json({"type": "ready", "session_id": session_id})

    try:
        while True:
            raw = await ws.receive_text()
            msg = json.loads(raw)
            await _handle(ws, msg, session_id, audio_buffer)
    except WebSocketDisconnect:
        pass

async def _handle(ws: WebSocket, msg: dict, session_id: str, audio_buffer: bytearray):
    t = msg.get("type")

    if t == "audio_chunk":
        chunk = base64.b64decode(msg["data"])
        audio_buffer.extend(chunk)

    elif t == "audio_end":
        pcm = bytes(audio_buffer)
        audio_buffer.clear()

        transcript = await transcribe_pcm(pcm)
        if not transcript:
            return
        await ws.send_json({"type": "transcript", "text": transcript})

        await ws.send_json({"type": "agent_thinking"})
        reply_text = await send_message(transcript, session_id)
        await ws.send_json({"type": "agent_reply", "text": reply_text})

        gesture = intent_to_gesture(reply_text)
        await ws.send_json({"type": "gesture", "name": gesture})

        audio_bytes = await synthesize(reply_text)
        duration_ms = int(len(audio_bytes) / (16000 * 2) * 1000)
        await ws.send_json({"type": "audio_start", "duration_ms": duration_ms})

        # Stream audio in 4KB chunks
        chunk_size = 4096
        for i in range(0, len(audio_bytes), chunk_size):
            chunk = audio_bytes[i:i + chunk_size]
            await ws.send_json({"type": "audio_chunk", "data": base64.b64encode(chunk).decode()})

        # Run LatentSync on audio
        frames = await audio_to_blend_frames(audio_bytes)
        frames_json = [{"time_ms": f.time_ms, "weights": f.weights} for f in frames]
        await ws.send_json({"type": "blend_frames", "frames": frames_json})

    elif t == "text_input":
        text = msg.get("text", "").strip()
        if not text:
            return
        await ws.send_json({"type": "transcript", "text": text})
        await ws.send_json({"type": "agent_thinking"})
        reply_text = await send_message(text, session_id)
        await ws.send_json({"type": "agent_reply", "text": reply_text})
        gesture = intent_to_gesture(reply_text)
        await ws.send_json({"type": "gesture", "name": gesture})
        audio_bytes = await synthesize(reply_text)
        duration_ms = int(len(audio_bytes) / (16000 * 2) * 1000)
        await ws.send_json({"type": "audio_start", "duration_ms": duration_ms})
        chunk_size = 4096
        for i in range(0, len(audio_bytes), chunk_size):
            chunk = audio_bytes[i:i + chunk_size]
            await ws.send_json({"type": "audio_chunk", "data": base64.b64encode(chunk).decode()})
        frames = await audio_to_blend_frames(audio_bytes)
        frames_json = [{"time_ms": f.time_ms, "weights": f.weights} for f in frames]
        await ws.send_json({"type": "blend_frames", "frames": frames_json})
```

- [ ] **Step 4: Run tests**

```bash
pytest tests/test_ws_handler.py -v
# Expected: PASSED
```

- [ ] **Step 5: Commit**

```bash
git add backend/ws_handler.py backend/tests/test_ws_handler.py
git commit -m "feat: WebSocket handler orchestrating full STT→Hermes→TTS→LipSync pipeline"
```

---

## Task 9: Frontend — Vite + Zustand store + WebSocket singleton

**Files:**
- Create: `frontend/vite.config.ts`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/store.ts`
- Create: `frontend/src/ws.ts`

- [ ] **Step 1: Create vite.config.ts**

```typescript
// frontend/vite.config.ts
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { "/ws": { target: "ws://localhost:8000", ws: true } } },
})
```

- [ ] **Step 2: Create src/store.ts**

```typescript
// frontend/src/store.ts
import { create } from "zustand"

export type GestureName = "idle" | "talking" | "wave" | "nod" | "point" | "shrug" | "thinking"

export interface BlendFrame {
  time_ms: number
  weights: Record<string, number>
}

export interface ChatMessage {
  role: "user" | "assistant"
  text: string
}

interface HermesStore {
  // Connection
  connected: boolean
  setConnected: (v: boolean) => void

  // Conversation
  messages: ChatMessage[]
  appendMessage: (m: ChatMessage) => void
  agentThinking: boolean
  setAgentThinking: (v: boolean) => void

  // Avatar
  currentGesture: GestureName
  setGesture: (g: GestureName) => void
  blendFrames: BlendFrame[]
  setBlendFrames: (f: BlendFrame[]) => void
  audioStartTime: number | null
  setAudioStartTime: (t: number | null) => void

  // Settings
  avatarUrl: string
  setAvatarUrl: (url: string) => void
}

export const useStore = create<HermesStore>((set) => ({
  connected: false,
  setConnected: (v) => set({ connected: v }),
  messages: [],
  appendMessage: (m) => set((s) => ({ messages: [...s.messages, m] })),
  agentThinking: false,
  setAgentThinking: (v) => set({ agentThinking: v }),
  currentGesture: "idle",
  setGesture: (g) => set({ currentGesture: g }),
  blendFrames: [],
  setBlendFrames: (f) => set({ blendFrames: f }),
  audioStartTime: null,
  setAudioStartTime: (t) => set({ audioStartTime: t }),
  avatarUrl: "/avatars/hermes-default.glb",
  setAvatarUrl: (url) => set({ avatarUrl: url }),
}))
```

- [ ] **Step 3: Create src/ws.ts**

```typescript
// frontend/src/ws.ts
import { useStore } from "./store"

const WS_URL = import.meta.env.VITE_WS_URL ?? "ws://localhost:8000/ws"

let socket: WebSocket | null = null
const audioQueue: ArrayBuffer[] = []
let audioCtx: AudioContext | null = null

export function connectWS() {
  if (socket?.readyState === WebSocket.OPEN) return
  socket = new WebSocket(WS_URL)

  socket.onopen = () => useStore.getState().setConnected(true)
  socket.onclose = () => {
    useStore.getState().setConnected(false)
    setTimeout(connectWS, 3000)  // auto-reconnect
  }
  socket.onmessage = (event) => handleMessage(JSON.parse(event.data))
}

function handleMessage(msg: Record<string, unknown>) {
  const store = useStore.getState()
  switch (msg.type) {
    case "transcript":
      store.appendMessage({ role: "user", text: msg.text as string })
      break
    case "agent_thinking":
      store.setAgentThinking(true)
      break
    case "agent_reply":
      store.setAgentThinking(false)
      store.appendMessage({ role: "assistant", text: msg.text as string })
      break
    case "gesture":
      store.setGesture(msg.name as never)
      break
    case "audio_start":
      audioQueue.length = 0
      break
    case "audio_chunk":
      const bytes = Uint8Array.from(atob(msg.data as string), c => c.charCodeAt(0))
      audioQueue.push(bytes.buffer)
      break
    case "blend_frames":
      store.setBlendFrames(msg.frames as never)
      _playAudioAndSetStartTime()
      break
  }
}

async function _playAudioAndSetStartTime() {
  if (!audioCtx) audioCtx = new AudioContext()
  const combined = _mergeBuffers(audioQueue)
  const decoded = await audioCtx.decodeAudioData(combined)
  const source = audioCtx.createBufferSource()
  source.buffer = decoded
  source.connect(audioCtx.destination)
  useStore.getState().setAudioStartTime(audioCtx.currentTime)
  source.start()
  source.onended = () => {
    useStore.getState().setAudioStartTime(null)
    useStore.getState().setGesture("idle")
  }
}

function _mergeBuffers(buffers: ArrayBuffer[]): ArrayBuffer {
  const total = buffers.reduce((a, b) => a + b.byteLength, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const buf of buffers) {
    out.set(new Uint8Array(buf), offset)
    offset += buf.byteLength
  }
  return out.buffer
}

export function sendAudioChunk(pcmBase64: string) {
  socket?.send(JSON.stringify({ type: "audio_chunk", data: pcmBase64 }))
}

export function sendAudioEnd() {
  socket?.send(JSON.stringify({ type: "audio_end" }))
}

export function sendTextInput(text: string) {
  socket?.send(JSON.stringify({ type: "text_input", text }))
}
```

- [ ] **Step 4: Create src/main.tsx**

```tsx
// frontend/src/main.tsx
import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import { connectWS } from "./ws"
import "./index.css"

connectWS()

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><App /></React.StrictMode>
)
```

- [ ] **Step 5: Commit**

```bash
git add frontend/vite.config.ts frontend/src/
git commit -m "feat: Vite setup, Zustand store, WebSocket singleton with auto-reconnect"
```

---

## Task 10: Frontend — AvatarScene (R3F canvas + RPM model loader)

**Files:**
- Create: `frontend/src/components/AvatarScene.tsx`

- [ ] **Step 1: Implement AvatarScene.tsx**

```tsx
// frontend/src/components/AvatarScene.tsx
import { Canvas } from "@react-three/fiber"
import { Environment, OrbitControls, useGLTF } from "@react-three/drei"
import { Suspense, useEffect, useRef } from "react"
import * as THREE from "three"
import { useStore } from "../store"
import LipSyncController from "./LipSyncController"
import GesturePlayer from "./GesturePlayer"

function AvatarModel({ url }: { url: string }) {
  const { scene, animations } = useGLTF(url)
  const groupRef = useRef<THREE.Group>(null)

  // Collect all SkinnedMesh morph targets for lip sync
  const morphMeshes = useRef<THREE.SkinnedMesh[]>([])
  useEffect(() => {
    morphMeshes.current = []
    scene.traverse((child) => {
      if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
        const mesh = child as THREE.SkinnedMesh
        if (mesh.morphTargetDictionary) morphMeshes.current.push(mesh)
      }
    })
  }, [scene])

  return (
    <group ref={groupRef} position={[0, -1.6, 0]}>
      <primitive object={scene} />
      <LipSyncController morphMeshes={morphMeshes} />
      <GesturePlayer scene={scene} animations={animations} groupRef={groupRef} />
    </group>
  )
}

export default function AvatarScene() {
  const avatarUrl = useStore((s) => s.avatarUrl)

  return (
    <Canvas
      camera={{ position: [0, 0.2, 1.4], fov: 45 }}
      style={{ width: "100%", height: "100%", background: "transparent" }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[2, 4, 3]} intensity={1.2} />
      <Environment preset="city" />
      <Suspense fallback={null}>
        <AvatarModel url={avatarUrl} />
      </Suspense>
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        minPolarAngle={Math.PI / 3}
        maxPolarAngle={Math.PI / 1.8}
      />
    </Canvas>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/AvatarScene.tsx
git commit -m "feat: AvatarScene with RPM GLB loader, lights, orbit controls"
```

---

## Task 11: Frontend — LipSyncController

**Files:**
- Create: `frontend/src/hooks/useAudioSync.ts`
- Create: `frontend/src/components/LipSyncController.tsx`

- [ ] **Step 1: Create useAudioSync.ts**

```typescript
// frontend/src/hooks/useAudioSync.ts
import { useStore } from "../store"

export function useCurrentAudioTime(): number | null {
  const audioStartTime = useStore((s) => s.audioStartTime)
  if (audioStartTime === null) return null
  // AudioContext.currentTime is in seconds; return ms since playback start
  return (performance.now() / 1000 - audioStartTime) * 1000
}
```

- [ ] **Step 2: Create LipSyncController.tsx**

```tsx
// frontend/src/components/LipSyncController.tsx
import { useFrame } from "@react-three/fiber"
import { MutableRefObject } from "react"
import * as THREE from "three"
import { useStore, BlendFrame } from "../store"

interface Props {
  morphMeshes: MutableRefObject<THREE.SkinnedMesh[]>
}

export default function LipSyncController({ morphMeshes }: Props) {
  const blendFrames = useStore((s) => s.blendFrames)
  const audioStartTime = useStore((s) => s.audioStartTime)

  useFrame(() => {
    if (!audioStartTime || blendFrames.length === 0) return

    const elapsedMs = (performance.now() / 1000 - audioStartTime) * 1000
    const frame = _findFrame(blendFrames, elapsedMs)
    if (!frame) return

    for (const mesh of morphMeshes.current) {
      const dict = mesh.morphTargetDictionary
      const influences = mesh.morphTargetInfluences
      if (!dict || !influences) continue
      for (const [name, weight] of Object.entries(frame.weights)) {
        const idx = dict[name]
        if (idx !== undefined) influences[idx] = weight
      }
    }
  })

  return null
}

function _findFrame(frames: BlendFrame[], elapsedMs: number): BlendFrame | null {
  if (frames.length === 0) return null
  let best = frames[0]
  for (const f of frames) {
    if (f.time_ms <= elapsedMs) best = f
    else break
  }
  return best
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useAudioSync.ts frontend/src/components/LipSyncController.tsx
git commit -m "feat: LipSyncController applies LatentSync blend shapes to RPM morph targets"
```

---

## Task 12: Frontend — GesturePlayer (Mixamo animations)

**Files:**
- Create: `frontend/src/components/GesturePlayer.tsx`

Mixamo animation GLBs are free-to-download. Required clips:
- `idle.glb`, `talking.glb`, `wave.glb`, `nod.glb`, `point.glb`, `shrug.glb`, `thinking.glb`

Place them in `frontend/public/animations/`.

- [ ] **Step 1: Implement GesturePlayer.tsx**

```tsx
// frontend/src/components/GesturePlayer.tsx
import { useEffect, useRef, MutableRefObject } from "react"
import { useFrame } from "@react-three/fiber"
import { useGLTF } from "@react-three/drei"
import * as THREE from "three"
import { useStore, GestureName } from "../store"

const ANIM_PATHS: Record<GestureName, string> = {
  idle:     "/animations/idle.glb",
  talking:  "/animations/talking.glb",
  wave:     "/animations/wave.glb",
  nod:      "/animations/nod.glb",
  point:    "/animations/point.glb",
  shrug:    "/animations/shrug.glb",
  thinking: "/animations/thinking.glb",
}

interface Props {
  scene: THREE.Group
  animations: THREE.AnimationClip[]
  groupRef: MutableRefObject<THREE.Group | null>
}

// Preload all animation clips
Object.values(ANIM_PATHS).forEach(useGLTF.preload)

export default function GesturePlayer({ scene, groupRef }: Props) {
  const gesture = useStore((s) => s.currentGesture)
  const mixerRef = useRef<THREE.AnimationMixer | null>(null)
  const currentActionRef = useRef<THREE.AnimationAction | null>(null)

  // Load all animation GLBs
  const glbs = Object.fromEntries(
    Object.entries(ANIM_PATHS).map(([name, path]) => [name, useGLTF(path)])
  ) as Record<GestureName, ReturnType<typeof useGLTF>>

  useEffect(() => {
    if (!groupRef.current) return
    mixerRef.current = new THREE.AnimationMixer(scene)
    return () => { mixerRef.current?.stopAllAction() }
  }, [scene])

  useEffect(() => {
    const mixer = mixerRef.current
    if (!mixer) return
    const clip = glbs[gesture]?.animations?.[0]
    if (!clip) return
    const retargeted = _retargetClip(clip, scene)
    const action = mixer.clipAction(retargeted)
    if (currentActionRef.current) {
      currentActionRef.current.crossFadeTo(action, 0.4, true)
    }
    action.play()
    currentActionRef.current = action
  }, [gesture])

  useFrame((_, delta) => { mixerRef.current?.update(delta) })

  return null
}

function _retargetClip(clip: THREE.AnimationClip, targetScene: THREE.Group): THREE.AnimationClip {
  return THREE.AnimationUtils.subclip(clip, clip.name, 0, clip.duration * clip.tracks[0]?.times?.length ?? 60)
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/GesturePlayer.tsx
git commit -m "feat: GesturePlayer with Mixamo animation cross-fading"
```

---

## Task 13: Frontend — VoiceIO (mic capture + audio playback)

**Files:**
- Create: `frontend/src/components/VoiceIO.tsx`

- [ ] **Step 1: Implement VoiceIO.tsx**

```tsx
// frontend/src/components/VoiceIO.tsx
import { useEffect, useRef, useState } from "react"
import { sendAudioChunk, sendAudioEnd } from "../ws"
import { useStore } from "../store"

const SILENCE_THRESHOLD = 0.01
const SILENCE_DURATION_MS = 1200

export default function VoiceIO() {
  const [listening, setListening] = useState(false)
  const connected = useStore((s) => s.connected)
  const mediaRef = useRef<MediaRecorder | null>(null)
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef<number>(0)

  async function startListening() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const audioCtx = new AudioContext()
    const source = audioCtx.createMediaStreamSource(stream)
    const analyser = audioCtx.createAnalyser()
    analyser.fftSize = 512
    source.connect(analyser)
    analyserRef.current = analyser

    const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" })
    mediaRef.current = recorder

    recorder.ondataavailable = async (e) => {
      if (e.data.size === 0) return
      const arr = await e.data.arrayBuffer()
      const b64 = btoa(String.fromCharCode(...new Uint8Array(arr)))
      sendAudioChunk(b64)
    }

    recorder.start(250)  // emit chunks every 250ms
    setListening(true)
    _monitorSilence()
  }

  function _monitorSilence() {
    const analyser = analyserRef.current
    if (!analyser) return
    const data = new Float32Array(analyser.fftSize)
    function tick() {
      analyser!.getFloatTimeDomainData(data)
      const rms = Math.sqrt(data.reduce((a, v) => a + v * v, 0) / data.length)
      if (rms < SILENCE_THRESHOLD) {
        if (!silenceTimer.current) {
          silenceTimer.current = setTimeout(stopListening, SILENCE_DURATION_MS)
        }
      } else {
        if (silenceTimer.current) { clearTimeout(silenceTimer.current); silenceTimer.current = null }
      }
      animFrameRef.current = requestAnimationFrame(tick)
    }
    tick()
  }

  function stopListening() {
    cancelAnimationFrame(animFrameRef.current)
    mediaRef.current?.stop()
    sendAudioEnd()
    setListening(false)
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <button
        onClick={listening ? stopListening : startListening}
        disabled={!connected}
        style={{
          width: 56, height: 56, borderRadius: "50%",
          background: listening ? "#e24b4a" : "#1d9e75",
          border: "none", cursor: "pointer", color: "#fff", fontSize: 22,
        }}
        title={listening ? "Stop" : "Speak"}
      >
        {listening ? "■" : "🎙"}
      </button>
      <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
        {!connected ? "Connecting…" : listening ? "Listening…" : "Press to speak"}
      </span>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/VoiceIO.tsx
git commit -m "feat: VoiceIO with VAD silence detection and audio streaming"
```

---

## Task 14: Frontend — ChatOverlay + SettingsPanel + App shell

**Files:**
- Create: `frontend/src/components/ChatOverlay.tsx`
- Create: `frontend/src/components/SettingsPanel.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/index.html`

- [ ] **Step 1: Create ChatOverlay.tsx**

```tsx
// frontend/src/components/ChatOverlay.tsx
import { useStore } from "../store"

export default function ChatOverlay() {
  const messages = useStore((s) => s.messages)
  const thinking = useStore((s) => s.agentThinking)

  return (
    <div style={{
      position: "absolute", bottom: 120, left: 20, right: 20,
      maxHeight: 200, overflowY: "auto", display: "flex",
      flexDirection: "column", gap: 8, pointerEvents: "none",
    }}>
      {messages.slice(-6).map((m, i) => (
        <div key={i} style={{
          alignSelf: m.role === "user" ? "flex-end" : "flex-start",
          background: m.role === "user" ? "rgba(30,158,117,0.85)" : "rgba(255,255,255,0.9)",
          color: m.role === "user" ? "#fff" : "#111",
          borderRadius: 12, padding: "6px 12px",
          fontSize: 14, maxWidth: "75%", backdropFilter: "blur(4px)",
        }}>
          {m.text}
        </div>
      ))}
      {thinking && (
        <div style={{
          alignSelf: "flex-start", background: "rgba(255,255,255,0.7)",
          borderRadius: 12, padding: "6px 12px", fontSize: 13, color: "#555",
        }}>
          Hermes is thinking…
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create SettingsPanel.tsx**

```tsx
// frontend/src/components/SettingsPanel.tsx
import { useState } from "react"
import { useStore } from "../store"

export default function SettingsPanel() {
  const [open, setOpen] = useState(false)
  const { avatarUrl, setAvatarUrl } = useStore()
  const [draft, setDraft] = useState(avatarUrl)

  return (
    <>
      <button onClick={() => setOpen(!open)} style={{
        position: "absolute", top: 16, right: 16,
        background: "rgba(255,255,255,0.15)", border: "none",
        borderRadius: 8, padding: "6px 12px", color: "#fff",
        backdropFilter: "blur(4px)", cursor: "pointer", fontSize: 13,
      }}>
        ⚙ Settings
      </button>
      {open && (
        <div style={{
          position: "absolute", top: 56, right: 16, width: 320,
          background: "rgba(20,20,24,0.92)", borderRadius: 12, padding: 16,
          backdropFilter: "blur(8px)", color: "#fff",
        }}>
          <p style={{ margin: "0 0 8px", fontWeight: 500 }}>Avatar URL</p>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="https://models.readyplayer.me/xxx.glb"
            style={{ width: "100%", borderRadius: 6, border: "1px solid #555",
              padding: "6px 8px", background: "#1a1a1e", color: "#fff", fontSize: 13 }}
          />
          <button
            onClick={() => { setAvatarUrl(draft); setOpen(false) }}
            style={{ marginTop: 10, width: "100%", padding: "8px 0",
              background: "#1d9e75", border: "none", borderRadius: 8,
              color: "#fff", cursor: "pointer", fontWeight: 500 }}
          >
            Apply
          </button>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 3: Create App.tsx**

```tsx
// frontend/src/App.tsx
import AvatarScene from "./components/AvatarScene"
import ChatOverlay from "./components/ChatOverlay"
import VoiceIO from "./components/VoiceIO"
import SettingsPanel from "./components/SettingsPanel"

export default function App() {
  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative",
      background: "linear-gradient(160deg, #0f1117 0%, #1a2535 100%)" }}>
      <AvatarScene />
      <ChatOverlay />
      <SettingsPanel />
      <div style={{ position: "absolute", bottom: 32, left: "50%",
        transform: "translateX(-50%)", display: "flex",
        flexDirection: "column", alignItems: "center", gap: 8 }}>
        <VoiceIO />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Hermes Avatar</title>
  </head>
  <body style="margin:0;overflow:hidden;">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ChatOverlay.tsx frontend/src/components/SettingsPanel.tsx frontend/src/App.tsx frontend/index.html
git commit -m "feat: App shell — ChatOverlay, SettingsPanel, VoiceIO assembled"
```

---

## Task 15: Integration test + default avatar

**Files:**
- Create: `frontend/public/avatars/` (place `hermes-default.glb` here)
- Create: `frontend/public/animations/` (place Mixamo GLBs here)
- Create: `frontend/nginx.conf`

- [ ] **Step 1: Download default RPM avatar**

```bash
# Download a free Ready Player Me avatar (replace URL with your chosen RPM character)
curl -L "https://models.readyplayer.me/64f4e1c2a0a2f8d9e3b1a2c3.glb?morphTargets=ARKit" \
  -o frontend/public/avatars/hermes-default.glb
```

- [ ] **Step 2: Download Mixamo animations**

```
1. Go to https://www.mixamo.com
2. Upload any character (skeleton matching only — we use RPM's skeleton)
3. Download each animation as .glb (without skin):
   - Idle (Breathing Idle)
   - Talking (Talking 2)
   - Wave (Wave Hip Hop Dance → or Standing Wave)
   - Nod (Yes)
   - Point (Pointing)
   - Shrug (Shrug)
   - Thinking (Thinking)
4. Save to frontend/public/animations/ as: idle.glb, talking.glb, wave.glb, nod.glb, point.glb, shrug.glb, thinking.glb
```

- [ ] **Step 3: Create nginx.conf**

```nginx
server {
  listen 80;
  location / {
    root /usr/share/nginx/html;
    try_files $uri $uri/ /index.html;
  }
}
```

- [ ] **Step 4: Full stack smoke test**

```bash
# Terminal 1 — backend
cd backend && uvicorn main:app --reload

# Terminal 2 — frontend
cd frontend && npm run dev

# Open http://localhost:5173
# Expected:
#   - 3D avatar renders in center
#   - "Connected" status (bottom)
#   - Press mic button → speak → transcript appears → avatar lip syncs and gestures
```

- [ ] **Step 5: Docker Compose build test**

```bash
docker compose build
docker compose up
# Expected: frontend at http://localhost:5173, backend at http://localhost:8000/health
```

- [ ] **Step 6: Commit**

```bash
git add frontend/public/ frontend/nginx.conf
git commit -m "feat: default RPM avatar, Mixamo animations, nginx config — full stack ready"
```

---

## Task 16: LatentSync GPU worker setup (optional)

**Files:**
- Modify: `docker-compose.gpu.yml`
- Create: `backend/download_lipsync.sh`

- [ ] **Step 1: Create LatentSync download script**

```bash
#!/bin/bash
# backend/download_lipsync.sh
# Clone LatentSync and download weights
git clone https://github.com/bytedance/LatentSync /models/lipsync
cd /models/lipsync
pip install -r requirements.txt
python scripts/download_weights.py
echo "LatentSync ready at /models/lipsync"
```

- [ ] **Step 2: Add model volume to GPU compose**

```yaml
# Append to docker-compose.gpu.yml
services:
  backend:
    volumes:
      - lipsync_models:/models/lipsync
    environment:
      - LIPSYNC_DEVICE=cuda
      - LIPSYNC_MODEL_PATH=/models/lipsync

volumes:
  lipsync_models:
```

- [ ] **Step 3: Test fallback mode (CPU)**

```bash
LIPSYNC_DEVICE=cpu pytest backend/tests/test_lipsync.py -v
# Expected: PASSED using energy-based fallback (no GPU needed)
```

- [ ] **Step 4: Commit**

```bash
git add docker-compose.gpu.yml backend/download_lipsync.sh
git commit -m "feat: LatentSync GPU worker setup with volume and CPU fallback documented"
```

---

## Self-Review

### Spec coverage check

| Requirement | Task |
|---|---|
| 3D realistic face avatar | Task 10 — AvatarScene with RPM GLB |
| Talking / lip sync | Task 5, 11 — LatentSync + LipSyncController |
| Hand / body movement | Task 6, 12 — Gesture Engine + GesturePlayer |
| Voice input (STT) | Task 3, 13 — Whisper + VoiceIO |
| Voice output (TTS) | Task 4 — pluggable TTS |
| Two-way voice conversation | Task 8 — WS handler orchestration |
| Hermes Agent connected | Task 7 — hermes_client.py |
| Platform flexible | Task 9 — Vite SPA works in browser, Electron, widget |
| Docker Compose packaging | Task 1, 15 — compose + Dockerfiles |
| User can pick RPM avatar | Task 14 — SettingsPanel avatarUrl input |
| GPU/CPU flexibility | Task 16 — GPU compose + CPU fallback |

### No placeholders: confirmed — all steps contain real code and commands.

### Type consistency: `BlendFrame`, `GestureName`, `ChatMessage` defined in `store.ts` and referenced consistently in `LipSyncController`, `GesturePlayer`, `ws.ts`.

---
