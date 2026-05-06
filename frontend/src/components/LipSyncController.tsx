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
    if (audioStartTime === null || blendFrames.length === 0) return
    // audioStartTime is performance.now() (ms) — same time domain
    const elapsedMs = performance.now() - audioStartTime
    const weights = _interpolateWeights(blendFrames, elapsedMs)

    for (const mesh of morphMeshes.current) {
      const dict = mesh.morphTargetDictionary
      const influences = mesh.morphTargetInfluences
      if (!dict || !influences) continue
      for (const [name, weight] of Object.entries(weights)) {
        const idx = dict[name]
        if (idx !== undefined) influences[idx] = weight
      }
    }
  })

  return null
}

function _interpolateWeights(frames: BlendFrame[], elapsedMs: number): Record<string, number> {
  if (frames.length === 0) return {}

  // Find the last frame at or before elapsedMs
  let i = frames.length - 1
  for (let j = 0; j < frames.length; j++) {
    if (frames[j].time_ms > elapsedMs) { i = j - 1; break }
  }

  if (i < 0) return frames[0].weights
  if (i >= frames.length - 1) return frames[i].weights

  const a = frames[i]
  const b = frames[i + 1]
  const span = b.time_ms - a.time_ms
  const t = span > 0 ? (elapsedMs - a.time_ms) / span : 0

  const out: Record<string, number> = { ...a.weights }
  for (const key of Object.keys(b.weights)) {
    const wa = a.weights[key] ?? 0
    const wb = b.weights[key] ?? 0
    out[key] = wa + (wb - wa) * t
  }
  return out
}
