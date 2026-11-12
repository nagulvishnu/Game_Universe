// Mutable runtime state (non-reactive) + input. Systems read/write G every frame.
import * as THREE from 'three';

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const angDiff = (a: number, b: number) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
export const lerpAng = (a: number, b: number, t: number) => a + angDiff(a, b) * clamp(t, 0, 1);
export const dist2 = (a: THREE.Vector3, b: THREE.Vector3) => Math.hypot(a.x - b.x, a.z - b.z);

export interface Hostile {
  uid: number; kind: 'enemy' | 'boss' | 'ship'; type: string; def: any; pos: THREE.Vector3; vel: THREE.Vector3; yaw: number; hp: number; maxHp: number; r: number; cy: number;
  obj: THREE.Group; parts: Record<string, THREE.Object3D>; home: THREE.Vector3; isl: string; state: string; stateT: number; atkCd: number; dead: boolean; deadT: number;
  hurtT: number; slowT: number; burnT: number; stunT: number; aggro: boolean; flying: boolean; hover: number; dmgTaken: number; vuln: number; x: any; spawnT: number; active: boolean; walk: number; atkProg: number; flash: number; raid?: boolean; lockable: boolean; name: string;
}
export interface Interactable { id: string; x: number; y: number; z: number; r: number; label: () => string | null; act: () => void }
export interface Proj { mesh: THREE.Object3D; pos: THREE.Vector3; vel: THREE.Vector3; life: number; dmg: number; team: 'player' | 'enemy'; r: number; aoe: number; elem: string; homing: Hostile | null; pierce: boolean; hit: Set<number>; grav: number; trail: string; color: number; kind: string; slow?: number; knock?: number; src?: string; crit?: boolean; fromShip?: boolean; turn?: number }

export const G = {
  t: 0, paused: false, started: false, timeScale: 1,
  scene: null as THREE.Scene | null, camera: null as THREE.PerspectiveCamera | null,
  player: {
    pos: new THREE.Vector3(0, 3, 14), vel: new THREE.Vector3(), yaw: 0, hp: 100, sp: 100, mp: 60, onGround: true, state: 'idle', stateT: 0,
    atkT: 0, atkDur: 0.4, atkStep: 0, comboT: 0, atkHit: false, atkKind: 'light' as 'light' | 'heavy', chargeT: 0, charging: false, blocking: false, dodgeT: 0, dodgeDir: new THREE.Vector3(), invuln: 0, hurtT: 0,
    shield: 0, shieldT: 0, swimming: false, climb: null as null | { t: number; from: THREE.Vector3; to: THREE.Vector3 }, lock: null as Hostile | null, cd: {} as Record<string, number>,
    powerT: 0, victoryT: 0, lastSafe: new THREE.Vector3(0, 3, 14), inShip: false, speed: 0, sprinting: false, jumps: 0, landT: 0, fallV: 0, dead: false, respawnT: 0, exhaust: 0, regenDelay: 0, moveAmt: 0, castT: 0, lavaT: 0, mpDelay: 0, drawT: 0,
    faceYaw: 0, buffDmg: 1,
  },
  ship: {
    pos: new THREE.Vector3(66, 1, 18), vel: new THREE.Vector3(), yaw: Math.PI / 2, pitch: 0, roll: 0, speed: 0, throttle: 0, landed: true, alt: 0, boosting: false, weapon: 'cannon', cds: {} as Record<string, number>, obj: null as THREE.Group | null,
    flash: 0, crashT: 0, aimDir: new THREE.Vector3(0, 0, 1), vy: 0, wreckT: 0, spin: 0, missiles: 6, windPush: 0, props: [] as THREE.Object3D[], exhausts: [] as THREE.Vector3[],
  },
  cam: { yaw: 0, pitch: 0.35, dist: 8, pos: new THREE.Vector3(0, 5, 20), look: new THREE.Vector3(), shake: 0, fov: 62, cine: null as null | { t: number; dur: number; from: THREE.Vector3; to: THREE.Vector3; target: THREE.Object3D | THREE.Vector3; fn?: () => void }, orbitT: 0, menuT: 0, introT: 0, ready: false },
  hostiles: [] as Hostile[], projs: [] as Proj[], interactables: [] as Interactable[], boss: null as Hostile | null, bossFight: false, uid: 1,
  weather: { type: 'clear', t: 0, next: 120, i: 0, flash: 0, stormT: 0 },
  event: { next: 70, active: null as null | { id: string; t: number; text: string }, marker: null as null | { x: number; z: number; label: string; t: number }, raid: null as null | { alive: number; t: number; total: number } },
  dayT: 0.3, tickAcc: 0, autosave: 0, interact: null as Interactable | null, msgT: 0, currentIsland: 'verdant', lastIsland: '', underAttackT: 0, combatT: 0, templeActive: false, comboCount: 0, comboShow: 0, hitStop: 0,
  workers: [] as any[], dmgNums: [] as any[],
};

export const input = {
  keys: new Set<string>(), pressed: new Set<string>(), mdx: 0, mdy: 0, lmb: false, rmb: false, locked: false, touch: false, joy: { x: 0, y: 0 }, virt: {} as Record<string, boolean>, wheel: 0, lmbPressed: false, lmbReleased: false, touchLook: { x: 0, y: 0 },
  down(c: string) { return this.keys.has(c); },
  hit(c: string) { return this.pressed.has(c); },
  press(c: string) { this.pressed.add(c); },
  get moveX() { return clamp((this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0) + this.joy.x, -1, 1); },
  get moveY() { return clamp((this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0) + this.joy.y, -1, 1); },
  get attack() { return this.lmb || this.keys.has('KeyF') || !!this.virt.attack; },
  get block() { return this.rmb || this.keys.has('KeyR') || !!this.virt.block; },
  get sprint() { return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || !!this.virt.sprint; },
  get up() { return this.keys.has('Space') || !!this.virt.up; },
  get downKey() { return this.keys.has('KeyC') || this.keys.has('ControlLeft') || !!this.virt.down; },
  endFrame() { this.pressed.clear(); this.mdx = 0; this.mdy = 0; this.wheel = 0; this.lmbPressed = false; this.lmbReleased = false; },
};

let inited = false;
export function initInput(isBlocked: () => boolean) {
  if (inited) return; inited = true;
  input.touch = (navigator.maxTouchPoints > 0 && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window && window.innerWidth < 1100;
  const gameKeys = new Set(['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ControlLeft']);
  window.addEventListener('keydown', e => {
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    if (gameKeys.has(e.code)) e.preventDefault();
    if (!e.repeat) { input.keys.add(e.code); input.pressed.add(e.code); } else input.keys.add(e.code);
  });
  window.addEventListener('keyup', e => { input.keys.delete(e.code); });
  window.addEventListener('blur', () => { input.keys.clear(); input.lmb = false; input.rmb = false; });
  window.addEventListener('mousemove', e => { if (input.locked || (input.lmb && !input.locked && e.buttons === 1 && dragLook)) { input.mdx += e.movementX; input.mdy += e.movementY; } });
  let dragLook = false;
  window.addEventListener('mousedown', e => {
    if (isBlocked()) return; const t = e.target as HTMLElement; if (t.closest && t.closest('[data-ui]')) return;
    if (!input.locked) { dragLook = true; try { (document.getElementById('game-root') as any)?.requestPointerLock?.(); } catch { /* */ } }
    if (e.button === 0) { input.lmb = true; input.lmbPressed = true; } if (e.button === 2) input.rmb = true;
  });
  window.addEventListener('mouseup', e => { if (e.button === 0) { input.lmb = false; input.lmbReleased = true; } if (e.button === 2) input.rmb = false; dragLook = false; });
  window.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('wheel', e => { input.wheel += Math.sign(e.deltaY); }, { passive: true });
  document.addEventListener('pointerlockchange', () => { input.locked = !!document.pointerLockElement; if (!input.locked) { input.lmb = false; input.rmb = false; input.lmbReleased = true; } });
}
