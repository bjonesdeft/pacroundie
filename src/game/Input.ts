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

/** Radians per discrete left/right tap. */
const TAP_ROTATE = 0.12

export class Input {
  readonly held = new Set<Dir>()
  private restart = false
  private rotateImpulse = 0
  private swipeStart: { x: number; y: number } | null = null

  constructor(target: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return
      const dir = KEY_MAP[e.key]
      if (dir) {
        e.preventDefault()
        this.held.add(dir)
        if (dir === 'left') this.rotateImpulse -= TAP_ROTATE
        if (dir === 'right') this.rotateImpulse += TAP_ROTATE
      }
      if (e.key === ' ' || e.key === 'Enter') this.restart = true
    })

    window.addEventListener('keyup', (e) => {
      const dir = KEY_MAP[e.key]
      if (dir) this.held.delete(dir)
    })

    window.addEventListener('blur', () => this.held.clear())

    target.addEventListener(
      'touchstart',
      (e) => {
        const t = e.changedTouches[0]
        this.swipeStart = { x: t.clientX, y: t.clientY }
      },
      { passive: true },
    )

    target.addEventListener(
      'touchend',
      (e) => {
        if (!this.swipeStart) return
        const t = e.changedTouches[0]
        const dx = t.clientX - this.swipeStart.x
        const dy = t.clientY - this.swipeStart.y
        this.swipeStart = null
        if (Math.hypot(dx, dy) < 24) {
          this.restart = true
          return
        }
        if (Math.abs(dx) > Math.abs(dy)) {
          this.rotateImpulse += dx > 0 ? TAP_ROTATE * 1.4 : -TAP_ROTATE * 1.4
        } else {
          this.held.add(dy > 0 ? 'down' : 'up')
          window.setTimeout(() => {
            this.held.delete('up')
            this.held.delete('down')
          }, 200)
        }
      },
      { passive: true },
    )
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
