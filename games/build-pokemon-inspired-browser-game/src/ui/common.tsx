import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { TYPE_COLOR, TYPE_ICON, maxHp, type Mon, type TypeId } from '../game/data';
import { drawMonster } from '../game/art';
import type { Game } from '../game/engine';

export const GameCtx = createContext<Game | null>(null);
export const useG = () => useContext(GameCtx)!;

export function MonCanvas({ sp, size = 80, mega = false, animate = false, facing = 1, dim = false }: {
  sp: string; size?: number; mega?: boolean; animate?: boolean; facing?: 1 | -1; dim?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(size * 1.3), h = Math.round(size * 1.15);
    cv.width = w * dpr; cv.height = h * dpr;
    const ctx = cv.getContext('2d')!;
    let raf = 0; let t0 = performance.now();
    const draw = (t: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      drawMonster(ctx, sp, w / 2, h - size * 0.1, size * 0.92, { t, facing, mega, alpha: dim ? 0.45 : 1 });
    };
    if (animate) {
      const loop = (now: number) => { draw((now - t0) / 1000); raf = requestAnimationFrame(loop); };
      raf = requestAnimationFrame(loop);
    } else draw(0.5);
    void t0;
    return () => cancelAnimationFrame(raf);
  }, [sp, size, mega, animate, facing, dim]);
  return <canvas ref={ref} style={{ width: size * 1.3, height: size * 1.15 }} className="block shrink-0" />;
}

export function TypeChip({ t, small = false }: { t: TypeId; small?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-extrabold uppercase tracking-wide text-[#1d1a33] ${small ? 'px-1.5 py-0 text-[9px]' : 'px-2 py-0.5 text-[10px]'}`}
      style={{ background: TYPE_COLOR[t] }}
    >
      <span>{TYPE_ICON[t]}</span>{t}
    </span>
  );
}

export function HpBar({ mon, className = '' }: { mon: Mon; className?: string }) {
  const mx = maxHp(mon); const r = Math.max(0, Math.min(1, mon.hp / mx));
  return (
    <div className={className}>
      <div className="h-2.5 rounded-full bg-[#0b0a1e] p-[2px]">
        <div className="h-full rounded-full transition-all" style={{ width: `${r * 100}%`, background: r > 0.5 ? '#5fe070' : r > 0.2 ? '#ffd23f' : '#ff4a4a' }} />
      </div>
      <div className="mt-0.5 text-right text-[10px] font-bold text-[#cfd6ff]">{mon.hp} / {mx}</div>
    </div>
  );
}

export function Modal({ title, onClose, children, wide = false, footer }: { title: string; onClose?: () => void; children: ReactNode; wide?: boolean; footer?: ReactNode }) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#07061a]/70 p-2 backdrop-blur-[2px] sm:p-4" onPointerDown={(e) => e.stopPropagation()}>
      <div className={`panel anim-pop flex max-h-full w-full flex-col ${wide ? 'max-w-3xl' : 'max-w-xl'}`}>
        <div className="flex items-center justify-between gap-2 border-b-2 border-[#0b0a1e] px-3 py-2 sm:px-4">
          <h2 className="pixel text-[11px] text-[#ffd23f] sm:text-sm">{title}</h2>
          {onClose && <button className="btn btn-red !px-3 !py-1 text-sm" onClick={onClose} aria-label="Close">✕</button>}
        </div>
        <div className="scroll-y min-h-0 flex-1 p-2 sm:p-3">{children}</div>
        {footer && <div className="border-t-2 border-[#0b0a1e] px-3 py-2">{footer}</div>}
      </div>
    </div>
  );
}
