import { useRef, useMemo, useState, useCallback, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { PALETTES, LIGHTINGS, FOGS, RENDER_MODES } from './theme'
import { startMusic } from './music'
import RivalsOverlay from './RivalsApp.jsx'

// Module-level time scale — set to near-zero when rivals overlay is open
export const timeScale = { current: 1 }

function heightAt(x, z) {
  return (
    Math.sin(x * 0.15) * Math.cos(z * 0.15) * 4 +
    Math.sin(x * 0.4 + 1) * Math.cos(z * 0.3) * 2 +
    Math.sin(x * 0.8) * Math.cos(z * 0.6) * 0.8
  )
}

// Shuffle deck: cycles through all values in random order before repeating.
// Guarantees no consecutive repeats even at deck boundaries.
function shuffle(arr, avoid) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  // Ensure the first card drawn (from the end) doesn't match the last card from the previous deck
  if (avoid != null && a.length > 1) {
    const top = a.length - 1
    if (a[top] === avoid) {
      const swap = Math.floor(Math.random() * top)
      ;[a[top], a[swap]] = [a[swap], a[top]]
    }
  }
  return a
}

class Deck {
  constructor(arr) { this.arr = arr; this.last = null; this.cards = shuffle(arr) }
  draw() {
    if (!this.cards.length) this.cards = shuffle(this.arr, this.last)
    return (this.last = this.cards.pop())
  }
}

const decks = {
  renderMode: new Deck(RENDER_MODES),
  palette:    new Deck(PALETTES),
  lighting:   new Deck(LIGHTINGS),
  fog:        new Deck(FOGS),
}

function nextVariant() {
  return {
    renderMode: decks.renderMode.draw(),
    palette:    decks.palette.draw(),
    lighting:   decks.lighting.draw(),
    fog:        decks.fog.draw(),
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

const CAT_COLOR = '#c8783a'
const CAT_EYE   = '#1a5a28'
const CAT_NOSE  = '#d07070'

function Cat({ renderMode, palette }) {
  const groupRef = useRef()
  const tailRef  = useRef()
  const fl = useRef(), fr = useRef(), bl = useRef(), br = useRef()

  const px     = useRef(8)
  const pz     = useRef(3)
  const dir    = useRef(0)
  const moving = useRef(true)
  const timer  = useRef(Math.random() * 2)
  const phase  = useRef(0)

  useFrame((_, rawDelta) => {
    const delta = rawDelta * timeScale.current
    timer.current += delta

    if (timer.current > 2.5 + Math.random() * 4) {
      timer.current = 0
      moving.current = Math.random() > 0.22
      dir.current   += (Math.random() - 0.5) * Math.PI * 1.4
    }

    if (moving.current) {
      phase.current += delta * 5
      px.current += Math.sin(dir.current) * 1.8 * delta
      pz.current += Math.cos(dir.current) * 1.8 * delta
      if (Math.hypot(px.current, pz.current) > 26)
        dir.current = Math.atan2(-px.current, -pz.current)
    }

    // Diagonal gait: FL+BR in phase, FR+BL opposite
    const swing = Math.sin(phase.current) * (moving.current ? 0.45 : 0.03)
    if (fl.current) fl.current.rotation.x =  swing
    if (fr.current) fr.current.rotation.x = -swing
    if (bl.current) bl.current.rotation.x = -swing
    if (br.current) br.current.rotation.x =  swing

    if (tailRef.current)
      tailRef.current.rotation.z = Math.sin(timer.current * 1.8) * 0.45 + 0.2

    const bob = moving.current ? Math.sin(phase.current * 2) * 0.03 : 0
    if (groupRef.current) {
      groupRef.current.position.set(px.current, heightAt(px.current, pz.current) + 0.38 + bob, pz.current)
      groupRef.current.rotation.y = dir.current
    }
  })

  const isWire = renderMode === 'wireframe'
  const c    = isWire ? palette.wire : CAT_COLOR
  const flat = renderMode === 'polygon'
  const mats = { color: c, wireframe: isWire, roughness: 0.9, flatShading: flat }

  return (
    <group ref={groupRef}>
      {/* Body */}
      <mesh scale={[0.85, 0.72, 1.0]} castShadow={!isWire}>
        <sphereGeometry args={[0.44, 8, 6]} />
        <meshStandardMaterial {...mats} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 0.28, 0.48]} castShadow={!isWire}>
        <sphereGeometry args={[0.3, 8, 6]} />
        <meshStandardMaterial {...mats} />
      </mesh>
      {/* Ears */}
      <mesh position={[-0.14, 0.53, 0.42]} rotation={[0.2, 0, -0.15]}>
        <coneGeometry args={[0.1, 0.22, 4]} />
        <meshStandardMaterial {...mats} />
      </mesh>
      <mesh position={[0.14, 0.53, 0.42]} rotation={[0.2, 0, 0.15]}>
        <coneGeometry args={[0.1, 0.22, 4]} />
        <meshStandardMaterial {...mats} />
      </mesh>
      {/* Eyes */}
      <mesh position={[-0.1, 0.31, 0.76]} scale={[0.6, 1, 0.3]}>
        <sphereGeometry args={[0.07, 5, 5]} />
        <meshStandardMaterial color={isWire ? palette.wire : CAT_EYE} wireframe={isWire} />
      </mesh>
      <mesh position={[0.1, 0.31, 0.76]} scale={[0.6, 1, 0.3]}>
        <sphereGeometry args={[0.07, 5, 5]} />
        <meshStandardMaterial color={isWire ? palette.wire : CAT_EYE} wireframe={isWire} />
      </mesh>
      {/* Nose */}
      <mesh position={[0, 0.23, 0.78]}>
        <sphereGeometry args={[0.035, 4, 4]} />
        <meshStandardMaterial color={isWire ? palette.wire : CAT_NOSE} wireframe={isWire} />
      </mesh>
      {/* Tail — pivots at rear, sways Z-axis */}
      <group ref={tailRef} position={[0, 0.12, -0.44]}>
        <mesh position={[0, 0.16, -0.06]} rotation={[0.4, 0, 0]}>
          <sphereGeometry args={[0.09, 6, 4]} />
          <meshStandardMaterial {...mats} />
        </mesh>
        <mesh position={[0, 0.38, -0.16]} rotation={[0.7, 0, 0]}>
          <sphereGeometry args={[0.075, 6, 4]} />
          <meshStandardMaterial {...mats} />
        </mesh>
        <mesh position={[0, 0.55, -0.21]} rotation={[0.9, 0, 0]}>
          <sphereGeometry args={[0.065, 6, 4]} />
          <meshStandardMaterial {...mats} />
        </mesh>
        <mesh position={[0, 0.65, -0.17]}>
          <sphereGeometry args={[0.055, 6, 4]} />
          <meshStandardMaterial {...mats} />
        </mesh>
      </group>
      {/* Legs — hip pivots for walk cycle */}
      <group ref={fl} position={[-0.18, -0.1, 0.22]}>
        <mesh position={[0, -0.22, 0]} castShadow={!isWire}>
          <cylinderGeometry args={[0.055, 0.045, 0.44, 5]} />
          <meshStandardMaterial {...mats} />
        </mesh>
      </group>
      <group ref={fr} position={[0.18, -0.1, 0.22]}>
        <mesh position={[0, -0.22, 0]} castShadow={!isWire}>
          <cylinderGeometry args={[0.055, 0.045, 0.44, 5]} />
          <meshStandardMaterial {...mats} />
        </mesh>
      </group>
      <group ref={bl} position={[-0.18, -0.1, -0.22]}>
        <mesh position={[0, -0.22, 0]} castShadow={!isWire}>
          <cylinderGeometry args={[0.055, 0.045, 0.44, 5]} />
          <meshStandardMaterial {...mats} />
        </mesh>
      </group>
      <group ref={br} position={[0.18, -0.1, -0.22]}>
        <mesh position={[0, -0.22, 0]} castShadow={!isWire}>
          <cylinderGeometry args={[0.055, 0.045, 0.44, 5]} />
          <meshStandardMaterial {...mats} />
        </mesh>
      </group>
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

  useFrame((_, rawDelta) => {
    const delta = rawDelta * timeScale.current
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
  const [variant, setVariant] = useState(nextVariant)
  const [rivalsOpen, setRivalsOpen] = useState(false)
  const musicStarted = useRef(false)

  // Slow 3D to near-stop when overlay is open
  useEffect(() => {
    timeScale.current = rivalsOpen ? 0.12 : 1
  }, [rivalsOpen])

  const handleClick = useCallback(() => {
    if (rivalsOpen) return
    if (!musicStarted.current) {
      startMusic()
      musicStarted.current = true
    }
    setVariant(nextVariant())
  }, [rivalsOpen])

  const openRivals = useCallback((e) => {
    e.stopPropagation()
    if (!musicStarted.current) {
      startMusic()
      musicStarted.current = true
    }
    setRivalsOpen(true)
  }, [])

  const { renderMode, palette, lighting, fog } = variant

  return (
    <>
      <div
        className={`letterbox${rivalsOpen ? ' scene-cinematic' : ''}`}
        style={{ width: '100dvw', height: '100dvh', cursor: rivalsOpen ? 'default' : 'pointer', position: 'relative' }}
        onClick={handleClick}
      >
        {/* Comic-book overlays — only when rivals is open */}
        {rivalsOpen && <>
          <div className="comic-halftone" />
          <div className="chroma-r" />
          <div className="chroma-b" />
        </>}

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

        <button
          style={{
            position: 'absolute', bottom: 24, right: 24, zIndex: 20,
            color: 'rgba(255,255,255,0.35)', fontSize: 10,
            fontFamily: "'Space Grotesk', system-ui, sans-serif",
            fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase',
            background: 'none', border: '1px solid rgba(255,255,255,0.12)',
            padding: '8px 16px', cursor: 'pointer',
            pointerEvents: 'all',
          }}
          onClick={openRivals}
        >
          RIVALS ›
        </button>

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
          <Cat renderMode={renderMode} palette={palette} />
        </Canvas>
      </div>

      {rivalsOpen && <RivalsOverlay onClose={() => setRivalsOpen(false)} />}
    </>
  )
}
