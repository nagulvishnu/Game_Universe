import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { rt, useHud } from '../game/runtime';
import { useGame } from '../game/store';
import { collideLots, computeRoute, districtAt, DISTRICTS, flyoverHeight, nearestPoi, P, poiById, WORLD_D, WORLD_W } from '../game/world/city';
import { angleDiff, clamp } from '../game/util';
import { Bike, Person } from './Models';
import { modelOf } from '../game/data';
import { activeRide, generateOffer, offerChancePerSec, passengerReady } from '../game/logic/rides';
import { issueFine } from '../game/logic/life';
import { notify, bikeCondition, dayNow } from '../game/state';
import { arriveAction, boardAction, dropAction, acceptOfferAction, declineOfferAction } from '../game/actions';
import { chime, setEngine, setHorn, startAudio, playBoost } from '../game/audio';
import { interiorFor } from './interiorDefs';
import { watchInputFocus } from '../game/inputSafety';

const CHECKPOINTS = [
  { id: 'cp1', x: 2 * P, z: 3.5 * P }, { id: 'cp2', x: 5 * P, z: 5.5 * P }, { id: 'cp3', x: 6.5 * P, z: 4 * P }, { id: 'cp4', x: 4 * P, z: 7.5 * P }, { id: 'cp5', x: 3 * P, z: 1.5 * P },
];
const NOW = () => performance.now() / 1000;

export function Checkpoints() {
  return <>{CHECKPOINTS.map((c) => (
    <group key={c.id} position={[c.x + 0.5, 0, c.z]}>
      <mesh position={[0, 0.5, 0]}><boxGeometry args={[0.4, 1, 6]} /><meshStandardMaterial color="#ef4444" /></mesh>
      <mesh position={[0, 1.05, 0]}><boxGeometry args={[0.42, 0.12, 6.02]} /><meshStandardMaterial color="#f8fafc" /></mesh>
      {[-2.6, 2.6, 4.4].map((z) => <mesh key={z} position={[1.2, 0.35, z]}><coneGeometry args={[0.28, 0.7, 8]} /><meshStandardMaterial color="#f97316" emissive="#f97316" emissiveIntensity={0.3} /></mesh>)}
      <group position={[-1.2, 0, 1]}><Person shirt="#1e3a8a" pants="#1e293b" /></group>
      <mesh position={[-1.2, 2.6, -1]}><boxGeometry args={[2.4, 0.6, 0.1]} /><meshStandardMaterial color="#1d4ed8" emissive="#3b82f6" emissiveIntensity={0.5} /></mesh>
    </group>
  ))}</>;
}

function policeNear(x: number, z: number, r: number): boolean {
  for (const v of rt.traffic) if (v.kind === 'police' && Math.hypot(v.x - x, v.z - z) < r) return true;
  return CHECKPOINTS.some((c) => Math.hypot(c.x - x, c.z - z) < r + 40);
}

export function Rider() {
  const { camera } = useThree();
  const bikeG = useRef<THREE.Group>(null), walkG = useRef<THREE.Group>(null);
  const bikeId = useGame((s) => s.g?.player.bikeId);
  const bike = useGame((s) => s.g?.bikes.find((b) => b.id === s.g?.player.bikeId));
  const company = useGame((s) => s.g?.company);
  const wearUniform = useGame((s) => s.g?.player.wearUniform);
  const boarded = useGame((s) => { const g = s.g; if (!g) return false; const r = activeRide(g); return !!r && r.status === 'inprogress'; });
  const ridePassenger = useGame((s) => s.g ? activeRide(s.g)?.passenger : undefined);
  const interior = useGame((s) => s.g?.player.interior ?? null);
  const [cam, setCam] = useState<'third' | 'first'>('third');
  const [seated, setSeated] = useState(false);
  const pend = useRef({ fuel: 0, oil: 0, tyres: 0, brakes: 0, dmg: 0, odo: 0, dist: 0 });
  const acc = useRef({ sync: 0, hud: 0, route: 0, offer: 0, clock: 0, prompt: 0, auto: 0, hard: 0, fine: 0, col: 0, blend: 0, fall: 0 });
  const camState = useRef({ pos: new THREE.Vector3(), tgt: new THREE.Vector3(), init: false, fov: 62, drag: false, lastX: 0 });
  const dragRef = useRef({ down: false, x: 0 });

  const st = () => useGame.getState();

  // ---------- input ----------
  useEffect(() => {
    const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName);
    const kd = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const s = st();
      if (s.ui.screen !== 'game') return;
      startAudio();
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (e.code === 'Escape') { if (s.ui.panel) s.closePanel(); else if (s.ui.phone) s.setPhone(false); else s.openPanel('pause'); return; }
      if (e.code === 'KeyF') { if (!s.ui.panel) s.setPhone(!s.ui.phone, null); return; }
      if (e.code === 'KeyM') { if (s.ui.panel === 'map') s.closePanel(); else if (!s.ui.panel) s.openPanel('map'); return; }
      if (s.ui.panel) return;
      if (e.repeat) return;
      rt.keys.add(e.code);
      if (e.code === 'KeyC') { rt.camera = rt.camera === 'third' ? 'first' : 'third'; setCam(rt.camera); }
      if (e.code === 'KeyL') { rt.headlights = !rt.headlights; s.toast(rt.headlights ? 'Headlights ON' : 'Headlights OFF'); }
      if (e.code === 'KeyE') { if (rt.nearAction) rt.nearAction(); }
      if (e.code === 'KeyY' && s.g?.offer) acceptOfferAction();
      if (e.code === 'KeyN' && s.g?.offer) declineOfferAction();
      if (e.code === 'KeyZ') rt.bike.indicator = rt.bike.indicator === 1 ? 0 : 1;
      if (e.code === 'KeyX') rt.bike.indicator = rt.bike.indicator === 2 ? 0 : 2;
      if (e.code === 'KeyH') { setHorn(true); }
    };
    const ku = (e: KeyboardEvent) => { rt.keys.delete(e.code); if (e.code === 'KeyH') setHorn(false); };
    const wheel = (e: WheelEvent) => { if (st().ui.panel) return; rt.camDist = clamp(rt.camDist + e.deltaY * 0.004, 3.2, 14); };
    const md = (e: MouseEvent) => { if ((e.target as HTMLElement)?.tagName === 'CANVAS') { dragRef.current.down = true; dragRef.current.x = e.clientX; } };
    const mu = () => { dragRef.current.down = false; };
    const mm = (e: MouseEvent) => { if (dragRef.current.down) { rt.camYawOff += (e.clientX - dragRef.current.x) * 0.006 * (st().g?.settings.invertCam ? -1 : 1); dragRef.current.x = e.clientX; } };
    const release = () => { rt.keys.clear(); dragRef.current.down = false; setHorn(false); setEngine(0, 0, false); };
    const stopWatchingFocus = watchInputFocus(release);
    const unsubscribe = useGame.subscribe((state, previous) => {
      if (state.ui.panel && !previous.ui.panel) release();
    });
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); window.addEventListener('wheel', wheel);
    window.addEventListener('mousedown', md); window.addEventListener('mouseup', mu); window.addEventListener('mousemove', mm);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('wheel', wheel); window.removeEventListener('mousedown', md); window.removeEventListener('mouseup', mu); window.removeEventListener('mousemove', mm); stopWatchingFocus(); unsubscribe(); release(); };
  }, []);

  // ---------- helpers ----------
  const commit = (full = false) => {
    const p = pend.current;
    const s = st();
    if (!s.g) return;
    const riding = rt.mode !== 'walk';
    s.act((g) => {
      if (g.player.interior === null) {
        if (riding) { g.player.x = rt.bike.x; g.player.z = rt.bike.z; g.player.heading = rt.bike.heading; } else { g.player.x = rt.walk.x; g.player.z = rt.walk.z; g.player.heading = rt.walk.heading; }
      }
      const b = g.bikes.find((x) => x.id === g.player.bikeId);
      if (b && g.player.onBike) {
        b.x = rt.bike.x; b.z = rt.bike.z; b.heading = rt.bike.heading;
        b.fuel = Math.max(0, b.fuel - p.fuel); b.oil = Math.max(0, b.oil - p.oil); b.tyres = Math.max(0, b.tyres - p.tyres); b.brakes = Math.max(0, b.brakes - p.brakes);
        b.damage = Math.min(100, b.damage + p.dmg); b.odometerKm += p.odo;
        g.stats.distanceKm += p.dist / 1000;
      }
    });
    pend.current = { fuel: 0, oil: 0, tyres: 0, brakes: 0, dmg: 0, odo: 0, dist: 0 };
    void full;
  };

  const registerCollision = (impact: number, what: string) => {
    const a = acc.current;
    const now = NOW();
    if (now - a.col < 0.7) return;
    a.col = now;
    const g = st().g!;
    pend.current.dmg += impact * impact * 0.045;
    rt.shake = Math.min(1, impact / 15);
    st().act((s) => {
      s.stats.collisions += 1;
      if (impact > 8) s.needs.health = Math.max(0, s.needs.health - (impact - 8) * 0.9);
      if (impact > 4) notify(s, `Collision with ${what} (impact ${Math.round(impact * 3.6)} km/h)`, impact > 9 ? 'bad' : 'warn');
    });
    if (impact > 3) rt.tel.collisions += 1;
    if (impact > 14) { rt.mode = 'fallen'; rt.bike.fallenT = 0; }
    if (impact > 5 && policeNear(rt.bike.x, rt.bike.z, 70)) st().act((s) => issueFine(s, 800, `Accident / reckless driving (${what})`));
    void g;
  };

  const startFall = () => { if (rt.mode === 'ride') { rt.mode = 'fallen'; rt.bike.fallenT = 0; st().act((s) => { s.needs.health = Math.max(0, s.needs.health - 6); notify(s, 'You lost control and fell! Bike damaged.', 'bad'); }); pend.current.dmg += 8; } };

  // ---------- main loop ----------
  useFrame((_, dtRaw) => {
    const s = st();
    const g = s.g;
    if (!g || s.ui.screen !== 'game') return;
    const dt = Math.min(dtRaw, 0.05);
    const paused = !!s.ui.panel;
    const a = acc.current;
    const inInterior = g.player.interior !== null;
    const keys = rt.keys;
    const k = (c: string) => keys.has(c);

    if (!paused) {
      // game clock
      a.clock += dt * 1.2 * g.settings.timeScale;
      rt.clockPartial = a.clock;
      if (a.clock >= 0.5) { const d = a.clock; a.clock = 0; rt.clockPartial = 0; s.tick(d); }
      a.sync += dt; a.hud += dt; a.route += dt; a.offer += dt; a.prompt += dt; a.auto += dt; a.fine += dt;

      const wetGrip = 1 - rt.wet * 0.38;
      const throttle = k('KeyW') || k('ArrowUp'), braking = k('KeyS') || k('ArrowDown');
      const left = k('KeyA') || k('ArrowLeft'), right = k('KeyD') || k('ArrowRight');
      const steerIn = (right ? 1 : 0) - (left ? 1 : 0);

      if (inInterior) {
        // ---- interior walking ----
        const poi = poiById.get(g.player.interior!)!;
        const def = interiorFor(poi.kind, g.player.homeTier);
        const w = rt.int;
        const sprint = k('ShiftLeft') || k('ShiftRight');
        if (seated && (throttle || braking || left || right)) setSeated(false);
        const sp = (throttle ? 1 : braking ? -0.6 : 0) * (sprint ? 4.2 : 2.3);
        w.heading -= steerIn * 2.6 * dt;
        w.speed += (sp - w.speed) * Math.min(1, dt * 10);
        w.x = clamp(w.x + Math.sin(w.heading) * w.speed * dt, -def.hw + 0.5, def.hw - 0.5);
        w.z = clamp(w.z + Math.cos(w.heading) * w.speed * dt, -def.hd + 0.6, def.hd - 0.3);
        for (const p of def.props) { // simple prop collision (AABB, tall props only)
          if (p.h < 0.55) continue;
          const hx = p.w / 2 + 0.35, hz = p.d / 2 + 0.35;
          if (Math.abs(w.x - p.x) < hx && Math.abs(w.z - p.z) < hz) {
            const ox = hx - Math.abs(w.x - p.x), oz = hz - Math.abs(w.z - p.z);
            if (ox < oz) w.x += Math.sign(w.x - p.x) * ox; else w.z += Math.sign(w.z - p.z) * oz;
          }
        }
        rt.walk.stride += Math.abs(w.speed) * dt * 3.2; rt.walk.speed = Math.abs(w.speed);
        if (a.prompt > 0.1) {
          a.prompt = 0;
          let best: { label: string; act: () => void } | null = null, bd = 2.2;
          for (const h of def.hotspots) {
            const d = Math.hypot(h.x - w.x, h.z - w.z);
            if (d < bd) {
              bd = d;
              best = {
                label: h.label,
                act: () => {
                  if (h.action === 'dine') {
                    setSeated(true);
                    rt.int.heading = Math.PI;
                    s.openPanel('menu', poi.id);
                  } else s.openPanel(h.action, h.arg ?? poi.id);
                },
              };
            }
          }
          if (!best && w.z > def.hd - 1.1) best = { label: 'Exit building', act: () => exitInterior() };
          rt.nearPrompt = best ? `E — ${best.label}` : null; rt.nearAction = best ? best.act : null;
        }
      } else if (rt.mode === 'ride' || rt.mode === 'fallen') {
        // ---- motorcycle physics ----
        const b = rt.bike;
        const sb = g.bikes.find((x) => x.id === g.player.bikeId);
        if (sb) {
          const m = modelOf(sb.modelId);
          const up = sb.upgrades;
          const fuelNow = sb.fuel - pend.current.fuel;
          const oilF = (sb.oil - pend.current.oil) < 12 ? 0.72 : 1;
          const stats = {
            maxSpeed: m.maxSpeed * (1 + up.engine * 0.06) * (g.needs.energy < 12 ? 0.9 : 1), accel: m.accel * (1 + up.engine * 0.06) * oilF,
            brake: m.brake * (1 + up.brake * 0.08) * (0.65 + 0.35 * Math.max(0, sb.brakes - pend.current.brakes) / 100),
            handling: m.handling * (1 + up.suspension * 0.05) * (1 - (sb.damage + pend.current.dmg) / 300),
            grip: m.grip * (1 + up.tyre * 0.06) * (0.75 + 0.25 * Math.max(0, sb.tyres - pend.current.tyres) / 100),
          };
          if (rt.mode === 'fallen') {
            b.fallenT += dt; b.speed *= Math.max(0, 1 - dt * 2.5); b.lean = 0; b.steer = 0;
            const f = Math.min(1, b.fallenT / 0.35);
            (b as { fall?: number }).fall = f;
            b.x += Math.sin(b.heading) * b.speed * dt; b.z += Math.cos(b.heading) * b.speed * dt;
            if (b.fallenT > 2.8) { rt.mode = 'ride'; b.fallenT = 0; (b as { fall?: number }).fall = 0; }
          } else {
            (b as { fall?: number }).fall = 0;
            const v = b.speed;
            let acc2 = 0;
            const noFuel = fuelNow <= 0;

            // ---- boost (Space) ----
            const boostKey = k('Space');
            // charge boost while riding (not boosting)
            if (rt.boostActive <= 0) rt.boost = Math.min(1, rt.boost + dt * 0.18);
            if (boostKey && rt.boost >= 0.25 && rt.boostActive <= 0 && v > 2 && !noFuel) {
              rt.boostActive = 2.2;   // 2.2 s burst
              rt.boost = 0;
              playBoost();
            }
            if (rt.boostActive > 0) {
              rt.boostActive -= dt;
              const boostForce = stats.accel * 1.55 * Math.pow(Math.max(0, 1 - Math.max(0, v) / (stats.maxSpeed * 1.35)), 1.0);
              acc2 += boostForce;
            }

            if (throttle && !noFuel) acc2 += stats.accel * Math.pow(Math.max(0, 1 - Math.max(0, v) / stats.maxSpeed), 1.2) * Math.min(1, 0.55 + 0.45 * wetGrip) * (1 - Math.min(0.5, Math.abs(b.steer) * 0.25));
            if (braking) { if (v > 0.5) acc2 -= stats.brake * wetGrip; else acc2 -= 2.5; }
            acc2 -= Math.sign(v) * (0.35 + 0.0016 * v * v);
            if (!throttle && !braking && rt.boostActive <= 0) acc2 -= Math.sign(v) * 0.9;
            let nv = v + acc2 * dt;
            if (!braking && rt.boostActive <= 0 && ((v > 0 && nv < 0) || (v < 0 && nv > 0))) nv = 0;
            if (braking && v > 0.5 && nv < 0) nv = 0;
            nv = clamp(nv, -3, stats.maxSpeed * (rt.boostActive > 0 ? 1.38 : 1.02));

            // brake / hard events
            if (acc2 < -8 && v > 6 && a.hard < NOW() - 1.5) { a.hard = NOW(); if (rt.passengerBoarded) rt.tel.hardEvents += 1; }

            // ---- steering & drift ----
            // steer input smoothing — fast in, slow out
            let sIn = steerIn;
            if (g.needs.energy < 15) sIn += (Math.random() - 0.5) * 0.25;
            const steerRate = sIn === 0 ? 10 : 8;
            b.steer += (sIn - b.steer) * Math.min(1, dt * steerRate);

            // how much the heading wants to turn this frame
            const speedAbs = Math.abs(nv);
            const maxSteerAngle = (0.58 / (1 + speedAbs * 0.10)) * stats.handling;
            const desiredYaw = (nv / 1.4) * Math.tan(b.steer * maxSteerAngle);

            // rotate heading
            b.heading -= desiredYaw * dt;

            // velocity angle lags behind heading — the gap IS the slip angle
            // grip determines how fast velocity catches up to heading
            const gripFactor = stats.grip * wetGrip * (rt.boostActive > 0 ? 0.78 : 1.0);
            // at low speed velocity snaps to heading instantly (no drift below ~10 km/h)
            const driftBlend = clamp((speedAbs - 2.8) / 6.0, 0, 1);
            const velCatchRate = (18 - driftBlend * 10) * gripFactor; // high = grippy, low = drifty
            const headingVelDiff = angleDiff(rt.velAngle, b.heading);
            rt.velAngle += headingVelDiff * Math.min(1, dt * velCatchRate);

            // slip angle = difference between velocity direction and heading
            const slipAngle = angleDiff(rt.velAngle, b.heading);
            const slipAbs = Math.abs(slipAngle);

            // drift kicks in when slip exceeds grip threshold
            const gripThreshold = 0.18 / gripFactor;
            const isDrifting = slipAbs > gripThreshold && speedAbs > 4;
            b.slide = isDrifting;

            // when drifting, velocity angle resists snapping — feels like sliding
            if (isDrifting) {
              // counterforce: velocity slowly pulls back toward heading but fights it
              const driftResist = 3.5 * gripFactor;
              rt.velAngle += headingVelDiff * Math.min(1, dt * driftResist);
              // speed bleeds off during hard drift
              nv *= 1 - slipAbs * 0.18 * dt;
            }

            // drift amount for visuals (0..1)
            rt.driftAmt += (clamp(slipAbs / 0.55, 0, 1) - rt.driftAmt) * Math.min(1, dt * 12);

            // move along velocity direction (not heading)
            const dist = nv * dt;
            b.x += Math.sin(rt.velAngle) * dist;
            b.z += Math.cos(rt.velAngle) * dist;

            // lean: follows yaw rate + extra lean into drift
            const targetLean = clamp(
              desiredYaw * nv * 0.072
              + slipAngle * 0.35 * driftBlend   // lean into the slide
              + (rt.boostActive > 0 ? -b.pitch * 0.28 : 0),
              -0.82, 0.82
            );
            b.lean += (targetLean - b.lean) * Math.min(1, dt * (isDrifting ? 10 : 8));

            // pitch — nose dips on brake, lifts on boost/accel
            const targetPitch = clamp(-acc2 * 0.013 * (1 - sb.upgrades.suspension * 0.12), -0.13, 0.15);
            b.pitch += (targetPitch - b.pitch) * Math.min(1, dt * 7);

            b.speed = nv;

            // fall only on extreme wet slides
            if (isDrifting && slipAbs > 0.62 && wetGrip < 0.75 && speedAbs > 14 && Math.random() < dt * 0.5) startFall();

            // road vibration — spikes during drift
            const speedNorm = speedAbs / stats.maxSpeed;
            const targetBump = speedNorm * 0.012 + (rt.boostActive > 0 ? 0.022 : 0) + rt.driftAmt * 0.025 + rt.wet * speedNorm * 0.008;
            rt.roadBump += (targetBump - rt.roadBump) * Math.min(1, dt * 14);

            const p = pend.current, ad = Math.abs(dist);
            p.fuel += ad / (m.tank * m.kmpl * 1600) * (1 + (throttle ? 0.2 : 0) + (rt.boostActive > 0 ? 0.45 : 0));
            p.odo += ad / 1000; p.dist += ad;
            p.oil += (ad / 1000) * 0.9;
            p.tyres += (ad / 1000) * 0.7 * (1 + rt.driftAmt * 2.5) / (1 + up.tyre * 0.15);
            p.brakes += braking ? ad / 1000 * 2.2 : ad / 1000 * 0.3;
            if (rt.passengerBoarded) { rt.tel.distanceM += ad; rt.tel.elapsedSec += dt; if (speedAbs > 22) rt.tel.speedingSec += dt; }
          }
          // building collision
          for (let it = 0; it < 3; it++) {
            const c = collideLots(b.x, b.z, 0.9);
            if (!c) break;
            b.x += c.nx * c.depth; b.z += c.nz * c.depth;
            const into = Math.abs(b.speed);
            if (into > 2.5 && rt.mode === 'ride') { registerCollision(into * 0.9, 'a building'); b.speed *= -0.2; }
            else b.speed *= 0.6;
          }
          // sea / bounds
          b.x = clamp(b.x, -40, WORLD_W + 58); b.z = clamp(b.z, -40, WORLD_D + 40);
          // vehicles
          const active = (rt as unknown as { trafficActive?: number }).trafficActive ?? 56;
          for (const v of rt.traffic) {
            if (!(v.id < 4 || v.id < active)) continue;
            if (Math.abs(v.x - b.x) > 8 || Math.abs(v.z - b.z) > 8) continue;
            const n = Math.max(1, Math.ceil(v.len / 2.6));
            for (let q = 0; q < n; q++) {
              const off = (q - (n - 1) / 2) * 2.6;
              const cx = v.x + Math.sin(v.heading) * off, cz = v.z + Math.cos(v.heading) * off;
              const dx = b.x - cx, dz = b.z - cz, dd = Math.hypot(dx, dz), rr = 0.75 + v.wid / 2;
              if (Math.abs(flyoverHeight(b.x, b.z) - flyoverHeight(v.x, v.z)) > 2.5) continue;
              if (dd < rr && dd > 0.001) {
                b.x += (dx / dd) * (rr - dd); b.z += (dz / dd) * (rr - dd);
                const rel = Math.abs(b.speed - v.speed * Math.cos(v.heading - b.heading));
                if (rel > 1.5 && rt.mode === 'ride') { registerCollision(rel, v.kind === 'bike' ? 'a motorcycle' : v.kind === 'police' ? 'a police car' : v.kind === 'bus' ? 'a bus' : v.kind === 'truck' ? 'a truck' : v.kind === 'auto' ? 'an auto-rickshaw' : 'a car'); v.hit = 1.5; v.speed *= 0.2; b.speed *= 0.35; }
                break;
              }
            }
          }
          // pedestrians
          for (const pd of rt.peds) {
            if (!pd.alive || pd.hidden > 0) continue;
            if (flyoverHeight(b.x, b.z) > 1.5) continue;
            if (Math.abs(pd.x - b.x) > 2 || Math.abs(pd.z - b.z) > 2) continue;
            if (Math.hypot(pd.x - b.x, pd.z - b.z) < 0.9 && Math.abs(b.speed) > 2.5) {
              pd.hidden = 25; registerCollision(Math.abs(b.speed) * 0.5, 'a pedestrian'); b.speed *= 0.6;
              if (policeNear(b.x, b.z, 70)) st().act((q) => issueFine(q, 1500, 'Hit a pedestrian'));
            }
          }
          // police behaviour & violations
          policeMonitor(dt, b, g, stats.maxSpeed);
          // audio
          setEngine(Math.abs(b.speed) / stats.maxSpeed, throttle ? 1 : 0, rt.mode === 'ride' && fuelNow > 0);
        }
      } else {
        // ---- walking ----
        const w = rt.walk;
        const sprint = k('ShiftLeft') || k('ShiftRight');
        const sp = (throttle ? 1 : braking ? -0.6 : 0) * (sprint ? 5.6 : 2.4);
        w.heading -= steerIn * 2.8 * dt;
        w.speed += (sp - w.speed) * Math.min(1, dt * 8);
        w.x += Math.sin(w.heading) * w.speed * dt; w.z += Math.cos(w.heading) * w.speed * dt;
        for (let it = 0; it < 3; it++) { const c = collideLots(w.x, w.z, 0.45); if (!c) break; w.x += c.nx * c.depth; w.z += c.nz * c.depth; }
        w.x = clamp(w.x, -40, WORLD_W + 56); w.z = clamp(w.z, -40, WORLD_D + 40);
        w.stride += Math.abs(w.speed) * dt * 3.2;
        setEngine(0, 0, false);
        for (const v of rt.traffic) {
          if (v.speed < 3 || Math.abs(v.x - w.x) > 5 || Math.abs(v.z - w.z) > 5) continue;
          if (Math.hypot(v.x - w.x, v.z - w.z) < 1.4 + v.wid / 2 && a.col < NOW() - 1.5) {
            a.col = NOW(); const dmg = v.speed * 2.2; s.act((q) => { q.needs.health = Math.max(0, q.needs.health - dmg); notify(q, 'You were hit by a vehicle!', 'bad'); });
            w.x += Math.sin(v.heading) * 2; w.z += Math.cos(v.heading) * 2; v.hit = 2; v.speed = 0;
          }
        }
      }

      // ---- periodic: prompts, rides, offers, hud, sync ----
      if (!inInterior && a.prompt > 0.1) { a.prompt = 0; updatePrompt(g); }
      if (a.auto > 0.25) { a.auto = 0; rideAuto(g); }
      if (a.route > 1) { a.route = 0; updateRoute(); }
      if (a.offer > 1) {
        a.offer = 0;
        const gg = st().g!;
        if (gg.player.online && !gg.activeRideId && !gg.offer && !inInterior) {
          if (Math.random() < offerChancePerSec(gg)) {
            const px = rt.mode === 'walk' ? rt.walk.x : rt.bike.x, pz = rt.mode === 'walk' ? rt.walk.z : rt.bike.z;
            const r = st().act((q) => generateOffer(q, px, pz));
            if (r) { chime('ding'); st().setUI({ offerExpiresAt: Date.now() + 20000 }); }
          }
        } else if (gg.offer && Date.now() > st().ui.offerExpiresAt) declineOfferAction();
      }
      if (a.sync > 1) { a.sync = 0; commit(); }
      if (a.hud > 0.12) {
        a.hud = 0;
        const b = rt.bike;
        const sb = g.bikes.find((x) => x.id === g.player.bikeId);
        const p = rt.mode === 'walk' || inInterior ? rt.walk : rt.bike;
        const cx = inInterior ? 0 : p.x, cz = inInterior ? 0 : p.z;
        const ride = activeRide(g);
        const waiting = ride?.status === 'arrived' ? (passengerReady(g) ? 'Passenger ready — press E' : `Waiting for ${ride.passenger.name}…`) : null;
        let dist: number | null = null;
        if (rt.target) dist = Math.hypot(rt.target.x - cx, rt.target.z - cz);
        const mdl = sb ? modelOf(sb.modelId) : null;
        useHud.setState({
          speedKmh: Math.round(Math.abs(b.speed) * 3.6), fuel: sb ? clamp(sb.fuel - pend.current.fuel, 0, 1) : 0, cond: sb ? bikeCondition({ ...sb, damage: sb.damage + pend.current.dmg }) : 0,
          prompt: rt.nearPrompt, mode: inInterior ? 'interior' : rt.mode, district: DISTRICTS[districtAt(cx, cz)].name, gear: mdl ? Math.min(5, 1 + Math.floor(Math.abs(b.speed) / (mdl.maxSpeed / 5))) : 1,
          distToTarget: dist, offerLeft: g.offer ? Math.max(0, Math.round((s.ui.offerExpiresAt - Date.now()) / 1000)) : 0, waiting, headlights: rt.headlights, wet: rt.wet, lowGrip: rt.wet > 0.4, indicator: b.indicator,
        });
      }
    }

    // ---- visuals & camera (also while paused) ----
    const riding = !inInterior && (rt.mode === 'ride' || rt.mode === 'fallen');
    if (bikeG.current) { bikeG.current.visible = riding; if (riding) { bikeG.current.position.set(rt.bike.x, flyoverHeight(rt.bike.x, rt.bike.z), rt.bike.z); bikeG.current.rotation.y = rt.bike.heading; } }
    if (walkG.current) {
      const vis = !inInterior && rt.mode === 'walk';
      walkG.current.visible = vis || inInterior;
      if (inInterior) { walkG.current.position.set(rt.int.x, 0, rt.int.z); walkG.current.rotation.y = rt.int.heading; }
      else if (vis) { walkG.current.position.set(rt.walk.x, flyoverHeight(rt.walk.x, rt.walk.z), rt.walk.z); walkG.current.rotation.y = rt.walk.heading; }
      if (cam === 'first') walkG.current.visible = false;
    }
    // camera
    const cs = camState.current;
    rt.camYawOff *= 1 - Math.min(1, dt * 0.7) * (dragRef.current.down ? 0 : 1);
    const wantFP = rt.camera === 'first';
    a.blend += ((wantFP ? 1 : 0) - a.blend) * Math.min(1, dt * 5);
    const ease = a.blend * a.blend * (3 - 2 * a.blend);
    let fx: number, fz: number, fh: number, fv = 0, eyeH = 1.55, lean = 0, camHeightBase = 2.0;
    if (inInterior) { fx = rt.int.x; fz = rt.int.z; fh = rt.int.heading; eyeH = 1.6; camHeightBase = 1; }
    else if (riding) { fx = rt.bike.x; fz = rt.bike.z; fh = rt.bike.heading; fv = Math.abs(rt.bike.speed); lean = rt.bike.lean; eyeH = 1.5; }
    else { fx = rt.walk.x; fz = rt.walk.z; fh = rt.walk.heading; eyeH = 1.68; }
    const elevation = inInterior ? 0 : flyoverHeight(fx, fz);
    if (!cs.init) { cs.init = true; cs.pos.set(fx, 4, fz - 6); }
    // yaw tracking — snappier at speed, blends toward velAngle during drift
    const yawSnap = fv > 1 || rt.walk.speed > 0.5 ? 4.5 + fv * 0.12 : 1.4;
    const camHeadingTarget = riding
      ? fh + angleDiff(fh, rt.velAngle) * rt.driftAmt * 0.45
      : fh;
    rt.camYaw += angleDiff(rt.camYaw, camHeadingTarget) * Math.min(1, dt * yawSnap);
    const yaw = rt.camYaw + rt.camYawOff;
    let tp: THREE.Vector3, tl: THREE.Vector3;
    if (inInterior) {
      const poi = poiById.get(g.player.interior!)!; void poi;
      tp = new THREE.Vector3(fx * 0.9, 6.8, fz + 6.8); tl = new THREE.Vector3(fx, 0.8, fz - 0.5);
    } else {
      const speedPull = riding ? fv * 0.09 : 0;
      const d = (rt.camDist + speedPull) * (riding ? 1 : 0.8);
      const bumpY = riding ? Math.sin(performance.now() * 0.018) * rt.roadBump * 0.55 : 0;
      tp = new THREE.Vector3(fx - Math.sin(yaw) * d, camHeightBase + elevation + d * 0.22 + (riding ? 0.2 : 0) + bumpY, fz - Math.cos(yaw) * d);
      tl = new THREE.Vector3(fx + Math.sin(fh) * (fv * 0.14 + 1.5), elevation + 1.1 + (riding ? rt.bike.pitch * -1.5 : 0), fz + Math.cos(fh) * (fv * 0.14 + 1.5));
    }
    const camSpring = inInterior ? 6 : (riding ? 10 + fv * 0.4 : 9);
    cs.pos.lerp(tp, 1 - Math.exp(-dt * camSpring));
    const fpPos = new THREE.Vector3(fx + Math.sin(fh) * (riding ? 0.2 : 0.1), elevation + eyeH + (riding ? Math.sin(performance.now() * 0.018) * rt.roadBump * 0.3 : 0), fz + Math.cos(fh) * (riding ? 0.2 : 0.1));
    const fpLook = new THREE.Vector3(fx + Math.sin(fh + rt.camYawOff * 0.7) * 10, elevation + eyeH - 0.15 + (riding ? -rt.bike.pitch * 7 : 0), fz + Math.cos(fh + rt.camYawOff * 0.7) * 10);
    const finalPos = cs.pos.clone().lerp(fpPos, ease);
    const finalLook = tl.clone().lerp(fpLook, ease);
    if (rt.shake > 0) { finalPos.x += (Math.random() - 0.5) * rt.shake * 0.45; finalPos.y += (Math.random() - 0.5) * rt.shake * 0.45; rt.shake = Math.max(0, rt.shake - dt * 2.8); }
    if (rt.rainLevel > 0.3 && ease > 0.5) { finalPos.y += Math.sin(performance.now() * 0.03) * 0.004 * rt.rainLevel; }
    camera.position.copy(finalPos);
    camera.lookAt(finalLook);
    // lean roll — stronger during drift and boost
    if (ease > 0.01 && riding) camera.rotateZ(lean * (0.55 + rt.driftAmt * 0.25 + (rt.boostActive > 0 ? 0.15 : 0)) * ease);
    const persp = camera as THREE.PerspectiveCamera;
    const wantFov = (wantFP ? 72 : 62) + Math.min(16, fv * 0.5) + (rt.boostActive > 0 ? 8 : 0) + rt.driftAmt * 5;
    cs.fov += (wantFov - cs.fov) * Math.min(1, dt * (rt.boostActive > 0 ? 7 : 4));
    if (Math.abs(persp.fov - cs.fov) > 0.05) { persp.fov = cs.fov; persp.updateProjectionMatrix(); }
    void camHeightBase;
  });

  // ---------- gameplay helpers (closures use refs/state only) ----------
  function exitInterior() {
    const s = st();
    const g = s.g!;
    const poi = poiById.get(g.player.interior!)!;
    // place player on the curb outside the door
    rt.walk.x = poi.x; rt.walk.z = poi.z + (poi.z % P < P / 2 ? 2.2 : -2.2); rt.walk.heading = poi.z % P < P / 2 ? 0 : Math.PI;
    rt.walk.speed = 0;
    s.act((q) => { q.player.interior = null; });
    setSeated(false);
    rt.nearAction = null; rt.nearPrompt = null;
  }

  function enterPoi(id: string) {
    const s = st();
    const g = s.g!;
    const poi = poiById.get(id)!;
    if ((poi.kind === 'hq') && !g.company) { s.toast('Locked: register your company at the City Registrar first'); return; }
    if (poi.kind === 'branch' && !g.company?.branches.some((b) => b.poiId === poi.id)) { s.toast('You have no branch in this district yet'); return; }
    s.act((q) => { q.player.interior = id; });
    setSeated(false);
    rt.int.x = 0; rt.int.z = interiorFor(poi.kind, g.player.homeTier).hd - 1.4; rt.int.heading = Math.PI; rt.int.speed = 0;
    rt.nearAction = null; rt.nearPrompt = null;
    setEngine(0, 0, false);
  }

  function dismount() {
    const g = st().g!;
    const ride = activeRide(g);
    if (ride && ride.status === 'inprogress') { st().toast("Can't dismount with a passenger aboard"); return; }
    const b = rt.bike;
    st().act((q) => {
      const bk = q.bikes.find((x) => x.id === q.player.bikeId);
      if (bk) { bk.x = b.x; bk.z = b.z; bk.heading = b.heading; }
      q.player.onBike = false;
    });
    rt.walk.x = b.x - Math.cos(b.heading) * 1.1; rt.walk.z = b.z + Math.sin(b.heading) * 1.1; rt.walk.heading = b.heading; rt.walk.speed = 0;
    rt.mode = 'walk'; b.speed = 0; b.lean = 0; b.steer = 0; b.id = null;
    setEngine(0, 0, false);
  }

  function mount(id: string) {
    const g = st().g!;
    const bk = g.bikes.find((x) => x.id === id)!;
    rt.bike.id = bk.id; rt.bike.x = bk.x; rt.bike.z = bk.z; rt.bike.heading = bk.heading; rt.bike.speed = 0; rt.bike.lean = 0; rt.bike.steer = 0;
    rt.velAngle = bk.heading; rt.driftAmt = 0;
    rt.mode = 'ride';
    st().act((q) => { q.player.onBike = true; q.player.bikeId = id; });
    pend.current = { fuel: 0, oil: 0, tyres: 0, brakes: 0, dmg: 0, odo: 0, dist: 0 };
  }

  function updatePrompt(g: NonNullable<ReturnType<typeof st>['g']>) {
    let prompt: string | null = null, action: (() => void) | null = null;
    const ride = activeRide(g);
    if (rt.mode === 'ride' || rt.mode === 'fallen') {
      const b = rt.bike;
      const sp = Math.abs(b.speed);
      if (rt.mode === 'fallen') { rt.nearPrompt = 'You fell — getting up…'; rt.nearAction = null; return; }
      if (ride && ride.status === 'arrived' && passengerReady(g) && Math.hypot(ride.pickup.x - b.x, ride.pickup.z - b.z) < 14 && sp < 4) { prompt = `E — Pick up ${ride.passenger.name}`; action = boardAction; }
      else if (ride && ride.status === 'inprogress' && Math.hypot(ride.dest.x - b.x, ride.dest.z - b.z) < 14 && sp < 4) { prompt = 'E — Drop off passenger & collect fare'; action = dropAction; }
      else {
        const pet = nearestPoi(b.x, b.z, 18, (p) => p.kind === 'petrol');
        if (pet && sp < 4) { prompt = `E — Refuel at ${pet.name}`; action = () => st().openPanel('fuel', pet.id); }
        else if (sp < 3) { prompt = 'E — Dismount'; action = dismount; }
      }
    } else {
      const w = rt.walk;
      let best = 3.6, bid: string | null = null;
      for (const bk of g.bikes) { if (bk.owner !== 'player') continue; const d = Math.hypot(bk.x - w.x, bk.z - w.z); if (d < best) { best = d; bid = bk.id; } }
      const poi = nearestPoi(w.x, w.z, 4.8, (p) => p.enterable);
      const pdist = poi ? Math.hypot(poi.x - w.x, poi.z - w.z) : 99;
      if (bid && (!poi || best <= pdist + 0.5)) { const bk = g.bikes.find((x) => x.id === bid)!; prompt = `E — Mount ${modelOf(bk.modelId).name} (${bk.plate})`; action = () => mount(bid!); }
      else if (poi) { prompt = `E — Enter ${poi.name}`; action = () => enterPoi(poi.id); }
      else {
        const pet = nearestPoi(w.x, w.z, 6, (p) => p.kind === 'petrol');
        if (pet) { prompt = `E — ${pet.name}: fuel your bike here (ride up)`; action = () => st().toast('Ride your bike to the pump to refuel'); }
      }
    }
    rt.nearPrompt = prompt; rt.nearAction = action;
  }

  function rideAuto(g: NonNullable<ReturnType<typeof st>['g']>) {
    const ride = activeRide(g);
    if (!ride) { if (rt.target && rt.target.kind !== 'poi') { rt.target = null; rt.route = null; } rt.passengerBoarded = false; return; }
    const px = rt.mode === 'walk' ? rt.walk.x : rt.bike.x, pz = rt.mode === 'walk' ? rt.walk.z : rt.bike.z;
    if (ride.status === 'enroute') {
      rt.target = { x: ride.pickup.x, z: ride.pickup.z, kind: 'pickup' };
      if (rt.mode === 'ride' && Math.hypot(px - ride.pickup.x, pz - ride.pickup.z) < 12 && Math.abs(rt.bike.speed) < 5) arriveAction();
    } else if (ride.status === 'arrived') rt.target = null;
    else if (ride.status === 'inprogress') { rt.target = { x: ride.dest.x, z: ride.dest.z, kind: 'dest' }; rt.passengerBoarded = true; }
  }

  function updateRoute() {
    if (!rt.target) { rt.route = null; return; }
    const px = rt.mode === 'walk' ? rt.walk.x : rt.bike.x, pz = rt.mode === 'walk' ? rt.walk.z : rt.bike.z;
    rt.route = computeRoute(px, pz, rt.target.x, rt.target.z).pts;
  }

  function policeMonitor(dt: number, b: typeof rt.bike, g: NonNullable<ReturnType<typeof st>['g']>, vmax: number) {
    const now = NOW();
    const cd = rt.cooldowns;
    const sp = Math.abs(b.speed);
    // speeding near police
    if (sp > 27 && (cd.speed ?? 0) < now - 60 && policeNear(b.x, b.z, 80)) { cd.speed = now; st().act((s) => issueFine(s, 700, `Over-speeding (${Math.round(sp * 3.6)} km/h)`)); }
    // checkpoints
    for (const c of CHECKPOINTS) {
      if (Math.hypot(c.x - b.x, c.z - b.z) < 15 && (cd[c.id] ?? 0) < now - 120) {
        cd[c.id] = now;
        const day = dayNow(g);
        const bk = g.bikes.find((x) => x.id === g.player.bikeId);
        st().act((s) => {
          const issues: string[] = [];
          if (s.player.licenceExpiryDay <= day) issues.push('expired licence');
          if (bk && bk.registrationExpiryDay <= day) issues.push('expired registration');
          if (sp > 9) { issueFine(s, 400, 'Failed to slow down at police checkpoint'); }
          if (s.player.finesDue > 0 && s.wallet > 0) { const pay = Math.min(s.wallet, s.player.finesDue); s.wallet -= pay; s.player.finesDue -= pay; s.ledger.push({ id: s.ledgerSeq++, time: s.time, account: 'wallet', kind: 'expense', category: 'fine', label: 'Pending fines collected at checkpoint', amount: -pay, balanceAfter: s.wallet }); notify(s, `Police collected pending fines ₹${pay}.`, 'warn'); }
          if (!issues.length && sp <= 9) notify(s, 'Police checkpoint: licence, registration and documents verified ✓', 'good');
        });
        st().toast('Police checkpoint — documents checked');
        break;
      }
    }
    void dt; void vmax;
  }

  const passenger = boarded && ridePassenger ? { shirt: ridePassenger.shirt, skin: ridePassenger.skin } : null;
  const shirt = wearUniform && company ? company.branding.primary : '#2563eb';
  return (
    <>
      <group ref={bikeG} visible={false}>
        <Bike
          color={bike?.color ?? '#d62828'} decal={bike?.decal ?? 0} headlight
          rider={{ shirt }} passenger={passenger} hideRider={cam === 'first'}
          getVis={() => ({ lean: rt.bike.lean, steer: rt.bike.steer, speed: rt.bike.speed, pitch: rt.bike.pitch, indicator: rt.bike.indicator, fallen: (rt.bike as { fall?: number }).fall ?? 0 })}
        />
      </group>
      <group ref={walkG} visible={false}><Person shirt={shirt} pose={interior && seated ? 'sit' : 'walk'} /></group>
      <Checkpoints />
      <KeyedBikeId id={bikeId} interior={interior} />
    </>
  );
}
function KeyedBikeId({ id, interior }: { id?: string | null; interior: string | null }) { void id; void interior; return null; }
