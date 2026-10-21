# SHADOWSTRIKE — Giant Boss Battles & Clone Skill Rebalance — Audit Report

## Baseline
- Pre-existing test suite: 50 tests / 4 files — all passing.
- Production build: succeeds (`vite build`, ~1.69 MB singlefile bundle).
- TypeScript strict: only pre-existing unused-variable notes (AdaptiveContrast, Fighter, CharacterRenderer, WeaponRenderer, Catalogues); none introduced by this work.
- Not a git repository; no commits/pushes made. No destructive Git operations.

## Summary of Implementation

### New Files
1. `src/data/bosses.ts` — Boss encounter data definitions (3 original bosses, `BossDef`, `BossPhaseDef`, `BossAttackDef`, `BOSS_BY_ID`, `getBoss`, `isBoss`).
2. `src/game/ai/BossAIController.ts` — Boss state-machine AI (idle → approach → telegraph → execute → recover, plus stagger and phase transitions).
3. `src/test/boss-clone.test.ts` — 15 regression tests for clone cap/damage and boss AI/phases.

### Modified Files
4. `src/game/skills/SkillExecutor.ts` — Clone skill rebalance: hard cap `MAX_ACTIVE_CLONES = 2`, per-level clone damage multiplier (`CLONE_LEVEL_DAMAGE_MUL`), active-clone counter, bounds clamping for clones.
5. `src/game/scenes/CombatScene.ts` — Boss mode: boss Fighter creation, `BossAIController` wiring, boss intro (extended), camera zoom-out for large bosses, single-round boss match ending, boss stagger-on-hit, boss fields in `HudSnapshot`, `bossId` in `MatchOverPayload`.
6. `src/game/events.ts` — Added optional `boss` field to `HudSnapshot` and `bossId` to `MatchOverPayload`.
7. `src/game/entities/Fighter.ts` — Added `attackPowerMul` field (default 1), reset on attack completion.
8. `src/ui/Combat.tsx` — Added `BossHealthBar` component (boss name, phase, health bar) rendered when `hud.boss` is present.
9. `src/ui/Selection.tsx` — Added "Standard Fights / Boss Battles" view toggle in FightSelection; boss cards with HP, unlock level, defeated badge; boss selection passes `bossId` to `startMatch`.
10. `src/stores/gameStore.ts` — Boss rewards (XP/shards) granted on genuine player victory; `defeatedBosses` tracking; `bossId` added to `MatchResult`.
11. `src/save/save.ts` — Added `defeatedBosses: string[]` to `Profile`, `defaultProfile`, and `sanitize` (validated against `BOSS_BY_ID`).

## Boss Designs & Mechanics

All bosses are original (not copies of copyrighted designs), rendered via the existing `CharacterRenderer`/`WeaponRenderer`, scaled 2.0–2.2× normal fighters, true 2D side-view.

**Boss 1 — THE IRON TYRANT** (scale 2.2, HP 320, greatsword)
- Phases: Iron Guard (100–50%) → Enraged (below 50%, faster attacks).
- Attacks: Overhead Slam (telegraphed ground marker), Ground Shockwave (earth_slam skill), Sweeping Cleave.
- Slow, devastating melee with clear wind-ups.

**Boss 2 — THE VOID REAPER** (scale 2.0, HP 280, scythe)
- Phases: Reaper Stance → Void Shift (below 45%, faster + more mobile).
- Attacks: Scythe Sweep, Shadow Bolt Barrage (projectile), Teleport Strike (shadow_step).
- Purple-black energy, teleport movement, telegraphed sweeps.

**Boss 3 — TEMPEST OVERLORD** (scale 2.1, HP 300, polearm)
- Phases: Storm Front → Tempest Unleashed (below 50%).
- Attacks: Charged Thrust, Lightning Strike (thunder_strike), Storm Wave (wind_wave).
- Cyan/electric-yellow effects, movement-rewarding patterns.

Boss AI guarantees recovery between attacks (no continuous attacking), telegraphs dangerous attacks with ground markers, stagger-on-heavy-hit, and phase transitions with brief unattackable windows.

## Clone Skill Rebalance

- **Hard cap: MAX_ACTIVE_CLONES = 2**, enforced in the SkillExecutor execution path (`case 'clone':`), regardless of level, multishot perk, repeated input, or cooldown timing.
- `shadow_clone` Lv5 (multishot, baseCount 5) → capped at 2. `ult_clone_army` (baseCount 5) → capped at 2. All lower levels ≤ 2.
- Clone damage multiplier per level `[1.0, 1.10, 1.20, 1.35, 1.60]` — Level 5 clones deal more damage than lower levels, controlled by balance config (not scattered hardcoded multipliers).
- Each clone attack applies damage exactly once (existing `hitDone` guard preserved); clones clamped to arena bounds; expired clones cleaned up by the executor; invulnerability/damage validation still applies to clone damage.

## Verification

- `npm test`: **78 tests / 6 files — all passing** (50 pre-existing + 13 skill/equipment + 15 boss/clone).
- `npm run build`: **succeeds**.
- `npx tsc --noEmit`: only pre-existing errors remain; no new type errors introduced.
- Persistence format (save version 3) unchanged; `defeatedBosses` added with sanitization so old saves remain valid.

## Browser Verification

No browser (Chrome/Edge/Firefox) is available in this environment, so rendered-UI inspection at desktop/mobile sizes was **not** performed. Layout uses responsive Tailwind breakpoints and the existing `ScreenShell` grid. All logic is covered by automated tests.

## Files Changed
`src/data/bosses.ts` (new), `src/game/ai/BossAIController.ts` (new), `src/test/boss-clone.test.ts` (new), `src/game/skills/SkillExecutor.ts`, `src/game/scenes/CombatScene.ts`, `src/game/events.ts`, `src/game/entities/Fighter.ts`, `src/ui/Combat.tsx`, `src/ui/Selection.tsx`, `src/stores/gameStore.ts`, `src/save/save.ts`.



