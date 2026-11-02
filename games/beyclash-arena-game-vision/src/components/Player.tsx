import { useFrame, useThree } from '@react-three/fiber';
import { useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { PLAYER_LOOKS } from '../data/player';
import { audio } from '../game/audio/audio';
import { runtime } from '../game/runtime';
import { useGame } from '../game/store';
import { rayFreeDistance, resolveMove } from '../game/world/collision';
import { WORLD } from '../game/world/layout';
import { Character, type AnimState } from './Character';

const has = (...k: string[]) => k.some((x) => runtime.keys.has(x));

export function Player({ anim }: { anim: MutableRefObject<AnimState> }) {
  const group = useRef<THREE.Group>(null);
  const outfit = useGame((s) => s.save.profile.outfit);
  const look = PLAYER_LOOKS[outfit % PLAYER_LOOKS.length].look;
  const { camera } = useThree();
  const st = useRef({ vx: 0, vz: 0, y: 0, vy: 0, grounded: true, yaw: 0, step: 0, camDist: 7, wasAir: false, init: false });

  useFrame((_, dt0) => {
    const dt = Math.min(dt0, 0.05);
    const s = st.current;
    const g = group.current;
    if (!g) return;
    if (!s.init) { s.init = true; s.yaw = runtime.yaw; }
    const store = useGame.getState();
    const blocked = !!store.overlay || store.curtain.state === 'in';
    runtime.inputBlocked = blocked;

    // ----- movement relative to camera -----
    const fwd = blocked ? 0 : (has('KeyW', 'ArrowUp') ? 1 : 0) - (has('KeyS', 'ArrowDown') ? 1 : 0);
    const rgt = blocked ? 0 : (has('KeyD', 'ArrowRight') ? 1 : 0) - (has('KeyA', 'ArrowLeft') ? 1 : 0);
    const cy = runtime.camYaw;
    let wx = -Math.sin(cy) * fwd + Math.cos(cy) * rgt;
    let wz = -Math.cos(cy) * fwd - Math.sin(cy) * rgt;
    const wl = Math.hypot(wx, wz);
    if (wl > 0) { wx /= wl; wz /= wl; }
    const sprint = has('ShiftLeft', 'ShiftRight') && wl > 0;
    const walk = has('ControlLeft', 'AltLeft') && !sprint;
    const speed = sprint ? 11 : walk ? 3.2 : 6.6;
    const k = 1 - Math.exp(-dt * (s.grounded ? 11 : 3));
    s.vx += (wx * speed - s.vx) * k;
    s.vz += (wz * speed - s.vz) * k;

    if (!blocked && s.grounded && has('Space')) { s.vy = 8; s.grounded = false; audio.jump(); }
    s.vy -= 24 * dt;
    s.y += s.vy * dt;
    if (s.y <= 0) { s.y = 0; if (!s.grounded && s.vy < -3) { anim.current.land = 0.22; audio.land(); } s.vy = 0; s.grounded = true; }

    const p = runtime.pos;
    const r = resolveMove(p.x + s.vx * dt, p.z + s.vz * dt, 0.45);
    p.x = Math.max(WORLD.minX, Math.min(WORLD.maxX, r.x));
    p.z = Math.max(WORLD.minZ, Math.min(WORLD.maxZ, r.z));

    const sp = Math.hypot(s.vx, s.vz);
    if (sp > 0.6) {
      const target = Math.atan2(s.vx, s.vz);
      let d = target - s.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      s.yaw += d * (1 - Math.exp(-dt * 12));
    }
    if (s.grounded && sp > 1.5) {
      s.step += sp * dt;
      if (s.step > (sprint ? 3.4 : 2.6)) { s.step = 0; audio.footstep(sprint || !walk); }
    }
    runtime.moving = sp > 0.6;
    runtime.sprinting = sprint;

    const a = anim.current;
    a.speed = Math.min(1, sp / 11);
    a.mode = sp < 0.6 ? 0 : sprint ? 3 : walk ? 1 : 2;
    a.air = !s.grounded; a.vy = s.vy;
    a.land = Math.max(0, a.land - dt); a.wave = Math.max(0, a.wave - dt);
    g.position.set(p.x, s.y, p.z);
    g.rotation.y = s.yaw;
    runtime.yaw = s.yaw;

    // ----- camera (spring arm with wall avoidance) -----
    const cp = runtime.pitch;
    const tx = p.x, ty = s.y * 0.6 + 1.5, tz = p.z;
    const want = runtime.zoom;
    const dirx = Math.sin(cy) * Math.cos(cp), diry = Math.sin(cp), dirz = Math.cos(cy) * Math.cos(cp);
    const free = rayFreeDistance(tx, tz, tx + dirx * want, tz + dirz * want);
    const dist = Math.max(1.3, Math.min(want, free - 0.2));
    s.camDist += (dist - s.camDist) * (1 - Math.exp(-dt * (dist < s.camDist ? 20 : 4)));
    camera.position.set(tx + dirx * s.camDist, Math.max(0.5, ty + diry * s.camDist), tz + dirz * s.camDist);
    camera.lookAt(tx, ty + 0.1, tz);
  });

  return (
    <group ref={group}>
      <Character look={look} anim={anim} />
    </group>
  );
}
