// Non-reactive, per-frame shared state. Kept outside React/Zustand to avoid re-renders.
export const runtime = {
  pos: { x: -55, z: -40 },
  yaw: -Math.PI / 2,
  clock: 0.32, // 0..1, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset
  locked: false,
  keys: new Set<string>(),
  zoom: 7,
  pitch: 0.35,
  camYaw: Math.PI / 2,
  moving: false,
  sprinting: false,
  inputBlocked: false,
  quality: 'medium' as 'low' | 'medium' | 'high',
  mouseSens: 1,
  camSens: 1,
  invertY: false,
  district: '',
  interactReq: false,
  night: 0,
};
