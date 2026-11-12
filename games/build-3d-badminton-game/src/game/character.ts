// Lightweight stylized animated player: procedural idle/ready/run/sprint/lunge/jump/swing/victory/defeat.
import * as THREE from 'three';
import { COLORS, Look, RACKETS } from './storage';
import type { SimPlayer, ShuttleState } from './sim';

const SKINS = ['#f1c9a5', '#d9a577', '#a9744f', '#7a4b2e'];
const HAIR = ['#1a1a1f', '#3b2314', '#d6a24a', '#7c2d12', '#e5e7eb'];

const G = {
  torso: new THREE.CapsuleGeometry(0.19, 0.38, 4, 10),
  shorts: new THREE.CylinderGeometry(0.2, 0.22, 0.24, 10),
  head: new THREE.SphereGeometry(0.15, 14, 10),
  hair: new THREE.SphereGeometry(0.162, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
  leg: new THREE.CylinderGeometry(0.075, 0.062, 0.78, 8),
  shoe: new THREE.BoxGeometry(0.13, 0.08, 0.26),
  arm: new THREE.CylinderGeometry(0.055, 0.045, 0.6, 8),
  hand: new THREE.SphereGeometry(0.06, 8, 6),
  handle: new THREE.CylinderGeometry(0.016, 0.016, 0.3, 6),
  ring: new THREE.TorusGeometry(0.105, 0.012, 6, 20),
  strings: new THREE.CircleGeometry(0.105, 16),
  band: new THREE.CylinderGeometry(0.205, 0.205, 0.07, 10),
  stripe: new THREE.CylinderGeometry(0.196, 0.196, 0.09, 12, 1, true),
};

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).normalize();
const DOWN = new THREE.Vector3(0, -1, 0);
const ease = (u: number) => { const c = Math.max(0, Math.min(1, u)); return c * c * (3 - 2 * c); };

type Pose = { wind: THREE.Vector3; follow: THREE.Vector3; twist: number };
const POSES: Record<string, Pose> = {
  overhead: { wind: V(0.25, 0.8, 0.9), follow: V(-0.45, -0.55, -0.9), twist: 0.7 },
  jump: { wind: V(0.3, 0.9, 0.8), follow: V(-0.5, -0.7, -0.9), twist: 0.8 },
  side: { wind: V(1, -0.1, 0.6), follow: V(-0.7, -0.2, -0.8), twist: 0.9 },
  under: { wind: V(0.3, -0.7, 0.7), follow: V(-0.1, 0.5, -1), twist: 0.2 },
  back: { wind: V(-0.9, -0.3, -0.2), follow: V(0.9, 0.2, -0.6), twist: -0.8 },
  serve: { wind: V(0.25, -0.9, 0.35), follow: V(0, 0.5, -1), twist: 0.15 },
};
const READY = V(0.25, 0.25, -1);

export class Character {
  root = new THREE.Group();
  hips = new THREE.Group();
  spine = new THREE.Group();
  legL = new THREE.Group();
  legR = new THREE.Group();
  armL = new THREE.Group();
  armR = new THREE.Group();
  racket = new THREE.Group();
  private mats: Record<string, THREE.MeshLambertMaterial>;
  private armLmat: THREE.MeshLambertMaterial[] = [];
  private armRmat: THREE.MeshLambertMaterial[] = [];
  private stripe: THREE.Mesh;
  private band: THREE.Mesh;
  private hairM: THREE.Mesh;
  private frameMat = new THREE.MeshLambertMaterial({ color: '#fff' });
  private stringMat = new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: 0.4, side: THREE.DoubleSide });
  private runPh = 0;
  private dirR = READY.clone();
  private dirL = V(-0.3, -0.5, -0.8);
  private lean = new THREE.Vector2();
  private hipY = 0.9;
  private t = Math.random() * 10;
  private tmp = new THREE.Vector3();
  private q = new THREE.Quaternion();
  private lookKey = '';
  bobTime = 0;

  constructor() {
    const m = (c: string) => new THREE.MeshLambertMaterial({ color: c });
    this.mats = { shirt: m('#fff'), shorts: m('#222'), skin: m('#f1c9a5'), hair: m('#222'), shoe: m('#fafafa'), trim: m('#fff') };
    const { shirt, shorts, skin, hair, shoe, trim } = this.mats;
    this.root.add(this.hips);
    this.hips.position.y = 0.9;
    const torso = new THREE.Mesh(G.torso, shirt); torso.position.y = 0.34;
    const sh = new THREE.Mesh(G.shorts, shorts); sh.position.y = -0.02;
    const head = new THREE.Mesh(G.head, skin); head.position.y = 0.86;
    this.hairM = new THREE.Mesh(G.hair, hair); this.hairM.position.y = 0.89;
    this.stripe = new THREE.Mesh(G.stripe, trim); this.stripe.position.y = 0.34;
    this.band = new THREE.Mesh(G.band, trim); this.band.position.y = 0.88; this.band.scale.set(0.8, 0.4, 0.8);
    this.spine.add(torso, sh, head, this.hairM, this.stripe, this.band);
    this.hips.add(this.spine);
    for (const [leg, sx] of [[this.legL, -1], [this.legR, 1]] as [THREE.Group, number][]) {
      leg.position.set(sx * 0.1, 0, 0);
      const l = new THREE.Mesh(G.leg, skin); l.position.y = -0.39;
      const s = new THREE.Mesh(G.shoe, shoe); s.position.set(0, -0.78, -0.05);
      leg.add(l, s);
      this.hips.add(leg);
    }
    for (const [arm, sx, store] of [[this.armL, -1, this.armLmat], [this.armR, 1, this.armRmat]] as [THREE.Group, number, THREE.MeshLambertMaterial[]][]) {
      arm.position.set(sx * 0.26, 0.58, 0);
      const mat = shirt.clone();
      store.push(mat);
      const a = new THREE.Mesh(G.arm, mat); a.position.y = -0.3;
      const h = new THREE.Mesh(G.hand, skin); h.position.y = -0.62;
      arm.add(a, h);
      this.spine.add(arm);
    }
    // racket
    const handle = new THREE.Mesh(G.handle, new THREE.MeshLambertMaterial({ color: '#222' })); handle.position.y = -0.15;
    const ring = new THREE.Mesh(G.ring, this.frameMat); ring.position.y = -0.46; ring.scale.set(1, 1.3, 1);
    const strings = new THREE.Mesh(G.strings, this.stringMat); strings.position.y = -0.46; strings.scale.set(1, 1.3, 1);
    this.racket.add(handle, ring, strings);
    this.racket.position.y = -0.6;
    this.armR.add(this.racket);
  }

  setLook(look: Look, idx: number) {
    const key = JSON.stringify(look) + idx;
    if (key === this.lookKey) return;
    this.lookKey = key;
    const col = COLORS[look.color % COLORS.length];
    const c = new THREE.Color(col);
    const dark = c.clone().multiplyScalar(0.25);
    this.mats.shirt.color.copy(c);
    this.mats.shorts.color.set(look.outfit === 3 ? '#15151c' : '#' + dark.getHexString());
    this.mats.skin.color.set(SKINS[(idx + look.color) % SKINS.length]);
    this.mats.hair.color.set(HAIR[(idx * 2 + look.color) % HAIR.length]);
    this.mats.trim.color.set(look.outfit === 1 ? '#ffffff' : '#ffffff');
    this.stripe.visible = look.outfit === 1;
    this.band.visible = look.outfit === 3;
    this.mats.trim.color.set(look.outfit === 1 ? '#ffffff' : '#ffd23f');
    const armColor = look.outfit === 2 ? new THREE.Color(this.mats.skin.color) : look.outfit === 3 ? new THREE.Color('#15151c') : c;
    for (const m of [...this.armLmat, ...this.armRmat]) m.color.copy(armColor);
    const r = RACKETS[look.racket % RACKETS.length];
    this.frameMat.color.set(r.frame);
    this.stringMat.color.set(r.string);
  }

  private aimDir(p: SimPlayer, sh: ShuttleState, out: THREE.Vector3) {
    const yaw = this.root.rotation.y;
    const dx = sh.x - p.x, dz = sh.z - p.z;
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const lx = dx * c - dz * s - 0.26;
    const lz = dx * s + dz * c;
    const ly = sh.y - (this.hipY + 0.58 + p.y);
    return out.set(lx, ly, lz).normalize();
  }

  update(p: SimPlayer, sh: ShuttleState, dt: number, time: number) {
    this.t += dt;
    const r = this.root;
    r.position.set(p.x, 0, p.z);
    r.rotation.y = (p.side === 1 ? 0 : Math.PI) + p.aimLook * (p.side === 1 ? -1 : -1) * 0.6;
    // local velocity
    const yaw = r.rotation.y;
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const lvx = p.vx * c - p.vz * s, lvz = p.vx * s + p.vz * c;
    const speed = Math.hypot(p.vx, p.vz);
    this.runPh += dt * (3 + speed * 1.7);
    const sw = p.swing;
    const airborne = !p.grounded;

    // body targets
    let crouch = 0.07 + Math.min(0.1, speed * 0.015);
    let spinePitch = -Math.max(0, -lvz) * 0.045 + Math.max(0, lvz) * 0.02;
    let spineRoll = -lvx * 0.03;
    let spineYaw = 0;
    let legAmp = Math.min(0.95, speed * 0.16);
    let legFrontL = 0, legFrontR = 0;
    let dirTargetR = READY.clone();
    let dirTargetL = V(-0.3, -0.5, -0.8);
    let armLerp = 14;
    let bounce = 0;
    let wristT = 0;

    if (p.mood === 'win') {
      bounce = Math.abs(Math.sin(time * 6)) * 0.18;
      dirTargetR = V(0.2, 1, 0.1); dirTargetL = V(-0.2, 1, 0.1);
      legAmp = 0; crouch = 0.05;
    } else if (p.mood === 'lose') {
      spinePitch = -0.35; crouch = 0.12; legAmp = Math.min(legAmp, 0.3);
      dirTargetR = V(0.1, -1, 0.1); dirTargetL = V(-0.1, -1, 0.1);
      this.dirR.lerp(dirTargetR, 0.05);
    } else {
      // running arm swing for non-racket arm
      if (speed > 0.5) dirTargetL = V(-0.3, -0.8, Math.sin(this.runPh) * 0.7 * Math.min(1, speed / 4));
      if (speed > 3) dirTargetR = V(0.25, 0.1 - Math.min(0.5, speed * 0.05), -0.9 + Math.sin(this.runPh + 3) * 0.2);
    }
    if (p.lunge || (sw && sw.lunge)) {
      crouch = 0.32; legFrontR = 1.0; legFrontL = -0.5; spinePitch = -0.35; legAmp = 0;
    }
    if (airborne) {
      crouch = -0.02; legAmp = 0; legFrontL = -0.45; legFrontR = 0.25;
      if (!sw) { dirTargetR = V(0.3, 0.9, 0.6); dirTargetL = V(-0.3, 0.8, -0.4); }
    }
    if (sw) {
      const pose = POSES[sw.anim];
      const u = sw.t / sw.contactT;
      const aim = this.aimDir(p, sh, this.tmp);
      const hitDir = aim.clone();
      if (!(sh.active || sh.held) || hitDir.lengthSq() < 0.5) hitDir.copy(pose.follow).lerp(pose.wind, 0.3).normalize();
      if (u < 0.55) dirTargetR = READY.clone().lerp(pose.wind, ease(u / 0.55)).normalize();
      else if (u < 1) dirTargetR = pose.wind.clone().lerp(hitDir, ease((u - 0.55) / 0.45)).normalize();
      else {
        const f = ease(((sw.t - sw.contactT) / Math.max(0.05, sw.dur - sw.contactT)) * 1.4);
        dirTargetR = hitDir.clone().lerp(pose.follow, f).normalize();
      }
      armLerp = 40;
      const tw = u < 1 ? -ease(u) * pose.twist : -pose.twist + ease((sw.t - sw.contactT) / 0.25) * pose.twist * 2;
      spineYaw = tw * 0.6;
      if (sw.anim === 'overhead' || sw.anim === 'jump') {
        dirTargetL = u < 1 ? V(-0.3, 0.9, -0.4) : V(-0.7, -0.2, -0.5);
        spinePitch += u < 1 ? 0.25 * ease(u) : -0.3;
      }
      if (sw.anim === 'serve') { dirTargetL = V(-0.1, 0.5, -0.9); crouch = 0.08; }
      wristT = 0;
    }
    // smoothing
    const k = 1 - Math.exp(-armLerp * dt);
    if (p.mood !== 'lose') this.dirR.lerp(dirTargetR, k).normalize();
    this.dirL.lerp(dirTargetL, 1 - Math.exp(-14 * dt)).normalize();
    this.q.setFromUnitVectors(DOWN, this.dirR);
    this.armR.quaternion.copy(this.q);
    this.q.setFromUnitVectors(DOWN, this.dirL);
    this.armL.quaternion.copy(this.q);
    // wrist: keep strings facing forward-ish
    const pitch = Math.atan2(-this.dirR.z, -this.dirR.y);
    this.racket.rotation.set(-pitch * 0.55 + wristT, 0, 0);

    this.lean.x += (spinePitch - this.lean.x) * Math.min(1, dt * 9);
    this.lean.y += (spineRoll - this.lean.y) * Math.min(1, dt * 9);
    this.spine.rotation.set(this.lean.x, spineYaw, this.lean.y);
    const breathe = Math.sin(this.t * 2.2) * 0.008;
    const targetHip = 0.9 - crouch + breathe;
    this.hipY += (targetHip - this.hipY) * Math.min(1, dt * 16);
    this.hips.position.y = this.hipY + p.y + bounce;
    const sc = Math.max(0.55, (this.hipY) / 0.9);
    this.legL.scale.y = this.legR.scale.y = sc;
    const ph = Math.sin(this.runPh) * legAmp;
    const wide = 0.12 + Math.abs(lvx) * 0.02;
    this.legL.rotation.set(ph + legFrontL, 0, wide);
    this.legR.rotation.set(-ph + legFrontR, 0, -wide);
    this.bobTime = this.t;
  }
}
