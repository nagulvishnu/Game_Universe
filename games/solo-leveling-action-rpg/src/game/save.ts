// Save schema, validation and migration. Pure functions so they can be tested without a browser.
import { ITEMS, MISSIONS, QUESTS, RANKS, SHADOWS, STAT_KEYS, type Slot, type StatKey } from './data';
import type { HighScore, QState, SaveData, Settings, ShadowRec } from './store';

export const SAVE_VERSION = 2;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const asNumber = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const asInt = (value: unknown, fallback: number, min = -Infinity, max = Infinity) =>
  Math.min(max, Math.max(min, Math.round(asNumber(value, fallback))));
const asBool = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);
const asString = (value: unknown, fallback: string, maxLength = 128) =>
  typeof value === 'string' ? value.slice(0, maxLength) : fallback;

const SLOTS: Slot[] = ['weapon', 'weapon2', 'helmet', 'armor', 'gloves', 'boots', 'accessory'];
const QUEST_IDS = new Set([...Object.keys(QUESTS), ...MISSIONS.map((mission) => mission.id)]);

export const DEFAULT_KEYS: Record<string, string> = {
  forward: 'KeyW',
  back: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  jump: 'Space',
  sprint: 'ShiftLeft',
  dodge: 'ControlLeft',
  interact: 'KeyE',
  dash: 'KeyQ',
  exchange: 'KeyR',
  special: 'KeyF',
  skillZ: 'KeyZ',
  skillX: 'KeyX',
  summon: 'KeyC',
  domain: 'KeyV',
  transform: 'KeyT',
  status: 'Tab',
  inventory: 'KeyI',
  map: 'KeyM',
  quests: 'KeyJ',
  pause: 'Escape',
};

export const QUALITY_PRESETS: Record<string, Partial<Settings>> = {
  low: { resScale: 0.6, shadowQ: 0, draw: 90, particles: 0.4, npcDensity: 6, army: 8, post: false },
  medium: { resScale: 0.85, shadowQ: 1, draw: 150, particles: 0.7, npcDensity: 12, army: 16, post: true },
  high: { resScale: 1, shadowQ: 2, draw: 220, particles: 1, npcDensity: 20, army: 32, post: true },
  ultra: { resScale: 1.25, shadowQ: 3, draw: 320, particles: 1.5, npcDensity: 30, army: 64, post: true },
};

const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
const prefersReducedMotion =
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export const defaultSettings = (): Settings => {
  const preset = QUALITY_PRESETS[isMobile ? 'low' : 'medium'];
  return {
    master: 0.8,
    music: 0.5,
    sfx: 0.8,
    amb: 0.5,
    quality: isMobile ? 'low' : 'medium',
    resScale: preset.resScale ?? 0.85,
    shadowQ: preset.shadowQ ?? 1,
    draw: preset.draw ?? 150,
    particles: preset.particles ?? 0.7,
    npcDensity: preset.npcDensity ?? 12,
    army: preset.army ?? 16,
    post: preset.post ?? true,
    sens: 1,
    uiScale: 1,
    reducedMotion: prefersReducedMotion,
    keys: { ...DEFAULT_KEYS },
  };
};

const defaultStats = (): Record<StatKey, number> => ({ str: 10, agi: 10, vit: 10, int: 10, per: 10 });

export function freshSave(): SaveData {
  return {
    v: SAVE_VERSION,
    chapter: 0,
    level: 1,
    xp: 0,
    points: 0,
    stats: defaultStats(),
    gold: 120,
    essence: 0,
    inv: {
      rusty_dagger: 1,
      hunter_jacket: 1,
      work_gloves: 1,
      sneakers: 1,
      license_pendant: 1,
      hp_potion: 2,
    },
    equip: {
      weapon: 'rusty_dagger',
      armor: 'hunter_jacket',
      gloves: 'work_gloves',
      boots: 'sneakers',
      accessory: 'license_pendant',
    },
    shadows: [],
    quests: {},
    flags: {},
    cleared: [],
    titles: ['Weakest Hunter'],
    title: 'Weakest Hunter',
    dailyCount: 0,
    dailyLeft: 0,
    score: 0,
    kills: 0,
    playTime: 0,
    tracked: '',
    savedAt: 0,
  };
}

export interface NormalizedSave {
  save: SaveData;
  warnings: string[];
  migratedFrom: number | null;
  recovered: boolean;
}

function normalizeInventory(value: unknown, warnings: string[]): Record<string, number> {
  if (!isRecord(value)) return {};
  const inventory: Record<string, number> = {};
  for (const [id, count] of Object.entries(value)) {
    if (!ITEMS[id]) {
      warnings.push(`Removed unknown item "${id}".`);
      continue;
    }
    const amount = asInt(count, 0, 0, 99999);
    if (amount > 0) inventory[id] = amount;
  }
  return inventory;
}

function normalizeShadows(value: unknown, warnings: string[]): ShadowRec[] {
  if (!Array.isArray(value)) return [];
  const shadows: ShadowRec[] = [];
  const seen = new Set<string>();
  value.forEach((entry, index) => {
    if (!isRecord(entry)) {
      warnings.push('Removed a malformed shadow record.');
      return;
    }
    const key = asString(entry.key, '', 64);
    const def = SHADOWS[key];
    if (!def) {
      warnings.push(`Removed shadow with unknown key "${key || '?'}".`);
      return;
    }
    let id = asString(entry.id, '', 64);
    if (!id || seen.has(id)) {
      id = `sh_recovered_${Date.now().toString(36)}_${index}`;
      warnings.push('Regenerated a missing or duplicate shadow ID.');
    }
    seen.add(id);
    const startRank = def.startRank;
    const rank = asInt(entry.rank, startRank, startRank, RANKS.length - 1);
    const level = asInt(entry.level, 1, 1, 50);
    const evo = asInt(entry.evo, 0, 0, def.evo.length);
    const state = entry.state === 'summoned' ? 'summoned' : 'stored';
    shadows.push({
      id,
      key,
      name: asString(entry.name, def.name, 64) || def.name,
      rank,
      level,
      xp: asInt(entry.xp, 0, 0, 1_000_000),
      favorite: asBool(entry.favorite, false),
      squad: asInt(entry.squad, 0, 0, 3),
      evo,
      state,
      kills: asInt(entry.kills, 0, 0, 1_000_000_000),
    });
  });
  return shadows;
}

function normalizeQuests(value: unknown, warnings: string[]): Record<string, QState> {
  if (!isRecord(value)) return {};
  const quests: Record<string, QState> = {};
  for (const [id, entry] of Object.entries(value)) {
    if (!QUEST_IDS.has(id) || !isRecord(entry)) {
      warnings.push(`Removed unknown quest "${id}".`);
      continue;
    }
    if (entry.state !== 'active' && entry.state !== 'done') {
      warnings.push(`Removed quest "${id}" with an invalid state.`);
      continue;
    }
    const rawProgress = Array.isArray(entry.prog) ? entry.prog : [];
    const def = QUESTS[id] ?? MISSIONS.find((mission) => mission.id === id);
    const objectiveCount = def?.objs.length ?? rawProgress.length;
    quests[id] = {
      state: entry.state,
      prog: Array.from({ length: objectiveCount }, (_, index) => asInt(rawProgress[index], 0, 0, 1_000_000)),
    };
  }
  return quests;
}

export function normalizeSave(input: unknown): NormalizedSave {
  const warnings: string[] = [];
  const raw = isRecord(input) ? input : {};
  if (!isRecord(input)) warnings.push('Save data was not a valid object; defaults were used.');
  const base = freshSave();
  const migratedFrom = raw.v === undefined ? 1 : asInt(raw.v, SAVE_VERSION, 0, 999);
  if (migratedFrom < SAVE_VERSION) warnings.push(`Save migrated from version ${migratedFrom} to ${SAVE_VERSION}.`);
  if (migratedFrom > SAVE_VERSION)
    warnings.push(`Save version ${migratedFrom} is newer than this build (${SAVE_VERSION}); unknown data was ignored.`);

  const stats = { ...base.stats };
  if (isRecord(raw.stats)) {
    for (const key of STAT_KEYS) stats[key] = asInt(raw.stats[key], base.stats[key], 1, 9999);
  } else if (raw.stats !== undefined) {
    warnings.push('Invalid attributes were reset.');
  }

  const inv = isRecord(raw.inv) ? normalizeInventory(raw.inv, warnings) : { ...base.inv };
  const equip: SaveData['equip'] = {};
  if (isRecord(raw.equip)) {
    for (const slot of SLOTS) {
      const id = raw.equip[slot];
      if (typeof id !== 'string' || !id) continue;
      const item = ITEMS[id];
      if (!item || item.slot !== slot) {
        warnings.push(`Removed invalid ${slot} equipment.`);
        continue;
      }
      equip[slot] = id;
      if (!inv[id]) {
        inv[id] = 1;
        warnings.push(`Restored missing equipped item "${item.name}".`);
      }
    }
  } else {
    Object.assign(equip, base.equip);
    for (const id of Object.values(equip)) {
      if (id && !inv[id]) inv[id] = 1;
    }
  }

  const titlesInput = Array.isArray(raw.titles) ? raw.titles : base.titles;
  const titles = [
    ...new Set(
      titlesInput
        .filter((title): title is string => typeof title === 'string')
        .map((title) => title.slice(0, 64))
        .filter(Boolean)
    ),
  ];
  if (!titles.length) titles.push('Weakest Hunter');

  const title = asString(raw.title, base.title, 64);
  if (!titles.includes(title)) {
    warnings.push('Selected title was missing from the title list; it was restored.');
    titles.push(title);
  }

  const flags: Record<string, boolean> = {};
  if (isRecord(raw.flags)) {
    for (const [flag, flagValue] of Object.entries(raw.flags)) {
      if (typeof flagValue === 'boolean') flags[flag] = flagValue;
      else warnings.push(`Removed non-boolean flag "${flag}".`);
    }
  } else if (raw.flags !== undefined) {
    warnings.push('Invalid story flags were reset.');
  }

  const clearedInput = Array.isArray(raw.cleared) ? raw.cleared : [];
  const cleared = clearedInput
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.slice(0, 64));

  const quests = isRecord(raw.quests) ? normalizeQuests(raw.quests, warnings) : {};
  const tracked = typeof raw.tracked === 'string' && QUEST_IDS.has(raw.tracked) ? raw.tracked : '';

  const save: SaveData = {
    v: SAVE_VERSION,
    chapter: asInt(raw.chapter, base.chapter, 0, 99),
    level: asInt(raw.level, base.level, 1, 60),
    xp: asInt(raw.xp, base.xp, 0, 1_000_000_000),
    points: asInt(raw.points, base.points, 0, 100_000),
    stats,
    gold: asInt(raw.gold, base.gold, 0, 1_000_000_000_000),
    essence: asInt(raw.essence, base.essence, 0, 1_000_000_000),
    inv,
    equip,
    shadows: normalizeShadows(raw.shadows, warnings),
    quests,
    flags,
    cleared,
    titles,
    title,
    dailyCount: asInt(raw.dailyCount, base.dailyCount, 0, 100_000),
    dailyLeft: asInt(raw.dailyLeft, base.dailyLeft, 0, 86_400),
    score: asInt(raw.score, base.score, 0, 1_000_000_000_000),
    kills: asInt(raw.kills, base.kills, 0, 1_000_000_000),
    playTime: asInt(raw.playTime, base.playTime, 0, 1_000_000_000),
    tracked,
    savedAt: asInt(raw.savedAt, base.savedAt, 0, Number.MAX_SAFE_INTEGER),
  };

  return {
    save,
    warnings,
    migratedFrom: migratedFrom < SAVE_VERSION ? migratedFrom : null,
    recovered: warnings.length > 0,
  };
}

export function normalizeSettings(input: unknown): Settings {
  const base = defaultSettings();
  if (!isRecord(input)) return base;
  const quality =
    input.quality === 'low' || input.quality === 'medium' || input.quality === 'high' || input.quality === 'ultra'
      ? input.quality
      : base.quality;
  const keys = { ...DEFAULT_KEYS };
  if (isRecord(input.keys)) {
    for (const [action, code] of Object.entries(input.keys)) {
      if (typeof code === 'string' && code) keys[action] = code;
    }
  }
  return {
    master: Math.min(1, Math.max(0, asNumber(input.master, base.master))),
    music: Math.min(1, Math.max(0, asNumber(input.music, base.music))),
    sfx: Math.min(1, Math.max(0, asNumber(input.sfx, base.sfx))),
    amb: Math.min(1, Math.max(0, asNumber(input.amb, base.amb))),
    quality,
    resScale: Math.min(1.5, Math.max(0.5, asNumber(input.resScale, base.resScale))),
    shadowQ: asInt(input.shadowQ, base.shadowQ, 0, 3),
    draw: asInt(input.draw, base.draw, 60, 400),
    particles: Math.min(1.5, Math.max(0.2, asNumber(input.particles, base.particles))),
    npcDensity: asInt(input.npcDensity, base.npcDensity, 0, 40),
    army: asInt(input.army, base.army, 4, 100),
    post: asBool(input.post, base.post),
    sens: Math.min(3, Math.max(0.3, asNumber(input.sens, base.sens))),
    uiScale: Math.min(1.4, Math.max(0.7, asNumber(input.uiScale, base.uiScale))),
    reducedMotion: asBool(input.reducedMotion, base.reducedMotion),
    keys,
  };
}

export function normalizeScores(input: unknown): HighScore[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter(isRecord)
    .map((entry) => ({
      name: asString(entry.name, 'SUNG JIN-WOO', 40),
      score: asInt(entry.score, 0, 0, 1_000_000_000_000),
      level: asInt(entry.level, 1, 1, 60),
      note: asString(entry.note, '', 160),
      date: asString(entry.date, '', 40),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

export function serializeSave(save: SaveData): string {
  return JSON.stringify(normalizeSave(save).save, null, 2);
}

export function parseSaveFile(text: string): NormalizedSave {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('The selected file is not valid JSON.');
  }
  return normalizeSave(parsed);
}
