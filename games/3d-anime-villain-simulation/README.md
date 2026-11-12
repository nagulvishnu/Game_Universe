# STICKVERSE — Rise of the Dark Empire

A 3D open-world villain-simulation action game that runs entirely in the browser.
Start as nobody, steal, fight heroes, recruit an organization, and conquer nine territories to become the world's greatest villain.

Everything — geometry, textures, icons, and audio — is generated procedurally at runtime. There are no asset files; the game ships as a single HTML page.

## Tech stack

- **React 19** + **@react-three/fiber** (Three.js 0.187) for the 3D world and UI
- **zustand** for game state
- **Tailwind CSS 4** for UI styling
- **Vite 7** + `vite-plugin-singlefile` for builds
- **TypeScript** (strict) end to end

## Getting started

Requires Node.js 20+.

```bash
npm install
npm run dev        # start the dev server (http://localhost:5173)
npm run build      # typecheck + production build into dist/
npm run preview    # serve the production build
npm run typecheck  # tsc --noEmit only
npm test           # run unit tests (vitest)
```

## How to play

| Input | Action |
| --- | --- |
| WASD / Mouse | Move / look |
| SPACE | Jump — **double-tap to toggle flight** |
| SHIFT | Sprint / boost flight |
| Q | Dash |
| F / Left click | Attack (hold for light combo) |
| Right click | Heavy attack |
| E / R / V | Skills (Ultimate in V slot) |
| T | Transform |
| G | Interact / hold to steal, loot, rob |
| Z | Cycle weapons |
| C | Cycle camera (3rd person / far / first person) |
| B | Block |
| I / K / M / Tab / J / P | Inventory / Skills / Map / Organization / Missions / Character |
| Esc | Pause |

Steal vehicles (hold G), deliver them to the **Chop Shop** for cash, rob shops and houses, defeat hero response squads, raise your threat level, capture territories from their hero bosses, and grow your organization. Interact with the command tower in each region to launch an assault.

## Saves

Progress is stored in **IndexedDB** (slots 1–3 + autosave), with a `localStorage` fallback. Autosave runs every 2.5 minutes of game time; resting at your HQ also saves.

## Project structure

```
src/
  game/           # simulation: world, combat, actors, vehicles, save system, FX, audio
    data.ts       # static game data (items, skills, regions, missions, facilities)
    logic.ts      # pure, unit-tested game logic (derived stats, rank, missions, tick)
    store.ts      # zustand store (persistent state + UI state)
    runtime.ts    # per-frame simulation state (G) and input (K)
    Game.tsx      # r3f Canvas + frame pipeline
  ui/             # menu, HUD, overlay panels (inventory, org, missions, ...)
```

## Testing

Unit tests cover the pure game logic in `src/game/logic.ts` (stat derivation, organization rank, mission completion, economy tick). Run them with `npm test`.
