import { useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import * as THREE from 'three'
import { colors } from './theme'

const SHOTS = [
  { position: new THREE.Vector3(0, 0, 7),    duration: 5, cut: false },
  { position: new THREE.Vector3(5, 2, 3),    duration: 4, cut: true  },
  { position: new THREE.Vector3(-3, 4, 3),   duration: 4, cut: false },
  { position: new THREE.Vector3(0, -4, 4),   duration: 3, cut: true  },
  { position: new THREE.Vector3(0.5, 0, 2),  duration: 5, cut: false },
  { position: new THREE.Vector3(-6, 1, 5),   duration: 4, cut: true  },
]

const target = new THREE.Vector3(0, 0, 0)

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
}

function CinematicCamera() {
  const { camera } = useThree()
  const shotIndex = useRef(0)
  const elapsed = useRef(0)
  const origin = useRef(new THREE.Vector3(0, 0, 7))

  useFrame((_, delta) => {
    const shot = SHOTS[shotIndex.current]
    elapsed.current += delta

    const t = easeInOut(Math.min(elapsed.current / shot.duration, 1))
    camera.position.lerpVectors(origin.current, shot.position, t)
    camera.lookAt(target)

    if (elapsed.current >= shot.duration) {
      const next = SHOTS[(shotIndex.current + 1) % SHOTS.length]
      origin.current = next.cut ? next.position.clone() : camera.position.clone()
      shotIndex.current = (shotIndex.current + 1) % SHOTS.length
      elapsed.current = 0
    }
  })

  return null
}

function Cube() {
  const meshRef = useRef()

  useFrame((_, delta) => {
    if (!meshRef.current) return
    meshRef.current.rotation.y += delta * 0.3
    meshRef.current.rotation.x += delta * 0.1
  })

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[2, 2, 2]} />
      <meshStandardMaterial metalness={1} roughness={0} />
    </mesh>
  )
}

export default function App() {
  return (
    <Canvas camera={{ position: [0, 0, 7], fov: 50 }}>
      <color attach="background" args={[colors.background]} />
      <Environment preset="city" />
      <CinematicCamera />
      <Cube />
    </Canvas>
  )
}
