import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import {
  useStore, equipItem, unequip, sellItem, salvageItem, upgradeEquipped, refreshShop, buyItem, toVault, fromVault, learnSkill, setSkillSlot, respec, skillCost, claimQuest, startNgPlus,
  computeStats, masteryLevel, toast, swapWeapons, INV_CAP, VAULT_CAP,
} from '../game/store';
import {
  RARITY, RARITIES, SLOT_ICON, EQUIP_KEYS, REGIONS, SKILLS, SKILL_BY_ID, skillScale, WEAPONS, FAMILIES, ACHIEVEMENTS, CHALLENGES, TYPE_INFO, STAT_NAMES, upgradeCost, upgradeMult, sellValue, buyValue,
  getFloorSpec, floorTypeOf, type Item, type EquipKey, type Stats, type SkillCat,
} from '../game/data';
import { buildWeapon } from '../game/models';
import { getGame } from '../game/engine';
import { sfx } from '../game/audio';
import { fmtTime } from '../game/util';

// ---------- 3D weapon icons rendered once & cached ----------
let ir: THREE.WebGLRenderer | null = null; const icache = new Map<string, string>();
export function weaponIcon(fam: string, rarity: string): string {
  const k = `${fam}|${rarity}`; const c = icache.get(k); if (c !== undefined) return c;
  let url = '';
  try {
    if (!ir) { ir = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true }); ir.setSize(96, 96); ir.setPixelRatio(1); ir.setClearColor(0x000000, 0); }
    const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff, 0x445577, 2.4)); const dl = new THREE.DirectionalLight(0xffffff, 2.6); dl.position.set(2, 3, 4); sc.add(dl);
    const w = buildWeapon(fam as never, rarity); w.rotation.z = -0.75; sc.add(w); const box = new THREE.Box3().setFromObject(w), ctr = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3()), r = Math.max(sz.x, sz.y, sz.z);
    const cam = new THREE.PerspectiveCamera(28, 1, 0.1, 60); cam.position.set(ctr.x, ctr.y, ctr.z + r * 2.3); cam.lookAt(ctr); ir.render(sc, cam); url = ir.domElement.toDataURL('image/png');
  } catch { url = ''; }
  icache.set(k, url); return url;
}

const sv = (it: Item, k: keyof Stats) => (it.stats[k] ? (it.stats[k] as number) * upgradeMult(it) : 0);
const fmtS = (k: keyof Stats, v: number) => (k === 'crit' ? `${(Math.round(v * 10) / 10)}%` : k === 'critDmg' ? `+${Math.round(v)}%` : String(Math.round(v)));
const SHORT: Record<keyof Stats, string> = { atk: 'ATK', def: 'DEF', hp: 'HP', crit: 'CRIT', critDmg: 'C.DMG', stamina: 'STA', mana: 'MP' };
export function ItemCard({ it, sel, onClick, label, big }: { it: Item | null; sel?: boolean; onClick?: () => void; label?: string; big?: boolean }) {
  if (!it) return <div className="slotbox" onClick={onClick}><div className="slotlabel">{label}</div><div className="muted" style={{ fontSize: 12, padding: '0 6px' }}>— empty —</div></div>;
  const r = RARITY[it.rarity]; const set = it.set ? REGIONS.find((x) => x.set.id === it.set)?.set : null;
  return (
    <button className={`icard ${sel ? 'sel' : ''} ${it.boss ? 'boss' : ''}`} style={{ ['--rc' as string]: r.color, width: '100%', ...(big ? { padding: 10 } : {}) }} onClick={onClick}>
      <div className="ico" style={big ? { width: 72, height: 72 } : undefined}>{it.slot === 'weapon' && it.family ? <img alt="" src={weaponIcon(it.family, it.rarity)} /> : SLOT_ICON[it.slot]}</div>
      <div style={{ minWidth: 0, flex: 1 }}>
        {label && <div className="slotlabel" style={{ padding: 0 }}>{label}</div>}
        <div className="nm">{it.name}{it.upg > 0 ? ` +${it.upg}` : ''}</div>
        <div className="st" style={{ marginTop: 2 }}>{(Object.keys(it.stats) as (keyof Stats)[]).map((k) => <span key={k}>{SHORT[k]} <b style={{ color: '#fff' }}>{fmtS(k, sv(it, k))}</b></span>)}</div>
        <div style={{ fontSize: 10, letterSpacing: '0.12em', color: r.color, textTransform: 'uppercase' }}>{r.name} {it.family ? WEAPONS[it.family].name : it.slot}{set ? <span style={{ color: '#ffd860' }}> · {set.name}</span> : null}</div>
      </div>
    </button>
  );
}
function Modal({ title, onClose, children, w = 900, tabs }: { title: string; onClose: () => void; children: React.ReactNode; w?: number; tabs?: React.ReactNode }) {
  return (<div className="modal" onPointerDown={(e) => e.stopPropagation()}><div className="panel" style={{ width: `min(${w}px, 98vw)` }}><div className="ptitle"><span>{title}</span><button className="xbtn" onClick={onClose} aria-label="Close">✕</button></div>{tabs}<div className="pbody">{children}</div></div></div>);
}
const close = () => getGame()?.closePanel();

// ---------- inventory ----------
function InventoryTab() {
  const save = useStore((s) => s.save); const [sel, setSel] = useState<{ w: 'inv' | EquipKey; id: string } | null>(null);
  const it = sel ? (sel.w === 'inv' ? save.inv.find((i) => i.id === sel.id) : save.equip[sel.w]) : null;
  const sorted = useMemo(() => [...save.inv].sort((a, b) => RARITIES.indexOf(b.rarity) - RARITIES.indexOf(a.rarity) || b.tier - a.tier), [save.inv]);
  const eqKey = it ? (it.slot === 'weapon' && sel!.w === 'inv' ? 'weapon' : it.slot) : null; const cur = eqKey ? save.equip[eqKey as EquipKey] : null;
  const diff = it && sel!.w === 'inv' && cur ? (Object.keys({ ...it.stats, ...cur.stats }) as (keyof Stats)[]).map((k) => ({ k, d: sv(it, k) - sv(cur, k) })) : [];
  const uc = it ? upgradeCost(it) : null; const hub = getGame()?.scene3 === 'hub';
  return (
    <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div className="col" style={{ flex: '1 1 260px', minWidth: 240 }}>
        <div className="h gold" style={{ fontSize: 13 }}>EQUIPPED</div>
        {EQUIP_KEYS.map((k) => <ItemCard key={k} it={save.equip[k]} label={k === 'weapon2' ? 'alt weapon (X to swap)' : k} sel={sel?.w === k} onClick={() => save.equip[k] && setSel({ w: k, id: save.equip[k]!.id })} />)}
      </div>
      <div className="col" style={{ flex: '2 1 360px', minWidth: 280 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}><span className="h gold" style={{ fontSize: 13 }}>INVENTORY</span><span className="muted">{save.inv.length}/{INV_CAP}</span></div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', maxHeight: 300, overflow: 'auto' }}>
          {sorted.map((i) => <ItemCard key={i.id} it={i} sel={sel?.id === i.id} onClick={() => { setSel({ w: 'inv', id: i.id }); sfx('click'); }} />)}
          {!sorted.length && <div className="muted">Nothing here yet — defeat enemies and open chests!</div>}
        </div>
        {it && (
          <div className="panel" style={{ padding: 10 }}>
            <ItemCard it={it} big />
            <div className="muted" style={{ margin: '6px 2px', fontSize: 13 }}>{it.desc}</div>
            {diff.length > 0 && <div className="row" style={{ flexWrap: 'wrap', gap: 10, fontSize: 13 }}>{diff.map(({ k, d }) => <span key={k} className={d > 0 ? 'grn' : d < 0 ? 'rd' : 'muted'}>{STAT_NAMES[k]} {d > 0 ? '▲' : d < 0 ? '▼' : '='}{Math.abs(Math.round(d * 10) / 10)}</span>)}</div>}
            <div className="row" style={{ flexWrap: 'wrap', marginTop: 8 }}>
              {sel!.w === 'inv' ? (<>
                <button className="btn gold sm" onClick={() => { equipItem(it.id); sfx('item', 0.6); setSel(null); }}>Equip</button>
                {it.slot === 'weapon' && <button className="btn sm" onClick={() => { equipItem(it.id, true); setSel(null); }}>Equip as Alt</button>}
                <button className="btn sm" onClick={() => { sellItem(it.id); sfx('gold'); setSel(null); }}>Sell {sellValue(it)}🪙</button>
                <button className="btn sm" onClick={() => { salvageItem(it.id); sfx('gold'); setSel(null); }}>Salvage</button>
              </>) : <button className="btn sm" onClick={() => { unequip(sel!.w as EquipKey); setSel(null); }}>Unequip</button>}
              {it.upg < 10 && uc && <button className="btn sm" disabled={!hub} title={hub ? '' : 'Visit the Blacksmith in the hub'} onClick={() => { if (upgradeEquipped(sel!.w === 'inv' ? 'inv' : (sel!.w as EquipKey), it.id)) sfx('levelup', 0.6); }}>Upgrade +{it.upg + 1} ({uc.gold}🪙 {uc.ess}✦){hub ? '' : ' — hub only'}</button>}
            </div>
          </div>)}
      </div>
    </div>
  );
}
function CharacterTab() {
  const save = useStore((s) => s.save); const st = computeStats(save); const W = WEAPONS[st.family];
  const rows: (keyof Stats)[] = ['hp', 'atk', 'def', 'crit', 'critDmg', 'stamina', 'mana'];
  return (
    <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 18 }}>
      <div className="col" style={{ flex: '1 1 260px' }}>
        <div className="h gold" style={{ fontSize: 22 }}>Level {save.level}</div>
        <div className="muted">Skill points: <b className="gold">{save.sp}</b> · Gold <b className="gold">{save.gold}</b> · Essence <b className="cy">{save.essence}</b></div>
        {save.ng > 0 && <div className="chip gold">New Game+ {save.ng}</div>}
        <div className="sep" />
        {rows.map((k) => <div key={k} className="stat"><span>{STAT_NAMES[k]}</span><b>{fmtS(k, st[k])}</b></div>)}
        <div className="sep" />
        <div className="h gold" style={{ fontSize: 13 }}>SET BONUSES</div>
        {st.sets.length ? st.sets.map((s) => <div key={s.name}><b>{s.name}</b> <span className="muted">({s.count} pieces)</span>{s.lines.map((l) => <div key={l} className="grn" style={{ fontSize: 13 }}>{l}</div>)}{s.count < 2 && <div className="muted" style={{ fontSize: 12 }}>Equip 2 pieces for a bonus</div>}</div>) : <div className="muted">Equip matching set pieces (dropped by region guardians) for bonuses.</div>}
      </div>
      <div className="col" style={{ flex: '1 1 280px' }}>
        <div className="h gold" style={{ fontSize: 13 }}>WEAPON — {W.name.toUpperCase()}</div>
        <div className="muted" style={{ fontSize: 13 }}>{W.desc}</div>
        <div className="stat"><span>Attack speed</span><b>{W.spd.toFixed(2)}×</b></div><div className="stat"><span>Damage factor</span><b>{W.dmg.toFixed(2)}×</b></div><div className="stat"><span>Combo length</span><b>{W.combo.length} hits</b></div>
        <div className="stat"><span>Guard</span><b>{W.guardName}</b></div><div className="stat"><span>Counter</span><b>{W.counterName}</b></div><div className="stat"><span>Ultimate</span><b>{W.ultName}</b></div>
        <div className="sep" /><div className="h gold" style={{ fontSize: 13 }}>WEAPON MASTERY</div>
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>{FAMILIES.map((f) => { const m = masteryLevel(save.mastery[f] || 0); return <div key={f} className="stat" style={{ fontSize: 13 }}><span>{WEAPONS[f].name}</span><b className={m ? 'gold' : 'muted'}>Lv {m}</b></div>; })}</div>
        <div className="sep" /><div className="muted" style={{ fontSize: 13 }}>Awakening: fill the meter in combat, then press <b>T</b> for 22s of transformed power — +50% damage, faster attacks, and a devastating awakened finisher on <b>V</b>.</div>
      </div>
    </div>
  );
}
export function SkillsTab({ trainer }: { trainer?: boolean }) {
  const save = useStore((s) => s.save); const [cat, setCat] = useState<SkillCat>('physical'); const [slot, setSlot] = useState(0); const [pick, setPick] = useState<string>(save.slots[0] || 'wave');
  const def = SKILL_BY_ID[pick]; const lv = save.skills[pick] || 0;
  const cats: [SkillCat, string][] = [['physical', '⚔ Physical'], ['elemental', '🔥 Elemental'], ['shadow', '🌑 Shadow'], ['arcane', '🔷 Arcane']];
  const sc = def ? skillScale(def, Math.max(1, lv)) : null, nx = def && lv < 5 ? skillScale(def, lv + 1) : null;
  return (
    <div className="col">
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <span className="muted">Active slots (1–4) — change anytime between floors:</span>
        {save.slots.map((id, i) => <button key={i} className={`skill ${slot === i ? 'sel' : ''}`} style={{ pointerEvents: 'auto' }} onClick={() => { setSlot(i); if (id) setPick(id); }}><span className="k">{i + 1}</span>{id ? SKILL_BY_ID[id].icon : '—'}</button>)}
        <span className="chip">SP: <b className="gold">{save.sp}</b></span>{trainer && <button className="btn sm" onClick={() => respec()}>Respec (200🪙)</button>}
      </div>
      <div className="tabs" style={{ padding: 0 }}>{cats.map(([c, l]) => <button key={c} className={`tab ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>{l}</button>)}</div>
      <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', flex: '2 1 340px' }}>
          {SKILLS.filter((s) => s.cat === cat).map((s) => { const l = save.skills[s.id] || 0; return (
            <button key={s.id} className={`icard ${pick === s.id ? 'sel' : ''}`} style={{ ['--rc' as string]: l ? '#b36bff' : '#556' }} onClick={() => { setPick(s.id); sfx('click'); }}>
              <div className="ico" style={{ width: 42, height: 42, fontSize: 22 }}>{s.icon}</div><div><div className="nm">{s.name}</div><div className="st">{[1, 2, 3, 4, 5].map((i) => <span key={i} style={{ color: i <= l ? '#ffd860' : '#555' }}>◆</span>)}</div></div></button>); })}
        </div>
        {def && sc && (
          <div className="panel" style={{ flex: '1 1 260px', padding: 12 }}>
            <div className="h gold" style={{ fontSize: 18 }}>{def.icon} {def.name}</div><div className="muted" style={{ fontSize: 13, margin: '4px 0' }}>{def.desc}</div>
            <div className="stat"><span>Level</span><b>{lv}/5</b></div><div className="stat"><span>Damage</span><b>{Math.round(sc.dmg * 100)}% ATK{nx ? <span className="grn"> → {Math.round(nx.dmg * 100)}%</span> : ''}</b></div>
            <div className="stat"><span>Cooldown</span><b>{sc.cd.toFixed(1)}s{nx ? <span className="grn"> → {nx.cd.toFixed(1)}s</span> : ''}</b></div><div className="stat"><span>Range</span><b>{sc.range.toFixed(1)}m</b></div><div className="stat"><span>Mana</span><b>{sc.mana}</b></div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Upgrade: {def.up}</div>
            <div className="row" style={{ marginTop: 8, flexWrap: 'wrap' }}>
              <button className="btn gold sm" disabled={lv >= 5 || save.sp < skillCost(lv)} onClick={() => { if (learnSkill(pick)) sfx('levelup', 0.6); }}>{lv === 0 ? 'Learn' : 'Upgrade'} ({lv >= 5 ? 'MAX' : skillCost(lv) + ' SP'})</button>
              <button className="btn sm" disabled={lv < 1} onClick={() => { setSkillSlot(slot, pick); sfx('item', 0.5); }}>Equip to slot {slot + 1}</button>
            </div></div>)}
      </div>
    </div>
  );
}
function MapTab() {
  const save = useStore((s) => s.save);
  return (
    <div className="col">
      <div className="row" style={{ flexWrap: 'wrap' }}><span className="chip">Highest floor: <b className="gold">{save.highest}</b></span><span className="chip">Floors cleared: <b className="gold">{Object.keys(save.cleared).length}</b>/100</span><span className="chip">Guardians: <b className="gold">{Object.keys(save.bosses).length}</b>/10</span></div>
      <div className="col" style={{ flexDirection: 'column-reverse' }}>
        {REGIONS.map((r) => { const cl = Object.keys(save.cleared).map(Number).filter((n) => n >= r.floors[0] && n <= r.floors[1]).length; const here = save.highest >= r.floors[0] && save.highest <= r.floors[1]; const col = '#' + r.accent.toString(16).padStart(6, '0'); return (
          <div key={r.id} className="panel" style={{ padding: '8px 12px', borderColor: here ? col : undefined }}>
            <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}><span className="h" style={{ color: col, fontSize: 14 }}>{r.name.toUpperCase()}</span><span className="muted" style={{ fontSize: 12 }}>{r.sub} · Guardian: {r.boss.name} {save.bosses[r.id] ? '☠' : ''}</span></div>
            <div className="bar xp" style={{ transform: 'none', height: 8, marginTop: 4 }}><i style={{ width: `${cl * 10}%`, background: col }} /></div>{here && <div className="gold" style={{ fontSize: 12 }}>◆ You are here</div>}
          </div>); })}
      </div>
    </div>
  );
}
export function MenuPanel() {
  const tab = useStore((s) => s.tab);
  const T = (k: 'inventory' | 'character' | 'skills' | 'map', l: string) => <button className={`tab ${tab === k ? 'on' : ''}`} onClick={() => useStore.setState({ tab: k })}>{l}</button>;
  return (
    <Modal title="ADVENTURER" onClose={close} tabs={<div className="tabs">{T('inventory', 'Inventory [I]')}{T('character', 'Character [Tab]')}{T('skills', 'Skills')}{T('map', 'Tower Map [M]')}</div>}>
      {tab === 'inventory' && <InventoryTab />}{tab === 'character' && <CharacterTab />}{tab === 'skills' && <SkillsTab />}{tab === 'map' && <MapTab />}
    </Modal>
  );
}

// ---------- tower select (shared with title) ----------
export function TowerSelect({ onStart }: { onStart: (n: number) => void }) {
  const save = useStore((s) => s.save); const [reg, setReg] = useState(Math.min(9, Math.floor((save.floor - 1) / 10))); const [fl, setFl] = useState(Math.min(save.highest, Math.max(1, save.floor)));
  const R = REGIONS[reg], spec = getFloorSpec(fl), col = '#' + R.accent.toString(16).padStart(6, '0'), rec = save.cleared[fl]; const locked = fl > save.highest;
  const sp = getFloorSpec(fl);
  return (
    <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
      <div className="col" style={{ flex: '0 0 180px' }}>{REGIONS.map((r) => <button key={r.id} className={`tab ${reg === r.id ? 'on' : ''}`} style={{ borderRadius: 4, textAlign: 'left', fontSize: 11, opacity: save.highest >= r.floors[0] ? 1 : 0.4 }} onClick={() => { setReg(r.id); setFl(Math.min(save.highest, r.floors[0])); }}>{r.id + 1}. {r.name}</button>)}</div>
      <div className="col" style={{ flex: '1 1 380px' }}>
        <div className="h" style={{ color: col, fontSize: 18 }}>{R.name.toUpperCase()} <span className="muted" style={{ fontSize: 12 }}>{R.sub}</span></div><div className="muted" style={{ fontSize: 13 }}>{R.desc}</div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(5,1fr)' }}>
          {Array.from({ length: 10 }, (_, i) => R.floors[0] + i).map((n) => { const t = floorTypeOf(n), r2 = save.cleared[n]; return (
            <button key={n} disabled={n > save.highest} className={`floorbtn ${fl === n ? 'sel' : ''} ${r2 ? 'done' : ''} ${t === 'boss' ? 'boss' : ''}`} onClick={() => { setFl(n); sfx('click'); }}>{n}<small>{r2 ? `★ ${r2.rank}` : TYPE_INFO[t].icon}</small></button>); })}
        </div>
        <div className="panel" style={{ padding: 10 }}>
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}><span className="h gold" style={{ fontSize: 16 }}>Floor {fl}: {spec.name}</span><span className="chip">{TYPE_INFO[sp.type].icon} {TYPE_INFO[sp.type].name}</span></div>
          <div className="muted" style={{ fontSize: 13 }}>Objective: {TYPE_INFO[sp.type].goal}{sp.hasSecret && save.secrets[fl] ? ' · 🔮 secret found' : ''}</div>
          <div className="muted" style={{ fontSize: 13 }}>Hazard: {R.hazardName} · Guardian: <span className="rd">{R.boss.name}</span></div>
          <div className="muted" style={{ fontSize: 13 }}>Rewards: gold, essence, XP{floorTypeOf(fl) === 'boss' ? ` & exclusive ${R.set.name} gear + ${R.boss.weapon.name}` : ' & loot'}{!rec ? ' · first-clear bonus' : ''}</div>
          {rec && <div className="grn" style={{ fontSize: 13 }}>Best: Rank {rec.rank} · {fmtTime(rec.time)} · {rec.score.toLocaleString()} pts{rec.noHit ? ' · NO HIT' : ''}</div>}
          <div className="row" style={{ marginTop: 8 }}><button className="btn gold" disabled={locked} onClick={() => onStart(fl)}>{locked ? 'Locked' : rec ? 'Replay Floor' : 'Climb Floor'} {fl}</button></div>
        </div>
      </div>
    </div>
  );
}

// ---------- hub panels ----------
export function PortalPanel() {
  const save = useStore((s) => s.save); const [m, setM] = useState('tower'); const g = getGame();
  const M = (k: string, l: string) => <button className={`tab ${m === k ? 'on' : ''}`} onClick={() => setM(k)}>{l}</button>;
  const bosses = Object.keys(save.bosses).length;
  return (
    <Modal title="THE TOWER GATE" onClose={close} w={980} tabs={<div className="tabs">{M('tower', 'Tower Climb')}{M('endless', 'Endless')}{M('rush', 'Boss Rush')}{M('challenge', 'Challenges')}{M('mastery', 'Weapon Mastery')}</div>}>
      {m === 'tower' && <TowerSelect onStart={(n) => g?.startTower(n)} />}
      {m === 'endless' && <div className="col"><div className="h gold" style={{ fontSize: 20 }}>Endless Dungeon</div><div className="muted">Waves of ever-stronger enemies in a random region. Elite waves every 5, guardian waves every 10. Compete for the local high-score table.</div><div className="chip">Best wave: <b className="gold">{save.stats.endless}</b></div><div><button className="btn gold" onClick={() => g?.startEndless()}>Enter the Endless Dungeon</button></div></div>}
      {m === 'rush' && <div className="col"><div className="h gold" style={{ fontSize: 20 }}>Boss Rush</div><div className="muted">Fight every guardian you have already defeated, back to back, with brief recovery between. Defeated: {bosses}/10 {bosses === 0 ? '(the first guardian is always available)' : ''}</div><div className="row" style={{ flexWrap: 'wrap' }}>{REGIONS.map((r) => <span key={r.id} className="chip" style={{ opacity: save.bosses[r.id] || r.id === 0 ? 1 : 0.35 }}>{r.boss.name}</span>)}</div><div><button className="btn gold" onClick={() => g?.startBossRush()}>Begin Boss Rush</button></div></div>}
      {m === 'challenge' && <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))' }}>{CHALLENGES.map((c) => <div key={c.id} className="panel" style={{ padding: 10 }}><div className="h gold" style={{ fontSize: 15 }}>{c.name} {save.challenges[c.id] ? '✓' : ''}</div><div className="muted" style={{ fontSize: 13, minHeight: 36 }}>{c.desc}</div><div className="muted" style={{ fontSize: 12 }}>Unlocks at floor {c.floor}</div><button className="btn sm gold" style={{ marginTop: 6 }} disabled={save.highest < c.floor} onClick={() => g?.startChallenge(c.id)}>Accept Challenge</button></div>)}</div>}
      {m === 'mastery' && <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))' }}>{FAMILIES.map((f) => { const lv = masteryLevel(save.mastery[f] || 0); return <div key={f} className="panel" style={{ padding: 10 }}><div className="h gold" style={{ fontSize: 15 }}>{WEAPONS[f].name} · Lv {lv}/10</div><div className="muted" style={{ fontSize: 12 }}>{WEAPONS[f].desc}</div><div className="muted" style={{ fontSize: 12 }}>Trial: clear 2 waves & land 3 perfect deflections.<br />Reward: mastery XP (+2% damage per level) &amp; gold.</div><button className="btn sm gold" style={{ marginTop: 6 }} onClick={() => { if (save.equip.weapon?.family !== f) { const inv = save.inv.find((i) => i.family === f); if (inv) equipItem(inv.id); else if (save.equip.weapon2?.family === f) swapWeapons(); else { toast(`Equip a ${WEAPONS[f].name} first`, '#f66'); return; } } g?.startMastery(f); }}>Start Trial</button></div>; })}</div>}
    </Modal>
  );
}
function ItemRow({ it, act, label, disabled }: { it: Item; act: () => void; label: string; disabled?: boolean }) { return <div className="row"><div style={{ flex: 1 }}><ItemCard it={it} /></div><button className="btn sm" disabled={disabled} onClick={act}>{label}</button></div>; }
export function BlacksmithPanel() {
  const save = useStore((s) => s.save);
  const list: { where: 'inv' | EquipKey; it: Item }[] = [...EQUIP_KEYS.filter((k) => save.equip[k]).map((k) => ({ where: k as EquipKey, it: save.equip[k]! })), ...save.inv.map((it) => ({ where: 'inv' as const, it }))];
  return (
    <Modal title="BLACKSMITH — UPGRADE & SALVAGE" onClose={close}>
      <div className="row" style={{ marginBottom: 8 }}><span className="chip">🪙 {save.gold}</span><span className="chip">✦ Essence {save.essence}</span><span className="muted" style={{ fontSize: 13 }}>Each upgrade grants +10% to every stat (max +10).</span></div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(360px,1fr))' }}>
        {list.map(({ where, it }) => { const c = upgradeCost(it); const can = it.upg < 10 && save.gold >= c.gold && save.essence >= c.ess; return (
          <div key={it.id + where} className="col" style={{ gap: 4 }}><ItemCard it={it} label={where === 'inv' ? 'inventory' : 'equipped'} />
            <div className="row"><button className="btn sm gold" disabled={!can} onClick={() => { if (upgradeEquipped(where, it.id)) { sfx('levelup', 0.7); sfx('heavy', 0.5); } }}>{it.upg >= 10 ? 'MAX' : `Upgrade ${c.gold}🪙 ${c.ess}✦`}</button>{where === 'inv' && <button className="btn sm" onClick={() => { salvageItem(it.id); sfx('gold'); }}>Salvage → ✦{1 + RARITIES.indexOf(it.rarity) * 2 + it.upg}</button>}</div></div>); })}
      </div>
    </Modal>
  );
}
export function MerchantPanel() {
  const save = useStore((s) => s.save); const [t, setT] = useState('buy'); useEffect(() => { refreshShop(); }, []);
  return (
    <Modal title="EQUIPMENT MERCHANT" onClose={close} tabs={<div className="tabs"><button className={`tab ${t === 'buy' ? 'on' : ''}`} onClick={() => setT('buy')}>Buy</button><button className={`tab ${t === 'sell' ? 'on' : ''}`} onClick={() => setT('sell')}>Sell</button></div>}>
      <div className="row" style={{ marginBottom: 8, flexWrap: 'wrap' }}><span className="chip">🪙 {save.gold}</span><span className="muted">Stock scales with your highest floor.</span>{t === 'buy' && <button className="btn sm" onClick={() => refreshShop(true)}>Refresh stock (80🪙)</button>}</div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(360px,1fr))' }}>
        {t === 'buy' ? save.shop.map((it) => <ItemRow key={it.id} it={it} label={`${buyValue(it)}🪙`} disabled={save.gold < buyValue(it)} act={() => { buyItem(it.id); sfx('gold'); }} />)
          : save.inv.map((it) => <ItemRow key={it.id} it={it} label={`Sell ${sellValue(it)}🪙`} act={() => { sellItem(it.id); sfx('gold'); }} />)}
        {t === 'buy' && !save.shop.length && <div className="muted">Sold out — refresh the stock.</div>}{t === 'sell' && !save.inv.length && <div className="muted">Nothing to sell.</div>}
      </div>
    </Modal>
  );
}
export function VaultPanel() {
  const save = useStore((s) => s.save);
  return (
    <Modal title="STORAGE VAULT" onClose={close} w={1000}>
      <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div className="col" style={{ flex: '1 1 380px' }}><div className="h gold" style={{ fontSize: 13 }}>CARRIED {save.inv.length}/{INV_CAP}</div>{save.inv.map((it) => <ItemRow key={it.id} it={it} label="Store →" act={() => toVault(it.id)} />)}</div>
        <div className="col" style={{ flex: '1 1 380px' }}><div className="h gold" style={{ fontSize: 13 }}>VAULT {save.vault.length}/{VAULT_CAP}</div>{save.vault.map((it) => <ItemRow key={it.id} it={it} label="← Take" act={() => fromVault(it.id)} />)}{!save.vault.length && <div className="muted">The vault is empty. Store gear you want to keep safe.</div>}</div>
      </div>
    </Modal>
  );
}
export function TrainerPanel() { return <Modal title="SKILL TRAINER" onClose={close} w={960}><SkillsTab trainer /></Modal>; }
export function QuestsPanel() {
  const save = useStore((s) => s.save);
  return (
    <Modal title="QUEST BOARD — DAILY CHALLENGES" onClose={close} w={640}>
      <div className="muted" style={{ marginBottom: 8, fontSize: 13 }}>Quests refresh daily ({save.quests.day}). Progress counts from the moment they were posted.</div>
      <div className="col">{save.quests.list.map((q, i) => { const p = Math.min(q.n, save.stats[q.stat] - q.base); return (
        <div key={i} className="panel" style={{ padding: 10 }}><div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}><b>{q.text}</b><span className="gold">🪙 {q.gold} + 3✦</span></div>
          <div className="bar xp" style={{ transform: 'none', height: 10, margin: '6px 0' }}><i style={{ width: `${(p / q.n) * 100}%` }} /><b style={{ transform: 'none', fontSize: 10 }}>{p}/{q.n}</b></div>
          <button className="btn sm gold" disabled={q.claimed || p < q.n} onClick={() => { claimQuest(i); sfx('item'); }}>{q.claimed ? 'Claimed ✓' : p >= q.n ? 'Claim reward' : 'In progress'}</button></div>); })}</div>
    </Modal>
  );
}
export function AchievementsPanel() {
  const save = useStore((s) => s.save); const n = ACHIEVEMENTS.filter((a) => save.ach[a.id]).length;
  return (
    <Modal title={`ACHIEVEMENT HALL — ${n}/${ACHIEVEMENTS.length}`} onClose={close} w={860}>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))' }}>{ACHIEVEMENTS.map((a) => { const u = save.ach[a.id]; return <div key={a.id} className="icard" style={{ ['--rc' as string]: u ? '#ffd860' : '#445', opacity: u ? 1 : 0.65 }}><div className="ico">{u ? a.icon : '🔒'}</div><div><div className="nm">{a.name}</div><div className="st">{a.desc}</div><div className="st gold">+{a.gold}🪙</div></div></div>; })}</div>
    </Modal>
  );
}
export function TrophiesPanel() {
  const save = useStore((s) => s.save); const done = save.cleared[100];
  return (
    <Modal title="BOSS TROPHY HALL" onClose={close} w={900}>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(270px,1fr))' }}>{REGIONS.map((r) => { const b = save.bosses[r.id]; const col = '#' + r.boss.glow.toString(16).padStart(6, '0'); return (
        <div key={r.id} className="panel" style={{ padding: 10, opacity: b ? 1 : 0.55, borderColor: b ? col : undefined }}>
          <div className="h" style={{ color: b ? col : '#778', fontSize: 14 }}>{b ? '☠ ' : '🔒 '}{r.boss.name}</div><div className="muted" style={{ fontSize: 12 }}>{r.boss.title}</div>
          {b ? <><div style={{ fontSize: 13 }}>Defeated ×{b.kills} · best {fmtTime(b.best)} {b.noHit ? <span className="cy">· ★ NO HIT</span> : ''}</div><div className="muted" style={{ fontSize: 12 }}>Exclusive: {r.boss.weapon.name}, {r.set.name} set</div></> : <div className="muted" style={{ fontSize: 12 }}>Defeat the guardian of floor {r.floors[1]}.</div>}
        </div>); })}</div>
      <div className="sep" />
      <div className="row" style={{ flexWrap: 'wrap' }}><span className="muted">New Game+: restart the tower with all your gear against much stronger foes (+80% health, +50% damage per cycle).</span>
        <button className="btn gold" disabled={!done} onClick={() => { startNgPlus(); sfx('legend'); }}>{done ? 'Begin New Game+' : 'Clear floor 100 to unlock'}</button></div>
    </Modal>
  );
}
export function Panels() {
  const p = useStore((s) => s.panel);
  switch (p) { case 'menu': return <MenuPanel />; case 'portal': return <PortalPanel />; case 'blacksmith': return <BlacksmithPanel />; case 'merchant': return <MerchantPanel />; case 'vault': return <VaultPanel />; case 'trainer': return <TrainerPanel />; case 'quests': return <QuestsPanel />; case 'achievements': return <AchievementsPanel />; case 'trophies': return <TrophiesPanel />; default: return null; }
}
