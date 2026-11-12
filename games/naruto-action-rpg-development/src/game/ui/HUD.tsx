import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useHud } from '../hudStore';
import { useGame } from '../store';
import { rt, yawTo } from '../runtime';
import { CHARACTERS } from '../data/characters';
import { RANKS } from '../data/missions';
import { rankOf, objectiveMarker } from '../systems/missions';
import { keyLabel } from '../systems/hud';
import { ZONES } from '../config';

const pct = (a: number, b: number) => `${Math.max(0, Math.min(100, (a / Math.max(1, b)) * 100))}%`;

function Bars() {
  const h = useHud(); const prof = useGame((s) => s.profile); const rank = RANKS[rankOf()];
  const low = h.hp / h.maxHp < 0.3;
  return (
    <div className="absolute left-3 top-3 flex w-[21rem] max-w-[60vw] gap-3" style={{ animation: 'slideIn .5s' }}>
      <div className="relative h-20 w-20 shrink-0 -skew-x-6 border-[3px] bg-slate-900" style={{ borderColor: h.charColor, boxShadow: `0 0 14px ${h.charColor}88` }}>
        <div className="flex h-full w-full items-center justify-center text-4xl" style={{ background: `linear-gradient(135deg, ${h.charColor}66, #0b1030)` }}>{h.form === 'kurama' ? '🦊' : h.form === 'sage' ? '🐸' : '🥷'}</div>
        <div className="absolute -bottom-2 -right-2 bg-black px-1.5 text-xs font-black text-yellow-300">Lv.{h.level}</div>
      </div>
      <div className="flex-1">
        <div className="flex items-baseline justify-between"><span className="anime-title text-lg leading-none" style={{ color: h.charColor }}>{h.charName}</span><span className="text-[10px] font-bold uppercase tracking-widest text-slate-300">{rank.badge} {rank.name}</span></div>
        <div className="relative mt-1 h-4 -skew-x-12 overflow-hidden border border-black bg-black/70"><div className="h-full transition-[width] duration-100" style={{ width: pct(h.hp, h.maxHp), background: low ? 'linear-gradient(90deg,#ff3a3a,#ff7a3a)' : 'linear-gradient(90deg,#3adf5a,#9bff6a)' }} /><span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white drop-shadow">{Math.ceil(h.hp)} / {h.maxHp}</span></div>
        <div className="relative mt-1 h-3 -skew-x-12 overflow-hidden border border-black bg-black/70"><div className="h-full transition-[width] duration-100" style={{ width: pct(h.chakra, h.maxChakra), background: 'linear-gradient(90deg,#2f7bff,#5ce0ff)' }} /><span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-white drop-shadow">{Math.ceil(h.chakra)}</span></div>
        <div className="mt-1 h-1.5 -skew-x-12 overflow-hidden bg-black/70"><div className="h-full" style={{ width: pct(h.stamina, 100), background: '#ffd24a' }} /></div>
        <div className="mt-1 h-1 -skew-x-12 overflow-hidden bg-black/70"><div className="h-full bg-fuchsia-400" style={{ width: pct(h.xp, h.xpNeed) }} /></div>
        <div className="mt-1 flex items-center gap-2 text-[11px] font-bold text-amber-300">💰 {prof.ryo.toLocaleString()} ryo
          {h.form !== 'base' && <span className="chip" style={{ color: h.form === 'sage' ? '#ff9a3a' : '#ffc02e' }}>{h.form === 'sage' ? '🐸 Sage' : '🦊 Kurama'} {Math.ceil(h.formRem)}s</span>}
          {h.guard && <span className="chip text-sky-300">Guard</span>}{h.charging && <span className="chip text-cyan-300">Charging</span>}
        </div>
      </div>
    </div>
  );
}

function Abilities() {
  const slots = useHud((s) => s.slots); const ult = useHud((s) => s.ult);
  return (
    <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-end gap-2" style={{ animation: 'slideUp .5s' }}>
      {slots.map((s, i) => {
        const isUlt = i === 5; const ready = s.rem <= 0.01 && !s.locked; const frac = s.total > 0 ? Math.min(1, s.rem / s.total) : 0;
        return (
          <div key={i} className={`relative -skew-x-6 border-2 ${isUlt ? 'h-16 w-16' : 'h-14 w-14'} overflow-hidden`} style={{ borderColor: s.locked ? '#444' : ready ? s.color : '#667', background: 'rgba(8,10,28,.85)', boxShadow: ready && !s.locked ? `0 0 12px ${s.color}99` : 'none', animation: isUlt && ult >= 100 ? 'pulseGlow 1s infinite' : undefined }} title={`${s.name} — ${s.cost} chakra`}>
            <div className={`flex h-full w-full items-center justify-center text-2xl ${s.locked ? 'opacity-30 grayscale' : ''}`}>{s.icon}</div>
            {isUlt && <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-fuchsia-500/70 to-amber-300/40" style={{ height: `${ult}%` }} />}
            {!isUlt && frac > 0 && <div className="absolute inset-x-0 bottom-0 bg-black/70" style={{ height: `${frac * 100}%` }} />}
            {!isUlt && s.rem > 0.05 && <div className="absolute inset-0 flex items-center justify-center text-sm font-black text-white drop-shadow">{s.rem.toFixed(1)}</div>}
            <div className="absolute left-0.5 top-0 text-[10px] font-black text-yellow-200 drop-shadow">{s.key}</div>
            {!s.locked && <div className="absolute bottom-0 right-0.5 text-[9px] font-black text-cyan-300 drop-shadow">{s.cost}</div>}
            {s.locked && <div className="absolute inset-0 flex items-center justify-center text-lg">🔒</div>}
          </div>
        );
      })}
    </div>
  );
}

function Mission() {
  const m = useHud((s) => s.missionTitle); const obj = useHud((s) => s.objectives); const hint = useHud((s) => s.hint); const tl = useHud((s) => s.timeLimit);
  const dist = useHud((s) => s.objDist); const ang = useHud((s) => s.objAngle);
  return (
    <div className="absolute right-3 top-3 w-72 max-w-[40vw] text-sm">
      <div className="panel-soft p-3" style={{ clipPath: 'polygon(0 0,100% 0,100% 100%,12px 100%,0 calc(100% - 12px))' }}>
        <div className="mb-1 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-orange-300"><span>Mission</span>{tl !== null && <span className={`${tl < 10 ? 'animate-pulse text-red-400' : 'text-yellow-200'}`}>⏱ {Math.ceil(tl)}s</span>}</div>
        {m ? (<>
          <div className="font-black leading-tight text-white">{m}</div>
          <ul className="mt-1.5 space-y-1">{obj.map((o, i) => <li key={i} className={`flex gap-1.5 text-[13px] ${o.done ? 'text-emerald-300 line-through opacity-70' : 'text-slate-100'}`}><span>{o.done ? '✔' : '◆'}</span><span>{o.text}</span></li>)}</ul>
          {hint && <div className="mt-2 border-l-2 border-sky-400 pl-2 text-[11px] text-sky-200">{hint}</div>}
          {dist !== null && (<div className="mt-2 flex items-center gap-2 text-xs text-cyan-200"><span className="inline-block text-lg" style={{ transform: `rotate(${(-ang * 180) / Math.PI}deg)` }}>⬆</span>{Math.round(dist)} m</div>)}
        </>) : (<div className="text-xs text-slate-300">No active mission. Talk to NPCs with <b>!</b> above them, or read the board near the Hokage tower ({keyLabel(useGame.getState().settings.bindings.missions)} = mission log).</div>)}
      </div>
    </div>
  );
}

function Bosses() {
  const t = useHud((s) => s.target); const b = useHud((s) => s.boss);
  return (<>
    {b && (<div className="absolute left-1/2 top-4 w-[min(34rem,44vw)] -translate-x-1/2" style={{ animation: 'slideUp .5s' }}>
      <div className="flex items-end justify-between"><span className="anime-title text-xl text-red-400">{b.name}</span><span className="text-[11px] font-bold uppercase tracking-widest text-slate-300">{b.title}</span></div>
      <div className="relative h-5 -skew-x-12 overflow-hidden border-2 border-black bg-black/80"><div className="h-full transition-[width] duration-150" style={{ width: pct(b.hp, b.max), background: 'linear-gradient(90deg,#8a0a0a,#ff3a2a,#ff8a3a)' }} />{b.shield > 0 && <div className="absolute inset-y-0 left-0 bg-yellow-200/60" style={{ width: pct(b.shield, 1) }} />}
        {[0.62, 0.3].map((p) => <div key={p} className="absolute inset-y-0 w-0.5 bg-white/60" style={{ left: `${p * 100}%` }} />)}</div>
      <div className="mt-0.5 flex justify-between text-[10px] font-bold text-slate-300"><span>Phase {b.phase + 1}</span><span>{Math.ceil(b.hp)} / {Math.round(b.max)}</span></div>
    </div>)}
    {t && !b && (<div className="absolute left-1/2 top-4 w-72 -translate-x-1/2 text-center">
      <div className="text-sm font-black text-white drop-shadow">{t.name} <span className="text-[10px] text-slate-300">Lv.{t.level}</span> {t.tier === 'elite' && <span className="chip text-fuchsia-300">Elite</span>}</div>
      <div className="h-3 -skew-x-12 overflow-hidden border border-black bg-black/70"><div className="h-full" style={{ width: pct(t.hp, t.max), background: 'linear-gradient(90deg,#c01a1a,#ff5a3a)' }} /></div>
      <div className="mt-0.5 flex justify-center gap-1">{t.status.map((s) => <span key={s} className="chip text-[9px] text-pink-300">{s}</span>)}</div>
    </div>)}
  </>);
}

function Toasts() {
  const toasts = useHud((s) => s.toasts);
  useEffect(() => { const id = setInterval(() => { const n = performance.now(); const cur = useHud.getState().toasts; if (cur.some((t) => t.expires < n)) useHud.setState({ toasts: cur.filter((t) => t.expires > n) }); }, 400); return () => clearInterval(id); }, []);
  const col = { info: 'border-sky-400', good: 'border-emerald-400', warn: 'border-red-400', level: 'border-yellow-300 bg-yellow-500/20', loot: 'border-amber-400' } as const;
  return (<div className="absolute bottom-24 right-3 flex w-72 flex-col items-end gap-1.5">
    {toasts.map((t) => <div key={t.id} className={`panel-soft border-l-4 px-3 py-1.5 text-sm font-bold ${col[t.kind]}`} style={{ animation: 'slideIn .3s' }}>{t.text}</div>)}
  </div>);
}

function Banners() {
  const banner = useHud((s) => s.banner); const zone = useHud((s) => s.zoneBanner); const lb = useHud((s) => s.letterbox);
  return (<>
    {banner && <div key={banner.id} className="pointer-events-none absolute inset-x-0 top-[28%] text-center" style={{ animation: 'bannerIn 3.2s ease-out forwards' }}><div className="anime-title inline-block -skew-x-6 text-5xl text-orange-400 md:text-7xl">{banner.title}</div><div className="mt-2 text-lg font-bold uppercase tracking-[.3em] text-white drop-shadow-lg">{banner.sub}</div></div>}
    {zone && <div key={zone.id} className="pointer-events-none absolute inset-x-0 top-24 text-center" style={{ animation: 'bannerIn 3.4s ease-out forwards' }}><div className="inline-block bg-black/55 px-8 py-2"><div className="anime-title text-3xl text-white">{zone.name}</div><div className="text-xs font-bold uppercase tracking-[.35em] text-orange-300">{zone.sub}</div></div></div>}
    <div className="pointer-events-none absolute inset-x-0 top-0 bg-black transition-all duration-500" style={{ height: lb ? '11vh' : 0 }} />
    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-black transition-all duration-500" style={{ height: lb ? '11vh' : 0 }} />
  </>);
}

function Minimap() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0; const c = ref.current!; const ctx = c.getContext('2d')!; const S = 132, R = 70;
    const loop = () => {
      raf = requestAnimationFrame(loop); if (!rt.playing) return; const p = rt.player.pos; const y = rt.camYaw; const cs = Math.cos(y), sn = Math.sin(y);
      const sc = S / 2 / R; const proj = (x: number, z: number): [number, number] => { const dx = x - p.x, dz = z - p.z; return [S / 2 + (-dx * cs + dz * sn) * sc, S / 2 - (dx * sn + dz * cs) * sc]; };
      ctx.clearRect(0, 0, S, S); ctx.save(); ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2 - 2, 0, 7); ctx.clip();
      ctx.fillStyle = rt.zone.mapColor ?? '#4a7a4a'; ctx.globalAlpha = 0.55; ctx.fillRect(0, 0, S, S); ctx.globalAlpha = 1;
      // Konoha streets & walls hint
      ctx.strokeStyle = 'rgba(220,200,150,.5)'; ctx.lineWidth = 4 * sc; ctx.beginPath(); let a = proj(0, -80), b = proj(0, 130); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); a = proj(-190, 0); b = proj(190, 0); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      for (const n of rt.npcs) { const [x, yy] = proj(n.pos.x, n.pos.z); ctx.fillStyle = '#ffd24a'; ctx.fillRect(x - 2, yy - 2, 4, 4); }
      for (const cl of rt.collectibles) { if (cl.taken || (cl.def.mission && rt.mission?.id !== cl.def.mission)) continue; const [x, yy] = proj(cl.def.pos[0], cl.def.pos[2]); ctx.fillStyle = '#7cf'; ctx.beginPath(); ctx.arc(x, yy, 2, 0, 7); ctx.fill(); }
      for (const e of rt.enemies) { if (e.state === 'dead') continue; const [x, yy] = proj(e.pos.x, e.pos.z); ctx.fillStyle = e.def.tier === 'boss' ? '#ff00aa' : e.aggro ? '#ff3030' : '#c06060'; ctx.beginPath(); ctx.arc(x, yy, e.def.tier === 'boss' ? 4 : 2.5, 0, 7); ctx.fill(); }
      for (const al of rt.allies) { const [x, yy] = proj(al.pos.x, al.pos.z); ctx.fillStyle = '#6f6'; ctx.fillRect(x - 1.5, yy - 1.5, 3, 3); }
      const mk = objectiveMarker(); if (mk) { let [x, yy] = proj(mk.x, mk.z); const dx = x - S / 2, dy = yy - S / 2; const d = Math.hypot(dx, dy); if (d > S / 2 - 8) { x = S / 2 + (dx / d) * (S / 2 - 8); yy = S / 2 + (dy / d) * (S / 2 - 8); } ctx.fillStyle = '#5ce0ff'; ctx.beginPath(); ctx.moveTo(x, yy - 6); ctx.lineTo(x + 5, yy); ctx.lineTo(x, yy + 6); ctx.lineTo(x - 5, yy); ctx.fill(); }
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(S / 2, S / 2 - 6); ctx.lineTo(S / 2 + 4.5, S / 2 + 5); ctx.lineTo(S / 2 - 4.5, S / 2 + 5); ctx.closePath(); ctx.save(); ctx.translate(S / 2, S / 2); ctx.rotate(-(rt.player.yaw - y)); ctx.translate(-S / 2, -S / 2); ctx.fill(); ctx.restore();
      ctx.restore(); ctx.strokeStyle = '#ff8a1a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2 - 2, 0, 7); ctx.stroke();
      const [nx, ny] = [S / 2 + sn * (S / 2 - 10) * -1 * -1, 0]; void nx; void ny;
      ctx.fillStyle = '#ff6a3a'; ctx.font = 'bold 10px sans-serif'; const np = proj(p.x, p.z - R * 0.9); ctx.fillText('N', np[0] - 3, np[1]);
    };
    loop(); return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} width={132} height={132} className="absolute right-3 top-[17.5rem] hidden rounded-full bg-black/40 md:block" />;
}

/** Projects world-space labels (damage numbers, NPC names, enemy bars) to the screen using pooled DOM nodes. */
function WorldOverlay() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = host.current!; const pool: HTMLDivElement[] = []; for (let i = 0; i < 56; i++) { const d = document.createElement('div'); d.style.cssText = 'position:absolute;left:0;top:0;display:none;white-space:nowrap;pointer-events:none;will-change:transform'; h.appendChild(d); pool.push(d); }
    const v = new THREE.Vector3(); let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop); const cam = rt.camera; let n = 0;
      if (cam && rt.playing) {
        const W = h.clientWidth, H = h.clientHeight;
        const place = (x: number, y: number, z: number, html: string, style: string, scale = 1, opacity = 1) => {
          if (n >= pool.length) return; v.set(x, y, z).project(cam); if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) return;
          const el = pool[n++]; const key = html + style; if (el.dataset.k !== key) { el.dataset.k = key; el.innerHTML = html; el.style.cssText = 'position:absolute;left:0;top:0;white-space:nowrap;pointer-events:none;will-change:transform' + style; }
          el.style.display = 'block'; el.style.transform = `translate(${(v.x * 0.5 + 0.5) * W}px,${(-v.y * 0.5 + 0.5) * H}px) translate(-50%,-100%) scale(${scale})`; el.style.opacity = String(opacity);
        };
        for (const f of rt.floaters) { const a = f.t < 0.15 ? f.t / 0.15 : 1; place(f.x, f.y, f.z, f.text, `;color:${f.color};font-weight:900;font-size:${18 * f.size}px;text-shadow:2px 2px 0 #000,-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000;font-style:italic`, 0.6 + 0.4 * a + (f.t < 0.12 ? 0.4 : 0), Math.max(0, 1 - Math.max(0, f.t - 0.7) / 0.5)); }
        for (const e of rt.enemies) {
          if (e.state === 'dead' || e === rt.boss || e.hp >= e.maxHp || e.def.tier === 'dummy' && e.hp >= e.maxHp) continue; const d = Math.hypot(e.pos.x - rt.player.pos.x, e.pos.z - rt.player.pos.z); if (d > 26) continue;
          const w = Math.round((e.hp / e.maxHp) * 56); place(e.pos.x, e.pos.y + 2.5 * (e.def.look.scale ?? 1), e.pos.z, `<div style="width:60px;height:7px;background:#000b;border:1px solid #000;transform:skewX(-12deg)"><div style="width:${w}px;height:100%;background:linear-gradient(90deg,#c01a1a,#ff6a3a)"></div></div>`, ';');
        }
        for (const npc of rt.npcs) { const d = Math.hypot(npc.pos.x - rt.player.pos.x, npc.pos.z - rt.player.pos.z); if (d > 16 || rt.allies.some((a) => a.charId === npc.def.id)) continue; place(npc.pos.x, npc.pos.y + 2.4 * (npc.def.look.scale ?? 1) + 0.2, npc.pos.z, `${npc.def.name.split(' (')[0]}`, ';color:#fff;font-weight:800;font-size:12px;text-shadow:1px 1px 2px #000,0 0 6px #000;letter-spacing:.04em', 1, Math.max(0, 1 - (d - 8) / 8)); }
        for (const a of rt.allies) { if (a.kind === 'clone') continue; place(a.pos.x, a.pos.y + 2.3, a.pos.z, a.charId[0].toUpperCase() + a.charId.slice(1), ';color:#9f9;font-weight:800;font-size:11px;text-shadow:1px 1px 2px #000', 1, 0.8); }
        for (const t of rt.telegraphs) void t;
      }
      for (let i = n; i < pool.length; i++) if (pool[i].style.display !== 'none') pool[i].style.display = 'none';
    };
    loop(); return () => { cancelAnimationFrame(raf); h.innerHTML = ''; };
  }, []);
  return <div ref={host} className="pointer-events-none absolute inset-0 overflow-hidden" />;
}

function ScreenFx() {
  const flash = useRef<HTMLDivElement>(null); const gen = useHud((s) => s.genjutsu); const hp = useHud((s) => s.hp / s.maxHp);
  useEffect(() => { let raf = 0; const loop = () => { raf = requestAnimationFrame(loop); if (flash.current) { flash.current.style.opacity = String(Math.min(0.85, rt.flash)); flash.current.style.background = rt.flashColor; } }; loop(); return () => cancelAnimationFrame(raf); }, []);
  return (<>
    <div ref={flash} className="pointer-events-none absolute inset-0" style={{ opacity: 0, mixBlendMode: 'screen' }} />
    {hp < 0.3 && <div className="pointer-events-none absolute inset-0" style={{ boxShadow: 'inset 0 0 120px 30px rgba(200,0,0,.55)', animation: 'pulseGlow 1.2s infinite' }} />}
    {gen && <div className="pointer-events-none absolute inset-0 fx-warp" style={{ background: 'radial-gradient(circle,transparent 30%,rgba(160,60,255,.35) 100%)', mixBlendMode: 'screen' }} />}
  </>);
}

export function HUD() {
  const prompt = useHud((s) => s.prompt); const combo = useHud((s) => s.combo); const locked = useHud((s) => s.pointerLocked); const fps = useHud((s) => s.fps);
  const showFps = useGame((s) => s.settings.showFps); const overlay = useGame((s) => s.overlay); const b = useGame((s) => s.settings.bindings); const night = useHud((s) => s.night); const clock = useHud((s) => s.clock); const zone = useHud((s) => s.zone);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ animation: 'fadeIn .6s' }}>
      <WorldOverlay /><ScreenFx />
      <Bars /><Mission /><Minimap /><Bosses /><Abilities /><Toasts /><Banners />
      <div className="absolute right-3 top-[15.8rem] hidden text-right text-[11px] font-bold text-slate-200 drop-shadow md:block">{night ? '🌙' : '☀️'} {clock} — {zone}</div>
      {prompt && !overlay && <div className="absolute bottom-24 left-1/2 -translate-x-1/2 border-2 border-yellow-300 bg-black/70 px-4 py-1.5 text-sm font-black text-yellow-200" style={{ animation: 'pulseGlow 1.4s infinite' }}>{prompt}</div>}
      {combo >= 2 && <div className="absolute right-6 top-1/2 text-right"><div className="anime-title text-5xl text-orange-400">{combo}</div><div className="text-xs font-black uppercase tracking-widest text-white">hits</div></div>}
      {!locked && !overlay && <div className="absolute inset-x-0 top-1/3 text-center"><span className="bg-black/70 px-4 py-2 text-sm font-black uppercase tracking-widest text-orange-300">Click the game to capture the mouse</span></div>}
      <div className="absolute bottom-3 left-3 max-w-md text-[10px] leading-4 text-slate-200/80 drop-shadow">
        <b>{keyLabel(b.forward)}{keyLabel(b.left)}{keyLabel(b.back)}{keyLabel(b.right)}</b> move • <b>Shift</b> sprint • <b>Space</b> jump/dodge • <b>LMB</b> combo • <b>RMB</b> heavy • <b>{keyLabel(b.block)}</b> guard • <b>{keyLabel(b.charge)}</b> charge<br />
        <b>1-4</b> jutsu • <b>{keyLabel(b.special)}</b> special • <b>{keyLabel(b.ultimate)}</b> ultimate • <b>{keyLabel(b.lock)}</b> lock-on • <b>{keyLabel(b.substitute)}</b> substitution • <b>{keyLabel(b.transform)}</b> transform • <b>{keyLabel(b.interact)}</b> interact<br />
        <b>Tab</b> status • <b>{keyLabel(b.inventory)}</b> items • <b>{keyLabel(b.skills)}</b> skills • <b>{keyLabel(b.missions)}</b> missions • <b>{keyLabel(b.map)}</b> map • <b>Esc</b> pause
      </div>
      {showFps && <div className="absolute bottom-3 right-3 text-xs font-bold text-lime-300">{fps} FPS</div>}
    </div>
  );
}
void yawTo; void CHARACTERS; void ZONES;
