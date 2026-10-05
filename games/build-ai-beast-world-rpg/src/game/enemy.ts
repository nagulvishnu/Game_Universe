import * as THREE from "three";
import type { Game } from "./game";
import { ENEMIES, type EnemyDef } from "./data";
import { buildEnemy, buildWarden, buildPylon, type Model } from "./models";
import { Telegraph } from "./fx";
import { audio } from "./audio";
import { clamp } from "./noise";

export const angDiff = (a: number, b: number) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

interface Atk {
  name: string; shape: "cone" | "circle" | "line" | "body" | "none"; range: number; arc?: number; width?: number; off?: number;
  windup: number; active: number; recover: number; dmg: number; unblock?: boolean; speed?: number; track?: number; vh?: number; cd: number; kb?: number;
}
const NAMES: Record<string, string[]> = {
  skitter: ["Dust Skitter", "Briar Skitter", "Sand Skitter", "Frost Skitter"],
  horn: ["Ashhorn", "Briarhorn", "Sunscar Gorger", "Rimehorn"],
  kite: ["Cinderkite", "Mosskite", "Sunkite", "Rimekite"],
  colossus: ["Cinderback Colossus", "Mosshide Colossus", "Sunscar Colossus", "Frostmantle Colossus"],
  grazer: ["Moss Grazer", "Moss Grazer", "Moss Grazer", "Moss Grazer"],
};
const TINTS: Record<string, number[]> = {
  skitter: [0x7a5a48, 0x3f5f45, 0xb08a58, 0x8aa0b0],
  horn: [0x6a4a3a, 0x4a5a38, 0xa07848, 0x7a8a98],
  kite: [0x5a3a3a, 0x3a5a4a, 0xa06838, 0x6a7a90],
  colossus: [0x6a625a, 0x4f6a52, 0x9a8160, 0x7d8a96],
  grazer: [0x8fb06a, 0x6fa05a, 0xc9b070, 0xbfd0d0],
};

export class Enemy {
  static seq = 0;
  id = Enemy.seq++;
  kind: string; def: EnemyDef; name: string; biome: number;
  model: Model; root: THREE.Group;
  pos = new THREE.Vector3(); vel = new THREE.Vector3(); yaw = 0;
  air = 0; vy = 0;
  hp: number; maxHp: number; poise: number; maxPoise: number;
  alive = true; removed = false; state = "idle"; t = 0; time = Math.random() * 10;
  home = new THREE.Vector3();
  aggro = false; dist = 99; toYaw = 0;
  radius = 0.9; height = 1.4; flying = false; hover = 0;
  atk: Atk | null = null; tele: Telegraph | null = null; hitDone = false;
  cd = 1 + Math.random() * 1.2; flash = 0; flashOn = false; deadT = 0;
  superArmor = false; isBoss = false; elite = false;
  orbit = Math.random() < 0.5 ? 1 : -1; orbitT = 1 + Math.random() * 1.5;
  walk = Math.random() * 6; spd = 0; lastPos = new THREE.Vector3();
  camp = ""; dmgMul = 1; roamer = false; coreDrop = false;
  aggroR = 24; stunDur = 0; fleeing = false;
  alertSprite?: THREE.Sprite;
  windProg = 0;
  g: Game;

  constructor(g: Game, kind: string, x: number, z: number, biome: number, lvlScale = 1) {
    this.g = g; this.kind = kind; this.def = ENEMIES[kind]; this.biome = biome;
    this.name = NAMES[kind]?.[biome] ?? this.def.name;
    this.model = kind === "warden" ? buildWarden() : buildEnemy(kind, TINTS[kind]?.[biome] ?? 0x777777);
    this.root = this.model.root;
    for (const m of this.model.mats) { m.userData.e = m.emissive.clone(); m.userData.ei = m.emissiveIntensity; }
    this.maxHp = this.hp = Math.round(this.def.hp * lvlScale);
    this.maxPoise = this.poise = this.def.poise;
    this.pos.set(x, g.world.ground(x, z), z); this.home.copy(this.pos);
    this.lastPos.copy(this.pos);
    this.yaw = Math.random() * 6.28;
    if (kind === "kite") { this.flying = true; this.hover = 4.5; this.radius = 0.7; this.air = this.hover; }
    if (kind === "colossus") { this.radius = 2.4; this.height = 4; this.superArmor = true; this.elite = true; this.aggroR = 30; }
    if (kind === "horn") this.radius = 1.4;
    if (kind === "skitter") { this.radius = 0.8; this.aggroR = 26; }
    if (kind === "grazer") { this.radius = 0.8; this.aggroR = 0; }
    this.root.scale.setScalar(this.def.scale);
    this.root.position.copy(this.pos);
    g.scene.add(this.root);
  }

  setState(s: string) { this.state = s; this.t = 0; }
  fwd() { return new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }

  turn(target: number, rate: number, dt: number) {
    const d = angDiff(target, this.yaw);
    this.yaw += clamp(d, -rate * dt, rate * dt);
  }

  /** returns multiplier from weaknesses */
  vulnMul(from: THREE.Vector3) {
    let m = 1;
    if (this.state === "dizzy" || this.state === "exposed") m *= this.isBoss ? 2 : 1.5;
    else if (this.state === "stagger") m *= 1.3;
    if (this.kind === "colossus") {
      const a = Math.atan2(this.pos.x - from.x, this.pos.z - from.z);
      if (Math.abs(angDiff(a, this.yaw)) < 1.0) m *= 1.6;
    }
    return m;
  }

  receive(dmg: number, o: { poise?: number; kb?: THREE.Vector3; launch?: boolean; air?: boolean; from: THREE.Vector3 }) {
    this.hp -= dmg;
    this.flash = 0.12;
    if (!this.aggro) this.aggro = true;
    let broke = false;
    const poiseDmg = (o.poise ?? 6) * (this.kind === "kite" && (o.air || o.launch) ? 2.5 : 1);
    this.poise -= poiseDmg;
    if (o.kb && !this.isBoss) { const k = this.elite ? 0.25 : 1; this.vel.x += o.kb.x * k; this.vel.z += o.kb.z * k; }
    if (this.hp <= 0) return { killed: true, broke };
    if (o.launch && !this.isBoss && !this.elite) {
      this.state = "launched"; this.t = 0; this.vy = 10; this.cancelAtk();
    } else if (this.state === "launched" && o.air) { this.vy = Math.max(this.vy, 4); }
    if (this.poise <= 0) {
      broke = true; this.poise = this.maxPoise;
      this.onPoiseBreak();
    } else if (!this.superArmor && !this.isBoss && (this.state === "windup" || this.state === "chase" || this.state === "idle" || this.state === "circle") && poiseDmg >= 6 && this.def.tier === 0) {
      this.cancelAtk(); this.setState("stagger"); this.stunDur = 0.35;
    }
    return { killed: false, broke };
  }
  onPoiseBreak() {
    this.cancelAtk(); this.setState("stagger"); this.stunDur = this.elite ? 1.8 : 1.2;
    if (this.kind === "kite") { this.stunDur = 1.8; }
    this.g.fx.number(this.pos.clone().setY(this.pos.y + this.height + 1), "BREAK!", "#ffd24a", 20);
  }
  cancelAtk() { this.tele?.remove(); this.tele = null; this.atk = null; }

  beginAtk(a: Atk) {
    this.atk = a; this.setState("windup"); this.hitDone = false;
    if (!this.isBoss && this.kind !== "kite") this.g.attackers++;
    const col = a.unblock ? 0xb040ff : 0xff3b3b;
    if (a.shape === "cone") this.tele = new Telegraph(this.g.scene, "cone", a.range, a.arc!, col);
    else if (a.shape === "circle") this.tele = new Telegraph(this.g.scene, "circle", a.range, 0, col);
    else if (a.shape === "line") this.tele = new Telegraph(this.g.scene, "line", a.range, a.width!, col);
    this.placeTele();
    if (a.unblock) audio.warn();
  }
  placeTele() {
    if (!this.tele) return;
    const a = this.atk!, f = this.fwd();
    const off = a.off ?? 0;
    this.tele.group.position.set(this.pos.x + f.x * off, this.g.world.ground(this.pos.x + f.x * off, this.pos.z + f.z * off) + 0.25, this.pos.z + f.z * off);
    this.tele.group.rotation.y = this.yaw;
  }

  inHit(a: Atk) {
    const p = this.g.p;
    const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z;
    const vh = a.vh ?? 3.5;
    if (Math.abs(p.pos.y - this.pos.y) > vh + (a.shape === "circle" ? 0 : 2)) return false;
    if (a.shape === "cone") return Math.hypot(dx, dz) < a.range + 0.5 && Math.abs(angDiff(Math.atan2(dx, dz), this.yaw)) < a.arc! / 2;
    if (a.shape === "circle") { const f = this.fwd(), o = a.off ?? 0; return Math.hypot(dx - f.x * o, dz - f.z * o) < a.range; }
    if (a.shape === "line") { const al = dx * Math.sin(this.yaw) + dz * Math.cos(this.yaw), la = dx * Math.cos(this.yaw) - dz * Math.sin(this.yaw); return al > -1 && al < a.range && Math.abs(la) < a.width! / 2 + 0.4; }
    if (a.shape === "body") return Math.hypot(dx, dz) < a.range + this.radius;
    return false;
  }

  runAtk(dt: number) {
    const a = this.atk;
    if (!a) { this.setState("chase"); return; }
    const g = this.g;
    if (this.state === "windup") {
      const prog = this.t / a.windup; this.windProg = prog;
      if (a.track && prog < a.track) this.turn(this.toYaw, 5, dt);
      this.tele?.set(prog); this.placeTele();
      if (this.t >= a.windup) { this.tele?.remove(); this.tele = null; this.setState("attack"); this.hitDone = false; this.onAtkStart(a); }
    } else if (this.state === "attack") {
      this.windProg = 1;
      if (a.speed) { const f = this.fwd(); this.vel.x = f.x * a.speed; this.vel.z = f.z * a.speed; }
      if (!this.hitDone && a.shape !== "none" && this.inHit(a)) {
        this.hitDone = true;
        g.hurtPlayer(a.dmg * this.dmgMul, this.pos, { unblock: a.unblock, enemy: this, kb: a.kb ?? 5 });
      }
      if (a.speed) this.onMoveAtk(a);
      if (this.t >= a.active) { this.setState("recover"); if (a.speed) { this.vel.multiplyScalar(0.2); } this.onAtkEnd(a); }
    } else if (this.state === "recover") {
      this.windProg = 0;
      if (this.t >= a.recover) { this.cd = a.cd * (0.8 + Math.random() * 0.5); this.atk = null; this.setState(this.aggro ? "chase" : "idle"); }
    }
  }
  onAtkStart(a: Atk) {
    const g = this.g;
    if (a.shape === "circle" || a.name === "slam") {
      const f = this.fwd(), o = a.off ?? 0;
      const c = new THREE.Vector3(this.pos.x + f.x * o, this.pos.y, this.pos.z + f.z * o);
      g.fx.burst(c, 22, 0xd8c8a0, 9, 1.2, 0.7, 10); g.fx.ring(c, 0xffd890, 1, a.range, 0.4);
      g.addShake(this.isBoss ? 0.7 : 0.35); audio.boom();
    }
  }
  onMoveAtk(_a: Atk) { void _a; }
  onAtkEnd(_a: Atk) { void _a; }

  think(_dt: number): void { void _dt; }

  update(dt: number) {
    const g = this.g, p = g.p;
    this.time += dt;
    this.applyFlash(dt);
    if (this.state === "dead") { this.deadT += dt; this.animDead(); if (this.deadT > 1.5) { this.removed = true; } return; }
    const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z;
    this.dist = Math.hypot(dx, dz); this.toYaw = Math.atan2(dx, dz);
    this.t += dt; this.cd -= dt;
    if (!this.aggro && this.aggroR > 0 && !p.dead && this.dist < this.aggroR * (p.mounted ? 0.8 : 1) && !g.cine) {
      this.aggro = true; this.setState("chase");
      g.alertFx(this);
    }
    if (this.aggro && !this.isBoss && !this.roamer && Math.hypot(this.pos.x - this.home.x, this.pos.z - this.home.z) > 110) { this.aggro = false; this.hp = this.maxHp; this.setState("idle"); this.cancelAtk(); }
    if (p.dead) { this.aggro = false; if (this.state === "windup" || this.state === "attack") { this.cancelAtk(); this.setState("idle"); } }

    switch (this.state) {
      case "stagger": this.vel.multiplyScalar(0.9); if (this.t >= this.stunDur) this.setState(this.aggro ? "chase" : "idle"); break;
      case "dizzy": this.vel.multiplyScalar(0.85); if (this.t >= this.stunDur) { this.cd = 0.8; this.setState("chase"); } break;
      case "launched":
        if (this.air <= 0.05 && this.vy < 0 && this.t > 0.15) { this.setState("stagger"); this.stunDur = 0.5; this.air = 0; this.vy = 0; this.g.fx.dustPuff(this.pos, 4); }
        break;
      case "windup": case "attack": case "recover": this.runAtk(dt); break;
      default: this.think(dt);
    }
    // vertical
    const gy = g.world.ground(this.pos.x, this.pos.z);
    if (this.state === "launched") { this.vy -= 24 * dt; this.air += this.vy * dt; if (this.air < 0) this.air = 0; }
    else if (this.flying && this.state !== "stagger") { const tgt = this.hover + Math.sin(this.time * 2.2) * 0.6; this.air += (tgt - this.air) * Math.min(1, dt * 3); }
    else if (this.flying) { this.air = Math.max(0, this.air - 10 * dt); }
    else this.air = Math.max(0, this.air + this.vy * dt);
    // horizontal
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    const fr = this.state === "attack" ? 1 : Math.exp(-6 * dt);
    this.vel.x *= fr; this.vel.z *= fr;
    this.pos.y = Math.max(gy, g.world.ground(this.pos.x, this.pos.z)) + this.air;
    if (this.pos.y - this.air < 0.3 && !this.flying && this.kind !== "grazer") { /* shallow water ok */ }
    this.collide();
    this.pos.y = g.world.ground(this.pos.x, this.pos.z) + this.air;
    this.spd = Math.hypot(this.pos.x - this.lastPos.x, this.pos.z - this.lastPos.z) / Math.max(dt, 1e-4);
    this.lastPos.copy(this.pos);
    this.root.position.copy(this.pos); this.root.rotation.y = this.yaw;
    this.animate(dt);
  }
  collide() {
    const w = this.g.world;
    const prevY = this.pos.y;
    w.collide(this.pos, this.radius, this.flying && this.air > 6);
    this.pos.y = prevY;
    // separation from other enemies
    for (const o of this.g.enemies) {
      if (o === this || !o.alive || o.kind === "grazer" || this.kind === "grazer") continue;
      const dx = this.pos.x - o.pos.x, dz = this.pos.z - o.pos.z, r = this.radius + o.radius;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r && d2 > 1e-4 && Math.abs(this.air - o.air) < 3) { const d = Math.sqrt(d2), push = (r - d) * 0.5; this.pos.x += (dx / d) * push; this.pos.z += (dz / d) * push; }
    }
    // keep inside world
    const rr = Math.hypot(this.pos.x, this.pos.z);
    if (rr > 840) { this.pos.x *= 840 / rr; this.pos.z *= 840 / rr; }
  }
  moveDir(dx: number, dz: number, speed: number, dt: number, smooth = 10) {
    const l = Math.hypot(dx, dz) || 1;
    const k = Math.min(1, dt * smooth);
    this.vel.x += (dx / l * speed - this.vel.x) * k; this.vel.z += (dz / l * speed - this.vel.z) * k;
  }

  applyFlash(dt: number) {
    if (this.flash > 0) {
      this.flash -= dt; this.flashOn = true;
      const f = Math.max(0, this.flash / 0.12);
      for (const m of this.model.mats) { m.emissive.copy(m.userData.e).lerp(WHITE, f * 0.85); m.emissiveIntensity = m.userData.ei + f * 1.2; }
    } else if (this.flashOn) {
      this.flashOn = false;
      for (const m of this.model.mats) { m.emissive.copy(m.userData.e); m.emissiveIntensity = m.userData.ei; }
    }
  }

  animate(dt: number) {
    const pr = this.model.parts, legs = this.model.legs;
    this.walk += this.spd * dt * 1.1;
    const amp = clamp(this.spd / 8, 0, 1) * 0.8;
    legs.forEach((l, i) => { l.rotation.x = Math.sin(this.walk + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * amp; });
    const body = pr.body;
    this.model.tail?.forEach((s, i) => { s.rotation.y = Math.sin(this.time * 4 - i * 0.7) * 0.25; s.rotation.x = Math.sin(this.time * 3 - i * 0.5) * 0.12; });
    let tilt = 0, roll = 0;
    if (this.state === "windup") tilt = -0.35 * Math.min(1, this.windProg * 1.5);
    else if (this.state === "attack") tilt = 0.3;
    else if (this.state === "stagger") roll = Math.sin(this.t * 40) * 0.12;
    else if (this.state === "dizzy") { roll = Math.sin(this.t * 6) * 0.15; tilt = 0.12; }
    else if (this.state === "launched") tilt = -0.9;
    if (this.kind === "kite") {
      const f = Math.sin(this.time * (this.state === "stagger" ? 4 : 13)) * 0.7;
      pr.wL.rotation.z = f; pr.wR.rotation.z = -f; tilt = this.state === "attack" || this.state === "windup" ? -0.3 : 0.15;
      this.model.tail?.forEach((s, i) => { s.rotation.x = Math.sin(this.time * 5 - i) * 0.3; });
    }
    body.rotation.x += (tilt - body.rotation.x) * Math.min(1, dt * 14);
    body.rotation.z += (roll - body.rotation.z) * Math.min(1, dt * 14);
    if (this.kind === "grazer" && pr.head) pr.head.rotation.x = Math.sin(this.time * 1.5) * 0.3 + (this.fleeing ? 0 : 0.4);
    body.position.y = Math.abs(Math.sin(this.walk)) * 0.08 * (amp > 0.1 ? 1 : 0);
    if (this.alertSprite) { this.alertSprite.material.opacity -= dt * 1.2; this.alertSprite.position.y += dt; if (this.alertSprite.material.opacity <= 0) { this.root.remove(this.alertSprite); this.alertSprite = undefined; } }
  }
  animDead() {
    const k = Math.min(1, this.deadT / 1.2);
    this.root.scale.setScalar(this.def.scale * (1 - k * k));
    this.root.rotation.z = k * 1.2;
    this.root.position.y = this.pos.y - k * 0.8;
  }
  die() {
    this.alive = false; this.state = "dead"; this.deadT = 0; this.cancelAtk();
    this.g.onKill(this);
  }
  dispose() {
    this.cancelAtk();
    this.g.scene.remove(this.root);
    for (const m of this.model.mats) m.dispose();
    this.root.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); });
  }
}
const WHITE = new THREE.Color(1, 1, 1);

/* ------------ regular beasts ------------ */
const SK_POUNCE: Atk = { name: "pounce", shape: "body", range: 1.6, windup: 0.5, active: 0.32, recover: 0.55, dmg: 11, speed: 17, track: 0.8, cd: 1.3, vh: 2.5 };
const HORN_CHARGE: Atk = { name: "charge", shape: "line", range: 17, width: 3.4, windup: 0.95, active: 0.8, recover: 0.4, dmg: 22, speed: 23, track: 0.6, cd: 2.5, kb: 9 };
const HORN_GORE: Atk = { name: "gore", shape: "cone", range: 4.6, arc: 1.4, windup: 0.6, active: 0.2, recover: 0.8, dmg: 14, track: 0.5, cd: 1.6 };
const COL_SWEEP: Atk = { name: "sweep", shape: "cone", range: 8, arc: 2.3, windup: 0.95, active: 0.2, recover: 1.0, dmg: 22, track: 0.6, cd: 1.5, kb: 8 };
const COL_SLAM: Atk = { name: "slam", shape: "circle", range: 7.5, off: 5, windup: 1.3, active: 0.2, recover: 0.6, dmg: 32, unblock: true, track: 0.4, cd: 2, vh: 2.2, kb: 10 };
const COL_ROLL: Atk = { name: "roll", shape: "line", range: 22, width: 4.4, windup: 1.1, active: 1.25, recover: 0.5, dmg: 24, speed: 16, track: 0.7, cd: 3, kb: 10 };

export class Beast extends Enemy {
  think(dt: number) {
    const g = this.g;
    if (this.kind === "grazer") return this.thinkGrazer(dt);
    if (!this.aggro) {
      // idle wander
      if (this.state !== "idle") this.setState("idle");
      if (this.t > 2.5) { this.t = 0; this.wanderYaw = Math.random() * 6.28; this.wanderOn = Math.random() < 0.5; }
      if (this.wanderOn) { this.turn(this.wanderYaw, 3, dt); const f = this.fwd(); this.moveDir(f.x, f.z, this.def.speed * 0.3, dt); } 
      return;
    }
    if (this.state === "idle") this.setState("chase");
    const toYaw = this.toYaw;
    const canAtk = this.cd <= 0 && g.attackers < g.maxAttackers;
    switch (this.kind) {
      case "skitter": {
        this.turn(toYaw, 9, dt);
        this.orbitT -= dt;
        if (this.orbitT < 0) { this.orbit = Math.random() < 0.5 ? 1 : -1; this.orbitT = 1 + Math.random() * 1.5; }
        if (canAtk && this.dist < 10 && this.dist > 2) { this.beginAtk(SK_POUNCE); return; }
        const want = this.dist > 6 ? 1 : this.dist < 4 ? -0.6 : 0;
        const tx = Math.sin(toYaw), tz = Math.cos(toYaw);
        const dx = tx * want + tz * this.orbit * 0.9, dz = tz * want - tx * this.orbit * 0.9;
        this.moveDir(dx, dz, this.def.speed * (this.dist > 12 ? 1.2 : 0.85), dt);
        break;
      }
      case "horn": {
        this.turn(toYaw, 4.5, dt);
        if (canAtk) {
          if (this.dist > 8 && this.dist < 24) { this.beginAtk(HORN_CHARGE); return; }
          if (this.dist < 6) { this.beginAtk(HORN_GORE); return; }
        }
        if (this.dist > 5) this.moveDir(Math.sin(toYaw), Math.cos(toYaw), this.def.speed, dt);
        else this.moveDir(0, 0, 0, dt);
        break;
      }
      case "kite": {
        this.turn(toYaw, 6, dt);
        const tx = Math.sin(toYaw), tz = Math.cos(toYaw);
        this.orbitT -= dt; if (this.orbitT < 0) { this.orbit = -this.orbit; this.orbitT = 1.5 + Math.random() * 2; }
        let want = 0; if (this.dist > 14) want = 1; else if (this.dist < 9) want = -1.2;
        this.moveDir(tx * want + tz * this.orbit * 0.7, tz * want - tx * this.orbit * 0.7, this.def.speed * (this.dist < 6 ? 1.5 : 1), dt, 5);
        if (this.cd <= 0 && this.dist < 26) { this.atk = KITE_SHOT; this.setState("windup"); this.t = 0; this.cd = 99; this.hitDone = false; g.fx.ring(this.pos, 0xff8a30, 0.5, 2, 0.8, 0); audio.warn(); }
        break;
      }
      case "colossus": {
        this.turn(toYaw, 2.2, dt);
        if (canAtk) {
          if (this.dist > 12 && this.dist < 30) { this.beginAtk(COL_ROLL); return; }
          if (this.dist < 12) {
            const r = Math.random();
            if (this.dist < 8 && r < 0.45) { this.beginAtk(COL_SWEEP); return; }
            if (r < 0.9) { this.beginAtk(COL_SLAM); return; }
          }
        }
        if (this.dist > 6.5) this.moveDir(Math.sin(toYaw), Math.cos(toYaw), this.def.speed, dt, 4);
        else this.moveDir(0, 0, 0, dt);
        break;
      }
    }
  }
  wanderYaw = 0; wanderOn = false;

  thinkGrazer(dt: number) {
    const near = this.dist < 11;
    if (near) {
      this.fleeing = true;
      this.turn(this.toYaw + Math.PI, 8, dt);
      this.moveDir(-Math.sin(this.toYaw), -Math.cos(this.toYaw), this.def.speed * 1.5, dt);
    } else {
      this.fleeing = false;
      if (this.t > 3) { this.t = 0; this.wanderYaw = Math.random() * 6.28; this.wanderOn = Math.random() < 0.5; }
      if (this.wanderOn) { this.turn(this.wanderYaw, 2, dt); const f = this.fwd(); this.moveDir(f.x, f.z, 1.4, dt); } else this.moveDir(0, 0, 0, dt);
      const hx = this.home.x - this.pos.x, hz = this.home.z - this.pos.z;
      if (Math.hypot(hx, hz) > 25) { this.wanderYaw = Math.atan2(hx, hz); this.wanderOn = true; }
    }
  }

  onAtkStart(a: Atk) {
    super.onAtkStart(a);
    if (this.kind === "kite" && a.name === "shot") {
      const g = this.g;
      const from = this.pos.clone(); from.y += 0.4;
      const to = g.p.pos.clone(); to.y += 1.2;
      const d = to.sub(from).normalize();
      g.projectile(from, d, { speed: 15, dmg: 9, color: 0xff7a2a, homing: 0.9, life: 4, radius: 0.5 });
      this.setState("recover");
    }
    if (a.name === "pounce") audio.tone(300, 0.12, "sawtooth", 0.08, 200);
  }
  onMoveAtk(a: Atk) {
    // wall hit stuns chargers
    if (a.name === "charge" || a.name === "roll") {
      for (const c of this.g.world.colliders) {
        if (!c.on) continue;
        const d = Math.hypot(this.pos.x - c.x, this.pos.z - c.z);
        if (d < c.r + this.radius + 0.6) {
          this.vel.set(0, 0, 0); this.setState("dizzy"); this.stunDur = a.name === "roll" ? 2.4 : 2.6; this.atk = null;
          this.g.fx.burst(this.pos.clone().setY(this.pos.y + 1.2), 25, 0xd8c8a0, 10, 1.2, 0.8, 10);
          this.g.addShake(0.5); audio.boom();
          this.g.fx.number(this.pos.clone().setY(this.pos.y + this.height + 1), "STUNNED", "#ffd24a", 20);
          return;
        }
      }
    }
  }
  onAtkEnd(a: Atk) {
    if (a.name === "charge" || a.name === "roll") { this.setState("dizzy"); this.stunDur = a.name === "roll" ? 1.6 : 1.8; this.atk = null; }
    if (a.name === "slam") { this.setState("dizzy"); this.stunDur = 1.6; this.atk = null; this.g.fx.number(this.pos.clone().setY(this.pos.y + this.height + 1), "EXPOSED", "#ffd24a", 18); }
  }
}
const KITE_SHOT: Atk = { name: "shot", shape: "none", range: 0, windup: 0.85, active: 0.1, recover: 0.6, dmg: 0, cd: 2.4 };

/* ------------ Pylon ------------ */
export class Pylon {
  model = buildPylon(); hp = 160; maxHp = 160; alive = true; fireT = 3 + Math.random() * 2; flash = 0;
  pos: THREE.Vector3;
  constructor(public g: Game, pos: THREE.Vector3) {
    this.pos = pos.clone();
    this.model.root.position.copy(pos);
    g.scene.add(this.model.root);
    g.fx.column(pos, 0xb070ff, 2, 40, 1.0); g.fx.ring(pos, 0xb070ff, 1, 8, 0.7);
  }
  update(dt: number) {
    const t = performance.now() * 0.001;
    this.model.parts.crystal.rotation.y += dt * 1.5;
    this.model.parts.crystal.position.y = 3.4 + Math.sin(t * 2) * 0.25;
    if (this.flash > 0) { this.flash -= dt; this.model.parts.glow.scale.setScalar(11); } else this.model.parts.glow.scale.setScalar(8 + Math.sin(t * 5) * 0.8);
    this.fireT -= dt;
    if (this.fireT < 0 && this.alive && !this.g.p.dead) {
      this.fireT = 5 + Math.random() * 2;
      const from = this.pos.clone(); from.y += 3.4;
      const to = this.g.p.pos.clone(); to.y += 1.2;
      this.g.projectile(from, to.sub(from).normalize(), { speed: 13, dmg: 8, color: 0xb070ff, homing: 0.5, life: 4, radius: 0.5 });
    }
  }
  hit(dmg: number) {
    this.hp -= dmg; this.flash = 0.1;
    this.g.fx.burst(this.pos.clone().setY(this.pos.y + 3.4), 8, 0xc890ff, 7, 0.8, 0.5, 4);
    if (this.hp <= 0 && this.alive) { this.alive = false; this.g.fx.sphere(this.pos.clone().setY(this.pos.y + 3), 0xc080ff, 1, 8, 0.6); this.g.fx.burst(this.pos.clone().setY(this.pos.y + 3), 40, 0xc890ff, 14, 1.2, 0.9, 6); audio.boom(); this.g.addShake(0.5); this.g.scene.remove(this.model.root); }
  }
}

/* ------------ The Warden ------------ */
const W_CLEAVE: Atk = { name: "cleave", shape: "cone", range: 12, arc: 2.5, windup: 1.05, active: 0.25, recover: 1.0, dmg: 28, track: 0.55, cd: 0.5, kb: 12 };
const W_SLAM: Atk = { name: "slam", shape: "circle", range: 10, off: 7, windup: 1.45, active: 0.2, recover: 0.4, dmg: 38, unblock: true, track: 0.45, cd: 0.5, vh: 2.2, kb: 14 };
const W_CHARGE: Atk = { name: "charge", shape: "line", range: 32, width: 6.5, windup: 1.25, active: 1.05, recover: 1.1, dmg: 34, unblock: true, track: 0.7, speed: 31, cd: 0.4, kb: 16 };
const W_BOLT: Atk = { name: "storm", shape: "none", range: 0, windup: 1.3, active: 0.2, recover: 1.0, dmg: 24, cd: 0.5 };
const W_SUMMON: Atk = { name: "summon", shape: "none", range: 0, windup: 1.6, active: 0.2, recover: 1.0, dmg: 0, cd: 0.5 };

export class Warden extends Enemy {
  phase = 1; shield = false; pylons: Pylon[] = []; dormant = true; lastAtk = ""; summonCd = 10; started = false;
  rings: { c: THREE.Vector3; r: number; mesh: THREE.Mesh }[] = [];
  strikes: { p: THREE.Vector3; t: number; tele: Telegraph }[] = [];
  chargeHit = false;
  constructor(g: Game, x: number, z: number) {
    super(g, "warden", x, z, 0, 1);
    this.isBoss = true; this.superArmor = true; this.radius = 3.4; this.height = 9; this.aggroR = 0; this.state = "dormant";
    this.model.parts.body.position.y = -1.2; this.model.parts.head.rotation.x = 0.6;
    this.model.legs.forEach((l) => (l.rotation.x = -0.6));
  }
  begin() { this.dormant = false; this.started = true; this.setState("intro"); this.aggro = true; }
  phaseSpeed() { return this.phase === 1 ? 1 : this.phase === 2 ? 1.12 : 1.28; }

  receive(dmg: number, o: { poise?: number; kb?: THREE.Vector3; launch?: boolean; air?: boolean; from: THREE.Vector3 }) {
    if (this.dormant || this.state === "intro" || this.state === "dead") return { killed: false, broke: false, immune: true };
    if (this.shield) {
      this.flash = 0.06; this.g.fx.burst(this.pos.clone().setY(this.pos.y + 5), 5, 0xb070ff, 8, 0.6, 0.4, 2);
      return { killed: false, broke: false, immune: true };
    }
    this.hp -= dmg; this.flash = 0.1; this.poise -= o.poise ?? 6;
    let broke = false;
    if (this.hp <= 0) { return { killed: true, broke }; }
    const pct = this.hp / this.maxHp;
    if (this.phase === 1 && pct < 0.66) this.nextPhase(2);
    else if (this.phase === 2 && pct < 0.33) this.nextPhase(3);
    else if (this.poise <= 0 && this.state !== "exposed" && this.state !== "phase") { broke = true; this.expose(2.6); this.g.fx.number(this.pos.clone().setY(this.pos.y + 10), "POISE BROKEN", "#ffd24a", 24); }
    return { killed: false, broke };
  }
  onPoiseBreak() { this.expose(2.6); }
  expose(d: number) {
    this.cancelAtk(); this.poise = this.maxPoise; this.stunDur = d; this.setState("exposed"); this.vel.set(0, 0, 0);
    this.g.fx.ring(this.pos, 0xffd24a, 2, 14, 0.6); this.g.addShake(0.5); audio.boom();
  }
  nextPhase(n: number) {
    this.phase = n; this.cancelAtk(); this.setState("phase"); this.shield = true; this.vel.set(0, 0, 0);
    const g = this.g;
    g.hitStop(0.12); g.addShake(1); audio.roar();
    g.fx.flash("#b070ff", 0.5, 800);
    g.banner(n === 2 ? "THE WARDEN AWAKENS" : "THE WARDEN UNBOUND", n === 2 ? "Shatter the Pylons to break its ward" : "Its oath burns — jump the shockwaves", "#c890ff");
    const count = n === 2 ? 3 : 4;
    const slots = g.world.stadium.pylonSlots;
    for (let i = 0; i < count; i++) this.pylons.push(new Pylon(g, slots[(i + (n === 3 ? 0 : 1)) % 4]));
    g.world.stadium.floorMat.emissive.set(n === 2 ? 0xb070ff : 0xff4a3a);
  }

  think(dt: number) {
    const g = this.g;
    this.summonCd -= dt;
    for (const p of this.pylons) p.update(dt);
    if (this.shield && this.pylons.length && this.pylons.every((p) => !p.alive)) {
      this.shield = false; this.pylons = [];
      g.fx.flash("#ffffff", 0.7, 600); g.fx.sphere(this.pos.clone().setY(this.pos.y + 5), 0xb070ff, 2, 14, 0.7); g.addShake(1); audio.boom();
      g.hitStop(0.15);
      g.banner("WARD SHATTERED", "Strike now!", "#ffd24a");
      this.expose(4.5);
    }
    // rings & strikes update
    this.updateHazards(dt);
    if (this.state === "dormant") return;
    if (this.state === "intro") {
      const k = Math.min(1, this.t / 3.2);
      this.model.parts.body.position.y = -1.2 * (1 - k * k);
      this.model.parts.head.rotation.x = 0.6 * (1 - k);
      this.model.legs.forEach((l) => (l.rotation.x = -0.6 * (1 - k)));
      if (this.t > 3.2) { this.setState("chase"); this.cd = 0.8; }
      return;
    }
    if (this.state === "phase") {
      const pr = this.model.parts;
      pr.armR.rotation.x = -2.6 * Math.min(1, this.t / 0.8); pr.armL.rotation.x = -2.2 * Math.min(1, this.t / 0.8);
      if (this.t > 0.9 && !this.roared) { this.roared = true; g.fx.ring(this.pos, 0xb070ff, 2, 30, 0.9); g.fx.burst(this.pos.clone().setY(this.pos.y + 4), 40, 0xb070ff, 16, 1.5, 1, 2); }
      if (this.t > 2.4) { this.roared = false; this.setState("chase"); this.cd = 0.6; }
      return;
    }
    // chase / choose
    const toYaw = this.toYaw;
    this.turn(toYaw, 2.4 * this.phaseSpeed(), dt);
    if (this.cd > 0) {
      if (this.dist > 9) this.moveDir(Math.sin(toYaw), Math.cos(toYaw), 5.5 * this.phaseSpeed(), dt, 4); else this.moveDir(0, 0, 0, dt);
      return;
    }
    const opts: [Atk, number][] = [];
    const d = this.dist;
    if (d < 15) { opts.push([W_CLEAVE, 5]); opts.push([W_SLAM, this.phase === 1 ? 3 : 3.5]); }
    if (d > 12) opts.push([W_CHARGE, 5]); else opts.push([W_CHARGE, 1.5]);
    if (this.phase >= 2) { opts.push([W_BOLT, 3]); if (this.summonCd < 0 && g.enemies.filter((e) => e.alive && e.kind === "skitter" && e.camp === "warden").length < 2) opts.push([W_SUMMON, 6]); }
    let pick = opts.filter((o) => o[0].name !== this.lastAtk);
    if (!pick.length) pick = opts;
    let tot = pick.reduce((s, o) => s + o[1], 0), r = Math.random() * tot, a = pick[0][0];
    for (const o of pick) { r -= o[1]; if (r <= 0) { a = o[0]; break; } }
    this.lastAtk = a.name;
    // scale windup with phase
    const sp = this.phaseSpeed();
    this.atk = { ...a, windup: a.windup / sp, recover: a.recover / (sp * 0.9) };
    this.beginBossAtk(this.atk);
  }
  roared = false;
  beginBossAtk(a: Atk) {
    this.setState("windup"); this.hitDone = false; this.chargeHit = false;
    const col = a.unblock ? 0xb040ff : 0xff3b3b;
    if (a.shape === "cone") this.tele = new Telegraph(this.g.scene, "cone", a.range, a.arc!, col);
    else if (a.shape === "circle") this.tele = new Telegraph(this.g.scene, "circle", a.range, 0, col);
    else if (a.shape === "line") this.tele = new Telegraph(this.g.scene, "line", a.range, a.width!, col);
    this.placeTele();
    if (a.unblock) audio.warn();
    if (a.name === "storm") this.queueStrikes(a.windup);
    if (a.name === "summon") { this.g.fx.ring(this.pos, 0xff8a30, 2, 12, a.windup); }
  }
  queueStrikes(windup: number) {
    const g = this.g, c = g.world.stadium.center, n = this.phase === 3 ? 8 : 5;
    for (let i = 0; i < n + 1; i++) {
      const p = new THREE.Vector3();
      if (i === 0) p.copy(g.p.pos); else { const a = Math.random() * 6.28, r = 6 + Math.random() * 32; p.set(c.x + Math.cos(a) * r, c.y, c.z + Math.sin(a) * r); }
      p.y = g.world.ground(p.x, p.z);
      const tele = new Telegraph(g.scene, "circle", 4.2, 0, 0x7ae8ff);
      tele.group.position.set(p.x, p.y + 0.25, p.z);
      this.strikes.push({ p, t: -(windup * (0.55 + Math.random() * 0.2)) + (i === 0 ? 0 : 0), tele });
      this.strikes[this.strikes.length - 1].t = 0;
      (this.strikes[this.strikes.length - 1] as { delay?: number }).delay = windup + (i === 0 ? 0 : 0.0) + i * 0.08;
    }
  }
  updateHazards(dt: number) {
    const g = this.g;
    for (let i = this.strikes.length - 1; i >= 0; i--) {
      const s = this.strikes[i] as { p: THREE.Vector3; t: number; tele: Telegraph; delay: number };
      s.t += dt; s.tele.set(s.t / s.delay);
      if (s.t >= s.delay) {
        s.tele.remove(); this.strikes.splice(i, 1);
        g.fx.column(s.p, 0xbff4ff, 2.2, 60, 0.4); g.fx.burst(s.p.clone().setY(s.p.y + 1), 16, 0x9ff0ff, 10, 1, 0.5, 8); g.fx.ring(s.p, 0x9ff0ff, 1, 5, 0.35);
        g.addShake(0.35); audio.thunder();
        const p = g.p;
        if (!p.dead && Math.hypot(p.pos.x - s.p.x, p.pos.z - s.p.z) < 4.2 && p.pos.y - s.p.y < 4) g.hurtPlayer(24, s.p, { unblock: true, kb: 6 });
      }
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i], prev = r.r; r.r += 20 * dt;
      r.mesh.scale.set(r.r, 1, r.r);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 - r.r / 60);
      const p = g.p, d = Math.hypot(p.pos.x - r.c.x, p.pos.z - r.c.z);
      const gy = g.world.ground(p.pos.x, p.pos.z);
      if (!p.dead && d > prev - 1 && d < r.r + 1 && p.pos.y - gy < 1.5) g.hurtPlayer(20, r.c, { unblock: true, kb: 8, ring: true });
      if (r.r > 52) { g.scene.remove(r.mesh); (r.mesh.material as THREE.Material).dispose(); this.rings.splice(i, 1); }
    }
  }
  spawnRing(c: THREE.Vector3) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff8a3a, transparent: true, opacity: 0.9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.set(c.x, c.y + 0.5, c.z); m.scale.set(1, 1, 1);
    this.g.scene.add(m); this.rings.push({ c: c.clone(), r: 1, mesh: m });
  }

  onAtkStart(a: Atk) {
    const g = this.g;
    if (a.name === "slam") {
      super.onAtkStart(a);
      if (this.phase >= 3) this.spawnRing(this.pos);
      g.fx.burst(this.pos.clone().setY(this.pos.y + 0.5), 30, 0xffb060, 12, 1.4, 0.9, 10);
    } else if (a.name === "cleave") {
      const f = this.fwd();
      g.fx.slash(new THREE.Vector3(this.pos.x + f.x * 2, this.pos.y + 3.5, this.pos.z + f.z * 2), this.yaw, 11, 2.5, 0xffa040, 0.0, 0, 0.3);
      this.vel.x = f.x * 14; this.vel.z = f.z * 14; g.addShake(0.6); audio.boom();
    } else if (a.name === "charge") { audio.roar(); }
    else if (a.name === "storm") { this.setState("attack"); }
    else if (a.name === "summon") {
      audio.roar();
      for (let i = 0; i < 3; i++) {
        const ang = Math.random() * 6.28, r = 12 + Math.random() * 10, c = g.world.stadium.center;
        const e = g.spawnEnemy("skitter", c.x + Math.cos(ang) * r, c.z + Math.sin(ang) * r, { camp: "warden", aggro: true });
        g.fx.column(e.pos, 0xff8a30, 1.5, 12, 0.6); g.fx.burst(e.pos, 14, 0xff8a30, 8, 1, 0.6);
      }
      this.summonCd = 22;
    }
  }
  onMoveAtk(a: Atk) {
    if (a.name !== "charge") return;
    const g = this.g;
    if (this.t % 0.08 < 0.02) g.fx.dustPuff(this.pos, 3);
    for (const pl of g.world.stadium.pillars) {
      if (pl.down) continue;
      if (Math.hypot(this.pos.x - pl.x, this.pos.z - pl.z) < 2.6 + this.radius + 0.3) {
        pl.down = true; pl.col.on = false; pl.dir = Math.atan2(this.pos.z - pl.z, this.pos.x - pl.x) + Math.PI;
        this.vel.set(0, 0, 0); this.expose(3.8); this.atk = null;
        g.fx.burst(new THREE.Vector3(pl.x, pl.g.position.y + 6, pl.z), 50, 0xd8c8a0, 16, 1.6, 1.1, 10);
        g.hitStop(0.12); g.addShake(1.1); g.fx.flash("#ffffff", 0.3, 300);
        g.banner("PILLAR TOPPLED", "The Warden is stunned!", "#ffd24a");
        g.discoverMechanic();
        return;
      }
    }
  }
  onAtkEnd(a: Atk) {
    if (a.name === "slam") { this.expose(2.4); this.atk = null; }
    if (a.name === "storm") { /* strikes resolve on their own */ }
  }
  runAtk(dt: number) {
    const a = this.atk;
    if (a && (a.name === "storm" || a.name === "summon") && (this.state === "windup")) {
      const prog = this.t / a.windup; this.windProg = prog;
      if (this.t >= a.windup) { this.setState("attack"); this.onAtkStart(a); }
      if (a.name === "summon" || a.name === "storm") { this.turn(this.toYaw, 3, dt); }
      return;
    }
    if (a && (a.name === "storm" || a.name === "summon") && this.state === "attack") { this.windProg = 1; if (this.t >= 0.4) { this.setState("recover"); } return; }
    super.runAtk(dt);
  }

  die() {
    this.alive = false; this.state = "dead"; this.deadT = 0; this.cancelAtk();
    for (const p of this.pylons) if (p.alive) { p.alive = false; this.g.scene.remove(p.model.root); }
    this.g.onKill(this);
  }
  animDead() {
    const k = Math.min(1, this.deadT / 3.5);
    this.model.parts.body.position.y = -2.5 * k;
    this.model.parts.body.rotation.x = -0.4 * k;
    this.model.parts.head.rotation.x = 0.9 * k;
    if (this.deadT > 0.1 && Math.random() < 0.5) this.g.fx.burst(this.pos.clone().setY(this.pos.y + 2 + Math.random() * 6), 3, 0x9ff0ff, 8, 1, 0.8, -2);
    if (this.deadT > 3.5) { this.root.scale.setScalar(this.def.scale * 1.05 * Math.max(0, 1 - (this.deadT - 3.5) * 2)); if (this.deadT > 4.1) this.removed = true; }
  }
  animate(dt: number) {
    super.animate(dt);
    const pr = this.model.parts;
    if (this.state === "dead" || this.state === "intro" || this.state === "dormant" || this.state === "phase") return;
    const body = pr.body as THREE.Group;
    let ar = 0.1 + Math.sin(this.time * 1.5) * 0.04, al = ar, az = 0, bz = 0;
    const a = this.atk;
    if (this.state === "windup" && a) {
      const k = Math.min(1, this.windProg);
      if (a.name === "cleave") { ar = -1.2 - k * 0.6; az = 1.4 * k; bz = k * 0.4; }
      else if (a.name === "slam") { ar = -3.0 * k; al = -2.0 * k; }
      else if (a.name === "charge") { ar = -0.4; body.rotation.x = k * 0.3; }
      else { ar = -2.8 * k; al = -2.8 * k; }
    } else if (this.state === "attack" && a) {
      if (a.name === "cleave") { ar = -1.2; az = -1.4; bz = -0.5; }
      else if (a.name === "slam") { ar = 0.9; al = 0.5; }
      else if (a.name === "charge") { ar = 0.2; body.rotation.x = 0.35; }
    } else if (this.state === "exposed") { ar = 0.5; al = 0.5; body.rotation.x = 0.25; pr.head.rotation.x = 0.5; }
    pr.armR.rotation.x += (ar - pr.armR.rotation.x) * Math.min(1, dt * 14);
    pr.armR.rotation.z += (az - pr.armR.rotation.z) * Math.min(1, dt * 14);
    pr.armL.rotation.x += (al - pr.armL.rotation.x) * Math.min(1, dt * 14);
    body.rotation.z += (bz - body.rotation.z) * Math.min(1, dt * 12);
    if (this.state !== "exposed") pr.head.rotation.x += (0 - pr.head.rotation.x) * Math.min(1, dt * 8);
    const cg = pr.coreGlow as THREE.Sprite;
    cg.scale.setScalar((this.state === "exposed" ? 8 : 4.5) + Math.sin(this.time * 6) * 0.5);
  }
}
