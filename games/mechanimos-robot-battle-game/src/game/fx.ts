// ---------- easing / math ----------
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const rand = (a = 1, b?: number) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const randInt = (a: number, b: number) => Math.floor(rand(a, b + 1));
export const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
export const TAU = Math.PI * 2;

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInCubic = (t: number) => t * t * t;
export const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t);
export const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export function outBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

// ---------- tweens (frame-driven, pause-friendly) ----------
export interface Tween {
  t: number;
  dur: number;
  update: (k: number) => void;
  done: () => void;
}

export class Tweens {
  list: Tween[] = [];

  add(dur: number, update: (k: number) => void, ease: (t: number) => number = easeOutCubic): Promise<void> {
    return new Promise((resolve) => {
      this.list.push({
        t: 0,
        dur: Math.max(0.001, dur),
        update: (k) => update(ease(clamp(k, 0, 1))),
        done: resolve,
      });
    });
  }

  update(dt: number) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const tw = this.list[i];
      tw.t += dt;
      const k = clamp(tw.t / tw.dur, 0, 1);
      tw.update(k);
      if (k >= 1) {
        this.list.splice(i, 1);
        tw.done();
      }
    }
  }

  clear() {
    this.list.length = 0;
  }
}

// ---------- particles ----------
export type PKind = 'spark' | 'dot' | 'smoke' | 'ring' | 'shard' | 'star';

interface P {
  kind: PKind;
  x: number; y: number;
  vx: number; vy: number;
  life: number; ttl: number;
  size: number;
  color: string;
  rot: number; vr: number;
  grav: number;
  drag: number;
}

const MAX_P = 550;

export class Particles {
  pool: P[] = [];

  private push(p: Partial<P> & { x: number; y: number }) {
    if (this.pool.length >= MAX_P) this.pool.shift();
    this.pool.push({
      kind: 'dot', vx: 0, vy: 0, life: 0, ttl: 0.6, size: 4,
      color: '#fff', rot: rand(TAU), vr: rand(-4, 4), grav: 0, drag: 0.98,
      ...p,
    } as P);
  }

  burst(x: number, y: number, color: string, n = 14, speed = 320, kind: PKind = 'spark') {
    for (let i = 0; i < n; i++) {
      const a = rand(TAU);
      const s = rand(speed * 0.25, speed);
      this.push({
        kind, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        ttl: rand(0.35, 0.8), size: rand(2.5, 6), color, grav: kind === 'shard' ? 500 : 0,
      });
    }
  }

  ring(x: number, y: number, color: string, size = 10, ttl = 0.5) {
    this.push({ kind: 'ring', x, y, ttl, size, color, drag: 1 });
  }

  trail(x: number, y: number, color: string, size = 4, ttl = 0.4) {
    this.push({ kind: 'dot', x, y, ttl, size, color, drag: 0.94 });
  }

  smoke(x: number, y: number, n = 6, color = '#8b8ba7') {
    for (let i = 0; i < n; i++) {
      this.push({
        kind: 'smoke', x: x + rand(-12, 12), y: y + rand(-8, 8),
        vx: rand(-40, 40), vy: rand(-70, -20),
        ttl: rand(0.6, 1.3), size: rand(8, 20), color, drag: 0.985,
      });
    }
  }

  stars(x: number, y: number, color = '#ffe27a', n = 10) {
    for (let i = 0; i < n; i++) {
      const a = rand(TAU);
      const s = rand(60, 200);
      this.push({ kind: 'star', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, ttl: rand(0.5, 1), size: rand(5, 10), color, grav: 160 });
    }
  }

  update(dt: number) {
    const arr = this.pool;
    for (let i = arr.length - 1; i >= 0; i--) {
      const p = arr[i];
      p.life += dt;
      if (p.life >= p.ttl) {
        arr[i] = arr[arr.length - 1];
        arr.pop();
        continue;
      }
      p.vy += p.grav * dt;
      p.vx *= Math.pow(p.drag, dt * 60);
      p.vy *= Math.pow(p.drag, dt * 60);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
  }

  draw(ctx: CanvasRenderingContext2D, camX = 0, camY = 0) {
    const arr = this.pool;
    for (let i = 0; i < arr.length; i++) {
      const p = arr[i];
      const k = p.life / p.ttl;
      const alpha = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
      const x = p.x - camX;
      const y = p.y - camY;
      ctx.save();
      ctx.globalAlpha = alpha;
      if (p.kind === 'spark') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size * (1 - k * 0.6);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - p.vx * 0.03, y - p.vy * 0.03);
        ctx.stroke();
      } else if (p.kind === 'dot') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(x, y, p.size * (1 - k * 0.7), 0, TAU);
        ctx.fill();
      } else if (p.kind === 'smoke') {
        ctx.globalAlpha = alpha * 0.35;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(x, y, p.size * (0.6 + k), 0, TAU);
        ctx.fill();
      } else if (p.kind === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3 * (1 - k) + 1;
        ctx.beginPath();
        ctx.arc(x, y, p.size + k * 90, 0, TAU);
        ctx.stroke();
      } else if (p.kind === 'shard') {
        ctx.fillStyle = p.color;
        ctx.translate(x, y);
        ctx.rotate(p.rot);
        ctx.beginPath();
        ctx.moveTo(0, -p.size);
        ctx.lineTo(p.size * 0.7, p.size);
        ctx.lineTo(-p.size * 0.7, p.size * 0.5);
        ctx.closePath();
        ctx.fill();
      } else if (p.kind === 'star') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        const s = p.size * (1 - k * 0.5);
        ctx.beginPath();
        ctx.moveTo(x - s, y); ctx.lineTo(x + s, y);
        ctx.moveTo(x, y - s); ctx.lineTo(x, y + s);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  clear() {
    this.pool.length = 0;
  }
}

// ---------- floating text ----------
interface Floater {
  x: number; y: number;
  text: string;
  color: string;
  life: number; ttl: number;
  size: number;
}

export class Floaters {
  list: Floater[] = [];

  add(x: number, y: number, text: string, color = '#fff', size = 26, ttl = 1) {
    this.list.push({ x, y, text, color, life: 0, ttl, size });
  }

  update(dt: number) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const f = this.list[i];
      f.life += dt;
      f.y -= 46 * dt;
      if (f.life >= f.ttl) this.list.splice(i, 1);
    }
  }

  draw(ctx: CanvasRenderingContext2D, camX = 0, camY = 0) {
    for (const f of this.list) {
      const k = f.life / f.ttl;
      const scale = k < 0.18 ? 0.5 + (k / 0.18) * 0.7 : 1.2 - 0.2 * ((k - 0.18) / 0.82);
      ctx.save();
      ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      ctx.translate(f.x - camX, f.y - camY);
      ctx.scale(scale, scale);
      ctx.font = `800 ${f.size}px Orbitron, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(5,2,16,.9)';
      ctx.strokeText(f.text, 0, 0);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, 0, 0);
      ctx.restore();
    }
  }

  clear() {
    this.list.length = 0;
  }
}
