import type { DialogueLine, MissionDef, NpcDef, SpawnDef, Stage } from '../types';
import { newPose } from '../types';
import { rt, bump, yawTo, angleDiff, type NpcRT } from '../runtime';
import { MISSIONS, getMission } from '../data/missions';
import { NPCS, COLLECTIBLES, buildColliders } from '../data/world';
import { getEnemy } from '../data/enemies';
import { useGame, finishDialogue } from '../store';
import { useHud, pushToast, showBanner, showZone } from '../hudStore';
import { applyEvent, newProgress, stageComplete, objectiveLabel, objectiveDone, objectiveTarget, missionAvailable, type MissionEvent } from '../logic/missionLogic';
import { rankIndexFor } from '../logic/stats';
import { zoneAt } from '../config';
import { bus } from '../bus';
import { audio } from '../audio';
import { spawnEnemy, clearEnemies, initCamps, updateCamps } from './enemies';
import { spawnCompanion, clearAllies } from './allies';
import { floater, healPlayer, schedule, shake } from './combat';
import { burst, ring } from './fx';
import { groundHeight } from '../logic/collision';

export function initWorld() {
  rt.colliders = buildColliders();
  const collected = new Set(useGame.getState().profile.collected);
  rt.npcs = NPCS.map((def): NpcRT => ({ def, pos: { x: def.pos[0], y: groundHeight(rt.colliders, def.pos[0], def.pos[1], 3, 0.3), z: def.pos[1] }, yaw: def.yaw, pose: newPose(), wanderT: 0, tx: def.pos[0], tz: def.pos[1] }));
  rt.collectibles = COLLECTIBLES.map((def) => ({ def, taken: !def.mission && collected.has(def.id) }));
  initCamps();
  bump('npcs'); bump('collectibles');
}

export const rankOf = () => { const p = useGame.getState().profile; return rankIndexFor(p.chars[p.charId].level, !!p.flags.genin); };

function stageOf(m = rt.mission): Stage | null { if (!m) return null; return getMission(m.id)?.stages[m.stage] ?? null; }

// ------------------------------------------------------------------ mission flow
export function startMission(id: string): boolean {
  const def = getMission(id); if (!def || def.status !== 'playable' || rt.mission) return false;
  const p = useGame.getState().profile;
  const av = missionAvailable(def, rankOf(), p.chars[p.charId].level, p.completed); if (!av.ok) { pushToast(av.reason ?? 'Unavailable', 'warn'); return false; }
  if (p.completed.includes(id)) return false;
  rt.mission = { id, stage: 0, progress: newProgress(def.stages[0]), elapsed: 0 };
  rt.collectibles.forEach((c) => { if (c.def.mission === id) c.taken = false; });
  bump('collectibles');
  showBanner(def.kind === 'story' ? def.name : 'MISSION START', def.kind === 'story' ? 'Story Mission' : def.name, 2600);
  audio.sfx('confirm');
  enterStage(false); syncMission(); pushMissionHud(true);
  return true;
}

function spawnList(specs: SpawnDef[], def: MissionDef, around: boolean) {
  const p = rt.player;
  for (const s of specs) {
    const n = s.count ?? 1;
    for (let i = 0; i < n; i++) {
      let x: number, z: number;
      if (around) { const a = Math.random() * 6.28, r = 14 + Math.random() * 6; x = p.pos.x + Math.cos(a) * r; z = p.pos.z + Math.sin(a) * r; }
      else { const sp = s.spread ?? 3; x = s.pos[0] + (Math.random() - 0.5) * sp * 2; z = s.pos[1] + (Math.random() - 0.5) * sp * 2; }
      const e = spawnEnemy(s.def, x, z, { lv: s.lv ?? 3, tag: s.tag, mission: true, aggro: around || getEnemy(s.def).tier === 'dummy' ? around : false });
      if (e && around) e.state = 'chase';
    }
  }
  void def;
}

function enterStage(silent: boolean) {
  const m = rt.mission; if (!m) return; const def = getMission(m.id)!; const st = def.stages[m.stage];
  clearEnemies((e) => e.fromMission); rt.waveQueue = (st.waves ?? []).map((w) => ({ at: w.at, spawn: w.spawn })); rt.stageTimer = 0; m.elapsed = 0;
  rt.checkpoint = m.stage === 0 && def.checkpoint && def.kind === 'side' ? { x: def.checkpoint[0], z: def.checkpoint[1] } : (st.boss && def.checkpoint) ? { x: def.checkpoint[0], z: def.checkpoint[1] } : { x: rt.player.pos.x, z: rt.player.pos.z };
  if (st.companions) { st.companions.forEach((c, i) => spawnCompanion(c as 'sasuke' | 'sakura' | 'kakashi' | 'tazuna', rt.player.pos.x + 2 + i, rt.player.pos.z + 1)); }
  if (st.clearCompanions) clearAllies({ missionOnly: true });
  const survive = st.objectives.some((o) => o.type === 'survive');
  const begin = () => {
    if (st.spawn) spawnList(st.spawn, def, survive);
    if (st.boss) spawnBoss(st.boss.id, st.boss.pos, silent);
  };
  if (!silent && st.intro) useGame.getState().openDialogue(st.intro, { onEnd: begin }); else begin();
  if (!silent && m.stage > 0) { audio.sfx('confirm', 0.7); }
  pushMissionHud(true);
}

export function spawnBoss(id: string, pos: [number, number], silent: boolean) {
  const def = getEnemy(id);
  const lv = id === 'zabuza' ? 7 : 9;
  const e = spawnEnemy(id, pos[0], pos[1], { lv, mission: true, aggro: true, tag: id });
  if (!e) return;
  e.state = silent ? 'chase' : 'alert'; e.stateT = 0;
  if (!silent) {
    rt.cine = { kind: 'boss', t: 0, dur: 3.4, tx: pos[0], ty: 1.8, tz: pos[1], radius: 8, height: 2.2, speed: 0.35, freeze: true, startYaw: Math.atan2(rt.player.pos.x - pos[0], rt.player.pos.z - pos[1]) + 0.8 };
    audio.sfx('bossIntro'); showBanner(def.name, def.title ?? '', 3200); rt.mistT = id === 'zabuza' ? 12 : 0;
    burst(pos[0], 1, pos[1], { n: 40, color: def.color, color2: '#fff', speed: 6, life: 1, size: 0.6 }); ring(pos[0], 0.3, pos[1], { color: def.color, r1: 10, life: 0.9 });
  }
}

function advanceStage() {
  const m = rt.mission; if (!m) return; const def = getMission(m.id)!;
  if (m.stage + 1 < def.stages.length) {
    m.stage++; m.progress = newProgress(def.stages[m.stage]); pushToast('Objective complete', 'good', 1800); audio.sfx('pickup');
    enterStage(false); syncMission();
  } else completeMission();
}

function completeMission() {
  const m = rt.mission; if (!m) return; const def = getMission(m.id)!; const g = useGame.getState();
  rt.mission = null; clearEnemies((e) => e.fromMission); clearAllies({ missionOnly: true }); rt.waveQueue = [];
  g.patchProfile((p) => ({ completed: p.completed.includes(def.id) ? p.completed : [...p.completed, def.id], activeMission: null }));
  g.grantRewards(def.rewards);
  showBanner('MISSION COMPLETE', def.name, 3200); audio.sfx('victory'); shake(0.3);
  const done = () => { pushMissionHud(true); bus.emit('autosave'); };
  if (def.outro?.length) schedule(0.6, () => g.openDialogue(def.outro!, { onEnd: done })); else done();
}

export function abandonMission(silent = false) {
  if (!rt.mission) return;
  rt.mission = null; clearEnemies((e) => e.fromMission); clearAllies({ missionOnly: true }); rt.waveQueue = [];
  useGame.getState().patchProfile(() => ({ activeMission: null }));
  if (!silent) pushToast('Mission abandoned', 'warn');
  syncMission(); pushMissionHud(true);
}

export function restartStage() {
  if (!rt.mission) return; const def = getMission(rt.mission.id)!;
  rt.mission.progress = newProgress(def.stages[rt.mission.stage]); rt.boss = null; enterStage(true); syncMission();
}

export function syncMission() { useGame.setState((s) => ({ profile: { ...s.profile, activeMission: rt.mission ? { ...rt.mission, progress: rt.mission.progress.slice() } : null } })); }
export function restoreMission() { const am = useGame.getState().profile.activeMission; if (am) { rt.mission = { ...am, progress: am.progress.slice() }; rt.collectibles.forEach((c) => { if (c.def.mission === am.id) c.taken = false; }); enterStage(true); pushMissionHud(true); } }

bus.on('mission', (ev: MissionEvent) => {
  const m = rt.mission; if (!m) return; const st = stageOf(m); if (!st) return;
  const next = applyEvent(st, m.progress, ev);
  const changed = next.some((v, i) => v !== m.progress[i]);
  if (!changed) return;
  m.progress = next;
  if (ev.t !== 'tick' && ev.t !== 'pos') { pushMissionHud(true); audio.sfx('ui', 0.5); }
  if (stageComplete(st, next)) advanceStage();
});

// ------------------------------------------------------------------ HUD helpers
let lastHud = '';
export function pushMissionHud(force = false) {
  const m = rt.mission; const set = useHud.getState().set;
  if (!m) { const s = JSON.stringify(['none']); if (force || lastHud !== s) { lastHud = s; set({ missionTitle: null, objectives: [], hint: null, timeLimit: null, objDist: null }); } return; }
  const def = getMission(m.id)!; const st = def.stages[m.stage];
  const objectives = st.objectives.map((o, i) => ({ text: objectiveLabel(o, m.progress[i] ?? 0), done: objectiveDone(o, m.progress[i] ?? 0) }));
  const tl = st.timeLimit ? Math.max(0, st.timeLimit - m.elapsed) : null;
  const key = JSON.stringify([def.id, objectives, st.hint, tl !== null ? Math.ceil(tl) : null]);
  if (!force && key === lastHud) return; lastHud = key;
  set({ missionTitle: def.name, objectives, hint: st.hint ?? null, timeLimit: tl });
}

export function objectiveMarker(): { x: number; z: number } | null {
  const m = rt.mission; if (!m) return null; const def = getMission(m.id)!; const st = def.stages[m.stage]; const p = rt.player;
  for (let i = 0; i < st.objectives.length; i++) {
    const o = st.objectives[i]; const prog = m.progress[i] ?? 0; if (objectiveDone(o, prog)) continue;
    const t = objectiveTarget(o, prog, (id) => { const n = rt.npcs.find((x) => x.def.id === id); const a = rt.allies.find((x) => x.charId === id); const q = n && !rt.allies.some((x) => x.charId === id) ? n : null; return q ? [q.pos.x, q.pos.z] : a ? [a.pos.x, a.pos.z] : undefined; });
    if (t) return { x: t[0], z: t[1] };
    if (o.type === 'collect') { let b: { x: number; z: number } | null = null; let bd = 1e9; for (const c of rt.collectibles) { if (c.taken || c.def.mission !== m.id || (c.def.tag ?? c.def.kind) !== o.kind) continue; const d = Math.hypot(c.def.pos[0] - p.pos.x, c.def.pos[2] - p.pos.z); if (d < bd) { bd = d; b = { x: c.def.pos[0], z: c.def.pos[2] }; } } if (b) return b; }
    if (o.type === 'kill' || o.type === 'boss') { let b: { x: number; z: number } | null = null; let bd = 1e9; for (const e of rt.enemies) { if (!e.fromMission || e.state === 'dead') continue; const d = Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z); if (d < bd) { bd = d; b = { x: e.pos.x, z: e.pos.z }; } } if (b) return b; }
  }
  return null;
}

// ------------------------------------------------------------------ NPC interaction
const ROLE_LINES: Record<string, string> = {};
const TAZUNA_NPC: NpcDef = { id: 'tazuna', name: 'Tazuna', pos: [0, 0], yaw: 0, look: NPCS[0].look, zone: 'konoha', role: 'flavor', portrait: 'tazuna', lines: ['Heh, you brats are tougher than you look!', 'I have a bridge to finish. Thank you for protecting me.'] };
function parseLines(lines: string[]): DialogueLine[] { return lines.map((l) => { const i = l.indexOf(': '); return i > 0 && i < 20 ? { speaker: l.slice(0, i), text: l.slice(i + 2) } : { speaker: '', text: l }; }); }

bus.on('interact', (it: { kind: string; id: string }) => {
  const g = useGame.getState();
  if (it.kind === 'board') { g.setOverlay('missions'); audio.sfx('ui'); return; }
  if (it.kind !== 'npc') return;
  const npc = NPCS.find((n) => n.id === it.id) ?? (it.id === 'tazuna' ? TAZUNA_NPC : undefined); if (!npc) return;
  audio.sfx('ui', 0.6);
  const rn = rt.npcs.find((n) => n.def.id === npc.id); if (rn) rn.yaw = yawTo(rt.player.pos.x - rn.pos.x, rt.player.pos.z - rn.pos.z);
  const sp = (t: string, who = npc.name): DialogueLine => ({ speaker: who.split(' (')[0], text: t, portrait: npc.id });
  // 1. talk objective of the active mission
  const m = rt.mission;
  if (m) {
    const def = getMission(m.id)!; const st = def.stages[m.stage];
    const idx = st.objectives.findIndex((o, i) => o.type === 'talk' && o.npc === npc.id && !objectiveDone(o, m.progress[i] ?? 0));
    if (idx >= 0) { const o = st.objectives[idx]; if (o.type === 'talk') { g.openDialogue(o.lines?.length ? o.lines : [sp('...')], { onEnd: () => bus.emit('mission', { t: 'talk', npc: npc.id } as MissionEvent) }); return; } }
  }
  // 2. mission offers
  const p = g.profile; const offers = MISSIONS.filter((x) => x.giver === npc.id && x.status === 'playable' && !p.completed.includes(x.id));
  if (offers.length) {
    const lv = p.chars[p.charId].level; const rank = rankOf();
    const ok = offers.find((x) => missionAvailable(x, rank, lv, p.completed).ok);
    if (ok && !m) {
      g.openDialogue(ok.offer, { choices: [{ label: `Accept: ${ok.name}`, action: () => finishDialogue(() => startMission(ok.id)) }, { label: 'Not now', action: () => finishDialogue() }] }); return;
    }
    if (ok && m) { g.openDialogue([sp('You already have a mission in progress. Finish or abandon it first.')]); return; }
    const first = offers[0]; const why = missionAvailable(first, rank, lv, p.completed).reason;
    g.openDialogue([sp(`${npc.lines[0] ?? '...'}`), { speaker: 'System', text: `"${first.name}" is not available yet: ${why}.` }]); return;
  }
  // 3. roles
  if (npc.role === 'shop' && npc.shop) { g.openDialogue([sp(npc.lines[0])], { choices: [{ label: 'Browse wares', action: () => { finishDialogue(); g.openShop(npc.name, npc.shop!); } }, { label: 'Leave', action: () => finishDialogue() }] }); return; }
  if (npc.role === 'healer') {
    g.openDialogue([sp(npc.lines[0])], { onEnd: () => { const pl = rt.player; pl.hp = pl.stats.maxHp; pl.chakra = pl.stats.maxChakra; pl.stamina = 100; ring(pl.pos.x, 0.3, pl.pos.z, { color: '#7cffb0', r1: 4, life: 0.8 }); burst(pl.pos.x, 1, pl.pos.z, { n: 30, color: '#7cffb0', speed: 3, up: 3, life: 1 }); audio.sfx('levelup', 0.7); pushToast('Fully restored — progress saved', 'good'); bus.emit('autosave'); } }); return;
  }
  const line = npc.lines[Math.floor(Math.random() * npc.lines.length)] ?? '...';
  g.openDialogue([sp(line)]);
  void ROLE_LINES; void parseLines;
});

export function parseOutro(lines: string[]): DialogueLine[] { return parseLines(lines); }

// ------------------------------------------------------------------ Boss defeat
bus.on('bossDefeated', (e: { def: { id: string; name: string; outro?: string[] } }) => {
  rt.slowT = 1.6; audio.sfx('victory'); shake(0.8); showBanner('VICTORY', e.def.name + ' defeated', 3600);
  const g = useGame.getState(); g.patchProfile((p) => ({ bossesDefeated: p.bossesDefeated.includes(e.def.id) ? p.bossesDefeated : [...p.bossesDefeated, e.def.id] }));
  rt.cine = { kind: 'victory', t: 0, dur: 3.2, tx: rt.player.pos.x, ty: 1.5, tz: rt.player.pos.z, radius: 7, height: 2, speed: 0.4, freeze: false, startYaw: rt.player.yaw + 2.4 };
  rt.mistT = 0;
  schedule(2.2, () => {
    clearEnemies((x) => x.summoned);
    const fire = () => bus.emit('mission', { t: 'boss', id: e.def.id } as MissionEvent);
    if (e.def.outro?.length) g.openDialogue(parseLines(e.def.outro), { onEnd: fire }); else fire();
  });
});

// ------------------------------------------------------------------ per-frame world update
let tickAcc = 0; let posAcc = 0; let hudAcc = 0; let lastZone = '';
export function updateWorld(dt: number) {
  const p = rt.player; const gh = useGame.getState();
  // NPC idle: face the player when near
  for (const n of rt.npcs) {
    const d = Math.hypot(p.pos.x - n.pos.x, p.pos.z - n.pos.z); n.pose.t += dt;
    if (d < 9 && n.def.role !== 'flavor' || d < 6) n.yaw += angleDiff(n.yaw, yawTo(p.pos.x - n.pos.x, p.pos.z - n.pos.z)) * Math.min(1, dt * 3);
  }
  // collectibles
  for (const c of rt.collectibles) {
    if (c.taken || (c.def.mission && rt.mission?.id !== c.def.mission)) continue;
    const dx = c.def.pos[0] - p.pos.x, dz = c.def.pos[2] - p.pos.z; const dy = c.def.pos[1] - (p.pos.y + 1);
    if (dx * dx + dz * dz < 2.6 * 2.6 && Math.abs(dy) < 3) {
      c.taken = true; bump('collectibles'); audio.sfx('pickup');
      burst(c.def.pos[0], c.def.pos[1], c.def.pos[2], { n: 20, color: '#ffe14a', color2: '#fff', speed: 4, life: 0.6, up: 2 });
      floater(c.def.pos[0], c.def.pos[1] + 1, c.def.pos[2], c.def.label, '#ffe14a', 1);
      if (!c.def.mission) { gh.markCollected(c.def.id); const r = c.def.reward ?? {}; gh.grantRewards({ xp: r.xp ?? 0, ryo: r.ryo ?? 0, items: r.items }); }
      bus.emit('mission', { t: 'collect', kind: c.def.tag ?? c.def.kind } as MissionEvent);
    }
  }
  // zone change
  const z = zoneAt(p.pos.x, p.pos.z); rt.zone = z;
  if (z.id !== lastZone) {
    if (lastZone) { showZone(z.name, z.sub); bus.emit('autosave'); } lastZone = z.id;
    useHud.getState().set({ zone: z.name, zoneSub: z.sub });
  }
  updateCamps();
  // missions
  const m = rt.mission;
  if (m) {
    const def = getMission(m.id)!; const st = def.stages[m.stage]; if (!st) return;
    rt.stageTimer += dt; m.elapsed += dt;
    while (rt.waveQueue.length && rt.stageTimer >= rt.waveQueue[0].at) {
      const w = rt.waveQueue.shift()!; if (w.at > 0) { pushToast('Reinforcements incoming!', 'warn'); audio.sfx('telegraph'); }
      spawnList(w.spawn, def, st.objectives.some((o) => o.type === 'survive'));
    }
    posAcc += dt; tickAcc += dt;
    if (posAcc > 0.1) { posAcc = 0; bus.emit('mission', { t: 'pos', x: p.pos.x, y: p.pos.y, z: p.pos.z } as MissionEvent); }
    if (tickAcc > 0.1) { const d = tickAcc; tickAcc = 0; bus.emit('mission', { t: 'tick', dt: d, charging: p.charging } as MissionEvent); }
    if (st.timeLimit && m.elapsed > st.timeLimit) { pushToast('Time is up — mission failed', 'warn'); audio.sfx('error'); abandonMission(true); return; }
    hudAcc += dt; if (hudAcc > 0.25) { hudAcc = 0; pushMissionHud(); }
  }
  // objective compass
  const mk = objectiveMarker();
  if (mk) { const dx = mk.x - p.pos.x, dz = mk.z - p.pos.z; useHud.setState({ objDist: Math.hypot(dx, dz), objAngle: angleDiff(rt.camYaw, yawTo(dx, dz)) }); }
  else if (useHud.getState().objDist !== null) useHud.setState({ objDist: null });
}
export function resetMissionModule() { lastZone = ''; lastHud = ''; tickAcc = posAcc = hudAcc = 0; }
export { healPlayer };
