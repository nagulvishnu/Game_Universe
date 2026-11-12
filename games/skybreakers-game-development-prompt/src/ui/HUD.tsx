import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { BOSSES, ITEMS, NPCS, QUESTS, SHIPS, SHIP_WEAPONS, SPELLS, WEAPONS, xpForLevel } from '../game/data';
import { G, input } from '../game/runtime';
import { maxHp, maxMp, maxSp, shipStats, useStore } from '../game/store';
import { BRIDGES, ISLANDS, ISLAND_MAP, PALETTE, WORLD, placeOn, radiusAt } from '../game/world';
import { place } from '../game/kingdom';
import { useTick } from './hooks';

const npcPos = Object.fromEntries(NPCS.map(n => [n.id, placeOn(n.island, n.lx, n.lz)]));
function questTarget(): { x: number; z: number } | null {
  const s = useStore.getState(); const id = s.tracked; if (!id) return null; const q = QUESTS.find(x => x.id === id); const qs = s.quests[id]; if (!q || !qs) return null;
  if (qs.state === 'ready') { const p = npcPos[q.giver]; return p ? { x: p[0], z: p[2] } : null; }
  const i = q.objs.findIndex((o, k) => qs.prog[k] < o.n); if (i < 0) return null; const key = q.objs[i].key; const [t, v] = key.split(':');
  if (t === 'reach') { const isl = ISLAND_MAP[v]; if (isl) return { x: isl.x, z: isl.z }; const poi = WORLD.pois.find(p => p.id === v); return poi ? { x: poi.x, z: poi.z } : null; }
  if (t === 'boss') { const b = WORLD.bossSpawns[v]; return b ? { x: b[0], z: b[2] } : null; }
  if (t === 'build' || key === 'count:worker' || key === 'count:defend') return { x: ISLAND_MAP.haven.x, z: ISLAND_MAP.haven.z };
  if (key === 'count:temple') return { x: ISLAND_MAP.whisper.x, z: ISLAND_MAP.whisper.z };
  if (key === 'count:repair' || key === 'count:upgrade') return { x: 60, z: 12 };
  if (key === 'have:frost_sigil') { const n = WORLD.nodes.find(n => n.type === 'sigil'); return n ? { x: n.x, z: n.z } : null; }
  if (v === 'yeti') return { x: ISLAND_MAP.frost.x, z: ISLAND_MAP.frost.z }; if (v === 'fire') return { x: ISLAND_MAP.ember.x, z: ISLAND_MAP.ember.z }; if (v === 'shadow') return { x: ISLAND_MAP.shadow.x, z: ISLAND_MAP.shadow.z }; if (v === 'wolf' || v === 'goblin' || v === 'harpy') return { x: 0, z: 20 };
  return null;
}

function Minimap() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!; const c = cv.getContext('2d')!; const S = cv.width; const R = S / 2;
    const draw = () => {
      const p = G.player; const o = p.inShip ? G.ship.pos : p.pos; const yaw = G.cam.yaw; const sc = p.inShip ? 0.2 : 0.75; const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
      const tr = (x: number, z: number) => { const dx = x - o.x, dz = z - o.z; return [R + (dx * rx + dz * rz) * sc, R - (dx * fx + dz * fz) * sc]; };
      c.clearRect(0, 0, S, S); c.save(); c.beginPath(); c.arc(R, R, R - 2, 0, 6.283); c.clip();
      const g = c.createRadialGradient(R, R, 0, R, R, R); g.addColorStop(0, '#16307a'); g.addColorStop(1, '#070c24'); c.fillStyle = g; c.fillRect(0, 0, S, S);
      for (const isl of ISLANDS) { const [cx, cy] = tr(isl.x, isl.z); if (Math.hypot(cx - R, cy - R) > R + isl.r * sc * 1.3) continue; c.beginPath(); for (let k = 0; k <= 28; k++) { const a = (k / 28) * 6.283; const rr = radiusAt(isl, a); const [x, y] = tr(isl.x + Math.cos(a) * rr, isl.z + Math.sin(a) * rr); k ? c.lineTo(x, y) : c.moveTo(x, y); } c.closePath(); c.fillStyle = PALETTE[isl.biome].top[0]; c.globalAlpha = 0.85; c.fill(); c.globalAlpha = 1; c.strokeStyle = 'rgba(255,230,160,.6)'; c.lineWidth = 1.5; c.stroke(); if (isl.minLevel > useStore.getState().level) { c.fillStyle = 'rgba(60,20,120,.55)'; c.fill(); } }
      c.strokeStyle = '#c8a46a'; c.lineWidth = 2; for (const b of BRIDGES) { const [x1, y1] = tr(b.a[0], b.a[2]), [x2, y2] = tr(b.b[0], b.b[2]); c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }
      const dot = (x: number, z: number, col: string, r: number) => { const [px, py] = tr(x, z); if (Math.hypot(px - R, py - R) > R) return; c.fillStyle = col; c.beginPath(); c.arc(px, py, r, 0, 6.283); c.fill(); };
      for (const n of NPCS) { const q = npcPos[n.id]; dot(q[0], q[2], '#ffd95a', 2.5); }
      for (const h of G.hostiles) if (!h.dead && h.active) dot(h.pos.x, h.pos.z, h.kind === 'boss' ? '#d060ff' : h.kind === 'ship' ? '#ff9a3a' : h.def.dmg > 0 ? '#ff4a4a' : '#9affb0', h.kind === 'boss' ? 5 : 2.5);
      const ev = G.event.marker; if (ev) { const [px, py] = tr(ev.x, ev.z); const a = Math.atan2(py - R, px - R); const d = Math.min(Math.hypot(px - R, py - R), R - 8); c.save(); c.translate(R + Math.cos(a) * d, R + Math.sin(a) * d); c.rotate(Math.PI / 4); c.fillStyle = '#5ae6ff'; c.fillRect(-4, -4, 8, 8); c.restore(); }
      const qt = questTarget(); if (qt) { const [px, py] = tr(qt.x, qt.z); const a = Math.atan2(py - R, px - R); const d = Math.min(Math.hypot(px - R, py - R), R - 9); c.save(); c.translate(R + Math.cos(a) * d, R + Math.sin(a) * d); c.rotate(Math.PI / 4); c.fillStyle = '#ffd23a'; c.strokeStyle = '#000'; c.lineWidth = 1; c.fillRect(-5, -5, 10, 10); c.strokeRect(-5, -5, 10, 10); c.restore(); }
      if (!p.inShip) { const [sx, sy] = tr(G.ship.pos.x, G.ship.pos.z); if (Math.hypot(sx - R, sy - R) < R) { c.fillStyle = '#5ae6ff'; c.beginPath(); c.moveTo(sx, sy - 5); c.lineTo(sx + 4, sy + 4); c.lineTo(sx - 4, sy + 4); c.fill(); } }
      c.save(); c.translate(R, R); const ang = p.inShip ? G.ship.yaw : p.yaw; c.rotate(Math.PI - ang + yaw); c.beginPath(); c.moveTo(0, -8); c.lineTo(6, 7); c.lineTo(0, 4); c.lineTo(-6, 7); c.closePath(); c.fillStyle = '#fff'; c.fill(); c.strokeStyle = '#000'; c.lineWidth = 1.5; c.stroke(); c.restore();
      c.restore(); c.strokeStyle = 'rgba(232,196,106,.9)'; c.lineWidth = 3; c.beginPath(); c.arc(R, R, R - 2, 0, 6.283); c.stroke();
      c.fillStyle = '#ffd95a'; c.font = 'bold 12px Cinzel, serif'; c.textAlign = 'center';
      const nxp = R + (-1 * rz) * (R - 14), nyp = R - (-1 * fz) * (R - 14); c.fillText('N', nxp, nyp + 4);
    };
    const i = setInterval(draw, 90); draw(); return () => clearInterval(i);
  }, []);
  return <canvas ref={ref} width={168} height={168} className="w-[110px] h-[110px] sm:w-[150px] sm:h-[150px] lg:w-[168px] lg:h-[168px] drop-shadow-[0_0_14px_rgba(0,0,0,.7)]" />;
}

const Bar = ({ v, max, col, h = 12, label }: { v: number; max: number; col: string; h?: number; label?: string }) => (
  <div className="bar" style={{ height: h }}><i style={{ width: `${Math.max(0, Math.min(100, (v / max) * 100))}%`, background: col }} /><b />{label && <span className="absolute inset-0 text-[9px] leading-none flex items-center justify-center font-bold text-white/90" style={{ textShadow: '0 1px 2px #000' }}>{label}</span>}</div>
);

export function HUD() {
  useTick(80); const s = useStore(); const p = G.player; const sh = G.ship; const inShip = p.inShip; const stat = shipStats(s); const inst = s.ships[s.activeShip];
  const now = performance.now(); const toasts = s.toasts.filter(t => now - t.t < 5200).slice(-5); const banner = s.banner && now - s.banner.t < 3800 ? s.banner : null;
  const tq = s.tracked ? QUESTS.find(q => q.id === s.tracked) : null; const tqs = tq ? s.quests[tq.id] : null; const boss = G.boss; const bd = boss ? BOSSES[boss.type] : null; const w = WEAPONS[s.weapon];
  const interact = G.interact; const label = interact?.label(); const lock = p.lock; const night = G.dayT > 0.78 || G.dayT < 0.2; const hour = Math.floor(((G.dayT * 24 + 6) % 24)); const mins = Math.floor((((G.dayT * 24 + 6) % 1) * 60));
  // lock-on projection
  let lockPos: { x: number; y: number } | null = null; if (lock && !lock.dead && G.camera) { const v = new THREE.Vector3(lock.pos.x, lock.pos.y + lock.cy + lock.r * 0.6, lock.pos.z).project(G.camera); if (v.z < 1) lockPos = { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight }; }
  const mobile = input.touch;
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ fontFamily: 'Quicksand, sans-serif' }}>
      {/* vignette on low hp */}
      {p.hp / maxHp(s) < 0.3 && !inShip && <div className="absolute inset-0" style={{ boxShadow: 'inset 0 0 140px rgba(255,0,40,.45)', animation: 'pulseGlow 1.2s infinite' }} />}
      {p.hurtT > 0.2 && <div className="absolute inset-0" style={{ boxShadow: 'inset 0 0 120px rgba(255,30,30,.5)' }} />}
      {/* player status */}
      <div className="absolute top-2 left-2 sm:top-4 sm:left-4 w-[200px] sm:w-[280px]">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-title font-black text-lg" style={{ background: 'radial-gradient(circle at 30% 30%, #ffe9a0, #a9822c)', color: '#1a1030', boxShadow: '0 0 16px rgba(232,196,106,.6)' }}>{s.level}</div>
          <div className="flex-1 min-w-0"><div className="font-title text-xs text-[#ffe9a0] truncate drop-shadow">SKY EXPLORER · {s.inv.gold || 0} 🪙</div><Bar v={s.xp} max={xpForLevel(s.level + 1)} col="linear-gradient(90deg,#c9962c,#ffe27a)" h={6} /></div>
        </div>
        <div className="space-y-1"><Bar v={p.hp} max={maxHp(s)} col="linear-gradient(90deg,#c22a3a,#ff6a7a)" h={16} label={`${Math.ceil(p.hp)} / ${maxHp(s)}`} />
          <Bar v={p.sp} max={maxSp(s)} col={p.exhaust > 0 ? 'linear-gradient(90deg,#777,#aaa)' : 'linear-gradient(90deg,#2aa84a,#9aff7a)'} h={10} />
          <Bar v={p.mp} max={maxMp(s)} col="linear-gradient(90deg,#2a5ae0,#6ad8ff)" h={10} />
          {p.shield > 0 && <Bar v={p.shield} max={100} col="linear-gradient(90deg,#8a6a3a,#e8c888)" h={7} />}</div>
        {p.powerT > 0 && <div className="text-[10px] text-yellow-300 mt-1">⚡ Power {Math.ceil(p.powerT)}s</div>}
      </div>
      {/* minimap */}
      <div className="absolute top-2 right-2 sm:top-4 sm:right-4 flex flex-col items-end gap-1">
        <Minimap />
        <div className="glass px-3 py-1 text-[11px] font-title text-[#ffe9a0]">{ISLAND_MAP[G.currentIsland]?.name || 'Open Sky'} · {String(hour).padStart(2, '0')}:{String(mins).padStart(2, '0')} {night ? '🌙' : '☀️'} {G.weather.type !== 'clear' && <span>· {G.weather.type}</span>}</div>
        {G.event.active && <div className="glass px-3 py-1 text-[11px] text-cyan-200 animate-pulse max-w-[200px] text-right">⚑ {G.event.active.text}</div>}
        {G.event.raid && <div className="glass px-3 py-1 text-[11px] text-red-300 max-w-[220px] text-right">🏰 Castle {Math.ceil(s.kingdom.castleHp)}/400 · Raiders {Math.max(0, G.event.raid.alive)}/{G.event.raid.total}</div>}
      </div>
      {/* quest tracker */}
      {tq && tqs && <div className="absolute left-2 sm:left-4 top-[110px] sm:top-[140px] w-[190px] sm:w-[260px] glass p-2 sm:p-3">
        <div className="font-title text-[11px] sm:text-xs text-[#ffd23a] tracking-wider">{tq.cat.toUpperCase()}</div><div className="font-semibold text-sm mb-1">{tq.title}</div>
        {tqs.state === 'ready' ? <div className="text-[12px] text-green-300">✔ Return to {NPCS.find(n => n.id === tq.giver)?.name}</div> : tq.objs.map((o, i) => <div key={i} className={`text-[11px] sm:text-[12px] ${tqs.prog[i] >= o.n ? 'text-green-300 line-through opacity-70' : 'text-slate-100'}`}>◆ {o.label} {o.n > 1 && `(${tqs.prog[i]}/${o.n})`}</div>)}
      </div>}
      {/* toasts */}
      <div className="absolute left-2 sm:left-4 bottom-[170px] sm:bottom-24 space-y-1 w-[260px] sm:w-[380px]">
        {toasts.map(t => <div key={t.id} className={`glass px-3 py-1.5 text-[12px] sm:text-[13px] ${t.kind === 'bad' ? 'text-red-300' : t.kind === 'good' ? 'text-green-300' : t.kind === 'quest' ? 'text-[#ffd23a]' : t.kind === 'loot' ? 'text-cyan-200' : 'text-slate-100'}`} style={{ animation: 'toastIn .25s' }}>{t.msg}</div>)}
      </div>
      {/* banner */}
      {banner && <div key={banner.t} className="absolute top-[22%] left-0 right-0 text-center" style={{ animation: 'bannerIn 3.8s both' }}><div className="font-title font-black text-3xl sm:text-6xl shimmer">{banner.text}</div><div className="font-title text-xs sm:text-lg text-cyan-100 mt-2 tracking-[.25em]">{banner.sub}</div></div>}
      {/* boss bar */}
      {boss && bd && G.bossFight && <div className="absolute top-3 left-1/2 -translate-x-1/2 w-[86vw] sm:w-[620px]"><div className="font-title text-center text-sm sm:text-xl text-[#ffe9a0] tracking-[.25em] drop-shadow">{bd.name} <span className="text-[10px] sm:text-xs text-violet-300">— {bd.title}</span></div><div className="relative"><Bar v={boss.hp} max={boss.maxHp} col="linear-gradient(90deg,#8a1a4a,#ff3a5a 60%,#ff9a6a)" h={18} />{[0.33, 0.66].map(m => <div key={m} className="absolute top-0 bottom-0 w-[2px] bg-black/70" style={{ left: `${m * 100}%` }} />)}</div>{boss.vuln > 1 && <div className="text-center text-yellow-300 text-xs font-bold animate-pulse">⚡ VULNERABLE ⚡</div>}</div>}
      {/* combo */}
      {G.comboCount > 2 && <div className="absolute right-4 top-[48%] text-right"><div className="font-title text-3xl text-[#ffd23a] drop-shadow" style={{ textShadow: '0 0 12px #ff8a1a' }}>{G.comboCount}</div><div className="text-[10px] tracking-widest text-orange-200">HITS</div></div>}
      {/* crosshair + prompt */}
      {!mobile && !G.cam.cine && <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white/70 shadow-[0_0_6px_#fff]" />}
      {label && !G.cam.cine && <div className="absolute left-1/2 bottom-[28%] -translate-x-1/2 glass px-4 py-2 text-center" style={{ animation: 'pulseGlow 2s infinite' }}><span className="inline-block bg-[#ffe9a0] text-[#1a1030] font-black rounded px-2 mr-2 text-sm">E</span><span className="text-sm sm:text-base">{label}</span></div>}
      {lockPos && <div className="absolute w-12 h-12 -ml-6 -mt-6 border-2 border-red-400 rotate-45 rounded-sm" style={{ left: lockPos.x, top: lockPos.y, boxShadow: '0 0 12px #f44', animation: 'pulseGlow 1s infinite' }}><div className="absolute -bottom-6 left-1/2 -rotate-45 -translate-x-1/2 text-[10px] whitespace-nowrap text-red-200 font-bold">{lock!.name}</div></div>}
      {lock && !lock.dead && lock.kind !== 'boss' && <div className="absolute top-14 left-1/2 -translate-x-1/2 w-[200px]"><div className="text-center text-xs text-red-200 font-bold">{lock.name}</div><Bar v={lock.hp} max={lock.maxHp} col="linear-gradient(90deg,#a02030,#ff5a5a)" h={8} /></div>}
      {/* placing */}
      {s.placing && <div className="absolute top-20 left-1/2 -translate-x-1/2 glass px-4 py-2 text-center"><div className="font-title text-sm text-[#ffe9a0]">PLACING: {s.placing.toUpperCase()}</div><div className={`text-xs ${place.valid ? 'text-green-300' : 'text-red-300'}`}>{place.valid ? 'Valid — press E / Click / ✔ to build · R rotate · Esc cancel' : place.reason}</div></div>}
      {/* bottom */}
      {!inShip ? (
        <div className="absolute bottom-2 sm:bottom-4 left-1/2 -translate-x-1/2 flex items-end gap-2 sm:gap-3">
          <div className="glass p-1.5 sm:p-2 flex items-center gap-1.5"><div className="text-2xl sm:text-3xl">{w.icon}</div><div className="hidden sm:block"><div className="font-title text-[11px] text-[#ffe9a0]">{w.name}</div><div className="text-[10px] text-slate-300">Q: switch · LMB attack</div></div></div>
          <div className="flex gap-1 sm:gap-1.5">{SPELLS.map((sp, i) => { const cd = p.cd[sp.id] || 0; const locked = s.level < sp.reqLevel; return (
            <div key={sp.id} className="relative w-9 h-9 sm:w-12 sm:h-12 glass flex items-center justify-center text-lg sm:text-2xl overflow-hidden" style={{ borderColor: locked ? '#444' : p.mp >= sp.cost ? sp.color : '#555', opacity: locked ? 0.4 : 1 }}>
              <span>{sp.icon}</span><span className="absolute top-0 left-1 text-[9px] sm:text-[10px] font-bold text-white/80">{i + 1}</span>{cd > 0 && <div className="absolute inset-x-0 bottom-0 bg-black/70" style={{ height: `${(cd / sp.cd) * 100}%` }} />}{cd > 0 && <span className="absolute text-[11px] font-bold">{cd.toFixed(1)}</span>}{locked && <span className="absolute bottom-0 right-0.5 text-[8px] text-red-300">L{sp.reqLevel}</span>}</div>); })}</div>
          <div className="glass p-1.5 sm:p-2 flex gap-2 text-[11px] sm:text-xs">{(['hp_potion', 'mp_potion', 'food'] as const).map((k, i) => <div key={k} className="text-center"><div className="text-lg sm:text-xl">{ITEMS[k].icon}</div><div className="font-bold">{s.inv[k] || 0}</div><div className="text-[9px] text-slate-400">{['H', 'B', 'G'][i]}</div></div>)}</div>
        </div>
      ) : (
        <div className="absolute bottom-2 sm:bottom-4 left-1/2 -translate-x-1/2 w-[94vw] sm:w-[640px] glass p-2 sm:p-3">
          <div className="grid grid-cols-4 gap-2 sm:gap-3 text-center mb-2">
            <div><div className="font-title text-[9px] text-slate-300">SPEED</div><div className="text-lg sm:text-2xl font-black text-cyan-200">{Math.abs(Math.round(sh.speed * 1.8))}<span className="text-[10px]"> kn</span></div></div>
            <div><div className="font-title text-[9px] text-slate-300">ALTITUDE</div><div className="text-lg sm:text-2xl font-black text-[#ffe9a0]">{Math.max(0, Math.round(sh.alt > 900 ? sh.pos.y : sh.alt))}<span className="text-[10px]"> m</span></div></div>
            <div><div className="font-title text-[9px] text-slate-300">ENGINE</div><div className={`text-sm sm:text-lg font-black ${inst.fuel <= 0 ? 'text-red-400' : sh.boosting ? 'text-orange-300' : sh.landed ? 'text-slate-300' : 'text-green-300'}`}>{inst.fuel <= 0 ? 'OFFLINE' : sh.boosting ? 'BOOST' : sh.landed ? 'LANDED' : 'ONLINE'}</div></div>
            <div><div className="font-title text-[9px] text-slate-300">{SHIPS[s.activeShip].name.toUpperCase()}</div><div className="text-sm sm:text-lg font-black text-violet-200">{Math.round(inst.hull)}/{Math.round(stat.maxHull)}</div></div>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2"><div><div className="text-[9px] text-slate-300 mb-0.5">HULL</div><Bar v={inst.hull} max={stat.maxHull} col="linear-gradient(90deg,#c22a3a,#ff9a6a)" h={12} /></div><div><div className="text-[9px] text-slate-300 mb-0.5">FUEL (R to refuel)</div><Bar v={inst.fuel} max={stat.maxFuel} col={inst.fuel < 20 ? 'linear-gradient(90deg,#c22a3a,#ff6a3a)' : 'linear-gradient(90deg,#2aa8e0,#8affea)'} h={12} /></div></div>
          <div className="flex gap-1.5 justify-center flex-wrap">{SHIPS[s.activeShip].weapons.map((wid, i) => { const wp = SHIP_WEAPONS[wid]; const cd = sh.cds[wid] || 0; const sel = sh.weapon === wid; return <div key={wid} className={`relative px-2 py-1 rounded border text-center overflow-hidden ${sel ? 'border-[#ffe9a0] bg-[#ffe9a0]/15' : 'border-white/20'}`}><div className="text-lg leading-none">{wp.icon}</div><div className="text-[9px] font-bold">{i + 1}·{wp.name}{wid === 'missile' ? ` ×${Math.floor(sh.missiles)}` : ''}</div>{cd > 0 && wp.cd > 0.3 && <div className="absolute inset-x-0 bottom-0 bg-black/60" style={{ height: `${Math.min(1, cd / wp.cd) * 100}%` }} />}</div>; })}</div>
        </div>
      )}
      {!input.locked && !mobile && !G.paused && s.screen === 'play' && <div className="absolute bottom-[110px] left-1/2 -translate-x-1/2 text-xs text-white/70 animate-pulse">Click to capture mouse</div>}
      {s.settings.quality === 'low' && null}
    </div>
  );
}
