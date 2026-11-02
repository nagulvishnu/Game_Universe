import { useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bloom, ChromaticAberration, EffectComposer, Noise, Vignette } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { film } from './film/runtime';
import { CHARACTERS } from './story/characters';
import { CharacterModel } from './characters/CharacterModel';
import { shotPose } from './camera/director';
import { Environment } from './world/Environments';
import { LightRig, Sky, Weather } from './world/Sky';
import { Effects } from './world/Effects';

function Sim() {
  useFrame((_, dt) => film.update(dt));
  return null;
}

/** Cinematic camera: executes the director's shot every frame with cuts, glides and shake. */
function CameraRig() {
  const { camera } = useThree();
  const last = useRef({ cuts: -1, pos: new THREE.Vector3(0, 3, 10), look: new THREE.Vector3(0, 1.4, 0) });
  const tmp = useRef(new THREE.Vector3());
  useFrame((_, dt0) => {
    const dt = Math.min(dt0, 0.1);
    if (!film.scene) return;
    const pose = shotPose(film.shot, film.shotT, film.envData, film.headOf, film.facingOf, film.allHeads);
    const L = last.current; const cam = camera as THREE.PerspectiveCamera;
    if (L.cuts !== film.shotCuts) { L.cuts = film.shotCuts; L.pos.set(...pose.pos); L.look.set(...pose.look); cam.fov = pose.fov; }
    else {
      const kp = 1 - Math.exp(-dt * 5), kl = 1 - Math.exp(-dt * 7);
      L.pos.lerp(tmp.current.set(...pose.pos), kp); L.look.lerp(tmp.current.set(...pose.look), kl); cam.fov += (pose.fov - cam.fov) * kp;
    }
    const sh = film.env.shake * 0.18;
    cam.position.set(L.pos.x + (Math.random() - 0.5) * sh, L.pos.y + (Math.random() - 0.5) * sh, L.pos.z + (Math.random() - 0.5) * sh);
    cam.lookAt(L.look); cam.updateProjectionMatrix();
  });
  return null;
}

function Post({ quality }: { quality: 'cinematic' | 'performance' }) {
  if (quality === 'performance') return null;
  return (
    <EffectComposer multisampling={0}>
      <Bloom intensity={0.7} luminanceThreshold={0.82} luminanceSmoothing={0.3} mipmapBlur />
      <ChromaticAberration offset={new THREE.Vector2(0.0005, 0.0005)} blendFunction={BlendFunction.NORMAL} radialModulation={false} modulationOffset={0} />
      <Noise opacity={0.035} blendFunction={BlendFunction.SOFT_LIGHT} />
      <Vignette offset={0.28} darkness={0.7} />
    </EffectComposer>
  );
}

export default function Stage({ quality }: { quality: 'cinematic' | 'performance' }) {
  return (
    <Canvas shadows dpr={[1, quality === 'cinematic' ? 1.5 : 1]} camera={{ fov: 40, near: 0.1, far: 900, position: [0, 3, 10] }}
      gl={{ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true }} id="film-canvas">
      <Sim />
      <LightRig />
      <Sky />
      <Weather />
      <Environment />
      {CHARACTERS.map((c) => <CharacterModel key={c.id} id={c.id} />)}
      <Effects />
      <CameraRig />
      <Post quality={quality} />
    </Canvas>
  );
}
