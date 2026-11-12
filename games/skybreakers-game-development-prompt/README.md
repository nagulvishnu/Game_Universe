# SKYBREAKERS — LOST KINGDOMS

A complete, playable 3D open-world fantasy adventure that runs entirely in the browser.
Built with **Vite + React + TypeScript + Three.js (@react-three/fiber) + Zustand + Tailwind + Framer Motion**.
All models, effects and audio are **procedural** (no external assets) and progress is saved to `localStorage`.

## Run
```bash
npm install
npm run dev      # development
npm run build    # production build -> dist/index.html (single file)
```

## Controls
| Action | Keys |
|---|---|
| Move / Sprint / Jump / Dodge | WASD · Shift · Space · V |
| Attack / Heavy (hold) / Block | LMB or F · hold · RMB or R |
| Weapons / Spells / Lock-on | Q · 1–6 · Tab |
| Interact · Potions | E · H (health) B (mana) G (food) |
| Menus | I Inventory · U Craft · J Journal · P Skills · K Kingdom · Esc Pause |
| Airship | W/S thrust · A/D turn · Space up · C/Ctrl down · Shift boost · 1–5 weapons · LMB/F fire · R refuel · H repair · E exit |
| Mobile | Virtual joystick, attack/jump/dodge/interact/block buttons, spell row, airship pad, drag right side to look |

## Source layout (`src/game`)
- `data.ts` items, weapons, spells, enemies, bosses, airships, buildings, recipes, quests, NPCs
- `store.ts` Zustand store: inventory, quests, progression, kingdom, airships, settings, save/load
- `world.ts` island layout, terrain height, bridges, colliders, decor/structure/node/spawn generation
- `terrain.ts` / `atmosphere.ts` island meshes, water, waterfalls, clouds, sky, weather, lighting
- `models.ts` / `models2.ts` / `gfx.ts` procedural characters, enemies, bosses, airships, structures
- `player.ts` `combat.ts` `enemies.ts` `boss.ts` `airship.ts` `kingdom.ts` `entities.ts` `events.ts` gameplay systems
- `fx.ts` GPU particles, telegraphs, lightning; `audio.ts` procedural Web Audio; `control.ts` main loop & camera
- `src/ui` HUD, panels, workshop (3D ship preview), dialogue, menus, mobile controls

## Progression path
Talk to Elder Maren → repair the Sky Scout at the Old Dock → fly to Haven Isle and found your kingdom →
awaken the Temple on Whisper Isle → level up to break storm barriers → defeat the Titan Golem, Inferno King,
Void Colossus and finally the Storm Wyrm on the Celestial Kingdom.
