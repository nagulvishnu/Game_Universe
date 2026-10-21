import { create } from 'zustand';
import { loadSave, persistSave, defaultSave, type SaveData, levelFromXp } from './engine';
import { SHIPS, WEAPONS, ACHIEVEMENTS, type EnvId } from '../data/gameData';
import { audio } from './audio';

export type Screen = 'menu' | 'hangar' | 'arsenal' | 'campaign' | 'modes' | 'briefing' | 'playing' | 'paused' | 'complete' | 'failed' | 'settings' | 'achievements' | 'codex';
export type GamePhase = 'intro' | 'combat' | 'boss-intro' | 'victory' | 'defeat';

export interface Settings {
  quality: 'low' | 'medium' | 'high';
  sensitivity: number; invertY: boolean;
  masterVol: number; musicVol: number; sfxVol: number; uiVol: number;
  cameraShake: number; screenEffects: boolean; showFps: boolean;
}

export interface MissionConfig {
  kind: 'campaign' | 'quick' | 'survival' | 'endless' | 'bossrush' | 'timeattack' | 'escort' | 'defense' | 'asteroid';
  missionId?: number; name: string; env: EnvId;
  type: 'destroy' | 'boss' | 'escort' | 'defense' | 'survival-time' | 'asteroid';
  killTarget: number; timeLimit: number; bossId?: string; waves: number; difficulty: number;
  objectiveText: string; reward: number; xp: number;
}

export interface HudMarker { id: number; x: number; y: number; dist: number; frac: number; shieldFrac: number; isBoss: boolean; offscreen: boolean; name: string; locked: boolean; isAlly: boolean; }

export interface HudState {
  hull: number; maxHull: number; shield: number; maxShield: number;
  speed: number; boost: number; energy: number; maxEnergy: number;
  ult: number; abilityCd: number; abilityMax: number; abilityName: string;
  primaryName: string; secondaryName: string; ammo: number; charge: number;
  kills: number; score: number; wave: number; enemiesLeft: number;
  objectiveProgress: string; timeLeft: number; elapsed: number;
  bossName: string; bossFrac: number; bossShieldFrac: number; bossPhase: number;
  allyFrac: number; allyName: string;
  lockProgress: number; lockName: string; missileWarning: boolean;
  hitmarker: number; damageFlash: number; markers: HudMarker[];
  notifications: { id: number; text: string; color: string }[];
  dialogue: { speaker: string; text: string } | null;
  fps: number; combo: number;
}

const defaultHud: HudState = {
  hull: 100, maxHull: 100, shield: 50, maxShield: 50, speed: 0, boost: 100, energy: 100, maxEnergy: 100,
  ult: 0, abilityCd: 0, abilityMax: 20, abilityName: '', primaryName: '', secondaryName: '', ammo: -1, charge: 0,
  kills: 0, score: 0, wave: 1, enemiesLeft: 0, objectiveProgress: '', timeLeft: 0, elapsed: 0,
  bossName: '', bossFrac: 0, bossShieldFrac: 0, bossPhase: 0, allyFrac: -1, allyName: '',
  lockProgress: 0, lockName: '', missileWarning: false, hitmarker: 0, damageFlash: 0, markers: [],
  notifications: [], dialogue: null, fps: 60, combo: 0,
};

export interface MissionResult {
  success: boolean; kills: number; score: number; time: number; accuracy: number;
  creditsEarned: number; xpEarned: number; grade: string; points: number; bossKilled: boolean;
  newAchievements: string[]; hullFrac: number;
}

interface Store {
  screen: Screen; prevScreen: Screen;
  save: SaveData;
  settings: Settings;
  config: MissionConfig | null;
  hud: HudState;
  result: MissionResult | null;
  gameKey: number;
  paused: boolean;
  selectedMission: number;
  toast: string;
  settingsFromPause: boolean;
  setSettingsFromPause: (v: boolean) => void;
  setScreen: (s: Screen) => void;
  startMission: (c: MissionConfig) => void;
  setPaused: (p: boolean) => void;
  setHud: (h: Partial<HudState>) => void;
  pushNotification: (text: string, color?: string) => void;
  setDialogue: (d: HudState['dialogue']) => void;
  finishMission: (r: MissionResult) => void;
  updateSave: (fn: (s: SaveData) => SaveData) => void;
  buyShip: (id: string) => void;
  selectShip: (id: string) => void;
  buyWeapon: (id: string) => void;
  equipWeapon: (id: string) => void;
  buyUpgrade: (id: string, cost: number, max: number) => void;
  setSettings: (s: Partial<Settings>) => void;
  resetSave: () => void;
  setToast: (t: string) => void;
  setSelectedMission: (id: number) => void;
}

const SETTINGS_KEY = 'starfall-settings';
function loadSettings(): Settings {
  const def: Settings = { quality: 'high', sensitivity: 1, invertY: false, masterVol: 0.8, musicVol: 0.5, sfxVol: 0.85, uiVol: 0.6, cameraShake: 0.7, screenEffects: true, showFps: false };
  try { return { ...def, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; } catch { return def; }
}

let notifId = 0;

export const useStore = create<Store>((set, get) => ({
  screen: 'menu', prevScreen: 'menu',
  save: loadSave(),
  settings: loadSettings(),
  config: null, hud: defaultHud, result: null, gameKey: 0, paused: false,
  selectedMission: 1, toast: '', settingsFromPause: false,
  setSettingsFromPause: (v) => set({ settingsFromPause: v }),

  setScreen: (s) => set(st => ({ prevScreen: st.screen, screen: s })),
  setSelectedMission: (id) => set({ selectedMission: id }),
  setToast: (t) => { set({ toast: t }); if (t) setTimeout(() => set({ toast: '' }), 2800); },

  startMission: (c) => set(st => ({ config: c, screen: 'playing', paused: false, hud: { ...defaultHud }, result: null, gameKey: st.gameKey + 1 })),
  setPaused: (p) => set({ paused: p, screen: p ? 'paused' : 'playing' }),
  setHud: (h) => set(st => ({ hud: { ...st.hud, ...h } })),
  pushNotification: (text, color = '#38bdf8') => {
    const id = ++notifId;
    set(st => ({ hud: { ...st.hud, notifications: [...st.hud.notifications.slice(-4), { id, text, color }] } }));
    setTimeout(() => set(st => ({ hud: { ...st.hud, notifications: st.hud.notifications.filter(n => n.id !== id) } })), 3400);
  },
  setDialogue: (d) => set(st => ({ hud: { ...st.hud, dialogue: d } })),

  updateSave: (fn) => {
    const next = fn(get().save);
    persistSave(next);
    set({ save: next });
  },

  finishMission: (r) => {
    const st = get();
    if (st.screen !== 'playing' && st.screen !== 'paused') return;
    const cfg = st.config;
    const newAch: string[] = [];
    st.updateSave(s => {
      const stats = { ...s.stats };
      stats.totalKills += r.kills;
      if (r.bossKilled) stats.bossKills += 1;
      stats.lifetimeCredits += Math.max(0, r.creditsEarned);
      stats.shipsOwned = s.ownedShips.length;
      if (!r.success) stats.deaths += 1;
      stats.playTime += Math.round(r.time);
      if (cfg?.kind === 'survival') stats.bestSurvivalWave = Math.max(stats.bestSurvivalWave, st.hud.wave);
      let completed = s.completedMissions;
      let ratings = s.missionRatings;
      if (r.success && cfg?.kind === 'campaign' && cfg.missionId) {
        completed = [...new Set([...completed, cfg.missionId])];
        ratings = { ...ratings, [cfg.missionId]: r.grade };
        stats.missionsDone = completed.length;
      }
      let ach = s.achievements; let bonus = 0;
      const probe: SaveData = { ...s, stats, completedMissions: completed };
      for (const a of ACHIEVEMENTS) {
        if (!ach.includes(a.id) && (probe.stats[a.stat] ?? 0) >= a.target) { ach = [...ach, a.id]; bonus += a.reward; newAch.push(a.name); }
      }
      return { ...s, stats, completedMissions: completed, missionRatings: ratings, achievements: ach, credits: s.credits + Math.max(0, r.creditsEarned) + bonus, totalXp: s.totalXp + Math.max(0, r.xpEarned) };
    });
    set({ result: { ...r, newAchievements: newAch }, screen: r.success ? 'complete' : 'failed', paused: false });
  },

  buyShip: (id) => {
    const s = get().save; const ship = SHIPS.find(x => x.id === id);
    if (!ship || s.ownedShips.includes(id) || s.credits < ship.cost) { audio.denied(); return; }
    audio.buy();
    get().updateSave(prev => ({ ...prev, credits: prev.credits - ship.cost, ownedShips: [...prev.ownedShips, id], selectedShip: id, stats: { ...prev.stats, shipsOwned: prev.ownedShips.length + 1 } }));
    get().setToast(`${ship.name} acquired and deployed.`);
  },
  selectShip: (id) => { audio.click(); get().updateSave(prev => ({ ...prev, selectedShip: id })); },
  buyWeapon: (id) => {
    const s = get().save; const w = WEAPONS.find(x => x.id === id);
    if (!w || s.ownedWeapons.includes(id) || s.credits < w.cost) { audio.denied(); return; }
    audio.buy();
    get().updateSave(prev => ({ ...prev, credits: prev.credits - w.cost, ownedWeapons: [...prev.ownedWeapons, id], ...(w.slot === 'primary' ? { primaryId: id } : { secondaryId: id }) }));
    get().setToast(`${w.name} installed.`);
  },
  equipWeapon: (id) => {
    const w = WEAPONS.find(x => x.id === id); if (!w) return;
    audio.click();
    get().updateSave(prev => ({ ...prev, ...(w.slot === 'primary' ? { primaryId: id } : { secondaryId: id }) }));
  },
  buyUpgrade: (id, cost, max) => {
    const s = get().save; const lvl = s.upgrades[id] ?? 0;
    if (lvl >= max || s.credits < cost) { audio.denied(); return; }
    audio.buy();
    get().updateSave(prev => ({ ...prev, credits: prev.credits - cost, upgrades: { ...prev.upgrades, [id]: lvl + 1 } }));
  },
  setSettings: (s) => {
    const next = { ...get().settings, ...s };
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch { /* noop */ }
    audio.setVolumes({ master: next.masterVol, music: next.musicVol, sfx: next.sfxVol, ui: next.uiVol });
    set({ settings: next });
  },
  resetSave: () => { const d = defaultSave(); persistSave(d); set({ save: d }); get().setToast('Save data wiped. Fresh start, pilot.'); },
}));

export function pilotLevel(save: SaveData) { return levelFromXp(save.totalXp); }

/** Effective ship stats after upgrades */
export function effectiveStats(save: SaveData) {
  const ship = SHIPS.find(s => s.id === save.selectedShip) ?? SHIPS[0];
  const u = save.upgrades;
  return {
    ship,
    hull: Math.round(ship.hull * (1 + 0.12 * (u.hull ?? 0))),
    shield: Math.round(ship.shield * (1 + 0.12 * (u.shield ?? 0))),
    armor: ship.armor + 2 * (u.armor ?? 0),
    speed: ship.speed * (1 + 0.05 * (u.engine ?? 0)),
    accel: ship.accel * (1 + 0.05 * (u.engine ?? 0)),
    maneuver: ship.maneuver,
    damageMult: ship.damage * (1 + 0.07 * (u.damage ?? 0)),
    energy: ship.energy * (1 + 0.10 * (u.energy ?? 0)),
    boost: ship.boost * (1 + 0.10 * (u.boost ?? 0)),
    abilityCdMult: Math.pow(0.92, u.ability ?? 0),
  };
}
