import SwiftUI

struct ContentView: View {
    @StateObject private var controller = GameController()
    @State private var playerName = ""

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color(red: 0.07, green: 0.07, blue: 0.11), .black],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            VStack(spacing: 14) {
                VStack(spacing: 6) {
                    Text("ORBI-PAC")
                        .font(ArcadeFont.swiftUI(size: 22))
                        .foregroundStyle(.yellow)
                        .shadow(color: .orange.opacity(0.55), radius: 0, x: 2, y: 2)
                    Text("SPIN THE MAZE · CHOMP THE RINGS")
                        .font(ArcadeFont.swiftUI(size: 7))
                        .foregroundStyle(Color(white: 0.45))
                        .multilineTextAlignment(.center)
                }
                .padding(.top, 8)

                #if os(iOS)
                GameBoardSceneView(controller: controller)
                    .aspectRatio(1, contentMode: .fit)
                    .frame(maxWidth: 640, maxHeight: 640)
                    .clipShape(Circle())
                    .overlay(Circle().stroke(Color(white: 0.14), lineWidth: 3))
                    .shadow(color: Color(red: 0.13, green: 0.13, blue: 0.87).opacity(0.28), radius: 20)
                    .padding(.horizontal, 12)
                #else
                GameCanvasView(controller: controller)
                    .aspectRatio(1, contentMode: .fit)
                    .frame(maxWidth: 640, maxHeight: 640)
                    .clipShape(Circle())
                    .overlay(Circle().stroke(Color(white: 0.14), lineWidth: 3))
                    .shadow(color: Color(red: 0.13, green: 0.13, blue: 0.87).opacity(0.28), radius: 20)
                    .padding(.horizontal, 12)
                #endif

                #if os(iOS)
                if controller.motionEnabled {
                    Text("TILT TO STEER · TAP MAZE TO START")
                        .font(ArcadeFont.swiftUI(size: 7))
                        .foregroundStyle(Color(white: 0.45))
                        .multilineTextAlignment(.center)
                        .padding(.bottom, 2)
                } else {
                    ThumbstickView(
                        onChange: { dx, dy, maxTravel in
                            controller.applyStick(dx: dx, dy: dy, maxTravel: maxTravel)
                        },
                        onEnd: { controller.clearStick() }
                    )
                    .frame(maxWidth: .infinity)
                    .padding(.bottom, 4)
                }
                #else
                ThumbstickView(
                    onChange: { dx, dy, maxTravel in
                        controller.applyStick(dx: dx, dy: dy, maxTravel: maxTravel)
                    },
                    onEnd: { controller.clearStick() }
                )
                .frame(maxWidth: .infinity)
                .padding(.bottom, 4)
                #endif

                HStack(spacing: 12) {
                    Button("HOW TO PLAY") { controller.showHelp = true }
                        .buttonStyle(ArcadeButtonStyle())
                    Button("HIGH SCORES") { controller.showScores = true }
                        .buttonStyle(ArcadeButtonStyle())
                }
                .padding(.bottom, 10)
            }
        }
        .onAppear { controller.start() }
        .onDisappear { controller.stop() }
        .sheet(isPresented: $controller.showHelp) { HelpSheet() }
        .sheet(isPresented: $controller.showScores) { ScoresView() }
        .sheet(item: $controller.nameEntry) { entry in
            NameEntrySheet(score: entry.score, level: entry.level, name: $playerName) {
                controller.submitName(playerName)
                playerName = ""
            }
        }
    }
}

private struct HelpSheet: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ZStack {
                Color.black.ignoresSafeArea()
                VStack(alignment: .leading, spacing: 12) {
                    Text("HOW TO PLAY")
                        .font(ArcadeFont.swiftUI(size: 14))
                        .foregroundStyle(.yellow)
                        .frame(maxWidth: .infinity)
                    Group {
                        Text("Pac stays on the dial. Align openings to travel between rings.")
                        Text("On iPhone: tap to start while looking at the maze — that freezes the playfield.")
                        Text("Tilt to steer; the maze stays put while the phone moves around it.")
                        Text("Feel the buzz — hunters on your ring close the gap.")
                        Text("Purple diamond = FLIP: controls invert, maze mirrors, ghosts scramble.")
                        Text("Mac: arrow keys / WASD.")
                        Text("Ghosts spawn in the center.")
                    }
                    .font(ArcadeFont.swiftUI(size: 8))
                    .foregroundStyle(Color(white: 0.7))
                    .lineSpacing(4)
                    Button("GOT IT") { dismiss() }
                        .buttonStyle(ArcadeButtonStyle())
                        .frame(maxWidth: .infinity)
                        .padding(.top, 8)
                }
                .padding(24)
            }
        }
    }
}

private struct NameEntrySheet: View {
    let score: Int
    let level: Int
    @Binding var name: String
    let onSave: () -> Void

    var body: some View {
        ZStack {
            Color.black.opacity(0.92).ignoresSafeArea()
            VStack(spacing: 14) {
                Text("HIGH SCORE")
                    .font(ArcadeFont.swiftUI(size: 14))
                    .foregroundStyle(.yellow)
                Text(String(format: "SCORE %05d · L%d", score, level))
                    .font(ArcadeFont.swiftUI(size: 9))
                    .foregroundStyle(.white)
                Text("ENTER YOUR NAME")
                    .font(ArcadeFont.swiftUI(size: 8))
                    .foregroundStyle(Color(white: 0.55))
                TextField("PLAYER", text: $name)
                    #if os(iOS)
                    .textInputAutocapitalization(.characters)
                    .disableAutocorrection(true)
                    #endif
                    .multilineTextAlignment(.center)
                    .font(ArcadeFont.swiftUI(size: 14))
                    .foregroundStyle(.yellow)
                    .padding(12)
                    .background(Color.black)
                    .overlay(Rectangle().stroke(Color.yellow, lineWidth: 2))
                    .onChange(of: name) { value in
                        let clipped = String(value.uppercased().prefix(nameMaxLength))
                        if clipped != value { name = clipped }
                    }
                Button("SAVE", action: onSave)
                    .buttonStyle(ArcadeButtonStyle())
                    .disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
            .padding(28)
            .background(Color(red: 0.03, green: 0.03, blue: 0.06))
            .overlay(Rectangle().stroke(Color.yellow, lineWidth: 2))
            .padding(24)
        }
        .interactiveDismissDisabled()
    }
}

#Preview {
    ContentView()
}
