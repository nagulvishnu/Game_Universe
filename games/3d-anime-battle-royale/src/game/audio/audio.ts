import type { Game } from '../engine/Game';
import type { SoundEvent } from '../engine/types';

// Fully procedural audio (Web Audio API): no external assets, works offline.
class AudioManager {
  ctx: AudioContext | null = null;
  master!: GainNode; music!: GainNode; sfx!: GainNode;
  noiseBuf!: AudioBuffer;
  musicVol = 0.5; sfxVol = 0.8;
  private musicTimer: number | null = null;
  private step = 0;
  private nextT = 0;
  private mode: 'menu' | 'battle' | 'off' = 'off';
  private windG: GainNode | null = null; private droneG: GainNode | null = null; private engG: GainNode | null = null; private engO: OscillatorNode | null = null; private ambG: GainNode | null = null;
  private lx = 0; private lz = 0; private lyaw = 0;
  private active = 0;

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!C) return;
    const ctx = new C();
    this.ctx = ctx;
    this.master = ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(ctx.destination);
    this.music = ctx.createGain(); this.music.gain.value = this.musicVol * 0.35; this.music.connect(this.master);
    this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(this.master);
    this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const loop = (filterType: BiquadFilterType, freq: number) => {
      const s = ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
      const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq;
      const g = ctx.createGain(); g.gain.value = 0;
      s.connect(f); f.connect(g); g.connect(this.sfx); s.start();
      return g;
    };
    this.windG = loop('bandpass', 700);
    this.ambG = loop('lowpass', 380);
    // plane drone
    this.droneG = ctx.createGain(); this.droneG.gain.value = 0; this.droneG.connect(this.sfx);
    for (const fr of [62, 63.5, 124]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260; o.connect(f); f.connect(this.droneG); o.start(); }
    // engine
    this.engO = ctx.createOscillator(); this.engO.type = 'sawtooth'; this.engO.frequency.value = 50;
    const ef = ctx.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 500;
    this.engG = ctx.createGain(); this.engG.gain.value = 0; this.engO.connect(ef); ef.connect(this.engG); this.engG.connect(this.sfx); this.engO.start();
  }

  setVolumes(music: number, sfx: number) {
    this.musicVol = music; this.sfxVol = sfx;
    if (this.ctx) { this.music.gain.value = music * 0.35; this.sfx.gain.value = sfx; }
  }

  /* ---- music: generative anime-action loop ---- */
  startMusic(mode: 'menu' | 'battle') {
    this.init();
    if (!this.ctx) return;
    this.mode = mode;
    if (this.musicTimer) return;
    this.nextT = this.ctx.currentTime + 0.1; this.step = 0;
    this.musicTimer = window.setInterval(() => this.schedule(), 100);
  }
  stopMusic() { if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; } this.mode = 'off'; }
  private schedule() {
    const ctx = this.ctx!;
    const bpm = this.mode === 'battle' ? 124 : 104;
    const sd = 60 / bpm / 2;
    const roots = [57, 53, 60, 55]; // A F C G
    while (this.nextT < ctx.currentTime + 0.3) {
      const s = this.step, bar = Math.floor(s / 16) % 4, pos = s % 16;
      const root = roots[bar];
      const f = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
      const t = this.nextT;
      const minor = bar === 0 || bar === 1 ? [0, 3, 7, 12] : [0, 4, 7, 12];
      const arp = [0, 1, 2, 3, 2, 1, 2, 3];
      if (pos % 2 === 0) this.tone(f(root + 12 + minor[arp[(pos / 2) % 8]]), t, sd * 1.6, 'triangle', 0.16, this.music);
      if (pos % 4 === 0) this.tone(f(root - 12), t, sd * 3, 'sawtooth', 0.12, this.music, 320);
      if (this.mode === 'battle') {
        if (pos % 4 === 0) this.kick(t);
        if (pos % 2 === 1) this.hat(t);
        if (pos === 0 || pos === 8) this.tone(f(root + 24 + (pos ? 7 : 0)), t, sd * 4, 'square', 0.05, this.music, 1800);
      } else if (pos % 8 === 0) this.tone(f(root + 19), t, sd * 7, 'sine', 0.1, this.music);
      this.nextT += sd; this.step++;
    }
  }
  private tone(freq: number, t: number, dur: number, type: OscillatorType, vol: number, dest: AudioNode, lp = 4000) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp;
    o.connect(f); f.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }
  private kick(t: number) {
    const ctx = this.ctx!; const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
    g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18); o.connect(g); g.connect(this.music); o.start(t); o.stop(t + 0.2);
  }
  private hat(t: number) {
    const ctx = this.ctx!; const s = ctx.createBufferSource(); s.buffer = this.noiseBuf; const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.04); s.connect(f); f.connect(g); g.connect(this.music); s.start(t, Math.random()); s.stop(t + 0.05);
  }

  /* ---- positional one-shots ---- */
  private route(x: number | null, z: number | null, vol: number): AudioNode | null {
    const ctx = this.ctx!;
    if (this.active > 40) return null;
    const g = ctx.createGain();
    let pan = 0, att = 1;
    if (x !== null && z !== null) {
      const dx = x - this.lx, dz = z - this.lz, d = Math.hypot(dx, dz);
      att = 1 / (1 + d / 18);
      const rx = -Math.cos(this.lyaw), rz = Math.sin(this.lyaw);
      pan = d > 0.1 ? Math.max(-1, Math.min(1, (dx * rx + dz * rz) / Math.max(d, 4))) : 0;
      if (d > 500) return null;
    }
    g.gain.value = vol * att;
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    g.connect(p); p.connect(this.sfx);
    this.active++; setTimeout(() => { this.active--; }, 600);
    return g;
  }
  private noise(dest: AudioNode, t: number, dur: number, type: BiquadFilterType, f0: number, f1: number, vol: number) {
    const ctx = this.ctx!; const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    s.connect(f); f.connect(g); g.connect(dest); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  private thump(dest: AudioNode, t: number, f0: number, dur: number, vol: number) {
    const ctx = this.ctx!; const o = ctx.createOscillator(); o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(30, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.02);
  }

  play(e: SoundEvent) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const ctx = this.ctx, t = ctx.currentTime;
    switch (e.k) {
      case 'shot': {
        const d = this.route(e.x, e.z, e.own ? 0.9 : 1.1); if (!d) return;
        if (e.sup) { this.noise(d, t, 0.09, 'lowpass', 1400, 400, 0.35); this.thump(d, t, 200, 0.06, 0.2); }
        else { this.noise(d, t, e.len + 0.05, 'bandpass', 2600 * e.pitch, 300, 0.9 * e.noise); this.thump(d, t, e.f * 2.2, e.len + 0.06, 0.8); if (e.len > 0.2) this.noise(d, t + 0.02, 0.5, 'lowpass', 900, 100, 0.3); }
        break;
      }
      case 'impact': { const d = this.route(e.x, e.z, 0.25); if (d) this.noise(d, t, 0.06, 'highpass', 3000, 1500, 0.4); break; }
      case 'explosion': { const d = this.route(e.x, e.z, 1.8); if (d) { this.noise(d, t, 1.3, 'lowpass', 2200, 80, 1); this.thump(d, t, 110, 0.7, 1.2); } break; }
      case 'step': { const d = this.route(e.x, e.z, e.run ? 0.35 : 0.2); if (d) this.noise(d, t, 0.07, 'bandpass', 500 + Math.random() * 250, 200, 0.7); break; }
      case 'reload': { const d = this.route(e.x, e.z, 0.5); if (d) { this.tone(900, t, 0.04, 'square', 0.3, d, 3000); this.tone(500, t + 0.12, 0.05, 'square', 0.3, d, 2000); } break; }
      case 'land': { const d = this.route(e.x, e.z, 0.7); if (d) { this.noise(d, t, 0.15, 'lowpass', 600, 100, 0.8); this.thump(d, t, 90, 0.12, 0.5); } break; }
      case 'throw': { const d = this.route(e.x, e.z, 0.4); if (d) this.noise(d, t, 0.2, 'bandpass', 1200, 400, 0.4); break; }
      case 'chute': { const d = this.route(e.x, e.z, 0.8); if (d) this.noise(d, t, 0.7, 'bandpass', 400, 2200, 0.9); break; }
      case 'pickup': { const d = this.route(null, null, 0.5); if (d) { this.tone(660, t, 0.08, 'triangle', 0.4, d); this.tone(990, t + 0.07, 0.1, 'triangle', 0.4, d); } break; }
      case 'click': { const d = this.route(null, null, 0.4); if (d) this.tone(1200, t, 0.03, 'square', 0.2, d, 3000); break; }
      case 'heal': { const d = this.route(null, null, 0.5); if (d) { this.tone(520, t, 0.2, 'sine', 0.4, d); this.tone(780, t + 0.12, 0.3, 'sine', 0.4, d); } break; }
      case 'hit': { const d = this.route(null, null, 0.6); if (d) this.tone(e.head ? 1500 : 900, t, 0.07, 'sine', 0.5, d); break; }
      case 'kill': { const d = this.route(null, null, 0.7); if (d) { this.tone(700, t, 0.12, 'square', 0.3, d, 3000); this.tone(1050, t + 0.1, 0.25, 'square', 0.3, d, 3000); } break; }
      case 'zone': { const d = this.route(null, null, 0.6); if (d) { for (let i = 0; i < 3; i++) { this.tone(880, t + i * 0.4, 0.2, 'sawtooth', 0.25, d, 2500); this.tone(660, t + i * 0.4 + 0.2, 0.2, 'sawtooth', 0.25, d, 2500); } } break; }
    }
  }

  victory() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => this.tone(440 * Math.pow(2, (n + 3) / 12), t + i * 0.12, 0.7, 'triangle', 0.3, this.sfx));
  }

  update(g: Game | null, pos: { x: number; y: number; z: number } | null, yaw: number) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    if (g && pos) {
      this.lx = pos.x; this.lz = pos.z; this.lyaw = yaw;
      for (const e of g.sndQ) this.play(e);
      g.sndQ.length = 0;
      const p = g.player;
      const inAir = p.state === 'freefall' ? 1 : p.state === 'chute' ? 0.35 : 0;
      this.windG!.gain.setTargetAtTime(inAir * 0.35, t, 0.2);
      const pd = Math.hypot(g.plane.pos.x - pos.x, g.plane.pos.z - pos.z);
      this.droneG!.gain.setTargetAtTime(g.mode === 'match' && g.plane.active ? (p.state === 'plane' ? 0.14 : Math.max(0, 0.12 - pd / 3500)) : 0, t, 0.3);
      this.ambG!.gain.setTargetAtTime(p.state === 'plane' ? 0.02 : 0.06, t, 0.5);
      if (p.state === 'vehicle' && p.vehicle) { this.engG!.gain.setTargetAtTime(0.12, t, 0.1); this.engO!.frequency.setTargetAtTime(45 + Math.abs(p.vehicle.speed) * 4.5, t, 0.08); }
      else this.engG!.gain.setTargetAtTime(0, t, 0.1);
    } else {
      this.windG?.gain.setTargetAtTime(0, t, 0.2); this.droneG?.gain.setTargetAtTime(0, t, 0.2); this.engG?.gain.setTargetAtTime(0, t, 0.1); this.ambG?.gain.setTargetAtTime(0.01, t, 0.5);
    }
  }

  dispose() { this.stopMusic(); if (this.ctx) { void this.ctx.close(); this.ctx = null; } }
}

export const audio = new AudioManager();
