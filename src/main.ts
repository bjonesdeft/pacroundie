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
    <div class="display" id="display">
      <canvas id="game" width="336" height="336" aria-label="Pacroundie game"></canvas>
    </div>
    <p class="help">
      <kbd>←</kbd><kbd>→</kbd> rotate the maze · <kbd>↑</kbd><kbd>↓</kbd> move through gaps<br />
      Pac-Man stays on the dial — align openings to travel rings<br />
      Ghosts spawn in the center (you can't enter) · <kbd>Space</kbd> / <kbd>Enter</kbd> start
    </p>
  </div>
`

const canvas = document.querySelector<HTMLCanvasElement>('#game')
const display = document.querySelector<HTMLElement>('#display')
if (!canvas || !display) throw new Error('Game elements missing')

const game = new Game(canvas, display)
game.start()
