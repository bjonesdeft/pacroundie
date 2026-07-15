import {
  ANGLE_STEP,
  EATEN_LINEAR_SPEED,
  FRIGHT_LINEAR_SPEED,
  GAP_ALIGN,
  GHOST_LINEAR_SPEED,
  GHOST_SPEED_MULT,
  HOUSE_EXIT_RADIAL,
  angleDelta,
  angleDist,
  normAngle,
} from './constants'
import type { Maze } from './Maze'
import type { Dir, GhostMode, GhostName } from './types'

/** Scatter corners in maze-local polar space (classic personalities). */
const SCATTER: Record<GhostName, { ring: number; angle: number }> = {
  blinky: { ring: 3, angle: 0.3 },
  pinky: { ring: 3, angle: Math.PI - 0.3 },
  inky: { ring: 0, angle: 0.4 },
  clyde: { ring: 0, angle: Math.PI + 0.4 },
}

export interface PacSnapshot {
  ring: number
  angle: number
  facing: Dir
  radius: number
}

export class Ghost {
  name: GhostName
  color: string
  /** -1 = inside ghost house; 0..n = playable rings. */
  ring: number
  targetRing: number
  radius: number
  /**
   * While in the house: screen-space angle (maze does not rotate them).
   * Once in the maze: maze-local angle (rotates with the circles).
   */
  angle: number
  mode: GhostMode = 'house'
  /** Constant linear pace (px/s); angular ω = linear / radius per ring. */
  linearSpeed = GHOST_LINEAR_SPEED
  private releaseAt: number
  exitTimer: number
  private movingRadial = false
  private crossingWall = -1
  turn: 1 | -1 = 1
  facing: Dir = 'left'
  private bob = 0
  private alignAngle: number | null = null
  /** Fixed home angle used when returning to the house. */
  private homeAngle = 0
  /** Spawn: wander → pull to center → climb out the top gate. */
  private housePhase: 'idle' | 'toCenter' | 'toGate' = 'idle'
  /** Brief immunity after bouncing off another ghost. */
  private collideCool = 0
  private houseRadiusTarget = 16
  private houseWanderTimer = 0
  /** After bouncing off a spoke, keep that reverse briefly. */
  private wallBounceLock = 0
  /** First radial after leaving house — keep spawn pace, not matched ring speed. */
  private fromHouseExit = false
  /** Attract-mode roam target. */
  private wanderTimer = 0
  private wanderRing = 0
  private wanderAngle = 0
  /** Just landed on a ring — may pick a new heading (including reverse). */
  private pendingDecision = false

  constructor(name: GhostName, color: string, releaseAt: number) {
    this.name = name
    this.color = color
    this.releaseAt = releaseAt
    this.exitTimer = releaseAt
    this.ring = -1
    this.targetRing = -1
    this.radius = 18
    this.angle = 0
  }

  /** True while drawn screen-fixed (house body, or returning eyes). */
  get inSpawnVisual(): boolean {
    return this.mode === 'house' || this.mode === 'eaten'
  }

  private baseLinear(): number {
    return GHOST_LINEAR_SPEED * GHOST_SPEED_MULT[this.name]
  }

  /** Angular step for this ring that keeps linear pace constant. */
  private omega(): number {
    return this.linearSpeed / Math.max(24, this.radius)
  }

  reset(_inHouse: boolean, homeAngle: number, maze: Maze, attract = false): void {
    this.homeAngle = homeAngle
    this.angle = homeAngle
    this.exitTimer = attract ? 400 + Math.random() * 900 : this.releaseAt
    this.movingRadial = false
    this.crossingWall = -1
    this.alignAngle = null
    this.housePhase = 'idle'
    this.collideCool = 0
    this.wallBounceLock = 0
    this.fromHouseExit = false
    this.wanderTimer = 0
    this.wanderRing = Math.floor(Math.random() * maze.ringCount)
    this.wanderAngle = Math.random() * Math.PI * 2
    this.pendingDecision = false
    this.houseRadiusTarget = 12 + Math.random() * 8
    this.houseWanderTimer = 0.4 + Math.random() * 0.8
    this.linearSpeed = this.baseLinear()
    this.turn = Math.random() < 0.5 ? 1 : -1
    this.facing = this.turn > 0 ? 'right' : 'left'
    this.bob = 0
    this.mode = 'house'
    this.ring = -1
    this.targetRing = -1
    this.radius = 10 + Math.random() * 8
  }

  /** Reverse cruise direction after bumping another ghost on the maze. */
  bounceOffGhost(): void {
    if (this.collideCool > 0) return
    if (this.mode === 'house' || this.mode === 'eaten') return
    if (this.movingRadial) return
    this.turn = (this.turn === 1 ? -1 : 1) as 1 | -1
    this.facing = this.turn > 0 ? 'right' : 'left'
    this.alignAngle = null
    this.collideCool = 0.45
    this.wallBounceLock = 0.25
  }

  frighten(): void {
    if (this.mode === 'eaten' || this.mode === 'house') return
    this.mode = 'frightened'
    // Power pellet: forced reverse, then keep that heading until the next decision
    this.turn = (this.turn === 1 ? -1 : 1) as 1 | -1
    this.facing = this.turn > 0 ? 'right' : 'left'
    this.alignAngle = null
    this.wallBounceLock = 0.2
    this.linearSpeed = FRIGHT_LINEAR_SPEED * GHOST_SPEED_MULT[this.name]
  }

  /** Pac ate this ghost — eyes switch to screen space and bee-line home. */
  becomeEaten(maze: Maze): void {
    this.angle = maze.toScreen(this.angle)
    this.mode = 'eaten'
    this.alignAngle = null
    this.movingRadial = false
    this.crossingWall = -1
    this.pendingDecision = false
    this.fromHouseExit = false
    this.linearSpeed = EATEN_LINEAR_SPEED * GHOST_SPEED_MULT[this.name]
  }

  setMode(mode: GhostMode, force = false): void {
    if (!force && (this.mode === 'frightened' || this.mode === 'eaten' || this.mode === 'house')) {
      return
    }
    // No free reverse on scatter/chase swaps — only power pellet forces that
    this.mode = mode
    this.linearSpeed = this.baseLinear()
  }

  /**
   * Gaps are decision points (and landing after a radial cross).
   * Between them, ghosts may not reverse — they keep cruising forward.
   */
  private atDecisionPoint(maze: Maze): boolean {
    if (this.pendingDecision) return true
    if (this.ring < 0) return false
    // Inner wall gap for this ring
    if (maze.inGap(this.ring, this.angle, 0.07)) return true
    // Outer wall gap (if any)
    if (this.ring + 1 < maze.gaps.length && maze.inGap(this.ring + 1, this.angle, 0.07)) {
      return true
    }
    return false
  }

  /** Apply a preferred cruise heading without mid-lane U-turns. */
  private chooseTurn(prefer: 1 | -1, maze: Maze): void {
    if (this.wallBounceLock > 0) return
    if (prefer === this.turn) {
      if (this.pendingDecision) this.pendingDecision = false
      return
    }
    // Would reverse — only legal at a decision point
    if (!this.atDecisionPoint(maze)) return
    this.turn = prefer
    this.pendingDecision = false
  }

  update(
    maze: Maze,
    dt: number,
    pac: PacSnapshot,
    blinky: Ghost,
    elapsed: number,
    attract = false,
  ): void {
    this.bob += dt
    void elapsed
    if (this.collideCool > 0) this.collideCool -= dt
    if (this.wallBounceLock > 0) this.wallBounceLock -= dt

    if (this.mode === 'house') {
      this.updateHouse(maze, dt)
      return
    }

    if (this.mode === 'eaten') {
      this.updateEaten(maze, dt)
      return
    }

    if (this.movingRadial) {
      this.stepRadial(maze, dt)
      return
    }

    if (this.ring >= 0) this.radius = maze.ringRadius(this.ring)

    const target = attract
      ? this.computeWanderTarget(maze, dt)
      : this.computeTarget(maze, pac, blinky)
    const ringDelta = target.ring - this.ring

    if (ringDelta !== 0) {
      const step = ringDelta > 0 ? 1 : -1
      const towardInner = step < 0
      this.approachAndCross(maze, dt, this.ring + step, towardInner)
      return
    }

    // Same ring — steer toward target only at decision points
    this.alignAngle = null
    const prefer: 1 | -1 = angleDelta(this.angle, target.angle) >= 0 ? 1 : -1
    if (maze.spokeBlocksPath(this.ring, this.angle, target.angle, prefer)) {
      this.chooseTurn((prefer === 1 ? -1 : 1) as 1 | -1, maze)
    } else {
      this.chooseTurn(prefer, maze)
    }
    this.cruise(maze, dt)
  }

  /** Pick a new roam point now and then so attract ghosts explore the dial. */
  private computeWanderTarget(maze: Maze, dt: number): { ring: number; angle: number } {
    this.wanderTimer -= dt
    if (this.wanderTimer <= 0) {
      this.wanderTimer = 1.2 + Math.random() * 2.4
      // Prefer changing ring often so they use the gaps
      if (Math.random() < 0.55) {
        this.wanderRing = Math.floor(Math.random() * maze.ringCount)
      }
      this.wanderAngle = Math.random() * Math.PI * 2
    }
    return { ring: this.wanderRing, angle: this.wanderAngle }
  }

  private approachAndCross(
    maze: Maze,
    dt: number,
    targetRing: number,
    towardInner: boolean,
  ): void {
    const wall = maze.wallIndexForCross(this.ring, towardInner)
    if (wall < 0 || wall >= maze.gaps.length) {
      this.cruise(maze, dt)
      return
    }

    // Wall 0 (house gate) is screen-fixed — its local angle drifts as the maze turns,
    // so always refresh the aim point. Other walls keep a stable mid until reached.
    if (wall === 0 || this.alignAngle === null) {
      this.alignAngle = maze.nearestGapMid(wall, this.angle)
    }

    const dist = angleDist(this.angle, this.alignAngle)
    if (dist > GAP_ALIGN) {
      const prefer: 1 | -1 = angleDelta(this.angle, this.alignAngle) >= 0 ? 1 : -1
      if (maze.spokeBlocksPath(this.ring, this.angle, this.alignAngle, prefer)) {
        this.chooseTurn((prefer === 1 ? -1 : 1) as 1 | -1, maze)
      } else {
        this.chooseTurn(prefer, maze)
      }
      const bounced = this.cruise(maze, dt)
      if (bounced) this.alignAngle = maze.nearestGapMid(wall, this.angle)
      return
    }

    if (!maze.inGap(wall, this.angle, 0.02)) {
      this.alignAngle = maze.nearestGapMid(wall, this.angle)
      this.cruise(maze, dt)
      return
    }

    // Snap onto the gap center so the radial cross starts cleanly
    this.angle = this.alignAngle
    this.targetRing = targetRing
    this.crossingWall = wall
    this.movingRadial = true
    this.alignAngle = null
    this.facing = towardInner ? 'up' : 'down'
  }

  /** Hit a radial wall → reverse and lock that choice briefly. */
  private cruise(maze: Maze, dt: number): boolean {
    const want = this.turn * this.omega() * dt
    const allowed = maze.clampAngularTravel(this.ring, this.angle, want)
    let bounced = false

    if (Math.abs(want) > 1e-8 && Math.abs(allowed) < Math.abs(want) * 0.9) {
      // Spoke hit is a forced reverse (not an AI U-turn)
      this.angle = normAngle(this.angle + allowed)
      this.turn = (this.turn === 1 ? -1 : 1) as 1 | -1
      this.alignAngle = null
      this.wallBounceLock = 0.35
      bounced = true
    } else {
      this.angle = normAngle(this.angle + allowed)
    }

    this.facing = this.turn > 0 ? 'right' : 'left'
    return bounced
  }

  private updateHouse(maze: Maze, dt: number): void {
    const gateScreen = maze.houseGateScreenMid()
    const maxR = maze.houseRadius - 10

    if (this.housePhase === 'idle') {
      this.exitTimer -= dt * 1000
      this.wanderInHouse(dt, maxR)
      if (this.exitTimer <= 0) this.housePhase = 'toCenter'
      return
    }

    if (this.housePhase === 'toCenter') {
      // Pull into the middle first
      this.facing = 'up'
      const centerR = 3
      const rStep = 28 * dt
      if (this.radius > centerR + rStep) {
        this.radius -= rStep
      } else {
        this.radius = centerR
        this.housePhase = 'toGate'
      }
      return
    }

    // toGate: from center, climb straight up and out the fixed top opening
    this.facing = 'up'
    const angStep = 2.2 * dt
    const dAng = angleDelta(this.angle, gateScreen)
    if (Math.abs(dAng) > angStep) {
      this.angle = normAngle(this.angle + Math.sign(dAng) * angStep)
    } else {
      this.angle = gateScreen
    }

    const gateRadius = maze.wallRadii[0] - 2
    const rStep = 26 * dt
    if (this.radius < gateRadius - rStep) this.radius += rStep
    else this.radius = gateRadius

    const atGate =
      angleDist(this.angle, gateScreen) < 0.08 && Math.abs(this.radius - gateRadius) < 2.5
    if (!atGate) return

    // Join the maze at the gate — convert screen gate into maze-local
    this.angle = maze.toLocal(gateScreen)
    this.mode = 'scatter'
    this.housePhase = 'idle'
    this.ring = -1
    this.targetRing = 0
    this.crossingWall = 0
    this.movingRadial = true
    this.fromHouseExit = true
    this.alignAngle = null
    this.pendingDecision = true
    this.linearSpeed = this.baseLinear()
    this.facing = 'up'
  }

  /** Slow random milling inside the spawn pen. */
  private wanderInHouse(dt: number, maxR: number): void {
    this.houseWanderTimer -= dt
    if (this.houseWanderTimer <= 0) {
      this.houseWanderTimer = 0.5 + Math.random() * 1.2
      if (Math.random() < 0.55) this.turn = (this.turn === 1 ? -1 : 1) as 1 | -1
      this.houseRadiusTarget = 6 + Math.random() * (maxR - 6)
    }

    const spin = 0.55
    this.angle = normAngle(this.angle + this.turn * spin * dt)
    this.facing = this.turn > 0 ? 'right' : 'left'

    const rStep = 10 * dt
    const rd = this.houseRadiusTarget - this.radius
    if (Math.abs(rd) > rStep) this.radius += Math.sign(rd) * rStep
    else this.radius = this.houseRadiusTarget
    this.radius = Math.max(5, Math.min(maxR, this.radius))
  }

  private updateEaten(maze: Maze, dt: number): void {
    // Screen-space bee-line to the fixed house gate — ignore maze rotation / gaps
    const speed = EATEN_LINEAR_SPEED * GHOST_SPEED_MULT[this.name] * 1.15
    const gateA = maze.houseGateScreenMid()
    const gateR = maze.wallRadii[0] - 2
    const tx = Math.cos(gateA) * gateR
    const ty = Math.sin(gateA) * gateR
    const cx = Math.cos(this.angle) * this.radius
    const cy = Math.sin(this.angle) * this.radius
    const dx = tx - cx
    const dy = ty - cy
    const dist = Math.hypot(dx, dy)
    const step = speed * dt

    if (dist <= step) {
      this.angle = this.homeAngle
      this.radius = 12
      this.ring = -1
      this.targetRing = -1
      this.mode = 'house'
      this.housePhase = 'idle'
      this.exitTimer = 1200
      this.houseRadiusTarget = 12
      this.houseWanderTimer = 0.3
      this.linearSpeed = this.baseLinear()
      this.alignAngle = null
      this.facing = 'up'
      return
    }

    const nx = cx + (dx / dist) * step
    const ny = cy + (dy / dist) * step
    this.radius = Math.hypot(nx, ny)
    this.angle = normAngle(Math.atan2(ny, nx))

    // Pupils follow travel toward the gate
    if (Math.abs(dx) >= Math.abs(dy)) this.facing = dx > 0 ? 'right' : 'left'
    else this.facing = dy > 0 ? 'down' : 'up'
  }

  private computeTarget(maze: Maze, pac: PacSnapshot, blinky: Ghost): { ring: number; angle: number } {
    if (this.mode === 'frightened') {
      // Flee: opposite side of the dial, on the ring farthest from Pac
      const away = normAngle(pac.angle + Math.PI)
      const outer = maze.ringCount - 1
      const ringAway = Math.abs(outer - pac.ring) >= pac.ring ? outer : 0
      return { ring: ringAway, angle: away }
    }

    if (this.mode === 'scatter') {
      return SCATTER[this.name]
    }

    switch (this.name) {
      case 'blinky':
        return { ring: pac.ring, angle: pac.angle }

      case 'pinky':
        return this.offsetFromPac(maze, pac, 4)

      case 'inky': {
        const pivot = this.offsetFromPac(maze, pac, 2)
        const br = blinky.ring < 0 ? 0 : blinky.ring
        const ring = Math.max(0, Math.min(maze.ringCount - 1, pivot.ring * 2 - br))
        const angle = normAngle(pivot.angle + angleDelta(blinky.angle, pivot.angle))
        return { ring, angle }
      }

      case 'clyde': {
        const ringSep = Math.abs(this.ring - pac.ring)
        const angSep = angleDist(this.angle, pac.angle) / ANGLE_STEP
        if (ringSep + angSep > 8) return { ring: pac.ring, angle: pac.angle }
        return SCATTER.clyde
      }
    }
  }

  private offsetFromPac(
    maze: Maze,
    pac: PacSnapshot,
    steps: number,
  ): { ring: number; angle: number } {
    let ring = pac.ring
    let angle = pac.angle
    switch (pac.facing) {
      case 'up':
        ring = Math.max(0, pac.ring - steps)
        break
      case 'down':
        ring = Math.min(maze.ringCount - 1, pac.ring + steps)
        break
      case 'left':
        angle = normAngle(pac.angle + steps * ANGLE_STEP)
        break
      case 'right':
        angle = normAngle(pac.angle - steps * ANGLE_STEP)
        break
    }
    return { ring, angle }
  }

  private stepRadial(maze: Maze, dt: number): void {
    // House gate is screen-fixed: pin local angle to it while crossing so maze
    // rotation can't eject the ghost mid-travel (looked like a vanish/jump).
    if (this.crossingWall === 0) {
      this.angle = maze.toLocal(maze.houseGateScreenMid())
    } else if (this.crossingWall >= 0 && !maze.inGap(this.crossingWall, this.angle, 0.1)) {
      // Soft abort — snap back to the ring we still belong to
      this.movingRadial = false
      this.crossingWall = -1
      this.alignAngle = null
      this.fromHouseExit = false
      this.pendingDecision = true
      if (this.ring >= 0) this.radius = maze.ringRadius(this.ring)
      else this.radius = maze.houseRadius * 0.5
      return
    }

    const dest =
      this.targetRing < 0 ? maze.houseRadius * 0.5 : maze.ringRadius(this.targetRing)
    this.facing = dest < this.radius ? 'up' : 'down'
    const step = this.fromHouseExit ? HOUSE_EXIT_RADIAL * dt : this.linearSpeed * dt
    const delta = dest - this.radius
    if (Math.abs(delta) <= step) {
      this.radius = dest
      this.ring = this.targetRing
      this.movingRadial = false
      this.crossingWall = -1
      this.alignAngle = null
      this.fromHouseExit = false
      this.pendingDecision = true
      // Ensure we're exactly on the lane after a cross
      if (this.ring >= 0) this.radius = maze.ringRadius(this.ring)
    } else {
      this.radius += Math.sign(delta) * step
    }
  }

  get bobOffset(): number {
    // Soft idle bob only — no positional thrashing
    return Math.sin(this.bob * 3.2) * 0.9
  }

  get skirtPhase(): number {
    return this.bob * 8
  }
}
