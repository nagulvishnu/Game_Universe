import { DEFAULT_LOADOUT_CONFIG, DEFAULT_OWNED_ATTACHMENTS } from '../data/customization';
import { WEAPONS } from '../data/weapons';
import {
  GameSettings,
  HighScoreEntry,
  KeyBindings,
  MissionDefinition,
  MissionGrade,
  MissionResultSummary,
  PlayerSaveData,
} from '../types/game';

export const SAVE_STORAGE_KEY = 'sniper_deadline_save_v2';
export const CURRENT_SAVE_VERSION = 2;

export const RANK_TITLES: Record<number, string> = {
  1: 'Scout Initiate',
  2: 'Field Marksman',
  3: 'Designated Sharpshooter',
  4: 'Recon Specialist',
  5: 'Vanguard Sniper',
  6: 'Covert Stalker',
  7: 'Nightfall Operative',
  8: 'Senior Overwatch',
  9: 'Phantom Precision',
  10: 'Master Ballistician',
  11: 'Black Ops Specter',
  12: 'Deadline Legend',
};

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  rewardCredits: number;
}

export const ACHIEVEMENTS_LIST: AchievementDef[] = [
  {
    id: 'first_blood',
    title: 'Zeroed In',
    description: 'Complete your first operation in SNIPER: DEADLINE.',
    rewardCredits: 300,
  },
  {
    id: 'ghost_operator',
    title: 'Silent Specter',
    description: 'Complete a hostile mission without triggering any combat alarms.',
    rewardCredits: 600,
  },
  {
    id: 'longshot_200',
    title: 'Beyond Horizon',
    description: 'Land a lethal shot or bullseye from at least 195 meters away.',
    rewardCredits: 750,
  },
  {
    id: 's_rank_ace',
    title: 'Surgical S-Rank',
    description: 'Achieve an S Grade rating on any operation.',
    rewardCredits: 800,
  },
  {
    id: 'headhunter_15',
    title: ' Cranial Precision',
    description: 'Accumulate 15 career headshots or bullseyes.',
    rewardCredits: 700,
  },
  {
    id: 'custom_gunsmith',
    title: 'Master Gunsmith',
    description: 'Own at least 12 weapon attachments, optics, or skins.',
    rewardCredits: 650,
  },
  {
    id: 'arsenal_5',
    title: 'Armory Curator',
    description: 'Unlock 5 distinct sniper rifles in your arsenal.',
    rewardCredits: 1200,
  },
  {
    id: 'meridian_fallen',
    title: 'Dead Reckoning',
    description: 'Defeat Director Julian Vance and complete the 12-mission campaign.',
    rewardCredits: 3500,
  },
];

export const DEFAULT_KEY_BINDINGS: KeyBindings = {
  moveForward: 'KeyW',
  moveBackward: 'KeyS',
  moveLeft: 'KeyA',
  moveRight: 'KeyD',
  sprint: 'ShiftLeft',
  crouch: 'KeyC',
  reload: 'KeyR',
  interact: 'KeyE',
  binoculars: 'KeyQ',
  cameraToggle: 'KeyV',
  equipment1: 'Digit1',
  equipment2: 'Digit2',
  ammoCycle: 'KeyB',
  tacticalMap: 'Tab',
};

export const DEFAULT_SETTINGS: GameSettings = {
  mouseSensitivity: 1.0,
  scopeSensitivity: 0.55,
  invertY: false,
  graphicsQuality: 'high',
  masterVolume: 0.75,
  sfxVolume: 0.85,
  ambienceVolume: 0.5,
  muted: false,
  thirdPersonDefault: false,
  showTrajectoryHelper: true,
  enableKillcamReplay: true,
  showTouchControls: 'auto',
  keyBindings: { ...DEFAULT_KEY_BINDINGS },
};

const SEEDED_BENCHMARK_SCORES: HighScoreEntry[] = [
  {
    id: 'seed_1',
    missionId: 'camp_04_desert_watch',
    missionTitle: 'Desert Watch [ benchmark: Callsign HAWK ]',
    mode: 'campaign',
    score: 8420,
    grade: 'S',
    longestShot: 214,
    accuracy: 92,
    headshots: 4,
    timeSeconds: 88,
    weaponName: 'Falcon XR',
    timestamp: 1700000000000,
  },
  {
    id: 'seed_2',
    missionId: 'con_longshot_03_m',
    missionTitle: 'Extreme Horizon [ benchmark: Callsign ZERO ]',
    mode: 'longshot_trials',
    score: 7650,
    grade: 'A',
    longestShot: 258,
    accuracy: 85,
    headshots: 3,
    timeSeconds: 74,
    weaponName: 'Tempest AX',
    timestamp: 1700000001000,
  },
  {
    id: 'seed_3',
    missionId: 'camp_02_silent_arrival',
    missionTitle: 'Silent Arrival [ benchmark: Callsign KESTREL ]',
    mode: 'campaign',
    score: 6890,
    grade: 'A',
    longestShot: 182,
    accuracy: 88,
    headshots: 5,
    timeSeconds: 95,
    weaponName: 'Phantom SR',
    timestamp: 1700000002000,
  },
];

export function xpRequiredForRank(rank: number): number {
  if (rank <= 1) return 0;
  // Smooth curve so Rank 2 = 600 XP, Rank 5 = 3,400 XP, Rank 12 = 16,500 XP
  return Math.round(450 * (rank - 1) + 125 * Math.pow(rank - 1, 1.85));
}

export function getRankFromXp(xp: number): number {
  let rank = 1;
  while (rank < 20 && xp >= xpRequiredForRank(rank + 1)) {
    rank++;
  }
  return rank;
}

export function getRankTitle(rank: number): string {
  return RANK_TITLES[Math.min(12, Math.max(1, rank))] ?? `Apex Overwatch Tier ${rank}`;
}

export function createDefaultSaveData(): PlayerSaveData {
  const defaultLoadouts: Record<string, typeof DEFAULT_LOADOUT_CONFIG> = {};
  for (const w of WEAPONS) {
    defaultLoadouts[w.id] = { ...DEFAULT_LOADOUT_CONFIG };
  }

  return {
    version: CURRENT_SAVE_VERSION,
    hasStartedGame: false,
    rank: 1,
    xp: 0,
    credits: 1600, // Enough starting operational budget to try Viper Scout or Suppressor + Variable Scope!
    equippedWeaponId: 'ranger_m70',
    equippedAmmo: 'standard',
    equippedSlots: ['pulse_reveal', 'supply_kit'],
    unlockedWeapons: ['ranger_m70'],
    ownedAttachments: [...DEFAULT_OWNED_ATTACHMENTS],
    unlockedEquipment: ['binoculars', 'pulse_reveal', 'supply_kit'],
    weaponLoadouts: defaultLoadouts,
    missionRecords: {},
    completedContracts: [],
    dailySeedDate: new Date().toISOString().slice(0, 10),
    achievements: [],
    highScores: [...SEEDED_BENCHMARK_SCORES],
    lifetimeStats: {
      totalKills: 0,
      totalHeadshots: 0,
      shotsFired: 0,
      shotsHit: 0,
      longestShotMeters: 0,
      stealthCompletions: 0,
    },
    settings: {
      ...DEFAULT_SETTINGS,
      keyBindings: { ...DEFAULT_KEY_BINDINGS },
    },
  };
}

/**
 * Validates and migrates raw JSON save data safely so corrupted or older v1 saves never crash.
 */
export function validateAndMigrateSave(raw: unknown): PlayerSaveData {
  const fallback = createDefaultSaveData();
  if (!raw || typeof raw !== 'object') return fallback;

  const obj = raw as Record<string, unknown>;

  const xp = typeof obj.xp === 'number' && Number.isFinite(obj.xp) ? Math.max(0, obj.xp) : 0;
  const rank = getRankFromXp(xp);
  const credits =
    typeof obj.credits === 'number' && Number.isFinite(obj.credits)
      ? Math.max(0, Math.round(obj.credits))
      : fallback.credits;

  const unlockedWeapons = Array.isArray(obj.unlockedWeapons)
    ? Array.from(new Set(['ranger_m70', ...obj.unlockedWeapons.filter((x): x is string => typeof x === 'string')]))
    : fallback.unlockedWeapons;

  const equippedWeaponId =
    typeof obj.equippedWeaponId === 'string' && unlockedWeapons.includes(obj.equippedWeaponId)
      ? obj.equippedWeaponId
      : 'ranger_m70';

  const ownedAttachments = Array.isArray(obj.ownedAttachments)
    ? Array.from(
        new Set([
          ...DEFAULT_OWNED_ATTACHMENTS,
          ...obj.ownedAttachments.filter((x): x is string => typeof x === 'string'),
        ])
      )
    : fallback.ownedAttachments;

  const rawSettings = (obj.settings && typeof obj.settings === 'object'
    ? obj.settings
    : {}) as Partial<GameSettings>;

  const mergedSettings: GameSettings = {
    ...DEFAULT_SETTINGS,
    ...rawSettings,
    keyBindings: {
      ...DEFAULT_KEY_BINDINGS,
      ...(rawSettings.keyBindings ?? {}),
    },
  };

  const mergedLoadouts = { ...fallback.weaponLoadouts };
  if (obj.weaponLoadouts && typeof obj.weaponLoadouts === 'object') {
    for (const [wid, cfg] of Object.entries(obj.weaponLoadouts as Record<string, unknown>)) {
      if (cfg && typeof cfg === 'object') {
        mergedLoadouts[wid] = {
          ...DEFAULT_LOADOUT_CONFIG,
          ...(cfg as Partial<typeof DEFAULT_LOADOUT_CONFIG>),
        };
      }
    }
  }

  return {
    version: CURRENT_SAVE_VERSION,
    hasStartedGame: Boolean(obj.hasStartedGame),
    rank,
    xp,
    credits,
    equippedWeaponId,
    equippedAmmo:
      typeof obj.equippedAmmo === 'string' ? (obj.equippedAmmo as PlayerSaveData['equippedAmmo']) : 'standard',
    equippedSlots:
      Array.isArray(obj.equippedSlots) && obj.equippedSlots.length === 2
        ? (obj.equippedSlots as PlayerSaveData['equippedSlots'])
        : fallback.equippedSlots,
    unlockedWeapons,
    ownedAttachments,
    unlockedEquipment: Array.isArray(obj.unlockedEquipment)
      ? (Array.from(
          new Set(['binoculars', 'pulse_reveal', 'supply_kit', ...obj.unlockedEquipment])
        ) as PlayerSaveData['unlockedEquipment'])
      : fallback.unlockedEquipment,
    weaponLoadouts: mergedLoadouts,
    missionRecords:
      obj.missionRecords && typeof obj.missionRecords === 'object'
        ? (obj.missionRecords as PlayerSaveData['missionRecords'])
        : {},
    completedContracts: Array.isArray(obj.completedContracts)
      ? obj.completedContracts.filter((x): x is string => typeof x === 'string')
      : [],
    dailySeedDate:
      typeof obj.dailySeedDate === 'string' ? obj.dailySeedDate : fallback.dailySeedDate,
    achievements: Array.isArray(obj.achievements)
      ? obj.achievements.filter((x): x is string => typeof x === 'string')
      : [],
    highScores:
      Array.isArray(obj.highScores) && obj.highScores.length > 0
        ? (obj.highScores as HighScoreEntry[])
        : [...SEEDED_BENCHMARK_SCORES],
    lifetimeStats:
      obj.lifetimeStats && typeof obj.lifetimeStats === 'object'
        ? {
            ...fallback.lifetimeStats,
            ...(obj.lifetimeStats as Partial<PlayerSaveData['lifetimeStats']>),
          }
        : fallback.lifetimeStats,
    settings: mergedSettings,
  };
}

export function loadSaveData(): PlayerSaveData {
  try {
    const rawStr = window.localStorage.getItem(SAVE_STORAGE_KEY);
    if (!rawStr) return createDefaultSaveData();
    const parsed: unknown = JSON.parse(rawStr);
    return validateAndMigrateSave(parsed);
  } catch {
    return createDefaultSaveData();
  }
}

export function persistSaveData(data: PlayerSaveData): void {
  try {
    window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Graceful fallback if storage quota or private mode blocks write
  }
}

export function resetSaveData(): PlayerSaveData {
  const fresh = createDefaultSaveData();
  persistSaveData(fresh);
  return fresh;
}

/**
 * Computes mission grade, total score, anti-exploit rewards, rank-up, and achievements.
 */
export function evaluateMissionOutcome(params: {
  save: PlayerSaveData;
  mission: MissionDefinition;
  victory: boolean;
  failureReason?: string;
  shotsFired: number;
  shotsHit: number;
  kills: number;
  headshots: number;
  longestShot: number;
  timeSeconds: number;
  alarmsTriggered: number;
  optionalCompletedCount: number;
  weaponName: string;
}): { updatedSave: PlayerSaveData; summary: MissionResultSummary } {
  const {
    save,
    mission,
    victory,
    failureReason,
    shotsFired,
    shotsHit,
    kills,
    headshots,
    longestShot,
    timeSeconds,
    alarmsTriggered,
    optionalCompletedCount,
    weaponName,
  } = params;

  const accuracy = shotsFired > 0 ? Math.min(100, Math.round((shotsHit / shotsFired) * 100)) : 100;

  if (!victory) {
    // Small consolation XP on defeat so effort still counts slightly
    const consolationXp = Math.min(120, kills * 20);
    const nextXp = save.xp + consolationXp;
    const nextRank = getRankFromXp(nextXp);
    const updated: PlayerSaveData = {
      ...save,
      hasStartedGame: true,
      xp: nextXp,
      rank: nextRank,
      lifetimeStats: {
        ...save.lifetimeStats,
        totalKills: save.lifetimeStats.totalKills + kills,
        totalHeadshots: save.lifetimeStats.totalHeadshots + headshots,
        shotsFired: save.lifetimeStats.shotsFired + shotsFired,
        shotsHit: save.lifetimeStats.shotsHit + shotsHit,
        longestShotMeters: Math.max(save.lifetimeStats.longestShotMeters, longestShot),
      },
    };
    persistSaveData(updated);
    return {
      updatedSave: updated,
      summary: {
        victory: false,
        failureReason: failureReason ?? 'Mission failed.',
        mission,
        score: kills * 250 + headshots * 150,
        grade: 'C',
        shotsFired,
        shotsHit,
        accuracy,
        kills,
        headshots,
        longestShot,
        timeSeconds,
        alarmsTriggered,
        optionalCompletedCount,
        creditsEarned: 0,
        xpEarned: consolationXp,
        firstTimeBonus: false,
        newlyUnlockedWeapons: [],
        newAchievements: [],
      },
    };
  }

  // Victory scoring breakdown
  const completionPoints = 2500;
  const accuracyPoints = accuracy * 22;
  const headshotPoints = headshots * 420;
  const distancePoints = Math.round(longestShot * 6.5);
  const stealthBonus = alarmsTriggered === 0 ? 1500 : Math.max(0, 600 - alarmsTriggered * 300);
  const optionalBonus = optionalCompletedCount * 750;
  const speedBonus = Math.max(0, Math.round((180 - timeSeconds) * 8));

  const totalScore =
    completionPoints +
    accuracyPoints +
    headshotPoints +
    distancePoints +
    stealthBonus +
    optionalBonus +
    speedBonus +
    kills * 250;

  let grade: MissionGrade = 'C';
  if (totalScore >= 7600 && accuracy >= 70) grade = 'S';
  else if (totalScore >= 5900) grade = 'A';
  else if (totalScore >= 4400) grade = 'B';

  const prevRecord = save.missionRecords[mission.id];
  const isFirstCompletion = !prevRecord?.completed;
  const gradeMult = grade === 'S' ? 1.35 : grade === 'A' ? 1.18 : grade === 'B' ? 1.05 : 0.92;
  // Prevent repeated farming exploit while keeping replays worthwhile (45% stipend on repeat)
  const repeatFactor = isFirstCompletion ? 1.0 : 0.45;

  let creditsEarned = Math.round(mission.baseRewardCredits * gradeMult * repeatFactor);
  const xpEarned = Math.round(mission.baseRewardXp * gradeMult * repeatFactor);

  const prevRank = save.rank;
  const nextXp = save.xp + xpEarned;
  const nextRank = getRankFromXp(nextXp);

  // Check newly rank-eligible free notifications
  const newlyUnlockedWeapons = WEAPONS.filter(
    (w) => w.unlockRank > prevRank && w.unlockRank <= nextRank
  ).map((w) => w.name);

  const nextLifetime = {
    totalKills: save.lifetimeStats.totalKills + kills,
    totalHeadshots: save.lifetimeStats.totalHeadshots + headshots,
    shotsFired: save.lifetimeStats.shotsFired + shotsFired,
    shotsHit: save.lifetimeStats.shotsHit + shotsHit,
    longestShotMeters: Math.max(save.lifetimeStats.longestShotMeters, longestShot),
    stealthCompletions:
      save.lifetimeStats.stealthCompletions + (alarmsTriggered === 0 && mission.biome !== 'training_range' ? 1 : 0),
  };

  const nextAchievements = [...save.achievements];
  const newAchievementTitles: string[] = [];

  const grantAch = (id: string) => {
    if (!nextAchievements.includes(id)) {
      const def = ACHIEVEMENTS_LIST.find((a) => a.id === id);
      if (def) {
        nextAchievements.push(id);
        newAchievementTitles.push(def.title);
        creditsEarned += def.rewardCredits;
      }
    }
  };

  grantAch('first_blood');
  if (alarmsTriggered === 0 && mission.biome !== 'training_range') grantAch('ghost_operator');
  if (longestShot >= 195) grantAch('longshot_200');
  if (grade === 'S') grantAch('s_rank_ace');
  if (nextLifetime.totalHeadshots >= 15) grantAch('headhunter_15');
  if (save.ownedAttachments.length >= 12) grantAch('custom_gunsmith');
  if (save.unlockedWeapons.length >= 5) grantAch('arsenal_5');
  if (mission.id === 'camp_12_dead_reckoning') grantAch('meridian_fallen');

  const gradeRankValue: Record<MissionGrade, number> = { S: 4, A: 3, B: 2, C: 1 };
  const bestGrade =
    prevRecord && gradeRankValue[prevRecord.bestGrade] > gradeRankValue[grade]
      ? prevRecord.bestGrade
      : grade;

  const newEntry: HighScoreEntry = {
    id: `hs_${Date.now()}`,
    missionId: mission.id,
    missionTitle: mission.title,
    mode: mission.mode,
    score: totalScore,
    grade,
    longestShot,
    accuracy,
    headshots,
    timeSeconds: Math.round(timeSeconds),
    weaponName,
    timestamp: Date.now(),
  };

  const updatedScores = [newEntry, ...save.highScores]
    .sort((a, b) => b.score - a.score)
    .slice(0, 25);

  const updatedSave: PlayerSaveData = {
    ...save,
    hasStartedGame: true,
    rank: nextRank,
    xp: nextXp,
    credits: save.credits + creditsEarned,
    missionRecords: {
      ...save.missionRecords,
      [mission.id]: {
        completed: true,
        bestScore: Math.max(prevRecord?.bestScore ?? 0, totalScore),
        bestGrade,
        bestTimeSeconds: prevRecord
          ? Math.min(prevRecord.bestTimeSeconds, Math.round(timeSeconds))
          : Math.round(timeSeconds),
        longestShot: Math.max(prevRecord?.longestShot ?? 0, longestShot),
        timesCompleted: (prevRecord?.timesCompleted ?? 0) + 1,
      },
    },
    achievements: nextAchievements,
    highScores: updatedScores,
    lifetimeStats: nextLifetime,
  };

  persistSaveData(updatedSave);

  return {
    updatedSave,
    summary: {
      victory: true,
      mission,
      score: totalScore,
      grade,
      shotsFired,
      shotsHit,
      accuracy,
      kills,
      headshots,
      longestShot,
      timeSeconds: Math.round(timeSeconds),
      alarmsTriggered,
      optionalCompletedCount,
      creditsEarned,
      xpEarned,
      firstTimeBonus: isFirstCompletion,
      rankedUpTo: nextRank > prevRank ? nextRank : undefined,
      newlyUnlockedWeapons,
      newAchievements: newAchievementTitles,
    },
  };
}
