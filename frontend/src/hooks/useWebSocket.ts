import { useStore } from "../store"
import { sendTextInput, sendAudioChunk, sendAudioEnd } from "../ws"

export function useWebSocket() {
  const connected = useStore((s) => s.connected)
  return { connected, sendTextInput, sendAudioChunk, sendAudioEnd }
}
