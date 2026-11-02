import { useState } from 'react';
import { useGame } from '../game/store';
import { rt } from '../game/runtime';
import { Bar, Btn, inr, Logo, WEATHER_NAME } from './common';
import { toggleOnline, startNavigation, clearNavigation } from '../game/actions';
import { transferToSavings, withdrawSavings } from '../game/logic/life';
import { SAVINGS_TARGET } from '../game/data';
import { pois, districtAt, DISTRICTS } from '../game/world/city';
import { DynamicPricingController } from '../game/fare/DynamicPricingController';
import { FARE_RULES } from '../game/fare/rules';
import { dayOf, fmtTime } from '../game/util';
import { playerRating } from '../game/state';
import { setVolume } from '../game/audio';
import { LocalSaveRepository } from '../game/persistence';

function Header({ title, back }: { title: string; back: () => void }) {
  return <div className="mb-2 flex items-center gap-2"><button onClick={back} className="rounded-lg bg-white/10 px-2 py-0.5 text-sm">‹</button><b>{title}</b></div>;
}

function PillionGo() {
  const g = useGame((s) => s.g)!;
  const today = dayOf(g.time);
  const todays = g.personalRides.filter((r) => r.day === today);
  const earn = todays.reduce((a, r) => a + r.fare, 0);
  const px = rt.mode === 'walk' ? rt.walk.x : rt.bike.x, pz = rt.mode === 'walk' ? rt.walk.z : rt.bike.z;
  const ctx = DynamicPricingController.context({ district: districtAt(px, pz), timeMin: g.time, weather: g.weather, hubTrip: false });
  return (
    <div className="space-y-2 text-sm">
      <div className="rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 p-3">
        <div className="text-xs opacity-80">PillionGo · Independent rider</div>
        <div className="mt-1 flex items-center justify-between"><div><div className="text-lg font-black">{g.player.online ? 'You are ONLINE' : 'You are offline'}</div><div className="text-[11px] opacity-80">Rider rating ★ {playerRating(g).toFixed(2)} · {g.player.ridesDone} rides</div></div>
          <button onClick={toggleOnline} className={`rounded-full px-4 py-2 text-xs font-black ${g.player.online ? 'bg-rose-500' : 'bg-white text-emerald-800'}`}>{g.player.online ? 'GO OFFLINE' : 'GO ONLINE'}</button></div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-center"><div className="rounded-lg bg-white/10 p-2"><div className="text-[10px] text-slate-400">Today</div><b className="text-emerald-300">{inr(earn)}</b></div><div className="rounded-lg bg-white/10 p-2"><div className="text-[10px] text-slate-400">Wallet</div><b>{inr(g.wallet)}</b></div></div>
      <div className="rounded-lg bg-white/5 p-2 text-[11px] text-slate-300">
        <b className="text-white">Live pricing · {DISTRICTS[districtAt(px, pz)].name}</b>
        <div>Demand: {ctx.label} ({ctx.demandPct >= 0 ? '+' : ''}{Math.round(ctx.demandPct * 100)}%) · Weather: {WEATHER_NAME[g.weather]}</div>
        <div className="mt-1 text-slate-400">Fares are calculated automatically by the game: ₹{FARE_RULES.baseFare} base + ₹{FARE_RULES.perKm}/km + ₹{FARE_RULES.perMinute}/min ± demand, weather & night adjustments. Your earnings go to your personal wallet.</div>
      </div>
      <div className="text-xs font-bold text-slate-300">Recent rides</div>
      {[...g.personalRides].reverse().slice(0, 7).map((r) => <div key={r.id} className="flex justify-between rounded-lg bg-white/5 px-2 py-1 text-[11px]"><span className="truncate pr-2">{r.from.split(' #')[0]} → {r.to.split(' #')[0]}</span><b className="text-emerald-300">{inr(r.fare)} {'★'.repeat(r.rating)}</b></div>)}
      {!g.personalRides.length && <div className="text-[11px] text-slate-500">Go online, accept a request and ride to the pickup point.</div>}
    </div>
  );
}

const KEYPLACES = ['home', 'bank', 'regoffice', 'hq', 'dealer', 'garage1', 'petrol1', 'petrol2', 'petrol3', 'hosp1', 'hosp2', 'police1', 'rest1', 'rest2', 'rest4', 'shop1', 'shop2', 'railway', 'bus', 'airport', 'mall', 'beach', 'it1'];
function MapsApp() {
  const g = useGame((s) => s.g)!;
  return (
    <div className="space-y-1 text-sm">
      <Btn small tone="slate" onClick={clearNavigation}>Clear GPS route</Btn>
      {KEYPLACES.map((id) => pois.find((p) => p.id === id)).filter(Boolean).map((p) => (
        <div key={p!.id} className="flex items-center justify-between rounded-lg bg-white/5 px-2 py-1 text-[11px]"><span className="truncate pr-1">{p!.name}</span><Btn small tone="blue" onClick={() => startNavigation(p!.id)}>Go</Btn></div>
      ))}
      {g.company?.branches.filter((b) => b.id !== 'hq').map((b) => <div key={b.id} className="flex items-center justify-between rounded-lg bg-white/5 px-2 py-1 text-[11px]"><span>{b.name}</span><Btn small tone="blue" onClick={() => startNavigation(b.poiId)}>Go</Btn></div>)}
    </div>
  );
}

export function BankApp() {
  const act = useGame((s) => s.act);
  const g = useGame((s) => s.g)!;
  const toast = useGame((s) => s.toast);
  const [amt, setAmt] = useState('500');
  const n = Math.max(0, Math.round(Number(amt) || 0));
  const ledger = g.ledger.filter((l) => l.account !== 'company').slice(-12).reverse();
  return (
    <div className="space-y-2 text-sm">
      <div className="grid grid-cols-2 gap-2"><div className="rounded-lg bg-white/10 p-2"><div className="text-[10px] text-slate-400">Personal wallet</div><b className="text-emerald-300">{inr(g.wallet)}</b></div><div className="rounded-lg bg-white/10 p-2"><div className="text-[10px] text-slate-400">Personal savings</div><b className="text-sky-300">{inr(g.savings)}</b></div></div>
      {!g.company && <div><div className="text-[11px] text-slate-400">Company-start goal ₹1,00,000 — {Math.floor((g.savings / SAVINGS_TARGET) * 100)}%</div><Bar value={(g.savings / SAVINGS_TARGET) * 100} color="bg-sky-400" /></div>}
      {!g.company && g.savings >= SAVINGS_TARGET && <div className="rounded-lg bg-amber-500/20 p-2 text-[11px] text-amber-200">🎉 Goal reached! Visit the City Registrar (central city) to register your company.</div>}
      <div className="flex gap-1"><input value={amt} onChange={(e) => setAmt(e.target.value)} className="w-full rounded-lg bg-black/40 px-2 py-1 text-sm" inputMode="numeric" /></div>
      <div className="flex gap-1"><Btn small tone="blue" onClick={() => toast(act((s) => transferToSavings(s, n)).message)}>Wallet → Savings</Btn><Btn small tone="slate" onClick={() => toast(act((s) => withdrawSavings(s, n)).message)}>Savings → Wallet</Btn></div>
      <div className="text-[10px] text-slate-500">Savings are never mixed with the company account; they fund company registration only when you register.</div>
      <div className="text-xs font-bold text-slate-300">Personal transactions</div>
      {ledger.map((l) => <div key={l.id} className="flex justify-between rounded bg-white/5 px-2 py-0.5 text-[10px]"><span className="truncate pr-2">{l.label}</span><b className={l.amount >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{l.amount >= 0 ? '+' : ''}{inr(l.amount)}</b></div>)}
    </div>
  );
}

function Contacts() {
  const g = useGame((s) => s.g)!;
  const toast = useGame((s) => s.toast);
  const c = g.company;
  const rows: [string, string][] = [['Landlord (Mr. Mariappan)', g.player.rentOverdue ? 'Rent overdue — pay at your table' : `Rent paid until day ${g.player.rentPaidUntilDay + 1}`], ['Bharat Union Bank', c ? 'Business loans available' : 'Register a company first'], ['Traffic police helpline', 'Fines due: ' + inr(g.player.finesDue)]];
  return (
    <div className="space-y-1 text-sm">
      {rows.map(([n, d]) => <button key={n} onClick={() => toast(`${n}: ${d}`)} className="w-full rounded-lg bg-white/5 px-2 py-1.5 text-left"><b className="text-xs">{n}</b><div className="text-[10px] text-slate-400">{d}</div></button>)}
      {c?.employees.filter((e) => e.status !== 'resigned' && e.status !== 'terminated').map((e) => <button key={e.id} onClick={() => toast(`${e.name}: ${e.online ? 'on duty' : 'off duty'}, ★${e.rating.toFixed(1)}`)} className="w-full rounded-lg bg-white/5 px-2 py-1.5 text-left"><b className="text-xs">{e.name}</b><div className="text-[10px] text-slate-400">{e.role} · {e.status} · {e.online ? '🟢 online' : '⚪ offline'}</div></button>)}
    </div>
  );
}

function Notifs() {
  const g = useGame((s) => s.g)!;
  return <div className="space-y-1">{[...g.notifications].reverse().slice(0, 25).map((n) => <div key={n.id} className={`rounded-lg border-l-4 bg-white/5 px-2 py-1 text-[11px] ${n.type === 'bad' ? 'border-rose-400' : n.type === 'good' ? 'border-emerald-400' : n.type === 'warn' ? 'border-amber-400' : 'border-sky-400'}`}><span className="text-slate-500">{fmtTime(n.time)} · </span>{n.text}</div>)}</div>;
}

export function SettingsBody() {
  const g = useGame((s) => s.g)!;
  const act = useGame((s) => s.act);
  const save = useGame((s) => s.save);
  const info = LocalSaveRepository.info();
  return (
    <div className="space-y-3 text-sm">
      <label className="block text-xs">Volume {Math.round(g.settings.volume * 100)}%<input type="range" min={0} max={1} step={0.05} value={g.settings.volume} onChange={(e) => { const v = Number(e.target.value); setVolume(v); act((s) => { s.settings.volume = v; }); }} className="w-full" /></label>
      <label className="block text-xs">Game speed (time scale): {g.settings.timeScale}×<input type="range" min={1} max={4} step={1} value={g.settings.timeScale} onChange={(e) => act((s) => { s.settings.timeScale = Number(e.target.value); })} className="w-full" /></label>
      <div className="flex items-center gap-2 text-xs">Graphics:
        {(['low', 'medium', 'high'] as const).map((q) => <Btn key={q} small tone={g.settings.quality === q ? 'amber' : 'slate'} onClick={() => act((s) => { s.settings.quality = q; })}>{q}</Btn>)}
      </div>
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={g.settings.shadows} onChange={(e) => act((s) => { s.settings.shadows = e.target.checked; })} /> Shadows</label>
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={g.settings.invertCam} onChange={(e) => act((s) => { s.settings.invertCam = e.target.checked; })} /> Invert camera drag</label>
      <div className="flex flex-wrap items-center gap-2"><Btn small onClick={() => save('manual')}>💾 Save now</Btn><span className="text-[11px] text-slate-400">Primary save: {info.savedAt ? new Date(info.savedAt).toLocaleTimeString() : 'none'} · backup {info.hasBackup ? 'available' : 'none'}</span></div>
    </div>
  );
}

const APPS = [
  { id: 'pillion', icon: '🛵', name: 'PillionGo' }, { id: 'maps', icon: '🗺️', name: 'Maps' }, { id: 'bank', icon: '🏦', name: 'Bank' },
  { id: 'contacts', icon: '👥', name: 'Contacts' }, { id: 'notifs', icon: '🔔', name: 'Alerts' }, { id: 'settings', icon: '⚙️', name: 'Settings' },
];

export function Phone() {
  const ui = useGame((s) => s.ui);
  const g = useGame((s) => s.g)!;
  const setPhone = useGame((s) => s.setPhone);
  const openPanel = useGame((s) => s.openPanel);
  const c = g.company;
  const app = ui.phoneApp;
  return (
    <div className="absolute bottom-4 right-4 z-30 flex h-[600px] w-[320px] flex-col overflow-hidden rounded-[2rem] border-[6px] border-slate-950 bg-slate-900 text-slate-100 shadow-2xl">
      <div className="flex items-center justify-between bg-slate-950 px-4 py-1 text-[10px]"><span>{fmtTime(g.time)}</span><span>📶 5G 🔋</span></div>
      <div className="flex-1 overflow-y-auto p-3">
        {!app ? (
          <div>
            <div className="mb-3 text-center text-xs text-slate-400">{c ? c.branding.name : 'My phone'}</div>
            <div className="grid grid-cols-3 gap-3">
              {APPS.map((a) => <button key={a.id} onClick={() => setPhone(true, a.id)} className="flex flex-col items-center gap-1 rounded-xl bg-white/5 p-2 hover:bg-white/10"><span className="text-2xl">{a.icon}</span><span className="text-[10px]">{a.name}</span></button>)}
              {c && <>
                <button onClick={() => openPanel('customer')} className="flex flex-col items-center gap-1 rounded-xl bg-white/5 p-2 hover:bg-white/10"><Logo shape={c.branding.logoShape} icon={c.branding.logoIcon} color={c.branding.primary} secondary={c.branding.secondary} size={34} /><span className="text-[10px]">Customer</span></button>
                <button onClick={() => openPanel('employee')} className="flex flex-col items-center gap-1 rounded-xl bg-white/5 p-2 hover:bg-white/10"><Logo shape={c.branding.logoShape} icon="🧑‍✈️" color={c.branding.primary} secondary={c.branding.secondary} size={34} /><span className="text-[10px]">Driver</span></button>
                <button onClick={() => openPanel('admin')} className="flex flex-col items-center gap-1 rounded-xl bg-white/5 p-2 hover:bg-white/10"><Logo shape={c.branding.logoShape} icon="📊" color="#0f172a" secondary={c.branding.secondary} size={34} /><span className="text-[10px]">Admin</span></button>
              </>}
            </div>
            {!c && <div className="mt-4 rounded-lg bg-white/5 p-2 text-[11px] text-slate-400">Company customer, driver and admin portals unlock after you register your transportation company.</div>}
          </div>
        ) : (
          <div>
            <Header title={APPS.find((a) => a.id === app)?.name ?? ''} back={() => setPhone(true, null)} />
            {app === 'pillion' && <PillionGo />}
            {app === 'maps' && <MapsApp />}
            {app === 'bank' && <BankApp />}
            {app === 'contacts' && <Contacts />}
            {app === 'notifs' && <Notifs />}
            {app === 'settings' && <SettingsBody />}
          </div>
        )}
      </div>
      <button onClick={() => setPhone(false)} className="bg-slate-950 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800">Close phone (F)</button>
    </div>
  );
}
