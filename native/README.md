# Orbi-Pac native (iOS + macOS)

Fully native Swift port of the circular Pac-Man game — Core Graphics rendering, SwiftUI chrome, AVFoundation audio. Same rules and feel as the web build.

## Open & run

1. Open `native/OrbiPac.xcodeproj` in Xcode.
2. Pick **iPhone simulator** or **My Mac**.
3. Set your signing **Team** if needed, then Run (⌘R).

## Layout

| Path | Role |
| --- | --- |
| `OrbiPac/Game/` | Ported engine (maze, Pac, ghosts, renderer, audio, leaderboard) |
| `OrbiPac/Sounds/` | Arcade wav/mp3 cues from `src/sounds` |
| `OrbiPac/*View.swift` | SwiftUI shell, thumbstick, scores, name entry |

The web Vite app in the repo root remains the GitHub Pages build. This Xcode target no longer embeds WKWebView.

## Notes

- Drop a 1024×1024 image into `Assets.xcassets/AppIcon` before shipping.
- Press Start 2P is used if installed on the system; otherwise Core Text falls back to the default CT font metrics.
