import {
  COLORS,
  DEATH_MS,
  EAT_FREEZE_MS,
  FRIGHTENED_MS,
  GAME_SPEED,
  GAMEOVER_MS,
  PAC_SCREEN_ANGLE,
  PRIZE_MS,
  READY_MS,
  WON_TOTAL_S,
  angleDist,
  dist,
  polarToCart,
} from './constants'
import { GameAudio } from './Audio'
import { Ghost } from './Ghost'
import { Input } from './Input'
import { bestScore, submitRun } from './leaderboard'
import { Maze } from './Maze'
import { PacMan } from './PacMan'
import { Renderer } from './Renderer'
import type { GamePhase } from './types'

const MAX_WALLS = 8

export class Game {
  private maze = new Maze()
  private pac: PacMan
  private ghosts: Ghost[]
  private renderer: Renderer
  readonly input: Input
  private audio = new GameAudio()

  private score = 0
  private highScore = bestScore()
  private lives = 3
  private level = 1
  private phase: GamePhase = 'attract'
  private phaseTimer = READY_MS
  private frightLeft = 0
  private ghostPoints = 200
  private elapsed = 0
  /** Unscaled clock for UI blinks (text, power pellets) — not affected by GAME_SPEED. */
  private visualTime = 0
  private modeClock = 0
  private scatter = true
  private last = 0
  private raf = 0
  /** Pac + non-eaten ghosts freeze while eyes appear after a chomp. */
  private eatFreeze = 0
  private prizeTimer = 0
  private prizeSpawned = false
  private audioArmed = false
  /** True while the start jingle is playing — playfield stays frozen. */
  private awaitingStart = false
  /** Prevents double-start from unlock + startLevel both kicking off the jingle. */
  private jinglePlaying = false
  private eyesAudioOn = false
  /** visualTime when the level-clear intermission began. */
  private wonAt = 0
  private fruitsEaten = 0
  private fruitKindsEaten = new Set<number>()
  private ghostsEaten = 0
  private runRecorded = false

  constructor(canvas: HTMLCanvasElement, shell: HTMLElement) {
    this.renderer = new Renderer(canvas)
    this.input = new Input(shell)
    this.pac = new PacMan(this.maze)
    this.ghosts = [
      new Ghost('blinky', COLORS.blinky, 700),
      new Ghost('pinky', COLORS.pinky, 2200),
      new Ghost('inky', COLORS.inky, 4200),
      new Ghost('clyde', COLORS.clyde, 6800),
    ]
    this.enterAttract()
    this.armAudio(shell)
  }

  private noteScore(points: number): void {
    this.score += points
    if (this.score > this.highScore) this.highScore = this.score
  }

  private recordRunIfNeeded(): void {
    if (this.runRecorded || this.score <= 0) return
    this.runRecorded = true
    const entry = submitRun({
      score: this.score,
      level: this.level,
      fruits: this.fruitsEaten,
      fruitKinds: [...this.fruitKindsEaten],
      ghosts: this.ghostsEaten,
    })
    this.highScore = bestScore()
    void entry
  }

  /** Unlock audio on first gesture (browser autoplay policy). */
  private armAudio(shell: HTMLElement): void {
    const unlock = () => {
      if (this.audioArmed) return
      this.audioArmed = true
      void this.audio.unlock().then(() => {
        if (this.awaitingStart) void this.beginStartJingle()
      })
    }
    shell.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
  }

  /** Play start.wav and keep READY frozen until it ends. */
  private async beginStartJingle(): Promise<void> {
    if (!this.awaitingStart || this.jinglePlaying) return
    this.jinglePlaying = true
    try {
      // First PRESS START often races audio unlock/load — wait before playing.
      await this.audio.unlock()
      if (!this.awaitingStart) return
      await this.audio.playStart()
    } finally {
      this.jinglePlaying = false
    }
    if (!this.awaitingStart) return
    this.awaitingStart = false
    if (this.phase === 'ready') this.phase = 'playing'
  }

  /** Title / demo loop — ghosts roam, waiting for PRESS START. */
  private enterAttract(): void {
    this.score = 0
    this.lives = 3
    this.level = 1
    this.highScore = bestScore()
    this.maze.prepareLevel(this.wallCountForLevel(1))
    this.resetActors(true)
    this.phase = 'attract'
    this.awaitingStart = false
    this.jinglePlaying = false
    this.frightLeft = 0
    this.prizeSpawned = false
    this.prizeTimer = 0
    this.elapsed = 0
    this.audio.stopAll()
  }

  /** Leave attract and begin a real run (jingle → play). */
  private beginGame(): void {
    this.score = 0
    this.lives = 3
    this.fruitsEaten = 0
    this.fruitKindsEaten.clear()
    this.ghostsEaten = 0
    this.runRecorded = false
    this.highScore = bestScore()
    this.startLevel(1)
  }

  start(): void {
    this.last = performance.now()
    const loop = (now: number) => {
      const rawDt = Math.min(0.05, (now - this.last) / 1000)
      this.last = now
      this.visualTime += rawDt
      this.update(rawDt * GAME_SPEED)
      this.renderer.draw(
        this.maze,
        this.pac,
        this.ghosts,
        this.score,
        this.lives,
        this.phase,
        this.frightLeft,
        this.visualTime,
        this.level,
        this.phaseTimer,
        this.highScore,
        this.phase === 'won' ? this.visualTime - this.wonAt : 0,
      )
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  stop(): void {
    cancelAnimationFrame(this.raf)
  }

  /** Level 1 = 0 walls; each clear adds a wall up to 8. Layout is randomized. */
  private wallCountForLevel(level: number): number {
    return Math.min(MAX_WALLS, Math.max(0, level - 1))
  }

  private startLevel(level: number): void {
    this.level = level
    this.maze.prepareLevel(this.wallCountForLevel(level))
    this.resetActors(false)
    this.phase = 'ready'
    this.phaseTimer = READY_MS
    this.elapsed = 0
    this.prizeSpawned = false
    this.prizeTimer = 0
    // Intro jingle only on level 1
    if (level === 1) {
      this.awaitingStart = true
      if (this.audioArmed) void this.beginStartJingle()
    } else {
      this.awaitingStart = false
    }
  }

  private resetActors(attract: boolean, keepPlayfield = false): void {
    // Mid-life deaths keep maze rotation; new level / attract resets it
    if (!keepPlayfield) this.maze.rotation = 0
    this.pac.reset(this.maze)
    const homes = [-0.55, 0.55, Math.PI - 0.55, Math.PI + 0.55]
    this.ghosts.forEach((g, i) => g.reset(true, homes[i], this.maze, attract))
    this.frightLeft = 0
    this.audio.stopAll()
    this.eyesAudioOn = false
    this.ghostPoints = 200
    this.modeClock = 0
    this.scatter = true
    this.eatFreeze = 0
  }

  private eyesReturning(): boolean {
    return this.ghosts.some((g) => g.mode === 'eaten')
  }

  /** Ambient priority: eyes > fright > chase siren. */
  private syncAmbientAudio(): void {
    const eyes = this.eyesReturning()
    if (eyes && !this.eyesAudioOn) {
      this.eyesAudioOn = true
      this.audio.startEyes()
    } else if (!eyes && this.eyesAudioOn) {
      this.eyesAudioOn = false
      this.audio.stopEyes()
      if (this.frightLeft > 0) this.audio.startFright()
      else this.audio.updateSiren(this.maze.pelletCount, this.maze.pelletTotal)
    } else if (!eyes && this.frightLeft <= 0) {
      this.audio.updateSiren(this.maze.pelletCount, this.maze.pelletTotal)
    }
  }

  private updateAttract(dt: number): void {
    if (this.input.consumeRestart()) {
      this.beginGame()
      return
    }

    // Pac idle on the dial; ghosts roam the maze
    this.pac.mouth = -Math.PI / 2
    const local = this.pac.localAngle(this.maze)
    for (const g of this.ghosts) {
      g.update(
        this.maze,
        dt,
        {
          ring: this.pac.ring,
          angle: local,
          facing: this.pac.facing,
          radius: this.pac.radius,
        },
        this.ghosts[0],
        this.elapsed,
        true,
      )
    }
    this.resolveGhostBumps()
  }

  private update(dt: number): void {
    this.elapsed += dt

    if (this.phase === 'attract') {
      this.updateAttract(dt)
      return
    }

    if (this.phase === 'gameover') {
      this.phaseTimer -= dt * 1000
      if (this.phaseTimer <= 0 || this.input.consumeRestart()) this.enterAttract()
      return
    }

    // Dial / START taps only matter in attract & game over
    this.input.consumeRestart()

    if (this.phase === 'won') {
      if (this.visualTime - this.wonAt >= WON_TOTAL_S) this.startLevel(this.level + 1)
      return
    }

    if (this.phase === 'ready') {
      // Frozen for the full start jingle; after death, short READY beat only
      if (this.awaitingStart) return
      this.phaseTimer -= dt * 1000
      if (this.phaseTimer <= 0) this.phase = 'playing'
      return
    }

    if (this.phase === 'dying') {
      this.phaseTimer -= dt * 1000
      if (this.phaseTimer <= 0) {
        if (this.lives <= 0) {
          this.recordRunIfNeeded()
          this.phase = 'gameover'
          this.phaseTimer = GAMEOVER_MS
        } else {
          this.resetActors(false, true)
          this.phase = 'ready'
          this.phaseTimer = READY_MS
          this.awaitingStart = false
        }
      }
      return
    }

    // Momentary freeze: Pac + living ghosts hold; eyes keep running home
    if (this.eatFreeze > 0) {
      this.eatFreeze -= dt * 1000
      const local = this.pac.localAngle(this.maze)
      for (const g of this.ghosts) {
        if (g.mode !== 'eaten') continue
        g.update(
          this.maze,
          dt,
          {
            ring: this.pac.ring,
            angle: local,
            facing: this.pac.facing,
            radius: this.pac.radius,
          },
          this.ghosts[0],
          this.elapsed,
          false,
        )
      }
      this.syncAmbientAudio()
      return
    }

    this.updateModes(dt)
    this.pac.update(this.maze, dt, this.input.held, this.input.consumeRotateImpulse())

    const local = this.pac.localAngle(this.maze)
    const ring = this.pac.occupancyRing(this.maze)
    const eaten = this.maze.tryEat(ring, local)
    if (eaten) {
      this.noteScore(eaten.power ? 50 : 10)
      if (eaten.power) {
        this.frightLeft = FRIGHTENED_MS
        this.ghostPoints = 200
        for (const g of this.ghosts) g.frighten()
        if (!this.eyesReturning()) this.audio.startFright()
      } else {
        this.audio.playMunch()
      }
      if (!this.prizeSpawned) {
        this.maze.maybeSpawnPrize(this.level)
        if (this.maze.prize) {
          this.prizeSpawned = true
          this.prizeTimer = PRIZE_MS
        }
      }
    }

    const prize = this.maze.tryEatPrize(ring)
    if (prize) {
      this.noteScore(prize.points)
      this.fruitsEaten++
      this.fruitKindsEaten.add(prize.kind)
      this.prizeTimer = 0
      this.audio.playEatFruit()
    } else if (this.maze.prize?.active) {
      this.prizeTimer -= dt * 1000
      if (this.prizeTimer <= 0) {
        this.maze.prize = null
      }
    }

    if (this.frightLeft > 0) {
      this.frightLeft -= dt * 1000
      if (this.frightLeft <= 0) {
        this.frightLeft = 0
        this.audio.stopFright()
        for (const g of this.ghosts) {
          if (g.mode === 'frightened') {
            g.setMode(this.scatter ? 'scatter' : 'chase', true)
          }
        }
      }
    }

    for (const g of this.ghosts) {
      g.update(
        this.maze,
        dt,
        {
          ring: this.pac.ring,
          angle: local,
          facing: this.pac.facing,
          radius: this.pac.radius,
        },
        this.ghosts[0],
        this.elapsed,
        false,
      )
    }

    this.syncAmbientAudio()
    this.resolveGhostBumps()
    this.resolveCollisions()
    if (this.maze.pelletCount <= 0) {
      this.audio.stopAll()
      this.phase = 'won'
      this.wonAt = this.visualTime
    }
  }

  private resolveGhostBumps(): void {
    const list = this.ghosts
    for (let i = 0; i < list.length; i++) {
      const a = list[i]
      if (a.mode === 'house' || a.mode === 'eaten') continue
      if (a.ring < 0) continue
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j]
        if (b.mode === 'house' || b.mode === 'eaten') continue
        if (b.ring < 0) continue
        if (a.ring !== b.ring) continue
        if (Math.abs(a.radius - b.radius) > 10) continue
        if (angleDist(a.angle, b.angle) > 0.28) continue
        a.bounceOffGhost()
        b.bounceOffGhost()
      }
    }
  }

  private updateModes(dt: number): void {
    if (this.frightLeft > 0) return
    this.modeClock += dt * 1000
    const schedule = this.scatter ? 7000 : 20000
    if (this.modeClock >= schedule) {
      this.modeClock = 0
      this.scatter = !this.scatter
      const mode = this.scatter ? 'scatter' : 'chase'
      for (const g of this.ghosts) g.setMode(mode)
    }
  }

  private resolveCollisions(): void {
    const pacPos = polarToCart(this.pac.radius, PAC_SCREEN_ANGLE)

    for (const g of this.ghosts) {
      if (g.mode === 'house' || g.mode === 'eaten') continue
      const gScreen = this.maze.toScreen(g.angle)
      const gPos = polarToCart(g.radius, gScreen)
      if (dist(pacPos.x, pacPos.y, gPos.x, gPos.y) > 14) continue

      if (g.mode === 'frightened') {
        g.becomeEaten(this.maze)
        this.noteScore(this.ghostPoints)
        this.ghostsEaten++
        this.ghostPoints *= 2
        this.eatFreeze = EAT_FREEZE_MS
        this.audio.playEatGhost()
        return
      }

      this.pac.alive = false
      this.lives--
      this.audio.playDeath()
      this.frightLeft = 0
      this.eyesAudioOn = false
      this.phase = 'dying'
      this.phaseTimer = DEATH_MS
      return
    }
  }
}
