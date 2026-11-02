// Fully synthesized Web Audio: SFX (positional), ambience and procedural music.
import * as THREE from 'three';
import { useGame } from './store';

type Mode = 'none' | 'village' | 'dungeon' | 'boss';
class AudioSys {
  ctx: AudioContext | null = null; master!: GainNode; musicG!: GainNode; sfxG!: GainNode; ambG!: GainNode; noiseBuf!: AudioBuffer;
  mode: Mode = 'none'; timer: any = null; step = 0; nextT = 0; ambNodes: AudioNode[] = []; ambKind = '';
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const C = window.AudioContext || (window as any).webkitAudioContext; this.ctx = new C();
    } catch { return; }
    const c = this.ctx!;
    this.master = c.createGain(); this.master.connect(c.destination);
    this.musicG = c.createGain(); this.musicG.connect(this.master);
    this.sfxG = c.createGain(); this.sfxG.connect(this.master);
    this.ambG = c.createGain(); this.ambG.connect(this.master);
    const len = c.sampleRate * 2; this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.applyVolumes();
    this.timer = setInterval(() => this.tick(), 120);
  }
  applyVolumes() {
    if (!this.ctx) return; const s = useGame.getState().settings;
    this.master.gain.value = s.master; this.musicG.gain.value = s.music * 0.5; this.sfxG.gain.value = s.sfx; this.ambG.gain.value = s.ambience * 0.5;
  }
  setListener(cam: THREE.Camera) {
    if (!this.ctx) return; const l = this.ctx.listener; const p = cam.position; const f = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    if ((l as any).positionX) { (l as any).positionX.value = p.x; (l as any).positionY.value = p.y; (l as any).positionZ.value = p.z; (l as any).forwardX.value = f.x; (l as any).forwardY.value = f.y; (l as any).forwardZ.value = f.z; (l as any).upX.value = 0; (l as any).upY.value = 1; (l as any).upZ.value = 0; }
  }
  out(pos?: THREE.Vector3): AudioNode {
    const c = this.ctx!; if (!pos) return this.sfxG;
    const p = c.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 6; p.rolloffFactor = 1.1; p.maxDistance = 80;
    if ((p as any).positionX) { (p as any).positionX.value = pos.x; (p as any).positionY.value = pos.y; (p as any).positionZ.value = pos.z; }
    p.connect(this.sfxG); return p;
  }
  tone(f: number, dur: number, type: OscillatorType, vol: number, dest: AudioNode, slide = 0, delay = 0) {
    const c = this.ctx!; const t = c.currentTime + delay; const o = c.createOscillator(); const g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, dur / 4)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }
  noise(dur: number, freq: number, vol: number, dest: AudioNode, type: BiquadFilterType = 'bandpass', q = 1, sweep = 0, delay = 0) {
    const c = this.ctx!; const t = c.currentTime + delay; const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq + sweep), t + dur); f.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.03, dur / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  play(name: string, pos?: THREE.Vector3, vol = 1) {
    if (!this.ctx || this.ctx.state !== 'running') return; const d = this.out(pos); const v = vol;
    switch (name) {
      case 'swing': this.noise(0.18, 900, 0.35 * v, d, 'bandpass', 1.5, 2600); break;
      case 'swingHeavy': this.noise(0.3, 500, 0.5 * v, d, 'bandpass', 1.2, 2000); this.tone(110, 0.25, 'sawtooth', 0.08 * v, d, -40); break;
      case 'hit': this.noise(0.12, 1800, 0.5 * v, d, 'bandpass', 1); this.tone(180, 0.12, 'square', 0.18 * v, d, -100); break;
      case 'crit': this.noise(0.2, 2500, 0.6 * v, d, 'highpass', 1); this.tone(520, 0.18, 'triangle', 0.25 * v, d, 400); this.tone(140, 0.2, 'square', 0.25 * v, d, -80); break;
      case 'hurt': this.tone(200, 0.25, 'sawtooth', 0.25 * v, d, -120); this.noise(0.15, 600, 0.3 * v, d); break;
      case 'jump': this.tone(280, 0.14, 'sine', 0.12 * v, d, 220); break;
      case 'land': this.noise(0.14, 200, 0.4 * v, d, 'lowpass'); break;
      case 'step': this.noise(0.06, 500 + Math.random() * 300, 0.1 * v, d, 'bandpass', 2); break;
      case 'dodge': this.noise(0.22, 1200, 0.3 * v, d, 'bandpass', 1, -800); break;
      case 'parry': this.tone(1400, 0.25, 'triangle', 0.3 * v, d, -300); this.tone(2100, 0.3, 'sine', 0.2 * v, d, -600); this.noise(0.1, 4000, 0.4 * v, d, 'highpass'); break;
      case 'block': this.tone(300, 0.1, 'square', 0.2 * v, d, -100); this.noise(0.08, 3000, 0.3 * v, d, 'highpass'); break;
      case 'burst': this.tone(300, 0.4, 'sawtooth', 0.18 * v, d, 700); this.tone(150, 0.4, 'sine', 0.3 * v, d, 300); break;
      case 'rift': this.noise(0.5, 400, 0.6 * v, d, 'bandpass', 2, 3000); this.tone(90, 0.5, 'sawtooth', 0.2 * v, d, 200); break;
      case 'ult': this.tone(60, 1.8, 'sawtooth', 0.35 * v, d, 80); this.noise(1.6, 300, 0.6 * v, d, 'lowpass', 1, 1500); this.tone(440, 1.5, 'sine', 0.15 * v, d, 880); break;
      case 'ultHit': this.noise(0.5, 200, 0.9 * v, d, 'lowpass'); this.tone(55, 0.6, 'sine', 0.6 * v, d, -20); break;
      case 'transform': this.tone(110, 2.2, 'sawtooth', 0.3 * v, d, 330); this.tone(220, 2.2, 'sine', 0.3 * v, d, 880); this.noise(2, 500, 0.5 * v, d, 'bandpass', 1, 3500); break;
      case 'tfEnd': this.tone(660, 0.8, 'sine', 0.25 * v, d, -500); break;
      case 'pickup': this.tone(880, 0.1, 'triangle', 0.2 * v, d); this.tone(1320, 0.14, 'triangle', 0.2 * v, d, 0, 0.07); break;
      case 'chest': this.tone(300, 0.3, 'triangle', 0.25 * v, d, 300); this.tone(600, 0.4, 'sine', 0.25 * v, d, 400, 0.12); this.noise(0.3, 3000, 0.2 * v, d, 'highpass'); break;
      case 'levelup': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.25 * v, d, 0, i * 0.1)); break;
      case 'roar': this.tone(70, 1.1, 'sawtooth', 0.45 * v, d, -25); this.noise(1.1, 300, 0.6 * v, d, 'lowpass', 1, 500); break;
      case 'explode': this.noise(0.6, 250, 0.8 * v, d, 'lowpass', 1, -150); this.tone(60, 0.5, 'sine', 0.5 * v, d, -25); break;
      case 'slam': this.noise(0.4, 180, 0.9 * v, d, 'lowpass'); this.tone(50, 0.45, 'sine', 0.7 * v, d, -15); break;
      case 'shoot': this.tone(500, 0.2, 'square', 0.1 * v, d, -300); this.noise(0.15, 1500, 0.15 * v, d, 'bandpass'); break;
      case 'enemyAtk': this.noise(0.25, 400, 0.3 * v, d, 'bandpass', 1, 800); break;
      case 'death': this.tone(260, 0.6, 'sawtooth', 0.25 * v, d, -200); this.noise(0.4, 500, 0.3 * v, d, 'lowpass'); break;
      case 'victory': [392, 523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.7, 'triangle', 0.22 * v, d, 0, i * 0.14)); break;
      case 'defeat': [330, 262, 196, 130].forEach((f, i) => this.tone(f, 0.9, 'sawtooth', 0.2 * v, d, -20, i * 0.25)); break;
      case 'portal': this.tone(180, 1, 'sine', 0.25 * v, d, 500); this.noise(1, 800, 0.3 * v, d, 'bandpass', 2, 2000); break;
      case 'ui': this.tone(660, 0.07, 'triangle', 0.12 * v, d); break;
      case 'gate': this.noise(0.7, 150, 0.7 * v, d, 'lowpass'); this.tone(70, 0.7, 'sawtooth', 0.2 * v, d, -20); break;
      case 'quest': this.tone(587, 0.2, 'triangle', 0.22 * v, d); this.tone(880, 0.35, 'triangle', 0.22 * v, d, 0, 0.15); break;
    }
  }
  // ── Ambience ──
  setAmbience(kind: 'wind' | 'cave' | 'none') {
    if (!this.ctx || kind === this.ambKind) return; this.ambKind = kind;
    for (const n of this.ambNodes) { try { (n as any).stop?.(); n.disconnect(); } catch { /* */ } } this.ambNodes = [];
    if (kind === 'none') return; const c = this.ctx;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = kind === 'wind' ? 700 : 180;
    const g = c.createGain(); g.gain.value = kind === 'wind' ? 0.25 : 0.4; s.connect(f); f.connect(g); g.connect(this.ambG); s.start();
    const lfo = c.createOscillator(); const lg = c.createGain(); lfo.frequency.value = 0.15; lg.gain.value = kind === 'wind' ? 300 : 60; lfo.connect(lg); lg.connect(f.frequency); lfo.start();
    this.ambNodes.push(s, f, g, lfo, lg);
  }
  setMusic(m: Mode) { if (m === this.mode) return; this.mode = m; this.step = 0; }
  tick() {
    const c = this.ctx; if (!c || c.state !== 'running' || this.mode === 'none') return;
    if (this.nextT < c.currentTime) this.nextT = c.currentTime + 0.05;
    const mus = this.musicG;
    while (this.nextT < c.currentTime + 0.4) {
      const t = this.nextT - c.currentTime; const s = this.step++;
      if (this.mode === 'village') {
        const sc = [0, 2, 4, 7, 9, 12, 14, 16]; const root = 196;
        if (s % 2 === 0) this.tone(root * Math.pow(2, sc[(s * 3 + (s >> 3)) % sc.length] / 12), 1.2, 'triangle', 0.1, mus, 0, t);
        if (s % 16 === 0) { this.tone(root / 2, 3.5, 'sine', 0.12, mus, 0, t); this.tone(root * 0.75, 3.5, 'sine', 0.08, mus, 0, t); }
        this.nextT += 0.42;
      } else if (this.mode === 'dungeon') {
        if (s % 16 === 0) { this.tone(55, 4, 'sawtooth', 0.07, mus, 0, t); this.tone(82.4, 4, 'sine', 0.1, mus, 0, t); }
        if (s % 8 === 3 && Math.random() < 0.7) this.tone(220 * Math.pow(2, [0, 3, 5, 7, 10][Math.floor(Math.random() * 5)] / 12), 1.8, 'sine', 0.06, mus, 0, t);
        if (s % 32 === 20) this.tone(233, 2.4, 'triangle', 0.05, mus, -4, t);
        this.nextT += 0.5;
      } else {
        const notes = [0, 0, 3, 0, 5, 3, 7, 3]; const f = 82.4 * Math.pow(2, notes[s % 8] / 12);
        this.tone(f, 0.22, 'sawtooth', 0.12, mus, 0, t); this.tone(f * 2, 0.15, 'square', 0.04, mus, 0, t);
        if (s % 4 === 0) { this.tone(70, 0.3, 'sine', 0.35, mus, -40, t); }
        if (s % 4 === 2) this.noise(0.1, 4000, 0.08, mus, 'highpass', 1, 0, t);
        if (s % 16 === 8) this.tone(f * 4, 0.9, 'triangle', 0.06, mus, 0, t);
        this.nextT += 0.21;
      }
    }
  }
}
export const audio = new AudioSys();
