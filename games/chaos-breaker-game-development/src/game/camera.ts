import * as THREE from 'three';
import { input } from './input';
import { useGame } from './store';
import { W, angDiff, clamp, settings } from './world';

export const cam = { yaw: Math.PI, pitch: .32, dist: 6.4, focus: new THREE.Vector3(0, 1.4, 0), fov: 62, hubT: 0, trauma: 0, pos: new THREE.Vector3(), initialized: false, dollyIn: 0 };
const V = new THREE.Vector3(), V2 = new THREE.Vector3();

export function camForward() { return { x: Math.sin(cam.yaw), z: Math.cos(cam.yaw) }; }

export function updateCamera(dt: number, rawDt: number, mode: 'play' | 'hub') {
  const c = W.camera, P = W.P, s = settings();
  W.shake = Math.max(0, W.shake - rawDt * 2.2); W.fovPunch = Math.max(0, W.fovPunch - rawDt * 28);
  if (mode === 'hub') {
    cam.hubT += rawDt * .25; const a = cam.hubT + Math.PI;
    const wide = typeof window !== 'undefined' && window.innerWidth > 820, tab = useGame.getState().hubTab, sh = wide ? (tab === 'play' ? 1.55 : 2.6) : 0;
    const rx = Math.cos(a), rz = -Math.sin(a);
    cam.focus.lerp(V.set(P.pos.x - rx * sh, 1.3, P.pos.z - rz * sh), .12);
    c.position.set(P.pos.x + Math.sin(a) * 4.2, 1.6, P.pos.z + Math.cos(a) * 4.2); c.lookAt(cam.focus.x, 1.3, cam.focus.z); c.fov = 46; c.updateProjectionMatrix();
    cam.yaw = a + Math.PI; return;
  }
  // look input
  const k = input.camKeys(); const sens = s.sens;
  cam.yaw -= (input.look.x * .0024 * sens + k.x * rawDt * 2.4); cam.pitch = clamp(cam.pitch + input.look.y * .002 * sens + k.y * rawDt * 1.4, -.35, 1.15); input.look.x = input.look.y = 0;
  const cine = W.cine;
  let tgtDist = 6.2 * s.camDist + (P.state === 'attack' && P.atk?.cinematic ? 2 : 0);
  const fTarget = V.set(P.pos.x, P.pos.y * .6 + 1.45, P.pos.z);
  if (cine && cine.target) {
    const t = cine.target, k2 = cine.t / cine.dur, tp = V2.set(t.pos.x, t.def.scale * 1.2, t.pos.z);
    const mid = fTarget.clone().lerp(tp, .55); const d = Math.hypot(t.pos.x - P.pos.x, t.pos.z - P.pos.z), ang = Math.atan2(t.pos.x - P.pos.x, t.pos.z - P.pos.z) + Math.PI / 2 + k2 * 1.6 - .8;
    const dist = Math.max(9, d * 1.1 + t.def.scale * 3) * (1 - .15 * Math.sin(k2 * Math.PI));
    cam.focus.lerp(mid, Math.min(1, rawDt * 6)); c.position.lerp(V.set(mid.x + Math.sin(ang) * dist, 2 + t.def.scale * .9, mid.z + Math.cos(ang) * dist), Math.min(1, rawDt * 4));
    c.lookAt(cam.focus.x, cam.focus.y, cam.focus.z); c.fov += (50 - c.fov) * Math.min(1, rawDt * 3); c.updateProjectionMatrix(); return;
  }
  // lock-on
  if (P.lock && P.lock.alive) {
    const l = P.lock, ty = Math.atan2(l.pos.x - P.pos.x, l.pos.z - P.pos.z);
    cam.yaw += angDiff(cam.yaw, ty) * Math.min(1, rawDt * 5.5);
    const dd = Math.hypot(l.pos.x - P.pos.x, l.pos.z - P.pos.z); tgtDist += clamp(dd * .12, 0, 2.5);
    cam.pitch += (clamp(.3 + dd * .012 - l.def.scale * .04, .22, .55) - cam.pitch) * Math.min(1, rawDt * 3);
    fTarget.x += (l.pos.x - P.pos.x) * .18; fTarget.z += (l.pos.z - P.pos.z) * .18;
  }
  cam.dist += (tgtDist - cam.dist) * Math.min(1, rawDt * 4);
  cam.focus.lerp(fTarget, Math.min(1, rawDt * 11));
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  let d = cam.dist; V.set(-Math.sin(cam.yaw) * cp, sp, -Math.cos(cam.yaw) * cp);
  // collision: shorten boom against obstacles + arena wall
  const A = W.arena;
  if (A) {
    for (let st = 1; st <= 12; st++) {
      const dd = d * st / 12, x = cam.focus.x + V.x * dd, y = cam.focus.y + V.y * dd, z = cam.focus.z + V.z * dd;
      let hit = y < .35;
      if (!hit) for (const o of A.obstacles) if (y < 5 && Math.hypot(x - o.x, z - o.z) < o.r + .5) { hit = true; break; }
      if (!hit && A.edge === 'wall' && Math.hypot(x, z) > A.radius + 3.5 && y < 9) hit = true;
      if (hit) { d = Math.max(1.6, dd - d / 12); break; }
    }
  }
  const sh = W.shake * W.shake * s.shake, t = W.time * 40;
  c.position.set(cam.focus.x + V.x * d + Math.sin(t * 1.3) * sh * .22, Math.max(.4, cam.focus.y + V.y * d) + Math.sin(t * 1.7 + 2) * sh * .22, cam.focus.z + V.z * d + Math.cos(t * 1.1) * sh * .22);
  c.lookAt(cam.focus.x, cam.focus.y + .1, cam.focus.z); c.rotateZ(Math.sin(t * .9) * sh * .02);
  const sprint = P.sprinting ? 5 : 0, ult = P.atk?.cinematic ? 8 : 0, tf = s.fov + sprint + ult + W.fovPunch;
  c.fov += (tf - c.fov) * Math.min(1, rawDt * 8); c.updateProjectionMatrix(); void dt;
}
