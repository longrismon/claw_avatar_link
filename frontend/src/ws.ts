import { useStore } from "./store"

const WS_URL = (import.meta as Record<string, Record<string, string>>).env?.VITE_WS_URL ?? "ws://localhost:8000/ws"

const BACKOFF_MS = [1000, 2000, 4000, 8000, 16000, 30000]
let _retryCount = 0

let socket: WebSocket | null = null
const audioQueue: ArrayBuffer[] = []
let audioCtx: AudioContext | null = null

export function connectWS() {
  if (socket?.readyState === WebSocket.OPEN) return
  socket = new WebSocket(WS_URL)

  socket.onopen = () => {
    _retryCount = 0
    useStore.getState().setConnected(true)
  }

  socket.onclose = () => {
    useStore.getState().setConnected(false)
    const delay = BACKOFF_MS[Math.min(_retryCount, BACKOFF_MS.length - 1)]
    _retryCount++
    setTimeout(connectWS, delay)
  }

  socket.onmessage = (event) => handleMessage(JSON.parse(event.data as string))
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
      store.setGesture(msg.name as ReturnType<typeof store.setGesture> extends (g: infer G) => void ? G : never)
      break
    case "emotion":
      store.setEmotion(msg.name as ReturnType<typeof store.setEmotion> extends (e: infer E) => void ? E : never)
      break
    case "audio_start":
      audioQueue.length = 0
      break
    case "audio_chunk": {
      const bytes = Uint8Array.from(atob(msg.data as string), (c) => c.charCodeAt(0))
      audioQueue.push(bytes.buffer)
      break
    }
    case "blend_frames":
      store.setBlendFrames(msg.frames as Parameters<typeof store.setBlendFrames>[0])
      _playAudioAndSetStartTime()
      break
    case "error":
      store.setAgentThinking(false)
      store.appendMessage({ role: "assistant", text: `⚠ ${msg.message as string}` })
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
  // Store performance.now() (ms) so LipSyncController uses the same time domain
  useStore.getState().setAudioStartTime(performance.now())
  source.start()
  source.onended = () => {
    useStore.getState().setAudioStartTime(null)
    useStore.getState().setGesture("idle")
  }
}

function _mergeBuffers(buffers: ArrayBuffer[]): ArrayBuffer {
  const total = buffers.reduce((n, b) => n + b.byteLength, 0)
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

export function sendSettingsUpdate(s: Record<string, unknown>) {
  socket?.send(JSON.stringify({ type: "settings_update", settings: s }))
}
