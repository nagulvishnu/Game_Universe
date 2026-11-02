import { useMemo, useState } from 'react';
import { useGame } from '../game/store';
import { Bar, Btn, inr, Modal, Stat, Table, Tabs } from './common';
import { FareView } from './FareView';
import { RIDE_POIS, poiById, DISTRICTS } from '../game/world/city';
import { bookCustomerRide, cancelCustomerRide, estimateForCustomer, rateCustomerRide } from '../game/logic/rides';
import { cancellationFee } from '../game/fare/FareEngine';
import { bikeCondition, dayNow } from '../game/state';
import { employeeSetOnline, fileBikeReport, renewEmployeeLicence, requestLeave, separateEmployee } from '../game/logic/company';
import { licenceStatusText, licenceValid } from '../game/logic/people';
import { fmtTime } from '../game/util';
import { modelOf, ROLE_INFO } from '../game/data';
import type { RideRecord } from '../game/types';

const PLACES = RIDE_POIS.filter((p) => !['police', 'home'].includes(p.kind)).sort((a, b) => a.name.localeCompare(b.name));

function Steps({ r }: { r: RideRecord }) {
  const order = ['requested', 'enroute', 'arrived', 'inprogress', 'completed'];
  const idx = order.indexOf(r.status === 'assigned' ? 'enroute' : r.status);
  const labels = ['Finding driver', 'Driver on the way', 'Driver arrived', 'On trip', 'Completed'];
  return <div className="flex gap-1">{labels.map((l, i) => <div key={l} className={`flex-1 rounded px-1 py-1 text-center text-[10px] ${i <= idx ? 'bg-emerald-500 font-bold text-slate-900' : 'bg-white/10 text-slate-400'}`}>{l}</div>)}</div>;
}

export function CustomerPortal() {
  const g = useGame((s) => s.g)!;
  const act = useGame((s) => s.act);
  const toast = useGame((s) => s.toast);
  const c = g.company!;
  const [tab, setTab] = useState('book');
  const [pickup, setPickup] = useState('rest1');
  const [dest, setDest] = useState('mall');
  const [stars, setStars] = useState(5);
  const [review, setReview] = useState('');
  const [complaint, setComplaint] = useState('');
  const est = useMemo(() => { const r = estimateForCustomer(g, pickup, dest); return 'error' in r ? null : r; }, [pickup, dest, Math.floor(g.time / 15), g.weather]);
  const mine = g.rides.filter((r) => r.source === 'customerApp');
  const cur = mine.find((r) => r.id === g.myBooking);
  const active = cur && !['completed', 'cancelled', 'expired'].includes(cur.status) ? cur : null;
  const emp = active ? c.employees.find((e) => e.id === active.driverId) : null;
  const bike = emp ? c.bikes.find((b) => b.id === emp.bikeId) : null;
  const eta = active?.eta ? Math.max(0, Math.round((active.status === 'enroute' ? active.eta.pickupEnd : active.status === 'arrived' ? active.eta.waitEnd : active.eta.rideEnd) - g.time)) : null;
  const finished = cur && cur.status === 'completed' ? cur : null;
  const cf = active ? cancellationFee('customer', active.status === 'requested' ? 'requested' : active.status === 'arrived' ? 'arrived' : active.status === 'inprogress' ? 'inprogress' : 'enroute', g.time - active.requestedAt) : null;
  return (
    <Modal title={`${c.branding.name} — Customer app`} icon="📱" wide>
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'book', label: 'Book a ride' }, { id: 'track', label: 'Track / rate', badge: active ? 1 : finished && finished.review === undefined ? 1 : 0 }, { id: 'history', label: 'My rides' }]} />
      <p className="mb-3 rounded-lg bg-white/5 p-2 text-[11px] text-slate-400">You are logged in as the owner using a customer account. Fares come from the central fare engine (same pricing in every portal/branch) and are paid from your PERSONAL wallet ({inr(g.wallet)}). Bookings create real requests for your company's employees.</p>
      {tab === 'book' && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 text-sm">
            <label className="block text-xs text-slate-400">Pickup<select value={pickup} onChange={(e) => setPickup(e.target.value)} className="mt-1 w-full rounded-lg bg-black/40 px-2 py-2 text-white">{PLACES.map((p) => <option key={p.id} value={p.id}>{p.name} — {DISTRICTS[p.district].name}</option>)}</select></label>
            <label className="block text-xs text-slate-400">Destination<select value={dest} onChange={(e) => setDest(e.target.value)} className="mt-1 w-full rounded-lg bg-black/40 px-2 py-2 text-white">{PLACES.map((p) => <option key={p.id} value={p.id}>{p.name} — {DISTRICTS[p.district].name}</option>)}</select></label>
            {est && <div className="rounded-lg bg-white/5 p-2 text-xs"><div>Road distance: <b>{est.estimate.distanceKm} km</b> ({Math.round(est.routeMeters)} m on map)</div><div>Estimated duration: <b>{Math.round(est.estimate.durationMin)} min</b></div><div>Demand: <b>{est.pricing.label}</b></div></div>}
            <p className="text-[11px] text-slate-400">Free cancellation within {2} min or before a driver is assigned. Later: ₹20 (driver on the way) / ₹40 (driver arrived). Waiting is free for 3 min.</p>
            <Btn className="w-full" onClick={() => { const r = act((s) => bookCustomerRide(s, pickup, dest)); toast(r.message); if (r.ok) setTab('track'); }}>Book — pay {est ? inr(est.estimate.total) : ''}</Btn>
          </div>
          <div>{est ? <FareView f={est.estimate} title="Fare estimate" /> : <div className="text-sm text-slate-400">Choose two different places.</div>}</div>
        </div>
      )}
      {tab === 'track' && (
        <div className="space-y-3 text-sm">
          {!active && !finished && <p className="text-slate-400">No active booking.</p>}
          {active && (
            <>
              <Steps r={active} />
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1 rounded-xl bg-white/5 p-3 text-xs">
                  <div>📍 {active.pickup.label}</div><div>🏁 {active.dest.label}</div>
                  {emp ? <><div className="mt-1 font-bold">Driver: {emp.name} · ★ {emp.rating.toFixed(1)} ({emp.ridesDone} rides)</div><div>Motorcycle: {bike ? `${modelOf(bike.modelId).name} · ${bike.plate}` : '—'} · Condition {bike ? bikeCondition(bike) : '—'}%</div>{eta !== null && <div className="text-emerald-300">ETA {eta} min</div>}</> : <div className="text-amber-300">Searching for nearby available drivers…</div>}
                  <div className="text-slate-400">Confirmed estimate: {inr(active.estimate.total)} (charged at booking; adjusted to final fare after the ride)</div>
                </div>
                <FareView f={active.estimate} title="Confirmed fare" compact />
              </div>
              {cf && <div className="flex items-center gap-3"><Btn tone="red" disabled={!cf.allowed} onClick={() => toast(act((s) => cancelCustomerRide(s, active.id)).message)}>Cancel ride ({cf.fee ? inr(cf.fee) + ' fee' : 'free'})</Btn><span className="text-[11px] text-slate-400">{cf.reason}</span></div>}
            </>
          )}
          {finished && (
            <div className="space-y-2">
              <div className="rounded-xl bg-emerald-500/10 p-3 text-xs"><b className="text-emerald-300">Ride completed.</b> {finished.explanation}</div>
              <div className="grid gap-3 md:grid-cols-2"><FareView f={finished.estimate} title="Estimate" compact />{finished.final && <FareView f={finished.final} title="Final fare" compact />}</div>
              {finished.review === undefined ? (
                <div className="rounded-xl bg-white/5 p-3"><b className="text-sm">Rate your driver</b><div className="my-1 flex gap-1">{[1, 2, 3, 4, 5].map((n) => <button key={n} onClick={() => setStars(n)} className={`text-2xl ${n <= stars ? 'text-amber-400' : 'text-slate-600'}`}>★</button>)}</div>
                  <input value={review} onChange={(e) => setReview(e.target.value)} placeholder="Write a review" className="mb-1 w-full rounded bg-black/40 px-2 py-1 text-sm" /><input value={complaint} onChange={(e) => setComplaint(e.target.value)} placeholder="Complaint (optional)" className="mb-2 w-full rounded bg-black/40 px-2 py-1 text-sm" />
                  <Btn onClick={() => { act((s) => rateCustomerRide(s, finished.id, stars, review || '—', complaint)); toast('Thanks for your feedback'); }}>Submit</Btn></div>
              ) : <div className="text-xs text-slate-400">You rated this ride {finished.rating}★.</div>}
            </div>
          )}
        </div>
      )}
      {tab === 'history' && <Table head={['When', 'Trip', 'Status', 'Estimate', 'Final', 'Note']} rows={mine.map((r) => [fmtTime(r.requestedAt), `${r.pickup.label.split(' #')[0]} → ${r.dest.label.split(' #')[0]}`, r.status, inr(r.estimate.total), r.final ? inr(r.final.total) : r.cancelFee ? `fee ${inr(r.cancelFee)}` : '—', <span key={r.id} className="text-[11px] text-slate-400">{r.explanation ?? ''}</span>])} />}
    </Modal>
  );
}

export function EmployeePortal() {
  const g = useGame((s) => s.g)!;
  const act = useGame((s) => s.act);
  const toast = useGame((s) => s.toast);
  const c = g.company!;
  const [user, setUser] = useState('');
  const [pw, setPw] = useState('');
  const [empId, setEmpId] = useState<string | null>(null);
  const [tab, setTab] = useState('home');
  const [days, setDays] = useState('1');
  const [text, setText] = useState('');
  const e = c.employees.find((x) => x.id === empId);
  if (!e || e.status === 'resigned' || e.status === 'terminated') {
    return (
      <Modal title={`${c.branding.name} — Employee portal`} icon="🧑‍✈️">
        <p className="mb-3 text-xs text-slate-400">Employees sign in with the credentials created at joining. (Owner: credentials are in Admin → Employees.)</p>
        <input value={user} onChange={(x) => setUser(x.target.value)} placeholder="Username" className="mb-2 w-full rounded-lg bg-black/40 px-3 py-2" />
        <input value={pw} onChange={(x) => setPw(x.target.value)} placeholder="Password" type="password" className="mb-3 w-full rounded-lg bg-black/40 px-3 py-2" />
        <Btn onClick={() => { const f = c.employees.find((q) => q.username === user.trim() && q.password === pw && q.status !== 'resigned' && q.status !== 'terminated'); if (f) setEmpId(f.id); else toast('Invalid credentials'); }}>Sign in</Btn>
      </Modal>
    );
  }
  const day = dayNow(g);
  const sum = (from: number) => e.earnings.filter((x) => x.day >= from).reduce((a, x) => a + x.amount, 0);
  const ride = e.rideId ? g.rides.find((r) => r.id === e.rideId) : null;
  const bike = c.bikes.find((b) => b.id === e.bikeId);
  const history = g.rides.filter((r) => r.driverId === e.id && r.status === 'completed').slice(0, 20);
  return (
    <Modal title={`${c.branding.name} — Driver app · ${e.name}`} icon="🧑‍✈️" wide onClose={() => { useGame.getState().closePanel(); }}>
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'home', label: 'Home' }, { id: 'earn', label: 'Earnings' }, { id: 'sched', label: 'Schedule & leave' }, { id: 'bike', label: 'Bike & reports' }, { id: 'perf', label: 'Performance' }, { id: 'notes', label: 'Notifications', badge: e.notifications.length }]} />
      {tab === 'home' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3"><Btn tone={e.online ? 'red' : 'green'} onClick={() => toast(act((s) => employeeSetOnline(s, e.id, !e.online)).message)}>{e.online ? 'Go offline' : 'Go online'}</Btn><span className="text-sm">Status: <b>{e.status}</b> · {e.state}</span><span className="text-xs text-slate-400">Shift: {e.shift}</span></div>
          {!licenceValid(e.licence, day) && <div className="rounded-lg bg-rose-500/20 p-2 text-xs text-rose-200">Licence invalid — you cannot operate. Renew in the Performance tab.</div>}
          {ride ? (
            <div className="grid gap-3 md:grid-cols-2"><div className="rounded-xl bg-white/5 p-3 text-xs"><b className="text-amber-300">Current order · {ride.status}</b><div>👤 {ride.passenger.name} ({ride.passenger.kind})</div><div>📍 {ride.pickup.label}</div><div>🏁 {ride.dest.label}</div><div>Est. fare {inr(ride.estimate.total)} → your share (70%) {inr(Math.round(ride.estimate.total * 0.7))}</div></div><FareView f={ride.estimate} compact title="Order fare breakdown" /></div>
          ) : <p className="text-sm text-slate-400">{e.online ? 'Waiting for nearby orders… (orders are accepted automatically according to your reliability and fatigue)' : 'Offline.'}</p>}
          <div className="grid grid-cols-3 gap-2"><Stat label="Today" value={inr(sum(day))} /><Stat label="Rides" value={e.ridesDone} /><Stat label="Rating" value={`★ ${e.rating.toFixed(2)}`} /></div>
        </div>
      )}
      {tab === 'earn' && <div className="space-y-3"><div className="grid grid-cols-3 gap-2"><Stat label="Daily" value={inr(sum(day))} /><Stat label="Weekly (7d)" value={inr(sum(day - 6))} /><Stat label="Monthly (30d)" value={inr(sum(day - 29))} /></div><Stat label="Wallet balance" value={inr(e.wallet)} sub="Your 70% share of each fare; the company receives 30%." /><Table head={['Ride', 'Fare', 'You earned (70%)', 'Company (30%)']} rows={history.map((r) => [`${r.pickup.label.split(' #')[0]} → ${r.dest.label.split(' #')[0]}`, inr(r.final!.total), inr(r.split?.driver ?? 0), inr(r.split?.company ?? 0)])} /></div>}
      {tab === 'sched' && <div className="space-y-3"><div className="text-sm">Shift: <b>{e.shift}</b> {e.shift === 'morning' ? '(6 AM–2 PM)' : e.shift === 'evening' ? '(2 PM–10 PM)' : '(flexible, 6 AM–11 PM)'}</div>
        <div><b className="text-sm">Attendance (last 14 days)</b><div className="mt-1 flex flex-wrap gap-1">{e.attendance.slice(-14).map((a) => <span key={a.day} className={`rounded px-2 py-0.5 text-[10px] ${a.present ? 'bg-emerald-500/30' : 'bg-rose-500/30'}`}>D{a.day + 1}</span>)}</div></div>
        <div className="flex items-center gap-2"><input value={days} onChange={(x) => setDays(x.target.value)} className="w-16 rounded bg-black/40 px-2 py-1 text-sm" /><span className="text-xs">day(s)</span><Btn small onClick={() => { act((s) => requestLeave(s, e.id, Math.max(1, Number(days) || 1), 'Personal')); toast('Leave requested'); }}>Request leave</Btn></div>
        <Table head={['From', 'To', 'Reason', 'Status']} rows={e.leave.map((l) => [`Day ${l.fromDay + 1}`, `Day ${l.toDay + 1}`, l.reason, l.status])} /></div>}
      {tab === 'bike' && <div className="space-y-3">{bike ? <div className="grid gap-3 md:grid-cols-2"><div className="space-y-2"><b>{modelOf(bike.modelId).name} · {bike.plate}</b><Bar value={bike.fuel * 100} color="bg-amber-400" label="Fuel (company pays)" /><Bar value={bike.oil} label="Oil" /><Bar value={bike.tyres} label="Tyres" /><Bar value={bike.brakes} label="Brakes" /><Bar value={100 - bike.damage} label="Body" /><div className="text-xs text-slate-400">Insurance: {bike.insurance.plan} · Status: {bike.status}</div></div>
        <div className="space-y-2"><b className="text-sm">Report to company</b><input value={text} onChange={(x) => setText(x.target.value)} placeholder="e.g. brake feels soft / fuel low / accident" className="w-full rounded bg-black/40 px-2 py-1 text-sm" /><div className="flex gap-1"><Btn small onClick={() => { act((s) => fileBikeReport(s, e.id, text || 'Bike condition report')); toast('Report filed'); setText(''); }}>Bike / fuel report</Btn><Btn small tone="red" onClick={() => { act((s) => fileBikeReport(s, e.id, 'ACCIDENT REPORT: ' + (text || 'minor incident'))); toast('Accident reported'); setText(''); }}>Report accident</Btn></div>
        <div className="max-h-32 overflow-y-auto text-[11px] text-slate-300">{e.bikeReports.slice(-8).reverse().map((r, i) => <div key={i}>D{r.day + 1}: {r.text}</div>)}</div></div></div> : <p className="text-sm text-slate-400">No motorcycle assigned.</p>}</div>}
      {tab === 'perf' && <div className="space-y-3"><div className="grid grid-cols-2 gap-2 md:grid-cols-5"><Stat label="Skill" value={e.skill} /><Stat label="Service" value={e.service} /><Stat label="Safety" value={e.safety} /><Stat label="Reliability" value={e.reliability} /><Stat label="Fatigue" value={Math.round(e.fatigue)} tone={e.fatigue > 70 ? 'bad' : undefined} /></div>
        <div className="grid grid-cols-3 gap-2"><Stat label="Violations" value={e.violations} tone={e.violations ? 'warn' : 'good'} /><Stat label="Accidents" value={e.accidents} tone={e.accidents ? 'warn' : 'good'} /><Stat label="Complaints" value={e.complaints} /></div>
        <div className="rounded-xl bg-white/5 p-3 text-xs">Licence {e.licence?.number}: <b>{licenceStatusText(e.licence, day)}</b> {e.licence && !licenceValid(e.licence, day) && <Btn small className="ml-2" onClick={() => toast(act((s) => renewEmployeeLicence(s, e.id)).message)}>Renew at RTO</Btn>}</div>
        <div className="max-h-40 overflow-y-auto text-[11px] text-slate-300">{[...e.history].reverse().map((h, i) => <div key={i}>D{h.day + 1}: {h.text}</div>)}</div></div>}
      {tab === 'notes' && <div className="space-y-1 text-xs">{[...e.notifications].reverse().slice(0, 30).map((n, i) => <div key={i} className="rounded bg-white/5 px-2 py-1">{n}</div>)}<Btn small tone="slate" onClick={() => { act((s) => { const q = s.company!.employees.find((x) => x.id === e.id)!; q.notifications = []; }); }}>Clear</Btn></div>}
      <div className="mt-4 border-t border-white/10 pt-2 text-[10px] text-slate-500">{ROLE_INFO[e.role].label} · Branch {c.branches.find((b) => b.id === e.branchId)?.name} · <button className="underline" onClick={() => { setEmpId(null); }}>Sign out</button>{' · '}<button className="underline" onClick={() => { const r = act((s) => separateEmployee(s, e.id, 'resign')); toast(r.message); if (r.ok) setEmpId(null); }}>Resign (return bike & uniform)</button> · {poiById.size ? '' : ''}</div>
    </Modal>
  );
}
