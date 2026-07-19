/** Shared top-10 leaderboard (localStorage). Persists until cleared. */

export const LEADERBOARD_KEY = 'pacroundie-leaderboard'
export const LEADERBOARD_SIZE = 10
/** Legacy single high-score key from earlier builds. */
const LEGACY_HIGH_KEY = 'pacroundie-high-score'

export const NAME_MAX_LEN = 10

export interface ScoreEntry {
  name: string
  score: number
  level: number
  at: number
}

/** Classic arcade fruit index by level (used by maze prizes). */
export function fruitKindForLevel(level: number): number {
  if (level <= 1) return 0
  if (level === 2) return 1
  if (level <= 4) return 2
  if (level <= 6) return 3
  if (level <= 8) return 4
  if (level <= 10) return 5
  if (level <= 12) return 6
  return 7
}

function normalizeName(name: string): string {
  const cleaned = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9 \-_]/g, '')
    .slice(0, NAME_MAX_LEN)
  return cleaned || 'PLAYER'
}

function isEntry(v: unknown): v is ScoreEntry {
  if (!v || typeof v !== 'object') return false
  const e = v as ScoreEntry
  return (
    typeof e.name === 'string' &&
    typeof e.score === 'number' &&
    typeof e.level === 'number' &&
    Number.isFinite(e.score) &&
    Number.isFinite(e.level)
  )
}

function sortBoard(list: ScoreEntry[]): ScoreEntry[] {
  return [...list].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (b.level !== a.level) return b.level - a.level
    return (b.at ?? 0) - (a.at ?? 0)
  })
}

function persistBest(score: number): void {
  try {
    localStorage.setItem(LEGACY_HIGH_KEY, String(score))
  } catch {
    /* ignore */
  }
}

export function loadLeaderboard(): ScoreEntry[] {
  try {
    const raw = localStorage.getItem(LEADERBOARD_KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return sortBoard(
          parsed.filter(isEntry).map((e) => ({
            name: normalizeName(e.name),
            score: Math.max(0, Math.floor(e.score)),
            level: Math.max(1, Math.floor(e.level)),
            at: typeof e.at === 'number' ? e.at : 0,
          })),
        ).slice(0, LEADERBOARD_SIZE)
      }
    }

    // One-time migrate legacy single high score (no demo filler names)
    const legacy = localStorage.getItem(LEGACY_HIGH_KEY)
    const legacyScore = legacy ? Number.parseInt(legacy, 10) : 0
    if (Number.isFinite(legacyScore) && legacyScore > 0) {
      const board: ScoreEntry[] = [
        { name: 'PLAYER', score: legacyScore, level: 1, at: Date.now() },
      ]
      saveLeaderboard(board)
      return board
    }
  } catch {
    /* ignore */
  }
  return []
}

export function saveLeaderboard(list: ScoreEntry[]): void {
  const board = sortBoard(list).slice(0, LEADERBOARD_SIZE)
  try {
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(board))
  } catch {
    /* private mode / quota */
  }
  persistBest(board[0]?.score ?? 0)
}

/** Wipe the board — call when you explicitly want a reset. */
export function clearLeaderboard(): void {
  try {
    localStorage.removeItem(LEADERBOARD_KEY)
    localStorage.removeItem(LEGACY_HIGH_KEY)
  } catch {
    /* ignore */
  }
}

export function bestScore(): number {
  return loadLeaderboard()[0]?.score ?? 0
}

/** True when this score would appear on the top-10 board. */
export function qualifiesForBoard(score: number): boolean {
  if (score <= 0) return false
  const board = loadLeaderboard()
  if (board.length < LEADERBOARD_SIZE) return true
  const worst = board[board.length - 1]!
  return score > worst.score
}

export function submitRun(run: {
  score: number
  level: number
  name: string
}): ScoreEntry | null {
  if (run.score <= 0) return null
  if (!qualifiesForBoard(run.score)) return null

  const entry: ScoreEntry = {
    name: normalizeName(run.name),
    score: Math.floor(run.score),
    level: Math.max(1, Math.floor(run.level)),
    at: Date.now(),
  }

  const board = loadLeaderboard()
  const next = sortBoard([...board, entry]).slice(0, LEADERBOARD_SIZE)
  saveLeaderboard(next)
  return entry
}
