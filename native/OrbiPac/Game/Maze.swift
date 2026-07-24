import Foundation
import CoreGraphics

final class Maze {
    let wallRadii: [CGFloat] = [46, 78, 110, 142]
    let outerRadius: CGFloat = 166, houseRadius: CGFloat = 34
    let ringRadii: [CGFloat]
    let gaps: [[Gap]]
    var spokes = [RadialWall](), pellets = [Pellet](), pelletCount = 0, pelletTotal = 0
    var prize: Prize?, rotation: CGFloat = 0

    init() {
        ringRadii = [(46+78)/2, (78+110)/2, (110+142)/2, (142+166)/2]
        func gap(_ mid: CGFloat, _ half: CGFloat) -> Gap { Gap(start: Constants.norm(mid-half), end: Constants.norm(mid+half)) }
        let h0 = Constants.gapHalfAngle(46) * 1.15, h1 = Constants.gapHalfAngle(78), h2 = Constants.gapHalfAngle(110), h3 = Constants.gapHalfAngle(142)
        // Three openings per playable wall, 120° apart. Adjacent walls stagger by 60°
        // so a cross never lands in the next hole without left/right travel.
        let base: CGFloat = 1.2, step = CGFloat.pi * 2 / 3, stagger = CGFloat.pi / 3
        gaps = [
            [gap(-.pi/2, h0)],
            [0,1,2].map { gap(base + CGFloat($0) * step, h1) },
            [0,1,2].map { gap(base + stagger + CGFloat($0) * step, h2) },
            [0,1,2].map { gap(base + CGFloat($0) * step, h3) },
        ]
        rebuildSpokes(0); spawnPellets()
    }
    var ringCount: Int { ringRadii.count }
    func rebuildSpokes(_ count: Int) {
        let n = max(0, min(8, count)); spokes = []; guard n > 0 else { return }
        let base = CGFloat.random(in: 0..<(.pi*2)); var slots = Array(0..<8); slots.shuffle()
        for slot in slots.prefix(n) {
            let ring = Int.random(in: 0..<ringCount), angle = Constants.norm(base + CGFloat(slot) * .pi*2/8)
            spokes.append(RadialWall(ring: ring, angle: angle, rInner: wallRadii[ring], rOuter: ring == ringCount-1 ? outerRadius : wallRadii[ring+1]))
        }
    }
    func prepareLevel(_ walls: Int) { rebuildSpokes(walls); spawnPellets(); prize=nil; rotation=0 }
    func rotate(_ delta: CGFloat) { rotation = Constants.norm(rotation + delta) }
    func toLocal(_ screen: CGFloat) -> CGFloat { Constants.norm(screen - rotation) }
    func toScreen(_ local: CGFloat) -> CGFloat { Constants.norm(local + rotation) }
    func inGap(_ wall: Int, _ local: CGFloat, _ pad: CGFloat = 0.012) -> Bool {
        let a = Constants.norm(wall == 0 ? toScreen(local) : local)
        return gaps[wall].contains { gap in
            let s=Constants.norm(gap.start-pad), e=Constants.norm(gap.end+pad)
            return s <= e ? (a >= s && a <= e) : (a >= s || a <= e)
        }
    }
    func nearestGapMid(_ wall: Int, _ local: CGFloat) -> CGFloat {
        let query = wall == 0 ? toScreen(local) : Constants.norm(local)
        let native = gaps[wall].min { Constants.angleDist(mid($0), query) < Constants.angleDist(mid($1), query) }!
        return wall == 0 ? toLocal(mid(native)) : mid(native)
    }
    private func mid(_ g: Gap) -> CGFloat { g.start <= g.end ? Constants.norm((g.start+g.end)/2) : Constants.norm(g.start + (.pi*2-g.start+g.end)/2) }
    func houseGateScreenMid() -> CGFloat { mid(gaps[0][0]) }
    func canPacCross(_ ring: Int, _ inner: Bool, _ a: CGFloat) -> Bool {
        inner ? (ring > 0 && inGap(ring,a,Constants.pacCrossPad)) : (ring < ringCount-1 && inGap(ring+1,a,Constants.pacCrossPad))
    }
    func wallIndexForPacCross(_ ring: Int, _ inner: Bool) -> Int { inner ? ring : ring+1 }
    func canGhostCross(_ ring: Int, _ inner: Bool, _ a: CGFloat) -> Bool {
        if inner { return ring >= 0 && inGap(ring == 0 ? 0 : ring,a) }
        return ring < 0 ? inGap(0,a) : (ring < ringCount-1 && inGap(ring+1,a))
    }
    func ringRadius(_ ring: Int) -> CGFloat { ring < 0 ? houseRadius * 0.55 : ringRadii[max(0,min(ringCount-1,ring))] }
    func wallIndexForCross(_ ring: Int, _ inner: Bool) -> Int { inner ? (ring <= 0 ? 0 : ring) : (ring < 0 ? 0 : ring+1) }
    func clampRotationForPac(_ ring:Int,_ a:CGFloat,_ d:CGFloat)->CGFloat { -clampAngularTravel(ring,a,-d) }
    func clampAngularTravel(_ ring: Int, _ a: CGFloat, _ delta: CGFloat) -> CGFloat {
        guard ring >= 0, delta != 0 else { return delta }; let half = Constants.pacRadius*1.08/ringRadius(ring); var allowed=delta
        for s in spokes where s.ring == ring { let d=Constants.delta(a,s.angle); if delta > 0 && d > 0 { allowed=min(allowed,max(0,d-half)) }; if delta < 0 && d < 0 { allowed=max(allowed,min(0,d+half)) } }
        return allowed
    }
    func spokeBlocksPath(_ ring:Int,_ from:CGFloat,_ to:CGFloat,_ dir:Int)->Bool {
        guard ring >= 0 else { return false }; let span=abs(Constants.delta(from,to))
        return spokes.contains { s in s.ring == ring && (Constants.delta(from,s.angle) > 0 ? 1 : -1) == dir && abs(Constants.delta(from,s.angle)) > 0.001 && abs(Constants.delta(from,s.angle)) < span }
    }
    func spawnPellets() {
        pellets=[]; let outer=ringCount-1, second=ringCount-2
        let powers=[(outer,CGFloat(0)),(outer,CGFloat.pi),(second,-CGFloat.pi/2),(second,CGFloat.pi/2)], counts=[16,22,28,34]
        for ring in 0..<ringCount { for i in 0..<counts[ring] { let a=CGFloat(i)/CGFloat(counts[ring]) * .pi*2
            if powers.contains(where: {$0.0==ring && Constants.angleDist(a,$0.1)<0.12}) || spokes.contains(where: {$0.ring==ring && Constants.angleDist(a,$0.angle)<0.1}) { continue }
            pellets.append(Pellet(ring:ring,angle:a,power:false,eaten:false))
        }}
        pellets += powers.map { Pellet(ring:$0.0,angle:Constants.norm($0.1),power:true,eaten:false,flip:false) }
        // One rare flip-dial pellet on an inner ring (mirrors controls + confuses ghosts).
        let flipRing = 1
        let flipAngle = Constants.norm(CGFloat.pi * 0.65)
        pellets.removeAll { !$0.power && $0.ring == flipRing && Constants.angleDist($0.angle, flipAngle) < 0.15 }
        pellets.append(Pellet(ring: flipRing, angle: flipAngle, power: false, eaten: false, flip: true))
        pelletCount=pellets.count; pelletTotal=pelletCount; prize=nil
    }
    func resetPellets() { for i in pellets.indices { pellets[i].eaten=false }; pelletCount=pellets.count; pelletTotal=pelletCount; prize=nil }
    var pelletsEaten: Int { pelletTotal-pelletCount }
    func maybeSpawnPrize(_ level:Int) {
        guard prize == nil, pelletsEaten >= pelletTotal/2 else { return }
        let ring = ringCount - 3
        guard ring >= 0 else { return }
        // 5% chance: Zookeeper's net instead of fruit.
        if CGFloat.random(in: 0..<1) < Constants.netSpawnChance {
            prize = Prize(ring: ring, angle: Constants.pacScreenAngle, points: 0, kind: -1, active: true, isNet: true)
            return
        }
        let idx = max(0, min(Constants.prizePoints.count - 1, level - 1))
        prize = Prize(
            ring: ring,
            angle: Constants.pacScreenAngle,
            points: Constants.prizePoints[idx],
            kind: fruitKindForLevel(level),
            active: true,
            isNet: false
        )
    }
    func tryEatPrize(_ ring:Int)->Prize? { guard let p=prize,p.active,p.ring==ring else{return nil}; prize=nil; return p }
    func tryEat(_ ring:Int,_ a:CGFloat,_ slop:CGFloat = 0.12)->Pellet? {
        tryEat(ring, a, slop: slop, regular: true, power: true, flip: true)
    }

    /// Eat matching pellet kinds. Mirror mode uses power/flip only while restoring regular dots.
    func tryEat(_ ring:Int,_ a:CGFloat, slop:CGFloat = 0.12, regular:Bool, power:Bool, flip:Bool)->Pellet? {
        for i in pellets.indices where !pellets[i].eaten && pellets[i].ring == ring && Constants.angleDist(pellets[i].angle,a) < slop {
            let p = pellets[i]
            if p.flip { guard flip else { continue } }
            else if p.power { guard power else { continue } }
            else { guard regular else { continue } }
            pellets[i].eaten=true; pelletCount -= 1; return pellets[i]
        }
        return nil
    }

    /// Mirror shadow: put a regular eaten dot back on the field.
    @discardableResult
    func tryRestoreDot(_ ring:Int,_ a:CGFloat,_ slop:CGFloat = 0.12)->Bool {
        for i in pellets.indices where pellets[i].eaten && !pellets[i].power && !pellets[i].flip
            && pellets[i].ring == ring && Constants.angleDist(pellets[i].angle,a) < slop {
            pellets[i].eaten = false
            pelletCount += 1
            return true
        }
        return false
    }
}
