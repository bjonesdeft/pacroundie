import {
  CANVAS,
  COLORS,
  CX,
  CY,
  DEATH_MS,
  PAC_RADIUS,
  PAC_SCREEN_ANGLE,
  WON_FLASH_DURATION_S,
  WON_FLASH_HALF_S,
  WON_FADE_S,
  WON_SPIN_REVS,
  polarToCart,
} from './constants'
import type { Ghost } from './Ghost'
import type { Maze } from './Maze'
import type { PacMan } from './PacMan'
import type { Dir, GamePhase } from './types'

export class Renderer {
  readonly canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    canvas.width = CANVAS
    canvas.height = CANVAS
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas unsupported')
    this.ctx = ctx
  }

  draw(
    maze: Maze,
    pac: PacMan,
    ghosts: Ghost[],
    score: number,
    lives: number,
    phase: GamePhase,
    frightLeft: number,
    time: number,
    level = 1,
    phaseTimer = 0,
    highScore = 0,
    wonT = 0,
  ): void {
    const ctx = this.ctx
    const radius = CANVAS / 2 - 1
    const flashWhite = phase === 'won' && this.wonFlashWhite(wonT)
    const wallColor = flashWhite ? '#ffffff' : COLORS.wall
    const wallInner = flashWhite ? '#ffffff' : COLORS.wallInner

    ctx.save()
    ctx.beginPath()
    ctx.arc(CX, CY, radius, 0, Math.PI * 2)
    ctx.clip()

    ctx.fillStyle = COLORS.bg
    ctx.fillRect(0, 0, CANVAS, CANVAS)

    // Rotating maze frame — walls & pellets
    ctx.save()
    ctx.translate(CX, CY)
    ctx.rotate(maze.rotation)
    this.drawWalls(maze, wallColor, wallInner)
    this.drawPellets(maze, time)
    if (phase === 'won') this.drawWonWords(maze, wonT)
    ctx.restore()

    // House + innermost wall (screen-fixed gate)
    ctx.save()
    ctx.translate(CX, CY)
    this.drawHouse(maze, wallColor, wallInner, flashWhite)
    ctx.restore()

    // Maze ghosts above the fixed inner wall so they aren't clipped away
    if (phase !== 'won') {
      ctx.save()
      ctx.translate(CX, CY)
      ctx.rotate(maze.rotation)
      for (const g of ghosts) {
        if (!g.inSpawnVisual) this.drawGhost(g, frightLeft, time)
      }
      ctx.restore()
    }

    // Fruit, returning eyes, and house ghosts stay screen-fixed
    ctx.save()
    ctx.translate(CX, CY)
    if (phase !== 'won') {
      this.drawPrize(maze)
      for (const g of ghosts) {
        if (g.inSpawnVisual) this.drawGhost(g, frightLeft, time)
      }
    }
    this.drawHouseLives(maze, lives)
    ctx.restore()

    if (phase !== 'won' && (pac.alive || phase === 'dying')) {
      this.drawPac(pac, phase, time, phaseTimer)
    }

    this.drawHud(score, lives, phase, level, time, highScore)
    ctx.restore()

    ctx.beginPath()
    ctx.arc(CX, CY, radius, 0, Math.PI * 2)
    ctx.strokeStyle = wallColor
    ctx.lineWidth = 3
    ctx.stroke()
  }

  /** True on the white half of each 0.5s flash beat. */
  private wonFlashWhite(wonT: number): boolean {
    if (wonT < 0 || wonT >= WON_FLASH_DURATION_S) return false
    return Math.floor(wonT / WON_FLASH_HALF_S) % 2 === 0
  }

  private drawHouse(
    maze: Maze,
    wallColor: string = COLORS.wall,
    wallInner: string = COLORS.wallInner,
    flashWhite = false,
  ): void {
    const ctx = this.ctx
    ctx.fillStyle = COLORS.house
    ctx.beginPath()
    ctx.arc(0, 0, maze.houseRadius, 0, Math.PI * 2)
    ctx.fill()

    // Innermost wall (screen-fixed) with house gate cutout
    this.strokeRing(maze.wallRadii[0], maze.gaps[0], 3.2, wallColor)
    this.strokeRing(maze.wallRadii[0] - 2.5, maze.gaps[0], 1.1, wallInner)

    ctx.strokeStyle = flashWhite ? '#ffffff' : COLORS.gate
    ctx.lineWidth = 2.5
    for (const g of maze.gaps[0]) {
      ctx.beginPath()
      ctx.arc(0, 0, maze.wallRadii[0], g.start, g.end)
      ctx.stroke()
    }
  }

  private strokeRing(
    r: number,
    gaps: { start: number; end: number }[],
    width: number,
    color: string,
  ): void {
    const ctx = this.ctx
    type Seg = { a: number; b: number }
    const blocked: Seg[] = []
    for (const g of gaps) {
      if (g.start <= g.end) blocked.push({ a: g.start, b: g.end })
      else {
        blocked.push({ a: g.start, b: Math.PI * 2 })
        blocked.push({ a: 0, b: g.end })
      }
    }
    blocked.sort((x, y) => x.a - y.a)
    const merged: Seg[] = []
    for (const b of blocked) {
      const last = merged[merged.length - 1]
      if (last && b.a <= last.b) last.b = Math.max(last.b, b.b)
      else merged.push({ ...b })
    }
    const solids: Seg[] = []
    let cursor = 0
    for (const b of merged) {
      if (b.a > cursor) solids.push({ a: cursor, b: b.a })
      cursor = Math.max(cursor, b.b)
    }
    if (cursor < Math.PI * 2) solids.push({ a: cursor, b: Math.PI * 2 })

    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.lineCap = 'butt'
    for (const s of solids) {
      if (s.b - s.a < 0.02) continue
      ctx.beginPath()
      ctx.arc(0, 0, r, s.a, s.b)
      ctx.stroke()
    }
  }

  private drawWalls(
    maze: Maze,
    wallColor: string = COLORS.wall,
    wallInner: string = COLORS.wallInner,
  ): void {
    const ctx = this.ctx

    ctx.strokeStyle = wallColor
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(0, 0, maze.outerRadius, 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeStyle = wallInner
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.arc(0, 0, maze.outerRadius - 3, 0, Math.PI * 2)
    ctx.stroke()

    // Skip wall 0 — drawn screen-fixed with the house
    for (let i = 1; i < maze.wallRadii.length; i++) {
      const r = maze.wallRadii[i]
      this.strokeRing(r, maze.gaps[i], 2.8, wallColor)
      this.strokeRing(r - 2.5, maze.gaps[i], 1.1, wallInner)
    }

    for (const s of maze.spokes) {
      ctx.strokeStyle = wallColor
      ctx.lineWidth = 2.6
      ctx.beginPath()
      ctx.moveTo(Math.cos(s.angle) * (s.rInner + 2), Math.sin(s.angle) * (s.rInner + 2))
      ctx.lineTo(
        Math.cos(s.angle) * (s.rOuter - 2),
        Math.sin(s.angle) * (s.rOuter - 2),
      )
      ctx.stroke()
    }
  }

  /**
   * During the white flashes: "NEXT" and "LEVEL" spin on the outer two rings.
   * When flashing ends they hold and fade out, then play resumes.
   */
  private drawWonWords(maze: Maze, wonT: number): void {
    if (wonT < 0 || wonT >= WON_FLASH_DURATION_S + WON_FADE_S) return

    const revs = WON_SPIN_REVS * Math.PI * 2
    const start = -Math.PI / 2
    // Spin completes across the flash window; hold final pose while fading
    const p = Math.min(1, wonT / WON_FLASH_DURATION_S)
    const nextAngle = start - p * revs
    const levelAngle = start + p * revs

    let alpha = 1
    if (wonT >= WON_FLASH_DURATION_S) {
      alpha = 1 - (wonT - WON_FLASH_DURATION_S) / WON_FADE_S
    }
    if (alpha <= 0) return

    this.drawRingWord('NEXT', maze.ringRadii[maze.ringRadii.length - 1], nextAngle, alpha)
    this.drawRingWord('LEVEL', maze.ringRadii[maze.ringRadii.length - 2], levelAngle, alpha)
  }

  /** Letters along a ring lane, feet toward center, readable along the arc. */
  private drawRingWord(word: string, radius: number, centerAngle: number, alpha = 1): void {
    const ctx = this.ctx
    ctx.save()
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha))
    ctx.font = 'bold 11px "Press Start 2P", "Courier New", monospace'
    ctx.fillStyle = COLORS.ready
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const widths: number[] = []
    let total = 0
    const pad = 3
    for (let i = 0; i < word.length; i++) {
      const w = ctx.measureText(word[i]!).width
      widths.push(w)
      total += w
    }
    total += pad * Math.max(0, word.length - 1)

    let cursor = -total / 2
    for (let i = 0; i < word.length; i++) {
      const w = widths[i]!
      const mid = cursor + w / 2
      // Progress clockwise along the ring so L→R reads naturally at the bottom
      const a = centerAngle - mid / radius
      const x = Math.cos(a) * radius
      const y = Math.sin(a) * radius
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(a + Math.PI / 2)
      ctx.fillText(word[i]!, 0, 0)
      ctx.restore()
      cursor += w + pad
    }
    ctx.restore()
  }

  private drawPellets(maze: Maze, time: number): void {
    const ctx = this.ctx
    const pulse = 0.5 + 0.5 * Math.sin(time * 8)

    for (const p of maze.pellets) {
      if (p.eaten) continue
      const r = maze.ringRadius(p.ring)
      const x = Math.cos(p.angle) * r
      const y = Math.sin(p.angle) * r
      if (p.power) {
        ctx.fillStyle = COLORS.power
        ctx.globalAlpha = 0.45 + pulse * 0.55
        ctx.beginPath()
        ctx.arc(x, y, 5, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1
      } else {
        ctx.fillStyle = COLORS.pellet
        ctx.beginPath()
        ctx.arc(x, y, 1.7, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }

  /** Screen-fixed cherry — does not rotate with the maze. */
  private drawPrize(maze: Maze): void {
    const p = maze.prize
    if (!p?.active) return
    const ctx = this.ctx
    const r = maze.ringRadius(p.ring)
    const x = Math.cos(p.angle) * r
    const y = Math.sin(p.angle) * r

    ctx.save()
    ctx.translate(x, y)

    // Stem
    ctx.strokeStyle = COLORS.prizeLeaf
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.moveTo(-2, -6)
    ctx.quadraticCurveTo(0, -10, 3, -7)
    ctx.stroke()

    // Leaf
    ctx.fillStyle = COLORS.prizeLeaf
    ctx.beginPath()
    ctx.ellipse(1, -9, 3.2, 1.6, -0.5, 0, Math.PI * 2)
    ctx.fill()

    // Twin cherries
    ctx.fillStyle = COLORS.prize
    ctx.beginPath()
    ctx.arc(-2.5, -1, 4.2, 0, Math.PI * 2)
    ctx.arc(3, 0.5, 4.2, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()
  }

  private drawPac(pac: PacMan, phase: GamePhase, time: number, phaseTimer = 0): void {
    const ctx = this.ctx
    const pos = polarToCart(pac.radius, PAC_SCREEN_ANGLE)
    const size = PAC_RADIUS
    const base = pac.facingAngle

    if (phase === 'dying') {
      // Melt Pac for most of the death, then a small starburst when he's gone
      const t = Math.min(1, Math.max(0, 1 - phaseTimer / DEATH_MS))
      if (t < 0.82) {
        const open = Math.PI * 2 * (t / 0.82)
        ctx.fillStyle = COLORS.pac
        ctx.beginPath()
        ctx.moveTo(pos.x, pos.y)
        ctx.arc(pos.x, pos.y, size, base + open / 2, base + Math.PI * 2 - open / 2)
        ctx.closePath()
        ctx.fill()
      } else {
        const burstT = (t - 0.82) / 0.18
        this.drawDeathStarburst(pos.x, pos.y, burstT, time)
      }
      return
    }

    const chomp = (Math.sin(pac.mouth) + 1) * 0.32
    ctx.fillStyle = COLORS.pac
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
    ctx.arc(pos.x, pos.y, size, base + chomp, base + Math.PI * 2 - chomp)
    ctx.closePath()
    ctx.fill()
  }

  /** Small yellow starburst after Pac finishes melting. */
  private drawDeathStarburst(x: number, y: number, t: number, time: number): void {
    const ctx = this.ctx
    const fade = t < 0.35 ? t / 0.35 : 1 - (t - 0.35) / 0.65
    const alpha = Math.max(0, Math.min(1, fade))
    const spin = time * 8
    const rays = 8
    const inner = 2 + t * 2
    const outer = 6 + t * 10

    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(spin)
    ctx.globalAlpha = alpha
    ctx.fillStyle = COLORS.pac
    ctx.beginPath()
    for (let i = 0; i < rays * 2; i++) {
      const a = (i / (rays * 2)) * Math.PI * 2
      const r = i % 2 === 0 ? outer : inner
      const px = Math.cos(a) * r
      const py = Math.sin(a) * r
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fill()

    // Tiny core spark
    ctx.beginPath()
    ctx.arc(0, 0, 1.6 + (1 - t) * 1.2, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  /**
   * Arcade ghost: compact dome, eyes look along movement.
   * In the maze, sprite rotates with ring angle (feet outward).
   * In the spawn, stays screen-upright.
   */
  private drawGhost(g: Ghost, frightLeft: number, time: number): void {
    const ctx = this.ctx
    const x = Math.cos(g.angle) * g.radius
    const y = Math.sin(g.angle) * g.radius
    const onMaze = !g.inSpawnVisual

    ctx.save()
    ctx.translate(x, y)
    if (onMaze) {
      // Orient to the ring without flipping upright — feet along the skirt axis
      ctx.rotate(g.angle + Math.PI / 2)
    }
    ctx.translate(0, onMaze ? g.bobOffset : g.bobOffset)

    if (g.mode === 'eaten') {
      this.drawArcadeEyes(0, -2.8, g.facing, true)
      ctx.restore()
      return
    }

    const scared = g.mode === 'frightened'
    const flashing = scared && frightLeft < 2000 && Math.floor(time * 5) % 2 === 0
    const body = scared
      ? flashing
        ? COLORS.frightenedFlash
        : COLORS.frightened
      : g.color

    const w = 7.6
    const domeCy = 0.8
    const skirtY = 5.2

    ctx.fillStyle = body
    ctx.beginPath()
    ctx.arc(0, domeCy, w, Math.PI, 0, false)
    ctx.lineTo(w, skirtY)

    const frame = Math.floor(g.skirtPhase) % 2
    this.traceRippleSkirt(ctx, -w, w, skirtY, frame)
    ctx.closePath()
    ctx.fill()

    if (scared) {
      const face = flashing ? '#ffb8de' : '#ffb8ff'
      ctx.fillStyle = flashing ? '#2121de' : face
      ctx.fillRect(-4.2, -3.6, 2.6, 2.6)
      ctx.fillRect(1.6, -3.6, 2.6, 2.6)
      ctx.strokeStyle = flashing ? '#2121de' : face
      ctx.lineWidth = 1.4
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(-4.8, 1.6)
      ctx.lineTo(-2.4, 3.6)
      ctx.lineTo(0, 1.6)
      ctx.lineTo(2.4, 3.6)
      ctx.lineTo(4.8, 1.6)
      ctx.stroke()
    } else {
      this.drawArcadeEyes(0, -3.2, g.facing, true)
    }

    ctx.restore()
  }

  /** Classic arcade skirt: pointed scallops, two frames for the walk ripple. */
  private traceRippleSkirt(
    ctx: CanvasRenderingContext2D,
    left: number,
    right: number,
    y: number,
    frame: number,
  ): void {
    const width = right - left
    // Arcade ghosts use ~3 pointed flaps; frames shift by half a flap
    const flaps = 3
    const tip = 4.2
    const notch = 0.4
    const phase = frame === 0 ? 0 : 0.5

    // Right edge down to first tip, then zig-zag leftward
    for (let i = 0; i <= flaps * 2; i++) {
      const t = (i + phase) / (flaps * 2)
      const px = right - t * width
      // Even indices = tips (low), odd = notches (high) — creates the ripple
      const isTip = i % 2 === 0
      const py = y + (isTip ? tip : notch)
      ctx.lineTo(px, py)
    }
    ctx.lineTo(left, y)
  }

  private drawArcadeEyes(cx: number, cy: number, facing: Dir, withPupils: boolean): void {
    const ctx = this.ctx
    const eyeDx = 3.2
    for (const side of [-1, 1]) {
      ctx.fillStyle = COLORS.eyes
      ctx.beginPath()
      ctx.ellipse(cx + side * eyeDx, cy, 2.6, 3.1, 0, 0, Math.PI * 2)
      ctx.fill()
    }

    if (!withPupils) return

    // Pupils only — body orientation stays fixed. With ring rotate(+π/2),
    // local +Y is toward center, so "up"/inner looks +Y and "down"/outer looks −Y.
    let px = 0
    let py = 0
    switch (facing) {
      case 'left':
        px = -1.55
        break
      case 'right':
        px = 1.55
        break
      case 'up':
        py = 1.45
        break
      case 'down':
        py = -1.55
        break
    }

    for (const side of [-1, 1]) {
      ctx.fillStyle = COLORS.pupil
      ctx.beginPath()
      ctx.arc(cx + side * eyeDx + px, cy + py, 1.35, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  /** Tiny spare Pacs near the floor of the ghost house (extras only). */
  private drawHouseLives(maze: Maze, lives: number): void {
    const reserve = Math.max(0, lives - 1)
    if (reserve <= 0) return
    const ctx = this.ctx
    const y = maze.houseRadius - 5.5
    const spacing = 12
    const startX = -((reserve - 1) * spacing) / 2
    const r = 4.2

    for (let i = 0; i < reserve; i++) {
      const x = startX + i * spacing
      ctx.fillStyle = COLORS.pac
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.arc(x, y, r, 0.45, Math.PI * 2 - 0.45)
      ctx.closePath()
      ctx.fill()
    }
  }

  private drawHud(
    score: number,
    _lives: number,
    phase: GamePhase,
    level: number,
    time: number,
    highScore: number,
  ): void {
    const ctx = this.ctx
    ctx.fillStyle = COLORS.score
    ctx.font = 'bold 11px "Press Start 2P", "Courier New", monospace'
    ctx.textAlign = 'center'
    ctx.fillText(String(score).padStart(4, '0'), CX, 18)

    if (phase !== 'attract') {
      ctx.font = 'bold 8px "Press Start 2P", "Courier New", monospace'
      ctx.fillStyle = '#a0a0c0'
      ctx.fillText(`L${level}`, CX, 32)
    }

    if (phase === 'attract') {
      // Upper ghost house — sits above PRESS START
      ctx.fillStyle = '#a0a0c0'
      ctx.font = 'bold 5px "Press Start 2P", "Courier New", monospace'
      ctx.fillText('HIGH SCORE', CX, CY - 16)
      ctx.fillStyle = COLORS.score
      ctx.font = 'bold 9px "Press Start 2P", "Courier New", monospace'
      ctx.fillText(String(highScore).padStart(4, '0'), CX, CY - 4)

      // Classic arcade blink — lower house so it clears the high score
      if (Math.floor(time * 2.4) % 2 === 0) {
        ctx.fillStyle = COLORS.ready
        ctx.font = 'bold 9px "Press Start 2P", "Courier New", monospace'
        ctx.fillText('PRESS START', CX, CY + 16)
      }
    } else if (phase === 'ready') {
      ctx.fillStyle = COLORS.ready
      ctx.font = 'bold 12px "Press Start 2P", "Courier New", monospace'
      ctx.fillText('READY!', CX, CY + 8)
    } else if (phase === 'nameentry') {
      ctx.fillStyle = COLORS.ready
      ctx.font = 'bold 9px "Press Start 2P", "Courier New", monospace'
      ctx.fillText('HIGH SCORE!', CX, CY + 8)
    } else if (phase === 'gameover') {
      ctx.fillStyle = '#ff0000'
      ctx.font = 'bold 11px "Press Start 2P", "Courier New", monospace'
      ctx.fillText('GAME OVER', CX, CY + 8)
    }
  }
}
