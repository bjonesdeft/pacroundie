import SwiftUI

struct ThumbstickView: View {
    let onChange: (_ dx: CGFloat, _ dy: CGFloat, _ maxTravel: CGFloat) -> Void
    let onEnd: () -> Void

    @State private var offset: CGSize = .zero
    @State private var active = false

    private let size: CGFloat = 168

    var body: some View {
        GeometryReader { geo in
            let side = min(geo.size.width, geo.size.height)
            let maxTravel = side * 0.32
            ZStack {
                Circle()
                    .fill(
                        RadialGradient(
                            colors: [Color(white: 0.18), Color(white: 0.05)],
                            center: UnitPoint(x: 0.4, y: 0.35),
                            startRadius: 2,
                            endRadius: side * 0.55
                        )
                    )
                    .overlay(Circle().stroke(Color(white: 0.2), lineWidth: 4))
                    .shadow(color: .black.opacity(0.55), radius: 10, y: 6)

                directionMarks(activeDirs(offset, maxTravel))

                Circle()
                    .fill(
                        LinearGradient(
                            colors: [Color(red: 0.23, green: 0.23, blue: 0.4), Color(red: 0.05, green: 0.05, blue: 0.09)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .overlay(Circle().stroke(active ? Color.yellow.opacity(0.95) : Color.yellow, lineWidth: 2))
                    .shadow(color: active ? .yellow.opacity(0.35) : .black.opacity(0.5), radius: active ? 8 : 4, y: 3)
                    .frame(width: side * 0.42, height: side * 0.42)
                    .offset(offset)
            }
            .frame(width: side, height: side)
            .contentShape(Circle())
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { value in
                        active = true
                        let dx = value.translation.width
                        let dy = value.translation.height
                        let dist = hypot(dx, dy)
                        if dist > maxTravel, dist > 0 {
                            let s = maxTravel / dist
                            offset = CGSize(width: dx * s, height: dy * s)
                        } else {
                            offset = CGSize(width: dx, height: dy)
                        }
                        onChange(offset.width, offset.height, maxTravel)
                    }
                    .onEnded { _ in
                        active = false
                        offset = .zero
                        onEnd()
                    }
            )
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .frame(width: size, height: size)
        .accessibilityLabel("Thumbstick")
    }

    private func activeDirs(_ offset: CGSize, _ maxTravel: CGFloat) -> Set<Dir> {
        InputState.directions(dx: offset.width, dy: offset.height, maxTravel: maxTravel)
    }

    @ViewBuilder
    private func directionMarks(_ dirs: Set<Dir>) -> some View {
        let dim = Color.yellow.opacity(0.35)
        let lit = Color.yellow
        VStack {
            Text("▲").foregroundStyle(dirs.contains(.up) ? lit : dim)
            Spacer()
            Text("▼").foregroundStyle(dirs.contains(.down) ? lit : dim)
        }
        .font(.system(size: 14, weight: .bold))
        .padding(.vertical, 10)

        HStack {
            Text("◀").foregroundStyle(dirs.contains(.left) ? lit : dim)
            Spacer()
            Text("▶").foregroundStyle(dirs.contains(.right) ? lit : dim)
        }
        .font(.system(size: 14, weight: .bold))
        .padding(.horizontal, 12)
    }
}
