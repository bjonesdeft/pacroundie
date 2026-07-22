import SwiftUI
import WebKit

#if os(iOS)
import UIKit
private typealias PlatformViewRepresentable = UIViewRepresentable
#else
import AppKit
private typealias PlatformViewRepresentable = NSViewRepresentable
#endif

struct GameWebView: PlatformViewRepresentable {
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    #if os(iOS)
    func makeUIView(context: Context) -> WKWebView {
        makeWebView(context: context)
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}
    #else
    func makeNSView(context: Context) -> WKWebView {
        makeWebView(context: context)
    }

    func updateNSView(_ nsView: WKWebView, context: Context) {}
    #endif

    private func makeWebView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.defaultWebpagePreferences.allowsContentJavaScript = true
        #if os(iOS)
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        #endif

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = false
        #if os(iOS)
        webView.isOpaque = true
        webView.backgroundColor = .black
        webView.scrollView.backgroundColor = .black
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.pinchGestureRecognizer?.isEnabled = false
        #else
        webView.setValue(false, forKey: "drawsBackground")
        webView.allowsMagnification = false
        #endif

        loadBundledGame(into: webView)
        return webView
    }

    private func loadBundledGame(into webView: WKWebView) {
        guard let indexURL = Bundle.main.url(
            forResource: "index",
            withExtension: "html",
            subdirectory: "Web"
        ) else {
            webView.loadHTMLString(
                """
                <html><body style="background:#000;color:#ff0;font-family:monospace;padding:2rem">
                <h1>Orbi-Pac</h1>
                <p>Web build missing. From the repo root run:</p>
                <pre>npm run build:native</pre>
                <p>Then build this app again in Xcode.</p>
                </body></html>
                """,
                baseURL: nil
            )
            return
        }

        let readAccess = indexURL.deletingLastPathComponent()
        webView.loadFileURL(indexURL, allowingReadAccessTo: readAccess)
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.allow)
                return
            }

            // Keep gameplay + scores inside the app; open anything else externally.
            if url.isFileURL || url.scheme == "about" {
                decisionHandler(.allow)
                return
            }

            #if os(iOS)
            UIApplication.shared.open(url)
            #else
            NSWorkspace.shared.open(url)
            #endif
            decisionHandler(.cancel)
        }
    }
}
