import type { FareBreakdown } from '../game/types';
import { inr } from './common';

export function FareView({ f, title, compact }: { f: FareBreakdown; title?: string; compact?: boolean }) {
  const row = (l: string, v: number, sub?: string, key?: string) => v !== 0 && (
    <div key={key ?? l} className="flex justify-between"><span className="text-slate-300">{l}{sub && <span className="ml-1 text-[10px] text-slate-500">{sub}</span>}</span><span className="tabular-nums">{v < 0 ? '-' : ''}{inr(Math.abs(v))}</span></div>
  );
  return (
    <div className={`rounded-xl border border-white/10 bg-black/30 ${compact ? 'p-2 text-[11px]' : 'p-3 text-xs'}`}>
      {title && <div className="mb-1 font-bold text-amber-300">{title}</div>}
      <div className="space-y-0.5">
        {row('Base fare', f.base)}
        {row('Distance', f.distance, `${f.distanceKm} km × ₹${f.perKm}`)}
        {row('Time', f.time, `${f.durationMin} min × ₹${f.perMin}`)}
        {row(f.demand >= 0 ? 'Demand adjustment' : 'Quiet-period discount', f.demand, `${Math.round(f.demandPct * 100)}%`)}
        {f.surcharges.map((s) => row(s.label, s.amount, undefined, s.code))}
        {row('Waiting charge', f.waiting, f.waitMinutes ? `${f.waitMinutes} paid min` : undefined)}
        {row('Minimum fare adjustment', f.minimumAdjustment)}
        {row('Price protection', f.protectionAdjustment)}
      </div>
      <div className="mt-1 flex justify-between border-t border-white/10 pt-1 text-sm font-black"><span>Total</span><span className="text-emerald-300">{inr(f.total)}</span></div>
      {f.notes.length > 0 && <div className="mt-1 text-[10px] text-slate-400">{f.notes.join(' · ')}</div>}
    </div>
  );
}
