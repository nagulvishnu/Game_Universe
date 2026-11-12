import { useStore, pilotLevel } from '../game/store';
import { ACHIEVEMENTS, MECH_BY_ID, MISSIONS, levelFromXp } from '../game/data';
import { Btn, Bar, Panel, Screen, ScreenHeader } from './common';
import { SettingsPanel, ControlsPanel } from './Settings';
import { motion } from 'framer-motion';

export function MainMenu() {
  const go = useStore(s => s.go); const profile = useStore(s => s.profile); const launch = useStore(s => s.launch);
  const lv = levelFromXp(profile.xp); const cleared = profile.done.filter(Boolean).length; const next = Math.max(0, profile.done.findIndex(d => !d)); const mech = MECH_BY_ID[profile.selected];
  const items: [string, string, () => void, string?][] = [
    [cleared ? 'Continue Campaign' : 'Start Campaign', 'campaign', () => go('campaign'), 'amber'], ['Arena Mayhem', 'arena', () => go('arena')], ['Boss Assault', 'boss', () => go('boss')], ['Survival', 'survival', () => go('survival')], ['City Defense', 'city', () => go('city')],
    ['Hangar', 'hangar', () => go('hangar')], ['Monster Database', 'database', () => go('database')], ['Achievements', 'achievements', () => go('achievements')], ['Settings', 'settings', () => go('settings')], ['Controls', 'controls', () => go('controls')],
  ];
  return <motion.div className="absolute inset-0 z-10 flex flex-col md:flex-row justify-between p-5 md:p-10 overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -60 }}>
    <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/85 via-black/35 to-transparent pointer-events-none" />
    <div className="flex flex-col gap-4 md:w-[500px] min-h-0">
      <div><div className="h-label !text-xs mb-1">Humanity's Last Stand</div><h1 className="logo text-5xl md:text-7xl pr-4" style={{ letterSpacing: ".08em" }}>Colossus</h1><div className="text-lg md:text-2xl font-black tracking-[.45em] text-cyan-200/90 glow-text mt-1">AGE OF TITANS</div></div>
      <div className="grid gap-1.5 scrollable pr-2 min-h-0" style={{ maxHeight: 'calc(100vh - 250px)' }}>
        <Btn variant="red" onClick={() => launch({ mode: 'campaign', mission: 0, mechId: 'aegis', theme: MISSIONS[0].theme, diff: 0 })}>⚡ Quick Deploy — Mission 1</Btn>
        {items.map(([l, , f, v], i) => <motion.div key={l} initial={{ x: -40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.05 * i + 0.1 }}><Btn variant={v} onClick={f} className="w-full">{l}</Btn></motion.div>)}
      </div>
    </div>
    <div className="hidden md:flex flex-col gap-3 w-[300px] self-start">
      <Panel title="Pilot Record"><div className="grid gap-3"><div className="flex items-baseline justify-between"><span className="text-3xl font-black text-amber-300">LV {lv.level}</span><span className="text-lg font-bold text-lime-300">{profile.credits.toLocaleString()} cr</span></div>
        <Bar value={lv.into} max={lv.need} color="#ffb23a" label="Pilot XP" text={`${lv.into}/${lv.need}`} h={7} />
        <div className="text-xs opacity-80 grid grid-cols-2 gap-1"><span>Active Mech</span><span className="text-right font-bold">{mech.name}</span><span>Campaign</span><span className="text-right font-bold">{cleared}/10 {cleared < 10 ? `(next: M${next + 1})` : '✔'}</span><span>Monsters Slain</span><span className="text-right font-bold">{profile.stats.kills}</span><span>Bosses Defeated</span><span className="text-right font-bold">{Object.values(profile.bossKills).filter(v => v > 0).length}/6</span><span>Achievements</span><span className="text-right font-bold">{Object.values(profile.ach).filter(Boolean).length}/{ACHIEVEMENTS.length}</span></div></div></Panel>
      <div className="text-[.65rem] opacity-60 leading-relaxed px-1">WASD move · Mouse camera · LMB attack · RMB aim/lock · SPACE jump · SHIFT dash · Q weapon · E guard (parry!) · F special · G ultimate · T transform · TAB target</div>
    </div>
  </motion.div>;
}

export function SettingsScreen() {
  const go = useStore(s => s.go);
  return <Screen><ScreenHeader title="Settings" sub="System configuration" onBack={() => go('menu')} /><div className="scrollable flex-1 min-h-0 pb-6"><SettingsPanel /></div></Screen>;
}
export function ControlsScreen() {
  const go = useStore(s => s.go);
  return <Screen><ScreenHeader title="Controls" sub="Field manual" onBack={() => go('menu')} /><div className="scrollable flex-1 min-h-0 pb-6 grid gap-4 md:grid-cols-2 content-start">
    <Panel title="Keyboard & Mouse (click to remap)"><ControlsPanel /></Panel>
    <div className="grid gap-4 content-start"><Panel title="Combat Guide"><ul className="text-sm grid gap-2 opacity-90 list-disc pl-4"><li><b className="text-amber-300">Combos:</b> chain melee strikes — the third hit is a heavy finisher with a shock arc.</li><li><b className="text-amber-300">Parry:</b> tap GUARD just before an enemy hit lands for a devastating counterattack. Holding guard cuts damage by 75%.</li><li><b className="text-amber-300">Perfect Dodge:</b> a dash with i-frames through an attack refunds energy and slows time.</li><li><b className="text-amber-300">Weak Points:</b> glowing nodes on every kaiju take double damage. Bosses expose their core after big attacks or when staggered.</li><li><b className="text-amber-300">Telegraphs:</b> red zones show where attacks land. Jump over shockwave rings.</li><li><b className="text-amber-300">Jump Jets:</b> hold JUMP in the air to hover (uses energy). <b>Throw cars</b> by smashing them with melee.</li><li><b className="text-amber-300">Ultimate:</b> fills as you deal and take damage.</li></ul></Panel>
      <Panel title="Touch Controls"><div className="text-sm opacity-90">Left stick moves. Drag the right side of the screen to look. Dedicated buttons for fire, jump, dash, special, ultimate, weapon switch, lock-on, guard, transform and coolant vent. Button size, look sensitivity and positions are adjustable in Settings.</div></Panel></div>
  </div></Screen>;
}
export function AchievementsScreen() {
  const go = useStore(s => s.go); const ach = useStore(s => s.profile.ach); const lv = useStore(s => pilotLevel(s.profile));
  return <Screen><ScreenHeader title="Achievements" sub={`${Object.values(ach).filter(Boolean).length} / ${ACHIEVEMENTS.length} unlocked · Pilot level ${lv}`} onBack={() => go('menu')} />
    <div className="scrollable flex-1 min-h-0 grid sm:grid-cols-2 lg:grid-cols-3 gap-3 content-start pb-6">{ACHIEVEMENTS.map(a => { const u = ach[a.id]; return <Panel key={a.id} className={u ? '' : 'opacity-50'}><div className="flex items-center gap-3"><div className="text-3xl">{u ? '🏆' : '🔒'}</div><div><div className={`font-black tracking-wider ${u ? 'text-amber-300' : ''}`}>{a.name}</div><div className="text-xs opacity-80">{a.desc}</div></div></div></Panel>; })}</div></Screen>;
}
