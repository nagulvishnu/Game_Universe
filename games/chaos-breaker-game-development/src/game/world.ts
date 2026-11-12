import * as THREE from 'three';
import { AttackDef, EAtk, EnemyDef, Elem, ModeId, StyleDef, WeaponDef, WeaponId } from './types';
import { Rig } from './rig';
import { WeaponModel } from './weaponModels';
import { WeaponTrail } from './vfx';
import { Arena } from './arenas';
import { bridge, useGame } from './store';

export interface Enemy {
  id: number; def: EnemyDef; rig: Rig; pos: THREE.Vector3; yaw: number; vy: number; kx: number; kz: number;
  hp: number; maxHp: number; posture: number; maxPosture: number; armor: number; maxArmor: number;
  state: 'spawn' | 'move' | 'windup' | 'strike' | 'recover' | 'hurt' | 'stagger' | 'air' | 'down' | 'dead' | 'phase' | 'guard' | 'dying';
  st: number; atk: EAtk | null; hitN: number; strikeDone: boolean; cd: number; strafe: number; strafeT: number; last: string; lastLast: string;
  alive: boolean; boss: boolean; phase: number; frozenT: number; staggerT: number; hurtT: number; downT: number; flash: number; guarding: boolean; guardT: number;
  mult: { hp: number; dmg: number; speed: number }; tgt: THREE.Vector3; rain: { x: number; z: number; t: number; done: boolean }[]; tpDone: boolean; rushDir: THREE.Vector3; rushed: number;
  hitOnce: boolean; beamA: number; beamHit: number; feinted: boolean; deathT: number; regenT: number; cue: boolean; pullDone: boolean; lastDmgT: number; spawnT: number; aggro: number; animSeed: number;
  vulnerable: boolean; rushHit: boolean;
}

export interface Proj {
  mesh: THREE.Group; pos: THREE.Vector3; vel: THREE.Vector3; r: number; dmg: number; owner: 'e' | 'p'; elem: Elem; kind: string; life: number; src: Enemy | null;
  deflectable: boolean; reflected: boolean; hit: Set<Enemy>; freeze: number; pierce: boolean; t: number; size: number; alive: boolean; mult: number;
}
export interface Zone { type: 'hole'; pos: THREE.Vector3; r: number; life: number; max: number; dmg: number; vis: THREE.Group }
export interface Pickup { kind: 'hp' | 'ult'; pos: THREE.Vector3; mesh: THREE.Mesh; t: number }

export interface Player {
  rig: Rig; pos: THREE.Vector3; vx: number; vz: number; vy: number; yaw: number; grounded: boolean;
  hp: number; maxHp: number; stam: number; maxStam: number; stamDelay: number; ult: number; awk: number; awkT: number;
  weapon: WeaponDef; weaponId: WeaponId; style: StyleDef; model: WeaponModel; trail: WeaponTrail; trail2: WeaponTrail | null; skin: number;
  state: 'free' | 'attack' | 'deflect' | 'dodge' | 'hurt' | 'dead' | 'dying'; st: number;
  atk: AttackDef | null; atkT: number; atkSpeed: number; hitIdx: number; combo: number; comboWin: number; airIdx: number; atkMul: number; atkCounter: boolean; atkBig: boolean; chargeT: number; charged: boolean; lastLight: boolean; swung: boolean; hitSet: Set<Enemy>;
  d: { age: number; active: boolean; success: boolean; lock: number; chain: number; chainT: number; clashT: number; endAge: number };
  counterT: number; counterTarget: Enemy | null; counterChain: number;
  invuln: number; dodgeCd: number; dodgeDir: THREE.Vector3; dodgeT: number; dodgeBlink: number; perfectDodgeUsed: boolean; jumps: number;
  cds: { spec1: number; spec2: number }; cdMax: { spec1: number; spec2: number }; hurtT: number; retaliate: number; switchT: number;
  lock: Enemy | null; combatCount: number; comboT: number; sprinting: boolean; pullT: number; pullTo: THREE.Vector3 | null; lastHitT: number; marks: THREE.Vector3[]; deadT: number; stepT: number; speedNow: number; awkVariant: boolean;
  pose: number[]; poseL: number[];
}

export interface Run {
  mode: ModeId; score: number; wave: number; waveMax: number; time: number; kills: number; perfects: number; deflects: number; maxCombo: number; bossIdx: number;
  phase: 'intro' | 'fight' | 'break' | 'done'; timer: number; noHit: boolean; over: boolean; label: string; toSpawn: { id: string; delay: number }[]; trainTimer: number; masteryDone: boolean; damageTaken: number; started: number;
}

export const W = {
  scene: null as unknown as THREE.Scene, camera: null as unknown as THREE.PerspectiveCamera, renderer: null as THREE.WebGLRenderer | null,
  arena: null as Arena | null, P: null as unknown as Player, enemies: [] as Enemy[], projs: [] as Proj[], zones: [] as Zone[], pickups: [] as Pickup[],
  run: null as Run | null, time: 0, hitStop: 0, slowT: 0, slowF: 1, dim: 0, nextId: 1, cine: null as null | { t: number; dur: number; target: Enemy | null; kind: string },
  paused: false, shake: 0, fovPunch: 0, sun: null as unknown as THREE.DirectionalLight, hemi: null as unknown as THREE.HemisphereLight, rim: null as unknown as THREE.PointLight,
  lastCombo: 0, hudT: 0, lockPrompt: 0, gravity: 1,
};

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const angDiff = (a: number, b: number) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
export const rand = (a: number, b: number) => a + Math.random() * (b - a);

const _pv = new THREE.Vector3();
export function toScreen(p: THREE.Vector3, yOff = 0): [number, number, boolean] {
  _pv.copy(p); _pv.y += yOff; _pv.project(W.camera);
  return [(_pv.x * .5 + .5) * window.innerWidth, (-_pv.y * .5 + .5) * window.innerHeight, _pv.z < 1 && Math.abs(_pv.x) < 1.2 && Math.abs(_pv.y) < 1.2];
}
export function floatText(p: THREE.Vector3, text: string, cls: string, yOff = 1.8) {
  const [x, y, ok] = toScreen(p, yOff); if (ok) bridge.float(x, y, text, cls);
}
export const settings = () => useGame.getState().settings;
export const difficulty = () => { const d = settings().difficulty; return d === 'easy' ? { dmg: .7, pw: 1.35 } : d === 'hard' ? { dmg: 1.25, pw: .8 } : { dmg: 1, pw: 1 }; };
