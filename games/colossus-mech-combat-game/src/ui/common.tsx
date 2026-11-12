import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { MECHS, STAT_KEYS, levelFromXp, type MechDef } from '../game/data';
import { useStore, isMechUnlocked } from '../game/store';
import { audio } from '../game/audio';

export const click = () => audio.sfx('ui', 1);
export const back = () => audio.sfx('ui_back', 1);
export const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function Btn({ children, onClick, variant = '', disabled, className = '', sm, center, title }: { children: ReactNode; onClick?: () => void; variant?: string; disabled?: boolean; className?: string; sm?: boolean; center?: boolean; title?: string }) {
  return <button title={title} disabled={disabled} data-ui className={`btn ${variant} ${sm ? 'sm' : ''} ${center ? 'center' : ''} ${className}`} onClick={() => { if (!disabled) { click(); onClick?.(); } }} onMouseEnter={() => !disabled && audio.sfx('servo', 0.5)}>{children}</button>;
}
export function Panel({ title, children, className = '', right }: { title?: string; children: ReactNode; className?: string; right?: ReactNode }) {
  return <div data-ui className={`panel cut ${className}`}>{title && <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-cyan-400/20"><span className="h-label">{title}</span>{right}</div>}<div className="p-4">{children}</div></div>;
}
export function Bar({ value, max, color = '#4fd8ff', h = 8, label, text }: { value: number; max: number; color?: string; h?: number; label?: string; text?: string }) {
  const p = Math.max(0, Math.min(1, value / (max || 1)));
  return <div>{label && <div className="flex justify-between h-label mb-1"><span>{label}</span><span>{text}</span></div>}<div className="w-full cut-sm" style={{ height: h, background: 'rgba(255,255,255,.1)' }}><div style={{ width: `${p * 100}%`, height: '100%', background: `linear-gradient(90deg, ${color}, ${color}cc)`, boxShadow: `0 0 10px ${color}`, transition: 'width .2s' }} /></div></div>;
}
export function StatBars({ stats }: { stats: Record<string, number> }) {
  return <div className="grid gap-2">{STAT_KEYS.map(k => <div key={k} className="flex items-center gap-3"><span className="h-label w-20">{k}</span><div className="flex-1 flex gap-1">{Array.from({ length: 10 }).map((_, i) => <div key={i} className="h-2 flex-1" style={{ background: i < stats[k] ? (stats[k] >= 9 ? '#ffb23a' : '#4fd8ff') : 'rgba(255,255,255,.1)', boxShadow: i < stats[k] ? '0 0 6px rgba(79,216,255,.6)' : 'none' }} />)}</div><span className="w-5 text-right text-sm font-bold">{stats[k]}</span></div>)}</div>;
}
export function ScreenHeader({ title, sub, onBack }: { title: string; sub?: string; onBack: () => void }) {
  return <div className="flex items-end justify-between gap-4 mb-4"><div><div className="h-label">{sub}</div><h2 className="text-3xl md:text-4xl font-black tracking-[.18em] uppercase glow-text">{title}</h2></div><Btn onClick={() => { back(); onBack(); }} className="shrink-0">◂ Back</Btn></div>;
}
export function Screen({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <motion.div className={`absolute inset-0 z-10 flex flex-col p-4 md:p-8 ${className}`} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.28 }}><div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/80 via-black/50 to-black/20 pointer-events-none" />{children}</motion.div>;
}
export function MechCards({ selected, onSelect, showBuy, compact }: { selected: string; onSelect: (id: string) => void; showBuy?: boolean; compact?: boolean }) {
  const profile = useStore(s => s.profile); const buy = useStore(s => s.buyMech); const toast = useStore(s => s.toast);
  return <div className={`grid gap-2 ${compact ? 'grid-cols-2 md:grid-cols-5' : 'grid-cols-2'}`}>{MECHS.map((m: MechDef) => {
    const un = isMechUnlocked(profile, m);
    return <div key={m.id} data-ui className={`card panel cut-sm p-2 ${selected === m.id ? 'sel' : ''} ${un ? '' : 'locked'}`} onClick={() => { click(); if (un) onSelect(m.id); else if (!showBuy) toast('LOCKED', `${m.name}: complete mission ${m.unlockAfter} or buy in the Hangar.`); else onSelect(m.id); }}>
      <div className="flex items-center gap-2"><div className="w-3 h-8 shrink-0" style={{ background: `linear-gradient(${m.primary},${m.accent})`, boxShadow: `0 0 8px ${m.glow}` }} /><div className="min-w-0"><div className="font-black text-[.78rem] tracking-wider truncate">{un ? '' : '🔒 '}{m.name}</div><div className="h-label !tracking-[.12em] truncate">{m.role}</div></div></div>
      {!compact && <div className="mt-1 text-[.65rem] opacity-70">{un ? `MECH LV ${levelFromXp(profile.mechs[m.id].xp).level}` : `Mission ${m.unlockAfter} · ${m.price.toLocaleString()} cr`}</div>}
    </div>;
  })}{void buy}</div>;
}
