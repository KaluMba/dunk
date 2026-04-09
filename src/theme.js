// Each palette: bg, terrain (solid/polygon), trunk/dark/light (trees), wire (wireframe)
export const PALETTES = [
  { name: 'forest',   bg: '#000000', terrain: '#2a4a1a', trunk: '#3d2010', dark: '#1a3a0a', light: '#1f4a0e', wire: '#00ff88' },
  { name: 'arctic',   bg: '#060d1a', terrain: '#6a8aaa', trunk: '#3a5060', dark: '#7a9ab8', light: '#a0bece', wire: '#77ddff' },
  { name: 'desert',   bg: '#080400', terrain: '#906040', trunk: '#5a3020', dark: '#7a4a28', light: '#a87040', wire: '#ffaa33' },
  { name: 'volcanic', bg: '#010000', terrain: '#221008', trunk: '#3a1808', dark: '#2a1006', light: '#120602', wire: '#ff3300' },
  { name: 'ocean',    bg: '#000810', terrain: '#1a4858', trunk: '#0a2030', dark: '#183848', light: '#206070', wire: '#00ccee' },
  { name: 'neon',     bg: '#000000', terrain: '#07070f', trunk: '#050508', dark: '#09090f', light: '#0d0d16', wire: '#ff00ff' },
  { name: 'dusk',     bg: '#08000f', terrain: '#3a1848', trunk: '#280a38', dark: '#421858', light: '#522068', wire: '#cc77ff' },
  { name: 'chalk',    bg: '#080600', terrain: '#c0b090', trunk: '#907060', dark: '#a08070', light: '#ccc0a0', wire: '#ffe090' },
  { name: 'rust',     bg: '#020100', terrain: '#6a2808', trunk: '#481808', dark: '#5a2010', light: '#783018', wire: '#ff5520' },
  { name: 'midnight', bg: '#000208', terrain: '#10181e', trunk: '#0a1018', dark: '#121c24', light: '#182430', wire: '#3377aa' },
]

// pos, intensity (directional), ambient intensity, light colour
export const LIGHTINGS = [
  { pos: [20, 30, 10],   intensity: 1.5, ambient: 0.5,  color: '#ffffff' }, // neutral
  { pos: [5, 8, 25],     intensity: 2.0, ambient: 0.25, color: '#ffb060' }, // golden hour
  { pos: [-18, 22, -8],  intensity: 1.2, ambient: 0.65, color: '#8899ee' }, // cool overcast
  { pos: [0, 45, 2],     intensity: 2.6, ambient: 0.35, color: '#ffffff' }, // overhead noon
]

// fog near/far distances
export const FOGS = [
  { near: 62, far: 95 }, // clear
  { near: 42, far: 80 }, // atmospheric
  { near: 18, far: 50 }, // thick
]

export const RENDER_MODES = ['wireframe', 'solid', 'polygon', 'height']
