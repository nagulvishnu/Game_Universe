import { create } from 'zustand';
import {
  loadSave, writeSave, clearSave, defaultSave, defaultLoadout, levelFromXp,
  type SaveData, type Profile, type Settings, type Loadout, type KeyBindings, type LookConfig,
} from '../save/save';
import { WEAPON_BY_ID } from '../data/weapons';
import { SKILL_BY_ID } from '../data/skills';
import { EQUIPMENT_BY_ID, type EquipSlot } from '../data/equipment';
import { ACHIEVEMENTS, type AchievementStats } from '../data/achievements';
import type { Difficulty } from '../data/fighters';
import { getBoss } from '../data/bosses';

export type Screen =
  | 'menu' | 'fight-select' | 'pvp-select' | 'training-select'
  | 'skills' | 'weapons' | 'equipment' | 'loadout' | 'profile' | 'settings'
  | 'combat' | 'results';

const SCREENS: Screen[] = [
  'menu', 'fight-select', 'pvp-select', 'training-select',
  'skills', 'weapons', 'equipment', 'loadout', 'profile', 'settings',
  'combat', 'results',
];

/** Deep link support: /?screen=weapons opens that screen directly. */
function requestedScreen(): Screen {
  try {
    const s = new URLSearchParams(window.location.search).get('screen');
    return s && (SCREENS as string[]).includes(s) ? (s as Screen) : 'menu';
  } catch {
    return 'menu';
  }
}

export type GameMode = 'fight' | 'pvp' | 'training';

export interface MatchConfig {
  mode: GameMode;
  opponentId: string;
  difficulty: Difficulty;
  arenaId: string;
  rounds: number;
  timeLimit: number;
  /** Set when the match is a boss encounter. */
  bossId?: string;
  /** training options */
  training?: {
    dummyBehavior: 'idle' | 'block' | 'walk' | 'attack';
    noCooldowns: boolean;
    showHitboxes: boolean;
    showFrameData: boolean;
    slowMotion: boolean;
    infiniteHealth: boolean;
  };
}

export interface MatchResult {
  mode: GameMode;
  winner: 'p1' | 'p2' | 'draw';
  opponentId: string;
  difficulty: Difficulty;
  damageDealt: number;
  damageTaken: number;
  highestCombo: number;
  durationMs: number;
  rounds: [number, number];
  rewards: { xp: number; shards: number; levelUps: number; unlocked: string[]; achievements: string[] };
  rewarded: boolean;
  /** Set when the match was a boss encounter. */
  bossId?: string;
}

interface GameState {
  screen: Screen;
  previousScreen: Screen;
  profile: Profile;
  settings: Settings;
  match: MatchConfig | null;
  result: MatchResult | null;
  toast: string | null;

  setScreen: (s: Screen) => void;
  back: () => void;
  showToast: (msg: string) => void;

  startMatch: (cfg: MatchConfig) => void;
  finishMatch: (r: Omit<MatchResult, 'rewards' | 'rewarded'>) => void;
  rematch: () => void;
  exitToMenu: () => void;

  // profile mutations
  updateSettings: (patch: Partial<Settings>) => void;
  setBinding: (player: 1 | 2, action: keyof KeyBindings, code: string) => void;
  resetBindings: (player: 1 | 2) => void;
  unlockWeapon: (id: string) => boolean;
  unlockSkill: (id: string) => boolean;
  upgradeSkill: (id: string) => boolean;
  unlockEquipment: (id: string) => boolean;
  equipWeapon: (id: string, who?: 'solo' | 'p1' | 'p2') => void;
  equipSkill: (slot: 0 | 1 | 2, id: string, who?: 'solo' | 'p1' | 'p2') => void;
  equipItem: (slot: EquipSlot, id: string, who?: 'solo' | 'p1' | 'p2') => void;
  saveLoadout: (name: string) => void;
  applySavedLoadout: (index: number) => void;
  deleteSavedLoadout: (index: number) => void;
  renameProfile: (name: string) => void;
  resetProfile: () => void;
  recordSkillUse: (id: string) => void;
  setLook: (patch: Partial<LookConfig>) => void;
}

function persist(profile: Profile, settings: Settings) {
  const data: SaveData = { version: 3, profile, settings, updatedAt: Date.now() };
  writeSave(data);
}

function achievementStats(p: Profile): AchievementStats {
  return {
    wins: p.stats.wins, losses: p.stats.losses, matches: p.stats.matches,
    totalDamage: p.stats.totalDamage, highestCombo: p.stats.highestCombo,
    hardWins: p.stats.hardWins, bossWins: p.stats.bossWins,
    weaponsUnlocked: p.unlockedWeapons.length, skillsUnlocked: p.unlockedSkills.length,
    skillUpgrades: p.skillUpgradesPurchased, equipmentUnlocked: p.unlockedEquipment.length,
    level: p.level, perfectWins: p.stats.perfectWins, skillsUsed: p.stats.skillsUsed,
  };
}

function loadoutFor(p: Profile, who: 'solo' | 'p1' | 'p2'): Loadout {
  return who === 'solo' ? p.loadout : who === 'p1' ? p.pvp.p1 : p.pvp.p2;
}

const initial = loadSave();

export const useGame = create<GameState>((set, get) => ({
  screen: requestedScreen(),
  previousScreen: 'menu',
  profile: initial.profile,
  settings: initial.settings,
  match: null,
  result: null,
  toast: null,

  setScreen: (s) => set((st) => ({ screen: s, previousScreen: st.screen })),
  back: () => set((st) => ({ screen: st.previousScreen === st.screen ? 'menu' : 'menu', previousScreen: 'menu' })),
  showToast: (msg) => {
    set({ toast: msg });
    window.setTimeout(() => { if (get().toast === msg) set({ toast: null }); }, 2600);
  },

  startMatch: (cfg) => set({ match: cfg, result: null, screen: 'combat' }),

  finishMatch: (r) => {
    const st = get();
    const p = { ...st.profile };
    const rewards = { xp: 0, shards: 0, levelUps: 0, unlocked: [] as string[], achievements: [] as string[] };
    const competitive = r.mode === 'fight';

    if (competitive) {
      const won = r.winner === 'p1';
      const diffMul = r.difficulty === 'hard' ? 1.6 : r.difficulty === 'medium' ? 1.15 : 0.8;
      const base = won ? 180 : 55;
      const comboBonus = Math.round(r.highestCombo * (won ? 9 : 4));
      const dmgBonus = Math.round(r.damageDealt * 0.35);
      rewards.xp = Math.round((base + comboBonus + dmgBonus * 0.5) * diffMul);
      rewards.shards = Math.round((base * 1.8 + comboBonus * 2 + dmgBonus) * diffMul);

      const before = levelFromXp(p.xp).level;
      p.xp += rewards.xp;
      p.shards += rewards.shards;
      const after = levelFromXp(p.xp);
      p.level = after.level;
      rewards.levelUps = Math.max(0, after.level - before);

      p.stats = {
        ...p.stats,
        matches: p.stats.matches + 1,
        wins: p.stats.wins + (won ? 1 : 0),
        losses: p.stats.losses + (won ? 0 : 1),
        totalDamage: p.stats.totalDamage + Math.round(r.damageDealt),
        highestCombo: Math.max(p.stats.highestCombo, r.highestCombo),
        hardWins: p.stats.hardWins + (won && r.difficulty === 'hard' ? 1 : 0),
        bossWins: p.stats.bossWins + (won && r.opponentId === 'oblivion' ? 1 : 0),
        perfectWins: p.stats.perfectWins + (won && r.damageTaken <= 0 ? 1 : 0),
        playtimeMs: p.stats.playtimeMs + r.durationMs,
      };
      p.weaponUsage = { ...p.weaponUsage, [p.loadout.weapon]: (p.weaponUsage[p.loadout.weapon] ?? 0) + 1 };

      // level-gated automatic unlocks
      const newly: string[] = [];
      for (const w of Object.values(WEAPON_BY_ID)) {
        if (w.unlock.cost === 0 && w.unlock.level <= p.level && !p.unlockedWeapons.includes(w.id)) {
          p.unlockedWeapons = [...p.unlockedWeapons, w.id];
          newly.push(`Weapon: ${w.name}`);
        }
      }
      // Boss encounter rewards — granted on a genuine player victory.
      if (r.bossId && won) {
        const boss = getBoss(r.bossId);
        if (boss) {
          p.xp += boss.rewardXp;
          p.shards += boss.rewardShards;
          rewards.xp += boss.rewardXp;
          rewards.shards += boss.rewardShards;
          if (!p.defeatedBosses.includes(boss.id)) {
            p.defeatedBosses = [...p.defeatedBosses, boss.id];
            newly.push(`Boss defeated: ${boss.name}`);
          }
        }
      }
      // achievements
      const stats = achievementStats(p);
      for (const ach of ACHIEVEMENTS) {
        if (!p.achievements.includes(ach.id) && ach.check(stats)) {
          p.achievements = [...p.achievements, ach.id];
          p.xp += ach.reward.xp;
          p.shards += ach.reward.shards;
          rewards.achievements.push(ach.name);
          newly.push(`Achievement: ${ach.name}`);
        }
      }
      const after2 = levelFromXp(p.xp);
      p.level = after2.level;
      rewards.unlocked = newly;
    } else {
      // training / local pvp: record playtime only, no competitive rewards
      p.stats = { ...p.stats, playtimeMs: p.stats.playtimeMs + r.durationMs };
    }

    persist(p, st.settings);
    set({ profile: p, result: { ...r, rewards, rewarded: competitive }, screen: 'results' });
  },

  rematch: () => {
    const m = get().match;
    if (m) set({ result: null, screen: 'combat', match: { ...m } });
  },

  exitToMenu: () => set({ screen: 'menu', match: null }),

  updateSettings: (patch) => {
    const settings = { ...get().settings, ...patch };
    persist(get().profile, settings);
    set({ settings });
  },

  setBinding: (player, action, code) => {
    const st = get();
    const key = player === 1 ? 'bindingsP1' : 'bindingsP2';
    const settings: Settings = { ...st.settings, [key]: { ...st.settings[key], [action]: code } };
    persist(st.profile, settings);
    set({ settings });
  },

  resetBindings: (player) => {
    const st = get();
    const d = defaultSave().settings;
    const settings: Settings = player === 1
      ? { ...st.settings, bindingsP1: d.bindingsP1 }
      : { ...st.settings, bindingsP2: d.bindingsP2 };
    persist(st.profile, settings);
    set({ settings });
  },

  unlockWeapon: (id) => {
    const st = get();
    const w = WEAPON_BY_ID[id];
    if (!w || st.profile.unlockedWeapons.includes(id)) return false;
    if (st.profile.level < w.unlock.level) { st.showToast(`Requires level ${w.unlock.level}`); return false; }
    if (st.profile.shards < w.unlock.cost) { st.showToast('Not enough shards'); return false; }
    const p = { ...st.profile, shards: st.profile.shards - w.unlock.cost, unlockedWeapons: [...st.profile.unlockedWeapons, id] };
    persist(p, st.settings); set({ profile: p });
    st.showToast(`Unlocked ${w.name}`);
    return true;
  },

  unlockSkill: (id) => {
    const st = get();
    const s = SKILL_BY_ID[id];
    if (!s || st.profile.unlockedSkills.includes(id)) return false;
    if (st.profile.level < s.unlock.level) { st.showToast(`Requires level ${s.unlock.level}`); return false; }
    if (st.profile.shards < s.unlock.cost) { st.showToast('Not enough shards'); return false; }
    const p = {
      ...st.profile,
      shards: st.profile.shards - s.unlock.cost,
      unlockedSkills: [...st.profile.unlockedSkills, id],
      skillLevels: { ...st.profile.skillLevels, [id]: 1 },
    };
    persist(p, st.settings); set({ profile: p });
    st.showToast(`Unlocked ${s.name}`);
    return true;
  },

  upgradeSkill: (id) => {
    const st = get();
    const s = SKILL_BY_ID[id];
    if (!s || !st.profile.unlockedSkills.includes(id)) return false;
    const cur = st.profile.skillLevels[id] ?? 1;
    if (cur >= 5) { st.showToast('Already at signature level'); return false; }
    const next = s.levels[cur];
    if (st.profile.shards < next.cost) { st.showToast('Not enough shards'); return false; }
    const p = {
      ...st.profile,
      shards: st.profile.shards - next.cost,
      skillLevels: { ...st.profile.skillLevels, [id]: cur + 1 },
      skillUpgradesPurchased: st.profile.skillUpgradesPurchased + 1,
    };
    persist(p, st.settings); set({ profile: p });
    st.showToast(`${s.name} → Lv.${cur + 1} ${next.title}`);
    return true;
  },

  unlockEquipment: (id) => {
    const st = get();
    const e = EQUIPMENT_BY_ID[id];
    if (!e || st.profile.unlockedEquipment.includes(id)) return false;
    if (st.profile.level < e.unlock.level) { st.showToast(`Requires level ${e.unlock.level}`); return false; }
    if (st.profile.shards < e.unlock.cost) { st.showToast('Not enough shards'); return false; }
    const p = { ...st.profile, shards: st.profile.shards - e.unlock.cost, unlockedEquipment: [...st.profile.unlockedEquipment, id] };
    persist(p, st.settings); set({ profile: p });
    st.showToast(`Unlocked ${e.name}`);
    return true;
  },

  equipWeapon: (id, who = 'solo') => {
    const st = get();
    if (!st.profile.unlockedWeapons.includes(id)) return;
    const p = { ...st.profile };
    const l = { ...loadoutFor(p, who), weapon: id };
    if (who === 'solo') p.loadout = l; else if (who === 'p1') p.pvp = { ...p.pvp, p1: l }; else p.pvp = { ...p.pvp, p2: l };
    persist(p, st.settings); set({ profile: p });
  },

  equipSkill: (slot, id, who = 'solo') => {
    const st = get();
    if (!st.profile.unlockedSkills.includes(id)) return;
    const p = { ...st.profile };
    const cur = loadoutFor(p, who);
    const skills = [...cur.skills] as [string, string, string];
    const existing = skills.indexOf(id);
    if (existing >= 0 && existing !== slot) skills[existing] = skills[slot];
    skills[slot] = id;
    const l = { ...cur, skills };
    if (who === 'solo') p.loadout = l; else if (who === 'p1') p.pvp = { ...p.pvp, p1: l }; else p.pvp = { ...p.pvp, p2: l };
    persist(p, st.settings); set({ profile: p });
  },

  equipItem: (slot, id, who = 'solo') => {
    const st = get();
    if (!st.profile.unlockedEquipment.includes(id)) return;
    const p = { ...st.profile };
    const cur = loadoutFor(p, who);
    const l = { ...cur, equipment: { ...cur.equipment, [slot]: id } };
    if (who === 'solo') p.loadout = l; else if (who === 'p1') p.pvp = { ...p.pvp, p1: l }; else p.pvp = { ...p.pvp, p2: l };
    persist(p, st.settings); set({ profile: p });
  },

  saveLoadout: (name) => {
    const st = get();
    const p = {
      ...st.profile,
      savedLoadouts: [...st.profile.savedLoadouts, { name: name || `Loadout ${st.profile.savedLoadouts.length + 1}`, loadout: structuredClone(st.profile.loadout) }].slice(0, 12),
    };
    persist(p, st.settings); set({ profile: p });
    st.showToast('Loadout saved');
  },

  applySavedLoadout: (index) => {
    const st = get();
    const entry = st.profile.savedLoadouts[index];
    if (!entry) return;
    const p = { ...st.profile, loadout: structuredClone(entry.loadout) };
    persist(p, st.settings); set({ profile: p });
    st.showToast(`Applied ${entry.name}`);
  },

  deleteSavedLoadout: (index) => {
    const st = get();
    const p = { ...st.profile, savedLoadouts: st.profile.savedLoadouts.filter((_, i) => i !== index) };
    persist(p, st.settings); set({ profile: p });
  },

  renameProfile: (name) => {
    const st = get();
    const p = { ...st.profile, name: name.slice(0, 14) || 'SHADOW' };
    persist(p, st.settings); set({ profile: p });
  },

  resetProfile: () => {
    clearSave();
    const fresh = defaultSave();
    set({ profile: fresh.profile, settings: fresh.settings, screen: 'menu', match: null, result: null });
    persist(fresh.profile, fresh.settings);
  },

  recordSkillUse: (id) => {
    const st = get();
    const p = {
      ...st.profile,
      skillUsage: { ...st.profile.skillUsage, [id]: (st.profile.skillUsage[id] ?? 0) + 1 },
      stats: { ...st.profile.stats, skillsUsed: st.profile.stats.skillsUsed + 1 },
    };
    set({ profile: p });
  },

  setLook: (patch) => {
    const st = get();
    const p = { ...st.profile, look: { ...st.profile.look, ...patch } };
    persist(p, st.settings);
    set({ profile: p });
  },
}));

export { defaultLoadout, levelFromXp };
