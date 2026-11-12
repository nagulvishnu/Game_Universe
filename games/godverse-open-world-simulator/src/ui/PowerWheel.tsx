import { useEffect, useState } from 'react';
import { useHud, ref } from '../game/store';
import { CATS, POWERS, POWER_MAP, FORMS } from '../game/types';
import type { Cat } from '../game/types';
import { Icon } from './icons';

const R2D = Math.PI / 180;
const pt = (r: number, a: number) => [r * Math.cos(a * R2D), r * Math.sin(a * R2D)];
function sector(r0: number, r1: number, a0: number, a1: number) {
  const large = a1 - a0 > 180 ? 1 : 0;
  const [x0, y0] = pt(r1, a0), [x1, y1] = pt(r1, a1), [x2, y2] = pt(r0, a1), [x3, y3] = pt(r0, a0);
  return `M ${x0} ${y0} A ${r1} ${r1} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${r0} ${r0} 0 ${large} 0 ${x3} ${y3} Z`;
}

export function PowerWheel() {
  const open = useHud((s) => s.wheelOpen);
  const current = useHud((s) => s.power);
  const unlocked = useHud((s) => s.unlockedPowers);
  const form = useHud((s) => s.form);
  const [cat, setCat] = useState<Cat>(POWER_MAP[current].cat);
  const [hov, setHov] = useState<string | null>(null);

  useEffect(() => { if (open) { setCat(POWER_MAP[current].cat); setHov(null); } }, [open, current]);
  useEffect(() => {
    if (!POWERS.some((power) => power.cat === cat && unlocked.includes(power.id))) {
      const first = POWERS.find((power) => unlocked.includes(power.id));
      if (first) setCat(first.cat);
    }
  }, [cat, unlocked]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const list = POWERS.filter((p) => p.cat === cat && unlocked.includes(p.id));
      if (!list.length) return;
      const idx = list.findIndex((p) => p.id === (hov ?? current));
      if (e.code === 'ArrowRight') setHov(list[(idx + 1 + list.length) % list.length].id);
      else if (e.code === 'ArrowLeft') setHov(list[(idx - 1 + list.length) % list.length].id);
      else if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
        const categories = CATS.filter((c) => POWERS.some((p) => p.cat === c.id && unlocked.includes(p.id)));
        const ci = categories.findIndex((c) => c.id === cat);
        const nc = categories[(ci + (e.code === 'ArrowDown' ? 1 : -1) + categories.length) % categories.length].id;
        setCat(nc); setHov(POWERS.find((p) => p.cat === nc && unlocked.includes(p.id))!.id);
      } else if (e.code === 'Enter' || e.code === 'NumpadEnter') { const id = hov ?? current; ref.game?.powers.select(id); ref.game?.setWheel(false); }
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, cat, hov, current, unlocked]);

  if (!open) return null;
  const list = POWERS.filter((p) => p.cat === cat && unlocked.includes(p.id));
  const categories = CATS.filter((c) => POWERS.some((p) => p.cat === c.id && unlocked.includes(p.id)));
  const catDef = CATS.find((c) => c.id === cat) ?? categories[0];
  if (!list.length || !catDef) return null;
  const shown = POWER_MAP[hov ?? current];
  const choose = (id: string) => { ref.game?.powers.select(id); ref.game?.setWheel(false); };
  const pos = (r: number, a: number) => { const [x, y] = pt(r, a); return { left: `${((300 + x) / 600) * 100}%`, top: `${((300 + y) / 600) * 100}%` }; };

  return (
    <div className="pointer-events-auto absolute inset-0 z-20 grid place-items-center" style={{ background: 'radial-gradient(circle, rgba(6,8,20,0.45), rgba(3,4,10,0.82))', backdropFilter: 'blur(4px)' }} onMouseDown={(e) => { if (e.target === e.currentTarget) ref.game?.setWheel(false); }} role="dialog" aria-modal="true" aria-label="Power selection wheel">
      <div className="flex flex-col items-center">
        <div className="relative" style={{ width: 'min(78vmin, 640px)', height: 'min(78vmin, 640px)', animation: 'wheelIn 0.35s cubic-bezier(.2,.9,.3,1.2) both' }}>
          <svg viewBox="-300 -300 600 600" className="absolute inset-0 h-full w-full overflow-visible">
            <defs>
              <radialGradient id="hub"><stop offset="0" stopColor={shown.color} stopOpacity="0.35" /><stop offset="1" stopColor="#05070f" stopOpacity="0.95" /></radialGradient>
            </defs>
            <circle r="292" fill="none" stroke="rgba(160,180,255,0.12)" strokeDasharray="2 8" style={{ transformOrigin: 'center', animation: 'spin 60s linear infinite' }} />
            {/* categories */}
            {categories.map((c, i) => {
              const n = categories.length, a0 = -90 + (i * 360) / n + 1.2, a1 = -90 + ((i + 1) * 360) / n - 1.2, active = c.id === cat;
              return (
                <path key={c.id} d={sector(84, 160, a0, a1)} role="button" tabIndex={0} aria-label={`${c.name} category`} onMouseEnter={() => { setCat(c.id); setHov(null); }} onClick={() => { setCat(c.id); }} onKeyDown={(e) => { if (e.key === 'Enter') setCat(c.id); }}
                  fill={active ? c.color + '55' : 'rgba(14,18,38,0.82)'} stroke={active ? c.color : 'rgba(160,180,255,0.2)'} strokeWidth={active ? 2.5 : 1} style={{ cursor: 'pointer', filter: active ? `drop-shadow(0 0 10px ${c.color}99)` : undefined, transition: 'all .15s' }} />
              );
            })}
            {/* powers */}
            {list.map((p, i) => {
              const n = list.length, step = 360 / n, a0 = -90 + i * step + 1.4, a1 = -90 + (i + 1) * step - 1.4, active = p.id === current, h = p.id === hov;
              return (
                <path key={p.id} d={sector(170, 268, a0, a1)} role="button" tabIndex={0} aria-label={`${p.name}: ${p.desc}`} onMouseEnter={() => setHov(p.id)} onMouseLeave={() => setHov(null)} onClick={() => choose(p.id)} onKeyDown={(e) => { if (e.key === 'Enter') choose(p.id); }}
                  fill={h ? p.color + '66' : active ? p.color + '33' : 'rgba(14,18,38,0.82)'} stroke={h || active ? p.color : 'rgba(160,180,255,0.18)'} strokeWidth={h ? 3 : active ? 2 : 1} style={{ cursor: 'pointer', filter: h ? `drop-shadow(0 0 14px ${p.color})` : undefined, transition: 'all .12s' }} />
              );
            })}
            <circle r="74" fill="url(#hub)" stroke={shown.color} strokeOpacity="0.6" strokeWidth="2" />
          </svg>
          {categories.map((c, i) => { const mid = -90 + ((i + 0.5) * 360) / categories.length; return <div key={c.id} className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2" style={pos(122, mid)}><Icon name={c.icon} size={26} color={c.id === cat ? '#fff' : c.color} /></div>; })}
          {list.map((p, i) => { const mid = -90 + ((i + 0.5) * 360) / list.length; const p2 = pos(219, mid); return (
            <div key={p.id} className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center" style={p2}>
              <Icon name={p.icon} size={30} color={p.color} />
              <span className="mt-0.5 max-w-[90px] text-center text-[10px] font-bold leading-tight tracking-wide text-white/85">{p.name}</span>
            </div>); })}
          <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center" style={{ width: '24%' }}>
            <Icon name={shown.icon} size={36} color={shown.color} />
            <div className="display mt-1 text-[11px] font-bold leading-tight" style={{ color: shown.color }}>{shown.name}</div>
          </div>
        </div>
        <div className="glass mt-3 w-[min(640px,92vw)] rounded-2xl p-3 text-center">
          <div className="flex items-center justify-center gap-2"><span className="tiny-label" style={{ color: catDef.color }}>{catDef.name}</span><span className="rounded bg-white/10 px-1.5 text-[10px] font-bold tracking-widest text-white/70">{shown.hint}</span></div>
          <div className="mt-0.5 text-[14px] text-white/80">{shown.desc}</div>
          <div className="mt-2 flex items-center justify-center gap-1.5" role="group" aria-label="Transformations">
            {FORMS.map((f, i) => (
              <button key={f.id} onClick={() => ref.game?.setForm(f.id)} title={`${i + 1} · ${f.name}`} aria-label={`Transform: ${f.name}`} aria-pressed={f.id === form}
                className="flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-bold transition hover:scale-105" style={{ borderColor: f.id === form ? f.color : 'rgba(255,255,255,0.12)', background: f.id === form ? f.color + '33' : 'rgba(255,255,255,0.04)', color: f.id === form ? '#fff' : '#b8c4ee' }}>
                <Icon name={f.icon} size={14} color={f.color} /><span className="hidden sm:inline">{f.name.replace(' God', '')}</span>
              </button>
            ))}
          </div>
          <div className="mt-1.5 text-[10px] tracking-widest text-white/40">HOVER · CLICK TO EQUIP · ARROWS + ENTER · Q / ESC TO CLOSE</div>
        </div>
      </div>
    </div>
  );
}
