import { useState } from 'react';
import { useStore, missionUnlocked, bossUnlocked, isMechUnlocked, type LaunchCfg } from '../game/store';
import { MISSIONS, MECH_BY_ID, MONSTERS, BOSS_LIST, ALL_MONSTERS, THEME_LIST, THEMES, DIFFICULTIES } from '../game/data';
import { Btn, Panel, Screen, ScreenHeader, MechCards, fmtTime, click } from './common';
import { ModelViewer } from '../game/Scene';

const ATK_NAMES: Record<string, string> = { melee: 'Claw Strike', slam: 'Ground Slam', sweep: 'Sweeping Strike', charge: 'Charge', leap: 'Pounce', spit: 'Projectile Spit', volley: 'Energy Volley', breath: 'Elemental Breath', beam: 'Annihilation Beam', bolts: 'Strike Barrage', wave: 'Shockwave', burrow: 'Burrow Ambush', dive: 'Dive Bomb', summon: 'Summon Minions', pulse: 'Pulse Burst' };

function DiffPicker({ v, onChange }: { v: number; onChange: (n: number) => void }) {
  return <div className="flex gap-2 flex-wrap">{DIFFICULTIES.map(d => <Btn key={d.id} sm variant={v === d.id ? 'amber' : ''} onClick={() => onChange(d.id)}>{d.name} <span className="opacity-60">×{d.reward}</span></Btn>)}</div>;
}
function Stars({ n }: { n: number }) { return <span className="text-amber-300">{'★'.repeat(n)}<span className="opacity-30">{'★'.repeat(5 - n)}</span></span>; }

export function CampaignScreen() {
  const go = useStore(s => s.go); const profile = useStore(s => s.profile); const launch = useStore(s => s.launch); const select = useStore(s => s.select);
  const first = Math.max(0, profile.done.findIndex(d => !d)); const [sel, setSel] = useState(first < 0 ? 0 : first); const [diff, setDiff] = useState(0); const m = MISSIONS[sel]; const unlocked = missionUnlocked(profile, sel); const th = THEMES[m.theme];
  const mech = isMechUnlocked(profile, MECH_BY_ID[profile.selected]) ? profile.selected : 'aegis';
  return <Screen><ScreenHeader title="Campaign" sub="The Titan War" onBack={() => go('menu')} />
    <div className="flex-1 min-h-0 grid md:grid-cols-[300px_1fr] gap-4">
      <div className="scrollable grid gap-2 content-start pr-1 max-h-[34vh] md:max-h-none">{MISSIONS.map((x, i) => { const un = missionUnlocked(profile, i); return <div key={x.id} data-ui onClick={() => { click(); setSel(i); }} className={`card panel cut-sm p-3 ${sel === i ? 'sel' : ''} ${un ? '' : 'locked'}`}><div className="flex items-center justify-between"><span className="h-label">MISSION {String(x.id).padStart(2, '0')}</span><span className="text-xs">{profile.done[i] ? '✔ CLEARED' : un ? '● READY' : '🔒'}</span></div><div className="font-black tracking-wider">{x.name}</div><div className="text-[.65rem] opacity-60">{THEMES[x.theme].name.split('—')[0]}{x.boss ? ' · BOSS' : ''}</div></div>; })}</div>
      <div className="scrollable min-h-0 grid gap-3 content-start pb-4">
        <Panel title={`Mission ${m.id} — ${th.name}`}>
          <h3 className="text-3xl font-black tracking-widest glow-text">{m.name}</h3><p className="text-sm mt-2 opacity-90">{m.brief}</p><p className="text-sm mt-2 italic text-cyan-200/90">{m.story}</p>
          <div className="grid sm:grid-cols-2 gap-3 mt-3 text-sm"><div><div className="h-label">Objective</div><div className="font-bold">{m.obj}</div><div className="h-label mt-2">Hostiles</div><div className="text-xs opacity-90">{m.waves.map((w, i) => <div key={i}>Wave {i + 1}: {w.map(id => MONSTERS[id].name).join(', ')}</div>)}{m.boss && <div className="text-red-300 font-bold">BOSS: {MONSTERS[m.boss].name}</div>}</div></div>
            <div><div className="h-label">Rewards</div><div className="font-bold text-lime-300">{m.reward.credits.toLocaleString()} credits · {m.reward.xp} XP</div><div className="h-label mt-2">Bonus Objective</div><div className="text-amber-300 font-bold">{m.bonus.desc}</div>{m.unlocks && <><div className="h-label mt-2">Unlocks</div><div className="font-bold">{m.unlocks === 'VICTORY' ? 'Campaign completion' : m.unlocks}</div></>}</div></div>
        </Panel>
        <Panel title="Difficulty"><DiffPicker v={diff} onChange={setDiff} /></Panel>
        <Panel title={`Select Mech — ${MECH_BY_ID[mech].name}`}><MechCards compact selected={mech} onSelect={select} /></Panel>
        <div className="flex gap-3 flex-wrap"><Btn variant="amber" disabled={!unlocked} onClick={() => launch({ mode: 'campaign', mission: sel, mechId: mech, theme: m.theme, diff })}>▶ Deploy to Mission {m.id}</Btn>{!unlocked && <span className="self-center text-sm text-red-300">Complete mission {m.id - 1} first.</span>}<Btn onClick={() => go('hangar')}>Hangar</Btn></div>
      </div>
    </div></Screen>;
}

const MODE_INFO: Record<string, { title: string; sub: string; desc: string; themes: string[] }> = {
  arena: { title: 'Arena Mayhem', sub: 'Endless Waves', desc: 'Fight multiple monsters at once in a large arena. Waves grow harder, and every fifth wave brings a boss. Rewards scale with how far you survive.', themes: THEME_LIST.map(t => t.id) },
  survival: { title: 'Survival', sub: 'Hold The Line', desc: 'Defend the energy beacon from endless waves. Monsters target the beacon and you. Pick a powerful upgrade between waves. Lose the beacon and the run ends.', themes: THEME_LIST.map(t => t.id) },
  city: { title: 'City Defense', sub: 'Protect Neo Meridian', desc: 'Eight waves of kaiju descend on the city. Their attacks destroy buildings — keep city integrity above 35% to win. Your own heavy weapons deal reduced collateral damage.', themes: ['city', 'harbor', 'megacity', 'snow'] },
  boss: { title: 'Boss Assault', sub: 'One Titan. One Pilot.', desc: 'Challenge any unlocked boss in its own arena. Bosses have multiple phases, exposed weak points and environmental hazards.', themes: [] },
};
export function LaunchScreen({ mode }: { mode: 'arena' | 'survival' | 'city' | 'boss' }) {
  const go = useStore(s => s.go); const profile = useStore(s => s.profile); const launch = useStore(s => s.launch); const select = useStore(s => s.select); const info = MODE_INFO[mode];
  const [theme, setTheme] = useState(info.themes[0] || 'city'); const [diff, setDiff] = useState(0); const [boss, setBoss] = useState('abyssalrex'); const mech = isMechUnlocked(profile, MECH_BY_ID[profile.selected]) ? profile.selected : 'aegis';
  const best = mode === 'arena' ? profile.best.arena : mode === 'survival' ? profile.best.survival : mode === 'city' ? profile.best.city : 0; const bdef = MONSTERS[boss];
  const go2 = () => { const cfg: LaunchCfg = { mode, mechId: mech, theme: mode === 'boss' ? bdef.theme! : theme, diff, boss: mode === 'boss' ? boss : undefined }; launch(cfg); };
  return <Screen><ScreenHeader title={info.title} sub={info.sub} onBack={() => go('menu')} />
    <div className="flex-1 min-h-0 grid lg:grid-cols-[1fr_380px] gap-4"><div className="scrollable min-h-0 grid gap-3 content-start pb-4">
      <Panel title="Briefing"><p className="text-sm opacity-90">{info.desc}</p>{mode !== 'boss' && <p className="text-xs mt-2 text-amber-300">Best: {mode === 'city' ? `${best} wave${best === 1 ? '' : 's'} cleared` : `wave ${best}`}</p>}</Panel>
      {mode === 'boss' ? <Panel title="Select Boss"><div className="grid sm:grid-cols-2 gap-2">{BOSS_LIST.map(b => { const un = bossUnlocked(profile, b.id); return <div key={b.id} data-ui className={`card panel cut-sm p-3 ${boss === b.id ? 'sel' : ''} ${un ? '' : 'locked'}`} onClick={() => { click(); if (un) setBoss(b.id); }}><div className="font-black tracking-widest">{un ? '' : '🔒 '}{b.name}</div><div className="text-xs opacity-70">{un ? b.sub : `Reach mission ${MISSIONS.findIndex(x => x.boss === b.id) + 1} in the Campaign`}</div>{un && <div className="text-[.65rem] mt-1 text-amber-300">Defeated ×{profile.bossKills[b.id] || 0} · Arena: {THEMES[b.theme!].name.split('—')[0]}</div>}</div>; })}</div></Panel>
        : <Panel title="Environment"><div className="grid sm:grid-cols-2 gap-2">{info.themes.map(id => <div key={id} data-ui className={`card panel cut-sm p-3 ${theme === id ? 'sel' : ''}`} onClick={() => { click(); setTheme(id); }}><div className="flex gap-2 items-center"><div className="w-10 h-10 shrink-0" style={{ background: `linear-gradient(${THEMES[id].sky[1]}, ${THEMES[id].ground})` }} /><div><div className="font-black text-sm">{THEMES[id].name}</div><div className="text-[.65rem] opacity-70">{THEMES[id].desc}</div></div></div></div>)}</div></Panel>}
      <Panel title="Difficulty"><DiffPicker v={diff} onChange={setDiff} /></Panel>
      <Panel title={`Select Mech — ${MECH_BY_ID[mech].name}`}><MechCards compact selected={mech} onSelect={select} /></Panel>
      <div className="flex gap-3"><Btn variant="amber" onClick={go2}>▶ Deploy</Btn><Btn onClick={() => go('hangar')}>Hangar</Btn></div></div>
      {mode === 'boss' && <div className="hidden lg:block panel cut min-h-0 relative"><ModelViewer kind="monster" id={boss} /><div className="absolute bottom-3 left-4 right-4"><div className="font-black tracking-widest text-xl">{bdef.name}</div><div className="text-xs opacity-80">{bdef.desc}</div></div></div>}
    </div></Screen>;
}

export function DatabaseScreen() {
  const go = useStore(s => s.go); const profile = useStore(s => s.profile); const [sel, setSel] = useState('ironhide'); const m = MONSTERS[sel]; const seen = !!profile.seen[sel] || (profile.kills[sel] || 0) > 0; const total = ALL_MONSTERS.filter(x => profile.seen[x.id]).length;
  return <Screen><ScreenHeader title="Monster Database" sub={`Discovered ${total} / ${ALL_MONSTERS.length}`} onBack={() => go('menu')} />
    <div className="flex-1 min-h-0 grid md:grid-cols-[320px_1fr] lg:grid-cols-[320px_1fr_340px] gap-4">
      <div className="scrollable grid grid-cols-2 gap-2 content-start max-h-[30vh] md:max-h-none">{ALL_MONSTERS.map(x => { const s2 = !!profile.seen[x.id]; return <div key={x.id} data-ui onClick={() => { click(); setSel(x.id); }} className={`card panel cut-sm p-2 ${sel === x.id ? 'sel' : ''} ${s2 ? '' : 'locked'}`}><div className="text-[.7rem] font-black tracking-wider truncate">{s2 ? x.name : '??? UNKNOWN'}</div><div className="text-[.55rem] opacity-60 truncate">{s2 ? x.cat : 'Not yet encountered'}</div>{s2 && <div className="text-[.6rem]"><Stars n={x.threat} /></div>}</div>; })}</div>
      <div className="panel cut relative min-h-[260px]"><ModelViewer kind="monster" id={sel} silhouette={!seen} />{!seen && <div className="absolute inset-x-0 top-4 text-center h-label text-amber-300 pulse">DATA LOCKED — ENCOUNTER IN BATTLE</div>}</div>
      <div className="scrollable min-h-0 hidden md:block lg:block"><Panel title={seen ? m.cat : 'Classified'}>
        <div className="text-2xl font-black tracking-widest glow-text">{seen ? m.name : '???'}</div>
        {seen ? <div className="grid gap-2 mt-2 text-sm"><div className="flex justify-between"><span className="h-label">Threat</span><Stars n={m.threat} /></div><div className="flex justify-between"><span className="h-label">Hull Points</span><b>{m.hp.toLocaleString()}</b></div><div className="flex justify-between"><span className="h-label">Speed</span><b>{m.speed}</b></div><div className="flex justify-between"><span className="h-label">Size</span><b>{Math.round(m.radius * 2)} m</b></div><div className="flex justify-between"><span className="h-label">Destroyed</span><b>{profile.kills[sel] || 0}</b></div>
          <p className="opacity-90 mt-1">{m.desc}</p><div><div className="h-label mt-1">Weak Point</div><div className="text-red-300">{m.weakness}</div></div>
          <div><div className="h-label mt-1">Attack Patterns</div><ul className="text-xs grid gap-0.5">{m.attacks.map((a, i) => <li key={i}>▸ {a.name || ATK_NAMES[a.t]} <span className="opacity-50">({a.r[0]}–{a.r[1]}m{a.fx ? ', ' + a.fx : ''})</span></li>)}</ul></div>
          {m.boss && <div className="text-amber-300 text-xs">Boss · {m.phases?.length} phases · Arena: {THEMES[m.theme!].name.split('—')[0]}</div>}</div> : <p className="text-sm opacity-70 mt-3">Engage this creature in combat to unlock its entry.</p>}</Panel></div>
    </div></Screen>;
}

export function ResultsScreen() {
  const r = useStore(s => s.results); const go = useStore(s => s.go); const launch = useStore(s => s.launch); const profile = useStore(s => s.profile);
  if (!r) return null; const cfg = r.cfg; const total = Object.values(r.kills).reduce((a, b) => a + b, 0); const mi = cfg.mission ?? 0; const nextOk = cfg.mode === 'campaign' && r.win && mi < MISSIONS.length - 1;
  const title = r.win ? (cfg.mode === 'campaign' && mi === 9 ? 'WAR ENDED' : 'VICTORY') : 'MECH DESTROYED';
  return <Screen className="items-center justify-center"><div className="w-[min(96vw,820px)] max-h-full scrollable slide-up">
    <div className="text-center mb-4"><div className="h-label">{cfg.mode.toUpperCase()}{cfg.mission !== undefined ? ` — MISSION ${cfg.mission + 1}` : ''}</div><h2 className="text-5xl md:text-7xl font-black tracking-[.2em]" style={{ color: r.win ? '#8dffb0' : '#ff6a80', textShadow: `0 0 30px ${r.win ? 'rgba(80,255,150,.6)' : 'rgba(255,60,90,.6)'}` }}>{title}</h2>{cfg.mode === 'campaign' && r.win && mi === 9 && <p className="mt-2 text-cyan-200">The Omega Beast is no more. Humanity endures — thanks to you, pilot.</p>}</div>
    <Panel title="Mission Report"><div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
      {[['Score', r.score.toLocaleString()], ['Time', fmtTime(r.time)], ['Kills', total], [cfg.mode === 'campaign' || cfg.mode === 'boss' ? 'Waves' : 'Wave Reached', r.wave], ['Buildings Lost', r.buildings], ['Perfect Dodges', r.dodges], ['Counters', r.counters], ['Weak Hits', r.weak]].map(([k, v]) => <div key={k as string}><div className="text-2xl font-black">{v}</div><div className="h-label">{k}</div></div>)}</div>
      <div className="mt-4 pt-3 border-t border-cyan-400/20 grid md:grid-cols-3 gap-3 text-center"><div><div className="text-2xl font-black text-lime-300">+{(r.credits || 0).toLocaleString()}</div><div className="h-label">Credits</div></div><div><div className="text-2xl font-black text-amber-300">+{r.xp}</div><div className="h-label">Pilot & Mech XP</div></div><div><div className="text-2xl font-black">{profile.credits.toLocaleString()}</div><div className="h-label">Balance</div></div></div>
      {!!r.levelUp && <div className="mt-3 text-center text-amber-300 font-black tracking-widest pulse">★ PILOT LEVEL UP — LEVEL {r.levelUp} (new weapons & skins may be unlocked)</div>}{!!r.mechLevelUp && <div className="text-center text-cyan-200 font-bold">MECH LEVEL {r.mechLevelUp}</div>}
      {r.win && cfg.mode === 'campaign' && <div className="mt-2 text-center text-sm">{r.firstClear ? <span className="text-lime-300">First clear bonus awarded. </span> : null}{r.bonus ? <span className="text-amber-300">★ Bonus objective complete! +25% credits</span> : <span className="opacity-60">Bonus objective not completed</span>}{r.firstClear && MISSIONS[mi].unlocks && MISSIONS[mi].unlocks !== 'VICTORY' && <div className="text-cyan-200 font-bold mt-1">NEW MECH AVAILABLE: {MISSIONS[mi].unlocks}</div>}</div>}
      {total > 0 && <div className="mt-3 text-xs opacity-80 flex flex-wrap gap-2 justify-center">{Object.entries(r.kills).map(([k, v]) => <span key={k} className="px-2 py-0.5 border border-cyan-400/30">{MONSTERS[k].name} ×{v}</span>)}</div>}</Panel>
    <div className="flex flex-wrap gap-3 justify-center mt-4"><Btn variant="amber" onClick={() => launch({ ...cfg })}>↻ Retry</Btn>{nextOk && <Btn variant="amber" onClick={() => launch({ mode: 'campaign', mission: mi + 1, mechId: cfg.mechId, theme: MISSIONS[mi + 1].theme, diff: cfg.diff })}>Next Mission ▶</Btn>}<Btn onClick={() => go('hangar')}>Hangar</Btn><Btn onClick={() => go(cfg.mode === 'campaign' ? 'campaign' : 'menu')}>{cfg.mode === 'campaign' ? 'Mission Select' : 'Main Menu'}</Btn></div>
  </div></Screen>;
}
