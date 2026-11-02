import { useEffect, useState } from 'react';
import { useGame, calcStats, equipScore, Panel } from '../game/store';
import { game } from '../game/engine';
import { audio } from '../game/audio';
import { Item, Slot, SLOTS, MATS, SKILLS, skillStats, skillNeedLevel, xpToNext, DUNGEONS, QUESTS, QUEST_BY_ID, RECIPES, upgradeCost, itemStats, sellValue, TF_STAGES, Quest, RARITY_COLOR } from '../game/data';
import { ItemChip, ItemDetail, Modal, Bar, SLOT_ICON, STAT_LABEL } from './common';

const NAV: [Panel, string][] = [['inventory', 'Inventory'], ['character', 'Character'], ['skills', 'Skills'], ['quests', 'Quests'], ['map', 'World Map'], ['settings', 'Settings']];
const close = () => { useGame.getState().closePanel(); game?.afterPanel(); };

function Nav({ cur }: { cur: Panel }) {
  const open = useGame((s) => s.openPanel);
  return <div className="flex gap-1">{NAV.map(([k, n]) => (<button key={k} className={`rounded-md px-3 py-1 text-xs font-bold uppercase tracking-wider transition ${cur === k ? 'bg-violet-600 text-white' : 'bg-white/5 text-zinc-300 hover:bg-white/15'}`} onClick={() => { audio.play('ui'); open(k); }}>{n}</button>))}</div>;
}

// ── Inventory ──
function Inventory() {
  const s = useGame(); const [sel, setSel] = useState<string | null>(null); const [f, setF] = useState('all');
  const all: Item[] = s.inventory; const eqItems = Object.values(s.equipment).filter(Boolean) as Item[];
  const item = [...all, ...eqItems].find((i) => i.id === sel); const isEq = !!item && eqItems.some((i) => i.id === item.id);
  const list = all.filter((i) => f === 'all' || (f === 'weapon' ? i.slot === 'weapon' : f === 'armor' ? ['helmet', 'chest', 'gloves', 'boots'].includes(i.slot) : i.slot === 'accessory'));
  const stats = calcStats(s);
  return (
    <Modal title="Inventory" onClose={close} wide tabs={<Nav cur="inventory" />}>
      <div className="grid gap-4 md:grid-cols-[210px_1fr_340px]">
        <div>
          <div className="mb-2 text-xs font-bold uppercase tracking-widest text-zinc-400">Equipment</div>
          <div className="grid grid-cols-3 gap-2">
            {SLOTS.map((sl) => { const it = s.equipment[sl as Slot]; return it ? <ItemChip key={sl} item={it} selected={sel === it.id} onClick={() => setSel(it.id)} small /> : <div key={sl} className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-white/20 text-xl opacity-40">{sl === 'weapon' ? '🗡️' : SLOT_ICON[sl]}</div>; })}
          </div>
          <div className="mt-4 space-y-1 rounded-lg bg-black/30 p-3 text-xs">
            <div className="flex justify-between"><span>Combat Rating</span><b className="text-amber-300">{stats.rating}</b></div>
            <div className="flex justify-between"><span>Equipment Score</span><b className="text-amber-300">{equipScore(s.equipment)}</b></div>
            <div className="flex justify-between"><span>ATK / DEF</span><b>{stats.atk} / {stats.def}</b></div>
            <div className="flex justify-between"><span>HP / Energy</span><b>{stats.hp} / {stats.en}</b></div>
            <div className="flex justify-between"><span>Crit</span><b>{stats.crit.toFixed(1)}% · {stats.critDmg}%</b></div>
          </div>
          <div className="mt-4 text-xs font-bold uppercase tracking-widest text-zinc-400">Materials & Consumables</div>
          <div className="mt-2 space-y-1 text-xs">
            {Object.entries(MATS).map(([k, m]) => (s.mats[k] ? (<div key={k} className="flex items-center justify-between rounded bg-black/30 px-2 py-1" title={m.desc}><span>{m.icon} {m.name}</span><span className="font-bold" style={{ color: m.color }}>x{s.mats[k]}</span></div>) : null))}
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs">{['all', 'weapon', 'armor', 'accessory'].map((k) => (<button key={k} onClick={() => setF(k)} className={`rounded px-2 py-1 font-bold uppercase ${f === k ? 'bg-violet-600' : 'bg-white/10'}`}>{k}</button>))}<span className="ml-auto text-zinc-400">{all.length}/80</span></div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-2">
            {list.map((it) => <ItemChip key={it.id} item={it} selected={sel === it.id} onClick={() => setSel(it.id)} badge={it.lvl > s.player.level ? `Lv${it.lvl}` : undefined} />)}
            {list.length === 0 && <div className="col-span-full py-10 text-center text-zinc-500">Nothing here yet — defeat monsters and open chests!</div>}
          </div>
        </div>
        <div>
          {item ? (
            <ItemDetail item={item} equipped={isEq ? undefined : s.equipment[item.slot]} extra={isEq ? <button className="btn" onClick={() => { s.unequip(item.slot); setSel(null); }}>Unequip</button> : (<>
              <button className="btn btn-gold" disabled={item.lvl > s.player.level} onClick={() => { s.equip(item.id); audio.play('ui'); }}>{item.lvl > s.player.level ? `Requires Lv ${item.lvl}` : 'Equip'}</button>
              <button className="btn btn-red" onClick={() => { s.sell(item.id); setSel(null); }}>Sell 🪙{sellValue(item)}</button></>)} />
          ) : <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-sm text-zinc-500">Select an item to inspect and compare it with your equipment.</div>}
          <div className="mt-3 flex gap-2 text-xs">{(['hp_potion', 'en_potion', 'elixir'] as const).map((k, i) => (<button key={k} className="btn !px-2 !py-1 !text-xs" disabled={!s.mats[k]} onClick={() => game?.usePotion(k)}>{MATS[k].icon} Use [{i + 1}] x{s.mats[k] || 0}</button>))}</div>
        </div>
      </div>
    </Modal>
  );
}

// ── Character ──
const HAIR_COLORS = ['#2a2438', '#7a3a2a', '#e8d8a0', '#d8e8ff', '#c84a6a', '#3a8a6a', '#ff8a3a'];
const OUTFITS = ['#3a5a8a', '#8a3a3a', '#3a8a5a', '#6a3a8a', '#8a7a3a', '#2a2a30', '#d8d8e0'];
function Character() {
  const s = useGame(); const P = s.player; const st = calcStats(s); const A = s.appearance;
  const attrs: ['str' | 'vit' | 'int' | 'dex', string, string][] = [['str', 'Strength', '+1.5 ATK'], ['vit', 'Vitality', '+8 HP, +0.5 DEF'], ['int', 'Intellect', '+3 Energy'], ['dex', 'Dexterity', '+0.4% Crit']];
  return (
    <Modal title="Character" onClose={close} wide tabs={<Nav cur="character" />}>
      <div className="grid gap-5 md:grid-cols-3">
        <div className="space-y-3">
          <div className="rounded-xl bg-black/30 p-4">
            <div className="text-2xl font-black text-violet-200">Level {P.level}</div>
            <Bar v={P.xp} max={xpToNext(P.level)} color="#e8c040" h={12} label={`${P.xp} / ${xpToNext(P.level)} XP`} />
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              {([['Combat Rating', st.rating], ['Equipment Score', equipScore(s.equipment)], ['Health', st.hp], ['Energy', st.en], ['Attack', st.atk], ['Defense', st.def], ['Crit Chance', st.crit.toFixed(1) + '%'], ['Crit Damage', st.critDmg + '%'], ['Energy Regen', st.regen.toFixed(1) + '/s'], ['Element', st.elem]] as [string, any][]).map(([k, v]) => (<div key={k} className="flex justify-between border-b border-white/5"><span className="text-zinc-400">{k}</span><b>{v}</b></div>))}
            </div>
          </div>
          <div className="rounded-xl bg-black/30 p-4">
            <div className="mb-2 flex justify-between text-xs font-bold uppercase tracking-widest text-zinc-400"><span>Attributes</span><span className="text-emerald-300">{P.attrPts} points</span></div>
            {attrs.map(([k, n, d]) => (<div key={k} className="mb-1 flex items-center justify-between text-sm"><div><b>{n}</b> <span className="text-[11px] text-zinc-400">{d}</span></div><div className="flex items-center gap-2"><b className="w-6 text-right">{P.attr[k]}</b><button className="btn !px-2 !py-0" disabled={P.attrPts < 1} onClick={() => s.spendAttr(k)}>+</button></div></div>))}
          </div>
        </div>
        <div className="space-y-3">
          <div className="rounded-xl bg-black/30 p-4">
            <div className="mb-2 text-xs font-bold uppercase tracking-widest text-zinc-400">Appearance</div>
            <div className="mb-2 text-xs text-zinc-300">Hair style</div>
            <div className="flex gap-2">{['Spiky', 'Long', 'Ponytail'].map((n, i) => (<button key={n} className={`btn !py-1 !text-xs ${A.hair === i ? '!border-white' : ''}`} onClick={() => s.setAppearance({ hair: i })}>{n}</button>))}</div>
            <div className="my-2 text-xs text-zinc-300">Hair color</div>
            <div className="flex flex-wrap gap-2">{HAIR_COLORS.map((c) => (<button key={c} className="h-7 w-7 rounded-full border-2" style={{ background: c, borderColor: A.hairColor === c ? '#fff' : '#444' }} onClick={() => s.setAppearance({ hairColor: c })} />))}</div>
            <div className="my-2 text-xs text-zinc-300">Outfit (unlockable outfits via story)</div>
            <div className="flex flex-wrap gap-2">{OUTFITS.map((c, i) => { const locked = i >= 3 && P.level < i * 4; return (<button key={c} disabled={locked} title={locked ? `Unlocks at level ${i * 4}` : ''} className="h-7 w-7 rounded border-2 disabled:opacity-30" style={{ background: c, borderColor: A.outfit === c ? '#fff' : '#444' }} onClick={() => s.setAppearance({ outfit: c })} />); })}</div>
            <div className="my-2 text-xs text-zinc-300">Accessory</div>
            <div className="flex gap-2">{(['none', 'scarf', 'cape'] as const).map((n) => (<button key={n} className={`btn !py-1 !text-xs capitalize ${A.accessory === n ? '!border-white' : ''}`} onClick={() => s.setAppearance({ accessory: n })}>{n}</button>))}</div>
            <div className="mt-2 text-[11px] text-zinc-500">Weapons and armor you equip change your character's look. Transformation changes hair, eyes, aura and weapon glow.</div>
          </div>
          <div className="rounded-xl bg-black/30 p-4 text-sm">
            <div className="mb-1 text-xs font-bold uppercase tracking-widest text-zinc-400">Awakening Forms</div>
            {TF_STAGES.map((t, i) => (<div key={t.name} className={`flex justify-between ${i + 1 <= P.tfStage ? '' : 'opacity-40'}`}><span style={{ color: '#' + t.color.toString(16).padStart(6, '0') }}>{i + 1 <= P.tfStage ? '✦' : '🔒'} {t.name}</span><span className="text-xs text-zinc-400">×{t.dmg} dmg · ×{t.aspd} speed · {t.dur}s</span></div>))}
          </div>
        </div>
        <div className="space-y-3">
          <div className="rounded-xl bg-black/30 p-4 text-sm">
            <div className="mb-2 text-xs font-bold uppercase tracking-widest text-zinc-400">Dungeon Record</div>
            {DUNGEONS.map((d) => (<div key={d.id} className="flex items-center justify-between border-b border-white/5 py-1"><span style={{ color: '#' + d.color.toString(16).padStart(6, '0') }}>{s.progress.completed[d.id] ? '✔' : '○'} {d.name}</span><span className="text-xs text-zinc-400">Lv {d.level} · cleared ×{s.progress.completed[d.id] || 0}</span></div>))}
          </div>
          <div className="rounded-xl bg-black/30 p-4 text-sm">
            <div className="mb-2 text-xs font-bold uppercase tracking-widest text-zinc-400">Journey</div>
            <div className="grid grid-cols-2 gap-1 text-xs">
              <span>Chapter</span><b>{Math.min(6, s.progress.chapter)} / 6</b><span>Play time</span><b>{Math.floor(s.progress.playTime / 60)} min</b><span>Monsters slain</span><b>{Object.values(s.progress.kills).reduce((a, b) => a + b, 0)}</b><span>Chests opened</span><b>{s.progress.chestCount}</b><span>Secrets found</span><b>{s.progress.secrets.length}</b><span>Defeats</span><b>{s.progress.deaths}</b>
            </div>
            <div className="mt-3 text-xs font-bold uppercase tracking-widest text-zinc-400">Achievements</div>
            <div className="mt-1 flex flex-wrap gap-1 text-[11px]">{s.progress.achievements.length ? s.progress.achievements.map((a) => <span key={a} className="rounded bg-amber-500/20 px-2 py-0.5 text-amber-200">🏆 {a.replace('boss_', 'Boss: ')}</span>) : <span className="text-zinc-500">None yet</span>}</div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ── Skills ──
function Skills() {
  const s = useGame(); const P = s.player;
  return (
    <Modal title="Skills" onClose={close} wide tabs={<Nav cur="skills" />}>
      <div className="mb-3 flex items-center justify-between rounded-lg bg-black/30 px-4 py-2"><span className="text-sm text-zinc-300">Spend skill points to improve damage, range, cooldowns, energy cost and unlock new effects.</span><b className="text-lg text-emerald-300">✦ {P.skillPts} points</b></div>
      <div className="grid gap-3 md:grid-cols-2">
        {SKILLS.map((d) => {
          const r = P.skills[d.id] ?? 0; const need = skillNeedLevel(d, r); const can = r < d.max && P.skillPts > 0 && P.level >= need; const sk: any = d.kind === 'active' && d.id !== 'awaken' ? skillStats(d.id, r) : null;
          return (
            <div key={d.id} className="rounded-xl p-4" style={{ border: `1px solid ${d.color}66`, background: `linear-gradient(160deg, ${d.color}1a, rgba(10,8,20,.85))` }}>
              <div className="flex items-center justify-between"><div><span className="text-lg font-black" style={{ color: d.color }}>{d.name}</span>{d.key && <span className="ml-2 rounded bg-white/15 px-2 text-xs font-bold">{d.key}</span>}</div><div className="flex gap-1">{Array.from({ length: d.max }).map((_, i) => <span key={i} className="h-2.5 w-2.5 rounded-full" style={{ background: i < r ? d.color : '#333' }} />)}</div></div>
              <div className="mt-1 text-xs text-zinc-300">{d.desc}</div>
              {sk && <div className="mt-2 grid grid-cols-3 gap-1 text-[11px] text-zinc-300"><span>Damage <b className="text-white">{Math.round(sk.dmg * 100)}%</b>{d.id === 'judgment' && ` ×${sk.waves}`}</span><span>Energy <b className="text-sky-300">{Math.round(sk.cost)}</b></span><span>Cooldown <b className="text-white">{sk.cd.toFixed(1)}s</b></span>{sk.range && <span>Range <b className="text-white">{sk.range.toFixed(0)}m</b></span>}{sk.radius && <span>Radius <b className="text-white">{sk.radius}m</b></span>}</div>}
              {d.id === 'awaken' && <div className="mt-2 text-[11px] text-zinc-300">Duration <b className="text-white">{TF_STAGES[P.tfStage - 1].dur + (r - 1) * 2}s</b> · Form: <b style={{ color: '#' + TF_STAGES[P.tfStage - 1].color.toString(16).padStart(6, '0') }}>{TF_STAGES[P.tfStage - 1].name}</b></div>}
              {d.ranks.length > 0 && <div className="mt-2 space-y-0.5 text-[11px]">{d.ranks.map((t, i) => <div key={i} className={i < r ? 'text-zinc-100' : 'text-zinc-500'}>{i < r ? '◆' : '◇'} Rank {i + 1}: {t}</div>)}</div>}
              <div className="mt-3 flex items-center justify-between"><span className="text-[11px] text-zinc-400">{r >= d.max ? 'MAX RANK' : `Next: level ${need}${P.level < need ? ' (locked)' : ''}`}</span><button className="btn !py-1 !text-xs" disabled={!can} onClick={() => { s.spendSkill(d.id); audio.play('ui'); }}>Upgrade (1 pt)</button></div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

// ── Quests ──
function QuestRow({ q, st, sel, onClick }: { q: Quest; st?: string; sel: boolean; onClick: () => void }) {
  return <button onClick={onClick} className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${sel ? 'bg-violet-600/50' : 'bg-white/5 hover:bg-white/10'}`}><span className={q.type === 'main' ? 'text-amber-300' : 'text-sky-300'}>{q.type === 'main' ? '★' : '◆'}</span> {q.title} {st === 'done' && <span className="text-emerald-400">✔</span>}</button>;
}
function Quests() {
  const s = useGame(); const [sel, setSel] = useState<string>(s.tracked || 'm1');
  const active = QUESTS.filter((q) => s.quests[q.id]?.s === 'active'); const done = QUESTS.filter((q) => s.quests[q.id]?.s === 'done'); const q = QUEST_BY_ID[sel]; const qs = s.quests[sel];
  return (
    <Modal title="Quests" onClose={close} wide tabs={<Nav cur="quests" />}>
      <div className="grid gap-4 md:grid-cols-[280px_1fr]">
        <div className="space-y-1">
          <div className="text-xs font-bold uppercase tracking-widest text-zinc-400">Active</div>
          {active.map((x) => <QuestRow key={x.id} q={x} sel={sel === x.id} onClick={() => setSel(x.id)} />)}{active.length === 0 && <div className="text-xs text-zinc-500">No active quests. Visit the Quest Board.</div>}
          <div className="pt-2 text-xs font-bold uppercase tracking-widest text-zinc-400">Completed</div>
          {done.map((x) => <QuestRow key={x.id} q={x} st="done" sel={sel === x.id} onClick={() => setSel(x.id)} />)}
        </div>
        <div className="rounded-xl bg-black/30 p-5">
          {q ? (<>
            <div className="text-xs font-bold uppercase tracking-widest text-zinc-400">{q.type === 'main' ? `Main Story — Chapter ${q.chapter}` : 'Side Quest'}</div>
            <div className="text-2xl font-black text-amber-200">{q.title}</div>
            <p className="mt-2 text-sm text-zinc-300">{q.desc}</p>
            <div className="mt-4 space-y-2">{q.obj.map((o, i) => { const pr = qs ? (o.k === 'collect' ? Math.min(o.n, s.mats[o.t] || 0) : o.k === 'level' ? Math.min(o.n, s.player.level) : qs.p[i] || 0) : 0; return (<div key={i}><div className="flex justify-between text-sm"><span>{pr >= o.n ? '✔' : '○'} {o.text}</span><b>{pr}/{o.n}</b></div><Bar v={pr} max={o.n} color="#7ad8ff" h={5} /></div>); })}</div>
            <div className="mt-4 rounded-lg bg-black/40 p-3 text-sm"><div className="mb-1 text-xs font-bold uppercase tracking-widest text-zinc-400">Rewards</div>⭐ {q.reward.xp} XP · 🪙 {q.reward.gold}{q.reward.gear && <> · 🎁 {q.reward.gear} gear</>}{q.reward.mats && Object.entries(q.reward.mats).map(([k, n]) => <span key={k}> · {MATS[k].icon} {n}</span>)}{q.reward.unlock && <span className="text-fuchsia-300"> · ✨ Transformation evolves</span>}</div>
            {qs?.s === 'active' && <button className="btn mt-4" onClick={() => s.track(q.id)}>{s.tracked === q.id ? '◈ Tracked' : 'Track Quest'}</button>}
          </>) : <div className="text-zinc-500">Select a quest.</div>}
        </div>
      </div>
    </Modal>
  );
}

// ── World map ──
function WorldMap() {
  const s = useGame(); const [sel, setSel] = useState<string>('village'); const [pos, setPos] = useState({ x: 0, z: 0, w: true });
  useEffect(() => { const t = setInterval(() => { if (game) setPos({ x: game.p.pos.x, z: game.p.pos.z, w: game.level.kind === 'world' }); }, 250); return () => clearInterval(t); }, []);
  const S = 520; const m = (v: number) => ((v + 125) / 250) * S; const d = DUNGEONS.find((x) => x.id === sel);
  const active = QUESTS.filter((q) => s.quests[q.id]?.s === 'active'); const markers: { x: number; z: number; t: string }[] = [];
  for (const q of active) for (const o of q.obj) { if (o.k === 'boss') { const dd = DUNGEONS.find((x) => x.boss === o.t); if (dd) markers.push({ x: dd.wx, z: dd.wz, t: q.title }); } if (o.k === 'clear' && o.t !== '*') { const dd = DUNGEONS.find((x) => x.id === o.t); if (dd) markers.push({ x: dd.wx, z: dd.wz, t: q.title }); } if (o.k === 'talk') markers.push({ x: -12, z: -7, t: q.title }); if (o.t === 'dummy') markers.push({ x: -34, z: 14, t: q.title }); }
  const unlockedTravel = (id: string) => id === 'village' || (s.progress.completed[id] || 0) > 0;
  return (
    <Modal title="World Map" onClose={close} wide tabs={<Nav cur="map" />}>
      <div className="grid gap-4 md:grid-cols-[540px_1fr]">
        <svg viewBox={`0 0 ${S} ${S}`} className="w-full rounded-xl" style={{ background: 'radial-gradient(circle at 50% 50%, #2c4a2c, #16261a 70%, #0c120e)', border: '2px solid #5a4a8a' }}>
          {Array.from({ length: 11 }).map((_, i) => <line key={i} x1={i * S / 10} y1={0} x2={i * S / 10} y2={S} stroke="#ffffff10" />)}{Array.from({ length: 11 }).map((_, i) => <line key={'h' + i} x1={0} y1={i * S / 10} x2={S} y2={i * S / 10} stroke="#ffffff10" />)}
          <rect x={m(-112)} y={m(-112)} width={m(112) - m(-112)} height={m(112) - m(-112)} fill="none" stroke="#8a8aa066" strokeDasharray="6 6" />
          {DUNGEONS.map((x) => <line key={x.id} x1={m(0)} y1={m(0)} x2={m(x.wx)} y2={m(x.wz)} stroke="#c8a86a55" strokeWidth={3} />)}
          <g onClick={() => setSel('village')} style={{ cursor: 'pointer' }}><circle cx={m(0)} cy={m(0)} r={13} fill="#d8b04a" stroke={sel === 'village' ? '#fff' : '#6a4a1a'} strokeWidth={3} /><text x={m(0)} y={m(0) + 28} textAnchor="middle" fill="#ffe9a0" fontSize={12} fontWeight="bold">Hearthvale</text></g>
          {[['Ruins', -80, 22], ['Cave', 96, -86], ['Stones', 48, 30]].map(([n, x, z]) => (<g key={n as string}><text x={m(x as number)} y={m(z as number)} textAnchor="middle" fontSize={16} opacity={s.progress.secrets.includes((n as string) === 'Ruins' ? 'ruins' : (n as string) === 'Cave' ? 'cave' : 'stones') ? 1 : 0.35}>🧭</text><text x={m(x as number)} y={m(z as number) + 14} textAnchor="middle" fill="#9ad" fontSize={9}>{s.progress.secrets.includes((n as string) === 'Ruins' ? 'ruins' : (n as string) === 'Cave' ? 'cave' : 'stones') ? n as string : '???'}</text></g>))}
          {DUNGEONS.map((x) => { const c = '#' + x.color.toString(16).padStart(6, '0'); const done = (s.progress.completed[x.id] || 0) > 0; return (<g key={x.id} onClick={() => setSel(x.id)} style={{ cursor: 'pointer' }}><circle cx={m(x.wx)} cy={m(x.wz)} r={14} fill={c + '55'} stroke={sel === x.id ? '#fff' : c} strokeWidth={3} /><text x={m(x.wx)} y={m(x.wz) + 5} textAnchor="middle" fontSize={14}>{done ? '✔' : '🌀'}</text><text x={m(x.wx)} y={m(x.wz) + 30} textAnchor="middle" fill={c} fontSize={11} fontWeight="bold">{x.name}</text></g>); })}
          {markers.map((k, i) => <g key={i}><circle cx={m(k.x)} cy={m(k.z) - 24} r={6} fill="#ffd24a" stroke="#000" /><text x={m(k.x)} y={m(k.z) - 21} textAnchor="middle" fontSize={9} fontWeight="bold">!</text></g>)}
          {pos.w && <g><circle cx={m(pos.x)} cy={m(pos.z)} r={8} fill="#7ad8ff" stroke="#fff" strokeWidth={2}><animate attributeName="r" values="7;11;7" dur="1.4s" repeatCount="indefinite" /></circle><text x={m(pos.x)} y={m(pos.z) - 12} textAnchor="middle" fill="#fff" fontSize={10} fontWeight="bold">YOU</text></g>}
        </svg>
        <div className="rounded-xl bg-black/30 p-4">
          {d ? (<>
            <div className="text-2xl font-black" style={{ color: '#' + d.color.toString(16).padStart(6, '0') }}>{d.name}</div>
            <div className="text-sm text-zinc-400">Recommended level {d.level} · Boss: {d.boss.replace(/^\w/, (c) => c.toUpperCase())}</div>
            <p className="mt-2 text-sm text-zinc-300">{d.desc}</p>
            <div className="mt-3 text-sm">Cleared: <b>{s.progress.completed[d.id] || 0}</b> time(s) · Boss kills: <b>{s.progress.bossKills[d.id === 'catacombs' ? 'bonewarden' : d.boss] || 0}</b></div>
            <div className="mt-2 text-xs text-zinc-400">Drops: {d.mat.replace('_', ' ')}</div>
            {s.player.level < d.level && <div className="mt-2 text-xs text-rose-300">⚠ Dangerous — you are below the recommended level.</div>}
            <button className="btn btn-gold mt-4" disabled={!unlockedTravel(d.id) || !pos.w} onClick={() => { game?.fastTravel(d.id); close(); }}>{unlockedTravel(d.id) ? (pos.w ? 'Fast Travel to Portal' : 'Leave the dungeon first') : '🔒 Clear once to unlock fast travel'}</button>
          </>) : (<>
            <div className="text-2xl font-black text-amber-200">Hearthvale</div><p className="mt-2 text-sm text-zinc-300">A mountain-ringed village at the heart of Aurelith. Blacksmith, merchant, training yard, quest board and the Elder await.</p>
            <button className="btn btn-gold mt-4" disabled={!pos.w} onClick={() => { game?.fastTravel('village'); close(); }}>{pos.w ? 'Fast Travel to Hearthvale' : 'Leave the dungeon first'}</button>
          </>)}
          <div className="mt-4 text-xs text-zinc-400">Legend: 🌀 portal · ✔ cleared · ! quest target · 🧭 secret site</div>
        </div>
      </div>
    </Modal>
  );
}

// ── Settings ──
function Settings() {
  const s = useGame(); const S = s.settings; const [confirm, setConfirm] = useState(false);
  const Sl = ({ k, label }: { k: 'master' | 'music' | 'sfx' | 'ambience'; label: string }) => (<label className="flex items-center justify-between gap-4 text-sm"><span className="w-28">{label}</span><input type="range" min={0} max={1} step={0.05} value={S[k]} onChange={(e) => s.setSettings({ [k]: +e.target.value } as any)} className="flex-1" /><b className="w-10 text-right">{Math.round(S[k] * 100)}</b></label>);
  return (
    <Modal title="Settings" onClose={close} tabs={useGame.getState().screen === 'play' ? <Nav cur="settings" /> : undefined}>
      <div className="space-y-5">
        <div className="space-y-3 rounded-xl bg-black/30 p-4"><div className="text-xs font-bold uppercase tracking-widest text-zinc-400">Audio</div><Sl k="master" label="Master" /><Sl k="music" label="Music" /><Sl k="sfx" label="Sound effects" /><Sl k="ambience" label="Ambience" /></div>
        <div className="space-y-3 rounded-xl bg-black/30 p-4">
          <div className="text-xs font-bold uppercase tracking-widest text-zinc-400">Graphics & Controls</div>
          <div className="flex items-center justify-between text-sm"><span>Graphics quality</span><div className="flex gap-1">{(['low', 'medium', 'high'] as const).map((q) => (<button key={q} className={`btn !py-1 !text-xs capitalize ${S.quality === q ? '!border-white !bg-violet-600' : ''}`} onClick={() => s.setSettings({ quality: q })}>{q}</button>))}</div></div>
          <div className="text-[11px] text-zinc-500">Low: no shadows/bloom, fewer trees · Medium: shadows · High: shadows + bloom post-processing. Trees/decor density applies when entering a new area.</div>
          <label className="flex items-center justify-between gap-4 text-sm"><span className="w-40">Mouse sensitivity</span><input type="range" min={0.3} max={2.5} step={0.1} value={S.sens} onChange={(e) => s.setSettings({ sens: +e.target.value })} className="flex-1" /><b className="w-10 text-right">{S.sens.toFixed(1)}</b></label>
          <label className="flex items-center justify-between text-sm"><span>Invert vertical camera</span><input type="checkbox" checked={S.invertY} onChange={(e) => s.setSettings({ invertY: e.target.checked })} /></label>
          <label className="flex items-center justify-between text-sm"><span>Camera shake</span><input type="checkbox" checked={S.shake} onChange={(e) => s.setSettings({ shake: e.target.checked })} /></label>
        </div>
        <div className="rounded-xl bg-black/30 p-4 text-xs leading-relaxed text-zinc-300"><div className="mb-1 text-xs font-bold uppercase tracking-widest text-zinc-400">Controls</div>
          WASD move relative to camera · Mouse rotates camera · Wheel zoom · RMB lock-on · F or LMB combo attack · double-tap S (or hold S + F) low sweep · E Abyssal Burst · R Shadow Rift · V Abyssal Judgment · T Awakening · Q block (tap just before impact to parry) · Shift sprint / dodge in combat · Space jump (F in air = dive attack) · G interact · 1/2/3 potions · I inventory · C character · K skills · J quests · M map · Esc pause / release mouse.</div>
        <div className="flex justify-end">{!confirm ? <button className="btn btn-red !text-xs" onClick={() => setConfirm(true)}>Delete save…</button> : <div className="flex items-center gap-2 text-sm"><span className="text-rose-300">Erase ALL progress?</span><button className="btn btn-red !text-xs" onClick={() => { s.wipe(); setConfirm(false); }}>Yes, erase</button><button className="btn !text-xs" onClick={() => setConfirm(false)}>Cancel</button></div>}</div>
      </div>
    </Modal>
  );
}

// ── Shop ──
function Shop() {
  const s = useGame(); const [tab, setTab] = useState<'buy' | 'sell'>('buy'); const [sel, setSel] = useState<number>(-1); const [sid, setSid] = useState<string | null>(null);
  const price = (it: Item) => Math.round(sellValue(it) * 3.2 + 30); const it = tab === 'buy' ? s.shop[sel] : s.inventory.find((i) => i.id === sid);
  return (
    <Modal title="Lyra's Wares" onClose={close} wide>
      <div className="mb-3 flex items-center justify-between"><div className="flex gap-2"><button className={`btn ${tab === 'buy' ? '!bg-violet-600' : ''}`} onClick={() => setTab('buy')}>Buy</button><button className={`btn ${tab === 'sell' ? '!bg-violet-600' : ''}`} onClick={() => setTab('sell')}>Sell</button></div><b className="text-amber-300">🪙 {s.player.gold}</b></div>
      <div className="mb-4 flex flex-wrap gap-2 rounded-lg bg-black/30 p-3 text-sm">
        <span className="text-zinc-400">Supplies:</span>
        <button className="btn !py-1 !text-xs" disabled={s.player.gold < 40} onClick={() => { s.addGold(-40); s.addMat('hp_potion', 1); }}>🧪 Healing Draught 🪙40</button>
        <button className="btn !py-1 !text-xs" disabled={s.player.gold < 55} onClick={() => { s.addGold(-55); s.addMat('en_potion', 1); }}>⚗️ Energy Tonic 🪙55</button>
        <button className="btn !py-1 !text-xs" disabled={s.player.gold < 100} onClick={() => { s.restock(); s.addGold(-100); }}>↻ Restock gear 🪙100</button>
      </div>
      <div className="grid gap-4 md:grid-cols-[1fr_340px]">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-2">
          {tab === 'buy' ? s.shop.map((x, i) => <ItemChip key={x.id} item={x} selected={sel === i} onClick={() => setSel(i)} />) : s.inventory.map((x) => <ItemChip key={x.id} item={x} selected={sid === x.id} onClick={() => setSid(x.id)} />)}
        </div>
        <div>{it ? <ItemDetail item={it} equipped={s.equipment[it.slot]} extra={tab === 'buy' ? <button className="btn btn-gold" disabled={s.player.gold < price(it)} onClick={() => { s.buy(sel); setSel(-1); audio.play('pickup'); }}>Buy 🪙{price(it)}</button> : <button className="btn btn-red" onClick={() => { s.sell(it.id); setSid(null); audio.play('pickup'); }}>Sell 🪙{sellValue(it)}</button>} /> : <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-sm text-zinc-500">Select an item.</div>}</div>
      </div>
    </Modal>
  );
}

// ── Blacksmith ──
function Smith() {
  const s = useGame(); const [tab, setTab] = useState<'up' | 'craft'>('up'); const [sid, setSid] = useState<string | null>(null);
  const eq = Object.values(s.equipment).filter(Boolean) as Item[]; const all = [...eq, ...s.inventory]; const it = all.find((i) => i.id === sid); const c = it ? upgradeCost(it) : null;
  const next = it ? itemStats({ ...it, up: it.up + 1 }) : null;
  return (
    <Modal title="Torvald's Forge" onClose={close} wide>
      <div className="mb-3 flex items-center justify-between"><div className="flex gap-2"><button className={`btn ${tab === 'up' ? '!bg-violet-600' : ''}`} onClick={() => setTab('up')}>Upgrade</button><button className={`btn ${tab === 'craft' ? '!bg-violet-600' : ''}`} onClick={() => setTab('craft')}>Craft</button></div><div className="text-sm"><b className="text-amber-300">🪙 {s.player.gold}</b> · ⛏️ {s.mats.iron_ore || 0} ore · 🐉 {s.mats.dragon_scale || 0} · 💎 {s.mats.abyss_crystal || 0}</div></div>
      {tab === 'up' ? (
        <div className="grid gap-4 md:grid-cols-[1fr_360px]">
          <div><div className="mb-1 text-xs uppercase tracking-widest text-zinc-400">Equipped</div><div className="mb-3 flex flex-wrap gap-2">{eq.map((x) => <ItemChip key={x.id} item={x} selected={sid === x.id} onClick={() => setSid(x.id)} />)}</div><div className="mb-1 text-xs uppercase tracking-widest text-zinc-400">Backpack</div><div className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-2">{s.inventory.map((x) => <ItemChip key={x.id} item={x} selected={sid === x.id} onClick={() => setSid(x.id)} />)}</div></div>
          <div>{it && c ? <ItemDetail item={it} extra={it.up >= 10 ? <span className="text-amber-300">Maximum upgrade reached</span> : (<div className="w-full space-y-2"><div className="rounded bg-black/40 p-2 text-xs">Upgrade to <b className="text-amber-300">+{it.up + 1}</b>: {Object.entries(next!).map(([k, v]) => <span key={k} className="mr-2 text-emerald-300">{STAT_LABEL[k as keyof typeof STAT_LABEL]} {v}</span>)}<div className="mt-1 text-zinc-300">Cost: 🪙{c.gold} · ⛏️ {c.ore}{c.rare && <> · {MATS[c.rare.id].icon} {c.rare.n}</>}</div></div><button className="btn btn-gold w-full" onClick={() => { s.upgrade(it.id); audio.play('chest'); }}>🔨 Upgrade</button></div>)} /> : <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-sm text-zinc-500">Choose gear to reinforce. Each level adds +12% stats.</div>}</div>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {RECIPES.map((r) => { const ok = s.player.gold >= r.gold && Object.entries(r.cost).every(([m, n]) => (s.mats[m] || 0) >= n); return (
            <div key={r.id} className="rounded-xl bg-black/30 p-3 text-sm" style={{ border: `1px solid ${r.gear ? RARITY_COLOR[r.gear.rarity] + '88' : '#ffffff22'}` }}>
              <div className="font-bold">{r.name}</div><div className="text-xs text-zinc-400">{r.desc}</div>
              <div className="mt-1 flex flex-wrap gap-2 text-xs">{Object.entries(r.cost).map(([m, n]) => <span key={m} style={{ color: (s.mats[m] || 0) >= n ? '#7affc0' : '#ff7a8a' }}>{MATS[m].icon} {s.mats[m] || 0}/{n}</span>)}<span style={{ color: s.player.gold >= r.gold ? '#ffd24a' : '#ff7a8a' }}>🪙 {r.gold}</span></div>
              <button className="btn mt-2 !py-1 !text-xs" disabled={!ok} onClick={() => { s.craft(r.id); audio.play('chest'); }}>Craft</button>
            </div>); })}
        </div>
      )}
    </Modal>
  );
}

// ── Quest board ──
function Board() {
  const s = useGame(); const avail = QUESTS.filter((q) => q.type === 'side' && !s.quests[q.id] && (!q.req?.level || s.player.level >= q.req.level));
  const locked = QUESTS.filter((q) => q.type === 'side' && !s.quests[q.id] && q.req?.level && s.player.level < q.req.level);
  return (
    <Modal title="Quest Board" onClose={close}>
      <div className="space-y-3">
        {avail.map((q) => (<div key={q.id} className="rounded-xl bg-black/30 p-3"><div className="flex items-center justify-between"><div className="font-black text-sky-300">◆ {q.title}</div><button className="btn !py-1 !text-xs" onClick={() => { s.acceptQuest(q.id); audio.play('quest'); }}>Accept</button></div><div className="text-sm text-zinc-300">{q.desc}</div><div className="mt-1 text-xs text-zinc-400">{q.obj.map((o) => `${o.text} ×${o.n}`).join(', ')} · ⭐{q.reward.xp} 🪙{q.reward.gold}{q.reward.gear ? ` 🎁${q.reward.gear}` : ''}</div></div>))}
        {avail.length === 0 && <div className="text-center text-zinc-500">No new requests. Check back as you grow stronger.</div>}
        {locked.length > 0 && <div className="text-xs text-zinc-500">Locked: {locked.map((q) => `${q.title} (Lv ${q.req!.level})`).join(' · ')}</div>}
      </div>
    </Modal>
  );
}
function Dialogue() {
  const d = useGame((s) => s.panelData) || {};
  return (<Modal title={d.name || 'Speaker'} onClose={close}><p className="text-lg leading-relaxed text-zinc-100">“{d.text}”</p><div className="mt-5 text-right"><button className="btn" onClick={close}>Continue</button></div></Modal>);
}

export default function PanelHost() {
  const p = useGame((s) => s.panel);
  switch (p) {
    case 'inventory': return <Inventory />; case 'character': return <Character />; case 'skills': return <Skills />; case 'quests': return <Quests />; case 'map': return <WorldMap />;
    case 'settings': return <Settings />; case 'shop': return <Shop />; case 'smith': return <Smith />; case 'board': return <Board />; case 'dialogue': return <Dialogue />;
    default: return null;
  }
}
