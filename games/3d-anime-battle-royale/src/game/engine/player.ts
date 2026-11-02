import { Vector3 } from 'three';
import { ITEMS } from '../data/items';
import { WEAPONS, weaponStats } from '../data/weapons';
import { raycastWorld, rayRes } from '../world/colliders';
import { angDiff, clamp } from '../util';
import { equipSlot, pickup, startHeal } from './inventory';
import { startThrow, hitSpheres, segSphere } from './combat';
import { enterVehicle, exitVehicle, VEH } from './vehicles';
import { Fighter } from './types';
import type { Game } from './Game';

export class Input {
  keys = new Set<string>();
  pressed = new Set<string>();
  dx = 0; dy = 0;
  lmb = false; rmb = false;
  locked = false;
  blocked = false;
  private el: HTMLElement | null = null;
  private cleanup: (() => void)[] = [];

  attach(el: HTMLElement) {
    this.el = el;
    const kd = (e: KeyboardEvent) => {
      if (e.repeat) return;
      this.keys.add(e.code); this.pressed.add(e.code);
      if (['Tab', 'Space'].includes(e.code)) e.preventDefault();
    };
    const ku = (e: KeyboardEvent) => this.keys.delete(e.code);
    const mm = (e: MouseEvent) => { if (this.locked) { this.dx += e.movementX; this.dy += e.movementY; } };
    const md = (e: MouseEvent) => { if (e.button === 0) this.lmb = true; if (e.button === 2) this.rmb = true; };
    const mu = (e: MouseEvent) => { if (e.button === 0) this.lmb = false; if (e.button === 2) this.rmb = false; };
    const cm = (e: Event) => e.preventDefault();
    const pl = () => { this.locked = document.pointerLockElement === el; if (!this.locked) { this.lmb = false; this.rmb = false; } };
    const blur = () => { this.keys.clear(); this.lmb = false; this.rmb = false; };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    window.addEventListener('mousemove', mm); el.addEventListener('mousedown', md); window.addEventListener('mouseup', mu);
    el.addEventListener('contextmenu', cm); document.addEventListener('pointerlockchange', pl); window.addEventListener('blur', blur);
    this.cleanup = [
      () => window.removeEventListener('keydown', kd), () => window.removeEventListener('keyup', ku), () => window.removeEventListener('mousemove', mm),
      () => el.removeEventListener('mousedown', md), () => window.removeEventListener('mouseup', mu), () => el.removeEventListener('contextmenu', cm),
      () => document.removeEventListener('pointerlockchange', pl), () => window.removeEventListener('blur', blur),
    ];
  }
  lock() { try { const p = this.el?.requestPointerLock() as unknown as Promise<void> | undefined; p?.catch?.(() => {}); } catch { /* ignore */ } }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }
  endFrame() { this.pressed.clear(); this.dx = 0; this.dy = 0; }
  dispose() { this.cleanup.forEach((c) => c()); this.cleanup = []; this.unlock(); }
}

export interface CamPose { pos: Vector3; dir: Vector3; fov: number; fpv: boolean; subject: Fighter; hideSubject: boolean }
const _pose: CamPose = { pos: new Vector3(), dir: new Vector3(), fov: 72, fpv: false, subject: null as unknown as Fighter, hideSubject: false };
const _p = new Vector3(), _r = new Vector3();

export function cameraPose(g: Game, dt: number): CamPose {
  const f = g.player;
  const subj = f.alive || !g.spectating ? f : g.spectating;
  const yaw = subj === f ? f.yaw : subj.yaw + g.specYaw, pitch = subj === f ? f.pitch : clamp(subj.pitch * 0.5 + g.specPitch, -1.2, 1.2);
  const d = _pose.dir.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  _r.set(-Math.cos(yaw), 0, Math.sin(yaw));
  let dist = 3, off = 0.6, up = 0.15, fov = 72, fpv = false;
  _pose.subject = subj; _pose.hideSubject = false;
  const cam = g.cam;
  const k = Math.min(1, dt * 12);
  const pv = _p;
  if (!f.alive && !g.spectating) { dist = 5; off = 0; }
  if (subj.state === 'plane') {
    pv.set(g.plane.pos.x, g.plane.pos.y + 4, g.plane.pos.z); dist = 70; off = 0; up = 0; _pose.hideSubject = true;
  } else if (subj.state === 'freefall' || subj.state === 'chute') {
    pv.set(subj.pos.x, subj.pos.y + 1.2, subj.pos.z); dist = subj.state === 'freefall' ? 6 : 8; off = 0; up = 0.5; fov = subj.state === 'freefall' ? 80 : 74;
  } else if (subj.state === 'vehicle' && subj.vehicle) {
    const v = subj.vehicle; pv.set(v.pos.x, v.pos.y + 1.7, v.pos.z); dist = v.type === 'bike' ? 5 : 7.2; off = 0; up = 0.8; fov = 70 + Math.min(14, Math.abs(v.speed) * 0.35);
  } else {
    const aiming = subj.aiming && subj.state === 'ground';
    const st = subj.weapon ? weaponStats(subj.weapon) : null;
    const zoom = aiming && st ? st.zoom : 1;
    pv.set(subj.pos.x, subj.pos.y + subj.eyeY + 0.12, subj.pos.z);
    dist = aiming ? (zoom >= 2.2 ? 0.05 : 1.15) : subj.stance === 'prone' ? 2.4 : 2.9;
    off = aiming ? (zoom >= 2.2 ? 0 : 0.42) : 0.62;
    fov = aiming ? 72 / zoom : subj.sprinting ? 78 : 72;
    fpv = aiming && zoom >= 2.2;
    _pose.hideSubject = fpv;
    if (subj.state === 'ground' && subj.stance === 'prone') up = -0.1;
  }
  cam.dist += (dist - cam.dist) * k; cam.off += (off - cam.off) * k; cam.fov += (fov - cam.fov) * Math.min(1, dt * 10);
  const cp = _pose.pos;
  cp.set(pv.x - d.x * cam.dist + _r.x * cam.off, pv.y - d.y * cam.dist + up, pv.z - d.z * cam.dist + _r.z * cam.off);
  if (!fpv && subj.state !== 'plane') {
    // camera collision
    const dx = cp.x - pv.x, dy = cp.y - pv.y, dz = cp.z - pv.z;
    const l = Math.hypot(dx, dy, dz);
    if (l > 0.2 && raycastWorld(g.world, pv.x, pv.y, pv.z, dx / l, dy / l, dz / l, l)) {
      const t = Math.max(0.3, rayRes.t - 0.25);
      cp.set(pv.x + (dx / l) * t, pv.y + (dy / l) * t, pv.z + (dz / l) * t);
    }
    const gh = g.world.heightAt(cp.x, cp.z);
    if (cp.y < gh + 0.25) cp.y = gh + 0.25;
  }
  if (fpv) cp.set(subj.pos.x + d.x * 0.25, subj.pos.y + subj.eyeY, subj.pos.z + d.z * 0.25).y += d.y * 0.25;
  _pose.fov = cam.fov; _pose.fpv = fpv;
  return _pose;
}

/** Crosshair ray -> shot direction */
export function computeAimDir(g: Game, f: Fighter, pose: CamPose, out: Vector3) {
  const d = pose.dir;
  const dist = pose.pos.distanceTo(new Vector3(f.pos.x, f.pos.y + f.eyeY, f.pos.z));
  const ox = pose.pos.x + d.x * (dist + 0.4), oy = pose.pos.y + d.y * (dist + 0.4), oz = pose.pos.z + d.z * (dist + 0.4);
  let t = 300;
  if (raycastWorld(g.world, ox, oy, oz, d.x, d.y, d.z, 300)) t = rayRes.t;
  for (const o of g.fighters) {
    if (o === f || !o.alive || o.state === 'plane') continue;
    if (Math.abs(o.pos.x - ox) > t + 2 && Math.abs(o.pos.z - oz) > t + 2) continue;
    const sp = hitSpheres(o);
    for (let i = 0; i < sp.length; i += 4) {
      const tt = segSphere(ox, oy, oz, d.x * t, d.y * t, d.z * t, sp[i], sp[i + 1], sp[i + 2], sp[i + 3]);
      if (tt >= 0 && tt * t < t) t = Math.max(0.5, tt * t);
    }
  }
  const px = ox + d.x * t, py = oy + d.y * t, pz = oz + d.z * t;
  const mx = f.pos.x, my = f.pos.y + f.eyeY - 0.12, mz = f.pos.z;
  return out.set(px - mx, py - my, pz - mz).normalize();
}

export function playerControl(g: Game, f: Fighter, inp: Input, dt: number) {
  const c = f.cmd;
  const live = !inp.blocked && inp.locked;
  const st = f.weapon ? weaponStats(f.weapon) : null;
  const zoomK = f.aiming && st ? Math.pow(st.zoom, 0.75) : 1;
  const sens = g.opts.sens * 0.0021 / zoomK;
  if (live) {
    if (f.alive) { f.yaw -= inp.dx * sens; f.pitch = clamp(f.pitch - inp.dy * sens, -1.3, 1.4); }
    else { g.specYaw -= inp.dx * sens; g.specPitch = clamp(g.specPitch - inp.dy * sens, -1, 1); }
  }
  const key = (code: string) => live && inp.keys.has(code);
  const prs = (code: string) => live && inp.pressed.has(code);
  if (!f.alive) {
    if (prs('Space') || (inp.lmb && g.time - g.specClick > 0.4)) { g.cycleSpectate(); g.specClick = g.time; }
    return;
  }
  c.mz = (key('KeyW') ? 1 : 0) - (key('KeyS') ? 1 : 0);
  c.mx = (key('KeyD') ? 1 : 0) - (key('KeyA') ? 1 : 0);
  c.sprint = key('ShiftLeft') || key('ShiftRight');
  c.jump = key('Space');
  if (prs('KeyC')) { g.pCrouch = !g.pCrouch; g.pProne = false; }
  if (prs('KeyZ')) { g.pProne = !g.pProne; g.pCrouch = false; }
  if (prs('Space') || (c.sprint && c.mz > 0)) { if (f.state === 'ground') { g.pCrouch = false; g.pProne = false; } }
  c.crouch = g.pCrouch; c.prone = g.pProne;
  c.fire = live && inp.lmb;
  c.aim = live && inp.rmb && f.state === 'ground';
  c.reload = prs('KeyR');
  f.aiming = c.aim;
  if (f.state === 'ground') {
    if (prs('Digit1')) equipSlot(g, f, 0);
    if (prs('Digit2')) equipSlot(g, f, 1);
    if (prs('Digit3')) equipSlot(g, f, 2);
    if (prs('Digit4')) g.useConsumable();
    if (prs('KeyG')) { if (!(f.throws[g.selThrow] > 0)) g.cycleThrow(); startThrow(g, f, g.selThrow); }
    if (prs('KeyX')) g.cycleThrow();
  }
  if (prs('KeyF')) interact(g, f);
  if (f.state === 'plane' && !inp.blocked && (inp.pressed.has('Space') || inp.pressed.has('KeyF'))) g.playerJump();
  if (f.state === 'vehicle') { c.fire = false; }
  // body orientation
  if (f.state === 'ground') {
    const recent = g.time - f.lastShot < 1.6;
    let target = f.bodyYaw;
    if (c.aim || recent || f.throwT > 0) target = f.yaw;
    else if (f.speedSm > 0.6) target = Math.atan2(f.vel.x, f.vel.z);
    f.bodyYaw += angDiff(f.bodyYaw, target) * Math.min(1, dt * (c.aim || recent ? 16 : 11));
  }
}

function interact(g: Game, f: Fighter) {
  if (f.state === 'vehicle') { exitVehicle(g, f); return; }
  if (f.state !== 'ground') return;
  const t = g.nearestInteract(f);
  if (!t) return;
  if (t.loot) {
    const name = pickup(g, f, t.loot);
    if (name) { g.toast(`Picked up ${name}`); g.sound({ k: 'pickup' }); }
    else g.toast(ITEMS[t.loot.item]?.kind === 'ammo' || ITEMS[t.loot.item]?.kind === 'heal' ? 'Backpack is full' : 'You already have better equipment');
  } else if (t.veh) enterVehicle(g, f, t.veh);
}

export { VEH, WEAPONS, startHeal };
