import Foundation
import CoreGraphics

final class InputState {
    private(set) var held = Set<Dir>(); private var pressCount=[Dir:Int](), restart=false, rotateImpulse:CGFloat=0
    static let tapRotate:CGFloat = 0.12, deadzone:CGFloat = 0.22, axis:CGFloat = 0.32
    func press(_ dir:Dir) {let n=(pressCount[dir] ?? 0)+1;pressCount[dir]=n;guard n==1 else{return};held.insert(dir);if dir == .left{rotateImpulse -= Self.tapRotate};if dir == .right{rotateImpulse += Self.tapRotate}}
    func release(_ dir:Dir) {let n=(pressCount[dir] ?? 0)-1;if n <= 0 {pressCount[dir]=nil;held.remove(dir)}else{pressCount[dir]=n}}
    func clearAll(){held.removeAll();pressCount.removeAll()}
    func requestRestart(){restart=true}
    func consumeRestart()->Bool{defer{restart=false};return restart}
    func consumeRotateImpulse()->CGFloat{defer{rotateImpulse=0};return rotateImpulse}
    /// Samples a virtual thumbstick vector in points and replaces the supplied active stick directions.
    static func directions(dx:CGFloat,dy:CGFloat,maxTravel:CGFloat)->Set<Dir> {
        guard maxTravel > 0, hypot(dx,dy)/maxTravel >= deadzone else{return []};let x=dx/maxTravel,y=dy/maxTravel;var result=Set<Dir>()
        if x <= -axis{result.insert(.left)};if x >= axis{result.insert(.right)};if y <= -axis{result.insert(.up)};if y >= axis{result.insert(.down)}
        if result.isEmpty {if abs(x) >= abs(y){result.insert(x<0 ? .left:.right)}else{result.insert(y<0 ? .up:.down)}};return result
    }
    func replaceStickDirections(_ old:Set<Dir>,_ next:Set<Dir>) {for d in old where !next.contains(d){release(d)};for d in next where !old.contains(d){press(d)}}
}
