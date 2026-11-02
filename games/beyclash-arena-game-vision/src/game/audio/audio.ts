// Procedural Web Audio: no external audio files, fully offline and copyright-safe.
type MusicMode = 'menu' | 'city' | 'battle' | 'none';

let ctx: AudioContext | null = null;
let sfxGain: GainNode, musicGain: GainNode, ambGain: GainNode;
let noiseBuf: AudioBuffer;
let sfxVol = 0.7;
let musicVol = 0.5;
let ambTimer: number | undefined;
let musicTimer: number | undefined;
let mode: MusicMode = 'none';
let nextNote = 0;
let step = 0;
let ambSrc: AudioBufferSourceNode | null = null;
let spinOsc: OscillatorNode | null = null;
let spinGain: GainNode | null = null;
let night = false;
let allowed = false; // AudioContext is only created after a user gesture (browser autoplay policy)
let wantAmbient = false;

function ensure(): AudioContext | null {
  if (ctx) return ctx;
  if (!allowed) return null;
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    ctx = new AC();
  } catch { return null; }
  sfxGain = ctx.createGain(); sfxGain.gain.value = sfxVol; sfxGain.connect(ctx.destination);
  musicGain = ctx.createGain(); musicGain.gain.value = musicVol * 0.35; musicGain.connect(ctx.destination);
  ambGain = ctx.createGain(); ambGain.gain.value = 0; ambGain.connect(sfxGain);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.04 * w) / 1.04; d[i] = last * 8; }
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.2, slide = 0, dest: AudioNode | null = null, when = 0) {
  const c = ensure(); if (!c || c.state === 'closed') return;
  const t0 = c.currentTime + when;
  const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(dest ?? sfxGain); o.start(t0); o.stop(t0 + dur + 0.05);
}

function noise(dur: number, vol: number, freq: number, q = 1, type: BiquadFilterType = 'bandpass', dest: AudioNode | null = null) {
  const c = ensure(); if (!c) return;
  const s = c.createBufferSource(); s.buffer = noiseBuf;
  const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = c.createGain(); const t0 = c.currentTime;
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f); f.connect(g); g.connect(dest ?? sfxGain); s.start(t0, Math.random()); s.stop(t0 + dur + 0.05);
}

const A_MIN = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25, 783.99];
const CHORDS = [[0, 2, 4], [5 - 5, 3, 5], [2, 4, 6], [1, 3, 5]];

function scheduleMusic() {
  const c = ctx; if (!c || mode === 'none') return;
  const bpm = mode === 'battle' ? 148 : mode === 'menu' ? 104 : 92;
  const stepDur = 60 / bpm / 2;
  while (nextNote < c.currentTime + 0.25) {
    const t = nextNote - c.currentTime;
    const bar = Math.floor(step / 8) % 4;
    const chord = CHORDS[bar];
    const s8 = step % 8;
    if (mode === 'battle') {
      tone(A_MIN[chord[0]] / 2, stepDur * 0.9, 'sawtooth', 0.22, 0, musicGain, t);
      if (s8 % 2 === 0) noise(0.05, 0.35, 7000, 2, 'highpass', musicGain);
      if (s8 === 0 || s8 === 4) tone(90, 0.16, 'sine', 0.7, -50, musicGain, t);
      if (s8 % 2 === 1) tone(A_MIN[chord[(s8 >> 1) % 3] + 2], stepDur, 'square', 0.1, 0, musicGain, t);
    } else {
      if (s8 === 0) chord.forEach((n) => tone(A_MIN[n], stepDur * 7.5, 'triangle', 0.12, 0, musicGain, t));
      tone(A_MIN[chord[s8 % 3] + (s8 > 3 ? 3 : 2)], stepDur * 1.6, mode === 'menu' ? 'square' : 'sine', mode === 'menu' ? 0.06 : 0.1, 0, musicGain, t);
      if (s8 % 4 === 0) tone(A_MIN[chord[0]] / 2, stepDur * 3, 'sine', 0.25, 0, musicGain, t);
    }
    nextNote += stepDur;
    step++;
  }
}

export const audio = {
  unlock() {
    allowed = true;
    const c = ensure();
    if (!c) return;
    if (c.state === 'suspended') void c.resume();
    if (mode !== 'none' && !musicTimer) { nextNote = c.currentTime + 0.1; step = 0; musicTimer = window.setInterval(scheduleMusic, 90); }
    if (wantAmbient && !ambTimer) audio.ambient(true);
  },
  setVolumes(sfx: number, music: number) {
    sfxVol = sfx; musicVol = music;
    if (ctx) { sfxGain.gain.value = sfx; musicGain.gain.value = music * 0.35; }
  },
  setNight(n: boolean) { night = n; },
  music(m: MusicMode) {
    if (m === mode) return;
    mode = m;
    const c = ensure();
    if (musicTimer) { clearInterval(musicTimer); musicTimer = undefined; }
    if (!c || m === 'none') return;
    nextNote = c.currentTime + 0.1; step = 0;
    musicTimer = window.setInterval(scheduleMusic, 90);
  },
  ambient(on: boolean) {
    wantAmbient = on;
    const c = ensure(); if (!c) return;
    if (ambTimer) { clearInterval(ambTimer); ambTimer = undefined; }
    if (ambSrc) { try { ambSrc.stop(); } catch { /* */ } ambSrc = null; }
    ambGain.gain.value = on ? 1 : 0;
    if (!on) return;
    ambSrc = c.createBufferSource(); ambSrc.buffer = noiseBuf; ambSrc.loop = true;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380;
    const g = c.createGain(); g.gain.value = 0.05;
    ambSrc.connect(f); f.connect(g); g.connect(ambGain); ambSrc.start();
    ambTimer = window.setInterval(() => {
      if (!night) { tone(2200 + Math.random() * 1500, 0.08, 'sine', 0.025, 500, ambGain); if (Math.random() < 0.5) tone(2600 + Math.random() * 900, 0.07, 'sine', 0.02, 300, ambGain, 0.12); }
      else { tone(4300, 0.05, 'square', 0.006, 0, ambGain); tone(4300, 0.05, 'square', 0.006, 0, ambGain, 0.09); }
      if (Math.random() < 0.25) noise(1.6, 0.03, 500, 0.6, 'bandpass', ambGain); // passing car
    }, 1700);
  },
  click() { tone(660, 0.07, 'square', 0.08, 220); },
  confirm() { tone(523, 0.09, 'triangle', 0.15); tone(784, 0.14, 'triangle', 0.15, 0, null, 0.07); },
  back() { tone(440, 0.09, 'triangle', 0.12, -120); },
  error() { tone(160, 0.18, 'sawtooth', 0.12, -40); },
  interact() { tone(880, 0.08, 'sine', 0.15); tone(1320, 0.12, 'sine', 0.12, 0, null, 0.06); },
  footstep(run: boolean) { noise(0.06, run ? 0.5 : 0.3, run ? 1300 : 900, 1.2); },
  jump() { tone(300, 0.15, 'sine', 0.12, 250); },
  land() { noise(0.09, 0.4, 500, 0.8); },
  countdown(go: boolean) { tone(go ? 880 : 440, go ? 0.5 : 0.15, 'square', 0.15); },
  launch() { noise(0.5, 0.5, 2500, 0.7); tone(200, 0.5, 'sawtooth', 0.2, 900); },
  collide(strength: number) { const v = Math.min(1, strength / 14); noise(0.12, 0.3 + v * 0.6, 3000, 1.4); tone(900 + v * 700, 0.12, 'square', 0.1 + v * 0.18, -500); },
  wall() { noise(0.09, 0.3, 1400, 1); tone(300, 0.08, 'triangle', 0.15, -100); },
  dash() { noise(0.2, 0.3, 1800, 0.8); tone(400, 0.2, 'sawtooth', 0.08, 600); },
  burst() { noise(0.7, 0.9, 1800, 0.5); tone(700, 0.6, 'sawtooth', 0.25, -600); tone(1400, 0.3, 'square', 0.15, -900); },
  ringout() { tone(900, 0.6, 'sine', 0.2, -700); noise(0.3, 0.25, 1000, 1); },
  spinout() { tone(300, 0.9, 'triangle', 0.18, -250); },
  win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.28, 'triangle', 0.2, 0, null, i * 0.12)); },
  lose() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.32, 'triangle', 0.18, 0, null, i * 0.15)); },
  announce() { tone(660, 0.12, 'square', 0.12); tone(880, 0.12, 'square', 0.12, 0, null, 0.14); tone(1100, 0.3, 'square', 0.12, 0, null, 0.28); },
  levelUp() { [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.2, 'square', 0.12, 0, null, i * 0.07)); },
  spinLoop(on: boolean, level = 1) {
    const c = ensure(); if (!c) return;
    if (!on) { if (spinOsc) { try { spinOsc.stop(); } catch { /* */ } spinOsc = null; } return; }
    if (!spinOsc) {
      spinOsc = c.createOscillator(); spinOsc.type = 'sawtooth';
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 4;
      spinGain = c.createGain(); spinGain.gain.value = 0.03;
      spinOsc.connect(f); f.connect(spinGain); spinGain.connect(sfxGain); spinOsc.start();
    }
    spinOsc.frequency.value = 120 + level * 220;
    if (spinGain) spinGain.gain.value = 0.02 + level * 0.025;
  },
};
