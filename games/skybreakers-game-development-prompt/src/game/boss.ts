// Boss encounters: cinematic entrance, multi-phase attack patterns, telegraphs, environmental hazards, rewards.
import * as THREE from 'three';
import { BOSSES, ITEMS, type BossDef } from './data';
import { sfx, audio } from './audio';
import { areaDamage, hooks, hurtPlayer, spawnLoot, spawnProj } from './combat';
import { spawnEnemy, makeHostile } from './enemies';
import { fx } from './fx';
import { buildBoss } from './models';
import { G, clamp, lerpAng, rand, type Hostile } from './runtime';
import { useStore } from './store';
import { WORLD, groundAt } from './world';

const V1 = new THREE.Vector3(), V2 = new THREE.Vector3();
interface Pool { pos: THREE.Vector3; t: number; mesh: THREE.Mesh; r: number }
const pools: Pool[] = []; const bosses: Record<string, Hostile> = {};
const lavaGeo = new THREE.CircleGeometry(1, 24); const lavaMat = new THREE.MeshBasicMaterial({ color: '#ff5a10', transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
const phaseOf = (h: Hostile) => (h.hp / h.maxHp > 0.66 ? 0 : h.hp / h.maxHp > 0.33 ? 1 : 2);

function ensureBoss(id: string) {
  const st = useStore.getState(); if (st.bosses.includes(id) || bosses[id]) return; const def = BOSSES[id]; const sp = WORLD.bossSpawns[id]; if (!sp) return;
  const d = { ...def, hp: def.hp * (1 + 0.0 * st.level), scale: 1 }; const obj = buildBoss(id);
  const h = makeHostile('boss', id, d, obj, sp[0], sp[1], sp[2], def.island); h.r = def.r; h.cy = def.flying ? 0 : def.r * 0.9; h.flying = def.flying; h.name = def.name; h.x = { cd: 2, atk: null, phase: 0, home: new THREE.Vector3(sp[0], sp[1], sp[2]), lastAtk: '' };
  if (def.flying) { h.pos.y = sp[1] + 18; h.hover = 18; }
  h.obj.position.copy(h.pos); bosses[id] = h;
}
export function resetBosses() { for (const k in bosses) { G.scene?.remove(bosses[k].obj); const i = G.hostiles.indexOf(bosses[k]); if (i >= 0) G.hostiles.splice(i, 1); delete bosses[k]; } G.boss = null; G.bossFight = false; for (const p of pools) G.scene?.remove(p.mesh); pools.length = 0; }
function resetFight(h: Hostile) { h.hp = h.maxHp; h.pos.copy(h.x.home); if (h.flying) h.pos.y += 18; h.x.atk = null; h.x.cd = 2; h.x.phase = 0; h.vuln = 1; G.bossFight = false; G.boss = null; h.state = 'idle'; h.x.cinedDone = false; audio.setMood('explore'); }

function startCine(h: Hostile) {
  const pl = G.player; const dir = V1.set(pl.pos.x - h.pos.x, 0, pl.pos.z - h.pos.z).normalize(); const def = h.def as BossDef;
  const from = new THREE.Vector3(h.pos.x + dir.x * 38, h.pos.y + 6, h.pos.z + dir.z * 38); const to = new THREE.Vector3(h.pos.x + dir.x * (16 + h.r * 1.5), h.pos.y + h.r * 0.9, h.pos.z + dir.z * (16 + h.r * 1.5));
  G.cam.cine = { t: 0, dur: 4.6, from, to, target: new THREE.Vector3(h.pos.x, h.pos.y + h.r * 1.5, h.pos.z), fn: () => { G.bossFight = true; G.boss = h; h.state = 'fight'; h.x.cd = 1.5; } };
  h.x.cinedDone = true; sfx('boss'); setTimeout(() => sfx('roar_' + def.roar), 900); setTimeout(() => { fx.shockwave(V2.set(h.pos.x, h.pos.y + 0.3, h.pos.z), 22, def.accent, 1.2); G.cam.shake = 0.7; }, 1200);
  useStore.getState().setBanner(def.name, def.title);
}

const pickAttack = (h: Hostile, def: BossDef) => {
  const ph = phaseOf(h); const opts = def.attacks.filter(a => a.min <= ph && a.id !== h.x.lastAtk); let tot = opts.reduce((a, b) => a + b.w, 0); let r = Math.random() * tot; for (const o of opts) { r -= o.w; if (r <= 0) return o.id; } return opts[0].id;
};
function groundY(x: number, z: number, ref: number) { const g = groundAt(x, z, ref + 30); return g > -1e8 ? g : ref; }
function startAttack(h: Hostile, def: BossDef, id: string) {
  const T = G.player.inShip ? G.ship.pos : G.player.pos; const ph = phaseOf(h); h.x.lastAtk = id; const A: any = { id, t: 0, dur: 2, d: {} }; h.x.atk = A; h.state = 'atk';
  const roar = (n = 0.6) => sfx('roar_' + def.roar, n);
  switch (id) {
    case 'slam': A.dur = 2.2; A.d.r = h.r * 1.7 + 5; fx.telegraph(V1.set(h.pos.x, groundY(h.pos.x, h.pos.z, h.pos.y), h.pos.z), A.d.r, 1.2); roar(); break;
    case 'volley': A.dur = 2.6; A.d.n = 4 + ph * 2; A.d.i = 0; roar(0.4); break;
    case 'strikes': A.dur = 3.4; A.d.list = []; for (let i = 0; i < 5 + ph * 2; i++) { const px = i === 0 ? T.x : T.x + rand(-16, 16), pz = i === 0 ? T.z : T.z + rand(-16, 16); const hh = new THREE.Vector3(px, groundY(px, pz, T.y), pz); A.d.list.push({ at: 0.4 + i * 0.35, p: hh, done: false, tele: false }); } roar(0.4); break;
    case 'charge': A.dur = 2.6; A.d.dir = Math.atan2(T.x - h.pos.x, T.z - h.pos.z); fx.telegraphBox(V1.set(h.pos.x, groundY(h.pos.x, h.pos.z, h.pos.y), h.pos.z), A.d.dir, h.r * 1.8, 50, 1.1); roar(); break;
    case 'summon': A.dur = 2.2; roar(0.8); fx.shockwave(V1.set(h.pos.x, h.pos.y + 0.3, h.pos.z), 14, def.accent, 0.8); break;
    case 'breath': A.dur = 3.6; A.d.dir = Math.atan2(T.x - h.pos.x, T.z - h.pos.z); A.d.sweep = rand(-0.6, 0.6); fx.telegraphBox(V1.set(h.pos.x, groundY(h.pos.x, h.pos.z, h.pos.y), h.pos.z), A.d.dir, 9, 34, 1.0, def.accent); roar(); break;
    case 'pull': A.dur = 3.4; roar(1); fx.telegraph(V1.set(h.pos.x, groundY(h.pos.x, h.pos.z, h.pos.y), h.pos.z), 12, 3, '#b04cff'); break;
    case 'lava': A.dur = 2.4; A.d.list = []; for (let i = 0; i < 5 + ph; i++) { const px = i < 2 ? T.x + rand(-4, 4) : T.x + rand(-20, 20), pz = i < 2 ? T.z + rand(-4, 4) : T.z + rand(-20, 20); const p = new THREE.Vector3(px, groundY(px, pz, T.y), pz); fx.telegraph(p, 4, 1.1, '#ff6a1a'); A.d.list.push({ at: 1.1, p, done: false }); } roar(0.5); break;
    case 'rocks': A.dur = 3.2; A.d.list = []; for (let i = 0; i < 5 + ph * 2; i++) { const px = i === 0 ? T.x : T.x + rand(-18, 18), pz = i === 0 ? T.z : T.z + rand(-18, 18); const p = new THREE.Vector3(px, groundY(px, pz, T.y), pz); A.d.list.push({ at: 0.3 + i * 0.4, p, done: false, drop: false }); } roar(0.4); break;
    case 'swoop': A.dur = 3.6; A.d.dir = Math.atan2(T.x - h.pos.x, T.z - h.pos.z); fx.telegraphBox(V1.set(h.pos.x, groundY(h.pos.x, h.pos.z, h.pos.y), h.pos.z), A.d.dir, 8, 70, 1.3); A.d.from = h.pos.clone(); roar(); break;
  }
}
function runAttack(h: Hostile, def: BossDef, dt: number) {
  const A = h.x.atk; A.t += dt; const T = G.player.inShip ? G.ship.pos : G.player.pos; const t = A.t; const dmg = def.dmg * (1 + phaseOf(h) * 0.1);
  h.atkProg = 0;
  switch (A.id) {
    case 'slam': h.atkProg = clamp(t / 1.2, 0, 1); if (t >= 1.2 && !A.d.done) { A.d.done = true; h.atkProg = 1; const c = V1.set(h.pos.x, groundY(h.pos.x, h.pos.z, h.pos.y) + 0.3, h.pos.z); fx.shockwave(c, A.d.r * 1.1, def.accent, 0.6); fx.explosion(c, 1.6, def.element === 'fire' ? 'fire' : 'stone'); sfx('explosion'); G.cam.shake = 0.7; areaDamage(c, A.d.r, dmg, { team: 'enemy', elem: def.element, knock: 1.4 }); if (def.id === 'titan' || def.id === 'inferno') { h.vuln = 1.6; h.x.stag = 2.5; fx.dmg(V2.set(h.pos.x, h.pos.y + h.r * 2.2, h.pos.z), 'STAGGERED', '#ffd23a', true); } if (def.id === 'inferno') for (let i = 0; i < 3; i++) addPool(new THREE.Vector3(h.pos.x + rand(-9, 9), c.y, h.pos.z + rand(-9, 9)), 3, 7); } break;
    case 'volley': if (t > 0.7 + A.d.i * 0.22 && A.d.i < A.d.n) { A.d.i++; const o = V1.set(h.pos.x, h.pos.y + h.r * 1.6, h.pos.z); const dir = new THREE.Vector3(T.x - o.x, T.y + 1 - o.y, T.z - o.z).normalize(); dir.applyAxisAngle(V2.set(0, 1, 0), (A.d.i - A.d.n / 2) * 0.1 + rand(-0.04, 0.04)); const el = def.element; sfx(el === 'fire' ? 'fire' : 'repeater', 0.7);
      spawnProj({ kind: el === 'fire' ? 'fireball' : el === 'stone' ? 'rock' : el === 'shadow' ? 'orb' : 'orb', pos: o.clone(), dir: el === 'stone' ? dir.setY(dir.y + 0.35) : dir, speed: el === 'stone' ? 30 : 26, dmg: dmg * 0.6, team: 'enemy', r: 1, aoe: 3, elem: el, color: el === 'fire' ? 0xff6a1a : el === 'shadow' ? 0xb04cff : el === 'lightning' ? 0x8fd8ff : 0x8a8478, trail: el === 'fire' ? 'fire' : 'magic', grav: el === 'stone' ? 14 : 0, life: 4, scale: el === 'stone' ? 0.7 : 1.1 }); } break;
    case 'strikes': for (const s of A.d.list) { if (!s.tele && t > s.at) { s.tele = true; fx.telegraph(s.p, 4, 1.1, def.element === 'fire' ? '#ff6a1a' : '#b8a0ff'); } if (!s.done && t > s.at + 1.1) { s.done = true; const sky = V2.set(s.p.x, s.p.y + 70, s.p.z).clone(); const col = def.element === 'lightning' ? '#9ae0ff' : def.element === 'fire' ? '#ff8a2a' : '#c26bff'; if (def.element === 'lightning') fx.bolt(sky, s.p, '#bfeaff', 0.5); else fx.pillar(s.p, 2.4, 45, col, 0.5); fx.explosion(s.p, 1.1, def.element === 'fire' ? 'fire' : def.element === 'lightning' ? 'lightning' : 'dark'); sfx(def.element === 'lightning' ? 'lightning' : 'explosion', 0.8); G.cam.shake = Math.max(G.cam.shake, 0.3); areaDamage(V1.set(s.p.x, s.p.y + 1, s.p.z), 4.2, dmg * 0.8, { team: 'enemy', elem: def.element, knock: 1 }); } } break;
    case 'charge': h.atkProg = clamp(t / 1.1, 0, 1) * 0.5; if (t < 1.1) { h.yaw = lerpAng(h.yaw, A.d.dir, 0.2); } else if (t < 1.9) { h.atkProg = 0; const sp = 42; const nx = h.pos.x + Math.sin(A.d.dir) * sp * dt, nz = h.pos.z + Math.cos(A.d.dir) * sp * dt; if (groundAt(nx, nz, h.pos.y + 3) > -1e8) { h.pos.x = nx; h.pos.z = nz; } h.pos.y = groundY(h.pos.x, h.pos.z, h.pos.y); fx.burst(V1.set(h.pos.x, h.pos.y + 0.5, h.pos.z), 4, '#b8a888', 6, 1.2, 0.6, 6); G.cam.shake = Math.max(G.cam.shake, 0.2); const dx = T.x - h.pos.x, dz = T.z - h.pos.z; if (Math.hypot(dx, dz) < h.r + 1.5 && !A.d.hit) { A.d.hit = true; if (G.player.inShip) { /* ship ignores */ } hurtPlayer(dmg * 1.1, h.pos, { knock: 2 }); } if (t > 1.85 && def.id === 'titan') { h.vuln = 1.6; h.x.stag = 2.5; } } break;
    case 'summon': if (t > 1.0 && !A.d.done) { A.d.done = true; const n = 2 + phaseOf(h); const type = ({ titan: 'golem', inferno: 'fire', void: 'shadow', wyrm: 'harpy' } as any)[def.id]; for (let i = 0; i < n; i++) { const a = (i / n) * 6.28 + rand(0, 1); const x = h.pos.x + Math.cos(a) * (h.r + 6), z = h.pos.z + Math.sin(a) * (h.r + 6); const g = groundY(x, z, h.pos.y); const e = spawnEnemy(type, x, g, z, def.island, { hpMul: type === 'golem' ? 0.45 : 0.8 }); e.aggro = true; e.state = 'chase'; if (type === 'harpy') { e.pos.y = g + 8; e.flying = true; } (e as any).minion = true; fx.burst(V1.set(x, g + 1, z), 14, def.accent, 6, 0.8, 0.6); } sfx('arcane', 0.6); } break;
    case 'breath': h.atkProg = clamp(t / 1.0, 0, 1) * 0.6; if (t < 1.0) h.yaw = lerpAng(h.yaw, A.d.dir, 0.15); else if (t < 2.8) { const k = (t - 1.0) / 1.8; const yaw = A.d.dir + A.d.sweep * (k - 0.5) * 1.2; h.yaw = yaw; const o = V1.set(h.pos.x + Math.sin(yaw) * h.r * 1.2, h.pos.y + h.r * (def.flying ? 0.4 : 1.6), h.pos.z + Math.cos(yaw) * h.r * 1.2); const col = def.element === 'lightning' ? '#8fd8ff' : '#ff8a1a'; const col2 = def.element === 'lightning' ? '#ffffff' : '#ffd23a';
        for (let i = 0; i < 6; i++) { const sp = rand(14, 24); fx.emit(o.x, o.y, o.z, Math.sin(yaw + rand(-0.12, 0.12)) * sp, rand(-6, -1) - (def.flying ? 4 : 0), Math.cos(yaw + rand(-0.12, 0.12)) * sp, i % 2 ? col : col2, rand(1.2, 2.4), 0.9, 2, 0.4, 0.6); } if (Math.floor(t * 5) !== Math.floor((t - dt) * 5)) { sfx('fire', 0.5); const dx = T.x - o.x, dz = T.z - o.z; const dist = Math.hypot(dx, dz); let da = Math.atan2(dx, dz) - yaw; da = Math.atan2(Math.sin(da), Math.cos(da)); if (dist < 36 && Math.abs(da) < 0.28 + 4.5 / Math.max(6, dist)) { if (G.player.inShip) { const hp = (hooks as any).damageShip; hp?.(dmg * 0.25, o); } else hurtPlayer(dmg * 0.3, o, { elem: def.element, knock: 0.3 }); } if (def.element === 'fire' && Math.random() < 0.5) addPool(V2.set(o.x + Math.sin(yaw) * rand(8, 26), h.pos.y, o.z + Math.cos(yaw) * rand(8, 26)).clone(), 2.2, 4); } } break;
    case 'pull': if (t < 2.4) { h.atkProg = 0.6; const dx = h.pos.x - T.x, dz = h.pos.z - T.z, d = Math.hypot(dx, dz) || 1; if (!G.player.inShip && d > h.r + 2) { G.player.vel.x += (dx / d) * 22 * dt; G.player.vel.z += (dz / d) * 22 * dt; } else if (G.player.inShip) { G.ship.vel.x += (dx / d) * 18 * dt; G.ship.vel.z += (dz / d) * 18 * dt; } for (let i = 0; i < 5; i++) { const a = rand(0, 6.28), r = rand(6, 14); fx.emit(h.pos.x + Math.cos(a) * r, h.pos.y + rand(0.5, 3), h.pos.z + Math.sin(a) * r, -Math.cos(a) * 9, 0, -Math.sin(a) * 9, '#b04cff', 1.2, 0.8, 0, 0, -0.5); } } else if (!A.d.done) { A.d.done = true; const c = V1.set(h.pos.x, groundY(h.pos.x, h.pos.z, h.pos.y) + 0.3, h.pos.z); fx.shockwave(c, 14, '#c26bff', 0.7); fx.explosion(c, 1.8, 'dark'); sfx('explosion'); G.cam.shake = 0.7; areaDamage(c, 12, dmg * 1.1, { team: 'enemy', elem: 'shadow', knock: 1.8 }); h.vuln = 1.5; h.x.stag = 2; } break;
    case 'lava': for (const s of A.d.list) if (!s.done && t > s.at) { s.done = true; fx.explosion(s.p, 0.9, 'fire'); sfx('fire', 0.6); areaDamage(V1.set(s.p.x, s.p.y + 1, s.p.z), 4, dmg * 0.7, { team: 'enemy', elem: 'fire' }); addPool(s.p, 3.4, 9); } break;
    case 'rocks': for (const s of A.d.list) { if (!s.drop && t > s.at) { s.drop = true; fx.telegraph(s.p, 4, 1.0, '#ffb060'); setTimeout(() => { if (!G.scene) return; spawnProj({ kind: 'rock', pos: V1.set(s.p.x, s.p.y + 38, s.p.z).clone(), dir: V2.set(0, -1, 0), speed: 30, dmg: dmg * 0.75, team: 'enemy', r: 1.5, aoe: 4.2, elem: 'stone', color: 0x8a8478, life: 4, scale: 1.4 }); }, 250); } } break;
    case 'swoop': if (t < 1.3) { h.yaw = lerpAng(h.yaw, A.d.dir, 0.2); h.pos.y += (G.player.pos.y + 6 - h.pos.y) * dt * 2; h.atkProg = 0.4; } else if (t < 2.3) { const sp = 52; h.pos.x += Math.sin(A.d.dir) * sp * dt; h.pos.z += Math.cos(A.d.dir) * sp * dt; h.pos.y += (T.y + 3 - h.pos.y) * dt * 4; h.yaw = A.d.dir; fx.burst(V1.set(h.pos.x, h.pos.y, h.pos.z), 5, def.accent, 8, 1.4, 0.6); G.cam.shake = Math.max(G.cam.shake, 0.2); const dx = T.x - h.pos.x, dz = T.z - h.pos.z; if (Math.hypot(dx, dz) < h.r + 2 && Math.abs(T.y - h.pos.y) < h.r + 3 && !A.d.hit) { A.d.hit = true; if (G.player.inShip) (hooks as any).damageShip?.(dmg, h.pos); else hurtPlayer(dmg, h.pos, { knock: 2 }); } h.vuln = 1.5; } else { h.hover = 18; h.pos.y += (G.player.pos.y + 14 - h.pos.y) * dt * 1.2; h.vuln = 1.4; } break;
  }
  if (t >= A.dur) { h.x.atk = null; h.state = 'fight'; h.x.cd = Math.max(0.8, 2.4 - phaseOf(h) * 0.5) + rand(0, 0.8); }
}
function addPool(p: THREE.Vector3, r: number, life: number) { const m = new THREE.Mesh(lavaGeo, lavaMat); m.rotation.x = -Math.PI / 2; m.scale.setScalar(r); m.position.set(p.x, p.y + 0.2, p.z); G.scene!.add(m); pools.push({ pos: p.clone(), t: life, mesh: m, r }); }

let poolTick = 0;
export function updateBoss(dt: number) {
  const st = useStore.getState(); const pl = G.player;
  for (const id in BOSSES) { if (!st.bosses.includes(id) && !bosses[id]) { const sp = WORLD.bossSpawns[id]; if (Math.hypot(pl.pos.x - sp[0], pl.pos.z - sp[2]) < 420) ensureBoss(id); } }
  poolTick += dt;
  for (let i = pools.length - 1; i >= 0; i--) { const p = pools[i]; p.t -= dt; (p.mesh.material as THREE.MeshBasicMaterial); p.mesh.scale.setScalar(p.r * (0.95 + Math.sin(G.t * 6 + i) * 0.05)); if (poolTick > 0.1) fx.emit(p.pos.x + rand(-p.r, p.r) * 0.7, p.pos.y + 0.4, p.pos.z + rand(-p.r, p.r) * 0.7, 0, rand(2, 5), 0, '#ff8a1a', 0.8, 0.8, 0, 0.3, -0.5);
    const T = pl.inShip ? null : pl.pos; if (T && Math.hypot(T.x - p.pos.x, T.z - p.pos.z) < p.r && Math.abs(T.y - p.pos.y) < 2.5 && poolTick > 0.1) { p.t -= 0; (p as any).dt = ((p as any).dt || 0) + 0.1; if ((p as any).dt >= 0.5) { (p as any).dt = 0; hurtPlayer(9, null, { elem: 'fire', knock: 0, unblockable: true }); } }
    if (p.t <= 0) { G.scene!.remove(p.mesh); pools.splice(i, 1); } }
  if (poolTick > 0.1) poolTick = 0;
  for (const id in bosses) {
    const h = bosses[id]; const def = h.def as BossDef; const d = Math.hypot(pl.pos.x - h.pos.x, pl.pos.z - h.pos.z); const near = d < 520; h.obj.visible = near; h.active = near; if (!near) continue;
    if (h.dead) { updateBossDeath(h, def, dt, id); continue; }
    h.hurtT = Math.max(0, h.hurtT - dt);
    if (h.state === 'idle') { // wait for trigger
      h.obj.position.copy(h.pos); animBoss(h, dt); if (h.flying) { h.pos.y = h.x.home.y + 18 + Math.sin(G.t) * 0.8; }
      if (!h.x.cinedDone && d < 62 && Math.abs(pl.pos.y - h.x.home.y) < 45 && !pl.dead && !G.cam.cine && !pl.inShip) startCine(h); continue; }
    if (G.cam.cine) { animBoss(h, dt); continue; }
    // fight
    h.x.stag = Math.max(0, (h.x.stag || 0) - dt); if (h.x.stag <= 0 && h.vuln > 1 && (!h.x.atk || h.x.atk.id !== 'swoop')) h.vuln = 1;
    const ph = phaseOf(h); if (ph !== h.x.phase) { h.x.phase = ph; h.x.atk = null; h.x.cd = 1.5; sfx('roar_' + def.roar, 1); fx.shockwave(V1.set(h.pos.x, h.pos.y + 0.5, h.pos.z), 28, def.accent, 1); fx.explosion(V1.set(h.pos.x, h.pos.y + h.r, h.pos.z), 2, 'big'); G.cam.shake = 0.8; useStore.getState().setBanner(`PHASE ${ph + 1}`, def.name); areaDamage(V1.set(h.pos.x, h.pos.y + 1, h.pos.z), h.r + 8, def.dmg * 0.4, { team: 'enemy', elem: def.element, knock: 2 }); }
    // leash / reset
    if (pl.dead || d > 150) { if (!pl.dead || pl.respawnT > 1) { resetFight(h); h.obj.position.copy(h.pos); continue; } }
    const T = pl.inShip ? G.ship.pos : pl.pos; const dx = T.x - h.pos.x, dz = T.z - h.pos.z; const dist = Math.hypot(dx, dz);
    if (h.x.atk) runAttack(h, def, dt);
    else {
      h.x.cd -= dt; h.yaw = lerpAng(h.yaw, Math.atan2(dx, dz), dt * 3);
      if (def.flying) { h.x.orb = (h.x.orb || 0) + dt * 0.5; const cx = h.x.home.x + Math.cos(h.x.orb) * 28, cz = h.x.home.z + Math.sin(h.x.orb) * 28; h.pos.x += (cx - h.pos.x) * dt * 0.8; h.pos.z += (cz - h.pos.z) * dt * 0.8; h.pos.y += (Math.max(h.x.home.y, T.y) + 16 + Math.sin(G.t * 1.5) * 2 - h.pos.y) * dt * 1.2; }
      else if (dist > h.r + 5) { const sp = def.speed * (1 + ph * 0.15); const nx = h.pos.x + (dx / dist) * sp * dt, nz = h.pos.z + (dz / dist) * sp * dt; if (groundAt(nx, nz, h.pos.y + 3) > -1e8) { h.pos.x = nx; h.pos.z = nz; h.walk += dt * sp * 0.5; } h.pos.y = groundY(h.pos.x, h.pos.z, h.pos.y); }
      if (h.x.cd <= 0) { let id2 = pickAttack(h, def); if (!def.flying && dist < h.r + 8 && Math.random() < 0.55) id2 = 'slam'; startAttack(h, def, id2); }
    }
    if (!def.flying) h.pos.y = groundY(h.pos.x, h.pos.z, h.pos.y);
    h.obj.position.copy(h.pos); h.obj.rotation.y = h.yaw; animBoss(h, dt);
    // contact damage
    if (!pl.inShip && dist < h.r * 0.9 && Math.abs(pl.pos.y - h.pos.y) < h.r * 1.5 && !def.flying) hurtPlayer(def.dmg * 0.25, h.pos, { knock: 1.6 });
    if (h.hurtT > 0 && Math.random() < 0.4) fx.sparks(V1.set(h.pos.x + rand(-h.r, h.r) * 0.6, h.pos.y + rand(0.2, 1.4) * h.r, h.pos.z + rand(-h.r, h.r) * 0.6), def.accent, 4);
    if (h.vuln > 1 && Math.random() < 0.3) fx.emit(h.pos.x + rand(-h.r, h.r), h.pos.y + h.r * 2, h.pos.z + rand(-h.r, h.r), 0, 3, 0, '#ffd23a', 0.8, 0.6);
    if (h.x.fx) h.x.fx -= dt;
  }
}

function animBoss(h: Hostile, dt: number) {
  const p = h.parts; const t = G.t; const ap = h.atkProg; const id = h.type; const mv = h.state === 'fight' && !h.x.atk ? 1 : 0; const w = Math.sin(h.walk * 1.4) * 0.45 * mv;
  const set = (o: THREE.Object3D | undefined, x?: number, y?: number, z?: number) => { if (!o) return; const k = Math.min(1, dt * 8); if (x !== undefined) o.rotation.x += (x - o.rotation.x) * k; if (y !== undefined) o.rotation.y += (y - o.rotation.y) * k; if (z !== undefined) o.rotation.z += (z - o.rotation.z) * k; };
  if (id === 'wyrm') { const f = Math.sin(t * 3.2) * 0.55; set(p.wingR, undefined, undefined, f); set(p.wingL, undefined, undefined, -f); for (let i = 0; i < 6; i++) { const tl = p['tail' + i]; if (tl) tl.rotation.y = Math.sin(t * 2 - i * 0.7) * 0.25; } set(p.neck, -0.2 + Math.sin(t * 2) * 0.05, undefined, 0); set(p.head, h.x.atk?.id === 'breath' ? -0.4 + ap * 0.4 : 0.1); set(p.body, h.x.atk?.id === 'swoop' ? 0.3 : -0.08, undefined, Math.sin(t * 1.5) * 0.05); return; }
  if (id === 'void') { if (p.orbit) p.orbit.rotation.y += dt * 0.8; set(p.armL, -0.4 - ap * 1.6 + Math.sin(t) * 0.2, undefined, 0.2); set(p.armR, -0.4 - ap * 1.6 - Math.sin(t) * 0.2, undefined, -0.2); p.torso.position.y = 6 + Math.sin(t * 1.2) * 0.5; set(p.head, Math.sin(t * 0.7) * 0.1); return; }
  set(p.legL, w); set(p.legR, -w); set(p.armL, -w * 0.8 - ap * 2.8); set(p.armR, w * 0.8 - ap * 2.8); set(p.torso, -ap * 0.2 + Math.sin(t * 1.5) * 0.02); if (p.torso) p.torso.position.y = (p.torso.userData.y0 ??= p.torso.position.y) + Math.abs(w) * 0.5;
}

function updateBossDeath(h: Hostile, def: BossDef, dt: number, id: string) {
  h.deadT += dt; const t = h.deadT; const o = h.obj;
  if (t < 3.2) { o.position.set(h.pos.x + rand(-0.3, 0.3), h.pos.y - t * 0.3, h.pos.z + rand(-0.3, 0.3)); if (Math.random() < 0.5) fx.explosion(V1.set(h.pos.x + rand(-h.r, h.r), h.pos.y + rand(0, h.r * 2), h.pos.z + rand(-h.r, h.r)), 0.8, 'big'); if (def.flying) { h.pos.y += (groundY(h.pos.x, h.pos.z, h.pos.y) - h.pos.y) * dt * 1.5; o.rotation.z += dt * 0.4; } }
  else if (t < 4.6) { const k = (t - 3.2) / 1.4; o.scale.setScalar(Math.max(0.01, 1 - k)); fx.burst(V1.set(h.pos.x, h.pos.y + h.r, h.pos.z), 6, def.accent, 8, 1.5, 1, -2, 3); }
  else { G.scene!.remove(o); const i = G.hostiles.indexOf(h); if (i >= 0) G.hostiles.splice(i, 1); delete bosses[id]; }
}
(hooks as any).bossKill = (h: Hostile) => {
  const def = h.def as BossDef; const st = useStore.getState(); G.bossFight = false; G.boss = null; G.timeScale = 0.35; setTimeout(() => (G.timeScale = 1), 1600);
  sfx('roar_' + def.roar, 1); sfx('explosion'); h.x.atk = null; G.player.victoryT = 5; G.player.lock = null;
  st.setBanner('VICTORY', `${def.name} defeated`); st.set_({ bosses: [...st.bosses, def.id] }); st.gainXp(def.xp); st.emitQ('boss:' + def.id); st.addItem(def.artifact, 1, true); st.toast(`Artifact recovered: ${ITEMS[def.artifact].name}`, 'quest');
  fx.explosion(V1.set(h.pos.x, h.pos.y + h.r, h.pos.z), 3, 'big');
  setTimeout(() => { for (const [it, a, b] of def.reward) spawnLoot(V1.set(h.pos.x + rand(-3, 3), h.pos.y + 3, h.pos.z + rand(-3, 3)), it, Math.round(rand(a, b))); spawnLoot(V1.set(h.pos.x, h.pos.y + 4, h.pos.z), def.artifact === 'x' ? 'gold' : 'crystal', 5); }, 1200);
  for (let i = pools.length - 1; i >= 0; i--) { G.scene!.remove(pools[i].mesh); pools.splice(i, 1); }
  for (const e of [...G.hostiles]) if ((e as any).minion && !e.dead) { e.dead = true; e.deadT = 0; }
  audio.setMood('explore'); st.save(); h.deadT = 0;
};
