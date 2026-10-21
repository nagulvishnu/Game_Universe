import * as THREE from 'three';
import type { GameAudio, VoiceMode } from './audio';
import {
  findPath,
  floorAt,
  groundY,
  nearestNode,
  nodeById,
  NAV_NODES,
  resolveCircle,
  segmentBlocked,
  type Floor,
} from './layout';
import type { HideRT, World } from './world';
import { getTexture } from './textures';

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const wrapPI = (a: number) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};

// ============================================================================ MODEL
export interface AnimParams {
  speed: number;
  running: boolean;
  stun: boolean;
  attackT: number; // 0..1 (<0 = not attacking)
  look: number; // -1..1 head yaw scanning
  time: number;
}

export class GrannyModel {
  group = new THREE.Group();
  private torso = new THREE.Group();
  private head = new THREE.Group();
  private legL = new THREE.Group();
  private legR = new THREE.Group();
  private armL = new THREE.Group();
  private armR = new THREE.Group();
  private foreL = new THREE.Group();
  private foreR = new THREE.Group();
  private eyeMat: THREE.MeshStandardMaterial;
  private phase = 0;
  private prevSign = 1;
  stepEvent = false;

  constructor() {
    const skinTex = getTexture('granny_skin');
    const dressTex = getTexture('granny_dress').clone();
    dressTex.repeat.set(3, 2);
    dressTex.needsUpdate = true;
    const skin = new THREE.MeshStandardMaterial({ map: skinTex, roughness: 0.85 });
    const dress = new THREE.MeshStandardMaterial({ map: dressTex, roughness: 0.95 });
    const cardi = new THREE.MeshStandardMaterial({ color: 0x2f3a32, roughness: 1 });
    const hair = new THREE.MeshStandardMaterial({ color: 0xc9c9c0, roughness: 0.9 });
    const shoe = new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: 0.6 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x0c0606, roughness: 0.9 });
    const white = new THREE.MeshStandardMaterial({ color: 0xe6e2cc, roughness: 0.4 });
    this.eyeMat = new THREE.MeshStandardMaterial({ color: 0xe6e2cc, roughness: 0.3, emissive: 0xff1a00, emissiveIntensity: 0 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.8 });
    const metal = new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 0.4, metalness: 0.8 });

    const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      parent.add(m);
      return m;
    };

    // legs
    for (const [leg, side] of [
      [this.legL, -1],
      [this.legR, 1],
    ] as [THREE.Group, number][]) {
      leg.position.set(side * 0.1, 0.84, 0);
      add(leg, new THREE.CylinderGeometry(0.042, 0.032, 0.78, 8), skin, 0, -0.39, 0);
      add(leg, new THREE.BoxGeometry(0.1, 0.07, 0.23), shoe, 0, -0.81, 0.05);
      this.group.add(leg);
    }

    // torso
    this.torso.position.set(0, 0.84, 0);
    this.group.add(this.torso);
    add(this.torso, new THREE.CylinderGeometry(0.2, 0.37, 0.56, 16), dress, 0, -0.25, 0);
    const chest = add(this.torso, new THREE.SphereGeometry(0.19, 14, 10), cardi, 0, 0.3, 0);
    chest.scale.set(1.0, 1.12, 0.72);
    const belly = add(this.torso, new THREE.SphereGeometry(0.16, 12, 8), dress, 0, 0.08, 0.02);
    belly.scale.set(1.0, 1.1, 0.85);
    const hump = add(this.torso, new THREE.SphereGeometry(0.12, 10, 8), cardi, 0, 0.46, -0.1);
    hump.scale.set(1.1, 0.9, 0.9);

    // arms
    for (const [arm, fore, side] of [
      [this.armL, this.foreL, -1],
      [this.armR, this.foreR, 1],
    ] as [THREE.Group, THREE.Group, number][]) {
      arm.position.set(side * 0.24, 0.46, 0);
      add(arm, new THREE.SphereGeometry(0.06, 8, 6), cardi, 0, 0, 0);
      add(arm, new THREE.CylinderGeometry(0.04, 0.035, 0.28, 8), cardi, 0, -0.14, 0);
      fore.position.set(0, -0.28, 0);
      add(fore, new THREE.CylinderGeometry(0.034, 0.03, 0.26, 8), cardi, 0, -0.13, 0);
      add(fore, new THREE.SphereGeometry(0.042, 8, 6), skin, 0, -0.28, 0);
      arm.add(fore);
      this.torso.add(arm);
    }
    // baseball bat with nails
    const bat = new THREE.Group();
    bat.position.set(0, -0.28, 0.02);
    bat.rotation.x = 1.15;
    add(bat, new THREE.CylinderGeometry(0.036, 0.016, 0.85, 8), wood, 0, 0.3, 0);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + i;
      const n = add(bat, new THREE.ConeGeometry(0.008, 0.06, 4), metal, Math.cos(a) * 0.04, 0.5 + (i % 3) * 0.06, Math.sin(a) * 0.04);
      n.rotation.z = -Math.cos(a) * Math.PI * 0.5;
      n.rotation.x = Math.sin(a) * Math.PI * 0.5;
    }
    this.foreR.add(bat);

    // head
    this.head.position.set(0, 0.66, 0.1);
    this.torso.add(this.head);
    add(this.head, new THREE.CylinderGeometry(0.04, 0.05, 0.1, 8), skin, 0, 0.0, -0.02);
    const skull = add(this.head, new THREE.SphereGeometry(0.145, 18, 14), skin, 0, 0.15, 0.02);
    skull.scale.set(0.9, 1.15, 1.0);
    const dome = add(this.head, new THREE.SphereGeometry(0.155, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), hair, 0, 0.18, -0.01);
    dome.rotation.x = -0.4;
    dome.scale.set(1.02, 1.15, 1.05);
    add(this.head, new THREE.SphereGeometry(0.07, 10, 8), hair, 0, 0.27, -0.12);
    for (const s of [-1, 1]) {
      add(this.head, new THREE.SphereGeometry(0.042, 8, 6), dark, s * 0.052, 0.18, 0.112);
      add(this.head, this.eyeGeo(), this.eyeMat, s * 0.052, 0.18, 0.128);
      add(this.head, new THREE.SphereGeometry(0.013, 6, 6), dark, s * 0.052, 0.18, 0.156);
      const brow = add(this.head, new THREE.BoxGeometry(0.058, 0.012, 0.014), dark, s * 0.052, 0.213, 0.118);
      brow.rotation.z = s * -0.35;
      add(this.head, new THREE.SphereGeometry(0.02, 6, 6), skin, s * 0.1, 0.13, 0.0).scale.set(0.5, 1, 0.8);
    }
    const nose = add(this.head, new THREE.ConeGeometry(0.022, 0.1, 6), skin, 0, 0.115, 0.145);
    nose.rotation.x = Math.PI / 2 + 0.45;
    add(this.head, new THREE.BoxGeometry(0.075, 0.014, 0.014), dark, 0, 0.055, 0.12);
    for (let i = 0; i < 5; i++) add(this.head, new THREE.BoxGeometry(0.008, 0.014, 0.008), white, -0.025 + i * 0.0125, 0.045, 0.122);
    // jaw / chin
    const chin = add(this.head, new THREE.SphereGeometry(0.04, 8, 6), skin, 0, 0.03, 0.1);
    chin.scale.set(1, 0.8, 0.9);

    this.group.scale.setScalar(1.0);
  }

  private eyeGeo() {
    return new THREE.SphereGeometry(0.03, 10, 8);
  }

  setRage(v: number) {
    this.eyeMat.emissiveIntensity = v * 2.2;
  }

  update(dt: number, p: AnimParams) {
    const sp = p.speed;
    const run = p.running ? 1 : 0;
    this.phase += dt * sp * (p.running ? 2.4 : 3.1);
    const s = Math.sin(this.phase);
    const amp = clamp(sp / 1.8, 0, 1);
    this.legL.rotation.x = s * 0.6 * amp;
    this.legR.rotation.x = -s * 0.6 * amp;
    this.stepEvent = false;
    const sign = s >= 0 ? 1 : -1;
    if (sign !== this.prevSign && sp > 0.4) this.stepEvent = true;
    this.prevSign = sign;

    const lean = 0.16 + run * 0.22;
    this.torso.position.y = 0.84 + Math.abs(s) * 0.025 * amp;
    this.torso.rotation.x = lean;
    this.torso.rotation.z = s * 0.05 * amp;
    this.armL.rotation.x = -s * 0.7 * amp - 0.1;
    this.foreL.rotation.x = -0.3;
    this.armL.rotation.z = -0.1;
    this.armR.rotation.z = 0.1;

    if (p.attackT >= 0) {
      const t = p.attackT;
      const e = t < 0.4 ? -2.5 * (t / 0.4) : -2.5 + 3.6 * ((t - 0.4) / 0.6);
      this.armR.rotation.x = e;
      this.foreR.rotation.x = -0.2;
      this.torso.rotation.x = lean + (t > 0.4 ? 0.35 : -0.2);
    } else if (p.stun) {
      this.armL.rotation.x = -2.6;
      this.armR.rotation.x = -2.6;
      this.foreL.rotation.x = -1.2;
      this.foreR.rotation.x = -1.2;
      this.torso.rotation.x = -0.15;
    } else if (p.running) {
      this.armR.rotation.x = -1.9 + Math.sin(this.phase * 2) * 0.12;
      this.foreR.rotation.x = -0.4;
    } else {
      this.armR.rotation.x = s * 0.35 * amp - 0.5;
      this.foreR.rotation.x = -0.9;
    }

    this.head.rotation.y = p.stun ? Math.sin(p.time * 18) * 0.3 : p.look * 0.5;
    this.head.rotation.z = Math.sin(p.time * 0.7) * 0.07;
    this.head.rotation.x = -lean * 0.7 + (p.running ? 0.12 : 0);
  }
}

// ============================================================================ AI
export type GState = 'wander' | 'investigate' | 'chase' | 'search' | 'checkHide' | 'stunned' | 'catching';

export interface Noise {
  x: number;
  z: number;
  floor: Floor;
  radius: number;
}

export interface PlayerView {
  x: number;
  y: number;
  z: number;
  floor: Floor;
  hidden: boolean;
  hideIndex: number;
  crouch: boolean;
  flashlight: boolean;
  speed: number;
  seenHiding: boolean;
}

export interface GrannyEnv {
  player: PlayerView;
  hides: HideRT[];
  world: World;
  audio: GameAudio;
  noises: Noise[];
  onCatch: () => void;
}

interface Pt {
  x: number;
  z: number;
}

export class Granny {
  model = new GrannyModel();
  x = 0;
  z = 0;
  y = 0;
  floor: Floor = 0;
  yaw = 0;
  state: GState = 'wander';
  canSee = false;
  speedMul = 1;
  justSpotted = false;
  justStunned = false;

  private path: Pt[] = [];
  private pi = 0;
  private moving = false;
  private timer = 1;
  private repath = 0;
  private lastKnown = { x: 0, z: 0, floor: 0 as Floor };
  private sawT = 0;
  private searchT = 0;
  private windup = 0;
  private gruntCd = 0;
  private invDist = 99;
  private checkIdx = -1;
  private checkStage = 0;
  private checked = new Set<number>();
  private speedNow = 0;
  private stuckT = 0;
  private time = 0;
  private attackT = -1;
  private lookSeed = Math.random() * 10;
  private lastTarget: { x: number; z: number; floor: Floor } | null = null;
  private doorCd = 0;

  constructor(scene: THREE.Object3D) {
    scene.add(this.model.group);
  }

  reset(nodeId: string) {
    const n = nodeById(nodeId);
    this.x = n.x;
    this.z = n.z;
    this.floor = n.floor;
    this.y = groundY(n.x, n.z, n.floor);
    this.state = 'wander';
    this.path = [];
    this.moving = false;
    this.timer = 2;
    this.attackT = -1;
    this.windup = 0;
    this.sawT = 5;
    this.checked.clear();
    this.model.setRage(0);
    this.sync();
  }

  voiceMode(): VoiceMode {
    switch (this.state) {
      case 'chase':
        return 'rage';
      case 'investigate':
      case 'search':
      case 'checkHide':
        return 'mutter';
      case 'wander':
        return 'hum';
      default:
        return 'silent';
    }
  }

  stun(env: GrannyEnv) {
    if (this.state === 'catching') return;
    this.state = 'stunned';
    this.timer = 4.2;
    this.moving = false;
    this.justStunned = true;
    env.audio.grannyGrunt({ x: this.x, y: this.y + 1.4, z: this.z });
  }

  startCatch() {
    this.state = 'catching';
    this.attackT = 0;
    this.moving = false;
    this.speedNow = 0;
  }

  // ------------------------------------------------------------------ perception
  private checkSight(env: GrannyEnv): boolean {
    const P = env.player;
    if (P.hidden) return false;
    if (Math.abs(P.y - this.y) > 2.4) return false;
    const dx = P.x - this.x;
    const dz = P.z - this.z;
    const dist = Math.hypot(dx, dz);
    let vis = P.flashlight ? 17 : 9.5;
    if (P.crouch) vis *= 0.65;
    if (P.speed > 3.6) vis *= 1.25;
    if (this.state === 'chase') vis *= 1.35;
    if (dist > vis) return false;
    if (dist > 1.8) {
      const fx = Math.sin(this.yaw);
      const fz = Math.cos(this.yaw);
      const dot = (dx / dist) * fx + (dz / dist) * fz;
      if (dot < (this.state === 'chase' ? 0.0 : 0.38)) return false;
    }
    const floors: Floor[] = this.floor === P.floor ? [this.floor] : [this.floor, P.floor];
    return !segmentBlocked(this.x, this.z, P.x, P.z, floors, 0.04, 'sight');
  }

  private hear(n: Noise, env: GrannyEnv) {
    if (this.state === 'checkHide' && this.checkStage > 0) return;
    const dx = n.x - this.x;
    const dz = n.z - this.z;
    let d = Math.hypot(dx, dz);
    if (n.floor !== this.floor) d += 6;
    if (d > n.radius) return;
    if (this.state === 'investigate' && d > this.invDist * 1.15 && this.moving) return;
    this.state = 'investigate';
    this.invDist = d;
    this.lastKnown = { x: n.x, z: n.z, floor: n.floor };
    this.goTo(n.x, n.z, n.floor);
    this.timer = 0;
    if (this.gruntCd <= 0) {
      env.audio.grannyGrunt({ x: this.x, y: this.y + 1.4, z: this.z });
      this.gruntCd = 5;
    }
  }

  // ------------------------------------------------------------------ pathing
  private roomAllowed(room: string, env: GrannyEnv): boolean {
    if (room === 'study') return !env.world.doorById.get('g_study')?.locked;
    if (room === 'master') return !env.world.doorById.get('u_master')?.locked;
    return true;
  }

  private goTo(x: number, z: number, floor: Floor) {
    this.lastTarget = { x, z, floor };
    const a = nearestNode(this.x, this.z, this.floor);
    const b = nearestNode(x, z, floor);
    const ids = findPath(a.id, b.id);
    const path: Pt[] = ids.map((id) => {
      const n = nodeById(id);
      return { x: n.x, z: n.z };
    });
    const last = path[path.length - 1];
    if (!last || Math.hypot(last.x - x, last.z - z) > 0.35) {
      if (!last || !segmentBlocked(last.x, last.z, x, z, [floor], 0.25, 'path')) path.push({ x, z });
    }
    // smooth: skip nodes that are directly reachable
    while (path.length >= 2 && !segmentBlocked(this.x, this.z, path[1].x, path[1].z, this.floor === floor ? [this.floor] : [this.floor, floor], 0.28, 'path')) {
      path.shift();
    }
    this.path = path;
    this.pi = 0;
    this.moving = path.length > 0;
    this.stuckT = 0;
  }

  private pickWanderTarget(env: GrannyEnv) {
    const P = env.player;
    const allowed = NAV_NODES.filter((n) => this.roomAllowed(n.room, env) && !n.id.startsWith('gS'));
    let pick = allowed[Math.floor(Math.random() * allowed.length)];
    if (Math.random() < 0.4) {
      // hunt near the player
      const near = allowed
        .filter((n) => n.floor === P.floor)
        .sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z))
        .slice(0, 5);
      if (near.length) pick = near[Math.floor(Math.random() * near.length)];
    }
    this.goTo(pick.x, pick.z, pick.floor);
  }

  private follow(dt: number, speed: number, turn = 6): boolean {
    const wp = this.path[this.pi];
    if (!wp) {
      this.moving = false;
      return true;
    }
    const dx = wp.x - this.x;
    const dz = wp.z - this.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.22) {
      this.pi++;
      if (this.pi >= this.path.length) {
        this.moving = false;
        return true;
      }
      return false;
    }
    this.stepToward(wp.x, wp.z, speed, dt, turn);
    // stuck detection
    if (this.speedNow < speed * 0.2) {
      this.stuckT += dt;
      if (this.stuckT > 1.0) {
        this.stuckT = 0;
        if (this.pi < this.path.length - 1) this.pi++;
        else if (this.lastTarget) this.goTo(this.lastTarget.x, this.lastTarget.z, this.lastTarget.floor);
      }
    } else this.stuckT = 0;
    return false;
  }

  private stepToward(tx: number, tz: number, speed: number, dt: number, turn: number) {
    const dx = tx - this.x;
    const dz = tz - this.z;
    const d = Math.hypot(dx, dz);
    const px = this.x;
    const pz = this.z;
    if (d > 1e-4) {
      const step = Math.min(speed * dt, d);
      const desired = Math.atan2(dx, dz);
      const diff = wrapPI(desired - this.yaw);
      this.yaw = wrapPI(this.yaw + clamp(diff, -turn * dt, turn * dt));
      // slow while turning sharply
      const k = Math.abs(diff) > 1.2 ? 0.35 : 1;
      const nx = this.x + (dx / d) * step * k;
      const nz = this.z + (dz / d) * step * k;
      this.floor = floorAt(nx, nz, this.floor);
      const p = { x: nx, z: nz };
      resolveCircle(p, 0.3, this.floor);
      this.x = p.x;
      this.z = p.z;
    }
    this.speedNow = Math.hypot(this.x - px, this.z - pz) / Math.max(dt, 1e-4);
  }

  private faceToward(tx: number, tz: number, dt: number, turn = 5) {
    const diff = wrapPI(Math.atan2(tx - this.x, tz - this.z) - this.yaw);
    this.yaw = wrapPI(this.yaw + clamp(diff, -turn * dt, turn * dt));
  }

  // ------------------------------------------------------------------ state changes
  private beginChase(env: GrannyEnv) {
    const was = this.state;
    this.state = 'chase';
    this.moving = false;
    this.repath = 0;
    this.sawT = 0;
    this.checkIdx = -1;
    if (was !== 'chase') {
      this.windup = 0.5;
      this.justSpotted = true;
      env.audio.grannyShout({ x: this.x, y: this.y + 1.4, z: this.z });
    }
  }

  private beginCheckHide(env: GrannyEnv, idx: number, seen: boolean) {
    const h = env.hides[idx];
    if (!h) return;
    this.state = 'checkHide';
    this.checkIdx = idx;
    this.checkStage = 0;
    this.checked.add(idx);
    this.goTo(h.spot.checkX, h.spot.checkZ, h.spot.floor);
    if (seen) env.audio.grannyGrunt({ x: this.x, y: this.y + 1.4, z: this.z });
  }

  private beginSearch(center: { x: number; z: number; floor: Floor }, dur: number) {
    this.state = 'search';
    this.searchT = dur;
    this.checked.clear();
    this.lastKnown = center;
    this.goTo(center.x, center.z, center.floor);
    this.timer = 0;
  }

  // ------------------------------------------------------------------ main update
  update(dt: number, env: GrannyEnv) {
    this.time += dt;
    this.gruntCd -= dt;
    this.doorCd -= dt;
    const P = env.player;

    if (this.state === 'catching') {
      this.attackT = Math.min(1, this.attackT + dt * 1.8);
      this.speedNow = 0;
      this.sync();
      this.model.update(dt, { speed: 0, running: false, stun: false, attackT: this.attackT, look: 0, time: this.time });
      return;
    }

    // perception
    const sees = this.state === 'stunned' ? false : this.checkSight(env);
    this.canSee = sees;
    if (sees) this.sawT = 0;
    else this.sawT += dt;
    if (sees && this.state !== 'chase' && this.state !== 'stunned') this.beginChase(env);
    if (this.state !== 'chase' && this.state !== 'stunned') for (const n of env.noises) this.hear(n, env);
    if (P.seenHiding && P.hidden && this.state !== 'stunned' && this.state !== 'checkHide') this.beginCheckHide(env, P.hideIndex, true);

    const dayBoost = this.speedMul;

    switch (this.state) {
      case 'wander': {
        if (this.moving) {
          if (this.follow(dt, 1.55 * dayBoost)) this.timer = rand(1.5, 4);
        } else {
          this.timer -= dt;
          this.speedNow = 0;
          if (this.timer <= 0) this.pickWanderTarget(env);
        }
        break;
      }
      case 'investigate': {
        if (this.moving) {
          if (this.follow(dt, 2.2 * dayBoost)) this.timer = rand(2.5, 4.5);
        } else {
          this.timer -= dt;
          this.speedNow = 0;
          if (this.timer <= 0) {
            this.state = 'wander';
            this.timer = 0.5;
          }
        }
        break;
      }
      case 'search': {
        this.searchT -= dt;
        if (this.moving) {
          if (this.follow(dt, 2.3 * dayBoost)) this.timer = rand(1.0, 2.0);
        } else {
          this.timer -= dt;
          this.speedNow = 0;
          if (this.timer <= 0) {
            if (this.searchT <= 0) {
              this.state = 'wander';
              this.timer = 0.5;
            } else {
              // maybe peek into a nearby hiding spot
              let best = -1;
              let bd = 5.5;
              env.hides.forEach((h, i) => {
                if (h.spot.floor !== this.floor || this.checked.has(i)) return;
                const d = Math.hypot(h.spot.x - this.x, h.spot.z - this.z);
                if (d < bd) {
                  bd = d;
                  best = i;
                }
              });
              if (best >= 0 && Math.random() < 0.55) this.beginCheckHide(env, best, false);
              else {
                const nodes = NAV_NODES.filter(
                  (n) => n.floor === this.lastKnown.floor && Math.hypot(n.x - this.lastKnown.x, n.z - this.lastKnown.z) < 8 && this.roomAllowed(n.room, env),
                );
                const n = nodes[Math.floor(Math.random() * nodes.length)];
                if (n) this.goTo(n.x, n.z, n.floor);
                else this.timer = 1;
              }
            }
          }
        }
        break;
      }
      case 'checkHide': {
        const h = env.hides[this.checkIdx];
        if (!h) {
          this.state = 'wander';
          break;
        }
        if (this.checkStage === 0) {
          if (this.moving) {
            if (this.follow(dt, 2.6 * dayBoost)) {
              this.checkStage = 1;
              this.timer = 0.85;
              h.target = 1;
              env.audio.creak({ x: h.spot.x, y: this.y + 1, z: h.spot.z }, 1.2);
            }
          } else {
            this.checkStage = 1;
            this.timer = 0.85;
            h.target = 1;
          }
        } else if (this.checkStage === 1) {
          this.speedNow = 0;
          this.faceToward(h.spot.x, h.spot.z, dt, 8);
          this.timer -= dt;
          if (this.timer <= 0) {
            if (P.hidden && P.hideIndex === this.checkIdx) {
              env.onCatch();
            } else {
              this.checkStage = 2;
              this.timer = 0.7;
              h.target = 0;
            }
          }
        } else {
          this.speedNow = 0;
          this.timer -= dt;
          if (this.timer <= 0) {
            this.beginSearch({ x: this.x, z: this.z, floor: this.floor }, 9);
          }
        }
        break;
      }
      case 'stunned': {
        this.timer -= dt;
        this.speedNow = 0;
        if (this.timer <= 0) this.beginSearch({ x: P.x, z: P.z, floor: P.floor }, 14);
        break;
      }
      case 'chase': {
        if (this.windup > 0) {
          this.windup -= dt;
          this.speedNow = 0;
          this.faceToward(P.x, P.z, dt, 9);
          break;
        }
        if (sees) this.lastKnown = { x: P.x, z: P.z, floor: P.floor };
        const spd = 3.15 * Math.max(1, dayBoost);
        const tx = this.lastKnown.x;
        const tz = this.lastKnown.z;
        const sameFloor = this.lastKnown.floor === this.floor;
        const direct = sameFloor && !segmentBlocked(this.x, this.z, tx, tz, [this.floor], 0.3, 'path');
        if (direct) {
          this.moving = false;
          this.stepToward(tx, tz, spd, dt, 9);
        } else {
          this.repath -= dt;
          if (this.repath <= 0 || !this.moving) {
            this.goTo(tx, tz, this.lastKnown.floor);
            this.repath = 0.45;
          }
          this.follow(dt, spd, 9);
        }
        // reached last known spot without finding the player
        const atSpot = Math.hypot(tx - this.x, tz - this.z) < 0.9;
        const loseTime = P.speed > 3.6 ? 5.5 : 3.8;
        if (!sees && (this.sawT > loseTime || (atSpot && this.sawT > 1.2))) {
          this.beginSearch({ ...this.lastKnown }, 12);
          break;
        }
        const dist = Math.hypot(P.x - this.x, P.z - this.z);
        if (sees && dist < 1.3 && Math.abs(P.y - this.y) < 1.4 && !P.hidden) env.onCatch();
        break;
      }
    }

    this.applyDoors(env);
    this.animate(dt, env);
  }

  private applyDoors(env: GrannyEnv) {
    if (this.doorCd > 0 || this.state === 'stunned') return;
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    for (const d of env.world.doors) {
      if (d.def.front || d.def.floor !== this.floor) continue;
      if (d.target === 1 && d.open > 0.2) continue;
      const dx = d.cx - this.x;
      const dz = d.cz - this.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 1.5) continue;
      if (dist > 0.6 && (dx / dist) * fx + (dz / dist) * fz < 0.2) continue;
      if (d.target === 1) continue;
      env.world.openDoor(d.def.id, this.x, this.z);
      env.audio.doorOpen({ x: d.cx, y: d.fy + 1, z: d.cz });
      this.doorCd = 0.25;
    }
  }

  private animate(dt: number, env: GrannyEnv) {
    const target = groundY(this.x, this.z, this.floor);
    this.y += (target - this.y) * Math.min(1, dt * 14);
    const running = this.state === 'chase' && this.windup <= 0;
    let look = 0;
    if (!running && this.speedNow < 0.3 && this.state !== 'checkHide') look = Math.sin(this.time * 0.9 + this.lookSeed) * 0.9 + Math.sin(this.time * 2.3) * 0.15;
    else if (this.state === 'search' || this.state === 'investigate') look = Math.sin(this.time * 1.4 + this.lookSeed) * 0.5;
    this.sync();
    this.model.setRage(this.state === 'chase' ? 1 : this.state === 'investigate' ? 0.15 : 0);
    this.model.update(dt, {
      speed: this.speedNow,
      running,
      stun: this.state === 'stunned',
      attackT: -1,
      look,
      time: this.time,
    });
    if (this.model.stepEvent) env.audio.grannyStep({ x: this.x, y: this.y + 0.1, z: this.z });
  }

  private sync() {
    this.model.group.position.set(this.x, this.y, this.z);
    this.model.group.rotation.y = this.yaw;
  }
}
