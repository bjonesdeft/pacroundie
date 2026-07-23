import Foundation
import CoreGraphics

final class Ghost {
    let name: GhostName, color: String, releaseAt: CGFloat
    var ring = -1, targetRing = -1; var radius: CGFloat = 18, angle: CGFloat = 0, mode: GhostMode = .house, linearSpeed = Constants.ghostLinearSpeed, exitTimer: CGFloat
    private var movingRadial=false, crossingWall = -1, alignAngle: CGFloat?, homeAngle: CGFloat = 0
    var turn = 1, facing: Dir = .left
    private var bob: CGFloat = 0, housePhase=0, collideCool: CGFloat=0, houseRadiusTarget: CGFloat=16, houseWanderTimer: CGFloat=0, wallBounceLock: CGFloat=0, fromHouseExit=false, wanderTimer: CGFloat=0, wanderRing=0, wanderAngle: CGFloat=0, pendingDecision=false
    init(_ name: GhostName,_ color:String,_ release:CGFloat) { self.name=name; self.color=color; releaseAt=release; exitTimer=release }
    var inSpawnVisual: Bool { mode == .house || mode == .eaten }
    private func baseLinear()->CGFloat { Constants.ghostLinearSpeed * (Constants.ghostSpeed[name] ?? 1) }
    private func omega()->CGFloat { linearSpeed/max(24,radius) }
    func reset(_ inHouse:Bool,_ home:CGFloat,_ maze:Maze,_ attract:Bool=false) {
        homeAngle = home; angle = home; exitTimer = attract ? CGFloat.random(in: 400...1300) : releaseAt; movingRadial = false; crossingWall = -1; alignAngle = nil; housePhase = 0; collideCool = 0; wallBounceLock = 0; fromHouseExit = false; wanderTimer = 0; wanderRing = Int.random(in: 0..<maze.ringCount); wanderAngle = CGFloat.random(in: 0..<(.pi*2)); pendingDecision = false; houseRadiusTarget = CGFloat.random(in: 12...20); houseWanderTimer = CGFloat.random(in: 0.4...1.2); linearSpeed = baseLinear(); turn = Bool.random() ? 1 : -1; facing = turn > 0 ? .right : .left; bob = 0; mode = .house; ring = -1; targetRing = -1; radius = CGFloat.random(in: 10...18)
    }
    func bounceOffGhost() { guard collideCool <= 0, mode != .house, mode != .eaten, !movingRadial else{return}; turn = -turn; facing = turn > 0 ? .right : .left; alignAngle = nil; collideCool = 0.45; wallBounceLock = 0.25 }
    func frighten() { guard mode != .eaten, mode != .house else{return}; mode = .frightened; turn = -turn; facing = turn > 0 ? .right : .left; alignAngle = nil; wallBounceLock = 0.2; linearSpeed = Constants.frightLinearSpeed*(Constants.ghostSpeed[name] ?? 1) }
    /// Flip-dial burst: reverse cruise direction and scramble aim.
    func confuseBurst() {
        guard mode != .eaten, mode != .house else { return }
        turn = -turn
        facing = turn > 0 ? .right : .left
        alignAngle = nil
        wallBounceLock = 0.35
        pendingDecision = true
    }
    func becomeEaten(_ maze:Maze) { angle = maze.toScreen(angle); mode = .eaten; alignAngle = nil; movingRadial = false; crossingWall = -1; pendingDecision = false; fromHouseExit = false; linearSpeed = Constants.eatenLinearSpeed*(Constants.ghostSpeed[name] ?? 1) }
    func setMode(_ next:GhostMode,_ force:Bool=false) { if !force && (mode == .frightened || mode == .eaten || mode == .house) {return}; mode=next; linearSpeed=baseLinear() }
    func update(_ maze:Maze,_ dt:CGFloat,_ pac:PacSnapshot,_ blinky:Ghost,_ elapsed:CGFloat,_ attract:Bool=false,_ confused:Bool=false) {
        bob += dt; collideCool -= dt; wallBounceLock -= dt
        if mode == .house { updateHouse(maze,dt); return }; if mode == .eaten { updateEaten(maze,dt); return }; if movingRadial { stepRadial(maze,dt); return }
        if ring >= 0 {radius=maze.ringRadius(ring)}
        let target: (Int, CGFloat)
        if attract { target = wander(maze, dt) }
        else if confused && mode != .frightened { target = confuseTarget(maze, pac, elapsed) }
        else { target = computeTarget(maze, pac, blinky) }
        let delta=target.0-ring
        if delta != 0 { approachAndCross(maze,dt,ring+(delta > 0 ? 1:-1),delta < 0); return }
        alignAngle=nil; let preferred=Constants.delta(angle,target.1) >= 0 ? 1:-1; chooseTurn(maze.spokeBlocksPath(ring,angle,target.1,preferred) ? -preferred:preferred,maze); _=cruise(maze,dt)
    }
    private func confuseTarget(_ maze:Maze,_ pac:PacSnapshot,_ elapsed:CGFloat)->(Int,CGFloat) {
        let outer = maze.ringCount - 1
        let ring = abs(outer - pac.ring) >= pac.ring ? outer : 0
        let phase: CGFloat
        switch name {
        case .blinky: phase = 0
        case .pinky: phase = 1.4
        case .inky: phase = 2.7
        case .clyde: phase = 4.1
        }
        let wobble = sin(elapsed * 3.1 + phase) * 0.9
        return (ring, Constants.norm(pac.angle + .pi + wobble))
    }
    private func wander(_ maze:Maze,_ dt:CGFloat)->(Int,CGFloat) { wanderTimer -= dt; if wanderTimer <= 0 {wanderTimer=CGFloat.random(in:1.2...3.6);if Bool.random(){wanderRing=Int.random(in:0..<maze.ringCount)};wanderAngle=CGFloat.random(in:0..<(.pi*2))};return(wanderRing,wanderAngle) }
    private func decision(_ maze:Maze)->Bool { pendingDecision || (ring >= 0 && (maze.inGap(ring,angle,0.07) || (ring+1 < maze.gaps.count && maze.inGap(ring+1,angle,0.07)))) }
    private func chooseTurn(_ prefer:Int,_ maze:Maze) { guard wallBounceLock <= 0 else{return}; if prefer == turn {if pendingDecision{pendingDecision=false};return}; guard decision(maze) else{return};turn=prefer;pendingDecision=false }
    private func approachAndCross(_ maze:Maze,_ dt:CGFloat,_ target:Int,_ inner:Bool) {
        let wall=maze.wallIndexForCross(ring,inner); guard wall >= 0 && wall < maze.gaps.count else {_=cruise(maze,dt);return}
        if wall == 0 || alignAngle == nil {alignAngle=maze.nearestGapMid(wall,angle)}
        guard let aim=alignAngle else{return}
        if Constants.angleDist(angle,aim) > Constants.gapAlign {let pref=Constants.delta(angle,aim) >= 0 ? 1:-1; chooseTurn(maze.spokeBlocksPath(ring,angle,aim,pref) ? -pref:pref,maze);if cruise(maze,dt){alignAngle=maze.nearestGapMid(wall,angle)};return}
        guard maze.inGap(wall,angle,0.02) else {alignAngle=maze.nearestGapMid(wall,angle);_=cruise(maze,dt);return}
        angle=aim;targetRing=target;crossingWall=wall;movingRadial=true;alignAngle=nil;facing=inner ? .up:.down
    }
    @discardableResult private func cruise(_ maze:Maze,_ dt:CGFloat)->Bool { let wanted=CGFloat(turn)*omega()*dt, allowed=maze.clampAngularTravel(ring,angle,wanted); let bounced=abs(wanted)>1e-8 && abs(allowed) < abs(wanted)*0.9; angle=Constants.norm(angle+allowed);if bounced{turn = -turn;alignAngle = nil;wallBounceLock = 0.35};facing=turn>0 ? .right:.left;return bounced }
    private func updateHouse(_ maze:Maze,_ dt:CGFloat) {
        let gate=maze.houseGateScreenMid(), maxR=maze.houseRadius-10
        if housePhase == 0 {exitTimer -= dt*1000; wanderHouse(dt,maxR);if exitTimer <= 0{housePhase=1};return}
        if housePhase == 1 {facing = .up;let step=28*dt;if radius > 3+step{radius-=step}else{radius=3;housePhase=2};return}
        facing = .up;let astep=2.2*dt,d=Constants.delta(angle,gate);angle=abs(d)>astep ? Constants.norm(angle+(d<0 ? -astep:astep)):gate;let gr=maze.wallRadii[0]-2,step=26*dt;radius=radius < gr-step ? radius+step:gr
        if Constants.angleDist(angle,gate) < 0.08 && abs(radius-gr)<2.5 {angle=maze.toLocal(gate);mode = .scatter;housePhase=0;ring = -1;targetRing=0;crossingWall=0;movingRadial=true;fromHouseExit=true;alignAngle = nil;pendingDecision=true;linearSpeed=baseLinear();facing = .up}
    }
    private func wanderHouse(_ dt:CGFloat,_ maxR:CGFloat) { houseWanderTimer-=dt;if houseWanderTimer <= 0{houseWanderTimer=CGFloat.random(in:0.5...1.7);if Bool.random(){turn = -turn};houseRadiusTarget=CGFloat.random(in:6...maxR)};angle=Constants.norm(angle+CGFloat(turn)*0.55*dt);facing=turn>0 ? .right:.left;let s=10*dt,d=houseRadiusTarget-radius;radius=abs(d)>s ? radius+(d<0 ? -s:s):houseRadiusTarget;radius=max(5,min(maxR,radius)) }
    private func updateEaten(_ maze:Maze,_ dt:CGFloat) { let ga=maze.houseGateScreenMid(),gr=maze.wallRadii[0]-2,target=CGPoint(x:cos(ga)*gr,y:sin(ga)*gr),cur=CGPoint(x:cos(angle)*radius,y:sin(angle)*radius),dx=target.x-cur.x,dy=target.y-cur.y,d=hypot(dx,dy),step=Constants.eatenLinearSpeed*(Constants.ghostSpeed[name] ?? 1)*1.15*dt
        if d <= step {angle=homeAngle;radius=12;ring = -1;targetRing = -1;mode = .house;housePhase=0;exitTimer=1200;houseRadiusTarget=12;houseWanderTimer = 0.3;linearSpeed=baseLinear();alignAngle = nil;facing = .up;return};let n=CGPoint(x:cur.x+dx/d*step,y:cur.y+dy/d*step);radius=hypot(n.x,n.y);angle=Constants.norm(atan2(n.y,n.x));facing=abs(dx)>=abs(dy) ? (dx>0 ? .right:.left):(dy>0 ? .down:.up) }
    private func computeTarget(_ maze:Maze,_ pac:PacSnapshot,_ blinky:Ghost)->(Int,CGFloat) {
        if mode == .frightened { let outer=maze.ringCount-1; return(abs(outer-pac.ring) >= pac.ring ? outer:0,Constants.norm(pac.angle + .pi)) }
        if mode == .scatter { switch name { case .blinky:return(3,0.3); case .pinky:return(3,.pi - 0.3); case .inky:return(0,0.4); case .clyde:return(0,.pi + 0.4) } }
        switch name {
        case .blinky: return(pac.ring,pac.angle)
        case .pinky: return offset(maze,pac,4)
        case .inky:
            let p=offset(maze,pac,2), br=max(0,blinky.ring)
            return(max(0,min(maze.ringCount-1,p.0*2-br)),Constants.norm(p.1 + Constants.delta(blinky.angle,p.1)))
        case .clyde:
            return CGFloat(abs(ring-pac.ring)) + Constants.angleDist(angle,pac.angle)/Constants.angleStep > 8 ? (pac.ring,pac.angle):(0,.pi + 0.4)
        }
    }
    private func offset(_ maze:Maze,_ pac:PacSnapshot,_ steps:Int)->(Int,CGFloat) {switch pac.facing{case .up:return(max(0,pac.ring-steps),pac.angle);case .down:return(min(maze.ringCount-1,pac.ring+steps),pac.angle);case .left:return(pac.ring,Constants.norm(pac.angle+CGFloat(steps)*Constants.angleStep));case .right:return(pac.ring,Constants.norm(pac.angle-CGFloat(steps)*Constants.angleStep))}}
    private func stepRadial(_ maze:Maze,_ dt:CGFloat) {if crossingWall == 0 {angle=maze.toLocal(maze.houseGateScreenMid())} else if crossingWall >= 0 && !maze.inGap(crossingWall,angle,0.1){movingRadial=false;crossingWall = -1;alignAngle=nil;fromHouseExit=false;pendingDecision=true;radius=maze.ringRadius(ring);return};let dest=targetRing < 0 ? maze.houseRadius*0.5:maze.ringRadius(targetRing),step=(fromHouseExit ? Constants.houseExitRadial:linearSpeed)*dt,d=dest-radius;facing=d<0 ? .up:.down;if abs(d)<=step{radius=dest;ring=targetRing;movingRadial=false;crossingWall = -1;alignAngle=nil;fromHouseExit=false;pendingDecision=true;if ring>=0{radius=maze.ringRadius(ring)}}else{radius += d<0 ? -step:step} }
    var bobOffset:CGFloat {sin(bob*3.2)*0.9}; var skirtPhase:CGFloat {bob*8}
}
