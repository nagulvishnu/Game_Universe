// Phase 9.2 — car-form movement model (pure maths, no Three.js).
//
// Kept separate from the renderer so the driving feel can be unit tested in
// Node. The shell applies the resulting state to the existing rig root.
//
// Conventions match the existing prototype rig:
//   forward vector = (sin(heading), 0, cos(heading))
// so heading 0 faces +Z and the rig's local +Z stays the nose.
//
// Limits are intentionally generous: this is a prototype floor for an open-world
// game, not a small arena. Bounds are a prototype safety net only.

import { wrapAngle } from './camera';
import {
  DEFAULT_VEHICLE_RADIUS,
  substeppedMove,
  type Obstacle,
} from './collision';

export interface VehicleConfig {
  maxForwardSpeed: number;
  maxReverseSpeed: number;
  /** Forward acceleration, units/s^2. */
  accel: number;
  /** Extra braking deceleration when throttle opposes motion, units/s^2. */
  brakeDecel: number;
  reverseAccel: number;
  /** Exponential coast-down sharpness (higher = stops sooner). */
  coastLambda: number;
  /** Steering rate at full speed, radians/s. */
  steerRate: number;
  /** Speed at which steering reaches full authority, units/s. */
  steerEngageSpeed: number;
  /** Half-extent of the playable square, world units. */
  worldLimit: number;
  /** Vehicle footprint radius in world units. */
  vehicleRadius: number;
}

export const DEFAULT_VEHICLE_CONFIG: VehicleConfig = {
  maxForwardSpeed: 22,
  maxReverseSpeed: 9,
  accel: 11,
  brakeDecel: 20,
  reverseAccel: 7,
  coastLambda: 1.6,
  steerRate: 1.9,
  steerEngageSpeed: 3,
  worldLimit: 140,
  vehicleRadius: DEFAULT_VEHICLE_RADIUS,
};

export interface VehicleState {
  /** Signed speed along the heading. Positive = forward. */
  speed: number;
  heading: number;
  x: number;
  z: number;
}

export function createVehicleState(): VehicleState {
  return { speed: 0, heading: 0, x: 0, z: 0 };
}

export interface VehicleInput {
  /** +1 forward, -1 brake/reverse, 0 coast. */
  throttle: number;
  /** +1 right, -1 left, 0 none. */
  steer: number;
}

/** Exponential approach factor, frame-rate independent. */
function approachFactor(lambda: number, dt: number): number {
  if (lambda <= 0 || dt <= 0) return 0;
  return 1 - Math.exp(-lambda * dt);
}

/**
 * Advance the vehicle by dt seconds. Returns a NEW state; the input state is
 * never mutated, which keeps the function trivially testable and replayable.
 */
export function stepVehicle(
  state: VehicleState,
  input: VehicleInput,
  dt: number,
  config: VehicleConfig = DEFAULT_VEHICLE_CONFIG,
  obstacles: readonly Obstacle[] = [],
): VehicleState {
  if (dt <= 0) return { ...state };

  const throttle = Math.max(-1, Math.min(1, input.throttle));
  const steer = Math.max(-1, Math.min(1, input.steer));
  let speed = state.speed;

  if (throttle > 0) {
    if (speed < 0) {
      // Throttle forward while rolling backwards: brake first.
      speed = Math.min(0, speed + config.brakeDecel * throttle * dt);
    } else {
      speed = Math.min(config.maxForwardSpeed, speed + config.accel * throttle * dt);
    }
  } else if (throttle < 0) {
    if (speed > 0) {
      // Brake harder than reverse acceleration, like a real pedal.
      speed = Math.max(0, speed + config.brakeDecel * throttle * dt);
    } else {
      speed = Math.max(-config.maxReverseSpeed, speed + config.reverseAccel * throttle * dt);
    }
  } else {
    speed -= speed * approachFactor(config.coastLambda, dt);
    if (Math.abs(speed) < 1e-4) speed = 0;
  }

  // Steering authority ramps in with speed, so a stationary vehicle does not
  // spin on the spot, and reversing mirrors the steering like a real car.
  //
  // Authority uses the AVERAGE speed across the frame, not the end-of-frame
  // speed. Speed changes linearly within a frame, so the average of the two
  // endpoints is identical whether the frame is 1/30s or 1/144s long — that
  // makes heading integration frame-rate independent rather than ~1% off.
  const midSpeed = (state.speed + speed) * 0.5;
  const authority = Math.min(1, Math.abs(midSpeed) / config.steerEngageSpeed);
  const reverseSign = midSpeed < 0 ? -1 : 1;
  const headingDelta = steer * config.steerRate * authority * reverseSign * dt;
  const heading = wrapAngle(state.heading + headingDelta);

  // Position integrates along the MID-FRAME heading and speed (midpoint rule).
  const midHeading = state.heading + headingDelta * 0.5;
  const from = { x: state.x, z: state.z };
  const to = {
    x: state.x + Math.sin(midHeading) * midSpeed * dt,
    z: state.z + Math.cos(midHeading) * midSpeed * dt,
  };

  const bounds = { halfExtent: config.worldLimit };
  const { pos, blocked } = substeppedMove(from, to, obstacles, bounds, config.vehicleRadius);
  let x = pos.x;
  let z = pos.z;
  if (blocked) speed = 0;

  return { speed, heading, x, z };
}