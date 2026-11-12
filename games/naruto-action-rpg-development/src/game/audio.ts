// Fully procedural WebAudio engine: music, ambience and SFX. No external assets required.
type MusicMode = 'village' | 'forest' | 'sea' | 'desert' | 'mystic' | 'valley' | 'wild' | 'battle' | 'boss' | 'menu';

const HIRAJOSHI = [0, 2, 3, 7, 8];
const INSEN = [0, 1, 5, 7, 10];
const MODES: Record<MusicMode, { bpm: number; root: number; scale: number[]; density: number; drums: number; pad: number; oct: number }> = {
  menu: { bpm: 84, root: 146.83, scale: HIRAJOSHI, density: 0.34, drums: 1, pad: 1, oct: 1 },
  village: { bpm: 92, root: 174.61, scale: HIRAJOSHI, density: 0.3, drums: 0, pad: 1, oct: 1 },
  forest: { bpm: 66, root: 110, scale: INSEN, density: 0.14, drums: 0, pad: 2, oct: 1 },
  sea: { bpm: 72, root: 130.81, scale: HIRAJOSHI, density: 0.22, drums: 0, pad: 1, oct: 1 },
  desert: { bpm: 100, root: 146.83, scale: [0, 1, 4, 5, 7, 8], density: 0.3, drums: 1, pad: 1, oct: 1 },
  mystic: { bpm: 70, root: 196, scale: HIRAJOSHI, density: 0.25, drums: 0, pad: 3, oct: 2 },
  valley: { bpm: 60, root: 123.47, scale: INSEN, density: 0.2, drums: 1, pad: 2, oct: 1 },
  wild: { bpm: 88, root: 164.81, scale: HIRAJOSHI, density: 0.25, drums: 0, pad: 1, oct: 1 },
  battle: { bpm: 146, root: 146.83, scale: INSEN, density: 0.5, drums: 2, pad: 2, oct: 1 },
  boss: { bpm: 158, root: 110, scale: INSEN, density: 0.62, drums: 3, pad: 3, oct: 1 },
};

class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode; music!: GainNode; sfxG!: GainNode; amb!: GainNode;
  noiseBuf!: AudioBuffer;
  vol = { master: 0.7, music: 0.55, sfx: 0.8, ambience: 0.5 };
  mode: MusicMode | null = null; step = 0; timer: number | null = null; nextTime = 0;
  padNodes: { stop: () => void } | null = null;
  ambNodes: { stop: () => void } | null = null; ambKey = '';
  lastSfx: Record<string, number> = {};
  chargeNode: { stop: () => void } | null = null;

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
    } catch { return; }
    const c = this.ctx;
    const comp = c.createDynamicsCompressor(); comp.connect(c.destination);
    this.master = c.createGain(); this.master.connect(comp);
    this.music = c.createGain(); this.music.connect(this.master);
    this.sfxG = c.createGain(); this.sfxG.connect(this.master);
    this.amb = c.createGain(); this.amb.connect(this.master);
    const len = c.sampleRate * 2; this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.applyVolumes();
    if (this.mode) { const m = this.mode; this.mode = null; this.setMusic(m); }
    if (this.ambKey) { const k = this.ambKey; this.ambKey = ''; const [z, n] = k.split('|'); this.setAmbience(z, n === '1'); }
  }
  setVolumes(v: Partial<typeof this.vol>) { Object.assign(this.vol, v); this.applyVolumes(); }
  private applyVolumes() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.vol.master, t, 0.05);
    this.music.gain.setTargetAtTime(this.vol.music * 0.5, t, 0.05);
    this.sfxG.gain.setTargetAtTime(this.vol.sfx, t, 0.05);
    this.amb.gain.setTargetAtTime(this.vol.ambience * 0.5, t, 0.05);
  }

  // ---------- primitives
  private tone(f0: number, f1: number, dur: number, type: OscillatorType, gain: number, dest: AudioNode, when = 0, attack = 0.005) {
    const c = this.ctx!; const t = c.currentTime + when;
    const o = c.createOscillator(); const g = c.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }
  private noise(dur: number, type: BiquadFilterType, f0: number, f1: number, gain: number, dest: AudioNode, when = 0, q = 1) {
    const c = this.ctx!; const t = c.currentTime + when;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = c.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  private pluck(freq: number, when: number, gain = 0.25, dest?: AudioNode) {
    const c = this.ctx!; const t = c.currentTime + when; const d = dest ?? this.music;
    const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = freq;
    const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 2.003;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    const g2 = c.createGain(); g2.gain.value = 0.3; o.connect(g); o2.connect(g2); g2.connect(g); g.connect(d);
    o.start(t); o2.start(t); o.stop(t + 1.2); o2.stop(t + 1.2);
  }
  private taiko(when: number, big = 1) {
    this.tone(120 * big, 45, 0.35, 'sine', 0.5, this.music, when);
    this.noise(0.08, 'bandpass', 900, 400, 0.14, this.music, when);
  }

  // ---------- SFX
  sfx(name: string, vol = 1) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = performance.now(); const gap = name === 'hit' || name === 'step' ? 45 : 20;
    if (this.lastSfx[name] && now - this.lastSfx[name] < gap) return; this.lastSfx[name] = now;
    const d = this.sfxG; const v = vol;
    switch (name) {
      case 'swing': this.noise(0.14, 'bandpass', 700 + Math.random() * 300, 2400, 0.22 * v, d, 0, 2); break;
      case 'hit': this.noise(0.09, 'lowpass', 2400, 300, 0.5 * v, d); this.tone(180, 70, 0.1, 'square', 0.18 * v, d); break;
      case 'heavy': this.noise(0.22, 'lowpass', 2000, 120, 0.7 * v, d); this.tone(110, 40, 0.3, 'sine', 0.55 * v, d); break;
      case 'crit': this.tone(900, 1800, 0.1, 'square', 0.15 * v, d); this.noise(0.12, 'highpass', 3000, 6000, 0.3 * v, d); this.tone(140, 50, 0.25, 'sine', 0.5 * v, d); break;
      case 'block': this.tone(1400, 900, 0.1, 'square', 0.18 * v, d); this.noise(0.05, 'highpass', 4000, 4000, 0.25 * v, d); break;
      case 'parry': this.tone(1800, 2600, 0.18, 'triangle', 0.3 * v, d); this.noise(0.1, 'highpass', 5000, 5000, 0.3 * v, d); break;
      case 'dodge': this.noise(0.18, 'bandpass', 3000, 900, 0.3 * v, d, 0, 1); break;
      case 'jump': this.tone(260, 520, 0.14, 'sine', 0.14 * v, d); break;
      case 'land': this.noise(0.08, 'lowpass', 600, 150, 0.25 * v, d); break;
      case 'step': this.noise(0.05, 'lowpass', 700 + Math.random() * 300, 300, 0.1 * v, d); break;
      case 'jutsu': this.noise(0.5, 'bandpass', 400, 3000, 0.3 * v, d, 0, 3); this.tone(300, 900, 0.4, 'sawtooth', 0.08 * v, d); break;
      case 'rasengan': this.noise(0.9, 'bandpass', 600, 2800, 0.28 * v, d, 0, 4); this.tone(220, 880, 0.8, 'sawtooth', 0.1 * v, d); break;
      case 'clone': this.noise(0.35, 'lowpass', 3000, 200, 0.5 * v, d); this.tone(500, 120, 0.3, 'triangle', 0.15 * v, d); break;
      case 'fire': this.noise(0.6, 'bandpass', 500, 1800, 0.4 * v, d, 0, 1.2); this.tone(100, 60, 0.5, 'sawtooth', 0.1 * v, d); break;
      case 'lightning': this.noise(0.25, 'highpass', 2000, 8000, 0.5 * v, d); this.tone(90, 40, 0.4, 'sawtooth', 0.2 * v, d); break;
      case 'water': this.noise(0.5, 'lowpass', 1800, 500, 0.35 * v, d, 0, 0.7); break;
      case 'wind': this.noise(0.5, 'bandpass', 900, 3500, 0.3 * v, d, 0, 1.5); break;
      case 'explode': this.noise(0.8, 'lowpass', 1800, 60, 0.8 * v, d); this.tone(90, 25, 0.8, 'sine', 0.8 * v, d); break;
      case 'summon': this.noise(0.6, 'lowpass', 2500, 100, 0.6 * v, d); this.tone(70, 40, 0.9, 'sine', 0.7 * v, d); this.tone(180, 90, 0.5, 'square', 0.1 * v, d, 0.3); break;
      case 'transform': this.tone(100, 600, 1.4, 'sawtooth', 0.12 * v, d); this.noise(1.4, 'bandpass', 200, 4000, 0.3 * v, d, 0, 2); this.tone(60, 60, 1.4, 'sine', 0.5 * v, d); break;
      case 'ult': this.tone(80, 1200, 1, 'sawtooth', 0.14 * v, d); this.noise(1, 'bandpass', 300, 5000, 0.4 * v, d, 0, 2); this.taiko(0.1, 1.4); break;
      case 'levelup': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, 0.5, 'triangle', 0.2 * v, d, i * 0.09)); break;
      case 'pickup': this.tone(880, 1320, 0.14, 'sine', 0.2 * v, d); this.tone(1320, 1760, 0.18, 'sine', 0.16 * v, d, 0.08); break;
      case 'ui': this.tone(660, 760, 0.05, 'triangle', 0.12 * v, d); break;
      case 'confirm': this.tone(520, 780, 0.1, 'triangle', 0.18 * v, d); this.tone(780, 1040, 0.12, 'triangle', 0.14 * v, d, 0.07); break;
      case 'back': this.tone(520, 320, 0.1, 'triangle', 0.14 * v, d); break;
      case 'error': this.tone(200, 150, 0.15, 'square', 0.12 * v, d); break;
      case 'dead': this.tone(300, 50, 0.9, 'sawtooth', 0.2 * v, d); this.noise(0.5, 'lowpass', 1000, 80, 0.4 * v, d); break;
      case 'defeat': this.noise(0.3, 'lowpass', 2000, 100, 0.3 * v, d); break;
      case 'sub': this.noise(0.25, 'lowpass', 2800, 300, 0.45 * v, d); this.tone(600, 200, 0.2, 'triangle', 0.15 * v, d); break;
      case 'telegraph': this.tone(440, 440, 0.12, 'square', 0.06 * v, d); break;
      case 'bossIntro': this.taiko(0, 1.5); this.taiko(0.35, 1.3); this.taiko(0.7, 1.7); this.tone(55, 55, 2.2, 'sawtooth', 0.15 * v, d); break;
      case 'victory': [392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, 0.8, 'triangle', 0.2 * v, d, i * 0.14)); this.taiko(0, 1.4); break;
      case 'kunai': this.noise(0.12, 'bandpass', 1500, 4000, 0.25 * v, d, 0, 3); break;
    }
  }
  charge(on: boolean) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    if (on && !this.chargeNode) {
      const c = this.ctx; const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 90;
      const lfo = c.createOscillator(); lfo.frequency.value = 7; const lg = c.createGain(); lg.gain.value = 12; lfo.connect(lg); lg.connect(o.frequency);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, c.currentTime); g.gain.linearRampToValueAtTime(0.1, c.currentTime + 0.3);
      o.frequency.exponentialRampToValueAtTime(220, c.currentTime + 2.5);
      o.connect(g); g.connect(this.sfxG); o.start(); lfo.start();
      this.chargeNode = { stop: () => { g.gain.setTargetAtTime(0.0001, c.currentTime, 0.08); o.stop(c.currentTime + 0.4); lfo.stop(c.currentTime + 0.4); } };
    } else if (!on && this.chargeNode) { this.chargeNode.stop(); this.chargeNode = null; }
  }

  // ---------- Music
  setMusic(mode: MusicMode) {
    if (mode === this.mode) return; this.mode = mode;
    if (!this.ctx) return;
    this.padNodes?.stop(); this.padNodes = null;
    const m = MODES[mode]; const c = this.ctx;
    // drone pad
    const g = c.createGain(); g.gain.value = 0; g.gain.linearRampToValueAtTime(0.09 * m.pad, c.currentTime + 2.5); g.connect(this.music);
    const oscs = [m.root / 2, m.root / 2 * 1.5, m.root].map((f, i) => {
      const o = c.createOscillator(); o.type = i === 2 ? 'sine' : 'triangle'; o.frequency.value = f; o.detune.value = i * 4; o.connect(g); o.start(); return o;
    });
    this.padNodes = { stop: () => { g.gain.setTargetAtTime(0, c.currentTime, 0.5); oscs.forEach((o) => o.stop(c.currentTime + 2)); } };
    this.step = 0; this.nextTime = c.currentTime + 0.1;
    if (this.timer === null) this.timer = window.setInterval(() => this.schedule(), 120);
  }
  private schedule() {
    if (!this.ctx || !this.mode || this.ctx.state !== 'running') return;
    const m = MODES[this.mode]; const c = this.ctx; const stepDur = 60 / m.bpm / 4;
    while (this.nextTime < c.currentTime + 0.35) {
      const when = Math.max(0, this.nextTime - c.currentTime); const s = this.step % 16;
      if (m.drums >= 1 && (s === 0 || (m.drums >= 2 && s === 8) || (m.drums >= 3 && (s === 6 || s === 14)))) this.taiko(when, s === 0 ? 1.2 : 1);
      if (m.drums >= 2 && (s === 4 || s === 12)) this.noise(0.06, 'bandpass', 1500, 800, 0.12, this.music, when);
      if (m.drums >= 3 && s % 2 === 0) this.noise(0.03, 'highpass', 6000, 6000, 0.05, this.music, when);
      if (Math.random() < m.density * (s % 4 === 0 ? 1.4 : 0.7)) {
        const deg = m.scale[Math.floor(Math.random() * m.scale.length)];
        const oct = Math.random() < 0.3 ? 2 : 1;
        this.pluck(m.root * m.oct * oct * Math.pow(2, deg / 12) * (Math.random() < 0.15 ? 2 : 1), when, 0.16 + Math.random() * 0.1);
      }
      this.nextTime += stepDur; this.step++;
    }
  }

  // ---------- Ambience
  setAmbience(zone: string, night: boolean) {
    const key = `${zone}|${night ? 1 : 0}`; if (key === this.ambKey) return; this.ambKey = key;
    if (!this.ctx) return;
    this.ambNodes?.stop();
    const c = this.ctx; const out = c.createGain(); out.gain.value = 0; out.gain.linearRampToValueAtTime(1, c.currentTime + 1.5); out.connect(this.amb);
    const stops: (() => void)[] = [];
    const loopNoise = (type: BiquadFilterType, freq: number, gain: number, lfoRate: number, lfoDepth: number) => {
      const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
      const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; const g = c.createGain(); g.gain.value = gain;
      const l = c.createOscillator(); l.frequency.value = lfoRate; const lg = c.createGain(); lg.gain.value = lfoDepth; l.connect(lg); lg.connect(g.gain);
      s.connect(f); f.connect(g); g.connect(out); s.start(); l.start(); stops.push(() => { s.stop(); l.stop(); });
    };
    let birds = false, crickets = false;
    switch (zone) {
      case 'forest': loopNoise('bandpass', 400, 0.15, 0.1, 0.06); crickets = true; break;
      case 'waves': loopNoise('lowpass', 500, 0.28, 0.12, 0.16); loopNoise('bandpass', 1200, 0.05, 0.3, 0.03); break;
      case 'sand': loopNoise('bandpass', 900, 0.2, 0.07, 0.1); break;
      case 'myoboku': loopNoise('lowpass', 700, 0.12, 0.05, 0.05); birds = !night; break;
      case 'valley': loopNoise('lowpass', 1400, 0.3, 0.2, 0.05); break;
      default: loopNoise('lowpass', 500, 0.1, 0.08, 0.05); birds = !night; crickets = night;
    }
    const iv = window.setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      if (birds && Math.random() < 0.55) { const f = 2200 + Math.random() * 1800; for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) this.tone(f, f * 1.25, 0.09, 'sine', 0.05, out, i * 0.12); }
      if (crickets) for (let i = 0; i < 4; i++) this.tone(4300, 4300, 0.04, 'square', 0.012, out, i * 0.07);
    }, 1100);
    this.ambNodes = { stop: () => { out.gain.setTargetAtTime(0, c.currentTime, 0.4); stops.forEach((s) => s()); clearInterval(iv); } };
  }
  stopAll() {
    this.padNodes?.stop(); this.padNodes = null; this.ambNodes?.stop(); this.ambNodes = null; this.ambKey = ''; this.mode = null;
    this.charge(false);
  }
}
export const audio = new AudioEngine();
export type { MusicMode };
