import * as THREE from "three";
import { G, P, V3, clamp, lerp, damp, dampAng, rnd, sstep } from "./core";
import { buildCity, mapCanvas, winU, env, districtOf, DIST_NAMES, rayHit, ARENA, MAPHALF } from "./world";
import { fx, shake } from "./fx";
import { initAudio, sfx, setVolumes, setMusicLevel } from "./audio";
import { initCity, updateCity, spawnProp as _sp } from "./city";
import { initPlayer, updatePlayer, rigs, switchHero, applyMods, resetPlayerState, aim as _aim } from "./player";
import { initEnemies, updateEnemies, removeEnemy } from "./enemies";
import "./bosses";
import { updateBosses } from "./bosses";
import { initAllies, updateAllies, updateSouls, restoreAllies, removeAlly } from "./allies";
import { initMissions, updateMissions, MISSIONS, missionState, startMission, endMission, abandonMission, zoneMarkers } from "./missions";
import { updateProjectiles, updateWaves, clearProjectiles, killEnemy } from "./combat";
import { buildChar, animate, Rig } from "./rig";
import { useGame, useHud, toast, banner } from "../store";
import { HERO, HeroId } from "../data";

void _sp; void _aim;
let scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer;
let sky: THREE.Mesh, skyMat: THREE.ShaderMaterial;
let hemi: THREE.HemisphereLight, sun: THREE.DirectionalLight;
let fog: THREE.FogExp2;
let inited = false;
let gameStarted = false;
let dayT = 0.33;
const STAGE = new V3(2000, 0, 2000);
const show: Record<string, Rig> = {};
let stageLights: THREE.PointLight[] = [];
let hudT = 0, musicT = 0;
const SPAWN = new V3(0, 0, 20);

/* ---------------- sky ---------------- */
function makeSky() {
  skyMat = new THREE.ShaderMaterial({
    uniforms: { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSun: { value: new V3(0, 1, 0) }, uSunCol: { value: new THREE.Color(1, 0.9, 0.7) }, uNight: { value: 0 }, uTime: { value: 0 } },
    vertexShader: `varying vec3 vDir; void main(){ vDir=normalize(position); vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position=p.xyww; }`,
    fragmentShader: `varying vec3 vDir; uniform vec3 uTop,uHor,uSun,uSunCol; uniform float uNight,uTime;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*noise(p);p*=2.03;a*=.5;}return s;}
      void main(){
        vec3 d=normalize(vDir); float h=clamp(d.y,0.,1.);
        vec3 col=mix(uHor,uTop,pow(h,0.45));
        if(d.y<0.) col=mix(uHor,uHor*0.6,clamp(-d.y*4.,0.,1.));
        float sd=max(dot(d,uSun),0.);
        col+=uSunCol*(pow(sd,1200.)*10.+pow(sd,12.)*0.35+pow(sd,3.)*0.1*(1.-uNight));
        vec3 md=-uSun; float mdt=max(dot(d,md),0.);
        col+=vec3(0.8,0.85,1.0)*pow(mdt,1800.)*5.*uNight*step(0.,d.y)+vec3(0.15,0.2,0.4)*pow(mdt,25.)*0.15*uNight;
        if(d.y>0.){ vec2 sp=d.xz/(d.y+0.3)*70.; vec2 id=floor(sp); float r=hash(id); float st=step(0.982,r)*smoothstep(0.5,0.0,length(fract(sp)-0.5)); col+=vec3(st)*uNight*(0.6+0.4*sin(uTime*2.+r*50.)); }
        if(d.y>0.015){ vec2 cp=d.xz/(d.y+0.18)*1.4+vec2(uTime*0.012,uTime*0.004); float c=fbm(cp*1.3); c=smoothstep(0.48,0.82,c); float fade=smoothstep(0.015,0.22,d.y);
          vec3 cc=mix(vec3(0.05,0.06,0.1),vec3(1.0),1.0-uNight*0.92); cc=mix(cc,uSunCol*1.1+uHor*0.3,pow(sd,3.)*0.6*(1.-uNight)); cc*=mix(vec3(1.),uHor*1.5+0.3,0.35);
          col=mix(col,cc,c*fade*0.9); }
        gl_FragColor=vec4(col,1.);
      }`,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 20), skyMat);
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  scene.add(sky);
}
const cTopD = new THREE.Color(0.06, 0.22, 0.62), cHorD = new THREE.Color(0.42, 0.68, 0.95), cTopN = new THREE.Color(0.004, 0.008, 0.035), cHorN = new THREE.Color(0.02, 0.03, 0.08), cSet = new THREE.Color(1.0, 0.36, 0.14);
const cArena = new THREE.Color(0.01, 0.006, 0.03), cDark = new THREE.Color(0.02, 0.0, 0.05);
const _c1 = new THREE.Color(), _c2 = new THREE.Color();
let darkMix = 0, arenaMix = 0;
function updateEnv(dt: number) {
  dayT = (dayT + dt / 520) % 1;
  const a = (dayT - 0.25) * Math.PI * 2;
  const sd = new V3(Math.cos(a) * 0.85, Math.sin(a), 0.45).normalize();
  const elev = sd.y;
  const day = sstep(-0.12, 0.28, elev);
  const night = 1 - day;
  const setAmt = (1 - sstep(0.0, 0.34, Math.abs(elev))) * 0.8;
  _c1.copy(cTopN).lerp(cTopD, day);
  _c2.copy(cHorN).lerp(cHorD, day).lerp(cSet, setAmt);
  darkMix = damp(darkMix, G.darkT > 0 ? 1 : 0, 2, dt);
  arenaMix = damp(arenaMix, P.pos.x > 600 ? 1 : 0, 6, dt);
  skyMat.uniforms.uTop.value.copy(_c1);
  skyMat.uniforms.uHor.value.copy(_c2);
  skyMat.uniforms.uSun.value.copy(sd);
  skyMat.uniforms.uNight.value = night;
  skyMat.uniforms.uTime.value = G.time;
  skyMat.uniforms.uSunCol.value.set(1, 0.85 - setAmt * 0.3, 0.6 - setAmt * 0.3);
  sky.position.copy(camera.position);
  const fc = _c2.clone().multiplyScalar(0.85);
  fc.lerp(cDark, darkMix * 0.8).lerp(cArena, arenaMix);
  fog.color.copy(fc);
  scene.background = fc;
  fog.density = lerp(0.0021, 0.0075, Math.max(arenaMix, darkMix * 0.6));
  hemi.color.copy(_c1).lerp(new THREE.Color(0.7, 0.75, 0.9), 0.4);
  hemi.groundColor.set(0x3a342e);
  const dm = 1 - darkMix * 0.6;
  hemi.intensity = (0.45 + 0.85 * day) * dm * (1 - arenaMix * 0.3) + arenaMix * 0.35;
  const sunUp = elev > 0;
  const dir = sunUp ? sd : sd.clone().negate();
  sun.color.set(sunUp ? (setAmt > 0.2 ? 0xffb070 : 0xfff2dd) : 0x7f93ff);
  sun.intensity = (sunUp ? 3.0 * day : 0.45 * night) * dm * (1 - arenaMix);
  sun.position.copy(P.pos).addScaledVector(dir, 140);
  sun.target.position.copy(P.pos);
  sun.target.updateMatrixWorld();
  winU.uNight.value = Math.max(night, arenaMix, darkMix * 0.7);
  env.lampMat.emissiveIntensity = night * 2.2;
  env.neonMat.emissiveIntensity = 1.2 + night * 1.2;
  const hrs = dayT * 24, hh = Math.floor(hrs), mm = Math.floor((hrs - hh) * 60);
  (G as any).clock = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/* ---------------- init ---------------- */
export function initEngine(three: { scene: THREE.Scene; camera: THREE.PerspectiveCamera; gl: THREE.WebGLRenderer }) {
  if (inited) return;
  inited = true;
  scene = three.scene; camera = three.camera; renderer = three.gl;
  G.scene = scene; G.camera = camera;

  scene.add(G.root);
  fog = new THREE.FogExp2(0x88aacc, 0.002);
  scene.fog = fog;
  makeSky();
  hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
  scene.add(hemi);
  sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.castShadow = false;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 20; sc.far = 320;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.6;
  scene.add(sun, sun.target);
  fx.init(G.root);
  buildCity(G.root);
  initCity(G.root);
  initPlayer(G.root);
  initEnemies(G.root);
  initAllies(G.root);
  initMissions(G.root);
  buildStage();
  G.hooks.kill = killEnemy;
  G.hooks.perfect = () => { toast("PERFECT DODGE!", "#7fe8ff"); useHud.setState({ perfect: performance.now() }); };
  G.hooks.toast = toast;
  G.hooks.playerDown = playerDown;
  G.hooks.usePortal = usePortal;
  bindInput();
  const st = useGame.getState();
  applySettings();
  P.hero = st.hero;
  applyMods();
  for (const h of ["kairo", "ryujin"] as HeroId[]) { P.hp[h] = P.maxHp[h]; P.en[h] = P.maxEn[h]; rigs[h].root.visible = h === P.hero; }
  syncMode(st.screen);
  useGame.subscribe((s, prev) => {
    if (s.screen !== prev.screen) onScreen(s.screen, prev.screen);
    if (s.settings !== prev.settings) applySettings();
    if (s.upgrades !== prev.upgrades) applyMods();
  });
}

function buildStage() {
  const g = new THREE.Group();
  g.position.copy(STAGE);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(7, 7.6, 0.6, 48), new THREE.MeshStandardMaterial({ color: 0x15161f, metalness: 0.8, roughness: 0.3 }));
  base.position.y = -0.3;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(6.6, 0.07, 8, 64), new THREE.MeshBasicMaterial({ color: 0xffd23f }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.02;
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.05, 8, 64), new THREE.MeshBasicMaterial({ color: 0x8a5cff }));
  ring2.rotation.x = Math.PI / 2; ring2.position.y = 0.03;
  g.add(base, ring, ring2);
  const bg = new THREE.Mesh(new THREE.CylinderGeometry(30, 30, 40, 32, 1, true), new THREE.MeshBasicMaterial({ color: 0x0a0818, side: THREE.BackSide }));
  bg.position.y = 12;
  g.add(bg);
  for (let i = 0; i < 40; i++) {
    const pil = new THREE.Mesh(new THREE.BoxGeometry(0.4, 8 + Math.random() * 20, 0.4), new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(Math.random() < 0.5 ? 0.06 : 0.72, 0.9, 0.4) }));
    const a = Math.random() * 6.28, r = 22 + Math.random() * 6;
    pil.position.set(Math.cos(a) * r, 4 + Math.random() * 6, Math.sin(a) * r - 8);
    g.add(pil);
  }
  G.root.add(g);
  show.kairo = buildChar("kairo");
  show.ryujin = buildChar("ryujin");
  show.kairo.root.position.set(STAGE.x - 2.4, 0, STAGE.z);
  show.ryujin.root.position.set(STAGE.x + 2.4, 0, STAGE.z);
  show.kairo.root.rotation.y = 0.25; show.ryujin.root.rotation.y = -0.25;
  G.root.add(show.kairo.root, show.ryujin.root);
  const l1 = new THREE.PointLight(0xff7a2a, 0, 40, 1.4), l2 = new THREE.PointLight(0x8a5cff, 0, 40, 1.4), l3 = new THREE.PointLight(0xffffff, 0, 40, 1.4);
  l1.position.set(STAGE.x - 5, 4, STAGE.z + 5); l2.position.set(STAGE.x + 5, 4, STAGE.z + 5); l3.position.set(STAGE.x, 6, STAGE.z + 10);
  G.root.add(l1, l2, l3);
  stageLights = [l1, l2, l3];
}

/* ---------------- settings & mode ---------------- */
function applySettings() {
  const s = useGame.getState().settings;
  G.settings = { quality: s.quality, shake: s.shake, sens: s.sens, fov: s.fov, voice: s.voice };
  setVolumes(s.master, s.music, s.sfx);
  fx.density = s.quality === "low" ? 0.45 : s.quality === "medium" ? 0.8 : 1;
  const sh = s.quality === "high";
  if (renderer) { renderer.shadowMap.enabled = sh; renderer.shadowMap.type = THREE.PCFSoftShadowMap; }
  if (sun && sun.castShadow !== sh) { sun.castShadow = sh; scene.traverse((o: any) => { if (o.material) o.material.needsUpdate = true; }); }
  G.postBloom = s.quality !== "low";
  G.postScale = s.quality === "low" ? 0.5 : 0.65;
}
function syncMode(screen: string) {
  const started = useGame.getState().started;
  if (screen === "playing" || screen === "dead") G.mode = "playing";
  else if (screen === "select") G.mode = "select";
  else if (screen === "menu") G.mode = "menu";
  else G.mode = started ? "paused" : "menu";
}
function onScreen(screen: string, prev: string) {
  syncMode(screen);
  if (screen === "playing") {
    initAudio();
    G.input.keys.clear(); G.input.pressed.clear(); G.mouseIgnore = 0.4;
    if (!gameStarted) startGame();
    const st = useGame.getState();
    if (P.hero !== st.hero && !P.dead) switchHero(st.hero, true);
    lockPointer();
  } else if (screen === "menu") {
    if (prev !== "menu" && gameStarted) resetWorld();
    document.exitPointerLock?.();
  } else {
    if (screen !== "dead") document.exitPointerLock?.();
    else document.exitPointerLock?.();
  }
}
export function lockPointer() {
  try {
    const c = renderer?.domElement as any;
    const r = c?.requestPointerLock?.();
    if (r && r.catch) r.catch(() => {});
  } catch {}
}
function startGame() {
  gameStarted = true;
  resetWorld(true);
  useGame.getState().started || useGame.setState({ started: true });
  const st = useGame.getState();
  P.hero = st.hero;
  for (const h of ["kairo", "ryujin"] as HeroId[]) rigs[h].root.visible = h === P.hero;
  if (P.hero === "ryujin" && st.companions.length) restoreAllies(st.companions);
  toast("Welcome to HERO CITY! Follow the gold beams for missions.", "#ffd23f");
  setTimeout(() => toast("WASD move · Shift sprint · Space×2 fly · LMB/RMB attack · Tab switch hero", "#9cf"), 1200);
  setTimeout(() => toast("E R F Q abilities · X ultimate · C dodge · T lock-on", "#9cf"), 2400);
  banner("HERO CITY", "Two Heroes. One City.", "#ffd23f", 2600);
}
export function resetWorld(silent = false) {
  if (G.mission) { G.mission.def.cleanup?.(G.mission); G.mission = null; }
  for (const e of [...G.enemies]) removeEnemy(e);
  clearProjectiles();
  for (const w of G.waves) fx.kill(w.vis);
  G.waves = [];
  for (const a of [...G.allies]) if (!a.beacon) removeAlly(a, false);
  G.allies = G.allies.filter((a: any) => !a.beacon);
  G.souls = [];
  G.boss = null; G.freezeInput = false; G.cam.cine = null; G.darkT = 0; G.beaconFocus = false;
  resetPlayerState();
  P.pos.copy(SPAWN); P.yaw = Math.PI; G.cam.yaw = Math.PI;
  for (const h of ["kairo", "ryujin"] as HeroId[]) { P.hp[h] = P.maxHp[h]; P.en[h] = P.maxEn[h]; P.ult[h] = 0; for (const k in P.cd[h]) P.cd[h][k] = 0; }
  setMusicLevel(0);
  if (!silent) gameStarted = false;
}
export function respawn() {
  for (const h of ["kairo", "ryujin"] as HeroId[]) P.hp[h] = P.maxHp[h] * 0.7;
  P.dead = false; P.invul = 2; P.pos.copy(SPAWN); P.vel.set(0, 0, 0); P.act = null; P.flying = false; P.stagger = 0;
  for (const e of G.enemies) if (!e.boss && e.pos.distanceTo(SPAWN) < 40) e.aggro = false;
  useGame.getState().setScreen("playing");
  toast("You wake up at Hero Tower.", "#9cf");
}
function playerDown() {
  const other: HeroId = P.hero === "kairo" ? "ryujin" : "kairo";
  if (P.hp[other] > 0) {
    toast(`${HERO[P.hero].name} is down! ${HERO[other].name} takes over.`, "#ff8080");
    switchHero(other, true);
    P.invul = 2;
  } else {
    P.dead = true; P.deadT = 0; P.act = null; P.flying = false;
    useGame.getState().setScreen("dead");
    if (G.mission) endMission(false, "You were defeated");
  }
}
function usePortal(id: string) {
  const zero = MISSIONS.find((m) => m.id === "zero")!;
  if (id === "in") {
    const st = missionState(zero);
    if (st === "locked") return toast(`The gate is sealed — ${zero.gate!()}`, "#c9a0ff");
    if (G.mission && G.mission.def.id !== "zero") return toast("Finish your current mission first.", "#ffb");
    P.pos.set(ARENA.x, 0, ARENA.z + 48); P.vel.set(0, 0, 0); P.yaw = Math.PI; G.cam.yaw = Math.PI;
    fx.burst(P.pos.clone().add(new V3(0, 1, 0)), 0xa070ff, 30, 10, 0.6, 0.8, 0);
    sfx("teleport");
    if (st === "available") startMission(zero);
    else toast("The Abyss — explore freely.", "#c9a0ff");
  } else {
    if (G.mission?.def.id === "zero" && G.boss && !G.boss.dead) return toast("The gate is sealed while Emperor Zero lives!", "#ff8");
    P.pos.set(22, 0, 30); P.vel.set(0, 0, 0); P.yaw = 0; G.cam.yaw = 0;
    sfx("teleport");
  }
}

/* ---------------- input ---------------- */
function bindInput() {
  const I = G.input;
  const playing = () => G.mode === "playing" && useGame.getState().screen === "playing";
  window.addEventListener("keydown", (e) => {
    if (e.code === "Tab" || e.code === "Space" || e.code.startsWith("Arrow")) { if (useGame.getState().screen === "playing") e.preventDefault(); }
    if (e.repeat) return;
    const scr = useGame.getState().screen;
    if (e.code === "Escape") {
      if (scr === "playing") { useGame.getState().setScreen("paused", "paused"); }
      return;
    }
    if (!playing()) return;
    I.keys.add(e.code);
    I.pressed.add(e.code);
  });
  window.addEventListener("keyup", (e) => { I.keys.delete(e.code); });
  window.addEventListener("blur", () => { I.keys.clear(); I.mouse[0] = I.mouse[1] = false; });
  window.addEventListener("mousedown", (e) => {
    if (!playing()) return;
    if (document.pointerLockElement == null && renderer && e.target === renderer.domElement) { lockPointer(); }
    if (e.button === 0 || e.button === 2) { I.mouse[e.button === 0 ? 0 : 1] = true; I.mPressed[e.button === 0 ? 0 : 1] = true; }
    if (e.button === 1) { e.preventDefault(); I.pressed.add("KeyT"); }
  });
  window.addEventListener("mouseup", (e) => { if (e.button === 0) I.mouse[0] = false; if (e.button === 2) I.mouse[1] = false; });
  window.addEventListener("contextmenu", (e) => e.preventDefault());
  window.addEventListener("wheel", (e) => { if (playing()) I.wheel += Math.sign(e.deltaY); }, { passive: true });
  window.addEventListener("mousemove", (e) => { if (playing()) { I.dx += e.movementX || 0; I.dy += e.movementY || 0; } });
  document.addEventListener("pointerlockchange", () => {
    if (!document.pointerLockElement && useGame.getState().screen === "playing") useGame.getState().setScreen("paused", "paused");
  });
}

/* ---------------- camera ---------------- */
const _f = new V3(), _look = new V3(), _cp = new V3();
let curDist = 7.5, camBlend = 0, fovCur = 70;
function updateCamera(dt: number, rawDt: number) {
  const c = G.cam, I = G.input;
  const sens = 0.0022 * G.settings.sens;
  if (G.mouseIgnore > 0) { G.mouseIgnore -= rawDt; I.dx = 0; I.dy = 0; }
  I.dx = clamp(I.dx, -140, 140); I.dy = clamp(I.dy, -140, 140);
  if (G.mode === "playing" && !G.freezeInput) {
    c.yaw -= I.dx * sens;
    c.pitch = clamp(c.pitch + I.dy * sens, -0.65, 1.3);
    if (P.lock && !P.lock.dead && !P.act) {
      const ty = Math.atan2(P.lock.pos.x - P.pos.x, P.lock.pos.z - P.pos.z);
      c.yaw = dampAng(c.yaw, ty, 3.5, rawDt);
      c.pitch = damp(c.pitch, 0.28, 3, rawDt);
    }
  }
  I.dx = 0; I.dy = 0;
  c.aim = I.mouse[1];
  // follow camera
  const speed = Math.hypot(P.vel.x, P.vel.z, P.vel.y);
  let wantDist = P.flying ? 9.5 + Math.min(4, speed * 0.05) : 7.2;
  if (P.act?.type === "charge" || P.act?.type === "beam") wantDist = 5.8;
  const target = _look.set(P.pos.x, P.pos.y + (P.flying && speed > 5 ? 1.2 : 1.6), P.pos.z);
  const rx = -Math.cos(c.yaw), rz = Math.sin(c.yaw);
  target.x += rx * 0.8; target.z += rz * 0.8;
  const cp = Math.cos(c.pitch);
  _f.set(Math.sin(c.yaw) * cp, -Math.sin(c.pitch), Math.cos(c.yaw) * cp);
  const back = _f.clone().negate();
  const rh = rayHit(target, back, wantDist, 0.4);
  const allowed = rh.hit ? Math.max(1.4, rh.d - 0.5) : wantDist;
  curDist = allowed < curDist ? allowed : damp(curDist, allowed, 3, rawDt);
  _cp.copy(target).addScaledVector(back, curDist);
  if (_cp.y < 0.4) _cp.y = 0.4;
  let finalPos = _cp.clone(), finalLook = target.clone();
  let wantFov = G.settings.fov + (P.flying ? clamp(speed * 0.25, 0, 14) : P.sprint ? 5 : 0) + (P.act?.type === "dash" ? 10 : 0);

  // cinematics
  let cine = c.cine as any;
  if (P.act?.type === "ult" && !cine) {
    const t = P.act.t;
    if (P.hero === "kairo") {
      const a = P.yaw + 0.9 + t * 0.15;
      const r = t < 2.5 ? 9 + t * 0.8 : 22;
      cine = { pos: new V3(P.pos.x + Math.sin(a) * r, t < 2.5 ? 1.2 + t * 0.4 : 12, P.pos.z + Math.cos(a) * r), look: new V3(P.pos.x, P.pos.y + (t < 2.5 ? 5 + t : 4), P.pos.z) };
    } else {
      const a = P.yaw + Math.PI + t * 0.9;
      cine = { pos: new V3(P.pos.x + Math.sin(a) * 11, 2.4 + t * 0.6, P.pos.z + Math.cos(a) * 11), look: new V3(P.pos.x, P.pos.y + 2.4, P.pos.z) };
    }
    wantFov = 65;
  } else if (cine?.boss) {
    const b = cine.boss;
    const hs = b.h;
    if (cine.type === "boss") {
      const k = cine.t / cine.dur;
      const R = (hs * 1.1 + 7) * (1.5 - k * 0.5);
      const a = b.yaw + 0.5 + cine.t * 0.32;
      cine = { pos: new V3(b.pos.x + Math.sin(a) * R, 1.5 + hs * 0.25 + k * hs * 0.2, b.pos.z + Math.cos(a) * R), look: new V3(b.pos.x, b.pos.y + hs * 0.6, b.pos.z) };
      wantFov = 55;
    } else if (cine.type === "bossform") {
      const R = hs * 1.2 + 8;
      cine = { pos: new V3(b.pos.x + Math.sin(b.yaw) * R, 2 + hs * 0.35, b.pos.z + Math.cos(b.yaw) * R), look: new V3(b.pos.x, b.pos.y + hs * 0.7, b.pos.z) };
      cine.t = 0;
      c.cine.t = (c.cine.t ?? 0) + rawDt;
      wantFov = 52;
    } else {
      c.cine.t += rawDt;
      const R = hs * 1.4 + 9, a = b.yaw + c.cine.t * 0.5;
      cine = { pos: new V3(b.pos.x + Math.sin(a) * R, 3 + hs * 0.3, b.pos.z + Math.cos(a) * R), look: new V3(b.pos.x, b.pos.y + hs * 0.5, b.pos.z) };
      wantFov = 50;
    }
  } else cine = null;
  camBlend = damp(camBlend, cine ? 1 : 0, cine ? 3.5 : 4.5, rawDt);
  if (cine && camBlend > 0.001) {
    finalPos.lerp(cine.pos, camBlend);
    finalLook.lerp(cine.look, camBlend);
  }
  // shake
  const sh = G.shake;
  if (sh > 0.001) {
    finalPos.x += rnd(-1, 1) * sh * 0.5; finalPos.y += rnd(-1, 1) * sh * 0.5; finalPos.z += rnd(-1, 1) * sh * 0.5;
    G.shake = sh * Math.exp(-7 * rawDt);
  }
  camera.position.copy(finalPos);
  camera.lookAt(finalLook);
  if (sh > 0.2) camera.rotateZ(rnd(-1, 1) * sh * 0.02);
  fovCur = damp(fovCur, wantFov, 5, rawDt);
  if (Math.abs(camera.fov - fovCur) > 0.05) { camera.fov = fovCur; camera.updateProjectionMatrix(); }
  void dt;
}

/* ---------------- showcase / menu camera ---------------- */
let wasSelect = false;
function showcaseCamera(dt: number, time: number) {
  if (!wasSelect) { wasSelect = true; camera.position.set(STAGE.x - 2.4, 1.5, STAGE.z + 6.6); }
  const sel = useGame.getState().hero;
  const kSel = sel === "kairo";
  show.kairo.root.visible = show.ryujin.root.visible = true;
  animate(show.kairo, { mode: kSel ? "victory" : "idle", t: time }, dt);
  animate(show.ryujin, { mode: !kSel ? "pose" : "idle", t: time }, dt);
  const sk = show.kairo.root.scale.x, sr = show.ryujin.root.scale.x;
  show.kairo.root.scale.setScalar(damp(sk, show.kairo.scale * (kSel ? 1.12 : 0.95), 6, dt));
  show.ryujin.root.scale.setScalar(damp(sr, show.ryujin.scale * (!kSel ? 1.12 : 0.95), 6, dt));
  const hx = STAGE.x + (kSel ? -2.4 : 2.4), cx = hx + 1.5, tx = hx + Math.sin(time * 0.3) * 0.4;
  camera.position.set(damp(camera.position.x, tx, 3, dt), damp(camera.position.y, 1.5, 3, dt), damp(camera.position.z, STAGE.z + 6.6, 3, dt));
  camera.lookAt(cx, 1.15, STAGE.z);
  camera.fov = 42; camera.updateProjectionMatrix();
  stageLights[0].intensity = kSel ? 160 : 60; stageLights[1].intensity = !kSel ? 160 : 60; stageLights[2].intensity = 70;
  sky.position.copy(camera.position);
}
function menuCamera(time: number) {
  const a = time * 0.06 + 0.8;
  camera.position.set(Math.sin(a) * 170, 70 + Math.sin(time * 0.1) * 8, Math.cos(a) * 170);
  camera.lookAt(0, 38, 0);
  if (camera.fov !== 55) { camera.fov = 55; camera.updateProjectionMatrix(); }
  sky.position.copy(camera.position);
}

/* ---------------- main tick ---------------- */
let realTime = 0;
export function tick(rawDelta: number) {
  if (!inited) return;
  const rawDt = Math.min(rawDelta, 0.05);
  ovDt = G.mode === 'paused' ? 0 : rawDt;
  realTime += rawDt;
  let dt = rawDt;
  const mode = G.mode;
  const inGame = mode === "playing";
  if (inGame) {
    if (G.hitstop > 0) { G.hitstop -= rawDt; dt *= 0.04; }
    if (G.slowT > 0) { G.slowT -= rawDt; dt *= 0.35; }
  }
  if (mode === "menu" || mode === "select" || mode === "paused") { /* sim frozen except env */ }
  const stageVisible = mode === "select";
  if (!stageVisible) wasSelect = false;
  show.kairo.root.visible = show.ryujin.root.visible = stageVisible;
  for (const l of stageLights) if (!stageVisible) l.intensity = 0;
  rigs[P.hero].root.visible = mode !== "select";

  if (inGame) {
    G.time += dt;
    // events & updaters
    for (let i = G.events.length - 1; i >= 0; i--) if (G.events[i].t <= G.time) { const ev = G.events[i]; G.events.splice(i, 1); ev.fn(); }
    for (let i = G.updaters.length - 1; i >= 0; i--) if (G.updaters[i](dt) === true) G.updaters.splice(i, 1);
    updatePlayer(dt, G.time);
    updateBosses(dt, G.time);
    updateEnemies(dt, G.time);
    updateAllies(dt, G.time);
    updateSouls(dt);
    updateProjectiles(dt);
    updateWaves(dt);
    updateCity(dt, G.time);
    updateMissions(dt, G.time);
    G.input.pressed.clear(); G.input.mPressed[0] = G.input.mPressed[1] = false; G.input.wheel = 0;
    G.flash = Math.max(0, G.flash - rawDt * 1.6);
    G.hurt = Math.max(0, G.hurt - rawDt * 1.8);
    fx.update(dt, renderer, camera.fov);
    updateEnv(dt);
    updateCamera(dt, rawDt);
    // music
    musicT -= rawDt;
    if (musicT <= 0) { musicT = 0.6; setMusicLevel(G.boss && !G.boss.dead ? 2 : G.danger > 0.25 ? 1 : G.mission ? 0 : 0); }
    // enemy flash lights etc
  } else {
    G.time += rawDt * 0.2;
    updateEnv(rawDt);
    fx.update(rawDt, renderer, camera.fov);
    if (mode === "select") showcaseCamera(rawDt, realTime);
    else if (mode === "menu") {
      updateCity(rawDt, realTime);
      menuCamera(realTime);
      G.input.dx = G.input.dy = 0;
    } else { G.input.dx = G.input.dy = 0; updateCamera(0, 0); }
  }
  camera.updateMatrixWorld();
  // shadows follow
  hudT -= rawDt;
  if (hudT <= 0) { hudT = 0.09; pushHud(); }
  drawOverlay();
  drawMinimap();
}

/* ---------------- HUD ---------------- */
function pushHud() {
  const h = P.hero, def = HERO[h];
  const cds: any = {};
  for (const ab of def.abilities) {
    if (ab.key === "X") continue;
    cds[ab.key] = { cd: P.cd[h][ab.key] ?? 0, max: P.cdMax[ab.key] || ab.cd || 1, ok: P.en[h] >= ab.cost };
  }
  const other: HeroId = h === "kairo" ? "ryujin" : "kairo";
  let souls = 0;
  if (h === "ryujin") for (const s of G.souls) if (s.pos.distanceTo(P.pos) < 40) souls++;
  const boss = G.boss && !G.boss.intro ? G.boss : null;
  const m = G.mission;
  let prompt = G.prompt || "";
  if (!prompt && souls) prompt = "Press [V] to extract a shadow";
  useHud.setState({
    hero: h, hp: P.hp[h], maxHp: P.maxHp[h], en: P.en[h], maxEn: P.maxEn[h], ult: P.ult[h], cds,
    otherHp: P.hp[other], otherMax: P.maxHp[other], lock: P.lock && !P.lock.dead ? P.lock.name : "",
    bossName: boss ? boss.name : "", bossHp: boss ? Math.max(0, boss.hp) : 0, bossMax: boss ? boss.maxHp : 1, bossStage: boss ? boss.stage : 0,
    mission: m ? m.def.name : "", objectives: m ? m.obj : [], combo: P.combo, allies: G.allies.filter((a: any) => !a.beacon && !a.dead).length, souls, flying: P.flying, prompt,
    letterbox: !!(G.cam.cine || P.act?.type === "ult"), danger: G.danger, district: DIST_NAMES[districtOf(P.pos.x, P.pos.z)] ?? "", clock: (G as any).clock ?? "",
    charge: P.act?.type === "charge" ? clamp(P.charging, 0, 1) : 0,
  });
}

/* overlay canvas */
const _v = new V3();
function proj(p: V3, w: number, h: number): { x: number; y: number; ok: boolean; z: number } {
  _v.copy(p).project(camera);
  return { x: (_v.x * 0.5 + 0.5) * w, y: (-_v.y * 0.5 + 0.5) * h, ok: _v.z < 1 && _v.z > -1, z: _v.z };
}
let barT = 0;
let ovDt = 0.016;
function drawOverlay() {
  const cv: HTMLCanvasElement | null = G.overlay;
  if (!cv) return;
  const ctx = cv.getContext("2d")!;
  const w = cv.width, h = cv.height;
  ctx.clearRect(0, 0, w, h);
  if (G.mode !== "playing" && G.mode !== "paused") return;
  const S = h / 900;
  // enemy bars
  const nowT = G.time;
  ctx.textAlign = "center";
  for (const e of G.enemies) {
    if (e.dead || e.hidden || e.boss || e.dp > 45) continue;
    const recent = nowT - (e.lastHit ?? -99) < 4 || P.lock === e;
    if (!recent && !(e.aggro && e.dp < 22)) continue;
    const p = proj(_v.set(e.pos.x, e.pos.y + e.h + 0.5 + (e.hover ?? 0), e.pos.z).clone(), w, h);
    if (!p.ok) continue;
    const bw = (e.maxHp > 400 ? 90 : 56) * S, bh = 6 * S;
    ctx.fillStyle = "rgba(0,0,0,0.65)"; ctx.fillRect(p.x - bw / 2 - 1, p.y - 1, bw + 2, bh + 2);
    ctx.fillStyle = e.maxHp > 400 ? "#ff8a3a" : "#ff3d5a"; ctx.fillRect(p.x - bw / 2, p.y, bw * clamp(e.hp / e.maxHp, 0, 1), bh);
    if (P.lock === e || e.maxHp > 400) { ctx.fillStyle = "#fff"; ctx.font = `${12 * S}px Rajdhani, sans-serif`; ctx.fillText(e.name.toUpperCase(), p.x, p.y - 4 * S); }
    if (e.stagger > 0.2) { ctx.fillStyle = "#ffe14a"; ctx.font = `bold ${12 * S}px sans-serif`; ctx.fillText("STAGGER", p.x, p.y + bh + 12 * S); }
  }
  for (const a of G.allies) {
    if (a.dead || a.pos.distanceTo(P.pos) > 60) continue;
    const p = proj(new V3(a.pos.x, a.pos.y + (a.beacon ? 8 : (a.h ?? 2) + 0.4), a.pos.z), w, h);
    if (!p.ok) continue;
    const bw = (a.beacon ? 120 : 40) * S, bh = (a.beacon ? 8 : 4) * S;
    ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(p.x - bw / 2 - 1, p.y - 1, bw + 2, bh + 2);
    ctx.fillStyle = a.beacon ? "#66ffcc" : "#a070ff"; ctx.fillRect(p.x - bw / 2, p.y, bw * clamp(a.hp / a.maxHp, 0, 1), bh);
    if (a.beacon) { ctx.fillStyle = "#fff"; ctx.font = `${13 * S}px Rajdhani, sans-serif`; ctx.fillText("SPIRIT BEACON", p.x, p.y - 5 * S); }
  }
  // lock reticle
  if (P.lock && !P.lock.dead) {
    const c = new V3(P.lock.pos.x, P.lock.pos.y + P.lock.h * 0.55, P.lock.pos.z);
    const p = proj(c, w, h);
    if (p.ok) {
      const r = 26 * S + Math.sin(G.time * 6) * 2;
      ctx.strokeStyle = "#ff4d6d"; ctx.lineWidth = 2.5 * S;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.PI / 4);
      ctx.strokeRect(-r / 2, -r / 2, r, r);
      ctx.restore();
    }
  }
  // souls
  if (P.hero === "ryujin") for (const s of G.souls) {
    if (s.pos.distanceTo(P.pos) > 45) continue;
    const p = proj(s.pos.clone().add(new V3(0, 1.3, 0)), w, h);
    if (!p.ok) continue;
    ctx.fillStyle = "#c9a0ff"; ctx.font = `bold ${14 * S}px Rajdhani, sans-serif`; ctx.fillText("▼ SHADOW [V]", p.x, p.y);
  }
  // mission markers
  for (const d of MISSIONS) {
    const st = missionState(d);
    if (st === "done" || st === "active") continue;
    const dd = Math.hypot(P.pos.x - d.pos.x, P.pos.z - d.pos.z);
    if (dd > 260) continue;
    const p = proj(new V3(d.pos.x, 12, d.pos.z), w, h);
    if (!p.ok) continue;
    ctx.fillStyle = st === "locked" ? "#8a95a8" : d.boss ? "#ff6a6a" : "#ffd23f";
    ctx.font = `bold ${14 * S}px Rajdhani, sans-serif`;
    ctx.fillText(`${st === "locked" ? "🔒 " : "◆ "}${d.name.toUpperCase()} · ${Math.round(dd)}m`, p.x, p.y);
  }
  // objective
  if (G.objMarker) {
    const o = G.objMarker as V3;
    const p = proj(new V3(o.x, o.y + 3, o.z), w, h);
    const d = Math.round(Math.hypot(P.pos.x - o.x, P.pos.z - o.z));
    ctx.fillStyle = "#6dffb0"; ctx.strokeStyle = "#0c2"; ctx.font = `bold ${15 * S}px Rajdhani, sans-serif`;
    let x = p.x, y = p.y;
    const behind = !p.ok;
    if (behind || x < 40 || x > w - 40 || y < 60 || y > h - 80) {
      let ax = x - w / 2, ay = y - h / 2;
      if (behind) { ax = -ax; ay = -ay; }
      const ang = Math.atan2(ay, ax);
      x = clamp(w / 2 + Math.cos(ang) * w * 0.4, 50, w - 50); y = clamp(h / 2 + Math.sin(ang) * h * 0.4, 70, h - 90);
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
      ctx.beginPath(); ctx.moveTo(16 * S, 0); ctx.lineTo(-10 * S, -11 * S); ctx.lineTo(-10 * S, 11 * S); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.fillText(`${d}m`, x, y - 18 * S);
    } else {
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.fillRect(-7 * S, -7 * S, 14 * S, 14 * S); ctx.restore();
      ctx.fillText(`OBJECTIVE · ${d}m`, x, y - 16 * S);
    }
  }
  // damage numbers
  for (let i = G.dmgNums.length - 1; i >= 0; i--) {
    const n = G.dmgNums[i];
    n.t += ovDt;
    if (n.t > 1.0) { G.dmgNums.splice(i, 1); continue; }
    const p = proj(_v.set(n.x, n.y + n.t * 1.8, n.z).clone(), w, h);
    if (!p.ok) continue;
    const sc = n.size * (n.t < 0.12 ? 1 + (0.12 - n.t) * 6 : 1);
    ctx.globalAlpha = 1 - sstep(0.6, 1, n.t);
    ctx.font = `800 ${22 * sc * S}px Rajdhani, sans-serif`;
    ctx.lineWidth = 4 * S; ctx.strokeStyle = "rgba(0,0,0,0.85)"; ctx.strokeText(n.text, p.x, p.y);
    ctx.fillStyle = n.color; ctx.fillText(n.text, p.x, p.y);
    ctx.globalAlpha = 1;
  }
  // screen effects
  if (G.hurt > 0.01) {
    const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.85);
    g.addColorStop(0, "rgba(255,0,30,0)"); g.addColorStop(1, `rgba(255,0,30,${Math.min(0.7, G.hurt * 0.7)})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
  const hpFrac = P.hp[P.hero] / P.maxHp[P.hero];
  if (hpFrac < 0.25 && !P.dead) {
    const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.4, w / 2, h / 2, h * 0.9);
    g.addColorStop(0, "rgba(180,0,20,0)"); g.addColorStop(1, `rgba(180,0,20,${0.35 + Math.sin(G.time * 6) * 0.15})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
  if (P.invul > 5) { ctx.fillStyle = "rgba(255,255,255,0.04)"; ctx.fillRect(0, 0, w, h); }
  if (G.flash > 0.01) { ctx.fillStyle = `rgba(255,245,220,${Math.min(1, G.flash)})`; ctx.fillRect(0, 0, w, h); }
  if (G.slowT > 0) { ctx.fillStyle = "rgba(120,200,255,0.08)"; ctx.fillRect(0, 0, w, h); }
  const lb = !!(G.cam.cine || P.act?.type === "ult");
  barT = lb ? Math.min(1, (barT || 0) + 0.04) : Math.max(0, (barT || 0) - 0.04);
  if (barT > 0.01) { const bh2 = h * 0.11 * barT; ctx.fillStyle = "#000"; ctx.fillRect(0, 0, w, bh2); ctx.fillRect(0, h - bh2, w, bh2); }
  barT = barT || 0;
  // crosshair
  if (G.mode === "playing" && !G.freezeInput && !P.lock) {
    ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 1.5 * S;
    ctx.beginPath(); ctx.arc(w / 2, h / 2, 4 * S, 0, 7); ctx.stroke();
  }
}
const lbCache = 0; void lbCache;

function drawMinimap() {
  const cv: HTMLCanvasElement | null = G.minimapCanvas;
  if (!cv || !mapCanvas) return;
  if (G.mode !== "playing" && G.mode !== "paused") return;
  const ctx = cv.getContext("2d")!;
  const S = cv.width;
  const k = S / 230;
  ctx.clearRect(0, 0, S, S);
  ctx.save();
  ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2 - 2, 0, 7); ctx.clip();
  ctx.fillStyle = "#0a0f1a"; ctx.fillRect(0, 0, S, S);
  const underground = P.pos.x > 600;
  ctx.translate(S / 2, S / 2);
  ctx.rotate(G.cam.yaw - Math.PI);
  ctx.scale(k, k);
  const px = underground ? 0 : P.pos.x, pz = underground ? 0 : P.pos.z;
  ctx.translate(-px, -pz);
  if (!underground) {
    ctx.globalAlpha = 0.95;
    ctx.drawImage(mapCanvas, -MAPHALF, -MAPHALF, MAPHALF * 2, MAPHALF * 2);
    ctx.globalAlpha = 1;
  } else { ctx.fillStyle = "#1a1230"; ctx.fillRect(-80, -80, 160, 160); ctx.strokeStyle = "#7a4dff"; ctx.lineWidth = 1; ctx.strokeRect(-75, -75, 150, 150); }
  const ox = underground ? ARENA.x : 0, oz = underground ? ARENA.z : 0;
  const dot = (x: number, z: number, r: number, col: string) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x - ox, z - oz, r / k * 1.0, 0, 7); ctx.fill(); };
  if (!underground) {
    for (const d of MISSIONS) { const st = missionState(d); if (st === "done" || st === "active") continue; dot(d.pos.x, d.pos.z, 5, st === "locked" ? "#8a95a8" : d.boss ? "#ff5a5a" : "#ffd23f"); }
    for (const z of zoneMarkers()) { ctx.strokeStyle = "rgba(255,70,70,0.6)"; ctx.lineWidth = 1.5 / k; ctx.beginPath(); ctx.arc(z.x, z.z, 10, 0, 7); ctx.stroke(); }
    for (const c of G.civs) if (c.trapped) dot(c.pos.x, c.pos.z, 4, "#66ffaa");
    dot(22, 25, 4, "#a070ff");
  }
  for (const e of G.enemies) if (!e.dead && !e.hidden && (underground === e.pos.x > 600)) dot(e.pos.x, e.pos.z, e.boss ? 6 : 3, e.boss ? "#ff3030" : "#ff6a6a");
  for (const a of G.allies) if (!a.dead && (underground === a.pos.x > 600)) dot(a.pos.x, a.pos.z, 3, a.beacon ? "#66ffcc" : "#b08aff");
  if (G.objMarker && (underground === (G.objMarker as V3).x > 600)) {
    const o = G.objMarker as V3;
    ctx.save(); ctx.translate(o.x - ox, o.z - oz); ctx.rotate(Math.PI / 4); ctx.fillStyle = "#6dffb0"; ctx.fillRect(-4 / k * 1.4, -4 / k * 1.4, 8 / k * 1.4, 8 / k * 1.4); ctx.restore();
  }
  ctx.restore();
  // player
  ctx.save();
  ctx.translate(S / 2, S / 2);
  ctx.rotate(G.cam.yaw - P.yaw + Math.PI + Math.PI);
  ctx.fillStyle = HERO[P.hero].color;
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6, 7); ctx.lineTo(0, 3); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2 - 2, 0, 7); ctx.stroke();
  // N marker
  ctx.fillStyle = "#fff"; ctx.font = "bold 11px Rajdhani, sans-serif"; ctx.textAlign = "center";
  const na = G.cam.yaw - Math.PI;
  ctx.fillText("N", S / 2 + Math.sin(na) * (S / 2 - 12), S / 2 + Math.cos(G.cam.yaw) * (S / 2 - 12) + 4);
}

export const engine = { respawn, abandonMission, lockPointer, resetWorld };
export const _un = [rnd, lerp, sstep, shake, killEnemy, THREE];
