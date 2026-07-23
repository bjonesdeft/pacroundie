import './style.css'
import { Game } from './game/Game'
import { NAME_MAX_LEN } from './game/leaderboard'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('#app missing')

app.innerHTML = `
  <div class="stage">
    <header class="brand">
      <h1>ORBI-PAC</h1>
      <p>SPIN THE MAZE · CHOMP THE RINGS</p>
    </header>

    <div class="play-row">
      <div class="display" id="display">
        <canvas id="game" width="336" height="336" aria-label="Orbi-Pac game"></canvas>
      </div>
    </div>

    <div class="joypad" id="touch-pad" aria-label="Game pad" hidden>
      <div
        class="stick"
        id="thumb-stick"
        role="group"
        aria-label="Thumbstick — drag to move"
      >
        <div class="stick-base" aria-hidden="true">
          <span class="stick-mark stick-mark-up">▲</span>
          <span class="stick-mark stick-mark-left">◀</span>
          <span class="stick-mark stick-mark-right">▶</span>
          <span class="stick-mark stick-mark-down">▼</span>
        </div>
        <div class="stick-knob" id="stick-knob" aria-hidden="true"></div>
      </div>
      <button type="button" class="start-btn" data-action="start" aria-label="Start">START</button>
    </div>

    <nav class="action-bar" aria-label="Game links">
      <button type="button" class="nav-btn" id="how-btn">HOW TO PLAY</button>
      <a class="nav-btn" href="./scores.html">HIGH SCORES</a>
    </nav>
  </div>

  <div class="help-overlay" id="help-overlay" hidden>
    <div class="help-card" role="dialog" aria-modal="true" aria-labelledby="help-title">
      <p class="help-title" id="help-title">HOW TO PLAY</p>
      <div class="help-body">
        <p>Pac stays on the dial. Align openings to travel between rings.</p>
        <p><kbd>←</kbd><kbd>→</kbd> rotate the maze</p>
        <p><kbd>↑</kbd><kbd>↓</kbd> move through gaps</p>
        <p class="help-touch-line">On touch: drag the thumbstick and hold a direction.</p>
        <p>Ghosts spawn in the center.</p>
        <p><kbd>Space</kbd> / <kbd>Enter</kbd> / START / tap dial — start</p>
        <p><kbd>M</kbd> maximize game</p>
      </div>
      <button type="button" class="nav-btn" id="help-close">GOT IT</button>
    </div>
  </div>

  <div class="name-overlay" id="name-overlay" hidden>
    <form class="name-card" id="name-form">
      <p class="name-title">HIGH SCORE</p>
      <p class="name-stats" id="name-stats"></p>
      <label class="name-label" for="name-input">ENTER YOUR NAME</label>
      <input
        id="name-input"
        class="name-input"
        name="player"
        maxlength="${NAME_MAX_LEN}"
        autocomplete="off"
        autocapitalize="characters"
        spellcheck="false"
        required
      />
      <button type="submit" class="nav-btn name-submit">SAVE</button>
    </form>
  </div>
`

const canvas = document.querySelector<HTMLCanvasElement>('#game')
const display = document.querySelector<HTMLElement>('#display')
const touchPad = document.querySelector<HTMLElement>('#touch-pad')
const howBtn = document.querySelector<HTMLButtonElement>('#how-btn')
const helpOverlay = document.querySelector<HTMLElement>('#help-overlay')
const helpClose = document.querySelector<HTMLButtonElement>('#help-close')
const nameOverlay = document.querySelector<HTMLElement>('#name-overlay')
const nameForm = document.querySelector<HTMLFormElement>('#name-form')
const nameInput = document.querySelector<HTMLInputElement>('#name-input')
const nameStats = document.querySelector<HTMLElement>('#name-stats')
if (
  !canvas ||
  !display ||
  !touchPad ||
  !howBtn ||
  !helpOverlay ||
  !helpClose ||
  !nameOverlay ||
  !nameForm ||
  !nameInput ||
  !nameStats
) {
  throw new Error('Game elements missing')
}

const CHROME_KEY = 'pacroundie-chrome'
const touchUi = window.matchMedia('(hover: none), (pointer: coarse)')

const readChrome = (): boolean => {
  try {
    const raw = localStorage.getItem(CHROME_KEY)
    if (raw === '0') return false
    if (raw === '1') return true
  } catch {
    /* ignore */
  }
  return true
}

const applyChrome = (showChrome: boolean) => {
  document.body.classList.toggle('game-max', !showChrome)
  try {
    localStorage.setItem(CHROME_KEY, showChrome ? '1' : '0')
  } catch {
    /* ignore */
  }
}

let showChrome = readChrome()
applyChrome(showChrome)

const syncPad = () => {
  touchPad.hidden = !touchUi.matches
  document.body.classList.toggle('touch-ui', touchUi.matches)
}
syncPad()
touchUi.addEventListener('change', syncPad)

const openHelp = () => {
  helpOverlay.hidden = false
  document.body.classList.add('help-open')
  helpClose.focus()
}

const closeHelp = () => {
  helpOverlay.hidden = true
  document.body.classList.remove('help-open')
  howBtn.focus()
}

howBtn.addEventListener('click', openHelp)
helpClose.addEventListener('click', closeHelp)
helpOverlay.addEventListener('click', (e) => {
  if (e.target === helpOverlay) closeHelp()
})

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !helpOverlay.hidden) {
    e.preventDefault()
    closeHelp()
    return
  }
  if (e.key !== 'm' && e.key !== 'M') return
  if (e.repeat) return
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
  e.preventDefault()
  showChrome = !showChrome
  applyChrome(showChrome)
})

const game = new Game(canvas, display)
game.input.bindPad(touchPad)

game.onHighScore = (info, done) => {
  nameStats.textContent = `SCORE ${String(info.score).padStart(5, '0')} · L${info.level}`
  nameInput.value = ''
  nameOverlay.hidden = false
  document.body.classList.add('name-entry-open')
  window.setTimeout(() => nameInput.focus(), 30)

  const finish = (name: string) => {
    nameOverlay.hidden = true
    document.body.classList.remove('name-entry-open')
    done(name)
  }

  nameForm.onsubmit = (e) => {
    e.preventDefault()
    finish(nameInput.value)
  }
}

game.start()
