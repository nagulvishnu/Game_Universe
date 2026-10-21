# SHADOWSTRIKE — Skills/Equipment/VFX/Loadout Overhaul — Audit Report

## Baseline
- Pre-existing test suite: 50 tests / 4 files — **all passing**.
- Production build: **succeeds** (`vite build`, 1,691 KB singlefile bundle).
- TypeScript strict (`tsc --noEmit`): pre-existing unused-variable/property notes only in `AdaptiveContrast.ts`, `Fighter.ts`, `CharacterRenderer.ts`, `WeaponRenderer.ts`, plus two pre-existing `Catalogues.tsx` notes (`WeaponStats` unused; `Panel.title` passed a JSX element). No new type errors introduced by this work.
- Not a git repository; no commits or pushes made. No destructive Git operations. All existing data files untouched (skills, weapons, equipment, fighters, arenas, achievements).

## Scope preserved (verified)
- Strictly 2D; React + TypeScript + Phaser + Zustand + existing architecture retained.
- All **124 skills** with exactly **5 upgrade levels** each (untouched `src/data/skills.ts`).
- All **29 weapons** and the detailed weapon renderer (`src/data/weapons.ts`, `src/game/rig/WeaponRenderer.ts`) untouched.
- All **44 equipment items** across 10 slots, rarities, unlock conditions, stats, and save-data format untouched (`src/data/equipment.ts`).
- Combat logic, AI, progression, achievements, currencies, save/load (version 3), migration, and all keyboard bindings unchanged.
- No combat rebalance: hitboxes, damage, cooldowns, timing, and the `SkillExecutor` execution pipeline are unchanged.
- No new dependencies; existing Phaser effects pipeline and schemas reused.

## Changes implemented

### New: `src/ui/SkillIcon.tsx`
Procedural skill icons drawn per `skill.kind` (projectile, homing, beam, aoe, zone, wave, rain, melee, dash, clone, summon, buff, counter, pull, trap) using the skill's real colour. Each icon has shape/silhouette, colour palette, and a category-appropriate form. Drawn once to an offscreen canvas and cached keyed by `(kind, colour)`, so the hot catalogue grid never re-renders per frame. Supports a `locked` grade overlay. Reuses the same Canvas2D adapter pattern as `FighterPreview`.

### New: `src/ui/ItemIcon.tsx`
Procedural equipment item icons per `(slot, style, colour, glow)` covering every equipment style (head/mask/outfit/armor/gloves/boots/back/aura/trail/emote) with recognisable silhouettes, material hints (metallic rim, cloth, leather, crystalline facets via colour), and rarity glow. Offscreen-cached like `SkillIcon`. Supports `locked`/`equipped` grades.

### Redesigned: `src/ui/Catalogues.tsx` — Skills screen
- Responsive catalogue grid (`grid-cols-1` → 2 → 3 columns) with real `SkillIcon` thumbnails.
- Card states: **locked** (grayscale + 🔒), **unlocked**, **equipped** (cyan border + slot), **selected** (violet border + glow shadow), **maxed** (amber ring). Equipped state is not colour-only (text label + slot letter).
- Filtering: category chips, All/Owned, search across name/description/kind/category. Sorting: Name / Rarity / Cooldown / Damage (real current-level values).
- Long names/descriptions wrap (`truncate`, `line-clamp`).
- Detail panel: large icon, name, rarity/category/kind, description, counterplay, stat grid (damage/cooldown/range/duration), full 5-level upgrade path with current/next/done highlighting and perks, **next upgrade's actual delta** (damage/cooldown change + new perks + description), unlock requirements (level + shards with affordability chips), and Unlock/Upgrade/Equip-to-slot controls.
- Upgrade UX: buttons disabled when unaffordable/underleveled/already maxed, with tooltips explaining why; store actions (`unlockSkill`/`upgradeSkill`/`equipSkill`) already prevent duplicate purchases and re-applying upgrades; toasts confirm success/failure. Loadout is never silently changed.

### Redesigned: `src/ui/Catalogues.tsx` — Equipment screen
- Slot groups (Head / Torso / Limbs / Back / Extras) showing the equipped item per slot; clicking a slot filters the catalogue.
- Item grid with real `ItemIcon` thumbnails, name, rarity, stat-mod tags, locked/equipped/selected states, search + sort (Name / Rarity / Cost).
- Detail panel: large item icon, name/rarity/slot, description, **actual statistics** (mods: HP / Speed / Guard / Cooldown), "Cosmetic only — no gameplay statistics" when no mods, requirements (level + shards affordability chips), comparison deltas against the currently equipped item (Δ HP / Speed / Guard / CD), and Unlock/Equip/Equipped controls. Gameplay-affecting bonuses clearly distinguished from cosmetic-only items.

### Redesigned: `src/ui/Catalogues.tsx` — Loadout screen
- Fighter preview retained; **equipment now shown by slot** with the equipped item icon/name/rarity and owned alternatives as quick-equip chips.
- Weapon panel and per-slot skill panels (E/R/V) retained; preset save/apply/delete retained; "Browse full skill catalogue" retained.

### Upgraded: `src/ui/Combat.tsx` — Skill HUD
- Cooldown replaced with a **conic-gradient cooldown ring** (masked to a ring) whose fill% reflects the **real** combat cooldown from the Phaser `HudSnapshot` (throttled to ~55 ms, not per-frame). No independent decorative clock that could disagree with gameplay.
- Ready state: subtle glow pulse (`boxShadow`) and ring opacity; key-binding label from the actual input system (`bindingsP1.skill1/2/3` → `E/R/V`); level badge; `role="button"`, `tabIndex={0}`, `aria-label` with name/level/cooldown for accessibility; global `focus-visible` outline from `index.css`.

### Equipment visual integration (already present, verified)
`src/game/rig/CharacterRenderer.ts` already renders supported slots on the skeleton so equipment **follows character animation**:
- head (hood/horns/crown/halo/topknot), mask (oni/visor/kitsune/wrap), outfit (colour override), armor (light/heavy/spirit/dragon plate), gloves (wraps/storm/talons), boots (tabi/jet/titan), back (cape/wings/scarf/sheath), aura (ember/frost/volt/void/celestial).
- `trail` drives the combat weapon-trail colour (`CombatScene.updateTrails`); `emote` is victory-pose only (not an idle-rig slot). These are documented as non-rig slots rather than fabricated.
All 12 head/mask/outfit/armor/gloves/boots/back/aura styles present in `equipment.ts` are handled by the renderer.

## Verification
- `npm test`: **63 tests / 5 files — all passing** (50 pre-existing + 13 new skill/equipment tests covering unlock, upgrade, affordability, level-5 cap, equip/swap, equipment equip, stats, persistence round-trip, and catalogue integrity).
- `npm run build`: **succeeds**.
- Verified real data values: fire_bolt unlock cost 0 (level 1); upgrade costs Lv2=180, Lv3=333, Lv4=616 (800 shards reaches Lv3, correctly refuses Lv4); gloves_wraps unlock cost 150/level 1; outfit_ninja moveSpeed +0.03; persistence round-trip keeps skill level 3 and equipped gloves.
- Persistence format (save version 3) unchanged; existing saves remain valid.

## Browser verification
No browser (Chrome/Edge/Firefox) is available in this environment, so rendered-UI inspection at desktop/mobile sizes could not be performed. Layout uses responsive Tailwind breakpoints (`sm:`/`lg:`) and the existing `ScreenShell` shell, consistent with the rest of the app.
