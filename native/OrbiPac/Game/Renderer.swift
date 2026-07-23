import Foundation
import CoreGraphics
#if canImport(UIKit)
import UIKit
private func color(_ hex:String)->CGColor { UIColor(hex:hex).cgColor }
private extension UIColor { convenience init(hex:String){let s=hex.dropFirst();let v=UInt64(s,radix:16) ?? 0;self.init(red:CGFloat((v>>16)&255)/255,green:CGFloat((v>>8)&255)/255,blue:CGFloat(v&255)/255,alpha:1)} }
#else
import AppKit
private func color(_ hex:String)->CGColor { NSColor(hex:hex).cgColor }
private extension NSColor { convenience init(hex:String){let s=hex.dropFirst();let v=UInt64(s,radix:16) ?? 0;self.init(red:CGFloat((v>>16)&255)/255,green:CGFloat((v>>8)&255)/255,blue:CGFloat(v&255)/255,alpha:1)} }
#endif

final class Renderer {
    func draw(_ maze:Maze,_ pac:PacMan,_ ghosts:[Ghost],_ score:Int,_ lives:Int,_ phase:GamePhase,_ fright:CGFloat,_ time:CGFloat,_ level:Int=1,_ timer:CGFloat=0,_ high:Int=0,_ wonT:CGFloat=0,_ flipLeft:CGFloat=0,in context:CGContext,size:CGSize) {
        let scale=min(size.width,size.height)/Constants.canvas, ox=(size.width-Constants.canvas*scale)/2, oy=(size.height-Constants.canvas*scale)/2
        context.saveGState();context.translateBy(x:ox,y:oy);context.scaleBy(x:scale,y:scale);context.addEllipse(in:CGRect(x:0,y:0,width:336,height:336));context.clip()
        context.setFillColor(color(Colors.bg));context.fill(CGRect(x:0,y:0,width:336,height:336))
        let flipping = flipLeft > 0
        let white=phase == .won && wonT < Constants.wonFlashDuration && Int(wonT/Constants.wonFlashHalf)%2 == 0
        let wall: String
        if white { wall = "#ffffff" }
        else if flipping && Int(time * 8) % 2 == 0 { wall = Colors.flip }
        else { wall = Colors.wall }
        // Flip-dial: mirror the maze around the vertical axis; Pac stays screen-fixed.
        context.saveGState();context.translateBy(x:168,y:168)
        if flipping { context.scaleBy(x: -1, y: 1) }
        context.rotate(by:maze.rotation);drawWalls(maze,wall,context);drawPellets(maze,time,context);if phase == .won{drawWon(maze,wonT,context)};context.restoreGState()
        context.saveGState();context.translateBy(x:168,y:168);if flipping{context.scaleBy(x:-1,y:1)};drawHouse(maze,wall,white,context);context.restoreGState()
        if phase != .won {context.saveGState();context.translateBy(x:168,y:168);if flipping{context.scaleBy(x:-1,y:1)};context.rotate(by:maze.rotation);for g in ghosts where !g.inSpawnVisual{drawGhost(g,fright,time,context)};context.restoreGState()
            context.saveGState();context.translateBy(x:168,y:168);if flipping{context.scaleBy(x:-1,y:1)};drawPrize(maze,context);for g in ghosts where g.inSpawnVisual{drawGhost(g,fright,time,context)};drawLives(maze,lives,context);context.restoreGState()
            if pac.alive || phase == .dying{drawPac(pac,phase,time,timer,context)}
        }
        drawText(String(format:"%04d",score),at:CGPoint(x:168,y:18),size:11,color:Colors.score,context: context);if phase != .attract{drawText("L\(level)",at:CGPoint(x:168,y:32),size:8,color:"#a0a0c0",context: context)}
        if flipping && phase == .playing && Int(time * 3) % 2 == 0 {
            drawText("FLIP!",at:CGPoint(x:168,y:48),size:9,color:Colors.flip,context: context)
        }
        switch phase {case .attract: drawText("HIGH SCORE",at:CGPoint(x:168,y:152),size:5,color:"#a0a0c0",context: context);drawText(String(format:"%04d",high),at:CGPoint(x:168,y:164),size:9,color:Colors.score,context: context);if Int(time*2.4)%2==0{drawText("PRESS START",at:CGPoint(x:168,y:184),size:9,color:Colors.ready,context: context)}
        case .ready:drawText("READY!",at:CGPoint(x:168,y:176),size:12,color:Colors.ready,context: context)
        case .nameentry:drawText("HIGH SCORE!",at:CGPoint(x:168,y:176),size:9,color:Colors.ready,context: context)
        case .gameover:drawText("GAME OVER",at:CGPoint(x:168,y:176),size:11,color:"#ff0000",context: context)
        default:break}
        // Outer playfield edge is already drawn in drawWalls (maze.outerRadius).
        // Skip the extra CANVAS/2-1 rim — on retina it read as a second blue ring.
        context.restoreGState()
    }
    private func arc(_ c:CGContext,_ r:CGFloat,_ a:CGFloat,_ b:CGFloat){c.addArc(center:.zero,radius:r,startAngle:a,endAngle:b,clockwise:false)}
    private func strokeRing(_ r:CGFloat,_ gaps:[Gap],_ w:CGFloat,_ col:String,_ c:CGContext) {var blocks=[(CGFloat,CGFloat)]();for g in gaps {if g.start<=g.end{blocks.append((g.start,g.end))}else{blocks += [(g.start,.pi*2),(0,g.end)]}};blocks.sort{$0.0<$1.0};var cursor:CGFloat=0;c.setStrokeColor(color(col));c.setLineWidth(w);for b in blocks{if b.0>cursor{c.beginPath();arc(c,r,cursor,b.0);c.strokePath()};cursor=max(cursor,b.1)};if cursor < .pi*2{c.beginPath();arc(c,r,cursor,.pi*2);c.strokePath()}}
    private func drawWalls(_ m:Maze,_ col:String,_ c:CGContext){c.setStrokeColor(color(col));c.setLineWidth(3);c.strokeEllipse(in:CGRect(x:-m.outerRadius,y:-m.outerRadius,width:m.outerRadius*2,height:m.outerRadius*2));c.setStrokeColor(color(Colors.wallInner));c.setLineWidth(1.2);c.strokeEllipse(in:CGRect(x:-m.outerRadius+3,y:-m.outerRadius+3,width:(m.outerRadius-3)*2,height:(m.outerRadius-3)*2));for i in 1..<m.wallRadii.count{strokeRing(m.wallRadii[i],m.gaps[i],2.8,col,c);strokeRing(m.wallRadii[i]-2.5,m.gaps[i],1.1,Colors.wallInner,c)};for s in m.spokes{c.setStrokeColor(color(col));c.setLineWidth(2.6);c.move(to:CGPoint(x:cos(s.angle)*(s.rInner+2),y:sin(s.angle)*(s.rInner+2)));c.addLine(to:CGPoint(x:cos(s.angle)*(s.rOuter-2),y:sin(s.angle)*(s.rOuter-2)));c.strokePath()}}
    private func drawHouse(_ m:Maze,_ col:String,_ white:Bool,_ c:CGContext){c.setFillColor(color(Colors.house));c.fillEllipse(in:CGRect(x:-m.houseRadius,y:-m.houseRadius,width:m.houseRadius*2,height:m.houseRadius*2));strokeRing(m.wallRadii[0],m.gaps[0],3.2,col,c);strokeRing(m.wallRadii[0]-2.5,m.gaps[0],1.1,Colors.wallInner,c);c.setStrokeColor(color(white ? "#ffffff":Colors.gate));c.setLineWidth(2.5);for g in m.gaps[0]{c.beginPath();arc(c,m.wallRadii[0],g.start,g.end);c.strokePath()}}
    private func drawPellets(_ m:Maze,_ t:CGFloat,_ c:CGContext){
        for p in m.pellets where !p.eaten {
            let r=m.ringRadius(p.ring),x=cos(p.angle)*r,y=sin(p.angle)*r
            if p.flip {
                let pulse = 0.55 + 0.45 * sin(t * 7)
                c.setFillColor(color(Colors.flip)); c.setAlpha(pulse)
                // Diamond mark — distinct from power pellets.
                c.move(to: CGPoint(x: x, y: y - 6)); c.addLine(to: CGPoint(x: x + 5, y: y))
                c.addLine(to: CGPoint(x: x, y: y + 6)); c.addLine(to: CGPoint(x: x - 5, y: y)); c.closePath(); c.fillPath()
                c.setAlpha(1)
                continue
            }
            c.setFillColor(color(p.power ? Colors.power:Colors.pellet))
            if p.power { c.setAlpha(0.45+(0.5+0.5*sin(t*8))*0.55) }
            c.fillEllipse(in:CGRect(x:x-(p.power ? 5:1.7),y:y-(p.power ? 5:1.7),width:p.power ? 10:3.4,height:p.power ? 10:3.4))
            c.setAlpha(1)
        }
    }
    private func drawPrize(_ m:Maze,_ c:CGContext){guard let p=m.prize,p.active else{return};let r=m.ringRadius(p.ring),x=cos(p.angle)*r,y=sin(p.angle)*r;c.setFillColor(color(Colors.prize));c.fillEllipse(in:CGRect(x:x-6.7,y:y-5.2,width:8.4,height:8.4));c.fillEllipse(in:CGRect(x:x-1.2,y:y-3.7,width:8.4,height:8.4));c.setStrokeColor(color(Colors.prizeLeaf));c.setLineWidth(1.4);c.move(to:CGPoint(x:x-2,y:y-6));c.addQuadCurve(to:CGPoint(x:x+3,y:y-7),control:CGPoint(x:x,y:y-10));c.strokePath()}
    private func drawPac(_ p:PacMan,_ phase:GamePhase,_ time:CGFloat,_ timer:CGFloat,_ c:CGContext){let pos=Constants.cart(p.radius,Constants.pacScreenAngle);if phase == .dying {let t=max(0,min(1,1-timer/Constants.deathMS));if t >= 0.82{return};let open: CGFloat = .pi * 2 * (t/0.82);c.setFillColor(color(Colors.pac));c.move(to:pos);c.addArc(center:pos,radius:Constants.pacRadius,startAngle:p.facingAngle+open/2,endAngle:p.facingAngle + .pi*2-open/2,clockwise:false);c.fillPath();return};let chomp=(sin(p.mouth)+1)*0.32;c.setFillColor(color(Colors.pac));c.move(to:pos);c.addArc(center:pos,radius:Constants.pacRadius,startAngle:p.facingAngle+chomp,endAngle:p.facingAngle + .pi*2-chomp,clockwise:false);c.fillPath()}
    private func drawGhost(_ g:Ghost,_ fright:CGFloat,_ time:CGFloat,_ c:CGContext){let x=cos(g.angle)*g.radius,y=sin(g.angle)*g.radius,onMaze = !g.inSpawnVisual;c.saveGState();c.translateBy(x:x,y:y);if onMaze{c.rotate(by:g.angle + .pi/2)};c.translateBy(x:0,y:g.bobOffset);if g.mode == .eaten{eyes(g.facing,c);c.restoreGState();return};let scared=g.mode == .frightened,flash=scared && fright<2000 && Int(time*5)%2==0;c.setFillColor(color(scared ? (flash ? Colors.frightenedFlash:Colors.frightened):g.color));c.addArc(center:CGPoint(x:0,y:0.8),radius:7.6,startAngle:.pi,endAngle:0,clockwise:false);c.addLine(to:CGPoint(x:7.6,y:5.2));c.addLine(to:CGPoint(x:5,y:9));c.addLine(to:CGPoint(x:2.5,y:5.6));c.addLine(to:CGPoint(x:0,y:9));c.addLine(to:CGPoint(x:-2.5,y:5.6));c.addLine(to:CGPoint(x:-5,y:9));c.addLine(to:CGPoint(x:-7.6,y:5.2));c.closePath();c.fillPath();if scared{c.setFillColor(color(flash ? Colors.pupil:"#ffb8ff"));c.fill(CGRect(x:-4.2,y:-3.6,width:2.6,height:2.6));c.fill(CGRect(x:1.6,y:-3.6,width:2.6,height:2.6))}else{eyes(g.facing,c)};c.restoreGState()}
    private func eyes(_ d:Dir,_ c:CGContext){for s:CGFloat in [-1,1]{c.setFillColor(color(Colors.eyes));c.fillEllipse(in:CGRect(x:s*3.2-2.6,y:-6,width:5.2,height:6.2))};let p:(CGFloat,CGFloat);switch d{case .left:p=(-1.55,0);case .right:p=(1.55,0);case .up:p=(0,1.45);case .down:p=(0,-1.55)};for s:CGFloat in [-1,1]{c.setFillColor(color(Colors.pupil));c.fillEllipse(in:CGRect(x:s*3.2+p.0-1.35,y:-3.2+p.1-1.35,width:2.7,height:2.7))}}
    private func drawLives(_ m:Maze,_ lives:Int,_ c:CGContext){let n=max(0,lives-1);for i in 0..<n{let x=CGFloat(i-(n-1)/2)*12,y=m.houseRadius-5.5;c.setFillColor(color(Colors.pac));c.move(to:CGPoint(x:x,y:y));c.addArc(center:CGPoint(x:x,y:y),radius:4.2,startAngle:0.45,endAngle:.pi * 2 - 0.45,clockwise:false);c.fillPath()}}
    private func drawWon(_ m:Maze,_ t:CGFloat,_ c:CGContext){guard t<Constants.wonTotal else{return};let p=min(1,t/Constants.wonFlashDuration);ringText("NEXT",m.ringRadii[3],-.pi/2 - p * Constants.wonSpinRevs * .pi * 2,c);ringText("LEVEL",m.ringRadii[2],-.pi/2 + p * Constants.wonSpinRevs * .pi * 2,c)}
    private func ringText(_ word:String,_ r:CGFloat,_ a:CGFloat,_ c:CGContext){for (i,ch) in word.enumerated(){let angle=a-CGFloat(i-word.count/2)*11/r;let point=CGPoint(x:cos(angle)*r,y:sin(angle)*r);c.saveGState();c.translateBy(x:point.x,y:point.y);c.rotate(by:angle + .pi/2);drawText(String(ch),at:.zero,size:11,color:Colors.ready,context:c);c.restoreGState()}}
    private func drawText(_ text:String,at p:CGPoint,size:CGFloat,color hex:String,context c:CGContext){
        let font = ArcadeFont.ctFont(size: size)
        #if canImport(UIKit)
        let fg: Any = UIColor(cgColor: color(hex))
        #else
        let fg: Any = NSColor(cgColor: color(hex)) ?? NSColor.white
        #endif
        let attr: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: fg]
        let line = CTLineCreateWithAttributedString(NSAttributedString(string: text, attributes: attr))
        var ascent: CGFloat = 0
        var descent: CGFloat = 0
        let w = CTLineGetTypographicBounds(line, &ascent, &descent, nil)
        c.saveGState()
        // UIView / flipped NSView are y-down; CTLine is y-up — flip glyphs upright.
        c.textMatrix = CGAffineTransform(scaleX: 1, y: -1)
        c.textPosition = CGPoint(x: p.x - CGFloat(w) / 2, y: p.y + ascent * 0.35)
        CTLineDraw(line, c)
        c.restoreGState()
    }
}
