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
    // audioStartTime is performance.now() (ms) — same domain as performance.now() here
    const elapsedMs = performance.now() - audioStartTime
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
