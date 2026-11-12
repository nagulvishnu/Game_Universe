import * as THREE from 'three';
import { FORMS, ITEM_MAP, ITEMS } from './data';
import { AIM, G, K, V3, angDiff, clamp, damp, down, pressed, rnd } from './runtime';
import { buildRig, defaultAnim, setAura, setWeapon, updateRig, resolveLook, type Rig } from './rig';
import { castSkill, diveImpact, hurtActor, nearestHostile, startAttack, startDash, startDive, startTransform, center } from './combat';
import { derive, useGame } from './store';
import { fx } from './fx';
import { sfx, envUpdate } from './audio';
import { collide, query } from './world';
import { VSPECS } from './vehicles';

export const playerGroup = new THREE.Group();
export const P = { rig: null as Rig | null, key: '', anim: defaultAnim(), stepT: 0, wKey: '', camPos: new V3(), camTarget: new V3(), fov: 65, dist: 7, lookDir: new V3(0, 0, -1), trailT: 0 };
const tv = new V3(), tv2 = new V3(), tv3 = new V3();

const lr = { look: null as unknown, outfit: '', armor: '', accs: null as unknown, form: -1 };
export function rebuildPlayerRig() {
  const s = useGame.getState(); if (P.rig && s.look === lr.look && s.outfit === lr.outfit && s.armor === lr.armor && s.accs === lr.accs && G.p.form === lr.form) return;
  lr.look = s.look; lr.outfit = s.outfit; lr.armor = s.armor; lr.accs = s.accs; lr.form = G.p.form; const look = resolveLook(s, G.p.form); const key = JSON.stringify([look, G.p.form]);
  if (key === P.key && P.rig) return; P.key = key; if (P.rig) playerGroup.remove(P.rig.root); P.rig = buildRig(look, true); playerGroup.add(P.rig.root); P.wKey = '';
}
function syncWeapon() {
  const s = useGame.getState(); const w = ITEM_MAP[s.weapon]; const k = (w?.id ?? '') + P.key; if (!P.rig || k === P.wKey) return; P.wKey = k;
  if (w) setWeapon(P.rig, w.wtype!, w.color, w.id === 'photon_cannon'); else setWeapon(P.rig, '', '');
}
export function cycleWeapon() {
  const s = useGame.getState(); const ws = ITEMS.filter((i) => i.cat === 'Weapons' && s.inv[i.id]); if (!ws.length) return; const i = ws.findIndex((w) => w.id === s.weapon); const n = ws[(i + 1) % ws.length]; s.equipItem(n.id); s.toast(`Equipped ${n.name}`, n.color);
}

let moveDirOut = new V3();
export function updatePlayer(dt: number, _cam?: THREE.PerspectiveCamera) {
  const p = G.p; const st = useGame.getState(); const d = derive(st); const set = st.settings;
  // camera input
  p.camYaw -= K.mdx * 0.0024 * set.sens; p.camPitch += K.mdy * 0.002 * set.sens * (set.invertY ? -1 : 1);
  if (down('ArrowLeft')) p.camYaw += 2.2 * dt; if (down('ArrowRight')) p.camYaw -= 2.2 * dt; if (down('ArrowUp')) p.camPitch -= 1.6 * dt; if (down('ArrowDown')) p.camPitch += 1.6 * dt;
  p.camPitch = clamp(p.camPitch, -1.25, 1.35);
  if (K.wheel) st.setSettings({ camDist: clamp(set.camDist + K.wheel * 0.004, 3, 16) });
  if (pressed('KeyC')) { G.camMode = (G.camMode + 1) % 3; st.toast(['Third-person camera', 'Far cinematic camera', 'First-person camera'][G.camMode], '#9ca3af'); }
  const sinY = Math.sin(p.camYaw), cosY = Math.cos(p.camYaw);
  const fwd = tv.set(-sinY, 0, -cosY), right = tv2.set(cosY, 0, -sinY);
  let ix = (down('KeyD') ? 1 : 0) - (down('KeyA') ? 1 : 0), iz = (down('KeyW') ? 1 : 0) - (down('KeyS') ? 1 : 0);
  const mv = moveDirOut.set(0, 0, 0).addScaledVector(fwd, iz).addScaledVector(right, ix); const moving = mv.lengthSq() > 0.01; if (moving) mv.normalize();
  const locked = p.dead > 0 || G.cine.t > 0 || p.transT > 0;
  if (p.vehicle) { // driving
    p.flying = false; if (pressed('KeyF') || K.lmbP) { /* no melee in vehicles */ }
    p.speed = Math.abs(p.vehicle.speed); return;
  }
  // abilities
  if (!locked) {
    if (pressed('KeyE')) castSkill('e'); if (pressed('KeyR')) castSkill('r'); if (pressed('KeyV')) castSkill('v'); if (pressed('KeyT')) startTransform(); if (pressed('KeyZ')) cycleWeapon();
    if (pressed('KeyQ')) startDash(moving ? mv : null);
    const ctrl = down('ControlLeft', 'ControlRight');
    if (pressed('KeyF') || K.lmbP) { if (p.flying && ctrl) startDive(); else startAttack(false); } else if ((down('KeyF') || K.lmb) && p.atkT < 0.12) startAttack(false);
    if (K.rmbP) startAttack(true);
  }
  // space: jump / double-tap flight
  if (pressed('Space') && !locked) {
    const now = performance.now() / 1000;
    if (now - p.lastSpace < 0.32) { p.lastSpace = -1; p.flying = !p.flying; if (p.flying) { p.vel.y = Math.max(p.vel.y, 5); sfx('boost'); fx.ring(p.pos, '#ffffff', 3, 0.5); fx.burst(tv3.set(p.pos.x, p.pos.y + 0.5, p.pos.z), P.rig?.look.aura ?? '#fff', 16, 5, 0.6, 0.18); st.toast('FLIGHT ON', '#7dd3fc'); } else { st.toast('Flight off', '#9ca3af'); } }
    else { p.lastSpace = now; if (!p.flying && p.grounded) { p.vel.y = 10.5; p.grounded = false; sfx('jump'); } }
  }
  const shift = down('ShiftLeft', 'ShiftRight'); const ctrlDown = down('ControlLeft', 'ControlRight', 'KeyX');
  const prevYaw = p.yaw;
  if (p.dashT > 0) {
    p.dashT -= dt; p.vel.copy(p.dashDir); p.boost = false;
    fx.spark(p.pos.x, p.pos.y + 1, p.pos.z, rnd(-1, 1), rnd(-1, 1), rnd(-1, 1), 0.4, 0.3, p.skDash?.c1 ?? '#ffffff');
    const dmg = (p.skDash?.dmg ?? derive(st).base * derive(st).dmgMult * 0.7);
    for (const a of G.actors) { if (!a.alive || (a.team !== 'hero' && a.team !== 'enemy') || p.hit.has(a.id)) continue; if (Math.hypot(a.pos.x - p.pos.x, a.pos.z - p.pos.z) < 2.6 && Math.abs(center(a) - (p.pos.y + 1)) < 2.6) { p.hit.add(a.id); tv3.copy(p.dashDir).setY(2).normalize().multiplyScalar(11); hurtActor(a, dmg, { kb: tv3, cat: p.skDash?.cat ?? 'Martial Arts', player: true, heavy: true }); sfx('hit'); fx.burst(tv.set(a.pos.x, center(a), a.pos.z), p.skDash?.c1 ?? '#fff', 14, 6, 0.4, 0.2); } }
  } else if (p.diving) {
    p.boost = true;
  } else if (p.flying && !locked) {
    const baseS = 26 * d.flyMult; const boost = shift && p.en > 1 && (moving || ctrlDown === false);
    const fl = tv3.set(0, 0, 0); const aim = AIM; const rr = right;
    fl.addScaledVector(aim, iz).addScaledVector(rr, ix); if (down('Space')) fl.y += 1; if (ctrlDown) fl.y -= 1;
    const anyIn = fl.lengthSq() > 0.01; if (anyIn) fl.normalize();
    p.boost = boost && anyIn; const spd = p.boost ? 78 * d.flyMult : baseS * (p.atkT > 0 ? 0.5 : 1);
    if (p.boost) { if (p.slowT < 0 && !(P.trailT > 0)) { /* nothing */ } p.en = Math.max(0, p.en - 7 * dt); }
    const k = anyIn ? (p.boost ? 2.0 : 3.0) : 3.4;
    p.vel.x = damp(p.vel.x, fl.x * spd, k, dt); p.vel.y = damp(p.vel.y, fl.y * spd, k, dt); p.vel.z = damp(p.vel.z, fl.z * spd, k, dt);
    if (!anyIn) p.vel.y += Math.sin(performance.now() / 600) * 0.25 * dt;
    if (p.atkT <= 0 && p.castT <= 0) { const hv = Math.hypot(p.vel.x, p.vel.z); const ty = hv > 3 ? Math.atan2(p.vel.x, p.vel.z) : Math.atan2(-sinY, -cosY); p.yaw += angDiff(p.yaw, ty) * Math.min(1, 9 * dt); }
  } else if (!locked) {
    const spd = (shift ? 11.8 : 6.6) * d.speedMult * (p.atkT > 0 ? 0.35 : p.blockT > 0 ? 0.4 : p.castT > 0.1 ? 0.45 : p.slowT > 0 ? 0.5 : 1) * (p.landT > 0 ? 0.3 : 1);
    const k = p.grounded ? 14 : 3.5; p.vel.x = damp(p.vel.x, mv.x * spd, k, dt); p.vel.z = damp(p.vel.z, mv.z * spd, k, dt); p.boost = false;
    if (moving && p.atkT <= 0 && p.castT <= 0) p.yaw += angDiff(p.yaw, Math.atan2(mv.x, mv.z)) * Math.min(1, 14 * dt);
    else if (p.blockT > 0) p.yaw += angDiff(p.yaw, Math.atan2(-sinY, -cosY)) * Math.min(1, 10 * dt);
    p.vel.y = Math.max(-70, p.vel.y - 30 * dt);
  } else { p.vel.x = damp(p.vel.x, 0, 8, dt); p.vel.z = damp(p.vel.z, 0, 8, dt); if (!p.flying) p.vel.y -= 30 * dt; else p.vel.y = damp(p.vel.y, 0, 3, dt); }
  if (p.stun > 0) p.stun -= dt;
  // integrate & collide
  const fall = p.vel.y; p.pos.addScaledVector(p.vel, dt);
  const base = 0; const c = collide(p.pos, p.vel, 0.45, 1.8, base);
  if (p.diving) {
    const near = nearestHostile(p.pos, 2.4, undefined, Math.PI); if (c.hit || c.ceil || p.pos.y <= c.ground + 0.2 || near) { p.pos.y = Math.max(p.pos.y, c.ground); diveImpact(); p.flying = false; p.grounded = true; }
  } else if (p.flying) {
    if (p.pos.y <= c.ground + 0.02 && p.vel.y <= 0.5 && (ctrlDown || p.vel.y < -1 || !moving)) { // landing
      p.flying = false; p.pos.y = c.ground; p.grounded = true; const hard = -fall > 30 || Math.hypot(p.vel.x, p.vel.z) > 40; p.landT = hard ? 0.55 : 0.32;
      if (hard) { fx.ring(p.pos, '#ffffff', 7, 0.6); fx.burst(p.pos, '#bbbbbb', 26, 7, 0.7, 0.3, 4); G.shake = Math.max(G.shake, 0.5); sfx('slam'); } else sfx('land'); p.vel.x *= 0.4; p.vel.z *= 0.4; p.vel.y = 0;
    } else if (p.pos.y < c.ground) { p.pos.y = c.ground; if (p.vel.y < 0) p.vel.y = 0; }
    p.pos.y = Math.min(p.pos.y, 700);
  } else {
    if (p.pos.y <= c.ground + 0.001 && p.vel.y <= 0) { const wasAir = !p.grounded; p.pos.y = c.ground; if (wasAir && -fall > 8) { p.landT = clamp(-fall / 50, 0.15, 0.5); sfx('land'); if (-fall > 28) { fx.ring(p.pos, '#ffffff', 5, 0.5); fx.burst(p.pos, '#aaa', 14, 5, 0.5, 0.25, 3); G.shake = 0.4; } } p.grounded = true; p.vel.y = 0; } else p.grounded = false;
  }
  if (p.interior) { p.pos.x = clamp(p.pos.x, 1900, 2200); p.pos.z = clamp(p.pos.z, -100, 700); } else { p.pos.x = clamp(p.pos.x, -640, 640); p.pos.z = clamp(p.pos.z, -640, 640); }
  p.speed = Math.hypot(p.vel.x, p.vel.y, p.vel.z); const hs = Math.hypot(p.vel.x, p.vel.z);
  p.turn = damp(p.turn, clamp(angDiff(prevYaw, p.yaw) / Math.max(dt, 0.001) * 0.35, -1, 1), 6, dt);
  // fly distance mission
  if (p.flying) { G.flyAcc += p.speed * dt; while (G.flyAcc >= 100) { G.flyAcc -= 100; st.evt('fly'); } }
  // footsteps
  if (p.grounded && hs > 2 && !locked) { P.stepT -= dt * hs * 0.16; if (P.stepT < 0) { P.stepT = 1; sfx('step'); if (hs > 9) fx.spark(p.pos.x, 0.1, p.pos.z, rnd(-1, 1), rnd(0.5, 1.5), rnd(-1, 1), 0.4, 0.14, '#999'); } }
  // trails & wind
  const aura = P.rig?.look.aura ?? '#fff';
  if ((p.flying && p.speed > 20) || p.dashT > 0) {
    const n = p.boost ? 4 : 1; for (let i = 0; i < n; i++) fx.spark(p.pos.x + rnd(-0.4, 0.4), p.pos.y + 1 + rnd(-0.5, 0.5), p.pos.z + rnd(-0.4, 0.4), -p.vel.x * 0.1 + rnd(-1, 1), rnd(-0.5, 0.5), -p.vel.z * 0.1 + rnd(-1, 1), 0.5, p.boost ? 0.3 : 0.18, i % 2 ? aura : '#ffffff');
    if (p.speed > 40) { const s = p.speed; for (let i = 0; i < 3; i++) { tv3.set(rnd(-6, 6), rnd(-4, 5), rnd(-6, 6)).add(p.pos); fx.spark(tv3.x, tv3.y, tv3.z, -p.vel.x * 0.8, -p.vel.y * 0.8, -p.vel.z * 0.8, 0.18, 0.05 + s * 0.0006, '#ffffff'); } }
  }
  if (p.flying && !p.boost && p.speed < 5 && Math.random() < 0.3) fx.spark(p.pos.x + rnd(-0.3, 0.3), p.pos.y + 0.1, p.pos.z + rnd(-0.3, 0.3), rnd(-0.4, 0.4), -rnd(0.5, 2), rnd(-0.4, 0.4), 0.5, 0.12, aura);
  if (p.form > 0 && Math.random() < 0.6) fx.spark(p.pos.x + rnd(-0.5, 0.5), p.pos.y + rnd(0, 1.8), p.pos.z + rnd(-0.5, 0.5), rnd(-0.5, 0.5), rnd(1, 4), rnd(-0.5, 0.5), 0.7, 0.15, FORMS[p.form].aura);
  envUpdate(p.flying || p.vehicle ? clamp(p.speed / 70, 0, 1) : 0, G.rain);
  p.hit.size > 200 && p.hit.clear();
}

export function updatePlayerRig(dt: number) {
  const p = G.p; rebuildPlayerRig(); const rig = P.rig!; syncWeapon(); const a = P.anim; const st = useGame.getState(); const w = ITEM_MAP[st.weapon]; const veh = p.vehicle; const bike = veh ? VSPECS[veh.type].bike : false;
  a.wtype = w?.wtype ?? ''; a.speed = Math.hypot(p.vel.x, p.vel.z); a.vy = p.vel.y; a.lean = p.turn; a.combo = p.combo; a.heavy = p.heavy; a.atkP = clamp(1 - p.atkT / p.atkDur, 0, 1); a.hit = clamp(p.hitT * 3, 0, 1);
  a.castP = clamp(1 - p.castT / (p.castT > 0.52 ? 1.0 : 0.5), 0, 1); a.transP = G.cine.t / Math.max(0.1, G.cine.dur); a.landP = clamp(1 - p.landT / 0.45, 0, 1); a.boost = damp(a.boost, p.boost || p.diving ? 1 : 0, 6, dt); a.fly01 = damp(a.fly01, p.flying || p.diving ? clamp(p.speed / 50, 0, 1) : 0, 6, dt);
  if (p.dead > 0) a.mode = 'dead'; else if (p.transT > 0) a.mode = 'transform'; else if (veh) a.mode = bike ? 'ride' : 'idle'; else if (p.atkT > 0) { a.mode = 'attack'; if (p.flying) a.fly01 = Math.max(a.fly01, 0.35); } else if (p.castT > 0) { a.mode = 'cast'; a.fly01 = p.flying ? Math.max(a.fly01, 0.3) : 0; } else if (p.hitT > 0.12) a.mode = 'hit'; else if (p.blockT > 0) a.mode = 'block'; else if (p.dashT > 0) a.mode = 'dash'; else if (p.diving) a.mode = 'dive'; else if (p.flying) a.mode = 'fly'; else if (p.landT > 0) a.mode = 'land'; else if (!p.grounded) a.mode = 'air'; else a.mode = a.speed > 0.6 ? 'run' : 'idle';
  const hidden = (veh && !bike) || (G.camMode === 2 && !veh);
  rig.root.visible = !hidden; playerGroup.position.copy(p.pos); rig.root.rotation.y = p.yaw; rig.root.position.set(0, 0, 0);
  if (veh && bike) { playerGroup.position.set(veh.pos.x, veh.pos.y + 0.0, veh.pos.z); rig.root.rotation.set(0, veh.yaw, 0); rig.root.position.set(0, 0.15, 0); rig.root.position.addScaledVector(tv.set(Math.sin(veh.yaw), 0, Math.cos(veh.yaw)), -0.4); rig.root.rotation.z = veh.roll; }
  else rig.root.rotation.z = 0;
  const f = FORMS[p.form]; const shield = p.shield > 0; const strong = p.transT > 0 ? 1 : p.form > 0 ? 0.55 : p.boost ? 0.45 : shield ? 0.6 : p.castT > 0.1 ? 0.35 : p.flying ? 0.12 : 0;
  updateRig(rig, a, dt, p.flying ? clamp(p.speed / 40, 0, 1.2) : clamp(a.speed / 12, 0, 1)); setAura(rig, strong, shield ? '#7df9ff' : p.form ? f.aura : rig.look.aura);
  if (p.flying && !p.boost && a.speed < 2) a.fly01 = 0;
}

// ───────────── camera ─────────────
export function updateCamera(dt: number, cam: THREE.PerspectiveCamera) {
  const p = G.p; const set = useGame.getState().settings; const veh = p.vehicle; const sp = veh ? VSPECS[veh.type] : null;
  if (veh && K.mdx === 0 && !down('ArrowLeft', 'ArrowRight')) p.camYaw += angDiff(p.camYaw, veh.yaw + Math.PI) * Math.min(1, (Math.abs(veh.speed) > 3 ? 2.2 : 0.4) * dt);
  const heightOff = veh ? 1.8 : p.flying ? 1.2 : 1.55; const tgt = tv.set(p.pos.x, p.pos.y + heightOff, p.pos.z);
  if (P.camTarget.lengthSq() === 0 || P.camTarget.distanceToSquared(tgt) > 40000) P.camTarget.copy(tgt); P.camTarget.x = damp(P.camTarget.x, tgt.x, 18, dt); P.camTarget.y = damp(P.camTarget.y, tgt.y, 12, dt); P.camTarget.z = damp(P.camTarget.z, tgt.z, 18, dt);
  let dist = set.camDist * (veh ? 1.45 : 1) * (p.flying ? 1.25 : 1) * (G.camMode === 1 ? 1.9 : 1); let yaw = p.camYaw, pitch = p.camPitch; let fov = 64;
  const spd = p.speed; if (p.flying) fov += clamp(spd / 78, 0, 1) * 26; if (veh && sp) fov += clamp(Math.abs(veh.speed) / sp.max, 0, 1) * 16; if (p.dashT > 0) fov += 8;
  let cine = false;
  if (G.cine.t > 0) { cine = true; const t = G.cine.t / G.cine.dur; yaw = p.camYaw + t * 2.4; dist = 6.2 - t * 2.4; pitch = 0.1 - Math.sin(t * Math.PI) * 0.15 + t * 0.35; fov = 52 + Math.pow(t, 3) * 45; P.camTarget.set(p.pos.x, p.pos.y + 1.3 + t * 0.8, p.pos.z); }
  P.fov = damp(P.fov, fov, 6, dt); cam.fov = P.fov; cam.updateProjectionMatrix();
  const dir = tv2.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)); const t0 = P.camTarget;
  if (G.camMode === 2 && !veh && !cine) {
    cam.position.set(p.pos.x + Math.sin(p.yaw) * 0.15, p.pos.y + 1.68, p.pos.z + Math.cos(p.yaw) * 0.15); P.lookDir.copy(dir).multiplyScalar(-1); cam.lookAt(tv3.copy(cam.position).add(P.lookDir));
  } else {
    let d = dist; for (let i = 1; i <= 14; i++) { const k = (i / 14) * dist; const x = t0.x + dir.x * k, y = t0.y + dir.y * k, z = t0.z + dir.z * k; let hit = y < 0.4 && !p.interior; if (!hit) for (const b of query(x, z, 0.5)) { if (x > b.x0 - 0.2 && x < b.x1 + 0.2 && z > b.z0 - 0.2 && z < b.z1 + 0.2 && y > b.y0 && y < b.y1 + 0.2 && !(p.pos.y >= b.y1 - 0.6)) { hit = true; break; } } if (hit) { d = Math.max(1.2, k - 0.7); break; } }
    cam.position.set(t0.x + dir.x * d, Math.max(0.35, t0.y + dir.y * d), t0.z + dir.z * d); cam.lookAt(t0.x, t0.y + (cine ? 0 : 0.0), t0.z); P.lookDir.copy(dir).multiplyScalar(-1);
  }
  if (G.shake > 0.01) { cam.position.x += rnd(-1, 1) * G.shake * 0.35; cam.position.y += rnd(-1, 1) * G.shake * 0.35; cam.position.z += rnd(-1, 1) * G.shake * 0.35; G.shake *= Math.exp(-5 * dt); }
  // aim: converge on a point far in front of camera
  const ap = tv3.copy(cam.position).addScaledVector(P.lookDir, 45); AIM.copy(ap).sub(tv.set(p.pos.x, p.pos.y + 1.3, p.pos.z)).normalize();
  if (G.camMode === 2) AIM.copy(P.lookDir);
}
