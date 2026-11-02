import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { rt } from '../game/runtime';
import { useGame } from '../game/store';
import { Bike, Person, updateLightMaterials, VehicleMesh } from './Models';
import { initPeds, initTraffic, trafficDensity, updateTraffic } from '../game/world/trafficSim';
import { flyoverHeight, pointOnPolyline, polylineLength, poiById, pois, P } from '../game/world/city';
import { activeRide } from '../game/logic/rides';
import { clamp, mulberry32 } from '../game/util';

const TRAFFIC_COUNT = 120;
const PED_COUNT = 240;

const px = () => (rt.mode === 'walk' ? rt.walk.x : rt.bike.x);
const pz = () => (rt.mode === 'walk' ? rt.walk.z : rt.bike.z);

export function Traffic() {
  const groups = useRef<(THREE.Group | null)[]>([]);
  const COUNT = TRAFFIC_COUNT;
  useMemo(() => initTraffic(COUNT), []);
  useFrame((_, dtRaw) => {
    const st = useGame.getState();
    if (!st.g || st.ui.panel || st.ui.screen !== 'game') return;
    const dt = Math.min(dtRaw, 0.05);
    const hour = Math.floor(((st.g.time + rt.clockPartial) % 1440) / 60);
    rt.simTimeSec += dt;
    updateTraffic(dt, st.g.weather, hour, px(), pz(), rt.mode === 'walk' ? rt.walk.heading : rt.bike.heading, st.g.player.interior === null);
    updateLightMaterials();
    const active = Math.max(12, Math.round(COUNT * trafficDensity(hour)));
    (rt as unknown as { trafficActive: number }).trafficActive = active;
    rt.traffic.forEach((v, i) => {
      const g = groups.current[i];
      if (!g) return;
      const d = Math.hypot(v.x - px(), v.z - pz());
      const on = (i < 4 || i < active) && d < 280;
      g.visible = on;
      if (on) { g.position.set(v.x, flyoverHeight(v.x, v.z), v.z); g.rotation.y = v.heading; }
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
  const body = useRef<THREE.InstancedMesh>(null), head = useRef<THREE.InstancedMesh>(null), hair = useRef<THREE.InstancedMesh>(null), legs = useRef<THREE.InstancedMesh>(null), arms = useRef<THREE.InstancedMesh>(null), shoes = useRef<THREE.InstancedMesh>(null);
  useMemo(() => initPeds(PED_COUNT), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useEffect(() => {
    const c = new THREE.Color();
    const skin = ['#a46b48', '#bb8059', '#d19a70', '#8c5a3c', '#c68642', '#7a4a2a'];
    const pants = ['#273447', '#4b352d', '#374151', '#6b3f2a', '#263238', '#56504b'];
    const hairColors = ['#211a18', '#33231d', '#17191d', '#3b2b25'];
    rt.peds.forEach((p, i) => {
      body.current!.setColorAt(i, c.set(p.shirt));
      head.current!.setColorAt(i, c.set(skin[p.id % skin.length]));
      hair.current!.setColorAt(i, c.set(hairColors[p.id % hairColors.length]));
      for (let side = 0; side < 2; side++) arms.current!.setColorAt(i * 2 + side, c.set(p.shirt));
      for (let side = 0; side < 2; side++) {
        legs.current!.setColorAt(i * 2 + side, c.set(pants[(p.id + side) % pants.length]));
        shoes.current!.setColorAt(i * 2 + side, c.set(p.id % 3 === 0 ? '#6b442b' : '#20252b'));
      }
    });
    for (const mesh of [body.current, head.current, hair.current, legs.current, arms.current, shoes.current]) if (mesh?.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, []);
  useFrame(() => {
    if (!body.current || !head.current || !hair.current || !legs.current || !arms.current || !shoes.current) return;
    const playerX = px(), playerZ = pz();
    rt.peds.forEach((p, i) => {
      const dx = p.x - playerX, dz = p.z - playerZ;
      const show = p.alive && p.hidden <= 0 && dx * dx + dz * dz < 220 * 220;
      const swing = p.moving ? Math.sin(p.phase) : 0, bob = Math.abs(swing) * 0.04;
      const s = show ? 1 : 0, sin = Math.sin(p.heading), cos = Math.cos(p.heading);
      const height = p.id % 5 === 0 ? 0.92 : p.id % 4 === 0 ? 1.06 : 1;
      dummy.rotation.set(0, p.heading, 0);
      dummy.position.set(p.x, 1.15 + bob, p.z); dummy.scale.set(s * height, s * height, s * 0.68); dummy.updateMatrix(); body.current!.setMatrixAt(i, dummy.matrix);
      dummy.position.set(p.x, 1.62 + bob, p.z); dummy.updateMatrix(); head.current!.setMatrixAt(i, dummy.matrix);
      dummy.position.set(p.x, 1.72 + bob, p.z - 0.035);
      const hasHair = p.id % 4 !== 1;
      dummy.scale.set(s * (hasHair ? 1 : 0), s * (hasHair ? 1 : 0), s * (hasHair ? 1 : 0));
      dummy.updateMatrix(); hair.current!.setMatrixAt(i, dummy.matrix);
      for (let side = 0; side < 2; side++) {
        const sign = side ? 1 : -1;
        const legForward = sign * swing * 0.16;
        dummy.position.set(p.x + cos * sign * 0.1 + sin * legForward, 0.42 + bob * 0.3, p.z - sin * sign * 0.1 + cos * legForward);
        dummy.rotation.set(sign * swing * 0.35, p.heading, 0); dummy.updateMatrix(); legs.current!.setMatrixAt(i * 2 + side, dummy.matrix);
        dummy.position.set(p.x + cos * sign * 0.1 + sin * legForward * 1.35, 0.08, p.z - sin * sign * 0.1 + cos * legForward * 1.35);
        dummy.scale.set(s, s, s); dummy.rotation.set(0, p.heading, 0); dummy.updateMatrix(); shoes.current!.setMatrixAt(i * 2 + side, dummy.matrix);
        const armForward = -sign * swing * 0.12;
        dummy.position.set(p.x + cos * sign * 0.29 + sin * armForward, 1.14 + bob, p.z - sin * sign * 0.29 + cos * armForward);
        dummy.rotation.set(-sign * swing * 0.4, p.heading, 0); dummy.updateMatrix(); arms.current!.setMatrixAt(i * 2 + side, dummy.matrix);
      }
    });
    for (const mesh of [body.current, head.current, hair.current, legs.current, arms.current, shoes.current]) mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <>
      <instancedMesh ref={body} args={[undefined, undefined, PED_COUNT]} castShadow frustumCulled={false}><capsuleGeometry args={[0.22, 0.18, 3, 8]} /><meshStandardMaterial roughness={0.82} /></instancedMesh>
      <instancedMesh ref={head} args={[undefined, undefined, PED_COUNT]} frustumCulled={false}><sphereGeometry args={[0.14, 8, 6]} /><meshStandardMaterial roughness={0.8} /></instancedMesh>
      <instancedMesh ref={hair} args={[undefined, undefined, PED_COUNT]} frustumCulled={false}><sphereGeometry args={[0.14, 8, 6]} /><meshStandardMaterial roughness={0.9} /></instancedMesh>
      <instancedMesh ref={legs} args={[undefined, undefined, PED_COUNT * 2]} frustumCulled={false}><boxGeometry args={[0.15, 0.8, 0.2]} /><meshStandardMaterial color="#2b3445" /></instancedMesh>
      <instancedMesh ref={arms} args={[undefined, undefined, PED_COUNT * 2]} frustumCulled={false}><boxGeometry args={[0.13, 0.55, 0.16]} /><meshStandardMaterial roughness={0.8} /></instancedMesh>
      <instancedMesh ref={shoes} args={[undefined, undefined, PED_COUNT * 2]} frustumCulled={false}><boxGeometry args={[0.18, 0.13, 0.3]} /><meshStandardMaterial roughness={0.85} /></instancedMesh>
    </>
  );
}

/** Personal bikes parked at their saved world positions. */
export function ParkedBikes() {
  const bikes = useGame((s) => s.g?.bikes);
  const riding = useGame((s) => (s.g?.player.onBike ? s.g.player.bikeId : null));
  if (!bikes) return null;
  return <>{bikes.filter((b) => b.id !== riding && b.owner === 'player').map((b) => (
    <group key={b.id} position={[b.x, flyoverHeight(b.x, b.z), b.z]} rotation={[0, b.heading, 0]}>
      <Bike color={b.color} decal={b.decal} />
    </group>
  ))}</>;
}

/** Renders a small pool of nearby employee riders from their simulated ride timelines. */
export function EmployeeRiders() {
  const pool = useRef<(THREE.Group | null)[]>([]);
  const company = useGame((s) => s.g?.company);
  const color = company?.branding.primary ?? '#ef4444';
  const poolSize = 10;

  useFrame(() => {
    const g = useGame.getState().g;
    if (!g?.company) {
      pool.current.forEach((group) => { if (group) group.visible = false; });
      return;
    }

    const now = g.time + rt.clockPartial;
    let visibleCount = 0;
    for (const employee of g.company.employees) {
      if (visibleCount >= poolSize) break;
      if (employee.role !== 'rider' || !employee.online || employee.status !== 'active') continue;

      let x = employee.posX, z = employee.posZ, heading = 0, hasPassenger = false;
      const ride = employee.rideId ? g.rides.find((item) => item.id === employee.rideId) : null;
      if (ride?.eta) {
        if (ride.status === 'enroute' && ride.pickupPts && ride.assignedAt !== undefined) {
          const progress = clamp((now - ride.assignedAt) / Math.max(0.1, ride.eta.pickupEnd - ride.assignedAt), 0, 1);
          const point = pointOnPolyline(ride.pickupPts, progress * polylineLength(ride.pickupPts));
          x = point.x; z = point.z; heading = point.heading;
        } else if (ride.status === 'arrived') {
          const pickup = poiById.get(ride.pickup.poiId);
          if (pickup) { x = pickup.x; z = pickup.z; }
        } else if (ride.status === 'inprogress' && ride.routePts && ride.startedAt !== undefined) {
          const progress = clamp((now - ride.startedAt) / Math.max(0.1, ride.eta.rideEnd - ride.startedAt), 0, 1);
          const point = pointOnPolyline(ride.routePts, progress * polylineLength(ride.routePts));
          x = point.x; z = point.z; heading = point.heading; hasPassenger = true;
        }
      }

      const group = pool.current[visibleCount];
      if (group && Math.hypot(x - px(), z - pz()) <= 280) {
        group.visible = true; group.position.set(x, flyoverHeight(x, z), z); group.rotation.y = heading;
        const passenger = group.getObjectByName('passenger');
        if (passenger) passenger.visible = hasPassenger;
        visibleCount++;
      }
    }
    for (let i = visibleCount; i < poolSize; i++) {
      if (pool.current[i]) pool.current[i]!.visible = false;
    }
  });

  return <>{Array.from({ length: poolSize }, (_, i) => (
    <group key={i} ref={(el) => { pool.current[i] = el; }} visible={false}>
      <Bike color={color} rider={{ shirt: color }} getVis={() => ({ lean: 0, steer: 0, speed: 8, pitch: 0 })} />
      <group name="passenger" position={[0, 0.02, -0.78]} visible={false}><Person shirt="#94a3b8" pose="sit" helmet /></group>
    </group>
  ))}</>;
}

/** Nearby passenger, route, and destination markers. */
export function Markers() {
  const passenger = useGame((s) => s.g ? activeRide(s.g)?.passenger : undefined);
  const dots = useRef<THREE.InstancedMesh>(null);
  const pillar = useRef<THREE.Mesh>(null);
  const waitingPassenger = useRef<THREE.Group>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const dotCount = 90;

  useFrame(() => {
    const g = useGame.getState().g;
    const ride = g ? activeRide(g) : null;
    if (pillar.current) {
      const target = rt.target;
      pillar.current.visible = !!target;
      if (target) {
        pillar.current.position.set(target.x, 25, target.z);
        (pillar.current.material as THREE.MeshBasicMaterial).color.set(
          target.kind === 'pickup' ? '#22c55e' : target.kind === 'dest' ? '#f59e0b' : '#38bdf8',
        );
      }
    }
    if (waitingPassenger.current) {
      const waiting = !!ride && (ride.status === 'enroute' || ride.status === 'arrived');
      waitingPassenger.current.visible = waiting;
      if (waiting && ride) {
        waitingPassenger.current.position.set(ride.pickup.x, 0.2, ride.pickup.z + (ride.pickup.z % 104 < 52 ? 1.2 : -1.2));
      }
    }
    if (!dots.current) return;

    const route = rt.route;
    let count = 0;
    if (route && route.length > 1) {
      const total = polylineLength(route);
      const pxNow = px(), pzNow = pz();
      let startDistance = 0, nearestDistance = Infinity, traversed = 0;
      for (let i = 0; i < route.length - 1; i++) {
        const length = Math.hypot(route[i + 1][0] - route[i][0], route[i + 1][1] - route[i][1]);
        const midX = (route[i][0] + route[i + 1][0]) / 2;
        const midZ = (route[i][1] + route[i + 1][1]) / 2;
        const distance = Math.hypot(midX - pxNow, midZ - pzNow);
        if (distance < nearestDistance) { nearestDistance = distance; startDistance = traversed; }
        traversed += length;
      }
      for (let i = 0; i < dotCount; i++) {
        const distance = startDistance + i * 7;
        if (distance > total) break;
        const point = pointOnPolyline(route, distance);
        dummy.position.set(point.x, flyoverHeight(point.x, point.z) + 0.25, point.z);
        dummy.rotation.order = 'YXZ';
        dummy.rotation.set(-Math.PI / 2, point.heading + Math.PI, 0);
        dummy.scale.set(1, 1, 1); dummy.updateMatrix();
        dots.current.setMatrixAt(count++, dummy.matrix);
      }
    }
    for (let i = count; i < dotCount; i++) {
      dummy.scale.set(0, 0, 0); dummy.updateMatrix(); dots.current.setMatrixAt(i, dummy.matrix);
    }
    dots.current.instanceMatrix.needsUpdate = true;
  });

  return <>
    <mesh ref={pillar} visible={false}><cylinderGeometry args={[0.8, 0.8, 50, 12, 1, true]} /><meshBasicMaterial color="#22c55e" transparent opacity={0.35} depthWrite={false} side={THREE.DoubleSide} /></mesh>
    <instancedMesh ref={dots} args={[undefined, undefined, dotCount]} frustumCulled={false}><coneGeometry args={[0.8, 1.6, 3]} /><meshBasicMaterial color="#38bdf8" transparent opacity={0.85} /></instancedMesh>
    <group ref={waitingPassenger} visible={false}><Person shirt={passenger?.shirt ?? '#f97316'} skin={passenger?.skin} pose="stand" /></group>
  </>;
}

/** Waiting crowds near transport hubs, markets, restaurants — instanced static NPCs. */
export function CrowdClusters() {
  const body = useRef<THREE.InstancedMesh>(null);
  const head = useRef<THREE.InstancedMesh>(null);
  const legs = useRef<THREE.InstancedMesh>(null);
  const arms = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const clusters = useMemo(() => {
    const rnd = mulberry32(9191);
    const out: { x: number; z: number; heading: number; shirt: string; phase: number; radius: number; crowd: 'commuter' | 'market' | 'food' }[] = [];
    const SHIRTS = ['#2563eb', '#f1f5f9', '#16a34a', '#f59e0b', '#db2777', '#ea580c', '#78350f', '#1e3a8a', '#e2e8f0', '#84cc16'];
    const hubKinds = ['bus', 'railway', 'market', 'restaurant', 'mall', 'hotel', 'shop'];
    for (const p of pois) {
      if (!hubKinds.includes(p.kind)) continue;
      const commuter = p.kind === 'bus' || p.kind === 'railway';
      const count = commuter ? 12 : p.kind === 'market' || p.kind === 'mall' ? 10 : 6;
      const northFacing = p.z % P < P / 2;
      const sidewalkZ = p.z + (northFacing ? 2.8 : -2.8);
      for (let i = 0; i < count; i++) {
        const ox = (rnd() - 0.5) * 10;
        const oz = (rnd() - 0.5) * 3.5;
        out.push({
          x: p.x + ox,
          z: sidewalkZ + oz,
          heading: rnd() * Math.PI * 2,
          shirt: SHIRTS[Math.floor(rnd() * SHIRTS.length)],
          phase: rnd() * Math.PI * 2,
          radius: 0.35 + rnd() * 1.05,
          crowd: commuter ? 'commuter' : p.kind === 'market' || p.kind === 'mall' || p.kind === 'shop' ? 'market' : 'food',
        });
      }
    }
    // auto-rickshaw stand clusters near transport POIs
    const autoKinds = ['bus', 'railway', 'hospital', 'mall'];
    for (const p of pois) {
      if (!autoKinds.includes(p.kind)) continue;
      const northFacing = p.z % P < P / 2;
      const standZ = p.z + (northFacing ? 5.5 : -5.5);
      for (let i = 0; i < 3; i++) {
        out.push({
          x: p.x + (i - 1) * 4.5, z: standZ, heading: northFacing ? Math.PI : 0,
          shirt: '#16a34a', phase: rnd() * Math.PI * 2, radius: 0.12, crowd: 'commuter',
        });
      }
    }
    return out;
  }, []);

  useEffect(() => {
    if (!body.current || !head.current || !legs.current || !arms.current) return;
    const c = new THREE.Color();
    const SKINS = ['#a46b48', '#bb8059', '#8c5a3c', '#c68642', '#7a4a2a', '#d19a70'];
    clusters.forEach((cl, i) => {
      body.current!.setColorAt(i, c.set(cl.shirt));
      head.current!.setColorAt(i, c.set(SKINS[i % SKINS.length]));
      for (let side = 0; side < 2; side++) arms.current!.setColorAt(i * 2 + side, c.set(cl.shirt));
    });
    for (const mesh of [body.current, head.current, arms.current]) if (mesh?.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [clusters]);

  useFrame(() => {
    if (!body.current || !head.current || !legs.current || !arms.current) return;
    const game = useGame.getState().g;
    const hour = game ? Math.floor(((game.time + rt.clockPartial) % 1440) / 60) : 12;
    const t = rt.simTimeSec;
    clusters.forEach((cl, i) => {
      const daytime = hour >= 6 && hour < 23;
      const mealRush = (hour >= 7 && hour < 10) || (hour >= 12 && hour < 15) || (hour >= 18 && hour < 22);
      const visible = cl.crowd === 'commuter' ? daytime || hour < 6 : cl.crowd === 'food' ? mealRush : hour >= 8 && hour < 23;
      const phase = t * (cl.crowd === 'commuter' ? 0.72 : 0.48) + cl.phase;
      const sway = visible ? Math.sin(phase * 2) : 0;
      const x = cl.x + Math.cos(phase * 0.35) * cl.radius;
      const z = cl.z + Math.sin(phase * 0.35) * cl.radius * 0.45;
      const heading = cl.heading + Math.sin(phase * 0.45) * 0.35;
      const scale = visible ? 1 : 0;
      const sin = Math.sin(heading), cos = Math.cos(heading);
      dummy.rotation.set(0, heading, 0);
      dummy.position.set(x, 1.15 + Math.abs(sway) * 0.035, z); dummy.scale.set(scale, scale, scale); dummy.updateMatrix(); body.current!.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x, 1.62 + Math.abs(sway) * 0.035, z); dummy.updateMatrix(); head.current!.setMatrixAt(i, dummy.matrix);
      for (let side = 0; side < 2; side++) {
        const sign = side ? 1 : -1;
        const legSwing = sign * sway * 0.08;
        dummy.position.set(x + cos * sign * 0.1 + sin * legSwing, 0.42, z - sin * sign * 0.1 + cos * legSwing);
        dummy.rotation.set(sign * sway * 0.18, heading, 0); dummy.scale.set(scale, scale, scale); dummy.updateMatrix(); legs.current!.setMatrixAt(i * 2 + side, dummy.matrix);
        dummy.position.set(x + cos * sign * 0.29, 1.14, z - sin * sign * 0.29);
        dummy.rotation.set(-sign * sway * 0.22, heading, 0); dummy.updateMatrix(); arms.current!.setMatrixAt(i * 2 + side, dummy.matrix);
      }
    });
    for (const mesh of [body.current, head.current, legs.current, arms.current]) mesh.instanceMatrix.needsUpdate = true;
  });

  const N = clusters.length;
  if (N === 0) return null;
  return (
    <>
      <instancedMesh ref={body} args={[undefined, undefined, N]} castShadow frustumCulled={false}><boxGeometry args={[0.44, 0.62, 0.26]} /><meshStandardMaterial roughness={0.8} /></instancedMesh>
      <instancedMesh ref={head} args={[undefined, undefined, N]} frustumCulled={false}><sphereGeometry args={[0.14, 8, 6]} /><meshStandardMaterial roughness={0.8} /></instancedMesh>
      <instancedMesh ref={legs} args={[undefined, undefined, N * 2]} castShadow frustumCulled={false}><boxGeometry args={[0.15, 0.8, 0.2]} /><meshStandardMaterial color="#2b3445" /></instancedMesh>
      <instancedMesh ref={arms} args={[undefined, undefined, N * 2]} castShadow frustumCulled={false}><boxGeometry args={[0.13, 0.55, 0.16]} /><meshStandardMaterial roughness={0.8} /></instancedMesh>
    </>
  );
}

/** Street-level props: tea stalls, push-carts, bus shelters, vendor umbrellas. */
export function StreetProps() {
  const items = useMemo(() => {
    const rnd = mulberry32(5577);
    const out: React.ReactNode[] = [];
    let key = 0;

    // Bus stop shelters near every bus/railway POI
    for (const p of pois) {
      if (p.kind !== 'bus' && p.kind !== 'railway') continue;
      const northFacing = p.z % P < P / 2;
      const sz = p.z + (northFacing ? 4.2 : -4.2);
      // shelter: roof + two posts
      out.push(
        <group key={key++} position={[p.x, 0, sz]}>
          <mesh position={[0, 2.6, 0]} castShadow><boxGeometry args={[7, 0.18, 2.2]} /><meshStandardMaterial color="#1d4ed8" /></mesh>
          <mesh position={[-3.2, 1.3, 0]}><boxGeometry args={[0.14, 2.6, 0.14]} /><meshStandardMaterial color="#374151" /></mesh>
          <mesh position={[3.2, 1.3, 0]}><boxGeometry args={[0.14, 2.6, 0.14]} /><meshStandardMaterial color="#374151" /></mesh>
          <mesh position={[0, 1.3, -1.0]}><boxGeometry args={[7, 2.6, 0.08]} /><meshStandardMaterial color="#93c5fd" transparent opacity={0.35} /></mesh>
        </group>
      );
    }

    // Tea stalls / chai kadai near restaurants and shops
    for (const p of pois) {
      if (p.kind !== 'restaurant' && p.kind !== 'shop') continue;
      if (rnd() > 0.55) continue;
      const northFacing = p.z % P < P / 2;
      const sz = p.z + (northFacing ? 3.8 : -3.8);
      const ox = (rnd() - 0.5) * 8;
      out.push(
        <group key={key++} position={[p.x + ox, 0, sz]}>
          {/* cart body */}
          <mesh position={[0, 0.55, 0]} castShadow><boxGeometry args={[1.4, 0.9, 0.8]} /><meshStandardMaterial color="#92400e" /></mesh>
          {/* umbrella pole */}
          <mesh position={[0, 1.6, 0]}><boxGeometry args={[0.06, 1.4, 0.06]} /><meshStandardMaterial color="#374151" /></mesh>
          {/* umbrella canopy */}
          <mesh position={[0, 2.4, 0]} rotation={[0, rnd() * Math.PI, 0]}><coneGeometry args={[1.4, 0.5, 8]} /><meshStandardMaterial color={['#ef4444', '#f59e0b', '#16a34a', '#2563eb'][Math.floor(rnd() * 4)]} /></mesh>
          {/* wheels */}
          <mesh position={[-0.5, 0.18, 0.45]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.18, 0.18, 0.1, 8]} /><meshStandardMaterial color="#111" /></mesh>
          <mesh position={[0.5, 0.18, 0.45]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.18, 0.18, 0.1, 8]} /><meshStandardMaterial color="#111" /></mesh>
        </group>
      );
    }

    // Roadside banners / flex boards between buildings along main roads
    const bannerColors = ['#ef4444', '#f59e0b', '#2563eb', '#16a34a', '#7c3aed'];
    for (let i = 0; i < 18; i++) {
      const bx = 1 * P + rnd() * 7 * P;
      const bz = rnd() * 9 * P;
      const col = bannerColors[Math.floor(rnd() * bannerColors.length)];
      out.push(
        <group key={key++} position={[bx, 0, bz]}>
          <mesh position={[0, 3.8, 0]}><boxGeometry args={[5.5, 1.2, 0.08]} /><meshStandardMaterial color={col} /></mesh>
          <mesh position={[-2.6, 1.9, 0]}><boxGeometry args={[0.1, 3.8, 0.1]} /><meshStandardMaterial color="#6b7280" /></mesh>
          <mesh position={[2.6, 1.9, 0]}><boxGeometry args={[0.1, 3.8, 0.1]} /><meshStandardMaterial color="#6b7280" /></mesh>
        </group>
      );
    }

    // Parked auto-rickshaws near transport hubs (static, decorative)
    for (const p of pois) {
      if (p.kind !== 'bus' && p.kind !== 'railway' && p.kind !== 'hospital') continue;
      const northFacing = p.z % P < P / 2;
      const az = p.z + (northFacing ? 6.5 : -6.5);
      for (let i = 0; i < 4; i++) {
        const ax = p.x + (i - 1.5) * 5;
        out.push(
          <group key={key++} position={[ax, 0, az]} rotation={[0, northFacing ? Math.PI : 0, 0]}>
            {/* auto body */}
            <mesh position={[0, 0.65, 0]} castShadow><boxGeometry args={[1.3, 0.7, 2.4]} /><meshStandardMaterial color="#16a34a" /></mesh>
            <mesh position={[0, 1.65, -0.2]} castShadow><boxGeometry args={[1.3, 0.1, 1.9]} /><meshStandardMaterial color="#facc15" /></mesh>
            <mesh position={[0, 1.2, 0.8]}><boxGeometry args={[1.2, 0.7, 0.05]} /><meshStandardMaterial color="#8fb8d8" transparent opacity={0.6} /></mesh>
            {([[-0.6, -0.8], [0.6, -0.8], [0, 1]] as [number, number][]).map(([wx, wz], wi) => (
              <mesh key={wi} position={[wx, 0.28, wz]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.18, 0.18, 0.1, 8]} /><meshStandardMaterial color="#111" /></mesh>
            ))}
          </group>
        );
      }
    }

    return out;
  }, []);

  return <>{items}</>;
}
