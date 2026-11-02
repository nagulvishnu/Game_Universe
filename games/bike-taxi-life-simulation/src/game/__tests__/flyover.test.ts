import { describe, expect, it } from 'vitest';
import { computeRoute, FLYOVER, flyoverHeight, pointOnPolyline, polylineLength } from '../world/city';

describe('city flyover', () => {
  it('has a gradual climb, level deck, and gradual descent', () => {
    expect(flyoverHeight(FLYOVER.startX, FLYOVER.z)).toBe(0);
    expect(flyoverHeight((FLYOVER.startX + FLYOVER.rampUpEndX) / 2, FLYOVER.z)).toBeCloseTo(FLYOVER.height / 2);
    expect(flyoverHeight(FLYOVER.rampUpEndX, FLYOVER.z)).toBe(FLYOVER.height);
    expect(flyoverHeight((FLYOVER.rampDownStartX + FLYOVER.endX) / 2, FLYOVER.z)).toBeCloseTo(FLYOVER.height / 2);
    expect(flyoverHeight(FLYOVER.endX, FLYOVER.z)).toBe(0);
  });

  it('keeps ground traffic outside the flyover roadway at street level', () => {
    expect(flyoverHeight((FLYOVER.startX + FLYOVER.endX) / 2, FLYOVER.z + FLYOVER.halfWidth + 1)).toBe(0);
    expect(flyoverHeight(FLYOVER.startX - 1, FLYOVER.z)).toBe(0);
    expect(flyoverHeight(FLYOVER.endX + 1, FLYOVER.z)).toBe(0);
  });

  it('keeps GPS routes crossing the central east-west road aligned with the flyover ramps', () => {
    const route = computeRoute(100, FLYOVER.z, 400, FLYOVER.z);
    const length = polylineLength(route.pts);
    const elevations = Array.from({ length: Math.ceil(length / 4) + 1 }, (_, i) => {
      const point = pointOnPolyline(route.pts, Math.min(length, i * 4));
      return flyoverHeight(point.x, point.z);
    });
    expect(Math.max(...elevations)).toBe(FLYOVER.height);
    expect(elevations.some((height) => height > 0 && height < FLYOVER.height)).toBe(true);
  });
});
