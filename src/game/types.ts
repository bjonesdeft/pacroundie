export type Dir = 'up' | 'down' | 'left' | 'right'

export type GhostMode = 'scatter' | 'chase' | 'frightened' | 'eaten' | 'house'

export type GhostName = 'blinky' | 'pinky' | 'inky' | 'clyde'

export type GamePhase = 'attract' | 'ready' | 'playing' | 'dying' | 'won' | 'gameover'

/** Angular gap in a ring wall, in maze-local radians [0, 2π). */
export interface Gap {
  start: number
  end: number
}

/** Radial wall (spoke) blocking travel along a ring lane. */
export interface RadialWall {
  /** Playable ring this spoke sits on. */
  ring: number
  /** Maze-local angle of the spoke. */
  angle: number
  /** Inner / outer radius of the spoke line. */
  rInner: number
  rOuter: number
}

export interface Pellet {
  ring: number
  angle: number
  power: boolean
  eaten: boolean
}

/** Level prize (fruit) sitting on a ring. */
export interface Prize {
  ring: number
  angle: number
  points: number
  /** Index into FRUIT_KINDS / classic fruit progression. */
  kind: number
  active: boolean
}

export interface Polar {
  radius: number
  angle: number
}
