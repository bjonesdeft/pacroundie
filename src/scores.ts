import './style.css'
import './scores.css'
import { loadLeaderboard, type ScoreEntry } from './game/leaderboard'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('#app missing')
const root = app

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function rowHtml(entry: ScoreEntry, rank: number): string {
  return `
    <li class="score-row rank-${rank}">
      <div class="col-rank">${rank}</div>
      <div class="col-name">${escapeHtml(entry.name)}</div>
      <div class="col-level">L${entry.level}</div>
      <div class="col-score">${String(entry.score).padStart(5, '0')}</div>
    </li>
  `
}

function render(board: ScoreEntry[]): void {
  const rows =
    board.length > 0
      ? board.map((e, i) => rowHtml(e, i + 1)).join('')
      : `<li class="score-row empty">No high scores yet — play a round!</li>`

  root.innerHTML = `
    <div class="stage scores-stage">
      <header class="brand">
        <h1>ORBI-PAC</h1>
        <p>HIGH SCORES · TOP TEN</p>
      </header>

      <div class="scores-panel">
        <ol class="score-list">
          <li class="score-head">
            <div class="col-rank">#</div>
            <div class="col-name">PLAYER</div>
            <div class="col-level">LEVEL</div>
            <div class="col-score">SCORE</div>
          </li>
          ${rows}
        </ol>
      </div>

      <nav class="action-bar">
        <a class="nav-btn" href="./">PLAY</a>
      </nav>
    </div>
  `
}

render(loadLeaderboard())
