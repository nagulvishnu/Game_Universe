import * as THREE from "three";
import type { HeroId } from "../data";

export const V3 = THREE.Vector3;
export type V3 = THREE.Vector3;
export const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const damp = (a: number, b: number, k: number, dt: number) => a + (b - a) * (1 - Math.exp(-k * dt));
export const angDiff = (a: number, b: number) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};
export const dampAng = (a: number, b: number, k: number, dt: number) => a + angDiff(a, b) * (1 - Math.exp(-k * dt));
export const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
export const dist2 = (a: V3, b: V3) => Math.hypot(a.x - b.x, a.z - b.z);
export const sstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const yawTo = (from: V3, to: V3) => Math.atan2(to.x - from.x, to.z - from.z);
export const fwd = (yaw: number, out = new V3()) => out.set(Math.sin(yaw), 0, Math.cos(yaw));

export const G: any = {
  root: new THREE.Group(),
  scene: null,
  camera: null,
  mode: "menu",
  time: 0,
  timeScale: 1,
  slowT: 0,
  hitstop: 0,
  shake: 0,
  flash: 0,
  input: {
    keys: new Set<string>(),
    pressed: new Set<string>(),
    mouse: [false, false],
    mPressed: [false, false],
    mReleased: [false, false],
    dx: 0,
    dy: 0,
    wheel: 0,
  },
  enemies: [] as any[],
  allies: [] as any[],
  projectiles: [] as any[],
  waves: [] as any[],
  events: [] as { t: number; fn: () => void }[],
  souls: [] as any[],
  dmgNums: [] as any[],
  props: [] as any[],
  cars: [] as any[],
  civs: [] as any[],
  portals: [] as any[],
  hooks: {} as Record<string, (...a: any[]) => any>,
  mission: null as any,
  objMarker: null as V3 | null,
  boss: null as any,
  cam: { yaw: 0, pitch: 0.3, dist: 7.5, cine: null as any, pos: new V3(), look: new V3(), fov: 70 },
  settings: { quality: "medium", shake: true, sens: 1, fov: 70, voice: true },
  mods: { dmg: 1, hp: 1, en: 1, cd: 1, mast: 1, ult: 1 },
  inArena: false,
  danger: 0,
  nextId: 1,
  updaters: [] as any[],
  freezeInput: false,
  hurt: 0,
  shakeAdd: 0,
};

export const P = {
  hero: "kairo" as HeroId,
  pos: new V3(0, 0, 20),
  vel: new V3(),
  yaw: 0,
  grounded: true,
  flying: false,
  jumps: 0,
  lastSpace: -9,
  airT: 0,
  hp: { kairo: 1000, ryujin: 1000 } as Record<HeroId, number>,
  maxHp: { kairo: 1000, ryujin: 1000 } as Record<HeroId, number>,
  en: { kairo: 100, ryujin: 100 } as Record<HeroId, number>,
  maxEn: { kairo: 100, ryujin: 100 } as Record<HeroId, number>,
  ult: { kairo: 0, ryujin: 0 } as Record<HeroId, number>,
  cd: {
    kairo: { E: 0, R: 0, F: 0, Q: 0, V: 0 },
    ryujin: { E: 0, R: 0, F: 0, Q: 0, V: 0 },
  } as Record<HeroId, Record<string, number>>,
  cdMax: { E: 1, R: 1, F: 1, Q: 1, V: 1 } as Record<string, number>,
  combo: 0,
  comboT: 0,
  act: null as any,
  queued: false,
  invul: 0,
  hurtT: 0,
  landT: 0,
  dodgeCd: 0,
  lock: null as any,
  charging: 0,
  switchCd: 0,
  dead: false,
  deadT: 0,
  speedFrac: 0,
  sprint: false,
  lastCombat: -99,
  perfectCd: 0,
  radius: 0.5,
  height: 1.85,
  anim: { mode: "idle", kind: 0, p: 0 },
  stagger: 0,
  aimDir: new V3(0, 0, 1),
  popT: 0,
  victoryT: 0,
};

export const R = {
  r: 0.5,
};

export function later(t: number, fn: () => void) {
  G.events.push({ t: G.time + t, fn });
}
export const hookCall = (name: string, ...a: any[]) => G.hooks[name]?.(...a);
