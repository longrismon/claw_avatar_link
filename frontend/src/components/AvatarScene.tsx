import { Canvas } from "@react-three/fiber"
import { Environment, OrbitControls, useGLTF } from "@react-three/drei"
import { Suspense, useEffect, useRef } from "react"
import * as THREE from "three"
import { useStore } from "../store"
import LipSyncController from "./LipSyncController"
import GesturePlayer from "./GesturePlayer"
import EmotionController from "./EmotionController"

function AvatarModel({ url }: { url: string }) {
  const { scene, animations } = useGLTF(url)
  const groupRef = useRef<THREE.Group>(null)
  const morphMeshes = useRef<THREE.SkinnedMesh[]>([])

  useEffect(() => {
    morphMeshes.current = []
    scene.traverse((child) => {
      const mesh = child as THREE.SkinnedMesh
      if (mesh.isSkinnedMesh && mesh.morphTargetDictionary) {
        morphMeshes.current.push(mesh)
      }
    })
  }, [scene])

  return (
    <group ref={groupRef} position={[0, -1.6, 0]}>
      <primitive object={scene} />
      <LipSyncController morphMeshes={morphMeshes} />
      <EmotionController morphMeshes={morphMeshes} />
      <GesturePlayer scene={scene} animations={animations} groupRef={groupRef} />
    </group>
  )
}

export default function AvatarScene() {
  const avatarUrl = useStore((s) => s.avatarUrl)
  const prevUrl = useRef(avatarUrl)

  // Evict old GLB from Three.js cache when avatar is swapped to free VRAM
  useEffect(() => {
    if (prevUrl.current !== avatarUrl) {
      useGLTF.clear(prevUrl.current)
      prevUrl.current = avatarUrl
    }
  }, [avatarUrl])

  return (
    <Canvas
      camera={{ position: [0, 0.2, 1.4], fov: 45 }}
      style={{ width: "100%", height: "100%", background: "transparent" }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[2, 4, 3]} intensity={1.2} />
      <Environment preset="city" />
      <Suspense fallback={null}>
        <AvatarModel url={avatarUrl} />
      </Suspense>
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        minPolarAngle={Math.PI / 3}
        maxPolarAngle={Math.PI / 1.8}
      />
    </Canvas>
  )
}
