// Pose library. Rotations are authored in degrees, stored in radians.
export const JOINTS = ["hips", "spine", "chest", "head", "lSh", "lEl", "rSh", "rEl", "lHp", "lKn", "rHp", "rKn"] as const;
export type Joint = (typeof JOINTS)[number];
export type PoseSpec = Partial<Record<Joint, [number, number, number]>> & { lay?: number; hy?: number };

export const LAY = JOINTS.length * 3;
export const HY = LAY + 1;
export const POSE_LEN = LAY + 2;
const D = Math.PI / 180;

export function mkPose(spec: PoseSpec, base?: Float32Array): Float32Array {
  const p = base ? base.slice() : new Float32Array(POSE_LEN);
  JOINTS.forEach((j, i) => {
    const v = spec[j];
    if (v) { p[i * 3] = v[0] * D; p[i * 3 + 1] = v[1] * D; p[i * 3 + 2] = v[2] * D; }
  });
  if (spec.lay !== undefined) p[LAY] = spec.lay;
  if (spec.hy !== undefined) p[HY] = spec.hy;
  return p;
}

export const STANCE = mkPose({
  spine: [4, -10, 0], chest: [0, -8, 0], head: [-4, 0, 0],
  lSh: [-55, 0, 12], lEl: [-85, 0, 0], rSh: [-35, 0, -8], rEl: [-100, 0, 0],
  lHp: [-22, 0, 6], lKn: [38, 0, 0], rHp: [14, 0, -6], rKn: [30, 0, 0],
});
const P = (s: PoseSpec) => mkPose(s, STANCE);

export const POSES: Record<string, Float32Array> = {
  idle: STANCE,
  block: P({ spine: [12, 0, 0], chest: [8, 0, 0], head: [10, 0, 0], lSh: [-105, 0, 25], lEl: [-135, 0, 0], rSh: [-105, 0, -25], rEl: [-135, 0, 0], lHp: [-30, 0, 10], lKn: [55, 0, 0], rHp: [20, 0, -10], rKn: [45, 0, 0] }),
  parry: P({ spine: [-8, 0, 0], chest: [-8, 0, 0], head: [-8, 0, 0], lSh: [-100, 0, 55], lEl: [-30, 0, 0], rSh: [-100, 0, -55], rEl: [-30, 0, 0], lHp: [-30, 0, 10], lKn: [40, 0, 0], rHp: [20, 0, -10], rKn: [35, 0, 0] }),
  jump: P({ lHp: [-50, 0, 8], lKn: [70, 0, 0], rHp: [-15, 0, -8], rKn: [75, 0, 0], lSh: [-60, 0, 30], rSh: [-60, 0, -30], hy: 0.02 }),
  fall: P({ lHp: [-20, 0, 15], lKn: [20, 0, 0], rHp: [-10, 0, -15], rKn: [20, 0, 0], lSh: [-120, 0, 40], rSh: [-120, 0, -40], lEl: [-20, 0, 0], rEl: [-20, 0, 0], hy: 0.02 }),
  hit: P({ spine: [-18, 0, 0], chest: [-10, 10, 0], head: [-22, 0, 0], lSh: [25, 0, 35], rSh: [15, 0, -35], lEl: [-40, 0, 0], rEl: [-30, 0, 0], lHp: [-10, 0, 8], lKn: [30, 0, 0], rHp: [8, 0, -6], rKn: [35, 0, 0] }),
  launched: P({ hips: [-25, 0, 0], spine: [-30, 0, 0], chest: [-10, 0, 0], head: [-25, 0, 0], lSh: [40, 0, 50], rSh: [40, 0, -50], lEl: [-20, 0, 0], rEl: [-20, 0, 0], lHp: [-35, 0, 12], lKn: [40, 0, 0], rHp: [-10, 0, -12], rKn: [60, 0, 0], hy: 0.1 }),
  down: P({ lay: 1, spine: [0, 0, 0], chest: [0, 0, 0], head: [-5, 0, 0], lSh: [10, 0, 35], rSh: [10, 0, -35], lEl: [-15, 0, 0], rEl: [-15, 0, 0], lHp: [-5, 0, 10], lKn: [15, 0, 0], rHp: [-5, 0, -10], rKn: [10, 0, 0] }),
  getup: P({ hips: [25, 0, 0], spine: [40, 0, 0], chest: [0, 0, 0], lHp: [-100, 0, 10], lKn: [110, 0, 0], rHp: [-20, 0, -6], rKn: [120, 0, 0], lSh: [-40, 0, 12], rSh: [-40, 0, -12], lEl: [-60, 0, 0], rEl: [-60, 0, 0] }),
  frozen: P({ spine: [-14, 0, 0], head: [-14, 0, 0], lSh: [25, 0, 35], rSh: [-30, 0, -45], lEl: [-40, 0, 0], rEl: [-60, 0, 0] }),
  victory: P({ rSh: [-175, 0, -12], rEl: [-10, 0, 0], lSh: [-20, 0, 25], lEl: [-90, 0, 0], head: [-12, 0, 0], chest: [-6, 0, 0], spine: [-4, 0, 0], lHp: [-12, 0, 8], lKn: [20, 0, 0], rHp: [10, 0, -8], rKn: [18, 0, 0] }),
  charge: P({ lSh: [-35, 0, 75], rSh: [-35, 0, -75], lEl: [-25, 0, 0], rEl: [-25, 0, 0], head: [-28, 0, 0], chest: [-10, 0, 0], spine: [-6, 0, 0], lHp: [-12, 0, 18], lKn: [18, 0, 0], rHp: [-12, 0, -18], rKn: [18, 0, 0] }),
  roar: P({ lSh: [-20, 0, 35], rSh: [-20, 0, -35], lEl: [-100, 0, 0], rEl: [-100, 0, 0], head: [-30, 0, 0], chest: [-18, 0, 0], spine: [-8, 0, 0], lHp: [-15, 0, 20], lKn: [25, 0, 0], rHp: [-15, 0, -20], rKn: [25, 0, 0] }),
  ultPoint: P({ rSh: [-125, 0, -10], rEl: [-5, 0, 0], lSh: [-60, 0, 10], lEl: [-90, 0, 0], chest: [0, 20, 0], head: [-10, 0, 0], spine: [-4, 8, 0] }),
  dashPose: P({ hips: [18, 0, 0], spine: [28, 0, 0], chest: [10, 0, 0], head: [-20, 0, 0], lHp: [-55, 0, 5], lKn: [75, 0, 0], rHp: [40, 0, -5], rKn: [40, 0, 0], lSh: [40, 0, 15], rSh: [45, 0, -15], lEl: [-30, 0, 0], rEl: [-30, 0, 0] }),
  vanish: P({ spine: [10, 0, 0], lSh: [-20, 0, 20], rSh: [-20, 0, -20] }),
};

export const ANIMS: Record<string, { wind: Float32Array; strike: Float32Array }> = {
  jabL: {
    wind: P({ lSh: [-45, 0, 15], lEl: [-125, 0, 0], chest: [0, 12, 0], spine: [4, 10, 0] }),
    strike: P({ lSh: [-92, 0, 6], lEl: [-4, 0, 0], chest: [0, -30, 0], spine: [8, -18, 0], hips: [0, -8, 0], lHp: [-30, 0, 6], lKn: [45, 0, 0], head: [-2, 10, 0] }),
  },
  jabR: {
    wind: P({ rSh: [-30, 0, -10], rEl: [-130, 0, 0], chest: [0, -15, 0] }),
    strike: P({ rSh: [-92, 0, -5], rEl: [-4, 0, 0], chest: [0, 38, 0], spine: [8, 22, 0], hips: [0, 12, 0], rHp: [-8, 0, -6], rKn: [40, 0, 0] }),
  },
  hook: {
    wind: P({ rSh: [0, -25, -85], rEl: [-90, 0, 0], chest: [0, -28, 0], spine: [0, -10, 0] }),
    strike: P({ rSh: [-10, 85, -85], rEl: [-80, 0, 0], chest: [0, 45, 0], spine: [8, 22, 0], hips: [0, 14, 0], lHp: [-28, 0, 6], lKn: [45, 0, 0] }),
  },
  cross: {
    wind: P({ rSh: [-20, 0, -15], rEl: [-140, 0, 0], chest: [0, -30, 0], spine: [10, -12, 0], hips: [8, 0, 0], lKn: [55, 0, 0] }),
    strike: P({ rSh: [-95, 0, -5], rEl: [-2, 0, 0], chest: [0, 52, 0], spine: [14, 30, 0], hips: [8, 18, 0], lHp: [-40, 0, 10], lKn: [55, 0, 0], rHp: [20, 0, -6], rKn: [20, 0, 0] }),
  },
  uppercut: {
    wind: P({ rSh: [-10, 0, -10], rEl: [-120, 0, 0], spine: [18, -10, 0], hips: [10, 0, 0], lHp: [-35, 0, 6], lKn: [60, 0, 0], rKn: [50, 0, 0] }),
    strike: P({ rSh: [-165, 0, -10], rEl: [-30, 0, 0], spine: [-12, 25, 0], chest: [-10, 25, 0], hips: [-8, 10, 0], lHp: [-8, 0, 6], lKn: [8, 0, 0], rHp: [0, 0, -6], rKn: [8, 0, 0], head: [-15, 0, 0] }),
  },
  roundhouse: {
    wind: P({ rHp: [0, -10, -80], rKn: [70, 0, 0], spine: [-6, -20, 0], lSh: [-60, 0, 30], rSh: [-30, 0, -30], lKn: [30, 0, 0], lHp: [-10, 0, 6] }),
    strike: P({ rHp: [0, 72, -80], rKn: [12, 0, 0], spine: [-4, 30, 12], chest: [0, 20, 0], lSh: [-40, 0, 50], rSh: [-50, 0, -50], lHp: [-8, 0, 6], lKn: [28, 0, 0], head: [0, -10, 0] }),
  },
  slam: {
    wind: P({ lSh: [-170, 0, 10], rSh: [-170, 0, -10], lEl: [-30, 0, 0], rEl: [-30, 0, 0], spine: [-20, 0, 0], chest: [-12, 0, 0], head: [-15, 0, 0] }),
    strike: P({ lSh: [-50, 0, 8], rSh: [-50, 0, -8], lEl: [-10, 0, 0], rEl: [-10, 0, 0], spine: [38, 0, 0], chest: [14, 0, 0], head: [10, 0, 0], hips: [22, 0, 0], lHp: [-35, 0, 6], lKn: [60, 0, 0], rHp: [25, 0, -6], rKn: [40, 0, 0] }),
  },
  cast: {
    wind: P({ lSh: [-35, 0, 45], rSh: [-35, 0, -45], lEl: [-110, 0, 0], rEl: [-110, 0, 0], chest: [-5, 0, 0], spine: [-3, 0, 0] }),
    strike: P({ lSh: [-92, 0, 6], rSh: [-92, 0, -6], lEl: [-6, 0, 0], rEl: [-6, 0, 0], chest: [4, 0, 0], spine: [8, 0, 0], lHp: [-30, 0, 6], lKn: [48, 0, 0], rHp: [24, 0, -6], rKn: [30, 0, 0] }),
  },
  castUp: {
    wind: P({ lSh: [-30, 0, 20], rSh: [-30, 0, -20], lEl: [-100, 0, 0], rEl: [-100, 0, 0], spine: [10, 0, 0] }),
    strike: P({ lSh: [-170, 0, 10], rSh: [-170, 0, -10], lEl: [-20, 0, 0], rEl: [-20, 0, 0], head: [-25, 0, 0], spine: [-12, 0, 0], chest: [-10, 0, 0], lKn: [20, 0, 0], rKn: [20, 0, 0] }),
  },
  dashPose: { wind: POSES.dashPose, strike: POSES.dashPose },
  airKick: {
    wind: P({ rHp: [-20, 0, -8], rKn: [100, 0, 0], lHp: [-40, 0, 8], lKn: [70, 0, 0], lSh: [-60, 0, 30], rSh: [-60, 0, -30], hy: 0.02 }),
    strike: P({ rHp: [-95, 0, -5], rKn: [5, 0, 0], lHp: [0, 0, 10], lKn: [90, 0, 0], spine: [-18, 0, 0], lSh: [-60, 0, 40], rSh: [-30, 0, -40], hips: [-15, 0, 0], hy: 0.02 }),
  },
  airSlam: {
    wind: P({ lSh: [-170, 0, 10], rSh: [-170, 0, -10], lEl: [-30, 0, 0], rEl: [-30, 0, 0], lHp: [-40, 0, 8], lKn: [70, 0, 0], rHp: [-15, 0, -8], rKn: [75, 0, 0], hy: 0.02 }),
    strike: P({ lSh: [-70, 0, 8], rSh: [-70, 0, -8], lEl: [-10, 0, 0], rEl: [-10, 0, 0], spine: [40, 0, 0], hips: [30, 0, 0], lHp: [-60, 0, 8], lKn: [80, 0, 0], rHp: [-40, 0, -8], rKn: [90, 0, 0], hy: 0.02 }),
  },
};
