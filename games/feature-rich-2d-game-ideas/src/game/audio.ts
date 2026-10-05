// Tiny synthesized sound engine (no assets needed)
let ac: AudioContext | null = null;
let muted = false;
const last: Record<string, number> = {};

function ctx(): AudioContext | null {
  if (muted) return null;
  if (!ac) {
    try {
      const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      ac = new AC();
    } catch {
      return null;
    }
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, slide = 0) {
  const a = ctx();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, a.currentTime);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), a.currentTime + dur);
  g.gain.setValueAtTime(vol, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
  o.connect(g).connect(a.destination);
  o.start();
  o.stop(a.currentTime + dur);
}

function noise(dur: number, vol: number, freq = 1200, type: BiquadFilterType = 'lowpass') {
  const a = ctx();
  if (!a) return;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = a.createBufferSource();
  s.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const g = a.createGain();
  g.gain.value = vol;
  s.connect(f).connect(g).connect(a.destination);
  s.start();
}

export function setMuted(m: boolean) {
  muted = m;
}
export function isMuted() {
  return muted;
}

export function sfx(name: string) {
  const now = performance.now();
  const gap = name === 'flame' ? 70 : name === 'hit' ? 45 : name === 'coin' ? 40 : 18;
  if (last[name] && now - last[name] < gap) return;
  last[name] = now;
  switch (name) {
    case 'pistol':
      tone(520, 0.09, 'square', 0.06, -300);
      noise(0.05, 0.05, 3000);
      break;
    case 'smg':
      tone(420, 0.06, 'square', 0.05, -200);
      break;
    case 'rifle':
      tone(300, 0.08, 'sawtooth', 0.06, -180);
      noise(0.06, 0.06, 2500);
      break;
    case 'shotgun':
      noise(0.22, 0.2, 1800);
      tone(120, 0.18, 'sawtooth', 0.12, -60);
      break;
    case 'plasma':
      tone(900, 0.14, 'sine', 0.07, -600);
      break;
    case 'flame':
      noise(0.14, 0.07, 900);
      break;
    case 'rocket':
      noise(0.3, 0.15, 700);
      tone(140, 0.3, 'sawtooth', 0.1, 80);
      break;
    case 'rail':
      tone(1400, 0.35, 'sawtooth', 0.1, -1300);
      noise(0.2, 0.12, 5000, 'highpass');
      break;
    case 'arc':
      tone(700, 0.12, 'sawtooth', 0.06, 500);
      noise(0.12, 0.08, 4000, 'highpass');
      break;
    case 'enemyShot':
      tone(260, 0.1, 'triangle', 0.04, -120);
      break;
    case 'explosion':
      noise(0.6, 0.35, 500);
      tone(80, 0.5, 'sine', 0.25, -50);
      break;
    case 'bigExplosion':
      noise(1.1, 0.5, 400);
      tone(60, 0.9, 'sine', 0.4, -40);
      break;
    case 'hit':
      tone(180, 0.05, 'square', 0.04, -60);
      break;
    case 'hurt':
      tone(150, 0.2, 'sawtooth', 0.12, -90);
      break;
    case 'coin':
      tone(880, 0.07, 'square', 0.04);
      setTimeout(() => tone(1320, 0.1, 'square', 0.04), 55);
      break;
    case 'pickup':
      tone(500, 0.1, 'triangle', 0.08, 400);
      break;
    case 'reload':
      tone(200, 0.05, 'square', 0.05);
      setTimeout(() => tone(330, 0.07, 'square', 0.05), 90);
      break;
    case 'dash':
      noise(0.18, 0.1, 2000, 'highpass');
      break;
    case 'skill':
      tone(300, 0.35, 'sine', 0.12, 700);
      break;
    case 'ult':
      tone(120, 0.8, 'sawtooth', 0.14, 600);
      noise(0.6, 0.15, 1500);
      break;
    case 'melee':
      noise(0.12, 0.12, 2500, 'bandpass');
      break;
    case 'enter':
      tone(220, 0.15, 'square', 0.07, 200);
      break;
    case 'boss':
      tone(70, 1.2, 'sawtooth', 0.2, -20);
      tone(75, 1.2, 'square', 0.1, -20);
      break;
    case 'win':
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'square', 0.08), i * 140));
      break;
    case 'lose':
      [400, 320, 250, 160].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'sawtooth', 0.09), i * 180));
      break;
    case 'click':
      tone(600, 0.04, 'square', 0.05);
      break;
  }
}
