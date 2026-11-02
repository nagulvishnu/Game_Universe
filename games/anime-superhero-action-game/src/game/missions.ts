import * as THREE from "three";
import { G, P, V3, rnd, pick, later } from "./core";
import { fx } from "./fx";
import { sfx, setMusicLevel } from "./audio";
import { spawnEnemy, removeEnemy } from "./enemies";
import { spawnBoss } from "./bosses";
import { spawnCiv, removeCiv, spawnProp, clearProps, scare } from "./city";
import { freeSpot, ARENA, env } from "./world";
import { killEnemy } from "./combat";
import { useGame, toast, banner } from "../store";

export interface Mission { def: MissionDef; t: number; obj: string[]; enemies: any[]; d: any; focus: V3 | null }
export interface MissionDef {
  id: string; name: string; district: string; brief: string; pos: V3; xp: number; boss?: boolean; gate?: () => string | null;
  start: (m: Mission) => void; update: (m: Mission, dt: number) => "win" | "fail" | void; cleanup?: (m: Mission) => void;
}
let root: THREE.Group;
const alive = (m: Mission) => m.enemies.filter((e) => !e.dead && !e.removed);
const centroid = (list: any[]) => {
  if (!list.length) return null;
  const c = new V3();
  list.forEach((e) => c.add(e.pos));
  return c.multiplyScalar(1 / list.length);
};
const spawnN = (m: Mission, type: string, n: number, cx: number, cz: number, spread = 14, o: any = {}) => {
  for (let i = 0; i < n; i++) { const e = spawnEnemy(type, cx + rnd(-spread, spread), cz + rnd(-spread, spread), { aggro: false, ...o }); e.keep = true; m.enemies.push(e); }
};
const done = (id: string) => useGame.getState().missionsDone.includes(id);
const farAway = (m: Mission, d = 230) => Math.hypot(P.pos.x - m.def.pos.x, P.pos.z - m.def.pos.z) > d && P.pos.x < 600;

export const MISSIONS: MissionDef[] = [
  {
    id: "patrol", name: "First Patrol", district: "Central Downtown", brief: "A gang is terrorising the crossroads west of Hero Tower. Take them down.", pos: new V3(-22, 0, 22), xp: 160,
    start: (m) => { spawnN(m, "criminal", 6, -40, 40, 10); },
    update: (m) => {
      const a = alive(m);
      m.obj = [`Defeat the street criminals  ${6 - a.length}/6`];
      m.focus = centroid(a);
      a.forEach((e) => { if (Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z) < 45) e.aggro = true; });
      if (!a.length) return "win";
      if (farAway(m)) return "fail";
    },
  },
  {
    id: "rescue", name: "Cry for Help", district: "Sakura Heights", brief: "Civilians are being held at the Sakura Heights crossroads. Defeat the guards and free them.", pos: new V3(-200, 0, -40), xp: 220,
    start: (m) => {
      m.d.civs = [];
      for (let i = 0; i < 4; i++) { const p = freeSpot(-200 + (i % 2 ? 12 : -12), -40 + (i < 2 ? -22 : 22), 3); m.d.civs.push(spawnCiv(p.x, p.z, true)); }
      spawnN(m, "criminal", 5, -200, -40, 8);
      spawnN(m, "criminal", 1, -200, -40, 8);
      m.d.rescued = 0;
      G.hooks.canRescue = (c: any) => {
        const blocked = alive(m).some((g) => Math.hypot(g.pos.x - c.pos.x, g.pos.z - c.pos.z) < 10);
        if (blocked && (m.d.warn ?? 0) < G.time) { m.d.warn = G.time + 4; toast("Defeat the guards near the civilian first!", "#ffb"); }
        return !blocked;
      };
      G.hooks.onRescue = () => { m.d.rescued++; toast(`Civilian rescued ${m.d.rescued}/4`, "#6fa"); };
    },
    update: (m) => {
      const a = alive(m);
      m.obj = [`Rescue civilians  ${m.d.rescued}/4`, `Defeat the guards  ${6 - a.length}/6`];
      const pend = m.d.civs.filter((c: any) => !c.rescued);
      m.focus = pend.length ? centroid(pend.map((c: any) => ({ pos: c.pos }))) : null;
      a.forEach((e) => { if (Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z) < 45) e.aggro = true; });
      if (m.d.rescued >= 4) return "win";
      if (farAway(m)) return "fail";
    },
    cleanup: (m) => { G.hooks.canRescue = undefined; G.hooks.onRescue = undefined; later(5, () => m.d.civs?.forEach((c: any) => removeCiv(c))); },
  },
  {
    id: "neon", name: "Neon Ambush", district: "Neon Ward", brief: "Fire assassins and gunners are attacking the Neon Ward. Stop the assault wave by wave.", pos: new V3(200, 0, -40), xp: 300,
    start: (m) => { m.d.wave = 0; m.d.next = 0; },
    update: (m, dt) => {
      const a = alive(m);
      if (m.d.wave < 3 && a.length === 0) {
        m.d.next -= dt;
        if (m.d.next <= 0) {
          m.d.wave++;
          m.d.next = 3;
          if (m.d.wave === 1) { spawnN(m, "assassin", 3, 200, -80, 12, { aggro: true }); spawnN(m, "gunner", 2, 200, -100, 10, { aggro: true }); }
          if (m.d.wave === 2) { spawnN(m, "ninja", 2, 200, -80, 12, { aggro: true }); spawnN(m, "gunner", 2, 200, -100, 10, { aggro: true }); spawnN(m, "hunter", 2, 200, -80, 10, { aggro: true }); }
          if (m.d.wave === 3) { spawnN(m, "assassin", 2, 200, -80, 12, { aggro: true }); spawnN(m, "ninja", 2, 200, -80, 12, { aggro: true }); spawnN(m, "brute", 1, 200, -90, 6, { aggro: true }); spawnN(m, "hunter", 1, 200, -80, 10, { aggro: true }); banner("FINAL WAVE", "Neon Ambush", "#ff4a9a", 1600); }
          if (m.d.wave > 1 || true) toast(`Wave ${m.d.wave}/3`, "#ff9ad0");
        }
      }
      m.obj = [`Stop the attack — Wave ${Math.max(1, m.d.wave)}/3`, `Enemies remaining  ${a.length}`];
      m.focus = centroid(a) ?? new V3(200, 0, -70);
      if (m.d.wave >= 3 && a.length === 0) return "win";
      if (farAway(m, 260)) return "fail";
    },
  },
  {
    id: "hideout", name: "Iron Docks Hideout", district: "Iron Docks", brief: "Investigate the villain hideout in the docks. Recover 3 data cores — but expect ambushes.", pos: new V3(0, 0, -200), xp: 380,
    start: (m) => {
      m.d.cores = [new V3(-15, 1.6, -250), new V3(15, 1.6, -250), new V3(0, 1.6, -257)].map((p) => {
        const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.9, 0), new THREE.MeshBasicMaterial({ color: 0x40ffd0 }));
        mesh.position.copy(p);
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 14, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0x40ffd0, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
        beam.position.set(p.x, 8, p.z);
        root.add(mesh, beam);
        return { p, mesh, beam, got: false };
      });
      m.d.got = 0;
      m.d.entered = false;
      spawnN(m, "criminal", 3, 0, -245, 8);
      spawnN(m, "gunner", 1, 0, -255, 6);
    },
    update: (m, dt) => {
      const a = alive(m);
      const inside = Math.abs(P.pos.x) < 27 && P.pos.z < -221 && P.pos.z > -263;
      if (inside && !m.d.entered) { m.d.entered = true; toast("You entered the hideout.", "#f88"); a.forEach((e) => (e.aggro = true)); }
      for (const c of m.d.cores) {
        if (c.got) continue;
        c.mesh.rotation.y += dt * 2; c.mesh.position.y = 1.6 + Math.sin(G.time * 3) * 0.25;
        fx.em(c.p.x + rnd(-0.6, 0.6), 1 + rnd(0, 1.5), c.p.z + rnd(-0.6, 0.6), 0, 1.5, 0, 0x40ffd0, 0.4, 0.8);
        if (Math.hypot(P.pos.x - c.p.x, P.pos.z - c.p.z) < 3.2 && P.pos.y < 6) {
          c.got = true; m.d.got++;
          root.remove(c.mesh, c.beam);
          sfx("pickup"); fx.burst(c.p, 0x40ffd0, 24, 8, 0.5, 0.8, 0);
          toast(`Data core recovered ${m.d.got}/3 — enemies incoming!`, "#6fe");
          const n = m.d.got === 3 ? 3 : 2;
          spawnN(m, "ninja", n, c.p.x, c.p.z + 6, 5, { aggro: true });
          if (m.d.got === 3) spawnN(m, "brute", 1, 0, -235, 4, { aggro: true });
          if (m.d.got === 2) spawnN(m, "assassin", 2, 0, -235, 6, { aggro: true });
        }
      }
      const next = m.d.cores.find((c: any) => !c.got);
      m.obj = [m.d.entered ? `Recover data cores  ${m.d.got}/3` : "Enter the hideout (Iron Docks, north)", `Hostiles  ${a.length}`];
      m.focus = next ? next.p.clone() : centroid(a);
      if (!m.d.entered && !next) m.focus = new V3(0, 0, -222);
      if (!m.d.entered) m.focus = new V3(0, 0, -222);
      if (m.d.got >= 3 && a.length === 0) return "win";
      if (farAway(m, 200)) return "fail";
    },
    cleanup: (m) => { m.d.cores?.forEach((c: any) => root.remove(c.mesh, c.beam)); },
  },
  {
    id: "park", name: "Protect the Park", district: "Green Park", brief: "Raiders are descending on the Spirit Beacon in Green Park. Keep it alive for 75 seconds.", pos: new V3(-40, 0, 200), xp: 420,
    start: (m) => {
      const bp = new V3(-80, 0, 240);
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.6, 12, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0x66ffcc, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      mesh.position.set(bp.x, 6, bp.z);
      const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4, 1), new THREE.MeshBasicMaterial({ color: 0xaaffe8 }));
      core.position.set(bp.x, 3, bp.z);
      root.add(mesh, core);
      const b: any = { beacon: true, pos: bp, hp: 1800, maxHp: 1800, r: 2.6, dead: false, name: "Spirit Beacon", flash: 0, h: 6, kb: new V3() };
      m.d.beacon = b; m.d.mesh = mesh; m.d.core = core; m.d.timeline = [[2, "criminal", 3], [14, "hunter", 2], [26, "brute", 1], [28, "criminal", 3], [42, "gunner", 2], [44, "assassin", 2], [56, "hunter", 2], [58, "brute", 1]]; m.d.t = 0; m.d.i = 0;
      G.allies.push(b);
      G.beaconFocus = true;
    },
    update: (m, dt) => {
      const b = m.d.beacon;
      m.d.t += dt;
      m.d.core.rotation.y += dt; m.d.core.position.y = 3 + Math.sin(G.time * 2) * 0.3;
      m.d.mesh.material.opacity = 0.25 + (b.hp / b.maxHp) * 0.3;
      if (b.flash > 0) b.flash -= dt;
      if (Math.random() < 0.3) fx.em(b.pos.x + rnd(-1, 1), 1, b.pos.z + rnd(-1, 1), 0, 3, 0, 0x66ffcc, 0.6, 1);
      while (m.d.i < m.d.timeline.length && m.d.t >= m.d.timeline[m.d.i][0]) {
        const [, type, n] = m.d.timeline[m.d.i++];
        for (let i = 0; i < n; i++) {
          const a = rnd(0, 6.28);
          const e = spawnEnemy(type, b.pos.x + Math.cos(a) * 55, b.pos.z + Math.sin(a) * 40, { aggro: true });
          e.keep = true; m.enemies.push(e);
        }
        toast("Raiders approaching the Beacon!", "#fb8");
      }
      const a = alive(m);
      m.obj = [`Protect the Spirit Beacon  ${Math.max(0, Math.round((b.hp / b.maxHp) * 100))}%`, `Hold out for ${Math.max(0, Math.ceil(75 - m.d.t))}s`];
      m.focus = b.pos.clone();
      if (b.dead || b.hp <= 0) { b.dead = true; return "fail"; }
      if (m.d.t >= 75 && a.length <= 2) { a.forEach((e) => killEnemy(e)); return "win"; }
      if (m.d.t >= 90) { a.forEach((e) => killEnemy(e)); return "win"; }
    },
    cleanup: (m) => { root.remove(m.d.mesh, m.d.core); const i = G.allies.indexOf(m.d.beacon); if (i >= 0) G.allies.splice(i, 1); G.beaconFocus = false; if (m.d.beacon.dead) fx.explosion(m.d.beacon.pos.clone().add(new V3(0, 3, 0)), 8, 0x66ffcc, 0xffffff); },
  },
  {
    id: "commander", name: "Commander Down", district: "Central Downtown", brief: "An Elite Commander is rallying forces at the east crossroads. Cut off the head of the snake.", pos: new V3(120, 0, -40), xp: 520,
    start: (m) => {
      spawnN(m, "commander", 1, 120, -120, 2, { aggro: false });
      m.d.cmd = m.enemies[0];
      spawnN(m, "criminal", 3, 120, -120, 12);
      spawnN(m, "gunner", 2, 120, -125, 12);
      banner("ELITE COMMANDER", "Strong. Summons reinforcements.", "#ff4060", 2200);
    },
    update: (m) => {
      const c = m.d.cmd;
      const a = alive(m);
      a.forEach((e) => { if (Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z) < 45) e.aggro = true; });
      const guards = G.enemies.filter((e: any) => !e.dead && (e.minion || m.enemies.includes(e)) && e !== c).length;
      m.obj = [c.dead ? "Commander defeated!" : `Defeat the Elite Commander  ${Math.round((c.hp / c.maxHp) * 100)}%`, `Guards remaining  ${guards}`];
      m.focus = c.dead ? centroid(a) : c.pos.clone();
      if (c.dead) { G.enemies.forEach((e: any) => { if (e.minion && !e.dead) killEnemy(e); }); return "win"; }
      if (farAway(m)) return "fail";
    },
  },
  {
    id: "titan", name: "Titan Rampage", district: "Green Park", brief: "TITAN, the Destroyer, is tearing up Green Park. Use the arena — and watch the pillars.", pos: new V3(0, 0, 200), xp: 900, boss: true,
    gate: () => (useGame.getState().missionsDone.length >= 3 ? null : "Complete 3 missions to unlock"),
    start: (m) => {
      for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.28; spawnProp("pillar", Math.cos(a) * 26, 240 + Math.sin(a) * 26); }
      const t = spawnBoss("titan", 0, 255);
      m.enemies.push(t); m.d.boss = t;
      G.hooks.onBossDead = () => {};
    },
    update: (m) => {
      const t = m.d.boss;
      m.obj = [t.dead ? "TITAN has fallen!" : `Defeat TITAN, the Destroyer  ${Math.round((t.hp / t.maxHp) * 100)}%`, "Tip: lure Titan's charge into the pillars to stun him"];
      m.focus = t.pos.clone();
      if (t.dead) return "win";
      if (farAway(m, 150)) return "fail";
    },
    cleanup: () => { later(6, () => clearProps("pillar")); },
  },
  {
    id: "reaper", name: "Void Reaper", district: "Iron Docks", brief: "The Void Reaper stalks the docks. It teleports, clones itself, and cuts through dimensions.", pos: new V3(-40, 0, -200), xp: 1100, boss: true,
    gate: () => (done("titan") ? null : "Defeat Titan first"),
    start: (m) => { const r = spawnBoss("reaper", -80, -250); m.enemies.push(r); m.d.boss = r; },
    update: (m) => {
      const r = m.d.boss;
      m.obj = [r.dead ? "The Void Reaper is destroyed!" : `Defeat the Void Reaper  ${Math.round((r.hp / r.maxHp) * 100)}%`, "Clones die in one hit — the real Reaper never flinches"];
      m.focus = r.pos.clone();
      if (r.dead) return "win";
      if (farAway(m, 150)) return "fail";
    },
  },
  {
    id: "zero", name: "Emperor Zero", district: "The Abyss", brief: "Beneath the city lies the Abyss Gate. Emperor Zero waits below. This is the final battle.", pos: new V3(22, 0, 28), xp: 1800, boss: true,
    gate: () => (done("reaper") ? null : "Defeat the Void Reaper first"),
    start: (m) => {
      const z = spawnBoss("zero", ARENA.x, ARENA.z - 22);
      m.enemies.push(z); m.d.boss = z;
      for (const p of G.allies) if (p.perm) p.pos.set(ARENA.x + rnd(-3, 3), 0, ARENA.z + 40 + rnd(-3, 3));
    },
    update: (m) => {
      const z = m.d.boss;
      m.obj = [z.dead ? "Emperor Zero has fallen!" : `Defeat Emperor Zero  ${Math.round((z.hp / z.maxHp) * 100)}%  (Stage ${z.stage}/3)`, "Pillars block Zero's Genesis Collapse"];
      m.focus = z.pos.clone();
      if (z.dead) return "win";
    },
    cleanup: () => {},
  },
];

/* ---------- zones & events ---------- */
const ZONES = [
  { x: -120, z: 40, spec: [["criminal", 4]] },
  { x: 120, z: 120, spec: [["assassin", 2], ["criminal", 3]] },
  { x: -200, z: 120, spec: [["criminal", 3], ["gunner", 1]] },
  { x: 200, z: -120, spec: [["gunner", 2], ["ninja", 1]] },
  { x: 120, z: -200, spec: [["brute", 1], ["criminal", 3]] },
  { x: -120, z: -120, spec: [["ninja", 2], ["criminal", 2]] },
  { x: 200, z: 200, spec: [["hunter", 2], ["gunner", 1]] },
  { x: -120, z: 200, spec: [["criminal", 3], ["assassin", 1]] },
  { x: 40, z: -120, spec: [["criminal", 3], ["brute", 1]] },
].map((z) => ({ ...z, list: [] as any[], respawn: 0, spawned: false }));
export const zoneMarkers = () => ZONES.filter((z) => z.spawned && z.list.some((e) => !e.dead && !e.removed)).map((z) => ({ x: z.x, z: z.z }));

const markers: { def: MissionDef; beam: THREE.Mesh; ring: THREE.Mesh; mat: THREE.MeshBasicMaterial }[] = [];
export function missionState(def: MissionDef): "done" | "locked" | "available" | "active" {
  if (G.mission?.def === def) return "active";
  if (done(def.id)) return "done";
  if (def.gate?.()) return "locked";
  return "available";
}
export function initMissions(r: THREE.Group) {
  root = r;
  for (const def of MISSIONS) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 70, 12, 1, true), mat);
    beam.position.set(def.pos.x, 35, def.pos.z);
    const ring = new THREE.Mesh(new THREE.RingGeometry(3, 4, 32), mat);
    ring.rotation.x = -Math.PI / 2; ring.position.set(def.pos.x, 0.25, def.pos.z);
    root.add(beam, ring);
    markers.push({ def, beam, ring, mat });
  }
  G.hooks.onRemove = (e: any) => { e.removed = true; };
}
export function startMission(def: MissionDef) {
  if (G.mission) return;
  const m: Mission = { def, t: 0, obj: [], enemies: [], d: {}, focus: null };
  G.mission = m;
  def.start(m);
  banner(def.name.toUpperCase(), def.brief, def.boss ? "#ff4a4a" : "#ffd23f", 3600);
  sfx("level");
  if (!def.boss) setMusicLevel(1);
  m.focus = def.pos.clone();
}
export function endMission(ok: boolean, reason = "") {
  const m: Mission | null = G.mission;
  if (!m) return;
  G.mission = null;
  G.objMarker = null;
  m.def.cleanup?.(m);
  for (const e of m.enemies) {
    if (ok) { if (!e.boss && !e.dead) killEnemy(e); }
    else { fx.burst(e.pos.clone().add(new V3(0, 1, 0)), 0xffffff, 8, 4); removeEnemy(e); }
  }
  if (!ok) { G.boss = null; G.freezeInput = false; G.cam.cine = null; G.darkT = 0; P.invul = 0.5; fx.light(P.pos, 0xffffff, 10, 0.1); }
  setMusicLevel(0);
  if (ok) {
    const st = useGame.getState();
    st.completeMission(m.def.id);
    const lv = st.addXp(m.def.xp);
    useGame.setState((s) => ({ points: s.points + (m.def.boss ? 2 : 1) }));
    sfx("level");
    banner("MISSION COMPLETE", `${m.def.name} · +${m.def.xp} XP · +${m.def.boss ? 2 : 1} upgrade point${m.def.boss ? "s" : ""}`, "#6dff9a", 4200);
    if (lv) toast(`LEVEL UP! Level ${useGame.getState().level}`, "#ffd23f");
    P.victoryT = 3;
    P.hp[P.hero] = Math.min(P.maxHp[P.hero], P.hp[P.hero] + P.maxHp[P.hero] * 0.4);
    P.en[P.hero] = P.maxEn[P.hero];
    if (m.def.id === "zero") later(5, () => banner("HERO CITY IS SAFE", "Thank you for playing — explore freely, collect orbs, extract more shadows!", "#ffd23f", 6000));
  } else banner("MISSION FAILED", reason || m.def.name, "#ff5050", 3600);
}
export function abandonMission() {
  if (G.mission) endMission(false, "Mission abandoned");
}
export function failMission(reason: string) {
  if (G.mission) endMission(false, reason);
}

let zoneT = 0, eventT = 60;
export function updateMissions(dt: number, time: number) {
  // markers
  let prompt = "";
  for (const mk of markers) {
    const st = missionState(mk.def);
    mk.beam.visible = mk.ring.visible = st === "available" || st === "locked";
    mk.mat.color.set(st === "locked" ? 0x667080 : mk.def.boss ? 0xff4a4a : 0xffd23f);
    mk.mat.opacity = st === "locked" ? 0.12 : 0.28 + Math.sin(time * 3) * 0.08;
    mk.ring.scale.setScalar(1 + Math.sin(time * 3) * 0.08);
    const d = Math.hypot(P.pos.x - mk.def.pos.x, P.pos.z - mk.def.pos.z);
    if (d < 5 && P.pos.y < 8 && mk.def.id !== "zero") {
      if (st === "locked") prompt = `LOCKED — ${mk.def.gate!()}`;
      else if (st === "available" && !G.mission && !P.dead) startMission(mk.def);
      else if (st === "available" && G.mission) prompt = "Finish your current mission first";
    }
    if (mk.def.id === "zero" && d < 8 && st === "available") prompt = "Enter the Abyss Gate to face Emperor Zero";
    if (mk.def.id === "zero" && d < 8 && st === "locked") prompt = `LOCKED — ${mk.def.gate!()}`;
  }
  G.prompt = prompt;
  // active mission
  const m: Mission | null = G.mission;
  if (m) {
    m.t += dt;
    if (P.dead) endMission(false, "You were defeated");
    else {
      const r = m.def.update(m, dt);
      G.objMarker = m.focus;
      if (r === "win") endMission(true);
      else if (r === "fail") endMission(false, G.mission?.def.id === "park" ? "The Beacon was destroyed" : "You left the mission area");
    }
  } else G.objMarker = null;
  env.hideLight.intensity = Math.max(0, 1 - Math.hypot(P.pos.x, P.pos.z + 240) / 90) * 60;
  env.arenaLight.intensity = P.pos.x > 600 ? 130 : 0;

  // zones
  zoneT -= dt;
  if (zoneT <= 0 && !G.boss) {
    zoneT = 0.6;
    for (const z of ZONES) {
      const d = Math.hypot(P.pos.x - z.x, P.pos.z - z.z);
      if (z.spawned) {
        z.list = z.list.filter((e) => !e.removed);
        if (z.list.every((e) => e.dead)) { z.spawned = false; z.respawn = time + 150; z.list = []; }
        else if (d > 220) { z.spawned = false; z.respawn = time + 20; }
      } else if (time > z.respawn && d < 85 && d > 35 && G.enemies.length < 22 && P.pos.x < 600 && !G.mission) {
        z.spawned = true;
        z.list = [];
        for (const [type, n] of z.spec as [string, number][]) for (let i = 0; i < n; i++) z.list.push(spawnEnemy(type, z.x + rnd(-12, 12), z.z + rnd(-12, 12), { aggro: false }));
      }
    }
  }
  // random crime events
  eventT -= dt;
  if (eventT <= 0) {
    eventT = rnd(70, 110);
    if (!G.mission && !G.boss && G.enemies.filter((e: any) => !e.dead).length < 8 && P.pos.x < 600 && !P.dead) {
      const a = P.yaw + rnd(-0.8, 0.8), dist = rnd(70, 110);
      const x = Math.max(-260, Math.min(260, P.pos.x + Math.sin(a) * dist)), z = Math.max(-260, Math.min(260, P.pos.z + Math.cos(a) * dist));
      const lines = [-200, -120, -40, 40, 120, 200];
      const sx = lines.reduce((b, l) => (Math.abs(l - x) < Math.abs(b - x) ? l : b), lines[0]);
      const pos = freeSpot(sx, z, 6);
      const list: any[] = [];
      for (let i = 0; i < 3 + Math.floor(Math.random() * 2); i++) { const e = spawnEnemy(pick(["criminal", "criminal", "assassin"]), pos.x + rnd(-5, 5), pos.z + rnd(-5, 5), { aggro: false }); list.push(e); }
      scare(pos, 40);
      toast("Crime in progress nearby — check your minimap!", "#ff9a6a");
      sfx("warn");
    }
  }
}
