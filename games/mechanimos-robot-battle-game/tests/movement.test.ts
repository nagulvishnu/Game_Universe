// Phase 9.2 — unit tests for pure input-state, camera-math and vehicle-movement
// logic. No framework: plain asserts, esbuild-bundled then run by Node,
// matching the existing tests/ convention. No DOM required.
import assert from 'node:assert';

import { InputState } from '../src/three3d/core/input';
import {
  DEFAULT_CAMERA_LIMITS,
  clampDistance,
  clampPitch,
  damp,
  dampFactor,
  orbitOffset,
  wrapAngle,
} from '../src/three3d/core/camera';
import {
  DEFAULT_VEHICLE_CONFIG as CFG,
  createVehicleState,
  stepVehicle,
} from '../src/three3d/core/vehicle';

const DT = 1 / 60;

// ================= 1. InputState: press / release / clear =================
const s = new InputState();
assert.strictEqual(s.heldCount, 0, 'starts empty');
assert.strictEqual(s.throttleAxis, 0, 'no throttle initially');
assert.strictEqual(s.steerAxis, 0, 'no steering initially');
assert.strictEqual(s.hasMovement, false, 'no movement initially');

s.press('KeyW');
assert.ok(s.isDown('KeyW'), 'isDown reflects press');
assert.strictEqual(s.throttleAxis, 1, 'W is forward throttle');
assert.ok(s.hasMovement, 'movement detected');

s.release('KeyW');
assert.strictEqual(s.throttleAxis, 0, 'release clears throttle');
assert.strictEqual(s.heldCount, 0, 'release removes the key');

// ================= 2. InputState: both key sets work =================
const s2 = new InputState();
s2.press('ArrowUp');
assert.strictEqual(s2.throttleAxis, 1, 'ArrowUp is forward');
s2.release('ArrowUp');
s2.press('ArrowDown');
assert.strictEqual(s2.throttleAxis, -1, 'ArrowDown is reverse/brake');
s2.release('ArrowDown');
s2.press('KeyD');
assert.strictEqual(s2.steerAxis, 1, 'D steers right');
s2.release('KeyD');
s2.press('ArrowLeft');
assert.strictEqual(s2.steerAxis, -1, 'ArrowLeft steers left');

// ================= 3. InputState: clear() releases everything =================
const s3 = new InputState();
s3.press('KeyW');
s3.press('KeyA');
s3.press('ArrowUp');
assert.strictEqual(s3.heldCount, 3, 'three keys held');
s3.clear();
assert.strictEqual(s3.heldCount, 0, 'clear() drops every key');
assert.strictEqual(s3.throttleAxis, 0, 'clear() clears throttle (blur safety)');
assert.strictEqual(s3.steerAxis, 0, 'clear() clears steering (blur safety)');
assert.strictEqual(s3.hasMovement, false, 'clear() clears movement');

// ================= 4. InputState: opposing keys cancel =================
const s4 = new InputState();
s4.press('KeyW');
s4.press('KeyS');
assert.strictEqual(s4.throttleAxis, 0, 'W and S cancel to neutral throttle');
s4.press('KeyA');
s4.press('KeyD');
assert.strictEqual(s4.steerAxis, 0, 'A and D cancel to neutral steering');
s4.release('KeyS');
assert.strictEqual(s4.throttleAxis, 1, 'releasing S leaves forward throttle');

// ================= 5. Camera maths: clamps =================
assert.strictEqual(clampPitch(0.05), DEFAULT_CAMERA_LIMITS.minPitch, 'pitch clamps to min');
assert.strictEqual(clampPitch(5), DEFAULT_CAMERA_LIMITS.maxPitch, 'pitch clamps to max');
assert.strictEqual(clampPitch(0.5), 0.5, 'in-range pitch passes through');
assert.strictEqual(clampDistance(0.1), DEFAULT_CAMERA_LIMITS.minDistance, 'zoom clamps to min');
assert.strictEqual(clampDistance(999), DEFAULT_CAMERA_LIMITS.maxDistance, 'zoom clamps to max');
assert.strictEqual(clampDistance(9), 9, 'in-range zoom passes through');

// ================= 6. Camera maths: wrapAngle =================
assert.ok(Math.abs(wrapAngle(0)) < 1e-9, 'zero wraps to zero');
const wrapped = wrapAngle(Math.PI * 2 + 0.5);
assert.ok(wrapped > 0 && wrapped < Math.PI, `2PI+0.5 wraps into (-PI,PI] (got ${wrapped})`);
assert.ok(Math.abs(wrapAngle(-Math.PI * 2 - 0.5) + 0.5) < 1e-6, 'large negative angle wraps');
for (let i = 0; i < 200; i++) {
  assert.ok(wrapAngle(i * 0.37) <= Math.PI && wrapAngle(i * 0.37) > -Math.PI, 'always in range');
}

// ================= 7. Camera maths: damping =================
assert.strictEqual(dampFactor(0, DT), 0, 'lambda 0 gives no smoothing');
assert.strictEqual(dampFactor(5, 0), 0, 'zero dt gives no smoothing');
const f = dampFactor(12, DT);
assert.ok(f > 0 && f < 1, 'damping factor is a fraction');
assert.strictEqual(damp(10, 20, 5, DT), 10 + 10 * dampFactor(5, DT), 'damp moves a fraction of the gap');
// Frame-rate independence: half the dt twice must equal one full dt closely.
const oneStep = damp(0, 1, 8, 1 / 30);
const twoSteps = damp(damp(0, 1, 8, 1 / 60), 1, 8, 1 / 60);
assert.ok(Math.abs(oneStep - twoSteps) < 1e-6, `damping is frame-rate independent (${oneStep} vs ${twoSteps})`);

// ================= 8. Camera maths: orbitOffset spherical placement =================
const o = orbitOffset(0, Math.PI / 2, 10);
assert.ok(Math.abs(o.x) < 1e-6, 'yaw 0 pitch 90deg -> on +Z axis (x=0)');
assert.ok(Math.abs(o.y - 10) < 1e-6, 'pitch 90deg -> full height');
assert.ok(Math.abs(o.z) < 1e-6, 'pitch 90deg -> z=0');
const dist = orbitOffset(1.1, 0.6, 9).length();
assert.ok(Math.abs(dist - 9) < 1e-6, `orbit offset length equals distance (got ${dist})`);

// ================= 9. Vehicle: acceleration is gradual, not instant =================
let v = createVehicleState();
assert.deepStrictEqual(v, { speed: 0, heading: 0, x: 0, z: 0 }, 'fresh vehicle at rest at origin');

v = stepVehicle(v, { throttle: 1, steer: 0 }, DT);
assert.ok(v.speed > 0 && v.speed < CFG.maxForwardSpeed, `one frame does not teleport to max (${v.speed})`);
assert.ok(Math.abs(v.speed - CFG.accel * DT) < 1e-9, 'acceleration is accel * dt');

// ================= 10. Vehicle: reaches and respects max forward speed =================
// 3s of full throttle travels ~44 units, which stays inside the +/-140 world
// limit (a longer run would legitimately stop at the boundary instead).
let fast = createVehicleState();
for (let i = 0; i < 60 * 3; i++) fast = stepVehicle(fast, { throttle: 1, steer: 0 }, DT);
assert.ok(Math.abs(fast.speed - CFG.maxForwardSpeed) < 1e-6, `caps at maxForwardSpeed (${fast.speed})`);
assert.ok(fast.z > 20, `traveled forward along +Z (z=${fast.z.toFixed(1)})`);
assert.ok(fast.z < CFG.worldLimit, 'still inside the world limit');

// ================= 11. Vehicle: braking stops, then reverses =================
let b = { ...fast };
b = stepVehicle(b, { throttle: -1, steer: 0 }, DT);
assert.ok(b.speed < fast.speed, 'brake input reduces speed immediately');
// Braking from full forward speed must not skip past zero into reverse.
const brakedOnce = stepVehicle(fast, { throttle: -1, steer: 0 }, DT);
assert.ok(brakedOnce.speed >= 0, 'braking from forward does not instantly become reverse');
// Eventually stops, then goes negative.
let rev = fast;
for (let i = 0; i < 60 * 20; i++) rev = stepVehicle(rev, { throttle: -1, steer: 0 }, DT);
assert.ok(rev.speed < 0, 'held reverse accelerates backwards');
assert.ok(Math.abs(rev.speed + CFG.maxReverseSpeed) < 1e-6, `reverse caps at maxReverseSpeed (${rev.speed})`);

// ================= 12. Vehicle: coast-down decays to zero smoothly =================
let coast = { speed: 10, heading: 0, x: 0, z: 0 };
coast = stepVehicle(coast, { throttle: 0, steer: 0 }, DT);
assert.ok(coast.speed < 10 && coast.speed > 0, 'coasting decays but stays positive');
for (let i = 0; i < 60 * 20; i++) coast = stepVehicle(coast, { throttle: 0, steer: 0 }, DT);
assert.strictEqual(coast.speed, 0, 'coast settles exactly at zero');

// ================= 13. Vehicle: steering requires speed =================
let still = createVehicleState();
still = stepVehicle(still, { throttle: 0, steer: 1 }, DT);
assert.strictEqual(still.heading, 0, 'stationary vehicle does not rotate');
assert.strictEqual(still.x, 0, 'stationary vehicle does not drift');

// ================= 14. Vehicle: steering authority scales with speed =================
let slow = { speed: 1, heading: 0, x: 0, z: 0 };
let turnSlow = stepVehicle(slow, { throttle: 0, steer: 1 }, DT);
const slowTurn = Math.abs(turnSlow.heading);
let quick = { speed: CFG.maxForwardSpeed, heading: 0, x: 0, z: 0 };
let turnQuick = stepVehicle(quick, { throttle: 0, steer: 1 }, DT);
const quickTurn = Math.abs(turnQuick.heading);
assert.ok(quickTurn > slowTurn, `faster vehicle turns more per frame (${quickTurn} vs ${slowTurn})`);
assert.ok(quickTurn <= CFG.steerRate * DT + 1e-9, 'turn rate is capped by steerRate');

// ================= 15. Vehicle: reversing mirrors steering =================
const fwd = stepVehicle({ speed: 8, heading: 0, x: 0, z: 0 }, { throttle: 0, steer: 1 }, DT);
const back = stepVehicle({ speed: -8, heading: 0, x: 0, z: 0 }, { throttle: 0, steer: 1 }, DT);
assert.ok(fwd.heading > 0 && back.heading < 0, `reverse mirrors steering (fwd ${fwd.heading.toFixed(3)}, rev ${back.heading.toFixed(3)})`);

// ================= 16. Vehicle: frame-rate independence =================
let ref = createVehicleState();
for (let i = 0; i < 60; i++) ref = stepVehicle(ref, { throttle: 1, steer: 0.5 }, DT);
let coarse = createVehicleState();
for (let i = 0; i < 30; i++) coarse = stepVehicle(coarse, { throttle: 1, steer: 0.5 }, 1 / 30);
assert.ok(Math.abs(ref.speed - coarse.speed) < 1e-6, `speed is frame-rate independent (${ref.speed} vs ${coarse.speed})`);
assert.ok(Math.abs(ref.heading - coarse.heading) < 1e-6, `heading is frame-rate independent (${ref.heading} vs ${coarse.heading})`);
// Position follows a curved path, so it uses midpoint integration: exact along
// a straight line, but a sub-1% arc-vs-chord residual remains between step
// sizes. Speed and heading above are the strictly frame-rate independent parts.
assert.ok(
  Math.abs(ref.z - coarse.z) < 1e-2,
  `position is frame-rate independent within 1% (${ref.z.toFixed(4)} vs ${coarse.z.toFixed(4)})`,
);
// Straight-line travel must be exact.
let lineA = createVehicleState();
let lineB = createVehicleState();
for (let i = 0; i < 60; i++) lineA = stepVehicle(lineA, { throttle: 1, steer: 0 }, 1 / 60);
for (let i = 0; i < 30; i++) lineB = stepVehicle(lineB, { throttle: 1, steer: 0 }, 1 / 30);
assert.ok(Math.abs(lineA.z - lineB.z) < 1e-6, `straight-line position is exact (${lineA.z} vs ${lineB.z})`);

// ================= 17. Vehicle: dt <= 0 is a no-op =================
const held = { speed: 5, heading: 1, x: 2, z: 3 };
assert.deepStrictEqual(stepVehicle(held, { throttle: 1, steer: 1 }, 0), held, 'zero dt does not mutate state');
assert.deepStrictEqual(stepVehicle(held, { throttle: 1, steer: 1 }, -1), held, 'negative dt does not mutate state');

// ================= 18. Vehicle: input is clamped, world bounded =================
let huge = stepVehicle(createVehicleState(), { throttle: 5, steer: -5 }, DT);
assert.ok(huge.speed >= 0 && huge.speed <= CFG.maxForwardSpeed, 'throttle clamped');
// heading PI/2 drives the vehicle further out along +X, so it genuinely
// crosses the boundary (sitting exactly on the limit would not).
let atEdge = { speed: 10, heading: Math.PI / 2, x: CFG.worldLimit, z: 0 };
atEdge = stepVehicle(atEdge, { throttle: 1, steer: 0 }, DT);
assert.ok(Math.abs(atEdge.x) <= CFG.worldLimit, `x clamped to worldLimit (${atEdge.x})`);
assert.strictEqual(atEdge.speed, 0, 'hitting the boundary stops the vehicle');
let offEdge = { speed: 10, heading: 0, x: -CFG.worldLimit - 50, z: CFG.worldLimit + 50 };
offEdge = stepVehicle(offEdge, { throttle: 1, steer: 0 }, DT);
assert.ok(Math.abs(offEdge.x) <= CFG.worldLimit && Math.abs(offEdge.z) <= CFG.worldLimit, 'overshoot is clamped back inside');

// ================= 19. stepVehicle never mutates its input =================
const original = { speed: 3, heading: 0.5, x: 1, z: 2 };
const snapshot = { ...original };
stepVehicle(original, { throttle: 1, steer: -1 }, DT);
assert.deepStrictEqual(original, snapshot, 'input state is not mutated');

console.log('PASS movement/input/camera tests: 19/19 groups');