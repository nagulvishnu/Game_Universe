/**
 * SHADOWSTRIKE — Supernatural skill catalogue.
 *
 * Every skill resolves to a real execution kind handled by the SkillExecutor
 * (see src/game/skills/SkillExecutor.ts). Every skill has exactly five
 * upgrade levels; levels 3/4/5 add functional perks that the executor reads.
 */

import type { Rarity } from './weapons';

export type SkillCategory =
  | 'fire' | 'lightning' | 'ice' | 'shadow' | 'energy' | 'gravity'
  | 'wind' | 'earth' | 'defense' | 'mobility' | 'summon' | 'ultimate';

/** Execution kinds — each has a concrete handler in the skill executor. */
export type SkillKind =
  | 'projectile'  // straight travelling 2D projectile
  | 'homing'      // bounded-tracking projectile
  | 'beam'        // sustained, beam-aligned hit detection
  | 'aoe'         // instant burst centred on the caster
  | 'zone'        // lingering damaging field
  | 'wave'        // ground-hugging travelling wave
  | 'rain'        // multiple projectiles falling from above
  | 'melee'       // special melee strike with an authored hitbox
  | 'dash'        // mobility / teleport with optional contact damage
  | 'clone'       // shadow clone summon
  | 'summon'      // autonomous summoned attacker
  | 'buff'        // timed self buff
  | 'counter'     // parry / counter stance
  | 'pull'        // gravity pull or push
  | 'trap';       // placed delayed hazard

export type SkillPerk =
  | 'pierce' | 'multishot' | 'burn' | 'freeze' | 'shock' | 'slow' | 'stun'
  | 'knockdown' | 'lifesteal' | 'shield' | 'haste' | 'guardbreak' | 'extend'
  | 'seek' | 'split' | 'vortex' | 'refund' | 'armor' | 'chain' | 'bigger'
  | 'echo' | 'invuln';

export interface SkillLevel {
  level: number;
  title: string;
  description: string;
  damage: number;
  cooldown: number;
  range: number;
  duration: number;
  perks: SkillPerk[];
  cost: number;
}

export interface SkillDef {
  id: string;
  name: string;
  category: SkillCategory;
  kind: SkillKind;
  rarity: Rarity;
  description: string;
  counterplay: string;
  color: number;
  speed: number;
  /** Fully-resolved 5 upgrade levels. */
  levels: SkillLevel[];
  unlock: { level: number; cost: number };
}

const PERK_TEXT: Record<SkillPerk, string> = {
  pierce: 'passes through the first target it hits',
  multishot: 'fires an additional projectile per cast',
  burn: 'applies a burning damage-over-time',
  freeze: 'chills the target, slowing their movement',
  shock: 'staggers the target with an electric jolt',
  slow: 'reduces the target movement speed',
  stun: 'briefly stuns an unguarded target',
  knockdown: 'knocks the target off their feet',
  lifesteal: 'returns a share of the damage as health',
  shield: 'grants the caster a damage-absorbing barrier',
  haste: 'grants the caster a short burst of movement speed',
  guardbreak: 'shreds guard and can break a block outright',
  extend: 'increases active duration and reach',
  seek: 'improves tracking and target acquisition',
  split: 'splits into fragments on impact',
  vortex: 'drags nearby fighters toward the impact point',
  refund: 'refunds part of the cooldown on a clean hit',
  armor: 'gives the caster hit-armour during the startup',
  chain: 'arcs to strike again after the first hit',
  bigger: 'significantly enlarges the effect area',
  echo: 'repeats a weakened copy of the effect',
  invuln: 'grants brief invulnerability frames',
};

const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

type Spec = [
  id: string,
  name: string,
  kind: SkillKind,
  dmg: number,
  cd: number,
  range: number,
  dur: number,
  speed: number,
  color: number,
  perks: [SkillPerk, SkillPerk, SkillPerk],
  rarity: Rarity,
  desc: string,
  counter: string,
];

const LEVEL_TITLES = ['Core', 'Enhancement', 'Tactical Variation', 'Mastery', 'Signature'];

function buildLevels(s: Spec): SkillLevel[] {
  const [id, name, , dmg, cd, range, dur, , , perks, rarity] = s;
  void id;
  const rIdx = RARITY_ORDER.indexOf(rarity);
  const dmgMul = [1, 1.16, 1.32, 1.55, 1.85];
  const cdMul = [1, 0.94, 0.88, 0.82, 0.72];
  const rangeMul = [1, 1.05, 1.14, 1.2, 1.32];
  const durMul = [1, 1.08, 1.18, 1.32, 1.5];
  const perkSets: SkillPerk[][] = [[], [], [perks[0]], [perks[0], perks[1]], [perks[0], perks[1], perks[2]]];
  const descs = [
    `Base form of ${name}.`,
    `Refined ${name}: +16% damage and a shorter cooldown.`,
    `${name} now ${PERK_TEXT[perks[0]]}.`,
    `${name} additionally ${PERK_TEXT[perks[1]]}, with extended duration.`,
    `Signature ${name}: ${PERK_TEXT[perks[2]]}, with maximum damage, range and uptime.`,
  ];
  return [0, 1, 2, 3, 4].map((i) => ({
    level: i + 1,
    title: LEVEL_TITLES[i],
    description: descs[i],
    damage: Math.round(dmg * dmgMul[i] * 10) / 10,
    cooldown: Math.round(cd * cdMul[i]),
    range: Math.round(range * rangeMul[i]),
    duration: Math.round(dur * durMul[i]),
    perks: perkSets[i],
    cost: i === 0 ? 0 : Math.round((180 + rIdx * 120) * Math.pow(1.85, i - 1)),
  }));
}

function build(cat: SkillCategory, specs: Spec[], baseLevel: number): SkillDef[] {
  return specs.map((s, i) => {
    const rIdx = RARITY_ORDER.indexOf(s[10]);
    return {
      id: s[0],
      name: s[1],
      category: cat,
      kind: s[2],
      rarity: s[10],
      description: s[11],
      counterplay: s[12],
      color: s[8],
      speed: s[7],
      levels: buildLevels(s),
      unlock: {
        level: Math.max(1, baseLevel + rIdx * 2 + Math.floor(i / 3)),
        cost: rIdx === 0 && i === 0 ? 0 : 300 + rIdx * 450 + i * 90,
      },
    };
  });
}

/* ------------------------------------------------------------------ FIRE */
const FIRE: Spec[] = [
  ['fire_bolt', 'Ember Bolt', 'projectile', 10, 2600, 520, 0, 620, 0xff7a2a, ['pierce', 'burn', 'split'], 'common', 'A compact bolt of shadowfire hurled forward.', 'Jump or block — it travels in a straight line.', ],
  ['fire_homing', 'Homing Fireball', 'homing', 14, 5200, 700, 2600, 400, 0xff5a1a, ['seek', 'burn', 'multishot'], 'common', 'The signature pursuing fireball. Tracks for a limited window then flies straight.', 'Dash through it or break line of sight while it is tracking.'],
  ['fire_nova', 'Inferno Nova', 'aoe', 22, 8000, 160, 320, 0, 0xff8a3a, ['bigger', 'burn', 'knockdown'], 'uncommon', 'A ring of flame erupts around the caster.', 'Stay outside the ring — its radius is fixed and telegraphed.'],
  ['fire_wall', 'Pyre Wall', 'zone', 7, 9000, 240, 3400, 0, 0xff4a2a, ['extend', 'burn', 'bigger'], 'uncommon', 'Raises a burning wall that damages anyone who stands in it.', 'Walk around it or wait it out.'],
  ['fire_rain', 'Meteor Shower', 'rain', 12, 11000, 520, 2200, 520, 0xff6a2a, ['multishot', 'burn', 'bigger'], 'rare', 'Calls down a volley of burning meteors across the arena.', 'Move constantly; impacts are telegraphed by falling embers.'],
  ['fire_dash', 'Blazing Rush', 'dash', 16, 6500, 300, 260, 1150, 0xffae40, ['invuln', 'burn', 'refund'], 'rare', 'Dash forward wreathed in flame, scorching anything touched.', 'Block it — the dash has no guard-break by default.'],
  ['fire_beam', 'Solar Lance Beam', 'beam', 5, 10000, 620, 900, 0, 0xffb24a, ['extend', 'burn', 'guardbreak'], 'epic', 'A sustained lance of fire that ticks rapidly.', 'Duck under, dash through, or punish the long startup.'],
  ['fire_trap', 'Cinder Mine', 'trap', 20, 7500, 220, 6000, 0, 0xff7040, ['bigger', 'burn', 'echo'], 'epic', 'Places a delayed cinder charge that detonates on contact.', 'Visible on the ground; simply avoid it.'],
  ['fire_buff', 'Flame Mantle', 'buff', 0, 14000, 0, 6000, 0, 0xff9050, ['armor', 'burn', 'haste'], 'legendary', 'Cloaks the fighter in fire, empowering every strike.', 'Play defensively until the mantle expires.'],
  ['fire_wave', 'Scorch Wave', 'wave', 14, 7000, 620, 1400, 560, 0xff6020, ['pierce', 'burn', 'bigger'], 'rare', 'A wave of fire races along the ground.', 'Jump over it.'],
  ['fire_melee', 'Searing Uppercut', 'melee', 24, 6000, 90, 0, 0, 0xffa030, ['knockdown', 'burn', 'guardbreak'], 'uncommon', 'A rising fist of flame that launches the opponent.', 'Short range — stay out of it or block low.'],
];

/* ------------------------------------------------------------- LIGHTNING */
const LIGHTNING: Spec[] = [
  ['volt_bolt', 'Volt Dart', 'projectile', 9, 2200, 560, 0, 980, 0xffe066, ['pierce', 'shock', 'chain'], 'common', 'A fast, flat bolt of lightning.', 'Very fast — block on reaction or stay mobile.'],
  ['thunder_strike', 'Thunder Strike', 'rain', 18, 7000, 420, 600, 1400, 0xfff2a0, ['multishot', 'shock', 'stun'], 'uncommon', 'Calls a bolt down onto the opponent position.', 'Move after the flash telegraph appears.'],
  ['chain_lightning', 'Chain Lightning', 'projectile', 11, 6000, 600, 0, 760, 0xfff0c0, ['chain', 'shock', 'multishot'], 'rare', 'Arcing bolt that leaps between targets and clones.', 'Stay far from your own summons.'],
  ['storm_aura', 'Storm Aura', 'buff', 0, 13000, 0, 7000, 0, 0xffe880, ['haste', 'shock', 'armor'], 'rare', 'Crackling field that speeds the caster and shocks attackers.', 'Disengage and wait out the aura.'],
  ['lightning_dash', 'Flashstep Bolt', 'dash', 14, 5200, 340, 200, 1500, 0xfff5b0, ['invuln', 'shock', 'refund'], 'uncommon', 'Instant electric blink with a contact shock.', 'Bait it, then punish the brief recovery.'],
  ['thunder_nova', 'Voltaic Nova', 'aoe', 20, 8500, 180, 280, 0, 0xffee90, ['bigger', 'stun', 'shock'], 'epic', 'Discharges stored voltage in every direction.', 'Keep your distance when their aura is charged.'],
  ['ball_lightning', 'Ball Lightning', 'homing', 13, 6800, 620, 3200, 280, 0xfff7c0, ['seek', 'shock', 'split'], 'epic', 'A slow, relentless orb that hunts the opponent.', 'Outpace it — it expires quickly.'],
  ['lightning_beam', 'Tesla Beam', 'beam', 4.5, 10500, 600, 1000, 0, 0xfff9d0, ['extend', 'shock', 'guardbreak'], 'legendary', 'Continuous arc discharge with rapid damage ticks.', 'Dash through the beam during its sweep.'],
  ['static_zone', 'Static Field', 'zone', 6, 9500, 260, 4200, 0, 0xfff0a0, ['slow', 'shock', 'bigger'], 'rare', 'A field of static that slows and chips anyone inside.', 'Fight outside the field.'],
  ['thunder_clap', 'Thunder Clap', 'melee', 22, 5800, 100, 0, 0, 0xffe070, ['knockdown', 'shock', 'guardbreak'], 'uncommon', 'A deafening close-range clap that staggers.', 'Keep mid-range spacing.'],
  ['raijin_wave', 'Raijin Wave', 'wave', 15, 7200, 640, 1300, 760, 0xffeeb0, ['pierce', 'shock', 'bigger'], 'epic', 'A galloping wave of thunder along the floor.', 'Jump it or block.'],
];

/* ------------------------------------------------------------------- ICE */
const ICE: Spec[] = [
  ['ice_shard', 'Frost Shard', 'projectile', 9, 2400, 540, 0, 700, 0x9fe8ff, ['pierce', 'freeze', 'multishot'], 'common', 'A honed sliver of ice.', 'Block it — chip damage only.'],
  ['ice_spikes', 'Glacier Spikes', 'zone', 8, 7500, 280, 3000, 0, 0xbdf0ff, ['bigger', 'freeze', 'knockdown'], 'uncommon', 'Spikes erupt from the ground in a short line.', 'Jump over the spike line.'],
  ['frost_nova', 'Frost Nova', 'aoe', 16, 8200, 180, 300, 0, 0xd0f6ff, ['bigger', 'freeze', 'slow'], 'uncommon', 'An expanding ring of freezing air.', 'Stay out of melee range.'],
  ['ice_wall', 'Rime Barrier', 'zone', 4, 9000, 200, 4500, 0, 0xa8e6ff, ['extend', 'shield', 'bigger'], 'rare', 'Raises a wall of ice that blocks and chills.', 'Break through it or go around.'],
  ['ice_beam', 'Absolute Zero Beam', 'beam', 4, 11000, 580, 950, 0, 0xcdf3ff, ['freeze', 'extend', 'slow'], 'epic', 'A beam of absolute cold that steadily freezes.', 'Dash through quickly.'],
  ['ice_homing', 'Hunting Frostball', 'homing', 12, 5600, 660, 2600, 360, 0xb6ecff, ['seek', 'freeze', 'split'], 'rare', 'A tracking sphere of frost.', 'Dodge late — it loses tracking.'],
  ['ice_armor', 'Permafrost Armour', 'buff', 0, 14000, 0, 7000, 0, 0xcfefff, ['shield', 'armor', 'freeze'], 'rare', 'Encases the fighter in protective rime.', 'Apply pressure to shatter the armour.'],
  ['ice_dash', 'Glide Step', 'dash', 10, 5000, 320, 220, 1250, 0xd8f6ff, ['invuln', 'freeze', 'refund'], 'uncommon', 'Skates across the ice, chilling on contact.', 'Punish the slide recovery.'],
  ['ice_rain', 'Hailstorm', 'rain', 10, 10500, 500, 2400, 560, 0xc0eeff, ['multishot', 'slow', 'freeze'], 'epic', 'A barrage of hail falls over the arena.', 'Keep moving under cover.'],
  ['ice_trap', 'Frozen Snare', 'trap', 14, 8000, 200, 6500, 0, 0xa0e4ff, ['freeze', 'bigger', 'stun'], 'rare', 'A trap that freezes anyone who steps on it.', 'Visible glint on the ground — step around it.'],
  ['ice_melee', 'Shatter Palm', 'melee', 23, 6200, 95, 0, 0, 0xe0f8ff, ['freeze', 'knockdown', 'guardbreak'], 'legendary', 'A palm strike that detonates frozen targets.', 'Do not get frozen first.'],
];

/* ---------------------------------------------------------------- SHADOW */
const SHADOW: Spec[] = [
  ['shadow_clone', 'Shadow Clones', 'clone', 8, 9000, 400, 5000, 0, 0x8a4aff, ['multishot', 'extend', 'echo'], 'common', 'Summons shadow duplicates that attack independently.', 'Kill the window — clones expire quickly.'],
  ['shadow_bolt', 'Umbral Bolt', 'projectile', 10, 2500, 540, 0, 640, 0x7a3aff, ['pierce', 'lifesteal', 'split'], 'common', 'A dart of condensed darkness.', 'Simple projectile — block or jump.'],
  ['shadow_step', 'Shadow Step', 'dash', 0, 4200, 360, 180, 1800, 0x6a2aff, ['invuln', 'haste', 'refund'], 'common', 'Blink through the shadows past your opponent.', 'Bait it out and punish the arrival.'],
  ['shadow_grasp', 'Umbral Grasp', 'pull', 12, 7000, 420, 400, 0, 0x5a2aaf, ['vortex', 'slow', 'stun'], 'uncommon', 'Shadow hands drag the opponent toward you.', 'Block to resist, or keep distance.'],
  ['shadow_zone', 'Darkness Field', 'zone', 6, 9500, 260, 4800, 0, 0x4a2080, ['slow', 'lifesteal', 'bigger'], 'uncommon', 'A pool of living darkness that drains the unwary.', 'Fight outside it.'],
  ['shadow_clone_rush', 'Clone Rush', 'clone', 12, 12000, 420, 4200, 0, 0x9a5aff, ['multishot', 'echo', 'extend'], 'rare', 'Three aggressive clones charge the opponent in sequence.', 'Use area attacks to clear them.'],
  ['shadow_beam', 'Void Ray', 'beam', 5, 10500, 600, 950, 0, 0x8a2bff, ['extend', 'lifesteal', 'guardbreak'], 'epic', 'A ray of annihilating darkness.', 'Dash through during the sweep.'],
  ['shadow_nova', 'Eclipse Burst', 'aoe', 20, 8500, 180, 320, 0, 0x6a30c0, ['bigger', 'knockdown', 'lifesteal'], 'rare', 'Darkness detonates around the caster.', 'Stay at range.'],
  ['shadow_mirror', 'Mirror Shade', 'counter', 18, 9000, 120, 900, 0, 0x9a6aff, ['armor', 'echo', 'invuln'], 'epic', 'A shade mirrors and returns the next incoming strike.', 'Feint, then strike after the stance ends.'],
  ['shadow_buff', 'Shroud of Night', 'buff', 0, 13500, 0, 6500, 0, 0x5a2a9a, ['haste', 'armor', 'lifesteal'], 'rare', 'Wraps the fighter in shadow, boosting power and evasion.', 'Pressure them through the buff.'],
  ['shadow_swarm', 'Shade Swarm', 'rain', 9, 10000, 480, 2400, 500, 0x7a40c0, ['multishot', 'lifesteal', 'bigger'], 'epic', 'A flock of shades dives at the opponent.', 'Move laterally to shake the dives.'],
  ['shadow_clone_bomb', 'Clone Detonation', 'clone', 22, 13500, 400, 2600, 0, 0xb060ff, ['bigger', 'knockdown', 'echo'], 'legendary', 'Clones sprint in and detonate on contact.', 'Destroy clones early or keep away.'],
  ['shadow_assassin', 'Assassin Shade', 'summon', 10, 14000, 500, 8000, 0, 0x8040c0, ['extend', 'lifesteal', 'echo'], 'legendary', 'Summons a shade assassin that hunts the opponent.', 'Kill the shade or outlast it.'],
  ['shadow_execute', 'Umbral Execution', 'melee', 30, 11000, 110, 0, 0, 0xc080ff, ['guardbreak', 'lifesteal', 'knockdown'], 'mythic', 'A single, devastating shadow cut at close range.', 'Huge startup — dodge or interrupt it.'],
];

/* ---------------------------------------------------------------- ENERGY */
const ENERGY: Spec[] = [
  ['laser_beam', 'Laser Beam', 'beam', 5, 9000, 620, 900, 0, 0x66e0ff, ['extend', 'pierce', 'guardbreak'], 'common', 'The signature focused beam weapon. Ticks damage along its length.', 'Jump over it, dash through, or punish the startup.'],
  ['energy_bolt', 'Pulse Bolt', 'projectile', 10, 2300, 560, 0, 820, 0x7fd4ff, ['pierce', 'split', 'multishot'], 'common', 'A clean bolt of raw energy.', 'Block it.'],
  ['energy_burst', 'Kinetic Burst', 'aoe', 18, 7500, 170, 280, 0, 0x9fe8ff, ['bigger', 'knockdown', 'guardbreak'], 'uncommon', 'Compressed energy detonates around the fighter.', 'Stay out of the burst radius.'],
  ['energy_homing', 'Seeker Orb', 'homing', 12, 5400, 680, 2800, 420, 0x66d0ff, ['seek', 'split', 'multishot'], 'uncommon', 'A guided orb of plasma.', 'Dash late to break its tracking.'],
  ['energy_wave', 'Photon Wave', 'wave', 14, 6800, 640, 1300, 700, 0x8fe0ff, ['pierce', 'bigger', 'knockdown'], 'rare', 'A crescent of light sweeps along the ground.', 'Jump over it.'],
  ['energy_shield', 'Hardlight Shield', 'buff', 0, 12000, 0, 6000, 0, 0xaef0ff, ['shield', 'armor', 'refund'], 'rare', 'Projects an absorbing hardlight barrier.', 'Break the barrier with heavy attacks.'],
  ['energy_cannon', 'Nova Cannon', 'projectile', 26, 9500, 620, 0, 520, 0x60ffff, ['pierce', 'bigger', 'knockdown'], 'epic', 'A heavy slow-moving cannon shot.', 'Easy to see — dash through or jump.'],
  ['energy_beam_sweep', 'Sweeping Lance', 'beam', 6, 12000, 640, 1200, 0, 0x90f0ff, ['extend', 'guardbreak', 'bigger'], 'epic', 'A beam that sweeps a wide arc.', 'Get behind them.'],
  ['energy_zone', 'Plasma Field', 'zone', 7, 9000, 260, 4200, 0, 0x7fe8ff, ['bigger', 'slow', 'shock'], 'rare', 'A humming field of plasma.', 'Avoid the field.'],
  ['energy_rain', 'Orbital Volley', 'rain', 12, 11500, 520, 2400, 600, 0x80e8ff, ['multishot', 'bigger', 'knockdown'], 'legendary', 'Energy lances rain from above.', 'Keep moving.'],
  ['energy_melee', 'Photon Palm', 'melee', 24, 6200, 100, 0, 0, 0xc0f8ff, ['guardbreak', 'knockdown', 'pierce'], 'uncommon', 'A palm strike that discharges stored light.', 'Space it out.'],
  ['energy_counter', 'Refraction Guard', 'counter', 16, 8500, 120, 850, 0, 0xa0f0ff, ['shield', 'echo', 'invuln'], 'epic', 'Refracts an incoming attack back at the attacker.', 'Wait out the stance.'],
];

/* --------------------------------------------------------------- GRAVITY */
const GRAVITY: Spec[] = [
  ['grav_pull', 'Singularity Pull', 'pull', 10, 7000, 460, 420, 0, 0xa06aff, ['vortex', 'slow', 'stun'], 'common', 'Yanks the opponent toward the caster.', 'Block to resist the pull.'],
  ['grav_push', 'Repulsor Field', 'pull', 12, 6500, 420, 320, 0, 0x9a7aff, ['knockdown', 'bigger', 'guardbreak'], 'common', 'A shove of raw gravity that pushes everyone away.', 'Stay grounded at range.'],
  ['grav_well', 'Gravity Well', 'zone', 7, 10000, 280, 4200, 0, 0x8a5aff, ['vortex', 'slow', 'bigger'], 'uncommon', 'A collapsing well that drags fighters inward.', 'Do not approach the well.'],
  ['grav_crush', 'Crushing Weight', 'aoe', 20, 8800, 200, 400, 0, 0x7a4aff, ['knockdown', 'bigger', 'guardbreak'], 'uncommon', 'Multiplies gravity in a radius, slamming foes down.', 'Jump before it lands.'],
  ['grav_bolt', 'Mass Bolt', 'projectile', 13, 3200, 540, 0, 540, 0x9060ff, ['pierce', 'slow', 'split'], 'rare', 'A dense slug of compressed mass.', 'Block it.'],
  ['grav_anchor', 'Anchor Field', 'trap', 16, 8500, 220, 6000, 0, 0x8050e0, ['stun', 'slow', 'bigger'], 'rare', 'Places an anchor that roots whoever triggers it.', 'Avoid the marked ground.'],
  ['grav_float', 'Null Gravity', 'buff', 0, 12500, 0, 6000, 0, 0xb08aff, ['haste', 'armor', 'extend'], 'rare', 'The fighter sheds weight: higher jumps, faster movement.', 'Punish their landings.'],
  ['grav_slam', 'Meteor Slam', 'melee', 28, 9000, 110, 0, 0, 0x7040d0, ['knockdown', 'bigger', 'guardbreak'], 'epic', 'Slams the opponent into the floor with crushing force.', 'Short reach — keep spacing.'],
  ['grav_singularity', 'Collapsing Star', 'zone', 10, 13000, 300, 3600, 0, 0x6030c0, ['vortex', 'bigger', 'knockdown'], 'legendary', 'A miniature star collapses and implodes.', 'Flee the radius immediately.'],
  ['grav_beam', 'Graviton Lance', 'beam', 5.5, 11500, 600, 1000, 0, 0xa070ff, ['extend', 'slow', 'guardbreak'], 'epic', 'A lance of gravitons that pins the target.', 'Dash through it.'],
  ['grav_reverse', 'Inversion', 'dash', 8, 6000, 360, 220, 1500, 0xb090ff, ['invuln', 'slow', 'refund'], 'uncommon', 'Reverses the caster\'s momentum, slipping past attacks.', 'Bait it, then strike.'],
];

/* ------------------------------------------------------------------ WIND */
const WIND: Spec[] = [
  ['wind_slash', 'Gale Slash', 'projectile', 9, 2400, 560, 0, 860, 0xa8ffe8, ['pierce', 'multishot', 'split'], 'common', 'A crescent of compressed air.', 'Block or jump.'],
  ['wind_dash', 'Sky Dash', 'dash', 6, 4200, 380, 200, 1700, 0xc0fff0, ['invuln', 'haste', 'refund'], 'common', 'An air-dash usable while airborne.', 'Anti-air them.'],
  ['wind_tornado', 'Tornado', 'zone', 7, 9500, 280, 4000, 0, 0x9ff0dd, ['vortex', 'bigger', 'knockdown'], 'uncommon', 'A spinning column that lifts and batters.', 'Walk around the column.'],
  ['wind_uppercut', 'Cyclone Rise', 'melee', 22, 6500, 100, 0, 0, 0xb0ffe8, ['knockdown', 'bigger', 'guardbreak'], 'uncommon', 'A rising cyclone that launches the opponent.', 'Keep your distance.'],
  ['wind_buff', 'Tailwind', 'buff', 0, 11000, 0, 6500, 0, 0xd0fff5, ['haste', 'armor', 'extend'], 'rare', 'Wind at your back: faster movement and dashes.', 'Outlast it.'],
  ['wind_wave', 'Pressure Wave', 'wave', 13, 6800, 640, 1300, 820, 0xa0ffe0, ['pierce', 'knockdown', 'bigger'], 'rare', 'A wave of pressure races across the floor.', 'Jump it.'],
  ['wind_rain', 'Blade Storm', 'rain', 9, 10500, 500, 2400, 680, 0xb8ffe8, ['multishot', 'bigger', 'pierce'], 'epic', 'Wind blades fall in a dense storm.', 'Keep moving.'],
  ['wind_nova', 'Vacuum Burst', 'aoe', 18, 8000, 180, 300, 0, 0xc8fff0, ['bigger', 'vortex', 'knockdown'], 'rare', 'A vacuum implodes around the caster then bursts.', 'Stay out of range.'],
  ['wind_beam', 'Jetstream', 'beam', 4.5, 10500, 580, 950, 0, 0xd8fff8, ['extend', 'knockdown', 'pierce'], 'legendary', 'A sustained jet of cutting wind.', 'Dash through it.'],
];

/* ----------------------------------------------------------------- EARTH */
const EARTH: Spec[] = [
  ['earth_spike', 'Stone Spike', 'zone', 12, 5500, 300, 1800, 0, 0xc0a070, ['bigger', 'knockdown', 'stun'], 'common', 'A spike of rock erupts beneath the opponent.', 'Move after the ground cracks.'],
  ['earth_wave', 'Fissure', 'wave', 15, 7200, 640, 1400, 540, 0xa98a60, ['pierce', 'knockdown', 'bigger'], 'common', 'A splitting fissure races along the floor.', 'Jump over the fissure.'],
  ['earth_wall', 'Bulwark', 'zone', 3, 8500, 200, 5000, 0, 0x8f7a58, ['shield', 'extend', 'bigger'], 'uncommon', 'Raises a stone wall that absorbs attacks.', 'Shatter it with heavy attacks.'],
  ['earth_slam', 'Seismic Slam', 'aoe', 22, 8500, 200, 360, 0, 0xb09070, ['knockdown', 'bigger', 'stun'], 'uncommon', 'Slams the floor; the shockwave staggers everyone nearby.', 'Jump at the moment of impact.'],
  ['earth_armor', 'Stoneskin', 'buff', 0, 13000, 0, 7000, 0, 0x9a8468, ['armor', 'shield', 'extend'], 'rare', 'Hardened stone plating absorbs damage.', 'Use guard-breaking attacks.'],
  ['earth_boulder', 'Boulder Toss', 'projectile', 20, 6000, 520, 0, 480, 0xa08860, ['bigger', 'knockdown', 'split'], 'rare', 'Hurls a slab of rock.', 'Slow projectile — dodge it.'],
  ['earth_rain', 'Rockfall', 'rain', 13, 10500, 500, 2400, 560, 0xb49870, ['multishot', 'stun', 'bigger'], 'epic', 'Boulders crash down across the arena.', 'Keep moving.'],
  ['earth_trap', 'Quicksand Snare', 'trap', 10, 8000, 220, 6500, 0, 0xc0a878, ['slow', 'stun', 'bigger'], 'uncommon', 'A patch of ground that traps whoever steps in.', 'Avoid the disturbed earth.'],
  ['earth_titan', 'Titan Fist', 'melee', 30, 10000, 115, 0, 0, 0xcbb388, ['knockdown', 'guardbreak', 'bigger'], 'legendary', 'A colossal stone fist smashes forward.', 'Long startup — dodge it.'],
];

/* --------------------------------------------------------------- DEFENSE */
const DEFENSE: Spec[] = [
  ['def_guard', 'Iron Guard', 'buff', 0, 9000, 0, 4000, 0, 0xcfd6e6, ['armor', 'shield', 'extend'], 'common', 'Reinforces the guard, massively reducing chip damage.', 'Grab the pressure or wait it out.'],
  ['def_parry', 'Perfect Parry', 'counter', 16, 7000, 110, 700, 0, 0xffffff, ['armor', 'echo', 'invuln'], 'common', 'A tight parry window that counters the next strike.', 'Delay your attack to bait the parry.'],
  ['def_barrier', 'Aegis Barrier', 'buff', 0, 12000, 0, 6000, 0, 0x9fd8ff, ['shield', 'armor', 'refund'], 'uncommon', 'Absorbs a fixed amount of incoming damage.', 'Break the shield with heavy hits.'],
  ['def_reflect', 'Mirror Ward', 'counter', 20, 10000, 120, 800, 0, 0xb0e8ff, ['echo', 'shield', 'invuln'], 'rare', 'Reflects projectiles back at the sender.', 'Use melee instead of projectiles.'],
  ['def_heal', 'Second Wind', 'buff', 0, 20000, 0, 3000, 0, 0x9fffc0, ['extend', 'shield', 'haste'], 'rare', 'Restores health over a short window.', 'Pressure them while they heal.'],
  ['def_cleanse', 'Purge', 'buff', 0, 14000, 0, 1500, 0, 0xe0ffe8, ['shield', 'haste', 'armor'], 'uncommon', 'Clears burning, chill, slow and shock effects.', 'Re-apply status after the cleanse.'],
  ['def_riposte', 'Riposte Stance', 'counter', 24, 9500, 120, 750, 0, 0xffe0a0, ['armor', 'guardbreak', 'echo'], 'epic', 'A counter that answers with a punishing slash.', 'Bait the stance with a feint.'],
  ['def_taunt', 'Challenge', 'buff', 0, 11000, 0, 5000, 0, 0xffc0c0, ['armor', 'haste', 'shield'], 'uncommon', 'A battle cry that hardens resolve and boosts damage.', 'Play safe until it fades.'],
  ['def_thorns', 'Thorn Mantle', 'buff', 8, 12500, 0, 6500, 0, 0xd0a0ff, ['armor', 'echo', 'lifesteal'], 'rare', 'Attackers take damage when they strike you.', 'Use ranged attacks.'],
  ['def_fortress', 'Fortress Protocol', 'buff', 0, 18000, 0, 5000, 0, 0xa0c0ff, ['armor', 'shield', 'extend'], 'legendary', 'Immobile but near-invincible for a short time.', 'Reposition and wait.'],
  ['def_ghost', 'Phase Veil', 'buff', 0, 15000, 0, 2200, 0, 0xc0c0ff, ['invuln', 'haste', 'extend'], 'epic', 'Become intangible to projectiles for a moment.', 'Use melee pressure.'],
];

/* -------------------------------------------------------------- MOBILITY */
const MOBILITY: Spec[] = [
  ['mob_dash', 'Shadow Dash', 'dash', 0, 3200, 340, 160, 1600, 0x9a8aff, ['invuln', 'haste', 'refund'], 'common', 'A quick evasive dash with invulnerability frames.', 'Chase their landing.'],
  ['mob_blink', 'Blink', 'dash', 0, 5000, 420, 100, 2600, 0xb0a0ff, ['invuln', 'refund', 'haste'], 'common', 'Teleports a short distance instantly.', 'Predict the destination.'],
  ['mob_vault', 'Vault Over', 'dash', 6, 4500, 300, 260, 1300, 0xc0b0ff, ['invuln', 'haste', 'knockdown'], 'uncommon', 'Leaps over the opponent, swapping sides.', 'Anti-air it.'],
  ['mob_afterimage', 'Afterimage', 'dash', 10, 6500, 360, 240, 1500, 0x8a7aff, ['echo', 'invuln', 'refund'], 'rare', 'Leaves a damaging afterimage at the origin.', 'Attack the real fighter.'],
  ['mob_sprint', 'Overdrive', 'buff', 0, 10000, 0, 6000, 0, 0xa0ffe0, ['haste', 'extend', 'armor'], 'uncommon', 'Massively boosts movement and dash recovery.', 'Zone them out.'],
  ['mob_wallkick', 'Wall Rebound', 'dash', 12, 6000, 400, 260, 1400, 0x90e0ff, ['invuln', 'knockdown', 'refund'], 'rare', 'Rebounds off the arena edge into a flying kick.', 'Stay off the walls.'],
  ['mob_teleport_strike', 'Warp Strike', 'dash', 18, 8000, 460, 220, 2200, 0xd070ff, ['invuln', 'guardbreak', 'refund'], 'epic', 'Teleports behind the opponent and strikes.', 'Turn and block early.'],
  ['mob_flow', 'Flow State', 'buff', 0, 14000, 0, 7000, 0, 0xffe0a0, ['haste', 'armor', 'refund'], 'legendary', 'All cooldowns tick faster and movement flows.', 'Survive the window.'],
  ['mob_shadowmeld', 'Shadowmeld', 'dash', 0, 7000, 380, 500, 1900, 0x6050a0, ['invuln', 'haste', 'echo'], 'rare', 'Sinks into the floor and re-emerges elsewhere.', 'Watch the shadow trail.'],
];

/* --------------------------------------------------------------- SUMMONS */
const SUMMONS: Spec[] = [
  ['sum_wolf', 'Shadow Wolf', 'summon', 8, 12000, 520, 8000, 0, 0x7a5aff, ['extend', 'multishot', 'lifesteal'], 'uncommon', 'Summons a shadow wolf that chases and bites.', 'Kill the wolf or outlast it.'],
  ['sum_sentry', 'Arc Sentry', 'summon', 6, 13000, 560, 9000, 0, 0xffe066, ['extend', 'chain', 'multishot'], 'rare', 'A stationary sentry that fires energy bolts.', 'Destroy the sentry.'],
  ['sum_raven', 'Void Ravens', 'summon', 5, 11000, 540, 7000, 0, 0x8a4aff, ['multishot', 'extend', 'lifesteal'], 'uncommon', 'A flock of ravens harasses the opponent.', 'Area attacks clear them.'],
  ['sum_golem', 'Stone Golem', 'summon', 12, 16000, 500, 10000, 0, 0xb09070, ['extend', 'knockdown', 'armor'], 'epic', 'A slow golem that guards and smashes.', 'Outmanoeuvre it.'],
  ['sum_spirit', 'Guardian Spirit', 'summon', 7, 14000, 520, 9000, 0, 0x9fffd0, ['extend', 'shield', 'lifesteal'], 'rare', 'A spirit that shields the caster and strikes back.', 'Break the spirit first.'],
  ['sum_dragon', 'Ember Dragonling', 'summon', 10, 17000, 580, 9000, 0, 0xff7a2a, ['extend', 'burn', 'multishot'], 'legendary', 'A small dragon that spits fire at the opponent.', 'Shoot it down.'],
  ['sum_twins', 'Twin Shades', 'clone', 9, 15000, 420, 7000, 0, 0xa070ff, ['multishot', 'extend', 'echo'], 'epic', 'Two mirrored shades fight alongside you.', 'Focus the original.'],
  ['sum_reaper', 'Reaper Wraith', 'summon', 14, 20000, 560, 9000, 0, 0xff3b8d, ['extend', 'lifesteal', 'knockdown'], 'mythic', 'A wraith that reaps anyone it touches.', 'Survive its duration.'],
];

/* -------------------------------------------------------------- ULTIMATE */
const ULTIMATES: Spec[] = [
  ['ult_thousand_cuts', 'Thousand Cuts', 'melee', 55, 30000, 160, 1400, 0, 0xffffff, ['guardbreak', 'lifesteal', 'knockdown'], 'legendary', 'A blur of strikes that shreds anything in front of you.', 'Dodge the long startup flash.'],
  ['ult_supernova', 'Supernova', 'aoe', 70, 34000, 280, 700, 0, 0xffb000, ['bigger', 'burn', 'knockdown'], 'legendary', 'Detonates stored energy in a colossal blast.', 'Get out of the blast radius.'],
  ['ult_void_rift', 'Void Rift', 'zone', 16, 32000, 340, 5000, 0, 0x8a2bff, ['vortex', 'bigger', 'lifesteal'], 'mythic', 'Tears a rift that devours the arena centre.', 'Fight at the edges.'],
  ['ult_omega_beam', 'Omega Beam', 'beam', 11, 36000, 760, 1600, 0, 0x66ffff, ['extend', 'guardbreak', 'bigger'], 'mythic', 'An arena-length annihilation beam.', 'Dash through the charge-up.'],
  ['ult_clone_army', 'Clone Army', 'clone', 16, 35000, 460, 7000, 0, 0xb060ff, ['multishot', 'extend', 'echo'], 'mythic', 'Five shadow clones storm the opponent at once.', 'Use wide area attacks.'],
  ['ult_judgement', 'Judgement', 'rain', 26, 33000, 560, 3000, 700, 0xfff0a0, ['multishot', 'stun', 'bigger'], 'legendary', 'Pillars of light hammer the arena.', 'Keep moving constantly.'],
  ['ult_time_fracture', 'Time Fracture', 'buff', 0, 38000, 0, 6000, 0, 0xc0f0ff, ['haste', 'armor', 'invuln'], 'mythic', 'Shatters the flow of time, accelerating you alone.', 'Turtle until it ends.'],
  ['ult_apocalypse', 'Apocalypse', 'rain', 30, 40000, 620, 3600, 620, 0xff4a2a, ['multishot', 'burn', 'bigger'], 'mythic', 'The sky falls. Meteors obliterate everything below.', 'Constant movement is the only answer.'],
];

export const SKILLS: SkillDef[] = [
  ...build('fire', FIRE, 1),
  ...build('lightning', LIGHTNING, 2),
  ...build('ice', ICE, 2),
  ...build('shadow', SHADOW, 1),
  ...build('energy', ENERGY, 1),
  ...build('gravity', GRAVITY, 3),
  ...build('wind', WIND, 2),
  ...build('earth', EARTH, 3),
  ...build('defense', DEFENSE, 2),
  ...build('mobility', MOBILITY, 1),
  ...build('summon', SUMMONS, 4),
  ...build('ultimate', ULTIMATES, 10),
];

export const SKILL_BY_ID: Record<string, SkillDef> = Object.fromEntries(SKILLS.map((s) => [s.id, s]));

export function getSkill(id: string): SkillDef | undefined {
  return SKILL_BY_ID[id];
}

export function skillLevel(id: string, level: number): SkillLevel | undefined {
  const s = SKILL_BY_ID[id];
  if (!s) return undefined;
  return s.levels[Math.min(Math.max(level, 1), 5) - 1];
}

export const SKILL_CATEGORIES: { id: SkillCategory; label: string; color: string }[] = [
  { id: 'fire', label: 'Fire', color: '#ff7a2a' },
  { id: 'lightning', label: 'Lightning', color: '#ffe066' },
  { id: 'ice', label: 'Ice', color: '#9fe8ff' },
  { id: 'shadow', label: 'Shadow', color: '#9a5aff' },
  { id: 'energy', label: 'Energy', color: '#66e0ff' },
  { id: 'gravity', label: 'Gravity', color: '#a06aff' },
  { id: 'wind', label: 'Wind', color: '#a8ffe8' },
  { id: 'earth', label: 'Earth', color: '#c0a070' },
  { id: 'defense', label: 'Defense', color: '#cfd6e6' },
  { id: 'mobility', label: 'Mobility', color: '#b0a0ff' },
  { id: 'summon', label: 'Summons', color: '#7a5aff' },
  { id: 'ultimate', label: 'Ultimate', color: '#ffb000' },
];

export const STARTER_SKILLS = ['fire_homing', 'laser_beam', 'shadow_clone'];
