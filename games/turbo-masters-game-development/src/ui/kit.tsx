import { ReactNode, CSSProperties } from "react";
import { audio } from "../game/audio";

export function Btn({ children, onClick, variant = "primary", disabled, className = "", color, small, style }: {
  children: ReactNode; onClick?: () => void; variant?: "primary" | "ghost" | "danger" | "solid"; disabled?: boolean; className?: string; color?: string; small?: boolean; style?: CSSProperties;
}) {
  const c = color ?? "#17e0ff";
  const base = small ? "px-4 py-1.5 text-sm" : "px-7 py-3 text-base";
  const st: CSSProperties =
    variant === "solid"
      ? { background: `linear-gradient(135deg, ${c}, ${c}aa)`, color: "#04050c", borderColor: c, boxShadow: `0 0 22px ${c}66` }
      : variant === "danger"
        ? { background: "rgba(255,60,60,0.12)", color: "#ff7a7a", borderColor: "#ff4a4a" }
        : variant === "ghost"
          ? { background: "rgba(255,255,255,0.04)", color: "#cfe0ff", borderColor: "rgba(160,190,255,0.3)" }
          : { background: `linear-gradient(135deg, ${c}22, ${c}0a)`, color: "#fff", borderColor: c, boxShadow: `inset 0 0 18px ${c}22` };
  return (
    <button
      disabled={disabled}
      onMouseEnter={() => !disabled && audio.ui("move")}
      onClick={() => {
        if (disabled) { audio.ui("error"); return; }
        audio.ui("select");
        onClick?.();
      }}
      style={{ ...st, ...style }}
      className={`chamfer-sm font-display font-bold uppercase tracking-widest border transition-all duration-150 ${base} ${disabled ? "opacity-40 cursor-not-allowed" : "hover:brightness-125 hover:scale-[1.03] active:scale-95 cursor-pointer"} ${className}`}
    >
      {children}
    </button>
  );
}

export function Panel({ children, className = "", style, color }: { children: ReactNode; className?: string; style?: CSSProperties; color?: string }) {
  return (
    <div className={`glass chamfer ${className}`} style={{ borderColor: color ? color + "55" : undefined, ...style }}>
      {children}
    </div>
  );
}

export function Bar({ label, value, bonus = 0, max = 10, color = "#17e0ff" }: { label: string; value: number; bonus?: number; max?: number; color?: string }) {
  return (
    <div className="flex items-center gap-2 text-[13px] leading-none">
      <div className="w-[74px] uppercase tracking-wider text-slate-300/80">{label}</div>
      <div className="relative flex-1 h-[7px] bg-white/10 skew-x overflow-hidden">
        <div className="absolute inset-y-0 left-0" style={{ width: `${(value / max) * 100}%`, background: color, boxShadow: `0 0 10px ${color}` }} />
        <div className="absolute inset-y-0" style={{ left: `${(value / max) * 100}%`, width: `${(bonus / max) * 100}%`, background: "#ffd21f", boxShadow: "0 0 10px #ffd21f" }} />
      </div>
      <div className="w-8 text-right font-display text-xs">{(value + bonus).toFixed(1)}</div>
    </div>
  );
}

export function Chip({ children, color = "#17e0ff", className = "" }: { children: ReactNode; color?: string; className?: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 text-[11px] font-display uppercase tracking-widest border ${className}`} style={{ borderColor: color + "88", color, background: color + "14" }}>
      {children}
    </span>
  );
}

export function Title({ children, sub, color = "#17e0ff" }: { children: ReactNode; sub?: string; color?: string }) {
  return (
    <div>
      <div className="font-display font-black italic text-3xl md:text-4xl uppercase tracking-wide" style={{ color, textShadow: `0 0 24px ${color}88` }}>
        {children}
      </div>
      {sub && <div className="text-slate-300/70 text-sm tracking-wider uppercase mt-0.5">{sub}</div>}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <span className="inline-block min-w-[22px] text-center px-1.5 py-0.5 text-[11px] font-display bg-white/10 border border-white/25 rounded-sm">{children}</span>;
}
