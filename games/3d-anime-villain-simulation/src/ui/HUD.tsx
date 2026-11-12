import { useEffect, useRef } from 'react';
import { FORMS, HEROES, MISSIONS, SKILL_MAP, STAGES, THREAT_NAMES, xpFor, REGIONS } from '../game/data';
import { missionAvail, progressOf, rankOf, useGame, useHud } from '../game/store';
import { G } from '../game/runtime';
import { Bar } from './common';
import { ITEM_MAP } from '../game/data';

function Radar() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const g = ref.current!.getContext('2d')!; const S = 150; const iv = setInterval(() => {
      g.clearRect(0, 0, S, S); g.save(); g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 2, 0, 7); g.clip(); g.fillStyle = 'rgba(8,8,18,0.8)'; g.fillRect(0, 0, S, S);
      g.strokeStyle = 'rgba(168,85,247,0.25)'; g.lineWidth = 1; for (const r of [25, 50, 74]) { g.beginPath(); g.arc(S / 2, S / 2, r, 0, 7); g.stroke(); } g.beginPath(); g.moveTo(S / 2, 0); g.lineTo(S / 2, S); g.moveTo(0, S / 2); g.lineTo(S, S / 2); g.stroke();
      const p = G.p; const yaw = p.camYaw; const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw); const sc = 0.55;
      const dot = (x: number, z: number, c: string, r = 3) => { const dx = x - p.pos.x, dz = z - p.pos.z; let X = (dx * rx + dz * rz) * sc, Y = -(dx * fx + dz * fz) * sc; const l = Math.hypot(X, Y); if (l > S / 2 - 6) { X *= (S / 2 - 6) / l; Y *= (S / 2 - 6) / l; } g.fillStyle = c; g.beginPath(); g.arc(S / 2 + X, S / 2 + Y, r, 0, 7); g.fill(); };
      for (const a of G.actors) { if (!a.alive || Math.abs(a.pos.x - p.pos.x) > 160) continue; dot(a.pos.x, a.pos.z, a.team === 'hero' ? '#4aa3ff' : a.team === 'enemy' ? '#ff4455' : a.team === 'ally' ? '#34d399' : '#6b7280', a.boss ? 5 : a.team === 'civ' ? 1.8 : 3); }
      for (const v of G.vehicles) if (v.ai !== 'wreck' && Math.abs(v.pos.x - p.pos.x) < 160 && v.group) dot(v.pos.x, v.pos.z, '#fbbf24', 2);
      for (const r of REGIONS) { const c = { x: -600 + r.gx * 400 + 200, z: -600 + r.gy * 400 + 200 }; dot(c.x, c.z, '#ff2e57', 4); }
      if (G.waypoint) dot(G.waypoint.x, G.waypoint.z, '#34d399', 4);
      g.restore(); g.strokeStyle = '#a855f7'; g.lineWidth = 2; g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 2, 0, 7); g.stroke(); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(S / 2, S / 2 - 6); g.lineTo(S / 2 + 4, S / 2 + 4); g.lineTo(S / 2 - 4, S / 2 + 4); g.fill();
    }, 100); return () => clearInterval(iv);
  }, []);
  return <canvas ref={ref} width={150} height={150} className="hud-radar w-[150px] h-[150px] rounded-full" style={{ boxShadow: '0 0 20px rgba(124,58,237,0.5)' }} />;
}

export function HUD() {
  const h = useHud(); const s = useGame(); const overlay = s.overlay; const rank = rankOf(s);
  const tracked = [...s.contracts, ...MISSIONS].find((m) => m.id === s.tracked && missionAvail(s, m)); const base = tracked?.id.startsWith('c_') ? s.counters['base_' + tracked.id] ?? 0 : 0;
  const tp = tracked ? Math.max(0, Math.min(tracked.need, progressOf(s, tracked) - base)) : 0;
  const hr = Math.floor(h.time), mn = Math.floor((h.time % 1) * 60); const f = FORMS[h.form]; const w = ITEM_MAP[s.weapon];
  const locked = typeof document !== 'undefined' && !!document.pointerLockElement;
  const dir = G.waypoint ? Math.round(h.wpDist) : -1;
  return (
    <div className="absolute inset-0 z-10 pointer-events-none hud-font select-none">
      <div className="absolute inset-0 vignette" />
      {h.boost && <div className="absolute inset-0 speedlines opacity-60" />}
      {h.hp / h.maxHp < 0.3 && h.dead === 0 && <div className="absolute inset-0" style={{ boxShadow: 'inset 0 0 120px rgba(255,0,40,0.55)', animation: 'flicker 1s infinite' }} />}
      {h.cine > 0 && <><div className="absolute top-0 left-0 right-0 h-[12vh] bg-black" /><div className="absolute bottom-0 left-0 right-0 h-[12vh] bg-black" /><div className="absolute inset-0" style={{ background: f ? '#fff' : '#fff', opacity: Math.max(0, (h.cine - 0.72) * 3.5) }} />{h.cine < 0.7 && <div className="absolute bottom-[16vh] w-full text-center title-font text-4xl tracking-[0.3em]" style={{ color: FORMS[s.formSel].aura, textShadow: `0 0 20px ${FORMS[s.formSel].aura}` }}>{FORMS[s.formSel].name.toUpperCase()}</div>}</>}
      {/* top-left: vitals */}
      <div className="hud-panel hud-vitals absolute top-4 left-4 w-[330px] rounded-xl p-3">
        <div className="flex items-baseline gap-2"><span className="title-font text-2xl text-white" style={{ textShadow: '0 0 10px #ff2e57' }}>{s.name}</span><span className="text-xs text-rose-300 font-bold">LV {s.level}</span>{h.form > 0 && <span className="text-[10px] font-black px-1.5 rounded" style={{ background: f.aura, color: '#000' }}>{f.name.toUpperCase()} {Math.ceil(h.formT)}s</span>}</div>
        <div className="my-1"><Bar v={h.hp} max={h.maxHp} color="#ff3355" h={16} label={`HP ${Math.ceil(h.hp)} / ${h.maxHp}`} /></div>
        <Bar v={h.en} max={h.maxEn} color="#38bdf8" h={12} label={`ENERGY ${Math.floor(h.en)}`} />
        <div className="mt-1"><Bar v={s.xp} max={xpFor(s.level)} color="#fbbf24" h={5} /></div>
        <div className="text-[10px] text-white/50 mt-1">{STAGES[rank - 1]}</div>
        {tracked && <div className="mt-3 p-2 rounded border-l-4 border-rose-500 bg-black/50"><div className="text-[10px] text-rose-300 font-black">{tracked.main ? 'MAIN MISSION' : 'OBJECTIVE'}</div><div className="text-sm font-bold">{tracked.title}</div><div className="text-[11px] text-white/70 normal-case tracking-normal">{tracked.desc}</div><div className="mt-1"><Bar v={tp} max={tracked.need} color="#ff2e57" h={8} label={`${tp}/${tracked.need}`} /></div></div>}
        {dir >= 0 && <div className="text-[11px] text-emerald-300 mt-1">▲ Waypoint {dir} m</div>}
      </div>
      {/* top-right: resources/threat */}
      <div className="hud-panel hud-resources absolute top-4 right-4 flex gap-4 items-start rounded-xl p-2.5">
        <div className="text-right"><div className="text-2xl font-black text-amber-300" style={{ textShadow: '0 0 12px #f59e0b88' }}>${s.money.toLocaleString()}</div><div className="text-sm font-bold text-rose-300">{s.rep.toLocaleString()} REP</div>
          <div className="mt-2 flex gap-1 justify-end">{Array.from({ length: 7 }).map((_, i) => <i key={i} className="w-5 h-2.5 rounded-sm" style={{ background: i < h.threat ? (i < 3 ? '#fb923c' : '#ef4444') : '#2a2a38', boxShadow: i < h.threat ? '0 0 8px #ef4444' : 'none', animation: i < h.threat && h.threat > 3 ? 'flicker 0.7s infinite' : undefined }} />)}</div>
          <div className="text-[10px] font-bold" style={{ color: h.threat > 3 ? '#f87171' : h.threat ? '#fb923c' : '#9ca3af' }}>THREAT {h.threat}: {THREAT_NAMES[h.threat]}</div></div>
        <Radar />
      </div>
      {h.boss && <div className="absolute top-3 left-1/2 -translate-x-1/2 w-[480px] text-center"><div className="title-font text-xl text-rose-300" style={{ textShadow: '0 0 12px #ff2e57' }}>{h.boss.name}</div><Bar v={h.boss.hp} max={h.boss.max} color="#ff2244" h={14} label={`${Math.ceil(h.boss.hp)}`} /></div>}
      {G.assault && <div className="absolute top-20 left-1/2 -translate-x-1/2 text-center"><div className="title-font text-lg text-orange-300">ASSAULT — {G.assault.boss ? 'BOSS FIGHT' : `WAVE ${G.assault.wave}/${G.assault.waves}`}</div><div className="text-xs text-white/60">Enemies remaining: {G.assault.alive}</div></div>}
      {/* crosshair */}
      {!overlay && h.dead === 0 && !h.vehicle && <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"><div className="w-1.5 h-1.5 rounded-full bg-white/80" style={{ boxShadow: '0 0 8px #ff2e57' }} /></div>}
      {/* prompt */}
      {h.prompt && !overlay && <div className="absolute left-1/2 top-[62%] -translate-x-1/2 text-center fadein"><div className="px-4 py-2 rounded bg-black/70 border border-amber-300/60 text-amber-200 text-sm font-bold normal-case tracking-wide">{h.prompt}</div>{h.progress > 0 && <div className="w-56 mx-auto mt-1"><Bar v={h.progress} max={1} color="#fbbf24" h={8} /></div>}</div>}
      {/* bottom-left: location */}
      <div className="hud-location absolute bottom-4 left-4"><div className="text-lg font-black">{h.region}</div><div className="text-[11px] text-white/60">{h.regionState} • {String(hr).padStart(2, '0')}:{String(mn).padStart(2, '0')} • {h.weather.toUpperCase()}</div><div className="hud-controls text-[10px] text-white/35 mt-1 normal-case tracking-normal">[I] Inventory [K] Skills [M] Map [Tab] Org [J] Missions [P] Character [Esc] Pause</div><div className="text-[10px] text-white/30">{h.fps} FPS</div></div>
      {/* bottom-center: skills */}
      <div className="hud-skills absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3 items-end">
        {(['e', 'r', 'v'] as const).map((k, i) => { const id = k === 'v' && h.form && f.skill ? f.skill : s.eq[k]; const sk = SKILL_MAP[id]; const cd = h.cd[i]; return (
          <div key={k} className="relative w-[64px] h-[64px] rounded-lg border-2 overflow-hidden" style={{ borderColor: sk ? sk.c1 : '#444', background: 'rgba(8,8,18,0.8)', boxShadow: sk && cd === 0 ? `0 0 14px ${sk.c1}` : 'none' }}>
            {sk ? <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-center p-1 leading-tight" style={{ color: sk.c1, textShadow: '0 0 6px ' + sk.c1 }}>{sk.name}</div> : <div className="absolute inset-0 flex items-center justify-center text-white/30 text-[10px]">EMPTY</div>}
            {cd > 0 && <div className="absolute left-0 right-0 bottom-0 bg-black/75" style={{ height: `${cd * 100}%` }} />}
            <div className="absolute top-0 left-0 bg-white text-black text-[11px] font-black px-1.5 rounded-br">{k.toUpperCase()}</div>
            {sk && <div className="absolute bottom-0 right-0 text-[9px] bg-black/70 px-1 text-sky-300">{sk.cost}</div>}
          </div>); })}
        <div className="w-[64px] h-[64px] rounded-lg border-2 flex flex-col items-center justify-center" style={{ borderColor: h.form ? f.aura : '#444', background: 'rgba(8,8,18,0.8)', boxShadow: h.form ? `0 0 16px ${f.aura}` : 'none' }}><div className="absolute -mt-[44px] ml-[-30px] bg-white text-black text-[11px] font-black px-1.5 rounded">T</div><div className="text-[9px] font-bold text-center leading-tight" style={{ color: FORMS[h.form ? h.form : s.formSel].aura }}>{h.form ? 'TRANSFORMED' : s.formSel ? FORMS[s.formSel].name.split(' ')[0] : 'NO FORM'}</div></div>
        <div className="px-3 py-2 rounded-lg border border-white/20 bg-black/60 text-[11px]"><div className="text-white/40 text-[9px]">WEAPON [Z]</div><b style={{ color: w?.color ?? '#999' }}>{w ? w.name : 'Fists'}{w && s.wlv[w.id] ? ` +${s.wlv[w.id]}` : ''}</b></div>
      </div>
      {/* bottom-right: movement */}
      <div className="hud-movement absolute bottom-4 right-4 text-right">
        {h.vehicle ? <><div className="text-xs text-white/60">{h.vehicle}</div><div className="text-4xl font-black title-font">{Math.round(h.speed)}<span className="text-sm text-white/50"> km/h</span></div><div className="w-40 ml-auto"><Bar v={h.vhp} max={1} color="#f59e0b" h={6} /></div><div className="text-[10px] text-white/40">G exit • Space handbrake • Shift nitro</div></>
          : <><div className="text-xs font-black" style={{ color: h.flying ? '#7dd3fc' : '#9ca3af' }}>{h.flying ? (h.boost ? '✈ BOOST FLIGHT' : '✈ FLYING') : 'ON FOOT'}</div><div className="text-3xl font-black title-font">{Math.round(h.speed)}<span className="text-sm text-white/50"> km/h</span></div><div className="text-[11px] text-white/50">ALT {Math.round(h.alt)} m</div>{!h.flying && <div className="text-[10px] text-sky-300/70">Double-tap SPACE to fly</div>}</>}
        {h.combo > 1 && <div className="title-font text-3xl text-amber-300 mt-1" style={{ textShadow: '0 0 12px #f59e0b' }}>{h.combo} HIT</div>}
      </div>
      {!locked && !overlay && h.dead === 0 && <div className="absolute inset-x-0 top-[40%] text-center pointer-events-none"><div className="inline-block px-6 py-3 bg-black/75 border border-white/20 rounded text-sm normal-case tracking-wide">Click the game to capture the mouse (Esc to release). Arrow keys also turn the camera (or hold Alt + move mouse if capture is unavailable).</div></div>}
      {h.dead > 0 && <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center"><div className="title-font text-7xl text-rose-500" style={{ textShadow: '0 0 30px #ff0033' }}>DEFEATED</div><div className="text-white/60 mt-2 normal-case tracking-normal">You will wake up in your hideout…</div></div>}
      {/* toasts */}
      <div className="absolute right-4 top-[38%] flex flex-col gap-1.5 items-end w-[360px]">{s.toasts.map((t) => <div key={t.id} className="px-3 py-1.5 rounded bg-black/75 border-r-4 text-xs font-bold normal-case tracking-wide max-w-full" style={{ borderColor: t.color, color: t.color, animation: 'slidein .3s ease-out' }}>{t.text}</div>)}</div>
      {h.threat >= 2 && <div className="absolute top-[22%] left-1/2 -translate-x-1/2 text-[11px] text-red-300 font-black" style={{ animation: 'flicker 1s infinite' }}>⚠ HEROES HUNTING YOU — {HEROES.filter((x) => x.threat <= h.threat).length} hero types dispatched</div>}
    </div>
  );
}
