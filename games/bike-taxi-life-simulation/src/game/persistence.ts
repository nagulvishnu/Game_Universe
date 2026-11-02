import type { GameState } from './types';
import { SAVE_VERSION } from './state';
import { FARE_RULES } from './fare/rules';

/**
 * Persistence layer. The browser build stores saves in localStorage with a versioned envelope, a checksum and a
 * rotating backup. `SaveRepository` is the integration point for a Node/PostgreSQL backend.
 */
export interface SaveRepository {
  save(state: GameState): boolean;
  load(): { state: GameState | null; source: 'primary' | 'backup' | 'none'; error?: string };
  exists(): boolean;
  clear(): void;
  info(): { savedAt: number | null; hasBackup: boolean };
}

const KEY = 'rtr.save.primary';
const BKEY = 'rtr.save.backup';

function checksum(str: string): string {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
}

export function migrate(raw: Partial<GameState> & { version?: number }): GameState | null {
  if (!raw || typeof raw !== 'object' || typeof raw.version !== 'number') return null;
  if (raw.version > SAVE_VERSION) return null;
  const s = raw as GameState;
  // defaults for fields added in later versions
  s.stats = { ridesDone: 0, distanceKm: 0, collisions: 0, finesPaid: 0, meals: 0, sleeps: 0, ...(s.stats ?? {}) };
  s.settings = Object.assign({ timeScale: 1, volume: 0.6, shadows: true, quality: 'medium', invertCam: false }, s.settings ?? {}) as GameState['settings'];
  s.unlocks = s.unlocks ?? ['taxiPlatform', 'maps', 'bank', 'contacts'];
  s.personalRides = s.personalRides ?? [];
  s.companyIncomeDay = s.companyIncomeDay ?? {};
  s.rides = (s.rides ?? []).filter((r) => r.driverType === 'employee' || ['completed', 'cancelled', 'expired'].includes(r.status));
  s.activeRideId = null; s.offer = null; s.offlineReport = null;
  if (s.myBooking && !s.rides.find((r) => r.id === s.myBooking && r.status !== 'completed' && r.status !== 'cancelled' && r.status !== 'expired')) s.myBooking = null;
  if (s.company) s.company.employees.forEach((e) => { e.earnings = e.earnings ?? []; e.history = e.history ?? []; });
  s.version = SAVE_VERSION;
  // sanity validation
  const finite = [s.time, s.wallet, s.savings, s.player?.x, s.player?.z];
  if (!finite.every((n) => Number.isFinite(n)) || !s.needs || !Array.isArray(s.bikes)) return null;
  if (s.company && !Number.isFinite(s.company.bank)) return null;
  return s;
}

export const LocalSaveRepository: SaveRepository = {
  save(state) {
    try {
      const data = JSON.stringify({ ...state, offer: null });
      const env = JSON.stringify({ v: SAVE_VERSION, savedAt: Date.now(), sum: checksum(data), fareRulesVersion: FARE_RULES.version, data });
      const prev = localStorage.getItem(KEY);
      if (prev) localStorage.setItem(BKEY, prev);
      localStorage.setItem(KEY, env);
      return true;
    } catch { return false; }
  },
  load() {
    const tryKey = (k: string) => {
      const txt = localStorage.getItem(k);
      if (!txt) return null;
      const env = JSON.parse(txt);
      if (checksum(env.data) !== env.sum) throw new Error('checksum mismatch');
      return migrate(JSON.parse(env.data));
    };
    let err: string | undefined;
    try { const s = tryKey(KEY); if (s) return { state: s, source: 'primary' }; } catch (e) { err = String(e); }
    try { const s = tryKey(BKEY); if (s) return { state: s, source: 'backup', error: err }; } catch (e) { err = String(e); }
    return { state: null, source: 'none', error: err };
  },
  exists() { return !!localStorage.getItem(KEY) || !!localStorage.getItem(BKEY); },
  clear() { localStorage.removeItem(KEY); localStorage.removeItem(BKEY); },
  info() {
    try { const t = localStorage.getItem(KEY); return { savedAt: t ? JSON.parse(t).savedAt : null, hasBackup: !!localStorage.getItem(BKEY) }; } catch { return { savedAt: null, hasBackup: false }; }
  },
};
