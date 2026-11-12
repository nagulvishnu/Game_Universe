import type { Core } from './store';

const DB = 'stickverse', STORE = 'saves';
function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
export interface SaveMeta { slot: string; name: string; level: number; money: number; rep: number; at: number; terr: number }
export async function saveSlot(slot: string, data: Core): Promise<void> {
  try {
    const db = await open();
    await new Promise<void>((res, rej) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put({ data, at: Date.now() }, slot); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
  } catch { try { localStorage.setItem('sv_' + slot, JSON.stringify({ data, at: Date.now() })); } catch { /* ignore */ } }
}
export async function loadSlot(slot: string): Promise<{ data: Core; at: number } | null> {
  try {
    const db = await open();
    return await new Promise((res) => { const rq = db.transaction(STORE).objectStore(STORE).get(slot); rq.onsuccess = () => res(rq.result ?? null); rq.onerror = () => res(null); });
  } catch { try { const s = localStorage.getItem('sv_' + slot); return s ? JSON.parse(s) : null; } catch { return null; } }
}
export async function listSaves(): Promise<(SaveMeta | null)[]> {
  const slots = ['slot1', 'slot2', 'slot3', 'auto'];
  const out: (SaveMeta | null)[] = [];
  for (const s of slots) {
    const r = await loadSlot(s);
    out.push(r ? { slot: s, name: r.data.name, level: r.data.level, money: r.data.money, rep: r.data.rep, at: r.at, terr: Object.values(r.data.terr).filter((t) => t.state === 'Villain-Controlled' || t.state === 'Fully Conquered').length } : null);
  }
  return out;
}
export async function deleteSlot(slot: string): Promise<void> {
  try { const db = await open(); await new Promise<void>((res) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).delete(slot); tx.oncomplete = () => res(); }); } catch { localStorage.removeItem('sv_' + slot); }
}
