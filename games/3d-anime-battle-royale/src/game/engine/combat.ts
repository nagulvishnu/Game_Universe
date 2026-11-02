import { Vector3 } from 'three';
import { ARMOR_TIERS, HELMET_TIERS } from '../data/items';
import { WEAPONS, weaponStats } from '../data/weapons';
import { hasLOS, raycastWorld, rayRes } from '../world/colliders';
import { Bullet, Fighter, Grenade } from './types';
import { startReload } from './inventory';
import type { Game } from './Game';

export type Part = 'head' | 'body' | 'legs';
export type DmgKind = 'bullet' | 'explosion' | 'zone' | 'fall' | 'vehicle';

export const newBullet = (): Bullet => ({ active: false, x: 0, y: 0, z: 0, px: 0, py: 0, pz: 0, vx: 0, vy: 0, vz: 0, owner: -1, weapon: '', dmg: 0, hs: 1, travelled: 0, maxDist: 0, range: 0, color: '#fff', life: 0, sup: false });

/** Hit volumes (sphere centre x,y,z,r) for a fighter */
const SP: number[] = [];
export function hitSpheres(f: Fighter): number[] {
  SP.length = 0;
  const p = f.pos;
  if (f.state === 'ground' && f.stance === 'prone') {
    const fx = Math.sin(f.bodyYaw), fz = Math.cos(f.bodyYaw);
    SP.push(p.x + fx * 0.85, p.y + 0.28, p.z + fz * 0.85, 0.23);
    SP.push(p.x + fx * 0.25, p.y + 0.28, p.z + fz * 0.25, 0.3);
    SP.push(p.x - fx * 0.35, p.y + 0.25, p.z - fz * 0.35, 0.28);
  } else if (f.stance === 'crouch' && f.state === 'ground') {
    SP.push(p.x, p.y + 1.18, p.z, 0.23);
    SP.push(p.x, p.y + 0.8, p.z, 0.36);
    SP.push(p.x, p.y + 0.35, p.z, 0.38);
  } else {
    SP.push(p.x, p.y + 1.7, p.z, 0.23);
    SP.push(p.x, p.y + 1.25, p.z, 0.36);
    SP.push(p.x, p.y + 0.85, p.z, 0.37);
    SP.push(p.x, p.y + 0.4, p.z, 0.36);
  }
  return SP;
}

export function segSphere(x0: number, y0: number, z0: number, dx: number, dy: number, dz: number, cx: number, cy: number, cz: number, r: number) {
  const mx = x0 - cx, my = y0 - cy, mz = z0 - cz;
  const a = dx * dx + dy * dy + dz * dz;
  const b = mx * dx + my * dy + mz * dz;
  const c = mx * mx + my * my + mz * mz - r * r;
  const disc = b * b - a * c;
  if (disc < 0) return -1;
  let t = (-b - Math.sqrt(disc)) / a;
  if (c < 0) t = 0;
  return t >= 0 && t <= 1 ? t : -1;
}

export function damage(g: Game, v: Fighter, amount: number, part: Part, attacker: Fighter | null, weapon: string, kind: DmgKind) {
  if (!v.alive || amount <= 0 || !isFinite(amount) || g.ended) return 0;
  let dmg = amount;
  const raw = amount;
  if (kind !== 'zone' && kind !== 'fall') {
    if (part === 'head' && kind === 'bullet') {
      if (v.helmetHp > 0) {
        const ab = Math.min(v.helmetHp, dmg * HELMET_TIERS[v.helmet].reduce);
        v.helmetHp -= ab * 0.9; dmg -= ab;
        if (v.helmetHp <= 0) { v.helmetHp = 0; v.helmet = 0; }
      }
    } else if (v.armorHp > 0) {
      const ab = Math.min(v.armorHp, dmg * ARMOR_TIERS[v.armor].absorb);
      v.armorHp -= ab; dmg -= ab;
      if (v.armorHp <= 0.01) { v.armorHp = 0; v.armor = 0; }
    }
  }
  v.hp = Math.max(0, v.hp - dmg);
  v.hitT = 0.3; v.lastDmgT = g.time;
  if (v.healT > 0 && kind !== 'zone') { v.healT = 0; v.healItem = ''; }
  if (attacker && attacker !== v) {
    v.lastDmgFrom = attacker.id;
    attacker.damageDealt += raw;
    if (part === 'head' && kind === 'bullet') attacker.headshots++;
    if (v.bot) {
      v.bot.lastSeen = [attacker.pos.x + (Math.random() - 0.5) * 8, attacker.pos.z + (Math.random() - 0.5) * 8, g.time];
      v.bot.heardPos = [attacker.pos.x, attacker.pos.z, g.time];
    }
    if (attacker.isPlayer) {
      g.lastHit = { t: g.time, amt: raw, head: part === 'head' };
      g.hitmark = { t: g.time, head: part === 'head', kill: v.hp <= 0 };
      g.sound({ k: 'hit', head: part === 'head' });
    }
  }
  if (v.isPlayer) {
    if (kind !== 'zone' && kind !== 'fall') {
      const src = attacker ? Math.atan2(attacker.pos.x - v.pos.x, attacker.pos.z - v.pos.z) : v.yaw + Math.PI;
      g.dmgInd.push({ ang: src, t: g.time });
    }
    g.hurtFlash = Math.min(1, g.hurtFlash + dmg / 40);
    g.sound({ k: 'hit', head: false });
  }
  if (v.hp <= 0) eliminate(g, v, attacker, weapon, part === 'head' && kind === 'bullet');
  return dmg;
}

export function dropEverything(g: Game, f: Fighter) {
  g.dropHint = f.pos.y;
  const sp = () => (Math.random() - 0.5) * 2.4;
  for (const w of f.slots) if (w) g.spawnLoot(f.pos.x + sp(), f.pos.z + sp(), 'w_' + w.id, 1, w);
  f.slots = [null, null, null];
  for (const t of ['light', 'rifle', 'sniper', 'shell'] as const) if (f.ammo[t] > 0) { g.spawnLoot(f.pos.x + sp(), f.pos.z + sp(), 'ammo_' + t, f.ammo[t]); f.ammo[t] = 0; }
  for (const k of ['bandage', 'medkit']) if (f.heal[k] > 0) { g.spawnLoot(f.pos.x + sp(), f.pos.z + sp(), k, f.heal[k]); f.heal[k] = 0; }
  for (const k of ['frag', 'smoke', 'flash']) if (f.throws[k] > 0) { g.spawnLoot(f.pos.x + sp(), f.pos.z + sp(), k, f.throws[k]); f.throws[k] = 0; }
  for (const k in f.atts) if (f.atts[k] > 0) { g.spawnLoot(f.pos.x + sp(), f.pos.z + sp(), 'att_' + k, f.atts[k]); f.atts[k] = 0; }
  if (f.armor > 0 && f.armorHp > 0) { g.spawnLoot(f.pos.x + sp(), f.pos.z + sp(), 'armor_' + f.armor, 1, undefined, f.armorHp); }
  if (f.helmet > 0 && f.helmetHp > 0) { g.spawnLoot(f.pos.x + sp(), f.pos.z + sp(), 'helmet_' + f.helmet, 1, undefined, f.helmetHp); }
  if (f.pack > 0) g.spawnLoot(f.pos.x + sp(), f.pos.z + sp(), 'pack_' + f.pack, 1);
  f.armor = f.helmet = f.pack = 0; f.armorHp = f.helmetHp = 0;
}

export function eliminate(g: Game, v: Fighter, killer: Fighter | null, weapon: string, head: boolean) {
  if (!v.alive) return;
  if (v.dummy) {
    v.alive = false; v.hp = 0; v.state = 'dead'; v.diedAt = g.time; v.deadT = 0;
    if (killer && killer.isPlayer) { killer.kills++; g.sound({ k: 'kill' }); }
    return;
  }
  v.alive = false;
  v.hp = 0;
  const wasInVehicle = v.vehicle;
  if (wasInVehicle && wasInVehicle.driver === v) wasInVehicle.driver = null;
  v.vehicle = null;
  v.state = 'dead';
  v.diedAt = g.time;
  v.deadT = 0;
  v.placement = g.aliveCount;
  g.aliveCount = Math.max(0, g.aliveCount - 1);
  v.healT = 0; v.reloadT = 0;
  v.killedBy = killer && killer !== v ? killer.name : weapon === 'zone' ? 'the Storm' : weapon === 'fall' ? 'a Fall' : 'Unknown';
  v.killerId = killer ? killer.id : -1;
  if (killer && killer !== v) {
    killer.kills++;
    killer.weaponKills[weapon] = (killer.weaponKills[weapon] || 0) + 1;
  }
  const wn = weapon;
  g.feed.push({ t: g.time, killer: killer && killer !== v ? killer.name : '', victim: v.name, weapon: wn, head, you: !!killer && killer.isPlayer && killer !== v, me: v.isPlayer });
  if (g.feed.length > 8) g.feed.shift();
  if (killer && killer.isPlayer && killer !== v) g.sound({ k: 'kill' });
  if (g.mode === 'match') dropEverything(g, v);
  g.onDeath(v, killer);
}

/* ---------------- shooting ---------------- */
export function updateShooting(g: Game, f: Fighter) {
  const c = f.cmd;
  const w = f.weapon;
  const press = c.fire && !f.prevFire;
  f.prevFire = c.fire;
  if (!w || f.state !== 'ground' || f.healT > 0 || f.switchT > 0 || f.throwT > 0) return;
  const st = weaponStats(w);
  const d = st.def;
  if (f.reloadT > 0) {
    if (d.reloadEach && c.fire && w.mag > 0) f.reloadT = 0;
    else return;
  }
  if (f.sprinting) return;
  if (c.reload) { startReload(g, f); return; }
  if (f.burstLeft > 0 && f.fireCd <= 0) {
    if (w.mag > 0) { shoot(g, f, st); f.burstLeft--; f.fireCd = f.burstLeft > 0 ? 0.075 : st.interval * 2.2; } else f.burstLeft = 0;
    return;
  }
  if (!c.fire || f.fireCd > 0) return;
  if (d.mode !== 'auto' && !press) return;
  if (w.mag <= 0) {
    if (press) { g.sound({ k: 'click' }); }
    if (f.ammo[d.ammo] > 0) startReload(g, f);
    return;
  }
  shoot(g, f, st);
  if (d.mode === 'burst') { f.burstLeft = (d.burst ?? 3) - 1; f.fireCd = 0.075; }
  else f.fireCd = st.interval;
}

const _d = new Vector3(), _r = new Vector3(), _u = new Vector3();
function shoot(g: Game, f: Fighter, st: ReturnType<typeof weaponStats>) {
  const w = f.weapon!;
  const d = st.def;
  w.mag--;
  f.shots++;
  f.weaponShots[d.id] = (f.weaponShots[d.id] || 0) + 1;
  const base = f.cmd.aimDir ?? _d.set(Math.sin(f.yaw) * Math.cos(f.pitch), Math.sin(f.pitch), Math.cos(f.yaw) * Math.cos(f.pitch));
  const dir = new Vector3().copy(base).normalize();
  _r.set(dir.z, 0, -dir.x).normalize();
  _u.crossVectors(dir, _r).normalize();
  const stanceMul = f.stance === 'crouch' ? 0.8 : f.stance === 'prone' ? 0.6 : 1;
  const sp = st.spread * (f.aiming ? st.adsMul : 1) * stanceMul * (1 + f.speedSm * 0.1) * (f.grounded ? 1 : 2.2) * (1 + f.bloom * 1.4) * (f.flashT > 0 ? 3 : 1);
  const mx = f.pos.x + dir.x * 1.0 + _r.x * 0.2, my = f.pos.y + f.eyeY - 0.3 + dir.y * 1.0, mz = f.pos.z + dir.z * 1.0 + _r.z * 0.2;
  for (let i = 0; i < d.pellets; i++) {
    const a = Math.random() * 6.283, rr = Math.sqrt(Math.random()) * sp;
    const bx = dir.x + _r.x * Math.cos(a) * rr + _u.x * Math.sin(a) * rr;
    const by = dir.y + _r.y * Math.cos(a) * rr + _u.y * Math.sin(a) * rr;
    const bz = dir.z + _r.z * Math.cos(a) * rr + _u.z * Math.sin(a) * rr;
    const l = Math.hypot(bx, by, bz);
    const b = g.freeBullet();
    b.active = true; b.x = b.px = mx; b.y = b.py = my; b.z = b.pz = mz;
    b.vx = (bx / l) * d.speed; b.vy = (by / l) * d.speed; b.vz = (bz / l) * d.speed;
    b.owner = f.id; b.weapon = d.id; b.dmg = d.dmg; b.hs = d.hs; b.travelled = 0; b.range = d.range; b.maxDist = d.range * 1.7; b.color = d.tracer; b.life = 3; b.sup = st.suppress;
  }
  f.bloom = Math.min(1, f.bloom + 0.1 + st.recoil * 0.03);
  f.kickT = 0.12; f.lastShot = g.time;
  const rk = (st.recoil * Math.PI) / 180 * (f.aiming ? 0.8 : 1);
  if (f.isPlayer) { f.pitch = Math.min(1.3, f.pitch + rk * 0.7); f.yaw += (Math.random() - 0.5) * rk * 0.5; }
  g.fx({ k: 'muzzle', x: mx, y: my, z: mz, dx: dir.x, dy: dir.y, dz: dir.z, color: d.tracer, big: d.cat === 'SHOTGUN' || d.cat === 'SNIPER' ? 1.6 : d.cat === 'PISTOL' ? 0.7 : 1, sup: st.suppress });
  g.sound({ k: 'shot', x: mx, y: my, z: mz, f: d.sfx.f, len: d.sfx.len, noise: d.sfx.noise, pitch: d.sfx.pitch, sup: st.suppress, own: f.isPlayer });
  g.alertShot(f, st.suppress ? d.loud * 0.28 : d.loud);
}

/* ---------------- bullets ---------------- */
export function updateBullets(g: Game, dt: number) {
  for (const b of g.bullets) {
    if (!b.active) continue;
    b.life -= dt;
    if (b.life <= 0) { b.active = false; continue; }
    b.px = b.x; b.py = b.y; b.pz = b.z;
    b.vy -= 9.8 * dt;
    const sx = b.vx * dt, sy = b.vy * dt, sz = b.vz * dt;
    const len = Math.hypot(sx, sy, sz);
    const ux = sx / len, uy = sy / len, uz = sz / len;
    let tw = len + 1;
    let kind = 0, nx = 0, ny = 1, nz = 0;
    if (raycastWorld(g.world, b.x, b.y, b.z, ux, uy, uz, len)) { tw = rayRes.t; kind = rayRes.kind; nx = rayRes.nx; ny = rayRes.ny; nz = rayRes.nz; }
    // entities
    let te = len + 1, hitF: Fighter | null = null, part: Part = 'body';
    const mx = b.x + sx / 2, my = b.y + sy / 2, mz = b.z + sz / 2;
    const reach = len / 2 + 2.2;
    for (const f of g.fighters) {
      if (!f.alive || f.id === b.owner || f.state === 'plane' || f.state === 'vehicle' && false) continue;
      if (Math.abs(f.pos.x - mx) > reach + 1 || Math.abs(f.pos.z - mz) > reach + 1) continue;
      const sp = hitSpheres(f);
      for (let i = 0; i < sp.length; i += 4) {
        const t = segSphere(b.x, b.y, b.z, sx, sy, sz, sp[i], sp[i + 1], sp[i + 2], sp[i + 3]);
        if (t >= 0 && t * len < te) {
          te = t * len; hitF = f;
          part = i === 0 ? 'head' : sp[i + 1] - f.pos.y < 0.55 && f.stance !== 'prone' ? 'legs' : 'body';
        }
      }
    }
    // vehicles
    let hitV = null as null | (typeof g.vehicles)[number], tv = len + 1;
    for (const v of g.vehicles) {
      if (v.dead) continue;
      const t = segSphere(b.x, b.y, b.z, sx, sy, sz, v.pos.x, v.pos.y + 0.9, v.pos.z, v.type === 'bike' ? 1.0 : 1.9);
      if (t >= 0 && t * len < tv) { tv = t * len; hitV = v; }
    }
    const best = Math.min(tw, te, tv);
    if (best <= len) {
      const px = b.x + ux * best, py = b.y + uy * best, pz = b.z + uz * best;
      if (best === te && hitF) {
        const att = g.fighters[b.owner] ?? null;
        const fall = b.travelled <= b.range ? 1 : Math.max(0.45, 1 - ((b.travelled - b.range) / (b.range * 0.7)) * 0.55);
        let dm = b.dmg * fall;
        if (part === 'head') dm *= b.hs; else if (part === 'legs') dm *= 0.8;
        g.fx({ k: 'impact', x: px, y: py, z: pz, nx: -ux, ny: -uy, nz: -uz, kind: 'flesh' });
        damage(g, hitF, dm, part, att, b.weapon, 'bullet');
      } else if (best === tv && hitV) {
        g.damageVehicle(hitV, b.dmg * 0.6, g.fighters[b.owner] ?? null);
        g.fx({ k: 'impact', x: px, y: py, z: pz, nx: -ux, ny: -uy, nz: -uz, kind: 'metal' });
      } else {
        g.fx({ k: 'impact', x: px, y: py, z: pz, nx, ny, nz, kind: kind === 1 ? 'world' : 'metal' });
        if (!b.sup) g.sound({ k: 'impact', x: px, y: py, z: pz });
      }
      b.active = false;
      continue;
    }
    b.x += sx; b.y += sy; b.z += sz;
    b.travelled += len;
    if (b.travelled > b.maxDist || b.y < -30) b.active = false;
  }
}

/* ---------------- grenades & explosions ---------------- */
export function startThrow(g: Game, f: Fighter, type: string) {
  if (f.state !== 'ground' || f.throwT > 0 || !(f.throws[type] > 0) || f.healT > 0) return false;
  f.throwType = type; f.throwT = 0.7; f.reloadT = 0;
  return true;
}

export function updateThrow(g: Game, f: Fighter, dt: number) {
  if (f.throwT <= 0) return;
  f.throwT -= dt;
  if (f.throwType && f.throwT <= 0.4) {
    const type = f.throwType as 'frag' | 'smoke' | 'flash';
    f.throwType = '';
    if (f.throws[type] <= 0) return;
    f.throws[type]--;
    const dir = f.cmd.aimDir ? f.cmd.aimDir.clone() : new Vector3(Math.sin(f.yaw) * Math.cos(f.pitch), Math.sin(f.pitch), Math.cos(f.yaw) * Math.cos(f.pitch));
    dir.y += 0.28; dir.normalize();
    const gr: Grenade = g.grenades.find((x) => !x.active) ?? (() => { const n: Grenade = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, fuse: 0, type: 'frag', owner: -1, active: false, bounces: 0 }; g.grenades.push(n); return n; })();
    const sp = f.isPlayer ? 17 : 15;
    gr.active = true; gr.type = type; gr.owner = f.id; gr.bounces = 0;
    gr.x = f.pos.x + dir.x * 0.6; gr.y = f.pos.y + f.eyeY - 0.1; gr.z = f.pos.z + dir.z * 0.6;
    gr.vx = dir.x * sp + f.vel.x * 0.5; gr.vy = dir.y * sp; gr.vz = dir.z * sp + f.vel.z * 0.5;
    gr.fuse = type === 'frag' ? 2.9 : type === 'smoke' ? 1.3 : 1.7;
    g.sound({ k: 'throw', x: f.pos.x, y: f.pos.y, z: f.pos.z });
    g.alertShot(f, 25);
  }
}

export function updateGrenades(g: Game, dt: number) {
  for (const gr of g.grenades) {
    if (!gr.active) continue;
    gr.fuse -= dt;
    gr.vy -= 18 * dt;
    const sx = gr.vx * dt, sy = gr.vy * dt, sz = gr.vz * dt;
    const len = Math.hypot(sx, sy, sz) || 1e-5;
    if (raycastWorld(g.world, gr.x, gr.y, gr.z, sx / len, sy / len, sz / len, len + 0.12)) {
      const t = Math.max(0, rayRes.t - 0.12);
      gr.x += (sx / len) * t; gr.y += (sy / len) * t; gr.z += (sz / len) * t;
      const dot = gr.vx * rayRes.nx + gr.vy * rayRes.ny + gr.vz * rayRes.nz;
      gr.vx = (gr.vx - 2 * dot * rayRes.nx) * 0.55; gr.vy = (gr.vy - 2 * dot * rayRes.ny) * 0.4; gr.vz = (gr.vz - 2 * dot * rayRes.nz) * 0.55;
      if (rayRes.ny > 0.7 && Math.abs(gr.vy) < 1.5) { gr.vy = 0; gr.vx *= 0.8; gr.vz *= 0.8; }
      gr.bounces++;
    } else { gr.x += sx; gr.y += sy; gr.z += sz; }
    if (gr.fuse <= 0) {
      gr.active = false;
      if (gr.type === 'frag') explode(g, gr.x, gr.y, gr.z, 7.5, 115, g.fighters[gr.owner] ?? null, 'Frag Grenade');
      else if (gr.type === 'smoke') { g.smokes.push({ x: gr.x, y: gr.y, z: gr.z, t: 0, r: 7.5 }); g.fx({ k: 'smoke', x: gr.x, y: gr.y, z: gr.z }); g.sound({ k: 'impact', x: gr.x, y: gr.y, z: gr.z }); }
      else flashBang(g, gr.x, gr.y, gr.z);
    }
  }
}

export function explode(g: Game, x: number, y: number, z: number, r: number, maxDmg: number, owner: Fighter | null, name: string) {
  g.fx({ k: 'explosion', x, y, z, r });
  g.sound({ k: 'explosion', x, y, z });
  g.alertShot(owner, 320);
  for (const f of g.fighters) {
    if (!f.alive || f.state === 'plane') continue;
    const cx = f.pos.x, cy = f.pos.y + 0.9, cz = f.pos.z;
    const d = Math.hypot(cx - x, cy - y, cz - z);
    if (d > r) continue;
    if (d > 1.2 && !hasLOS(g.world, x, y + 0.4, z, cx, cy, cz)) continue;
    damage(g, f, maxDmg * Math.pow(1 - d / r, 1.1) + 4, 'body', owner, name, 'explosion');
    if (f.alive && f.state === 'ground') { const k = (1 - d / r) * 6; const dx = cx - x, dz = cz - z, dl = Math.hypot(dx, dz) || 1; f.vel.x += (dx / dl) * k; f.vel.z += (dz / dl) * k; f.vel.y += 3 * (1 - d / r); f.grounded = false; }
  }
  for (const v of g.vehicles) {
    if (v.dead) continue;
    const d = Math.hypot(v.pos.x - x, v.pos.y - y, v.pos.z - z);
    if (d < r + 1) g.damageVehicle(v, maxDmg * (1 - d / (r + 1)) * 1.4, owner);
  }
}

function flashBang(g: Game, x: number, y: number, z: number) {
  g.fx({ k: 'flash', x, y, z });
  g.sound({ k: 'explosion', x, y, z });
  for (const f of g.fighters) {
    if (!f.alive || f.state === 'plane') continue;
    const d = Math.hypot(f.pos.x - x, f.pos.z - z);
    if (d > 26 || !hasLOS(g.world, x, y + 0.3, z, f.pos.x, f.pos.y + 1.5, f.pos.z)) continue;
    const dirTo = Math.atan2(x - f.pos.x, z - f.pos.z);
    let diff = Math.abs(((dirTo - f.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    const facing = diff < 1.6 ? 1 : 0.35;
    f.flashT = Math.max(f.flashT, (4.2 - d * 0.12) * facing);
    if (f.isPlayer) g.flashWhite = Math.min(1.2, f.flashT / 3);
  }
}
