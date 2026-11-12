// Procedural Web Audio sound design (no external assets).
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let vol = 0.7;
let engOsc: OscillatorNode | null = null, engOsc2: OscillatorNode | null = null, engGain: GainNode | null = null;
let windGain: GainNode | null = null, rainGain: GainNode | null = null, ambGain: GainNode | null = null;
let musicTimer: number | null = null; let musicOn = true; let musicStep = 0;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext; ctx = new AC();
    master = ctx.createGain(); master.gain.value = vol; master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const loop = (type: BiquadFilterType, f: number, q = 1) => { const s = ctx!.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const fl = ctx!.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = ctx!.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(master!); s.start(); return g; };
    windGain = loop('bandpass', 900, 0.6); rainGain = loop('highpass', 3500); ambGain = loop('lowpass', 260); ambGain.gain.value = 0.05;
  } catch { ctx = null; }
}
export function setVolume(v: number) { vol = v; if (master) master.gain.value = v; }
const T = () => ctx!.currentTime;
function tone(f: number, dur: number, type: OscillatorType = 'sine', v = 0.2, to?: number, delay = 0) {
  if (!ctx || !master) return; const o = ctx.createOscillator(); const g = ctx.createGain(); o.type = type; const t0 = T() + delay; o.frequency.setValueAtTime(f, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.05);
}
function noise(dur: number, v = 0.2, f = 1200, type: BiquadFilterType = 'bandpass', to?: number, delay = 0, q = 1) {
  if (!ctx || !master || !noiseBuf) return; const s = ctx.createBufferSource(); s.buffer = noiseBuf; const fl = ctx.createBiquadFilter(); fl.type = type; const t0 = T() + delay; fl.frequency.setValueAtTime(f, t0); fl.Q.value = q;
  if (to) fl.frequency.exponentialRampToValueAtTime(Math.max(30, to), t0 + dur); const g = ctx.createGain(); g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(fl); fl.connect(g); g.connect(master); s.start(t0, Math.random()); s.stop(t0 + dur + 0.05);
}
let lastStep = 0;
export function sfx(n: string) {
  if (!ctx) return;
  switch (n) {
    case 'step': { const t = performance.now(); if (t - lastStep < 90) return; lastStep = t; noise(0.07, 0.07, 500 + Math.random() * 300, 'lowpass'); break; }
    case 'jump': tone(220, 0.18, 'sine', 0.12, 420); noise(0.1, 0.05, 800, 'lowpass'); break;
    case 'land': noise(0.25, 0.3, 400, 'lowpass', 80); tone(90, 0.2, 'sine', 0.25, 40); break;
    case 'slam': noise(0.7, 0.55, 600, 'lowpass', 50); tone(70, 0.6, 'sine', 0.5, 25); break;
    case 'boost': noise(0.6, 0.25, 400, 'bandpass', 2400, 0, 0.8); tone(120, 0.5, 'sawtooth', 0.08, 500); break;
    case 'dash': noise(0.25, 0.25, 900, 'bandpass', 3000, 0, 1.5); break;
    case 'swing': noise(0.18, 0.14, 1500, 'bandpass', 4200, 0, 2); break;
    case 'hit': noise(0.12, 0.3, 1200, 'lowpass', 200); tone(150, 0.1, 'square', 0.12, 60); break;
    case 'heavy': noise(0.3, 0.4, 800, 'lowpass', 90); tone(80, 0.3, 'sine', 0.4, 30); break;
    case 'block': tone(900, 0.12, 'square', 0.1, 400); noise(0.08, 0.15, 3000, 'highpass'); break;
    case 'shoot': tone(900, 0.2, 'sawtooth', 0.1, 120); break;
    case 'cast_bolt': tone(300, 0.35, 'sawtooth', 0.12, 900); noise(0.2, 0.1, 2000, 'bandpass', 600); break;
    case 'cast_beam': tone(200, 0.9, 'sawtooth', 0.14, 600); tone(402, 0.9, 'square', 0.06, 1200); noise(0.9, 0.12, 3000, 'highpass'); break;
    case 'cast_burst': tone(160, 0.5, 'sine', 0.3, 40); noise(0.5, 0.35, 700, 'lowpass', 100); break;
    case 'cast_blade': noise(0.3, 0.25, 600, 'bandpass', 5000, 0, 3); tone(1200, 0.2, 'triangle', 0.08, 300); break;
    case 'cast_shield': tone(400, 0.6, 'sine', 0.15, 800); tone(600, 0.6, 'sine', 0.1, 1200); break;
    case 'cast_field': tone(90, 1, 'sawtooth', 0.14, 160); noise(1, 0.15, 400, 'bandpass', 900); break;
    case 'cast_summon': tone(70, 0.9, 'sawtooth', 0.2, 220); tone(55, 0.9, 'square', 0.1, 110); break;
    case 'cast_rain': tone(110, 1.2, 'sawtooth', 0.15, 300); noise(1.2, 0.2, 500, 'lowpass', 2500); break;
    case 'cast_nova': tone(80, 1, 'sawtooth', 0.2, 700); noise(1, 0.2, 300, 'bandpass', 3000); break;
    case 'cast_strike': noise(0.4, 0.5, 5000, 'highpass'); tone(60, 0.5, 'sawtooth', 0.4, 30); break;
    case 'cast_heal': tone(500, 0.5, 'sine', 0.15, 900); tone(750, 0.5, 'sine', 0.1, 1400, 0.1); break;
    case 'explosion': noise(0.9, 0.6, 500, 'lowpass', 60); tone(60, 0.8, 'sine', 0.5, 25); break;
    case 'charge': tone(100, 0.8, 'sawtooth', 0.12, 900); break;
    case 'transform': tone(60, 2.5, 'sawtooth', 0.28, 520); tone(61, 2.5, 'sawtooth', 0.2, 530); noise(2.4, 0.3, 200, 'bandpass', 4000, 0, 0.7); tone(40, 0.8, 'sine', 0.6, 20, 2.2); noise(1, 0.6, 800, 'lowpass', 60, 2.2); break;
    case 'revert': tone(500, 0.8, 'sawtooth', 0.15, 80); break;
    case 'levelup': [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.4, 'triangle', 0.15, undefined, i * 0.1)); break;
    case 'equip': tone(700, 0.08, 'square', 0.08); tone(1000, 0.1, 'square', 0.08, undefined, 0.07); break;
    case 'heal': tone(500, 0.3, 'sine', 0.15, 900); break;
    case 'coin': tone(1400, 0.08, 'square', 0.08); tone(1900, 0.18, 'square', 0.08, undefined, 0.08); break;
    case 'mission': [392, 523, 659].forEach((f, i) => tone(f, 0.3, 'triangle', 0.14, undefined, i * 0.12)); break;
    case 'alarm': for (let i = 0; i < 4; i++) tone(i % 2 ? 600 : 900, 0.18, 'square', 0.09, undefined, i * 0.2); break;
    case 'hero': tone(330, 0.3, 'sawtooth', 0.1, 660); tone(440, 0.4, 'sawtooth', 0.1, 880, 0.2); break;
    case 'crash': noise(0.5, 0.5, 700, 'lowpass', 100); tone(110, 0.3, 'sawtooth', 0.3, 40); break;
    case 'steal': tone(300, 0.06, 'square', 0.07); tone(380, 0.06, 'square', 0.07, undefined, 0.1); break;
    case 'search': noise(0.2, 0.12, 900, 'bandpass', 500); break;
    case 'door': noise(0.3, 0.2, 400, 'lowpass', 120); tone(120, 0.2, 'square', 0.08, 70); break;
    case 'hurt': tone(220, 0.2, 'sawtooth', 0.15, 90); noise(0.15, 0.2, 800, 'lowpass'); break;
    case 'dead': tone(300, 1, 'sawtooth', 0.2, 40); break;
    case 'beep': tone(900, 0.07, 'square', 0.05); break;
    case 'thunder': noise(1.8, 0.7, 300, 'lowpass', 40); break;
  }
}
export function engineUpdate(on: boolean, speed: number, throttle: number, bike = false) {
  if (!ctx || !master) return;
  if (on && !engOsc) {
    engOsc = ctx.createOscillator(); engOsc2 = ctx.createOscillator(); engGain = ctx.createGain(); engOsc.type = 'sawtooth'; engOsc2.type = 'square'; engGain.gain.value = 0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600; engOsc.connect(lp); engOsc2.connect(lp); lp.connect(engGain); engGain.connect(master); engOsc.start(); engOsc2.start();
  }
  if (!on && engOsc) { engGain!.gain.setTargetAtTime(0, T(), 0.1); const o = engOsc, o2 = engOsc2!; setTimeout(() => { try { o.stop(); o2.stop(); } catch { /* */ } }, 400); engOsc = null; engOsc2 = null; return; }
  if (engOsc && engOsc2 && engGain) {
    const f = (bike ? 70 : 42) + Math.abs(speed) * (bike ? 4.2 : 3.2) + (Math.abs(speed) % 18) * 2; engOsc.frequency.setTargetAtTime(f, T(), 0.05); engOsc2.frequency.setTargetAtTime(f * 0.5, T(), 0.05);
    engGain.gain.setTargetAtTime(0.045 + throttle * 0.05, T(), 0.08);
  }
}
export function envUpdate(wind: number, rain: number) {
  if (!ctx) return; windGain?.gain.setTargetAtTime(Math.min(0.5, wind * 0.5), T(), 0.15); rainGain?.gain.setTargetAtTime(rain * 0.08, T(), 0.3);
}
const CH = [[146.8, 174.6, 220], [116.5, 146.8, 174.6], [98, 116.5, 146.8], [110, 138.6, 164.8]];
export function musicSet(on: boolean) {
  musicOn = on; if (!ctx) return;
  if (on && musicTimer == null) {
    musicTimer = window.setInterval(() => {
      if (!musicOn) return; const c = CH[Math.floor(musicStep / 2) % 4]; musicStep++;
      c.forEach((f, i) => tone(f, 3.8, 'sawtooth', 0.018, undefined, i * 0.05)); tone(c[0] / 2, 1.2, 'sine', 0.09);
      [0, 1, 2, 1].forEach((n, i) => tone(c[n] * 2, 0.5, 'triangle', 0.02, undefined, 0.6 + i * 0.5));
    }, 3800);
  } else if (!on && musicTimer != null) { clearInterval(musicTimer); musicTimer = null; }
}
