// Fully synthesized sound engine (no external assets)
export class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  noiseBuf!: AudioBuffer;
  volume = 0.7;
  windGain!: GainNode;
  windFilter!: BiquadFilterNode;
  under!: BiquadFilterNode;
  musicOn = true;
  musicNodes: { stop: () => void } | null = null;
  loops: Record<string, { stop: () => void }> = {};

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    this.under = ctx.createBiquadFilter();
    this.under.type = 'lowpass';
    this.under.frequency.value = 22000;
    this.master.connect(this.under);
    this.under.connect(ctx.destination);
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // wind ambience
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass'; this.windFilter.frequency.value = 400; this.windFilter.Q.value = 0.6;
    this.windGain = ctx.createGain(); this.windGain.gain.value = 0;
    src.connect(this.windFilter); this.windFilter.connect(this.windGain); this.windGain.connect(this.master);
    src.start();
    if (this.musicOn) this.startMusic();
  }
  setVolume(v: number) { this.volume = v; if (this.master) this.master.gain.value = v; }
  setMusic(on: boolean) {
    this.musicOn = on;
    if (!this.ctx) return;
    if (on && !this.musicNodes) this.startMusic();
    if (!on && this.musicNodes) { this.musicNodes.stop(); this.musicNodes = null; }
  }
  startMusic() {
    const ctx = this.ctx!;
    const g = ctx.createGain(); g.gain.value = 0.0; g.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 4);
    g.connect(this.master);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.connect(g);
    const oscs: OscillatorNode[] = [];
    const notes = [55, 82.4, 110, 164.8, 220, 277.2, 329.6];
    notes.forEach((f, i) => {
      for (const det of [-6, 6]) {
        const o = ctx.createOscillator(); o.type = i % 2 ? 'sine' : 'triangle';
        o.frequency.value = f; o.detune.value = det;
        const og = ctx.createGain(); og.gain.value = 0.35 / (1 + i * 0.4);
        const lfo = ctx.createOscillator(); lfo.frequency.value = 0.04 + i * 0.013;
        const lg = ctx.createGain(); lg.gain.value = og.gain.value * 0.8;
        lfo.connect(lg); lg.connect(og.gain); lfo.start();
        o.connect(og); og.connect(lp); o.start(); oscs.push(o, lfo);
      }
    });
    this.musicNodes = { stop: () => { g.gain.linearRampToValueAtTime(0, ctx.currentTime + 1); setTimeout(() => oscs.forEach(o => { try { o.stop(); } catch { /* */ } }), 1200); } };
  }
  setWind(speed01: number, underwater: boolean) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.windGain.gain.setTargetAtTime(Math.min(0.5, speed01 * 0.5), t, 0.1);
    this.windFilter.frequency.setTargetAtTime(300 + speed01 * 1800, t, 0.1);
    this.under.frequency.setTargetAtTime(underwater ? 500 : 22000, t, 0.1);
  }
  vol(dist: number) { return dist < 0 ? 1 : 1 / (1 + dist * dist / 40000); }

  tone(f0: number, f1: number, dur: number, type: OscillatorType = 'sine', vol = 0.3, delay = 0) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  }
  noise(dur: number, f0: number, f1: number, type: BiquadFilterType = 'lowpass', vol = 0.5, delay = 0, q = 1) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t); s.stop(t + dur + 0.05);
  }
  play(name: string, dist = -1, scale = 1) {
    if (!this.ctx) return;
    const v = this.vol(dist) * scale;
    if (v < 0.02) return;
    switch (name) {
      case 'boom': this.noise(1.6, 900, 60, 'lowpass', 0.9 * v); this.tone(90, 25, 1.2, 'sine', 0.9 * v); break;
      case 'smallboom': this.noise(0.7, 1400, 100, 'lowpass', 0.6 * v); this.tone(120, 40, 0.5, 'sine', 0.5 * v); break;
      case 'thunder': this.noise(3.5, 500, 40, 'lowpass', 1 * v, 0.1); this.tone(55, 20, 2.5, 'sawtooth', 0.25 * v); break;
      case 'zap': this.noise(0.25, 8000, 800, 'highpass', 0.5 * v); this.tone(1800, 120, 0.25, 'sawtooth', 0.25 * v); break;
      case 'whoosh': this.noise(0.7, 300, 2500, 'bandpass', 0.4 * v, 0, 2); break;
      case 'rumble': this.noise(3, 120, 40, 'lowpass', 0.9 * v); this.tone(40, 28, 3, 'sine', 0.6 * v); break;
      case 'crumble': this.noise(1.8, 700, 80, 'lowpass', 0.7 * v); break;
      case 'chime': this.tone(880, 880, 1.2, 'sine', 0.2 * v); this.tone(1320, 1320, 1.0, 'sine', 0.15 * v, 0.08); this.tone(1760, 1760, 0.9, 'sine', 0.1 * v, 0.16); break;
      case 'ice': this.noise(0.5, 6000, 2000, 'highpass', 0.4 * v); this.tone(2400, 900, 0.4, 'triangle', 0.15 * v); break;
      case 'splash': this.noise(1.2, 3000, 300, 'bandpass', 0.6 * v); break;
      case 'portal': this.tone(200, 900, 0.8, 'sine', 0.35 * v); this.tone(300, 1200, 0.8, 'triangle', 0.2 * v); break;
      case 'transform': this.tone(100, 1400, 1.1, 'sawtooth', 0.25 * v); this.tone(200, 2800, 1.1, 'sine', 0.25 * v); this.noise(1.3, 200, 6000, 'bandpass', 0.35 * v); this.play('boom', -1, 0.6); break;
      case 'tick': this.tone(1400, 900, 0.06, 'square', 0.08 * v); break;
      case 'select': this.tone(600, 1200, 0.12, 'sine', 0.2 * v); break;
      case 'hit': this.noise(0.15, 2000, 200, 'lowpass', 0.4 * v); break;
      case 'blackhole': this.tone(60, 30, 2.5, 'sine', 0.6 * v); this.noise(2.5, 100, 400, 'bandpass', 0.4 * v, 0, 3); break;
      case 'teleport': this.tone(1600, 200, 0.35, 'sine', 0.3 * v); this.noise(0.3, 6000, 600, 'bandpass', 0.3 * v); break;
      case 'freeze': this.tone(900, 60, 1.0, 'sine', 0.4 * v); break;
      case 'rewind': this.tone(1200, 200, 0.7, 'sawtooth', 0.15 * v); break;
      case 'spawn': this.tone(300, 900, 0.4, 'triangle', 0.25 * v); this.play('chime', -1, 0.5); break;
      case 'meteor': this.noise(1.5, 4000, 200, 'bandpass', 0.5 * v, 0, 1.5); break;
    }
  }
  loop(name: string, on: boolean) {
    const ctx = this.ctx; if (!ctx) return;
    if (!on) { this.loops[name]?.stop(); delete this.loops[name]; return; }
    if (this.loops[name]) return;
    const g = ctx.createGain(); g.gain.value = 0; g.gain.linearRampToValueAtTime(0.28, ctx.currentTime + 0.1); g.connect(this.master);
    const nodes: AudioScheduledSourceNode[] = [];
    if (name === 'beam' || name === 'energy') {
      for (const f of [70, 140, 283]) {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; const og = ctx.createGain(); og.gain.value = 0.4; o.connect(og); og.connect(g); o.start(); nodes.push(o);
      }
    }
    if (name === 'fire' || name === 'wind' || name === 'beam') {
      const s = ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
      const f = ctx.createBiquadFilter(); f.type = name === 'fire' ? 'lowpass' : 'bandpass'; f.frequency.value = name === 'fire' ? 900 : 1200; f.Q.value = 1;
      s.connect(f); f.connect(g); s.start(); nodes.push(s);
    }
    this.loops[name] = { stop: () => { g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15); setTimeout(() => nodes.forEach(n => { try { n.stop(); } catch { /* */ } }), 250); } };
  }
}
