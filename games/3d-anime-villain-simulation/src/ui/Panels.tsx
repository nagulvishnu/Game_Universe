import { useMemo, useRef, useState, useEffect } from 'react';
import {
  AURAS, CATS, CAT_COL, COATS, EYEC, FACES, FORMS, GLOVES, HAIRC, HAIRSTYLES, ICATS, ITEMS, ITEM_MAP, MISSIONS, RARITIES, RCOL, REGIONS, REGION_MAP, SKILLS, SKILL_MAP, SKINS, STAGES, WORLD_OFF, regionCenter,
  type ICat, type Cat, type TState,
} from '../game/data';
import { derive, missionAvail, progressOf, rankOf, unlockedSkill, useGame, ownedTerr, facLv } from '../game/store';
import { G } from '../game/runtime';
import { Bar, Btn, Chip, ItemArt, ItemCard, Rb, SkillGlyph, money } from './common';
import { SkillPreview } from './SkillPreview';
import { Preview3D } from './Preview3D';
import { setVolume } from '../game/audio';

const Swatch = ({ c, on, onClick }: { c: string; on: boolean; onClick: () => void }) => <button onClick={onClick} className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110" style={{ background: c, borderColor: on ? '#fff' : 'rgba(255,255,255,0.2)', boxShadow: on ? `0 0 12px ${c}` : 'none' }} />;
const Row = ({ label, children }: { label: string; children: React.ReactNode }) => <div className="mb-2"><div className="text-[10px] uppercase tracking-widest text-white/50 mb-1">{label}</div><div className="flex flex-wrap gap-1.5">{children}</div></div>;

// ───────────── Customization ─────────────
export function Customize({ compact }: { compact?: boolean }) {
  const look = useGame((s) => s.look); const set = useGame((s) => s.setLook); const accs = look.acc;
  const toggle = (a: string) => set({ acc: accs.includes(a) ? accs.filter((x) => x !== a) : [...accs, a] });
  return (
    <div className={compact ? 'text-sm' : ''}>
      <Row label="Face">{FACES.map((f, i) => <Chip key={f} on={look.face === i} onClick={() => set({ face: i })}>{f}</Chip>)}</Row>
      <Row label="Hairstyle">{HAIRSTYLES.map((f, i) => <Chip key={f} on={look.hairStyle === i} onClick={() => set({ hairStyle: i })}>{f}</Chip>)}</Row>
      <Row label="Hair color">{HAIRC.map((c) => <Swatch key={c} c={c} on={look.hairColor === c} onClick={() => set({ hairColor: c })} />)}</Row>
      <Row label="Eye color">{EYEC.map((c) => <Swatch key={c} c={c} on={look.eyeColor === c} onClick={() => set({ eyeColor: c })} />)}</Row>
      <Row label="Skin">{SKINS.map((c) => <Swatch key={c} c={c} on={look.skin === c} onClick={() => set({ skin: c })} />)}</Row>
      <Row label="Jacket / coat / armor">{COATS.map((c) => <Chip key={c} on={look.coat === c} onClick={() => set({ coat: c })}>{c}</Chip>)}</Row>
      <Row label="Coat color">{['#2b2b36', '#7f1d1d', '#1e3a8a', '#14532d', '#e5e7eb', '#581c87', '#92400e'].map((c) => <Swatch key={c} c={c} on={look.coatColor === c} onClick={() => set({ coatColor: c })} />)}</Row>
      <Row label="Gloves">{GLOVES.map((c) => <Chip key={c} on={look.glove === c} onClick={() => set({ glove: c })}>{c}</Chip>)}</Row>
      <Row label="Glove color">{['#15151a', '#7f1d1d', '#e5e7eb', '#1e3a8a', '#92400e'].map((c) => <Swatch key={c} c={c} on={look.gloveColor === c} onClick={() => set({ gloveColor: c })} />)}</Row>
      <Row label="Accessories">{['headband', 'scarf', 'goggles', 'mask', 'earring'].map((a) => <Chip key={a} on={accs.includes(a)} onClick={() => toggle(a)}>{a}</Chip>)}</Row>
      <Row label="Aura / energy color">{AURAS.map((c) => <Swatch key={c} c={c} on={look.aura === c} onClick={() => set({ aura: c })} />)}</Row>
    </div>
  );
}

// ───────────── Inventory ─────────────
export function Inventory() {
  const s = useGame(); const [cat, setCat] = useState<ICat | 'All'>('All'); const [q, setQ] = useState(''); const [sel, setSel] = useState<string>(s.weapon || 'knife');
  const ownedItems = useMemo(() => ITEMS.filter((i) => s.inv[i.id]), [s.inv]);
  const items = useMemo(() => ownedItems.filter((i) => (cat === 'All' || i.cat === cat) && i.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => RARITIES.indexOf(b.rarity) - RARITIES.indexOf(a.rarity)), [ownedItems, cat, q]);
  useEffect(() => { if (!items.some((item) => item.id === sel)) setSel(items[0]?.id ?? ''); }, [items, sel]);
  const it = ITEM_MAP[sel]; const owned = it && s.inv[it.id]; const eq = (id: string) => s.weapon === id || s.armor === id || s.outfit === id || s.accs.includes(id);
  const equipped = it && eq(it.id); const wlv = s.wlv[sel] ?? 0; const canEquip = it && ['Weapons', 'Armor', 'Outfits', 'Accessories'].includes(it.cat);
  const countFor = (category: ICat | 'All') => category === 'All' ? ownedItems.length : ownedItems.filter((item) => item.cat === category).length;
  return (
    <div className="h-full min-h-0 grid grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(0,0.8fr)] min-[800px]:grid-rows-1 min-[800px]:grid-cols-[minmax(0,1fr)_minmax(260px,340px)] gap-3">
      <section className="min-w-0 min-h-0 flex flex-col rounded-xl border border-white/10 bg-black/20 p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div><div className="title-font text-xl text-white">ARSENAL</div><div className="text-[10px] text-white/45 uppercase tracking-[0.2em] mt-0.5">Field equipment & recovered gear</div></div>
          <div className="flex gap-2 shrink-0">
            <div className="inventory-stat"><b>{ownedItems.length}</b><span>Items</span></div>
            <div className="inventory-stat"><b>{ownedItems.reduce((total, item) => total + (s.inv[item.id] ?? 0), 0)}</b><span>Supply</span></div>
          </div>
        </div>
        <div className="flex flex-col gap-2 mb-3">
          <div className="inventory-categories flex flex-wrap gap-1.5">
            {(['All', ...ICATS] as const).map((category) => <button key={category} type="button" onClick={() => setCat(category)} className={`inventory-filter ${cat === category ? 'active' : ''}`}>{category}<span>{countFor(category)}</span></button>)}
          </div>
          <label className="relative w-full">
            <span className="sr-only">Search inventory</span>
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" aria-hidden="true">⌕</span>
            <input type="text" placeholder="Search gear…" value={q} onChange={(e) => setQ(e.target.value)} className="w-full !pl-8 !py-2 !rounded-lg !border-white/10 !bg-black/35" />
          </label>
        </div>
        <div className="scroll min-h-0 flex-1 overflow-y-auto grid gap-2 pr-1 content-start" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(112px, 1fr))', alignContent: 'start' }}>
          {items.map((i) => <ItemCard key={i.id} item={i} qty={s.inv[i.id]} equipped={eq(i.id)} sel={sel === i.id} onClick={() => setSel(i.id)} lvl={s.wlv[i.id]} />)}
          {!items.length && <div className="inventory-empty col-span-full"><div className="title-font text-lg text-white/75">{q ? 'NO MATCHES FOUND' : 'NO GEAR IN THIS CATEGORY'}</div><div className="text-xs text-white/45 mt-1">{q ? 'Try another search term or category.' : 'Explore the city, complete missions, and recover equipment.'}</div></div>}
        </div>
      </section>
      <aside className="min-h-0 scroll overflow-y-auto rounded-xl border border-violet-300/15 bg-gradient-to-b from-violet-950/25 to-black/35 p-3 sm:p-4">
        {it && owned ? (
          <div className="fadein" key={it.id}>
            <div className="flex items-center justify-between text-[9px] uppercase tracking-[0.22em] text-white/40 mb-2"><span>Selected item</span>{equipped && <span className="text-emerald-300">● Equipped</span>}</div>
            {['Weapons', 'Armor', 'Outfits', 'Accessories'].includes(it.cat) ? <Preview3D item={it} height={210} /> : <div className="rounded-xl border border-white/10 flex justify-center py-3 bg-[radial-gradient(circle_at_50%_35%,rgba(124,58,237,0.28),rgba(7,8,18,0.96)_72%)]"><div style={{ animation: 'floaty 3s ease-in-out infinite' }}><ItemArt item={it} size={148} anim /></div></div>}
            <div className="mt-3 flex items-start justify-between gap-2"><div className="text-xl font-extrabold leading-tight" style={{ color: RCOL[it.rarity] }}>{it.name}{wlv ? ` +${wlv}` : ''}</div><Rb r={it.rarity} /></div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/45 mt-1">{it.cat}{it.wtype ? ` • ${it.wtype}` : ''} • Qty {s.inv[it.id]}</div>
            <p className="text-sm leading-relaxed text-white/70 my-3">{it.desc}</p>
            {it.stats && <div className="grid grid-cols-2 gap-1.5 my-3">{Object.entries(it.stats).map(([k, v]) => <div key={k} className="inventory-detail-stat"><span className="text-white/45">{k}</span><b>{typeof v === 'number' && k === 'Attack' ? Math.round(v * (1 + 0.2 * wlv)) : v}</b></div>)}</div>}
            {it.effects?.length ? <div className="border-t border-white/10 pt-2 mt-3">{it.effects.map((e) => <div key={e} className="text-xs text-emerald-300 py-0.5">✦ {e}</div>)}</div> : null}
            {it.special && <div className="text-xs text-amber-300 mt-2 rounded-lg border border-amber-300/15 bg-amber-300/5 p-2">★ {it.special}</div>}
            <div className="flex items-center justify-between text-xs text-white/45 mt-3 pt-2 border-t border-white/10"><span>Estimated value</span><b className="text-amber-200">{money(it.price)}</b></div>
            <div className="flex flex-wrap gap-2 mt-3">
              {canEquip && !equipped && <Btn primary onClick={() => s.equipItem(it.id)}>Equip</Btn>}
              {canEquip && equipped && it.id !== 'o_street' && <Btn onClick={() => s.unequipItem(it.id)}>Unequip</Btn>}
              {(it.heal || it.energy || it.form) && <Btn primary onClick={() => s.useItem(it.id)}>Use</Btn>}
              {it.cat === 'Weapons' && <Btn onClick={() => s.upgradeWeapon(it.id)} disabled={wlv >= 10}>Upgrade {wlv}/10</Btn>}
            </div>
            {it.cat === 'Weapons' && !facLv(s, 'armory') && <div className="text-[11px] text-white/45 mt-3 rounded-lg border border-white/10 bg-black/20 p-2">Build an Armory in your HQ to upgrade weapons.</div>}
          </div>
        ) : <div className="inventory-empty h-full min-h-48"><div className="title-font text-lg text-white/75">SELECT AN ITEM</div><div className="text-xs text-white/45 mt-1">Choose gear from your collection to inspect its stats and actions.</div></div>}
      </aside>
    </div>
  );
}

// ───────────── Skills ─────────────
export function Skills() {
  const s = useGame(); const [cat, setCat] = useState<Cat | 'All'>('All'); const [q, setQ] = useState(''); const [sort, setSort] = useState('level'); const [filt, setFilt] = useState('all'); const [sel, setSel] = useState('shadow_bolt'); const [k, setK] = useState(0);
  const list = useMemo(() => {
    const l = SKILLS.filter((x) => (cat === 'All' || x.cat === cat) && (x.name + x.cat + x.desc).toLowerCase().includes(q.toLowerCase()) && (filt === 'all' || (filt === 'unlocked' && unlockedSkill(s, x.id)) || (filt === 'locked' && !unlockedSkill(s, x.id)) || (filt === 'equipped' && Object.values(s.eq).includes(x.id)) || (filt === 'ult' && x.ult)));
    return l.sort((a, b) => sort === 'level' ? a.lvl - b.lvl : sort === 'damage' ? b.dmg - a.dmg : sort === 'cooldown' ? a.cd - b.cd : sort === 'rarity' ? RARITIES.indexOf(b.rarity) - RARITIES.indexOf(a.rarity) : a.name.localeCompare(b.name));
  }, [cat, q, sort, filt, s]);
  const sk = SKILL_MAP[sel]; const un = unlockedSkill(s, sel); const slot = (['e', 'r', 'v'] as const).find((x) => s.eq[x] === sel);
  return (
    <div className="flex h-full gap-4">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex gap-2 mb-2 items-center">
          {(['e', 'r', 'v'] as const).map((x) => { const e = SKILL_MAP[s.eq[x]]; return <div key={x} onClick={() => e && setSel(e.id)} className="flex items-center gap-2 bg-black/40 border border-white/15 px-2 py-1 rounded cursor-pointer min-w-[130px]"><span className="w-6 h-6 bg-white text-black font-black text-xs flex items-center justify-center rounded">{x.toUpperCase()}</span>{e ? <><SkillGlyph s={e} size={26} /><span className="text-[11px] font-bold truncate">{e.name}</span></> : <span className="text-[11px] text-white/40">{x === 'v' ? 'Ultimate slot' : 'Empty'}</span>}</div>; })}
          <input type="text" placeholder="Search skills…" value={q} onChange={(e) => setQ(e.target.value)} className="ml-auto w-36" />
          <select value={sort} onChange={(e) => setSort(e.target.value)}>{['level', 'damage', 'cooldown', 'rarity', 'name'].map((x) => <option key={x}>{x}</option>)}</select>
          <select value={filt} onChange={(e) => setFilt(e.target.value)}>{['all', 'unlocked', 'locked', 'equipped', 'ult'].map((x) => <option key={x}>{x}</option>)}</select>
        </div>
        <div className="flex gap-1 flex-wrap mb-2"><Chip on={cat === 'All'} onClick={() => setCat('All')}>All</Chip>{CATS.map((c) => <Chip key={c} on={cat === c} onClick={() => setCat(c)}>{c}</Chip>)}</div>
        <div className="scroll overflow-y-auto grid gap-2 pr-1 content-start" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(118px, 1fr))', gridAutoRows: 'minmax(118px, auto)' }}>
          {list.map((x) => { const u = unlockedSkill(s, x.id); const eqd = Object.values(s.eq).includes(x.id); return (
            <div key={x.id} onClick={() => { setSel(x.id); setK((v) => v + 1); }} className={`card p-2 ${sel === x.id ? 'sel' : ''} ${x.rarity === 'Legendary' || x.rarity === 'Mythic' || x.rarity === 'Divine' ? 'glow' : ''}`} style={{ ['--rc' as any]: RCOL[x.rarity], opacity: u ? 1 : 0.55 }}>
              <div className="shine" /><div className="flex justify-center"><SkillGlyph s={x} size={62} /></div>
              <div className="text-[11px] font-bold text-center truncate" style={{ color: RCOL[x.rarity] }}>{x.name}</div><div className="text-[9px] text-center uppercase tracking-wider" style={{ color: CAT_COL[x.cat] }}>{x.cat}{x.ult ? ' • ULT' : ''}</div>
              {eqd && <div className="absolute top-1 left-1 text-[8px] font-black bg-emerald-500 text-black px-1 rounded">EQUIPPED</div>}{!u && <div className="absolute top-1 right-1 text-[9px] bg-black/80 px-1 rounded">🔒 {x.req ? 'BOSS' : 'Lv' + x.lvl}</div>}
            </div>); })}
        </div>
      </div>
      <div className="w-[470px] shrink-0 scroll overflow-y-auto pr-1">
        {sk && <div className="fadein" key={sk.id}>
          <SkillPreview s={sk} k={k} />
          <div className="flex gap-2 mt-2"><Btn onClick={() => setK((v) => v + 1)}>↻ Replay preview</Btn>{un && !sk.ult && <><Btn primary={slot !== 'e'} onClick={() => s.equipSkill('e', sk.id)}>Equip → E</Btn><Btn primary={slot !== 'r'} onClick={() => s.equipSkill('r', sk.id)}>Equip → R</Btn></>}{un && sk.ult && <Btn primary onClick={() => s.equipSkill('v', sk.id)}>Equip → V (Ultimate)</Btn>}</div>
          <div className="flex items-center justify-between mt-3"><div className="text-xl font-extrabold" style={{ color: RCOL[sk.rarity] }}>{sk.name}</div><Rb r={sk.rarity} /></div>
          <div className="text-[11px] uppercase tracking-widest" style={{ color: CAT_COL[sk.cat] }}>{sk.cat} • {sk.fx}{sk.ult ? ' • Ultimate' : ''}</div>
          <p className="text-sm text-white/75 my-2">{sk.desc}</p>
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            {[['Damage', sk.dmg ? Math.round(sk.dmg * (1 + s.level * 0.06) * derive(s).dmgMult) : '—'], ['Range', sk.range ? sk.range + ' m' : 'Self'], ['Cooldown', sk.cd + ' s'], ['Energy', sk.cost], ['Rarity', sk.rarity], ['Equipped', slot ? slot.toUpperCase() + ' slot' : 'No']].map(([a, b]) => <div key={String(a)} className="bg-white/5 rounded px-2 py-1 flex justify-between"><span className="text-white/50">{a}</span><b>{b}</b></div>)}
          </div>
          <div className="mt-2 text-xs" style={{ color: un ? '#34d399' : '#fb923c' }}>{un ? '✔ Unlocked' : sk.req ? `🔒 Defeat the rival boss ${sk.req.toUpperCase()} and reach level ${sk.lvl}` : `🔒 Reach level ${sk.lvl} (you are ${s.level})`}</div>
        </div>}
      </div>
    </div>
  );
}

// ───────────── Map ─────────────
const SCOL: Record<TState, string> = { Neutral: '#9ca3af', 'Hero-Controlled': '#4aa3ff', Contested: '#ff9a3c', 'Villain-Controlled': '#ff2e57', 'Fully Conquered': '#fbbf24' };
export function MapPanel() {
  const s = useGame(); const ref = useRef<HTMLCanvasElement>(null); const [sel, setSel] = useState('metro'); const [, tick] = useState(0);
  const S = 560, C = S / 3;
  useEffect(() => {
    const cv = ref.current!; const g = cv.getContext('2d')!; const draw = () => {
      g.clearRect(0, 0, S, S); g.fillStyle = '#071018'; g.fillRect(0, 0, S, S);
      for (const r of REGIONS) { const t = s.terr[r.id]; const x = r.gx * C, y = r.gy * C; g.fillStyle = SCOL[t.state] + '33'; g.fillRect(x + 3, y + 3, C - 6, C - 6); g.strokeStyle = r.id === sel ? '#fff' : SCOL[t.state]; g.lineWidth = r.id === sel ? 3 : 1.5; g.strokeRect(x + 3, y + 3, C - 6, C - 6);
        g.strokeStyle = SCOL[t.state] + '44'; g.lineWidth = 1; for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(x + 3 + (i * (C - 6)) / 5, y + 3); g.lineTo(x + 3 + (i * (C - 6)) / 5, y + C - 3); g.moveTo(x + 3, y + 3 + (i * (C - 6)) / 5); g.lineTo(x + C - 3, y + 3 + (i * (C - 6)) / 5); g.stroke(); }
        g.fillStyle = '#fff'; g.font = 'bold 12px sans-serif'; g.fillText(r.name.split(' (')[0], x + 10, y + 22); g.fillStyle = SCOL[t.state]; g.font = '10px sans-serif'; g.fillText(t.state.toUpperCase(), x + 10, y + 36); g.fillStyle = '#ffffff99'; g.fillText(`Boss: ${r.bossName} (Lv ${r.lvl})`, x + 10, y + C - 12);
        const c = regionCenter(r); const px = ((c.x - WORLD_OFF) / 1200) * S, py = ((c.z - WORLD_OFF) / 1200) * S; g.fillStyle = SCOL[t.state]; g.beginPath(); g.arc(px, py, 6, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.stroke(); }
      const hx = ((-80 - WORLD_OFF) / 1200) * S, hz = ((0 - WORLD_OFF) / 1200) * S; g.fillStyle = '#ffd23f'; g.fillRect(hx - 5, hz - 5, 10, 10); g.fillStyle = '#fff'; g.font = 'bold 10px sans-serif'; g.fillText('HQ', hx - 8, hz - 9);
      if (G.waypoint) { const wx = ((G.waypoint.x - WORLD_OFF) / 1200) * S, wz = ((G.waypoint.z - WORLD_OFF) / 1200) * S; g.strokeStyle = '#34d399'; g.lineWidth = 2; g.beginPath(); g.arc(wx, wz, 8 + Math.sin(performance.now() / 200) * 2, 0, 7); g.stroke(); }
      const p = G.p; const ppx = ((p.pos.x - WORLD_OFF) / 1200) * S, ppz = ((p.pos.z - WORLD_OFF) / 1200) * S; if (!G.p.interior) { g.save(); g.translate(ppx, ppz); g.rotate(-p.yaw + Math.PI); g.fillStyle = '#ff2e57'; g.shadowColor = '#ff2e57'; g.shadowBlur = 12; g.beginPath(); g.moveTo(0, -9); g.lineTo(7, 8); g.lineTo(0, 4); g.lineTo(-7, 8); g.closePath(); g.fill(); g.restore(); }
    }; draw(); const iv = setInterval(draw, 100); return () => clearInterval(iv);
  }, [s.terr, sel]);
  const r = REGION_MAP[sel]; const t = s.terr[sel]; const own = t.state === 'Villain-Controlled' || t.state === 'Fully Conquered'; const cmd = s.members.find((m) => m.id === t.commander);
  return (
    <div className="flex h-full gap-4">
      <canvas ref={ref} width={S} height={S} className="rounded-lg border border-white/15 cursor-pointer shrink-0" style={{ width: 'min(100%, 62vh)', height: 'min(auto, 62vh)', aspectRatio: '1' }} onClick={(e) => { const b = e.currentTarget.getBoundingClientRect(); const gx = Math.floor(((e.clientX - b.left) / b.width) * 3), gy = Math.floor(((e.clientY - b.top) / b.height) * 3); const rr = REGIONS.find((x) => x.gx === gx && x.gy === gy); if (rr) setSel(rr.id); }} />
      <div className="flex-1 scroll overflow-y-auto fadein" key={sel}>
        <div className="text-2xl font-extrabold title-font" style={{ color: r.accent }}>{r.name}</div>
        <div className="inline-block text-xs font-bold px-2 py-0.5 rounded my-1" style={{ background: SCOL[t.state], color: '#000' }}>{t.state.toUpperCase()}</div>
        <p className="text-sm text-white/70 my-2">{r.desc}</p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {[['Boss / Commander', r.bossName], ['Recommended level', r.lvl], ['Garrison', r.garrison + ' + boss'], ['Income when owned', money(r.income * 0.05) + ' / cycle'], ['Defense', Math.round(t.defense + (cmd?.str ?? 0) * 0.6)], ['Governor', cmd ? cmd.name : own ? 'None assigned' : '—']].map(([a, b]) => <div key={String(a)} className="bg-white/5 rounded px-2 py-1.5 flex justify-between"><span className="text-white/50">{a}</span><b>{b}</b></div>)}
        </div>
        <div className="flex gap-2 mt-3 flex-wrap"><Btn primary onClick={() => { const c = regionCenter(r); G.waypoint = { x: c.x, z: c.z }; s.toast(`Waypoint set: ${r.name}`, '#34d399'); tick((v) => v + 1); }}>Set waypoint</Btn>{G.waypoint && <Btn onClick={() => { G.waypoint = null; tick((v) => v + 1); }}>Clear waypoint</Btn>}{own && <Btn onClick={() => s.setOverlay('org', 'territory')}>Manage territory</Btn>}</div>
        <p className="text-xs text-white/40 mt-3">To conquer a region, fly to its Command Tower (glowing beacon) and press G to launch an assault: defeat 3 waves of defenders, then the boss. Hold the territory by assigning commanders and building a War Room.</p>
        <div className="mt-3 text-xs text-white/60">Territories owned: <b>{ownedTerr(s)}</b> / 9</div>
        <div className="flex gap-3 flex-wrap mt-2 text-[10px]">{(Object.keys(SCOL) as TState[]).map((k) => <span key={k} className="flex items-center gap-1"><i className="w-3 h-3 inline-block rounded-sm" style={{ background: SCOL[k] }} />{k}</span>)}</div>
      </div>
    </div>
  );
}

// ───────────── Missions ─────────────
export function Missions() {
  const s = useGame(); const rank = rankOf(s); const all = [...s.contracts, ...MISSIONS];
  const rows = (list: typeof all, title: string) => (
    <div className="mb-4"><div className="text-xs uppercase tracking-widest text-white/50 mb-1">{title}</div>
      {list.map((m) => { const done = s.done[m.id]; const av = missionAvail(s, m); const base = m.id.startsWith('c_') ? s.counters['base_' + m.id] ?? 0 : 0; const pv = Math.max(0, Math.min(m.need, progressOf(s, m) - base)); return (
        <div key={m.id} className={`mb-2 p-2 rounded border ${s.tracked === m.id ? 'border-rose-500 bg-rose-500/10' : 'border-white/10 bg-white/5'} ${done ? 'opacity-50' : ''}`}>
          <div className="flex items-center justify-between"><b className="text-sm">{done ? '✔ ' : av ? '' : '🔒 '}{m.title}</b><span className="text-[10px] text-white/50">{m.main ? 'MAIN' : m.id.startsWith('c_') ? 'CONTRACT' : 'SIDE'}</span></div>
          <div className="text-xs text-white/60">{av || done ? m.desc : `Locked — ${m.after && !s.done[m.after] ? 'finish the previous mission first' : `reach stage ${m.rank}: ${STAGES[m.rank - 1]}`}`}</div>
          {av && !done && <div className="my-1"><Bar v={pv} max={m.need} color="#ff2e57" h={10} label={`${pv} / ${m.need}`} /></div>}
          <div className="flex items-center justify-between text-[11px] mt-1"><span className="text-amber-300">{money(m.money)} • {m.rep} REP • {m.xp} XP{m.item ? ` • ${ITEM_MAP[m.item]?.name}` : ''}</span>{av && !done && <Btn onClick={() => s.track(m.id)}>{s.tracked === m.id ? 'Tracked' : 'Track'}</Btn>}</div>
        </div>); })}
    </div>
  );
  return (
    <div className="scroll overflow-y-auto h-full pr-2 grid grid-cols-1 lg:grid-cols-2 gap-x-6">
      <div>{rows(MISSIONS.filter((m) => m.main), 'Main progression (free order — go your own way)')}</div>
      <div>
        <div className="flex items-center justify-between mb-2"><div className="text-xs uppercase tracking-widest text-white/50">Contracts</div><Btn onClick={() => s.newContract()}>+ Accept new contract</Btn></div>
        {rows(s.contracts, 'Active contracts')}{rows(MISSIONS.filter((m) => !m.main), 'Side activities')}
        <div className="text-xs text-white/40">Current stage: <b className="text-white">{STAGES[rank - 1]}</b></div>
      </div>
    </div>
  );
}

// ───────────── Character ─────────────
export function Character() {
  const s = useGame(); const d = derive(s); const [pf, setPf] = useState(s.formSel);
  return (
    <div className="flex h-full gap-4">
      <div className="w-[360px] shrink-0 flex flex-col gap-2">
        <Preview3D form={pf} height={380} />
        <div className="text-center text-xs text-white/50">Previewing: <b className="text-white">{FORMS[pf].name}</b></div>
        <div className="text-xs bg-white/5 rounded p-2 grid grid-cols-2 gap-1"><span>Level <b>{s.level}</b></span><span>Rank <b>{rankOf(s)}</b></span><span>Health <b>{d.maxHp}</b></span><span>Energy <b>{d.maxEn}</b></span><span>Damage ×<b>{d.dmgMult.toFixed(2)}</b></span><span>Defense <b>{Math.round(d.def)}</b></span><span>Speed ×<b>{d.speedMult.toFixed(2)}</b></span><span>Flight ×<b>{d.flyMult.toFixed(2)}</b></span></div>
      </div>
      <div className="flex-1 scroll overflow-y-auto pr-2">
        <div className="text-xs uppercase tracking-widest text-white/50 mb-1">Transformations</div>
        <div className="grid gap-2 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))' }}>
          {FORMS.map((f) => { const un = s.forms.includes(f.id); return (
            <div key={f.id} onClick={() => setPf(f.id)} className={`card p-2 ${pf === f.id ? 'sel' : ''}`} style={{ ['--rc' as any]: f.aura, opacity: un ? 1 : 0.6 }}>
              <div className="shine" /><div className="font-extrabold text-sm" style={{ color: f.aura }}>{f.name}</div><div className="text-[10px] text-white/50 mb-1">{f.desc}</div>
              <div className="text-[10px] grid grid-cols-2 gap-x-2"><span>Damage ×{f.dmg}</span><span>Speed ×{f.speed}</span><span>Flight ×{f.fly}</span><span>Cost {f.cost} EN</span></div>
              {f.skill && <div className="text-[10px] text-amber-300">Ultimate: {SKILL_MAP[f.skill].name}</div>}
              <div className="flex gap-1 mt-1">{un ? <Btn primary={s.formSel !== f.id} onClick={() => s.setFormSel(f.id)} disabled={f.id === 0}>{s.formSel === f.id ? 'Selected (T)' : 'Select'}</Btn> : <span className="text-[10px] text-orange-300">🔒 Lv {f.lvl} + {ITEMS.find((i) => i.form === f.id)?.name}</span>}</div>
            </div>); })}
        </div>
        <div className="text-xs uppercase tracking-widest text-white/50 mb-1">Appearance</div>
        <Customize />
        <div className="text-xs uppercase tracking-widest text-white/50 mt-3 mb-1">Owned outfits & gear (equip in Inventory)</div>
        <div className="flex gap-2 flex-wrap">{ITEMS.filter((i) => (i.cat === 'Outfits' || i.cat === 'Armor') && s.inv[i.id]).map((i) => <ItemCard key={i.id} item={i} equipped={s.outfit === i.id || s.armor === i.id} onClick={() => (s.outfit === i.id || s.armor === i.id ? s.unequipItem(i.id) : s.equipItem(i.id))} />)}</div>
      </div>
    </div>
  );
}

// ───────────── Market ─────────────
const STOCK = ['medkit', 'energycell', 'stim', 'scrap', 'circuit', 'darkcrystal', 'plasmacore', 'katana', 'plasma_pistol', 'fangs', 'ironbreaker', 'jacket', 'trench', 'ironplate', 'o_suit', 'o_ninja', 'o_neon', 'a_mask', 'a_goggles', 'a_scarf', 'a_ear', 'venom_spear', 'reaper', 'tf_shadow', 'tf_crimson', 'cloak'];
export function Market() {
  const s = useGame(); const [tab, setTab] = useState<'buy' | 'sell'>('buy'); const rank = rankOf(s);
  return (
    <div className="h-full flex flex-col">
      <div className="flex gap-2 mb-3 items-center"><Chip on={tab === 'buy'} onClick={() => setTab('buy')}>Buy</Chip><Chip on={tab === 'sell'} onClick={() => setTab('sell')}>Sell (50%)</Chip><span className="ml-auto text-amber-300 font-bold">{money(s.money)}</span></div>
      <div className="scroll overflow-y-auto grid gap-2 pr-1 content-start" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))' }}>
        {tab === 'buy' ? STOCK.map((id) => { const it = ITEM_MAP[id]; const price = Math.round(it.price * 1.5); const locked = price > 15000 * rank; return (
          <div key={id} className="relative"><ItemCard item={it} qty={s.inv[id]} /><div className="mt-1"><Btn className="w-full" primary disabled={locked || s.money < price || (!it.stack && !!s.inv[id])} onClick={() => s.buy(id)}>{locked ? `Rank ${Math.ceil(price / 15000)}+` : money(price)}</Btn></div></div>); })
          : ITEMS.filter((i) => s.inv[i.id] && !(s.weapon === i.id || s.armor === i.id || s.outfit === i.id || s.accs.includes(i.id)) && i.id !== 'knife' && i.id !== 'o_street').map((it) => (
            <div key={it.id}><ItemCard item={it} qty={s.inv[it.id]} /><div className="mt-1 flex gap-1"><Btn className="flex-1" onClick={() => s.sell(it.id)}>{money(it.price * 0.5)}</Btn>{(s.inv[it.id] ?? 0) > 1 && <Btn onClick={() => s.sell(it.id, s.inv[it.id])}>All</Btn>}</div></div>))}
      </div>
    </div>
  );
}

// ───────────── Settings ─────────────
export function Settings() {
  const s = useGame(); const set = s.settings;
  return (
    <div className="max-w-xl scroll overflow-y-auto h-full pr-3">
      <Row label="Graphics quality">{(['low', 'medium', 'high', 'ultra'] as const).map((g) => <Chip key={g} on={set.gfx === g} onClick={() => s.setSettings({ gfx: g })}>{g}</Chip>)}</Row>
      <div className="text-[11px] text-white/40 mb-3">Low: no shadows, fewer particles, reduced resolution. Medium: soft shadows. High/Ultra: bigger shadow maps, dense effects, higher resolution.</div>
      <label className="block text-xs mb-3">Mouse sensitivity: {set.sens.toFixed(2)}<input type="range" min="0.2" max="3" step="0.05" value={set.sens} onChange={(e) => s.setSettings({ sens: +e.target.value })} className="w-full" /></label>
      <label className="block text-xs mb-3">Camera distance: {set.camDist.toFixed(1)}<input type="range" min="3" max="16" step="0.5" value={set.camDist} onChange={(e) => s.setSettings({ camDist: +e.target.value })} className="w-full" /></label>
      <label className="block text-xs mb-3">Master volume: {Math.round(set.volume * 100)}%<input type="range" min="0" max="1" step="0.05" value={set.volume} onChange={(e) => { s.setSettings({ volume: +e.target.value }); setVolume(+e.target.value); }} className="w-full" /></label>
      <div className="flex gap-2 mb-4"><Chip on={set.music} onClick={() => s.setSettings({ music: !set.music })}>Music {set.music ? 'on' : 'off'}</Chip><Chip on={set.invertY} onClick={() => s.setSettings({ invertY: !set.invertY })}>Invert Y</Chip></div>
      <Controls />
    </div>
  );
}

const CONTROL_GROUPS = [
  {
    title: 'Movement & camera',
    controls: [
      ['W A S D', 'Move / steer'],
      ['Mouse', 'Look around'],
      ['Mouse wheel', 'Adjust camera distance'],
      ['Arrow keys', 'Look around'],
      ['Space', 'Jump / ascend while flying'],
      ['Space ×2', 'Toggle flight'],
      ['Shift', 'Run / boost while flying'],
      ['Ctrl / X', 'Descend while flying'],
      ['C', 'Cycle camera view'],
    ],
  },
  {
    title: 'Combat',
    controls: [
      ['F / Left click', 'Attack combo'],
      ['Right click', 'Heavy attack'],
      ['Q', 'Dash'],
      ['B (hold)', 'Block'],
      ['Ctrl + F (flying)', 'Dive attack'],
      ['E / R', 'Use skill 1 / skill 2'],
      ['V', 'Use ultimate'],
      ['T', 'Transform'],
      ['Z', 'Cycle weapon'],
    ],
  },
  {
    title: 'World & menus',
    controls: [
      ['G (hold)', 'Interact / steal / loot'],
      ['I', 'Inventory'],
      ['K', 'Skills'],
      ['M', 'World map'],
      ['J', 'Missions'],
      ['P', 'Character'],
      ['Tab', 'Organization'],
      ['Esc', 'Pause / resume'],
    ],
  },
  {
    title: 'Vehicles',
    controls: [
      ['W / S', 'Accelerate / reverse'],
      ['A / D', 'Steer'],
      ['Space', 'Handbrake'],
      ['Shift', 'Nitro'],
    ],
  },
] as const;

export function Controls() {
  return (
    <div className="space-y-4">
      {CONTROL_GROUPS.map(({ title, controls }) => (
        <section key={title}>
          <h3 className="text-xs uppercase tracking-widest text-white/50 mb-2">{title}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {controls.map(([key, action]) => (
              <div key={key} className="flex items-center justify-between gap-3 rounded border border-white/5 bg-white/[0.03] px-3 py-2 text-xs">
                <b className="shrink-0 text-rose-300">{key}</b>
                <span className="text-right text-white/70">{action}</span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
