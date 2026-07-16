import type { Dir } from './types'

const KEY_MAP: Record<string, Dir> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  W: 'up',
  s: 'down',
  S: 'down',
  a: 'left',
  A: 'left',
  d: 'right',
  D: 'right',
}

const DIRS: Dir[] = ['up', 'down', 'left', 'right']

/** Radians nudge on first press — same as a keyboard keydown. */
const TAP_ROTATE = 0.12

/**
 * Keyboard + on-screen joypad.
 * Pad buttons hold directions exactly like arrow keys (hold to keep moving).
 * Tap the dial or START to begin / dismiss.
 */
export class Input {
  readonly held = new Set<Dir>()
  private restart = false
  private rotateImpulse = 0
  /** Nested press counts so keyboard + pad don't fight. */
  private pressCount = new Map<Dir, number>()

  constructor(target: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return
      const dir = KEY_MAP[e.key]
      if (dir) {
        e.preventDefault()
        this.press(dir)
      }
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        this.restart = true
      }
    })

    window.addEventListener('keyup', (e) => {
      const dir = KEY_MAP[e.key]
      if (dir) this.release(dir)
    })

    window.addEventListener('blur', () => this.clearAll())
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.clearAll()
    })

    // Dial / canvas: tap only (movement is joypad / keyboard)
    target.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      this.restart = true
    })
    target.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false })
  }

  /**
   * Classic D-pad: hold a direction like a key; slide finger to change direction;
   * release to stop. START mirrors Space / Enter.
   */
  bindPad(root: HTMLElement): void {
    let pointerId: number | null = null
    let activeDir: Dir | null = null

    const dirAt = (x: number, y: number): Dir | null => {
      const el = document.elementFromPoint(x, y)
      const btn = el?.closest?.('[data-dir]') as HTMLElement | null
      const dir = btn?.dataset.dir as Dir | undefined
      return dir && DIRS.includes(dir) ? dir : null
    }

    const setActive = (dir: Dir | null) => {
      if (dir === activeDir) return
      if (activeDir) {
        this.release(activeDir)
        root.querySelector(`[data-dir="${activeDir}"]`)?.classList.remove('is-down')
      }
      activeDir = dir
      if (dir) {
        this.press(dir)
        root.querySelector(`[data-dir="${dir}"]`)?.classList.add('is-down')
      }
    }

    const onDown = (e: PointerEvent) => {
      if (pointerId !== null) return
      const start = e.target as HTMLElement | null
      if (start?.closest?.('[data-action="start"]')) {
        e.preventDefault()
        this.restart = true
        return
      }
      if (!start?.closest?.('[data-dir]')) return
      e.preventDefault()
      pointerId = e.pointerId
      try {
        root.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      setActive(dirAt(e.clientX, e.clientY))
    }

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return
      e.preventDefault()
      setActive(dirAt(e.clientX, e.clientY))
    }

    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return
      e.preventDefault()
      pointerId = null
      setActive(null)
      try {
        root.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    }

    root.addEventListener('pointerdown', onDown)
    root.addEventListener('pointermove', onMove)
    root.addEventListener('pointerup', onUp)
    root.addEventListener('pointercancel', onUp)
    root.addEventListener('lostpointercapture', () => {
      pointerId = null
      setActive(null)
    })
    root.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false })
  }

  /** Same path as a keyboard keydown. */
  press(dir: Dir): void {
    const n = (this.pressCount.get(dir) ?? 0) + 1
    this.pressCount.set(dir, n)
    if (n !== 1) return
    this.held.add(dir)
    if (dir === 'left') this.rotateImpulse -= TAP_ROTATE
    if (dir === 'right') this.rotateImpulse += TAP_ROTATE
  }

  /** Same path as a keyboard keyup. */
  release(dir: Dir): void {
    const n = (this.pressCount.get(dir) ?? 0) - 1
    if (n <= 0) {
      this.pressCount.delete(dir)
      this.held.delete(dir)
    } else {
      this.pressCount.set(dir, n)
    }
  }

  private clearAll(): void {
    this.held.clear()
    this.pressCount.clear()
  }

  consumeRotateImpulse(): number {
    const v = this.rotateImpulse
    this.rotateImpulse = 0
    return v
  }

  consumeRestart(): boolean {
    const r = this.restart
    this.restart = false
    return r
  }
}
