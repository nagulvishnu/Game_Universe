import { useGame } from './store';
import { Elem, WeaponId } from './types';

let ctx: AudioContext | null = null;
let master: GainNode, sfxG: GainNode, musG: GainNode, noiseBuf: AudioBuffer;
let lastBurst = 0, burstCount = 0;

export function initAudio() {
  if (typeof window === 'undefined') return;
  if (ctx) { if (ctx.state === 'suspended') void ctx.resume(); return; }
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); sfxG = ctx.createGain(); musG = ctx.createGain();
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6;
  sfxG.connect(master); musG.connect(master); master.connect(comp); comp.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  applyVolumes(); useGame.subscribe(applyVolumes);
}
function applyVolumes() {
  if (!ctx) return; const s = useGame.getState().settings;
  master.gain.value = s.master; sfxG.gain.value = s.sfx; musG.gain.value = s.music * .5;
}
const ok = () => {
  if (!ctx) return false;
  const t = ctx.currentTime; if (t - lastBurst > .05) { lastBurst = t; burstCount = 0; } burstCount++;
  return burstCount < 9;
};

function noise(dur: number, type: BiquadFilterType, f0: number, f1: number, q: number, g: number, when = 0, att = .003, dest: AudioNode = sfxG) {
  if (!ctx) return; const t = ctx.currentTime + when;
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const gn = ctx.createGain(); gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(g, t + att); gn.gain.exponentialRampToValueAtTime(.0001, t + dur);
  src.connect(f); f.connect(gn); gn.connect(dest); src.start(t, Math.random()); src.stop(t + dur + .05);
}
function tone(type: OscillatorType, f0: number, f1: number, dur: number, g: number, when = 0, att = .003, dest: AudioNode = sfxG, det = 0) {
  if (!ctx) return; const t = ctx.currentTime + when;
  const o = ctx.createOscillator(); o.type = type; o.detune.value = det;
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const gn = ctx.createGain(); gn.gain.setValueAtTime(.0001, t); gn.gain.exponentialRampToValueAtTime(g, t + att); gn.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(gn); gn.connect(dest); o.start(t); o.stop(t + dur + .05);
}
function metal(base: number, g: number, dur: number, when = 0) {
  for (const [r, a, d] of [[1, 1, 1], [2.76, .7, .8], [5.4, .5, .6], [8.93, .35, .45], [11.3, .25, .3]]) tone('square', base * r, base * r * .98, dur * d, g * a * .22, when, .001);
}

export const sfx = {
  swing(w: WeaponId, heavy = false) {
    if (!ok()) return; const g = heavy ? .5 : .3;
    switch (w) {
      case 'inferno': noise(.32, 'bandpass', 300, 1100, 1.2, g); noise(.25, 'lowpass', 900, 200, 1, g * .8, .03); break;
      case 'thunder': noise(.14, 'highpass', 2400, 6000, .8, g * .8); tone('sawtooth', 1800, 4000, .08, .04); break;
      case 'void': tone('sawtooth', 700, 120, .4, .08, 0, .02, sfxG, 14); noise(.35, 'bandpass', 900, 200, 2, g * .6); break;
      case 'glacier': noise(.2, 'bandpass', 3200, 1400, 3, g * .8); tone('triangle', 2400, 3200, .12, .04); break;
      case 'plasma': tone('sine', 2000, 400, .2, .14); noise(.15, 'highpass', 3000, 5000, 1, g * .5); break;
      default: noise(.4, 'lowpass', 400, 80, 1, g * 1.3); tone('sine', 120, 50, .3, .3);
    }
  },
  hit(power = 1, e: Elem = 'phys') {
    if (!ok()) return;
    noise(.1, 'lowpass', 1800, 300, 1, .45 * power); tone('sine', 160, 60, .14, .35 * power);
    if (e === 'fire') noise(.25, 'bandpass', 1200, 400, 1, .2); if (e === 'lightning') { noise(.12, 'highpass', 4000, 8000, 1, .3); tone('sawtooth', 3000, 300, .1, .08); }
    if (e === 'ice') { metal(1800, .2, .25); } if (e === 'void') tone('sawtooth', 300, 60, .25, .1);
    if (power > 1) metal(900, .12 * power, .2);
  },
  clash(level = 1) { if (!ok()) return; metal(1100 + Math.random() * 300, .35 * level, .35); noise(.12, 'highpass', 3000, 6000, 1, .3); tone('sine', 120, 50, .15, .3); },
  deflect(w: WeaponId) {
    if (!ok()) return; metal(w === 'titan' ? 600 : 1300, .38, .4); noise(.14, 'highpass', 2500, 7000, 1, .35); tone('sine', 140, 45, .18, .4);
  },
  perfect(w: WeaponId, chain = 1) {
    if (!ctx) return;
    const up = Math.pow(2, Math.min(chain - 1, 8) / 12);
    metal(1500 * up, .7, .6); metal(900 * up, .5, .5, .01);
    tone('sine', 1760 * up, 1760 * up, 1.0, .22, 0, .002); tone('sine', 2637 * up, 2637 * up, .9, .16, .02, .002); tone('sine', 3520 * up, 3520 * up, .7, .1, .05, .002);
    tone('sine', 110, 38, .35, .7); noise(.2, 'highpass', 3500, 9000, 1, .5); tone('sawtooth', 400 * up, 2400 * up, .12, .12);
    switch (w) {
      case 'inferno': noise(.5, 'lowpass', 900, 100, 1, .5, .02); break;
      case 'thunder': for (let i = 0; i < 5; i++) noise(.04, 'highpass', 5000, 9000, 1, .3, i * .035); break;
      case 'void': tone('sawtooth', 200, 800, .3, .12, 0, .1, sfxG, 20); tone('sawtooth', 800, 100, .4, .1, .1); break;
      case 'glacier': metal(2800, .25, .7, .02); break;
      case 'plasma': tone('sine', 300, 3000, .25, .2); tone('sine', 3000, 600, .5, .12, .12); break;
      case 'titan': tone('sine', 70, 30, .7, .9); noise(.6, 'lowpass', 500, 60, 1, .6); break;
    }
  },
  elem(kind: 'fire' | 'lightning' | 'ice' | 'slam' | 'void' | 'plasma' | 'earth', big = false) {
    if (!ctx) return; const m = big ? 1.4 : 1;
    switch (kind) {
      case 'fire': noise(.7 * m, 'lowpass', 2500, 120, 1, .7, 0, .01); tone('sine', 90, 30, .6 * m, .8); break;
      case 'lightning': for (let i = 0; i < 6; i++) noise(.05 + Math.random() * .06, 'highpass', 3000 + Math.random() * 3000, 9000, 1, .4, i * .025); tone('sawtooth', 4000, 200, .25, .1); tone('sine', 70, 40, .3, .5); break;
      case 'ice': metal(2200, .35, .6); metal(3300, .25, .5, .03); noise(.3, 'highpass', 5000, 9000, 1, .3); break;
      case 'slam': case 'earth': tone('sine', 90, 25, .7 * m, 1); noise(.6 * m, 'lowpass', 700, 50, 1, .8); noise(.3, 'bandpass', 2000, 300, 1, .3); break;
      case 'void': tone('sawtooth', 600, 40, .8 * m, .22, 0, .05, sfxG, 25); tone('sine', 60, 30, .8, .6); noise(.6, 'bandpass', 1200, 100, 2, .3); break;
      case 'plasma': tone('sine', 3000, 200, .35, .25); noise(.25, 'highpass', 4000, 10000, 1, .35); tone('sine', 80, 40, .3, .5); break;
    }
  },
  hurt() { if (!ctx) return; noise(.18, 'lowpass', 1200, 200, 1, .6); tone('sawtooth', 220, 70, .25, .2); tone('sine', 100, 40, .2, .6); },
  enemyHurt() { if (!ok()) return; noise(.08, 'lowpass', 2000, 500, 1, .3); tone('square', 260, 120, .1, .08); },
  boss(kind: 'roar' | 'swing' | 'phase' | 'die') {
    if (!ctx) return;
    if (kind === 'roar' || kind === 'phase') { tone('sawtooth', 90, 45, 1.1, .35, 0, .08, sfxG, 30); tone('sawtooth', 135, 60, 1.0, .25, 0, .08, sfxG, -30); noise(1, 'lowpass', 900, 80, 1, .5); }
    else if (kind === 'swing') { noise(.5, 'lowpass', 500, 90, 1, .7); tone('sawtooth', 160, 60, .4, .2); }
    else { tone('sawtooth', 100, 20, 2.2, .45, 0, .05); noise(2, 'lowpass', 1500, 40, 1, .8); metal(300, .5, 1.5); }
  },
  ult() { if (!ctx) return; tone('sawtooth', 80, 800, .7, .22, 0, .3); noise(.8, 'bandpass', 200, 4000, 1.5, .5, 0, .4); tone('sine', 50, 25, 1.2, .9, .65); },
  awaken() { if (!ctx) return; tone('sine', 200, 1600, .8, .3, 0, .1); metal(1000, .4, 1.2, .3); noise(.9, 'bandpass', 300, 5000, 1, .4, 0, .3); tone('sine', 60, 30, 1, .8, .1); },
  dodge() { if (!ok()) return; noise(.2, 'bandpass', 600, 3000, 1, .3); },
  perfectDodge() { if (!ctx) return; tone('sine', 900, 1800, .25, .2); tone('sine', 1350, 2700, .3, .12, .05); noise(.25, 'bandpass', 500, 4000, 1, .3); },
  pickup() { if (!ctx) return; tone('sine', 660, 990, .12, .2); tone('sine', 990, 1480, .2, .2, .08); },
  telegraph(unblock: boolean) { if (!ok()) return; if (unblock) { tone('sawtooth', 220, 330, .22, .12); tone('sawtooth', 220, 330, .22, .12, .24); } else tone('triangle', 900, 1200, .06, .06); },
  guardBreak() { if (!ctx) return; metal(500, .6, .9); tone('sine', 80, 30, .5, .8); noise(.4, 'lowpass', 2000, 100, 1, .6); },
  ui() { if (!ctx) return; tone('triangle', 700, 900, .06, .12); },
  start() { if (!ctx) return; tone('sawtooth', 110, 440, .5, .2, 0, .1); metal(700, .3, .8, .2); },
  fail() { if (!ctx) return; tone('sawtooth', 300, 40, 1.5, .3); noise(1.2, 'lowpass', 800, 40, 1, .5); },
  win() { if (!ctx) return; [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, .6, .25, i * .12)); },
  step() { if (!ok()) return; noise(.05, 'lowpass', 600, 200, 1, .06); },
};

// ----------------------------------------------------------- music
const SCALES = [
  { root: 55, notes: [0, 3, 5, 7, 10, 12, 15], bpm: 118 }, { root: 73.4, notes: [0, 1, 5, 7, 8, 12, 13], bpm: 130 },
  { root: 82.4, notes: [0, 2, 4, 7, 9, 11, 14], bpm: 104 }, { root: 98, notes: [0, 3, 5, 7, 10, 12, 14], bpm: 138 },
];
let musicOn = false, musicTimer: ReturnType<typeof setInterval> | null = null, nextT = 0, stepN = 0, musicIdx = 0, intensity = 1;
const mf = (root: number, semis: number) => root * Math.pow(2, semis / 12);
function playStep(n: number, t: number) {
  if (!ctx) return; const sc = SCALES[musicIdx], w = t - ctx.currentTime;
  if (n % 4 === 0) tone('sine', 130, 42, .16, .55, w, .002, musG);
  if (intensity >= 1 && n % 8 === 4) noise(.14, 'bandpass', 1800, 900, 1, .2, w, .002, musG);
  if (intensity >= 1 && n % 2 === 0) noise(.04, 'highpass', 7000, 9000, 1, .07, w, .001, musG);
  const bassPat = [0, 0, 3, 0, 5, 0, 3, 4];
  if (n % 2 === 0) {
    const semi = sc.notes[bassPat[(n >> 1) % 8] % sc.notes.length];
    const t0 = ctx.currentTime + w, o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = mf(sc.root, semi); f.type = 'lowpass'; f.frequency.setValueAtTime(900 + intensity * 400, t0); f.frequency.exponentialRampToValueAtTime(120, t0 + .22);
    g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(.3, t0 + .01); g.gain.exponentialRampToValueAtTime(.0001, t0 + .24);
    o.connect(f); f.connect(g); g.connect(musG); o.start(t0); o.stop(t0 + .3);
  }
  if (intensity >= 2 && n % 2 === 1 && Math.random() < .7) tone('triangle', mf(sc.root * 4, sc.notes[Math.floor(Math.random() * sc.notes.length)]), mf(sc.root * 4, 0) * .98, .18, .07, w, .005, musG);
  if (n % 32 === 0) for (const s of [0, 7, 12]) tone('sawtooth', mf(sc.root * 2, sc.notes[0] + s), mf(sc.root * 2, sc.notes[0] + s), 60 / sc.bpm * 8, .045, w, .8, musG, s * 3);
}
function schedule() {
  if (!ctx || !musicOn) return; const sc = SCALES[musicIdx];
  while (nextT < ctx.currentTime + .15) { playStep(stepN++, nextT); nextT += 60 / sc.bpm / 4; }
}
export function setMusic(idx: number, inten: number) {
  musicIdx = idx; intensity = inten;
  if (!ctx) return;
  if (!musicOn) { musicOn = true; nextT = ctx.currentTime + .1; stepN = 0; musicTimer = setInterval(schedule, 40); }
}
export function stopMusic() { musicOn = false; if (musicTimer) clearInterval(musicTimer); musicTimer = null; }
export function setIntensity(i: number) { intensity = i; }

if (typeof window !== 'undefined') window.addEventListener('pointerdown', initAudio, { passive: true });
if (typeof window !== 'undefined') window.addEventListener('keydown', initAudio, { passive: true });
