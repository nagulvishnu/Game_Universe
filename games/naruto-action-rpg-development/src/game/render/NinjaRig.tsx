import { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { LookDef, Pose } from '../types';

// ---------------------------------------------------------------- shared resources
const grad = (() => {
  const d = new Uint8Array([70, 70, 70, 255, 150, 150, 150, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
})();
const G = {
  head: new THREE.SphereGeometry(0.26, 18, 14),
  cap: new THREE.SphereGeometry(0.285, 16, 10, 0, Math.PI * 2, 0, 1.8),
  torso: new THREE.CapsuleGeometry(0.2, 0.3, 4, 12),
  limb: new THREE.CapsuleGeometry(0.075, 0.38, 3, 8),
  hand: new THREE.SphereGeometry(0.09, 8, 6),
  foot: new THREE.BoxGeometry(0.17, 0.1, 0.3),
  pelvis: new THREE.BoxGeometry(0.42, 0.22, 0.28),
  box: new THREE.BoxGeometry(1, 1, 1),
  spike: (() => { const g = new THREE.ConeGeometry(0.5, 1, 6); g.translate(0, 0.5, 0); return g; })(),
  torus: new THREE.TorusGeometry(0.27, 0.035, 6, 20),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 14, 1, true),
  cylSolid: new THREE.CylinderGeometry(1, 1, 1, 12),
  sphere: new THREE.SphereGeometry(1, 12, 10),
};
const outlineMat = new THREE.MeshBasicMaterial({ color: '#10101a', side: THREE.BackSide });
const eyeMat = new THREE.MeshBasicMaterial({ color: '#15151c' });
const whiteMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });

const toon = (c: string) => new THREE.MeshToonMaterial({ color: c, gradientMap: grad });

interface SpikeDef { pos: THREE.Vector3; quat: THREE.Quaternion; r: number; len: number }
function makeSpikes(style: LookDef['hairStyle']): SpikeDef[] {
  const out: SpikeDef[] = []; const up = new THREE.Vector3(0, 1, 0);
  const add = (az: number, el: number, len: number, r = 0.11) => {
    const d = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).normalize();
    out.push({ pos: d.clone().multiplyScalar(0.24), quat: new THREE.Quaternion().setFromUnitVectors(up, d), r, len });
  };
  const rnd = (i: number) => { const x = Math.sin(i * 91.7 + 3.1) * 43758.5; return x - Math.floor(x); };
  if (style === 'spiky') for (let i = 0; i < 12; i++) { const az = (i / 12) * Math.PI * 2; const front = Math.cos(az) > 0.75; add(az, front ? 0.9 : 0.35 + rnd(i) * 0.55, 0.36 + rnd(i + 5) * 0.14, 0.12); }
  else if (style === 'sasuke') { for (let i = 0; i < 8; i++) add(Math.PI + (i - 3.5) * 0.45, 0.25 + rnd(i) * 0.5, 0.4 + rnd(i + 2) * 0.12, 0.13); add(0.5, 0.9, 0.26, 0.08); add(-0.5, 0.9, 0.26, 0.08); add(0, 1.0, 0.22, 0.08); }
  else if (style === 'silver') for (let i = 0; i < 10; i++) add(Math.PI + (i - 4.5) * 0.5, 0.2 + rnd(i) * 0.55, 0.38 + rnd(i + 2) * 0.12, 0.13);
  else if (style === 'messy') for (let i = 0; i < 9; i++) add((i / 9) * Math.PI * 2, 0.5 + rnd(i) * 0.7, 0.2 + rnd(i + 3) * 0.12, 0.1);
  else if (style === 'spikyShort') for (let i = 0; i < 7; i++) add((i / 7) * Math.PI * 2, 0.6 + rnd(i) * 0.5, 0.18 + rnd(i + 3) * 0.1, 0.1);
  else if (style === 'long') for (let i = 0; i < 7; i++) add(Math.PI + (i - 3) * 0.5, 0.6 + rnd(i) * 0.5, 0.28, 0.14);
  return out;
}

interface Refs { root: THREE.Group; hips: THREE.Group; torso: THREE.Group; head: THREE.Group; aL: THREE.Group; aR: THREE.Group; lL: THREE.Group; lR: THREE.Group }

const damp = (cur: number, tgt: number, k: number) => cur + (tgt - cur) * k;
const ease = (x: number) => x * x * (3 - 2 * x);
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export function NinjaRig({ look, pose, forms = false, scaleMul = 1 }: { look: LookDef; pose: Pose; forms?: boolean; scaleMul?: number }) {
  const refs = useRef<Partial<Refs>>({});
  const st = useRef({ phase: 0, v: { hipY: 0.62, lean: 0, twist: 0, headX: 0, aLx: 0, aLz: 0.1, aRx: 0, aRz: -0.1, lLx: 0, lRx: 0, lLz: 0, lRz: 0, rotY: 0, rotX: 0, rotZ: 0, rootY: 0, sc: 1 }, alpha: 1, lastForm: 'base' });
  const sage = useRef<THREE.Group>(null); const kur = useRef<THREE.Group>(null); const aura = useRef<THREE.Mesh>(null); const tails = useRef<THREE.Group>(null);

  const spikes = useMemo(() => makeSpikes(look.hairStyle), [look.hairStyle]);
  const mats = useMemo(() => ({ skin: toon(look.skin), outfit: toon(look.outfit), trim: toon(look.trim), pants: toon(look.pants), hair: toon(look.hair), headband: toon(look.headband ?? '#222'), metal: toon('#c8d0dc'), dark: toon('#26262e') }), [look]);
  useEffect(() => () => { Object.values(mats).forEach((m) => m.dispose()); }, [mats]);
  const baseColors = useMemo(() => ({ outfit: new THREE.Color(look.outfit), hair: new THREE.Color(look.hair), pants: new THREE.Color(look.pants), trim: new THREE.Color(look.trim) }), [look]);
  const kuramaMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffb02e', transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), []);
  const tailMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffa81c', transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }), []);
  const sageMat = useMemo(() => toon('#b3321c'), []);
  const pigment = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ff8a1a' }), []);
  useEffect(() => () => { kuramaMat.dispose(); tailMat.dispose(); sageMat.dispose(); pigment.dispose(); }, [kuramaMat, tailMat, sageMat, pigment]);

  const setRef = (k: keyof Refs) => (o: THREE.Group | null) => { if (o) refs.current[k] = o; };
  const flashCol = useMemo(() => new THREE.Color(), []);

  useFrame((state, dtRaw) => {
    const r = refs.current as Refs; if (!r.root) return;
    const dt = Math.min(dtRaw, 0.05); const s = st.current; const v = s.v; const time = state.clock.elapsedTime;
    const sp = Math.min(1.5, pose.speed); s.phase += dt * (6 + sp * 7) * (pose.speed > 0.05 ? 1 : 0);
    const ph = s.phase; const k = clamp01(pose.t / Math.max(0.05, pose.dur)); const var4 = pose.variant % 4;
    let hipY = 0.62, lean = 0, twist = 0, headX = 0, aLx = Math.sin(time * 1.4) * 0.05, aLz = 0.1, aRx = Math.sin(time * 1.4 + 1) * 0.05, aRz = -0.1, lLx = 0, lRx = 0, lLz = 0.02, lRz = -0.02, rotY = 0, rotX = 0, rotZ = 0, rootY = 0, sc = 1 + Math.sin(time * 2.2) * 0.012;
    let fast = 16;
    switch (pose.state) {
      case 'run': { const sw = Math.sin(ph); lLx = sw * 0.95 * Math.min(1, sp + 0.2); lRx = -sw * 0.95 * Math.min(1, sp + 0.2); aLx = -sw * 0.9 * Math.min(1, sp + 0.2); aRx = sw * 0.9 * Math.min(1, sp + 0.2); lean = 0.12 + 0.22 * sp; hipY += Math.abs(Math.cos(ph)) * 0.05 * sp; aLz = 0.15; aRz = -0.15; sc = 1; break; }
      case 'jump': lLx = -0.6; lRx = 0.35; aLx = -1.9; aRx = -1.7; aLz = 0.5; aRz = -0.5; lean = -0.05; sc = 1; break;
      case 'air': lean = 0.8; lLx = 0.5; lRx = 0.5; aLx = -2.4; aRx = -2.4; hipY = 0.7; fast = 28; sc = 1; break;
      case 'attack': {
        fast = 34; sc = 1; const e = ease(k); const rise = ease(clamp01(k / 0.4));
        if (pose.style === 'swordsman') { const a = var4 % 2 === 0 ? 1 : -1; aRx = -2.7 + rise * 2.4; aRz = -0.2 - a * 0.5 + rise * a * 0.8; twist = a * (-0.7 + rise * 1.4); lean = 0.25; lRx = -0.3; lLx = 0.4; aLx = 0.4; }
        else if (pose.style === 'heavy') { aRx = 0.9 - e * 2.7; aLx = 0.3 - e * 0.5; twist = (var4 % 2 ? 1 : -1) * (-0.6 + e * 1.2); lean = 0.35 * e; lRx = -0.4 * e; }
        else if (pose.style === 'ranged') { aLx = aRx = -1.5; aLz = 0.35; aRz = -0.35; lean = 0.1; }
        else if (pose.style === 'kicker' && var4 < 2) { const sw = Math.sin(Math.PI * k); if (var4 === 0) { lRx = -1.6 * sw; aLx = -0.6 * sw; aRx = 0.8 * sw; } else { lLx = -1.6 * sw; aRx = -0.6 * sw; aLx = 0.8 * sw; } lean = -0.15 * sw; twist = (var4 ? 0.4 : -0.4) * sw; hipY -= 0.04 * sw; }
        else if (var4 === 0) { aRx = 0.7 - e * 2.25; twist = 0.55 - e * 1.1; lean = 0.2; aLx = 0.5; lLx = 0.3; lRx = -0.3; }
        else if (var4 === 1) { aLx = 0.7 - e * 2.25; twist = -0.55 + e * 1.1; lean = 0.2; aRx = 0.5; lRx = 0.3; lLx = -0.3; }
        else if (var4 === 2) { const sw = Math.sin(Math.PI * k); lRx = -1.55 * sw; lean = -0.15 * sw; aLx = -0.4; aRx = 0.7 * sw; twist = -0.4 * sw; }
        else { rotY = k * Math.PI * 2; aLz = 1.35; aRz = -1.35; lRx = -1.1 * Math.sin(Math.PI * k); lean = 0.15; aLx = aRx = -0.2; }
        break;
      }
      case 'heavy': { fast = 26; sc = 1; const w = clamp01(k / 0.45); const s2 = ease(clamp01((k - 0.45) / 0.15)); aLx = aRx = -2.9 * w * (1 - s2) - 0.3 * s2; lean = -0.22 * w * (1 - s2) + 0.55 * s2; aLz = 0.15; aRz = -0.15; lLx = 0.3 * w; lRx = -0.5 * s2; hipY -= 0.06 * s2; break; }
      case 'windup': { fast = 22; sc = 1; const w = ease(clamp01(k * 1.3)); aRx = -2.6 * w; aLx = -0.6 * w; lean = -0.2 * w; twist = -0.3 * w; lLx = 0.3 * w; lRx = -0.2 * w; headX = -0.1; break; }
      case 'cast': { fast = 22; sc = 1; const tr = Math.sin(time * 40) * 0.03; aLx = -1.35 + tr; aRx = -1.35 - tr; aLz = 0.45; aRz = -0.45; lean = 0.05; lLz = 0.12; lRz = -0.12; break; }
      case 'orb': { fast = 22; sc = 1; aRx = -1.5; aRz = -0.15; aLx = 0.3; aLz = 0.5; lean = 0.15; lLx = 0.5; lRx = -0.5; twist = -0.25; hipY -= 0.05; break; }
      case 'charge': { sc = 1; hipY -= 0.12; lLz = 0.38; lRz = -0.38; aLz = 0.75; aRz = -0.75; aLx = aRx = 0.1; lean = 0.05; rotZ = Math.sin(time * 38) * 0.02; headX = -0.35; break; }
      case 'dodge': { fast = 30; sc = 1; lean = 0.95; lLx = 0.8; lRx = -0.6; aLx = 1.1; aRx = 0.8; hipY -= 0.18; rootY = 0.0; break; }
      case 'hit': { fast = 30; sc = 1; lean = -0.55; aLx = -0.6; aRx = 0.7; aLz = 0.8; aRz = -0.8; headX = -0.4; lLx = -0.3; lRx = 0.3; break; }
      case 'stun': { sc = 1; rotZ = Math.sin(time * 11) * 0.14; lean = 0.2; headX = 0.3; aLx = aRx = 0.3; aLz = 0.3; aRz = -0.3; break; }
      case 'block': { sc = 1; aLx = aRx = -1.25; aLz = -0.6; aRz = 0.6; lean = 0.1; hipY -= 0.07; lLx = 0.3; lRx = -0.3; break; }
      case 'dead': { fast = 14; sc = 1; const e = ease(clamp01(pose.t / 0.55)); rotX = -1.5 * e; rootY = 0.17 * e; aLx = -0.4 * e; aRx = 0.3 * e; aLz = 0.9; aRz = -0.9; break; }
      default: break;
    }
    const kk = 1 - Math.exp(-fast * dt);
    v.hipY = damp(v.hipY, hipY, kk); v.lean = damp(v.lean, lean, kk); v.twist = damp(v.twist, twist, kk); v.headX = damp(v.headX, headX, kk);
    v.aLx = damp(v.aLx, aLx, kk); v.aRx = damp(v.aRx, aRx, kk); v.aLz = damp(v.aLz, aLz, kk); v.aRz = damp(v.aRz, aRz, kk);
    v.lLx = damp(v.lLx, lLx, kk); v.lRx = damp(v.lRx, lRx, kk); v.lLz = damp(v.lLz, lLz, kk); v.lRz = damp(v.lRz, lRz, kk);
    v.rotX = damp(v.rotX, rotX, kk); v.rotZ = damp(v.rotZ, rotZ, kk); v.rootY = damp(v.rootY, rootY, kk); v.sc = damp(v.sc, sc, kk);
    v.rotY = pose.state === 'attack' && var4 === 3 && pose.style !== 'swordsman' && pose.style !== 'heavy' && pose.style !== 'ranged' && !(pose.style === 'kicker' && var4 < 2) ? rotY : damp(v.rotY, 0, kk);
    r.hips.position.y = v.hipY; r.hips.rotation.set(0, 0, 0);
    r.torso.rotation.set(v.lean, v.twist, 0); r.torso.scale.y = v.sc;
    r.head.rotation.set(v.headX - v.lean * 0.5, -v.twist * 0.6, 0);
    r.aL.rotation.set(v.aLx, 0, v.aLz); r.aR.rotation.set(v.aRx, 0, v.aRz);
    r.lL.rotation.set(v.lLx, 0, v.lLz); r.lR.rotation.set(v.lRx, 0, v.lRz);
    r.root.rotation.set(v.rotX, v.rotY, v.rotZ); r.root.position.y = v.rootY;

    // flash + transparency
    const fl = pose.flash; flashCol.set(pose.flashColor).multiplyScalar(fl);
    const form = pose.form;
    if (form !== s.lastForm) {
      s.lastForm = form;
      const gold = form === 'kurama';
      mats.outfit.color.copy(gold ? flashCol.set('#ffb02a') : baseColors.outfit); mats.hair.color.copy(gold ? flashCol.set('#ffe36a') : baseColors.hair);
      mats.pants.color.copy(gold ? flashCol.set('#ffa51c') : baseColors.pants); mats.trim.color.copy(gold ? flashCol.set('#3a2200') : baseColors.trim);
      if (forms) { if (sage.current) sage.current.visible = form === 'sage'; if (kur.current) kur.current.visible = form === 'kurama'; }
    }
    const glow = form === 'kurama' ? 0.55 : form === 'sage' ? 0.12 : 0;
    flashCol.set(pose.flashColor).multiplyScalar(fl); flashCol.r += glow; flashCol.g += glow * 0.7; flashCol.b += glow * 0.1;
    mats.skin.emissive.copy(flashCol); mats.outfit.emissive.copy(flashCol); mats.pants.emissive.copy(flashCol); mats.hair.emissive.copy(flashCol); mats.trim.emissive.copy(flashCol);
    const a = pose.alpha;
    if (Math.abs(a - s.alpha) > 0.001) {
      const tr = a < 0.99; s.alpha = a;
      for (const m of [mats.skin, mats.outfit, mats.pants, mats.hair, mats.trim, mats.headband, mats.metal, mats.dark]) { if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; } m.opacity = a; }
    }
    if (forms && form === 'kurama') {
      if (aura.current) { aura.current.scale.set(0.9 + Math.sin(time * 6) * 0.04, 1.35, 0.9); }
      if (tails.current) tails.current.children.forEach((c, i) => { c.rotation.z = Math.sin(time * 3 + i) * 0.25 + (i - 1.5) * 0.45; c.rotation.x = -0.9 + Math.sin(time * 2 + i * 1.7) * 0.2; });
    }
  });

  const S = (look.scale ?? 1) * scaleMul;
  const hb = look.headband;
  const showMask = look.mask; const eyeCol = look.eye ?? '#15151c';
  return (
    <group scale={S}>
      <group ref={setRef('root')}>
        <group ref={setRef('hips')} position={[0, 0.62, 0]}>
          <mesh geometry={G.pelvis} material={mats.pants} castShadow />
          {/* legs */}
          {[-1, 1].map((sd) => (
            <group key={sd} ref={setRef(sd < 0 ? 'lL' : 'lR')} position={[sd * 0.11, -0.04, 0]}>
              <mesh geometry={G.limb} material={mats.pants} position={[0, -0.27, 0]} castShadow />
              <mesh geometry={G.foot} material={mats.dark} position={[0, -0.57, 0.05]} />
              <mesh geometry={G.box} material={mats.headband} position={[0, -0.18, 0]} scale={[0.17, 0.1, 0.17]} />
            </group>
          ))}
          <group ref={setRef('torso')} position={[0, 0.08, 0]}>
            <mesh geometry={G.torso} material={mats.outfit} position={[0, 0.32, 0]} scale={[1.12, 1, 0.78]} castShadow />
            <mesh geometry={G.torso} material={outlineMat} position={[0, 0.32, 0]} scale={[1.2, 1.07, 0.86]} />
            <mesh geometry={G.box} material={mats.trim} position={[0, 0.02, 0]} scale={[0.46, 0.07, 0.3]} />
            <mesh geometry={G.box} material={mats.trim} position={[0, 0.6, 0.02]} scale={[0.5, 0.06, 0.28]} />
            <mesh geometry={G.box} material={mats.trim} position={[-0.27, 0.58, 0]} scale={[0.17, 0.1, 0.2]} />
            <mesh geometry={G.box} material={mats.trim} position={[0.27, 0.58, 0]} scale={[0.17, 0.1, 0.2]} />
            {look.back === 'gourd' && (<group position={[0, 0.4, -0.3]}><mesh geometry={G.sphere} material={mats.trim} scale={[0.3, 0.38, 0.3]} /><mesh geometry={G.sphere} material={mats.dark} position={[0, 0.34, 0]} scale={[0.1, 0.08, 0.1]} /></group>)}
            {look.back === 'scroll' && (<mesh geometry={G.cylSolid} material={mats.trim} position={[0, 0.36, -0.27]} rotation={[0, 0, Math.PI / 2]} scale={[0.1, 0.8, 0.1]} />)}
            {look.weapon === 'bigSword' && (<group position={[0.1, 0.35, -0.24]} rotation={[0, 0, -0.5]}><mesh geometry={G.box} material={mats.metal} scale={[0.34, 1.5, 0.06]} position={[0, 0.2, 0]} /><mesh geometry={G.box} material={mats.dark} scale={[0.06, 0.4, 0.06]} position={[0, -0.7, 0]} /></group>)}
            {look.cloak && (<group>
              <mesh geometry={G.cyl} material={mats.dark} position={[0, 0.05, 0]} scale={[0.33, 1.05, 0.28]} />
              <mesh geometry={G.cyl} material={mats.dark} position={[0, 0.78, 0]} scale={[0.2, 0.3, 0.2]} />
              {look.cloakClouds && [0, 1, 2, 3, 4].map((i) => (<mesh key={i} geometry={G.sphere} material={mats.trim} position={[Math.sin(i * 1.3) * 0.31, -0.2 + (i % 2) * 0.3, Math.cos(i * 1.3) * 0.27]} scale={[0.07, 0.1, 0.03]} rotation={[0, i * 1.3, 0]} />))}
            </group>)}
            {forms && (<group ref={sage} visible={false}>
              <mesh geometry={G.cyl} material={sageMat} position={[0, 0.0, 0]} scale={[0.36, 1.1, 0.3]} />
              <mesh geometry={G.cyl} material={mats.dark} position={[0, -0.5, 0]} scale={[0.41, 0.1, 0.34]} />
              <mesh geometry={G.cyl} material={mats.dark} position={[0, 0.62, 0]} scale={[0.26, 0.14, 0.22]} />
            </group>)}
            {forms && (<group ref={kur} visible={false}>
              <mesh ref={aura} geometry={G.sphere} material={kuramaMat} position={[0, 0.3, 0]} scale={[1, 1.4, 1]} />
              <group ref={tails} position={[0, 0.05, -0.2]}>
                {[0, 1, 2, 3].map((i) => (<group key={i}><mesh geometry={G.spike} material={tailMat} position={[0, 0, -0.1]} scale={[0.22, 1.15, 0.22]} /><mesh geometry={G.spike} material={tailMat} position={[0, 0.9, -0.1]} scale={[0.13, 0.5, 0.13]} /></group>))}
              </group>
            </group>)}
            {/* arms */}
            {[-1, 1].map((sd) => (
              <group key={sd} ref={setRef(sd < 0 ? 'aL' : 'aR')} position={[sd * 0.31, 0.56, 0]}>
                <mesh geometry={G.limb} material={mats.outfit} position={[0, -0.26, 0]} castShadow />
                <mesh geometry={G.hand} material={mats.skin} position={[0, -0.55, 0]} />
                <mesh geometry={G.box} material={mats.headband} position={[0, -0.43, 0]} scale={[0.17, 0.07, 0.17]} />
                {sd > 0 && look.weapon === 'kunai' && (<mesh geometry={G.box} material={mats.metal} position={[0, -0.62, 0.1]} scale={[0.03, 0.2, 0.06]} rotation={[0.6, 0, 0]} />)}
                {sd > 0 && look.weapon === 'sword' && (<group position={[0, -0.55, 0.04]} rotation={[0.5, 0, 0]}><mesh geometry={G.box} material={mats.metal} position={[0, 0.5, 0]} scale={[0.05, 0.9, 0.025]} /><mesh geometry={G.box} material={mats.dark} position={[0, 0.02, 0]} scale={[0.1, 0.03, 0.05]} /></group>)}
                {sd > 0 && look.weapon === 'bigSword' && (<group position={[0, -0.55, 0.05]} rotation={[0.4, 0, 0]}><mesh geometry={G.box} material={mats.metal} position={[0, 0.8, 0]} scale={[0.32, 1.5, 0.07]} /><mesh geometry={G.box} material={mats.dark} position={[0, 0.0, 0]} scale={[0.07, 0.38, 0.07]} /></group>)}
              </group>
            ))}
            {/* head */}
            <group ref={setRef('head')} position={[0, 0.92, 0]}>
              <mesh geometry={G.head} material={mats.skin} castShadow />
              <mesh geometry={G.head} material={outlineMat} scale={1.08} />
              <mesh geometry={G.box} material={eyeMat} position={[-0.095, 0.0, 0.238]} scale={[0.065, 0.085, 0.03]} />
              <mesh geometry={G.box} material={eyeMat} position={[0.095, 0.0, 0.238]} scale={[0.065, 0.085, 0.03]} />
              <mesh geometry={G.box} material={whiteMat} position={[-0.085, 0.015, 0.252]} scale={[0.02, 0.025, 0.01]} />
              <mesh geometry={G.box} material={whiteMat} position={[0.105, 0.015, 0.252]} scale={[0.02, 0.025, 0.01]} />
              {(look.eye || look.sharingan) && <mesh geometry={G.box} material={look.sharingan ? new THREE.MeshBasicMaterial({ color: '#d82020' }) : new THREE.MeshBasicMaterial({ color: eyeCol })} position={[0.095, 0, 0.255]} scale={[0.05, 0.06, 0.01]} />}
              {look.brows && [-1, 1].map((sd) => <mesh key={sd} geometry={G.box} material={eyeMat} position={[sd * 0.095, 0.09, 0.235]} scale={[0.12, 0.045, 0.04]} />)}
              {look.whiskers && [-1, 1].map((sd) => [0, 1, 2].map((i) => <mesh key={`${sd}${i}`} geometry={G.box} material={eyeMat} position={[sd * 0.17, -0.07 + i * 0.03, 0.2]} rotation={[0, sd * 0.5, sd * (i - 1) * 0.25]} scale={[0.09, 0.012, 0.01]} />))}
              {showMask && <mesh geometry={G.box} material={mats.dark} position={[0, -0.1, 0.18]} scale={[0.38, 0.16, 0.14]} />}
              {look.bandage && <mesh geometry={G.box} material={whiteMat} position={[0, -0.1, 0.19]} scale={[0.4, 0.15, 0.13]} />}
              {/* orange sage pigment */}
              {forms && <group>{[-1, 1].map((sd) => <mesh key={sd} geometry={G.box} material={pigment} position={[sd * 0.1, 0.09, 0.232]} scale={[0.1, 0.03, 0.02]} />)}</group>}
              {/* hair */}
              {look.hairStyle !== 'none' && look.hairStyle !== 'hood' && <mesh geometry={G.cap} material={mats.hair} rotation={[-0.25, 0, 0]} castShadow />}
              {spikes.map((sp, i) => <mesh key={i} geometry={G.spike} material={mats.hair} position={sp.pos} quaternion={sp.quat} scale={[sp.r * 2, sp.len, sp.r * 2]} />)}
              {look.hairStyle === 'bob' && (<group><mesh geometry={G.box} material={mats.hair} position={[-0.25, -0.05, 0]} scale={[0.1, 0.34, 0.4]} /><mesh geometry={G.box} material={mats.hair} position={[0.25, -0.05, 0]} scale={[0.1, 0.34, 0.4]} /><mesh geometry={G.box} material={mats.hair} position={[0, -0.02, -0.22]} scale={[0.46, 0.4, 0.14]} /></group>)}
              {look.hairStyle === 'long' && <mesh geometry={G.box} material={mats.hair} position={[0, -0.25, -0.2]} scale={[0.5, 0.85, 0.16]} />}
              {look.hairStyle === 'bowl' && (<group><mesh geometry={G.box} material={mats.hair} position={[0, 0.17, 0.2]} scale={[0.5, 0.1, 0.12]} /><mesh geometry={G.box} material={mats.hair} position={[-0.26, -0.02, 0.0]} scale={[0.08, 0.3, 0.3]} /><mesh geometry={G.box} material={mats.hair} position={[0.26, -0.02, 0.0]} scale={[0.08, 0.3, 0.3]} /></group>)}
              {look.hairStyle === 'hood' && (<group><mesh geometry={G.cylSolid} material={mats.trim} position={[0, 0.27, 0]} scale={[0.3, 0.2, 0.3]} /><mesh geometry={G.cylSolid} material={mats.outfit} position={[0, 0.4, 0]} scale={[0.2, 0.18, 0.2]} /><mesh geometry={G.box} material={mats.hair} position={[0, 0.05, -0.2]} scale={[0.42, 0.3, 0.1]} /></group>)}
              {/* headband */}
              {hb && (<group><mesh geometry={G.torus} material={mats.headband} position={[0, 0.1, 0]} rotation={[Math.PI / 2 - 0.1, 0, 0]} scale={1.02} />
                <mesh geometry={G.box} material={mats.metal} position={[0, 0.1, 0.27]} scale={[0.2, 0.11, 0.025]} />{look.headbandSlash && <mesh geometry={G.box} material={mats.dark} position={[0, 0.1, 0.285]} rotation={[0, 0, 0.7]} scale={[0.22, 0.015, 0.01]} />}</group>)}
              {forms && <group />}
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
