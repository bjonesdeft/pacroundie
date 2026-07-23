import Foundation
import CoreGraphics

enum Dir: Hashable {
    case up, down, left, right
    /// Flip-dial: reverse every axis.
    var flipped: Dir {
        switch self {
        case .up: return .down
        case .down: return .up
        case .left: return .right
        case .right: return .left
        }
    }
}
enum GhostMode { case scatter, chase, frightened, eaten, house }
enum GhostName: CaseIterable { case blinky, pinky, inky, clyde }
enum GamePhase { case attract, ready, playing, dying, won, nameentry, gameover }

struct Gap { var start: CGFloat; var end: CGFloat }
struct RadialWall { var ring: Int; var angle, rInner, rOuter: CGFloat }
struct Pellet { var ring: Int; var angle: CGFloat; var power, eaten: Bool; var flip: Bool = false }
struct Prize { var ring: Int; var angle: CGFloat; var points, kind: Int; var active: Bool }
struct Polar { var radius, angle: CGFloat }
struct PacSnapshot { var ring: Int; var angle: CGFloat; var facing: Dir; var radius: CGFloat }
struct ScoreEntry: Codable {
    var name: String; var score: Int; var level: Int; var at: TimeInterval
}
