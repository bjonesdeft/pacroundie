/** Shared top-10 leaderboard (localStorage). */

export const LEADERBOARD_KEY = 'pacroundie-leaderboard'
export const LEADERBOARD_SIZE = 10
/** Legacy single high-score key from earlier builds. */
const LEGACY_HIGH_KEY = 'pacroundie-high-score'

export interface ScoreEntry {
  name: string
  score: number
  level: number
  /** Total fruit pickups this run. */
  fruits: number
  /** Distinct fruit kind ids eaten (0–7). */
  fruitKinds: number[]
  ghosts: number
  at: number
}

export interface FruitKind {
  id: string
  label: string
  /** Body color for icons. */
  color: string
  leaf?: string
}

/** Classic arcade fruit progression by level. */
export const FRUIT_KINDS: FruitKind[] = [
  { id: 'cherry', label: 'Cherry', color: '#ff4a6a', leaf: '#22c55e' },
  { id: 'strawberry', label: 'Strawberry', color: '#ff2a4a', leaf: '#22c55e' },
  { id: 'orange', label: 'Orange', color: '#ffb852', leaf: '#22c55e' },
  { id: 'apple', label: 'Apple', color: '#e81828', leaf: '#22c55e' },
  { id: 'melon', label: 'Melon', color: '#22c55e', leaf: '#166534' },
  { id: 'galaxian', label: 'Galaxian', color: '#ffb8ff' },
  { id: 'bell', label: 'Bell', color: '#ffff00' },
  { id: 'key', label: 'Key', color: '#00ffff' },
]

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

const FAKE_NAMES = [
  'RINGRUNR',
  'DOTMUNCH',
  'MAZESPIN',
  'CHERRYPI',
  'BLUEGHOST',
  'PACFAN',
  'GAPJUMP',
  'SIRENACE',
  'FRUITBAT',
  'EYESHOME',
  'POWERPEL',
  'CLYDEWAY',
  'INKYINK',
  'PINKYPOP',
  'BLINKOUT',
  'DIALSPIN',
  'HOUSEOUT',
  'WAKAACE',
  'LEVELUP',
  'ROUNDIE',
]

function randomName(): string {
  return FAKE_NAMES[Math.floor(Math.random() * FAKE_NAMES.length)]!
}

function isEntry(v: unknown): v is ScoreEntry {
  if (!v || typeof v !== 'object') return false
  const e = v as ScoreEntry
  return (
    typeof e.name === 'string' &&
    typeof e.score === 'number' &&
    typeof e.level === 'number' &&
    typeof e.fruits === 'number' &&
    Array.isArray(e.fruitKinds) &&
    typeof e.ghosts === 'number'
  )
}

function sortBoard(list: ScoreEntry[]): ScoreEntry[] {
  return [...list].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (b.level !== a.level) return b.level - a.level
    return b.ghosts - a.ghosts
  })
}

/** Seed arcade-flavored demo rows so the board looks alive on first visit. */
function demoBoard(): ScoreEntry[] {
  const samples: Omit<ScoreEntry, 'name' | 'at'>[] = [
    { score: 28460, level: 9, fruits: 8, fruitKinds: [0, 1, 2, 3, 4], ghosts: 22 },
    { score: 22100, level: 7, fruits: 6, fruitKinds: [0, 1, 2, 3], ghosts: 18 },
    { score: 17840, level: 6, fruits: 5, fruitKinds: [0, 1, 2], ghosts: 15 },
    { score: 14220, level: 5, fruits: 4, fruitKinds: [0, 1, 2], ghosts: 12 },
    { score: 11650, level: 4, fruits: 3, fruitKinds: [0, 1], ghosts: 10 },
    { score: 9340, level: 4, fruits: 3, fruitKinds: [0, 1], ghosts: 8 },
    { score: 7120, level: 3, fruits: 2, fruitKinds: [0, 1], ghosts: 6 },
    { score: 5480, level: 3, fruits: 2, fruitKinds: [0], ghosts: 5 },
    { score: 3910, level: 2, fruits: 1, fruitKinds: [0], ghosts: 3 },
    { score: 2460, level: 2, fruits: 1, fruitKinds: [0], ghosts: 2 },
  ]
  const used = new Set<string>()
  return samples.map((s, i) => {
    let name = FAKE_NAMES[i % FAKE_NAMES.length]!
    while (used.has(name)) name = randomName()
    used.add(name)
    return { ...s, name, at: Date.now() - i * 86_400_000 }
  })
}

export function loadLeaderboard(): ScoreEntry[] {
  try {
    const raw = localStorage.getItem(LEADERBOARD_KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        const list = sortBoard(parsed.filter(isEntry)).slice(0, LEADERBOARD_SIZE)
        if (list.length > 0) return list
      }
    }

    // Migrate legacy single high score into a board entry
    const legacy = localStorage.getItem(LEGACY_HIGH_KEY)
    const legacyScore = legacy ? Number.parseInt(legacy, 10) : 0
    if (Number.isFinite(legacyScore) && legacyScore > 0) {
      const seeded = demoBoard()
      seeded[seeded.length - 1] = {
        name: randomName(),
        score: legacyScore,
        level: 1,
        fruits: 0,
        fruitKinds: [],
        ghosts: 0,
        at: Date.now(),
      }
      const board = sortBoard(seeded).slice(0, LEADERBOARD_SIZE)
      saveLeaderboard(board)
      return board
    }

    const board = demoBoard()
    saveLeaderboard(board)
    return board
  } catch {
    return demoBoard()
  }
}

export function saveLeaderboard(list: ScoreEntry[]): void {
  try {
    localStorage.setItem(
      LEADERBOARD_KEY,
      JSON.stringify(sortBoard(list).slice(0, LEADERBOARD_SIZE)),
    )
  } catch {
    /* private mode / quota */
  }
}

export function bestScore(): number {
  return loadLeaderboard()[0]?.score ?? 0
}

export function submitRun(run: {
  score: number
  level: number
  fruits: number
  fruitKinds: number[]
  ghosts: number
}): ScoreEntry | null {
  if (run.score <= 0) return null

  const entry: ScoreEntry = {
    name: randomName(),
    score: run.score,
    level: Math.max(1, run.level),
    fruits: Math.max(0, run.fruits),
    fruitKinds: [...new Set(run.fruitKinds)].filter((k) => k >= 0 && k < FRUIT_KINDS.length),
    ghosts: Math.max(0, run.ghosts),
    at: Date.now(),
  }

  const board = loadLeaderboard()
  const next = sortBoard([...board, entry]).slice(0, LEADERBOARD_SIZE)
  // Only persist if the run made the board (or board had room)
  const madeIt = next.some(
    (e) => e.at === entry.at && e.name === entry.name && e.score === entry.score,
  )
  if (!madeIt) return null
  saveLeaderboard(next)
  try {
    localStorage.setItem(LEGACY_HIGH_KEY, String(next[0]?.score ?? entry.score))
  } catch {
    /* ignore */
  }
  return entry
}
