import SwiftUI

@main
struct OrbiPacApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        #if os(macOS)
        .defaultSize(width: 820, height: 960)
        .commands {
            CommandGroup(replacing: .newItem) {}
        }
        #endif
    }
}
