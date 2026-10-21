import type { ReactNode } from 'react';
import { audio } from '../game/audio/AudioManager';
import type { Rarity } from '../data/weapons';
import { IconArrowLeft } from './Icons';

export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#9aa4b8',
  uncommon: '#55d68a',
  rare: '#4aa3ff',
  epic: '#b06bff',
  legendary: '#ffb000',
  mythic: '#ff3b8d',
};

export function hexStr(n: number): string {
  return '#' + n.toString(16).padStart(6, '0');
}

interface BtnProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'danger' | 'subtle';
  disabled?: boolean;
  className?: string;
  title?: string;
  full?: boolean;
}

export function Button({ children, onClick, variant = 'primary', disabled, className = '', title, full }: BtnProps) {
  const base = 'relative px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.16em] transition-all duration-150 select-none disabled:opacity-40 disabled:cursor-not-allowed';
  const styles: Record<string, string> = {
    primary: 'ss-neon-btn',
    ghost: 'ss-ghost-btn',
    danger: 'border border-rose-500/50 bg-rose-900/40 text-rose-100 hover:bg-rose-800/60 rounded-[10px]',
    subtle: 'bg-transparent text-slate-400 border border-transparent hover:text-cyan-200',
  };
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={() => { if (disabled) return; audio.play('ui'); onClick?.(); }}
      className={`${base} ${styles[variant]} ${full ? 'w-full' : ''} ${className}`}
    >
      {children}
    </button>
  );
}

export function Panel({ children, className = '', title }: { children: ReactNode; className?: string; title?: ReactNode }) {
  return (
    <div className={`ss-panel ${className}`}>
      {title && (
        <div className="border-b border-violet-400/15 px-4 py-2 ss-panel-title">{title}</div>
      )}
      {children}
    </div>
  );
}

export function Bar({ value, max, color = '#ff3b55', height = 10, flip = false, label }: {
  value: number; max: number; color?: string; height?: number; flip?: boolean; label?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div className="relative w-full overflow-hidden rounded-[3px] border border-white/15 bg-black/60" style={{ height }}>
      <div
        className="h-full transition-[width] duration-150 ease-out"
        style={{
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${color}, ${color}aa)`,
          marginLeft: flip ? 'auto' : undefined,
          boxShadow: `0 0 12px ${color}66`,
        }}
      />
      {label && <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white/90">{label}</span>}
    </div>
  );
}

export function ScreenShell({ title, subtitle, onBack, children, right }: {
  title: string; subtitle?: string; onBack: () => void; children: ReactNode; right?: ReactNode;
}) {
  return (
    <div className="ss-grid-bg flex h-full w-full flex-col bg-[#05050a]">
      <header className="flex shrink-0 items-center gap-4 border-b border-violet-400/15 bg-black/50 px-5 py-3 backdrop-blur-sm">
        <Button variant="ghost" onClick={onBack} className="flex items-center gap-2 px-3 py-1.5 text-[11px]">
          <IconArrowLeft size={14} /> Back
        </Button>
        <div className="min-w-0">
          <h1 className="ss-title truncate text-xl uppercase tracking-[0.14em] text-white">{title}</h1>
          {subtitle && <p className="truncate text-[11px] text-slate-400">{subtitle}</p>}
        </div>
        <div className="ml-auto flex items-center gap-3">{right}</div>
      </header>
      <main className="ss-scroll min-h-0 flex-1 overflow-y-auto p-5">{children}</main>
    </div>
  );
}

export function Tag({ children, color = '#8a5aff' }: { children: ReactNode; color?: string }) {
  return (
    <span className="rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
      style={{ borderColor: color + '66', color, background: color + '14' }}>
      {children}
    </span>
  );
}

export function Stat({ label, value, color }: { label: string; value: ReactNode; color?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-white/5 py-1 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="font-semibold" style={{ color: color ?? '#e8e8f2' }}>{value}</span>
    </div>
  );
}
