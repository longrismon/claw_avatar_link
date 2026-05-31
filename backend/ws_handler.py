import asyncio
import base64
import io
import json
import uuid
import wave

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from config import settings
from emotion_detector import text_to_emotion
from gesture import intent_to_gesture
from hermes_client import send_message
from lipsync import audio_to_blend_frames
from memory import add_turn, get_history, clear_session
from stt import transcribe_pcm
from tts import synthesize

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
        clear_session(session_id)


async def _handle(ws: WebSocket, msg: dict, session_id: str, audio_buffer: bytearray):
    t = msg.get("type")

    if t == "audio_chunk":
        chunk = base64.b64decode(msg["data"])
        if len(audio_buffer) + len(chunk) > settings.max_audio_bytes:
            audio_buffer.clear()
            await ws.send_json({"type": "error", "message": "Audio too long — max 10 MB per utterance."})
            return
        audio_buffer.extend(chunk)

    elif t == "audio_end":
        pcm = bytes(audio_buffer)
        audio_buffer.clear()
        transcript = await transcribe_pcm(pcm)
        if not transcript:
            return
        await ws.send_json({"type": "transcript", "text": transcript})
        add_turn(session_id, "user", transcript)
        await _run_agent_pipeline(ws, transcript, session_id)

    elif t == "text_input":
        text = msg.get("text", "").strip()
        if not text:
            return
        if len(text) > settings.max_text_length:
            await ws.send_json({"type": "error", "message": f"Message too long — max {settings.max_text_length} characters."})
            return
        await ws.send_json({"type": "transcript", "text": text})
        add_turn(session_id, "user", text)
        await _run_agent_pipeline(ws, text, session_id)

    elif t == "settings_update":
        s = msg.get("settings", {})
        if s.get("clear_memory"):
            clear_session(session_id)
        if "language" in s:
            settings.language = s["language"]


async def _run_agent_pipeline(ws: WebSocket, text: str, session_id: str):
    """Shared pipeline: Hermes → TTS → stream audio + blend frames."""
    await ws.send_json({"type": "agent_thinking"})

    try:
        history = get_history(session_id)
        reply_text = await send_message(text, session_id, history=history)
    except Exception as exc:
        await ws.send_json({"type": "error", "message": f"Hermes Agent unavailable: {exc}"})
        return

    add_turn(session_id, "assistant", reply_text)
    await ws.send_json({"type": "agent_reply", "text": reply_text})

    emotion = text_to_emotion(reply_text)
    await ws.send_json({"type": "emotion", "name": emotion})

    gesture = intent_to_gesture(reply_text)
    await ws.send_json({"type": "gesture", "name": gesture})

    audio_wav = await synthesize(reply_text)
    duration_ms = _wav_duration_ms(audio_wav)
    await ws.send_json({"type": "audio_start", "duration_ms": duration_ms})

    chunk_size = 4096
    for i in range(0, len(audio_wav), chunk_size):
        chunk = audio_wav[i:i + chunk_size]
        await ws.send_json({"type": "audio_chunk", "data": base64.b64encode(chunk).decode()})

    frames = await audio_to_blend_frames(audio_wav)
    frames_json = [{"time_ms": f.time_ms, "weights": f.weights} for f in frames]
    await ws.send_json({"type": "blend_frames", "frames": frames_json})

    # Return to idle after playback finishes
    asyncio.create_task(_delayed_idle(ws, duration_ms))


async def _delayed_idle(ws: WebSocket, duration_ms: int) -> None:
    await asyncio.sleep(duration_ms / 1000)
    try:
        await ws.send_json({"type": "gesture", "name": "idle"})
    except Exception:
        pass  # client disconnected before playback finished


def _wav_duration_ms(wav_bytes: bytes) -> int:
    """Read duration from WAV header; works for all TTS backends."""
    try:
        with wave.open(io.BytesIO(wav_bytes)) as wf:
            return int(wf.getnframes() / wf.getframerate() * 1000)
    except Exception:
        return 0
