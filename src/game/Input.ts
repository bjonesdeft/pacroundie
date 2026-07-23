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

/** Radians nudge on first press — same as a keyboard keydown. */
const TAP_ROTATE = 0.12

/** Ignore stick motion inside this fraction of the travel radius. */
const STICK_DEADZONE = 0.22
/** Axis must exceed this (after deadzone) to count as held. */
const STICK_AXIS = 0.32

/**
 * Keyboard + on-screen thumbstick.
 * Stick holds directions like arrow keys (drag + hold to keep moving).
 * Tap the dial or START to begin / dismiss.
 */
export class Input {
  readonly held = new Set<Dir>()
  private restart = false
  private rotateImpulse = 0
  /** Nested press counts so keyboard + stick don't fight. */
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

    // Dial / canvas: tap only (movement is stick / keyboard)
    target.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      this.restart = true
    })
    target.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false })
  }

  /**
   * Virtual thumbstick: drag from the base center; hold a direction to keep
   * moving. Diagonals can engage rotate + ring-cross together. START = Space.
   */
  bindPad(root: HTMLElement): void {
    const stick = root.querySelector<HTMLElement>('.stick')
    const knob = root.querySelector<HTMLElement>('.stick-knob')
    if (!stick || !knob) return

    let pointerId: number | null = null
    let active = new Set<Dir>()

    const setDirs = (next: Set<Dir>) => {
      for (const dir of active) {
        if (!next.has(dir)) this.release(dir)
      }
      for (const dir of next) {
        if (!active.has(dir)) this.press(dir)
      }
      active = next
      stick.dataset.active = next.size > 0 ? '1' : '0'
      for (const dir of ['up', 'down', 'left', 'right'] as Dir[]) {
        stick.classList.toggle(`is-${dir}`, next.has(dir))
      }
    }

    const placeKnob = (dx: number, dy: number, maxTravel: number) => {
      const dist = Math.hypot(dx, dy)
      let x = dx
      let y = dy
      if (dist > maxTravel && dist > 0) {
        const s = maxTravel / dist
        x *= s
        y *= s
      }
      knob.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`
    }

    const dirsFromVector = (dx: number, dy: number, maxTravel: number): Set<Dir> => {
      const next = new Set<Dir>()
      const mag = Math.hypot(dx, dy) / maxTravel
      if (mag < STICK_DEADZONE) return next
      const nx = dx / maxTravel
      const ny = dy / maxTravel
      if (nx <= -STICK_AXIS) next.add('left')
      if (nx >= STICK_AXIS) next.add('right')
      if (ny <= -STICK_AXIS) next.add('up')
      if (ny >= STICK_AXIS) next.add('down')
      // Near-cardinal: if only one axis cleared the deadzone weakly, pick dominant
      if (next.size === 0) {
        if (Math.abs(nx) >= Math.abs(ny)) {
          if (nx < 0) next.add('left')
          else next.add('right')
        } else {
          if (ny < 0) next.add('up')
          else next.add('down')
        }
      }
      return next
    }

    const sample = (clientX: number, clientY: number) => {
      const rect = stick.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const maxTravel = rect.width * 0.32
      const dx = clientX - cx
      const dy = clientY - cy
      placeKnob(dx, dy, maxTravel)
      setDirs(dirsFromVector(dx, dy, maxTravel))
    }

    const resetStick = () => {
      knob.style.transform = 'translate(-50%, -50%)'
      setDirs(new Set())
    }

    const onDown = (e: PointerEvent) => {
      if (pointerId !== null) return
      const start = e.target as HTMLElement | null
      if (start?.closest?.('[data-action="start"]')) {
        e.preventDefault()
        this.restart = true
        return
      }
      if (!start?.closest?.('.stick')) return
      e.preventDefault()
      pointerId = e.pointerId
      try {
        stick.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      stick.classList.add('is-active')
      sample(e.clientX, e.clientY)
    }

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return
      e.preventDefault()
      sample(e.clientX, e.clientY)
    }

    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return
      e.preventDefault()
      pointerId = null
      stick.classList.remove('is-active')
      resetStick()
      try {
        stick.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    }

    root.addEventListener('pointerdown', onDown)
    root.addEventListener('pointermove', onMove)
    root.addEventListener('pointerup', onUp)
    root.addEventListener('pointercancel', onUp)
    stick.addEventListener('lostpointercapture', () => {
      pointerId = null
      stick.classList.remove('is-active')
      resetStick()
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
