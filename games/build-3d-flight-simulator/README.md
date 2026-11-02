# SKYBOUND: Flight Simulator

Standalone React + TypeScript + Three.js game. Builds to a single self-contained `dist/index.html`
(via `vite-plugin-singlefile`) that can be dropped into the Game Universe site, or embedded in an iframe.

```bash
npm install
npm run dev      # development
npm run build    # production build -> dist/index.html (+ dist/game.json)
```

## Game entry metadata
* `public/game.json` – manifest (id, version, inputs, modes, embedding contract), copied to `dist/`.
* `src/game/meta.ts` – the same metadata for code.
* `<meta name="game:*">` tags in `index.html`.

## Embedding
```html
<iframe src="/games/skybound/index.html" allow="fullscreen; gamepad; autoplay" style="border:0;width:100%;height:100%"></iframe>
```
Messages posted *to the host*: `{ source: 'skybound', type: 'ready' | 'start' | 'end', ... }` (`end` includes `success`, `score`, `stars`).
Messages accepted *from the host*: `{ target: 'skybound', type: 'pause' | 'resume' | 'mute' | 'unmute' }`.
Save data lives under the isolated `localStorage` key `skybound.flightsim.save.v1`.

## Source layout
| Path | Purpose |
|---|---|
| `src/game/worldData.ts` | Terrain function, airports, cities, obstacles (pure, no three.js) |
| `src/game/physics.ts` | Flight model: aerodynamics, stalls, gear springs, helicopter model, damage |
| `src/game/aircraft*.ts` | Aircraft specs + procedural 3D models with animated control surfaces |
| `src/game/terrain.ts`, `environment.ts`, `airport.ts` | Streaming terrain, trees, cities, sky, ocean, clouds, rain, particles, airports |
| `src/game/missions.ts` | All mission definitions and the mission runtime |
| `src/game/engine.ts` | Renderer, input, cameras, weather, weapons, HUD snapshot |
| `src/game/audio.ts` | Procedural WebAudio sound |
| `src/ui/*` | HUD, menus, hangar, results |

## Controls
W/S pitch · A/D bank · Q/E yaw · Shift/Ctrl throttle · G gear · F/V flaps · B brake · Space cannon · Enter missile ·
C camera · L lights · H assist · M map · P/Esc pause. Gamepad supported.
