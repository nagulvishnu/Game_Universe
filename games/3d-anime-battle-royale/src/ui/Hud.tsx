import { useEffect, useRef, useState } from 'react';
import { current, useStore } from '../game/state/store';
import { ATTACHMENTS, WEAPONS, AMMO_NAMES } from '../game/data/weapons';
import { ARMOR_TIERS, HELMET_TIERS, ITEMS, RARITY_COLOR } from '../game/data/items';
import { CharacterPreview } from '../game/render/CharacterPreview';
import { CHARACTERS } from '../game/data/characters';
import { angDiff, formatTime } from '../game/util';
import { SettingsPanel } from './Screens';
import { MAP_PX } from '../game/world/terrain';

const Bar = ({ v, max, color, h = 'h-3' }: { v: number; max: number; color: string; h?: string }) => (
  <div className={`${h} bg-black/55 border border-white/20 overflow-hidden`}><div className="h-full transition-all duration-150" style={{ width: `${Math.max(0, Math.min(100, (v / max) * 100))}%`, background: color }} /></div>
);

/* ------------------------------ MINIMAP ------------------------------ */
export function Minimap({ size = 210 }: { size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const id = setInterval(() => {
      const g = current.game, cv = ref.current;
      if (!g || !cv || !g.world.mapCanvas) return;
      const ctx = cv.getContext('2d')!;
      const f = g.pose?.subject ?? g.player;
      const k = size / 300; // px per metre (300 m across)
      const w = g.world;
      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = '#16507f'; ctx.fillRect(0, 0, size, size);
      ctx.translate(size / 2, size / 2);
      const rot = f.yaw - Math.PI;
      ctx.rotate(rot);
      ctx.scale(k, k);
      ctx.translate(-f.pos.x, -f.pos.z);
      ctx.drawImage(w.mapCanvas!, -w.half, -w.half, w.size, w.size);
      const z = g.zone;
      if (g.mode === 'match') {
        ctx.lineWidth = 3 / k;
        ctx.strokeStyle = '#3aa0ff'; ctx.beginPath(); ctx.arc(z.cx, z.cz, z.r, 0, 7); ctx.stroke();
        ctx.fillStyle = 'rgba(40,110,255,0.0)';
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2 / k; ctx.beginPath();
        const tr = z.state === 'shrink' ? z.toR : z.nextR; ctx.arc(z.state === 'shrink' ? z.toCx : z.nextCx, z.state === 'shrink' ? z.toCz : z.nextCz, tr, 0, 7); ctx.stroke();
        for (const p of g.pings) { const a = g.time - p.t; if (a < 3.5) { ctx.fillStyle = `rgba(255,70,70,${1 - a / 3.5})`; ctx.beginPath(); ctx.arc(p.x, p.z, (8 + a * 6), 0, 7); ctx.fill(); } }
      }
      for (const d of w.districts) {
        ctx.save(); ctx.translate(d.x, d.z); ctx.rotate(-rot); ctx.scale(1 / k, 1 / k);
        ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.fillStyle = '#fff';
        ctx.strokeText(d.name, 0, 0); ctx.fillText(d.name, 0, 0); ctx.restore();
      }
      const mk = (m: [number, number] | null, col: string) => { if (!m) return; ctx.save(); ctx.translate(m[0], m[1]); ctx.rotate(-rot); ctx.scale(1 / k, 1 / k); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6, 0); ctx.lineTo(0, 9); ctx.lineTo(-6, 0); ctx.fill(); ctx.restore(); };
      mk(g.navMarker, '#fde047'); mk(g.landingMarker, '#22d3ee');
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(size / 2, size / 2 - 9); ctx.lineTo(size / 2 + 6, size / 2 + 7); ctx.lineTo(size / 2, size / 2 + 3); ctx.lineTo(size / 2 - 6, size / 2 + 7); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
      const nAng = rot + Math.PI * 0; // north indicator
      ctx.save(); ctx.translate(size / 2, size / 2); ctx.rotate(nAng + Math.PI); ctx.fillStyle = '#f87171'; ctx.fillText('N', 0, -size / 2 + 14); ctx.restore();
    }, 50);
    return () => clearInterval(id);
  }, [size]);
  return <canvas ref={ref} width={size} height={size} className="rounded-full shadow-[0_0_25px_rgba(56,189,248,0.4)]" />;
}

/* ------------------------------ WORLD MAP ------------------------------ */
export function WorldMap() {
  const ref = useRef<HTMLCanvasElement>(null);
  const setOverlay = useStore((s) => s.setOverlay);
  const S = Math.min(window.innerHeight - 90, window.innerWidth - 360);
  useEffect(() => {
    const draw = () => {
      const g = current.game, cv = ref.current;
      if (!g || !cv || !g.world.mapCanvas) return;
      const ctx = cv.getContext('2d')!, w = g.world, k = S / w.size;
      ctx.clearRect(0, 0, S, S);
      ctx.drawImage(w.mapCanvas!, 0, 0, S, S);
      const X = (x: number) => (x + w.half) * k, Y = (z: number) => (z + w.half) * k;
      const z = g.zone;
      if (g.mode === 'match') {
        ctx.lineWidth = 4; ctx.strokeStyle = '#3aa0ff'; ctx.beginPath(); ctx.arc(X(z.cx), Y(z.cz), z.r * k, 0, 7); ctx.stroke();
        ctx.fillStyle = 'rgba(30,80,200,0.0)';
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); const tr = z.state === 'shrink' ? z.toR : z.nextR; ctx.arc(X(z.state === 'shrink' ? z.toCx : z.nextCx), Y(z.state === 'shrink' ? z.toCz : z.nextCz), tr * k, 0, 7); ctx.stroke();
        if (g.plane.active) { ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.setLineDash([10, 8]); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(X(g.plane.start.x), Y(g.plane.start.z)); ctx.lineTo(X(g.plane.end.x), Y(g.plane.end.z)); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#fff'; ctx.font = '22px sans-serif'; ctx.fillText('✈', X(g.plane.pos.x) - 11, Y(g.plane.pos.z) + 8); }
      }
      for (const d of w.districts) { ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.fillStyle = d.color; ctx.strokeText(d.name, X(d.x), Y(d.z)); ctx.fillText(d.name, X(d.x), Y(d.z)); }
      const mk = (m: [number, number] | null, col: string, lbl: string) => { if (!m) return; ctx.fillStyle = col; ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X(m[0]), Y(m[1]) - 16); ctx.lineTo(X(m[0]) + 10, Y(m[1])); ctx.lineTo(X(m[0]), Y(m[1]) + 16); ctx.lineTo(X(m[0]) - 10, Y(m[1])); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.fillText(lbl, X(m[0]), Y(m[1]) - 22); };
      mk(g.landingMarker, '#22d3ee', 'LANDING'); mk(g.navMarker, '#fde047', 'MARKER');
      const p = g.player;
      ctx.save(); ctx.translate(X(p.pos.x), Y(p.pos.z)); ctx.rotate(Math.PI - p.yaw); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(8, 9); ctx.lineTo(0, 4); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    };
    draw();
    const id = setInterval(draw, 100);
    return () => clearInterval(id);
  }, [S]);
  const click = (e: React.MouseEvent) => {
    const g = current.game; if (!g) return;
    const r = ref.current!.getBoundingClientRect();
    const x = ((e.clientX - r.left) / S) * g.world.size - g.world.half, z = ((e.clientY - r.top) / S) * g.world.size - g.world.half;
    const landing = g.player.state === 'plane';
    const cur = landing ? g.landingMarker : g.navMarker;
    if (cur && Math.hypot(cur[0] - x, cur[1] - z) < 20) { if (landing) g.landingMarker = null; else g.navMarker = null; }
    else g.setMarker(x, z, landing);
  };
  const g = current.game;
  const inPlane = g?.player.state === 'plane';
  return (
    <div className="absolute inset-0 bg-black/75 flex items-center justify-center gap-6 pointer-events-auto anim-pop">
      <canvas ref={ref} width={S} height={S} onClick={click} className="border-2 border-sky-300/60 cursor-crosshair shadow-[0_0_50px_rgba(56,189,248,0.3)]" />
      <div className="w-72 panel p-5 space-y-3">
        <div className="logo text-3xl">VANTARA ISLAND</div>
        <div className="text-xs text-white/70 leading-relaxed">{inPlane ? 'Click the map to choose your LANDING MARKER (cyan). Then press SPACE when you are close to jump. The dashed line is the aircraft route.' : 'Click the map to place a navigation marker (yellow). Click it again to remove.'}</div>
        <div className="space-y-1 text-xs">{g?.world.districts.map((d) => <div key={d.id} className="flex items-center gap-2"><span className="w-3 h-3" style={{ background: d.color }} />{d.name}<span className="ml-auto text-white/40">loot {'★'.repeat(Math.max(1, Math.round(d.loot * 1.5)))}</span></div>)}</div>
        <div className="text-xs text-white/60"><span className="text-sky-300">━</span> Blue circle: current zone · <span className="text-white">━</span> White circle: next zone</div>
        <button className="btn sm w-full" onClick={() => { setOverlay('none'); current.input?.lock(); }}><span>Close (M)</span></button>
      </div>
    </div>
  );
}

/* ------------------------------ INVENTORY ------------------------------ */
export function Inventory() {
  const hud = useStore((s) => s.hud);
  const setOverlay = useStore((s) => s.setOverlay);
  const g = current.game;
  if (!hud || !g) return null;
  const ui = g.ui;
  const slotNames = ['PRIMARY [1]', 'SECONDARY [2]', 'SIDEARM [3]'];
  const slotsKeys: ('sight' | 'mag' | 'muzzle' | 'grip')[] = ['sight', 'mag', 'muzzle', 'grip'];
  const attOwned = Object.entries(hud.atts).filter(([, n]) => n > 0);
  return (
    <div className="absolute inset-0 bg-black/70 flex items-center justify-center pointer-events-auto anim-pop">
      <div className="panel w-[1100px] max-w-[96vw] p-6 grid grid-cols-3 gap-6 text-sm">
        <div className="space-y-3">
          <div className="logo text-2xl">WEAPONS</div>
          {hud.slots.map((s, i) => (
            <div key={i} className={`border p-2 ${hud.cur === i ? 'border-sky-300 bg-sky-500/15' : 'border-white/15'}`}>
              <div className="flex justify-between text-[10px] tracking-widest text-white/55"><span>{slotNames[i]}</span>{s && <span>{s.cat}</span>}</div>
              {s ? (<>
                <div className="flex items-center justify-between"><div className="font-black italic text-lg" style={{ color: RARITY_COLOR[WEAPONS[s.id].rarity] }}>{s.name}</div><div>{s.mag}/{s.magSize} · <span className="text-white/60">{hud.ammo[s.ammo as 'light']}</span></div></div>
                <div className="grid grid-cols-4 gap-1 mt-1">{slotsKeys.map((k) => (
                  <button key={k} disabled={!s.att[k]} onClick={() => ui.detach(i, k)} className="text-[10px] border border-white/20 p-1 truncate disabled:opacity-40 hover:border-rose-400" title="click to remove">{s.att[k] ? ATTACHMENTS[s.att[k]!].name.replace(' Sight', '').replace('Recoil ', '') : k}</button>
                ))}</div>
                <div className="flex gap-2 mt-2"><button className="btn sm" onClick={() => ui.equip(i)}><span>Equip</span></button><button className="btn sm" onClick={() => ui.dropSlot(i)}><span>Drop</span></button></div>
              </>) : <div className="text-white/35 text-xs py-2">Empty</div>}
            </div>
          ))}
          <div className="text-xs tracking-widest text-white/60 pt-1">ATTACHMENTS IN BACKPACK</div>
          {attOwned.length === 0 && <div className="text-white/35 text-xs">None — find sights, mags, suppressors, grips…</div>}
          {attOwned.map(([id, n]) => (
            <div key={id} className="flex items-center gap-2 text-xs"><span className="flex-1" style={{ color: RARITY_COLOR[ATTACHMENTS[id].rarity] }}>{ATTACHMENTS[id].name} ×{n}</span>
              {[0, 1, 2].map((i) => { const s = hud.slots[i]; const ok = !!s && (!ATTACHMENTS[id].cats || ATTACHMENTS[id].cats!.includes(s.cat as 'AR')); return <button key={i} disabled={!ok} onClick={() => ui.attach(i, id)} className="px-2 py-0.5 border border-white/25 disabled:opacity-30 hover:bg-sky-500/30">→{i + 1}</button>; })}
              <button className="px-2 py-0.5 border border-white/25 hover:bg-rose-500/30" onClick={() => ui.dropItem('attach', id)}>✕</button></div>
          ))}
        </div>
        <div className="space-y-3">
          <div className="logo text-2xl">EQUIPMENT</div>
          {[{ k: 'armor', n: 'VEST', lv: hud.armor, hp: hud.armorHp, max: hud.armorMax, name: ARMOR_TIERS[hud.armor].name, c: '#38bdf8' }, { k: 'helmet', n: 'HELMET', lv: hud.helmet, hp: hud.helmetHp, max: hud.helmetMax, name: HELMET_TIERS[hud.helmet].name, c: '#c084fc' }].map((e) => (
            <div key={e.k} className="border border-white/15 p-2"><div className="flex justify-between"><span className="text-[10px] tracking-widest text-white/55">{e.n}</span><span className="font-bold">{e.lv ? e.name : 'None'}</span></div>
              <Bar v={e.hp} max={e.max || 1} color={e.c} /><div className="flex justify-between text-xs mt-1"><span className="text-white/55">Condition {e.max ? Math.round((e.hp / e.max) * 100) : 0}%</span>{e.lv > 0 && <button className="text-rose-300 hover:underline" onClick={() => ui.dropItem(e.k, '')}>drop</button>}</div></div>
          ))}
          <div className="border border-white/15 p-2"><div className="flex justify-between"><span className="text-[10px] tracking-widest text-white/55">BACKPACK</span><span className="font-bold">{hud.packName}</span></div>
            <Bar v={hud.load} max={hud.cap} color="#fbbf24" /><div className="flex justify-between text-xs mt-1"><span className="text-white/55">Capacity {hud.load}/{hud.cap}</span>{hud.pack > 0 && <button className="text-rose-300 hover:underline" onClick={() => ui.dropItem('backpack', '')}>drop</button>}</div></div>
          <div className="border border-white/15 p-2"><div className="text-[10px] tracking-widest text-white/55 mb-1">HEALTH</div><Bar v={hud.hp} max={100} color={hud.hp > 35 ? '#4ade80' : '#f87171'} h="h-4" /><div className="text-xs mt-1 text-white/70">{hud.hp} / 100</div></div>
        </div>
        <div className="space-y-3">
          <div className="logo text-2xl">SUPPLIES</div>
          {(['bandage', 'medkit'] as const).map((id) => (
            <div key={id} className="flex items-center gap-2 border border-white/15 p-2"><div className="flex-1"><div className="font-bold">{ITEMS[id].name}</div><div className="text-xs text-white/55">{id === 'bandage' ? 'Channel 2.2s · +15 HP (max 75)' : 'Channel 4.2s · restores to 100 HP'}</div></div>
              <div className="font-black text-lg">×{hud.heal[id]}</div><button disabled={hud.heal[id] <= 0} className="btn sm" onClick={() => ui.heal(id)}><span>Use</span></button><button disabled={hud.heal[id] <= 0} className="px-2 text-rose-300" onClick={() => ui.dropItem('heal', id)}>✕</button></div>
          ))}
          {(['frag', 'smoke', 'flash'] as const).map((id) => (
            <div key={id} className={`flex items-center gap-2 border p-2 ${hud.selThrow === id ? 'border-amber-300' : 'border-white/15'}`}><div className="flex-1 font-bold">{ITEMS[id].name}</div><div className="font-black text-lg">×{hud.throws[id]}</div><button disabled={hud.throws[id] <= 0} className="btn sm" onClick={() => ui.throwSel(id)}><span>Select</span></button><button disabled={hud.throws[id] <= 0} className="px-2 text-rose-300" onClick={() => ui.dropItem('throw', id)}>✕</button></div>
          ))}
          <div className="text-[10px] tracking-widest text-white/55">AMMUNITION</div>
          <div className="grid grid-cols-2 gap-2">{(['light', 'rifle', 'sniper', 'shell'] as const).map((a) => (
            <div key={a} className="border border-white/15 p-2 flex items-center justify-between"><div><div className="text-xs text-white/60">{AMMO_NAMES[a]}</div><div className="font-black">{hud.ammo[a]}</div></div><button disabled={hud.ammo[a] <= 0} className="text-rose-300 text-xs" onClick={() => ui.dropItem('ammo', a)}>drop 30</button></div>
          ))}</div>
        </div>
        <div className="col-span-3 flex justify-between items-center border-t border-white/15 pt-3"><div className="text-xs text-white/50">TAB to close · Items are used instantly · Walk over/press F to pick up gear</div><button className="btn sm" onClick={() => { setOverlay('none'); current.input?.lock(); }}><span>Close</span></button></div>
      </div>
    </div>
  );
}

/* ------------------------------ COMPASS ------------------------------ */
function Compass({ yaw, px, pz, landing, nav }: { yaw: number; px: number; pz: number; landing: [number, number] | null; nav: [number, number] | null }) {
  const items: { a: number; label: string; col: string }[] = [
    { a: Math.PI, label: 'N', col: '#f87171' }, { a: Math.PI / 2, label: 'E', col: '#fff' }, { a: 0, label: 'S', col: '#fff' }, { a: -Math.PI / 2, label: 'W', col: '#fff' },
  ];
  if (landing) items.push({ a: Math.atan2(landing[0] - px, landing[1] - pz), label: '◆', col: '#22d3ee' });
  if (nav) items.push({ a: Math.atan2(nav[0] - px, nav[1] - pz), label: '◆', col: '#fde047' });
  return (
    <div className="relative w-[380px] h-6 overflow-hidden border-y border-white/25 bg-black/30" style={{ maskImage: 'linear-gradient(90deg,transparent,#000 20%,#000 80%,transparent)' }}>
      {items.map((it, i) => { const rel = angDiff(yaw, it.a); if (Math.abs(rel) > 1.6) return null; return <div key={i} className="absolute top-0 text-xs font-black" style={{ left: 190 - rel * 120, color: it.col, transform: 'translateX(-50%)' }}>{it.label}</div>; })}
      <div className="absolute left-1/2 bottom-0 w-0 h-0 -translate-x-1/2 border-x-4 border-x-transparent border-b-4 border-b-white" />
    </div>
  );
}

/* ------------------------------ HUD ------------------------------ */
export function Hud() {
  const hud = useStore((s) => s.hud);
  if (!hud) return null;
  const w = hud.weapon;
  const g = current.game;
  const zoneTxt = hud.mode === 'training' ? 'TRAINING GROUND' : hud.zone.final ? 'FINAL ZONE' : hud.zone.state === 'wait' ? `ZONE ${hud.zone.phase} · SHRINKS IN ${formatTime(hud.zone.timer)}` : `ZONE ${hud.zone.phase} CLOSING · ${formatTime(hud.zone.timer)}`;
  const hitAge = hud.time - hud.hitT;
  const lastAge = hud.time - hud.lastHit.t;
  return (
    <div className="absolute inset-0 pointer-events-none text-white">
      {hud.hurt > 0.02 && <div className="absolute inset-0" style={{ boxShadow: `inset 0 0 160px rgba(255,0,40,${Math.min(0.75, hud.hurt)})` }} />}
      {hud.zone.outside && hud.mode === 'match' && hud.state !== 'plane' && <div className="absolute inset-0" style={{ boxShadow: 'inset 0 0 200px rgba(40,120,255,0.8)', animation: 'zoneflash 1s infinite' }} />}
      {hud.flash > 0.02 && <div className="absolute inset-0 bg-white" style={{ opacity: Math.min(1, hud.flash) }} />}
      {hud.scoped && <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at center, transparent 0, transparent 30vh, #000 30.5vh)' }}><div className="absolute left-1/2 top-0 bottom-0 w-px bg-black/80" /><div className="absolute top-1/2 left-0 right-0 h-px bg-black/80" /></div>}
      {/* damage direction */}
      {hud.dmgInd.map((d, i) => <div key={i} className="absolute left-1/2 top-1/2" style={{ transform: `translate(-50%,-50%) rotate(${(-d.ang * 180) / Math.PI}deg)`, opacity: Math.max(0, 1 - d.age / 2.2) }}><div className="absolute -top-[190px] left-1/2 -translate-x-1/2 w-24 h-8 rounded-t-full bg-gradient-to-b from-red-500/90 to-transparent" /></div>)}
      {/* top */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
        <div className="flex gap-1 items-stretch">
          <div className="sk bg-black/55 border border-white/25 px-5 py-1"><div className="font-black tracking-wider">👥 {hud.alivecount}<span className="text-white/50 text-xs"> / {hud.total}</span></div></div>
          <div className="sk bg-rose-600/70 border border-white/25 px-5 py-1"><div className="font-black tracking-wider">☠ {hud.kills}</div></div>
          <div className="sk bg-black/55 border border-white/25 px-5 py-1"><div className="font-black tracking-wider">⏱ {formatTime(hud.time)}</div></div>
        </div>
        <Compass yaw={hud.yaw} px={hud.px} pz={hud.pz} landing={hud.landing} nav={hud.nav} />
        {hud.toasts.slice(-3).map((t, i) => <div key={i} className="anim-pop sk bg-black/65 border border-sky-300/40 px-6 py-1 text-sm font-bold tracking-wide text-sky-100">{t}</div>)}
      </div>
      <div className="absolute top-4 right-5 flex flex-col items-center gap-2"><Minimap />
        <div className={`sk px-4 py-1 text-xs font-black tracking-widest border ${hud.zone.state === 'shrink' ? 'bg-red-600/70 border-red-300' : 'bg-blue-600/60 border-sky-300'}`}>{zoneTxt}</div>
        {hud.mode === 'match' && <div className="text-[10px] text-white/70">Zone damage {hud.zone.dmg}/s · [M] map</div>}
      </div>
      {/* kill feed */}
      <div className="absolute top-4 left-4 flex flex-col gap-1 w-80">
        {hud.feed.slice(-6).map((f, i) => (
          <div key={i} className={`anim-slide text-xs px-2 py-1 border-l-4 ${f.me ? 'bg-red-900/70 border-red-400' : f.you ? 'bg-emerald-900/70 border-emerald-400' : 'bg-black/55 border-white/30'}`}>
            {f.killer ? <><b>{f.killer}</b> <span className="text-white/60">▸ {f.weapon}{f.head ? ' ◎' : ''} ▸</span> <b>{f.victim}</b></> : <><b>{f.victim}</b> <span className="text-white/60">was eliminated by {f.weapon === 'zone' ? 'the storm' : f.weapon}</span></>}
          </div>
        ))}
      </div>
      {/* crosshair */}
      {hud.alive && hud.state === 'ground' && !hud.scoped && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className={`relative ${hud.aiming ? 'w-3 h-3' : 'w-8 h-8'} transition-all`}>
            <div className="absolute left-1/2 -top-1 w-0.5 h-2 -translate-x-1/2 bg-white" /><div className="absolute left-1/2 -bottom-1 w-0.5 h-2 -translate-x-1/2 bg-white" />
            <div className="absolute top-1/2 -left-1 h-0.5 w-2 -translate-y-1/2 bg-white" /><div className="absolute top-1/2 -right-1 h-0.5 w-2 -translate-y-1/2 bg-white" />
            <div className="absolute left-1/2 top-1/2 w-1 h-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-300" />
          </div>
          {hitAge < 0.3 && <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl font-black" style={{ color: hud.hitKill ? '#ef4444' : hud.hitHead ? '#fbbf24' : '#fff', opacity: 1 - hitAge / 0.3 }}>✕</div>}
          {lastAge < 1.2 && <div className="absolute left-6 -top-8 font-black text-xl" style={{ color: hud.lastHit.head ? '#fbbf24' : '#fff', opacity: 1 - lastAge / 1.2, textShadow: '0 2px 0 #000' }}>{Math.round(hud.lastHit.amt)}{hud.lastHit.head ? '!' : ''}</div>}
        </div>
      )}
      {/* prompt */}
      <div className="absolute left-1/2 bottom-44 -translate-x-1/2 flex flex-col items-center gap-2">
        {hud.prompt && hud.alive && <div className="anim-pop sk bg-black/70 border-2 px-6 py-2 font-black tracking-wide" style={{ borderColor: hud.prompt.color, color: hud.prompt.color }}>{hud.prompt.text}</div>}
        {hud.reload >= 0 && <div className="w-56"><div className="text-[10px] tracking-widest text-center">RELOADING</div><Bar v={hud.reload * 100} max={100} color="#fbbf24" h="h-2" /></div>}
        {hud.healing && <div className="w-56"><div className="text-[10px] tracking-widest text-center">USING {hud.healing.toUpperCase()}</div><Bar v={(1 - hud.healT / hud.healTotal) * 100} max={100} color="#4ade80" h="h-2" /></div>}
        {hud.state === 'plane' && <div className="text-center"><div className="text-4xl font-black italic logo">JUMP ZONE</div><div className="text-xs text-white/80 tracking-widest mt-1">PRESS M TO SET A LANDING MARKER · SPACE TO JUMP</div></div>}
        {(hud.state === 'freefall' || hud.state === 'chute') && g && <div className="text-xs tracking-widest bg-black/50 px-3 py-1">{hud.state === 'freefall' ? 'W DIVE · A/D STEER · SPACE PARACHUTE' : 'W FORWARD · S BRAKE · A/D STEER'}{hud.landing ? ` · MARKER ${Math.round(Math.hypot(hud.landing[0] - hud.px, hud.landing[1] - hud.pz))} m` : ''}</div>}
      </div>
      {/* vitals */}
      <div className="absolute left-5 bottom-5 w-80 space-y-1.5">
        <div className="flex items-center gap-2"><span className="text-xs w-12 font-black text-emerald-300">HP</span><div className="flex-1"><Bar v={hud.hp} max={100} color={hud.hp > 35 ? 'linear-gradient(90deg,#22c55e,#86efac)' : 'linear-gradient(90deg,#dc2626,#f87171)'} h="h-4" /></div><span className="w-8 text-right font-black">{hud.hp}</span></div>
        <div className="flex items-center gap-2"><span className="text-xs w-12 font-black text-sky-300">ARMOR</span><div className="flex-1"><Bar v={hud.armorHp} max={hud.armorMax || 1} color="#38bdf8" /></div><span className="w-8 text-right text-xs">L{hud.armor}</span></div>
        <div className="flex items-center gap-2"><span className="text-xs w-12 font-black text-violet-300">HELM</span><div className="flex-1"><Bar v={hud.helmetHp} max={hud.helmetMax || 1} color="#c084fc" /></div><span className="w-8 text-right text-xs">L{hud.helmet}</span></div>
        <div className="flex items-center gap-2"><span className="text-xs w-12 font-black text-amber-300">PACK</span><div className="flex-1"><Bar v={hud.load} max={hud.cap} color="#fbbf24" h="h-2" /></div><span className="w-8 text-right text-[10px]">{hud.load}/{hud.cap}</span></div>
        {hud.vehicle && <div className="sk bg-black/60 border border-sky-300/50 px-3 py-1 mt-2"><div className="flex justify-between text-sm font-black"><span>{hud.vehicle.name}</span><span>{hud.vehicle.speed} km/h</span></div><Bar v={hud.vehicle.hp} max={100} color="#f59e0b" h="h-2" /></div>}
      </div>
      {/* weapons */}
      <div className="absolute right-5 bottom-5 w-80 flex flex-col items-end gap-2">
        <div className="flex gap-2">{hud.slots.map((s, i) => (
          <div key={i} className={`sk border px-3 py-1 text-xs ${hud.cur === i ? 'border-amber-300 bg-amber-500/25' : 'border-white/25 bg-black/50'}`}><div className="text-[10px] text-white/50">{i + 1}</div><div className="font-black" style={{ color: s ? RARITY_COLOR[WEAPONS[s.id].rarity] : '#666' }}>{s ? s.name : '—'}</div></div>
        ))}</div>
        <div className="sk bg-black/60 border border-white/25 px-5 py-2 text-right min-w-[17rem]">
          {w ? (<><div className="text-xs tracking-widest text-white/60">{w.cat} · {w.mode.toUpperCase()}</div>
            <div className="font-black italic text-lg">{w.name}</div>
            <div className="text-4xl font-black leading-none"><span className={w.mag === 0 ? 'text-red-400' : ''}>{w.mag}</span><span className="text-xl text-white/55"> / {w.reserve}</span></div></>) : <div className="font-black text-white/60">UNARMED — find a weapon!</div>}
        </div>
        <div className="flex gap-2 text-xs">
          <div className="sk bg-black/55 border border-white/20 px-3 py-1">[4] 🩹 {hud.heal.bandage} · ✚ {hud.heal.medkit}</div>
          <div className="sk bg-black/55 border border-white/20 px-3 py-1">[G] {hud.selThrow === 'frag' ? '💣' : hud.selThrow === 'smoke' ? '☁' : '⚡'} {hud.throws[hud.selThrow]} <span className="text-white/40">[X]</span></div>
          <div className="sk bg-black/55 border border-white/20 px-3 py-1">{hud.stance === 'stand' ? 'STAND' : hud.stance.toUpperCase()}</div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ END SCREENS ------------------------------ */
export function EndScreens() {
  const hud = useStore((s) => s.hud);
  const { startGame, leaveGame, profile } = useStore();
  const [spectate, setSpectate] = useState(false);
  if (!hud || hud.mode !== 'match') return null;
  const r = hud.result;
  const ch = CHARACTERS.find((c) => c.id === profile.charId)!;
  const Stats = ({ r }: { r: NonNullable<typeof hud.result> }) => (
    <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
      {[['PLACEMENT', `#${r.placement} / ${r.total}`], ['ELIMINATIONS', r.kills], ['SURVIVAL TIME', formatTime(r.survival)], ['DAMAGE DEALT', r.damage], ['HEADSHOTS', r.headshots], ['DISTANCE', `${Math.round(r.distance)} m`]].map(([k, v]) => (
        <div key={String(k)} className="flex justify-between border-b border-white/15 pb-1"><span className="text-white/60 tracking-widest text-xs">{k}</span><span className="font-black">{v}</span></div>
      ))}
    </div>
  );
  const again = () => { leaveGame(); setTimeout(() => startGame(profile.mode), 50); };
  if (hud.ended && r?.won) {
    return (
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-amber-400/40 to-transparent" />
        <div className="absolute left-[5vw] top-[8vh] anim-pop"><div className="logo text-8xl">CHAMPION</div><div className="text-2xl font-black tracking-[0.5em] text-amber-200">LAST SURVIVOR</div><div className="mt-2 text-sky-200 font-bold">{ch.name} — {ch.title}</div></div>
        <div className="absolute left-[5vw] top-[40vh] w-[26rem] panel p-5 pointer-events-auto anim-slide"><Stats r={r} />
          <div className="flex gap-3 mt-5"><button className="btn hot sm" onClick={again}><span>Start Another Match</span></button><button className="btn sm" onClick={leaveGame}><span>Main Menu</span></button></div></div>
      </div>
    );
  }
  if (!hud.alive && r && !spectate) {
    return (
      <div className="absolute inset-0 bg-black/60 flex items-center justify-center pointer-events-auto">
        <div className="panel p-8 w-[34rem] anim-pop">
          <div className="text-6xl font-black italic text-red-400" style={{ textShadow: '0 4px 0 #000' }}>ELIMINATED</div>
          <div className="text-sm text-white/70 mt-1">Eliminated by <b className="text-white">{r.killedBy || 'Unknown'}</b></div>
          <div className="my-4 text-center"><div className="text-xs tracking-[0.4em] text-white/60">MATCH PLACEMENT</div><div className="text-7xl font-black italic logo">#{r.placement}</div></div>
          <Stats r={r} />
          <div className="flex flex-wrap gap-3 mt-6"><button className="btn sm" onClick={() => { setSpectate(true); current.input?.lock(); }}><span>Spectate</span></button><button className="btn hot sm" onClick={again}><span>Play Again</span></button><button className="btn sm" onClick={leaveGame}><span>Main Menu</span></button></div>
        </div>
      </div>
    );
  }
  if (!hud.alive && spectate) {
    return (
      <div className="absolute inset-x-0 bottom-6 flex justify-center pointer-events-none">
        <div className="panel px-6 py-3 flex items-center gap-4 pointer-events-auto">
          <div className="text-xs tracking-widest text-white/60">{hud.ended ? `MATCH OVER — WINNER: ${hud.winner}` : 'SPECTATING'}</div><div className="font-black">{hud.spectating}</div>
          <div className="text-xs text-white/50">SPACE / click: next target</div>
          <button className="btn sm" onClick={() => setSpectate(false)}><span>Results</span></button><button className="btn sm" onClick={leaveGame}><span>Main Menu</span></button>
        </div>
      </div>
    );
  }
  if (hud.ended && !r?.won && hud.alive === false && r) return null;
  return null;
}

export function PauseMenu() {
  const { setOverlay, leaveGame } = useStore();
  const [settings, setSettings] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const mode = useStore((s) => s.hud?.mode);
  return (
    <div className="absolute inset-0 bg-black/70 flex items-center justify-center pointer-events-auto">
      <div className="panel p-8 w-[34rem] anim-pop">
        <div className="logo text-5xl mb-6">PAUSED</div>
        {settings ? (<><SettingsPanel compact /><button className="btn sm mt-5" onClick={() => setSettings(false)}><span>Back</span></button></>) : confirm ? (
          <div><div className="mb-4">{mode === 'training' ? 'Leave the training ground?' : 'Leave this match? Your result will be recorded.'}</div><div className="flex gap-3"><button className="btn hot sm" onClick={leaveGame}><span>Leave</span></button><button className="btn sm" onClick={() => setConfirm(false)}><span>Stay</span></button></div></div>
        ) : (
          <div className="flex flex-col gap-4">
            <button className="btn hot" onClick={() => { setOverlay('none'); current.input?.lock(); }}><span>Resume</span></button>
            <button className="btn" onClick={() => setSettings(true)}><span>Settings</span></button>
            <button className="btn" onClick={() => setConfirm(true)}><span>{mode === 'training' ? 'Leave Training' : 'Leave Match'}</span></button>
          </div>
        )}
      </div>
    </div>
  );
}

export { CharacterPreview, MAP_PX };
