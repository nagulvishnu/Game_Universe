import { describe, expect, it } from 'vitest';
import { NPCS, RIVALS } from '../../data/rivals';
import { buildCity } from '../world/city';
import { resolveMove, rayFreeDistance } from '../world/collision';
import { INTERACTABLES, WORLD } from '../world/layout';

const free = (x: number, z: number) => {
  const r = resolveMove(x, z, 0.45);
  return Math.hypot(r.x - x, r.z - z) < 0.02;
};

describe('city world', () => {
  const city = buildCity();
  it('builds merged chunks and colliders', () => {
    let verts = 0;
    for (const c of city.chunks) for (const g of [c.color, c.win, c.glow]) if (g) verts += g.getAttribute('position').count;
    console.log('CITY chunks', city.chunks.length, 'verts', verts, 'colliders', city.colliders.length, 'tri', Math.round(verts / 3));
    expect(city.chunks.length).toBeGreaterThanOrEqual(8);
    expect(city.colliders.length).toBeGreaterThan(200);
  });
  it('places every NPC/rival on walkable ground (outside tall colliders)', () => {
    const tall = city.colliders.filter((c) => c.tall && !c.camOnly);
    const bad: string[] = [];
    for (const n of [...RIVALS.map((r) => ({ id: r.id, ...r.home })), ...NPCS.map((r) => ({ id: r.id, ...r.home }))]) {
      for (const c of tall) {
        const cs = Math.cos(c.rot), sn = Math.sin(c.rot);
        const rx = n.x - c.x, rz = n.z - c.z;
        const hit = c.round ? Math.hypot(rx, rz) < c.r + 0.6 : Math.abs(rx * cs - rz * sn) < c.hw + 0.6 && Math.abs(rx * sn + rz * cs) < c.hd + 0.6;
        if (hit) bad.push(n.id);
      }
    }
    expect(bad).toEqual([]);
  });
  it('every interactable is reachable from the spawn point', () => {
    const W = WORLD, step = 1;
    const key = (i: number, j: number) => i * 1000 + j;
    const seen = new Set<number>();
    const q: [number, number][] = [[Math.round(-62 - W.minX), Math.round(-28 - W.minZ)]];
    seen.add(key(q[0][0], q[0][1]));
    while (q.length) {
      const [i, j] = q.pop()!;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const ni = i + di, nj = j + dj;
        const x = W.minX + ni * step, z = W.minZ + nj * step;
        if (x < W.minX || x > W.maxX || z < W.minZ || z > W.maxZ) continue;
        const k = key(ni, nj);
        if (seen.has(k) || !free(x, z)) continue;
        seen.add(k); q.push([ni, nj]);
      }
    }
    const reach = (x: number, z: number, r = 5) => {
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) if (seen.has(key(Math.round(x + dx - W.minX), Math.round(z + dz - W.minZ)))) return true;
      return false;
    };
    const unreachable = [...RIVALS.map((r) => ({ id: r.id, ...r.home })), ...NPCS.map((r) => ({ id: r.id, ...r.home })), ...INTERACTABLES].filter((t) => !reach(t.x, t.z, 4)).map((t) => t.id);
    console.log('walkable cells', seen.size);
    expect(unreachable).toEqual([]);
  });
  it('camera ray stops at buildings', () => {
    expect(rayFreeDistance(0, 0, 3, 0)).toBeGreaterThan(2.9);
  });
});
