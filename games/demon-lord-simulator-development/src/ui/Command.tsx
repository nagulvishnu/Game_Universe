import { useState } from 'react';
import { BUILDINGS, COMMANDERS, FACTIONS, GENERALS, QUESTS, TERRITORIES, UNITS, UNIT_KEYS, type FactionId, type ResKey, type UnitType } from '../game/data';
import { api } from '../game/engine';
import { hooks, allTerritories, armyCapacity, armyPower, canAfford, dailyIncome, divisionPower, terrDef, terrDefense, totalArmy, unassignedUnits, unitCount, unitPower, useGame, type Formation, type Order } from '../game/store';
import { audio } from '../game/audio';
import { Bar, CostChips, Portrait, RES_ICON, Title, fmt } from './common';

const TABS = [['overview', 'Throne Overview'], ['generals', 'Generals'], ['army', 'Army & Divisions'], ['territories', 'Territories'], ['diplomacy', 'Diplomacy & War'], ['quests', 'Quests'], ['log', 'Chronicle']] as const;

export function Command() {
  const tab = useGame((s) => s.cmdTab); const res = useGame((s) => s.res); const pending = useGame((s) => s.pending);
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 40, background: 'radial-gradient(ellipse at center, rgba(40,6,20,.82), rgba(0,0,0,.92))' }}>
      <div className="panel flex flex-col" style={{ width: 'min(1320px, 97vw)', height: 'min(800px, 94vh)' }}>
        <div className="flex items-center justify-between px-5 pt-3">
          <div><div className="gold-text text-2xl tracking-[.3em] font-black">ROYAL COMMAND</div><div className="text-[10px] text-stone-400 tracking-widest">NOX INFERNUM · WAR TABLE OF THE DEMON LORD</div></div>
          <div className="flex gap-4 text-sm">{(Object.keys(RES_ICON) as ResKey[]).map((k) => <div key={k} title={RES_ICON[k].name} className="text-center"><div style={{ color: RES_ICON[k].color }}>{RES_ICON[k].icon} {fmt(res[k])}</div>{pending[k] > 1 && <div className="text-[10px] text-green-300">+{fmt(pending[k])}</div>}</div>)}</div>
          <button className="btn btn-sm" onClick={() => api.closeMenu()}>Close (Tab)</button>
        </div>
        <div className="flex px-3 border-b border-yellow-900/40 mt-2 overflow-x-auto">{TABS.map(([id, n]) => <div key={id} className={`tab whitespace-nowrap ${tab === id ? 'on' : ''}`} onClick={() => { useGame.setState({ cmdTab: id }); audio.sfx('ui'); }}>{n}</div>)}</div>
        <div className="flex-1 overflow-y-auto scroll p-4">
          {tab === 'overview' && <Overview />}{tab === 'generals' && <Generals />}{tab === 'army' && <Army />}{tab === 'territories' && <Territories />}{tab === 'diplomacy' && <Diplomacy />}{tab === 'quests' && <Quests />}{tab === 'log' && <Log />}
        </div>
      </div>
    </div>
  );
}

function Overview() {
  const s = useGame(); const inc = dailyIncome(s); const owned = allTerritories(s).filter((t) => s.terr[t.id].owner === 'demon'); const pop = owned.reduce((a, t) => a + s.terr[t.id].pop, 0);
  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="card p-4"><Title sub="Net change per kingdom day (45 s)">Treasury & Income</Title>
        {(Object.keys(RES_ICON) as ResKey[]).map((k) => <div key={k} className="flex justify-between text-sm py-0.5"><span style={{ color: RES_ICON[k].color }}>{RES_ICON[k].icon} {RES_ICON[k].name}</span><span>{fmt(s.res[k])} <span className={inc[k] >= 0 ? 'text-green-400' : 'text-red-400'}>({inc[k] >= 0 ? '+' : ''}{fmt(inc[k])}/day)</span></span></div>)}
        <div className="mt-3 text-xs text-stone-300">Uncollected: {(Object.keys(RES_ICON) as ResKey[]).map((k) => <span key={k} style={{ color: RES_ICON[k].color }} className="mr-2">{RES_ICON[k].icon}{fmt(s.pending[k])}</span>)}</div>
        <button className="btn btn-gold mt-2 w-full" onClick={() => s.collect()}>Collect Royal Income</button>
        {s.res.food <= 0 && <div className="text-red-400 text-xs mt-2">⚠ FAMINE — generals' loyalty is falling!</div>}
      </div>
      <div className="card p-4"><Title sub={`Day ${s.days}`}>Kingdom Status</Title>
        <div className="grid grid-cols-2 gap-y-1 text-sm"><span>Territories</span><b>{owned.length} / {allTerritories(s).length}</b><span>Population</span><b>{fmt(pop)}</b><span>Standing army</span><b>{fmt(totalArmy(s.units))} / {fmt(armyCapacity(s))}</b><span>Military power</span><b>{fmt(armyPower(s))}</b><span>Enemies slain</span><b>{s.kills}</b><span>Bosses felled</span><b>{s.bossesDefeated.length} / 7</b></div>
        <div className="mt-3"><Bar v={totalArmy(s.units)} max={armyCapacity(s)} color="#d4143c" h={8} /></div>
        <div className="mt-3 text-[11px] text-stone-400">Deployed divisions: {s.divisions.filter((d) => d.status === 'field').length} in field · {s.divisions.filter((d) => d.status === 'garrison').length} garrisoned · {s.divisions.filter((d) => d.status === 'marching').length} marching</div>
        <Title>Incoming Threats</Title>
        {s.attacks.length === 0 && <div className="text-xs text-stone-400">No enemy hosts are marching on your lands.</div>}
        {s.attacks.map((a) => <div key={a.id} className="text-xs text-red-300 py-0.5">⚔ {FACTIONS[a.faction].name} → {terrDef(s, a.tid).name} ({a.phase === 'arrived' ? 'ATTACKING NOW' : 'marching'})</div>)}
      </div>
      <div className="card p-4"><Title>Envoys & Offers</Title>{s.offers.length === 0 && <div className="text-xs text-stone-400">No pending offers.</div>}
        {s.offers.map((o) => <div key={o.id} className="text-sm mb-2">{o.text}<div className="flex gap-2 mt-1"><button className="btn btn-sm btn-gold" onClick={() => s.answerOffer(o.id, true)}>Accept peace</button><button className="btn btn-sm" onClick={() => s.answerOffer(o.id, false)}>Refuse</button></div></div>)}
        <Title>Recent Events</Title><div className="text-xs text-stone-300 space-y-0.5">{s.log.slice(0, 9).map((l, i) => <div key={i}>• {l}</div>)}</div></div>
      <div className="card p-4 col-span-3"><Title sub="Council decrees (spend resources, gain effects)">Royal Decrees</Title><div className="flex gap-3 flex-wrap">
        {[{ n: 'Blood Tithe', d: '+2500 gold, −4 loyalty (all generals)', c: {}, f: () => { s.gain({ gold: 2500 }); GENERALS.forEach((g) => s.setGeneral(g.id, { loyalty: Math.max(0, s.generals[g.id].loyalty - 4) })); s.toast('The tithe is collected. Generals grumble.', 'info'); } },
          { n: 'Feast of Conquerors', d: '−1500 gold, −800 food: +6 loyalty (all generals)', c: { gold: 1500, food: 800 }, f: () => { if (s.spend({ gold: 1500, food: 800 })) { GENERALS.forEach((g) => s.setGeneral(g.id, { loyalty: Math.min(100, s.generals[g.id].loyalty + 6) })); s.toast('The generals toast your name.', 'good'); } } },
          { n: 'Crystal Ritual', d: '−150 crystals: +900 mana', c: { crystals: 150 }, f: () => { if (s.spend({ crystals: 150 })) { s.gain({ mana: 900 }); s.toast('Kingdom mana restored.', 'good'); } } },
          { n: 'War Levy', d: '−1000 gold: +400 supplies', c: { gold: 1000 }, f: () => { if (s.spend({ gold: 1000 })) { s.gain({ supplies: 400 }); } } }].map((d) => <button key={d.n} className="card p-3 text-left hover:border-yellow-400" style={{ width: 280 }} onClick={d.f}><div className="gold-text font-bold">{d.n}</div><div className="text-[11px] text-stone-300">{d.d}</div></button>)}</div></div>
    </div>
  );
}

function Generals() {
  const s = useGame();
  return (
    <div>
      <div className="flex items-center gap-3 mb-3"><button className="btn btn-gold" onClick={() => { s.summonCouncil(!s.councilOn); s.toast(s.councilOn ? 'Council dismissed' : 'Council convened in the throne room', 'good'); }}>{s.councilOn ? 'Dismiss Royal Council' : 'Convene Royal Council'}</button><span className="text-xs text-stone-400">The council gathers every available general in the throne room, facing the war table. Generals you summon to your side fight with you using their unique abilities.</span></div>
      <div className="grid grid-cols-2 gap-3">{GENERALS.map((g) => { const gs = s.generals[g.id]; const divs = s.divisions.filter((d) => d.general === g.id); const pw = divs.reduce((a, d) => a + divisionPower(s, d), 0); const status = gs.mode === 'follow' ? 'At your side' : gs.mode === 'council' ? 'In Royal Council' : gs.deployed ? 'Stationed at ' + terrDef(s, g.territory).name : 'At his HQ (capital)'; const ter = terrDef(s, g.territory);
        return (<div key={g.id} className="card p-3 flex gap-3"><div style={{ border: `2px solid ${g.color}` }}><Portrait id={g.id} color={g.color} glow={g.glow} size={110} /></div>
          <div className="flex-1 min-w-0"><div className="flex justify-between"><div><span className="font-black tracking-widest" style={{ color: g.glow }}>{g.name}</span> <span className="text-xs text-stone-400">{g.title}</span></div><span className="text-[11px] text-stone-300">{status}</span></div>
            <div className="text-[11px] text-stone-300 italic">{g.personality}</div><div className="text-[11px] mt-1">⚔ <span className="text-stone-300">{g.army}</span></div><div className="text-[11px]">✦ <b style={{ color: g.glow }}>{g.ability}</b> — {g.abilityDesc}</div>
            <div className="grid grid-cols-2 gap-x-3 mt-1"><div className="text-[10px]">Loyalty {Math.round(gs.loyalty)}<Bar v={gs.loyalty} max={100} color={gs.loyalty < 40 ? '#ff4a4a' : '#4aff8a'} h={6} /></div><div className="text-[10px]">Bond {Math.round(gs.bond)}<Bar v={gs.bond} max={100} color="#e8c24a" h={6} /></div></div>
            <div className="text-[11px] mt-1 text-stone-300">Territory: {ter.name} ({s.terr[g.territory].owner === 'demon' ? 'held' : 'LOST'}) · Divisions: {divs.length} · Power {fmt(pw)} · Troops {fmt(divs.reduce((a, d) => a + unitCount(d.comp), 0))}</div>
            <div className="flex flex-wrap gap-1.5 mt-2">{gs.mode === 'follow' ? <button className="btn btn-sm" onClick={() => api.dismissGeneral(g.id)}>Dismiss from side</button> : <button className="btn btn-sm btn-gold" onClick={() => api.summonGeneral(g.id)}>Summon to my side</button>}
              <button className="btn btn-sm btn-blue" disabled={gs.mode !== 'hq'} onClick={() => s.setGeneral(g.id, { deployed: !gs.deployed })}>{gs.deployed ? 'Recall to HQ' : 'Station at fortress'}</button>
              <button className="btn btn-sm" onClick={() => { api.closeMenu(); setTimeout(() => s.openDialogue({ id: g.id, kind: 'general', name: g.name, title: g.title, color: g.color, lines: g.lines }), 50); }}>Hear counsel</button></div>
          </div></div>); })}</div>
      <Title sub="Underwater court of the Cursed Ocean — visit their pavilions in the capital's scrying pools">Five Ocean Commanders</Title>
      <div className="grid grid-cols-5 gap-2">{COMMANDERS.map((c) => <div key={c.id} className="card p-2 text-center"><div className="font-bold text-xs tracking-wider" style={{ color: c.color }}>{c.name}</div><div className="text-[10px] text-stone-400">{c.title}</div><div className="text-[10px] mt-1">✦ {c.ability}</div><div className="text-[10px] text-stone-300">{c.army}</div><div className="text-[10px]">Loyalty {s.commanders[c.id].loyalty}</div><Bar v={s.commanders[c.id].loyalty} max={100} color={c.color} h={5} /><div className="text-[10px] text-stone-400 mt-1">Seat: {terrDef(s, c.territory).name}</div><button className="btn btn-sm mt-1" onClick={() => { api.closeMenu(); setTimeout(() => s.openDialogue({ id: c.id, kind: 'commander', name: c.name, title: c.title, color: c.color, lines: c.lines }), 50); }}>Hail</button></div>)}</div>
    </div>
  );
}

const FORMS: [Formation, string, string][] = [['offensive', 'Offensive Wedge', '+12% power, advances ahead'], ['defensive', 'Defensive Phalanx', 'Tight ring around you'], ['balanced', 'Balanced Line', 'Standard line behind you'], ['skirmish', 'Loose Skirmish', 'Wide, flexible spread']];
const ORDERS: [Order, string][] = [['follow', 'Follow'], ['attack', 'Attack'], ['defend', 'Defend here'], ['patrol', 'Patrol here']];
function Army() {
  const s = useGame(); const free = unassignedUnits(s); const div = s.divisions.find((d) => d.id === s.selDiv) ?? s.divisions[0]; const [amt, setAmt] = useState(100); const [tgtG, setTgtG] = useState('capital'); const [tgtC, setTgtC] = useState('stormwatch'); const [newName, setNewName] = useState('');
  const ours = allTerritories(s).filter((t) => s.terr[t.id].owner === 'demon'); const foes = allTerritories(s).filter((t) => s.terr[t.id].owner !== 'demon');
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: '340px 300px 1fr' }}>
      <div className="card p-3"><Title sub={`Capacity ${fmt(totalArmy(s.units))} / ${fmt(armyCapacity(s))}`}>Recruitment</Title>
        <div className="flex gap-1 mb-2 text-xs items-center">Recruit: {[10, 100, 1000].map((n) => <button key={n} className={`btn btn-sm ${amt === n ? 'btn-gold' : ''}`} onClick={() => setAmt(n)}>×{n}</button>)}</div>
        <div className="space-y-1.5">{UNIT_KEYS.map((u) => <div key={u} className="flex items-center gap-2 text-xs border-b border-white/5 pb-1"><div className="flex-1"><div className="font-bold">{UNITS[u].name}</div><div className="text-[10px] text-stone-400">{fmt(s.units[u])} total · {fmt(free[u])} unassigned · pow {UNITS[u].power}</div><CostChips cost={Object.fromEntries(Object.entries(UNITS[u].cost).map(([k, v]) => [k, v * amt]))} have={s.res} /></div><button className="btn btn-sm" disabled={!canAfford(s.res, Object.fromEntries(Object.entries(UNITS[u].cost).map(([k, v]) => [k, v * amt])))} onClick={() => s.recruit(u as UnitType, amt)}>+{amt}</button></div>)}</div></div>
      <div className="card p-3"><Title sub="Click to select">Divisions & Squads</Title>
        <div className="space-y-1">{s.divisions.map((d) => <div key={d.id} className={`card p-2 cursor-pointer text-xs ${d.id === div.id ? 'sel' : ''}`} onClick={() => useGame.setState({ selDiv: d.id })}><div className="flex justify-between"><b>{d.name}</b><span className={d.status === 'field' ? 'text-green-300' : d.status === 'marching' ? 'text-yellow-300' : 'text-stone-400'}>{d.status.toUpperCase()}</span></div><div className="text-[10px] text-stone-400">{fmt(unitCount(d.comp))} troops · power {fmt(divisionPower(s, d))}{d.general ? ' · ' + d.general : ''}</div></div>)}</div>
        <div className="flex gap-1 mt-2"><input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New squad name" className="flex-1 bg-black/40 border border-yellow-800/40 px-2 text-xs" /><button className="btn btn-sm" onClick={() => { s.createDivision(newName); setNewName(''); }}>Create</button></div>
        <button className="btn btn-sm btn-blue w-full mt-2" onClick={() => s.recallAll()}>Recall ALL deployed forces</button></div>
      <div className="card p-3">{div && <>
        <div className="flex justify-between items-center"><Title sub={`Status: ${div.status.toUpperCase()} · Order: ${div.order.toUpperCase()}${div.target ? ' → ' + terrDef(s, div.target).name : ''}`}>{div.name}</Title>{div.id !== 'div_guard' && <button className="btn btn-sm" onClick={() => s.disband(div.id)}>Disband</button>}</div>
        {div.status === 'marching' && div.marchEnd && div.marchStart !== undefined && <div className="my-1 text-xs text-yellow-300">Marching to conquer… (progress only advances while you are in the world)<Bar v={Math.max(0, hooks.time() - div.marchStart)} max={Math.max(1, div.marchEnd - div.marchStart)} color="#e8c24a" h={5} /></div>}
        <div className="grid grid-cols-2 gap-3 mt-2"><div>
          <div className="text-xs gold-text mb-1">COMPOSITION (move {amt} units)</div>
          {UNIT_KEYS.map((u) => <div key={u} className="flex items-center text-xs gap-1 py-0.5"><span className="flex-1">{UNITS[u].name}</span><button className="btn btn-sm" onClick={() => s.moveUnits(div.id, u, -amt)}>−</button><span className="w-14 text-center">{fmt(div.comp[u] ?? 0)}</span><button className="btn btn-sm" disabled={free[u] <= 0} onClick={() => s.moveUnits(div.id, u, amt)}>+</button></div>)}
          <div className="text-[10px] text-stone-400 mt-1">Total {fmt(unitCount(div.comp))} · raw power {fmt(unitPower(div.comp))} · effective {fmt(divisionPower(s, div))}</div></div>
          <div><div className="text-xs gold-text mb-1">COMMANDER</div><select className="w-full" value={div.general ?? ''} onChange={(e) => s.assignGeneral(div.id, e.target.value || null)}><option value="">— none —</option>{GENERALS.map((g) => <option key={g.id} value={g.id}>{g.name} (pow {g.power}, loyalty {Math.round(s.generals[g.id].loyalty)})</option>)}</select>
            <div className="text-xs gold-text mt-3 mb-1">FORMATION</div>{FORMS.map(([f, n, d]) => <div key={f} className={`card p-1.5 mb-1 cursor-pointer text-xs ${div.formation === f ? 'sel' : ''}`} onClick={() => s.setFormation(div.id, f)}><b>{n}</b> <span className="text-[10px] text-stone-400">— {d}</span></div>)}</div></div>
        <div className="text-xs gold-text mt-3 mb-1">ORDERS</div>
        <div className="flex flex-wrap gap-1.5">{ORDERS.map(([o, n]) => <button key={o} className={`btn btn-sm ${div.order === o && div.status === 'field' ? 'btn-gold' : ''}`} onClick={() => s.setOrder(div.id, o)}>{n}</button>)}<button className="btn btn-sm btn-blue" onClick={() => s.recallDiv(div.id)}>Recall</button><button className="btn btn-sm" onClick={() => s.setOrder(div.id, 'idle')}>Stand down (base)</button></div>
        <div className="flex gap-2 mt-2 items-center"><button className="btn btn-sm btn-gold" onClick={() => s.setOrder(div.id, 'garrison', tgtG)}>Garrison →</button><select value={tgtG} onChange={(e) => setTgtG(e.target.value)}>{ours.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
        <div className="flex gap-2 mt-2 items-center"><button className="btn btn-sm" style={{ background: 'linear-gradient(180deg,#b01010,#400)' }} onClick={() => s.setOrder(div.id, 'conquer', tgtC)}>CONQUER →</button><select value={tgtC} onChange={(e) => setTgtC(e.target.value)}>{foes.map((t) => <option key={t.id} value={t.id}>{t.name} — def {fmt(terrDefense(s, t.id))} ({FACTIONS[s.terr[t.id].owner].name})</option>)}</select></div>
        <div className="text-[10px] text-stone-400 mt-2">Field divisions (Follow/Attack/Defend/Patrol) appear as visible squads around you in the world. Garrisoned divisions raise a territory's defense. Conquest marches resolve over ~30–60 s by comparing power versus defense — casualties are real. Defend/Patrol anchor at your position when ordered.</div>
      </>}</div>
    </div>
  );
}

function Territories() {
  const s = useGame(); const sel = s.selTerr && s.terr[s.selTerr] ? s.selTerr : 'capital'; const t = terrDef(s, sel); const st = s.terr[sel]; const mine = st.owner === 'demon'; const all = allTerritories(s); const [pick, setPick] = useState('div_guard');
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: '330px 1fr' }}>
      <div className="card p-2 space-y-1">{all.map((x) => { const o = s.terr[x.id].owner; return <div key={x.id} className={`card p-1.5 text-xs cursor-pointer flex justify-between ${x.id === sel ? 'sel' : ''}`} onClick={() => useGame.setState({ selTerr: x.id })}><span><span style={{ color: FACTIONS[o].color }}>■</span> {x.name}</span><span className="text-stone-400">{x.type}</span></div>; })}</div>
      <div className="card p-4"><div className="flex justify-between"><Title sub={`${t.type.toUpperCase()} · ${t.desc}`}>{t.name}</Title><div className="text-right text-xs"><div style={{ color: FACTIONS[st.owner].color }} className="font-bold">{FACTIONS[st.owner].name}</div><div>Defense {fmt(terrDefense(s, sel))} · Pop {fmt(st.pop)}</div></div></div>
        <div className="text-xs text-stone-300 mb-2">Base income/day: {(Object.keys(t.income) as ResKey[]).map((k) => <span key={k} style={{ color: RES_ICON[k].color }} className="mr-2">{RES_ICON[k].icon}{t.income[k]}</span>)} · Garrison: {s.divisions.filter((d) => d.status === 'garrison' && d.target === sel).map((d) => d.name).join(', ') || 'none'}</div>
        {mine ? <>
          <div className="grid grid-cols-2 gap-2">{Object.entries(BUILDINGS).map(([k, b]) => { const lvl = st.buildings[k] ?? 0; const cost = Object.fromEntries(Object.entries(b.cost).map(([r, v]) => [r, Math.ceil((v as number) * (1 + lvl * 0.8))])); return (
            <div key={k} className="card p-2"><div className="flex justify-between text-sm"><b>{b.name}</b><span className="text-yellow-300">{'◆'.repeat(lvl)}{'◇'.repeat(b.max - lvl)}</span></div><div className="text-[10px] text-stone-400">{b.desc}</div><div className="flex justify-between items-center mt-1"><CostChips cost={cost} have={s.res} /><button className="btn btn-sm" disabled={lvl >= b.max || !canAfford(s.res, cost)} onClick={() => s.build(sel, k)}>{lvl === 0 ? 'Build' : lvl >= b.max ? 'MAX' : 'Upgrade'}</button></div></div>); })}</div>
          <div className="flex gap-2 mt-3 flex-wrap"><button className="btn btn-sm btn-blue" onClick={() => api.travelTo(t.x, t.z)}>Shadow-travel here</button><button className="btn btn-sm btn-gold" onClick={() => { if (api.establishOutpost()) { /* ok */ } }}>Establish military outpost at my location (3500g 400sup 50◆)</button></div>
        </> : <div>
          <div className="text-sm text-red-300">Hostile territory. Take it by sending an army, demanding surrender via diplomacy, or fighting its defenders yourself and raising the Demon banner.</div>
          <div className="flex gap-2 mt-3 items-center"><select value={pick} onChange={(e) => setPick(e.target.value)}>{s.divisions.map((d) => <option key={d.id} value={d.id}>{d.name} ({fmt(divisionPower(s, d))})</option>)}</select><button className="btn btn-sm" style={{ background: 'linear-gradient(180deg,#b01010,#400)' }} onClick={() => s.setOrder(pick, 'conquer', sel)}>Send to conquer</button><button className="btn btn-sm btn-blue" onClick={() => api.travelTo(t.x, t.z - t.flatR)}>Fly there (travel)</button></div></div>}
      </div>
    </div>
  );
}

function Diplomacy() {
  const s = useGame(); const list = ['human', 'celestial', 'rival', 'ancient'] as FactionId[];
  return (
    <div className="grid grid-cols-2 gap-3">{list.map((f) => { const fs = s.factions[f]; const terrs = allTerritories(s).filter((t) => s.terr[t.id].owner === f); const col = FACTIONS[f].color; return (
      <div key={f} className="card p-3" style={{ borderColor: col + '88' }}><div className="flex justify-between"><div className="font-black tracking-widest" style={{ color: col }}>{FACTIONS[f].name.toUpperCase()}</div><div className={`text-xs font-bold ${fs.state === 'war' ? 'text-red-400' : fs.state === 'alliance' ? 'text-green-400' : 'text-stone-300'}`}>{fs.state.toUpperCase()}</div></div>
        <div className="text-[11px] text-stone-400">{FACTIONS[f].desc}</div>
        <div className="grid grid-cols-3 gap-2 text-xs mt-2"><div>Strength<br /><b>{fmt(fs.strength)}</b></div><div>Territories<br /><b>{terrs.length}</b></div><div>Your power<br /><b>{fmt(armyPower(s))}</b></div></div>
        <div className="text-[10px] mt-1">Relation {Math.round(fs.relation)}<Bar v={fs.relation + 100} max={200} color={fs.relation < 0 ? '#ff4a4a' : '#4aff8a'} h={6} /></div>
        <div className="text-[10px] text-stone-400 mt-1">Holds: {terrs.map((t) => t.name).join(', ') || 'nothing'}</div>
        <div className="flex flex-wrap gap-1.5 mt-2"><button className="btn btn-sm" onClick={() => s.gift(f)}>Send gift (2000g)</button><button className="btn btn-sm btn-blue" disabled={fs.state === 'alliance'} onClick={() => s.ally(f)}>Negotiate alliance (3000g)</button><button className="btn btn-sm btn-gold" disabled={fs.state !== 'war'} onClick={() => s.peace(f)}>Sue for peace (1500g)</button><button className="btn btn-sm" onClick={() => s.surrender(f)}>Demand surrender</button><button className="btn btn-sm" style={{ background: 'linear-gradient(180deg,#b01010,#400)' }} disabled={fs.state === 'war'} onClick={() => s.declareWar(f)}>Declare WAR</button></div>
      </div>); })}
      <div className="card p-3 col-span-2 text-xs text-stone-300">Peace or alliance makes that faction's field troops non-hostile and stops their raids. Declaring war lets them march on your fortresses — and lets you conquer theirs. Factions also fight each other, seize territory and sue for peace without your involvement.</div>
    </div>
  );
}

function Quests() {
  const s = useGame();
  return (<div className="grid grid-cols-2 gap-3">{QUESTS.map((q) => { const done = s.done.includes(q.id), acc = s.accepted.includes(q.id); return (
    <div key={q.id} className={`card p-3 ${s.tracked === q.id ? 'sel' : ''}`}><div className="flex justify-between"><b className={done ? 'text-green-300' : 'gold-text'}>{q.name}</b><span className="text-[10px] text-stone-400">OPTIONAL</span></div><div className="text-xs text-stone-300">{q.desc}</div>
      <div className="text-[11px] mt-1">Reward: <span className="text-yellow-300">{fmt(q.reward.gold)}g</span> <span className="text-purple-300">{q.reward.crystals}◆</span>{q.reward.item && <span className="text-orange-300"> + legendary item</span>}</div>
      {acc && <div className="mt-1"><Bar v={s.progress[q.id] ?? 0} max={q.n} color="#e8c24a" h={6} /><div className="text-[10px]">{s.progress[q.id] ?? 0}/{q.n}</div></div>}
      <div className="mt-2 flex gap-2">{done ? <span className="text-green-300 text-xs">✔ COMPLETED</span> : acc ? <button className="btn btn-sm" onClick={() => s.track(q.id)}>Track</button> : <button className="btn btn-sm btn-gold" onClick={() => s.acceptQuest(q.id)}>Accept</button>}</div></div>); })}</div>);
}
function Log() { const s = useGame(); return <div className="card p-4 text-sm space-y-1">{s.log.map((l, i) => <div key={i} className="text-stone-200">📜 {l}</div>)}</div>; }
