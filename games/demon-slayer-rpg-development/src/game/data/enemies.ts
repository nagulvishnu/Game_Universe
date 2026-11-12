import type { DialogueLine, Look } from '../types';

export type AtkShape = 'cone' | 'circle' | 'line' | 'proj' | 'leap' | 'dash' | 'teleport' | 'summon';
export interface EAtk {
  id: string; name: string; shape: AtkShape; windup: number; recover: number; range: number; arc: number; dmg: number; kb: number;
  minR: number; maxR: number; cd: number; color: number; w: number; off: number; speed: number; count: number;
  status?: 'slow' | 'poison' | 'stun'; summon?: string; phase: number; maxPhase: number; ring?: boolean;
}
const A = (id: string, name: string, shape: AtkShape, o: Partial<EAtk>): EAtk => ({
  id, name, shape, windup: 0.6, recover: 0.7, range: 2.4, arc: 100, dmg: 1, kb: 3, minR: 0, maxR: 3, cd: 2, color: 0xff3040,
  w: 1.2, off: 0, speed: 12, count: 1, phase: 0, maxPhase: 9, ...o,
});

export const ATK: Record<string, EAtk> = {
  claw: A('claw', 'Claw Swipe', 'cone', { windup: 0.55, recover: 0.6, range: 2.4, arc: 110, maxR: 2.4, cd: 1.1 }),
  claw2: A('claw2', 'Rending Claws', 'cone', { windup: 0.45, recover: 0.5, range: 2.5, arc: 130, dmg: 0.9, maxR: 2.5, cd: 0.9 }),
  lunge: A('lunge', 'Lunge', 'dash', { windup: 0.5, recover: 0.8, range: 6, w: 1.6, dmg: 1.1, minR: 3, maxR: 8, cd: 3.5 }),
  smash: A('smash', 'Overhead Smash', 'circle', { windup: 0.9, recover: 1.0, range: 2.8, off: 2, dmg: 1.6, kb: 6, maxR: 4.2, cd: 3 }),
  sweep: A('sweep', 'Wide Sweep', 'cone', { windup: 0.75, recover: 0.8, range: 3.4, arc: 190, dmg: 1.2, kb: 5, maxR: 3.4, cd: 2.5 }),
  pounce: A('pounce', 'Pounce', 'leap', { windup: 0.55, recover: 0.9, range: 2, dmg: 1.3, kb: 4, minR: 3, maxR: 10, cd: 4 }),
  bolt: A('bolt', 'Blood Bolt', 'proj', { windup: 0.7, recover: 0.8, dmg: 1, minR: 4, maxR: 20, cd: 2.6, speed: 11 }),
  thread: A('thread', 'Binding Thread', 'line', { windup: 0.65, recover: 0.8, range: 11, w: 1.2, dmg: 0.9, minR: 3, maxR: 12, cd: 3.5, status: 'slow', color: 0xffffff }),
  drumnova: A('drumnova', 'Drum Shockwave', 'circle', { windup: 1.1, recover: 1.0, range: 6.2, off: 0, dmg: 1.4, kb: 8, maxR: 6, cd: 6, ring: true, color: 0xffb040 }),
  tendril: A('tendril', 'Flesh Tendril', 'line', { windup: 0.8, recover: 0.9, range: 9, w: 1.5, dmg: 1.2, minR: 2, maxR: 10, cd: 3.5, color: 0xff3a5a }),
  obiline: A('obiline', 'Obi Strike', 'line', { windup: 0.55, recover: 0.7, range: 12, w: 1.1, dmg: 1, minR: 3, maxR: 13, cd: 3, color: 0xff5a8a }),
  obivolley: A('obivolley', 'Obi Volley', 'proj', { windup: 0.7, recover: 0.8, count: 3, arc: 50, speed: 14, dmg: 0.8, minR: 4, maxR: 16, cd: 4, color: 0xff5a8a }),
  teleclaw: A('teleclaw', 'Vanishing Strike', 'teleport', { windup: 0.5, recover: 0.6, range: 2.6, arc: 120, dmg: 1.1, minR: 4, maxR: 14, cd: 5, color: 0x9a60ff }),
};

export interface EnemyDef {
  id: string; name: string; hp: number; dmg: number; def: number; spd: number; radius: number; scale: number;
  detect: number; look: Look; attacks: string[]; posture: number; xp: number;
  flags: { guard?: boolean; regen?: number; ambush?: boolean; keep?: number; dodge?: number; dummy?: boolean; static?: boolean; armor?: boolean; mini?: boolean };
}

const dl = (o: Partial<Look>): Look => ({ skin: 0x8a8f98, hair: 0x222228, hairStyle: 'wild', eye: 0xff2030, outfit: 0x4a4048, pants: 0x3a3238, scale: 1, extras: ['horns', 'claws'], demon: true, ...o });

export const ENEMIES: Record<string, EnemyDef> = {
  grunt: { id: 'grunt', name: 'Lesser Demon', hp: 55, dmg: 8, def: 0, spd: 3.3, radius: 0.5, scale: 1, detect: 17, look: dl({}), attacks: ['claw', 'claw2'], posture: 30, xp: 12, flags: {} },
  fast: { id: 'fast', name: 'Swift Demon', hp: 42, dmg: 7, def: 0, spd: 5.4, radius: 0.45, scale: 0.92, detect: 20, look: dl({ skin: 0x7a5a90, hair: 0x2a1840 }), attacks: ['claw2', 'lunge'], posture: 22, xp: 15, flags: { dodge: 0.3 } },
  guard: { id: 'guard', name: 'Armored Demon', hp: 95, dmg: 10, def: 8, spd: 2.5, radius: 0.6, scale: 1.12, detect: 15, look: dl({ skin: 0x6a7a70, outfit: 0x5a5a60, extras: ['horns', 'claws', 'armor'] }), attacks: ['smash', 'claw'], posture: 60, xp: 22, flags: { guard: true } },
  ambush: { id: 'ambush', name: 'Lurking Demon', hp: 50, dmg: 11, def: 0, spd: 4.2, radius: 0.5, scale: 0.95, detect: 8, look: dl({ skin: 0x5a4a60, hair: 0x101018 }), attacks: ['pounce', 'claw'], posture: 25, xp: 18, flags: { ambush: true } },
  brute: { id: 'brute', name: 'Night Brute', hp: 150, dmg: 13, def: 3, spd: 2.7, radius: 0.8, scale: 1.4, detect: 18, look: dl({ skin: 0x6a3a4a, outfit: 0x3a2a30, extras: ['horns', 'claws', 'tusks'] }), attacks: ['smash', 'sweep'], posture: 80, xp: 32, flags: {} },
  regen: { id: 'regen', name: 'Regenerating Demon', hp: 85, dmg: 9, def: 2, spd: 3.1, radius: 0.5, scale: 1.05, detect: 16, look: dl({ skin: 0xa86a6a, hair: 0x401010 }), attacks: ['claw', 'claw2'], posture: 35, xp: 24, flags: { regen: 0.07 } },
  caster: { id: 'caster', name: 'Blood Art Demon', hp: 48, dmg: 9, def: 0, spd: 3.2, radius: 0.45, scale: 0.98, detect: 22, look: dl({ skin: 0x8a60a0, eye: 0xff70ff, extras: ['horns', 'claws', 'eyes3'] }), attacks: ['bolt', 'claw'], posture: 20, xp: 20, flags: { keep: 9 } },
  spider: { id: 'spider', name: 'Spider Demon', hp: 125, dmg: 11, def: 3, spd: 3.6, radius: 0.6, scale: 1.15, detect: 20, look: dl({ skin: 0xe8e0e8, hair: 0xe8e0e8, eye: 0xff2a2a, extras: ['horns', 'claws', 'spiderlegs'] }), attacks: ['thread', 'claw', 'pounce'], posture: 55, xp: 38, flags: {} },
  drummer: { id: 'drummer', name: 'Drum Demon', hp: 135, dmg: 12, def: 4, spd: 3.0, radius: 0.6, scale: 1.2, detect: 18, look: dl({ skin: 0xc0b098, outfit: 0x8a3a2a, extras: ['horns', 'claws', 'drums'] }), attacks: ['drumnova', 'claw'], posture: 60, xp: 38, flags: {} },
  flesh: { id: 'flesh', name: 'Flesh-Fused Demon', hp: 120, dmg: 12, def: 2, spd: 3.1, radius: 0.6, scale: 1.2, detect: 18, look: dl({ skin: 0xb04a58, outfit: 0x602030, extras: ['horns', 'claws', 'tendrils'] }), attacks: ['tendril', 'claw'], posture: 50, xp: 36, flags: { regen: 0.03 } },
  obi: { id: 'obi', name: 'Obi Demon', hp: 130, dmg: 12, def: 3, spd: 3.5, radius: 0.55, scale: 1.1, detect: 20, look: dl({ skin: 0xf0d8e0, hair: 0xe0d0e8, outfit: 0xd03a6a, extras: ['horns', 'claws', 'obi'] }), attacks: ['obiline', 'claw', 'obivolley'], posture: 50, xp: 40, flags: {} },
  potfish: { id: 'potfish', name: 'Pot Demon', hp: 110, dmg: 12, def: 2, spd: 3.3, radius: 0.55, scale: 1.0, detect: 22, look: dl({ skin: 0x88b060, outfit: 0x4a6a40, extras: ['horns', 'claws', 'pot'] }), attacks: ['bolt', 'teleclaw'], posture: 45, xp: 40, flags: { keep: 7 } },
  clone: { id: 'clone', name: 'Emotion Clone', hp: 75, dmg: 11, def: 2, spd: 4.4, radius: 0.5, scale: 0.9, detect: 30, look: dl({ skin: 0xc0b0a0, hair: 0x887a6a, extras: ['horns', 'claws'] }), attacks: ['claw2', 'lunge', 'bolt'], posture: 35, xp: 20, flags: {} },
  dream: { id: 'dream', name: 'Dream Wraith', hp: 40, dmg: 9, def: 0, spd: 4, radius: 0.5, scale: 0.95, detect: 30, look: dl({ skin: 0x4a4a70, eye: 0x80a0ff, outfit: 0x20203a }), attacks: ['claw', 'bolt'], posture: 15, xp: 8, flags: {} },
  dummy: { id: 'dummy', name: 'Training Dummy', hp: 999999, dmg: 0, def: 0, spd: 0, radius: 0.6, scale: 1.05, detect: 0, look: dl({ skin: 0xc8a060, hair: 0xc8a060, hairStyle: 'none', eye: 0x222222, outfit: 0xb08a50, pants: 0x8a6a40, extras: ['dummy'], demon: false }), attacks: [], posture: 999, xp: 0, flags: { dummy: true, static: true } },
  boulder: { id: 'boulder', name: 'Training Boulder', hp: 240, dmg: 0, def: 12, spd: 0, radius: 1.3, scale: 1, detect: 0, look: dl({ extras: ['boulder'], demon: false }), attacks: [], posture: 999, xp: 50, flags: { static: true } },
};

export interface BossDef extends EnemyDef {
  title: string; phases: number[]; phaseNames?: string[]; haste: number; atks: EAtk[];
  intro: DialogueLine[]; outro: string; parryStun?: boolean; dawn?: boolean; color: number; level: number;
}
const boss = (id: string, name: string, title: string, hp: number, dmg: number, scale: number, look: Partial<Look>, o: Partial<BossDef> & { atks: EAtk[]; intro: DialogueLine[] }): BossDef => ({
  id, name, title, hp, dmg, def: 4, spd: 3.6, radius: 0.7 * scale, scale, detect: 60, look: dl({ scale: 1, ...look }), attacks: [], posture: 140, xp: hp / 3,
  flags: { armor: true }, phases: [0.66, 0.33], haste: 1.2, outro: `${name} has been defeated.`, color: 0xff2030, level: 5, ...o,
});

export const BOSSES: Record<string, BossDef> = {
  swamp: boss('swamp', 'Swamp Demon', 'Hunter of the Marsh', 420, 12, 1.5, { skin: 0x5a6a50, extras: ['horns', 'claws', 'tusks'] }, {
    color: 0x6a8a40, level: 3, phases: [0.5],
    atks: [ATK.smash, ATK.sweep, A('mudspit', 'Mud Barrage', 'proj', { count: 3, arc: 50, windup: 0.8, recover: 0.8, minR: 4, maxR: 16, cd: 4, color: 0x6a5a30, phase: 1 }), ATK.pounce],
    intro: [{ who: 'Swamp Demon', text: 'Hungry... so hungry. Fresh slayer meat.', cam: 'boss' }],
  }),
  hand: boss('hand', 'Hand Demon', 'The One Who Slew Many Selectees', 700, 14, 2.5, { skin: 0x9a9aa8, hair: 0x5a5a68, extras: ['horns', 'claws', 'hands'] }, {
    color: 0xa0a0b8, level: 3, parryStun: false,
    atks: [A('hslam', 'Crushing Fist', 'circle', { windup: 1.0, recover: 1.1, range: 3.4, off: 3, dmg: 1.5, kb: 7, maxR: 6, cd: 3 }),
      A('hsweep', 'Hand Sweep', 'cone', { windup: 0.9, recover: 0.9, range: 5.4, arc: 170, dmg: 1.3, kb: 6, maxR: 5.4, cd: 2.5 }),
      A('hgrab', 'Grasping Hands', 'line', { windup: 1.1, recover: 1.0, range: 12, w: 2.0, dmg: 1.2, minR: 3, maxR: 14, cd: 5, status: 'slow' }),
      A('hsummon', 'Call the Lesser', 'summon', { windup: 1.2, recover: 0.8, summon: 'grunt', count: 2, minR: 0, maxR: 20, cd: 12, phase: 1 }),
      A('hhands', 'Hail of Hands', 'proj', { windup: 1.0, recover: 1.0, count: 5, arc: 90, speed: 9, dmg: 0.9, minR: 5, maxR: 20, cd: 5, phase: 1 })],
    intro: [{ who: 'Hand Demon', text: 'Another little fox wandering into my mountain... I will add you to my collection.', cam: 'boss' }, { who: 'Tanjiro', text: 'Stay calm. Watch the hands. Breathe.', cam: 'player' }],
  }),
  kyogai: boss('kyogai', 'Kyogai', 'Lower Moon Six — The Drum Demon', 760, 14, 1.35, { skin: 0xc8c0b8, hair: 0x302a2a, outfit: 0xd8c8a8, extras: ['horns', 'claws', 'drums'] }, {
    color: 0xffb040, level: 5, haste: 1.15,
    atks: [A('kslash', 'Rending Claws', 'cone', { windup: 0.5, recover: 0.5, range: 3, arc: 120, dmg: 1.0, maxR: 3, cd: 1.2 }),
      A('kblades', 'Claw Blades', 'proj', { count: 3, arc: 40, windup: 0.6, recover: 0.7, speed: 15, dmg: 0.8, minR: 3, maxR: 18, cd: 3, color: 0xffd080 }),
      A('kdrum', 'Drum Shockwave', 'circle', { windup: 1.1, recover: 1.0, range: 7, off: 0, dmg: 1.4, kb: 8, maxR: 7, cd: 6, ring: true, color: 0xffb040 }),
      A('kspin', 'Rotating Rooms', 'proj', { count: 10, arc: 360, windup: 1.0, recover: 1.0, speed: 10, dmg: 0.8, minR: 0, maxR: 20, cd: 7, phase: 1, color: 0xffd080 })],
    intro: [{ who: 'Kyogai', text: 'Rotate, rotate! This mansion is my instrument, and you are the next note.', cam: 'boss' }],
  }),
  rui: boss('rui', 'Rui', 'Lower Moon Five — Spider Demon', 950, 16, 1.15, { skin: 0xf6f2f6, hair: 0xf6f2f6, hairStyle: 'spiky', outfit: 0xf0f0f6, pants: 0xf0f0f6, extras: ['claws', 'horns'] }, {
    color: 0xffffff, level: 7, parryStun: true, haste: 1.25,
    atks: [A('rthread', 'Blood Thread Slash', 'line', { windup: 0.6, recover: 0.8, range: 13, w: 1.4, dmg: 1.0, minR: 3, maxR: 14, cd: 2.4, status: 'slow', color: 0xffffff }),
      A('rcone', 'Sharp Threads', 'cone', { windup: 0.5, recover: 0.6, range: 4, arc: 140, dmg: 1.1, maxR: 4, cd: 1.6, color: 0xffffff }),
      A('rnet', 'Cage of Threads', 'proj', { count: 9, arc: 220, windup: 0.9, recover: 0.9, speed: 14, dmg: 0.8, minR: 0, maxR: 20, cd: 5, phase: 1, color: 0xffffff }),
      A('rsum', 'Spider Family', 'summon', { windup: 1.1, recover: 0.8, summon: 'spider', count: 2, minR: 0, maxR: 20, cd: 14, phase: 1 }),
      A('rcut', 'Slicing Web', 'circle', { windup: 1.0, recover: 1.0, range: 6.5, off: 0, dmg: 1.6, kb: 7, maxR: 6.5, cd: 6, phase: 2, ring: true, color: 0xff3a3a })],
    intro: [{ who: 'Rui', text: 'My family is bound by threads. You will not break what is mine.', cam: 'boss' }, { who: 'Tanjiro', text: 'His threads are razor sharp... time my guard exactly!', cam: 'player' }],
  }),
  enmu: boss('enmu', 'Enmu', 'Lower Moon One — Dream Demon', 1100, 16, 1.4, { skin: 0xd8c8c8, hair: 0x6a5a4a, outfit: 0x222230, extras: ['horns', 'claws', 'tendrils'] }, {
    color: 0xff4a6a, level: 9,
    atks: [A('etend', 'Train Flesh Whip', 'line', { windup: 0.7, recover: 0.8, range: 12, w: 1.6, dmg: 1.1, minR: 2, maxR: 13, cd: 2.5, color: 0xff3a5a }),
      A('edream', 'Lullaby Wraiths', 'summon', { windup: 1.0, recover: 0.8, summon: 'dream', count: 3, minR: 0, maxR: 20, cd: 9 }),
      A('elull', 'Sleep Mist', 'circle', { windup: 1.1, recover: 0.9, range: 5.5, off: 0, dmg: 1.2, kb: 3, maxR: 6, cd: 5, status: 'slow', ring: true, color: 0x8a60ff }),
      A('etele', 'Dream Step', 'teleport', { windup: 0.5, recover: 0.6, range: 3, arc: 130, dmg: 1.2, minR: 4, maxR: 16, cd: 4, color: 0x8a60ff }),
      A('eeyes', 'Eyes of the Dream', 'proj', { count: 7, arc: 180, windup: 0.9, recover: 0.9, speed: 12, dmg: 0.8, minR: 0, maxR: 20, cd: 6, phase: 1, color: 0xff4a6a })],
    intro: [{ who: 'Enmu', text: 'Sleep, little slayers. In dreams everyone is happy... and defenseless.', cam: 'boss' }],
  }),
  akaza: boss('akaza', 'Akaza', 'Upper Moon Three', 1500, 20, 1.2, { skin: 0xf4cccc, hair: 0xff9ac0, hairStyle: 'short', eye: 0xffe040, outfit: 0xf4cccc, pants: 0xe8e8f0, extras: ['claws', 'tattoo', 'bare'] }, {
    color: 0x6ad0ff, level: 12, haste: 1.5, posture: 220, def: 8, phases: [0.7, 0.4],
    atks: [A('afist', 'Fist Combo', 'cone', { windup: 0.3, recover: 0.4, range: 3, arc: 100, dmg: 0.9, kb: 4, maxR: 3, cd: 0.8, color: 0x6ad0ff }),
      A('adash', 'Rushing Strike', 'dash', { windup: 0.35, recover: 0.6, range: 9, w: 1.8, dmg: 1.3, minR: 3, maxR: 12, cd: 2.5, color: 0x6ad0ff }),
      A('acompass', 'Destructive Death: Compass Needle', 'circle', { windup: 0.9, recover: 0.9, range: 7, off: 0, dmg: 1.7, kb: 9, maxR: 7, cd: 5, ring: true, color: 0x6ad0ff, phase: 1 }),
      A('aair', 'Air Type: Flying Fists', 'proj', { count: 5, arc: 60, windup: 0.5, recover: 0.7, speed: 18, dmg: 0.8, minR: 3, maxR: 18, cd: 3, color: 0x6ad0ff, phase: 1 }),
      A('anova', 'Annihilation Type: Meteor Strike', 'leap', { windup: 0.8, recover: 1.0, range: 4.5, dmg: 1.9, kb: 10, minR: 0, maxR: 20, cd: 7, phase: 2, color: 0x6ad0ff })],
    intro: [{ who: 'Akaza', text: 'A strong opponent! Don\'t die yet. Fight me with everything you have.', cam: 'boss' }, { who: 'Tanjiro', text: 'He is fast... I have to read his footwork. Stay calm and dodge at the last moment.', cam: 'player' }],
  }),
  daki: boss('daki', 'Daki & Gyutaro', 'Upper Moon Six — The Siblings', 1600, 17, 1.2, { skin: 0xf6ece8, hair: 0xe8e0f0, hairStyle: 'long', outfit: 0xd02050, pants: 0xd02050, extras: ['claws', 'obi'] }, {
    color: 0xff5a8a, level: 13, phases: [0.5, 0.2], phaseNames: ['Daki', 'Gyutaro', 'Siblings United'],
    atks: [A('dobi', 'Obi Lash', 'line', { windup: 0.5, recover: 0.7, range: 14, w: 1.2, dmg: 1, minR: 3, maxR: 15, cd: 2, color: 0xff5a8a, maxPhase: 0 }),
      A('dring', 'Obi Cyclone', 'circle', { windup: 0.9, recover: 0.9, range: 6, off: 0, dmg: 1.3, kb: 6, maxR: 6.5, cd: 5, ring: true, color: 0xff5a8a, maxPhase: 0 }),
      A('dvol', 'Obi Volley', 'proj', { count: 5, arc: 80, windup: 0.7, recover: 0.8, speed: 15, dmg: 0.8, minR: 3, maxR: 18, cd: 3, color: 0xff5a8a, maxPhase: 0 }),
      A('gsick', 'Poison Sickle', 'cone', { windup: 0.5, recover: 0.5, range: 3.2, arc: 130, dmg: 1.1, maxR: 3.2, cd: 1.1, color: 0x60ff60, status: 'poison', phase: 1 }),
      A('gcres', 'Flying Blood Sickles', 'proj', { count: 5, arc: 140, windup: 0.7, recover: 0.7, speed: 16, dmg: 0.9, minR: 0, maxR: 18, cd: 3, color: 0xff2030, phase: 1 }),
      A('gring', 'Blood Sickle Whirl', 'circle', { windup: 0.9, recover: 0.9, range: 6.5, off: 0, dmg: 1.4, kb: 7, maxR: 7, cd: 5, ring: true, color: 0xff2030, status: 'poison', phase: 1 }),
      A('gobi', 'Siblings\' Crossfire', 'line', { windup: 0.6, recover: 0.7, range: 14, w: 1.6, dmg: 1.3, minR: 2, maxR: 15, cd: 2.2, color: 0xff2a6a, phase: 2 })],
    intro: [{ who: 'Daki', text: 'Ugly people shouldn\'t come near my district. Gyutaro, play with them.', cam: 'boss' }, { who: 'Tengen', text: 'Gyutaro... stay sharp, kid. Two necks to cut. Flashy!', cam: 'wide' }],
  }),
  gyokko: boss('gyokko', 'Gyokko', 'Upper Moon Five — The Artist', 1500, 18, 1.15, { skin: 0x88b060, hair: 0x2a4a2a, outfit: 0x4a6a40, extras: ['claws', 'pot'] }, {
    color: 0x9a60ff, level: 15, parryStun: true,
    atks: [A('gfish', 'Vase Fish', 'proj', { count: 4, arc: 70, windup: 0.7, recover: 0.7, speed: 12, dmg: 0.9, minR: 4, maxR: 20, cd: 3, color: 0xffa060 }),
      A('gtele', 'Pot Hop', 'teleport', { windup: 0.4, recover: 0.6, range: 3, arc: 140, dmg: 1.2, minR: 3, maxR: 16, cd: 3, color: 0x9a60ff }),
      A('gpool', 'Thousand Needle Fish', 'circle', { windup: 1.0, recover: 1.0, range: 6, off: 0, dmg: 1.4, kb: 6, maxR: 7, cd: 5, ring: true, color: 0xff80a0, phase: 1 }),
      A('gsum', 'Fish Servants', 'summon', { windup: 1.0, recover: 0.8, summon: 'potfish', count: 1, minR: 0, maxR: 20, cd: 15, phase: 1 }),
      A('gline', 'Water-Poison Beam', 'line', { windup: 0.8, recover: 0.9, range: 13, w: 1.8, dmg: 1.3, minR: 3, maxR: 14, cd: 3.5, color: 0xa0ff80, phase: 2, status: 'poison' })],
    intro: [{ who: 'Gyokko', text: 'Behold! My art! It is a masterpiece, and you will be its model.', cam: 'boss' }],
  }),
  hantengu: boss('hantengu', 'Hantengu', 'Upper Moon Four — Many Emotions', 1700, 17, 1.0, { skin: 0xc0b0a0, hair: 0x887a6a, extras: ['horns', 'claws'] }, {
    color: 0xffe14a, level: 16, phases: [0.7, 0.4], phaseNames: ['Sekido', 'Karaku', 'Aizetsu'],
    atks: [A('hclaw', 'Frantic Claws', 'cone', { windup: 0.4, recover: 0.5, range: 2.8, arc: 120, dmg: 1.0, maxR: 2.8, cd: 1.0 }),
      A('hclones', 'Emotion Split', 'summon', { windup: 1.0, recover: 0.8, summon: 'clone', count: 2, minR: 0, maxR: 30, cd: 11 }),
      A('hbolt', 'Lightning Spear Throw', 'proj', { count: 3, arc: 60, windup: 0.6, recover: 0.7, speed: 18, dmg: 1.0, minR: 4, maxR: 20, cd: 3, color: 0xffe14a }),
      A('hnova', 'Wail of Despair', 'circle', { windup: 1.0, recover: 1.0, range: 7, off: 0, dmg: 1.5, kb: 8, maxR: 7, cd: 6, ring: true, color: 0xffe14a, phase: 1 }),
      A('hline', 'Wind Fan Gust', 'line', { windup: 0.6, recover: 0.8, range: 14, w: 2, dmg: 1.2, minR: 3, maxR: 15, cd: 3.5, color: 0x80ffd0, phase: 2 })],
    intro: [{ who: 'Hantengu', text: 'Waaah! I am not afraid, I am furious... I am sorrowful... I am joyful!', cam: 'boss' }],
  }),
  doma: boss('doma', 'Doma', 'Upper Moon Two — The Cult Leader', 1900, 19, 1.2, { skin: 0xf0e4d8, hair: 0xe8d8a0, hairStyle: 'short', eye: 0x80e0ff, outfit: 0xe0eef6, pants: 0xe0eef6, extras: ['claws', 'fan'] }, {
    color: 0x9ae0ff, level: 18, phases: [0.66, 0.33],
    atks: [A('dfrost', 'Frost Breath', 'cone', { windup: 0.7, recover: 0.9, range: 8, arc: 70, dmg: 1.3, kb: 4, maxR: 8, cd: 3.5, status: 'slow', color: 0x9ae0ff }),
      A('dlotus', 'Lotus Vines', 'proj', { count: 8, arc: 360, windup: 0.9, recover: 0.9, speed: 12, dmg: 0.8, minR: 0, maxR: 20, cd: 5, color: 0xbff0ff }),
      A('dfan', 'Fan Slash', 'cone', { windup: 0.4, recover: 0.5, range: 3.4, arc: 140, dmg: 1.0, maxR: 3.4, cd: 1.1, color: 0xe0f8ff }),
      A('dfield', 'Freezing Field', 'circle', { windup: 1.1, recover: 1.0, range: 7.5, off: 0, dmg: 1.5, kb: 6, maxR: 7.5, cd: 6, ring: true, status: 'slow', color: 0x9ae0ff, phase: 1 }),
      A('dkrys', 'Crystalline Sculpture', 'summon', { windup: 1.0, recover: 0.8, summon: 'dream', count: 2, minR: 0, maxR: 20, cd: 12, phase: 1 }),
      A('dbeam', 'Absolute Zero Lance', 'line', { windup: 0.7, recover: 0.8, range: 15, w: 2.2, dmg: 1.7, minR: 3, maxR: 16, cd: 3.5, color: 0xffffff, phase: 2 })],
    intro: [{ who: 'Doma', text: 'Oh, what a sad little group! Let me help you find peace... permanently.', cam: 'boss' }],
  }),
  kokushibo: boss('kokushibo', 'Kokushibo', 'Upper Moon One', 2300, 24, 1.35, { skin: 0xe8d8d0, hair: 0x22222a, hairStyle: 'pony', eye: 0xff2030, outfit: 0x3a2a4a, pants: 0x2a2038, extras: ['claws', 'sixeyes'] }, {
    color: 0xb060ff, level: 20, haste: 1.4, phases: [0.7, 0.4, 0.15], posture: 260, def: 10,
    atks: [A('kmoon', 'Moon Breathing: Crescent Barrage', 'proj', { count: 5, arc: 80, windup: 0.5, recover: 0.7, speed: 20, dmg: 1.0, minR: 3, maxR: 22, cd: 2.6, color: 0xb060ff }),
      A('kcut', 'Sixfold Reach Slash', 'cone', { windup: 0.4, recover: 0.5, range: 5.6, arc: 150, dmg: 1.2, kb: 5, maxR: 5.6, cd: 1.1, color: 0xb060ff }),
      A('kdash', 'Phantom Rush', 'dash', { windup: 0.35, recover: 0.6, range: 11, w: 2, dmg: 1.4, minR: 4, maxR: 14, cd: 3, color: 0xb060ff }),
      A('knova', 'Lunar Cycle', 'circle', { windup: 0.9, recover: 0.9, range: 8, off: 0, dmg: 1.7, kb: 9, maxR: 8, cd: 5, ring: true, color: 0xb060ff, phase: 1 }),
      A('kring', 'Thousand Crescents', 'proj', { count: 14, arc: 360, windup: 1.0, recover: 1.0, speed: 14, dmg: 0.9, minR: 0, maxR: 22, cd: 7, color: 0xb060ff, phase: 2 }),
      A('kvanish', 'Moonlit Teleport Slash', 'teleport', { windup: 0.35, recover: 0.5, range: 4.4, arc: 160, dmg: 1.6, minR: 4, maxR: 16, cd: 4, color: 0xb060ff, phase: 2 })],
    intro: [{ who: 'Kokushibo', text: 'You carry a sun in your hand and fire in your heart... Show me how far you can reach.', cam: 'boss' }],
  }),
  muzan: boss('muzan', 'Muzan Kibutsuji', 'The Demon King', 3200, 26, 1.35, { skin: 0xf0e8e8, hair: 0x14141c, hairStyle: 'short', eye: 0xff2a3a, outfit: 0xe8e8ec, pants: 0x22222a, extras: ['claws', 'tendrils'] }, {
    color: 0xff1a3a, level: 24, haste: 1.3, phases: [0.75, 0.5, 0.25], phaseNames: ['Muzan', 'Muzan — Ascended', 'Muzan — Monstrous', 'Muzan — Before the Dawn'], posture: 320, def: 12, dawn: true,
    atks: [A('mtend', 'Whip Tendrils', 'line', { windup: 0.55, recover: 0.7, range: 14, w: 1.5, dmg: 1.1, minR: 2, maxR: 15, cd: 2.0, color: 0xff1a3a }),
      A('mcone', 'Rending Claws', 'cone', { windup: 0.4, recover: 0.5, range: 4, arc: 150, dmg: 1.2, kb: 5, maxR: 4, cd: 1.0, color: 0xff1a3a }),
      A('mnova', 'Blood Eruption', 'circle', { windup: 1.0, recover: 1.0, range: 8, off: 0, dmg: 1.7, kb: 9, maxR: 8, cd: 5, ring: true, color: 0xff1a3a, phase: 1 }),
      A('mvol', 'Shard Storm', 'proj', { count: 9, arc: 220, windup: 0.8, recover: 0.8, speed: 17, dmg: 0.9, minR: 0, maxR: 22, cd: 4, color: 0xff1a3a, phase: 1 }),
      A('msum', 'Children of Muzan', 'summon', { windup: 1.0, recover: 0.8, summon: 'brute', count: 2, minR: 0, maxR: 30, cd: 15, phase: 2 }),
      A('mtele', 'Spatial Step', 'teleport', { windup: 0.35, recover: 0.5, range: 4.4, arc: 160, dmg: 1.6, minR: 4, maxR: 16, cd: 4, color: 0xff1a3a, phase: 2 }),
      A('mbeam', 'Annihilating Tendril Barrage', 'line', { windup: 0.8, recover: 0.8, range: 16, w: 3, dmg: 2.0, minR: 3, maxR: 18, cd: 4, color: 0xff1a3a, phase: 3 })],
    intro: [{ who: 'Muzan', text: 'Ah, the descendants of those who defied me, gathered at last. I will end this long annoyance.', cam: 'boss' }, { who: 'Tanjiro', text: 'This is it. Everyone\'s feelings are with me. I will cut through the night!', cam: 'player' }],
  }),
  spidermother: boss('spidermother', 'Spider Mother', 'Hidden Lair Matriarch', 800, 15, 1.5, { skin: 0xd8d0d8, hair: 0x2a2030, extras: ['claws', 'horns', 'spiderlegs'] }, {
    color: 0xc0ffc0, level: 8, phases: [0.5],
    atks: [ATK.thread, ATK.claw, A('smom', 'Brood Call', 'summon', { windup: 1.0, recover: 0.8, summon: 'spider', count: 2, minR: 0, maxR: 20, cd: 12, phase: 1 }), A('sweb', 'Web Burst', 'circle', { windup: 1.0, recover: 1, range: 6, off: 0, dmg: 1.3, kb: 6, maxR: 6, cd: 5, ring: true, status: 'slow', color: 0xffffff })],
    intro: [{ who: 'Spider Mother', text: 'My children are hungry. Come closer, sweet one.', cam: 'boss' }],
  }),
};
Object.values(BOSSES).forEach((b) => { b.flags = { armor: true }; });
