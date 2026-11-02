import type { ReactNode } from 'react';
import { useGame } from '../game/store';
import { rupee } from '../game/util';

export const inr = rupee;

export function Modal({ title, children, wide, onClose, icon }: { title: string; children: ReactNode; wide?: boolean; onClose?: () => void; icon?: string }) {
  const close = useGame((s) => s.closePanel);
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900/95 text-slate-100 shadow-2xl ${wide ? 'max-w-6xl' : 'max-w-xl'}`}>
        <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-slate-800 to-slate-900 px-5 py-3">
          <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight">{icon && <span className="text-xl">{icon}</span>}{title}</h2>
          <button onClick={onClose ?? close} className="rounded-lg bg-white/10 px-3 py-1 text-sm font-semibold hover:bg-white/20">Close (Esc)</button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export function Btn({ children, onClick, disabled, tone = 'amber', small, className = '' }: { children: ReactNode; onClick?: () => void; disabled?: boolean; tone?: 'amber' | 'green' | 'red' | 'blue' | 'slate'; small?: boolean; className?: string }) {
  const tones = { amber: 'bg-amber-500 text-slate-900 hover:bg-amber-400', green: 'bg-emerald-500 text-slate-900 hover:bg-emerald-400', red: 'bg-rose-500 text-white hover:bg-rose-400', blue: 'bg-sky-500 text-slate-900 hover:bg-sky-400', slate: 'bg-slate-700 text-slate-100 hover:bg-slate-600' };
  return <button disabled={disabled} onClick={onClick} className={`rounded-lg font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${small ? 'px-2.5 py-1 text-xs' : 'px-4 py-2 text-sm'} ${tones[tone]} ${className}`}>{children}</button>;
}

export function Bar({ value, color = 'bg-emerald-400', label, max = 100 }: { value: number; color?: string; label?: string; max?: number }) {
  return (
    <div className="w-full">
      {label && <div className="mb-0.5 flex justify-between text-[11px] text-slate-300"><span>{label}</span><span>{Math.round(value)}</span></div>}
      <div className="h-2 overflow-hidden rounded-full bg-black/40"><div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }} /></div>
    </div>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: string; tone?: 'good' | 'bad' | 'warn' }) {
  const c = tone === 'good' ? 'text-emerald-300' : tone === 'bad' ? 'text-rose-300' : tone === 'warn' ? 'text-amber-300' : 'text-white';
  return <div className="rounded-xl border border-white/10 bg-white/5 p-3"><div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div><div className={`text-xl font-bold ${c}`}>{value}</div>{sub && <div className="text-[11px] text-slate-400">{sub}</div>}</div>;
}

export function Tabs({ tabs, value, onChange }: { tabs: { id: string; label: string; badge?: number }[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="mb-4 flex flex-wrap gap-1 border-b border-white/10 pb-2">
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${value === t.id ? 'bg-amber-500 text-slate-900' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}>
          {t.label}{t.badge ? <span className="ml-1.5 rounded-full bg-rose-500 px-1.5 text-[10px] text-white">{t.badge}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-left text-sm">
        <thead className="bg-white/5 text-[11px] uppercase tracking-wide text-slate-400"><tr>{head.map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-white/5 hover:bg-white/5">{r.map((c, j) => <td key={j} className="px-3 py-1.5 align-top">{c}</td>)}</tr>)}</tbody>
      </table>
      {!rows.length && <div className="p-4 text-center text-sm text-slate-500">Nothing here yet.</div>}
    </div>
  );
}

export function Logo({ shape, icon, color, secondary, size = 64 }: { shape: string; icon: string; color: string; secondary: string; size?: number }) {
  const r = shape === 'circle' ? '50%' : shape === 'square' ? '14%' : shape === 'shield' ? '12% 12% 50% 50%' : '30%';
  return (
    <div style={{ width: size, height: size, background: `linear-gradient(135deg, ${color}, ${color}cc)`, borderRadius: r, border: `${Math.max(2, size / 16)}px solid ${secondary}`, clipPath: shape === 'hex' ? 'polygon(25% 3%, 75% 3%, 100% 50%, 75% 97%, 25% 97%, 0 50%)' : undefined }} className="flex items-center justify-center shadow-lg">
      <span style={{ fontSize: size * 0.5 }}>{icon}</span>
    </div>
  );
}

export function Tshirt({ color, secondary, style, name, size = 120 }: { color: string; secondary: string; style: string; name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <path d="M30 12 L10 26 L20 42 L28 38 L28 90 L72 90 L72 38 L80 42 L90 26 L70 12 Q50 24 30 12Z" fill={color} stroke="#0003" strokeWidth="1.5" />
      {style === 'stripe' && <rect x="28" y="52" width="44" height="8" fill={secondary} />}
      {style === 'chest' && <rect x="36" y="30" width="28" height="10" rx="2" fill={secondary} />}
      <text x="50" y="38" textAnchor="middle" fontSize="6" fontWeight="bold" fill={style === 'chest' ? color : secondary}>{name.slice(0, 10)}</text>
      <path d="M40 12 Q50 22 60 12" fill="none" stroke={secondary} strokeWidth="2" />
    </svg>
  );
}

export const WEATHER_ICON: Record<string, string> = { sunny: '☀️', cloudy: '⛅', lightRain: '🌦️', heavyRain: '🌧️', thunderstorm: '⛈️', fog: '🌫️' };
export const WEATHER_NAME: Record<string, string> = { sunny: 'Sunny', cloudy: 'Cloudy', lightRain: 'Light rain', heavyRain: 'Heavy rain', thunderstorm: 'Thunderstorm', fog: 'Foggy' };
