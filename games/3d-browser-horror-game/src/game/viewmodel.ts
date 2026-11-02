import * as THREE from 'three';

export interface VmState {
  yaw: number;
  pitch: number;
  bob: number;
  speed: number;
  sprinting: boolean;
  crouch: boolean;
  hidden: boolean;
  flashOn: boolean;
  fear: number;
  trapped: boolean;
  shake: number;
  throwing: boolean;
  time: number;
}

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const wrapPI = (a: number) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};

/**
 * First-person right hand holding a flashlight, rendered in its own tiny scene
 * with a second render pass (depth cleared) so it never clips into walls.
 * Everything is authored in camera space: +x right, +y up, +z behind the eye.
 */
export class Viewmodel {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;

  private rig = new THREE.Group();
  private base = new THREE.Vector3(0.23, -0.27, -0.46);
  private restRot = new THREE.Vector3(0.05, 0.32, -0.06);
  private swayX = 0;
  private swayY = 0;
  private lastYaw = 0;
  private lastPitch = 0;
  private seeded = false;
  private throwT = -1;
  private hideAmt = 0;
  private lensMat: THREE.MeshStandardMaterial;
  private torchLight: THREE.PointLight;
  private materials: THREE.Material[] = [];
  private geometries: THREE.BufferGeometry[] = [];

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(72, aspect, 0.01, 12);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    // fixed rig lighting: the world's flashlight does not exist in this scene
    this.scene.add(new THREE.AmbientLight(0x9db2dd, 1.7));
    const key = new THREE.DirectionalLight(0xfff0d8, 3.0);
    key.position.set(0.4, 0.8, 0.6);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x5f74ad, 1.4);
    rim.position.set(-0.7, -0.2, -0.3);
    this.scene.add(rim);

    const skin = this.mat({ color: 0xc08d66, roughness: 0.82 });
    const sleeve = this.mat({ color: 0x32363f, roughness: 0.95 });
    const metal = this.mat({ color: 0x17191d, roughness: 0.45, metalness: 0.7 });
    const rubber = this.mat({ color: 0x26282d, roughness: 0.9 });
    this.lensMat = this.mat({ color: 0xfff3cf, emissive: 0xffe6a0, emissiveIntensity: 2.6, roughness: 0.3 });

    // ---- flashlight, axis along -z
    const torch = new THREE.Group();
    torch.add(this.mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.24, 16), metal, [0, 0, 0], [Math.PI / 2, 0, 0]));
    torch.add(this.mesh(new THREE.CylinderGeometry(0.046, 0.03, 0.06, 16), metal, [0, 0, -0.14], [Math.PI / 2, 0, 0]));
    torch.add(this.mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.05, 16), rubber, [0, 0, 0.135], [Math.PI / 2, 0, 0]));
    const lens = this.mesh(new THREE.CircleGeometry(0.04, 18), this.lensMat, [0, 0, -0.169], [0, Math.PI, 0]);
    torch.add(lens);
    // grip rings so the tube does not read as a plain cylinder
    for (const z of [-0.06, 0.0, 0.06]) {
      torch.add(this.mesh(new THREE.TorusGeometry(0.029, 0.005, 6, 16), metal, [0, 0, z], [0, 0, 0]));
    }
    this.rig.add(torch);

    this.torchLight = new THREE.PointLight(0xffe9b0, 0.55, 1.4, 2);
    this.torchLight.position.set(0, 0, -0.2);
    this.rig.add(this.torchLight);

    // ---- hand gripping the torch from the lower right of the tube
    const hand = new THREE.Group();
    hand.add(this.mesh(new THREE.BoxGeometry(0.072, 0.085, 0.09), skin, [0.018, -0.01, 0.045]));
    // fingers folded over the top of the tube
    hand.add(this.mesh(new THREE.BoxGeometry(0.06, 0.03, 0.084), skin, [-0.002, 0.026, 0.045]));
    // thumb wrapping the near side
    hand.add(this.mesh(new THREE.BoxGeometry(0.02, 0.036, 0.06), skin, [0.042, 0.016, 0.02], [0, -0.3, 0.3]));
    this.rig.add(hand);

    // ---- forearm running off the bottom-right of the frame
    const wrist = new THREE.Vector3(0.035, -0.05, 0.1);
    const shoulder = new THREE.Vector3(0.15, -0.37, 0.3);
    const dir = shoulder.clone().sub(wrist);
    const len = dir.length();
    dir.normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const mid = wrist.clone().addScaledVector(dir, len * 0.45);
    const arm = this.mesh(new THREE.CapsuleGeometry(0.044, Math.max(0.05, len - 0.1), 4, 10), skin);
    arm.position.copy(mid);
    arm.quaternion.copy(quat);
    this.rig.add(arm);
    const cuff = this.mesh(new THREE.CylinderGeometry(0.06, 0.056, 0.13, 12), sleeve);
    cuff.position.copy(wrist.clone().addScaledVector(dir, len * 0.78));
    cuff.quaternion.copy(quat);
    this.rig.add(cuff);

    this.camera.add(this.rig);
    this.rig.position.copy(this.base);
    this.rig.rotation.set(this.restRot.x, this.restRot.y, this.restRot.z);
  }

  private mat(p: THREE.MeshStandardMaterialParameters) {
    const m = new THREE.MeshStandardMaterial(p);
    this.materials.push(m);
    return m;
  }

  private mesh(geo: THREE.BufferGeometry, material: THREE.Material, pos?: [number, number, number], rot?: [number, number, number]) {
    this.geometries.push(geo);
    const m = new THREE.Mesh(geo, material);
    if (pos) m.position.set(pos[0], pos[1], pos[2]);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    return m;
  }

  update(dt: number, s: VmState) {
    if (!this.seeded) {
      this.seeded = true;
      this.lastYaw = s.yaw;
      this.lastPitch = s.pitch;
    }
    // look sway: hands lag behind the turn, then settle back to centre
    const dy = wrapPI(s.yaw - this.lastYaw);
    const dp = s.pitch - this.lastPitch;
    this.lastYaw = s.yaw;
    this.lastPitch = s.pitch;
    const decay = Math.exp(-dt * 7);
    this.swayY = clamp(this.swayY * decay - dy, -0.3, 0.3);
    this.swayX = clamp(this.swayX * decay - dp, -0.25, 0.25);

    if (s.throwing && this.throwT < 0) this.throwT = 0;
    if (this.throwT >= 0) {
      this.throwT += dt * 3.4;
      if (this.throwT > 1) this.throwT = -1;
    }
    const swing = this.throwT >= 0 ? Math.sin(this.throwT * Math.PI) : 0;
    this.hideAmt += ((s.hidden ? 1 : 0) - this.hideAmt) * Math.min(1, dt * 9);

    const speedK = clamp(s.speed / 2.75, 0, 1.5);
    const stride = s.crouch ? 0.7 : 1;
    const breathe = Math.sin(s.time * 1.5) * 0.0035;
    const tremble = s.fear > 0.35 ? Math.sin(s.time * 23) * 0.004 * s.fear : 0;
    const jitter = s.shake > 0.05 ? (Math.random() - 0.5) * 0.02 * s.shake : 0;

    this.rig.position.set(
      this.base.x + Math.cos(s.bob * 0.5) * 0.006 * speedK * stride + tremble + jitter,
      this.base.y + Math.sin(s.bob) * 0.012 * speedK + breathe - this.hideAmt * 0.5 + swing * 0.05,
      this.base.z + swing * 0.09,
    );
    this.rig.rotation.set(
      this.restRot.x + this.swayX + swing * 0.8 + (s.trapped ? Math.sin(s.time * 30) * 0.03 : 0),
      this.restRot.y + this.swayY,
      this.restRot.z - this.swayX * 0.4,
    );

    const on = s.flashOn ? 1 : 0;
    const flicker = s.flashOn && s.fear > 0.45 ? 0.75 + Math.random() * 0.25 : 1;
    this.lensMat.emissiveIntensity = on * 2.6 * flicker;
    this.torchLight.intensity = on * 0.55 * flicker;
  }

  dispose() {
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    this.geometries = [];
    this.materials = [];
  }
}
