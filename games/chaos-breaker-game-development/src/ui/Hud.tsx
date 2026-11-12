import { useEffect, useRef, useState } from 'react';
import { bridge, useGame, useHud } from '../game/store';
import { WEAPONS } from '../game/data/weapons';
import { STYLES } from '../game/data/world';
import { input } from '../game/input';
import { W, toScreen } from '../game/world';
import { hex, keyLabel } from './common';

interface Pop { id: number; text: string; kind: string; sub?: string }
const rankColor: Record<string, string> = { D: '#9aa', C: '#8cf', B: '#7f9', A: '#fd5', S: '#f93', SS: '#f55', SSS: '#f3f' };

function Meter({ v, max, color, trail, h, glow }: { v: number; max: number; color: string; trail?: string; h: number; glow?: boolean }) {
  const p = Math.max(0, Math.min(100, (v / max) * 100));
  return <div style={{ height: h }} className={glow ? 'ult-ready' : ''}><div className="bar"><b style={{ width: p + '%', background: trail ?? color }} /><i style={{ width: p + '%', background: color, boxShadow: `0 0 10px ${color}` }} /></div></div>;
}
function Skill({ k, label, cd, color, ready }: { k: string; label: string; cd: number; color: string; ready?: boolean }) {
  return (
    <div className="relative w-14 h-14 border bg-black/60 grid place-items-center" style={{ borderColor: cd > 0 ? 'rgba(255,255,255,.2)' : color, boxShadow: cd > 0 ? 'none' : `0 0 14px ${color}88`, transform: 'skewX(-8deg)' }}>
      <div style={{ transform: 'skewX(8deg)' }} className="text-center leading-tight"><div className="key !min-w-[1.4rem]">{k}</div><div className="text-[8px] mt-0.5 text-zinc-300 uppercase tracking-wide px-0.5">{label}</div></div>
      {cd > 0 && <div className="absolute inset-0" style={{ background: `conic-gradient(rgba(0,0,0,.72) ${cd * 360}deg, transparent 0)` }} />}
      {ready && <div className="absolute inset-0 ult-ready" style={{ border: `1px solid ${color}` }} />}
    </div>
  );
}

function LockMarker() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = ref.current, l = W.P?.lock;
      if (el) { if (l && l.alive && useGame.getState().screen === 'playing') { const [x, y, ok] = toScreen(l.pos, l.def.scale * 1.2 + (l.def.hover ?? 0)); el.style.display = ok ? 'block' : 'none'; el.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%) rotate(${performance.now() * .06 % 360}deg)`; } else el.style.display = 'none'; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, []);
  return <div ref={ref} className="absolute left-0 top-0 w-12 h-12 pointer-events-none" style={{ display: 'none', border: '2px dashed #ffd34d', borderRadius: '50%', boxShadow: '0 0 14px #ffb02a, inset 0 0 10px #ffb02a55' }} />;
}

export default function Hud() {
  const screen = useGame(s => s.screen), runId = useGame(s => s.runId), keys = useGame(s => s.settings.keys), weaponId = useGame(s => s.weapon), styleId = useGame(s => s.style), swap = useGame(s => s.save.swap), touchPref = useGame(s => s.settings.touch);
  const h = useHud(); const layer = useRef<HTMLDivElement>(null), flash = useRef<HTMLDivElement>(null);
  const [pop, setPop] = useState<Pop | null>(null), [pop2, setPop2] = useState<Pop | null>(null), [banner, setBanner] = useState<{ id: number; t: string; s: string } | null>(null), [toast, setToast] = useState('');
  const [showHelp, setShowHelp] = useState(true);
  useEffect(() => {
    let id = 0, tt: ReturnType<typeof setTimeout>;
    bridge.popup = (text, kind, sub) => { const p = { id: ++id, text, kind, sub }; if (kind === 'perfect' || kind === 'gold') setPop(p); else setPop2(p); };
    bridge.banner = (t, s) => setBanner({ id: ++id, t, s });
    bridge.float = (x, y, text, cls) => { const l = layer.current; if (!l) return; if (l.childElementCount > 22) l.firstElementChild?.remove(); const d = document.createElement('div'); d.className = 'ft ' + cls; d.textContent = text; d.style.left = x + 'px'; d.style.top = y + 'px'; l.appendChild(d); setTimeout(() => d.remove(), 900); };
    bridge.flash = (color, a, ms) => { const f = flash.current; if (!f) return; f.style.transition = 'none'; f.style.background = `radial-gradient(circle at center, transparent 20%, ${color} 130%)`; f.style.opacity = String(a); requestAnimationFrame(() => requestAnimationFrame(() => { f.style.transition = `opacity ${ms}ms ease-out`; f.style.opacity = '0'; })); };
    bridge.zoom = amt => { const w = document.getElementById('canvas-wrap'); if (!w) return; w.style.transition = 'none'; w.style.transform = `scale(${1 + amt})`; requestAnimationFrame(() => requestAnimationFrame(() => { w.style.transition = 'transform .28s cubic-bezier(.2,.8,.3,1)'; w.style.transform = 'scale(1)'; })); };
    bridge.toast = t => { setToast(t); clearTimeout(tt); tt = setTimeout(() => setToast(''), 2500); };
    return () => { clearTimeout(tt); };
  }, []);
  useEffect(() => { setShowHelp(true); const t = setTimeout(() => setShowHelp(false), 16000); return () => clearTimeout(t); }, [runId]);
  const touch = touchPref === 'on' || (touchPref === 'auto' && input.isTouch);
  const show = screen !== 'hub'; const w = WEAPONS[weaponId], style = STYLES[styleId];
  const hpPct = h.hp / h.maxHp;
  const sk1 = swap ? w.spec2 : w.spec1, sk2 = swap ? w.spec1 : w.spec2;
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ display: show ? 'block' : 'none' }}>
      <div className="vignette" />
      <div ref={flash} className="absolute inset-0" style={{ opacity: 0 }} />
      {hpPct < .3 && screen === 'playing' && <div className="absolute inset-0" style={{ boxShadow: 'inset 0 0 120px rgba(255,0,30,.5)', animation: 'pulseGlow 1s infinite' }} />}
      <div ref={layer} className="absolute inset-0 overflow-hidden" />
      <LockMarker />
      {/* vitals */}
      <div className="absolute left-3 top-3 md:left-6 md:top-5 w-[min(420px,70vw)]">
        <div className="flex items-center gap-2 mb-1"><span className="text-xl" style={{ filter: `drop-shadow(0 0 6px ${hex(style.color)})` }}>{style.icon}</span>
          <div className="leading-tight"><div className="disp text-xs font-black" style={{ color: hex(w.color2), textShadow: `0 0 10px ${hex(w.color)}` }}>{w.name}</div><div className="text-[9px] tracking-[.3em] text-zinc-400 uppercase">{style.name}{h.awkOn ? ' · AWAKENED' : ''}</div></div></div>
        <Meter v={h.hp} max={h.maxHp} color="linear-gradient(90deg,#ff2a44,#ff7a5a)" trail="#ffd0d0" h={16} />
        <div className="mt-1 w-[78%]"><Meter v={h.stam} max={h.maxStam} color="linear-gradient(90deg,#41d96b,#d9f06a)" h={7} /></div>
        <div className="mt-1.5 w-[88%] flex gap-2 items-center"><div className="flex-1"><Meter v={h.ult} max={100} color="linear-gradient(90deg,#ff9a1a,#ffe27a)" h={9} glow={h.ult >= 100} /></div><span className="text-[9px] font-bold tracking-widest" style={{ color: h.ult >= 100 ? '#ffe27a' : '#8a7' }}>{h.ult >= 100 ? `[${keyLabel(keys.ult)}] ULT` : 'ULT'}</span></div>
        <div className="mt-1 w-[70%] flex gap-2 items-center"><div className="flex-1"><Meter v={h.awkOn ? 100 : h.awk} max={100} color={h.awkOn ? 'linear-gradient(90deg,#fff,#58d8ff)' : 'linear-gradient(90deg,#2a7fff,#58d8ff)'} h={6} glow={h.awk >= 100 && !h.awkOn} /></div><span className="text-[9px] font-bold tracking-widest text-cyan-300">{h.awk >= 100 && !h.awkOn ? `[${keyLabel(keys.awaken)}] AWAKEN` : h.awkOn ? 'AWAKENED' : 'AWK'}</span></div>
      </div>
      {/* top center info */}
      <div className="absolute left-1/2 -translate-x-1/2 top-3 md:top-5 text-center">
        <div className="disp text-[11px] md:text-sm tracking-[.4em] text-amber-300 font-bold">{h.wave}</div>
        <div className="disp text-2xl md:text-3xl font-black tabular-nums" style={{ textShadow: '0 0 14px rgba(255,200,80,.5)' }}>{h.score.toLocaleString()}</div>
        {!h.training && <div className="text-[10px] tracking-[.3em] text-zinc-400 uppercase">{h.left} foes remain</div>}
        {h.target && !h.boss && <div className="mt-2 w-56 mx-auto"><div className="text-[10px] tracking-widest uppercase text-zinc-300 flex justify-between"><span>{h.lock ? '◎ ' : ''}{h.target.name}</span><span>{h.target.frozen ? '❄' : ''}</span></div><Meter v={h.target.hp} max={h.target.max} color="linear-gradient(90deg,#d22,#f66)" h={8} /><div className="mt-0.5"><Meter v={h.target.posture * 100} max={100} color="#ffd34d" h={3} /></div></div>}
      </div>
      {/* pause + mission */}
      <button className="pointer-events-auto absolute right-3 top-3 md:right-6 md:top-5 w-10 h-10 rounded-full border border-white/30 bg-black/50 text-lg grid place-items-center hover:bg-white/10" onClick={() => input.onPause()} aria-label="Pause"><span className="flex gap-1"><i className="block w-1 h-4 bg-white" /><i className="block w-1 h-4 bg-white" /></span></button>
      {h.objective.length > 0 && <div className="absolute right-3 md:right-6 top-16 panel p-2 text-[11px] max-w-[260px] space-y-0.5"><div className="disp text-amber-300 text-[10px]">Weapon mastery</div>{h.objective.map(o => <div key={o}>{o}</div>)}</div>}
      {/* combo */}
      {h.combo >= 2 && <div className="absolute right-4 md:right-10 top-1/3 text-right">
        <div className="disp font-black leading-none tabular-nums" style={{ fontSize: `clamp(2.2rem, ${3 + Math.min(h.combo, 60) * .04}vw, 4.2rem)`, color: '#fff', textShadow: `0 0 18px ${rankColor[h.rank]}` }}>{h.combo}<span className="text-sm ml-1 tracking-[.3em]">HITS</span></div>
        <div className="disp font-black text-4xl" style={{ color: rankColor[h.rank], textShadow: `0 0 20px ${rankColor[h.rank]}` }}>{h.rank}</div>
        <div className="h-1 w-28 ml-auto bg-black/60"><div className="h-full" style={{ width: (h.comboT / 2.8) * 100 + '%', background: rankColor[h.rank] }} /></div>
        {h.chain > 1 && <div className="text-xs tracking-widest text-amber-300 mt-1">DEFLECT CHAIN ×{h.chain}</div>}</div>}
      {/* boss */}
      {h.boss && <div className={`absolute left-1/2 -translate-x-1/2 ${touch ? 'top-24 w-[min(420px,60vw)]' : 'bottom-6 md:bottom-8 w-[min(780px,88vw)]'}`}>
        <div className="flex justify-between items-end"><span className="disp font-black text-sm md:text-lg text-red-200" style={{ textShadow: '0 0 14px #f22' }}>{h.boss.name}</span><span className="text-[10px] tracking-widest text-amber-300">{h.boss.phases > 1 ? 'PHASE ' + (h.boss.phase + 1) + '/' + h.boss.phases : ''}</span></div>
        <div className="relative"><Meter v={h.boss.hp} max={h.boss.max} color="linear-gradient(90deg,#b00,#ff4a3a,#ff9a5a)" trail="#fff" h={16} />
          {h.boss.phases > 1 && Array.from({ length: h.boss.phases - 1 }).map((_, i) => <div key={i} className="absolute top-0 bottom-0 w-px bg-white/70" style={{ left: ((h.boss!.phases - 1 - i) / h.boss!.phases) * 100 + '%' }} />)}</div>
        <div className="mt-1 w-[70%] mx-auto"><Meter v={h.boss.stagger ? 100 : h.boss.posture * 100} max={100} color={h.boss.stagger ? '#fff' : 'linear-gradient(90deg,#c80,#ffd34d)'} h={5} glow={h.boss.stagger} /></div>
        <div className="text-center text-[9px] tracking-[.4em] text-zinc-400 mt-0.5">{h.boss.stagger ? 'POSTURE BROKEN' : 'POSTURE'}</div></div>}
      {h.hint && <div className={`absolute left-1/2 -translate-x-1/2 ${h.boss && !touch ? 'bottom-32' : 'bottom-20 md:bottom-8'} disp text-xs md:text-sm tracking-[.3em] text-amber-200 px-4 py-1 panel ult-ready`}>{h.hint}</div>}
      {/* skills */}
      {!touch && <div className="absolute left-3 bottom-3 md:left-6 md:bottom-5 flex gap-2 items-end">
        <Skill k={keyLabel(keys.spec1)} label={sk1.name.split(' ').slice(-1)[0]} cd={h.cds[0]} color={hex(w.color)} />
        <Skill k={keyLabel(keys.spec2)} label={sk2.name.split(' ').slice(-1)[0]} cd={h.cds[1]} color={hex(w.color)} />
        <Skill k={keyLabel(keys.dodge)} label="Dodge" cd={Math.min(1, h.cds[2] * 5)} color="#58d8ff" />
        <Skill k={keyLabel(keys.deflect)} label="Deflect" cd={Math.min(1, h.deflectCd * 3)} color="#ffd34d" />
      </div>}
      {/* popups */}
      {pop && <div key={pop.id} className={pop.kind === 'perfect' ? 'pop-perfect text-center' : 'pop-gold'}>{pop.text}{pop.sub && <span className="pop-sub">{pop.sub}</span>}</div>}
      {pop2 && <div key={pop2.id} className={pop2.kind === 'normal' ? 'pop-normal' : pop2.kind === 'warn' ? 'pop-warn text-center' : 'pop-cyan'}>{pop2.text}{pop2.sub && <span className="pop-sub">{pop2.sub}</span>}</div>}
      {banner && <div key={banner.id} className="banner"><h1>{banner.t}</h1><p>{banner.s}</p></div>}
      {toast && <div className="absolute left-1/2 -translate-x-1/2 top-24 panel px-4 py-2 text-sm">{toast}</div>}
      {showHelp && screen === 'playing' && !touch && <div className="absolute left-1/2 -translate-x-1/2 bottom-24 md:bottom-28 panel px-4 py-2 text-[11px] text-zinc-300 fade-in text-center leading-6" style={{ opacity: h.boss ? 0 : 1 }}>
        <span className="key">{keyLabel(keys.light)}</span> attack · <span className="key">{keyLabel(keys.heavy)}</span> heavy · <b className="text-amber-300"><span className="key">{keyLabel(keys.deflect)}</span> deflect just before a hit lands = PERFECT → counter</b> · <span className="key">{keyLabel(keys.dodge)}</span> dodge (red ⚠ attacks can't be deflected) · <span className="key">{keyLabel(keys.lock)}</span> lock-on</div>}
    </div>
  );
}
