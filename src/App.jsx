import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'

function Cube() {
  return (
    <mesh>
      <boxGeometry args={[2, 2, 2]} />
      <meshStandardMaterial color="#4a9eff" roughness={0.3} metalness={0.6} />
    </mesh>
  )
}

export default function App() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0a0a0a' }}>
      <Canvas camera={{ position: [4, 4, 4], fov: 50 }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 10, 5]} intensity={1.2} />
        <pointLight position={[-10, -10, -5]} intensity={0.5} color="#a0c4ff" />
        <Cube />
        <OrbitControls enableZoom={true} autoRotate={true} autoRotateSpeed={1.5} />
      </Canvas>
    </div>
  )
}
