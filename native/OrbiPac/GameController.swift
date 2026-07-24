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
    /// EMA of frame delta — softens hitch spikes so movement stays even.
    private var smoothDt: TimeInterval = 1.0 / 60.0
    private var stickDirs = Set<Dir>()
    private var motionDirs = Set<Dir>()
    /// When true, the SceneKit board owns the display-link tick (iOS 3D path).
    private var externalClock = false
    #if os(iOS)
    private weak var canvas: GameCanvasUIView?
    private var lastPublishedPitch: Double = .nan
    private var lastPublishedYaw: Double = .nan
    #endif

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
        if #available(iOS 15.0, *) {
            link.preferredFrameRateRange = CAFrameRateRange(minimum: 60, maximum: 120, preferred: 60)
        } else {
            link.preferredFramesPerSecond = 60
        }
        link.add(to: .main, forMode: .common)
        self.link = link
        last = CACurrentMediaTime()
        smoothDt = 1.0 / 60.0
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

    #if os(iOS)
    func attachCanvas(_ view: GameCanvasUIView) {
        canvas = view
    }
    #endif

    /// SceneKit board calls this once per frame on iOS.
    func tickFrame(dt: TimeInterval) {
        applyMotionSample()
        engine.update(rawDt: dt)
        let nextPhase = engine.phase
        if engine.consumePelletTick() { pressureHaptics.pelletTick() }
        if engine.consumeDeathRumble() { pressureHaptics.deathRumble() }
        pressureHaptics.update(pressure: engine.ghostPressure)

        #if os(iOS)
        canvas?.setNeedsDisplay()
        // Publish only when chrome / leveling meaningfully changes — avoids
        // rebuilding the whole SwiftUI tree every frame.
        let pitch = motion.counterPitch
        let yaw = motion.counterYaw
        let levelMoved =
            lastPublishedPitch.isNaN
            || abs(pitch - lastPublishedPitch) > 0.002
            || abs(yaw - lastPublishedYaw) > 0.002
        if nextPhase != phase || levelMoved {
            phase = nextPhase
            lastPublishedPitch = pitch
            lastPublishedYaw = yaw
            objectWillChange.send()
        }
        #else
        phase = nextPhase
        objectWillChange.send()
        #endif
    }

    #if canImport(UIKit) && os(iOS)
    @objc private func tick(_ link: CADisplayLink) {
        let now = link.timestamp
        let raw = last == 0 ? 1.0 / 60.0 : now - last
        last = now
        let clamped = min(0.05, max(1.0 / 120.0, raw))
        smoothDt = smoothDt * 0.82 + clamped * 0.18
        tickFrame(dt: smoothDt)
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
