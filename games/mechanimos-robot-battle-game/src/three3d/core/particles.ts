// Phase 9.6 — fixed-capacity GPU particle pool for transformation sparks and
// driving dust.
//
// Deliberate constraints:
// - ONE THREE.Points object, so all particles cost a single draw call.
// - Preallocated typed arrays; emit()/update() allocate nothing per frame.
// - Soft round sprites and per-particle size/colour come from a tiny inline
//   shader, so no texture asset is required.
// - Particles expire by life and simply fade out (additive colour -> 0), so the
//   pool never grows and the GPU never sees a dead draw.
// - dispose() releases the geometry and material exactly once.

import * as THREE from 'three';

const VERTEX_SHADER = `
attribute vec3 aColor;
attribute float aSize;
varying vec3 vColor;
void main() {
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (340.0 / max(0.001, -mv.z));
  gl_Position = projectionMatrix * mv;
}
`;

const FRAGMENT_SHADER = `
varying vec3 vColor;
void main() {
  vec2 d = gl_PointCoord - vec2(0.5);
  float a = smoothstep(0.5, 0.0, length(d));
  if (a <= 0.001) discard;
  gl_FragColor = vec4(vColor * a, a);
}
`;

export interface EmitOptions {
  count: number;
  origin: { x: number; y: number; z: number };
  /** Base speed of the outward burst. */
  speed?: number;
  /** Extra random horizontal scatter added to `speed`. */
  spread?: number;
  /** Upward bias added to the vertical velocity. */
  rise?: number;
  /** Particle lifetime in seconds. */
  life?: number;
  /** Downward acceleration in units/s^2 (0 = none). */
  gravity?: number;
  /** Linear RGB colour, 0..1. */
  color?: readonly [number, number, number];
  /** Point size in world-ish units (scaled by distance in the shader). */
  size?: number;
  /** Deterministic random source; defaults to Math.random. */
  rng?: () => number;
}

export class ParticlePool {
  readonly points: THREE.Points;

  private readonly capacity: number;
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  private readonly sizes: Float32Array;
  private readonly baseColors: Float32Array;
  private readonly velocities: Float32Array;
  private readonly life: Float32Array;
  private readonly maxLife: Float32Array;
  private readonly gravity: Float32Array;
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.ShaderMaterial;
  private cursor = 0;
  private alive = 0;
  private disposed = false;

  constructor(capacity = 320) {
    this.capacity = Math.max(16, Math.floor(capacity));
    const n = this.capacity;

    this.positions = new Float32Array(n * 3);
    this.colors = new Float32Array(n * 3);
    this.sizes = new Float32Array(n);
    this.baseColors = new Float32Array(n * 3);
    this.velocities = new Float32Array(n * 3);
    this.life = new Float32Array(n);
    this.maxLife = new Float32Array(n);
    this.gravity = new Float32Array(n);

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('aColor', new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.name = 'particlePool';
    // Start fully transparent.
    this.geometry.setDrawRange(0, n);
  }

  get aliveCount(): number {
    return this.alive;
  }

  emit(opts: EmitOptions): void {
    if (this.disposed) return;
    const {
      count,
      origin,
      speed = 3,
      spread = 2,
      rise = 1,
      life = 0.5,
      gravity = 8,
      color = [0.25, 0.95, 1],
      size = 0.16,
      rng = Math.random,
    } = opts;
    const n = count | 0;
    for (let k = 0; k < n; k++) {
      const i = this.cursor % this.capacity;
      this.cursor = (this.cursor + 1) % this.capacity;
      const i3 = i * 3;

      this.positions[i3] = origin.x;
      this.positions[i3 + 1] = origin.y;
      this.positions[i3 + 2] = origin.z;

      const theta = rng() * Math.PI * 2;
      const r = speed + rng() * spread;
      this.velocities[i3] = Math.cos(theta) * r;
      this.velocities[i3 + 1] = rise * (0.4 + rng());
      this.velocities[i3 + 2] = Math.sin(theta) * r;

      this.baseColors[i3] = color[0];
      this.baseColors[i3 + 1] = color[1];
      this.baseColors[i3 + 2] = color[2];
      this.colors[i3] = color[0];
      this.colors[i3 + 1] = color[1];
      this.colors[i3 + 2] = color[2];

      this.sizes[i] = size;
      this.life[i] = life;
      this.maxLife[i] = life;
      this.gravity[i] = gravity;
    }
    this.markDirty();
  }

  update(dt: number): void {
    if (this.disposed) return;
    const step = Math.min(Math.max(dt, 0), 0.1);
    let alive = 0;
    for (let i = 0; i < this.capacity; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= step;
      const i3 = i * 3;
      if (this.life[i] <= 0) {
        this.life[i] = 0;
        this.sizes[i] = 0;
        this.colors[i3] = 0;
        this.colors[i3 + 1] = 0;
        this.colors[i3 + 2] = 0;
        continue;
      }
      alive++;
      this.velocities[i3 + 1] -= this.gravity[i] * step;
      this.positions[i3] += this.velocities[i3] * step;
      this.positions[i3 + 1] += this.velocities[i3 + 1] * step;
      this.positions[i3 + 2] += this.velocities[i3 + 2] * step;
      const fade = this.life[i] / this.maxLife[i];
      this.colors[i3] = this.baseColors[i3] * fade;
      this.colors[i3 + 1] = this.baseColors[i3 + 1] * fade;
      this.colors[i3 + 2] = this.baseColors[i3 + 2] * fade;
      this.sizes[i] = this.sizes[i] * 0.985;
    }
    this.alive = alive;
    this.markDirty();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.geometry.dispose();
    this.material.dispose();
  }

  private markDirty(): void {
    (this.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.getAttribute('aColor') as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.getAttribute('aSize') as THREE.BufferAttribute).needsUpdate = true;
  }
}
