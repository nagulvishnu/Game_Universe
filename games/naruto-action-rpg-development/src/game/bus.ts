// Minimal typed event bus decoupling UI/store from the real-time simulation.
type Handler = (payload: any) => void;
const handlers = new Map<string, Set<Handler>>();
export const bus = {
  on(evt: string, fn: Handler) {
    let s = handlers.get(evt); if (!s) { s = new Set(); handlers.set(evt, s); }
    s.add(fn); return () => { s!.delete(fn); };
  },
  emit(evt: string, payload?: unknown) { handlers.get(evt)?.forEach((h) => h(payload)); },
};
