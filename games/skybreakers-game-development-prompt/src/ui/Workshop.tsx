import { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { DECORS, HULL_COLORS, ITEMS, SAIL_COLORS, SHIPS, SHIP_REQ, SHIP_UPGRADES, SHIP_WEAPONS, STYLES, TRIM_COLORS } from '../game/data';
import { sfx } from '../game/audio';
import { shipStats, useStore, defaultShip, type ShipInst } from '../game/store';
import { buildAirship } from '../game/models2';
import { Cost, Shell } from './Panels';
import { useTick } from './hooks';

function Turntable({ type, inst }: { type: string; inst: ShipInst }) {
  const key = JSON.stringify([type, inst.hullColor, inst.sailColor, inst.trimColor, inst.decor, inst.style, inst.upgrades]);
  const obj = useMemo(() => { const o = buildAirship(type, { ...inst, style: inst.style }); const s = 1 / Math.pow(SHIPS[type].scale, 0.55); o.scale.setScalar(s); return o; }, [key]);
  const g = useRef<THREE.Group>(null);
  useFrame((st, dt) => { if (g.current) { g.current.rotation.y += dt * 0.5; g.current.position.y = Math.sin(st.clock.elapsedTime) * 0.25; } for (const p of obj.userData.props) p.rotation.z += dt * 18; });
  return <group ref={g}><primitive object={obj} /></group>;
}
export function ShipPreview({ type, inst, className }: { type: string; inst: ShipInst; className?: string }) {
  return (
    <div className={className} style={{ background: 'radial-gradient(ellipse at 50% 30%, #2a5ab0 0%, #0d1740 60%, #060a20 100%)', borderRadius: 12, overflow: 'hidden' }}>
      <Canvas camera={{ position: [12, 5, 14], fov: 38 }} dpr={[1, 1.5]} gl={{ antialias: true }}>
        <hemisphereLight args={['#bfe0ff', '#6a5a48', 1.1]} /><directionalLight position={[8, 12, 6]} intensity={2.2} color="#fff0d8" /><directionalLight position={[-8, 4, -8]} intensity={0.8} color="#7a9aff" />
        <Turntable type={type} inst={inst} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -4.5, 0]}><ringGeometry args={[4, 6, 48]} /><meshBasicMaterial color="#e8c46a" transparent opacity={0.35} /></mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -4.5, 0]}><ringGeometry args={[7, 7.15, 64]} /><meshBasicMaterial color="#5ae6ff" transparent opacity={0.6} /></mesh>
      </Canvas>
    </div>
  );
}

export function Workshop() {
  useTick(300); const s = useStore(); const [tab, setTab] = useState<'upgrades' | 'paint' | 'fleet'>('upgrades'); const inst = s.ships[s.activeShip]; const st = shipStats(s); const def = SHIPS[s.activeShip];
  const goldCost = Math.ceil((st.maxHull - inst.hull) * 0.6); const fuelCost = Math.ceil((st.maxFuel - inst.fuel) * 0.8);
  const Sw = ({ cols, cur, on }: { cols: string[]; cur: string; on: (c: string) => void }) => <div className="flex flex-wrap gap-2">{cols.map(c => <div key={c} className={`sw ${cur === c ? 'on' : ''}`} style={{ background: c }} onClick={() => { on(c); sfx('click'); }} />)}</div>;
  return (
    <Shell wide title="⚙ SHIPWRIGHT'S WORKSHOP" onClose={() => s.closePanel()}>
      <div className="grid md:grid-cols-[1fr_420px] gap-3 flex-1 min-h-0">
        <div className="flex flex-col min-h-0 gap-2">
          <ShipPreview type={s.activeShip} inst={inst} className="flex-1 min-h-[200px]" />
          <div className="glass p-2 grid grid-cols-3 sm:grid-cols-6 gap-1 text-center text-[11px]">
            {[['SPEED', Math.round(st.speed * 1.8) + ' kn'], ['ACCEL', st.accel.toFixed(0)], ['TURN', st.turn.toFixed(2)], ['HULL', Math.round(inst.hull) + '/' + Math.round(st.maxHull)], ['FUEL', Math.round(inst.fuel) + '/' + st.maxFuel], ['CARGO', '+' + st.cargo]].map(([a, b]) => <div key={a}><div className="font-title text-[9px] text-slate-400">{a}</div><div className="font-bold text-cyan-100">{b}</div></div>)}
          </div>
          <div className="flex gap-2 flex-wrap items-center text-xs"><span className="text-slate-300">Weapons:</span>{def.weapons.map(w => <span key={w} className="glass px-2 py-0.5">{SHIP_WEAPONS[w].icon} {SHIP_WEAPONS[w].name}</span>)}
            <button className="btn btn-sm ml-auto" disabled={inst.hull >= st.maxHull - 1 || (s.inv.gold || 0) < goldCost} onClick={() => { s.set_({ inv: { ...s.inv, gold: s.inv.gold - goldCost } }); inst.hull = st.maxHull; sfx('build'); }}>🔧 Repair {goldCost}🪙</button>
            <button className="btn btn-sm" disabled={inst.fuel >= st.maxFuel - 1 || (s.inv.gold || 0) < fuelCost} onClick={() => { s.set_({ inv: { ...s.inv, gold: s.inv.gold - fuelCost } }); inst.fuel = st.maxFuel; sfx('pickup'); }}>⛽ Refuel {fuelCost}🪙</button></div>
        </div>
        <div className="flex flex-col min-h-0"><div className="flex gap-1 mb-2">{(['upgrades', 'paint', 'fleet'] as const).map(t => <button key={t} className={`btn btn-sm ${tab === t ? 'btn-gold' : ''}`} onClick={() => { setTab(t); sfx('click'); }}>{t}</button>)}</div>
          <div className="scroll flex-1 min-h-0 space-y-2">
            {tab === 'upgrades' && SHIP_UPGRADES.map(u => { const lvl = inst.upgrades[u.id] || 0; const cost = u.cost(lvl); return <div key={u.id} className="item p-3 cursor-default"><div className="flex items-center gap-2"><span className="text-2xl">{u.icon}</span><div className="flex-1"><div className="font-bold text-sm">{u.name}</div><div className="text-[11px] text-slate-300">{u.desc}</div></div></div><div className="flex gap-1 my-1.5">{Array.from({ length: u.max }).map((_, i) => <div key={i} className="h-2 flex-1 rounded" style={{ background: i < lvl ? 'linear-gradient(90deg,#e8c46a,#fff2b8)' : 'rgba(255,255,255,.15)' }} />)}</div>{lvl < u.max ? <div className="flex items-center justify-between gap-2"><Cost cost={cost} inv={s.inv} /><button className="btn btn-sm btn-gold shrink-0" disabled={!s.has(cost)} onClick={() => { if (s.upgradeShip(u.id)) sfx('build'); }}>Install</button></div> : <div className="text-xs text-green-300">MAX LEVEL</div>}</div>; })}
            {tab === 'upgrades' && <div className="text-[11px] text-slate-400">Craft airship parts in the Craft menu (U). Upgrades apply to the selected airship.</div>}
            {tab === 'paint' && <div className="space-y-3"><div className="glass p-3"><div className="font-title text-xs text-[#ffd23a] mb-1">HULL PAINT</div><Sw cols={HULL_COLORS} cur={inst.hullColor} on={c => s.paintShip({ hullColor: c })} /></div><div className="glass p-3"><div className="font-title text-xs text-[#ffd23a] mb-1">SAIL / ENVELOPE</div><Sw cols={SAIL_COLORS} cur={inst.sailColor} on={c => s.paintShip({ sailColor: c })} /></div><div className="glass p-3"><div className="font-title text-xs text-[#ffd23a] mb-1">TRIM</div><Sw cols={TRIM_COLORS} cur={inst.trimColor} on={c => s.paintShip({ trimColor: c })} /></div>
              <div className="glass p-3"><div className="font-title text-xs text-[#ffd23a] mb-1">SAIL & WING STYLE</div><div className="flex gap-1 flex-wrap">{STYLES.map(x => <button key={x.id} className={`btn btn-sm ${inst.style === x.id ? 'btn-gold' : ''}`} onClick={() => s.paintShip({ style: x.id })}>{x.name}</button>)}</div></div>
              <div className="glass p-3"><div className="font-title text-xs text-[#ffd23a] mb-1">DECORATIVE PARTS</div><div className="space-y-1">{DECORS.map(d => { const owned = s.flags['decor_' + d.id]; const on = inst.decor.includes(d.id); return <div key={d.id} className="flex items-center justify-between text-sm"><span>{d.name}</span><button className={`btn btn-sm ${on ? 'btn-gold' : ''}`} disabled={!owned && (s.inv.gold || 0) < d.cost} onClick={() => { if (!owned) { s.set_({ inv: { ...s.inv, gold: s.inv.gold - d.cost }, flags: { ...s.flags, ['decor_' + d.id]: true } }); } s.toggleDecor(d.id); sfx('click'); }}>{on ? 'Equipped' : owned ? 'Equip' : `Buy ${d.cost}🪙`}</button></div>; })}</div></div></div>}
            {tab === 'fleet' && Object.values(SHIPS).map(sd => { const own = !!s.ships[sd.id]; const req = SHIP_REQ[sd.id]; const reqOk = (!req.level || s.level >= req.level) && (!req.boss || s.bosses.includes(req.boss)); return <div key={sd.id} className={`item p-3 cursor-default ${s.activeShip === sd.id ? 'sel' : ''}`}><div className="flex items-center justify-between"><div className="font-bold">{sd.name}</div>{s.activeShip === sd.id && <span className="text-[10px] text-[#ffd23a]">ACTIVE</span>}</div><div className="text-[11px] text-slate-300 mb-1">{sd.desc}</div><div className="text-[10px] text-slate-400">Hull {sd.hull} · Speed {sd.speed} · Cargo +{sd.cargo} · {sd.weapons.length} weapon types</div>
              {own ? <button className="btn btn-sm mt-2" disabled={s.activeShip === sd.id || !s.repaired} onClick={() => { if (G_dockOk()) { s.selectShip(sd.id); sfx('open'); } }}>Select</button> : <div className="mt-2"><Cost cost={sd.cost} inv={s.inv} /><div className="flex items-center justify-between mt-1"><span className={`text-[11px] ${reqOk ? 'text-green-300' : 'text-red-300'}`}>Requires: {sd.req}</span><button className="btn btn-sm btn-gold" disabled={!reqOk || !s.has(sd.cost)} onClick={() => { if (s.buyShip(sd.id)) sfx('quest'); }}>Build</button></div></div>}</div>; })}
          </div></div>
      </div>
    </Shell>
  );
}
const G_dockOk = () => true;

export function Collection({ onClose }: { onClose: () => void }) {
  const s = useStore(); const [sel, setSel] = useState('scout'); const sd = SHIPS[sel]; const own = !!s.ships[sel]; const inst = s.ships[sel] || { ...defaultShip(sd.hull), style: sd.style };
  return (
    <Shell wide title="AIRSHIP COLLECTION" onClose={onClose}>
      <div className="grid md:grid-cols-[1fr_360px] gap-3 flex-1 min-h-0"><ShipPreview type={sel} inst={{ ...inst, style: own ? inst.style : sd.style }} className="min-h-[240px]" />
        <div className="flex flex-col min-h-0"><div className="grid grid-cols-2 gap-2 mb-2">{Object.values(SHIPS).map(x => <button key={x.id} className={`item p-2 text-sm font-title ${sel === x.id ? 'sel' : ''}`} onClick={() => { setSel(x.id); sfx('click'); }}>{x.name}<div className="text-[10px] font-sans text-slate-400">{s.ships[x.id] ? 'OWNED' : 'LOCKED'}</div></button>)}</div>
          <div className="glass p-3 text-sm scroll flex-1"><div className="font-title text-[#ffe9a0]">{sd.name}</div><div className="text-xs text-slate-300 mb-2">{sd.desc}</div>{[['Top speed', sd.speed], ['Acceleration', sd.accel], ['Handling', sd.turn], ['Hull', sd.hull], ['Fuel', sd.fuel], ['Cargo', sd.cargo]].map(([k, v]) => <div key={k as string} className="flex items-center gap-2 text-xs"><span className="w-24">{k}</span><div className="bar flex-1" style={{ height: 6 }}><i style={{ width: `${Math.min(100, (Number(v) / ({ 'Top speed': 70, Acceleration: 25, Handling: 2, Hull: 1100, Fuel: 260, Cargo: 160 } as any)[k as string]) * 100)}%`, background: 'linear-gradient(90deg,#a46bff,#5ae6ff)' }} /></div></div>)}<div className="mt-2 text-xs">Weapons: {sd.weapons.map(w => SHIP_WEAPONS[w].icon).join(' ')}</div><div className="text-xs mt-1 text-slate-400">Requires: {sd.req}</div>{Object.keys(sd.cost).length > 0 && <div className="mt-2 flex flex-wrap gap-1 text-[11px]">{Object.entries(sd.cost).map(([k, n]) => <span key={k} className="glass px-1.5">{ITEMS[k].icon} {n}</span>)}</div>}</div></div></div>
    </Shell>
  );
}
