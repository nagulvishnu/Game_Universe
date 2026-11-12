import { create } from 'zustand';
import type { CharId, DialogueLine, Rewards } from './types';
import { DEFAULT_BINDINGS, type Action } from './config';
import { defaultProfile, type Profile } from './logic/profile';
import { addXp, computeStats, MAX_LEVEL } from './logic/stats';
import { CHARACTERS } from './data/characters';
import { ITEMS, slotOf, upgradeCost, MAX_UPGRADE } from './data/items';
import { SKILLS } from './data/abilities';
import { bus } from './bus';
import { pushToast } from './hudStore';

export type Overlay =
  | null | 'pause' | 'inventory' | 'status' | 'skills' | 'map' | 'missions' | 'characters' | 'settings'
  | 'save' | 'shop' | 'dialogue' | 'gameover' | 'credits' | 'load' | 'controls';

export interface Settings {
  master: number; music: number; sfx: number; ambience: number;
  graphics: 'low' | 'medium' | 'high'; sensitivity: number; invertY: boolean; showFps: boolean; shake: number;
  bindings: Record<Action, string>;
}
export const DEFAULT_SETTINGS: Settings = {
  master: 0.7, music: 0.55, sfx: 0.8, ambience: 0.5, graphics: 'medium', sensitivity: 1, invertY: false, showFps: false, shake: 1,
  bindings: { ...DEFAULT_BINDINGS },
};
const SKEY = 'shinobi-legacy:settings';
export function loadSettings(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(SKEY) || 'null');
    if (!raw || typeof raw !== 'object') return { ...DEFAULT_SETTINGS, bindings: { ...DEFAULT_BINDINGS } };
    const n = (v: unknown, d: number, lo: number, hi: number) => (typeof v === 'number' && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
    const b: Record<string, string> = { ...DEFAULT_BINDINGS };
    if (raw.bindings && typeof raw.bindings === 'object') for (const a in DEFAULT_BINDINGS) if (typeof raw.bindings[a] === 'string') b[a] = raw.bindings[a];
    return {
      master: n(raw.master, 0.7, 0, 1), music: n(raw.music, 0.55, 0, 1), sfx: n(raw.sfx, 0.8, 0, 1), ambience: n(raw.ambience, 0.5, 0, 1),
      graphics: ['low', 'medium', 'high'].includes(raw.graphics) ? raw.graphics : 'medium', sensitivity: n(raw.sensitivity, 1, 0.2, 3),
      invertY: !!raw.invertY, showFps: !!raw.showFps, shake: n(raw.shake, 1, 0, 1.5), bindings: b as Record<Action, string>,
    };
  } catch { return { ...DEFAULT_SETTINGS, bindings: { ...DEFAULT_BINDINGS } }; }
}

export interface DialogueState {
  lines: DialogueLine[]; idx: number; choices?: { label: string; action: () => void }[]; onEnd?: () => void;
}

interface GameState {
  screen: 'menu' | 'playing'; overlay: Overlay; session: number; menuPanel: null | 'load' | 'settings' | 'credits' | 'characters';
  profile: Profile; settings: Settings; dialogue: DialogueState | null; shopItems: string[]; shopName: string;
  setScreen: (s: 'menu' | 'playing') => void; setOverlay: (o: Overlay) => void; setMenuPanel: (p: GameState['menuPanel']) => void;
  newSession: () => void; setProfile: (p: Profile) => void; patchProfile: (fn: (p: Profile) => Partial<Profile>) => void;
  gainXp: (n: number, silent?: boolean) => void; addItem: (id: string, n?: number, silent?: boolean) => void; removeItem: (id: string, n?: number) => boolean;
  useItem: (id: string) => boolean; equip: (id: string) => void; unequip: (slot: 'weapon' | 'armor' | 'accessory') => void;
  buySkill: (id: string) => boolean; setEquipped: (slot: number, id: string) => void; buy: (id: string) => boolean; sell: (id: string) => void;
  upgradeItem: (id: string) => boolean; grantRewards: (r: Rewards) => void; selectCharacter: (id: CharId) => void; unlockChar: (id: CharId) => void;
  markCollected: (id: string) => void; setFlag: (f: string) => void;
  updateSettings: (p: Partial<Settings>) => void; rebind: (a: Action, code: string) => void; resetBindings: () => void;
  openDialogue: (lines: DialogueLine[], opts?: { choices?: DialogueState['choices']; onEnd?: () => void }) => void; advanceDialogue: () => void;
  openShop: (name: string, items: string[]) => void;
}

export const useGame = create<GameState>((set, get) => ({
  screen: 'menu', overlay: null, session: 0, menuPanel: null, profile: defaultProfile(), settings: loadSettings(), dialogue: null, shopItems: [], shopName: '',
  setScreen: (screen) => set({ screen, overlay: null, menuPanel: null }),
  setOverlay: (overlay) => set({ overlay }),
  setMenuPanel: (menuPanel) => set({ menuPanel }),
  newSession: () => set((s) => ({ session: s.session + 1, dialogue: null })),
  setProfile: (profile) => set({ profile }),
  patchProfile: (fn) => set((s) => ({ profile: { ...s.profile, ...fn(s.profile) } })),

  gainXp: (n, silent) => {
    const p = get().profile;
    const next = { ...p.chars };
    let leveled = 0, lv = 1;
    for (const id of p.unlocked) {
      const c = p.chars[id]; const amt = id === p.charId ? n : Math.floor(n * 0.5);
      const r = addXp(c.level, c.xp, amt);
      next[id] = { ...c, level: r.level, xp: r.xp, sp: c.sp + r.gained };
      if (id === p.charId) { leveled = r.gained; lv = r.level; }
    }
    set({ profile: { ...p, chars: next } });
    if (!silent && n > 0) pushToast(`+${n} XP`, 'info', 1800);
    if (leveled > 0) { pushToast(`LEVEL UP! Level ${lv} — +${leveled} skill point${leveled > 1 ? 's' : ''}`, 'level', 5000); bus.emit('levelup', { level: lv }); }
    else bus.emit('statsChanged');
  },
  addItem: (id, n = 1, silent) => {
    if (!ITEMS[id]) return;
    set((s) => ({ profile: { ...s.profile, inventory: { ...s.profile.inventory, [id]: (s.profile.inventory[id] ?? 0) + n } } }));
    if (!silent) pushToast(`${ITEMS[id].icon} ${ITEMS[id].name} ×${n}`, 'loot', 2600);
  },
  removeItem: (id, n = 1) => {
    const have = get().profile.inventory[id] ?? 0; if (have < n) return false;
    set((s) => {
      const inv = { ...s.profile.inventory }; inv[id] = have - n; if (inv[id] <= 0) delete inv[id];
      return { profile: { ...s.profile, inventory: inv } };
    });
    return true;
  },
  useItem: (id) => {
    const it = ITEMS[id]; if (!it?.use || (get().profile.inventory[id] ?? 0) < 1) return false;
    if (!get().removeItem(id, 1)) return false;
    if (it.use.xp) get().gainXp(it.use.xp);
    bus.emit('useItem', it.use);
    pushToast(`Used ${it.name}`, 'good', 1600);
    return true;
  },
  equip: (id) => {
    const slot = slotOf(id); const p = get().profile;
    if (!slot || (p.inventory[id] ?? 0) < 1) return;
    set({ profile: { ...p, equipment: { ...p.equipment, [slot]: id } } }); bus.emit('statsChanged');
  },
  unequip: (slot) => { set((s) => ({ profile: { ...s.profile, equipment: { ...s.profile.equipment, [slot]: null } } })); bus.emit('statsChanged'); },
  buySkill: (id) => {
    const p = get().profile; const n = SKILLS[id]; const c = p.chars[p.charId];
    if (!n || c.skills.includes(id) || c.sp < n.cost || c.level < n.minLevel || (n.requires && !c.skills.includes(n.requires))) return false;
    if ((id === 'trf1' || id === 'trf3' || id === 'trf2' || id === 'trf4') && p.charId !== 'naruto') return false;
    set({ profile: { ...p, chars: { ...p.chars, [p.charId]: { ...c, sp: c.sp - n.cost, skills: [...c.skills, id] } } } });
    bus.emit('statsChanged'); pushToast(`Learned ${n.name}`, 'good'); return true;
  },
  setEquipped: (slot, id) => {
    const p = get().profile; const c = p.chars[p.charId];
    if (!CHARACTERS[p.charId].abilities.includes(id)) return;
    const eq = c.equipped.slice(); const old = eq.indexOf(id);
    if (old >= 0) eq[old] = eq[slot]; eq[slot] = id;
    set({ profile: { ...p, chars: { ...p.chars, [p.charId]: { ...c, equipped: eq } } } });
  },
  buy: (id) => {
    const it = ITEMS[id]; const p = get().profile; if (!it || p.ryo < it.price) return false;
    set({ profile: { ...p, ryo: p.ryo - it.price } }); get().addItem(id, 1, true); return true;
  },
  sell: (id) => {
    const it = ITEMS[id]; if (!it || !get().removeItem(id, 1)) return;
    const p = get().profile;
    if (p.equipment.weapon === id || p.equipment.armor === id || p.equipment.accessory === id) { if ((p.inventory[id] ?? 0) < 1) { /* keep equipped */ get().addItem(id, 1, true); return; } }
    set((s) => ({ profile: { ...s.profile, ryo: s.profile.ryo + Math.floor(it.price * 0.4) } }));
  },
  upgradeItem: (id) => {
    const p = get().profile; const lv = p.upgrades[id] ?? 0; const it = ITEMS[id];
    if (!it || !slotOf(id) || lv >= MAX_UPGRADE || (p.inventory[id] ?? 0) < 1) return false;
    const c = upgradeCost(lv);
    if (p.ryo < c.ryo || (p.inventory.ironScrap ?? 0) < c.scrap || (p.inventory.chakraCrystal ?? 0) < c.crystal) return false;
    get().removeItem('ironScrap', c.scrap); if (c.crystal) get().removeItem('chakraCrystal', c.crystal);
    set((s) => ({ profile: { ...s.profile, ryo: s.profile.ryo - c.ryo, upgrades: { ...s.profile.upgrades, [id]: lv + 1 } } }));
    bus.emit('statsChanged'); pushToast(`${it.name} upgraded to +${lv + 1}`, 'good'); return true;
  },
  grantRewards: (r) => {
    const p = get().profile;
    const st = computeStats(CHARACTERS[p.charId], p.chars[p.charId].level, p.chars[p.charId].skills, p.equipment, p.upgrades);
    const ryo = Math.round(r.ryo * st.ryoMul);
    set((s) => ({ profile: { ...s.profile, ryo: s.profile.ryo + ryo } }));
    if (ryo) pushToast(`+${ryo} Ryo`, 'loot', 2400);
    r.items?.forEach(([id, n]) => get().addItem(id, n));
    if (r.flag) get().setFlag(r.flag);
    r.unlockChars?.forEach((c) => get().unlockChar(c));
    if (r.rankNote) pushToast(r.rankNote, 'level', 5000);
    if (r.xp) get().gainXp(r.xp);
  },
  selectCharacter: (id) => {
    const p = get().profile; if (!p.unlocked.includes(id)) return;
    set({ profile: { ...p, charId: id } }); bus.emit('charChanged', id);
  },
  unlockChar: (id) => {
    const p = get().profile; if (p.unlocked.includes(id)) return;
    const lvl = Math.max(1, Math.min(MAX_LEVEL, Math.floor(p.chars.naruto.level * 0.85)));
    const c = p.chars[id];
    set({ profile: { ...p, unlocked: [...p.unlocked, id], chars: { ...p.chars, [id]: { ...c, level: lvl, sp: Math.max(0, lvl - 1) } } } });
    pushToast(`${CHARACTERS[id].name} is now playable! (Tab → Characters)`, 'level', 6000);
  },
  markCollected: (id) => set((s) => (s.profile.collected.includes(id) ? s : { profile: { ...s.profile, collected: [...s.profile.collected, id] } })),
  setFlag: (f) => set((s) => ({ profile: { ...s.profile, flags: { ...s.profile.flags, [f]: true } } })),
  updateSettings: (patch) => {
    const settings = { ...get().settings, ...patch }; set({ settings });
    try { localStorage.setItem(SKEY, JSON.stringify(settings)); } catch { /* ignore */ }
    bus.emit('settings');
  },
  rebind: (a, code) => {
    const b = { ...get().settings.bindings };
    for (const k in b) if (b[k as Action] === code && k !== a) b[k as Action] = b[a];
    b[a] = code; get().updateSettings({ bindings: b });
  },
  resetBindings: () => get().updateSettings({ bindings: { ...DEFAULT_BINDINGS } }),
  openDialogue: (lines, opts) => {
    if (!lines.length) { opts?.onEnd?.(); return; }
    set({ dialogue: { lines, idx: 0, choices: opts?.choices, onEnd: opts?.onEnd }, overlay: 'dialogue' });
  },
  advanceDialogue: () => {
    const d = get().dialogue; if (!d) return;
    if (d.idx < d.lines.length - 1) { set({ dialogue: { ...d, idx: d.idx + 1 } }); return; }
    if (d.choices) return; // waiting for a choice
    set({ dialogue: null, overlay: null }); d.onEnd?.();
  },
  openShop: (shopName, shopItems) => set({ shopName, shopItems, overlay: 'shop' }),
}));

// Persist settings on first use is handled in updateSettings; expose helper for dialogue choices
export function finishDialogue(after?: () => void) {
  useGame.setState({ dialogue: null, overlay: null }); after?.();
}
