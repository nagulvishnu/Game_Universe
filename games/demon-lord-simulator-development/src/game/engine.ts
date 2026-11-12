import * as THREE from 'three';
import { ABILITIES, BOSS_BY_ID, ITEMS, ITEM_BY_ID, REGION_BY_ID, TERR_BY_ID, WEAPON_STATS, type WeaponType } from './data';
import { audio } from './audio';
import { E, S, clearEnts, dmgRadius, hurtEnt, initPopulation, nearestEnemy, spawnAlly, spawnDragonAlly, spawnProj, updateEnts, updatePopulation, updateProjs, refreshDivCache } from './ents';
import { FX } from './fx';
import { GC, GT, GS, M, animateRig, buildHumanoid, glowM, recolorArmor, setForm, setWeapon, type Anim, type Rig } from './models';
import { P, R, popup, shake } from './rt';
import { equipStats, hooks, useGame, terrDef } from './store';
import { DUNGEON, MAX_R, groundAt, inWater, pointBlocked, rayFree, regionAt, resolve, terrainHeight } from './terrain';
import { ARMOR_SETS, LORD_CFG } from './vis';
import { W } from './wlib';
import { Atmos, Weather, buildFortress, buildWorld, destroyAt, updateBanners, updateWorld } from './world';

const V3 = THREE.Vector3;
const PI = Math.PI;
let lord: Rig, fx: FX, camera: THREE.PerspectiveCamera, atmos: Atmos, weather: Weather, scene: THREE.Scene, canvasEl: HTMLElement | null = null;
let beamCore: THREE.Mesh, beamGlow: THREE.Mesh, beamEnd: THREE.Mesh, slash: THREE.Group, slashMesh: THREE.Mesh;
let equipKey = '', hudT = 0, statT = 0, musicT = 0, wingT = 0, formFxT = 0, slashT = 0, portal: { t: number; x: number; z: number; y: number } | null = null;
let underwater = false; let started = false; let curMusic = '';
const _a = new V3(), _b = new V3(), _c = new V3(), _d = new V3();
export const getState = () => ({ underwater });

const wrapAng = (a: number) => { while (a > PI) a -= 2 * PI; while (a < -PI) a += 2 * PI; return a; };
const turnTo = (cur: number, want: number, k: number) => cur + wrapAng(want - cur) * Math.min(1, k);
const approach = (v: number, t: number, s: number) => (Math.abs(t - v) <= s ? t : v + Math.sign(t - v) * s);
const wstats = () => { const it = ITEM_BY_ID[useGame.getState().equipment.weapon ?? 'voidreaver']; return { ...WEAPON_STATS[(it?.wtype ?? 'sword') as WeaponType], type: (it?.wtype ?? 'sword') as WeaponType, color: it?.color ?? '#ff2d55' }; };
const formMul = () => (P.form ? 1.6 : 1);

// ------------------------------------------------------------ init
export async function initEngine(sc: THREE.Scene, cam: THREE.PerspectiveCamera, onProgress: (p: number, m: string) => void) {
  if (started) return; started = true; scene = sc; camera = cam; const gs = useGame.getState();
  atmos = new Atmos(sc, gs.settings.shadows); weather = new Weather(sc); await buildWorld(sc, onProgress);
  const entRoot = new THREE.Group(); sc.add(entRoot); fx = new FX(sc); E.fx = fx; E.root = entRoot; E.scene = sc;
  lord = buildHumanoid(LORD_CFG, 1, 1.12); sc.add(lord.root);
  beamCore = new THREE.Mesh(GC(1, 1, 1, 12), M('#ffffff', { add: true, tr: 0.95, em: '#ff6a8a', ei: 2 })); beamGlow = new THREE.Mesh(GC(1, 1, 1, 12), M('#ff2d55', { add: true, tr: 0.35, em: '#ff2d55', ei: 1 })); beamEnd = new THREE.Mesh(GS(1, 12, 8), M('#ff8a6a', { add: true, tr: 0.7, em: '#ff6a4a', ei: 2 }));
  for (const m of [beamCore, beamGlow, beamEnd]) { m.visible = false; m.frustumCulled = false; sc.add(m); }
  slash = new THREE.Group(); slashMesh = new THREE.Mesh(GT(2.6, 0.12, 4, 24, PI * 0.85), M('#ffffff', { add: true, tr: 0.9, em: '#ff2d55', ei: 2.4, side: THREE.DoubleSide })); slash.add(slashMesh); slash.visible = false; sc.add(slash);
  initPopulation(); P.pos.set(0, 0, -25); P.camYaw = 0; P.yaw = 0; P.hp = S.hp; P.mana = S.mana; R.camDist = gs.settings.camDist;
  if (gs.startMode === 'continue' && gs.pendingPlayer) { const p = gs.pendingPlayer; P.pos.set(p.x, p.y, p.z); if (p.form) setFormNow(true); R.dungeonSpawned = false; }
  statsFromStore(true); applyEquipVisuals(true);
  hooks.getPlayer = () => ({ x: P.pos.x, y: P.pos.y, z: P.pos.z, form: P.form }); hooks.time = () => R.time; hooks.playerPos = () => ({ x: P.pos.x, z: P.pos.z });
  updateBanners((id) => useGame.getState().terr[id]?.owner ?? 'demon');
  for (const t of gs.outposts) { buildFortress(t); } updateBanners((id) => useGame.getState().terr[id]?.owner ?? 'demon');
  (window as unknown as { __game: unknown }).__game = { P, R, api, useGame };
  R.ready = true; R.lastAuto = R.time; R.lastDay = R.time; R.lastWorld = R.time; audio.music('throne');
}
export function disposeEngine() { started = false; R.ready = false; clearEnts(); }

function setFormNow(on: boolean) { P.form = on ? 1 : 0; setForm(lord, on); }
function statsFromStore(force = false) {
  const s = useGame.getState(); const st = equipStats(s.equipment); S.atk = st.atk; S.def = st.def; S.hp = st.hp; S.mana = st.mana; S.crit = st.crit; S.speed = st.speed; S.regen = st.regen;
  if (force) { P.hp = Math.min(P.hp || S.hp, S.hp); }
}
function applyEquipVisuals(force = false) {
  const s = useGame.getState(); const eq = s.equipment; const key = JSON.stringify(eq); if (!force && key === equipKey) return; equipKey = key;
  const w = eq.weapon ? ITEM_BY_ID[eq.weapon] : null; if (w) setWeapon(lord, w.wtype!, w.color, w.color2); else setWeapon(lord, 'none', '#fff', '#000');
  const a = eq.armor ? ITEM_BY_ID[eq.armor] : null; const set = ARMOR_SETS[a?.armorSet ?? 0]; recolorArmor(lord, set.armor, set.trim);
  const rings = [eq.ring1, eq.ring2]; lord.rings.forEach((r, i) => { const it = rings[i] ? ITEM_BY_ID[rings[i]!] : null; r.visible = !!it; if (it) r.material = glowM(it.color, 1.6); });
  if (lord.gem) { const art = eq.artifact ? ITEM_BY_ID[eq.artifact] : null; lord.gem.material = glowM(art?.color ?? '#ff2040', 2.8); }
  if (lord.mantle) lord.mantle.visible = !!eq.dragon;
}

// ------------------------------------------------------------ input
export function bindInput(el: HTMLElement) {
  canvasEl = el;
  const kd = (e: KeyboardEvent) => {
    const gs = useGame.getState(); if (gs.screen !== 'playing') return; const c = e.code;
    if (c === 'Tab' || c === 'KeyM' || c === 'KeyI' || c === 'Escape' || c.startsWith('Arrow') || c === 'Space') e.preventDefault();
    const toggle = (m: 'command' | 'map' | 'inventory') => { if (gs.menu === m) { closeMenu(); } else if (gs.menu === null) { gs.setMenu(m); document.exitPointerLock?.(); } else gs.setMenu(m); audio.sfx('ui'); };
    if (c === 'Tab') return toggle('command'); if (c === 'KeyM') return toggle('map'); if (c === 'KeyI') return toggle('inventory');
    if (c === 'Escape') { if (gs.menu) closeMenu(); else gs.setMenu('pause'); return; }
    if (gs.menu) return; if (e.repeat) { R.keys.add(c); return; } R.keys.add(c); R.pressed.add(c); audio.resume();
  };
  const ku = (e: KeyboardEvent) => { R.keys.delete(e.code); };
  const md = (e: MouseEvent) => { audio.resume(); if (useGame.getState().menu) return; if (!R.locked && el.requestPointerLock) { el.requestPointerLock(); } R.mouse[e.button] = true; R.mousePressed[e.button] = true; e.preventDefault(); };
  const mu = (e: MouseEvent) => { R.mouse[e.button] = false; };
  const mm = (e: MouseEvent) => { const gs = useGame.getState(); if (gs.screen !== 'playing' || gs.menu || P.dead > 0) return; const s = gs.settings.sens * 0.0022; P.camYaw -= e.movementX * s; P.camPitch += e.movementY * s * (gs.settings.invertY ? -1 : 1); P.camPitch = Math.max(-0.6, Math.min(1.35, P.camPitch)); };
  const wh = (e: WheelEvent) => { const gs = useGame.getState(); if (gs.menu) return; gs.setSettings({ camDist: Math.max(3.5, Math.min(22, gs.settings.camDist + Math.sign(e.deltaY) * 0.8)) }); };
  const pl = () => { R.locked = document.pointerLockElement === el; if (!R.locked) { const gs = useGame.getState(); R.mouse[0] = R.mouse[1] = R.mouse[2] = false; if (gs.screen === 'playing' && !gs.menu && R.ready && performance.now() - lastClose > 350) gs.setMenu('pause'); } };
  const blur = () => { R.keys.clear(); R.mouse[0] = R.mouse[1] = R.mouse[2] = false; };
  const ctx = (e: Event) => e.preventDefault();
  window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); el.addEventListener('mousedown', md); window.addEventListener('mouseup', mu); window.addEventListener('mousemove', mm); window.addEventListener('wheel', wh, { passive: true }); document.addEventListener('pointerlockchange', pl); window.addEventListener('blur', blur); el.addEventListener('contextmenu', ctx);
  return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); el.removeEventListener('mousedown', md); window.removeEventListener('mouseup', mu); window.removeEventListener('mousemove', mm); window.removeEventListener('wheel', wh); document.removeEventListener('pointerlockchange', pl); window.removeEventListener('blur', blur); el.removeEventListener('contextmenu', ctx); };
}
let lastClose = 0;
export function closeMenu() { lastClose = performance.now(); useGame.getState().setMenu(null); useGame.getState().openDialogue(null); try { canvasEl?.requestPointerLock?.(); } catch { /* ignore */ } }
export function resumeLock() { try { canvasEl?.requestPointerLock?.(); } catch { /* ignore */ } }

// ------------------------------------------------------------ helpers
export function project(x: number, y: number, z: number) { const v = new V3(x, y, z).project(camera); return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight, ok: v.z < 1 && v.z > -1 }; }
const chest = (o: THREE.Vector3) => o.set(P.pos.x, P.pos.y + 1.45, P.pos.z);
function softLock(maxDist = 90, cone = 0.93) {
  let best: ReturnType<typeof nearestEnemy> = null, bs = -1; const dir = R.camDir;
  for (const e of R.ents) { if (e.team !== 'enemy' || e.state === 'dead' || e.kind === 'citizen' || e.kind === 'commander' || e.kind === 'dummy' || (e.friendly)) continue; _a.set(e.pos.x - camera.position.x, e.pos.y + e.height * 0.5 - camera.position.y, e.pos.z - camera.position.z); const d = _a.length(); if (d > maxDist) continue; const dot = _a.normalize().dot(dir); if (dot < cone) continue; const sc = dot - d * 0.0008; if (sc > bs) { bs = sc; best = e; } }
  return best;
}
function aimTarget(out: THREE.Vector3) { const l = softLock(); if (l) return out.set(l.pos.x, l.pos.y + l.height * 0.5, l.pos.z); return out.copy(camera.position).addScaledVector(R.camDir, 70); }
function startAction(a: typeof P.action, anim: Anim, dur: number) { P.action = a; P.actionT = 0; P.actionDur = dur; P.actionAnim = anim; }
const cdOf = (id: string) => P.cd[id] ?? 0;
function setCd(id: string) { const ab = ABILITIES.find((x) => x.id === id)!; P.cd[id] = ab.cd * (1 - Math.min(0.4, S.regen * 0.01)); }
function canCast(id: string) { const ab = ABILITIES.find((x) => x.id === id)!; if (cdOf(id) > 0) return false; if (P.mana < ab.mana) { if (R.time - lastManaWarn > 1.5) { useGame.getState().toast('Not enough mana', 'bad'); lastManaWarn = R.time; } return false; } return true; }
let lastManaWarn = 0;

// ------------------------------------------------------------ combat
function startAttack(kind: 'light' | 'heavy') {
  const w = wstats(); const sp = w.speed * (1 + S.speed / 200 + (P.form ? 0.2 : 0)); const air = !P.onGround && !P.flying && !P.swimming;
  const tgt = nearestEnemy(P.pos.x, P.pos.z, 9, { yaw: Math.atan2(R.camDir.x, R.camDir.z), cos: 0.2 }) ?? nearestEnemy(P.pos.x, P.pos.z, 4.5);
  let dist = 99; if (tgt) { P.yaw = Math.atan2(tgt.pos.x - P.pos.x, tgt.pos.z - P.pos.z); dist = Math.hypot(tgt.pos.x - P.pos.x, tgt.pos.z - P.pos.z); } else if (!P.flying) P.yaw = Math.atan2(R.camDir.x, R.camDir.z);
  P.atkKind = kind; P.hitDone = false; P.queued = false; P.atkIdx = 0;
  if (kind === 'heavy') {
    if (air) { startAction('slamdive', 'slam', 3); P.vel.set(0, -48, 0); audio.sfx('heavy'); return; }
    P.combo = 0; P.atkDur = 0.95 / sp; P.hitT = 0.55; startAction('attack', 'heavy', P.atkDur); audio.sfx('heavy'); fx.ring(P.pos.x, P.pos.y + 0.3, P.pos.z, '#ff6a2a', 3, 0.5, 1); return;
  }
  if (air || P.flying) { P.combo = 0; P.atkDur = 0.55 / sp; P.hitT = 0.3; P.atkKind = 'aerial'; startAction('attack', 'aerial', P.atkDur); audio.sfx('swing'); return; }
  P.combo = P.comboT > 0 ? (P.combo % 3) + 1 : 1; const anim: Anim = w.type === 'spear' ? 'thrust' : w.type === 'staff' ? 'cast' : w.type === 'dual' ? (P.combo % 2 ? 'atk1' : 'atk2') : P.combo === 1 ? 'atk1' : P.combo === 2 ? 'atk2' : 'atk3';
  P.atkDur = (P.combo === 3 ? 0.66 : 0.46) / sp; P.hitT = 0.45; startAction('attack', anim, P.atkDur); audio.sfx('swing');
  if (tgt && dist < 14) { const k = Math.min(dist - 1.5, 10); if (k > 0) { P.vel.x += Math.sin(P.yaw) * k * 3.2; P.vel.z += Math.cos(P.yaw) * k * 3.2; } } else { P.vel.x += Math.sin(P.yaw) * 5; P.vel.z += Math.cos(P.yaw) * 5; }
}
function meleeHit(reach: number, arc: number, dmg: number, o: { big?: boolean; stun?: number; kb?: number; aoe?: boolean } = {}) {
  let hits = 0; const fwdX = Math.sin(P.yaw), fwdZ = Math.cos(P.yaw);
  for (const e of R.ents) {
    if (e.team !== 'enemy' || e.state === 'dead' || e.kind === 'citizen' || e.kind === 'commander' || (e.friendly && e.kind !== 'dummy')) continue; const dx = e.pos.x - P.pos.x, dz = e.pos.z - P.pos.z; const d = Math.hypot(dx, dz) - e.radius; if (d > reach) continue;
    if (!o.aoe && d > 0.5) { const dot = (dx * fwdX + dz * fwdZ) / (Math.hypot(dx, dz) || 1); if (dot < Math.cos(arc / 2)) continue; } const cy = e.pos.y + e.height * 0.5; if (Math.abs(cy - (P.pos.y + 1)) > e.height * 0.5 + 3.5) continue;
    _a.set(dx, 0, dz).normalize().multiplyScalar(o.kb ?? (o.big ? 14 : 6)); hurtEnt(e, dmg, _a, { fromPlayer: true, big: o.big, stun: o.stun }); hits++;
  }
  if (hits) { R.hitStop = 0.05; shake(o.big ? 0.35 : 0.14); audio.sfx(o.big ? 'bighit' : 'hit'); P.mana = Math.min(S.mana, P.mana + hits * 2); }
  return hits;
}
function slashFx(arcLen: number, tilt: number, mirror: boolean, color: string, y = 1.2, big = 1) {
  const m = arcLen / 2; slash.position.set(P.pos.x + Math.sin(P.yaw) * 0.4, P.pos.y + y, P.pos.z + Math.cos(P.yaw) * 0.4); slash.rotation.y = mirror ? P.yaw + PI / 2 + m : P.yaw - PI / 2 - m; slashMesh.rotation.x = -PI / 2 + tilt; slashMesh.scale.set(mirror ? -big : big, big, big); (slashMesh.material as THREE.MeshStandardMaterial).emissive.set(color); slash.visible = true; slashT = 0.16;
}
function updateAttack(dt: number) {
  const w = wstats(); void scene; const p = P.actionT / P.actionDur; const k = P.atkKind; const dmgBase = S.atk * w.dmg * formMul();
  if (k === 'flurry') {
    const n = Math.floor(p * 6); while (P.atkIdx < n) { P.atkIdx++; meleeHit(w.reach * 1.15, 2.6, S.atk * 0.9 * formMul(), { stun: 0.25 }); slashFx(PI * 0.85, (P.atkIdx % 2 ? 0.6 : -0.6), P.atkIdx % 2 === 0, w.color, 1.2, 1.1); audio.sfx('swing'); if (P.atkIdx === 6) { meleeHit(w.reach * 1.4, 3, S.atk * 1.6 * formMul(), { big: true }); fx.ring(P.pos.x, P.pos.y + 0.5, P.pos.z, w.color, 7, 0.5); } }
    P.vel.x = approach(P.vel.x, Math.sin(P.yaw) * 5, 60 * dt); P.vel.z = approach(P.vel.z, Math.cos(P.yaw) * 5, 60 * dt); return;
  }
  if (!P.hitDone && p >= P.hitT) {
    P.hitDone = true;
    if (k === 'heavy') { const h = meleeHit(w.reach * 1.25, 2.8, dmgBase * 3, { big: true, stun: 0.6 }); slashFx(PI * 0.9, 0.9, false, w.color, 1.1, 1.4); fx.ring(P.pos.x + Math.sin(P.yaw) * 3, P.pos.y + 0.3, P.pos.z + Math.cos(P.yaw) * 3, '#ff6a2a', 8, 0.5); audio.sfx('slam'); shake(0.3); destroyAt(P.pos.x + Math.sin(P.yaw) * 4, P.pos.y, P.pos.z + Math.cos(P.yaw) * 4, 3.5, (d) => fx.burst(d.x, d.y, d.z, d.color, 12, 8, 0.7, 0.8, 12, 5)); void h; }
    else if (k === 'aerial') { meleeHit(6.5, 6.3, dmgBase * 1.4, { aoe: true, big: true }); slashFx(PI * 0.9, 0, false, w.color, 1.2, 1.5); fx.ring(P.pos.x, P.pos.y + 1, P.pos.z, w.color, 6.5, 0.4); }
    else if (w.type === 'staff') { aimTarget(_b); _a.copy(_b).sub(chest(_c)).normalize(); spawnProj({ x: P.pos.x, y: P.pos.y + 1.6, z: P.pos.z, dir: _a, speed: 62, dmg: dmgBase * 1.3, team: 'ally', color: '#3ff0ff', kind: 'bolt', radius: 0.55, aoe: 3.5, turn: 3, tgt: softLock(), owner: null }); audio.sfx('magic'); fx.burst(P.pos.x, P.pos.y + 1.6, P.pos.z, '#3ff0ff', 12, 6, 0.5, 0.4); }
    else { const c = P.combo; meleeHit(w.reach, w.arc, dmgBase * (1 + (c - 1) * 0.22), { big: c === 3, stun: c === 3 ? 0.5 : 0.18 }); slashFx(w.type === 'spear' ? PI * 0.4 : PI * 0.85, c === 1 ? 0.7 : c === 2 ? -0.5 : 0.1, c === 2, w.color, 1.2, w.type === 'greatsword' ? 1.35 : w.type === 'spear' ? 1.6 : 1); if (c === 3) destroyAt(P.pos.x + Math.sin(P.yaw) * 3, P.pos.y, P.pos.z + Math.cos(P.yaw) * 3, 2.5, (d) => fx.burst(d.x, d.y, d.z, d.color, 10, 7, 0.6, 0.7, 12, 4)); }
  }
}
function endAction() {
  const was = P.action; P.action = 'none'; if (was === 'attack') { if (P.atkKind === 'light') { P.comboT = 0.75; if (P.queued) { P.queued = false; startAttack('light'); } } } else if (was === 'land') { /* */ }
}

// ------------------------------------------------------------ abilities
function castFireball() {
  if (!canCast('fireball')) return; P.mana -= 15; setCd('fireball'); startAction('cast', 'cast', 0.42); audio.sfx('fireball'); P.yaw = Math.atan2(R.camDir.x, R.camDir.z); const tgt = softLock(); aimTarget(_b);
  const n = P.form ? 3 : 1; for (let i = 0; i < n; i++) { _a.copy(_b).sub(chest(_c)).normalize(); if (n > 1) _a.applyAxisAngle(new V3(0, 1, 0), (i - 1) * 0.22); spawnProj({ x: P.pos.x + Math.sin(P.yaw) * 1.2, y: P.pos.y + 1.7, z: P.pos.z + Math.cos(P.yaw) * 1.2, dir: _a, speed: 52, dmg: S.atk * 3.2 * formMul(), team: 'ally', color: '#ff6a1a', kind: 'fireball', radius: 1.0, aoe: 7.5, turn: 3.5, tgt, owner: null, life: 5 }); }
  fx.burst(P.pos.x + Math.sin(P.yaw), P.pos.y + 1.7, P.pos.z + Math.cos(P.yaw), '#ff9a3a', 25, 8, 0.7, 0.5); fx.ring(P.pos.x + Math.sin(P.yaw) * 1.5, P.pos.y + 1.7, P.pos.z + Math.cos(P.yaw) * 1.5, '#ff6a1a', 3, 0.35, 0.3, true, P.yaw);
}
function beginBeam() { if (P.action !== 'none' && P.action !== 'attack') return; if (!canCast('beam')) return; P.mana -= 10; startAction('charge', 'charge', 99); P.beam.charging = 0.001; P.beam.active = 0; audio.sfx('charge'); }
function endBeam() { P.beam.charging = 0; P.beam.active = 0; audio.beam(false); beamCore.visible = beamGlow.visible = beamEnd.visible = false; setCd('beam'); if (P.action === 'charge') P.action = 'none'; }
function updateBeam(dt: number) {
  const b = P.beam; if (!b.charging && !b.active) return; P.yaw = turnTo(P.yaw, Math.atan2(R.camDir.x, R.camDir.z), dt * 12);
  if (!R.mouse[2] && !R.keys.has('KeyR') || P.dead > 0) { endBeam(); return; }
  chest(_a); _a.x += Math.sin(P.yaw) * 0.9; _a.z += Math.cos(P.yaw) * 0.9;
  if (!b.active) { b.charging += dt; fx.burst(_a.x, _a.y, _a.z, '#ff5a7a', 2, 6, 0.5, 0.3); if (Math.floor(b.charging * 10) !== Math.floor((b.charging - dt) * 10)) fx.ring(_a.x, _a.y, _a.z, '#ff2d55', 0.6, 0.3, 4, true, P.yaw); if (b.charging >= 0.8) { b.active = 0.001; audio.beam(true); audio.sfx('explode'); shake(0.4); } return; }
  b.active += dt; P.mana -= 22 * dt; if (P.mana <= 0 || b.active > 4) { endBeam(); return; }
  aimTarget(_b); _d.copy(_b).sub(_a).normalize(); let L = 95; for (let s = 4; s < 95; s += 3) { const x = _a.x + _d.x * s, y = _a.y + _d.y * s, z = _a.z + _d.z * s; if (y < groundAt(x, y, z) + 0.2 || pointBlocked(x, y, z, 0.1)) { L = s; break; } }
  const mid = _c.copy(_a).addScaledVector(_d, L / 2); const q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), _d); const pulse = 1 + Math.sin(R.time * 40) * 0.12;
  beamCore.position.copy(mid); beamCore.quaternion.copy(q); beamCore.scale.set(0.55 * pulse, L, 0.55 * pulse); beamGlow.position.copy(mid); beamGlow.quaternion.copy(q); beamGlow.scale.set(1.5 * pulse, L, 1.5 * pulse);
  const end = _b.copy(_a).addScaledVector(_d, L); beamEnd.position.copy(end); beamEnd.scale.setScalar(2.4 * pulse); beamCore.visible = beamGlow.visible = beamEnd.visible = true; shake(0.12);
  fx.burst(end.x, end.y, end.z, '#ff8a6a', 4, 14, 0.8, 0.5, 6, 4); fx.burst(_a.x + _d.x * (Math.random() * L), _a.y + _d.y * (Math.random() * L), _a.z + _d.z * (Math.random() * L), '#ff2d55', 1, 3, 0.8, 0.4);
  b.tick -= dt; if (b.tick <= 0) {
    b.tick = 0.1; const dmg = S.atk * 0.5 * formMul();
    for (const e of R.ents) { if (e.team !== 'enemy' || e.state === 'dead' || e.kind === 'citizen' || e.kind === 'commander' || (e.friendly && e.kind !== 'dummy')) continue; _c.set(e.pos.x - _a.x, e.pos.y + e.height * 0.5 - _a.y, e.pos.z - _a.z); const t = Math.max(0, Math.min(L, _c.dot(_d))); const dist = _c.sub(_d.clone().multiplyScalar(t)).length(); if (dist < e.radius + 2.4) hurtEnt(e, dmg, _a.set(_d.x, 0, _d.z).multiplyScalar(2), { fromPlayer: true, stun: 0.1 }); }
    let cnt = 0; for (let s = 6; s < L + 4; s += 7) { destroyAt(_a.x + _d.x * s, _a.y + _d.y * s, _a.z + _d.z * s, 6, (d) => { if (cnt++ < 6) fx.burst(d.x, d.y, d.z, d.color, 10, 9, 0.7, 0.8, 12, 5); }); }
  }
}
function castTeleport() {
  if (!canCast('teleport')) return; P.mana -= 10; setCd('teleport'); const ix = (R.keys.has('KeyD') ? 1 : 0) - (R.keys.has('KeyA') ? 1 : 0), iz = (R.keys.has('KeyW') ? 1 : 0) - (R.keys.has('KeyS') ? 1 : 0);
  const sy = Math.sin(P.camYaw), cy = Math.cos(P.camYaw); let dx = sy * iz - cy * ix, dz = cy * iz + sy * ix; if (!ix && !iz) { dx = R.camDir.x; dz = R.camDir.z; } const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
  const lock = softLock(45, 0.9); const sx = P.pos.x, sz = P.pos.z, sy0 = P.pos.y; let tx: number, tz: number;
  if (lock) { const a = Math.atan2(lock.pos.x - P.pos.x, lock.pos.z - P.pos.z); tx = lock.pos.x - Math.sin(a) * (lock.radius + 2.2); tz = lock.pos.z - Math.cos(a) * (lock.radius + 2.2); P.yaw = a; }
  else { let d = 0; for (; d < 30; d += 2) { if (pointBlocked(sx + dx * (d + 2), P.pos.y + 1, sz + dz * (d + 2), 0.8)) break; } tx = sx + dx * d; tz = sz + dz * d; P.yaw = Math.atan2(dx, dz); }
  const dist = Math.hypot(tx - sx, tz - sz); for (let i = 0; i <= dist; i += 1.6) { const t = i / Math.max(dist, 0.1); const x = sx + (tx - sx) * t, z = sz + (tz - sz) * t; const y = sy0; fx.blob(x, y + 1, z, '#6a2aff', 1.6, 0.7 + t * 0.3, 0.8); fx.burst(x, y + 1, z, '#2a0a4a', 3, 4, 1.2, 0.8); fx.burst(x, y + 1, z, '#b36bff', 2, 3, 0.5, 0.6); if (i % 4 < 1.6) dmgRadius(x, y, z, 3, S.atk * 1.4 * formMul(), 'enemy', { fromPlayer: true, stun: 0.3 }); }
  fx.ring(sx, sy0 + 1, sz, '#8a4bff', 5, 0.5); P.pos.x = tx; P.pos.z = tz; if (!P.flying) { P.pos.y = Math.max(P.pos.y, groundAt(tx, P.pos.y, tz)); } resolve(P.pos, 0.6); fx.ring(P.pos.x, P.pos.y + 1, P.pos.z, '#b36bff', 6, 0.5); fx.burst(P.pos.x, P.pos.y + 1, P.pos.z, '#8a4bff', 30, 10, 0.8, 0.6);
  P.invuln = Math.max(P.invuln, 0.35); audio.sfx('teleport'); startAction('cast', 'cast', 0.25); P.vel.multiplyScalar(0.3);
}
function castCataclysm() {
  if (!canCast('cataclysm') || P.action === 'ult' || P.action === 'transform') return; P.mana -= 80; setCd('cataclysm'); P.beam.charging = 0; endBeam(); startAction('ult', 'ultimate', 3.2); P.ult = { t: 0, fired: false }; P.invuln = 3.4; P.vel.set(0, P.flying ? 0 : P.vel.y, 0); audio.sfx('cataclysm'); R.cine = { kind: 'ult', t: 0, dur: 3.6 };
}
function updateUlt(dt: number) {
  const t = P.actionT; P.vel.x *= 0.9; P.vel.z *= 0.9; const cx = P.pos.x, cy = P.pos.y + 14, cz = P.pos.z;
  if (t < 2.0) { const k = t / 2.0; fx.blob(cx, cy, cz, '#ff1a1a', 3 + k * 7, 0.12, 2 + k * 6); fx.burst(cx, cy, cz, '#ff4a2a', 4, 5, 0.8, 0.5); if (Math.floor(t * 6) !== Math.floor((t - dt) * 6)) fx.ring(cx, cy, cz, '#ff2a2a', 2, 0.9, 30 - k * 10); P.pos.y += (P.flying ? 0 : Math.min(dt * 1.2, 1.6 - (P.pos.y - groundAt(P.pos.x, P.pos.y, P.pos.z)))); shake(0.1 + k * 0.2); }
  if (t >= 2.0 && !P.ult.fired) {
    P.ult.fired = true; const gy = groundAt(P.pos.x, P.pos.y, P.pos.z);
    dmgRadius(P.pos.x, gy, P.pos.z, 62, S.atk * 14 * formMul(), 'enemy', { fromPlayer: true, big: true, kb: 34, stun: 1.5 }); let n = 0; destroyAt(P.pos.x, gy, P.pos.z, 62, (d) => { if (n++ < 70) fx.burst(d.x, d.y, d.z, d.color, 8, 16, 0.9, 1, 14, 8); });
    fx.blob(P.pos.x, gy + 8, P.pos.z, '#ff3a1a', 62, 1.0, 4); fx.blob(P.pos.x, gy + 4, P.pos.z, '#ffffff', 34, 0.5, 3); for (let i = 0; i < 4; i++) fx.ring(P.pos.x, gy + 0.5 + i, P.pos.z, i % 2 ? '#ff8a2a' : '#ff2a2a', 100, 1.2 + i * 0.2, 2);
    fx.burst(P.pos.x, gy + 2, P.pos.z, '#ff6a2a', 220, 60, 1.6, 1.8, 12, 20); fx.burst(P.pos.x, gy + 2, P.pos.z, '#ffd24a', 100, 40, 1.2, 1.4, 6, 14); shake(1.6); R.timeScale = 0.3; setTimeout(() => { R.timeScale = 1; }, 700);
    useGame.getState().setFlash('#ffffff'); setTimeout(() => useGame.getState().setFlash(null), 450); audio.sfx('explode');
  }
}
function toggleForm() {
  if (P.action === 'ult' || P.action === 'transform') return;
  if (P.form) { if (cdOf('form') > 0) return; setFormNow(false); setCd('form'); startAction('cast', 'cast', 0.6); fx.ring(P.pos.x, P.pos.y + 1, P.pos.z, '#e8c24a', 8, 0.6); audio.sfx('magic'); return; }
  if (!canCast('form')) return; P.mana -= 40; setCd('form'); startAction('transform', 'transform', 2.5); P.invuln = 2.6; audio.sfx('transform'); R.cine = { kind: 'transform', t: 0, dur: 2.8 }; P.vel.multiplyScalar(0.1);
}
function updateTransform(dt: number) {
  const t = P.actionT; if (t < 1.5) { if (Math.floor(t * 8) !== Math.floor((t - dt) * 8)) fx.ring(P.pos.x, P.pos.y + 0.5, P.pos.z, '#ff2a3a', 1.5, 0.8, 9); fx.burst(P.pos.x, P.pos.y + 1, P.pos.z, '#ff2a4a', 3, 4, 0.6, 0.6, -2); shake(0.15); }
  if (t >= 1.5 && !P.ult.fired) { P.ult.fired = true; setFormNow(true); fx.blob(P.pos.x, P.pos.y + 1.2, P.pos.z, '#ff2a3a', 12, 0.7); fx.ring(P.pos.x, P.pos.y + 0.4, P.pos.z, '#ffd24a', 30, 0.9); fx.ring(P.pos.x, P.pos.y + 0.4, P.pos.z, '#ff2a3a', 20, 0.7); fx.burst(P.pos.x, P.pos.y + 1.5, P.pos.z, '#ff4a2a', 120, 28, 1.2, 1.2, -2, 6); shake(0.9); audio.sfx('roar'); dmgRadius(P.pos.x, P.pos.y, P.pos.z, 14, S.atk * 2, 'enemy', { fromPlayer: true, kb: 24, stun: 0.8, big: true }); useGame.getState().toast('AWAKENED DEMON FORM', 'epic'); }
}
function summonArmy() {
  if (!canCast('army')) return; P.mana -= 50; setCd('army'); startAction('cast', 'cast', 0.6); const fx0 = P.pos.x + Math.sin(P.yaw) * 14, fz0 = P.pos.z + Math.cos(P.yaw) * 14; portal = { t: 0, x: fx0, z: fz0, y: groundAt(fx0, P.pos.y, fz0) }; audio.sfx('portal'); setTimeout(() => audio.sfx('horn'), 500);
  const roster: ('infantry' | 'knights' | 'mages' | 'elite' | 'archers')[] = ['infantry', 'infantry', 'infantry', 'infantry', 'infantry', 'infantry', 'knights', 'knights', 'knights', 'archers', 'mages', 'elite']; if (P.form) roster.push('elite', 'knights');
  roster.forEach((u, i) => setTimeout(() => { if (!R.ready) return; const a = (i / roster.length) * PI * 2, r = 3 + (i % 3) * 1.5; const x = fx0 + Math.cos(a) * r, z = fz0 + Math.sin(a) * r; const e = spawnAlly(u, x, z, { expire: 75, weight: 12, kind: 'summon', divId: 'summon', slot: i }); e.aggro = 70; fx.burst(x, e.pos.y + 1, z, '#ff2a4a', 14, 8, 0.7, 0.6); fx.ring(x, e.pos.y + 0.3, z, '#ff2a4a', 3, 0.5); }, 400 + i * 90));
  useGame.getState().toast('Demon Army summoned!', 'good');
}
function summonDragon() {
  if (!canCast('dragon')) return; if (R.dragonAlive) { useGame.getState().toast('A dragon already answers your call'); return; } P.mana -= 70; setCd('dragon'); startAction('cast', 'cast', 0.7); audio.sfx('roar'); spawnDragonAlly(); R.cine = { kind: 'dragon', t: 0, dur: 2.2 }; fx.ring(P.pos.x, P.pos.y + 1, P.pos.z, '#ffb347', 14, 0.8); useGame.getState().toast('Dragon summoned!', 'good');
}
function flurry() { if (cdOf('flurry') > 0 || (P.action !== 'none' && P.action !== 'attack') || P.dead > 0) return; setCd('flurry'); P.atkKind = 'flurry'; P.atkIdx = 0; P.queued = false; const tgt = nearestEnemy(P.pos.x, P.pos.z, 10); if (tgt) P.yaw = Math.atan2(tgt.pos.x - P.pos.x, tgt.pos.z - P.pos.z); else if (!P.flying) P.yaw = Math.atan2(R.camDir.x, R.camDir.z); startAction('attack', 'flurry', 1.5); }
function dodge(ix: number, iz: number) {
  if (P.stamina < 15 || (P.action !== 'none' && !(P.action === 'attack' && P.actionT / P.actionDur > 0.5)) || P.dead > 0) return; P.stamina -= 15; const sy = Math.sin(P.camYaw), cy = Math.cos(P.camYaw); let dx = sy * iz - cy * ix, dz = cy * iz + sy * ix; let back = 1; if (!ix && !iz) { dx = -Math.sin(P.yaw); dz = -Math.cos(P.yaw); back = -1; } const l = Math.hypot(dx, dz) || 1;
  P.vel.x = (dx / l) * 28; P.vel.z = (dz / l) * 28; if (P.flying) P.vel.y = 0; startAction('dodge', 'dodge', 0.4); P.invuln = 0.4; P.beam.charging = 0; if (back === -1) P.actionAnim = 'dodge'; fx.burst(P.pos.x, P.pos.y + 1, P.pos.z, '#8a4bff', 14, 8, 0.6, 0.4); audio.sfx('wing'); P.dir.set(dx / l, 0, dz / l);
}
function startFlight() { if (P.flying || P.swimming || P.dungeon || P.seated) return; P.flying = true; P.onGround = false; P.vel.y = Math.max(P.vel.y, 9); startAction('takeoff', 'takeoff', 0.55); fx.ring(P.pos.x, P.pos.y + 0.2, P.pos.z, '#ff4a6a', 7, 0.6); fx.burst(P.pos.x, P.pos.y + 0.5, P.pos.z, '#ff8a9a', 20, 9, 0.7, 0.6, 2, 4); audio.sfx('wing'); }

// ------------------------------------------------------------ interactions
type Cand = { label: string; run: () => void; d: number };
function nearestInteract(): Cand | null {
  const gs = useGame.getState(); let best: Cand | null = null; const consider = (d: number, label: string, run: () => void) => { if (!best || d < best.d) best = { d, label, run }; };
  for (const it of W.interactables) {
    const dx = it.x - P.pos.x, dz = it.z - P.pos.z, dy = it.y - P.pos.y; if (dx * dx + dz * dz > it.r * it.r || Math.abs(dy) > 8) continue; const d = Math.hypot(dx, dz) / it.r;
    if (it.kind === 'chest' && gs.chests.includes(it.id)) continue; if ((it.kind === 'dungeon_up' || it.kind === 'treasure') !== P.dungeon && it.kind !== 'chest' && it.kind !== 'banner' && it.kind !== 'commander' && ['dungeon_up', 'treasure', 'dungeon_down', 'table', 'throne', 'council'].includes(it.kind)) continue;
    if (it.kind === 'banner') { const t = terrDef(gs, it.data!); const own = gs.terr[it.data!]?.owner; const lbl = own === 'demon' ? `${t.name} — manage territory` : `Claim ${t.name} (${R.terrKills[t.id] >= 8 ? 'cleared' : 'defend: ' + Math.floor(R.terrKills[t.id] ?? 0) + '/8 slain'})`; consider(d, lbl, () => interactBanner(it.data!)); continue; }
    consider(d, it.label, () => runInteract(it.kind, it.id, it.data));
  }
  for (const e of R.ents) {
    if (!(e.kind === 'general' || e.kind === 'commander' || e.kind === 'citizen')) continue; const dx = e.pos.x - P.pos.x, dz = e.pos.z - P.pos.z; if (dx * dx + dz * dz > 20 || Math.abs(e.pos.y - P.pos.y) > 6) continue; const d = Math.hypot(dx, dz) / 4.5;
    if (e.kind === 'general') consider(d - 0.3, `Speak with ${e.name}, ${GEN_TITLE(e.gid!)}`, () => talkGeneral(e.gid!)); else if (e.kind === 'commander') consider(d - 0.3, `Speak with ${e.name}`, () => talkCommander(e.gid!)); else consider(d, `Talk to ${e.name}`, () => talkCitizen(e.name));
  }
  return best;
}
import { COMMANDERS, GEN_BY_ID, GENERALS, QUESTS } from './data';
const GEN_TITLE = (id: string) => GEN_BY_ID[id].title;
function talkGeneral(id: string) { const g = GEN_BY_ID[id]; const gs = useGame.getState(); gs.openDialogue({ id, kind: 'general', name: g.name, title: g.title, color: g.color, lines: g.lines }); document.exitPointerLock?.(); gs.setGeneral(id, { bond: Math.min(100, gs.generals[id].bond + 0.5) }); audio.sfx('ui'); }
function talkCommander(id: string) { const c = COMMANDERS.find((x) => x.id === id)!; const gs = useGame.getState(); gs.openDialogue({ id, kind: 'commander', name: c.name, title: c.title, color: c.color, lines: c.lines }); document.exitPointerLock?.(); }
const CIT = ['The Demon Lord walks among us! Long may you reign!', 'They say the Humans are gathering at Stormwatch... but they would not dare.', 'Business is good since the conquest of the south. Gold, my Lord, gold everywhere!', 'My son joined the Royal Guard. Blessed be your name!', 'I saw a dragon over the palace last night. Was that yours, Majesty?', 'The Celestials have a floating palace, they say. Pfft. Show-offs.'];
function talkCitizen(name: string) { const gs = useGame.getState(); gs.openDialogue({ id: 'cit', kind: 'npc', name, title: 'Subject of the Realm', color: '#ffb0b0', lines: [CIT[Math.floor(Math.random() * CIT.length)]] }); document.exitPointerLock?.(); }
function fade(cb: () => void) { const gs = useGame.getState(); gs.setFlash('#000000'); setTimeout(() => { cb(); gs.setFlash(null); }, 450); }
function runInteract(kind: string, id: string, data?: string) {
  const gs = useGame.getState(); audio.sfx('ui');
  switch (kind) {
    case 'table': gs.setMenu('command'); document.exitPointerLock?.(); break;
    case 'throne': P.seated = true; P.vel.set(0, 0, 0); P.pos.copy(W.throne); P.yaw = 0; P.camYaw = 0; gs.toast('You sit upon the Demon Throne. The realm is yours.', 'epic'); break;
    case 'council': { const on = !gs.councilOn; gs.summonCouncil(on); gs.toast(on ? 'The Royal Council convenes — all generals gather in the throne room.' : 'The council is dismissed.', 'good'); if (on) audio.sfx('horn'); break; }
    case 'dungeon_down': fade(() => { P.pos.set(0, DUNGEON.y + 0.1, 50); P.vel.set(0, 0, 0); P.yaw = PI; P.camYaw = PI; P.flying = false; }); break;
    case 'dungeon_up': fade(() => { P.pos.set(-27, 0.1, 33); P.vel.set(0, 0, 0); P.yaw = PI; P.camYaw = PI; R.dungeonSpawned = false; }); break;
    case 'treasure': gs.setMenu('treasure'); document.exitPointerLock?.(); break;
    case 'commander': talkCommander(data!); break;
    case 'chest': openChest(id); break;
  }
}
function openChest(id: string) {
  const gs = useGame.getState(); useGame.setState((s) => ({ chests: [...s.chests, id] })); const g = 800 + Math.floor(Math.random() * 1800), c = 50 + Math.floor(Math.random() * 150); gs.gain({ gold: g, crystals: c, mana: 60 }); gs.toast(`Treasure! +${g} gold, +${c} crystals`, 'epic'); audio.sfx('pickup');
  const pool = ITEMS.filter((i) => !gs.inventory.includes(i.id)); if (pool.length && Math.random() < 0.35) gs.addItem(pool[Math.floor(Math.random() * pool.length)].id); const w = W.interactables.find((i) => i.id === id); if (w) fx.burst(w.x, w.y + 1, w.z, '#ffd24a', 50, 12, 0.9, 1, 4, 6);
}
function interactBanner(tid: string) {
  const gs = useGame.getState(); const t = terrDef(gs, tid); const st = gs.terr[tid];
  if (st.owner === 'demon') { useGame.setState({ cmdTab: 'territories', selTerr: tid }); gs.setMenu('command'); document.exitPointerLock?.(); return; }
  const fs = gs.factions[st.owner]; if ((fs.state === 'peace' || fs.state === 'alliance') && st.owner !== 'ancient') { gs.toast(`The ${st.owner} are at ${fs.state} with you. Declare war before taking their land.`, 'bad'); return; }
  const k = R.terrKills[tid] ?? 0; if (k < 8) { gs.toast(`Slay the defenders first (${Math.floor(k)}/8) — or send an army to conquer it.`, 'bad'); return; }
  gs.setOwner(tid, 'demon'); gs.report('conquer', tid); gs.gain({ gold: 2500, crystals: 150 }); gs.toast(`${t.name} claimed for the Demon Realm!`, 'epic'); gs.addLog(`The Demon Lord personally conquered ${t.name}.`); updateBanners((id) => useGame.getState().terr[id]?.owner ?? 'demon'); audio.sfx('victory'); audio.sfx('horn');
  gs.setBanner(`${t.name.toUpperCase()} CONQUERED`); setTimeout(() => useGame.getState().setBanner(null), 4000); fx.ring(P.pos.x, P.pos.y + 1, P.pos.z, '#ff2a4a', 30, 1); fx.burst(P.pos.x, P.pos.y + 4, P.pos.z, '#ff2a4a', 80, 20, 1, 1.2, 4, 8); gs.addLog(''); R.terrKills[tid] = 0;
}

export const api = {
  summonGeneral(id: string) { const gs = useGame.getState(); if (GENERALS.every((g) => gs.generals[g.id].mode !== 'follow' || g.id === id)) {/* ok */} gs.setGeneral(id, { mode: 'follow', deployed: false }); gs.toast(`${GEN_BY_ID[id].name} answers your summons!`, 'good'); audio.sfx('portal'); },
  dismissGeneral(id: string) { useGame.getState().setGeneral(id, { mode: 'hq' }); },
  travelTo(x: number, z: number) {
    fade(() => { const y = Math.max(terrainHeight(x, z), 0) + (x < -100 && terrainHeight(x, z) < -2 ? 3 : 0); fx.burst(P.pos.x, P.pos.y + 1, P.pos.z, '#8a4bff', 40, 12, 0.8, 0.8); P.pos.set(x, terrainHeight(x, z) < -2 ? terrainHeight(x, z) + 4 : y + 0.5, z + 14); P.vel.set(0, 0, 0); P.flying = false; closeMenu(); fx.burst(P.pos.x, P.pos.y + 1, P.pos.z, '#8a4bff', 40, 12, 0.8, 0.8); audio.sfx('teleport'); });
  },
  establishOutpost(): boolean {
    const gs = useGame.getState(); if (P.dungeon) return false; for (const t of Object.keys(gs.terr)) { const d = terrDef(gs, t); if (Math.hypot(d.x - P.pos.x, d.z - P.pos.z) < 130) { gs.toast('Too close to another territory (need 130+ units).', 'bad'); return false; } }
    if (regionAt(P.pos.x, P.pos.z) === 'ocean' && P.pos.y < 0) { gs.toast('Cannot build underwater.', 'bad'); return false; }
    const ok = gs.establishOutpost(P.pos.x, P.pos.z); if (ok) { const o = useGame.getState().outposts[useGame.getState().outposts.length - 1]; buildFortress(o); updateBanners((id) => useGame.getState().terr[id]?.owner ?? 'demon'); fx.ring(P.pos.x, P.pos.y + 0.5, P.pos.z, '#ff2a4a', 25, 1); } return ok;
  },
  playerPos: () => ({ x: P.pos.x, z: P.pos.z, yaw: P.yaw }),
  entities: () => R.ents, closeMenu, resumeLock, quests: QUESTS, bossInfo: BOSS_BY_ID,
};

// ------------------------------------------------------------ player update
function respawn() { P.hp = S.hp; P.mana = S.mana; P.dead = 0; P.pos.set(0, 0, -22); P.vel.set(0, 0, 0); P.flying = false; P.invuln = 3; P.yaw = 0; P.camYaw = 0; const gs = useGame.getState(); gs.spend({ gold: Math.min(gs.res.gold, Math.floor(gs.res.gold * 0.05)) }); gs.toast('You rise again from the throne. Death is only an inconvenience to a Demon Lord.', 'info'); fx.burst(P.pos.x, P.pos.y + 1, P.pos.z, '#ff2a4a', 60, 14, 0.9, 1); if (R.boss) { R.boss.hp = R.boss.max; } }
function updatePlayer(dt: number) {
  const k = R.keys, pr = R.pressed; const gs = useGame.getState(); P.dungeon = P.pos.y < -40;
  for (const key in P.cd) if (P.cd[key] > 0) P.cd[key] = Math.max(0, P.cd[key] - dt);
  P.invuln = Math.max(0, P.invuln - dt); P.stunned = Math.max(0, P.stunned - dt); P.comboT = Math.max(0, P.comboT - dt);
  if (k.has('ArrowLeft')) P.camYaw += 2.4 * dt; if (k.has('ArrowRight')) P.camYaw -= 2.4 * dt; if (k.has('ArrowUp')) P.camPitch = Math.max(-0.6, P.camPitch - 1.6 * dt); if (k.has('ArrowDown')) P.camPitch = Math.min(1.35, P.camPitch + 1.6 * dt);
  if (P.dead > 0) { P.dead -= dt; P.anim = 'die'; P.animT += dt; animateRig(lord, 'die', R.time, 0, Math.min(1, (4 - P.dead) / 0.8), dt); lord.root.position.copy(P.pos); lord.root.rotation.y = P.yaw; if (P.dead <= 0) respawn(); return; }
  const maxHp = S.hp; P.hp = Math.min(maxHp, P.hp + (3 + maxHp * 0.002) * dt); P.mana = Math.min(S.mana, P.mana + (S.regen + 6 + (P.form ? 10 : 0)) * dt); const sprintKey = k.has('ShiftLeft') || k.has('ShiftRight');
  const ix = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0), iz = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0); const hasIn = ix !== 0 || iz !== 0;
  if (P.seated) { if (hasIn || pr.has('Space')) { P.seated = false; P.pos.set(0, 0, -30); } else { P.pos.copy(W.throne); P.yaw = turnTo(P.yaw, 0, dt * 4); animateRig(lord, 'idle', R.time, 0, 0, dt); lord.root.position.copy(P.pos); lord.root.rotation.y = P.yaw; pr.clear(); R.mousePressed[0] = R.mousePressed[1] = R.mousePressed[2] = false; return; } }
  // actions timers
  if (P.action !== 'none' && P.action !== 'charge') { P.actionT += dt; if (P.action === 'ult') updateUlt(dt); if (P.action === 'transform') updateTransform(dt); if (P.action === 'attack') updateAttack(dt); if (P.actionT >= P.actionDur) { if (P.action === 'ult' || P.action === 'transform') R.cine.t = Math.max(R.cine.t, R.cine.dur - 0.4); endAction(); } }
  if (P.action === 'slamdive') { P.vel.set(0, -52, 0); P.yaw = P.yaw; }
  // inputs
  const locked = P.action === 'ult' || P.action === 'transform'; const busy = locked || P.action === 'slamdive'; const canAct = !busy && P.stunned <= 0;
  if (canAct) {
    if (R.mousePressed[0]) { if (P.action === 'none' || (P.action === 'land') || (P.action === 'cast' && P.actionT > 0.2)) { if (P.action !== 'none') P.action = 'none'; startAttack('light'); } else if (P.action === 'attack' && P.atkKind === 'light') P.queued = true; }
    if (R.mousePressed[2] && (P.action === 'none' || P.action === 'land' || (P.action === 'attack' && P.actionT / P.actionDur > 0.55))) { P.action = 'none'; startAttack('heavy'); }
    if (pr.has('KeyE')) castFireball(); if (pr.has('KeyR') && !P.beam.charging) beginBeam(); if (pr.has('KeyQ')) castTeleport(); if (pr.has('KeyV')) castCataclysm(); if (pr.has('KeyT')) toggleForm(); if (pr.has('KeyG')) summonArmy(); if (pr.has('KeyX')) summonDragon(); if (pr.has('KeyF')) flurry();
    if (pr.has('KeyZ')) dodge(ix, iz); if (pr.has('KeyC')) { if (P.flying) { P.flying = false; } else startFlight(); } if (pr.has('KeyH') || pr.has('Enter')) { const c = nearestInteract(); if (c) c.run(); }
    if (R.mousePressed[1]) { /* middle: dodge */ dodge(ix, iz); }
  }
  if (P.beam.charging || P.beam.active) updateBeam(dt);
  // movement
  const sy = Math.sin(P.camYaw), cy = Math.cos(P.camYaw); let mx = sy * iz - cy * ix, mz = cy * iz + sy * ix; const ml = Math.hypot(mx, mz); if (ml > 0) { mx /= ml; mz /= ml; }
  const spdBonus = (1 + S.speed / 100) * (P.form ? 1.25 : 1); const slow = P.action === 'attack' ? 0.55 : P.action === 'cast' ? 0.5 : P.action === 'charge' ? 0.25 : locked ? 0 : 1;
  const wasGround = P.onGround; const chestY = P.pos.y + 1.0;
  const water = inWater(P.pos.x, chestY, P.pos.z) || (P.swimming && inWater(P.pos.x, chestY - 0.4, P.pos.z)); if (water && !P.swimming) { P.swimming = true; P.flying = false; P.vel.y *= 0.2; fx.ring(P.pos.x, 0.1, P.pos.z, '#bff0ff', 6, 0.6); } else if (!water && P.swimming) P.swimming = false;
  if (pr.has('Space')) { if (R.time - P.lastSpace < 0.32 && canAct && !P.flying && !P.swimming) startFlight(); else if (P.onGround && canAct && !P.flying && !P.swimming) { P.vel.y = 14; P.onGround = false; P.action = P.action === 'land' ? 'none' : P.action; fx.burst(P.pos.x, P.pos.y + 0.2, P.pos.z, '#8a6a7a', 8, 4, 0.5, 0.4); } else if (P.swimming && P.pos.y > -1.6 && !P.flying) { P.vel.y = 13; } P.lastSpace = R.time; }
  const ctrl = k.has('ControlLeft') || k.has('ControlRight'); const sprint = sprintKey && P.stamina > 4 && hasIn;
  if (P.flying) {
    const f3 = _a.set(R.camDir.x, R.camDir.y, R.camDir.z).normalize(); const sp = (sprintKey ? 78 : 34) * (P.form ? 1.45 : 1) * (1 + S.speed / 100) * slow; _b.set(0, 0, 0);
    if (iz) _b.addScaledVector(f3, iz); if (ix) _b.set(_b.x - cy * ix, _b.y, _b.z + sy * ix); if (_b.lengthSq() > 0) _b.normalize().multiplyScalar(sp); if (k.has('Space') && P.actionT > 0.2 || (k.has('Space') && P.action === 'none')) _b.y += 22; if (ctrl) _b.y -= 24;
    const acc = (hasIn || k.has('Space') || ctrl ? 60 : 36) * dt; P.vel.x = approach(P.vel.x, _b.x, acc); P.vel.y = approach(P.vel.y, _b.y, acc); P.vel.z = approach(P.vel.z, _b.z, acc);
    if (sprintKey && hasIn) P.stamina = Math.max(0, P.stamina - 3 * dt);
  } else if (P.swimming) {
    const f3 = _a.set(R.camDir.x, R.camDir.y, R.camDir.z).normalize(); const sp = (sprintKey ? 17 : 10) * (1 + S.speed / 100) * slow; _b.set(0, 0, 0); if (iz) _b.addScaledVector(f3, iz); if (ix) _b.set(_b.x - cy * ix, _b.y, _b.z + sy * ix); if (_b.lengthSq() > 0) _b.normalize().multiplyScalar(sp);
    if (k.has('Space')) _b.y += 7; if (ctrl) _b.y -= 7; if (!hasIn && !k.has('Space') && !ctrl) _b.y = Math.max(-1.2 - P.pos.y, -4) * 1.2 + 0.2; const acc = 30 * dt; P.vel.x = approach(P.vel.x, _b.x, acc); P.vel.y = approach(P.vel.y, _b.y, acc); P.vel.z = approach(P.vel.z, _b.z, acc);
  } else {
    const sp = (sprint ? 20 : 11.5) * spdBonus * slow; const air = !P.onGround; const acc = (hasIn ? (air ? 20 : 62) : (air ? 3 : 46)) * dt; const holding = P.action === 'dodge';
    if (!holding) { P.vel.x = approach(P.vel.x, mx * sp, acc); P.vel.z = approach(P.vel.z, mz * sp, acc); } else { P.vel.x *= 1 - dt * 3; P.vel.z *= 1 - dt * 3; }
    if (P.action !== 'slamdive') P.vel.y -= 36 * dt; if (sprint) P.stamina = Math.max(0, P.stamina - 7 * dt);
  }
  if (!sprintKey || !hasIn) P.stamina = Math.min(100, P.stamina + 26 * dt);
  P.pos.addScaledVector(P.vel, dt);
  // facing
  const hv = Math.hypot(P.vel.x, P.vel.z); P.speedNow = hv;
  if (P.action === 'none' || P.action === 'land' || P.action === 'takeoff') { if (P.flying) { if (hv > 3) P.yaw = turnTo(P.yaw, Math.atan2(P.vel.x, P.vel.z), dt * 8); else P.yaw = turnTo(P.yaw, P.camYaw, dt * 2); } else if (hasIn) P.yaw = turnTo(P.yaw, Math.atan2(mx, mz), dt * 14); }
  // collisions
  resolve(P.pos, 0.6, 1.9); const r = Math.hypot(P.pos.x, P.pos.z); if (r > MAX_R - 4) { P.pos.x *= (MAX_R - 4) / r; P.pos.z *= (MAX_R - 4) / r; }
  const gy = groundAt(P.pos.x, P.pos.y, P.pos.z);
  if (P.swimming) { P.onGround = false; if (P.pos.y < gy + 0.3) { P.pos.y = gy + 0.3; P.vel.y = Math.max(0, P.vel.y); } if (P.pos.y > -0.5) { P.pos.y = -0.5; P.vel.y = Math.min(P.vel.y, 0); } }
  else if (P.flying) { if (P.pos.y <= gy + 0.05) { P.pos.y = gy; if (ctrl || P.vel.y < -3) { P.flying = false; P.onGround = true; P.vel.y = 0; if (P.action === 'none') startAction('flyland', 'flyLand', 0.4); fx.burst(P.pos.x, P.pos.y + 0.3, P.pos.z, '#8a6a7a', 14, 6, 0.6, 0.5); } else P.vel.y = Math.max(0, P.vel.y); } if (P.pos.y > 420) { P.pos.y = 420; P.vel.y = 0; } }
  else {
    if (P.pos.y <= gy) { const fall = -P.vel.y; if (!wasGround && fall > 18) { if (P.action === 'slamdive') { slamImpact(); } else { startAction('land', 'land', 0.4); fx.burst(P.pos.x, gy + 0.3, P.pos.z, '#8a6a7a', 16, 7, 0.7, 0.5); if (fall > 30) shake(0.25); } } else if (P.action === 'slamdive') slamImpact(); P.pos.y = gy; P.vel.y = 0; P.onGround = true; } else if (P.pos.y - gy > 0.5 || P.vel.y > 0.5) P.onGround = false; else if (P.vel.y <= 0 && wasGround) { P.pos.y = gy; P.vel.y = 0; }
  }
  // animation
  let anim: Anim = 'idle'; let ap = 0; const hv2 = Math.min(1, hv / 18);
  if (P.action !== 'none' && P.action !== 'charge' && P.action !== 'slamdive') { anim = P.actionAnim; ap = Math.min(1, P.actionT / P.actionDur); if (P.action === 'dodge') ap = Math.min(1, P.actionT / P.actionDur); if ((P.action === 'takeoff' || P.action === 'flyland') && false) anim = 'fly'; }
  else if (P.action === 'charge') anim = 'charge'; else if (P.action === 'slamdive') { anim = 'slam'; ap = 0.5; }
  else if (P.flying) anim = hv > 6 ? 'fly' : 'flyIdle'; else if (P.swimming) anim = 'swim'; else if (!P.onGround) anim = P.vel.y > 0 ? 'jump' : 'fall';
  else if (hv > 14) anim = 'sprint'; else if (hv > 7.5) anim = 'run'; else if (hv > 0.8) anim = 'walk'; else anim = P.stunned > 0 ? 'hit' : 'idle';
  P.anim = anim; animateRig(lord, anim, R.time, hv2, ap, dt, anim === 'walk' ? Math.max(0.6, hv / 5.5) : anim === 'run' ? hv / 11 : anim === 'sprint' ? hv / 19 : 1);
  lord.root.position.copy(P.pos); if (P.swimming) lord.root.position.y -= 0.3; lord.root.rotation.y = P.yaw;
  if (P.flying && (anim === 'fly' || anim === 'flyIdle')) { lord.hips.rotation.x += Math.max(-0.5, Math.min(0.5, P.vel.y * 0.01)); wingT -= dt; if (wingT <= 0) { wingT = anim === 'fly' ? 0.45 : 0.9; audio.sfx('wing'); } }
  if (P.form) { formFxT -= dt; if (formFxT <= 0) { formFxT = 0.06; fx.burst(P.pos.x + (Math.random() - 0.5) * 1.2, P.pos.y + 0.3 + Math.random() * 2.2, P.pos.z + (Math.random() - 0.5) * 1.2, Math.random() > 0.5 ? '#ff2a3a' : '#ffb347', 1, 2, 0.5, 0.9, -3); } }
  if (P.flying && hv > 25) { fx.burst(P.pos.x, P.pos.y + 1, P.pos.z, '#ff6a8a', 1, 1, 0.5, 0.4); }
  if (slashT > 0) { slashT -= dt; const m = slashMesh.material as THREE.MeshStandardMaterial; m.opacity = Math.max(0, slashT / 0.16) * 0.9; slash.scale.setScalar(1 + (0.16 - slashT) * 3); if (slashT <= 0) slash.visible = false; }
}
function slamImpact() {
  const gy = groundAt(P.pos.x, P.pos.y, P.pos.z); P.action = 'none'; P.vel.set(0, 0, 0); const w = wstats();
  dmgRadius(P.pos.x, gy, P.pos.z, 13, S.atk * w.dmg * formMul() * 4, 'enemy', { fromPlayer: true, big: true, kb: 22, stun: 1 }); destroyAt(P.pos.x, gy, P.pos.z, 12, (d) => fx.burst(d.x, d.y, d.z, d.color, 10, 10, 0.8, 0.9, 14, 6));
  fx.ring(P.pos.x, gy + 0.4, P.pos.z, '#ff8a2a', 14, 0.7, 1); fx.ring(P.pos.x, gy + 0.6, P.pos.z, '#ffffff', 9, 0.5, 1); fx.burst(P.pos.x, gy + 0.5, P.pos.z, '#ff8a2a', 60, 20, 1.1, 0.9, 10, 6); audio.sfx('slam'); shake(0.9); startAction('land', 'land', 0.5);
}

// ------------------------------------------------------------ camera
function updateCamera(dt: number) {
  const st = useGame.getState().settings; const c = R.cine; let distMul = 1, fovT = 65 + (P.flying && P.speedNow > 40 ? 16 : P.speedNow > 15 ? 6 : 0) + (P.beam.active ? 4 : 0), yawD = 0, pitchAdd = 0, hOff = 0;
  if (c.kind) { c.t += dt; const w = Math.sin(Math.min(1, c.t / c.dur) * PI); if (c.kind === 'ult') { distMul = 1 + 1.1 * w; fovT = 65 + 16 * w; yawD = 0.5 * dt * w; pitchAdd = 0.15 * w; } else if (c.kind === 'transform') { distMul = 1 - 0.45 * w; fovT = 65 - 8 * w + (c.t > 1.5 ? 20 * Math.sin(Math.min(1, (c.t - 1.5)) * PI) : 0); hOff = 0.2 * w; } else if (c.kind === 'boss') { distMul = 1 + 0.9 * w; yawD = 0.25 * dt * w; fovT = 72; } else if (c.kind === 'bossdeath') { distMul = 1.5; yawD = 0.5 * dt; } else if (c.kind === 'dragon') { distMul = 1 + 0.7 * w; pitchAdd = -0.15 * w; } if (c.t >= c.dur) c.kind = ''; }
  P.camYaw += yawD; R.fov += (fovT - R.fov) * Math.min(1, dt * 4); camera.fov = R.fov; camera.updateProjectionMatrix();
  const dist = st.camDist * distMul * (P.flying ? 1.15 : 1); const pitch = Math.max(-0.6, Math.min(1.4, P.camPitch + pitchAdd)); const tgt = _a.set(P.pos.x, P.pos.y + 1.75 + hOff, P.pos.z);
  const cp = Math.cos(pitch), spn = Math.sin(pitch); _b.set(-Math.sin(P.camYaw) * cp, spn, -Math.cos(P.camYaw) * cp);
  const shoulder = c.kind ? 0 : 0.9; const rx = -Math.cos(P.camYaw) * -1 * 0, rz = 0; void rx; void rz; const right = _c.set(-Math.cos(P.camYaw), 0, Math.sin(P.camYaw)); const origin = _d.copy(tgt).addScaledVector(right, shoulder * Math.min(1, dist / 5));
  const dx = _b.x * dist, dy = _b.y * dist, dz = _b.z * dist; const free = rayFree(origin.x, origin.y, origin.z, origin.x + dx, origin.y + dy, origin.z + dz); const dd = Math.max(0.6, dist * free - 0.4);
  const want = new V3(origin.x + _b.x * dd, origin.y + _b.y * dd, origin.z + _b.z * dd); const gyc = groundAt(want.x, want.y, want.z); if (want.y < gyc + 0.5 && want.y > -40) want.y = gyc + 0.5;
  camera.position.lerp(want, free < 1 ? 1 : Math.min(1, dt * 18)); R.camPos.copy(camera.position);
  if (R.shake > 0.001) { const s = R.shake * 0.5; camera.position.x += (Math.random() - 0.5) * s; camera.position.y += (Math.random() - 0.5) * s; camera.position.z += (Math.random() - 0.5) * s; R.shake *= Math.pow(0.02, dt); }
  _b.copy(tgt).addScaledVector(right, shoulder * 0.5); camera.lookAt(_b.x, _b.y + 0.1, _b.z); camera.getWorldDirection(R.camDir); lord.root.visible = dd > 1.4;
  underwater = camera.position.y < -0.2 && camera.position.x < -100 && terrainHeight(camera.position.x, camera.position.z) < -0.4;
}

// ------------------------------------------------------------ main frame
export function frame(rawDt: number) {
  if (!R.ready) return; const gs = useGame.getState(); if (gs.screen !== 'playing') return; let dt = Math.min(rawDt, 0.05);
  if (gs.menu) { R.pressed.clear(); R.mousePressed.fill(false); R.paused = true; atmos.update(dt * 0.0, R.tod, P.pos, camera.position, underwater); return; } R.paused = false;
  R.timeScale += (1 - R.timeScale) * Math.min(1, rawDt * 0.5); if (R.timeScale > 0.995) R.timeScale = 1; dt *= R.timeScale; if (R.hitStop > 0) { R.hitStop -= rawDt; dt *= 0.08; }
  R.time += dt; R.tod = (R.tod + dt / 600) % 1;
  statT += dt; if (statT > 0.5) { statT = 0; statsFromStore(); applyEquipVisuals(); atmos.sun.castShadow = gs.settings.shadows; audio.setVol(gs.settings.music, gs.settings.sfx); }
  updatePlayer(dt); updateCamera(dt); updatePopulation(dt); updateEnts(dt, camera.quaternion); updateProjs(dt); fx.update(dt);
  if (portal) { portal.t += dt; if (Math.floor(portal.t * 8) !== Math.floor((portal.t - dt) * 8)) { fx.ring(portal.x, portal.y + 0.4, portal.z, '#ff2a4a', 9, 0.8, 4); fx.ring(portal.x, portal.y + 4, portal.z, '#ff8a2a', 6, 0.8, 1, true, P.yaw); } fx.burst(portal.x, portal.y + 2 + Math.random() * 4, portal.z, '#ff3a5a', 3, 5, 0.9, 0.6, -2); if (portal.t > 2.2) portal = null; }
  updateWorld(R.time, dt, camera.position);
  atmos.update(dt, R.tod, P.pos, camera.position, underwater);
  const reg = P.dungeon ? 'capital' : regionAt(P.pos.x, P.pos.z); let wk = underwater ? 'bubbles' : (REGION_BY_ID[reg]?.weather ?? 'none'); if (P.dungeon || (Math.abs(P.pos.x) < 38 && Math.abs(P.pos.z) < 47 && P.pos.y < 30 && reg === 'capital')) wk = 'none'; if (wk === 'rain' && ((R.time * 0.01) % 1) > 0.7) wk = 'none';
  weather.update(dt, camera.position, wk);
  if ((wk === 'rain' || wk === 'mist') && Math.random() < dt * 0.04) { atmos.flash = 1; setTimeout(() => audio.sfx('thunder'), 300 + Math.random() * 900); }
  // kingdom timers
  if (R.time - R.lastDay > 45) { R.lastDay = R.time; gs.tickDay(); gs.toast('A new day dawns — royal income awaits collection.', 'info'); }
  if (R.time - R.lastWorld > 20) { R.lastWorld = R.time; gs.tickWorld(R.time); }
  if (R.time - R.lastBanner > 2) { R.lastBanner = R.time; updateBanners((id) => useGame.getState().terr[id]?.owner ?? 'demon'); }
  if (R.time - R.lastAuto > 120) { R.lastAuto = R.time; if (gs.save(0)) gs.toast('Autosaved', 'info'); }
  // music
  musicT -= dt; if (musicT <= 0) { musicT = 1; let near = 0; for (const e of R.ents) if (e.team === 'enemy' && e.kind === 'unit' && e.state !== 'dead' && !e.friendly && Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z) < 36) near++; const inHall = Math.abs(P.pos.x) < 38 && Math.abs(P.pos.z) < 47 && P.pos.y < 30 && reg === 'capital' && !P.dungeon; const m = R.boss && R.boss.boss!.dying <= 0 ? 'boss' : near >= 2 ? 'battle' : underwater ? 'ocean' : inHall ? 'throne' : 'calm'; if (m !== curMusic) { curMusic = m; audio.music(m as 'calm'); } hudNear = near; }
  audio.wind(P.flying ? Math.min(0.2, 0.03 + P.speedNow * 0.003) : reg === 'dragon' || reg === 'frozen' ? 0.05 : 0.0, 400 + P.speedNow * 14);
  // hud
  hudT -= dt; if (hudT <= 0) { hudT = 0.1; pushHud(reg); }
  R.pressed.clear(); R.mousePressed.fill(false);
}
let hudNear = 0; let fpsAcc = 0, fpsN = 0, fpsVal = 60;
function pushHud(reg: string) {
  const gs = useGame.getState(); const cds: Record<string, number> = {}; for (const a of ABILITIES) cds[a.id] = a.cd > 0 ? (P.cd[a.id] ?? 0) / a.cd : 0; const c = nearestInteract(); const bo = R.boss && R.boss.boss && R.boss.boss.dying <= 0 ? R.boss : null;
  const inHall = Math.abs(P.pos.x) < 38 && Math.abs(P.pos.z) < 47 && P.pos.y < 30 && reg === 'capital' && !P.dungeon; const rname = P.dungeon ? 'Royal Dungeons' : inHall ? 'Royal Palace — Throne Room' : REGION_BY_ID[reg as 'capital'].name;
  let field = 0; for (const e of R.ents) if (e.team === 'ally' && (e.kind === 'unit' || e.kind === 'summon') && e.state !== 'dead') field++;
  gs.setHud({ hp: P.hp, maxHp: S.hp, mana: P.mana, maxMana: S.mana, stamina: P.stamina, region: rname, form: P.form, cds, flying: P.flying, swimming: P.swimming, boss: bo ? { name: bo.name, title: BOSS_BY_ID[bo.boss!.id].title, hp: bo.hp, max: bo.max, phase: bo.boss!.phase } : null, fieldCount: field, enemiesNear: hudNear, prompt: c ? c.label : null, combo: P.combo, fps: fpsVal, summonT: R.dragonAlive ? 1 : 0 });
}
export function fpsTick(dt: number) { fpsAcc += dt; fpsN++; if (fpsAcc > 1) { fpsVal = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; } }
export const getUnderwater = () => underwater;
export const tod = () => R.tod;
export { popup };
void refreshDivCache; void TERR_BY_ID;
