import { AttackDef, Hit, K, KF, WeaponDef, WeaponId } from '../types';

// ---------- pose pattern helpers (KF coords: x right-positive, pitch 0=blade up, PI/2=forward, PI=down) ----------
const TAU = Math.PI * 2;
const rest = (t: number, pi = .9, ya = .2, ro = .4): KF => K(t, .35, 1.1, .4, pi, ya, ro);
type O = { w?: number; y?: number; ro?: number; tw?: number; ln?: number; pi?: number; r?: number; h0?: number; h1?: number; x?: number; z1?: number; ya?: number };

const H = (a0: number, a1: number, o: O = {}): KF[] => {
  const w = o.w ?? .3, y = o.y ?? 1.25, ro = o.ro ?? 0, tw = o.tw ?? .7, ln = o.ln ?? .12, pi = o.pi ?? 1.5, r = o.r ?? 1;
  const px = (a: number) => Math.sin(a) * .55 * r, pz = (a: number) => .5 + Math.cos(a) * .3 * r, m = (a0 + a1) / 2, sg = Math.sign(a0) || 1;
  return [rest(0), K(w, px(a0), y, pz(a0) - .15, pi, a0, ro, -.05, tw * sg), K(w + .14, px(m), y, pz(m) + .15, pi, m, ro, ln, 0, 1),
    K(w + .26, px(a1), y, pz(a1), pi, a1, ro, ln, -tw * sg, 2), K(w + .42, px(a1), y, pz(a1), pi, a1, ro, ln * .8, -tw * sg * .8), rest(1)];
};
const V = (p0: number, p1: number, o: O = {}): KF[] => {
  const w = o.w ?? .3, ro = o.ro ?? 0, x = o.x ?? .2, h0 = o.h0 ?? 1.9, h1 = o.h1 ?? 1, ln = o.ln ?? .3;
  return [rest(0), K(w, x, h0, -.15, p0, 0, ro, -.18, .25), K(w + .12, x * .6, (h0 + h1) / 2 + .2, .5, (p0 + p1) / 2, 0, ro * .6, .1, 0, 1),
    K(w + .24, 0, h1, .85, p1, 0, 0, ln, -.1, 2), K(w + .4, 0, h1, .8, p1, 0, 0, ln * .9, 0), rest(1)];
};
const T = (o: O = {}): KF[] => {
  const w = o.w ?? .3, x = o.x ?? .3, z1 = o.z1 ?? 1.1, y = o.y ?? 1.15, ya = o.ya ?? .25, ro = o.ro ?? 0, pi = o.pi ?? 1.52;
  return [rest(0), K(w, x, y, -.2, pi, ya, ro, -.1, .35), K(w + .08, x * .8, y + .05, .6, pi, ya * .4, 0, .1, -.1, 1),
    K(w + .14, x * .7, y + .05, z1, pi, 0, 0, .2, -.2, 2), K(w + .3, x * .7, y, z1 - .2, pi, 0, 0, .15, -.1), rest(1)];
};
const TM = (n: number, o: O = {}): KF[] => {
  const w = o.w ?? .22, x = o.x ?? .3, z1 = o.z1 ?? 1.1, y = o.y ?? 1.15, ks: KF[] = [rest(0), K(w, x, y, -.1, 1.52, .2, 0, -.1, .3)];
  for (let i = 0; i < n; i++) { ks.push(K(w + .06 + .1 * i, x * .7, y, z1, 1.52, 0, 0, .2, -.15, 1)); if (i < n - 1) ks.push(K(w + .1 + .1 * i, x * .8, y, z1 - .5, 1.52, 0, 0, .1, 0)); }
  ks.push(K(w + .2 + .1 * n, x * .7, y, z1 - .3, 1.52, 0, 0, .1, 0), rest(1)); return ks;
};
const SP = (turns: number, o: O = {}): KF[] => {
  const w = o.w ?? .2, y = o.y ?? 1.25, pi = o.pi ?? 1.5, end = -TAU * turns;
  return [rest(0), K(w, .4, y, .55, pi, .4, 0, -.05, .7), K(.86, .4, y, .55, pi, .4, 0, .05, end, 1), K(1, .35, 1.1, .4, .9, .2, .4, 0, end)];
};
const FL = (n: number, t0: number, t1: number): KF[] => {
  const ks: KF[] = [];
  for (let i = 0; i < n; i++) {
    const t = t0 + (t1 - t0) * (i / n), s = i % 2 ? -1 : 1, a = s * (1.2 + (i * 7 % 3) * .2), up = i % 3 === 0;
    ks.push(K(t, Math.sin(a) * .5, up ? 1.7 : 1.2, .6, up ? .8 : 1.5, a, up ? s * .8 : 0, .1, -s * .6 + (i % 2) * .3));
  }
  return [rest(0), ...ks, rest(1)];
};
const DIVE: KF[] = [rest(0), K(.2, .1, 2.1, .1, 2.9, 0, 0, .2), K(.32, 0, 1.7, .6, 3.1, 0, 0, .5), K(.7, 0, 1.2, .8, 3.1, 0, 0, .4), rest(1)];

const h = (t: number, dmg: number, range: number, o: Partial<Hit> = {}): Hit => ({ t, dmg, range, ...o });
const A = (id: string, name: string, dur: number, cancel: number, kf: KF[], hits: Hit[], o: Partial<AttackDef> = {}): AttackDef => ({ id, name, dur, cancel, kf, hits, trail: [.3, .62], ...o });

const guardOf = (p: [number, number, number, number, number, number], spin = 0): KF[] => [rest(0), K(.2, p[0], p[1], p[2], p[3], p[4], p[5], -.05, 0, 2), K(1, p[0], p[1], p[2], p[3], p[4] + spin, p[5], -.05, 0)];
const clashOf = (p: [number, number, number, number, number, number], spin = 0): KF[] => [K(0, p[0], p[1], p[2], p[3], p[4], p[5], -.05, 0), K(.25, p[0], p[1], p[2] + .4, p[3] + .15, p[4] + spin * .4, p[5], -.2, 0, 2), K(1, p[0], p[1], p[2], p[3], p[4] + spin, p[5], -.05, 0)];

const ext = (id: string, name: string, kf: KF[], hits: Hit[], dur = .9): AttackDef => A(id, name, dur, .85, kf, hits, { trail: [.3, .75] });

// =========================================================== INFERNO GREATSWORD
const GI: [number, number, number, number, number, number] = [.1, 1.25, .55, .15, 0, 0];
const inferno: WeaponDef = {
  id: 'inferno', name: 'Inferno Greatsword', title: 'Heavy · Fire', color: 0xff3b14, color2: 0xffb04a, elem: 'fire', length: 2.4,
  desc: 'A massive obsidian blade split by rivers of magma. Every swing leaves a wake of living fire.',
  stats: { power: 10, speed: 4, reach: 7, defense: 8 },
  light: [
    A('i1', 'Ember Cleave', .7, .6, H(1.3, -1.3, { w: .32, y: 1.2, ro: .15 }), [h(.46, 15, 3.8, { arc: 2.3, kb: 1.6 })], { lunge: [.3, .5, 1.3], trail: [.34, .62] }),
    A('i2', 'Crimson Backslash', .7, .6, H(-1.3, 1.3, { w: .32, y: 1.2, ro: -.15 }), [h(.46, 16, 3.8, { arc: 2.3, kb: 1.6 })], { lunge: [.3, .5, 1.3], trail: [.34, .62] }),
    A('i3', 'Magma Rise', .78, .64, V(2.4, .1, { w: .3, h0: .6, h1: 1.9, ro: .3 }), [h(.46, 18, 3.9, { arc: 1.9, launch: 7.5, kb: 1 })], { lunge: [.3, .46, 1.2], trail: [.34, .66] }),
    A('i4', 'Blaze Whirl', 1.05, .8, SP(1, { w: .2 }), [h(.36, 11, 4.1, { shape: 'circle', kb: 2 }), h(.52, 11, 4.1, { shape: 'circle' }), h(.7, 17, 4.3, { shape: 'circle', kb: 7, fx: 'burst', shake: .4, stop: .05 })], { trail: [.25, .8] }),
  ],
  heavy: A('ih', 'Maw Crusher', 1.05, .8, V(-.8, 2.3, { w: .38, h0: 2.05, h1: .9 }), [h(.6, 42, 4.3, { arc: 1.8, stagger: 1.5, armor: 2, kb: 4, fx: 'slam', shake: .6, stop: .08, big: true })], { holdAt: .38, charged: 'y', trail: [.45, .75], lunge: [.45, .6, 1.6], stam: 14 }),
  charged: A('ic', "Hell's Fall", 1.35, .9, V(-.9, 2.4, { w: .38, h0: 2.2, h1: .8 }), [h(.6, 72, 7, { shape: 'circle', fx: 'slam', launch: 6, stagger: 2, shake: 1, stop: .12, big: true }), h(.68, 32, 10, { shape: 'line', width: 3.2, fx: 'pillar', launch: 5 })], { trail: [.45, .75], stam: 10 }),
  air: [
    A('ia1', 'Skyfall Cut', .55, .5, H(1.2, -1.2, { w: .22, y: 1.4, pi: 1.2 }), [h(.36, 14, 3.9, { arc: 2.4, kb: 1 })], { air: true, hover: true, trail: [.26, .5] }),
    A('ia2', 'Cinder Drop', .6, .55, V(-.5, 2.3, { w: .24, h0: 2, h1: 1 }), [h(.46, 20, 3.9, { arc: 1.9, kb: 1.5, stagger: .5 })], { air: true, hover: true, trail: [.3, .58] }),
  ],
  airHeavy: A('iad', 'Meteor Drop', 1.25, .85, DIVE, [h(.5, 48, 5.8, { shape: 'circle', land: true, fx: 'slam', launch: 5, stagger: 1.5, shake: .7, stop: .08, big: true })], { dive: true, air: true, holdAt: .32 }),
  spec1: A('is1', 'Infernal Wave', .85, .72, V(-.6, 2.2, { w: .34, h0: 1.9, h1: 1 }), [h(.58, 34, 1, { act: 'proj', proj: { speed: 24, life: .9, size: 3.4, pierce: true, kind: 'wave', elem: 'fire' }, fx: 'none', shake: .35 })], { cd: 5.5, lunge: [.5, .62, .8], trail: [.4, .7] }),
  spec2: A('is2', 'Flame Explosion', 1.05, .82, V(-.5, 3.0, { w: .4, h0: 1.9, h1: .7 }), [h(.58, 50, 7.5, { shape: 'circle', fx: 'burst', launch: 8, kb: 5, stagger: 1, shake: .8, stop: .1, big: true }), h(.72, 16, 10.5, { shape: 'circle', fx: 'burst', kb: 6 })], { cd: 9, trail: [.45, .7] }),
  ult: A('iu', 'Hellfire Cataclysm', 3.2, .95, [rest(0), K(.22, 0, 2.3, -.2, -.5, 0, .1, -.25, .2), K(.4, 0, 2.7, 0, -.7, 0, 0, -.35), K(.52, 0, 1.5, .8, 2.3, 0, 0, .4, 0, 1), K(.64, 0, 1.0, .9, 2.5, 0, 0, .45, 0, 2), K(1, .35, 1.1, .4, .9, .2, .4)],
    [h(.2, 0, 1, { act: 'flash', p: 1 }), h(.52, 70, 1, { act: 'proj', proj: { speed: 34, life: .55, size: 8, pierce: true, kind: 'wave', elem: 'fire' }, fx: 'ult', shake: 1, stop: .1, big: true }), h(.62, 140, 13, { shape: 'circle', ox: 12, fx: 'ult', launch: 11, stagger: 3, shake: 1.5, big: true })],
    { invuln: true, cinematic: true, trail: [.45, .8] }),
  counter: A('ico', 'Infernal Riposte', .64, .55, V(2.5, .1, { w: .2, h0: .6, h1: 2 }), [h(.38, 40, 4.4, { arc: 2.4, launch: 8, fx: 'burst', stagger: 1, stop: .1, shake: .6, big: true })], { lunge: [.2, .34, 2.6], trail: [.24, .55] }),
  extra: ext('ix', 'Phoenix Finale', V(-.9, 2.6, { w: .4, h0: 2.1, h1: .8 }), [h(.62, 34, 5, { shape: 'circle', fx: 'burst', launch: 5, kb: 4, shake: .6, stop: .08, big: true })], 1.0),
  guard: guardOf(GI), clash: clashOf(GI), pw: .15, nw: .32, lock: .3,
  deflectName: 'Bulwark Clash', counterName: 'Infernal Riposte', awakenName: 'Blazing Colossus',
  awakenDesc: 'The blade swells into a gigantic sword wreathed in a roaring inferno. Wider cleaves, burning waves.',
  skins: [{ name: 'Ashen Lord', color: 0xff3b14, color2: 0xffb04a }, { name: 'Phoenix Heart', color: 0xffc01a, color2: 0xfff2a0 }, { name: 'Blackflame', color: 0x9a3dff, color2: 0xff8cf6 }],
  moves: ['Light: 4-hit cleave chain ending in a Blaze Whirl', 'Heavy (hold to charge): Maw Crusher → Hell\'s Fall', 'E Infernal Wave · R Flame Explosion', 'Aerial: Skyfall Cut, Meteor Drop dive', 'Counter: Infernal Riposte launcher'],
};

// =========================================================== THUNDER TWIN BLADES
const GT: [number, number, number, number, number, number] = [.15, 1.3, .6, .75, .2, 1.05];
const thunder: WeaponDef = {
  id: 'thunder', name: 'Thunder Twin Blades', title: 'Fast · Lightning', color: 0x3d9bff, color2: 0xc8f0ff, elem: 'lightning', length: 1.2, dual: true,
  desc: 'Two chrome-bright blades crackling with captured storm. Strike faster than thunder follows lightning.',
  stats: { power: 5, speed: 10, reach: 4, defense: 5 },
  light: [
    A('t1', 'Spark Slash', .36, .5, H(1.1, -1, { w: .17, r: .8, tw: .4 }), [h(.3, 7, 3, { arc: 2.4, kb: .6 })], { hand: 'R', trail: [.2, .4], lunge: [.15, .3, 1] }),
    A('t2', 'Arc Slash', .36, .5, H(-1.1, 1, { w: .17, r: .8, tw: .4 }), [h(.3, 7, 3, { arc: 2.4, kb: .6 })], { hand: 'L', trail: [.2, .4], lunge: [.15, .3, 1] }),
    A('t3', 'Twin Rend', .52, .55, H(1.3, -1.3, { w: .2, tw: .5 }), [h(.32, 6, 3.1, { arc: 2.6 }), h(.44, 7, 3.1, { arc: 2.6, kb: 1 })], { hand: 'B', trail: [.22, .55], lunge: [.2, .4, 1.3] }),
    A('t4', 'Bolt Rise', .4, .52, V(2.3, .2, { w: .18, h0: .6, h1: 1.9 }), [h(.28, 9, 3.3, { arc: 1.8, launch: 6 })], { hand: 'R', trail: [.2, .45], lunge: [.15, .28, 1.2] }),
    A('t5', 'Tempest Spin', .85, .8, SP(1, { w: .15 }), [h(.3, 6, 3.3, { shape: 'circle' }), h(.45, 6, 3.3, { shape: 'circle' }), h(.6, 6, 3.3, { shape: 'circle' }), h(.76, 10, 3.5, { shape: 'circle', kb: 5, fx: 'bolts', shake: .35 })], { hand: 'B', trail: [.2, .82] }),
  ],
  heavy: A('th', 'Cross Rend', .8, .72, V(-.5, 2.2, { w: .3, ro: .6 }), [h(.5, 17, 3.6, { arc: 2.2, stagger: .8, kb: 2.5 }), h(.57, 19, 3.6, { arc: 2.2, stagger: .8, kb: 2.5, fx: 'bolts', stop: .06, shake: .4 })], { hand: 'B', holdAt: .3, charged: 'y', trail: [.4, .68], lunge: [.4, .55, 2], stam: 12 }),
  charged: A('tc', 'Storm Cross', 1.0, .9, [rest(0), K(.3, .4, 1.6, -.1, .6, .8, .9, -.1, .4), K(.42, .3, 1.2, .8, 1.5, 0, 0, .2, 0, 1), K(.7, .3, 1.2, .9, 1.5, 0, 0, .2, -.3), rest(1)],
    [h(.42, 12, 3.4, { arc: 2.4 }), h(.48, 12, 3.4, { arc: 2.4 }), h(.54, 12, 3.4, { arc: 2.4 }), h(.6, 12, 3.4, { arc: 2.4 }), h(.68, 26, 5, { shape: 'circle', fx: 'bolts', launch: 7, shake: .8, stop: .08, big: true })], { hand: 'B', lunge: [.4, .62, 6], trail: [.4, .72], invuln: true }),
  air: [
    A('ta1', 'Skyline Slash', .36, .5, H(1.2, -1.2, { w: .15, y: 1.4, pi: 1.2, tw: .4 }), [h(.26, 7, 3.2, { arc: 2.6 })], { air: true, hover: true, hand: 'R', trail: [.17, .36] }),
    A('ta2', 'Skyline Cross', .36, .5, H(-1.2, 1.2, { w: .15, y: 1.4, pi: 1.2, tw: .4 }), [h(.26, 7, 3.2, { arc: 2.6 })], { air: true, hover: true, hand: 'L', trail: [.17, .36] }),
    A('ta3', 'Aerial Storm', .55, .5, SP(1, { w: .12 }), [h(.3, 6, 3.4, { shape: 'circle' }), h(.5, 8, 3.4, { shape: 'circle', kb: 3 }), h(.7, 9, 3.6, { shape: 'circle', launch: 3, fx: 'bolts' })], { air: true, hover: true, hand: 'B', trail: [.15, .8] }),
  ],
  airHeavy: A('tad', 'Thunder Plunge', 1.1, .8, DIVE, [h(.5, 30, 5.2, { shape: 'circle', land: true, fx: 'bolts', launch: 4, stagger: 1, shake: .6, stop: .06, big: true })], { dive: true, air: true, holdAt: .32, hand: 'B' }),
  spec1: A('ts1', 'Thunder Dash', .55, .46, [rest(0), K(.1, .4, 1.2, -.1, 1.5, .3, 0, -.2, .4), K(.22, .3, 1.2, 1.1, 1.52, 0, 0, .5, -.2, 1), K(.6, .3, 1.2, 1.1, 1.52, 0, 0, .5, 0), rest(1)],
    [h(.2, 26, 9.5, { shape: 'line', width: 2.2, fx: 'bolts', kb: 2, stop: .06, shake: .4 }), h(.38, 14, 3.5, { shape: 'circle', fx: 'bolts', kb: 3 })], { cd: 4, lunge: [.12, .36, 9], invuln: true, hand: 'B', trail: [.1, .5] }),
  spec2: A('ts2', 'Lightning Storm', 1.6, .8, [rest(0), K(.2, .3, 2.0, .2, .3, .5, .5, -.2, .3), K(.8, .3, 2.1, .2, .3, .5, .5, -.2, -.3), rest(1)],
    [0, 1, 2, 3, 4, 5, 6].map(i => h(.3 + i * .08, 17, 2.6, { shape: 'circle', act: 'bolt', p: 14, fx: 'bolts', shake: .25, stop: .03 })).concat([h(.9, 20, 8, { shape: 'circle', fx: 'bolts', shake: .5, launch: 4 })]), { cd: 12, hand: 'B', trail: [.2, .2] }),
  ult: A('tu', 'Thousand Thunder Cuts', 3.0, .95, FL(16, .1, .8),
    [...Array.from({ length: 14 }, (_, i) => h(.12 + i * .05, 9, 3.4, { shape: 'circle', act: 'blink', fx: 'hit', shake: .18, stop: .015 })), h(.9, 70, 10, { shape: 'circle', fx: 'ult', launch: 10, stagger: 2.5, shake: 1.4, big: true })],
    { invuln: true, cinematic: true, hand: 'B', trail: [.1, .85] }),
  counter: A('tco', 'Lightning Rebuttal', .85, .6, H(1.2, -1.2, { w: .15, tw: .5 }), [h(.16, 10, 3.4, { shape: 'circle', act: 'blink', fx: 'bolts' }), h(.3, 12, 3.4, { shape: 'circle' }), h(.42, 14, 3.4, { shape: 'circle' }), h(.54, 24, 3.6, { shape: 'circle', launch: 6, fx: 'bolts', stop: .08, shake: .6 })], { hand: 'B', trail: [.1, .65] }),
  extra: ext('tx', 'Storm Crown', SP(2, { w: .15 }), [0, 1, 2, 3, 4].map(i => h(.25 + i * .12, 7, 3.6, { shape: 'circle', fx: i === 4 ? 'bolts' : 'hit', kb: i === 4 ? 6 : 0 })), 1.0),
  guard: guardOf(GT), clash: clashOf(GT), pw: .115, nw: .26, lock: .12,
  deflectName: 'Chain Lightning Cross', counterName: 'Lightning Rebuttal', awakenName: 'Raijin Wings',
  awakenDesc: 'Wings of pure electricity unfurl from your back; your blades blur with arcing storm. Faster combos, chain bolts.',
  skins: [{ name: 'Stormcaller', color: 0x3d9bff, color2: 0xc8f0ff }, { name: 'Violet Tempest', color: 0xb44dff, color2: 0xf0d0ff }, { name: 'Solar Storm', color: 0xffe14d, color2: 0xffffff }],
  moves: ['Light: 5-hit dual-blade chain, ends in Tempest Spin', 'Heavy: Cross Rend → charged Storm Cross dash', 'E Thunder Dash · R Lightning Storm', 'Aerial 3-hit combo + Thunder Plunge', 'Counter: Lightning Rebuttal flurry'],
};

// =========================================================== VOID SCYTHE
const GV: [number, number, number, number, number, number] = [.1, 1.4, .6, .25, 0, 0];
const voidw: WeaponDef = {
  id: 'void', name: 'Void Scythe', title: 'Control · Void', color: 0xa24bff, color2: 0xe8c4ff, elem: 'void', length: 2.7,
  desc: 'A curved reaper blade that drinks light. It tears the space between heartbeats and drags enemies through it.',
  stats: { power: 7, speed: 6, reach: 9, defense: 6 },
  light: [
    A('v1', 'Crescent Reap', .78, .62, H(1.8, -1.8, { w: .34, y: 1.3, tw: 1 }), [h(.52, 13, 4.7, { arc: 3.1, kb: 1.2 })], { trail: [.38, .68], lunge: [.3, .5, 1] }),
    A('v2', 'Reverse Reap', .78, .62, H(-1.8, 1.8, { w: .34, y: 1.3, tw: 1 }), [h(.52, 14, 4.7, { arc: 3.1, kb: 1.2 })], { trail: [.38, .68], lunge: [.3, .5, 1] }),
    A('v3', 'Gravity Hook', .8, .66, H(1.6, -.6, { w: .32, y: 1.35, tw: .8 }), [h(.5, 12, 5.8, { arc: 2.7, pull: 5, kb: 0 })], { trail: [.36, .66] }),
    A('v4', 'Lunar Launcher', .85, .7, V(2.5, .1, { w: .32, h0: .5, h1: 2, ro: -.3 }), [h(.52, 18, 4.6, { arc: 2.4, launch: 9.5, fx: 'burst', shake: .35 })], { trail: [.36, .7], lunge: [.35, .5, 1.2] }),
  ],
  heavy: A('vh', 'Reaper Spiral', 1.1, .85, SP(1, { w: .3 }), [h(.4, 12, 4.4, { shape: 'circle', pull: 2 }), h(.55, 12, 4.4, { shape: 'circle', pull: 2 }), h(.7, 20, 4.8, { shape: 'circle', kb: 4, stagger: 1, fx: 'rift', shake: .5, stop: .06 })], { holdAt: .3, charged: 'y', trail: [.32, .86], stam: 12 }),
  charged: A('vc', 'Event Horizon', 1.5, .9, SP(1, { w: .3 }), [h(.4, 6, 10, { shape: 'circle', pull: 9 }), h(.58, 6, 10, { shape: 'circle', pull: 9 }), h(.76, 64, 6.5, { shape: 'circle', fx: 'rift', launch: 8, stagger: 2, shake: .9, stop: .1, big: true })], { trail: [.32, .86], stam: 10 }),
  air: [
    A('va1', 'Aerial Reap', .7, .55, SP(1, { w: .2, y: 1.4 }), [h(.4, 12, 4.6, { shape: 'circle' }), h(.62, 13, 4.6, { shape: 'circle', kb: 2 })], { air: true, hover: true, trail: [.25, .8] }),
    A('va2', 'Rift Whirl', .8, .6, SP(1, { w: .2, y: 1.4 }), [h(.4, 12, 4.8, { shape: 'circle', pull: 3 }), h(.65, 16, 4.8, { shape: 'circle', kb: 3, fx: 'rift' })], { air: true, hover: true, trail: [.25, .8] }),
  ],
  airHeavy: A('vad', 'Void Descent', 1.25, .85, DIVE, [h(.5, 42, 6, { shape: 'circle', land: true, fx: 'rift', pull: 3, launch: 6, stagger: 1.5, shake: .7, stop: .08, big: true })], { dive: true, air: true, holdAt: .32 }),
  spec1: A('vs1', 'Gravity Collapse', 1.15, .8, [rest(0), K(.3, .2, 1.8, .3, .4, 0, .2, -.15, .2), K(.5, 0, 1.4, 1, 2.2, 0, 0, .3, 0, 1), K(.75, 0, 1.4, 1, 2.2, 0, 0, .3), rest(1)],
    [h(.5, 0, 1, { act: 'hole', ox: 7, p: 1.9, fx: 'none', shake: .3 })], { cd: 10, trail: [.4, .6] }),
  spec2: A('vs2', 'Rift Slash', .95, .7, H(1.9, -1.9, { w: .3, y: 1.3 }), [h(.26, 0, .1, { shape: 'circle', act: 'warp', p: 5, fx: 'rift' }), h(.52, 30, 5.2, { arc: 3, act: 'proj', proj: { speed: 28, life: .55, size: 5, pierce: true, kind: 'wave', elem: 'void' }, fx: 'arc', stop: .06, shake: .4 })], { cd: 7, trail: [.32, .62] }),
  ult: A('vu', 'Dimension Breaker', 3.4, .95, [rest(0), K(.2, 0, 2.2, .1, .3, 0, .2, -.2, .3), K(.4, 0, 2.5, .2, .3, 3, 0, -.3, 0), K(.55, 0, 2.5, .3, 1.1, 6, 0, .1, 0), K(.78, 0, 1.2, 1, 2.6, 6.28, 0, .45, 0, 1), K(1, .35, 1.1, .4, .9, .2, .4)],
    [h(.3, 0, 1, { act: 'rift', ox: 8, fx: 'none', shake: .4 }), h(.42, 8, 17, { shape: 'circle', pull: 10 }), h(.56, 30, 17, { shape: 'circle', pull: 6, fx: 'rift', shake: .6 }), h(.8, 120, 15, { shape: 'circle', ox: 6, fx: 'ult', launch: 12, stagger: 3, shake: 1.5, big: true })],
    { invuln: true, cinematic: true, trail: [.5, .85] }),
  counter: A('vco', 'Phase Slash', .75, .6, H(1.9, -1.9, { w: .2, y: 1.3 }), [h(.16, 8, 4, { shape: 'circle', act: 'blink', fx: 'rift' }), h(.4, 36, 5.8, { arc: 3.1, pull: 3, fx: 'rift', launch: 4, stop: .1, shake: .6, big: true })], { trail: [.28, .6] }),
  extra: ext('vx', 'Abyss Harvest', SP(2, { w: .25 }), [0, 1, 2, 3].map(i => h(.3 + i * .14, 12, 4.8, { shape: 'circle', pull: 2, fx: i === 3 ? 'rift' : 'hit', launch: i === 3 ? 6 : 0 })), 1.2),
  guard: guardOf(GV, 9.4), clash: clashOf(GV, 6.28), pw: .15, nw: .32, lock: .3,
  deflectName: 'Singularity Spin', counterName: 'Phase Slash', awakenName: 'Dimensional Halo',
  awakenDesc: 'A rotating dimensional ring opens behind the blade. Reaps tear rifts and pull harder.',
  skins: [{ name: 'Abyss Reaper', color: 0xa24bff, color2: 0xe8c4ff }, { name: 'Crimson Eclipse', color: 0xff2f6a, color2: 0xffc2d4 }, { name: 'Stellar Void', color: 0x35e0b4, color2: 0xcaffee }],
  moves: ['Light: wide circular reaps, hook that pulls, launcher', 'Heavy: Reaper Spiral → charged Event Horizon', 'E Gravity Collapse · R Rift Slash', 'Aerial spinning reaps + Void Descent', 'Counter: teleporting Phase Slash'],
};

// =========================================================== GLACIER SPEAR
const GG: [number, number, number, number, number, number] = [.2, 1.3, .6, 1.0, .9, 0];
const glacier: WeaponDef = {
  id: 'glacier', name: 'Glacier Spear', title: 'Reach · Ice', color: 0x66e0ff, color2: 0xffffff, elem: 'ice', length: 2.9,
  desc: 'A graceful spear tipped with a living ice crystal. Pierce from afar, then freeze the aftermath.',
  stats: { power: 6, speed: 7, reach: 10, defense: 6 },
  light: [
    A('g1', 'Piercing Jab', .46, .5, T({ w: .22, x: .3 }), [h(.34, 10, 5.2, { shape: 'line', width: 1.4, kb: 1 })], { lunge: [.22, .36, 1.4], trail: [.26, .42] }),
    A('g2', 'Twin Jab', .46, .5, T({ w: .22, x: .0, ya: -.25 }), [h(.34, 10, 5.2, { shape: 'line', width: 1.4, kb: 1 })], { lunge: [.22, .36, 1.4], trail: [.26, .42] }),
    A('g3', 'Frost Sweep', .62, .6, H(1.4, -1.4, { w: .26, r: 1.1, tw: .6 }), [h(.42, 13, 4.7, { arc: 2.3, kb: 2.5 })], { trail: [.3, .55], lunge: [.25, .42, .8] }),
    A('g4', 'Triple Thrust', .8, .78, TM(3, { w: .22 }), [h(.34, 8, 5.6, { shape: 'line', width: 1.4 }), h(.45, 8, 5.6, { shape: 'line', width: 1.4 }), h(.56, 16, 6, { shape: 'line', width: 1.6, kb: 5, fx: 'crystals', shake: .35 })], { lunge: [.25, .6, 2], trail: [.3, .65] }),
  ],
  heavy: A('gh', 'Lance Impale', .85, .75, T({ w: .35, z1: 1.3 }), [h(.54, 36, 7, { shape: 'line', width: 1.8, stagger: 1.5, armor: 2, kb: 4, fx: 'crystals', shake: .5, stop: .08, big: true })], { holdAt: .35, charged: 'y', trail: [.48, .65], lunge: [.45, .58, 3.5], stam: 13 }),
  charged: A('gc', 'Glacier Throw', 1.1, .9, [rest(0), K(.35, .4, 1.5, -.5, 1.5, .3, 0, -.25, .5), K(.52, .3, 1.4, 1.1, 1.52, 0, 0, .3, -.3, 2), K(.8, .3, 1.3, .9, 1.52, 0, 0, .2, 0), rest(1)],
    [h(.5, 60, 1, { act: 'proj', proj: { speed: 36, life: .7, size: 1.4, pierce: true, kind: 'spear', elem: 'ice', freeze: 1.8 }, fx: 'none', shake: .7, stop: .1, big: true })], { stam: 10, trail: [.4, .6] }),
  air: [
    A('ga1', 'Dive Jab', .5, .5, T({ w: .2, pi: 2.1 }), [h(.34, 11, 5, { shape: 'line', width: 1.6 })], { air: true, hover: true, trail: [.24, .44] }),
    A('ga2', 'Skyward Sweep', .55, .55, H(1.3, -1.3, { w: .2, y: 1.4, pi: 1.3, r: 1.1 }), [h(.36, 13, 4.7, { arc: 2.4, kb: 1.5 })], { air: true, hover: true, trail: [.26, .5] }),
  ],
  airHeavy: A('gad', 'Falling Star', 1.2, .85, DIVE, [h(.5, 40, 5.5, { shape: 'circle', land: true, fx: 'crystals', launch: 4, stagger: 1.5, freeze: 1, shake: .6, stop: .08, big: true })], { dive: true, air: true, holdAt: .32 }),
  spec1: A('gs1', 'Frozen Lance', .75, .65, T({ w: .3, z1: 1.3 }), [h(.48, 30, 1, { act: 'proj', proj: { speed: 30, life: .8, size: 1.6, pierce: true, kind: 'lance', elem: 'ice', freeze: 1.6 }, fx: 'none', shake: .4 })], { cd: 5, lunge: [.4, .55, .8], trail: [.4, .58] }),
  spec2: A('gs2', 'Crystal Prison', 1.0, .75, [rest(0), K(.3, .2, 1.1, .4, .3, 0, .3, -.1), K(.5, .1, .8, 1, 2.6, 0, 0, .4, 0, 1), K(.8, .1, .9, 1, 2.6, 0, 0, .3), rest(1)],
    [h(.5, 12, 6.8, { shape: 'circle', ox: 3.5, freeze: 3.6, fx: 'crystals', stagger: 1, shake: .5, stop: .06 })], { cd: 9, trail: [.4, .55] }),
  ult: A('gu', 'Eternal Winter', 3.0, .95, [rest(0), K(.25, .1, 2.2, .3, .2, 0, 0, -.2), K(.45, 0, 2.5, .3, .1, 0, 0, -.3), K(.6, 0, .6, 1, 3.1, 0, 0, .5, 0, 1), K(1, .35, 1.1, .4, .9, .2, .4)],
    [h(.2, 0, 1, { act: 'flash', p: 2 }), h(.6, 76, 16.5, { shape: 'circle', fx: 'ult', freeze: 5.5, launch: 5, stagger: 3, shake: 1.4, big: true })], { invuln: true, cinematic: true, trail: [.5, .7] }),
  counter: A('gco', 'Precision Redirect', .5, .5, T({ w: .14, z1: 1.3 }), [h(.26, 42, 7, { shape: 'line', width: 2, launch: 3, stagger: 1.5, fx: 'crystals', stop: .1, shake: .6, big: true })], { lunge: [.14, .3, 4.5], trail: [.18, .4] }),
  extra: ext('gx', 'Aurora Skewer', TM(5, { w: .25 }), [0, 1, 2, 3, 4].map(i => h(.34 + i * .1, 8 + i, 6, { shape: 'line', width: 1.6, fx: i === 4 ? 'crystals' : 'hit', kb: i === 4 ? 6 : 0 })), 1.1),
  guard: guardOf(GG, -1.9), clash: clashOf(GG, -1.9), pw: .15, nw: .3, lock: .22,
  deflectName: 'Redirecting Sweep', counterName: 'Precision Redirect', awakenName: 'Crystal Colossus',
  awakenDesc: 'The blade grows into a giant crystalline lance bristling with ice shards. Thrusts shatter outward.',
  skins: [{ name: 'Winter Queen', color: 0x66e0ff, color2: 0xffffff }, { name: 'Emerald Frost', color: 0x4dffb0, color2: 0xe0fff0 }, { name: 'Rose Quartz', color: 0xff8ad8, color2: 0xffeaf8 }],
  moves: ['Light: jabs, frost sweep, triple thrust finisher', 'Heavy: Lance Impale → charged Glacier Throw', 'E Frozen Lance · R Crystal Prison', 'Aerial dive jabs + Falling Star', 'Counter: Precision Redirect pierce'],
};

// =========================================================== PLASMA KATANA
const GP: [number, number, number, number, number, number] = [0, 1.3, .6, 1.45, .9, 0];
const plasma: WeaponDef = {
  id: 'plasma', name: 'Plasma Katana', title: 'Precision · Plasma', color: 0x27f2ff, color2: 0xffffff, elem: 'plasma', length: 1.7,
  desc: 'A monomolecular energy blade humming at the edge of physics. Perfect timing is rewarded with a cinematic cut.',
  stats: { power: 7, speed: 9, reach: 6, defense: 5 },
  light: [
    A('p1', 'Precision Cut', .46, .52, H(1.2, -1.2, { w: .22, tw: .5 }), [h(.34, 9, 3.6, { arc: 2.3, kb: .8 })], { lunge: [.2, .34, 1.1], trail: [.26, .46] }),
    A('p2', 'Quick Draw', .42, .5, H(-1.1, 1.1, { w: .2, tw: .5, y: 1.15 }), [h(.32, 9, 3.6, { arc: 2.3, kb: .8 })], { lunge: [.2, .32, 1.1], trail: [.24, .44] }),
    A('p3', 'Rising Edge', .5, .55, V(2.4, .2, { w: .22, h0: .6, h1: 1.9, ro: .4 }), [h(.34, 11, 3.7, { arc: 1.6, launch: 5.5 })], { lunge: [.2, .34, 1.2], trail: [.26, .5] }),
    A('p4', 'Cross Slice', .52, .56, V(-.6, 2.2, { w: .22, ro: -.5, h0: 1.9, h1: .9 }), [h(.38, 12, 3.7, { arc: 1.8, kb: 1.5 })], { lunge: [.2, .36, 1.2], trail: [.26, .52] }),
    A('p5', 'Photon Cross', .75, .8, H(1.4, -1.4, { w: .22, tw: .7 }), [h(.34, 10, 3.9, { arc: 2.6 }), h(.5, 16, 4, { arc: 2.6, kb: 4, fx: 'burst', stop: .05, shake: .4 })], { lunge: [.2, .45, 1.8], trail: [.26, .62] }),
  ],
  heavy: A('ph', 'Vertical Sever', .85, .75, V(-.7, 2.3, { w: .34, h0: 2, h1: .9 }), [h(.56, 32, 4.4, { shape: 'cone', arc: 1, stagger: 1.2, kb: 3, fx: 'arc', shake: .5, stop: .08, big: true })], { holdAt: .34, charged: 'y', trail: [.42, .7], lunge: [.4, .56, 1.8], stam: 12 }),
  charged: A('pc', 'Plasma Edge', 1.0, .9, V(-.7, 2.3, { w: .34, h0: 2, h1: .9 }), [h(.56, 52, 1, { act: 'proj', proj: { speed: 40, life: .7, size: 4.2, pierce: true, kind: 'wave', elem: 'plasma' }, fx: 'arc', shake: .6, stop: .1, big: true })], { trail: [.42, .7], stam: 10 }),
  air: [
    A('pa1', 'Skyline Cut', .42, .5, H(1.2, -1.2, { w: .17, y: 1.4, pi: 1.2, tw: .4 }), [h(.3, 9, 3.7, { arc: 2.4 })], { air: true, hover: true, trail: [.2, .4] }),
    A('pa2', 'Aerial Rake', .42, .5, V(-.3, 2.3, { w: .17, h0: 2, h1: 1.1, ro: .5 }), [h(.32, 10, 3.7, { arc: 1.8 })], { air: true, hover: true, trail: [.2, .42] }),
    A('pa3', 'Zenith Cross', .6, .55, H(1.4, -1.4, { w: .17, y: 1.4, pi: 1.2 }), [h(.3, 9, 3.8, { arc: 2.6 }), h(.46, 13, 3.9, { arc: 2.6, launch: 3, fx: 'burst' })], { air: true, hover: true, trail: [.2, .56] }),
  ],
  airHeavy: A('pad', 'Skyfall Edge', 1.15, .8, DIVE, [h(.5, 36, 5, { shape: 'circle', land: true, fx: 'burst', launch: 4, stagger: 1.2, shake: .6, stop: .08, big: true })], { dive: true, air: true, holdAt: .32 }),
  spec1: A('ps1', 'Plasma Wave', .6, .58, H(1.5, -1.5, { w: .2 }), [h(.34, 26, 1, { act: 'proj', proj: { speed: 36, life: .7, size: 4, pierce: true, kind: 'wave', elem: 'plasma' }, fx: 'arc', shake: .3, stop: .04 })], { cd: 3.5, trail: [.22, .46] }),
  spec2: A('ps2', 'Photon Dash', .8, .6, [rest(0), K(.1, .3, 1.2, -.1, 1.5, .8, 0, -.2, .5), K(.3, .3, 1.2, .9, 1.5, -.8, 0, .3, -.5, 2), K(.6, .3, 1.2, .8, 1.5, 0, 0, .1, 0), rest(1)],
    [h(.14, 13, 3.8, { shape: 'circle', act: 'blink', p: 1.6, fx: 'arc', stop: .03 }), h(.3, 13, 3.8, { shape: 'circle', fx: 'hit', stop: .03 }), h(.44, 20, 3.9, { shape: 'circle', fx: 'burst', kb: 4, launch: 3, stop: .06, shake: .45 })], { cd: 6, invuln: true, trail: [.1, .5] }),
  ult: A('pu', 'Absolute Zero Cut', 3.3, .95, FL(10, .15, .6),
    [...[0, 1, 2, 3, 4, 5, 6, 7].map(i => h(.15 + i * .06, 0, 3, { shape: 'circle', act: 'mark', fx: 'none' })), h(.9, 150, 15, { shape: 'circle', act: 'resolve', fx: 'ult', launch: 8, stagger: 3, shake: 1.4, big: true })],
    { invuln: true, cinematic: true, trail: [.15, .65], slowmo: [.12, .85, .32] }),
  counter: A('pco', 'Iai Counter', .8, .6, [rest(0), K(.12, -.1, 1.15, .2, 1.52, 1.4, 0, -.1, .8), K(.3, .1, 1.2, .5, 1.5, 1.4, 0, -.1, .8), K(.4, .1, 1.2, .9, 1.5, -1.6, 0, .25, -.8, 1), K(.6, .1, 1.2, .9, 1.5, -1.6, 0, .25, -.6), rest(1)],
    [h(.4, 62, 7, { shape: 'line', width: 3.2, launch: 5, stagger: 2, fx: 'arc', stop: .16, shake: .8, big: true })], { lunge: [.34, .46, 3.5], trail: [.34, .56], slowmo: [.12, .45, .3], cinematic: true }),
  extra: ext('px', 'Zero Edge', H(1.6, -1.6, { w: .2, tw: .9 }), [0, 1, 2].map(i => h(.3 + i * .13, 11 + i * 3, 4.2, { arc: 2.8, fx: i === 2 ? 'burst' : 'hit', kb: i === 2 ? 6 : 0, launch: i === 2 ? 5 : 0 })), .9),
  guard: guardOf(GP), clash: clashOf(GP), pw: .18, nw: .3, lock: .2,
  deflectName: 'Perfect Clash', counterName: 'Iai Counter', awakenName: 'Photon Extension',
  awakenDesc: 'The blade stretches into a towering energy edge. Every cut reaches farther and flares with plasma.',
  skins: [{ name: 'Cyan Edge', color: 0x27f2ff, color2: 0xffffff }, { name: 'Magenta Rift', color: 0xff3df0, color2: 0xffd6fb }, { name: 'Gold Standard', color: 0xffd034, color2: 0xfff6c8 }],
  moves: ['Light: 5-hit precision chain with Photon Cross', 'Heavy: Vertical Sever → charged Plasma Edge wave', 'E Plasma Wave · R Photon Dash', 'Aerial 3-hit chain + Skyfall Edge', 'Counter: slow-motion Iai Counter'],
};

// =========================================================== TITAN HAMMER
const GM: [number, number, number, number, number, number] = [0, 1.25, .55, 1.5, 1.57, 0];
const titan: WeaponDef = {
  id: 'titan', name: 'Titan Hammer', title: 'Crush · Earth', color: 0xffc43d, color2: 0xfff1b8, elem: 'earth', length: 2.1,
  desc: 'A colossal gilded maul etched with runes of the first giants. It does not strike - it decides.',
  stats: { power: 9, speed: 3, reach: 6, defense: 10 },
  light: [
    A('m1', 'Titan Swing', .85, .68, H(1.2, -1.3, { w: .36, y: 1.15, tw: .9 }), [h(.54, 24, 3.9, { arc: 2.3, kb: 3, stagger: .8, armor: 1.5, fx: 'burst', shake: .3, stop: .06 })], { lunge: [.3, .5, 1.3], trail: [.4, .65] }),
    A('m2', 'Hammer Whirl', 1.1, .85, SP(1, { w: .25 }), [h(.38, 16, 4, { shape: 'circle', kb: 2, stagger: .5 }), h(.62, 22, 4.2, { shape: 'circle', kb: 5, stagger: .8, shake: .3, stop: .05 })], { trail: [.3, .82] }),
    A('m3', 'Crown Breaker', 1.0, .85, V(-.8, 2.4, { w: .36, h0: 2.1, h1: .9 }), [h(.6, 36, 4.3, { arc: 2, kb: 4, stagger: 1.2, armor: 2, fx: 'slam', shake: .6, stop: .08, big: true })], { lunge: [.4, .58, 1.4], trail: [.44, .72] }),
  ],
  heavy: A('mh', 'Overhead Slam', 1.2, .85, V(-.9, 2.5, { w: .4, h0: 2.2, h1: .8 }), [h(.64, 52, 4.6, { arc: 2, stagger: 2, armor: 4, kb: 5, fx: 'slam', shake: .8, stop: .1, big: true })], { holdAt: .4, charged: 'y', trail: [.48, .76], lunge: [.5, .64, 1.4], stam: 15 }),
  charged: A('mc', 'Ground Smash', 1.5, .92, V(-.9, 2.6, { w: .4, h0: 2.3, h1: .7 }), [h(.64, 84, 8, { shape: 'circle', fx: 'slam', launch: 5, stagger: 3, armor: 6, shake: 1.1, stop: .14, big: true })], { trail: [.48, .76], stam: 10 }),
  air: [
    A('ma1', 'Sky Hammer', .75, .6, H(1.2, -1.2, { w: .26, y: 1.4, pi: 1.3 }), [h(.44, 22, 4, { arc: 2.3, kb: 3, stagger: .6 })], { air: true, hover: true, trail: [.3, .55] }),
    A('ma2', 'Falling Maul', .85, .65, V(-.6, 2.4, { w: .28, h0: 2, h1: 1.1 }), [h(.5, 28, 4.2, { arc: 2, kb: 4, stagger: 1, fx: 'burst' })], { air: true, hover: true, trail: [.32, .6] }),
  ],
  airHeavy: A('mad', 'Meteor Hammer', 1.3, .85, DIVE, [h(.5, 58, 6.2, { shape: 'circle', land: true, fx: 'slam', launch: 4, stagger: 2.5, shake: 1, stop: .12, big: true })], { dive: true, air: true, holdAt: .32 }),
  spec1: A('ms1', 'Earthquake', 1.5, .88, V(-.7, 3.0, { w: .38, h0: 2.1, h1: .6 }), [h(.58, 22, 4.8, { shape: 'circle', fx: 'slam', launch: 5, stagger: 1.2, shake: .8, stop: .08 }), h(.7, 22, 8.2, { shape: 'circle', act: 'quake', fx: 'none', launch: 5, stagger: 1.2, shake: .5 }), h(.82, 22, 11.8, { shape: 'circle', act: 'quake', fx: 'none', launch: 5, stagger: 1.2, shake: .5 })], { cd: 8, trail: [.44, .7] }),
  spec2: A('ms2', 'Titan Impact', 1.3, .85, V(-.6, 2.6, { w: .3, h0: 2.2, h1: .8 }), [h(.6, 72, 6.8, { shape: 'circle', land: true, fx: 'slam', launch: 6, stagger: 2.5, armor: 5, shake: 1, stop: .12, big: true })], { cd: 10, leap: 11, dive: true, holdAt: .46, lunge: [.1, .46, 7.5], trail: [.5, .7], air: false }),
  ult: A('mu', 'Worldbreaker', 3.4, .95, [rest(0), K(.2, 0, 2.3, 0, -.3, 0, .2, -.3), K(.4, 0, 2.8, 0, -.5, 0, 0, -.4), K(.58, 0, 1.2, .9, 2.8, 0, 0, .5, 0, 1), K(.72, 0, .9, .9, 2.9, 0, 0, .5), K(1, .35, 1.1, .4, .9, .2, .4)],
    [h(.3, 0, 1, { act: 'flash', p: 3 }), h(.58, 80, 6.5, { shape: 'circle', fx: 'slam', launch: 6, stagger: 3, shake: 1.2, stop: .12, big: true }), h(.68, 60, 11.5, { shape: 'circle', act: 'quake', launch: 7, shake: 1, fx: 'none' }), h(.78, 60, 17.5, { shape: 'circle', fx: 'ult', act: 'quake', launch: 8, stagger: 3, shake: 1.5, big: true })],
    { invuln: true, cinematic: true, trail: [.45, .72] }),
  counter: A('mco', "Titan's Reply", .85, .7, V(-.8, 2.5, { w: .26, h0: 2.2, h1: .8 }), [h(.5, 48, 6.4, { shape: 'circle', fx: 'slam', launch: 4, stagger: 3, armor: 6, stop: .14, shake: .9, big: true })], { lunge: [.3, .5, 2], trail: [.36, .62] }),
  extra: ext('mx', 'Colossus Fall', V(-1, 2.7, { w: .42, h0: 2.3, h1: .7 }), [h(.66, 45, 6, { shape: 'circle', fx: 'slam', launch: 5, stagger: 2, shake: .9, stop: .1, big: true })], 1.25),
  guard: guardOf(GM), clash: clashOf(GM), pw: .135, nw: .34, lock: .28,
  deflectName: 'Colossus Guard', counterName: "Titan's Reply", awakenName: 'Golden Titan Aura',
  awakenDesc: 'A massive golden energy aura wraps you and the hammer. Impacts ring out as gigantic shockwaves.',
  skins: [{ name: 'Gilded Titan', color: 0xffc43d, color2: 0xfff1b8 }, { name: 'Jade Colossus', color: 0x3dff9a, color2: 0xd6ffe9 }, { name: 'Royal Amethyst', color: 0xc07dff, color2: 0xf1dcff }],
  moves: ['Light: 3-hit crush chain with Hammer Whirl', 'Heavy: Overhead Slam → charged Ground Smash', 'E Earthquake · R Titan Impact leap', 'Aerial Maul + Meteor Hammer', 'Counter: stagger-all Titan\'s Reply'],
};

export const WEAPONS: Record<WeaponId, WeaponDef> = { inferno, thunder, void: voidw, glacier, plasma, titan };
export const WEAPON_ORDER: WeaponId[] = ['inferno', 'thunder', 'void', 'glacier', 'plasma', 'titan'];
