import * as THREE from 'three';
import { BLOCK, CAT_COL, FIRST, HEROES, HERO_MAP, ITEM_MAP, LAST, REGIONS, REGION_MAP, REGION_SIZE, RIVAL_MAP, ROLE_COL, WORLD_OFF, regionCenter, regionAt, type Cat, type HeroDef, type Outfit } from './data';
import { G, V3, angDiff, clamp, rnd, seeded, type Actor, type Vec } from './runtime';
import { buildRig, defaultAnim, disposeRig, setAura, setWeapon, updateRig, type AnimState, type Look } from './rig';
import { explode, hurtActor, hurtPlayer, shoot, crime, center } from './combat';
import { useGame } from './store';
import { fx } from './fx';
import { sfx } from './audio';
import { collide, interiorPos, labelTex } from './world';

const S = () => useGame.getState();
const tv = new V3(), tv2 = new V3();
const gangRoutes = new Map<number, { target: Vec; timer: number }>();
let populationT = 0;
const CROWD_CIVILIANS = 26, CROWD_RADIUS = 95, CROWD_CAP = 56;

// ───────────── looks ─────────────
const HAIRS = ['#14141c', '#3a2a1a', '#7a4a2a', '#c9a24a', '#e8e8f2', '#2f3a5a', '#5a2a3a'];
const SKIN = ['#ffe0cc', '#f5c7a1', '#e0a47c', '#bd7a4f', '#8a5230'];
export function npcLook(seed: number, o: { kind: string; color?: string; hair?: string; scale?: number; form?: number; weapon?: string }): Look {
  const r = seeded(seed); const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)]; const c = o.color ?? '#888';
  let outfit: Outfit; let acc: string[] = []; let coat = 'none'; let coatColor = '#222';
  if (o.kind === 'civ') { const cols = ['#c0392b', '#2980b9', '#27ae60', '#f39c12', '#8e44ad', '#ecf0f1', '#16a085', '#d35400']; outfit = { top: pick(cols), bottom: pick(['#2c3e50', '#34495e', '#555', '#6b5a4a']), trim: pick(cols), boots: '#222', belt: '#333', style: pick(['tee', 'hoodie', 'tee', 'suit'] as Outfit['style'][]) }; if (r() < 0.2) acc.push('scarf'); if (r() < 0.15) acc.push('headband'); }
  else if (o.kind === 'gang') { outfit = { top: '#17171d', bottom: '#202028', trim: c, boots: '#0d0d10', belt: c, style: pick(['hoodie', 'tee', 'ninja'] as Outfit['style'][]) }; acc = [pick(['mask', 'headband', 'goggles', 'mask'])]; if (r() < 0.5) { coat = 'jacket'; coatColor = c; } }
  else if (o.kind === 'hero') { outfit = { top: '#1c2433', bottom: '#1c2433', trim: c, boots: c, belt: '#e8e8f2', style: 'armorsuit' }; acc = ['cape', pick(['goggles', 'headband', ''])].filter(Boolean); coat = r() < 0.4 ? 'armor' : 'none'; coatColor = c; }
  else if (o.kind === 'boss') { outfit = { top: '#15151c', bottom: '#15151c', trim: c, boots: '#0a0a0e', belt: c, style: 'regal' }; acc = ['cape', 'crown']; coat = 'armor'; coatColor = '#20202a'; }
  else if (o.kind === 'ally') { outfit = { top: '#101018', bottom: '#101018', trim: c, boots: '#0a0a0e', belt: '#d4143a', style: 'ninja' }; acc = ['visor']; coat = r() < 0.5 ? 'jacket' : 'none'; coatColor = '#26202e'; }
  else { outfit = { top: '#08000f', bottom: '#08000f', trim: c, boots: '#000', belt: c, style: 'ninja' }; acc = ['mask']; coat = 'cloak'; coatColor = '#14001f'; }
  return {
    skin: pick(SKIN), hairStyle: Math.floor(r() * 6), hairColor: o.hair ?? pick(HAIRS), eyeColor: pick(['#2fd1ff', '#d4143a', '#3ddc84', '#ffd23f', '#a855f7', '#e8e8f2']), face: Math.floor(r() * 4), outfit, coat, coatColor, glove: pick(['none', 'fingerless', 'gauntlet', 'long']), gloveColor: '#151519',
    acc, aura: c, scale: o.scale ?? 1 + (r() - 0.5) * 0.1, form: o.form ?? 0, outline: o.kind !== 'civ' && o.kind !== 'gang',
  };
}

// ───────────── creation ─────────────
export function makeActor(o: Partial<Actor> & { kind: Actor['kind']; team: Actor['team']; name: string; pos: Vec; lvl: number }): Actor {
  const seed = o.look ? 1 : Math.floor(rnd(1e6)); const color = o.color ?? '#ff4455';
  const a: Actor = {
    id: G.nextId++, kind: o.kind, team: o.team, name: o.name, def: o.def ?? '', pos: o.pos.clone(), vel: new V3(), yaw: rnd(0, 6.28), hp: o.hp ?? 60 + o.lvl * 9, maxHp: o.hp ?? 60 + o.lvl * 9, lvl: o.lvl, fly: o.fly ?? false,
    state: 'idle', t: rnd(0, 1), atkCd: rnd(0.5, 2), abCd: rnd(4, 8), power: o.power ?? 'Martial Arts', color, speed: o.speed ?? 5.5, dmg: o.dmg ?? 5 + o.lvl * 1.8, style: o.style ?? 'melee',
    rig: null, look: o.look ?? npcLook(seed, { kind: o.kind === 'hero' ? 'hero' : o.kind === 'civilian' ? 'civ' : o.kind === 'boss' || o.kind === 'rival' ? 'boss' : o.kind === 'ally' ? 'ally' : o.kind === 'summon' ? 'summon' : 'gang', color, scale: o.scale }),
    home: (o.home ?? o.pos).clone(), stun: 0, frozen: 0, alive: true, boss: o.boss ?? false, region: o.region ?? '', weak: o.weak ?? null, flash: 0, deadT: 0, memberId: o.memberId ?? '', scale: o.scale ?? 1,
    anim: '', atkT: 0, wander: o.pos.clone(), bleed: 0, life: o.life ?? 0, resp: o.resp ?? false, aggro: o.aggro ?? false, alt: rnd(0, 6.28), lastPos: o.pos.clone(), weapon: o.weapon ?? '', tgt: null, tele: 0, mode: 0, combo: 0, speedNow: 0,
    crowd: o.crowd ?? false, patrolId: o.patrolId, interior: o.interior,
  };
  G.actors.push(a); return a;
}
const rndName = () => `${FIRST[Math.floor(rnd(0, FIRST.length))]} ${LAST[Math.floor(rnd(0, LAST.length))]}`;
const THUGW = ['dagger', 'sword', 'energy', 'dagger', ''];
export function populateWorld() {
  for (const a of G.actors) if (a.rig) disposeRig(a.rig); G.actors.length = 0; G.assault = null; G.boss = null;
  gangRoutes.clear(); populationT = 0;
  const st = S();
  const crowd: Record<string, number> = { metro: 42, shadow: 16, capital: 14, research: 12, industrial: 16, martial: 8, mountain: 6, intl: 14, island: 8 };
  const gangGroups: Record<string, number> = { metro: 5, shadow: 4, industrial: 4, research: 2, mountain: 2 };
  for (const r of REGIONS) {
    const rng = seeded(r.gx * 53 + r.gy * 17 + 5); const cen = regionCenter(r); const ox = WORLD_OFF + r.gx * 400, oz = WORLD_OFF + r.gy * 400; const terr = st.terr[r.id];
    const sidewalk = () => { const alongX = rng() < 0.5; const line = Math.floor(rng() * 6); const s = 10 + rng() * 380; return alongX ? new V3(ox + s, 0, oz + line * 80 + (rng() < 0.5 ? -9.5 : 9.5)) : new V3(ox + line * 80 + (rng() < 0.5 ? -9.5 : 9.5), 0, oz + s); };
    const nciv = crowd[r.id] ?? 8; for (let i = 0; i < nciv; i++) { const p = sidewalk(); if (r.theme === 'island' && p.distanceTo(new V3(cen.x, 0, cen.z)) > 140) continue; makeActor({ kind: 'civilian', team: 'civ', name: rndName(), pos: p, lvl: 1, hp: 40, speed: 2.2 + rng() * 1.2, region: r.id }); }
    const ngang = gangGroups[r.id] ?? (terr.state === 'Hero-Controlled' ? 1 : 2); const gcol = r.theme === 'shadow' ? '#a855f7' : r.theme === 'industrial' ? '#ff8a3c' : ['#ff3b5c', '#3bff9a', '#ffd23f', '#3bb6ff'][Math.floor(rng() * 4)];
    for (let g = 0; g < ngang; g++) {
      let c = sidewalk(); if (r.id === 'metro' && g === 0) c = new V3(-20, 0, 70); if (c.distanceTo(new V3(cen.x, 0, cen.z)) < 35) c.x += 50;
      const patrolId = G.nextId;
      for (let i = 0; i < 3; i++) { const w = THUGW[Math.floor(rng() * THUGW.length)]; makeActor({ kind: 'gang', team: 'enemy', name: ['Street Thug', 'Gang Enforcer', 'Back-alley Punk'][i], pos: c.clone().add(new V3(i * 2 - 2, 0, rng() * 2)), lvl: Math.max(1, Math.round(r.lvl * 0.55 + rng() * 3)), power: 'Martial Arts', color: gcol, weapon: w, style: w === 'energy' ? 'ranged' : 'melee', region: r.id, speed: 5.2, patrolId }); }
      gangRoutes.set(patrolId, { target: c.clone(), timer: 0 });
    }
    const nh = terr.state === 'Hero-Controlled' ? 3 : terr.state === 'Contested' ? 1 : 0; const pool = HEROES.filter((h) => h.lvl <= r.lvl + 6 && h.id !== r.boss && h.id !== 'solaris');
    for (let i = 0; i < nh && pool.length; i++) { const h = pool[Math.floor(rng() * pool.length)]; spawnHero(h, new V3(cen.x + (rng() - 0.5) * 300, 0, cen.z + (rng() - 0.5) * 300), r.id, false); }
  }
}

function sidewalkNear(r: (typeof REGIONS)[number], x: number, z: number, minDistance: number, maxDistance: number): Vec {
  const ox = WORLD_OFF + r.gx * REGION_SIZE, oz = WORLD_OFF + r.gy * REGION_SIZE;
  for (let attempt = 0; attempt < 18; attempt++) {
    const alongX = Math.random() < 0.5;
    const lane = alongX
      ? clamp(Math.round((z - oz) / BLOCK) + Math.round(rnd(-1, 1)), 0, REGION_SIZE / BLOCK)
      : clamp(Math.round((x - ox) / BLOCK) + Math.round(rnd(-1, 1)), 0, REGION_SIZE / BLOCK);
    const side = Math.random() < 0.5 ? -1 : 1;
    const pos = alongX
      ? new V3(clamp(x + rnd(-maxDistance, maxDistance), ox + 8, ox + REGION_SIZE - 8), 0, oz + lane * BLOCK + side * 9.5)
      : new V3(ox + lane * BLOCK + side * 9.5, 0, clamp(z + rnd(-maxDistance, maxDistance), oz + 8, oz + REGION_SIZE - 8));
    const d = Math.hypot(pos.x - x, pos.z - z);
    if (d >= minDistance && d <= maxDistance) return pos;
  }
  return new V3(clamp(x + minDistance, ox + 8, ox + REGION_SIZE - 8), 0, clamp(z + 9.5, oz + 8, oz + REGION_SIZE - 8));
}

function updateAmbientPopulation(dt: number) {
  populationT -= dt;
  if (populationT > 0) return;
  populationT = 1.5;
  if (S().screen !== 'game' || G.paused || G.p.interior) return;

  const p = G.p.pos, region = regionAt(p.x, p.z);
  if (!region) return;
  for (let i = G.actors.length - 1; i >= 0; i--) {
    const a = G.actors[i];
    if (a.crowd && Math.hypot(a.pos.x - p.x, a.pos.z - p.z) > 240) {
      if (a.kind === 'gang' && a.patrolId !== undefined) gangRoutes.delete(a.patrolId);
      dropRig(a); G.actors.splice(i, 1);
    }
  }
  const dynamicCount = G.actors.reduce((n, a) => n + (a.crowd ? 1 : 0), 0);
  let localCivilians = G.actors.reduce((n, a) => n + (a.kind === 'civilian' && a.alive && Math.hypot(a.pos.x - p.x, a.pos.z - p.z) < CROWD_RADIUS ? 1 : 0), 0);
  const limit = Math.min(CROWD_CIVILIANS, localCivilians + Math.max(0, CROWD_CAP - dynamicCount));
  for (let i = 0; i < Math.min(6, limit - localCivilians); i++) {
    const pos = sidewalkNear(region, p.x, p.z, 18, CROWD_RADIUS);
    const civilian = makeActor({ kind: 'civilian', team: 'civ', name: rndName(), pos, lvl: 1, hp: 40, speed: 2.2 + rnd(0, 1.2), region: region.id, crowd: true });
    civilian.home.copy(pos); civilian.wander.copy(sidewalkNear(region, pos.x, pos.z, 8, 32));
  }

  const nearbyGang = G.actors.some((a) => a.kind === 'gang' && a.alive && Math.hypot(a.pos.x - p.x, a.pos.z - p.z) < 125);
  if (!nearbyGang && dynamicCount + 3 <= CROWD_CAP) {
    const center = sidewalkNear(region, p.x, p.z, 55, 115), patrolId = G.nextId;
    const color = region.accent;
    for (let i = 0; i < 3; i++) {
      const pos = center.clone().add(new V3(i * 2 - 2, 0, rnd(0, 2)));
      const weapon = THUGW[Math.floor(rnd(0, THUGW.length))];
      makeActor({ kind: 'gang', team: 'enemy', name: ['Street Thug', 'Gang Enforcer', 'Back-alley Punk'][i], pos, lvl: Math.max(1, Math.round(region.lvl * 0.55 + rnd(0, 3))), power: 'Martial Arts', color, weapon, style: weapon === 'energy' ? 'ranged' : 'melee', region: region.id, speed: 5.2, crowd: true, patrolId });
    }
    gangRoutes.set(patrolId, { target: center.clone(), timer: 0 });
  }
}

export function spawnHero(h: HeroDef, pos: Vec, region: string, resp: boolean, lvlBonus = 0) {
  const lvl = h.lvl + lvlBonus; const a = makeActor({
    kind: 'hero', team: 'hero', name: h.name, def: h.id, pos, lvl, hp: h.hp * (1 + lvlBonus * 0.05), fly: h.fly, power: h.power, weak: h.weak, color: h.color, speed: h.fly ? 13 : 7.5, dmg: 6 + lvl * 2.2, style: h.style, region, resp, aggro: resp,
    look: npcLook(h.name.length * 31 + h.lvl, { kind: 'hero', color: h.color, hair: h.hair }), weapon: h.style === 'melee' ? 'sword' : '',
  });
  if (h.fly && pos.y < 1) a.pos.y = 8; return a;
}

// ───────────── threat response ─────────────
let respT = 0;
export function updateResponse(dt: number) {
  respT -= dt; if (respT > 0 || G.p.interior) return; respT = 4;
  const want = [0, 0, 1, 2, 3, 4, 5, 6][G.threat] ?? 0; const act = G.actors.filter((a) => a.resp && a.alive);
  for (const a of act) if (G.threat === 0 && G.safeT > 25) { a.alive = false; a.deadT = 99; }
  if (act.length >= want) return;
  const pool = HEROES.filter((h) => h.threat <= G.threat && h.threat >= Math.max(2, G.threat - 2) && h.id !== 'solaris');
  if (!pool.length) return; const h = pool[Math.floor(rnd(0, pool.length))]; const ang = rnd(0, 6.28), d = rnd(55, 85);
  const pos = new V3(G.p.pos.x + Math.cos(ang) * d, 0, G.p.pos.z + Math.sin(ang) * d); if (h.fly) pos.y = G.p.pos.y + 25;
  const rg = regionAt(pos.x, pos.z)?.id ?? 'metro'; spawnHero(h, pos, rg, true, Math.max(0, G.threat - h.threat));
  if (G.threat >= 5) sfx('hero'); S().toast(`${h.name}, ${h.title}, has arrived!  "${h.line}"`, h.color);
}
export function spawnGuards(e: { x: number; z: number; w: number; d: number; kind: string; interior?: string }, n: number) {
  for (let i = 0; i < n; i++) makeActor({ kind: 'guard', team: 'enemy', name: e.kind === 'lab' ? 'Lab Security' : 'Warehouse Guard', pos: new V3(e.x + rnd(-e.w / 3, e.w / 3), 0, e.z + rnd(-e.d / 3, e.d / 3)), lvl: 6 + Math.round(rnd(0, 4)), color: e.kind === 'lab' ? '#22d3ee' : '#ff8a3c', aggro: true, weapon: e.kind === 'lab' ? 'energy' : 'sword', style: e.kind === 'lab' ? 'ranged' : 'melee', region: regionAt(e.x, e.z)?.id ?? '', interior: e.interior });
}
export function spawnResident(e: { x: number; z: number; w: number; d: number }) { return makeActor({ kind: 'civilian', team: 'civ', name: rndName(), pos: new V3(e.x + rnd(-e.w / 4, e.w / 4), 0, e.z + rnd(-e.d / 4, e.d / 4)), lvl: 1, hp: 40, speed: 5, aggro: false, region: '' }); }

// ───────────── allies ─────────────
let allyT = 0;
export function syncAllies(dt: number) {
  allyT -= dt; if (allyT > 0) return; allyT = 1.5; const st = S();
  const followers = st.members.filter((m) => m.assign === 'Follow Me').slice(0, 4); const inHQ = G.p.interior === 'hq';
  for (const a of G.actors) if (a.team === 'ally' && a.kind === 'ally' && a.memberId && !followers.find((m) => m.id === a.memberId) && a.def !== 'hq') { a.alive = false; a.deadT = 99; }
  for (const m of followers) {
    const ex = G.actors.find((a) => a.memberId === m.id && a.def !== 'hq'); if (ex && (ex.alive || ex.deadT < 15)) continue; if (ex) { ex.deadT = 99; }
    if (G.p.interior && !inHQ) continue;
    const pos = G.p.pos.clone().add(new V3(rnd(-3, 3), 0, rnd(-3, 3)));
    makeActor({ kind: 'ally', team: 'ally', name: m.name, pos, lvl: m.lvl, hp: 80 + m.str * 4, dmg: 4 + m.str * 0.5, speed: 8.2, color: ROLE_COL[m.role], memberId: m.id, interior: G.p.interior || undefined, style: m.role === 'Scientist' || m.role === 'Engineer' ? 'ranged' : m.role === 'Elite Villain' || m.role === 'Commander' ? 'mixed' : 'melee', weapon: m.role === 'Assassin' ? 'dagger' : m.role === 'Scientist' || m.role === 'Engineer' ? 'energy' : m.role === 'Henchman' ? '' : 'sword', power: 'Shadow', look: npcLook(m.seed, { kind: 'ally', color: ROLE_COL[m.role] }) });
  }
  const hqActors = G.actors.filter((a) => a.def === 'hq');
  if (inHQ) {
    if (!hqActors.length) { const o = interiorPos.hq; st.members.filter((m) => m.assign !== 'Follow Me').slice(0, 10).forEach((m, i) => { makeActor({ kind: 'ally', team: 'ally', name: m.name, def: 'hq', interior: 'hq', memberId: m.id, pos: new V3(o.x - 12 + (i % 5) * 6 + rnd(-1, 1), 0, o.z + 2 + Math.floor(i / 5) * 6), lvl: m.lvl, color: ROLE_COL[m.role], speed: 2, weapon: m.role === 'Assassin' ? 'dagger' : '', look: npcLook(m.seed, { kind: 'ally', color: ROLE_COL[m.role] }) }); }); }
  } else for (const a of hqActors) { a.alive = false; a.deadT = 99; }
}
if (typeof window !== 'undefined') window.addEventListener('sv-summon', ((e: CustomEvent) => {
  const d = e.detail; const a = makeActor({ kind: 'summon', team: 'ally', name: 'Shadow Clone', pos: new V3(d.x, G.p.pos.y, d.z), lvl: 5, hp: 70, dmg: d.dmg * 0.5, speed: 10, color: d.c, life: 12, power: 'Shadow', interior: G.p.interior || undefined, look: npcLook(7, { kind: 'summon', color: d.c, hair: '#000' }) }); fx.burst(a.pos, d.c, 20, 5, 0.6, 0.2);
}) as EventListener);

// ───────────── assault ─────────────
export function startAssault(regionId: string) {
  const r = REGION_MAP[regionId]; const st = S(); if (G.assault) return; const t = st.terr[regionId];
  G.assault = { region: regionId, waves: 3, wave: 0, alive: 0, t: 0, boss: 0, prev: t.state, fail: 0 };
  st.setTerr(regionId, { state: 'Contested' }); crime(45); st.toast(`ASSAULT ON ${r.name.toUpperCase()}! Defeat the garrison and ${r.bossName}.`, '#f43f5e'); sfx('alarm');
}
function spawnWave() {
  const A = G.assault!; const r = REGION_MAP[A.region]; const c = regionCenter(r); A.wave++;
  const heroSide = A.prev === 'Hero-Controlled' || r.bossKind === 'hero'; const n = Math.round(r.garrison / 3) + A.wave + 1;
  S().toast(`Wave ${A.wave} / ${A.waves}`, '#fb923c');
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * 6.28 + rnd(0, 1), d = rnd(22, 38); const pos = new V3(c.x + Math.cos(ang) * d, 0, c.z + Math.sin(ang) * d); const lvl = Math.round(r.lvl * 0.7 + A.wave * 2);
    if (heroSide) { const h = HEROES[Math.floor(rnd(0, 4))]; const a = makeActor({ kind: 'hero', team: 'hero', name: `Hero ${['Cadet', 'Guardian', 'Vanguard'][i % 3]}`, pos, lvl, hp: 90 + lvl * 12, fly: i % 3 === 0, power: h.power, weak: h.weak, color: h.color, speed: i % 3 === 0 ? 12 : 7.5, style: i % 2 ? 'ranged' : 'melee', memberId: 'assault', aggro: true, region: A.region, look: npcLook(i * 11 + A.wave, { kind: 'hero', color: h.color }) }); if (a.fly) a.pos.y = 9; }
    else makeActor({ kind: 'gang', team: 'enemy', name: ['Cult Acolyte', 'Syndicate Brute', 'Mountain Raider', 'Cult Blade'][i % 4], pos, lvl, hp: 80 + lvl * 10, power: 'Shadow', color: r.accent, speed: 6.5, style: i % 3 === 0 ? 'ranged' : 'melee', weapon: i % 3 === 0 ? 'energy' : 'sword', memberId: 'assault', aggro: true, region: A.region });
  }
  fx.ring(new V3(c.x, 0, c.z), r.accent, 40, 1, 0.2);
}
function spawnBoss() {
  const A = G.assault!; const r = REGION_MAP[A.region]; const c = regionCenter(r); const growth = 1 + S().rivalGrowth * 0.02; const pos = new V3(c.x + 14, 0, c.z);
  const hd = HERO_MAP[r.boss]; const rv = RIVAL_MAP[r.boss];
  let a: Actor;
  if (rv) a = makeActor({ kind: 'rival', team: 'enemy', name: `${rv.name} ${rv.title}`, def: rv.id, pos, lvl: rv.lvl, hp: rv.hp * growth, power: rv.power, color: rv.color, speed: rv.id === 'nyx' ? 11 : rv.id === 'zerath' ? 12 : 8, dmg: 10 + rv.lvl * 2.4, style: 'mixed', fly: rv.id === 'zerath', boss: true, scale: rv.id === 'ragnar' ? 1.35 : 1.1, memberId: 'assault', aggro: true, region: r.id, weapon: rv.id === 'ragnar' ? 'greatsword' : rv.id === 'nyx' ? 'dual' : 'special', look: npcLook(rv.lvl * 13, { kind: 'boss', color: rv.color, hair: rv.hair, scale: rv.id === 'ragnar' ? 1.35 : 1.1, form: rv.id === 'zerath' ? 3 : rv.id === 'ragnar' ? 2 : 1 }) });
  else if (hd) { a = spawnHero(hd, pos, r.id, false); a.boss = true; a.memberId = 'assault'; a.aggro = true; a.scale = hd.id === 'solaris' ? 1.2 : 1.1; a.look = npcLook(hd.lvl * 13, { kind: 'boss', color: hd.color, hair: hd.hair, scale: a.scale, form: hd.id === 'solaris' ? 4 : 2 }); a.kind = 'hero'; a.maxHp = a.hp = hd.hp * growth; a.weapon = hd.id === 'kenjin' ? '' : 'sword'; }
  else a = makeActor({ kind: 'rival', team: 'enemy', name: `${r.bossName} the Warlord`, def: 'grimfang', pos, lvl: r.lvl, hp: 1100, power: 'Earth', color: '#9ad1ff', speed: 8, dmg: 30, style: 'melee', boss: true, scale: 1.3, memberId: 'assault', aggro: true, region: r.id, weapon: 'greatsword' });
  S().toast(`${a.name} appears!`, a.color); sfx('hero'); fx.pillar(pos, a.color, 3, 50, 1); fx.ring(pos, a.color, 14, 0.8); A.boss = a.id;
}
export function updateAssault(dt: number) {
  const A = G.assault; if (!A) { G.boss = null; return; } const r = REGION_MAP[A.region]; const c = regionCenter(r); A.t += dt;
  const mem = G.actors.filter((a) => a.memberId === 'assault'); A.alive = mem.filter((a) => a.alive).length;
  const boss = mem.find((a) => a.boss); G.boss = boss && boss.alive ? { name: boss.name, hp: boss.hp, max: boss.maxHp } : null;
  const far = Math.hypot(G.p.pos.x - c.x, G.p.pos.z - c.z) > 170;
  if (G.p.dead > 0 || far) { A.fail += dt; if (A.fail > 12 || G.p.dead > 0) { endAssault(false); return; } } else A.fail = 0;
  if (A.alive > 0) return;
  if (A.t < 1.5) return;
  if (!boss && A.wave < A.waves) { spawnWave(); return; }
  if (!boss && A.wave >= A.waves) { spawnBoss(); return; }
  if (boss && !boss.alive) endAssault(true);
}
function endAssault(win: boolean) {
  const A = G.assault!; const r = REGION_MAP[A.region]; const st = S(); G.assault = null; G.boss = null;
  for (const a of G.actors) if (a.memberId === 'assault') { a.alive = false; a.deadT = 99; }
  if (win) {
    const rv = RIVAL_MAP[r.boss]; st.captureTerritory(r.id);
    if (rv) { st.addMoney(rv.reward.money); st.addRep(rv.reward.rep); st.addXp(rv.reward.xp); if (rv.reward.item) st.giveItem(rv.reward.item); }
    else { st.addMoney(r.income * 10); st.addRep(150 + r.lvl * 12); st.addXp(700 + r.lvl * 120); if (r.boss === 'solaris') st.giveItem('crown'); else if (Math.random() < 0.5) st.giveItem('darkcrystal'); }
    const c = regionCenter(r); fx.pillar(new V3(c.x, 0, c.z), '#ff2e57', 6, 120, 2); G.shake = 1;
  } else { st.setTerr(r.id, { state: A.prev }); st.toast('Assault failed — the garrison regroups.', '#f87171'); }
}

// ───────────── per-actor AI ─────────────
const rigRoot = new THREE.Group(); export const actorsRoot = rigRoot; const barRoot = new THREE.Group(); export const barsRoot = barRoot;
const extras = new WeakMap<Actor, { bar: THREE.Group; fill: THREE.Mesh; anim: AnimState; label: THREE.Sprite | null }>();
const barBg = new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.6, depthTest: false }); const barFill = new THREE.MeshBasicMaterial({ color: '#ff3355', depthTest: false });
const barGeo = new THREE.PlaneGeometry(1, 0.1);
function ensureRig(a: Actor) {
  if (a.rig) return; const rig = buildRig(a.look, a.boss || a.kind === 'hero'); rig.root.scale.setScalar(a.scale); rootAdd(rig.root);
  const w = ITEM_MAP[a.weapon === 'energy' ? 'plasma_pistol' : a.weapon === 'sword' ? 'katana' : a.weapon === 'dagger' ? 'knife' : a.weapon === 'greatsword' ? 'ironbreaker' : a.weapon === 'dual' ? 'fangs' : a.weapon === 'special' ? 'soulrender' : ''];
  if (w && a.team !== 'civ') setWeapon(rig, w.wtype!, a.weapon === 'special' ? a.color : w.color, false);
  a.rig = rig; const bar = new THREE.Group(); const bg = new THREE.Mesh(barGeo, barBg); bg.renderOrder = 998; bar.add(bg); const fill = new THREE.Mesh(barGeo, barFill); fill.renderOrder = 999; fill.position.z = 0.001; bar.add(fill); bar.scale.set(a.boss ? 1.8 : 1.1, 1, 1);
  let label: THREE.Sprite | null = null;
  if (a.kind === 'hero' || a.boss || a.team === 'ally') { label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex(a.name, a.team === 'ally' ? '#a7f3d0' : a.color), depthTest: false, transparent: true })); label.scale.set(3, 0.75, 1); label.renderOrder = 999; label.position.y = 0.45; bar.add(label); }
  barRoot.add(bar); extras.set(a, { bar, fill, anim: defaultAnim(), label });
}
function rootAdd(o: THREE.Object3D) { rigRoot.add(o); }
function dropRig(a: Actor) { if (a.rig) { disposeRig(a.rig); a.rig = null; } const e = extras.get(a); if (e) { barRoot.remove(e.bar); extras.delete(a); } }
export function clearActorMeshes() { for (const a of G.actors) dropRig(a); }

const toT = (_a: Actor, t: Actor | 'player') => (t === 'player' ? tv.set(G.p.pos.x, G.p.pos.y + 0.9, G.p.pos.z) : tv.set(t.pos.x, center(t), t.pos.z));
function hostileTo(a: Actor, b: Actor): boolean {
  if (!b.alive || b === a) return false;
  if (a.team === 'civ' || b.team === 'civ') return false;
  if (a.team === 'enemy') return b.team === 'hero' || b.team === 'ally'; if (a.team === 'hero') return b.team === 'enemy' || b.team === 'ally'; if (a.team === 'ally') return b.team === 'hero' || b.team === 'enemy'; return false;
}
function pickTarget(a: Actor): Actor | 'player' | null {
  let best: Actor | 'player' | null = null; let bd = a.team === 'hero' && !a.resp && !a.aggro ? 24 : 40;
  if (a.team !== 'ally' && !G.p.dead && !!G.p.interior === !!a.interior) {
    const dx = G.p.pos.x - a.pos.x, dz = G.p.pos.z - a.pos.z, dy = G.p.pos.y - a.pos.y; const d = Math.hypot(dx, dz, dy * 0.5);
    const wants = a.team === 'enemy' ? (a.aggro || d < 22 || a.kind === 'rival') : (a.resp || a.aggro || (G.threat >= 1 && d < 40) || (G.threat >= 2 && d < 70));
    if (wants && d < (a.aggro ? 120 : 60)) { best = 'player'; bd = d * (a.team === 'hero' ? 0.9 : 1.0); }
  }
  for (const b of G.actors) { if (!hostileTo(a, b)) continue; const d = Math.hypot(b.pos.x - a.pos.x, b.pos.z - a.pos.z, (b.pos.y - a.pos.y) * 0.5); const lim = a.team === 'ally' ? 30 : 18; if (d < Math.min(bd, lim)) { best = b; bd = d; } }
  return best;
}
function dealTo(a: Actor, t: Actor | 'player', dmg: number, kb: number, cat?: Cat) {
  if (t === 'player') hurtPlayer(dmg, a.pos, { kb, cat: cat ?? a.power }); else { tv2.set(t.pos.x - a.pos.x, 0.3, t.pos.z - a.pos.z).normalize().multiplyScalar(kb); hurtActor(t, dmg * (a.team === 'ally' ? 1 : 0.8), { kb: tv2, cat: a.power, stun: 0.2 }); }
}
function steer(a: Actor, dir: Vec, spd: number, dt: number, rate = 8) {
  const k = a.stun > 0 || a.frozen > 0 ? 0 : 1; const f = Math.min(1, rate * dt); a.vel.x += (dir.x * spd * k - a.vel.x) * f; a.vel.z += (dir.z * spd * k - a.vel.z) * f; if (a.fly) a.vel.y += (dir.y * spd * k - a.vel.y) * f;
}
function special(a: Actor, tp: Vec) {
  a.abCd = a.boss ? rnd(5, 8) : rnd(8, 13); const col = a.color; const t0 = tp.clone(); const dmg = a.dmg;
  if (a.def === 'ragnar') { const dir = tv.copy(t0).sub(a.pos).setY(0).normalize(); fx.ring(a.pos, col, 6, 0.6); a.vel.addScaledVector(dir, 34); a.atkT = 0.7; G.delayed.push({ t: 0.65, fn: () => { if (!a.alive) return; explode(a.pos.clone(), 7, dmg * 1.7, '#ffb36b', '#fff', 'Earth', 'enemy', 18); } }); return; }
  if (a.def === 'nyx') { const back = new V3(G.p.pos.x - Math.sin(G.p.yaw) * 3, G.p.pos.y, G.p.pos.z - Math.cos(G.p.yaw) * 3); fx.burst(a.pos, col, 24, 6, 0.6, 0.2); a.pos.copy(back); fx.burst(a.pos, col, 24, 6, 0.6, 0.2); a.atkCd = 0.25; a.atkT = 0.4; G.delayed.push({ t: 0.3, fn: () => { if (a.alive && a.pos.distanceTo(G.p.pos) < 4.5) { hurtPlayer(dmg * 1.4, a.pos, { kb: 10, cat: 'Shadow' }); fx.slash(tv.set(a.pos.x, a.pos.y + 1.2, a.pos.z), a.yaw, col, 4, 0.3); } } }); return; }
  if (a.def === 'zerath' || a.def === 'solaris') {
    const from = new V3(a.pos.x, a.pos.y + 1.5, a.pos.z); const dir = t0.clone().sub(from).normalize(); const end = from.clone().addScaledVector(dir, 70); fx.beam(from, end, col, 0.12, 0.8); a.atkT = 1.0; fx.burst(from, col, 20, 4, 0.8, 0.2); sfx('cast_beam');
    G.delayed.push({ t: 0.85, fn: () => { if (!a.alive) return; fx.beam(from, end, col, 1.3, 0.5); fx.beam(from, end, '#ffffff', 0.5, 0.5); const pp = new V3(G.p.pos.x, G.p.pos.y + 1, G.p.pos.z).sub(from); const al = pp.dot(dir); const perp = pp.sub(dir.clone().multiplyScalar(al)).length(); if (al > 0 && perp < 2.2) hurtPlayer(dmg * 2.2, from, { kb: 12, cat: a.power }); G.shake = Math.max(G.shake, 0.4); } }); return;
  }
  const pos = t0.clone().setY(0.2); fx.ring(pos, col, 5, 0.9, 0.1); fx.pillar(pos, col, 0.5, 4, 0.9); G.delayed.push({ t: 0.9, fn: () => { if (a.alive || a.hp > 0) explode(pos, 4.8, dmg * 1.5, col, '#ffffff', a.power, 'enemy', 12); } });
}
function aiFighter(a: Actor, dt: number) {
  a.t -= dt; if (a.t <= 0) { a.t = 0.35; a.tgt = pickTarget(a); }
  if (a.tgt && a.tgt !== 'player' && !a.tgt.alive) a.tgt = null;
  const tgt = a.tgt; a.atkCd -= dt; a.abCd -= dt; a.atkT -= dt; const p = G.p; let dir = tv2.set(0, 0, 0);
  let spd = a.speed; if (a.frozen > 0) spd *= 0.1;
  if (!tgt) {
    if (a.team === 'ally') { const d = Math.hypot(p.pos.x - a.pos.x, p.pos.z - a.pos.z); if (a.def === 'hq') { if (a.t > 0.3 && Math.random() < 0.02) a.wander.set(a.home.x + rnd(-4, 4), 0, a.home.z + rnd(-4, 4)); dir.set(a.wander.x - a.pos.x, 0, a.wander.z - a.pos.z); const l = dir.length(); if (l > 1) dir.multiplyScalar(1 / l); else dir.set(0, 0, 0); spd = 2.2; } else { if (d > 55 && !p.interior) { a.pos.set(p.pos.x + rnd(-3, 3), p.pos.y, p.pos.z + rnd(-3, 3)); fx.burst(a.pos, a.color, 12, 4, 0.4, 0.15); } const off = a.alt; const tx = p.pos.x + Math.cos(off) * 3.2, tz = p.pos.z + Math.sin(off) * 3.2; dir.set(tx - a.pos.x, 0, tz - a.pos.z); const l = dir.length(); if (l > 1.2) { dir.multiplyScalar(1 / l); spd = l > 8 ? 10 : 6; } else dir.set(0, 0, 0); } }
    else {
      if (a.kind === 'gang') {
        const region = REGION_MAP[a.region];
      if (region) {
        const patrolId = a.patrolId ?? a.id;
        let route = gangRoutes.get(patrolId);
        if (!route) { route = { target: a.pos.clone(), timer: 0 }; gangRoutes.set(patrolId, route); }
        route.timer -= dt;
        if (route.timer <= 0 || a.pos.distanceToSquared(route.target) < 64) {
          const c = regionCenter(region);
          route.target.copy(sidewalkNear(region, c.x, c.z, 35, 175)); route.timer = rnd(24, 36);
        }
        a.wander.copy(route.target);
      }
    } else if (Math.random() < 0.01) a.wander.set(a.home.x + rnd(-14, 14), 0, a.home.z + rnd(-14, 14));
      if (a.team === 'hero' && !a.resp && Math.random() < 0.004) { const r = REGION_MAP[a.region]; if (r) { const c = regionCenter(r); a.home.set(c.x + rnd(-170, 170), 0, c.z + rnd(-170, 170)); } }
      dir.set(a.wander.x - a.pos.x, 0, a.wander.z - a.pos.z); const l = dir.length(); if (l > 2) { dir.multiplyScalar(1 / l); spd = a.team === 'hero' ? 4.5 : a.kind === 'gang' ? 3.2 : 2.5; } else dir.set(0, 0, 0); if (a.fly) { dir.y = (Math.max(6, a.home.y) - a.pos.y) * 0.2; }
    }
    steer(a, dir, spd, dt); if (dir.lengthSq() > 0.01) a.yaw += angDiff(a.yaw, Math.atan2(dir.x, dir.z)) * Math.min(1, 8 * dt); return;
  }
  const tp = toT(a, tgt).clone(); const dx = tp.x - a.pos.x, dz = tp.z - a.pos.z; const dh = Math.hypot(dx, dz); const dy = tp.y - (a.pos.y + 0.9); const d3 = Math.hypot(dh, dy);
  if (a.atkT <= 0 && !a.stun) a.yaw += angDiff(a.yaw, Math.atan2(dx, dz)) * Math.min(1, 10 * dt);
  const ranged = a.style === 'ranged' || (a.style === 'mixed' && a.mode === 1); if (a.style === 'mixed' && Math.random() < 0.004) a.mode = a.mode ? 0 : 1;
  const want = ranged ? 11 : 1.9; const sl = a.alt + a.id; const dd = dh > 0.01 ? dh : 0.01;
  if (a.atkT > 0 && !ranged) spd *= 0.2;
  if (dh > want + 1.2) { dir.set(dx / dd + Math.cos(sl) * 0.25, 0, dz / dd + Math.sin(sl) * 0.25).normalize(); } else if (ranged && dh < want - 4) { dir.set(-dx / dd, 0, -dz / dd); spd *= 0.7; } else if (ranged) { dir.set(-dz / dd, 0, dx / dd).multiplyScalar(Math.sin(performance.now() / 1200 + a.id) > 0 ? 0.6 : -0.6); }
  if (a.fly) { const ty = tp.y + (ranged ? 6 : 1.2); dir.y = clamp((ty - a.pos.y) * 0.35, -1, 1); } else if (dh < 1.0) dir.set(0, 0, 0);
  if (a.team === 'ally' && a.kind === 'summon') spd *= 1.2;
  steer(a, dir, spd, dt);
  const lim = a.boss ? 1.1 : 1.6;
  if (a.abCd <= 0 && d3 < 40 && a.stun <= 0 && (a.boss || a.style !== 'melee' || a.kind === 'hero') && a.team !== 'ally') special(a, tp);
  else if (a.atkCd <= 0 && a.stun <= 0 && a.atkT <= 0) {
    if (ranged && d3 < 38) { a.atkCd = rnd(1.4, 2.3) * (a.team === 'hero' && G.threat > 4 ? 0.7 : 1); a.atkT = 0.4; a.combo++; const o = new V3(a.pos.x, a.pos.y + 1.3 * a.scale, a.pos.z); const dir2 = tp.clone().sub(o).normalize(); const sp = 34; if (a.team === 'ally') { shoot(o, dir2, { speed: sp, dmg: a.dmg, color: a.color, size: 0.3, team: 'player', cat: a.power }); } else shoot(o, dir2.add(new V3(rnd(-0.03, 0.03), rnd(-0.03, 0.03), rnd(-0.03, 0.03))), { speed: sp, dmg: a.dmg, color: a.team === 'hero' ? CAT_COL[a.power] : a.color, c2: '#ffffff', size: 0.35, team: 'enemy', cat: a.power, life: 2.4, explode: a.boss ? 2 : 0 }); sfx('shoot'); }
    else if (!ranged && dh < 2.8 + a.scale && Math.abs(dy) < 3) { a.atkCd = rnd(1.0, 1.7) / lim; a.atkT = 0.55; a.combo = (a.combo + 1) % 3; G.delayed.push({ t: 0.28, fn: () => { if (!a.alive || a.stun > 0) return; const tt = tgt; const tpos = tt === 'player' ? G.p.pos : tt.pos; if (Math.hypot(tpos.x - a.pos.x, tpos.z - a.pos.z) < 3.4 + a.scale) { dealTo(a, tt, a.dmg * (a.combo === 2 ? 1.5 : 1), a.combo === 2 ? 9 : 4); fx.slash(tv.set(a.pos.x + Math.sin(a.yaw) * 1.5, a.pos.y + 1.2, a.pos.z + Math.cos(a.yaw) * 1.5), a.yaw, a.team === 'hero' ? CAT_COL[a.power] : a.color, 2.4, a.combo * 0.6, 0.22); sfx('hit'); } } }); }
  }
}
function aiCivilian(a: Actor, dt: number) {
  const dp = Math.hypot(G.p.pos.x - a.pos.x, G.p.pos.z - a.pos.z); const scared = a.aggro || (G.p.combatT > 0 && dp < 22) || (dp < 5 && (G.p.boost || G.p.vehicle)) || G.threat >= 4 && dp < 30; const dir = tv2.set(0, 0, 0); let spd = a.speed;
  if (scared) { dir.set(a.pos.x - G.p.pos.x, 0, a.pos.z - G.p.pos.z).normalize(); spd = 6.4; a.state = 'flee'; if (dp > 45 && !a.aggro) a.state = 'idle'; if (a.aggro && dp > 50) a.aggro = false; }
  else { a.t -= dt; if (a.t <= 0) { a.t = rnd(3, 9); if (Math.random() < 0.5) a.wander.set(a.home.x + rnd(-25, 25), 0, a.home.z + rnd(-25, 25)); else a.wander.copy(a.pos); } dir.set(a.wander.x - a.pos.x, 0, a.wander.z - a.pos.z); const l = dir.length(); if (l > 1.5) dir.multiplyScalar(1 / l); else dir.set(0, 0, 0); a.state = 'walk'; }
  steer(a, dir, spd, dt); if (dir.lengthSq() > 0.01) a.yaw += angDiff(a.yaw, Math.atan2(dir.x, dir.z)) * Math.min(1, 10 * dt);
}

let rigBudget = 0;
export function updateActors(dt: number, cam: THREE.Camera) {
  updateAmbientPopulation(dt);
  const p = G.p; rigBudget = 2; const px = p.pos.x, pz = p.pos.z;
  for (let i = G.actors.length - 1; i >= 0; i--) {
    const a = G.actors[i]; const dx = a.pos.x - px, dz = a.pos.z - pz; const d2 = dx * dx + dz * dz;     const near = d2 < 150 * 150 && (!!p.interior === !!a.interior);
    if (!a.alive) {
      a.deadT += dt; if (a.rig && a.deadT > 3.5) dropRig(a);
      if (a.crowd && a.deadT > 16) { if (a.kind === 'gang' && a.patrolId !== undefined) gangRoutes.delete(a.patrolId); dropRig(a); G.actors.splice(i, 1); continue; }
      if (a.deadT > (a.resp || a.memberId === 'assault' || a.kind === 'summon' || a.def === 'hq' || a.boss ? 1 : a.team === 'ally' ? 20 : 110)) {
        if (a.resp || a.memberId === 'assault' || a.kind === 'summon' || a.def === 'hq' || a.boss || (a.team === 'ally' && !S().members.find((m) => m.id === a.memberId))) { dropRig(a); G.actors.splice(i, 1); continue; }
        if (a.team !== 'ally') { a.alive = true; a.hp = a.maxHp; a.pos.copy(a.home); a.vel.set(0, 0, 0); a.deadT = 0; a.state = 'idle'; a.aggro = false; a.tgt = null; a.stun = 0; }
      }
      if (a.rig) { updateAnimFor(a, dt); }
      continue;
    }
    if (a.life > 0) { a.life -= dt; if (a.life <= 0) { fx.burst(a.pos, a.color, 16, 5, 0.5, 0.2); a.alive = false; a.deadT = 99; continue; } }
    if (!near) {
      if (a.rig) dropRig(a); a.t -= dt; if (a.t <= 0) { a.t = rnd(6, 14); if (a.team === 'hero' && !a.resp) { const r = REGION_MAP[a.region]; if (r) { const c = regionCenter(r); a.pos.set(c.x + rnd(-170, 170), a.fly ? 8 : 0, c.z + rnd(-170, 170)); a.home.copy(a.pos); } } }
      if (a.resp && d2 > 300 * 300) { a.alive = false; a.deadT = 99; } continue;
    }
    if (d2 < 120 * 120 && !a.rig && rigBudget > 0) { ensureRig(a); rigBudget--; }
    if (d2 > 130 * 130 && a.rig) dropRig(a);
    if (a.flash > 0) a.flash -= dt; if (a.stun > 0) a.stun -= dt; if (a.frozen > 0) a.frozen -= dt;
    if (a.kind === 'civilian') aiCivilian(a, dt); else if (a.def === 'hq' && a.state === 'idle') { /* idle guard */ aiFighter(a, dt); } else aiFighter(a, dt);
    // physics
    if (!a.fly) a.vel.y -= 30 * dt; a.pos.addScaledVector(a.vel, dt);
    if (a.fly) { a.vel.y *= 0.92; }
    const c = collide(a.pos, a.vel, 0.45 * a.scale, 1.8 * a.scale, 0);
    if (a.fly) { if (a.pos.y < c.ground + 0.6) a.pos.y = c.ground + 0.6; } else if (a.pos.y <= c.ground) { a.pos.y = c.ground; if (a.vel.y < 0) a.vel.y = 0; }
    const hi = a.interior ? 4000 : 640; a.pos.x = clamp(a.pos.x, -640, hi); a.pos.z = clamp(a.pos.z, -640, hi);
    a.speedNow = Math.hypot(a.vel.x, a.vel.z); if (a.rig) updateAnimFor(a, dt, cam);
  }
}
function updateAnimFor(a: Actor, dt: number, cam?: THREE.Camera) {
  const rig = a.rig!; const e = extras.get(a)!; if (!e) return; const s = e.anim; const w = rig.weapon ? (ITEM_MAP[a.weapon === 'energy' ? 'plasma_pistol' : a.weapon === 'sword' ? 'katana' : a.weapon === 'dagger' ? 'knife' : a.weapon === 'greatsword' ? 'ironbreaker' : a.weapon === 'dual' ? 'fangs' : 'soulrender']?.wtype ?? '') : '';
  s.wtype = w; s.speed = a.speedNow; s.combo = a.combo; s.heavy = false;
  if (!a.alive) s.mode = 'dead'; else if (a.stun > 0.05 && a.stun > 0) { s.mode = 'hit'; s.hit = Math.min(1, a.stun * 2.5); } else if (a.atkT > 0) { s.mode = a.fly && a.style === 'ranged' ? 'cast' : 'attack'; s.atkP = 1 - a.atkT / 0.55; s.castP = 1 - a.atkT / 0.4; if (a.style === 'ranged') { s.mode = 'attack'; s.wtype = w || 'energy'; s.atkP = Math.min(0.9, 1 - a.atkT / 0.4); } s.fly01 = a.fly ? 0.3 : 0; }
  else if (a.fly) { s.mode = 'fly'; s.fly01 = clamp(a.speedNow / 14, 0, 1); s.boost = 0; s.lean = 0; } else if (a.speedNow > 0.5) s.mode = 'run'; else s.mode = 'idle';
  if (a.state === 'idle' && a.kind === 'civilian') s.mode = a.speedNow > 0.5 ? 'run' : 'idle';
  rig.root.position.copy(a.pos); rig.root.rotation.y = a.yaw; const sc = a.scale * (1 + a.flash * 0.35); rig.root.scale.setScalar(sc);
  updateRig(rig, s, dt, clamp(a.speedNow / 12, 0, 1.2)); s.hit = a.stun > 0 ? Math.min(1, a.stun * 2.5) : 0;
  if (a.kind === 'hero' || a.boss) setAura(rig, a.boss ? 0.6 : 0.25, a.color); else if (a.team === 'ally' && a.kind === 'summon') setAura(rig, 0.5, a.color);
  if (cam) {
    const show = a.alive && (a.team !== 'civ') && (a.hp < a.maxHp || a.boss || a.kind === 'hero' || a.team === 'ally'); e.bar.visible = show; e.bar.position.set(a.pos.x, a.pos.y + 2.3 * a.scale + (a.fly ? 0.2 : 0), a.pos.z); e.bar.quaternion.copy(cam.quaternion);
    const f = clamp(a.hp / a.maxHp, 0.001, 1); e.fill.scale.x = f; e.fill.position.x = -(1 - f) / 2; (e.fill.material as THREE.MeshBasicMaterial).color.set(a.team === 'ally' ? '#34d399' : a.team === 'hero' ? '#ff4466' : '#ff8a3c');
    const dist = a.pos.distanceTo(cam.position); e.bar.scale.setScalar(Math.max(1, dist * 0.04));
  }
}
