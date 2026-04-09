// Generative ambient soundtrack — Web Audio API
// Architecture: A minor drone cluster → pad (staggered) → sparse bell melody
// Everything routed through a long reverb tail

function makeReverb(ctx, seconds = 7) {
  const len = ctx.sampleRate * seconds
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c)
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.5)
    }
  }
  const node = ctx.createConvolver()
  node.buffer = buf
  return node
}

// Am pentatonic: A C D E G across two octaves
const BELL_FREQS = [440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5]

function bell(ctx, dest, freq, vol = 0.28) {
  const pan = ctx.createStereoPanner()
  pan.pan.value = (Math.random() - 0.5) * 1.6

  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, ctx.currentTime)
  g.gain.exponentialRampToValueAtTime(vol, ctx.currentTime + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 5)

  const o = ctx.createOscillator()
  o.type = 'sine'
  o.frequency.value = freq
  o.connect(g)
  g.connect(pan)
  pan.connect(dest)
  o.start()
  o.stop(ctx.currentTime + 5.5)
}

function scheduleBells(ctx, dest) {
  const wait = 2000 + Math.random() * 7000
  setTimeout(() => {
    if (ctx.state === 'closed') return
    bell(ctx, dest, BELL_FREQS[Math.floor(Math.random() * BELL_FREQS.length)])
    // Occasional grace note shortly after
    if (Math.random() < 0.28) {
      setTimeout(() => {
        bell(ctx, dest, BELL_FREQS[Math.floor(Math.random() * BELL_FREQS.length)], 0.14)
      }, 250 + Math.random() * 600)
    }
    scheduleBells(ctx, dest)
  }, wait)
}

export function startMusic() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)()

  const reverb = makeReverb(ctx, 7)
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -18
  comp.ratio.value = 4

  reverb.connect(comp)
  comp.connect(ctx.destination)

  const dry = ctx.createGain()
  dry.gain.value = 0.22
  dry.connect(comp)

  // === DRONE — A2 cluster, 3 oscillators slightly detuned for warmth ===
  ;[0, 6, -6].forEach(detune => {
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, ctx.currentTime)
    g.gain.linearRampToValueAtTime(0.13, ctx.currentTime + 8)
    const o = ctx.createOscillator()
    o.frequency.value = 110   // A2
    o.detune.value = detune
    o.connect(g)
    g.connect(dry)
    g.connect(reverb)
    o.start()
  })

  // E3 — perfect fifth, grounds the harmonic space
  const e3g = ctx.createGain()
  e3g.gain.setValueAtTime(0, ctx.currentTime)
  e3g.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 11)
  const e3 = ctx.createOscillator()
  e3.frequency.value = 164.81
  e3.connect(e3g)
  e3g.connect(reverb)
  e3.start()

  // === PAD — Am chord (A3, C4, E4), each note fades in slowly and late ===
  ;[220, 261.63, 329.63].forEach((freq, i) => {
    const g = ctx.createGain()
    const onset = 6 + i * 4
    g.gain.setValueAtTime(0, ctx.currentTime)
    g.gain.linearRampToValueAtTime(0, ctx.currentTime + onset)
    g.gain.linearRampToValueAtTime(0.045 - i * 0.008, ctx.currentTime + onset + 7)
    const o = ctx.createOscillator()
    o.frequency.value = freq
    o.connect(g)
    g.connect(reverb)
    o.start()
  })

  // === SHIMMER — A4 breath, very quiet high tone for air ===
  const sg = ctx.createGain()
  sg.gain.setValueAtTime(0, ctx.currentTime)
  sg.gain.linearRampToValueAtTime(0.018, ctx.currentTime + 18)
  const so = ctx.createOscillator()
  so.frequency.value = 440
  so.detune.value = 10
  so.connect(sg)
  sg.connect(reverb)
  so.start()

  // First bell after 3s, then random
  setTimeout(() => bell(ctx, reverb, BELL_FREQS[2], 0.22), 3000)
  scheduleBells(ctx, reverb)

  return ctx
}
