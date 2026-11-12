import type { Settings } from './types';

type Mode = 'off' | 'menu' | 'calm' | 'tense' | 'dark' | 'festival' | 'sacred' | 'void' | 'battle' | 'boss';
const HIRA = [0, 2, 3, 7, 8];

class AudioMgr {
  ctx: AudioContext | null = null;
  master!: GainNode; musicG!: GainNode; sfxG!: GainNode; ambG!: GainNode;
  noise!: AudioBuffer; layers: Record<string, GainNode> = {};
  mode: Mode = 'off'; root = 146.83; step = 0; nextT = 0; timer: number | null = null; vol = { music: 0.5, sfx: 0.8, amb: 0.6 };
  ambKind = 'forest'; night = false; weather = 'none'; padNodes: { o: OscillatorNode; g: GainNode }[] = [];

  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return this.ctx; }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    const c = new AC(); this.ctx = c;
    this.master = c.createGain(); this.master.gain.value = 0.8; this.master.connect(c.destination);
    this.musicG = c.createGain(); this.sfxG = c.createGain(); this.ambG = c.createGain();
    [this.musicG, this.sfxG, this.ambG].forEach((g) => g.connect(this.master));
    this.applyVol();
    const len = c.sampleRate * 2; this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0); let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = w * 0.5 + last * 6; }
    this.buildAmbience();
    this.timer = window.setInterval(() => this.schedule(), 120);
    return c;
  }
  setVolumes(s: Settings) { this.vol = { music: s.music, sfx: s.sfx, amb: s.ambience }; this.applyVol(); }
  applyVol() { if (!this.ctx) return; this.musicG.gain.value = this.vol.music * 0.5; this.sfxG.gain.value = this.vol.sfx; this.ambG.gain.value = this.vol.amb * 0.6; }

  private layer(name: string, type: BiquadFilterType, freq: number, q = 0.7, lfo?: { f: number; d: number }) {
    const c = this.ctx!; const src = c.createBufferSource(); src.buffer = this.noise; src.loop = true;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.value = 0; src.connect(f); f.connect(g); g.connect(this.ambG); src.start();
    if (lfo) { const o = c.createOscillator(); o.frequency.value = lfo.f; const og = c.createGain(); og.gain.value = lfo.d; o.connect(og); og.connect(f.frequency); o.start(); }
    this.layers[name] = g;
  }
  private buildAmbience() {
    this.layer('wind', 'lowpass', 500, 0.7, { f: 0.1, d: 250 }); this.layer('rain', 'highpass', 2200, 0.5);
    this.layer('water', 'bandpass', 900, 0.6, { f: 0.3, d: 200 }); this.layer('rumble', 'lowpass', 140, 0.5, { f: 6, d: 30 });
    this.layer('murmur', 'bandpass', 420, 1.2, { f: 0.2, d: 120 }); this.layer('forge', 'bandpass', 2500, 1.5, { f: 0.5, d: 500 });
    this.layer('hum', 'lowpass', 90, 2, { f: 0.07, d: 30 });
    const c = this.ctx!; const o = c.createOscillator(); o.frequency.value = 4300; const g = c.createGain(); g.gain.value = 0;
    const lf = c.createOscillator(); lf.frequency.value = 9; const lg = c.createGain(); lg.gain.value = 0.02; lf.connect(lg); lg.connect(g.gain);
    const base = c.createGain(); base.gain.value = 0; o.connect(g); g.connect(base); base.connect(this.ambG); o.start(); lf.start(); this.layers.crickets = base;
  }
  setAmbience(kind: string, night: boolean, weather: string) {
    if (!this.ctx) return; this.ambKind = kind; this.night = night; this.weather = weather;
    const t = this.ctx.currentTime; const set = (n: string, v: number) => this.layers[n].gain.setTargetAtTime(v, t, 1.2);
    set('wind', kind === 'wind' ? 0.9 : kind === 'forest' ? 0.5 : kind === 'void' ? 0.3 : 0.25);
    set('rain', weather === 'rain' ? 0.8 : 0); set('water', kind === 'river' ? 0.6 : kind === 'forge' ? 0.25 : 0);
    set('rumble', kind === 'train' ? 1.3 : 0); set('murmur', kind === 'village' ? 0.5 : 0);
    set('forge', kind === 'forge' ? 0.12 : 0); set('hum', kind === 'interior' || kind === 'void' ? 1.2 : 0.2);
    set('crickets', night && (kind === 'forest' || kind === 'village' || kind === 'river') ? 1 : 0);
  }
  setMode(m: Mode) {
    if (this.mode === m) return; this.mode = m;
    const roots: Record<Mode, number> = { off: 146.83, menu: 146.83, calm: 146.83, tense: 130.8, dark: 123.5, festival: 164.8, sacred: 174.6, void: 110, battle: 138.6, boss: 116.5 };
    this.root = roots[m]; this.updatePad();
  }
  private updatePad() {
    if (!this.ctx) return; const c = this.ctx;
    if (!this.padNodes.length) {
      [1, 1.5, 2, 3.0].forEach((m, i) => {
        const o = c.createOscillator(); o.type = i === 3 ? 'sine' : 'triangle'; const g = c.createGain(); g.gain.value = 0;
        const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700; o.connect(f); f.connect(g); g.connect(this.musicG); o.start();
        this.padNodes.push({ o, g }); o.frequency.value = this.root * m / 2;
      });
    }
    const t = c.currentTime; const lvl = this.mode === 'off' ? 0 : this.mode === 'boss' || this.mode === 'void' ? 0.09 : 0.05;
    this.padNodes.forEach((p, i) => { p.o.frequency.setTargetAtTime(this.root * [1, 1.5, 2, 3][i] / 2 * (this.mode === 'boss' && i === 1 ? 1.06 : 1), t, 0.6); p.g.gain.setTargetAtTime(lvl / (1 + i * 0.6), t, 0.8); });
  }
  private schedule() {
    const c = this.ctx; if (!c || this.mode === 'off') return;
    const tempo: Record<Mode, number> = { off: 60, menu: 62, calm: 66, tense: 80, dark: 58, festival: 100, sacred: 54, void: 50, battle: 128, boss: 144 };
    const spb = 60 / tempo[this.mode] / 2;
    if (this.nextT < c.currentTime) this.nextT = c.currentTime + 0.05;
    while (this.nextT < c.currentTime + 0.4) {
      this.beat(this.nextT, this.step++); this.nextT += spb;
    }
  }
  private beat(t: number, s: number) {
    const m = this.mode; const hot = m === 'battle' || m === 'boss';
    const prob = hot ? 0.6 : m === 'festival' ? 0.55 : m === 'dark' || m === 'void' ? 0.18 : 0.32;
    if (Math.random() < prob) {
      const n = HIRA[Math.floor(Math.random() * 5)] + (Math.random() < 0.3 ? 12 : 0) + (Math.random() < 0.15 ? 24 : 0);
      this.pluck(this.root * Math.pow(2, n / 12), t, m === 'sacred' ? 1.8 : 0.9, hot ? 0.3 : 0.22);
    }
    if (hot) {
      if (s % 4 === 0) this.taiko(t, m === 'boss' ? 0.9 : 0.7);
      if (s % 8 === 6 || (m === 'boss' && s % 4 === 3)) this.taiko(t, 0.45, 80);
      if (s % 2 === 1) this.tick(t, 0.12);
    } else if (m === 'festival' && s % 4 === 0) this.taiko(t, 0.3, 120);
    else if ((m === 'dark' || m === 'void') && s % 16 === 0) this.taiko(t, 0.35, 55);
    if (m === 'sacred' && s % 16 === 0) this.bell(t);
  }
  pluck(f: number, t: number, dur: number, v: number) {
    const c = this.ctx!; const o = c.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(f * 1.02, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.06);
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.005); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 2400; o.connect(fl); fl.connect(g); g.connect(this.musicG); o.start(t); o.stop(t + dur + 0.1);
  }
  taiko(t: number, v: number, f = 90) {
    const c = this.ctx!; const o = c.createOscillator(); o.frequency.setValueAtTime(f * 1.8, t); o.frequency.exponentialRampToValueAtTime(f * 0.5, t + 0.25);
    const g = c.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35); o.connect(g); g.connect(this.musicG); o.start(t); o.stop(t + 0.4);
  }
  tick(t: number, v: number) {
    const c = this.ctx!; const s = c.createBufferSource(); s.buffer = this.noise; const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000;
    const g = c.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05); s.connect(f); f.connect(g); g.connect(this.musicG); s.start(t, Math.random()); s.stop(t + 0.06);
  }
  bell(t: number) { [1, 2.76, 5.4].forEach((m, i) => this.pluck(this.root * 4 * m, t, 3.5 - i, 0.1 / (i + 1))); }

  // ---- sound effects ----
  private nz(dur: number, type: BiquadFilterType, f0: number, f1: number, v: number, delay = 0, q = 1) {
    const c = this.ensure(); if (!c) return; const t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noise; const f = c.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.001, t); g.gain.linearRampToValueAtTime(v, t + dur * 0.2); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfxG); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  private tn(f0: number, f1: number, dur: number, type: OscillatorType, v: number, delay = 0) {
    const c = this.ensure(); if (!c) return; const t = c.currentTime + delay;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g); g.connect(this.sfxG); o.start(t); o.stop(t + dur + 0.05);
  }
  sfx(name: string) {
    if (!this.ensure()) return;
    switch (name) {
      case 'swing': this.nz(0.22, 'bandpass', 900, 3200, 0.5, 0, 2); break;
      case 'swing2': this.nz(0.26, 'bandpass', 1800, 500, 0.55, 0, 2); break;
      case 'heavy': this.nz(0.4, 'bandpass', 500, 2200, 0.7, 0, 1.5); this.tn(120, 50, 0.3, 'sine', 0.3, 0.1); break;
      case 'hit': this.tn(180, 60, 0.12, 'square', 0.25); this.nz(0.1, 'lowpass', 3000, 400, 0.7); break;
      case 'crit': this.tn(300, 70, 0.2, 'sawtooth', 0.3); this.nz(0.18, 'highpass', 5000, 1500, 0.7); this.tn(1800, 900, 0.25, 'triangle', 0.12); break;
      case 'clash': [1700, 2650, 3900].forEach((f) => this.tn(f, f * 0.96, 0.4, 'triangle', 0.14)); this.nz(0.08, 'highpass', 4000, 3000, 0.5); break;
      case 'parry': [2200, 3300, 4700].forEach((f) => this.tn(f, f, 0.6, 'sine', 0.16)); this.nz(0.1, 'highpass', 6000, 4000, 0.6); break;
      case 'dodge': this.nz(0.3, 'bandpass', 600, 2500, 0.35, 0, 1); break;
      case 'perfect': this.tn(900, 1800, 0.4, 'sine', 0.2); this.tn(1350, 2700, 0.4, 'sine', 0.12, 0.05); break;
      case 'hurt': this.tn(140, 55, 0.25, 'sawtooth', 0.28); this.nz(0.15, 'lowpass', 1500, 200, 0.5); break;
      case 'step': this.nz(0.07, 'lowpass', 900, 300, 0.12); break;
      case 'ui': this.tn(900, 1100, 0.06, 'sine', 0.12); break;
      case 'uiok': this.tn(700, 1400, 0.12, 'triangle', 0.16); break;
      case 'deny': this.tn(200, 140, 0.15, 'square', 0.1); break;
      case 'pickup': this.tn(1200, 2400, 0.18, 'sine', 0.15); this.tn(1800, 3000, 0.18, 'sine', 0.1, 0.08); break;
      case 'heal': [0, 0.08, 0.16].forEach((d, i) => this.tn(600 * (1 + i * 0.25), 900 * (1 + i * 0.25), 0.3, 'sine', 0.12, d)); break;
      case 'water': this.nz(0.5, 'bandpass', 700, 3000, 0.6, 0, 0.8); this.nz(0.45, 'highpass', 3000, 6000, 0.25); break;
      case 'thunder': this.nz(0.35, 'highpass', 6000, 800, 0.9); this.tn(80, 30, 0.6, 'sawtooth', 0.35, 0.05); break;
      case 'fire': this.nz(0.6, 'bandpass', 300, 1200, 0.8, 0, 0.7); this.tn(110, 70, 0.5, 'sawtooth', 0.15); break;
      case 'wind': this.nz(0.6, 'bandpass', 400, 2500, 0.7, 0, 3); break;
      case 'magic': this.tn(500, 1500, 0.4, 'triangle', 0.15); this.nz(0.4, 'bandpass', 1500, 4000, 0.3, 0, 3); break;
      case 'poison': this.nz(0.5, 'bandpass', 2000, 600, 0.35, 0, 4); break;
      case 'quake': this.tn(90, 30, 0.7, 'sine', 0.6); this.nz(0.5, 'lowpass', 600, 80, 0.8); break;
      case 'ultimate': this.tn(60, 400, 1.2, 'sawtooth', 0.2); this.nz(1.2, 'bandpass', 200, 4000, 0.7, 0, 2); this.tn(1200, 2400, 0.8, 'sine', 0.12, 0.4); break;
      case 'boss': this.tn(70, 40, 1.8, 'sawtooth', 0.35); this.taiko(this.ctx!.currentTime, 1, 60); this.taiko(this.ctx!.currentTime + 0.6, 1, 50); break;
      case 'roar': this.tn(150, 60, 0.8, 'sawtooth', 0.3); this.nz(0.8, 'bandpass', 300, 900, 0.5, 0, 1); break;
      case 'telegraph': this.tn(500, 520, 0.12, 'square', 0.04); break;
      case 'death': this.tn(250, 40, 0.8, 'sawtooth', 0.25); this.nz(0.7, 'lowpass', 1500, 100, 0.5); break;
      case 'complete': [523, 659, 784, 1046].forEach((f, i) => this.tn(f, f, 0.6, 'triangle', 0.18, i * 0.14)); break;
      case 'levelup': [440, 554, 659, 880, 1108].forEach((f, i) => this.tn(f, f, 0.5, 'sine', 0.18, i * 0.09)); break;
      case 'jump': this.nz(0.15, 'bandpass', 400, 900, 0.2); break;
      case 'land': this.nz(0.12, 'lowpass', 700, 150, 0.3); break;
      case 'nezuko': this.tn(700, 1100, 0.2, 'triangle', 0.1); this.nz(0.3, 'bandpass', 800, 2500, 0.3, 0, 2); break;
      case 'explosion': this.tn(100, 30, 0.6, 'sawtooth', 0.4); this.nz(0.6, 'lowpass', 2500, 100, 0.9); break;
      default: break;
    }
  }
}
export const audio = new AudioMgr();
