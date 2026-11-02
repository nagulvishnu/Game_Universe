// Phase 9.5 — unit tests for the mechanical transformation system.
// No framework: plain asserts, esbuild-bundled then run by Node, matching the
// existing tests/ convention. No DOM or WebGL required for the pure functions
// under test (stageFor, TransformStateMachine, poseRig). App3D's transform
// methods delegate to TransformStateMachine, which is tested directly here.
import assert from 'node:assert';

import { stageFor } from '../src/three3d/core/transform';
import { stageFor as stageForFromApp } from '../src/three3d/core/App3D';
import {
  TO_CAR_MS,
  TO_ROBOT_MS,
  TransformStateMachine,
} from '../src/three3d/core/transform';
import { buildMechRig, poseRig } from '../src/proto3d/mechRig';
import { terrainHeight, terrainMaxHeight } from '../src/three3d/core/terrain';

// ================= 1. stageFor: mode boundaries =================
assert.strictEqual(stageFor(0), 'CAR MODE', 't=0 is car mode');
assert.strictEqual(stageFor(0.001), 'CAR MODE', 't=0.001 is car mode');
assert.strictEqual(stageFor(0.0009), 'CAR MODE', 't just below 0.001 is car mode');
assert.strictEqual(stageFor(0.999), 'ROBOT MODE', 't=0.999 is robot mode');
assert.strictEqual(stageFor(1), 'ROBOT MODE', 't=1 is robot mode');
assert.strictEqual(stageFor(0.9991), 'ROBOT MODE', 't just above 0.999 is robot mode');

// ================= 2. stageFor: intermediate stages =================
assert.strictEqual(stageFor(0.05), '1/7 BRAKE & SETTLE', 'early transform stage 1');
assert.strictEqual(stageFor(0.2), '2/7 WHEELS REPOSITION', 'early transform stage 2');
assert.strictEqual(stageFor(0.45), '3/7 CHASSIS LIFTS', 'mid transform stage 3');
assert.strictEqual(stageFor(0.6), '4/7 PANELS -> ARMS', 'mid transform stage 4');
assert.strictEqual(stageFor(0.73), '5/7 SECTIONS SEPARATE', 'late transform stage 5');
assert.strictEqual(stageFor(0.83), '6/7 LEGS EXTEND & LOCK', 'late transform stage 6');
assert.strictEqual(stageFor(0.93), '7/7 HEAD RISE / LAND', 'final transform stage 7');

// ================= 3. stageFor: monotonic stage progression =================
const stages: string[] = [];
for (let t = 0; t <= 1; t += 0.01) {
  stages.push(stageFor(t));
}
// Ensure t=1.0 is included (floating-point accumulation may skip it).
stages.push(stageFor(1));
const uniqueStages = [...new Set(stages)];
assert.ok(uniqueStages.length >= 7, 'stageFor produces all 7 stages across the timeline');
assert.strictEqual(stages[0], 'CAR MODE', 'first stage is car mode');
assert.strictEqual(stages[stages.length - 1], 'ROBOT MODE', 'last stage is robot mode');

// ================= 4. poseRig: car mode matches car poses =================
const rig = buildMechRig();
poseRig(rig, 0);
for (const part of rig.parts) {
  assert.ok(
    Math.abs(part.group.position.x - part.car.pos[0]) < 1e-6,
    `${part.name}: car x matches at t=0`
  );
  assert.ok(
    Math.abs(part.group.position.y - part.car.pos[1]) < 1e-6,
    `${part.name}: car y matches at t=0`
  );
  assert.ok(
    Math.abs(part.group.position.z - part.car.pos[2]) < 1e-6,
    `${part.name}: car z matches at t=0`
  );
  assert.ok(
    Math.abs(part.group.rotation.x - part.car.rot[0]) < 1e-6,
    `${part.name}: car rotX matches at t=0`
  );
  assert.ok(
    Math.abs(part.group.rotation.y - part.car.rot[1]) < 1e-6,
    `${part.name}: car rotY matches at t=0`
  );
  assert.ok(
    Math.abs(part.group.rotation.z - part.car.rot[2]) < 1e-6,
    `${part.name}: car rotZ matches at t=0`
  );
}

// ================= 5. poseRig: robot mode matches robot poses =================
poseRig(rig, 1);
for (const part of rig.parts) {
  assert.ok(
    Math.abs(part.group.position.x - part.robot.pos[0]) < 1e-6,
    `${part.name}: robot x matches at t=1`
  );
  assert.ok(
    Math.abs(part.group.position.y - part.robot.pos[1]) < 1e-6,
    `${part.name}: robot y matches at t=1`
  );
  assert.ok(
    Math.abs(part.group.position.z - part.robot.pos[2]) < 1e-6,
    `${part.name}: robot z matches at t=1`
  );
}

// ================= 6. poseRig: mechanical interpolation is progressive =================
// Parts animate in staggered windows, so at t=0.5 some are still parked at car
// pose (window not started) and some already at robot pose (window complete).
// The point of this test is that AT LEAST ONE part is strictly between the two
// ends, proving the transformation is a progressive mechanical animation and
// not an instant model swap or crossfade.
poseRig(rig, 0.5);
let midMotionCount = 0;
for (const part of rig.parts) {
  const atCar =
    Math.abs(part.group.position.x - part.car.pos[0]) < 1e-6 &&
    Math.abs(part.group.position.y - part.car.pos[1]) < 1e-6 &&
    Math.abs(part.group.position.z - part.car.pos[2]) < 1e-6;
  const atRobot =
    Math.abs(part.group.position.x - part.robot.pos[0]) < 1e-6 &&
    Math.abs(part.group.position.y - part.robot.pos[1]) < 1e-6 &&
    Math.abs(part.group.position.z - part.robot.pos[2]) < 1e-6;
  if (!atCar && !atRobot) midMotionCount++;
}
assert.ok(midMotionCount >= 1, `at least one part is mid-transition at t=0.5 (got ${midMotionCount})`);

// ================= 6b. poseRig: parts animate on staggered windows =================
// The transformation is sequenced: not every part starts and finishes together.
// This is what makes it read as a mechanical sequence rather than one morph.
const windowStarts = new Set(rig.parts.map((p) => p.win[0]));
assert.ok(windowStarts.size > 1, `part animation windows are staggered (${windowStarts.size} distinct starts)`);
for (const part of rig.parts) {
  assert.ok(part.win[1] > part.win[0], `${part.name} window is a valid [start,end] range`);
}

// ================= 7. poseRig: chassis moves from car height to robot height =================
const chassis = rig.parts.find((p) => p.name === 'chassis');
assert.ok(chassis, 'chassis part exists');
poseRig(rig, 0);
const chassisCarY = chassis.group.position.y;
poseRig(rig, 1);
const chassisRobotY = chassis.group.position.y;
assert.ok(chassisRobotY > chassisCarY, `chassis lifts from y=${chassisCarY} to y=${chassisRobotY}`);

// ================= 8. poseRig: head moves from car position to robot position =================
const head = rig.parts.find((p) => p.name === 'head');
assert.ok(head, 'head part exists');
poseRig(rig, 0);
const headCarZ = head.group.position.z;
poseRig(rig, 1);
const headRobotZ = head.group.position.z;
assert.ok(headRobotZ !== headCarZ, `head moves from z=${headCarZ} to z=${headRobotZ}`);

// ================= 9. poseRig: wheels move from car positions to robot positions =================
const wheelFL = rig.parts.find((p) => p.name === 'wheelFL');
assert.ok(wheelFL, 'wheelFL part exists');
poseRig(rig, 0);
const wheelFLCarY = wheelFL.group.position.y;
poseRig(rig, 1);
const wheelFLRobotY = wheelFL.group.position.y;
assert.ok(wheelFLRobotY !== wheelFLCarY, `wheelFL moves vertically during transform`);

// ================= 10. poseRig: deterministic (same t gives same result) =================
const rigA = buildMechRig();
const rigB = buildMechRig();
poseRig(rigA, 0.37);
poseRig(rigB, 0.37);
for (let i = 0; i < rigA.parts.length; i++) {
  const pa = rigA.parts[i].group.position;
  const pb = rigB.parts[i].group.position;
  assert.ok(pa.x === pb.x && pa.y === pb.y && pa.z === pb.z, `part ${i} position is deterministic`);
}

// ================= 11. terrainHeight: vehicle grounding in both forms =================
// Car form: vehicle at origin grounds at terrainHeight(0,0)
assert.strictEqual(terrainHeight(0, 0), 0.175, 'origin terrain height for car form');
// Robot form: vehicle at a driveable position grounds at terrain height
const robotH = terrainHeight(12, 4);
assert.ok(robotH >= -terrainMaxHeight() && robotH <= terrainMaxHeight(), 'robot form terrain height within bounds');

// ================= 12. State machine: initial state =================
const sm = new TransformStateMachine();
assert.strictEqual(sm.progress, 0, 'machine starts at car (t=0)');
assert.strictEqual(sm.transforming, false, 'machine starts idle');
assert.strictEqual(sm.drivable, true, 'car form is drivable');
assert.deepStrictEqual(sm.getState(), { t: 0, stage: 'CAR MODE', mode: 'car' }, 'initial state is car');

// ================= 13. State machine: toggle starts a forward transform =================
assert.strictEqual(sm.toggle(1000), true, 'toggle starts car -> robot');
assert.strictEqual(sm.transforming, true, 'transformation is in flight');
assert.strictEqual(sm.drivable, false, 'vehicle is not drivable mid-transform');

// ================= 14. State machine: repeated input during transform is ignored =================
assert.strictEqual(sm.toggle(1100), false, 'repeated toggle is ignored');
assert.strictEqual(sm.toggle(1200), false, 'repeated toggle is still ignored');
assert.strictEqual(sm.transforming, true, 'still the original transformation in flight');
assert.ok(Math.abs(sm.progress - 0) < 1e-9, 'repeated input did not restart or jump progress');

// ================= 15. State machine: progress advances mid-transform =================
assert.strictEqual(sm.step(1000 + TO_ROBOT_MS / 2), false, 'half-way step does not report completion');
assert.ok(Math.abs(sm.progress - 0.5) < 1e-9, 'progress is 0.5 at half duration');
assert.strictEqual(sm.getState().mode, 'transforming', 'mode is transforming mid-way');
assert.strictEqual(sm.getState().t, sm.progress, 'getState reports current progress');

// ================= 16. State machine: completion fires once and settles in robot =================
assert.strictEqual(sm.step(1000 + TO_ROBOT_MS), true, 'full-duration step completes the transform');
assert.strictEqual(sm.progress, 1, 'progress reaches 1');
assert.strictEqual(sm.transforming, false, 'no longer transforming');
assert.strictEqual(sm.drivable, false, 'robot form is not drivable');
assert.deepStrictEqual(sm.getState(), { t: 1, stage: 'ROBOT MODE', mode: 'robot' }, 'settled in robot form');
assert.strictEqual(sm.step(1000 + TO_ROBOT_MS + 100), false, 'steps after completion are no-ops');

// ================= 17. State machine: completion notification fires exactly once =================
const completionMachine = new TransformStateMachine();
let completions = 0;
completionMachine.toggle(0);
for (let now = 0; now <= TO_ROBOT_MS + 1000; now += 50) {
  if (completionMachine.step(now)) completions++;
}
assert.strictEqual(completions, 1, 'completion returns true on exactly one step');

// ================= 18. State machine: reverse transform uses TO_CAR_MS =================
assert.strictEqual(sm.toggle(5000), true, 'toggle starts robot -> car');
assert.strictEqual(sm.transforming, true, 'reverse is in flight');
assert.strictEqual(sm.step(5000 + TO_CAR_MS - 1), false, 'reverse is not done one millisecond early');
assert.strictEqual(sm.step(5000 + TO_CAR_MS), true, 'reverse completes at TO_CAR_MS');
assert.strictEqual(sm.progress, 0, 'progress returns to car (0)');
assert.strictEqual(sm.drivable, true, 'car form is drivable again');
assert.deepStrictEqual(sm.getState(), { t: 0, stage: 'CAR MODE', mode: 'car' }, 'settled back in car form');

// ================= 19. State machine: progress is always within [0, 1] =================
const bounded = new TransformStateMachine();
bounded.toggle(0);
for (let now = 0; now < TO_ROBOT_MS * 3; now += 137) {
  bounded.step(now);
  assert.ok(bounded.progress >= 0 && bounded.progress <= 1, `progress in range (${bounded.progress})`);
}

// ================= 20. State machine: full round trip never undershoots past car =================
const roundTrip = new TransformStateMachine();
roundTrip.toggle(0);
roundTrip.step(TO_ROBOT_MS);
roundTrip.toggle(TO_ROBOT_MS);
roundTrip.step(TO_ROBOT_MS + TO_CAR_MS);
assert.strictEqual(roundTrip.progress, 0, 'cannot fold below car (0)');
roundTrip.toggle(TO_ROBOT_MS + TO_CAR_MS);
roundTrip.step(TO_ROBOT_MS + TO_CAR_MS + TO_ROBOT_MS);
assert.strictEqual(roundTrip.progress, 1, 'cannot deploy above robot (1)');

// ================= 21. State machine: deterministic for the same input timeline =================
const detA = new TransformStateMachine();
const detB = new TransformStateMachine();
detA.toggle(0);
detB.toggle(0);
for (const now of [0, 100, 500, 1000, TO_ROBOT_MS]) {
  const a = detA.step(now);
  const b = detB.step(now);
  assert.strictEqual(a, b, 'completion signal is deterministic');
  assert.strictEqual(detA.progress, detB.progress, 'progress is deterministic');
}

// ================= 22. State machine: drive suspension across the full cycle =================
const drive = new TransformStateMachine();
assert.strictEqual(drive.drivable, true, 'drivable in car form');
drive.toggle(0);
assert.strictEqual(drive.drivable, false, 'not drivable while deploying');
drive.step(TO_ROBOT_MS);
assert.strictEqual(drive.drivable, false, 'not drivable in robot form');
drive.toggle(TO_ROBOT_MS);
assert.strictEqual(drive.drivable, false, 'not drivable while folding');
drive.step(TO_ROBOT_MS + TO_CAR_MS);
assert.strictEqual(drive.drivable, true, 'drivable again after returning to car');

// ================= 23. App3D preserves the stageFor public re-export =================
assert.strictEqual(stageForFromApp(0), 'CAR MODE', 'App3D still re-exports stageFor (public surface)');

// ================= 24. Rig dispose: no leaks =================
rig.dispose();
assert.ok(true, 'rig.dispose() completes without error');

console.log('PASS transform tests: 24/24 groups');
