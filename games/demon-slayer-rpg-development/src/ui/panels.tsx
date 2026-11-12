import { useState } from 'react';
import { useStore } from '../game/store';
import { CHARACTERS, CHAR_BY_ID, PASSIVES } from '../game/data/characters';
import { ALL_SKILLS, STYLES } from '../game/data/styles';
import { EQUIPMENT, ITEMS, SHOP, SWORDS, swordMult, upgradeCost } from '../game/data/items';
import { computeStats, skillStatus, xpNeed } from '../game/engine/stats';
import { Bar, Portrait } from './common';
import { audio } from '../game/audio';
import type { SkillDef } from '../game/types';

const hx = (c: number) => '#' + c.toString(16).padStart(6, '0');
const KIND_ICON: Record<string, string> = { dash: '➤', arc: '◜', spin: '⟳', multi: '✦', proj: '☄', slam: '⬇', ult: '★' };

export function unlockText(id: string) {
  const u = CHAR_BY_ID[id].unlock;
  if (u.type === 'start') return 'Available from the start';
  if (u.type === 'chapter') return `Story: complete Chapter ${u.chapter}`;
  return `Hashira Trial (opens after Chapter ${u.chapter}) — or via story progression`;
}

export function Roster({ sel, onSel, cols }: { sel: string; onSel: (id: string) => void; cols?: number }) {
  const prof = useStore((s) => s.profile);
  return (
    <div className="roster" style={cols ? { gridTemplateColumns: `repeat(${cols},1fr)` } : undefined}>
      {CHARACTERS.map((c) => { const un = prof.unlockedChars.includes(c.id); return (
        <button key={c.id} className={`rc ${sel === c.id ? 'sel' : ''} ${un ? '' : 'locked'}`} onClick={() => { audio.sfx('ui'); onSel(c.id); }} style={{ color: 'inherit', font: 'inherit' }}>
          <Portrait look={c.look} color={STYLES[c.style].color} size={100} name={c.name} /><div className="nm">{c.name.split(' ')[0]}</div>{!un && <span className="lock">🔒</span>}
          {prof.activeChar === c.id && <span className="tag ok" style={{ position: 'absolute', top: 4, left: 2, fontSize: '.55rem' }}>Active</span>}
        </button>); })}
    </div>
  );
}

export function CharacterDetail({ id }: { id: string }) {
  const prof = useStore((s) => s.profile); const switchChar = useStore((s) => s.switchChar); const setTab = useStore((s) => s.setTab);
  const c = CHAR_BY_ID[id]; const st = STYLES[c.style]; const un = prof.unlockedChars.includes(id); const cp = prof.chars[id];
  const active = prof.activeChar === id; const ps = active ? computeStats(prof) : null; const L = cp?.level ?? 1;
  const rows: [string, string][] = ps ? [['Health', String(ps.maxHp)], ['Stamina', String(ps.maxSta)], ['Attack', ps.atk.toFixed(1)], ['Defense', ps.def.toFixed(1)], ['Move speed', `${(ps.spd * 100).toFixed(0)}%`], ['Breath', String(ps.maxBreath)], ['Crit chance / dmg', `${(ps.crit * 100).toFixed(0)}% / ×${ps.critDmg.toFixed(2)}`]]
    : [['Health', String(Math.round(c.stats.hp + 14 * (L - 1)))], ['Stamina', String(Math.round(c.stats.sta + 2 * (L - 1)))], ['Attack', (c.stats.atk + 2.3 * (L - 1)).toFixed(1)], ['Defense', (c.stats.def + 1.5 * (L - 1)).toFixed(1)], ['Move speed', `${(c.stats.spd * 100).toFixed(0)}%`], ['Breath', String(c.stats.breath)], ['Crit chance', `${c.stats.crit}%`]];
  const forms = [...c.forms, ...(c.extraForms ?? [])].map((f) => ALL_SKILLS[f]);
  return (
    <div className="grid" style={{ gridTemplateColumns: '170px 1fr', gap: '1rem' }}>
      <div><div style={{ border: `2px solid ${hx(st.color)}`, boxShadow: `0 0 20px ${hx(st.color)}66` }}><Portrait look={c.look} color={st.color} size={166} /></div>
        {un && cp && <div style={{ marginTop: '.5rem' }}><div className="small">Level <b className="gold">{cp.level}</b> · {cp.sp} SP</div><Bar v={cp.xp} max={xpNeed(cp.level)} color="#e8c777" h={6} /></div>}</div>
      <div>
        <div style={{ fontFamily: 'var(--font)', fontSize: '1.5rem' }}>{c.name}</div><div className="gold small" style={{ letterSpacing: '.15em' }}>{c.title.toUpperCase()}</div>
        <div style={{ margin: '.4rem 0' }}><span className="tag" style={{ color: hx(st.color) }}>{st.name}</span><span className="tag dim">{c.role}</span>{un ? <span className="tag ok">Unlocked</span> : <span className="tag red">Locked</span>}</div>
        <p className="small dim" style={{ margin: '.3rem 0' }}>{c.desc}</p><p className="small" style={{ fontStyle: 'italic', margin: '.3rem 0' }}>“{c.quote}”</p>
        <div className="grid cols-2" style={{ gap: '1rem' }}>
          <div>{rows.map(([k, v]) => <div className="stat" key={k}><span className="dim">{k}</span><b>{v}</b></div>)}<div className="stat"><span className="dim">Weapon</span><b>{c.weapon}</b></div>{!un && <div className="small red" style={{ marginTop: '.4rem' }}>🔒 {unlockText(id)}</div>}</div>
          <div><div className="small gold" style={{ letterSpacing: '.12em', marginBottom: '.2rem' }}>TECHNIQUES</div>{forms.map((f) => <div key={f.id} className="small" style={{ padding: '2px 0' }}><span style={{ color: hx(STYLES[f.style].color) }}>{KIND_ICON[f.kind]}</span> {f.name}</div>)}
            <div className="small" style={{ padding: '2px 0' }}>⚡ <b>E</b> {ALL_SKILLS[c.special].name}</div><div className="small" style={{ padding: '2px 0' }}>★ <b>R</b> {ALL_SKILLS[c.ult].name}{c.ult2 ? ` → ${ALL_SKILLS[c.ult2.id].name}` : ''}</div></div>
        </div>
        <div style={{ marginTop: '.8rem', display: 'flex', gap: '.5rem' }}>
          {un && !active && <button className="btn gold" onClick={() => { switchChar(id); audio.sfx('uiok'); }}>Play as {c.name.split(' ')[0]}</button>}
          {active && <span className="tag ok">Currently playing</span>}
          {!un && c.unlock.type === 'trial' && <button className="btn sm" onClick={() => setTab('journal')}>Open Journal</button>}
        </div>
      </div>
    </div>
  );
}

export function CharacterPanel() {
  const active = useStore((s) => s.profile.activeChar); const [sel, setSel] = useState(active);
  return <div className="split"><div><Roster sel={sel} onSel={setSel} cols={3} /></div><div className="card"><CharacterDetail id={sel} /></div></div>;
}

function SkillCard({ s, slotSel }: { s: SkillDef; slotSel: number | null }) {
  const prof = useStore((x) => x.profile); const { unlockSkill, equipSkill } = useStore.getState(); const cp = prof.chars[prof.activeChar]; const stt = skillStatus(prof, prof.activeChar, s); const col = hx(STYLES[s.style].color);
  const equipped = cp.equipped.indexOf(s.id);
  return (
    <div className={`card skill ${stt === 'locked' || stt === 'story' ? 'locked' : ''} ${equipped >= 0 ? 'sel' : ''}`}>
      <div className="sicon" style={{ borderColor: col, color: col }}>{KIND_ICON[s.kind]}</div>
      <div><div style={{ fontFamily: 'var(--font)' }}>{s.name}</div><div className="small dim">{s.form} · {s.kind} · ×{s.dmg}{s.hits > 1 ? ` ×${s.hits}` : ''} · {s.breath} breath · {s.cd}s cd</div><div className="small">{s.desc}{s.fx ? <span className="gold"> [{s.fx}]</span> : null}</div></div>
      <div style={{ textAlign: 'right' }}>
        {stt === 'unlocked' && <><div className="small ok">Learned{equipped >= 0 ? ` · slot ${equipped + 1}` : ''}</div><button className="btn sm" disabled={slotSel === null} onClick={() => { equipSkill(slotSel!, s.id); audio.sfx('uiok'); }}>Equip</button></>}
        {stt === 'available' && <button className="btn sm gold" disabled={cp.sp < s.sp} onClick={() => unlockSkill(s.id)}>Learn · {s.sp} SP</button>}
        {stt === 'locked' && <div className="small red">Requires Lv.{s.level}</div>}
        {stt === 'story' && <div className="small red">Story: Chapter {s.reqChapter}</div>}
      </div>
    </div>
  );
}

export function SkillsPanel() {
  const prof = useStore((s) => s.profile); const { equipSkill, upgradePassive } = useStore.getState(); const def = CHAR_BY_ID[prof.activeChar]; const cp = prof.chars[prof.activeChar]; const [slot, setSlot] = useState<number | null>(0);
  const st = STYLES[def.style]; const forms = [...def.forms, ...(def.extraForms ?? [])].map((f) => ALL_SKILLS[f]);
  return (
    <div>
      <div style={{ display: 'flex', gap: '1.4rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div><div style={{ fontFamily: 'var(--font)', fontSize: '1.2rem' }}>{def.name} <span className="dim small">· {st.name} {st.jp}</span></div><div className="small">Level <b className="gold">{cp.level}</b> · Skill points <b className="gold">{cp.sp}</b></div></div>
        <div style={{ display: 'flex', gap: '.8rem' }}>
          {cp.equipped.map((id, i) => (<div key={i} className={`slot ${id ? 'fill' : ''} ${slot === i ? 'sel' : ''}`} onClick={() => setSlot(i)} title="Select slot, then Equip a learned skill"><b>{i + 1}</b>{id ? ALL_SKILLS[id].name : 'Empty'}</div>))}
        </div>
        <span className="small dim">Select a slot, then press Equip on a learned technique.</span>
        {cp.equipped[slot ?? 0] && slot !== null && <button className="btn sm" onClick={() => equipSkill(slot, null)}>Clear slot</button>}
      </div>
      <div className="grid cols-2">{forms.map((f) => <SkillCard key={f.id} s={f} slotSel={slot} />)}</div>
      <div className="grid cols-2" style={{ marginTop: '.7rem' }}>
        {[ALL_SKILLS[def.special], ...(def.specialAlt ? [ALL_SKILLS[def.specialAlt.id]] : []), ALL_SKILLS[def.ult], ...(def.ult2 ? [ALL_SKILLS[def.ult2.id]] : [])].map((s) => (
          <div key={s.id} className="card skill"><div className="sicon" style={{ borderColor: hx(STYLES[s.style].color) }}>{s.ult ? '★' : '⚡'}</div><div><div style={{ fontFamily: 'var(--font)' }}>{s.name}</div><div className="small dim">{s.ult ? 'Ultimate (R) — needs a full gauge' : 'Special (E)'} · ×{s.dmg} × {s.hits}</div><div className="small">{s.desc}</div></div><div className="small dim">{s.reqChapter ? `Ch.${s.reqChapter}` : s.ult ? 'Lv.3' : 'Lv.4'}</div></div>))}
      </div>
      <div className="small gold" style={{ letterSpacing: '.15em', margin: '1rem 0 .4rem' }}>BREATHING MASTERY — PASSIVES</div>
      <div className="grid cols-3">{PASSIVES.map((p) => { const r = cp.passives[p.id] ?? 0; return (
        <div key={p.id} className="card"><div style={{ display: 'flex', justifyContent: 'space-between' }}><b style={{ fontFamily: 'var(--font)' }}>{p.name}</b><div className="pips">{Array.from({ length: p.max }).map((_, i) => <i key={i} className={i < r ? 'on' : ''} />)}</div></div><div className="small dim">{p.desc}</div><button className="btn sm" style={{ marginTop: '.4rem' }} disabled={cp.sp < 1 || r >= p.max} onClick={() => { upgradePassive(p.id); audio.sfx('uiok'); }}>Upgrade · 1 SP</button></div>); })}</div>
    </div>
  );
}

export function InventoryPanel() {
  const prof = useStore((s) => s.profile); const st = useStore.getState(); const [tab, setTab] = useState<'consumable' | 'material' | 'collectible' | 'gear' | 'sword'>('consumable');
  const inv = prof.inventory; const ids = Object.keys(inv).filter((k) => ITEMS[k] && ITEMS[k].cat === tab || (tab === 'collectible' && ITEMS[k]?.cat === 'quest'));
  const gear = Object.keys(inv).filter((k) => EQUIPMENT[k]);
  return (
    <div>
      <div className="seg" style={{ marginBottom: '.8rem' }}>{([['consumable', 'Consumables'], ['material', 'Materials'], ['collectible', 'Collectibles'], ['gear', 'Equipment'], ['sword', 'Swords']] as const).map(([k, n]) => <button key={k} className={`btn sm ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{n}</button>)}<span style={{ marginLeft: 'auto' }} className="gold">💴 {prof.sen} Sen</span></div>
      {(tab === 'consumable' || tab === 'material' || tab === 'collectible') && <div className="grid cols-3">{ids.length === 0 && <div className="dim">Nothing here yet. Defeat demons, explore, and complete missions.</div>}{ids.map((k) => { const it = ITEMS[k]; return (
        <div key={k} className="card item"><div className="ic">{it.icon}</div><div style={{ flex: 1 }}><b>{it.name}</b> <span className="gold">×{inv[k]}</span><div className="small dim">{it.desc}</div></div>{it.use && <button className="btn sm" onClick={() => st.cmd({ type: 'useItem', id: k })}>Use</button>}</div>); })}
        {tab === 'collectible' && <div className="small dim" style={{ gridColumn: '1/-1' }}>World discoveries: {prof.discoveries.length} · Collectibles found: {prof.collectibles.length}</div>}</div>}
      {tab === 'gear' && <div><div className="grid cols-3" style={{ marginBottom: '1rem' }}>{(['haori', 'uniform', 'charm'] as const).map((sl) => { const e = prof.equipment[sl]; return <div key={sl} className="card"><div className="small gold" style={{ textTransform: 'uppercase', letterSpacing: '.12em' }}>{sl}</div><b>{e ? EQUIPMENT[e].name : '— empty —'}</b><div className="small dim">{e ? EQUIPMENT[e].desc : ''}</div>{e && <button className="btn sm" onClick={() => st.equipGear(sl, null)}>Unequip</button>}</div>; })}</div>
        <div className="grid cols-3">{gear.length === 0 && <div className="dim">No spare equipment. Visit the shop (B).</div>}{gear.map((k) => { const e = EQUIPMENT[k]; return <div key={k} className="card"><b>{e.name}</b> <span className="tag dim">{e.slot}</span><div className="small dim">{e.desc}</div><button className="btn sm" disabled={prof.equipment[e.slot] === k} onClick={() => st.equipGear(e.slot, k)}>Equip</button></div>; })}</div></div>}
      {tab === 'sword' && <div className="grid cols-3">{Object.keys(prof.swords).map((k) => { const s = SWORDS[k]; const eq = prof.equippedSword[prof.activeChar] === k; const col = s.color || CHAR_BY_ID[prof.activeChar].bladeColor; return (
        <div key={k} className={`card ${eq ? 'sel' : ''}`}><div className="sword"><i style={{ background: hx(col), boxShadow: `0 0 12px ${hx(s.glow || col)}` }} /><u /><s /></div><div style={{ textAlign: 'center' }}><b>{s.name}</b> <span className="gold">+{prof.swords[k]}</span><div className="small dim">{s.desc}</div><div className="small">ATK ×{(s.atk * swordMult(prof.swords[k])).toFixed(2)}</div><button className="btn sm" disabled={eq} onClick={() => st.equipSword(k)}>{eq ? 'Equipped' : 'Equip'}</button></div></div>); })}</div>}
    </div>
  );
}

export function SmithPanel() {
  const prof = useStore((s) => s.profile); const st = useStore.getState(); const [view, setView] = useState<'forge' | 'shop'>('forge'); const inv = prof.inventory;
  return (
    <div>
      <div className="seg" style={{ marginBottom: '.8rem' }}><button className={`btn sm ${view === 'forge' ? 'on' : ''}`} onClick={() => setView('forge')}>Swordsmith — Upgrade</button><button className={`btn sm ${view === 'shop' ? 'on' : ''}`} onClick={() => setView('shop')}>Shop</button>
        <span style={{ marginLeft: 'auto' }}>💴 <b className="gold">{prof.sen}</b> Sen · 🔩 {inv.steel_shard ?? 0} · 🪨 {inv.whetstone ?? 0}</span></div>
      {view === 'forge' && <div className="grid cols-3">{Object.keys(prof.swords).map((k) => { const s = SWORDS[k]; const lvl = prof.swords[k]; const c = upgradeCost(lvl); const col = s.color || CHAR_BY_ID[prof.activeChar].bladeColor; const can = prof.sen >= c.sen && (inv.steel_shard ?? 0) >= c.steel && (inv.whetstone ?? 0) >= c.whet && lvl < 10; return (
        <div key={k} className="card"><div className="sword"><i style={{ background: hx(col), boxShadow: `0 0 ${8 + lvl * 3}px ${hx(s.glow || col)}` }} /><u /><s /></div>
          <div style={{ textAlign: 'center' }}><b>{s.name}</b> <span className="gold">+{lvl}</span><div className="small dim">{s.desc}</div><div className="small">ATK ×{(s.atk * swordMult(lvl)).toFixed(2)} → ×{(s.atk * swordMult(lvl + 1)).toFixed(2)}</div>
            {lvl < 10 ? <div className="small dim">💴 {c.sen} · 🔩 {c.steel}{c.whet ? ` · 🪨 ${c.whet}` : ''}</div> : <div className="small ok">Max level</div>}
            <button className="btn sm gold" disabled={!can} onClick={() => { if (st.upgradeSword(k)) audio.sfx('levelup'); }}>Upgrade</button> <button className="btn sm" onClick={() => st.equipSword(k)} disabled={prof.equippedSword[prof.activeChar] === k}>Equip</button></div></div>); })}</div>}
      {view === 'shop' && <div className="grid cols-3">{SHOP.map((k) => { const it = ITEMS[k]; const sw = SWORDS[k]; const eq = EQUIPMENT[k]; const price = it?.price ?? sw?.price ?? eq?.price ?? 0; const own = (sw && k in prof.swords) || (eq && (inv[k] ?? 0) > 0); return (
        <div key={k} className="card item"><div className="ic">{it?.icon ?? (sw ? '⚔️' : '👘')}</div><div style={{ flex: 1 }}><b>{(it ?? sw ?? eq).name}</b>{it && <span className="dim small"> (own {inv[k] ?? 0})</span>}<div className="small dim">{(it ?? sw ?? eq).desc}</div></div><button className="btn sm gold" disabled={prof.sen < price || !!own} onClick={() => { if (st.buy(k)) audio.sfx('pickup'); }}>{own ? 'Owned' : `💴 ${price}`}</button></div>); })}</div>}
    </div>
  );
}
