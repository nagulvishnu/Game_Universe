import * as THREE from 'three';
import {
  DOORS,
  FLOOR_Y,
  FURNITURE,
  HIDE_SPOTS,
  LIGHTS,
  PAINTINGS,
  ROOMS,
  STAIR,
  STAIR_RISE,
  WALLS,
  WALL_H,
  WALL_T,
  doorClosed,
  furnitureBox,
  roomAt,
  wallPieces,
  type DoorDef,
  type HideSpot,
  type LightDef,
  type LockKind,
  type WallDef,
  type FurnitureDef,
} from './layout';
import { Batch, Parts, buildFurniture, buildWardrobe, type WardrobeRT } from './furniture';
import { TILE, cloneMat, getGlass, getMat, planeGeo } from './materials';

export interface DoorRT {
  def: DoorDef;
  pivot: THREE.Group;
  base: number;
  swingSign: number;
  open: number;
  target: number;
  hx: number;
  hz: number;
  cx: number;
  cz: number;
  fy: number;
  width: number;
  locked: LockKind | null;
  hits: THREE.Mesh[];
}

export interface HideRT {
  spot: HideSpot;
  def: FurnitureDef;
  proxy: THREE.Mesh;
  wardrobe?: WardrobeRT;
  amount: number;
  target: number;
}

export interface LightRT {
  light: THREE.PointLight;
  def: LightDef;
  mat?: THREE.MeshStandardMaterial;
  phase: number;
  baseEmissive: number;
}

const ONE = new THREE.Vector3(1, 1, 1);

function quadMatrix(x: number, y: number, z: number, rx: number, ry: number): THREE.Matrix4 {
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, 0, 'YXZ')), ONE);
}

export class World {
  root = new THREE.Group();
  doors: DoorRT[] = [];
  doorById = new Map<string, DoorRT>();
  hides: HideRT[] = [];
  lights: LightRT[] = [];
  staticMeshes: THREE.Mesh[] = [];
  hitMeshes: THREE.Object3D[] = [];
  frontLocks: { padlock: THREE.Group; deadbolt: THREE.Group } | null = null;
  private batch = new Batch();

  constructor() {
    this.buildWalls();
    this.buildFloors();
    this.buildStairs();
    this.buildFurniture();
    this.buildPaintings();
    this.buildLights();
    this.buildDoors();
    this.staticMeshes = this.batch.build(this.root);
  }

  // ------------------------------------------------------------------ walls
  private quad(key: string, w: number, h: number, m: THREE.Matrix4) {
    const g = planeGeo(w, h, TILE[key] ?? 2);
    g.applyMatrix4(m);
    this.batch.add(key, g);
  }

  private buildWalls() {
    const t = WALL_T;
    for (const w of WALLS) {
      if (w.kind === 'stair' && w.floor === 1) {
        this.buildRailing(w);
        continue;
      }
      for (const p of wallPieces(w)) {
        const fy = FLOOR_Y[p.floor];
        const y0 = fy + p.y0;
        const y1 = fy + p.y1 + (p.floor === 0 && p.y1 >= WALL_H ? 0.2 : 0);
        const len = p.b - p.a;
        const hh = y1 - y0;
        const mid = (p.a + p.b) / 2;
        const cy = (y0 + y1) / 2;
        if (p.kind === 'glass') {
          this.buildWindow(w, p.a, p.b, y0, y1);
          continue;
        }
        // long sides
        for (const s of [-1, 1]) {
          const off = t / 2 + 0.25;
          const sx = p.axis === 'x' ? mid : p.fixed + s * off;
          const sz = p.axis === 'x' ? p.fixed + s * off : mid;
          const room = roomAt(sx, sz, p.floor);
          const key = room ? room.wallMat : 'plaster';
          if (p.axis === 'x') this.quad(key, len, hh, quadMatrix(mid, cy, p.fixed + (s * t) / 2, 0, s > 0 ? 0 : Math.PI));
          else this.quad(key, len, hh, quadMatrix(p.fixed + (s * t) / 2, cy, mid, 0, s > 0 ? Math.PI / 2 : -Math.PI / 2));
        }
        // jamb ends beside openings
        const leftOpen = p.a > w.from - t / 2 + 1e-6;
        const rightOpen = p.b < w.to + t / 2 - 1e-6;
        if (leftOpen) {
          if (p.axis === 'x') this.quad('woodB', t, hh, quadMatrix(p.a, cy, p.fixed, 0, -Math.PI / 2));
          else this.quad('woodB', t, hh, quadMatrix(p.fixed, cy, p.a, 0, Math.PI));
        }
        if (rightOpen) {
          if (p.axis === 'x') this.quad('woodB', t, hh, quadMatrix(p.b, cy, p.fixed, 0, Math.PI / 2));
          else this.quad('woodB', t, hh, quadMatrix(p.fixed, cy, p.b, 0, 0));
        }
        if (p.kind === 'lintel') {
          if (p.axis === 'x') this.quad('woodB', len, t, quadMatrix(mid, y0, p.fixed, Math.PI / 2, 0));
          else this.quad('woodB', t, len, quadMatrix(p.fixed, y0, mid, Math.PI / 2, 0));
        }
        if (p.kind === 'sill') {
          if (p.axis === 'x') this.quad('woodL', len, t + 0.1, quadMatrix(mid, y1, p.fixed, -Math.PI / 2, 0));
          else this.quad('woodL', t + 0.1, len, quadMatrix(p.fixed, y1, mid, -Math.PI / 2, 0));
        }
      }
    }
  }

  private buildWindow(w: WallDef, a: number, b: number, y0: number, y1: number) {
    const len = b - a;
    const hh = y1 - y0;
    const mid = (a + b) / 2;
    const cy = (y0 + y1) / 2;
    const p = new Parts(this.batch, 0, 0, 0, 0);
    const gm = planeGeo(len, hh, 1);
    gm.applyMatrix4(w.axis === 'x' ? quadMatrix(mid, cy, w.fixed, 0, 0) : quadMatrix(w.fixed, cy, mid, 0, Math.PI / 2));
    this.batch.add('glass', gm);
    const n = w.axis === 'x' ? (w.fixed < 8 ? 1 : -1) : w.fixed < 10 ? 1 : -1; // inward normal
    if (w.axis === 'x') {
      p.box(len, 0.04, 0.05, mid, cy - 0.02, w.fixed, 'woodB');
      p.box(0.04, hh, 0.05, mid, y0, w.fixed, 'woodB');
      for (const s of [-1, 1]) p.box(0.3, hh + 0.35, 0.09, mid + s * (len / 2 - 0.1), y0 - 0.05, w.fixed + n * (WALL_T / 2 + 0.06), 'curtain');
      p.box(len + 0.5, 0.03, 0.03, mid, y1 + 0.2, w.fixed + n * (WALL_T / 2 + 0.08), 'woodB');
    } else {
      p.box(0.05, 0.04, len, w.fixed, cy - 0.02, mid, 'woodB');
      p.box(0.05, hh, 0.04, w.fixed, y0, mid, 'woodB');
      for (const s of [-1, 1]) p.box(0.09, hh + 0.35, 0.3, w.fixed + n * (WALL_T / 2 + 0.06), y0 - 0.05, mid + s * (len / 2 - 0.1), 'curtain');
      p.box(0.03, 0.03, len + 0.5, w.fixed + n * (WALL_T / 2 + 0.08), y1 + 0.2, mid, 'woodB');
    }
  }

  private buildRailing(w: WallDef) {
    const fy = FLOOR_Y[w.floor];
    const p = new Parts(this.batch, 0, fy, 0, 0);
    const len = w.to - w.from;
    const mid = (w.from + w.to) / 2;
    if (w.axis === 'x') {
      p.box(len + 0.1, 0.06, 0.09, mid, 0.95, w.fixed, 'woodB');
      p.box(len, 0.03, 0.03, mid, 0.5, w.fixed, 'woodB');
      p.box(len, 0.03, 0.03, mid, 0.15, w.fixed, 'woodB');
      for (let x = w.from; x <= w.to + 0.01; x += 0.4) p.box(0.04, 0.95, 0.04, x, 0, w.fixed, 'woodB');
    } else {
      p.box(0.09, 0.06, len + 0.1, w.fixed, 0.95, mid, 'woodB');
      p.box(0.03, 0.03, len, w.fixed, 0.5, mid, 'woodB');
      p.box(0.03, 0.03, len, w.fixed, 0.15, mid, 'woodB');
      for (let z = w.from; z <= w.to + 0.01; z += 0.4) p.box(0.04, 0.95, 0.04, w.fixed, 0, z, 'woodB');
    }
  }

  // ------------------------------------------------------------------ floors & ceilings
  private hq(key: string, x1: number, z1: number, x2: number, z2: number, y: number, up: boolean) {
    this.quad(key, x2 - x1, z2 - z1, quadMatrix((x1 + x2) / 2, y, (z1 + z2) / 2, up ? -Math.PI / 2 : Math.PI / 2, 0));
  }

  private buildFloors() {
    const fy1 = FLOOR_Y[1];
    for (const r of ROOMS) {
      const fy = FLOOR_Y[r.floor];
      const rects: [number, number, number, number][] =
        r.id === 'hallU'
          ? [
              [0, 7, STAIR.x1, 10.8],
              [STAIR.x1, STAIR.z2, STAIR.x2, 10.8],
              [STAIR.x2, 7, 20, 10.8],
            ]
          : [[r.x1, r.z1, r.x2, r.z2]];
      for (const [x1, z1, x2, z2] of rects) {
        this.hq(r.floorMat, x1, z1, x2, z2, fy, true);
        if (r.floor === 1) this.hq('ceiling', x1, z1, x2, z2, fy1 - 0.2, false); // ceiling of the rooms below
      }
      if (r.floor === 1) this.hq('ceiling', r.x1, r.z1, r.x2, r.z2, fy1 + WALL_H, false);
    }
    // slab edges around the stair hole
    this.quad('plaster', STAIR.z2 - STAIR.z1, 0.2, quadMatrix(STAIR.x1, fy1 - 0.1, (STAIR.z1 + STAIR.z2) / 2, 0, Math.PI / 2));
    this.quad('plaster', STAIR.x2 - STAIR.x1, 0.2, quadMatrix((STAIR.x1 + STAIR.x2) / 2, fy1 - 0.1, STAIR.z2, 0, Math.PI));
  }

  private buildStairs() {
    const p = new Parts(this.batch, 0, 0, 0, 0);
    const run = (STAIR.x2 - STAIR.x1) / STAIR.steps;
    const rise = STAIR_RISE / STAIR.steps;
    for (let i = 0; i < STAIR.steps; i++) {
      const h = (i + 1) * rise;
      p.box(run + 0.002, h, 1.8, STAIR.x1 + (i + 0.5) * run, 0, 8.0, 'wood_old');
      p.box(run * 0.2, 0.025, 1.8, STAIR.x1 + (i + 0.1) * run, h, 8.0, 'woodB');
    }
  }

  // ------------------------------------------------------------------ furniture
  private buildFurniture() {
    let k = 0;
    FURNITURE.forEach((f, i) => {
      if (f.hide) {
        const spot = HIDE_SPOTS[k++];
        let wr: WardrobeRT | undefined;
        if (f.hide === 'wardrobe') {
          wr = buildWardrobe(f, this.batch);
          this.root.add(wr.group);
        } else {
          buildFurniture(f, this.batch, i * 17 + 3);
        }
        const b = furnitureBox(f);
        const proxy = new THREE.Mesh(new THREE.BoxGeometry(b.x2 - b.x1 + 0.04, f.h, b.z2 - b.z1 + 0.04), new THREE.MeshBasicMaterial());
        proxy.position.set((b.x1 + b.x2) / 2, FLOOR_Y[f.floor] + f.h / 2, (b.z1 + b.z2) / 2);
        proxy.visible = false;
        const hidx = this.hides.length;
        proxy.userData.interact = { type: 'hide', index: hidx };
        wr?.group.traverse((o) => {
          o.userData.interact = { type: 'hide', index: hidx };
        });
        this.root.add(proxy);
        this.hitMeshes.push(proxy);
        if (wr) this.hitMeshes.push(wr.group);
        this.hides.push({ spot, def: f, proxy, wardrobe: wr, amount: 0, target: 0 });
      } else {
        buildFurniture(f, this.batch, i * 17 + 3);
      }
    });
  }

  private buildPaintings() {
    for (const pt of PAINTINGS) {
      const fy = FLOOR_Y[pt.floor];
      const p = new Parts(this.batch, pt.x, fy, pt.z, pt.rot);
      p.box(0.8, 1.0, 0.05, 0, 1.25, 0, 'woodB');
      p.box(0.7, 0.03, 0.06, 0, 2.21, 0, 'brass');
      const g = new THREE.PlaneGeometry(0.66, 0.86);
      g.translate(0, 0, 0.028);
      g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(pt.x, fy + 1.75, pt.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), pt.rot), ONE));
      this.batch.add(`paint${pt.variant}`, g);
    }
  }

  // ------------------------------------------------------------------ lights
  private buildLights() {
    LIGHTS.forEach((d, i) => {
      const light = new THREE.PointLight(d.color, d.intensity, d.distance, 2);
      light.position.set(d.x, d.y, d.z);
      this.root.add(light);
      let mat: THREE.MeshStandardMaterial | undefined;
      let base = 1;
      if (d.fixture === 'bulb') {
        mat = cloneMat('ember');
        mat.color.setHex(0x443322);
        mat.emissive.setHex(d.color);
        mat.emissiveIntensity = 2.4;
        base = 2.4;
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), mat);
        bulb.position.set(d.x, d.y, d.z);
        this.root.add(bulb);
        const top = d.y > 4 ? FLOOR_Y[1] + WALL_H : WALL_H;
        const p = new Parts(this.batch, d.x, 0, d.z, 0);
        p.cyl(0.008, 0.008, top - d.y, 0, d.y, 0, 'black', 4);
        p.cyl(0.14, 0.05, 0.1, 0, d.y + 0.07, 0, 'iron', 10);
      } else if (d.fixture === 'lamp') {
        mat = cloneMat('ember');
        mat.color.setHex(0x443322);
        mat.emissive.setHex(d.color);
        mat.emissiveIntensity = 1.5;
        base = 1.5;
        const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.13, 0.17, 12, 1, true), mat);
        mat.side = THREE.DoubleSide;
        shade.position.set(d.x, d.y - 0.1, d.z);
        this.root.add(shade);
        const p = new Parts(this.batch, d.x, 0, d.z, 0);
        const baseY = d.y - 0.1 - 0.085;
        p.cyl(0.012, 0.012, 0.18, 0, baseY - 0.18, 0, 'brass', 6);
        p.cyl(0.06, 0.07, 0.03, 0, baseY - 0.2, 0, 'brass', 10);
      }
      this.lights.push({ light, def: d, mat, phase: i * 1.7, baseEmissive: base });
    });
  }

  // ------------------------------------------------------------------ doors
  private buildDoors() {
    for (const d of DOORS) {
      const fy = FLOOR_Y[d.floor];
      const hx = d.axis === 'x' ? d.pos + (d.hinge * d.width) / 2 : d.fixed;
      const hz = d.axis === 'x' ? d.fixed : d.pos + (d.hinge * d.width) / 2;
      const fdx = d.axis === 'x' ? -d.hinge : 0;
      const fdz = d.axis === 'x' ? 0 : -d.hinge;
      const base = Math.atan2(-fdz, fdx);
      const pivot = new THREE.Group();
      pivot.position.set(hx, fy, hz);
      pivot.rotation.y = base;
      const thick = d.front ? 0.1 : 0.06;
      const ph = d.front ? 2.26 : 2.12;
      const pw = d.width - 0.03;
      const hits: THREE.Mesh[] = [];
      const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
        const m = new THREE.Mesh(geo, mat);
        m.position.set(x, y, z);
        m.castShadow = true;
        m.receiveShadow = true;
        m.userData.interact = { type: d.front ? 'front' : 'door', id: d.id };
        pivot.add(m);
        hits.push(m);
        return m;
      };
      add(new THREE.BoxGeometry(pw, ph, thick), getMat('door'), pw / 2 + 0.015, ph / 2 + 0.01, 0);
      const knobGeo = new THREE.SphereGeometry(0.035, 10, 8);
      for (const s of [-1, 1]) {
        add(knobGeo, getMat('brass'), pw - 0.1, 1.0, s * (thick / 2 + 0.035));
        add(new THREE.BoxGeometry(0.05, 0.14, 0.01), getMat('brass'), pw - 0.1, 1.0, s * (thick / 2 + 0.005));
      }
      if (d.front) {
        add(new THREE.BoxGeometry(pw, 0.09, thick + 0.02), getMat('iron'), pw / 2 + 0.015, 0.5, 0);
        add(new THREE.BoxGeometry(pw, 0.09, thick + 0.02), getMat('iron'), pw / 2 + 0.015, 1.85, 0);
        // padlock + deadbolt on the inside face (local +z when hinge = 1)
        const mkLock = (y: number, big: boolean) => {
          const g = new THREE.Group();
          const body = new THREE.Mesh(new THREE.BoxGeometry(big ? 0.16 : 0.1, big ? 0.2 : 0.12, 0.06), getMat(big ? 'brass' : 'steel'));
          body.userData.interact = { type: 'front', id: d.id };
          g.add(body);
          const sh = new THREE.Mesh(new THREE.TorusGeometry(big ? 0.05 : 0.035, 0.012, 6, 12, Math.PI), getMat('steel'));
          sh.position.y = big ? 0.1 : 0.06;
          g.add(sh);
          g.position.set(pw - 0.2, y, thick / 2 + 0.04);
          g.traverse((o) => {
            o.userData.interact = { type: 'front', id: d.id };
            if (o instanceof THREE.Mesh) o.castShadow = true;
          });
          pivot.add(g);
          return g;
        };
        this.frontLocks = { padlock: mkLock(1.35, false), deadbolt: mkLock(0.8, true) };
        // chain across the door
        const chain = new THREE.Mesh(new THREE.BoxGeometry(pw * 0.8, 0.03, 0.03), getMat('iron'));
        chain.position.set(pw / 2, 1.1, thick / 2 + 0.03);
        chain.rotation.z = 0.0;
        pivot.add(chain);
        this.hitMeshes.push(chain);
        chain.userData.interact = { type: 'front', id: d.id };
        chain.name = 'chain';
      }
      this.root.add(pivot);
      const rt: DoorRT = {
        def: d,
        pivot,
        base,
        swingSign: 1,
        open: 0,
        target: 0,
        hx,
        hz,
        cx: d.axis === 'x' ? d.pos : d.fixed,
        cz: d.axis === 'x' ? d.fixed : d.pos,
        fy,
        width: d.width,
        locked: d.lock,
        hits,
      };
      this.doors.push(rt);
      this.doorById.set(d.id, rt);
      for (const m of hits) this.hitMeshes.push(m);
    }
  }

  /** Which way (+1/-1) should the door swing so it opens away from (x,z)? */
  private swingAway(d: DoorRT, x: number, z: number): number {
    let best = 1;
    let bd = -1;
    for (const s of [1, -1]) {
      const th = d.base + (s * Math.PI) / 2;
      const ex = d.hx + Math.cos(th) * d.width;
      const ez = d.hz - Math.sin(th) * d.width;
      const dist = Math.hypot(ex - x, ez - z);
      if (dist > bd) {
        bd = dist;
        best = s;
      }
    }
    return best;
  }

  openDoor(id: string, fromX: number, fromZ: number) {
    const d = this.doorById.get(id);
    if (!d) return;
    if (d.open < 0.05) d.swingSign = this.swingAway(d, fromX, fromZ);
    d.target = 1;
  }
  closeDoor(id: string) {
    const d = this.doorById.get(id);
    if (d) d.target = 0;
  }

  // ------------------------------------------------------------------ per-frame
  update(dt: number, time: number) {
    for (const d of this.doors) {
      if (d.open !== d.target) {
        const step = dt * 2.0;
        d.open = d.open < d.target ? Math.min(d.target, d.open + step) : Math.max(d.target, d.open - step);
        const e = d.open * d.open * (3 - 2 * d.open);
        d.pivot.rotation.y = d.base + d.swingSign * (Math.PI / 2) * 0.96 * e;
      }
      doorClosed[d.def.id] = d.open < 0.55;
    }
    for (const h of this.hides) {
      if (h.wardrobe && h.amount !== h.target) {
        const step = dt * 3.2;
        h.amount = h.amount < h.target ? Math.min(h.target, h.amount + step) : Math.max(h.target, h.amount - step);
        const a = h.amount * 1.9;
        h.wardrobe.doorL.rotation.y = -a;
        h.wardrobe.doorR.rotation.y = a;
      }
    }
    for (const l of this.lights) {
      const f = l.def.flicker;
      let k = 1;
      if (f > 0) {
        const n = Math.sin(time * 13 + l.phase) * 0.5 + Math.sin(time * 7.3 + l.phase * 2) * 0.5;
        k = 1 - f * 0.5 * (0.5 + 0.5 * n);
        if (l.def.fixture === 'fire') k *= 0.75 + Math.random() * 0.25;
        if (f >= 0.3 && l.def.fixture === 'bulb' && Math.sin(time * 0.9 + l.phase) * Math.sin(time * 2.1 + l.phase) > 0.92) k *= 0.12;
      }
      l.light.intensity = l.def.intensity * k;
      if (l.mat) l.mat.emissiveIntensity = l.baseEmissive * k;
    }
  }

  setFlash(v: number) {
    const g = getGlass();
    g.color.setRGB(0.03 + v * 0.75, 0.045 + v * 0.8, 0.08 + v * 0.95);
    g.opacity = 0.88 - v * 0.3;
  }

  /** Raw door box helper reused by raycasts */
  dispose() {
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
  }
}
