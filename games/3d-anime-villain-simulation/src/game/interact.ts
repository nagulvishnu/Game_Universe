import * as THREE from 'three';
import { REGIONS, REGION_MAP, regionCenter } from './data';
import { G, V3, down, hudState, pressed, rnd, seeded } from './runtime';
import { buildBunker, buildHQInterior, interiorPos, lootRoll } from './world';
import { derive, hqTier, useGame } from './store';
import { VSPECS } from './vehicles';
import { CHOP, deliverVehicle, enterVehicle, exitVehicle, findNearestVehicle } from './vehiclesys';
import { crime } from './combat';
import { spawnGuards, spawnResident, startAssault } from './actors';
import { fx } from './fx';
import { sfx } from './audio';
import { DECORS } from './data';
import { saveSlot } from './save';

export const interiorRoot = new THREE.Group();
let hqGroup: THREE.Group | null = null, hqKey = '', bunkerGroup: THREE.Group | null = null; let bunkerSpawned = false;
const HATCH = (() => { const r = REGION_MAP.shadow; const c = regionCenter(r); return new V3(c.x + 12, 0, c.z + 12); })();
export const hatchPos = HATCH;
const retPos = new V3(-56, 0, 0);

export function initWorldInteractables() {
  G.interactables = G.interactables.filter((i) => i.kind === 'loot' || i.kind === 'register' || i.kind === 'core');
  for (const r of REGIONS) { const c = regionCenter(r); G.interactables.push({ id: 'cmd_' + r.id, kind: 'cmd', pos: new V3(c.x, 1, c.z + 5.5), label: '', taken: false, data: { region: r.id } }); }
  G.interactables.push({ id: 'hatch', kind: 'hatch', pos: HATCH.clone().setY(0.5), label: 'Descend into the underground bunker', taken: false, data: {} });
}
export function prepareInterior(kind: 'hq' | 'bunker') {
  const s = useGame.getState();
  if (kind === 'hq') {
    const key = JSON.stringify([hqTier(s), s.fac, s.decor]); if (hqGroup && hqKey === key) return; if (hqGroup) interiorRoot.remove(hqGroup); hqKey = key;
    const dc = DECORS.find((d) => d.id === s.decor)?.color ?? '#a855f7'; hqGroup = buildHQInterior(hqTier(s), s.fac, s.decor, s.decor === 'none' ? '#7c3aed' : dc); interiorRoot.add(hqGroup);
  } else if (!bunkerGroup) { bunkerGroup = buildBunker(); interiorRoot.add(bunkerGroup); }
}
function teleport(to: 'hq' | 'bunker' | '') {
  const p = G.p;   if (to) { retPos.copy(p.pos); prepareInterior(to); const g = to === 'hq' ? hqGroup! : bunkerGroup!; p.pos.copy((g.userData as { spawn: THREE.Vector3 }).spawn); p.interior = to; p.yaw = Math.PI; p.camYaw = 0; }
  else { if (p.interior) p.pos.copy(retPos); p.interior = ''; p.yaw = 0; }
  p.vel.set(0, 0, 0); p.flying = false; sfx('door');
  if (to === 'bunker' && !bunkerSpawned) { bunkerSpawned = true; const o = interiorPos.bunker; for (let i = 0; i < 6; i++) spawnGuards({ x: o.x + rnd(-10, 14), z: o.z + rnd(-12, 6), w: 6, d: 6, kind: 'warehouse', interior: 'bunker' }, 1); }
}
export function resetInteriorGroups() { interiorRoot.clear(); hqGroup = null; hqKey = ''; bunkerGroup = null; bunkerSpawned = false; }
export function resetInteriors() { bunkerSpawned = false; G.interactables.forEach((i) => { if (i.kind === 'loot' || i.kind === 'register' || i.kind === 'core') { i.taken = false; if (i.mesh) { i.mesh.scale.set(1, 1, 1); } } }); G.enterables.forEach((e) => { e.spawned = false; e.looted = 0; }); }

// ───────────── find & execute ─────────────
interface Cand { kind: string; label: string; need: number; run: () => void; d: number }
let cur: string = ''; let prog = 0; let sfxT = 0;
const rng = seeded(Date.now() & 0xffff);

function cmdLabel(rid: string) {
  const r = REGION_MAP[rid]; const t = useGame.getState().terr[rid];
  if (t.state === 'Villain-Controlled' || t.state === 'Fully Conquered') return `${r.name}: manage territory (G)`;
  if (G.assault) return 'An assault is already underway';
  return `Assault ${r.name} — ${t.state} (Lv ${r.lvl}) vs ${r.bossName}`;
}
function loot(it: typeof G.interactables[number]) {
  const st = useGame.getState(); it.taken = true; if (it.mesh) it.mesh.scale.y = 0.8; const kind = it.data.loot as string; const ent = G.enterables.find((e) => e.id === it.data.ent);
  const r = lootRoll(kind === 'vault' ? 'safe' : kind, () => rng()); sfx('search');
  if (kind === 'vault') { r.money = 9000; r.items = ['darkcrystal', 'darkcrystal', 'plasmacore']; if (Math.random() < 0.5) r.items.push('eye'); st.evt('underground'); st.addXp(400); }
  if (r.money) st.addMoney(r.money); for (const i of r.items) st.giveItem(i); st.addXp(10 + (kind === 'safe' ? 20 : 0)); st.addRep(1);
  if (r.money) st.toast(`+$${r.money} found`, '#fde047');
  if (ent && ent.id !== 'bunker') {
    ent.looted++; if (ent.kind === 'warehouse') st.evt('warehouse'); else if (ent.kind === 'house' || ent.kind === 'hospital') st.evt('burgle');
    if (ent.kind === 'shop') st.evt('burgle'); crime(ent.kind === 'house' ? 2 : 4);
    if (ent.alarm && ent.looted === 1) { st.toast('SILENT ALARM TRIGGERED! Heroes are on their way!', '#ef4444'); sfx('alarm'); crime(32); }
    for (const a of G.actors) if (a.kind === 'civilian' && a.alive && Math.abs(a.pos.x - ent.x) < ent.w / 2 + 2 && Math.abs(a.pos.z - ent.z) < ent.d / 2 + 2) { a.aggro = true; crime(14); st.toast('The resident spotted you and called for help!', '#fca5a5'); }
  } else if (kind === 'crate') crime(2);
}
function register(it: typeof G.interactables[number]) {
  const st = useGame.getState(); it.taken = true; const m = Math.round((350 + rnd(0, 650)) * (1 + st.level * 0.05)); st.addMoney(m); st.addRep(8); st.addXp(60); st.evt('rob'); sfx('coin'); st.toast(`Cash register emptied: +$${m}. Get out before the heroes arrive!`, '#fde047');
  crime(42); sfx('alarm'); const ent = G.enterables.find((e) => e.id === it.data.ent); if (ent) for (const a of G.actors) if (a.kind === 'civilian' && a.alive && Math.abs(a.pos.x - ent.x) < ent.w / 2 + 2 && Math.abs(a.pos.z - ent.z) < ent.d / 2 + 2) a.aggro = true;
  if (it.mesh) it.mesh.scale.y = 0.6; setTimeout(() => { it.taken = false; if (it.mesh) it.mesh.scale.y = 1; }, 180000);
}
function core(it: typeof G.interactables[number]) {
  const st = useGame.getState(); it.taken = true; st.giveItem('researchdata', 2); st.giveItem('plasmacore'); st.addMoney(4000); st.addRep(25); st.addXp(300); st.evt('lab'); crime(55); sfx('alarm'); if (it.mesh) it.mesh.visible = false;
  const ent = G.enterables.find((e) => e.id === it.data.ent); if (ent) spawnGuards(ent, 3); st.toast('Data core stolen! Lab security reinforcements incoming!', '#22d3ee');
}

export function updateInteract(dt: number) {
  const p = G.p; const st = useGame.getState(); hudState.prompt = ''; hudState.progress = 0;
  if (p.dead > 0 || G.cine.t > 0 || G.paused) { prog = 0; return; }
  let c: Cand | null = null;
  if (p.vehicle) {
    const v = p.vehicle; const inChop = Math.hypot(p.pos.x - CHOP.x, p.pos.z - CHOP.z) < 10;
    if (inChop && Math.abs(v.speed) < 8) c = { kind: 'veh', label: v.stolen || !v.fromGarage ? 'Deliver / chop this vehicle' : 'Return to garage', need: 0, d: 0, run: () => deliverVehicle() };
    else if (Math.abs(v.speed) < 12) c = { kind: 'exit', label: `Exit ${VSPECS[v.type].name}`, need: 0, d: 0, run: () => exitVehicle() };
  } else {
    let best = 99;
    const inside = !!p.interior;
    const v = !inside ? findNearestVehicle(p.pos, 4) : null;
    if (v) { const d = Math.hypot(v.pos.x - p.pos.x, v.pos.z - p.pos.z) - 1.5; const owned = v.fromGarage || v.stolen; c = { kind: 'veh' + v.id, label: owned ? `Enter ${VSPECS[v.type].name}` : `Hold G: Steal ${VSPECS[v.type].name}`, need: owned ? 0 : 1.2, d, run: () => enterVehicle(v) }; best = d; }
    for (const it of G.interactables) {
      if (it.taken) continue; if (!!it.interior !== inside) continue; const dx = it.pos.x - p.pos.x, dz = it.pos.z - p.pos.z; const reach = it.kind === 'cmd' ? 9 : it.kind === 'hatch' ? 3.5 : it.kind === 'door' ? 3.2 : 2.9; const d = Math.hypot(dx, dz); if (d > reach || Math.abs(it.pos.y - p.pos.y) > 7 || d > best + 0.0001 && best < 90 && d > 2) continue; if (d >= best) continue; best = d;
      const k = it.kind;
      if (k === 'loot') c = { kind: it.id, label: `Hold G: ${it.label}`, need: it.data.loot === 'safe' || it.data.loot === 'vault' ? 2.2 : 0.9, d, run: () => loot(it) };
      else if (k === 'register') c = { kind: it.id, label: `Hold G: ${it.label}`, need: 2.2, d, run: () => register(it) };
      else if (k === 'core') c = { kind: it.id, label: `Hold G: ${it.label}`, need: 2.6, d, run: () => core(it) };
      else if (k === 'door') c = { kind: it.id, label: `G: ${it.label}`, need: 0, d, run: () => teleport('hq') };
      else if (k === 'hatch') c = { kind: it.id, label: `G: ${it.label}`, need: 0, d, run: () => teleport('bunker') };
      else if (k === 'exit') c = { kind: it.id, label: `G: ${it.label}`, need: 0, d, run: () => teleport('') };
      else if (k === 'vendor') c = { kind: it.id, label: 'G: Trade at the Black Market', need: 0, d, run: () => st.setOverlay('market') };
      else if (k === 'station') c = { kind: it.id, label: `G: ${it.data.fac === 'rest' ? 'Rest & save game' : it.label}`, need: 0, d, run: () => { if (it.data.fac === 'rest') { p.hp = derive(st).maxHp; p.en = derive(st).maxEn; saveSlot(st.slot, st.snapshot()); saveSlot('auto', st.snapshot()); st.toast('Rested and saved.', '#86efac'); sfx('heal'); } else st.setOverlay('org', 'hq'); } };
      else if (k === 'cmd') { const rid = it.data.region as string; const t = st.terr[rid]; const own = t.state === 'Villain-Controlled' || t.state === 'Fully Conquered'; c = { kind: it.id, label: `G: ${cmdLabel(rid)}`, need: 0, d, run: () => { if (own) st.setOverlay('org', 'territory'); else if (!G.assault) startAssault(rid); } }; }
    }
  }
  if (!c) { cur = ''; prog = 0; return; }
  hudState.prompt = c.label;
  if (c.kind !== cur) { cur = c.kind; prog = 0; }
  if (c.need <= 0) { if (pressed('KeyG')) c.run(); return; }
  if (down('KeyG')) { prog += dt / c.need; sfxT -= dt; if (sfxT < 0) { sfxT = 0.22; sfx(c.kind.startsWith('veh') ? 'steal' : 'search'); fx.spark(p.pos.x, p.pos.y + 1, p.pos.z, rnd(-1, 1), rnd(0, 1), rnd(-1, 1), 0.3, 0.1, '#ffd23f'); } hudState.progress = Math.min(1, prog); if (prog >= 1) { prog = 0; c.run(); } } else prog = Math.max(0, prog - dt * 2);
}

export function updateEnterables() {
  const p = G.p; for (const e of G.enterables) {
    const dx = Math.abs(p.pos.x - e.x), dz = Math.abs(p.pos.z - e.z); const near = dx < 240 && dz < 240; if (e.group) e.group.visible = near; if (!near) continue;
    const inside = dx < e.w / 2 && dz < e.d / 2 && p.pos.y < e.h; if (e.roof) e.roof.visible = !(dx < e.w / 2 + 1 && dz < e.d / 2 + 1 && p.pos.y < e.h + 0.5);
    if (inside && !e.spawned) { e.spawned = true; if (e.guard) { spawnGuards(e, e.guard); useGame.getState().toast(e.kind === 'lab' ? 'Lab security detected!' : 'Warehouse guards spotted you!', '#fb923c'); } if (e.resident || e.kind === 'shop' || e.kind === 'restaurant' || e.kind === 'hospital') { spawnResident(e); if (e.kind !== 'house') spawnResident(e); } }
  }
}
