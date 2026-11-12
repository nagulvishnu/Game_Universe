import * as THREE from 'three';
import { rt, type EnemyRT, type Proj } from '../runtime';
import { G, fwd, angDiff, rand, clamp } from './ctx';
import { BOSSES, ENEMIES, type EnemyDef } from '../data/enemies';
import { buildRig } from './rig';
import { audio } from '../audio';
import { useHud, useStore } from '../store';
import { REGION_BY_ID } from '../data/regions';
import { STYLES } from '../data/styles';
import { CHAR_BY_ID } from '../data/characters';
import type { Status, StyleId } from '../types';

const bars = new Map<number, { back: THREE.Sprite; fill: THREE.Sprite }>();
const teles = new Map<number, ReturnType<NonNullable<typeof G.fx>['telegraph']>>();
const tv = new THREE.Vector3();

export function clearTele(e: EnemyRT) { const t = teles.get(e.id); if (t) { t.remove(); teles.delete(e.id); } }
export function setTele(e: EnemyRT, t: ReturnType<NonNullable<typeof G.fx>['telegraph']>) { clearTele(e); teles.set(e.id, t); }
export function getTele(e: EnemyRT) { return teles.get(e.id); }

export function spawnEnemy(typeId: string, pos: THREE.Vector3, o: { level?: number; tag?: string; retreat?: number } = {}): EnemyRT {
  const boss = BOSSES[typeId] ?? null; const def: EnemyDef = boss ?? ENEMIES[typeId];
  const reg = REGION_BY_ID[rt.region];
  const level = o.level ?? (boss ? boss.level : Math.max(1, reg.level + Math.floor(rand(-1, 2)) + (rt.nightMix > 0.5 ? 1 : 0)));
  const hpScale = boss ? 1 + 0.18 * (level - 1) : 1 + 0.25 * (level - 1);
  const model = buildRig(def.look, { outline: !!boss || def.scale > 1.1 || G.quality.density > 0.7, shadow: G.quality.shadows !== 'off', sword: false });
  model.group.scale.multiplyScalar(def.scale); model.group.position.copy(pos); G.ents.add(model.group);
  const e: EnemyRT = {
    id: rt.nextId++, def, boss, level, hp: def.hp * hpScale, maxHp: def.hp * hpScale, pos: pos.clone(), yaw: rand(0, 6.28), vel: new THREE.Vector3(),
    state: def.flags.ambush ? 'hidden' : 'idle', t: 0, atk: null, atkDone: false, cd: {}, posture: 0, maxPosture: def.posture, phase: 0, model, home: pos.clone(),
    wander: pos.clone(), wanderT: rand(0, 3), strafe: Math.random() < 0.5 ? 1 : -1, strafeT: 0, status: { poison: 0, burn: 0, slow: 0, stun: 0 }, regenT: 0, deadT: 0,
    aim: new THREE.Vector3(), from: new THREE.Vector3(), guardUp: false, sinceHit: 99, spawnT: 0, tag: o.tag ?? '', dmgMul: 1 + 0.14 * (level - 1), hitFlash: 0,
    retreatAt: o.retreat ?? 0, aggro: false, transT: 0, lastAtk: '', nextAtkT: rand(0.4, 1.2), dodgeT: 0, telegraph: 0,
  };
  if (def.flags.ambush) model.group.visible = false;
  if (!boss && !def.flags.dummy && !def.flags.static) {
    const back = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x000000, transparent: true, opacity: 0.65, depthTest: false })); const fill = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xe03040, transparent: true, depthTest: false }));
    back.renderOrder = 18; fill.renderOrder = 19; back.visible = fill.visible = false; G.ents.add(back, fill); bars.set(e.id, { back, fill });
  }
  rt.enemies.push(e); return e;
}

export function removeEnemy(e: EnemyRT) {
  clearTele(e); G.ents.remove(e.model.group); e.model.dispose();
  const b = bars.get(e.id); if (b) { G.ents.remove(b.back, b.fill); (b.back.material as THREE.Material).dispose(); (b.fill.material as THREE.Material).dispose(); bars.delete(e.id); }
  const i = rt.enemies.indexOf(e); if (i >= 0) rt.enemies.splice(i, 1);
  if (G.lastTarget === e) G.lastTarget = null; if (rt.bossRef === e) rt.bossRef = null;
}
export function clearEnemies(tag?: string) { [...rt.enemies].forEach((e) => { if (!tag || e.tag === tag) removeEnemy(e); }); }

export function updateBars() {
  const cam = G.camera!;
  rt.enemies.forEach((e) => {
    const b = bars.get(e.id); if (!b) return; const show = e.state !== 'dead' && e.hp < e.maxHp && e.state !== 'hidden';
    b.back.visible = b.fill.visible = show; if (!show) return;
    const h = 2.4 * e.def.scale; const r = Math.max(0.001, e.hp / e.maxHp); const w = 1.1;
    b.back.position.set(e.pos.x, e.pos.y + h, e.pos.z); b.back.scale.set(w, 0.12, 1);
    tv.set(1, 0, 0).applyQuaternion(cam.quaternion); b.fill.position.copy(b.back.position).addScaledVector(tv, -(w * (1 - r)) / 2); b.fill.scale.set(w * r, 0.08, 1);
    (b.fill.material as THREE.SpriteMaterial).color.setHex(e.status.poison > 0 ? 0xa060ff : e.state === 'stagger' ? 0xffd040 : 0xe03040);
  });
}

export function addStatus(e: EnemyRT, s: Status | undefined) {
  if (!s || e.def.flags.dummy) return;
  if (s === 'poison') e.status.poison = 5; if (s === 'burn') e.status.burn = 3.5; if (s === 'slow') e.status.slow = 2.5;
  if (s === 'stun' || s === 'shock') { if (!e.boss) staggerEnemy(e, s === 'stun' ? 1.2 : 0.6); else e.posture += 18; }
}

export function staggerEnemy(e: EnemyRT, dur: number) {
  if (e.state === 'dead') return; clearTele(e); e.state = 'stagger'; e.t = 0; e.transT = dur; e.posture = 0; e.atk = null; e.guardUp = false;
  G.fx!.number(tv.set(e.pos.x, e.pos.y + 2.4 * e.def.scale, e.pos.z), 'STAGGER', '#ffd040'); audio.sfx('clash');
}

export interface DmgOpts { kb?: number; dir?: THREE.Vector3; stagger?: number; crit?: boolean; status?: Status; style?: StyleId; heavy?: boolean; dot?: boolean; skill?: boolean; finisher?: boolean }

export function damageEnemy(e: EnemyRT, dmgIn: number, o: DmgOpts = {}): number {
  if (e.state === 'dead') return 0; const p = rt.player!; let dmg = dmgIn;
  const fxm = G.fx!; const top = tv.set(e.pos.x, e.pos.y + 1.7 * e.def.scale, e.pos.z).clone();
  if (e.def.flags.dummy) {
    const dps = rt.dummyDps; dps.dmg += dmg; dps.last = 0; if (dps.t <= 0) dps.t = 0.001; rt.dummyDps = dps;
    e.model.anim.pose = 'hurt'; e.model.anim.pt = 0; e.hitFlash = 0.5; e.model.flash(0.5);
    fxm.number(top, String(Math.round(dmg)), o.crit ? '#ffe14a' : '#ffffff', !!o.crit); fxm.sparks(top, 6, 0xffd080, 5); audio.sfx('hit');
    G.lastTarget = e; G.lastTargetT = 3; return dmg;
  }
  if (o.dot) { e.hp -= dmg; e.sinceHit = 0; if (e.hp <= 0) killEnemy(e); return dmg; }
  // guarding enemies block frontal non-heavy hits
  if (e.def.flags.guard && e.guardUp && o.dir) {
    const toP = Math.atan2(p.pos.x - e.pos.x, p.pos.z - e.pos.z);
    if (Math.abs(angDiff(e.yaw, toP)) < 1.3 && !o.heavy && !o.finisher) {
      dmg *= o.skill ? 0.5 : 0.1; audio.sfx('clash'); fxm.sparks(top, 10, 0xffffff, 6); fxm.number(top, 'GUARD', '#9ac8ff'); e.posture += (o.stagger ?? 8) * 0.5;
      e.hp -= dmg; e.sinceHit = 0; e.aggro = true; if (e.posture >= e.maxPosture) staggerEnemy(e, 2); return dmg;
    }
  }
  if (e.state === 'stagger' || e.state === 'recover') dmg *= e.state === 'stagger' ? 1.35 : 1.1;
  const reduce = 100 / (100 + e.def.def + e.level * 1.2); dmg *= reduce;
  e.hp -= dmg; e.sinceHit = 0; e.aggro = true; e.hitFlash = 1; e.model.flash(o.crit ? 0.9 : 0.55); e.regenT = 0;
  G.lastTarget = e; G.lastTargetT = 5;
  const st = o.style ? STYLES[o.style] : null; const col = st ? st.color : 0xffd8a0;
  fxm.number(top, String(Math.max(1, Math.round(dmg))), o.crit ? '#ffe14a' : o.finisher ? '#ff7a3a' : '#ffffff', !!o.crit || !!o.finisher);
  fxm.sparks(top, o.crit ? 14 : 8, o.crit ? 0xffee88 : col, 6); fxm.flash(top, col, o.crit ? 2.4 : 1.4, 0.12); if (e.def.look.demon !== false) fxm.blood(top, 5);
  if (st && o.skill) fxm.style(st, top, 6, 2);
  audio.sfx(o.crit ? 'crit' : 'hit');
  rt.hitstop = Math.max(rt.hitstop, o.heavy || o.crit || o.finisher ? 0.085 : 0.045); rt.shake = Math.max(rt.shake, o.heavy ? 0.45 : o.crit ? 0.35 : 0.18);
  // resource gain
  p.breath = Math.min(p.maxBreath, p.breath + (o.skill ? 2 : 6)); p.ult = Math.min(p.maxUlt, p.ult + (o.skill ? 1.5 : 4) + (e.boss ? 1 : 0)); p.regenDelay = 1.2;
  if (p.stats.steal > 0) p.hp = Math.min(p.maxHp, p.hp + dmg * p.stats.steal);
  if (p.stats.burn && Math.random() < 0.35) addStatus(e, 'burn'); if (p.stats.poison && Math.random() < 0.35) addStatus(e, 'poison');
  addStatus(e, o.status);
  // knockback
  const kbMul = e.boss ? 0.15 : e.def.scale > 1.3 ? 0.5 : 1; if (o.dir && o.kb) e.vel.addScaledVector(o.dir, o.kb * kbMul * 3);
  // posture
  const armor = e.boss ? 0.45 : e.def.flags.armor ? 0.5 : 1; e.posture += (o.stagger ?? 8) * armor;
  if (e.posture >= e.maxPosture && e.state !== 'stagger') staggerEnemy(e, e.boss ? 2.2 : 1.8);
  else if (!e.boss && e.state !== 'active' && e.state !== 'stagger' && e.state !== 'intro') { if (e.state === 'windup') { clearTele(e); e.atk = null; } e.state = 'recover'; e.t = 0; e.transT = o.heavy ? 0.6 : 0.3; e.model.anim.pose = 'hurt'; e.model.anim.pt = 0; }
  // retreat / death
  if (e.retreatAt > 0 && e.hp <= e.maxHp * e.retreatAt) { e.hp = e.maxHp * e.retreatAt; killEnemy(e, true); return dmg; }
  if (e.hp <= 0) killEnemy(e);
  return dmg;
}

export function killEnemy(e: EnemyRT, retreat = false) {
  if (e.state === 'dead') return; clearTele(e); e.state = 'dead'; e.deadT = 0; e.hp = Math.max(0, e.hp); e.model.anim.pose = 'dead'; e.model.anim.pt = 0;
  const p = rt.player!; const st = useStore.getState(); const fxm = G.fx!; const c = tv.set(e.pos.x, e.pos.y + 1, e.pos.z).clone();
  fxm.sparks(c, 20, 0xffffff, 8, 0.25, 0.7); fxm.flash(c, 0xffffff, 3, 0.25); fxm.ring(e.pos, 3, 0xffffff, 0.5);
  if (!e.def.flags.dummy) {
    const xp = Math.round(e.def.xp * (1 + (e.level - 1) * 0.2)); const sen = e.def.flags.static ? 0 : Math.round(5 + e.level * 2 + (e.boss ? e.maxHp / 20 : 0));
    st.addXp(xp); if (sen) st.addSen(sen); st.addKill(); fxm.number(c.clone().setY(c.y + 0.7), `+${xp} EXP`, '#9ae8ff');
    p.ult = Math.min(p.maxUlt, p.ult + (e.boss ? 30 : 8));
    const roll = Math.random();
    if (!e.def.flags.static && roll < (e.boss ? 1 : 0.14)) { const id = e.boss ? (Math.random() < 0.5 ? 'herb' : 'steel_shard') : roll < 0.07 ? 'rice_ball' : roll < 0.1 ? 'steel_shard' : 'tonic'; st.addItem(id); st.toast(`Obtained ${id.replace('_', ' ')}`, 'good'); audio.sfx('pickup'); }
    if (e.boss) {
      st.toast(retreat ? `${e.def.name} retreats from the battle!` : `${e.def.name} defeated!`, 'quest');
      rt.slowmo = 2.2; rt.shake = 1; fxm.ring(e.pos, 9, (e.boss.color), 1.2); fxm.ring(e.pos, 14, 0xffffff, 1.6, 0.2, 0.08); fxm.column(e.pos, e.boss.color, 1.6, 16, 1.4); audio.sfx('explosion');
      rt.cin = { ...rt.cin, active: true, t: 0, dur: 2.4, kind: 'finish', focus: e.id }; rt.cin.target.copy(e.pos);
      const prof = useStore.getState().profile; if (!prof.bosses.includes(e.def.id)) useStore.setState({ profile: { ...prof, bosses: [...prof.bosses, e.def.id] } });
      useHud.setState({ boss: null }); rt.bossRef = null;
    }
  }
  audio.sfx(e.boss ? 'death' : 'death');
  G.onKill?.(e);
}

// ---------------- projectiles ----------------
export function spawnProj(o: { pos: THREE.Vector3; dir: THREE.Vector3; speed: number; dmg: number; friendly: boolean; color: number; core?: number; kind?: 'slash' | 'blast'; size?: number; life?: number; pierce?: boolean; status?: string; kb?: number; style?: StyleId; radius?: number; owner?: number }) {
  const size = o.size ?? 0.6; const mesh = G.fx!.projMesh(o.kind ?? 'blast', o.color, o.core ?? 0xffffff, size);
  mesh.position.copy(o.pos); mesh.rotation.y = Math.atan2(o.dir.x, o.dir.z); G.ents.add(mesh);
  if (rt.projs.length > 90) removeProj(rt.projs[0]);
  rt.projs.push({ pos: o.pos.clone(), vel: o.dir.clone().normalize().multiplyScalar(o.speed), life: o.life ?? 2.5, radius: o.radius ?? size * (o.kind === 'slash' ? 1.4 : 1.0), dmg: o.dmg, friendly: o.friendly, color: o.color, pierce: !!o.pierce, status: o.status, mesh, hit: new Set(), style: o.style, kb: o.kb ?? 3, owner: o.owner ?? 0 });
}
function removeProj(p: Proj) {
  G.ents.remove(p.mesh); p.mesh.traverse((c) => { const m = c as THREE.Mesh; if (m.geometry) m.geometry.dispose(); if (m.material) (m.material as THREE.Material).dispose(); });
  const i = rt.projs.indexOf(p); if (i >= 0) rt.projs.splice(i, 1);
}
export function clearProjs() { [...rt.projs].forEach(removeProj); }

export function updateProjs(dt: number) {
  const p = rt.player!; const fxm = G.fx!;
  [...rt.projs].forEach((pr) => {
    pr.life -= dt; pr.pos.addScaledVector(pr.vel, dt); pr.mesh.position.copy(pr.pos);
    const gy = rt.hAt(pr.pos.x, pr.pos.z);
    if (pr.pos.y < gy + 0.3 && !pr.friendly) pr.pos.y = gy + 1.0; else if (pr.pos.y < gy + 0.2) pr.pos.y = gy + 0.8;
    if (Math.random() < 0.7) fxm.add.emit(pr.pos.x, pr.pos.y, pr.pos.z, rand(-0.3, 0.3), rand(-0.3, 0.3), rand(-0.3, 0.3), 0.3, 0.3, 0.02, pr.color, 0.8);
    if (pr.friendly) {
      for (const e of rt.enemies) {
        if (e.state === 'dead' || e.state === 'hidden' || pr.hit.has(e.id)) continue;
        const d = Math.hypot(pr.pos.x - e.pos.x, pr.pos.z - e.pos.z);
        if (d < pr.radius + e.def.radius * e.def.scale && Math.abs(pr.pos.y - (e.pos.y + 1)) < 2.5) {
          pr.hit.add(e.id); const crit = Math.random() < p.stats.crit; const dir = pr.vel.clone().setY(0).normalize();
          damageEnemy(e, pr.dmg * (crit ? p.stats.critDmg : 1), { kb: pr.kb, dir, stagger: 14, crit, style: pr.style, skill: true, status: pr.status as Status });
          if (!pr.pierce) pr.life = 0;
        }
      }
    } else if (p.state !== 'dead') {
      const d = Math.hypot(pr.pos.x - p.pos.x, pr.pos.z - p.pos.z);
      if (d < pr.radius + 0.5 && Math.abs(pr.pos.y - (p.pos.y + 1)) < 2) { hurtPlayer(pr.dmg, pr.pos, { kb: pr.kb, status: pr.status }, null); if (!pr.pierce) pr.life = 0; }
    }
    if (pr.life <= 0) { fxm.sparks(pr.pos, 4, pr.color, 3, 0.15, 0.3); removeProj(pr); }
  });
}

// ---------------- player damage ----------------
export function hurtPlayer(dmgIn: number, from: THREE.Vector3, o: { kb?: number; status?: string; unblockable?: boolean } = {}, src: EnemyRT | null = null): boolean {
  const p = rt.player!; if (p.state === 'dead') return false; const fxm = G.fx!;
  const c = tv.set(p.pos.x, p.pos.y + 1.1, p.pos.z).clone();
  const away = new THREE.Vector3(p.pos.x - from.x, 0, p.pos.z - from.z); if (away.lengthSq() < 0.0001) away.set(0, 0, 1); away.normalize();
  if (p.invuln > 0) {
    if (p.state === 'dodge' && p.dodgeT < 0.3 && p.perfect > 0) {
      p.perfect = 0; rt.slowmo = 1.1; p.ult = Math.min(p.maxUlt, p.ult + 14); p.breath = Math.min(p.maxBreath, p.breath + 25); p.sta = Math.min(p.maxSta, p.sta + 25);
      fxm.number(c.clone().setY(c.y + 0.9), 'PERFECT DODGE', '#9ae8ff', true); fxm.ring(p.pos, 4, 0x9ae8ff, 0.6); audio.sfx('perfect');
    }
    return false;
  }
  const toSrc = Math.atan2(from.x - p.pos.x, from.z - p.pos.z);
  if (p.state === 'guard' && !o.unblockable && Math.abs(angDiff(p.yaw, toSrc)) < 1.25) {
    if (p.guardT < 0.25 && src) { // parry
      fxm.sparks(c, 24, 0xffffff, 9, 0.22, 0.5); fxm.ring(c, 3.5, 0xffffff, 0.4, 0, 0.12); fxm.number(c.clone().setY(c.y + 0.8), 'PARRY!', '#ffffff', true); audio.sfx('parry');
      src.posture += src.boss ? (src.def.id === 'rui' || src.def.id === 'gyokko' ? 999 : 40) : 999; if (src.posture >= src.maxPosture) staggerEnemy(src, src.boss ? 3.2 : 2.2);
      p.ult = Math.min(p.maxUlt, p.ult + 10); p.sta = Math.min(p.maxSta, p.sta + 10); rt.hitstop = 0.12; rt.shake = 0.5; p.invuln = 0.3; return false;
    }
    const d = dmgIn * 0.22 * (100 / (100 + p.stats.def)); p.hp -= d; p.sta -= 14 + dmgIn * 0.4; p.kb.addScaledVector(away, 3); p.regenDelay = 1.2;
    fxm.sparks(c, 12, 0xffd080, 7); fxm.number(c, String(Math.round(d)), '#9ac8ff'); audio.sfx('clash'); rt.shake = 0.25; rt.hitstop = 0.05;
    if (p.sta <= 0) { p.sta = 0; p.state = 'hurt'; p.t = 0; p.dur = 0.7; p.invuln = 0.4; fxm.number(c.clone().setY(c.y + 0.8), 'GUARD BROKEN', '#ff6a6a'); }
    if (p.hp <= 0) playerDie(); return true;
  }
  let dmg = dmgIn * (100 / (100 + p.stats.def)); if (p.buffs.guard > 0) dmg *= 0.7; if (o.status === 'poison') dmg *= 1.15;
  p.hp -= dmg; p.lastHitT = 0; p.regenDelay = 2.5; p.ult = Math.min(p.maxUlt, p.ult + 3);
  fxm.number(c, String(Math.round(dmg)), '#ff5a5a', dmg > p.maxHp * 0.2); fxm.blood(c, 8); fxm.sparks(c, 6, 0xff6060, 5); audio.sfx('hurt'); rt.shake = Math.max(rt.shake, 0.6); rt.hitstop = Math.max(rt.hitstop, 0.06); rt.flash = 0.5;
  if (o.status === 'slow' || o.status === 'poison') p.buffs.slow = 2;
  p.kb.addScaledVector(away, (o.kb ?? 3) * 1.2);
  if (p.hp <= 0) { playerDie(); return true; }
  if (p.state === 'skill') p.invuln = 0.25;
  else if (p.state !== 'dodge') { p.state = 'hurt'; p.t = 0; p.dur = 0.38; p.queued = null; p.invuln = 0.35; }
  return true;
}

export function playerDie() {
  const p = rt.player!; if (p.state === 'dead') return; p.state = 'dead'; p.t = 0; p.hp = 0; p.lockId = null; audio.sfx('death'); rt.slowmo = 1.2;
  setTimeout(() => { if (rt.player?.state === 'dead') useStore.getState().setOverlay('death'); }, 1400);
}

export function healPlayer(n: number) { const p = rt.player!; p.hp = Math.min(p.maxHp, p.hp + n); G.fx!.number(tv.set(p.pos.x, p.pos.y + 2, p.pos.z), `+${Math.round(n)}`, '#7aff9a'); G.fx!.sparks(tv.set(p.pos.x, p.pos.y + 1, p.pos.z), 14, 0x7aff9a, 3, 0.2, 0.7); audio.sfx('heal'); }

export const styleOfChar = (id: string) => STYLES[CHAR_BY_ID[id].style];
export const lerpClamp = clamp; export const forward = fwd;
