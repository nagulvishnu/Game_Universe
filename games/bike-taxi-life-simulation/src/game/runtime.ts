import { create } from 'zustand';

/** Mutable per-frame runtime state (NOT React state). Persisted values are synced to the store periodically. */
export interface BikeRT { id: string | null; x: number; z: number; heading: number; speed: number; steer: number; lean: number; pitch: number; yawRate: number; slide: boolean; fallenT: number; bounce: number; indicator: 0 | 1 | 2 }
export const rt = {
  mode: 'walk' as 'walk' | 'ride' | 'fallen',
  walk: { x: 0, z: 0, heading: 0, speed: 0, stride: 0 },
  bike: { id: null, x: 0, z: 0, heading: 0, speed: 0, steer: 0, lean: 0, pitch: 0, yawRate: 0, slide: false, fallenT: 0, bounce: 0, indicator: 0 } as BikeRT,
  int: { x: 0, z: 0, heading: 0, speed: 0, stride: 0 },
  keys: new Set<string>(),
  camera: 'third' as 'third' | 'first',
  camDist: 6.2, camYaw: 0, camYawOff: 0,
  clockPartial: 0, // game minutes since last store tick
  headlights: true,
  horn: false,
  target: null as { x: number; z: number; kind: 'pickup' | 'dest' | 'poi' } | null,
  route: null as [number, number][] | null,
  routeKey: '',
  nearPrompt: null as string | null,
  nearAction: null as null | (() => void),
  tel: { distanceM: 0, elapsedSec: 0, collisions: 0, hardEvents: 0, speedingSec: 0 },
  lastIx: '' as string,
  cooldowns: {} as Record<string, number>,
  rainLevel: 0, wet: 0, lightning: 0, night: 0,
  passengerBoarded: false,
  traffic: [] as TrafficVehicle[],
  peds: [] as Ped[],
  simTimeSec: 0,
  shake: 0,
  mapOpen: false,
};

export interface TrafficVehicle {
  id: number; kind: 'car' | 'bus' | 'auto' | 'bike' | 'truck' | 'taxi' | 'police';
  x: number; z: number; heading: number; speed: number;
  a: number; b: number; s: number; len: number; color: string; maxV: number; lane: number; hit: number; blockedT: number; overtake: number; wid: number;
}
export interface Ped { id: number; a: number; b: number; s: number; side: number; sideNow: number; speed: number; x: number; z: number; heading: number; hidden: number; shirt: string; kind: string; phase: number; alive: number }

export interface HudState {
  speedKmh: number; fuel: number; cond: number; prompt: string | null; mode: string; signal: string; district: string; gear: number;
  distToTarget: number | null; offerLeft: number; waiting: string | null; headlights: boolean; wet: number; lowGrip: boolean; indicator: number;
}
export const useHud = create<HudState>(() => ({
  speedKmh: 0, fuel: 1, cond: 100, prompt: null, mode: 'walk', signal: '', district: '', gear: 1, distToTarget: null, offerLeft: 0, waiting: null,
  headlights: true, wet: 0, lowGrip: false, indicator: 0,
}));
