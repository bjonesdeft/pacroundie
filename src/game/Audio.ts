/**
 * Classic Pac-Man SFX from `src/sounds/`.
 * Uses Web Audio buffers so loops are sample-accurate (no HTMLAudio gap).
 */

const FILES = [
  'eat_dot_0',
  'eat_dot_1',
  'fright',
  'fright_firstloop',
  'eat_fruit',
  'eat_ghost',
  'eyes',
  'eyes_firstloop',
  'death',
  'start',
  'credit',
  'extend',
  'intermission',
  'siren0',
  'siren0_firstloop',
  'siren1',
  'siren1_firstloop',
  'siren2',
  'siren2_firstloop',
  'siren3',
  'siren3_firstloop',
  'siren4',
  'siren4_firstloop',
] as const

type SoundName = (typeof FILES)[number]
type Ambient = 'none' | 'siren' | 'fright' | 'eyes'

function soundUrl(name: SoundName): string {
  const ext = name === 'death' ? 'mp3' : 'wav'
  return new URL(`../sounds/${name}.${ext}`, import.meta.url).href
}

export class GameAudio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private buffers = new Map<SoundName, AudioBuffer>()
  private loadPromise: Promise<void> | null = null
  private unlocked = false
  private munchHi = true

  private ambient: Ambient = 'none'
  private ambientSiren = -1
  private ambientNodes: AudioBufferSourceNode[] = []
  private ambientGen = 0

  private ensureCtx(): AudioContext {
    if (!this.ctx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ctx = new Ctx()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.45
      this.master.connect(this.ctx.destination)
    }
    return this.ctx
  }

  /** Prefetch + decode all WAVs into AudioBuffers. */
  private loadAll(): Promise<void> {
    if (this.loadPromise) return this.loadPromise
    const ctx = this.ensureCtx()
    this.loadPromise = Promise.all(
      FILES.map(async (name) => {
        const res = await fetch(soundUrl(name))
        const raw = await res.arrayBuffer()
        const buf = await ctx.decodeAudioData(raw.slice(0))
        this.buffers.set(name, buf)
      }),
    ).then(() => undefined)
    return this.loadPromise
  }

  /** Browsers require a user gesture before audio can start. */
  async unlock(): Promise<void> {
    const ctx = this.ensureCtx()
    if (ctx.state === 'suspended') await ctx.resume()
    this.unlocked = true
    await this.loadAll()
  }

  private canPlay(): boolean {
    return this.unlocked && this.buffers.size > 0
  }

  private playBuffer(
    name: SoundName,
    opts: { volume?: number; loop?: boolean; when?: number } = {},
  ): AudioBufferSourceNode | null {
    if (!this.canPlay() || !this.ctx || !this.master) return null
    const buf = this.buffers.get(name)
    if (!buf) return null

    const src = this.ctx.createBufferSource()
    const gain = this.ctx.createGain()
    src.buffer = buf
    src.loop = opts.loop ?? false
    gain.gain.value = opts.volume ?? 0.55
    src.connect(gain)
    gain.connect(this.master)
    src.start(opts.when ?? 0)
    return src
  }

  private stopAmbient(): void {
    this.ambientGen++
    for (const n of this.ambientNodes) {
      try {
        n.stop()
      } catch {
        /* already stopped */
      }
      try {
        n.disconnect()
      } catch {
        /* ignore */
      }
    }
    this.ambientNodes = []
    this.ambient = 'none'
  }

  /**
   * Intro once, then sustain loops with sample-accurate handoff (no gap).
   */
  private startLooped(first: SoundName, loop: SoundName, kind: Ambient, volume = 0.4): void {
    if (!this.canPlay() || !this.ctx) return
    this.stopAmbient()
    this.ambient = kind
    const gen = this.ambientGen

    const firstBuf = this.buffers.get(first)
    const loopBuf = this.buffers.get(loop)
    if (!firstBuf || !loopBuf) return

    const t0 = this.ctx.currentTime
    const intro = this.playBuffer(first, { volume, when: t0 })
    if (!intro) return
    this.ambientNodes.push(intro)

    const sustainAt = t0 + firstBuf.duration
    const sustain = this.playBuffer(loop, { volume, loop: true, when: sustainAt })
    if (!sustain) return
    this.ambientNodes.push(sustain)

    intro.onended = () => {
      if (gen !== this.ambientGen) return
      // Intro finished; sustain already scheduled — drop intro from list
      this.ambientNodes = this.ambientNodes.filter((n) => n !== intro)
    }
  }

  /** Alternating waka when a normal pellet is eaten. */
  playMunch(): void {
    this.playBuffer(this.munchHi ? 'eat_dot_0' : 'eat_dot_1', { volume: 0.5 })
    this.munchHi = !this.munchHi
  }

  /**
   * Play the level-start jingle. Resolves when it finishes (or immediately if muted).
   * Waits for buffers so a first-gesture start doesn't skip the tune.
   */
  async playStart(): Promise<void> {
    await this.loadAll()
    if (!this.unlocked || !this.ctx) return
    const buf = this.buffers.get('start')
    if (!buf) return

    return new Promise((resolve) => {
      const src = this.playBuffer('start', { volume: 0.5 })
      if (!src) {
        resolve()
        return
      }
      let done = false
      const finish = () => {
        if (done) return
        done = true
        resolve()
      }
      src.onended = finish
      // Safety if onended never fires
      window.setTimeout(finish, (buf.duration + 0.15) * 1000)
    })
  }

  playEatFruit(): void {
    this.playBuffer('eat_fruit', { volume: 0.55 })
  }

  playEatGhost(): void {
    this.playBuffer('eat_ghost', { volume: 0.55 })
  }

  playDeath(): void {
    this.playBuffer('death', { volume: 0.6 })
    this.stopAmbient()
    this.ambientSiren = -1
  }

  playExtend(): void {
    this.playBuffer('extend', { volume: 0.5 })
  }

  startFright(): void {
    this.ambientSiren = -1
    this.startLooped('fright_firstloop', 'fright', 'fright', 0.42)
  }

  stopFright(): void {
    if (this.ambient === 'fright') this.stopAmbient()
  }

  startEyes(): void {
    this.startLooped('eyes_firstloop', 'eyes', 'eyes', 0.42)
  }

  stopEyes(): void {
    if (this.ambient === 'eyes') this.stopAmbient()
  }

  updateSiren(pelletsLeft: number, pelletTotal: number): void {
    if (!this.canPlay()) return
    if (this.ambient === 'fright' || this.ambient === 'eyes') return
    if (pelletTotal <= 0) return

    const eatenFrac = 1 - pelletsLeft / pelletTotal
    const idx = Math.min(4, Math.floor(eatenFrac * 5))
    if (this.ambient === 'siren' && this.ambientSiren === idx) return

    this.ambientSiren = idx
    const loops: [SoundName, SoundName][] = [
      ['siren0_firstloop', 'siren0'],
      ['siren1_firstloop', 'siren1'],
      ['siren2_firstloop', 'siren2'],
      ['siren3_firstloop', 'siren3'],
      ['siren4_firstloop', 'siren4'],
    ]
    const pair = loops[idx]
    this.startLooped(pair[0], pair[1], 'siren', 0.32)
  }

  stopAll(): void {
    this.stopAmbient()
    this.ambientSiren = -1
  }
}
