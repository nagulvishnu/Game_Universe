/** SHADOWSTRIKE — pooled 2D visual effects: sparks, rings, trails, damage numbers. */

import Phaser from 'phaser';

export function ensureTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists('ss_spark')) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 1); g.fillCircle(8, 8, 8);
    g.generateTexture('ss_spark', 16, 16);
    g.destroy();
  }
  if (!scene.textures.exists('ss_shard')) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 1); g.fillTriangle(6, 0, 12, 16, 0, 16);
    g.generateTexture('ss_shard', 12, 16);
    g.destroy();
  }
  if (!scene.textures.exists('ss_soft')) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    for (let i = 12; i > 0; i--) {
      g.fillStyle(0xffffff, 0.08);
      g.fillCircle(16, 16, i * 1.33);
    }
    g.generateTexture('ss_soft', 32, 32);
    g.destroy();
  }
}

interface TrailSegment {
  pts: { x: number; y: number }[];
  color: number;
  life: number;
  maxLife: number;
  width: number;
}

export class Effects {
  private scene: Phaser.Scene;
  private trailGfx: Phaser.GameObjects.Graphics;
  private ringGfx: Phaser.GameObjects.Graphics;
  private trails: TrailSegment[] = [];
  private rings: { x: number; y: number; r: number; max: number; color: number; life: number; maxLife: number; width: number }[] = [];
  private texts: Phaser.GameObjects.Text[] = [];
  private emitters = new Map<number, Phaser.GameObjects.Particles.ParticleEmitter>();
  reducedMotion = false;
  shakeEnabled = true;
  showDamageNumbers = true;
  quality: 'low' | 'medium' | 'high' = 'high';

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    ensureTextures(scene);
    this.trailGfx = scene.add.graphics().setDepth(25);
    this.ringGfx = scene.add.graphics().setDepth(26);
  }

  private emitter(color: number): Phaser.GameObjects.Particles.ParticleEmitter {
    let e = this.emitters.get(color);
    if (!e) {
      e = this.scene.add.particles(0, 0, 'ss_spark', {
        lifespan: 420, speed: { min: 60, max: 280 }, scale: { start: 0.55, end: 0 },
        alpha: { start: 1, end: 0 }, blendMode: 'ADD', gravityY: 420, emitting: false, tint: color,
      });
      e.setDepth(30);
      this.emitters.set(color, e);
    }
    return e;
  }

  private get densityMul(): number {
    if (this.reducedMotion) return 0.35;
    return this.quality === 'low' ? 0.45 : this.quality === 'medium' ? 0.75 : 1;
  }

  hitSpark(x: number, y: number, color: number, power = 1): void {
    const n = Math.round(Phaser.Math.Clamp(6 + power * 10, 4, 26) * this.densityMul);
    this.emitter(color).emitParticleAt(x, y, n);
    this.ring(x, y, color, 10 + power * 22, 220, 3);
  }

  slashSpark(x: number, y: number, color: number, power = 1): void {
    const n = Math.round(Phaser.Math.Clamp(8 + power * 12, 6, 28) * this.densityMul);
    const e = this.emitter(color);
    e.speed = { min: 80 * power, max: 340 * power };
    e.emitParticleAt(x, y, n);
    this.ring(x, y, 0xffffff, 8 + power * 16, 160, 2);
    this.ring(x, y, color, 16 + power * 24, 220, 3);
  }

  bluntImpact(x: number, y: number, color: number, power = 1): void {
    const n = Math.round(Phaser.Math.Clamp(12 + power * 14, 8, 34) * this.densityMul);
    const e = this.emitter(color);
    e.speed = { min: 40, max: 240 * power };
    e.emitParticleAt(x, y, n);
    // Double shockwave rings
    this.ring(x, y, color, 24 + power * 28, 280, 5);
    this.ring(x, y, 0xffe066, 14 + power * 18, 200, 3);
  }

  energyBurst(x: number, y: number, color: number, power = 1): void {
    const n = Math.round(Phaser.Math.Clamp(10 + power * 12, 6, 30) * this.densityMul);
    const e = this.emitter(color);
    e.speed = { min: 100 * power, max: 400 * power };
    e.emitParticleAt(x, y, n);
    this.ring(x, y, 0xffffff, 18 + power * 20, 180, 2);
    this.ring(x, y, color, 28 + power * 32, 260, 4);
  }

  burst(x: number, y: number, color: number, count = 18, speed = 320): void {
    const e = this.emitter(color);
    e.speed = { min: speed * 0.3, max: speed };
    e.emitParticleAt(x, y, Math.round(count * this.densityMul));
  }

  explosion(x: number, y: number, color: number, radius = 60): void {
    this.burst(x, y, color, 26, radius * 6);
    this.ring(x, y, color, radius, 360, 5);
    this.ring(x, y, 0xffffff, radius * 0.6, 240, 2);
  }

  ring(x: number, y: number, color: number, max: number, life = 300, width = 3): void {
    if (this.rings.length > 60) this.rings.shift();
    this.rings.push({ x, y, r: max * 0.25, max, color, life, maxLife: life, width });
  }

  trail(points: { x: number; y: number }[], color: number, width = 5, life = 180): void {
    if (this.reducedMotion || points.length < 2) return;
    if (this.trails.length > 40) this.trails.shift();
    this.trails.push({ pts: points.map((p) => ({ ...p })), color, life, maxLife: life, width });
  }

  damageNumber(x: number, y: number, amount: number, color = 0xffffff, big = false): void {
    if (!this.showDamageNumbers) return;
    const txt = this.texts.pop() ?? this.scene.add.text(0, 0, '', {
      fontFamily: 'Impact, system-ui, sans-serif', fontSize: '22px', color: '#ffffff',
      stroke: '#000000', strokeThickness: 4,
    }).setDepth(60).setOrigin(0.5);
    txt.setText(String(Math.round(amount)));
    txt.setColor('#' + color.toString(16).padStart(6, '0'));
    txt.setFontSize(big ? 34 : 22);
    txt.setPosition(x + Phaser.Math.Between(-10, 10), y);
    txt.setAlpha(1);
    txt.setActive(true).setVisible(true);
    txt.setScale(big ? 1.3 : 1);
    this.scene.tweens.add({
      targets: txt, y: y - (big ? 70 : 48), alpha: 0, duration: big ? 900 : 650, ease: 'Cubic.easeOut',
      onComplete: () => { txt.setVisible(false).setActive(false); this.texts.push(txt); },
    });
  }

  floatingText(x: number, y: number, text: string, color = '#ffffff'): void {
    const t = this.scene.add.text(x, y, text, {
      fontFamily: 'system-ui, sans-serif', fontSize: '18px', color, stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(60);
    this.scene.tweens.add({ targets: t, y: y - 40, alpha: 0, duration: 900, onComplete: () => t.destroy() });
  }

  shake(intensity = 0.006, duration = 120): void {
    if (!this.shakeEnabled || this.reducedMotion) return;
    this.scene.cameras.main.shake(duration, intensity);
  }

  flashScreen(color = 0xffffff, alpha = 0.3, duration = 120): void {
    if (this.reducedMotion) return;
    this.scene.cameras.main.flash(duration, (color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff, false, undefined, alpha);
  }

  update(dt: number): void {
    // Multi-pass glowing trails
    const tg = this.trailGfx;
    tg.clear();
    for (let i = this.trails.length - 1; i >= 0; i--) {
      const t = this.trails[i];
      t.life -= dt;
      if (t.life <= 0) { this.trails.splice(i, 1); continue; }
      const a = t.life / t.maxLife;

      // Layer 1: Soft wide outer glow aura
      tg.lineStyle(t.width * a * 1.8 + 2, t.color, a * 0.3);
      tg.beginPath();
      tg.moveTo(t.pts[0].x, t.pts[0].y);
      for (let p = 1; p < t.pts.length; p++) tg.lineTo(t.pts[p].x, t.pts[p].y);
      tg.strokePath();

      // Layer 2: Saturated blade trail body
      tg.lineStyle(t.width * a + 1, t.color, a * 0.85);
      tg.beginPath();
      tg.moveTo(t.pts[0].x, t.pts[0].y);
      for (let p = 1; p < t.pts.length; p++) tg.lineTo(t.pts[p].x, t.pts[p].y);
      tg.strokePath();

      // Layer 3: Crisp razor cutting edge / core
      tg.lineStyle(Math.max(1, t.width * a * 0.32), 0xffffff, a * 0.95);
      tg.beginPath();
      tg.moveTo(t.pts[0].x, t.pts[0].y);
      for (let p = 1; p < t.pts.length; p++) tg.lineTo(t.pts[p].x, t.pts[p].y);
      tg.strokePath();
    }
    // rings
    const rg = this.ringGfx;
    rg.clear();
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      if (r.life <= 0) { this.rings.splice(i, 1); continue; }
      const p = 1 - r.life / r.maxLife;
      rg.lineStyle(r.width * (1 - p) + 0.5, r.color, (1 - p) * 0.9);
      rg.strokeCircle(r.x, r.y, r.r + (r.max - r.r) * p);
    }
  }

  destroy(): void {
    this.trailGfx.destroy();
    this.ringGfx.destroy();
    for (const e of this.emitters.values()) e.destroy();
    this.emitters.clear();
    for (const t of this.texts) t.destroy();
    this.texts = [];
    this.trails = [];
    this.rings = [];
  }
}
