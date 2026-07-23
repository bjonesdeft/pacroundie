import SwiftUI

#if os(iOS)

/// Playfield only: counter-tilts against the phone so the maze stays visually frozen
/// in space while chrome around the circle moves with the device.
struct GameBoardSceneView: View {
    @ObservedObject var controller: GameController

    var body: some View {
        let pitch = controller.motion.counterPitch
        let roll = controller.motion.counterRoll
        let yaw = controller.motion.counterYaw

        ZStack {
            GameCanvasView(controller: controller)
                // Z: gravity upright so the score stays at the top (flat L/R tip, etc.).
                // X: forward/back cancel. Y roll unused — L/R is the in-plane spin.
                .rotation3DEffect(.radians(yaw), axis: (x: 0, y: 0, z: 1), perspective: 0.35)
                .rotation3DEffect(.radians(roll), axis: (x: 0, y: 1, z: 0), perspective: 0.35)
                .rotation3DEffect(.radians(pitch), axis: (x: 1, y: 0, z: 0), perspective: 0.35)
                // 3D effects break UIKit hit-testing — taps are handled by the overlay.
                .allowsHitTesting(false)

            Color.clear
                .contentShape(Rectangle())
                .onTapGesture {
                    controller.calibrateMotion()
                    controller.requestStart()
                }
        }
    }
}

#else

struct GameBoardSceneView: View {
    @ObservedObject var controller: GameController
    var body: some View {
        GameCanvasView(controller: controller)
    }
}

#endif
