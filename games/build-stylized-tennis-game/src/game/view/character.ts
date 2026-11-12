import * as THREE from 'three';
import { FX_COLORS, SKIN_TONES, type Look } from '../constants';
import type { Player, Mode } from '../sim';
import { radialTexture } from './fx';

interface Pose {
  tw: number;
  rx: number;
  rz: number;
  lx: number;
  lz: number;
  lean: number;
}
const READY: Pose = { tw: 0, rx: -0.55, rz: -0.35, lx: -0.55, lz: 0.35, lean: 0.12 };
const P = (tw: number, rx: number, rz: number, lx: number, lz: number, lean: number): Pose => ({ tw, rx, rz, lx, lz, lean });
const KF: Record<Mode, [number, Pose][]> = {
  fh: [[0, READY], [0.12, P(-0.85, 0.5, -1.2, -1.2, 0.9, 0.1)], [0.22, P(0.35, -1.25, -0.45, -0.6, 1.3, 0.2)], [0.42, P(1.0, -1.5, 0.85, -0.3, 0.9, 0.15)], [1, READY]],
  bh: [[0, READY], [0.12, P(0.9, -0.5, 0.95, -0.5, 0.25, 0.1)], [0.22, P(-0.25, -1.25, -0.1, -0.7, 0.2, 0.2)], [0.42, P(-1.05, -1.0, -1.3, -0.6, 0.3, 0.15)], [1, READY]],
  volley: [[0, READY], [0.1, P(-0.25, -0.5, -0.7, -0.8, 0.5, 0.15)], [0.22, P(0.15, -1.35, -0.2, -0.8, 0.6, 0.25)], [0.45, P(0.2, -1.1, -0.15, -0.7, 0.5, 0.2)], [1, READY]],
  smash: [[0, READY], [0.12, P(-0.55, -2.4, -0.5, -2.7, 0.4, -0.1)], [0.24, P(0.2, -3.0, -0.15, -1.6, 0.6, 0.15)], [0.45, P(0.5, -1.0, 0.1, -0.6, 0.6, 0.55)], [1, READY]],
  serve: [[0, P(0, -0.5, -0.9, -2.9, 0.15, -0.12)], [0.1, P(-0.4, 1.1, -1.1, -2.9, 0.15, -0.2)], [0.19, P(0.2, -3.0, -0.2, -1.4, 0.6, 0.1)], [0.42, P(0.5, -0.9, 0.1, -0.6, 0.6, 0.55)], [1, READY]],
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => t * t * (3 - 2 * t);
function samplePose(kind: Mode, u: number): Pose {
  const k = KF[kind];
  for (let i = 1; i < k.length; i++) {
    if (u <= k[i][0]) {
      const [u0, a] = k[i - 1];
      const [u1, b] = k[i];
      const t = ease((u - u0) / (u1 - u0));
      return { tw: lerp(a.tw, b.tw, t), rx: lerp(a.rx, b.rx, t), rz: lerp(a.rz, b.rz, t), lx: lerp(a.lx, b.lx, t), lz: lerp(a.lz, b.lz, t), lean: lerp(a.lean, b.lean, t) };
    }
  }
  return READY;
}

const geoCache = {
  limb: new THREE.CapsuleGeometry(0.075, 0.46, 3, 8),
  arm: new THREE.CapsuleGeometry(0.06, 0.44, 3, 8),
  torso: new THREE.CapsuleGeometry(0.25, 0.36, 4, 12),
  head: new THREE.SphereGeometry(0.2, 16, 12),
  shoe: new THREE.SphereGeometry(0.1, 10, 8),
  shorts: new THREE.CylinderGeometry(0.27, 0.3, 0.3, 12),
  cap: new THREE.SphereGeometry(0.215, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
  visor: new THREE.BoxGeometry(0.34, 0.025, 0.2),
  band: new THREE.TorusGeometry(0.205, 0.028, 6, 18),
  handle: new THREE.CylinderGeometry(0.028, 0.032, 0.3, 8),
  frame: new THREE.TorusGeometry(0.17, 0.017, 6, 22),
  strings: new THREE.CircleGeometry(0.16, 16),
  hand: new THREE.SphereGeometry(0.065, 8, 6),
};
const tagCache = new Map<string, THREE.CanvasTexture>();
function tagTexture(text: string, color: number) {
  const key = text + color;
  let t = tagCache.get(key);
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(8,10,24,0.72)';
  g.beginPath();
  g.roundRect(8, 8, 240, 48, 24);
  g.fill();
  g.strokeStyle = '#' + color.toString(16).padStart(6, '0');
  g.lineWidth = 4;
  g.stroke();
  g.fillStyle = '#fff';
  g.font = 'bold 28px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text.slice(0, 12).toUpperCase(), 128, 34);
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  tagCache.set(key, t);
  return t;
}

export class Character {
  readonly root = new THREE.Group();
  private body = new THREE.Group(); // lean / bob
  private torso = new THREE.Group();
  private head = new THREE.Group();
  private armR = new THREE.Group();
  private armL = new THREE.Group();
  private legR = new THREE.Group();
  private legL = new THREE.Group();
  private rackets: THREE.Group;
  private glow: THREE.Sprite;
  private tag: THREE.Sprite;
  private dynamic: THREE.Object3D[] = [];
  private ph = Math.random() * 6;
  private flashV = 0;
  private flashColor = 0xffffff;
  private blend = 0;
  lookKey = '';

  constructor(look: Look, name: string, tagColor: number, showTag: boolean) {
    this.rackets = new THREE.Group();
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture(0, true), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    this.glow.scale.set(0.9, 0.9, 1);
    this.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tagTexture(name, tagColor), transparent: true, depthWrite: false, depthTest: false }));
    this.tag.scale.set(1.5, 0.375, 1);
    this.tag.position.y = 2.35;
    this.tag.renderOrder = 10;
    this.tag.visible = showTag;
    this.build(look);
  }

  private build(look: Look) {
    for (const o of this.dynamic) this.root.remove(o);
    this.root.clear();
    this.body = new THREE.Group();
    this.torso = new THREE.Group();
    this.head = new THREE.Group();
    this.armR = new THREE.Group();
    this.armL = new THREE.Group();
    this.legR = new THREE.Group();
    this.legL = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: SKIN_TONES[look.skin % SKIN_TONES.length], roughness: 0.65 });
    const shirt = new THREE.MeshStandardMaterial({ color: look.color, roughness: 0.55 });
    const dark = new THREE.MeshStandardMaterial({ color: new THREE.Color(look.color).multiplyScalar(0.45), roughness: 0.6 });
    const white = new THREE.MeshStandardMaterial({ color: 0xf4f6ff, roughness: 0.5 });
    const shortsMat = look.outfit === 2 ? dark : white;
    const m = (g: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) => {
      const me = new THREE.Mesh(g, mat);
      me.position.set(x, y, z);
      me.castShadow = true;
      return me;
    };
    // legs (pivot at hip)
    for (const [leg, sx] of [[this.legR, -0.12], [this.legL, 0.12]] as const) {
      leg.position.set(sx, 0.92, 0);
      leg.add(m(geoCache.limb, skin, 0, -0.38, 0));
      leg.add(m(geoCache.shoe, white, 0, -0.84, 0.05)).scale.set(1, 0.8, 1.5);
      this.body.add(leg);
    }
    this.body.add(m(geoCache.shorts, shortsMat, 0, 0.95, 0));
    // torso
    this.torso.position.set(0, 0.98, 0);
    this.torso.add(m(geoCache.torso, shirt, 0, 0.36, 0));
    this.body.add(this.torso);
    // head
    this.head.position.set(0, 0.98 + 0.9, 0);
    this.head.add(m(geoCache.head, skin));
    if (look.outfit === 0) {
      const cap = m(geoCache.cap, dark, 0, 0.03, 0);
      cap.rotation.x = -0.12;
      this.head.add(cap);
      this.head.add(m(geoCache.visor, dark, 0, 0.05, 0.2));
    } else if (look.outfit === 1) {
      this.head.add(m(geoCache.visor, white, 0, 0.1, 0.18));
      const band = m(geoCache.band, white, 0, 0.1, 0);
      band.rotation.x = Math.PI / 2;
      this.head.add(band);
    } else {
      const band = m(geoCache.band, shirt, 0, 0.09, 0);
      band.rotation.x = Math.PI / 2;
      this.head.add(band);
    }
    // eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x151a2a });
    for (const ex of [-0.07, 0.07]) {
      const eye = new THREE.Mesh(geoCache.hand, eyeMat);
      eye.scale.setScalar(0.35);
      eye.position.set(ex, 0.02, 0.18);
      this.head.add(eye);
    }
    this.torso.add(this.head);
    this.head.position.set(0, 0.92, 0);
    // arms (pivot at shoulder). Character faces +z, so its right arm lives at -x.
    const sleeve = look.outfit === 1 ? skin : shirt;
    for (const [arm, sx] of [[this.armR, -0.34], [this.armL, 0.34]] as const) {
      arm.position.set(sx, 0.72, 0);
      arm.add(m(geoCache.arm, look.outfit === 2 ? shirt : sleeve, 0, -0.22, 0));
      const forearm = m(geoCache.arm, look.outfit === 2 ? shirt : skin, 0, -0.45, 0);
      forearm.scale.set(0.9, 0.4, 0.9);
      arm.add(forearm);
      arm.add(m(geoCache.hand, skin, 0, -0.62, 0));
      this.torso.add(arm);
    }
    // racket on right hand
    this.rackets = new THREE.Group();
    this.rackets.position.set(0, -0.62, 0);
    this.rackets.rotation.x = 1.25;
    const rc = new THREE.MeshStandardMaterial({ color: look.racket, roughness: 0.35, metalness: 0.2 });
    const hdl = m(geoCache.handle, new THREE.MeshStandardMaterial({ color: 0x1b1b24, roughness: 0.9 }), 0, 0.12, 0);
    const fr = m(geoCache.frame, rc, 0, 0.5, 0);
    fr.scale.set(1, 1.3, 1);
    const st = new THREE.Mesh(geoCache.strings, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.28, side: THREE.DoubleSide }));
    st.position.set(0, 0.5, 0);
    st.scale.set(1, 1.3, 1);
    this.rackets.add(hdl, fr, st);
    this.glow.position.set(0, 0.5, 0);
    this.rackets.add(this.glow);
    this.armR.add(this.rackets);
    this.body.add(this.tag);
    this.root.add(this.body);
    this.tag.position.set(0, 2.4, 0);
    this.lookKey = JSON.stringify(look);
  }

  setLook(look: Look) {
    const k = JSON.stringify(look);
    if (k !== this.lookKey) this.build(look);
  }
  setTagVisible(v: boolean) {
    this.tag.visible = v;
  }
  flash(color: number, strength: number) {
    this.flashColor = color;
    this.flashV = strength;
  }

  update(p: Player, dt: number, t: number, ballX: number, ballZ: number, look: Look) {
    this.root.position.set(p.x, 0, p.z);
    this.root.rotation.y = p.yaw;
    const cy = Math.cos(p.yaw);
    const sy = Math.sin(p.yaw);
    const lvx = p.vx * cy - p.vz * sy;
    const lvz = p.vx * sy + p.vz * cy;
    const s = Math.hypot(lvx, lvz);
    const fwd = s > 0.2 ? lvz / s : 0;
    const side = s > 0.2 ? lvx / s : 0;
    this.ph += dt * (2.5 + s * 1.25);
    const run = Math.min(1, s / 6.5);
    const amp = Math.min(1.0, s * 0.115);
    const sw = Math.sin(this.ph);
    const idle = Math.sin(t * 2.2 + this.ph * 0.0) * 0.02;
    let pose: Pose = { ...READY, lean: READY.lean + idle + run * 0.18 + (p.sprinting ? 0.15 : 0) };
    // locomotion arms
    pose.lx += sw * amp * 0.5 * run;
    pose.rx += -sw * amp * 0.35 * run;

    let yOff = Math.abs(sw) * 0.06 * run;
    let headDown = 0;
    let crouch = 0.05 * (1 - run);
    if (p.pose === 'win') {
      const b = Math.abs(Math.sin(t * 6 + this.ph));
      pose = P(Math.sin(t * 3) * 0.3, -2.9, -0.45, -2.9, 0.45, -0.1);
      yOff = b * 0.28;
      crouch = 0;
    } else if (p.pose === 'lose') {
      pose = P(0, 0.1, -0.12, 0.1, 0.12, 0.5);
      headDown = 0.55;
      yOff = 0;
      crouch = 0.1;
    } else if (p.swing) {
      const sk = p.swing.kind;
      const u = p.swing.t / p.swing.dur;
      this.blend = Math.min(1, this.blend + dt * 14);
      const sp = samplePose(sk, u);
      const w = (u > 0.72 ? 1 - ease((u - 0.72) / 0.28) : 1) * this.blend;
      pose = { tw: lerp(pose.tw, sp.tw, w), rx: lerp(pose.rx, sp.rx, w), rz: lerp(pose.rz, sp.rz, w), lx: lerp(pose.lx, sp.lx, w), lz: lerp(pose.lz, sp.lz, w), lean: lerp(pose.lean, sp.lean, w) };
      if (sk === 'serve') yOff += Math.max(0, Math.sin(Math.min(1, u * 1.6) * Math.PI)) * 0.25;
      (this.glow.material as THREE.SpriteMaterial).opacity = Math.max((this.glow.material as THREE.SpriteMaterial).opacity, u > 0.1 && u < 0.45 ? 0.55 : 0);
    } else {
      this.blend = Math.max(0, this.blend - dt * 6);
    }
    // server tossing pose is handled by swing kind keyframe 0 when the swing starts; before it, show the toss arm
    if (!p.swing && p.pose === 'play') {
      if (p.tossing) pose = samplePose('serve', 0);
    }
    // direction change skid
    const turn = p.turn;
    this.body.rotation.z = -side * run * 0.16 * (p.sprinting ? 1.2 : 1) + turn * 0.12;
    this.body.rotation.x = 0 + turn * -0.18;
    // airborne tuck
    const air = Math.min(1, p.y * 2.5);
    this.root.position.y = p.y + yOff;
    this.torso.rotation.y = pose.tw;
    this.torso.rotation.x = pose.lean - crouch * 0.4;
    this.armR.rotation.set(pose.rx, 0, pose.rz);
    this.armL.rotation.set(pose.lx, 0, pose.lz);
    // legs
    const crouchLeg = crouch * 0.6;
    this.legR.rotation.set(sw * amp * fwd - crouchLeg - air * 0.5, 0, sw * amp * side * 0.9 - 0.06 * (1 - run));
    this.legL.rotation.set(-sw * amp * fwd - crouchLeg + air * 0.3, 0, -sw * amp * side * 0.9 + 0.06 * (1 - run));
    // head tracks the ball
    const dx = ballX - p.x;
    const dz = ballZ - p.z;
    let ang = Math.atan2(dx, dz) - p.yaw - pose.tw;
    while (ang > Math.PI) ang -= Math.PI * 2;
    while (ang < -Math.PI) ang += Math.PI * 2;
    this.head.rotation.y = Math.max(-1, Math.min(1, ang)) * 0.8;
    this.head.rotation.x = headDown;
    // racket glow / fx
    const gm = this.glow.material as THREE.SpriteMaterial;
    this.flashV = Math.max(0, this.flashV - dt * 2.2);
    gm.color.setHex(this.flashV > 0.02 ? this.flashColor : FX_COLORS[look.racketFx] ?? 0xffffff);
    const base = look.racketFx > 0 ? 0.1 : 0;
    gm.opacity = Math.max(base, this.flashV, gm.opacity * (1 - dt * 9));
    this.glow.scale.setScalar(0.7 + this.flashV * 1.2);
  }
  dispose() {
    this.root.removeFromParent();
  }
}
