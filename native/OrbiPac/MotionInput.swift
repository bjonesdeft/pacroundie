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

    /// Radians applied to the playfield only.
    private(set) var counterPitch: Double = 0
    private(set) var counterRoll: Double = 0
    private(set) var counterYaw: Double = 0

    private let deadzone: Double = 0.08
    private let axis: Double = 0.14

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

        // Attract / pre-start: still keep the score at gravity-top (flat L/R tip, etc.).
        guard let reference else {
            counterPitch = 0
            counterRoll = 0
            counterYaw = Self.normAngle(upright)
            return []
        }

        let relative = dm.attitude.copy() as! CMAttitude
        relative.multiply(byInverseOf: reference)

        // Forward / back tip: 3D pitch cancel relative to home.
        counterPitch = -relative.pitch
        // Left / right tip (including flat on the table): spin in-plane so the score
        // stays at the top — not a Y-axis “flip onto the edge” tip.
        counterRoll = 0
        counterYaw = Self.normAngle(upright - referenceUpright)

        var next = Set<Dir>()
        let roll = relative.roll
        let pitch = relative.pitch

        if abs(roll) >= deadzone || abs(pitch) >= deadzone {
            if roll <= -axis { next.insert(.left) }
            if roll >= axis { next.insert(.right) }
            if pitch <= -axis { next.insert(.up) }
            if pitch >= axis { next.insert(.down) }
            if next.isEmpty {
                if abs(roll) >= abs(pitch) {
                    next.insert(roll < 0 ? .left : .right)
                } else {
                    next.insert(pitch < 0 ? .up : .down)
                }
            }
        }

        gyroDirs = next
        return next
    }

    var currentDirs: Set<Dir> { gyroDirs }

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
