import { useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ARMORS, BUILDINGS, BUILD_ORDER, ITEMS, KINGDOM_UPGRADES, NPCS, QUESTS, RECIPES, SPELLS, WEAPONS, WEAPON_ORDER, xpForLevel } from '../game/data';
import { sfx } from '../game/audio';
import { G } from '../game/runtime';
import { buildCost, buildingBuilt, capOf, dmgMul, masteryLevel, maxHp, maxMp, maxSp, spellMul, useStore, type Tab } from '../game/store';
import { ISLANDS } from '../game/world';
import { useTick } from './hooks';

export function Shell({ title, onClose, children, wide, tabs }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean; tabs?: ReactNode }) {
  return (
    <motion.div className="absolute inset-0 flex items-center justify-center p-2 sm:p-6 bg-[#02030a]/60 pointer-events-auto" data-ui initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div initial={{ y: 24, scale: 0.97, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} className={`panel w-full ${wide ? 'max-w-[1100px]' : 'max-w-[760px]'} max-h-full flex flex-col`} style={{ height: wide ? 'min(86vh, 760px)' : undefined }}>
        <div className="flex items-center justify-between px-4 sm:px-6 pt-3 sm:pt-4 pb-1 gap-2">
          <div className="font-title font-black text-lg sm:text-2xl text-[#ffe9a0] tracking-widest truncate">{title}</div>
          <button className="btn btn-sm" onClick={() => { sfx('click'); onClose(); }}>✕ Close</button>
        </div>
        {tabs}
        <div className="flex-1 min-h-0 px-3 sm:px-6 pb-3 sm:pb-5 pt-2 flex flex-col">{children}</div>
      </motion.div>
    </motion.div>
  );
}
export const Cost = ({ cost, inv }: { cost: Record<string, number>; inv: Record<string, number> }) => (
  <div className="flex flex-wrap gap-1.5">{Object.entries(cost).map(([k, n]) => { const have = inv[k] || 0; const ok = have >= n; return <span key={k} className={`text-[11px] px-1.5 py-0.5 rounded border ${ok ? 'border-green-400/40 text-green-200 bg-green-900/20' : 'border-red-400/50 text-red-300 bg-red-900/20'}`}>{ITEMS[k]?.icon} {ITEMS[k]?.name} {Math.min(have, 9999)}/{n}</span>; })}</div>
);

const TABS: { id: Tab; label: string; key: string }[] = [{ id: 'inventory', label: 'Inventory', key: 'I' }, { id: 'craft', label: 'Craft', key: 'U' }, { id: 'journal', label: 'Journal', key: 'J' }, { id: 'skills', label: 'Skills', key: 'P' }, { id: 'kingdom', label: 'Kingdom', key: 'K' }];
export function MenuPanel() {
  const s = useStore(); const tab = s.tab;
  return (
    <Shell wide title="SKY EXPLORER" onClose={() => s.closePanel()} tabs={<div className="flex overflow-x-auto px-3 sm:px-6 border-b border-white/10">{TABS.map(t => <div key={t.id} className={`tab ${tab === t.id ? 'on' : ''}`} onClick={() => { sfx('click'); useStore.setState({ tab: t.id }); }}>{t.label} <span className="hidden sm:inline opacity-50 text-[10px]">[{t.key}]</span></div>)}</div>}>
      {tab === 'inventory' && <Inventory />}{tab === 'craft' && <Craft />}{tab === 'journal' && <Journal />}{tab === 'skills' && <Skills />}{tab === 'kingdom' && <KingdomTab />}
    </Shell>
  );
}

function Inventory() {
  const s = useStore(); const [sel, setSel] = useState<string | null>(null); const items = Object.entries(s.inv).filter(([k, n]) => n > 0 && k !== 'gold'); const def = sel ? ITEMS[sel] : null;
  const usable = sel && ['potion', 'food', 'magic'].includes(ITEMS[sel].kind);
  return (
    <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-3 min-h-0 flex-1">
      <div className="scroll min-h-0 space-y-2 max-h-[40vh] md:max-h-none pr-1">
        <div className="font-title text-xs text-[#ffd23a]">WEAPONS</div>
        {WEAPON_ORDER.filter(w => s.weapons.includes(w)).map(id => { const w = WEAPONS[id]; return <div key={id} className={`item p-2 flex items-center gap-2 ${s.weapon === id ? 'sel' : ''}`} onClick={() => { s.equipWeapon(id); sfx('click'); }}><span className="text-2xl">{w.icon}</span><div className="flex-1"><div className="text-sm font-bold">{w.name}</div><div className="text-[10px] text-slate-300">Dmg {w.dmg} · {w.kind} · Mastery {masteryLevel(s, id)}</div></div>{s.weapon === id && <span className="text-[10px] text-[#ffd23a]">EQUIPPED</span>}</div>; })}
        <div className="font-title text-xs text-[#ffd23a] pt-1">ARMOR</div>
        {s.armors.map(id => { const a = ARMORS[id]; return <div key={id} className={`item p-2 flex items-center gap-2 ${s.armor === id ? 'sel' : ''}`} onClick={() => { s.equipArmor(id); sfx('click'); }}><span className="text-2xl">{a.icon}</span><div className="flex-1"><div className="text-sm font-bold">{a.name}</div><div className="text-[10px] text-slate-300">−{Math.round(a.def * 100)}% damage taken</div></div>{s.armor === id && <span className="text-[10px] text-[#ffd23a]">WORN</span>}</div>; })}
        <div className="font-title text-xs text-[#ffd23a] pt-1">SPELLS (1–6)</div>
        {SPELLS.map(sp => <div key={sp.id} className={`item p-2 flex items-center gap-2 ${s.level < sp.reqLevel ? 'opacity-40' : ''}`}><span className="text-xl">{sp.icon}</span><div className="flex-1"><div className="text-xs font-bold">{sp.name}</div><div className="text-[10px] text-slate-300">{sp.desc} · {sp.cost} MP · {sp.cd}s</div></div>{s.level < sp.reqLevel && <span className="text-[10px] text-red-300">Lv{sp.reqLevel}</span>}</div>)}
      </div>
      <div className="flex flex-col min-h-0">
        <div className="flex justify-between text-sm mb-2"><span className="font-title text-[#ffd23a] text-xs">BACKPACK & CARGO</span><span>🪙 {s.inv.gold || 0}</span></div>
        <div className="scroll flex-1 min-h-0 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2 content-start">
          {items.map(([k, n]) => { const cap = capOf(s, k); return <div key={k} className={`item p-2 text-center relative ${sel === k ? 'sel' : ''}`} onClick={() => { setSel(k); sfx('click'); }}><div className="text-3xl">{ITEMS[k]?.icon}</div><div className="text-[11px] leading-tight font-bold truncate">{ITEMS[k]?.name}</div><div className={`text-[11px] ${n >= cap ? 'text-red-300' : 'text-cyan-200'}`}>{n}{cap < 9999 ? `/${cap}` : ''}</div></div>; })}
          {items.length === 0 && <div className="col-span-full text-slate-400 text-sm">Nothing yet — gather resources with E, defeat monsters and open chests.</div>}
        </div>
        <div className="glass p-3 mt-2 min-h-[84px]">{def ? <div className="flex items-center gap-3"><div className="text-4xl">{def.icon}</div><div className="flex-1"><div className="font-bold">{def.name} <span className="text-xs text-slate-400">×{s.inv[sel!]}</span></div><div className="text-xs text-slate-300">{def.desc}</div><div className="text-[11px] text-yellow-200">Value {def.value} 🪙 · {def.kind}</div></div>{usable && <button className="btn btn-sm btn-gold" onClick={() => s.useItem(sel!)}>Use</button>}</div> : <div className="text-xs text-slate-400">Select an item. Capacity per resource is raised by airship cargo upgrades and Storage buildings.</div>}</div>
      </div>
    </div>
  );
}

function Craft() {
  const s = useStore(); const cats = ['Materials', 'Weapons', 'Armor', 'Potions', 'Airship Parts', 'Magic Items'] as const; const [cat, setCat] = useState<typeof cats[number]>('Materials');
  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex gap-1 flex-wrap mb-2">{cats.map(c => <button key={c} className={`btn btn-sm ${cat === c ? 'btn-gold' : ''}`} onClick={() => { setCat(c); sfx('click'); }}>{c}</button>)}</div>
      <div className="scroll flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-2 content-start">
        {RECIPES.filter(r => r.cat === cat).map(r => { const w = r.id.startsWith('w:') ? WEAPONS[r.id.slice(2)] : null; const a = r.id.startsWith('a:') ? ARMORS[r.id.slice(2)] : null; const it = ITEMS[r.id]; const owned = (w && s.weapons.includes(w.id)) || (a && s.armors.includes(a.id));
          const lvOk = s.level >= (r.level || 1); const stOk = !r.station || buildingBuilt(s, r.station); const ok = !owned && lvOk && stOk && s.has(r.cost);
          return <div key={r.id} className="item p-3 cursor-default"><div className="flex items-center gap-2 mb-1"><span className="text-3xl">{w?.icon || a?.icon || it?.icon}</span><div className="flex-1"><div className="font-bold text-sm">{w?.name || a?.name || it?.name} {r.qty > 1 && <span className="text-cyan-200">×{r.qty}</span>}</div><div className="text-[11px] text-slate-300">{w?.desc || (a && `−${Math.round(a.def * 100)}% damage taken`) || it?.desc}</div></div></div><Cost cost={r.cost} inv={s.inv} />
            <div className="flex items-center justify-between mt-2"><div className="text-[10px] text-slate-400">{!lvOk && <span className="text-red-300 mr-2">Level {r.level}</span>}{!stOk && <span className="text-red-300">Needs {BUILDINGS[r.station!].name}</span>}</div><button className="btn btn-sm btn-gold" disabled={!ok} onClick={() => { if (s.craft(r.id)) sfx('build'); }}>{owned ? 'Owned' : 'Craft'}</button></div></div>; })}
      </div>
    </div>
  );
}

function Journal() {
  useTick(500); const s = useStore(); const [sel, setSel] = useState<string | null>(s.tracked); const [sub, setSub] = useState<'quests' | 'atlas'>('quests');
  const groups = [['Ready to turn in', QUESTS.filter(q => s.quests[q.id]?.state === 'ready')], ['Active', QUESTS.filter(q => s.quests[q.id]?.state === 'active')], ['Available', QUESTS.filter(q => s.questAvailable(q))], ['Completed', QUESTS.filter(q => s.quests[q.id]?.state === 'done')]] as const; const q = QUESTS.find(x => x.id === sel); const qs = q ? s.quests[q.id] : null;
  const giver = q ? NPCS.find(n => n.id === q.giver) : null;
  return (
    <div className="flex flex-col flex-1 min-h-0"><div className="flex gap-1 mb-2"><button className={`btn btn-sm ${sub === 'quests' ? 'btn-gold' : ''}`} onClick={() => setSub('quests')}>Quests</button><button className={`btn btn-sm ${sub === 'atlas' ? 'btn-gold' : ''}`} onClick={() => setSub('atlas')}>World Atlas</button></div>
      {sub === 'quests' ? <div className="grid grid-cols-1 md:grid-cols-[290px_1fr] gap-3 flex-1 min-h-0">
        <div className="scroll min-h-0 max-h-[34vh] md:max-h-none space-y-1">{groups.map(([name, list]) => list.length > 0 && <div key={name}><div className="font-title text-[11px] text-[#ffd23a] mt-1">{name.toUpperCase()}</div>{list.map(x => <div key={x.id} className={`item px-2 py-1.5 text-sm ${sel === x.id ? 'sel' : ''}`} onClick={() => { setSel(x.id); sfx('click'); }}><div className="font-semibold truncate">{s.tracked === x.id && '📍 '}{x.title}</div><div className="text-[10px] text-slate-400">{x.cat}</div></div>)}</div>)}</div>
        <div className="glass p-3 scroll min-h-0">{q ? <><div className="font-title text-xs text-[#ffd23a]">{q.cat.toUpperCase()} · Lv {q.level}+</div><div className="text-xl font-bold mb-1">{q.title}</div><div className="text-sm text-slate-200 mb-2">{q.desc}</div><div className="text-xs italic text-slate-400 mb-3">"{q.offer}"</div><div className="text-xs text-slate-300 mb-1">Quest giver: <b className="text-[#ffe9a0]">{giver?.name}</b></div>
          {qs ? <div className="space-y-2">{q.objs.map((o, i) => <div key={i}><div className="flex justify-between text-sm"><span className={qs.prog[i] >= o.n ? 'text-green-300' : ''}>{qs.prog[i] >= o.n ? '✔' : '◆'} {o.label}</span><span>{qs.prog[i]}/{o.n}</span></div><div className="bar" style={{ height: 6 }}><i style={{ width: `${(qs.prog[i] / o.n) * 100}%`, background: 'linear-gradient(90deg,#2aa8e0,#8affea)' }} /></div></div>)}</div> : <div className="text-xs text-cyan-200">Speak to {giver?.name} to accept this quest.</div>}
          <div className="mt-3 text-xs">Rewards: <span className="text-[#ffe9a0]">{q.xp} XP</span> {q.rewards.map(([k, n]) => <span key={k} className="ml-2">{ITEMS[k]?.icon} {n} {ITEMS[k]?.name}</span>)}</div>
          {qs && qs.state !== 'done' && <button className="btn btn-sm mt-3" onClick={() => s.trackQuest(q.id)}>📍 Track quest</button>}</> : <div className="text-slate-400 text-sm">Select a quest. Talk to NPCs with ❗ above their heads to find new quests.</div>}</div></div>
      : <div className="scroll flex-1 min-h-0 grid grid-cols-1 sm:grid-cols-2 gap-2 content-start">{ISLANDS.filter(i => !i.minor || s.discovered.includes(i.id)).map(i => { const d = s.discovered.includes(i.id); return <div key={i.id} className={`item p-3 cursor-default ${d ? '' : 'opacity-60'}`}><div className="font-bold">{d ? i.name : '???'} <span className="text-[10px] text-slate-400 uppercase">{i.biome}</span></div><div className="text-xs text-slate-300">{d ? i.blurb : 'Undiscovered island.'}</div><div className={`text-[11px] mt-1 ${s.level >= i.minLevel ? 'text-green-300' : 'text-red-300'}`}>{s.level >= i.minLevel ? 'Accessible' : `Storm barrier — level ${i.minLevel}`}</div></div>; })}</div>}
    </div>
  );
}

function Skills() {
  const s = useStore(); const rows: [string, string, string, string][] = [['health', '❤️ Vitality', '+20 max health per rank', ''], ['stamina', '🏃 Endurance', '+12 stamina, faster recovery', ''], ['magic', '🔮 Aether', '+12 magic energy & regen', ''], ['combat', '⚔️ Combat', '+8% weapon damage, +2% crit chance', ''], ['spell', '✨ Sorcery', '+12% spell power, stronger Earth Shield', '']];
  return (
    <div className="grid md:grid-cols-2 gap-3 flex-1 min-h-0 scroll">
      <div className="space-y-2"><div className="glass p-3"><div className="flex justify-between"><span className="font-title text-[#ffe9a0]">LEVEL {s.level}</span><span className="text-sm text-cyan-200">{s.xp} / {xpForLevel(s.level + 1)} XP</span></div><div className="bar mt-1" style={{ height: 8 }}><i style={{ width: `${(s.xp / xpForLevel(s.level + 1)) * 100}%`, background: 'linear-gradient(90deg,#c9962c,#ffe27a)' }} /></div><div className="mt-2 text-sm">Skill points: <b className={s.skillPts > 0 ? 'text-[#ffd23a]' : ''}>{s.skillPts}</b></div></div>
        {rows.map(([k, name, desc]) => <div key={k} className="item p-3 cursor-default flex items-center gap-3"><div className="flex-1"><div className="font-bold text-sm">{name} <span className="text-[#ffd23a]">{s.skills[k]}/10</span></div><div className="text-[11px] text-slate-300">{desc}</div><div className="bar mt-1" style={{ height: 5 }}><i style={{ width: `${s.skills[k] * 10}%`, background: 'linear-gradient(90deg,#a46bff,#5ae6ff)' }} /></div></div><button className="btn btn-sm btn-gold" disabled={s.skillPts < 1 || s.skills[k] >= 10} onClick={() => { s.spendSkill(k); sfx('pickup'); }}>+</button></div>)}</div>
      <div className="space-y-2"><div className="glass p-3 text-sm space-y-1"><div className="font-title text-xs text-[#ffd23a] mb-1">CHARACTER STATS</div><div>❤️ Health {maxHp(s)}</div><div>🏃 Stamina {maxSp(s)}</div><div>🔮 Magic {maxMp(s)}</div><div>⚔️ Damage ×{dmgMul(s).toFixed(2)}</div><div>✨ Spell power ×{spellMul(s).toFixed(2)}</div><div>☠️ Kills {s.kills}</div><div>🛡️ Armor −{Math.round(ARMORS[s.armor].def * 100)}%</div></div>
        <div className="glass p-3"><div className="font-title text-xs text-[#ffd23a] mb-1">WEAPON MASTERY</div>{s.weapons.map(w => { const m = masteryLevel(s, w); return <div key={w} className="flex items-center gap-2 text-sm"><span>{WEAPONS[w].icon}</span><span className="flex-1">{WEAPONS[w].name}</span><span className="text-[#ffd23a]">Rank {m}</span><span className="text-[10px] text-slate-400">+{m * 4}% dmg</span></div>; })}</div></div>
    </div>
  );
}

function KingdomTab() {
  useTick(250); const s = useStore(); const k = s.kingdom; const [sub, setSub] = useState<'overview' | 'build' | 'manage' | 'research'>('overview');
  const castle = k.buildings.find(b => b.type === 'castle'); const used = k.buildings.reduce((a, b) => a + b.workers, 0); const cap = castle ? 2 + castle.level * 3 : 0;
  return (
    <div className="flex flex-col flex-1 min-h-0"><div className="flex gap-1 mb-2 flex-wrap">{(['overview', 'build', 'manage', 'research'] as const).map(t => <button key={t} className={`btn btn-sm ${sub === t ? 'btn-gold' : ''}`} onClick={() => { setSub(t); sfx('click'); }}>{t}</button>)}</div>
      <div className="scroll flex-1 min-h-0">
        {sub === 'overview' && <div className="space-y-3"><div className="glass p-3 text-sm"><div className="font-title text-[#ffe9a0] mb-1">🏰 KINGDOM OF HAVEN</div>{castle ? <div className="grid grid-cols-2 sm:grid-cols-4 gap-2"><div>Buildings <b>{k.buildings.length}</b></div><div>Workers <b>{k.workers}/{cap}</b> ({used} assigned)</div><div>Research <b>{Math.floor(k.research)}</b></div><div>Castle HP <b>{Math.ceil(k.castleHp)}/400</b></div></div> : <div className="text-slate-300">Fly to Haven Isle, craft Planks & Bricks (Craft tab) and place your Main Castle in the Build tab. Walk to the desired spot — the ghost building snaps to a grid in front of you.</div>}</div>
          <div className="glass p-3"><div className="font-title text-xs text-[#ffd23a] mb-2">STOREHOUSE</div><div className="flex flex-wrap gap-2">{['wood', 'stone', 'iron', 'plank', 'brick', 'ingot', 'crystal', 'food', 'gold'].map(r => <div key={r} className="item px-2 py-1 cursor-default text-sm">{ITEMS[r].icon} {s.inv[r] || 0}{capOf(s, r) < 9999 && <span className="text-[10px] text-slate-400">/{capOf(s, r)}</span>}</div>)}</div></div>
          <div className="glass p-3 flex items-center gap-3"><div className="flex-1"><div className="font-bold">Recruit a Worker</div><div className="text-xs text-slate-300">Costs 15 food + 30 gold. Workers boost production +60% each and construction speed. Assign them in Manage.</div></div><button className="btn btn-sm btn-gold" disabled={!castle || k.workers >= cap} onClick={() => { s.recruit(); sfx('pickup'); }}>Recruit</button></div></div>}
        {sub === 'build' && <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">{BUILD_ORDER.map(id => { const b = BUILDINGS[id]; const exists = k.buildings.some(x => x.type === id); const lock = id !== 'castle' && !castle; const can = s.has(b.cost) && !lock && !(id === 'castle' && exists); return <div key={id} className="item p-3 cursor-default"><div className="flex items-center gap-2"><span className="text-3xl">{b.icon}</span><div className="flex-1"><div className="font-bold text-sm">{b.name} {exists && <span className="text-[10px] text-green-300">×{k.buildings.filter(x => x.type === id).length}</span>}</div><div className="text-[11px] text-slate-300">{b.desc}</div></div></div><div className="mt-2"><Cost cost={b.cost} inv={s.inv} /></div><div className="flex justify-between items-center mt-2"><span className="text-[10px] text-slate-400">Build time {b.time}s{lock && ' · needs Castle'}</span><button className="btn btn-sm btn-gold" disabled={!can} onClick={() => { s.set_({ placing: id, panel: null }); s.toast('Walk to the build site on Haven Isle. E / Click confirms, R rotates, Esc cancels.', 'info'); sfx('open'); }}>Place</button></div></div>; })}</div>}
        {sub === 'manage' && <div className="space-y-2">{k.buildings.length === 0 && <div className="text-slate-400 text-sm">No buildings yet.</div>}{k.buildings.map(b => { const d = BUILDINGS[b.type]; const done = b.progress >= 1; const cost = buildCost(b.type, b.level + 1); return <div key={b.uid} className="item p-3 cursor-default"><div className="flex items-center gap-3"><span className="text-2xl">{d.icon}</span><div className="flex-1 min-w-0"><div className="font-bold text-sm">{d.name} <span className="text-[#ffd23a]">Lv {b.level}</span></div>{!done ? <div className="bar mt-1" style={{ height: 8 }}><i style={{ width: `${b.progress * 100}%`, background: 'linear-gradient(90deg,#c9962c,#ffe27a)' }} /></div> : <div className="text-[11px] text-slate-300">{d.produces ? `Produces ${ITEMS[d.produces[0]].icon} ${(d.produces[1] * b.level * (b.workers > 0 ? 1 + 0.6 * b.workers : 0.5)).toFixed(2)}/s` : d.desc}</div>}</div>
          {done && <div className="flex items-center gap-1 text-sm"><button className="btn btn-sm" onClick={() => s.assign(b.uid, -1)}>−</button><span className="w-14 text-center">👷 {b.workers}/{2 + b.level}</span><button className="btn btn-sm" disabled={used >= k.workers} onClick={() => s.assign(b.uid, 1)}>+</button></div>}</div>
          {done && b.level < 3 && <div className="flex items-center justify-between mt-2 gap-2"><Cost cost={cost} inv={s.inv} /><button className="btn btn-sm btn-gold shrink-0" disabled={!s.has(cost)} onClick={() => { s.upgradeBuilding(b.uid); sfx('build'); }}>Upgrade</button></div>}</div>; })}</div>}
        {sub === 'research' && <div className="space-y-2"><div className="glass p-3 text-sm">🔭 Research points: <b className="text-[#c9a4ff]">{Math.floor(k.research)}</b> {!buildingBuilt(s, 'research') && <span className="text-slate-400">— build a Research Tower to produce them.</span>}</div>{KINGDOM_UPGRADES.map(u => { const have = k.upgrades.includes(u.id); return <div key={u.id} className="item p-3 cursor-default flex items-center gap-3"><div className="flex-1"><div className="font-bold text-sm">{u.name}</div><div className="text-[11px] text-slate-300">{u.desc}</div></div>{have ? <span className="text-green-300 text-xs">RESEARCHED</span> : <button className="btn btn-sm btn-gold" disabled={k.research < u.cost} onClick={() => { s.unlockUpgrade(u.id); sfx('quest'); }}>{u.cost} RP</button>}</div>; })}</div>}
      </div>
    </div>
  );
}
void G;
