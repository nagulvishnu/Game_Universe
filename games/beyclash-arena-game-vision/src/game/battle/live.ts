// Non-reactive live battle state for the HUD (polled at ~10 Hz) so the render loop never triggers React re-renders.
export const live = {
  time: 0,
  stamina: [100, 100] as [number, number],
  burst: [0, 0] as [number, number],
  dashCd: 0,
  meter: 0,
  meterLocked: false,
  power: 0.5,
  count: 3,
  countT: 0,
  introT: 0,
  hits: 0,
  moved: false,
  dashed: false,
  collided: false,
  oppStrategy: '',
  finish: null as null | { finish: string; winner: 0 | 1 },
  skipIntro: false,
  lowFlash: 0,
  reset() {
    this.time = 0; this.stamina = [100, 100]; this.burst = [0, 0]; this.dashCd = 0; this.meter = 0; this.meterLocked = false;
    this.power = 0.5; this.count = 3; this.countT = 0; this.introT = 0; this.hits = 0; this.moved = false; this.dashed = false;
    this.collided = false; this.finish = null; this.skipIntro = false; this.lowFlash = 0;
  },
};
(window as unknown as Record<string, unknown>).__live = live;
