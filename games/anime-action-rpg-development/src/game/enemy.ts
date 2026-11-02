import * as THREE from 'three';
import { Atk, EDef, ENEMIES, ELEM_COLOR, Element } from './data';
import { buildEnemyModel, Model, AnimIn } from './models';
import type { TG } from './fx';
import type { Game } from './engine';

const ang = (a: number, b: number) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

export class Enemy {
  def: EDef; lvl: number; model: Model; pos = new THREE.Vector3(); yaw = Math.random() * 6.28; y = 0; vy = 0; hp: number; maxHp: number; poise = 0; maxPoise: number;
  dmg: number; speed: number; state = 'idle'; t = 0; atk: Atk | null = null; aggro = false; dead = false; deadT = 0; stun = 0; stunKind = 'stagger'; knock = new THREE.Vector3();
  room: number; isBoss: boolean; phase = 0; atkCd = 1; tgs: (TG | null)[] = []; strafe = Math.random() < 0.5 ? 1 : -1; strafeT = 1; leap = new THREE.Vector3(); leapFrom = new THREE.Vector3(); hitDone = false;
  poiseT = 0; dodgeCd = 0; fled = false; invuln = false; vulnerable = 0; barG: THREE.Group; barFg: THREE.Mesh; radius: number; hover: number; flowT = 0; moving = 0; flowDir: [number, number] | null = null; rainPts: THREE.Vector3[] = [];
  blinked = false; rangedStreak = 0; beamYaw = 0; beamTick = 0; mult = 1; stuckT = 0; home = new THREE.Vector3(); lastDmgT = 0; seenT = 0; scale: number; wake = 0;

  constructor(def: EDef, lvl: number, x: number, z: number, room: number, g: Game) {
    this.def = def; this.lvl = lvl; this.room = room; this.isBoss = def.tier === 'boss'; this.model = buildEnemyModel(def.look); this.scale = def.look.scale || 1;
    this.pos.set(x, 0, z); this.home.copy(this.pos); this.hover = def.fly || 0;
    const k = this.isBoss ? 0.2 : 0.28; this.maxHp = this.hp = Math.round(def.hp * (1 + k * (lvl - 1)));
    this.dmg = def.dmg * (1 + 0.14 * (lvl - 1)); this.speed = def.speed; this.maxPoise = def.poise * (1 + 0.04 * lvl); this.radius = def.radius;
    this.model.root.position.copy(this.pos); g.scene.add(this.model.root);
    this.barG = new THREE.Group(); const bg = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.14), new THREE.MeshBasicMaterial({ color: 0x120a10, depthTest: false, transparent: true, opacity: 0.8 }));
    this.barFg = new THREE.Mesh(new THREE.PlaneGeometry(1.34, 0.09), new THREE.MeshBasicMaterial({ color: def.tier === 'elite' ? 0xffb02a : 0xff3a4a, depthTest: false })); this.barFg.position.z = 0.01;
    bg.renderOrder = 20; this.barFg.renderOrder = 21; this.barG.add(bg, this.barFg); this.barG.visible = false; g.scene.add(this.barG);
    if (this.isBoss) { this.state = 'dormant'; this.invuln = true; }
    if (def.tier === 'dummy') { this.aggro = false; }
  }
  get colR() { return this.isBoss ? Math.min(this.radius * 0.75, 2.2) : Math.min(this.radius, 1.1); }
  get height() { return this.def.height; }
  get reach() { return this.radius; }

  hideTg() { for (const t of this.tgs) t?.hide(); this.tgs = []; }
  pickAttack(dist: number, g: Game): Atk | null {
    const living = g.enemies.filter((e: Enemy) => !e.dead && !e.isBoss).length;
    const opts = this.def.attacks.filter((a) => a.phase <= this.phase && dist >= a.min && dist <= (a.max || 3) + (a.kind === 'summon' ? 99 : 0) && (a.kind !== 'summon' || living < 3));
    const rk = (a: Atk) => a.kind === 'shoot' || a.kind === 'rain' || a.kind === 'beam';
    const f2 = this.isBoss && this.rangedStreak >= 2 ? opts.filter((a) => !rk(a)) : opts; if (this.isBoss && this.rangedStreak >= 2) { if (!f2.length) return null; opts.length = 0; opts.push(...f2); }
    if (!opts.length) return null; const sum = opts.reduce((s, a) => s + a.weight, 0); let r = Math.random() * sum;
    for (const a of opts) { r -= a.weight; if (r <= 0) return a; } return opts[0];
  }

  applyDefense(raw: number, el: Element) {
    const r = this.def.res[el] ?? 0; let d = raw * (1 - this.def.armor / (this.def.armor + 60)); d *= 1 - r * 0.5; return Math.max(1, d);
  }
  takeHit(g: Game, raw: number, o: { kb?: number; dir?: THREE.Vector3; poise?: number; launch?: boolean; knockdown?: boolean; el?: Element; crit?: boolean; heavy?: boolean }): number {
    if (this.dead || this.state === 'dormant' || this.invuln) return 0;
    let dmg = this.applyDefense(raw, o.el || 'none'); if (this.vulnerable > 0) dmg *= 1.5;
    dmg = Math.round(dmg); this.hp -= dmg; this.lastDmgT = g.time; this.model.flash(0.9); this.aggro = true; if (this.state === 'idle') this.state = 'chase';
    this.wakeGroup(g);
    const kbScale = this.isBoss ? 0.1 : 1 / (0.6 + this.scale * 0.5);
    if (o.dir && o.kb) this.knock.set(o.dir.x, 0, o.dir.z).multiplyScalar(o.kb * 2.2 * kbScale);
    if (this.def.tier !== 'dummy') this.poise += o.poise ?? 5; this.poiseT = 3;
    const attacking = this.state === 'windup' || this.state === 'strike';
    if (this.def.tier === 'dummy') { this.stun = 0.25; this.stunKind = 'hit'; }
    else if (this.poise >= this.maxPoise && this.state !== 'phase') {
      this.poise = 0; this.hideTg(); this.state = 'stun'; this.stunKind = this.isBoss ? 'dazed' : 'stagger'; this.stun = this.isBoss ? 3 : 1.2; this.vulnerable = this.isBoss ? 3 : 0; this.atk = null;
      g.fx.pb.emit(this.pos.x, this.height * 0.9, this.pos.z, 24, { color: 0xfff0a0, speed: 5, life: 0.6 }); g.sfx('parry', this.pos);
      if (this.isBoss) g.hud('STAGGERED!', 0xffe14a);
    } else if (o.knockdown && !this.isBoss && this.def.tier !== 'elite') { this.hideTg(); this.state = 'stun'; this.stunKind = 'knock'; this.stun = 1.5; this.atk = null; }
    else if (o.launch && !this.isBoss && this.def.tier !== 'elite' && this.y < 2) { this.hideTg(); this.state = 'air'; this.vy = 8.5; this.stun = 0.9; this.stunKind = 'hit'; this.atk = null; }
    else if (!attacking && !this.isBoss && this.state !== 'stun' && (o.heavy || dmg > this.maxHp * 0.06)) { this.state = 'stun'; this.stunKind = 'hit'; this.stun = 0.3; }
    if (this.hp <= 0) { this.die(g); return dmg; }
    if (this.isBoss && this.def.phases && this.phase < this.def.phases.length && this.hp / this.maxHp < this.def.phases[this.phase]) this.startPhase(g);
    return dmg;
  }
  wakeGroup(g: Game) { for (const e of g.enemies) if (!e.aggro && !e.dead && e.def.tier !== 'dummy' && e.state !== 'dormant' && (e.room === this.room || e.pos.distanceTo(this.pos) < 14) && e.pos.distanceTo(this.pos) < 24) { e.aggro = true; e.state = 'chase'; } }
  startPhase(g: Game) {
    this.phase++; this.hideTg(); this.state = 'phase'; this.t = 0; this.invuln = true; this.atk = null; this.mult = 1 + 0.12 * this.phase; this.vulnerable = 0;
    g.sfx('roar', this.pos, 1.3); g.shake(0.8); g.fx.eff.ring(this.pos.x, this.pos.z, 1, 14, ELEM_COLOR[this.def.el], 0.9); g.fx.eff.pillar(this.pos.x, this.pos.z, 3, 14, ELEM_COLOR[this.def.el], 1.2);
    g.hud(`${this.def.name.toUpperCase()} — PHASE ${this.phase + 1}`, 0xff4a60); g.clearProjectiles();
  }
  die(g: Game) {
    if (this.dead) return; this.dead = true; this.hp = 0; this.state = 'dead'; this.hideTg(); this.deadT = 0; this.barG.visible = false; this.atk = null;
    g.fx.pb.emit(this.pos.x, this.height * 0.5, this.pos.z, this.isBoss ? 120 : 24, { color: ELEM_COLOR[this.def.el], speed: this.isBoss ? 12 : 5, life: 1, grav: 4 });
    g.sfx(this.isBoss ? 'explode' : 'death', this.pos, 1); g.onKill(this);
  }
  dispose(g: Game) { this.hideTg(); g.scene.remove(this.model.root); g.scene.remove(this.barG); this.model.dispose(); this.barG.traverse((o: any) => { o.material?.dispose?.(); o.geometry?.dispose?.(); }); }

  reactDodge(g: Game) {
    if (this.dead || this.state !== 'chase' || this.dodgeCd > 0 || !this.def.dodge || Math.random() > this.def.dodge) return;
    this.dodgeCd = 2.5; const a = this.yaw + (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2; this.knock.set(Math.sin(a) * 14, 0, Math.cos(a) * 14);
    g.fx.p.emit(this.pos.x, 0.3, this.pos.z, 8, { color: 0x888888, speed: 2, life: 0.4 });
  }

  update(dt: number, g: Game) {
    const p = g.p; const grid = g.level.grid; const model = this.model;
    const anim: AnimIn = { state: 'idle', speed: 0 };
    if (this.dead) {
      this.deadT += dt; anim.state = 'dead'; model.update(dt, anim); const sink = this.isBoss ? 4 : 2.2;
      if (this.deadT > sink) { const k = clamp((this.deadT - sink) / 1.2, 0, 1); model.root.position.y = -k * 1.5; if (k >= 1) this.removed = true; }
      else model.root.position.set(this.pos.x, this.hover * Math.max(0, 1 - this.deadT * 2) + this.y, this.pos.z);
      model.root.rotation.y = this.yaw; return;
    }
    if (this.state === 'dormant') { model.update(dt, anim); model.root.position.set(this.pos.x, this.y, this.pos.z); model.root.rotation.y = this.yaw; return; }
    this.dodgeCd -= dt; this.atkCd -= dt; this.t += dt; if (this.vulnerable > 0) this.vulnerable -= dt;
    if (this.poise > 0) { this.poiseT -= dt; if (this.poiseT <= 0) this.poise = Math.max(0, this.poise - dt * this.maxPoise * 0.15); }
    // knockback
    if (this.knock.lengthSq() > 0.05) { grid.move(this.pos, this.knock.x * dt, this.knock.z * dt, this.colR * 0.85); this.knock.multiplyScalar(Math.max(0, 1 - dt * 7)); }
    // vertical
    if (this.y > 0 || this.vy > 0) { this.vy -= (this.hover ? 18 : 26) * dt; this.y += this.vy * dt; if (this.y <= 0) { this.y = 0; this.vy = 0; } }
    const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z; const dist = Math.hypot(dx, dz); const toP = Math.atan2(dx, dz);
    const turn = (rate: number) => { this.yaw += clamp(ang(this.yaw, toP), -rate * dt, rate * dt); };
    let speedMul = 1 * (this.isBoss ? 1 + this.phase * 0.08 : 1);
    if (this.def.tier === 'dummy') { anim.state = 'idle'; if (this.stun > 0) { this.stun -= dt; anim.state = 'hit'; } model.update(dt, anim); this.sync(g); this.updBar(g); return; }

    const los = grid.ray(this.pos.x, this.pos.z, p.pos.x, p.pos.z, false) >= 1;
    switch (this.state) {
      case 'idle': {
        if (dist < this.def.detect && (los || dist < 6) && p.hp > 0) { this.aggro = true; this.state = 'chase'; this.wakeGroup(g); g.sfx('enemyAtk', this.pos, 0.5); }
        break;
      }
      case 'chase': {
        if (p.hp <= 0) { this.state = 'idle'; this.aggro = false; break; }
        turn(7);
        // flee behaviour
        if (this.def.flee && !this.fled && this.hp / this.maxHp < 0.25) { this.fled = true; this.state = 'flee'; this.t = 0; break; }
        const pref = this.def.pref * (this.isBoss ? 1 : 1);
        const inRange = this.atkCd <= 0 && this.canAttackNow(g);
        if (inRange) { const a = this.pickAttack(dist, g); if (a) { this.beginAttack(a, g, dist); break; } }
        let mx = 0, mz = 0; let mv = 0;
        if (dist > pref + 0.6) { // approach
          let tx = p.pos.x, tz = p.pos.z;
          if (!los) { this.flowT -= dt; if (this.flowT <= 0 || !this.flowDir) { this.flowDir = grid.flowNext(this.pos.x, this.pos.z); this.flowT = 0.25; } if (this.flowDir) { tx = this.flowDir[0]; tz = this.flowDir[1]; } }
          const d = Math.hypot(tx - this.pos.x, tz - this.pos.z) || 1; mx = (tx - this.pos.x) / d; mz = (tz - this.pos.z) / d; mv = 1;
          if (!los && this.flowDir) { const a = Math.atan2(mx, mz); this.yaw += clamp(ang(this.yaw, a), -9 * dt, 9 * dt); }
        } else if (dist < pref - 1.2 && pref > 4) { mx = -dx / dist; mz = -dz / dist; mv = 0.8; }
        else { // strafe
          this.strafeT -= dt; if (this.strafeT <= 0) { this.strafe = Math.random() < 0.5 ? 1 : -1; this.strafeT = 1.5 + Math.random() * 2; }
          mx = (dz / dist) * this.strafe; mz = (-dx / dist) * this.strafe; mv = 0.55;
        }
        // separation
        for (const e of g.enemies) { if (e === this || e.dead) continue; const ex = this.pos.x - e.pos.x, ez = this.pos.z - e.pos.z; const d = Math.hypot(ex, ez); const m = this.colR + e.colR + 0.4; if (d < m && d > 0.001) { mx += (ex / d) * (m - d) * 1.5; mz += (ez / d) * (m - d) * 1.5; } }
        const l = Math.hypot(mx, mz); if (l > 0.01) { const sp = this.speed * speedMul * mv * (g.p.status.slow > 0 ? 1 : 1); const k = Math.min(1, l) * sp * dt / l; const before = this.pos.x * 1000 + this.pos.z; grid.move(this.pos, mx * k, mz * k, this.colR * 0.85); void before; this.moving = sp * Math.min(1, l); } else this.moving = 0;
        if (grid.blocked(this.pos.x, this.pos.z, this.colR * 0.6)) grid.unstick(this.pos, this.colR * 0.6);
        anim.state = this.moving > 0.3 ? 'move' : 'idle'; anim.speed = this.moving;
        break;
      }
      case 'flee': {
        const a = Math.atan2(-dx, -dz); this.yaw += clamp(ang(this.yaw, a), -10 * dt, 10 * dt); grid.move(this.pos, Math.sin(this.yaw) * this.speed * 1.2 * dt, Math.cos(this.yaw) * this.speed * 1.2 * dt, this.colR * 0.85);
        anim.state = 'move'; anim.speed = this.speed * 1.2; if (this.t > 3) { this.state = 'chase'; } break;
      }
      case 'windup': this.updWindup(dt, g, dist, toP, anim); break;
      case 'strike': this.updStrike(dt, g, dist, toP, anim); break;
      case 'recover': {
        const a = this.atk!; anim.state = 'attack'; anim.style = a.anim; anim.t = 0.6 + 0.4 * clamp(this.t / a.rec, 0, 1);
        if (this.t >= a.rec) { this.state = 'chase'; this.atk = null; this.atkCd = this.isBoss ? 0.25 + Math.random() * 0.7 : 0.5 + Math.random() * 1.1; if (this.isBoss && Math.random() < 0.25) this.atkCd += 0.8; }
        break;
      }
      case 'stun': { this.stun -= dt; anim.state = this.stunKind; anim.t = clamp(1 - this.stun / 1.4, 0, 1); if (this.stun <= 0) { this.state = 'chase'; this.atkCd = Math.max(this.atkCd, 0.3); } break; }
      case 'air': { this.stun -= dt; anim.state = 'hit'; if (this.y <= 0 && this.vy <= 0 && this.stun <= 0) { this.state = 'chase'; } else if (this.y <= 0 && this.vy === 0) { this.stun = Math.min(this.stun, 0.2); } break; }
      case 'phase': {
        anim.state = 'roar'; anim.t = clamp(this.t / 1.8, 0, 1) * 0.6 + 0.1; if (this.t > 1.8) { this.state = 'chase'; this.invuln = false; this.atkCd = 0.5; this.onPhaseEnd(g); }
        break;
      }
    }
    // hover bob
    this.sync(g, anim); model.update(dt, anim); this.updBar(g);
    // pit/oob safety
    if (grid.blocked(this.pos.x, this.pos.z, 0.1)) grid.unstick(this.pos, 0.2);
  }
  removed = false;
  onPhaseEnd(g: Game) {
    const adds = this.def.attacks.find((a) => a.kind === 'summon' && a.phase <= this.phase);
    if (adds && this.def.tier === 'boss' && g.enemies.filter((e: Enemy) => !e.dead && !e.isBoss).length < 3) this.doSummon(g, adds);
  }
  sync(g: Game, anim?: AnimIn) {
    void g; void anim;
    this.model.root.position.set(this.pos.x, this.hover + this.y, this.pos.z); this.model.root.rotation.y = this.yaw;
  }
  updBar(g: Game) {
    const show = !this.isBoss && this.def.tier !== 'dummy' ? this.aggro || this.hp < this.maxHp : this.def.tier === 'dummy' && g.time - this.lastDmgT < 3;
    this.barG.visible = show && !this.dead && this.pos.distanceTo(g.p.pos) < 40;
    if (!this.barG.visible) return;
    this.barG.position.set(this.pos.x, this.hover + this.y + this.height + 0.6, this.pos.z); this.barG.quaternion.copy(g.camera.quaternion);
    const f = clamp(this.hp / this.maxHp, 0.001, 1); this.barFg.scale.x = f; this.barFg.position.x = -0.67 * (1 - f);
  }
  canAttackNow(g: Game): boolean {
    if (this.isBoss) return true; let n = 0; for (const e of g.enemies) if (e !== this && !e.dead && (e.state === 'windup' || e.state === 'strike') && e.pos.distanceTo(g.p.pos) < 20) n++;
    return n < (this.def.pref > 6 ? 3 : 2);
  }
  beginAttack(a: Atk, g: Game, dist: number) {
    void dist; this.rangedStreak = a.kind === 'shoot' || a.kind === 'rain' || a.kind === 'beam' ? this.rangedStreak + 1 : 0; this.atk = a; this.state = 'windup'; this.t = 0; this.hitDone = false; this.blinked = false; this.hideTg();
    const col = a.col; const r = a.r * (this.isBoss && a.kind !== 'wave' ? 1 : 1);
    switch (a.kind) {
      case 'melee': case 'beam': this.tgs = [g.fx.tg.show('cone', a.kind === 'beam' ? a.r : r, (a.arc * Math.PI) / 180, col)]; break;
      case 'slam': this.tgs = [g.fx.tg.show('circle', r, 0, col)]; break;
      case 'smash': this.tgs = [g.fx.tg.show('circle', r, 0, col)]; break;
      case 'dash': this.tgs = [g.fx.tg.show('line', r, Math.max(1.8, this.colR * 1.8), col)]; break;
      case 'leap': this.leap.copy(g.p.pos); this.tgs = [g.fx.tg.show('circle', r, 0, col)]; break;
      case 'rain': {
        this.rainPts = []; const cnt = a.count; for (let i = 0; i < cnt; i++) { const pt = new THREE.Vector3(g.p.pos.x, 0, g.p.pos.z); if (i > 0) { const an = Math.random() * 6.28, d = 2 + Math.random() * 8; pt.x += Math.cos(an) * d; pt.z += Math.sin(an) * d; } if (g.level.grid.solidAt(pt.x, pt.z)) { pt.x = g.p.pos.x; pt.z = g.p.pos.z; } this.rainPts.push(pt); this.tgs.push(g.fx.tg.show('circle', r, 0, col)); }
        break;
      }
      case 'blink': this.tgs = []; break;
      case 'summon': g.fx.eff.ring(this.pos.x, this.pos.z, 1, 6, ELEM_COLOR[this.def.el], a.wind); break;
    }
    if (a.kind !== 'shoot' && a.kind !== 'summon') g.sfx('enemyAtk', this.pos, this.isBoss ? 1 : 0.6);
    if (a.anim === 'roar' || a.kind === 'summon') g.sfx('roar', this.pos, 0.9);
  }
  updWindup(dt: number, g: Game, dist: number, toP: number, anim: AnimIn) {
    const a = this.atk!; const k = clamp(this.t / a.wind, 0, 1); anim.state = 'attack'; anim.style = a.anim; anim.t = 0.35 * k;
    const track = k < 0.6;
    if (track && a.kind !== 'rain') { this.yaw += clamp(ang(this.yaw, toP), -5 * dt, 5 * dt); }
    switch (a.kind) {
      case 'melee': case 'beam': this.tgs[0]?.set(this.pos.x, this.pos.z, this.yaw, k); break;
      case 'slam': this.tgs[0]?.set(this.pos.x, this.pos.z, 0, k); break;
      case 'smash': this.tgs[0]?.set(this.pos.x + Math.sin(this.yaw) * (a.off ?? 2.5), this.pos.z + Math.cos(this.yaw) * (a.off ?? 2.5), 0, k); break;
      case 'dash': this.tgs[0]?.set(this.pos.x, this.pos.z, this.yaw, k); break;
      case 'leap': if (track) this.leap.set(g.p.pos.x, 0, g.p.pos.z); this.tgs[0]?.set(this.leap.x, this.leap.z, 0, k); break;
      case 'rain': this.tgs.forEach((t, i) => t?.set(this.rainPts[i].x, this.rainPts[i].z, 0, k)); break;
      case 'blink': {
        if (k < 0.5) { const s = 1 - k * 2; this.model.root.scale.setScalar(Math.max(0.02, s) * this.scale); }
        else {
          if (!this.blinked) { this.blinked = true; const bx = g.p.pos.x - Math.sin(g.p.yaw) * (this.colR + 1.4), bz = g.p.pos.z - Math.cos(g.p.yaw) * (this.colR + 1.4); g.fx.p.emit(this.pos.x, 1, this.pos.z, 20, { color: ELEM_COLOR[this.def.el], speed: 4, life: 0.5 }); if (!g.level.grid.blocked(bx, bz, 0.5)) { this.pos.x = bx; this.pos.z = bz; } else { this.pos.x = g.p.pos.x + Math.sin(this.yaw) * 2; this.pos.z = g.p.pos.z + Math.cos(this.yaw) * 2; } g.fx.p.emit(this.pos.x, 1, this.pos.z, 20, { color: ELEM_COLOR[this.def.el], speed: 4, life: 0.5 }); this.yaw = Math.atan2(g.p.pos.x - this.pos.x, g.p.pos.z - this.pos.z); this.tgs = [g.fx.tg.show('cone', a.r, (a.arc * Math.PI) / 180, a.col)]; g.sfx('dodge', this.pos); }
          this.model.root.scale.setScalar(Math.min(1, (k - 0.5) * 4) * this.scale + 0.001);
          this.yaw += clamp(ang(this.yaw, Math.atan2(g.p.pos.x - this.pos.x, g.p.pos.z - this.pos.z)), -6 * dt, 6 * dt);
          this.tgs[0]?.set(this.pos.x, this.pos.z, this.yaw, (k - 0.5) * 2);
        }
        break;
      }
    }
    void dist;
    if (this.t >= a.wind) { this.state = 'strike'; this.t = 0; this.strikeInit(g); }
  }
  strikeInit(g: Game) {
    const a = this.atk!; this.model.root.scale.setScalar(this.scale);
    const dmg = this.dmg * a.dmg * this.mult; const p = g.p;
    const hitP = (cond: boolean, o: { kb?: number } = {}) => { if (cond && !this.hitDone) { if (g.hurtPlayer(dmg, this.pos, { knock: a.knock, kb: o.kb ?? (a.knock ? 9 : 4), status: a.status, poise: 20, src: this })) this.hitDone = true; } };
    const inCone = (range: number, arc: number) => { const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z; const d = Math.hypot(dx, dz); if (d > range + 0.5) return false; if (g.level.grid.ray(this.pos.x, this.pos.z, p.pos.x, p.pos.z, false) < 1) return false; const da = Math.abs(ang(this.yaw, Math.atan2(dx, dz))); return da < (arc * Math.PI) / 360 + Math.atan2(0.5, Math.max(d, 0.5)); };
    switch (a.kind) {
      case 'melee': case 'blink': g.fx.eff.crescent(this.pos.x, 1 + this.scale * 0.3, this.pos.z, this.yaw, a.r, (a.arc * Math.PI) / 180, a.col, 0.28); hitP(inCone(a.r, a.arc)); if (this.isBoss) g.shake(0.3); g.sfx('swingHeavy', this.pos); break;
      case 'slam': { g.fx.eff.ring(this.pos.x, this.pos.z, 1, a.r, a.col, 0.5); g.fx.pb.emit(this.pos.x, 0.3, this.pos.z, 30, { color: a.col, speed: a.r * 1.5, life: 0.5, grav: 6 }); g.shake(0.5 + a.r * 0.04); g.sfx('slam', this.pos); const d = Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z); hitP(d < a.r + 0.4 && p.pos.y < 1.2); break; }
      case 'smash': { const cx = this.pos.x + Math.sin(this.yaw) * (a.off ?? 2.5), cz = this.pos.z + Math.cos(this.yaw) * (a.off ?? 2.5); g.fx.eff.ring(cx, cz, 1, a.r, a.col, 0.5); g.fx.eff.burst(cx, 0.6, cz, a.r * 0.7, a.col, 0.3); g.fx.pb.emit(cx, 0.3, cz, 26, { color: a.col, speed: a.r * 1.6, life: 0.5, grav: 8 }); g.shake(0.6); g.sfx('slam', this.pos); hitP(Math.hypot(p.pos.x - cx, p.pos.z - cz) < a.r + 0.4 && p.pos.y < 1.5); break; }
      case 'shoot': { const n = a.count; const base = Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z); for (let i = 0; i < n; i++) { const off = n === 1 ? 0 : ((i / (n - 1)) - 0.5) * (a.spread * Math.PI) / 180; const ya = base + off; g.shoot({ x: this.pos.x + Math.sin(ya) * (this.colR + 0.3), y: Math.min(this.hover + this.y + this.height * 0.6, 2.0), z: this.pos.z + Math.cos(ya) * (this.colR + 0.3), dx: Math.sin(ya), dz: Math.cos(ya), speed: a.speed, dmg, color: a.col, owner: 'enemy', status: a.status, radius: 0.35 + this.scale * 0.1 }); } g.sfx('shoot', this.pos); break; }
      case 'rain': { for (const pt of this.rainPts) { g.fx.eff.pillar(pt.x, pt.z, a.r, 9, a.col, 0.6); g.fx.eff.ring(pt.x, pt.z, 0.5, a.r, a.col, 0.4); g.fx.pb.emit(pt.x, 0.4, pt.z, 14, { color: a.col, speed: 5, life: 0.5, grav: 8 }); if (Math.hypot(p.pos.x - pt.x, p.pos.z - pt.z) < a.r + 0.3) hitP(true); } g.shake(0.4); g.sfx('explode', this.pos, 0.8); break; }
      case 'wave': g.addWave({ x: this.pos.x, z: this.pos.z, speed: a.speed, max: a.r, dmg, color: a.col, src: this }); g.shake(0.5); g.sfx('slam', this.pos, 1.1); g.hud('JUMP!', 0xffffff); break;
      case 'summon': this.doSummon(g, a); break;
      case 'leap': { this.leapFrom.copy(this.pos); this.leapFrom.y = 0; g.sfx('jump', this.pos); break; }
      case 'beam': { this.beamYaw = this.yaw; this.beamTick = 0; break; }
      case 'dash': { g.sfx('dodge', this.pos, 1); break; }
    }
  }
  doSummon(g: Game, a: Atk) {
    const ids = a.summon || []; const alive = g.enemies.filter((e: Enemy) => !e.dead && !e.isBoss).length; if (alive > 6) return;
    ids.forEach((id, i) => { const an = (i / ids.length) * 6.28 + Math.random(); const x = this.pos.x + Math.cos(an) * (this.colR + 3.5), z = this.pos.z + Math.sin(an) * (this.colR + 3.5); if (!ENEMIES[id]) return; const nx = g.level.grid.blocked(x, z, 0.6) ? this.pos.x : x, nz = g.level.grid.blocked(x, z, 0.6) ? this.pos.z + 3 : z; const e = g.spawnEnemy(id, nx, nz, Math.max(1, this.lvl - 2), this.room, true); g.fx.pb.emit(nx, 0.5, nz, 20, { color: ELEM_COLOR[this.def.el], speed: 5, life: 0.6 }); g.fx.eff.pillar(nx, nz, 1.2, 6, ELEM_COLOR[this.def.el], 0.6); void e; });
  }
  updStrike(dt: number, g: Game, dist: number, toP: number, anim: AnimIn) {
    const a = this.atk!; const k = clamp(this.t / Math.max(0.01, a.act), 0, 1); anim.state = 'attack'; anim.style = a.anim; anim.t = 0.35 + 0.25 * k; void toP; void dist;
    const p = g.p; const dmg = this.dmg * a.dmg * this.mult; const grid = g.level.grid;
    switch (a.kind) {
      case 'dash': {
        const step = a.speed * dt; const sx = this.pos.x, sz = this.pos.z; grid.move(this.pos, Math.sin(this.yaw) * step, Math.cos(this.yaw) * step, this.colR * 0.85);
        const moved = Math.hypot(this.pos.x - sx, this.pos.z - sz); this.moving = a.speed; anim.state = 'attack'; g.fx.p.emit(this.pos.x, 0.3, this.pos.z, 2, { color: a.col, speed: 2, life: 0.3 });
        const w = Math.max(1.8, this.colR * 1.8) / 2 + 0.45; const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z; const fwd = dx * Math.sin(this.yaw) + dz * Math.cos(this.yaw); const side = Math.abs(dx * Math.cos(this.yaw) - dz * Math.sin(this.yaw));
        if (!this.hitDone && fwd > -1 && fwd < this.colR + 1.4 && side < w + this.colR * 0.5 && p.pos.y < 1.5) { if (g.hurtPlayer(dmg, this.pos, { knock: a.knock, kb: 8, status: a.status, poise: 25, src: this })) this.hitDone = true; }
        if (moved < step * 0.3 && this.isBoss && this.t > 0.15) { this.hideTg(); this.state = 'stun'; this.stunKind = 'dazed'; this.stun = 2.6; this.vulnerable = 2.6; this.atk = null; g.shake(0.9); g.sfx('slam', this.pos, 1.2); g.fx.pb.emit(this.pos.x + Math.sin(this.yaw) * this.colR, 1.5, this.pos.z + Math.cos(this.yaw) * this.colR, 40, { color: 0xfff0a0, speed: 8, life: 0.7, grav: 6 }); g.hud('STAGGERED!', 0xffe14a); return; }
        break;
      }
      case 'leap': {
        const f = k; this.pos.x = this.leapFrom.x + (this.leap.x - this.leapFrom.x) * f; this.pos.z = this.leapFrom.z + (this.leap.z - this.leapFrom.z) * f; this.y = Math.sin(f * Math.PI) * (3 + this.scale); anim.state = 'attack';
        if (f >= 1) { this.y = 0; const d = Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z); g.fx.eff.ring(this.pos.x, this.pos.z, 1, a.r + 1, a.col, 0.5); g.fx.pb.emit(this.pos.x, 0.3, this.pos.z, 30, { color: a.col, speed: a.r * 1.5, life: 0.5, grav: 6 }); g.shake(0.7); g.sfx('slam', this.pos); if (d < a.r + 0.5 && p.pos.y < 1.2 && !this.hitDone) { if (g.hurtPlayer(dmg, this.pos, { knock: a.knock, kb: 8, status: a.status, poise: 25, src: this })) this.hitDone = true; } }
        break;
      }
      case 'beam': {
        this.yaw += clamp(ang(this.yaw, Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z)), -0.9 * dt, 0.9 * dt); this.beamTick -= dt;
        for (let i = 0; i < 3; i++) { const d = 1 + Math.random() * a.r; const sp = (Math.random() - 0.5) * 0.5; g.fx.pb.emit(this.pos.x + Math.sin(this.yaw + sp * 0.3) * d, this.hover + this.y + 1.2 + this.scale * 0.2, this.pos.z + Math.cos(this.yaw + sp * 0.3) * d, 1, { color: a.col, speed: 1.5, life: 0.4 }); }
        if (this.beamTick <= 0) { this.beamTick = 0.12; const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z; const d = Math.hypot(dx, dz); const da = Math.abs(ang(this.yaw, Math.atan2(dx, dz))); if (d < a.r + 0.5 && da < (a.arc * Math.PI) / 360 + 0.08 && grid.ray(this.pos.x, this.pos.z, p.pos.x, p.pos.z, false) >= 1) g.hurtPlayer(dmg, this.pos, { status: a.status, poise: 6, src: this, tick: true }); }
        this.tgs[0]?.set(this.pos.x, this.pos.z, this.yaw, 1);
        break;
      }
      default: break;
    }
    if (this.t >= a.act) { this.hideTg(); this.state = 'recover'; this.t = 0; this.y = a.kind === 'leap' ? 0 : this.y; }
  }
}
