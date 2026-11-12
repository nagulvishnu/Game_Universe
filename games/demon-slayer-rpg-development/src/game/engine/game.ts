import * as THREE from 'three';
import { rt, input, attachInput, endFrameInput, wasPressed, isDown, type RigHandle } from '../runtime';
import { G, fwd, angDiff, rand, clamp, damp } from './ctx';
import { FX } from './fx';
import { buildWorld, type Quality } from './world';
import { REGION_BY_ID } from '../data/regions';
import { CHAR_BY_ID, NPC_LOOKS } from '../data/characters';
import { ALL_SKILLS } from '../data/styles';
import { audio } from '../audio';
import { useHud, useStore } from '../store';
import { createPlayer, destroyPlayer, refreshStats, resolveCollisions, swapCharacter, updatePlayer } from './player';
import { bossHud, spawnAmbientAt, updateAmbient, updateEnemies } from './enemies';
import { killEnemy, clearEnemies, clearProjs, damageEnemy, healPlayer, updateBars, updateProjs } from './combat';
import { abandonQuest, bindTravel, clearNpcs, clearPickups, findInteract, onKillQuest, restartStep, spawnNpc, spawnRegionCollectibles, startQuest, updateNpcs, updatePickups, updateQuest, type Interact } from './quest';
import { buildRig } from './rig';
import { resolveSpecial, resolveUlt, specialUnlocked, xpNeed } from './stats';
import type { Settings } from '../types';

const T = new THREE.Vector3(); const T2 = new THREE.Vector3();
let renderer: THREE.WebGLRenderer | null = null; let detach: (() => void) | null = null;
let fade = 0; let fadeDir = 0; let pending: { region: string; after?: () => void } | null = null; let hudT = 0; let saveT = 0; let fpsAcc = 0; let fpsN = 0; let fps = 60;
let qKey = ''; const camPos = new THREE.Vector3(); const camLook = new THREE.Vector3(); let camSnap = true; let interact: Interact | null = null; let crow: THREE.Group | null = null;
let nez: { model: RigHandle; pos: THREE.Vector3; yaw: number; cd: number; bda: number; heal: number; act: number; mode: 'follow' | 'attack' | 'cast' } | null = null;
let poiShown = '';

export function qualityFor(s: Settings): Quality & { pr: number; fxq: number } {
  const g = { low: { density: 0.45, seg: 40, weather: 0.4, pr: 0.6, fxq: 0.5 }, medium: { density: 0.75, seg: 64, weather: 0.7, pr: 0.85, fxq: 0.75 }, high: { density: 1, seg: 90, weather: 1, pr: 1, fxq: 1 }, ultra: { density: 1.15, seg: 118, weather: 1.3, pr: 1.25, fxq: 1.3 } }[s.gfx];
  return { shadows: s.shadows, density: g.density, seg: g.seg, weather: g.weather, pr: g.pr * s.renderScale, fxq: g.fxq };
}

export function initGame(scene: THREE.Scene, camera: THREE.PerspectiveCamera, gl: THREE.WebGLRenderer, launch: { quest?: string; region?: string } | null) {
  (window as unknown as { __dbg: unknown }).__dbg = { rt, G, input, store: useStore, kill: killEnemy }; renderer = gl; G.scene = scene; G.camera = camera; const st = useStore.getState(); const q = qualityFor(st.profile.settings); G.quality = q; qKey = st.profile.settings.gfx + st.profile.settings.shadows;
  gl.shadowMap.enabled = true; gl.shadowMap.type = THREE.PCFSoftShadowMap; gl.setPixelRatio(Math.min(window.devicePixelRatio, 2) * Math.min(1.5, q.pr));
  G.fx = new FX(q.fxq); scene.add(G.fx.group, G.ents); detach = attachInput(gl.domElement); audio.setVolumes(st.profile.settings);
  rt.enemies = []; rt.projs = []; rt.npcs = []; rt.pickups = []; rt.qrt = null; rt.player = null; rt.clock = st.profile.clock; rt.sessionStart = performance.now();
  G.onKill = (e) => onKillQuest(e); bindTravel(travel);
  const region = launch?.region ?? st.profile.region; loadRegionNow(region, false);
  if (launch?.quest) setTimeout(() => startQuest(launch.quest!), 400);
  else setTimeout(() => useStore.getState().toast('Open the Journal (J) to begin the next chapter or accept missions.', 'info'), 1200);
  useStore.setState({ launch: null });
}

export function disposeGame() {
  detach?.(); detach = null; clearEnemies(); clearProjs(); clearNpcs(); clearPickups(); destroyPlayer(); if (nez) { G.ents.remove(nez.model.group); nez.model.dispose(); nez = null; }
  if (crow) { G.ents.remove(crow); crow = null; } G.world?.dispose(); G.world = null; G.fx?.dispose(); if (G.scene) { G.scene.remove(G.ents); if (G.fx) G.scene.remove(G.fx.group); } G.fx = null;
  rt.qrt = null; audio.setMode('off'); useHud.setState({ boss: null, target: null, prompt: null, objective: '', fade: 0, cin: false });
}

function travel(region: string, after?: () => void) {
  if (pending || fadeDir !== 0) return; if (!after && rt.qrt) abandonQuest();
  pending = { region, after }; fadeDir = 1; audio.sfx('ui');
}

function loadRegionNow(id: string, keepPos: boolean) {
  const reg = REGION_BY_ID[id]; const st = useStore.getState(); const prevPos = rt.player ? rt.player.pos.clone() : null; const prevYaw = rt.camYaw;
  clearEnemies(); clearProjs(); clearNpcs(); clearPickups(); G.world?.dispose(); rt.bossRef = null;
  if (nez) { nez.pos.set(0, 0, 0); }
  rt.region = id; const avoid: [number, number][] = [reg.spawnPt, ...reg.npcs.map((n) => n.at), reg.poi.at];
  const world = buildWorld(reg, G.quality, G.scene!, avoid); G.scene!.add(world.group); G.world = world; rt.hAt = world.hAt; rt.colliders = world.colliders; rt.gates = world.gates; rt.bounds = { hx: reg.hx - 1.5, hz: reg.hz - 1.5 };
  const sp = keepPos && prevPos ? prevPos : new THREE.Vector3(reg.spawnPt[0], 0, reg.spawnPt[1]); sp.y = rt.hAt(sp.x, sp.z);
  if (!rt.player) rt.player = createPlayer(sp); else rt.player.pos.copy(sp);
  const p = rt.player!; resolveCollisions(p.pos, 0.45); p.pos.y = rt.hAt(p.pos.x, p.pos.z); p.kb.set(0, 0, 0); p.state = p.state === 'dead' ? 'free' : p.state === 'skill' ? 'free' : p.state; p.lockId = null; p.vy = 0;
  rt.camYaw = keepPos ? prevYaw : Math.PI; p.yaw = rt.camYaw; camSnap = true;
  reg.npcs.forEach((n) => spawnNpc(n.id, n.name, n.look, n.at[0], n.at[1], n.lines, { shop: n.shop, smith: n.smith, tag: 'region' }));
  spawnRegionCollectibles();
  const cap = Math.max(2, Math.round(reg.spawn.max * (G.quality.density > 0.5 ? 0.7 : 0.4))); for (let i = 0; i < cap; i++) spawnAmbientAt(p.pos, rand(24, 52));
  st.setRegion(id); st.discover(`region:${id}`, 40);
  audio.setMode(reg.music); audio.setAmbience(reg.amb, reg.fixedTime !== undefined ? reg.fixedTime < 0.2 || reg.fixedTime > 0.8 : world.night > 0.5, reg.weather === 'rain' ? 'rain' : 'none');
  poiShown = '';
  if (!keepPos) { st.save(); st.toast(`${reg.name} — ${reg.sub}`, 'info'); }
}

function nezActive(): boolean { const prof = useStore.getState().profile; const q = rt.qrt; return prof.chapter >= 1 || (!!q && q.quest.id === 'ch1' && q.step >= 3); }

function updateNezuko(dt: number) {
  const p = rt.player!; const active = nezActive();
  if (active && !nez) { const m = buildRig(NPC_LOOKS.nezuko, { outline: true, shadow: true, sword: false }); G.ents.add(m.group); nez = { model: m, pos: p.pos.clone().add(new THREE.Vector3(-2, 0, -2)), yaw: 0, cd: 3, bda: 12, heal: 5, act: 0, mode: 'follow' }; }
  if (!active && nez) { G.ents.remove(nez.model.group); nez.model.dispose(); nez = null; }
  if (!nez) return; const n = nez; const an = n.model.anim; n.cd -= dt; n.bda -= dt; n.heal -= dt; n.act -= dt;
  const fx = G.fx!; const alive = rt.enemies.filter((e) => e.state !== 'dead' && e.state !== 'hidden' && e.aggro && !e.def.flags.dummy && !e.def.flags.static && Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) < 14);
  let target: (typeof alive)[number] | null = alive.sort((a, b) => Math.hypot(a.pos.x - n.pos.x, a.pos.z - n.pos.z) - Math.hypot(b.pos.x - n.pos.x, b.pos.z - n.pos.z))[0] ?? null;
  const prof = useStore.getState().profile; const lvl = prof.chars[p.charId].level;
  if (n.mode === 'follow') {
    if (p.hp / p.maxHp < 0.35 && n.heal <= 0 && p.state !== 'dead') { n.heal = 40; n.mode = 'cast'; n.act = 0.8; an.pose = 'cast'; fx.ring(p.pos, 7, 0xff7aa8, 0.8); fx.column(p.pos, 0xff7aa8, 1, 8, 0.8); audio.sfx('nezuko'); alive.forEach((e) => { if (e.boss) e.posture += 25; else e.vel.add(T.set(e.pos.x - p.pos.x, 0, e.pos.z - p.pos.z).normalize().multiplyScalar(10)); }); healPlayer(p.maxHp * 0.2); useStore.getState().toast("Nezuko's Demon Blood restores your strength!", 'good'); }
    else if (target && n.bda <= 0 && (alive.length >= 2 || target.boss)) { n.bda = 22; n.mode = 'cast'; n.act = 0.9; an.pose = 'cast'; const c = target.pos.clone(); audio.sfx('fire'); fx.ring(c, 8, 0xff5a8a, 0.8); fx.column(c, 0xff5a8a, 1.6, 10, 0.9); fx.sparks(T.set(c.x, 1, c.z), 30, 0xff5a8a, 9, 0.35, 0.8); rt.shake = Math.max(rt.shake, 0.4);
      setTimeout(() => { rt.enemies.forEach((e) => { if (e.state !== 'dead' && Math.hypot(e.pos.x - c.x, e.pos.z - c.z) < 8) damageEnemy(e, p.stats.atk * (1.3 + lvl * 0.03), { kb: 5, dir: T.set(e.pos.x - c.x, 0, e.pos.z - c.z).normalize().clone(), stagger: 20, skill: true, status: 'burn' }); }); }, 450); useStore.getState().toast('Nezuko: Exploding Blood!', 'info'); }
    else if (target && n.cd <= 0) { n.mode = 'attack'; n.act = 1.4; }
    else {
      const f = fwd(p.yaw, T); const gx = p.pos.x - f.x * 2.2 + Math.cos(p.yaw) * 1.8; const gz = p.pos.z - f.z * 2.2 - Math.sin(p.yaw) * 1.8; const d = Math.hypot(gx - n.pos.x, gz - n.pos.z);
      if (d > 1.0) { const sp = Math.min(9, 2 + d * 2.5); n.pos.x += ((gx - n.pos.x) / d) * sp * dt; n.pos.z += ((gz - n.pos.z) / d) * sp * dt; an.walk = damp(an.walk, sp > 5 ? 1.4 : 0.9, 8, dt); n.yaw += angDiff(n.yaw, Math.atan2(gx - n.pos.x, gz - n.pos.z)) * (1 - Math.exp(-10 * dt)); }
      else { an.walk = damp(an.walk, 0, 8, dt); n.yaw += angDiff(n.yaw, p.yaw) * (1 - Math.exp(-4 * dt)); }
      const pd = Math.hypot(p.pos.x - n.pos.x, p.pos.z - n.pos.z); if (pd < 1.4) { n.pos.x -= (p.pos.x - n.pos.x) * dt * 2; n.pos.z -= (p.pos.z - n.pos.z) * dt * 2; } if (pd > 28) n.pos.set(p.pos.x - 2, p.pos.y, p.pos.z - 2); an.pose = 'idle';
    }
  }
  if (n.mode === 'attack') {
    if (!target || n.act <= 0) { n.mode = 'follow'; n.cd = 3.2; }
    else { const dx = target.pos.x - n.pos.x; const dz = target.pos.z - n.pos.z; const d = Math.hypot(dx, dz); n.yaw += angDiff(n.yaw, Math.atan2(dx, dz)) * (1 - Math.exp(-14 * dt)); an.expr = 'angry';
      if (d > 1.7) { n.pos.x += (dx / d) * 13 * dt; n.pos.z += (dz / d) * 13 * dt; an.walk = 1.5; an.pose = 'idle'; if (Math.random() < 0.6) fx.add.emit(n.pos.x, n.pos.y + 0.8, n.pos.z, 0, 0, 0, 0.35, 0.5, 0.05, 0xff5a8a, 0.5); }
      else { an.pose = 'attack'; an.pt = 0.3; an.variant = 0; n.cd = 3.5; n.mode = 'follow'; audio.sfx('nezuko'); fx.slash(n.pos, n.yaw, { radius: 2.2, arc: 2.4, color: 0xff5a8a, core: 0xffffff, tilt: 0.3, life: 0.3 }); damageEnemy(target, Math.max(8, p.stats.atk * 0.75), { kb: 4, dir: T2.set(dx, 0, dz).normalize().clone(), stagger: 14, skill: true, status: 'stun' }); } }
  }
  if (n.mode === 'cast') { if (n.act <= 0) { n.mode = 'follow'; an.pose = 'idle'; } else an.expr = 'angry'; }
  if (n.mode === 'follow') an.expr = 'normal';
  target = null; n.pos.y = damp(n.pos.y, rt.hAt(n.pos.x, n.pos.z), 20, dt); resolveCollisions(n.pos, 0.35);
  n.model.group.position.copy(n.pos); n.model.group.rotation.y = n.yaw; n.model.update(dt, rt.time);
}

function updateCrow(dt: number) {
  const p = rt.player!; if (!crow) {
    crow = new THREE.Group(); const m = new THREE.MeshToonMaterial({ color: 0x15151c }); const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), m); body.scale.set(1, 0.8, 1.7); crow.add(body);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.2, 5), new THREE.MeshBasicMaterial({ color: 0xffb030 })); beak.rotation.x = Math.PI / 2; beak.position.z = 0.34; crow.add(beak);
    for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.02, 0.28), m); w.position.x = s * 0.3; w.name = s > 0 ? 'wl' : 'wr'; crow.add(w); }
    G.ents.add(crow);
  }
  const t = rt.time * 0.7; crow.position.set(p.pos.x + Math.cos(t) * 4.2, p.pos.y + 4.6 + Math.sin(t * 2) * 0.4, p.pos.z + Math.sin(t) * 4.2); crow.rotation.y = -t + Math.PI;
  const fl = Math.sin(rt.time * 14) * 0.6; (crow.getObjectByName('wl') as THREE.Object3D).rotation.z = fl; (crow.getObjectByName('wr') as THREE.Object3D).rotation.z = -fl; void dt;
}

function updateCamera(dt: number, realDt: number) {
  const cam = G.camera!; const p = rt.player!; const st = useStore.getState(); const s = st.profile.settings; const dlg = st.dialogue; const hint = dlg ? dlg.lines[dlg.i]?.cam : undefined;
  let mode: string = 'follow';
  if (rt.cin.active && rt.cin.kind === 'finish') mode = 'finish'; else if (dlg && hint) mode = hint; else if (dlg) mode = 'follow'; else if (rt.cin.active && rt.cin.kind === 'boss') mode = 'boss';
  const boss = rt.bossRef ?? rt.enemies.find((e) => e.boss && e.state !== 'dead') ?? null; const npc = rt.npcs.filter((n) => n.tag === 'quest' || !n.follow).sort((a, b) => Math.hypot(a.pos.x - p.pos.x, a.pos.z - p.pos.z) - Math.hypot(b.pos.x - p.pos.x, b.pos.z - p.pos.z))[0];
  if (mode === 'boss' && !boss) mode = npc ? 'npc' : 'wide'; if (mode === 'npc' && !npc) mode = boss ? 'boss' : 'wide';
  const dp = new THREE.Vector3(); const dl = new THREE.Vector3(); let k = 12; let fov = s.fov;
  if (mode === 'follow') {
    const dist = clamp(5.6 - (rt.ultCam > 0 ? 1.6 : 0) + rt.camPitch * 1.2, 3, 9); const pit = rt.camPitch; const look = fwd(rt.camYaw, T); const right = T2.set(-Math.cos(rt.camYaw), 0, Math.sin(rt.camYaw));
    const tgt = new THREE.Vector3(p.pos.x, p.pos.y + 1.55, p.pos.z).addScaledVector(right, 0.75);
    dp.set(tgt.x - look.x * Math.cos(pit) * dist, tgt.y + Math.sin(pit) * dist + 0.4, tgt.z - look.z * Math.cos(pit) * dist);
    // collision: shorten when sample inside a solid collider or below terrain
    let best = 1; for (let i = 1; i <= 8; i++) { const f = i / 8; const sx = tgt.x + (dp.x - tgt.x) * f; const sz = tgt.z + (dp.z - tgt.z) * f; const sy = tgt.y + (dp.y - tgt.y) * f; if (sy < rt.hAt(sx, sz) + 0.35 || rt.colliders.some((c) => c.r > 1.3 && Math.hypot(c.x - sx, c.z - sz) < c.r + 0.2 && sy < 9)) { best = Math.max(0.15, (i - 1.3) / 8); break; } }
    dp.set(tgt.x + (dp.x - tgt.x) * best, tgt.y + (dp.y - tgt.y) * best, tgt.z + (dp.z - tgt.z) * best); dp.y = Math.max(dp.y, rt.hAt(dp.x, dp.z) + 0.5);
    dl.set(tgt.x + look.x * 8, tgt.y - Math.sin(pit) * 2 + 0.2 + (pit - 0.25) * -2, tgt.z + look.z * 8); dl.addScaledVector(right, -0.2); k = rt.ultCam > 0 ? 7 : 16; fov = s.fov + (p.sprinting ? 6 : 0) - (rt.ultCam > 0 ? 10 : 0);
  } else if (mode === 'boss' && boss) {
    const a = Math.atan2(p.pos.x - boss.pos.x, p.pos.z - boss.pos.z) + 0.9 + Math.sin(rt.time * 0.4) * 0.2; const h = 2.2 * boss.def.scale; const d = 7 + boss.def.scale * 3.5;
    dp.set(boss.pos.x + Math.sin(a) * d, boss.pos.y + h * 0.8 + 0.8, boss.pos.z + Math.cos(a) * d); dl.set(boss.pos.x, boss.pos.y + h * 0.8, boss.pos.z); k = 3; fov = 50;
  } else if (mode === 'finish') {
    const c = rt.cin.target; const a = rt.time * 0.9; dp.set(c.x + Math.sin(a) * 7, c.y + 2.2, c.z + Math.cos(a) * 7); dl.set(c.x, c.y + 1.4, c.z); k = 4; fov = 44;
  } else if (mode === 'npc' && npc) {
    const a = Math.atan2(p.pos.x - npc.pos.x, p.pos.z - npc.pos.z) + 0.55; dp.set(npc.pos.x + Math.sin(a) * 3.8, npc.pos.y + 1.9, npc.pos.z + Math.cos(a) * 3.8); dl.set(npc.pos.x, npc.pos.y + 1.55, npc.pos.z); k = 4; fov = 42;
  } else if (mode === 'player') {
    const f = fwd(p.yaw, T); const r = T2.set(-Math.cos(p.yaw), 0, Math.sin(p.yaw)); dp.set(p.pos.x + f.x * 3.2 + r.x * 0.9, p.pos.y + 1.7, p.pos.z + f.z * 3.2 + r.z * 0.9); dl.set(p.pos.x, p.pos.y + 1.55, p.pos.z); k = 4; fov = 40;
  } else {
    const a = rt.time * 0.12; dp.set(p.pos.x + Math.sin(a) * 15, p.pos.y + 7, p.pos.z + Math.cos(a) * 15); dl.set(p.pos.x, p.pos.y + 1.6, p.pos.z); k = 2.5; fov = 52;
  }
  if (camSnap) { camPos.copy(dp); camLook.copy(dl); camSnap = false; } else { const f = 1 - Math.exp(-k * realDt); camPos.lerp(dp, f); camLook.lerp(dl, 1 - Math.exp(-(k + 3) * realDt)); }
  cam.position.copy(camPos); const sh = rt.shake * 0.28 * s.shake; if (sh > 0.001) cam.position.add(T.set(rand(-sh, sh), rand(-sh, sh), rand(-sh, sh)));
  cam.lookAt(camLook); cam.fov = damp(cam.fov, fov, 6, realDt); cam.updateProjectionMatrix(); rt.shake *= Math.exp(-6 * realDt); void dt;
}

function pushHud(realDt: number) {
  hudT -= realDt; fpsAcc += realDt; fpsN++; if (fpsAcc > 0.5) { fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
  if (hudT > 0) return; hudT = 0.05; const p = rt.player!; const st = useStore.getState(); const prof = st.profile; const cp = prof.chars[p.charId]; const def = CHAR_BY_ID[p.charId];
  const cds: { id: string | null; name: string; cd: number; max: number; ok: boolean; key: string }[] = [];
  cp.equipped.forEach((id, i) => { const sk = id ? ALL_SKILLS[id] : null; cds.push({ id, name: sk?.name ?? 'Empty', cd: sk ? Math.max(0, p.cd[sk.id] ?? 0) : 0, max: sk ? (p.cdMax[sk.id] ?? sk.cd) : 1, ok: !!sk && p.breath >= sk.breath * p.stats.breathMul * (p.buffs.focus > 0 ? 0.5 : 1), key: String(i + 1) }); });
  cds.push({ id: 'focus', name: 'Total Concentration', cd: Math.max(0, p.cd.focus ?? 0), max: p.cdMax.focus ?? 14, ok: true, key: 'Q' });
  const sp = resolveSpecial(def, prof.chapter); const ul = resolveUlt(def, prof.chapter);
  cds.push({ id: sp.id, name: sp.name, cd: Math.max(0, p.cd[sp.id] ?? 0), max: p.cdMax[sp.id] ?? sp.cd, ok: specialUnlocked(prof, p.charId, sp) && p.breath >= sp.breath * p.stats.breathMul, key: 'E' });
  cds.push({ id: ul.id, name: ul.name, cd: 0, max: 1, ok: specialUnlocked(prof, p.charId, ul) && p.ult >= p.maxUlt, key: 'R' });
  const tg = G.lastTargetT > 0 && G.lastTarget && G.lastTarget.state !== 'dead' && !G.lastTarget.boss && !G.lastTarget.def.flags.dummy ? G.lastTarget : p.lockId !== null ? rt.enemies.find((e) => e.id === p.lockId && !e.boss) ?? null : null;
  let lock: { x: number; y: number } | null = null; const lt = p.lockId !== null ? rt.enemies.find((e) => e.id === p.lockId) : null;
  if (lt && lt.state !== 'dead') { T.set(lt.pos.x, lt.pos.y + 1.3 * lt.def.scale, lt.pos.z).project(G.camera!); if (T.z < 1) lock = { x: (T.x * 0.5 + 0.5) * 100, y: (-T.y * 0.5 + 0.5) * 100 }; }
  const hr = Math.floor(rt.clock * 24); const mn = Math.floor((rt.clock * 24 - hr) * 60); const reg = REGION_BY_ID[rt.region];
  const buffs: string[] = []; if (p.buffs.focus > 0) buffs.push('Focus'); if (p.buffs.guard > 0) buffs.push('Incense'); if (p.buffs.regen > 0) buffs.push('Tonic'); if (p.buffs.slow > 0) buffs.push('Slowed');
  const dps = rt.enemies.some((e) => e.def.flags.dummy) && rt.dummyDps.t > 0 ? Math.round(rt.dummyDps.dmg / Math.max(1, rt.dummyDps.t)) : null;
  useHud.setState({
    hp: p.hp, maxHp: p.maxHp, sta: p.sta, maxSta: p.maxSta, breath: p.breath, maxBreath: p.maxBreath, ult: p.ult, level: cp.level, xp: cp.xp, xpNeed: xpNeed(cp.level), cds,
    target: tg ? { name: tg.def.name, hp: tg.hp, max: tg.maxHp, posture: tg.posture, maxPosture: tg.maxPosture, level: tg.level } : null,
    prompt: interact?.prompt ?? null, combo: rt.comboTimer > 0 ? rt.combo : 0, lock, region: reg.name, time: `${String(hr).padStart(2, '0')}:${String(mn).padStart(2, '0')}`, fps, buffs, night: rt.nightMix > 0.5, weather: reg.weather,
    dps, fade, cin: st.overlay === 'dialogue' || rt.cin.active,
  });
  bossHud(rt.bossRef && rt.bossRef.state !== 'dead' && rt.bossRef.aggro ? rt.bossRef : null);
}

export function updateGame(realDtIn: number, pxScale: number) {
  const p = rt.player; if (!p || !G.fx) return; const realDt = Math.min(0.05, realDtIn); const st = useStore.getState(); const prof = st.profile; const s = prof.settings;
  // quality hot-swap
  const key = s.gfx + s.shadows; if (key !== qKey && fadeDir === 0) { qKey = key; const q = qualityFor(s); G.quality = q; renderer!.setPixelRatio(Math.min(window.devicePixelRatio, 2) * Math.min(1.5, q.pr)); loadRegionNow(rt.region, true); }
  else if (renderer) { const want = Math.min(window.devicePixelRatio, 2) * Math.min(1.5, qualityFor(s).pr); if (Math.abs(renderer.getPixelRatio() - want) > 0.01) renderer.setPixelRatio(want); }
  // overlay keys
  let ov = st.overlay;
  if (wasPressed('Escape')) { if (ov === null) st.setOverlay('pause'); else if (ov === 'pause' || ov === 'menu') st.setOverlay(null); ov = useStore.getState().overlay; }
  const tabKeys: [string, Parameters<typeof st.openMenu>[0]][] = [['Tab', 'character'], ['KeyI', 'inventory'], ['KeyM', 'map'], ['KeyK', 'skills'], ['KeyJ', 'journal'], ['KeyB', 'smith'], ['KeyN', 'corps']];
  if (ov === null || ov === 'menu') for (const [code, tab] of tabKeys) if (wasPressed(code)) { if (ov === 'menu' && useStore.getState().menuTab === tab) st.setOverlay(null); else st.openMenu(tab); ov = useStore.getState().overlay; break; }
  if (ov !== null && input.locked) document.exitPointerLock();
  // commands
  st.popCmds().forEach((c) => {
    if (c.type === 'travel') travel(c.region); else if (c.type === 'quest') startQuest(c.id); else if (c.type === 'abandon') abandonQuest();
    else if (c.type === 'switchChar') swapCharacter(); else if (c.type === 'refresh') refreshStats();
    else if (c.type === 'respawn') { const q = rt.qrt; const reg = REGION_BY_ID[rt.region]; p.pos.set(reg.spawnPt[0], rt.hAt(reg.spawnPt[0], reg.spawnPt[1]), reg.spawnPt[1]); p.hp = p.maxHp; p.sta = p.maxSta; p.state = 'free'; p.invuln = 2; p.model!.anim.pose = 'idle'; p.lockId = null; clearProjs(); rt.enemies.filter((e) => e.tag !== 'quest' || !e.boss).forEach((e) => { if (e.tag === 'ambient') e.aggro = false; }); camSnap = true; st.setOverlay(null); if (q) restartStep(); }
    else if (c.type === 'useItem') {
      const it = c.id; if (!st.consume(it)) return; const def = it === 'herb' ? 0.7 : it === 'rice_ball' ? 0.35 : 0;
      if (def) healPlayer(p.maxHp * def); else if (it === 'tonic') { p.sta = p.maxSta; p.buffs.regen = 30; audio.sfx('heal'); } else if (it === 'elixir') { p.breath = p.maxBreath; audio.sfx('heal'); } else if (it === 'incense') { p.buffs.guard = 60; audio.sfx('heal'); } else if (it === 'charm_ult') { p.ult = Math.min(p.maxUlt, p.ult + 50); audio.sfx('heal'); }
      st.toast('Used item.', 'good');
    }
  });
  // fade/travel
  if (fadeDir === 1) { fade = Math.min(1, fade + realDt * 3); if (fade >= 1 && pending) { const pn = pending; pending = null; loadRegionNow(pn.region, false); pn.after?.(); fadeDir = -1; } }
  else if (fadeDir === -1) { fade = Math.max(0, fade - realDt * 2.2); if (fade <= 0) fadeDir = 0; }
  const frozen = ov === 'pause' || ov === 'menu' || ov === 'result' || fadeDir === 1;
  const talk = ov === 'dialogue'; const dead = ov === 'death';
  // mouse look
  if (!frozen) {
    const sens = 0.0022 * s.sens; rt.camYaw -= input.dx * sens; rt.camPitch = clamp(rt.camPitch + input.dy * sens * (s.invertY ? -1 : 1), -0.4, 1.2);
    if (isDown('ArrowLeft')) rt.camYaw += 2.4 * realDt; if (isDown('ArrowRight')) rt.camYaw -= 2.4 * realDt; if (isDown('ArrowUp')) rt.camPitch = clamp(rt.camPitch - 1.4 * realDt, -0.4, 1.2); if (isDown('ArrowDown')) rt.camPitch = clamp(rt.camPitch + 1.4 * realDt, -0.4, 1.2);
    if (p.lockId !== null) { const l = rt.enemies.find((e) => e.id === p.lockId); if (l && !talk) { const want = Math.atan2(l.pos.x - p.pos.x, l.pos.z - p.pos.z); rt.camYaw += angDiff(rt.camYaw, want) * (1 - Math.exp(-5 * realDt)); rt.camPitch = damp(rt.camPitch, 0.32, 3, realDt); } }
  }
  // time scale
  let dt = realDt; if (rt.slowmo > 0) { rt.slowmo -= realDt; dt *= 0.3; } if (rt.hitstop > 0) { rt.hitstop -= realDt; dt *= 0.04; }
  if (frozen) dt = 0;
  rt.time += dt; rt.comboTimer -= dt; if (rt.comboTimer <= 0) rt.combo = 0; if (G.lastTargetT > 0) G.lastTargetT -= dt; rt.dummyDps.last += dt; if (rt.dummyDps.last > 5) { rt.dummyDps.dmg = 0; rt.dummyDps.t = 0; } else if (rt.dummyDps.dmg > 0) rt.dummyDps.t += dt;
  if (rt.cin.active && rt.cin.kind === 'finish') { rt.cin.t += realDt; if (rt.cin.t > rt.cin.dur) rt.cin.active = false; }
  rt.flash = Math.max(0, rt.flash - realDt * 2);
  if (!frozen && !talk) {
    rt.clock = (rt.clock + dt / 600) % 1; if (G.world) rt.nightMix = G.world.night;
    updatePlayer(dt, realDt);
    if (!(rt.qrt && rt.qrt.quest.steps[rt.qrt.step]?.t === 'dialogue')) { updateEnemies(dt); updateProjs(dt); }
    updateNpcs(dt); updatePickups(dt); updateQuest(dt); updateNezuko(dt);
    const step = rt.qrt?.quest.steps[rt.qrt.step]; updateAmbient(dt, !rt.qrt || step?.t === 'reach' || step?.t === 'talk');
    interact = findInteract(); if (interact && wasPressed('KeyG')) interact.run();
    if (G.world) { const pd = Math.hypot(G.world.poi.x - p.pos.x, G.world.poi.z - p.pos.z); const reg = REGION_BY_ID[rt.region]; if (pd < 3.2 && poiShown !== reg.poi.id) { poiShown = reg.poi.id; if (st.discover(reg.poi.id, 60)) { st.toast(`Discovered: ${reg.poi.name}`, 'quest'); audio.sfx('complete'); } st.toast(reg.poi.text, 'info'); } }
    p.model!.setSwordVisible(true);
    // ambience follows day/night
    const nd = G.world ? G.world.night > 0.5 : true; if (Math.floor(rt.time) % 5 === 0 && Math.random() < 0.05) { const reg = REGION_BY_ID[rt.region]; audio.setAmbience(reg.amb, nd, reg.weather === 'rain' ? 'rain' : 'none'); }
    // battle music
    const reg = REGION_BY_ID[rt.region]; const aggro = rt.enemies.some((e) => e.state !== 'dead' && e.aggro && !e.def.flags.static && Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) < 25);
    audio.setMode(rt.bossRef && rt.bossRef.aggro && rt.bossRef.state !== 'dead' ? 'boss' : aggro ? 'battle' : reg.music);
    saveT += dt; if (saveT > 45) { saveT = 0; st.save(); } st.tick(dt, rt.clock);
  } else if (talk || dead) {
    p.model!.update(realDt, rt.time); rt.enemies.forEach((e) => e.model.update(realDt * 0.5, rt.time)); updateNpcs(realDt); G.fx.nums.length; interact = null; if (G.world) rt.nightMix = G.world.night;
    if (nez) nez.model.update(realDt, rt.time);
  }
  updateBars(); updateCrow(realDt);
  if (G.world) G.world.update(frozen ? 0 : dt, rt.clock, G.camera!.position, p.pos);
  G.fx.update(frozen ? 0 : dt, pxScale);
  updateCamera(dt, realDt); pushHud(realDt); endFrameInput();
}

export function currentHud() { return useHud.getState(); }
export { rt as runtime };
