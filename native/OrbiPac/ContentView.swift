import SwiftUI

struct ContentView: View {
    var body: some View {
        GameWebView()
            .ignoresSafeArea()
            .background(Color.black)
        #if os(macOS)
            .frame(minWidth: 480, minHeight: 640)
        #endif
    }
}

#Preview {
    ContentView()
}
