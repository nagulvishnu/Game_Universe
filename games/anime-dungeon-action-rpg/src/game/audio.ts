// Procedural Web Audio: SFX + generative region music. No external assets.
import { REGIONS, rng } from './data';

let ctx: AudioContext | null = null;
let master: GainNode, musicBus: GainNode, sfxBus: GainNode, noiseBuf: AudioBuffer;
const vols = { master: 0.8, music: 0.55, sfx: 0.9 };
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

function ensure(): AudioContext | null {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain(); musicBus = ctx.createGain(); sfxBus = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    musicBus.connect(master); sfxBus.connect(master); master.connect(comp); comp.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyVols();
  } catch { ctx = null; }
  return ctx;
}
function applyVols() { if (!ctx) return; master.gain.value = vols.master; musicBus.gain.value = vols.music * 0.5; sfxBus.gain.value = vols.sfx * 0.8; }

function tone(f: number, dur: number, type: OscillatorType, vol: number, slide = 0, delay = 0, bus: GainNode = sfxBus, attack = 0.005) {
  if (!ctx) return;
  const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur: number, freq: number, vol: number, type: BiquadFilterType = 'lowpass', slide = 0, delay = 0, q = 1, bus: GainNode = sfxBus) {
  if (!ctx) return;
  const t = ctx.currentTime + delay, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; s.loop = true; f.type = type; f.Q.value = q; f.frequency.setValueAtTime(freq, t);
  if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(bus); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}

const lastPlay: Record<string, number> = {};
export function sfx(name: string, vol = 1, pitch = 1) {
  if (!ensure() || !ctx) return;
  const now = ctx.currentTime;
  if (lastPlay[name] && now - lastPlay[name] < 0.035) return;
  lastPlay[name] = now;
  const p = pitch * (0.94 + Math.random() * 0.12), v = vol;
  switch (name) {
    case 'swing': noise(0.16, 1800 * p, 0.18 * v, 'bandpass', 2500, 0, 1.2); break;
    case 'swingheavy': noise(0.3, 600 * p, 0.3 * v, 'bandpass', 1800, 0, 1); tone(110 * p, 0.25, 'sawtooth', 0.08 * v, -60); break;
    case 'hit': noise(0.09, 2400 * p, 0.35 * v, 'bandpass', -1500, 0, 1.5); tone(180 * p, 0.1, 'square', 0.18 * v, -100); break;
    case 'heavy': noise(0.22, 900 * p, 0.5 * v, 'lowpass', -600); tone(90 * p, 0.3, 'sine', 0.5 * v, -50); tone(200 * p, 0.12, 'square', 0.15 * v, -120); break;
    case 'crit': noise(0.12, 3500 * p, 0.35 * v, 'highpass'); tone(880 * p, 0.12, 'triangle', 0.15 * v, 600); tone(150 * p, 0.14, 'square', 0.2 * v, -80); break;
    case 'block': noise(0.1, 3000, 0.3 * v, 'bandpass', 0, 0, 3); tone(520 * p, 0.14, 'square', 0.1 * v, -120); break;
    case 'parry': noise(0.08, 5000, 0.4 * v, 'highpass'); tone(1320 * p, 0.35, 'triangle', 0.22 * v, -200); tone(1980 * p, 0.3, 'sine', 0.12 * v, 0, 0.02); break;
    case 'perfect':
      noise(0.14, 6000, 0.55 * v, 'highpass'); tone(1760, 0.5, 'triangle', 0.3 * v, -400); tone(2637, 0.6, 'sine', 0.18 * v, 0, 0.03); tone(880, 0.4, 'square', 0.1 * v, 200, 0.05); tone(3520, 0.4, 'sine', 0.08 * v, 0, 0.08); break;
    case 'dodge': noise(0.2, 1200, 0.2 * v, 'bandpass', 3000, 0, 0.8); break;
    case 'hurt': tone(140, 0.22, 'sawtooth', 0.28 * v, -90); noise(0.15, 700, 0.35 * v, 'lowpass'); break;
    case 'ehurt': tone(260 * p, 0.1, 'square', 0.08 * v, -120); break;
    case 'death': noise(0.5, 1200, 0.3 * v, 'lowpass', -900); tone(220 * p, 0.5, 'sawtooth', 0.12 * v, -170); break;
    case 'fire': noise(0.5, 900, 0.4 * v, 'lowpass', 1400, 0, 0.5); tone(200, 0.4, 'sawtooth', 0.1 * v, 300); break;
    case 'ice': tone(1500 * p, 0.35, 'sine', 0.18 * v, 1000); tone(2200 * p, 0.3, 'triangle', 0.1 * v, -300, 0.03); noise(0.2, 6000, 0.15 * v, 'highpass'); break;
    case 'lightning': noise(0.3, 4500, 0.5 * v, 'highpass', -3000); tone(60, 0.3, 'sawtooth', 0.4 * v, 40); for (let i = 0; i < 4; i++) tone(800 + Math.random() * 2400, 0.04, 'square', 0.1 * v, 0, i * 0.04); break;
    case 'magic': tone(440 * p, 0.45, 'sine', 0.2 * v, 880); tone(660 * p, 0.45, 'triangle', 0.1 * v, 600, 0.05); break;
    case 'shadow': tone(300 * p, 0.35, 'sawtooth', 0.14 * v, -220); noise(0.3, 400, 0.2 * v, 'lowpass', 1500); break;
    case 'quake': tone(55, 0.7, 'sine', 0.6 * v, -25); noise(0.6, 500, 0.5 * v, 'lowpass', -300); break;
    case 'explode': noise(0.6, 1500, 0.7 * v, 'lowpass', -1200); tone(70, 0.5, 'sine', 0.6 * v, -40); break;
    case 'beam': tone(300, 0.5, 'sawtooth', 0.12 * v, 500); tone(310, 0.5, 'square', 0.06 * v, 520); break;
    case 'pickup': tone(880 * p, 0.12, 'triangle', 0.14 * v, 440); break;
    case 'gold': tone(1568 * p, 0.09, 'square', 0.06 * v, 0); tone(2093 * p, 0.12, 'square', 0.05 * v, 0, 0.05); break;
    case 'item': [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'triangle', 0.13 * v, 0, i * 0.07)); break;
    case 'legend': [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => { tone(f, 0.6, 'triangle', 0.14 * v, 0, i * 0.08); tone(f / 2, 0.6, 'sine', 0.1 * v, 0, i * 0.08); }); break;
    case 'clear': [523, 659, 784, 1047].forEach((f, i) => { tone(f, 0.5, 'triangle', 0.18 * v, 0, i * 0.12); tone(f * 1.5, 0.5, 'sine', 0.08 * v, 0, i * 0.12); }); tone(1568, 0.9, 'triangle', 0.15 * v, 0, 0.5); break;
    case 'boss': tone(55, 1.4, 'sawtooth', 0.35 * v, -15); tone(82, 1.4, 'square', 0.15 * v, -20); noise(1.2, 300, 0.4 * v, 'lowpass', 400); break;
    case 'roar': noise(0.9, 500, 0.5 * v, 'bandpass', -250, 0, 2); tone(70 * p, 0.9, 'sawtooth', 0.3 * v, -30); break;
    case 'click': tone(900, 0.04, 'square', 0.06 * v); break;
    case 'levelup': [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.35, 'triangle', 0.16 * v, 0, i * 0.07)); break;
    case 'awaken': tone(110, 1.6, 'sawtooth', 0.25 * v, 440); tone(220, 1.6, 'sine', 0.2 * v, 880); noise(1.4, 400, 0.4 * v, 'bandpass', 5000, 0, 1); break;
    case 'ult': tone(80, 1.2, 'sawtooth', 0.4 * v, 300); noise(0.9, 600, 0.5 * v, 'bandpass', 3500, 0, 1); break;
    case 'telegraph': tone(740, 0.08, 'square', 0.05 * v); break;
    case 'unblock': tone(220, 0.25, 'sawtooth', 0.12 * v, 200); tone(233, 0.25, 'sawtooth', 0.1 * v, 200); break;
    case 'chest': tone(300, 0.3, 'triangle', 0.15 * v, 300); noise(0.2, 2000, 0.2 * v, 'highpass'); break;
    case 'portal': tone(330, 1, 'sine', 0.2 * v, 660); tone(495, 1, 'triangle', 0.1 * v, 700); break;
    case 'teleport': tone(900, 0.2, 'sine', 0.15 * v, -700); noise(0.15, 3000, 0.2 * v, 'highpass'); break;
    case 'jump': tone(300, 0.12, 'sine', 0.1 * v, 200); break;
    case 'land': noise(0.1, 300, 0.2 * v, 'lowpass'); break;
    case 'rune': tone(660 * p, 0.3, 'sine', 0.2 * v, 0); tone(990 * p, 0.3, 'sine', 0.1 * v, 0, 0.05); break;
    case 'wrong': tone(120, 0.4, 'sawtooth', 0.25 * v, -40); break;
  }
}

// ----- music -----
const M = { kind: 'off' as string, root: 50, scale: [0, 2, 3, 5, 7, 8, 10], tempo: 80, wave: 'triangle' as OscillatorType, intensity: 0, step: 0, next: 0, timer: 0 as unknown as number, arp: [] as number[], prog: [0, 5, 3, 4] };
function scheduleStep(t0: number) {
  if (!ctx) return;
  const s = M.step, sc = M.scale, deg = (d: number) => M.root + 12 * Math.floor(d / sc.length) + sc[((d % sc.length) + sc.length) % sc.length];
  const delay = Math.max(0, t0 - ctx.currentTime);
  const bar = Math.floor(s / 16) % M.prog.length, chordRoot = M.prog[bar];
  if (s % 16 === 0) for (const d of [0, 2, 4]) tone(mtof(deg(chordRoot + d) + 12), 60 / M.tempo * 8 * 0.95, 'sine', 0.09, 0, delay, musicBus, 0.8);
  if (s % 8 === 0 || (M.intensity > 0.5 && s % 4 === 2)) tone(mtof(deg(chordRoot) - 12), 0.4, 'triangle', 0.22, 0, delay, musicBus);
  if (s % 2 === 0 || M.intensity > 0.6) { const d = chordRoot + M.arp[s % M.arp.length]; tone(mtof(deg(d) + 12), 0.28, M.wave, 0.055 + M.intensity * 0.03, 0, delay, musicBus); }
  if (M.intensity > 0.2) {
    if (s % 4 === 0) { tone(120, 0.15, 'sine', 0.3, -80, delay, musicBus); }
    if (M.intensity > 0.7 && s % 8 === 4) noise(0.12, 2500, 0.18, 'bandpass', 0, delay, 1, musicBus);
    if (s % 2 === 1) noise(0.04, 8000, 0.07, 'highpass', 0, delay, 1, musicBus);
  }
  M.step++;
}
function tick() {
  if (!ctx || M.kind === 'off') return;
  const dur = 60 / M.tempo / 2;
  if (M.next < ctx.currentTime) M.next = ctx.currentTime + 0.05;
  while (M.next < ctx.currentTime + 0.2) { scheduleStep(M.next); M.next += dur; }
}
export function setMusic(kind: 'title' | 'hub' | 'region' | 'boss' | 'off', region = 0, intensity = 0.3) {
  if (!ensure()) return;
  const key = `${kind}:${region}`;
  M.intensity = intensity;
  if (M.kind === key) return;
  M.kind = kind === 'off' ? 'off' : key;
  if (kind === 'off') return;
  const reg = REGIONS[region];
  if (kind === 'hub' || kind === 'title') { M.root = 53; M.scale = [0, 2, 4, 5, 7, 9, 11]; M.tempo = 76; M.wave = 'triangle'; M.prog = [0, 4, 5, 3]; }
  else if (kind === 'boss') { M.root = reg.music.root - 5; M.scale = [0, 2, 3, 5, 7, 8, 11]; M.tempo = reg.music.tempo * 1.3; M.wave = 'sawtooth'; M.prog = [0, 5, 3, 6]; }
  else { M.root = reg.music.root; M.scale = reg.music.scale; M.tempo = reg.music.tempo; M.wave = reg.music.wave; M.prog = [0, 5, 3, 4]; }
  const r = rng(region * 97 + (kind === 'boss' ? 5 : 1));
  M.arp = Array.from({ length: 16 }, () => Math.floor(r() * 5));
  M.step = 0; M.next = 0;
  if (!M.timer) M.timer = window.setInterval(tick, 50);
}
export function setIntensity(x: number) { M.intensity = x; }
export function initAudio() { const c = ensure(); if (c && c.state === 'suspended') c.resume(); }
export function setVolumes(m: number, mu: number, s: number) { vols.master = m; vols.music = mu; vols.sfx = s; applyVols(); }
