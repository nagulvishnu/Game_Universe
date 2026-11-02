// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useGame, syncRuntimeFromState } from '../store';
import { rt } from '../runtime';
import { newGameState } from '../state';
import { acceptOffer, arriveAtPickup, boardPassenger, completePersonalRide, generateOffer } from '../logic/rides';
import { registerCompany } from '../logic/company';
import { migrate } from '../persistence';
import { acceptOfferAction, dropAction } from '../actions';
import type { GameState } from '../types';

function setupRide(stage: 'enroute' | 'arrived' | 'inprogress'): GameState {
  const g = newGameState(21);
  expect(generateOffer(g, g.player.x, g.player.z)).not.toBeNull();
  acceptOffer(g);
  if (stage !== 'enroute') arriveAtPickup(g);
  if (stage === 'inprogress') {
    g.time += 30;
    expect(boardPassenger(g)).toBe(true);
  }
  syncRuntimeFromState(g);
  useGame.setState((s) => ({ g, ui: { ...s.ui, screen: 'game', panel: null } }));
  return g;
}

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe('personal ride save recovery', () => {
  it.each(['enroute', 'arrived', 'inprogress'] as const)('restores a ride in the %s stage', (stage) => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    const original = setupRide(stage);
    const id = original.activeRideId;
    const telemetry = { distanceM: 1240, elapsedSec: 175, collisions: 1, hardEvents: 2, speedingSec: 3 };
    if (stage === 'inprogress') rt.tel = { ...telemetry };
    useGame.getState().save();
    vi.setSystemTime(1_010_000);
    expect(useGame.getState().continueGame()).toBe(true);
    const restored = useGame.getState().g!;
    expect(restored.activeRideId).toBe(id);
    expect(restored.rides.find((r) => r.id === id)?.status).toBe(stage);
    expect(rt.passengerBoarded).toBe(stage === 'inprogress');
    expect(rt.target?.kind ?? null).toBe(stage === 'enroute' ? 'pickup' : stage === 'inprogress' ? 'dest' : null);
    if (stage === 'inprogress') {
      expect(rt.tel).toEqual(telemetry);
      const expected = structuredClone(original);
      const expectedRide = completePersonalRide(expected, telemetry)!;
      dropAction();
      const actualRide = useGame.getState().g!.rides.find((r) => r.id === id)!;
      expect(actualRide.final).toEqual(expectedRide.final);
      expect(useGame.getState().ui.panel).toBe('ridesummary');
      expect(useGame.getState().ui.panelArg).toBe(id);
      expect(useGame.getState().g!.wallet).toBe(expected.wallet);
      expect(useGame.getState().g!.activeRideId).toBeNull();
    }
  });

  it('accepts a request and sets its pickup target without accessing a revoked draft', () => {
    const g = newGameState(21);
    const offer = generateOffer(g, g.player.x, g.player.z)!;
    const pickup = { x: offer.pickup.x, z: offer.pickup.z, kind: 'pickup' };
    syncRuntimeFromState(g);
    useGame.setState((s) => ({ g, ui: { ...s.ui, screen: 'game', panel: null } }));
    expect(() => acceptOfferAction()).not.toThrow();
    expect(rt.target).toEqual(pickup);
    expect(useGame.getState().g!.activeRideId).toBe(offer.id);
  });

  it('does not count offline company progression as personal passenger wait', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    const g = setupRide('arrived');
    g.savings = 130000;
    expect(registerCompany(g, { name: 'Test Rides', tagline: '', primary: '#ff0000', secondary: '#ffffff', logoShape: 'hex', logoIcon: '⚡', uniformStyle: 'chest', shirt: '#ff0000' }).ok).toBe(true);
    const before = { time: g.time, assigned: g.rides[0].assignedAt!, arrived: g.rides[0].arrivedAt! };
    useGame.getState().save();
    vi.setSystemTime(1_300_000);
    expect(useGame.getState().continueGame()).toBe(true);
    const restored = useGame.getState().g!;
    const ride = restored.rides.find((r) => r.id === restored.activeRideId)!;
    expect(restored.time).toBeGreaterThan(before.time);
    expect(restored.time - ride.assignedAt!).toBeCloseTo(before.time - before.assigned);
    expect(restored.time - ride.arrivedAt!).toBeCloseTo(before.time - before.arrived);
  });

  it('clears invalid active ride references without losing history', () => {
    const g = setupRide('enroute');
    g.rides.push({ ...structuredClone(g.rides[0]), id: 'completed', status: 'completed' });
    g.activeRideId = 'missing';
    const restored = migrate(g)!;
    expect(restored.activeRideId).toBeNull();
    expect(restored.rides.map((r) => r.id)).toEqual(['completed']);
  });
});
