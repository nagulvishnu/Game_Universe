// Procedural Web Audio engine — no external assets needed.
class AudioEngine {
  ctx: AudioContext | null = null; master!: GainNode; musicG!: GainNode; sfxG!: GainNode; noiseBuf!: AudioBuffer;
  vols = { master: 0.8, music: 0.45, sfx: 0.8 }; mood: string | null = null; timer = 0; step = 0; nextT = 0;
  last: Record<string, number> = {};

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const C = window.AudioContext || (window as any).webkitAudioContext; this.ctx = new C();
      this.master = this.ctx.createGain(); this.musicG = this.ctx.createGain(); this.sfxG = this.ctx.createGain();
      const comp = this.ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6;
      this.musicG.connect(this.master); this.sfxG.connect(this.master); this.master.connect(comp); comp.connect(this.ctx.destination);
      const n = this.ctx.sampleRate * 2; this.noiseBuf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      this.setVolumes(this.vols.master, this.vols.music, this.vols.sfx);
      if (this.mood) this.music(this.mood, true);
    } catch { /* audio unsupported */ }
  }
  setVolumes(m: number, mu: number, s: number) {
    this.vols = { master: m, music: mu, sfx: s };
    if (!this.ctx) return;
    this.master.gain.value = m; this.musicG.gain.value = mu * 0.6; this.sfxG.gain.value = s;
  }
  tone(f: number, d: number, type: OscillatorType = 'sine', v = 0.3, slide = 0, delay = 0, dest?: AudioNode) {
    const c = this.ctx; if (!c) return; const t = c.currentTime + delay;
    const o = c.createOscillator(); const g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(dest || this.sfxG); o.start(t); o.stop(t + d + 0.05);
  }
  noise(d: number, v = 0.3, f = 1000, type: BiquadFilterType = 'lowpass', slide = 0, delay = 0, q = 1) {
    const c = this.ctx; if (!c) return; const t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; const fl = c.createBiquadFilter(); fl.type = type; fl.Q.value = q;
    fl.frequency.setValueAtTime(f, t); if (slide) fl.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
    const g = c.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(fl); fl.connect(g); g.connect(this.sfxG); s.start(t, Math.random()); s.stop(t + d + 0.05);
  }
  sfx(name: string, vol = 1) {
    if (!this.ctx) return; const now = this.ctx.currentTime;
    const lim = name === 'shoot_mg' ? 0.05 : name === 'hit' ? 0.04 : 0.02; if (this.last[name] && now - this.last[name] < lim) return; this.last[name] = now;
    const v = Math.min(1, vol);
    switch (name) {
      case 'step': this.noise(0.25, 0.5 * v, 220, 'lowpass', -120); this.tone(70, 0.22, 'sine', 0.5 * v, -40); break;
      case 'explode': this.noise(0.7, 0.55 * v, 1400, 'lowpass', -1100); this.tone(80, 0.5, 'sine', 0.5 * v, -50); break;
      case 'bigExplode': this.noise(1.6, 0.9 * v, 1800, 'lowpass', -1500); this.tone(55, 1.2, 'sine', 0.8 * v, -35); this.noise(0.5, 0.4 * v, 3000, 'highpass', -2000, 0.05); break;
      case 'shoot_mg': this.noise(0.07, 0.25 * v, 2500, 'bandpass', -1000); this.tone(190, 0.06, 'square', 0.1 * v, -90); break;
      case 'shoot_rocket': this.noise(0.5, 0.4 * v, 900, 'bandpass', 1500); this.tone(120, 0.35, 'sawtooth', 0.2 * v, 200); break;
      case 'shoot_plasma': this.tone(900, 0.22, 'sawtooth', 0.2 * v, -700); this.tone(300, 0.2, 'square', 0.12 * v, -150); break;
      case 'rail': this.tone(2400, 0.35, 'sawtooth', 0.25 * v, -2200); this.noise(0.3, 0.5 * v, 6000, 'highpass', -4000); this.tone(60, 0.4, 'sine', 0.5 * v); break;
      case 'laser': this.tone(1300, 0.07, 'sawtooth', 0.12 * v, -300); break;
      case 'slash': this.noise(0.25, 0.4 * v, 1200, 'bandpass', 3000, 0, 2); this.tone(500, 0.15, 'sawtooth', 0.1 * v, -300); break;
      case 'hit': this.noise(0.12, 0.45 * v, 1800, 'lowpass', -1000); this.tone(140, 0.12, 'square', 0.2 * v, -80); break;
      case 'clang': this.tone(900, 0.4, 'triangle', 0.25 * v, -300); this.tone(1340, 0.3, 'square', 0.1 * v); this.noise(0.1, 0.3 * v, 5000, 'highpass'); break;
      case 'dash': this.noise(0.35, 0.4 * v, 800, 'bandpass', 3000, 0, 1.5); break;
      case 'jump': this.noise(0.4, 0.3 * v, 500, 'lowpass', 1500); this.tone(90, 0.3, 'sawtooth', 0.15 * v, 150); break;
      case 'land': this.noise(0.4, 0.6 * v, 300, 'lowpass', -200); this.tone(50, 0.4, 'sine', 0.6 * v); break;
      case 'transform': for (let i = 0; i < 8; i++) { this.tone(180 + i * 60, 0.12, 'square', 0.12 * v, 40, i * 0.09); this.noise(0.08, 0.3 * v, 3000, 'bandpass', 0, i * 0.09); } this.tone(100, 1.2, 'sawtooth', 0.25 * v, 500, 0.5); break;
      case 'ult': this.tone(60, 1.8, 'sawtooth', 0.35 * v, 300); this.tone(400, 1.6, 'sine', 0.2 * v, 1200); this.noise(1.2, 0.5 * v, 400, 'bandpass', 4000); break;
      case 'charge': this.tone(200, 0.5, 'sawtooth', 0.2 * v, 900); break;
      case 'shield': this.tone(300, 0.6, 'sine', 0.25 * v, 500); this.tone(450, 0.6, 'triangle', 0.2 * v, 400); break;
      case 'ui': this.tone(900, 0.06, 'square', 0.08 * v); this.tone(1400, 0.08, 'square', 0.06 * v, 0, 0.04); break;
      case 'ui_back': this.tone(500, 0.08, 'square', 0.08 * v, -150); break;
      case 'warn': this.tone(440, 0.2, 'square', 0.12 * v); this.tone(330, 0.25, 'square', 0.12 * v, 0, 0.2); break;
      case 'thunder': this.noise(1.0, 0.7 * v, 3000, 'bandpass', -2500); this.tone(45, 0.8, 'sawtooth', 0.4 * v, -10); break;
      case 'pickup': this.tone(700, 0.1, 'sine', 0.2 * v); this.tone(1050, 0.15, 'sine', 0.2 * v, 0, 0.08); break;
      case 'freeze': this.tone(2000, 0.5, 'triangle', 0.15 * v, -1200); this.noise(0.5, 0.3 * v, 7000, 'highpass'); break;
      case 'flame': this.noise(0.3, 0.35 * v, 700, 'lowpass', 600); break;
      case 'victory': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.6, 'triangle', 0.25, 0, i * 0.18)); this.tone(262, 1.5, 'sawtooth', 0.15, 0, 0.5); break;
      case 'defeat': [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.8, 'sawtooth', 0.2, -30, i * 0.3)); break;
      case 'servo': this.tone(300 + Math.random() * 100, 0.08, 'square', 0.04 * v, 60); break;
    }
  }
  roar(voice: [number, number, number], vol = 1) {
    const c = this.ctx; if (!c) return; const [f, d, r] = voice; const t = c.currentTime; const v = Math.min(1, vol);
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f * 1.6, t); o.frequency.exponentialRampToValueAtTime(f, t + d * 0.3); o.frequency.exponentialRampToValueAtTime(f * 0.6, t + d);
    const lfo = c.createOscillator(); lfo.frequency.value = 14 + r * 12; const lg = c.createGain(); lg.gain.value = f * 0.25 * r; lfo.connect(lg); lg.connect(o.frequency);
    const fl = c.createBiquadFilter(); fl.type = 'bandpass'; fl.Q.value = 2 + r * 3; fl.frequency.setValueAtTime(f * 5, t); fl.frequency.exponentialRampToValueAtTime(f * 2, t + d);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.7 * v, t + d * 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(fl); fl.connect(g); g.connect(this.sfxG); o.start(t); lfo.start(t); o.stop(t + d + 0.1); lfo.stop(t + d + 0.1);
    this.noise(d * 0.9, 0.35 * v, f * 6, 'bandpass', -f * 3, 0, 1.5);
  }
  // --- generative music
  music(mood: string | null, force = false) {
    if (mood === this.mood && !force) return; this.mood = mood;
    clearInterval(this.timer); if (!this.ctx || !mood) return;
    this.step = 0; this.nextT = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 120);
  }
  schedule() {
    const c = this.ctx; if (!c || !this.mood) return; const mood = this.mood;
    const bpm = mood === 'boss' ? 150 : mood === 'battle' ? 128 : mood === 'menu' ? 80 : 90; const sp = 60 / bpm / 2;
    const root = mood === 'boss' ? 43.65 : mood === 'menu' ? 55 : 49; const scale = [0, 3, 5, 7, 10, 12, 15];
    while (this.nextT < c.currentTime + 0.35) {
      const s = this.step; const t = this.nextT - c.currentTime; const bar = Math.floor(s / 16) % 4; const prog = [0, 0, 5, 3][bar] || 0;
      const f = (n: number) => root * Math.pow(2, (n + prog) / 12);
      if (mood === 'victory' || mood === 'defeat') { if (s % 8 === 0) this.tone(f(mood === 'victory' ? 7 : 3) * 2, 2.5, 'triangle', 0.1, 0, t, this.musicG); }
      else {
        if (s % 4 === 0 || (mood !== 'menu' && s % 8 === 6)) this.tone(f(0), sp * 3, 'sawtooth', mood === 'menu' ? 0.12 : 0.2, 0, t, this.musicG);
        if (mood !== 'menu') { if (s % 8 === 0 || (mood === 'boss' && s % 8 === 3)) { this.tone(110, 0.2, 'sine', 0.5, -80, t, this.musicG); } if (s % 8 === 4) this.noise(0.15, 0.25, 2200, 'bandpass', 0, t, 1); if (s % 2 === 1) this.noise(0.04, 0.08, 9000, 'highpass', 0, t); }
        if (s % 2 === 0 && mood !== 'menu') { const n = scale[(s * 3 + bar * 2) % scale.length]; this.tone(f(n) * 4, sp * 1.2, mood === 'boss' ? 'square' : 'triangle', 0.07, 0, t, this.musicG); }
        if (s % 16 === 0) { this.tone(f(0) * 4, sp * 15, 'sine', 0.08, 0, t, this.musicG); this.tone(f(7) * 4, sp * 15, 'sine', 0.06, 0, t, this.musicG); this.tone(f(mood === 'menu' ? 12 : 10) * 4, sp * 15, 'sine', 0.05, 0, t, this.musicG); }
      }
      this.nextT += sp; this.step++;
    }
  }
}
export const audio = new AudioEngine();
