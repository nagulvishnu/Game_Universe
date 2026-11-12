import * as THREE from "three";
import type { Game } from "./engine";
import type { Fighter } from "./fighter";
import { EL_COLORS, type El, type FxItem } from "./vfx";

export interface UltState {
  t: number;
  rt: number;
  phase: 0 | 1 | 2 | 3;
  ex: boolean;
  noGrav: boolean;
  cleanup: (() => void)[];
  d: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  started: boolean;
}

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

function killFx(it: FxItem | null | undefined) { if (it) { it.active = false; it.mesh.visible = false; } }
function holdFx(it: FxItem | null | undefined, s: number | [number, number, number], pos?: THREE.Vector3) {
  if (!it) return;
  if (typeof s === "number") { it.s0.setScalar(s); it.s1.setScalar(s); } else { it.s0.set(...s); it.s1.set(...s); }
  if (pos) it.mesh.position.copy(pos);
}

const NAMES: Record<string, string> = { kairo: "phoenix", ryujin: "judgment", akuma: "void", shiro: "winter" };

export function startUlt(g: Game, f: Fighter) {
  f.cancelMove();
  f.vel.set(0, 0, 0);
  f.ultS = { t: 0, rt: 0, phase: 0, ex: f.transformed, noGrav: true, cleanup: [], d: {}, started: false };
  f.stats.ultimates++;
  f.invuln = 3;
  g.ultsActive++;
  const u = f.ultS;
  const name = u.ex ? f.def.ult.exName : f.def.ult.name;
  g.letterbox(true);
  g.banner(name, f.def.name + " — ULTIMATE", f.def.color, 1.6);
  g.slowmo(0.1, 0.75);
  g.flashScreen("#ffffff", 0.5, 0.25);
  g.impactFrame(0.07);
  g.sfx("ult", f.pos);
  g.shake(0.4);
  g.vfx.ring(V(f.pos.x, 0.1, f.pos.z), EL_COLORS[f.element].main, 0.5, 9, 0.7);
  g.vfx.flash(V(f.pos.x, 2, f.pos.z), EL_COLORS[f.element].main, 40, 20, 0.6);
  f.glowTarget = 1;
}

export function cancelUlt(g: Game, f: Fighter) {
  const u = f.ultS;
  if (!u) return;
  u.cleanup.forEach((c) => c());
  f.ultS = null;
  g.ultsActive = Math.max(0, g.ultsActive - 1);
  if (g.ultsActive === 0) { g.setDim(0); g.letterbox(false); }
  f.glowTarget = 0;
}

function finish(g: Game, f: Fighter) {
  cancelUlt(g, f);
  f.setState(f.air ? "jump" : "idle");
  f.invuln = Math.max(f.invuln, 0.2);
}

export function updateUlt(g: Game, f: Fighter, dt: number) {
  const u = f.ultS;
  if (!u) { f.setState("idle"); return; }
  u.t += dt;
  const o = f.opp;
  const mid = V((f.pos.x + o.pos.x) / 2, 0, (f.pos.z + o.pos.z) / 2);
  f.vel.x *= 0.8; f.vel.z *= 0.8;
  if (u.phase === 0) {
    u.rt += g.realDt;
    f.rig.setPose("charge", 10);
    const side = f.pos.x < o.pos.x ? -1 : 1;
    g.setShot(V(f.pos.x + side * 1.5, 1.7, f.pos.z + 3.3), V(f.pos.x, 1.55, f.pos.z), 1);
    if (Math.random() < 0.7) g.vfx.dust(f.pos, 2, 5);
    if (u.rt >= 0.75) { u.phase = 1; u.t = 0; g.setDim(1, ULT_TINT[f.def.id]); if (f.def.id === "kairo" || f.def.id === "shiro" || f.def.id === "ryujin") f.rig.setPose("castUp"); }
  } else if (u.phase === 1) {
    const G = u.ex ? 1.35 : 1.15;
    const k = Math.min(1, u.t / G);
    f.invuln = Math.max(f.invuln, 0.05);
    gather(g, f, u, k, dt);
    // wide dramatic shot
    const span = Math.abs(f.pos.x - o.pos.x);
    g.setShot(V(mid.x + (f.pos.x < o.pos.x ? -3 : 3), 2.4, mid.z + 9 + span * 0.55), V(mid.x, 2.4 + k * 0.8, mid.z), 0.75);
    g.radialBlur(0.004 + k * 0.01, f.pos);
    if (u.t >= G) {
      if (o.state === "ult" && o.ultS && o.ultS.phase >= 1) { g.ultClash(f, o); return; }
      u.phase = 2; u.t = 0; u.started = false; f.invuln = 0;
    }
  } else if (u.phase === 2) {
    if (!u.started) {
      u.started = true;
      if (o.state === "ult" && o.ultS && o.ultS.phase >= 2) { g.ultClash(f, o); return; }
      strikeStart(g, f, u);
    }
    const done = strikeUpdate(g, f, u, dt);
    if (done || u.t > 6) { u.phase = 3; u.t = 0; }
  } else {
    f.rig.setPose("idle", 8);
    g.setDim(0);
    if (u.t > 0.45) { g.letterbox(false); finish(g, f); }
  }
}

const ULT_TINT: Record<string, number> = { kairo: 0xff3a10, ryujin: 0x2a60ff, akuma: 0x7a20c0, shiro: 0x3a9ae0 };

// -------------------------------------------------------------------------------- gather
function gather(g: Game, f: Fighter, u: UltState, k: number, dt: number) {
  const id = f.def.id;
  const c = EL_COLORS[f.element];
  const head = V(f.pos.x, 3.3, f.pos.z);
  g.setDim(1, ULT_TINT[id]);
  f.rig.setPose(id === "akuma" ? "ultPoint" : "castUp", 8);
  if (!u.d.orb) {
    const it = g.vfx.fx("sphere", head, c.main, 0.3, 0.3, 1000, { hold: true, fadeIn: 0, op: 0.85, hdr: 1.8 });
    u.d.orb = it;
    u.cleanup.push(() => killFx(u.d.orb));
    if (id === "akuma") {
      const core = g.vfx.fx("sphere", head, 0x000000, 0.2, 0.2, 1000, { hold: true, fadeIn: 0, op: 1, hdr: 0 });
      if (core) { core.mat.blending = THREE.NormalBlending; core.mesh.renderOrder = 9; }
      u.d.core = core;
      u.cleanup.push(() => { if (u.d.core) { u.d.core.mat.blending = THREE.AdditiveBlending; killFx(u.d.core); } });
    }
    g.sfx("charge", f.pos);
  }
  const s = (u.ex ? 1.6 : 1.1) * (0.4 + k * 1.3);
  const orbPos = head.clone();
  if (id !== "kairo" && id !== "ryujin" && id !== "shiro") orbPos.set(f.pos.x + f.face.x * 0.8, 2.2, f.pos.z + f.face.z * 0.8);
  holdFx(u.d.orb, s, orbPos);
  if (u.d.core) holdFx(u.d.core, s * 0.7, orbPos);
  // converging particles
  for (let i = 0; i < 6; i++) {
    const a = Math.random() * 6.28, el = rnd(-0.8, 0.8), r = 5.5 * (1 - k * 0.6) + 1;
    const px = orbPos.x + Math.cos(a) * r * Math.cos(el), py = orbPos.y + Math.sin(el) * r, pz = orbPos.z + Math.sin(a) * r * Math.cos(el);
    const sp = 12;
    g.vfx.add.spawn(px, py, pz, (orbPos.x - px) / r * sp, (orbPos.y - py) / r * sp, (orbPos.z - pz) / r * sp, r / sp, 0.35, 0.08, c.core, c.main, 0, 0);
  }
  g.vfx.aura(f.pos, f.element, 1.5, u.ex);
  if (id === "kairo") {
    for (let i = 0; i < 3; i++) { const a = Math.random() * 6.28, r = rnd(0.5, 3); g.vfx.add.spawn(f.pos.x + Math.cos(a) * r, 0.1, f.pos.z + Math.sin(a) * r, 0, rnd(4, 9), 0, rnd(0.5, 0.9), 0.5, 0.05, c.core, c.main, 0.5, -2); }
    if (Math.random() < 0.3) g.vfx.ring(V(f.pos.x, 0.08, f.pos.z), c.main, 0.3, 4 + k * 3, 0.5);
  } else if (id === "ryujin") {
    for (let i = 0; i < 2; i++) g.vfx.bolt(V(f.pos.x + rnd(-6, 6), rnd(14, 22), f.pos.z + rnd(-6, 6)), V(f.pos.x + rnd(-1.5, 1.5), rnd(0, 3), f.pos.z + rnd(-1.5, 1.5)), c.main, 0.9, 0.1, 0.18);
    g.vfx.burst({ p: V(f.pos.x, 21, f.pos.z), n: 5, speed: [0.5, 3], size: [3, 6], life: [1, 2], color: 0x1a2040, color2: 0x0a0a20, smoke: true, jitter: 8, drag: 1 });
    if (Math.random() < 0.3) g.flashScreen("#9ad0ff", 0.25, 0.1);
  } else if (id === "akuma") {
    if (Math.random() < 0.4) g.vfx.scorch(V(f.pos.x + rnd(-5, 5), 0, f.pos.z + rnd(-3, 3)), rnd(1, 2.5));
    for (let i = 0; i < 2; i++) { const a = Math.random() * 6.28; g.vfx.add.spawn(f.pos.x + Math.cos(a) * 4, 0.2, f.pos.z + Math.sin(a) * 4, -Math.cos(a) * 4, rnd(1, 4), -Math.sin(a) * 4, 0.9, 0.5, 0.1, 0xff55e0, 0x300050, 0, 0); }
  } else {
    const gd = u.d.frost as FxItem | undefined;
    if (!gd) { u.d.frost = g.vfx.fx("disc", V(f.pos.x, 0.05, f.pos.z), 0x9ae8ff, 0.1, 0.1, 1000, { hold: true, fadeIn: 0, op: 0.35, hdr: 1.3 }); u.cleanup.push(() => killFx(u.d.frost)); }
    holdFx(u.d.frost, 0.5 + k * 7, V(f.pos.x, 0.05, f.pos.z));
    for (let i = 0; i < 4; i++) { const a = Math.random() * 6.28, r = rnd(0.5, 5); g.vfx.add.spawn(f.pos.x + Math.cos(a) * r, 0.1, f.pos.z + Math.sin(a) * r, 0, rnd(1, 5), 0, rnd(0.6, 1.2), 0.2, 0.04, 0xffffff, c.main, 0.5, 0); }
    if (Math.random() < 0.25) { const a = Math.random() * 6.28, r = rnd(1.5, 4); g.vfx.fx("cone", V(f.pos.x + Math.cos(a) * r, 0, f.pos.z + Math.sin(a) * r), c.main, [0.15, 0.2, 0.15], [0.35, rnd(1.5, 3.2), 0.35], 0.7, { op: 0.8, hdr: 1.4 }); }
  }
  if (Math.random() < 0.1) g.shake(0.1);
  g.vfx.flash(orbPos, c.main, 10 + k * 40, 22, 0.12);
  void dt;
}

// -------------------------------------------------------------------------------- strike
function strikeStart(g: Game, f: Fighter, u: UltState) {
  const id = f.def.id;
  g.sfx(id === "kairo" ? "fire" : id === "ryujin" ? "thunder" : id === "akuma" ? "dark" : "ice", f.pos);
  killFx(u.d.orb); killFx(u.d.core);
  if (u.d.core) u.d.core.mat.blending = THREE.AdditiveBlending;
  u.d.orb = null; u.d.core = null;
  g.flashScreen("#ffffff", 0.25, 0.2);
  const o = f.opp;
  switch (id) {
    case "kairo": {
      f.rig.setPose("ultPoint", 12);
      const count = u.ex ? 3 : 1;
      u.d.ph = [];
      for (let i = 0; i < count; i++) u.d.ph.push(makePhoenix(g, f, u, i));
      u.d.impacts = 0;
      u.d.dmg = u.ex ? 175 : 300;
      break;
    }
    case "ryujin": {
      f.rig.setPose("ultPoint", 12);
      u.d.target = o.pos.clone().setY(0);
      u.d.bolts = u.ex ? 5 : 1;
      u.d.fired = 0;
      u.d.marker = g.vfx.fx("ring", u.d.target, 0xffffff, 3, 3, 1000, { hold: true, fadeIn: 0, op: 0.9, hdr: 2 });
      u.d.beam = g.vfx.fx("cyl", u.d.target, 0x8fd0ff, [0.15, 40, 0.15], [0.15, 40, 0.15], 1000, { hold: true, fadeIn: 0, op: 0.5, hdr: 1.8 });
      u.cleanup.push(() => { killFx(u.d.marker); killFx(u.d.beam); killFx(u.d.shockFx); });
      u.d.struck = false;
      u.d.shockR = -1;
      u.d.shocked = false;
      g.sfx("charge", f.pos);
      break;
    }
    case "akuma": {
      f.rig.setPose("ultPoint", 12);
      u.d.center = o.pos.clone().setY(1.3);
      u.d.R = u.ex ? 6.8 : 5.0;
      const core = g.vfx.fx("sphere", u.d.center, 0x000000, 0.3, 0.3, 1000, { hold: true, fadeIn: 0, op: 0.97, hdr: 0 });
      if (core) { core.mat.blending = THREE.NormalBlending; core.mesh.renderOrder = 9; }
      const shell = g.vfx.fx("sphere", u.d.center, 0xa23cff, 0.3, 0.3, 1000, { hold: true, fadeIn: 0, op: 0.35, hdr: 1.6 });
      u.d.core = core; u.d.shell = shell;
      u.cleanup.push(() => { if (core) core.mat.blending = THREE.AdditiveBlending; killFx(core); killFx(shell); });
      u.d.det = false;
      u.d.dur = u.ex ? 1.35 : 1.1;
      u.d.pulse2 = false;
      g.sfx("charge", o.pos);
      break;
    }
    default: {
      f.rig.setPose("slam", 12);
      u.d.R = 0;
      u.d.maxR = u.ex ? 27 : 22;
      u.d.speed = u.ex ? 24 : 18;
      u.d.frozen = false;
      u.d.det = false;
      u.d.det2 = false;
      u.d.center = V(f.pos.x, 0, f.pos.z);
      u.d.ring = g.vfx.fx("ring", V(f.pos.x, 0.1, f.pos.z), 0xcff6ff, 1, 1, 1000, { hold: true, fadeIn: 0, op: 0.95, hdr: 2 });
      u.d.sheet = g.vfx.fx("disc", V(f.pos.x, 0.07, f.pos.z), 0x9ae8ff, 1, 1, 1000, { hold: true, fadeIn: 0, op: 0.4, hdr: 1.3 });
      u.cleanup.push(() => { killFx(u.d.ring); killFx(u.d.sheet); });
      g.vfx.shockwave(f.pos, "ice", 6, 0.5);
      g.shake(0.5);
    }
  }
}

function makePhoenix(g: Game, f: Fighter, u: UltState, i: number) {
  const grp = new THREE.Group();
  const mk = (c: number, op = 0.9, hdr = 1.6) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(hdr), transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const mOut = mk(u.ex ? 0xffd23f : 0xff5a1f), mIn = mk(0xffe8a0, 0.95, 2);
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), mOut); body.scale.set(0.6, 0.6, 1.7); grp.add(body);
  const bodyIn = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), mIn); bodyIn.scale.set(0.35, 0.35, 1.3); grp.add(bodyIn);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 8), mIn); head.position.set(0, 0.25, 1.7); grp.add(head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.7, 6), mOut); beak.position.set(0, 0.2, 2.2); beak.rotation.x = Math.PI / 2; grp.add(beak);
  const wings: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Group(); w.position.set(s * 0.4, 0.2, 0.3);
    for (let k = 0; k < 8; k++) {
      const len = 3.2 + Math.sin((k / 7) * Math.PI) * 2.4;
      const fg = new THREE.ConeGeometry(0.38 - k * 0.02, len, 5); fg.translate(0, len / 2, 0);
      const fe = new THREE.Mesh(fg, k % 2 ? mOut : mIn);
      fe.rotation.z = -s * (Math.PI / 2) + s * (k - 3.5) * 0.17;
      fe.rotation.x = (k - 3.5) * 0.11;
      fe.position.z = -(k - 3.5) * 0.28;
      w.add(fe);
    }
    grp.add(w); wings.push(w);
  }
  for (let k = 0; k < 6; k++) {
    const len = 4 + k % 3 * 1.2;
    const tg = new THREE.ConeGeometry(0.28, len, 5); tg.translate(0, len / 2, 0);
    const t = new THREE.Mesh(tg, k % 2 ? mOut : mIn); t.rotation.x = -Math.PI / 2 + (k - 2.5) * 0.05; t.rotation.z = (k - 2.5) * 0.14; t.position.set(0, 0, -1.5); grp.add(t);
  }
  const sc = u.ex ? 1.45 : 1.2;
  grp.scale.setScalar(sc);
  const start = V(f.pos.x + (i - (u.ex ? 1 : 0)) * 1.6, 3.4, f.pos.z);
  grp.position.copy(start);
  g.scene.add(grp);
  const rb = g.vfx.makeRibbon(u.ex ? 0xffd23f : 0xff7a20, 14, 1.0, 0.5);
  const rb2 = g.vfx.makeRibbon(0xffe8a0, 14, 0.5, 0.4);
  const ph = { grp, wings, stage: "wait" as "wait" | "rise" | "dive" | "done", t: 0, delay: i * 0.5, from: start.clone(), top: V(), target: V(), rb, rb2, i, mats: [mOut, mIn] };
  u.cleanup.push(() => {
    g.scene.remove(grp);
    grp.traverse((m) => { const mm = m as THREE.Mesh; if (mm.isMesh) mm.geometry.dispose(); });
    mOut.dispose(); mIn.dispose();
    rb.dispose(); rb2.dispose();
  });
  grp.visible = false;
  return ph;
}

function strikeUpdate(g: Game, f: Fighter, u: UltState, dt: number): boolean {
  switch (f.def.id) {
    case "kairo": return kairoStrike(g, f, u, dt);
    case "ryujin": return ryujinStrike(g, f, u, dt);
    case "akuma": return akumaStrike(g, f, u, dt);
    default: return shiroStrike(g, f, u, dt);
  }
}

function kairoStrike(g: Game, f: Fighter, u: UltState, dt: number): boolean {
  const o = f.opp;
  const c = EL_COLORS.fire;
  let allDone = true;
  let focus: THREE.Vector3 | null = null;
  const R = u.ex ? 5.0 : 4.4;
  for (const ph of u.d.ph as ReturnType<typeof makePhoenix>[]) {
    ph.t += dt;
    if (ph.stage === "wait") {
      allDone = false;
      if (u.t >= ph.delay) { ph.stage = "rise"; ph.t = 0; ph.grp.visible = true; ph.from.copy(ph.grp.position); ph.top.set(f.pos.x + (ph.i - 1) * 2.2, 15 + ph.i * 1.5, f.pos.z - 1); g.sfx("fire", f.pos); g.vfx.ring(V(f.pos.x, 0.1, f.pos.z), c.main, 0.4, 7, 0.5); g.vfx.burst({ p: ph.from.clone(), n: 40, speed: [3, 12], size: [0.3, 0.7], life: [0.3, 0.8], color: c.core, color2: c.main, drag: 2 }); }
    }
    if (ph.stage === "rise") {
      allDone = false;
      const k = Math.min(1, ph.t / 0.5);
      const e = 1 - Math.pow(1 - k, 2);
      ph.grp.position.lerpVectors(ph.from, ph.top, e);
      ph.grp.lookAt(ph.top.x, ph.top.y + 10, ph.top.z - 1);
      ph.grp.rotateX(0);
      if (k >= 1) { ph.stage = "dive"; ph.t = 0; ph.from.copy(ph.grp.position); ph.target.copy(o.pos).setY(0.8); g.sfx("explosion", f.pos); }
    } else if (ph.stage === "dive") {
      allDone = false;
      const dur = 0.5;
      const k = Math.min(1, ph.t / dur);
      if (k < 0.5) ph.target.lerp(V(o.pos.x, 0.8, o.pos.z), 0.12); // late tracking, then lock
      const e = k * k;
      ph.grp.position.lerpVectors(ph.from, ph.target, e);
      ph.grp.lookAt(ph.target);
      if (k >= 1) {
        ph.stage = "done"; ph.grp.visible = false;
        impactKairo(g, f, u, ph.target, R);
      }
    }
    if (ph.grp.visible) {
      const flap = Math.sin(u.t * 18 + ph.i) * 0.5;
      ph.wings[0].rotation.z = flap; ph.wings[1].rotation.z = -flap;
      ph.rb.add(ph.grp.position); ph.rb2.add(ph.grp.position);
      g.vfx.trail(ph.grp.position, "fire", 3.2);
      g.vfx.trail(ph.grp.position, "fire", 2.2);
      g.vfx.flash(ph.grp.position, c.main, 35, 24, 0.1);
      focus = ph.grp.position;
    }
    if (ph.stage !== "done") allDone = false;
  }
  if (focus) {
    const mid = V((focus.x + f.pos.x) / 2, 0, (focus.z + o.pos.z) / 2);
    g.setShot(V(mid.x + 4, Math.max(3, focus.y * 0.45 + 2.5), mid.z + 12), V(focus.x * 0.6 + o.pos.x * 0.4, Math.max(1.5, focus.y * 0.6), o.pos.z), 0.7);
    g.radialBlur(0.016, o.pos);
  }
  f.glowTarget = 1;
  return allDone && u.t > 0.6 && !(u.d.ph as { grp: THREE.Group }[]).some((p) => p.grp.visible) && u.d.impacts >= (u.d.ph as unknown[]).length && u.t > (u.ex ? 3.2 : 1.9);
}

function impactKairo(g: Game, f: Fighter, u: UltState, at: THREE.Vector3, R: number) {
  const o = f.opp;
  const c = EL_COLORS.fire;
  u.d.impacts++;
  const p = V(at.x, 0, at.z);
  g.explode(p, "fire", u.ex ? 2.2 : 2.8, { damage: false });
  g.vfx.fx("cone", p, c.main, [2, 2, 2], [3, 12, 3], 0.5, { op: 0.7, hdr: 1.6 });
  g.vfx.fx("sphere", V(p.x, 1, p.z), 0xfff0c0, 1, 7, 0.35, { op: 1, hdr: 2.4 });
  g.shake(1);
  g.impactFrame(0.06);
  g.flashScreen("#ffb060", 0.3, 0.35);
  g.sfx("bigexplosion", p);
  g.slowmo(0.3, 0.3);
  const d = Math.hypot(o.pos.x - p.x, (o.pos.y + 0.8) - 0.8, o.pos.z - p.z);
  if (d < R) {
    const kx = (o.pos.x - p.x) / (d || 1), kz = (o.pos.z - p.z) / (d || 1);
    g.ultHit(f, o, u.d.dmg, { knock: 12, kx, kz, launch: u.ex ? 6 : 12, el: "fire", point: V(o.pos.x, 1, o.pos.z) });
  }
}

function ryujinStrike(g: Game, f: Fighter, u: UltState, dt: number): boolean {
  const o = f.opp;
  const c = EL_COLORS.lightning;
  const tel = 0.85;
  const T = u.d.target as THREE.Vector3;
  if (u.t < tel) {
    if (u.t < 0.5) T.lerp(V(o.pos.x, 0, o.pos.z), 0.2);
    const k = u.t / tel;
    holdFx(u.d.marker, 4.2 - k * 2.2, V(T.x, 0.08, T.z));
    holdFx(u.d.beam, [0.12 + k * 0.1, 40, 0.12 + k * 0.1], V(T.x, 0, T.z));
    if (Math.random() < 0.35) g.vfx.ring(V(T.x, 0.1, T.z), 0xffffff, 3.5, 0.5, 0.3);
    g.vfx.burst({ p: V(T.x, 0.3, T.z), n: 3, speed: [1, 5], size: [0.15, 0.3], life: [0.3, 0.6], color: 0xffffff, color2: c.main, dir: V(0, 1, 0), spread: 0.8, grav: -2 });
    g.vfx.bolt(V(T.x + rnd(-2, 2), 24, T.z + rnd(-2, 2)), V(T.x + rnd(-1, 1), 0, T.z + rnd(-1, 1)), c.main, 0.7, 0.07, 0.12);
    g.setShot(V(T.x * 0.5 + f.pos.x * 0.5, 4, (T.z + f.pos.z) / 2 + 13), V(T.x * 0.5 + f.pos.x * 0.5, 4.5, T.z), 0.75);
  }
  // bolts
  const nb = u.d.bolts as number;
  const times = Array.from({ length: nb }, (_, i) => tel + i * 0.2);
  while (u.d.fired < nb && u.t >= times[u.d.fired]) {
    const i = u.d.fired++;
    if (i === 0) { killFx(u.d.marker); killFx(u.d.beam); }
    const at = i === 0 ? T.clone() : V(T.x + rnd(-6, 6), 0, THREE.MathUtils.clamp(T.z + rnd(-3.5, 3.5), -6, 6));
    const big = i === 0;
    g.clampToArena(at);
    g.vfx.fx("cyl", at, 0xe8f6ff, [big ? 2.4 : 1.4, 45, big ? 2.4 : 1.4], [0.4, 45, 0.4], big ? 0.7 : 0.5, { op: 1, hdr: 2.4, fadeIn: 0 });
    g.vfx.fx("cyl", at, c.main, [big ? 4.4 : 2.6, 45, big ? 4.4 : 2.6], [0.8, 45, 0.8], big ? 0.8 : 0.6, { op: 0.6, hdr: 1.8, fadeIn: 0 });
    for (let k = 0; k < 7; k++) g.vfx.bolt(V(at.x + rnd(-4, 4), rnd(28, 40), at.z + rnd(-4, 4)), V(at.x + rnd(-0.6, 0.6), 0, at.z + rnd(-0.6, 0.6)), k % 2 ? c.main : 0xffffff, 1.2, 0.25, 0.28);
    for (let k = 0; k < 8; k++) g.vfx.bolt(V(at.x, 0.3, at.z), V(at.x + rnd(-6, 6), rnd(0, 2), at.z + rnd(-6, 6)), c.main, 0.8, 0.2, 0.2);
    g.explode(at, "lightning", big ? 2.4 : 1.4, { damage: false });
    g.vfx.flash(V(at.x, 4, at.z), 0xbfe8ff, big ? 90 : 50, 40, 0.6);
    g.shake(big ? 1 : 0.6);
    g.impactFrame(0.06);
    g.flashScreen("#e8f6ff", big ? 0.5 : 0.25, 0.35);
    g.sfx("bigexplosion", at);
    g.sfx("thunder", at);
    g.slowmo(0.35, 0.25);
    const rad = (u.ex ? 3.4 : 2.9) * (big ? 1 : 0.85);
    const d = Math.hypot(o.pos.x - at.x, o.pos.z - at.z);
    if (d < rad && o.pos.y < 6) {
      const kx = (o.pos.x - at.x) / (d || 1), kz = (o.pos.z - at.z) / (d || 1);
      g.ultHit(f, o, u.ex ? (big ? 150 : 90) : 290, { knock: 8, kx, kz, launch: 8, el: "lightning", point: V(o.pos.x, 1, o.pos.z), stun: 0.8 });
      u.d.hitDirect = true;
    }
    if (i === nb - 1) { u.d.struck = true; u.d.shockR = 0.5; u.d.shockT = 0; u.d.shockAt = at.clone(); }
    g.setShot(V(at.x + 4, 5, at.z + 13), V(at.x, 5, at.z), 0.9);
  }
  if (u.d.struck) {
    // shockwave ring
    u.d.shockT += dt;
    const speed = u.ex ? 17 : 14;
    const maxR = u.ex ? 20 : 15;
    const r = 0.5 + u.d.shockT * speed;
    const A = u.d.shockAt as THREE.Vector3;
    if (!u.d.shockFx) u.d.shockFx = g.vfx.fx("ring", V(A.x, 0.12, A.z), 0xdff4ff, 1, 1, 1000, { hold: true, fadeIn: 0, op: 1, hdr: 2.2 });
    holdFx(u.d.shockFx, r, V(A.x, 0.12, A.z));
    if (u.d.shockFx) u.d.shockFx.mat.opacity = Math.max(0, 1 - r / maxR);
    for (let k = 0; k < 6; k++) {
      const a = Math.random() * 6.28;
      g.vfx.add.spawn(A.x + Math.cos(a) * r, 0.1, A.z + Math.sin(a) * r, 0, rnd(1, 4), 0, 0.3, 0.3, 0.05, 0xffffff, c.main, 1, 0);
    }
    if (Math.random() < 0.4) { const a = Math.random() * 6.28; g.vfx.bolt(V(A.x + Math.cos(a) * r, 0, A.z + Math.sin(a) * r), V(A.x + Math.cos(a) * r + rnd(-1, 1), rnd(1, 3), A.z + Math.sin(a) * r + rnd(-1, 1)), c.main, 0.4, 0.1, 0.15); }
    const d = Math.hypot(o.pos.x - A.x, o.pos.z - A.z);
    if (!u.d.shocked && Math.abs(d - r) < 1.1 && o.pos.y < 0.9) {
      u.d.shocked = true;
      const kx = (o.pos.x - A.x) / (d || 1), kz = (o.pos.z - A.z) / (d || 1);
      g.ultHit(f, o, u.ex ? 130 : 95, { knock: 11, kx, kz, launch: 7, el: "lightning", point: V(o.pos.x, 0.8, o.pos.z), small: true });
    }
    if (r >= maxR) { killFx(u.d.shockFx); return true; }
  }
  void tel;
  return false;
}

function akumaStrike(g: Game, f: Fighter, u: UltState, dt: number): boolean {
  const o = f.opp;
  const c = EL_COLORS.dark;
  const dur = u.d.dur as number;
  const k = Math.min(1, u.t / dur);
  const R = u.d.R as number;
  const C = u.d.center as THREE.Vector3;
  if (!u.d.det) {
    if (u.t < 0.35) C.lerp(V(o.pos.x, 1.3, o.pos.z), 0.25);
    const rad = 0.4 + (R - 0.4) * (1 - Math.pow(1 - k, 2));
    const wob = 1 + Math.sin(u.t * 30) * 0.02;
    holdFx(u.d.core, rad * 0.97 * wob, C);
    holdFx(u.d.shell, rad * 1.08 * wob, C);
    if (u.d.shell) u.d.shell.mat.opacity = 0.3 + k * 0.35;
    // implode particles
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * 6.28, e = rnd(-1, 1), rr = R * rnd(1.1, 1.8);
      const px = C.x + Math.cos(a) * rr * Math.cos(e), py = C.y + Math.sin(e) * rr * 0.8, pz = C.z + Math.sin(a) * rr * Math.cos(e);
      g.vfx.add.spawn(px, Math.max(0.1, py), pz, (C.x - px) * 3, (C.y - py) * 3, (C.z - pz) * 3, 0.33, 0.35, 0.08, 0xff55e0, 0x300050, 0, 0);
    }
    if (Math.random() < 0.5) g.vfx.bolt(V(C.x + rnd(-R, R) * 1.3, rnd(0.3, 4), C.z + rnd(-R, R) * 1.3), C, c.main, 0.5, 0.12, 0.15);
    if (Math.random() < 0.3) g.vfx.ring(V(C.x, 0.1, C.z), c.main, R * 1.3, 0.5, 0.4);
    g.vfx.flash(C, c.main, 30, 24, 0.12);
    // pull
    const dx = C.x - o.pos.x, dz = C.z - o.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < R * 1.7 && o.state !== "ko" && o.state !== "ult") {
      const pull = (5 + k * 4) * dt * 12;
      o.vel.x += (dx / (d || 1)) * pull * 0.5;
      o.vel.z += (dz / (d || 1)) * pull * 0.5;
      if (o.pos.y > 0.1) o.vel.y += (C.y - o.pos.y - 0.3) * dt * 6;
    }
    g.setShot(V(C.x + 3.5, 2.8, C.z + 10 + R * 0.6), V(C.x, 1.6, C.z), 0.8);
    g.radialBlur(0.012 * k, C);
    g.setDim(1, 0x4a0a80);
    if (u.t >= dur) {
      u.d.det = true; u.d.detT = 0;
      killFx(u.d.core); killFx(u.d.shell);
      const p = V(C.x, 0, C.z);
      g.explode(p, "dark", u.ex ? 3.6 : 3.0, { damage: false });
      g.vfx.fx("sphere", C, 0xffffff, R * 0.5, R * 1.7, 0.3, { op: 1, hdr: 2.2 });
      g.vfx.fx("sphere", C, c.main, R * 0.5, R * 2.4, 0.6, { op: 0.6, hdr: 1.6 });
      g.vfx.fx("ring", C, c.core, 1, R * 3, 0.7, { op: 0.9, hdr: 2, billboard: true });
      g.shake(1); g.impactFrame(0.09); g.flashScreen("#ff9af0", 0.45, 0.45); g.sfx("bigexplosion", p); g.sfx("dark", p);
      g.slowmo(0.28, 0.35);
      const dd = Math.hypot(o.pos.x - C.x, o.pos.z - C.z, (o.pos.y + 0.9) - C.y);
      if (dd < R) {
        const kx = (o.pos.x - C.x) / (dd || 1), kz = (o.pos.z - C.z) / (dd || 1);
        g.ultHit(f, o, u.ex ? 250 : 320, { knock: 13, kx, kz, launch: 13, el: "dark", point: V(o.pos.x, 1, o.pos.z) });
      }
    }
  } else {
    u.d.detT += dt;
    g.setShot(V(C.x + 4, 3.5, C.z + 12 + R * 0.4), V(C.x, 2, C.z), 0.8);
    if (u.ex && !u.d.pulse2 && u.d.detT > 0.4) {
      u.d.pulse2 = true;
      const p = V(C.x, 0, C.z);
      g.explode(p, "dark", 3.2, { damage: false });
      g.vfx.fx("sphere", C, 0xff55e0, R * 0.4, R * 2.0, 0.5, { op: 0.8, hdr: 2 });
      g.shake(0.9); g.impactFrame(0.05); g.sfx("bigexplosion", p);
      const dd = Math.hypot(o.pos.x - C.x, o.pos.z - C.z);
      if (dd < R * 1.1) g.ultHit(f, o, 130, { knock: 10, kx: (o.pos.x - C.x) / (dd || 1), kz: (o.pos.z - C.z) / (dd || 1), launch: 9, el: "dark", point: V(o.pos.x, 1, o.pos.z) });
    }
    if (u.d.detT > (u.ex ? 1.3 : 1.0)) return true;
  }
  return false;
}

function shiroStrike(g: Game, f: Fighter, u: UltState, dt: number): boolean {
  const o = f.opp;
  const c = EL_COLORS.ice;
  const C = u.d.center as THREE.Vector3;
  if (!u.d.det) {
    u.d.R += u.d.speed * dt;
    const r = u.d.R as number;
    holdFx(u.d.ring, r, V(C.x, 0.1, C.z));
    holdFx(u.d.sheet, r, V(C.x, 0.07, C.z));
    // spikes along wavefront
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * 6.28;
      const x = C.x + Math.cos(a) * r, z = C.z + Math.sin(a) * r;
      if (Math.abs(x) > 17 || Math.abs(z) > 8.5) continue;
      g.vfx.add.spawn(x, 0.1, z, 0, rnd(3, 9), 0, rnd(0.4, 0.8), 0.45, 0.08, 0xffffff, c.main, 1, 4);
    }
    if (Math.random() < 0.7) {
      const a = Math.random() * 6.28;
      const x = C.x + Math.cos(a) * r, z = C.z + Math.sin(a) * r;
      if (Math.abs(x) < 17 && Math.abs(z) < 8.5) g.vfx.fx("cone", V(x, 0, z), c.main, [0.2, 0.2, 0.2], [0.5, rnd(1.8, 4.5), 0.5], 0.8, { op: 0.8, hdr: 1.5 });
    }
    g.vfx.burst({ p: V(C.x + Math.cos(Math.random() * 6.28) * r, 0.4, C.z + Math.sin(Math.random() * 6.28) * r), n: 3, speed: [1, 3], size: [1, 2], life: [0.8, 1.4], color: 0xaadcf0, color2: 0x6a8aa8, smoke: true, grav: -0.5 });
    const d = Math.hypot(o.pos.x - C.x, o.pos.z - C.z);
    if (!u.d.frozen && d < r && o.pos.y < 0.95 && o.state !== "ko" && o.invuln <= 0 && o.state !== "ult") {
      u.d.frozen = true;
      o.freeze(2.4);
      o.hp = Math.max(1, o.hp - 20);
      f.stats.damage += 20;
      g.vfx.shockwave(o.pos, "ice", 4, 0.4);
      g.shake(0.4);
      g.sfx("freeze", o.pos);
    }
    g.setShot(V(C.x * 0.6 + o.pos.x * 0.4 + 3, 3, 13 + Math.max(0, r - 6) * 0.2), V(mid(f, o).x, 1.8, mid(f, o).z), 0.75);
    g.radialBlur(0.01, o.pos);
    g.setDim(1, 0x3a9ae0);
    if (u.d.R >= 1.3 * u.d.speed * 0.9 || u.d.R >= u.d.maxR) {
      u.d.det = true; u.d.detT = 0;
      killFx(u.d.ring); killFx(u.d.sheet);
      const frozen = o.state === "frozen";
      const at = frozen ? V(o.pos.x, 0, o.pos.z) : V(THREE.MathUtils.clamp(C.x + f.face.x * 5, -12, 12), 0, THREE.MathUtils.clamp(C.z + f.face.z * 5, -5, 5));
      u.d.at = at;
      const big = u.ex ? 3.4 : 3.0;
      g.explode(at, "ice", big, { damage: false });
      for (let i = 0; i < 8; i++) g.vfx.fx("cone", V(at.x + rnd(-3, 3), 0, at.z + rnd(-3, 3)), c.main, [0.4, 1, 0.4], [1.0, rnd(5, 10), 1.0], 0.8, { op: 0.75, hdr: 1.5 });
      g.vfx.fx("sphere", V(at.x, 1.2, at.z), 0xffffff, 1, 6.5, 0.35, { op: 1, hdr: 2.4 });
      g.shake(1); g.impactFrame(0.07); g.flashScreen("#d8f6ff", 0.45, 0.45); g.sfx("bigexplosion", at); g.sfx("shatter", at);
      g.slowmo(0.28, 0.35);
      const dd = Math.hypot(o.pos.x - at.x, o.pos.z - at.z);
      if (o.state === "frozen") o.unfreeze(true);
      if (dd < 5.8) {
        const kx = (o.pos.x - at.x) / (dd || 1), kz = (o.pos.z - at.z) / (dd || 1);
        g.ultHit(f, o, frozen ? (u.ex ? 240 : 300) : 190, { knock: 12, kx, kz, launch: 12, el: "ice", point: V(o.pos.x, 1, o.pos.z) });
      }
    }
  } else {
    u.d.detT += dt;
    const at = u.d.at as THREE.Vector3;
    g.setShot(V(at.x + 4, 3.6, at.z + 12), V(at.x, 2, at.z), 0.8);
    if (u.ex && !u.d.det2 && u.d.detT > 0.4) {
      u.d.det2 = true;
      g.explode(at, "ice", 3.4, { damage: false });
      g.vfx.fx("sphere", V(at.x, 1.2, at.z), c.main, 1, 8.5, 0.5, { op: 0.8, hdr: 2 });
      g.shake(0.9); g.impactFrame(0.05); g.sfx("bigexplosion", at);
      const dd = Math.hypot(o.pos.x - at.x, o.pos.z - at.z);
      if (dd < 7) g.ultHit(f, o, 190, { knock: 10, kx: (o.pos.x - at.x) / (dd || 1), kz: (o.pos.z - at.z) / (dd || 1), launch: 9, el: "ice", point: V(o.pos.x, 1, o.pos.z) });
    }
    if (u.d.detT > (u.ex ? 1.3 : 0.9)) return true;
  }
  return false;
}

function mid(a: Fighter, b: Fighter) { return V((a.pos.x + b.pos.x) / 2, 0, (a.pos.z + b.pos.z) / 2); }
void (NAMES as unknown);
export type { El };
