import * as THREE from 'three';
import type { FX } from './fx';
import type { Quality, WorldHandle } from './world';
import type { EnemyRT } from '../runtime';

/** Shared mutable engine context (renderer-side objects). */
export const G = {
  scene: null as THREE.Scene | null, camera: null as THREE.PerspectiveCamera | null, fx: null as FX | null, world: null as WorldHandle | null,
  ents: new THREE.Group(), quality: { shadows: 'low', density: 0.8, seg: 70, weather: 1 } as Quality,
  lastTarget: null as EnemyRT | null, lastTargetT: 0, onKill: null as ((e: EnemyRT) => void) | null, onBossPhase: null as ((e: EnemyRT, name: string) => void) | null,
  shadowCam: 1,
};

export const fwd = (yaw: number, out = new THREE.Vector3()) => out.set(Math.sin(yaw), 0, Math.cos(yaw));
export const angDiff = (a: number, b: number) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const damp = (cur: number, target: number, k: number, dt: number) => cur + (target - cur) * (1 - Math.exp(-k * dt));
