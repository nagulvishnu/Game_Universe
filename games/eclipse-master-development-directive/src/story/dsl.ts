import type { AnimName, Beat, Emotion, FxKind, Gesture, ShotHint, Stance } from '../engine/types';

type LineX = { g?: Gesture; to?: string; reveals?: string[]; shot?: ShotHint };
/** spoken line */
export const L = (who: string, text: string, emo: Emotion = 'neutral', x: LineX = {}): Beat => ({ t: 'line', who, text, emo, ...x });
/** off-screen voice-over (Orrin narrates the film's frame story) */
export const V = (text: string, emo: Emotion = 'neutral'): Beat => ({ t: 'line', who: 'orrin', text, emo, off: true });
export const MV = (to: Record<string, string>, run = false, cap?: number): Beat => ({ t: 'move', to, run, cap });
export const EN = (who: string, from: string, to: string, run = false): Beat => ({ t: 'enter', who, from, to, run });
export const EX = (who: string, via: string, run = false): Beat => ({ t: 'exit', who, via, run });
export const A = (who: string, anim: AnimName, dur?: number, at?: string, emo?: Emotion): Beat => ({ t: 'act', who, anim, dur, at, emo });
export const ST = (who: string, stance: Stance, weapon?: boolean, emo?: Emotion): Beat => ({ t: 'stance', who, stance, weapon, emo });
export const FACE = (who: string, at: string): Beat => ({ t: 'face', who, at });
export const FX = (k: FxKind, o: { at?: string; who?: string; color?: string; amount?: number; to?: number | string; name?: string } = {}): Beat => ({ t: 'fx', k, ...o });
export const W = (dur: number, shot?: ShotHint): Beat => ({ t: 'wait', dur, shot });
export const TITLE = (text: string, sub: string | undefined, dur: number): Beat => ({ t: 'title', text, sub, dur });
export const SHOT = (shot: ShotHint): Beat => ({ t: 'shot', shot });
export const C = (id: string, a: string[], b: string[], winner: 0 | 1 | 'draw', dur: number, end: 'down' | 'kneel' | 'draw', arena = 'c'): Beat =>
  ({ t: 'combat', id, sides: [a, b], winner, dur, end, arena });
/** off-screen voice of a named character */
export const OFF = (who: string, text: string, emo: Emotion = 'neutral'): Beat => ({ t: 'line', who, text, emo, off: true });
