// Fully procedural Web Audio: music, sfx, engine, wind, waterfall, forest ambience. No external assets.
type Mood = 'menu' | 'explore' | 'frost' | 'ember' | 'shadow' | 'celestial' | 'battle' | 'boss' | 'airship' | 'none';
interface MoodDef { root: number; scale: number[]; chords: number[][]; bpm: number; arp: number; drums: number; padCut: number; padVol: number }
const MOODS: Record<Exclude<Mood, 'none'>, MoodDef> = {
  menu: { root: 50, scale: [0, 2, 3, 5, 7, 8, 10], chords: [[0, 2, 4], [5, 0, 2], [2, 4, 6], [6, 1, 3]], bpm: 70, arp: 0.5, drums: 0.5, padCut: 1400, padVol: 0.5 },
  explore: { root: 52, scale: [0, 2, 4, 6, 7, 9, 11], chords: [[0, 2, 4], [3, 5, 0], [4, 6, 1], [0, 2, 4]], bpm: 76, arp: 0.45, drums: 0, padCut: 1600, padVol: 0.5 },
  frost: { root: 57, scale: [0, 2, 3, 5, 7, 9, 10], chords: [[0, 2, 4], [5, 0, 2], [3, 5, 0], [4, 6, 1]], bpm: 60, arp: 0.35, drums: 0, padCut: 1900, padVol: 0.45 },
  ember: { root: 45, scale: [0, 1, 4, 5, 7, 8, 10], chords: [[0, 2, 4], [1, 3, 5], [0, 2, 4], [6, 1, 3]], bpm: 88, arp: 0.35, drums: 0.5, padCut: 1000, padVol: 0.5 },
  shadow: { root: 43, scale: [0, 2, 3, 5, 6, 8, 11], chords: [[0, 2, 4], [0, 3, 5], [1, 3, 5], [0, 2, 4]], bpm: 54, arp: 0.2, drums: 0, padCut: 700, padVol: 0.6 },
  celestial: { root: 53, scale: [0, 2, 4, 6, 7, 9, 11], chords: [[0, 2, 4], [4, 6, 1], [5, 0, 2], [3, 5, 0]], bpm: 66, arp: 0.6, drums: 0, padCut: 2600, padVol: 0.45 },
  battle: { root: 47, scale: [0, 2, 3, 5, 7, 8, 10], chords: [[0, 2, 4], [5, 0, 2], [6, 1, 3], [4, 6, 1]], bpm: 112, arp: 0.5, drums: 1, padCut: 1300, padVol: 0.4 },
  boss: { root: 40, scale: [0, 1, 3, 5, 7, 8, 10], chords: [[0, 2, 4], [1, 3, 5], [0, 2, 4], [6, 1, 3]], bpm: 130, arp: 0.65, drums: 2, padCut: 1100, padVol: 0.5 },
  airship: { root: 55, scale: [0, 2, 4, 5, 7, 9, 11], chords: [[0, 2, 4], [4, 6, 1], [5, 0, 2], [3, 5, 0]], bpm: 84, arp: 0.55, drums: 0.4, padCut: 2000, padVol: 0.45 },
};
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

class AudioEngine {
  ctx: AudioContext | null = null; master!: GainNode; music!: GainNode; sfxBus!: GainNode;
  noise!: AudioBuffer; vol = { master: 0.8, music: 0.5, sfx: 0.8 };
  eng: { o1: OscillatorNode; o2: OscillatorNode; g: GainNode; f: BiquadFilterNode } | null = null;
  wind: { g: GainNode; f: BiquadFilterNode } | null = null; fall: { g: GainNode } | null = null;
  mood: Mood = 'none'; nextBeat = 0; beat = 0; timer: any = null; chordIdx = 0; chirpT = 0;
  last: Record<string, number> = {};

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext; const c = (this.ctx = new AC());
      this.master = c.createGain(); this.music = c.createGain(); this.sfxBus = c.createGain();
      const comp = c.createDynamicsCompressor(); this.music.connect(this.master); this.sfxBus.connect(this.master); this.master.connect(comp); comp.connect(c.destination);
      this.noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate); const d = this.noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.applyVolumes();
      // ambience beds
      const ns = () => { const s = c.createBufferSource(); s.buffer = this.noise; s.loop = true; return s; };
      const w = ns(), wf = c.createBiquadFilter(), wg = c.createGain(); wf.type = 'bandpass'; wf.frequency.value = 500; wf.Q.value = 0.6; wg.gain.value = 0; w.connect(wf); wf.connect(wg); wg.connect(this.sfxBus); w.start(); this.wind = { g: wg, f: wf };
      const f = ns(), ff = c.createBiquadFilter(), fg = c.createGain(); ff.type = 'lowpass'; ff.frequency.value = 900; fg.gain.value = 0; f.connect(ff); ff.connect(fg); fg.connect(this.sfxBus); f.start(); this.fall = { g: fg };
      const o1 = c.createOscillator(), o2 = c.createOscillator(), eg = c.createGain(), ef = c.createBiquadFilter(); o1.type = 'sawtooth'; o2.type = 'square'; ef.type = 'lowpass'; ef.frequency.value = 300; eg.gain.value = 0;
      o1.connect(ef); o2.connect(ef); ef.connect(eg); eg.connect(this.sfxBus); o1.start(); o2.start(); this.eng = { o1, o2, g: eg, f: ef };
      this.timer = setInterval(() => this.schedule(), 90);
    } catch { /* audio unsupported */ }
  }
  applyVolumes() { if (!this.ctx) return; const t = this.ctx.currentTime; this.master.gain.setTargetAtTime(this.vol.master, t, 0.05); this.music.gain.setTargetAtTime(this.vol.music * 0.55, t, 0.05); this.sfxBus.gain.setTargetAtTime(this.vol.sfx, t, 0.05); }
  setVolumes(m: number, mu: number, s: number) { this.vol = { master: m, music: mu, sfx: s }; this.applyVolumes(); }
  setMood(m: Mood) { if (m !== this.mood) { this.mood = m; this.chordIdx = 0; this.beat = 0; if (this.ctx) this.nextBeat = Math.max(this.nextBeat, this.ctx.currentTime + 0.1); } }

  tone(f: number, dur: number, type: OscillatorType, vol: number, f2?: number, dest?: AudioNode, delay = 0, attack = 0.005) {
    const c = this.ctx; if (!c) return; const t = c.currentTime + delay; const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.sfxBus); o.start(t); o.stop(t + dur + 0.05);
  }
  nz(dur: number, vol: number, type: BiquadFilterType, f0: number, f1: number, q = 1, delay = 0, attack = 0.005) {
    const c = this.ctx; if (!c) return; const t = c.currentTime + delay; const s = c.createBufferSource(); s.buffer = this.noise; const f = c.createBiquadFilter(), g = c.createGain();
    f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfxBus); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  sfx(name: string, vol = 1) {
    if (!this.ctx) return; const c = this.ctx; const now = c.currentTime;
    const lim = this.last[name] || 0; if (now - lim < (name === 'repeater' ? 0.05 : 0.03)) return; this.last[name] = now;
    const v = vol;
    switch (name) {
      case 'swing': this.nz(0.2, 0.25 * v, 'bandpass', 600, 3000, 1.2, 0, 0.04); break;
      case 'heavy': this.nz(0.4, 0.35 * v, 'bandpass', 300, 2000, 1, 0, 0.12); this.tone(110, 0.3, 'sawtooth', 0.1 * v, 60); break;
      case 'hit': this.nz(0.12, 0.4 * v, 'highpass', 2500, 800, 0.8); this.tone(160, 0.15, 'sine', 0.35 * v, 60); this.tone(900, 0.08, 'square', 0.08 * v, 400); break;
      case 'crit': this.sfx('hit', v); this.tone(1400, 0.25, 'triangle', 0.2 * v, 2400); this.tone(1900, 0.3, 'sine', 0.12 * v, 2800, undefined, 0.04); break;
      case 'bow': this.tone(300, 0.12, 'triangle', 0.2 * v, 120); this.nz(0.15, 0.15 * v, 'bandpass', 1500, 4000, 2); break;
      case 'fire': this.nz(0.6, 0.5 * v, 'lowpass', 2500, 200, 0.7, 0, 0.05); this.tone(180, 0.5, 'sawtooth', 0.12 * v, 70); break;
      case 'ice': for (let i = 0; i < 4; i++) this.tone(1800 + i * 450, 0.4, 'sine', 0.12 * v, 3200 + i * 300, undefined, i * 0.05); this.nz(0.3, 0.12 * v, 'highpass', 5000, 8000); break;
      case 'wind': this.nz(0.5, 0.4 * v, 'bandpass', 400, 2400, 2, 0, 0.1); break;
      case 'lightning': this.nz(0.5, 0.65 * v, 'highpass', 4000, 300, 0.5); this.tone(80, 0.6, 'sawtooth', 0.35 * v, 30); this.tone(1800, 0.2, 'square', 0.1 * v, 200); break;
      case 'earth': this.tone(70, 0.5, 'sine', 0.5 * v, 40); this.nz(0.4, 0.4 * v, 'lowpass', 800, 100); break;
      case 'arcane': this.tone(220, 0.8, 'sawtooth', 0.2 * v, 880); this.tone(440, 0.9, 'sine', 0.25 * v, 110); this.nz(0.7, 0.35 * v, 'lowpass', 3000, 100, 1, 0.25); break;
      case 'explosion': this.nz(0.9, 0.8 * v, 'lowpass', 1800, 60, 0.7); this.tone(90, 0.7, 'sine', 0.6 * v, 28); break;
      case 'cannon': this.nz(0.5, 0.6 * v, 'lowpass', 1200, 80); this.tone(120, 0.35, 'sine', 0.5 * v, 40); break;
      case 'repeater': this.nz(0.06, 0.2 * v, 'bandpass', 2200, 1200, 2); this.tone(520, 0.05, 'square', 0.06 * v, 260); break;
      case 'missile': this.nz(0.6, 0.35 * v, 'bandpass', 800, 3000, 1.5, 0, 0.1); break;
      case 'energy': this.tone(200, 0.9, 'sawtooth', 0.25 * v, 1600); this.tone(100, 1, 'sine', 0.4 * v, 400); this.nz(0.7, 0.3 * v, 'highpass', 1000, 6000, 1, 0.2); break;
      case 'bomb': this.tone(900, 0.5, 'sine', 0.12 * v, 300); break;
      case 'jump': this.tone(280, 0.15, 'sine', 0.12 * v, 480); break;
      case 'land': this.nz(0.12, 0.2 * v, 'lowpass', 600, 120); break;
      case 'dodge': this.nz(0.22, 0.25 * v, 'bandpass', 2000, 500, 1); break;
      case 'hurt': this.tone(200, 0.25, 'sawtooth', 0.25 * v, 90); this.nz(0.15, 0.25 * v, 'lowpass', 1500, 300); break;
      case 'block': this.tone(700, 0.15, 'square', 0.2 * v, 500); this.nz(0.1, 0.3 * v, 'highpass', 3000, 2000); break;
      case 'pickup': this.tone(880, 0.12, 'triangle', 0.18 * v); this.tone(1320, 0.18, 'triangle', 0.18 * v, undefined, undefined, 0.07); break;
      case 'coin': this.tone(1500, 0.1, 'square', 0.08 * v); this.tone(2000, 0.2, 'square', 0.08 * v, undefined, undefined, 0.07); break;
      case 'chop': this.nz(0.1, 0.45 * v, 'bandpass', 700, 300, 2); this.tone(120, 0.1, 'square', 0.15 * v, 70); break;
      case 'mine': this.tone(1200, 0.1, 'square', 0.12 * v, 800); this.nz(0.1, 0.4 * v, 'highpass', 3000, 1500); break;
      case 'levelup': [0, 4, 7, 12, 16].forEach((n, i) => this.tone(mtof(64 + n), 0.5, 'triangle', 0.2 * v, undefined, undefined, i * 0.09)); break;
      case 'quest': [0, 7, 12].forEach((n, i) => this.tone(mtof(67 + n), 0.5, 'sine', 0.22 * v, undefined, undefined, i * 0.12)); break;
      case 'click': this.tone(660, 0.06, 'square', 0.06 * v, 440); break;
      case 'hover': this.tone(1200, 0.04, 'sine', 0.04 * v); break;
      case 'open': this.tone(400, 0.2, 'sine', 0.1 * v, 800); break;
      case 'error': this.tone(160, 0.2, 'square', 0.12 * v, 100); break;
      case 'blip': this.tone(500 + Math.random() * 300, 0.05, 'square', 0.04 * v); break;
      case 'build': this.nz(0.1, 0.4 * v, 'bandpass', 600, 400, 2); this.tone(110, 0.12, 'square', 0.14 * v, 80); break;
      case 'death': this.tone(300, 0.6, 'sawtooth', 0.2 * v, 40); this.nz(0.5, 0.2 * v, 'lowpass', 1500, 100); break;
      case 'roar_dragon': this.tone(90, 1.8, 'sawtooth', 0.45 * v, 50, undefined, 0, 0.2); this.tone(135, 1.6, 'sawtooth', 0.3 * v, 70, undefined, 0.05, 0.2); this.nz(1.7, 0.5 * v, 'bandpass', 500, 160, 1.2, 0, 0.25); break;
      case 'roar_golem': this.tone(55, 1.4, 'square', 0.4 * v, 35, undefined, 0, 0.15); this.nz(1.3, 0.55 * v, 'lowpass', 500, 80, 1, 0, 0.2); break;
      case 'roar_shadow': this.tone(70, 2, 'sawtooth', 0.35 * v, 140, undefined, 0, 0.4); this.tone(72, 2, 'sawtooth', 0.3 * v, 38, undefined, 0.1, 0.4); this.nz(1.8, 0.3 * v, 'bandpass', 300, 900, 3, 0.2, 0.4); break;
      case 'roar_wolf': this.tone(380, 0.5, 'sawtooth', 0.12 * v, 160, undefined, 0, 0.08); this.nz(0.4, 0.15 * v, 'bandpass', 900, 400, 3); break;
      case 'roar_harpy': this.tone(900, 0.35, 'sawtooth', 0.1 * v, 1500, undefined, 0, 0.04); this.tone(1300, 0.3, 'square', 0.05 * v, 800); break;
      case 'roar_goblin': this.tone(260, 0.2, 'square', 0.1 * v, 180); this.tone(300, 0.2, 'square', 0.08 * v, 220, undefined, 0.15); break;
      case 'roar_fire': this.nz(0.6, 0.3 * v, 'bandpass', 1500, 300, 1.5, 0, 0.1); break;
      case 'roar_yeti': this.tone(110, 0.8, 'sawtooth', 0.28 * v, 60, undefined, 0, 0.1); break;
      case 'roar_mech': this.tone(220, 0.3, 'square', 0.12 * v, 110); this.tone(330, 0.2, 'square', 0.08 * v, 160, undefined, 0.15); break;
      case 'npc': this.tone(400, 0.08, 'triangle', 0.1 * v, 600); this.tone(600, 0.1, 'triangle', 0.1 * v, 500, undefined, 0.09); break;
      case 'boss': [0, 3, 7].forEach((n, i) => this.tone(mtof(33 + n), 2.5, 'sawtooth', 0.15 * v, undefined, undefined, i * 0.1, 0.4)); break;
      case 'splash': this.nz(0.35, 0.3 * v, 'bandpass', 1200, 400, 0.8); break;
      case 'chest': [0, 4, 7, 12].forEach((n, i) => this.tone(mtof(72 + n), 0.3, 'triangle', 0.15 * v, undefined, undefined, i * 0.07)); break;
      case 'tick': this.tone(1800, 0.03, 'square', 0.05 * v); break;
    }
  }
  roar(kind: string) { this.sfx('roar_' + kind); }

  // continuous params
  update(dt: number, p: { shipSpeed: number; shipThrottle: number; inShip: boolean; speed: number; alt: number; waterNear: number; biome: string; night: boolean; mood: Mood; storm: number }) {
    const c = this.ctx; if (!c) return; const t = c.currentTime;
    this.setMood(p.mood);
    if (this.eng) { const th = p.inShip ? 0.25 + p.shipThrottle * 0.75 : 0; this.eng.g.gain.setTargetAtTime(p.inShip ? 0.09 * th : 0, t, 0.15); const f = 38 + p.shipSpeed * 0.9 + th * 18; this.eng.o1.frequency.setTargetAtTime(f, t, 0.1); this.eng.o2.frequency.setTargetAtTime(f * 0.503, t, 0.1); this.eng.f.frequency.setTargetAtTime(200 + th * 500, t, 0.1); }
    if (this.wind) { const spd = p.inShip ? p.shipSpeed : p.speed * 2; const g = Math.min(0.32, 0.03 + spd * 0.005 + Math.max(0, p.alt) * 0.0003 + p.storm * 0.25); this.wind.g.gain.setTargetAtTime(g, t, 0.3); this.wind.f.frequency.setTargetAtTime(350 + spd * 14 + p.storm * 500, t, 0.3); }
    if (this.fall) this.fall.g.gain.setTargetAtTime(Math.min(0.35, p.waterNear * 0.4), t, 0.3);
    this.chirpT -= dt;
    if (this.chirpT < 0) {
      this.chirpT = 0.4 + Math.random() * 2.2;
      if (!p.inShip && p.alt < 40 && p.biome === 'emerald') {
        if (!p.night) { const b = 2400 + Math.random() * 1800; this.tone(b, 0.08, 'sine', 0.05, b * 1.3); this.tone(b * 1.2, 0.08, 'sine', 0.05, b * 0.9, undefined, 0.1); }
        else { this.tone(3600, 0.05, 'sine', 0.025); this.tone(3600, 0.05, 'sine', 0.025, undefined, undefined, 0.09); }
      } else if (!p.inShip && p.biome === 'shadow' && Math.random() < 0.4) this.tone(150 + Math.random() * 60, 1.2, 'sine', 0.04, 90, undefined, 0, 0.4);
    }
  }

  schedule() {
    const c = this.ctx; if (!c || this.mood === 'none' || c.state !== 'running') return; const m = MOODS[this.mood]; const spb = 60 / m.bpm;
    while (this.nextBeat < c.currentTime + 0.3) {
      const t = this.nextBeat - c.currentTime; const b = this.beat; const chord = m.chords[this.chordIdx % m.chords.length];
      const deg = (d: number, oct = 0) => m.root + 12 * (Math.floor(d / 7) + oct) + m.scale[((d % 7) + 7) % 7];
      if (b % 8 === 0) { // pad
        for (const d of chord) { const f = mtof(deg(d, 0)); for (const det of [-6, 6]) { const o = c.createOscillator(), g = c.createGain(), fl = c.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; fl.type = 'lowpass'; fl.frequency.value = m.padCut; const T = c.currentTime + t, D = spb * 8; g.gain.setValueAtTime(0.0001, T); g.gain.linearRampToValueAtTime(0.05 * m.padVol, T + D * 0.35); g.gain.linearRampToValueAtTime(0.0001, T + D * 1.05); o.connect(fl); fl.connect(g); g.connect(this.music); o.start(T); o.stop(T + D * 1.1); } }
        this.tone(mtof(deg(chord[0], -1) - 0), spb * 7, 'sine', 0.22 * m.padVol, undefined, this.music, t, 0.3);
      }
      if (Math.random() < m.arp * 0.6 && b % 2 === 0) { const d = chord[Math.floor(Math.random() * 3)] + (Math.random() < 0.4 ? 7 : 0); this.tone(mtof(deg(d, 1)), spb * 1.6, 'triangle', 0.06, undefined, this.music, t, 0.01); if (Math.random() < 0.3) this.tone(mtof(deg(d, 2)), spb * 1.2, 'sine', 0.03, undefined, this.music, t + spb * 0.5); }
      if (m.drums > 0) {
        if (b % 4 === 0) this.tone(130, 0.25, 'sine', 0.35 * Math.min(1, m.drums), 40, this.music, t);
        if (m.drums >= 1 && b % 4 === 2) this.nz(0.15, 0.12, 'bandpass', 1800, 900, 1, t);
        if (m.drums >= 2 && b % 2 === 1) this.tone(90, 0.12, 'sine', 0.2, 45, this.music, t);
        if (m.drums < 1 && b % 8 === 4) this.tone(100, 0.4, 'sine', 0.2, 40, this.music, t);
      }
      this.nextBeat += spb; this.beat++; if (this.beat % 8 === 0) this.chordIdx++;
    }
  }
}
export const audio = new AudioEngine();
(window as any).__sfx = (n: string) => audio.sfx(n);
export const sfx = (n: string, v = 1) => audio.sfx(n, v);
