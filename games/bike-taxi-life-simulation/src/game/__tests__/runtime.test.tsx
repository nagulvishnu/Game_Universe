// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createElement, act, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const noop: unknown = new Proxy(function () { }, { get: () => noop, apply: () => noop });
(HTMLCanvasElement.prototype as unknown as { getContext: () => unknown }).getContext = () => noop;
async function renderToString(el: ReactElement): Promise<string> {
  const div = document.createElement('div');
  const root = createRoot(div);
  await act(async () => { root.render(el); });
  const html = div.innerHTML;
  await act(async () => { root.unmount(); });
  return html;
}

const mem: Record<string, string> = new Proxy({}, {}) as Record<string, string>;
Object.defineProperty(globalThis, 'localStorage', { value: { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; }, removeItem: (k: string) => { delete mem[k]; }, clear: () => { }, key: () => null, length: 0 }, configurable: true });

const { useGame } = await import('../store');
const { newGameState, companyTx } = await import('../state');
const { registerCompany, buyCompanyBike, approveApplicant, applyForLoan } = await import('../logic/company');
const { generateApplicant } = await import('../logic/people');
const { generateOffer, acceptOffer, arriveAtPickup, boardPassenger, completePersonalRide } = await import('../logic/rides');
const { initTraffic, initPeds, updateTraffic } = await import('../world/trafficSim');
const { rt } = await import('../runtime');
const { PanelHost } = await import('../../ui/Panels');
const { HUD } = await import('../../ui/HUD');
const { Phone } = await import('../../ui/Phone');
const { MainMenu } = await import('../../ui/MainMenu');
const { LocalSaveRepository } = await import('../persistence');
const { stepSim } = await import('../logic/sim');

describe('runtime smoke (no WebGL)', () => {
  it('traffic & pedestrians simulate stably for several minutes', () => {
    initTraffic(56); initPeds(90);
    for (let i = 0; i < 60 * 120; i++) { rt.simTimeSec += 1 / 30; updateTraffic(1 / 30, 'sunny', 12, 500, 500, 0, true); }
    for (const v of rt.traffic) { expect(Number.isFinite(v.x + v.z + v.speed)).toBe(true); expect(v.x).toBeGreaterThan(-60); expect(v.x).toBeLessThan(1000); }
    expect(rt.traffic.some((v) => v.speed > 1)).toBe(true);
    for (const p of rt.peds) expect(Number.isFinite(p.x + p.z)).toBe(true);
  });

  it('player ride loop: offer → accept → arrive → board → complete pays personal wallet', () => {
    const s = newGameState(21);
    const home = s.bikes[0];
    const offer = generateOffer(s, home.x, home.z)!;
    expect(offer).toBeTruthy();
    expect(offer.estimate.total).toBeGreaterThanOrEqual(60);
    acceptOffer(s); arriveAtPickup(s);
    s.time += 20;
    expect(boardPassenger(s)).toBe(true);
    const w = s.wallet;
    const r = completePersonalRide(s, { distanceM: offer.routeMeters * 1.02, elapsedSec: offer.routeMeters / 14, collisions: 0, hardEvents: 0, speedingSec: 0 })!;
    expect(r.status).toBe('completed');
    expect(s.wallet).toBe(w + r.final!.total);
    expect(r.final!.total).toBeLessThanOrEqual(Math.ceil(offer.estimate.total * 1.2) + r.final!.waiting);
    expect(s.personalRides).toHaveLength(1);
  });

  it('economy: a typical ride pays a meaningful amount and 1 lakh is reachable', () => {
    const s = newGameState(33);
    const fares: number[] = [];
    for (let i = 0; i < 60; i++) { const o = generateOffer(s, 520 + i * 7, 520 + i * 5)!; fares.push(o.estimate.total); }
    const avg = fares.reduce((a, b) => a + b, 0) / fares.length;
    console.log('average fare ₹' + Math.round(avg), 'min', Math.min(...fares), 'max', Math.max(...fares));
    expect(avg).toBeGreaterThan(120);
    expect(avg).toBeLessThan(600);
  });

  it('renders every screen/panel without crashing', async () => {
    const s = newGameState(7);
    s.savings = 130000;
    registerCompany(s, { name: 'Smoke Rides', tagline: 't', primary: '#ef4444', secondary: '#fff', logoShape: 'hex', logoIcon: '⚡', uniformStyle: 'chest', shirt: '#ef4444' });
    companyTx(s, 300000, 'capital', 'test', 'funds');
    buyCompanyBike(s, 'kaveri100', 'hq');
    const a = generateApplicant(s, 'rider'); a.licence = { number: 'X1', state: 'valid', expiryDay: 900 }; s.company!.applicants.push(a);
    approveApplicant(s, a.id, 'hq', 'flex');
    applyForLoan(s, 60000, 12);
    s.time = 1440 + 8 * 60;
    stepSim(s, 600);
    s.offer = generateOffer(s, 500, 500);
    useGame.setState({ g: s });
    const names = ['sleep', 'savings', 'wardrobe', 'shower', 'window', 'garage', 'menu', 'shop', 'medical', 'dealer', 'police', 'fuel', 'bank', 'register', 'brandwall', 'offline', 'pause', 'admin', 'employee', 'customer', 'ridesummary'];
    for (const n of names) {
      useGame.setState({ ui: { ...useGame.getState().ui, panel: n, panelArg: undefined } });
      await expect(renderToString(createElement(PanelHost))).resolves.toBeTypeOf('string');
    }
    for (const tab of ['fleet', 'recruit', 'branches']) {
      useGame.setState({ ui: { ...useGame.getState().ui, panel: 'admin', panelArg: tab } });
      expect((await renderToString(createElement(PanelHost))).length).toBeGreaterThan(500);
    }
    expect((await renderToString(createElement(HUD))).length).toBeGreaterThan(500);
    expect((await renderToString(createElement(Phone))).length).toBeGreaterThan(200);
    expect((await renderToString(createElement(MainMenu))).length).toBeGreaterThan(200);
    useGame.setState({ ui: { ...useGame.getState().ui, panel: 'admin', panelArg: undefined } });
    expect((await renderToString(createElement(PanelHost))).includes('Smoke Rides')).toBe(true);
  });

  it('save repository round-trips, validates and recovers from a corrupted primary', () => {
    const s = newGameState(9);
    s.wallet = 4321;
    expect(LocalSaveRepository.save(s)).toBe(true);
    s.wallet = 5000; LocalSaveRepository.save(s);
    expect(LocalSaveRepository.load().state!.wallet).toBe(5000);
    mem['rtr.save.primary'] = mem['rtr.save.primary'].replace('"wallet', '"wallex');
    const r = LocalSaveRepository.load();
    expect(r.source).toBe('backup');
    expect(r.state!.wallet).toBe(4321);
  });
});
