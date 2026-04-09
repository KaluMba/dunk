import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import { colors } from './theme'

function MirrorCube({ mouseRef }) {
  const meshRef = useRef()

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh) return
    mesh.rotation.x += (mouseRef.current.y * 0.8 - mesh.rotation.x) * 0.05
    mesh.rotation.y += (mouseRef.current.x * 0.8 - mesh.rotation.y) * 0.05
  })

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[2, 2, 2]} />
      <meshStandardMaterial metalness={1} roughness={0} />
    </mesh>
  )
}

export default function App() {
  const mouseRef = useRef({ x: 0, y: 0 })

  const onMouseMove = (e) => {
    mouseRef.current = {
      x: (e.clientX / window.innerWidth - 0.5) * 2,
      y: -(e.clientY / window.innerHeight - 0.5) * 2,
    }
  }

  return (
    <div style={{ width: '100dvw', height: '100dvh' }} onMouseMove={onMouseMove}>
      <Canvas camera={{ position: [0, 0, 5], fov: 50 }} gl={{ alpha: true }}>
        <color attach="background" args={[colors.background]} />
        <Environment preset="city" />
        <MirrorCube mouseRef={mouseRef} />
      </Canvas>
    </div>
  )
}
