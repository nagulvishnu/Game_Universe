import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ITEMS, NPCS, QUESTS, SHOP_BUY } from '../game/data';
import { audio, sfx } from '../game/audio';
import { applyQuality, saveNow, toMenu } from '../game/control';
import { input } from '../game/runtime';
import { useStore } from '../game/store';
import { Shell } from './Panels';

export function Dialogue() {
  const s = useStore(); const npc = NPCS.find(n => n.id === s.dialogNpc); const [view, setView] = useState('main'); const [line, setLine] = useState('');
  useEffect(() => { if (npc) setLine(`Greetings, traveler. ${npc.lines[0]}`); setView('main'); }, [s.dialogNpc]);
  if (!npc) return null;
  const quests = QUESTS.filter(q => q.giver === npc.id && (s.questAvailable(q) || s.quests[q.id]?.state === 'active' || s.quests[q.id]?.state === 'ready'));
  const q = QUESTS.find(x => x.id === view); const qs = q ? s.quests[q.id] : null;
  const talk = () => { setLine(npc.lines[Math.floor(Math.random() * npc.lines.length)]); sfx('npc'); };
  return (
    <motion.div className="absolute inset-x-0 bottom-0 flex justify-center p-2 sm:p-6 pointer-events-auto" data-ui initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
      <div className="panel w-full max-w-[820px] p-4 sm:p-5">
        <div className="flex items-center gap-3 mb-2"><div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl" style={{ background: npc.color, boxShadow: `0 0 18px ${npc.color}` }}>🗨️</div><div><div className="font-title font-black text-lg text-[#ffe9a0]">{npc.name}</div><div className="text-[11px] text-cyan-200 uppercase tracking-widest">{npc.role}</div></div><button className="btn btn-sm ml-auto" onClick={() => { sfx('click'); s.closePanel(); }}>Leave</button></div>
        {view === 'main' || !q ? <>
          <div className="text-sm sm:text-base text-slate-100 min-h-[48px] mb-3">"{line}"</div>
          <div className="flex flex-col gap-1.5">
            {quests.map(x => { const st = s.quests[x.id]?.state; return <button key={x.id} className="item px-3 py-2 text-left text-sm" onClick={() => { setView(x.id); sfx('click'); }}><span className="mr-2">{st === 'ready' ? '❓' : st === 'active' ? '📜' : '❗'}</span><b>{x.title}</b> <span className="text-[11px] text-slate-400">{st === 'ready' ? '— turn in' : st === 'active' ? '— in progress' : `— ${x.cat}`}</span></button>; })}
            {npc.shop && <button className="item px-3 py-2 text-left text-sm" onClick={() => { s.openPanel('trade'); sfx('open'); }}>🪙 <b>Trade</b> <span className="text-[11px] text-slate-400">— buy supplies, sell loot</span></button>}
            <button className="item px-3 py-2 text-left text-sm" onClick={talk}>💬 Chat</button>
          </div></>
          : <>
            <div className="text-sm text-slate-100 mb-2">"{qs?.state === 'ready' ? q.ready : qs?.state === 'active' ? q.desc : qs?.state === 'done' ? q.done : q.offer}"</div>
            <div className="glass p-2 mb-2"><div className="font-title text-xs text-[#ffd23a]">{q.title.toUpperCase()}</div>{q.objs.map((o, i) => <div key={i} className="text-xs">◆ {o.label} {qs && `(${qs.prog[i]}/${o.n})`}</div>)}<div className="text-xs mt-1 text-[#ffe9a0]">Reward: {q.xp} XP {q.rewards.map(([k, n]) => `· ${ITEMS[k].icon}${n}`).join(' ')}</div></div>
            <div className="flex gap-2">{!qs && <button className="btn btn-sm btn-gold" onClick={() => { s.acceptQuest(q.id); sfx('quest'); setView('main'); setLine(q.id === 'main_1' ? 'Go with the wind, child.' : 'May fortune follow you.'); }}>Accept Quest</button>}
              {qs?.state === 'ready' && <button className="btn btn-sm btn-gold" onClick={() => { s.turnIn(q.id); sfx('levelup'); setView('main'); setLine(q.done); }}>Complete Quest</button>}
              {qs?.state === 'active' && <button className="btn btn-sm" onClick={() => { s.trackQuest(q.id); sfx('click'); }}>📍 Track</button>}<button className="btn btn-sm" onClick={() => setView('main')}>Back</button></div></>}
      </div>
    </motion.div>
  );
}

export function Trade() {
  const s = useStore(); const [mode, setMode] = useState<'buy' | 'sell'>('buy');
  const sellable = Object.entries(s.inv).filter(([k, n]) => n > 0 && ITEMS[k] && ITEMS[k].kind !== 'artifact' && ITEMS[k].kind !== 'currency' && ITEMS[k].value > 0);
  return (
    <Shell title="🪙 MERCHANT" onClose={() => s.closePanel()}>
      <div className="flex items-center justify-between mb-2"><div className="flex gap-1"><button className={`btn btn-sm ${mode === 'buy' ? 'btn-gold' : ''}`} onClick={() => setMode('buy')}>Buy</button><button className={`btn btn-sm ${mode === 'sell' ? 'btn-gold' : ''}`} onClick={() => setMode('sell')}>Sell</button></div><div className="font-bold text-[#ffe9a0]">🪙 {s.inv.gold || 0}</div></div>
      <div className="scroll flex-1 min-h-0 grid sm:grid-cols-2 gap-2 content-start max-h-[60vh]">
        {mode === 'buy' ? SHOP_BUY.map(k => { const price = Math.ceil(ITEMS[k].value * 1.5); return <div key={k} className="item p-2 flex items-center gap-2 cursor-default"><span className="text-3xl">{ITEMS[k].icon}</span><div className="flex-1"><div className="text-sm font-bold">{ITEMS[k].name}</div><div className="text-[10px] text-slate-400">{price} 🪙 each</div></div><button className="btn btn-sm" disabled={(s.inv.gold || 0) < price} onClick={() => { s.buy(k, 1); sfx('coin'); }}>×1</button><button className="btn btn-sm" disabled={(s.inv.gold || 0) < price * 10} onClick={() => { s.buy(k, 10); sfx('coin'); }}>×10</button></div>; })
          : sellable.map(([k, n]) => { const price = Math.max(1, Math.floor(ITEMS[k].value * 0.6)); return <div key={k} className="item p-2 flex items-center gap-2 cursor-default"><span className="text-3xl">{ITEMS[k].icon}</span><div className="flex-1"><div className="text-sm font-bold">{ITEMS[k].name} <span className="text-cyan-200">×{n}</span></div><div className="text-[10px] text-slate-400">{price} 🪙 each</div></div><button className="btn btn-sm" onClick={() => { s.sell(k, 1); sfx('coin'); }}>×1</button><button className="btn btn-sm" onClick={() => { s.sell(k, n); sfx('coin'); }}>All</button></div>; })}
        {mode === 'sell' && sellable.length === 0 && <div className="text-slate-400 text-sm">Nothing to sell.</div>}
      </div>
    </Shell>
  );
}

export function SettingsBody() {
  const s = useStore(); const st = s.settings; const [, force] = useState(0); const set = (p: any) => { s.setSettings(p); const m = { ...st, ...p }; audio.setVolumes(m.master, m.music, m.sfx); };
  const Slider = ({ label, k }: { label: string; k: 'master' | 'music' | 'sfx' }) => <div><div className="flex justify-between text-sm"><span>{label}</span><span>{Math.round(st[k] * 100)}%</span></div><input type="range" min={0} max={1} step={0.01} value={st[k]} onChange={e => set({ [k]: +e.target.value })} onPointerUp={() => sfx('click')} /></div>;
  return (
    <div className="scroll space-y-3 max-h-[64vh] pr-1">
      <div className="glass p-3 space-y-2"><div className="font-title text-xs text-[#ffd23a]">AUDIO</div><Slider label="Master Volume" k="master" /><Slider label="Music Volume" k="music" /><Slider label="Effects Volume" k="sfx" /></div>
      <div className="glass p-3"><div className="font-title text-xs text-[#ffd23a] mb-2">GRAPHICS</div><div className="flex gap-2">{(['low', 'medium', 'high'] as const).map(q => <button key={q} className={`btn btn-sm flex-1 ${st.quality === q ? 'btn-gold' : ''}`} onClick={() => { s.setSettings({ quality: q }); applyQuality(q); sfx('click'); }}>{q}</button>)}</div><div className="text-[11px] text-slate-400 mt-1">Adjusts resolution, shadows & effects live. Particle/cloud density fully applies on reload.</div></div>
      <div className="glass p-3 space-y-2"><div className="font-title text-xs text-[#ffd23a]">CONTROLS</div><div><div className="flex justify-between text-sm"><span>Mouse / Touch Sensitivity</span><span>{st.sens.toFixed(2)}</span></div><input type="range" min={0.3} max={2.5} step={0.05} value={st.sens} onChange={e => set({ sens: +e.target.value })} /></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={st.shake} onChange={e => set({ shake: e.target.checked })} /> Camera shake</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={st.invertY} onChange={e => set({ invertY: e.target.checked })} /> Invert Y axis</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={input.touch} onChange={e => { input.touch = e.target.checked; force(x => x + 1); }} /> Touch controls</label></div>
      <div className="glass p-3 text-[12px] text-slate-200 grid grid-cols-2 gap-x-4 gap-y-0.5"><div className="col-span-2 font-title text-xs text-[#ffd23a] mb-1">KEYBINDS</div>
        {[['WASD', 'Move / Fly'], ['Shift', 'Sprint / Boost'], ['Space', 'Jump / Ascend'], ['V', 'Dodge'], ['LMB / F', 'Attack (hold = charge)'], ['RMB / R', 'Block'], ['Q', 'Switch weapon'], ['1–6', 'Spells / Ship weapons'], ['Tab', 'Lock-on'], ['E', 'Interact / Board / Exit'], ['C', 'Descend (airship)'], ['H B G', 'Potions / Food'], ['I U J P K', 'Inventory, Craft, Journal, Skills, Kingdom'], ['R H (ship)', 'Refuel / Repair']].map(([a, b]) => <div key={a} className="flex gap-2"><b className="text-[#ffe9a0] w-20 shrink-0">{a}</b><span>{b}</span></div>)}</div>
    </div>
  );
}
export const SettingsPanel = ({ onClose }: { onClose: () => void }) => <Shell title="SETTINGS" onClose={onClose}><SettingsBody /></Shell>;

export function Pause() {
  const s = useStore(); const [view, setView] = useState<'main' | 'settings'>('main');
  return view === 'settings' ? <Shell title="SETTINGS" onClose={() => setView('main')}><SettingsBody /></Shell> : (
    <motion.div className="absolute inset-0 flex items-center justify-center bg-[#02030a]/60 pointer-events-auto" data-ui initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="panel p-6 sm:p-8 w-[min(92vw,380px)] flex flex-col gap-3 items-stretch"><div className="font-title font-black text-2xl text-center text-[#ffe9a0] tracking-[.3em] mb-2">PAUSED</div>
        <button className="btn btn-gold" onClick={() => { sfx('click'); s.closePanel(); }}>Resume</button>
        <button className="btn" onClick={() => { s.openPanel('menu', 'inventory'); sfx('open'); }}>Inventory & Journal</button>
        <button className="btn" onClick={() => { saveNow(); s.toast('Game saved', 'good'); sfx('quest'); }}>Save Game</button>
        <button className="btn" onClick={() => { setView('settings'); sfx('click'); }}>Settings</button>
        <button className="btn" onClick={() => { sfx('click'); toMenu(); }}>Save & Quit to Menu</button></div>
    </motion.div>
  );
}

export function Ending() {
  const s = useStore();
  return (
    <motion.div className="absolute inset-0 flex items-center justify-center p-4 bg-black/85 pointer-events-auto" data-ui initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 2 }}>
      <div className="max-w-[640px] text-center space-y-4"><div className="font-title text-3xl sm:text-5xl shimmer font-black">AETHERIA REBORN</div>
        <p className="text-slate-200 text-sm sm:text-base leading-relaxed">With the Storm Wyrm fallen, the Sky Heart's fragments — the Frost Sigil, the Titan's Heart, the Ember Crown, the Void Heart and the Storm Scale — resonate as one. Far below the clouds, the bells of Aetheria ring for the first time in a thousand years.</p>
        <p className="text-cyan-100 text-sm sm:text-base leading-relaxed">The Shattering was never a catastrophe of nature — it was a hunger. And you, Skybreaker, are the first of a new line of sky-kings. The islands will drift together again, one bridge at a time.</p>
        <p className="text-[#ffe9a0] font-title tracking-widest text-sm">THANK YOU FOR PLAYING</p><button className="btn btn-gold" onClick={() => { sfx('quest'); s.closePanel(); }}>Continue Exploring</button></div>
    </motion.div>
  );
}
