import * as THREE from 'three';
import { ArenaDef, Elem } from './types';
import { glowTex, lavaTex, runeTex, stoneTex } from './textures';
import { vfx } from './vfx';

export interface Destr { x: number; z: number; r: number; hp: number; max: number; mesh: THREE.Object3D; alive: boolean }
export interface ArenaApi { hazard: (x: number, z: number, r: number, dmg: number, elem: Elem) => void; px: number; pz: number; shakeCam: (a: number) => void }
export interface Arena {
  group: THREE.Group; obstacles: { x: number; z: number; r: number }[]; destructibles: Destr[]; radius: number; edge: 'wall' | 'void';
  update: (dt: number, t: number, api: ArenaApi) => void;
}

const std = (color: number, rough = .8, metal = .1, em = 0, ei = 1) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, emissive: em, emissiveIntensity: em ? ei : 0 });
const addM = (c: number, op = .6, map?: THREE.Texture) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, map: map ?? null });
const rep = (t: THREE.Texture, x: number, y: number) => { const c = t.clone(); c.needsUpdate = true; c.wrapS = c.wrapT = THREE.RepeatWrapping; c.repeat.set(x, y); return c; };
function sky(def: ArenaDef) {
  const m = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(def.sky[0]) }, bot: { value: new THREE.Color(def.sky[1]) } },
    vertexShader: 'varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform vec3 top;uniform vec3 bot;varying vec3 vP;void main(){float h=clamp(normalize(vP).y*1.4+.15,0.,1.);gl_FragColor=vec4(mix(bot,top,pow(h,.7)),1.);}' });
  const s = new THREE.Mesh(new THREE.SphereGeometry(320, 24, 14), m); s.renderOrder = -10; return s;
}
function stars(n: number, hex = 0xffffff) {
  const p = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, e = Math.random() * 1.3 + .1, r = 300; p[i * 3] = Math.cos(a) * Math.cos(e) * r; p[i * 3 + 1] = Math.sin(e) * r; p[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); return new THREE.Points(g, new THREE.PointsMaterial({ color: hex, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: .8 }));
}
function pillar(h: number, r: number, broken: boolean, mat: THREE.Material, shadow: boolean) {
  const g = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, y: number, m = mat) => { const o = new THREE.Mesh(geo, m); o.position.y = y; o.castShadow = shadow; o.receiveShadow = true; g.add(o); return o; };
  add(new THREE.BoxGeometry(r * 2.6, h * .06, r * 2.6), h * .03); add(new THREE.CylinderGeometry(r * .85, r, h * (broken ? .8 : .92), 10), h * .06 + h * (broken ? .4 : .46));
  if (!broken) { add(new THREE.BoxGeometry(r * 2.5, h * .05, r * 2.5), h * .98); } else { const f = add(new THREE.ConeGeometry(r * .85, h * .22, 5), h * .9); f.rotation.z = .15; f.scale.set(1, 1, .8); for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(new THREE.DodecahedronGeometry(r * .5, 0), mat); c.position.set((Math.random() - .5) * 3 * r, r * .3, (Math.random() - .5) * 3 * r); c.rotation.set(Math.random() * 3, Math.random() * 3, 0); g.add(c); } }
  return g;
}
function floor(R: number, tex: THREE.Texture, color = 0xffffff, rough = .85, em = 0, emMap?: THREE.Texture) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(R, 72).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tex, color, roughness: rough, metalness: .15, emissive: em, emissiveMap: emMap ?? null, emissiveIntensity: em ? 1 : 0 }));
  m.receiveShadow = true; return m;
}
function embers(count: number, R: number, hex: number, speed = 1) {
  const pos = new Float32Array(count * 3), ph = new Float32Array(count);
  for (let i = 0; i < count; i++) { pos[i * 3] = (Math.random() - .5) * R * 2.4; pos[i * 3 + 1] = Math.random() * 14; pos[i * 3 + 2] = (Math.random() - .5) * R * 2.4; ph[i] = Math.random() * 6; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ color: hex, size: .16, transparent: true, opacity: .85, blending: THREE.AdditiveBlending, depthWrite: false, map: glowTex() }));
  p.frustumCulled = false;
  return { obj: p, update: (t: number, dt: number) => { for (let i = 0; i < count; i++) { pos[i * 3 + 1] += dt * (.8 + (ph[i] % 1)) * speed; pos[i * 3] += Math.sin(t + ph[i]) * dt * .4; if (pos[i * 3 + 1] > 14) pos[i * 3 + 1] = 0; } (g.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true; } };
}
const firePoint = (hex: number, size = 2) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: hex, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false })); s.scale.setScalar(size); return s; };

export function buildArena(def: ArenaDef, q: 'low' | 'medium' | 'high'): Arena {
  const group = new THREE.Group(), R = def.radius, hi = q !== 'low', sh = q === 'high';
  const obstacles: Arena['obstacles'] = [], destructibles: Destr[] = [], anim: ((dt: number, t: number, api: ArenaApi) => void)[] = [];
  group.add(sky(def)); let edge: 'wall' | 'void' = 'wall';
  const ringRand = (n: number, r0: number, r1: number, f: (x: number, z: number, i: number, a: number) => void) => { for (let i = 0; i < n; i++) { const a = (i / n) * 6.283 + (i % 2) * .05, r = r0 + (r1 - r0) * ((i * 7 % 5) / 4); f(Math.cos(a) * r, Math.sin(a) * r, i, a); } };

  if (def.id === 'citadel') {
    group.add(stars(220, 0xffd0d0));
    const fl = floor(R + 6, rep(stoneTex('#2a2024', '#120a0e', '#ff3040'), R / 3, R / 3), 0xffffff, .8, 0x330008, rep(stoneTex('#000', '#000', '#ff2040'), R / 3, R / 3)); group.add(fl);
    const ring = new THREE.Mesh(new THREE.RingGeometry(R - .4, R + .3, 72).rotateX(-Math.PI / 2), addM(0xff2040, .8)); ring.position.y = .04; group.add(ring);
    const rune = new THREE.Mesh(new THREE.CircleGeometry(R * .55, 48).rotateX(-Math.PI / 2), addM(0xff2a44, .35, runeTex())); rune.position.y = .03; group.add(rune);
    const stone = std(0x3a3036, .9, .1);
    ringRand(hi ? 14 : 9, R * .88, R * .93, (x, z, i) => { const p = pillar(7 + (i % 3) * 2.5, .9, i % 3 === 1, stone, sh); p.position.set(x, 0, z); group.add(p); });
    ringRand(6, R * .45, R * .62, (x, z, i) => { const p = pillar(4 + (i % 3) * 1.4, .75, true, stone, sh); p.position.set(x, 0, z); group.add(p); obstacles.push({ x, z, r: 1.05 }); });
    if (hi) ringRand(6, R * 1.0, R * 1.0, (x, z, _i, a) => { const arch = new THREE.Mesh(new THREE.TorusGeometry(3, .45, 8, 14, Math.PI), stone); arch.position.set(x, 7, z); arch.rotation.y = -a + Math.PI / 2; arch.castShadow = sh; group.add(arch); const sp = new THREE.Mesh(new THREE.ConeGeometry(.9, 9, 5), stone); sp.position.set(x * 1.05, 11, z * 1.05); group.add(sp); });
    const banners: THREE.Mesh[] = [];
    ringRand(8, R * .82, R * .82, (x, z, _i, a) => { const b = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 4, 1, 6), std(0x8a0f20, .9, 0, 0x400008, .5)); b.material.side = THREE.DoubleSide; b.geometry.translate(0, -2, 0); b.position.set(x, 6.5, z); b.rotation.y = -a + Math.PI / 2; group.add(b); banners.push(b); });
    const moon = new THREE.Mesh(new THREE.SphereGeometry(22, 24, 16), new THREE.MeshBasicMaterial({ color: 0xff3a3a, fog: false })); moon.position.set(-130, 120, -190); group.add(moon);
    const mg = firePoint(0xff2020, 140); mg.position.copy(moon.position).multiplyScalar(.98); (mg.material as THREE.SpriteMaterial).fog = false; group.add(mg);
    ringRand(4, R * .72, R * .72, (x, z, i) => { const br = new THREE.Group(); const bowl = new THREE.Mesh(new THREE.CylinderGeometry(.5, .3, .5, 8), std(0x222)); bowl.position.y = 1.2; const post = new THREE.Mesh(new THREE.CylinderGeometry(.08, .1, 1.2, 6), std(0x222)); post.position.y = .6; const f = firePoint(0xff6a20, 2.4); f.position.y = 1.7; br.add(bowl, post, f); br.position.set(x, 0, z); group.add(br); anim.push((_d, t) => { f.scale.setScalar(2.2 + Math.sin(t * 9 + i) * .35); }); });
    const em = embers(hi ? 160 : 70, R, 0xff5030); group.add(em.obj); anim.push((dt, t) => { em.update(t, dt); banners.forEach((b, i) => { b.rotation.x = Math.sin(t * 1.5 + i) * .08; }); rune.rotation.y = t * .05; (ring.material as THREE.MeshBasicMaterial).opacity = .6 + Math.sin(t * 2) * .2; });
  } else if (def.id === 'forge') {
    const fl = floor(R, rep(stoneTex('#1a1614', '#0a0807', '#ff6a10'), R / 3, R / 3), 0xffffff, .7, 0x2a0800, rep(stoneTex('#000', '#000', '#ff6a10'), R / 3, R / 3)); group.add(fl);
    const lt = rep(lavaTex(), 10, 10); const lava = new THREE.Mesh(new THREE.RingGeometry(R - .2, R + 28, 72, 1).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: lt, emissive: 0xffffff, emissiveMap: lt, emissiveIntensity: 1.4, roughness: .6, color: 0x884422 })); lava.position.y = -.5; group.add(lava);
    const edgeM = new THREE.Mesh(new THREE.TorusGeometry(R, .5, 8, 72).rotateX(Math.PI / 2), std(0x2a2220, .6, .5, 0x601800, .6)); edgeM.position.y = -.1; group.add(edgeM);
    for (const a of [.7, 2.9]) { const r = new THREE.Mesh(new THREE.PlaneGeometry(7, R * 2.6, 1, 1).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: lt, emissive: 0xffffff, emissiveMap: lt, emissiveIntensity: 1.2, color: 0x996633 })); r.position.y = -.4; r.rotation.y = a; r.scale.set(1, 1, 1); group.add(r); }
    const dk = std(0x1c1816, .5, .7);
    ringRand(4, R + 4, R + 5, (x, z, i, a) => { const f = new THREE.Group(); const body = new THREE.Mesh(new THREE.BoxGeometry(7, 8, 5), dk); body.position.y = 4; const door = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.8), addM(0xff7a20, .95)); door.position.set(0, 2.6, 2.55); const ch = new THREE.Mesh(new THREE.CylinderGeometry(.9, 1.3, 7, 8), dk); ch.position.set(2, 11, 0); const gl = firePoint(0xff6a10, 12); gl.position.set(0, 3, 4); f.add(body, door, ch, gl); f.position.set(x * 1.05, 0, z * 1.05); f.rotation.y = -a + Math.PI / 2; f.children.forEach(c => { c.castShadow = false; }); group.add(f); anim.push((_d, t) => { gl.scale.setScalar(11 + Math.sin(t * 3 + i) * 1.4); (door.material as THREE.MeshBasicMaterial).opacity = .85 + Math.sin(t * 6 + i) * .1; }); });
    for (const [x, z] of [[-9, 6], [10, -7]]) { const an = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 1.2), dk); b.position.y = 1.2; const t2 = new THREE.Mesh(new THREE.BoxGeometry(3.2, .5, 1.1), dk); t2.position.y = 2; const h2 = new THREE.Mesh(new THREE.CylinderGeometry(.5, 1, 1.2, 6), dk); h2.position.y = .6; an.add(b, t2, h2); an.position.set(x, 0, z); group.add(an); obstacles.push({ x, z, r: 1.6 }); }
    const vents = [[7, 5], [-8, -4], [3, -12], [-12, 8], [12, 11], [-3, 13]].map(([x, z]) => ({ x, z, t: 2 + Math.random() * 5, st: 0 }));
    const ventMeshes = vents.map(v => { const m = new THREE.Mesh(new THREE.CircleGeometry(1.4, 20).rotateX(-Math.PI / 2), addM(0xff5a10, .55)); m.position.set(v.x, .05, v.z); group.add(m); return m; });
    const emb = embers(hi ? 200 : 80, R, 0xff8a30, 1.6); group.add(emb.obj);
    anim.push((dt, t, api) => {
      lt.offset.set(t * .015, t * .01); emb.update(t, dt);
      vents.forEach((v, i) => {
        v.t -= dt; const m = ventMeshes[i].material as THREE.MeshBasicMaterial;
        if (v.st === 0) { m.opacity = .3 + Math.sin(t * 3 + i) * .1; if (v.t <= 0) { v.st = 1; v.t = 1.3; vfx.telegraph([v.x, 0, v.z], 2.1, 1.3, 0xff6a10); } }
        else if (v.st === 1) { m.opacity = .6 + Math.sin(t * 20) * .3; if (v.t <= 0) { v.st = 2; v.t = .7; vfx.pillar('fire', new THREE.Vector3(v.x, 0, v.z), 3); vfx.burst('fire', new THREE.Vector3(v.x, 0, v.z), 3.2); api.hazard(v.x, v.z, 2.0, 14, 'fire'); api.shakeCam(.12); } }
        else { m.opacity = 1; if (v.t <= 0) { v.st = 0; v.t = 4 + Math.random() * 5; } }
      });
    });
  } else if (def.id === 'sanctuary') {
    edge = 'void'; group.add(stars(500, 0xe0c8ff));
    const fl = floor(R, rep(stoneTex('#14102a', '#2a1850', '#a24bff'), R / 4, R / 4), 0x9988cc, .25, 0x120830, rep(stoneTex('#000', '#000', '#b070ff'), R / 4, R / 4)); fl.position.y = 0; group.add(fl);
    const under = new THREE.Mesh(new THREE.ConeGeometry(R, 16, 16, 1, true).rotateX(Math.PI), std(0x1a1030, .8, .2, 0x200a40, .3)); under.position.y = -8; group.add(under);
    const rune = new THREE.Mesh(new THREE.CircleGeometry(R * .9, 64).rotateX(-Math.PI / 2), addM(0xa24bff, .5, rep(runeTex(), 1, 1))); rune.position.y = .04; group.add(rune);
    const rim = new THREE.Mesh(new THREE.RingGeometry(R - .5, R, 72).rotateX(-Math.PI / 2), addM(0xc08aff, .9)); rim.position.y = .05; group.add(rim);
    const rocks: THREE.Mesh[] = []; const rm = std(0x241a3a, .7, .3, 0x180a30, .4);
    for (let i = 0; i < (hi ? 18 : 9); i++) { const a = Math.random() * 6.28, r = R + 4 + Math.random() * 28; const rk = new THREE.Mesh(new THREE.DodecahedronGeometry(1 + Math.random() * 3.2, 0), rm); rk.position.set(Math.cos(a) * r, -4 + Math.random() * 18, Math.sin(a) * r); rk.rotation.set(Math.random() * 3, Math.random() * 3, 0); group.add(rk); rocks.push(rk); }
    const portals: THREE.Group[] = [];
    ringRand(4, R + 3, R + 3, (x, z, _i, a) => { const p = new THREE.Group(); const tr = new THREE.Mesh(new THREE.TorusGeometry(3.4, .22, 8, 40), addM(0xc08aff, .95)); const disc = new THREE.Mesh(new THREE.CircleGeometry(3.3, 32), addM(0x7a2aff, .5, runeTex())); const bm = new THREE.Mesh(new THREE.CylinderGeometry(.2, .5, 40, 8, 1, true).translate(0, 20, 0), addM(0xa24bff, .12)); p.add(tr, disc, bm); p.position.set(x, 4.5, z); p.rotation.y = -a - Math.PI / 2; group.add(p); portals.push(p); });
    const mono = std(0x2a1a50, .15, .6, 0x4a1a90, 1.2);
    ringRand(4, R * .5, R * .62, (x, z, i) => { const m = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), mono); m.scale.set(.8, 2.6 + (i % 2), .8); m.position.set(x, 2.6, z); m.castShadow = sh; group.add(m); obstacles.push({ x, z, r: 1 }); const gl = firePoint(0xa24bff, 4); gl.position.set(x, 3, z); group.add(gl); });
    const em = embers(hi ? 160 : 70, R, 0xc08aff, .6); group.add(em.obj);
    anim.push((dt, t) => { rune.rotation.y = t * .08; em.update(t, dt); rocks.forEach((r, i) => { r.position.y += Math.sin(t * .7 + i) * dt * .5; r.rotation.y += dt * .1; }); portals.forEach((p, i) => { (p.children[1] as THREE.Mesh).rotation.z = t * (i % 2 ? 1 : -1); p.children[0].rotation.z = t * .5; }); (rim.material as THREE.MeshBasicMaterial).opacity = .7 + Math.sin(t * 2) * .2; });
  } else {
    group.add(stars(120, 0xaabbff));
    const tx = rep(stoneTex('#4a463e', '#2a2620'), R / 4, R / 4); group.add(floor(R, tx, 0xffffff, .9));
    for (const r of [R * .33, R * .66, R * .98]) { const rg = new THREE.Mesh(new THREE.RingGeometry(r - .15, r + .15, 72).rotateX(-Math.PI / 2), addM(0x6ab0ff, .35)); rg.position.y = .04; group.add(rg); }
    const wallM = std(0x5a564e, .9, .05);
    for (let i = 0; i < 4; i++) { const w = new THREE.Mesh(new THREE.CylinderGeometry(R + 2 + i * 3.4, R + 2 + i * 3.4, 3 + i * 3.2, 56, 1, true), wallM); (w.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide; w.position.y = (3 + i * 3.2) / 2; w.receiveShadow = true; group.add(w); }
    ringRand(hi ? 16 : 10, R + 1.5, R + 1.5, (x, z, i) => { const p = pillar(10 + (i % 2) * 2, 1, i % 5 === 3, wallM, sh); p.position.set(x, 0, z); group.add(p); });
    const obM = std(0x2a2e3a, .3, .7, 0x3a80ff, .6);
    ringRand(6, R * .4, R * .62, (x, z, i) => { const o = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(1.2, 4.2, 1.2), obM); b.position.y = 2.1; b.castShadow = sh; const tp = new THREE.Mesh(new THREE.ConeGeometry(.85, 1.2, 4), obM); tp.position.y = 4.8; tp.rotation.y = .78; const gl = firePoint(0x4da8ff, 4); gl.position.y = 2.5; o.add(b, tp, gl); o.position.set(x, 0, z); group.add(o); destructibles.push({ x, z, r: 1.1, hp: 45, max: 45, mesh: o, alive: true }); void i; });
    const nRain = hi ? 420 : 160, rp = new Float32Array(nRain * 6); const rg = new THREE.BufferGeometry();
    const rainReset = (i: number) => { const x = (Math.random() - .5) * R * 2.6, z = (Math.random() - .5) * R * 2.6, y = Math.random() * 30; rp.set([x, y, z, x - .15, y - 1.2, z], i * 6); };
    for (let i = 0; i < nRain; i++) rainReset(i);
    rg.setAttribute('position', new THREE.BufferAttribute(rp, 3)); const rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0x9ac4ff, transparent: true, opacity: .3 })); rain.frustumCulled = false; group.add(rain);
    const clouds = new THREE.Mesh(new THREE.CircleGeometry(200, 20).rotateX(Math.PI / 2), addM(0x1a2438, .8)); clouds.position.y = 60; (clouds.material as THREE.MeshBasicMaterial).blending = THREE.NormalBlending; group.add(clouds);
    let nextStrike = 3, flashT = 0; const queue: { x: number; z: number; t: number }[] = [];
    const sheet = new THREE.AmbientLight(0x99bbff, 0); group.add(sheet);
    anim.push((dt, _t, api) => {
      for (let i = 0; i < nRain; i++) { rp[i * 6 + 1] -= dt * 28; rp[i * 6 + 4] -= dt * 28; if (rp[i * 6 + 1] < 0) rainReset(i); } (rg.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      nextStrike -= dt; if (nextStrike <= 0) { nextStrike = 3 + Math.random() * 3.5; const near = Math.random() < .55, a = Math.random() * 6.28, d = near ? Math.random() * 6 : Math.random() * R * .8; const x = near ? api.px + Math.cos(a) * d : Math.cos(a) * d, z = near ? api.pz + Math.sin(a) * d : Math.sin(a) * d; queue.push({ x, z, t: 1.1 }); vfx.telegraph([x, 0, z], 2.3, 1.1, 0x66b8ff); }
      for (let i = queue.length - 1; i >= 0; i--) { const s = queue[i]; s.t -= dt; if (s.t <= 0) { queue.splice(i, 1); vfx.lightning(new THREE.Vector3(s.x, 0, s.z), 'lightning', 2.2); api.hazard(s.x, s.z, 2.2, 16, 'lightning'); api.shakeCam(.14); flashT = .25; } }
      sheet.intensity = flashT > 0 ? (flashT -= dt) * 16 : 0;
    });
  }
  return { group, obstacles, destructibles, radius: R, edge, update: (dt, t, api) => { for (const a of anim) a(dt, t, api); } };
}
