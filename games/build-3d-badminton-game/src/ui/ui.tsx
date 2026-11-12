import { ReactNode } from 'react';
import { audio } from '../game/audio';
import { cn } from '../utils/cn';

export function Btn({ children, onClick, variant = 'primary', className, disabled, big }: { children: ReactNode; onClick?: () => void; variant?: 'primary' | 'ghost' | 'hot' | 'gold'; className?: string; disabled?: boolean; big?: boolean }) {
  const v = {
    primary: 'bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 shadow-[0_0_24px_rgba(46,230,255,.45)]',
    hot: 'bg-gradient-to-r from-pink-500 to-fuchsia-600 text-white shadow-[0_0_24px_rgba(255,61,154,.5)]',
    gold: 'bg-gradient-to-r from-yellow-300 to-orange-400 text-slate-950 shadow-[0_0_24px_rgba(255,210,63,.5)]',
    ghost: 'bg-white/5 text-slate-100 border border-white/15 hover:bg-white/10',
  }[variant];
  return (
    <button
      disabled={disabled}
      onClick={() => { audio.init(); audio.ui(); onClick?.(); }}
      className={cn('relative overflow-hidden rounded-xl font-display font-extrabold uppercase tracking-wider transition active:scale-95 hover:scale-[1.03] disabled:opacity-40 disabled:pointer-events-none', big ? 'px-8 py-4 text-lg' : 'px-5 py-2.5 text-sm', v, className)}
    >
      {variant !== 'ghost' && <span className="btn-shine pointer-events-none absolute inset-0" />}
      <span className="relative">{children}</span>
    </button>
  );
}

export function Chip({ active, children, onClick, disabled, className }: { active?: boolean; children: ReactNode; onClick?: () => void; disabled?: boolean; className?: string }) {
  return (
    <button
      disabled={disabled}
      onClick={() => { audio.init(); audio.ui(); onClick?.(); }}
      className={cn('rounded-lg border px-3.5 py-2 text-sm font-bold uppercase tracking-wide transition active:scale-95', active ? 'border-cyan-300 bg-cyan-400/20 text-cyan-100 shadow-[0_0_14px_rgba(46,230,255,.45)]' : 'border-white/15 bg-white/5 text-slate-300 hover:bg-white/10', disabled && 'opacity-35', className)}
    >
      {children}
    </button>
  );
}

export function Shell({ title, sub, onBack, children, wide, right }: { title: string; sub?: string; onBack?: () => void; children: ReactNode; wide?: boolean; right?: ReactNode }) {
  return (
    <div className="absolute inset-0 flex items-stretch justify-center bg-gradient-to-b from-[#04050d]/80 via-[#070b1f]/70 to-[#04050d]/90 anim-fade">
      <div className={cn('flex h-full w-full flex-col px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8', wide ? 'max-w-6xl' : 'max-w-4xl')}>
        <div className="mb-3 flex items-center gap-3">
          {onBack && <Btn variant="ghost" onClick={onBack}>← Back</Btn>}
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl font-black uppercase tracking-wide text-white glow-text sm:text-3xl">{title}</h2>
            {sub && <p className="truncate text-sm text-cyan-100/70 sm:text-base">{sub}</p>}
          </div>
          {right}
        </div>
        <div className="scroll-y min-h-0 flex-1 pb-4 pr-1">{children}</div>
      </div>
    </div>
  );
}

export function Panel({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('glass mb-4 rounded-2xl p-4', className)}>
      {title && <h3 className="mb-3 font-display text-xs font-extrabold uppercase tracking-[0.25em] text-cyan-300">{title}</h3>}
      {children}
    </div>
  );
}

export function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="mb-3 flex items-center gap-3">
      <span className="w-24 text-sm font-bold uppercase tracking-wide text-slate-200">{label}</span>
      <input type="range" min={0} max={1} step={0.01} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="h-2 flex-1 cursor-pointer" style={{ touchAction: 'pan-y' }} />
      <span className="w-10 text-right font-display text-xs text-cyan-200">{Math.round(value * 100)}</span>
    </label>
  );
}

export const ARENA_GRAD: Record<string, string> = {
  neon: 'linear-gradient(135deg,#0b1030 0%,#1346a8 55%,#ff2d95 100%)',
  royal: 'linear-gradient(135deg,#4a0f1a 0%,#c98f4f 60%,#f3e8c8 100%)',
  tropical: 'linear-gradient(135deg,#8fdcff 0%,#14a89a 60%,#ffd166 100%)',
  cyber: 'linear-gradient(135deg,#03010a 0%,#7c4dff 55%,#00ffd5 100%)',
  mountain: 'linear-gradient(135deg,#a9d3f0 0%,#d6a65f 60%,#1f5f3a 100%)',
  grand: 'linear-gradient(135deg,#080c18 0%,#1c8c52 60%,#3b82f6 100%)',
};

export function fmtTime(s: number) {
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, '0')}`;
}

export function Confetti() {
  const cols = ['#ffd23f', '#ff3d9a', '#2ee6ff', '#c6ff3d', '#b46bff'];
  return (
    <>
      {Array.from({ length: 46 }).map((_, i) => (
        <span key={i} className="confetti" style={{ left: `${(i * 37) % 100}%`, background: cols[i % cols.length], animationDuration: `${2.6 + (i % 7) * 0.45}s`, animationDelay: `${(i % 11) * 0.22}s` }} />
      ))}
    </>
  );
}
