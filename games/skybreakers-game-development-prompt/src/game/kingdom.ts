// Kingdom building: placement (grid snapping), construction, production, workers, guards, towers, raids.
import * as THREE from 'three';
import { BUILDINGS } from './data';
import { sfx } from './audio';
import { damageHostile, spawnLoot } from './combat';
import { spawnEnemy } from './enemies';
import { makeNpcModel, removeI } from './entities';
import { fx } from './fx';
import { buildBuilding, buildScaffold } from './models2';
import { G, input, lerpAng, rand } from './runtime';
import { buildingBuilt, shipStats, useStore, type BuildingInst } from './store';
import { ISLAND_MAP, addCollider, collide, groundAt, radiusAt } from './world';
import { shipInst } from './airship';

const V1 = new THREE.Vector3(); const C = { x: 0, z: 0 };
export const GRID = 4;
interface Rt { obj: THREE.Group; model: THREE.Group; scaffold: THREE.Group; level: number; built: boolean; acc: number; iact: boolean; fireCd: number; spin?: THREE.Object3D }
const rts = new Map<number, Rt>(); let ghost: THREE.Group | null = null; let ghostType = '';
export const place = { x: 0, z: 0, rot: 0, valid: false, reason: '' };
interface Walker { obj: THREE.Group; pos: THREE.Vector3; target: THREE.Vector3; t: number; walk: number; job: number; guard: boolean; cd: number; yaw: number }
const walkers: Walker[] = []; let syncT = 0; let questT = 0; let raidT = 0;

const haven = ISLAND_MAP.haven;
const havenR = (x: number, z: number) => Math.hypot(x - haven.x, z - haven.z) / radiusAt(haven, Math.atan2(z - haven.z, x - haven.x));

function makeRt(b: BuildingInst): Rt {
  const obj = new THREE.Group(); const model = buildBuilding(b.type, b.level); const def = BUILDINGS[b.type]; const scaffold = buildScaffold(def.r * 0.8); obj.add(model, scaffold);
  const g = groundAt(b.x, b.z, 200); obj.position.set(b.x, g, b.z); obj.rotation.y = b.rot; G.scene!.add(obj); addCollider(b.x, b.z, def.r * 0.8);
  return { obj, model, scaffold, level: b.level, built: b.progress >= 1, acc: 0, iact: false, fireCd: 0, spin: model.userData.spin };
}
function registerInteract(b: BuildingInst) {
  const def = BUILDINGS[b.type]; const st = () => useStore.getState(); const open = (tab: any) => { st().openPanel('menu', tab); sfx('open'); };
  const acts: Record<string, [string, () => void]> = { castle: ['Open Kingdom Menu', () => open('kingdom')], workshop: ['Open Airship Workshop', () => { st().openPanel('workshop'); sfx('open'); }], blacksmith: ['Open Crafting', () => open('craft')], market: ['Trade at the Market', () => { st().openPanel('trade'); sfx('open'); }], storage: ['View Kingdom Stores', () => open('kingdom')], research: ['Open Research', () => open('kingdom')], farm: ['Manage Kingdom', () => open('kingdom')], barracks: ['Manage Kingdom', () => open('kingdom')], dock: ['Open Airship Workshop', () => { st().openPanel('workshop'); sfx('open'); }], tower: ['Manage Kingdom', () => open('kingdom')] };
  const a = acts[b.type]; if (!a) return; const id = 'bld' + b.uid;
  G.interactables.push({ id, x: b.x, y: groundAt(b.x, b.z, 200), z: b.z, r: def.r + 3, label: () => `${a[0]} (${def.name})`, act: a[1] });
}

export function syncKingdom() {
  const st = useStore.getState(); const list = st.kingdom.buildings; const ids = new Set(list.map(b => b.uid));
  for (const [uid, rt] of rts) if (!ids.has(uid)) { G.scene!.remove(rt.obj); rts.delete(uid); removeI('bld' + uid); }
  for (const b of list) {
    let rt = rts.get(b.uid); if (!rt) { rt = makeRt(b); rts.set(b.uid, rt); }
    if (b.level !== rt.level) { rt.obj.remove(rt.model); rt.model = buildBuilding(b.type, b.level); rt.obj.add(rt.model); rt.level = b.level; rt.spin = rt.model.userData.spin; }
    if (!rt.iact && b.progress >= 1) { rt.iact = true; registerInteract(b); }
  }
}
export function resetKingdomScene() { for (const rt of rts.values()) G.scene?.remove(rt.obj); rts.clear(); for (const w of walkers) G.scene?.remove(w.obj); walkers.length = 0; G.interactables = G.interactables.filter(i => !i.id.startsWith('bld')); if (ghost) { G.scene?.remove(ghost); ghost = null; } syncT = 0; }

// ───────── placement ─────────
export function updatePlacement(dt: number) {
  const st = useStore.getState(); const p = G.player;
  if (!st.placing) { if (ghost) { G.scene!.remove(ghost); ghost = null; ghostType = ''; } return; }
  void dt; const type = st.placing; const def = BUILDINGS[type];
  if (!ghost || ghostType !== type) { if (ghost) G.scene!.remove(ghost); ghost = buildBuilding(type, 1); ghostType = type; ghost.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = false; m.material = (m.material as THREE.MeshStandardMaterial).clone(); const mt = m.material as THREE.MeshStandardMaterial; mt.transparent = true; mt.opacity = 0.55; mt.depthWrite = false; } }); G.scene!.add(ghost); }
  const fx_ = -Math.sin(G.cam.yaw), fz = -Math.cos(G.cam.yaw); const dist = def.r + 7;
  const rx = p.pos.x + fx_ * dist, rz = p.pos.z + fz * dist; place.x = Math.round(rx / GRID) * GRID; place.z = Math.round(rz / GRID) * GRID;
  if (input.hit('KeyR') || input.hit('KeyQ')) { place.rot += Math.PI / 2; sfx('click'); }
  // validity
  let ok = true, why = '';
  if (havenR(place.x, place.z) > 0.8) { ok = false; why = 'Must be built on Haven Isle'; }
  if (ok) for (const b of st.kingdom.buildings) { if (Math.hypot(b.x - place.x, b.z - place.z) < BUILDINGS[b.type].r + def.r + 1.5) { ok = false; why = 'Too close to another building'; break; } }
  if (ok && type !== 'castle' && !buildingBuilt(st, 'castle') && !st.kingdom.buildings.some(b => b.type === 'castle')) { ok = false; why = 'Build the Main Castle first'; }
  if (ok && type === 'castle' && st.kingdom.buildings.some(b => b.type === 'castle')) { ok = false; why = 'Only one castle'; }
  if (ok && !st.has(def.cost)) { ok = false; why = 'Not enough materials'; }
  place.valid = ok; place.reason = why;
  const g = groundAt(place.x, place.z, 200); ghost.position.set(place.x, g > -1e8 ? g : p.pos.y, place.z); ghost.rotation.y = place.rot;
  ghost.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { const mt = m.material as THREE.MeshStandardMaterial; mt.emissive.set(ok ? '#1aff6a' : '#ff2a2a'); mt.emissiveIntensity = 0.35; } });
  if ((input.hit('KeyE') || input.hit('Enter') || input.lmbPressed) && !G.paused) {
    if (!ok) { st.toast(why, 'bad'); sfx('error'); return; }
    if (st.placeBuilding(type, place.x, place.z, place.rot)) { sfx('build'); fx.burst(V1.set(place.x, g + 1, place.z), 30, '#ffe9a0', 8, 0.8, 0.8, 0, 3); fx.shockwave(V1.set(place.x, g + 0.3, place.z), def.r * 1.5, '#ffe9a0', 0.7); st.set_({ placing: null }); syncKingdom(); }
  }
}
export const cancelPlacing = () => useStore.getState().set_({ placing: null });

// ───────── economy / construction ─────────
function mkWalker(guard: boolean, i: number, x: number, z: number): Walker {
  const obj = makeNpcModel(guard ? '#6a7a9a' : ['#c0793a', '#5a8a4a', '#8a6a9a', '#b0904a'][i % 4], guard ? 'Guard' : 'Builder'); const g = groundAt(x, z, 200); obj.position.set(x, g, z); G.scene!.add(obj);
  return { obj, pos: new THREE.Vector3(x, g, z), target: new THREE.Vector3(x, g, z), t: rand(0, 3), walk: 0, job: i, guard, cd: 0, yaw: 0 };
}
export function updateKingdom(dt: number) {
  const st = useStore.getState(); const k = st.kingdom; syncT -= dt; if (syncT <= 0 || rts.size !== k.buildings.length) { syncT = 0.5; syncKingdom(); }
  const masonry = k.upgrades.includes('masonry') ? 0.6 : 1; const t = G.t;
  const near = Math.hypot(G.player.pos.x - haven.x, G.player.pos.z - haven.z) < 400;
  for (const b of k.buildings) {
    const rt = rts.get(b.uid); if (!rt) continue; const def = BUILDINGS[b.type];
    if (b.progress < 1) { const builders = 1 + Math.min(3, k.workers) * 0.25; b.progress = Math.min(1, b.progress + (dt / (def.time * (1 + (b.level - 1) * 0.7) * masonry)) * builders); const up = b.level > 1 || rt.built; rt.scaffold.visible = true; rt.model.scale.y = up ? 1 : Math.max(0.05, b.progress); rt.model.visible = true;
      if (near && Math.random() < 0.25) { fx.emit(b.x + rand(-def.r, def.r) * 0.5, rt.obj.position.y + rand(0, 6), b.z + rand(-def.r, def.r) * 0.5, 0, 2, 0, '#d8c8a8', 1, 0.8, 0, 0.5, 0.5); }
      if (near && Math.random() < 0.03) sfx('build', 0.3);
      if (b.progress >= 1) { rt.scaffold.visible = false; rt.model.scale.y = 1; const first = !rt.built; rt.built = true; st.toast(`${def.name} ${first ? 'completed' : 'upgraded to level ' + b.level}!`, 'good'); sfx('quest'); fx.explosion(V1.set(b.x, rt.obj.position.y + 3, b.z), 1.4, 'arcane'); if (first) st.emitQ('build:' + b.type); st.save(); syncKingdom(); }
      continue; }
    rt.scaffold.visible = false; if (rt.spin) rt.spin.rotation.z += dt * 0.8;
    // production
    if (def.produces) { let rate = def.produces[1] * b.level * (b.workers > 0 ? 1 + 0.6 * b.workers : 0.5); if (b.type === 'farm' && k.upgrades.includes('agri')) rate *= 1.3; if ((b.type === 'market' || b.type === 'castle') && k.upgrades.includes('trade')) rate *= 1.3; rt.acc += rate * dt; if (rt.acc >= 1) { const n = Math.floor(rt.acc); rt.acc -= n; st.addItem(def.produces[0], n, def.produces[0] === 'gold'); if (near && b.type !== 'castle') fx.dmg(V1.set(b.x, rt.obj.position.y + 8, b.z), `+${n}`, def.produces[0] === 'gold' ? '#ffd23a' : '#9aff9a'); } }
    if (b.type === 'research') k.research += 0.1 * b.level * (b.workers > 0 ? 1 + 0.6 * b.workers : 0.5) * dt;
    // dock service
    if (b.type === 'dock' && G.ship.landed && Math.hypot(G.ship.pos.x - b.x, G.ship.pos.z - b.z) < def.r + 14) { const inst = shipInst(); const s = shipStats(st); inst.fuel = Math.min(s.maxFuel, inst.fuel + 6 * dt); inst.hull = Math.min(s.maxHull, inst.hull + 5 * dt * b.level); }
    // towers
    if (b.type === 'tower') { rt.fireCd -= dt; if (rt.fireCd <= 0) { let tg: any = null, td = 46; const top = V1.set(b.x, rt.obj.position.y + 11 + b.level * 2, b.z); for (const h of G.hostiles) { if (h.dead || !h.active || h.kind === 'boss') continue; const d = Math.hypot(h.pos.x - b.x, h.pos.z - b.z); if (d < td && (h.aggro || h.raid) && h.def.dmg > 0) { td = d; tg = h; } } if (tg) { rt.fireCd = 1.3 / (0.7 + b.level * 0.3); fx.bolt(top.clone(), V1.set(tg.pos.x, tg.pos.y + tg.cy, tg.pos.z).clone(), '#7af0ff', 0.18, 0.15); sfx('repeater', 0.4); damageHostile(tg, (14 + b.level * 8) * (k.upgrades.includes('arms') ? 1.5 : 1), { src: 'tower' }); } else rt.fireCd = 0.4; } }
  }
  // castle hp regen
  if (k.castleHp < 400) k.castleHp = Math.min(400, k.castleHp + 2 * dt);
  // workers & guards
  const castle = k.buildings.find(b => b.type === 'castle' && b.progress >= 1);
  if (castle && near) {
    const want = Math.min(10, k.workers); const barr = k.buildings.filter(b => b.type === 'barracks' && b.progress >= 1); const wantG = Math.min(6, barr.reduce((a, b) => a + b.level + b.workers, 0));
    let nw = walkers.filter(w => !w.guard).length, ng = walkers.filter(w => w.guard).length;
    if (nw < want) { walkers.push(mkWalker(false, nw, castle.x + 6, castle.z + 12)); } else if (nw > want) { const i = walkers.findIndex(w => !w.guard); G.scene!.remove(walkers[i].obj); walkers.splice(i, 1); }
    if (ng < wantG) { const b = barr[ng % barr.length]; walkers.push(mkWalker(true, ng, b.x + 4, b.z + 6)); } else if (ng > wantG) { const i = walkers.findIndex(w => w.guard); G.scene!.remove(walkers[i].obj); walkers.splice(i, 1); }
    const jobs = k.buildings.filter(b => b.progress >= 1 && b.workers > 0); const night = G.dayT > 0.8 || G.dayT < 0.2;
    walkers.forEach((w, idx) => {
      w.t -= dt; w.cd -= dt; let sp = 0; let threat: any = null, td = 40; if (w.guard) for (const h of G.hostiles) { if (h.dead || !h.active || h.kind === 'boss' || h.def.dmg <= 0) continue; const d = Math.hypot(h.pos.x - w.pos.x, h.pos.z - w.pos.z); if (d < td && havenR(h.pos.x, h.pos.z) < 1.3 && (h.aggro || h.raid)) { td = d; threat = h; } }
      let tx = w.target.x, tz = w.target.z;
      if (threat) { tx = threat.pos.x; tz = threat.pos.z; sp = td > 3 ? 7 : 0; if (td < 3.5 && w.cd <= 0) { w.cd = 1; damageHostile(threat, 12 + k.buildings.filter(b => b.type === 'barracks').reduce((a, b) => a + b.level * 3, 0), { src: 'guard' }); sfx('swing', 0.4); (w as any).sw = 0.3; } }
      else { if (w.t <= 0) { w.t = rand(3, 6); let c: { x: number; z: number } = castle; if (!w.guard && jobs.length) c = jobs[(idx + Math.floor(G.t / 40)) % jobs.length]; else if (w.guard) c = barr[idx % Math.max(1, barr.length)] || castle; const a = rand(0, 6.28), r = rand(3, 9); w.target.set(c.x + Math.cos(a) * r, w.pos.y, c.z + Math.sin(a) * r); (w as any).go = Math.random() < 0.65; }
        tx = w.target.x; tz = w.target.z; const d = Math.hypot(tx - w.pos.x, tz - w.pos.z); if ((w as any).go && d > 1) sp = 2.2; }
      if (sp > 0) { const dx = tx - w.pos.x, dz = tz - w.pos.z, d = Math.hypot(dx, dz) || 1; w.yaw = lerpAng(w.yaw, Math.atan2(dx, dz), dt * 8); collide(w.pos.x + (dx / d) * sp * dt, w.pos.z + (dz / d) * sp * dt, 0.5, C); const g = groundAt(C.x, C.z, w.pos.y + 2); if (g > -1e8) w.pos.set(C.x, g, C.z); w.walk += dt * sp * 3.2; }
      w.obj.position.copy(w.pos); w.obj.visible = !(night && !w.guard); w.obj.rotation.y = w.yaw; const P = w.obj.userData.parts; const s = sp > 0 ? Math.sin(w.walk) * 0.7 : 0; P.legL.rotation.x = s; P.legR.rotation.x = -s; P.armL.rotation.x = -s; P.armR.rotation.x = (w as any).sw > 0 ? (w as any).sw * -8 + 0 : sp > 0 ? s : -1 + Math.sin(t * 6 + idx) * 0.8; if ((w as any).sw > 0) (w as any).sw -= dt;
    });
  }
  // build-quest sync
  questT -= dt; if (questT <= 0) { questT = 2; for (const q of Object.keys(st.quests)) { const qs = st.quests[q]; if (qs.state !== 'active') continue; const def = (window as any).__QUESTS?.find((x: any) => x.id === q); if (!def) continue; def.objs.forEach((o: any, i: number) => { let c = -1; if (o.key.startsWith('build:')) c = k.buildings.filter(b => b.type === o.key.slice(6) && b.progress >= 1).length; else if (o.key === 'count:worker') c = k.workers; if (c >= 0 && qs.prog[i] < Math.min(o.n, c)) st.emitQ(o.key, Math.min(o.n, c) - qs.prog[i]); }); } }
  // raid
  const r = G.event.raid; if (r) { r.t += dt; raidT += dt; if (raidT > 0.5) { raidT = 0; if (k.castleHp <= 0) endRaid(false); else if (r.alive <= 0) endRaid(true); else if (r.t > 240) endRaid(true); } }
}
export function startRaid(): boolean {
  const st = useStore.getState(); const castle = st.kingdom.buildings.find(b => b.type === 'castle'); if (!castle || G.event.raid) return false;
  const n = 4 + castle.level * 2 + Math.floor(st.level / 3); G.event.raid = { alive: n, t: 0, total: n }; st.kingdom.castleHp = Math.max(st.kingdom.castleHp, 200);
  for (let i = 0; i < n; i++) { const a = rand(0, 6.28); const R = haven.r * 0.75; const x = haven.x + Math.cos(a) * R, z = haven.z + Math.sin(a) * R; const g = groundAt(x, z, 200); if (g < -1e8) { G.event.raid.alive--; continue; } const type = i % 4 === 3 && st.level > 4 ? 'wolf' : 'goblin'; const e = spawnEnemy(type, x, g, z, 'haven', { raid: true, hpMul: 1 + st.level * 0.05 }); e.aggro = true; e.state = 'chase'; (e as any).minion = false; fx.burst(V1.set(x, g + 1, z), 14, '#ff6a3a', 6, 0.8, 0.8); }
  st.setBanner('RAID ON HAVEN!', 'Defend your castle!'); sfx('roar_dragon', 0.4); st.toast(`Goblin raiders are attacking Haven! (${n} enemies)`, 'bad'); G.event.marker = { x: castle.x, z: castle.z, label: 'RAID', t: 240 };
  return true;
}
function endRaid(win: boolean) {
  const st = useStore.getState(); const r = G.event.raid!; G.event.raid = null; G.event.marker = null;
  if (win) { st.emitQ('count:defend'); const gold = 120 + r.total * 25; st.addItem('gold', gold, true); st.gainXp(80 + r.total * 10); st.setBanner('RAID REPELLED', `+${gold} gold`); sfx('levelup'); spawnLoot(V1.set(haven.x, 6, haven.z), 'crystal', 2); st.toast('Haven is safe! Kingdom defended.', 'good'); st.kingdom.castleHp = 400; }
  else { const inv = { ...st.inv }; for (const kk of ['gold', 'wood', 'stone', 'food']) inv[kk] = Math.floor((inv[kk] || 0) * 0.85); st.set_({ inv }); st.kingdom.castleHp = 200; st.setBanner('CASTLE UNDER SIEGE', 'Raiders plundered your stores'); st.toast('The raiders plundered 15% of your stores!', 'bad'); for (const h of G.hostiles) if (h.raid && !h.dead) { h.dead = true; h.deadT = 0; } }
}
