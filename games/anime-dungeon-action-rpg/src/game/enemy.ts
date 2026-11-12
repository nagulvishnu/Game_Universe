import * as THREE from 'three';
import { REGIONS, type Arch, type EnemyDef, type BossAtkId } from './data';
import { buildEnemy, buildBoss, animateRig, setFlash, type Rig } from './creatures';
import { useStore } from './store';
import { sfx } from './audio';
import { clamp, damp, dampAngle, wrap, TAU } from './util';
import type { Game } from './engine';
import type { Tele } from './fx';

export interface HitOpts { dx: number; dz: number; knock?: number; launch?: boolean; stagger?: number; heavy?: boolean; crit?: boolean; air?: boolean; guardBreak?: boolean; down?: boolean; noFlinch?: boolean; stun?: number; kind?: string; launchPow?: number }
type MK = 'melee' | 'combo' | 'dash' | 'proj' | 'aoe' | 'stomp' | 'slam' | 'charge' | 'fan' | 'rain' | 'sweep' | 'summon' | 'nova' | 'beam';
interface Move { name: string; kind: MK; wind: number; rec: number; range: number; arc: number; dmg: number; unblock?: boolean; hits?: number; gap?: number; n?: number; speed?: number }
const BA: Record<BossAtkId, Move> = {
  swing: { name: '', kind: 'melee', wind: 0.95, rec: 0.9, range: 4, arc: 2.2, dmg: 1.4 }, combo: { name: '', kind: 'combo', wind: 0.8, rec: 1.1, range: 4, arc: 2.4, dmg: 0.9, hits: 3, gap: 0.55 },
  slam: { name: '', kind: 'slam', wind: 1.3, rec: 1.3, range: 9, arc: 7, dmg: 2.0, unblock: true }, charge: { name: '', kind: 'charge', wind: 1.1, rec: 1.6, range: 26, arc: 3.5, dmg: 1.7, unblock: true },
  fan: { name: '', kind: 'fan', wind: 0.9, rec: 1.0, range: 30, arc: 0.5, dmg: 0.8, n: 5, speed: 13 }, rain: { name: '', kind: 'rain', wind: 0.9, rec: 1.6, range: 2.8, arc: 0, dmg: 1.3, unblock: true, n: 7 },
  sweep: { name: '', kind: 'sweep', wind: 1.2, rec: 1.3, range: 22, arc: 1.6, dmg: 1.0, unblock: true }, summon: { name: '', kind: 'summon', wind: 1.3, rec: 1.0, range: 0, arc: 0, dmg: 0, n: 2 },
  nova: { name: '', kind: 'nova', wind: 1.1, rec: 1.0, range: 24, arc: 7, dmg: 1.2, unblock: true }, beam: { name: '', kind: 'beam', wind: 1.8, rec: 1.4, range: 30, arc: 2.6, dmg: 0.4, unblock: true },
};
const ARCH: Record<Arch, { hp: number; speed: number; moves: Move[]; poise: number; weight: number; cd: [number, number] }> = {
  grunt: { hp: 1, speed: 4.4, poise: 45, weight: 1, cd: [0.8, 1.7], moves: [
    { name: 'Slash', kind: 'melee', wind: 0.62, rec: 0.7, range: 2.5, arc: 1.7, dmg: 1 }, { name: 'Double Slash', kind: 'combo', wind: 0.58, rec: 0.9, range: 2.5, arc: 1.8, dmg: 0.75, hits: 2, gap: 0.42 }] },
  assassin: { hp: 0.8, speed: 6.4, poise: 30, weight: 0.8, cd: [0.6, 1.4], moves: [
    { name: 'Lunge', kind: 'dash', wind: 0.42, rec: 0.7, range: 8, arc: 1.4, dmg: 0.95 }, { name: 'Triple Cut', kind: 'combo', wind: 0.4, rec: 0.8, range: 2.4, arc: 2, dmg: 0.6, hits: 3, gap: 0.3 }] },
  heavy: { hp: 2.3, speed: 2.9, poise: 160, weight: 2.5, cd: [1.2, 2.4], moves: [
    { name: 'Crush', kind: 'melee', wind: 0.95, rec: 1.1, range: 3.4, arc: 2.2, dmg: 1.9 }, { name: 'Ground Stomp', kind: 'stomp', wind: 1.15, rec: 1.2, range: 4.6, arc: 7, dmg: 1.9, unblock: true }] },
  mage: { hp: 0.75, speed: 3.6, poise: 22, weight: 0.8, cd: [1.4, 2.6], moves: [
    { name: 'Bolt', kind: 'proj', wind: 0.78, rec: 0.7, range: 26, arc: 0.3, dmg: 0.9, speed: 12 }, { name: 'Spell Circle', kind: 'aoe', wind: 1.1, rec: 0.9, range: 3.2, arc: 7, dmg: 1.3, unblock: true }, { name: 'Triple Bolt', kind: 'fan', wind: 0.9, rec: 0.9, range: 26, arc: 0.5, dmg: 0.7, n: 3, speed: 11 }] },
};
export interface SpawnOpts { floor: number; elite?: boolean; boss?: number; mini?: boolean; x: number; z: number; dummy?: boolean; mult?: number; train?: 'bot' | 'dummy' }
type St = 'spawn' | 'idle' | 'chase' | 'windup' | 'strike' | 'recover' | 'stagger' | 'down' | 'launched' | 'dead' | 'phase' | 'stun' | 'channel' | 'guard' | 'evade';

export class Enemy {
  rig: Rig; def: EnemyDef; name: string; arch: Arch; isBoss = false; mini = false; elite = false; kit = false; bossIdx = -1; train = ''; floor: number;
  x: number; z: number; y = 0; vy = 0; vx = 0; vz = 0; yaw = Math.random() * TAU; radius: number; hp: number; maxHp: number; dmgBase: number; speed: number; weight: number;
  state: St = 'spawn'; st = 0; spawnT = 0.7; dead = false; deadT = 0; cd = 1; poise: number; maxPoise: number; mv: Move | null = null; mt = 0; hitDone = 0; hitsLeft = 0; tele: Tele | null = null; token = false;
  flashT = 0; flashOn = false; strikeAnim = 0; staggerAnim = 0; slowT = 0; alerted = false; wanderT = 0; wdx = 0; wdz = 0; strafe = Math.random() < 0.5 ? 1 : -1; strafeT = 0; steerA = 0; steerT = 0;
  guardT = 0; guardCd = 3; stunT = 0; pullX = 0; pullZ = 0; pullT = 0; lastHit = 99; air = false; phase = 1; posture = 0; atkName = ''; lastAtk = ''; envT = 6; chan: { t: number; dur: number; fn: (dt: number) => void; done?: () => void } | null = null;
  lockDir = 0; cueDone = false; dashT = 0; xpMul = 1; windMul = 1; cdMul = 1; curAtk: [BossAtkId, string, number] | null = null; bossDef = REGIONS[0].boss; sx: number; sz: number; hitStopped = false; evadeDir = 0; tint = 1; noLoot = false; baseScale = 1;

  constructor(public g: Game, def: EnemyDef | null, o: SpawnOpts) {
    this.floor = o.floor; this.x = this.sx = o.x; this.z = this.sz = o.z; const save = useStore.getState().save, ng = save.ng, f = o.floor, spec = g.spec;
    const region = spec ? spec.region : 0;
    if (o.boss !== undefined && !o.mini) {
      this.isBoss = true; this.kit = true; this.bossIdx = o.boss; const bd = REGIONS[o.boss].boss; this.bossDef = bd; this.name = bd.name; this.rig = buildBoss(o.boss, bd);
      this.def = REGIONS[o.boss].enemies[2]; this.arch = 'heavy';
    } else if (o.mini) {
      this.mini = true; this.kit = true; this.bossIdx = o.boss ?? region; const d0 = REGIONS[this.bossIdx].enemies.find((e) => e.arch === 'heavy') || REGIONS[this.bossIdx].enemies[0]; this.def = d0; this.arch = 'heavy'; this.bossDef = REGIONS[this.bossIdx].boss;
      this.name = `Champion ${d0.name}`; this.rig = buildEnemy({ ...d0, scale: d0.scale * 1.7 });
    } else { this.def = def!; this.arch = def!.arch; this.name = def!.name; this.rig = buildEnemy(def!); }
    this.elite = !!o.elite; if (this.elite) { this.name = `Elite ${this.name}`; this.rig.root.scale.multiplyScalar(1.22); this.rig.radius *= 1.22; this.rig.height *= 1.22; }
    this.baseScale = this.rig.root.scale.x; this.radius = Math.max(0.45, this.rig.radius * (this.rig.tpl === 'beast' || this.rig.tpl === 'winged' || this.rig.tpl === 'crawler' ? 0.8 : 0.7)); if (this.isBoss) this.radius = this.rig.radius * 0.8;
    const A = ARCH[this.arch], base = (14 + 5.2 * f), mod = spec?.mod === 'ironskin' ? 2 : 1, ngm = 1 + ng * 0.8;
    this.maxHp = Math.round(this.isBoss ? base * 65 * ngm * mod : this.mini ? base * 3.2 * 9 * ngm * mod : base * 3.2 * A.hp * (this.elite ? 3.5 : 1) * (o.mult ?? 1) * ngm * mod);
    this.dmgBase = (8 + 2.2 * f) * (1 + ng * 0.5) * (this.elite ? 1.25 : 1) * (this.isBoss ? 1.15 : this.mini ? 1.2 : 1) * (o.mult && o.mult < 1 ? 1 : 1);
    this.hp = this.maxHp; this.speed = this.isBoss ? 3.9 : A.speed * (this.elite ? 1.12 : 1) * (this.mini ? 0.9 : 1); this.weight = this.isBoss ? 30 : this.mini ? 8 : A.weight;
    this.maxPoise = this.isBoss ? 9999 : A.poise * (this.elite ? 2.2 : 1) * (this.mini ? 4 : 1); this.poise = this.maxPoise; this.xpMul = this.isBoss ? 12 : this.mini ? 6 : this.elite ? 3 : this.arch === 'heavy' ? 1.6 : 1;
    if (o.train) { this.train = o.train; this.maxHp = 1e9; this.hp = 1e9; }
    this.cd = 0.5 + Math.random() * 0.8; this.rig.root.position.set(this.x, 0, this.z); g.scene.add(this.rig.root);
    if (!this.isBoss) { this.rig.root.scale.multiplyScalar(0.01); }
  }
  get hover() { return this.rig.hover; }
  loseTarget() { if (this.state === 'chase') { this.state = 'idle'; this.alerted = false; } }
  pull(tx: number, tz: number, s: number) { if (this.isBoss) s *= 0.15; const dx = tx - this.x, dz = tz - this.z, d = Math.hypot(dx, dz) || 1; if (d < 1) return; this.pullX = (dx / d) * s; this.pullZ = (dz / d) * s; this.pullT = 0.2; }
  cancelMove() { this.g.fx.killTele(this.tele); this.tele = null; this.mv = null; this.releaseToken(); this.chan = null; this.atkName = ''; }
  releaseToken() { if (this.token) { this.token = false; this.g.attackers = Math.max(0, this.g.attackers - 1); } }

  // ---------- being hit ----------
  hit(g: Game, dmg: number, o: HitOpts): boolean {
    if (this.dead || this.spawnT > 0 || this.state === 'phase') return false;
    let d = dmg; const p = g.player;
    // elite guard
    if (this.state === 'guard' && !o.guardBreak) {
      const a = Math.atan2(p.pos.x - this.x, p.pos.z - this.z);
      if (Math.abs(wrap(a - this.yaw)) < 1.5) { d *= 0.12; sfx('block'); g.fx.burst(this.x + Math.sin(a), 1.4, this.z + Math.cos(a), 0xffddaa, 12, 7, 0.4, 0.18); g.fx.num(new THREE.Vector3(this.x, this.rig.height + 0.5, this.z), 'BLOCKED', '#aaa', 0.9); this.vx -= o.dx * 1.5; this.vz -= o.dz * 1.5; this.hp -= d; this.flashT = 0.04; if (this.hp <= 0) return this.die(g); return false; }
    } else if (this.state === 'guard' && o.guardBreak) { this.state = 'stagger'; this.st = 1.3; this.cancelMove(); g.callout('GUARD BREAK', '#ffa'); sfx('crit'); }
    if (this.state === 'stun') d *= 1.5; else if (this.state === 'down' || this.state === 'stagger') d *= 1.2;
    d = Math.max(1, Math.round(d)); this.hp -= d; this.flashT = 0.07; this.lastHit = 0; this.alerted = true; g.lastTarget = this; g.alertNear(this);
    if (this.train === 'dummy') { g.trainStat('dmg', d); }
    const hy = this.rig.height * 0.8 + this.y;
    g.fx.num(new THREE.Vector3(this.x, hy + 0.6, this.z), (o.crit ? '' : '') + d, o.crit ? '#ffd860' : o.heavy ? '#ffb070' : '#ffffff', o.crit ? 1.5 : o.heavy ? 1.25 : 1);
    g.fx.burst(this.x, hy * 0.8, this.z, o.crit ? 0xffd860 : 0xffffff, o.heavy ? 14 : 8, o.heavy ? 9 : 6, 0.35, 0.16, 6);
    if (o.crit) g.fx.ring(this.x, hy * 0.8, this.z, 0xffd860, 1.4, 0.18, 0.2, 0.8);
    sfx('ehurt', 0.5);
    if (this.hp <= 0) return this.die(g);
    // kit phases
    if (this.kit && this.phase < (this.isBoss ? 3 : 2)) { const th = this.isBoss ? 1 - this.phase / 3 : 0.5; if (this.hp <= this.maxHp * th) { this.startPhase(g); return false; } }
    // reactions
    const kb = (o.knock ?? 0) / (1 + this.weight * 0.6);
    if (!this.air || this.state === 'launched') { this.vx += o.dx * kb * 1.6; this.vz += o.dz * kb * 1.6; }
    if (this.kit) { if (o.stagger === 2 && this.state !== 'stun') this.posture += 8; if (this.state === 'stun' || o.launch) { /* no launch on kits */ } return false; }
    if (o.launch && this.weight < 3) { this.cancelMove(); this.state = 'launched'; this.vy = 8.5 + (o.launchPow ?? 0) * 0.3; this.air = true; this.st = 0; this.y = Math.max(this.y, 0.05); return false; }
    if (this.state === 'launched') { if (o.air || o.knock) this.vy = Math.max(this.vy, o.air ? 5.5 : 3); return false; }
    if (o.down && this.weight < 3) { this.cancelMove(); this.state = 'down'; this.st = 1.1; return false; }
    this.poise -= (o.heavy ? 38 : 13) + (o.stagger ? 10 : 0);
    const armored = this.state === 'windup' && (this.arch === 'heavy' || (this.elite && this.mv && this.mv.kind === 'combo'));
    if ((o.stagger ?? 0) >= 2 || this.poise <= 0) { this.poise = this.maxPoise; this.cancelMove(); this.state = 'stagger'; this.st = this.arch === 'heavy' ? 0.8 : 1.0; this.staggerAnim = 1; }
    else if (!o.noFlinch && !armored && this.state !== 'strike' && this.state !== 'stagger' && this.state !== 'down' && this.state !== 'stun') { if (this.state === 'windup') { this.cancelMove(); this.cd = 0.5 + Math.random() * 0.4; } this.state = 'stagger'; this.st = (o.stagger ?? 0) ? 0.45 : 0.2; this.staggerAnim = 0.6; }
    if (o.stun) { this.state = 'stagger'; this.st = o.stun; this.cancelMove(); }
    return false;
  }
  onParried(g: Game, perfect: boolean) {
    if (this.kit) {
      this.posture += perfect ? 26 : 5; if (perfect) { this.hitsLeft = 0; this.cd += 0.3; g.fx.burst(this.x, 2.5, this.z, 0xffe27a, 20, 10, 0.5, 0.25); g.fx.num(new THREE.Vector3(this.x, this.rig.height + 1, this.z), 'DEFLECTED', '#ffe27a', 1.1); }
      if (this.posture >= 100 && this.state !== 'stun') this.startStun(g);
      return;
    }
    if (perfect) { this.cancelMove(); this.state = 'stagger'; this.st = this.arch === 'heavy' ? 1.1 : 1.6; this.staggerAnim = 1; this.poise = this.maxPoise; const a = Math.atan2(this.x - g.player.pos.x, this.z - g.player.pos.z); this.vx = Math.sin(a) * 5; this.vz = Math.cos(a) * 5; }
    else { this.cd += 0.5; }
  }
  startStun(g: Game) {
    this.posture = 0; this.cancelMove(); this.state = 'stun'; this.st = 3.6; this.stunT = 3.6; g.callout('POSTURE BROKEN', '#ffd860'); g.hitstop(0.15); g.shake(0.6); sfx('crit'); g.fx.ring(this.x, 0.2, this.z, 0xffd860, 8, 0.6);
    g.fx.burst(this.x, this.rig.height * 0.7, this.z, 0xffd860, 50, 12, 0.8, 0.3);
  }
  startPhase(g: Game) {
    this.cancelMove(); this.phase++; this.state = 'phase'; this.st = 0; this.posture = 0; this.hp = Math.max(this.hp, 1); sfx('roar'); g.shake(1); g.slowmo(0.3, 0.5); g.flash('#fff', 0.4);
    g.banner(this.isBoss ? this.name : this.name, this.isBoss ? `PHASE ${this.phase === 2 ? 'II' : 'III'}` : 'ENRAGED', '#ff6a5a'); g.fx.ring(this.x, 0.2, this.z, 0xff6040, 22, 1); g.fx.burst(this.x, this.rig.height * 0.6, this.z, this.bossDef.glow, 70, 14, 1.2, 0.4);
    this.cdMul = this.phase === 2 ? 0.82 : 0.68; this.speed *= 1.1; this.windMul = this.phase === 2 ? 0.92 : 0.85;
    // push player away
    const p = g.player; const a = Math.atan2(p.pos.x - this.x, p.pos.z - this.z); if (Math.hypot(p.pos.x - this.x, p.pos.z - this.z) < 14) { p.vx += Math.sin(a) * 12; p.vz += Math.cos(a) * 12; }
  }
  die(g: Game): boolean {
    if (this.dead) return true; this.dead = true; this.deadT = 0; this.state = 'dead'; this.cancelMove(); this.hp = 0; this.releaseToken();
    if (this.isBoss) { g.onBossDeath(this); return true; }
    g.fx.burst(this.x, this.rig.height * 0.5, this.z, this.def.glow, 30, 8, 0.8, 0.28); g.fx.ring(this.x, 0.2, this.z, this.def.glow, 3, 0.4); sfx('death', 0.6);
    g.onEnemyDeath(this); return true;
  }

  // ---------- per-frame ----------
  update(g: Game, dt: number, time: number) {
    const p = g.player, rig = this.rig;
    if (this.dead) {
      this.deadT += dt; if (this.isBoss) { animateRig(rig, time, { move: 0, wind: 0, strike: 0, stagger: 0, dead: clamp(this.deadT * 0.5, 0, 1), stun: false }); if (this.deadT < 2.4 && Math.random() < 0.5) { g.fx.burst(this.x + (Math.random() - 0.5) * this.radius * 2, Math.random() * this.rig.height, this.z + (Math.random() - 0.5) * this.radius * 2, this.bossDef.glow, 14, 9, 0.7, 0.4); } return; }
      animateRig(rig, time, { move: 0, wind: 0, strike: 0, stagger: 0, dead: clamp(this.deadT * 3, 0, 1), stun: false }); const s = this.baseScale * clamp(1 - (this.deadT - 0.5) * 1.6, 0, 1); rig.root.scale.setScalar(Math.max(0.001, s)); rig.root.position.set(this.x, this.y, this.z); return;
    }
    if (this.spawnT > 0) { this.spawnT -= dt; const k = clamp(1 - this.spawnT / 0.7, 0, 1); if (!this.isBoss) rig.root.scale.setScalar(this.baseScale * Math.max(0.01, k)); rig.root.position.set(this.x, -1 + k, this.z); rig.root.rotation.y = this.yaw; if (this.spawnT <= 0) { this.state = this.g.bossIntro && this.isBoss ? 'idle' : 'chase'; if (this.isBoss) this.state = 'idle'; if (!this.isBoss) { rig.root.scale.setScalar(this.baseScale); } } return; }
    this.lastHit += dt; this.cd -= dt; this.slowT -= dt; this.guardCd -= dt; this.st -= dt; this.strikeAnim = Math.max(0, this.strikeAnim - dt * 3.2); this.staggerAnim = Math.max(0, this.staggerAnim - dt * 2.5);
    if (this.flashT > 0) { this.flashT -= dt; if (!this.flashOn) { setFlash(rig, true); this.flashOn = true; } } else if (this.flashOn) { setFlash(rig, false); this.flashOn = false; }
    const dx = p.pos.x - this.x, dz = p.pos.z - this.z, dist = Math.hypot(dx, dz), toP = Math.atan2(dx, dz);
    const visible = !(p.invisT > 0 && dist > 3 && this.state !== 'windup');
    if (this.train === 'dummy') { this.hp = this.maxHp; }
    // gravity / launch
    if (this.air || this.y > 0) { this.vy -= 24 * dt; this.y += this.vy * dt; if (this.y <= 0) { this.y = 0; this.vy = 0; this.air = false; if (this.state === 'launched') { this.state = 'down'; this.st = 1.0; g.fx.burst(this.x, 0.2, this.z, 0xccbb99, 10, 4, 0.4, 0.25, 4); g.shake(0.1); } } }
    if (this.state === 'launched') { if (!this.air && this.y <= 0) { this.state = 'down'; this.st = 1; } if (this.st < -4) { this.state = 'down'; this.st = 0.5; } }
    let moveSp = 0, moveA = 0, wantMove = false;
    const A = ARCH[this.arch], spd = this.speed * (this.slowT > 0 ? 0.45 : 1);
    switch (this.state) {
      case 'idle': {
        this.wanderT -= dt; if (this.wanderT <= 0) { this.wanderT = 1.5 + Math.random() * 2; const a = Math.random() * TAU, r = Math.random() < 0.4 ? 0 : 1; this.wdx = Math.sin(a) * r; this.wdz = Math.cos(a) * r; }
        if (this.wdx || this.wdz) { moveSp = spd * 0.35; moveA = Math.atan2(this.wdx, this.wdz); wantMove = true; }
        if (!this.g.bossIntro && ((visible && dist < (this.isBoss ? 60 : 17)) || this.alerted) && this.g.active) { this.state = 'chase'; this.alerted = true; g.alertNear(this); if (this.isBoss) g.fx.burst(this.x, 2, this.z, 0xffffff, 10, 5, 0.4); }
        break;
      }
      case 'chase': {
        if (!visible && !this.isBoss) { this.loseTarget(); break; }
        if (this.kit) this.chaseKit(g, dt, dist, toP, spd);
        else { const r = this.chaseNormal(g, dt, dist, toP, spd, A); moveSp = r.sp; moveA = r.a; wantMove = r.sp > 0; }
        this.yaw = dampAngle(this.yaw, wantMove && this.arch !== 'mage' && this.arch !== 'assassin' ? moveA : toP, 9, dt);
        if (!wantMove) { /* face player */ this.yaw = dampAngle(this.yaw, toP, 10, dt); }
        // kit movement
        if (this.kit && this.state === 'chase') { const stop = this.radius + (this.mini ? 2.2 : 3.2); if (dist > stop) { moveSp = spd; moveA = toP; wantMove = true; } this.yaw = dampAngle(this.yaw, toP, 4.5, dt); }
        break;
      }
      case 'evade': { moveSp = 13 * clamp(this.st / 0.25, 0, 1); moveA = this.evadeDir; wantMove = true; this.yaw = dampAngle(this.yaw, toP, 14, dt); if (this.st <= 0) { this.state = 'chase'; this.cd = Math.max(this.cd, 0.2); } break; }
      case 'windup': this.updateWindup(g, dt, dist, toP); moveSp = this.mv && this.mv.kind === 'melee' && !this.kit && this.mt < this.mv.wind * 0.6 ? spd * 0.3 : 0; moveA = toP; wantMove = moveSp > 0; break;
      case 'strike': this.updateStrike(g, dt, dist, toP); break;
      case 'recover': this.mt += dt; if (this.mv && this.mt >= this.mv.rec) { this.releaseToken(); this.mv = null; this.atkName = ''; this.state = 'chase'; const c = A.cd; this.cd = (c[0] + Math.random() * (c[1] - c[0])) * (this.kit ? 0.55 : 1) * this.cdMul * (1 - this.floor * 0.002); if (this.kit && this.arch) this.cd += 0.3; if (this.arch === 'assassin' && !this.kit && Math.random() < 0.5) { this.state = 'evade'; this.st = 0.25; this.evadeDir = toP + Math.PI + (Math.random() - 0.5) * 1.6; } } break;
      case 'stagger': this.vx *= 0.88; this.vz *= 0.88; if (this.st <= 0) { this.state = 'chase'; this.cd = Math.max(this.cd, 0.35); } break;
      case 'down': if (this.st <= 0) { this.state = 'chase'; this.cd = Math.max(this.cd, 0.5); } break;
      case 'stun': this.stunT = this.st; this.vx *= 0.9; this.vz *= 0.9; if (this.st <= 0) { this.state = 'chase'; this.cd = 0.6; g.fx.burst(this.x, 2, this.z, 0xffd860, 20, 6, 0.5); } break;
      case 'phase': { this.st += dt * 2; this.yaw = dampAngle(this.yaw, toP, 3, dt); const k = (this.st) / 1; if (k > 1.8) { this.state = 'chase'; this.cd = 0.8; } if (Math.random() < 0.3) g.fx.emit(this.x + (Math.random() - 0.5) * this.radius * 2, Math.random() * this.rig.height, this.z + (Math.random() - 0.5) * this.radius * 2, 0, 4, 0, this.bossDef.glow, 0.8, 0.5); break; }
      case 'channel': { const c = this.chan; if (c) { c.t += dt; c.fn(dt); this.yaw = dampAngle(this.yaw, toP, 0.8, dt); if (c.t >= c.dur) { c.done?.(); this.chan = null; this.state = 'recover'; this.mt = 0; } } else { this.state = 'recover'; this.mt = 0; } break; }
      case 'guard': this.yaw = dampAngle(this.yaw, toP, 8, dt); if (this.st <= 0) { this.state = 'chase'; this.guardCd = 2.5 + Math.random() * 2; } break;
    }
    // kit environment attacks
    if (this.kit && this.phase >= 2 && g.active && this.state !== 'phase' && this.state !== 'stun') { this.envT -= dt; if (this.envT <= 0) { this.envT = this.phase === 2 ? 7 : 4.5; this.envStrike(g); } }
    // movement integration
    if (wantMove && this.state !== 'stagger' && this.state !== 'down') {
      const sp = moveSp; let a = moveA;
      if (g.world) { this.steerT -= dt; const tx = this.x + Math.sin(a) * 1.4, tz = this.z + Math.cos(a) * 1.4; if (g.world.blocked(tx, tz, this.radius * 0.8)) { for (const da of [0.7, -0.7, 1.4, -1.4, 2.2, -2.2]) { if (!g.world.blocked(this.x + Math.sin(a + da) * 1.4, this.z + Math.cos(a + da) * 1.4, this.radius * 0.8)) { a += da; break; } } } }
      this.vx = damp(this.vx, Math.sin(a) * sp, 10, dt); this.vz = damp(this.vz, Math.cos(a) * sp, 10, dt);
    } else if (this.state !== 'strike') { this.vx = damp(this.vx, 0, 8, dt); this.vz = damp(this.vz, 0, 8, dt); }
    if (this.pullT > 0) { this.pullT -= dt; this.vx = this.pullX; this.vz = this.pullZ; }
    let nx = this.x + this.vx * dt, nz = this.z + this.vz * dt;
    // separation
    for (const o of g.enemies) { if (o === this || o.dead) continue; const ox = nx - o.x, oz = nz - o.z, od = Math.hypot(ox, oz), m = (this.radius + o.radius) * 0.9; if (od < m && od > 0.001) { const pu = (m - od) * 0.5 * (this.isBoss ? 0 : 1); nx += (ox / od) * pu; nz += (oz / od) * pu; } }
    if (g.world) { [nx, nz] = g.world.collide(nx, nz, this.radius * 0.8); }
    // pushing player a little
    const pdx = p.pos.x - nx, pdz = p.pos.z - nz, pd = Math.hypot(pdx, pdz), pm = this.radius + 0.4;
    if (pd < pm && pd > 0.01 && !this.isBoss) { const push = (pm - pd); nx -= (pdx / pd) * push * 0.5; nz -= (pdz / pd) * push * 0.5; p.pushX += (pdx / pd) * push * 4; p.pushZ += (pdz / pd) * push * 4; } else if (pd < pm && pd > 0.01 && this.isBoss) { p.pushX += (pdx / pd) * (pm - pd) * 8; p.pushZ += (pdz / pd) * (pm - pd) * 8; }
    this.x = nx; this.z = nz;
    // animate
    const move = clamp(Math.hypot(this.vx, this.vz) / 6, 0, 1.2), windP = this.state === 'windup' && this.mv ? clamp(this.mt / (this.mv.wind * this.windMul), 0, 1) : 0;
    animateRig(rig, time, { move, wind: this.state === 'channel' ? 0.6 : windP, strike: this.strikeAnim, stagger: this.state === 'stagger' || this.state === 'phase' ? Math.max(0.4, this.staggerAnim) : this.staggerAnim * 0.5, dead: 0, stun: this.state === 'stun' });
    if (this.state === 'stun') { rig.body.rotation.x = 0.35; }
    if (this.state === 'down') { rig.root.rotation.x = damp(rig.root.rotation.x, -1.2, 14, dt); } else if (this.state === 'launched') { rig.root.rotation.x = damp(rig.root.rotation.x, -0.6, 10, dt); } else rig.root.rotation.x = damp(rig.root.rotation.x, 0, 12, dt);
    rig.root.position.set(this.x, this.y + (this.state === 'down' ? -0.3 + 0.3 : 0), this.z); rig.root.rotation.y = this.yaw;
    if (this.elite && Math.random() < 0.3) g.fx.emit(this.x + (Math.random() - 0.5) * 1.4, 0.2, this.z + (Math.random() - 0.5) * 1.4, 0, 2, 0, this.def.glow, 0.7, 0.2);
    if (this.state === 'guard' && Math.random() < 0.4) g.fx.emit(this.x + Math.sin(this.yaw) * 1.1, 1.3, this.z + Math.cos(this.yaw) * 1.1, 0, 1, 0, 0xffddaa, 0.3, 0.2);
  }

  private chaseNormal(g: Game, dt: number, dist: number, toP: number, spd: number, A: typeof ARCH.grunt) {
    let sp = 0, a = toP; const p = g.player;
    this.strafeT -= dt; if (this.strafeT <= 0) { this.strafeT = 1 + Math.random() * 1.8; this.strafe = Math.random() < 0.5 ? 1 : -1; }
    const arch = this.arch;
    // elite guard
    if (this.elite && this.guardCd <= 0 && dist < 5 && (p.state === 'atk' || p.state === 'charge') && Math.random() < 0.04) { this.state = 'guard'; this.st = 1.0; return { sp: 0, a }; }
    const mv = this.pickMove(g, dist);
    if (arch === 'mage') {
      if (dist < 7) { sp = spd; a = toP + Math.PI + this.strafe * 0.5; } else if (dist > 14) { sp = spd; a = toP; } else { sp = spd * 0.5; a = toP + this.strafe * Math.PI / 2; }
    } else if (arch === 'assassin') {
      if (dist > 8) { sp = spd; a = toP; } else if (dist < 3.2) { sp = spd * 0.7; a = toP + Math.PI * 0.8 * this.strafe; } else { sp = spd * 0.8; a = toP + this.strafe * (Math.PI / 2 - 0.2); }
    } else {
      if (dist > (mv ? mv.range * 0.75 : 2.2)) { sp = spd; a = toP; } else if (this.cd > 0.2 && dist < 5) { sp = spd * 0.45; a = toP + this.strafe * (Math.PI / 2); } else if (dist < 1.2) { sp = spd * 0.5; a = toP + Math.PI; }
    }
    if (this.train === 'dummy') return { sp: 0, a };
    if (this.cd <= 0 && mv && g.active && !(g.spec?.mode === 'training' && this.train === 'dummy')) {
      const inRange = arch === 'mage' ? dist < mv.range && dist > 3 : arch === 'assassin' && mv.kind === 'dash' ? dist < mv.range && dist > 2.5 : dist < mv.range + this.radius + 0.4;
      const needsToken = mv.kind === 'melee' || mv.kind === 'combo' || mv.kind === 'dash' || mv.kind === 'stomp';
      if (inRange && (!needsToken || this.token || g.attackers < g.maxAttackers)) { if (needsToken && !this.token) { this.token = true; g.attackers++; } this.startMove(g, mv); sp = 0; }
    }
    void A; void dt;
    return { sp, a };
  }
  private pickMove(g: Game, dist: number): Move | null {
    const moves = this.train === 'bot' ? ARCH.grunt.moves.concat(ARCH.heavy.moves[1], ARCH.mage.moves[0]) : ARCH[this.arch].moves;
    let list = moves; if (this.arch === 'grunt' && this.floor < 3 && !this.elite) list = [moves[0]];
    if (this.elite) list = list.concat([{ name: 'Elite Combo', kind: 'combo', wind: 0.5, rec: 1.1, range: 2.8, arc: 2, dmg: 0.7, hits: 4, gap: 0.34 }]);
    if (this.arch === 'mage' && dist < 6) return list[0];
    if (this.train === 'bot') { this.lastAtk = this.lastAtk === 'a' ? 'b' : 'a'; return this.lastAtk === 'a' ? list[0] : (Math.random() < 0.5 ? list[2] : list[3 % list.length]); }
    const m = list[Math.floor(Math.random() * list.length)]; void g; return m;
  }
  private chaseKit(g: Game, dt: number, dist: number, toP: number, spd: number) {
    void toP; void spd; void dt;
    if (this.cd > 0 || !g.active) return;
    const atks = this.bossDef.atks.filter((a) => a[2] <= this.phase + (this.mini ? 0 : 0) && (!this.mini || ['swing', 'combo', 'slam', 'charge', 'fan'].includes(a[0])));
    const near = atks.filter((a) => (a[0] === 'swing' || a[0] === 'combo') ), far = atks.filter((a) => !(a[0] === 'swing' || a[0] === 'combo'));
    const meleeRange = this.radius + 5.5; let pool = dist < meleeRange ? atks : far.length ? far : atks;
    if (dist < meleeRange && Math.random() < 0.55 && near.length) pool = near;
    pool = pool.filter((a) => a[1] !== this.lastAtk && !(a[0] === 'charge' && dist < 6)); if (!pool.length) pool = atks;
    const pick = pool[Math.floor(Math.random() * pool.length)]; this.curAtk = pick; this.lastAtk = pick[1];
    const m = { ...BA[pick[0]], name: pick[1] }; if (m.kind === 'melee' || m.kind === 'combo') m.range = this.radius + 4.2; if (m.kind === 'slam') m.range = this.radius * 2.4 + 3; if (this.mini && m.kind === 'slam') m.range = 6.5;
    this.startMove(g, m);
  }

  // ---------- moves ----------
  startMove(g: Game, m: Move) {
    this.mv = m; this.mt = 0; this.state = 'windup'; this.hitDone = 0; this.cueDone = false; this.hitsLeft = m.hits ?? 1; this.atkName = this.kit ? m.name : ''; const w = m.wind * this.windMul * (this.elite ? 0.88 : 1) * (1 - Math.min(0.2, this.floor * 0.002));
    const p = g.player, col = (m.unblock || g.spec?.mod === 'blockless') ? 0xff2a2a : 0xffaa30; const un = m.unblock || g.spec?.mod === 'blockless';
    const dy = Math.atan2(p.pos.x - this.x, p.pos.z - this.z); this.yaw = dy; this.lockDir = dy;
    switch (m.kind) {
      case 'melee': case 'combo': this.tele = g.fx.tele('cone', this.x, this.z, this.yaw, m.range + this.radius * 0.4, m.arc, col, w); break;
      case 'dash': case 'charge': { const len = Math.min(m.range, Math.hypot(p.pos.x - this.x, p.pos.z - this.z) + (m.kind === 'charge' ? 6 : 2)); this.tele = g.fx.tele('rect', this.x, this.z, this.yaw, len, this.isBoss ? 4 : 1.9, col, w); break; }
      case 'stomp': case 'slam': this.tele = g.fx.tele('circle', this.x, this.z, 0, m.range, 0, col, w); break;
      case 'aoe': { this.lockX = p.pos.x; this.lockZ = p.pos.z; this.tele = g.fx.tele('circle', this.lockX, this.lockZ, 0, m.range, 0, col, w); break; }
      case 'proj': case 'fan': this.tele = g.fx.tele('rect', this.x, this.z, this.yaw, Math.min(16, m.range), 0.7, 0xffcc40, w); break;
      case 'nova': this.tele = g.fx.tele('circle', this.x, this.z, 0, 8, 0, col, w); break;
      case 'beam': case 'sweep': this.tele = g.fx.tele('rect', this.x, this.z, this.yaw, 28, m.kind === 'beam' ? 2.6 : 1.4, col, w); break;
      default: break;
    }
    g.fx.num(new THREE.Vector3(this.x, this.rig.height + 0.8, this.z), '!', un ? '#ff3030' : '#ffcc40', un ? 1.8 : 1.3); sfx(un ? 'unblock' : 'telegraph', 0.6);
    if (this.kit) g.fx.burst(this.x, this.rig.height * 0.6, this.z, this.bossDef.glow, 12, 4, 0.5, 0.25, -1);
    void w;
  }
  lockX = 0; lockZ = 0;
  private updateWindup(g: Game, dt: number, _dist: number, toP: number) {
    const m = this.mv; if (!m) { this.state = 'chase'; return; }
    const w = m.wind * this.windMul * (this.elite ? 0.88 : 1) * (1 - Math.min(0.2, this.floor * 0.002)); this.mt += dt; const k = this.mt / w;
    // tracking
    if (m.kind === 'melee' || m.kind === 'combo' || m.kind === 'proj' || m.kind === 'fan') { if (k < 0.6) this.yaw = dampAngle(this.yaw, toP, this.kit ? 3 : 7, dt); }
    if (m.kind === 'charge' || m.kind === 'dash' || m.kind === 'beam' || m.kind === 'sweep') { if (k < 0.65) { this.yaw = dampAngle(this.yaw, toP, this.kit ? 4 : 9, dt); this.lockDir = this.yaw; } }
    if (this.tele && (m.kind !== 'stomp' && m.kind !== 'slam' && m.kind !== 'aoe' && m.kind !== 'nova')) g.fx.moveTele(this.tele, this.x, this.z, this.yaw);
    if (m.kind === 'dash' || m.kind === 'charge') { if (this.tele && k < 0.65) { /* retarget length */ } }
    // parry cue: snap just before the strike
    if (!this.cueDone && this.mt >= w - 0.13) { this.cueDone = true; const un = m.unblock || g.spec?.mod === 'blockless'; g.fx.burst(this.x, this.rig.height * 0.7, this.z, un ? 0xff3030 : 0xffe27a, 14, 6, 0.3, 0.3, 0); g.fx.ring(this.x, this.rig.height * 0.7, this.z, un ? 0xff3030 : 0xffe27a, 1.8, 0.2, 0.3, 0.9); this.flashT = 0.07; if (un) sfx('unblock', 0.5); }
    if (this.mt >= w) {
      g.fx.killTele(this.tele); this.tele = null; this.state = 'strike'; this.mt = 0; this.hitDone = 0; this.strikeAnim = 1; this.dashT = 0; this.execute(g, m);
    }
  }
  private hitPlayer(g: Game, m: Move, mult = 1, kind: 'melee' | 'proj' | 'aoe' = 'melee'): string {
    const un = m.unblock || g.spec?.mod === 'blockless';
    return g.player.take(this.dmgBase * m.dmg * mult, { x: this.x, z: this.z, unblock: un, kind, e: this, multi: (m.hits ?? 1) > 1 });
  }
  private execute(g: Game, m: Move) {
    const p = g.player, fx = g.fx, col = this.kit ? this.bossDef.glow : this.def.glow;
    switch (m.kind) {
      case 'melee': case 'combo': this.meleeHit(g, m); break;
      case 'dash': case 'charge': { this.dashT = m.kind === 'charge' ? 0.9 : 0.34; const sp = m.kind === 'charge' ? 26 : 20; this.vx = Math.sin(this.lockDir) * sp; this.vz = Math.cos(this.lockDir) * sp; sfx('swingheavy', 0.5); fx.streak(this.x, 1, this.z, this.lockDir, 5, 0.8, col, 0.3); break; }
      case 'proj': { this.fire(g, m, 0, col); break; }
      case 'fan': { const n = (m.n ?? 3) + (this.kit ? (this.phase - 1) * 2 : 0); for (let i = 0; i < n; i++) this.fire(g, m, (i - (n - 1) / 2) * (this.kit ? 0.24 : 0.2), col); break; }
      case 'aoe': { this.aoeBlast(g, m, this.lockX, this.lockZ, m.range, col); break; }
      case 'stomp': case 'slam': { this.aoeBlast(g, m, this.x, this.z, m.range, col); fx.ring(this.x, 0.2, this.z, col, m.range * 1.3, 0.5); break; }
      case 'rain': {
        const n = (m.n ?? 6) + (this.phase - 1) * 3; this.state = 'channel'; this.chan = { t: 0, dur: 2.6 + n * 0.05, fn: () => { } };
        for (let i = 0; i < n; i++) { const d = i * 0.2; const onP = i % 3 === 0; const tx = onP ? p.pos.x + (Math.random() - 0.5) * 2 : p.pos.x + (Math.random() - 0.5) * 18, tz = onP ? p.pos.z + (Math.random() - 0.5) * 2 : p.pos.z + (Math.random() - 0.5) * 18; g.later(d, () => { if (this.dead) return; const [cx, cz] = g.world ? g.world.collide(tx, tz, 0.5) : [tx, tz]; fx.tele('circle', cx, cz, 0, m.range, 0, 0xff2a2a, 1.0); g.later(1.0, () => this.aoeBlast(g, m, cx, cz, m.range, col, true)); }); }
        break;
      }
      case 'sweep': {
        this.state = 'channel'; let ang = this.lockDir - 1.2; const dir = Math.random() < 0.5 ? 1 : -1; let tick = 0; const len = 24 + this.radius; if (dir < 0) ang = this.lockDir + 1.2;
        this.chan = { t: 0, dur: 2.6, fn: (dt) => { ang += dir * dt * 1.5; const a = new THREE.Vector3(this.x, 1.2, this.z), b = new THREE.Vector3(this.x + Math.sin(ang) * len, 1.2, this.z + Math.cos(ang) * len); fx.beam(a, b, col, 0.7, 0.6); fx.beam(a, b, 0xffffff, 0.25, 0.9); g.shake(0.1); tick -= dt; const dx = p.pos.x - this.x, dz = p.pos.z - this.z, u = dx * Math.sin(ang) + dz * Math.cos(ang), v = Math.abs(dx * Math.cos(ang) - dz * Math.sin(ang)); if (u > 0 && u < len && v < 1.1 && p.pos.y < 1.0 && tick <= 0) { tick = 0.5; this.hitPlayer(g, m, 1, 'aoe'); } if (Math.random() < 0.5) fx.emit(this.x + Math.sin(ang) * (2 + Math.random() * len), 0.3, this.z + Math.cos(ang) * (2 + Math.random() * len), 0, 3, 0, col, 0.5, 0.35); } };
        sfx('beam', 0.6); break;
      }
      case 'beam': {
        this.state = 'channel'; const dir = this.lockDir; let tick = 0; const len = 30;
        this.chan = { t: 0, dur: 1.5, fn: (dt) => { const a = new THREE.Vector3(this.x + Math.sin(dir) * this.radius, 1.6, this.z + Math.cos(dir) * this.radius), b = new THREE.Vector3(this.x + Math.sin(dir) * len, 1.6, this.z + Math.cos(dir) * len); fx.beam(a, b, col, 1.8 + Math.sin(this.chan!.t * 40) * 0.2, 0.55); fx.beam(a, b, 0xffffff, 0.7, 0.95); g.shake(0.2); tick -= dt; const dx = p.pos.x - this.x, dz = p.pos.z - this.z, u = dx * Math.sin(dir) + dz * Math.cos(dir), v = Math.abs(dx * Math.cos(dir) - dz * Math.sin(dir)); if (u > 0 && v < 1.6 && p.pos.y < 1.2 && tick <= 0) { tick = 0.18; this.hitPlayer(g, m, 1, 'aoe'); } fx.emit(this.x + Math.sin(dir) * (3 + Math.random() * 25), 1.4, this.z + Math.cos(dir) * (3 + Math.random() * 25), (Math.random() - 0.5) * 3, Math.random() * 3, (Math.random() - 0.5) * 3, col, 0.4, 0.4); } };
        sfx('beam', 0.8, 0.6); sfx('roar', 0.5); break;
      }
      case 'summon': {
        const n = (m.n ?? 2) + this.phase - 1; fx.ring(this.x, 0.2, this.z, col, 9, 0.8); sfx('roar', 0.6); const reg = REGIONS[this.bossIdx >= 0 ? this.bossIdx : 0];
        for (let i = 0; i < n; i++) { const a = (i / n) * TAU + Math.random(), r = this.radius + 3 + Math.random() * 3; let sx = this.x + Math.sin(a) * r, sz = this.z + Math.cos(a) * r; if (g.world) [sx, sz] = g.world.collide(sx, sz, 0.8); const d = reg.enemies[i % 2 === 0 ? 0 : 1]; g.spawnEnemy(d, sx, sz, { floor: this.floor, mult: 0.55 }); }
        break;
      }
      case 'nova': {
        this.state = 'channel'; let r = 1; const hitRef = { done: false }; this.chan = { t: 0, dur: 2.4, fn: (dt) => { r += dt * 11; fx.ring(this.x, 0.3, this.z, col, r, 0.12, r - 0.2, 0.8); if (Math.random() < 0.6) { const a = Math.random() * TAU; fx.emit(this.x + Math.sin(a) * r, 0.3, this.z + Math.cos(a) * r, 0, 3, 0, col, 0.4, 0.3); } const d = Math.hypot(p.pos.x - this.x, p.pos.z - this.z); if (!hitRef.done && Math.abs(d - r) < 1.0 && p.pos.y < 0.9) { hitRef.done = true; this.hitPlayer(g, m, 1, 'aoe'); } } };
        fx.ring(this.x, 0.2, this.z, col, 6, 0.4); g.shake(0.5); sfx('roar', 0.6); break;
      }
    }
  }
  private meleeHit(g: Game, m: Move) {
    const p = g.player, fx = g.fx, col = this.kit ? this.bossDef.glow : this.def.glow; this.hitDone++;
    const dx = p.pos.x - this.x, dz = p.pos.z - this.z, d = Math.hypot(dx, dz), a = Math.atan2(dx, dz);
    fx.slash(this.x, 1.3 + (this.kit ? 1 : 0), this.z, this.yaw, (this.hitDone % 2 ? -0.4 : 0.4), (m.range + this.radius * 0.4) * 0.95, m.arc, col, 0.22, 0.8);
    sfx(this.kit ? 'swingheavy' : 'swing', 0.5);
    const reach = m.range + this.radius * 0.4 + 0.45;
    if (d < reach && Math.abs(wrap(a - this.yaw)) < m.arc / 2 + 0.25 && Math.abs(p.pos.y) < 1.8) this.hitPlayer(g, m, 1, 'melee');
    this.vx = Math.sin(this.yaw) * (this.kit ? 4 : 6); this.vz = Math.cos(this.yaw) * (this.kit ? 4 : 6);
  }
  private fire(g: Game, m: Move, off: number, col: number) {
    const p = g.player, lead = clamp(Math.hypot(p.pos.x - this.x, p.pos.z - this.z) * 0.015, 0, 0.3);
    const a = Math.atan2(p.pos.x + p.vx * lead - this.x, p.pos.z + p.vz * lead - this.z) + off, sp = (m.speed ?? 11) * (1 + (this.kit ? 0.08 * this.phase : 0));
    const hy = this.rig.height * 0.65 + this.y;
    g.spawnProj({ x: this.x + Math.sin(a) * (this.radius + 0.6), y: hy, z: this.z + Math.cos(a) * (this.radius + 0.6), vx: Math.sin(a) * sp, vz: Math.cos(a) * sp, dmg: this.dmgBase * m.dmg, r: this.kit ? 0.9 : 0.55, life: 4, owner: 'e', color: col, shape: 'orb', size: this.kit ? 0.7 : 0.4, deflect: true, src: this, unblock: g.spec?.mod === 'blockless' });
    sfx('magic', 0.4, 0.8); g.fx.burst(this.x + Math.sin(a) * 1.5, hy, this.z + Math.cos(a) * 1.5, col, 8, 4, 0.3);
  }
  aoeBlast(g: Game, m: Move, x: number, z: number, r: number, col: number, quiet = false) {
    const fx = g.fx; fx.blast(x, 0.8, z, col, r * 0.7, 0.35, 0.7); fx.ring(x, 0.1, z, col, r, 0.4); fx.pillar(x, 0, z, col, r * 0.6, 8, 0.3, 0.5); fx.burst(x, 0.4, z, col, 26, 9, 0.6, 0.3, 8); g.shake(this.kit ? 0.5 : 0.25); sfx(this.kit ? 'explode' : 'hit', this.kit ? 0.6 : 0.5);
    const p = g.player; const d = Math.hypot(p.pos.x - x, p.pos.z - z); void quiet;
    if (d < r + 0.3 && p.pos.y < 1.2) { const un = { ...m, unblock: true }; p.take(this.dmgBase * un.dmg, { x, z, unblock: true, kind: 'aoe', e: this }); }
  }
  private updateStrike(g: Game, dt: number, dist: number, toP: number) {
    const m = this.mv; if (!m) { this.state = 'chase'; return; }
    const p = g.player; this.mt += dt;
    switch (m.kind) {
      case 'combo': {
        const next = (this.hitDone) * (m.gap ?? 0.4);
        if (this.hitDone < (m.hits ?? 1) && this.hitsLeft > 0 && this.mt >= next) { this.yaw = toP; g.fx.ring(this.x, this.rig.height * 0.7, this.z, this.def.glow, 1.4, 0.15, 0.2, 0.8); this.strikeAnim = 1; this.meleeHit(g, m); }
        if (this.hitDone >= (m.hits ?? 1) || this.hitsLeft <= 0) { if (this.mt >= next + 0.1 || this.hitsLeft <= 0) { this.state = 'recover'; this.mt = 0; } }
        else { this.yaw = dampAngle(this.yaw, toP, 8, dt); const sp = this.kit ? 2 : 3; if (dist > 1.8) { this.vx = Math.sin(this.yaw) * sp; this.vz = Math.cos(this.yaw) * sp; } }
        break;
      }
      case 'dash': case 'charge': {
        this.dashT -= dt; const sp = m.kind === 'charge' ? 26 : 20; this.vx = Math.sin(this.lockDir) * sp; this.vz = Math.cos(this.lockDir) * sp; this.strikeAnim = 1; g.fx.emit(this.x, 1, this.z, 0, 0.5, 0, this.kit ? this.bossDef.glow : this.def.glow, 0.4, 0.5);
        if (this.hitDone === 0 && dist < this.radius + 1.0 && Math.abs(p.pos.y) < 1.5) { this.hitDone = 1; this.hitPlayer(g, m, 1, 'melee'); if (m.kind === 'dash') { g.fx.slash(this.x, 1.3, this.z, this.lockDir, 0, 3.4, 3, this.def.glow, 0.2); } }
        const hitWall = g.world ? g.world.blocked(this.x + Math.sin(this.lockDir) * 1.2, this.z + Math.cos(this.lockDir) * 1.2, this.radius * 0.8) : false;
        if (this.dashT <= 0 || hitWall) { this.state = 'recover'; this.mt = 0; this.vx *= 0.2; this.vz *= 0.2; if (m.kind === 'charge' && hitWall) { g.shake(0.7); g.fx.ring(this.x, 0.1, this.z, 0xffffff, 8, 0.4); g.fx.burst(this.x, 1, this.z, 0xccbb99, 30, 10, 0.7, 0.4, 8); this.stunWall(g); } }
        break;
      }
      default: this.state = 'recover'; this.mt = 0;
    }
  }
  private stunWall(g: Game) { if (this.isBoss && Math.random() < 0.6) { this.posture += 40; g.callout('BOSS CRASHED!', '#ffe27a'); if (this.posture >= 100) this.startStun(g); } }
  private envStrike(g: Game) {
    const p = g.player, n = this.phase === 2 ? 3 : 5, col = this.bossDef.glow;
    for (let i = 0; i < n; i++) { const a = Math.random() * TAU, r = 3 + Math.random() * 11; let tx = p.pos.x + Math.sin(a) * r, tz = p.pos.z + Math.cos(a) * r; if (g.world) [tx, tz] = g.world.collide(tx, tz, 0.5); g.later(i * 0.3, () => { if (this.dead) return; g.fx.tele('circle', tx, tz, 0, 2.6, 0, 0xff5a2a, 1.3); g.later(1.3, () => { g.fx.blast(tx, 0.8, tz, col, 2, 0.35, 0.7); g.fx.pillar(tx, 0, tz, col, 1.4, 12, 0.3, 0.6); g.fx.ring(tx, 0.1, tz, col, 3.2, 0.35); g.fx.burst(tx, 0.4, tz, col, 20, 8, 0.6, 0.3, 8); g.shake(0.25); sfx('explode', 0.4); if (Math.hypot(p.pos.x - tx, p.pos.z - tz) < 2.9 && p.pos.y < 1.1) p.take(this.dmgBase * 0.9, { x: tx, z: tz, unblock: true, kind: 'aoe' }); }); }); }
  }
  dispose(g: Game) { g.fx.killTele(this.tele); g.scene.remove(this.rig.root); }
}
