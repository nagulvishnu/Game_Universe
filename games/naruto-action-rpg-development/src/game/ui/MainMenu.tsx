import { useEffect, useMemo, useState } from 'react';
import { useGame } from '../store';
import { audio } from '../audio';
import { continueGame, newGame, loadSlot } from '../session';
import { listSaves, deleteSave, latestSave, type ReadResult } from '../persistence';
import { SettingsPanel } from './Settings';
import { CHARACTERS, CHAR_IDS } from '../data/characters';
import type { SaveData } from '../logic/profile';
import { xpForLevel } from '../logic/stats';

function Leaves() {
  const leaves = useMemo(() => Array.from({ length: 22 }, (_, i) => ({ left: Math.random() * 120, dur: 9 + Math.random() * 9, delay: -Math.random() * 14, s: 0.6 + Math.random() * 1.1, i })), []);
  return <>{leaves.map((l) => <span key={l.i} className="leaf" style={{ left: `${l.left}vw`, animationDuration: `${l.dur}s`, animationDelay: `${l.delay}s`, transform: `scale(${l.s})` }} />)}</>;
}

export function SlotList({ mode, onPick, onDone }: { mode: 'load' | 'save'; onPick: (slot: string) => void | Promise<void>; onDone?: () => void }) {
  const [slots, setSlots] = useState<{ slot: string; result: ReadResult }[]>([]);
  const [msg, setMsg] = useState('');
  const refresh = () => listSaves().then(setSlots);
  useEffect(() => { void refresh(); }, []);
  void onDone;
  return (
    <div className="flex flex-col gap-2">
      {slots.map(({ slot, result }) => {
        const isAuto = slot === 'auto';
        return (
          <div key={slot} className="slot-cell flex items-center gap-3 p-3">
            <div className="w-24 text-xs font-black uppercase tracking-widest text-orange-300">{isAuto ? 'Autosave' : slot.replace('slot', 'Slot ')}</div>
            <div className="flex-1 min-w-0">
              {result.status === 'ok' && (<><div className="truncate font-bold">{result.data.label}</div><div className="text-xs text-slate-400">{new Date(result.data.savedAt).toLocaleString()} • {Math.floor(result.data.profile.playtime / 60)} min played • {result.data.profile.completed.length} missions</div></>)}
              {result.status === 'empty' && <div className="text-slate-500">— Empty —</div>}
              {result.status === 'corrupt' && <div className="text-red-400">⚠ Corrupted or incompatible save (ignored safely)</div>}
            </div>
            {mode === 'load' && result.status === 'ok' && <button className="btn btn-sm btn-primary" onClick={async () => { audio.sfx('confirm'); await onPick(slot); }}><span>Load</span></button>}
            {mode === 'save' && !isAuto && <button className="btn btn-sm btn-primary" onClick={async () => { audio.sfx('confirm'); await onPick(slot); await refresh(); setMsg(`Saved to ${slot.replace('slot', 'Slot ')}`); }}><span>{result.status === 'ok' ? 'Overwrite' : 'Save'}</span></button>}
            {result.status !== 'empty' && !isAuto && <button className="btn btn-sm" onClick={async () => { await deleteSave(slot); void refresh(); }}><span>🗑</span></button>}
            {result.status === 'corrupt' && isAuto && <button className="btn btn-sm" onClick={async () => { await deleteSave(slot); void refresh(); }}><span>🗑</span></button>}
          </div>
        );
      })}
      {msg && <div className="text-sm text-emerald-300">{msg}</div>}
    </div>
  );
}

function Roster({ save }: { save: SaveData | null }) {
  const unlocked = save?.profile.unlocked ?? ['naruto'];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {CHAR_IDS.map((id) => {
        const c = CHARACTERS[id]; const on = unlocked.includes(id); const lv = save?.profile.chars[id].level ?? 1;
        return (
          <div key={id} className={`slot-cell p-3 ${on ? '' : 'opacity-50'}`} style={{ borderColor: on ? c.color : undefined }}>
            <div className="mb-1 flex h-14 items-center justify-center rounded text-3xl" style={{ background: `linear-gradient(135deg, ${c.color}55, transparent)` }}>{on ? '🥷' : '🔒'}</div>
            <div className="font-black leading-tight">{c.name}</div>
            <div className="text-[11px] text-slate-400">{on ? `Lv.${lv} — ${c.title}` : c.unlock}</div>
            <div className="mt-1 text-[11px] text-slate-300">{c.identity}</div>
          </div>
        );
      })}
    </div>
  );
}

export function MainMenu() {
  const panel = useGame((s) => s.menuPanel); const setPanel = useGame((s) => s.setMenuPanel);
  const [hasSave, setHasSave] = useState<SaveData | null | undefined>(undefined); const [err, setErr] = useState('');
  useEffect(() => { void latestSave().then(setHasSave).catch(() => setHasSave(null)); }, [panel]);
  const click = (fn: () => void) => () => { audio.unlock(); audio.sfx('confirm'); fn(); };

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: 'linear-gradient(180deg,#ff9a4a 0%,#ffcf7a 28%,#7ec8f0 62%,#3a74c8 100%)' }}>
      <div className="absolute left-1/2 top-[18%] h-[38vmin] w-[38vmin] -translate-x-1/2 rounded-full" style={{ background: 'radial-gradient(circle,#fff6c8 0%,#ffe27a 40%,rgba(255,200,80,0) 70%)', animation: 'floaty 6s ease-in-out infinite' }} />
      <svg className="absolute bottom-0 left-0 w-full" viewBox="0 0 1600 500" preserveAspectRatio="xMidYMax slice" style={{ height: '62%' }}>
        <path d="M0 500 L0 330 L180 280 L330 320 L520 200 L700 250 L860 120 L1020 250 L1200 190 L1380 300 L1600 240 L1600 500Z" fill="#4a6a58" opacity=".55" />
        <path d="M0 500 L0 400 L250 340 L470 390 L700 300 L900 330 L1150 280 L1350 360 L1600 320 L1600 500Z" fill="#2c4a3c" />
        <g fill="#7a6a58"><rect x="520" y="210" width="560" height="190" /><circle cx="600" cy="200" r="42" /><circle cx="720" cy="190" r="42" /><circle cx="840" cy="190" r="42" /><circle cx="960" cy="200" r="42" /></g>
        <g fill="#1d2a24"><path d="M0 500 L0 440 Q200 420 400 450 T800 440 T1200 450 T1600 430 L1600 500Z" />{Array.from({ length: 26 }, (_, i) => <rect key={i} x={30 + i * 62} y={420 - (i % 3) * 14} width={40} height={60 + (i % 4) * 8} />)}</g>
      </svg>
      <div className="pointer-events-none absolute inset-0"><Leaves /></div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />

      <div className="relative z-10 flex h-full flex-col items-center justify-between px-4 py-8 md:flex-row md:items-center md:justify-center md:gap-16 md:px-16">
        <div className="text-center md:text-left" style={{ animation: 'slideUp .8s ease-out' }}>
          <div className="mb-2 inline-block bg-black/50 px-3 py-1 text-[11px] font-black uppercase tracking-[.3em] text-orange-300">Fan-made 3D Action RPG</div>
          <h1 className="anime-title text-5xl leading-none text-orange-400 sm:text-6xl md:text-7xl">Naruto</h1>
          <h2 className="anime-title shine-text text-3xl sm:text-4xl md:text-5xl">Shinobi Legacy</h2>
          <div className="mt-2 inline-block -skew-x-12 bg-orange-500 px-4 py-1 text-sm font-black uppercase tracking-[.25em] text-black"><span className="inline-block skew-x-12">Expanded Edition</span></div>
          <p className="mt-5 max-w-md text-sm text-slate-100/90 drop-shadow">Run the rooftops of Konoha, master the Rasengan, and fight your way from the Academy to the bridge in the mist. Unofficial fan project — not affiliated with Masashi Kishimoto, Shueisha or Pierrot.</p>
        </div>

        <div className="w-full max-w-sm md:w-80" style={{ animation: 'slideIn .6s ease-out' }}>
          {!panel && (
            <div className="flex flex-col gap-3">
              <button className="btn btn-primary text-lg" onClick={click(() => newGame())}><span>▶ New Game</span></button>
              <button className="btn" disabled={!hasSave} onClick={click(async () => { const ok = await continueGame(); if (!ok) setErr('No valid save found.'); })}><span>Continue{hasSave ? ` — ${hasSave.label.split('—')[0].trim()}` : ''}</span></button>
              <button className="btn" onClick={click(() => setPanel('load'))}><span>Load Game</span></button>
              <button className="btn" onClick={click(() => setPanel('characters'))}><span>Characters</span></button>
              <button className="btn" onClick={click(() => setPanel('settings'))}><span>Settings</span></button>
              <button className="btn" onClick={click(() => setPanel('credits'))}><span>Credits</span></button>
              {err && <div className="text-sm text-red-300">{err}</div>}
              <div className="mt-2 text-center text-[11px] text-slate-200/80">WASD • Mouse • LMB/RMB attack • Q charge • E special • R ultimate • F lock-on</div>
            </div>
          )}
        </div>
      </div>

      {panel && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-4" onMouseDown={(e) => e.stopPropagation()}>
          <div className="panel max-h-[88vh] w-full max-w-3xl overflow-y-auto p-6" data-ui>
            <div className="mb-4 flex items-center justify-between"><h3 className="anime-title text-2xl text-orange-400">{panel === 'load' ? 'Load Game' : panel === 'settings' ? 'Settings' : panel === 'credits' ? 'Credits' : 'Roster'}</h3><button className="btn btn-sm" onClick={click(() => setPanel(null))}><span>✕ Back</span></button></div>
            {panel === 'load' && <SlotList mode="load" onPick={async (s) => { const r = await loadSlot(s); if (r !== 'ok') setErr(r); }} />}
            {panel === 'settings' && <SettingsPanel />}
            {panel === 'characters' && (<><p className="mb-3 text-sm text-slate-300">Unlock new playable characters through story and side missions. Select your character in-game with Tab → Characters.</p><Roster save={hasSave ?? null} />{hasSave && <div className="mt-3 text-xs text-slate-400">Showing progress from latest save (Lv.{hasSave.profile.chars[hasSave.profile.charId].level}, next level at {xpForLevel(hasSave.profile.chars[hasSave.profile.charId].level)} XP).</div>}</>)}
            {panel === 'credits' && (
              <div className="space-y-3 text-sm text-slate-200">
                <p><b className="text-orange-300">NARUTO: Shinobi Legacy — Expanded Edition</b> is an unofficial, non-commercial fan project. Naruto and related characters are © Masashi Kishimoto / Shueisha / TV Tokyo / Pierrot. No official assets are used.</p>
                <p>All 3D models are procedurally generated from primitives; all music and sound effects are synthesized live with the Web Audio API.</p>
                <p>Built with React, TypeScript, Vite, Three.js, React Three Fiber, Zustand and idb-keyval (IndexedDB).</p>
                <p className="text-slate-400">See README.md for architecture, controls, tests and known limitations.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
