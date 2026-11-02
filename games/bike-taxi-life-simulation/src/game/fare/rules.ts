import type { FareRules } from '../types';

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object') {
    Object.values(o as object).forEach(deepFreeze);
    Object.freeze(o);
  }
  return o;
}

/**
 * GAME-CONTROLLED fare configuration. Frozen at load: no UI, store action or save file can alter it.
 * Rates are tuned so a typical 8-9 fare-km city ride pays roughly ₹200-260 (the compressed city map
 * represents `distanceScale` fare-km per world-km).
 */
export const FARE_RULES: FareRules = deepFreeze({
  version: 1,
  baseFare: 30,
  perKm: 20,
  perMinute: 2,
  minFare: 60,
  freeWaitMin: 3,
  waitPerMin: 3,
  maxPaidWaitMin: 15,
  maxDemandPct: 0.5,
  maxDiscountPct: 0.05,
  maxTotalUpliftPct: 0.6,
  weatherPct: { sunny: 0, cloudy: 0, lightRain: 0.04, heavyRain: 0.1, thunderstorm: 0.14, fog: 0.04 },
  nightPct: { evening: 0.06, lateNight: 0.1 },
  hubFee: 40,
  estimateProtectionPct: 0.2,
  cancel: { freeGraceMin: 2, enrouteFee: 20, arrivedFee: 40 },
  employeeShare: 0.7,
  companyShare: 0.3,
  distanceScale: 20,
  avgSpeedKmh: 28,
});
