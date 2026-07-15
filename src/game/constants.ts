export const CANVAS = 336
export const CX = CANVAS / 2
export const CY = CANVAS / 2

/** Pac stays fixed on screen at the bottom of the dial. */
export const PAC_SCREEN_ANGLE = Math.PI / 2
/** Visual / collision radius of Pac-Man (used to size ring gaps). */
export const PAC_RADIUS = 8.5

/** Tuned slow — arcade-like deliberation on a round dial. */
/** Pac's linear pace (px/s) — ring rotation and radial crosses share this. */
export const PAC_LINEAR_SPEED = 122
/** Ghost linear pace (px/s) — constant on every ring; ω = v / r. */
export const GHOST_LINEAR_SPEED = 58
/** Fixed radial pace used only while exiting the ghost house. */
export const HOUSE_EXIT_RADIAL = 26
export const FRIGHT_LINEAR_SPEED = 38
export const EATEN_LINEAR_SPEED = 105

/** Brief freeze when Pac eats a ghost (eyes appear / eat sound). */
export const EAT_FREEZE_MS = 550
/** Prize vanishes if uneaten. */
export const PRIZE_MS = 10000

/** Classic fruit points by level (1-indexed; repeats last). */
export const PRIZE_POINTS = [100, 300, 500, 500, 700, 700, 1000, 1000, 2000, 2000, 3000, 3000, 5000]

/** Personal speed multipliers (arcade-flavored: Blinky fastest, Clyde slowest). */
export const GHOST_SPEED_MULT: Record<'blinky' | 'pinky' | 'inky' | 'clyde', number> = {
  blinky: 1.12,
  pinky: 1.02,
  inky: 0.94,
  clyde: 0.86,
}

/** How close (radians) a ghost must be to a gap center before crossing. */
export const GAP_ALIGN = 0.055

/** Half-angle of a ring gap, just wider than Pac at that wall radius. */
export function gapHalfAngle(wallRadius: number): number {
  return (PAC_RADIUS * 1.2) / wallRadius
}

/** Global gameplay rate — 1 = baseline. */
export const GAME_SPEED = 1.5625

export const FRIGHTENED_MS = 7000
export const READY_MS = 2200
export const DEATH_MS = 1800
/** Pause on GAME OVER before returning to attract. */
export const GAMEOVER_MS = 2800

/** Level-clear: walls flash white this many times. */
export const WON_FLASH_COUNT = 4
/** Duration of each white/blue flash half (seconds, wall clock) — 20% faster than 0.5s. */
export const WON_FLASH_HALF_S = 0.4
/** Full flash phase (white+blue × count). */
export const WON_FLASH_DURATION_S = WON_FLASH_HALF_S * 2 * WON_FLASH_COUNT
/** Revolutions for each ring word during the flash. */
export const WON_SPIN_REVS = 2
/** Fade-out after flashes before the next level starts. */
export const WON_FADE_S = 0.45
/** Total level-clear intermission (wall clock). */
export const WON_TOTAL_S = WON_FLASH_DURATION_S + WON_FADE_S

/** ~one pellet step on the outer ring, used for Pinky/Inky look-ahead. */
export const ANGLE_STEP = (Math.PI * 2) / 34

export const COLORS = {
  bg: '#000000',
  wall: '#2121de',
  wallInner: '#000040',
  pellet: '#ffb897',
  power: '#ffb897',
  pac: '#ffff00',
  score: '#ffffff',
  ready: '#ffff00',
  blinky: '#ff0000',
  pinky: '#ffb8ff',
  inky: '#00ffff',
  clyde: '#ffb852',
  frightened: '#2121ff',
  frightenedFlash: '#ffffff',
  eyes: '#ffffff',
  pupil: '#2121de',
  gate: '#ffb8ff',
  house: '#0a0a18',
  prize: '#ff4a6a',
  prizeLeaf: '#22c55e',
} as const

export function normAngle(a: number): number {
  const t = a % (Math.PI * 2)
  return t < 0 ? t + Math.PI * 2 : t
}

export function angleDelta(a: number, b: number): number {
  let d = normAngle(b) - normAngle(a)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return d
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by)
}

export function polarToCart(
  radius: number,
  angle: number,
  cx = CX,
  cy = CY,
): { x: number; y: number } {
  return {
    x: cx + Math.cos(angle) * radius,
    y: cy + Math.sin(angle) * radius,
  }
}

/** Angular distance in radians, shortest path [0, π]. */
export function angleDist(a: number, b: number): number {
  return Math.abs(angleDelta(a, b))
}
