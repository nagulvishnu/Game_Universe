import * as THREE from "three";
import { G, P, V3, rnd, clamp, pick, dampAng, angDiff } from "./core";
import { fx, shake } from "./fx";
import { sfx } from "./audio";
import { addCenter, Box, env, moveBody, ARENA, freeSpot, BOUND } from "./world";
import { explode, dmgPlayer } from "./combat";
import { buildCivilian, CivRig } from "./rig";
import { toast } from "../store";
import { useGame } from "../store";

const LINES = [-280, -200, -120, -40, 40, 120, 200, 280];
let root: THREE.Group;
let carBody: THREE.InstancedMesh, carCab: THREE.InstancedMesh, orbMesh: THREE.InstancedMesh;
const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new V3(), PP = new V3(), COL = new THREE.Color();
export const orbs: { p: V3; got: boolean }[] = [];
export const state = { orbsGot: 0 };

/* ---------------- props ---------------- */
const barrelMat = new THREE.MeshToonMaterial({ color: 0xcc3322, emissive: 0x551100, emissiveIntensity: 0.5 });
const crateMat = new THREE.MeshToonMaterial({ color: 0xa0743c });
const pillarMat = new THREE.MeshToonMaterial({ color: 0x9a9aa8 });
export function spawnProp(type: "barrel" | "crate" | "pillar", x: number, z: number) {
  let mesh: THREE.Mesh, hp = 40, r = 1, box: Box | null = null;
  if (type === "barrel") { mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.2, 10), barrelMat); mesh.position.set(x, 0.6, z); r = 0.9; hp = 30; }
  else if (type === "crate") { mesh = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), crateMat); mesh.position.set(x, 0.7, z); r = 1.2; hp = 40; }
  else { mesh = new THREE.Mesh(new THREE.BoxGeometry(5, 14, 5), pillarMat); mesh.position.set(x, 7, z); r = 3.6; hp = 260; box = addCenter(x, z, 5, 5, 14); }
  mesh.castShadow = true;
  root.add(mesh);
  const pr = { type, mesh, hp, r, pos: mesh.position, box, dead: false };
  G.props.push(pr);
  return pr;
}
function breakProp(p: any, chain = true) {
  if (p.dead) return;
  p.dead = true;
  root.remove(p.mesh);
  if (p.box) p.box.dead = true;
  const pos = p.pos.clone();
  fx.burst(pos, p.type === "barrel" ? 0xff7a1a : 0xcfa070, 16, 8, 0.5, 0.8, 10, 0.5);
  for (let i = 0; i < 8; i++) fx.smoke(pos.x, pos.y, pos.z, rnd(-3, 3), rnd(1, 5), rnd(-3, 3), 0x555555, 1.5, 1.2, 4, 1);
  sfx("hit", pos);
  if (p.type === "pillar") { fx.explosion(pos, 6, 0xaaaaaa, 0xffffff); shake(0.6); }
  if (p.type === "barrel" && chain) {
    explode(pos, 7, 80, { team: "p", color: 0xff5a10, vfx: true, knock: 12 });
    if (P.pos.distanceTo(pos) < 7) dmgPlayer(30, pos, { kb: 10 });
  }
}
export function clearProps(type?: string) {
  for (const p of G.props) if (!p.dead && (!type || p.type === type)) { p.dead = true; root.remove(p.mesh); if (p.box) p.box.dead = true; }
  G.props = G.props.filter((p: any) => !p.dead);
}

/* ---------------- cars ---------------- */
interface Car { axis: number; line: number; lane: number; dir: number; s: number; speed: number; color: number; wreck: any; pos: V3; yaw: number; }
const cars: Car[] = [];
function newCar(c?: Car) {
  const axis = Math.random() < 0.5 ? 0 : 1, line = pick(LINES.slice(1, -1)), dir = Math.random() < 0.5 ? 1 : -1;
  const car: Car = c ?? ({} as Car);
  Object.assign(car, { axis, line, dir, lane: dir * 4.5, s: rnd(-270, 270), speed: rnd(9, 15), color: pick([0xe74c3c, 0x3498db, 0xf1c40f, 0xecf0f1, 0x2ecc71, 0x9b59b6, 0x34495e, 0xff8a3d]), wreck: null });
  car.pos = car.pos ?? new V3();
  return car;
}
function carTransform(c: Car) {
  if (c.wreck) { c.pos.copy(c.wreck.pos); return; }
  if (c.axis === 0) { c.pos.set(c.s, 0, c.line + c.lane); c.yaw = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
  else { c.pos.set(c.line - c.lane, 0, c.s); c.yaw = c.dir > 0 ? 0 : Math.PI; }
}

/* ---------------- civilians ---------------- */
export interface Civ {
  rig: CivRig; pos: V3; vel: V3; yaw: number; state: string; t: number; axis: number; target: number; trapped: boolean; rescued: boolean; speed: number; threat: V3 | null; waveCd: number; hp: number; dead: boolean; r: number; safeT: number;
}
export function spawnCiv(x?: number, z?: number, trapped = false): Civ {
  const rig = buildCivilian();
  const axis = Math.random() < 0.5 ? 0 : 1;
  const L = pick(LINES.slice(1, -1)) + (Math.random() < 0.5 ? 12.5 : -12.5);
  const t = rnd(-260, 260);
  const px = x ?? (axis === 0 ? t : L), pz = z ?? (axis === 0 ? L : t);
  const c: Civ = { rig, pos: new V3(px, 0, pz), vel: new V3(), yaw: rnd(0, 6.28), state: trapped ? "trapped" : "walk", t: 0, axis, target: (axis === 0 ? px : pz) + rnd(-50, 50), trapped, rescued: false, speed: rnd(1.8, 2.8), threat: null, waveCd: rnd(5, 15), hp: 1, dead: false, r: 0.4, safeT: 0 };
  rig.root.position.copy(c.pos);
  root.add(rig.root);
  G.civs.push(c);
  return c;
}
export function removeCiv(c: Civ) {
  root.remove(c.rig.root);
  const i = G.civs.indexOf(c);
  if (i >= 0) G.civs.splice(i, 1);
}
export function scare(pos: V3, radius: number) {
  for (const c of G.civs as Civ[]) {
    if (c.trapped) continue;
    if (c.pos.distanceTo(pos) < radius) { c.state = "flee"; c.t = rnd(3, 5); c.threat = pos.clone(); }
  }
}

/* ---------------- init ---------------- */
export function initCity(r: THREE.Group) {
  root = r;
  // props
  for (let i = 0; i < 26; i++) { const p = freeSpot(rnd(-250, 250), rnd(-270, -90), 40); if (Math.hypot(p.x, p.z) > 30) spawnProp(Math.random() < 0.6 ? "barrel" : "crate", p.x, p.z + 0); }
  for (let i = 0; i < 20; i++) { const p = freeSpot(rnd(-250, 250), rnd(-80, 250), 40); if (Math.hypot(p.x, p.z) > 40) spawnProp(Math.random() < 0.5 ? "barrel" : "crate", p.x, p.z); }
  // cars
  for (let i = 0; i < 44; i++) { const c = newCar(); cars.push(c); G.cars.push(c); }
  const bGeo = new THREE.BoxGeometry(4.2, 1, 1.9), cGeo = new THREE.BoxGeometry(2.2, 0.8, 1.7);
  carBody = new THREE.InstancedMesh(bGeo, new THREE.MeshToonMaterial({ color: 0xffffff }), cars.length);
  carCab = new THREE.InstancedMesh(cGeo, new THREE.MeshToonMaterial({ color: 0x1b2433, emissive: 0x112233, emissiveIntensity: 0.4 }), cars.length);
  carBody.castShadow = true; carBody.frustumCulled = false; carCab.frustumCulled = false;
  carBody.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cars.length * 3), 3);
  root.add(carBody, carCab);
  // civilians
  for (let i = 0; i < 34; i++) spawnCiv();
  // orbs
  for (const p of env.orbSpots) orbs.push({ p: p.clone(), got: false });
  orbMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.7, 0), new THREE.MeshBasicMaterial({ color: 0xffd23f }), orbs.length);
  orbMesh.frustumCulled = false;
  root.add(orbMesh);
  // portals
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x9a6bff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  const mkPortal = (x: number, y: number, z: number, rot: number) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.18, 8, 32), ringMat);
    m.position.set(x, y, z); m.rotation.y = rot; root.add(m);
    const d = new THREE.Mesh(new THREE.CircleGeometry(2.3, 28), new THREE.MeshBasicMaterial({ color: 0x4a1a9a, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
    d.position.copy(m.position); d.rotation.y = rot; root.add(d);
  };
  mkPortal(22, 2.6, 25.4, 0);
  mkPortal(ARENA.x, 2.6, ARENA.z + 60, 0);
  G.portals.push({ pos: new V3(22, 0, 25.4), id: "in", cd: 0 }, { pos: new V3(ARENA.x, 0, ARENA.z + 60), id: "out", cd: 0 });

  G.hooks.damageAt = (pos: V3, radius: number, dmg: number) => {
    for (const p of G.props) if (!p.dead && p.pos.distanceTo(pos) < radius + p.r) { p.hp -= dmg; if (p.hp <= 0) breakProp(p); }
    for (const c of cars) {
      if (c.wreck) continue;
      if (c.pos.distanceTo(pos) < radius + 3 && dmg >= 20) {
        const d = new V3(c.pos.x - pos.x, 0, c.pos.z - pos.z).normalize();
        c.wreck = { pos: c.pos.clone(), vel: new V3(d.x * 14, rnd(10, 16), d.z * 14), spin: new V3(rnd(-4, 4), rnd(-3, 3), rnd(-4, 4)), rot: new V3(0, c.yaw, 0), t: 0 };
      }
    }
    if (dmg >= 20) scare(pos, radius + 30);
  };
  G.hooks.breakRing = (x: number, z: number, rad: number) => {
    for (const p of G.props) if (!p.dead && Math.abs(Math.hypot(p.pos.x - x, p.pos.z - z) - rad) < 4 + p.r * 0.5) { p.hp -= 400; if (p.hp <= 0) breakProp(p); }
    for (const c of cars) if (!c.wreck && Math.abs(Math.hypot(c.pos.x - x, c.pos.z - z) - rad) < 4) G.hooks.damageAt(new V3(x, 0, z), 0.1, 0, "e") ;
  };
}

/* ---------------- update ---------------- */
export function updateCity(dt: number, time: number) {
  // cars
  for (let i = 0; i < cars.length; i++) {
    const c = cars[i];
    if (c.wreck) {
      const w = c.wreck;
      w.t += dt;
      w.vel.y -= 30 * dt;
      w.pos.addScaledVector(w.vel, dt);
      if (w.pos.y < 0.3) { w.pos.y = 0.3; w.vel.y *= -0.3; w.vel.x *= 0.6; w.vel.z *= 0.6; w.spin.multiplyScalar(0.7); }
      w.rot.addScaledVector(w.spin, dt);
      if (Math.random() < 0.5) fx.em(w.pos.x, w.pos.y + 1, w.pos.z, rnd(-1, 1), rnd(2, 5), rnd(-1, 1), 0xff7a1a, 1.2, 0.6, -2);
      if (Math.random() < 0.3) fx.smoke(w.pos.x, w.pos.y + 1, w.pos.z, rnd(-1, 1), rnd(2, 4), rnd(-1, 1), 0x222222, 1.8, 1.5, -1, 1);
      c.pos.copy(w.pos);
      if (w.t > 14) { newCar(c); c.wreck = null; }
      Q.setFromEuler(new THREE.Euler(w.rot.x, w.rot.y, w.rot.z));
    } else {
      // brake for nearby player
      let sp = c.speed;
      c.s += c.dir * sp * dt;
      if (c.s > 280) c.s = -280;
      if (c.s < -280) c.s = 280;
      carTransform(c);
      const dx = c.pos.x - P.pos.x, dz = c.pos.z - P.pos.z;
      if (dx * dx + dz * dz < 100 && P.pos.y < 3) { c.s -= c.dir * sp * dt; }
      Q.setFromAxisAngle(new V3(0, 1, 0), c.yaw);
    }
    PP.set(c.pos.x, c.pos.y + 0.75, c.pos.z);
    const wy = c.wreck ? c.pos.y : 0;
    PP.y = wy + 0.75;
    S.set(1, 1, 1);
    // body (long axis X) — rotate by +90deg offset so it faces yaw
    const qb = Q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), Math.PI / 2));
    M4.compose(PP, qb, S);
    carBody.setMatrixAt(i, M4);
    carBody.setColorAt(i, COL.set(c.color));
    const off = new V3(-0.2, 0.85, 0).applyQuaternion(new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), 0));
    void off;
    const cp = new V3(0, 1.55, 0).applyQuaternion(qb).add(PP.clone().setY(PP.y - 0.75 + (c.wreck ? 0 : 0)));
    M4.compose(cp, qb, S);
    carCab.setMatrixAt(i, M4);
  }
  carBody.instanceMatrix.needsUpdate = true;
  carCab.instanceMatrix.needsUpdate = true;
  if (carBody.instanceColor) carBody.instanceColor.needsUpdate = true;
  // headlights at night: skip. props flicker not needed.

  // orbs
  for (let i = 0; i < orbs.length; i++) {
    const o = orbs[i];
    if (o.got) { M4.makeScale(0, 0, 0); orbMesh.setMatrixAt(i, M4); continue; }
    const d = Math.hypot(P.pos.x - o.p.x, P.pos.z - o.p.z);
    if (d < 4 && Math.abs(P.pos.y + 1 - o.p.y) < 4) {
      o.got = true; state.orbsGot++;
      const lv = useGame.getState().addXp(15);
      P.en[P.hero] = Math.min(P.maxEn[P.hero], P.en[P.hero] + 25);
      P.ult[P.hero] = Math.min(100, P.ult[P.hero] + 4);
      sfx("pickup");
      fx.burst(o.p, 0xffd23f, 18, 6, 0.4, 0.7, 0);
      toast(`Energy orb collected (${state.orbsGot}/${orbs.length}) +15 XP`, "#ffd23f");
      if (lv) { sfx("level"); toast(`LEVEL UP! Lv ${useGame.getState().level}`, "#ffd23f"); }
    }
    if (d < 150) {
      PP.set(o.p.x, o.p.y + Math.sin(time * 2 + i) * 0.4, o.p.z);
      Q.setFromAxisAngle(new V3(0, 1, 0), time * 1.5 + i);
      S.setScalar(1 + Math.sin(time * 4 + i) * 0.1);
      M4.compose(PP, Q, S);
    } else M4.makeScale(0, 0, 0);
    orbMesh.setMatrixAt(i, M4);
    if (d < 40 && Math.random() < 0.1) fx.em(o.p.x, o.p.y, o.p.z, rnd(-1, 1), rnd(0.5, 2), rnd(-1, 1), 0xffd23f, 0.4, 0.8);
  }
  orbMesh.instanceMatrix.needsUpdate = true;

  // props
  G.props = G.props.filter((p: any) => !p.dead);
  // portals
  for (const p of G.portals) {
    p.cd -= dt;
    if (Math.random() < 0.6) { const a = rnd(0, 6.28); fx.em(p.pos.x + Math.cos(a) * 2.3, 2.6 + Math.sin(a) * 2.3, p.pos.z, 0, rnd(0.5, 2), 0, 0xa070ff, 0.5, 0.8); }
    if (p.cd <= 0 && G.mode === "playing" && Math.hypot(P.pos.x - p.pos.x, P.pos.z - p.pos.z) < 2.2 && P.pos.y < 6) {
      p.cd = 2;
      G.hooks.usePortal?.(p.id);
    }
  }

  // civilians
  for (const c of G.civs as Civ[]) {
    const r = c.rig;
    const dp = Math.hypot(c.pos.x - P.pos.x, c.pos.z - P.pos.z);
    r.root.visible = dp < 170;
    if (dp > 130 && !c.trapped) continue;
    if (c.trapped) {
      c.state = "trapped";
      if (!c.rescued && dp < 3.2 && G.hooks.canRescue?.(c)) {
        c.rescued = true; c.trapped = false; c.state = "flee"; c.t = 6; c.threat = P.pos.clone();
        sfx("pickup"); fx.burst(c.pos.clone().add(new V3(0, 1, 0)), 0x66ffaa, 20, 5, 0.4, 0.8, 0);
        G.hooks.onRescue?.(c);
      }
      if (Math.random() < 0.12) fx.em(c.pos.x, 0.5, c.pos.z, rnd(-0.3, 0.3), rnd(2, 4), rnd(-0.3, 0.3), 0x66ffaa, 0.5, 1);
    }
    // threat detection
    if (c.state !== "trapped") {
      for (const e of G.enemies) {
        if (e.dead || !e.aggro) continue;
        if (Math.hypot(e.pos.x - c.pos.x, e.pos.z - c.pos.z) < 14) { c.state = "flee"; c.t = 3; c.threat = e.pos.clone(); break; }
      }
    }
    let spd = 0, tgtYaw = c.yaw;
    if (c.state === "flee") {
      c.t -= dt;
      if (c.threat) tgtYaw = Math.atan2(c.pos.x - c.threat.x, c.pos.z - c.threat.z);
      spd = 7.5;
      if (c.t <= 0) { c.state = "walk"; c.target = (c.axis === 0 ? c.pos.x : c.pos.z) + rnd(-40, 40); }
    } else if (c.state === "walk") {
      const cur = c.axis === 0 ? c.pos.x : c.pos.z;
      const diff = c.target - cur;
      if (Math.abs(diff) < 1) c.target = cur + rnd(-70, 70);
      tgtYaw = c.axis === 0 ? (diff > 0 ? Math.PI / 2 : -Math.PI / 2) : diff > 0 ? 0 : Math.PI;
      spd = c.speed;
      c.waveCd -= dt;
      if (dp < 9 && c.waveCd < 0 && G.mode === "playing") { c.state = "wave"; c.t = 3; c.waveCd = rnd(12, 25); }
    } else if (c.state === "wave") {
      c.t -= dt;
      tgtYaw = Math.atan2(P.pos.x - c.pos.x, P.pos.z - c.pos.z);
      if (c.t <= 0) c.state = "walk";
    }
    c.yaw = dampAng(c.yaw, tgtYaw, 8, dt);
    c.vel.set(Math.sin(c.yaw) * spd, 0, Math.cos(c.yaw) * spd);
    if (spd > 0) {
      moveBody(c.pos, 0.35, 1.7, c.vel.x * dt, 0, c.vel.z * dt);
      if (c.state === "flee") { c.pos.x = clamp(c.pos.x, -BOUND, BOUND); c.pos.z = clamp(c.pos.z, -BOUND, BOUND); }
    }
    r.root.position.copy(c.pos);
    r.root.rotation.y = c.yaw;
    r.phase += dt * (spd > 4 ? 12 : 6.5) * (spd > 0 ? 1 : 0);
    const sw = Math.sin(r.phase) * (spd > 4 ? 1 : 0.6) * (spd > 0 ? 1 : 0);
    r.legL.rotation.x = -sw; r.legR.rotation.x = sw;
    r.armL.rotation.x = sw; r.armR.rotation.x = -sw;
    r.armL.rotation.z = 0.1; r.armR.rotation.z = -0.1;
    r.body.position.y = 0.9 + (c.state === "trapped" ? -0.35 : 0);
    r.body.rotation.x = c.state === "trapped" ? 0.35 : spd > 4 ? 0.2 : 0;
    if (c.state === "wave") { r.armR.rotation.x = -2.8; r.armR.rotation.z = -0.2 + Math.sin(time * 10) * 0.35; r.armL.rotation.x = 0; }
    if (c.state === "flee") { r.armL.rotation.x = -2.6; r.armR.rotation.x = -2.6 + Math.sin(time * 14) * 0.2; }
    if (c.state === "trapped") { r.armL.rotation.x = -2.4; r.armR.rotation.x = -2.4; r.legL.rotation.x = -1.2; r.legR.rotation.x = -1.2; }
  }
}
export { angDiff as _ad };
