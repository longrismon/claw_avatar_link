import { useStore } from "../store"

/**
 * Returns elapsed playback time in milliseconds since TTS audio started,
 * or null if nothing is playing. Uses performance.now() — the same time
 * domain used when audioStartTime is stored in ws.ts.
 */
export function useCurrentAudioTime(): number | null {
  const audioStartTime = useStore((s) => s.audioStartTime)
  if (audioStartTime === null) return null
  return performance.now() - audioStartTime
}
