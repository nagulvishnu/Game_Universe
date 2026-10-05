let ctx: AudioContext | null = null;
let master: GainNode;
let noiseBuf: AudioBuffer;
let muted = false;
const last: Record<string, number> = {};
let engOsc: OscillatorNode | null = null;
let engOsc2: OscillatorNode | null = null;
let engGain: GainNode | null = null;
let engFilter: BiquadFilterNode | null = null;

export function initAudio() {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

export function setMuted(m: boolean) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.5;
}
export function isMuted() {
  return muted;
}

function tone(f0: number, f1: number, dur: number, type: OscillatorType, vol: number, delay = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, vol: number, f0: number, f1: number, type: BiquadFilterType = 'lowpass', delay = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.02);
}

export function sfx(name: string, v = 1) {
  if (!ctx || muted || v < 0.03) return;
  const now = ctx.currentTime;
  if (last[name] && now - last[name] < 0.025 && name !== 'boom') return;
  last[name] = now;
  switch (name) {
    case 'pistol':
      noise(0.12, 0.5 * v, 3500, 500);
      tone(300, 90, 0.1, 'square', 0.18 * v);
      break;
    case 'smg':
      noise(0.08, 0.4 * v, 4500, 800);
      tone(220, 80, 0.07, 'square', 0.14 * v);
      break;
    case 'ar':
      noise(0.14, 0.55 * v, 3000, 400);
      tone(160, 55, 0.12, 'sawtooth', 0.22 * v);
      break;
    case 'shotgun':
      noise(0.3, 0.9 * v, 2500, 200);
      tone(110, 40, 0.25, 'sawtooth', 0.3 * v);
      break;
    case 'sniper':
      noise(0.5, 0.9 * v, 5000, 150);
      tone(90, 30, 0.4, 'sawtooth', 0.4 * v);
      break;
    case 'swing':
      noise(0.16, 0.25 * v, 600, 3000, 'bandpass');
      break;
    case 'stab':
      noise(0.08, 0.5 * v, 2000, 400);
      tone(180, 60, 0.1, 'triangle', 0.3 * v);
      break;
    case 'hit':
      tone(1300, 900, 0.05, 'square', 0.12 * v);
      break;
    case 'head':
      tone(1900, 1200, 0.09, 'square', 0.16 * v);
      tone(950, 600, 0.12, 'triangle', 0.14 * v, 0.02);
      break;
    case 'kill':
      tone(500, 800, 0.1, 'square', 0.15 * v);
      tone(800, 1200, 0.14, 'square', 0.15 * v, 0.09);
      tone(1200, 1600, 0.2, 'triangle', 0.15 * v, 0.18);
      break;
    case 'hurt':
      tone(180, 80, 0.18, 'sawtooth', 0.28 * v);
      noise(0.12, 0.25 * v, 900, 200);
      break;
    case 'pickup':
      tone(700, 1100, 0.09, 'triangle', 0.18 * v);
      tone(1100, 1500, 0.1, 'triangle', 0.15 * v, 0.07);
      break;
    case 'reload':
      tone(300, 220, 0.05, 'square', 0.1 * v);
      tone(420, 600, 0.06, 'square', 0.1 * v, 0.35);
      break;
    case 'boom':
      noise(1.0, 1.0 * v, 1800, 60);
      tone(80, 25, 0.8, 'sawtooth', 0.5 * v);
      break;
    case 'land':
      noise(0.25, 0.5 * v, 700, 100);
      tone(100, 40, 0.2, 'sine', 0.4 * v);
      break;
    case 'jump':
      noise(0.5, 0.3 * v, 400, 2200, 'bandpass');
      break;
    case 'chute':
      noise(0.3, 0.4 * v, 3000, 400);
      tone(200, 100, 0.2, 'triangle', 0.2 * v);
      break;
    case 'throw':
      noise(0.2, 0.2 * v, 500, 1800, 'bandpass');
      break;
    case 'heal':
      tone(500, 900, 0.2, 'sine', 0.2 * v);
      tone(700, 1200, 0.3, 'sine', 0.2 * v, 0.12);
      break;
    case 'zone':
      tone(220, 220, 0.3, 'sawtooth', 0.14 * v);
      tone(165, 165, 0.4, 'sawtooth', 0.14 * v, 0.25);
      break;
    case 'crash':
      noise(0.3, 0.7 * v, 900, 100);
      tone(120, 50, 0.2, 'square', 0.25 * v);
      break;
    case 'ui':
      tone(600, 900, 0.06, 'triangle', 0.12 * v);
      break;
    case 'win':
      [523, 659, 784, 1046].forEach((f, i) => tone(f, f, 0.3, 'triangle', 0.2, i * 0.13));
      break;
    case 'lose':
      [392, 330, 262].forEach((f, i) => tone(f, f * 0.9, 0.35, 'sawtooth', 0.15, i * 0.2));
      break;
    case 'enter':
      tone(300, 500, 0.12, 'square', 0.12 * v);
      break;
  }
}

export function setEngine(on: boolean, speed01 = 0, kind: 'car' | 'bike' | 'truck' = 'car') {
  if (!ctx) return;
  if (on && !engOsc) {
    engOsc = ctx.createOscillator();
    engOsc2 = ctx.createOscillator();
    engOsc.type = 'sawtooth';
    engOsc2.type = 'square';
    engFilter = ctx.createBiquadFilter();
    engFilter.type = 'lowpass';
    engFilter.frequency.value = 500;
    engGain = ctx.createGain();
    engGain.gain.value = 0.0001;
    engOsc.connect(engFilter);
    engOsc2.connect(engFilter);
    engFilter.connect(engGain).connect(master);
    engOsc.start();
    engOsc2.start();
  }
  if (!on) {
    if (engOsc && engGain) {
      engGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.1);
      const o1 = engOsc;
      const o2 = engOsc2!;
      setTimeout(() => {
        try {
          o1.stop();
          o2.stop();
        } catch {
          /* ignore */
        }
      }, 400);
      engOsc = null;
      engOsc2 = null;
      engGain = null;
    }
    return;
  }
  const base = kind === 'bike' ? 70 : kind === 'truck' ? 38 : 52;
  const f = base + speed01 * (kind === 'bike' ? 150 : 110);
  const t = ctx.currentTime;
  engOsc!.frequency.setTargetAtTime(f, t, 0.08);
  engOsc2!.frequency.setTargetAtTime(f * 0.5, t, 0.08);
  engFilter!.frequency.setTargetAtTime(350 + speed01 * 900, t, 0.1);
  engGain!.gain.setTargetAtTime(muted ? 0.0001 : 0.07 + speed01 * 0.06, t, 0.1);
}
