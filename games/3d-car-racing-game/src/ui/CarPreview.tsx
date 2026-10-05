import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { buildCar, type CarModel } from "../game/carModel";
import type { CarDef } from "../game/data";

interface Props {
  def: CarDef;
  color: number;
  className?: string;
  accent?: number;
  zoom?: number;
}

interface Handle {
  setCar: (d: CarDef, c: number) => void;
  setColor: (c: number) => void;
  dispose: () => void;
}

export default function CarPreview({ def, color, className = "", accent = 0x22d3ee, zoom = 1 }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const handle = useRef<Handle | null>(null);
  const latest = useRef({ def, color });
  latest.current = { def, color };

  useEffect(() => {
    const el = host.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "none";
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
    scene.environment = envTex;
    scene.environmentIntensity = 0.95;

    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    const lookAt = new THREE.Vector3(0, 0.75, 0);

    scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x202030, 0.5));
    const key = new THREE.DirectionalLight(0xffffff, 2.6);
    key.position.set(4, 8, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -5;
    key.shadow.camera.right = 5;
    key.shadow.camera.top = 5;
    key.shadow.camera.bottom = -5;
    scene.add(key);
    const rim1 = new THREE.PointLight(accent, 90, 20, 2);
    rim1.position.set(-5, 2.5, -4);
    scene.add(rim1);
    const rim2 = new THREE.PointLight(0xff3da6, 70, 20, 2);
    rim2.position.set(5, 2, -4);
    scene.add(rim2);

    // platform
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x0c0f18, roughness: 0.35, metalness: 0.6 });
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.4, 0.2, 64), floorMat);
    floor.position.y = -0.1;
    floor.receiveShadow = true;
    scene.add(floor);
    const ringMat = new THREE.MeshBasicMaterial({ color: accent });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4.25, 0.04, 8, 96), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.0;
    scene.add(ring);

    const turntable = new THREE.Group();
    scene.add(turntable);

    let model: CarModel | null = null;
    let curColor = latest.current.color;
    const setCar = (d: CarDef, c: number) => {
      if (model) {
        turntable.remove(model.group);
        model.dispose();
      }
      curColor = c;
      model = buildCar(d, c, 7);
      model.group.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
      });
      turntable.add(model.group);
    };
    setCar(latest.current.def, latest.current.color);

    const resize = () => {
      const w = el.clientWidth || 300;
      const h = el.clientHeight || 300;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      const dist = (w / h < 1 ? 17 : 12.5) / zoom;
      camera.position.set(dist * 0.62, dist * 0.2, dist * 0.78);
      camera.lookAt(lookAt);
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    // drag to rotate
    let dragging = false;
    let lastX = 0;
    let vel = 0;
    const down = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      turntable.rotation.y += dx * 0.011;
      vel = dx * 0.011;
    };
    const up = () => {
      dragging = false;
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!dragging) {
        vel *= Math.exp(-dt * 3);
        turntable.rotation.y += dt * 0.55 + vel * 0.5;
      }
      if (model) {
        for (const w of model.wheels) if (w.front) w.pivot.rotation.y = Math.sin(now / 900) * 0.18;
      }
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);

    handle.current = {
      setCar,
      setColor: (c) => {
        curColor = c;
        model?.setColor(c);
      },
      dispose: () => {},
    };
    void curColor;

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      model?.dispose();
      floor.geometry.dispose();
      floorMat.dispose();
      ring.geometry.dispose();
      ringMat.dispose();
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      handle.current = null;
    };
  }, [accent, zoom]);

  useEffect(() => {
    handle.current?.setCar(def, latest.current.color);
  }, [def]);
  useEffect(() => {
    handle.current?.setColor(color);
  }, [color]);

  return <div ref={host} className={className} />;
}
