import {
  PAC_LINEAR_SPEED,
  PAC_SCREEN_ANGLE,
  RADIAL_CROSS_COOLDOWN,
  angleDelta,
  normAngle,
} from './constants'
import type { Maze } from './Maze'
import type { Dir } from './types'

const FACE_ANGLES: Record<Dir, number> = {
  right: 0,
  down: Math.PI / 2,
  left: Math.PI,
  up: -Math.PI / 2,
}

/** How quickly Pac's mouth turns toward a new heading (rad/sec). */
const FACE_TURN_SPEED = 14
/** How quickly the maze rotates to center a gap before a radial cross. */
const ALIGN_SPEED = 4.2

export class PacMan {
  ring: number
  targetRing: number
  radius: number
  /** Logical facing used by ghost AI. */
  facing: Dir = 'up'
  /** Smoothed mouth angle for rendering. */
  facingAngle = FACE_ANGLES.up
  /** Chomp phase; −π/2 = fully closed. */
  mouth = -Math.PI / 2
  alive = true
  private moving = false
  /** Maze rotation we're easing toward before a ring cross. */
  private alignRot: number | null = null
  private pendingCross: { targetRing: number; facing: Dir } | null = null
  /** Seconds left before another up/down ring cross can start. */
  private radialCool = 0

  constructor(maze: Maze) {
    this.ring = maze.ringCount - 1
    this.targetRing = this.ring
    this.radius = maze.ringRadius(this.ring)
  }

  reset(maze: Maze): void {
    this.ring = maze.ringCount - 1
    this.targetRing = this.ring
    this.radius = maze.ringRadius(this.ring)
    this.facing = 'up'
    this.facingAngle = FACE_ANGLES.up
    this.mouth = -Math.PI / 2 // closed
    this.alive = true
    this.moving = false
    this.alignRot = null
    this.pendingCross = null
    this.radialCool = 0
  }

  get isMoving(): boolean {
    return this.moving || this.alignRot !== null
  }

  localAngle(maze: Maze): number {
    return maze.toLocal(PAC_SCREEN_ANGLE)
  }

  occupancyRing(maze: Maze): number {
    if (!this.moving) return this.ring
    const a = maze.ringRadius(this.ring)
    const b = maze.ringRadius(this.targetRing)
    return Math.abs(this.radius - a) < Math.abs(this.radius - b) ? this.ring : this.targetRing
  }

  private setFacing(dir: Dir): void {
    this.facing = dir
  }

  private easeFacing(dt: number): void {
    const target = FACE_ANGLES[this.facing]
    const d = angleDelta(this.facingAngle, target)
    const step = FACE_TURN_SPEED * dt
    if (Math.abs(d) <= step) this.facingAngle = target
    else this.facingAngle = normAngle(this.facingAngle + Math.sign(d) * step)
  }

  /** Angular maze turn that yields constant linear pace past Pac. */
  private rotateOmega(): number {
    return PAC_LINEAR_SPEED / Math.max(24, this.radius)
  }

  update(maze: Maze, dt: number, held: Set<Dir>, rotateImpulse: number): void {
    if (!this.alive) return

    let active = false

    if (this.alignRot !== null && this.pendingCross) {
      const d = angleDelta(maze.rotation, this.alignRot)
      const step = ALIGN_SPEED * dt
      if (Math.abs(d) <= step) {
        maze.rotation = this.alignRot
        this.alignRot = null
        this.targetRing = this.pendingCross.targetRing
        this.setFacing(this.pendingCross.facing)
        this.pendingCross = null
        this.moving = true
      } else {
        maze.rotate(Math.sign(d) * step)
      }
      active = true
    } else if (!this.moving) {
      const omega = this.rotateOmega()
      let rot = rotateImpulse
      if (held.has('left')) rot -= omega * dt
      if (held.has('right')) rot += omega * dt

      if (rot !== 0) {
        const local = this.localAngle(maze)
        rot = maze.clampRotationForPac(this.ring, local, rot)
        if (rot !== 0) {
          maze.rotate(rot)
          this.setFacing(rot < 0 ? 'left' : 'right')
          active = true
        }
      }

      const local = this.localAngle(maze)
      this.radialCool = Math.max(0, this.radialCool - dt)

      if (this.radialCool <= 0) {
        if (held.has('up') && maze.canPacCross(this.ring, true, local)) {
          const wall = maze.wallIndexForPacCross(this.ring, true)
          const mid = maze.nearestGapMid(wall, local)
          this.alignRot = normAngle(PAC_SCREEN_ANGLE - mid)
          this.pendingCross = { targetRing: this.ring - 1, facing: 'up' }
          this.setFacing('up')
          active = true
        } else if (held.has('down') && maze.canPacCross(this.ring, false, local)) {
          const wall = maze.wallIndexForPacCross(this.ring, false)
          const mid = maze.nearestGapMid(wall, local)
          this.alignRot = normAngle(PAC_SCREEN_ANGLE - mid)
          this.pendingCross = { targetRing: this.ring + 1, facing: 'down' }
          this.setFacing('down')
          active = true
        }
      }
    }

    if (this.moving) {
      const dest = maze.ringRadius(this.targetRing)
      const step = PAC_LINEAR_SPEED * dt
      const delta = dest - this.radius
      if (Math.abs(delta) <= step) {
        this.radius = dest
        this.ring = this.targetRing
        this.moving = false
        this.radialCool = RADIAL_CROSS_COOLDOWN
      } else {
        this.radius += Math.sign(delta) * step
      }
      // Face the radial travel direction while crossing
      this.setFacing(delta < 0 ? 'up' : 'down')
      active = true
    }

    // Mouth aims with movement; chomp only while actively moving
    this.easeFacing(dt)
    if (active) this.mouth += dt * 22
    else this.mouth = -Math.PI / 2
  }
}
