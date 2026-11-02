import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { STADIUM_MAP } from '../data/stadiums';
import { audio } from '../game/audio/audio';
import { AIController, DIFF_PARAMS, hashString } from '../game/battle/ai/ai';
import { live } from '../game/battle/live';
import { BATTLE_CFG, BattleSim, type Command } from '../game/battle/physics/sim';
import { computeStats } from '../game/customization/stats';
import { runtime } from '../game/runtime';
import { useGame, type BattleSetup } from '../game/store';
import { BeybladeModel, makeHandle } from './BeybladeModel';
import { fx, FxLayer } from './Fx';
import { Stadium, dishY } from './Stadium';

const KEYS = { up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'] };
const down = (ks: string[]) => ks.some((k) => runtime.keys.has(k));

export function BattleScene() {
  const battle = useGame((s) => s.battle);
  if (!battle) return null;
  return <BattleInner key={battle.key} setup={battle.setup} />;
}

function BattleInner({ setup }: { setup: BattleSetup }) {
  const def = STADIUM_MAP[setup.stadium] ?? STADIUM_MAP.arena;
  const quality = useGame((s) => s.settings.quality);
  const { scene, camera } = useThree();
  const stats = useMemo(() => [computeStats(setup.playerBey), computeStats(setup.opponent.bey)] as const, [setup]);
  const sim = useMemo(() => new BattleSim([stats[0], stats[1]], def), [stats, def]);
  const ai = useMemo(() => new AIController({ strategy: setup.opponent.strategy, difficulty: setup.opponent.difficulty, seed: hashString(setup.battleId) }), [setup]);
  const h0 = useRef(makeHandle());
  const h1 = useRef(makeHandle());
  const S = useRef({ phase: 'intro' as 'intro' | 'countdown' | 'fight' | 'finish' | 'done', t: 0, acc: 0, shake: 0, slow: 1, finishT: 0, dash: false, trail: 0, camT: 0, lastCount: 4, lowWarned: false });
  const cmd = useMemo<[Command, Command]>(() => [{ mx: 0, mz: 0, dash: false }, { mx: 0, mz: 0, dash: false }], []);
  const camTarget = useMemo(() => new THREE.Vector3(), []);
  const camPos = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    live.reset();
    fx.clear();
    (window as unknown as Record<string, unknown>).__cam = camera; // debug hook
    (window as unknown as Record<string, unknown>).__sim = sim;
    live.oppStrategy = setup.opponent.strategy;
    const prevBg = scene.background, prevFog = scene.fog;
    scene.environmentIntensity = 0.3;
    scene.background = new THREE.Color(def.sky).multiplyScalar(0.35);
    scene.fog = new THREE.Fog(new THREE.Color(def.sky).multiplyScalar(0.35), 40, 120);
    audio.music('battle');
    audio.ambient(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const s = S.current;
      if (e.code === 'Space') {
        e.preventDefault();
        if (s.phase === 'countdown' && !live.meterLocked) { live.meterLocked = true; live.power = Math.max(0, 1 - Math.abs(live.meter - 0.5) * 2.2); audio.click(); }
        else if (s.phase === 'fight') s.dash = true;
        else if (s.phase === 'intro') live.skipIntro = true;
      }
      if ((e.code === 'Enter') && s.phase === 'intro') live.skipIntro = true;
    };
    const onClick = () => { if (S.current.phase === 'intro') live.skipIntro = true; };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onClick);
      scene.background = prevBg; scene.fog = prevFog;
      audio.spinLoop(false);
    };
  }, [scene, def, setup, camera, sim]);

  useFrame((_, dt0) => {
    const dt = Math.min(dt0, 0.05);
    const s = S.current;
    const R = def.radius;
    s.t += dt;
    s.camT += dt;
    const store = useGame.getState();

    if (s.phase === 'intro') {
      live.introT = s.t;
      if (s.t > 4.6 || (live.skipIntro && s.t > 0.4)) { s.phase = 'countdown'; s.t = 0; store.setPhase('countdown'); audio.announce(); }
    } else if (s.phase === 'countdown') {
      live.countT = s.t;
      if (!live.meterLocked) { const m = (s.t * 0.95) % 2; live.meter = m < 1 ? m : 2 - m; }
      const c = 3 - Math.floor(s.t / 0.9);
      if (c !== s.lastCount && c >= 1) { s.lastCount = c; live.count = c; audio.countdown(false); }
      if (s.t >= 2.8) {
        if (!live.meterLocked) { live.power = 0.45; live.meterLocked = true; }
        sim.tops[0].stamina = 88 + 12 * live.power;
        sim.tops[1].stamina = 88 + 12 * DIFF_PARAMS[setup.opponent.difficulty].launch;
        live.count = 0; s.phase = 'fight'; s.t = 0; store.setPhase('fight');
        audio.countdown(true); audio.launch();
        for (const t of sim.tops) { fx.ring(t.x, 0.6, t.z, '#ffffff', 4, 0.5); fx.burst(t.x, 0.7, t.z, '#ffe08a', 24, 7); }
        s.shake = 0.35;
      }
    }

    if (s.phase === 'fight' || s.phase === 'finish') {
      s.acc += dt * s.slow;
      let n = 0;
      while (s.acc >= BATTLE_CFG.dt && n < 6) {
        s.acc -= BATTLE_CFG.dt; n++;
        if (s.phase === 'fight') {
          cmd[0].mx = (down(KEYS.right) ? 1 : 0) - (down(KEYS.left) ? 1 : 0);
          cmd[0].mz = (down(KEYS.down) ? 1 : 0) - (down(KEYS.up) ? 1 : 0);
          cmd[0].dash = s.dash; s.dash = false;
          if (cmd[0].mx || cmd[0].mz) live.moved = true;
          const o = ai.think(sim.tops[1], sim.tops[0], sim, BATTLE_CFG.dt);
          cmd[1].mx = o.mx; cmd[1].mz = o.mz; cmd[1].dash = o.dash;
        }
        sim.step(cmd);
      }
      // events
      for (const e of sim.drainEvents()) {
        if (e.type === 'collision') {
          fx.burst(e.x, 0.8, e.z, '#ffd070', 6 + Math.round(e.strength), 4 + e.strength * 0.5);
          fx.ring(e.x, 0.55, e.z, '#ffffff', 2 + e.strength * 0.18, 0.35);
          s.shake = Math.max(s.shake, Math.min(0.6, e.strength * 0.045));
          audio.collide(e.strength);
          live.collided = true; live.hits++;
        } else if (e.type === 'wall') {
          fx.burst(e.x, 0.9, e.z, '#8fe6ff', 6, 3); audio.wall(); s.shake = Math.max(s.shake, 0.08);
        } else if (e.type === 'dash') {
          fx.burst(e.x, 0.5, e.z, e.top === 0 ? '#ff9bd0' : '#9bd0ff', 10, 3, 0.1, 0.4, 0); audio.dash();
          if (e.top === 0) live.dashed = true;
        } else if (e.type === 'burst') {
          fx.burst(e.x, 1, e.z, '#ffb13a', 50, 11, 0.2, 1.1); fx.burst(e.x, 1, e.z, '#ffffff', 25, 7, 0.16, 0.8);
          fx.ring(e.x, 0.8, e.z, '#ffb13a', 9, 0.9); s.shake = 0.9; s.slow = 0.3; audio.burst();
        } else if (e.type === 'ringout') {
          fx.ring(e.x, 0.8, e.z, '#ff4a3a', 6, 0.8); s.shake = 0.4; s.slow = 0.45; audio.ringout();
        } else if (e.type === 'spinout') {
          audio.spinout(); s.slow = 0.6;
        }
      }
      if (sim.result && s.phase === 'fight') {
        s.phase = 'finish'; s.finishT = 0;
        live.finish = { finish: sim.result.finish, winner: sim.result.winner };
        store.setPhase('finish');
        audio.spinLoop(false);
      }
      if (s.phase === 'finish') {
        s.finishT += dt;
        s.slow = Math.min(1, s.slow + dt * 0.5);
        if (s.finishT > 3.0) {
          s.phase = 'done';
          const res = sim.result!;
          if (res.winner === 0) audio.win(); else audio.lose();
          store.finishBattle(res);
        }
      }
      if (s.phase === 'fight') {
        const avg = (sim.tops[0].stamina + sim.tops[1].stamina) / 200;
        audio.spinLoop(true, avg);
      }
    }

    // live HUD values
    live.time = sim.time;
    live.stamina[0] = sim.tops[0].stamina; live.stamina[1] = sim.tops[1].stamina;
    live.burst[0] = sim.tops[0].burst; live.burst[1] = sim.tops[1].burst;
    live.dashCd = sim.tops[0].dashCd;
    if (sim.tops[0].stamina < BATTLE_CFG.lowStamina && s.phase === 'fight' && !s.lowWarned) { s.lowWarned = true; live.lowFlash = 2.5; }
    live.lowFlash = Math.max(0, live.lowFlash - dt);

    // --- visuals ---
    const hs = [h0.current, h1.current];
    const bt = sim.postTime;
    const res = sim.result;
    s.trail += dt;
    for (let i = 0; i < 2; i++) {
      const t = sim.tops[i];
      const h = hs[i];
      if (!h.root || !h.spin) continue;
      const r = Math.hypot(t.x, t.z);
      let y = dishY(r, R) + 0.06;
      if (t.out) { const over = Math.max(0, r - (R - 0.35)); y -= 0.12 * over * over; }
      h.root.position.set(t.x, y + (s.phase === 'intro' ? 0.35 + Math.sin(s.camT * 3 + i) * 0.05 : 0), t.z);
      h.spin.rotation.y = t.angle;
      const sp = Math.hypot(t.vx, t.vz);
      const wob = (1 - Math.min(1, t.stamina / 25)) * 0.5;
      let tx = THREE.MathUtils.clamp(t.vz * 0.025, -0.3, 0.3) + Math.sin(s.camT * 9 + i) * wob * 0.3;
      let tz = THREE.MathUtils.clamp(-t.vx * 0.025, -0.3, 0.3) + Math.cos(s.camT * 7 + i) * wob * 0.3;
      if (res && i === res.loser && res.finish === 'SPIN') { const k = Math.min(1, bt / 1.6); tx += k * 1.15; h.root.position.y -= k * 0.25; }
      h.root.rotation.set(tx, 0, tz);
      // burst: layer / disc / driver separate
      if (h.layer && h.disc && h.driver) {
        if (t.burstTime >= 0) {
          const b = Math.max(0, bt);
          const a = i * 2.3 + 0.7;
          const fy = (v: number) => Math.max(-0.1, v * b - 6 * b * b);
          h.layer.position.set(Math.cos(a) * b * 4, fy(7), Math.sin(a) * b * 4); h.layer.rotation.set(b * 6, b * 10, b * 4);
          h.disc.position.set(Math.cos(a + 2.1) * b * 3, fy(4.5), Math.sin(a + 2.1) * b * 3); h.disc.rotation.set(b * 3, b * 8, 0);
          h.driver.position.set(Math.cos(a + 4.2) * b * 2, fy(3), Math.sin(a + 4.2) * b * 2); h.driver.rotation.set(b * 5, 0, b * 5);
        } else { h.layer.position.set(0, 0, 0); h.disc.position.set(0, 0, 0); h.driver.position.set(0, 0, 0); h.layer.rotation.set(0, 0, 0); h.disc.rotation.set(0, 0, 0); h.driver.rotation.set(0, 0, 0); }
      }
      if (s.phase === 'fight' && sp > 3.5 && s.trail > 0.03) fx.trail(t.x, y + 0.15, t.z, i === 0 ? setup.playerBey.color : setup.opponent.bey.color);
    }
    if (s.trail > 0.03) s.trail = 0;

    // --- camera ---
    s.shake = Math.max(0, s.shake - dt * 1.6);
    const p0 = sim.tops[0], p1 = sim.tops[1];
    if (s.phase === 'intro') {
      const a = -0.5 + s.t * 0.5;
      camPos.set(Math.sin(a) * 15, 6.5 + Math.sin(s.t) * 0.6, Math.cos(a) * 15);
      camTarget.set(0, 0.8, 0);
    } else {
      const sep = Math.hypot(p0.x - p1.x, p0.z - p1.z);
      const mx = (p0.x + p1.x) / 2, mz = (p0.z + p1.z) / 2;
      camTarget.set(mx * 0.5, 0.4, mz * 0.5);
      camPos.set(mx * 0.2, 12.5 + sep * 0.22, 15.5 + sep * 0.15);
      if (res) {
        const l = sim.tops[res.loser];
        const k = Math.min(1, s.finishT * 0.8);
        camTarget.lerp(new THREE.Vector3(l.x, 0.6, l.z), k * 0.8);
        camPos.set(l.x * 0.5, 7 - k * 2, l.z * 0.6 + 10);
      }
    }
    camera.position.lerp(camPos, 1 - Math.exp(-dt * (s.phase === 'intro' ? 6 : 3)));
    camera.position.x += (Math.random() - 0.5) * s.shake * 0.5;
    camera.position.y += (Math.random() - 0.5) * s.shake * 0.5;
    camera.lookAt(camTarget);
  });

  const shadows = quality !== 'low';
  return (
    <>
      <hemisphereLight args={['#bcd4ff', '#2a2440', 0.55]} />
      <directionalLight position={[8, 20, 10]} intensity={1.4} castShadow={shadows} shadow-mapSize={[quality === 'high' ? 2048 : 1024, quality === 'high' ? 2048 : 1024]} shadow-camera-left={-14} shadow-camera-right={14} shadow-camera-top={14} shadow-camera-bottom={-14} shadow-bias={-0.0004} />
      <pointLight position={[0, 6, 0]} intensity={25} color={def.accent} distance={30} />
      <Stadium def={def} crowd />
      <BeybladeModel config={setup.playerBey} handle={h0} scale={0.82} />
      <BeybladeModel config={setup.opponent.bey} handle={h1} scale={0.82} />
      <FxLayer />
    </>
  );
}
