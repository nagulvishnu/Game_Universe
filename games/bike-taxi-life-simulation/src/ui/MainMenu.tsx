import { useState } from 'react';
import { useGame } from '../game/store';
import { startAudio } from '../game/audio';
import { LocalSaveRepository } from '../game/persistence';
import { Controls } from './Panels';

export function MainMenu() {
  const hasSave = useGame((s) => s.hasSave);
  const newGame = useGame((s) => s.newGame);
  const cont = useGame((s) => s.continueGame);
  const [view, setView] = useState<'main' | 'controls' | 'about'>('main');
  const [msg, setMsg] = useState('');
  const info = LocalSaveRepository.info();
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-b from-[#1b1040] via-[#c2410c] to-[#fbbf24]">
      <div className="absolute inset-x-0 bottom-0 h-1/2">
        <svg viewBox="0 0 1200 400" preserveAspectRatio="none" className="h-full w-full">
          {Array.from({ length: 40 }, (_, i) => { const h = 80 + ((i * 53) % 200); const x = i * 30; return <rect key={i} x={x} y={400 - h} width={26} height={h} fill={i % 3 ? '#1e1b3a' : '#2a2550'} />; })}
          {Array.from({ length: 60 }, (_, i) => <rect key={'w' + i} x={(i * 47) % 1190} y={400 - 20 - ((i * 37) % 200)} width="4" height="6" fill="#fde68a" opacity="0.8" />)}
          <rect x="0" y="360" width="1200" height="40" fill="#111827" />
          <rect x="0" y="378" width="1200" height="3" fill="#facc15" opacity="0.6" strokeDasharray="30 20" />
        </svg>
      </div>
      <div className="absolute left-0 top-10 animate-pulse text-7xl opacity-20">🌇</div>
      <div className="relative z-10 w-full max-w-lg rounded-3xl border border-white/20 bg-black/55 p-8 text-center text-white shadow-2xl backdrop-blur-md">
        <div className="text-5xl">🏍️</div>
        <h1 className="mt-2 bg-gradient-to-r from-amber-300 to-rose-400 bg-clip-text text-4xl font-black tracking-tight text-transparent">RIDE TO RICHES</h1>
        <div className="text-sm font-semibold tracking-[0.3em] text-amber-200">THE BIKE TAXI LIFE</div>
        <p className="mt-3 text-xs text-slate-300">From a rented room and one old motorcycle to a transportation empire in a living Indian metropolis.</p>
        {view === 'main' && (
          <div className="mt-6 space-y-2">
            <button disabled={!hasSave} onClick={() => { startAudio(); if (!cont()) setMsg('Save could not be loaded'); }} className="w-full rounded-xl bg-amber-500 py-3 text-lg font-black text-slate-900 transition hover:bg-amber-400 disabled:opacity-30">▶ Continue</button>
            <button onClick={() => { if (hasSave && !confirm('Start a new game? Your existing save will be overwritten.')) return; startAudio(); newGame(); }} className="w-full rounded-xl bg-white/15 py-3 text-lg font-bold transition hover:bg-white/25">✨ New Game</button>
            <button onClick={() => setView('controls')} className="w-full rounded-xl bg-white/10 py-2 text-sm font-semibold hover:bg-white/20">🎮 Controls</button>
            <button onClick={() => setView('about')} className="w-full rounded-xl bg-white/10 py-2 text-sm font-semibold hover:bg-white/20">ℹ️ How to play / Settings</button>
            <div className="pt-2 text-[11px] text-slate-400">{hasSave ? `Save found · last saved ${info.savedAt ? new Date(info.savedAt).toLocaleString() : '—'} · backup ${info.hasBackup ? 'ok' : 'none'}` : 'No save data yet'}{msg && <span className="text-rose-300"> · {msg}</span>}</div>
          </div>
        )}
        {view === 'controls' && <div className="mt-4 max-h-[50vh] overflow-y-auto text-left"><Controls /><button onClick={() => setView('main')} className="mt-3 rounded-lg bg-white/15 px-4 py-1 text-sm">‹ Back</button></div>}
        {view === 'about' && (
          <div className="mt-4 max-h-[50vh] space-y-2 overflow-y-auto text-left text-xs leading-relaxed text-slate-200">
            <p><b className="text-amber-300">1.</b> Open your phone (F) → PillionGo → Go Online. Accept a request (Y), ride to the pickup, press E to collect the passenger, ride to the destination, press E to drop and get paid into your <b>personal wallet</b>.</p>
            <p><b className="text-amber-300">2.</b> Eat, fuel and service your bike. Transfer spare money to <b>savings</b> (phone → Bank, or the table at home). Reach <b>₹1,00,000</b>.</p>
            <p><b className="text-amber-300">3.</b> Register your company at the City Registrar, take a business loan, buy company bikes, hire licensed riders and let them work for you (70% rider / 30% company). EMIs are auto-debited.</p>
            <p><b className="text-amber-300">4.</b> Expand zone by zone, watch your reputation, beat competitors — and go home to sleep when you are tired. Progress autosaves.</p>
            <p className="text-slate-400">Fares are dynamic and fully automatic: base + distance + time ± demand, weather and night adjustments. Nobody can edit the rates.</p>
            <button onClick={() => setView('main')} className="rounded-lg bg-white/15 px-4 py-1 text-sm">‹ Back</button>
          </div>
        )}
      </div>
    </div>
  );
}
