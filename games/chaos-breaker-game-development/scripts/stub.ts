/* headless smoke test: runs the game engine for many frames with fuzzed input */
const noop = () => {};
const ctx2d: any = new Proxy({}, { get: (_t, k) => k === 'createImageData' ? (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : noop, set: () => true });
(globalThis as any).document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d, style: {} }), addEventListener: noop };
(globalThis as any).window = { innerWidth: 1280, innerHeight: 720, addEventListener: noop };
(globalThis as any).localStorage = { getItem: () => null, setItem: noop };
(globalThis as any).navigator = { userAgent: 'node', maxTouchPoints: 0, getGamepads: () => [] };
