import type { FareBreakdown, FareLine, FareRules, PricingContext, RouteInfo, Weather } from '../types';
import { FARE_RULES } from './rules';

export class InvalidRouteError extends Error {}

const r0 = (n: number) => Math.round(n);

// ---------------- WeatherPricingService ----------------
export const WeatherPricingService = {
  /** Gradual weather surcharge (fraction of core fare). Only genuinely bad weather is charged. */
  pct(weather: Weather, rules: FareRules = FARE_RULES): number { return rules.weatherPct[weather] ?? 0; },
  label(weather: Weather): string {
    return ({ sunny: 'Clear', cloudy: 'Cloudy', lightRain: 'Light rain', heavyRain: 'Heavy rain', thunderstorm: 'Thunderstorm', fog: 'Fog' } as const)[weather];
  },
  /** Night surcharge: single tier chosen by hour (no stacking). */
  nightPct(hour: number, rules: FareRules = FARE_RULES): number {
    if (hour >= 22 && hour < 24) return rules.nightPct.evening;
    if (hour >= 0 && hour < 5) return rules.nightPct.lateNight;
    return 0;
  },
};

// ---------------- RouteFareEstimator ----------------
export const RouteFareEstimator = {
  fareKm(worldMeters: number, rules: FareRules = FARE_RULES): number {
    if (!Number.isFinite(worldMeters) || worldMeters < 0) throw new InvalidRouteError('Invalid route distance');
    return (worldMeters / 1000) * rules.distanceScale;
  },
  /** Expected ride duration (minutes) from road distance with congestion factor. */
  durationMin(fareKm: number, congestion = 1, rules: FareRules = FARE_RULES): number {
    if (!Number.isFinite(fareKm) || fareKm < 0) throw new InvalidRouteError('Invalid distance');
    return Math.max(1, (fareKm / rules.avgSpeedKmh) * 60 * Math.max(0.8, congestion));
  },
  routeInfo(meters: number, pts: [number, number][], congestion = 1, rules: FareRules = FARE_RULES): RouteInfo {
    const fareKm = RouteFareEstimator.fareKm(meters, rules);
    return { meters, fareKm, durationMin: RouteFareEstimator.durationMin(fareKm, congestion, rules), pts };
  },
  /** Duration of a played ride normalised against the expected real-time seconds for the route (14 m/s typical). */
  actualDurationMin(elapsedRealSec: number, routeMeters: number, expectedMin: number): number {
    const expectedSec = Math.max(8, routeMeters / 14);
    const ratio = Math.min(2.5, Math.max(0.5, elapsedRealSec / expectedSec));
    return expectedMin * ratio;
  },
};

// ---------------- WaitingChargeCalculator ----------------
export const WaitingChargeCalculator = {
  /** Only customer-caused waiting after driver arrival counts; first `freeWaitMin` minutes are free. */
  charge(customerWaitMin: number, rules: FareRules = FARE_RULES): { amount: number; paidMinutes: number } {
    if (!Number.isFinite(customerWaitMin) || customerWaitMin <= 0) return { amount: 0, paidMinutes: 0 };
    const over = Math.max(0, customerWaitMin - rules.freeWaitMin);
    const paid = Math.min(rules.maxPaidWaitMin, Math.ceil(over));
    return { amount: r0(paid * rules.waitPerMin), paidMinutes: paid };
  },
};

// ---------------- FareBreakdown assembly (the single formula) ----------------
export interface FareParts {
  distanceKm: number;
  durationMin: number;
  demandPct?: number;
  /** direct rupee demand adjustment (used for documented examples / tests) */
  demandAmount?: number;
  pctSurcharges?: { code: string; label: string; pct: number }[];
  flatFees?: FareLine[];
  customerWaitMin?: number;
}

/**
 * Total Fare = Base + Distance + Time + Demand + Surcharges + Waiting (+ minimum-fare protection).
 * Every component is rounded to whole rupees individually so the displayed lines always add up to the total.
 */
export function assembleFare(p: FareParts, rules: FareRules = FARE_RULES): FareBreakdown {
  if (![p.distanceKm, p.durationMin].every(Number.isFinite) || p.distanceKm < 0 || p.durationMin < 0)
    throw new InvalidRouteError('Route distance/duration must be finite and non-negative');
  const notes: string[] = [];
  const base = r0(rules.baseFare);
  const distance = r0(p.distanceKm * rules.perKm);
  const time = r0(p.durationMin * rules.perMinute);
  const core = base + distance + time;

  let demand = p.demandAmount !== undefined
    ? p.demandAmount
    : core * (p.demandPct ?? 0);
  demand = Math.min(core * rules.maxDemandPct, Math.max(-core * rules.maxDiscountPct, demand));

  let sur = (p.pctSurcharges ?? []).filter((s) => s.pct > 0).map((s) => ({ code: s.code, label: s.label, amount: core * s.pct }));
  let capped = false;
  const uplift = Math.max(0, demand) + sur.reduce((a, s) => a + s.amount, 0);
  const maxUplift = core * rules.maxTotalUpliftPct;
  if (uplift > maxUplift && uplift > 0) {
    const f = maxUplift / uplift;
    demand = demand > 0 ? demand * f : demand;
    sur = sur.map((s) => ({ ...s, amount: s.amount * f }));
    capped = true;
    notes.push('Surge protection cap applied');
  }
  const demandR = r0(demand);
  const surR: FareLine[] = sur.map((s) => ({ code: s.code, label: s.label, amount: r0(s.amount) }));
  (p.flatFees ?? []).forEach((f) => surR.push({ ...f, amount: Math.max(0, r0(f.amount)) }));

  const wait = WaitingChargeCalculator.charge(p.customerWaitMin ?? 0, rules);
  const subtotal = core + demandR + surR.reduce((a, s) => a + s.amount, 0) + wait.amount;
  const minimumAdjustment = Math.max(0, rules.minFare - subtotal);
  if (minimumAdjustment > 0) notes.push(`Minimum fare ₹${rules.minFare} applied`);
  const total = Math.max(0, subtotal + minimumAdjustment);
  return {
    rulesVersion: rules.version, distanceKm: round2(p.distanceKm), durationMin: round2(p.durationMin),
    perKm: rules.perKm, perMin: rules.perMinute, base, distance, time, demand: demandR,
    demandPct: core > 0 ? round3(demandR / core) : 0, surcharges: surR, waiting: wait.amount, waitMinutes: wait.paidMinutes,
    minimumAdjustment, protectionAdjustment: 0, total, capped, notes,
  };
}
const round2 = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

function partsFromContext(route: { distanceKm: number; durationMin: number }, ctx: PricingContext, rules: FareRules, waitMin = 0): FareParts {
  const pct: FareParts['pctSurcharges'] = [];
  const w = WeatherPricingService.pct(ctx.weather, rules);
  if (w > 0) pct.push({ code: 'weather', label: `${WeatherPricingService.label(ctx.weather)} surcharge`, pct: w });
  const n = WeatherPricingService.nightPct(ctx.hour, rules);
  if (n > 0) pct.push({ code: 'night', label: 'Night surcharge', pct: n });
  return {
    distanceKm: route.distanceKm, durationMin: route.durationMin, demandPct: ctx.demandPct, pctSurcharges: pct,
    flatFees: ctx.hubFee ? [{ code: 'hub', label: 'Airport access fee', amount: rules.hubFee }] : [], customerWaitMin: waitMin,
  };
}

/** Pre-booking estimate shown to customers/drivers. Pure function of route + game-controlled context. */
export function quoteFare(route: RouteInfo, ctx: PricingContext, rules: FareRules = FARE_RULES): FareBreakdown {
  return assembleFare(partsFromContext({ distanceKm: route.fareKm, durationMin: route.durationMin }, ctx, rules), rules);
}

/** Final fare from actual eligible ride data. Pricing context (surge/surcharges) stays locked to the booking. */
export function finalizeFare(
  estimate: FareBreakdown, ctx: PricingContext,
  actual: { distanceKm: number; durationMin: number; customerWaitMin: number }, rules: FareRules = FARE_RULES,
): FareBreakdown {
  if (![actual.distanceKm, actual.durationMin, actual.customerWaitMin].every(Number.isFinite) || actual.distanceKm < 0)
    throw new InvalidRouteError('Invalid ride telemetry');
  // Driver-caused detours are not billed; shortcuts are passed on to the customer (bounded to avoid abuse).
  const dist = Math.min(estimate.distanceKm * 1.1, Math.max(estimate.distanceKm * 0.85, actual.distanceKm));
  const dur = Math.min(estimate.durationMin * 1.3, Math.max(estimate.durationMin * 0.8, actual.durationMin));
  const f = assembleFare(partsFromContext({ distanceKm: dist, durationMin: dur }, ctx, rules, actual.customerWaitMin), rules);
  const allowed = Math.ceil(estimate.total * (1 + rules.estimateProtectionPct)) + f.waiting;
  if (f.total > allowed) {
    f.protectionAdjustment = allowed - f.total;
    f.total = allowed;
    f.notes.push('Upfront-price protection limited the increase');
  }
  return f;
}

export function explainDifference(est: FareBreakdown, fin: FareBreakdown): string {
  const diff = fin.total - est.total;
  if (diff === 0) return 'Final fare matches the estimate.';
  const parts: string[] = [];
  if (fin.waiting > 0) parts.push(`₹${fin.waiting} waiting charge (${fin.waitMinutes} paid min after the free ${FARE_RULES.freeWaitMin} min)`);
  const dd = fin.distance - est.distance;
  if (dd !== 0) parts.push(`${dd > 0 ? '+' : '-'}₹${Math.abs(dd)} distance (${fin.distanceKm} km actual vs ${est.distanceKm} km)`);
  const dt = fin.time - est.time;
  if (dt !== 0) parts.push(`${dt > 0 ? '+' : '-'}₹${Math.abs(dt)} time (${fin.durationMin} min vs ${est.durationMin} min)`);
  if (fin.protectionAdjustment < 0) parts.push(`₹${Math.abs(fin.protectionAdjustment)} removed by price protection`);
  return `Final ₹${fin.total} is ${diff > 0 ? '+' : '-'}₹${Math.abs(diff)} vs estimate ₹${est.total}: ${parts.join('; ') || 'rounding'}.`;
}

// ---------------- Cancellation ----------------
export type CancelStage = 'requested' | 'assigned' | 'enroute' | 'arrived' | 'inprogress';
export function cancellationFee(
  by: 'customer' | 'driver' | 'system', stage: CancelStage, minutesSinceBooking: number, rules: FareRules = FARE_RULES,
): { allowed: boolean; fee: number; reason: string } {
  if (stage === 'inprogress') return { allowed: false, fee: 0, reason: 'Ride already in progress' };
  if (by !== 'customer') return { allowed: true, fee: 0, reason: 'Cancelled by driver/system — no charge, full refund' };
  if (stage === 'requested') return { allowed: true, fee: 0, reason: 'No driver assigned — free cancellation' };
  if (minutesSinceBooking <= rules.cancel.freeGraceMin) return { allowed: true, fee: 0, reason: `Within ${rules.cancel.freeGraceMin} min grace — free cancellation` };
  if (stage === 'arrived') return { allowed: true, fee: rules.cancel.arrivedFee, reason: 'Driver already arrived' };
  return { allowed: true, fee: rules.cancel.enrouteFee, reason: 'Driver already on the way' };
}

export function hourOf(timeMin: number): number { return Math.floor((timeMin % 1440) / 60); }
