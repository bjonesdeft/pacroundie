import {
  PAC_CROSS_PAD,
  PAC_RADIUS,
  PAC_SCREEN_ANGLE,
  PRIZE_POINTS,
  angleDelta,
  gapHalfAngle,
  normAngle,
} from './constants'
import { fruitKindForLevel } from './leaderboard'
import type { Gap, Pellet, Prize, RadialWall } from './types'

function gapAt(mid: number, half: number): Gap {
  return { start: normAngle(mid - half), end: normAngle(mid + half) }
}

/**
 * Concentric circular maze.
 * Rings are Pac-Man lanes (0 = innermost playable, outward).
 * Radial spokes block travel along a ring so pellets sit in cul-de-sacs.
 */
export class Maze {
  readonly ringRadii: number[]
  readonly wallRadii: number[]
  readonly outerRadius: number
  readonly houseRadius: number
  readonly gaps: Gap[][]
  /** Spokes that block angular travel on a given ring. */
  spokes: RadialWall[] = []

  pellets: Pellet[] = []
  pelletCount = 0
  /** Total pellets at level start (for half-dot prize trigger). */
  pelletTotal = 0
  prize: Prize | null = null
  rotation = 0

  constructor() {
    this.houseRadius = 34
    this.wallRadii = [46, 78, 110, 142]
    this.outerRadius = 166
    this.ringRadii = [
      (this.wallRadii[0] + this.wallRadii[1]) / 2,
      (this.wallRadii[1] + this.wallRadii[2]) / 2,
      (this.wallRadii[2] + this.wallRadii[3]) / 2,
      (this.wallRadii[3] + this.outerRadius) / 2,
    ]

    const h0 = gapHalfAngle(this.wallRadii[0]) * 1.15
    const h1 = gapHalfAngle(this.wallRadii[1])
    const h2 = gapHalfAngle(this.wallRadii[2])
    const h3 = gapHalfAngle(this.wallRadii[3])

    this.gaps = [
      // Innermost wall / house gate — screen-fixed (does not rotate with the maze)
      [gapAt(-Math.PI / 2, h0)],
      [gapAt(1.1, h1), gapAt(1.1 + Math.PI, h1), gapAt(1.1 + Math.PI / 2, h1)],
      [
        gapAt(0.4, h2),
        gapAt(0.4 + (2 * Math.PI) / 3, h2),
        gapAt(0.4 + (4 * Math.PI) / 3, h2),
      ],
      [
        gapAt(1.85, h3),
        gapAt(1.85 + Math.PI, h3),
        gapAt(0.55, h3),
        gapAt(0.55 + Math.PI, h3),
      ],
    ]

    this.spokes = []
    this.rebuildSpokes(0)
    this.spawnPellets()
  }

  private spoke(ring: number, angle: number): RadialWall {
    const rInner = this.wallRadii[ring]
    const rOuter = ring === this.ringRadii.length - 1 ? this.outerRadius : this.wallRadii[ring + 1]
    return { ring, angle: normAngle(angle), rInner, rOuter }
  }

  /**
   * Place `count` radial walls (0–8). Angles are randomized per level but
   * always at least 1/8 turn (π/4) apart by picking distinct slots on an 8-point wheel.
   */
  rebuildSpokes(count: number): void {
    const n = Math.max(0, Math.min(8, Math.floor(count)))
    this.spokes = []
    if (n === 0) return

    const slotStep = (Math.PI * 2) / 8 // exactly 1/8 of the circle
    const base = Math.random() * Math.PI * 2
    const slots = [0, 1, 2, 3, 4, 5, 6, 7]
    // Fisher–Yates shuffle, take first n
    for (let i = slots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[slots[i], slots[j]] = [slots[j], slots[i]]
    }
    for (let i = 0; i < n; i++) {
      const angle = base + slots[i] * slotStep
      const ring = Math.floor(Math.random() * this.ringRadii.length)
      this.spokes.push(this.spoke(ring, angle))
    }
  }

  /** Configure walls for a level and respawn pellets around them. */
  prepareLevel(wallCount: number): void {
    this.rebuildSpokes(wallCount)
    this.spawnPellets()
    this.prize = null
    this.rotation = 0
  }

  get ringCount(): number {
    return this.ringRadii.length
  }

  rotate(delta: number): void {
    this.rotation = normAngle(this.rotation + delta)
  }

  toLocal(screenAngle: number): number {
    return normAngle(screenAngle - this.rotation)
  }

  toScreen(localAngle: number): number {
    return normAngle(localAngle + this.rotation)
  }

  inGap(wallIndex: number, localAngle: number, pad = 0.012): boolean {
    // Wall 0 (house) is screen-fixed; convert local → screen before testing
    const a = normAngle(wallIndex === 0 ? this.toScreen(localAngle) : localAngle)
    for (const g of this.gaps[wallIndex]) {
      const start = normAngle(g.start - pad)
      const end = normAngle(g.end + pad)
      if (start <= end) {
        if (a >= start && a <= end) return true
      } else if (a >= start || a <= end) {
        return true
      }
    }
    return false
  }

  nearestGapMid(wallIndex: number, localAngle: number): number {
    // Compare in the gap's native space; always return a maze-local angle
    const query = wallIndex === 0 ? this.toScreen(localAngle) : normAngle(localAngle)
    let bestNative = query
    let bestDist = Infinity
    for (const g of this.gaps[wallIndex]) {
      const mid =
        g.start <= g.end
          ? normAngle((g.start + g.end) / 2)
          : normAngle(g.start + (Math.PI * 2 - g.start + g.end) / 2)
      let d = Math.abs(normAngle(mid) - normAngle(query))
      if (d > Math.PI) d = Math.PI * 2 - d
      if (d < bestDist) {
        bestDist = d
        bestNative = mid
      }
    }
    return wallIndex === 0 ? this.toLocal(bestNative) : bestNative
  }

  /** Screen-space midpoint of the house gate (always top of the dial). */
  houseGateScreenMid(): number {
    const g = this.gaps[0][0]
    if (g.start <= g.end) return normAngle((g.start + g.end) / 2)
    return normAngle(g.start + (Math.PI * 2 - g.start + g.end) / 2)
  }

  alignGapToPac(wallIndex: number, pacScreenAngle: number, localAngle: number): void {
    const mid = this.nearestGapMid(wallIndex, localAngle)
    this.rotation = normAngle(pacScreenAngle - mid)
  }

  canPacCross(fromRing: number, towardInner: boolean, localAngle: number): boolean {
    // Generous pad: accept up/down a little before Pac is dead-center in the hole
    if (towardInner) {
      if (fromRing <= 0) return false
      return this.inGap(fromRing, localAngle, PAC_CROSS_PAD)
    }
    if (fromRing >= this.ringCount - 1) return false
    return this.inGap(fromRing + 1, localAngle, PAC_CROSS_PAD)
  }

  wallIndexForPacCross(fromRing: number, towardInner: boolean): number {
    return towardInner ? fromRing : fromRing + 1
  }

  canGhostCross(fromRing: number, towardInner: boolean, localAngle: number): boolean {
    if (towardInner) {
      if (fromRing < 0) return false
      if (fromRing === 0) return this.inGap(0, localAngle)
      return this.inGap(fromRing, localAngle)
    }
    if (fromRing < 0) return this.inGap(0, localAngle)
    if (fromRing >= this.ringCount - 1) return false
    return this.inGap(fromRing + 1, localAngle)
  }

  ringRadius(ring: number): number {
    if (ring < 0) return this.houseRadius * 0.55
    return this.ringRadii[Math.max(0, Math.min(this.ringCount - 1, ring))]
  }

  wallIndexForCross(fromRing: number, towardInner: boolean): number {
    if (towardInner) {
      if (fromRing <= 0) return 0
      return fromRing
    }
    if (fromRing < 0) return 0
    return fromRing + 1
  }

  /**
   * Clamp maze rotation so Pac cannot slide through a radial spoke.
   * rotDelta > 0 → local angle decreases.
   */
  clampRotationForPac(ring: number, localAngle: number, rotDelta: number): number {
    return -this.clampAngularTravel(ring, localAngle, -rotDelta)
  }

  /** Clamp angular travel along a ring (positive = CCW / increasing angle). */
  clampAngularTravel(ring: number, localAngle: number, deltaLocal: number): number {
    if (ring < 0 || deltaLocal === 0) return deltaLocal
    const hitHalf = (PAC_RADIUS * 1.08) / this.ringRadius(ring)
    let allowed = deltaLocal

    for (const s of this.spokes) {
      if (s.ring !== ring) continue
      const toSpoke = angleDelta(localAngle, s.angle)
      if (deltaLocal > 0 && toSpoke > 0) {
        const max = Math.max(0, toSpoke - hitHalf)
        if (allowed > max) allowed = max
      } else if (deltaLocal < 0 && toSpoke < 0) {
        const max = Math.min(0, toSpoke + hitHalf)
        if (allowed < max) allowed = max
      }
    }
    return allowed
  }

  hitsSpoke(ring: number, localAngle: number, moveDir: 1 | -1): boolean {
    if (ring < 0) return false
    const hitHalf = (PAC_RADIUS * 1.08) / this.ringRadius(ring)
    for (const s of this.spokes) {
      if (s.ring !== ring) continue
      const toSpoke = angleDelta(localAngle, s.angle)
      if (Math.sign(toSpoke) === moveDir && Math.abs(toSpoke) <= hitHalf + 0.02) return true
    }
    return false
  }

  /** True if a spoke lies on the short arc from `from` toward `to` in direction `dir`. */
  spokeBlocksPath(ring: number, from: number, to: number, dir: 1 | -1): boolean {
    if (ring < 0) return false
    const span = Math.abs(angleDelta(from, to))
    for (const s of this.spokes) {
      if (s.ring !== ring) continue
      const d = angleDelta(from, s.angle)
      if (Math.sign(d) !== dir) continue
      if (Math.abs(d) > 0.001 && Math.abs(d) < span) return true
    }
    return false
  }

  spawnPellets(): void {
    this.pellets = []
    const outer = this.ringCount - 1
    const second = this.ringCount - 2
    const powerSpots: { ring: number; angle: number }[] = [
      { ring: outer, angle: 0 },
      { ring: outer, angle: Math.PI },
      { ring: second, angle: -Math.PI / 2 },
      { ring: second, angle: Math.PI / 2 },
    ]

    const counts = [16, 22, 28, 34]
    for (let ring = 0; ring < this.ringCount; ring++) {
      const n = counts[ring]
      for (let i = 0; i < n; i++) {
        const angle = (i / n) * Math.PI * 2
        const hitPower = powerSpots.some((p) => {
          if (p.ring !== ring) return false
          let d = Math.abs(normAngle(angle) - normAngle(p.angle))
          if (d > Math.PI) d = Math.PI * 2 - d
          return d < 0.12
        })
        if (hitPower) continue
        const onSpoke = this.spokes.some((s) => {
          if (s.ring !== ring) return false
          let d = Math.abs(normAngle(angle) - normAngle(s.angle))
          if (d > Math.PI) d = Math.PI * 2 - d
          return d < 0.1
        })
        if (onSpoke) continue
        this.pellets.push({ ring, angle, power: false, eaten: false })
      }
    }

    for (const p of powerSpots) {
      this.pellets.push({ ring: p.ring, angle: normAngle(p.angle), power: true, eaten: false })
    }

    this.pelletCount = this.pellets.length
    this.pelletTotal = this.pelletCount
    this.prize = null
  }

  resetPellets(): void {
    for (const p of this.pellets) p.eaten = false
    this.pelletCount = this.pellets.length
    this.pelletTotal = this.pelletCount
    this.prize = null
  }

  /** Pellets eaten so far this level. */
  get pelletsEaten(): number {
    return this.pelletTotal - this.pelletCount
  }

  /**
   * Spawn the level prize once on the bottom of the 3rd ring from outside
   * when at least half the dots are gone. Screen-fixed — does not rotate.
   */
  maybeSpawnPrize(level: number): void {
    if (this.prize) return
    if (this.pelletsEaten < this.pelletTotal * 0.5) return
    const ring = this.ringCount - 3 // 3rd from outside
    if (ring < 0) return
    const idx = Math.min(PRIZE_POINTS.length - 1, Math.max(0, level - 1))
    this.prize = {
      ring,
      angle: PAC_SCREEN_ANGLE, // screen-fixed at bottom of the dial
      points: PRIZE_POINTS[idx],
      kind: fruitKindForLevel(level),
      active: true,
    }
  }

  /** Fruit sits at screen-bottom; Pac eats it by being on that ring. */
  tryEatPrize(ring: number, _localAngle?: number): Prize | null {
    const p = this.prize
    if (!p || !p.active || p.ring !== ring) return null
    p.active = false
    this.prize = null
    return p
  }

  tryEat(ring: number, localAngle: number, radialSlop = 0.12): Pellet | null {
    for (const p of this.pellets) {
      if (p.eaten || p.ring !== ring) continue
      let d = Math.abs(normAngle(p.angle) - normAngle(localAngle))
      if (d > Math.PI) d = Math.PI * 2 - d
      if (d < radialSlop) {
        p.eaten = true
        this.pelletCount--
        return p
      }
    }
    return null
  }
}
