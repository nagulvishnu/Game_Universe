import {
  drawCarTop, drawCrystal, drawDecorRock, drawGround, drawHero,
  drawPylon, drawTamePickup, drawTrainerNPC,
} from './render';
import { TAU, clamp, lerp, pick, rand, randInt } from './fx';
import { SPECIES, TRAINER_NAMES, wildSpeciesPool } from './data';
import type { SpeciesId } from './types';
import { audio } from './audio';
import type { Game } from './engine';

export const WORLD_R = 1300; // world radius bound (square)

interface Wild {
  id: number;
  species: SpeciesId;
  x: number; y: number;
  angle: number;
  speed: number;
  state: 'wander' | 'rev' | 'flee';
  stateT: number;
  turnT: number;
  alert: number;
  trailT: number;
}

interface Trainer {
  id: number;
  x: number; y: number;
  name: string;
  species: SpeciesId;
  color: string;
  defeated: boolean;
  respawnT: number;
  carAngle: number;
}

interface Pickup {
  id: number;
  kind: 'crystal' | 'tame';
  x: number; y: number;
  seed: number;
}

interface Decor {
  kind: 'rock' | 'pylon';
  x: number; y: number;
  seed: number;
}

export interface EngageTarget {
  kind: 'wild' | 'trainer';
  id: number;
  name: string;
  species: SpeciesId;
}

let nextId = 1;

export class WorldScene {
  hero = { x: 0, y: 0, angle: 0, moving: false, speed: 0 };
  follower = { x: -50, y: 30, angle: 0 };
  wilds: Wild[] = [];
  trainers: Trainer[] = [];
  pickups: Pickup[] = [];
  decor: Decor[] = [];
  time = 0;
  fireflyT = 0;
  // Game-time respawn queue: ticked in update(dt), so pickups never
  // respawn while paused (unlike wall-clock setTimeout).
  pendingSpawns: { kind: 'crystal' | 'tame'; t: number }[] = [];

  constructor(private game: Game) {
    this.reset();
  }

  reset() {
    nextId = 1;
    this.hero = { x: 0, y: 0, angle: 0, moving: false, speed: 0 };
    this.follower = { x: -60, y: 40, angle: 0 };
    this.wilds = [];
    this.trainers = [];
    this.pickups = [];
    this.decor = [];
    this.time = 0;
    this.pendingSpawns = [];

    for (let i = 0; i < 46; i++) {
      this.decor.push({
        kind: Math.random() < 0.72 ? 'rock' : 'pylon',
        x: rand(-WORLD_R, WORLD_R),
        y: rand(-WORLD_R, WORLD_R),
        seed: rand(1000),
      });
    }
    // starter encounters close to spawn so the fun starts instantly
    this.spawnWildAt(300, -80);
    this.spawnWildAt(-340, 180);
    this.spawnWildAt(120, 380);
    for (let i = 0; i < 4; i++) this.spawnWild();
    for (let i = 0; i < 3; i++) this.spawnTrainer(i);
    for (let i = 0; i < 10; i++) this.spawnPickup('crystal', 250, 900);
    for (let i = 0; i < 2; i++) this.spawnPickup('tame', 350, 800);
  }

  private spawnWildAt(x: number, y: number) {
    const pool = wildSpeciesPool(this.game.wins);
    this.wilds.push({
      id: nextId++, species: pick(pool), x, y,
      angle: rand(TAU), speed: rand(36, 66),
      state: 'wander', stateT: 0, turnT: rand(1, 3), alert: 0, trailT: 0,
    });
  }

  private spawnWild() {
    const a = rand(TAU);
    const d = rand(520, 950);
    const x = clamp(this.hero.x + Math.cos(a) * d, -WORLD_R + 60, WORLD_R - 60);
    const y = clamp(this.hero.y + Math.sin(a) * d, -WORLD_R + 60, WORLD_R - 60);
    this.spawnWildAt(x, y);
  }

  private spawnTrainer(idx: number) {
    const spots = [
      { x: 820, y: -520 }, { x: -760, y: 640 }, { x: 540, y: 760 }, { x: -640, y: -700 },
    ];
    const s = spots[idx % spots.length];
    const pool: SpeciesId[] = ['voltox', 'terradon', 'nimbra', 'ferrion', 'aquella'];
    const species = pool[(idx + randInt(0, pool.length - 1)) % pool.length];
    this.trainers.push({
      id: nextId++, x: s.x + rand(-80, 80), y: s.y + rand(-80, 80),
      name: TRAINER_NAMES[idx % TRAINER_NAMES.length],
      species, color: SPECIES[species].accent,
      defeated: false, respawnT: 0, carAngle: rand(TAU),
    });
  }

  private spawnPickup(kind: 'crystal' | 'tame', minD = 300, maxD = 950) {
    const a = rand(TAU);
    const d = rand(minD, maxD);
    this.pickups.push({
      id: nextId++, kind,
      x: clamp(this.hero.x + Math.cos(a) * d, -WORLD_R + 50, WORLD_R - 50),
      y: clamp(this.hero.y + Math.sin(a) * d, -WORLD_R + 50, WORLD_R - 50),
      seed: rand(1000),
    });
  }

  removeWild(id: number) {
    this.wilds = this.wilds.filter((w) => w.id !== id);
  }

  removeTrainer(id: number) {
    const t = this.trainers.find((t) => t.id === id);
    if (t) { t.defeated = true; t.respawnT = 45; }
  }

  findWild(id: number): Wild | undefined {
    return this.wilds.find((w) => w.id === id);
  }

  findTrainer(id: number): Trainer | undefined {
    return this.trainers.find((t) => t.id === id);
  }

  getFollowerSpecies(): SpeciesId {
    return this.game.team[this.game.activeUidIndex]?.species ?? 'blaze';
  }

  update(dt: number, mx: number, my: number) {
    const g = this.game;
    this.time += dt;
    const h = this.hero;

    // ---- hero movement ----
    const mag = Math.hypot(mx, my);
    h.moving = mag > 0.08;
    const targetSpeed = h.moving ? 250 : 0;
    h.speed = lerp(h.speed, targetSpeed, 1 - Math.pow(0.0001, dt));
    if (h.moving) {
      const n = Math.max(mag, 1);
      const vx = (mx / n) * h.speed;
      const vy = (my / n) * h.speed;
      h.x = clamp(h.x + vx * dt, -WORLD_R, WORLD_R);
      h.y = clamp(h.y + vy * dt, -WORLD_R, WORLD_R);
      h.angle = Math.atan2(my, mx);
      if (Math.random() < dt * 8) {
        g.particles.trail(h.x - Math.cos(h.angle) * 12, h.y - Math.sin(h.angle) * 12, 'rgba(34,211,238,.5)', 3, 0.35);
      }
    }

    // ---- follower tiny car ----
    const f = this.follower;
    const tx = h.x - Math.cos(h.angle) * 46;
    const ty = h.y - Math.sin(h.angle) * 46 + 14;
    const k = 1 - Math.pow(0.02, dt);
    const px = f.x, py = f.y;
    f.x = lerp(f.x, tx, k);
    f.y = lerp(f.y, ty, k);
    const fdx = f.x - px, fdy = f.y - py;
    if (Math.hypot(fdx, fdy) > 0.5) {
      f.angle = Math.atan2(fdy, fdx);
      if (Math.random() < dt * 12) {
        g.particles.trail(f.x - Math.cos(f.angle) * 18, f.y - Math.sin(f.angle) * 18, SPECIES[this.getFollowerSpecies()].accent, 2.5, 0.3);
      }
    }

    // ---- wild AI ----
    for (let i = this.wilds.length - 1; i >= 0; i--) {
      const w = this.wilds[i];
      w.stateT += dt;
      w.turnT -= dt;
      const dist = Math.hypot(h.x - w.x, h.y - w.y);

      if (w.state === 'wander' && dist < 180) {
        w.state = 'rev';
        w.stateT = 0;
        audio.rev();
      }
      if (w.state === 'wander') {
        if (w.turnT <= 0) {
          w.turnT = rand(1.4, 3.4);
          const toCenter = Math.atan2(-w.y, -w.x);
          w.angle = Math.hypot(w.x, w.y) > WORLD_R - 120 ? toCenter + rand(-0.6, 0.6) : w.angle + rand(-1.4, 1.4);
        }
        w.x += Math.cos(w.angle) * w.speed * dt;
        w.y += Math.sin(w.angle) * w.speed * dt;
        w.alert = Math.max(0, w.alert - dt * 2);
      } else if (w.state === 'rev') {
        w.alert = Math.min(1, w.alert + dt * 6);
        w.x += rand(-1, 1) * 14 * dt * 10;
        w.y += rand(-1, 1) * 14 * dt * 10;
        // face hero
        w.angle = Math.atan2(h.y - w.y, h.x - w.x);
        if (w.stateT > 0.7) {
          w.state = 'flee';
          w.stateT = 0;
          w.angle = Math.atan2(w.y - h.y, w.x - h.x) + rand(-0.4, 0.4);
          w.speed = 250;
        }
      } else {
        // flee
        w.alert = Math.max(0, w.alert - dt * 3);
        w.x += Math.cos(w.angle) * w.speed * dt;
        w.y += Math.sin(w.angle) * w.speed * dt;
        w.speed = lerp(w.speed, 60, dt);
        if (w.stateT > 1.1) {
          w.state = 'wander';
          w.stateT = 0;
          w.speed = rand(36, 66);
        }
      }
      w.x = clamp(w.x, -WORLD_R + 40, WORLD_R - 40);
      w.y = clamp(w.y, -WORLD_R + 40, WORLD_R - 40);

      // neon trail
      w.trailT -= dt;
      if (w.trailT <= 0 && (w.state !== 'rev')) {
        w.trailT = 0.06;
        g.particles.trail(w.x - Math.cos(w.angle) * 20, w.y - Math.sin(w.angle) * 20, SPECIES[w.species].accent, 2.5, 0.4);
      }

      // despawn far
      if (Math.hypot(h.x - w.x, h.y - w.y) > 1500) this.wilds.splice(i, 1);
    }
    // maintain population
    if (this.wilds.length < 7 && Math.random() < dt * 0.8) this.spawnWild();

    // ---- trainers respawn ----
    for (const t of this.trainers) {
      if (t.defeated) {
        t.respawnT -= dt;
        if (t.respawnT <= 0) {
          t.defeated = false;
          const pool: SpeciesId[] = ['voltox', 'terradon', 'nimbra', 'ferrion', 'aquella'];
          t.species = pick(pool);
          t.color = SPECIES[t.species].accent;
        }
      }
    }

    // ---- pickups ----
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      if (Math.hypot(h.x - p.x, h.y - p.y) < 34) {
        this.pickups.splice(i, 1);
        if (p.kind === 'crystal') {
          g.addScore(25, p.x, p.y);
          audio.pickup();
          g.particles.burst(p.x, p.y, '#67e8f9', 12, 200);
          g.particles.ring(p.x, p.y, '#67e8f9', 8, 0.4);
          this.pendingSpawns.push({ kind: 'crystal', t: 4 });
        } else {
          g.tameCards = Math.min(9, g.tameCards + 1);
          g.floaters.add(p.x, p.y, '+1 TAME CARD', '#e879f9', 22);
          audio.pickup();
          g.particles.burst(p.x, p.y, '#e879f9', 14, 220);
          g.particles.stars(p.x, p.y);
          g.emitHud();
          this.pendingSpawns.push({ kind: 'tame', t: 11 });
        }
      }
    }

    // ---- scheduled respawns (game-time: frozen while paused) ----
    for (let i = this.pendingSpawns.length - 1; i >= 0; i--) {
      const s = this.pendingSpawns[i];
      s.t -= dt;
      if (s.t <= 0) {
        this.pendingSpawns.splice(i, 1);
        this.spawnPickup(s.kind);
      }
    }

    // ---- ambient fireflies ----
    this.fireflyT -= dt;
    if (this.fireflyT <= 0) {
      this.fireflyT = 0.25;
      const a = rand(TAU);
      const d = rand(80, 420);
      g.particles.trail(
        h.x + Math.cos(a) * d,
        h.y + Math.sin(a) * d,
        Math.random() < 0.5 ? 'rgba(34,211,238,.35)' : 'rgba(232,121,249,.3)',
        rand(1.5, 3), rand(0.8, 1.6),
      );
    }

    // ---- engagement detection ----
    let target: EngageTarget | null = null;
    let best = 95;
    for (const w of this.wilds) {
      const d = Math.hypot(h.x - w.x, h.y - w.y);
      if (d < best) {
        best = d;
        target = { kind: 'wild', id: w.id, name: `WILD ${SPECIES[w.species].name}`, species: w.species };
      }
    }
    for (const t of this.trainers) {
      if (t.defeated) continue;
      const d = Math.hypot(h.x - t.x, h.y - t.y);
      if (d < 110 && d < best + 30) {
        best = Math.min(best, d);
        target = { kind: 'trainer', id: t.id, name: `RIDER ${t.name}`, species: t.species };
      }
    }
    g.setEngageTarget(target);
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, camY: number, w: number, h: number, zoom: number) {
    drawGround(ctx, camX, camY, w, h, zoom);

    // world boundary
    ctx.strokeStyle = 'rgba(232,121,249,0.20)';
    ctx.lineWidth = 3 / zoom;
    ctx.strokeRect(-WORLD_R, -WORLD_R, WORLD_R * 2, WORLD_R * 2);

    for (const d of this.decor) {
      if (d.kind === 'rock') drawDecorRock(ctx, d.x, d.y, d.seed);
      else drawPylon(ctx, d.x, d.y, this.time, d.seed);
    }
    for (const p of this.pickups) {
      if (p.kind === 'crystal') drawCrystal(ctx, p.x, p.y, this.time, p.seed);
      else drawTamePickup(ctx, p.x, p.y, this.time, p.seed);
    }
    for (const t of this.trainers) {
      if (t.defeated) continue;
      drawTrainerNPC(ctx, t.x, t.y - 6, this.time, t.color);
      drawCarTop(ctx, SPECIES[t.species], t.x + 44, t.y + 16, t.carAngle, 0.9, this.time);
      // VS marker
      ctx.save();
      ctx.font = '800 15px Orbitron, sans-serif';
      ctx.textAlign = 'center';
      ctx.globalAlpha = 0.85 + 0.15 * Math.sin(this.time * 4);
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(5,2,16,0.9)';
      ctx.strokeText('VS', t.x, t.y - 46);
      ctx.fillStyle = t.color;
      ctx.fillText('VS', t.x, t.y - 46);
      ctx.restore();
    }
    for (const wl of this.wilds) {
      drawCarTop(ctx, SPECIES[wl.species], wl.x, wl.y, wl.angle, 1, this.time, wl.alert);
      if (wl.state === 'rev') {
        ctx.save();
        ctx.font = '900 22px Orbitron, sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'rgba(5,2,16,0.9)';
        ctx.strokeText('!', wl.x, wl.y - 30);
        ctx.fillStyle = '#ffd166';
        ctx.fillText('!', wl.x, wl.y - 30);
        ctx.restore();
      }
    }

    // engagement marker
    const target = this.game.engageTarget;
    if (target) {
      const pos = target.kind === 'wild' ? this.findWild(target.id) : this.findTrainer(target.id);
      if (pos) {
        const r = 44 + Math.sin(this.time * 5) * 5;
        ctx.save();
        ctx.strokeStyle = target.kind === 'wild' ? '#ffd166' : '#ff5470';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([10, 8]);
        ctx.lineDashOffset = -this.time * 40;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r, 0, TAU);
        ctx.stroke();
        ctx.restore();
      }
    }

    // follower + hero
    drawCarTop(ctx, SPECIES[this.getFollowerSpecies()], this.follower.x, this.follower.y, this.follower.angle, 0.85, this.time);
    drawHero(ctx, this.hero.x, this.hero.y, this.hero.angle, this.hero.moving, this.time);
  }

  // screen-space arrows to nearby points of interest
  drawEdgePointers(ctx: CanvasRenderingContext2D, camX: number, camY: number, w: number, h: number, zoom: number) {
    const poi: { x: number; y: number; color: string }[] = [];
    let nt: Trainer | null = null;
    let nd = Infinity;
    for (const t of this.trainers) {
      if (t.defeated) continue;
      const d = Math.hypot(this.hero.x - t.x, this.hero.y - t.y);
      if (d < nd) { nd = d; nt = t; }
    }
    if (nt) poi.push({ x: nt.x, y: nt.y, color: '#ff5470' });
    let nw: Wild | null = null;
    nd = Infinity;
    for (const wl of this.wilds) {
      const d = Math.hypot(this.hero.x - wl.x, this.hero.y - wl.y);
      if (d < nd) { nd = d; nw = wl; }
    }
    if (nw) poi.push({ x: nw.x, y: nw.y, color: '#ffd166' });

    for (const p of poi) {
      const sx = (p.x - camX) * zoom + w / 2;
      const sy = (p.y - camY) * zoom + h / 2;
      if (sx > 40 && sx < w - 40 && sy > 40 && sy < h - 40) continue;
      const cx = clamp(sx, 36, w - 36);
      const cy = clamp(sy, 76, h - 76);
      const a = Math.atan2(sy - cy, sx - cx);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a);
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(-6, -8);
      ctx.lineTo(-6, 8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
}
