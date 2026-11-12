import * as THREE from 'three';
import { BOSSES, COMMANDERS, ENEMY_TYPES, FACTION_RAIDERS, GENERALS, GEN_BY_ID, REGION_ENEMIES, TERR_BY_ID, UNITS, UNIT_KEYS, type BossDef, type UnitType } from './data';
import { audio } from './audio';
import type { FX } from './fx';
import { animateDragon, animateRig, buildDestroyer, buildDragon, buildHumanoid, buildKraken, glowM, GS, M, mk, GT, type Cfg } from './models';
import { P, R, popup, rand, shake, type Ent, type Proj, type Team } from './rt';
import { useGame, terrDef, allTerritories } from './store';
import { DUNGEON, groundAt, pointBlocked, regionAt, resolve, terrainHeight } from './terrain';
import { W, regDestr } from './wlib';
import { chestMeshes, destroyAt } from './world';
import { COMMANDER_VIS } from './vis';

const V3 = THREE.Vector3;
const PI = Math.PI;
export const E = { fx: null as unknown as FX, root: null as unknown as THREE.Group, scene: null as unknown as THREE.Scene };
export const S = { atk: 220, def: 80, hp: 2600, mana: 300, crit: 15, speed: 0, regen: 8 };
const gone = new Set<Ent>();
const _v = new V3(), _w = new V3();

// ---------- ally visuals ----------
interface AT { hp: number; dmg: number; speed: number; scale: number; ranged?: boolean; range?: number; flying?: boolean; kind: 'humanoid' | 'wyvern'; cfg: Cfg & Record<string, unknown>; proj?: string; name: string }
const ALLY: Record<UnitType, AT> = {
  infantry: { name: 'Demon Infantry', hp: 300, dmg: 34, speed: 9, scale: 1.0, kind: 'humanoid', cfg: { skin: '#a03038', armor: '#2a1418', trim: '#d4143c', cloth: '#4a0a14', glow: '#ffb030', horns: 'ram', hornColor: '#e8d8c0', weapon: 'sword', shield: true, helm: 'horned' } },
  knights: { name: 'Demon Knight', hp: 800, dmg: 70, speed: 8.5, scale: 1.2, kind: 'humanoid', cfg: { skin: '#6a2a3a', armor: '#12090e', trim: '#e0153f', cloth: '#2a0a14', glow: '#ff3a5a', horns: 'demon', hornColor: '#1a1014', weapon: 'greatsword', helm: 'crest', cape: true, capeColor: '#7a0a22' } },
  assassins: { name: 'Shadow Assassin', hp: 420, dmg: 60, speed: 14, scale: 1.0, kind: 'humanoid', cfg: { skin: '#2a1a3a', armor: '#0a0612', trim: '#8a4bff', cloth: '#1a0a2a', glow: '#d3b3ff', horns: 'long', hornColor: '#1a0a2a', weapon: 'dual', hood: true } },
  archers: { name: 'Hellfire Archer', hp: 260, dmg: 40, speed: 9, scale: 1.0, ranged: true, range: 30, kind: 'humanoid', proj: '#ff7a2a', cfg: { skin: '#a04030', armor: '#3a1a12', trim: '#ff8a2a', cloth: '#2a1008', glow: '#ffcc33', horns: 'demon', hornColor: '#2a1008', weapon: 'bow', hood: true } },
  mages: { name: 'Dark Magus', hp: 280, dmg: 80, speed: 8, scale: 1.05, ranged: true, range: 28, kind: 'humanoid', proj: '#c04bff', cfg: { skin: '#5a3a7a', armor: '#1a0a2a', trim: '#c04bff', cloth: '#2a0a4a', glow: '#e8b0ff', horns: 'crown', hornColor: '#c04bff', weapon: 'staff', hood: true } },
  heavy: { name: 'Heavy Monster', hp: 1800, dmg: 100, speed: 6, scale: 2.0, kind: 'humanoid', cfg: { skin: '#5a3a30', armor: '#2a1a18', trim: '#ff6a2a', cloth: '#1a0a08', glow: '#ff8a2a', horns: 'ram', hornColor: '#d8c8a8', weapon: 'club', bulk: 1.8 } },
  giants: { name: 'Giant Beast', hp: 5000, dmg: 220, speed: 6, scale: 3.4, kind: 'humanoid', cfg: { skin: '#6a4a30', armor: '#3a2a20', trim: '#ffb347', cloth: '#2a1a10', glow: '#ffd27a', horns: 'ram', hornColor: '#e8d8b8', weapon: 'club', bulk: 2.3 } },
  dragons: { name: 'War Dragon', hp: 2500, dmg: 160, speed: 22, scale: 1.4, flying: true, kind: 'wyvern', cfg: { color: '#7a1a1a', belly: '#e8b070', glow: '#ffcc33' }, name_: 0 } as unknown as AT,
  siege: { name: 'Siege Monster', hp: 3000, dmg: 200, speed: 5, scale: 2.7, kind: 'humanoid', cfg: { skin: '#3a3a40', armor: '#2a2a30', trim: '#ff5a1a', cloth: '#1a1a1e', glow: '#ff5a1a', horns: 'none', weapon: 'none', bulk: 2.4, hair: 'flame', hairColor: '#ff4a0a' } },
  undead: { name: 'Undead Warrior', hp: 260, dmg: 30, speed: 8.5, scale: 1.05, kind: 'humanoid', cfg: { skin: '#d8d0b8', armor: '#3a4a3a', trim: '#7dffa0', cloth: '#1a2a1a', glow: '#7dffa0', horns: 'none', weapon: 'sword', shield: true, helm: 'skull' } },
  elite: { name: 'Elite Champion', hp: 1600, dmg: 130, speed: 10, scale: 1.3, kind: 'humanoid', cfg: { skin: '#5a2a3a', armor: '#1a1018', trim: '#ffd24a', cloth: '#2a0a14', glow: '#ffd24a', horns: 'demon', hornColor: '#ffd24a', weapon: 'greatsword', wings: 'demon', wingColor: '#4a0a1a', cape: true, capeColor: '#2a0a14', helm: 'crest' } },
};
const TINTS = [0, 0.02, -0.02];
function tintCfg(c: Cfg & Record<string, unknown>, v: number): Cfg {
  if (!v) return c; const o = { ...c }; for (const k of ['skin', 'cloth', 'armor'] as const) if (o[k] && typeof o[k] === 'string') { const col = new THREE.Color(o[k] as string); col.offsetHSL(TINTS[v % 3] * 2, 0, TINTS[(v + 1) % 3] * 3); (o as Record<string, unknown>)[k] = '#' + col.getHexString(); } return o;
}

let _id = 0;
function mkEnt(o: Partial<Ent> & { type: string; name: string; group: THREE.Object3D; team: Team }): Ent {
  const e: Ent = {
    id: R.nextId++, team: o.team, type: o.type, name: o.name, fac: o.fac ?? 'ancient', kind: o.kind ?? 'unit', rig: o.rig ?? null, drig: o.drig ?? null, brig: o.brig ?? null, group: o.group, pos: o.pos ?? new V3(), vel: new V3(), yaw: o.yaw ?? rand(0, 6.28),
    hp: o.hp ?? 100, max: o.hp ?? 100, dmg: o.dmg ?? 10, speed: o.speed ?? 8, radius: o.radius ?? 0.7, height: o.height ?? 2, scale: o.scale ?? 1, state: 'idle', st: 0, atkCd: rand(0.5, 1.5), anim: 'idle', animT: rand(0, 10), ap: 0, ranged: !!o.ranged, flying: !!o.flying, range: o.range ?? 0,
    tgt: null, retarget: rand(0, 0.5), home: new V3(), wander: new V3(), aggro: o.aggro ?? 45, hitFlash: 0, stun: 0, friendly: !!o.friendly, life: o.life ?? -1, xpv: o.xpv ?? 1, weight: o.weight ?? 1, slot: 0, dr: o.dr ?? 1, abilityCd: rand(2, 5), expire: o.expire ?? -1, spawnT: 0, dying: 0, swing: 0,
    tid: o.tid, raid: o.raid, divId: o.divId, unitType: o.unitType, gid: o.gid, projColor: o.projColor,
  };
  e.home.copy(e.pos); e.wander.copy(e.pos); e.group.position.copy(e.pos); E.root.add(e.group); R.ents.push(e); _id++; return e;
}
export function removeEnt(e: Ent) { gone.add(e); }
const flush = () => { if (!gone.size) return; for (const e of gone) { E.root.remove(e.group); if (e.bar) e.bar.removeFromParent(); } R.ents = R.ents.filter((e) => !gone.has(e)); if (R.boss && gone.has(R.boss)) R.boss = null; gone.clear(); };
export function clearEnts() { for (const e of R.ents) { E.root.remove(e.group); } R.ents = []; R.projs.forEach((p) => p.mesh.removeFromParent()); R.projs = []; R.boss = null; R.dragonAlive = false; R.terrKills = {}; R.raidIds = {}; R.dungeonSpawned = false; R.bossReady = {}; gone.clear(); }

function visualFor(t: AT | typeof ENEMY_TYPES[string], variant = 0) {
  if (t.kind === 'wyvern') { const c = t.cfg as { color: string; belly: string; glow: string }; const d = buildDragon(c.color, c.belly, c.glow, ('scale' in t ? t.scale : 1) * 0.75, 0); return { drig: d, rig: null, group: d.root as THREE.Object3D, height: 3, radius: 2 }; }
  const sc = t.scale * rand(0.94, 1.08); const rig = buildHumanoid(tintCfg(t.cfg as Cfg & Record<string, unknown>, variant), 0, sc); return { rig, drig: null, group: rig.root as THREE.Object3D, height: 2.0 * sc, radius: Math.max(0.55, 0.5 * sc * ((t.cfg.bulk as number) ?? 1) * 0.8) };
}
export function groundY(x: number, y: number, z: number) { return groundAt(x, y, z); }

export function spawnEnemy(typeId: string, x: number, z: number, o: { raid?: boolean; tid?: string; friendly?: boolean; y?: number; aggro?: number } = {}) {
  const t = ENEMY_TYPES[typeId]; const v = visualFor(t, Math.floor(Math.random() * 3)); const gy = o.y ?? (t.flying ? terrainHeight(x, z) + 14 : terrainHeight(x, z));
  const e = mkEnt({ team: 'enemy', type: typeId, name: t.name, fac: t.fac, rig: v.rig, drig: v.drig, group: v.group, pos: new V3(x, gy, z), hp: t.hp * (typeId === 'wyvern' ? 1 : 1), dmg: t.dmg, speed: t.speed, radius: v.radius, height: v.height, scale: t.scale, ranged: t.ranged, range: t.ranged ? 24 : 0, flying: t.flying, aggro: o.aggro ?? 46, friendly: o.friendly, raid: o.raid, tid: o.tid, xpv: t.xp, projColor: t.proj });
  e.weight = 1; if (o.raid) e.aggro = 70; return e;
}
export function spawnAlly(unit: UnitType, x: number, z: number, o: { divId?: string; weight?: number; expire?: number; slot?: number; y?: number; kind?: Ent['kind'] } = {}) {
  const t = ALLY[unit]; const v = visualFor(t as unknown as AT, Math.floor(Math.random() * 3)); const w = o.weight ?? 1; const gy = o.y ?? (t.flying ? terrainHeight(x, z) + 14 : groundAt(x, P.pos.y, z));
  const e = mkEnt({ team: 'ally', type: unit, name: t.name, fac: 'demon', kind: o.kind ?? 'unit', rig: v.rig, drig: v.drig, group: v.group, pos: new V3(x, gy, z), hp: t.hp * (1 + w / 400), dmg: t.dmg * (1 + w / 160), speed: t.speed, radius: v.radius, height: v.height, scale: t.scale, ranged: t.ranged, range: t.range ?? 0, flying: t.flying, aggro: 40, divId: o.divId, unitType: unit, weight: w, expire: o.expire, projColor: t.proj });
  e.slot = o.slot ?? 0; return e;
}
export function spawnGeneral(gid: string, x: number, z: number, y?: number) {
  const g = GEN_BY_ID[gid]; const cfg = GEN_CFG[gid]; const rig = buildHumanoid(cfg, 1, cfg.scale);
  const e = mkEnt({ team: 'ally', type: 'general', name: g.name, fac: 'demon', kind: 'general', rig, group: rig.root, pos: new V3(x, y ?? terrainHeight(x, z), z), hp: 999999, dmg: g.power * 0.3, speed: 14, radius: 0.8 * cfg.scale, height: 2.1 * cfg.scale, scale: cfg.scale, aggro: 30, gid, range: 0 });
  e.divId = ''; return e;
}
const GEN_CFG: Record<string, Cfg & { scale: number }> = {
  infernos: { scale: 1.35, bulk: 1.25, skin: '#c84a1a', armor: '#2a0e08', trim: '#ff8a1a', cloth: '#6a1408', glow: '#ffd04a', horns: 'ram', hornColor: '#ffcc66', weapon: 'greatsword', hair: 'flame', hairColor: '#ff7a1a', cape: true, capeColor: '#8a1a08', tail: false, helm: 'none' },
  glacius: { scale: 1.25, skin: '#9ad4f0', armor: '#4a6a8a', trim: '#e8fbff', cloth: '#1c3a58', glow: '#d8f6ff', horns: 'crown', hornColor: '#e8fbff', weapon: 'spear', hair: 'long', hairColor: '#e8f4ff', cape: true, capeColor: '#3a6a9a', crystals: true },
  umbra: { scale: 1.2, skin: '#2a1a3a', armor: '#0a0612', trim: '#8a4bff', cloth: '#150a24', glow: '#d3b3ff', horns: 'long', hornColor: '#1a0a2a', weapon: 'dual', hood: true, cape: true, capeColor: '#0e0818' },
  behemoth: { scale: 1.9, bulk: 2.0, skin: '#7a5a3a', armor: '#4a3220', trim: '#ffd27a', cloth: '#3a2a18', glow: '#ffd27a', horns: 'ram', hornColor: '#e8d8b0', weapon: 'club', helm: 'none', hair: 'long', hairColor: '#4a3220' },
  nyxara: { scale: 1.2, skin: '#c07ab0', armor: '#2a0a2a', trim: '#ff4fd0', cloth: '#4a0a4a', glow: '#ffc3ee', horns: 'long', hornColor: '#ff4fd0', weapon: 'staff', hair: 'long', hairColor: '#ff4fd0', cape: true, capeColor: '#5a0a5a', wings: 'demon', wingColor: '#3a0a4a' },
  drakmor: { scale: 1.35, bulk: 1.2, skin: '#b88a4a', armor: '#6a4a18', trim: '#ffe070', cloth: '#7a1a10', glow: '#fff0a8', horns: 'demon', hornColor: '#ffe070', weapon: 'spear', helm: 'horned', wings: 'demon', wingColor: '#8a5a10', cape: true, capeColor: '#8a2a10', tail: true },
  mortis: { scale: 1.25, skin: '#d8d0b8', armor: '#1a2a20', trim: '#7dffa0', cloth: '#0a1a10', glow: '#7dffa0', horns: 'none', weapon: 'staff', helm: 'skull', hood: false, cape: true, capeColor: '#0a2a18' },
};
export function spawnCommander(cid: string) {
  const c = COMMANDERS.find((x) => x.id === cid)!; const cfg = COMMANDER_VIS[cid]; const rig = buildHumanoid(cfg, 1, cfg.scale ?? 1.3); const [x, z] = c.pos; const y = terrainHeight(x, z) + 0.2;
  const e = mkEnt({ team: 'ally', type: 'commander', name: c.name, fac: 'demon', kind: 'commander', rig, group: rig.root, pos: new V3(x, y, z), hp: 999999, dmg: 0, speed: 0, radius: 1.2, height: 3, scale: cfg.scale ?? 1.3, gid: cid, aggro: 0 }); e.anim = 'council'; return e;
}
export function spawnCitizen(x: number, z: number, kind: string) {
  const pal = [['#7a3a4a', '#2a1a2a', '#d4143c'], ['#4a5a7a', '#1a2a3a', '#5ab0ff'], ['#6a4a2a', '#2a1a10', '#ffb347'], ['#3a6a4a', '#10281a', '#7affa0'], ['#8a5a8a', '#2a102a', '#ff7ac0']][Math.floor(Math.random() * 5)];
  const cfg: Cfg = kind === 'guard' ? { skin: pal[0], armor: '#1a1218', trim: '#d4143c', cloth: '#4a0a14', glow: '#ffb030', horns: 'ram', hornColor: '#e8d8c0', weapon: 'spear', helm: 'horned' } : kind === 'recruit' ? { skin: pal[0], armor: '#3a2a28', trim: '#c8a040', cloth: '#5a1a1a', glow: '#ffb030', horns: 'demon', hornColor: '#2a1a1a', weapon: 'sword' } : { skin: pal[0], armor: pal[1], trim: pal[2], cloth: pal[1], glow: pal[2], horns: Math.random() > 0.5 ? 'demon' : 'crown', hornColor: '#e8d8c0', weapon: 'none', tail: Math.random() > 0.6 };
  const rig = buildHumanoid(cfg, 0, rand(0.9, 1.05)); const e = mkEnt({ team: 'ally', type: 'citizen', name: kind === 'merchant' ? 'Demon Merchant' : kind === 'guard' ? 'Palace Guard' : kind === 'recruit' ? 'Demon Recruit' : 'Demon Citizen', fac: 'demon', kind: 'citizen', rig, group: rig.root, pos: new V3(x, terrainHeight(x, z), z), hp: 999999, dmg: 0, speed: 3, radius: 0.5, height: 1.9, scale: 1, aggro: 0, gid: kind }); e.anim = 'council'; e.xpv = 0; return e;
}
export function spawnDummy(g: THREE.Group, x: number, z: number) { return mkEnt({ team: 'enemy', type: 'dummy', name: 'Training Dummy', kind: 'dummy', group: g, pos: new V3(x, 0, z), hp: 1e9, dmg: 0, radius: 0.9, height: 3, aggro: 0, friendly: true }); }

// ---------- boss ----------
const BOSS_CFG: Record<string, { patterns: string[]; hover: number; scale: number; height: number; radius: number; dmg: number; speed: number; stationary?: boolean; minions: string[]; roar: string }> = {
  dragon_king: { patterns: ['volley', 'slam', 'charge', 'meteor', 'summon'], hover: 11, scale: 3.6, height: 9, radius: 6, dmg: 90, speed: 20, minions: ['wyvern'], roar: 'roar' },
  celestial_emperor: { patterns: ['volley', 'meteor', 'slam', 'charge', 'summon'], hover: 3, scale: 3.4, height: 8, radius: 3.4, dmg: 100, speed: 16, minions: ['angel', 'holy_mage'], roar: 'magic' },
  frost_titan: { patterns: ['slam', 'meteor', 'volley', 'charge', 'summon'], hover: 0, scale: 7, height: 16, radius: 6, dmg: 130, speed: 9, minions: ['frost_warrior', 'ice_golem'], roar: 'slam' },
  rival_lord: { patterns: ['charge', 'volley', 'slam', 'meteor', 'summon'], hover: 0, scale: 2.4, height: 5, radius: 2.2, dmg: 85, speed: 20, minions: ['imp', 'rival_soldier'], roar: 'roar' },
  sea_beast: { patterns: ['slam', 'volley', 'meteor', 'summon'], hover: 0, scale: 2.6, height: 14, radius: 9, dmg: 100, speed: 0, stationary: true, minions: ['merfolk', 'angler'], roar: 'roar' },
  ancient_god: { patterns: ['meteor', 'slam', 'volley', 'charge', 'summon'], hover: 0, scale: 5.5, height: 12, radius: 5, dmg: 125, speed: 10, minions: ['guardian', 'skeleton'], roar: 'slam' },
  dimensional_destroyer: { patterns: ['volley', 'meteor', 'summon', 'slam'], hover: 4, scale: 1.9, height: 10, radius: 6, dmg: 95, speed: 0, stationary: true, minions: ['wraith', 'shadow_stalker'], roar: 'bossintro' },
};
const BOSS_HUM: Record<string, Cfg> = {
  celestial_emperor: { skin: '#fff0e0', armor: '#fffbe8', trim: '#ffcc33', cloth: '#ffffff', glow: '#fff3a0', horns: 'crown', hornColor: '#ffe680', wings: 'angel', wingColor: '#fff4c0', halo: true, helm: 'crest', weapon: 'greatsword', cape: true, capeColor: '#fff4c0', royal: false, bulk: 1.2 },
  frost_titan: { skin: '#a8dcff', armor: '#5a8ab0', trim: '#e8fbff', cloth: '#2a4a68', glow: '#aef0ff', horns: 'long', hornColor: '#e8fbff', weapon: 'none', bulk: 2.2, crystals: true },
  rival_lord: { skin: '#7a4a9a', armor: '#1a0a2a', trim: '#b04cff', cloth: '#2a0a3a', glow: '#7aff7a', horns: 'ram', hornColor: '#d8c8e8', wings: 'demon', wingColor: '#3a1a5a', cape: true, capeColor: '#3a0a5a', weapon: 'sword', royal: true, bulk: 1.15 },
  ancient_god: { skin: '#c8a878', armor: '#6a5a3a', trim: '#ffcc66', cloth: '#3a2a10', glow: '#ffcc66', horns: 'crown', hornColor: '#ffcc66', weapon: 'greatsword', bulk: 1.5, halo: true, cape: true, capeColor: '#4a3a18' },
};
export function spawnBoss(def: BossDef) {
  const bc = BOSS_CFG[def.id]; const [x, z] = def.pos; const gy = terrainHeight(x, z); let group: THREE.Object3D, rig = null, drig = null, brig = null; let extra: ((t: number) => void) | null = null;
  if (def.id === 'dragon_king') { drig = buildDragon('#7a5a1a', '#e8c24a', '#ffdd66', bc.scale, 1); group = drig.root; }
  else if (def.id === 'sea_beast') { brig = buildKraken(bc.scale); group = brig.root; }
  else if (def.id === 'dimensional_destroyer') { brig = buildDestroyer(bc.scale); group = brig.root; }
  else { rig = buildHumanoid(BOSS_HUM[def.id], 1, bc.scale); group = rig.root; if (def.id === 'celestial_emperor' || def.id === 'ancient_god') { const g = new THREE.Group(); for (let i = 0; i < 3; i++) { const r = mk(g, GT(2.5 + i * 0.7, 0.07, 6, 40), glowM(def.color, 2.4), 0, 0, 0); r.userData.i = i; } g.position.y = 1.8; group.add(g); extra = (t) => g.children.forEach((c, i) => { c.rotation.set(t * (0.4 + i * 0.2) + i, t * 0.3, 0); }); } }
  const hp = def.hp; const e = mkEnt({ team: 'enemy', type: def.id, name: def.name, fac: 'ancient', kind: 'boss', rig, drig, brig, group, pos: new V3(x, gy + bc.hover, z), hp, dmg: bc.dmg, speed: bc.speed, radius: bc.radius, height: bc.height, scale: bc.scale, flying: bc.hover > 0, aggro: 200, dr: 0.6, xpv: 50 });
  e.boss = { id: def.id, phase: 1, patternCd: 3, pattern: '', patT: 0, patterns: bc.patterns, hover: bc.hover, intro: 3.2, aim: new V3(), marks: [], dying: 0, color: def.color, chargeDir: new V3() }; e.home.set(x, gy, z);
  if (extra) { const fn = extra; W.anim.push((t) => { if (!gone.has(e)) fn(t); }); }
  R.boss = e; audio.sfx('bossintro'); audio.music('boss'); R.cine = { kind: 'boss', t: 0, dur: 3.2 }; useGame.getState().setBanner(`${def.name} — ${def.title}`); setTimeout(() => useGame.getState().setBanner(null), 3600); shake(0.6);
  return e;
}

// ---------- projectiles ----------
const projGeo = GS(1, 8, 6);
export function spawnProj(o: { x: number; y: number; z: number; dir: THREE.Vector3; speed: number; dmg: number; team: Team; color: string; kind?: string; radius?: number; aoe?: number; life?: number; tgt?: Ent | null; turn?: number; owner?: Ent | null }) {
  const r = o.radius ?? 0.5; const g = new THREE.Group(); mk(g, projGeo, glowM(o.color, 3)).scale.setScalar(r); mk(g, projGeo, M(o.color, { add: true, tr: 0.35, em: o.color, ei: 1 })).scale.setScalar(r * 1.8);
  if (o.kind === 'arrow') { g.children[0].scale.set(0.12, 0.12, 1.2); g.children[1].visible = false; }
  g.position.set(o.x, o.y, o.z); E.root.add(g); const d = o.dir.clone().normalize();
  const p: Proj = { mesh: g, pos: new V3(o.x, o.y, o.z), vel: d.multiplyScalar(o.speed), team: o.team, dmg: o.dmg, radius: r, life: o.life ?? 4, tgt: o.tgt ?? null, turn: o.turn ?? 0, kind: o.kind ?? 'bolt', color: o.color, aoe: o.aoe ?? 0, alive: true, owner: o.owner };
  if (o.kind === 'arrow') g.lookAt(g.position.clone().add(p.vel)); R.projs.push(p); return p;
}
export function dmgRadius(x: number, y: number, z: number, r: number, dmg: number, victims: Team, o: { kb?: number; big?: boolean; stun?: number; fromPlayer?: boolean } = {}) {
  let n = 0;
  for (const e of R.ents) { if (e.team !== victims || e.state === 'dead' || e.kind === 'citizen' || e.kind === 'commander') continue; if (e.friendly && e.kind !== 'dummy' && !o.fromPlayer) continue; const dx = e.pos.x - x, dz = e.pos.z - z, dy = e.pos.y + e.height * 0.5 - y; const d = Math.hypot(dx, dz, dy * 0.6); if (d > r + e.radius) continue; const f = 1 - Math.min(1, d / (r + e.radius)) * 0.5; _v.set(dx, 0, dz).normalize(); hurtEnt(e, dmg * f, _v.multiplyScalar(o.kb ?? 6), { big: o.big, stun: o.stun, fromPlayer: o.fromPlayer }); n++; }
  return n;
}
export function explode(x: number, y: number, z: number, r: number, dmg: number, team: Team, color: string, fromPlayer = false) {
  const fx = E.fx; fx.blob(x, y, z, color, r * 0.9, 0.5, 0.5); fx.ring(x, y + 0.2, z, color, r * 1.3, 0.6, 0.5); fx.burst(x, y, z, color, 40, r * 3, 0.9, 0.8, 4, 4); fx.burst(x, y, z, '#ffffff', 10, r * 2, 0.5, 0.4, 0, 2); audio.sfx('explode'); shake(Math.min(0.5, r * 0.04));
  if (team === 'ally') { dmgRadius(x, y, z, r, dmg, 'enemy', { kb: 12, big: true, fromPlayer }); destroyAt(x, y, z, r * 0.8, (d) => { fx.burst(d.x, d.y, d.z, d.color, 14, 9, 0.7, 0.9, 12, 5); }); }
  else {
    if (P.invuln <= 0 && !P.dead) { const d = Math.hypot(P.pos.x - x, P.pos.y + 1 - y, P.pos.z - z); if (d < r + 1) hurtPlayer(dmg * (1 - d / (r + 1.5) * 0.5), _v.set(x, y, z)); }
    dmgRadius(x, y, z, r, dmg * 0.6, 'ally');
  }
}
export function updateProjs(dt: number) {
  for (const p of R.projs) {
    if (!p.alive) continue; p.life -= dt;
    if (p.tgt && p.turn > 0) { if (p.tgt.state === 'dead') p.tgt = null; else { const sp = p.vel.length(); _v.set(p.tgt.pos.x, p.tgt.pos.y + p.tgt.height * 0.5, p.tgt.pos.z).sub(p.pos).normalize(); p.vel.normalize().lerp(_v, Math.min(1, p.turn * dt)).normalize().multiplyScalar(sp); } }
    p.pos.addScaledVector(p.vel, dt); p.mesh.position.copy(p.pos); if (p.kind === 'arrow') p.mesh.lookAt(_w.copy(p.pos).add(p.vel));
    E.fx.trail(p.pos.x, p.pos.y, p.pos.z, p.color, p.radius * 1.4, 0.35); if (p.kind === 'fireball') E.fx.burst(p.pos.x, p.pos.y, p.pos.z, '#ffcc44', 1, 2, p.radius * 1.2, 0.3);
    let hit = p.life <= 0; const gy = terrainHeight(p.pos.x, p.pos.z);
    if (!hit && (p.pos.y < groundAt(p.pos.x, p.pos.y, p.pos.z) + 0.2 || pointBlocked(p.pos.x, p.pos.y, p.pos.z, 0.1))) hit = true;
    void gy;
    if (!hit) {
      if (p.team === 'ally') { for (const e of R.ents) { if (e.team !== 'enemy' || e.state === 'dead' || e.kind === 'citizen' || (e.friendly && e.kind !== 'dummy')) continue; const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z, dy = e.pos.y + e.height * 0.5 - p.pos.y; if (dx * dx + dz * dz + dy * dy * 0.5 < (e.radius + p.radius) * (e.radius + p.radius) + (e.kind === 'boss' ? 4 : 0)) { hit = true; if (!p.aoe) { _v.copy(p.vel).setY(0).normalize().multiplyScalar(5); hurtEnt(e, p.dmg, _v, { fromPlayer: !p.owner || p.owner.kind === 'general' ? true : false }); } break; } } }
      else { if (!P.dead && P.invuln <= 0) { const dx = P.pos.x - p.pos.x, dz = P.pos.z - p.pos.z, dy = P.pos.y + 1 - p.pos.y; if (dx * dx + dz * dz + dy * dy < (1.1 + p.radius) * (1.1 + p.radius)) { hit = true; if (!p.aoe) hurtPlayer(p.dmg, p.pos); } } if (!hit) for (const e of R.ents) { if (e.team !== 'ally' || e.state === 'dead' || e.kind === 'citizen' || e.kind === 'commander') continue; const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z, dy = e.pos.y + e.height * 0.5 - p.pos.y; if (dx * dx + dz * dz + dy * dy < (e.radius + p.radius) ** 2) { hit = true; if (!p.aoe) hurtEnt(e, p.dmg, null, {}); break; } } }
    }
    if (hit) { p.alive = false; E.root.remove(p.mesh); if (p.aoe > 0) explode(p.pos.x, p.pos.y, p.pos.z, p.aoe, p.dmg, p.team, p.color, p.team === 'ally' && !p.owner); else E.fx.burst(p.pos.x, p.pos.y, p.pos.z, p.color, 10, 6, 0.5, 0.4); }
  }
  R.projs = R.projs.filter((p) => p.alive);
}

// ---------- damage ----------
export function hurtPlayer(dmg: number, from: THREE.Vector3 | null) {
  if (P.invuln > 0 || P.dead > 0 || P.seated) return;
  const red = S.def / (S.def + 400); let d = dmg * (1 - red) * (P.form ? 0.75 : 1); P.hp -= d; R.hurt = Math.min(1, R.hurt + d / 300); audio.sfx('hurt'); popup(P.pos.x, P.pos.y + 2.4, P.pos.z, String(Math.round(d)), '#ff6a6a');
  if (from && P.action === 'none' && d > 80) { P.stunned = 0.15; _v.set(P.pos.x - from.x, 0, P.pos.z - from.z).normalize(); P.vel.x += _v.x * 6; P.vel.z += _v.z * 6; }
  if (P.hp <= 0) { P.hp = 0; P.dead = 4; P.flying = false; P.action = 'none'; audio.sfx('roar'); }
}
export function hurtEnt(e: Ent, dmg: number, kb: THREE.Vector3 | null, o: { big?: boolean; stun?: number; fromPlayer?: boolean; crit?: boolean } = {}) {
  if (e.state === 'dead') return;
  if (e.kind === 'dummy') { e.hitFlash = 0.5; popup(e.pos.x, e.pos.y + 3.2, e.pos.z, String(Math.round(dmg)), '#ffd24a'); audio.sfx('hit'); E.fx.burst(e.pos.x, e.pos.y + 1.6, e.pos.z, '#ffd24a', 8, 5, 0.4, 0.4, 6); return; }
  if (e.kind === 'boss' && e.boss && e.boss.intro > 0) return;
  if (e.friendly && o.fromPlayer) { e.friendly = false; e.team = 'enemy'; }
  if (e.kind === 'general' || e.kind === 'commander' || e.kind === 'citizen') return;
  let crit = o.crit; if (o.fromPlayer && !crit && Math.random() * 100 < S.crit) crit = true; const d = dmg * e.dr * (crit ? 1.8 : 1);
  e.hp -= d; e.hitFlash = 0.14; if (o.fromPlayer) popup(e.pos.x, e.pos.y + e.height + 0.4, e.pos.z, Math.round(d) + (crit ? '!' : ''), crit ? '#ffd24a' : o.big ? '#ff9a4a' : '#ffffff', !!crit || !!o.big);
  E.fx.burst(e.pos.x, e.pos.y + e.height * 0.55, e.pos.z, o.big ? '#ff8a4a' : '#ffe0a0', o.big ? 14 : 7, o.big ? 9 : 5, 0.45, 0.35);
  ensureBar(e); if (kb && e.kind !== 'boss') { const m = e.scale > 2 ? 0.3 : 1; e.vel.x += kb.x * m; e.vel.z += kb.z * m; if (e.flying) e.vel.y += 2; }
  if (e.kind !== 'boss' && e.scale < 2.5 && (o.stun || o.big || d > e.max * 0.3) && e.state !== 'special') { e.stun = o.stun ?? (o.big ? 0.55 : 0.3); e.state = 'stagger'; }
  e.tgt = o.fromPlayer ? 'player' : e.tgt;
  if (e.hp <= 0) killEnt(e);
}
function ensureBar(e: Ent) {
  if (e.bar || e.kind === 'boss') return; const g = new THREE.Group(); const bg = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.18), new THREE.MeshBasicMaterial({ color: '#100', depthTest: false, transparent: true, opacity: 0.8 })); const fl = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.18), new THREE.MeshBasicMaterial({ color: e.team === 'ally' ? '#4aff8a' : '#ff3a3a', depthTest: false })); fl.position.z = 0.001; g.add(bg, fl); bg.renderOrder = 998; fl.renderOrder = 999; e.bar = g; e.barFill = fl; E.root.add(g);
}
function killEnt(e: Ent) {
  e.hp = 0; e.state = 'dead'; e.st = 0; e.anim = 'die'; e.stun = 0; if (e.bar) e.bar.visible = false;
  E.fx.burst(e.pos.x, e.pos.y + e.height * 0.5, e.pos.z, e.team === 'enemy' ? '#ff5a3a' : '#7affb0', 14, 7, 0.6, 0.6, 3);
  if (e.kind === 'boss') { bossDeath(e); return; }
  const gs = useGame.getState();
  if (e.team === 'enemy' && e.kind !== 'dummy') {
    R.killsTotal++; const reg = regionAt(e.pos.x, e.pos.z); const gold = Math.round(e.xpv * 12 * (1 + Math.random())); const cr = Math.random() < 0.15 * e.xpv ? 1 + Math.floor(Math.random() * 2) : 0;
    gs.gain({ gold, crystals: cr, mana: 2 }); P.mana = Math.min(S.mana, P.mana + 4 + e.xpv); popup(e.pos.x, e.pos.y + e.height + 1.2, e.pos.z, `+${gold}g${cr ? ' +' + cr + '◆' : ''}`, '#ffd24a');
    gs.report('kill', reg); useGame.setState({ kills: gs.kills + 1 });
    if (e.raid && e.tid) gs.report('defend', e.tid); if (e.tid && !e.raid) R.terrKills[e.tid] = (R.terrKills[e.tid] ?? 0) + 1;
    if (Math.random() < 0.012 * e.xpv) { const items = ['ring_swift', 'ring_blood', 'art_eye', 'frostbrand', 'ring_mana']; const it = items[Math.floor(Math.random() * items.length)]; if (!gs.inventory.includes(it)) gs.addItem(it); }
  } else if (e.team === 'ally' && e.divId && e.unitType) {
    const loss = Math.max(1, Math.ceil(e.weight * 0.08)); const ut = e.unitType as UnitType;
    useGame.setState((s) => ({ units: { ...s.units, [ut]: Math.max(0, s.units[ut] - loss) }, divisions: s.divisions.map((d) => (d.id === e.divId ? { ...d, comp: { ...d.comp, [ut]: Math.max(0, (d.comp[ut] ?? 0) - loss) } } : d)) }));
  }
}
function bossDeath(e: Ent) {
  e.boss!.dying = 3.2; audio.sfx('roar'); shake(1); R.cine = { kind: 'bossdeath', t: 0, dur: 3.2 }; R.timeScale = 0.4;
  const def = BOSSES.find((b) => b.id === e.boss!.id)!; const gs = useGame.getState(); setTimeout(() => { R.timeScale = 1; }, 1800);
  setTimeout(() => {
    gs.gain({ gold: def.reward.gold, crystals: def.reward.crystals }); if (def.reward.item) gs.addItem(def.reward.item); gs.bossDefeated(def.id); gs.report('boss', def.id); audio.sfx('victory'); gs.toast(`${def.name} DEFEATED! +${def.reward.gold} gold +${def.reward.crystals} crystals`, 'epic'); gs.addLog(`Defeated ${def.name}, ${def.title}.`);
    useGame.getState().setBanner(`${def.name} FALLS`); setTimeout(() => useGame.getState().setBanner(null), 3800); audio.music('calm'); P.action = 'victory'; P.actionT = 0; P.actionDur = 2.6; P.actionAnim = 'victory'; if (def.region === 'dragon') E.fx.burst(e.pos.x, e.pos.y, e.pos.z, '#ffd24a', 100, 30, 1.2, 1.5, 8);
  }, 3000);
}

// ---------- AI helpers ----------
function faceTo(e: Ent, x: number, z: number, dt: number, rate = 12) { const want = Math.atan2(x - e.pos.x, z - e.pos.z); let d = want - e.yaw; while (d > PI) d -= PI * 2; while (d < -PI) d += PI * 2; e.yaw += d * Math.min(1, dt * rate); }
function moveTo(e: Ent, tx: number, tz: number, spd: number, dt: number) {
  const dx = tx - e.pos.x, dz = tz - e.pos.z; const d = Math.hypot(dx, dz) || 1; const s = Math.min(spd, d / dt); e.pos.x += (dx / d) * s * dt; e.pos.z += (dz / d) * s * dt; faceTo(e, tx, tz, dt, 10); return s;
}
function settle(e: Ent, dt: number) {
  e.pos.x += e.vel.x * dt; e.pos.z += e.vel.z * dt; const k = Math.max(0, 1 - 7 * dt); e.vel.x *= k; e.vel.z *= k; if (!e.flying) { e.vel.y = 0; resolve(e.pos, e.radius, e.height); const gy = groundAt(e.pos.x, e.pos.y, e.pos.z); e.pos.y += (gy - e.pos.y) * Math.min(1, dt * 14); if (Math.abs(gy - e.pos.y) > 3) e.pos.y = gy; }
}
function hostileList(e: Ent) { return R.ents.filter((o) => o.team !== e.team && o.state !== 'dead' && !o.friendly && o.kind !== 'citizen' && o.kind !== 'commander' && o.kind !== 'dummy' && !(o.kind === 'boss' && o.boss!.intro > 0)); }
function pickTarget(e: Ent) {
  let best: Ent | 'player' | null = null; let bd = e.aggro * e.aggro; const lead = e.divId === 'follow' || (e.team === 'ally' && e.kind !== 'general');
  if (e.team === 'enemy') { if (!P.dead && !e.friendly) { const dx = P.pos.x - e.pos.x, dz = P.pos.z - e.pos.z; const d = dx * dx + dz * dz; if (d < bd) { bd = d; best = 'player'; } } }
  for (const o of R.ents) { if (o.team === e.team || o.state === 'dead' || o.friendly || o.kind === 'citizen' || o.kind === 'commander' || o.kind === 'dummy') continue; if (e.team === 'enemy' && o.kind === 'general' && e.friendly) continue; const dx = o.pos.x - e.pos.x, dz = o.pos.z - e.pos.z; let d = dx * dx + dz * dz; if (e.team === 'enemy') d *= 1.3; if (lead && e.team === 'ally') { const ax = o.pos.x - (e.home.x), az = o.pos.z - e.home.z; void ax; void az; } if (d < bd) { bd = d; best = o; } }
  e.tgt = best;
}
const divCache: Record<string, { order: string; formation: string; anchor: THREE.Vector3; n: number }> = {};
export function refreshDivCache() { const s = useGame.getState(); if (!divCache.summon) divCache.summon = { order: 'attack', formation: 'offensive', anchor: P.pos.clone(), n: 12 }; for (const d of s.divisions) { const c = divCache[d.id]; if (!c) divCache[d.id] = { order: d.order, formation: d.formation, anchor: P.pos.clone(), n: 1 }; else { if (c.order !== d.order) c.anchor.copy(P.pos); c.order = d.order; c.formation = d.formation; } } }
function slotPos(e: Ent, out: THREE.Vector3) {
  const c = e.divId ? divCache[e.divId] : undefined; const f = c?.formation ?? 'balanced'; const n = Math.max(1, c?.n ?? 8); const i = e.slot; const sy = Math.sin(P.yaw), cy = Math.cos(P.yaw); let fx = 0, sx = 0;
  if (f === 'offensive') { const row = Math.floor((Math.sqrt(8 * i + 1) - 1) / 2); const col = i - (row * (row + 1)) / 2; fx = 5 + row * 2.4; sx = (col - row / 2) * 3; }
  else if (f === 'defensive') { const a = (i / n) * PI * 2; fx = Math.cos(a) * (6 + (i % 2) * 2.5); sx = Math.sin(a) * (6 + (i % 2) * 2.5); }
  else if (f === 'skirmish') { const a = i * 2.4; const r = 12 + (i % 4) * 3; fx = Math.cos(a) * r; sx = Math.sin(a) * r; }
  else { fx = -4.5 - Math.floor(i / 8) * 2.6; sx = ((i % 8) - 3.5) * 2.6; }
  out.set(P.pos.x + sy * fx + cy * sx * -1 * -1, 0, P.pos.z + cy * fx - sy * sx); out.x = P.pos.x + sy * fx - cy * sx; out.z = P.pos.z + cy * fx + sy * sx; return out;
}
const SLOT = new V3();

function attackAnimFor(e: Ent) { const w = e.rig?.wtype; return e.ranged ? (w === 'bow' ? 'bow' : 'cast') : w === 'spear' ? 'thrust' : Math.random() > 0.5 ? 'atk1' : 'atk2'; }
function strike(e: Ent, t: Ent | 'player') {
  const tx = t === 'player' ? P.pos.x : t.pos.x, tz = t === 'player' ? P.pos.z : t.pos.z; const d = Math.hypot(tx - e.pos.x, tz - e.pos.z);
  if (e.ranged) { const ty = t === 'player' ? P.pos.y + 1.2 : t.pos.y + t.height * 0.5; _v.set(tx - e.pos.x, ty - (e.pos.y + e.height * 0.7), tz - e.pos.z).normalize(); spawnProj({ x: e.pos.x, y: e.pos.y + e.height * 0.7, z: e.pos.z, dir: _v, speed: 32, dmg: e.dmg, team: e.team, color: e.projColor ?? '#ffcc66', kind: e.rig?.wtype === 'bow' ? 'arrow' : 'bolt', radius: e.rig?.wtype === 'bow' ? 0.25 : 0.45, owner: e }); audio.sfx(e.rig?.wtype === 'bow' ? 'arrow' : 'magic'); return; }
  const reach = (e.radius + 1.8 * Math.max(1, e.scale * 0.6) + (t === 'player' ? 0.6 : (t as Ent).radius)) * 1.15;
  if (d <= reach + 0.6) { if (t === 'player') hurtPlayer(e.dmg, e.pos); else { _v.set(tx - e.pos.x, 0, tz - e.pos.z).normalize().multiplyScalar(5); hurtEnt(t, e.dmg, _v, { big: e.scale > 2 }); } audio.sfx('hit'); }
}
function stepUnit(e: Ent, dt: number, near: boolean) {
  e.animT += dt; e.atkCd -= dt; e.abilityCd -= dt; e.spawnT += dt; if (e.hitFlash > 0) e.hitFlash -= dt;
  if (e.expire > 0) { e.expire -= dt; if (e.expire <= 0) { E.fx.burst(e.pos.x, e.pos.y + 1, e.pos.z, '#ff4a6a', 20, 6, 0.6, 0.6); removeEnt(e); return; } }
  if (e.state === 'dead') { e.st += dt; e.ap = Math.min(1, e.st / 0.9); e.anim = 'die'; settle(e, dt); if (e.st > 3) removeEnt(e); return; }
  if (e.stun > 0) { e.stun -= dt; e.anim = 'hit'; settle(e, dt); if (e.stun <= 0) e.state = 'idle'; return; }
  const follow = e.divId === 'follow' || (e.team === 'ally' && e.kind === 'unit' && e.divId !== undefined && e.divId !== ''); const spec = e.state === 'special';
  e.retarget -= dt; if (e.retarget <= 0) { e.retarget = 0.35 + Math.random() * 0.3; pickTarget(e); }
  let t = e.tgt; if (t && t !== 'player' && t.state === 'dead') { t = e.tgt = null; } if (t === 'player' && P.dead > 0) t = e.tgt = null;
  if (e.state === 'windup') { e.st += dt; e.ap = e.st / 0.6; if (e.st >= 0.38 && e.swing === 0) { e.swing = 1; if (t) strike(e, t); } if (e.st >= 0.6) { e.state = 'recover'; e.st = 0; e.swing = 0; e.atkCd = e.ranged ? rand(1.6, 2.6) : rand(0.9, 1.7); } settle(e, dt); return; }
  if (e.state === 'recover') { e.st += dt; e.anim = 'council'; if (e.st > 0.25) e.state = 'idle'; settle(e, dt); return; }
  if (spec) { return; }
  let mv = 0;
  if (e.flying) { mv = stepFlyer(e, t, dt); }
  else if (t) {
    const tx = t === 'player' ? P.pos.x : t.pos.x, tz = t === 'player' ? P.pos.z : t.pos.z; const tr = t === 'player' ? 0.5 : t.radius; const d = Math.hypot(tx - e.pos.x, tz - e.pos.z) - tr; const reach = e.ranged ? e.range : e.radius + 1.8 * Math.max(1, e.scale * 0.6) + 0.5;
    if (e.ranged && d < e.range * 0.4) { mv = -moveTo(e, e.pos.x - (tx - e.pos.x), e.pos.z - (tz - e.pos.z), e.speed * 0.8, dt); faceTo(e, tx, tz, dt); }
    else if (d > reach) { const off = e.team === 'enemy' ? (e.id % 5 - 2) * 0.25 : 0; mv = moveTo(e, tx + Math.sin(e.id) * off * 3, tz + Math.cos(e.id) * off * 3, e.speed * (e.team === 'ally' ? 1.25 : 1), dt); }
    else { faceTo(e, tx, tz, dt, 14); if (e.atkCd <= 0) { e.state = 'windup'; e.st = 0; e.swing = 0; e.anim = attackAnimFor(e) as Ent['anim']; if (e.kind === 'general' && e.abilityCd <= 0 && e.gid) { generalAbility(e, t); e.abilityCd = 6 + Math.random() * 3; e.state = 'recover'; e.st = 0; } return; } }
    if (e.kind === 'general' && e.gid && e.abilityCd <= 0 && d < 36) { generalAbility(e, t); e.abilityCd = 6 + Math.random() * 3; }
  } else {
    if (e.raid) { const dd = Math.hypot(e.home.x - e.pos.x, e.home.z - e.pos.z); if (dd > 8) mv = moveTo(e, e.home.x, e.home.z, e.speed, dt); }
    else if (follow && e.team === 'ally') {
      const cfg = e.divId ? divCache[e.divId] : undefined; const order = cfg?.order ?? 'follow'; let tx: number, tz: number;
      if (order === 'defend' && cfg) { tx = cfg.anchor.x + Math.cos(e.slot * 1.3) * (3 + (e.slot % 5) * 2); tz = cfg.anchor.z + Math.sin(e.slot * 1.3) * (3 + (e.slot % 5) * 2); }
      else if (order === 'patrol' && cfg) { const a = e.animT * 0.15 + e.slot * 0.5; tx = cfg.anchor.x + Math.cos(a) * 24; tz = cfg.anchor.z + Math.sin(a) * 24; }
      else { slotPos(e, SLOT); tx = SLOT.x; tz = SLOT.z; }
      const d = Math.hypot(tx - e.pos.x, tz - e.pos.z); if (order !== 'defend' && order !== 'patrol' && d > 70) { e.pos.set(tx + rand(-3, 3), terrainHeight(tx, tz), tz + rand(-3, 3)); E.fx.burst(e.pos.x, e.pos.y + 1, e.pos.z, '#ff4a6a', 12, 5, 0.5, 0.5); }
      else if (d > 1.4) mv = moveTo(e, tx, tz, e.speed * (d > 12 ? 1.8 : 1.1), dt); else faceTo(e, P.pos.x + Math.sin(P.yaw) * 10, P.pos.z + Math.cos(P.yaw) * 10, dt, 4);
    } else if (e.kind === 'general') {
      const d = Math.hypot(e.home.x - e.pos.x, e.home.z - e.pos.z); if (d > 1.2) mv = moveTo(e, e.home.x, e.home.z, 10, dt); else { const dp = Math.hypot(P.pos.x - e.pos.x, P.pos.z - e.pos.z); if (dp < 22) faceTo(e, P.pos.x, P.pos.z, dt, 3); }
    } else if (!e.friendly || Math.random() < 0.01) {
      if (Math.hypot(e.wander.x - e.pos.x, e.wander.z - e.pos.z) < 1.5 || Math.random() < 0.004) e.wander.set(e.home.x + rand(-14, 14), 0, e.home.z + rand(-14, 14));
      if (e.spawnT % 8 < 4) mv = moveTo(e, e.wander.x, e.wander.z, e.speed * 0.35, dt);
    }
  }
  settle(e, dt);
  if (!e.flying) { if (mv > 6) e.anim = 'run'; else if (mv > 0.5) e.anim = 'walk'; else e.anim = 'council'; } e.ap = mv / Math.max(1, e.speed);
  void near;
}
function stepFlyer(e: Ent, t: Ent | 'player' | null, dt: number) {
  const gy = terrainHeight(e.pos.x, e.pos.z); const hov = gy + 13; let sp = 0;
  if (!t) { e.pos.y += (hov - e.pos.y) * dt; const a = e.animT * 0.3 + e.id; sp = moveTo(e, e.home.x + Math.cos(a) * 25, e.home.z + Math.sin(a) * 25, e.speed * 0.5, dt); return sp; }
  const tx = t === 'player' ? P.pos.x : t.pos.x, ty = t === 'player' ? P.pos.y + 1 : t.pos.y + t.height * 0.5, tz = t === 'player' ? P.pos.z : t.pos.z;
  if (e.special?.kind === 'dive') { e.special.t += dt; _v.set(tx - e.pos.x, ty - e.pos.y, tz - e.pos.z); const d = _v.length(); _v.normalize(); e.pos.addScaledVector(_v, e.speed * 2.2 * dt); e.yaw = Math.atan2(_v.x, _v.z); if (d < 4 + (t === 'player' ? 0 : (t as Ent).radius) || e.special.t > 2.5) { if (d < 6) { if (t === 'player') hurtPlayer(e.dmg, e.pos); else hurtEnt(t, e.dmg, null, {}); audio.sfx('hit'); } e.special = undefined; e.state = 'idle'; e.atkCd = rand(3, 5); } return e.speed * 2; }
  const a = e.animT * 0.5 + e.id; const dx = tx + Math.cos(a) * 16 - e.pos.x, dz = tz + Math.sin(a) * 16 - e.pos.z, dy = Math.max(ty + 8, gy + 8) - e.pos.y; _v.set(dx, dy, dz); const l = _v.length(); _v.multiplyScalar(Math.min(e.speed, l / Math.max(dt, 0.001)) / (l || 1)); e.pos.addScaledVector(_v, dt); e.yaw = Math.atan2(tx - e.pos.x, tz - e.pos.z);
  if (e.atkCd <= 0) { if (e.team === 'ally' || Math.random() < 0.5) { e.special = { kind: 'dive', t: 0 }; e.state = 'idle'; audio.sfx('wing'); } else { _v.set(tx - e.pos.x, ty - e.pos.y, tz - e.pos.z).normalize(); spawnProj({ x: e.pos.x, y: e.pos.y, z: e.pos.z, dir: _v, speed: 36, dmg: e.dmg * 0.7, team: e.team, color: '#ff8a2a', kind: 'fireball', radius: 0.7, aoe: 4, owner: e }); e.atkCd = rand(2.5, 4); } }
  return e.speed * 0.5;
}

// ---------- generals ----------
function generalAbility(e: Ent, t: Ent | 'player') {
  const g = GEN_BY_ID[e.gid!]; const col = g.color; const tp = t === 'player' ? P.pos : t.pos; const dmg = g.power * 0.4; E.fx.ring(e.pos.x, e.pos.y + 0.3, e.pos.z, col, 8, 0.6); popup(e.pos.x, e.pos.y + e.height + 1, e.pos.z, g.ability.toUpperCase() + '!', col, true); audio.sfx('magic');
  const ally = e.team === 'ally'; const victims: Team = ally ? 'enemy' : 'ally';
  switch (g.id) {
    case 'infernos': E.fx.ring(e.pos.x, e.pos.y + 0.3, e.pos.z, '#ff5a1f', 14, 0.7); E.fx.blob(e.pos.x, e.pos.y + 1, e.pos.z, '#ff7a2a', 13, 0.6); E.fx.burst(e.pos.x, e.pos.y + 1, e.pos.z, '#ffaa44', 50, 16, 1, 0.9, -2); dmgRadius(e.pos.x, e.pos.y, e.pos.z, 14, dmg, victims, { kb: 12, big: true }); audio.sfx('explode'); break;
    case 'glacius': for (let i = -1; i <= 1; i++) { _v.set(tp.x - e.pos.x, 0.05, tp.z - e.pos.z).normalize().applyAxisAngle(new V3(0, 1, 0), i * 0.18); spawnProj({ x: e.pos.x, y: e.pos.y + 2, z: e.pos.z, dir: _v, speed: 50, dmg: dmg * 0.5, team: e.team, color: '#aef0ff', kind: 'bolt', radius: 0.6, aoe: 4, owner: e }); } dmgRadius(tp.x, tp.y, tp.z, 8, dmg * 0.2, victims, { stun: 1.5 }); E.fx.ring(tp.x, tp.y + 0.3, tp.z, '#aef0ff', 8, 0.8); break;
    case 'umbra': E.fx.burst(e.pos.x, e.pos.y + 1, e.pos.z, '#8a4bff', 30, 8, 0.7, 0.6); e.pos.set(tp.x + 1.5, tp.y, tp.z + 1.5); E.fx.burst(e.pos.x, e.pos.y + 1, e.pos.z, '#d3b3ff', 30, 8, 0.7, 0.6); E.fx.ring(e.pos.x, e.pos.y + 1, e.pos.z, '#8a4bff', 7, 0.5); dmgRadius(e.pos.x, e.pos.y, e.pos.z, 6, dmg, victims, { kb: 6, big: true }); audio.sfx('teleport'); break;
    case 'behemoth': { _v.set(tp.x - e.pos.x, 0, tp.z - e.pos.z).normalize(); for (let i = 1; i <= 4; i++) { const x = e.pos.x + _v.x * i * 5, z = e.pos.z + _v.z * i * 5; dmgRadius(x, e.pos.y, z, 6, dmg * 0.6, victims, { kb: 14, big: true }); E.fx.burst(x, e.pos.y + 0.5, z, '#c98a3a', 16, 8, 0.9, 0.7, 4); } e.pos.x += _v.x * 18; e.pos.z += _v.z * 18; audio.sfx('slam'); shake(0.3); break; }
    case 'nyxara': for (let i = 0; i < 3; i++) { _v.set(Math.cos(i * 2.1), 0.6, Math.sin(i * 2.1)); spawnProj({ x: e.pos.x, y: e.pos.y + 3, z: e.pos.z, dir: _v, speed: 26, dmg: dmg * 0.45, team: e.team, color: '#ff4fd0', kind: 'bolt', radius: 0.8, aoe: 4, turn: 6, tgt: t === 'player' ? null : t, owner: e, life: 5 }); } break;
    case 'drakmor': { const x = tp.x, z = tp.z; e.pos.set(x + rand(-4, 4), tp.y, z + rand(-4, 4)); E.fx.ring(x, tp.y + 0.3, z, '#ffe070', 12, 0.7); E.fx.burst(x, tp.y + 1, z, '#ffcc44', 50, 14, 1, 0.8, -3, 4); dmgRadius(x, tp.y, z, 11, dmg * 1.1, victims, { kb: 14, big: true }); audio.sfx('explode'); shake(0.4); break; }
    case 'mortis': for (let i = 0; i < 4; i++) { const a = i * 1.57; const s = spawnAlly('undead', e.pos.x + Math.cos(a) * 4, e.pos.z + Math.sin(a) * 4, { expire: 28, weight: 4 }); s.divId = 'follow'; s.team = e.team; E.fx.burst(s.pos.x, s.pos.y, s.pos.z, '#7dffa0', 16, 6, 0.6, 0.6); } break;
  }
}

// ---------- boss AI ----------
function updateBoss(e: Ent, dt: number, near: boolean) {
  const b = e.boss!; e.animT += dt; if (e.hitFlash > 0) e.hitFlash -= dt; const bc = BOSS_CFG[b.id];
  const dx = P.pos.x - e.pos.x, dz = P.pos.z - e.pos.z; const dist = Math.hypot(dx, dz); const gy = terrainHeight(e.pos.x, e.pos.z);
  if (b.dying > 0) { b.dying -= dt; e.anim = 'die'; e.ap = Math.min(1, 1 - b.dying / 3.2); if (Math.random() < 0.5) { E.fx.burst(e.pos.x + rand(-1, 1) * e.radius, e.pos.y + Math.random() * e.height, e.pos.z + rand(-1, 1) * e.radius, b.color, 18, 14, 1.4, 0.8); E.fx.blob(e.pos.x + rand(-1, 1) * e.radius, e.pos.y + Math.random() * e.height, e.pos.z + rand(-1, 1) * e.radius, '#ffffff', 5, 0.35); } e.group.scale.multiplyScalar(1 - dt * 0.12); if (b.dying <= 0) removeEnt(e); return; }
  if (b.intro > 0) { b.intro -= dt; e.anim = 'council'; e.group.position.copy(e.pos); return; }
  const ph = e.hp > e.max * 0.66 ? 1 : e.hp > e.max * 0.33 ? 2 : 3; if (ph !== b.phase) { b.phase = ph; audio.sfx(bc.roar); shake(0.7); E.fx.ring(e.pos.x, e.pos.y + 1, e.pos.z, b.color, 40, 1, 2); E.fx.blob(e.pos.x, e.pos.y + e.height * 0.5, e.pos.z, b.color, 14, 0.8); b.pattern = ''; b.patternCd = 1.2; useGame.getState().toast(`${e.name} enters PHASE ${ph}!`, 'bad'); }
  if (e.stun > 0) e.stun = 0;
  const flying = bc.hover > 0; const wantY = flying ? gy + bc.hover + Math.sin(e.animT) * 1 : gy; if (!bc.stationary || flying) e.pos.y += (wantY - e.pos.y) * Math.min(1, dt * 3);
  if (b.id === 'sea_beast' || b.id === 'dimensional_destroyer') e.pos.y = gy + (b.id === 'dimensional_destroyer' ? 4 : 0);
  if (b.pattern !== 'charge' && b.pattern !== 'slam') { e.yaw += (() => { let d = Math.atan2(dx, dz) - e.yaw; while (d > PI) d -= 2 * PI; while (d < -PI) d += 2 * PI; return d * Math.min(1, dt * 3); })(); }
  const spd = bc.speed * (1 + (ph - 1) * 0.2);
  if (!b.pattern) { if (!bc.stationary && dist > e.radius + 7) { e.pos.x += (dx / dist) * spd * dt * 0.7; e.pos.z += (dz / dist) * spd * dt * 0.7; e.anim = 'run'; } else e.anim = 'council'; b.patternCd -= dt; if (b.patternCd <= 0) { const list = b.patterns.slice(0, 2 + ph); let p = list[Math.floor(Math.random() * list.length)]; if (p === b.pattern) p = list[0]; b.pattern = p; b.patT = 0; b.marks = []; if (p === 'charge') b.chargeDir.set(dx, 0, dz).normalize(); if (p === 'summon' && R.ents.filter((x) => x.team === 'enemy' && x.kind === 'unit' && !x.raid).length > 18) b.pattern = 'volley'; } }
  else {
    b.patT += dt; const T = b.patT; const done = () => { b.pattern = ''; b.patternCd = (ph === 1 ? 2.8 : ph === 2 ? 2 : 1.4) + Math.random(); };
    switch (b.pattern) {
      case 'slam': { const R2 = e.radius * 2.2 + 8; e.anim = 'slam'; e.ap = Math.min(1, T / 1.4); if (T < 1.4 && Math.floor(T * 5) !== Math.floor((T - dt) * 5)) E.fx.ring(e.pos.x, gy + 0.3, e.pos.z, '#ff3030', R2, 0.4, R2 * 0.9); if (T >= 1.4 && T - dt < 1.4) { E.fx.ring(e.pos.x, gy + 0.5, e.pos.z, b.color, R2 * 1.1, 0.7, 1); E.fx.burst(e.pos.x, gy + 1, e.pos.z, b.color, 60, 22, 1.2, 0.9, 6, 4); audio.sfx('slam'); shake(0.7); const d = Math.hypot(P.pos.x - e.pos.x, P.pos.z - e.pos.z); if (d < R2 && P.pos.y - groundAt(P.pos.x, P.pos.y, P.pos.z) < 2.5) hurtPlayer(e.dmg * 1.6, e.pos); dmgRadius(e.pos.x, gy, e.pos.z, R2, e.dmg, 'ally'); } if (T > 2.0) done(); break; }
      case 'volley': { e.anim = 'cast'; e.ap = Math.min(1, T / 0.8); const n = 3 + ph * 2; const k = Math.floor((T - 0.7) / 0.18); if (T > 0.7 && k >= 0 && k < n && Math.floor((T - 0.7 - dt) / 0.18) !== k) { _v.set(P.pos.x - e.pos.x + rand(-4, 4), P.pos.y + 1 - (e.pos.y + e.height * 0.6), P.pos.z - e.pos.z + rand(-4, 4)).normalize(); spawnProj({ x: e.pos.x + Math.sin(e.yaw) * e.radius, y: e.pos.y + e.height * 0.6, z: e.pos.z + Math.cos(e.yaw) * e.radius, dir: _v, speed: 34, dmg: e.dmg, team: 'enemy', color: b.color, kind: 'fireball', radius: 0.9, aoe: 4.5, turn: ph > 1 ? 0.8 : 0, tgt: null, owner: e }); audio.sfx('fireball'); } if (T > 0.7 + n * 0.18 + 0.5) done(); break; }
      case 'charge': { e.anim = 'run'; if (T < 1.0) { if (Math.floor(T * 6) !== Math.floor((T - dt) * 6)) E.fx.ring(e.pos.x + b.chargeDir.x * 12, gy + 0.3, e.pos.z + b.chargeDir.z * 12, '#ff3030', 6, 0.3); e.yaw = Math.atan2(b.chargeDir.x, b.chargeDir.z); } else if (T < 2.0) { e.pos.x += b.chargeDir.x * spd * 3 * dt; e.pos.z += b.chargeDir.z * spd * 3 * dt; E.fx.burst(e.pos.x, e.pos.y + 1, e.pos.z, b.color, 3, 6, 0.8, 0.5); if (Math.hypot(P.pos.x - e.pos.x, P.pos.z - e.pos.z) < e.radius + 1.5 && Math.abs(P.pos.y - e.pos.y) < e.height + 2) hurtPlayer(e.dmg * 1.2, e.pos); dmgRadius(e.pos.x, e.pos.y, e.pos.z, e.radius + 1, e.dmg * 0.5, 'ally'); } else done(); break; }
      case 'summon': { e.anim = 'ultimate'; e.ap = Math.min(0.6, T / 1.2); if (T > 1.0 && T - dt <= 1.0) { audio.sfx(bc.roar); for (let i = 0; i < 2 + ph; i++) { const a = (i / (2 + ph)) * PI * 2; const type = bc.minions[i % bc.minions.length]; const m = spawnEnemy(type, e.pos.x + Math.cos(a) * (e.radius + 6), e.pos.z + Math.sin(a) * (e.radius + 6), { aggro: 90 }); E.fx.burst(m.pos.x, m.pos.y + 1, m.pos.z, b.color, 30, 9, 0.8, 0.8); E.fx.ring(m.pos.x, m.pos.y + 0.3, m.pos.z, b.color, 6, 0.6); } } if (T > 2.2) done(); break; }
      case 'meteor': { e.anim = 'ultimate'; e.ap = Math.min(0.6, T / 1.0); if (T > 0.8 && b.marks.length === 0) { const n = 3 + ph * 2; for (let i = 0; i < n; i++) b.marks.push({ x: i === 0 ? P.pos.x : P.pos.x + rand(-14, 14), z: i === 0 ? P.pos.z : P.pos.z + rand(-14, 14), t: 1.5 + i * 0.3, r: 7 }); audio.sfx('charge'); }
        for (const m of b.marks) { if (m.t <= 0) continue; const before = m.t; m.t -= dt; const y0 = terrainHeight(m.x, m.z); if (Math.floor(before * 4) !== Math.floor(m.t * 4)) E.fx.ring(m.x, y0 + 0.3, m.z, '#ff3030', m.r, 0.3, m.r * 0.85); E.fx.burst(m.x, y0 + 14 * (m.t / 1.8) + 2, m.z, b.color, 1, 2, 1.4, 0.3);
          if (m.t <= 0) { E.fx.blob(m.x, y0 + 1, m.z, b.color, m.r * 1.2, 0.5); E.fx.ring(m.x, y0 + 0.4, m.z, b.color, m.r * 1.6, 0.6); E.fx.burst(m.x, y0 + 1, m.z, b.color, 40, 18, 1.1, 0.8, 4, 6); audio.sfx('explode'); shake(0.4); if (Math.hypot(P.pos.x - m.x, P.pos.z - m.z) < m.r && P.pos.y - y0 < 5) hurtPlayer(e.dmg * 1.3, _v.set(m.x, y0, m.z)); dmgRadius(m.x, y0, m.z, m.r, e.dmg, 'ally'); } }
        if (b.marks.length && b.marks.every((m) => m.t <= 0)) done(); break; }
      default: done();
    }
  }
  e.group.position.copy(e.pos); e.group.rotation.y = e.yaw;
  if (near || true) {
    if (e.rig) animateRig(e.rig, e.anim === 'council' && flying ? 'flyIdle' : e.anim, e.animT, 0.6, e.ap, dt);
    if (e.drig) animateDragon(e.drig, e.animT, b.pattern === 'charge' ? 7 : 4, b.pattern === 'volley' ? 1 : 0, true);
    if (e.brig) e.brig.update(e.animT, dt, b.pattern ? 1 : 0);
  }
}

// ---------- main update ----------
export function updateEnts(dt: number, camQuat: THREE.Quaternion) {
  for (const e of R.ents) {
    const dx = e.pos.x - P.pos.x, dz = e.pos.z - P.pos.z; const d2 = dx * dx + dz * dz; const dist = Math.sqrt(d2);
    if (e.kind === 'dummy') { e.hitFlash = Math.max(0, e.hitFlash - dt); e.group.rotation.z = Math.sin(performance.now() * 0.03) * e.hitFlash * 0.25; continue; }
    if (e.kind === 'boss') { updateBoss(e, dt, dist < 200); e.group.visible = dist < 700; if (e.hp > 0 && dist > 520 && e.boss!.intro <= 0) { e.hp = e.max; e.pos.set(e.home.x, e.home.y + e.boss!.hover, e.home.z); } continue; }
    if (e.kind === 'dragon') { updateDragonAlly(e, dt); continue; }
    const far = e.kind === 'unit' || e.kind === 'summon'; if (far && !e.raid && !e.tid && e.team === 'enemy' && dist > 170) { removeEnt(e); continue; } if (e.team === 'ally' && e.divId && e.divId !== '' && dist > 240) { removeEnt(e); continue; }
    const vis = dist < (e.scale > 2.5 ? 220 : 130); e.group.visible = vis; if (!vis) continue;
    if (e.kind === 'citizen') { stepCitizen(e, dt, dist < 80); } else if (e.kind === 'commander') { e.animT += dt; if (dist < 20) faceTo(e, P.pos.x, P.pos.z, dt, 2); } else stepUnit(e, dt, dist < 90);
    e.group.position.copy(e.pos); if (e.state === 'dead' && e.st > 1.6) e.group.position.y -= (e.st - 1.6) * 1.2; e.group.rotation.y = e.yaw;
    if (dist < 100) {
      if (e.rig) { const sc = e.rig.scale * (1 + Math.max(0, e.hitFlash) * 0.25); e.rig.root.scale.setScalar(sc); animateRig(e.rig, e.anim, e.animT, e.ap > 0 && (e.anim === 'run' || e.anim === 'walk') ? Math.min(1, e.ap) : e.ap, e.ap, dt); if (e.rig.aura) e.rig.aura.visible = false; }
      if (e.drig) animateDragon(e.drig, e.animT, e.flying ? 6 : 3, e.special?.kind === 'dive' ? 1 : 0, e.flying);
    }
    if (e.bar) { e.bar.visible = e.state !== 'dead' && dist < 60 && e.hp < e.max; if (e.bar.visible) { e.bar.position.set(e.pos.x, e.pos.y + e.height + 0.8, e.pos.z); e.bar.quaternion.copy(camQuat); const f = Math.max(0.001, e.hp / e.max); e.barFill!.scale.x = f; e.barFill!.position.x = -(1 - f) * 0.8; } }
  }
  flush();
}
function stepCitizen(e: Ent, dt: number, near: boolean) {
  e.animT += dt; e.spawnT += dt; if (e.state === 'dead') return; const kind = e.gid;
  if (kind === 'recruit') { e.anim = e.spawnT % 3 < 0.6 ? 'atk1' : 'council'; e.ap = (e.spawnT % 3) / 0.6; faceTo(e, e.home.x + 6, e.home.z - 8, dt, 4); return; }
  if (kind === 'guard') { const dp = Math.hypot(P.pos.x - e.pos.x, P.pos.z - e.pos.z); e.anim = 'council'; if (dp < 14) faceTo(e, P.pos.x, P.pos.z, dt, 2); return; }
  if (!near) return; const dp = Math.hypot(P.pos.x - e.pos.x, P.pos.z - e.pos.z);
  if (kind === 'merchant') { e.anim = 'council'; if (dp < 16) faceTo(e, P.pos.x, P.pos.z, dt, 2); return; }
  if (Math.hypot(e.wander.x - e.pos.x, e.wander.z - e.pos.z) < 1.2) e.wander.set(e.home.x + rand(-12, 12), 0, e.home.z + rand(-12, 12));
  const mv = e.spawnT % 14 < 9 ? moveTo(e, e.wander.x, e.wander.z, 2.6, dt) : 0; settle(e, dt); e.anim = mv > 0.5 ? 'walk' : 'council'; e.ap = 0.3;
}
function updateDragonAlly(e: Ent, dt: number) {
  e.animT += dt; e.expire -= dt; const d = e.drig!; const tgt = hostileList(e).filter((o) => Math.hypot(o.pos.x - P.pos.x, o.pos.z - P.pos.z) < 90).sort((a, b) => Math.hypot(a.pos.x - e.pos.x, a.pos.z - e.pos.z) - Math.hypot(b.pos.x - e.pos.x, b.pos.z - e.pos.z))[0];
  const gy = terrainHeight(e.pos.x, e.pos.z); let tx: number, tz: number, ty: number;
  if (tgt) { const a = Math.atan2(e.pos.x - tgt.pos.x, e.pos.z - tgt.pos.z); tx = tgt.pos.x + Math.sin(a) * 26; tz = tgt.pos.z + Math.cos(a) * 26; ty = Math.max(gy, tgt.pos.y) + 15; } else { const a = e.animT * 0.35; tx = P.pos.x + Math.cos(a) * 18; tz = P.pos.z + Math.sin(a) * 18; ty = Math.max(P.pos.y, gy) + 14; }
  if (e.spawnT < 2) { e.spawnT += dt; } _v.set(tx - e.pos.x, ty - e.pos.y, tz - e.pos.z); const l = _v.length(); _v.multiplyScalar(Math.min(26, l * 1.2) / (l || 1)); e.pos.addScaledVector(_v, dt);
  const fx = tgt ? tgt.pos.x : P.pos.x + Math.cos(e.animT * 0.35 + 0.5) * 18, fz = tgt ? tgt.pos.z : P.pos.z + Math.sin(e.animT * 0.35 + 0.5) * 18; faceTo(e, fx, fz, dt, 3);
  e.atkCd -= dt; let mouth = 0; if (tgt && e.atkCd <= 0.4) mouth = 1;
  if (tgt && e.atkCd <= 0) { e.atkCd = 1.6; for (let i = 0; i < 3; i++) { _v.set(tgt.pos.x - e.pos.x + rand(-3, 3), tgt.pos.y + tgt.height * 0.4 - e.pos.y, tgt.pos.z - e.pos.z + rand(-3, 3)).normalize(); spawnProj({ x: e.pos.x + Math.sin(e.yaw) * 4, y: e.pos.y + 2, z: e.pos.z + Math.cos(e.yaw) * 4, dir: _v, speed: 50, dmg: S.atk * 2.2, team: 'ally', color: '#ff8a2a', kind: 'fireball', radius: 0.9, aoe: 5, owner: e }); } audio.sfx('fireball'); }
  e.group.position.copy(e.pos); e.group.rotation.y = e.yaw; animateDragon(d, e.animT, 5, mouth, true);
  if (e.expire <= 0) { E.fx.burst(e.pos.x, e.pos.y + 2, e.pos.z, '#ff6a2a', 60, 14, 1.4, 1); removeEnt(e); R.dragonAlive = false; }
}
export function spawnDragonAlly() {
  const d = buildDragon('#14080c', '#ff5a1f', '#ffb347', 2.6, 1); const e = mkEnt({ team: 'ally', type: 'dragon', name: 'Summoned Dragon', fac: 'demon', kind: 'dragon', drig: d, group: d.root, pos: new V3(P.pos.x + Math.sin(P.yaw) * 30, P.pos.y + 50, P.pos.z + Math.cos(P.yaw) * 30), hp: 1e9, dmg: S.atk, speed: 26, radius: 4, height: 6, scale: 2.6, flying: true, expire: 50 + (useGame.getState().equipment.dragon ? 25 : 0) });
  R.dragonAlive = true; return e;
}

// ---------- spawning & world sync ----------
let spawnT = 0, syncT = 0, genT = 0, fieldT = 0, guardT = 0;
const Y_AX = new V3(0, 1, 0);
void Y_AX;
export function initPopulation() {
  for (const s of W.dummies) { spawnDummy(s, s.getWorldPosition(new V3()).x, s.getWorldPosition(new V3()).z); }
  const npcs = import('./capital').then((m) => { for (const n of m.npcSpots) { const c = spawnCitizen(n.x, n.z, n.kind); c.home.set(n.x, 0, n.z); } });
  void npcs;
  for (const c of COMMANDERS) spawnCommander(c.id);
  for (const g of GENERALS) { const h = W.hq[g.id]; const e = spawnGeneral(g.id, h.x, h.z); e.home.set(h.x, 0, h.z); e.yaw = h.yaw; }
}
const spotOf = (gid: string): { x: number; z: number; y?: number } => {
  const s = useGame.getState(); const gs = s.generals[gid]; const g = GEN_BY_ID[gid];
  if (gs.mode === 'council') { const i = GENERALS.findIndex((x) => x.id === gid); const c = W.council[i]; return { x: c.x, z: c.z }; }
  if (gs.deployed) { const t = terrDef(s, g.territory); return { x: t.x + 6 + GENERALS.findIndex((x) => x.id === gid) * 1.5, z: t.z + t.flatR * 0.6 }; }
  const h = W.hq[gid]; return { x: h.x, z: h.z };
};
function syncGenerals() {
  const s = useGame.getState();
  for (const e of R.ents) {
    if (e.kind !== 'general' || !e.gid) continue; const gs = s.generals[e.gid]; const isF = gs.mode === 'follow';
    if (isF) { e.divId = 'follow'; e.aggro = 70; if (e.home.distanceTo(P.pos) > 0) e.home.copy(P.pos); if (Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z) > 60 || (e.spawnT < 0.2)) { e.pos.set(P.pos.x - Math.sin(P.yaw) * 5, P.pos.y, P.pos.z - Math.cos(P.yaw) * 5); E.fx.ring(e.pos.x, e.pos.y + 0.3, e.pos.z, GEN_BY_ID[e.gid].color, 6, 0.6); } continue; }
    e.divId = ''; e.aggro = 28; const sp = spotOf(e.gid); const prev = e.home; if (Math.hypot(prev.x - sp.x, prev.z - sp.z) > 1) { E.fx.burst(e.pos.x, e.pos.y + 1, e.pos.z, GEN_BY_ID[e.gid].color, 25, 6, 0.7, 0.6); e.pos.set(sp.x, terrainHeight(sp.x, sp.z), sp.z); E.fx.burst(e.pos.x, e.pos.y + 1, e.pos.z, GEN_BY_ID[e.gid].color, 25, 6, 0.7, 0.6); prev.set(sp.x, 0, sp.z); if (gs.mode === 'council') { const i = GENERALS.findIndex((x) => x.id === e.gid); e.yaw = W.council[i].yaw; } }
  }
}
function syncField() {
  const s = useGame.getState(); refreshDivCache(); const budget = useGame.getState().settings.quality === 'low' ? 14 : useGame.getState().settings.quality === 'medium' ? 20 : 28;
  const fieldDivs = s.divisions.filter((d) => d.status === 'field'); let used = 0;
  for (const d of fieldDivs) {
    const total = UNIT_KEYS.reduce((a, k) => a + (d.comp[k] ?? 0), 0); let want: UnitType[] = [];
    if (total > 0) {
      const reps = Math.min(Math.max(2, Math.ceil(total / 55)), Math.max(0, budget - used), 20); const wts = UNIT_KEYS.map((k) => ({ k, w: (d.comp[k] ?? 0) * Math.sqrt(UNITS[k].power) })).filter((x) => x.w > 0); const sum = wts.reduce((a, b) => a + b.w, 0);
      const alloc = wts.map((x) => ({ k: x.k, n: Math.floor((x.w / sum) * reps), r: ((x.w / sum) * reps) % 1 })); let rem = reps - alloc.reduce((a, b) => a + b.n, 0); alloc.sort((a, b) => b.r - a.r); for (const a of alloc) { if (rem <= 0) break; a.n++; rem--; }
      for (const a of alloc) for (let i = 0; i < a.n; i++) want.push(a.k); want = want.slice(0, reps);
    }
    used += want.length; const have = R.ents.filter((e) => e.divId === d.id && e.state !== 'dead' && !gone.has(e)); const c = divCache[d.id]; if (c) c.n = Math.max(1, want.length);
    const weight = Math.max(1, total / Math.max(1, want.length)); const counts: Record<string, number> = {}; for (const w of want) counts[w] = (counts[w] ?? 0) + 1; const hc: Record<string, Ent[]> = {};
    for (const h of have) (hc[h.unitType!] ??= []).push(h);
    for (const k of UNIT_KEYS) { const need = counts[k] ?? 0, cur = hc[k]?.length ?? 0; for (let i = cur; i < need; i++) { const a = P.yaw + PI + rand(-1, 1); const r = rand(5, 11); const x = P.pos.x + Math.sin(a) * r, z = P.pos.z + Math.cos(a) * r; const e = spawnAlly(k, x, z, { divId: d.id, weight }); E.fx.ring(x, e.pos.y + 0.3, z, '#ff2a4a', 3, 0.5); E.fx.burst(x, e.pos.y + 1, z, '#ff4a6a', 10, 5, 0.5, 0.5); } if (cur > need) for (let i = need; i < cur; i++) { E.fx.burst(hc[k][i].pos.x, hc[k][i].pos.y + 1, hc[k][i].pos.z, '#ff4a6a', 10, 5, 0.5, 0.5); removeEnt(hc[k][i]); } }
    let idx = 0; for (const e of R.ents) if (e.divId === d.id && !gone.has(e)) { e.slot = idx++; e.weight = weight; const order = c?.order ?? 'follow'; e.aggro = order === 'attack' ? 95 : order === 'patrol' ? 45 : order === 'defend' ? 34 : 32; }
  }
  for (const e of R.ents) if (e.team === 'ally' && e.divId && e.divId !== 'follow' && e.divId !== '' && e.kind !== 'summon' && !fieldDivs.some((d) => d.id === e.divId) && !gone.has(e)) removeEnt(e);
  R.ents.length;
}
function manageSpawns(dt: number) {
  spawnT -= dt; if (spawnT > 0) return; spawnT = 0.7; const s = useGame.getState(); const q = s.settings.quality; const target = q === 'low' ? 8 : q === 'medium' ? 11 : 14;
  if (P.dungeon) { dungeonPop(); return; }
  const reg = regionAt(P.pos.x, P.pos.z); R.region = reg; if (reg === 'capital') return;
  const list = REGION_ENEMIES[reg]; if (!list) return; const cnt = R.ents.filter((e) => e.team === 'enemy' && e.kind === 'unit' && !e.raid && !e.tid && e.state !== 'dead').length; if (cnt >= target) return;
  const a = Math.random() * PI * 2, r = rand(48, 88); const x = P.pos.x + Math.cos(a) * r, z = P.pos.z + Math.sin(a) * r; if (regionAt(x, z) !== reg || Math.hypot(x, z) > 680) return; const y = terrainHeight(x, z); if (reg === 'ocean' ? y > -3 : y < 0.2) return; if (pointBlocked(x, y + 1, z, 2)) return;
  const type = list[Math.floor(Math.random() * list.length)]; const fac = ENEMY_TYPES[type].fac; const st = s.factions[fac as 'human']?.state; const friendly = (fac === 'human' || fac === 'celestial') && (st === 'peace' || st === 'alliance');
  if (friendly && cnt > 5) return; if (reg === 'ocean' && P.pos.y > -2 && Math.random() < 0.5) return; spawnEnemy(type, x, z, { friendly });
}
function dungeonPop() {
  if (R.dungeonSpawned) return; R.dungeonSpawned = true; import('./capital').then((m) => { m.dungeonSpawns.forEach((p, i) => { const e = spawnEnemy(i % 4 === 3 ? 'guardian' : 'skeleton', p.x, p.z, { y: DUNGEON.y }); e.aggro = 38; e.home.set(p.x, DUNGEON.y, p.z); }); });
}
function manageGuards() {
  const s = useGame.getState(); for (const t of allTerritories(s)) {
    const st = s.terr[t.id]; if (!st || st.owner === 'demon' || t.id === 'capital') continue; const d = Math.hypot(P.pos.x - t.x, P.pos.z - t.z); if (d > 150) { if (d > 320) R.terrKills[t.id] = Math.max(0, (R.terrKills[t.id] ?? 0) - 0.02); continue; }
    if ((R.terrKills[t.id] ?? 0) >= 8) continue; const fs = s.factions[st.owner]; if (st.owner !== 'ancient' && st.owner !== 'rival' && (fs.state === 'peace' || fs.state === 'alliance')) continue;
    const have = R.ents.filter((e) => e.tid === t.id && !e.raid && e.state !== 'dead').length; if (have >= 8) continue; const list = FACTION_RAIDERS[st.owner] ?? REGION_ENEMIES[t.region] ?? ['skeleton']; const type = t.region === 'ocean' ? 'merfolk' : t.region === 'frozen' ? 'frost_warrior' : t.region === 'dragon' ? 'drake_cultist' : list[Math.floor(Math.random() * list.length)];
    const a = Math.random() * PI * 2, r = rand(8, t.flatR * 0.7); const x = t.x + Math.cos(a) * r, z = t.z + Math.sin(a) * r; const e = spawnEnemy(type === 'wyvern' ? 'drake_cultist' : type, x, z, { tid: t.id }); e.home.set(t.x, 0, t.z); e.aggro = 42;
  }
}
function manageRaids() {
  const s = useGame.getState(); for (const a of s.attacks) {
    if (a.phase !== 'arrived') continue; const t = terrDef(s, a.tid); const alive = R.ents.filter((e) => e.raid && e.tid === a.tid && e.state !== 'dead').length; const d = Math.hypot(P.pos.x - t.x, P.pos.z - t.z);
    if (!R.raidIds[a.id] && d < 340) { R.raidIds[a.id] = true; useGame.setState((x) => ({ attacks: x.attacks.map((y) => (y.id === a.id ? { ...y, raid: true } : y)) })); const list = FACTION_RAIDERS[a.faction]; const n = 9 + Math.floor(a.power / 2500); for (let i = 0; i < Math.min(n, 15); i++) { const ang = (i / n) * PI * 2, r = (t.id === 'capital' ? 175 : 55) + rand(0, 14); const x = t.x + Math.cos(ang) * r, z = t.z + Math.sin(ang) * r; const type = list[Math.floor(Math.random() * list.length)]; const e = spawnEnemy(type, x, z, { raid: true, tid: a.tid }); e.home.set(t.x + rand(-6, 6), 0, t.z + rand(-6, 6)); if (type === 'wyvern') e.home.set(t.x, 0, t.z); } s.toast(`⚔ INVASION at ${t.name}! Defend it!`, 'bad'); audio.sfx('horn'); audio.music('battle'); }
    else if (R.raidIds[a.id] && alive === 0) { delete R.raidIds[a.id]; useGame.getState().resolveAttack(a.id, true); audio.sfx('victory'); }
  }
  for (const e of R.ents) if (e.raid && e.tid && !s.attacks.some((a) => a.tid === e.tid) && e.state !== 'dead') { E.fx.burst(e.pos.x, e.pos.y + 1, e.pos.z, '#ffffff', 10, 5, 0.5, 0.5); removeEnt(e); }
}
function manageBosses() {
  const s = useGame.getState(); if (R.boss && !gone.has(R.boss)) return;
  for (const b of BOSSES) { if (s.bossesDefeated.includes(b.id)) continue; const d = Math.hypot(P.pos.x - b.pos[0], P.pos.z - b.pos[1]); if (d < 85 && !P.dungeon && (b.region !== 'ocean' || P.pos.y < 1)) { if (!R.ents.some((e) => e.boss && e.boss.id === b.id)) { spawnBoss(b); return; } } }
}
function managePois() {
  const s = useGame.getState(); for (const p of W.pois) { if (p.id.startsWith('lair_') || s.visited.includes(p.id)) continue; if (Math.hypot(P.pos.x - p.x, P.pos.z - p.z) < p.r) { useGame.setState((x) => ({ visited: [...x.visited, p.id] })); s.report('visit', p.id); s.toast(`Discovered: ${TERR_BY_ID[p.id]?.name ?? p.id}`, 'epic'); s.gain({ gold: 1000, crystals: 100 }); audio.sfx('pickup'); } }
  for (const id in chestMeshes) { const g = chestMeshes[id]; g.visible = !s.chests.includes(id); }
}
export function updatePopulation(dt: number) {
  syncT += dt; genT += dt; fieldT += dt; guardT += dt; manageSpawns(dt);
  if (genT > 0.6) { genT = 0; syncGenerals(); manageBosses(); managePois(); }
  if (fieldT > 1.0) { fieldT = 0; syncField(); manageRaids(); }
  if (guardT > 3) { guardT = 0; manageGuards(); }
  void regDestr;
}
export const nearestEnemy = (x: number, z: number, maxD: number, facing?: { yaw: number; cos: number }) => {
  let best: Ent | null = null, bd = maxD * maxD;
  for (const e of R.ents) { if (e.team !== 'enemy' || e.state === 'dead' || e.kind === 'citizen' || e.kind === 'commander' || (e.friendly && e.kind !== 'dummy')) continue; if (e.kind === 'boss' && e.boss!.intro > 0) continue; const dx = e.pos.x - x, dz = e.pos.z - z; const d = dx * dx + dz * dz - e.radius * e.radius; if (d > bd) continue; if (facing) { const l = Math.hypot(dx, dz) || 1; if ((dx / l) * Math.sin(facing.yaw) + (dz / l) * Math.cos(facing.yaw) < facing.cos) continue; } bd = d; best = e; }
  return best;
};
