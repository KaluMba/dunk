import { Canvas } from '@react-three/fiber'
import { OrbitControls, CubeCamera, Text } from '@react-three/drei'
import { colors } from './theme'

function DunkText() {
  return (
    <Text
      position={[0, 0, -4]}
      fontSize={1.5}
      color="white"
      anchorX="center"
      anchorY="middle"
      letterSpacing={0.2}
    >
      dunk
    </Text>
  )
}

function MirrorCube() {
  return (
    <CubeCamera resolution={512} frames={Infinity}>
      {(texture) => (
        <mesh>
          <boxGeometry args={[2, 2, 2]} />
          <meshStandardMaterial envMap={texture} metalness={1} roughness={0} />
        </mesh>
      )}
    </CubeCamera>
  )
}

export default function App() {
  return (
    <Canvas camera={{ position: [4, 4, 4], fov: 50 }}>
      <color attach="background" args={[colors.background]} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 5]} intensity={1.2} />
      <pointLight position={[-10, -10, -5]} intensity={0.5} color={colors.accentLight} />
      <DunkText />
      <MirrorCube />
      <OrbitControls enableZoom autoRotate autoRotateSpeed={1.5} />
    </Canvas>
  )
}
