import * as THREE from 'three';
import type { Rig, Look } from './rig';
import type { Cat, FxKind, TState } from './data';

export const V3 = THREE.Vector3;
export type Vec = THREE.Vector3;

export interface Actor {
  id: number; kind: 'hero' | 'gang' | 'civilian' | 'rival' | 'boss' | 'ally' | 'guard' | 'summon';
  team: 'hero' | 'enemy' | 'civ' | 'ally';
  name: string; def: string; pos: Vec; vel: Vec; yaw: number; hp: number; maxHp: number; lvl: number; fly: boolean;
  state: string; t: number; atkCd: number; abCd: number; power: Cat; color: string; speed: number; dmg: number; style: 'melee' | 'ranged' | 'mixed';
  rig: Rig | null; look: Look; home: Vec; stun: number; frozen: number; alive: boolean; boss: boolean; region: string; weak: Cat | null;
  flash: number; deadT: number; memberId: string; scale: number; anim: string; atkT: number; wander: Vec; bleed: number; life: number; resp: boolean; aggro: boolean;
  alt: number; lastPos: Vec; weapon: string; tgt: Actor | 'player' | null; tele: number; mode: number; combo: number; speedNow: number;
  /** Set when the actor belongs to a far-away interior instance ('hq' | 'bunker'). Unset outdoors. */
  interior?: string;
  crowd?: boolean; patrolId?: number;
}
export interface Vehicle {
  id: number; type: string; color: string; pos: Vec; yaw: number; speed: number; vy: number; steer: number; hp: number; maxHp: number;
  ai: 'parked' | 'traffic' | 'player' | 'wreck'; stolen: boolean; group: THREE.Group | null; spin: number; door: number; braking: boolean;
  dir: Vec; smoke: number; cargo: boolean; fromGarage: boolean; roll: number; pitch: number; slip: number; stealT: number; tlock: number;
}
export interface Projectile { pos: Vec; vel: Vec; life: number; dmg: number; color: string; c2: string; r: number; team: 'player' | 'enemy'; cat: Cat; fx: FxKind; pierce: number; hit: Set<number>; size: number; explode: number; grav: number; slow: number; src: string }
// Interiors are built in a far-away pocket of the world (x ~= 2000) so their
// geometry and collision never overlap the main map. The single source of truth
// for "is the player inside" is `G.p.interior`; actors and interactables carry
// their own `interior` tag instead of comparing raw x coordinates.
export interface Interactable {
  id: string; kind: 'loot' | 'register' | 'door' | 'cmd' | 'vendor' | 'station' | 'core' | 'hatch' | 'exit'; pos: Vec; label: string; taken: boolean; data: Record<string, any>; mesh?: THREE.Object3D;
  /** Set when the interactable lives inside an interior instance ('hq' | 'bunker'). Unset outdoors. */
  interior?: string;
}
export interface Enterable { id: string; kind: string; x: number; z: number; w: number; d: number; h: number; region: string; roof: THREE.Object3D | null; group: THREE.Group | null; guard: number; alarm: boolean; spawned: boolean; looted: number; resident: boolean }

export const G = {
  p: {
    pos: new V3(0, 0, 0), vel: new V3(), yaw: 0, camYaw: Math.PI, camPitch: 0.25, flying: false, boost: false, grounded: true,
    hp: 100, en: 100, maxHp: 100, maxEn: 100, vehicle: null as Vehicle | null, interior: '' as string, dashT: 0, dashDir: new V3(),
    atkT: 0, atkDur: 0.4, combo: 0, comboT: 0, heavy: false, castT: 0, blockT: 0, invT: 0, formT: 0, form: 0, cd: { e: 0, r: 0, v: 0 } as Record<string, number>,
    shield: 0, landT: 0, turn: 0, stun: 0, hitT: 0, dead: 0, transT: 0, speed: 0, hasHit: false, diving: false, chain: 0,
    hit: new Set<number>(), skDash: null as null | { dmg: number; cat: Cat; c1: string; c2: string }, lastSpace: -1, bleed: 0, lastDmg: 0, mouthT: 0, atkDir: new V3(), slowT: 0, searchT: 0, searchTarget: '' as string, rageBuff: 0, combatT: 0,
  },
  actors: [] as Actor[], vehicles: [] as Vehicle[], projectiles: [] as Projectile[], interactables: [] as Interactable[], enterables: [] as Enterable[],
  time: 9.5, weather: 'clear' as 'clear' | 'rain' | 'storm' | 'fog', rain: 0, lightning: 0,
  heat: 0, threat: 0, safeT: 0, hunterT: 0,
  paused: true, running: false, camMode: 0, shake: 0, cine: { t: 0, dur: 0, form: 0 },
  nextId: 1, waypoint: null as null | { x: number; z: number }, flyAcc: 0,
  learn: {} as Record<string, number>,   regionId: 'metro', assault: null as null | { region: string; waves: number; wave: number; alive: number; t: number; boss: number; prev: TState; fail: number },
  boss: null as null | { name: string; hp: number; max: number }, tickT: 0, saveT: 0,
  summoned: 0, hitStop: 0, fields: [] as { pos: Vec; r: number; t: number; dur: number; kind: FxKind; dmg: number; cat: Cat; c1: string; c2: string; tick: number }[],
  delayed: [] as { t: number; fn: () => void }[], follow: [] as Actor[], fps: 60,
};

export const AIM = new V3(0, 0, 1);
export const CAMP = new V3();
export const BLASTS: { x: number; y: number; z: number; r: number; d: number }[] = [];
export const K = { down: new Set<string>(), pressed: new Set<string>(), mdx: 0, mdy: 0, lmb: false, rmb: false, lmbP: false, rmbP: false, wheel: 0, locked: false, noLock: false, alt: false };
export const down = (...codes: string[]) => codes.some((c) => K.down.has(c));
export const pressed = (...codes: string[]) => codes.some((c) => K.pressed.has(c));
export function endFrame() { K.pressed.clear(); K.mdx = 0; K.mdy = 0; K.lmbP = false; K.rmbP = false; K.wheel = 0; }

export const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const damp = (a: number, b: number, k: number, dt: number) => a + (b - a) * (1 - Math.exp(-k * dt));
export const angDiff = (a: number, b: number) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
export function seeded(seed: number) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// Reusable HUD snapshot (zustand pushes happen from Game at ~8Hz)
export const hudState = { prompt: '', progress: 0 };
