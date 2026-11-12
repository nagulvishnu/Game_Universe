# COLOSSUS: AGE OF TITANS

A standalone browser-based 3D third-person mech-vs-kaiju action game.
Built with **Vite + React + TypeScript + Three.js + React Three Fiber + Drei + Zustand + Tailwind CSS + Framer Motion**.
All 3D models, textures, sound effects and music are **generated procedurally at runtime** — there are no external assets and no network access is needed.

## Setup

```bash
npm install
npm run dev      # development server
npm run build    # production build -> dist/index.html (single self-contained file)
```

`dist/index.html` is a single-file build and can be opened directly or served by any static host.

## Game modes
| Mode | Description |
|------|-------------|
| **Campaign** | 10 connected missions across 8 environments, wave fights and 6 boss battles. Unlocks mechs, skins and credits. |
| **Arena Mayhem** | Endless waves in any environment; a boss arrives every 5th wave. |
| **Boss Assault** | Pick any unlocked boss (3 difficulty levels). |
| **Survival** | Defend an energy beacon; choose 1 of 3 upgrades between waves. |
| **City Defense** | 8 waves while keeping city integrity above 35% (monsters wreck buildings). |

"Quick Deploy" on the main menu starts mission 1 immediately.

## Content
* **10 mechs** (Aegis Prime, Thunder Fang, Iron Titan, Phantom Zero, Bastion X, Inferno Core, Frost Guardian, Storm Breaker, Sky Reaper, Omega Colossus) – unique procedural models, stats, special ability, ultimate and transformation.
* **23 monsters + 6 bosses** (Abyssal Rex, Volcanus, Storm Hydra, Sky Devourer, The Hollow King, Omega Beast) in 16 body archetypes with 15 attack types, telegraphed attacks, weak points, stagger/poise, boss phases and unique death animations.
* **15 weapons** (7 melee, 8 ranged) – the loadout can be changed in the Hangar.
* **8 destructible environments** – buildings are instanced floor chunks that collapse; vehicles explode or can be thrown; roads crack; shockwaves, debris, smoke.
* Hangar: customization (paint, armor parts, skins, effect colours), loadout, 5 upgrade tracks, mech and pilot levels. Monster database, achievements, settings, remappable keys.
* Progress, settings and unlocks are saved in **LocalStorage**.

## Controls (remappable in Settings)
| Key | Action |
|-----|--------|
| WASD | Move |
| Mouse | Camera (click the game to capture the mouse) |
| LMB | Primary attack (hold to chain combos / auto-fire) |
| RMB | Hold: aim; tap: lock-on toggle |
| Space | Jump (hold in air: jump jets; hold in Flight Mode: ascend) |
| Shift | Dash (i-frames – dodge through attacks for a *Perfect Dodge*) |
| Q | Switch weapon |
| E | Guard (tap right before a hit for a *parry + counterattack*) |
| R | Coolant vent (restore energy) |
| F | Special ability |
| G | Ultimate (charges as you deal/take damage) |
| T | Transform / Overdrive |
| Tab | Cycle target lock |
| Esc | Pause |

**Mobile:** virtual joystick, drag-to-look, dedicated buttons. Button size, look sensitivity and button positions (drag mode) are adjustable in Settings.

## Tips
* Every kaiju has a glowing **weak point** (2× damage). Bosses expose their core after big attacks or when staggered — a marker appears.
* Red zones are attack telegraphs; jump over shockwave rings.
* Smash parked vehicles with melee to launch them at monsters.
* Settings → *Unlock Everything (Debug)* unlocks all content for exploration.

## Performance
Low / Medium / High / Ultra presets plus individual controls for resolution scale, shadow quality, particle limit, FOV and camera shake. Particles and debris use pooled instanced meshes; buildings, vehicles and decor are instanced; bloom is only used on High/Ultra; enemy count and building density scale with quality. All Three.js resources are disposed when leaving a mission.

## Architecture (`src/`)
* `game/data.ts` – mechs, weapons, monsters, bosses, missions, environments, achievements
* `game/store.ts` – Zustand stores (profile/save, settings, UI flow, HUD)
* `game/engine.ts` – player, combat, abilities, projectiles, camera, cinematics
* `game/enemies.ts` – kaiju AI, attack patterns, boss phases, deaths
* `game/modes.ts` – campaign/arena/survival/city/boss flow
* `game/world.ts` – destructible environment, sky, backdrops
* `game/models.ts` – procedural mech and monster models and animation
* `game/fx.ts` – pooled particles, debris, beams, rings, decals
* `game/audio.ts` – procedural Web Audio SFX, roars and generative music
* `game/input.ts` – keyboard / mouse / touch → actions
* `ui/*` – menus, hangar, database, HUD, pause, touch controls

## Notes
* Physics are custom lightweight kinematic simulation (ground, gravity, footprint collisions with buildings, ballistic debris/projectiles) rather than Rapier. This keeps it fast on a mid-range laptop and mobile.
