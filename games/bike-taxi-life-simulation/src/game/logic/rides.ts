import type { GameState, RideRecord } from '../types';
import { FARE_RULES } from '../fare/rules';
import { cancellationFee, explainDifference, finalizeFare, RouteFareEstimator } from '../fare/FareEngine';
import { holdCustomerPayment, refundCompletedRide, settleCancellation, settlePersonalRide } from '../fare/RidePaymentService';
import { adjustRep, dayNow, hourNow, notify, playerRating, rnd, pick } from '../state';
import { districtAt, nearestPoi, poiById, RIDE_POIS, branchPoiId } from '../world/city';
import { categoryFor, pickDestination, planRide } from './rideBuilder';
import { dispatchRide } from './dispatch';
import { demandHourFactor, weatherDemandFactor } from '../fare/DemandAnalyzer';
import { clamp } from '../util';

/** Probability per real second that a new personal ride offer appears (while online & idle). */
export function offerChancePerSec(s: GameState): number {
  const h = demandHourFactor(hourNow(s));
  return 0.06 * h * weatherDemandFactor(s.weather) * (0.7 + playerRating(s) / 12);
}

export function generateOffer(s: GameState, px: number, pz: number): RideRecord | null {
  const near = RIDE_POIS.filter((p) => !['police', 'home'].includes(p.kind) && Math.hypot(p.x - px, p.z - pz) > 70 && Math.hypot(p.x - px, p.z - pz) < 520);
  if (!near.length) return null;
  const pickup = pick(s, near);
  const cat = categoryFor(s, pickup, hourNow(s));
  const dest = pickDestination(s, pickup, cat);
  const ride = planRide(s, 'personal', pickup, dest, cat, { type: 'player', fromX: px, fromZ: pz });
  s.offer = ride;
  return ride;
}

export function acceptOffer(s: GameState): RideRecord | null {
  const r = s.offer;
  if (!r || s.activeRideId) return null;
  r.status = 'enroute'; r.assignedAt = s.time;
  s.activeRideId = r.id;
  s.rides.unshift(r);
  trimRides(s);
  s.offer = null;
  return r;
}
export function declineOffer(s: GameState) { s.offer = null; }

export const activeRide = (s: GameState) => (s.activeRideId ? s.rides.find((r) => r.id === s.activeRideId) ?? null : null);

export function arriveAtPickup(s: GameState) {
  const r = activeRide(s);
  if (r && r.status === 'enroute') { r.status = 'arrived'; r.arrivedAt = s.time; notify(s, `Arrived. ${r.passenger.name} is coming out…`, 'info'); }
}
export function passengerReady(s: GameState): boolean {
  const r = activeRide(s);
  return !!r && r.status === 'arrived' && s.time >= (r.arrivedAt ?? 0) + (r.customerDelayMin ?? 0);
}
export function boardPassenger(s: GameState): boolean {
  const r = activeRide(s);
  if (!r || r.status !== 'arrived' || !passengerReady(s)) return false;
  r.status = 'inprogress'; r.startedAt = s.time;
  notify(s, `${r.passenger.name} boarded. Destination: ${r.dest.label}`, 'info');
  return true;
}

function personalStars(s: GameState, r: RideRecord, t: NonNullable<RideRecord['telemetry']>, lateRatio: number): number {
  let v = 5;
  v -= t.collisions * 1.2 + t.hardEvents * 0.25 + (t.speedingSec > 4 ? 0.7 : 0) + (lateRatio > 1.5 ? 0.6 : 0);
  if (r.passenger.personality === 'demanding') v -= 0.4;
  if (r.passenger.personality === 'friendly') v += 0.2;
  if (r.category === 'premium') v -= 0.3;
  v += (rnd(s) - 0.5) * 0.8;
  return clamp(Math.round(v), 1, 5);
}

export function completePersonalRide(s: GameState, t: NonNullable<RideRecord['telemetry']>): RideRecord | null {
  const r = activeRide(s);
  if (!r || r.status !== 'inprogress') return null;
  r.telemetry = t;
  const dur = RouteFareEstimator.actualDurationMin(t.elapsedSec, r.routeMeters, r.estimate.durationMin);
  const wait = Math.min(Math.max(0, (r.startedAt ?? 0) - (r.arrivedAt ?? 0)), r.customerDelayMin ?? 0);
  const fin = finalizeFare(r.estimate, r.pricing, { distanceKm: RouteFareEstimator.fareKm(t.distanceM), durationMin: dur, customerWaitMin: wait }, FARE_RULES);
  r.final = fin; r.status = 'completed'; r.completedAt = s.time;
  r.explanation = explainDifference(r.estimate, fin);
  settlePersonalRide(s, r, fin.total);
  const lateRatio = r.pickupMeters > 0 && r.assignedAt ? ((r.arrivedAt ?? s.time) - r.assignedAt) / Math.max(1, RouteFareEstimator.durationMin(RouteFareEstimator.fareKm(r.pickupMeters))) : 1;
  const stars = personalStars(s, r, t, lateRatio);
  r.rating = stars;
  s.player.ratingSum += stars; s.player.ratingCount += 1; s.player.ridesDone += 1;
  s.stats.ridesDone += 1; s.stats.distanceKm += t.distanceM / 1000;
  s.personalRides.push({ id: r.id, day: dayNow(s), fare: fin.total, category: r.category, rating: stars, from: r.pickup.label, to: r.dest.label });
  if (s.personalRides.length > 200) s.personalRides.shift();
  s.activeRideId = null;
  notify(s, `Ride complete: +₹${fin.total} · ${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}`, 'good');
  return r;
}

export function cancelPersonalRide(s: GameState) {
  const r = activeRide(s);
  if (!r) return;
  if (r.status === 'inprogress') return; // cannot abandon a passenger mid-ride
  r.status = 'cancelled'; r.cancelledBy = 'driver';
  s.player.ratingSum += 3; s.player.ratingCount += 1; // cancellations hurt the rating a bit
  s.activeRideId = null;
  notify(s, 'Ride cancelled (no charge to customer).', 'warn');
}

export function trimRides(s: GameState) {
  if (s.rides.length <= 160) return;
  const keep: RideRecord[] = [];
  let removable = s.rides.length - 160;
  for (let i = s.rides.length - 1; i >= 0; i--) {
    const r = s.rides[i];
    const done = r.status === 'completed' || r.status === 'cancelled' || r.status === 'expired';
    if (done && removable > 0) { removable--; continue; }
    keep.unshift(r);
  }
  s.rides = keep;
}

// ---------------- Company customer app (player acting as a customer) ----------------
export function estimateForCustomer(s: GameState, pickupId: string, destId: string): RideRecord | { error: string } {
  const p = poiById.get(pickupId), d = poiById.get(destId);
  if (!p || !d || p.id === d.id) return { error: 'Choose two different places' };
  const cat = categoryFor(s, p, hourNow(s));
  return planRide(s, 'customerApp', p, d, cat, { type: 'employee', fromX: p.x, fromZ: p.z });
}

export function bookCustomerRide(s: GameState, pickupId: string, destId: string): { ok: boolean; message: string; ride?: RideRecord } {
  const c = s.company;
  if (!c || !c.appBuilt) return { ok: false, message: 'Company app not available' };
  if (s.myBooking) { const cur = s.rides.find((r) => r.id === s.myBooking); if (cur && !['completed', 'cancelled', 'expired'].includes(cur.status)) return { ok: false, message: 'You already have an active booking' }; }
  const est = estimateForCustomer(s, pickupId, destId);
  if ('error' in est) return { ok: false, message: est.error };
  const open = c.branches.some((b) => b.status === 'open' && (b.district === est.pickup.district));
  const covered = open || c.branches.some((b) => b.status === 'open' && Math.hypot(poiById.get(b.poiId)!.x - est.pickup.x, poiById.get(b.poiId)!.z - est.pickup.z) < 450);
  if (!covered) return { ok: false, message: 'Pickup is outside your company branch coverage' };
  est.passenger = { name: 'You (customer)', personality: 'calm', shirt: '#38bdf8', skin: '#c68642', kind: 'Customer app user' };
  est.category = est.category === 'night' ? 'night' : est.category;
  if (!holdCustomerPayment(s, est)) return { ok: false, message: `Insufficient wallet balance for ₹${est.estimate.total}` };
  const br = c.branches.find((b) => b.status === 'open' && b.district === est.pickup.district) ?? c.branches[0];
  est.branchId = br.id;
  s.rides.unshift(est);
  s.myBooking = est.id;
  dispatchRide(s, est);
  trimRides(s);
  return { ok: true, message: est.status === 'requested' ? 'Booking confirmed — finding a driver…' : 'Driver found!', ride: est };
}

export function cancelCustomerRide(s: GameState, id: string): { ok: boolean; message: string } {
  const r = s.rides.find((x) => x.id === id);
  if (!r || r.source !== 'customerApp') return { ok: false, message: 'Booking not found' };
  const stage = r.status === 'requested' ? 'requested' : r.status === 'enroute' || r.status === 'assigned' ? 'enroute' : r.status === 'arrived' ? 'arrived' : r.status === 'inprogress' ? 'inprogress' : null;
  if (!stage) return { ok: false, message: 'Booking is already closed' };
  const res = cancellationFee('customer', stage, s.time - r.requestedAt);
  if (!res.allowed) return { ok: false, message: res.reason };
  const emp = s.company?.employees.find((e) => e.id === r.driverId);
  settleCancellation(s, r, res.fee, emp);
  if (emp) { emp.rideId = undefined; emp.state = 'idle'; }
  r.status = 'cancelled'; r.cancelledBy = 'customer';
  r.explanation = res.reason + (res.fee ? ` Fee ₹${res.fee}.` : ' No fee charged.');
  adjustRep(s, res.fee ? -0.05 : 0);
  return { ok: true, message: r.explanation };
}

export function rateCustomerRide(s: GameState, id: string, stars: number, review: string, complaint: string) {
  const r = s.rides.find((x) => x.id === id);
  const c = s.company;
  if (!r || !c || r.status !== 'completed' || r.source !== 'customerApp') return;
  const e = c.employees.find((x) => x.id === r.driverId);
  if (r.rating !== undefined && r.review !== undefined) return; // already rated by customer
  const prev = r.rating ?? 0;
  if (prev && e) { // replace the auto rating with the customer's real one
    c.ratingSum -= prev; c.ratingCount -= 1;
    e.rating = e.ratingCount > 1 ? (e.rating * e.ratingCount - prev) / (e.ratingCount - 1) : 4; e.ratingCount = Math.max(0, e.ratingCount - 1);
  }
  r.rating = stars; r.review = review;
  c.ratingSum += stars; c.ratingCount += 1;
  if (e) { e.rating = (e.rating * e.ratingCount + stars) / (e.ratingCount + 1); e.ratingCount += 1; }
  adjustRep(s, (stars - 3) * 0.2);
  if (complaint.trim()) {
    c.complaints.push({ id: `C${id}x`, day: dayNow(s), rideId: id, employeeId: r.driverId, text: complaint.trim(), resolved: false });
    r.complaint = complaint.trim();
    if (e) e.complaints += 1;
    adjustRep(s, -0.8);
  }
}

/** Owner resolves a complaint; optionally refunds part of the fare (reverses all parties consistently). */
export function resolveComplaint(s: GameState, complaintId: string, refund: number) {
  const c = s.company;
  const cp = c?.complaints.find((x) => x.id === complaintId);
  if (!c || !cp || cp.resolved) return 0;
  cp.resolved = true;
  adjustRep(s, 0.6);
  const ride = s.rides.find((r) => r.id === cp.rideId);
  const emp = c.employees.find((e) => e.id === cp.employeeId);
  if (ride && refund > 0) return refundCompletedRide(s, ride, refund, emp);
  return 0;
}

export { districtAt, nearestPoi, branchPoiId };
