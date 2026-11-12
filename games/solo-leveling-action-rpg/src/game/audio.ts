// Procedural WebAudio engine: SFX, adaptive music, ambience. All original synthesized audio.
import { bus, useGame } from './store';

type Mode = 'none' | 'menu' | 'city' | 'temple' | 'cave' | 'boss' | 'penalty' | 'arena';
class AudioSys {
  ctx: AudioContext | null = null;
  master!: GainNode;
  musicG!: GainNode;
  sfxG!: GainNode;
  ambG!: GainNode;
  noiseBuf!: AudioBuffer;
  mode: Mode = 'none';
  step = 0;
  timer: any = null;
  ambSrc: AudioBufferSourceNode | null = null;
  ambFilter!: BiquadFilterNode;
  ambGain!: GainNode;
  lastStep = 0;
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const C = window.AudioContext || (window as any).webkitAudioContext;
    if (!C) return;
    this.ctx = new C();
    const c = this.ctx;
    this.master = c.createGain();
    this.master.connect(c.destination);
    this.musicG = c.createGain();
    this.sfxG = c.createGain();
    this.ambG = c.createGain();
    [this.musicG, this.sfxG, this.ambG].forEach((g) => g.connect(this.master));
    const len = c.sampleRate * 2;
    this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.ambFilter = c.createBiquadFilter();
    this.ambFilter.type = 'lowpass';
    this.ambGain = c.createGain();
    this.ambGain.gain.value = 0;
    this.ambSrc = c.createBufferSource();
    this.ambSrc.buffer = this.noiseBuf;
    this.ambSrc.loop = true;
    this.ambSrc.connect(this.ambFilter);
    this.ambFilter.connect(this.ambGain);
    this.ambGain.connect(this.ambG);
    this.ambSrc.start();
    this.applyVolumes();
    this.timer = setInterval(() => this.tick(), 120);
  }
  applyVolumes() {
    if (!this.ctx) return;
    const s = useGame.getState().settings;
    this.master.gain.value = s.master;
    this.musicG.gain.value = s.music * 0.5;
    this.sfxG.gain.value = s.sfx;
    this.ambG.gain.value = s.amb * 0.6;
  }
  tone(f: number, dur: number, type: OscillatorType = 'sine', vol = 0.2, slide = 0, delay = 0, dest?: AudioNode) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest || this.sfxG);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  noise(dur: number, vol = 0.2, type: BiquadFilterType = 'lowpass', f = 1000, fTo = 0, delay = 0, dest?: AudioNode) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + delay;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const fl = c.createBiquadFilter();
    const g = c.createGain();
    fl.type = type;
    fl.frequency.setValueAtTime(f, t);
    if (fTo) fl.frequency.exponentialRampToValueAtTime(fTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl);
    fl.connect(g);
    g.connect(dest || this.sfxG);
    s.start(t, Math.random());
    s.stop(t + dur + 0.05);
  }
  sfx(n: string, p = 0) {
    if (!this.ctx) return;
    const r = Math.random();
    switch (n) {
      case 'swing':
        this.noise(0.14, 0.18, 'bandpass', 1800 + p * 300, 600);
        break;
      case 'hit':
        this.noise(0.12, 0.3, 'lowpass', 2200, 300);
        this.tone(140 + r * 40, 0.12, 'square', 0.12, -80);
        this.tone(52 + r * 16, 0.14, 'sine', 0.22, -18);
        this.noise(0.05, 0.16, 'highpass', 3600 + r * 1200);
        break;
      case 'crit':
        this.noise(0.2, 0.4, 'highpass', 1500, 4000);
        this.tone(220, 0.2, 'sawtooth', 0.18, -150);
        this.tone(880, 0.15, 'triangle', 0.1, 400);
        this.tone(48, 0.24, 'sine', 0.3, -16);
        this.tone(2100 + r * 400, 0.18, 'sine', 0.05, -900);
        break;
      case 'hurt':
        this.tone(110, 0.25, 'sawtooth', 0.22, -60);
        this.noise(0.15, 0.25, 'lowpass', 800, 200);
        break;
      case 'step':
        this.noise(0.05, 0.05 + p * 0.03, 'lowpass', 500 + r * 300);
        break;
      case 'dash':
        this.noise(0.3, 0.25, 'bandpass', 3000, 400);
        this.tone(300, 0.25, 'sine', 0.1, 500);
        break;
      case 'jump':
        this.tone(200, 0.15, 'sine', 0.1, 220);
        break;
      case 'system':
        this.tone(1320, 0.25, 'sine', 0.12);
        this.tone(1760, 0.35, 'sine', 0.1, 0, 0.09);
        this.tone(2640, 0.4, 'sine', 0.04, 0, 0.09);
        break;
      case 'levelup':
        [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.14, 0, i * 0.08));
        this.noise(0.9, 0.08, 'highpass', 4000);
        break;
      case 'questdone':
        [784, 988, 1175].forEach((f, i) => this.tone(f, 0.4, 'sine', 0.13, 0, i * 0.1));
        break;
      case 'coin':
        this.tone(1568, 0.1, 'square', 0.06);
        this.tone(2093, 0.2, 'square', 0.06, 0, 0.07);
        break;
      case 'ui':
        this.tone(900, 0.06, 'square', 0.04);
        break;
      case 'roar':
        this.tone(70 + p * 30, 1.0, 'sawtooth', 0.28, -30);
        this.tone(105, 1.0, 'square', 0.1, -50);
        this.noise(1.0, 0.25, 'lowpass', 600, 150);
        break;
      case 'growl':
        this.tone(95 + r * 40, 0.4, 'sawtooth', 0.12, -30);
        break;
      case 'boom':
        this.noise(0.8, 0.5, 'lowpass', 900, 60);
        this.tone(60, 0.7, 'sine', 0.4, -40);
        break;
      case 'slam':
        this.noise(0.5, 0.45, 'lowpass', 700, 50);
        this.tone(55, 0.5, 'sine', 0.45, -30);
        this.tone(38, 0.7, 'sine', 0.3, -12, 0.02);
        this.noise(0.2, 0.18, 'highpass', 2400, 900, 0.01);
        break;
      case 'bolt':
        this.noise(0.5, 0.35, 'highpass', 2000, 6000);
        this.tone(1200, 0.3, 'sawtooth', 0.1, -1000);
        break;
      case 'arise':
        this.tone(55, 3, 'sawtooth', 0.25, 20);
        this.tone(82.4, 3, 'sawtooth', 0.15, 8);
        this.tone(41.2, 3.4, 'sine', 0.28, 10, 0.05);
        [220, 277.2, 329.6, 440, 554.4].forEach((f, i) => this.tone(f, 2.4, 'sine', 0.1, 0, 0.35 + i * 0.12));
        this.noise(2.4, 0.3, 'bandpass', 200, 3000, 0.2);
        this.noise(0.9, 0.12, 'highpass', 5000, 9000, 1.1);
        break;
      case 'extract':
        this.noise(1.6, 0.35, 'bandpass', 120, 1500);
        this.tone(48, 1.8, 'sine', 0.35, 30);
        this.tone(96, 1.6, 'triangle', 0.1, 150);
        this.tone(240, 1.2, 'sine', 0.05, 900, 0.35);
        break;
      case 'summon':
        this.noise(0.9, 0.3, 'lowpass', 200, 1800);
        this.tone(70, 0.9, 'sawtooth', 0.15, 80);
        this.tone(140, 0.7, 'sine', 0.1, 140, 0.1);
        this.tone(211, 0.8, 'sine', 0.05, -60, 0.08);
        this.noise(0.4, 0.12, 'highpass', 2000, 6000, 0.45);
        break;
      case 'domain':
        this.tone(36, 2.8, 'sine', 0.42, 8);
        this.tone(72, 2.6, 'sawtooth', 0.1, -10);
        [146.8, 174.6, 220, 293.7].forEach((f, i) => this.tone(f, 2.4, 'sine', 0.07, 0, 0.2 + i * 0.16));
        this.noise(1.8, 0.22, 'lowpass', 300, 2400, 0.1);
        break;
      case 'void':
        this.tone(320, 0.5, 'sine', 0.12, -260);
        this.noise(0.4, 0.22, 'bandpass', 3000, 300);
        this.tone(64, 0.5, 'sine', 0.22, -20);
        break;
      case 'boss':
        this.tone(35, 2.4, 'sawtooth', 0.32, -6);
        this.tone(70, 2, 'square', 0.12, -10);
        this.noise(1.6, 0.3, 'lowpass', 900, 80);
        this.tone(523.3, 0.8, 'sine', 0.06, -200, 0.1);
        break;
      case 'gate':
        this.tone(90, 1.4, 'sine', 0.2, 60);
        this.tone(180, 1.4, 'triangle', 0.08, 40);
        this.noise(1.4, 0.15, 'bandpass', 400, 1200);
        break;
      case 'judge':
        this.tone(40, 1.8, 'sawtooth', 0.35, -10);
        this.noise(1.6, 0.5, 'lowpass', 2500, 80);
        this.tone(660, 0.8, 'square', 0.1, -500);
        break;
      case 'warn':
        this.tone(440, 0.18, 'square', 0.1);
        this.tone(440, 0.18, 'square', 0.1, 0, 0.25);
        break;
      case 'cast':
        this.tone(300, 0.5, 'sine', 0.15, 600);
        this.noise(0.5, 0.15, 'bandpass', 1000, 3000);
        break;
      case 'poison':
        this.tone(300, 0.2, 'sine', 0.05, -100);
        break;
      case 'death':
        this.tone(200, 0.8, 'sawtooth', 0.15, -150);
        this.noise(0.6, 0.2, 'lowpass', 1000, 100);
        break;
      case 'stinger':
        this.tone(98, 2.5, 'sawtooth', 0.2, -15);
        this.tone(103.8, 2.5, 'sawtooth', 0.15);
        this.noise(1.5, 0.12, 'lowpass', 500, 100);
        break;
      case 'clang':
        this.tone(1500 + r * 300, 0.3, 'square', 0.08, -500);
        this.noise(0.1, 0.3, 'highpass', 3000);
        break;
    }
  }
  setMode(m: Mode) {
    if (m === this.mode) return;
    this.mode = m;
    this.step = 0;
    if (!this.ctx) return;
    const a = this.ambFilter,
      g = this.ambGain,
      t = this.ctx.currentTime;
    const cfg: Record<Mode, [number, number]> = {
      none: [200, 0],
      menu: [300, 0.05],
      city: [1100, 0.16],
      temple: [250, 0.22],
      cave: [400, 0.2],
      boss: [180, 0.18],
      penalty: [700, 0.3],
      arena: [300, 0.2],
    };
    a.frequency.linearRampToValueAtTime(cfg[m][0], t + 1.5);
    g.gain.linearRampToValueAtTime(cfg[m][1], t + 1.5);
  }
  tick() {
    const c = this.ctx;
    if (!c || this.mode === 'none' || useGame.getState().settings.music <= 0) return;
    const bpm = { menu: 70, city: 84, temple: 60, cave: 70, boss: 142, penalty: 100, arena: 100, none: 60 }[this.mode];
    const stepDur = 60 / bpm / 2;
    const now = c.currentTime;
    if (now < this.lastStep) return;
    this.lastStep = Math.max(now, this.lastStep) + stepDur;
    const s = this.step++;
    const m = this.musicG;
    const root = { menu: 73.4, city: 110, temple: 55, cave: 65.4, boss: 82.4, penalty: 61.7, arena: 73.4, none: 55 }[
      this.mode
    ];
    const minor = [0, 2, 3, 5, 7, 8, 10, 12];
    const note = (i: number, oct = 1) => root * oct * Math.pow(2, minor[((i % 8) + 8) % 8] / 12);
    const bar = Math.floor(s / 16) % 4;
    const prog = [0, 5, 2, 4][bar];
    switch (this.mode) {
      case 'city':
      case 'menu':
        if (s % 16 === 0) {
          [0, 2, 4].forEach((k) => this.tone(note(prog + k, 1), stepDur * 15, 'sawtooth', 0.04, 0, 0, m));
        }
        if (s % 2 === 0) this.tone(note(prog + [0, 2, 4, 2][(s / 2) % 4], 4), stepDur * 1.5, 'triangle', 0.05, 0, 0, m);
        if (s % 8 === 0) this.tone(root / 2, stepDur * 4, 'sine', 0.12, 0, 0, m);
        break;
      case 'temple':
      case 'cave':
      case 'arena':
        if (s % 32 === 0) {
          this.tone(root, stepDur * 31, 'sawtooth', 0.06, 0, 0, m);
          this.tone(root * 1.5, stepDur * 31, 'sine', 0.05, 0, 0, m);
        }
        if (s % 8 === 4) this.tone(note([0, 3, 5, 7][(s >> 3) % 4], 8), 1.4, 'sine', 0.05, 0, 0, m);
        if (s % 16 === 0) this.tone(root / 2, 0.6, 'sine', 0.2, -10, 0, m);
        if (this.mode === 'arena' && s % 4 === 0) this.tone(root, 0.25, 'square', 0.04, 0, 0, m);
        break;
      case 'penalty':
        if (s % 16 === 0) {
          this.tone(root, stepDur * 16, 'sawtooth', 0.06, 0, 0, m);
          this.tone(root * 1.414, stepDur * 16, 'sawtooth', 0.05, 0, 0, m);
        }
        if (s % 4 === 0) this.tone(root / 2, 0.15, 'sine', 0.2, -10, 0, m);
        break;
      case 'boss':
        if (s % 4 === 0) {
          this.tone(120, 0.18, 'sine', 0.35, -90, 0, m);
        }
        if (s % 8 === 4) this.noise(0.15, 0.25, 'highpass', 1800, 0, 0, m);
        this.tone(note(prog, 1), stepDur * 0.9, 'sawtooth', 0.07, 0, 0, m);
        if (s % 2 === 1) this.tone(note(prog + [0, 2, 4, 7][(s >> 1) % 4], 4), stepDur, 'square', 0.025, 0, 0, m);
        if (s % 32 === 0)
          [0, 4, 7].forEach((k) => this.tone(note(prog + k, 2), stepDur * 30, 'sawtooth', 0.025, 0, 0, m));
        break;
    }
  }
}
export const audio = new AudioSys();
bus.on('sfx', (n: string, p?: number) => audio.sfx(n, p));
useGame.subscribe((s, p) => {
  if (s.settings !== p.settings) audio.applyVolumes();
});
