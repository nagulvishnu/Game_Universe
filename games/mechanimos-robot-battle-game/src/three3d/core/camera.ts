// Phase 9.2 — third-person orbit/follow camera.
//
// Pure helpers (clampPitch / clampDistance / damp / orbitOffset / wrapAngle)
// contain all the maths and are unit tested in Node; ThirdPersonCamera owns the
// mutable smoothing state and writes to an existing THREE.PerspectiveCamera.
//
// Behaviour:
// - Orbits a target point from behind and above, spherical offset.
// - Mouse drag adjusts yaw/pitch; wheel adjusts distance. Both are clamped.
// - While the player drives forward and the user is NOT dragging, the yaw eases
//   back behind the vehicle heading, so the camera self-centres behind the car.
// - All smoothing is frame-rate independent via damp() (exponential approach),
//   so behaviour is identical at 30, 60 or 144 fps.
// - No listeners of its own: input arrives pushed in by the app, so there is
//   nothing to leak and nothing to unregister on disposal.

import * as THREE from 'three';

export interface CameraLimits {
  /** Radians. Low pitch = camera high above, high pitch = near ground level. */
  minPitch: number;
  maxPitch: number;
  minDistance: number;
  maxDistance: number;
  /** Camera is never allowed below this world Y (stays above the ground plane). */
  minHeight: number;
  /** Seconds of no user input after which auto-follow re-engages. */
  followDelay: number;
}

export const DEFAULT_CAMERA_LIMITS: CameraLimits = {
  minPitch: 0.12,
  maxPitch: 1.25,
  minDistance: 4.5,
  maxDistance: 16,
  minHeight: 0.9,
  followDelay: 1.5,
};

/** Radians per pixel of pointer drag. */
export const ORBIT_SENSITIVITY = 0.006;
/** World units of zoom per wheel delta unit. */
export const ZOOM_SENSITIVITY = 0.01;

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function clampPitch(pitch: number, limits: CameraLimits = DEFAULT_CAMERA_LIMITS): number {
  return clamp(pitch, limits.minPitch, limits.maxPitch);
}

export function clampDistance(distance: number, limits: CameraLimits = DEFAULT_CAMERA_LIMITS): number {
  return clamp(distance, limits.minDistance, limits.maxDistance);
}

/** Wrap an angle into (-PI, PI]. Keeps heading from drifting over long sessions. */
export function wrapAngle(angle: number): number {
  const twoPi = Math.PI * 2;
  let a = (angle + Math.PI) % twoPi;
  if (a <= 0) a += twoPi;
  return a - Math.PI;
}

/**
 * Frame-rate independent smoothing factor for the given "sharpness".
 * Equivalent to moving `fraction` of the remaining distance in one 60fps frame.
 */
export function dampFactor(lambda: number, dt: number): number {
  if (lambda <= 0) return 0;
  if (dt <= 0) return 0;
  return 1 - Math.exp(-lambda * dt);
}

export function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * dampFactor(lambda, dt);
}

/** Spherical offset from a target to the camera position. */
export function orbitOffset(yaw: number, pitch: number, distance: number): THREE.Vector3 {
  const cosPitch = Math.cos(pitch);
  return new THREE.Vector3(
    Math.sin(yaw) * cosPitch * distance,
    Math.sin(pitch) * distance,
    Math.cos(yaw) * cosPitch * distance,
  );
}

export interface CameraViewState {
  yaw: number;
  pitch: number;
  distance: number;
  position: { x: number; y: number; z: number };
  following: boolean;
}

export class ThirdPersonCamera {
  /** User-facing values (targets). */
  private yaw = Math.PI;
  private pitch = 0.42;
  private distance = 9;

  /** Smoothed values actually applied to the camera. */
  private smoothYaw = Math.PI;
  private smoothPitch = 0.42;
  private smoothDistance = 9;

  private readonly position = new THREE.Vector3(0, 5, 11);
  private readonly lookAt = new THREE.Vector3();
  private idleTime = 0;
  private snapped = false;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    readonly limits: CameraLimits = DEFAULT_CAMERA_LIMITS,
  ) {}

  /** Snap the smoothed state to the current orbit (used once at startup). */
  snap(yaw = Math.PI, pitch = 0.42, distance = 9): void {
    this.yaw = yaw;
    this.pitch = clampPitch(pitch, this.limits);
    this.distance = clampDistance(distance, this.limits);
    this.smoothYaw = this.yaw;
    this.smoothPitch = this.pitch;
    this.smoothDistance = this.distance;
    this.snapped = true;
    this.idleTime = 0;
  }

  /** Apply a frame's pointer drag (pixels) and wheel delta. */
  applyOrbit(dragX: number, dragY: number, wheelDelta: number): void {
    if (dragX !== 0 || dragY !== 0) {
      this.yaw = wrapAngle(this.yaw - dragX * ORBIT_SENSITIVITY);
      // Dragging down looks from lower down; clamp keeps it above the ground.
      this.pitch = clampPitch(this.pitch + dragY * ORBIT_SENSITIVITY, this.limits);
      this.idleTime = 0;
    }
    if (wheelDelta !== 0) {
      this.distance = clampDistance(
        this.distance + wheelDelta * ZOOM_SENSITIVITY,
        this.limits,
      );
    }
  }

  getState(): CameraViewState {
    return {
      yaw: this.smoothYaw,
      pitch: this.smoothPitch,
      distance: this.smoothDistance,
      position: { x: this.position.x, y: this.position.y, z: this.position.z },
      following: this.idleTime === 0,
    };
  }

  /**
   * @param target   world point to orbit (player position + focus height)
   * @param heading  player heading in radians, used for auto-follow
   * @param driving  true while the player is actively moving
   * @param dragging true while the user is dragging (suppresses auto-follow)
   */
  update(target: THREE.Vector3, heading: number, driving: boolean, dragging: boolean, dt: number): void {
    if (dragging) {
      this.idleTime = 0;
    } else {
      this.idleTime += dt;
    }

    const autoFollow = driving && !dragging && this.idleTime >= this.limits.followDelay;
    if (autoFollow) {
      // Sit behind the car: camera yaw is the reverse of the heading.
      this.yaw = wrapAngle(this.yaw + wrapAngle(heading + Math.PI - this.yaw) * dampFactor(2.2, dt));
    }

    // Frame-rate independent smoothing towards the orbit values.
    const lambda = 12;
    this.smoothYaw = wrapAngle(this.smoothYaw + wrapAngle(this.yaw - this.smoothYaw) * dampFactor(lambda, dt));
    this.smoothPitch = damp(this.smoothPitch, this.pitch, lambda, dt);
    this.smoothDistance = damp(this.smoothDistance, this.distance, lambda, dt);

    const offset = orbitOffset(this.smoothYaw, this.smoothPitch, this.smoothDistance);
    const desiredX = target.x + offset.x;
    const desiredY = Math.max(this.limits.minHeight, target.y + offset.y);
    const desiredZ = target.z + offset.z;

    if (!this.snapped) {
      this.position.set(desiredX, desiredY, desiredZ);
      this.snapped = true;
    } else {
      // Positional smoothing is what removes visible snapping when the target
      // jumps or the view is resized.
      const k = dampFactor(lambda, dt);
      this.position.x += (desiredX - this.position.x) * k;
      this.position.y += (desiredY - this.position.y) * k;
      this.position.z += (desiredZ - this.position.z) * k;
    }

    this.lookAt.copy(target);
    this.camera.position.copy(this.position);
    this.camera.lookAt(this.lookAt);
  }
}