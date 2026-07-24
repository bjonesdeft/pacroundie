import Foundation
import CoreGraphics

#if os(iOS)
import CoreMotion

/// Tilt → steering, plus playfield stabilization (score stays at the top).
@MainActor
final class MotionInput {
    private let motion = CMMotionManager()
    private var reference: CMAttitude?
    private var referenceUpright: Double = 0
    private var pendingCalibration = false
    private var gyroDirs = Set<Dir>()
    private(set) var isAvailable = false

    /// Radians applied to the playfield only (smoothed for display).
    private(set) var counterPitch: Double = 0
    private(set) var counterRoll: Double = 0
    private(set) var counterYaw: Double = 0

    private var targetPitch: Double = 0
    private var targetYaw: Double = 0

    /// Enter / exit thresholds — hysteresis stops left/right flicker at the edge.
    private let deadzone: Double = 0.09
    private let enterAxis: Double = 0.17
    private let exitAxis: Double = 0.10
    /// How much of the forward/back tip we counter in 3D (full cancel looked wrong).
    private let pitchLevelGain: Double = 0.18
    /// How strongly we spin to keep score at gravity-top (1 = full).
    private let yawLevelGain: Double = 0.42
    /// Per-frame blend toward target attitude (lower = calmer board).
    private let levelSmooth: Double = 0.12

    func start() {
        guard motion.isDeviceMotionAvailable else {
            isAvailable = false
            return
        }
        isAvailable = true
        reference = nil
        referenceUpright = 0
        pendingCalibration = false
        clearCounters()
        motion.deviceMotionUpdateInterval = 1.0 / 60.0
        motion.startDeviceMotionUpdates(using: .xArbitraryCorrectedZVertical)
    }

    func stop() {
        motion.stopDeviceMotionUpdates()
        reference = nil
        referenceUpright = 0
        pendingCalibration = false
        gyroDirs = []
        clearCounters()
    }

    /// Lock home while the player is looking at the maze (tap to start).
    func calibrate() {
        if let dm = motion.deviceMotion {
            reference = dm.attitude.copy() as? CMAttitude
            referenceUpright = Self.scoreTopAngle(gravity: dm.gravity)
            pendingCalibration = false
            clearCounters()
        } else {
            pendingCalibration = true
        }
    }

    func sample() -> Set<Dir> {
        guard isAvailable, let dm = motion.deviceMotion else {
            clearCounters()
            return []
        }

        if pendingCalibration {
            reference = dm.attitude.copy() as? CMAttitude
            referenceUpright = Self.scoreTopAngle(gravity: dm.gravity)
            pendingCalibration = false
            clearCounters()
        }

        let upright = Self.scoreTopAngle(gravity: dm.gravity)

        // Attract / pre-start: mild score-upright only (no 3D tip).
        guard let reference else {
            targetPitch = 0
            targetYaw = Self.normAngle(upright) * yawLevelGain
            blendCounters()
            return []
        }

        let relative = dm.attitude.copy() as! CMAttitude
        relative.multiply(byInverseOf: reference)

        // Subtle forward/back hint only — full counter-tilt never read as “face the user.”
        targetPitch = -relative.pitch * pitchLevelGain
        // Soft in-plane upright so score stays roughly at the top.
        targetYaw = Self.normAngle(upright - referenceUpright) * yawLevelGain
        blendCounters()

        let roll = relative.roll
        let pitch = relative.pitch
        gyroDirs = stickyDirs(roll: roll, pitch: pitch, previous: gyroDirs)
        return gyroDirs
    }

    var currentDirs: Set<Dir> { gyroDirs }

    /// Keep holding a direction until tilt drops below the exit threshold.
    private func stickyDirs(roll: Double, pitch: Double, previous: Set<Dir>) -> Set<Dir> {
        var next = Set<Dir>()
        func keep(_ dir: Dir, value: Double, positive: Bool) {
            let on = previous.contains(dir)
            let enter = positive ? value >= enterAxis : value <= -enterAxis
            let hold = positive ? value >= exitAxis : value <= -exitAxis
            if on ? hold : enter { next.insert(dir) }
        }
        keep(.left, value: roll, positive: false)
        keep(.right, value: roll, positive: true)
        keep(.up, value: pitch, positive: false)
        keep(.down, value: pitch, positive: true)

        if next.isEmpty, abs(roll) >= deadzone || abs(pitch) >= deadzone {
            if abs(roll) >= abs(pitch) {
                next.insert(roll < 0 ? .left : .right)
            } else {
                next.insert(pitch < 0 ? .up : .down)
            }
        }
        return next
    }

    private func blendCounters() {
        counterPitch += (targetPitch - counterPitch) * levelSmooth
        counterRoll = 0
        let yawErr = Self.normAngle(targetYaw - counterYaw)
        counterYaw = Self.normAngle(counterYaw + yawErr * levelSmooth)
    }

    /// Angle that puts canvas-up (score) opposite gravity — works upright and face-up.
    private static func scoreTopAngle(gravity g: CMAcceleration) -> Double {
        let inPlane = hypot(g.x, g.y)
        if inPlane > 0.06 {
            // Portrait / tilted: gravity in the screen plane.
            // Resting upright g≈(0,-1,0) → 0.
            return atan2(g.x, g.y) + .pi
        }
        // Flat on the table: tip left/right shows up on X vs Z.
        return atan2(g.x, -g.z)
    }

    private static func normAngle(_ a: Double) -> Double {
        atan2(sin(a), cos(a))
    }

    private func clearCounters() {
        counterPitch = 0
        counterRoll = 0
        counterYaw = 0
        targetPitch = 0
        targetYaw = 0
    }
}
#else
@MainActor
final class MotionInput {
    private(set) var isAvailable = false
    private(set) var counterPitch: Double = 0
    private(set) var counterRoll: Double = 0
    private(set) var counterYaw: Double = 0
    func start() {}
    func stop() {}
    func calibrate() {}
    func sample() -> Set<Dir> { [] }
    var currentDirs: Set<Dir> { [] }
}
#endif
