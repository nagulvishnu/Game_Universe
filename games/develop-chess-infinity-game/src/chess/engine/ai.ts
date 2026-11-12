import EngineWorker from "./engine.worker?worker&inline";
import { handle } from "./handler";
import type { EngineRequest, EvalResult } from "./handler";

type Pending = { resolve: (v: unknown) => void; reject: (e: unknown) => void; onProgress?: (d: number, t: number) => void };
let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, Pending>();
let workerBroken = false;

function getWorker(): Worker | null {
  if (workerBroken) return null;
  if (worker) return worker;
  try {
    const w = new EngineWorker();
    worker = w;
    w.onmessage = (e: MessageEvent) => {
      const { id, result, error, progress } = e.data;
      const p = pending.get(id); if (!p) return;
      if (progress) { p.onProgress?.(progress.done, progress.total); return; }
      pending.delete(id);
      if (error) p.reject(new Error(error)); else p.resolve(result);
    };
    w.onerror = () => { workerBroken = true; worker = null; };
    return w;
  } catch { workerBroken = true; return null; }
}

function call<T>(req: Omit<EngineRequest, "id"> & Record<string, unknown>, onProgress?: (d: number, t: number) => void): Promise<T> {
  const id = ++seq; const full = { ...req, id } as EngineRequest;
  const w = getWorker();
  if (!w) { // graceful fallback: run on the main thread
    return new Promise<T>((resolve, reject) => setTimeout(() => { try { resolve(handle(full, onProgress) as T); } catch (e) { reject(e); } }, 20));
  }
  return new Promise<T>((resolve, reject) => { pending.set(id, { resolve: resolve as (v: unknown) => void, reject, onProgress }); w.postMessage(full); });
}

/** Abort any running search (terminates the worker; a fresh one is created lazily). */
export function cancelAI() {
  if (worker) { worker.terminate(); worker = null; }
  pending.forEach((p) => p.reject(new Error("cancelled")));
  pending.clear();
}

export const aiMove = (fen: string, level: number, timeMs?: number) => call<EvalResult>({ kind: "move", fen, level, timeMs });
export const evalPosition = (fen: string, depth = 3, timeMs = 600) => call<EvalResult>({ kind: "eval", fen, depth, timeMs });
export const analyzePositions = (fens: string[], onProgress: (d: number, t: number) => void, depth = 4, timeMs = 300) =>
  call<EvalResult[]>({ kind: "analyze", fens, depth, timeMs }, onProgress);
