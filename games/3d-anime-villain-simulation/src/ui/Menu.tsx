import { useEffect, useState } from 'react';
import { useGame } from '../game/store';
import { DEFAULT_LOOK } from '../game/data';
import { listSaves, loadSlot } from '../game/save';
import { initAudio, musicSet } from '../game/audio';
import { Btn } from './common';
import { Controls, Customize, Settings } from './Panels';
import { SaveSlots } from './Overlay';

export function Menu() {
  const s = useGame(); const [page, setPage] = useState<'main' | 'new' | 'load' | 'settings' | 'controls'>('main'); const [name, setName] = useState('Kuro'); const [slot, setSlot] = useState('slot1'); const [has, setHas] = useState(false);
  useEffect(() => { listSaves().then((m) => setHas(m.some(Boolean))); }, [page]);
  const cont = async () => {
    initAudio(); const all = await listSaves(); const best = all.filter(Boolean).sort((a, b) => b!.at - a!.at)[0]; if (!best) return; const r = await loadSlot(best.slot); if (r) s.applySave(r.data, best.slot === 'auto' ? 'slot1' : best.slot);
  };
  const start = () => { initAudio(); if (s.settings.music) musicSet(true); s.newGame(slot, name.trim() || 'Nameless', { ...s.look }); setTimeout(() => document.querySelector('canvas')?.requestPointerLock?.(), 100); };
  return (
    <div className="absolute inset-0 z-20 pointer-events-none" style={{ background: 'linear-gradient(90deg, rgba(4,6,14,0.38) 0%, rgba(5,6,12,0.12) 32%, rgba(5,6,12,0.26) 55%, rgba(5,6,12,0.9) 100%)' }} onMouseDown={() => initAudio()}>
      <div className="absolute top-8 left-10 w-[min(420px,36vw)] pointer-events-none">
        <div className="title-font text-5xl xl:text-7xl leading-none text-white whitespace-nowrap" style={{ textShadow: '0 0 34px rgba(255,46,87,0.8), 4px 4px 0 #552d8f' }}>STICK<span className="text-rose-500">VERSE</span></div>
        <div className="title-font text-lg xl:text-2xl tracking-[0.3em] text-fuchsia-300 mt-1 whitespace-nowrap" style={{ textShadow: '0 0 16px #a855f7' }}>RISE OF THE DARK EMPIRE</div>
        <div className="w-40 h-px bg-gradient-to-r from-rose-400 via-fuchsia-400 to-transparent mt-5" />
        <div className="text-sm text-white/75 mt-3 max-w-[250px] italic">Start as nobody. Build your power. Create your empire. Conquer the world.</div>
      </div>
      <div className="absolute bottom-6 left-10 w-[min(270px,30vw)] text-xs leading-relaxed text-white/50 pointer-events-none">Fly from the first second — double-tap SPACE. Steal, burgle, fight heroes, recruit, conquer.</div>
      <div className="absolute right-0 top-0 bottom-0 w-[min(560px,92vw)] p-8 flex flex-col justify-center pointer-events-auto">
        {page === 'main' && (
          <div className="glass rounded-2xl p-6 flex flex-col gap-3 fadein">
            <div className="text-[10px] uppercase tracking-[0.32em] text-cyan-200/70 mb-1">Choose your next move</div>
            <Btn big primary disabled={!has} onClick={cont}>▶ Continue</Btn><Btn big onClick={() => setPage('new')}>New game</Btn><Btn big onClick={() => setPage('load')}>Load game</Btn><Btn big onClick={() => setPage('settings')}>Settings</Btn><Btn big onClick={() => setPage('controls')}>Controls</Btn>
            <div className="text-[10px] text-white/45 leading-relaxed mt-2 border-t border-white/10 pt-3">WASD move • Mouse look • SPACE jump / double-tap to fly • SHIFT boost • Q dash • F attack • E/R skills • V ultimate • T transform • G interact</div>
          </div>)}
        {page === 'new' && (
          <div className="glass rounded-xl p-5 max-h-[88vh] overflow-y-auto scroll fadein">
            <div className="title-font text-2xl text-rose-400 mb-3">CREATE YOUR VILLAIN</div>
            <div className="flex gap-2 items-center mb-3"><span className="text-xs text-white/50 uppercase tracking-widest">Name</span><input type="text" value={name} maxLength={16} onChange={(e) => setName(e.target.value)} className="flex-1" /></div>
            <Customize compact />
            <div className="flex gap-2 items-center my-3 text-xs"><span className="text-white/50 uppercase tracking-widest">Save slot</span>{['slot1', 'slot2', 'slot3'].map((x, i) => <span key={x} onClick={() => setSlot(x)} className={`chip ${slot === x ? 'on' : ''}`}>Slot {i + 1}</span>)}</div>
            <div className="flex gap-2"><Btn onClick={() => { s.setLook(DEFAULT_LOOK); }}>Reset look</Btn><Btn onClick={() => setPage('main')}>Back</Btn><Btn big primary className="flex-1" onClick={start}>Begin your rise ▶</Btn></div>
          </div>)}
        {page === 'load' && <div className="glass rounded-xl p-5 fadein"><div className="title-font text-2xl text-rose-400 mb-3">LOAD GAME</div><SaveSlots mode="load" /><div className="mt-3"><Btn onClick={() => setPage('main')}>Back</Btn></div></div>}
        {page === 'settings' && <div className="glass rounded-xl p-5 h-[80vh] flex flex-col fadein"><div className="title-font text-2xl text-rose-400 mb-3">SETTINGS</div><div className="flex-1 min-h-0"><Settings /></div><div className="mt-3"><Btn onClick={() => setPage('main')}>Back</Btn></div></div>}
        {page === 'controls' && <div className="glass rounded-xl p-5 h-[80vh] flex flex-col fadein"><div className="title-font text-2xl text-rose-400 mb-3">CONTROLS</div><div className="flex-1 min-h-0 overflow-y-auto scroll pr-3"><Controls /></div><div className="mt-3"><Btn onClick={() => setPage('main')}>Back</Btn></div></div>}
      </div>
    </div>
  );
}
