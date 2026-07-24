import Foundation
import CoreGraphics

final class PacMan {
    var ring, targetRing: Int; var radius: CGFloat; var facing: Dir = .up
    var facingAngle: CGFloat = -.pi/2, mouth: CGFloat = -.pi/2, alive = true
    private var moving=false, alignRot: CGFloat?, pendingCross: (Int, Dir)?
    private var radialCool: CGFloat = 0
    /// Continuous outer-ring cruise in one direction (radians of maze rotation).
    private var outerLoopProgress: CGFloat = 0
    private var outerLoopSign = 0
    private var mirrorLoopReady = false
    private let faceAngles: [Dir:CGFloat] = [.right:0,.down:.pi/2,.left:.pi,.up:-.pi/2]
    init(_ maze: Maze) { ring=maze.ringCount-1; targetRing=ring; radius=maze.ringRadius(ring) }
    func reset(_ maze: Maze) {
        ring=maze.ringCount-1; targetRing=ring; radius=maze.ringRadius(ring)
        facing = .up; facingAngle = -.pi/2; mouth = -.pi/2; alive=true
        moving=false; alignRot=nil; pendingCross=nil; radialCool=0
        resetOuterLoop()
    }
    var isMoving: Bool { moving || alignRot != nil }
    func localAngle(_ maze: Maze)->CGFloat { maze.toLocal(Constants.pacScreenAngle) }
    func occupancyRing(_ maze: Maze)->Int { guard moving else{return ring}; return abs(radius-maze.ringRadius(ring)) < abs(radius-maze.ringRadius(targetRing)) ? ring : targetRing }

    /// True once after a full 360° cruise on the outermost ring in one continuous move.
    func consumeMirrorLoopTrigger() -> Bool {
        defer { mirrorLoopReady = false }
        return mirrorLoopReady
    }

    func resetOuterLoop() {
        outerLoopProgress = 0
        outerLoopSign = 0
        mirrorLoopReady = false
    }

    func update(_ maze: Maze,_ dt: CGFloat,_ held:Set<Dir>,_ impulse:CGFloat) {
        guard alive else{return}; var active=false
        if let align=alignRot, let pending=pendingCross {
            resetOuterLoop()
            let d=Constants.delta(maze.rotation,align), step=CGFloat(4.2)*dt
            if abs(d) <= step { maze.rotation=align; alignRot=nil; targetRing=pending.0; facing=pending.1; pendingCross=nil; moving=true } else { maze.rotate((d < 0 ? -1:1)*step) }; active=true
        } else if !moving {
            var rot=impulse; let omega=Constants.pacLinearSpeed/max(24,radius)
            if held.contains(.left) {rot -= omega*dt}; if held.contains(.right) {rot += omega*dt}
            var applied: CGFloat = 0
            if rot != 0 {
                rot=maze.clampRotationForPac(ring,localAngle(maze),rot)
                if rot != 0 {
                    maze.rotate(rot)
                    applied = rot
                    facing=rot < 0 ? .left:.right
                    active=true
                }
            }
            trackOuterLoop(maze: maze, held: held, applied: applied)

            let local=localAngle(maze)
            radialCool = max(0, radialCool - dt)
            if radialCool <= 0 {
                if held.contains(.up),maze.canPacCross(ring,true,local) {
                    resetOuterLoop()
                    let mid=maze.nearestGapMid(maze.wallIndexForPacCross(ring,true),local)
                    alignRot=Constants.norm(Constants.pacScreenAngle-mid)
                    pendingCross=(ring-1,.up); facing = .up; active=true
                } else if held.contains(.down),maze.canPacCross(ring,false,local) {
                    resetOuterLoop()
                    let mid=maze.nearestGapMid(maze.wallIndexForPacCross(ring,false),local)
                    alignRot=Constants.norm(Constants.pacScreenAngle-mid)
                    pendingCross=(ring+1,.down); facing = .down; active=true
                }
            }
        }
        if moving {
            resetOuterLoop()
            let dest=maze.ringRadius(targetRing), step=Constants.pacLinearSpeed*dt, delta=dest-radius
            if abs(delta) <= step {radius=dest;ring=targetRing;moving=false;radialCool=Constants.radialCrossCooldown} else {radius += (delta < 0 ? -step:step)}
            facing=delta < 0 ? .up:.down; active=true
        }
        let target=faceAngles[facing]!; let d=Constants.delta(facingAngle,target), step=14*dt
        facingAngle = abs(d) <= step ? target : Constants.norm(facingAngle + (d < 0 ? -step:step))
        mouth = active ? mouth + dt*22 : -.pi/2
    }

    private func trackOuterLoop(maze: Maze, held: Set<Dir>, applied: CGFloat) {
        let outer = maze.ringCount - 1
        let holdingTurn = held.contains(.left) || held.contains(.right)
        guard ring == outer, holdingTurn else {
            resetOuterLoop()
            return
        }
        guard applied != 0 else { return } // blocked by spoke — stall, don't reset
        let sign = applied < 0 ? -1 : 1
        if outerLoopSign != 0 && sign != outerLoopSign {
            outerLoopProgress = 0
        }
        outerLoopSign = sign
        outerLoopProgress += abs(applied)
        if outerLoopProgress >= .pi * 2 {
            mirrorLoopReady = true
            outerLoopProgress = 0
            outerLoopSign = 0
        }
    }
}
