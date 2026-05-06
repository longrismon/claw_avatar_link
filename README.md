# Hermes Avatar (claw_avatar_link)

An open-source, self-hosted 3D avatar assistant for the Hermes Agent (OpenClaw) — with a realistic talking face, AI-driven lip sync, full-body gestures, and two-way voice conversation. Ships as Docker Compose.

---

## Features

- **3D avatar** — Ready Player Me `.glb` model rendered with React Three Fiber
- **Lip sync** — LatentSync inference with an energy-based fallback (no GPU required)
- **Body gestures** — Mixamo animation clips cross-faded by intent (wave, nod, point, shrug, thinking, talking, idle)
- **Voice input** — Browser mic capture with voice-activity detection (VAD) silence auto-stop
- **Voice output** — Pluggable TTS: Coqui (default, local), ElevenLabs, or OpenAI
- **Speech-to-text** — OpenAI Whisper (runs locally)
- **Hermes Agent** — Connects to any Hermes-compatible REST API
- **WebSocket** — Single persistent connection for all frontend ↔ backend communication
- **Docker Compose** — One command to run everything; GPU override for LatentSync

---

## Architecture

```
Browser
  └── React 18 + React Three Fiber (Vite SPA)
        ├── AvatarScene      — R3F canvas, RPM GLB, lights, orbit controls
        ├── LipSyncController — applies LatentSync blend shapes to morph targets
        ├── GesturePlayer    — Mixamo animation cross-fader
        ├── VoiceIO          — mic capture + VAD + audio playback
        ├── ChatOverlay      — floating transcript UI
        └── SettingsPanel    — avatar URL + text input fallback

        WebSocket ws://localhost:8000/ws
        │
FastAPI backend
  ├── stt.py          — Whisper STT
  ├── tts.py          — pluggable TTS (Coqui / ElevenLabs / OpenAI) → WAV
  ├── lipsync.py      — LatentSync inference → blend shape keyframes
  ├── gesture.py      — intent text → animation name
  ├── hermes_client.py — REST client to Hermes Agent API
  └── ws_handler.py   — WebSocket message router
```

---

## Quick Start

### Prerequisites

- Docker and Docker Compose v2
- A Ready Player Me avatar `.glb` (see [Avatar setup](#avatar-setup))
- Mixamo animation clips (see [Animation setup](#animation-setup))

### 1. Clone and configure

```bash
git clone https://github.com/longrismon/claw_avatar_link.git
cd claw_avatar_link
cp .env.example .env
# Edit .env — set HERMES_API_URL and TTS_PROVIDER at minimum
```

### 2. Add avatar and animations

```
frontend/public/avatars/hermes-default.glb   ← your RPM avatar
frontend/public/animations/idle.glb
frontend/public/animations/talking.glb
frontend/public/animations/wave.glb
frontend/public/animations/nod.glb
frontend/public/animations/point.glb
frontend/public/animations/shrug.glb
frontend/public/animations/thinking.glb
```

### 3. Run

```bash
docker compose up --build
```

| Service  | URL                          |
|----------|------------------------------|
| Frontend | http://localhost:5173         |
| Backend  | http://localhost:8000/health  |

### GPU (LatentSync)

```bash
# Download model weights first
docker compose run --rm backend bash /app/download_lipsync.sh

# Then run with GPU override
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up
```

---

## Avatar Setup

1. Go to [readyplayer.me](https://readyplayer.me) and create a free avatar.
2. Export as `.glb` with ARKit morph targets:
   ```
   https://models.readyplayer.me/<your-id>.glb?morphTargets=ARKit
   ```
3. Save to `frontend/public/avatars/hermes-default.glb`.

You can also swap avatars at runtime via the Settings panel in the UI.

---

## Animation Setup

1. Go to [mixamo.com](https://www.mixamo.com) and sign in.
2. Upload any character (the skeleton is discarded — only animation data is used).
3. Download each clip as `.glb` **without skin**:

| File | Suggested Mixamo clip |
|------|-----------------------|
| `idle.glb` | Breathing Idle |
| `talking.glb` | Talking (Talking 2) |
| `wave.glb` | Standing Wave |
| `nod.glb` | Yes |
| `point.glb` | Pointing |
| `shrug.glb` | Shrug |
| `thinking.glb` | Thinking |

4. Place all files in `frontend/public/animations/`.

---

## Configuration

All settings are controlled via `.env` (copy from `.env.example`):

| Variable | Default | Description |
|----------|---------|-------------|
| `HERMES_API_URL` | `http://localhost:7000` | Hermes Agent base URL |
| `HERMES_API_KEY` | _(empty)_ | Bearer token if required |
| `TTS_PROVIDER` | `coqui` | `coqui` \| `elevenlabs` \| `openai` |
| `ELEVENLABS_API_KEY` | _(empty)_ | ElevenLabs API key |
| `ELEVENLABS_VOICE_ID` | _(empty)_ | ElevenLabs voice ID |
| `OPENAI_API_KEY` | _(empty)_ | OpenAI API key (for TTS or Whisper) |
| `WHISPER_MODEL` | `base` | `tiny` \| `base` \| `small` \| `medium` \| `large` |
| `LIPSYNC_DEVICE` | `cpu` | `cpu` \| `cuda` |
| `LIPSYNC_MODEL_PATH` | `/models/lipsync` | Path to LatentSync weights |
| `DEFAULT_AVATAR_URL` | _(empty)_ | Override bundled avatar with a URL |

---

## Development

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

Run tests:

```bash
pytest tests/test_gesture.py tests/test_lipsync.py tests/test_ws_handler.py -v
# Note: test_stt.py and test_tts.py download models on first run (~100-300 MB)
```

### Frontend

```bash
cd frontend
npm install
npm run dev       # http://localhost:5173
npm run build     # production build
```

---

## WebSocket Protocol

All messages are JSON over `ws://localhost:8000/ws`.

**Frontend → Backend**

| `type` | Fields | Description |
|--------|--------|-------------|
| `audio_chunk` | `data: string` (base64) | Streaming mic audio |
| `audio_end` | — | End of user speech; triggers STT |
| `text_input` | `text: string` | Typed message fallback |
| `settings_update` | `settings` | Update runtime settings |

**Backend → Frontend**

| `type` | Fields | Description |
|--------|--------|-------------|
| `ready` | `session_id` | Connection established |
| `transcript` | `text` | STT result |
| `agent_thinking` | — | Hermes is processing |
| `agent_reply` | `text` | Hermes text response |
| `audio_start` | `duration_ms` | TTS audio about to stream |
| `audio_chunk` | `data` (base64 WAV) | TTS audio chunk |
| `blend_frames` | `frames: BlendFrame[]` | Lip sync keyframes |
| `gesture` | `name` | Animation trigger |
| `error` | `message` | Error details |

---

## License

Apache 2.0 — see [LICENSE](LICENSE).
