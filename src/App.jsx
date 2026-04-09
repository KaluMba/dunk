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

// Each shot: start = camera teleports here on cut (null = continue from current)
//            end   = camera smoothly drifts to here
//            look  = what the camera looks at
const SHOTS = [
  { start: [0, 22, 30],    end: [0, 14, 18],   look: [0, 0, 0],  duration: 6 },
  { start: [10, 2.5, 14],  end: [4, 2.5, 7],   look: [0, 2, 0],  duration: 5, cut: true },
  { start: null,            end: [-10, 5, 2],   look: [0, 3, 0],  duration: 5 },
  { start: [1, 28, 1],      end: [1, 18, 1],    look: [0, 0, 0],  duration: 4, cut: true },
  { start: null,            end: [20, 9, -8],   look: [0, 2, 0],  duration: 5 },
  { start: [-6, 2, 12],     end: [-1, 2, 5],    look: [0, 3, 0],  duration: 4, cut: true },
]

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
}

function CinematicCamera() {
  const { camera } = useThree()
  const index = useRef(0)
  const elapsed = useRef(0)
  const origin = useRef(new THREE.Vector3(...SHOTS[0].start))
  const lookAt = useRef(new THREE.Vector3(...SHOTS[0].look))

  useFrame((_, delta) => {
    const shot = SHOTS[index.current]
    elapsed.current += delta
    const t = easeInOut(Math.min(elapsed.current / shot.duration, 1))
    camera.position.lerpVectors(origin.current, new THREE.Vector3(...shot.end), t)
    camera.lookAt(lookAt.current)

    if (elapsed.current >= shot.duration) {
      const next = SHOTS[(index.current + 1) % SHOTS.length]
      if (next.cut && next.start) {
        origin.current.set(...next.start)
        camera.position.set(...next.start)
      } else {
        origin.current.copy(camera.position)
      }
      lookAt.current.set(...next.look)
      index.current = (index.current + 1) % SHOTS.length
      elapsed.current = 0
    }
  })

  return null
}

export default function App() {
  return (
    <div className="letterbox" style={{ width: '100dvw', height: '100dvh' }}>
      <Canvas shadows camera={{ position: [0, 22, 30], fov: 60 }}>
        <color attach="background" args={[colors.background]} />
        <fog attach="fog" color={colors.background} near={35} far={70} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[20, 30, 10]} intensity={1.5} castShadow />
        <CinematicCamera />
        <Terrain />
        {TREES.map((t, i) => <Tree key={i} x={t.x} z={t.z} />)}
      </Canvas>
    </div>
  )
}
