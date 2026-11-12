// Living city: citizens (walk, chat, flee, shelter), hunters (patrol, engage monsters), talkable story NPCs.
import * as THREE from 'three';
import type { Enemy, Game } from './game';
import { disposeObj, makeLabel, makeNPC, newPose, pose, type PoseState, type Rig } from './models';
import { walkable } from './world';
import { hitEnemy } from './enemies';
import { useGame } from './store';

export interface NPC {
  id: string;
  name: string;
  rig: Rig;
  ps: PoseState;
  pos: THREE.Vector3;
  yaw: number;
  kind: 'citizen' | 'hunter' | 'talk';
  speed: number;
  dest: [number, number] | null;
  wait: number;
  fleeing: boolean;
  hidden: boolean;
  hideT: number;
  swing: number;
  atkCd: number;
  home: [number, number];
  label?: THREE.Mesh;
  engage?: Enemy | null;
  shelter?: [number, number];
  ptIdx: number;
  calm: number;
  dir: number;
}
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const SKIN = [0xf2d2b6, 0xe8c4a0, 0xd9b08c, 0xf5dcc4];
const HAIR = [0x0a0a0e, 0x2a1a10, 0x4a3020, 0x1a1a22, 0x6a4a2a, 0x8a8a92];
const TOPS = [0x8a4a4a, 0x4a6a8a, 0x5a7a4a, 0x7a6a3a, 0x4a4a6a, 0xbfbfc8, 0x2a2a34, 0xa0507a];
const PANTS = [0x23283a, 0x333844, 0x3a3226, 0x1c1c24];
const HUNTER_NAMES = [
  'Hunter Park',
  'Hunter Min-Jun',
  'Hunter Seo-Yeon',
  'Hunter Dae-Ho',
  'Hunter Ji-Hoon',
  'Hunter Ha-Rin',
  'Hunter Tae-Sung',
  'Hunter Soo-Ah',
];

function add(g: Game, n: NPC) {
  g.npcs.push(n);
  g.scene.add(n.rig.root);
  if (n.label) g.scene.add(n.label);
  return n;
}
export function clearNPCs(g: Game) {
  g.npcs.forEach((n) => {
    g.scene.remove(n.rig.root);
    if (n.label) {
      g.scene.remove(n.label);
      disposeObj(n.label);
    }
  });
  g.npcs = [];
}

export function spawnCitizens(g: Game, density: number) {
  const z = g.zone;
  if (!z.walkPts.length) return;
  for (let i = 0; i < density; i++) {
    const hunter = i % 4 === 0;
    const p = pick(z.walkPts);
    const rig = hunter
      ? makeNPC({
          skin: pick(SKIN),
          hair: pick(HAIR),
          hs: pick(['short', 'spiky', 'long']),
          top: pick([0x2a3a5a, 0x3a2a2a, 0x2a4a3a]),
          pants: 0x1c1c24,
          weapon: pick(['steel', 'rusty', 'killer']),
          wtype: 'sword',
          cape: Math.random() < 0.3 ? 0x6a1a1a : undefined,
          b: 1.1,
        })
      : makeNPC({
          skin: pick(SKIN),
          hair: pick(HAIR),
          hs: pick(['short', 'long', 'bun', 'short']),
          top: pick(TOPS),
          pants: pick(PANTS),
          coat: Math.random() < 0.3 ? pick(TOPS) : undefined,
          scale: rnd(0.94, 1.04),
        });
    const n: NPC = {
      id: 'c' + i,
      name: hunter ? HUNTER_NAMES[i % HUNTER_NAMES.length] : 'Citizen',
      rig,
      ps: newPose(),
      pos: new THREE.Vector3(p[0] + rnd(-1, 1), 0, p[1] + rnd(-1, 1)),
      yaw: rnd(0, 6),
      kind: hunter ? 'hunter' : 'citizen',
      speed: rnd(1.4, 2.2),
      dest: null,
      wait: rnd(0, 3),
      fleeing: false,
      hidden: false,
      hideT: 0,
      swing: -1,
      atkCd: 0,
      home: [-30, -28],
      ptIdx: 0,
      calm: 0,
      dir: 0,
    };
    if (hunter) {
      n.label = makeLabel(n.name, { w: 2.4, h: 0.6, color: '#ffd24a', sub: 'Hunter', font: 52 });
      n.label.scale.setScalar(0.8);
    }
    rig.root.position.copy(n.pos);
    add(g, n);
  }
}
export function addTalkNPC(
  g: Game,
  o: {
    id: string;
    name: string;
    sub?: string;
    x: number;
    z: number;
    yaw?: number;
    look: Parameters<typeof makeNPC>[0];
    color?: string;
    onTalk: () => void;
    r?: number;
    cond?: () => boolean;
  }
) {
  const rig = makeNPC(o.look);
  const n: NPC = {
    id: o.id,
    name: o.name,
    rig,
    ps: newPose(),
    pos: new THREE.Vector3(o.x, 0, o.z),
    yaw: o.yaw ?? 0,
    kind: 'talk',
    speed: 0,
    dest: null,
    wait: 0,
    fleeing: false,
    hidden: false,
    hideT: 0,
    swing: -1,
    atkCd: 0,
    home: [o.x, o.z],
    ptIdx: 0,
    calm: 0,
    dir: o.yaw ?? 0,
  };
  n.label = makeLabel(o.name, { w: 3, h: 0.75, color: o.color || '#7ad0ff', sub: o.sub, font: 54 });
  rig.root.position.copy(n.pos);
  rig.root.rotation.y = n.yaw;
  add(g, n);
  g.interacts.push({
    id: 'talk_' + o.id,
    x: o.x,
    z: o.z,
    r: o.r ?? 3.2,
    label: () => (o.cond && !o.cond() ? null : `[E] Talk: ${o.name}`),
    act: () => {
      n.dir = Math.atan2(g.P.pos.x - n.pos.x, g.P.pos.z - n.pos.z);
      o.onTalk();
    },
  });
  return n;
}
function nextPoint(g: Game, n: NPC) {
  const pts = g.zone.walkPts;
  const [cx, cz] = [n.pos.x, n.pos.z];
  const cand: [number, number][] = [];
  for (const p of pts) {
    const dx = Math.abs(p[0] - cx),
      dz = Math.abs(p[1] - cz);
    if ((dx < 3 && dz > 3 && dz < 72) || (dz < 3 && dx > 3 && dx < 72)) cand.push(p);
  }
  const p = cand.length ? pick(cand) : pick(pts);
  n.dest = [p[0] + rnd(-0.8, 0.8), p[1] + rnd(-0.8, 0.8)];
}
function enemyNear(g: Game, n: NPC, r: number): Enemy | null {
  let b: Enemy | null = null,
    bd = r;
  for (const e of g.enemies) {
    if (e.dead || e.state === 'rise') continue;
    const d = Math.hypot(e.pos.x - n.pos.x, e.pos.z - n.pos.z);
    if (d < bd) {
      bd = d;
      b = e;
    }
  }
  return b;
}

export function updateNPCs(g: Game, dt: number) {
  const P = g.P;
  const draw = useGame.getState().settings.draw * 0.55;
  for (const n of g.npcs) {
    const ps = n.ps;
    ps.t = g.t;
    const d2p = Math.hypot(n.pos.x - P.pos.x, n.pos.z - P.pos.z);
    if (n.label) {
      n.label.visible = !n.hidden && d2p < 22;
      n.label.position.set(n.pos.x, n.rig.height + 0.7, n.pos.z);
      n.label.lookAt(g.camera.position);
    }
    if (n.kind === 'talk') {
      n.rig.root.visible = d2p < draw;
      if (d2p < 7) {
        const want = Math.atan2(P.pos.x - n.pos.x, P.pos.z - n.pos.z);
        let df = want - n.yaw;
        while (df > Math.PI) df -= 6.28;
        while (df < -Math.PI) df += 6.28;
        n.yaw += df * Math.min(1, dt * 3);
      }
      n.rig.root.rotation.y = n.yaw;
      ps.move = 0;
      if (d2p < draw) pose(n.rig, ps);
      continue;
    }
    if (n.hidden) {
      n.hideT += dt;
      n.rig.root.visible = false;
      if (n.hideT > 6 && !enemyNear(g, n, 45)) {
        n.hidden = false;
        n.fleeing = false;
        n.rig.root.visible = true;
      }
      continue;
    }
    if (d2p > draw * 1.4 && !n.fleeing && !(n.engage && !n.engage.dead)) {
      n.rig.root.visible = false;
      continue;
    }
    n.rig.root.visible = d2p < draw;
    const threat = enemyNear(g, n, n.kind === 'hunter' ? 28 : 20);
    let vx = 0,
      vz = 0,
      speed = n.speed;
    if (n.kind === 'hunter' && threat) {
      n.engage = threat;
      const dx = threat.pos.x - n.pos.x,
        dz = threat.pos.z - n.pos.z;
      const d = Math.hypot(dx, dz);
      n.yaw = Math.atan2(dx, dz);
      n.fleeing = false;
      if (d > 2.4) {
        vx = (dx / d) * 6;
        vz = (dz / d) * 6;
        speed = 6;
      } else if (n.atkCd <= 0) {
        n.swing = 0;
        n.atkCd = 1.1;
      }
      if (n.swing >= 0) {
        n.swing += dt * 3;
        ps.atk = Math.min(1, n.swing);
        ps.kind = 'slash1';
        if (n.swing > 0.5 && n.swing - dt * 3 <= 0.5)
          hitEnemy(g, threat, 14 + g.derived.atk * 0.2, {
            knock: 1,
            dir: new THREE.Vector3(dx, 0, dz).normalize(),
            color: '#ffe08a',
          });
        if (n.swing >= 1) {
          n.swing = -1;
          ps.atk = -1;
        }
      }
    } else if (n.kind === 'citizen' && threat) {
      n.fleeing = true;
      n.calm = 0;
      if (!n.shelter) {
        let best: any = null,
          bd = 1e9;
        for (const b of g.zone.boxes) {
          if (b.hw > 25 || b.hw < 2) continue;
          const d = Math.hypot(b.x - n.pos.x, b.z - n.pos.z);
          if (d < bd) {
            bd = d;
            best = b;
          }
        }
        if (best) n.shelter = [best.x, best.z + (best.hd + 1.5) * (n.pos.z > best.z ? 1 : -1)];
      }
      const tx = n.shelter ? n.shelter[0] : n.pos.x + (n.pos.x - threat.pos.x),
        tz = n.shelter ? n.shelter[1] : n.pos.z + (n.pos.z - threat.pos.z);
      const dx = tx - n.pos.x,
        dz = tz - n.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      vx = (dx / d) * 6;
      vz = (dz / d) * 6;
      speed = 6;
      n.yaw = Math.atan2(dx, dz);
      if (d < 2.5 || Math.hypot(threat.pos.x - n.pos.x, threat.pos.z - n.pos.z) < 3) {
        if (d < 4.5) {
          n.hidden = true;
          n.hideT = 0;
          n.shelter = undefined;
        }
      }
    } else {
      if (n.fleeing) {
        n.calm += dt;
        if (n.calm > 3) {
          n.fleeing = false;
          n.shelter = undefined;
        }
      }
      n.wait -= dt;
      if (n.wait > 0) {
        speed = 0;
        if (n.kind === 'citizen') {
          const o = g.npcs.find(
            (q) => q !== n && q.kind === 'citizen' && !q.hidden && Math.hypot(q.pos.x - n.pos.x, q.pos.z - n.pos.z) < 3
          );
          if (o) n.yaw = Math.atan2(o.pos.x - n.pos.x, o.pos.z - n.pos.z);
        }
      } else {
        if (!n.dest || Math.hypot(n.dest[0] - n.pos.x, n.dest[1] - n.pos.z) < 0.8) {
          if (n.dest && Math.random() < 0.5) n.wait = rnd(2, 6);
          nextPoint(g, n);
        }
        if (n.dest) {
          const dx = n.dest[0] - n.pos.x,
            dz = n.dest[1] - n.pos.z;
          const d = Math.hypot(dx, dz) || 1;
          vx = (dx / d) * speed;
          vz = (dz / d) * speed;
          n.yaw = Math.atan2(dx, dz);
        }
      }
    }
    if (Math.abs(vx) + Math.abs(vz) > 0.01) {
      const nx = n.pos.x + vx * dt,
        nz = n.pos.z + vz * dt;
      if (walkable(g.zone, nx, nz, 0.4)) {
        n.pos.x = nx;
        n.pos.z = nz;
      } else {
        n.dest = null;
        n.wait = 0.2;
      }
    }
    ps.move = Math.min(1.4, Math.hypot(vx, vz) / 4.5);
    ps.phase += dt * (4 + Math.hypot(vx, vz) * 1.4);
    if (!(n.swing >= 0)) ps.atk = -1;
    n.atkCd -= dt;
    n.rig.root.position.copy(n.pos);
    n.rig.root.rotation.y = n.yaw;
    if (d2p < draw) pose(n.rig, ps);
  }
}
