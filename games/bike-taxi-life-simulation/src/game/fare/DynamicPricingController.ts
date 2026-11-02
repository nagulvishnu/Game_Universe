import type { DistrictId, FareRules, PricingContext, Weather } from '../types';
import { DemandAnalyzer, type MarketSnapshot } from './DemandAnalyzer';
import { FARE_RULES } from './rules';

/**
 * Builds the game-controlled pricing context for a ride. Used by EVERY portal (third-party app, company
 * customer app, employee dispatch, all branches) so pricing is identical everywhere.
 * Demand uses SIMULATED MARKET supply/demand – never the company's own fleet size.
 */
export const DynamicPricingController = {
  context(opts: {
    district: DistrictId; timeMin: number; weather: Weather; hubTrip: boolean;
    marketOverride?: Pick<MarketSnapshot, 'requests' | 'drivers'>; rules?: FareRules;
  }): PricingContext & { market: MarketSnapshot } {
    const rules = opts.rules ?? FARE_RULES;
    const hour = Math.floor((opts.timeMin % 1440) / 60);
    const day = Math.floor(opts.timeMin / 1440);
    const snap = DemandAnalyzer.snapshot({ district: opts.district, hour, weather: opts.weather, day });
    let market = snap;
    if (opts.marketOverride) {
      const ratio = opts.marketOverride.requests / Math.max(1, opts.marketOverride.drivers);
      market = { ...snap, ...opts.marketOverride, ratio, pricingRatio: ratio };
    }
    const demandPct = DemandAnalyzer.pctFromRatio(market.pricingRatio, rules);
    const label = market.event ? `Event: ${market.event}`
      : market.rush === 'morning' ? 'Morning rush' : market.rush === 'evening' ? 'Evening rush'
      : demandPct < 0 ? 'Quiet period discount' : demandPct > 0 ? 'High demand' : 'Normal demand';
    return { demandPct, weather: opts.weather, hour, hubFee: opts.hubTrip, label, district: opts.district, ratio: Math.round(market.pricingRatio * 100) / 100, market };
  },
};
