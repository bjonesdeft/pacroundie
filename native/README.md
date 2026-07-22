# Orbi-Pac native (iOS + macOS)

SwiftUI shell that embeds the existing Vite/Canvas game in a `WKWebView`. One web codebase, native app targets for iPhone, iPad, and Mac.

## Open & run

1. From the repo root (or let Xcode’s **Sync Web Build** phase do it):

   ```bash
   npm install
   npm run build:native
   ```

2. Open `native/OrbiPac.xcodeproj` in Xcode.

3. Pick a destination:
   - **My Mac** — macOS app
   - **iPhone simulator / device** — iOS app

4. Set your **Team** under Signing & Capabilities if needed, then Run (⌘R).

If `xcodebuild` fails from the terminal with a Simulator plugin error, open the project in the Xcode app instead (or run `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer` and `xcodebuild -runFirstLaunch`).

## How it works

| Piece | Role |
| --- | --- |
| `npm run build:native` | Builds the game with relative asset paths into `OrbiPac/Web` |
| Xcode **Sync Web Build** phase | Re-runs that build before each app compile (when `npm` is available) |
| `GameWebView.swift` | Loads `Web/index.html` from the app bundle |

High scores use the same `localStorage` keys as the browser build (per platform WebKit store).

## Notes

- Google Fonts still load over the network (sandbox network client is enabled on Mac). Bundle the font later for a fully offline build.
- App icons are placeholders — drop a 1024×1024 image into `Assets.xcassets/AppIcon`.
- This is a hybrid shell, not a SpriteKit rewrite. Good for a side project and TestFlight; a full native port can come later if you want.
