import './style.css'
import { Game } from './game/Game'
import { NAME_MAX_LEN } from './game/leaderboard'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('#app missing')

app.innerHTML = `
  <div class="stage">
    <header class="brand">
      <h1>PACROUNDIE</h1>
      <p>PAC-MAN FOR A ROUND DISPLAY</p>
    </header>

    <div class="play-row">
      <aside class="rail rail-left">
        <p class="help help-desktop">
          <kbd>←</kbd><kbd>→</kbd> rotate the maze<br />
          <kbd>↑</kbd><kbd>↓</kbd> move through gaps<br /><br />
          Pac stays on the dial — align openings to travel rings.<br /><br />
          Ghosts spawn in the center.<br />
          <kbd>Space</kbd> / <kbd>Enter</kbd> start<br />
          <kbd>M</kbd> maximize game
        </p>
      </aside>

      <div class="display" id="display">
        <canvas id="game" width="336" height="336" aria-label="Pacroundie game"></canvas>
      </div>

      <aside class="rail rail-right">
        <nav class="scores-nav">
          <a class="nav-btn" href="./scores.html">HIGH SCORES</a>
        </nav>
      </aside>
    </div>

    <div class="joypad" id="touch-pad" aria-label="Game pad" hidden>
      <div class="dpad" role="group" aria-label="Direction pad">
        <button type="button" class="pad-btn pad-up" data-dir="up" aria-label="Up">▲</button>
        <button type="button" class="pad-btn pad-left" data-dir="left" aria-label="Left">◀</button>
        <button type="button" class="pad-btn pad-center" tabindex="-1" aria-hidden="true"></button>
        <button type="button" class="pad-btn pad-right" data-dir="right" aria-label="Right">▶</button>
        <button type="button" class="pad-btn pad-down" data-dir="down" aria-label="Down">▼</button>
      </div>
      <button type="button" class="start-btn" data-action="start" aria-label="Start">START</button>
    </div>

    <p class="help help-touch">
      Hold the pad like arrow keys · ←→ spin · ↑↓ change rings<br />
      START or tap the dial to begin · <kbd>M</kbd> maximize
    </p>

    <nav class="scores-nav scores-nav-mobile">
      <a class="nav-btn" href="./scores.html">HIGH SCORES</a>
    </nav>
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
const nameOverlay = document.querySelector<HTMLElement>('#name-overlay')
const nameForm = document.querySelector<HTMLFormElement>('#name-form')
const nameInput = document.querySelector<HTMLInputElement>('#name-input')
const nameStats = document.querySelector<HTMLElement>('#name-stats')
if (!canvas || !display || !touchPad || !nameOverlay || !nameForm || !nameInput || !nameStats) {
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

window.addEventListener('keydown', (e) => {
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
