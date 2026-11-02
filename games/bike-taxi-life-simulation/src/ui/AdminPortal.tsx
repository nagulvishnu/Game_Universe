import { useState } from 'react';
import { useGame } from '../game/store';
import { Bar, Btn, inr, Logo, Modal, Stat, Table, Tabs } from './common';
import { FareView } from './FareView';
import { BIKE_MODELS, COMPANY_MODEL_MAX_PRICE, modelOf, ROLE_INFO } from '../game/data';
import { approveApplicant, branchCost, branchRequirements, buyCompanyBike, decideLeave, interviewApplicant, openBranch, outstandingLoans, ownerDraw, rejectApplicant, renewEmployeeLicence, separateEmployee, serviceCompanyBike, serviceCost, setEmployeeShift, setInsurance, PREMIUM } from '../game/logic/company';
import { licenceStatusText, licenceValid, riderEligibility, verifyLicence } from '../game/logic/people';
import { resolveComplaint } from '../game/logic/rides';
import { bikeCondition, companyRating, dayNow, depositLiability } from '../game/state';
import { DISTRICT_ORDER, DISTRICTS, poiById } from '../game/world/city';
import { DemandAnalyzer } from '../game/fare/DemandAnalyzer';
import { DynamicPricingController } from '../game/fare/DynamicPricingController';
import { FARE_RULES } from '../game/fare/rules';
import { awareness, companyShare, demandPerHour } from '../game/logic/sim';
import { fmtTime, dayName } from '../game/util';
import type { Branding, GameState, RideRecord, ShiftType } from '../game/types';

const CAPEX = ['bike-purchase', 'registration', 'branch-setup'];
function pl(g: GameState, days: number) {
  const from = g.time - days * 1440;
  const e = g.ledger.filter((l) => l.account === 'company' && l.time >= from);
  const sumBy = (f: (l: typeof e[number]) => boolean) => { const m: Record<string, number> = {}; e.filter(f).forEach((l) => { m[l.category] = (m[l.category] ?? 0) + l.amount; }); return m; };
  const income = sumBy((l) => l.kind === 'income');
  const opex = sumBy((l) => l.kind === 'expense' && !CAPEX.includes(l.category));
  const capex = sumBy((l) => l.kind === 'expense' && CAPEX.includes(l.category));
  const fin = sumBy((l) => l.kind === 'financing' || l.kind === 'liability' || l.kind === 'capital');
  const tot = (m: Record<string, number>) => Object.values(m).reduce((a, b) => a + b, 0);
  return { income, opex, capex, fin, ti: tot(income), to: -tot(opex), tc: -tot(capex), profit: tot(income) + tot(opex) };
}
const Kv = ({ m, neg }: { m: Record<string, number>; neg?: boolean }) => <div className="space-y-0.5 text-xs">{Object.entries(m).map(([k, v]) => <div key={k} className="flex justify-between"><span className="text-slate-300">{k}</span><span className="tabular-nums">{inr(neg ? -v : v)}</span></div>)}{!Object.keys(m).length && <span className="text-slate-500">—</span>}</div>;

export function AdminPortal() {
  const g = useGame((s) => s.g)!;
  const ui = useGame((s) => s.ui);
  const act = useGame((s) => s.act);
  const toast = useGame((s) => s.toast);
  const c = g.company;
  const [tab, setTab] = useState(ui.panelArg === 'fleet' ? 'fleet' : ui.panelArg === 'recruit' ? 'recruit' : ui.panelArg === 'branches' ? 'branches' : 'overview');
  const [view, setView] = useState<string | null>(null);
  const [selRide, setSelRide] = useState<RideRecord | null>(null);
  const [draw, setDraw] = useState('10000');
  const [newModel, setNewModel] = useState('kaveri100');
  const [newBranch, setNewBranch] = useState('hq');
  const [refund] = useState('0');
  const [apBranch, setApBranch] = useState('hq');
  const [apShift, setApShift] = useState<ShiftType>('flex');
  const [notes, setNotes] = useState<Record<string, string>>({});
  if (!c) return <Modal title="Admin portal"><p>Register a company first.</p></Modal>;
  const day = dayNow(g);
  const P30 = pl(g, 30);
  const active = c.employees.filter((e) => e.status !== 'resigned' && e.status !== 'terminated');
  const riders = active.filter((e) => e.role === 'rider');
  const liab = depositLiability(g);
  const res = (r: { ok: boolean; message: string }) => toast((r.ok ? '✓ ' : '✗ ') + r.message);
  const live = g.rides.filter((r) => r.driverType === 'employee' && ['requested', 'enroute', 'arrived', 'inprogress'].includes(r.status));
  const lastCo = [...g.ledger].reverse().find((l) => l.account === 'company');
  const openBranches = c.branches.filter((b) => b.status === 'open');
  const unresolved = c.complaints.filter((x) => !x.resolved);
  const tabs = [
    { id: 'overview', label: 'Overview' }, { id: 'finance', label: 'Finance' }, { id: 'employees', label: 'Employees' }, { id: 'recruit', label: 'Recruitment', badge: c.applicants.length }, { id: 'fleet', label: 'Fleet' },
    { id: 'branches', label: 'Branches' }, { id: 'loans', label: 'Loans & EMI' }, { id: 'customers', label: 'Customers', badge: unresolved.length }, { id: 'market', label: 'Market' }, { id: 'pricing', label: 'Pricing 🔒' },
  ];
  const empView = view ? c.employees.find((e) => e.id === view) : null;

  return (
    <Modal title={`${c.branding.name} — Admin portal`} icon="📊" wide>
      <div className="mb-3 flex items-center gap-3"><Logo shape={c.branding.logoShape} icon={c.branding.logoIcon} color={c.branding.primary} secondary={c.branding.secondary} size={44} /><div className="text-xs text-slate-400">Owner access · Day {day + 1} · {fmtTime(g.time)} · {c.branches.length} branch(es)</div></div>
      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Stat label="Company bank" value={inr(c.bank)} tone={c.bank < 0 ? 'bad' : undefined} sub="separate from personal" /><Stat label="Deposit liability" value={inr(liab)} tone="warn" sub="refundable — not profit" /><Stat label="Cash after liabilities" value={inr(c.bank - liab)} tone={c.bank - liab < 0 ? 'bad' : 'good'} /><Stat label="Outstanding loans" value={inr(outstandingLoans(c))} />
            <Stat label="Revenue (30d)" value={inr(P30.ti)} tone="good" /><Stat label="Operating costs (30d)" value={inr(P30.to)} /><Stat label="Operating profit (30d)" value={inr(P30.profit)} tone={P30.profit >= 0 ? 'good' : 'bad'} /><Stat label="Company rides" value={c.ridesTotal} />
            <Stat label="Reputation" value={`${c.reputation.toFixed(1)}/100`} tone={c.reputation < 40 ? 'bad' : 'good'} /><Stat label="Customer rating" value={`★ ${companyRating(g).toFixed(2)}`} sub={`${c.ratingCount} ratings`} /><Stat label="Credit score" value={c.credit} tone={c.credit < 550 ? 'bad' : undefined} /><Stat label="Riders online" value={`${riders.filter((e) => e.online).length}/${riders.length}`} />
          </div>
          <div><b className="text-sm">Live operations</b><Table head={['Ride', 'Branch', 'Driver', 'Status', 'Fare est.']} rows={live.slice(0, 10).map((r) => [`${r.pickup.label.split(' #')[0]} → ${r.dest.label.split(' #')[0]}`, c.branches.find((b) => b.id === r.branchId)?.name.split('—').pop() ?? '—', c.employees.find((e) => e.id === r.driverId)?.name ?? 'Searching…', r.status, inr(r.estimate.total)])} /></div>
          {(c.bank < 0 || unresolved.length > 0 || c.loans.some((l) => l.overdueCount > 0)) && <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 p-3 text-xs text-rose-200">{c.bank < 0 && <div>⚠ Company account overdrawn.</div>}{c.loans.some((l) => l.overdueCount > 0) && <div>⚠ Overdue EMI — top up the company account; it is retried automatically.</div>}{unresolved.length > 0 && <div>⚠ {unresolved.length} unresolved customer complaint(s).</div>}</div>}
          <div className="text-[11px] text-slate-400">Staff effects: mechanic ↓ service costs 20% & auto-services · receptionist ↑ demand 5% · accountant ↓ taxes 25% · support auto-resolves complaints · HR doubles applicants · branch managers run branch maintenance.</div>
        </div>
      )}

      {tab === 'finance' && (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl bg-white/5 p-3"><b className="text-emerald-300">Income (30 days)</b><Kv m={P30.income} /><div className="mt-1 border-t border-white/10 pt-1 text-sm font-bold">{inr(P30.ti)}</div></div>
            <div className="rounded-xl bg-white/5 p-3"><b className="text-amber-300">Operating expenses</b><Kv m={P30.opex} neg /><div className="mt-1 border-t border-white/10 pt-1 text-sm font-bold">{inr(P30.to)}</div></div>
            <div className="rounded-xl bg-white/5 p-3"><b className="text-sky-300">Capex & financing (not profit)</b><Kv m={P30.capex} neg /><Kv m={P30.fin} /><div className="mt-1 text-[10px] text-slate-400">Bike purchases, loan proceeds/principal, owner draws and refundable deposits are excluded from profit.</div></div>
          </div>
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white/5 p-3 text-sm"><b>Operating profit (30d): <span className={P30.profit >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{inr(P30.profit)}</span></b><span className="text-xs text-slate-400">Ledger check: {lastCo && lastCo.balanceAfter === c.bank ? '✓ last ledger balance matches bank' : '≈'}</span>
            <span className="ml-auto flex items-center gap-1 text-xs">Owner draw to personal wallet <input value={draw} onChange={(e) => setDraw(e.target.value)} className="w-24 rounded bg-black/40 px-2 py-1" /><Btn small onClick={() => res(act((s) => ownerDraw(s, Number(draw))))}>Transfer</Btn></span></div>
          <Table head={['Time', 'Type', 'Category', 'Description', 'Amount', 'Balance']} rows={g.ledger.filter((l) => l.account === 'company').slice(-40).reverse().map((l) => [fmtTime(l.time), l.kind, l.category, l.label, <span key={l.id} className={l.amount >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{inr(l.amount)}</span>, inr(l.balanceAfter)])} />
        </div>
      )}

      {tab === 'employees' && (
        <div className="space-y-3">
          <Table head={['Name', 'Role', 'Branch', 'Shift', 'Status', 'Bike', 'Rating', 'Rides', 'Deposit', '']} rows={active.map((e) => [
            <button key={e.id} className="underline" onClick={() => setView(view === e.id ? null : e.id)}>{e.name}</button>, ROLE_INFO[e.role].label, c.branches.find((b) => b.id === e.branchId)?.name.split('—').pop() ?? '', 
            e.role === 'rider' ? <select key="s" value={e.shift} onChange={(x) => act((s) => setEmployeeShift(s, e.id, x.target.value as ShiftType))} className="rounded bg-black/40 px-1 text-xs"><option value="morning">6AM–2PM</option><option value="evening">2PM–10PM</option><option value="flex">Flexible</option></select> : '—',
            <span key="st" className={e.status === 'active' ? (e.online ? 'text-emerald-300' : 'text-slate-300') : 'text-rose-300'}>{e.status === 'active' ? (e.online ? 'online' : 'offline') : e.status}</span>, c.bikes.find((b) => b.id === e.bikeId)?.plate ?? '—', `★${e.rating.toFixed(1)}`, e.ridesDone, inr(e.deposit),
            <Btn key="t" small tone="red" onClick={() => res(act((s) => separateEmployee(s, e.id, 'terminate')))}>Terminate</Btn>])} />
          {empView && (
            <div className="grid gap-3 rounded-xl bg-white/5 p-3 text-xs md:grid-cols-3">
              <div><b className="text-sm">{empView.name}</b><div>Age {empView.age} · exp {empView.experience} yrs · {ROLE_INFO[empView.role].label}</div><div>Login: <code className="rounded bg-black/40 px-1">{empView.username}</code> / <code className="rounded bg-black/40 px-1">{empView.password}</code></div><div>Licence: {empView.licence ? `${empView.licence.number} — ${licenceStatusText(empView.licence, day)}` : 'n/a'}</div>{empView.role === 'rider' && empView.licence && !licenceValid(empView.licence, day) && <Btn small className="mt-1" onClick={() => res(act((s) => renewEmployeeLicence(s, empView.id)))}>Verify renewed licence</Btn>}<div>Uniform: {empView.uniform ? 'issued' : 'returned'} · Salary {empView.salary ? inr(empView.salary) + '/mo' : '70% commission'}</div><div>Earned (70%): {inr(empView.totalEarned)} · violations {empView.violations} · accidents {empView.accidents} · complaints {empView.complaints}</div></div>
              <div><b>Performance</b><Bar value={empView.skill} label="Riding skill" /><Bar value={empView.service} label="Customer service" /><Bar value={empView.safety} label="Safety" /><Bar value={empView.reliability} label="Reliability" /><Bar value={empView.fatigue} label="Fatigue" color="bg-rose-400" /></div>
              <div><b>Leave requests</b>{empView.leave.map((l) => <div key={l.id} className="mt-1 flex items-center justify-between rounded bg-black/30 px-2 py-1">D{l.fromDay + 1}–{l.toDay + 1} {l.status}{l.status === 'pending' && <span className="flex gap-1"><Btn small tone="green" onClick={() => act((s) => decideLeave(s, empView.id, l.id, true))}>OK</Btn><Btn small tone="red" onClick={() => act((s) => decideLeave(s, empView.id, l.id, false))}>No</Btn></span>}</div>)}<b className="mt-2 block">History</b><div className="max-h-24 overflow-y-auto">{[...empView.history].reverse().map((h, i) => <div key={i}>D{h.day + 1}: {h.text}</div>)}</div></div>
            </div>
          )}
          <div className="text-[11px] text-slate-400">Resigned / terminated: bike inspected, uniform returned, deposit refunded minus legitimate deductions (₹20 per damage point caused during tenure, ₹600 missing uniform).</div>
        </div>
      )}

      {tab === 'recruit' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">Assign new hires to branch <select value={apBranch} onChange={(e) => setApBranch(e.target.value)} className="rounded bg-black/40 px-2 py-1">{c.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select> shift <select value={apShift} onChange={(e) => setApShift(e.target.value as ShiftType)} className="rounded bg-black/40 px-2 py-1"><option value="morning">Morning 6–2</option><option value="evening">Evening 2–10</option><option value="flex">Flexible</option></select><span className="text-slate-400">· Riders pay a refundable ₹5,000 deposit and need a free company bike ({c.bikes.filter((b) => !b.assignedEmployeeId).length} free).</span></div>
          {!c.applicants.length && <p className="text-sm text-slate-400">No applications right now. Good reputation brings more applicants.</p>}
          <div className="grid gap-3 md:grid-cols-2">
            {c.applicants.map((a) => {
              const el = riderEligibility(a, day);
              const iv = a.interviewed;
              return (
                <div key={a.id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs">
                  <div className="flex items-center justify-between"><b className="text-sm">{a.name}</b><span className="rounded bg-white/10 px-2">{ROLE_INFO[a.role].label}</span></div>
                  <div className="text-slate-300">Age {a.age} · {a.experience} yrs exp · {a.qualification} · prefers {a.availability}</div>
                  <div className="mt-1">Licence: {a.role === 'rider' || a.licence ? (a.licence ? <>{a.licence.number} <span className="text-slate-400">(claims valid)</span></> : 'None') : 'n/a'} {a.licenceVerified && <b className={el.ok ? 'text-emerald-300' : 'text-rose-300'}>{a.verifiedResult}</b>}</div>
                  <div className="mt-1 grid grid-cols-4 gap-1">{[['Skill', a.skill], ['Service', a.service], ['Safety', a.safety], ['Reliab.', a.reliability]].map(([k, v]) => <div key={k as string} className="rounded bg-black/30 p-1 text-center"><div className="text-[9px] text-slate-400">{k}</div><b>{iv ? v : '?'}</b></div>)}</div>
                  <div className="mt-1 text-slate-300">Accident history: {iv ? a.accidents : '? (interview)'} · Expected: {a.role === 'rider' ? '70% commission' : inr(a.expectedSalary) + '/mo'}</div>
                  <div className="mt-2 flex flex-wrap gap-1"><Btn small tone="slate" disabled={a.interviewed} onClick={() => act((s) => interviewApplicant(s, a.id))}>Interview</Btn><Btn small tone="blue" disabled={a.licenceVerified || (a.role !== 'rider' && !a.licence)} onClick={() => act((s) => { const ap = s.company!.applicants.find((x) => x.id === a.id)!; verifyLicence(s, ap); })}>Verify licence</Btn><Btn small tone="green" onClick={() => res(act((s) => approveApplicant(s, a.id, apBranch, apShift)))}>Approve</Btn><Btn small tone="red" onClick={() => act((s) => rejectApplicant(s, a.id))}>Reject</Btn></div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'fleet' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white/5 p-3 text-xs">Buy company motorcycle:
            <select value={newModel} onChange={(e) => setNewModel(e.target.value)} className="rounded bg-black/40 px-2 py-1">{BIKE_MODELS.filter((m) => m.price <= COMPANY_MODEL_MAX_PRICE).map((m) => <option key={m.id} value={m.id}>{m.name} — {inr(m.price)}</option>)}</select>
            <select value={newBranch} onChange={(e) => setNewBranch(e.target.value)} className="rounded bg-black/40 px-2 py-1">{c.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
            <Btn small onClick={() => res(act((s) => buyCompanyBike(s, newModel, newBranch)))}>Purchase from company funds</Btn><span className="text-slate-400">+₹2,500 registration · basic insurance</span></div>
          <Table head={['Plate', 'Model', 'Branch', 'Rider', 'Cond.', 'Fuel', 'Oil/Tyre/Brake', 'Damage', 'Insurance', 'Status', 'Service']} rows={c.bikes.map((b) => {
            const emp = c.employees.find((e) => e.id === b.assignedEmployeeId);
            return [b.plate, modelOf(b.modelId).name, c.branches.find((x) => x.id === b.branchId)?.name.split('—').pop() ?? '', emp?.name ?? <i key="u" className="text-slate-500">unassigned</i>, `${bikeCondition(b)}%`, `${Math.round(b.fuel * 100)}%`, `${Math.round(b.oil)}/${Math.round(b.tyres)}/${Math.round(b.brakes)}`, `${Math.round(b.damage)}%`,
              <select key="i" value={b.insurance.plan} onChange={(e) => act((s) => setInsurance(s, b.id, e.target.value as 'none' | 'basic' | 'comprehensive'))} className="rounded bg-black/40 px-1 text-xs"><option value="none">None</option><option value="basic">Basic ₹{PREMIUM.basic}</option><option value="comprehensive">Comp. ₹{PREMIUM.comprehensive}</option></select>,
              b.status, <span key="s" className="flex gap-1">{(['service', 'tyres', 'brakes', 'repair'] as const).map((k) => <Btn key={k} small tone="slate" onClick={() => res(act((s) => serviceCompanyBike(s, b.id, k)))}>{k} {inr(serviceCost(k, b))}</Btn>)}</span>];
          })} />
          <div className="text-[11px] text-slate-400">Company policy: the company pays fuel, servicing, tyres, brakes, repairs and insurance. Employees may only use company bikes on company rides. Registration valid for 1 year. Insurance basic: 50% up to ₹20k per claim; comprehensive: 80% up to ₹60k.</div>
        </div>
      )}

      {tab === 'branches' && (
        <div className="space-y-4">
          <Table head={['Branch', 'District', 'Status', 'Manager', 'Riders', 'Bikes', 'Rides', 'Revenue', 'Expenses', 'Rent/mo', '']} rows={c.branches.map((b) => [b.name.split('—').pop(), DISTRICTS[b.district].name, b.status === 'open' ? <span key="o" className="text-emerald-300">open</span> : <span key="n" className="text-amber-300">needs manager</span>, c.employees.find((e) => e.id === b.managerId)?.name ?? '—', riders.filter((e) => e.branchId === b.id).length, c.bikes.filter((x) => x.branchId === b.id).length, b.rides, inr(b.revenue), inr(b.expenses), inr(b.rentMonthly), b.id === 'hq' ? '' : <Btn key="v" small tone="blue" onClick={() => { const p = poiById.get(b.poiId); if (p) toast(`Travel to ${p.name} to inspect it in person`); }}>Inspect</Btn>])} />
          <b className="text-sm">Expansion — zone by zone</b>
          <div className="grid gap-3 md:grid-cols-2">{DISTRICT_ORDER.filter((d) => d !== 'central').map((d) => {
            const exists = c.branches.find((b) => b.district === d);
            const req = branchRequirements(g, d);
            return (
              <div key={d} className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs"><div className="flex items-center justify-between"><b className="text-sm" style={{ color: DISTRICTS[d].color }}>{DISTRICTS[d].name}</b>{exists ? <span className="text-emerald-300">{exists.status === 'open' ? 'Open' : 'Registered — hire manager'}</span> : <span>Setup {inr(branchCost(d))}</span>}</div>
                {!exists && <><div className="mt-1 space-y-0.5">{req.map((r) => <div key={r.label} className={r.ok ? 'text-emerald-300' : 'text-slate-400'}>{r.ok ? '✓' : '○'} {r.label}</div>)}</div><Btn small className="mt-2" disabled={!req.every((r) => r.ok)} onClick={() => res(act((s) => openBranch(s, d)))}>Register branch</Btn></>}
              </div>
            );
          })}</div>
        </div>
      )}

      {tab === 'loans' && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2"><Stat label="Outstanding" value={inr(outstandingLoans(c))} /><Stat label="Credit score" value={c.credit} /><Stat label="Next EMI" value={(() => { const n = c.loans.filter((l) => l.status !== 'closed').map((l) => l.nextDueDay).sort((a, b) => a - b)[0]; return n === undefined ? '—' : `Day ${n + 1} (${dayName(n)})`; })()} sub="auto-debited from company account" /></div>
          {!c.loans.length && <p className="text-sm text-slate-400">No loans yet. Visit Bharat Union Bank (central city) to apply for a business loan.</p>}
          {c.loans.map((l) => (
            <div key={l.id} className="rounded-xl bg-white/5 p-3"><b>{l.id}</b> — {inr(l.principal)} @ {l.ratePct}% · {l.months} months · EMI {inr(l.emi)} · <span className={l.status === 'defaulted' ? 'text-rose-300' : 'text-emerald-300'}>{l.status}</span> · late fees {inr(l.lateFees)} · interest paid {inr(l.totalInterestPaid)}
              <div className="mt-2"><Table head={['#', 'Due day', 'EMI', 'Principal', 'Interest', 'Late fee', 'Status']} rows={l.schedule.slice(Math.max(0, l.paidCount - 3), l.paidCount + 6).map((r) => [r.n, r.dueDay + 1, inr(r.emi), inr(r.principalPart), inr(r.interestPart), r.lateFee ? inr(r.lateFee) : '—', <span key={r.n} className={r.status === 'paid' ? 'text-emerald-300' : r.status === 'overdue' ? 'text-rose-300' : 'text-slate-300'}>{r.status}{r.paidDay !== undefined ? ` (day ${r.paidDay + 1})` : ''}</span>])} /></div></div>
          ))}
        </div>
      )}

      {tab === 'customers' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2"><Stat label="Average rating" value={`★ ${companyRating(g).toFixed(2)}`} /><Stat label="Reputation" value={c.reputation.toFixed(1)} /><Stat label="Open complaints" value={unresolved.length} tone={unresolved.length ? 'warn' : 'good'} /></div>
          <b className="text-sm">Complaints</b>
          <Table head={['Day', 'Employee', 'Complaint', 'Status', 'Resolve']} rows={[...c.complaints].reverse().slice(0, 15).map((x) => [x.day + 1, c.employees.find((e) => e.id === x.employeeId)?.name ?? '—', x.text, x.resolved ? 'resolved' : 'open', x.resolved ? '' : <span key={x.id} className="flex items-center gap-1"><input value={notes[x.id] ?? refund} onChange={(e) => setNotes({ ...notes, [x.id]: e.target.value })} className="w-14 rounded bg-black/40 px-1 text-xs" /><Btn small tone="green" onClick={() => { const amt = g.rides.find((r) => r.id === x.rideId)?.final ? Number(notes[x.id] ?? refund) || 0 : 0; const r = act((s) => resolveComplaint(s, x.id, amt)); toast(`Resolved${r ? ` · refunded ${inr(r)}` : ''}`); }}>Resolve + refund ₹</Btn></span>])} />
          <b className="text-sm">Recent company rides</b>
          <Table head={['Time', 'Trip', 'Driver', 'Status', 'Fare', 'Split 70/30', '★']} rows={g.rides.filter((r) => r.driverType === 'employee').slice(0, 14).map((r) => [fmtTime(r.requestedAt), <button key={r.id} className="text-left underline" onClick={() => setSelRide(r)}>{r.pickup.label.split(' #')[0]} → {r.dest.label.split(' #')[0]}</button>, c.employees.find((e) => e.id === r.driverId)?.name ?? '—', r.status, r.final ? inr(r.final.total) : inr(r.estimate.total), r.split ? `${inr(r.split.driver)} / ${inr(r.split.company)}` : '—', r.rating ?? '—'])} />
          {selRide && <div className="grid gap-3 md:grid-cols-2"><FareView f={selRide.estimate} title="Estimate" compact />{selRide.final && <FareView f={selRide.final} title="Final (stored breakdown)" compact />}</div>}
        </div>
      )}

      {tab === 'market' && (
        <div className="space-y-4">
          <Table head={['Competitor', 'Reputation', 'Riders', 'Districts', 'Pricing index']} rows={g.competitors.map((k) => [<b key={k.id} style={{ color: k.color }}>{k.name}</b>, k.reputation.toFixed(1), k.riders, k.districts.map((d) => DISTRICTS[d].name.split(' ')[0]).join(', '), k.price.toFixed(2)])} />
          <p className="text-xs text-slate-400">You: reputation {c.reputation.toFixed(1)}, {riders.length} riders, app awareness {Math.round(awareness(g) * 100)}%.</p>
          <Table head={['District', 'Market requests/h', 'Market drivers', 'Ratio', 'Demand adj.', 'Your share', 'Your req/h']} rows={DISTRICT_ORDER.map((d) => {
            const s = DemandAnalyzer.snapshot({ district: d, hour: Math.floor((g.time % 1440) / 60), weather: g.weather, day });
            const ctx = DynamicPricingController.context({ district: d, timeMin: g.time, weather: g.weather, hubTrip: false });
            const open = openBranches.some((b) => b.district === d);
            return [DISTRICTS[d].name, s.requests, s.drivers, s.ratio.toFixed(2), `${ctx.demandPct >= 0 ? '+' : ''}${Math.round(ctx.demandPct * 100)}% ${s.event ? '· ' + s.event : ''}`, open ? `${Math.round(companyShare(g, d) * 100)}%` : 'no branch', open ? demandPerHour(g, d).toFixed(1) : '—'];
          })} />
        </div>
      )}

      {tab === 'pricing' && (
        <div className="space-y-3 text-sm">
          <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-xs text-amber-100">🔒 Fare rates are controlled automatically by the game (version {FARE_RULES.version}). Owners cannot edit rates, surge, surcharges or waiting rules. Every portal and branch uses the same fare engine.</div>
          <div className="grid gap-2 md:grid-cols-3">
            <Stat label="Base fare" value={inr(FARE_RULES.baseFare)} /><Stat label="Per km" value={inr(FARE_RULES.perKm)} /><Stat label="Per minute" value={inr(FARE_RULES.perMinute)} /><Stat label="Minimum fare" value={inr(FARE_RULES.minFare)} /><Stat label="Free waiting" value={`${FARE_RULES.freeWaitMin} min`} sub={`then ${inr(FARE_RULES.waitPerMin)}/min, max ${FARE_RULES.maxPaidWaitMin} min`} /><Stat label="Max demand surge" value={`+${FARE_RULES.maxDemandPct * 100}%`} sub={`discount ≤ ${FARE_RULES.maxDiscountPct * 100}% · total uplift cap ${FARE_RULES.maxTotalUpliftPct * 100}%`} />
          </div>
          <div className="text-xs text-slate-300">Weather surcharge: {Object.entries(FARE_RULES.weatherPct).map(([k, v]) => `${k} ${v * 100}%`).join(' · ')}. Night: 10 PM–midnight +{FARE_RULES.nightPct.evening * 100}%, midnight–5 AM +{FARE_RULES.nightPct.lateNight * 100}%. Airport access fee {inr(FARE_RULES.hubFee)}. Final fare may exceed the estimate by at most {FARE_RULES.estimateProtectionPct * 100}% (plus customer waiting). Employee share {FARE_RULES.employeeShare * 100}% / company {FARE_RULES.companyShare * 100}%. Map scale: 1 km on the city map = {FARE_RULES.distanceScale} fare-km.</div>
        </div>
      )}
      {void ({} as Branding)}
    </Modal>
  );
}
