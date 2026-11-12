import { useMemo, useState, type ReactNode } from 'react';
import { useGame, type Overlay } from '../store';
import { CHARACTERS, CHAR_IDS } from '../data/characters';
import { ABILITIES, SKILLS, SKILL_CATEGORIES } from '../data/abilities';
import { ITEMS, EQUIP_SLOTS, slotOf, upgradeCost, MAX_UPGRADE } from '../data/items';
import { COLLECTIBLES } from '../data/world';
import { RANKS } from '../data/missions';
import { computeStats, xpForLevel, isAbilityUnlocked, isFormUnlocked, MAX_LEVEL } from '../logic/stats';
import { rankOf } from '../systems/missions';
import { audio } from '../audio';
import { input } from '../input';

export const closeOverlay = () => { audio.sfx('back'); useGame.getState().setOverlay(null); input.requestLock(); input.noteOverlayChange(); };

const TABS: { id: Overlay; label: string; icon: string }[] = [
  { id: 'status', label: 'Status', icon: '📊' }, { id: 'inventory', label: 'Items', icon: '🎒' }, { id: 'skills', label: 'Skills', icon: '🌀' },
  { id: 'characters', label: 'Characters', icon: '🥷' }, { id: 'missions', label: 'Missions', icon: '📜' }, { id: 'map', label: 'Map', icon: '🗺️' },
];
export function Frame({ title, tab, children, wide = false }: { title: string; tab?: Overlay; children: ReactNode; wide?: boolean }) {
  const setO = useGame((s) => s.setOverlay);
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/55 p-3 pointer-events-auto" data-ui style={{ animation: 'fadeIn .2s' }}>
      <div className={`panel flex max-h-[92vh] w-full ${wide ? 'max-w-6xl' : 'max-w-4xl'} flex-col`}>
        <div className="flex items-center justify-between gap-3 border-b border-orange-500/40 px-5 pt-3">
          <h2 className="anime-title text-2xl text-orange-400">{title}</h2>
          {tab && <div className="hidden flex-1 justify-center gap-0.5 md:flex">{TABS.map((t) => <button key={t.id} className={`tabbtn ${tab === t.id ? 'on' : ''}`} onClick={() => { audio.sfx('ui'); setO(t.id); }}>{t.icon} {t.label}</button>)}</div>}
          <button className="btn btn-sm mb-2" onClick={closeOverlay}><span>✕ Close</span></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

const Stat = ({ k, v, c = '#ffd24a' }: { k: string; v: ReactNode; c?: string }) => <div className="flex items-center justify-between border-b border-white/10 py-1 text-sm"><span className="text-slate-300">{k}</span><b style={{ color: c }}>{v}</b></div>;

export function StatusPanel() {
  const prof = useGame((s) => s.profile); const ch = CHARACTERS[prof.charId]; const c = prof.chars[prof.charId];
  const st = computeStats(ch, c.level, c.skills, prof.equipment, prof.upgrades); const rank = RANKS[rankOf()];
  const pool = ch.abilities.concat([ch.special, ...Object.values(ch.ultimates).filter(Boolean) as string[]]);
  const collected = COLLECTIBLES.filter((x) => !x.mission);
  return (
    <Frame title="Character Status" tab="status">
      <div className="grid gap-5 md:grid-cols-3">
        <div>
          <div className="mb-3 flex h-40 items-center justify-center text-7xl" style={{ background: `linear-gradient(135deg, ${ch.color}66, #0a0e28)`, border: `2px solid ${ch.color}` }}>🥷</div>
          <div className="anime-title text-2xl" style={{ color: ch.color }}>{ch.name}</div>
          <div className="text-xs uppercase tracking-widest text-slate-300">{ch.title}</div>
          <div className="mt-2 text-sm text-slate-200">{ch.desc}</div>
          <div className="mt-2 text-xs text-sky-200">{ch.identity}</div>
        </div>
        <div>
          <Stat k="Rank" v={`${rank.badge} ${rank.name}`} /><Stat k="Level" v={`${c.level}${c.level >= MAX_LEVEL ? ' (MAX)' : ''}`} />
          <div className="my-1 h-2 bg-black/60"><div className="h-full bg-fuchsia-400" style={{ width: `${(c.xp / xpForLevel(c.level)) * 100}%` }} /></div><div className="mb-2 text-right text-[11px] text-slate-400">{c.xp} / {xpForLevel(c.level)} XP</div>
          <Stat k="Skill points" v={c.sp} c="#7cffb0" /><Stat k="Max HP" v={st.maxHp} c="#7cff9a" /><Stat k="Max Chakra" v={st.maxChakra} c="#5ce0ff" />
          <Stat k="Attack" v={st.atk.toFixed(1)} /><Stat k="Defense" v={st.def.toFixed(1)} /><Stat k="Speed" v={st.speed.toFixed(1)} /><Stat k="Chakra regen" v={`${st.regen.toFixed(1)}/s`} /><Stat k="Crit chance" v={`${Math.round(st.crit * 100)}%`} />
        </div>
        <div>
          <Stat k="Ryo" v={prof.ryo.toLocaleString()} /><Stat k="Enemies defeated" v={prof.kills} /><Stat k="Missions complete" v={prof.completed.length} /><Stat k="Bosses defeated" v={prof.bossesDefeated.length} />
          <Stat k="Secrets found" v={`${prof.collected.filter((id) => collected.some((x) => x.id === id)).length} / ${collected.length}`} /><Stat k="Play time" v={`${Math.floor(prof.playtime / 60)} min`} />
          <Stat k="Sage Mode" v={isFormUnlocked('sage', prof.charId, c.level, c.skills, prof.flags) ? 'Unlocked' : 'Locked'} c={isFormUnlocked('sage', prof.charId, c.level, c.skills, prof.flags) ? '#7cff9a' : '#f88'} />
          <Stat k="Kurama Mode" v={isFormUnlocked('kurama', prof.charId, c.level, c.skills, prof.flags) ? 'Unlocked' : 'Locked'} c={isFormUnlocked('kurama', prof.charId, c.level, c.skills, prof.flags) ? '#7cff9a' : '#f88'} />
          <div className="mt-2 text-xs font-black uppercase tracking-widest text-orange-300">Equipment</div>
          {EQUIP_SLOTS.map((s) => <div key={s} className="flex justify-between text-sm"><span className="capitalize text-slate-400">{s}</span><span>{prof.equipment[s] ? `${ITEMS[prof.equipment[s]!].icon} ${ITEMS[prof.equipment[s]!].name}${prof.upgrades[prof.equipment[s]!] ? ` +${prof.upgrades[prof.equipment[s]!]}` : ''}` : '—'}</span></div>)}
        </div>
      </div>
      <div className="mt-5 text-xs font-black uppercase tracking-widest text-orange-300">Techniques</div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {[...new Set(pool)].map((id) => { const a = ABILITIES[id]; if (!a) return null; const un = isAbilityUnlocked(id, c.level, prof.flags) || !!a.needsForm; return (
          <div key={id} className={`slot-cell flex gap-3 p-2 ${un ? '' : 'opacity-50'}`}><div className="text-3xl">{a.icon}</div><div className="min-w-0"><div className="text-sm font-black">{a.name} {a.ult && <span className="chip text-fuchsia-300">Ultimate</span>} <span className="chip text-sky-300">{a.element}</span></div><div className="text-[11px] text-slate-300">{a.desc}</div><div className="text-[10px] text-slate-400">{a.cost} chakra • {a.cooldown}s cd{!un ? ` • unlocks Lv.${a.unlockLevel}${a.unlockFlag ? ' + quest' : ''}` : ''}</div></div></div>); })}
      </div>
    </Frame>
  );
}

export function InventoryPanel() {
  const prof = useGame((s) => s.profile); const g = useGame.getState();
  const [sel, setSel] = useState<string | null>(null); const [filter, setFilter] = useState('all');
  const ids = Object.keys(prof.inventory).filter((id) => ITEMS[id]);
  const list = ids.filter((id) => filter === 'all' || (filter === 'equip' ? !!slotOf(id) : filter === 'use' ? ['consumable', 'scroll', 'tool'].includes(ITEMS[id].type) : ['material', 'collectible'].includes(ITEMS[id].type)));
  const it = sel ? ITEMS[sel] : null; const count = sel ? prof.inventory[sel] ?? 0 : 0; const slot = sel ? slotOf(sel) : null; const lvl = sel ? prof.upgrades[sel] ?? 0 : 0;
  const cost = upgradeCost(lvl);
  return (
    <Frame title="Inventory" tab="inventory">
      <div className="mb-3 grid grid-cols-3 gap-2">
        {EQUIP_SLOTS.map((s) => { const id = prof.equipment[s]; return (
          <div key={s} className="slot-cell p-2 text-center" onClick={() => id && setSel(id)}><div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{s}</div><div className="text-2xl">{id ? ITEMS[id].icon : '·'}</div><div className={`truncate text-xs font-bold ${id ? `rar-${ITEMS[id].rarity}` : 'text-slate-500'}`}>{id ? ITEMS[id].name + (prof.upgrades[id] ? ` +${prof.upgrades[id]}` : '') : 'Empty'}</div>{id && <button className="mt-1 text-[10px] text-red-300 underline" onClick={(e) => { e.stopPropagation(); g.unequip(s); }}>unequip</button>}</div>); })}
      </div>
      <div className="mb-2 flex gap-1 border-b border-white/10">{[['all', 'All'], ['use', 'Use'], ['equip', 'Equipment'], ['mat', 'Materials']].map(([k, l]) => <button key={k} className={`tabbtn ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)}>{l}</button>)}<div className="ml-auto self-center text-sm font-bold text-amber-300">💰 {prof.ryo.toLocaleString()} ryo</div></div>
      <div className="grid gap-4 md:grid-cols-[1fr_18rem]">
        <div className="grid max-h-[40vh] grid-cols-4 content-start gap-2 overflow-y-auto pr-1 sm:grid-cols-5">
          {list.length === 0 && <div className="col-span-5 text-sm text-slate-400">Nothing here yet — defeat enemies, open chests and finish missions.</div>}
          {list.map((id) => (<div key={id} className={`slot-cell aspect-square p-1 text-center ${sel === id ? 'sel' : ''}`} onClick={() => { audio.sfx('ui', 0.5); setSel(id); }} title={ITEMS[id].name}><div className="mt-1 text-3xl">{ITEMS[id].icon}</div><div className={`truncate text-[10px] font-bold rar-${ITEMS[id].rarity}`}>{ITEMS[id].name}</div><div className="absolute right-1 top-0 text-xs font-black text-white">{prof.inventory[id]}</div>{(prof.equipment.weapon === id || prof.equipment.armor === id || prof.equipment.accessory === id) && <div className="absolute left-1 top-0 text-[10px] font-black text-emerald-300">E</div>}</div>))}
        </div>
        <div className="slot-cell min-h-[10rem] cursor-default p-3">
          {it ? (<>
            <div className="text-4xl">{it.icon}</div><div className={`font-black rar-${it.rarity}`}>{it.name} <span className="text-xs text-slate-400">×{count}</span></div>
            <div className="text-[11px] uppercase tracking-widest text-slate-400">{it.rarity} {it.type}</div><div className="my-2 text-sm text-slate-200">{it.desc}</div>
            {it.stats && <div className="text-xs text-emerald-300">{Object.entries(it.stats).map(([k, v]) => `${k} +${typeof v === 'number' && v < 1 && k !== 'speed' ? Math.round(v * 100) + '%' : v}`).join(' • ')}{lvl > 0 && ` (upgrade +${lvl}: stats ×${(1 + 0.15 * lvl).toFixed(2)})`}</div>}
            <div className="mt-3 flex flex-wrap gap-2">
              {it.use && <button className="btn btn-sm btn-primary" onClick={() => { g.useItem(sel!); audio.sfx('pickup'); }}><span>Use</span></button>}
              {slot && prof.equipment[slot] !== sel && <button className="btn btn-sm btn-primary" onClick={() => { g.equip(sel!); audio.sfx('confirm'); }}><span>Equip</span></button>}
              {slot && <button className="btn btn-sm" disabled={lvl >= MAX_UPGRADE || prof.ryo < cost.ryo || (prof.inventory.ironScrap ?? 0) < cost.scrap || (prof.inventory.chakraCrystal ?? 0) < cost.crystal} onClick={() => { if (g.upgradeItem(sel!)) audio.sfx('levelup', 0.6); else audio.sfx('error'); }}><span>Upgrade</span></button>}
            </div>
            {slot && lvl < MAX_UPGRADE && <div className="mt-1 text-[10px] text-slate-400">Upgrade: {cost.ryo} ryo, {cost.scrap}× Iron Scrap{cost.crystal ? `, ${cost.crystal}× Chakra Crystal` : ''}</div>}
          </>) : <div className="text-sm text-slate-400">Select an item. Quick use: ramen (H), chakra pill (N), throw kunai (Z).</div>}
        </div>
      </div>
    </Frame>
  );
}

export function SkillsPanel() {
  const prof = useGame((s) => s.profile); const g = useGame.getState(); const ch = CHARACTERS[prof.charId]; const c = prof.chars[prof.charId];
  const [slot, setSlot] = useState(0);
  return (
    <Frame title="Skill Tree" tab="skills" wide>
      <div className="mb-3 flex items-center gap-4 text-sm"><span className="anime-title text-xl" style={{ color: ch.color }}>{ch.name}</span><span className="chip text-emerald-300">Skill points: {c.sp}</span><span className="text-xs text-slate-400">Skill points are earned on level-up. Each character has their own tree and loadout.</span></div>
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        {SKILL_CATEGORIES.map((cat) => (
          <div key={cat.id}><div className="mb-1 border-b-2 pb-1 text-center text-[11px] font-black uppercase tracking-wider" style={{ color: cat.color, borderColor: cat.color }}>{cat.icon} {cat.name}</div>
            <div className="flex flex-col gap-2">{Object.values(SKILLS).filter((n) => n.category === cat.id).map((n) => {
              const owned = c.skills.includes(n.id); const needReq = n.requires && !c.skills.includes(n.requires); const lowLv = c.level < n.minLevel; const noSp = c.sp < n.cost; const narutoOnly = n.category === 'transform' && prof.charId !== 'naruto';
              const can = !owned && !needReq && !lowLv && !noSp && !narutoOnly;
              return (<button key={n.id} disabled={!can} onClick={() => { if (g.buySkill(n.id)) audio.sfx('levelup', 0.5); else audio.sfx('error'); }} className={`slot-cell p-2 text-left ${owned ? 'sel' : ''} ${!can && !owned ? 'opacity-50' : ''}`} style={{ borderColor: owned ? cat.color : undefined }}>
                <div className="flex items-center justify-between"><span className="text-xl">{n.icon}</span><span className="chip" style={{ color: owned ? '#7cff9a' : '#ffd24a' }}>{owned ? 'Learned' : `${n.cost} SP`}</span></div>
                <div className="text-xs font-black">{n.name}</div><div className="text-[10px] leading-3 text-slate-300">{n.desc}</div>
                {!owned && <div className="mt-1 text-[9px] text-red-300">{narutoOnly ? 'Naruto only' : needReq ? `Requires ${SKILLS[n.requires!].name}` : lowLv ? `Level ${n.minLevel}` : noSp ? 'Not enough SP' : ''}</div>}
              </button>);
            })}</div></div>
        ))}
      </div>
      <div className="mt-5 text-xs font-black uppercase tracking-widest text-orange-300">Ability loadout (keys 1–4)</div>
      <div className="mt-2 flex gap-2">{c.equipped.map((id, i) => { const a = ABILITIES[id]; return (<button key={i} className={`slot-cell h-16 w-24 p-1 text-center ${slot === i ? 'sel' : ''}`} onClick={() => setSlot(i)}><div className="text-xl">{a?.icon}</div><div className="truncate text-[10px] font-bold">{i + 1}: {a?.name}</div></button>); })}</div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{ch.abilities.map((id) => { const a = ABILITIES[id]; const un = isAbilityUnlocked(id, c.level, prof.flags); return (
        <button key={id} disabled={!un} className={`slot-cell flex gap-2 p-2 text-left ${!un ? 'opacity-40' : ''}`} onClick={() => { g.setEquipped(slot, id); audio.sfx('confirm', 0.6); }}><span className="text-2xl">{a.icon}</span><span className="min-w-0"><span className="block text-xs font-black">{a.name}</span><span className="block text-[10px] text-slate-300">{a.desc}</span><span className="block text-[10px] text-slate-400">{a.cost} chakra • {a.cooldown}s{!un ? ` • Lv.${a.unlockLevel}${a.unlockFlag ? ' + quest' : ''}` : ''}</span></span></button>); })}</div>
    </Frame>
  );
}

export function CharactersPanel() {
  const prof = useGame((s) => s.profile); const g = useGame.getState();
  return (
    <Frame title="Character Select" tab="characters" wide>
      <p className="mb-3 text-sm text-slate-300">Switch playable characters at any time. Each has unique movement, combo style and techniques. The Naruto campaign stays centered on Naruto; other heroes are great for exploration, side missions and boss fights.</p>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {CHAR_IDS.map((id) => { const ch = CHARACTERS[id]; const on = prof.unlocked.includes(id); const cur = prof.charId === id; const c = prof.chars[id]; const st = computeStats(ch, c.level, c.skills, prof.equipment, prof.upgrades);
          return (<div key={id} className={`slot-cell cursor-default p-3 ${cur ? 'sel' : ''} ${on ? '' : 'opacity-60'}`} style={{ borderColor: cur ? ch.color : undefined }}>
            <div className="flex items-center gap-3"><div className="flex h-14 w-14 items-center justify-center text-3xl" style={{ background: `linear-gradient(135deg,${ch.color}88,#0a0e28)`, border: `2px solid ${ch.color}` }}>{on ? '🥷' : '🔒'}</div>
              <div><div className="anime-title text-lg leading-none" style={{ color: ch.color }}>{ch.name}</div><div className="text-[10px] uppercase tracking-widest text-slate-400">{ch.title}</div>{on && <div className="text-xs font-bold text-yellow-300">Level {c.level}</div>}</div></div>
            <div className="mt-2 text-[11px] text-slate-300">{ch.identity}</div>
            <div className="mt-1 grid grid-cols-4 gap-1 text-center text-[10px]"><span className="bg-black/40 p-0.5">HP {st.maxHp}</span><span className="bg-black/40 p-0.5">CP {st.maxChakra}</span><span className="bg-black/40 p-0.5">ATK {st.atk.toFixed(0)}</span><span className="bg-black/40 p-0.5">SPD {ch.stats.speed}</span></div>
            <div className="mt-1 text-[10px] text-slate-400">Combo: {ch.combo.hits} hits • {ch.combo.style} • {ch.abilities.map((a) => ABILITIES[a]?.icon).join(' ')}</div>
            <div className="mt-2">{on ? <button className={`btn btn-sm ${cur ? '' : 'btn-primary'}`} disabled={cur} onClick={() => { g.selectCharacter(id); audio.sfx('confirm'); }}><span>{cur ? 'Active' : 'Select'}</span></button> : <span className="chip text-red-300">Unlock: {ch.unlock}</span>}</div>
          </div>); })}
      </div>
    </Frame>
  );
}

export function ShopPanel() {
  const prof = useGame((s) => s.profile); const items = useGame((s) => s.shopItems); const name = useGame((s) => s.shopName); const g = useGame.getState();
  const [msg, setMsg] = useState('');
  const sellable = useMemo(() => Object.keys(prof.inventory).filter((id) => ITEMS[id] && ITEMS[id].price > 0), [prof.inventory]);
  return (
    <Frame title={name || 'Shop'}>
      <div className="mb-3 text-right text-sm font-bold text-amber-300">💰 {prof.ryo.toLocaleString()} ryo {msg && <span className="ml-3 text-emerald-300">{msg}</span>}</div>
      <div className="grid gap-5 md:grid-cols-2">
        <div><div className="mb-1 text-xs font-black uppercase tracking-widest text-orange-300">Buy</div>
          <div className="flex flex-col gap-1.5">{items.map((id) => { const it = ITEMS[id]; return (<div key={id} className="slot-cell flex items-center gap-2 p-2"><span className="text-2xl">{it.icon}</span><div className="min-w-0 flex-1"><div className={`text-sm font-black rar-${it.rarity}`}>{it.name} <span className="text-[10px] text-slate-400">(own {prof.inventory[id] ?? 0})</span></div><div className="truncate text-[10px] text-slate-300">{it.desc}</div></div><button className="btn btn-sm btn-primary" disabled={prof.ryo < it.price} onClick={() => { if (g.buy(id)) { audio.sfx('pickup'); setMsg(`Bought ${it.name}`); } }}><span>{it.price}</span></button></div>); })}</div></div>
        <div><div className="mb-1 text-xs font-black uppercase tracking-widest text-orange-300">Sell (40% value)</div>
          <div className="flex max-h-[50vh] flex-col gap-1.5 overflow-y-auto">{sellable.length === 0 && <div className="text-sm text-slate-400">Nothing to sell.</div>}{sellable.map((id) => { const it = ITEMS[id]; const eq = [prof.equipment.weapon, prof.equipment.armor, prof.equipment.accessory].includes(id) && (prof.inventory[id] ?? 0) <= 1; return (<div key={id} className="slot-cell flex items-center gap-2 p-2"><span className="text-xl">{it.icon}</span><div className="flex-1 text-sm font-bold">{it.name} ×{prof.inventory[id]}</div><button className="btn btn-sm" disabled={eq} onClick={() => { g.sell(id); audio.sfx('pickup'); }}><span>{Math.floor(it.price * 0.4)}</span></button></div>); })}</div></div>
      </div>
    </Frame>
  );
}
