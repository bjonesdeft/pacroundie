import SwiftUI

#if os(iOS)
import UIKit

struct GameCanvasView: UIViewRepresentable {
    @ObservedObject var controller: GameController

    func makeUIView(context: Context) -> GameCanvasUIView {
        let view = GameCanvasUIView()
        view.controller = controller
        view.isMultipleTouchEnabled = false
        view.backgroundColor = .black
        controller.attachCanvas(view)
        return view
    }

    func updateUIView(_ uiView: GameCanvasUIView, context: Context) {
        uiView.controller = controller
        controller.attachCanvas(uiView)
        // Display-link path calls setNeedsDisplay; avoid extra SwiftUI-driven redraws.
    }
}

final class GameCanvasUIView: UIView {
    weak var controller: GameController?

    override init(frame: CGRect) {
        super.init(frame: frame)
        contentMode = .redraw
        isOpaque = true
        backgroundColor = .black
        // Layer-backed drawing stays smoother under 3D board transforms.
        layer.drawsAsynchronously = true
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    override func draw(_ rect: CGRect) {
        guard let context = UIGraphicsGetCurrentContext(), let controller else { return }
        controller.engine.draw(in: context, size: bounds.size)
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        controller?.calibrateMotion()
        controller?.requestStart()
    }
}

#else
import AppKit

struct GameCanvasView: NSViewRepresentable {
    @ObservedObject var controller: GameController

    func makeNSView(context: Context) -> GameCanvasNSView {
        let view = GameCanvasNSView()
        view.controller = controller
        return view
    }

    func updateNSView(_ nsView: GameCanvasNSView, context: Context) {
        nsView.controller = controller
        nsView.needsDisplay = true
    }
}

final class GameCanvasNSView: NSView {
    weak var controller: GameController?
    private var timer: Timer?
    private var keyMonitor: Any?

    override var isFlipped: Bool { true }
    override var acceptsFirstResponder: Bool { true }

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        window?.makeFirstResponder(self)
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 1.0 / 60.0, repeats: true) { [weak self] _ in
            guard let self, let controller else { return }
            controller.engine.update(rawDt: 1.0 / 60.0)
            controller.phase = controller.engine.phase
            controller.objectWillChange.send()
            self.needsDisplay = true
        }
        keyMonitor = NSEvent.addLocalMonitorForEvents(matching: [.keyDown, .keyUp]) { [weak self] event in
            self?.handleKey(event)
            return event
        }
    }

    deinit {
        timer?.invalidate()
        if let keyMonitor { NSEvent.removeMonitor(keyMonitor) }
    }

    override func draw(_ dirtyRect: NSRect) {
        guard let context = NSGraphicsContext.current?.cgContext, let controller else { return }
        controller.engine.draw(in: context, size: bounds.size)
    }

    override func mouseUp(with event: NSEvent) {
        controller?.requestStart()
    }

    private func handleKey(_ event: NSEvent) {
        let down = event.type == .keyDown
        if event.isARepeat && down { return }
        let map: [UInt16: Dir] = [
            126: .up, 125: .down, 123: .left, 124: .right,
            13: .up, 1: .down, 0: .left, 2: .right, // WASD
        ]
        if let dir = map[event.keyCode] {
            if down { controller?.pressKey(dir) } else { controller?.releaseKey(dir) }
            return
        }
        if down && (event.keyCode == 49 || event.keyCode == 36) { // space / return
            controller?.requestStart()
        }
    }
}
#endif
