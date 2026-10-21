/**
 * SHADOWSTRIKE — Weapon catalogue.
 * Weapons are gameplay data: every weapon defines its own 3-hit combo, charged attack,
 * frame data (startup / active / recovery in ms), reach, hitbox shape and knockback.
 */

export type WeaponCategory =
  | 'unarmed'
  | 'sword'
  | 'greatsword'
  | 'daggers'
  | 'polearm'
  | 'energy'
  | 'axe'
  | 'scythe'
  | 'hammer'
  | 'chain';

export type WeaponShape =
  | 'none'
  | 'gauntlet'
  | 'claws'
  | 'katana'
  | 'sabre'
  | 'greatsword'
  | 'dagger'
  | 'spear'
  | 'glaive'
  | 'scythe'
  | 'axe'
  | 'hammer'
  | 'chain'
  | 'energy';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

export type SwingArc = 'slash' | 'thrust' | 'punch' | 'sweep' | 'spin' | 'overhead' | 'uppercut';

export interface AttackDef {
  id: string;
  name: string;
  /** milliseconds */
  startup: number;
  active: number;
  recovery: number;
  damage: number;
  /** horizontal reach from the fighter's centre, px */
  reach: number;
  /** hitbox width / height in px */
  hitW: number;
  hitH: number;
  /** hitbox vertical centre offset above the feet */
  hitY: number;
  knockback: number;
  launch: number;
  guardDamage: number;
  hitstun: number;
  /** forward movement applied over the startup+active window */
  lunge: number;
  arc: SwingArc;
  /** window after recovery in which the next combo hit can be buffered (ms) */
  cancelWindow: number;
  heavy?: boolean;
}

export interface WeaponDef {
  id: string;
  name: string;
  category: WeaponCategory;
  shape: WeaponShape;
  grip: 'one' | 'two' | 'dual';
  rarity: Rarity;
  description: string;
  /** vector length of the drawn weapon, px */
  length: number;
  color: number;
  glow: number;
  trail: number;
  /** multiplier applied to walk/run speed while equipped */
  moveSpeedMul: number;
  /** ms the heavy attack must be held to become charged */
  chargeTime: number;
  /** ms of extra hold for a *full* charge */
  fullChargeTime: number;
  combo: [AttackDef, AttackDef, AttackDef];
  charged: AttackDef;
  unlock: { level: number; cost: number };
  tags: string[];
}

interface ComboSpec {
  dmg: [number, number, number, number];
  startup: [number, number, number, number];
  active: [number, number, number, number];
  recovery: [number, number, number, number];
  reach: number;
  hitH?: number;
  arcs: [SwingArc, SwingArc, SwingArc, SwingArc];
  kb: [number, number, number, number];
  lunge: [number, number, number, number];
  guard?: number;
  hitstun?: number;
  launch3?: number;
}

function buildAttacks(id: string, s: ComboSpec): { combo: [AttackDef, AttackDef, AttackDef]; charged: AttackDef } {
  const names = ['Strike I', 'Strike II', 'Finisher', 'Charged'];
  // Arc-based hitbox width multipliers: thrusts are narrow, sweeps/spins are wider
  const arcHitWMul: Record<SwingArc, number> = {
    thrust: 0.38, punch: 0.42, slash: 0.52, overhead: 0.55,
    sweep: 0.62, spin: 0.68, uppercut: 0.44,
  };
  const make = (i: number): AttackDef => {
    const arc = s.arcs[i];
    const reach = s.reach + (i === 3 ? 10 : i * 3);
    const hitWMul = arcHitWMul[arc] ?? 0.52;
    return ({
      id: `${id}_a${i + 1}`,
      name: names[i],
      startup: s.startup[i],
      active: s.active[i],
      recovery: s.recovery[i],
      damage: s.dmg[i],
      reach,
      hitW: reach * hitWMul + (i === 3 ? 14 : 4),
      hitH: s.hitH ?? 70,
      hitY: 56,
      knockback: s.kb[i],
      launch: i === 2 ? (s.launch3 ?? 0) : i === 3 ? 160 : 0,
      guardDamage: (s.guard ?? 10) * (i === 3 ? 2.4 : 1 + i * 0.25),
      hitstun: (s.hitstun ?? 260) * (i === 3 ? 1.7 : 1 + i * 0.12),
      lunge: s.lunge[i],
      arc,
      cancelWindow: i === 3 ? 0 : 320,
      heavy: i === 3,
    });
  };
  return { combo: [make(0), make(1), make(2)], charged: make(3) };
}

function weapon(
  base: Omit<WeaponDef, 'combo' | 'charged'> & { spec: ComboSpec },
): WeaponDef {
  const { spec, ...rest } = base;
  const { combo, charged } = buildAttacks(base.id, spec);
  return { ...rest, combo, charged };
}

export const WEAPONS: WeaponDef[] = [
  weapon({
    id: 'iron_fists', name: 'Iron Fists', category: 'unarmed', shape: 'none', grip: 'dual',
    rarity: 'common', description: 'Bare-handed shadow boxing. Fast, short, relentless close pressure.',
    length: 0, color: 0xdddddd, glow: 0x66ccff, trail: 0x8fd6ff, moveSpeedMul: 1.12,
    chargeTime: 380, fullChargeTime: 900,
    unlock: { level: 1, cost: 0 }, tags: ['starter', 'fast', 'close-range'],
    spec: { dmg: [5, 6, 11, 20], startup: [70, 80, 110, 300], active: [70, 70, 90, 120], recovery: [120, 130, 240, 420], reach: 46, arcs: ['punch', 'punch', 'uppercut', 'uppercut'], kb: [70, 80, 200, 330], lunge: [26, 30, 46, 70], guard: 7, hitstun: 220, launch3: 150 },
  }),
  weapon({
    id: 'thunder_gauntlets', name: 'Thunder Gauntlets', category: 'unarmed', shape: 'gauntlet', grip: 'dual',
    rarity: 'rare', description: 'Storm-charged knuckles. Short reach, brutal guard pressure, shocking finishers.',
    length: 16, color: 0x8899aa, glow: 0xffe066, trail: 0xfff0a0, moveSpeedMul: 1.05,
    chargeTime: 420, fullChargeTime: 1000,
    unlock: { level: 4, cost: 900 }, tags: ['fast', 'guard-break'],
    spec: { dmg: [6, 8, 14, 26], startup: [80, 85, 120, 340], active: [70, 70, 100, 140], recovery: [130, 140, 260, 450], reach: 50, arcs: ['punch', 'uppercut', 'punch', 'uppercut'], kb: [80, 90, 230, 380], lunge: [28, 32, 52, 86], guard: 13, hitstun: 240, launch3: 180 },
  }),
  weapon({
    id: 'wraith_claws', name: 'Wraith Claws', category: 'unarmed', shape: 'claws', grip: 'dual',
    rarity: 'epic', description: 'Spectral talons that shred guard. Tiny reach, blistering cadence.',
    length: 22, color: 0x30203a, glow: 0xc46bff, trail: 0xd49bff, moveSpeedMul: 1.15,
    chargeTime: 350, fullChargeTime: 820,
    unlock: { level: 9, cost: 2200 }, tags: ['fast', 'bleed'],
    spec: { dmg: [5, 5, 10, 21], startup: [60, 62, 95, 280], active: [60, 60, 85, 120], recovery: [110, 110, 220, 400], reach: 52, arcs: ['slash', 'slash', 'spin', 'spin'], kb: [55, 60, 180, 300], lunge: [30, 34, 50, 78], guard: 9, hitstun: 200, launch3: 120 },
  }),
  weapon({
    id: 'shadow_katana', name: 'Shadow Katana', category: 'sword', shape: 'katana', grip: 'one',
    rarity: 'uncommon', description: 'The benchmark blade. Balanced speed, reach and damage.',
    length: 68, color: 0xe8e8f2, glow: 0x7fd4ff, trail: 0xbde9ff, moveSpeedMul: 1.0,
    chargeTime: 450, fullChargeTime: 1050,
    unlock: { level: 1, cost: 0 }, tags: ['starter', 'balanced'],
    spec: { dmg: [8, 9, 16, 30], startup: [95, 100, 140, 380], active: [80, 80, 110, 150], recovery: [150, 160, 300, 520], reach: 78, arcs: ['slash', 'slash', 'overhead', 'overhead'], kb: [90, 100, 250, 400], lunge: [30, 34, 54, 92], guard: 11, hitstun: 270, launch3: 140 },
  }),
  weapon({
    id: 'moonfang_sabre', name: 'Moonfang Sabre', category: 'sword', shape: 'sabre', grip: 'one',
    rarity: 'rare', description: 'Curved duelling blade. Wide arcs and quick recovery for whiff punishing.',
    length: 70, color: 0xf2e9ff, glow: 0xa0b8ff, trail: 0xcfd9ff, moveSpeedMul: 1.04,
    chargeTime: 430, fullChargeTime: 980,
    unlock: { level: 3, cost: 750 }, tags: ['balanced', 'punish'],
    spec: { dmg: [8, 9, 15, 28], startup: [88, 92, 130, 360], active: [85, 85, 110, 150], recovery: [140, 145, 280, 480], reach: 80, arcs: ['slash', 'sweep', 'slash', 'spin'], kb: [95, 100, 240, 390], lunge: [34, 38, 58, 96], guard: 11, hitstun: 265, launch3: 130 },
  }),
  weapon({
    id: 'nightsteel_longsword', name: 'Nightsteel Longsword', category: 'sword', shape: 'katana', grip: 'two',
    rarity: 'rare', description: 'Two-handed longsword. Slower than a katana, far heavier impacts.',
    length: 82, color: 0xbfc6d6, glow: 0x88a0ff, trail: 0xb6c6ff, moveSpeedMul: 0.95,
    chargeTime: 520, fullChargeTime: 1150,
    unlock: { level: 6, cost: 1400 }, tags: ['balanced', 'heavy'],
    spec: { dmg: [10, 12, 20, 36], startup: [115, 120, 165, 430], active: [90, 90, 120, 170], recovery: [175, 185, 330, 580], reach: 88, arcs: ['slash', 'overhead', 'sweep', 'overhead'], kb: [110, 120, 290, 460], lunge: [28, 32, 50, 86], guard: 15, hitstun: 300, launch3: 160 },
  }),
  weapon({
    id: 'crimson_edge', name: 'Crimson Edge', category: 'sword', shape: 'sabre', grip: 'one',
    rarity: 'epic', description: 'A blade that drinks momentum — vicious third hit, punishing whiffs.',
    length: 72, color: 0xff6a6a, glow: 0xff2d55, trail: 0xff8080, moveSpeedMul: 1.02,
    chargeTime: 440, fullChargeTime: 1000,
    unlock: { level: 11, cost: 2600 }, tags: ['aggressive'],
    spec: { dmg: [9, 10, 19, 33], startup: [92, 96, 150, 390], active: [80, 80, 120, 160], recovery: [145, 155, 320, 540], reach: 80, arcs: ['slash', 'slash', 'spin', 'overhead'], kb: [95, 105, 270, 430], lunge: [34, 38, 64, 100], guard: 12, hitstun: 280, launch3: 180 },
  }),
  weapon({
    id: 'inferno_greatsword', name: 'Inferno Greatsword', category: 'greatsword', shape: 'greatsword', grip: 'two',
    rarity: 'epic', description: 'Molten slab of a sword. Huge damage, huge recovery, huge consequences.',
    length: 96, color: 0x3a2a26, glow: 0xff6a1a, trail: 0xffa040, moveSpeedMul: 0.82,
    chargeTime: 600, fullChargeTime: 1300,
    unlock: { level: 7, cost: 1800 }, tags: ['heavy', 'knockback'],
    spec: { dmg: [14, 17, 28, 50], startup: [150, 165, 215, 520], active: [105, 110, 140, 200], recovery: [230, 250, 430, 700], reach: 96, hitH: 86, arcs: ['overhead', 'sweep', 'overhead', 'overhead'], kb: [150, 170, 380, 560], lunge: [22, 26, 44, 80], guard: 22, hitstun: 360, launch3: 220 },
  }),
  weapon({
    id: 'obsidian_cleaver', name: 'Obsidian Cleaver', category: 'greatsword', shape: 'greatsword', grip: 'two',
    rarity: 'rare', description: 'Volcanic glass monolith. Shatters guards in two hits.',
    length: 92, color: 0x1d1a24, glow: 0x9a6bff, trail: 0xb48cff, moveSpeedMul: 0.84,
    chargeTime: 580, fullChargeTime: 1250,
    unlock: { level: 5, cost: 1300 }, tags: ['heavy', 'guard-break'],
    spec: { dmg: [13, 16, 26, 46], startup: [145, 160, 205, 500], active: [100, 105, 135, 190], recovery: [225, 240, 410, 680], reach: 92, hitH: 84, arcs: ['overhead', 'overhead', 'sweep', 'overhead'], kb: [140, 160, 360, 540], lunge: [22, 26, 42, 76], guard: 26, hitstun: 350, launch3: 200 },
  }),
  weapon({
    id: 'titan_zweihander', name: 'Titan Zweihänder', category: 'greatsword', shape: 'greatsword', grip: 'two',
    rarity: 'legendary', description: 'Colossal two-hander with a sweeping spin finisher that clears space.',
    length: 104, color: 0xd8dde8, glow: 0xfff2b0, trail: 0xffe890, moveSpeedMul: 0.78,
    chargeTime: 650, fullChargeTime: 1400,
    unlock: { level: 16, cost: 5200 }, tags: ['heavy', 'space-control'],
    spec: { dmg: [15, 18, 31, 56], startup: [160, 175, 230, 560], active: [110, 115, 160, 220], recovery: [245, 265, 450, 760], reach: 104, hitH: 90, arcs: ['overhead', 'sweep', 'spin', 'overhead'], kb: [160, 180, 420, 620], lunge: [20, 24, 40, 74], guard: 24, hitstun: 380, launch3: 240 },
  }),
  weapon({
    id: 'phantom_daggers', name: 'Phantom Daggers', category: 'daggers', shape: 'dagger', grip: 'dual',
    rarity: 'uncommon', description: 'Twin fangs. Minimal reach, maximal pressure, near-instant recovery.',
    length: 34, color: 0xcfd6e6, glow: 0x7cf0d0, trail: 0xa8ffe8, moveSpeedMul: 1.18,
    chargeTime: 330, fullChargeTime: 780,
    unlock: { level: 2, cost: 500 }, tags: ['fast', 'combo'],
    spec: { dmg: [5, 5, 11, 22], startup: [58, 60, 90, 270], active: [55, 55, 80, 110], recovery: [100, 105, 200, 380], reach: 56, arcs: ['thrust', 'slash', 'spin', 'spin'], kb: [50, 55, 170, 290], lunge: [32, 36, 56, 88], guard: 7, hitstun: 190, launch3: 110 },
  }),
  weapon({
    id: 'venom_kris', name: 'Venom Kris', category: 'daggers', shape: 'dagger', grip: 'dual',
    rarity: 'rare', description: 'Wavy poisoned blades — low per-hit damage, oppressive chip pressure.',
    length: 36, color: 0x7fff9c, glow: 0x33ff88, trail: 0x88ffb0, moveSpeedMul: 1.16,
    chargeTime: 340, fullChargeTime: 800,
    unlock: { level: 8, cost: 1900 }, tags: ['fast', 'chip'],
    spec: { dmg: [5, 6, 12, 23], startup: [60, 62, 95, 280], active: [55, 58, 82, 115], recovery: [102, 108, 205, 390], reach: 58, arcs: ['thrust', 'thrust', 'slash', 'spin'], kb: [50, 58, 175, 300], lunge: [32, 36, 58, 90], guard: 9, hitstun: 195, launch3: 115 },
  }),
  weapon({
    id: 'mirror_shivs', name: 'Mirror Shivs', category: 'daggers', shape: 'dagger', grip: 'dual',
    rarity: 'epic', description: 'Reflective shards that chain into a four-frame spin finisher.',
    length: 38, color: 0xe6f6ff, glow: 0x9fd8ff, trail: 0xd0efff, moveSpeedMul: 1.2,
    chargeTime: 320, fullChargeTime: 760,
    unlock: { level: 13, cost: 3100 }, tags: ['fast', 'combo'],
    spec: { dmg: [6, 6, 12, 24], startup: [55, 58, 88, 260], active: [52, 55, 80, 110], recovery: [96, 100, 195, 370], reach: 57, arcs: ['slash', 'thrust', 'spin', 'spin'], kb: [52, 56, 180, 300], lunge: [34, 38, 60, 92], guard: 8, hitstun: 190, launch3: 130 },
  }),
  weapon({
    id: 'storm_spear', name: 'Storm Spear', category: 'polearm', shape: 'spear', grip: 'two',
    rarity: 'uncommon', description: 'Long thrusts that control neutral; sweeping finisher resets spacing.',
    length: 112, color: 0xc8cedd, glow: 0x7fe0ff, trail: 0xaef0ff, moveSpeedMul: 0.96,
    chargeTime: 500, fullChargeTime: 1120,
    unlock: { level: 2, cost: 600 }, tags: ['reach', 'zoning'],
    spec: { dmg: [8, 9, 17, 31], startup: [105, 108, 155, 400], active: [70, 72, 110, 150], recovery: [165, 175, 320, 560], reach: 112, hitH: 56, arcs: ['thrust', 'thrust', 'sweep', 'thrust'], kb: [100, 110, 280, 440], lunge: [40, 44, 48, 110], guard: 12, hitstun: 270, launch3: 150 },
  }),
  weapon({
    id: 'dragon_glaive', name: 'Dragon Glaive', category: 'polearm', shape: 'glaive', grip: 'two',
    rarity: 'epic', description: 'Bladed polearm with enormous sweeping arcs and strong guard pressure.',
    length: 116, color: 0x2a2f3a, glow: 0xff9a3c, trail: 0xffc070, moveSpeedMul: 0.92,
    chargeTime: 540, fullChargeTime: 1180,
    unlock: { level: 12, cost: 2900 }, tags: ['reach', 'sweep'],
    spec: { dmg: [10, 11, 20, 37], startup: [118, 124, 170, 440], active: [80, 84, 120, 170], recovery: [180, 190, 350, 600], reach: 116, hitH: 72, arcs: ['sweep', 'slash', 'spin', 'sweep'], kb: [110, 120, 310, 480], lunge: [34, 38, 46, 96], guard: 17, hitstun: 290, launch3: 190 },
  }),
  weapon({
    id: 'halberd_of_dusk', name: 'Halberd of Dusk', category: 'polearm', shape: 'glaive', grip: 'two',
    rarity: 'rare', description: 'Slow, immense reach, enormous knockback on the finisher.',
    length: 120, color: 0x3b3340, glow: 0x9f7bff, trail: 0xc3a6ff, moveSpeedMul: 0.9,
    chargeTime: 560, fullChargeTime: 1220,
    unlock: { level: 10, cost: 2400 }, tags: ['reach', 'knockback'],
    spec: { dmg: [10, 12, 22, 40], startup: [125, 132, 180, 460], active: [78, 82, 118, 170], recovery: [190, 200, 370, 630], reach: 120, hitH: 74, arcs: ['overhead', 'thrust', 'sweep', 'overhead'], kb: [115, 128, 340, 510], lunge: [32, 36, 44, 90], guard: 18, hitstun: 300, launch3: 210 },
  }),
  weapon({
    id: 'arcane_blade', name: 'Arcane Blade', category: 'energy', shape: 'energy', grip: 'one',
    rarity: 'rare', description: 'Pure hardlight edge. No weight, perfect cadence, energy-laced slashes.',
    length: 74, color: 0x66e0ff, glow: 0x33ccff, trail: 0x9ff0ff, moveSpeedMul: 1.08,
    chargeTime: 400, fullChargeTime: 920,
    unlock: { level: 5, cost: 1200 }, tags: ['energy', 'balanced'],
    spec: { dmg: [8, 9, 16, 31], startup: [82, 86, 125, 350], active: [85, 88, 115, 160], recovery: [135, 140, 275, 470], reach: 82, arcs: ['slash', 'slash', 'spin', 'thrust'], kb: [90, 98, 250, 410], lunge: [34, 38, 58, 100], guard: 12, hitstun: 260, launch3: 150 },
  }),
  weapon({
    id: 'void_saber', name: 'Void Saber', category: 'energy', shape: 'energy', grip: 'one',
    rarity: 'legendary', description: 'A tear in space shaped like a sword. Ignores a share of guard.',
    length: 78, color: 0xb14bff, glow: 0x8a2bff, trail: 0xcf8bff, moveSpeedMul: 1.06,
    chargeTime: 420, fullChargeTime: 960,
    unlock: { level: 18, cost: 6000 }, tags: ['energy', 'guard-break'],
    spec: { dmg: [9, 10, 18, 35], startup: [84, 88, 128, 360], active: [88, 90, 120, 170], recovery: [138, 144, 280, 480], reach: 84, arcs: ['slash', 'thrust', 'spin', 'overhead'], kb: [95, 100, 265, 430], lunge: [36, 40, 60, 104], guard: 20, hitstun: 270, launch3: 170 },
  }),
  weapon({
    id: 'solar_lance', name: 'Solar Lance', category: 'energy', shape: 'spear', grip: 'two',
    rarity: 'mythic', description: 'A spear of contained starlight — long reach with energy burst thrusts.',
    length: 118, color: 0xffd36a, glow: 0xffb000, trail: 0xffe39a, moveSpeedMul: 0.98,
    chargeTime: 520, fullChargeTime: 1150,
    unlock: { level: 22, cost: 9000 }, tags: ['reach', 'energy'],
    spec: { dmg: [10, 12, 21, 42], startup: [100, 106, 150, 420], active: [78, 82, 118, 180], recovery: [160, 170, 320, 560], reach: 118, hitH: 62, arcs: ['thrust', 'thrust', 'sweep', 'thrust'], kb: [105, 115, 300, 480], lunge: [42, 46, 52, 120], guard: 16, hitstun: 285, launch3: 180 },
  }),
  weapon({
    id: 'void_scythe', name: 'Void Scythe', category: 'scythe', shape: 'scythe', grip: 'two',
    rarity: 'epic', description: 'Reaping arcs that drag opponents inward on the second hit.',
    length: 108, color: 0x241d2e, glow: 0x6cf0c0, trail: 0x9affdd, moveSpeedMul: 0.93,
    chargeTime: 540, fullChargeTime: 1180,
    unlock: { level: 14, cost: 3600 }, tags: ['sweep', 'pull'],
    spec: { dmg: [11, 12, 22, 40], startup: [120, 126, 172, 450], active: [90, 95, 130, 185], recovery: [185, 195, 360, 610], reach: 106, hitH: 80, arcs: ['sweep', 'spin', 'sweep', 'spin'], kb: [-60, -70, 320, 500], lunge: [30, 34, 48, 92], guard: 16, hitstun: 300, launch3: 200 },
  }),
  weapon({
    id: 'soulreaper', name: 'Soulreaper', category: 'scythe', shape: 'scythe', grip: 'two',
    rarity: 'mythic', description: 'The harvest blade. Every finisher drains vitality from the struck.',
    length: 112, color: 0x120f18, glow: 0xff3b8d, trail: 0xff86bd, moveSpeedMul: 0.9,
    chargeTime: 580, fullChargeTime: 1260,
    unlock: { level: 24, cost: 11000 }, tags: ['sweep', 'lifesteal'],
    spec: { dmg: [12, 14, 25, 46], startup: [126, 132, 180, 470], active: [92, 96, 135, 195], recovery: [192, 200, 375, 640], reach: 110, hitH: 82, arcs: ['sweep', 'sweep', 'spin', 'overhead'], kb: [-70, 110, 340, 520], lunge: [30, 34, 50, 96], guard: 18, hitstun: 310, launch3: 220 },
  }),
  weapon({
    id: 'ember_axe', name: 'Ember Axe', category: 'axe', shape: 'axe', grip: 'one',
    rarity: 'uncommon', description: 'Short, chopping, savage. Great damage for its reach, poor recovery.',
    length: 58, color: 0x5a4030, glow: 0xff7a2a, trail: 0xffa860, moveSpeedMul: 0.98,
    chargeTime: 480, fullChargeTime: 1080,
    unlock: { level: 3, cost: 700 }, tags: ['burst'],
    spec: { dmg: [11, 13, 22, 38], startup: [110, 118, 160, 420], active: [80, 85, 115, 165], recovery: [190, 200, 350, 600], reach: 68, arcs: ['overhead', 'slash', 'overhead', 'overhead'], kb: [120, 130, 300, 470], lunge: [26, 30, 48, 84], guard: 16, hitstun: 300, launch3: 170 },
  }),
  weapon({
    id: 'twin_hatchets', name: 'Twin Hatchets', category: 'axe', shape: 'axe', grip: 'dual',
    rarity: 'rare', description: 'Dual chopping blades: medium speed with heavy guard chip.',
    length: 50, color: 0x6b5a46, glow: 0xffc24a, trail: 0xffd98a, moveSpeedMul: 1.05,
    chargeTime: 430, fullChargeTime: 980,
    unlock: { level: 9, cost: 2000 }, tags: ['dual', 'chip'],
    spec: { dmg: [8, 9, 17, 32], startup: [88, 92, 132, 370], active: [70, 74, 105, 150], recovery: [148, 155, 285, 500], reach: 62, arcs: ['slash', 'slash', 'spin', 'overhead'], kb: [95, 100, 255, 420], lunge: [32, 36, 54, 92], guard: 15, hitstun: 265, launch3: 150 },
  }),
  weapon({
    id: 'quake_hammer', name: 'Quake Hammer', category: 'hammer', shape: 'hammer', grip: 'two',
    rarity: 'epic', description: 'Earth-splitting maul. Slowest weapon in the game, devastating payoff.',
    length: 86, color: 0x4a4a52, glow: 0xffb34a, trail: 0xffd28a, moveSpeedMul: 0.76,
    chargeTime: 680, fullChargeTime: 1450,
    unlock: { level: 15, cost: 4200 }, tags: ['heavy', 'knockdown'],
    spec: { dmg: [16, 19, 32, 60], startup: [170, 185, 245, 600], active: [100, 108, 150, 220], recovery: [255, 275, 470, 800], reach: 86, hitH: 88, arcs: ['overhead', 'sweep', 'overhead', 'overhead'], kb: [170, 190, 440, 660], lunge: [20, 24, 40, 70], guard: 28, hitstun: 400, launch3: 260 },
  }),
  weapon({
    id: 'gravebreaker_maul', name: 'Gravebreaker Maul', category: 'hammer', shape: 'hammer', grip: 'two',
    rarity: 'legendary', description: 'A tombstone on a haft. Guard-shattering, arena-clearing swings.',
    length: 90, color: 0x2d2b33, glow: 0x7ad6ff, trail: 0xb0e8ff, moveSpeedMul: 0.74,
    chargeTime: 700, fullChargeTime: 1500,
    unlock: { level: 20, cost: 7000 }, tags: ['heavy', 'guard-break'],
    spec: { dmg: [17, 20, 34, 64], startup: [178, 192, 255, 620], active: [102, 110, 155, 230], recovery: [262, 285, 485, 830], reach: 90, hitH: 90, arcs: ['overhead', 'overhead', 'sweep', 'overhead'], kb: [180, 200, 460, 690], lunge: [20, 22, 38, 68], guard: 34, hitstun: 420, launch3: 280 },
  }),
  weapon({
    id: 'spirit_chain', name: 'Spirit Chain', category: 'chain', shape: 'chain', grip: 'one',
    rarity: 'rare', description: 'Whipping chain blade: absurd reach, thin hitbox, slow to retract.',
    length: 130, color: 0x9aa4b8, glow: 0x7fffd0, trail: 0xb8ffe8, moveSpeedMul: 1.0,
    chargeTime: 520, fullChargeTime: 1150,
    unlock: { level: 7, cost: 1700 }, tags: ['reach', 'zoning'],
    spec: { dmg: [7, 8, 15, 30], startup: [112, 118, 160, 430], active: [85, 90, 125, 180], recovery: [175, 185, 340, 580], reach: 130, hitH: 48, arcs: ['sweep', 'thrust', 'spin', 'sweep'], kb: [85, 95, 270, 430], lunge: [24, 28, 40, 70], guard: 11, hitstun: 255, launch3: 150 },
  }),
  weapon({
    id: 'hellfire_flail', name: 'Hellfire Flail', category: 'chain', shape: 'chain', grip: 'one',
    rarity: 'epic', description: 'Burning flail head on a long chain — erratic arcs, scorching finisher.',
    length: 124, color: 0x3a2020, glow: 0xff4a1a, trail: 0xff8a50, moveSpeedMul: 0.97,
    chargeTime: 550, fullChargeTime: 1200,
    unlock: { level: 17, cost: 4800 }, tags: ['reach', 'burn'],
    spec: { dmg: [9, 10, 19, 36], startup: [120, 126, 170, 450], active: [90, 95, 130, 190], recovery: [185, 195, 355, 600], reach: 124, hitH: 60, arcs: ['spin', 'sweep', 'spin', 'overhead'], kb: [100, 110, 300, 470], lunge: [24, 28, 42, 76], guard: 15, hitstun: 275, launch3: 180 },
  }),
  weapon({
    id: 'eclipse_odachi', name: 'Eclipse Odachi', category: 'greatsword', shape: 'katana', grip: 'two',
    rarity: 'mythic', description: 'Ceremonial field-length katana. Sublime reach with greatsword weight.',
    length: 110, color: 0x101018, glow: 0xffffff, trail: 0xdfe8ff, moveSpeedMul: 0.88,
    chargeTime: 600, fullChargeTime: 1320,
    unlock: { level: 26, cost: 13000 }, tags: ['reach', 'heavy'],
    spec: { dmg: [13, 15, 27, 52], startup: [132, 140, 190, 480], active: [95, 100, 140, 210], recovery: [195, 210, 390, 660], reach: 104, hitH: 84, arcs: ['slash', 'overhead', 'spin', 'overhead'], kb: [130, 145, 360, 540], lunge: [30, 34, 52, 100], guard: 20, hitstun: 340, launch3: 220 },
  }),
  weapon({
    id: 'tempest_fans', name: 'Tempest Fans', category: 'daggers', shape: 'claws', grip: 'dual',
    rarity: 'legendary', description: 'Razor war-fans. Whirling arcs with wind-assisted lunges.',
    length: 42, color: 0xdff6ff, glow: 0x66ffe0, trail: 0xaaffee, moveSpeedMul: 1.22,
    chargeTime: 360, fullChargeTime: 840,
    unlock: { level: 19, cost: 6400 }, tags: ['fast', 'mobility'],
    spec: { dmg: [6, 7, 13, 26], startup: [60, 64, 96, 290], active: [60, 64, 90, 130], recovery: [104, 110, 210, 400], reach: 64, arcs: ['spin', 'sweep', 'spin', 'spin'], kb: [60, 68, 200, 330], lunge: [38, 42, 66, 104], guard: 10, hitstun: 210, launch3: 150 },
  }),
];

export const WEAPON_BY_ID: Record<string, WeaponDef> = Object.fromEntries(
  WEAPONS.map((w) => [w.id, w]),
);
export const WEAPON_CATEGORIES: WeaponCategory[] = [
  'unarmed', 'sword', 'greatsword', 'daggers', 'polearm', 'energy', 'axe', 'scythe', 'hammer', 'chain',
];

export function getWeapon(id: string): WeaponDef {
  return WEAPON_BY_ID[id] ?? WEAPON_BY_ID.shadow_katana;
}

export const STARTER_WEAPONS = ['iron_fists', 'shadow_katana'];

/* ------------------------------------------------------------ display stats */

/**
 * Normalised 0-100 ratings shown on weapon / opponent cards.
 * Derived from the real frame data so the numbers always track the weapon.
 */
export interface DisplayStats {
  damage: number;
  speed: number;
  range: number;
  recovery: number;
  knockback: number;
}

function clamp(v: number, lo = 5, hi = 100): number {
  return Math.min(hi, Math.max(lo, Math.round(v)));
}

export function displayStats(w: WeaponDef): DisplayStats {
  const comboTotal = w.combo.reduce((a, c) => a + c.damage, 0);
  const startup = w.combo[0].startup;
  const recovery = w.combo[0].recovery;
  const reach = w.combo[0].reach;
  const knockback = w.combo[2].knockback;
  return {
    damage: clamp((comboTotal + w.charged.damage) * 1.35),
    speed: clamp(14000 / (startup + 52)),
    range: clamp(reach * 0.77),
    recovery: clamp(100 - recovery * 0.43),
    knockback: clamp(knockback * 0.08),
  };
}

/* ------------------------------------------------------------------ skins */

export interface WeaponSkin {
  id: string;
  name: string;
  color: number;
  glow: number;
  trail: number;
}

/** Cosmetic recolours available for every weapon. */
export function weaponSkins(w: WeaponDef): WeaponSkin[] {
  return [
    { id: 'base', name: 'Base', color: w.color, glow: w.glow, trail: w.trail },
    { id: 'void', name: 'Void', color: 0x2a1b3d, glow: 0xb14bff, trail: 0xcf8bff },
    { id: 'ember', name: 'Ember', color: 0x3a2020, glow: 0xff6a1a, trail: 0xffa040 },
    { id: 'frost', name: 'Frost', color: 0x1b2a33, glow: 0x9fe8ff, trail: 0xd0f4ff },
    { id: 'gilded', name: 'Gilded', color: 0x3a3018, glow: 0xffb000, trail: 0xffe39a },
  ];
}

/** Returns a copy of the weapon painted with the given skin. */
export function applySkin(w: WeaponDef, skin: WeaponSkin): WeaponDef {
  return { ...w, color: skin.color, glow: skin.glow, trail: skin.trail };
}
