import Foundation
import CoreGraphics

enum Constants {
    static let canvas: CGFloat = 336, cx: CGFloat = 168, cy: CGFloat = 168
    static let pacScreenAngle: CGFloat = .pi / 2, pacRadius: CGFloat = 8.5
    static let pacLinearSpeed: CGFloat = 122, ghostLinearSpeed: CGFloat = 58
    static let houseExitRadial: CGFloat = 26, frightLinearSpeed: CGFloat = 38, eatenLinearSpeed: CGFloat = 105
    static let eatFreezeMS: CGFloat = 550, prizeMS: CGFloat = 10_000
    /// Flip-dial power duration (ms).
    static let flipMS: CGFloat = 5500
    static let prizePoints = [100,300,500,500,700,700,1000,1000,2000,2000,3000,3000,5000]
    static let ghostSpeed: [GhostName: CGFloat] = [.blinky: 1.12, .pinky: 1.02, .inky: 0.94, .clyde: 0.86]
    static let gapAlign: CGFloat = 0.055, pacCrossPad: CGFloat = 0.09, gameSpeed: CGFloat = 1.5625
    static let frightenedMS: CGFloat = 7000, readyMS: CGFloat = 2200, deathMS: CGFloat = 1980, gameOverMS: CGFloat = 2800
    static let wonFlashCount = 4, wonFlashHalf: CGFloat = 0.4, wonFlashDuration: CGFloat = 3.2
    static let wonSpinRevs: CGFloat = 2, wonFade: CGFloat = 0.45, wonTotal: CGFloat = 3.65
    static let angleStep: CGFloat = .pi * 2 / 34
    static func gapHalfAngle(_ radius: CGFloat) -> CGFloat { pacRadius * 1.2 / radius }
    static func norm(_ a: CGFloat) -> CGFloat { let t = a.truncatingRemainder(dividingBy: .pi * 2); return t < 0 ? t + .pi * 2 : t }
    static func delta(_ a: CGFloat, _ b: CGFloat) -> CGFloat {
        var d = norm(b) - norm(a); if d > .pi { d -= .pi * 2 }; if d < -.pi { d += .pi * 2 }; return d
    }
    static func angleDist(_ a: CGFloat, _ b: CGFloat) -> CGFloat { abs(delta(a, b)) }
    static func distance(_ a: CGPoint, _ b: CGPoint) -> CGFloat { hypot(a.x-b.x, a.y-b.y) }
    static func cart(_ radius: CGFloat, _ angle: CGFloat, _ center: CGPoint = CGPoint(x: cx, y: cy)) -> CGPoint {
        CGPoint(x: center.x + cos(angle) * radius, y: center.y + sin(angle) * radius)
    }
}

enum Colors {
    static let bg="#000000", wall="#2121de", wallInner="#000040", pellet="#ffb897", power="#ffb897", pac="#ffff00"
    static let score="#ffffff", ready="#ffff00", blinky="#ff0000", pinky="#ffb8ff", inky="#00ffff", clyde="#ffb852"
    static let frightened="#2121ff", frightenedFlash="#ffffff", eyes="#ffffff", pupil="#2121de", gate="#ffb8ff"
    static let house="#0a0a18", prize="#ff4a6a", prizeLeaf="#22c55e"
    static let flip="#c084fc"
}
