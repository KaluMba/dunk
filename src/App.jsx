import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { colors } from './theme'

function Cube() {
  return (
    <mesh>
      <boxGeometry args={[2, 2, 2]} />
      <meshStandardMaterial color={colors.accent} roughness={0.3} metalness={0.6} />
    </mesh>
  )
}

export default function App() {
  return (
    <Canvas camera={{ position: [4, 4, 4], fov: 50 }}>
      <color attach="background" args={[colors.background]} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 5]} intensity={1.2} />
      <pointLight position={[-10, -10, -5]} intensity={0.5} color={colors.accentLight} />
      <Cube />
      <OrbitControls enableZoom autoRotate autoRotateSpeed={1.5} />
    </Canvas>
  )
}
