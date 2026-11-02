import type { Finish } from '../types';

export const FINISH_POINTS: Record<Finish, number> = { SPIN: 1, RING_OUT: 2, BURST: 3 };
export const REQUIRED_POINTS = 5;

export interface EncounterState {
  points: number;
  defeated: boolean;
}
export interface EncounterOutcome extends EncounterState {
  /** Points the finish was worth. */
  awarded: number;
  /** Points actually counted toward the five-point requirement. */
  counted: number;
  /** Points discarded because they exceeded five. */
  excess: number;
  justDefeated: boolean;
}

/** Apply a WIN to an encounter. Losses never call this (score is unchanged on defeat). */
export function applyEncounterWin(prev: EncounterState, finish: Finish): EncounterOutcome {
  const awarded = FINISH_POINTS[finish];
  if (prev.defeated) {
    return { points: REQUIRED_POINTS, defeated: true, awarded, counted: 0, excess: awarded, justDefeated: false };
  }
  const raw = prev.points + awarded;
  const points = Math.min(REQUIRED_POINTS, raw);
  const defeated = points >= REQUIRED_POINTS;
  return { points, defeated, awarded, counted: points - prev.points, excess: Math.max(0, raw - REQUIRED_POINTS), justDefeated: defeated };
}
