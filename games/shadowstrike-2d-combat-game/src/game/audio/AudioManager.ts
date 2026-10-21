/**
 * SHADOWSTRIKE — procedural audio (Web Audio API).
 * All sounds are synthesised at runtime: no external audio files, so there are
 * never broken asset paths. Honours master/music/sfx volumes and autoplay rules.
 */

export type Sfx =
  | 'swing' | 'swing_heavy' | 'hit' | 'hit_heavy' | 'block' | 'guardbreak'
  | 'deflect'
  | 'dodge' | 'jump' | 'fire' | 'laser' | 'summon' | 'explode'
  | 'victory' | 'defeat' | 'ui' | 'countdown';

class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicTimer: number | null = null;
  private lastPlayed = new Map<string, number>();
  private enabled = true;
  volumes = { master: 0.7, music: 0.45, sfx: 0.8 };

  init(): void {
    if (this.ctx) { void this.ctx.resume(); return; }
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain.connect(this.master);
      this.sfxGain.connect(this.master);
      this.master.connect(this.ctx.destination);
      this.applyVolumes();
    } catch {
      this.enabled = false;
    }
  }

  setVolumes(v: { master: number; music: number; sfx: number }): void {
    this.volumes = v;
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.master || !this.musicGain || !this.sfxGain) return;
    this.master.gain.value = this.volumes.master;
    this.musicGain.gain.value = this.volumes.music * 0.4;
    this.sfxGain.gain.value = this.volumes.sfx;
  }

  private noiseBuffer(dur: number): AudioBuffer | null {
    if (!this.ctx) return null;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    return buf;
  }

  play(name: Sfx, pitch = 1): void {
    if (!this.enabled) return;
    if (!this.ctx) this.init();
    const ctx = this.ctx;
    if (!ctx || !this.sfxGain) return;
    if (ctx.state === 'suspended') void ctx.resume();

    // throttle identical sounds
    const now = performance.now();
    const last = this.lastPlayed.get(name) ?? 0;
    if (now - last < 35) return;
    this.lastPlayed.set(name, now);

    const t = ctx.currentTime;
    const out = this.sfxGain;

    const tone = (freq: number, dur: number, type: OscillatorType, gain: number, slideTo?: number) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq * pitch, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo * pitch), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g); g.connect(out);
      osc.start(t); osc.stop(t + dur + 0.02);
    };

    const noise = (dur: number, gain: number, filterFreq: number, sweepTo?: number) => {
      const buf = this.noiseBuffer(dur);
      if (!buf) return;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const flt = ctx.createBiquadFilter();
      flt.type = 'bandpass';
      flt.frequency.setValueAtTime(filterFreq, t);
      if (sweepTo) flt.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(flt); flt.connect(g); g.connect(out);
      src.start(t); src.stop(t + dur);
    };

    switch (name) {
      case 'swing': noise(0.16, 0.25, 900, 2600); break;
      case 'swing_heavy': noise(0.3, 0.4, 420, 1600); tone(90, 0.22, 'sine', 0.2, 50); break;
      case 'hit': tone(180, 0.16, 'square', 0.22, 70); noise(0.1, 0.3, 1400); break;
      case 'hit_heavy': tone(90, 0.3, 'sawtooth', 0.32, 40); noise(0.2, 0.4, 600); break;
      case 'block': tone(760, 0.12, 'square', 0.18, 420); noise(0.08, 0.2, 3200); break;
      case 'deflect': tone(1500, 0.16, 'square', 0.18, 3200); noise(0.07, 0.2, 5600); break;
      case 'guardbreak': tone(300, 0.4, 'sawtooth', 0.3, 80); noise(0.3, 0.35, 900); break;
      case 'dodge': noise(0.18, 0.18, 2200, 500); break;
      case 'jump': tone(320, 0.12, 'sine', 0.14, 620); break;
      case 'fire': tone(220, 0.35, 'sawtooth', 0.22, 680); noise(0.3, 0.2, 800, 2400); break;
      case 'laser': tone(1200, 0.5, 'sawtooth', 0.14, 300); tone(620, 0.5, 'square', 0.1, 220); break;
      case 'summon': tone(140, 0.5, 'triangle', 0.2, 540); tone(280, 0.5, 'sine', 0.12, 1080); break;
      case 'explode': noise(0.5, 0.45, 300, 90); tone(70, 0.45, 'sine', 0.3, 35); break;
      case 'victory': [523, 659, 784, 1046].forEach((f, i) => window.setTimeout(() => tone(f, 0.4, 'triangle', 0.2), i * 110)); break;
      case 'defeat': [392, 330, 262, 196].forEach((f, i) => window.setTimeout(() => tone(f, 0.5, 'sine', 0.2), i * 150)); break;
      case 'ui': tone(880, 0.06, 'square', 0.07, 1200); break;
      case 'countdown': tone(440 * pitch, 0.18, 'square', 0.16); break;
    }
  }

  startMusic(mood: 'menu' | 'combat' = 'menu'): void {
    if (!this.enabled) return;
    if (!this.ctx) this.init();
    const ctx = this.ctx;
    if (!ctx || !this.musicGain) return;
    this.stopMusic();
    const root = mood === 'combat' ? 110 : 82.4;
    const scale = [0, 3, 5, 7, 10, 12];
    let step = 0;
    const beat = mood === 'combat' ? 260 : 420;
    const tick = () => {
      if (!this.ctx || !this.musicGain) return;
      const t = this.ctx.currentTime;
      const deg = scale[(step * 3) % scale.length];
      const freq = root * Math.pow(2, deg / 12);
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = step % 4 === 0 ? 'triangle' : 'sine';
      osc.frequency.value = freq * (step % 8 < 4 ? 1 : 2);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t + beat / 1000);
      osc.connect(g); g.connect(this.musicGain);
      osc.start(t); osc.stop(t + beat / 1000 + 0.05);
      if (step % 4 === 0) {
        const b = this.ctx.createOscillator();
        const bg = this.ctx.createGain();
        b.type = 'sine'; b.frequency.setValueAtTime(root / 2, t);
        bg.gain.setValueAtTime(0.3, t);
        bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
        b.connect(bg); bg.connect(this.musicGain);
        b.start(t); b.stop(t + 0.32);
      }
      step++;
    };
    this.musicTimer = window.setInterval(tick, beat);
  }

  stopMusic(): void {
    if (this.musicTimer !== null) { window.clearInterval(this.musicTimer); this.musicTimer = null; }
  }

  suspend(): void { void this.ctx?.suspend(); }
  resume(): void { void this.ctx?.resume(); }
}

export const audio = new Audio();
