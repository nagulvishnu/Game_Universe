import * as THREE from "three";
import { Scene3D } from "./host";
import { CarDef, Custom } from "./data";
import { buildCar, CarModel } from "./carBuilder";
import { ParticlePool } from "./vfx";
import { disposeObject, glowTexture, rng } from "./util";

interface Slot {
  key: string;
  car: CarModel | null;
  pivot: THREE.Group;
  ring: THREE.Mesh;
  glow: THREE.Mesh;
  spot: THREE.SpotLight;
}

export class Showroom implements Scene3D {
  scene = new THREE.Scene();
  cams: THREE.PerspectiveCamera[] = [new THREE.PerspectiveCamera(36, 1, 0.1, 400), new THREE.PerspectiveCamera(36, 1, 0.1, 400)];
  slots: Slot[] = [];
  layout: "single" | "dual" = "single";
  t = 0;
  spin = [0.6, 2.4];
  userYaw = [0, 0];
  auto = true;
  shift = 0;
  confetti: ParticlePool;
  celebrate = false;
  accents = ["#17e0ff", "#ff2fd0"];
  camDist = 8.2;
  camH = 2.1;
  zoom = 1;
  dead = false;
  bg: THREE.InstancedMesh;
  bgTick = 0;
  lights: THREE.PointLight[] = [];

  constructor() {
    const s = this.scene;
    s.background = new THREE.Color("#04050c");
    s.fog = new THREE.FogExp2(0x070818, 0.018);
    // environment: studio softboxes
    const es = new THREE.Scene();
    es.add(new THREE.Mesh(new THREE.SphereGeometry(50, 16, 12), new THREE.MeshBasicMaterial({ color: 0x0a0d1c, side: THREE.BackSide })));
    const box = (w: number, h: number, c: string, x: number, y: number, z: number, i = 3) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(i), side: THREE.DoubleSide }));
      m.position.set(x, y, z);
      m.lookAt(0, 0, 0);
      es.add(m);
    };
    box(30, 10, "#ffffff", 0, 30, 0, 2.2);
    box(8, 26, "#17e0ff", -30, 8, 8, 2.6);
    box(8, 26, "#ff2fd0", 30, 8, -8, 2.6);
    box(26, 6, "#ffffff", 0, 6, 34, 1.6);
    box(20, 5, "#7a2bff", 0, 3, -34, 2);
    this.envScene = es;
    // floor
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x0b0d18, metalness: 0.85, roughness: 0.22 });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(120, 48).rotateX(-Math.PI / 2), floorMat);
    floor.position.y = -0.01;
    s.add(floor);
    // grid
    const grid = new THREE.GridHelper(240, 80, 0x17e0ff, 0x1a2250);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.25;
    grid.position.y = 0.01;
    s.add(grid);
    // lights
    s.add(new THREE.HemisphereLight(0x8aa0ff, 0x1a0f30, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(6, 12, 8);
    s.add(key);
    const rim1 = new THREE.PointLight(0x17e0ff, 120, 40, 1.6);
    rim1.position.set(-8, 3, -6);
    const rim2 = new THREE.PointLight(0xff2fd0, 120, 40, 1.6);
    rim2.position.set(8, 3, -6);
    s.add(rim1, rim2);
    this.lights = [rim1, rim2];
    // skyline backdrop
    const R = rng(7);
    const bg = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), 160);
    const d = new THREE.Object3D();
    const c = new THREE.Color();
    for (let i = 0; i < 160; i++) {
      const a = (i / 160) * Math.PI * 2;
      const r = 70 + R() * 40;
      const h = 8 + R() * R() * 70;
      d.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
      d.scale.set(4 + R() * 8, h, 4 + R() * 8);
      d.updateMatrix();
      bg.setMatrixAt(i, d.matrix);
      c.setHSL(R() < 0.5 ? 0.52 : 0.85, 0.9, 0.08 + R() * 0.12);
      bg.setColorAt(i, c);
    }
    s.add(bg);
    this.bg = bg;
    // slots
    for (let i = 0; i < 2; i++) {
      const pivot = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.07, 8, 64).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(this.accents[i]).multiplyScalar(2.5), toneMapped: false }));
      ring.position.y = 0.04;
      const glow = new THREE.Mesh(new THREE.CircleGeometry(4.2, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTexture(), color: new THREE.Color(this.accents[i]), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55 }));
      glow.position.y = 0.03;
      const spot = new THREE.SpotLight(0xffffff, 400, 40, 0.5, 0.6, 1.4);
      spot.position.set(0, 12, 2);
      s.add(spot, spot.target);
      s.add(ring, glow, pivot);
      this.slots.push({ key: "", car: null, pivot, ring, glow, spot });
    }
    this.confetti = new ParticlePool(900, false);
    s.add(this.confetti.points);
    this.setSlotPos();
  }
  envScene: THREE.Scene;
  envDone = false;

  setLayout(l: "single" | "dual") {
    this.layout = l;
    this.setSlotPos();
  }
  setSlotPos() {
    const dual = this.layout === "dual";
    this.slots.forEach((s, i) => {
      const x = dual ? (i === 0 ? -14 : 14) : i === 0 ? 0 : 400;
      s.pivot.position.set(x, 0, 0);
      s.ring.position.x = x;
      s.glow.position.x = x;
      s.spot.position.set(x, 12, 3);
      s.spot.target.position.set(x, 0, 0);
      s.pivot.visible = s.ring.visible = s.glow.visible = dual || i === 0;
      s.spot.visible = dual || i === 0;
    });
  }
  setAccents(a: string, b: string) {
    this.accents = [a, b];
    this.slots.forEach((s, i) => {
      (s.ring.material as THREE.MeshBasicMaterial).color.set(this.accents[i]).multiplyScalar(2.5);
      (s.glow.material as THREE.MeshBasicMaterial).color.set(this.accents[i]);
    });
    this.lights[0].color.set(a);
    this.lights[1].color.set(b);
  }
  setCar(i: number, def: CarDef, cfg: Custom) {
    const s = this.slots[i];
    const key = def.id + JSON.stringify(cfg);
    if (s.key === key) return;
    s.key = key;
    if (s.car) {
      s.pivot.remove(s.car.group);
      disposeObject(s.car.group);
    }
    const m = buildCar(def, cfg);
    m.group.traverse((o: any) => { if (o.isMesh) o.castShadow = false; });
    m.flames.forEach((f) => (f.visible = false));
    m.beams.visible = false;
    s.car = m;
    s.pivot.add(m.group);
  }
  update(dt: number) {
    this.t += dt;
    if (!this.envDone) return;
    this.slots.forEach((s, i) => {
      if (!s.car) return;
      if (this.auto) s.pivot.rotation.y += dt * this.spin[0] * (this.celebrate ? 1.4 : 0.55);
      else s.pivot.rotation.y = this.userYaw[i];
      s.car.wheels.forEach((w) => (w.spin.rotation.x += dt * 2));
      const k = 1 + Math.sin(this.t * 2 + i) * 0.04;
      s.ring.scale.setScalar(k);
    });
    this.bgTick += dt;
    if (this.celebrate) {
      for (let k = 0; k < 6; k++) {
        const c = new THREE.Color().setHSL(Math.random(), 0.9, 0.6);
        this.confetti.emit((Math.random() - 0.5) * 22, 14 + Math.random() * 4, (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 3, -2 - Math.random() * 3, (Math.random() - 0.5) * 3, 5, 0.35, 0.3, c.r, c.g, c.b, 1, 0.5, 0.3);
      }
    }
    this.confetti.update(dt);
  }
  render(r: THREE.WebGLRenderer, W: number, H: number) {
    if (!this.envDone) {
      const pm = new THREE.PMREMGenerator(r);
      const rt = pm.fromScene(this.envScene, 0.03, 1, 200);
      this.scene.environment = rt.texture;
      (this.scene as any).environmentIntensity = 1.1;
      pm.dispose();
      this.envDone = true;
    }
    r.setScissorTest(true);
    const dual = this.layout === "dual";
    const views = dual ? 2 : 1;
    for (let i = 0; i < views; i++) {
      const w = dual ? Math.floor(W / 2) : W;
      const x = dual ? i * (W - w) : 0;
      const cam = this.cams[i];
      cam.aspect = w / H;
      cam.fov = dual ? 40 : 34;
      cam.updateProjectionMatrix();
      const px = this.slots[i].pivot.position.x;
      const a = dual ? 0.5 : 0.62 + Math.sin(this.t * 0.2) * 0.12;
      const d = this.camDist * (dual && w / H < 0.9 ? 1.5 : 1) / this.zoom;
      cam.position.set(px + Math.sin(a) * d, this.camH + (dual ? 0.3 : 0), Math.cos(a) * d);
      cam.lookAt(px, 0.75, 0);
      if (!dual && this.shift !== 0) cam.setViewOffset(W, H, -W * this.shift, 0, W, H);
      else cam.clearViewOffset();
      r.setViewport(x, 0, w, H);
      r.setScissor(x, 0, w, H);
      r.clearDepth();
      r.render(this.scene, cam);
    }
    r.setScissorTest(false);
  }
  dispose() {
    /* persistent scene: intentionally kept alive between screens */
  }
  destroy() {
    this.dead = true;
    disposeObject(this.scene);
    this.confetti.dispose();
  }
}
