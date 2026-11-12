import { useEffect, useState } from 'react';
import { useGame } from '../game/store';
import { deleteSlot, listSaves, loadSlot, saveSlot, type SaveMeta } from '../game/save';
import { Btn } from './common';
import { Character, Inventory, MapPanel, Market, Missions, Settings, Skills } from './Panels';
import { Org } from './OrgPanel';

export function SaveSlots({ mode }: { mode: 'save' | 'load' }) {
  const s = useGame(); const [metas, setMetas] = useState<(SaveMeta | null)[]>([]); const refresh = () => listSaves().then(setMetas); useEffect(() => { refresh(); }, []);
  const slots = ['slot1', 'slot2', 'slot3', 'auto'];
  return (
    <div className="grid gap-2">
      {slots.map((sl, i) => { const m = metas[i]; return (
        <div key={sl} className="flex items-center gap-3 p-2 rounded border border-white/10 bg-white/5">
          <div className="w-16 text-xs uppercase font-black text-rose-300">{sl === 'auto' ? 'Autosave' : 'Slot ' + (i + 1)}</div>
          <div className="flex-1 text-xs">{m ? <><b>{m.name}</b> — Lv {m.level} • ${m.money.toLocaleString()} • {m.rep} REP • {m.terr}/9 territories<div className="text-white/40">{new Date(m.at).toLocaleString()}</div></> : <span className="text-white/40">Empty</span>}</div>
          {mode === 'save' && sl !== 'auto' && <Btn primary onClick={async () => { await saveSlot(sl, s.snapshot()); useGame.setState({ slot: sl }); s.toast('Game saved to ' + sl, '#86efac'); refresh(); }}>Save</Btn>}
          {mode === 'load' && m && <Btn primary onClick={async () => { const r = await loadSlot(sl); if (r) { s.applySave(r.data, sl === 'auto' ? 'slot1' : sl); } }}>Load</Btn>}
          {m && sl !== 'auto' && <Btn onClick={async () => { await deleteSlot(sl); refresh(); }}>✕</Btn>}
        </div>); })}
    </div>
  );
}

function Pause() {
  const s = useGame(); const [sub, setSub] = useState('main');
  return (
    <div className="max-w-2xl mx-auto fadein">
      {sub === 'main' && <div className="flex flex-col gap-3 items-center py-6"><div className="title-font text-4xl text-rose-400 mb-2">PAUSED</div>
        <Btn big primary onClick={() => s.setOverlay('')}>Resume</Btn><Btn big onClick={() => setSub('save')}>Save game</Btn><Btn big onClick={() => setSub('load')}>Load game</Btn><Btn big onClick={() => setSub('settings')}>Settings & controls</Btn>
        <Btn big onClick={async () => { await saveSlot(s.slot, s.snapshot()); s.setOverlay(''); s.setScreen('menu'); if (document.pointerLockElement) document.exitPointerLock(); }}>Save & quit to main menu</Btn></div>}
      {sub === 'save' && <><Btn onClick={() => setSub('main')}>← Back</Btn><div className="my-3"><SaveSlots mode="save" /></div></>}
      {sub === 'load' && <><Btn onClick={() => setSub('main')}>← Back</Btn><div className="my-3"><SaveSlots mode="load" /></div></>}
      {sub === 'settings' && <><Btn onClick={() => setSub('main')}>← Back</Btn><div className="mt-3 h-[60vh]"><Settings /></div></>}
    </div>
  );
}

const TABS: [string, string, string][] = [['inventory', 'Inventory', 'I'], ['skills', 'Skills', 'K'], ['character', 'Character', 'P'], ['map', 'World Map', 'M'], ['missions', 'Missions', 'J'], ['org', 'Organization', 'Tab'], ['settings', 'Settings', '']];
export function Overlay() {
  const o = useGame((s) => s.overlay); const sub = useGame((s) => s.sub); const set = useGame((s) => s.setOverlay);
  if (!o) return null;
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-2 sm:p-4 bg-black/65 backdrop-blur-sm fadein" onMouseDown={(e) => e.stopPropagation()}>
      <div className="glass w-full max-w-[1440px] h-[min(92vh,960px)] rounded-2xl flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 sm:gap-5 px-4 sm:px-6 pt-3 sm:pt-4">
          <div className="shrink-0">
            <div className="title-font text-lg sm:text-xl text-white tracking-wider">STICK<span className="text-rose-400">VERSE</span></div>
            <div className="hidden sm:block text-[8px] uppercase tracking-[0.25em] text-white/35">Villain operations console</div>
          </div>
          {o === 'pause' && <div className="text-[10px] uppercase tracking-[0.22em] text-rose-300">System paused</div>}
          {o === 'market' && <div className="text-fuchsia-300 font-bold uppercase tracking-[0.18em] text-xs sm:text-sm">Underground Black Market</div>}
          <Wallet />
          <button type="button" aria-label="Close menu" className="btn shrink-0 !px-3 !py-2" onClick={() => set('')}>✕ <span className="hidden sm:inline">Close</span></button>
        </div>
        {o !== 'pause' && o !== 'market' && <nav aria-label="Game menu" className="menu-nav mt-3 flex gap-1 overflow-x-auto scroll px-3 sm:px-5 border-y border-white/10 bg-black/15">
          {TABS.map(([k, l, h]) => <button key={k} type="button" aria-current={o === k ? 'page' : undefined} onClick={() => set(k as any)} className={`menu-tab ${o === k ? 'active' : ''}`}><span>{l}</span>{h && <span className="menu-tab-key">{h}</span>}</button>)}
        </nav>}
        <main className="flex-1 min-h-0 overflow-hidden p-3 sm:p-5">
          {o === 'inventory' && <Inventory />}{o === 'skills' && <Skills />}{o === 'character' && <Character />}{o === 'map' && <MapPanel />}{o === 'missions' && <Missions />}{o === 'org' && <Org initial={sub} key={sub} />}{o === 'market' && <Market />}{o === 'settings' && <Settings />}{o === 'pause' && <Pause />}
        </main>
      </div>
    </div>
  );
}
function Wallet() { const m = useGame((s) => s.money); const r = useGame((s) => s.rep); const l = useGame((s) => s.level); return <div className="ml-auto flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs">
  <span className="wallet-chip"><span className="text-white/40">LV</span><b className="text-white">{l}</b></span>
  <span className="wallet-chip text-amber-200"><span className="text-amber-200/50">$</span><b>{m.toLocaleString()}</b></span>
  <span className="wallet-chip hidden sm:flex text-rose-200"><b>{r.toLocaleString()}</b><span className="text-rose-200/50">REP</span></span>
</div>; }
