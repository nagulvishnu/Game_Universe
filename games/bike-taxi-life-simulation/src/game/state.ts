import type { Bike, GameState, LedgerKind, Weather } from './types';
import { COMPETITORS } from './data';
import { poiById } from './world/city';
import { modelOf } from './data';

export const SAVE_VERSION = 3;
export const START_TIME = 7 * 60 + 15; // day 0, 7:15 AM

export function rnd(s: { rng: number }): number {
  s.rng = (s.rng + 0x6d2b79f5) >>> 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const rint = (s: { rng: number }, a: number, b: number) => Math.floor(a + rnd(s) * (b - a + 1));
export const pick = <T,>(s: { rng: number }, arr: T[]): T => arr[Math.floor(rnd(s) * arr.length)];

export const dayNow = (s: GameState) => Math.floor(s.time / 1440);
export const hourNow = (s: GameState) => Math.floor((s.time % 1440) / 60);

export function makePlate(s: { rng: number }): string {
  const L = 'ABCDEFGHJKLMNPRSTUVWXYZ';
  return `TN ${String(rint(s, 1, 99)).padStart(2, '0')} ${L[rint(s, 0, 22)]}${L[rint(s, 0, 22)]} ${rint(s, 1000, 9999)}`;
}

export function makeBike(s: GameState, owner: 'player' | 'company', modelId: string, x: number, z: number, opts: Partial<Bike> = {}): Bike {
  const m = modelOf(modelId);
  return {
    id: `B${Math.floor(rnd(s) * 1e9).toString(36)}`, owner, modelId, plate: makePlate(s), x, z, heading: 0,
    fuel: 0.8, damage: 0, oil: 100, tyres: 100, brakes: 100, color: m.color, decal: 0,
    upgrades: { engine: 0, brake: 0, suspension: 0, tyre: 0 }, odometerKm: 0, serviceHistory: [],
    insurance: { plan: 'none', expiresDay: 0 }, registrationExpiryDay: dayNow(s) + 365, status: 'parked', ...opts,
  };
}

export function newGameState(seed = Date.now() % 2147483647): GameState {
  const home = poiById.get('home')!;
  const s: GameState = {
    version: SAVE_VERSION, rng: seed, time: START_TIME, weather: 'sunny', weatherUntil: START_TIME + 240,
    wallet: 1800, savings: 0,
    needs: { energy: 90, hunger: 70, thirst: 75, health: 100 },
    player: {
      x: home.x + 6, z: home.z + 2, heading: Math.PI / 2, interior: null, onBike: false, bikeId: null, homeTier: 0,
      rentPaidUntilDay: 7, rentOverdue: 0, finesDue: 0, wearUniform: false, ridesDone: 0, ratingSum: 0, ratingCount: 0,
      licenceExpiryDay: 3000, ownedHomes: [], online: false, faint: 0,
    },
    bikes: [], company: null, rides: [], activeRideId: null, offer: null, myBooking: null, personalRides: [],
    ledger: [], ledgerSeq: 1, notifications: [], notifSeq: 1,
    competitors: JSON.parse(JSON.stringify(COMPETITORS)), stats: { ridesDone: 0, distanceKm: 0, collisions: 0, finesPaid: 0, meals: 0, sleeps: 0 },
    settings: { timeScale: 1, volume: 0.6, shadows: true, quality: 'medium', invertCam: false }, unlocks: ['taxiPlatform', 'maps', 'bank', 'contacts'],
    lastSavedReal: Date.now(), offlineReport: null, companyIncomeDay: {},
  };
  const b = makeBike(s, 'player', 'kaveri100', home.x + 6, home.z + 4, { oil: 62, tyres: 58, brakes: 64, fuel: 0.55, heading: Math.PI / 2 });
  s.bikes.push(b);
  s.notifications.push({ id: 0, time: s.time, text: 'Welcome to Chennai Nagar. Open your phone (F) → PillionGo and go online to earn.', type: 'info' });
  return s;
}

export function notify(s: GameState, text: string, type: 'info' | 'good' | 'bad' | 'warn' = 'info') {
  s.notifications.push({ id: s.notifSeq++, time: s.time, text, type });
  if (s.notifications.length > 60) s.notifications.splice(0, s.notifications.length - 60);
}

function pushLedger(s: GameState, account: 'wallet' | 'savings' | 'company', kind: LedgerKind, category: string, label: string, amount: number, balanceAfter: number, branchId?: string) {
  s.ledger.push({ id: s.ledgerSeq++, time: s.time, account, kind, category, label, amount, balanceAfter, branchId });
  if (s.ledger.length > 1600) s.ledger.splice(0, s.ledger.length - 1600);
}

/** Personal wallet transaction. Negative amounts fail (return false) if funds are insufficient. */
export function walletTx(s: GameState, amount: number, category: string, label: string, kind: LedgerKind = amount >= 0 ? 'income' : 'expense'): boolean {
  amount = Math.round(amount);
  if (amount < 0 && s.wallet + amount < 0) return false;
  s.wallet += amount;
  pushLedger(s, 'wallet', kind, category, label, amount, s.wallet);
  return true;
}
export function savingsTx(s: GameState, amount: number, category: string, label: string): boolean {
  amount = Math.round(amount);
  if (amount < 0 && s.savings + amount < 0) return false;
  s.savings += amount;
  pushLedger(s, 'savings', 'transfer', category, label, amount, s.savings);
  return true;
}
/** Company bank transaction. Never touches the personal wallet/savings. */
export function companyTx(s: GameState, amount: number, kind: LedgerKind, category: string, label: string, opts: { branchId?: string; allowNegative?: boolean } = {}): boolean {
  const c = s.company;
  if (!c) return false;
  amount = Math.round(amount);
  if (amount < 0 && !opts.allowNegative && c.bank + amount < 0) return false;
  c.bank += amount;
  pushLedger(s, 'company', kind, category, label, amount, c.bank, opts.branchId);
  if (opts.branchId) {
    const br = c.branches.find((b) => b.id === opts.branchId);
    if (br) { if (kind === 'income') br.revenue += amount; else if (kind === 'expense') br.expenses += -amount; }
  }
  return true;
}

export function adjustRep(s: GameState, delta: number) {
  if (!s.company) return;
  s.company.reputation = Math.max(0, Math.min(100, s.company.reputation + delta));
}

export function setWeather(s: GameState, w: Weather) { s.weather = w; }

export function depositLiability(s: GameState): number {
  return s.company ? s.company.employees.filter((e) => e.status !== 'resigned' && e.status !== 'terminated').reduce((a, e) => a + e.deposit, 0) : 0;
}

export function companyRating(s: GameState): number {
  const c = s.company;
  return c && c.ratingCount > 0 ? c.ratingSum / c.ratingCount : 4.2;
}
export function playerRating(s: GameState): number {
  return s.player.ratingCount > 0 ? s.player.ratingSum / s.player.ratingCount : 4.5;
}

/** Bike performance condition 0..100 from damage & wear. */
export function bikeCondition(b: Bike): number {
  const wear = (b.oil + b.tyres + b.brakes) / 3;
  return Math.max(0, Math.round(Math.min(wear, 100 - b.damage * 0.9) * 0.6 + (100 - b.damage) * 0.4));
}
