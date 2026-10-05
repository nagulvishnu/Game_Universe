import { REGIONS, SPECIES, formAt, type Palette } from './data';
import type { PersonColors } from './art';

export const TILE = 48;
export const MAP_W = 40;
export const MAP_H = 16;

export const T = {
  GROUND: 0, TALL: 1, TREE: 2, WATER: 3, PATH: 4, FLOWER: 5, ROCK: 6,
  ROOF_C: 7, ROOF_M: 8, ROOF_G: 9, WALL: 10, DOOR_C: 11, DOOR_M: 12, DOOR_G: 13, GATE: 14,
} as const;

const SOLID = new Set<number>([T.TREE, T.WATER, T.ROCK, T.ROOF_C, T.ROOF_M, T.ROOF_G, T.WALL, T.GATE]);
export const isSolid = (t: number) => SOLID.has(t);

export const DX = [0, -1, 1, 0];
export const DY = [1, 0, 0, -1];

export function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (x: number, y: number, k: number) => {
  let h = (x * 374761393 + y * 668265263 + k * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

export interface Trainer {
  id: string; x: number; y: number; dir: number; name: string; cls: string;
  team: { sp: string; level: number }[]; prize: number; colors: PersonColors; line: string;
  fx: number; fy: number; alert: number;
}
export interface Pickup { id: string; x: number; y: number; item?: string; money?: number }
export interface Label { text: string; x: number; y: number; w: number }
export interface RegionMap {
  w: number; h: number; tiles: Uint8Array; trainers: Trainer[]; pickups: Pickup[];
  spawn: { x: number; y: number }; labels: Label[];
}

const NAMES = ['Aiden', 'Bella', 'Cato', 'Dara', 'Eli', 'Faye', 'Gus', 'Hana', 'Ivo', 'Juno', 'Kira', 'Leo', 'Mina', 'Nolan', 'Orla', 'Pete', 'Quin', 'Rhea', 'Sol', 'Tess'];
const HATS = ['#e8453c', '#3c7ae8', '#f0b830', '#8a5ae8', '#2fb08a', '#e86aa8', '#444a5a'];
const SHIRTS = ['#f2f2f2', '#ffb347', '#6ad07a', '#5aa8f2', '#e86a8a', '#b58cf0'];
const LINES = ['Our eyes met! Battle time!', 'You look strong. Let us see!', 'My team trained for this!', 'Never walk past me without a fight!', 'Let me test your monsters!'];

export function genRegion(i: number): RegionMap {
  const rnd = mulberry32(9001 + i * 7919);
  const R = REGIONS[i];
  const final = i === 8;
  const tiles = new Uint8Array(MAP_W * MAP_H);
  const set = (x: number, y: number, t: number) => { if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H) tiles[y * MAP_W + x] = t; };
  const get = (x: number, y: number) => (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H ? T.TREE : tiles[y * MAP_W + x]);
  const labels: Label[] = [];

  // borders
  for (let x = 0; x < MAP_W; x++) {
    set(x, 0, T.TREE); set(x, 1, T.TREE); set(x, MAP_H - 1, T.TREE); set(x, MAP_H - 2, T.TREE);
    if (rnd() < 0.5) set(x, 2, T.TREE);
    if (rnd() < 0.5) set(x, MAP_H - 3, T.TREE);
  }
  for (let y = 0; y < MAP_H; y++) { set(0, y, T.TREE); set(MAP_W - 1, y, T.TREE); }

  // town plaza
  for (let y = 6; y <= 9; y++) for (let x = 1; x <= 10; x++) set(x, y, T.PATH);
  const building = (bx: number, by: number, w: number, h: number, roof: number, door: number, doorIdx: number, label: string) => {
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
      let t: number = r < h - 1 ? roof : T.WALL;
      if (r === h - 1 && c === doorIdx) t = door;
      set(bx + c, by + r, t);
    }
    labels.push({ text: label, x: (bx + w / 2) * TILE, y: (by + (h - 1) / 2) * TILE, w: w * TILE });
    set(bx + doorIdx, by + h, T.PATH);
  };
  building(3, 3, 4, 3, T.ROOF_C, T.DOOR_C, 1, 'CENTER');
  building(8, 3, 4, 3, T.ROOF_M, T.DOOR_M, 1, 'MART');
  // gym / arena
  if (final) building(32, 2, 7, 5, T.ROOF_G, T.DOOR_G, 3, 'CHAMPION ARENA');
  else building(34, 3, 5, 4, T.ROOF_G, T.DOOR_G, 2, 'GYM');

  // wild zone
  const inZone = (x: number, y: number) => x >= 11 && x <= 33 && y >= 2 && y <= 13;
  if (!final) {
    for (const wx of [18, 26]) for (let y = 2; y <= 13; y++) {
      if (y >= 7 && y <= 9) continue;
      set(wx, y, T.TREE); set(wx + 1, y, T.TREE);
    }
  }
  // grass blobs
  const blob = (cx: number, cy: number, rx: number, ry: number, t: number, only: number[]) => {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (d <= 1 + (rnd() - 0.5) * 0.4 && only.includes(get(x, y))) set(x, y, t);
    }
  };
  if (!final) {
    blob(13.5, 8, 2.6, 2.8, T.TALL, [T.GROUND]);
    for (let k = 0; k < 9; k++) {
      const cx = 11 + rnd() * 22, cy = 3 + rnd() * 10;
      blob(cx, cy, 1.5 + rnd() * 2, 1.2 + rnd() * 1.8, T.TALL, [T.GROUND]);
    }
    blob(23, 8, 2.2, 3, T.TALL, [T.GROUND]);
    blob(30, 9, 1.6, 2.4, T.TALL, [T.GROUND]);
  }
  // ponds (outside the main corridor)
  for (let k = 0; k < 3; k++) {
    const top = rnd() < 0.5;
    blob(12 + rnd() * 20, top ? 3.5 : 11.5, 1.3 + rnd() * 1.6, 1 + rnd() * 1, T.WATER, [T.GROUND, T.TALL]);
  }
  // scattered trees & flowers
  for (let y = 2; y <= 13; y++) for (let x = 11; x <= 33; x++) {
    if (!inZone(x, y) || get(x, y) !== T.GROUND) continue;
    const band = y >= 7 && y <= 9;
    const r = rnd();
    if (r < (band ? 0.015 : 0.08)) set(x, y, T.TREE);
    else if (r < 0.1) set(x, y, T.ROCK);
    else if (r < 0.2) set(x, y, T.FLOWER);
  }
  for (let y = 2; y <= 13; y++) for (let x = 1; x <= 10; x++) if (get(x, y) === T.GROUND && rnd() < 0.15) set(x, y, rnd() < 0.5 ? T.FLOWER : T.TREE);
  // keep the central corridor passable and the gym approach clear
  for (let x = 1; x <= 38; x++) {
    for (let y = 7; y <= 9; y++) { const t = get(x, y); if (t === T.TREE || t === T.ROCK || t === T.WATER) set(x, y, T.GROUND); }
  }
  if (final) for (let x = 1; x <= 38; x++) set(x, 8, T.PATH);
  // gym approach
  const gx = final ? 35 : 36;
  for (let y = final ? 7 : 7; y <= 9; y++) set(gx, y, T.PATH);
  if (!final) for (let x = 32; x <= 38; x++) set(x, 8, T.PATH);
  for (let y = 6; y <= 9; y++) { set(4, y, T.PATH); set(9, y, T.PATH); }
  // gate
  for (let y = 7; y <= 9; y++) set(MAP_W - 1, y, final ? T.TREE : T.GATE);
  set(MAP_W - 2, 8, T.PATH);
  // clear spawn
  const spawn = i === 0 ? { x: 6, y: 8 } : { x: 2, y: 8 };
  set(spawn.x, spawn.y, T.PATH);

  // trainers
  const trainers: Trainer[] = [];
  if (!final) {
    const base = 3 + i * 5;
    const spots: [number, number, number][] = [[21, 8, 1], [29, 8, 1], [31, 12, 3]];
    if (i >= 3) spots.push([14, 4, 0]);
    if (i >= 5) spots.push([23, 11, 3]);
    spots.forEach(([x, y, dir], k) => {
      if (get(x, y) === T.TREE || get(x, y) === T.WATER || get(x, y) === T.ROCK) set(x, y, T.GROUND);
      const n = Math.min(3, 1 + (rnd() < 0.5 ? 1 : 0) + (i >= 3 ? 1 : 0));
      const team = [];
      let tot = 0;
      for (let m = 0; m < n; m++) {
        const root = R.pool[Math.floor(rnd() * R.pool.length)];
        const level = base + 1 + Math.floor(rnd() * 3) + (m === n - 1 ? 1 : 0);
        team.push({ sp: formAt(root, level), level }); tot += level;
      }
      const cls = R.trainerCls[k % R.trainerCls.length];
      trainers.push({
        id: `${i}:${k}`, x, y, dir, name: `${cls} ${NAMES[Math.floor(rnd() * NAMES.length)]}`, cls, team,
        prize: Math.round((tot / n) * 55 + 60),
        colors: { skin: '#f2c9a0', shirt: SHIRTS[Math.floor(rnd() * SHIRTS.length)], pants: '#3a3f5a', hat: HATS[Math.floor(rnd() * HATS.length)], hair: '#3a2a20' },
        line: LINES[Math.floor(rnd() * LINES.length)], fx: x, fy: y, alert: 0,
      });
    });
  }
  // pickups
  const pickups: Pickup[] = [];
  const free = (x: number, y: number) => { const t = get(x, y); return (t === T.GROUND || t === T.FLOWER) && !trainers.some((tr) => tr.x === x && tr.y === y); };
  const loot = ['potion', 'orb', 'great', 'super', 'revive', 'orb', 'candy'];
  for (let k = 0, tries = 0; k < 5 && tries < 200; tries++) {
    const x = 12 + Math.floor(rnd() * 21), y = 3 + Math.floor(rnd() * 10);
    if (!free(x, y) || (x >= 18 && x <= 19) || (x >= 26 && x <= 27)) continue;
    pickups.push(k % 2 === 0 ? { id: `${i}:p${k}`, x, y, money: 150 + i * 120 } : { id: `${i}:p${k}`, x, y, item: loot[Math.floor(rnd() * loot.length)] });
    k++;
  }
  return { w: MAP_W, h: MAP_H, tiles, trainers, pickups, spawn, labels };
}

// ---------- pre-render ----------
export function renderMap(map: RegionMap, regionIdx: number, gateOpen: boolean): HTMLCanvasElement {
  const pal: Palette = REGIONS[regionIdx].pal;
  const cv = document.createElement('canvas');
  cv.width = map.w * TILE; cv.height = map.h * TILE;
  const c = cv.getContext('2d')!;
  const get = (x: number, y: number) => (x < 0 || y < 0 || x >= map.w || y >= map.h ? -1 : map.tiles[y * map.w + x]);
  const roofCol = (t: number) => (t === T.ROOF_C ? '#e8453c' : t === T.ROOF_M ? '#3c7ae8' : regionIdx === 8 ? '#e8b930' : pal.accent);

  const ground = (x: number, y: number, px: number, py: number) => {
    c.fillStyle = (x + y) % 2 ? pal.ground : pal.ground2; c.fillRect(px, py, TILE, TILE);
    for (let k = 0; k < 4; k++) {
      c.fillStyle = 'rgba(255,255,255,0.12)';
      c.fillRect(px + hash(x, y, k) * 42, py + hash(x, y, k + 9) * 42, 3, 3);
    }
  };
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
    const t = map.tiles[y * map.w + x]; const px = x * TILE, py = y * TILE;
    switch (t) {
      case T.GROUND: ground(x, y, px, py); break;
      case T.FLOWER:
        ground(x, y, px, py);
        for (let k = 0; k < 3; k++) {
          const fx = px + 8 + hash(x, y, k + 20) * 32, fy = py + 10 + hash(x, y, k + 30) * 28;
          c.fillStyle = ['#ffffff', '#ff7aa8', pal.accent][k]; c.beginPath(); c.arc(fx, fy, 3.2, 0, 7); c.fill();
          c.fillStyle = '#ffe066'; c.beginPath(); c.arc(fx, fy, 1.2, 0, 7); c.fill();
        } break;
      case T.PATH:
      case T.GATE:
        c.fillStyle = pal.path; c.fillRect(px, py, TILE, TILE);
        for (let k = 0; k < 6; k++) { c.fillStyle = 'rgba(0,0,0,0.07)'; c.fillRect(px + hash(x, y, k) * 42, py + hash(x, y, k + 5) * 42, 4, 3); }
        c.fillStyle = 'rgba(0,0,0,0.05)'; c.fillRect(px, py + TILE - 2, TILE, 2);
        if (t === T.GATE && !gateOpen) {
          c.fillStyle = '#23233a'; c.fillRect(px + 4, py, 8, TILE); c.fillRect(px + TILE - 12, py, 8, TILE);
          for (let k = 0; k < 4; k++) { c.fillStyle = k % 2 ? '#fff' : '#e8453c'; c.fillRect(px + 4, py + 8 + k * 9, TILE - 8, 8); }
          c.strokeStyle = '#23233a'; c.lineWidth = 2; c.strokeRect(px + 4, py + 8, TILE - 8, 36);
        }
        break;
      case T.TALL:
        ground(x, y, px, py); c.fillStyle = pal.tall; c.fillRect(px, py, TILE, TILE);
        for (let k = 0; k < 9; k++) {
          const bx = px + 3 + hash(x, y, k) * 42, by = py + 12 + hash(x, y, k + 40) * 34;
          c.strokeStyle = k % 2 ? pal.tall2 : mixHex(pal.tall, '#ffffff', 0.25); c.lineWidth = 2.5; c.lineCap = 'round';
          c.beginPath(); c.moveTo(bx, by); c.lineTo(bx - 3, by - 11); c.moveTo(bx, by); c.lineTo(bx + 1, by - 14); c.moveTo(bx, by); c.lineTo(bx + 4, by - 10); c.stroke();
        } break;
      case T.TREE:
        ground(x, y, px, py);
        c.fillStyle = pal.trunk; c.fillRect(px + 19, py + 28, 10, 18);
        c.fillStyle = 'rgba(0,0,0,0.18)'; c.beginPath(); c.ellipse(px + 24, py + 45, 17, 5, 0, 0, 7); c.fill();
        c.fillStyle = pal.tree; c.strokeStyle = '#14281c'; c.lineWidth = 2;
        c.beginPath(); c.arc(px + 24, py + 22, 21, 0, 7); c.fill(); c.stroke();
        c.fillStyle = pal.tree2; c.beginPath(); c.arc(px + 19, py + 16, 11, 0, 7); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.15)'; c.beginPath(); c.arc(px + 16, py + 12, 5, 0, 7); c.fill();
        break;
      case T.ROCK:
        ground(x, y, px, py);
        c.fillStyle = 'rgba(0,0,0,0.18)'; c.beginPath(); c.ellipse(px + 24, py + 40, 18, 5, 0, 0, 7); c.fill();
        c.fillStyle = '#8e8a82'; c.strokeStyle = '#2a2a2a'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(px + 6, py + 40); c.lineTo(px + 9, py + 20); c.lineTo(px + 24, py + 10); c.lineTo(px + 40, py + 22); c.lineTo(px + 42, py + 40); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = '#b8b4aa'; c.beginPath(); c.moveTo(px + 11, py + 22); c.lineTo(px + 24, py + 13); c.lineTo(px + 30, py + 22); c.lineTo(px + 18, py + 30); c.closePath(); c.fill();
        break;
      case T.WATER:
        c.fillStyle = pal.water; c.fillRect(px, py, TILE, TILE);
        c.strokeStyle = pal.water2; c.lineWidth = 2;
        for (let k = 0; k < 3; k++) {
          const wy = py + 10 + k * 15 + hash(x, y, k) * 4, wx = px + hash(x, y, k + 3) * 12;
          c.beginPath(); c.moveTo(wx, wy); c.quadraticCurveTo(wx + 6, wy - 4, wx + 12, wy); c.quadraticCurveTo(wx + 18, wy + 4, wx + 24, wy); c.stroke();
        }
        if (get(x, y - 1) !== T.WATER) { c.fillStyle = 'rgba(0,0,0,0.15)'; c.fillRect(px, py, TILE, 4); }
        break;
      case T.ROOF_C: case T.ROOF_M: case T.ROOF_G: {
        const col = roofCol(t);
        c.fillStyle = col; c.fillRect(px, py, TILE, TILE);
        for (let k = 0; k < 4; k++) { c.fillStyle = k % 2 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)'; c.fillRect(px, py + k * 12, TILE, 6); }
        c.strokeStyle = '#1d1a33'; c.lineWidth = 3;
        if (get(x - 1, y) !== t) { c.beginPath(); c.moveTo(px + 1.5, py); c.lineTo(px + 1.5, py + TILE); c.stroke(); }
        if (get(x + 1, y) !== t) { c.beginPath(); c.moveTo(px + TILE - 1.5, py); c.lineTo(px + TILE - 1.5, py + TILE); c.stroke(); }
        if (get(x, y - 1) !== t) { c.beginPath(); c.moveTo(px, py + 1.5); c.lineTo(px + TILE, py + 1.5); c.stroke(); }
        if (get(x, y + 1) !== t) { c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(px, py + TILE - 8, TILE, 8); }
        break;
      }
      case T.WALL: case T.DOOR_C: case T.DOOR_M: case T.DOOR_G: {
        c.fillStyle = '#f4ecd8'; c.fillRect(px, py, TILE, TILE);
        c.fillStyle = 'rgba(0,0,0,0.06)'; for (let k = 0; k < 4; k++) c.fillRect(px, py + k * 12, TILE, 1);
        c.strokeStyle = '#1d1a33'; c.lineWidth = 3;
        if (get(x - 1, y) !== T.WALL && get(x - 1, y) < T.DOOR_C) { c.beginPath(); c.moveTo(px + 1.5, py); c.lineTo(px + 1.5, py + TILE); c.stroke(); }
        if (get(x + 1, y) !== T.WALL && get(x + 1, y) < T.DOOR_C) { c.beginPath(); c.moveTo(px + TILE - 1.5, py); c.lineTo(px + TILE - 1.5, py + TILE); c.stroke(); }
        c.beginPath(); c.moveTo(px, py + TILE - 1.5); c.lineTo(px + TILE, py + TILE - 1.5); c.stroke();
        if (t === T.WALL) {
          if (hash(x, y, 77) < 0.7) { c.fillStyle = '#9fd8ff'; c.fillRect(px + 12, py + 10, 24, 18); c.strokeStyle = '#1d1a33'; c.lineWidth = 2; c.strokeRect(px + 12, py + 10, 24, 18); c.beginPath(); c.moveTo(px + 24, py + 10); c.lineTo(px + 24, py + 28); c.stroke(); }
        } else {
          const dc = t === T.DOOR_C ? '#e8453c' : t === T.DOOR_M ? '#3c7ae8' : '#f0b830';
          c.fillStyle = dc; c.beginPath(); c.roundRect(px + 7, py + 2, 34, 44, [12, 12, 0, 0]); c.fill(); c.strokeStyle = '#1d1a33'; c.lineWidth = 2.5; c.stroke();
          c.fillStyle = '#fff'; c.font = 'bold 22px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle';
          c.fillText(t === T.DOOR_C ? '+' : t === T.DOOR_M ? '$' : '★', px + 24, py + 24);
        }
        break;
      }
    }
  }
  // labels
  for (const l of map.labels) {
    c.font = '800 15px "Press Start 2P", system-ui, monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 5; c.strokeStyle = '#1d1a33'; c.strokeText(l.text, l.x, l.y);
    c.fillStyle = '#fff'; c.fillText(l.text, l.x, l.y);
  }
  void SPECIES;
  return cv;
}

function mixHex(a: string, b: string, t: number) {
  const p = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const A = p(a), B = p(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`;
}
