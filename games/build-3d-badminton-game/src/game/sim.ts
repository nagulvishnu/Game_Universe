// Core game simulation (no rendering): players, shuttle, rules flow, drills. Deterministic given seed.
import { ArenaId, CONTACT_DELAY, COURT, DIFF, Difficulty, FIXED_DT, RuleCfg } from './constants';
import { Ball, flight, NET_H, NET_HALF, solveBySpeed, stepBall } from './physics';
import {
  Anim, ContactEval, Grade, PlayerBody, ShotId, Special, animFor, chooseShot, evaluateContact, gradeOf, planShot, specialFor,
} from './shots';
import { FaultReason, PointResult, RulesState, ServeInfo, awardPoint, judgeLanding, makeRules, nextGame, serveInfo } from './rules';
import { AIState, aiControl, newAI } from './ai';
import { Look } from './storage';

export interface InputState {
  mx: number; my: number; sprint: boolean; shot: number; jump: boolean;
  aimX?: number | null; special?: boolean;
}
export const noInput = (): InputState => ({ mx: 0, my: 0, sprint: false, shot: 0, jump: false });

export type Phase = 'intro' | 'reset' | 'serve' | 'rally' | 'point' | 'gameBreak' | 'over' | 'drill';

export interface SimEvent { t: string; [k: string]: any } // eslint-disable-line @typescript-eslint/no-explicit-any

export interface TeamCfg {
  names: string[];
  humans: number[]; // -1 = AI
  diff: Difficulty;
  looks: (Look | null)[];
}
export type DrillKind =
  | 'free' | 'serve' | 'smash' | 'net' | 'perfect' | 'movement' | 'target'
  | 'blitz' | 'streak' | 'perfectSmash' | 'accuracy';
export interface DrillCfg { kind: DrillKind; timeLimit: number; goal: number; label: string; }
export interface LaunchConfig {
  kind: 'match' | 'drill';
  label: string;
  arena: ArenaId;
  rules: RuleCfg;
  teams: [TeamCfg, TeamCfg];
  humans: number;
  drill?: DrillCfg;
  shortSide: 'screen' | 'opponent';
  context?: { type: 'tournament' | 'championship'; [k: string]: unknown };
  seed?: number;
}

export interface Swing {
  t: number; dur: number; contactT: number; winStart: number; winEnd: number;
  anim: Anim; key: number; aimX: number | null; superArmed: boolean;
  prevEval: ContactEval | null; done: boolean; lunge: boolean; shot: ShotId | null;
}
export interface SimPlayer {
  id: number; team: 0 | 1; slot: number; name: string; human: number; diff: Difficulty | null;
  x: number; z: number; vx: number; vz: number; y: number; vy: number;
  grounded: boolean; side: 1 | -1; stamina: number; sprinting: boolean; exhausted: boolean;
  swing: Swing | null; recover: number; lunge: boolean;
  autoSmash: boolean; autoT: number; autoAim: number | null; autoSuper: boolean;
  meter: number; mood: '' | 'win' | 'lose';
  ai: AIState | null; look: Look | null;
  timing: { show: boolean; prox: number; score: number; grade: Grade; inReach: boolean };
  footT: number; speedNow: number; lastShot: ShotId | null; aimLook: number;
  stats: { hits: number; perfect: number; smashes: number };
}
export interface ShuttleState extends Ball {
  active: boolean; held: boolean; drag: number;
  lastHitTeam: number; lastHitPlayer: number; hits: number;
  netTouched: boolean; isServe: boolean; shot: ShotId | null; special: Special | null;
  landTx: number; landTz: number; landedT: number; visible: boolean; speed: number; grade: Grade;
}

export interface DrillState {
  cfg: DrillCfg; score: number; streak: number; best: number; returns: number; perfects: number;
  smashPerfects: number; zoneHits: number; misses: number; timeLeft: number; feedT: number;
  targets: { x: number; z: number; r: number }[]; cone: { x: number; z: number } | null; cones: number;
  done: boolean; success: boolean; serveX: number; msg: string; started: boolean; smashPoints: number;
}

const MAX_WALK = 5.1, MAX_SPRINT = 7.1, ACCEL = 30, DECEL = 40, JUMP_V = 6.3, JUMP_G = 16;
const SERVE_EVAL: ContactEval = { inReach: true, score: 0.6, hd: 0, dy: 0, dist: 0, backhand: false };
const ATTACK: ShotId[] = ['smash', 'jumpSmash', 'drive', 'cross', 'flatPush'];

export class Sim {
  cfg: LaunchConfig;
  rules: RulesState;
  players: SimPlayer[] = [];
  shuttle: ShuttleState;
  phase: Phase = 'intro';
  phaseT = 0;
  events: SimEvent[] = [];
  time = 0;
  hw: number;
  serve: ServeInfo;
  teamMode: ['defend' | 'attack', 'defend' | 'attack'] = ['defend', 'defend'];
  drill: DrillState | null = null;
  pointInfo: { winner: number; reason: FaultReason; label: string; result: PointResult } | null = null;
  winner: -1 | 0 | 1 = -1;
  stats = {
    smashPoints: [0, 0], perfect: [0, 0], hits: [0, 0], shots: [0, 0], shotsIn: [0, 0],
    rallies: 0, longest: 0, rallyHits: 0, duration: 0,
  };
  private acc = 0;
  private seed: number;
  private buf: { shot: number; shotT: number; jump: boolean; jumpT: number; lat: number; aimX: number | null; special: boolean }[] = [];
  private resetT = 0;

  constructor(cfg: LaunchConfig) {
    this.cfg = cfg;
    this.seed = (cfg.seed ?? (Math.random() * 1e9) | 0) >>> 0;
    this.rules = makeRules(cfg.rules, 0);
    this.hw = cfg.rules.doubles || cfg.rules.arcade ? COURT.halfWidthD : COURT.halfWidthS;
    this.serve = serveInfo(this.rules);
    this.shuttle = {
      x: 0, y: 1, z: 0, vx: 0, vy: 0, vz: 0, active: false, held: false, drag: 1, lastHitTeam: -1, lastHitPlayer: -1,
      hits: 0, netTouched: false, isServe: false, shot: null, special: null, landTx: 0, landTz: 0, landedT: 99, visible: true, speed: 0, grade: 'normal',
    };
    for (let i = 0; i < 2; i++) this.buf.push({ shot: 0, shotT: 0, jump: false, jumpT: 0, lat: 0, aimX: null, special: false });
    let id = 0;
    for (let t = 0; t < 2; t++) {
      const tc = cfg.teams[t];
      for (let s = 0; s < tc.names.length; s++) {
        const human = tc.humans[s] ?? -1;
        this.players.push({
          id: id++, team: t as 0 | 1, slot: s, name: tc.names[s], human, diff: human >= 0 ? null : tc.diff,
          x: 0, z: 0, vx: 0, vz: 0, y: 0, vy: 0, grounded: true, side: this.rules.teams[t].side, stamina: 1, sprinting: false, exhausted: false,
          swing: null, recover: 0, lunge: false, autoSmash: false, autoT: 0, autoAim: null, autoSuper: false,
          meter: 0, mood: '', ai: human >= 0 ? null : newAI(), look: tc.looks[s] ?? null,
          timing: { show: false, prox: 0, score: 0, grade: 'normal', inReach: false },
          footT: 0, speedNow: 0, lastShot: null, aimLook: 0, stats: { hits: 0, perfect: 0, smashes: 0 },
        });
      }
    }
    if (cfg.kind === 'drill') this.startDrill();
    else {
      this.snapToSpots();
      this.phase = 'intro';
    }
  }

  // -------- utilities --------
  rnd = () => {
    this.seed = (this.seed + 0x6d2b79f5) >>> 0;
    let t = this.seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  emit(e: SimEvent) { this.events.push(e); }
  drainEvents(): SimEvent[] { const e = this.events; this.events = []; return e; }
  get isDrill() { return this.cfg.kind === 'drill'; }

  isServer(p: SimPlayer) {
    if (this.isDrill) return this.drill!.cfg.kind === 'serve';
    return p.team === this.serve.serverTeam && p.slot === this.serve.serverSlot;
  }
  teamScore(t: number) { return this.rules.teams[t].score; }
  body(p: SimPlayer): PlayerBody {
    return { x: p.x, z: p.z, y: p.y, vx: p.vx, vz: p.vz, side: p.side, lunge: p.lunge };
  }
  heading(p: SimPlayer) {
    const s = this.shuttle;
    return s.active && s.lastHitTeam >= 0 && s.lastHitTeam !== p.team && s.vz * p.side > 0;
  }
  canHit(p: SimPlayer) {
    const s = this.shuttle;
    return s.active && s.lastHitTeam !== p.team && s.z * p.side > -0.1;
  }

  spotFor(p: SimPlayer): { x: number; z: number } {
    if (this.isDrill) {
      const d = this.drill!;
      return d.cfg.kind === 'serve' ? { x: d.serveX, z: 2.7 } : { x: 0, z: 4.2 };
    }
    const si = this.serve;
    const t = this.rules.teams[p.team];
    const dbl = this.rules.cfg.doubles;
    if (p.team === si.serverTeam) {
      if (p.slot === si.serverSlot) return si.serverPos;
      return { x: -si.serverPos.x, z: t.side * 4.6 };
    }
    if (p.slot === si.receiverSlot) return si.receiverPos;
    return { x: -si.receiverPos.x, z: t.side * (dbl ? 4.6 : 4.4) };
  }

  private snapToSpots() {
    for (const p of this.players) {
      p.side = this.rules.teams[p.team].side;
      const s = this.spotFor(p);
      p.x = s.x; p.z = s.z; p.vx = p.vz = 0; p.y = 0; p.vy = 0; p.grounded = true;
      p.swing = null; p.recover = 0; p.lunge = false; p.mood = '';
    }
    this.placeHeld();
  }
  private placeHeld() {
    const sv = this.players.find((p) => this.isServer(p));
    const sh = this.shuttle;
    if (sv) {
      sh.x = sv.x + sv.side * 0.3; sh.z = sv.z - sv.side * 0.35; sh.y = 1.15;
    }
    sh.vx = sh.vy = sh.vz = 0; sh.held = true; sh.active = false; sh.visible = true; sh.landedT = 99; sh.speed = 0;
  }

  // -------- main update --------
  update(dt: number, inputs: InputState[]) {
    // buffer edge inputs so no press is lost between frames
    for (let i = 0; i < inputs.length; i++) {
      const b = this.buf[i];
      if (!b) continue;
      const inp = inputs[i];
      if (inp.shot) { b.shot = inp.shot; b.shotT = 0.2; b.lat = inp.mx; }
      if (inp.jump) { b.jump = true; b.jumpT = 0.2; b.lat = inp.mx; }
    }
    this.acc += Math.min(dt, 0.1);
    while (this.acc >= FIXED_DT) {
      this.tick(FIXED_DT, inputs);
      this.acc -= FIXED_DT;
    }
  }

  private tick(dt: number, inputs: InputState[]) {
    if (this.phase !== 'over') this.time += dt;
    this.phaseT += dt;
    const sh = this.shuttle;
    if (sh.landedT < 99) sh.landedT += dt;

    // phase logic
    switch (this.phase) {
      case 'intro':
        if (this.phaseT > 1.7) this.beginServe();
        break;
      case 'reset':
        this.resetT += dt;
        break;
      case 'point':
        if (this.phaseT > (this.pointInfo?.result === 'point' ? 1.9 : 3.2)) this.afterPoint();
        break;
      case 'gameBreak':
        if (this.phaseT > 2.8) {
          nextGame(this.rules, this.pointInfo!.winner as 0 | 1);
          this.serve = serveInfo(this.rules);
          this.snapToSpots();
          this.emit({ t: 'changeEnds' });
          this.phase = 'intro';
          this.phaseT = 0;
        }
        break;
      default:
    }

    if (this.phase === 'serve' || this.phase === 'rally' || this.phase === 'point' || this.phase === 'drill') {
      if (this.phase === 'serve' || this.isDrill) {
        if (sh.held) this.placeHeld();
      }
    }
    if (this.phase === 'rally' || this.phase === 'drill' || this.phase === 'point') this.stepShuttle(dt);
    if (this.isDrill) this.drillTick(dt);

    // players
    let allArrived = true;
    for (const p of this.players) {
      let cmd: InputState;
      const act = { shot: 0, jump: false, lat: 0, aimX: null as number | null, special: false };
      if (this.phase === 'reset' || this.phase === 'intro') {
        cmd = noInput();
        if (this.phase === 'reset') {
          const sp = this.spotFor(p);
          const dx = sp.x - p.x, dz = sp.z - p.z;
          const dist = Math.hypot(dx, dz);
          if (dist > 0.12) {
            allArrived = false;
            cmd.mx = (dx / dist) * p.side * Math.min(1, dist / 0.5);
            cmd.my = -(dz / dist) * p.side * Math.min(1, dist / 0.5);
            cmd.sprint = dist > 2;
          }
        }
      } else if (this.phase === 'over' || this.phase === 'gameBreak') {
        cmd = noInput();
      } else if (p.human >= 0) {
        cmd = inputs[p.human] ? { ...inputs[p.human], shot: 0, jump: false } : noInput();
        const b = this.buf[p.human];
        if (b) {
          b.shotT -= dt; b.jumpT -= dt;
          if (b.shotT <= 0) b.shot = 0;
          if (b.jumpT <= 0) b.jump = false;
          act.shot = b.shot; act.jump = b.jump; act.lat = b.lat;
        }
        if (this.phase === 'point') { act.shot = 0; act.jump = false; }
        // consumption handled below
      } else {
        cmd = aiControl(this, p, dt);
        act.shot = cmd.shot; act.jump = cmd.jump; act.aimX = cmd.aimX ?? null; act.special = !!cmd.special; act.lat = cmd.mx;
      }

      const locked = this.phase === 'serve' && this.isServer(p);
      if (locked) { cmd.mx = 0; cmd.my = 0; cmd.sprint = false; }
      const consumed = this.handleActions(p, act);
      if (consumed && p.human >= 0) {
        const b = this.buf[p.human];
        if (consumed.shot) b.shot = 0;
        if (consumed.jump) b.jump = false;
      }
      this.movePlayer(p, cmd, dt, locked);
      this.updateSwing(p, dt);
      this.updateTiming(p);
    }
    this.separate();
    if (this.phase === 'reset' && (allArrived || this.resetT > 3.2)) {
      if (!allArrived) this.snapToSpots();
      this.beginServe();
    }
  }

  private beginServe() {
    this.phase = 'serve';
    this.phaseT = 0;
    this.resetT = 0;
    this.serve = serveInfo(this.rules);
    for (const p of this.players) {
      p.mood = '';
      if (p.ai) { p.ai.serveT = 0.9 + this.rnd() * 0.7; p.ai.seenHit = -1; }
    }
    this.shuttle.lastHitTeam = -1;
    this.shuttle.lastHitPlayer = -1;
    this.shuttle.netTouched = false;
    this.placeHeld();
    this.emit({ t: 'serveReady', team: this.serve.serverTeam, slot: this.serve.serverSlot });
  }

  // -------- player actions --------
  private handleActions(p: SimPlayer, act: { shot: number; jump: boolean; lat: number; aimX: number | null; special: boolean }) {
    const consumed = { shot: false, jump: false };
    const able = !p.swing && p.recover <= 0 && (this.phase === 'rally' || this.phase === 'serve' || this.phase === 'drill');
    if (!able) return consumed;
    if (act.shot > 0) {
      if (this.startSwing(p, act.shot, act)) consumed.shot = true;
    } else if (act.jump) {
      if (!p.grounded) {
        if (this.startSwing(p, 5, act)) consumed.jump = true;
      } else if (this.phase !== 'serve') {
        const heading = this.heading(p) && this.shuttle.z * p.side > -1.5;
        let groundSmash = false;
        if (heading) {
          const pre: Ball = { ...this.shuttle };
          stepBall(pre, CONTACT_DELAY, this.shuttle.drag);
          const ev = evaluateContact(this.body(p), pre, this.rules.cfg.arcade);
          groundSmash = ev.inReach && pre.y >= 2.0;
        }
        if (groundSmash) {
          if (this.startSwing(p, 5, act)) consumed.jump = true;
        } else {
          p.vy = JUMP_V; p.grounded = false; p.autoSmash = heading; p.autoT = 1.0;
          p.autoAim = act.aimX; p.autoSuper = act.special || (p.human >= 0 && p.meter >= 100);
          this.emit({ t: 'jump', p: p.id });
          consumed.jump = true;
        }
      }
    }
    // auto jump-smash when airborne with the shuttle in range
    if (p.autoSmash && !p.grounded && !p.swing && p.recover <= 0) {
      p.autoT -= FIXED_DT;
      if (p.autoT <= 0) p.autoSmash = false;
      else if (this.heading(p) && this.canHit(p) && p.y > 0.3) {
        const pre: Ball = { ...this.shuttle };
        stepBall(pre, CONTACT_DELAY, this.shuttle.drag);
        const ev = evaluateContact(this.body(p), pre, this.rules.cfg.arcade);
        if (ev.inReach && pre.y >= 2.0) {
          this.startSwing(p, 5, { lat: act.lat, aimX: p.autoAim, special: p.autoSuper }, p.autoSuper);
          p.autoSmash = false;
        }
      }
    }
    return consumed;
  }

  private startSwing(p: SimPlayer, key: number, act: { lat: number; aimX: number | null; special: boolean }, forceSuper = false): boolean {
    if (p.swing || p.recover > 0) return false;
    const sh = this.shuttle;
    const serving = this.phase === 'serve' && this.isServer(p) && sh.held;
    if (this.phase === 'serve' && !serving) return false;
    if (serving && key === 5) return false;
    const airborne = !p.grounded;
    const pre: Ball = { ...sh };
    if (sh.active) stepBall(pre, CONTACT_DELAY, sh.drag);
    let anim: Anim = 'serve';
    let lunge = false;
    if (!serving) {
      const body = this.body(p);
      const ev = evaluateContact(body, pre, this.rules.cfg.arcade);
      if (!ev.inReach && sh.active && p.grounded) {
        lunge = evaluateContact({ ...body, lunge: true }, pre, this.rules.cfg.arcade).inReach;
      }
      const shot = chooseShot({
        key, y: pre.y, airborne, backhand: ev.backhand, sprinting: p.sprinting, forwardSpeed: -p.vz * p.side,
        zFromNet: Math.abs(p.z), serving: false,
      });
      anim = animFor(shot, pre.y, airborne);
      if (ev.backhand && !airborne && key !== 5) anim = 'back';
    }
    const durs: Record<Anim, [number, number]> = {
      overhead: [0.4, 0.15], jump: [0.38, 0.13], side: [0.32, 0.12], under: [0.34, 0.13], back: [0.36, 0.13], serve: [0.55, 0.22],
    };
    const [dur, contactT] = durs[anim];
    let aimX = act.aimX;
    if (aimX == null && !serving) {
      const inner = this.hw - 0.4;
      if (key === 3 || key === 4) {
        let sgn = key === 3 ? 1 : -1;
        if (this.cfg.shortSide === 'opponent') sgn = -sgn;
        aimX = sgn * p.side * inner;
      } else {
        const lat = Math.abs(act.lat) > 0.3 ? Math.sign(act.lat) : 0;
        aimX = lat * p.side * inner * 0.85;
      }
    }
    const superArmed = forceSuper || (key === 5 && (act.special || (p.human >= 0 && p.meter >= 100)));
    p.swing = {
      t: 0, dur, contactT, winStart: contactT - 0.06, winEnd: contactT + 0.08, anim, key, aimX, superArmed,
      prevEval: null, done: false, lunge, shot: null,
    };
    if (lunge) {
      p.lunge = true;
      const dx = pre.x - p.x, dz = pre.z - p.z;
      const l = Math.hypot(dx, dz) || 1;
      p.vx += (dx / l) * 3.4; p.vz += (dz / l) * 3.4;
    }
    this.emit({ t: 'swing', p: p.id, anim, lunge, key });
    return true;
  }

  private updateSwing(p: SimPlayer, dt: number) {
    const sw = p.swing;
    if (p.recover > 0) p.recover -= dt;
    if (!sw) { if (p.lunge && p.recover <= 0) p.lunge = false; return; }
    sw.t += dt;
    const sh = this.shuttle;
    if (!sw.done) {
      if (sw.anim === 'serve') {
        if (sw.t >= sw.contactT && sh.held) { sw.done = true; this.doHit(p, sw, SERVE_EVAL); }
      } else if (sw.t >= sw.winStart) {
        if (this.canHit(p)) {
          const ev = evaluateContact(this.body(p), sh, this.rules.cfg.arcade);
          if (ev.inReach) {
            if (sw.prevEval && ev.score < sw.prevEval.score - 0.002) { sw.done = true; this.doHit(p, sw, sw.prevEval); }
            else if (sw.t >= sw.winEnd) { sw.done = true; this.doHit(p, sw, ev); }
            else sw.prevEval = ev;
          } else if (sw.prevEval) { sw.done = true; this.doHit(p, sw, sw.prevEval); }
        }
        if (!sw.done && sw.t >= sw.winEnd) {
          sw.done = true;
          p.recover = 0.2;
          this.emit({ t: 'whiff', p: p.id });
          if (this.isDrill && this.drill) this.drill.msg = 'MISS';
        }
      }
    }
    if (sw.t >= sw.dur) {
      p.swing = null;
      if (sw.lunge) p.recover = Math.max(p.recover, 0.28);
    }
  }

  private doHit(p: SimPlayer, sw: Swing, ev: ContactEval) {
    const sh = this.shuttle;
    const side = p.side;
    const serving = sh.held;
    const bias = p.diff ? DIFF[p.diff].bias : 0;
    const score = Math.max(0, Math.min(1, ev.score + bias));
    const grade: Grade = serving ? 'normal' : gradeOf(score);
    const airborne = !p.grounded;
    const shot = chooseShot({
      key: sw.key, y: sh.y, airborne, backhand: ev.backhand && sw.key !== 5, sprinting: p.sprinting, forwardSpeed: -p.vz * side,
      zFromNet: Math.abs(p.z), serving,
    });
    const special = serving ? null : specialFor(shot, grade, sw.superArmed);
    const plan = planShot({
      shot, grade, special, key: sw.key === 5 ? 3 : sw.key, aimX: sw.aimX, side, start: { x: sh.x, y: sh.y, z: sh.z },
      hw: this.hw, serveXSign: this.isDrill ? -Math.sign(this.drill!.serveX) : this.serve.targetXSign,
      serveLong: this.rules.cfg.doubles ? COURT.longServiceD : COURT.halfLen, rnd: this.rnd,
    });
    sh.vx = plan.vx; sh.vy = plan.vy; sh.vz = plan.vz; sh.drag = plan.drag;
    sh.held = false; sh.active = true; sh.visible = true;
    sh.lastHitTeam = p.team; sh.lastHitPlayer = p.id; sh.netTouched = false; sh.isServe = serving;
    sh.hits++; sh.shot = shot; sh.special = special; sh.landTx = plan.tx; sh.landTz = plan.tz; sh.grade = grade;
    sh.speed = Math.hypot(sh.vx, sh.vy, sh.vz);
    sw.shot = shot;
    p.lastShot = shot;
    this.stats.hits[p.team]++; this.stats.shots[p.team]++; this.stats.shotsIn[p.team]++;
    this.stats.rallyHits++;
    p.stats.hits++;
    if (grade === 'perfect') { p.stats.perfect++; this.stats.perfect[p.team]++; }
    if (shot === 'smash' || shot === 'jumpSmash') p.stats.smashes++;
    // meter
    const arc = this.rules.cfg.arcade ? 1.8 : 1;
    const gain = serving ? 0 : grade === 'perfect' ? 16 : grade === 'good' ? 10 : grade === 'normal' ? 6 : 2;
    if (special === 'superSmash') p.meter = 0;
    else p.meter = Math.min(100, p.meter + gain * arc + (this.stats.rallyHits > 6 ? 3 : 0));
    this.teamMode[p.team] = ATTACK.includes(shot) || special ? 'attack' : 'defend';
    if (!this.isDrill) {
      this.teamMode[1 - p.team] = ATTACK.includes(shot) ? 'defend' : this.teamMode[1 - p.team];
    }
    if (serving) {
      this.phase = 'rally'; this.phaseT = 0;
      this.stats.rallyHits = 1;
    }
    this.emit({
      t: 'hit', p: p.id, team: p.team, shot, grade, special, x: sh.x, y: sh.y, z: sh.z, speed: sh.speed,
      flight: plan.launch.flightT, meter: p.meter, serve: serving, airborne, human: p.human,
    });
    if (this.isDrill) this.drillHit(p, shot, grade, special);
  }

  // -------- movement --------
  private movePlayer(p: SimPlayer, cmd: InputState, dt: number, locked: boolean) {
    const side = p.side;
    let mx = Math.max(-1, Math.min(1, cmd.mx)), my = Math.max(-1, Math.min(1, cmd.my));
    const mag = Math.hypot(mx, my);
    if (mag > 1) { mx /= mag; my /= mag; }
    const wx = side * mx, wz = -side * my;
    const dm = p.diff ? DIFF[p.diff].speed : 1;
    const wantSprint = cmd.sprint && mag > 0.2 && p.grounded && !p.exhausted && p.stamina > 0.02 && !locked;
    p.sprinting = wantSprint;
    let vmax = (wantSprint ? MAX_SPRINT : MAX_WALK) * dm;
    if (p.swing) vmax *= p.swing.anim === 'serve' ? 0.2 : 0.5;
    else if (p.recover > 0) vmax *= 0.65;
    if (p.lunge) vmax *= 0.6;
    if (this.rules.cfg.arcade) vmax *= 1.08;
    const tvx = wx * vmax, tvz = wz * vmax;
    const acc = (mag > 0.05 ? ACCEL : DECEL) * (p.grounded ? 1 : 0.3) * dm;
    const dx = tvx - p.vx, dz = tvz - p.vz;
    const len = Math.hypot(dx, dz);
    const step = acc * dt;
    if (len <= step) { p.vx = tvx; p.vz = tvz; } else { p.vx += (dx / len) * step; p.vz += (dz / len) * step; }
    if (locked) { p.vx = 0; p.vz = 0; }
    p.x += p.vx * dt; p.z += p.vz * dt;
    p.speedNow = Math.hypot(p.vx, p.vz);
    // stamina
    if (wantSprint) p.stamina = Math.max(0, p.stamina - 0.42 * dt);
    else p.stamina = Math.min(1, p.stamina + 0.3 * dt);
    if (p.stamina <= 0.02) p.exhausted = true;
    if (p.exhausted && p.stamina > 0.3) p.exhausted = false;
    // bounds: own half
    const lim = COURT.halfWidthD + 0.9;
    p.x = Math.max(-lim, Math.min(lim, p.x));
    const zn = p.z * side;
    const zc = Math.max(0.6, Math.min(7.9, zn));
    if (zc !== zn) { p.z = zc * side; p.vz = 0; }
    // jump
    if (!p.grounded) {
      p.vy -= JUMP_G * dt;
      p.y += p.vy * dt;
      if (p.y <= 0) {
        p.y = 0; p.vy = 0; p.grounded = true; p.autoSmash = false;
        p.recover = Math.max(p.recover, 0.08);
        this.emit({ t: 'land', p: p.id });
      }
    }
    // footsteps
    if (p.grounded && p.speedNow > 1.2) {
      p.footT += dt * p.speedNow;
      if (p.footT > 1.6) { p.footT = 0; this.emit({ t: 'step', p: p.id, v: p.speedNow }); }
    }
    // face the shuttle slightly
    const sh = this.shuttle;
    const target = sh.visible && (sh.active || sh.held) ? Math.max(-0.7, Math.min(0.7, ((sh.x - p.x) * side) * 0.14)) : 0;
    p.aimLook += (target - p.aimLook) * Math.min(1, dt * 6);
  }

  private separate() {
    const ps = this.players;
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i], b = ps[j];
        if (a.team !== b.team) continue;
        const dx = b.x - a.x, dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.9) {
          const nx = d > 1e-4 ? dx / d : 1, nz = d > 1e-4 ? dz / d : 0;
          const push = (0.9 - d) * 0.5;
          // locked server stays put
          const aL = this.phase === 'serve' && this.isServer(a), bL = this.phase === 'serve' && this.isServer(b);
          if (!aL) { a.x -= nx * push * (bL ? 2 : 1); a.z -= nz * push * (bL ? 2 : 1); }
          if (!bL) { b.x += nx * push * (aL ? 2 : 1); b.z += nz * push * (aL ? 2 : 1); }
        }
      }
    }
  }

  private updateTiming(p: SimPlayer) {
    const t = p.timing;
    if (p.human < 0) return;
    const sh = this.shuttle;
    if (!this.heading(p) || sh.z * p.side < -2.5 || this.phase === 'point') { t.show = false; return; }
    const pre: Ball = { ...sh };
    stepBall(pre, CONTACT_DELAY, sh.drag);
    const ev = evaluateContact(this.body(p), pre, this.rules.cfg.arcade);
    const dist = Math.hypot(sh.x - (p.x + p.side * 0.2), sh.y - (1.4 + p.y), sh.z - p.z);
    t.show = dist < 6;
    t.inReach = ev.inReach;
    t.score = ev.score;
    t.prox = Math.max(0, Math.min(1, 1 - (dist - 1.6) / 4.4));
    t.grade = ev.inReach ? gradeOf(ev.score) : 'poor';
  }

  // -------- shuttle --------
  private stepShuttle(dt: number) {
    const sh = this.shuttle;
    if (!sh.active) return;
    const px = sh.x, py = sh.y, pz = sh.z;
    stepBall(sh, dt, sh.drag);
    sh.speed = Math.hypot(sh.vx, sh.vy, sh.vz);
    if ((pz < 0 && sh.z >= 0) || (pz > 0 && sh.z <= 0)) {
      const f = (0 - pz) / (sh.z - pz);
      const y = py + (sh.y - py) * f, x = px + (sh.x - px) * f;
      if (Math.abs(x) < NET_HALF && y < NET_H + 0.03 && y > 0) {
        sh.netTouched = true;
        sh.x = x; sh.y = y; sh.z = pz > 0 ? 0.06 : -0.06;
        sh.vz = -sh.vz * 0.12; sh.vx *= 0.3; sh.vy = Math.min(sh.vy * 0.25, 1.5);
        this.emit({ t: 'net', x, y, z: 0, speed: sh.speed });
      }
    }
    if (sh.y <= 0 && sh.active) {
      const f = py / (py - sh.y || 1);
      sh.x = px + (sh.x - px) * f; sh.z = pz + (sh.z - pz) * f; sh.y = 0;
      sh.active = false; sh.landedT = 0;
      this.emit({ t: 'land', x: sh.x, z: sh.z, speed: sh.speed, shuttle: true });
      this.onLanding(sh.x, sh.z);
    }
  }

  private onLanding(x: number, z: number) {
    if (this.isDrill) { this.drillLanding(x, z); return; }
    if (this.phase !== 'rally') return;
    const sh = this.shuttle;
    const res = judgeLanding(this.rules, {
      x, z, lastHitTeam: Math.max(0, sh.lastHitTeam) as 0 | 1, isServe: sh.isServe, netTouched: sh.netTouched, targetXSign: this.serve.targetXSign,
    });
    this.emit({ t: 'landing', x, z, inBounds: res.reason === 'in', reason: res.reason });
    if (res.winner === -1) {
      this.emit({ t: 'let' });
      this.pointInfo = { winner: -1, reason: 'let', label: 'LET — replay', result: 'point' };
      this.phase = 'point'; this.phaseT = 0;
      return;
    }
    this.scorePoint(res.winner as 0 | 1, res.reason);
  }

  private scorePoint(winner: 0 | 1, reason: FaultReason) {
    const sh = this.shuttle;
    const loser = (1 - winner) as 0 | 1;
    // shot accuracy: the final shot was a fault if the hitter lost the point
    if (sh.lastHitTeam === loser) this.stats.shotsIn[loser] = Math.max(0, this.stats.shotsIn[loser] - 1);
    if (sh.lastHitTeam === winner && (sh.shot === 'smash' || sh.shot === 'jumpSmash') && reason === 'in') this.stats.smashPoints[winner]++;
    this.stats.rallies++;
    this.stats.longest = Math.max(this.stats.longest, this.stats.rallyHits);
    const rallyLen = this.stats.rallyHits;
    this.stats.rallyHits = 0;
    const smashWin = sh.lastHitTeam === winner && (sh.shot === 'smash' || sh.shot === 'jumpSmash') && reason === 'in';
    const result = awardPoint(this.rules, winner);
    const labels: Record<FaultReason, string> = {
      in: smashWin ? 'SMASH WINNER!' : 'POINT', out: 'OUT!', net: 'NET FAULT', own: 'FAULT — own side', service: 'SERVICE FAULT', let: 'LET',
    };
    this.pointInfo = { winner, reason, label: labels[reason], result };
    for (const p of this.players) {
      p.mood = p.team === winner ? 'win' : 'lose';
      if (p.team === winner) p.meter = Math.min(100, p.meter + 8);
      p.autoSmash = false;
    }
    this.emit({ t: 'point', winner, reason, label: labels[reason], result, rallyLen, smash: smashWin, scores: [this.rules.teams[0].score, this.rules.teams[1].score], games: [this.rules.teams[0].games, this.rules.teams[1].games] });
    this.phase = 'point'; this.phaseT = 0;
    if (result === 'match') {
      this.winner = winner;
      this.emit({ t: 'matchPoint' });
    }
  }

  private afterPoint() {
    const info = this.pointInfo!;
    if (this.isDrill) return;
    if (info.winner === -1) { this.phase = 'reset'; this.phaseT = 0; this.resetT = 0; this.serve = serveInfo(this.rules); return; }
    if (info.result === 'match') {
      this.phase = 'over'; this.phaseT = 0;
      this.emit({ t: 'matchEnd', winner: info.winner });
      return;
    }
    if (info.result === 'game') {
      this.phase = 'gameBreak'; this.phaseT = 0;
      this.emit({ t: 'gameEnd', winner: info.winner, games: [this.rules.teams[0].games, this.rules.teams[1].games] });
      return;
    }
    this.serve = serveInfo(this.rules);
    this.phase = 'reset'; this.phaseT = 0; this.resetT = 0;
  }

  forfeit() { this.phase = 'over'; }

  // -------- drills (practice & challenges) --------
  private startDrill() {
    const c = this.cfg.drill!;
    this.rules = makeRules({ ...this.cfg.rules, doubles: false }, 0);
    this.phase = 'drill';
    this.drill = {
      cfg: c, score: 0, streak: 0, best: 0, returns: 0, perfects: 0, smashPerfects: 0, zoneHits: 0, misses: 0,
      timeLeft: c.timeLimit, feedT: 1.5, targets: [], cone: null, cones: 0, done: false, success: false,
      serveX: 1.5, msg: '', started: false, smashPoints: 0,
    };
    const p = this.players[0];
    p.x = 0; p.z = 4.2; p.side = 1;
    this.serve = { ...serveInfo(this.rules), targetXSign: -1 };
    if (c.kind === 'target' || c.kind === 'blitz' || c.kind === 'accuracy') this.makeTargets();
    if (c.kind === 'serve') { this.makeTargets(true); this.placeHeld(); }
    if (c.kind === 'movement') { this.shuttle.visible = false; this.newCone(); }
  }
  private makeTargets(serveZones = false) {
    const D = this.drill!;
    D.targets = [];
    const n = serveZones ? 1 : 3;
    for (let i = 0; i < n; i++) this.addTarget(serveZones);
  }
  private addTarget(serveZone = false) {
    const D = this.drill!;
    for (let tries = 0; tries < 20; tries++) {
      const x = serveZone ? -Math.sign(D.serveX) * (0.8 + this.rnd() * 1.4) : (this.rnd() * 2 - 1) * 2.3;
      const z = serveZone ? -(2.6 + this.rnd() * 3) : -(1.5 + this.rnd() * 4.8);
      if (D.targets.every((t) => Math.hypot(t.x - x, t.z - z) > 2.1)) { D.targets.push({ x, z, r: 0.95 }); return; }
    }
    D.targets.push({ x: (this.rnd() * 2 - 1) * 2.3, z: -(1.5 + this.rnd() * 4.8), r: 0.95 });
  }
  private newCone() {
    const D = this.drill!;
    let x = (this.rnd() * 2 - 1) * 3.0, z = 0.9 + this.rnd() * 6.4;
    const p = this.players[0];
    for (let i = 0; i < 10 && Math.hypot(x - p.x, z - p.z) < 3; i++) { x = (this.rnd() * 2 - 1) * 3.0; z = 0.9 + this.rnd() * 6.4; }
    D.cone = { x, z };
  }
  private drillTick(dt: number) {
    const D = this.drill!;
    if (D.done) return;
    const sh = this.shuttle;
    const p = this.players[0];
    if (D.started && D.cfg.timeLimit > 0) {
      D.timeLeft -= dt;
      if (D.timeLeft <= 0) { D.timeLeft = 0; this.finishDrill(); return; }
    }
    if (D.cfg.kind === 'movement') {
      D.started = true;
      if (D.cone && Math.hypot(D.cone.x - p.x, D.cone.z - p.z) < 0.6) {
        D.cones++;
        D.score += 25 + (p.sprinting ? 10 : 0);
        D.msg = 'GOT IT!';
        this.emit({ t: 'cone', x: D.cone.x, z: D.cone.z });
        this.newCone();
      }
      return;
    }
    if (D.cfg.kind === 'serve') {
      if (!sh.active && !sh.held && sh.landedT > 1.1) {
        D.serveX = -D.serveX;
        this.serve = { ...this.serve, targetXSign: -Math.sign(D.serveX) };
        D.targets = []; this.addTarget(true);
        this.placeHeld();
      }
      return;
    }
    if (!sh.active && !sh.held) {
      D.feedT -= dt;
      if (D.feedT <= 0) this.feed();
    }
  }
  private feed() {
    const D = this.drill!;
    const sh = this.shuttle;
    const k = D.cfg.kind;
    const fx = (this.rnd() * 2 - 1) * 1.5;
    const start = { x: fx, y: 2.3, z: -7.2 };
    let tx = (this.rnd() * 2 - 1) * 2.4, depth: number, elev: number, drag = 1;
    const r = this.rnd();
    if (k === 'smash' || k === 'perfectSmash') { elev = 62; depth = 3.6 + this.rnd() * 1.2; tx *= 0.6; }
    else if (k === 'net') { elev = 34; depth = 1.2 + this.rnd() * 0.5; drag = 1.7; }
    else if (k === 'perfect') { elev = 46; depth = 3.8 + this.rnd(); tx *= 0.5; }
    else if (r < 0.4) { elev = 50; depth = 5.2 + this.rnd() * 0.9; }
    else if (r < 0.7) { elev = 30; depth = 2.2 + this.rnd(); drag = 1.7; }
    else { elev = 38; depth = 4 + this.rnd() * 1.5; }
    const L = solveBySpeed(start, tx, depth, elev, drag, 60);
    sh.x = start.x; sh.y = start.y; sh.z = start.z; sh.vx = L.vx; sh.vy = L.vy; sh.vz = L.vz;
    sh.drag = drag; sh.active = true; sh.held = false; sh.visible = true; sh.lastHitTeam = 1; sh.lastHitPlayer = -1;
    sh.hits++; sh.netTouched = false; sh.isServe = false; sh.shot = null; sh.special = null; sh.landTx = tx; sh.landTz = depth;
    sh.speed = L.speed;
    D.started = true;
    D.msg = '';
    this.emit({ t: 'feed', x: start.x, y: start.y, z: start.z, speed: L.speed });
  }
  private drillHit(p: SimPlayer, shot: ShotId, grade: Grade, special: Special | null) {
    const D = this.drill!;
    D.started = true;
    if (grade === 'perfect') D.perfects++;
    if (special === 'perfectSmash' || special === 'superSmash') D.smashPerfects++;
    void p; void shot;
  }
  private drillLanding(x: number, z: number) {
    const D = this.drill!;
    const sh = this.shuttle;
    const kind = D.cfg.kind;
    const mult = 1 + Math.min(D.streak, 10) * 0.1;
    const miss = (msg: string) => {
      D.misses++; D.streak = 0; D.msg = msg;
      this.emit({ t: 'drillMiss', msg });
      if (kind === 'streak') this.finishDrill();
    };
    if (kind === 'serve') {
      const res = judgeLanding(this.rules, { x, z, lastHitTeam: 0, isServe: true, netTouched: sh.netTouched, targetXSign: -Math.sign(D.serveX) });
      this.emit({ t: 'landing', x, z, inBounds: res.reason === 'in', reason: res.reason });
      if (res.reason === 'in') {
        D.returns++; D.streak++; D.best = Math.max(D.best, D.streak);
        let pts = 20;
        const tg = D.targets[0];
        if (tg && Math.hypot(tg.x - x, tg.z - z) < tg.r) { pts += 50; D.zoneHits++; D.msg = 'BULLSEYE!'; this.emit({ t: 'zone', x: tg.x, z: tg.z }); }
        else D.msg = 'GOOD SERVE';
        D.score += Math.round(pts * mult);
      } else miss(res.reason === 'service' ? 'SERVICE FAULT' : 'FAULT');
      return;
    }
    if (z > 0) { miss(sh.lastHitTeam === 0 && sh.netTouched ? 'NET!' : 'MISSED'); D.feedT = 1.2; return; }
    if (sh.lastHitTeam !== 0) { D.feedT = 0.8; return; }
    const inB = Math.abs(x) <= COURT.halfWidthD + 0.03 && Math.abs(z) <= COURT.halfLen + 0.03;
    this.emit({ t: 'landing', x, z, inBounds: inB, reason: inB ? 'in' : 'out' });
    D.feedT = 1.1;
    if (!inB) { miss('OUT!'); return; }
    D.returns++; D.streak++; D.best = Math.max(D.best, D.streak);
    let pts = 10;
    if (sh.grade === 'good') pts += 5;
    if (sh.grade === 'perfect') pts += 20;
    if ((kind === 'smash' || kind === 'perfectSmash') && (sh.shot === 'smash' || sh.shot === 'jumpSmash')) { pts += 30; D.smashPoints++; }
    if (kind === 'net' && Math.abs(z) < 2.0 && sh.shot === 'netShot') pts += 30;
    let zone = false;
    for (let i = 0; i < D.targets.length; i++) {
      const t = D.targets[i];
      if (Math.hypot(t.x - x, t.z - z) < t.r) {
        zone = true; pts += 50; D.zoneHits++;
        D.targets.splice(i, 1); this.addTarget();
        this.emit({ t: 'zone', x: t.x, z: t.z });
        break;
      }
    }
    D.score += Math.round(pts * mult);
    D.msg = zone ? 'TARGET HIT!' : sh.grade === 'perfect' ? 'PERFECT RETURN' : 'GOOD RETURN';
    if (kind === 'perfectSmash' && D.smashPerfects >= D.cfg.goal) this.finishDrill();
  }
  finishDrill() {
    const D = this.drill!;
    if (D.done) return;
    D.done = true;
    const k = D.cfg.kind;
    const acc = D.returns + D.misses > 0 ? D.zoneHits / Math.max(1, D.returns) : 0;
    if (k === 'blitz') D.success = D.score >= D.cfg.goal;
    else if (k === 'streak') D.success = D.best >= D.cfg.goal;
    else if (k === 'perfectSmash') D.success = D.smashPerfects >= D.cfg.goal;
    else if (k === 'accuracy') D.success = D.returns >= 12 && acc >= D.cfg.goal / 100;
    else D.success = true;
    this.phase = 'over';
    this.emit({ t: 'drillEnd', success: D.success });
  }

  // -------- helpers for view / HUD --------
  predictedLanding() {
    const sh = this.shuttle;
    if (!sh.active) return null;
    const f = flight(sh, sh.drag);
    return { x: f.landX, z: f.landZ };
  }
}
