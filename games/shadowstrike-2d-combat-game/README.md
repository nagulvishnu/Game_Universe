# SHADOWSTRIKE — 2D Shadow Combat

A browser-based **2D stickman fighting game**: shadow-anime silhouettes, weapon combat,
supernatural skills, combos, charged attacks, AI opponents, local versus and a training lab.

Strictly 2D: Phaser 3 canvas/WebGL **2D** rendering, a procedural 2D stickman rig, 2D parallax
arenas and 2D particle VFX. No 3D engine, no 3D camera, no ragdoll physics — the character
controller is fully deterministic and animation never overrides player input.

## Stack

| Layer | Tech |
|---|---|
| Gameplay loop & rendering | Phaser 3 (2D) |
| UI / menus | React 19 + Tailwind CSS 4 |
| State | Zustand |
| Language / build | TypeScript (strict) + Vite |
| Audio | Web Audio API (fully procedural — no external audio files) |
| Persistence | Versioned `localStorage` save with validation + migrations |
| Tests | Vitest (`npm test`) |

## Controls

| Action | Player 1 | Player 2 |
|---|---|---|
| Move | `A` / `D` | `←` / `→` |
| Jump | `W` | `↑` |
| Crouch / fast-fall | `S` | `↓` |
| Attack (tap) / charge (hold) | `F` | `J` |
| Skills 1/2/3 | `E` `R` `V` | `U` `I` `O` |
| Dodge / dash | `Space` | `R-Ctrl` |
| Guard | `L-Shift` | `R-Shift` |
| Pause | `Esc` | — |

All bindings are remappable in **Settings**.

## Content

* **124 skills**, each with **5 functional upgrade levels** (620 level configurations) across
  fire, lightning, ice, shadow, energy, gravity, wind, earth, defense, mobility, summons and ultimates.
  Levels 3/4/5 grant perks (`pierce`, `multishot`, `burn`, `freeze`, `vortex`, `lifesteal`, `guardbreak`, …)
  that the skill executor actually reads at runtime.
* **29 weapons** in 10 categories. Each defines its own 3-hit combo, charged attack, frame data
  (startup / active / recovery in ms), reach, hitbox shape, knockback, guard pressure and move-speed modifier.
* **45 equipment & cosmetic items** across 10 slots, all drawn onto the live fighter rig.
* **9 opponents** with distinct AI profiles (aggressive, defensive, balanced, ranged, specialists, boss)
  and **3 difficulties** that change reaction windows, decision intervals, defensive logic and openings.
* **4 arenas** with layered parallax backgrounds and consistent 2D collision bounds.

## Game modes

* **Fight** — pick opponent, difficulty, arena, weapon and three skills. Rounds, timer, results, rewards, rematch.
* **Local PvP** — two independent fighters on one keyboard with separate loadouts, cooldowns, combos and
  health. Friendly matches grant **no** competitive rewards (prevents progression farming).
* **Training** — dummy behaviours, hitbox/hurtbox overlay, frame-data readout, weapon range preview,
  unlimited cooldowns, slow motion, immortal dummy, position reset. Grants no XP, shards or achievements.

## Architecture

```
src/
  data/        weapons, skills, equipment, arenas, fighters (AI profiles), achievements
  game/
    rig/       procedural 2D stickman skeleton, poses, weapon & equipment drawing
    entities/  Fighter (deterministic controller + combat state machine)
    combat/    (damage resolution lives in CombatScene.dealDamage — single central path)
    skills/    SkillExecutor: projectiles, beams, zones, clones, summons, buffs, counters…
    ai/        AIController (behaviour state machine with difficulty-scaled perception)
    input/     InputManager (held state + edge events, blur-safe)
    effects/   pooled particles, trails, rings, damage numbers, shake
    arena/     2D parallax arena renderer
    audio/     procedural Web Audio SFX + music
    scenes/    CombatScene (owns the gameplay loop)
  ui/          React menus, HUD, catalogues, profile, settings
  save/        schema, sanitisation, migrations, IO
  stores/      zustand game store
  test/        Vitest suites
```

React never runs a second game loop: Phaser owns `update()`, and the HUD receives throttled
(~18 Hz) snapshots through a small typed event bus.

## Tests

```bash
npm test
```

50 tests covering:

* movement, jumping, crouching, boundaries, dodge i-frames, no-drift on key release;
* the 3-hit combo order and expiry, charge threshold / full charge, hitbox activity windows,
  guard chip + guard break, back-attacks ignoring guard, no damage after defeat, round resets;
* weapon differentiation (frame data, reach, hitbox size) and a full attack cycle per weapon;
* skill casting, cooldown enforcement and expiry, shields/status application;
* the skill executor: projectile hit/miss/cleanup, beam damage ticks confined to its active window,
  clone spawn/expiry with no recursive summoning, perk-driven behaviour changes, and
  **every one of the 124 catalogue skills executing at level 1 and level 5 with full cleanup**;
* catalogue integrity (unique IDs, 5 levels each, ≥600 level configs, category distribution,
  valid execution kinds, bounded equipment modifiers);
* save defaults, malformed-save recovery, unknown-ID rejection, v1→v3 migration, persistence round-trip,
  explicit profile reset, XP curve and achievement predicates.

## Known limitations (honest status)

* **No automated browser (Playwright) run was performed** — Playwright is not available in the build
  environment, and booting a full `Phaser.Game` inside jsdom fails at Phaser's device-probe stage.
  Gameplay systems are therefore verified through the headless unit/integration suites above and the
  production build; the end-to-end click-through journey has not been machine-verified.
* FPS/performance numbers have not been benchmarked on real hardware; the loop is delta-capped,
  pools particles/effects and throttles HUD updates, but no measured profile is claimed.
* Audio is synthesised rather than authored; there is no licensed music/SFX pack.
* Saves live in `localStorage`: offline friendly, **not** tamper-proof or secure.
