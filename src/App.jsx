import { useRef, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { colors } from './theme'

function heightAt(x, z) {
  return (
    Math.sin(x * 0.15) * Math.cos(z * 0.15) * 4 +
    Math.sin(x * 0.4 + 1) * Math.cos(z * 0.3) * 2 +
    Math.sin(x * 0.8) * Math.cos(z * 0.6) * 0.8
  )
}

function Terrain() {
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(80, 80, 80, 80)
    geo.rotateX(-Math.PI / 2)
    const pos = geo.attributes.position
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)))
    }
    geo.computeVertexNormals()
    return geo
  }, [])

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial color={colors.terrain} roughness={1} />
    </mesh>
  )
}

function Tree({ x, z }) {
  const y = heightAt(x, z)
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 0.25, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.12, 0.5, 5]} />
        <meshStandardMaterial color={colors.treeTrunk} roughness={1} />
      </mesh>
      <mesh position={[0, 1.2, 0]} castShadow>
        <coneGeometry args={[0.6, 2, 6]} />
        <meshStandardMaterial color={colors.treeDark} roughness={1} />
      </mesh>
      <mesh position={[0, 2.1, 0]} castShadow>
        <coneGeometry args={[0.4, 1.5, 6]} />
        <meshStandardMaterial color={colors.treeLight} roughness={1} />
      </mesh>
    </group>
  )
}

const TREES = Array.from({ length: 40 }, (_, i) => {
  const angle = (i / 40) * Math.PI * 2
  const r = 6 + (i % 6) * 3.5
  return { x: Math.cos(angle + i) * r, z: Math.sin(angle + i) * r }
})

const SHOTS = [
  { position: new THREE.Vector3(0, 12, 25),   duration: 6, cut: false },
  { position: new THREE.Vector3(12, 4, 8),    duration: 5, cut: true  },
  { position: new THREE.Vector3(-10, 7, -5),  duration: 5, cut: false },
  { position: new THREE.Vector3(0, 3, 2),     duration: 4, cut: true  },
  { position: new THREE.Vector3(20, 9, -10),  duration: 5, cut: false },
  { position: new THREE.Vector3(-5, 15, 5),   duration: 4, cut: true  },
]

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
}

const lookAt = new THREE.Vector3(0, 2, 0)

function CinematicCamera() {
  const { camera } = useThree()
  const index = useRef(0)
  const elapsed = useRef(0)
  const origin = useRef(SHOTS[0].position.clone())

  useFrame((_, delta) => {
    const shot = SHOTS[index.current]
    elapsed.current += delta
    const t = easeInOut(Math.min(elapsed.current / shot.duration, 1))
    camera.position.lerpVectors(origin.current, shot.position, t)
    camera.lookAt(lookAt)

    if (elapsed.current >= shot.duration) {
      const next = SHOTS[(index.current + 1) % SHOTS.length]
      origin.current = next.cut ? next.position.clone() : camera.position.clone()
      index.current = (index.current + 1) % SHOTS.length
      elapsed.current = 0
    }
  })

  return null
}

export default function App() {
  return (
    <Canvas shadows camera={{ position: [0, 12, 25], fov: 60 }}>
      <color attach="background" args={[colors.background]} />
      <fog attach="fog" color={colors.background} near={35} far={70} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[20, 30, 10]} intensity={1.5} castShadow />
      <CinematicCamera />
      <Terrain />
      {TREES.map((t, i) => <Tree key={i} x={t.x} z={t.z} />)}
    </Canvas>
  )
}
