import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Game } from '../engine/Game';
import { Input } from '../engine/player';
import { GfxSettings } from '../data/config';
import { WorldRenderer } from './worldRenderer';
import { EntityRenderer } from './entityRenderer';
import { disposeCaches } from './materials';
import { audio } from '../audio/audio';
import { current, useStore } from '../state/store';

function Loop({ game, input }: { game: Game; input: Input }) {
  const { scene, camera } = useThree();
  const refs = useRef<{ w: WorldRenderer; e: EntityRenderer } | null>(null);
  const acc = useRef(0);
  const focus = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const gfx = useStore.getState().settings.gfx;

  useEffect(() => {
    const w = new WorldRenderer(scene, game.world, gfx);
    const e = new EntityRenderer(scene, game, gfx);
    refs.current = { w, e };
    return () => { e.dispose(); w.dispose(); disposeCaches(); refs.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game]);

  useFrame((_, delta) => {
    const r = refs.current;
    if (!r) return;
    const st = useStore.getState();
    input.blocked = st.overlay !== 'none';
    game.paused = st.overlay === 'pause';
    game.opts.sens = st.settings.sens; game.opts.autoPickup = st.settings.autoPickup;
    const dt = game.paused ? 0 : Math.min(delta, 0.05);
    game.update(dt, input);
    input.endFrame();
    const pose = game.pose!;
    const p = game.player;
    let hideId = pose.hideSubject ? pose.subject.id : -1;
    if (game.ended && game.winner === p && p.alive) {
      const a = game.time * 0.45;
      camera.position.set(p.pos.x + Math.sin(a) * 3.6 + Math.sin(p.bodyYaw) * 1.5, p.pos.y + 1.5, p.pos.z + Math.cos(a) * 3.6 + Math.cos(p.bodyYaw) * 1.5);
      look.set(p.pos.x, p.pos.y + 1.3, p.pos.z);
      camera.lookAt(look);
      if ((camera as THREE.PerspectiveCamera).fov !== 55) { (camera as THREE.PerspectiveCamera).fov = 55; (camera as THREE.PerspectiveCamera).updateProjectionMatrix(); }
      hideId = -1;
    } else {
      camera.position.copy(pose.pos);
      look.copy(pose.pos).add(pose.dir);
      camera.lookAt(look);
      const pc = camera as THREE.PerspectiveCamera;
      if (Math.abs(pc.fov - pose.fov) > 0.05) { pc.fov = pose.fov; pc.updateProjectionMatrix(); }
    }
    focus.set(pose.subject.pos.x, pose.subject.pos.y, pose.subject.pos.z);
    r.w.update(game, camera, focus, dt);
    r.e.update(dt, camera.position, hideId);
    audio.update(game, camera.position, pose.subject.yaw);
    acc.current += delta;
    if (acc.current > 0.09) { acc.current = 0; useStore.setState({ hud: game.snapshot() }); }
  });
  return null;
}

export function GameCanvas({ game }: { game: Game }) {
  const input = useMemo(() => new Input(), [game]);
  const gfx: GfxSettings = useStore.getState().settings.gfx;
  useEffect(() => {
    current.input = input;
    return () => { input.dispose(); if (current.input === input) current.input = null; };
  }, [input]);
  return (
    <Canvas
      dpr={Math.min(window.devicePixelRatio || 1, 1.75) * gfx.resolution}
      shadows={gfx.shadows}
      gl={{ antialias: gfx.preset !== 'low', powerPreference: 'high-performance' }}
      camera={{ fov: 72, near: 0.1, far: gfx.viewDist + 400 }}
      onCreated={({ gl }) => {
        gl.setClearColor('#bfe6ff');
        input.attach(gl.domElement);
        const el = gl.domElement;
        el.addEventListener('click', () => {
          const st = useStore.getState();
          if (st.overlay === 'none' && !input.locked) input.lock();
        });
        document.addEventListener('pointerlockchange', () => {
          const st = useStore.getState();
          if (!document.pointerLockElement && st.overlay === 'none' && st.screen === 'playing' && current.game && !current.game.ended && current.game.player.alive) st.setOverlay('pause');
        });
      }}
    >
      <Loop game={game} input={input} />
    </Canvas>
  );
}
