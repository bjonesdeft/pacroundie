import './style.css'
import { Game } from './game/Game'

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
          <kbd>Space</kbd> / <kbd>Enter</kbd> start
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
      START or tap the dial to begin
    </p>

    <nav class="scores-nav scores-nav-mobile">
      <a class="nav-btn" href="./scores.html">HIGH SCORES</a>
    </nav>
  </div>
`

const canvas = document.querySelector<HTMLCanvasElement>('#game')
const display = document.querySelector<HTMLElement>('#display')
const touchPad = document.querySelector<HTMLElement>('#touch-pad')
if (!canvas || !display || !touchPad) throw new Error('Game elements missing')

const touchUi = window.matchMedia('(hover: none), (pointer: coarse)')
const syncPad = () => {
  touchPad.hidden = !touchUi.matches
  document.body.classList.toggle('touch-ui', touchUi.matches)
}
syncPad()
touchUi.addEventListener('change', syncPad)

const game = new Game(canvas, display)
game.input.bindPad(touchPad)
game.start()
