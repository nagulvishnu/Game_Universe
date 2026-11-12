// Procedural Web Audio: dark-fantasy music + all sound effects (no external assets)
type MusicMode = 'calm' | 'throne' | 'battle' | 'boss' | 'ocean';
let ctx: AudioContext | null = null;
let master: GainNode, sfxG: GainNode, musG: GainNode, noiseBuf: AudioBuffer, delay: DelayNode;
let drones: { o: OscillatorNode; g: GainNode }[] = [];
let droneFilter: BiquadFilterNode;
let mode: MusicMode = 'calm';
let step = 0;
let timer: number | undefined;
let beamNodes: { o: OscillatorNode; o2: OscillatorNode; g: GainNode } | null = null;
let windNodes: { g: GainNode; f: BiquadFilterNode } | null = null;
let vols = { music: 0.5, sfx: 0.7 };

const SCALE = [0, 2, 3, 5, 7, 8, 10]; // D natural minor
const hz = (n: number) => 146.83 * Math.pow(2, n / 12);

function init() {
  if (ctx) return ctx;
  try {
    ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  } catch { return null; }
  master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
  sfxG = ctx.createGain(); sfxG.gain.value = vols.sfx; sfxG.connect(master);
  musG = ctx.createGain(); musG.gain.value = vols.music * 0.5; musG.connect(master);
  delay = ctx.createDelay(1); delay.delayTime.value = 0.38; const fb = ctx.createGain(); fb.gain.value = 0.42; delay.connect(fb); fb.connect(delay);
  const dl = ctx.createGain(); dl.gain.value = 0.5; delay.connect(dl); dl.connect(musG);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  droneFilter = ctx.createBiquadFilter(); droneFilter.type = 'lowpass'; droneFilter.frequency.value = 500; droneFilter.connect(musG);
  [0, 7, 12, -12].forEach((n, i) => {
    const o = ctx!.createOscillator(); o.type = i === 3 ? 'sine' : 'sawtooth'; o.frequency.value = hz(n - 12); o.detune.value = (i - 1.5) * 6;
    const g = ctx!.createGain(); g.gain.value = i === 3 ? 0.25 : 0.07; o.connect(g); g.connect(droneFilter); o.start(); drones.push({ o, g });
  });
  // wind
  const ws = ctx.createBufferSource(); ws.buffer = noiseBuf; ws.loop = true; const wf = ctx.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 600; wf.Q.value = 0.6;
  const wg = ctx.createGain(); wg.gain.value = 0; ws.connect(wf); wf.connect(wg); wg.connect(sfxG); ws.start(); windNodes = { g: wg, f: wf };
  timer = window.setInterval(tick, 240); void timer;
  return ctx;
}

function tone(f: number, dur: number, type: OscillatorType = 'sine', vol = 0.2, slide = 0, dest?: AudioNode, delaySend = false, when = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + when; const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, dur / 4)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest ?? sfxG); if (delaySend) g.connect(delay); o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur: number, vol = 0.2, f = 1200, type: BiquadFilterType = 'lowpass', slide = 0, when = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + when; const s = ctx.createBufferSource(); s.buffer = noiseBuf; const fl = ctx.createBiquadFilter(); fl.type = type;
  fl.frequency.setValueAtTime(f, t); if (slide) fl.frequency.exponentialRampToValueAtTime(Math.max(40, f + slide), t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl); fl.connect(g); g.connect(sfxG); s.start(t, Math.random()); s.stop(t + dur + 0.05);
}

function tick() {
  if (!ctx || ctx.state !== 'running') return;
  step++;
  const m = mode; const t = ctx.currentTime;
  const cut = m === 'boss' ? 1100 : m === 'battle' ? 800 : m === 'throne' ? 650 : m === 'ocean' ? 300 : 420;
  droneFilter.frequency.linearRampToValueAtTime(cut, t + 0.5);
  const root = m === 'boss' ? 2 : m === 'throne' ? 0 : (Math.floor(step / 32) % 4) * 2 % 7;
  drones.forEach((d, i) => d.o.frequency.linearRampToValueAtTime(hz([0, 7, 12, -12][i] - 12 + root), t + 0.8));
  const fast = m === 'battle' || m === 'boss';
  if (fast && step % 2 === 0) { tone(90, 0.25, 'sine', 0.5, -50, musG); if (step % 4 === 0) noise(0.1, 0.12, 6000, 'highpass', 0, 0); }
  if (m === 'boss' && step % 4 === 2) tone(60, 0.5, 'sawtooth', 0.12, -20, musG);
  if (m === 'boss' && step % 8 === 0) for (let i = 0; i < 3; i++) tone(hz(SCALE[(i * 2) % 7] + 12 + root), 1.8, 'sawtooth', 0.04, 0, musG, true);
  if (m === 'throne' && step % 16 === 0) [0, 3, 7, 10].forEach((n, i) => tone(hz(n + 12), 5, 'sine', 0.06, 0, musG, true, i * 0.1));
  if (!fast && step % 6 === 0 && Math.random() < (m === 'ocean' ? 0.7 : 0.45)) tone(hz(SCALE[Math.floor(Math.random() * 7)] + 24), 3, 'sine', 0.07, 0, musG, true);
  if (m === 'calm' && step % 40 === 0) tone(hz(-12), 3.5, 'triangle', 0.15, 0, musG);
}

export const audio = {
  init, resume() { init(); if (ctx && ctx.state !== 'running') ctx.resume(); },
  setVol(music: number, sfx: number) { vols = { music, sfx }; if (ctx) { musG.gain.value = music * 0.5; sfxG.gain.value = sfx; } },
  music(m: MusicMode) { mode = m; },
  get mode() { return mode; },
  wind(v: number, f = 600) { if (windNodes && ctx) { windNodes.g.gain.linearRampToValueAtTime(v, ctx.currentTime + 0.1); windNodes.f.frequency.linearRampToValueAtTime(f, ctx.currentTime + 0.1); } },
  beam(on: boolean) {
    if (!ctx) return;
    if (on && !beamNodes) {
      const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sawtooth'; o2.type = 'square'; o.frequency.value = 90; o2.frequency.value = 135;
      g.gain.value = 0; g.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.15); o.connect(g); o2.connect(g); g.connect(sfxG); o.start(); o2.start(); beamNodes = { o, o2, g };
    } else if (!on && beamNodes) {
      const b = beamNodes; beamNodes = null; b.g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2); b.o.stop(ctx.currentTime + 0.25); b.o2.stop(ctx.currentTime + 0.25);
    }
  },
  sfx(n: string) {
    if (!ctx || ctx.state !== 'running') return;
    switch (n) {
      case 'swing': noise(0.18, 0.18, 800, 'bandpass', 3000); break;
      case 'heavy': noise(0.4, 0.3, 300, 'bandpass', 1800); tone(70, 0.4, 'sine', 0.3, -30); break;
      case 'hit': noise(0.12, 0.3, 2400, 'bandpass', -1500); tone(150, 0.1, 'square', 0.12, -80); break;
      case 'bighit': noise(0.3, 0.45, 1200, 'lowpass', -900); tone(60, 0.4, 'sine', 0.5, -30); break;
      case 'fireball': noise(0.5, 0.25, 500, 'bandpass', 1500); tone(200, 0.5, 'sawtooth', 0.12, 400); break;
      case 'explode': noise(0.9, 0.5, 1400, 'lowpass', -1200); tone(55, 0.8, 'sine', 0.6, -30); break;
      case 'teleport': tone(900, 0.35, 'sine', 0.2, -800); tone(120, 0.4, 'sawtooth', 0.15, 600); noise(0.3, 0.15, 3000, 'highpass'); break;
      case 'cataclysm': for (let i = 0; i < 6; i++) tone(55 + i * 12, 2.4, 'sawtooth', 0.12, -20, undefined, false, i * 0.05); noise(2.4, 0.3, 200, 'lowpass', 1400); noise(2, 0.6, 900, 'lowpass', -800, 1.4); tone(40, 2, 'sine', 0.8, -10, undefined, false, 1.4); break;
      case 'transform': for (let i = 0; i < 5; i++) tone(110 * (i + 1), 2, 'sawtooth', 0.07, 80, undefined, false, i * 0.1); noise(1.8, 0.25, 300, 'bandpass', 2500); break;
      case 'portal': tone(220, 1.2, 'sawtooth', 0.15, 100); tone(165, 1.4, 'square', 0.08, 50); tone(98, 1.4, 'sine', 0.3, 20, undefined, false, 0.3); break;
      case 'horn': tone(110, 1.4, 'sawtooth', 0.2, 10); tone(165, 1.4, 'sawtooth', 0.12, 8); tone(220, 1.2, 'square', 0.06, 0); break;
      case 'roar': noise(1.6, 0.4, 300, 'bandpass', 500); tone(90, 1.5, 'sawtooth', 0.3, -40); tone(60, 1.5, 'square', 0.15, 20); break;
      case 'wing': noise(0.25, 0.12, 400, 'lowpass', 600); break;
      case 'hurt': tone(220, 0.2, 'square', 0.15, -120); noise(0.15, 0.2, 1500, 'bandpass'); break;
      case 'pickup': tone(880, 0.12, 'sine', 0.15); tone(1320, 0.2, 'sine', 0.12, 0, undefined, false, 0.08); break;
      case 'ui': tone(660, 0.07, 'triangle', 0.1); break;
      case 'magic': tone(520, 0.3, 'sine', 0.12, 500); noise(0.2, 0.1, 4000, 'highpass'); break;
      case 'arrow': noise(0.15, 0.12, 2500, 'highpass'); break;
      case 'thunder': noise(2.2, 0.55, 250, 'lowpass', -150); tone(40, 1.8, 'sine', 0.4); break;
      case 'charge': tone(100, 0.8, 'sawtooth', 0.12, 500); break;
      case 'slam': noise(0.6, 0.5, 400, 'lowpass', -300); tone(45, 0.6, 'sine', 0.7, -10); break;
      case 'victory': [0, 4, 7, 12].forEach((s, i) => tone(220 * Math.pow(2, s / 12), 1.2, 'triangle', 0.15, 0, undefined, true, i * 0.15)); break;
      case 'bossintro': tone(55, 2.5, 'sawtooth', 0.3, -10); noise(2, 0.3, 200, 'lowpass', 600); tone(110, 2, 'square', 0.1); break;
    }
  },
};
