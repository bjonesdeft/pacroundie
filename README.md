# Orbi-Pac

Circular Pac-Man. Pac stays fixed at the bottom; you rotate the maze and move through the rings.

**Play:** https://bjonesdeft.github.io/pacroundie/  
**High scores:** https://bjonesdeft.github.io/pacroundie/scores.html

## Controls

| Input | Action |
| --- | --- |
| ← → / thumbstick left-right | Rotate maze (hold) |
| ↑ ↓ / thumbstick up-down | Change rings (hold) |
| Space / Enter / START / tap dial | Start |
| M | Toggle maximized game / full chrome |

## Run locally

```bash
npm install
npm run dev
```

## Native iOS / macOS

Fully native Swift port (Core Graphics + SwiftUI) lives in [`native/`](native/README.md):

```bash
open native/OrbiPac.xcodeproj
```
