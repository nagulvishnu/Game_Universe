// Pure data + geometry helpers for the house (NO three.js here so it can be verified in Node).
// Coordinates: x = east, z = south, y = up. Units are meters.

export type Floor = 0 | 1;

export const WALL_T = 0.2;
export const WALL_H = 3.0;
export const FLOOR_Y: [number, number] = [0, 3.2];
export const HOUSE_W = 20;
export const HOUSE_D = 16;
export const HALL_N = 7;
export const HALL_S = 10.8;

export const STAIR = { x1: 10, x2: 15, z1: 7, z2: 9, steps: 18 };
export const STAIR_RISE = 3.2;

export type LockKind = 'brass' | 'silver';

export interface Opening {
  kind: 'door' | 'arch' | 'window' | 'front';
  pos: number;
  width: number;
  bottom: number;
  top: number;
  doorId?: string;
}

export interface WallDef {
  floor: Floor;
  axis: 'x' | 'z'; // 'x' = runs along x at z = fixed ; 'z' = runs along z at x = fixed
  fixed: number;
  from: number;
  to: number;
  openings: Opening[];
  kind: 'exterior' | 'interior' | 'stair';
}

export interface DoorDef {
  id: string;
  name: string;
  floor: Floor;
  axis: 'x' | 'z';
  fixed: number;
  pos: number;
  width: number;
  hinge: 1 | -1;
  lock: LockKind | null;
  front?: boolean;
}

export interface RoomDef {
  id: string;
  name: string;
  floor: Floor;
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  floorMat: string;
  wallMat: string;
}

export interface Collider {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  floor: Floor;
  sight: boolean;
  door?: string;
}

export interface WallPiece {
  floor: Floor;
  axis: 'x' | 'z';
  fixed: number;
  a: number;
  b: number;
  y0: number;
  y1: number;
  kind: 'solid' | 'sill' | 'lintel' | 'glass';
  wallKind: WallDef['kind'];
}

// ---------------------------------------------------------------- rooms
export const ROOMS: RoomDef[] = [
  { id: 'living', name: 'Living Room', floor: 0, x1: 0, z1: 0, x2: 8, z2: 7, floorMat: 'wood_dark', wallMat: 'wp_green' },
  { id: 'kitchen', name: 'Kitchen', floor: 0, x1: 8, z1: 0, x2: 15, z2: 7, floorMat: 'tile_kitchen', wallMat: 'wp_beige' },
  { id: 'pantry', name: 'Pantry', floor: 0, x1: 15, z1: 0, x2: 20, z2: 7, floorMat: 'concrete', wallMat: 'plaster' },
  { id: 'hallG', name: 'Ground Hall', floor: 0, x1: 0, z1: 7, x2: 20, z2: HALL_S, floorMat: 'wood_dark', wallMat: 'wp_hall' },
  { id: 'dining', name: 'Dining Room', floor: 0, x1: 0, z1: HALL_S, x2: 7, z2: 16, floorMat: 'carpet_red', wallMat: 'wp_red' },
  { id: 'foyer', name: 'Foyer', floor: 0, x1: 7, z1: HALL_S, x2: 13, z2: 16, floorMat: 'tile_checker', wallMat: 'wp_hall' },
  { id: 'study', name: 'Study', floor: 0, x1: 13, z1: HALL_S, x2: 20, z2: 16, floorMat: 'wood_light', wallMat: 'wood_panel' },

  { id: 'bedA', name: 'Bedroom', floor: 1, x1: 0, z1: 0, x2: 7, z2: 7, floorMat: 'carpet_green', wallMat: 'wp_blue' },
  { id: 'bath', name: 'Bathroom', floor: 1, x1: 7, z1: 0, x2: 12, z2: 7, floorMat: 'tile_bath', wallMat: 'tile_wall' },
  { id: 'nursery', name: 'Nursery', floor: 1, x1: 12, z1: 0, x2: 20, z2: 7, floorMat: 'carpet_cream', wallMat: 'wp_pink' },
  { id: 'hallU', name: 'Upper Hall', floor: 1, x1: 0, z1: 7, x2: 20, z2: HALL_S, floorMat: 'wood_dark', wallMat: 'wp_hall' },
  { id: 'sewing', name: 'Sewing Room', floor: 1, x1: 0, z1: HALL_S, x2: 8, z2: 16, floorMat: 'wood_light', wallMat: 'wp_beige' },
  { id: 'storage', name: 'Storage', floor: 1, x1: 8, z1: HALL_S, x2: 13, z2: 16, floorMat: 'wood_old', wallMat: 'plaster' },
  { id: 'master', name: 'Master Bedroom', floor: 1, x1: 13, z1: HALL_S, x2: 20, z2: 16, floorMat: 'carpet_red', wallMat: 'wp_purple' },
];

export function roomAt(x: number, z: number, floor: Floor): RoomDef | null {
  for (const r of ROOMS) {
    if (r.floor === floor && x >= r.x1 && x < r.x2 && z >= r.z1 && z < r.z2) return r;
  }
  return null;
}

// ---------------------------------------------------------------- walls + doors
export const WALLS: WallDef[] = [];
export const DOORS: DoorDef[] = [];

function door(
  id: string,
  name: string,
  floor: Floor,
  axis: 'x' | 'z',
  fixed: number,
  pos: number,
  hinge: 1 | -1 = 1,
  lock: LockKind | null = null,
  width = 1.1,
): Opening {
  DOORS.push({ id, name, floor, axis, fixed, pos, width, hinge, lock });
  return { kind: 'door', pos, width, bottom: 0, top: 2.15, doorId: id };
}
function arch(pos: number, width: number): Opening {
  return { kind: 'arch', pos, width, bottom: 0, top: 2.45 };
}
function win(pos: number, width = 1.2): Opening {
  return { kind: 'window', pos, width, bottom: 0.95, top: 2.3 };
}
function wall(
  floor: Floor,
  axis: 'x' | 'z',
  fixed: number,
  from: number,
  to: number,
  openings: Opening[] = [],
  kind: WallDef['kind'] = 'interior',
) {
  WALLS.push({ floor, axis, fixed, from, to, openings, kind });
}

// ---- ground floor
wall(0, 'x', 0, 0, 20, [win(2.0), win(11.5)], 'exterior');
wall(
  0,
  'x',
  16,
  0,
  20,
  [win(4.8), { kind: 'front', pos: 10, width: 1.6, bottom: 0, top: 2.3, doorId: 'front' }, win(16.5)],
  'exterior',
);
DOORS.push({ id: 'front', name: 'Front Door', floor: 0, axis: 'x', fixed: 16, pos: 10, width: 1.6, hinge: 1, lock: null, front: true });
wall(0, 'z', 0, 0, 16, [win(6.0), win(14.0), win(8.9)], 'exterior');
wall(0, 'z', 20, 0, 16, [win(3.0), win(8.9), win(13.4)], 'exterior');

wall(0, 'x', HALL_N, 0, 20, [
  door('g_living', 'Living Room', 0, 'x', HALL_N, 3.5, 1),
  door('g_kitchen', 'Kitchen', 0, 'x', HALL_N, 9.0, -1),
  door('g_pantry', 'Pantry', 0, 'x', HALL_N, 17.5, 1),
]);
wall(0, 'x', HALL_S, 0, 20, [door('g_dining', 'Dining Room', 0, 'x', HALL_S, 3.5, -1), arch(10, 3)]);
wall(0, 'z', 8, 0, 7, [door('g_living_kitchen', 'Kitchen', 0, 'z', 8, 3.0, 1)]);
wall(0, 'z', 15, 0, 7, [door('g_kitchen_pantry', 'Pantry', 0, 'z', 15, 3.0, -1)]);
wall(0, 'z', 7, HALL_S, 16, [door('g_dining_foyer', 'Foyer', 0, 'z', 7, 13.4, 1)]);
wall(0, 'z', 13, HALL_S, 16, [door('g_study', 'Study', 0, 'z', 13, 13.4, 1, 'brass')]);
wall(0, 'x', STAIR.z2, STAIR.x1, STAIR.x2, [], 'stair');

// ---- upper floor
wall(1, 'x', 0, 0, 20, [win(5.0), win(9.5), win(15.5)], 'exterior');
wall(1, 'x', 16, 0, 20, [win(2.0), win(11.0), win(16.0)], 'exterior');
wall(1, 'z', 0, 0, 16, [win(5.5), win(8.9), win(13.0)], 'exterior');
wall(1, 'z', 20, 0, 16, [win(2.5), win(8.9), win(11.8)], 'exterior');

wall(1, 'x', HALL_N, 0, 20, [
  door('u_bedA', 'Bedroom', 1, 'x', HALL_N, 3.5, 1),
  door('u_bath', 'Bathroom', 1, 'x', HALL_N, 8.5, -1),
  door('u_nursery', 'Nursery', 1, 'x', HALL_N, 17.0, 1),
]);
wall(1, 'x', HALL_S, 0, 20, [
  door('u_sewing', 'Sewing Room', 1, 'x', HALL_S, 3.5, 1),
  door('u_storage', 'Storage', 1, 'x', HALL_S, 10.5, -1),
  door('u_master', 'Master Bedroom', 1, 'x', HALL_S, 17.0, 1, 'silver'),
]);
wall(1, 'z', 7, 0, 7, [door('u_bedA_bath', 'Bathroom', 1, 'z', 7, 3.5, 1)]);
wall(1, 'z', 12, 0, 7, [door('u_bath_nursery', 'Nursery', 1, 'z', 12, 3.5, -1)]);
wall(1, 'z', 8, HALL_S, 16, [door('u_sewing_storage', 'Storage', 1, 'z', 8, 13.4, 1)]);
wall(1, 'z', 13, HALL_S, 16, []);
wall(1, 'x', STAIR.z2, STAIR.x1, STAIR.x2, [], 'stair'); // railing along the stair hole
wall(1, 'z', STAIR.x1, STAIR.z1, STAIR.z2, [], 'stair'); // railing on the west side of the hole

// ---------------------------------------------------------------- wall pieces
export function wallPieces(w: WallDef): WallPiece[] {
  const out: WallPiece[] = [];
  const ext = WALL_T / 2;
  let cursor = w.from - ext;
  const ops = [...w.openings].sort((p, q) => p.pos - q.pos);
  const mk = (a: number, b: number, y0: number, y1: number, kind: WallPiece['kind']) =>
    out.push({ floor: w.floor, axis: w.axis, fixed: w.fixed, a, b, y0, y1, kind, wallKind: w.kind });
  for (const o of ops) {
    const lo = o.pos - o.width / 2;
    const hi = o.pos + o.width / 2;
    if (lo > cursor) mk(cursor, lo, 0, WALL_H, 'solid');
    if (o.bottom > 0) mk(lo, hi, 0, o.bottom, 'sill');
    if (o.top < WALL_H) mk(lo, hi, o.top, WALL_H, 'lintel');
    if (o.kind === 'window') mk(lo, hi, o.bottom, o.top, 'glass');
    cursor = hi;
  }
  if (w.to + ext > cursor) mk(cursor, w.to + ext, 0, WALL_H, 'solid');
  return out;
}

// ---------------------------------------------------------------- furniture
export type FKind =
  | 'sofa' | 'armchair' | 'coffee_table' | 'fireplace' | 'bookshelf' | 'piano' | 'clock'
  | 'counter' | 'stove' | 'fridge' | 'table' | 'chair' | 'wardrobe' | 'shelf' | 'crate'
  | 'barrel' | 'chest' | 'side_table' | 'console' | 'coat_rack' | 'bed' | 'bed_double'
  | 'nightstand' | 'dresser' | 'rocking_chair' | 'bathtub' | 'toilet' | 'basin' | 'crib'
  | 'toy_chest' | 'rocking_horse' | 'desk' | 'office_chair' | 'filing' | 'sewing_table'
  | 'mannequin' | 'dining_table' | 'rug';

export const FOOT: Record<FKind, [number, number, number]> = {
  sofa: [2.2, 0.95, 0.9],
  armchair: [0.95, 0.95, 0.9],
  coffee_table: [1.2, 0.6, 0.45],
  fireplace: [1.8, 0.6, 1.3],
  bookshelf: [1.6, 0.4, 2.1],
  piano: [1.5, 0.6, 1.2],
  clock: [0.5, 0.35, 2.0],
  counter: [2.0, 0.65, 0.92],
  stove: [0.8, 0.7, 0.95],
  fridge: [0.8, 0.75, 1.9],
  table: [1.6, 0.9, 0.76],
  chair: [0.45, 0.45, 0.9],
  wardrobe: [1.2, 0.65, 2.1],
  shelf: [1.8, 0.4, 1.9],
  crate: [0.6, 0.6, 0.6],
  barrel: [0.6, 0.6, 0.9],
  chest: [0.9, 0.5, 0.6],
  side_table: [0.5, 0.4, 0.75],
  console: [1.2, 0.4, 0.82],
  coat_rack: [0.4, 0.4, 1.8],
  bed: [1.0, 2.1, 0.55],
  bed_double: [1.6, 2.1, 0.7],
  nightstand: [0.5, 0.4, 0.55],
  dresser: [1.3, 0.5, 0.95],
  rocking_chair: [0.6, 0.9, 0.95],
  bathtub: [1.7, 0.75, 0.6],
  toilet: [0.45, 0.7, 0.8],
  basin: [0.6, 0.45, 0.9],
  crib: [0.7, 1.3, 1.0],
  toy_chest: [0.8, 0.45, 0.5],
  rocking_horse: [0.35, 0.9, 0.8],
  desk: [1.5, 0.75, 0.78],
  office_chair: [0.55, 0.55, 1.0],
  filing: [0.5, 0.6, 1.3],
  sewing_table: [1.2, 0.6, 0.8],
  mannequin: [0.5, 0.5, 1.7],
  dining_table: [2.2, 1.0, 0.76],
  rug: [3.0, 2.0, 0.02],
};

export interface FurnitureDef {
  kind: FKind;
  x: number;
  z: number;
  rot: number;
  floor: Floor;
  w: number;
  d: number;
  h: number;
  collide: boolean;
  hide?: 'wardrobe' | 'bed';
  id?: string;
}

export const FURNITURE: FurnitureDef[] = [];
type FOpts = { w?: number; d?: number; h?: number; hide?: 'wardrobe' | 'bed'; id?: string; collide?: boolean };

function put(kind: FKind, x: number, z: number, rot: number, floor: Floor, o: FOpts = {}) {
  const f = FOOT[kind];
  FURNITURE.push({
    kind,
    x,
    z,
    rot,
    floor,
    w: o.w ?? f[0],
    d: o.d ?? f[1],
    h: o.h ?? f[2],
    collide: o.collide ?? (kind !== 'rug'),
    hide: o.hide,
    id: o.id,
  });
}
const depthOf = (kind: FKind, o: FOpts) => o.d ?? FOOT[kind][1];
// furniture standing on the +z side of a wall at z = wallZ, facing south
function atN(kind: FKind, x: number, wallZ: number, floor: Floor, o: FOpts = {}) {
  put(kind, x, wallZ + 0.1 + depthOf(kind, o) / 2 + 0.01, 0, floor, o);
}
// furniture standing on the -z side of a wall at z = wallZ, facing north
function atS(kind: FKind, x: number, wallZ: number, floor: Floor, o: FOpts = {}) {
  put(kind, x, wallZ - 0.1 - depthOf(kind, o) / 2 - 0.01, Math.PI, floor, o);
}
// furniture on the +x side of a wall at x = wallX, facing east
function atW(kind: FKind, wallX: number, z: number, floor: Floor, o: FOpts = {}) {
  put(kind, wallX + 0.1 + depthOf(kind, o) / 2 + 0.01, z, Math.PI / 2, floor, o);
}
// furniture on the -x side of a wall at x = wallX, facing west
function atE(kind: FKind, wallX: number, z: number, floor: Floor, o: FOpts = {}) {
  put(kind, wallX - 0.1 - depthOf(kind, o) / 2 - 0.01, z, -Math.PI / 2, floor, o);
}

// ---- Ground: Living room
atN('sofa', 3.0, 0, 0);
put('coffee_table', 3.0, 2.1, 0, 0);
put('rug', 3.0, 3.0, 0, 0, { w: 3.2, d: 2.2 });
atW('fireplace', 0, 4.0, 0);
put('armchair', 1.9, 5.7, -Math.PI / 2, 0);
atN('bookshelf', 5.6, 0, 0);
atN('clock', 7.4, 0, 0);
atS('piano', 6.4, 7, 0);
atW('wardrobe', 0, 1.2, 0, { hide: 'wardrobe' });
// ---- Ground: Kitchen
atN('counter', 9.2, 0, 0);
atN('stove', 10.6, 0, 0);
atN('counter', 12.0, 0, 0, { id: 'sink' });
atN('fridge', 13.9, 0, 0);
put('table', 12.3, 5.4, 0, 0, { id: 'ktable' });
put('chair', 11.15, 5.4, Math.PI / 2, 0);
put('chair', 12.3, 4.3, 0, 0);
atE('wardrobe', 15, 5.8, 0, { hide: 'wardrobe' });
// ---- Ground: Pantry
atN('shelf', 16.4, 0, 0);
atN('shelf', 18.8, 0, 0);
atE('chest', 20, 2.2, 0);
put('crate', 19.55, 5.2, 0.2, 0);
put('crate', 19.5, 5.85, 0, 0);
put('barrel', 19.5, 4.3, 0, 0);
atW('wardrobe', 15, 5.6, 0, { hide: 'wardrobe' });
// ---- Ground: Hall
atW('side_table', 0, 8.9, 0);
atN('clock', 5.2, HALL_N, 0);
atE('console', 20, 8.9, 0);
// ---- Ground: Dining
put('rug', 3.5, 14.7, 0, 0, { w: 3.4, d: 2.2 });
put('dining_table', 3.5, 14.7, 0, 0, { id: 'dtable' });
put('chair', 2.8, 15.55, Math.PI, 0);
put('chair', 3.5, 15.55, Math.PI, 0);
put('chair', 4.2, 15.55, Math.PI, 0);
atN('bookshelf', 1.5, HALL_S, 0);
atW('dresser', 0, 12.5, 0, { id: 'ddresser' });
atS('wardrobe', 1.2, 16, 0, { hide: 'wardrobe' });
// ---- Ground: Foyer
put('rug', 10, 13.4, 0, 0, { w: 2.6, d: 3.4 });
atS('console', 8.6, 16, 0, { id: 'fconsole' });
atS('console', 11.7, 16, 0);
atN('clock', 12.4, HALL_S, 0);
atW('wardrobe', 7, 15.0, 0, { hide: 'wardrobe' });
atW('coat_rack', 7, 11.7, 0);
// ---- Ground: Study
put('rug', 16.5, 13.4, 0, 0, { w: 3.0, d: 2.4 });
atE('desk', 20, 13.4, 0, { id: 'desk' });
put('office_chair', 18.6, 13.4, Math.PI / 2, 0);
atN('bookshelf', 14.3, HALL_S, 0);
atN('bookshelf', 16.0, HALL_S, 0);
atN('bookshelf', 19.0, HALL_S, 0);
atS('filing', 14.8, 16, 0);
put('armchair', 19.0, 15.2, Math.PI, 0);

// ---- Upper: Bedroom
atW('bed', 0, 1.4, 1, { hide: 'bed', id: 'bedA' });
atW('nightstand', 0, 2.35, 1, { id: 'nsA' });
atN('wardrobe', 3.0, 0, 1, { hide: 'wardrobe' });
atS('dresser', 6.0, HALL_N, 1, { id: 'dresserA' });
put('rocking_chair', 5.6, 1.2, 0.5, 1);
put('rug', 3.5, 4.3, 0, 1, { w: 2.6, d: 2.0 });
// ---- Upper: Bathroom
atN('bathtub', 9.5, 0, 1);
atN('toilet', 11.3, 0, 1);
atN('basin', 7.7, 0, 1, { id: 'basin' });
// ---- Upper: Nursery
atN('crib', 18.5, 0, 1, { id: 'crib' });
atN('toy_chest', 13.2, 0, 1, { id: 'toychest' });
atE('bed', 20, 4.5, 1, { hide: 'bed' });
atW('wardrobe', 12, 1.6, 1, { hide: 'wardrobe' });
put('rocking_horse', 15.0, 1.2, 0.5, 1);
put('rug', 16, 3.0, 0, 1, { w: 2.6, d: 2.4 });
// ---- Upper: Hall
atW('side_table', 0, 8.9, 1, { id: 'uside' });
atN('clock', 6.0, HALL_N, 1);
atE('console', 20, 8.9, 1);
// ---- Upper: Sewing
atW('sewing_table', 0, 14.5, 1, { id: 'sewtable' });
put('mannequin', 1.0, 12.0, 0.4, 1);
atN('shelf', 6.3, HALL_S, 1);
atS('wardrobe', 5.5, 16, 1, { hide: 'wardrobe' });
put('rocking_chair', 2.2, 15.2, Math.PI, 1);
put('rug', 3.5, 14.0, 0, 1, { w: 2.4, d: 2.0 });
// ---- Upper: Storage
put('crate', 12.5, 11.7, 0, 1);
put('crate', 12.45, 12.45, 0.3, 1, { id: 'scrate' });
put('crate', 12.5, 11.7, 0.5, 1, { h: 1.15, w: 0.45, d: 0.45, collide: false });
atS('shelf', 9.6, 16, 1, { id: 'sshelf' });
atS('wardrobe', 11.8, 16, 1, { hide: 'wardrobe' });
put('barrel', 8.55, 11.6, 0, 1);
// ---- Upper: Master
atE('bed_double', 20, 13.4, 1, { hide: 'bed' });
atE('nightstand', 20, 12.1, 1, { id: 'nsM' });
atE('nightstand', 20, 14.7, 1);
atW('dresser', 13, 12.0, 1);
atS('wardrobe', 14.6, 16, 1, { hide: 'wardrobe' });
put('rug', 16.8, 13.4, 0, 1, { w: 3.0, d: 2.6 });

export function furnitureBox(f: FurnitureDef): { x1: number; z1: number; x2: number; z2: number } {
  const swap = Math.abs(Math.sin(f.rot)) > 0.7;
  const wx = swap ? f.d : f.w;
  const wz = swap ? f.w : f.d;
  return { x1: f.x - wx / 2, x2: f.x + wx / 2, z1: f.z - wz / 2, z2: f.z + wz / 2 };
}

// ---------------------------------------------------------------- hide spots
export interface HideSpot {
  id: string;
  type: 'wardrobe' | 'bed';
  floor: Floor;
  x: number;
  z: number;
  fx: number; // facing (opening) direction
  fz: number;
  checkX: number; // where granny stands to inspect it
  checkZ: number;
}
export const HIDE_SPOTS: HideSpot[] = [];
FURNITURE.forEach((f, i) => {
  if (!f.hide) return;
  const fx = Math.sin(f.rot);
  const fz = Math.cos(f.rot);
  const reach = f.hide === 'bed' ? f.d / 2 + 0.85 : f.d / 2 + 0.8;
  HIDE_SPOTS.push({
    id: `hide_${i}`,
    type: f.hide,
    floor: f.floor,
    x: f.x,
    z: f.z,
    fx,
    fz,
    checkX: f.x + fx * reach,
    checkZ: f.z + fz * reach,
  });
});

// ---------------------------------------------------------------- colliders
export const FLOOR_COLLIDERS: [Collider[], Collider[]] = [[], []];
export const doorClosed: Record<string, boolean> = {};

for (const w of WALLS) {
  const solidSight = w.kind !== 'stair' || w.floor === 0;
  for (const p of wallPieces(w)) {
    if (p.kind === 'lintel') continue;
    const t = WALL_T / 2;
    const box =
      p.axis === 'x'
        ? { x1: p.a, x2: p.b, z1: p.fixed - t, z2: p.fixed + t }
        : { x1: p.fixed - t, x2: p.fixed + t, z1: p.a, z2: p.b };
    const sight = p.kind === 'glass' ? false : p.kind === 'sill' ? false : solidSight;
    FLOOR_COLLIDERS[p.floor].push({ ...box, floor: p.floor, sight });
  }
}
// sills: block sight only if they are part of the full wall; windows never block sight.
for (const f of FURNITURE) {
  if (!f.collide) continue;
  const b = furnitureBox(f);
  FLOOR_COLLIDERS[f.floor].push({ ...b, floor: f.floor, sight: f.h >= 1.4 });
}
for (const d of DOORS) {
  if (d.front) {
    const t = 0.06;
    FLOOR_COLLIDERS[0].push({ x1: d.pos - d.width / 2, x2: d.pos + d.width / 2, z1: d.fixed - t, z2: d.fixed + t, floor: 0, sight: true, door: d.id });
    doorClosed[d.id] = true;
    continue;
  }
  const t = 0.07;
  const lo = d.pos - d.width / 2;
  const hi = d.pos + d.width / 2;
  const box =
    d.axis === 'x'
      ? { x1: lo, x2: hi, z1: d.fixed - t, z2: d.fixed + t }
      : { x1: d.fixed - t, x2: d.fixed + t, z1: lo, z2: hi };
  FLOOR_COLLIDERS[d.floor].push({ ...box, floor: d.floor, sight: true, door: d.id });
  doorClosed[d.id] = true;
}

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

export function resolveCircle(p: { x: number; z: number }, r: number, floor: Floor) {
  const list = FLOOR_COLLIDERS[floor];
  for (let iter = 0; iter < 3; iter++) {
    let moved = false;
    for (const c of list) {
      if (c.door && !doorClosed[c.door]) continue;
      const cx = clamp(p.x, c.x1, c.x2);
      const cz = clamp(p.z, c.z1, c.z2);
      const dx = p.x - cx;
      const dz = p.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          const push = r - d;
          p.x += (dx / d) * push;
          p.z += (dz / d) * push;
        } else {
          const l = p.x - c.x1;
          const rr = c.x2 - p.x;
          const t = p.z - c.z1;
          const b = c.z2 - p.z;
          const m = Math.min(l, rr, t, b);
          if (m === l) p.x = c.x1 - r;
          else if (m === rr) p.x = c.x2 + r;
          else if (m === t) p.z = c.z1 - r;
          else p.z = c.z2 + r;
        }
        moved = true;
      }
    }
    if (!moved) break;
  }
}

export function pointBlocked(x: number, z: number, floor: Floor, r = 0): boolean {
  for (const c of FLOOR_COLLIDERS[floor]) {
    if (c.door && !doorClosed[c.door]) continue;
    if (x > c.x1 - r && x < c.x2 + r && z > c.z1 - r && z < c.z2 + r) return true;
  }
  return false;
}

/** Point inside a sight-blocking collider (walls, tall furniture, closed doors) */
export function pointBlockedSight(x: number, z: number, floor: Floor): boolean {
  for (const c of FLOOR_COLLIDERS[floor]) {
    if (!c.sight) continue;
    if (c.door && !doorClosed[c.door]) continue;
    if (x > c.x1 && x < c.x2 && z > c.z1 && z < c.z2) return true;
  }
  return false;
}

function segBox(ax: number, az: number, bx: number, bz: number, x1: number, z1: number, x2: number, z2: number): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = bx - ax;
  const dz = bz - az;
  if (Math.abs(dx) < 1e-9) {
    if (ax < x1 || ax > x2) return false;
  } else {
    let ta = (x1 - ax) / dx;
    let tb = (x2 - ax) / dx;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 > t1) return false;
  }
  if (Math.abs(dz) < 1e-9) {
    if (az < z1 || az > z2) return false;
  } else {
    let ta = (z1 - az) / dz;
    let tb = (z2 - az) / dz;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 > t1) return false;
  }
  return true;
}

/** Is the straight segment blocked? mode: 'sight' (tall obstacles + closed doors), 'move' (everything incl. closed doors), 'path' (everything except doors) */
export function segmentBlocked(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  floors: Floor[],
  r: number,
  mode: 'sight' | 'move' | 'path',
): boolean {
  for (const fl of floors) {
    for (const c of FLOOR_COLLIDERS[fl]) {
      if (c.door) {
        if (mode === 'path') continue;
        if (!doorClosed[c.door]) continue;
      } else if (mode === 'sight' && !c.sight) continue;
      if (segBox(ax, az, bx, bz, c.x1 - r, c.z1 - r, c.x2 + r, c.z2 + r)) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------- stairs / floors
export function inStairZone(x: number, z: number): boolean {
  return x >= STAIR.x1 && x <= STAIR.x2 && z >= STAIR.z1 && z <= STAIR.z2;
}
export function floorAt(x: number, z: number, prev: Floor): Floor {
  if (inStairZone(x, z)) return x > (STAIR.x1 + STAIR.x2) / 2 ? 1 : 0;
  return prev;
}
export function groundY(x: number, z: number, floor: Floor): number {
  if (inStairZone(x, z)) {
    const t = clamp((x - STAIR.x1) / (STAIR.x2 - STAIR.x1), 0, 1);
    return STAIR_RISE * t + 0.09 * 4 * t * (1 - t);
  }
  return FLOOR_Y[floor];
}

// ---------------------------------------------------------------- navigation graph
export interface NavNode {
  id: string;
  x: number;
  z: number;
  floor: Floor;
  room: string;
}
export const NAV_NODES: NavNode[] = [];
export const NAV_EDGES: [string, string][] = [];
const nodeIdx: Record<string, number> = {};
function node(id: string, x: number, z: number, floor: Floor, room: string) {
  nodeIdx[id] = NAV_NODES.length;
  NAV_NODES.push({ id, x, z, floor, room });
}
function link(...ids: string[]) {
  for (let i = 0; i < ids.length - 1; i++) NAV_EDGES.push([ids[i], ids[i + 1]]);
}

// ground
node('gH1', 1.5, 8.9, 0, 'hallG');
node('gH2', 3.5, 8.9, 0, 'hallG');
node('gH3', 6.5, 8.9, 0, 'hallG');
node('gH4', 9.0, 8.9, 0, 'hallG');
node('gArch', 10.0, 9.9, 0, 'hallG');
node('gC1', 12.5, 9.9, 0, 'hallG');
node('gC2', 15.5, 9.9, 0, 'hallG');
node('gE1', 17.5, 8.9, 0, 'hallG');
node('gE2', 19.0, 8.9, 0, 'hallG');
node('gS0', 9.3, 8.0, 0, 'hallG');
node('gS1', 11.2, 8.0, 0, 'hallG');
node('gS2', 13.8, 8.0, 1, 'hallU');
node('gS3', 15.8, 8.0, 1, 'hallU');
node('lvD', 3.5, 6.0, 0, 'living');
node('lvC', 3.5, 3.0, 0, 'living');
node('lvE', 6.8, 3.0, 0, 'living');
node('kW', 9.2, 3.0, 0, 'kitchen');
node('kD', 9.0, 6.0, 0, 'kitchen');
node('kC', 11.5, 3.5, 0, 'kitchen');
node('kE', 13.8, 3.0, 0, 'kitchen');
node('pW', 16.2, 3.0, 0, 'pantry');
node('pC', 17.5, 3.0, 0, 'pantry');
node('pD', 17.5, 6.0, 0, 'pantry');
node('dD', 3.5, 11.8, 0, 'dining');
node('dC', 3.5, 13.4, 0, 'dining');
node('dE', 5.8, 13.4, 0, 'dining');
node('fN', 10.0, 11.8, 0, 'foyer');
node('fC', 10.0, 13.4, 0, 'foyer');
node('fW', 8.2, 13.4, 0, 'foyer');
node('fE', 11.8, 13.4, 0, 'foyer');
node('fS', 10.0, 15.0, 0, 'foyer');
node('sW', 14.2, 13.4, 0, 'study');
node('sC', 16.5, 13.2, 0, 'study');
node('sN', 17.5, 11.8, 0, 'study');
node('sS', 17.5, 15.0, 0, 'study');
// upper
node('uH1', 1.5, 8.9, 1, 'hallU');
node('uA', 3.5, 8.9, 1, 'hallU');
node('uB', 8.5, 8.9, 1, 'hallU');
node('uB2', 9.2, 9.9, 1, 'hallU');
node('uC', 10.5, 9.9, 1, 'hallU');
node('uD', 13.5, 9.9, 1, 'hallU');
node('uD2', 15.6, 9.9, 1, 'hallU');
node('uF', 17.0, 8.9, 1, 'hallU');
node('uG', 19.0, 8.9, 1, 'hallU');
node('baD', 3.5, 6.0, 1, 'bedA');
node('baC', 3.5, 3.5, 1, 'bedA');
node('baE', 5.8, 3.5, 1, 'bedA');
node('btC', 9.5, 3.5, 1, 'bath');
node('btD', 8.5, 6.0, 1, 'bath');
node('btE', 10.8, 3.5, 1, 'bath');
node('nW', 13.2, 3.5, 1, 'nursery');
node('nC', 16.0, 3.5, 1, 'nursery');
node('nD', 17.0, 6.0, 1, 'nursery');
node('swD', 3.5, 11.8, 1, 'sewing');
node('swC', 3.5, 13.4, 1, 'sewing');
node('swE', 6.8, 13.4, 1, 'sewing');
node('stC', 10.5, 13.4, 1, 'storage');
node('stD', 10.5, 11.8, 1, 'storage');
node('maD', 17.0, 11.8, 1, 'master');
node('maC', 16.5, 13.4, 1, 'master');
node('maS', 17.0, 15.0, 1, 'master');

link('gH1', 'gH2', 'gH3', 'gH4', 'gArch', 'gC1', 'gC2', 'gE1', 'gE2');
link('gH4', 'gS0', 'gS1', 'gS2', 'gS3', 'uF');
link('gH2', 'lvD', 'lvC', 'lvE', 'kW');
link('gH4', 'kD', 'kW', 'kC', 'kE', 'pW', 'pC', 'pD', 'gE1');
link('kD', 'kC');
link('gH2', 'dD', 'dC', 'dE', 'fW', 'fC');
link('gArch', 'fN', 'fC', 'fE', 'sW', 'sC', 'sN');
link('fC', 'fS');
link('sC', 'sS');
link('uH1', 'uA', 'uB', 'uB2', 'uC', 'uD', 'uD2', 'uF', 'uG');
link('uA', 'baD', 'baC', 'baE', 'btC', 'btE', 'nW', 'nC', 'nD', 'uF');
link('btD', 'btC');
link('uB', 'btD');
link('uA', 'swD', 'swC', 'swE', 'stC', 'stD', 'uC');
link('uF', 'maD', 'maC', 'maS');

export const NODE_INDEX = nodeIdx;
export function nodeById(id: string): NavNode {
  return NAV_NODES[nodeIdx[id]];
}
export function nodeY(n: NavNode): number {
  return groundY(n.x, n.z, n.floor);
}

const adjacency: number[][] = NAV_NODES.map(() => []);
for (const [a, b] of NAV_EDGES) {
  adjacency[nodeIdx[a]].push(nodeIdx[b]);
  adjacency[nodeIdx[b]].push(nodeIdx[a]);
}

export function findPath(fromId: string, toId: string): string[] {
  const s = nodeIdx[fromId];
  const t = nodeIdx[toId];
  if (s === t) return [fromId];
  const n = NAV_NODES.length;
  const dist = new Array<number>(n).fill(Infinity);
  const prev = new Array<number>(n).fill(-1);
  const done = new Array<boolean>(n).fill(false);
  dist[s] = 0;
  for (let it = 0; it < n; it++) {
    let u = -1;
    let best = Infinity;
    for (let i = 0; i < n; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; }
    if (u === -1 || u === t) break;
    done[u] = true;
    for (const v of adjacency[u]) {
      const w = Math.hypot(NAV_NODES[u].x - NAV_NODES[v].x, NAV_NODES[u].z - NAV_NODES[v].z);
      if (dist[u] + w < dist[v]) { dist[v] = dist[u] + w; prev[v] = u; }
    }
  }
  if (prev[t] === -1) return [];
  const path: string[] = [];
  for (let c = t; c !== -1; c = prev[c]) path.push(NAV_NODES[c].id);
  return path.reverse();
}

/** Nearest nav node that is directly reachable from (x,z) */
export function nearestNode(x: number, z: number, floor: Floor): NavNode {
  let best: NavNode | null = null;
  let bd = Infinity;
  for (const n of NAV_NODES) {
    if (n.floor !== floor) continue;
    const d = Math.hypot(n.x - x, n.z - z);
    if (d >= bd) continue;
    if (d > 0.4 && segmentBlocked(x, z, n.x, n.z, [floor], 0.25, 'path')) continue;
    bd = d;
    best = n;
  }
  if (best) return best;
  // fallback: pure nearest on that floor
  for (const n of NAV_NODES) {
    if (n.floor !== floor) continue;
    const d = Math.hypot(n.x - x, n.z - z);
    if (d < bd) { bd = d; best = n; }
  }
  return best ?? NAV_NODES[0];
}

// ---------------------------------------------------------------- gameplay data
export const PLAYER_SPAWN = { x: 3.5, z: 5.0, floor: 1 as Floor, yaw: Math.PI };
export const GRANNY_SPAWN_NODE = 'kC';

export interface TrapDef { x: number; z: number; floor: Floor }
export const TRAPS: TrapDef[] = [
  { x: 6.2, z: 9.5, floor: 0 },
  { x: 11.6, z: 12.3, floor: 0 },
  { x: 10.3, z: 5.3, floor: 0 },
  { x: 6.0, z: 8.2, floor: 1 },
  { x: 14.5, z: 5.5, floor: 1 },
];

export interface CreakZone { x1: number; z1: number; x2: number; z2: number; floor: Floor }
export const CREAK_ZONES: CreakZone[] = [
  { x1: 4.5, z1: 8.0, x2: 8.5, z2: 9.8, floor: 0 },
  { x1: 8.5, z1: 12.0, x2: 11.5, z2: 14.5, floor: 0 },
  { x1: 2.0, z1: 12.0, x2: 5.0, z2: 13.6, floor: 0 },
  { x1: 1.0, z1: 8.0, x2: 8.0, z2: 9.8, floor: 1 },
  { x1: 10.2, z1: 9.2, x2: 14.8, z2: 10.6, floor: 1 },
  { x1: 13.0, z1: 2.0, x2: 16.0, z2: 5.0, floor: 1 },
];

export interface LightDef {
  x: number; y: number; z: number; color: number; intensity: number; distance: number;
  flicker: number; fixture: 'bulb' | 'lamp' | 'fire' | 'none';
}
export const LIGHTS: LightDef[] = [
  { x: 6.5, y: 2.55, z: 8.9, color: 0xffd9a0, intensity: 7, distance: 11, flicker: 0.35, fixture: 'bulb' },
  { x: 11.5, y: 2.55, z: 3.5, color: 0xffe2b0, intensity: 6, distance: 10, flicker: 0.15, fixture: 'bulb' },
  { x: 0.95, y: 0.6, z: 4.0, color: 0xff7a2a, intensity: 5, distance: 9, flicker: 1, fixture: 'fire' },
  { x: 10.0, y: 2.55, z: 13.4, color: 0xffd9a0, intensity: 6, distance: 10, flicker: 0.2, fixture: 'bulb' },
  { x: 19.2, y: 1.2, z: 12.9, color: 0x9bd6a0, intensity: 2.6, distance: 7, flicker: 0.05, fixture: 'lamp' },
  { x: 4.0, y: 5.75, z: 8.9, color: 0xffd0a0, intensity: 6, distance: 11, flicker: 0.6, fixture: 'bulb' },
  { x: 0.31, y: 3.2 + 0.85, z: 2.35, color: 0xffc27a, intensity: 2.6, distance: 7, flicker: 0.05, fixture: 'lamp' },
  { x: 13.45, y: 3.2 + 0.78, z: 0.4, color: 0xffa0c8, intensity: 2.4, distance: 7, flicker: 0.1, fixture: 'lamp' },
  { x: 16.8, y: 5.75, z: 13.4, color: 0xffb0a0, intensity: 3.2, distance: 8, flicker: 0.2, fixture: 'bulb' },
];

export interface ItemSpot { x: number; y: number; z: number; floor: Floor; label: string; locked?: boolean }
// where randomized items (keys, bottles) can appear (never inside locked rooms)
export const ITEM_SPOTS: ItemSpot[] = [
  { x: 3.0, y: 0.46, z: 2.1, floor: 0, label: 'coffee table' },
  { x: 5.6, y: 0.86, z: 0.35, floor: 0, label: 'bookshelf' },
  { x: 12.3, y: 0.77, z: 5.4, floor: 0, label: 'kitchen table' },
  { x: 9.0, y: 0.93, z: 0.45, floor: 0, label: 'counter' },
  { x: 16.4, y: 0.94, z: 0.3, floor: 0, label: 'pantry shelf' },
  { x: 19.5, y: 0.61, z: 5.85, floor: 0, label: 'crate' },
  { x: 3.5, y: 0.77, z: 14.7, floor: 0, label: 'dining table' },
  { x: 0.35, y: 0.96, z: 12.5, floor: 0, label: 'dresser' },
  { x: 8.6, y: 0.83, z: 15.7, floor: 0, label: 'foyer console' },
  { x: 0.31, y: 0.76, z: 8.9, floor: 0, label: 'hall table' },
  { x: 6.0, y: 3.2 + 0.96, z: 6.64, floor: 1, label: 'dresser' },
  { x: 0.31, y: 3.2 + 0.56, z: 2.35, floor: 1, label: 'nightstand' },
  { x: 7.7, y: 3.2 + 0.91, z: 0.35, floor: 1, label: 'basin' },
  { x: 13.2, y: 3.2 + 0.51, z: 0.35, floor: 1, label: 'toy chest' },
  { x: 0.41, y: 3.2 + 0.81, z: 14.5, floor: 1, label: 'sewing table' },
  { x: 12.45, y: 3.2 + 0.61, z: 12.45, floor: 1, label: 'crate' },
  { x: 9.6, y: 3.2 + 0.94, z: 15.7, floor: 1, label: 'shelf' },
  { x: 0.31, y: 3.2 + 0.76, z: 8.9, floor: 1, label: 'hall table' },
];

export interface NoteDef { id: string; x: number; y: number; z: number; floor: Floor; title: string; text: string }
export const NOTES: NoteDef[] = [
  {
    id: 'n1', x: 1.6, y: 3.2 + 0.56, z: 1.6, floor: 1, title: 'Torn page',
    text: 'You woke up in Granny\'s house. Again. She hears EVERYTHING — footsteps, doors, glass. Crouch (C) to creep. Two locks hold the front door: find the Padlock Key and the Front Door Key. They are locked behind the Brass Key and the Silver Key.',
  },
  {
    id: 'n2', x: 12.0, y: 0.77, z: 5.05, floor: 0, title: 'Scribbled note',
    text: 'Bottles make a lovely crash. Throw one (click / Q) far away from you and she will shuffle off to inspect it. It buys you time. It does not buy you mercy.',
  },
  {
    id: 'n3', x: 18.5, y: 3.2 + 0.46, z: 0.8, floor: 1, title: 'Child\'s drawing',
    text: 'Wardrobes and beds can hide you. But if she SEES you climb in, she will pull you right out again. Break her line of sight first. Always.',
  },
  {
    id: 'n4', x: 19.5, y: 0.8, z: 13.9, floor: 0, title: 'Study memo',
    text: 'She has laid traps in the dark halls. Watch the floor with your torch. Springing one is a scream she can hear from any room in the house.',
  },
  {
    id: 'n5', x: 19.7, y: 3.2 + 0.56, z: 14.7, floor: 1, title: 'Last entry',
    text: 'Five days. That is all you get. Every time she catches you, a day is gone — and she is always up before the sun. Run when you must. Whisper when you can.',
  },
];

export const FIXED_ITEMS = [
  { id: 'padlock_key', x: 19.5, y: 0.79, z: 12.95, floor: 0 as Floor },
  { id: 'door_key', x: 19.69, y: 3.2 + 0.56, z: 12.1, floor: 1 as Floor },
];

export const PAINTINGS: { x: number; z: number; rot: number; floor: Floor; variant: number }[] = [
  { x: 7.6, z: HALL_N + 0.12, rot: 0, floor: 0, variant: 0 },
  { x: 19.0, z: HALL_N + 0.12, rot: 0, floor: 0, variant: 1 },
  { x: 6.5, z: HALL_S - 0.12, rot: Math.PI, floor: 0, variant: 2 },
  { x: 14.5, z: HALL_S - 0.12, rot: Math.PI, floor: 0, variant: 0 },
  { x: 5.2, z: HALL_S + 0.12, rot: 0, floor: 0, variant: 1 },
  { x: 3.0, z: 0.12, rot: 0, floor: 0, variant: 2 },
  { x: 7.6, z: HALL_N + 0.12, rot: 0, floor: 1, variant: 1 },
  { x: 19.2, z: HALL_N + 0.12, rot: 0, floor: 1, variant: 2 },
  { x: 6.5, z: HALL_S - 0.12, rot: Math.PI, floor: 1, variant: 0 },
  { x: 14.0, z: HALL_S - 0.12, rot: Math.PI, floor: 1, variant: 1 },
  { x: 16.5, z: 0.12, rot: 0, floor: 1, variant: 2 },
];
