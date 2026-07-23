import Foundation
import CoreGraphics

final class GameEngine {
    private let maze = Maze()
    private let audio = GameAudio()
    private let renderer = Renderer()
    private var pac: PacMan!
    private var ghosts: [Ghost] = []
    let input = InputState()

    private(set) var score = 0
    private(set) var highScore = bestScore()
    private(set) var lives = 3
    private(set) var level = 1
    private(set) var phase: GamePhase = .attract

    private var phaseTimer: CGFloat = Constants.readyMS
    private var frightLeft: CGFloat = 0
    private var ghostPoints = 200
    private var elapsed: CGFloat = 0
    private var visualTime: CGFloat = 0
    private var modeClock: CGFloat = 0
    private var scatter = true
    private var eatFreeze: CGFloat = 0
    private var prizeTimer: CGFloat = 0
    private var prizeSpawned = false
    private var wonAt: CGFloat = 0
    private var runRecorded = false
    private var awaitingStart = false
    private var jinglePlaying = false
    private var flipLeft: CGFloat = 0
    /// 0…1 threat for haptics (same-ring / gap-closing hunters).
    private(set) var ghostPressure: CGFloat = 0
    private var pelletTickPending = false
    private var deathRumblePending = false

    /// Host presents initials UI and calls the supplied completion.
    var onHighScore: ((Int, Int, @escaping (String) -> Void) -> Void)?

    init() {
        pac = PacMan(maze)
        ghosts = [
            Ghost(.blinky, Colors.blinky, 700),
            Ghost(.pinky, Colors.pinky, 2200),
            Ghost(.inky, Colors.inky, 4200),
            Ghost(.clyde, Colors.clyde, 6800),
        ]
        enterAttract()
    }

    func update(rawDt: TimeInterval) {
        let raw = CGFloat(min(0.05, max(0, rawDt)))
        visualTime += raw
        update(raw * Constants.gameSpeed)
    }

    func draw(in context: CGContext, size: CGSize) {
        renderer.draw(
            maze, pac, ghosts, score, lives, phase, frightLeft, visualTime, level, phaseTimer, highScore,
            phase == .won ? visualTime - wonAt : 0,
            flipLeft,
            in: context, size: size
        )
    }

    var flipActive: Bool { flipLeft > 0 }

    func consumePelletTick() -> Bool {
        defer { pelletTickPending = false }
        return pelletTickPending
    }

    func consumeDeathRumble() -> Bool {
        defer { deathRumblePending = false }
        return deathRumblePending
    }

    func audioUnlock() { audio.unlock() }

    private func note(_ points: Int) {
        score += points
        highScore = max(highScore, score)
    }

    private func syncHigh() { highScore = max(highScore, score, bestScore()) }
    private func walls(_ level: Int) -> Int { min(8, max(0, level - 1)) }

    private func enterAttract() {
        syncHigh()
        score = 0
        lives = 3
        level = 1
        maze.prepareLevel(walls(1))
        resetActors(true)
        phase = .attract
        awaitingStart = false
        jinglePlaying = false
        frightLeft = 0
        flipLeft = 0
        ghostPressure = 0
        prizeSpawned = false
        prizeTimer = 0
        elapsed = 0
        audio.silence()
    }

    private func beginGame() {
        syncHigh()
        score = 0
        lives = 3
        runRecorded = false
        startLevel(1)
    }

    private func startLevel(_ l: Int) {
        level = l
        maze.prepareLevel(walls(l))
        resetActors(false)
        phase = .ready
        phaseTimer = Constants.readyMS
        elapsed = 0
        prizeSpawned = false
        prizeTimer = 0
        if l == 1 {
            awaitingStart = true
            beginStartJingle()
        } else {
            awaitingStart = false
        }
    }

    private func beginStartJingle() {
        guard awaitingStart, !jinglePlaying else { return }
        jinglePlaying = true
        audio.playStart { [weak self] in
            guard let self else { return }
            self.jinglePlaying = false
            guard self.awaitingStart else { return }
            self.awaitingStart = false
            if self.phase == .ready {
                self.phase = .playing
            }
        }
    }

    private func resetActors(_ attract: Bool, _ keep: Bool = false) {
        if !keep { maze.rotation = 0 }
        pac.reset(maze)
        let homes: [CGFloat] = [-0.55, 0.55, .pi - 0.55, .pi + 0.55]
        for i in ghosts.indices {
            ghosts[i].reset(true, homes[i], maze, attract)
        }
        frightLeft = 0
        flipLeft = 0
        ghostPressure = 0
        // Match web: only stop ambient loops so the death one-shot can finish
        // after a mid-life reset. Full silence is reserved for attract.
        audio.stopAll()
        ghostPoints = 200
        modeClock = 0
        scatter = true
        eatFreeze = 0
    }

    private func finishGameOver() {
        syncHigh()
        phase = .gameover
        phaseTimer = Constants.gameOverMS
    }

    private func recordRun() {
        guard !runRecorded, score > 0 else {
            finishGameOver()
            return
        }
        runRecorded = true
        guard qualifiesForBoard(score), let prompt = onHighScore else {
            finishGameOver()
            return
        }
        phase = .nameentry
        let s = score
        let l = level
        prompt(s, l) { [weak self] name in
            guard let self, self.phase == .nameentry else { return }
            _ = submitRun(score: s, level: l, name: name)
            self.finishGameOver()
        }
    }

    private func update(_ dt: CGFloat) {
        elapsed += dt

        if phase == .attract {
            if input.consumeRestart() {
                beginGame()
                return
            }
            pac.mouth = -.pi / 2
            moveGhosts(dt, true)
            resolveBumps()
            return
        }

        if phase == .gameover {
            phaseTimer -= dt * 1000
            if phaseTimer <= 0 || input.consumeRestart() { enterAttract() }
            return
        }

        if phase == .nameentry {
            _ = input.consumeRestart()
            return
        }

        _ = input.consumeRestart()

        if phase == .won {
            if visualTime - wonAt >= Constants.wonTotal { startLevel(level + 1) }
            return
        }

        if phase == .ready {
            // Level-1 start jingle holds READY until it finishes.
            if awaitingStart { return }
            phaseTimer -= dt * 1000
            if phaseTimer <= 0 { phase = .playing }
            return
        }

        if phase == .dying {
            phaseTimer -= dt * 1000
            if phaseTimer <= 0 {
                if lives <= 0 {
                    recordRun()
                } else {
                    resetActors(false, true)
                    phase = .ready
                    phaseTimer = Constants.readyMS
                    awaitingStart = false
                }
            }
            return
        }

        if eatFreeze > 0 {
            eatFreeze -= dt * 1000
            moveGhosts(dt, false, true)
            syncAmbient()
            return
        }

        updateModes(dt)
        if flipLeft > 0 {
            flipLeft = max(0, flipLeft - dt * 1000)
        }
        var held = input.held
        var impulse = input.consumeRotateImpulse()
        if flipLeft > 0 {
            held = Set(held.map(\.flipped))
            impulse = -impulse
        }
        pac.update(maze, dt, held, impulse)
        let local = pac.localAngle(maze)
        let ring = pac.occupancyRing(maze)

        if let pellet = maze.tryEat(ring, local) {
            pelletTickPending = true
            if pellet.flip {
                note(40)
                beginFlip()
            } else {
                note(pellet.power ? 50 : 10)
                if pellet.power {
                    frightLeft = Constants.frightenedMS
                    ghostPoints = 200
                    ghosts.forEach { $0.frighten() }
                    audio.startFright()
                } else {
                    audio.playMunch()
                }
            }
            if !prizeSpawned {
                maze.maybeSpawnPrize(level)
                if maze.prize != nil {
                    prizeSpawned = true
                    prizeTimer = Constants.prizeMS
                }
            }
        }

        if let prize = maze.tryEatPrize(ring) {
            note(prize.points)
            prizeTimer = 0
            audio.playEatFruit()
        } else if maze.prize?.active == true {
            prizeTimer -= dt * 1000
            if prizeTimer <= 0 { maze.prize = nil }
        }

        if frightLeft > 0 {
            frightLeft -= dt * 1000
            if frightLeft <= 0 {
                frightLeft = 0
                audio.stopFright()
                for g in ghosts where g.mode == .frightened {
                    g.setMode(scatter ? .scatter : .chase, true)
                }
            }
        }

        moveGhosts(dt, false)
        syncAmbient()
        resolveBumps()
        resolveCollisions()
        ghostPressure = computeGhostPressure()

        if maze.pelletCount <= 0 {
            audio.stopAll()
            phase = .won
            wonAt = visualTime
            flipLeft = 0
            ghostPressure = 0
        }
    }

    private func beginFlip() {
        flipLeft = Constants.flipMS
        ghosts.forEach { $0.confuseBurst() }
        audio.playEatFruit()
    }

    private func moveGhosts(_ dt: CGFloat, _ attract: Bool, _ eatenOnly: Bool = false) {
        let p = PacSnapshot(ring: pac.ring, angle: pac.localAngle(maze), facing: pac.facing, radius: pac.radius)
        let confused = flipLeft > 0
        for g in ghosts where !eatenOnly || g.mode == .eaten {
            g.update(maze, dt, p, ghosts[0], elapsed, attract, confused)
        }
    }

    /// Threat 0…1: hunters on Pac’s ring or closing through a nearby gap.
    private func computeGhostPressure() -> CGFloat {
        guard phase == .playing, pac.alive, frightLeft <= 0 else { return 0 }
        let pacRing = pac.occupancyRing(maze)
        let pacAngle = pac.localAngle(maze)
        var best: CGFloat = 0
        for g in ghosts {
            guard (g.mode == .chase || g.mode == .scatter), g.ring >= 0 else { continue }
            let ang = Constants.angleDist(g.angle, pacAngle)
            let ringDelta = abs(g.ring - pacRing)
            var p: CGFloat = 0
            if ringDelta == 0 {
                p = max(0, 1 - ang / 1.15)
                p *= p
            } else if ringDelta == 1 {
                let wall = max(g.ring, pacRing)
                let nearGap = maze.inGap(wall, pacAngle, 0.28) || maze.inGap(wall, g.angle, 0.28)
                p = nearGap ? max(0, 0.65 - ang / 1.8) : max(0, 0.2 - ang / 4)
            }
            best = max(best, p)
        }
        return min(1, best)
    }

    private func updateModes(_ dt: CGFloat) {
        guard frightLeft <= 0 else { return }
        modeClock += dt * 1000
        let duration: CGFloat = scatter ? 7000 : 20000
        if modeClock >= duration {
            modeClock = 0
            scatter.toggle()
            ghosts.forEach { $0.setMode(scatter ? .scatter : .chase) }
        }
    }

    private func resolveBumps() {
        for i in ghosts.indices {
            let a = ghosts[i]
            guard a.mode != .house, a.mode != .eaten, a.ring >= 0 else { continue }
            for j in (i + 1)..<ghosts.count {
                let b = ghosts[j]
                if b.mode != .house, b.mode != .eaten, b.ring == a.ring,
                   abs(a.radius - b.radius) <= 10,
                   Constants.angleDist(a.angle, b.angle) <= 0.28
                {
                    a.bounceOffGhost()
                    b.bounceOffGhost()
                }
            }
        }
    }

    private func resolveCollisions() {
        let pp = Constants.cart(pac.radius, Constants.pacScreenAngle)
        for g in ghosts where g.mode != .house && g.mode != .eaten {
            let gp = Constants.cart(g.radius, maze.toScreen(g.angle))
            guard Constants.distance(pp, gp) <= 14 else { continue }
            if g.mode == .frightened {
                g.becomeEaten(maze)
                note(ghostPoints)
                ghostPoints *= 2
                eatFreeze = Constants.eatFreezeMS
                audio.playEatGhost()
                return
            }
            pac.alive = false
            lives -= 1
            audio.playDeath()
            deathRumblePending = true
            frightLeft = 0
            flipLeft = 0
            ghostPressure = 0
            phase = .dying
            phaseTimer = Constants.deathMS
            return
        }
    }

    private func syncAmbient() {
        if ghosts.contains(where: { $0.mode == .eaten }) {
            audio.startEyes()
        } else if frightLeft > 0 {
            audio.startFright()
        } else {
            audio.updateSiren(maze.pelletCount, maze.pelletTotal)
        }
    }
}
