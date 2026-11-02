import { describe, expect, it } from 'vitest';
import { FARE_RULES } from '../fare/rules';
import {
  assembleFare, cancellationFee, explainDifference, finalizeFare, InvalidRouteError, quoteFare, RouteFareEstimator, WaitingChargeCalculator,
} from '../fare/FareEngine';
import { DemandAnalyzer } from '../fare/DemandAnalyzer';
import { DynamicPricingController } from '../fare/DynamicPricingController';
import { splitEmployeeRevenue, settlePersonalRide, holdCustomerPayment, settleCustomerAdjustment, settleCancellation } from '../fare/RidePaymentService';
import { newGameState } from '../state';
import { planRide } from '../logic/rideBuilder';
import { cancelCustomerRide, bookCustomerRide } from '../logic/rides';
import { poiById } from '../world/city';
import type { PricingContext, RouteInfo, RideRecord } from '../types';

const ctx = (o: Partial<PricingContext> = {}): PricingContext => ({ demandPct: 0, weather: 'sunny', hour: 13, hubFee: false, label: 'Normal', district: 'central', ratio: 1, ...o });
const route = (km: number, min: number): RouteInfo => ({ meters: km * 1000, fareKm: km, durationMin: min, pts: [] });
const pricing = (o: { hour: number; weather?: PricingContext['weather']; district?: PricingContext['district']; market?: { requests: number; drivers: number } }) =>
  DynamicPricingController.context({ district: o.district ?? 'central', timeMin: 3 * 1440 + o.hour * 60, weather: o.weather ?? 'sunny', hubTrip: false, marketOverride: o.market });

describe('Fare engine', () => {
  it('documented example: ₹20 + ₹80 + ₹20 + ₹10 = ₹130', () => {
    const rules = { ...FARE_RULES, baseFare: 20, perKm: 10, perMinute: 1, minFare: 20 };
    const f = assembleFare({ distanceKm: 8, durationMin: 20, demandAmount: 10 }, rules);
    expect([f.base, f.distance, f.time, f.demand, f.waiting]).toEqual([20, 80, 20, 10, 0]);
    expect(f.total).toBe(130);
  });
  it('1 short-distance ride', () => {
    const f = quoteFare(route(1.5, 4), ctx());
    expect(f.total).toBe(30 + 30 + 8);
    expect(f.total).toBeGreaterThanOrEqual(FARE_RULES.minFare);
  });
  it('2 long-distance ride', () => {
    const f = quoteFare(route(22, 50), ctx());
    expect(f.total).toBe(30 + 440 + 100);
  });
  it('3 minimum fare protection', () => {
    const f = quoteFare(route(0.1, 1), ctx());
    expect(f.total).toBe(FARE_RULES.minFare);
    expect(f.minimumAdjustment).toBeGreaterThan(0);
  });
  it('4 rush-hour demand raises fare gradually (not to max)', () => {
    const rush = pricing({ hour: 18 }), mid = pricing({ hour: 13 });
    expect(rush.demandPct).toBeGreaterThan(mid.demandPct);
    expect(rush.demandPct).toBeLessThan(FARE_RULES.maxDemandPct);
    const f = quoteFare(route(8, 20), rush);
    expect(f.demand).toBeGreaterThan(0);
  });
  it('5 low-demand period gives a small discount at most', () => {
    const q = pricing({ hour: 3 });
    expect(q.demandPct).toBeLessThanOrEqual(0);
    expect(q.demandPct).toBeGreaterThanOrEqual(-FARE_RULES.maxDiscountPct);
  });
  it('6 driver shortage (market) raises price; plentiful drivers do not', () => {
    const shortage = pricing({ hour: 13, market: { requests: 150, drivers: 90 } });
    const plenty = pricing({ hour: 13, market: { requests: 100, drivers: 100 } });
    expect(shortage.demandPct).toBeGreaterThan(0.1);
    expect(plenty.demandPct).toBe(0);
  });
  it('7 heavy rain adds exactly one weather surcharge, not the maximum', () => {
    const f = quoteFare(route(8, 20), ctx({ weather: 'heavyRain' }));
    const w = f.surcharges.filter((x) => x.code === 'weather');
    expect(w).toHaveLength(1);
    expect(w[0].amount).toBe(Math.round(f.base + f.distance + f.time) * 0 + Math.round((30 + 160 + 40) * FARE_RULES.weatherPct.heavyRain));
    expect(FARE_RULES.weatherPct.heavyRain).toBeLessThan(FARE_RULES.weatherPct.thunderstorm);
  });
  it('8 night surcharge applies only in night hours', () => {
    expect(quoteFare(route(8, 20), ctx({ hour: 23 })).surcharges.some((x) => x.code === 'night')).toBe(true);
    expect(quoteFare(route(8, 20), ctx({ hour: 2 })).surcharges.some((x) => x.code === 'night')).toBe(true);
    expect(quoteFare(route(8, 20), ctx({ hour: 12 })).surcharges.some((x) => x.code === 'night')).toBe(false);
  });
  it('9 waiting charges beyond the free period', () => {
    expect(WaitingChargeCalculator.charge(7).amount).toBe(Math.ceil(7 - 3) * FARE_RULES.waitPerMin);
    const f = assembleFare({ distanceKm: 5, durationMin: 10, customerWaitMin: 7 });
    expect(f.waiting).toBe(12);
  });
  it('10 free waiting period is not charged', () => {
    expect(WaitingChargeCalculator.charge(3).amount).toBe(0);
    expect(WaitingChargeCalculator.charge(0).amount).toBe(0);
    expect(WaitingChargeCalculator.charge(100).paidMinutes).toBe(FARE_RULES.maxPaidWaitMin);
  });
  it('11 surge min/max limits', () => {
    expect(DemandAnalyzer.pctFromRatio(50)).toBe(FARE_RULES.maxDemandPct);
    expect(DemandAnalyzer.pctFromRatio(0)).toBe(-FARE_RULES.maxDiscountPct);
    const f = assembleFare({ distanceKm: 8, durationMin: 20, demandPct: 5, pctSurcharges: [{ code: 'weather', label: 'w', pct: 0.14 }, { code: 'night', label: 'n', pct: 0.1 }] });
    const core = f.base + f.distance + f.time;
    expect(f.demand + f.surcharges.reduce((a, x) => a + x.amount, 0)).toBeLessThanOrEqual(Math.round(core * FARE_RULES.maxTotalUpliftPct) + 2);
    expect(f.capped).toBe(true);
  });
  it('12 fares are whole rupees and lines add up', () => {
    const f = quoteFare(route(7.37, 17.3), ctx({ demandPct: 0.137, weather: 'lightRain', hour: 23 }));
    expect(Number.isInteger(f.total)).toBe(true);
    const sum = f.base + f.distance + f.time + f.demand + f.surcharges.reduce((a, x) => a + x.amount, 0) + f.waiting + f.minimumAdjustment + f.protectionAdjustment;
    expect(sum).toBe(f.total);
  });
  it('13 invalid / negative route data is rejected, never a negative fare', () => {
    expect(() => assembleFare({ distanceKm: -1, durationMin: 5 })).toThrow(InvalidRouteError);
    expect(() => assembleFare({ distanceKm: NaN, durationMin: 5 })).toThrow(InvalidRouteError);
    expect(() => RouteFareEstimator.fareKm(-5)).toThrow(InvalidRouteError);
    expect(() => RouteFareEstimator.fareKm(Infinity)).toThrow(InvalidRouteError);
    expect(quoteFare(route(0, 0), ctx()).total).toBeGreaterThanOrEqual(0);
  });
  it('14 employee 70% / company 30% split', () => {
    expect(splitEmployeeRevenue(200)).toEqual({ driver: 140, company: 60 });
    for (const t of [61, 137, 233, 999]) { const s = splitEmployeeRevenue(t); expect(s.driver + s.company).toBe(t); }
  });
  it('15 personal independent ride credits PERSONAL wallet only', () => {
    const s = newGameState(5);
    const p = poiById.get('rest1')!, d = poiById.get('it1')!;
    const ride = planRide(s, 'personal', p, d, 'commuter', { type: 'player', fromX: p.x, fromZ: p.z });
    const w0 = s.wallet;
    settlePersonalRide(s, ride, ride.estimate.total);
    expect(s.wallet).toBe(w0 + ride.estimate.total);
    expect(s.company).toBeNull();
  });
  it('16 estimate vs final: explained, protected, driver detours not billed', () => {
    const s = newGameState(6);
    const p = poiById.get('rest1')!, d = poiById.get('mall')!;
    const r = planRide(s, 'personal', p, d, 'commuter', { type: 'player', fromX: p.x, fromZ: p.z });
    const fin = finalizeFare(r.estimate, r.pricing, { distanceKm: r.estimate.distanceKm * 2, durationMin: r.estimate.durationMin * 3, customerWaitMin: 0 });
    expect(fin.total).toBeLessThanOrEqual(Math.ceil(r.estimate.total * 1.2));
    expect(fin.distanceKm).toBeLessThanOrEqual(r.estimate.distanceKm * 1.1 + 0.01);
    const same = finalizeFare(r.estimate, r.pricing, { distanceKm: r.estimate.distanceKm, durationMin: r.estimate.durationMin, customerWaitMin: 0 });
    expect(same.total).toBe(r.estimate.total);
    expect(explainDifference(r.estimate, same)).toMatch(/matches/);
    const waited = finalizeFare(r.estimate, r.pricing, { distanceKm: r.estimate.distanceKm, durationMin: r.estimate.durationMin, customerWaitMin: 8 });
    expect(waited.total).toBe(r.estimate.total + waited.waiting);
    expect(explainDifference(r.estimate, waited)).toMatch(/waiting/);
  });
  it('17 cancellation fees and refunds', () => {
    expect(cancellationFee('customer', 'requested', 10).fee).toBe(0);
    expect(cancellationFee('customer', 'enroute', 1).fee).toBe(0);
    expect(cancellationFee('customer', 'enroute', 5).fee).toBe(FARE_RULES.cancel.enrouteFee);
    expect(cancellationFee('customer', 'arrived', 5).fee).toBe(FARE_RULES.cancel.arrivedFee);
    expect(cancellationFee('driver', 'arrived', 30).fee).toBe(0);
    expect(cancellationFee('customer', 'inprogress', 1).allowed).toBe(false);
    const s = newGameState(7);
    const p = poiById.get('rest1')!, d = poiById.get('mall')!;
    const r: RideRecord = planRide(s, 'customerApp', p, d, 'commuter', { type: 'employee', fromX: p.x, fromZ: p.z });
    s.wallet = 5000;
    holdCustomerPayment(s, r);
    expect(s.wallet).toBe(5000 - r.estimate.total);
    settleCancellation(s, r, 20);
    expect(s.wallet).toBe(5000 - 20);
    const r2 = planRide(s, 'customerApp', p, d, 'commuter', { type: 'employee', fromX: p.x, fromZ: p.z });
    const w = s.wallet; holdCustomerPayment(s, r2);
    settleCustomerAdjustment(s, r2, r2.estimate.total - 10);
    expect(s.wallet).toBe(w - r2.estimate.total + 10);
  });
  it('18 no duplicate surcharges (weather priced once, even with weather-driven demand)', () => {
    const rain = pricing({ hour: 23, weather: 'heavyRain' }), sun = pricing({ hour: 23, weather: 'sunny' });
    expect(rain.demandPct).toBe(sun.demandPct);
    const f = quoteFare(route(8, 20), rain);
    const codes = f.surcharges.map((x) => x.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).toEqual(['weather', 'night']);
  });
  it('19 identical pricing across all branches/portals for the same trip', () => {
    const s = newGameState(8);
    const p = poiById.get('it1')!, d = poiById.get('mall')!;
    const a = planRide(s, 'company', p, d, 'commuter', { type: 'employee', fromX: p.x, fromZ: p.z }, 'hq');
    const b = planRide(s, 'customerApp', p, d, 'commuter', { type: 'employee', fromX: p.x, fromZ: p.z }, 'br-it');
    const c = planRide(s, 'personal', p, d, 'commuter', { type: 'player', fromX: p.x, fromZ: p.z });
    expect(a.estimate).toEqual(b.estimate);
    expect(a.estimate).toEqual(c.estimate);
  });
  it('20 owner cannot edit fare rates (frozen config, no setter API)', () => {
    expect(Object.isFrozen(FARE_RULES)).toBe(true);
    expect(Object.isFrozen(FARE_RULES.weatherPct)).toBe(true);
    expect(() => { (FARE_RULES as { perKm: number }).perKm = 1; }).toThrow();
    expect(() => { (FARE_RULES.weatherPct as { heavyRain: number }).heavyRain = 5; }).toThrow();
    expect(FARE_RULES.perKm).toBe(20);
  });
  it('realistic combination: airport night rain ride stays within surge cap', () => {
    const s = newGameState(9);
    s.time = 2 * 1440 + 23 * 60; s.weather = 'thunderstorm';
    const p = poiById.get('airport')!, d = poiById.get('hotel2')!;
    const r = planRide(s, 'personal', p, d, 'airport', { type: 'player', fromX: p.x, fromZ: p.z });
    const core = r.estimate.base + r.estimate.distance + r.estimate.time;
    const uplift = r.estimate.demand + r.estimate.surcharges.filter((x) => x.code !== 'hub').reduce((a, x) => a + x.amount, 0);
    expect(uplift).toBeLessThanOrEqual(core * FARE_RULES.maxTotalUpliftPct + 2);
    expect(r.estimate.surcharges.some((x) => x.code === 'hub')).toBe(true);
  });
  it('customer-app booking requires a company and covers cancellation flow', () => {
    const s = newGameState(10);
    expect(bookCustomerRide(s, 'rest1', 'mall').ok).toBe(false);
    expect(cancelCustomerRide(s, 'nope').ok).toBe(false);
  });
});
