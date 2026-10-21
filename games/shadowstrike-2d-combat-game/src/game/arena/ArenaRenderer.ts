/** SHADOWSTRIKE — 2D parallax arena renderer (pure side view). */

import Phaser from 'phaser';
import type { ArenaDef, ArenaLayer } from '../../data/arenas';

interface Particle { x: number; y: number; vx: number; vy: number; r: number; a: number }

export class ArenaRenderer {
  private layers: { gfx: Phaser.GameObjects.Graphics; def: ArenaLayer; baseX: number }[] = [];
  private particleGfx: Phaser.GameObjects.Graphics;
  private particles: Particle[] = [];
  private floorGfx: Phaser.GameObjects.Graphics;
  private t = 0;

  constructor(scene: Phaser.Scene, private arena: ArenaDef, private width: number, private height: number) {
    // sky gradient (drawn as horizontal bands — cheap and stylish)
    const sky = scene.add.graphics().setDepth(-100).setScrollFactor(0);
    const bands = 48;
    for (let i = 0; i < bands; i++) {
      const t = i / (bands - 1);
      sky.fillStyle(mix(arena.skyTop, arena.skyBottom, t), 1);
      sky.fillRect(-200, (height / bands) * i - 2, width + 400, height / bands + 3);
    }

    for (const def of arena.layers) {
      const g = scene.add.graphics().setDepth(-90 + arena.layers.indexOf(def));
      this.drawLayer(g, def);
      this.layers.push({ gfx: g, def, baseX: 0 });
    }

    this.floorGfx = scene.add.graphics().setDepth(5);
    this.drawFloor();

    // ambient light: soft accent bloom around the stage + soft vignette
    const ambient = scene.add.graphics().setDepth(6).setScrollFactor(0);
    for (let i = 6; i >= 1; i--) {
      ambient.fillStyle(this.arena.accent, 0.022 * (7 - i));
      ambient.fillEllipse(this.width / 2, this.arena.floorY - 40, this.width * (0.5 + i * 0.16), 90 + i * 60);
    }
    const vig = scene.add.graphics().setDepth(40).setScrollFactor(0);
    for (let i = 0; i < 7; i++) {
      const a = 0.055 - i * 0.007;
      vig.fillStyle(0x000000, Math.max(0, a));
      vig.fillRect(0, i * 34, this.width, 34);
      vig.fillRect(0, this.height - (i + 1) * 34, this.width, 34);
    }

    this.particleGfx = scene.add.graphics().setDepth(8);
    const { count } = arena.particle;
    for (let i = 0; i < count; i++) this.particles.push(this.makeParticle(true));
  }

  private makeParticle(initial = false): Particle {
    const p = this.arena.particle;
    const upward = p.kind === 'ember';
    return {
      x: Phaser.Math.Between(-40, this.width + 40),
      y: initial ? Phaser.Math.Between(0, this.height) : upward ? this.height + 10 : -10,
      vx: Phaser.Math.FloatBetween(-p.speed * 0.4, p.speed * 0.4),
      vy: upward ? -Phaser.Math.FloatBetween(p.speed * 0.5, p.speed * 1.4) : Phaser.Math.FloatBetween(p.speed * 0.4, p.speed * 1.2),
      r: Phaser.Math.FloatBetween(1.2, 3.2),
      a: Phaser.Math.FloatBetween(0.25, 0.85),
    };
  }

  private drawFloor(): void {
    const g = this.floorGfx;
    const a = this.arena;
    g.clear();
    g.fillStyle(a.floorColor, 1);
    g.fillRect(-200, a.floorY, this.width + 400, this.height - a.floorY + 200);
    // glossy reflection band under the floor line
    for (let i = 0; i < 6; i++) {
      g.fillStyle(shade(a.floorColor, 1.5 - i * 0.18), 0.35 - i * 0.055);
      g.fillRect(-200, a.floorY + 4 + i * 7, this.width + 400, 7);
    }
    g.fillStyle(shade(a.floorColor, 1.25), 1);
    g.fillRect(-200, a.floorY, this.width + 400, 4);
    // bright centre stage glow
    for (let i = 4; i >= 1; i--) {
      g.fillStyle(a.accent, 0.05 * (5 - i));
      g.fillEllipse(this.width / 2, a.floorY + 8, this.width * (0.28 + i * 0.2), 24 + i * 14);
    }
    g.lineStyle(2, a.accent, 0.55);
    g.lineBetween(-200, a.floorY + 1, this.width + 400, a.floorY + 1);
    // floor grid lines for depth
    g.lineStyle(1, a.accent, 0.12);
    for (let i = 0; i < 26; i++) {
      const y = a.floorY + 6 + i * i * 0.9;
      if (y > this.height) break;
      g.lineBetween(-200, y, this.width + 400, y);
    }
    // arena bound markers with glow tips
    g.fillStyle(a.accent, 0.18);
    g.fillRect(a.leftBound - 46, a.floorY - 240, 6, 240);
    g.fillRect(a.rightBound + 40, a.floorY - 240, 6, 240);
    g.fillStyle(a.accent, 0.55);
    g.fillRect(a.leftBound - 46, a.floorY - 240, 6, 26);
    g.fillRect(a.rightBound + 40, a.floorY - 240, 6, 26);
  }

  private drawLayer(g: Phaser.GameObjects.Graphics, def: ArenaLayer): void {
    const w = this.width, h = this.height;
    const floor = this.arena.floorY;
    g.clear();
    switch (def.kind) {
      case 'sky': {
        // large accent moon with layered halo + subtle crater shading
        const mx = w * 0.7, my = h * 0.22, mr = 130;
        for (let i = 4; i >= 1; i--) {
          g.fillStyle(def.alt, def.alpha * (0.05 + (4 - i) * 0.035));
          g.fillCircle(mx, my, mr + i * 34);
        }
        g.fillStyle(mix(def.alt, 0xffffff, 0.35), 1);
        g.fillCircle(mx, my, mr);
        // moon shading (inner craters)
        g.fillStyle(shade(mix(def.alt, 0x000000, 0.35), 1.1), 0.5);
        g.fillCircle(mx - 38, my - 26, 22);
        g.fillCircle(mx + 30, my + 14, 30);
        g.fillCircle(mx - 8, my + 40, 14);
        // faint small companion orb
        g.fillStyle(def.alt, def.alpha * 0.5);
        g.fillCircle(w * 0.25, h * 0.3, 60);
        g.fillStyle(def.alt, def.alpha * 0.8);
        g.fillCircle(w * 0.25, h * 0.3, 40);
        break;
      }
      case 'mountains':
        for (let i = -1; i < 7; i++) {
          const x = i * 260 + 40;
          const peak = floor - 140 - ((i * 73) % 130);
          g.fillStyle(i % 2 ? def.alt : def.color, def.alpha);
          g.fillTriangle(x - 190, floor + 40, x, peak, x + 190, floor + 40);
          // snow-cap / lit ridge
          g.fillStyle(def.alt, def.alpha * 0.5);
          g.fillTriangle(x - 46, floor + 40 - 46, x, peak, x + 46, floor + 40 - 46);
        }
        break;
      case 'pillars':
        for (let i = 0; i < 7; i++) {
          const x = 60 + i * 190;
          const hgt = 330;
          // body with vertical gradient (top catches the light)
          g.fillStyle(i % 2 ? def.alt : def.color, def.alpha);
          g.fillRect(x, floor - hgt, 46, hgt);
          g.fillStyle(0xffffff, def.alpha * 0.08);
          g.fillRect(x, floor - hgt, 46, hgt * 0.3);
          g.fillStyle(0x000000, def.alpha * 0.18);
          g.fillRect(x, floor - hgt * 0.4, 46, hgt * 0.4);
          // neon rim strip on the light side
          g.lineStyle(3, this.arena.accent, def.alpha * 0.5);
          g.lineBetween(x + 2, floor - hgt + 6, x + 2, floor - 24);
          // cap / base blocks
          g.fillStyle(def.alt, def.alpha * 0.8);
          g.fillRect(x - 8, floor - hgt - 10, 62, 16);
          g.fillRect(x - 8, floor - 20, 62, 20);
          // glowing window pairs on alternating pillars
          if (i % 2 === 1) {
            g.fillStyle(this.arena.accent, 0.4);
            g.fillRect(x + 14, floor - hgt + 60, 18, 8);
            g.fillRect(x + 14, floor - hgt + 110, 18, 8);
            g.fillRect(x + 14, floor - hgt + 160, 18, 8);
          }
        }
        break;
      case 'arches':
        for (let i = 0; i < 5; i++) {
          const x = 110 + i * 270;
          g.lineStyle(14, def.color, def.alpha);
          g.beginPath();
          g.arc(x, floor - 170, 86, Math.PI, 0, false);
          g.strokePath();
          // inner neon arc
          g.lineStyle(3, this.arena.accent, def.alpha * 0.45);
          g.beginPath();
          g.arc(x, floor - 170, 74, Math.PI, 0, false);
          g.strokePath();
          g.fillStyle(def.alt, def.alpha * 0.7);
          g.fillRect(x - 93, floor - 170, 14, 170);
          g.fillRect(x + 79, floor - 170, 14, 170);
          // hanging lantern glow under alternating arches
          if (i % 2 === 1) {
            g.fillStyle(this.arena.accent, 0.16);
            g.fillCircle(x, floor - 150, 34);
            g.fillStyle(this.arena.accent, 0.85);
            g.fillCircle(x, floor - 150, 7);
            g.lineStyle(2, def.alt, 0.6);
            g.lineBetween(x, floor - 258, x, floor - 158);
          }
        }
        break;
      case 'cracks':
        for (let i = 0; i < 16; i++) {
          const x = (i * 97) % w;
          const y = floor - 30 - ((i * 53) % 260);
          g.lineStyle(2 + (i % 3), i % 2 ? def.alt : def.color, def.alpha * 0.8);
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x + 24 - (i % 5) * 9, y + 60);
          g.lineTo(x + 8, y + 120);
          g.strokePath();
        }
        break;
      case 'runes':
        for (let i = 0; i < 12; i++) {
          const x = 70 + i * 105;
          const y = 90 + ((i * 61) % 240);
          g.lineStyle(2.4, i % 2 ? def.alt : def.color, def.alpha);
          g.strokeCircle(x, y, 16 + (i % 4) * 5);
          g.strokeRect(x - 9, y - 9, 18, 18);
        }
        break;
      case 'embers':
      case 'motes':
      case 'fog':
      default:
        for (let i = 0; i < 10; i++) {
          g.fillStyle(i % 2 ? def.alt : def.color, def.alpha * 0.25);
          g.fillEllipse((i * 151) % w, floor - 60 - ((i * 37) % 180), 260, 70);
        }
        break;
    }
  }

  update(dt: number, cameraX: number): void {
    this.t += dt;
    for (const l of this.layers) {
      l.gfx.x = -cameraX * l.def.parallax;
      if (l.def.kind === 'runes' || l.def.kind === 'motes') {
        l.gfx.y = Math.sin(this.t / 1400) * 10;
      }
    }
    const g = this.particleGfx;
    g.clear();
    const dtS = dt / 1000;
    const col = this.arena.particle.color;
    for (const p of this.particles) {
      p.x += p.vx * dtS;
      p.y += p.vy * dtS;
      if (p.y < -20 || p.y > this.height + 20 || p.x < -60 || p.x > this.width + 60) {
        Object.assign(p, this.makeParticle(false));
      }
      g.fillStyle(col, p.a * 0.35);
      g.fillCircle(p.x, p.y, p.r * 3);
      g.fillStyle(col, p.a);
      g.fillCircle(p.x, p.y, p.r);
    }
  }

  destroy(): void {
    for (const l of this.layers) l.gfx.destroy();
    this.layers = [];
    this.particleGfx.destroy();
    this.floorGfx.destroy();
  }
}

function mix(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}

function shade(c: number, k: number): number {
  const r = Math.min(255, Math.round(((c >> 16) & 0xff) * k));
  const g = Math.min(255, Math.round(((c >> 8) & 0xff) * k));
  const b = Math.min(255, Math.round((c & 0xff) * k));
  return (r << 16) | (g << 8) | b;
}
