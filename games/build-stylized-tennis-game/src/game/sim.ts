// Headless tennis simulation: movement, ball physics, shots, perfect-hit timing, rules, drills.
import { BALL_R, COURT, G, SURFACES, courtById, type DrillType, type MatchConfig, type PlayerSpec, type Rules, type Surface } from './constants';
import { bounceFloor, clamp, integrate, netTopAt, planShot, predict, type BallState, type Sample } from './physics';
import { callOut, newScore, pointLabels, pointWon, serveSide, serverSlot, type ScoreState } from './scoring';
import { updateAI, type AIMemory } from './ai';

export const sxOf = (team: number) => (team === 0 ? 1 : -1); // world x of a team's screen-right
export const dirZ = (team: number) => (team === 0 ? -1 : 1); // world z direction toward the opponent
export const sideZ = (team: number) => (team === 0 ? 1 : -1); // which half of the court the team owns

export type Mode = 'fh' | 'bh' | 'volley' | 'smash' | 'serve';
export interface InputState {
  mx: number;
  mz: number;
  sprint: boolean;
  shot: number;
  special: boolean;
}
export interface Swing {
  t: number;
  key: number;
  special: boolean;
  resolved: boolean;
  kind: Mode;
  dur: number;
}
export interface Timing {
  active: boolean;
  ring: number; // 0 = press now, 1 = far
  grade: number; // predicted grade 0..3
}

export class Player {
  x = 0;
  z = 0;
  vx = 0;
  vz = 0;
  y = 0;
  vy = 0;
  yaw = 0;
  input: InputState = { mx: 0, mz: 0, sprint: false, shot: 0, special: false };
  swing: Swing | null = null;
  cool = 0;
  stamina = 1;
  exhausted = false;
  sprinting = false;
  goto: { x: number; z: number } | null = null;
  pose: 'play' | 'win' | 'lose' = 'play';
  timing: Timing = { active: false, ring: 1, grade: 0 };
  turn = 0; // direction-change impulse for animation
  perfects = 0;
  hits = 0;
  mem: AIMemory | null = null;
  speedMul = 1;
  tossing = false;
  lastHitT = -9;
  constructor(
    public id: number,
    public team: 0 | 1,
    public slot: number,
    public spec: PlayerSpec,
  ) {}
  get human() {
    return this.spec.human >= 0;
  }
  get speed() {
    return Math.hypot(this.vx, this.vz);
  }
}

export interface Ball extends BallState {
  held: boolean;
  lastTeam: -1 | 0 | 1;
  lastHitter: Player | null;
  bounces: number;
  isServe: boolean;
  serveBounced: boolean;
  letFlag: boolean;
  netHit: boolean;
  sinceHit: number;
  lastGrade: number;
  special: string | null;
  speed: number;
  stuck: number;
  hitCount: number;
}

export interface SimEvent {
  type: 'hit' | 'whiff' | 'bounce' | 'net' | 'toss' | 'point' | 'fault' | 'let' | 'game' | 'set' | 'matchover' | 'call' | 'super' | 'drill' | 'tossmiss' | 'serveReady';
  p?: Player;
  x?: number;
  y?: number;
  z?: number;
  grade?: number;
  label?: string;
  special?: string | null;
  speed?: number;
  spin?: number;
  mode?: Mode;
  team?: number;
  text?: string;
  reason?: string;
  vx?: number;
  vy?: number;
  vz?: number;
  inBounds?: boolean;
  surface?: Surface;
  impact?: number;
  big?: boolean;
}

export interface TeamStats {
  points: number;
  aces: number;
  winners: number;
  ue: number;
  df: number;
  perfects: number;
  hits: number;
  games: number;
}
export interface Drill {
  type: DrillType;
  challenge: boolean;
  score: number;
  hits: number;
  perfects: number;
  streak: number;
  best: number;
  misses: number;
  feeds: number;
  maxFeeds: number;
  timeLeft: number;
  timed: boolean;
  targets: { x: number; z: number; r: number }[];
  feedTimer: number;
  live: boolean;
  accSum: number;
  accN: number;
  msg: string;
  serveIdx: number;
  total: number;
}

export type Phase = 'serve' | 'toss' | 'rally' | 'point' | 'over';
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 1.6;

export class Sim {
  cfg: MatchConfig;
  rules: Rules;
  doubles: boolean;
  surf: Surface;
  players: Player[] = [];
  ball: Ball;
  score: ScoreState;
  phase: Phase = 'serve';
  timer = 0;
  time = 0;
  server!: Player;
  serveNum = 1;
  serveSideIdx: 0 | 1 = 0;
  events: SimEvent[] = [];
  stats: [TeamStats, TeamStats];
  rallyHits = 0;
  rallies: number[] = [];
  maxRally = 0;
  meter: [number, number] = [0, 0];
  pred: Sample[] = [];
  next: 'serve' | 'point' | 'over' = 'serve';
  matchOverT = 0;
  overSent = false;
  drill: Drill | null = null;
  lastPointText = '';
  lastPointTeam = -1;
  tossT = 0;
  elapsedReal = 0;
  scoreSum = 0;
  playerWinner: -1 | 0 | 1 = -1;
  pointLog: { team: number; reason: string }[] = [];

  constructor(cfg: MatchConfig) {
    this.cfg = cfg;
    this.rules = cfg.rules;
    this.doubles = cfg.doubles;
    this.surf = SURFACES[courtById(cfg.courtId).surface];
    this.score = newScore(0);
    this.stats = [0, 1].map(() => ({ points: 0, aces: 0, winners: 0, ue: 0, df: 0, perfects: 0, hits: 0, games: 0 })) as [TeamStats, TeamStats];
    let id = 0;
    for (let t = 0; t < 2; t++) {
      cfg.teams[t].forEach((spec, i) => {
        this.players.push(new Player(id++, t as 0 | 1, i, spec));
      });
    }
    this.ball = { x: 0, y: 1, z: 0, vx: 0, vy: 0, vz: 0, spin: 0, held: true, lastTeam: -1, lastHitter: null, bounces: 0, isServe: false, serveBounced: false, letFlag: false, netHit: false, sinceHit: 0, lastGrade: 1, special: null, speed: 0, stuck: 0, hitCount: 0 };
    if (cfg.drill) this.initDrill(cfg.drill, cfg.mode === 'challenge', cfg.challengeSecs ?? 60);
    this.resetServe(true);
  }

  teamPlayers(t: number) {
    return this.players.filter((p) => p.team === t);
  }
  humans() {
    return this.players.filter((p) => p.human);
  }
  get W() {
    return this.doubles ? COURT.halfWD : COURT.halfWS;
  }
  get isDrill() {
    return this.drill !== null;
  }

  // ---------------------------------------------------------------- setup / flow
  private homePos(p: Player): { x: number; z: number } {
    if (this.drill) return { x: this.drill.type === 'serve' ? sxOf(0) * (this.serveSideIdx === 0 ? 2.2 : -2.2) : 0, z: COURT.halfLen + (this.drill.type === 'serve' ? 0.9 : 0.2) };
    const s = this.score;
    const st = s.server;
    const rt = 1 - st;
    const ss = this.serveSideIdx;
    const box = ss === 0 ? -sxOf(st) : sxOf(st); // world x sign of the target service box
    if (p.team === st) {
      if (p === this.server) return { x: sxOf(st) * (ss === 0 ? 2.2 : -2.2), z: sideZ(st) * (COURT.halfLen + 0.9) };
      return { x: sxOf(st) * (ss === 0 ? -2.4 : 2.4), z: sideZ(st) * 3.4 };
    }
    const recvSlot = this.doubles ? ss : 0;
    if (p.slot === recvSlot || !this.doubles) return { x: box * 2.5, z: sideZ(rt) * (COURT.halfLen + 0.5) };
    return { x: -box * 2.4, z: sideZ(rt) * 3.4 };
  }

  resetServe(initial = false) {
    const s = this.score;
    this.phase = 'serve';
    this.timer = 0;
    this.serveSideIdx = this.drill ? ((this.drill.serveIdx % 2) as 0 | 1) : serveSide(s);
    const tp = this.teamPlayers(this.drill ? 0 : s.server);
    this.server = tp[this.doubles && !this.drill ? serverSlot(s) % tp.length : 0] ?? tp[0];
    for (const p of this.players) {
      const h = this.homePos(p);
      if (initial) {
        p.x = h.x;
        p.z = h.z;
        p.vx = p.vz = 0;
      } else p.goto = h;
      p.swing = null;
      p.tossing = false;
      p.pose = 'play';
      p.input.shot = 0;
      p.input.special = false;
    }
    const b = this.ball;
    b.held = true;
    b.vx = b.vy = b.vz = 0;
    b.spin = 0;
    b.lastTeam = -1;
    b.lastHitter = null;
    b.isServe = false;
    b.serveBounced = false;
    b.letFlag = false;
    b.netHit = false;
    b.bounces = 0;
    b.special = null;
    this.rallyHits = 0;
    this.holdBall();
    this.events.push({ type: 'serveReady' });
  }
  private holdBall() {
    const s = this.server;
    const b = this.ball;
    b.x = s.x + sxOf(s.team) * 0.45;
    b.z = s.z + dirZ(s.team) * 0.35;
    b.y = 1.05;
  }

  private nextPoint() {
    this.serveNum = 1;
    this.resetServe(false);
  }

  // ---------------------------------------------------------------- scoring
  private awardPoint(team: 0 | 1, reason: string, flags: { ace?: boolean; winner?: boolean; ue?: boolean; df?: boolean } = {}) {
    if (this.phase === 'point' || this.phase === 'over') return;
    const st = this.stats[team];
    st.points++;
    if (flags.ace) this.stats[team].aces++;
    if (flags.winner) this.stats[team].winners++;
    if (flags.ue) this.stats[1 - team].ue++;
    if (flags.df) this.stats[1 - team].df++;
    this.maxRally = Math.max(this.maxRally, this.rallyHits);
    this.rallies.push(this.rallyHits);
    const res = pointWon(this.score, this.rules, team);
    this.pointLog.push({ team, reason });
    this.lastPointTeam = team;
    this.phase = 'point';
    this.timer = res.game ? 3.4 : 2.5;
    this.next = 'point';
    if (res.game) this.stats[team].games++;
    this.meter[1 - team] = Math.max(0, this.meter[1 - team] - 0.25);
    let text = flags.ace ? 'ACE!' : flags.winner ? 'WINNER' : reason === 'net' ? 'NET' : reason === 'out' ? 'OUT' : flags.df ? 'DOUBLE FAULT' : reason === 'short' ? 'SHORT' : reason.toUpperCase();
    this.lastPointText = text;
    this.events.push({ type: 'point', team, reason, text, big: res.game });
    if (res.set) this.events.push({ type: 'set', team });
    else if (res.game) this.events.push({ type: 'game', team });
    if (res.match) {
      this.next = 'over';
      this.playerWinner = team;
      this.timer = 1.8;
    } else {
      this.events.push({ type: 'call', text: res.game ? (res.set ? 'Set' : 'Game') + ` ${team === 0 ? 'player one' : 'player two'}` : callOut(this.score, this.rules) });
    }
    text = '';
  }

  private fault(reason: string) {
    if (this.phase === 'point') return;
    const st = this.score.server;
    if (this.serveNum === 1) {
      this.serveNum = 2;
      this.phase = 'point';
      this.next = 'serve';
      this.timer = 1.3;
      this.events.push({ type: 'fault', text: 'FAULT', reason, team: st });
      this.events.push({ type: 'call', text: 'Fault' });
      this.lastPointText = 'FAULT';
    } else {
      this.events.push({ type: 'fault', text: 'DOUBLE FAULT', reason, team: st, big: true });
      this.awardPoint((1 - st) as 0 | 1, 'double fault', { df: true });
      this.stats[st].ue++;
    }
  }
  private serveLet() {
    this.phase = 'point';
    this.next = 'serve';
    this.timer = 1.2;
    this.lastPointText = 'LET';
    this.events.push({ type: 'let', text: 'LET' });
    this.events.push({ type: 'call', text: 'Let' });
  }

  // ---------------------------------------------------------------- main update
  update(dtIn: number) {
    let rem = Math.min(dtIn, 0.05);
    while (rem > 1e-6) {
      const dt = Math.min(rem, 1 / 90);
      rem -= dt;
      this.step(dt);
    }
  }

  private step(dt: number) {
    this.elapsedReal += dt;
    if (this.phase !== 'over') this.time += dt;
    const b = this.ball;
    // prediction for AI / timing ring (cheap, refreshed ~30Hz)
    this.predAcc = (this.predAcc ?? 0) + dt;
    if (this.predAcc >= 1 / 30) {
      this.predAcc = 0;
      this.pred = !b.held && (this.phase === 'rally' || this.phase === 'toss') ? predict(b, this.surf, 1.8, 1 / 30) : [];
    }
    for (const p of this.players) if (!p.human) updateAI(this, p, dt);
    for (const p of this.players) this.updatePlayer(p, dt);
    this.separate();
    this.updateBall(dt);
    for (const p of this.players) this.updateTiming(p);
    if (this.drill) this.updateDrill(dt);
    // phase timers
    if (this.phase === 'point') {
      this.timer -= dt;
      if (this.timer <= 0) {
        if (this.next === 'over') {
          this.phase = 'over';
          this.matchOverT = 0;
          for (const p of this.players) p.pose = p.team === this.playerWinner ? 'win' : 'lose';
        } else if (this.next === 'serve') this.resetServe(false);
        else this.nextPoint();
      }
    } else if (this.phase === 'over') {
      this.matchOverT += dt;
      if (!this.overSent && this.matchOverT > (this.drill ? 0.2 : 2.6)) {
        this.overSent = true;
        this.events.push({ type: 'matchover', team: this.playerWinner });
      }
    } else if (this.phase === 'toss') {
      this.tossT += dt;
      if (b.y < 1.0 && b.vy < 0 && !this.players.some((p) => p.swing && p.swing.kind === 'serve')) {
        this.events.push({ type: 'tossmiss' });
        this.resetServe(false);
        for (const p of this.players) p.goto = null;
      }
    } else if (this.phase === 'rally') {
      // watchdog for dead rolling balls
      const onGround = b.y <= BALL_R + 0.02;
      if (onGround && Math.hypot(b.vx, b.vz) < 1.2) b.stuck += dt;
      else b.stuck = 0;
      if (b.stuck > 0.6) this.forceDead();
      if (Math.abs(b.x) > 40 || Math.abs(b.z) > 40) this.forceDead();
    }
  }
  private predAcc?: number;

  private forceDead() {
    const b = this.ball;
    b.stuck = 0;
    if (this.drill) {
      if (this.drill.live) this.drillMiss('dead');
      return;
    }
    if (b.lastTeam < 0) return;
    const sideBall = b.z > 0 ? 0 : 1;
    if (sideBall === b.lastTeam) this.awardPoint((1 - b.lastTeam) as 0 | 1, 'short', { ue: true });
    else this.awardPoint(b.lastTeam as 0 | 1, 'winner', { winner: true });
  }

  // ---------------------------------------------------------------- players
  private updatePlayer(p: Player, dt: number) {
    const inp = p.input;
    const shot = inp.shot;
    const special = inp.special;
    inp.shot = 0;
    inp.special = false;
    p.cool = Math.max(0, p.cool - dt);
    p.turn = Math.max(0, p.turn - dt * 3);
    const live = this.phase === 'rally' || this.phase === 'serve' || this.phase === 'toss';
    if ((shot || special) && live && !p.swing && p.cool <= 0 && !p.goto) this.tryAct(p, shot || 1, special);

    // movement intent
    let ix = inp.mx;
    let iz = inp.mz;
    let sprint = inp.sprint;
    let auto = false;
    const sx = sxOf(p.team);
    const dz = dirZ(p.team);
    if (p.goto) {
      const dx = p.goto.x - p.x;
      const dzz = p.goto.z - p.z;
      const dist = Math.hypot(dx, dzz);
      if (dist < 0.25) p.goto = null;
      else {
        ix = (dx / dist) * sx;
        iz = (dzz / dist) * dz;
        sprint = dist > 6;
        auto = true;
      }
    }
    if ((this.phase === 'over' || this.phase === 'point') && !p.goto) {
      ix = 0;
      iz = 0;
      sprint = false;
    }
    if (this.phase === 'toss' && p === this.server) {
      ix *= 0.2;
      iz = 0;
      sprint = false;
    }
    const mag = Math.min(1, Math.hypot(ix, iz));
    let wx = ix * sx;
    let wz = iz * dz;
    const wl = Math.hypot(wx, wz);
    if (wl > 0.001) {
      wx /= wl;
      wz /= wl;
    }
    // sprint & stamina
    const wantSprint = sprint && mag > 0.3 && !p.exhausted && p.stamina > 0;
    p.sprinting = wantSprint;
    if (wantSprint) p.stamina = Math.max(0, p.stamina - 0.26 * dt);
    else p.stamina = Math.min(1, p.stamina + (mag < 0.1 ? 0.3 : 0.16) * dt);
    if (p.stamina <= 0) p.exhausted = true;
    if (p.exhausted && p.stamina > 0.3) p.exhausted = false;
    const grip = this.surf.grip;
    let top = mag < 0.01 ? 0 : mag < 0.4 ? 3.4 : wantSprint ? 9.4 : 6.5;
    top *= p.speedMul;
    top *= 0.93 + 0.07 * grip;
    if (p.swing && p.swing.t < 0.32) top *= 0.62;
    if (p.y > 0.05) top *= 0.9;
    if (auto) top = Math.max(top, 5);
    const tvx = wx * top;
    const tvz = wz * top;
    const dot = tvx * p.vx + tvz * p.vz;
    let acc = top === 0 ? 34 : dot < -1 ? 64 : 40;
    acc *= grip;
    if (dot < -8) p.turn = 1;
    const dvx = tvx - p.vx;
    const dvz = tvz - p.vz;
    const dl = Math.hypot(dvx, dvz);
    const maxd = acc * dt;
    if (dl <= maxd) {
      p.vx = tvx;
      p.vz = tvz;
    } else {
      p.vx += (dvx / dl) * maxd;
      p.vz += (dvz / dl) * maxd;
    }
    p.x += p.vx * dt;
    p.z += p.vz * dt;
    // jump physics
    if (p.y > 0 || p.vy > 0) {
      p.vy -= G * dt;
      p.y += p.vy * dt;
      if (p.y <= 0) {
        p.y = 0;
        p.vy = 0;
      }
    }
    // court limits: stay on own half, inside the run-off area
    this.clampPlayer(p);
    // facing
    const targetYaw = dz > 0 ? 0 : Math.PI;
    let face = targetYaw;
    if (p.speed > 3) {
      const mv = Math.atan2(p.vx, p.vz);
      let df = mv - targetYaw;
      while (df > Math.PI) df -= Math.PI * 2;
      while (df < -Math.PI) df += Math.PI * 2;
      face = targetYaw + clamp(df, -0.9, 0.9) * (wantSprint ? 0.75 : 0.45);
    }
    let dy = face - p.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    p.yaw += dy * Math.min(1, dt * 10);
    // swing progress
    if (p.swing) {
      p.swing.t += dt;
      if (!p.swing.resolved && p.swing.t >= 0.11) {
        p.swing.resolved = true;
        this.resolveSwing(p);
      }
      if (p.swing.t >= p.swing.dur) p.swing = null;
    }
  }

  private clampPlayer(p: Player) {
    const zmin = p.team === 0 ? 1.1 : -14.2;
    const zmax = p.team === 0 ? 14.2 : -1.1;
    p.z = clamp(p.z, zmin, zmax);
    p.x = clamp(p.x, -7.6, 7.6);
    if (this.phase === 'toss' && p === this.server) {
      p.z = sideZ(p.team) * Math.max(Math.abs(p.z), COURT.halfLen + 0.2);
    }
    if (this.phase === 'serve' && p === this.server && !p.goto) {
      // server must stay behind the baseline on the correct half
      p.z = sideZ(p.team) * clamp(Math.abs(p.z), COURT.halfLen + 0.2, 14);
      const half = sxOf(p.team) * (this.serveSideIdx === 0 ? 1 : -1);
      p.x = half > 0 ? clamp(p.x, 0.4, this.W) : clamp(p.x, -this.W, -0.4);
    }
  }

  private separate() {
    if (!this.doubles) return;
    for (let t = 0; t < 2; t++) {
      const tp = this.teamPlayers(t);
      if (tp.length < 2) continue;
      const [a, b] = tp;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const d = Math.hypot(dx, dz);
      const min = 1.5;
      if (d < min) {
        const nx = d > 0.01 ? dx / d : 1;
        const nz = d > 0.01 ? dz / d : 0;
        const push = (min - d) * 0.5;
        a.x -= nx * push;
        a.z -= nz * push;
        b.x += nx * push;
        b.z += nz * push;
        // remove approach velocity so teammates slide around each other
        const va = a.vx * nx + a.vz * nz;
        const vb = b.vx * nx + b.vz * nz;
        if (va > 0) {
          a.vx -= nx * va * 0.6;
          a.vz -= nz * va * 0.6;
        }
        if (vb < 0) {
          b.vx -= nx * vb * 0.6;
          b.vz -= nz * vb * 0.6;
        }
        this.clampPlayer(a);
        this.clampPlayer(b);
      }
    }
  }

  // ---------------------------------------------------------------- contact / shots
  contact(p: Player, bx: number, by: number, bz: number, bounces: number) {
    const sx = sxOf(p.team);
    const dz = dirZ(p.team);
    const lateral = (bx - p.x) * sx;
    const side = lateral >= -0.1 ? 1 : -1;
    const mode: Mode = by > 1.95 ? 'smash' : bounces === 0 ? 'volley' : side > 0 ? 'fh' : 'bh';
    const off = mode === 'smash' ? 0.35 : side > 0 ? 0.85 : 0.75;
    const cx = p.x + sx * side * off;
    const cz = p.z + dz * 0.3;
    const cy = mode === 'smash' ? 2.4 + p.y : mode === 'volley' ? 1.2 : 1.0;
    const d = Math.hypot(bx - cx, bz - cz, (by - cy) * 0.85);
    return { d, mode, cx, cy, cz, side };
  }

  canHit(p: Player) {
    const b = this.ball;
    if (b.held || this.phase !== 'rally') return false;
    if (b.lastTeam === p.team) return false;
    if (b.z * sideZ(p.team) < -0.15) return false;
    if (b.bounces >= 2) return false;
    if (b.isServe && !b.serveBounced) return false;
    if (b.sinceHit < 0.1) return false;
    return true;
  }

  private tryAct(p: Player, key: number, special: boolean) {
    if (this.phase === 'serve') {
      if (p !== this.server) return;
      // toss
      const b = this.ball;
      b.held = false;
      b.vx = p.vx * 0.3;
      b.vz = p.vz * 0.3;
      b.vy = 7.3;
      b.spin = 0;
      this.phase = 'toss';
      p.tossing = true;
      this.tossT = 0;
      this.events.push({ type: 'toss', p });
      return;
    }
    if (this.phase === 'toss') {
      if (p !== this.server) return;
      p.swing = { t: 0, key, special, resolved: false, kind: 'serve', dur: 0.62 };
      p.cool = 0.5;
      return;
    }
    // rally swing: choose animation kind from where the ball is heading
    const b = this.ball;
    const c = this.contact(p, b.x, b.y, b.z, b.bounces);
    let kind: Mode = c.mode;
    const tt = this.pred.find((s) => s.z * sideZ(p.team) > 0.3 && s.y < 3);
    if (tt && kind !== 'smash') {
      const c2 = this.contact(p, tt.x, tt.y, tt.z, b.bounces + tt.bounces);
      if (c2.mode === 'smash') kind = 'smash';
      else kind = c2.mode;
    }
    if (kind === 'smash' && p.y === 0) p.vy = 4.8;
    p.swing = { t: 0, key, special, resolved: false, kind, dur: 0.5 };
    p.cool = 0.4;
  }

  private resolveSwing(p: Player) {
    const sw = p.swing!;
    const b = this.ball;
    if (sw.kind === 'serve') {
      if (this.phase !== 'toss') return;
      this.resolveServe(p, sw);
      return;
    }
    if (!this.canHit(p)) {
      this.events.push({ type: 'whiff', p });
      return;
    }
    const c = this.contact(p, b.x, b.y, b.z, b.bounces);
    if (c.d > 2.45) {
      this.events.push({ type: 'whiff', p });
      return;
    }
    // quality of contact
    let d = c.d;
    const bs = Math.hypot(b.vx, b.vy, b.vz);
    if (bs > 24) d += (bs - 24) * 0.02;
    if (p.sprinting) d += 0.12;
    if (p.speed > 6) d += 0.08;
    if (p.speed < 1.2) d -= 0.1;
    if (sw.special) d *= 1.18;
    if (c.mode === 'smash' && Math.abs(p.z) > 9.5) d += 0.15;
    const grade = d < 0.75 ? 3 : d < 1.2 ? 2 : d < 1.75 ? 1 : 0;
    this.hitBall(p, sw, c.mode, grade, c.side);
  }

  private resolveServe(p: Player, sw: Swing) {
    const b = this.ball;
    if (b.y < 1.7) {
      this.events.push({ type: 'whiff', p });
      return;
    }
    const apex = 1.05 + (7.3 * 7.3) / (2 * G);
    const dv = Math.abs(apex - b.y) + (b.vy < 0 ? 0.1 : 0);
    let grade = dv < 0.3 ? 3 : dv < 0.65 ? 2 : dv < 1.1 ? 1 : 0;
    if (sw.special && grade === 3 && dv > 0.2) grade = 2;
    this.hitBall(p, sw, 'serve', grade, 1);
  }

  private shotParams(p: Player, mode: Mode, key: number, grade: number, special: boolean, side: number) {
    const b = this.ball;
    const sx = sxOf(p.team);
    const opp = this.teamPlayers(1 - p.team);
    const W = this.W;
    const edge = W - 0.55;
    const steer = clamp(p.input.mx, -1, 1) * sx * 2.2;
    const depSteer = p.input.mz > 0.5 ? -0.9 : p.input.mz < -0.5 ? 0.7 : 0;
    const near = Math.abs(p.z) < 7.5;
    const oppNet = opp.some((o) => Math.abs(o.z) < 5.5);
    const bk = side < 0 ? 'Backhand' : 'Forehand';
    let dep = 9.6 + depSteer;
    let lat = -p.x * 0.35 + steer;
    let T = 1.05;
    let spin = 1.1;
    let label = `${bk} Topspin`;
    let sp: string | null = null;
    if (mode === 'serve') {
      const box = this.serveSideIdx === 0 ? -sx : sx; // world sign of the target box
      const sw = (dir: number) => box * clamp(W * 0.5 + dir * sx * W * 0.32, 0.45, W - 0.4);
      const second = this.serveNum === 2;
      if (key === 1) {
        dep = 5.7;
        lat = sw(0) * 1.0 + box * -0.3 * 0;
        lat = box * W * 0.28;
        T = 0.72;
        spin = 0.3;
        label = 'Power Serve';
      } else if (key === 2) {
        dep = 4.6;
        lat = sw(0);
        T = 1.0;
        spin = 2.2;
        label = 'Kick Serve';
      } else if (key === 3) {
        dep = 5.2;
        lat = sw(1);
        T = 0.82;
        spin = -0.9;
        label = 'Slice Serve (R)';
      } else {
        dep = 5.2;
        lat = sw(-1);
        T = 0.82;
        spin = -0.9;
        label = 'Slice Serve (L)';
      }
      if (second) {
        dep -= 0.6;
        T *= 1.12;
      }
      if (grade === 3 && !second) {
        sp = 'PERFECT POWER SERVE';
        T = 0.6;
        spin = 0.5;
        dep = 5.9;
        lat = box * W * (key === 3 || key === 4 ? 0.45 : 0.3);
        label = sp;
      }
      lat += 0;
      return { dep, lat, T, spin, label, sp };
    }
    if (mode === 'smash') {
      T = 0.62;
      spin = 0.3;
      label = 'Smash';
      dep = 8.2;
      if (key === 2) {
        dep = 3.4;
        T = 0.74;
        label = 'Short Smash';
      } else if (key === 3 || key === 4) {
        dep = 5.6;
        lat = (key === 3 ? 1 : -1) * sx * edge;
        label = 'Angle Smash';
      }
      if (Math.abs(p.z) > 9) T += 0.12;
      if (grade === 3) {
        sp = 'PERFECT SMASH';
        T = 0.5;
        label = sp;
      }
    } else if (mode === 'volley') {
      label = 'Volley';
      T = 0.88;
      spin = -0.2;
      dep = 8.6 + depSteer;
      if (key === 2) {
        dep = 2.5;
        T = 1.0;
        spin = -1.5;
        label = 'Drop Volley';
      } else if (key === 3 || key === 4) {
        dep = 4.6;
        lat = (key === 3 ? 1 : -1) * sx * edge;
        T = 0.85;
        spin = -0.6;
        label = 'Angle Volley';
      }
    } else {
      // groundstrokes
      const flat = grade >= 2 && b.y > 1.1;
      if (key === 1) {
        dep = 9.6 + depSteer;
        T = flat ? 0.95 : 1.1;
        spin = flat ? 0.3 : 1.2;
        label = `${bk} ${flat ? 'Flat' : 'Topspin'}`;
      } else if (key === 2) {
        if (oppNet) {
          dep = 10.7;
          T = 1.75;
          spin = 0.4;
          label = 'Lob';
          lat = -p.x * 0.2 + steer;
        } else if (near || b.y < 0.7) {
          dep = 3.1;
          T = 1.25;
          spin = -1.4;
          label = 'Drop Shot';
        } else {
          dep = 5.2;
          T = 1.12;
          spin = -1.4;
          label = `${bk} Slice`;
        }
      } else {
        dep = 4.8;
        lat = (key === 3 ? 1 : -1) * sx * (edge - 0.3);
        T = 1.0;
        spin = -0.8;
        label = key === 3 ? 'Short Angle (R)' : 'Short Angle (L)';
      }
      if (side < 0) T *= 1.05;
    }
    // perfect special moves
    if (grade === 3 && mode !== 'smash') {
      let kind = key === 1 ? 'topspin' : key === 2 ? (oppNet ? 'lob' : 'drop') : 'cross';
      if (special) kind = Math.abs(p.x) > 2.6 ? 'cross' : near && b.y < 1.3 ? 'drop' : 'topspin';
      if (kind === 'topspin') {
        sp = 'PERFECT TOPSPIN';
        dep = 9.9 + depSteer * 0.5;
        T = 0.88;
        spin = 2.4;
        lat = -p.x * 0.4 + steer;
      } else if (kind === 'cross') {
        sp = 'PERFECT CROSS-COURT';
        dep = 7.4;
        const dirSign = key === 3 ? 1 : key === 4 ? -1 : p.x * sx >= 0 ? -1 : 1;
        lat = dirSign * sx * (W - 0.35);
        T = 0.84;
        spin = 1.8;
      } else if (kind === 'drop') {
        sp = 'PERFECT DROP SHOT';
        dep = 2.0;
        T = 1.35;
        spin = -2;
        lat = steer * 0.5;
      } else {
        sp = 'PERFECT LOB';
        T = 1.7;
      }
      label = sp;
    }
    return { dep, lat, T, spin, label, sp };
  }

  private hitBall(p: Player, sw: Swing, mode: Mode, grade: number, side: number) {
    const b = this.ball;
    const dz = dirZ(p.team);
    let key = sw.key;
    let special = sw.special;
    let superShot = false;
    if (special && this.meter[p.team] >= 1 && mode !== 'serve' && grade >= 1) {
      superShot = true;
      this.meter[p.team] = 0;
    }
    if (special && !superShot && mode !== 'serve') key = 1;
    const prm = this.shotParams(p, mode, key, grade, special, side);
    let { dep, lat, T, spin, label } = prm;
    let sp = prm.sp;
    const W = this.W;
    if (superShot) {
      const opp = this.teamPlayers(1 - p.team);
      const ox = opp.length ? opp.reduce((a, o) => a + o.x, 0) / opp.length : 0;
      sp = 'SUPER RALLY SHOT';
      label = sp;
      dep = 9.5;
      lat = (ox >= 0 ? -1 : 1) * (W - 0.6);
      T = 0.84;
      spin = 1.4;
      if (grade < 2) grade = 2;
    }
    // quality effects: accuracy + pace
    const sigma = [1.9, 0.95, 0.4, p.spec.human >= 0 ? 0 : 0.12 + (p.mem?.errMul ?? 1) * 0.5][grade] * (p.spec.human >= 0 ? 1 : (p.mem?.errMul ?? 1) * (1 + Math.max(0, this.rallyHits - 8) * 0.03));
    const second = mode === 'serve' && this.serveNum === 2;
    const sg = second ? sigma * 0.55 : sigma;
    let tx = lat + gauss() * sg;
    let dd = dep + gauss() * sg * 0.85;
    if (mode === 'serve' && sw.special && grade < 3) {
      tx += gauss() * 0.5;
      T *= 0.92;
    }
    if (grade === 0) T *= 1.12;
    if (grade === 2) T *= 0.98;
    if (sw.special && !sp && mode !== 'serve') T *= 0.92;
    T /= this.rules.pace;
    if (mode === 'serve') dd = Math.max(1.2, dd);
    const tz = dz * dd;
    let minNet = netTopAt(clamp(tx, -COURT.netHalf, COURT.netHalf)) + BALL_R + [0.05, 0.14, 0.2, 0.22][grade];
    if (grade === 0 && Math.random() < 0.3 && mode !== 'serve') minNet = 0.4;
    if (mode === 'serve' && grade === 0 && Math.random() < 0.35) minNet = 0.5;
    const plan = planShot(b.x, b.y, b.z, tx, tz, T, spin, minNet);
    b.vx = plan.vx;
    b.vy = plan.vy;
    b.vz = plan.vz;
    b.spin = spin;
    b.lastTeam = p.team;
    b.lastHitter = p;
    b.bounces = 0;
    b.sinceHit = 0;
    b.netHit = false;
    b.letFlag = false;
    b.lastGrade = grade;
    b.special = sp;
    b.stuck = 0;
    b.hitCount++;
    b.speed = Math.hypot(plan.vx, plan.vy, plan.vz);
    if (mode === 'serve') {
      b.isServe = true;
      b.serveBounced = false;
      this.phase = 'rally';
    } else {
      b.isServe = false;
      b.serveBounced = true;
    }
    p.lastHitT = this.time;
    p.tossing = false;
    p.hits++;
    this.rallyHits++;
    this.stats[p.team].hits++;
    if (grade === 3) {
      p.perfects++;
      this.stats[p.team].perfects++;
    }
    if (!this.drill && !superShot) {
      this.meter[p.team] = Math.min(1, this.meter[p.team] + (grade === 3 ? 0.22 : grade === 2 ? 0.12 : 0.07));
      if (this.meter[p.team] >= 1) this.events.push({ type: 'super', team: p.team });
    }
    this.events.push({ type: 'hit', p, x: b.x, y: b.y, z: b.z, grade, label, special: sp, speed: b.speed, spin, mode, vx: b.vx, vy: b.vy, vz: b.vz, team: p.team, big: superShot });
    if (this.drill) this.drillHit(p, grade);
  }

  // ---------------------------------------------------------------- ball
  private updateBall(dt: number) {
    const b = this.ball;
    b.sinceHit += dt;
    if (b.held) {
      this.holdBall();
      return;
    }
    if (this.drill?.type === 'movement') return;
    const px = b.x;
    const py = b.y;
    const pz = b.z;
    integrate(b, dt);
    // net
    if (pz * b.z <= 0 && pz !== b.z) {
      const f = pz / (pz - b.z);
      const yc = py + (b.y - py) * f;
      const xc = px + (b.x - px) * f;
      if (Math.abs(xc) <= COURT.netHalf + 0.15) {
        const clear = yc - BALL_R - netTopAt(xc);
        if (clear < 0) {
          if (clear > -0.07) {
            // clipped the tape: slows and dribbles over
            b.vy = Math.max(b.vy, 1.4);
            b.vz *= 0.45;
            b.vx *= 0.7;
            if (b.isServe) b.letFlag = true;
            this.events.push({ type: 'net', x: xc, y: yc, z: 0, big: false });
          } else {
            b.vz = -b.vz * 0.18;
            b.vx *= 0.4;
            b.vy = Math.abs(b.vy) * 0.2;
            b.spin = 0;
            b.z = (pz > 0 ? 1 : -1) * 0.1;
            b.netHit = true;
            this.events.push({ type: 'net', x: xc, y: yc, z: 0, big: true });
          }
        }
      }
    }
    if (b.y <= BALL_R && b.vy < 0) {
      const gx = b.x;
      const gz = b.z;
      const impact = bounceFloor(b, this.surf);
      if (this.phase === 'toss') {
        // toss hit the ground: handled in step()
      } else if (impact > 0.9) {
        this.onBounce(gx, gz, impact);
      }
    }
    if (b.y <= BALL_R + 0.001 && b.vy === 0) {
      const k = Math.max(0, 1 - 2.6 * dt);
      b.vx *= k;
      b.vz *= k;
    }
    b.speed = Math.hypot(b.vx, b.vy, b.vz);
  }

  private onBounce(x: number, z: number, impact: number) {
    const b = this.ball;
    const side = z > 0 ? 0 : 1;
    let inB = Math.abs(x) <= this.W + 0.05 && Math.abs(z) <= COURT.halfLen + 0.05;
    const live = this.phase === 'rally';
    if (this.drill) {
      this.events.push({ type: 'bounce', x, y: 0, z, impact, surface: this.surf, inBounds: inB });
      if (live) this.drillBounce(x, z, side, inB);
      return;
    }
    if (live && b.isServe && !b.serveBounced) {
      const st = this.score.server;
      const box = this.serveSideIdx === 0 ? -sxOf(st) : sxOf(st);
      inB = side === 1 - st && Math.abs(z) <= COURT.service + 0.05 && x * box >= -0.05 && x * box <= this.W + 0.05;
      this.events.push({ type: 'bounce', x, y: 0, z, impact, surface: this.surf, inBounds: inB });
      if (!inB) {
        this.fault(b.netHit ? 'net' : 'out');
        return;
      }
      if (b.letFlag) {
        this.serveLet();
        return;
      }
      b.serveBounced = true;
      b.bounces = 1;
      return;
    }
    this.events.push({ type: 'bounce', x, y: 0, z, impact, surface: this.surf, inBounds: inB });
    if (!live || b.lastTeam < 0) return;
    if (side === b.lastTeam) {
      this.awardPoint((1 - b.lastTeam) as 0 | 1, b.netHit ? 'net' : 'short', { ue: true });
      return;
    }
    if (b.bounces >= 1 || (b.isServe && b.serveBounced)) {
      const ace = this.rallyHits === 1;
      this.awardPoint(b.lastTeam as 0 | 1, ace ? 'ace' : 'winner', ace ? { ace: true } : { winner: true });
      return;
    }
    if (!inB) {
      this.awardPoint((1 - b.lastTeam) as 0 | 1, 'out', { ue: true });
      return;
    }
    b.bounces++;
    if (b.bounces >= 2) {
      const ace = this.rallyHits === 1;
      this.awardPoint(b.lastTeam as 0 | 1, ace ? 'ace' : 'winner', ace ? { ace: true } : { winner: true });
    }
  }

  // ---------------------------------------------------------------- timing ring
  private updateTiming(p: Player) {
    const t = p.timing;
    t.active = false;
    if (!p.human) return;
    const b = this.ball;
    if (this.phase === 'toss' && p === this.server) {
      const tApex = b.vy / G;
      t.active = !p.swing && b.y > 1.2;
      t.ring = clamp((tApex - 0.11) / 0.45, 0, 1);
      const dv = Math.abs(1.05 + (7.3 * 7.3) / (2 * G) - b.y);
      t.grade = dv < 0.3 ? 3 : dv < 0.65 ? 2 : 1;
      if (b.vy < 0) t.ring = 0;
      return;
    }
    if (this.phase !== 'rally' || p.swing || b.lastTeam === p.team || b.bounces >= 2) return;
    if (b.isServe && !b.serveBounced && b.bounces < 1) {
      // receivers: show ring after the bounce is predicted (use samples with bounce)
    }
    let best = 99;
    let bt = 9;
    for (const s of this.pred) {
      if (s.netHit) break;
      if (s.z * sideZ(p.team) < 0.2) continue;
      const bn = b.bounces + s.bounces + (b.isServe && !b.serveBounced ? 0 : 0);
      if (b.isServe && !b.serveBounced && s.bounces < 1) continue;
      if (bn >= 2) break;
      const c = this.contact(p, s.x, s.y, s.z, Math.max(bn, b.isServe ? 1 : bn));
      if (c.d < best) {
        best = c.d;
        bt = s.t;
      }
    }
    if (best > 3 || bt > 1.0) return;
    t.active = true;
    t.ring = clamp((bt - 0.11) / 0.5, 0, 1);
    t.grade = best < 0.75 ? 3 : best < 1.2 ? 2 : best < 1.75 ? 1 : 0;
  }

  // ---------------------------------------------------------------- drills
  private initDrill(type: DrillType, challenge: boolean, secs: number) {
    const timed = challenge ? type !== 'accuracy' : type === 'movement';
    this.drill = { type, challenge, score: 0, hits: 0, perfects: 0, streak: 0, best: 0, misses: 0, feeds: 0, maxFeeds: challenge && type === 'accuracy' ? 15 : type === 'accuracy' ? 20 : 0, timeLeft: timed ? (type === 'movement' && !challenge ? 45 : secs) : Infinity, timed, targets: [], feedTimer: 1.6, live: false, accSum: 0, accN: 0, msg: '', serveIdx: 0, total: 0 };
    this.spawnTargets();
  }
  private spawnTargets() {
    const d = this.drill!;
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    if (d.type === 'target' || d.type === 'accuracy') {
      d.targets = [];
      const n = d.type === 'target' ? 3 : 1;
      for (let i = 0; i < n; i++) {
        const x = d.type === 'target' ? -3.2 + i * 3.2 + rnd(-0.5, 0.5) : rnd(-3.3, 3.3);
        d.targets.push({ x, z: -rnd(3.5, 9.5), r: d.type === 'target' ? 1.15 : 2.2 });
      }
    } else if (d.type === 'serve') {
      const box = this.serveSideIdx === 0 ? -1 : 1;
      d.targets = [{ x: box * rnd(0.8, this.W - 0.8), z: -rnd(3.5, 5.8), r: 0.9 }];
    } else if (d.type === 'movement') {
      d.targets = [{ x: rnd(-5, 5), z: rnd(2, 12.5), r: 0.9 }];
    }
  }
  private drillHit(_p: Player, grade: number) {
    const d = this.drill!;
    d.msg = '';
    if (d.type === 'perfect') {
      const pts = [0, 10, 40, 100][grade];
      d.score += pts;
      if (grade === 3) {
        d.perfects++;
        d.streak++;
        d.best = Math.max(d.best, d.streak);
      } else d.streak = 0;
    }
  }
  private drillScoreIn(x: number, z: number) {
    const d = this.drill!;
    d.hits++;
    if (d.type === 'free') {
      d.score += 10;
      d.streak++;
      d.best = Math.max(d.best, d.streak);
    } else if (d.type === 'perfect') {
      // scored on hit
    } else if (d.type === 'target' || d.type === 'accuracy' || d.type === 'serve') {
      let bestD = 99;
      let tgt = -1;
      d.targets.forEach((t, i) => {
        const dd = Math.hypot(t.x - x, t.z - z);
        if (dd < bestD) {
          bestD = dd;
          tgt = i;
        }
      });
      if (d.type === 'accuracy') {
        const pts = Math.round(100 * clamp(1 - bestD / 5.5, 0, 1));
        d.score += pts;
        d.accSum += pts;
        d.accN++;
        d.msg = bestD < 0.6 ? 'BULLSEYE!' : `${pts} pts`;
        d.streak = pts > 60 ? d.streak + 1 : 0;
        d.best = Math.max(d.best, d.streak);
        this.spawnTargets();
      } else if (tgt >= 0 && bestD < d.targets[tgt].r) {
        const pts = d.type === 'serve' ? 60 : Math.round(60 + 40 * (1 - bestD / d.targets[tgt].r));
        d.score += pts;
        d.streak++;
        d.best = Math.max(d.best, d.streak);
        d.msg = `TARGET +${pts}`;
        if (d.type === 'target') d.targets.splice(tgt, 1);
        if (d.type === 'serve') this.spawnTargets();
        if (d.type === 'target' && d.targets.length === 0) {
          d.score += 100;
          this.spawnTargets();
        }
      } else {
        if (d.type === 'serve') d.score += 15;
        d.streak = 0;
        d.msg = d.type === 'serve' ? 'IN +15' : 'Missed target';
      }
    }
    this.events.push({ type: 'drill', text: d.msg, x, z });
  }
  private drillMiss(why: string) {
    const d = this.drill!;
    if (d.type === 'perfect' || d.type === 'free' || d.type === 'target' || d.type === 'accuracy') {
      d.misses++;
      d.streak = 0;
    }
    if (d.type === 'serve') d.streak = 0;
    d.msg = why === 'dead' ? '' : why.toUpperCase();
    d.live = false;
    d.feedTimer = 1.0;
    this.events.push({ type: 'drill', text: d.msg === '' ? 'MISS' : d.msg });
    if (d.type === 'serve') this.phase = 'point';
    if (d.type === 'serve') {
      this.next = 'serve';
      this.timer = 0.9;
    }
  }
  private drillBounce(x: number, z: number, side: number, inB: boolean) {
    const d = this.drill!;
    const b = this.ball;
    if (d.type === 'serve') {
      if (!b.isServe) return;
      const box = this.serveSideIdx === 0 ? -1 : 1;
      const ok = side === 1 && Math.abs(z) <= COURT.service + 0.05 && x * box >= -0.05 && x * box <= this.W + 0.05;
      if (ok) {
        this.drillScoreIn(x, z);
        this.phase = 'point';
        this.next = 'serve';
        this.timer = 1.0;
        d.serveIdx++;
        d.live = false;
        this.serveNum = 1;
      } else {
        d.misses++;
        d.streak = 0;
        d.msg = 'FAULT';
        this.events.push({ type: 'fault', text: 'FAULT', reason: 'out' });
        this.phase = 'point';
        this.next = 'serve';
        this.timer = 1.0;
        d.serveIdx++;
      }
      d.total++;
      this.spawnTargets();
      return;
    }
    if (b.lastTeam === 1) {
      if (side === 0) {
        b.bounces++;
        if (b.bounces >= 2) this.drillMiss('missed');
      }
    } else if (b.lastTeam === 0) {
      if (side === 1 && inB) {
        this.drillScoreIn(x, z);
        d.live = false;
        d.feedTimer = 1.0;
        b.lastTeam = -1;
        this.events.push({ type: 'drill', text: d.msg });
      } else if (side === 0 || !inB) {
        this.drillMiss(side === 0 ? 'net' : 'out');
      }
    }
  }
  private feedBall() {
    const d = this.drill!;
    const b = this.ball;
    const h = this.players[0];
    const rnd = (a: number, c: number) => a + Math.random() * (c - a);
    b.held = false;
    b.x = rnd(-3, 3);
    b.z = -12.2;
    b.y = 1.3;
    const prog = d.timed && isFinite(d.timeLeft) ? 1 - d.timeLeft / (this.cfg.challengeSecs ?? 60) : 0;
    const T = d.type === 'perfect' ? 1.3 : (d.challenge ? 1.35 - 0.3 * prog : 1.5) * rnd(0.92, 1.08);
    const tx = clamp(h.x + rnd(-2.6, 2.6), -this.W + 0.6, this.W - 0.6);
    const tz = rnd(6.5, 9.5);
    const pl = planShot(b.x, b.y, b.z, tx, tz, T, 0.6, 1.4);
    b.vx = pl.vx;
    b.vy = pl.vy;
    b.vz = pl.vz;
    b.spin = 0.6;
    b.lastTeam = 1;
    b.lastHitter = null;
    b.bounces = 0;
    b.sinceHit = 0;
    b.isServe = false;
    b.serveBounced = true;
    b.netHit = false;
    b.letFlag = false;
    b.special = null;
    b.stuck = 0;
    this.phase = 'rally';
    d.live = true;
    d.feeds++;
    this.events.push({ type: 'hit', x: b.x, y: b.y, z: b.z, grade: 1, label: 'machine', speed: 14, spin: 0.6, team: 1, vx: b.vx, vy: b.vy, vz: b.vz, mode: 'fh' });
  }
  private finishDrill() {
    if (this.phase === 'over') return;
    this.phase = 'over';
    this.matchOverT = 0;
    this.playerWinner = 0;
    this.players.forEach((p) => (p.pose = 'win'));
  }
  endSession() {
    this.finishDrill();
  }
  private updateDrill(dt: number) {
    const d = this.drill!;
    if (this.phase === 'over') return;
    if (d.timed) {
      d.timeLeft -= dt;
      if (d.timeLeft <= 0) {
        d.timeLeft = 0;
        this.finishDrill();
        return;
      }
    }
    if (d.type === 'movement') {
      this.phase = 'rally';
      const p = this.players[0];
      const t = d.targets[0];
      if (t && Math.hypot(t.x - p.x, t.z - p.z) < t.r) {
        d.score += 10 + (p.sprinting ? 5 : 0);
        d.hits++;
        d.streak++;
        d.best = Math.max(d.best, d.streak);
        this.events.push({ type: 'drill', text: '+10', x: t.x, z: t.z });
        this.spawnTargets();
      }
      return;
    }
    if (d.type === 'serve') return;
    if (d.maxFeeds && d.feeds >= d.maxFeeds && !d.live && d.feedTimer <= 0.2) {
      this.finishDrill();
      return;
    }
    if (!d.live) {
      if (this.phase === 'serve') this.phase = 'rally';
      d.feedTimer -= dt;
      if (d.feedTimer <= 0 && !(d.maxFeeds && d.feeds >= d.maxFeeds)) this.feedBall();
    }
  }

  // ---------------------------------------------------------------- helpers for UI
  labels() {
    return pointLabels(this.score, this.rules);
  }
}
