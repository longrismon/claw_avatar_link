import { useFrame } from "@react-three/fiber"
import { MutableRefObject, useRef } from "react"
import * as THREE from "three"
import { useStore, EmotionName } from "../store"

interface Props {
  morphMeshes: MutableRefObject<THREE.SkinnedMesh[]>
}

// ARKit morph target weights for each emotion
const EMOTION_TARGETS: Record<EmotionName, Record<string, number>> = {
  neutral:   {},
  happy:     { mouthSmileLeft: 0.7, mouthSmileRight: 0.7, cheekSquintLeft: 0.4, cheekSquintRight: 0.4 },
  sad:       { mouthFrownLeft: 0.6, mouthFrownRight: 0.6, browInnerUp: 0.5 },
  surprised: { eyeWideLeft: 0.8, eyeWideRight: 0.8, browOuterUpLeft: 0.6, browOuterUpRight: 0.6, jawOpen: 0.3 },
  angry:     { browDownLeft: 0.7, browDownRight: 0.7, noseSneerLeft: 0.4, noseSneerRight: 0.4 },
  thinking:  { browInnerUp: 0.4 },
}

const FADE_SPEED = 1 / 0.4  // reach target in 0.4s

export default function EmotionController({ morphMeshes }: Props) {
  const currentEmotion = useStore((s) => s.currentEmotion)
  // Track current lerped weights independently per morph target key
  const lerpedWeights = useRef<Record<string, number>>({})

  useFrame((_, delta) => {
    const target = EMOTION_TARGETS[currentEmotion]
    const lerped = lerpedWeights.current

    // Collect all keys that need updating (union of current and target)
    const allKeys = new Set([...Object.keys(lerped), ...Object.keys(target)])

    for (const key of allKeys) {
      const to = target[key] ?? 0
      const from = lerped[key] ?? 0
      if (Math.abs(to - from) < 0.001) {
        lerped[key] = to
      } else {
        lerped[key] = from + (to - from) * Math.min(delta * FADE_SPEED, 1)
      }
    }

    // Apply to all morph meshes — uses different keys than LipSyncController so no conflict
    for (const mesh of morphMeshes.current) {
      const dict = mesh.morphTargetDictionary
      const influences = mesh.morphTargetInfluences
      if (!dict || !influences) continue
      for (const [name, weight] of Object.entries(lerped)) {
        const idx = dict[name]
        if (idx !== undefined) influences[idx] = weight
      }
    }
  })

  return null
}
