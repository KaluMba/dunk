import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { CubeCamera } from '@react-three/drei'
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
    <CubeCamera resolution={512} frames={Infinity}>
      {(texture) => (
        <mesh ref={meshRef}>
          <boxGeometry args={[2, 2, 2]} />
          <meshStandardMaterial envMap={texture} metalness={1} roughness={0} />
        </mesh>
      )}
    </CubeCamera>
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
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 10, 5]} intensity={1.2} />
        <pointLight position={[-10, -10, -5]} intensity={0.5} color={colors.accentLight} />
        <MirrorCube mouseRef={mouseRef} />
      </Canvas>
    </div>
  )
}
