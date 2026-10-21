// ─── Procedural audio: Web Audio synthesized SFX + generative music ─────────

class AudioEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null; sfx: GainNode | null = null; musicBus: GainNode | null = null; ui: GainNode | null = null;
  musicTimer: number | null = null; musicMode: 'menu' | 'combat' | 'boss' | 'off' = 'off';
  step = 0; engineOsc: OscillatorNode | null = null; engineGain: GainNode | null = null;
  vols = { master: 0.8, music: 0.5, sfx: 0.8, ui: 0.6 };

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = this.vols.master; this.master.connect(this.ctx.destination);
      this.sfx = this.ctx.createGain(); this.sfx.gain.value = this.vols.sfx; this.sfx.connect(this.master);
      this.musicBus = this.ctx.createGain(); this.musicBus.gain.value = this.vols.music; this.musicBus.connect(this.master);
      this.ui = this.ctx.createGain(); this.ui.gain.value = this.vols.ui; this.ui.connect(this.master);
    } catch { /* audio unavailable */ }
  }

  setVolumes(v: typeof this.vols) {
    this.vols = v;
    if (this.master) this.master.gain.value = v.master;
    if (this.sfx) this.sfx.gain.value = v.sfx;
    if (this.musicBus) this.musicBus.gain.value = v.music;
    if (this.ui) this.ui.gain.value = v.ui;
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, dest?: GainNode | null, slideTo?: number, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest ?? this.sfx!); o.start(t); o.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, freq: number, type: BiquadFilterType = 'lowpass', delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.sfx!); src.start(t);
  }

  // ── SFX vocabulary ──
  shoot(kind = 'projectile') {
    if (kind === 'beam') { this.tone(180, 0.18, 'sawtooth', 0.10, null, 90); return; }
    if (kind === 'arc') { this.noise(0.16, 0.20, 3200, 'highpass'); this.tone(1400, 0.12, 'square', 0.06, null, 300); return; }
    if (kind === 'charge') { this.tone(1200, 0.35, 'sawtooth', 0.22, null, 140); this.noise(0.3, 0.16, 1800); return; }
    this.tone(880 + Math.random() * 220, 0.09, 'square', 0.07, null, 240);
  }
  missile() { this.noise(0.45, 0.18, 900); this.tone(220, 0.4, 'sawtooth', 0.08, null, 520); }
  explosion(big = false) { this.noise(big ? 1.1 : 0.45, big ? 0.5 : 0.28, big ? 320 : 700); this.tone(big ? 90 : 130, big ? 0.9 : 0.4, 'sine', big ? 0.45 : 0.22, null, 35); }
  shieldHit() { this.tone(620, 0.1, 'sine', 0.10, null, 320); }
  hullHit() { this.noise(0.14, 0.2, 1400); this.tone(160, 0.14, 'triangle', 0.16, null, 70); }
  playerHit() { this.noise(0.2, 0.26, 900); this.tone(110, 0.22, 'sawtooth', 0.2, null, 55); }
  lock(progress: number) { this.tone(900 + progress * 700, 0.05, 'square', 0.05); }
  locked() { this.tone(1560, 0.12, 'square', 0.10); this.tone(1560, 0.12, 'square', 0.10, null, undefined, 0.13); }
  warning() { this.tone(1180, 0.09, 'square', 0.09); }
  boost() { this.noise(0.5, 0.14, 500); this.tone(140, 0.5, 'sawtooth', 0.07, null, 420); }
  ability() { this.tone(420, 0.35, 'sine', 0.16, null, 1250); this.noise(0.3, 0.08, 2600, 'highpass'); }
  ultimate() { [196, 294, 392, 587].forEach((f, i) => this.tone(f, 0.5, 'sawtooth', 0.12, null, undefined, i * 0.09)); this.noise(0.8, 0.2, 800); }
  emp() { this.tone(90, 0.7, 'sawtooth', 0.25, null, 1600); this.noise(0.6, 0.2, 4000, 'highpass'); }
  pickup() { this.tone(660, 0.1, 'sine', 0.12); this.tone(990, 0.16, 'sine', 0.12, null, undefined, 0.09); }
  click() { this.tone(980, 0.05, 'sine', 0.08, this.ui); }
  hover() { this.tone(740, 0.03, 'sine', 0.04, this.ui); }
  buy() { [523, 784, 1046].forEach((f, i) => this.tone(f, 0.14, 'triangle', 0.12, this.ui, undefined, i * 0.07)); }
  denied() { this.tone(185, 0.18, 'square', 0.1, this.ui); }
  success() { [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.14, this.ui, undefined, i * 0.11)); }
  fail() { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.4, 'triangle', 0.14, this.ui, undefined, i * 0.13)); }
  bossAlarm() { for (let i = 0; i < 3; i++) { this.tone(220, 0.3, 'sawtooth', 0.16, null, 110, i * 0.35); } }
  teleport() { this.tone(1800, 0.25, 'sine', 0.12, null, 200); }

  startEngine() {
    if (!this.ctx || this.engineOsc) return;
    this.engineOsc = this.ctx.createOscillator(); this.engineGain = this.ctx.createGain();
    this.engineOsc.type = 'sawtooth'; this.engineOsc.frequency.value = 52; this.engineGain.gain.value = 0.025;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220;
    this.engineOsc.connect(f); f.connect(this.engineGain); this.engineGain.connect(this.sfx!);
    this.engineOsc.start();
  }
  setEngine(speedNorm: number) { if (this.engineOsc && this.ctx) this.engineOsc.frequency.setTargetAtTime(46 + speedNorm * 70, this.ctx.currentTime, 0.1); }
  stopEngine() { try { this.engineOsc?.stop(); } catch { /* noop */ } this.engineOsc = null; this.engineGain = null; }

  // ── Generative music: minor-key bass pulse + pad ──
  setMusic(mode: 'menu' | 'combat' | 'boss' | 'off') {
    if (this.musicMode === mode) return;
    this.musicMode = mode;
    if (this.musicTimer) { window.clearInterval(this.musicTimer); this.musicTimer = null; }
    if (mode === 'off' || !this.ctx) return;
    this.step = 0;
    const roots = [55, 55, 65.4, 49]; // A1, A1, C2, G1
    const interval = mode === 'boss' ? 210 : mode === 'combat' ? 260 : 460;
    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || this.musicMode === 'off') return;
      const bar = Math.floor(this.step / 8) % 4;
      const root = roots[bar];
      if (this.step % 2 === 0) this.tone(root * 2, 0.22, 'sawtooth', mode === 'menu' ? 0.03 : 0.055, this.musicBus);
      if (this.step % 8 === 0) { this.tone(root * 4, 1.6, 'triangle', 0.045, this.musicBus); this.tone(root * 6, 1.6, 'sine', 0.03, this.musicBus); }
      if (mode !== 'menu' && this.step % 4 === 2) this.tone(root * 8, 0.18, 'square', 0.022, this.musicBus);
      if (mode === 'boss' && this.step % 8 === 4) this.tone(root * 3, 0.3, 'sawtooth', 0.05, this.musicBus, root * 2.8);
      this.step++;
    }, interval);
  }
}

export const audio = new AudioEngine();
