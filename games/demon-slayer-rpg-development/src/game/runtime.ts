import * as THREE from 'three';
import type { SkillDef, Quest } from './types';
import type { BossDef, EAtk, EnemyDef } from './data/enemies';
import type { PStats } from './engine/stats';
import type { StyleId } from './types';
import type { DialogueLine } from './types';

export interface Anim {
  walk: number; pose: 'idle' | 'attack' | 'heavy' | 'skill' | 'dodge' | 'hurt' | 'guard' | 'dead' | 'stagger' | 'cast' | 'thrust' | 'spin' | 'air' | 'intro';
  pt: number; variant: number; expr: 'normal' | 'angry' | 'hurt' | 'happy'; sprint: boolean; speedMul: number;
}
export const newAnim = (): Anim => ({ walk: 0, pose: 'idle', pt: 0, variant: 0, expr: 'normal', sprint: false, speedMul: 1 });

export interface RigHandle {
  group: THREE.Group; anim: Anim; update(dt: number, time: number): void; flash(v: number): void; dispose(): void; swordTip: THREE.Object3D;
  setSwordVisible(v: boolean): void;
}

export interface PlayerRT {
  pos: THREE.Vector3; yaw: number; vy: number; onGround: boolean; hp: number; maxHp: number; sta: number; maxSta: number;
  breath: number; maxBreath: number; ult: number; maxUlt: number;
  state: 'free' | 'attack' | 'heavy' | 'dodge' | 'skill' | 'hurt' | 'guard' | 'dead';
  t: number; dur: number; combo: number; queued: 'light' | 'heavy' | null; hitMask: number; invuln: number; guardT: number; dodgeT: number; perfect: number;
  cd: Record<string, number>; cdMax: Record<string, number>; buffs: { focus: number; guard: number; regen: number; slow: number };
  skill: SkillDef | null; skillHit: Set<number>; skillTick: number; skillDir: THREE.Vector3; skillFrom: THREE.Vector3; skillTarget: number | null;
  stagger: number; lockId: number | null; comboT: number; stats: PStats; charId: string; model: RigHandle | null; footT: number;
  sprinting: boolean; regenDelay: number; lastHitT: number; ultActive: number; air: boolean; airAttack: boolean; heavyDir: number; moveDir: THREE.Vector3; kb: THREE.Vector3;
}

export interface EnemyRT {
  id: number; def: EnemyDef; boss: BossDef | null; level: number; hp: number; maxHp: number; pos: THREE.Vector3; yaw: number;
  vel: THREE.Vector3; state: 'idle' | 'chase' | 'windup' | 'active' | 'recover' | 'stagger' | 'dead' | 'intro' | 'hidden' | 'tele';
  t: number; atk: EAtk | null; atkDone: boolean; cd: Record<string, number>; posture: number; maxPosture: number; phase: number;
  model: RigHandle; home: THREE.Vector3; wander: THREE.Vector3; wanderT: number; strafe: number; strafeT: number;
  status: { poison: number; burn: number; slow: number; stun: number }; regenT: number; deadT: number; aim: THREE.Vector3; from: THREE.Vector3;
  guardUp: boolean; sinceHit: number; spawnT: number; tag: string; dmgMul: number; hitFlash: number; retreatAt: number; aggro: boolean; transT: number;
  lastAtk: string; nextAtkT: number; dodgeT: number; telegraph: number;
}

export interface Proj {
  pos: THREE.Vector3; vel: THREE.Vector3; life: number; radius: number; dmg: number; friendly: boolean; color: number; pierce: boolean;
  status?: string; mesh: THREE.Object3D; hit: Set<number>; style?: StyleId; kb: number; owner: number;
}

export interface NpcRT {
  id: string; name: string; pos: THREE.Vector3; yaw: number; model: RigHandle; lines: DialogueLine[]; shop?: boolean; smith?: boolean;
  tag: string; follow?: boolean; talked: number; questTalk?: boolean; bob: number; home: THREE.Vector3;
}

export interface Pickup { id: string; kind: string; pos: THREE.Vector3; mesh: THREE.Object3D; tag: 'quest' | 'region' | 'poi'; label: string; t: number }

export interface QuestRT {
  quest: Quest; step: number; kills: number; spawnT: number; surviveT: number; collected: number; bossId: number | null; bossDone: boolean;
  stepStart: boolean; escortNpc: string | null; dummyHits: Set<number>; marker: THREE.Vector3 | null; markerR: number; finishing: boolean;
}

export const rt = {
  player: null as PlayerRT | null,
  enemies: [] as EnemyRT[], projs: [] as Proj[], npcs: [] as NpcRT[], pickups: [] as Pickup[],
  nextId: 1, time: 0, timeScale: 1, hitstop: 0, shake: 0, slowmo: 0,
  region: 'sagiri', loading: false, qrt: null as QuestRT | null,
  cin: { active: false, target: new THREE.Vector3(), t: 0, dur: 0, kind: 'boss' as string, focus: null as number | null },
  clock: 0.35, ultCam: 0, combo: 0, comboTimer: 0, nightMix: 1, travel: null as null | { region: string; after?: () => void },
  gates: [] as { pos: THREE.Vector3; to: string }[], interactT: 0, colliders: [] as { x: number; z: number; r: number }[],
  hAt: ((_x: number, _z: number) => 0) as (x: number, z: number) => number, bounds: { hx: 60, hz: 60 },
  dummyDps: { dmg: 0, t: 0, last: 0 }, bossRef: null as EnemyRT | null, flash: 0, pendingSkillPos: null as THREE.Vector3 | null,
  camYaw: 0, camPitch: 0.25, autosaveT: 0, sessionStart: 0, hintShown: {} as Record<string, boolean>,
};

export const input = {
  keys: new Set<string>(), pressed: new Set<string>(), mouseL: false, mouseR: false, clickL: false, clickR: false, dx: 0, dy: 0, locked: false, lockFailed: false, wheel: 0,
};

let attached = false;
export function attachInput(canvasEl: HTMLElement) {
  if (attached) return () => {};
  attached = true;
  const kd = (e: KeyboardEvent) => {
    if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (!e.repeat) input.pressed.add(e.code);
    input.keys.add(e.code);
  };
  const ku = (e: KeyboardEvent) => { input.keys.delete(e.code); };
  const md = (e: MouseEvent) => {
    if (e.button === 0 && !input.locked && !input.lockFailed && (e.target as HTMLElement)?.tagName === 'CANVAS') {
      try { const r = canvasEl.requestPointerLock() as unknown as Promise<void> | undefined; r?.catch?.(() => { input.lockFailed = true; }); } catch { input.lockFailed = true; }
      return;
    }
    if (e.button === 0) { input.mouseL = true; input.clickL = true; }
    if (e.button === 2) { input.mouseR = true; input.clickR = true; }
  };
  const mu = (e: MouseEvent) => { if (e.button === 0) input.mouseL = false; if (e.button === 2) input.mouseR = false; };
  const mm = (e: MouseEvent) => {
    if (input.locked || (input.lockFailed && (input.mouseL || input.mouseR))) { input.dx += e.movementX; input.dy += e.movementY; }
  };
  const cm = (e: Event) => e.preventDefault();
  const pl = () => { input.locked = document.pointerLockElement === canvasEl; };
  const ple = () => { input.lockFailed = true; };
  const blur = () => { input.keys.clear(); input.mouseL = false; input.mouseR = false; };
  const wh = (e: WheelEvent) => { input.wheel += e.deltaY; };
  window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
  window.addEventListener('mousedown', md); window.addEventListener('mouseup', mu); window.addEventListener('mousemove', mm);
  window.addEventListener('contextmenu', cm); window.addEventListener('blur', blur); window.addEventListener('wheel', wh, { passive: true });
  document.addEventListener('pointerlockchange', pl); document.addEventListener('pointerlockerror', ple);
  return () => {
    attached = false;
    window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku);
    window.removeEventListener('mousedown', md); window.removeEventListener('mouseup', mu); window.removeEventListener('mousemove', mm);
    window.removeEventListener('contextmenu', cm); window.removeEventListener('blur', blur); window.removeEventListener('wheel', wh);
    document.removeEventListener('pointerlockchange', pl); document.removeEventListener('pointerlockerror', ple);
  };
}
export function endFrameInput() { input.pressed.clear(); input.clickL = false; input.clickR = false; input.dx = 0; input.dy = 0; input.wheel = 0; }
export const wasPressed = (...codes: string[]) => codes.some((c) => input.pressed.has(c));
export const isDown = (...codes: string[]) => codes.some((c) => input.keys.has(c));
