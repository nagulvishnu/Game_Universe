# NARUTO: Shinobi Legacy — Expanded Edition

An unofficial, non-commercial **fan-made 3D anime action RPG** that runs entirely in the browser
(React + TypeScript + Vite + Three.js / React Three Fiber + Zustand + IndexedDB).
No external assets are used: all models are generated procedurally from primitives (toon-shaded with outlines),
and all music, ambience and SFX are synthesized live with the Web Audio API.

> Naruto and all related characters © Masashi Kishimoto / Shueisha / TV Tokyo / Pierrot. This is a fan project.

## Quick start
```bash
npm install
npm run dev        # development server
npm run build      # production build -> dist/index.html (single self-contained file)
npm run preview    # serve the production build
npm test           # unit tests (vitest, 30 tests of game logic + data integrity)
npm run typecheck  # tsc --noEmit
# optional browser smoke test (needs `npx playwright install chromium`): npm run build && node scripts/smoke.mjs
```
Click the game to capture the mouse (Esc releases it and opens the pause menu). If pointer-lock is unavailable the camera follows mouse movement / arrow keys.

## Controls (all rebindable in Settings → Controls)
| Input | Action | Input | Action |
|---|---|---|---|
| W A S D | Move | Q (hold) | Charge chakra |
| Mouse | Camera | E | Special jutsu (Naruto: Summoning) |
| LMB | Combo (in air: dive slam) | R | Ultimate (needs full gauge; depends on form) |
| RMB | Heavy attack | F | Lock-on / cycle targets / release |
| Space | Dodge in combat, jump otherwise (air: double jump) | 1–4 | Equipped jutsu |
| Shift | Sprint (Shift+Space always jumps) | C (hold) | Guard (parry in first ~0.2 s) |
| X | Substitution Jutsu | Z | Throw kunai |
| G | Cycle form: Base → Sage → Kurama | T | Talk / read mission board |
| H / N | Quick-use ramen / chakra pill | Tab · I · K · J · M | Status · Items · Skills · Missions · Map |
| Esc | Pause | ← → | Camera (fallback) |

## What you can do
* **Hidden Leaf Village hub** (houses with walkable rooftops, Hokage tower & monument, Academy, Ichiraku, tool shop, training grounds, mission board, NPCs, day/night cycle, lanterns, petals) plus **Forest of Death**, **Land of Waves** (water you can walk on, the Great Bridge), **Hidden Sand**, **Mount Myoboku** and **Valley of the End**; zones stream in/out by distance and fast travel is on the world map.
* **Story (playable):** Ch.1 *Academy Days* (tutorial exam), Ch.2 *Team 7 Formation* (companions Sasuke & Sakura), Ch.3 *Land of Waves* (escort Tazuna with companions, Demon Brothers ambush, **Zabuza boss fight** on the bridge with intro cinematic, 3 phases, water clones, mist ambush, water dragon). Chapters 4–13 are listed on the board and **clearly marked "planned – not yet playable"**.
* **Side missions (12):** rogue elimination, lost scrolls, missing cat, timed rooftop run, chakra control, gate defense waves, elite hunt, survival, secret technique (unlocks Rasenshuriken), Natural Energy training (unlocks Sage Mode + Jiraiya), Lee's trial (unlocks Lee) and an optional **Gaara boss** (unlocks Gaara).
* **Combat:** light combos (character-specific length/style), heavy, aerial dive, dodge with perfect-dodge slow-mo, guard & parry, Substitution, lock-on, hit-stop, stagger/poise, elements (Fire>Wind>Lightning>Earth>Water>Fire), status effects (stun, burn, slow, genjutsu-confuse), ultimate gauge with cinematic camera.
* **Naruto kit:** Shadow Clone, Rasengan, Giant Rasengan, Rasenshuriken, Wind Scythe, Sexy Jutsu (genjutsu distraction), Summoning (giant toad), Uzumaki Barrage; **Sage Mode** and **Kurama Chakra Mode** change stats, range, cost, visuals (cloak, eye pigment, golden tails/aura) and unlock different ultimates (Super Rasenshuriken, Tailed Beast Bomb).
* **Other playable characters** (Sasuke, Sakura, Kakashi, Jiraiya, Lee, Gaara) each have their own stats, combo style, 4 jutsu, special and ultimate.
* **RPG systems:** XP/levels (cap 30), ranks (Academy → Genin → Chunin → Jonin → Elite Jonin), 6-category skill tree (20 nodes), ability loadout, inventory, consumables, equipment slots, equipment upgrades (materials + ryo), shops, loot drops, hidden collectibles/chests.
* **Persistence:** 3 manual slots + autosave in IndexedDB (localStorage fallback), full validation/sanitising of loaded data, corrupted slots are reported and ignored, autosave at zone changes, level-ups, mission completion, healer NPC and every 90 s out of combat. Settings are stored separately.

## Architecture
```
src/
  App.tsx                    app shell (menu / game / overlays), audio+input bootstrap, autosave timers
  game/
    types.ts config.ts       shared types; zones, graphics presets, key bindings
    data/                    DATA-DRIVEN content: characters, abilities+skill tree, enemies+bosses, items, missions, world (NPCs, camps, props)
    logic/                   PURE, tested logic: stats/damage/xp, mission rules, collision, profile+save validation
    runtime.ts               mutable real-time simulation state (kept outside React for speed)
    systems/                 simulation: player controller, abilities, combat, enemy AI + bosses, allies/companions,
                             missions/story/NPC interaction/camps, particles (fx), HUD sync, main loop
    store.ts hudStore.ts     Zustand: persistent profile + settings + UI overlays; high-rate HUD snapshot
    session.ts persistence.ts  new/continue/load/save/respawn; IndexedDB layer
    audio.ts input.ts bus.ts   procedural Web Audio engine; keyboard/mouse/pointer-lock; tiny event bus
    render/                  React Three Fiber: NinjaRig (procedural animated anime character), World (instanced zones),
                             Entities, Effects (instanced particles, rings, projectiles, telegraphs), Scene (sky/day-night, camera, canvas)
    ui/                      main menu, HUD (+ world-space labels, minimap), panels (inventory, skills, status, characters, shop,
                             missions, map, pause, save/load, dialogue, game-over), settings
    __tests__/               vitest unit tests
```
Extending: add an enemy/boss in `data/enemies.ts` (attack patterns are data: melee, spin, dash, slam, fan, summon, mist strike, shield…), an ability in `data/abilities.ts` (reuse an existing `kind`), a mission in `data/missions.ts` (stages of talk/kill/reach/checkpoints/collect/ability/boss/survive/charge objectives with spawns, waves, companions, boss), NPCs/collectibles/camps in `data/world.ts`.

## Performance notes
Instanced meshes for houses, trees, rocks and particles; one shadow-casting directional light that follows the player; low/medium/high presets (shadow resolution, DPR, foliage density, particle cap); zone streaming; enemy cap and attack-token system; allocation-free particle buffers; shared geometries and per-rig material disposal.

## Known limitations / honest status
See `IMPLEMENTATION_REPORT.md` for the full feature matrix.
