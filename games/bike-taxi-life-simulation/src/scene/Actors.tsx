import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { rt } from '../game/runtime';
import { useGame } from '../game/store';
import { Bike, Person, updateLightMaterials, VehicleMesh } from './Models';
import { initPeds, initTraffic, trafficDensity, updateTraffic } from '../game/world/trafficSim';
import { pointOnPolyline, polylineLength, poiById } from '../game/world/city';
import { activeRide } from '../game/logic/rides';

const px = () => (rt.mode === 'walk' ? rt.walk.x : rt.bike.x);
const pz = () => (rt.mode === 'walk' ? rt.walk.z : rt.bike.z);

export function Traffic() {
  const groups = useRef<(THREE.Group | null)[]>([]);
  const COUNT = 56;
  useMemo(() => initTraffic(COUNT), []);
  useFrame((_, dtRaw) => {
    const st = useGame.getState();
    if (!st.g || st.ui.panel || st.ui.screen !== 'game') return;
    const dt = Math.min(dtRaw, 0.05);
    const hour = Math.floor(((st.g.time + rt.clockPartial) % 1440) / 60);
    rt.simTimeSec += dt;
    updateTraffic(dt, st.g.weather, hour, px(), pz(), rt.mode === 'walk' ? rt.walk.heading : rt.bike.heading, st.g.player.interior === null);
    updateLightMaterials();
    const active = Math.max(8, Math.round(COUNT * trafficDensity(hour)));
    (rt as unknown as { trafficActive: number }).trafficActive = active;
    rt.traffic.forEach((v, i) => {
      const g = groups.current[i];
      if (!g) return;
      const d = Math.hypot(v.x - px(), v.z - pz());
      const on = (i < 4 || i < active) && d < 260;
      g.visible = on;
      if (on) { g.position.set(v.x, 0, v.z); g.rotation.y = v.heading; }
    });
  });
  return (
    <>
      {rt.traffic.map((v, i) => (
        <group key={v.id} ref={(el) => { groups.current[i] = el; }}>
          <VehicleMesh kind={v.kind === 'police' ? 'car' : v.kind} color={v.color} len={v.len} police={v.kind === 'police'} />
        </group>
      ))}
    </>
  );
}

export function Pedestrians() {
  const body = useRef<THREE.InstancedMesh>(null), head = useRef<THREE.InstancedMesh>(null), legs = useRef<THREE.InstancedMesh>(null);
  useMemo(() => initPeds(90), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useEffect(() => {
    const c = new THREE.Color();
    rt.peds.forEach((p, i) => { c.set(p.shirt); body.current!.setColorAt(i, c); });
    if (body.current!.instanceColor) body.current!.instanceColor.needsUpdate = true;
  }, []);
  useFrame(() => {
    if (!body.current || !head.current || !legs.current) return;
    rt.peds.forEach((p, i) => {
      const d = Math.hypot(p.x - px(), p.z - pz());
      const show = p.alive && p.hidden <= 0 && d < 200;
      const bob = Math.abs(Math.sin(p.phase)) * 0.05;
      const s = show ? 1 : 0;
      dummy.rotation.set(0, p.heading, 0);
      dummy.position.set(p.x, 1.15 + bob, p.z); dummy.scale.set(s, s, s); dummy.updateMatrix(); body.current!.setMatrixAt(i, dummy.matrix);
      dummy.position.set(p.x, 1.62 + bob, p.z); dummy.updateMatrix(); head.current!.setMatrixAt(i, dummy.matrix);
      dummy.position.set(p.x, 0.42 + bob * 0.3, p.z); dummy.updateMatrix(); legs.current!.setMatrixAt(i, dummy.matrix);
    });
    body.current.instanceMatrix.needsUpdate = true; head.current.instanceMatrix.needsUpdate = true; legs.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <>
      <instancedMesh ref={body} args={[undefined, undefined, 90]} castShadow><boxGeometry args={[0.44, 0.62, 0.26]} /><meshStandardMaterial roughness={0.8} /></instancedMesh>
      <instancedMesh ref={head} args={[undefined, undefined, 90]}><sphereGeometry args={[0.13, 8, 6]} /><meshStandardMaterial color="#b9794b" /></instancedMesh>
      <instancedMesh ref={legs} args={[undefined, undefined, 90]}><boxGeometry args={[0.34, 0.8, 0.2]} /><meshStandardMaterial color="#2b3445" /></instancedMesh>
    </>
  );
}

/** Personal bikes parked in the world at their saved positions (never teleported). */
export function ParkedBikes() {
  const bikes = useGame((s) => s.g?.bikes);
  const riding = useGame((s) => (s.g?.player.onBike ? s.g.player.bikeId : null));
  if (!bikes) return null;
  return <>{bikes.filter((b) => b.id !== riding && b.owner === 'player').map((b) => (
    <group key={b.id} position={[b.x, 0, b.z]} rotation={[0, b.heading, 0]}>
      <group rotation={[0, 0, 0.12]}><Bike color={b.color} decal={b.decal} /></group>
    </group>
  ))}</>;
}

/** Company employees (autonomous): positions derived from their ride timeline — no per-frame store writes. */
export function EmployeeRiders() {
  const pool = useRef<(THREE.Group | null)[]>([]);
  const POOL = 10;
  const [, force] = [0, 0];
  void force;
  const info = useRef<{ emp: string; color: string; shirt: string; passenger: boolean }[]>([]);
  const state = useGame((s) => s.g?.company);
  const color = state?.branding.primary ?? '#ef4444';
  useFrame(() => {
    const g = useGame.getState().g;
    if (!g?.company) { pool.current.forEach((p) => p && (p.visible = false)); return; }
    const now = g.time + rt.clockPartial;
    let n = 0;
    for (const e of g.company.employees) {
      if (n >= POOL) break;
      if (e.role !== 'rider' || !e.online || e.status !== 'active') continue;
      let x = e.posX, z = e.posZ, h = 0, pass = false;
      const ride = e.rideId ? g.rides.find((r) => r.id === e.rideId) : null;
      if (ride?.eta) {
        if (ride.status === 'enroute' && ride.pickupPts && ride.assignedAt !== undefined) {
          const f = Math.min(1, (now - ride.assignedAt) / Math.max(0.1, ride.eta.pickupEnd - ride.assignedAt));
          const q = pointOnPolyline(ride.pickupPts, f * polylineLength(ride.pickupPts)); x = q.x; z = q.z; h = q.heading;
        } else if (ride.status === 'arrived') { const p = poiById.get(ride.pickup.poiId); if (p) { x = p.x; z = p.z; } }
        else if (ride.status === 'inprogress' && ride.routePts && ride.startedAt !== undefined) {
          const f = Math.min(1, (now - ride.startedAt) / Math.max(0.1, ride.eta.rideEnd - ride.startedAt));
          const q = pointOnPolyline(ride.routePts, f * polylineLength(ride.routePts)); x = q.x; z = q.z; h = q.heading; pass = true;
        }
      }
      if (Math.hypot(x - px(), z - pz()) > 280) continue;
      const grp = pool.current[n];
      if (grp) {
        grp.visible = true; grp.position.set(x, 0, z); grp.rotation.y = h;
        const pa = grp.getObjectByName('pass'); if (pa) pa.visible = pass;
      }
      info.current[n] = { emp: e.id, color, shirt: color, passenger: pass };
      n++;
    }
    for (let i = n; i < POOL; i++) if (pool.current[i]) pool.current[i]!.visible = false;
  });
  return (
    <>
      {Array.from({ length: POOL }, (_, i) => (
        <group key={i} ref={(el) => { pool.current[i] = el; }} visible={false}>
          <Bike color={color} rider={{ shirt: color }} getVis={() => ({ lean: 0, steer: 0, speed: 8, pitch: 0 })} />
          <group name="pass" position={[0, 0.02, -0.78]} visible={false}><Person shirt="#94a3b8" pose="sit" helmet /></group>
        </group>
      ))}
    </>
  );
}

/** Pickup passenger + GPS route dots + destination pillar. */
export function Markers() {
  const dots = useRef<THREE.InstancedMesh>(null);
  const pillar = useRef<THREE.Mesh>(null);
  const pass = useRef<THREE.Group>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const DOTS = 90;
  useFrame(() => {
    const g = useGame.getState().g;
    const ride = g ? activeRide(g) : null;
    if (pillar.current) {
      const t = rt.target;
      pillar.current.visible = !!t;
      if (t) { pillar.current.position.set(t.x, 25, t.z); (pillar.current.material as THREE.MeshBasicMaterial).color.set(t.kind === 'pickup' ? '#22c55e' : t.kind === 'dest' ? '#f59e0b' : '#38bdf8'); }
    }
    if (pass.current) {
      const show = !!ride && (ride.status === 'enroute' || ride.status === 'arrived');
      pass.current.visible = show;
      if (show) { pass.current.position.set(ride!.pickup.x, 0.2, ride!.pickup.z + (ride!.pickup.z % 104 < 52 ? 1.2 : -1.2)); }
    }
    if (dots.current) {
      const r = rt.route;
      let n = 0;
      if (r && r.length > 1) {
        const total = polylineLength(r);
        const cx = px(), cz = pz();
        // find start offset near the player
        let startD = 0, best = 1e9, acc = 0;
        for (let i = 0; i < r.length - 1; i++) { const l = Math.hypot(r[i + 1][0] - r[i][0], r[i + 1][1] - r[i][1]); const m = [(r[i][0] + r[i + 1][0]) / 2, (r[i][1] + r[i + 1][1]) / 2]; const d = Math.hypot(m[0] - cx, m[1] - cz); if (d < best) { best = d; startD = acc; } acc += l; }
        for (let k = 0; k < DOTS; k++) {
          const d = startD + k * 7;
          if (d > total) break;
          const q = pointOnPolyline(r, d);
          dummy.position.set(q.x, 0.25, q.z); dummy.rotation.order = 'YXZ'; dummy.rotation.set(-Math.PI / 2, q.heading + Math.PI, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
          dots.current.setMatrixAt(n++, dummy.matrix);
        }
      }
      for (let k = n; k < DOTS; k++) { dummy.scale.set(0, 0, 0); dummy.updateMatrix(); dots.current.setMatrixAt(k, dummy.matrix); }
      dots.current.instanceMatrix.needsUpdate = true;
    }
  });
  return (
    <>
      <mesh ref={pillar} visible={false}><cylinderGeometry args={[0.8, 0.8, 50, 12, 1, true]} /><meshBasicMaterial color="#22c55e" transparent opacity={0.35} depthWrite={false} side={THREE.DoubleSide} /></mesh>
      <instancedMesh ref={dots} args={[undefined, undefined, DOTS]} frustumCulled={false}><coneGeometry args={[0.8, 1.6, 3]} /><meshBasicMaterial color="#38bdf8" transparent opacity={0.85} /></instancedMesh>
      <group ref={pass} visible={false}><Person shirt="#f97316" pose="stand" /></group>
    </>
  );
}
