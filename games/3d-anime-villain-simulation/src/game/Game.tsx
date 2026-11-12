import { useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { G, K, V3, endFrame } from './runtime';
import { derive, useGame, useHud } from './store';
import { createWorld, type WorldScene } from './worldScene';
import { initFx, updateFx } from './fx';
import { initWorldInteractables, resetInteriorGroups, updateEnterables, updateInteract, resetInteriors } from './interact';
import { spawnWorldVehicles, updateVehicles, spawnOwned } from './vehiclesys';
import { clearActorMeshes, populateWorld, syncAllies, updateActors, updateAssault, updateResponse } from './actors';
import { rebuildPlayerRig, updateCamera, updatePlayer, updatePlayerRig } from './player';
import { activeSkill, updateCombat } from './combat';
import { initAudio, musicSet, setVolume } from './audio';
import { hudState } from './runtime';
import { saveSlot } from './save';
import { REGIONS, REGION_MAP, regionAt } from './data';
import { VSPECS } from './vehicles';

let session = 0; let world: WorldScene | null = null;

function startSession() {
  const s = useGame.getState(); const p = G.p;
  p.pos.set(s.pos[0], s.pos[1], s.pos[2]); if (p.interior || p.pos.y > 300 || Math.abs(p.pos.z) > 650 || Math.abs(p.pos.x) > 640) p.pos.set(-56, 0, 0);
  p.vel.set(0, 0, 0); p.flying = false; p.vehicle = null; p.interior = ''; p.dead = 0; p.form = 0; p.formT = 0; p.cd = { e: 0, r: 0, v: 0 }; p.atkT = 0; p.camYaw = Math.PI; p.yaw = 0; p.transT = 0; p.shield = 0; p.diving = false; p.dashT = 0; p.invT = 1;
  G.heat = 0; G.threat = 0; G.assault = null; G.boss = null; G.projectiles.length = 0; G.fields.length = 0; G.delayed.length = 0; G.learn = {}; G.cine.t = 0; G.camMode = 0; G.safeT = 0; G.tickT = 0; G.saveT = 0;
  const d = derive(s); p.maxHp = d.maxHp; p.maxEn = d.maxEn; p.hp = d.maxHp; p.en = d.maxEn;
  clearActorMeshes(); populateWorld(); if (world) spawnWorldVehicles(world.geos); resetInteriors(); rebuildPlayerRig(); s.refreshCands(); session++;
  if (s.slot !== 'menu') { /* ensure a save exists */ saveSlot(s.slot, s.snapshot()); }
}
export function summonGarageVehicle(type: string) { const s = useGame.getState(); const v = s.vehicles.find((x) => x.type === type); if (!v) return; const veh = spawnOwned(type, v.color); G.p.pos.set(veh.pos.x + 4, 0, veh.pos.z); }

function Scene() {
  const { scene, gl, camera } = useThree(); const cam = camera as THREE.PerspectiveCamera; const hudT = useRef(0); const fpsAcc = useRef(60);
  useEffect(() => {
    gl.shadowMap.enabled = true; gl.shadowMap.type = THREE.PCFSoftShadowMap; gl.toneMapping = THREE.ACESFilmicToneMapping; gl.outputColorSpace = THREE.SRGBColorSpace;
    const gfx = useGame.getState().settings.gfx; G.enterables.length = 0; G.interactables.length = 0; resetInteriorGroups(); initFx(gfx);
    const w = createWorld(scene, gl, gfx); scene.add(w.root); world = w; initWorldInteractables(); spawnWorldVehicles(w.geos); populateWorld(); rebuildPlayerRig(); G.running = true;
    G.p.pos.set(-56, 0, 14); useGame.getState().refreshCands();
    setVolume(useGame.getState().settings.volume);
    const unsub = useGame.subscribe((s, prev) => {
      if (s.screen === 'game' && prev.screen !== 'game') startSession();
      if (s.settings.gfx !== prev.settings.gfx) { w.applyGfx(s.settings.gfx); initFx(s.settings.gfx); }
      if (s.settings.volume !== prev.settings.volume) setVolume(s.settings.volume);
      if (s.settings.music !== prev.settings.music) musicSet(s.settings.music);
      if (s.overlay !== prev.overlay && s.overlay) { K.down.clear(); K.pressed.clear(); K.lmb = false; K.rmb = false; if (document.pointerLockElement) document.exitPointerLock(); }
    });
    const el = gl.domElement;
    const onKey = (e: KeyboardEvent, dn: boolean) => {
      const s = useGame.getState(); if (dn) { initAudio(); if (s.settings.music) musicSet(true); }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ControlLeft'].includes(e.code) || e.ctrlKey || e.altKey) && s.screen === 'game' && !s.overlay) e.preventDefault();
      if (dn && !e.repeat && s.screen === 'game') {
        const tog = (o: typeof s.overlay, sub = '') => { s.setOverlay(s.overlay === o ? '' : o, sub); };
        const map: Record<string, () => void> = { KeyI: () => tog('inventory'), KeyK: () => tog('skills'), KeyM: () => tog('map'), Tab: () => tog('org'), KeyJ: () => tog('missions'), KeyP: () => tog('character'), Escape: () => s.setOverlay(s.overlay ? '' : 'pause') };
        if (map[e.code]) { map[e.code](); if (!useGame.getState().overlay && !document.pointerLockElement) el.requestPointerLock?.(); return; }
      }
      if (s.overlay || s.screen !== 'game') return;
      if (dn) { if (!e.repeat) K.pressed.add(e.code); K.down.add(e.code); } else K.down.delete(e.code);
    };
    const kd = (e: KeyboardEvent) => onKey(e, true), ku = (e: KeyboardEvent) => onKey(e, false);
    const mm = (e: MouseEvent) => { if (document.pointerLockElement === el || (K.noLock && (e.altKey || (e.buttons & 4)))) { K.mdx += e.movementX; K.mdy += e.movementY; } };
    const md = (e: MouseEvent) => {
      const s = useGame.getState(); if (s.screen !== 'game' || s.overlay) return; initAudio();
      if (document.pointerLockElement !== el && !K.noLock) { try { el.requestPointerLock?.(); } catch { K.noLock = true; } return; }
      if (e.button === 0) { K.lmb = true; K.lmbP = true; } if (e.button === 2) { K.rmb = true; K.rmbP = true; }
    };
    const mu = (e: MouseEvent) => { if (e.button === 0) K.lmb = false; if (e.button === 2) K.rmb = false; };
    const wh = (e: WheelEvent) => { if (!useGame.getState().overlay) K.wheel += e.deltaY; };
    const pl = () => { K.locked = document.pointerLockElement === el; const s = useGame.getState(); if (!K.locked && s.screen === 'game' && !s.overlay && !G.p.dead) { /* ESC pressed while locked */ setTimeout(() => { const s2 = useGame.getState(); if (s2.screen === 'game' && !s2.overlay && document.pointerLockElement !== el && Date.now() - lastOverlay > 300) s2.setOverlay('pause'); }, 60); } };
    let lastOverlay = 0; const unsub2 = useGame.subscribe((s, prev) => { if (s.overlay !== prev.overlay) lastOverlay = Date.now(); });
    const ctx = (e: Event) => e.preventDefault(); const blur = () => { K.down.clear(); K.lmb = false; K.rmb = false; };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); window.addEventListener('mousemove', mm); el.addEventListener('mousedown', md); window.addEventListener('mouseup', mu); window.addEventListener('wheel', wh, { passive: true }); document.addEventListener('pointerlockchange', pl); const ple = () => { K.noLock = true; }; document.addEventListener('pointerlockerror', ple); el.addEventListener('contextmenu', ctx); window.addEventListener('blur', blur);
    return () => { unsub(); unsub2(); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('mousemove', mm); el.removeEventListener('mousedown', md); window.removeEventListener('mouseup', mu); window.removeEventListener('wheel', wh); document.removeEventListener('pointerlockchange', pl); document.removeEventListener('pointerlockerror', ple); el.removeEventListener('contextmenu', ctx); window.removeEventListener('blur', blur); scene.remove(w.root); };
  }, [scene, gl]);

  useFrame((_, dtRaw) => {
    const w = world; if (!w) return; const dt = Math.min(dtRaw, 0.05); const s = useGame.getState(); const menu = s.screen === 'menu'; const overlay = !!s.overlay; G.paused = overlay;
    fpsAcc.current += (1 / Math.max(dtRaw, 0.001) - fpsAcc.current) * 0.05; G.fps = fpsAcc.current;
    let sdt = dt; if (G.hitStop > 0) { G.hitStop -= dt; sdt = dt * 0.08; }
    const play = !menu && !overlay;
    if (play) {
      updatePlayer(sdt, cam); updateCombat(sdt); updateVehicles(sdt, nightOf()); updateActors(sdt, cam); updateResponse(sdt); syncAllies(sdt); updateAssault(sdt); updateInteract(sdt); updateEnterables();
      G.tickT += sdt; if (G.tickT > 30) { G.tickT = 0; s.tick(); } G.saveT += sdt; if (G.saveT > 150) { G.saveT = 0; saveSlot('auto', s.snapshot()); }
      const rg = regionAt(G.p.pos.x, G.p.pos.z); if (rg) G.regionId = rg.id;
    } else if (menu) { updateVehicles(dt, nightOf()); updateActors(dt * 0.3, cam); }
    updatePlayerRig(play ? sdt : menu ? dt : 0);
    if (menu) {
      const p = G.p; p.camYaw += dt * 0.12; cam.fov = 40; cam.updateProjectionMatrix(); const tg = new V3(p.pos.x, 1.15, p.pos.z); const a = p.camYaw; const r = new V3(Math.cos(a), 0, -Math.sin(a));
      cam.position.set(tg.x + Math.sin(a) * 4.6, 1.5, tg.z + Math.cos(a) * 4.6); cam.lookAt(tg.x + r.x * 1.5, 1.2, tg.z + r.z * 1.5); p.yaw = a + 0.64; p.flying = false;
      G.p.dead = 0;
    } else updateCamera(play ? dt : 0, cam);
    w.update(overlay ? 0 : dt, cam); updateFx(play ? sdt : overlay ? 0 : dt); endFrame();
    hudT.current -= dt; if (hudT.current <= 0 && !menu) { hudT.current = 0.1; pushHud(s); }
  });
  return null;
}
const nightOf = () => { const el = Math.sin(((G.time - 6) / 24) * Math.PI * 2); return Math.max(0, Math.min(1, (0.12 - el) / 0.24)); };

function pushHud(s: ReturnType<typeof useGame.getState>) {
  const p = G.p; const d = derive(s); const rg = REGION_MAP[G.regionId] ?? REGIONS[4];
  const cdOf = (k: 'e' | 'r' | 'v') => { const sk = activeSkill(k); return sk ? Math.max(0, p.cd[k]) / sk.cd : 0; };
  let wp = -1; if (G.waypoint) wp = Math.hypot(G.waypoint.x - p.pos.x, G.waypoint.z - p.pos.z);
  useHud.setState({
    hp: p.hp, maxHp: d.maxHp, en: p.en, maxEn: d.maxEn, speed: p.vehicle ? Math.abs(p.vehicle.speed) * 3.6 : p.speed * 3.6, flying: p.flying, boost: p.boost, threat: G.threat, form: p.form, formT: p.formT, cd: [cdOf('e'), cdOf('r'), cdOf('v')],
    prompt: hudState.prompt, progress: hudState.progress, boss: G.boss ? { ...G.boss } : null, region: p.interior === 'hq' ? 'Your Headquarters' : p.interior === 'bunker' ? 'Underground Black Market' : rg.name, regionState: s.terr[rg.id]?.state ?? '', time: G.time, weather: G.weather, fps: Math.round(G.fps),
    alt: p.pos.y, combo: p.chain, vehicle: p.vehicle ? VSPECS[p.vehicle.type].name : '', vhp: p.vehicle ? p.vehicle.hp / p.vehicle.maxHp : 0, wpDist: wp, cine: G.cine.t > 0 ? G.cine.t / G.cine.dur : 0, dead: p.dead, hint: '',
  });
}

export default function GameCanvas() {
  const gfx = useGame((s) => s.settings.gfx); const dpr = { low: 0.7, medium: 1, high: Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 1.5), ultra: Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2) }[gfx];
  return (
    <Canvas shadows camera={{ fov: 64, near: 0.1, far: 2600, position: [0, 3, 8] }} dpr={dpr} gl={{ antialias: gfx !== 'low', powerPreference: 'high-performance' }} style={{ position: 'absolute', inset: 0 }}>
      <Scene />
    </Canvas>
  );
}
