import { useState } from 'react';
import { useGame } from '../game/store';
import { WEAPONS } from '../game/data/weapons';
import { ARENAS, MODES } from '../game/data/world';
import { enterHub } from '../game/engine';
import { restartRun, startRun } from '../game/modes';
import { input, lockPointer } from '../game/input';
import { sfx } from '../game/audio';
import { Armory, ArenaCards, ControlsPanel, ModeCards, ScoreTable, SettingsPanel, TrainingPanel, hex } from './common';

export function resume() { useGame.getState().set({ screen: 'playing' }); input.flush(); lockPointer(); }

export function PauseMenu() {
  const [panel, setPanel] = useState<'main' | 'settings' | 'controls'>('main'); const st = useGame();
  return (
    <div className="absolute inset-0 grid place-items-center bg-black/65 backdrop-blur-sm p-3 fade-in">
      <div className={`panel p-6 ${panel === 'main' ? 'w-[min(420px,94vw)]' : 'w-[min(900px,96vw)] max-h-[92vh] scroll'}`}>
        <h2 className="disp text-3xl font-black text-center text-amber-200 mb-1">Paused</h2>
        <p className="text-center text-xs text-zinc-500 mb-4 tracking-widest uppercase">{MODES.find(m => m.id === st.mode)?.name} · {ARENAS[st.arena].name}</p>
        {panel === 'main' ? <div className="flex flex-col gap-2.5">
          <button className="btn primary" onClick={() => { sfx.ui(); resume(); }}>Resume</button>
          <button className="btn" onClick={() => { sfx.ui(); restartRun(); lockPointer(); }}>Restart run</button>
          <button className="btn" onClick={() => st.set({ screen: 'combat' })}>Combat menu (Tab)</button>
          <button className="btn" onClick={() => st.set({ screen: 'arena' })}>Arena / mode (M)</button>
          <button className="btn" onClick={() => setPanel('settings')}>Settings</button>
          <button className="btn" onClick={() => setPanel('controls')}>Controls</button>
          <button className="btn" onClick={() => { sfx.ui(); document.exitPointerLock?.(); enterHub(); }}>Quit to hub</button>
        </div> : <>{panel === 'settings' ? <SettingsPanel /> : <ControlsPanel />}<div className="mt-4 text-center"><button className="btn" onClick={() => setPanel('main')}>Back</button></div></>}
      </div>
    </div>
  );
}

export function CombatMenu() {
  const st = useGame();
  return (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col fade-in">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10"><h2 className="disp text-xl font-black text-amber-200">Combat menu</h2><div className="flex gap-2"><button className="btn sm" onClick={() => st.set({ screen: 'arena' })}>Arena (M)</button><button className="btn sm primary" onClick={() => { sfx.ui(); resume(); }}>Resume (Tab)</button></div></div>
      <div className="flex-1 scroll p-4 space-y-4 max-w-[1200px] w-full mx-auto"><Armory compact />{st.mode === 'training' && <TrainingPanel />}</div>
    </div>
  );
}
export function ArenaMenu() {
  const st = useGame();
  return (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col fade-in">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10"><h2 className="disp text-xl font-black text-amber-200">Arena & mode select</h2><button className="btn sm" onClick={() => { sfx.ui(); resume(); }}>Back (M)</button></div>
      <div className="flex-1 scroll p-4 space-y-4 max-w-[1100px] w-full mx-auto"><ModeCards />{st.mode === 'training' && <TrainingPanel />}<ArenaCards /></div>
      <div className="p-3 border-t border-white/10 flex justify-center"><button className="btn primary" onClick={() => { sfx.start(); startRun(st.mode, st.arena); lockPointer(); }}>Begin {MODES.find(m => m.id === st.mode)?.name} in {ARENAS[st.arena].name}</button></div>
    </div>
  );
}

export function GameOver() {
  const st = useGame(), r = st.result; const [name, setName] = useState(st.save.name);
  if (!r) return null; const w = WEAPONS[r.weapon];
  const rename = (n: string) => {
    n = n.toUpperCase().slice(0, 12); setName(n);
    const sc = st.save.scores; let li = -1, ld = -1; sc.forEach((s, i) => { if (s.date > ld) { ld = s.date; li = i; } });
    st.setSave({ name: n, scores: sc.map((s, i) => i === li ? { ...s, name: n } : s) });
  };
  return (
    <div className="absolute inset-0 grid place-items-center bg-black/75 backdrop-blur-sm p-3 fade-in">
      <div className="panel p-6 w-[min(760px,96vw)] max-h-[96vh] scroll text-center" style={{ boxShadow: `0 0 80px ${r.victory ? 'rgba(255,196,61,.25)' : 'rgba(255,30,60,.25)'}` }}>
        <h1 className="title-main text-5xl md:text-6xl" style={{ filter: r.victory ? undefined : 'hue-rotate(-20deg) saturate(1.2)' }}>{r.victory ? 'VICTORY' : 'DEFEATED'}</h1>
        <p className="text-xs tracking-[.4em] uppercase text-zinc-400 mt-2">{MODES.find(m => m.id === r.mode)?.name} · {w.name} {r.wave ? `· wave ${r.wave}` : ''}</p>
        <div className="disp text-5xl font-black tabular-nums mt-4" style={{ color: hex(w.color2), textShadow: `0 0 20px ${hex(w.color)}` }}>{r.score.toLocaleString()}</div>
        {r.rank > 0 && <div className="text-amber-300 text-sm mt-1 tracking-widest">{r.rank === 1 ? '★ NEW HIGH SCORE ★' : `RANK #${r.rank} ON THE BOARD`}</div>}
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 mt-3 text-xs text-zinc-300">{r.stats.map(s => <span key={s}>{s}</span>)}</div>
        {r.rank > 0 && <div className="mt-4 text-sm">Name <input type="text" value={name} maxLength={12} onChange={e => rename(e.target.value)} className="w-40 text-center disp" /></div>}
        <div className="mt-4 text-left panel p-3"><div className="disp text-xs text-amber-300 mb-1">High scores - {MODES.find(m => m.id === r.mode)?.name}</div><ScoreTable mode={r.mode} hl={r.rank} limit={6} /></div>
        <div className="mt-5 flex flex-wrap gap-3 justify-center">
          <button className="btn primary" onClick={() => { sfx.start(); restartRun(); lockPointer(); }}>Retry (Enter)</button>
          <button className="btn" onClick={() => st.set({ screen: 'arena' })}>Change mode / arena</button>
          <button className="btn" onClick={() => { enterHub(); st.set({ hubTab: 'armory' }); }}>Armory</button>
          <button className="btn" onClick={() => enterHub()}>Hub</button>
        </div>
      </div>
    </div>
  );
}
