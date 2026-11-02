# MECHANIMOS Development Roadmap

## Overall Goal

Build MECHANIMOS into a polished, fully explorable 3D browser game with mechanical
vehicle-to-robot transformation, exploration, collection, battles, and story
progression.

## Acceptance Principle

The existing 2D game remains the default entry route until the 3D replacement
satisfies its acceptance criteria. The 3D build is an additive exploration
foundation accessed via `?game3d`; `?proto3d` remains available as the initial
3D gameplay slice.

## Established Phases

### Phase 1–7 (COMPLETED — existing commits)

- 2D game foundation, canonical roster (30 Mechanimos identities), 3D rig work,
  transformation prototype, benchmark harness, and initial 3D gameplay slice.
- Preserved at commit `56e1110` (Phase 6D and 7) and earlier. Not modified in Phase 9.

### Phase 8 (COMPLETED)

- 3D migration architecture audit and plan.

### Phase 9 — Main 3D exploration foundation

| Phase | Milestone | Status | Evidence |
|-------|-----------|--------|----------|
| 9.1 | Reusable 3D application shell | COMPLETED | Commit `4e52f48` (Phase 9.1 3D application shell) |
| 9.2 | Third-person camera and vehicle movement | COMPLETED | Commit `8f2f9a8` (Phase 9.2 third-person movement) |
| 9.3 | Collision and movement-world integration | COMPLETED | Commit `dd2175f` (Phase 9.3 collision foundations) |
| 9.4 | Deterministic terrain and world foundations | COMPLETED | Commit `9ab726b` (Phase 9.4 checkpoint) |
| 9.5 | Player-form integration and mechanical transformation foundation | COMPLETED | `src/three3d/core/transform.ts` (`TransformStateMachine`), `tests/transform.test.ts` (24 groups, PASS) |
| 9.6 | Transformation effects, procedural audio, and browser E2E verification | COMPLETED | `src/three3d/core/effects.ts` + `particles.ts` + `audio.ts`; `tests/effects.test.ts` (11), `tests/audio.test.ts` (8); `scripts/e2e-game3d.mjs` (28/28 in headless Chrome) |
| 9.x (remaining) | Environment polish, settings UI, quality validation, end-to-end testing | PLANNED | Sequenced per dependencies and existing code |

Status key: COMPLETED = supported by existing commits and validation; IN PROGRESS = current work; PLANNED = not yet started.

### Phase 10 (PLANNED)

- Transformation and combat integration.

### Phase 11 (PLANNED)

- World expansion and collection.

### Phase 12 (PLANNED)

- Story, polish, optimization, and final validation.

## Phase Boundaries

Each phase checkpoint is a separate commit named `checkpoint: preserve Phase X.Y ...`. No phase is amended, tagged, or pushed without explicit approval.

## Assets

`AURORA-01` (the `?game3d` rig) is a procedural placeholder, NOT a canonical Mechanimo identity. No invented canonical identities or lore are introduced.
