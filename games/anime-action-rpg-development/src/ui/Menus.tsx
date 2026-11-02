import { useEffect, useState } from 'react';
import { useGame } from '../game/store';
import { game } from '../game/engine';
import { audio } from '../game/audio';
import { INTRO_CARDS, ENDING_CARDS } from '../game/data';

export function MainMenu() {
  const s = useGame(); const [confirm, setConfirm] = useState(false);
  const play = () => { audio.init(); if (s.hasSave && !confirm) { setConfirm(true); return; } s.newGame(); game?.begin(true); };
  const cont = () => { audio.init(); if (s.continueGame()) game?.begin(false); };
  const open = (p: any) => { audio.init(); audio.play('ui'); s.openPanel(p); };
  return (
    <div className="absolute inset-0 z-20 flex" style={{ background: 'linear-gradient(90deg, rgba(5,3,12,.92) 0%, rgba(5,3,12,.65) 38%, rgba(5,3,12,0) 70%)' }}>
      <div className="flex w-[520px] max-w-full flex-col justify-center pl-12">
        <div className="mb-1 text-xs font-bold uppercase tracking-[.6em] text-violet-300">An Original Anime Action RPG</div>
        <h1 className="title-grad text-6xl font-black leading-[.95] tracking-tight">DUNGEON<br />AWAKENING</h1>
        <div className="mt-2 text-lg font-bold tracking-[.55em] text-rose-300">RISE FROM THE ABYSS</div>
        <div className="mt-10 max-w-xs space-y-0.5">
          {!confirm ? (<>
            <button className="menu-btn" onClick={play}>▶ Play</button>
            <button className="menu-btn" disabled={!s.hasSave} onClick={cont}>⟳ Continue {s.hasSave && <span className="ml-1 text-xs normal-case tracking-normal text-zinc-400">Lv {s.player.level}</span>}</button>
            <button className="menu-btn" onClick={() => open('character')}>Character</button>
            <button className="menu-btn" onClick={() => open('inventory')}>Inventory</button>
            <button className="menu-btn" onClick={() => open('skills')}>Skills</button>
            <button className="menu-btn" onClick={() => open('quests')}>Quests</button>
            <button className="menu-btn" onClick={() => open('map')}>World Map</button>
            <button className="menu-btn" onClick={() => open('settings')}>Settings</button>
          </>) : (
            <div className="glass rounded-xl p-4"><div className="font-bold text-rose-300">Start a new game?</div><div className="text-sm text-zinc-300">Your existing save (Level {s.player.level}) will be overwritten.</div><div className="mt-3 flex gap-2"><button className="btn btn-red" onClick={() => { s.newGame(); setConfirm(false); game?.begin(true); }}>Overwrite & Play</button><button className="btn" onClick={() => setConfirm(false)}>Cancel</button></div></div>
          )}
        </div>
        <div className="mt-8 max-w-sm text-[11px] leading-relaxed text-zinc-400"><b className="text-violet-300">WASD</b> move · <b className="text-violet-300">Mouse</b> camera · <b className="text-violet-300">F</b> combo · <b className="text-violet-300">E / R / V</b> skills · <b className="text-violet-300">T</b> transform · <b className="text-violet-300">Esc</b> pause. Progress saves automatically in your browser.</div>
      </div>
      <div className="absolute bottom-3 right-4 text-[11px] text-zinc-500">Save v2 · Original world, characters and music</div>
    </div>
  );
}

export function PauseMenu() {
  const s = useGame(); if (!s.paused || s.panel) return null;
  const resume = () => { s.setPaused(false); game?.requestLock(); };
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60">
      <div className="glass w-80 rounded-2xl p-6" style={{ animation: 'fadeUp .2s' }}>
        <div className="mb-4 text-center text-2xl font-black tracking-[.3em] text-violet-200">PAUSED</div>
        <div className="space-y-1">
          <button className="menu-btn" onClick={resume}>Resume</button>
          {([['inventory', 'Inventory'], ['character', 'Character'], ['skills', 'Skills'], ['quests', 'Quests'], ['map', 'World Map'], ['settings', 'Settings']] as const).map(([k, n]) => (<button key={k} className="menu-btn" onClick={() => s.openPanel(k)}>{n}</button>))}
          <button className="menu-btn" onClick={() => { game?.quitToMenu(); }}>Main Menu</button>
        </div>
        <div className="mt-4 text-center text-[11px] text-zinc-400">The mouse cursor is released. Click <b>Resume</b> (or press Esc) to recapture it.</div>
      </div>
    </div>
  );
}

function Cards({ cards, onDone, title }: { cards: string[]; onDone: () => void; title?: string }) {
  const [i, setI] = useState(0);
  const next = () => { if (i + 1 >= cards.length) onDone(); else setI(i + 1); };
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); next(); } if (e.code === 'Escape') onDone(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); });
  return (
    <div className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black" onClick={next}>
      <div key={i} className="max-w-3xl whitespace-pre-line px-8 text-center text-2xl font-semibold leading-relaxed text-zinc-100" style={{ animation: 'fadeUp 1s' }}>{title && i === 0 && <div className="mb-6 text-sm font-bold uppercase tracking-[.6em] text-violet-300">{title}</div>}{cards[i]}</div>
      <div className="absolute bottom-6 text-xs text-zinc-500">Click or press Enter to continue · Esc to skip</div>
      <button className="btn absolute right-6 top-6 !py-1 !text-xs" onClick={(e) => { e.stopPropagation(); onDone(); }}>Skip ›</button>
    </div>
  );
}
export function Intro() { const intro = useGame((s) => s.intro); if (!intro) return null; return <Cards cards={INTRO_CARDS} title="Chapter 1" onDone={() => { useGame.getState().setIntro(false); game?.requestLock(); }} />; }
export function Ending() { const e = useGame((s) => s.ending); if (!e) return null; return <Cards cards={ENDING_CARDS} title="Chapter 6 — Complete" onDone={() => { useGame.getState().setEnding(false); useGame.getState().save(); game?.requestLock(); }} />; }
