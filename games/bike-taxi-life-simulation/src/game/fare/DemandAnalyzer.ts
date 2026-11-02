import type { DistrictId, FareRules, Weather } from '../types';
import { FARE_RULES } from './rules';

export interface MarketSnapshot {
  requests: number; // simulated active requests per hour in the district
  drivers: number; // simulated available drivers (all companies + independents)
  ratio: number; // raw demand/driver ratio (includes weather effects on behaviour)
  pricingRatio: number; // weather-neutral ratio used for pricing (weather is priced once, via its own surcharge)
  rush: 'morning' | 'evening' | 'none';
  event?: string;
}

const BASE_REQ: Record<DistrictId, number> = { central: 120, residential: 90, it: 110, commercial: 100, coastal: 60, industrial: 50, airport: 70 };
const SUPPLY: Record<DistrictId, number> = { central: 1.12, residential: 1.1, it: 1.1, commercial: 1.1, coastal: 1.05, industrial: 1.1, airport: 1.0 };

export function hash01(a: number, b: number, c: number): number {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
const DISTRICTS: DistrictId[] = ['central', 'residential', 'it', 'commercial', 'coastal', 'industrial', 'airport'];

export function demandHourFactor(hour: number): number {
  if (hour >= 8 && hour < 11) return 1.5;
  if (hour >= 17 && hour < 20) return 1.55;
  if (hour >= 11 && hour < 17) return 1.0;
  if (hour >= 5 && hour < 8) return 0.8;
  if (hour >= 20 && hour < 24) return 0.75;
  return 0.4;
}
export function supplyHourFactor(hour: number): number {
  if ((hour >= 8 && hour < 11) || (hour >= 17 && hour < 20)) return 1.15;
  if (hour >= 11 && hour < 17) return 1.0;
  if (hour >= 5 && hour < 8) return 0.85;
  if (hour >= 20 && hour < 24) return 0.8;
  return 0.55;
}
export function weatherDemandFactor(w: Weather): number {
  return ({ sunny: 1, cloudy: 1, lightRain: 1.15, heavyRain: 1.4, thunderstorm: 1.5, fog: 1.1 } as const)[w];
}
export function weatherSupplyFactor(w: Weather): number {
  return ({ sunny: 1, cloudy: 1, lightRain: 0.95, heavyRain: 0.8, thunderstorm: 0.7, fog: 0.9 } as const)[w];
}

/** Deterministic special event (match / concert / festival) hitting one district for some hours of a day. */
export function eventFor(day: number, hour: number): { district: DistrictId; label: string; factor: number } | null {
  const d = DISTRICTS[Math.floor(hash01(day, 7, 3) * DISTRICTS.length)];
  if (hash01(day, 11, 5) > 0.3) return null;
  const startHour = 17 + Math.floor(hash01(day, 13, 7) * 3);
  if (hour < startHour || hour >= startHour + 3) return null;
  const labels: Record<DistrictId, string> = {
    central: 'Cultural festival', residential: 'Community fair', it: 'Tech summit', commercial: 'Mega sale',
    coastal: 'Beach concert', industrial: 'Shift change surge', airport: 'Flight delays',
  };
  return { district: d, label: labels[d], factor: 1.3 };
}

export const DemandAnalyzer = {
  snapshot(opts: { district: DistrictId; hour: number; weather: Weather; day: number }): MarketSnapshot {
    const { district, hour, weather, day } = opts;
    const noiseR = 0.94 + hash01(day, hour, district.length * 7 + district.charCodeAt(0)) * 0.12;
    const noiseD = 0.96 + hash01(day, hour + 31, district.charCodeAt(1)) * 0.08;
    const ev = eventFor(day, hour);
    const evF = ev && ev.district === district ? ev.factor : 1;
    const baseReq = BASE_REQ[district] * demandHourFactor(hour) * noiseR * evF;
    const baseDrv = BASE_REQ[district] * SUPPLY[district] * supplyHourFactor(hour) * noiseD;
    const requests = baseReq * weatherDemandFactor(weather);
    const drivers = baseDrv * weatherSupplyFactor(weather);
    const rush = hour >= 8 && hour < 11 ? 'morning' : hour >= 17 && hour < 20 ? 'evening' : 'none';
    return {
      requests: Math.round(requests), drivers: Math.max(1, Math.round(drivers)), ratio: requests / Math.max(1, drivers),
      pricingRatio: baseReq / Math.max(1, baseDrv), rush, event: ev && ev.district === district ? ev.label : undefined,
    };
  },
  /** Gradual: discounts when quiet, none near balance, then smoothly rising up to the surge cap. */
  pctFromRatio(ratio: number, rules: FareRules = FARE_RULES): number {
    if (!Number.isFinite(ratio) || ratio < 0) return 0;
    let pct = 0;
    if (ratio < 0.9) pct = -Math.min(rules.maxDiscountPct, (0.9 - ratio) * 0.25);
    else if (ratio > 1.1) pct = Math.min(rules.maxDemandPct, (ratio - 1.1) * 0.5);
    return Math.round(pct * 100) / 100;
  },
};
