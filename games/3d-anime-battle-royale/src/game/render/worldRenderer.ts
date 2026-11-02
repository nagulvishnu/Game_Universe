import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GfxSettings } from '../data/config';
import { World } from '../world/colliders';
import type { Game } from '../engine/Game';
import { gradientMap } from './materials';
import { clamp, lerp, mulberry32 } from '../util';

const CH = 200;

function chunked(data: number[], stride: number, half: number) {
  const m = new Map<number, number[]>();
  for (let i = 0; i < data.length; i += stride) {
    const k = Math.floor((data[i] + half) / CH) * 1000 + Math.floor((data[i + 2] + half) / CH);
    let a = m.get(k);
    if (!a) { a = []; m.set(k, a); }
    a.push(i);
  }
  return m;
}

export class WorldRenderer {
  group = new THREE.Group();
  private disposables: { dispose(): void }[] = [];
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  sky: THREE.Mesh;
  skyMat: THREE.ShaderMaterial;
  water: THREE.Mesh | null = null;
  waterTex: THREE.CanvasTexture | null = null;
  zoneWall: THREE.Mesh;
  nextWall: THREE.Mesh;
  zoneTex: THREE.CanvasTexture;
  clouds: THREE.InstancedMesh;
  fog: THREE.Fog;
  private sunDir = new THREE.Vector3(0.5, 0.8, 0.3).normalize();
  private col = new THREE.Color();

  constructor(public scene: THREE.Scene, public world: World, public gfx: GfxSettings) {
    scene.add(this.group);
    const half = world.half;
    const track = <T extends { dispose(): void }>(o: T) => { this.disposables.push(o); return o; };
    // terrain
    const stride = 2;
    const seg = Math.floor((world.n - 1) / stride);
    const pos = new Float32Array((seg + 1) * (seg + 1) * 3), uv = new Float32Array((seg + 1) * (seg + 1) * 2);
    for (let j = 0; j <= seg; j++) for (let i = 0; i <= seg; i++) {
      const k = j * (seg + 1) + i;
      const x = -half + i * stride * world.res, z = -half + j * stride * world.res;
      pos[k * 3] = x; pos[k * 3 + 1] = world.heights[j * stride * world.n + i * stride]; pos[k * 3 + 2] = z;
      uv[k * 2] = i / seg; uv[k * 2 + 1] = 1 - j / seg;
    }
    const idx = new Uint32Array(seg * seg * 6);
    let p = 0;
    for (let j = 0; j < seg; j++) for (let i = 0; i < seg; i++) {
      const a = j * (seg + 1) + i, b = a + 1, c = a + seg + 1, d = c + 1;
      idx[p++] = a; idx[p++] = c; idx[p++] = b; idx[p++] = b; idx[p++] = c; idx[p++] = d;
    }
    const tg = track(new THREE.BufferGeometry());
    tg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); tg.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); tg.setIndex(new THREE.BufferAttribute(idx, 1));
    tg.computeVertexNormals();
    const tex = track(new THREE.CanvasTexture(world.mapCanvas!));
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const tm = track(new THREE.MeshToonMaterial({ map: tex, gradientMap: gradientMap() }));
    const terrain = new THREE.Mesh(tg, tm); terrain.receiveShadow = true; this.group.add(terrain);

    // structures
    const boxGeo = track(new THREE.BoxGeometry(1, 1, 1));
    const cylGeo = track(new THREE.CylinderGeometry(1, 1, 1, 20));
    const coneGeo = track(new THREE.ConeGeometry(Math.SQRT2, 1, 4).rotateY(Math.PI / 4));
    const mToon = track(new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: gradientMap() }));
    const mEmis = track(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pp = new THREE.Vector3(), ss = new THREE.Vector3(), c = new THREE.Color();
    const inst = (geom: THREE.BufferGeometry, mat: THREE.Material, data: number[], shadow: boolean) => {
      for (const idxs of chunked(data, 7, half).values()) {
        const im = new THREE.InstancedMesh(geom, mat, idxs.length);
        idxs.forEach((i, n) => {
          pp.set(data[i], data[i + 1], data[i + 2]); ss.set(data[i + 3], data[i + 4], data[i + 5] || 1);
          m4.compose(pp, q, ss); im.setMatrixAt(n, m4);
          c.setHex(data[i + 6]); im.setColorAt(n, c);
        });
        im.castShadow = shadow && gfx.shadows; im.receiveShadow = gfx.shadows || shadow;
        im.computeBoundingSphere(); im.computeBoundingBox();
        this.group.add(im); this.disposables.push({ dispose: () => im.dispose() });
      }
    };
    const R = world.render;
    inst(boxGeo, mToon, R.boxes, true);
    inst(boxGeo, mEmis, R.emis, false);
    inst(cylGeo, mToon, R.cyl, true);
    inst(coneGeo, mToon, R.cones, true);

    // trees
    const part = (g: THREE.BufferGeometry, color: number, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) => {
      const gg = g.index ? g.toNonIndexed() : g;
      gg.scale(sx, sy, sz); gg.translate(x, y, z);
      const n = gg.attributes.position.count, arr = new Float32Array(n * 3);
      const cc = new THREE.Color(color);
      for (let i = 0; i < n; i++) { arr[i * 3] = cc.r; arr[i * 3 + 1] = cc.g; arr[i * 3 + 2] = cc.b; }
      gg.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      gg.deleteAttribute('uv');
      return gg;
    };
    const treeGeos = [
      mergeGeometries([part(new THREE.CylinderGeometry(0.22, 0.34, 3.2, 6), 0x6b4a2f, 0, 1.6, 0), part(new THREE.IcosahedronGeometry(2.0, 1), 0x4aa052, 0, 4.3, 0), part(new THREE.IcosahedronGeometry(1.4, 1), 0x5cb85c, 0.6, 5.6, 0.3)])!,
      mergeGeometries([part(new THREE.CylinderGeometry(0.2, 0.3, 2.4, 6), 0x5a3d28, 0, 1.2, 0), part(new THREE.ConeGeometry(2.3, 3.4, 7), 0x2f7a48, 0, 3.4, 0), part(new THREE.ConeGeometry(1.8, 3.0, 7), 0x3a8a52, 0, 5.0, 0), part(new THREE.ConeGeometry(1.2, 2.6, 7), 0x4a9a5a, 0, 6.6, 0)])!,
      mergeGeometries([part(new THREE.CylinderGeometry(0.14, 0.22, 6.5, 6), 0x9a7a4a, 0, 3.2, 0), ...[0, 1, 2, 3, 4, 5].map((i) => part(new THREE.BoxGeometry(0.5, 0.08, 2.6).translate(0, 0, 1.3).rotateY(i * 1.047), 0x3fae52, 0, 6.6 - (i % 2) * 0.3, 0))])!,
    ];
    treeGeos.forEach((g) => track(g));
    const tMat = track(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradientMap() }));
    const rnd = mulberry32(99);
    const keep = gfx.trees;
    const byType: number[][] = [[], [], []];
    for (let i = 0; i < R.trees.length; i += 5) if (rnd() < keep || R.trees[i + 4] === 2) byType[R.trees[i + 4]].push(i);
    byType.forEach((list, type) => {
      const m = new Map<number, number[]>();
      for (const i of list) { const k = Math.floor((R.trees[i] + half) / 233) * 1000 + Math.floor((R.trees[i + 2] + half) / 233); (m.get(k) || m.set(k, []).get(k)!).push(i); }
      for (const idxs of m.values()) {
        const im = new THREE.InstancedMesh(treeGeos[type], tMat, idxs.length);
        idxs.forEach((i, n) => {
          const sc = R.trees[i + 3];
          pp.set(R.trees[i], R.trees[i + 1] - 0.2, R.trees[i + 2]); ss.set(sc, sc * (0.9 + rnd() * 0.3), sc);
          q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6.28);
          m4.compose(pp, q, ss); im.setMatrixAt(n, m4);
          const t = 0.85 + rnd() * 0.3; c.setRGB(t, t, t * (type === 1 && R.trees[i + 1] > 40 ? 1.15 : 1)); im.setColorAt(n, c);
        });
        im.castShadow = gfx.shadows && gfx.preset === 'high'; im.computeBoundingSphere();
        this.group.add(im); this.disposables.push({ dispose: () => im.dispose() });
      }
    });

    // water
    if (world.kind === 'island') {
      const cv = document.createElement('canvas'); cv.width = cv.height = 128;
      const cx = cv.getContext('2d')!;
      cx.fillStyle = '#7fd8f0'; cx.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 90; i++) { cx.strokeStyle = `rgba(255,255,255,${0.12 + Math.random() * 0.25})`; cx.lineWidth = 1 + Math.random() * 2; const x = Math.random() * 128, y = Math.random() * 128; cx.beginPath(); cx.moveTo(x, y); cx.quadraticCurveTo(x + 8, y - 5, x + 18, y); cx.stroke(); }
      this.waterTex = track(new THREE.CanvasTexture(cv)); this.waterTex.wrapS = this.waterTex.wrapT = THREE.RepeatWrapping; this.waterTex.repeat.set(300, 300); this.waterTex.colorSpace = THREE.SRGBColorSpace;
      this.water = new THREE.Mesh(track(new THREE.PlaneGeometry(6000, 6000).rotateX(-Math.PI / 2)), track(new THREE.MeshPhongMaterial({ color: 0x38c0e4, map: this.waterTex, transparent: true, opacity: 0.66, shininess: 90, specular: 0x99ddff, depthWrite: false })));
      this.water.position.y = -0.02; this.group.add(this.water);
    }

    // sky
    this.skyMat = track(new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color('#3a8dde') }, hor: { value: new THREE.Color('#bfe6ff') }, sun: { value: this.sunDir.clone() }, sunCol: { value: new THREE.Color('#fff3c4') } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 hor; uniform vec3 sun; uniform vec3 sunCol; varying vec3 vP; void main(){ float h = clamp(vP.y,0.0,1.0); vec3 c = mix(hor, top, pow(h,0.55)); float s = max(dot(normalize(vP), sun),0.0); c += sunCol*(pow(s,600.0)*2.0 + pow(s,12.0)*0.25); if(vP.y<0.0) c = hor; gl_FragColor = vec4(c,1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
    }));
    this.sky = new THREE.Mesh(track(new THREE.SphereGeometry(2000, 24, 12)), this.skyMat);
    this.sky.renderOrder = -10; this.sky.frustumCulled = false;
    scene.add(this.sky);
    this.fog = new THREE.Fog(0xbfe6ff, gfx.viewDist * 0.35, gfx.viewDist);
    scene.fog = this.fog;
    this.hemi = new THREE.HemisphereLight(0xcfe8ff, 0x7a8a5a, 1.1); scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff0d0, 2.4);
    this.sun.castShadow = gfx.shadows;
    this.sun.shadow.mapSize.set(gfx.shadowSize, gfx.shadowSize);
    const sc = this.sun.shadow.camera; sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 10; sc.far = 400;
    this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.05;
    scene.add(this.sun); scene.add(this.sun.target);

    // clouds
    const cg = track(new THREE.SphereGeometry(1, 8, 6));
    const cm = track(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92, fog: false }));
    const nc = world.kind === 'island' ? 110 : 40;
    this.clouds = new THREE.InstancedMesh(cg, cm, nc * 5);
    const r2 = mulberry32(5);
    let n = 0;
    for (let i = 0; i < nc; i++) {
      const cx2 = (r2() - 0.5) * 2200, cz2 = (r2() - 0.5) * 2200, cy2 = 200 + r2() * 110, s0 = 30 + r2() * 40;
      for (let k = 0; k < 5; k++) {
        pp.set(cx2 + (k - 2) * s0 * 0.7, cy2 + Math.sin(k * 2) * 6, cz2 + (r2() - 0.5) * s0 * 0.6); const s1 = s0 * (0.6 + r2() * 0.5); ss.set(s1, s1 * 0.38, s1 * 0.8);
        m4.compose(pp, q, ss); this.clouds.setMatrixAt(n++, m4);
      }
    }
    this.clouds.frustumCulled = false; this.disposables.push({ dispose: () => this.clouds.dispose() });
    scene.add(this.clouds);

    // zone walls
    const zc = document.createElement('canvas'); zc.width = 64; zc.height = 256;
    const zx = zc.getContext('2d')!;
    const gr = zx.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(80,170,255,0.0)'); gr.addColorStop(0.5, 'rgba(90,180,255,0.55)'); gr.addColorStop(1, 'rgba(120,210,255,0.9)');
    zx.fillStyle = gr; zx.fillRect(0, 0, 64, 256);
    zx.strokeStyle = 'rgba(255,255,255,0.35)'; zx.lineWidth = 2;
    for (let y = 0; y < 256; y += 32) { zx.beginPath(); zx.moveTo(0, y); zx.lineTo(32, y + 18); zx.lineTo(64, y); zx.stroke(); }
    this.zoneTex = track(new THREE.CanvasTexture(zc)); this.zoneTex.wrapS = this.zoneTex.wrapT = THREE.RepeatWrapping; this.zoneTex.repeat.set(60, 3);
    const wallGeo = track(new THREE.CylinderGeometry(1, 1, 400, 96, 1, true));
    this.zoneWall = new THREE.Mesh(wallGeo, track(new THREE.MeshBasicMaterial({ map: this.zoneTex, transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })));
    this.zoneWall.position.y = 150; this.zoneWall.frustumCulled = false; this.zoneWall.visible = world.kind === 'island';
    this.nextWall = new THREE.Mesh(wallGeo, track(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false, fog: false })));
    this.nextWall.position.y = 150; this.nextWall.frustumCulled = false; this.nextWall.visible = world.kind === 'island';
    scene.add(this.zoneWall); scene.add(this.nextWall);
  }

  update(g: Game, cam: THREE.Camera, focus: THREE.Vector3, dt: number) {
    this.sky.position.copy(cam.position);
    if (this.water) {
      this.water.position.x = Math.round(cam.position.x / 50) * 50; this.water.position.z = Math.round(cam.position.z / 50) * 50;
      this.waterTex!.offset.x += dt * 0.002; this.waterTex!.offset.y += dt * 0.0013;
    }
    // time of day drift (golden hour as the match progresses)
    const k = clamp(g.time / 1100, 0, 1);
    const elev = lerp(0.95, 0.38, k);
    this.sunDir.set(Math.cos(0.6) * Math.cos(elev), Math.sin(elev), Math.sin(0.6) * Math.cos(elev)).normalize();
    this.skyMat.uniforms.sun.value.copy(this.sunDir);
    this.skyMat.uniforms.hor.value.set('#bfe6ff').lerp(this.col.set('#ffcfa0'), k);
    this.skyMat.uniforms.top.value.set('#3a8dde').lerp(this.col.set('#6a62c0'), k * 0.8);
    this.fog.color.copy(this.skyMat.uniforms.hor.value);
    this.sun.color.set('#fff0d0').lerp(this.col.set('#ffb070'), k);
    this.sun.intensity = lerp(2.4, 1.9, k);
    this.sun.position.copy(focus).addScaledVector(this.sunDir, 160);
    this.sun.target.position.copy(focus);
    this.sun.target.updateMatrixWorld();
    // zone
    const z = g.zone;
    if (this.zoneWall.visible) {
      this.zoneWall.scale.set(z.r, 1, z.r); this.zoneWall.position.x = z.cx; this.zoneWall.position.z = z.cz;
      this.zoneTex.offset.y -= dt * 0.15;
      const showNext = !z.final && z.state === 'wait' || z.state === 'shrink';
      this.nextWall.visible = showNext;
      const tr = z.state === 'shrink' ? z.toR : z.nextR, tx = z.state === 'shrink' ? z.toCx : z.nextCx, tz = z.state === 'shrink' ? z.toCz : z.nextCz;
      this.nextWall.scale.set(tr, 1, tr); this.nextWall.position.x = tx; this.nextWall.position.z = tz;
    }
  }

  dispose() {
    this.scene.remove(this.group, this.sky, this.hemi, this.sun, this.sun.target, this.clouds, this.zoneWall, this.nextWall);
    this.scene.fog = null;
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }
}
