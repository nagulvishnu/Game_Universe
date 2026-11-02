import { useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { initEngine, tick } from "./game/engine";
import { G } from "./game/core";
import { useGame } from "./store";

function Engine() {
  const { gl, scene, camera, size } = useThree();
  const composer = useRef<EffectComposer | null>(null);
  const bloom = useRef<UnrealBloomPass | null>(null);
  useEffect(() => {
    initEngine({ scene, camera: camera as THREE.PerspectiveCamera, gl });
    const rt = new THREE.WebGLRenderTarget(size.width, size.height, { type: THREE.HalfFloatType, samples: 4 });
    const c = new EffectComposer(gl, rt);
    c.addPass(new RenderPass(scene, camera));
    const b = new UnrealBloomPass(new THREE.Vector2(size.width * 0.5, size.height * 0.5), 0.5, 0.6, 0.86);
    c.addPass(b);
    c.addPass(new OutputPass());
    composer.current = c;
    bloom.current = b;
    return () => { c.dispose(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const c = composer.current;
    if (!c) return;
    c.setPixelRatio(gl.getPixelRatio());
    c.setSize(size.width, size.height);
    bloom.current?.resolution.set(size.width * 0.5, size.height * 0.5);
  }, [size, gl]);
  const errs = useRef(0);
  useFrame((_, d) => {
    try { tick(d); } catch (e) { if (errs.current++ < 5) console.error("tick error", e); }
  }, 0);
  useFrame(() => {
    const c = composer.current;
    if (!c) { gl.render(scene, camera); return; }
    if (bloom.current) bloom.current.enabled = !!G.postBloom;
    c.render();
  }, 1);
  return null;
}

export default function Game() {
  const quality = useGame((s) => s.settings.quality);
  const ov = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    G.overlay = ov.current;
    const fit = () => {
      if (!ov.current) return;
      ov.current.width = window.innerWidth;
      ov.current.height = window.innerHeight;
    };
    fit();
    window.addEventListener("resize", fit);
    return () => { window.removeEventListener("resize", fit); G.overlay = null; };
  }, []);
  const dpr = quality === "low" ? 0.75 : quality === "medium" ? 1 : Math.min(1.5, window.devicePixelRatio || 1);
  return (
    <div className="absolute inset-0 bg-black">
      <Canvas
        dpr={dpr}
        shadows={quality === "high"}
        gl={{ antialias: false, powerPreference: "high-performance", alpha: false }}
        camera={{ fov: 70, near: 0.1, far: 3500, position: [0, 6, 30] }}
        onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.05; }}
        style={{ position: "absolute", inset: 0 }}
      >
        <Engine />
      </Canvas>
      <canvas ref={ov} className="pointer-events-none absolute inset-0 h-full w-full" />
    </div>
  );
}
