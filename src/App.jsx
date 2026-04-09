import { useRef, useMemo, useState, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { PALETTES, LIGHTINGS, FOGS, RENDER_MODES } from './theme'
import { startMusic } from './music'

function heightAt(x, z) {
  return (
    Math.sin(x * 0.15) * Math.cos(z * 0.15) * 4 +
    Math.sin(x * 0.4 + 1) * Math.cos(z * 0.3) * 2 +
    Math.sin(x * 0.8) * Math.cos(z * 0.6) * 0.8
  )
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }

function randomVariant() {
  return {
    renderMode: pick(RENDER_MODES),
    palette:    pick(PALETTES),
    lighting:   pick(LIGHTINGS),
    fog:        pick(FOGS),
  }
}

function Terrain({ renderMode, palette }) {
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(80, 80, 80, 80)
    geo.rotateX(-Math.PI / 2)
    const pos = geo.attributes.position
    const vColors = new Float32Array(pos.count * 3)
    for (let i = 0; i < pos.count; i++) {
      const y = heightAt(pos.getX(i), pos.getZ(i))
      pos.setY(i, y)
      // height gradient: deep blue (low) → green (mid) → snow white (high)
      const t = Math.max(0, Math.min(1, (y + 5) / 10))
      vColors[i * 3]     = t > 0.6 ? (t - 0.6) * 2.5 * 0.9 : 0.04
      vColors[i * 3 + 1] = t < 0.6 ? t * 0.65 : 0.39 + (t - 0.6) * 0.8
      vColors[i * 3 + 2] = t < 0.4 ? 0.28 + t * 0.4 : Math.max(0, (0.8 - t) * 0.6)
    }
    geo.setAttribute('color', new THREE.BufferAttribute(vColors, 3))
    geo.computeVertexNormals()
    return geo
  }, [])

  if (renderMode === 'wireframe') return (
    <mesh geometry={geometry}>
      <meshBasicMaterial color={palette.wire} wireframe />
    </mesh>
  )
  if (renderMode === 'polygon') return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color={palette.terrain} flatShading roughness={0.9} />
    </mesh>
  )
  if (renderMode === 'height') return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.7} />
    </mesh>
  )
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial color={palette.terrain} roughness={1} />
    </mesh>
  )
}

function Tree({ x, z, renderMode, palette }) {
  const y = heightAt(x, z)
  const isWire   = renderMode === 'wireframe'
  const isHeight = renderMode === 'height'
  const isPoly   = renderMode === 'polygon'

  const trunk = isWire ? palette.wire : isHeight ? '#555' : palette.trunk
  const dark  = isWire ? palette.wire : isHeight ? '#888' : palette.dark
  const light = isWire ? palette.wire : isHeight ? '#aaa' : palette.light

  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 0.25, 0]} castShadow={!isWire}>
        <cylinderGeometry args={[0.08, 0.12, 0.5, 5]} />
        <meshStandardMaterial color={trunk} wireframe={isWire} roughness={1} flatShading={isPoly} />
      </mesh>
      <mesh position={[0, 1.2, 0]} castShadow={!isWire}>
        <coneGeometry args={[0.6, 2, 6]} />
        <meshStandardMaterial color={dark} wireframe={isWire} roughness={1} flatShading={isPoly} />
      </mesh>
      <mesh position={[0, 2.1, 0]} castShadow={!isWire}>
        <coneGeometry args={[0.4, 1.5, 6]} />
        <meshStandardMaterial color={light} wireframe={isWire} roughness={1} flatShading={isPoly} />
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
  { start: [0, 32, 42],   end: [0, 18, 25],    look: [0, 0, 0],   duration: 10 },
  { start: [14, 1.8, 18], end: [6, 1.8, 9],    look: [0, 1.5, 0], duration: 9, cut: true },
  { start: null,           end: [-16, 4, 1],   look: [0, 2, 0],   duration: 9 },
  { start: [2, 40, 2],     end: [2, 24, 2],     look: [0, 0, 0],   duration: 9, cut: true },
  { start: null,           end: [28, 11, -12], look: [0, 1, 0],   duration: 10 },
  { start: [-9, 1.5, 16], end: [-3, 1.5, 7],  look: [0, 3.5, 0], duration: 8, cut: true },
]

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
}

function CinematicCamera() {
  const { camera } = useThree()
  const index = useRef(0)
  const elapsed = useRef(0)
  const origin = useRef(new THREE.Vector3(...SHOTS[0].start))
  const target = useRef(new THREE.Vector3(...SHOTS[0].look))

  useFrame((_, delta) => {
    const shot = SHOTS[index.current]
    elapsed.current += delta
    const t = easeInOut(Math.min(elapsed.current / shot.duration, 1))
    camera.position.lerpVectors(origin.current, new THREE.Vector3(...shot.end), t)
    camera.lookAt(target.current)

    if (elapsed.current >= shot.duration) {
      const next = SHOTS[(index.current + 1) % SHOTS.length]
      if (next.cut && next.start) {
        origin.current.set(...next.start)
        camera.position.set(...next.start)
      } else {
        origin.current.copy(camera.position)
      }
      target.current.set(...next.look)
      index.current = (index.current + 1) % SHOTS.length
      elapsed.current = 0
    }
  })

  return null
}

export default function App() {
  const [variant, setVariant] = useState(randomVariant)
  const musicStarted = useRef(false)

  const handleClick = useCallback(() => {
    if (!musicStarted.current) {
      startMusic()
      musicStarted.current = true
    }
    setVariant(randomVariant())
  }, [])

  const { renderMode, palette, lighting, fog } = variant

  return (
    <div
      className="letterbox"
      style={{ width: '100dvw', height: '100dvh', cursor: 'pointer', position: 'relative' }}
      onClick={handleClick}
    >
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
        pointerEvents: 'none',
        fontFamily: "'Syne', sans-serif",
        fontWeight: 800,
        fontSize: 'clamp(5rem, 22vw, 20rem)',
        letterSpacing: '-0.03em',
        lineHeight: 1,
        background: `repeating-linear-gradient(
          -55deg,
          rgba(255,255,255,0.95) 0px,
          rgba(255,255,255,0.95) 2px,
          rgba(255,255,255,0.08) 2px,
          rgba(255,255,255,0.08) 12px
        )`,
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
        mixBlendMode: 'overlay',
      }}>
        dunk
      </div>
      <Canvas shadows camera={{ position: [0, 32, 42], fov: 60 }}>
        <color attach="background" args={[palette.bg]} />
        <fog attach="fog" color={palette.bg} near={fog.near} far={fog.far} />
        <ambientLight intensity={lighting.ambient} />
        <directionalLight
          position={lighting.pos}
          intensity={lighting.intensity}
          color={lighting.color}
          castShadow
        />
        <CinematicCamera />
        <Terrain renderMode={renderMode} palette={palette} />
        {TREES.map((t, i) => <Tree key={i} x={t.x} z={t.z} renderMode={renderMode} palette={palette} />)}
      </Canvas>
    </div>
  )
}
