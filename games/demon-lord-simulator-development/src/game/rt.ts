import * as THREE from 'three';
import type { Rig, DragonRig, BossRig, Anim } from './models';

export type Team = 'enemy' | 'ally';
export interface Ent {
  id: number; team: Team; type: string; name: string; fac: string; kind: 'unit' | 'boss' | 'general' | 'commander' | 'citizen' | 'summon' | 'dragon' | 'dummy';
  rig: Rig | null; drig: DragonRig | null; brig: BossRig | null; group: THREE.Object3D; pos: THREE.Vector3; vel: THREE.Vector3; yaw: number; hp: number; max: number; dmg: number; speed: number; radius: number; height: number; scale: number;
  state: 'idle' | 'chase' | 'windup' | 'recover' | 'stagger' | 'dead' | 'special'; st: number; atkCd: number; anim: Anim; animT: number; ap: number; ranged: boolean; flying: boolean; range: number;
  tgt: Ent | 'player' | null; retarget: number; home: THREE.Vector3; wander: THREE.Vector3; aggro: number; hitFlash: number; stun: number; friendly: boolean; life: number; xpv: number;
  tid?: string; raid?: boolean; divId?: string; unitType?: string; weight: number; slot: number; dr: number; bar?: THREE.Group; barFill?: THREE.Mesh; projColor?: string; gid?: string; abilityCd: number; special?: { kind: string; t: number; data?: number };
  boss?: { id: string; phase: number; patternCd: number; pattern: string; patT: number; patterns: string[]; hover: number; intro: number; aim: THREE.Vector3; marks: { x: number; z: number; t: number; r: number }[]; dying: number; color: string; chargeDir: THREE.Vector3 };
  expire: number; spawnT: number; dying: number; swing: number;
}
export interface Proj { mesh: THREE.Object3D; pos: THREE.Vector3; vel: THREE.Vector3; team: Team; dmg: number; radius: number; life: number; tgt: Ent | null; turn: number; kind: string; color: string; aoe: number; alive: boolean; owner?: Ent | null; pierce?: boolean }

export const P = {
  pos: new THREE.Vector3(0, 0, -25), vel: new THREE.Vector3(), yaw: 0, camYaw: 0, camPitch: 0.25, onGround: true, flying: false, swimming: false, hp: 2000, mana: 300, stamina: 100, form: 0, formT: 0,
  action: 'none' as 'none' | 'land' | 'dodge' | 'cast' | 'charge' | 'ult' | 'transform' | 'takeoff' | 'victory' | 'attack' | 'slamdive' | 'flyland', actionT: 0, actionDur: 0, actionAnim: 'idle' as Anim, hitDone: false, hitT: 0.4, atkKind: 'light', combo: 0, comboT: 0, queued: false,
  invuln: 0, dead: 0, seated: false, speedNow: 0, lastSpace: -10, jumpHeld: false, cd: {} as Record<string, number>, beam: { charging: 0, active: 0, tick: 0, held: false }, dir: new THREE.Vector3(0, 0, 1), landVy: 0, anim: 'idle' as Anim, animT: 0, stunned: 0, ult: { t: 0, fired: false }, stepT: 0, dungeon: false,
  atkDur: 0.5, atkIdx: 0,
};
export const R = {
  time: 0, tod: 0.6, timeScale: 1, keys: new Set<string>(), pressed: new Set<string>(), mouse: [false, false, false], mousePressed: [false, false, false], locked: false, shake: 0, hurt: 0, ents: [] as Ent[], projs: [] as Proj[],
  popups: [] as { x: number; y: number; z: number; text: string; color: string; t: number; big: boolean }[], cine: { kind: '', t: 0, dur: 0 }, fov: 65, camDist: 9, nextId: 1, region: 'capital', dungeonSpawned: false, boss: null as Ent | null, paused: false, ready: false, mapPing: 0,
  terrKills: {} as Record<string, number>, bossReady: {} as Record<string, boolean>, wxFlash: 0, lastAuto: 0, lastDay: 0, lastWorld: 0, lastBanner: 0, killsTotal: 0, camPos: new THREE.Vector3(), camDir: new THREE.Vector3(0, 0, 1), raidIds: {} as Record<string, boolean>, hitStop: 0, dragonAlive: false,
};
export const popup = (x: number, y: number, z: number, text: string, color = '#fff', big = false) => { if (R.popups.length > 28) R.popups.shift(); R.popups.push({ x, y, z, text, color, t: 0, big }); };
export const shake = (a: number) => { R.shake = Math.max(R.shake, a); };
export const rand = (a: number, b: number) => a + Math.random() * (b - a);
