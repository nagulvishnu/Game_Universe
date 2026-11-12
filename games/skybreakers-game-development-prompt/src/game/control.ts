// Game controller: scene init, main frame loop, camera rig, intro/menu cinematics, start/quit/save.
import * as THREE from 'three';
import { QUESTS } from './data';
import { audio } from './audio';
import { clearPickups, updatePickups, updateProjectiles } from './combat';
import { initShip, rebuildShip, updateShip } from './airship';
import { createAtmosphere, type Atmos } from './atmosphere';
import { resetBosses, updateBoss } from './boss';
import { resetEnemies, updateEnemies } from './enemies';
import { initEntities, resetNodes, updateEntities } from './entities';
import { resetEvents, updateEvents } from './events';
import { fx } from './fx';
import { resetKingdomScene, syncKingdom, updateKingdom, updatePlacement } from './kingdom';
import { buildBoss } from './models';
import { buildAirship } from './models2';
import { buildPlayerModel, resetPlayer, updatePlayer } from './player';
import { G, clamp, input, lerp, rand } from './runtime';
import { maxHp, useStore } from './store';
import { buildWorld, type WorldRig } from './terrain';
import { WORLD, groundAt, islandAt, ISLAND_MAP } from './world';

(window as any).__QUESTS = QUESTS;
let rig: WorldRig, atmos: Atmos; let inited = false; let renderer: THREE.WebGLRenderer | null = null;
let introShip: THREE.Group, introDragon: THREE.Group; let saveT = 0;
const V = new THREE.Vector3(), V2 = new THREE.Vector3(), CAMTMP = new THREE.Vector3(); const camLook = new THREE.Vector3();

export function initGame(scene: THREE.Scene, camera: THREE.PerspectiveCamera, gl: THREE.WebGLRenderer) {
  if (inited) return; inited = true; renderer = gl; const st = useStore.getState(); const q = st.settings.quality;
  G.scene = scene; G.camera = camera; fx.init(scene, q);
  rig = buildWorld(q); scene.add(rig.group); atmos = createAtmosphere(scene, q);
  initEntities(); initShip(); buildPlayerModel();
  introShip = buildAirship('windrunner', { hullColor: '#8a5a34', sailColor: '#f3ecd8', trimColor: '#d4a537', decor: ['flag', 'lanterns'], style: 'sails', upgrades: {} }); introShip.visible = false; scene.add(introShip);
  introDragon = buildBoss('wyrm'); introDragon.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) m.material = new THREE.MeshBasicMaterial({ color: '#05060c', side: THREE.DoubleSide }); if ((o as any).isSprite) o.visible = false; }); introDragon.scale.setScalar(2.2); introDragon.visible = false; scene.add(introDragon);
  G.dayT = 0.27; G.player.pos.set(0, 3, 14); G.cam.ready = true; applyQuality(q);
}
export function applyQuality(q: 'low' | 'medium' | 'high') { atmos?.setQuality(q); void renderer; }

export function startGame(mode: 'new' | 'continue') {
  const st = useStore.getState(); audio.init();
  if (mode === 'continue' && st.saveExists) st.load(); else st.newGame();
  const s = useStore.getState();
  resetEnemies(); resetBosses(); clearPickups(); resetKingdomScene(); resetEvents(); for (const p of G.projs) G.scene!.remove(p.mesh); G.projs.length = 0;
  G.interactables = G.interactables.filter(i => !i.id.startsWith('bld') && !i.id.startsWith('tr'));
  G.ship.pos.set(...s.shipPos); G.ship.yaw = s.shipYaw; initShip(); G.ship.missiles = 6; G.ship.weapon = 'cannon';
  const g = groundAt(s.pos[0], s.pos[2], s.pos[1] + 30); const pos = new THREE.Vector3(s.pos[0], g > -1e8 ? g + 0.2 : s.pos[1], s.pos[2]);
  G.player.cd = {}; resetPlayer(pos); G.player.yaw = 0; G.dayT = s.dayTime; G.cam.yaw = 0; G.cam.pitch = 0.35; G.cam.dist = 8; G.cam.cine = null; G.timeScale = 1; G.bossFight = false; G.boss = null; G.currentIsland = ''; G.lastIsland = ''; G.event.next = 90;
  buildPlayerModel(); resetNodes(); syncKingdom(); G.paused = false;
  useStore.setState({ screen: 'play', panel: null, placing: null, dialogNpc: null });
  if (mode === 'new') { setTimeout(() => { const t = useStore.getState(); t.setBanner('AETHERIA', 'Speak with Elder Maren to begin your journey'); t.toast('WASD move · Shift sprint · Space jump · LMB attack · RMB block · V dodge · E interact · I inventory', 'info'); }, 600); }
  else setTimeout(() => useStore.getState().setBanner('WELCOME BACK', 'Your adventure continues'), 600);
  G.autosave = 0; cameraSnap();
}
export function saveNow() {
  const s = useStore.getState(); if (s.screen !== 'play') return; const p = G.player;
  s.set_({ pos: [p.pos.x, p.pos.y, p.pos.z], shipPos: [G.ship.pos.x, G.ship.pos.y, G.ship.pos.z], shipYaw: G.ship.yaw, dayTime: G.dayT }); s.save();
}
export function toMenu() { saveNow(); G.paused = false; G.player.inShip = false; useStore.setState({ screen: 'menu', panel: null, placing: null, saveExists: true }); G.cam.menuT = 0; if (document.pointerLockElement) document.exitPointerLock(); }
function cameraSnap() { const cam = G.camera!; const p = G.player; cam.position.set(p.pos.x + 6, p.pos.y + 4, p.pos.z + 6); G.cam.pos.copy(cam.position); }

// ───────── cinematic paths ─────────
const verd = ISLAND_MAP.verdant, frost = ISLAND_MAP.frost, cel = ISLAND_MAP.celestial;
const fall = WORLD.falls.find(f => f.isl === 'verdant')!;
const INTRO: { t: number; p: [number, number, number]; l: [number, number, number] }[] = [
  { t: 0, p: [-260, -150, -900], l: [-100, -100, -300] }, { t: 7, p: [-60, -70, -480], l: [0, 30, 0] }, { t: 11, p: [fall.x - 70, fall.y - 40, fall.z - 60], l: [fall.x, fall.y - 60, fall.z] }, { t: 17, p: [fall.x + 20, fall.y - 150, fall.z - 70], l: [fall.x, fall.y - 70, fall.z] },
  { t: 21, p: [frost.x + 180, frost.y + 50, frost.z + 160], l: [frost.x - 30, frost.y + 25, frost.z - 30] }, { t: 26, p: [frost.x + 60, frost.y + 40, frost.z + 100], l: [frost.x - 30, frost.y + 30, frost.z - 30] },
  { t: 28, p: [-50, 40, -70], l: [60, 80, 50] }, { t: 33, p: [-40, 20, -160], l: [30, 90, 40] }, { t: 36, p: [0, 60, -220], l: [0, 120, 0] }, { t: 40, p: [0, 90, -300], l: [0, 140, 0] },
];
export const INTRO_LEN = 40;
function path(list: typeof INTRO, t: number, outP: THREE.Vector3, outL: THREE.Vector3) {
  let i = 0; while (i < list.length - 2 && t > list[i + 1].t) i++; const a = list[i], b = list[Math.min(list.length - 1, i + 1)]; const k = clamp((t - a.t) / Math.max(0.01, b.t - a.t), 0, 1); const s = k * k * (3 - 2 * k);
  outP.set(lerp(a.p[0], b.p[0], s), lerp(a.p[1], b.p[1], s), lerp(a.p[2], b.p[2], s)); outL.set(lerp(a.l[0], b.l[0], s), lerp(a.l[1], b.l[1], s), lerp(a.l[2], b.l[2], s));
}
function introActors(t: number) {
  // airship crossing (t 22-30) and dragon silhouette (28-38)
  const sh = introShip; sh.visible = t > 15 && t < 33; if (sh.visible) { const k = (t - 15) / 18; sh.position.set(lerp(-200, 140, k), 60 + Math.sin(t) * 2, lerp(-130, 60, k)); sh.rotation.set(0, Math.atan2(340, 190), Math.sin(t * 1.2) * 0.05); for (const p of sh.userData.props) p.rotation.z += 0.8; }
  const d = introDragon; d.visible = t > 27; if (d.visible) { const k = (t - 27) / 13; d.position.set(lerp(-120, 160, k), 100 + Math.sin(k * 5) * 6, lerp(-80, 120, k)); d.rotation.set(0, Math.atan2(280, 200), Math.sin(t * 2) * 0.1); const P = d.userData.parts; if (P.wingL) { P.wingL.rotation.z = -Math.sin(t * 2.4) * 0.5; P.wingR.rotation.z = Math.sin(t * 2.4) * 0.5; } }
}

// ───────── frame ─────────
export function frame(rawDt: number) {
  if (!inited) return; const st = useStore.getState(); const cam = G.camera!; let dt = Math.min(rawDt, 0.05);
  const screen = st.screen; G.paused = screen !== 'play' || st.panel !== null;
  if (G.hitStop > 0) { G.hitStop -= rawDt; dt *= 0.05; }
  dt *= G.timeScale; const sdt = G.paused ? 0 : dt;
  rig.update(rawDt * (G.paused ? 0.3 : 1), cam.position);
  const p = G.player; const o = p.inShip ? G.ship.pos : p.pos;
  if (screen === 'intro') { G.cam.introT += rawDt; G.dayT = 0.27 + G.cam.introT * 0.0005; introActors(G.cam.introT); path(INTRO, G.cam.introT, CAMTMP, camLook); cam.position.copy(CAMTMP); cam.lookAt(camLook); cam.fov = 60; cam.updateProjectionMatrix(); atmos.update(rawDt, cam, camLook); fx.update(rawDt, renderer ? renderer.domElement.height : 800); audio.update(rawDt, { shipSpeed: 0, shipThrottle: 0, inShip: false, speed: 0, alt: 200, waterNear: 0, biome: 'none', night: false, mood: 'menu', storm: 0 }); input.endFrame(); return; }
  introShip.visible = false; introDragon.visible = false;
  if (screen === 'menu') {
    G.cam.menuT += rawDt; G.dayT = (G.dayT + rawDt / 260) % 1; const t = G.cam.menuT * 0.06; const targets = [verd, frost, cel, ISLAND_MAP.ember]; const isl = targets[Math.floor(G.cam.menuT / 40) % targets.length]; const r = isl.r * 1.3 + 40;
    CAMTMP.set(isl.x + Math.cos(t + isl.seed) * r, isl.y + 38 + Math.sin(t * 2) * 8, isl.z + Math.sin(t + isl.seed) * r); cam.position.lerp(CAMTMP, Math.min(1, rawDt * 0.8)); camLook.lerp(V.set(isl.x, isl.y + 8, isl.z), Math.min(1, rawDt * 1.5)); cam.lookAt(camLook); cam.fov = 58; cam.updateProjectionMatrix();
    atmos.update(rawDt, cam, V2.set(isl.x, isl.y, isl.z)); fx.update(rawDt, renderer ? renderer.domElement.height : 800); audio.update(rawDt, { shipSpeed: 0, shipThrottle: 0, inShip: false, speed: 0, alt: 100, waterNear: 0.3, biome: isl.biome, night: false, mood: 'menu', storm: 0 }); input.endFrame(); return;
  }
  // ── play ──
  if (!G.paused) {
    G.t += dt; updateEvents(dt); updatePlayer(dt); updateShip(dt); updateEnemies(dt); updateBoss(dt); updateProjectiles(dt); updatePickups(dt); updateEntities(dt); updateKingdom(dt); updatePlacement(dt);
    st.playTime += dt; saveT += dt; if (saveT > 45) { saveT = 0; saveNow(); }
    if (st.placing && input.hit('Escape')) useStore.getState().set_({ placing: null });
    if (G.cam.cine) { const c = G.cam.cine; c.t += rawDt; if (c.t >= c.dur) { G.cam.cine = null; c.fn?.(); } }
    G.cam.shake = Math.max(0, G.cam.shake - rawDt * 1.4);
  } else { updatePlacementOff(); }
  // camera
  updateCamera(rawDt, dt);
  const focus = V2.copy(o); atmos.update(rawDt, cam, focus); fx.update(sdt > 0 ? sdt : rawDt * 0.0, renderer ? renderer.domElement.height : 800);
  // audio
  const isl = islandAt(o.x, o.z); const biome = isl && Math.abs(o.y - isl.y) < 120 ? isl.biome : 'none'; let near = 0; for (const f of WORLD.falls) { const d = Math.hypot(f.x - o.x, f.z - o.z) + Math.abs(f.y - o.y) * 0.3; near = Math.max(near, 1 - d / 90); }
  const night = G.dayT > 0.78 || G.dayT < 0.2; const mood = G.bossFight ? 'boss' : G.combatT > 0 ? 'battle' : p.inShip ? 'airship' : biome === 'frost' ? 'frost' : biome === 'ember' ? 'ember' : biome === 'shadow' ? 'shadow' : biome === 'celestial' ? 'celestial' : 'explore';
  audio.update(rawDt, { shipSpeed: Math.abs(G.ship.speed), shipThrottle: G.ship.throttle, inShip: p.inShip && !G.paused, speed: p.moveAmt, alt: o.y - (isl?.y ?? 0), waterNear: Math.max(0, near), biome, night, mood: G.paused && st.panel === 'pause' ? 'menu' : mood, storm: G.weather.type === 'storm' ? G.weather.i : 0 });
  if (!G.paused && p.hp > 0 && p.hp < maxHp(st) * 0.01) p.hp = 1;
  input.endFrame();
}
function updatePlacementOff() { /* ghost remains while paused */ }

function updateCamera(rawDt: number, dt: number) {
  const cam = G.camera!; const c = G.cam; const p = G.player; const st = useStore.getState();
  if (c.cine) { const cn = c.cine; const k = clamp(cn.t / cn.dur, 0, 1); const s = k * k * (3 - 2 * k); CAMTMP.lerpVectors(cn.from, cn.to, s); cam.position.copy(CAMTMP); const tg = cn.target instanceof THREE.Vector3 ? cn.target : (cn.target as THREE.Object3D).position; camLook.copy(tg); cam.lookAt(camLook); cam.fov = lerp(48, 62, 1 - s); cam.updateProjectionMatrix(); return; }
  const inShip = p.inShip; const sc = inShip ? (G.ship.obj?.userData.scale || 1) : 1; const target = V.copy(inShip ? G.ship.pos : p.pos); target.y += inShip ? 3 * sc : 1.7;
  if (inShip) { c.dist = lerp(c.dist, 24 * Math.pow(sc, 0.8) + 6, rawDt * 2); const mouse = Math.abs(input.mdx) + Math.abs(input.mdy) > 0; if (mouse) c.orbitT = 1.8; else c.orbitT -= rawDt; if (c.orbitT < 0 && !G.paused) { let d = (G.ship.yaw + Math.PI) - c.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); c.yaw += d * Math.min(1, rawDt * 1.6); c.pitch = lerp(c.pitch, 0.2, rawDt * 1.2); } }
  else { if (!G.paused) c.dist = clamp(c.dist, 4, 14); if (p.lock && !p.lock.dead && !G.paused) { const want = Math.atan2(p.pos.x - p.lock.pos.x, p.pos.z - p.lock.pos.z); let d = want - c.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); c.yaw += d * Math.min(1, rawDt * 4); c.pitch = lerp(c.pitch, 0.32, rawDt * 3); } }
  const cp = Math.cos(c.pitch); const dist = c.dist * (p.charging && !inShip && st.weapon === 'bow' ? 0.8 : 1);
  CAMTMP.set(target.x + Math.sin(c.yaw) * cp * dist, target.y + Math.sin(c.pitch) * dist, target.z + Math.cos(c.yaw) * cp * dist);
  const gy = groundAt(CAMTMP.x, CAMTMP.z, CAMTMP.y + 60); if (gy > -1e8 && CAMTMP.y < gy + 1.2) CAMTMP.y = gy + 1.2;
  const k = 1 - Math.exp(-(inShip ? 9 : 16) * rawDt); c.pos.lerp(CAMTMP, G.paused ? 0 : k); if (c.pos.distanceTo(CAMTMP) > 60) c.pos.copy(CAMTMP);
  cam.position.copy(c.pos); if (st.settings.shake && c.shake > 0) cam.position.add(V2.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(c.shake * 0.5));
  cam.lookAt(target.x, target.y + (inShip ? 1 : 0.1), target.z);
  const wantFov = 62 + (p.sprinting ? 6 : 0) + (inShip && G.ship.boosting ? 16 : inShip ? Math.abs(G.ship.speed) * 0.1 : 0) - (p.charging && st.weapon === 'bow' ? 8 : 0); c.fov = lerp(c.fov, wantFov, rawDt * 4); cam.fov = c.fov; cam.updateProjectionMatrix(); void dt;
}
export { rebuildShip };
