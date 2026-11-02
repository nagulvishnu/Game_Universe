import type { ReactNode, ButtonHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';
import type { Settings } from '@/game/save';

export const ktOf = (ms: number) => ms * 1.94384;
export const ftOf = (m: number) => m * 3.28084;

export function speedStr(ms: number, u: Settings['units']) {
  return Math.round(u === 'aviation' ? ms * 1.94384 : ms * 3.6);
}
export const speedUnit = (u: Settings['units']) => (u === 'aviation' ? 'KT' : 'KM/H');
export const altStr = (m: number, u: Settings['units']) => Math.round(u === 'aviation' ? m * 3.28084 : m);
export const altUnit = (u: Settings['units']) => (u === 'aviation' ? 'FT' : 'M');
export const vsStr = (ms: number, u: Settings['units']) => Math.round(u === 'aviation' ? ms * 196.85 : ms * 10) / (u === 'aviation' ? 1 : 10);

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-2xl border border-white/10 bg-slate-950/70 backdrop-blur-md shadow-2xl shadow-black/40', className)}>{children}</div>;
}

export function Btn({ className, variant = 'primary', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' | 'amber' }) {
  const v = {
    primary: 'bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-lg shadow-sky-500/30',
    amber: 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-lg shadow-amber-400/30',
    ghost: 'bg-white/10 hover:bg-white/20 text-white border border-white/10',
    danger: 'bg-rose-500 hover:bg-rose-400 text-white',
  }[variant];
  return (
    <button
      {...p}
      className={cn('px-5 py-2.5 rounded-xl font-bold tracking-wider uppercase text-sm transition active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer', v, className)}
    />
  );
}

export function Bar({ value, color = '#38bdf8', className, label, right }: { value: number; color?: string; className?: string; label?: string; right?: string }) {
  return (
    <div className={className}>
      {(label || right) && (
        <div className="flex justify-between text-[10px] tracking-widest uppercase text-slate-300 mb-1">
          <span>{label}</span>
          <span>{right}</span>
        </div>
      )}
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full transition-[width] duration-200" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }} />
      </div>
    </div>
  );
}

export function Stars({ n, max = 3, size = 'text-xl' }: { n: number; max?: number; size?: string }) {
  return (
    <span className={cn('tracking-widest', size)}>
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={i < n ? 'text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.8)]' : 'text-white/20'}>
          ★
        </span>
      ))}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="px-1.5 py-0.5 rounded-md bg-white/10 border border-white/20 text-[11px] font-mono text-sky-200">{children}</kbd>;
}

export const fmtMoney = (n: number) => `$${n.toLocaleString()}`;
