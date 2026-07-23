import Foundation

#if os(iOS)
import UIKit
import CoreHaptics
import QuartzCore

/// Pulsing haptics that swell as hunters close in on Pac’s ring / gap.
@MainActor
final class GhostPressureHaptics {
    private var engine: CHHapticEngine?
    private var supportsHaptics = false
    private var lastPulse: CFTimeInterval = 0

    func start() {
        guard CHHapticEngine.capabilitiesForHardware().supportsHaptics else {
            supportsHaptics = false
            return
        }
        supportsHaptics = true
        do {
            let engine = try CHHapticEngine()
            engine.isAutoShutdownEnabled = true
            try engine.start()
            self.engine = engine
        } catch {
            supportsHaptics = false
            engine = nil
        }
    }

    func stop() {
        engine?.stop(completionHandler: nil)
        engine = nil
    }

    /// `pressure` in 0…1 — higher = faster / harder pulses.
    func update(pressure: CGFloat) {
        guard supportsHaptics, pressure > 0.1 else { return }
        let now = CACurrentMediaTime()
        let interval = max(0.07, 0.52 - Double(pressure) * 0.42)
        guard now - lastPulse >= interval else { return }
        lastPulse = now
        pulse(intensity: Float(0.22 + pressure * 0.78), sharpness: Float(0.25 + pressure * 0.7))
    }

    /// Soft tick for chomping a pellet.
    func pelletTick() {
        guard supportsHaptics else { return }
        pulse(intensity: 0.28, sharpness: 0.55)
    }

    /// Hard hit + decaying rumble when Pac is caught.
    func deathRumble() {
        guard supportsHaptics, let engine else { return }
        var events: [CHHapticEvent] = []

        // Initial slam.
        events.append(
            CHHapticEvent(
                eventType: .hapticTransient,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: 1.0),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.35),
                ],
                relativeTime: 0
            )
        )

        // Thick continuous rumble that eases out (~0.85s).
        events.append(
            CHHapticEvent(
                eventType: .hapticContinuous,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.95),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.15),
                ],
                relativeTime: 0.02,
                duration: 0.85
            )
        )

        // Secondary thumps as the death animation sinks in.
        for (i, t) in [0.18, 0.36, 0.55].enumerated() {
            let intensity = Float(0.75 - Double(i) * 0.18)
            events.append(
                CHHapticEvent(
                    eventType: .hapticTransient,
                    parameters: [
                        CHHapticEventParameter(parameterID: .hapticIntensity, value: intensity),
                        CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.25),
                    ],
                    relativeTime: t
                )
            )
        }

        let curves: [CHHapticParameterCurve] = [
            CHHapticParameterCurve(
                parameterID: .hapticIntensityControl,
                controlPoints: [
                    CHHapticParameterCurve.ControlPoint(relativeTime: 0.02, value: 1.0),
                    CHHapticParameterCurve.ControlPoint(relativeTime: 0.35, value: 0.7),
                    CHHapticParameterCurve.ControlPoint(relativeTime: 0.87, value: 0.0),
                ],
                relativeTime: 0
            ),
        ]

        do {
            try engine.start()
            let pattern = try CHHapticPattern(events: events, parameterCurves: curves)
            let player = try engine.makePlayer(with: pattern)
            try player.start(atTime: 0)
        } catch {
            // Fallback: a couple of hard ticks if the patterned rumble fails.
            pulse(intensity: 1.0, sharpness: 0.3)
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) { [weak self] in
                self?.pulse(intensity: 0.7, sharpness: 0.2)
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.28) { [weak self] in
                self?.pulse(intensity: 0.45, sharpness: 0.15)
            }
        }
    }

    private func pulse(intensity: Float, sharpness: Float) {
        guard let engine else { return }
        let intensityParam = CHHapticEventParameter(parameterID: .hapticIntensity, value: min(1, intensity))
        let sharpParam = CHHapticEventParameter(parameterID: .hapticSharpness, value: min(1, sharpness))
        let event = CHHapticEvent(
            eventType: .hapticTransient,
            parameters: [intensityParam, sharpParam],
            relativeTime: 0
        )
        do {
            let pattern = try CHHapticPattern(events: [event], parameters: [])
            let player = try engine.makePlayer(with: pattern)
            try player.start(atTime: 0)
        } catch {
            // Soft-fail — haptics are optional juice.
        }
    }
}
#else
@MainActor
final class GhostPressureHaptics {
    func start() {}
    func stop() {}
    func update(pressure: CGFloat) {}
    func pelletTick() {}
    func deathRumble() {}
}
#endif
