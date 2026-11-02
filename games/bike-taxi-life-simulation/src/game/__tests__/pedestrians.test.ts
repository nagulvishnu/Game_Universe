import { describe, expect, it } from 'vitest';
import { rt } from '../runtime';
import { nodeId, P, signalState } from '../world/city';
import { initPeds, initTraffic, updateTraffic } from '../world/trafficSim';

describe('pedestrian movement', () => {
  it('stops its walking cycle at a crossing and resumes when traffic clears', () => {
    initTraffic(0);
    initPeds(1);
    const p = rt.peds[0];
    p.a = nodeId(2, 2); p.b = nodeId(3, 2); p.s = P - 7; p.phase = 1;
    const green = Array.from({ length: 30 }, (_, t) => t).find((t) => signalState(3, 2, 'z', t) === 'green')!;
    const red = Array.from({ length: 30 }, (_, t) => t).find((t) => signalState(3, 2, 'z', t) === 'red')!;
    rt.simTimeSec = green;
    updateTraffic(0.1, 'sunny', 9, -100, -100, 0, false);
    expect(p.moving).toBe(false);
    expect(p.s).toBe(P - 7);
    expect(p.phase).toBe(1);
    rt.simTimeSec = red;
    updateTraffic(0.1, 'sunny', 9, -100, -100, 0, false);
    expect(p.moving).toBe(true);
    expect(p.s).toBeGreaterThan(P - 7);
    expect(p.phase).toBeGreaterThan(1);
  });
});
