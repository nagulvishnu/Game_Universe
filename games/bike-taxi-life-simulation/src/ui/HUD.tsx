import { useEffect, useRef, useState } from 'react';
import { useGame } from '../game/store';
import { rt, useHud } from '../game/runtime';
import { DISTRICTS, DISTRICT_ORDER, districtOfBlock, NXB, NZB, P, pois, RW, WORLD_D, WORLD_W } from '../game/world/city';
import { acceptOfferAction, cancelRideAction, declineOfferAction } from '../game/actions';
import { activeRide } from '../game/logic/rides';
import { Bar, inr, WEATHER_ICON, WEATHER_NAME } from './common';
import { dayName, dayOf, fmtTime } from '../game/util';
import { SAVINGS_TARGET } from '../game/data';
import { bikeCondition } from '../game/state';

let cityImg: HTMLCanvasElement | null = null;
const S = 0.55; // px per metre in the cached city image
const PAD = 70;
function getCityImage() {
  if (cityImg) return cityImg;
  const c = document.createElement('canvas');
  c.width = Math.ceil((WORLD_W + PAD * 2 + 80) * S); c.height = Math.ceil((WORLD_D + PAD * 2) * S);
  const g = c.getContext('2d')!;
  g.fillStyle = '#0c1a2b'; g.fillRect(0, 0, c.width, c.height);
  const X = (x: number) => (x + PAD) * S, Z = (z: number) => (z + PAD) * S;
  g.fillStyle = '#1e7fa6'; g.fillRect(X(WORLD_W + 55), 0, c.width, c.height);
  g.fillStyle = '#d9c99c'; g.fillRect(X(WORLD_W), 0, 55 * S, c.height);
  for (let j = 0; j < NZB; j++) for (let i = 0; i < NXB; i++) {
    const d = districtOfBlock(i, j);
    g.fillStyle = DISTRICTS[d].color + '88';
    g.fillRect(X(i * P + RW / 2), Z(j * P + RW / 2), (P - RW) * S, (P - RW) * S);
  }
  g.strokeStyle = '#cbd5e1'; g.lineWidth = RW * S * 0.55; g.lineCap = 'butt';
  for (let j = 0; j <= NZB; j++) { g.beginPath(); g.moveTo(X(0), Z(j * P)); g.lineTo(X(WORLD_W), Z(j * P)); g.stroke(); }
  for (let i = 0; i <= NXB; i++) { g.beginPath(); g.moveTo(X(i * P), Z(0)); g.lineTo(X(i * P), Z(WORLD_D)); g.stroke(); }
  cityImg = c;
  return c;
}
const POI_COLOR: Record<string, string> = { home: '#22d3ee', hq: '#f59e0b', branch: '#f59e0b', bank: '#60a5fa', regoffice: '#a78bfa', garage: '#9ca3af', petrol: '#f43f5e', hospital: '#ef4444', police: '#3b82f6', dealership: '#818cf8', restaurant: '#fb923c', shop: '#34d399', railway: '#fbbf24', bus: '#2dd4bf', airport: '#38bdf8' };

export function MapCanvas({ size, full, onPick }: { size: number; full?: boolean; onPick?: (x: number, z: number) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const company = useGame((s) => s.g?.company);
  useEffect(() => {
    const draw = () => {
      const cv = ref.current;
      if (!cv) return;
      const g = cv.getContext('2d')!;
      const img = getCityImage();
      const px = rt.mode === 'walk' ? rt.walk.x : rt.bike.x, pz = rt.mode === 'walk' ? rt.walk.z : rt.bike.z;
      const heading = rt.mode === 'walk' ? rt.walk.heading : rt.bike.heading;
      g.clearRect(0, 0, size, size);
      let toPx: (x: number, z: number) => [number, number];
      g.save();
      if (full) {
        const sc = Math.min(size / img.width, size / img.height);
        g.drawImage(img, 0, 0, img.width * sc, img.height * sc);
        toPx = (x, z) => [(x + PAD) * S * sc, (z + PAD) * S * sc];
      } else {
        const view = 260; // metres across
        const scale = size / view;
        g.beginPath(); g.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); g.clip();
        g.translate(size / 2, size / 2); g.rotate(heading + Math.PI); g.scale(scale / S, scale / S);
        g.drawImage(img, -(px + PAD) * S, -(pz + PAD) * S);
        toPx = (x, z) => {
          const dx = (x - px) * scale, dz = (z - pz) * scale;
          const c = Math.cos(heading + Math.PI), s = Math.sin(heading + Math.PI);
          return [size / 2 + dx * c - dz * s, size / 2 + dx * s + dz * c];
        };
        g.setTransform(1, 0, 0, 1, 0, 0);
      }
      // route
      const route = rt.route;
      if (route && route.length > 1) {
        g.strokeStyle = '#38bdf8'; g.lineWidth = full ? 4 : 3; g.lineJoin = 'round'; g.beginPath();
        route.forEach(([x, z], i) => { const [a, b] = toPx(x, z); if (i) g.lineTo(a, b); else g.moveTo(a, b); });
        g.stroke();
      }
      for (const p of pois) {
        if (!POI_COLOR[p.kind] || (!full && Math.hypot(p.x - px, p.z - pz) > 170)) continue;
        if (p.kind === 'branch' && !company?.branches.some((b) => b.poiId === p.id)) continue;
        const [a, b] = toPx(p.x, p.z);
        g.fillStyle = POI_COLOR[p.kind]; g.beginPath(); g.arc(a, b, full ? 5 : 3.2, 0, 7); g.fill();
        g.strokeStyle = '#0008'; g.lineWidth = 1; g.stroke();
        if (full && ['home', 'hq', 'bank', 'regoffice', 'hospital', 'airport', 'railway', 'dealership', 'police', 'bus'].includes(p.kind)) { g.fillStyle = '#fff'; g.font = '10px sans-serif'; g.fillText(p.name.split(' — ')[0].slice(0, 22), a + 7, b + 3); }
      }
      for (const v of rt.traffic) { if (v.kind !== 'police') continue; const [a, b] = toPx(v.x, v.z); g.fillStyle = '#60a5fa'; g.fillRect(a - 2, b - 2, 4, 4); }
      const t = rt.target;
      if (t) { const [a, b] = toPx(t.x, t.z); g.fillStyle = t.kind === 'pickup' ? '#22c55e' : t.kind === 'dest' ? '#f59e0b' : '#38bdf8'; g.beginPath(); g.arc(a, b, 7, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); }
      const [ax, az] = toPx(px, pz);
      g.save(); g.translate(ax, az); g.rotate(full ? -heading : Math.PI); g.fillStyle = '#fff'; g.strokeStyle = '#ef4444'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(0, 8); g.lineTo(6, -6); g.lineTo(0, -3); g.lineTo(-6, -6); g.closePath(); g.fill(); g.stroke(); g.restore();
      if (full) {
        g.font = 'bold 11px sans-serif'; g.fillStyle = '#fff';
        DISTRICT_ORDER.forEach((d) => { const bl = d === 'central' ? [4, 5] : d === 'residential' ? [1, 3] : d === 'it' ? [4, 2] : d === 'commercial' ? [6, 3] : d === 'coastal' ? [8, 6] : d === 'industrial' ? [1, 8] : [2, 0]; const [a, b] = toPx(bl[0] * P + P / 2 - 30, bl[1] * P + P / 2); g.fillText(DISTRICTS[d].name.toUpperCase(), a, b); });
      }
      g.restore();
    };
    draw();
    const id = setInterval(draw, full ? 250 : 100);
    return () => clearInterval(id);
  }, [size, full, company]);
  return (
    <canvas ref={ref} width={size} height={size} className={full ? 'rounded-xl border border-white/20' : 'rounded-full border-4 border-white/70 shadow-xl'}
      style={{ width: size, height: size, cursor: onPick ? 'crosshair' : undefined }}
      onClick={(e) => {
        if (!onPick || !full) return;
        const r = (e.target as HTMLCanvasElement).getBoundingClientRect();
        const img = getCityImage(); const sc = Math.min(size / img.width, size / img.height);
        onPick(((e.clientX - r.left) / sc / S) - PAD, ((e.clientY - r.top) / sc / S) - PAD);
      }} />
  );
}

export function HUD() {
  const g = useGame((s) => s.g)!;
  const ui = useGame((s) => s.ui);
  const hud = useHud();
  const openPanel = useGame((s) => s.openPanel);
  const setPhone = useGame((s) => s.setPhone);
  const [shown, setShown] = useState<{ id: number; text: string; type: string; t: number }[]>([]);
  const lastSeq = useRef(g.notifSeq);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (g.notifSeq !== lastSeq.current) {
      const fresh = g.notifications.filter((n) => n.id >= lastSeq.current);
      lastSeq.current = g.notifSeq;
      setShown((p) => [...p, ...fresh.map((n) => ({ id: n.id, text: n.text, type: n.type, t: Date.now() }))].slice(-5));
    }
  }, [g.notifSeq, g.notifications]);
  useEffect(() => { const id = setInterval(() => { setNow(Date.now()); setShown((p) => p.filter((n) => Date.now() - n.t < 6500)); }, 500); return () => clearInterval(id); }, []);

  const ride = activeRide(g);
  const c = g.company;
  const time = g.time;
  const bike = g.bikes.find((b) => b.id === g.player.bikeId);
  const savingsPct = Math.min(100, (g.savings / SAVINGS_TARGET) * 100);
  const col = { good: 'border-emerald-400 bg-emerald-950/90', bad: 'border-rose-400 bg-rose-950/90', warn: 'border-amber-400 bg-amber-950/90', info: 'border-sky-400 bg-slate-900/90' } as Record<string, string>;
  void now;
  return (
    <div className="pointer-events-none absolute inset-0 z-10 select-none text-white">
      {/* top-left */}
      <div className="absolute left-3 top-3 flex flex-col gap-2">
        <div className="pointer-events-auto rounded-xl bg-slate-900/80 px-3 py-2 shadow-lg backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="text-2xl font-black tabular-nums">{fmtTime(time)}</div>
            <div className="text-xs leading-tight text-slate-300"><div>{dayName(dayOf(time))} · Day {dayOf(time) + 1}</div><div>{WEATHER_ICON[g.weather]} {WEATHER_NAME[g.weather]}</div></div>
          </div>
          <div className="mt-1 text-[11px] font-semibold text-amber-300">📍 {hud.district}</div>
        </div>
        <div className="rounded-xl bg-slate-900/80 px-3 py-2 text-sm shadow-lg backdrop-blur">
          <div className="flex items-center justify-between gap-6"><span className="text-slate-300">👛 Wallet</span><b className="tabular-nums text-emerald-300">{inr(g.wallet)}</b></div>
          <div className="flex items-center justify-between gap-6"><span className="text-slate-300">🏦 Savings</span><b className="tabular-nums text-sky-300">{inr(g.savings)}</b></div>
          {c ? <div className="flex items-center justify-between gap-6"><span className="text-slate-300">🏢 Company</span><b className="tabular-nums text-amber-300">{inr(c.bank)}</b></div> : (
            <div className="mt-1"><div className="text-[10px] text-slate-400">Goal: save ₹1,00,000 to start your company</div><Bar value={savingsPct} color="bg-sky-400" /></div>
          )}
          {g.player.finesDue > 0 && <div className="mt-1 text-[11px] text-rose-300">⚠ Fines due {inr(g.player.finesDue)}</div>}
          {g.player.rentOverdue > 0 && <div className="mt-1 text-[11px] text-rose-300">⚠ Rent overdue — pay at home</div>}
        </div>
        <div className="pointer-events-auto flex gap-1.5">
          <button onClick={() => setPhone(!ui.phone)} className="rounded-lg bg-slate-900/80 px-3 py-1.5 text-xs font-bold hover:bg-slate-700">📱 Phone (F)</button>
          <button onClick={() => openPanel('map')} className="rounded-lg bg-slate-900/80 px-3 py-1.5 text-xs font-bold hover:bg-slate-700">🗺️ Map (M)</button>
          <button onClick={() => openPanel('pause')} className="rounded-lg bg-slate-900/80 px-3 py-1.5 text-xs font-bold hover:bg-slate-700">⏸ Esc</button>
        </div>
      </div>

      {/* minimap */}
      <div className="absolute right-3 top-3 flex flex-col items-end gap-2">
        <MapCanvas size={170} />
        {hud.distToTarget !== null && <div className="rounded-lg bg-slate-900/80 px-3 py-1 text-xs font-bold text-sky-300">🎯 {Math.round(hud.distToTarget)} m to destination</div>}
        <div className="rounded-lg bg-slate-900/70 px-2 py-1 text-[10px] text-slate-300">{ui.saveStatus}</div>
      </div>

      {/* offer */}
      {g.offer && (
        <div className="pointer-events-auto absolute left-1/2 top-4 w-[380px] -translate-x-1/2 rounded-2xl border-2 border-emerald-400 bg-slate-900/95 p-3 shadow-2xl">
          <div className="flex items-center justify-between"><b className="text-emerald-300">🛵 New ride request</b><span className="rounded bg-emerald-500 px-2 text-xs font-bold text-slate-900">{hud.offerLeft}s</span></div>
          <div className="mt-1 text-sm"><b>{g.offer.passenger.name}</b> · <span className="text-slate-300">{g.offer.passenger.kind} · {g.offer.passenger.personality}</span></div>
          <div className="mt-1 text-xs text-slate-300">📍 {g.offer.pickup.label} <span className="text-slate-500">({Math.round(g.offer.pickupMeters)} m away)</span></div>
          <div className="text-xs text-slate-300">🏁 {g.offer.dest.label} <span className="text-slate-500">({(g.offer.estimate.distanceKm).toFixed(1)} km · {Math.round(g.offer.estimate.durationMin)} min)</span></div>
          <div className="mt-2 flex items-center justify-between">
            <div><div className="text-2xl font-black text-amber-300">{inr(g.offer.estimate.total)}</div><div className="text-[10px] text-slate-400">{g.offer.pricing.label}{g.offer.estimate.demand ? ` ${g.offer.estimate.demand > 0 ? '+' : ''}₹${g.offer.estimate.demand}` : ''}{g.offer.estimate.surcharges.map((s) => ` · ${s.label} +₹${s.amount}`).join('')}</div></div>
            <div className="flex gap-2"><button onClick={declineOfferAction} className="rounded-lg bg-slate-700 px-3 py-2 text-sm font-bold hover:bg-slate-600">Reject (N)</button><button onClick={acceptOfferAction} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-900 hover:bg-emerald-400">Accept (Y)</button></div>
          </div>
        </div>
      )}

      {/* active ride */}
      {ride && (
        <div className="pointer-events-auto absolute left-3 top-[260px] w-[290px] rounded-xl border border-amber-400/60 bg-slate-900/90 p-3 text-sm shadow-xl">
          <div className="flex items-center justify-between"><b className="text-amber-300">Active ride</b><span className="rounded bg-white/10 px-2 text-[11px] uppercase">{ride.status === 'enroute' ? 'To pickup' : ride.status === 'arrived' ? 'At pickup' : 'On trip'}</span></div>
          <div className="mt-1 text-xs"><b>{ride.passenger.name}</b> <span className="text-slate-400">({ride.passenger.personality})</span></div>
          <div className="text-[11px] text-slate-300">📍 {ride.pickup.label}</div>
          <div className="text-[11px] text-slate-300">🏁 {ride.dest.label}</div>
          <div className="mt-1 flex items-center justify-between"><span className="text-lg font-black text-emerald-300">{inr(ride.estimate.total)}</span><span className="text-[10px] text-slate-400">{ride.estimate.distanceKm.toFixed(1)} km · {Math.round(ride.estimate.durationMin)} min</span></div>
          {hud.waiting && <div className="mt-1 rounded bg-amber-500/20 px-2 py-1 text-xs text-amber-200">{hud.waiting}</div>}
          {ride.status !== 'inprogress' && <button onClick={cancelRideAction} className="mt-2 w-full rounded-lg bg-rose-600/80 py-1 text-xs font-bold hover:bg-rose-500">Cancel ride</button>}
        </div>
      )}

      {/* notifications */}
      <div className="absolute right-3 top-[250px] flex w-[320px] flex-col gap-1.5">
        {shown.map((n) => <div key={n.id} className={`rounded-lg border-l-4 px-3 py-1.5 text-xs shadow-lg ${col[n.type]}`}>{n.text}</div>)}
      </div>

      {/* prompt */}
      {hud.prompt && <div className="absolute bottom-36 left-1/2 -translate-x-1/2 rounded-xl border border-amber-300 bg-slate-900/90 px-5 py-2 text-sm font-bold text-amber-200 shadow-xl">{hud.prompt}</div>}
      {ui.toast && <div className="absolute bottom-52 left-1/2 -translate-x-1/2 rounded-lg bg-black/80 px-4 py-2 text-sm">{ui.toast}</div>}
      {hud.lowGrip && hud.mode === 'ride' && <div className="absolute left-1/2 top-24 -translate-x-1/2 rounded-full bg-sky-900/80 px-3 py-1 text-xs font-bold text-sky-200">☔ Wet road — reduced grip & braking</div>}
      {g.needs.hunger < 20 || g.needs.thirst < 20 || g.needs.energy < 15 ? <div className="absolute left-1/2 top-16 -translate-x-1/2 rounded-full bg-rose-900/80 px-3 py-1 text-xs font-bold text-rose-200">{g.needs.hunger < 20 ? '🍽 You are hungry' : g.needs.thirst < 20 ? '💧 You are thirsty' : '😴 You are exhausted — go home and sleep'}</div> : null}

      {/* speedometer */}
      {(hud.mode === 'ride' || hud.mode === 'fallen') && (
        <div className="absolute bottom-4 left-4 w-[230px] rounded-2xl bg-slate-900/85 p-3 shadow-xl backdrop-blur">
          <div className="flex items-end justify-between">
            <div><span className="text-5xl font-black tabular-nums">{hud.speedKmh}</span><span className="ml-1 text-xs text-slate-400">km/h</span></div>
            <div className="text-right text-xs"><div className="text-slate-400">GEAR</div><div className="text-2xl font-black text-amber-300">{hud.speedKmh < 2 ? 'N' : hud.gear}</div></div>
          </div>
          <div className="mt-1 space-y-1">
            <Bar value={hud.fuel * 100} color={hud.fuel < 0.15 ? 'bg-rose-500' : 'bg-amber-400'} label="⛽ Fuel" />
            <Bar value={hud.cond} color={hud.cond < 40 ? 'bg-rose-500' : 'bg-emerald-400'} label="🛠 Bike condition" />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-slate-400"><span>{hud.headlights ? '💡 Lights ON' : 'Lights off'}</span><span>{hud.indicator === 1 ? '⬅ Indicator' : hud.indicator === 2 ? 'Indicator ➡' : ''}</span><span>{bike?.plate}</span></div>
        </div>
      )}

      {/* needs */}
      <div className="absolute bottom-4 left-1/2 flex w-[400px] -translate-x-1/2 gap-3 rounded-2xl bg-slate-900/75 px-4 py-2 backdrop-blur" style={{ marginLeft: (hud.mode === 'ride' || hud.mode === 'fallen') ? 20 : 0 }}>
        <Bar value={g.needs.energy} color="bg-yellow-400" label="⚡ Energy" /><Bar value={g.needs.hunger} color="bg-orange-400" label="🍛 Hunger" /><Bar value={g.needs.thirst} color="bg-sky-400" label="💧 Thirst" /><Bar value={g.needs.health} color="bg-rose-400" label="❤ Health" />
      </div>
      <div className="absolute bottom-4 right-4 hidden w-[230px] rounded-xl bg-slate-900/70 p-2 text-[10px] leading-relaxed text-slate-300 md:block">
        <b className="text-white">Controls</b> · W/S throttle/brake · A/D steer · Space handbrake · E interact · C camera · H horn · L lights · Z/X indicators · F phone · M map · Shift sprint · Mouse-drag/wheel: camera
      </div>
      <div className="absolute bottom-24 right-4 text-[11px] text-slate-300">{bike ? `${bikeCondition(bike) < 35 ? '🔧 Bike needs service!' : ''}` : ''}</div>
    </div>
  );
}
