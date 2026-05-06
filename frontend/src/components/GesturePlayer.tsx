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

// Preload all animation GLBs up front
Object.values(ANIM_PATHS).forEach((path) => useGLTF.preload(path))

interface Props {
  scene: THREE.Group
  animations: THREE.AnimationClip[]
  groupRef: MutableRefObject<THREE.Group | null>
}

export default function GesturePlayer({ scene, groupRef }: Props) {
  const gesture = useStore((s) => s.currentGesture)
  const mixerRef = useRef<THREE.AnimationMixer | null>(null)
  const currentActionRef = useRef<THREE.AnimationAction | null>(null)

  // Call hooks individually — React forbids hooks inside loops or .map()
  const idle     = useGLTF(ANIM_PATHS.idle)
  const talking  = useGLTF(ANIM_PATHS.talking)
  const wave     = useGLTF(ANIM_PATHS.wave)
  const nod      = useGLTF(ANIM_PATHS.nod)
  const point    = useGLTF(ANIM_PATHS.point)
  const shrug    = useGLTF(ANIM_PATHS.shrug)
  const thinking = useGLTF(ANIM_PATHS.thinking)

  const glbs = { idle, talking, wave, nod, point, shrug, thinking } as
    Record<GestureName, { animations: THREE.AnimationClip[] }>

  useEffect(() => {
    if (!groupRef.current) return
    mixerRef.current = new THREE.AnimationMixer(scene)
    return () => { mixerRef.current?.stopAllAction() }
  }, [scene, groupRef])

  useEffect(() => {
    const mixer = mixerRef.current
    if (!mixer) return
    const rawClip = glbs[gesture]?.animations?.[0]
    if (!rawClip) return

    // Remap Mixamo bone names (mixamorig:Hips → Hips) to match RPM skeleton
    const clip = _retargetClip(rawClip)
    const action = mixer.clipAction(clip)

    if (currentActionRef.current && currentActionRef.current !== action) {
      currentActionRef.current.crossFadeTo(action, 0.4, true)
    }
    action.play()
    currentActionRef.current = action
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gesture])

  useFrame((_, delta) => { mixerRef.current?.update(delta) })

  return null
}

/**
 * Strips "mixamorig:" prefix from all track names so Mixamo clips work
 * with Ready Player Me's unprefixed bone names.
 */
function _retargetClip(clip: THREE.AnimationClip): THREE.AnimationClip {
  const remapped = clip.clone()
  remapped.tracks = clip.tracks.map((track) => {
    const t = track.clone()
    t.name = t.name.replace(/^mixamorig:/i, "")
    return t
  })
  return remapped
}
