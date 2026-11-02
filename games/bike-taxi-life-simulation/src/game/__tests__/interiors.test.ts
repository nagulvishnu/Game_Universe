import { describe, expect, it } from 'vitest';
import { pois } from '../world/city';
import type { PoiKind } from '../types';
import { interiorFor, interiorPeopleFor } from '../../scene/interiorDefs';

const buildingKinds: PoiKind[] = [
  'home', 'hq', 'branch', 'garage', 'restaurant', 'shop', 'bank', 'regoffice', 'hospital',
  'dealership', 'petrol', 'police', 'railway', 'bus', 'airport', 'mall', 'itpark', 'school',
  'hotel', 'beach', 'factory', 'park', 'office', 'apartments', 'market',
];

describe('building interiors', () => {
  it('lets the player enter every mapped building', () => {
    expect(pois.length).toBeGreaterThan(0);
    expect(pois.every((poi) => poi.enterable)).toBe(true);
  });

  it('provides a designed interior and indoor NPCs for every building kind', () => {
    for (const kind of buildingKinds) {
      const def = interiorFor(kind);
      expect(def.title, kind).not.toBe('Building');
      expect(def.props.length, kind).toBeGreaterThan(0);
      if (kind !== 'home') expect(interiorPeopleFor(kind).length, kind).toBeGreaterThan(0);
    }
  });

  it('supports dining in at restaurants and hotels and servicing bikes in garages', () => {
    for (const kind of ['restaurant', 'hotel'] as const) {
      const actions = interiorFor(kind).hotspots.map((hotspot) => hotspot.action);
      expect(actions).toContain('dine');
      expect(actions).toContain('menu');
    }
    expect(interiorFor('garage').hotspots.map((hotspot) => hotspot.action)).toContain('garage');
  });
});
