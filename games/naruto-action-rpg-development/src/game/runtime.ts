// Mutable real-time simulation state. Kept outside React for performance; React reads it from useFrame.
import type * as THREE from 'three';
import type { AbilityDef, ActiveMission, CharId, EnemyDef, Form, LookDef, NpcDef, PatternDef, Pose, Status, Vec3, CampDef, Collectible } from './types';
import { newPose } from './types';
import type { DerivedStats } from './logic/stats';
import { ColliderWorld } from './logic/collision';
import { ZONES, type ZoneDef } from './config';

export interface PlayerAction {
  kind: 'light' | 'heavy' | 'air' | 'cast' | 'dodge' | 'hit' | 'dead' | 'sub';
  t: number; dur: number; hitAt: number; fired: boolean; idx: number; ability?: AbilityDef; dx?: number; dz?: number;
}
export interface PlayerRT {
  charId: CharId; stats: DerivedStats; pos: Vec3; vel: Vec3; yaw: number; hp: number; chakra: number; stamina: number; ult: number;
  grounded: boolean; jumps: number; onWater: boolean; pose: Pose; action: PlayerAction | null;
  comboIdx: number; comboT: number; queued: null | 'light' | 'heavy'; invuln: number; blocking: boolean; blockT: number; charging: boolean;
  cd: Record<string, number>; form: Form; formT: number; formDur: number;
  buff: { dmg: number; speed: number; def: number; t: number }; focusT: number;
  confuseT: number; slowT: number; stunT: number; counterT: number; autoSubCd: number; staminaDelay: number;
  orb: { color: string; size: number; blades: boolean } | null;
  dash: { t: number; dur: number; dx: number; dz: number; ability: AbilityDef } | null;
  slamming: boolean; stepT: number; perfectDodgeUsed: boolean; dead: boolean; lastTarget: number;
}

export type EnemyState = 'patrol' | 'alert' | 'chase' | 'windup' | 'attack' | 'recover' | 'hit' | 'dead' | 'phase';
export interface EnemyRT {
  id: number; def: EnemyDef; pos: Vec3; vel: Vec3; yaw: number; hp: number; maxHp: number; dmgMul: number; lv: number;
  tag?: string; camp?: string; state: EnemyState; stateT: number; pose: Pose; home: { x: number; z: number };
  patrol: { x: number; z: number; wait: number }; poise: number; status: Record<Status, number>;
  pattern: PatternDef | null; patCd: Record<string, number>; atk: { tx: number; tz: number; dx: number; dz: number; done: boolean; dashT: number };
  phase: number; invuln: number; shield: number; shieldT: number; vanish: number; flash: number; dodgeCd: number; blockCd: number;
  deadT: number; aggro: boolean; strafe: number; radius: number; fromMission: boolean; attackToken: boolean; burnTick: number; confusedTarget: EnemyRT | null;
  decideT: number; summoned: boolean;
}
export interface AllyRT {
  id: number; kind: 'clone' | 'companion' | 'escort'; charId: string; look: LookDef; pos: Vec3; vel: Vec3; yaw: number; pose: Pose;
  life: number; atkCd: number; dmg: number; hp: number; target: EnemyRT | null; spCd: number; element: string; scale: number; fromMission: boolean;
}
export interface Projectile {
  id: number; x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; dmg: number; radius: number; explode: number;
  element: AbilityDef['element']; hostile: boolean; pierce: boolean; size: number; color: string; hit: Set<number>;
  kind: 'orb' | 'blade' | 'kunai' | 'shuriken' | 'bomb' | 'wave'; status?: Status; statusDur?: number; spin: number; lingering: boolean; confuse?: boolean; big?: boolean;
  source?: string; grav: number;
}
export interface Telegraph { id: number; shape: 'circle' | 'cone' | 'line'; x: number; z: number; r: number; yaw: number; angle: number; t: number; dur: number; color: string }
export interface Floater { id: number; text: string; x: number; y: number; z: number; t: number; color: string; size: number; vy: number }
export interface Dot { x: number; z: number; r: number; t: number; dur: number; dps: number; tick: number; element: AbilityDef['element']; color: string }
export interface Cine { kind: 'orbit' | 'form' | 'ult' | 'boss' | 'victory'; t: number; dur: number; tx: number; ty: number; tz: number; radius: number; height: number; speed: number; freeze: boolean; startYaw: number }
export interface NpcRT { def: NpcDef; pos: Vec3; yaw: number; pose: Pose; wanderT: number; tx: number; tz: number }
export interface CollectibleRT { def: Collectible; taken: boolean }
export interface CampRT { def: CampDef; enemies: EnemyRT[]; respawnAt: number; active: boolean }

export function createPlayer(): PlayerRT {
  return {
    charId: 'naruto', stats: undefined as unknown as DerivedStats, pos: { x: 0, y: 0, z: 18 }, vel: { x: 0, y: 0, z: 0 }, yaw: Math.PI, hp: 100, chakra: 100, stamina: 100, ult: 0,
    grounded: true, jumps: 0, onWater: false, pose: newPose(), action: null, comboIdx: 0, comboT: 0, queued: null, invuln: 0, blocking: false, blockT: 0, charging: false,
    cd: {}, form: 'base', formT: 0, formDur: 1, buff: { dmg: 0, speed: 0, def: 0, t: 0 }, focusT: 0, confuseT: 0, slowT: 0, stunT: 0, counterT: 0, autoSubCd: 0, staminaDelay: 0,
    orb: null, dash: null, slamming: false, stepT: 0, perfectDodgeUsed: false, dead: false, lastTarget: 0,
  };
}

type VersionKey = 'enemies' | 'allies' | 'npcs' | 'collectibles';
export const rt = {
  t: 0, paused: false, timeScale: 1, slowT: 0, hitStop: 0, shake: 0, flash: 0, flashColor: '#ffffff', playing: false,
  player: createPlayer(), enemies: [] as EnemyRT[], allies: [] as AllyRT[], projectiles: [] as Projectile[], telegraphs: [] as Telegraph[],
  floaters: [] as Floater[], dots: [] as Dot[], logs: [] as { x: number; y: number; z: number; t: number }[],
  sched: [] as { t: number; fn: () => void }[], summon: null as null | { t: number; dur: number; x: number; z: number; kind: string; color: string; fired: boolean },
  npcs: [] as NpcRT[], collectibles: [] as CollectibleRT[], camps: [] as CampRT[], colliders: new ColliderWorld(),
  camYaw: Math.PI, camPitch: 0.35, camDist: 7.5, lock: null as EnemyRT | null, cine: null as Cine | null, camera: null as THREE.Camera | null,
  size: { w: 1280, h: 720 },
  mission: null as ActiveMission | null, checkpoint: { x: 0, z: 18 }, zone: ZONES[0] as ZoneDef, mistT: 0, boss: null as EnemyRT | null,
  idc: 1, chargeAcc: 0, comboCount: 0, comboTimer: 0, interact: null as null | { kind: 'npc' | 'board' | 'collect'; id: string; label: string },
  timeOfDay: 0.3, playtime: 0, stageTimer: 0, waveQueue: [] as { at: number; spawn: import('./types').SpawnDef[] }[], autosaveT: 0,
  version: { enemies: 0, allies: 0, npcs: 0, collectibles: 0 } as Record<VersionKey, number>,
  listeners: new Set<() => void>(), attackers: 0, bossIntroDone: {} as Record<string, boolean>, mapRevealed: false, hudT: 0,
  victoryT: 0, lastEscort: null as AllyRT | null,
};
export type Runtime = typeof rt;
export const nextId = () => rt.idc++;
export function bump(k: VersionKey) { rt.version[k]++; rt.listeners.forEach((l) => l()); }
export const subscribeRt = (l: () => void) => { rt.listeners.add(l); return () => { rt.listeners.delete(l); }; };
export const rtSnapshot = (k: VersionKey) => () => rt.version[k];

export function distXZ(a: Vec3, b: Vec3) { return Math.hypot(a.x - b.x, a.z - b.z); }
export const yawTo = (dx: number, dz: number) => Math.atan2(dx, dz);
export function angleDiff(a: number, b: number) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }
export function lerpAngle(a: number, b: number, t: number) { return a + angleDiff(a, b) * Math.min(1, t); }
