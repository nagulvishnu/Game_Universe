/**
 * Phase 7 — authoritative gameplay state machine for the 3D vertical slice.
 *
 * One source of truth; no contradictory booleans.
 *
 * States:
 *   explore        — driving around, opponent visible
 *   encounterIntro — player entered trigger range; intro panel shown, driving stopped
 *   toRobot        — transformation animation playing (car → robot)
 *   battle         — card-based battle active
 *   battleResult   — victory/defeat panel shown
 *   toCar          — reverse transformation animation playing (robot → car)
 *
 * Transitions (all guarded — no duplicate triggers):
 *   explore        → encounterIntro  (proximity trigger, once per approach)
 *   encounterIntro → explore         (cancel / press Escape)
 *   encounterIntro → toRobot         (press E to confirm)
 *   toRobot        → battle          (animation complete)
 *   battle         → battleResult    (hp reaches 0)
 *   battleResult   → toCar           (press E / Continue)
 *   toCar          → explore         (animation complete)
 */

export type SlicePhase =
  | 'explore'
  | 'encounterIntro'
  | 'toRobot'
  | 'battle'
  | 'battleResult'
  | 'toCar';

export type BattleOutcome = 'victory' | 'defeat' | null;

export interface SliceState {
  phase: SlicePhase;
  /** t=0 car, t=1 robot — mirrors Proto3DApp.t */
  transformT: number;
  battleOutcome: BattleOutcome;
  /** True while the encounter cooldown is active (prevents immediate re-trigger) */
  encounterCooldown: boolean;
  /** Cards selected for the current battle (exactly 3 once locked) */
  lockedCards: import('../game/types').CardId[] | null;
  /** Card cooldowns in turns (index matches lockedCards) */
  cardCooldowns: [number, number, number];
  /** Whether it is currently the player's turn */
  playerTurn: boolean;
  /** Whether a card action is animating (input blocked) */
  busy: boolean;
}

export function makeSliceState(): SliceState {
  return {
    phase: 'explore',
    transformT: 0,
    battleOutcome: null,
    encounterCooldown: false,
    lockedCards: null,
    cardCooldowns: [0, 0, 0],
    playerTurn: false,
    busy: false,
  };
}

/** Returns true if the given transition is currently legal. */
export function canTransition(state: SliceState, to: SlicePhase): boolean {
  const { phase } = state;
  switch (to) {
    case 'encounterIntro': return phase === 'explore' && !state.encounterCooldown;
    case 'toRobot':        return phase === 'encounterIntro';
    case 'battle':         return phase === 'toRobot';
    case 'battleResult':   return phase === 'battle';
    case 'toCar':          return phase === 'battleResult';
    case 'explore':        return phase === 'toCar' || phase === 'encounterIntro';
    default:               return false;
  }
}
