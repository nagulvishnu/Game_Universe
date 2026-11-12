import { useEffect, useMemo, useRef, useState } from 'react';
import { FACTIONS, ITEMS, ITEM_BY_ID, REGIONS, type ItemDef } from '../game/data';
import { api } from '../game/engine';
import { audio } from '../game/audio';
import { BASE_STATS, allTerritories, equipStats, terrDef, useGame, type Equipment } from '../game/store';
import { Bar, ItemArt, MAP_SIZE, Panel, Portrait, RAR_COLOR, STAT_LABEL, Title, fmt, w2m, worldMapCanvas } from './common';
import { Command } from './Command';
import { P } from '../game/rt';

export function Settings({ onBack }: { onBack?: () => void }) {
  const s = useGame((x) => x.settings); const set = useGame((x) => x.setSettings);
  const Row = ({ l, children }: { l: string; children: React.ReactNode }) => <div className="flex items-center justify-between py-1.5 text-sm"><span className="tracking-wider">{l}</span><span className="flex items-center gap-2">{children}</span></div>;
  return (
    <div style={{ width: 460 }}><Title>Settings</Title>
      <Row l="Mouse sensitivity"><input type="range" min={0.3} max={2.5} step={0.05} value={s.sens} onChange={(e) => set({ sens: +e.target.value })} /><span className="w-10 text-right">{s.sens.toFixed(2)}</span></Row>
      <Row l="Camera distance"><input type="range" min={3.5} max={22} step={0.5} value={s.camDist} onChange={(e) => set({ camDist: +e.target.value })} /><span className="w-10 text-right">{s.camDist}</span></Row>
      <Row l="Music volume"><input type="range" min={0} max={1} step={0.05} value={s.music} onChange={(e) => { set({ music: +e.target.value }); audio.setVol(+e.target.value, s.sfx); }} /></Row>
      <Row l="Effects volume"><input type="range" min={0} max={1} step={0.05} value={s.sfx} onChange={(e) => { set({ sfx: +e.target.value }); audio.setVol(s.music, +e.target.value); }} /></Row>
      <Row l="Shadows"><button className={`btn btn-sm ${s.shadows ? 'btn-gold' : ''}`} onClick={() => set({ shadows: !s.shadows })}>{s.shadows ? 'ON' : 'OFF'}</button></Row>
      <Row l="Invert camera Y"><button className={`btn btn-sm ${s.invertY ? 'btn-gold' : ''}`} onClick={() => set({ invertY: !s.invertY })}>{s.invertY ? 'ON' : 'OFF'}</button></Row>
      <Row l="Population density"><div className="flex gap-1">{(['low', 'medium', 'high'] as const).map((q) => <button key={q} className={`btn btn-sm ${s.quality === q ? 'btn-gold' : ''}`} onClick={() => set({ quality: q })}>{q}</button>)}</div></Row>
      {onBack && <button className="btn mt-3" onClick={onBack}>Back</button>}
    </div>
  );
}
const CONTROLS: [string, string][] = [['W A S D', 'Move'], ['Mouse', 'Camera (wheel = distance)'], ['Space', 'Jump · double-tap = FLIGHT'], ['Shift', 'Sprint / fast flight'], ['Ctrl', 'Descend (flying/swimming)'], ['C', 'Toggle flight'], ['LMB', 'Light attack / combo'], ['RMB', 'Heavy attack (aerial: ground slam)'], ['F', 'Weapon flurry combo'], ['E', 'Infernal Fireball (homing)'], ['R', 'Destruction Beam (hold)'], ['Q', 'Shadow Teleport'], ['V', 'ULTIMATE: Cataclysm'], ['T', 'Awakened Demon Form'], ['G', 'Summon Demon Army'], ['X', 'Summon Dragon'], ['Z', 'Dodge'], ['H / Enter', 'Interact / Talk / Claim'], ['Tab', 'Royal Command Interface'], ['I', 'Inventory & Equipment'], ['M', 'World Map (fast travel)'], ['Esc', 'Pause / Save / Settings']];
export function Controls() { return <div style={{ width: 640 }}><Title>Controls</Title><div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-sm">{CONTROLS.map(([k, d]) => <div key={k} className="flex gap-2"><span className="gold-text font-bold w-24 shrink-0">{k}</span><span className="text-stone-300">{d}</span></div>)}</div></div>; }

function Slots({ mode }: { mode: 'load' | 'save' }) {
  const s = useGame(); const [, force] = useState(0);
  return <div style={{ width: 520 }}><Title>{mode === 'load' ? 'Load Game' : 'Save Game'}</Title>{[0, 1, 2].map((i) => { const info = s.slotInfo(i); const lab = i === 0 ? 'Autosave' : 'Slot ' + i; return (
    <div key={i} className="card p-3 mb-2 flex items-center justify-between"><div><div className="font-bold gold-text">{lab}</div><div className="text-xs text-stone-300">{info ? `Day ${info.day} · ${fmt(info.gold)} gold · ${info.time}` : 'Empty'}</div></div>
      {mode === 'load' ? <button className="btn btn-sm btn-gold" disabled={!info} onClick={() => s.continueGame(i)}>Load</button> : <button className="btn btn-sm btn-gold" disabled={i === 0} onClick={() => { s.toast(s.save(i) ? 'Game saved' : 'Save failed', 'good'); force((x) => x + 1); }}>{i === 0 ? 'Auto' : 'Save'}</button>}</div>); })}</div>;
}

export function MainMenu() {
  const s = useGame(); const [view, setView] = useState<'main' | 'load' | 'settings' | 'help'>('main'); const embers = useMemo(() => Array.from({ length: 50 }, () => ({ l: Math.random() * 100, d: 6 + Math.random() * 10, de: Math.random() * 10, sz: 2 + Math.random() * 4 })), []);
  const latest = [0, 1, 2].find((i) => s.slotInfo(i)) ?? 0;
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: 'linear-gradient(180deg,#0a0414 0%,#2a0a24 45%,#6a1020 80%,#2a0610 100%)' }}>
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice"><defs><radialGradient id="moon"><stop offset="0" stopColor="#ffd8d8" /><stop offset=".5" stopColor="#ff4a5a" stopOpacity=".7" /><stop offset="1" stopColor="#ff2a3a" stopOpacity="0" /></radialGradient></defs>
        <circle cx="1150" cy="260" r="260" fill="url(#moon)" /><circle cx="1150" cy="260" r="92" fill="#ffe4e4" />
        <path d="M0 700 L120 600 L220 680 L380 520 L520 660 L700 560 L900 680 L1100 540 L1300 650 L1450 570 L1600 640 L1600 900 L0 900Z" fill="#1a0818" />
        <path d="M0 780 L150 720 L300 780 L460 700 L640 790 L800 740 L1000 800 L1200 730 L1400 790 L1600 740 L1600 900 L0 900Z" fill="#0c040e" />
        <g fill="#05020a"><path d="M560 900 L560 520 L590 520 L590 440 L610 380 L630 440 L630 520 L680 520 L680 360 L700 300 L720 360 L720 500 L800 500 L800 280 L830 200 L860 280 L860 500 L940 500 L940 360 L960 300 L980 360 L980 520 L1030 520 L1030 440 L1050 380 L1070 440 L1070 520 L1100 520 L1100 900Z" /><path d="M820 200 L830 120 L840 200Z" /></g>
        {[[610, 470], [700, 420], [830, 330], [830, 440], [960, 420], [1050, 470]].map(([x, y], i) => <rect key={i} x={x} y={y} width="8" height="18" fill="#ff7a2a" opacity=".85" />)}</svg>
      {embers.map((e, i) => <span key={i} className="ember" style={{ left: e.l + '%', width: e.sz, height: e.sz, animationDuration: e.d + 's', animationDelay: -e.de + 's' }} />)}
      <div className="absolute inset-0 flex">
        <div className="flex flex-col justify-center pl-[8vw]" style={{ width: '55%' }}>
          <div className="text-xs tracking-[.6em] text-red-300">A DARK FANTASY KINGDOM SIMULATOR</div>
          <div className="gold-text title-glow font-black leading-none" style={{ fontSize: 'min(8.5vw,112px)', letterSpacing: '.04em' }}>DEMON LORD</div>
          <div className="text-[min(3.2vw,42px)] tracking-[.6em] text-red-200 title-glow font-bold">SIMULATOR</div>
          <div className="mt-4 text-sm text-stone-300 max-w-md italic">The Demon Realm is yours. The armies are yours. The world is yours to conquer.</div>
        </div>
        <div className="flex flex-col justify-center items-start gap-3" style={{ width: '45%' }}>
          <Panel className="p-6">{view === 'main' && <div className="flex flex-col gap-3" style={{ width: 300 }}>
            <button className="btn btn-gold text-base py-3" onClick={() => { audio.resume(); s.newGame(); }}>New Game</button>
            <button className="btn text-base py-3" disabled={!s.hasSave} onClick={() => { audio.resume(); s.continueGame(latest); }}>Continue</button>
            <button className="btn" disabled={!s.hasSave} onClick={() => setView('load')}>Load Game</button><button className="btn" onClick={() => setView('settings')}>Settings</button><button className="btn" onClick={() => setView('help')}>Controls</button>
            <div className="text-[10px] text-stone-400 text-center mt-2">Best experienced in fullscreen with mouse & keyboard</div></div>}
            {view === 'load' && <><Slots mode="load" /><button className="btn mt-2" onClick={() => setView('main')}>Back</button></>}
            {view === 'settings' && <Settings onBack={() => setView('main')} />}
            {view === 'help' && <><Controls /><button className="btn mt-3" onClick={() => setView('main')}>Back</button></>}</Panel>
        </div>
      </div>
    </div>
  );
}

const TIPS = ['Double-tap Space to take flight. Hold Shift to fly at full speed.', 'Press T to awaken your true demon form: wings, horns, three fireballs and 60% more power.', 'Hold R to charge the Destruction Beam — it tears down trees, houses and pillars.', 'Press Tab at the war table to command armies, generals and the whole kingdom.', 'Summon any general to your side from the Generals tab. Each has a unique ability.', 'Peace or alliance turns Human and Celestial troops friendly. War lets you conquer.', 'Walk up to an enemy banner and press H to claim it after slaying its defenders.'];
export function Loading() { const s = useGame(); const tip = useMemo(() => TIPS[Math.floor(Math.random() * TIPS.length)], []); return (
  <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ zIndex: 60, background: 'radial-gradient(ellipse at center,#2a0a1e,#05030a)' }}><div className="gold-text title-glow text-5xl font-black tracking-widest">DEMON LORD</div><div className="text-red-300 tracking-[.5em] text-sm mb-8">SIMULATOR</div>
    <div style={{ width: 460 }}><Bar v={s.loadPct} max={1} color="#d4143c" h={14} /></div><div className="mt-3 text-sm text-stone-300 tracking-wider">{s.loadMsg || 'Preparing…'}</div><div className="mt-10 text-xs text-stone-400 max-w-md text-center italic">{tip}</div></div>); }

export function PauseMenu() {
  const s = useGame(); const menu = s.menu; const [view, setView] = useState<'main' | 'save' | 'load' | 'settings' | 'help'>(menu === 'settings' ? 'settings' : menu === 'help' ? 'help' : 'main');
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 40, background: 'rgba(0,0,0,.72)' }}>
      <Panel className="p-8">{view === 'main' && <div className="flex flex-col gap-3" style={{ width: 300 }}><div className="gold-text text-3xl tracking-[.3em] font-black text-center mb-2">PAUSED</div>
        <button className="btn btn-gold" onClick={() => api.closeMenu()}>Resume</button><button className="btn" onClick={() => setView('save')}>Save Game</button><button className="btn" onClick={() => setView('load')}>Load Game</button><button className="btn" onClick={() => setView('settings')}>Settings</button><button className="btn" onClick={() => setView('help')}>Controls</button>
        <button className="btn" onClick={() => { s.save(0); window.location.reload(); }}>Save & Quit to Title</button></div>}
        {view === 'save' && <><Slots mode="save" /><button className="btn mt-2" onClick={() => setView('main')}>Back</button></>}{view === 'load' && <><Slots mode="load" /><button className="btn mt-2" onClick={() => setView('main')}>Back</button></>}
        {view === 'settings' && <Settings onBack={() => setView('main')} />}{view === 'help' && <><Controls /><button className="btn mt-3" onClick={() => setView('main')}>Back</button></>}</Panel>
    </div>);
}

export function Dialogue() {
  const d = useGame((s) => s.dialogue); const gens = useGame((s) => s.generals); const [i, setI] = useState(0); const [n, setN] = useState(0);
  const line = d?.lines[i] ?? ''; useEffect(() => { setN(0); const t = setInterval(() => setN((x) => x + 2), 22); return () => clearInterval(t); }, [i, d]); if (!d) return null;
  const g = d.kind === 'general' ? gens[d.id] : null; const last = i >= d.lines.length - 1;
  return (
    <div className="absolute left-0 right-0 bottom-6 flex justify-center" style={{ zIndex: 45 }}>
      <Panel className="flex gap-5 p-5" style={{ width: 'min(920px,94vw)', borderColor: d.color }}>
        <div style={{ border: `2px solid ${d.color}` }}><Portrait id={d.kind === 'general' ? d.id : d.kind === 'commander' ? 'cmd' + d.id : 'npc'} color={d.color} glow="#fff0d0" size={130} /></div>
        <div className="flex-1"><div className="flex items-baseline gap-3"><span className="text-2xl font-black tracking-widest" style={{ color: d.color }}>{d.name}</span><span className="text-xs text-stone-400 tracking-widest">{d.title}</span></div>
          <div className="text-lg mt-2 min-h-[64px] italic">“{line.slice(0, n)}”</div>
          {g && <div className="flex gap-4 text-[11px] text-stone-300"><span>Loyalty {Math.round(g.loyalty)}</span><span>Bond {Math.round(g.bond)}</span></div>}
          <div className="flex gap-2 mt-3 flex-wrap">{!last && <button className="btn btn-sm btn-gold" onClick={() => setI(i + 1)}>Continue ▸</button>}
            {d.kind === 'general' && <><button className="btn btn-sm btn-gold" onClick={() => { api.summonGeneral(d.id); api.closeMenu(); }}>Fight beside me</button><button className="btn btn-sm btn-blue" onClick={() => { useGame.setState({ cmdTab: 'generals', menu: 'command', dialogue: null }); }}>Inspect forces</button></>}
            {d.kind === 'commander' && <button className="btn btn-sm btn-blue" onClick={() => { useGame.setState({ cmdTab: 'generals', menu: 'command', dialogue: null }); }}>Fleet report</button>}
            <button className="btn btn-sm" onClick={() => api.closeMenu()}>Farewell</button></div></div>
      </Panel>
    </div>);
}

export function Treasure() {
  const s = useGame(); const key = 'tre_' + Math.floor(s.days / 4); const claimed = s.chests.includes(key);
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 40, background: 'radial-gradient(ellipse at center, rgba(90,60,6,.6), rgba(0,0,0,.92))' }}>
      <Panel className="p-8 text-center" style={{ width: 560 }}><div className="gold-text text-3xl tracking-[.25em] font-black">ROYAL TREASURE CHAMBER</div><div className="text-6xl my-4">👑⛁◆</div>
        <div className="text-sm text-stone-300">Centuries of tribute lie piled in the dark. The Demon Lord may claim a royal tribute once every 4 kingdom days.</div>
        <div className="my-4 text-yellow-300">Tribute: 6,000 gold · 400 crystals · 600 mana · a chance for a relic</div>
        <div className="flex gap-3 justify-center"><button className="btn btn-gold" disabled={claimed} onClick={() => { useGame.setState((x) => ({ chests: [...x.chests, key] })); s.gain({ gold: 6000, crystals: 400, mana: 600 }); s.toast('Royal tribute claimed!', 'epic'); const pool = ITEMS.filter((i) => !s.inventory.includes(i.id)); if (pool.length && Math.random() < 0.5) s.addItem(pool[Math.floor(Math.random() * pool.length)].id); audio.sfx('pickup'); }}>{claimed ? 'Already claimed (next in ' + (4 - (s.days % 4)) + ' days)' : 'Claim Tribute'}</button><button className="btn" onClick={() => api.closeMenu()}>Leave</button></div></Panel>
    </div>);
}

const SLOTS: { k: keyof Equipment; n: string }[] = [{ k: 'weapon', n: 'Weapon' }, { k: 'armor', n: 'Royal Armor' }, { k: 'ring1', n: 'Demon Ring I' }, { k: 'ring2', n: 'Demon Ring II' }, { k: 'artifact', n: 'Ancient Artifact' }, { k: 'dragon', n: 'Dragon Equipment' }];
export function Inventory() {
  const s = useGame(); const [sel, setSel] = useState<string | null>(s.equipment.weapon); const [filter, setFilter] = useState('all'); const st = equipStats(s.equipment); const it = sel ? ITEM_BY_ID[sel] : null; const eqIds = Object.values(s.equipment);
  const items = s.inventory.map((id) => ITEM_BY_ID[id]).filter((i) => i && (filter === 'all' || i.slot === filter));
  const isEq = (id: string) => eqIds.includes(id);
  const slotOf = (i: ItemDef): keyof Equipment | null => (i.slot === 'ring' ? (s.equipment.ring1 === i.id ? 'ring1' : s.equipment.ring2 === i.id ? 'ring2' : null) : (s.equipment[i.slot as keyof Equipment] === i.id ? (i.slot as keyof Equipment) : null));
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 40, background: 'radial-gradient(ellipse at center, rgba(40,6,20,.85), rgba(0,0,0,.93))' }}>
      <Panel className="flex flex-col" style={{ width: 'min(1250px,97vw)', height: 'min(780px,94vh)' }}>
        <div className="flex justify-between px-5 pt-3"><div className="gold-text text-2xl tracking-[.3em] font-black">ARMORY & INVENTORY</div><button className="btn btn-sm" onClick={() => api.closeMenu()}>Close (I)</button></div>
        <div className="flex-1 grid gap-4 p-4 overflow-hidden" style={{ gridTemplateColumns: '330px 1fr 320px' }}>
          <div className="card p-3 overflow-y-auto scroll"><Title>Equipment</Title>
            <div className="grid grid-cols-2 gap-2">{SLOTS.map((sl) => { const id = s.equipment[sl.k]; const item = id ? ITEM_BY_ID[id] : null; return <div key={sl.k} className={`card p-2 text-center cursor-pointer ${item ? 'rar-' + item.rarity : ''} ${sel && id === sel ? 'sel' : ''}`} onClick={() => item && setSel(item.id)}><div className="text-[9px] tracking-widest text-stone-400">{sl.n}</div><div className="flex justify-center my-1" style={{ minHeight: 56 }}>{item ? <ItemArt item={item} size={56} /> : <div className="text-3xl text-stone-600 leading-[56px]">◇</div>}</div><div className="text-[10px] font-bold" style={{ color: item ? RAR_COLOR[item.rarity] : '#666' }}>{item?.name ?? 'Empty'}</div>{item && <button className="btn btn-sm mt-1" onClick={(e) => { e.stopPropagation(); s.unequip(sl.k); }}>Unequip</button>}</div>; })}</div>
            <Title>Demon Lord Stats</Title>
            {(Object.keys(STAT_LABEL) as (keyof typeof STAT_LABEL)[]).map((k) => <div key={k} className="flex justify-between text-sm py-0.5"><span className="text-stone-300">{STAT_LABEL[k]}</span><span><b>{st[k]}</b> {st[k] - (BASE_STATS[k] ?? 0) !== 0 && <span className={st[k] - (BASE_STATS[k] ?? 0) > 0 ? 'text-green-400' : 'text-red-400'}>({st[k] - (BASE_STATS[k] ?? 0) > 0 ? '+' : ''}{st[k] - (BASE_STATS[k] ?? 0)})</span>}</span></div>)}</div>
          <div className="card p-3 overflow-y-auto scroll"><div className="flex gap-1 mb-2">{['all', 'weapon', 'armor', 'ring', 'artifact', 'dragon'].map((f) => <div key={f} className={`tab ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>{f}</div>)}</div>
            <div className="grid grid-cols-4 gap-2">{items.map((i) => <div key={i.id} className={`card p-2 text-center cursor-pointer rar-${i.rarity} ${sel === i.id ? 'sel' : ''}`} onClick={() => setSel(i.id)}><div className="flex justify-center"><ItemArt item={i} size={60} /></div><div className="text-[11px] font-bold mt-1" style={{ color: RAR_COLOR[i.rarity] }}>{i.name}</div><div className="text-[9px] text-stone-400 uppercase">{i.wtype ?? i.slot}</div>{isEq(i.id) && <div className="text-[9px] text-green-300">EQUIPPED</div>}</div>)}</div></div>
          <div className="card p-3 overflow-y-auto scroll">{it ? <><div className="flex justify-center"><ItemArt item={it} size={140} /></div><div className="text-center text-xl font-black mt-1" style={{ color: RAR_COLOR[it.rarity] }}>{it.name}</div><div className="text-center text-[10px] tracking-widest uppercase text-stone-400">{it.rarity} {it.wtype ?? it.slot}</div><div className="text-xs italic text-stone-300 my-2 text-center">{it.desc}</div>
            <div className="space-y-0.5">{(Object.keys(it.stats) as (keyof typeof it.stats)[]).map((k) => <div key={k} className="flex justify-between text-sm"><span>{STAT_LABEL[k]}</span><b className={(it.stats[k] ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}>{(it.stats[k] ?? 0) > 0 ? '+' : ''}{it.stats[k]}</b></div>)}</div>
            {it.wtype && <div className="text-[11px] text-stone-400 mt-2">Weapon style: {it.wtype === 'greatsword' ? 'slow, wide, devastating' : it.wtype === 'spear' ? 'long reach thrusts' : it.wtype === 'dual' ? 'very fast strikes' : it.wtype === 'staff' ? 'light attacks fire homing magic bolts' : 'balanced demon sword'}. Changes the model in your hand.</div>}
            {it.slot === 'armor' && <div className="text-[11px] text-stone-400 mt-2">Recolors your armor set in the world.</div>}{it.slot === 'dragon' && <div className="text-[11px] text-stone-400 mt-2">Dragon summon lasts +25s and your shoulders grow a gold dragon mantle.</div>}
            <div className="mt-3 flex gap-2 justify-center">{slotOf(it) ? <button className="btn btn-gold" onClick={() => s.unequip(slotOf(it)!)}>Unequip</button> : <button className="btn btn-gold" onClick={() => { s.equip(it.id); audio.sfx('pickup'); }}>Equip</button>}</div></> : <div className="text-stone-400 text-sm">Select an item.</div>}</div>
        </div>
      </Panel>
    </div>);
}

export function WorldMap() {
  const s = useGame(); const ref = useRef<HTMLCanvasElement>(null); const [sel, setSel] = useState<string | null>(null); const SZ = 700; const terrs = allTerritories(s);
  useEffect(() => {
    const c = ref.current!.getContext('2d')!; c.imageSmoothingEnabled = true; c.clearRect(0, 0, SZ, SZ); c.drawImage(worldMapCanvas(), 0, 0, SZ, SZ);
    c.font = 'bold 13px Georgia'; c.textAlign = 'center'; c.fillStyle = 'rgba(255,255,255,.75)'; c.strokeStyle = '#000'; c.lineWidth = 3;
    for (const r of REGIONS) { const a = r.angle, d = r.id === 'capital' ? 0 : 380; const [x, y] = w2m(Math.cos(a) * d, Math.sin(a) * d, SZ); c.strokeText(r.name.toUpperCase(), x, y - 26); c.fillText(r.name.toUpperCase(), x, y - 26); }
    for (const t of terrs) { const o = s.terr[t.id].owner; const [x, y] = w2m(t.x, t.z, SZ); c.fillStyle = FACTIONS[o].color; c.strokeStyle = t.id === sel ? '#fff' : '#000'; c.lineWidth = t.id === sel ? 3 : 1.5; c.beginPath(); c.moveTo(x, y - 9); c.lineTo(x + 8, y); c.lineTo(x, y + 9); c.lineTo(x - 8, y); c.closePath(); c.fill(); c.stroke(); }
    const [px, py] = w2m(P.pos.x, P.pos.z, SZ); c.save(); c.translate(px, py); c.rotate(-P.yaw + Math.PI); c.fillStyle = '#fff'; c.strokeStyle = '#d4143c'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -11); c.lineTo(-7, 8); c.lineTo(0, 4); c.lineTo(7, 8); c.closePath(); c.fill(); c.stroke(); c.restore();
    for (const b of Object.values(api.bossInfo)) { if (s.bossesDefeated.includes(b.id)) continue; const [x, y] = w2m(b.pos[0], b.pos[1], SZ); c.fillStyle = '#ff2020'; c.beginPath(); c.arc(x, y, 5, 0, 7); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 1; c.stroke(); }
  }, [s.terr, sel, terrs, s.bossesDefeated]);
  const t = sel ? terrDef(s, sel) : null; const owner = t ? s.terr[t.id].owner : null;
  const click = (e: React.MouseEvent) => { const r = ref.current!.getBoundingClientRect(); const x = ((e.clientX - r.left) / r.width) * SZ, y = ((e.clientY - r.top) / r.height) * SZ; let best: string | null = null, bd = 18; for (const q of terrs) { const [mx, my] = w2m(q.x, q.z, SZ); const d = Math.hypot(mx - x, my - y); if (d < bd) { bd = d; best = q.id; } } setSel(best); };
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 40, background: 'radial-gradient(ellipse at center, rgba(10,20,40,.85), rgba(0,0,0,.94))' }}>
      <Panel className="p-4 flex gap-4"><div><div className="gold-text text-xl tracking-[.3em] font-black mb-1">WORLD MAP</div><canvas ref={ref} width={SZ} height={SZ} onClick={click} style={{ width: 'min(700px,80vh)', height: 'min(700px,80vh)', border: '2px solid #e8c24a', cursor: 'crosshair' }} /></div>
        <div style={{ width: 300 }} className="flex flex-col"><div className="flex justify-between"><Title>Territories</Title><button className="btn btn-sm" onClick={() => api.closeMenu()}>Close (M)</button></div>
          <div className="text-[11px] text-stone-300 mb-2">◆ territory (colored by owner) · ● undefeated boss · arrow = you. Click a territory.</div>
          {t && owner ? <div className="card p-3"><div className="font-bold" style={{ color: FACTIONS[owner].color }}>{t.name}</div><div className="text-[11px] text-stone-400">{FACTIONS[owner].name} · {t.type}</div><div className="text-xs mt-1">{t.desc}</div>
            <div className="flex flex-col gap-2 mt-3">{owner === 'demon' ? <button className="btn btn-gold btn-sm" onClick={() => api.travelTo(t.x, t.z)}>Shadow-travel here</button> : <button className="btn btn-sm btn-blue" onClick={() => api.travelTo(t.x, t.z - t.flatR - 10)}>Fly to border (travel)</button>}<button className="btn btn-sm" onClick={() => { useGame.setState({ cmdTab: 'territories', selTerr: t.id, menu: 'command' }); }}>Manage / Conquer</button></div></div> : <div className="text-xs text-stone-500">No territory selected.</div>}
          <div className="mt-auto space-y-1 text-[11px]">{Object.entries(FACTIONS).map(([k, f]) => <div key={k}><span style={{ color: f.color }}>◆</span> {f.name}</div>)}</div></div>
      </Panel>
    </div>);
}

export function Menus() {
  const menu = useGame((s) => s.menu);
  if (menu === 'command') return <Command />; if (menu === 'inventory') return <Inventory />; if (menu === 'map') return <WorldMap />; if (menu === 'dialogue') return <Dialogue />; if (menu === 'treasure') return <Treasure />;
  if (menu === 'pause' || menu === 'settings' || menu === 'help' || menu === 'saves') return <PauseMenu />; return null;
}
void MAP_SIZE;
