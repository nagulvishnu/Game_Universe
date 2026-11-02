import type { GameState, Passenger, Place, Poi, RideCategory, RideRecord, RideSource, Weather } from '../types';
import { FARE_RULES } from '../fare/rules';
import { quoteFare, RouteFareEstimator } from '../fare/FareEngine';
import { DynamicPricingController } from '../fare/DynamicPricingController';
import { computeRoute, pois, poiById, RIDE_POIS } from '../world/city';
import { FIRST_NAMES, LAST_NAMES } from '../data';
import { hourNow, pick, rnd } from '../state';

export function trafficFactor(hour: number, weather: Weather): number {
  let f = 1;
  if ((hour >= 8 && hour < 11) || (hour >= 17 && hour < 20)) f += 0.25;
  if (hour >= 23 || hour < 5) f -= 0.15;
  f += ({ sunny: 0, cloudy: 0, lightRain: 0.1, heavyRain: 0.25, thunderstorm: 0.3, fog: 0.12 } as const)[weather];
  return f;
}

export const placeOf = (p: Poi): Place => ({ poiId: p.id, label: p.name, x: p.x, z: p.z, district: p.district });

const SHIRTS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#14b8a6', '#f97316', '#e5e7eb', '#0ea5e9'];
const SKINS = ['#8d5524', '#c68642', '#e0ac69', '#a1665e', '#6f4e37'];
export function makePassenger(s: GameState, category: RideCategory): Passenger {
  const kinds: Record<RideCategory, string> = {
    commuter: 'Office commuter', student: 'Student', railway: 'Train passenger', bus: 'Bus passenger', airport: 'Air traveller',
    shopping: 'Shopper', restaurant: 'Diner', tourist: 'Tourist', urgent: 'Urgent traveller', night: 'Night-shift worker',
    long: 'Long-distance rider', premium: 'Premium customer',
  };
  const personality = category === 'urgent' ? 'rushed' : category === 'premium' ? 'demanding' : pick(s, ['calm', 'chatty', 'rushed', 'demanding', 'friendly'] as const);
  return { name: `${pick(s, FIRST_NAMES)} ${pick(s, LAST_NAMES)}`, personality, shirt: pick(s, SHIRTS), skin: pick(s, SKINS), kind: kinds[category] };
}

export function categoryFor(s: GameState, pickup: Poi, hour: number): RideCategory {
  if (hour >= 22 || hour < 5) return rnd(s) < 0.6 ? 'night' : 'urgent';
  const r = rnd(s);
  if (r < 0.05) return 'urgent';
  if (r < 0.09) return 'premium';
  switch (pickup.kind) {
    case 'railway': return 'railway';
    case 'bus': return 'bus';
    case 'airport': return 'airport';
    case 'mall': case 'market': return 'shopping';
    case 'restaurant': return 'restaurant';
    case 'hotel': case 'beach': return 'tourist';
    case 'school': return 'student';
    case 'itpark': case 'office': case 'factory': return 'commuter';
    default: return hour < 11 ? 'commuter' : r < 0.5 ? 'shopping' : 'restaurant';
  }
}

export function pickDestination(s: GameState, pickup: Poi, category: RideCategory): Poi {
  const wantLong = category === 'long' || category === 'airport';
  const byKind = (ks: string[]) => RIDE_POIS.filter((p) => ks.includes(p.kind) && p.id !== pickup.id);
  let pool: Poi[] = [];
  if (category === 'airport' && pickup.kind !== 'airport') pool = byKind(['airport']);
  else if (category === 'railway' && pickup.kind !== 'railway') pool = byKind(['apartments', 'office', 'hotel', 'itpark']);
  else if (category === 'student') pool = byKind(['school', 'apartments']);
  else if (category === 'tourist') pool = byKind(['beach', 'hotel', 'mall', 'restaurant']);
  if (!pool.length) {
    pool = RIDE_POIS.filter((p) => p.id !== pickup.id && !['police'].includes(p.kind));
    const lo = wantLong ? 800 : 280, hi = wantLong ? 1500 : 1000;
    const f = pool.filter((p) => { const d = Math.hypot(p.x - pickup.x, p.z - pickup.z); return d >= lo && d <= hi; });
    if (f.length) pool = f;
  }
  return pick(s, pool);
}

/** Builds a fully priced ride through the SINGLE fare engine. */
export function planRide(
  s: GameState, source: RideSource, pickup: Poi, dest: Poi, category: RideCategory,
  driver: { type: 'player' | 'employee'; id?: string; fromX: number; fromZ: number }, branchId?: string,
): RideRecord {
  const hour = hourNow(s);
  const route = computeRoute(pickup.x, pickup.z, dest.x, dest.z);
  const info = RouteFareEstimator.routeInfo(route.meters, route.pts, trafficFactor(hour, s.weather));
  const hub = pickup.kind === 'airport' || dest.kind === 'airport';
  const ctx = DynamicPricingController.context({ district: pickup.district, timeMin: s.time, weather: s.weather, hubTrip: hub });
  const { market: _m, ...pricing } = ctx;
  void _m;
  const estimate = quoteFare(info, pricing, FARE_RULES);
  const toPick = computeRoute(driver.fromX, driver.fromZ, pickup.x, pickup.z);
  const passenger = makePassenger(s, category);
  const delay = passenger.personality === 'rushed' ? rnd(s) * 1.2 : rnd(s) < 0.6 ? rnd(s) * 2.6 : 3.5 + rnd(s) * 5;
  return {
    id: `R${s.time.toString(36)}${Math.floor(rnd(s) * 1e6).toString(36)}`, source, driverType: driver.type, driverId: driver.id, branchId,
    passenger, category, pickup: placeOf(pickup), dest: placeOf(dest), routeMeters: route.meters, pickupMeters: toPick.meters,
    estimate, pricing, status: 'requested', requestedAt: s.time, payment: rnd(s) < 0.6 ? 'upi' : 'cash', routePts: route.pts,
    pickupPts: toPick.pts, payments: [], urgent: category === 'urgent', customerDelayMin: Math.round(delay * 10) / 10,
  };
}

export function poiOf(id: string): Poi { return poiById.get(id) ?? pois[0]; }
