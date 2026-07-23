import AVFoundation
import Combine
import Foundation
import QuartzCore
#if canImport(UIKit)
import UIKit
#endif

@MainActor
final class GameController: ObservableObject {
    let engine = GameEngine()
    let motion = MotionInput()
    private let pressureHaptics = GhostPressureHaptics()

    @Published var phase: GamePhase = .attract
    @Published var showHelp = false
    @Published var showScores = false
    @Published var nameEntry: NameEntry?
    @Published var motionEnabled = false

    struct NameEntry: Identifiable {
        let id = UUID()
        let score: Int
        let level: Int
        let complete: (String) -> Void
    }

    private var link: CADisplayLink?
    private var last: CFTimeInterval = 0
    private var stickDirs = Set<Dir>()
    private var motionDirs = Set<Dir>()
    /// When true, the SceneKit board owns the display-link tick (iOS 3D path).
    private var externalClock = false

    init() {
        engine.onHighScore = { [weak self] score, level, done in
            Task { @MainActor in
                self?.nameEntry = NameEntry(score: score, level: level, complete: done)
            }
        }
    }

    func start(externalClock: Bool = false) {
        self.externalClock = externalClock
        #if os(iOS)
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [.mixWithOthers])
        try? AVAudioSession.sharedInstance().setActive(true)
        #endif
        engine.audioUnlock()

        motion.start()
        motionEnabled = motion.isAvailable
        pressureHaptics.start()

        #if canImport(UIKit) && os(iOS)
        guard !externalClock else { return }
        guard link == nil else { return }
        let link = CADisplayLink(target: self, selector: #selector(tick(_:)))
        link.add(to: .main, forMode: .common)
        self.link = link
        last = CACurrentMediaTime()
        #endif
    }

    func stop() {
        link?.invalidate()
        link = nil
        motion.stop()
        pressureHaptics.stop()
        clearStick()
        clearMotionDirs()
    }

    /// SceneKit board calls this once per frame on iOS.
    func tickFrame(dt: TimeInterval) {
        applyMotionSample()
        engine.update(rawDt: dt)
        phase = engine.phase
        if engine.consumePelletTick() { pressureHaptics.pelletTick() }
        if engine.consumeDeathRumble() { pressureHaptics.deathRumble() }
        pressureHaptics.update(pressure: engine.ghostPressure)
        objectWillChange.send()
    }

    #if canImport(UIKit) && os(iOS)
    @objc private func tick(_ link: CADisplayLink) {
        let now = link.timestamp
        let dt = last == 0 ? 1.0 / 60.0 : now - last
        last = now
        tickFrame(dt: dt)
    }
    #endif

    func calibrateMotion() {
        motion.calibrate()
    }

    private func applyMotionSample() {
        guard motionEnabled else { return }
        let next = motion.sample()
        engine.input.replaceStickDirections(motionDirs, next)
        motionDirs = next
    }

    private func clearMotionDirs() {
        engine.input.replaceStickDirections(motionDirs, [])
        motionDirs = []
    }

    func applyStick(dx: CGFloat, dy: CGFloat, maxTravel: CGFloat) {
        let next = InputState.directions(dx: dx, dy: dy, maxTravel: maxTravel)
        engine.input.replaceStickDirections(stickDirs, next)
        stickDirs = next
    }

    func clearStick() {
        engine.input.replaceStickDirections(stickDirs, [])
        stickDirs = []
    }

    func pressKey(_ dir: Dir) { engine.input.press(dir) }
    func releaseKey(_ dir: Dir) { engine.input.release(dir) }
    func requestStart() { engine.input.requestRestart() }

    func submitName(_ name: String) {
        let entry = nameEntry
        nameEntry = nil
        entry?.complete(name)
    }
}
