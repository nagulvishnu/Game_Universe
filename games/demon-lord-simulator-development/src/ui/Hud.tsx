import { useEffect, useRef, useState } from 'react';
import { ABILITIES, FACTIONS, QUESTS, TERRITORIES, BOSSES } from '../game/data';
import { getUnderwater, project, resumeLock } from '../game/engine';
import { R, P } from '../game/rt';
import { allTerritories, armyPower, totalArmy, useGame } from '../game/store';
import { Bar, MAP_SIZE, RES_ICON, fmt, w2m, worldMapCanvas } from './common';
import type { ResKey } from '../game/data';

function MiniMap() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!; const c = cv.getContext('2d')!; let raf = 0, last = 0; const S = 180; const zoom = 3.2;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop); if (t - last < 66) return; last = t; const base = worldMapCanvas(); const gs = useGame.getState();
      c.save(); c.clearRect(0, 0, S, S); c.beginPath(); c.arc(S / 2, S / 2, S / 2 - 2, 0, 7); c.clip(); c.fillStyle = '#05030a'; c.fillRect(0, 0, S, S);
      const [px, pz] = w2m(P.pos.x, P.pos.z); c.translate(S / 2, S / 2); c.rotate(P.camYaw + Math.PI); c.scale(zoom, zoom); c.translate(-px, -pz); c.imageSmoothingEnabled = false; c.drawImage(base, 0, 0);
      const sc = MAP_SIZE / 1500;
      for (const t of allTerritories(gs)) { const o = gs.terr[t.id]?.owner ?? t.faction; const [x, y] = w2m(t.x, t.z); c.fillStyle = FACTIONS[o].color; c.strokeStyle = '#000'; c.lineWidth = 0.5; c.beginPath(); c.rect(x - 2.2, y - 2.2, 4.4, 4.4); c.fill(); c.stroke(); }
      for (const b of BOSSES) { if (gs.bossesDefeated.includes(b.id)) continue; const [x, y] = w2m(b.pos[0], b.pos[1]); c.fillStyle = '#ff2020'; c.beginPath(); c.arc(x, y, 2.4, 0, 7); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 0.4; c.stroke(); }
      for (const e of R.ents) { if (e.state === 'dead' || e.kind === 'citizen' || e.kind === 'dummy' || e.kind === 'boss') continue; if (Math.abs(e.pos.x - P.pos.x) > 130 || Math.abs(e.pos.z - P.pos.z) > 130) continue; const [x, y] = w2m(e.pos.x, e.pos.z); c.fillStyle = e.team === 'enemy' ? (e.friendly ? '#ffd24a' : '#ff4a4a') : e.kind === 'general' ? '#ffd24a' : '#4aff8a'; c.fillRect(x - 0.7, y - 0.7, 1.4 * sc * 2, 1.4 * sc * 2); }
      c.restore(); c.save(); c.translate(S / 2, S / 2); c.rotate(P.camYaw - P.yaw); c.fillStyle = '#fff'; c.strokeStyle = '#d4143c'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, -9); c.lineTo(-5, 6); c.lineTo(0, 3); c.lineTo(5, 6); c.closePath(); c.fill(); c.stroke(); c.restore();
    };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="relative" style={{ width: 180, height: 180 }}>
      <canvas ref={ref} width={180} height={180} style={{ borderRadius: '50%', border: '3px solid #e8c24a', boxShadow: '0 0 20px rgba(212,20,60,.6), inset 0 0 30px #000' }} />
      <div className="absolute left-1/2 -top-1 -translate-x-1/2 text-[10px] gold-text font-bold">N↑ CAM</div>
    </div>
  );
}

function Popups() {
  const refs = useRef<(HTMLDivElement | null)[]>([]); const N = 28;
  useEffect(() => {
    let raf = 0, last = performance.now();
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop); const dt = Math.min(0.1, (t - last) / 1000); last = t; R.hurt = Math.max(0, R.hurt - dt * 1.2);
      for (const p of R.popups) p.t += dt; if (R.popups.length && R.popups[0].t > 1.1) R.popups = R.popups.filter((p) => p.t < 1.1);
      for (let i = 0; i < N; i++) { const el = refs.current[i]; if (!el) continue; const p = R.popups[i]; if (!p) { el.style.display = 'none'; continue; } const s = project(p.x, p.y + p.t * 1.6, p.z); if (!s.ok) { el.style.display = 'none'; continue; } el.style.display = 'block'; el.style.left = s.x + 'px'; el.style.top = s.y + 'px'; el.style.opacity = String(1 - p.t / 1.1); el.textContent = p.text; el.style.color = p.color; el.style.fontSize = (p.big ? 26 : 17) + 'px'; }
    };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, []);
  return <>{Array.from({ length: N }, (_, i) => <div key={i} ref={(el) => { refs.current[i] = el; }} className="pd absolute font-bold pointer-events-none" style={{ display: 'none', transform: 'translate(-50%,-50%)', zIndex: 30 }} />)}</>;
}
function HurtVignette() {
  const ref = useRef<HTMLDivElement>(null); const uw = useRef<HTMLDivElement>(null);
  useEffect(() => { let raf = 0; const loop = () => { raf = requestAnimationFrame(loop); if (ref.current) ref.current.style.opacity = String(Math.min(1, R.hurt * 1.4) * 0.9); if (uw.current) uw.current.style.opacity = getUnderwater() ? '1' : '0'; }; raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf); }, []);
  return <><div ref={ref} className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(200,0,30,.85) 100%)', opacity: 0 }} /><div ref={uw} className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, rgba(10,90,120,.25), rgba(2,40,70,.6))', opacity: 0, transition: 'opacity .3s' }} /></>;
}
function LockHint() {
  const [locked, setLocked] = useState(false); const [err, setErr] = useState(false); const menu = useGame((s) => s.menu);
  useEffect(() => { const a = () => setLocked(!!document.pointerLockElement); const b = () => setErr(true); document.addEventListener('pointerlockchange', a); document.addEventListener('pointerlockerror', b); return () => { document.removeEventListener('pointerlockchange', a); document.removeEventListener('pointerlockerror', b); }; }, []);
  if (locked || err || menu) return null;
  return <div className="absolute inset-0 flex items-center justify-center cursor-pointer" style={{ zIndex: 25, background: 'rgba(0,0,0,.25)' }} onClick={() => { resumeLock(); setTimeout(() => { if (!document.pointerLockElement) setErr(true); }, 400); }}><div className="panel px-8 py-5 text-center"><div className="gold-text text-2xl tracking-widest">CLICK TO TAKE COMMAND</div><div className="text-xs text-stone-300 mt-2">Mouse = camera · WASD = move · Space ×2 = fly · LMB/RMB = attack · H = interact · Esc = menu</div></div></div>;
}

const KEYS_HELP = 'H Interact · Z Dodge · Tab Command · I Inventory · M Map · Esc Menu';
export function Hud() {
  const hud = useGame((s) => s.hud); const toasts = useGame((s) => s.toasts); const banner = useGame((s) => s.banner); const flash = useGame((s) => s.flash);
  const res = useGame((s) => s.res); const pending = useGame((s) => s.pending); const tracked = useGame((s) => s.tracked); const progress = useGame((s) => s.progress); const units = useGame((s) => s.units); const divisions = useGame((s) => s.divisions);
  const attacks = useGame((s) => s.attacks); const days = useGame((s) => s.days); const terr = useGame((s) => s.terr);
  const q = QUESTS.find((x) => x.id === tracked); const owned = TERRITORIES.filter((t) => terr[t.id]?.owner === 'demon').length; const pend = Object.values(pending).reduce((a, b) => a + b, 0);
  const field = divisions.filter((d) => d.status === 'field').length; const marching = divisions.filter((d) => d.status === 'marching').length;
  return (
    <div className="absolute inset-0 pointer-events-none select-none" style={{ zIndex: 10 }}>
      <HurtVignette /><Popups />
      {/* crosshair */}
      <div className="absolute left-1/2 top-1/2" style={{ width: 6, height: 6, marginLeft: -3, marginTop: -3, borderRadius: '50%', background: 'rgba(255,255,255,.7)', boxShadow: '0 0 6px #d4143c' }} />
      {/* vitals */}
      <div className="absolute left-5 top-4" style={{ width: 360 }}>
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center" style={{ width: 74, height: 74, borderRadius: '50%', border: `3px solid ${hud.form ? '#ffd24a' : '#e8c24a'}`, background: 'radial-gradient(circle at 50% 40%, #5a0a22, #0a0610)', boxShadow: hud.form ? '0 0 26px #ff2a3a, 0 0 8px #ffd24a' : '0 0 14px rgba(212,20,60,.7)' }}>
            <svg width="54" height="54" viewBox="0 0 54 54"><path d="M14 30 Q4 22 6 6 Q14 14 20 18Z M40 30 Q50 22 48 6 Q40 14 34 18Z" fill={hud.form ? '#ffd24a' : '#e8d8c0'} /><ellipse cx="27" cy="31" rx="12" ry="14" fill="#9a7a86" /><path d="M17 28 L25 30 L17 32Z M37 28 L29 30 L37 32Z" fill="#ff2040" /><path d="M16 22 Q27 10 38 22 Q27 18 16 22Z" fill="#0a0608" /></svg>
          </div>
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] pd"><span className="gold-text font-bold tracking-widest">DEMON LORD {hud.form ? '· AWAKENED' : ''}</span><span>{Math.ceil(hud.hp)}/{hud.maxHp}</span></div>
            <Bar v={hud.hp} max={hud.maxHp} color="#e0153f" h={14} />
            <Bar v={hud.mana} max={hud.maxMana} color="#3a8aff" h={10} />
            <Bar v={hud.stamina} max={100} color="#7aff6a" h={7} />
          </div>
        </div>
        {(hud.flying || hud.swimming || hud.form === 1) && <div className="mt-1 flex gap-2 text-[10px] tracking-widest pd">{hud.flying && <span className="text-sky-300">✈ FLIGHT</span>}{hud.swimming && <span className="text-cyan-300">≋ SWIMMING</span>}{hud.form === 1 && <span style={{ color: '#ffd24a', animation: 'pulse 1s infinite' }}>🔥 AWAKENED FORM</span>}{hud.summonT === 1 && <span className="text-orange-300">🐉 DRAGON ACTIVE</span>}</div>}
        {hud.combo > 0 && <div className="mt-1 text-sm gold-text font-bold pd">COMBO ×{hud.combo}</div>}
      </div>
      {/* region + boss */}
      <div className="absolute left-1/2 top-3 -translate-x-1/2 text-center" style={{ width: 560 }}>
        <div className="pd text-lg tracking-[.35em] uppercase" style={{ color: '#f6dca0' }}>{hud.region}</div>
        {hud.boss && <div className="mt-2"><div className="pd flex justify-between text-sm"><span className="gold-text font-bold tracking-widest">{hud.boss.name} <span className="text-stone-300 text-xs">— {hud.boss.title}</span></span><span className="text-xs text-red-300">PHASE {hud.boss.phase}/3</span></div><div style={{ height: 18, border: '2px solid #e8c24a', background: '#000', position: 'relative', clipPath: 'polygon(10px 0,100% 0,calc(100% - 10px) 100%,0 100%)' }}><div style={{ width: `${(hud.boss.hp / hud.boss.max) * 100}%`, height: '100%', background: 'linear-gradient(90deg,#7a0a22,#ff2a4a)', transition: 'width .15s' }} />{[33, 66].map((m) => <div key={m} className="absolute top-0 bottom-0" style={{ left: m + '%', width: 2, background: '#e8c24a' }} />)}</div></div>}
      </div>
      {/* minimap + resources */}
      <div className="absolute right-5 top-4 flex flex-col items-end gap-2">
        <MiniMap />
        <div className="panel-soft px-3 py-1.5 text-[12px] pd grid grid-cols-5 gap-x-3 gap-y-0">{(Object.keys(RES_ICON) as ResKey[]).map((k) => <div key={k} className="text-center" title={RES_ICON[k].name}><div style={{ color: RES_ICON[k].color }}>{RES_ICON[k].icon}</div><div>{fmt(res[k])}</div></div>)}</div>
        <div className="panel-soft px-3 py-1 text-[11px] pd text-right"><div>Day {days} · <span className="text-red-300">{owned}</span> territories {pend > 1 && <span className="text-yellow-300"> · income ready</span>}</div><div>Army {fmt(totalArmy(units))} · Power {fmt(armyPower({ units } as never))} · Field {hud.fieldCount} visible ({field} div) {marching > 0 && `· ${marching} marching`}</div></div>
      </div>
      {/* quest + alerts */}
      <div className="absolute left-5 bottom-28" style={{ width: 330 }}>
        {attacks.filter((a) => a.phase === 'arrived').map((a) => <div key={a.id} className="panel-soft px-3 py-1 mb-1 text-sm text-red-300 pd" style={{ animation: 'pulse 1s infinite', borderColor: '#d4143c' }}>⚔ INVASION — {FACTIONS[a.faction].name} attacking {TERRITORIES.find((t) => t.id === a.tid)?.name ?? 'an outpost'}!</div>)}
        {q ? <div className="panel-soft px-3 py-2"><div className="text-[10px] tracking-widest text-yellow-300">ACTIVE QUEST (optional)</div><div className="text-sm font-bold">{q.name}</div><div className="text-[11px] text-stone-300">{q.desc}</div><div className="mt-1"><Bar v={progress[q.id] ?? 0} max={q.n} color="#e8c24a" h={6} /></div></div> : <div className="panel-soft px-3 py-1 text-[11px] text-stone-400">No active quest — accept optional quests in the Command Interface (Tab).</div>}
        <div className="text-[10px] text-stone-400 mt-1 pd">{KEYS_HELP}</div>
      </div>
      {/* toasts */}
      <div className="absolute left-5 top-44 space-y-1.5" style={{ width: 380 }}>{toasts.map((t) => <div key={t.id} className="px-3 py-1.5 text-[13px] pd" style={{ animation: 'toastIn .25s', background: t.kind === 'epic' ? 'linear-gradient(90deg,rgba(168,128,30,.85),rgba(60,20,40,.7))' : t.kind === 'bad' ? 'linear-gradient(90deg,rgba(150,10,30,.85),rgba(40,6,16,.6))' : t.kind === 'good' ? 'linear-gradient(90deg,rgba(20,100,60,.85),rgba(10,30,20,.6))' : 'linear-gradient(90deg,rgba(40,30,70,.85),rgba(10,6,24,.6))', borderLeft: `3px solid ${t.kind === 'epic' ? '#ffd24a' : t.kind === 'bad' ? '#ff4a6a' : t.kind === 'good' ? '#4aff8a' : '#a58aff'}` }}>{t.text}</div>)}</div>
      {/* prompt */}
      {hud.prompt && <div className="absolute left-1/2 bottom-36 -translate-x-1/2 panel-soft px-5 py-2 pd text-center" style={{ borderColor: '#e8c24a' }}><span className="inline-block px-2 mr-2 text-black font-bold" style={{ background: '#e8c24a' }}>H</span>{hud.prompt}</div>}
      {/* skills */}
      <div className="absolute left-1/2 bottom-4 -translate-x-1/2 flex items-end gap-2">
        <div className="flex flex-col gap-1 mr-2 text-[10px] text-center"><div className="panel-soft px-2 py-0.5">LMB <span className="text-stone-300">Attack</span></div><div className="panel-soft px-2 py-0.5">RMB <span className="text-stone-300">Heavy</span></div></div>
        {ABILITIES.map((a) => { const cd = hud.cds[a.id] ?? 0; const noMana = hud.mana < a.mana; const active = (a.id === 'form' && hud.form === 1) || (a.id === 'dragon' && hud.summonT === 1); return (
          <div key={a.id} className="relative flex flex-col items-center" style={{ width: 62 }}>
            <div className="relative flex items-center justify-center" style={{ width: 58, height: 58, transform: 'rotate(45deg)', border: `2px solid ${active ? '#ffd24a' : a.color}`, background: `linear-gradient(135deg, ${a.color}55, #0a0610 80%)`, boxShadow: active ? `0 0 22px ${a.color}` : `0 0 10px ${a.color}66`, opacity: noMana && cd === 0 ? 0.5 : 1 }}>
              <div style={{ transform: 'rotate(-45deg)', fontSize: 22, fontWeight: 800, color: '#fff', textShadow: `0 0 8px ${a.color}` }}>{a.key}</div>
              {cd > 0 && <div className="absolute inset-0" style={{ background: `conic-gradient(rgba(0,0,0,.78) ${cd * 360}deg, transparent 0)` }} />}
            </div>
            <div className="text-[9px] mt-2 text-center leading-tight pd" style={{ width: 70 }}>{a.name}{a.mana > 0 && <span className="text-sky-300"> · {a.mana}</span>}</div>
          </div>); })}
      </div>
      {/* banner */}
      {banner && <div className="absolute left-0 right-0 top-1/3 text-center" style={{ animation: 'bannerIn 3.6s forwards' }}><div className="inline-block px-16 py-3" style={{ background: 'linear-gradient(90deg,transparent,rgba(120,10,30,.85),transparent)' }}><div className="gold-text text-4xl font-black tracking-[.25em] title-glow">{banner}</div></div></div>}
      {flash && <div className="absolute inset-0" style={{ background: flash, animation: 'flashOut .6s forwards' }} />}
      <LockHint />
      <div className="absolute right-2 bottom-1 text-[10px] text-stone-500">{hud.fps} FPS</div>
    </div>
  );
}
