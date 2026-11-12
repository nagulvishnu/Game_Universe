import type { ReactNode } from 'react';
import { COURTS, type CourtId } from '../game/constants';
import { courtUnlocked } from '../game/modes';

export function Btn({ children, sub, onClick, primary, ghost, disabled, icon, className = '' }: { children: ReactNode; sub?: string; onClick?: () => void; primary?: boolean; ghost?: boolean; disabled?: boolean; icon?: string; className?: string }) {
  return (
    <button className={`btn ${primary ? 'btn-primary' : ''} ${ghost ? 'btn-ghost' : ''} ${className}`} onClick={onClick} disabled={disabled}>
      {icon && <span className="text-xl leading-none w-7 text-center inline-block shrink-0">{icon}</span>}
      <span className="flex-1">
        {children}
        {sub && <small>{sub}</small>}
      </span>
    </button>
  );
}

export function Chips<T extends string | number | boolean>({ value, options, onChange }: { value: T; options: { v: T; label: string; sub?: string; disabled?: boolean }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={String(o.v)} className="chip" data-on={o.v === value} disabled={o.disabled} style={o.disabled ? { opacity: 0.4 } : undefined} onClick={() => onChange(o.v)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-5">
      <div className="lbl">{label}</div>
      {children}
    </div>
  );
}

export function Screen({ title, sub, onBack, children, width = 760, footer }: { title: string; sub?: string; onBack: () => void; children: ReactNode; width?: number; footer?: ReactNode }) {
  return (
    <div className="absolute inset-0 flex items-stretch justify-center sm:justify-start p-2 sm:p-6 pointer-events-none">
      <div className="glass pointer-events-auto flex flex-col w-full fade-up" style={{ maxWidth: width }}>
        <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-white/10">
          <button className="chip" onClick={onBack} aria-label="Back">
            ◀ Back
          </button>
          <div className="min-w-0">
            <div className="title-font text-2xl leading-none shimmer-text truncate">{title}</div>
            {sub && <div className="text-xs opacity-70 mt-1 truncate">{sub}</div>}
          </div>
        </div>
        <div className="scroll flex-1 px-5 py-4 min-h-0">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-white/10">{footer}</div>}
      </div>
    </div>
  );
}

const hexCss = (c: number) => '#' + c.toString(16).padStart(6, '0');

export function CourtPicker({ value, onChange, champStage }: { value: CourtId; onChange: (id: CourtId) => void; champStage: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {COURTS.map((c) => {
        const open = courtUnlocked(c.id, champStage);
        const on = c.id === value;
        return (
          <button
            key={c.id}
            disabled={!open}
            onClick={() => onChange(c.id)}
            className="relative rounded-xl overflow-hidden text-left transition-transform hover:scale-[1.03]"
            style={{ border: `2px solid ${on ? '#c6ff3a' : 'rgba(255,255,255,0.15)'}`, boxShadow: on ? '0 0 22px rgba(198,255,58,.45)' : 'none', opacity: open ? 1 : 0.55, cursor: open ? 'pointer' : 'not-allowed' }}
          >
            <div style={{ height: 62, background: `linear-gradient(${hexCss(c.skyTop)}, ${hexCss(c.skyBottom)} 62%, ${hexCss(c.outColor)} 62%)`, position: 'relative' }}>
              <div style={{ position: 'absolute', left: '18%', right: '18%', bottom: 0, height: 26, background: hexCss(c.courtColor), transform: 'perspective(60px) rotateX(35deg)', transformOrigin: 'bottom', borderTop: '2px solid #fff8' }} />
              <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 80% 20%, ${hexCss(c.accent)}55, transparent 55%)` }} />
              {!open && <div className="absolute inset-0 flex items-center justify-center text-2xl bg-black/50">🔒</div>}
            </div>
            <div className="px-2.5 py-2 bg-black/40">
              <div className="text-[13px] font-extrabold leading-tight">{c.name}</div>
              <div className="text-[11px] opacity-70">{open ? c.tagline : `Unlock: Championship stage ${c.unlock}`}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function Logo({ small }: { small?: boolean }) {
  return (
    <div className={`logo-float select-none ${small ? '' : 'mb-4'}`}>
      <div className="flex items-center gap-3">
        <div className="ball-bounce shrink-0" style={{ width: small ? 30 : 46, height: small ? 30 : 46 }}>
          <svg viewBox="0 0 64 64" width="100%" height="100%">
            <defs>
              <radialGradient id="bg" cx="35%" cy="30%">
                <stop offset="0" stopColor="#f4ff9a" />
                <stop offset="1" stopColor="#b6e61c" />
              </radialGradient>
            </defs>
            <circle cx="32" cy="32" r="30" fill="url(#bg)" />
            <path d="M6 22c14 6 38 6 52-4M6 46c14-6 38-6 52 4" stroke="#fff" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          </svg>
        </div>
        <div className="leading-none">
          <div className="title-font" style={{ fontSize: small ? 24 : 40, textShadow: '0 4px 0 rgba(0,0,0,.35)' }}>
            Tennis
          </div>
          <div className="title-font shimmer-text" style={{ fontSize: small ? 22 : 38, marginTop: -2 }}>
            Masters
          </div>
        </div>
      </div>
    </div>
  );
}
