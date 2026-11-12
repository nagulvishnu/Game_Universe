import { describe, expect, it } from "vitest";
import {
  GOLDEN_ANGLE,
  angleBetween,
  bestOrbitAngle,
  ellipsoid,
  fibonacciSphere,
  flattenSphere,
  rotateX,
  rotateY,
  rotateZ,
  shortestPositiveDelta,
  solveLanding,
} from "../sphere";

describe("fibonacci sphere", () => {
  it("returns one point per game", () => {
    for (const n of [1, 2, 5, 18, 40]) {
      expect(fibonacciSphere(n)).toHaveLength(n);
    }
  });

  it("returns an empty array for zero games", () => {
    expect(fibonacciSphere(0)).toEqual([]);
  });

  it("places every point on the unit sphere", () => {
    for (const p of fibonacciSphere(18)) {
      expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(1, 6);
    }
  });

  it("never places two points on top of each other", () => {
    const pts = fibonacciSphere(30);
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        expect(angleBetween(pts[i], pts[j])).toBeGreaterThan(0.25);
      }
    }
  });

  it("spreads points evenly — the minimum gap stays healthy as the count grows", () => {
    const measure = (n: number) => {
      const pts = fibonacciSphere(n);
      let min = Infinity;
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          min = Math.min(min, angleBetween(pts[i], pts[j]));
        }
      }
      return min;
    };
    // A flat grid would collapse toward 0; the spiral keeps a usable floor.
    expect(measure(18)).toBeGreaterThan(0.45);
    expect(measure(40)).toBeGreaterThan(0.3);
  });

  it("is deterministic", () => {
    expect(fibonacciSphere(12)).toEqual(fibonacciSphere(12));
  });

  it("covers both hemispheres", () => {
    const pts = fibonacciSphere(18);
    expect(pts.some((p) => p.y > 0)).toBe(true);
    expect(pts.some((p) => p.y < 0)).toBe(true);
  });

  it("uses the golden angle for the longitude step", () => {
    expect(GOLDEN_ANGLE).toBeCloseTo(2.39996, 4);
    const a = fibonacciSphere(4);
    const step = Math.atan2(a[1].z, a[1].x) - Math.atan2(a[0].z, a[0].x);
    expect(Math.abs(step)).toBeCloseTo(GOLDEN_ANGLE, 4);
  });
});

describe("flatten sphere", () => {
  it("compresses the vertical axis but keeps points on the sphere", () => {
    const flat = flattenSphere(fibonacciSphere(18), 0.5);
    expect(flat).toHaveLength(18);
    for (const p of flat) {
      expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(1, 6);
    }
  });

  it("reduces the vertical spread", () => {
    const sphere = fibonacciSphere(18);
    const flat = flattenSphere(sphere, 0.6);
    const spread = (pts: typeof sphere) => Math.max(...pts.map((p) => p.y)) - Math.min(...pts.map((p) => p.y));
    expect(spread(flat)).toBeLessThan(spread(sphere));
  });

  it("is a no-op with zero flattening", () => {
    const sphere = fibonacciSphere(8);
    expect(flattenSphere(sphere, 0)).toEqual(sphere);
  });
});

describe("ellipsoid shell", () => {
  it("keeps sy = 1 as the untouched sphere", () => {
    const sphere = fibonacciSphere(10);
    expect(ellipsoid(sphere, 1)).toEqual(sphere);
  });

  it("stretches Y without renormalising", () => {
    const sphere = fibonacciSphere(10);
    const tall = ellipsoid(sphere, 1.6);
    for (let i = 0; i < sphere.length; i++) {
      expect(tall[i].x).toBeCloseTo(sphere[i].x, 10);
      expect(tall[i].z).toBeCloseTo(sphere[i].z, 10);
      expect(tall[i].y).toBeCloseTo(sphere[i].y * 1.6, 10);
      // The point must have left the unit sphere: that is the whole point.
      const mag = Math.hypot(tall[i].x, tall[i].y, tall[i].z);
      expect(mag).toBeGreaterThan(1);
    }
  });

  it("collapses the shell when sy approaches zero", () => {
    const flat = ellipsoid(fibonacciSphere(6), 0.0001);
    for (const p of flat) expect(Math.abs(p.y)).toBeLessThan(0.001);
  });

  it("leaves the Z extent of the shell alone", () => {
    const sphere = fibonacciSphere(12);
    const maxZ = Math.max(...sphere.map((p) => Math.abs(p.z)));
    expect(Math.max(...ellipsoid(sphere, 1.4).map((p) => Math.abs(p.z)))).toBeCloseTo(maxZ, 10);
  });
});

describe("rotateZ", () => {
  it("rolls the point without changing its height", () => {
    const p = rotateZ({ x: 1, y: 0, z: 0 }, Math.PI / 2);
    expect(p.x).toBeCloseTo(0, 10);
    expect(p.y).toBeCloseTo(1, 10);
    expect(p.z).toBeCloseTo(0, 10);
  });

  it("preserves distance from the roll axis", () => {
    const dir = { x: 0.4, y: 0.5, z: 0.768 };
    const rolled = rotateZ(dir, 1.234);
    const before = Math.hypot(dir.x, dir.y);
    const after = Math.hypot(rolled.x, rolled.y);
    expect(after).toBeCloseTo(before, 10);
    expect(rolled.z).toBeCloseTo(dir.z, 10);
  });
});

describe("solveLanding", () => {
  it("brings a direction to the front of the sphere", () => {
    const dir = { x: 0.3, y: 0.2, z: 0.93 };
    const { yaw, pitch } = solveLanding(dir, 0);
    const p = rotateX(rotateY(dir, yaw), pitch);
    expect(p.x).toBeCloseTo(0, 5);
    expect(p.y).toBeCloseTo(0, 5);
    expect(p.z).toBeGreaterThan(0);
  });

  it("can land a direction at a chosen height", () => {
    const dir = { x: -0.7, y: 0.1, z: 0.7 };
    const { yaw, pitch } = solveLanding(dir, 0.4);
    const p = rotateX(rotateY(dir, yaw), pitch);
    expect(p.x).toBeCloseTo(0, 5);
    expect(p.y).toBeCloseTo(0.4, 5);
    expect(p.z).toBeGreaterThan(0);
  });
});

describe("bestOrbitAngle", () => {
  it("finds the orbit angle that puts a card closest to the camera", () => {
    const dirs = fibonacciSphere(18);
    const index = 7;
    const angle = bestOrbitAngle(dirs, index, 0.16);

    const depthAt = (a: number) => rotateX(rotateY(dirs[index], a), 0.16).z;
    const best = depthAt(angle);
    // No other sampled angle may beat it.
    for (let i = 0; i < 720; i++) {
      const a = (i / 720) * Math.PI * 2;
      expect(depthAt(a)).toBeLessThanOrEqual(best + 1e-6);
    }
  });

  it("returns 0 for a missing card", () => {
    expect(bestOrbitAngle([], 3, 0.16)).toBe(0);
  });
});

describe("shortestPositiveDelta", () => {
  it("returns a forward delta in [0, 2π)", () => {
    const d = shortestPositiveDelta(0.1, 6.0);
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThan(Math.PI * 2);
    expect((0.1 + d) % (Math.PI * 2)).toBeCloseTo(6.0 % (Math.PI * 2), 6);
  });

  it("wraps forwards rather than backwards", () => {
    expect(shortestPositiveDelta(6.0, 0.1)).toBeGreaterThan(0);
  });
});
