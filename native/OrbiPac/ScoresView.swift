import SwiftUI

struct ScoresView: View {
    @Environment(\.dismiss) private var dismiss
    private let board = loadLeaderboard()

    var body: some View {
        NavigationStack {
            ZStack {
                Color.black.ignoresSafeArea()
                VStack(spacing: 16) {
                    Text("ORBI-PAC")
                        .font(ArcadeFont.swiftUI(size: 18))
                        .foregroundStyle(.yellow)
                    Text("HIGH SCORES · TOP TEN")
                        .font(ArcadeFont.swiftUI(size: 8))
                        .foregroundStyle(Color(white: 0.55))

                    VStack(spacing: 0) {
                        header
                        if board.isEmpty {
                            Text("No high scores yet — play a round!")
                                .font(ArcadeFont.swiftUI(size: 8))
                                .foregroundStyle(Color(white: 0.65))
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(14)
                        } else {
                            ForEach(Array(board.enumerated()), id: \.offset) { index, entry in
                                row(rank: index + 1, entry: entry)
                            }
                        }
                    }
                    .background(Color(red: 0.02, green: 0.02, blue: 0.03))
                    .overlay(RoundedRectangle(cornerRadius: 4).stroke(Color(red: 0.13, green: 0.13, blue: 0.87), lineWidth: 2))

                    Button("PLAY") { dismiss() }
                        .buttonStyle(ArcadeButtonStyle())
                }
                .padding(20)
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                        .foregroundStyle(.yellow)
                }
            }
        }
    }

    private var header: some View {
        HStack {
            Text("#").frame(width: 28, alignment: .leading)
            Text("PLAYER").frame(maxWidth: .infinity, alignment: .leading)
            Text("LEVEL").frame(width: 52, alignment: .trailing)
            Text("SCORE").frame(width: 64, alignment: .trailing)
        }
        .font(ArcadeFont.swiftUI(size: 7))
        .foregroundStyle(.yellow)
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
    }

    private func row(rank: Int, entry: ScoreEntry) -> some View {
        HStack {
            Text("\(rank)").frame(width: 28, alignment: .leading)
            Text(entry.name).frame(maxWidth: .infinity, alignment: .leading)
            Text("L\(entry.level)").frame(width: 52, alignment: .trailing)
            Text(String(format: "%05d", entry.score)).frame(width: 64, alignment: .trailing)
        }
        .font(ArcadeFont.swiftUI(size: 9))
        .foregroundStyle(.white)
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
    }
}

struct ArcadeButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(ArcadeFont.swiftUI(size: 9))
            .foregroundStyle(configuration.isPressed ? .black : .yellow)
            .padding(.horizontal, 18)
            .padding(.vertical, 12)
            .background(configuration.isPressed ? Color.yellow : Color.yellow.opacity(0.08))
            .overlay(Rectangle().stroke(Color.yellow, lineWidth: 2))
    }
}
