import {
  COLS,
  ROWS,
  TILE,
  ENEMIES,
  THEMES,
  TOWERS,
  MAX_TIER,
  DIFFICULTIES,
  generateWaves,
  mulberry32,
  towerStats,
  upgradeCost,
  type Difficulty,
  type EnemyDef,
  type EnemyType,
  type LevelDef,
  type Pt,
  type TowerType,
  type WaveGroup,
} from './data';
import { sfx } from './sfx';

const W = COLS * TILE;
const H = ROWS * TILE;
const SCALE = 2;

export interface PathData {
  pts: Pt[];
  cum: number[];
  len: number;
}

function buildPath(pts: Pt[]): PathData {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  return { pts, cum, len: cum[cum.length - 1] };
}

export interface Enemy {
  id: number;
  type: EnemyType;
  def: EnemyDef;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  dist: number;
  path: PathData;
  pathIdx: number;
  angle: number;
  slowT: number;
  slowAmt: number;
  freezeT: number;
  reward: number;
  hpMult: number;
  flash: number;
  dead: boolean;
  healCd: number;
  bob: number;
}

export interface Tower {
  id: number;
  type: TowerType;
  col: number;
  row: number;
  x: number;
  y: number;
  tier: number;
  cd: number;
  angle: number;
  mode: number;
  invested: number;
  recoil: number;
  kills: number;
}

interface Proj {
  kind: 'arrow' | 'ball';
  x: number;
  y: number;
  tx: number;
  ty: number;
  target: Enemy | null;
  dmg: number;
  speed: number;
  splash: number;
  pierce: number;
  from: Tower;
  angle: number;
}

interface Part {
  kind: 'dot' | 'ring' | 'text' | 'bolt' | 'line' | 'meteor' | 'flash';
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
  text?: string;
  pts?: Pt[];
  x2?: number;
  y2?: number;
}

interface SpawnEntry {
  t: number;
  type: EnemyType;
  path: number;
  wave: number;
}

export type MsgTone = 'info' | 'good' | 'bad';

export const ABILITY_CD = { meteor: 28, freeze: 45, repair: 80 };

export class Game {
  level: LevelDef;
  levelIdx: number;
  diff: Difficulty;
  theme;
  paths: PathData[];
  airPaths: PathData[];
  pathCells = new Set<number>();
  obstacles = new Map<number, string>();
  towers: Tower[] = [];
  enemies: Enemy[] = [];
  projs: Proj[] = [];
  parts: Part[] = [];
  queue: SpawnEntry[] = [];
  delayed: { t: number; fn: () => void }[] = [];
  waves: WaveGroup[][];

  gold: number;
  lives: number;
  maxLives: number;
  waveIdx = 0;
  waveActive = false;
  breather: number;
  time = 0;
  status: 'playing' | 'won' | 'lost' = 'playing';
  speed = 1;
  paused = false;
  kills = 0;
  leaked = 0;
  stars = 0;
  shake = 0;
  cd = { meteor: 0, freeze: 0, repair: 0 };

  hover: { c: number; r: number; x: number; y: number } | null = null;
  buildType: TowerType | null = null;
  selectedId: number | null = null;
  aim: 'meteor' | null = null;

  onMsg: (text: string, tone: MsgTone) => void = () => {};
  onEnd: () => void = () => {};

  private bg: HTMLCanvasElement;
  private nextId = 1;

  // modifiers
  speedMod: number;
  hpMod: number;
  rewardMod: number;
  rangeMod: number;
  regen: boolean;

  constructor(level: LevelDef, diffId: number) {
    this.level = level;
    this.levelIdx = level.id - 1;
    this.diff = DIFFICULTIES[diffId];
    this.theme = THEMES[level.theme];
    this.waves = generateWaves(level);

    const m = level.mods;
    this.speedMod = m.includes('swift') ? 1.2 : 1;
    this.hpMod = m.includes('tough') ? 1.25 : 1;
    this.rewardMod = (m.includes('poor') ? 0.8 : 1) * (m.includes('windfall') ? 1.25 : 1);
    this.rangeMod = m.includes('fog') ? 0.85 : 1;
    this.regen = m.includes('regen');

    this.paths = level.paths.map((wp) =>
      buildPath(wp.map(([c, r]) => [(c + 0.5) * TILE, (r + 0.5) * TILE] as Pt)),
    );
    this.airPaths = this.paths.map((p) => buildPath([p.pts[0], p.pts[p.pts.length - 1]]));

    // path cells
    for (const wp of level.paths) {
      for (let i = 1; i < wp.length; i++) {
        const [c0, r0] = wp[i - 1];
        const [c1, r1] = wp[i];
        const dc = Math.sign(c1 - c0);
        const dr = Math.sign(r1 - r0);
        let c = c0;
        let r = r0;
        for (;;) {
          if (c >= 0 && c < COLS && r >= 0 && r < ROWS) this.pathCells.add(r * COLS + c);
          if (c === c1 && r === r1) break;
          c += dc;
          r += dr;
        }
      }
    }

    // obstacles
    const rng = mulberry32(level.seed);
    let placed = 0;
    let guard = 0;
    while (placed < level.rocks && guard++ < 500) {
      const c = Math.floor(rng() * COLS);
      const r = Math.floor(rng() * ROWS);
      const k = r * COLS + c;
      if (this.pathCells.has(k) || this.obstacles.has(k)) continue;
      this.obstacles.set(k, this.theme.obst[Math.floor(rng() * this.theme.obst.length)]);
      placed++;
    }

    this.gold = Math.round(level.gold * this.diff.startGold);
    this.maxLives = this.diff.lives;
    this.lives = this.maxLives;
    this.breather = this.diff.gap;

    this.bg = this.renderBackground();
  }

  /* --------------------------- helpers --------------------------- */

  get totalWaves() {
    return this.level.waves;
  }

  towerAt(c: number, r: number) {
    return this.towers.find((t) => t.col === c && t.row === r);
  }

  isBuildable(c: number, r: number) {
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return false;
    const k = r * COLS + c;
    return !this.pathCells.has(k) && !this.obstacles.has(k) && !this.towerAt(c, r);
  }

  selectedTower() {
    return this.towers.find((t) => t.id === this.selectedId) ?? null;
  }

  stats(t: Tower) {
    return towerStats(t.type, t.tier, this.rangeMod);
  }

  nextWaveSummary() {
    if (this.waveIdx >= this.totalWaves) return [];
    const map = new Map<EnemyType, number>();
    for (const g of this.waves[this.waveIdx]) map.set(g.type, (map.get(g.type) ?? 0) + g.count);
    return [...map.entries()].map(([type, count]) => ({ type, count }));
  }

  nextWaveBonus() {
    if (this.waveIdx >= this.totalWaves) return 0;
    if (this.waveActive) return 10 + this.waveIdx * 3;
    if (this.waveIdx > 0) return Math.floor(this.breather * 0.8);
    return 0;
  }

  snapshot() {
    return {
      gold: this.gold,
      lives: this.lives,
      maxLives: this.maxLives,
      waveIdx: this.waveIdx,
      totalWaves: this.totalWaves,
      status: this.status,
      speed: this.speed,
      paused: this.paused,
      breather: this.breather,
      waveActive: this.waveActive,
      cd: { ...this.cd },
      next: this.nextWaveSummary(),
      bonus: this.nextWaveBonus(),
      kills: this.kills,
      stars: this.stars,
      enemies: this.enemies.length + this.queue.length,
      selectedId: this.selectedId,
      buildType: this.buildType,
      aim: this.aim,
      towerCount: this.towers.length,
    };
  }

  /* --------------------------- player actions --------------------------- */

  placeTower(c: number, r: number, type: TowerType): boolean {
    if (this.status !== 'playing') return false;
    if (!this.isBuildable(c, r)) {
      sfx.deny();
      this.onMsg('You cannot build there!', 'bad');
      return false;
    }
    const def = TOWERS[type];
    if (this.gold < def.cost) {
      sfx.deny();
      this.onMsg(`Need ${def.cost - this.gold} more gold`, 'bad');
      return false;
    }
    this.gold -= def.cost;
    const t: Tower = {
      id: this.nextId++,
      type,
      col: c,
      row: r,
      x: (c + 0.5) * TILE,
      y: (r + 0.5) * TILE,
      tier: 0,
      cd: 0.3,
      angle: -Math.PI / 2,
      mode: 0,
      invested: def.cost,
      recoil: 0,
      kills: 0,
    };
    this.towers.push(t);
    this.ring(t.x, t.y, 30, def.color);
    this.burst(t.x, t.y, def.color, 10);
    sfx.build();
    return true;
  }

  upgradeTower(id: number): boolean {
    const t = this.towers.find((x) => x.id === id);
    if (!t || t.tier >= MAX_TIER) return false;
    const cost = upgradeCost(t.type, t.tier);
    if (this.gold < cost) {
      sfx.deny();
      this.onMsg(`Need ${cost - this.gold} more gold`, 'bad');
      return false;
    }
    this.gold -= cost;
    t.invested += cost;
    t.tier++;
    this.ring(t.x, t.y, 40, '#fde047');
    this.burst(t.x, t.y, '#fde047', 14);
    this.text(t.x, t.y - 26, 'LEVEL UP!', '#fde047');
    sfx.upgrade();
    return true;
  }

  sellTower(id: number) {
    const i = this.towers.findIndex((x) => x.id === id);
    if (i < 0) return;
    const t = this.towers[i];
    const refund = Math.floor(t.invested * 0.7);
    this.gold += refund;
    this.towers.splice(i, 1);
    this.text(t.x, t.y - 20, `+${refund}`, '#facc15');
    this.burst(t.x, t.y, '#94a3b8', 10);
    if (this.selectedId === id) this.selectedId = null;
    sfx.sell();
  }

  cycleMode(id: number) {
    const t = this.towers.find((x) => x.id === id);
    if (t) t.mode = (t.mode + 1) % 4;
  }

  sendWave() {
    if (this.status !== 'playing' || this.waveIdx >= this.totalWaves) return;
    const bonus = this.nextWaveBonus();
    if (bonus > 0) {
      this.gold += bonus;
      this.onMsg(this.waveActive ? `Bold move! +${bonus} gold` : `Early call! +${bonus} gold`, 'good');
    }
    const w = this.waveIdx;
    const groups = this.waves[w];
    const nPaths = this.paths.length;
    let order = 0;
    for (const g of groups) {
      for (let i = 0; i < g.count; i++) {
        this.queue.push({
          t: this.time + 0.3 + g.delay + i * g.interval,
          type: g.type,
          path: (i + order) % nPaths,
          wave: w,
        });
      }
      order++;
    }
    this.queue.sort((a, b) => a.t - b.t);
    this.waveIdx++;
    this.waveActive = true;
    this.breather = this.diff.gap;
    sfx.wave();
    const isBoss = groups.some((g) => g.type === 'boss');
    this.onMsg(isBoss ? `⚠️ Wave ${this.waveIdx}: BOSS INCOMING!` : `Wave ${this.waveIdx} incoming!`, isBoss ? 'bad' : 'info');
  }

  castMeteor(x: number, y: number): boolean {
    if (this.cd.meteor > 0) {
      this.onMsg('Meteor is recharging', 'bad');
      return false;
    }
    this.cd.meteor = ABILITY_CD.meteor;
    sfx.meteor();
    this.parts.push({ kind: 'meteor', x, y, vx: 0, vy: 0, life: 0.7, max: 0.7, color: '#fb923c', size: 0 });
    const dmg = 160 + this.levelIdx * 35;
    this.delayed.push({
      t: this.time + 0.7,
      fn: () => {
        const R = TILE * 2;
        for (const e of this.enemies) {
          if (e.dead) continue;
          const d = Math.hypot(e.x - x, e.y - y);
          if (d <= R) this.hurt(e, dmg * (1 - 0.4 * (d / R)), 99);
        }
        this.ring(x, y, R, '#fb923c');
        this.ring(x, y, R * 0.6, '#fde047');
        this.burst(x, y, '#f97316', 30, 220);
        this.parts.push({ kind: 'flash', x, y, vx: 0, vy: 0, life: 0.25, max: 0.25, color: '#fff7ed', size: R });
        this.shake = Math.max(this.shake, 0.35);
        sfx.boom();
      },
    });
    return true;
  }

  castFreeze(): boolean {
    if (this.cd.freeze > 0) {
      this.onMsg('Freeze is recharging', 'bad');
      return false;
    }
    this.cd.freeze = ABILITY_CD.freeze;
    for (const e of this.enemies) {
      e.freezeT = 3.5;
      this.burst(e.x, e.y, '#bae6fd', 5, 60);
    }
    this.parts.push({ kind: 'flash', x: W / 2, y: H / 2, vx: 0, vy: 0, life: 0.5, max: 0.5, color: '#bae6fd', size: W });
    sfx.freeze();
    return true;
  }

  castRepair(): boolean {
    if (this.cd.repair > 0) {
      this.onMsg('Repair is recharging', 'bad');
      return false;
    }
    if (this.lives >= this.maxLives) {
      this.onMsg('Gate is already at full health', 'info');
      return false;
    }
    this.cd.repair = ABILITY_CD.repair;
    const gain = Math.min(3, this.maxLives - this.lives);
    this.lives += gain;
    for (const p of this.paths) {
      const end = p.pts[p.pts.length - 1];
      const x = Math.min(end[0], W - TILE / 2);
      this.text(x, end[1] - 20, `+${gain} ❤️`, '#4ade80');
      this.ring(x, end[1], 40, '#4ade80');
    }
    sfx.heal();
    return true;
  }

  /* --------------------------- effects --------------------------- */

  ring(x: number, y: number, size: number, color: string) {
    this.parts.push({ kind: 'ring', x, y, vx: 0, vy: 0, life: 0.45, max: 0.45, color, size });
  }

  burst(x: number, y: number, color: string, n: number, speed = 120) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      this.parts.push({
        kind: 'dot',
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.35 + Math.random() * 0.35,
        max: 0.7,
        color,
        size: 1.5 + Math.random() * 2.5,
      });
    }
  }

  text(x: number, y: number, text: string, color: string) {
    this.parts.push({ kind: 'text', x, y, vx: 0, vy: -28, life: 0.9, max: 0.9, color, size: 0, text });
  }

  /* --------------------------- combat --------------------------- */

  hurt(e: Enemy, dmg: number, pierce: number, src?: Tower) {
    if (e.dead) return;
    const eff = Math.max(dmg * 0.25, dmg - Math.max(0, e.def.armor - pierce));
    e.hp -= eff;
    e.flash = 0.1;
    if (e.hp <= 0) this.kill(e, src);
  }

  kill(e: Enemy, src?: Tower) {
    e.dead = true;
    this.kills++;
    if (src) src.kills++;
    this.gold += e.reward;
    this.text(e.x, e.y - e.def.r, `+${e.reward}`, '#facc15');
    this.burst(e.x, e.y, e.def.color, e.type === 'boss' ? 40 : 8);
    sfx.kill();
    if (e.type === 'boss') {
      this.shake = Math.max(this.shake, 0.4);
      this.ring(e.x, e.y, 90, '#fde047');
      sfx.boom();
    }
    if (e.type === 'splitter') {
      for (let i = 0; i < 3; i++) {
        const c = this.spawn('swarm', e.pathIdx, 0, e.hpMult * 0.8, e.def.flying ? 0 : Math.max(0, e.dist - i * 10));
        if (c) c.reward = 1;
      }
    }
  }

  private spawn(type: EnemyType, pathIdx: number, wave: number, hpOverride?: number, dist = 0): Enemy | null {
    const def = ENEMIES[type];
    const path = def.flying ? this.airPaths[pathIdx] : this.paths[pathIdx];
    const hpMult =
      hpOverride ??
      (1 + this.levelIdx * 0.15) * (1 + wave * 0.1) * this.diff.hp * this.hpMod;
    const maxHp = Math.round(def.hp * hpMult);
    const reward = Math.max(
      1,
      Math.round(def.reward * (1 + this.levelIdx * 0.06 + wave * 0.02) * this.rewardMod * this.diff.reward),
    );
    const e: Enemy = {
      id: this.nextId++,
      type,
      def,
      hp: maxHp,
      maxHp,
      x: path.pts[0][0],
      y: path.pts[0][1],
      dist,
      path,
      pathIdx,
      angle: 0,
      slowT: 0,
      slowAmt: 0,
      freezeT: 0,
      reward,
      hpMult,
      flash: 0,
      dead: false,
      healCd: 0.5,
      bob: Math.random() * 6,
    };
    this.placeOnPath(e);
    this.enemies.push(e);
    return e;
  }

  private placeOnPath(e: Enemy) {
    const p = e.path;
    const d = Math.min(e.dist, p.len);
    let i = 1;
    while (i < p.cum.length - 1 && p.cum[i] < d) i++;
    const seg = p.cum[i] - p.cum[i - 1];
    const t = seg > 0 ? (d - p.cum[i - 1]) / seg : 0;
    e.x = p.pts[i - 1][0] + (p.pts[i][0] - p.pts[i - 1][0]) * t;
    e.y = p.pts[i - 1][1] + (p.pts[i][1] - p.pts[i - 1][1]) * t;
    e.angle = Math.atan2(p.pts[i][1] - p.pts[i - 1][1], p.pts[i][0] - p.pts[i - 1][0]);
  }

  private pickTarget(t: Tower, rangePx: number, canAir: boolean, canGround: boolean): Enemy | null {
    let best: Enemy | null = null;
    let bestScore = -Infinity;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (e.def.flying ? !canAir : !canGround) continue;
      const d = Math.hypot(e.x - t.x, e.y - t.y);
      if (d > rangePx + e.def.r * 0.5) continue;
      let score: number;
      switch (t.mode) {
        case 0:
          score = e.dist / e.path.len;
          break;
        case 1:
          score = -e.dist / e.path.len;
          break;
        case 2:
          score = e.hp;
          break;
        default:
          score = -e.hp;
      }
      if (score > bestScore) {
        bestScore = score;
        best = e;
      }
    }
    return best;
  }

  private fire(t: Tower) {
    const def = TOWERS[t.type];
    const st = this.stats(t);
    const rangePx = st.range * TILE;

    if (t.type === 'frost') {
      const inRange = this.enemies.filter(
        (e) => !e.dead && Math.hypot(e.x - t.x, e.y - t.y) <= rangePx + e.def.r * 0.5,
      );
      if (!inRange.length) return false;
      for (const e of inRange) {
        e.slowAmt = e.slowT > 0 ? Math.max(e.slowAmt, st.slow) : st.slow;
        e.slowT = 2;
        this.hurt(e, st.dmg, 0, t);
      }
      this.ring(t.x, t.y, rangePx, def.color);
      sfx.shoot('frost');
      t.recoil = 1;
      return true;
    }

    const target = this.pickTarget(t, rangePx, def.air, true);
    if (!target) return false;
    t.angle = Math.atan2(target.y - t.y, target.x - t.x);
    t.recoil = 1;

    if (t.type === 'archer') {
      this.projs.push({ kind: 'arrow', x: t.x, y: t.y, tx: target.x, ty: target.y, target, dmg: st.dmg, speed: 560, splash: 0, pierce: 0, from: t, angle: t.angle });
      sfx.shoot('archer');
    } else if (t.type === 'cannon') {
      // lead the target a little
      const sp = target.def.speed * TILE * this.speedMod * 0.8;
      const d = Math.hypot(target.x - t.x, target.y - t.y);
      const tt = d / 300;
      const nd = Math.min(target.path.len, target.dist + sp * tt);
      const probe = { ...target, dist: nd } as Enemy;
      this.placeOnPath(probe);
      this.projs.push({ kind: 'ball', x: t.x, y: t.y, tx: probe.x, ty: probe.y, target: null, dmg: st.dmg, speed: 300, splash: st.splash * TILE, pierce: st.pierce, from: t, angle: t.angle });
      sfx.shoot('cannon');
    } else if (t.type === 'sniper') {
      this.hurt(target, st.dmg, st.pierce, t);
      this.parts.push({ kind: 'line', x: t.x, y: t.y, vx: 0, vy: 0, life: 0.15, max: 0.15, color: '#6ee7b7', size: 2.5, x2: target.x, y2: target.y });
      this.burst(target.x, target.y, '#6ee7b7', 8, 100);
      sfx.shoot('sniper');
    } else if (t.type === 'tesla') {
      const hit: Enemy[] = [target];
      let cur = target;
      while (hit.length < st.chain) {
        let next: Enemy | null = null;
        let nd = TILE * 2.1;
        for (const e of this.enemies) {
          if (e.dead || hit.includes(e)) continue;
          const d = Math.hypot(e.x - cur.x, e.y - cur.y);
          if (d < nd) {
            nd = d;
            next = e;
          }
        }
        if (!next) break;
        hit.push(next);
        cur = next;
      }
      const pts: Pt[] = [[t.x, t.y]];
      hit.forEach((e, i) => {
        pts.push([e.x, e.y]);
        this.hurt(e, st.dmg * Math.pow(0.85, i), 0, t);
      });
      this.parts.push({ kind: 'bolt', x: t.x, y: t.y, vx: 0, vy: 0, life: 0.2, max: 0.2, color: '#c4b5fd', size: 2.5, pts });
      sfx.shoot('tesla');
    }
    return true;
  }

  private explode(p: Proj) {
    for (const e of this.enemies) {
      if (e.dead || e.def.flying) continue;
      const d = Math.hypot(e.x - p.tx, e.y - p.ty);
      if (d <= p.splash + e.def.r * 0.5) {
        this.hurt(e, p.dmg * (1 - 0.4 * Math.min(1, d / p.splash)), p.pierce, p.from);
      }
    }
    this.ring(p.tx, p.ty, p.splash, '#fb923c');
    this.burst(p.tx, p.ty, '#f97316', 12, 140);
    this.parts.push({ kind: 'flash', x: p.tx, y: p.ty, vx: 0, vy: 0, life: 0.12, max: 0.12, color: '#fed7aa', size: p.splash * 0.7 });
    sfx.boom();
  }

  /* --------------------------- update --------------------------- */

  update(dt: number) {
    if (this.status !== 'playing' || this.paused) {
      this.updateParts(dt);
      return;
    }
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt);

    for (const k of ['meteor', 'freeze', 'repair'] as const) this.cd[k] = Math.max(0, this.cd[k] - dt);

    // delayed actions
    for (let i = this.delayed.length - 1; i >= 0; i--) {
      if (this.time >= this.delayed[i].t) {
        const d = this.delayed.splice(i, 1)[0];
        d.fn();
      }
    }

    // spawning
    while (this.queue.length && this.queue[0].t <= this.time) {
      const s = this.queue.shift()!;
      this.spawn(s.type, s.path, s.wave);
    }

    // wave state
    if (this.waveActive && !this.queue.length && !this.enemies.length) {
      this.waveActive = false;
      this.breather = this.diff.gap;
      if (this.waveIdx < this.totalWaves) {
        const bonus = Math.round((14 + this.waveIdx * 3) * this.diff.reward);
        this.gold += bonus;
        this.onMsg(`Wave ${this.waveIdx} cleared! +${bonus} gold`, 'good');
      }
    }
    if (!this.waveActive && this.waveIdx > 0 && this.waveIdx < this.totalWaves) {
      this.breather -= dt;
      if (this.breather <= 0) this.sendWave();
    }

    // enemies
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.flash = Math.max(0, e.flash - dt);
      e.slowT = Math.max(0, e.slowT - dt);
      e.freezeT = Math.max(0, e.freezeT - dt);
      e.bob += dt * 6;
      if (this.regen && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.02 * dt);

      if (e.type === 'healer') {
        e.healCd -= dt;
        if (e.healCd <= 0) {
          e.healCd = 0.5;
          let healed = false;
          for (const o of this.enemies) {
            if (o === e || o.dead || o.hp >= o.maxHp) continue;
            if (Math.hypot(o.x - e.x, o.y - e.y) <= TILE * 2) {
              o.hp = Math.min(o.maxHp, o.hp + Math.max(4, o.maxHp * 0.03));
              healed = true;
            }
          }
          if (healed) this.parts.push({ kind: 'ring', x: e.x, y: e.y, vx: 0, vy: 0, life: 0.4, max: 0.4, color: '#4ade80', size: TILE * 2 });
        }
      }

      let sp = e.def.speed * TILE * this.speedMod;
      if (e.freezeT > 0) sp *= 0.05;
      else if (e.slowT > 0) sp *= 1 - e.slowAmt;
      e.dist += sp * dt;
      if (e.dist >= e.path.len) {
        e.dead = true;
        this.lives = Math.max(0, this.lives - e.def.dmg);
        this.leaked += e.def.dmg;
        this.shake = Math.max(this.shake, 0.3);
        const ex = Math.min(e.x, W - 10);
        this.text(ex - 10, e.y - 10, `-${e.def.dmg} ❤️`, '#f87171');
        this.burst(ex, e.y, '#ef4444', 10);
        sfx.life();
        if (this.lives <= 0) {
          this.status = 'lost';
          sfx.lose();
          this.onEnd();
        }
      } else this.placeOnPath(e);
    }

    // towers
    for (const t of this.towers) {
      t.cd -= dt;
      t.recoil = Math.max(0, t.recoil - dt * 6);
      if (t.cd <= 0) {
        if (this.fire(t)) t.cd = this.stats(t).rate;
        else t.cd = 0.05;
      } else {
        // aim at current target for visuals
        if (t.type !== 'frost' && t.type !== 'tesla') {
          const st = this.stats(t);
          const tg = this.pickTarget(t, st.range * TILE, TOWERS[t.type].air, true);
          if (tg) {
            const a = Math.atan2(tg.y - t.y, tg.x - t.x);
            let d = a - t.angle;
            while (d > Math.PI) d -= Math.PI * 2;
            while (d < -Math.PI) d += Math.PI * 2;
            t.angle += d * Math.min(1, dt * 14);
          }
        }
      }
    }

    // projectiles
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const p = this.projs[i];
      if (p.target && !p.target.dead) {
        p.tx = p.target.x;
        p.ty = p.target.y;
      }
      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      const d = Math.hypot(dx, dy);
      const step = p.speed * dt;
      p.angle = Math.atan2(dy, dx);
      if (d <= step) {
        if (p.kind === 'arrow') {
          if (p.target && !p.target.dead) {
            this.hurt(p.target, p.dmg, p.pierce, p.from);
            this.burst(p.tx, p.ty, '#fde68a', 3, 60);
          }
        } else this.explode(p);
        this.projs.splice(i, 1);
      } else {
        p.x += (dx / d) * step;
        p.y += (dy / d) * step;
      }
    }

    this.enemies = this.enemies.filter((e) => !e.dead);
    this.updateParts(dt);

    // victory
    if (
      this.status === 'playing' &&
      this.waveIdx >= this.totalWaves &&
      !this.queue.length &&
      !this.enemies.length
    ) {
      this.status = 'won';
      const ratio = this.lives / this.maxLives;
      this.stars = ratio >= 0.75 ? 3 : ratio >= 0.35 ? 2 : 1;
      sfx.win();
      this.onEnd();
    }
  }

  private updateParts(dt: number) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'dot') {
        p.vx *= 0.94;
        p.vy *= 0.94;
      }
      if (p.life <= 0) this.parts.splice(i, 1);
    }
  }

  /* --------------------------- rendering --------------------------- */

  private renderBackground(): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    cv.width = W * SCALE;
    cv.height = H * SCALE;
    const g = cv.getContext('2d')!;
    g.scale(SCALE, SCALE);
    const th = this.theme;
    const rng = mulberry32(this.level.seed + 5);

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        g.fillStyle = (r + c) % 2 ? th.g1 : th.g2;
        g.fillRect(c * TILE, r * TILE, TILE, TILE);
      }
    }
    // little tufts
    g.globalAlpha = 0.18;
    g.fillStyle = '#000';
    for (let i = 0; i < 140; i++) {
      g.beginPath();
      g.ellipse(rng() * W, rng() * H, 2 + rng() * 3, 1 + rng() * 1.5, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;

    const isPath = (c: number, r: number) => this.pathCells.has(r * COLS + c);
    for (const k of this.pathCells) {
      const c = k % COLS;
      const r = Math.floor(k / COLS);
      g.fillStyle = th.path;
      g.fillRect(c * TILE, r * TILE, TILE, TILE);
    }
    // pebbles on path
    g.globalAlpha = 0.25;
    g.fillStyle = th.edge;
    for (const k of this.pathCells) {
      const c = k % COLS;
      const r = Math.floor(k / COLS);
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.arc(c * TILE + rng() * TILE, r * TILE + rng() * TILE, 1 + rng() * 2, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.globalAlpha = 1;
    g.strokeStyle = th.edge;
    g.lineWidth = 4;
    g.lineCap = 'round';
    for (const k of this.pathCells) {
      const c = k % COLS;
      const r = Math.floor(k / COLS);
      const x = c * TILE;
      const y = r * TILE;
      const edge = (dx: number, dy: number, x1: number, y1: number, x2: number, y2: number) => {
        const nc = c + dx;
        const nr = r + dy;
        if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) return;
        if (!isPath(nc, nr)) {
          g.beginPath();
          g.moveTo(x1, y1);
          g.lineTo(x2, y2);
          g.stroke();
        }
      };
      edge(0, -1, x, y + 1, x + TILE, y + 1);
      edge(0, 1, x, y + TILE - 1, x + TILE, y + TILE - 1);
      edge(-1, 0, x + 1, y, x + 1, y + TILE);
      edge(1, 0, x + TILE - 1, y, x + TILE - 1, y + TILE);
    }

    // obstacles
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const [k, emo] of this.obstacles) {
      const c = k % COLS;
      const r = Math.floor(k / COLS);
      g.fillStyle = 'rgba(0,0,0,0.22)';
      g.beginPath();
      g.ellipse((c + 0.5) * TILE, (r + 0.5) * TILE + 14, 15, 6, 0, 0, Math.PI * 2);
      g.fill();
      g.font = '34px serif';
      g.fillText(emo, (c + 0.5) * TILE, (r + 0.5) * TILE + 2);
    }
    return cv;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (this.shake > 0) {
      const m = Math.min(1, this.shake * 3) * 5;
      ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    }
    ctx.drawImage(this.bg, 0, 0, W, H);
    const now = performance.now() / 1000;

    // spawn portals & exit
    for (const p of this.paths) {
      const s = p.pts[0];
      const sx = Math.max(14, Math.min(W - 14, s[0]));
      const gr = ctx.createRadialGradient(sx, s[1], 2, sx, s[1], 26);
      gr.addColorStop(0, 'rgba(244,114,182,0.9)');
      gr.addColorStop(1, 'rgba(168,85,247,0)');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(sx, s[1], 22 + Math.sin(now * 4) * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const exits = new Set<string>();
    for (const p of this.paths) {
      const e = p.pts[p.pts.length - 1];
      const ex = Math.min(e[0], W - TILE / 2);
      const key = `${ex},${e[1]}`;
      if (exits.has(key)) continue;
      exits.add(key);
      ctx.font = '34px serif';
      ctx.fillText('🏰', ex, e[1] + 1);
    }

    // range preview
    const hv = this.hover;
    const sel = this.selectedTower();
    const ring = (x: number, y: number, r: number, color: string, fill: string) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    };
    if (sel) {
      ring(sel.x, sel.y, this.stats(sel).range * TILE, '#ffffffcc', 'rgba(255,255,255,0.12)');
    }
    if (hv && !this.aim) {
      const hoverT = this.towerAt(hv.c, hv.r);
      if (this.buildType) {
        const ok = this.isBuildable(hv.c, hv.r);
        const aff = this.gold >= TOWERS[this.buildType].cost;
        const cx = (hv.c + 0.5) * TILE;
        const cy = (hv.r + 0.5) * TILE;
        if (hv.c >= 0 && hv.c < COLS && hv.r >= 0 && hv.r < ROWS) {
          const good = ok && aff;
          ring(cx, cy, towerStats(this.buildType, 0, this.rangeMod).range * TILE, good ? '#4ade80' : '#f87171', good ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)');
          ctx.fillStyle = good ? 'rgba(74,222,128,0.35)' : 'rgba(248,113,113,0.35)';
          ctx.fillRect(hv.c * TILE, hv.r * TILE, TILE, TILE);
          ctx.globalAlpha = 0.7;
          ctx.font = '24px serif';
          ctx.fillText(TOWERS[this.buildType].icon, cx, cy);
          ctx.globalAlpha = 1;
        }
      } else if (hoverT && hoverT !== sel) {
        ring(hoverT.x, hoverT.y, this.stats(hoverT).range * TILE, '#ffffff88', 'rgba(255,255,255,0.07)');
      }
    }

    // towers
    for (const t of this.towers) this.drawTower(ctx, t, now, t.id === this.selectedId);

    // enemies: ground first (sorted by y), then flyers
    const ground = this.enemies.filter((e) => !e.def.flying).sort((a, b) => a.y - b.y);
    const air = this.enemies.filter((e) => e.def.flying);
    for (const e of ground) this.drawEnemy(ctx, e);
    for (const e of air) this.drawEnemy(ctx, e);

    // projectiles
    for (const p of this.projs) {
      if (p.kind === 'arrow') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.strokeStyle = '#fef3c7';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-9, 0);
        ctx.lineTo(5, 0);
        ctx.stroke();
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(3, -3);
        ctx.lineTo(3, 3);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.fillStyle = '#111827';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fb923c';
        ctx.beginPath();
        ctx.arc(p.x - 1.5, p.y - 1.5, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // particles
    for (const p of this.parts) this.drawPart(ctx, p);

    // meteor aim
    if (this.aim === 'meteor' && hv) {
      const R = TILE * 2;
      ctx.beginPath();
      ctx.arc(hv.x, hv.y, R, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(239,68,68,0.18)';
      ctx.fill();
      ctx.strokeStyle = '#f87171';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.lineDashOffset = -now * 30;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = '22px serif';
      ctx.fillText('☄️', hv.x, hv.y);
    }

    ctx.restore();

    if (this.paused && this.status === 'playing') {
      ctx.fillStyle = 'rgba(2,6,23,0.55)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 40px system-ui, sans-serif';
      ctx.fillText('PAUSED', W / 2, H / 2);
    }
  }

  private drawTower(ctx: CanvasRenderingContext2D, t: Tower, now: number, selected: boolean) {
    const def = TOWERS[t.type];
    const { x, y } = t;
    // base
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(x, y + 18, 19, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = selected ? '#fff' : def.color;
    ctx.lineWidth = selected ? 3 : 2;
    ctx.beginPath();
    ctx.roundRect(x - 19, y - 19, 38, 38, 9);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.roundRect(x - 15, y - 15, 30, 30, 6);
    ctx.fill();

    // tier pips
    for (let i = 0; i < t.tier; i++) {
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(x - (t.tier - 1) * 4 + i * 8, y + 14, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    ctx.translate(x, y - 1);
    const glow = t.tier >= 3 ? 8 : 0;
    if (glow) {
      ctx.shadowColor = def.color;
      ctx.shadowBlur = glow;
    }
    if (t.type === 'archer') {
      ctx.rotate(t.angle);
      ctx.fillStyle = '#92400e';
      ctx.fillRect(-2 - t.recoil * 3, -2.5, 18, 5);
      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.arc(0, 0, 9 + t.tier * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff7ed';
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (t.type === 'cannon') {
      ctx.rotate(t.angle);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-2 - t.recoil * 5, -5.5 - t.tier * 0.4, 20, 11 + t.tier * 0.8);
      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7f1d1d';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (t.type === 'sniper') {
      ctx.rotate(t.angle);
      ctx.fillStyle = '#064e3b';
      ctx.fillRect(-2 - t.recoil * 4, -2, 25, 4);
      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#022c22';
      ctx.beginPath();
      ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (t.type === 'frost') {
      ctx.rotate(now * 0.8);
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        ctx.rotate(Math.PI / 3);
        ctx.beginPath();
        ctx.moveTo(-12, 0);
        ctx.lineTo(12, 0);
        ctx.stroke();
      }
      ctx.fillStyle = '#e0f2fe';
      ctx.beginPath();
      ctx.arc(0, 0, 5 + t.recoil * 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (t.type === 'tesla') {
      ctx.fillStyle = '#4c1d95';
      ctx.fillRect(-4, -2, 8, 14);
      const pulse = 8 + Math.sin(now * 8) * 1.5 + t.recoil * 3;
      const gr = ctx.createRadialGradient(0, -6, 1, 0, -6, pulse + 4);
      gr.addColorStop(0, '#ffffff');
      gr.addColorStop(0.5, def.color);
      gr.addColorStop(1, 'rgba(167,139,250,0)');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(0, -6, pulse + 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy) {
    const { def } = e;
    const fly = !!def.flying;
    const bob = fly ? Math.sin(e.bob) * 3 : Math.abs(Math.sin(e.bob)) * -2;
    const yy = e.y + bob - (fly ? 14 : 0);
    const r = def.r;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(e.x, e.y + r * 0.7, r * 0.9, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    // body
    ctx.fillStyle = e.flash > 0 ? '#ffffff' : def.color;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(e.x, yy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = e.type === 'boss' ? '#fde047' : 'rgba(0,0,0,0.45)';
    ctx.lineWidth = e.type === 'boss' ? 3 : 2;
    ctx.stroke();
    if (e.freezeT > 0 || e.slowT > 0) {
      ctx.strokeStyle = '#7dd3fc';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(e.x, yy, r + 3, 0, Math.PI * 2);
      ctx.stroke();
      if (e.freezeT > 0) {
        ctx.fillStyle = 'rgba(186,230,253,0.55)';
        ctx.beginPath();
        ctx.arc(e.x, yy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.font = `${Math.round(r * 1.35)}px serif`;
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.icon, e.x, yy + 1);
    if (def.armor > 0) {
      ctx.font = '10px serif';
      ctx.fillText('🛡️', e.x + r * 0.8, yy - r * 0.8);
    }
    // hp bar
    if (e.hp < e.maxHp || e.type === 'boss') {
      const bw = Math.max(22, r * 2);
      const bx = e.x - bw / 2;
      const by = yy - r - 9;
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(bx - 1, by - 1, bw + 2, 6);
      const f = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = f > 0.5 ? '#4ade80' : f > 0.25 ? '#facc15' : '#ef4444';
      ctx.fillRect(bx, by, bw * f, 4);
    }
  }

  private drawPart(ctx: CanvasRenderingContext2D, p: Part) {
    const f = Math.max(0, p.life / p.max);
    switch (p.kind) {
      case 'dot':
        ctx.globalAlpha = f;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.4 + f * 0.6), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        break;
      case 'ring':
        ctx.globalAlpha = f * 0.8;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3 * f + 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - f * f), 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        break;
      case 'flash':
        ctx.globalAlpha = f * 0.6;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        break;
      case 'text':
        ctx.globalAlpha = Math.min(1, f * 1.6);
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(0,0,0,0.7)';
        ctx.strokeText(p.text ?? '', p.x, p.y);
        ctx.fillStyle = p.color;
        ctx.fillText(p.text ?? '', p.x, p.y);
        ctx.globalAlpha = 1;
        break;
      case 'line':
        ctx.globalAlpha = f;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size * f + 0.5;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x2 ?? p.x, p.y2 ?? p.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
        break;
      case 'bolt': {
        if (!p.pts) break;
        ctx.globalAlpha = Math.min(1, f * 1.5);
        for (const [w, col] of [[5, 'rgba(167,139,250,0.5)'], [2, '#ffffff']] as const) {
          ctx.strokeStyle = col;
          ctx.lineWidth = w;
          ctx.beginPath();
          ctx.moveTo(p.pts[0][0], p.pts[0][1]);
          for (let i = 1; i < p.pts.length; i++) {
            const [ax, ay] = p.pts[i - 1];
            const [bx, by] = p.pts[i];
            const segs = 4;
            for (let s = 1; s <= segs; s++) {
              const tt = s / segs;
              const jx = s === segs ? 0 : (Math.random() - 0.5) * 12;
              const jy = s === segs ? 0 : (Math.random() - 0.5) * 12;
              ctx.lineTo(ax + (bx - ax) * tt + jx, ay + (by - ay) * tt + jy);
            }
          }
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        break;
      }
      case 'meteor': {
        const t = 1 - f;
        const sx = p.x + 260;
        const sy = p.y - 520;
        const x = sx + (p.x - sx) * t;
        const y = sy + (p.y - sy) * t;
        // target marker
        ctx.strokeStyle = 'rgba(248,113,113,0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, TILE * 2 * (0.5 + 0.5 * t), 0, Math.PI * 2);
        ctx.stroke();
        // trail
        const gr = ctx.createLinearGradient(x, y, x + 120 * (1 - t) + 20, y - 240 * (1 - t) - 40);
        gr.addColorStop(0, 'rgba(251,146,60,0.9)');
        gr.addColorStop(1, 'rgba(251,146,60,0)');
        ctx.strokeStyle = gr;
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 120 * (1 - t) + 20, y - 240 * (1 - t) - 40);
        ctx.stroke();
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }
  }
}

export const CANVAS_W = W * SCALE;
export const CANVAS_H = H * SCALE;
export const LOGICAL_W = W;
export const LOGICAL_H = H;
