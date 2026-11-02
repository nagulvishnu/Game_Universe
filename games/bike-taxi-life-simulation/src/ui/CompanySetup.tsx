import { useState } from 'react';
import { useGame } from '../game/store';
import { Btn, inr, Logo, Tshirt } from './common';
import { REGISTRATION_COSTS, REGISTRATION_TOTAL, SAVINGS_TARGET } from '../game/data';
import { registerCompany, validateCompanyName } from '../game/logic/company';
import type { Branding } from '../game/types';

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#111827', '#0f766e'];
const ICONS = ['🛵', '🏍️', '⚡', '🚀', '🦅', '🐅', '⭐', '🔥', '🌴', '🛣️'];

export function CompanySetup() {
  const g = useGame((s) => s.g)!;
  const act = useGame((s) => s.act);
  const toast = useGame((s) => s.toast);
  const close = useGame((s) => s.closePanel);
  const [b, setB] = useState<Branding>({ name: '', tagline: 'Ride safe. Ride on time.', primary: '#ef4444', secondary: '#ffffff', logoShape: 'shield', logoIcon: '🏍️', uniformStyle: 'stripe', shirt: '#ef4444' });
  const set = (p: Partial<Branding>) => setB((x) => ({ ...x, ...p }));
  const unlocked = g.savings >= SAVINGS_TARGET;
  const err = b.name ? validateCompanyName(b.name) : 'Enter a company name';
  const remaining = g.savings - REGISTRATION_TOTAL;
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div className="space-y-3">
        {!unlocked && <div className="rounded-xl border border-rose-400/50 bg-rose-500/10 p-3 text-sm text-rose-200">🔒 Registration is locked. Your personal savings are {inr(g.savings)} — you need {inr(SAVINGS_TARGET)}. Keep riding and transfer money into savings (phone → Bank).</div>}
        <label className="block text-xs text-slate-400">Company name<input value={b.name} onChange={(e) => set({ name: e.target.value })} className="mt-1 w-full rounded-lg bg-black/40 px-3 py-2 text-base text-white" placeholder="e.g. Rocket Pillion" maxLength={28} /></label>
        {b.name && err && <div className="text-xs text-rose-300">{err}</div>}
        <label className="block text-xs text-slate-400">Tagline<input value={b.tagline} onChange={(e) => set({ tagline: e.target.value })} className="mt-1 w-full rounded-lg bg-black/40 px-3 py-1.5 text-sm text-white" maxLength={40} /></label>
        <div><div className="mb-1 text-xs text-slate-400">Brand colour</div><div className="flex flex-wrap gap-1.5">{COLORS.map((c) => <button key={c} onClick={() => set({ primary: c, shirt: c })} style={{ background: c }} className={`h-7 w-7 rounded-full border-2 ${b.primary === c ? 'border-white' : 'border-transparent'}`} />)}</div></div>
        <div><div className="mb-1 text-xs text-slate-400">Accent colour</div><div className="flex gap-1.5">{['#ffffff', '#facc15', '#111827', '#e5e7eb'].map((c) => <button key={c} onClick={() => set({ secondary: c })} style={{ background: c }} className={`h-7 w-7 rounded-full border-2 ${b.secondary === c ? 'border-sky-400' : 'border-white/30'}`} />)}</div></div>
        <div><div className="mb-1 text-xs text-slate-400">Logo shape & icon</div><div className="flex flex-wrap gap-1">{(['circle', 'shield', 'hex', 'square'] as const).map((s) => <Btn key={s} small tone={b.logoShape === s ? 'amber' : 'slate'} onClick={() => set({ logoShape: s })}>{s}</Btn>)}</div><div className="mt-1 flex flex-wrap gap-1">{ICONS.map((i) => <button key={i} onClick={() => set({ logoIcon: i })} className={`rounded-lg px-2 py-1 text-xl ${b.logoIcon === i ? 'bg-amber-500' : 'bg-white/10'}`}>{i}</button>)}</div></div>
        <div><div className="mb-1 text-xs text-slate-400">Uniform T-shirt</div><div className="flex flex-wrap gap-1">{(['plain', 'stripe', 'chest'] as const).map((s) => <Btn key={s} small tone={b.uniformStyle === s ? 'amber' : 'slate'} onClick={() => set({ uniformStyle: s })}>{s}</Btn>)}{COLORS.slice(0, 6).map((c) => <button key={c} onClick={() => set({ shirt: c })} style={{ background: c }} className={`h-6 w-6 rounded-full border-2 ${b.shirt === c ? 'border-white' : 'border-transparent'}`} />)}</div></div>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-around rounded-2xl bg-white/5 p-4"><Logo shape={b.logoShape} icon={b.logoIcon} color={b.primary} secondary={b.secondary} size={84} /><Tshirt color={b.shirt} secondary={b.secondary} style={b.uniformStyle} name={b.name || 'Company'} size={110} />
          <div className="rounded-lg px-3 py-2 text-center text-xs font-black text-white" style={{ background: b.primary, border: `3px solid ${b.secondary}` }}>{b.name || 'Your company'}<div className="text-[9px] font-normal opacity-80">HEADQUARTERS</div></div></div>
        <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-sm">
          <b>Setup costs (deducted from personal savings)</b>
          {REGISTRATION_COSTS.map((c) => <div key={c.id} className="mt-1 flex justify-between text-xs"><span className="text-slate-300">{c.label}</span><span>{inr(c.amount)}</span></div>)}
          <div className="mt-2 flex justify-between border-t border-white/10 pt-1 font-bold"><span>Total</span><span>{inr(REGISTRATION_TOTAL)}</span></div>
          <div className="flex justify-between text-xs"><span className="text-slate-300">Your savings</span><span>{inr(g.savings)}</span></div>
          <div className="flex justify-between font-bold text-emerald-300"><span>Starting company capital</span><span>{inr(Math.max(0, remaining))}</span></div>
          <div className="mt-1 text-[11px] text-slate-400">The remainder moves to the new COMPANY bank account. Your personal wallet is not touched.</div>
        </div>
        <Btn disabled={!unlocked || !!err} className="w-full" onClick={() => { const r = act((s) => registerCompany(s, b)); toast(r.message); if (r.ok) close(); }}>🏢 Confirm & register company</Btn>
      </div>
    </div>
  );
}
