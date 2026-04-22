import { useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { OrbitControls, Environment, Float } from "@react-three/drei"
import type { Mesh } from "three"

function SpinningBook() {
  const ref = useRef<Mesh>(null)

  useFrame((_, delta) => {
    if (!ref.current) return
    ref.current.rotation.y += delta * 0.4
  })

  return (
    <Float speed={1.5} rotationIntensity={0.4} floatIntensity={0.6}>
      <mesh ref={ref} castShadow receiveShadow>
        <boxGeometry args={[2, 2.6, 0.35]} />
        <meshStandardMaterial
          color="#6d28d9"
          roughness={0.4}
          metalness={0.15}
        />
      </mesh>
    </Float>
  )
}

export function Scene() {
  return (
    <>
      <ambientLight intensity={0.45} />
      <directionalLight
        position={[5, 8, 4]}
        intensity={1.1}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <SpinningBook />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
      <Environment preset="city" />
      <OrbitControls enablePan={false} minDistance={3} maxDistance={10} />
    </>
  )
}
