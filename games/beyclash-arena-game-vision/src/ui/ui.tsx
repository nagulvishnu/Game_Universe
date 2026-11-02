import type { ReactNode } from 'react';
import { audio } from '../game/audio/audio';
import type { BeyStats } from '../game/customization/stats';
import type { Look } from '../game/types';

export function Btn({ children, onClick, disabled, kind = '', className = '', title }: { children: ReactNode; onClick?: () => void; disabled?: boolean; kind?: string; className?: string; title?: string }) {
  return (
    <button className={`btn ${kind} ${className}`} disabled={disabled} title={title} onClick={() => { audio.unlock(); audio.click(); onClick?.(); }}>
      <span>{children}</span>
    </button>
  );
}

export function Modal({ title, children, onClose, width = 'min(980px, 94vw)', sub, footer }: { title: string; children: ReactNode; onClose?: () => void; width?: string; sub?: string; footer?: ReactNode }) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/55 backdrop-blur-[2px]" onPointerDown={(e) => e.stopPropagation()}>
      <div className="panel slide-up flex max-h-[92vh] flex-col" style={{ width }}>
        <div className="flex items-center justify-between border-b border-cyan-400/30 px-6 py-3">
          <div>
            <div className="title-font shine-text text-3xl leading-none">{title}</div>
            {sub && <div className="mt-1 text-xs text-cyan-200/70">{sub}</div>}
          </div>
          {onClose && <Btn kind="pink sm" onClick={() => { audio.back(); onClose(); }}>Close ✕</Btn>}
        </div>
        <div className="scroll min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="border-t border-cyan-400/30 px-6 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Bar({ value, max = 100, color = '#35d0ff', className = '' }: { value: number; max?: number; color?: string; className?: string }) {
  return (
    <div className={`bar ${className}`}><i style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%`, background: `linear-gradient(90deg, ${color}, #fff8)` }} /></div>
  );
}

export function StatRows({ stats, compare }: { stats: BeyStats; compare?: BeyStats }) {
  const rows: [string, keyof BeyStats, string][] = [
    ['Attack', 'attack', '#ff5a36'], ['Defense', 'defense', '#6f8bff'], ['Stamina', 'stamina', '#38e08c'],
    ['Balance', 'balance', '#ffd24a'], ['Speed', 'speed', '#35d0ff'], ['Burst Res.', 'burstResist', '#ff3d9a'],
  ];
  return (
    <div className="space-y-1.5">
      {rows.map(([label, k, color]) => {
        const v = stats[k] as number;
        const d = compare ? v - (compare[k] as number) : 0;
        return (
          <div key={k} className="flex items-center gap-2 text-xs">
            <div className="w-20 text-right font-bold uppercase tracking-wide text-cyan-100/80">{label}</div>
            <Bar value={v} max={k === 'burstResist' ? 150 : 100} color={color} className="flex-1" />
            <div className="w-16 text-left font-mono">{Math.round(v)}{compare && d !== 0 && <span className={d > 0 ? 'text-emerald-400' : 'text-rose-400'}> {d > 0 ? '+' : ''}{Math.round(d)}</span>}</div>
          </div>
        );
      })}
      <div className="flex items-center gap-2 text-xs"><div className="w-20 text-right font-bold uppercase text-cyan-100/80">Weight</div><div className="font-mono">{Math.round(stats.weight)} g</div></div>
    </div>
  );
}

/** 2D anime-style portrait drawn from the same Look data as the 3D model. */
export function Portrait({ look, size = 160, className = '' }: { look: Look; size?: number; className?: string }) {
  const h = look.hair, hd = '#00000030';
  const st = look.hairStyle;
  return (
    <svg viewBox="0 0 200 220" width={size} height={size * 1.1} className={className}>
      <defs>
        <radialGradient id={`bg${look.top}`} cx="50%" cy="40%"><stop offset="0" stopColor="#3b3a8f" /><stop offset="1" stopColor="#0f0d3a" /></radialGradient>
      </defs>
      <rect width="200" height="220" rx="16" fill={`url(#bg${look.top})`} />
      <path d="M0 40 L200 0 L200 30 L0 90Z" fill="#35d0ff" opacity=".12" />
      {/* back hair */}
      {st === 'long' && <path d="M45 80 Q40 200 55 215 L145 215 Q160 200 155 80Z" fill={h} />}
      {st === 'bob' && <path d="M48 70 Q40 140 60 150 L140 150 Q160 140 152 70Z" fill={h} />}
      {st === 'twin' && (<><path d="M52 70 Q20 130 38 205 Q56 150 62 100Z" fill={h} /><path d="M148 70 Q180 130 162 205 Q144 150 138 100Z" fill={h} /></>)}
      {st === 'ponytail' && <path d="M140 60 Q195 90 175 170 Q150 120 135 95Z" fill={h} />}
      {/* body */}
      <path d="M30 220 Q35 165 100 160 Q165 165 170 220Z" fill={look.top} />
      <path d="M85 160 L100 185 L115 160Z" fill={look.top2} />
      {look.acc === 'scarf' && <path d="M65 150 Q100 175 135 150 L138 168 Q100 190 62 168Z" fill={look.accColor} />}
      <rect x="88" y="135" width="24" height="30" fill={look.skin} />
      <ellipse cx="100" cy="95" rx="50" ry="56" fill={look.skin} />
      <ellipse cx="50" cy="100" rx="7" ry="11" fill={look.skin} /><ellipse cx="150" cy="100" rx="7" ry="11" fill={look.skin} />
      {/* eyes */}
      {[72, 128].map((cx) => (
        <g key={cx}>
          <ellipse cx={cx} cy="100" rx="15" ry="19" fill="#fff" />
          <ellipse cx={cx} cy="102" rx="11" ry="16" fill={look.eyes} />
          <ellipse cx={cx} cy="103" rx="6" ry="10" fill="#15121f" />
          <circle cx={cx + 4} cy="94" r="4" fill="#fff" /><circle cx={cx - 4} cy="110" r="2" fill="#fff" />
          <path d={`M${cx - 17} ${84} Q${cx} ${76} ${cx + 17} ${84}`} stroke={h} strokeWidth="4" fill="none" />
        </g>
      ))}
      <path d="M90 130 Q100 137 110 130" stroke="#a8504a" strokeWidth="3" fill="none" strokeLinecap="round" />
      <ellipse cx="62" cy="122" rx="9" ry="4" fill="#ff8a8a" opacity=".5" /><ellipse cx="138" cy="122" rx="9" ry="4" fill="#ff8a8a" opacity=".5" />
      {/* front hair */}
      <path d="M48 90 Q42 28 100 24 Q158 28 152 90 Q146 60 128 56 Q118 74 100 58 Q84 76 72 56 Q54 62 48 90Z" fill={h} />
      <path d="M62 52 Q100 30 138 52" stroke={hd} strokeWidth="6" fill="none" />
      {st === 'spiky' && [[56, 36, 36, 6], [80, 26, 72, -6], [105, 22, 112, -10], [130, 28, 150, -4], [148, 44, 172, 22]].map(([x, y, tx, ty], i) => <path key={i} d={`M${x - 10} ${y + 18} L${tx} ${ty} L${x + 12} ${y + 20}Z`} fill={h} />)}
      {st === 'mohawk' && [0, 1, 2, 3, 4].map((i) => <path key={i} d={`M${86 + i * 6} 30 L${96 + i * 4} ${-8 + i * 2} L${108 + i * 3} 30Z`} fill={h} />)}
      {st === 'bun' && <circle cx="100" cy="20" r="20" fill={h} />}
      {st === 'swept' && <path d="M60 50 Q130 10 170 70 Q140 50 104 62Z" fill={h} />}
      {/* accessories */}
      {look.acc === 'headband' && <rect x="50" y="54" width="100" height="10" fill={look.accColor} />}
      {look.acc === 'goggles' && (<><rect x="50" y="48" width="100" height="8" fill="#444" /><circle cx="78" cy="46" r="13" fill={look.accColor} stroke="#333" strokeWidth="3" /><circle cx="122" cy="46" r="13" fill={look.accColor} stroke="#333" strokeWidth="3" /></>)}
      {look.acc === 'glasses' && (<><circle cx="72" cy="100" r="20" fill="#9fd6ff" opacity=".25" stroke={look.accColor} strokeWidth="3" /><circle cx="128" cy="100" r="20" fill="#9fd6ff" opacity=".25" stroke={look.accColor} strokeWidth="3" /><path d="M92 100 H108" stroke={look.accColor} strokeWidth="3" /></>)}
      {look.acc === 'cap' && (<><path d="M46 62 Q100 0 154 62Z" fill={look.accColor} /><rect x="40" y="58" width="120" height="9" rx="4" fill={look.accColor} /></>)}
      {look.acc === 'mask' && <path d="M52 112 Q100 150 148 112 L148 130 Q100 170 52 130Z" fill={look.accColor} />}
    </svg>
  );
}
