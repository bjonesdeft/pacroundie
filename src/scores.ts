import './style.css'
import './scores.css'
import { COLORS } from './game/constants'
import { FRUIT_KINDS, loadLeaderboard, type ScoreEntry } from './game/leaderboard'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('#app missing')
const root = app

const GHOST_COLORS = [COLORS.blinky, COLORS.pinky, COLORS.inky, COLORS.clyde] as const

function pacSvg(size = 28): string {
  return `<svg class="sprite pac" width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true">
    <circle cx="16" cy="16" r="13" fill="${COLORS.pac}"/>
    <path d="M16 16 L30 8 A13 13 0 0 0 30 24 Z" fill="#000"/>
  </svg>`
}

function ghostSvg(color: string, size = 22): string {
  return `<svg class="sprite ghost" width="${size}" height="${size}" viewBox="0 0 28 30" aria-hidden="true">
    <path fill="${color}" d="M2 12a12 12 0 0 1 24 0v14l-4-3-4 3-4-3-4 3-4-3-4 3z"/>
    <circle cx="10" cy="13" r="3.2" fill="#fff"/>
    <circle cx="18" cy="13" r="3.2" fill="#fff"/>
    <circle cx="11.2" cy="13.4" r="1.4" fill="${COLORS.pupil}"/>
    <circle cx="19.2" cy="13.4" r="1.4" fill="${COLORS.pupil}"/>
  </svg>`
}

function fruitSvg(kind: number, size = 18): string {
  const f = FRUIT_KINDS[kind] ?? FRUIT_KINDS[0]!
  if (kind === 5) {
    // Galaxian flagship
    return `<svg class="sprite fruit" width="${size}" height="${size}" viewBox="0 0 20 20" aria-hidden="true" title="${f.label}">
      <path fill="${f.color}" d="M10 2 L18 10 L10 8 L2 10 Z"/>
      <path fill="#ffff00" d="M10 8 L14 16 L10 13 L6 16 Z"/>
    </svg>`
  }
  if (kind === 6) {
    return `<svg class="sprite fruit" width="${size}" height="${size}" viewBox="0 0 20 20" aria-hidden="true" title="${f.label}">
      <ellipse cx="10" cy="12" rx="7" ry="6" fill="${f.color}"/>
      <rect x="8.5" y="3" width="3" height="5" rx="1" fill="#c0c0c0"/>
    </svg>`
  }
  if (kind === 7) {
    return `<svg class="sprite fruit" width="${size}" height="${size}" viewBox="0 0 20 20" aria-hidden="true" title="${f.label}">
      <rect x="8" y="3" width="4" height="10" rx="1" fill="${f.color}"/>
      <path fill="none" stroke="${f.color}" stroke-width="2" d="M12 5 h3 a3 3 0 0 1 0 6 h-1"/>
      <circle cx="10" cy="16" r="2" fill="${f.color}"/>
    </svg>`
  }
  // Cherry / berry / fruit blob with leaf (matches in-game prize)
  return `<svg class="sprite fruit" width="${size}" height="${size}" viewBox="0 0 20 20" aria-hidden="true" title="${f.label}">
    <path d="M10 3 Q12 8 14 9" stroke="${f.leaf ?? '#22c55e'}" stroke-width="1.5" fill="none"/>
    <ellipse cx="14" cy="6" rx="3.5" ry="2" fill="${f.leaf ?? '#22c55e'}" transform="rotate(25 14 6)"/>
    <circle cx="7" cy="13" r="4.2" fill="${f.color}"/>
    <circle cx="13" cy="14" r="4.2" fill="${f.color}"/>
  </svg>`
}

function ghostStack(count: number): string {
  if (count <= 0) return `<span class="muted-stat">—</span>`
  const shown = Math.min(4, count)
  const icons = Array.from({ length: shown }, (_, i) =>
    ghostSvg(GHOST_COLORS[i % GHOST_COLORS.length]!, 18),
  ).join('')
  const extra = count > shown ? `<span class="stat-plus">+${count - shown}</span>` : ''
  return `<span class="icon-row" title="${count} ghosts eaten">${icons}${extra}<span class="stat-num">${count}</span></span>`
}

function fruitRow(kinds: number[], total: number): string {
  if (total <= 0 && kinds.length === 0) return `<span class="muted-stat">—</span>`
  const unique = [...new Set(kinds)].sort((a, b) => a - b)
  const icons =
    unique.length > 0
      ? unique.map((k) => fruitSvg(k, 16)).join('')
      : fruitSvg(0, 16)
  return `<span class="icon-row" title="${total} fruit · ${unique.length} kinds">${icons}<span class="stat-num">${total}</span></span>`
}

function rankBadge(rank: number): string {
  if (rank === 1) return `<span class="rank gold">${pacSvg(26)}</span>`
  if (rank === 2) return `<span class="rank silver">2</span>`
  if (rank === 3) return `<span class="rank bronze">3</span>`
  return `<span class="rank">${rank}</span>`
}

function rowHtml(entry: ScoreEntry, rank: number): string {
  return `
    <li class="score-row rank-${rank}">
      <div class="col-rank">${rankBadge(rank)}</div>
      <div class="col-name">
        <span class="player-name">${entry.name}</span>
        <span class="level-pill" title="Highest level">L${entry.level}</span>
      </div>
      <div class="col-score">${String(entry.score).padStart(5, '0')}</div>
      <div class="col-fruit">${fruitRow(entry.fruitKinds, entry.fruits)}</div>
      <div class="col-ghost">${ghostStack(entry.ghosts)}</div>
    </li>
  `
}

function render(board: ScoreEntry[]): void {
  const rows =
    board.length > 0
      ? board.map((e, i) => rowHtml(e, i + 1)).join('')
      : `<li class="score-row empty">No scores yet — clear a few rings!</li>`

  root.innerHTML = `
    <div class="stage scores-stage">
      <header class="brand">
        <h1>PACROUNDIE</h1>
        <p>HIGH SCORES · TOP TEN</p>
      </header>

      <div class="scores-panel">
        <div class="scores-legend">
          <span>${fruitSvg(0, 14)} fruit kinds</span>
          <span>${ghostSvg(COLORS.blinky, 14)} ghosts</span>
          <span class="level-pill">L#</span> level
        </div>
        <ol class="score-list">
          <li class="score-head">
            <div class="col-rank">#</div>
            <div class="col-name">PLAYER</div>
            <div class="col-score">SCORE</div>
            <div class="col-fruit">FRUIT</div>
            <div class="col-ghost">GHOSTS</div>
          </li>
          ${rows}
        </ol>
      </div>

      <nav class="scores-nav">
        <a class="nav-btn" href="./">PLAY</a>
      </nav>
    </div>
  `
}

render(loadLeaderboard())
