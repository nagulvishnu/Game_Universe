// Story orchestration: authoritative world state, scene prerequisites, continuity fast-forward.
import type { Beat, SceneDef, WorldState } from '../engine/types';
import { ACT1 } from './act1';
import { ACT2 } from './act2';
import { ACT3 } from './act3';
import { ACT4 } from './act4';

export const SCENES: SceneDef[] = [...ACT1, ...ACT2, ...ACT3, ...ACT4];

const SEED_REL: [string, string, number, number][] = [
  ['kael', 'lyra', 0.7, 0.6], ['lyra', 'kael', 0.7, 0.6], ['kael', 'orrin', 0.95, 0.9], ['orrin', 'kael', 0.95, 0.95],
  ['lyra', 'orrin', 0.7, 0.55], ['orrin', 'lyra', 0.8, 0.6], ['seren', 'kael', 0.1, 0.0], ['kael', 'seren', 0.1, 0.0],
  ['seren', 'orrin', 0.2, 0.1], ['orrin', 'seren', 0.6, 0.3], ['malachar', 'kael', 0.0, 0.1], ['kael', 'malachar', 0.0, 0.0],
  ['malachar', 'orrin', 0.4, 0.4], ['orrin', 'malachar', 0.3, 0.7],
];

export function newWorld(): WorldState {
  const w: WorldState = {
    facts: new Set(), hp: {}, dead: new Set(), injuries: {}, outfit: {}, possessions: {},
    rel: {}, knowledge: {}, location: null, history: [],
  };
  SEED_REL.forEach(([a, b, t, f]) => ((w.rel[a] ??= {})[b] = { trust: t, affection: f }));
  w.possessions.kael = ['sword'];
  w.possessions.orrin = ['staff'];
  return w;
}

export function applyEffects(w: WorldState, s: SceneDef) {
  const e = s.effects;
  e.facts?.forEach((f) => w.facts.add(f));
  s.beats.forEach((b: Beat) => {
    if (b.t === 'line' && b.reveals) {
      b.reveals.forEach((f) => w.facts.add(f));
      s.cast.forEach((c) => (w.knowledge[c.id] ??= new Set()), 0);
      s.cast.forEach((c) => b.reveals!.forEach((f) => w.knowledge[c.id].add(f)));
    }
  });
  e.facts?.forEach((f) => s.cast.forEach((c) => ((w.knowledge[c.id] ??= new Set()).add(f))));
  if (e.hp) Object.entries(e.hp).forEach(([k, v]) => (w.hp[k] = v));
  e.dead?.forEach((d) => { w.dead.add(d); w.hp[d] = 0; });
  if (e.injuries) Object.entries(e.injuries).forEach(([k, v]) => { (w.injuries[k] ??= []); if (!w.injuries[k].includes(v)) w.injuries[k].push(v); });
  if (e.outfit) Object.assign(w.outfit, e.outfit);
  e.possessions?.forEach(([who, item]) => {
    Object.keys(w.possessions).forEach((k) => (w.possessions[k] = w.possessions[k].filter((i) => i !== item)));
    (w.possessions[who] ??= []).push(item);
  });
  e.rel?.forEach(([a, b, t, f]) => {
    const r = ((w.rel[a] ??= {})[b] ??= { trust: 0.4, affection: 0.3 });
    r.trust = Math.max(0, Math.min(1, r.trust + t));
    r.affection = Math.max(0, Math.min(1, r.affection + f));
  });
  w.location = s.env;
}

export function missingPrereqs(w: WorldState, s: SceneDef): string[] {
  return s.requires.filter((r) => !w.facts.has(r));
}

/** Rebuild authoritative state for scenes [0, upTo) without rendering them. */
export function fastForward(scenes: SceneDef[], upTo: number): WorldState {
  const w = newWorld();
  for (let i = 0; i < upTo; i++) applyEffects(w, scenes[i]);
  return w;
}

export function estimateLine(text: string): number {
  const words = text.trim().split(/\s+/).length;
  return 0.8 + words * 0.36;
}

export function estimateBeat(b: Beat): number {
  switch (b.t) {
    case 'line': return estimateLine(b.text) + 0.3;
    case 'move': return Math.min(b.cap ?? 12, 6);
    case 'enter': return 5;
    case 'exit': return 4;
    case 'act': return b.dur ?? 1.4;
    case 'combat': return b.dur + 5;
    case 'title': return b.dur;
    case 'wait': return b.dur;
    default: return 0;
  }
}
export function estimateScene(s: SceneDef): number {
  return 1.8 + s.beats.reduce((t, b) => t + estimateBeat(b), 0) + 1.2;
}
export function estimateFilm() { return SCENES.reduce((t, s) => t + estimateScene(s), 0); }
