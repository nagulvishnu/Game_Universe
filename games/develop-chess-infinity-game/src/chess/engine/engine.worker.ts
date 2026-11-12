import { handle } from "./handler";
import type { EngineRequest } from "./handler";

self.onmessage = (e: MessageEvent<EngineRequest>) => {
  const req = e.data;
  try {
    const result = handle(req, (done, total) => (self as unknown as Worker).postMessage({ id: req.id, progress: { done, total } }));
    (self as unknown as Worker).postMessage({ id: req.id, result });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id: req.id, error: String(err) });
  }
};
