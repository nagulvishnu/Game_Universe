import type { Bike, Employee, GameState, RideRecord } from '../types';
import { FARE_RULES } from '../fare/rules';
import { finalizeFare, RouteFareEstimator } from '../fare/FareEngine';
import { settleCompanyRide, settleCustomerAdjustment } from '../fare/RidePaymentService';
import { adjustRep, bikeCondition, companyTx, dayNow, hourNow, notify, rint, rnd } from '../state';
import { computeRoute, DISTRICTS, poiById } from '../world/city';
import { canOperate } from './people';
import { modelOf } from '../data';
import { clamp } from '../util';
import { trafficFactor } from './rideBuilder';

export function bikeOf(s: GameState, e: Employee): Bike | undefined {
  return s.company?.bikes.find((b) => b.id === e.bikeId);
}

export function employeeAvailable(s: GameState, e: Employee): boolean {
  if (!canOperate(e, dayNow(s)) || !e.online || e.rideId) return false;
  const b = bikeOf(s, e);
  if (!b || b.owner !== 'company' || b.status !== 'parked') return false;
  return b.fuel > 0.06 && bikeCondition(b) >= 15;
}

export function employeeCovers(s: GameState, e: Employee, px: number, pz: number, district: string): boolean {
  const br = s.company?.branches.find((x) => x.id === e.branchId);
  if (!br || br.status !== 'open') return false;
  return br.district === district || Math.hypot(e.posX - px, e.posZ - pz) < 420;
}

/** Match a requested ride to the best suitable available employee. Employee may reject. */
export function dispatchRide(s: GameState, ride: RideRecord): boolean {
  const c = s.company;
  if (!c || ride.status !== 'requested') return false;
  const cands = c.employees
    .filter((e) => employeeAvailable(s, e) && employeeCovers(s, e, ride.pickup.x, ride.pickup.z, ride.pickup.district))
    .map((e) => {
      const r = computeRoute(e.posX, e.posZ, ride.pickup.x, ride.pickup.z);
      return { e, r, score: r.meters - e.rating * 40 - e.skill * 1.2 - e.reliability * 0.8 + e.fatigue * 2 };
    })
    .filter((x) => x.r.meters < 1800)
    .sort((a, b) => a.score - b.score);
  for (const { e, r } of cands) {
    const rainy = s.weather === 'heavyRain' || s.weather === 'thunderstorm';
    const acceptP = clamp(0.55 + e.reliability * 0.004 - e.fatigue * 0.003 - (rainy ? 0.1 : 0) + (ride.urgent ? 0.05 : 0), 0.15, 0.97);
    if (rnd(s) > acceptP) { e.notifications.push(`Declined ride ${ride.id} (${ride.pickup.label})`); continue; }
    const tf = trafficFactor(hourNow(s), s.weather);
    const skillF = 1.15 - e.skill / 400;
    const pickupMin = Math.max(1, RouteFareEstimator.durationMin(RouteFareEstimator.fareKm(r.meters), tf) * skillF);
    const rideMin = ride.estimate.durationMin * skillF * (0.97 + rnd(s) * 0.12);
    const delay = ride.customerDelayMin ?? 0;
    ride.driverId = e.id; ride.bikeId = e.bikeId; ride.branchId = e.branchId;
    ride.pickupMeters = r.meters; ride.pickupPts = r.pts;
    ride.assignedAt = s.time; ride.status = 'enroute';
    ride.eta = { pickupEnd: s.time + pickupMin, waitEnd: s.time + pickupMin + delay, rideEnd: s.time + pickupMin + delay + rideMin };
    e.rideId = ride.id; e.state = 'busy';
    e.notifications.push(`New ride ${ride.pickup.label} → ${ride.dest.label} · est ₹${ride.estimate.total}`);
    return true;
  }
  return false;
}

function starsFor(s: GameState, e: Employee, b: Bike | undefined, ride: RideRecord, accident: boolean): number {
  let v = 4.3 + (e.service - 60) / 60 + (e.skill - 60) / 130 - (e.fatigue > 60 ? 0.45 : 0) - (b && bikeCondition(b) < 40 ? 0.6 : 0);
  const waitedForDriver = ride.arrivedAt && ride.assignedAt ? ride.arrivedAt - ride.assignedAt : 0;
  if (waitedForDriver > 14) v -= 0.5;
  if (ride.category === 'premium') v -= 0.3;
  if (ride.passenger.personality === 'demanding') v -= 0.3;
  if (ride.passenger.personality === 'friendly') v += 0.2;
  if (accident) v -= 2.2;
  v += (rnd(s) - 0.5) * 1.4;
  return clamp(Math.round(v), 1, 5);
}

function applyWear(s: GameState, e: Employee, b: Bike, ride: RideRecord) {
  const worldKm = (ride.pickupMeters + ride.routeMeters) / 1000;
  b.odometerKm += worldKm;
  b.oil = Math.max(0, b.oil - worldKm * 0.8);
  b.tyres = Math.max(0, b.tyres - worldKm * 0.6 / (1 + b.upgrades.tyre * 0.2));
  b.brakes = Math.max(0, b.brakes - worldKm * 0.6 / (1 + b.upgrades.brake * 0.2));
  // fuel use (company fuel policy: company pays) in fare-km at ~55-70 km/L (commuter bikes)
  const litres = (ride.final?.distanceKm ?? ride.estimate.distanceKm) / 55 + RouteFareEstimator.fareKm(ride.pickupMeters) / 70;
  b.fuel = Math.max(0, b.fuel - litres / modelOf(b.modelId).tank);
  if (b.fuel < 0.25) {
    const need = (0.9 - b.fuel) * modelOf(b.modelId).tank;
    const cost = Math.round(need * 105);
    if (companyTx(s, -cost, 'expense', 'fuel', `Fuel top-up ${b.plate} (${need.toFixed(1)} L)`, { branchId: e.branchId, allowNegative: true })) b.fuel = 0.9;
  }
  e.fatigue = clamp(e.fatigue + 2.2, 0, 100);
}

const RISK: Record<string, number> = { sunny: 1, cloudy: 1, lightRain: 1.3, heavyRain: 1.8, thunderstorm: 2.2, fog: 1.5 };
function maybeAccident(s: GameState, e: Employee, b: Bike, ride: RideRecord): boolean {
  const p = 0.004 * (1.6 - e.safety / 100 - e.skill / 200) * RISK[s.weather] * (1 + (100 - bikeCondition(b)) / 100) * (1 + e.fatigue / 100);
  if (rnd(s) > p) return false;
  const c = s.company!;
  const r = rnd(s);
  const sev = r < 0.6 ? 'minor' : r < 0.9 ? 'fall' : 'serious';
  const dmg = sev === 'minor' ? rint(s, 4, 10) : sev === 'fall' ? rint(s, 12, 26) : rint(s, 35, 60);
  const cost = sev === 'minor' ? rint(s, 800, 2200) : sev === 'fall' ? rint(s, 2500, 7000) : rint(s, 9000, 22000);
  const hours = sev === 'minor' ? 3 : sev === 'fall' ? 12 : 48;
  b.damage = Math.min(100, b.damage + dmg);
  b.status = 'repair'; b.repairUntil = s.time + hours * 60;
  const ins = b.insurance;
  let covered = 0;
  if (ins.plan !== 'none' && ins.expiresDay > dayNow(s)) {
    const pct = ins.plan === 'comprehensive' ? 0.8 : 0.5, lim = ins.plan === 'comprehensive' ? 60000 : 20000;
    covered = Math.min(lim, Math.round(cost * pct));
  }
  const net = cost - covered;
  companyTx(s, -net, 'expense', 'repairs', `Accident repair ${b.plate} (${sev}); insurer paid ₹${covered}`, { branchId: e.branchId, allowNegative: true });
  c.insuranceClaimsPaid += covered;
  let medical = 0;
  if (sev === 'serious' || (sev === 'fall' && rnd(s) < 0.3)) {
    medical = sev === 'serious' ? rint(s, 8000, 20000) : rint(s, 1500, 4000);
    companyTx(s, -medical, 'expense', 'medical', `Medical costs (${e.name})`, { branchId: e.branchId, allowNegative: true });
  }
  e.accidents += 1; e.safety = Math.max(5, e.safety - (sev === 'serious' ? 8 : 3));
  c.accidentsTotal += 1;
  adjustRep(s, sev === 'minor' ? -1 : sev === 'fall' ? -2.5 : -6);
  e.history.push({ day: dayNow(s), text: `${sev} accident on ride ${ride.id}` });
  e.notifications.push(`Accident (${sev}). Bike ${b.plate} sent for repair (~${hours}h).`);
  if (sev === 'serious') { e.status = 'suspended'; e.suspendedUntilDay = dayNow(s) + 7; e.online = false; }
  if (e.accidents >= 5) { e.status = 'suspended'; e.suspendedUntilDay = dayNow(s) + 14; }
  e.state = 'noBike';
  notify(s, `${sev === 'minor' ? 'Minor collision' : sev === 'fall' ? 'Motorcycle fall' : 'SERIOUS ACCIDENT'}: ${e.name} · repair ₹${net} (insurer ₹${covered})${medical ? ` · medical ₹${medical}` : ''}`, sev === 'serious' ? 'bad' : 'warn');
  return true;
}

export function completeCompanyRide(s: GameState, ride: RideRecord) {
  const c = s.company;
  const e = c?.employees.find((x) => x.id === ride.driverId);
  if (!c || !e) { ride.status = 'cancelled'; ride.cancelledBy = 'system'; return; }
  const b = bikeOf(s, e);
  const est = ride.estimate;
  const dur = est.durationMin * (0.97 + rnd(s) * 0.12) * (1.15 - e.skill / 400);
  const wait = ride.customerDelayMin ?? 0;
  const fin = finalizeFare(est, ride.pricing, { distanceKm: est.distanceKm, durationMin: dur, customerWaitMin: wait }, FARE_RULES);
  ride.final = fin;
  ride.explanation = fin.total === est.total ? 'Final fare matches the estimate.' : `Final ₹${fin.total} vs estimate ₹${est.total}${fin.waiting ? ` (₹${fin.waiting} customer waiting charge)` : ''}.`;
  ride.status = 'completed'; ride.completedAt = s.time;
  if (ride.source === 'customerApp' && ride.prepaid) ride.explanation += ' ' + settleCustomerAdjustment(s, ride, fin.total);
  settleCompanyRide(s, ride, e, fin.total);
  c.ridesTotal += 1;
  const br = c.branches.find((x) => x.id === ride.branchId);
  if (br) br.rides += 1;
  const acc = b ? maybeAccident(s, e, b, ride) : false;
  if (b) applyWear(s, e, b, ride);
  const stars = starsFor(s, e, b, ride, acc);
  ride.rating = stars;
  e.rating = (e.rating * e.ratingCount + stars) / (e.ratingCount + 1); e.ratingCount += 1;
  c.ratingSum += stars; c.ratingCount += 1;
  adjustRep(s, stars >= 5 ? 0.25 : stars === 4 ? 0.08 : stars === 3 ? -0.15 : -0.6);
  if (stars <= 2 && rnd(s) < 0.45) {
    e.complaints += 1;
    c.complaints.push({ id: `C${ride.id}`, day: dayNow(s), rideId: ride.id, employeeId: e.id, text: acc ? 'Accident during ride' : pick2(s), resolved: false });
    ride.complaint = 'filed';
    adjustRep(s, -0.8);
  }
  if (!acc) e.state = 'idle';
  e.rideId = undefined;
  const d = poiById.get(ride.dest.poiId);
  if (d) { e.posX = d.x; e.posZ = d.z; }
  if (s.stats) s.stats.companyRides = (s.stats.companyRides ?? 0) + 1;
}
const pick2 = (s: GameState) => ['Rude behaviour', 'Late pickup', 'Rash riding', 'Dirty motorcycle', 'Wrong route taken'][Math.floor(rnd(s) * 5)];

/** Advance all company rides according to their ETA timeline. */
export function progressCompanyRides(s: GameState) {
  const c = s.company;
  if (!c) return;
  for (const ride of s.rides) {
    if (ride.driverType !== 'employee') continue;
    if (ride.status === 'requested') {
      if (!dispatchRide(s, ride) && s.time - ride.requestedAt > 12) {
        ride.status = 'expired';
        if (ride.prepaid) { settleExpiredBooking(s, ride); }
        adjustRep(s, -0.3);
        if (s.myBooking === ride.id) { notify(s, 'No driver available — your booking expired and was refunded.', 'warn'); }
      }
      continue;
    }
    if (!ride.eta || ride.status === 'completed' || ride.status === 'cancelled') continue;
    if (ride.status === 'enroute' && s.time >= ride.eta.pickupEnd) { ride.status = 'arrived'; ride.arrivedAt = ride.eta.pickupEnd; }
    if (ride.status === 'arrived' && s.time >= ride.eta.waitEnd) { ride.status = 'inprogress'; ride.startedAt = ride.eta.waitEnd; }
    if (ride.status === 'inprogress' && s.time >= ride.eta.rideEnd) completeCompanyRide(s, ride);
  }
}

function settleExpiredBooking(s: GameState, ride: RideRecord) {
  const held = ride.prepaid ?? 0;
  if (held > 0) { s.wallet += held; s.ledger.push({ id: s.ledgerSeq++, time: s.time, account: 'wallet', kind: 'income', category: 'customer-ride', label: `Refund (no driver) ${ride.id}`, amount: held, balanceAfter: s.wallet }); ride.refunded = held; ride.prepaid = 0; }
}
export { DISTRICTS };
