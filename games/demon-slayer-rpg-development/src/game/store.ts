import { create } from 'zustand';
import { CHAR_BY_ID, CHARACTERS, PASSIVES } from './data/characters';
import { EQUIPMENT, ITEMS, SWORDS, upgradeCost } from './data/items';
import { ALL_SKILLS } from './data/styles';
import { REGION_BY_ID } from './data/regions';
import { QUEST_BY_ID } from './data/quests';
import { defaultProfile, defaultSettings, loadProfile, newChar, saveProfile } from './save';
import { xpNeed } from './engine/stats';
import type { DialogueLine, Profile, Quest, Settings } from './types';

export type Overlay = null | 'pause' | 'menu' | 'dialogue' | 'death' | 'result' | 'loading';
export type MenuTab = 'character' | 'skills' | 'inventory' | 'smith' | 'journal' | 'corps' | 'map';
export type Cmd =
  | { type: 'travel'; region: string }
  | { type: 'quest'; id: string }
  | { type: 'abandon' }
  | { type: 'respawn' }
  | { type: 'switchChar' }
  | { type: 'useItem'; id: string }
  | { type: 'refresh' };

export interface Toast { id: number; text: string; kind: 'info' | 'good' | 'warn' | 'level' | 'quest' }
export interface DialogueState { lines: DialogueLine[]; i: number; title?: string; onDone?: () => void }
export interface ResultState { title: string; sub: string; lines: string[] }

interface Store {
  profile: Profile; saveExists: boolean; booted: boolean; screen: 'menu' | 'game'; mainPanel: null | 'chars' | 'chapters' | 'training' | 'settings' | 'credits';
  overlay: Overlay; menuTab: MenuTab; dialogue: DialogueState | null; result: ResultState | null; toasts: Toast[];
  activeQuest: { id: string; title: string; obj: string; step: number; total: number; kind: string } | null;
  cmds: Cmd[]; launch: { quest?: string; region?: string } | null; saveMsg: string; shopOpen: boolean;
  boot(): Promise<void>; toast(text: string, kind?: Toast['kind']): void; setMainPanel(p: Store['mainPanel']): void;
  newGame(): void; continueGame(): void; startQuestFromMenu(id: string): void; exitToMenu(): void;
  openMenu(tab?: MenuTab): void; closeOverlay(): void; setOverlay(o: Overlay): void; setTab(t: MenuTab): void;
  cmd(c: Cmd): void; popCmds(): Cmd[];
  say(lines: DialogueLine[], title?: string, onDone?: () => void): void; advance(): void;
  save(manual?: boolean): Promise<void>; setSettings(s: Partial<Settings>): void;
  addXp(n: number): void; addItem(id: string, n?: number): void; consume(id: string): boolean; addSen(n: number): void;
  switchChar(id: string): void; unlockSkill(id: string): boolean; equipSkill(slot: number, id: string | null): void; upgradePassive(id: string): void;
  equipSword(id: string): void; upgradeSword(id: string): boolean; buy(id: string): boolean; equipGear(slot: 'haori' | 'uniform' | 'charm', id: string | null): void;
  completeQuest(q: Quest): void; discover(id: string, xp: number): boolean; collect(id: string, kind: string): void; setActiveQuest(a: Store['activeQuest']): void;
  addKill(): void; setRegion(r: string): void; setFlag(k: string): void; setResult(r: ResultState | null): void; tick(dt: number, clock: number): void;
}

let toastId = 1;

export const useStore = create<Store>((set, get) => {
  const mut = (fn: (p: Profile) => void) => set((s) => { const p = structuredClone(s.profile); fn(p); return { profile: p }; });
  const grantUnlock = (p: Profile, id: string) => {
    if (p.unlockedChars.includes(id)) return;
    const maxL = Math.max(...p.unlockedChars.map((c) => p.chars[c].level));
    p.unlockedChars.push(id);
    p.chars[id] = newChar(id, Math.max(2, Math.round(maxL * 0.85)));
    p.equippedSword[id] = 'sw_std';
  };
  return {
    profile: defaultProfile(), saveExists: false, booted: false, screen: 'menu', mainPanel: null, overlay: null, menuTab: 'character',
    dialogue: null, result: null, toasts: [], activeQuest: null, cmds: [], launch: null, saveMsg: '', shopOpen: false,

    async boot() {
      const p = await loadProfile();
      set({ booted: true, saveExists: !!p, profile: p ?? { ...defaultProfile() } });
    },
    toast(text, kind = 'info') {
      const id = toastId++;
      set((s) => ({ toasts: [...s.toasts.slice(-4), { id, text, kind }] }));
      setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3800);
    },
    setMainPanel(p) { set({ mainPanel: p }); },
    newGame() {
      const settings = get().profile.settings;
      const p = defaultProfile(); p.settings = settings;
      set({ profile: p, screen: 'game', overlay: null, mainPanel: null, launch: { quest: 'ch1', region: 'sagiri' }, activeQuest: null, cmds: [] });
      saveProfile(p).then(() => set({ saveExists: true }));
    },
    continueGame() {
      const p = get().profile;
      set({ screen: 'game', overlay: null, mainPanel: null, launch: { region: p.region }, activeQuest: null, cmds: [] });
    },
    startQuestFromMenu(id) {
      const q = QUEST_BY_ID[id];
      if (get().screen === 'menu') {
        set({ screen: 'game', overlay: null, mainPanel: null, launch: { quest: id, region: q.region }, cmds: [] });
      } else {
        set({ overlay: null }); get().cmd({ type: 'quest', id });
      }
    },
    exitToMenu() { get().save(); set({ screen: 'menu', overlay: null, activeQuest: null, dialogue: null, mainPanel: null }); },
    openMenu(tab) { set((s) => ({ overlay: 'menu', menuTab: tab ?? s.menuTab })); },
    closeOverlay() { set({ overlay: null }); },
    setOverlay(o) { set({ overlay: o }); },
    setTab(t) { set({ menuTab: t }); },
    cmd(c) { set((s) => ({ cmds: [...s.cmds, c] })); },
    popCmds() { const c = get().cmds; if (c.length) set({ cmds: [] }); return c; },

    say(lines, title, onDone) { if (!lines.length) { onDone?.(); return; } set({ dialogue: { lines, i: 0, title, onDone }, overlay: 'dialogue' }); },
    advance() {
      const d = get().dialogue; if (!d) return;
      if (d.i + 1 < d.lines.length) set({ dialogue: { ...d, i: d.i + 1 } });
      else { set({ dialogue: null, overlay: null }); d.onDone?.(); }
    },
    async save(manual) {
      const ok = await saveProfile(get().profile);
      set({ saveExists: ok || get().saveExists, saveMsg: ok ? 'Saved' : 'Save failed' });
      if (manual) get().toast(ok ? 'Game saved.' : 'Save failed - storage unavailable.', ok ? 'good' : 'warn');
    },
    setSettings(s) { mut((p) => { p.settings = { ...p.settings, ...s }; }); saveProfile(get().profile); },

    addXp(n) {
      const before = get().profile.chars[get().profile.activeChar].level;
      mut((p) => {
        p.unlockedChars.forEach((id) => {
          const cp = p.chars[id]; cp.xp += id === p.activeChar ? n : n * 0.35;
          while (cp.level < 40 && cp.xp >= xpNeed(cp.level)) { cp.xp -= xpNeed(cp.level); cp.level++; cp.sp++; }
        });
      });
      const p = get().profile; const after = p.chars[p.activeChar].level;
      if (after > before) get().toast(`LEVEL UP! ${CHAR_BY_ID[p.activeChar].name.split(' ')[0]} reached Lv.${after}  (+${after - before} skill point)`, 'level');
    },
    addItem(id, n = 1) { mut((p) => { p.inventory[id] = (p.inventory[id] ?? 0) + n; }); },
    consume(id) {
      if ((get().profile.inventory[id] ?? 0) <= 0) return false;
      mut((p) => { p.inventory[id]--; if (p.inventory[id] <= 0) delete p.inventory[id]; });
      return true;
    },
    addSen(n) { mut((p) => { p.sen = Math.max(0, p.sen + n); }); },
    switchChar(id) {
      if (!get().profile.unlockedChars.includes(id)) return;
      mut((p) => { p.activeChar = id; });
      get().cmd({ type: 'switchChar' });
    },
    unlockSkill(id) {
      const p = get().profile; const cp = p.chars[p.activeChar]; const s = ALL_SKILLS[id];
      if (!cp || !s || cp.unlocked.includes(id) || cp.sp < s.sp || cp.level < s.level || (s.reqChapter && p.chapter < s.reqChapter)) return false;
      mut((q) => { const c = q.chars[q.activeChar]; c.sp -= s.sp; c.unlocked.push(id); const e = c.equipped.indexOf(null); if (e >= 0) c.equipped[e] = id; });
      get().toast(`Learned ${s.name}`, 'good'); return true;
    },
    equipSkill(slot, id) {
      mut((p) => { const c = p.chars[p.activeChar]; if (id) { const o = c.equipped.indexOf(id); if (o >= 0) c.equipped[o] = c.equipped[slot]; } c.equipped[slot] = id; });
    },
    upgradePassive(id) {
      const pd = PASSIVES.find((x) => x.id === id); const p = get().profile; const cp = p.chars[p.activeChar];
      if (!pd || cp.sp < 1 || (cp.passives[id] ?? 0) >= pd.max) return;
      mut((q) => { const c = q.chars[q.activeChar]; c.sp--; c.passives[id] = (c.passives[id] ?? 0) + 1; });
      get().cmd({ type: 'refresh' });
    },
    equipSword(id) { if (id in get().profile.swords) { mut((p) => { p.equippedSword[p.activeChar] = id; }); get().cmd({ type: 'refresh' }); } },
    upgradeSword(id) {
      const p = get().profile; const lvl = p.swords[id]; if (lvl === undefined || lvl >= 10) return false;
      const c = upgradeCost(lvl);
      if (p.sen < c.sen || (p.inventory.steel_shard ?? 0) < c.steel || (p.inventory.whetstone ?? 0) < c.whet) { get().toast('Not enough materials.', 'warn'); return false; }
      mut((q) => {
        q.sen -= c.sen; q.inventory.steel_shard -= c.steel; if (c.whet) q.inventory.whetstone -= c.whet;
        Object.keys(q.inventory).forEach((k) => { if (q.inventory[k] <= 0) delete q.inventory[k]; });
        q.swords[id] = lvl + 1;
      });
      get().toast(`${SWORDS[id].name} upgraded to +${lvl + 1}`, 'good'); get().cmd({ type: 'refresh' }); return true;
    },
    buy(id) {
      const p = get().profile;
      const price = ITEMS[id]?.price ?? SWORDS[id]?.price ?? EQUIPMENT[id]?.price ?? 0;
      if (p.sen < price) { get().toast('Not enough Sen.', 'warn'); return false; }
      if ((SWORDS[id] && id in p.swords) || (EQUIPMENT[id] && p.inventory[id])) { get().toast('Already owned.', 'warn'); return false; }
      mut((q) => {
        q.sen -= price;
        if (SWORDS[id]) q.swords[id] = 0; else q.inventory[id] = (q.inventory[id] ?? 0) + 1;
      });
      get().toast(`Purchased ${ITEMS[id]?.name ?? SWORDS[id]?.name ?? EQUIPMENT[id]?.name}`, 'good'); return true;
    },
    equipGear(slot, id) { mut((p) => { p.equipment[slot] = id; }); get().cmd({ type: 'refresh' }); },
    completeQuest(q) {
      const r = q.reward; const lines: string[] = [];
      const levelBefore = get().profile.chars[get().profile.activeChar].level;
      mut((p) => {
        if (q.kind === 'story' && q.chapter) p.chapter = Math.max(p.chapter, q.chapter);
        if (!p.questsDone.includes(q.id)) p.questsDone.push(q.id);
        p.sen += r.sen; p.cp += r.cp;
        p.chars[p.activeChar].sp += r.sp ?? 0;
        Object.entries(r.items ?? {}).forEach(([k, n]) => { p.inventory[k] = (p.inventory[k] ?? 0) + n; });
        (r.unlockChar ?? []).forEach((c) => grantUnlock(p, c));
        if (r.sword && !(r.sword in p.swords)) p.swords[r.sword] = 0;
        p.regions = Object.values(REGION_BY_ID).filter((x) => x.unlock <= p.chapter).map((x) => x.id);
      });
      get().addXp(r.xp);
      lines.push(`+${r.xp} EXP   +${r.sen} Sen   +${r.cp} Corps Points`);
      if (r.sp) lines.push(`+${r.sp} Skill Points`);
      Object.entries(r.items ?? {}).forEach(([k, n]) => lines.push(`${ITEMS[k]?.icon ?? '•'} ${ITEMS[k]?.name ?? k} ×${n}`));
      (r.unlockChar ?? []).forEach((c) => lines.push(`★ New playable character: ${CHAR_BY_ID[c].name}`));
      if (r.sword) lines.push(`⚔ New sword: ${SWORDS[r.sword].name}`);
      if (q.kind === 'story' && q.chapter && q.chapter < 12) {
        const nr = CHARACTERS.length && Object.values(REGION_BY_ID).filter((x) => x.unlock === q.chapter);
        if (nr) nr.forEach((x) => lines.push(`🗺 Region unlocked: ${x.name}`));
      }
      const lvl = get().profile.chars[get().profile.activeChar].level; if (lvl > levelBefore) lines.push(`Level ${lvl} reached`);
      set({ result: { title: q.kind === 'story' ? `Chapter ${q.chapter} Complete` : 'Mission Complete', sub: q.title, lines }, overlay: 'result' });
      get().save();
    },
    discover(id, xp) {
      if (get().profile.discoveries.includes(id)) return false;
      mut((p) => { p.discoveries.push(id); }); get().addXp(xp); return true;
    },
    collect(id, kind) {
      mut((p) => { if (!p.collectibles.includes(id)) p.collectibles.push(id); p.inventory[kind] = (p.inventory[kind] ?? 0) + 1; });
    },
    setActiveQuest(a) { set({ activeQuest: a }); },
    addKill() { mut((p) => { p.kills++; p.chars[p.activeChar].kills++; }); },
    setRegion(r) { mut((p) => { p.region = r; }); },
    setFlag(k) { mut((p) => { p.flags[k] = true; }); },
    setResult(r) { set({ result: r, overlay: r ? 'result' : null }); },
    tick(dt, clock) { const p = get().profile; p.playtime += dt; p.clock = clock; },
  };
});

export interface Hud {
  hp: number; maxHp: number; sta: number; maxSta: number; breath: number; maxBreath: number; ult: number; level: number; xp: number; xpNeed: number;
  cds: { id: string | null; name: string; cd: number; max: number; ok: boolean; key: string }[];
  target: { name: string; hp: number; max: number; posture: number; maxPosture: number; level: number } | null;
  boss: { name: string; title: string; hp: number; max: number; phase: string; color: number } | null;
  prompt: string | null; objective: string; combo: number; lock: { x: number; y: number } | null; region: string; time: string; fps: number;
  marks: { x: number; y: number; kind: string }[]; buffs: string[]; night: boolean; weather: string; dps: number | null; fade: number;
  cin: boolean; letter: string | null;
}
export const useHud = create<Hud>(() => ({
  hp: 100, maxHp: 100, sta: 100, maxSta: 100, breath: 100, maxBreath: 100, ult: 0, level: 1, xp: 0, xpNeed: 70, cds: [], target: null, boss: null,
  prompt: null, objective: '', combo: 0, lock: null, region: '', time: '', fps: 60, marks: [], buffs: [], night: false, weather: '', dps: null, fade: 0, cin: false, letter: null,
}));

export { defaultSettings };
