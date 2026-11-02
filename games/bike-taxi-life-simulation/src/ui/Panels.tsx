import { useEffect, useState } from 'react';
import { useGame } from '../game/store';
import { rt } from '../game/runtime';
import { Bar, Btn, inr, Modal, Stat, Table, Tabs, Logo } from './common';
import { FareView } from './FareView';
import { BankApp, SettingsBody } from './Phone';
import { BIKE_MODELS, FOOD, HOMES, modelOf, PAINTS, UPGRADE_COST } from '../game/data';
import { buyHome, buyPersonalBike, eat, faint, medical, paintPersonal, payFines, payRentDue, refuelPersonal, sellPersonalBike, servicePersonal, sleep, upgradePersonal, FUEL_PRICE } from '../game/logic/life';
import { applyForLoan, emiFor, loanRate, maxLoan, outstandingLoans } from '../game/logic/company';
import { bikeCondition, dayNow } from '../game/state';
import { poiById } from '../game/world/city';
import { MapCanvas } from './HUD';
import { startNavigation } from '../game/actions';
import { CompanySetup } from './CompanySetup';
import { AdminPortal } from './AdminPortal';
import { CustomerPortal, EmployeePortal } from './Portals';
import { fmtTime } from '../game/util';
import { Tshirt } from './common';
import { LocalSaveRepository } from '../game/persistence';

function useRes() {
  const toast = useGame((s) => s.toast);
  return (r: { ok: boolean; message: string }) => toast((r.ok ? '✓ ' : '✗ ') + r.message);
}

function Sleep() {
  const g = useGame((s) => s.g)!;
  const bulk = useGame((s) => s.bulk);
  const close = useGame((s) => s.closePanel);
  const toast = useGame((s) => s.toast);
  const [fade, setFade] = useState(false);
  const go = () => {
    setFade(true);
    setTimeout(() => {
      const r = bulk((s) => sleep(s));
      if (!r.ok) toast(r.message);
    }, 900);
    setTimeout(() => { setFade(false); close(); }, 2200);
  };
  return (
    <>
      <Modal title="Your bed" icon="🛏️">
        <p className="text-sm text-slate-300">It is {fmtTime(g.time)}. Sleeping skips to the morning (or a 4-hour nap in the daytime), restores energy and health, and your company keeps running meanwhile.</p>
        <div className="my-3 grid grid-cols-2 gap-3"><Bar value={g.needs.energy} color="bg-yellow-400" label="Energy" /><Bar value={g.needs.health} color="bg-rose-400" label="Health" /></div>
        {g.needs.hunger < 25 && <p className="mb-2 text-xs text-amber-300">You are hungry — you will wake up hungrier. Eat first if you can.</p>}
        <Btn onClick={go}>😴 Sleep now</Btn>
      </Modal>
      {fade && <div className="absolute inset-0 z-50 animate-pulse bg-black transition-opacity duration-700" style={{ animation: 'none', opacity: 1 }}><div className="flex h-full items-center justify-center text-2xl font-bold text-slate-300">Zzz…</div></div>}
    </>
  );
}

function Wardrobe() {
  const g = useGame((s) => s.g)!;
  const act = useGame((s) => s.act);
  const c = g.company;
  return (
    <Modal title="Wardrobe" icon="👕">
      {c ? (
        <div className="flex items-center gap-4"><Tshirt color={c.branding.shirt} secondary={c.branding.secondary} style={c.branding.uniformStyle} name={c.branding.name} size={110} />
          <div><p className="mb-2 text-sm text-slate-300">Company uniform: {c.branding.name}</p><Btn onClick={() => act((s) => { s.player.wearUniform = !s.player.wearUniform; })}>{g.player.wearUniform ? 'Wear casual clothes' : 'Wear company uniform'}</Btn></div></div>
      ) : <p className="text-sm text-slate-300">Two shirts, one pair of jeans and a helmet. Everything a rider owns. Build your company to get your own uniform.</p>}
    </Modal>
  );
}

function Shower() {
  const act = useGame((s) => s.act);
  const toast = useGame((s) => s.toast);
  const close = useGame((s) => s.closePanel);
  return <Modal title="Bathroom" icon="🚿"><p className="mb-3 text-sm text-slate-300">A quick bucket-bath restores a little health and thirst.</p><Btn onClick={() => { act((s) => { s.needs.health = Math.min(100, s.needs.health + 3); s.needs.energy = Math.min(100, s.needs.energy + 4); }); toast('Refreshed!'); close(); }}>Freshen up</Btn></Modal>;
}

function GaragePanel() {
  const g = useGame((s) => s.g)!;
  const act = useGame((s) => s.act);
  const openPanel = useGame((s) => s.openPanel);
  const res = useRes();
  const mine = g.bikes.filter((b) => b.owner === 'player');
  const [id, setId] = useState(g.player.bikeId ?? mine[0]?.id);
  const b = mine.find((x) => x.id === id) ?? mine[0];
  if (!b) return <Modal title="Garage"><p>You have no bike.</p></Modal>;
  const m = modelOf(b.modelId);
  const near = Math.hypot(b.x - (rt.mode === 'walk' ? rt.walk.x : rt.bike.x), b.z - (rt.mode === 'walk' ? rt.walk.z : rt.bike.z)) < 40 || g.player.onBike;
  return (
    <Modal title="Murugan Motors Garage" icon="🔧" wide>
      <div className="mb-3 flex flex-wrap gap-2">{mine.map((x) => <Btn key={x.id} small tone={x.id === b.id ? 'amber' : 'slate'} onClick={() => setId(x.id)}>{modelOf(x.modelId).name} · {x.plate}</Btn>)}</div>
      {!near && <p className="mb-2 rounded bg-amber-500/20 p-2 text-xs text-amber-200">This bike is parked elsewhere — mechanics here can still service it remotely for you (pickup service).</p>}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Stat label="Condition" value={`${bikeCondition(b)}%`} sub={`${m.name} · ${b.odometerKm.toFixed(1)} km`} />
          <Bar value={b.oil} label="Engine oil" color={b.oil < 25 ? 'bg-rose-500' : 'bg-emerald-400'} /><Bar value={b.tyres} label="Tyres" color={b.tyres < 25 ? 'bg-rose-500' : 'bg-emerald-400'} /><Bar value={b.brakes} label="Brakes" color={b.brakes < 25 ? 'bg-rose-500' : 'bg-emerald-400'} /><Bar value={100 - b.damage} label="Body" color={b.damage > 30 ? 'bg-rose-500' : 'bg-emerald-400'} />
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Btn small onClick={() => res(act((s) => servicePersonal(s, b.id, 'oil')))}>Engine oil ₹700</Btn><Btn small onClick={() => res(act((s) => servicePersonal(s, b.id, 'tyres')))}>New tyres ₹1,500</Btn>
            <Btn small onClick={() => res(act((s) => servicePersonal(s, b.id, 'brakes')))}>Brake pads ₹600</Btn><Btn small onClick={() => res(act((s) => servicePersonal(s, b.id, 'repair')))}>Repair body {inr(b.damage * 35)}</Btn>
            <Btn small tone="green" className="col-span-2" onClick={() => res(act((s) => servicePersonal(s, b.id, 'full')))}>Full service</Btn>
          </div>
          {g.company && <Btn small tone="blue" onClick={() => openPanel('admin', 'fleet')}>Inspect company fleet →</Btn>}
        </div>
        <div className="space-y-2">
          <b className="text-sm">Performance upgrades</b>
          {(['engine', 'brake', 'suspension', 'tyre'] as const).map((p) => (
            <div key={p} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-1.5 text-sm"><span className="capitalize">{p} <span className="text-amber-300">{'■'.repeat(b.upgrades[p])}{'□'.repeat(3 - b.upgrades[p])}</span></span>
              <Btn small disabled={b.upgrades[p] >= 3} onClick={() => res(act((s) => upgradePersonal(s, b.id, p)))}>{b.upgrades[p] >= 3 ? 'MAX' : inr(UPGRADE_COST[p][b.upgrades[p]])}</Btn></div>
          ))}
          <b className="text-sm">Paint & decals (₹1,200)</b>
          <div className="flex flex-wrap gap-1">{PAINTS.map((c) => <button key={c} onClick={() => res(act((s) => paintPersonal(s, b.id, c, b.decal)))} style={{ background: c }} className="h-7 w-7 rounded-full border-2 border-white/40" />)}</div>
          <div className="flex gap-1">{[0, 1, 2, 3, 4].map((d) => <Btn key={d} small tone="slate" onClick={() => res(act((s) => paintPersonal(s, b.id, b.color, d)))}>Decal {d + 1}</Btn>)}</div>
        </div>
      </div>
    </Modal>
  );
}

function Menu({ where }: { where: 'restaurant' | 'shop' }) {
  const g = useGame((s) => s.g)!;
  const act = useGame((s) => s.act);
  const res = useRes();
  const items = FOOD.filter((f) => f.where.includes(where));
  return (
    <Modal title={where === 'restaurant' ? 'Restaurant menu' : 'Store'} icon={where === 'restaurant' ? '🍛' : '🛒'}>
      <div className="mb-2 flex gap-3 text-xs"><span>Wallet <b className="text-emerald-300">{inr(g.wallet)}</b></span></div>
      <div className="mb-3 grid grid-cols-2 gap-2"><Bar value={g.needs.hunger} color="bg-orange-400" label="Hunger" /><Bar value={g.needs.thirst} color="bg-sky-400" label="Thirst" /></div>
      <div className="space-y-1.5">{items.map((f) => (
        <div key={f.id} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm"><div><b>{f.name}</b><div className="text-[11px] text-slate-400">{f.hunger ? `+${f.hunger} hunger ` : ''}{f.thirst ? `+${f.thirst} thirst ` : ''}{f.energy ? `+${f.energy} energy` : ''}</div></div>
          <Btn small onClick={() => res(act((s) => eat(s, f.id)))}>{inr(f.price)}</Btn></div>))}</div>
    </Modal>
  );
}

function Medical() {
  const g = useGame((s) => s.g)!;
  const act = useGame((s) => s.act);
  const res = useRes();
  return <Modal title="Hospital" icon="🏥"><Bar value={g.needs.health} color="bg-rose-400" label="Health" /><p className="my-3 text-sm text-slate-300">Treatment cost: {inr(Math.round((100 - g.needs.health) * 22))}. Collapsing from exhaustion or hunger sends you here automatically for ₹1,500.</p><Btn onClick={() => res(act((s) => medical(s)))}>Get treated</Btn></Modal>;
}

function Fuel({ poiId }: { poiId?: string }) {
  const g = useGame((s) => s.g)!;
  const act = useGame((s) => s.act);
  const res = useRes();
  const b = g.bikes.find((x) => x.id === g.player.bikeId);
  if (!b) return <Modal title="Fuel pump"><p>Ride your bike here first.</p></Modal>;
  const m = modelOf(b.modelId);
  return (
    <Modal title={poiById.get(poiId ?? '')?.name ?? 'Fuel pump'} icon="⛽">
      <p className="mb-2 text-sm">Petrol ₹{FUEL_PRICE}/litre · tank {m.tank} L</p><Bar value={b.fuel * 100} color="bg-amber-400" label={`${m.name} fuel`} />
      <p className="my-2 text-sm text-slate-300">Fill-up cost: <b>{inr((1 - b.fuel) * m.tank * FUEL_PRICE)}</b></p>
      <Btn onClick={() => res(act((s) => refuelPersonal(s, b.id)))}>Fill tank</Btn>
    </Modal>
  );
}

function Dealer() {
  const g = useGame((s) => s.g)!;
  const act = useGame((s) => s.act);
  const res = useRes();
  const [tab, setTab] = useState('buy');
  return (
    <Modal title="RoyalWheels Motorcycles" icon="🏍️" wide>
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'buy', label: 'Buy personal bike' }, { id: 'mine', label: 'My bikes' }]} />
      <p className="mb-2 text-xs text-slate-400">Personal bikes are paid from your personal wallet ({inr(g.wallet)}). Company fleet bikes are bought by the company account in the Admin portal.</p>
      {tab === 'buy' && <div className="grid gap-2 md:grid-cols-2">{BIKE_MODELS.map((m) => (
        <div key={m.id} className="rounded-xl border border-white/10 bg-white/5 p-3"><div className="flex items-center justify-between"><b>{m.name}</b><span className="rounded bg-white/10 px-2 text-[10px] uppercase">{m.category}</span></div>
          <div className="mt-1 grid grid-cols-4 gap-1 text-[10px] text-slate-300"><span>Top {Math.round(m.maxSpeed * 3.6)} km/h</span><span>Accel {m.accel}</span><span>Brake {m.brake}</span><span>Handling {m.handling}</span></div>
          <div className="mt-2 flex items-center justify-between"><b className="text-amber-300">{inr(m.price)}</b><Btn small onClick={() => res(act((s) => buyPersonalBike(s, m.id)))}>Buy</Btn></div></div>))}</div>}
      {tab === 'mine' && <Table head={['Bike', 'Plate', 'Condition', 'Location', '']} rows={g.bikes.filter((b) => b.owner === 'player').map((b) => [modelOf(b.modelId).name, b.plate, `${bikeCondition(b)}%`, `${Math.round(b.x)}, ${Math.round(b.z)}${g.player.bikeId === b.id ? ' (riding)' : ' (parked)'}`, <Btn key={b.id} small tone="red" onClick={() => res(act((s) => sellPersonalBike(s, b.id)))}>Sell</Btn>])} />}
    </Modal>
  );
}

function Police() {
  const g = useGame((s) => s.g)!;
  const act = useGame((s) => s.act);
  const res = useRes();
  return (
    <Modal title="Police Station" icon="🚓">
      <div className="grid grid-cols-2 gap-2"><Stat label="Pending fines" value={inr(g.player.finesDue)} tone={g.player.finesDue ? 'bad' : 'good'} /><Stat label="Lifetime fines" value={inr(g.stats.finesPaid)} /></div>
      <p className="my-2 text-xs text-slate-300">Police patrol the city, run checkpoints, and fine red-light jumping, speeding and reckless riding. Your licence is valid for {Math.floor((g.player.licenceExpiryDay - dayNow(g)) / 30)} more months.</p>
      <Btn disabled={!g.player.finesDue} onClick={() => res(act((s) => payFines(s)))}>Pay pending fines</Btn>
    </Modal>
  );
}

function Property() {
  const g = useGame((s) => s.g)!;
  const act = useGame((s) => s.act);
  const res = useRes();
  return (
    <div className="space-y-2"><p className="text-xs text-slate-400">Homes are PERSONAL assets paid from your personal wallet ({inr(g.wallet)}). Better homes restore more energy and health when you sleep.</p>
      {HOMES.map((h) => (
        <div key={h.tier} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 text-sm"><div><b>{h.name}</b><div className="text-[11px] text-slate-400">Comfort ×{h.comfort} · {h.buy ? `Buy ${inr(h.buy)}` : h.rentWeekly ? `Rent ${inr(h.rentWeekly)}/week${(h as { deposit?: number }).deposit ? ` + deposit ${inr((h as { deposit?: number }).deposit!)}` : ''}` : ''}</div></div>
          {g.player.homeTier === h.tier ? <span className="text-xs text-emerald-300">Current home</span> : <Btn small disabled={h.tier < g.player.homeTier} onClick={() => res(act((s) => buyHome(s, h.tier)))}>{h.buy ? 'Purchase' : 'Move in'}</Btn>}</div>))}</div>
  );
}

function Register() {
  const g = useGame((s) => s.g)!;
  const openPanel = useGame((s) => s.openPanel);
  const [tab, setTab] = useState(g.company ? 'company' : 'setup');
  return (
    <Modal title="City Registrar & Business Centre" icon="🏛️" wide>
      <Tabs value={tab} onChange={setTab} tabs={[...(g.company ? [{ id: 'company', label: 'My company' }] : [{ id: 'setup', label: 'Register company' }]), { id: 'property', label: 'Property registry' }]} />
      {tab === 'setup' && <CompanySetup />}
      {tab === 'company' && g.company && <div className="space-y-3"><div className="flex items-center gap-3"><Logo shape={g.company.branding.logoShape} icon={g.company.branding.logoIcon} color={g.company.branding.primary} secondary={g.company.branding.secondary} /><div><b className="text-lg">{g.company.branding.name}</b><div className="text-xs text-slate-400">Registered on day {g.company.registeredDay + 1} · {g.company.branches.length} branch(es)</div></div></div>
        <p className="text-sm text-slate-300">New district branches are registered and opened from the Admin portal → Branches tab, once your performance qualifies.</p><Btn onClick={() => openPanel('admin', 'branches')}>Open expansion planner</Btn></div>}
      {tab === 'property' && <Property />}
    </Modal>
  );
}

function BankPanel() {
  const g = useGame((s) => s.g)!;
  const act = useGame((s) => s.act);
  const res = useRes();
  const c = g.company;
  const cap = c ? maxLoan(g) : 0;
  const [amount, setAmount] = useState(80000);
  const [months, setMonths] = useState(24);
  const rate = c ? loanRate(c.credit) : 0;
  const emi = c ? emiFor(amount, rate, months) : 0;
  return (
    <Modal title="Bharat Union Bank" icon="🏦" wide>
      <div className="grid gap-4 md:grid-cols-2">
        <div><b className="text-sm">Personal banking</b><div className="mt-2"><BankApp /></div></div>
        <div>
          <b className="text-sm">Business loans</b>
          {!c ? <p className="mt-2 text-sm text-slate-400">Register your company first. Business loans fund company motorcycles and are repaid automatically from the COMPANY account.</p> : (
            <div className="mt-2 space-y-2 text-sm">
              <div className="grid grid-cols-3 gap-2"><Stat label="Company bank" value={inr(c.bank)} /><Stat label="Credit score" value={c.credit} tone={c.credit < 550 ? 'bad' : 'good'} /><Stat label="Eligible limit" value={inr(cap)} tone={cap ? 'good' : 'bad'} /></div>
              <label className="block text-xs">Amount: <b>{inr(amount)}</b><input type="range" min={20000} max={Math.max(25000, Math.min(2000000, cap || 100000))} step={5000} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="w-full" /></label>
              <div className="flex gap-1 text-xs">Tenure: {[12, 18, 24, 36].map((m) => <Btn key={m} small tone={months === m ? 'amber' : 'slate'} onClick={() => setMonths(m)}>{m} mo</Btn>)}</div>
              <div className="rounded-xl bg-white/5 p-3 text-xs"><div>Interest rate: <b>{rate}% p.a.</b> (by credit score)</div><div>Monthly EMI: <b className="text-amber-300">{inr(emi)}</b> · Total repayment: <b>{inr(emi * months)}</b> · Interest: {inr(emi * months - amount)}</div><div className="text-slate-400">1% processing fee. EMI auto-debits from the company account every 30 days. Late fee ≥ ₹250 + credit score drop if funds are short.</div></div>
              <Btn onClick={() => res(act((s) => applyForLoan(s, amount, months)))}>Submit application</Btn>
              <div className="text-xs text-slate-400">Outstanding: {inr(outstandingLoans(c))}</div>
              {c.loans.map((l) => <div key={l.id} className="rounded-lg bg-white/5 p-2 text-xs"><b>{l.id}</b> · {inr(l.principal)} @ {l.ratePct}% · {l.paidCount}/{l.months} paid · outstanding {inr(l.outstanding)} · next EMI day {l.nextDueDay + 1} · <span className={l.status === 'active' ? 'text-emerald-300' : l.status === 'defaulted' ? 'text-rose-300' : 'text-slate-400'}>{l.status}</span></div>)}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function BrandWall() {
  const c = useGame((s) => s.g?.company);
  if (!c) return null;
  return <Modal title="Brand wall" icon="🎨"><div className="flex items-center gap-4"><Logo shape={c.branding.logoShape} icon={c.branding.logoIcon} color={c.branding.primary} secondary={c.branding.secondary} size={96} /><Tshirt color={c.branding.shirt} secondary={c.branding.secondary} style={c.branding.uniformStyle} name={c.branding.name} size={110} /><div><b className="text-xl">{c.branding.name}</b><div className="text-sm text-slate-400">{c.branding.tagline}</div></div></div></Modal>;
}

function RideSummary({ id }: { id?: string }) {
  const r = useGame((s) => s.g?.rides.find((x) => x.id === id));
  if (!r || !r.final) return null;
  return (
    <Modal title="Ride complete" icon="✅">
      <div className="mb-2 text-sm"><b>{r.passenger.name}</b> · {r.pickup.label} → {r.dest.label}</div>
      <div className="mb-2 text-xs text-slate-300">Passenger rating: <b className="text-amber-300">{'★'.repeat(r.rating ?? 0)}</b> · {r.pricing.label}</div>
      <div className="grid gap-3 md:grid-cols-2"><FareView f={r.estimate} title="Estimate (shown at request)" /><FareView f={r.final} title="Final fare (paid to your wallet)" /></div>
      <p className="mt-2 text-xs text-slate-300">{r.explanation}</p>
    </Modal>
  );
}

function OfflineReport() {
  const r = useGame((s) => s.g?.offlineReport);
  const act = useGame((s) => s.act);
  const close = useGame((s) => s.closePanel);
  if (!r) return null;
  return (
    <Modal title="While you were away…" icon="🌙" onClose={() => { act((s) => { s.offlineReport = null; }); close(); }}>
      <p className="mb-3 text-sm text-slate-300">You were away for ~{r.elapsedRealMin} min. Your company ran for {Math.round(r.simulatedGameMin / 60)} game-hours{r.capped ? ' (capped to prevent unrealistic catch-up)' : ''} at 50% efficiency.</p>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4"><Stat label="Rides" value={r.rides} /><Stat label="Revenue" value={inr(r.revenue)} tone="good" /><Stat label="Expenses" value={inr(r.expenses)} tone="warn" /><Stat label="Loan paid" value={inr(r.emiPaid)} /></div>
      <div className="mt-3 space-y-1 text-xs">{r.events.map((e, i) => <div key={i} className="rounded bg-white/5 px-2 py-1">{e}</div>)}</div>
    </Modal>
  );
}

function Pause() {
  const close = useGame((s) => s.closePanel);
  const save = useGame((s) => s.save);
  const toMenu = useGame((s) => s.toMenu);
  const [tab, setTab] = useState('main');
  return (
    <Modal title="Paused" icon="⏸️">
      {tab === 'main' && <div className="space-y-2"><Btn onClick={close} className="w-full">Resume</Btn><Btn tone="blue" onClick={() => { save('pause'); }} className="w-full">💾 Save game</Btn><Btn tone="slate" onClick={() => setTab('settings')} className="w-full">Settings</Btn><Btn tone="slate" onClick={() => setTab('controls')} className="w-full">Controls</Btn><Btn tone="red" onClick={toMenu} className="w-full">Save & exit to main menu</Btn></div>}
      {tab === 'settings' && <><SettingsBody /><Btn small tone="slate" className="mt-3" onClick={() => setTab('main')}>‹ Back</Btn></>}
      {tab === 'controls' && <><Controls /><Btn small tone="slate" className="mt-3" onClick={() => setTab('main')}>‹ Back</Btn></>}
    </Modal>
  );
}
export function Controls() {
  const rows = [['W / S', 'Accelerate / brake (walk forward / back)'], ['A / D', 'Steer left / right (turn when walking)'], ['Space', 'Handbrake'], ['E', 'Interact · mount / dismount · enter / exit'], ['C', 'Switch first / third person camera'], ['H', 'Horn (hold)'], ['L', 'Headlights'], ['Z / X', 'Left / right indicator'], ['F', 'Smartphone'], ['M', 'Full map (click to navigate)'], ['Shift', 'Sprint (on foot)'], ['Y / N', 'Accept / reject ride request'], ['Mouse drag / wheel', 'Orbit camera / zoom'], ['Esc', 'Pause / close']];
  return <div className="grid grid-cols-1 gap-1 text-sm">{rows.map(([k, v]) => <div key={k} className="flex gap-3 rounded bg-white/5 px-3 py-1"><b className="w-36 text-amber-300">{k}</b><span>{v}</span></div>)}</div>;
}

function FullMap() {
  const toast = useGame((s) => s.toast);
  const close = useGame((s) => s.closePanel);
  return (
    <Modal title="City map" icon="🗺️" wide>
      <div className="flex flex-col items-center gap-2"><MapCanvas size={640} full onPick={(x, z) => {
        let best: string | null = null, bd = 60;
        for (const p of [...poiById.values()]) { const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = p.id; } }
        if (best) { startNavigation(best); close(); } else toast('Click near a place to navigate there');
      }} /><p className="text-xs text-slate-400">Click a place to start GPS navigation. Blue squares are police patrols; checkpoints are on the roads.</p></div>
    </Modal>
  );
}

export function PanelHost() {
  const ui = useGame((s) => s.ui);
  const g = useGame((s) => s.g);
  const p = ui.panel;
  useEffect(() => { void faint; void LocalSaveRepository; }, []);
  if (!p || !g) return null;
  switch (p) {
    case 'sleep': return <Sleep />;
    case 'savings': return <Modal title="Your table — money planner" icon="💰"><BankApp />{g.player.rentOverdue > 0 && <RentBtn />}</Modal>;
    case 'wardrobe': return <Wardrobe />;
    case 'shower': return <Shower />;
    case 'window': return <Modal title="Window" icon="🌆"><p className="text-sm text-slate-300">Chennai Nagar glows below — {g.weather === 'sunny' ? 'bright sunshine' : g.weather.replace(/([A-Z])/g, ' $1').toLowerCase()} over the rooftops, the hum of scooters never really stops. One day, that skyline will have your brand on it.</p></Modal>;
    case 'garage': return <GaragePanel />;
    case 'menu': return <Menu where="restaurant" />;
    case 'shop': return <Menu where="shop" />;
    case 'medical': return <Medical />;
    case 'dealer': return <Dealer />;
    case 'police': return <Police />;
    case 'fuel': return <Fuel poiId={ui.panelArg} />;
    case 'bank': return <BankPanel />;
    case 'register': return <Register />;
    case 'brandwall': return <BrandWall />;
    case 'ridesummary': return <RideSummary id={ui.panelArg} />;
    case 'offline': return <OfflineReport />;
    case 'pause': return <Pause />;
    case 'map': return <FullMap />;
    case 'admin': return <AdminPortal />;
    case 'employee': return <EmployeePortal />;
    case 'customer': return <CustomerPortal />;
    default: return null;
  }
}
function RentBtn() {
  const act = useGame((s) => s.act);
  const res = useRes();
  return <div className="mt-3 rounded-lg bg-rose-500/20 p-2 text-xs"><b>Rent overdue.</b> <Btn small className="ml-2" onClick={() => res(act((s) => payRentDue(s)))}>Pay rent now</Btn></div>;
}
