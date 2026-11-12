import * as THREE from 'three';
import { rt, type NpcRT, type Pickup } from '../runtime';
import { G, fwd, angDiff, rand, damp } from './ctx';
import { buildRig } from './rig';
import { CHAR_BY_ID, NPC_LOOKS } from '../data/characters';
import { QUEST_BY_ID } from '../data/quests';
import { BOSSES, ENEMIES } from '../data/enemies';
import { REGION_BY_ID } from '../data/regions';
import { ITEMS } from '../data/items';
import { audio } from '../audio';
import { useStore } from '../store';
import { clearEnemies, clearProjs, spawnEnemy } from './combat';
import { resolveCollisions } from './player';
import type { DialogueLine, Step } from '../types';
import type { EnemyRT } from '../runtime';

const T = new THREE.Vector3();
let travelFn: (region: string, after?: () => void) => void = () => {};
export function bindTravel(fn: typeof travelFn) { travelFn = fn; }

// ---------------- NPCs ----------------
export function spawnNpc(id: string, name: string, lookKey: string, x: number, z: number, lines: DialogueLine[], o: { shop?: boolean; smith?: boolean; tag?: string; follow?: boolean; questTalk?: boolean } = {}): NpcRT {
  const look = NPC_LOOKS[lookKey] ?? CHAR_BY_ID[lookKey]?.look ?? NPC_LOOKS.villager; const def = CHAR_BY_ID[lookKey];
  const model = buildRig(look, { outline: true, shadow: true, sword: !!def && !look.demon, blade: def?.bladeColor, glow: def?.bladeColor, dual: def?.dual });
  const y = rt.hAt(x, z); model.group.position.set(x, y, z); G.ents.add(model.group);
  const n: NpcRT = { id, name, pos: new THREE.Vector3(x, y, z), yaw: rand(0, 6), model, lines, shop: o.shop, smith: o.smith, tag: o.tag ?? 'region', follow: o.follow, talked: 0, questTalk: o.questTalk, bob: rand(0, 6), home: new THREE.Vector3(x, y, z) };
  rt.npcs.push(n); return n;
}
export function removeNpc(n: NpcRT) { G.ents.remove(n.model.group); n.model.dispose(); const i = rt.npcs.indexOf(n); if (i >= 0) rt.npcs.splice(i, 1); }
export function clearNpcs(tag?: string) { [...rt.npcs].forEach((n) => { if (!tag || n.tag === tag) removeNpc(n); }); }

export function updateNpcs(dt: number) {
  const p = rt.player!;
  for (const n of rt.npcs) {
    const dx = p.pos.x - n.pos.x; const dz = p.pos.z - n.pos.z; const d = Math.hypot(dx, dz);
    if (n.follow) {
      if (d > 3.2) { const sp = Math.min(8, 3 + d * 0.8); n.pos.x += (dx / d) * sp * dt; n.pos.z += (dz / d) * sp * dt; n.model.anim.walk = 1; n.yaw += angDiff(n.yaw, Math.atan2(dx, dz)) * (1 - Math.exp(-8 * dt)); }
      else { n.model.anim.walk = damp(n.model.anim.walk, 0, 8, dt); n.yaw += angDiff(n.yaw, Math.atan2(dx, dz)) * (1 - Math.exp(-4 * dt)); }
      if (d > 30) { n.pos.set(p.pos.x - 2, p.pos.y, p.pos.z - 2); }
    } else if (d < 9) n.yaw += angDiff(n.yaw, Math.atan2(dx, dz)) * (1 - Math.exp(-4 * dt));
    n.pos.y = damp(n.pos.y, rt.hAt(n.pos.x, n.pos.z), 20, dt); resolveCollisions(n.pos, 0.4);
    n.model.group.position.copy(n.pos); n.model.group.rotation.y = n.yaw; n.model.anim.expr = d < 5 ? 'happy' : 'normal'; n.model.update(dt, rt.time);
    if (n.questTalk && G.fx && Math.random() < 0.12) G.fx.add.emit(n.pos.x + rand(-0.15, 0.15), n.pos.y + 2.5 + Math.sin(rt.time * 3) * 0.1, n.pos.z + rand(-0.15, 0.15), 0, 0.5, 0, 0.8, 0.45, 0.1, 0xffe9a0, 1);
  }
}

// ---------------- pickups ----------------
const kindColor: Record<string, number> = { wisteria: 0xb888ff, silk: 0xd8ffd8, clue: 0xffe080, scroll: 0xffd070, ema: 0xff9a6a, feather: 0x8aa0ff, ore_piece: 0xff7a3a };
export function spawnPickup(id: string, kind: string, x: number, z: number, tag: Pickup['tag']) {
  const grp = new THREE.Group(); const col = kindColor[kind] ?? 0xffffff;
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), new THREE.MeshBasicMaterial({ color: col })); const halo = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 8), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 5, 6, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })); beam.position.y = 2.5;
  grp.add(core, halo, beam); const y = rt.hAt(x, z); grp.position.set(x, y + 1, z); G.ents.add(grp);
  rt.pickups.push({ id, kind, pos: new THREE.Vector3(x, y, z), mesh: grp, tag, label: ITEMS[kind]?.name ?? kind, t: rand(0, 6) });
}
export function clearPickups(tag?: Pickup['tag']) {
  [...rt.pickups].forEach((p) => { if (!tag || p.tag === tag) { G.ents.remove(p.mesh); p.mesh.traverse((c) => { const m = c as THREE.Mesh; if (m.geometry) m.geometry.dispose(); if (m.material) (m.material as THREE.Material).dispose(); }); rt.pickups.splice(rt.pickups.indexOf(p), 1); } });
}
function randomSpot(minD: number, maxD: number): THREE.Vector3 {
  const p = rt.player!;
  for (let t = 0; t < 20; t++) { const a = rand(0, 6.28); const r = rand(minD, maxD); const x = p.pos.x + Math.sin(a) * r; const z = p.pos.z + Math.cos(a) * r; if ((x / rt.bounds.hx) ** 2 + (z / rt.bounds.hz) ** 2 > 0.8) continue; if (rt.colliders.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + 1.2)) continue; return new THREE.Vector3(x, rt.hAt(x, z), z); }
  return new THREE.Vector3(p.pos.x + 6, p.pos.y, p.pos.z);
}
export function updatePickups(dt: number) {
  const p = rt.player!; const st = useStore.getState();
  for (const k of [...rt.pickups]) {
    k.t += dt; k.mesh.position.y = k.pos.y + 1 + Math.sin(k.t * 2) * 0.15; k.mesh.rotation.y += dt * 2; if (G.fx && Math.random() < 0.15) G.fx.add.emit(k.pos.x + rand(-0.3, 0.3), k.pos.y + 1, k.pos.z + rand(-0.3, 0.3), 0, 0.8, 0, 0.8, 0.25, 0.05, kindColor[k.kind] ?? 0xffffff, 0.9);
    if (Math.hypot(k.pos.x - p.pos.x, k.pos.z - p.pos.z) < 1.9) {
      if (k.tag === 'region') { st.collect(k.id, k.kind); st.addXp(14); st.toast(`Found: ${k.label}`, 'good'); }
      else if (rt.qrt) { rt.qrt.collected++; st.addItem(k.kind); st.toast(`Collected ${k.label}`, 'good'); }
      audio.sfx('pickup'); G.fx!.sparks(T.set(k.pos.x, k.pos.y + 1, k.pos.z), 14, kindColor[k.kind] ?? 0xffffff, 4, 0.2, 0.6); G.fx!.ring(k.pos, 2, kindColor[k.kind] ?? 0xffffff, 0.4);
      G.ents.remove(k.mesh); rt.pickups.splice(rt.pickups.indexOf(k), 1);
    }
  }
}
export function spawnRegionCollectibles() {
  const reg = REGION_BY_ID[rt.region]; const done = useStore.getState().profile.collectibles; const r = (i: number) => { const s = Math.sin(i * 12.9898 + reg.id.length * 78.233) * 43758.5453; return s - Math.floor(s); };
  for (let i = 0; i < reg.collect.n; i++) {
    const id = `${reg.id}:${i}`; if (done.includes(id)) continue;
    for (let t = 0; t < 30; t++) { const a = r(i * 7 + t) * 6.28; const rr = 14 + r(i * 3 + t + 5) * 40; const x = Math.cos(a) * rr * (reg.hx / 60); const z = Math.sin(a) * rr * (reg.hz / 60); if (Math.abs(x) > reg.hx - 4 || Math.abs(z) > reg.hz - 4) continue; if (rt.colliders.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + 1.2)) continue; spawnPickup(id, reg.collect.kind, x, z, 'region'); break; }
  }
}

// ---------------- quest runner ----------------
const stepObj = (s: Step): string => {
  switch (s.t) {
    case 'talk': return s.obj ?? `Speak with ${s.lines[0]?.who ?? 'the contact'}`;
    case 'kill': return s.obj ?? 'Defeat the demons';
    case 'boss': return s.obj ?? 'Defeat the boss';
    case 'collect': return `Collect: ${s.label}`;
    case 'survive': return s.obj ?? 'Survive';
    case 'reach': return s.obj;
    case 'dummy': return s.obj ?? 'Hit the training dummies';
    default: return '';
  }
};

function setObjective() {
  const q = rt.qrt; if (!q) return; const s = q.quest.steps[q.step]; if (!s) return; let obj = stepObj(s);
  if (s.t === 'kill') obj += ` (${Math.min(q.kills, s.n)}/${s.n})`;
  if (s.t === 'collect') obj += ` (${q.collected}/${s.n})`;
  if (s.t === 'survive') obj += ` (${Math.max(0, Math.ceil(s.sec - q.surviveT))}s)`;
  if (s.t === 'dummy' && s.n < 100) obj += ` (${q.dummyHits.size}/${s.n})`;
  const cur = useStore.getState().activeQuest; if (!cur || cur.obj !== obj || cur.step !== q.step) useStore.getState().setActiveQuest({ id: q.quest.id, title: q.quest.title, obj, step: q.step, total: q.quest.steps.length, kind: q.quest.kind });
}

export function startQuest(id: string) {
  const quest = QUEST_BY_ID[id]; if (!quest) return;
  if (rt.qrt) abandonQuest(true);
  const begin = () => {
    clearEnemies(); clearProjs(); clearNpcs('quest'); clearPickups('quest');
    rt.qrt = { quest, step: -1, kills: 0, spawnT: 1, surviveT: 0, collected: 0, bossId: null, bossDone: false, stepStart: false, escortNpc: null, dummyHits: new Set(), marker: null, markerR: 3, finishing: false };
    useStore.getState().toast(`${quest.kind === 'story' ? 'Chapter' : 'Mission'} started: ${quest.title}`, 'quest'); audio.sfx('uiok');
    nextStep();
  };
  if (quest.region !== rt.region) travelFn(quest.region, begin); else begin();
}

export function abandonQuest(silent = false) {
  if (!rt.qrt) return; clearEnemies(); clearProjs(); clearNpcs('quest'); clearPickups('quest'); rt.qrt = null; rt.bossRef = null;
  useStore.getState().setActiveQuest(null); if (!silent) useStore.getState().toast('Mission abandoned.', 'warn');
}

function nextStep() {
  const q = rt.qrt; if (!q) return; q.step++; q.kills = 0; q.collected = 0; q.surviveT = 0; q.bossId = null; q.bossDone = false; q.dummyHits = new Set(); q.marker = null; q.finishing = false; q.spawnT = 1.2;
  clearEnemies('quest'); clearNpcs('quest'); clearPickups('quest');
  if (q.step >= q.quest.steps.length) { finishQuest(); return; }
  const s = q.quest.steps[q.step]; q.stepStart = false;
  if (s.region && s.region !== rt.region) { travelFn(s.region, () => runStep()); return; }
  runStep();
}

export function restartStep() {
  const q = rt.qrt; if (!q) return; q.step--; nextStep();
}

function runStep() {
  const q = rt.qrt; if (!q) return; const s = q.quest.steps[q.step]; const p = rt.player!; const st = useStore.getState(); q.stepStart = true;
  switch (s.t) {
    case 'dialogue': st.say(s.lines, s.title, () => nextStep()); break;
    case 'talk': {
      const at = s.at ?? [p.pos.x + 6, p.pos.z - 6]; const n = spawnNpc(`q_${s.npc}`, s.lines[0].who, s.npc, at[0], at[1], s.lines, { tag: 'quest', questTalk: true }); q.marker = n.pos.clone(); break;
    }
    case 'boss': {
      const dir = fwd(rt.camYaw, new THREE.Vector3()); const pos = new THREE.Vector3(p.pos.x + dir.x * 17, 0, p.pos.z + dir.z * 17);
      if ((pos.x / rt.bounds.hx) ** 2 + (pos.z / rt.bounds.hz) ** 2 > 0.75) { pos.set(-p.pos.x * 0.4, 0, -p.pos.z * 0.4 - 14); }
      pos.y = rt.hAt(pos.x, pos.z); resolveCollisions(pos, 1.5); const e = spawnEnemy(s.boss, pos, { tag: 'quest', retreat: s.retreat }); e.state = 'intro'; e.transT = 9999; e.model.anim.pose = 'intro'; q.bossId = e.id; rt.bossRef = e;
      e.yaw = Math.atan2(p.pos.x - e.pos.x, p.pos.z - e.pos.z); G.fx!.column(pos, BOSSES[s.boss].color, 2, 22, 1.4); G.fx!.ring(pos, 12, BOSSES[s.boss].color, 1.2); audio.sfx('boss'); rt.shake = 0.8;
      rt.cin = { ...rt.cin, active: true, t: 0, dur: 1e9, kind: 'boss', focus: e.id };
      const b = BOSSES[s.boss]; st.say(b.intro, `${b.name} — ${b.title}`, () => { const ee = rt.enemies.find((x) => x.id === q.bossId); rt.cin.active = false; if (ee) { ee.state = 'chase'; ee.aggro = true; ee.t = 0; ee.model.anim.pose = 'idle'; } audio.sfx('roar'); });
      break;
    }
    case 'collect': { for (let i = 0; i < s.n; i++) { const sp = randomSpot(8, 40); spawnPickup(`q${q.step}_${i}`, s.kind ?? 'clue', sp.x, sp.z, 'quest'); } break; }
    case 'reach': {
      const y = rt.hAt(s.at[0], s.at[1]); q.marker = new THREE.Vector3(s.at[0], y, s.at[1]); q.markerR = s.r ?? 4;
      if (s.escort) { const n = spawnNpc(`esc_${s.escort}`, 'Hanako', s.escort, p.pos.x - 2, p.pos.z - 2, [{ who: 'Hanako', text: 'Thank you, Slayer-sama! I feel safe with you.' }], { tag: 'quest', follow: true }); q.escortNpc = n.id; }
      break;
    }
    case 'dummy': {
      const n = Math.min(s.n, 5); const f = fwd(p.yaw, new THREE.Vector3());
      for (let i = 0; i < n; i++) { const a = p.yaw + (i / Math.max(1, n - 1) - 0.5) * 2.2; const r = 7 + (i % 2) * 2; const pos = new THREE.Vector3(p.pos.x + Math.sin(a) * r, 0, p.pos.z + Math.cos(a) * r); pos.y = rt.hAt(pos.x, pos.z); const e = spawnEnemy('dummy', pos, { tag: 'quest' }); e.yaw = a + Math.PI; }
      void f; break;
    }
    case 'kill': {
      if (s.types.includes('boulder')) { for (let i = 0; i < s.n; i++) { const a = (i / s.n) * 2 + p.yaw - 1; const r = 8 + i * 2; const pos = new THREE.Vector3(p.pos.x + Math.sin(a) * r, 0, p.pos.z + Math.cos(a) * r); resolveCollisions(pos, 1.6); pos.y = rt.hAt(pos.x, pos.z); spawnEnemy('boulder', pos, { tag: 'quest' }); } }
      break;
    }
    default: break;
  }
  setObjective();
}

function finishQuest() {
  const q = rt.qrt!; const quest = q.quest; rt.qrt = null; rt.bossRef = null; useStore.getState().setActiveQuest(null); audio.sfx('complete');
  if (quest.kind === 'training') return; useStore.getState().completeQuest(quest);
  if (quest.id === 'ch12') useStore.getState().setFlag('ending');
}

export function onKillQuest(e: EnemyRT) {
  const q = rt.qrt; if (!q) return; const s = q.quest.steps[q.step]; if (!s) return;
  if (s.t === 'kill' && s.types.includes(e.def.id) && e.tag !== 'summon') { q.kills++; setObjective(); }
  if (s.t === 'boss' && e.id === q.bossId) { q.bossDone = true; }
}

export function updateQuest(dt: number) {
  const q = rt.qrt; if (!q || !q.stepStart) return; const s = q.quest.steps[q.step]; if (!s) return; const p = rt.player!; const quest = q.quest;
  const spawnWave = (types: string[], cap: number, interval: number, inRange = [16, 26]) => {
    q.spawnT -= dt; const alive = rt.enemies.filter((e) => e.tag === 'quest' && e.state !== 'dead').length;
    if (q.spawnT <= 0 && alive < cap) { q.spawnT = interval; const pos = randomSpot(inRange[0], inRange[1]); const type = types[Math.floor(Math.random() * types.length)]; if (ENEMIES[type]) { const e = spawnEnemy(type, pos, { tag: 'quest', level: Math.max(1, quest.level + Math.floor(rand(-1, 2))) }); e.aggro = true; e.state = 'chase'; G.fx!.sparks(T.set(pos.x, pos.y + 0.5, pos.z), 8, 0x8a4aa0, 3, 0.2, 0.5); } }
  };
  switch (s.t) {
    case 'kill': {
      if (!s.types.includes('boulder')) { const alive = rt.enemies.filter((e) => e.tag === 'quest' && e.state !== 'dead').length; const remaining = s.n - q.kills; if (remaining > alive) spawnWave(s.types, Math.min(4 + Math.floor(quest.diff / 2), remaining), 2.2); }
      if (q.kills >= s.n) { nextStep(); } break;
    }
    case 'survive': { q.surviveT += dt; spawnWave(s.types, 3 + Math.min(4, quest.diff), 2.6); setObjective(); if (q.surviveT >= s.sec) { rt.enemies.filter((e) => e.tag === 'quest').forEach((e) => { e.hp = 0; }); clearEnemies('quest'); nextStep(); } break; }
    case 'collect': { setObjective(); if (q.collected >= s.n) nextStep(); break; }
    case 'boss': { if (q.bossDone) { q.finishing = true; q.surviveT += dt; if (q.surviveT > 3.2) { rt.cin.active = false; nextStep(); } } break; }
    case 'reach': {
      if (q.marker && Math.hypot(q.marker.x - p.pos.x, q.marker.z - p.pos.z) < q.markerR) { const esc = s.escort ? rt.npcs.find((n) => n.id === q.escortNpc) : null; if (!esc || Math.hypot(esc.pos.x - p.pos.x, esc.pos.z - p.pos.z) < 9) { audio.sfx('uiok'); nextStep(); } }
      break;
    }
    case 'dummy': { rt.enemies.forEach((e) => { if (e.def.flags.dummy && e.sinceHit < 0.4) q.dummyHits.add(e.id); }); setObjective(); if (q.dummyHits.size >= s.n) nextStep(); break; }
    default: break;
  }
  if (q.marker && G.fx && Math.random() < 0.25) G.fx.add.emit(q.marker.x + rand(-0.5, 0.5), q.marker.y + 0.2, q.marker.z + rand(-0.5, 0.5), 0, 4, 0, 1.2, 0.5, 0.1, 0xffe08a, 0.8);
}

// ---------------- interaction ----------------
export interface Interact { prompt: string; run: () => void }
export function findInteract(): Interact | null {
  const p = rt.player!; const st = useStore.getState();
  let best: { d: number; it: Interact } | null = null;
  for (const n of rt.npcs) {
    const d = Math.hypot(n.pos.x - p.pos.x, n.pos.z - p.pos.z); if (d > 3.6 || n.follow) continue;
    if (!best || d < best.d) best = { d, it: { prompt: `Talk to ${n.name}`, run: () => talkTo(n) } };
  }
  for (const g of rt.gates) {
    const d = Math.hypot(g.pos.x - p.pos.x, g.pos.z - p.pos.z); if (d > 5) continue; const reg = REGION_BY_ID[g.to]; const ok = reg.unlock <= st.profile.chapter;
    if (!best || d < best.d) best = { d, it: { prompt: ok ? `Travel to ${reg.name}` : `${reg.name} — locked (complete Chapter ${reg.unlock})`, run: () => { if (ok) travelFn(g.to); else { st.toast(`Complete Chapter ${reg.unlock} to unlock ${reg.name}.`, 'warn'); audio.sfx('deny'); } } } };
  }
  return best ? best.it : null;
}

function talkTo(n: NpcRT) {
  const st = useStore.getState(); const q = rt.qrt; const s = q ? q.quest.steps[q.step] : null; audio.sfx('uiok');
  if (n.questTalk && q && s && s.t === 'talk') { st.say(s.lines, undefined, () => { removeNpcLater(n); nextStep(); }); return; }
  const line = n.lines[n.talked++ % n.lines.length];
  st.say([line], undefined, () => { if (n.shop) { st.openMenu('smith'); } else if (n.smith) { st.openMenu('smith'); } });
}
function removeNpcLater(n: NpcRT) { n.questTalk = false; setTimeout(() => { if (rt.npcs.includes(n) && rt.qrt && !rt.qrt.quest.steps[rt.qrt.step]?.t.startsWith('talk')) removeNpc(n); }, 8000); }
