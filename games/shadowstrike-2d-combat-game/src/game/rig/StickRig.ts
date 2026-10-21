/**
 * SHADOWSTRIKE — procedural 2D stickman rig.
 *
 * Everything is drawn in local space with the origin at the fighter's feet and
 * the character facing RIGHT. Mirroring is done by setting container.scaleX.
 * No 3D, no ragdoll: poses are explicit numbers produced by the animation
 * functions below, so animation always matches the authored hitbox windows.
 */

import type Phaser from 'phaser';
import type { WeaponDef } from '../../data/weapons';
import type { EquipmentDef } from '../../data/equipment';
import { drawWeaponArt } from './WeaponRenderer';
import { drawShadowWarrior } from './CharacterRenderer';
import type { ContrastStyle } from '../contrast/AdaptiveContrast';

export interface Pose {
  hipY: number;      // vertical hip offset (negative = up)
  torso: number;     // absolute angle of hip->neck
  head: number;      // absolute angle of neck->head
  armLA: number; armLB: number;  // back arm: shoulder, elbow
  armRA: number; armRB: number;  // front arm (weapon hand)
  legLA: number; legLB: number;  // back leg: hip, knee
  legRA: number; legRB: number;  // front leg
  bob: number;       // whole body vertical bob
  squash: number;    // 1 = normal
}

export const SEG = {
  torso: 36, neck: 13, headR: 11,
  upperArm: 20, foreArm: 19,
  thigh: 27, shin: 25,
  hipBase: -52,
};

const UP = -Math.PI / 2;
const DOWN = Math.PI / 2;

export const IDLE_POSE: Pose = {
  hipY: 0, torso: UP + 0.09, head: UP + 0.04,
  armLA: DOWN - 0.30, armLB: DOWN - 0.75,
  armRA: DOWN - 0.42, armRB: DOWN - 0.95,
  legLA: DOWN + 0.17, legLB: DOWN + 0.07,
  legRA: DOWN - 0.19, legRB: DOWN - 0.02,
  bob: 0, squash: 1,
};

export function pose(p: Partial<Pose>): Pose {
  return { ...IDLE_POSE, ...p };
}

export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const k = Math.min(1, Math.max(0, t));
  const out = {} as Pose;
  (Object.keys(IDLE_POSE) as (keyof Pose)[]).forEach((key) => {
    out[key] = a[key] + (b[key] - a[key]) * k;
  });
  return out;
}

/* ------------------------------------------------------------- locomotion */

export type LocoState =
  | 'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'land' | 'crouch' | 'dash'
  | 'block' | 'blockhit' | 'hit' | 'knockdown' | 'getup' | 'victory' | 'defeat' | 'cast' | 'summon';

export function locomotionPose(state: LocoState, t: number, speedRatio = 0): Pose {
  switch (state) {
    case 'walk':
    case 'run': {
      const f = state === 'run' ? 9.5 : 6.2;
      const amp = state === 'run' ? 0.72 : 0.42;
      const s = Math.sin(t * f);
      const c = Math.cos(t * f);
      return pose({
        hipY: -Math.abs(s) * (state === 'run' ? 3.5 : 2),
        torso: UP + (state === 'run' ? 0.28 : 0.14) + s * 0.03,
        head: UP + 0.06,
        armLA: DOWN - 0.3 + s * amp * 0.9,
        armLB: DOWN - 0.8 - Math.max(0, s) * 0.5,
        armRA: DOWN - 0.3 - s * amp * 0.9,
        armRB: DOWN - 0.9 - Math.max(0, -s) * 0.5,
        legLA: DOWN + s * amp,
        legLB: DOWN + 0.12 + Math.max(0, -c) * 0.75,
        legRA: DOWN - s * amp,
        legRB: DOWN + 0.12 + Math.max(0, c) * 0.75,
        bob: -Math.abs(c) * speedRatio * 1.5,
      });
    }
    case 'jump':
      return pose({
        hipY: -2, torso: UP - 0.05,
        armLA: DOWN - 1.9, armLB: DOWN - 1.5,
        armRA: DOWN - 1.7, armRB: DOWN - 1.3,
        legLA: DOWN + 0.55, legLB: DOWN + 1.0,
        legRA: DOWN - 0.4, legRB: DOWN + 0.35,
      });
    case 'fall':
      return pose({
        hipY: 0, torso: UP + 0.16,
        armLA: DOWN - 1.5, armLB: DOWN - 1.0,
        armRA: DOWN - 1.3, armRB: DOWN - 0.8,
        legLA: DOWN + 0.38, legLB: DOWN + 0.55,
        legRA: DOWN - 0.3, legRB: DOWN + 0.2,
      });
    case 'land':
      return pose({
        hipY: 10, squash: 0.92, torso: UP + 0.3,
        armLA: DOWN - 0.9, armLB: DOWN - 1.3,
        armRA: DOWN - 0.8, armRB: DOWN - 1.2,
        legLA: DOWN + 0.5, legLB: DOWN + 0.95,
        legRA: DOWN - 0.45, legRB: DOWN + 0.9,
      });
    case 'crouch':
      return pose({
        hipY: 18, squash: 0.9, torso: UP + 0.42, head: UP + 0.2,
        armLA: DOWN - 0.6, armLB: DOWN - 1.5,
        armRA: DOWN - 0.5, armRB: DOWN - 1.4,
        legLA: DOWN + 0.72, legLB: DOWN + 1.25,
        legRA: DOWN - 0.62, legRB: DOWN + 1.2,
      });
    case 'dash':
      return pose({
        hipY: 7, torso: UP + 0.62, head: UP + 0.42,
        armLA: DOWN - 2.3, armLB: DOWN - 0.7,
        armRA: DOWN - 0.1, armRB: DOWN - 0.3,
        legLA: DOWN + 0.95, legLB: DOWN + 0.7,
        legRA: DOWN - 0.85, legRB: DOWN + 0.15,
      });
    case 'block':
    case 'blockhit': {
      const push = state === 'blockhit' ? 0.22 : 0;
      return pose({
        hipY: 7 + push * 10, torso: UP + 0.3 + push, head: UP + 0.12,
        armLA: DOWN - 1.95 + push, armLB: DOWN - 2.1,
        armRA: DOWN - 1.75 + push, armRB: DOWN - 2.2,
        legLA: DOWN + 0.5, legLB: DOWN + 0.6,
        legRA: DOWN - 0.5, legRB: DOWN + 0.45,
      });
    }
    case 'hit':
      return pose({
        hipY: 4, torso: UP - 0.34, head: UP - 0.42,
        armLA: DOWN - 1.1, armLB: DOWN - 1.9,
        armRA: DOWN - 0.9, armRB: DOWN - 1.7,
        legLA: DOWN + 0.45, legLB: DOWN + 0.4,
        legRA: DOWN - 0.42, legRB: DOWN + 0.3,
      });
    case 'knockdown':
      return pose({
        hipY: 44, squash: 0.8, torso: UP + 1.45, head: UP + 1.3,
        armLA: DOWN - 2.6, armLB: DOWN - 2.4,
        armRA: DOWN - 2.9, armRB: DOWN - 2.2,
        legLA: DOWN + 1.45, legLB: DOWN + 1.2,
        legRA: DOWN + 1.3, legRB: DOWN + 1.35,
      });
    case 'getup':
      return pose({
        hipY: 24, squash: 0.92, torso: UP + 0.7, head: UP + 0.4,
        armLA: DOWN - 0.9, armLB: DOWN - 1.2,
        armRA: DOWN - 0.7, armRB: DOWN - 1.1,
        legLA: DOWN + 0.9, legLB: DOWN + 1.3,
        legRA: DOWN - 0.6, legRB: DOWN + 1.0,
      });
    case 'victory': {
      const s = Math.sin(t * 3);
      return pose({
        hipY: -2 + s, torso: UP - 0.05,
        armLA: DOWN - 2.5 - s * 0.1, armLB: DOWN - 2.4,
        armRA: DOWN - 2.6 + s * 0.1, armRB: DOWN - 2.5,
        legLA: DOWN + 0.2, legLB: DOWN + 0.08,
        legRA: DOWN - 0.22, legRB: DOWN + 0.05,
      });
    }
    case 'defeat':
      return pose({
        hipY: 48, squash: 0.78, torso: UP + 1.5, head: UP + 1.45,
        armLA: DOWN - 2.9, armLB: DOWN - 2.9,
        armRA: DOWN - 3.0, armRB: DOWN - 3.0,
        legLA: DOWN + 1.5, legLB: DOWN + 1.45,
        legRA: DOWN + 1.42, legRB: DOWN + 1.5,
      });
    case 'cast': {
      const s = Math.sin(t * 16) * 0.05;
      return pose({
        hipY: 3, torso: UP + 0.2, head: UP + 0.1,
        armLA: DOWN - 1.55 + s, armLB: DOWN - 1.9,
        armRA: DOWN - 1.62 - s, armRB: DOWN - 1.72,
        legLA: DOWN + 0.45, legLB: DOWN + 0.4,
        legRA: DOWN - 0.4, legRB: DOWN + 0.3,
      });
    }
    case 'summon': {
      const s = Math.sin(t * 12) * 0.08;
      return pose({
        hipY: 6, torso: UP + 0.05, head: UP - 0.12,
        armLA: DOWN - 2.45 + s, armLB: DOWN - 2.0,
        armRA: DOWN - 2.55 - s, armRB: DOWN - 2.1,
        legLA: DOWN + 0.55, legLB: DOWN + 0.5,
        legRA: DOWN - 0.5, legRB: DOWN + 0.4,
      });
    }
    case 'idle':
    default: {
      const s = Math.sin(t * 2.2);
      return pose({
        hipY: s * 1.4,
        torso: UP + 0.09 + s * 0.015,
        head: UP + 0.04 - s * 0.02,
        armLA: DOWN - 0.30 + s * 0.05,
        armLB: DOWN - 0.75 - s * 0.05,
        armRA: DOWN - 0.42 - s * 0.04,
        armRB: DOWN - 0.95 + s * 0.05,
        bob: s * 0.8,
      });
    }
  }
}

/* ----------------------------------------------------------- attack poses */

export type AttackPhase = 'startup' | 'active' | 'recovery';
export type SwingArc = 'slash' | 'thrust' | 'punch' | 'sweep' | 'spin' | 'overhead' | 'uppercut';

/** Wind-up -> strike -> recover poses for each swing arc. */
const ARC_POSES: Record<SwingArc, [Pose, Pose, Pose]> = {
  slash: [
    pose({ hipY: 2, torso: UP - 0.2, armRA: DOWN - 2.75, armRB: DOWN - 2.5, armLA: DOWN - 1.1, armLB: DOWN - 1.6, legLA: DOWN + 0.4, legRA: DOWN - 0.35 }),
    pose({ hipY: 4, torso: UP + 0.38, armRA: DOWN - 0.65, armRB: DOWN - 0.1, armLA: DOWN - 1.9, armLB: DOWN - 1.1, legLA: DOWN + 0.72, legLB: DOWN + 0.5, legRA: DOWN - 0.62 }),
    pose({ hipY: 6, torso: UP + 0.22, armRA: DOWN - 0.25, armRB: DOWN - 0.45, armLA: DOWN - 1.1, armLB: DOWN - 1.3, legLA: DOWN + 0.5, legRA: DOWN - 0.45 }),
  ],
  thrust: [
    pose({ hipY: 2, torso: UP - 0.12, armRA: DOWN - 1.35, armRB: DOWN - 2.55, armLA: DOWN - 1.4, armLB: DOWN - 2.2, legLA: DOWN + 0.5, legRA: DOWN - 0.3 }),
    pose({ hipY: 5, torso: UP + 0.3, armRA: DOWN - 1.58, armRB: DOWN - 1.6, armLA: DOWN - 1.5, armLB: DOWN - 1.55, legLA: DOWN + 0.85, legLB: DOWN + 0.45, legRA: DOWN - 0.7 }),
    pose({ hipY: 6, torso: UP + 0.18, armRA: DOWN - 1.3, armRB: DOWN - 1.9, armLA: DOWN - 1.3, armLB: DOWN - 1.9, legLA: DOWN + 0.55, legRA: DOWN - 0.5 }),
  ],
  punch: [
    pose({ hipY: 2, torso: UP - 0.18, armRA: DOWN - 1.25, armRB: DOWN - 2.6, armLA: DOWN - 1.6, armLB: DOWN - 2.3, legLA: DOWN + 0.45, legRA: DOWN - 0.3 }),
    pose({ hipY: 4, torso: UP + 0.26, armRA: DOWN - 1.6, armRB: DOWN - 1.58, armLA: DOWN - 1.75, armLB: DOWN - 2.4, legLA: DOWN + 0.78, legLB: DOWN + 0.4, legRA: DOWN - 0.62 }),
    pose({ hipY: 5, torso: UP + 0.14, armRA: DOWN - 1.35, armRB: DOWN - 2.1, armLA: DOWN - 1.7, armLB: DOWN - 2.3, legLA: DOWN + 0.5, legRA: DOWN - 0.45 }),
  ],
  sweep: [
    pose({ hipY: 6, torso: UP - 0.3, armRA: DOWN - 2.35, armRB: DOWN - 1.6, armLA: DOWN - 2.1, armLB: DOWN - 1.5, legLA: DOWN + 0.6, legRA: DOWN - 0.4 }),
    pose({ hipY: 14, torso: UP + 0.55, armRA: DOWN - 0.12, armRB: DOWN + 0.2, armLA: DOWN - 0.5, armLB: DOWN - 0.1, legLA: DOWN + 0.95, legLB: DOWN + 0.85, legRA: DOWN - 0.75, legRB: DOWN + 0.3 }),
    pose({ hipY: 10, torso: UP + 0.3, armRA: DOWN - 0.4, armRB: DOWN - 0.3, armLA: DOWN - 0.8, armLB: DOWN - 0.6, legLA: DOWN + 0.6, legRA: DOWN - 0.5 }),
  ],
  spin: [
    pose({ hipY: 3, torso: UP - 0.35, armRA: DOWN - 2.9, armRB: DOWN - 2.0, armLA: DOWN - 0.4, armLB: DOWN - 0.6, legLA: DOWN + 0.4, legRA: DOWN - 0.35 }),
    pose({ hipY: 2, torso: UP + 0.1, armRA: DOWN - 1.0, armRB: DOWN - 0.05, armLA: DOWN - 2.3, armLB: DOWN - 0.2, legLA: DOWN + 0.8, legLB: DOWN + 0.6, legRA: DOWN - 0.8, legRB: DOWN + 0.4 }),
    pose({ hipY: 6, torso: UP + 0.2, armRA: DOWN - 0.5, armRB: DOWN - 0.5, armLA: DOWN - 1.2, armLB: DOWN - 0.9, legLA: DOWN + 0.45, legRA: DOWN - 0.4 }),
  ],
  overhead: [
    pose({ hipY: -2, torso: UP - 0.3, armRA: DOWN - 3.3, armRB: DOWN - 2.9, armLA: DOWN - 3.1, armLB: DOWN - 2.7, legLA: DOWN + 0.35, legRA: DOWN - 0.3 }),
    pose({ hipY: 12, torso: UP + 0.6, armRA: DOWN - 0.45, armRB: DOWN - 0.05, armLA: DOWN - 0.7, armLB: DOWN - 0.2, legLA: DOWN + 0.9, legLB: DOWN + 0.7, legRA: DOWN - 0.75, legRB: DOWN + 0.35 }),
    pose({ hipY: 14, torso: UP + 0.42, armRA: DOWN - 0.3, armRB: DOWN - 0.35, armLA: DOWN - 0.5, armLB: DOWN - 0.5, legLA: DOWN + 0.7, legRA: DOWN - 0.6 }),
  ],
  uppercut: [
    pose({ hipY: 16, torso: UP + 0.5, armRA: DOWN - 0.4, armRB: DOWN - 0.9, armLA: DOWN - 0.6, armLB: DOWN - 1.4, legLA: DOWN + 0.8, legLB: DOWN + 1.1, legRA: DOWN - 0.6, legRB: DOWN + 0.9 }),
    pose({ hipY: -8, torso: UP - 0.22, armRA: DOWN - 2.95, armRB: DOWN - 2.75, armLA: DOWN - 1.2, armLB: DOWN - 1.9, legLA: DOWN + 0.3, legLB: DOWN + 0.05, legRA: DOWN - 0.25 }),
    pose({ hipY: 2, torso: UP + 0.05, armRA: DOWN - 2.2, armRB: DOWN - 2.3, armLA: DOWN - 1.0, armLB: DOWN - 1.5, legLA: DOWN + 0.4, legRA: DOWN - 0.35 }),
  ],
};

export function attackPose(arc: SwingArc, phase: AttackPhase, p: number): Pose {
  const [wind, strike, recover] = ARC_POSES[arc];
  const k = Math.min(1, Math.max(0, p));
  if (phase === 'startup') return lerpPose(IDLE_POSE, wind, easeOut(k));
  if (phase === 'active') return lerpPose(wind, strike, easeIn(k));
  return lerpPose(strike, lerpPose(recover, IDLE_POSE, 0.55), easeOut(k));
}

export function chargePose(arc: SwingArc, t: number): Pose {
  const [wind] = ARC_POSES[arc];
  const shiver = Math.sin(t * 26) * 0.035;
  return pose({ ...wind, torso: wind.torso + shiver, armRA: wind.armRA + shiver, armLA: wind.armLA - shiver, hipY: wind.hipY + 2 });
}

const easeOut = (x: number) => 1 - Math.pow(1 - x, 2.2);
const easeIn = (x: number) => Math.pow(x, 0.55);

/* -------------------------------------------------------------- skeleton */

export interface Joint { x: number; y: number }
export interface Skeleton {
  hip: Joint; neck: Joint; head: Joint;
  shoulderL: Joint; elbowL: Joint; handL: Joint;
  shoulderR: Joint; elbowR: Joint; handR: Joint;
  kneeL: Joint; footL: Joint; kneeR: Joint; footR: Joint;
  handRAngle: number; handLAngle: number;
}

const ext = (p: Joint, ang: number, len: number): Joint => ({
  x: p.x + Math.cos(ang) * len,
  y: p.y + Math.sin(ang) * len,
});

export function buildSkeleton(ps: Pose, scale = 1): Skeleton {
  const s = scale;
  const hip: Joint = { x: 0, y: (SEG.hipBase + ps.hipY + ps.bob) * s };
  const neck = ext(hip, ps.torso, SEG.torso * s * ps.squash);
  const head = ext(neck, ps.head, SEG.neck * s);
  const shoulderBase = ext(neck, ps.torso + Math.PI, 4 * s);
  const shoulderL: Joint = { x: shoulderBase.x - 3 * s, y: shoulderBase.y };
  const shoulderR: Joint = { x: shoulderBase.x + 3 * s, y: shoulderBase.y };
  const elbowL = ext(shoulderL, ps.armLA, SEG.upperArm * s);
  const handL = ext(elbowL, ps.armLB, SEG.foreArm * s);
  const elbowR = ext(shoulderR, ps.armRA, SEG.upperArm * s);
  const handR = ext(elbowR, ps.armRB, SEG.foreArm * s);
  const kneeL = ext(hip, ps.legLA, SEG.thigh * s);
  const footL = ext(kneeL, ps.legLB, SEG.shin * s);
  const kneeR = ext(hip, ps.legRA, SEG.thigh * s);
  const footR = ext(kneeR, ps.legRB, SEG.shin * s);
  return {
    hip, neck, head, shoulderL, elbowL, handL, shoulderR, elbowR, handR,
    kneeL, footL, kneeR, footR,
    handRAngle: ps.armRB, handLAngle: ps.armLB,
  };
}

/* --------------------------------------------------------------- drawing */

export interface RigStyle {
  body: number;
  eye: number;
  outline: number;
  equipment: Partial<Record<string, EquipmentDef>>;
  scale: number;
  alpha: number;
  contrast?: ContrastStyle;
  fighterId?: string;
  time?: number;
}

type G = Phaser.GameObjects.Graphics;

export function drawFighter(g: G, sk: Skeleton, style: RigStyle, weapon: WeaponDef | null, flashT = 0): void {
  drawShadowWarrior(g, sk, style, weapon, flashT);
}

/** Draws a detailed weapon anchored to a hand joint, rotated with the forearm. */
export function drawWeapon(g: G, hand: Joint, angle: number, w: WeaponDef, s: number, alpha: number, time = 0): void {
  drawWeaponArt(g, hand, angle, w, s, alpha, time);
}

/** World-space tip of the equipped weapon, used for trails and VFX anchors. */
export function weaponTip(sk: Skeleton, w: WeaponDef | null, scale: number): Joint {
  const len = w && w.shape !== 'none' ? w.length * scale : 10 * scale;
  return ext(sk.handR, sk.handRAngle, len);
}

export function shade(color: number, k: number): number {
  const r = Math.min(255, Math.round(((color >> 16) & 0xff) * k));
  const g = Math.min(255, Math.round(((color >> 8) & 0xff) * k));
  const b = Math.min(255, Math.round((color & 0xff) * k));
  return (r << 16) | (g << 8) | b;
}

export function mixColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}
