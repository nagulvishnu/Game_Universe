import * as THREE from 'three';
import { GfxSettings } from '../data/config';
import { ITEMS, RARITY_COLOR } from '../data/items';
import type { Game } from '../engine/Game';
import { Fighter, Vehicle } from '../engine/types';
import { Rig, animateRig, createRig, setRigGear, setRigWeapon } from './characterRig';
import { toon } from './materials';
import { clamp } from '../util';

class Particles {
  mesh: THREE.InstancedMesh;
  n = 0;
  p: { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; size: number; grow: number; g: number; r: number; gC: number; b: number }[] = [];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  constructor(scene: THREE.Scene, public max: number, geo: THREE.BufferGeometry, mat: THREE.Material) {
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.frustumCulled = false; this.mesh.count = 0;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.mesh);
    for (let i = 0; i < max; i++) this.p.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, size: 1, grow: 0, g: 0, r: 1, gC: 1, b: 1 });
    this.mesh.setColorAt(0, new THREE.Color(1, 1, 1));
  }
  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, color: THREE.ColorRepresentation, grow = 0, g = 0) {
    const p = this.p[this.n % this.max];
    this.n++;
    const c = new THREE.Color(color);
    Object.assign(p, { x, y, z, vx, vy, vz, life, max: life, size, grow, g, r: c.r, gC: c.g, b: c.b });
  }
  update(dt: number) {
    let k = 0;
    const cnt = Math.min(this.n, this.max);
    const col = new THREE.Color();
    for (let i = 0; i < cnt; i++) {
      const p = this.p[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) continue;
      p.vy -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const t = p.life / p.max;
      const s = p.size * (p.grow > 0 ? (1 + (1 - t) * p.grow) * Math.min(1, t * 3) : t);
      this.m.compose(new THREE.Vector3(p.x, p.y, p.z), this.q, new THREE.Vector3(s, s, s));
      this.mesh.setMatrixAt(k, this.m);
      this.mesh.setColorAt(k, col.setRGB(p.r, p.gC, p.b));
      k++;
    }
    this.mesh.count = k;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

function vehicleModel(type: Vehicle['type']) {
  const g = new THREE.Group();
  const wheels: THREE.Object3D[] = [];
  const add = (geom: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, p: THREE.Object3D = g) => { const me = new THREE.Mesh(geom, m); me.position.set(x, y, z); me.castShadow = true; p.add(me); return me; };
  const tire = toon('#1c1c22');
  const wheelGeo = (r: number, w: number) => new THREE.CylinderGeometry(r, r, w, 14).rotateZ(Math.PI / 2);
  const mkWheel = (x: number, y: number, z: number, r: number, w: number) => { const pv = new THREE.Group(); pv.position.set(x, y, z); g.add(pv); add(wheelGeo(r, w), tire, 0, 0, 0, pv); add(new THREE.BoxGeometry(w + 0.02, r * 0.6, 0.08), toon('#999'), 0, 0, 0, pv); wheels.push(pv); };
  if (type === 'jeep') {
    const c = toon('#5b7a3a');
    add(new THREE.BoxGeometry(1.9, 0.7, 4), c, 0, 0.85, 0); add(new THREE.BoxGeometry(1.7, 0.4, 1.3), c, 0, 1.3, 1.35);
    add(new THREE.BoxGeometry(1.8, 0.7, 0.1), toon('#9ad'), 0, 1.5, 0.7); add(new THREE.BoxGeometry(1.8, 0.06, 1.6), toon('#333'), 0, 2.2, -0.5);
    for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.08, 0.9, 0.08), toon('#222'), sx * 0.85, 1.7, 0.5), add(new THREE.BoxGeometry(0.08, 0.9, 0.08), toon('#222'), sx * 0.85, 1.7, -1.5);
    add(new THREE.BoxGeometry(1.7, 0.3, 0.9), toon('#444'), 0, 0.5, -2.1);
    for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.3, 0.2, 0.1), toon('#ffee99', { emissive: '#ffee99' }), sx * 0.65, 1.15, 2.02);
    for (const [x, z] of [[-1, 1.3], [1, 1.3], [-1, -1.3], [1, -1.3]]) mkWheel(x * 1.0, 0.5, z, 0.5, 0.4);
  } else if (type === 'sports') {
    const c = toon('#d62839');
    add(new THREE.BoxGeometry(1.9, 0.5, 4.3), c, 0, 0.6, 0); add(new THREE.BoxGeometry(1.6, 0.45, 1.9), toon('#222b38'), 0, 1.05, -0.2); add(new THREE.BoxGeometry(1.5, 0.12, 0.9), c, 0, 0.9, 1.5);
    add(new THREE.BoxGeometry(1.9, 0.08, 0.5), toon('#222'), 0, 1.05, -2.0); add(new THREE.BoxGeometry(0.08, 0.2, 0.08), toon('#222'), 0.6, 0.95, -2.0); add(new THREE.BoxGeometry(0.08, 0.2, 0.08), toon('#222'), -0.6, 0.95, -2.0);
    for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.35, 0.1, 0.1), toon('#bff', { emissive: '#8ff' }), sx * 0.65, 0.7, 2.16);
    add(new THREE.BoxGeometry(0.2, 0.02, 3.5), toon('#fff'), 0, 0.88, 0);
    for (const [x, z] of [[-1, 1.4], [1, 1.4], [-1, -1.4], [1, -1.4]]) mkWheel(x * 0.97, 0.38, z, 0.38, 0.32);
  } else {
    const c = toon('#2b6cb0');
    add(new THREE.BoxGeometry(0.3, 0.4, 1.3), c, 0, 0.75, 0.1); add(new THREE.BoxGeometry(0.34, 0.12, 0.7), toon('#222'), 0, 1.0, -0.4); add(new THREE.BoxGeometry(0.5, 0.4, 0.5), c, 0, 0.9, 0.7);
    add(new THREE.BoxGeometry(1.0, 0.05, 0.05), toon('#222'), 0, 1.25, 0.6); add(new THREE.BoxGeometry(0.2, 0.2, 0.1), toon('#ffee99', { emissive: '#ffee99' }), 0, 1.0, 0.98);
    mkWheel(0, 0.35, 0.9, 0.35, 0.14); mkWheel(0, 0.35, -0.8, 0.35, 0.14);
  }
  g.userData.wheels = wheels;
  return g;
}

function buildPlane() {
  const g = new THREE.Group();
  const olive = toon('#6b7a56'), dark = toon('#3b4332'), glass = toon('#9fd0ff', { emissive: '#4aa0ff', emissiveIntensity: 0.3 });
  const add = (geom: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => { const me = new THREE.Mesh(geom, m); me.position.set(x, y, z); me.castShadow = true; g.add(me); return me; };
  add(new THREE.CylinderGeometry(3.2, 3.0, 30, 14).rotateX(Math.PI / 2), olive, 0, 0, 0);
  add(new THREE.ConeGeometry(3.2, 7, 14).rotateX(Math.PI / 2), olive, 0, 0, 18.5);
  add(new THREE.ConeGeometry(3.0, 9, 14).rotateX(-Math.PI / 2), dark, 0, 0.9, -19.5).scale.set(1, 0.75, 1);
  add(new THREE.BoxGeometry(4.2, 1.1, 3), glass, 0, 1.6, 19.5);
  add(new THREE.BoxGeometry(46, 0.55, 6.5), olive, 0, 1.4, 1);
  add(new THREE.BoxGeometry(14, 0.35, 3.5), olive, 0, 1.0, -21);
  add(new THREE.BoxGeometry(0.4, 7, 4.5), olive, 0, 4.2, -21);
  const props: THREE.Mesh[] = [];
  for (const x of [-16, -8, 8, 16]) {
    add(new THREE.CylinderGeometry(0.8, 0.8, 4, 10).rotateX(Math.PI / 2), dark, x, 0.6, 3.5);
    const pr = add(new THREE.BoxGeometry(5.5, 0.12, 0.3), toon('#222'), x, 0.6, 5.7); props.push(pr);
  }
  add(new THREE.BoxGeometry(5, 0.3, 4), toon('#2a2f24'), 0, -2.6, -14);
  for (const [x, c] of [[-23, '#ff3030'], [23, '#30ff60']] as [number, string][]) add(new THREE.SphereGeometry(0.35, 6, 5), toon(c, { emissive: c, emissiveIntensity: 2 }), x, 1.4, 1);
  g.userData.props = props;
  return g;
}

export class EntityRenderer {
  private group = new THREE.Group();
  private rigs = new Map<number, Rig>();
  private vmodels = new Map<number, THREE.Group>();
  private plane: THREE.Group;
  private fire: Particles; private puff: Particles;
  private lootMeshes: Record<string, THREE.InstancedMesh> = {};
  private beams: THREE.InstancedMesh; private rings: THREE.InstancedMesh;
  private bulletMesh: THREE.InstancedMesh; private smokeMesh: THREE.InstancedMesh; private gren: THREE.InstancedMesh;
  private light: THREE.PointLight;
  private lightT = 0;
  private flashSphere: THREE.Mesh;
  private disposables: { dispose(): void }[] = [];
  private m = new THREE.Matrix4(); private q = new THREE.Quaternion(); private v1 = new THREE.Vector3(); private v2 = new THREE.Vector3(); private c = new THREE.Color();

  constructor(private scene: THREE.Scene, private g: Game, private gfx: GfxSettings) {
    scene.add(this.group);
    const track = <T extends { dispose(): void }>(o: T) => { this.disposables.push(o); return o; };
    const sphere = track(new THREE.IcosahedronGeometry(1, 1));
    this.fire = new Particles(scene, Math.floor(500 * gfx.effects) + 100, sphere, track(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })));
    this.puff = new Particles(scene, Math.floor(400 * gfx.effects) + 80, track(new THREE.IcosahedronGeometry(1, 0)), track(new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false })));
    this.plane = buildPlane(); this.plane.visible = false; this.group.add(this.plane);
    // loot
    const lg: Record<string, THREE.BufferGeometry> = {
      weapon: new THREE.BoxGeometry(0.85, 0.12, 0.2), ammo: new THREE.BoxGeometry(0.28, 0.2, 0.28), armor: new THREE.BoxGeometry(0.45, 0.5, 0.2), helmet: new THREE.SphereGeometry(0.25, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.6),
      backpack: new THREE.BoxGeometry(0.4, 0.5, 0.26), heal: new THREE.BoxGeometry(0.34, 0.26, 0.2), throw: new THREE.SphereGeometry(0.16, 8, 6), attach: new THREE.CylinderGeometry(0.07, 0.07, 0.34, 8).rotateZ(Math.PI / 2),
    };
    const lm = track(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
    for (const k in lg) { track(lg[k]); const im = new THREE.InstancedMesh(lg[k], lm, 500); im.count = 0; im.frustumCulled = false; this.lootMeshes[k] = im; scene.add(im); }
    this.beams = new THREE.InstancedMesh(track(new THREE.CylinderGeometry(0.12, 0.12, 9, 6, 1, true)), track(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })), 500);
    this.rings = new THREE.InstancedMesh(track(new THREE.CylinderGeometry(0.55, 0.55, 0.05, 14)), track(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false, toneMapped: false })), 700);
    this.beams.frustumCulled = this.rings.frustumCulled = false; this.beams.count = this.rings.count = 0;
    scene.add(this.beams, this.rings);
    this.bulletMesh = new THREE.InstancedMesh(track(new THREE.BoxGeometry(0.04, 0.04, 1)), track(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })), 300);
    this.bulletMesh.frustumCulled = false; this.bulletMesh.count = 0; scene.add(this.bulletMesh);
    this.smokeMesh = new THREE.InstancedMesh(track(new THREE.IcosahedronGeometry(1, 1)), track(new THREE.MeshLambertMaterial({ color: 0xdfe3e8, transparent: true, opacity: 0.88, depthWrite: false })), 14 * 12);
    this.smokeMesh.frustumCulled = false; this.smokeMesh.count = 0; scene.add(this.smokeMesh);
    this.gren = new THREE.InstancedMesh(track(new THREE.SphereGeometry(0.14, 8, 6)), track(new THREE.MeshToonMaterial({ color: 0x3d4a2a })), 40);
    this.gren.frustumCulled = false; this.gren.count = 0; scene.add(this.gren);
    this.light = new THREE.PointLight(0xffa040, 0, 60); scene.add(this.light);
    this.flashSphere = new THREE.Mesh(sphere, track(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, toneMapped: false }))); this.flashSphere.visible = false; scene.add(this.flashSphere);
  }

  private getRig(f: Fighter) {
    let r = this.rigs.get(f.id);
    if (!r) { r = createRig(f.look); this.group.add(r.root); this.rigs.set(f.id, r); }
    return r;
  }

  private handleFx(cam: THREE.Vector3) {
    const g = this.g;
    const e = this.gfx.effects;
    for (const ev of g.fxQ) {
      const dist = Math.hypot(ev.x - cam.x, ev.z - cam.z);
      if (dist > 220 && ev.k !== 'explosion') continue;
      switch (ev.k) {
        case 'muzzle': {
          if (dist > 120) break;
          const s = 0.22 * ev.big * (ev.sup ? 0.3 : 1);
          this.fire.spawn(ev.x, ev.y, ev.z, ev.dx * 2, ev.dy * 2, ev.dz * 2, 0.06, s, '#ffd27a');
          this.fire.spawn(ev.x + ev.dx * 0.25, ev.y + ev.dy * 0.25, ev.z + ev.dz * 0.25, 0, 0, 0, 0.05, s * 0.7, '#fff3c0');
          if (!ev.sup) this.puff.spawn(ev.x, ev.y, ev.z, ev.dx * 1.5, 0.4, ev.dz * 1.5, 0.5, 0.1, '#bbbbbb', 3);
          break;
        }
        case 'impact': {
          const n = Math.floor((ev.kind === 'flesh' ? 5 : 4) * e);
          const col = ev.kind === 'flesh' ? '#ff4a5a' : ev.kind === 'metal' ? '#ffd27a' : '#e9d9a8';
          for (let i = 0; i < n; i++) this.fire.spawn(ev.x, ev.y, ev.z, ev.nx * 4 + (Math.random() - 0.5) * 4, ev.ny * 4 + Math.random() * 3, ev.nz * 4 + (Math.random() - 0.5) * 4, 0.3, 0.05, col, 0, 12);
          if (ev.kind === 'world' && dist < 80) this.puff.spawn(ev.x, ev.y, ev.z, ev.nx, ev.ny + 0.5, ev.nz, 0.6, 0.15, '#b8a888', 4);
          break;
        }
        case 'explosion': {
          const n = Math.floor(22 * e) + 6;
          for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, u = Math.random() * 2 - 1, sp = 3 + Math.random() * 9; this.fire.spawn(ev.x, ev.y, ev.z, Math.cos(a) * Math.sqrt(1 - u * u) * sp, u * sp * 0.8 + 2, Math.sin(a) * Math.sqrt(1 - u * u) * sp, 0.45 + Math.random() * 0.4, 0.6 + Math.random() * 0.9, Math.random() < 0.5 ? '#ff9a30' : '#ff5a20', 0.5, 4); }
          for (let i = 0; i < n; i++) this.puff.spawn(ev.x + (Math.random() - 0.5) * 2, ev.y, ev.z + (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 4, 2 + Math.random() * 4, (Math.random() - 0.5) * 4, 1.8 + Math.random(), 0.8, '#3a3a3a', 3.5);
          this.light.position.set(ev.x, ev.y + 1.5, ev.z); this.light.intensity = 200; this.light.color.set('#ffa040'); this.lightT = 0.35;
          break;
        }
        case 'flash': { this.flashSphere.position.set(ev.x, ev.y, ev.z); this.flashSphere.visible = true; this.flashSphere.scale.setScalar(1); (this.flashSphere.material as THREE.MeshBasicMaterial).opacity = 1; this.light.position.set(ev.x, ev.y + 1, ev.z); this.light.intensity = 300; this.light.color.set('#ffffff'); this.lightT = 0.3; break; }
        case 'smoke': break;
        case 'dust': for (let i = 0; i < 8 * e; i++) this.puff.spawn(ev.x, ev.y + 0.2, ev.z, (Math.random() - 0.5) * 3, 0.5 + Math.random(), (Math.random() - 0.5) * 3, 0.9, 0.3, '#c8b890', 2.5); break;
      }
    }
    g.fxQ.length = 0;
  }

  update(dt: number, camPos: THREE.Vector3, hideId: number) {
    const g = this.g;
    const t = g.time;
    this.handleFx(camPos);
    // fighters
    const vd = this.gfx.viewDist * 0.55;
    for (const f of g.fighters) {
      const dx = f.pos.x - camPos.x, dz = f.pos.z - camPos.z;
      const d = Math.hypot(dx, dz);
      const hidden = f.state === 'plane' || d > vd || f.id === hideId || (!f.alive && t - f.diedAt > 90);
      const rig = this.rigs.get(f.id);
      if (hidden) { if (rig) rig.root.visible = false; continue; }
      const r = this.getRig(f);
      r.root.visible = true;
      if (f.state === 'vehicle' && f.vehicle) { r.root.position.set(f.vehicle.pos.x, f.vehicle.pos.y + 0.05 + (f.vehicle.type === 'bike' ? 0.25 : 0.1), f.vehicle.pos.z); f.bodyYaw = f.vehicle.yaw; }
      else r.root.position.copy(f.pos);
      if (d < 140 || f.state !== 'ground') {
        setRigGear(r, f); setRigWeapon(r, f.weapon);
        animateRig(r, f, dt, t);
      } else r.root.rotation.y = f.bodyYaw;
      const wantSh = this.gfx.shadows && (f.isPlayer || d < 70);
      if (r.root.userData.sh !== wantSh) { r.root.userData.sh = wantSh; r.root.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = wantSh; }); }
    }
    // vehicles
    for (const v of g.vehicles) {
      let m = this.vmodels.get(v.id);
      const d = Math.hypot(v.pos.x - camPos.x, v.pos.z - camPos.z);
      if (!m) { if (d > 350) continue; m = vehicleModel(v.type); this.group.add(m); this.vmodels.set(v.id, m); }
      m.visible = d < 450;
      m.position.copy(v.pos);
      m.rotation.set(v.pitch, v.yaw, v.roll, 'YXZ');
      for (const w of m.userData.wheels as THREE.Object3D[]) w.rotation.x = v.wheel;
      if (v.dead && !m.userData.dead) { m.userData.dead = true; m.traverse((o) => { if (o instanceof THREE.Mesh) o.material = toon('#1b1b1b'); }); }
      if ((v.dead && v.burnT < 40 || v.hp < v.maxHp * 0.3) && d < 120 && Math.random() < 0.3) this.puff.spawn(v.pos.x, v.pos.y + 1.2, v.pos.z, 0, 2.5, 0, 1.4, 0.5, v.dead ? '#222' : '#777', 3);
      if (v.dead && v.burnT < 40 && d < 100 && Math.random() < 0.25) this.fire.spawn(v.pos.x + (Math.random() - 0.5), v.pos.y + 1, v.pos.z + (Math.random() - 0.5), 0, 2, 0, 0.5, 0.4, '#ff8a20', 0.2);
    }
    // plane
    const pl = g.plane;
    this.plane.visible = g.mode === 'match' && pl.active;
    if (this.plane.visible) {
      this.plane.position.copy(pl.pos); this.plane.rotation.y = Math.atan2(pl.dir.x, pl.dir.z);
      for (const p of this.plane.userData.props as THREE.Mesh[]) p.rotation.z += dt * 40;
    }
    this.updateLoot(camPos, t);
    this.updateBullets(dt);
    this.updateSmokes();
    if (this.lightT > 0) { this.lightT -= dt; this.light.intensity *= 0.86; if (this.lightT <= 0) this.light.intensity = 0; }
    if (this.flashSphere.visible) { const mm = this.flashSphere.material as THREE.MeshBasicMaterial; mm.opacity -= dt * 3; this.flashSphere.scale.addScalar(dt * 30); if (mm.opacity <= 0) this.flashSphere.visible = false; }
    this.fire.update(dt); this.puff.update(dt);
  }

  private updateLoot(cam: THREE.Vector3, t: number) {
    const counts: Record<string, number> = {};
    let nb = 0, nr = 0;
    for (const k in this.lootMeshes) this.lootMeshes[k].count = 0;
    const g = this.g;
    const lim = this.gfx.viewDist * 0.28;
    for (const l of g.loot) {
      const dx = l.x - cam.x, dz = l.z - cam.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > lim * lim) continue;
      const def = ITEMS[l.item];
      const mesh = this.lootMeshes[def.kind];
      const n = counts[def.kind] || 0;
      if (n >= 500) continue;
      counts[def.kind] = n + 1;
      const bob = Math.sin(t * 2 + l.id) * 0.08;
      this.q.setFromAxisAngle(this.v1.set(0, 1, 0), t * 1.4 + l.id);
      this.m.compose(this.v2.set(l.x, l.y + 0.7 + bob, l.z), this.q, this.v1.set(1, 1, 1));
      mesh.setMatrixAt(n, this.m);
      this.c.set(RARITY_COLOR[def.rarity]);
      mesh.setColorAt(n, this.c);
      if (nr < 700) { this.m.compose(this.v2.set(l.x, l.y + 0.06, l.z), new THREE.Quaternion(), this.v1.set(1, 1, 1)); this.rings.setMatrixAt(nr, this.m); this.rings.setColorAt(nr, this.c); nr++; }
      if (def.rarity !== 'common' && def.rarity !== 'uncommon' && nb < 500 && d2 < 150 * 150) { this.m.compose(this.v2.set(l.x, l.y + 4.5, l.z), new THREE.Quaternion(), this.v1.set(1, 1, 1)); this.beams.setMatrixAt(nb, this.m); this.beams.setColorAt(nb, this.c); nb++; }
    }
    for (const k in this.lootMeshes) { const im = this.lootMeshes[k]; im.count = counts[k] || 0; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
    this.beams.count = nb; this.rings.count = nr;
    this.beams.instanceMatrix.needsUpdate = true; this.rings.instanceMatrix.needsUpdate = true;
    if (this.beams.instanceColor) this.beams.instanceColor.needsUpdate = true;
    if (this.rings.instanceColor) this.rings.instanceColor.needsUpdate = true;
  }

  private updateBullets(dt: number) {
    let n = 0;
    const g = this.g;
    for (const b of g.bullets) {
      if (!b.active || b.travelled < 1.5) continue;
      const sp = Math.hypot(b.vx, b.vy, b.vz);
      const len = Math.min(b.sup ? 2 : 5, b.travelled - 1);
      const dx = b.vx / sp, dy = b.vy / sp, dz = b.vz / sp;
      this.q.setFromUnitVectors(this.v1.set(0, 0, 1), this.v2.set(dx, dy, dz));
      this.m.compose(this.v2.set(b.x - dx * len / 2, b.y - dy * len / 2, b.z - dz * len / 2), this.q, this.v1.set(1, 1, len));
      this.bulletMesh.setMatrixAt(n, this.m);
      this.bulletMesh.setColorAt(n, this.c.set(b.sup ? '#666' : b.color));
      n++;
      if (n >= 300) break;
    }
    this.bulletMesh.count = n; this.bulletMesh.instanceMatrix.needsUpdate = true;
    if (this.bulletMesh.instanceColor) this.bulletMesh.instanceColor.needsUpdate = true;
    let gi = 0;
    for (const gr of g.grenades) { if (!gr.active || gi >= 40) continue; this.m.compose(this.v1.set(gr.x, gr.y, gr.z), this.q.identity(), this.v2.set(1, 1, 1)); this.gren.setMatrixAt(gi++, this.m); }
    this.gren.count = gi; this.gren.instanceMatrix.needsUpdate = true;
    void dt;
  }

  private updateSmokes() {
    let n = 0;
    for (const s of this.g.smokes.slice(0, 12)) {
      const grow = clamp(s.t / 1.6, 0, 1), fade = clamp((22 - s.t) / 4, 0, 1);
      for (let i = 0; i < 14; i++) {
        const a = i * 2.4, rr = (i % 5) * 0.2 * s.r * grow, h = (i % 3) * 1.4 + 1.5;
        const sc = s.r * 0.42 * grow * fade * (0.8 + (i % 4) * 0.12);
        this.m.compose(this.v1.set(s.x + Math.cos(a) * rr, s.y + h * grow, s.z + Math.sin(a) * rr), this.q.identity(), this.v2.set(sc, sc * 0.85, sc));
        this.smokeMesh.setMatrixAt(n++, this.m);
      }
    }
    this.smokeMesh.count = n; this.smokeMesh.instanceMatrix.needsUpdate = true;
  }

  getMuzzleWorld(f: Fighter, out: THREE.Vector3) {
    const r = this.rigs.get(f.id);
    if (r?.muzzle) { r.muzzle.getWorldPosition(out); return true; }
    return false;
  }

  dispose() {
    this.scene.remove(this.group, this.fire.mesh, this.puff.mesh, this.beams, this.rings, this.bulletMesh, this.smokeMesh, this.gren, this.light, this.flashSphere, ...Object.values(this.lootMeshes));
    this.rigs.clear(); this.vmodels.clear();
    this.group.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry?.dispose(); });
    this.fire.mesh.dispose(); this.puff.mesh.dispose(); this.beams.dispose(); this.rings.dispose(); this.bulletMesh.dispose(); this.smokeMesh.dispose(); this.gren.dispose();
    Object.values(this.lootMeshes).forEach((m) => m.dispose());
    this.disposables.forEach((d) => d.dispose());
  }
}
