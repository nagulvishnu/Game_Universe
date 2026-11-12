import { get, set, del } from 'idb-keyval';
import type { SaveData } from './logic/profile';
import { validateSave } from './logic/profile';
import { SAVE_SLOTS } from './config';

export const SLOT_KEYS = [...Array.from({ length: SAVE_SLOTS }, (_, i) => `slot${i + 1}`), 'auto'];
const k = (slot: string) => `shinobi-legacy:${slot}`;

async function rawGet(key: string): Promise<unknown> {
  try { const v = await get(key); if (v !== undefined) return v; } catch { /* fall through to localStorage */ }
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : undefined; } catch { return 'corrupt-json'; }
}
async function rawSet(key: string, value: unknown) {
  try { await set(key, value); return; } catch { /* fall back */ }
  localStorage.setItem(key, JSON.stringify(value));
}

export type ReadResult = { status: 'ok'; data: SaveData } | { status: 'empty' } | { status: 'corrupt' };

export async function readSave(slot: string): Promise<ReadResult> {
  const raw = await rawGet(k(slot));
  if (raw === undefined || raw === null) return { status: 'empty' };
  const data = validateSave(raw);
  return data ? { status: 'ok', data } : { status: 'corrupt' };
}
export async function writeSave(slot: string, data: SaveData): Promise<boolean> {
  try { await rawSet(k(slot), JSON.parse(JSON.stringify(data))); return true; } catch { return false; }
}
export async function deleteSave(slot: string) {
  try { await del(k(slot)); } catch { /* ignore */ }
  try { localStorage.removeItem(k(slot)); } catch { /* ignore */ }
}
export async function listSaves(): Promise<{ slot: string; result: ReadResult }[]> {
  return Promise.all(SLOT_KEYS.map(async (slot) => ({ slot, result: await readSave(slot) })));
}
export async function latestSave(): Promise<SaveData | null> {
  let best: SaveData | null = null;
  for (const { result } of await listSaves()) if (result.status === 'ok' && (!best || result.data.savedAt > best.savedAt)) best = result.data;
  return best;
}
