import * as THREE from "three";
import type { Action, FighterDef, MoveData } from "./data";
import { buildRig, type FighterRig } from "./rig";
import { ANIMS, POSES } from "./poses";
import type { PlayerInput } from "./input";
import { EL_COLORS, type El, type Ribbon } from "./vfx";
import type { Game } from "./engine";
import { startUlt, updateUlt, cancelUlt, type UltState } from "./ultimates";
import type { FighterStats } from "./store";

export type FState =
  | "idle" | "jump" | "dash" | "attack" | "block" | "hit" | "launched" | "down" | "getup"
  | "frozen" | "transform" | "ult" | "ko" | "win" | "guardbreak" | "locked";

const GRAV = 32;
const JUMP_V = 12.5;
const BUF: Action[] = ["light", "heavy", "s1", "s2", "ult", "dash", "jump", "transform", "block"];
const ang = (a: number) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

export class Fighter {
  rig: FighterRig;
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  yaw = 0;
  face = new THREE.Vector3(0, 0, 1);
  radius = 0.5;
  hp: number;
  maxHp: number;
  ki = 70;
  ultMeter = 0;
  xf = 0;
  guard = 100;
  transformed = false;
  xfTime = 0;
  state: FState = "locked";
  stateT = 0;
  t = 0;
  move: MoveData | null = null;
  moveT = 0;
  moveHit = false;
  rehitT = 0;
  spawned = 0;
  lightIdx = 0;
  cd = { s1: 0, s2: 0, sig: 0 };
  invuln = 0;
  hitstun = 0;
  combo = 0;
  comboDmg = 0;
  comboTimer = 0;
  lastDmg = 0;
  blockT = 0;
  parryOpen = false;
  parryLock = 0;
  parryFlash = 0;
  dashCd = 0;
  dashT = 0;
  dashDir = new THREE.Vector3();
  landLock = 0;
  slowT = 0;
  frozenT = 0;
  airHits = 0;
  airDashUsed = false;
  wasAir = false;
  ultS: UltState | null = null;
  stats: FighterStats = { damage: 0, maxCombo: 0, hits: 0, blocks: 0, parries: 0, ultimates: 0 };
  buf: Record<string, number> = {};
  ribbons: Ribbon[] = [];
  trailLimbs: THREE.Object3D[] = [];
  xfT = 0;
  xfPhase = 0;
  teleported = false;
  spikeFlag = false;
  fromSpike = false;
  tmp = new THREE.Vector3();
  tmp2 = new THREE.Vector3();
  auraLight: THREE.PointLight;
  glowTarget = 0;
  opp!: Fighter;
  koSpin = 0;

  constructor(public idx: 0 | 1, public def: FighterDef, public game: Game) {
    this.rig = buildRig(def.id);
    this.hp = this.maxHp = def.hp;
    this.auraLight = new THREE.PointLight(def.glow, 0, 9, 1.6);
    game.scene.add(this.auraLight);
    game.scene.add(this.rig.root);
    const el = def.element as El;
    const c = EL_COLORS[el].main;
    for (const limb of [this.rig.handL, this.rig.handR, this.rig.footL, this.rig.footR]) {
      this.trailLimbs.push(limb);
      this.ribbons.push(game.vfx.makeRibbon(c, 14, 0.16, 0.26));
    }
    for (const a of BUF) this.buf[a] = 0;
  }

  get air() { return this.pos.y > 0.06; }
  get element(): El { return this.def.element; }
  get dmgMul() { return this.def.power * (this.transformed ? 1.3 : 1); }
  get speed() { return this.def.speed * (this.transformed ? 1.2 : 1) * (this.slowT > 0 ? 0.55 : 1); }
  get blocking() { return this.state === "block"; }

  reset(x: number, z: number, yaw: number, full = true) {
    this.cancelMove();
    if (this.ultS) cancelUlt(this.game, this);
    this.pos.set(x, 0, z);
    this.vel.set(0, 0, 0);
    this.yaw = yaw;
    this.face.set(Math.sin(yaw), 0, Math.cos(yaw));
    this.state = "locked"; this.stateT = 0;
    this.invuln = 0; this.hitstun = 0; this.combo = 0; this.comboDmg = 0; this.comboTimer = 0; this.slowT = 0; this.frozenT = 0;
    this.cd = { s1: 0, s2: 0, sig: 0 };
    this.dashCd = 0; this.airHits = 0; this.guard = 100;
    this.rig.root.visible = true;
    this.rig.iceShell.visible = false;
    this.rig.grounded = true;
    if (full) {
      this.hp = this.maxHp;
      this.ki = 70;
      this.ultMeter = Math.min(this.ultMeter, 100);
    }
    if (this.transformed) this.endTransform(true);
    this.rig.setPose("idle"); this.rig.snap();
    for (const a of BUF) this.buf[a] = 0;
  }

  setState(s: FState) { this.state = s; this.stateT = 0; }

  // ------------------------------------------------------------------ main update
  update(dt: number, inp: PlayerInput | null) {
    const g = this.game;
    this.t += dt;
    this.stateT += dt;
    this.invuln = Math.max(0, this.invuln - dt);
    this.cd.s1 -= dt; this.cd.s2 -= dt; this.cd.sig -= dt;
    this.dashCd -= dt; this.landLock -= dt; this.parryLock -= dt; this.parryFlash -= dt; this.slowT -= dt;
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0 && !["hit", "launched", "frozen", "guardbreak"].includes(this.opp.state)) { this.combo = 0; this.comboDmg = 0; }
    }
    const alive = this.state !== "ko";
    if (alive && this.state !== "locked") {
      const f = this.transformed ? 1.8 : 1;
      this.ki = Math.min(100, this.ki + 7 * f * dt);
      if (this.state !== "ult") this.ultMeter = Math.min(100, this.ultMeter + 0.6 * dt);
      if (this.state !== "block") this.guard = Math.min(100, this.guard + 20 * dt);
    }
    if (g.practice.infKi) { this.ki = 100; this.cd.s1 = this.cd.s2 = this.cd.sig = Math.min(this.cd.s1, 0.3); }
    if (this.transformed && this.state !== "transform") {
      this.xfTime -= dt;
      if (this.xfTime <= 0) this.endTransform(false);
    }
    // input buffer
    for (const a of BUF) {
      if (inp && inp.pressed[a]) this.buf[a] = 0.15;
      else this.buf[a] = Math.max(0, this.buf[a] - dt);
    }
    const free = !!inp;
    // facing
    const dx = this.opp.pos.x - this.pos.x, dz = this.opp.pos.z - this.pos.z;
    const wantYaw = Math.atan2(dx, dz);
    const trackFace = ["idle", "jump", "block", "locked", "win", "getup"].includes(this.state) || (this.state === "attack" && this.move && this.moveT < this.move.startup) || this.state === "transform";
    if (trackFace && (Math.abs(dx) + Math.abs(dz) > 0.05)) this.yaw += ang(wantYaw - this.yaw) * (1 - Math.exp(-20 * dt));
    this.face.set(Math.sin(this.yaw), 0, Math.cos(yawFix(this.yaw)));

    let moveIn = this.tmp2.set(0, 0, 0);
    if (inp) moveIn.set(inp.ax, 0, inp.az);
    if (moveIn.lengthSq() > 1) moveIn.normalize();

    switch (this.state) {
      case "locked": this.rig.setPose("idle", 10); this.vel.x *= 0.8; this.vel.z *= 0.8; break;
      case "idle":
      case "jump":
      case "block":
        if (free) this.handleFree(inp!, moveIn, dt);
        else { this.stopHorizontal(dt); this.setLocoPose(); }
        break;
      case "dash": this.updateDash(dt, inp); break;
      case "attack": this.updateAttack(dt, inp); break;
      case "hit": this.updateHit(dt); break;
      case "launched": this.updateLaunched(dt, inp); break;
      case "down":
        this.rig.setPose("down", 16); this.vel.x *= Math.exp(-7 * dt); this.vel.z *= Math.exp(-7 * dt);
        if (this.stateT > 0.6) this.setState("getup");
        break;
      case "getup":
        this.rig.setPose("getup", 14); this.invuln = Math.max(this.invuln, 0.1);
        if (this.stateT > 0.35) { this.setState("idle"); this.invuln = 0.25; }
        break;
      case "frozen":
        this.frozenT -= dt; this.rig.setPose("frozen", 30); this.vel.x = this.vel.z = 0;
        if (this.frozenT <= 0) this.unfreeze(false);
        break;
      case "guardbreak":
        this.rig.setPose("hit", 10); this.stopHorizontal(dt);
        if (this.stateT > 1.1) { this.setState("idle"); this.guard = 60; }
        break;
      case "transform": this.updateTransform(dt); break;
      case "ult": updateUlt(g, this, dt); break;
      case "win": this.rig.setPose("victory", 8); this.stopHorizontal(dt); break;
      case "ko":
        this.rig.setPose("down", 10); this.vel.x *= Math.exp(-3 * dt); this.vel.z *= Math.exp(-3 * dt);
        break;
    }
    this.physics(dt);
    this.visuals(dt);
  }

  private stopHorizontal(dt: number) { const k = Math.exp(-14 * dt); this.vel.x *= k; this.vel.z *= k; }

  private setLocoPose() {
    if (this.air) this.rig.setPose(this.vel.y > 0 ? "jump" : "fall", 10);
    else if (this.state === "block") this.rig.setPose(this.parryFlash > 0 ? "parry" : "block", 18);
    else this.rig.setPose("idle", 12);
  }

  // ------------------------------------------------------------------ free state
  private canUse(k: "s1" | "s2" | "sig", m: MoveData) { return this.cd[k] <= 0 && this.ki >= m.ki; }
  private spend(k: "s1" | "s2" | "sig", m: MoveData) {
    this.ki = Math.max(0, this.ki - m.ki);
    this.cd[k] = m.cd * (this.transformed ? 0.7 : 1);
  }

  private handleFree(inp: PlayerInput, moveIn: THREE.Vector3, dt: number) {
    const g = this.game;
    const air = this.air;
    const d = this.def;
    const b = this.buf;
    if (this.landLock > 0 && !air) { this.stopHorizontal(dt); this.rig.setPose("idle", 12); return; }
    if (b.transform > 0 && !this.transformed && this.xf >= 100 && !air) { b.transform = 0; this.startTransform(); return; }
    if (b.ult > 0 && this.ultMeter >= 100 && !g.ultActiveFor(this)) { b.ult = 0; this.ultMeter = 0; this.setState("ult"); startUlt(g, this); return; }
    if (b.heavy > 0) {
      b.heavy = 0;
      if (air) { this.startMove(d.airHeavy); return; }
      if (this.canUse("sig", d.sig)) { this.spend("sig", d.sig); this.startMove(d.sig); return; }
      this.startMove(d.heavy); return;
    }
    if (b.s1 > 0 && this.canUse("s1", d.s1)) { b.s1 = 0; this.spend("s1", d.s1); this.startMove(d.s1); return; }
    if (b.s2 > 0 && this.canUse("s2", d.s2)) { b.s2 = 0; this.spend("s2", d.s2); this.startMove(d.s2); return; }
    if (b.light > 0) {
      b.light = 0;
      this.lightIdx = 0;
      this.startMove(air ? d.airLight : d.light[0]);
      return;
    }
    if (b.dash > 0 && this.dashCd <= 0 && (!air || !this.airDashUsed)) { b.dash = 0; this.startDash(moveIn); return; }
    if (b.jump > 0 && !air) { b.jump = 0; this.vel.y = JUMP_V; this.setState("jump"); g.sfx("jump", this.pos); g.vfx.dust(this.pos, 6, 2.5); }
    // block
    if (inp.held.block && !air) {
      if (this.state !== "block") {
        this.setState("block");
        this.blockT = 0;
        this.parryOpen = this.parryLock <= 0;
        if (this.parryOpen) this.parryLock = 0.7;
      }
      this.blockT += dt;
      if (this.blockT > 0.2) this.parryOpen = false;
    } else if (this.state === "block") {
      this.setState("idle");
    } else if (this.state === "idle" && air) this.setState("jump");
    // movement
    const accel = air ? 7 : 22;
    const sp = this.speed * (this.state === "block" ? 0.35 : 1) * (air ? 0.85 : 1);
    const k = 1 - Math.exp(-accel * dt);
    this.vel.x += (moveIn.x * sp - this.vel.x) * k;
    this.vel.z += (moveIn.z * sp - this.vel.z) * k;
    if (this.state === "jump" && !air && this.vel.y <= 0) this.setState("idle");
    this.setLocoPose();
    const spd = Math.hypot(this.vel.x, this.vel.z);
    this.rig.walk += ((air ? 0 : Math.min(1, spd / (this.def.speed))) - this.rig.walk) * (1 - Math.exp(-16 * dt));
  }

  // ------------------------------------------------------------------ dash
  private startDash(moveIn: THREE.Vector3) {
    const g = this.game;
    if (moveIn.lengthSq() > 0.05) this.dashDir.copy(moveIn).normalize();
    else this.dashDir.set(-this.face.x, 0, -this.face.z); // back-step
    this.setState("dash");
    this.dashT = 0;
    this.invuln = Math.max(this.invuln, 0.16);
    this.dashCd = 0.5;
    if (this.air) { this.airDashUsed = true; this.vel.y = 1; }
    this.vel.set(this.dashDir.x * 17, this.air ? 1 : 0, this.dashDir.z * 17);
    g.sfx("dash", this.pos);
    g.vfx.dust(this.pos, 8, 3);
    this.afterimage();
  }
  private afterimage() {
    const c = EL_COLORS[this.element].main;
    this.tmp.copy(this.pos).setY(this.pos.y + 1);
    this.game.vfx.burst({ p: this.tmp, n: 14, speed: [0.5, 3], size: [0.3, 0.6], life: [0.2, 0.4], color: c, color2: c, jitter: 0.5, drag: 3 });
  }
  private updateDash(dt: number, inp: PlayerInput | null) {
    this.dashT += dt;
    this.rig.setPose("dashPose", 25);
    this.rig.walk = 0;
    const k = Math.max(0, 1 - this.dashT / 0.22);
    this.vel.x = this.dashDir.x * 17 * k;
    this.vel.z = this.dashDir.z * 17 * k;
    if (Math.random() < 0.6) this.game.vfx.dust(this.pos, 1, 1.5);
    if (this.dashT % 0.06 < dt) this.afterimage();
    if (this.dashT >= 0.22) { this.setState(this.air ? "jump" : "idle"); this.vel.x *= 0.3; this.vel.z *= 0.3; }
    void inp;
  }

  // ------------------------------------------------------------------ attacks
  startMove(m: MoveData) {
    const g = this.game;
    this.state = "attack"; this.stateT = 0;
    this.move = m; this.moveT = 0; this.moveHit = false; this.rehitT = 0; this.spawned = 0; this.teleported = false;
    this.rig.walk = 0;
    g.sfx(m.type === "melee" && m.damage < 80 ? "whoosh" : m.sound === "punch" ? "whoosh" : "whoosh", this.pos);
    if (m.type !== "melee" || m.sound === "fire" || m.sound === "dark") g.sfx(m.sound === "punch" || m.sound === "kick" || m.sound === "heavy" ? "whoosh" : m.sound, this.pos, 0.6);
    this.glowTarget = m.id.includes("_s") || m.id.endsWith("S") ? 0.8 : 0.3;
    if (m.type === "dash" && m.free === undefined) this.dashDir.copy(this.face);
  }

  cancelMove() {
    this.move = null;
    this.trailOn = false;
    this.rig.root.visible = true;
  }
  trailOn = false;

  private limbsFor(anim: string): number[] {
    switch (anim) {
      case "jabL": return [0];
      case "jabR": case "cross": case "hook": case "uppercut": return [1];
      case "roundhouse": case "airKick": return [3];
      case "slam": case "airSlam": case "castUp": case "cast": return [0, 1];
      case "dashPose": return [0, 1, 2, 3];
      default: return [1];
    }
  }

  private updateAttack(dt: number, inp: PlayerInput | null) {
    const g = this.game;
    const m = this.move!;
    this.moveT += dt;
    const t = this.moveT;
    const st = m.startup, ac = m.active, rec = m.recovery;
    const total = st + ac + rec;
    const A = ANIMS[m.anim] ?? ANIMS.jabL;
    const air = this.air;
    const fwd = this.face;
    // animation
    if (t < st) this.rig.setBlend(POSES.idle, A.wind, Math.min(1, t / Math.max(0.01, st)), 38);
    else if (t < st + ac) this.rig.setBlend(A.wind, A.strike, Math.min(1, (t - st) / Math.max(0.02, ac * 0.5)), 45);
    else this.rig.setBlend(A.strike, POSES.idle, Math.min(1, (t - st - ac) / rec), 16);
    if (air && !(m.spike)) this.rig.setBlend(A.wind, A.strike, t < st ? 0.2 : 1, 25);
    // lunge
    if (!air && t < st + ac && m.type !== "dash" && m.type !== "teleport") { this.vel.x = fwd.x * m.lunge * (t < st ? 0.4 : 1); this.vel.z = fwd.z * m.lunge * (t < st ? 0.4 : 1); }
    else if (!air && t >= st + ac) { const k = Math.exp(-10 * dt); this.vel.x *= k; this.vel.z *= k; }
    if (air && m.type === "melee" && !m.spike) { this.vel.y *= 0.9; if (t < st + ac) { this.vel.x = fwd.x * m.lunge; this.vel.z = fwd.z * m.lunge; } }
    // trails
    this.trailOn = t > st * 0.3 && t < st + ac + 0.08;
    const active = t >= st && t < st + ac;

    switch (m.type) {
      case "melee": {
        if (m.spike && t >= st && t < st + 0.05) this.vel.y = -17;
        if (active) {
          this.rehitT -= dt;
          if (t - dt < st) this.meleeStartFx(m);
          if (!this.moveHit || (m.rehit && this.rehitT <= 0)) {
            if (g.meleeCheck(this, m)) { this.moveHit = true; this.rehitT = m.rehit ?? 99; }
          }
        }
        break;
      }
      case "proj": {
        // gather particles at hands
        if (t < st) this.chargeFx(t / st);
        const n = m.count ?? 1;
        const extra = this.transformed ? 1 : 0;
        const cnt = n + (n > 1 ? extra * 2 : 0);
        while (this.spawned < cnt && t >= st + this.spawned * (m.interval ?? 0.08)) {
          g.fireProjectile(this, m, this.spawned, cnt);
          this.spawned++;
        }
        break;
      }
      case "prison": {
        if (t < st) this.chargeFx(t / st);
        if (this.spawned < 1 && t >= st) { this.spawned = 1; g.fireProjectile(this, m, 0, 1); }
        break;
      }
      case "zone": {
        if (t < st) this.chargeFx(t / st);
        if (this.spawned < 1 && t >= st) {
          this.spawned = 1;
          const dd = Math.hypot(this.opp.pos.x - this.pos.x, this.opp.pos.z - this.pos.z);
          const at = dd < 9 ? this.opp.pos.clone().setY(0) : this.pos.clone().addScaledVector(fwd, 4.5);
          g.spawnZone(this, m, at);
        }
        break;
      }
      case "dash": {
        if (t < st) { this.vel.x *= 0.5; this.vel.z *= 0.5; this.chargeFx(t / st); break; }
        if (active) {
          if (t - dt < st) {
            // pick direction
            const inpDir = this.tmp2.set(inp ? inp.ax : 0, 0, inp ? inp.az : 0);
            if (m.free && inpDir.lengthSq() > 0.1) this.dashDir.copy(inpDir).normalize(); else this.dashDir.copy(fwd);
            if (m.invuln) this.invuln = Math.max(this.invuln, m.invuln);
            g.sfx("dash", this.pos); this.afterimage();
            g.vfx.burst({ p: this.tmp.copy(this.pos).setY(1), n: 24, speed: [3, 9], size: [0.2, 0.5], life: [0.2, 0.5], color: EL_COLORS[this.element].core, color2: EL_COLORS[this.element].main, drag: 3 });
          }
          this.vel.x = this.dashDir.x * (m.dashSpeed ?? 20) * (this.transformed ? 1.15 : 1);
          this.vel.z = this.dashDir.z * (m.dashSpeed ?? 20) * (this.transformed ? 1.15 : 1);
          this.vel.y = Math.max(this.vel.y, 0) * 0.5;
          g.vfx.trail(this.tmp.copy(this.pos).setY(this.pos.y + 1), this.element, 1.4);
          if (Math.random() < 0.5) this.afterimage();
          if (!this.moveHit && g.meleeCheck(this, m)) {
            this.moveHit = true;
            this.moveT = st + ac; // end dash on contact
            this.vel.multiplyScalar(0.15);
          }
        } else if (t >= st + ac) { this.vel.x *= Math.exp(-12 * dt); this.vel.z *= Math.exp(-12 * dt); }
        break;
      }
      case "teleport": {
        if (t < st) {
          const k = t / st;
          this.rig.root.visible = k < 0.55;
          if (Math.random() < 0.6) g.vfx.burst({ p: this.tmp.copy(this.pos).setY(0.9), n: 3, speed: [1, 5], size: [0.3, 0.6], life: [0.3, 0.6], color: 0xa23cff, color2: 0x180030, jitter: 0.4, drag: 2 });
          this.invuln = Math.max(this.invuln, 0.1);
        } else if (!this.teleported) {
          this.teleported = true;
          const o = this.opp;
          const dir = this.tmp.set(o.pos.x - this.pos.x, 0, o.pos.z - this.pos.z);
          if (dir.lengthSq() < 0.001) dir.set(this.face.x, 0, this.face.z);
          dir.normalize();
          g.vfx.burst({ p: this.tmp2.copy(this.pos).setY(1), n: 40, speed: [2, 9], size: [0.3, 0.8], life: [0.3, 0.7], color: 0xff55e0, color2: 0x300050, drag: 3 });
          g.vfx.ring(this.pos, 0xa23cff, 0.3, 3.2, 0.4);
          this.pos.set(o.pos.x + dir.x * 1.5, 0, o.pos.z + dir.z * 1.5);
          g.clampToArena(this.pos);
          this.yaw = Math.atan2(o.pos.x - this.pos.x, o.pos.z - this.pos.z);
          this.face.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
          this.rig.root.visible = true;
          g.vfx.burst({ p: this.tmp2.copy(this.pos).setY(1), n: 50, speed: [2, 10], size: [0.3, 0.8], life: [0.3, 0.7], color: 0xff55e0, color2: 0x300050, drag: 3 });
          g.vfx.ring(this.pos, 0xff55e0, 0.3, 3.5, 0.4);
          g.vfx.flash(this.tmp2.copy(this.pos).setY(1.5), 0xa23cff, 14, 12, 0.3);
          g.sfx("dark", this.pos);
          this.invuln = Math.max(this.invuln, 0.2);
        }
        if (active && this.teleported) {
          if (t - dt < st + 0.001) this.meleeStartFx(m);
          if (!this.moveHit && g.meleeCheck(this, m)) this.moveHit = true;
        }
        break;
      }
    }

    // cancels: chain lights / special-cancel on hit
    const rcv = t >= st + ac * 0.6;
    if (rcv && inp) {
      const d = this.def;
      const isLight = d.light.includes(m);
      if (this.buf.light > 0 && isLight && this.lightIdx < d.light.length - 1 && !air) {
        this.buf.light = 0; this.lightIdx++; this.startMove(d.light[this.lightIdx]); return;
      }
      if (this.moveHit && t >= st + ac) {
        if (this.buf.s1 > 0 && this.canUse("s1", d.s1)) { this.buf.s1 = 0; this.spend("s1", d.s1); this.startMove(d.s1); return; }
        if (this.buf.s2 > 0 && this.canUse("s2", d.s2)) { this.buf.s2 = 0; this.spend("s2", d.s2); this.startMove(d.s2); return; }
        if (this.buf.heavy > 0 && !air && this.canUse("sig", d.sig) && m !== d.sig) { this.buf.heavy = 0; this.spend("sig", d.sig); this.startMove(d.sig); return; }
        if (this.buf.heavy > 0 && !air && isLight) { this.buf.heavy = 0; this.startMove(d.heavy); return; }
      }
    }
    if (t >= total) {
      this.cancelMove();
      this.setState(air ? "jump" : "idle");
      this.glowTarget = 0;
    }
  }

  private chargeFx(k: number) {
    const el = this.element;
    const c = EL_COLORS[el];
    this.rig.handR.getWorldPosition(this.tmp);
    const q = this.game.vfx;
    for (let i = 0; i < 2; i++) {
      const a = Math.random() * 6.28, r = 1.0 * (1 - k) + 0.2;
      q.add.spawn(this.tmp.x + Math.cos(a) * r, this.tmp.y + (Math.random() - 0.5) * r, this.tmp.z + Math.sin(a) * r, -Math.cos(a) * 4, 0, -Math.sin(a) * 4, 0.2, 0.25, 0.05, c.core, c.main, 0, 0);
    }
  }

  private meleeStartFx(m: MoveData) {
    const g = this.game;
    const c = EL_COLORS[m.element as El] ?? EL_COLORS.none;
    const f = this.face;
    const kick = ["roundhouse", "airKick"].includes(m.anim);
    const y = m.anim === "uppercut" ? 1.2 : kick ? 1.0 : m.anim === "slam" || m.anim === "airSlam" ? 0.9 : 1.35;
    const p = this.tmp.set(this.pos.x + f.x * m.range * 0.55, this.pos.y + y, this.pos.z + f.z * m.range * 0.55);
    const big = m.id.endsWith("S") || m.spike || m.damage >= 100;
    const slash = g.vfx.fx("slash", p, m.element === "none" ? 0xffffff : c.main, big ? 1.8 : 1.1, big ? 2.6 : 1.7, big ? 0.22 : 0.14, { op: 0.9, rot: [m.anim === "uppercut" ? -1.2 : kick ? -0.4 : 0, this.yaw + 1.2, m.anim === "hook" || m.anim === "roundhouse" ? 0 : 0.6], hdr: 1.8, ease: 2 });
    void slash;
    if (m.id.endsWith("S")) this.signatureFx(m);
    g.sfx("whoosh", this.pos);
  }

  private signatureFx(m: MoveData) {
    const g = this.game;
    const f = this.face;
    const c = EL_COLORS[m.element as El];
    const at = this.tmp2.set(this.pos.x + f.x * 1.8, 0, this.pos.z + f.z * 1.8);
    if (m.element === "fire") {
      g.vfx.fx("cone", at, c.main, [1.0, 1.5, 1.0], [1.8, 7.5, 1.8], 0.45, { op: 0.8, hdr: 1.6 });
      g.vfx.fx("cone", at, c.core, [0.5, 1.0, 0.5], [0.9, 6, 0.9], 0.4, { op: 0.9, hdr: 1.8 });
      g.vfx.ring(at, c.core, 0.4, 5, 0.4);
      g.vfx.burst({ p: at.clone().setY(1), n: 60, speed: [3, 12], size: [0.25, 0.6], life: [0.4, 0.9], color: c.core, color2: c.main, dir: new THREE.Vector3(0, 1, 0), spread: 0.7, drag: 1.5, grav: -2 });
      g.vfx.flash(at.clone().setY(2), c.main, 18, 14, 0.4);
      g.shake(0.35);
    } else if (m.element === "dark") {
      for (let i = 0; i < 10; i++) {
        const d = 0.8 + i * 0.45;
        const pt = new THREE.Vector3(this.pos.x + f.x * d, 0, this.pos.z + f.z * d);
        g.vfx.fx("cone", pt, c.main, [0.25, 0.3, 0.25], [0.35, 1.6 + (10 - i) * 0.08, 0.35], 0.35 + i * 0.015, { op: 0.8, hdr: 1.6 });
        g.vfx.burst({ p: pt.clone().setY(0.4), n: 8, speed: [2, 6], size: [0.2, 0.4], life: [0.3, 0.7], color: c.core, color2: c.dark, drag: 2, grav: 4 });
      }
      g.vfx.ring(at, c.main, 0.3, 6, 0.5);
      g.vfx.flash(at.clone().setY(1.5), c.main, 16, 14, 0.4);
      g.shake(0.45);
    }
  }

  // ------------------------------------------------------------------ reactions
  cleanupForHit() {
    this.cancelMove();
    this.glowTarget = 0;
    this.rig.root.visible = true;
  }
  enterHit(stun: number, kx: number, kz: number, launch: number) {
    this.cleanupForHit();
    this.vel.x = kx; this.vel.z = kz;
    if (launch > 0 || launch < 0 || this.air) {
      this.airHits++;
      let vy = launch;
      if (launch >= 0) vy = this.air ? Math.max(launch, 4.5) : launch;
      if (this.airHits > 4 && launch >= 0) vy = Math.min(vy, 2);
      this.vel.y = vy === 0 ? 3.5 : vy;
      this.setState("launched");
      this.hitstun = stun;
    } else {
      this.airHits = 0;
      this.setState("hit");
      this.hitstun = stun;
      this.vel.y = 0;
    }
  }
  private updateHit(dt: number) {
    this.rig.setPose("hit", 28);
    this.hitstun -= dt;
    const k = Math.exp(-7 * dt);
    this.vel.x *= k; this.vel.z *= k;
    if (this.hitstun <= 0) this.setState(this.air ? "jump" : "idle");
  }
  private updateLaunched(_dt: number, inp: PlayerInput | null) {
    this.rig.setPose("launched", 14);
    this.rig.grounded = false;
    // air recovery
    if (this.stateT > 0.35 && inp && this.buf.dash > 0 && this.ki >= 15 && this.state === "launched" && this.vel.y < 3 && this.invuln <= 0.01) {
      this.buf.dash = 0;
      this.ki -= 15;
      this.setState("jump");
      this.vel.set(this.vel.x * 0.2, 2, this.vel.z * 0.2);
      this.invuln = 0.35;
      this.airHits = 0;
      this.game.vfx.ring(this.tmp.copy(this.pos).setY(this.pos.y + 1), EL_COLORS[this.element].main, 0.3, 2.5, 0.35, { billboard: true });
      this.game.sfx("parry", this.pos, 0.5);
    }
  }
  freeze(t: number) {
    this.cleanupForHit();
    this.setState("frozen");
    this.frozenT = t;
    this.vel.set(0, 0, 0);
    this.rig.iceShell.visible = true;
    this.game.sfx("freeze", this.pos);
    this.game.vfx.burst({ p: this.tmp.copy(this.pos).setY(1), n: 40, speed: [2, 8], size: [0.2, 0.4], life: [0.3, 0.7], color: 0xffffff, color2: 0x76e2ff, drag: 3 });
  }
  unfreeze(shatter: boolean) {
    this.rig.iceShell.visible = false;
    const g = this.game;
    this.tmp.copy(this.pos).setY(1);
    for (let i = 0; i < 14; i++) g.vfx.shard(this.tmp, 0x9ae8ff, 4 + Math.random() * 5);
    g.vfx.burst({ p: this.tmp, n: 40, speed: [2, 9], size: [0.2, 0.5], life: [0.3, 0.8], color: 0xffffff, color2: 0x76e2ff, drag: 2.5, grav: 5 });
    g.sfx("shatter", this.pos);
    if (this.state === "frozen" && !shatter) this.setState("idle");
  }

  // ------------------------------------------------------------------ transformation
  startTransform() {
    const g = this.game;
    this.setState("transform");
    this.xfT = 0; this.xfPhase = 0;
    this.xf = 0;
    this.invuln = 2;
    this.vel.set(0, 0, 0);
    g.sfx("transform", this.pos);
    g.letterbox(true);
    g.banner(this.def.formName, this.def.name + " — TRANSFORMATION", this.def.color, 1.4);
    g.slowmo(0.35, 0.5);
    this.glowTarget = 1;
  }
  private updateTransform(dt: number) {
    const g = this.game;
    this.xfT += dt;
    this.vel.x = this.vel.z = 0;
    const el = this.element;
    const c = EL_COLORS[el];
    this.rig.setPose(this.xfT < 0.6 ? "charge" : "roar", 10);
    const center = this.tmp.set(this.pos.x, 1, this.pos.z);
    if (this.xfT < 1.0) {
      const k = this.xfT / 1.0;
      for (let i = 0; i < 4; i++) {
        const a = Math.random() * 6.28, r = 3.5 * (1 - k) + 0.6;
        g.vfx.add.spawn(center.x + Math.cos(a) * r, center.y + (Math.random() - 0.5) * 2, center.z + Math.sin(a) * r, -Math.cos(a) * 7, 0, -Math.sin(a) * 7, 0.3, 0.3, 0.05, c.core, c.main, 0, 0);
      }
      g.setShot(this.tmp2.set(this.pos.x + this.face.z * 0.5 + 1.6, 1.7, this.pos.z + 6.2), this.tmp.set(this.pos.x, 1.3, this.pos.z), 0.9);
      if (Math.random() < 0.5) g.vfx.dust(this.pos, 2, 4);
    }
    if (this.xfT >= 1.0 && this.xfPhase === 0) {
      this.xfPhase = 1;
      this.transformed = true;
      this.xfTime = 20;
      this.rig.setForm(true);
      const p = this.pos.clone().setY(1);
      g.explode(this.pos, el, 1.0, { damage: false });
      g.vfx.fx("sphere", p, 0xffffff, 0.4, 3.2, 0.3, { op: 0.6, hdr: 1.5 });
      g.vfx.shockwave(this.pos, el, 14, 0.7);
      g.flashScreen("#ffffff", 0.35, 0.3);
      g.shake(0.7);
      g.sfx("bigexplosion", this.pos, 0.7);
      // push opponent
      const o = this.opp;
      const dd = Math.hypot(o.pos.x - this.pos.x, o.pos.z - this.pos.z);
      if (dd < 6 && o.state !== "ko" && o.invuln <= 0 && o.state !== "ult") {
        const nx = (o.pos.x - this.pos.x) / (dd || 1), nz = (o.pos.z - this.pos.z) / (dd || 1);
        o.enterHit(0.35, nx * 10, nz * 10, 3);
      }
      this.glowTarget = 0.5;
    }
    if (this.xfT >= 1.7) {
      this.setState("idle");
      this.invuln = 0.3;
      g.letterbox(false);
    }
  }
  endTransform(silent: boolean) {
    this.transformed = false;
    this.rig.setForm(false);
    this.xf = 0;
    if (!silent) {
      this.game.vfx.ring(this.tmp.copy(this.pos).setY(0.1), EL_COLORS[this.element].main, 0.4, 4, 0.5);
      this.game.sfx("ui_back", this.pos, 0.6);
    }
  }

  // ------------------------------------------------------------------ physics
  private physics(dt: number) {
    const g = this.game;
    const wasAir = this.air;
    const st = this.state;
    const noGrav = st === "dash" || (st === "attack" && this.move && (this.move.type === "dash" || this.move.type === "teleport") && !this.air) || st === "frozen" || st === "transform" ||
      (st === "ult" && this.ultS?.noGrav) || st === "locked";
    if (!noGrav) {
      const gm = st === "attack" && this.move && !this.move.spike ? 0.45 : 1;
      this.vel.y -= GRAV * gm * dt;
    } else if (st === "dash" && this.air) this.vel.y = 0;
    this.pos.addScaledVector(this.vel, dt);
    if (this.pos.y <= 0) {
      this.pos.y = 0;
      if (this.vel.y < 0) {
        const hard = this.vel.y;
        this.vel.y = 0;
        if (wasAir) this.onLand(hard);
      }
    }
    g.clampToArena(this.pos, this);
    // body separation
    const o = this.opp;
    if (o && o.state !== "ko" && Math.abs(o.pos.y - this.pos.y) < 1.4 && !(this.state === "dash" && this.invuln > 0) && !(this.state === "attack" && this.move?.invuln && this.invuln > 0)) {
      const dx = this.pos.x - o.pos.x, dz = this.pos.z - o.pos.z;
      const d = Math.hypot(dx, dz);
      const min = this.radius + o.radius - 0.1;
      if (d < min && d > 0.001) {
        const push = (min - d) * (this.idx === 0 ? 0.5 : 0.5);
        this.pos.x += (dx / d) * push; this.pos.z += (dz / d) * push;
      }
    }
  }

  private onLand(vy: number) {
    const g = this.game;
    this.airDashUsed = false;
    this.rig.grounded = true;
    if (this.state === "launched") {
      g.vfx.dust(this.pos, 14, 5);
      g.vfx.ring(this.tmp.copy(this.pos), 0xb0a8b8, 0.4, vy < -14 ? 4.5 : 2.5, 0.4, { op: 0.5 });
      g.sfx("land", this.pos);
      g.shake(vy < -14 ? 0.35 : 0.15);
      if (this.hp <= 0) { this.setState("ko"); return; }
      this.setState("down");
      this.vel.x *= 0.4; this.vel.z *= 0.4;
      this.airHits = 0;
      this.invuln = Math.max(this.invuln, 0.35);
      if (vy < -14) g.vfx.scorch(this.pos, 1.8);
    } else if (this.state === "attack" && this.move) {
      if (this.move.spike) {
        g.vfx.shockwave(this.pos, this.move.element as El, 4, 0.4);
        g.shake(0.3);
        g.sfx("heavy", this.pos);
        if (!this.moveHit) g.meleeCheck(this, this.move, { landing: true });
      }
      this.cancelMove(); this.setState("idle"); this.landLock = 0.12; this.vel.x *= 0.3; this.vel.z *= 0.3;
      g.vfx.dust(this.pos, 8, 3);
    } else if (this.state === "jump" || this.state === "idle" || this.state === "dash") {
      g.vfx.dust(this.pos, 5, 2.5);
      g.sfx("land", this.pos, 0.4);
      if (this.state === "jump") this.setState("idle");
      this.landLock = 0.04;
    }
  }

  // ------------------------------------------------------------------ visuals
  private visuals(dt: number) {
    const g = this.game;
    const rig = this.rig;
    rig.root.position.copy(this.pos);
    rig.root.rotation.y = this.yaw;
    // local velocity for cloth
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    rig.vel.set(this.vel.x * c - this.vel.z * s, this.vel.y, this.vel.x * s + this.vel.z * c);
    rig.grounded = this.pos.y < 0.06 && this.state !== "launched" && !["jump"].includes(this.state);
    if (this.state === "attack" && this.move && !this.air) rig.grounded = true;
    rig.speedScale = this.transformed ? 1.2 : 1;
    if (!["idle", "block"].includes(this.state)) rig.walk *= Math.exp(-12 * dt);
    // head turn toward camera
    const cam = g.camera.position;
    const toCam = Math.atan2(cam.x - this.pos.x, cam.z - this.pos.z);
    const rel = ang(toCam - this.yaw);
    const ht = Math.max(-0.7, Math.min(0.7, rel)) * 0.55;
    rig.headTurn += (ht - rig.headTurn) * (1 - Math.exp(-6 * dt));
    // glow
    const low = this.hp / this.maxHp < 0.25 && this.hp > 0 ? 0.25 + Math.sin(this.t * 6) * 0.1 : 0;
    const gt = this.state === "ult" ? 1 : Math.max(this.glowTarget, low);
    rig.glow += (gt - rig.glow) * (1 - Math.exp(-8 * dt));
    rig.update(dt, this.t);
    rig.jitter *= Math.exp(-14 * dt);
    if (rig.jitter < 0.002) rig.jitter = 0;
    // aura particles
    const lvl = rig.glow * 0.8 + (this.transformed ? 0.7 : 0.12) + (this.state === "block" ? 0 : 0);
    if (this.state !== "ko" && this.state !== "down" && rig.root.visible) g.vfx.aura(this.pos, this.element, lvl, this.transformed);
    // aura light
    this.auraLight.position.set(this.pos.x, this.pos.y + 1.4, this.pos.z + 0.8);
    const form = this.transformed ? 1 : 0;
    this.auraLight.color.set(form ? this.def.formColor : this.def.glow);
    this.auraLight.intensity = (4 + rig.glow * 70 + form * 20) * (this.state === "ko" ? 0.1 : 1);
    // ribbons
    const lm = this.state === "attack" && this.move ? this.limbsFor(this.move.anim) : this.state === "dash" ? [0, 1, 2, 3] : [];
    this.ribbons.forEach((rb, i) => {
      if (this.trailOn && lm.includes(i) || (this.state === "dash" && dt > 0)) {
        this.trailLimbs[i].getWorldPosition(this.tmp);
        rb.add(this.tmp);
      }
      rb.setColor(this.transformed ? this.def.formColor : EL_COLORS[this.element].main);
    });
    // frozen shell spin & visuals
    if (rig.iceShell.visible) rig.iceShell.rotation.y += dt * 0.2;
  }

  // ------------------------------------------------------------------ misc
  win() {
    this.cancelMove();
    this.setState("win");
    this.glowTarget = 0.5;
  }
  ko() {
    this.cleanupForHit();
    if (this.ultS) cancelUlt(this.game, this);
    this.rig.iceShell.visible = false;
    this.setState("launched");
    this.glowTarget = 0;
  }
  dispose() {
    this.game.scene.remove(this.rig.root);
    this.game.scene.remove(this.auraLight);
    this.rig.dispose();
  }
}

function yawFix(y: number) { return y; }
