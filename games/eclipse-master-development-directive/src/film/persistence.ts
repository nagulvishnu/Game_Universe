// IndexedDB persistence for save/restore and runtime reports (no dependency).
const DB = 'eclipse-film';
const STORE = 'kv';

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    if (typeof indexedDB === 'undefined') return rej(new Error('no indexedDB'));
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  const db = await open();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error);
  });
  db.close();
}
export async function kvGet<T>(key: string): Promise<T | undefined> {
  const db = await open();
  const v = await new Promise<T | undefined>((res, rej) => {
    const tx = db.transaction(STORE, 'readonly'); const q = tx.objectStore(STORE).get(key);
    q.onsuccess = () => res(q.result as T | undefined); q.onerror = () => rej(q.error);
  });
  db.close();
  return v;
}

export interface SavedProgress { sceneIdx: number; totalT: number; report: Record<string, unknown>; savedAt: number }
export const saveProgress = (p: SavedProgress) => kvSet('progress', p);
export const loadProgress = () => kvGet<SavedProgress>('progress');
