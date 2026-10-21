/** Vitest setup: give jsdom a minimal canvas so Phaser's device probe can load. */

const ctxStub = new Proxy({
  fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1, font: '', textBaseline: '',
  canvas: { width: 1, height: 1 },
  getImageData: () => ({ data: new Uint8ClampedArray([0, 0, 0, 0]), width: 1, height: 1 }),
  createImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
  measureText: () => ({ width: 0 }),
} as Record<string, unknown>, {
  get(target, prop) {
    if (prop in target) return target[prop as string];
    return () => undefined;
  },
  set(target, prop, value) { target[prop as string] = value; return true; },
});

Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: () => ctxStub,
  writable: true,
});

Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
  value: () => 'data:image/png;base64,',
  writable: true,
});
