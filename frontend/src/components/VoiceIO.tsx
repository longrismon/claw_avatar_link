import { useRef, useState } from "react"
import { sendAudioChunk, sendAudioEnd } from "../ws"
import { useStore } from "../store"

const SILENCE_THRESHOLD = 0.01
const SILENCE_DURATION_MS = 1200

function micErrorMessage(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === "NotAllowedError") return "Microphone access denied — check browser permissions."
    if (err.name === "NotFoundError") return "No microphone found — plug one in and try again."
    if (err.name === "NotReadableError") return "Microphone is in use by another app."
  }
  return "Could not access microphone."
}

export default function VoiceIO() {
  const [listening, setListening] = useState(false)
  const [micError, setMicError] = useState<string | null>(null)
  const connected = useStore((s) => s.connected)
  const mediaRef = useRef<MediaRecorder | null>(null)
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef<number>(0)

  async function startListening() {
    setMicError(null)
    try {
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

      recorder.start(250)
      setListening(true)
      _monitorSilence()
    } catch (err) {
      setMicError(micErrorMessage(err))
    }
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
        if (silenceTimer.current) {
          clearTimeout(silenceTimer.current)
          silenceTimer.current = null
        }
      }
      animFrameRef.current = requestAnimationFrame(tick)
    }
    tick()
  }

  function stopListening() {
    cancelAnimationFrame(animFrameRef.current)
    if (silenceTimer.current) { clearTimeout(silenceTimer.current); silenceTimer.current = null }
    mediaRef.current?.stop()
    sendAudioEnd()
    setListening(false)
  }

  const statusText = micError
    ? micError
    : !connected
    ? "Connecting…"
    : listening
    ? "Listening…"
    : "Press to speak"

  const statusColor = micError ? "#e24b4a" : "var(--color-text-secondary)"

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={listening ? stopListening : startListening}
          disabled={!connected || !!micError}
          style={{
            width: 56, height: 56, borderRadius: "50%",
            background: listening ? "#e24b4a" : micError ? "#555" : "#1d9e75",
            border: "none", cursor: connected && !micError ? "pointer" : "not-allowed",
            color: "#fff", fontSize: 22,
          }}
          title={listening ? "Stop" : micError ? micError : "Speak"}
        >
          {listening ? "■" : "🎙"}
        </button>
        <span style={{ fontSize: 13, color: statusColor, maxWidth: 220 }}>
          {statusText}
        </span>
      </div>
      {micError && (
        <button
          onClick={() => setMicError(null)}
          style={{
            fontSize: 12, background: "none", border: "none",
            color: "rgba(255,255,255,0.5)", cursor: "pointer", textDecoration: "underline",
          }}
        >
          Dismiss
        </button>
      )}
    </div>
  )
}
