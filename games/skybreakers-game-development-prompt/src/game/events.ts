// Dynamic world: day/night, weather, world events (pirates, invasions, treasure, rare creatures, storms, raids).
import * as THREE from 'three';
import { sfx } from './audio';
import { areaDamage, spawnLoot } from './combat';
import { removeI } from './entities';
import { spawnEnemy, spawnPirate } from './enemies';
import { fx } from './fx';
import { buildNode } from './models2';
import { startRaid } from './kingdom';
import { G, rand } from './runtime';
import { useStore } from './store';
import { ISLANDS, groundAt, islandAt, radiusAt, terrainH } from './world';

const V1 = new THREE.Vector3(); const DAY = 520; let strikeT = 3; let wTimer = 0;
const treasure: { obj: THREE.Group; beam: THREE.Mesh; id: string; t: number }[] = []; let stagObj: any = null;
const beamGeo = new THREE.CylinderGeometry(0.5, 1.2, 80, 10, 1, true); const beamMat = new THREE.MeshBasicMaterial({ color: '#ffe27a', transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
export const sunElev = () => Math.sin((G.dayT - 0.25) * Math.PI * 2);
const evt = (id: string, text: string, t = 120) => { G.event.active = { id, t, text }; };
const origin = () => (G.player.inShip ? G.ship.pos : G.player.pos);
export const pirateCount = () => G.hostiles.filter(h => h.kind === 'ship' && !h.dead).length;

function randomGround(near: boolean) {
  const st = useStore.getState(); const o = origin(); const pool = ISLANDS.filter(i => st.level >= i.minLevel && st.discovered.includes(i.id) && !i.minor);
  for (let t = 0; t < 20; t++) { const isl = near ? (islandAt(o.x, o.z) || pool[0]) : pool[Math.floor(Math.random() * pool.length)]; if (!isl) continue; const a = rand(0, 6.28), u = rand(0.2, 0.8); const R = radiusAt(isl, a); const x = isl.x + Math.cos(a) * u * R, z = isl.z + Math.sin(a) * u * R; const y = terrainH(isl, x, z); if (y === y) return { x, y, z, isl }; }
  return null;
}
function spawnTreasure() {
  const g = randomGround(false); if (!g) return false; const obj = buildNode('chest', g.isl.biome); obj.position.set(g.x, g.y, g.z); G.scene!.add(obj); const beam = new THREE.Mesh(beamGeo, beamMat); beam.position.set(g.x, g.y + 40, g.z); G.scene!.add(beam); const id = 'tr' + Date.now();
  treasure.push({ obj, beam, id, t: 300 });
  G.interactables.push({ id, x: g.x, y: g.y, z: g.z, r: 3.5, label: () => 'Open Hidden Treasure', act: () => { const st = useStore.getState(); sfx('chest'); obj.userData.lid.rotation.x = -1.8; st.emitQ('count:chest'); fx.burst(V1.set(g.x, g.y + 1, g.z), 40, '#ffe27a', 8, 0.7, 1, -2, 4); for (const [it, n] of [['gold', Math.round(rand(150, 350))], ['crystal', 3], ['essence', 3], ['ingot', 3], ['gear', 2], ['phoenix_feather', Math.random() < 0.2 ? 1 : 0]] as [string, number][]) if (n > 0) spawnLoot(V1.set(g.x + rand(-1.5, 1.5), g.y + 1.2, g.z + rand(-1.5, 1.5)), it, n); st.gainXp(60); removeI(id); G.event.marker = null; setTimeout(() => { G.scene!.remove(obj); G.scene!.remove(beam); const k = treasure.findIndex(t => t.id === id); if (k >= 0) treasure.splice(k, 1); }, 4000); } });
  G.event.marker = { x: g.x, z: g.z, label: 'TREASURE', t: 300 }; useStore.getState().setBanner('TREASURE DISCOVERED', `A glowing chest appeared on ${g.isl.name}`); evt('treasure', `Hidden treasure on ${g.isl.name}`, 300); sfx('quest'); return true;
}
function spawnPirates(n = 1) {
  const o = origin(); const st = useStore.getState(); const a0 = rand(0, 6.28);
  for (let i = 0; i < n; i++) { const a = a0 + i * 0.8; spawnPirate(o.x + Math.cos(a) * 170, o.y + 25, o.z + Math.sin(a) * 170); }
  st.setBanner('SKY PIRATES!', 'Enemy airships approaching'); st.toast('Pirate airships spotted! Fight them with your cannons.', 'bad'); sfx('roar_goblin', 0.7); sfx('boss', 0.5); evt('pirates', 'Sky pirates attacking!', 150);
}
function invasion() {
  const o = origin(); const st = useStore.getState(); const n = 5 + Math.floor(st.level / 3);
  for (let i = 0; i < n; i++) { const a = (i / n) * 6.28; const x = o.x + Math.cos(a) * 55, z = o.z + Math.sin(a) * 55; const g = groundAt(x, z, o.y + 40); const e = spawnEnemy('harpy', x, (g > -1e8 ? g : o.y) + 8, z, '', { hpMul: 1 + st.level * 0.06 }); e.aggro = true; e.state = 'chase'; e.flying = true; e.pos.y = Math.max(o.y + 6, (g > -1e8 ? g : o.y) + 8); e.home.copy(e.pos); }
  st.setBanner('MONSTER INVASION', 'Flying beasts swarm the skies'); sfx('roar_harpy', 1); evt('invasion', 'Flying monster invasion!', 90);
}
function rareStag() {
  const g = randomGround(true); if (!g) return false; const e = spawnEnemy('stag', g.x, g.y, g.z, g.isl.id); stagObj = e; G.event.marker = { x: g.x, z: g.z, label: 'RARE', t: 200 }; useStore.getState().setBanner('RARE CREATURE', 'A Prismatic Stag has appeared!'); evt('stag', 'A Prismatic Stag roams nearby', 200); sfx('npc'); return true;
}
function storm(dur = 70) { G.weather.type = 'storm'; G.weather.t = 0; G.weather.next = dur; G.weather.stormT = dur; useStore.getState().setBanner('STORM APPROACHING', 'Lightning will strike — keep moving!'); evt('storm', 'Lightning storm', dur); }

export function updateEvents(dt: number) {
  const st = useStore.getState(); const w = G.weather; const o = origin();
  G.dayT = (G.dayT + dt / DAY) % 1; wTimer += dt;
  // weather
  w.t += dt; const isFrost = islandAt(o.x, o.z)?.biome === 'frost';
  if (w.t > w.next && w.stormT <= 0) { w.t = 0; w.next = rand(80, 170); const r = Math.random(); w.type = r < 0.5 ? 'clear' : r < 0.72 ? 'cloudy' : r < 0.93 ? 'rain' : 'storm'; if (w.type === 'storm') { w.stormT = rand(40, 60); w.next = w.stormT; } }
  if (w.stormT > 0) { w.stormT -= dt; if (w.stormT <= 0) { w.type = 'cloudy'; w.t = 0; w.next = 60; if (G.event.active?.id === 'storm') { st.toast('The storm passes. Storm essence rains down!', 'good'); for (let i = 0; i < 2; i++) spawnLoot(V1.set(o.x + rand(-4, 4), o.y + 3, o.z + rand(-4, 4)), i ? 'crystal' : 'essence', 2); G.event.active = null; } } }
  const target = w.type === 'clear' ? 0 : w.type === 'cloudy' ? 0.35 : w.type === 'rain' ? 0.65 : 1; w.i += (target - w.i) * Math.min(1, dt * 0.3); w.flash = Math.max(0, w.flash - dt * 3);
  if (w.type === 'storm' && !G.cam.cine && w.i > 0.5) { strikeT -= dt; if (strikeT <= 0) { strikeT = rand(3, 6); const tx = o.x + rand(-28, 28), tz = o.z + rand(-28, 28); const gy = groundAt(tx, tz, o.y + 40); if (gy > -1e8 || G.player.inShip) { const p = new THREE.Vector3(tx, gy > -1e8 ? gy : o.y, tz); fx.telegraph(p, 3.5, 1.2, '#fff27a'); setTimeout(() => { if (!G.scene) return; fx.bolt(V1.set(p.x, p.y + 70, p.z).clone(), p, '#ffffff', 0.5); w.flash = 1; sfx('lightning', 0.8); areaDamage(V1.set(p.x, p.y + 1, p.z), 3.8, 24, { team: 'enemy', elem: 'lightning', knock: 1 }); G.cam.shake = Math.max(G.cam.shake, 0.3); }, 1200); } } }
  void isFrost;
  // events
  if (G.event.active) { G.event.active.t -= dt; if (G.event.active.t <= 0 || (G.event.active.id === 'pirates' && pirateCount() === 0 && G.event.active.t < 140)) G.event.active = null; }
  if (G.event.marker) { G.event.marker.t -= dt; if (G.event.marker.t <= 0) G.event.marker = null; }
  for (let i = treasure.length - 1; i >= 0; i--) { const t = treasure[i]; t.t -= dt; beamMat.opacity = 0.25 + Math.sin(G.t * 3) * 0.1; if (t.t <= 0) { G.scene!.remove(t.obj); G.scene!.remove(t.beam); removeI(t.id); treasure.splice(i, 1); if (G.event.marker?.label === 'TREASURE') G.event.marker = null; } }
  if (stagObj && (stagObj.dead || stagObj.pos.y < -300)) { stagObj = null; if (G.event.marker?.label === 'RARE') G.event.marker = null; }
  // quest-driven triggers
  if (st.flags.raid && st.kingdom.buildings.some(b => b.type === 'castle' && b.progress >= 1) && Math.hypot(o.x - ISLANDS[1].x, o.z - ISLANDS[1].z) < 450) { st.set_({ flags: { ...st.flags, raid: false } }); setTimeout(() => startRaid(), 5000); }
  if (st.flags.pirates && st.repaired && pirateCount() === 0) { st.set_({ flags: { ...st.flags, pirates: false } }); setTimeout(() => spawnPirates(2), 8000); }
  // random scheduler
  if (G.cam.cine || G.bossFight || G.paused) return; G.event.next -= dt;
  if (G.event.next <= 0) {
    G.event.next = rand(110, 190); const opts: [string, number][] = [['treasure', 2], ['stag', 1.2], ['storm', 1.2], ['invasion', st.level >= 2 ? 1.6 : 0], ['pirates', st.repaired && st.level >= 2 && pirateCount() === 0 ? 2.2 : 0], ['raid', st.kingdom.buildings.some(b => b.type === 'castle' && b.progress >= 1) && st.level >= 3 && !G.event.raid ? 1.4 : 0]];
    let tot = opts.reduce((a, b) => a + b[1], 0); let r = Math.random() * tot; let pick = 'treasure'; for (const [k, v] of opts) { r -= v; if (r <= 0 && v > 0) { pick = k; break; } }
    if (G.event.active && pick !== 'raid') return; if (pick === 'treasure') spawnTreasure(); else if (pick === 'stag') rareStag(); else if (pick === 'storm') storm(); else if (pick === 'invasion') invasion(); else if (pick === 'pirates') spawnPirates(1 + (st.level > 6 ? 1 : 0)); else if (pick === 'raid') startRaid();
  }
}
export function resetEvents() { for (const t of treasure) { G.scene?.remove(t.obj); G.scene?.remove(t.beam); } treasure.length = 0; G.event.active = null; G.event.marker = null; G.event.raid = null; G.event.next = 80; G.weather.type = 'clear'; G.weather.i = 0; G.weather.stormT = 0; }
export const debugEvent = { storm, spawnPirates, invasion, spawnTreasure, rareStag };
