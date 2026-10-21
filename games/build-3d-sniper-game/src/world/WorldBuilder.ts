import { BiomeId } from '../types/game';

export interface WorldBox {
  id: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  color: string;
  materialType: 'concrete' | 'metal' | 'wood' | 'rock' | 'sandbag' | 'glass';
  walkableTop?: boolean;
  blocksSight: boolean;
}

export interface WorldRamp {
  id: string;
  x: number;
  z: number;
  width: number;
  length: number;
  yBottom: number;
  yTop: number;
  dir: 'north' | 'south' | 'east' | 'west'; // direction going UP
  color: string;
}

export interface PropInstance {
  x: number;
  y: number;
  z: number;
  scale: [number, number, number];
  rotY: number;
  color: string;
}

export interface ExplosiveBarrel {
  id: string;
  x: number;
  y: number;
  z: number;
  exploded: boolean;
}

export interface DistanceSign {
  distanceLabel: string;
  x: number;
  y: number;
  z: number;
}

export interface BiomePalette {
  id: BiomeId;
  name: string;
  groundPrimary: string;
  groundSecondary: string;
  skyTop: string;
  skyHorizon: string;
  fogColor: string;
  fogNear: number;
  fogFar: number;
  sunColor: string;
  sunIntensity: number;
  ambientIntensity: number;
  treeType: 'pine' | 'desert_scrub' | 'snow_pine' | 'none';
}

export interface GeneratedWorld {
  biome: BiomeId;
  palette: BiomePalette;
  boxes: WorldBox[];
  ramps: WorldRamp[];
  trees: PropInstance[];
  rocks: PropInstance[];
  barrels: ExplosiveBarrel[];
  signs: DistanceSign[];
}

export const BIOME_PALETTES: Record<BiomeId, BiomePalette> = {
  training_range: {
    id: 'training_range',
    name: 'Highland Ballistics Range',
    groundPrimary: '#475c3a',
    groundSecondary: '#69624e',
    skyTop: '#1d4ed8',
    skyHorizon: '#93c5fd',
    fogColor: '#93c5fd',
    fogNear: 230,
    fogFar: 680,
    sunColor: '#fffbeb',
    sunIntensity: 2.2,
    ambientIntensity: 0.9,
    treeType: 'pine',
  },
  forest_outpost: {
    id: 'forest_outpost',
    name: 'Carpathian Timber Outpost',
    groundPrimary: '#364f2f',
    groundSecondary: '#594c38',
    skyTop: '#1e3a5f',
    skyHorizon: '#84a9bf',
    fogColor: '#84a9bf',
    fogNear: 210,
    fogFar: 620,
    sunColor: '#ffe4b5',
    sunIntensity: 2.0,
    ambientIntensity: 0.88,
    treeType: 'pine',
  },
  desert_base: {
    id: 'desert_base',
    name: 'Rub al-Khali Forward Base',
    groundPrimary: '#c7a26e',
    groundSecondary: '#9c764c',
    skyTop: '#2563eb',
    skyHorizon: '#edd2a8',
    fogColor: '#edd2a8',
    fogNear: 220,
    fogFar: 650,
    sunColor: '#fff1d0',
    sunIntensity: 2.4,
    ambientIntensity: 0.92,
    treeType: 'desert_scrub',
  },
  industrial_harbor: {
    id: 'industrial_harbor',
    name: 'Port Meridian Terminal',
    groundPrimary: '#3b424d',
    groundSecondary: '#272d36',
    skyTop: '#0f1d35',
    skyHorizon: '#2b4c6e',
    fogColor: '#254261',
    fogNear: 200,
    fogFar: 600,
    sunColor: '#93c5fd',
    sunIntensity: 1.55,
    ambientIntensity: 0.85,
    treeType: 'none',
  },
  mountain_frontier: {
    id: 'mountain_frontier',
    name: 'Boreas Glacial Pass',
    groundPrimary: '#e2e8f0',
    groundSecondary: '#64748b',
    skyTop: '#2563eb',
    skyHorizon: '#cbd5e1',
    fogColor: '#cbd5e1',
    fogNear: 210,
    fogFar: 640,
    sunColor: '#f0f9ff',
    sunIntensity: 2.1,
    ambientIntensity: 0.95,
    treeType: 'snow_pine',
  },
  urban_district: {
    id: 'urban_district',
    name: 'NewVerge Financial District',
    groundPrimary: '#333842',
    groundSecondary: '#474d59',
    skyTop: '#1e293b',
    skyHorizon: '#7c5d72',
    fogColor: '#6b5369',
    fogNear: 210,
    fogFar: 620,
    sunColor: '#fdba74',
    sunIntensity: 1.9,
    ambientIntensity: 0.88,
    treeType: 'none',
  },
};

/**
 * Deterministic terrain elevation (in meters) at world (x, z).
 * Coordinate convention:
 * - Player generally spawns in the South ridge area (+Z around +55..+95) facing North (-Z toward -40..-210).
 * - Central compound / lane between x in [-45, +45], z in [-220, +25] has flattened structural pads,
 *   while surrounding flanks and southern sniper overwatches feature organic hills & ridges.
 */
export function getTerrainHeight(biome: BiomeId, x: number, z: number): number {
  if (biome === 'industrial_harbor' || biome === 'urban_district') {
    // Mostly paved quayside / city grid with gentle raised southern overpass embankment
    const southRise = z > 40 ? Math.min(5.5, (z - 40) * 0.14) : 0;
    return southRise;
  }

  // Southern sniper ridge elevation (+Z > 38)
  let h = 0;
  if (z > 32) {
    h += Math.min(8.5, (z - 32) * 0.18);
  }

  // Gentle flank hills outside main compound corridor
  const absX = Math.abs(x);
  if (absX > 36) {
    const flankFactor = (absX - 36) * 0.16;
    const wave = Math.sin(x * 0.045) * Math.cos(z * 0.035) * 3.2;
    h += Math.min(12, flankFactor + wave * 0.5);
  }

  if (biome === 'training_range') {
    return h;
  }

  // Rolling micro-undulation outside flat building pads
  const compoundMask = absX < 34 && z > -185 && z < 28 ? 0.12 : 1.0;
  const rolling =
    (Math.sin(x * 0.035 + 0.7) * Math.cos(z * 0.03 - 0.4) * 2.4 +
      Math.cos(x * 0.08 - z * 0.06) * 0.75) *
    compoundMask;

  if (biome === 'mountain_frontier') {
    const farRidge = z < -155 ? Math.min(9, (-155 - z) * 0.16) : 0;
    return h + rolling * 1.35 + farRidge;
  }

  if (biome === 'desert_base') {
    const dune = Math.sin(x * 0.03 + z * 0.02) * 1.9 * compoundMask;
    return h + dune;
  }

  return h + rolling;
}

function makeBox(
  id: string,
  cx: number,
  cz: number,
  w: number,
  d: number,
  bottomY: number,
  height: number,
  color: string,
  materialType: WorldBox['materialType'],
  walkableTop = true,
  blocksSight = true
): WorldBox {
  return {
    id,
    minX: cx - w / 2,
    maxX: cx + w / 2,
    minY: bottomY,
    maxY: bottomY + height,
    minZ: cz - d / 2,
    maxZ: cz + d / 2,
    color,
    materialType,
    walkableTop,
    blocksSight,
  };
}

function addWatchtower(
  boxes: WorldBox[],
  ramps: WorldRamp[],
  prefix: string,
  cx: number,
  cz: number,
  groundY: number,
  deckHeight = 6.5,
  color = '#4b5563'
) {
  // 4 corner pillars
  const half = 2.6;
  const pSize = 0.55;
  const corners = [
    [-half, -half],
    [half, -half],
    [-half, half],
    [half, half],
  ];
  corners.forEach(([ox, oz], idx) => {
    boxes.push(
      makeBox(
        `${prefix}_leg_${idx}`,
        cx + ox,
        cz + oz,
        pSize,
        pSize,
        groundY - 1,
        deckHeight + 3.4,
        '#374151',
        'metal',
        false,
        false
      )
    );
  });

  // Walkable platform deck
  boxes.push(
    makeBox(
      `${prefix}_deck`,
      cx,
      cz,
      6.2,
      6.2,
      groundY + deckHeight - 0.4,
      0.45,
      color,
      'wood',
      true,
      true
    )
  );

  // Waist-high sniper parapet rails (leave firing window open above waist!)
  boxes.push(
    makeBox(
      `${prefix}_rail_n`,
      cx,
      cz - 2.95,
      6.2,
      0.3,
      groundY + deckHeight,
      1.05,
      color,
      'metal',
      false,
      true
    )
  );
  boxes.push(
    makeBox(
      `${prefix}_rail_w`,
      cx - 2.95,
      cz,
      0.3,
      5.6,
      groundY + deckHeight,
      1.05,
      color,
      'metal',
      false,
      true
    )
  );
  boxes.push(
    makeBox(
      `${prefix}_rail_e`,
      cx + 2.95,
      cz,
      0.3,
      5.6,
      groundY + deckHeight,
      1.05,
      color,
      'metal',
      false,
      true
    )
  );

  // Overhead canopy roof supported above head height (2.7m clearance)
  boxes.push(
    makeBox(
      `${prefix}_roof`,
      cx,
      cz,
      6.8,
      6.8,
      groundY + deckHeight + 2.75,
      0.35,
      '#1f2937',
      'metal',
      true,
      true
    )
  );

  // Access ramp climbing from South (+Z) up onto South edge of deck
  ramps.push({
    id: `${prefix}_ramp`,
    x: cx,
    z: cz + 7.6,
    width: 2.4,
    length: 9.2,
    yBottom: groundY,
    yTop: groundY + deckHeight + 0.05,
    dir: 'north',
    color: '#475569',
  });
}

function addBuildingWithRoof(
  boxes: WorldBox[],
  ramps: WorldRamp[],
  prefix: string,
  cx: number,
  cz: number,
  w: number,
  d: number,
  groundY: number,
  height: number,
  wallColor: string,
  withSideRamp = true
) {
  boxes.push(
    makeBox(
      `${prefix}_body`,
      cx,
      cz,
      w,
      d,
      groundY - 1.5,
      height + 1.5,
      wallColor,
      'concrete',
      true,
      true
    )
  );
  // Rooftop low cover parapets
  boxes.push(
    makeBox(
      `${prefix}_parapet_n`,
      cx,
      cz - d / 2 + 0.25,
      w * 0.7,
      0.45,
      groundY + height,
      1.0,
      '#334155',
      'concrete',
      false,
      true
    )
  );
  if (withSideRamp) {
    ramps.push({
      id: `${prefix}_stair`,
      x: cx + w / 2 + 1.3,
      z: cz,
      width: 2.4,
      length: d * 0.85,
      yBottom: groundY,
      yTop: groundY + height + 0.05,
      dir: 'north',
      color: '#475569',
    });
  }
}

export function buildWorldForBiome(biome: BiomeId, seedOffset = 0): GeneratedWorld {
  const palette = BIOME_PALETTES[biome];
  const boxes: WorldBox[] = [];
  const ramps: WorldRamp[] = [];
  const trees: PropInstance[] = [];
  const rocks: PropInstance[] = [];
  const barrels: ExplosiveBarrel[] = [];
  const signs: DistanceSign[] = [];

  // Player Overwatch Nest Cover at South Ridge (around z = +68)
  const spawnGround = getTerrainHeight(biome, 0, 68);
  boxes.push(
    makeBox('spawn_sandbag_c', 0, 64.5, 4.4, 0.9, spawnGround - 0.3, 1.15, '#786b52', 'sandbag', true, true),
    makeBox('spawn_sandbag_l', -8.5, 65.5, 3.6, 0.9, getTerrainHeight(biome, -8.5, 65.5) - 0.3, 1.15, '#786b52', 'sandbag', true, true),
    makeBox('spawn_crate_ammo', 4.2, 67.2, 1.6, 1.2, spawnGround - 0.3, 1.05, '#3f4d3b', 'metal', true, true)
  );
  // Player elevated sniper tower option on East Overwatch Ridge
  addWatchtower(boxes, ramps, 'player_overwatch_tower', 15, 66, getTerrainHeight(biome, 15, 66), 5.5, '#475569');

  if (biome === 'training_range') {
    // Firing lane dividers & range markers at 50m, 100m, 150m, 200m, 250m from z = 64
    const rangeDistances = [50, 100, 150, 200, 250];
    rangeDistances.forEach((dist) => {
      const tz = 64 - dist;
      const gy = getTerrainHeight(biome, -22, tz);
      signs.push({ distanceLabel: `${dist}M`, x: -24, y: gy, z: tz });
      // Berm backstops behind target rows
      boxes.push(
        makeBox(
          `berm_${dist}`,
          0,
          tz - 3.5,
          44,
          1.8,
          getTerrainHeight(biome, 0, tz - 3.5) - 0.5,
          1.15,
          '#5c5040',
          'sandbag',
          true,
          true
        )
      );
      barrels.push({
        id: `range_barrel_${dist}`,
        x: (dist % 100 === 0 ? 1 : -1) * 14,
        y: getTerrainHeight(biome, 14, tz),
        z: tz,
        exploded: false,
      });
    });
    addWatchtower(boxes, ramps, 'range_tower_west', -26, -30, getTerrainHeight(biome, -26, -30), 6.5, '#52525b');
  } else if (biome === 'forest_outpost') {
    // Timber cabins, central comm bunker, two guard watchtowers, fuel depot
    addBuildingWithRoof(boxes, ramps, 'cabin_west', -18, -32, 11, 14, getTerrainHeight(biome, -18, -32), 4.8, '#544332');
    addBuildingWithRoof(boxes, ramps, 'cabin_east', 19, -56, 12, 15, getTerrainHeight(biome, 19, -56), 5.2, '#4a3b2c');
    addBuildingWithRoof(boxes, ramps, 'command_lodge', 0, -112, 18, 16, getTerrainHeight(biome, 0, -112), 6.8, '#3f4739');
    addWatchtower(boxes, ramps, 'forest_tower_1', -25, -78, getTerrainHeight(biome, -25, -78), 7.5, '#4b4538');
    addWatchtower(boxes, ramps, 'forest_tower_2', 24, -18, getTerrainHeight(biome, 24, -18), 7.0, '#4b4538');

    barrels.push(
      { id: 'f_brl_1', x: -10, y: getTerrainHeight(biome, -10, -34), z: -34, exploded: false },
      { id: 'f_brl_2', x: 11, y: getTerrainHeight(biome, 11, -58), z: -58, exploded: false },
      { id: 'f_brl_3', x: -5, y: getTerrainHeight(biome, -5, -100), z: -100, exploded: false },
      { id: 'f_brl_4', x: 18, y: getTerrainHeight(biome, 18, -114), z: -114, exploded: false }
    );
  } else if (biome === 'desert_base') {
    // Fortified sandstone barracks, perimeter concrete walls, radar compound, high tower
    boxes.push(
      makeBox('wall_front_l', -18, 4, 20, 1.4, getTerrainHeight(biome, -18, 4) - 0.5, 2.8, '#a68b65', 'concrete', true, true),
      makeBox('wall_front_r', 18, 4, 20, 1.4, getTerrainHeight(biome, 18, 4) - 0.5, 2.8, '#a68b65', 'concrete', true, true)
    );
    addBuildingWithRoof(boxes, ramps, 'barracks_1', -20, -45, 14, 18, getTerrainHeight(biome, -20, -45), 5.5, '#9e825c');
    addBuildingWithRoof(boxes, ramps, 'hangar_main', 18, -68, 16, 22, getTerrainHeight(biome, 18, -68), 6.8, '#8a7250');
    addBuildingWithRoof(boxes, ramps, 'citadel_hq', -2, -132, 22, 18, getTerrainHeight(biome, -2, -132), 8.2, '#7d6647');
    addWatchtower(boxes, ramps, 'desert_tower_n', 26, -122, getTerrainHeight(biome, 26, -122), 8.5, '#78664e');
    addWatchtower(boxes, ramps, 'desert_tower_s', -27, -8, getTerrainHeight(biome, -27, -8), 7.2, '#78664e');

    barrels.push(
      { id: 'd_brl_1', x: -9, y: getTerrainHeight(biome, -9, -44), z: -44, exploded: false },
      { id: 'd_brl_2', x: 8, y: getTerrainHeight(biome, 8, -66), z: -66, exploded: false },
      { id: 'd_brl_3', x: -12, y: getTerrainHeight(biome, -12, -120), z: -120, exploded: false },
      { id: 'd_brl_4', x: 24, y: getTerrainHeight(biome, 24, -18), z: -18, exploded: false }
    );
  } else if (biome === 'industrial_harbor') {
    // Colorful stacked shipping containers, elevated crane catwalks, port warehouses
    const containerColors = ['#991b1b', '#1e40af', '#065f46', '#b45309', '#374151'];
    const stacks: [number, number, number][] = [
      [-18, -18, 1],
      [-18, -22, 2],
      [16, -24, 1],
      [16, -28, 2],
      [-6, -54, 1],
      [20, -78, 2],
      [-22, -88, 1],
      [8, -96, 1],
    ];
    stacks.forEach(([sx, sz, tiers], idx) => {
      for (let t = 0; t < tiers; t++) {
        boxes.push(
          makeBox(
            `container_${idx}_${t}`,
            sx,
            sz,
            3.2,
            9.5,
            t * 3.1,
            3.05,
            containerColors[(idx + t) % containerColors.length],
            'metal',
            true,
            true
          )
        );
      }
    });
    addBuildingWithRoof(boxes, ramps, 'warehouse_alpha', -22, -55, 14, 20, 0, 6.2, '#334155');
    addBuildingWithRoof(boxes, ramps, 'harbor_control', 2, -134, 20, 16, 0, 8.5, '#1e293b');
    addWatchtower(boxes, ramps, 'crane_gantry_e', 26, -50, 0, 9.2, '#b45309');
    addWatchtower(boxes, ramps, 'crane_gantry_w', -26, -122, 0, 9.2, '#b45309');

    barrels.push(
      { id: 'h_brl_1', x: -12, y: 0, z: -20, exploded: false },
      { id: 'h_brl_2', x: 11, y: 0, z: -52, exploded: false },
      { id: 'h_brl_3', x: -2, y: 0, z: -96, exploded: false },
      { id: 'h_brl_4', x: 10, y: 0, z: -124, exploded: false }
    );
  } else if (biome === 'mountain_frontier') {
    // Concrete alpine bunkers, observation towers, long snow ridge sightlines out to -190
    addBuildingWithRoof(boxes, ramps, 'bunker_south', -16, -34, 13, 12, getTerrainHeight(biome, -16, -34), 4.2, '#475569');
    addBuildingWithRoof(boxes, ramps, 'bunker_mid', 18, -78, 15, 14, getTerrainHeight(biome, 18, -78), 4.8, '#334155');
    addBuildingWithRoof(boxes, ramps, 'glacier_station', 0, -148, 22, 16, getTerrainHeight(biome, 0, -148), 7.2, '#1e293b');
    addWatchtower(boxes, ramps, 'alpine_post_w', -26, -98, getTerrainHeight(biome, -26, -98), 8.0, '#334155');
    addWatchtower(boxes, ramps, 'alpine_post_e', 25, -24, getTerrainHeight(biome, 25, -24), 7.2, '#334155');

    barrels.push(
      { id: 'm_brl_1', x: -8, y: getTerrainHeight(biome, -8, -34), z: -34, exploded: false },
      { id: 'm_brl_2', x: 9, y: getTerrainHeight(biome, 9, -78), z: -78, exploded: false },
      { id: 'm_brl_3', x: -10, y: getTerrainHeight(biome, -10, -142), z: -142, exploded: false }
    );
  } else if (biome === 'urban_district') {
    // Multi-level skyscrapers / accessible rooftops, street cover vehicles, glass skybridge feel
    addBuildingWithRoof(boxes, ramps, 'office_west_1', -22, -26, 15, 18, 0, 6.5, '#334155');
    addBuildingWithRoof(boxes, ramps, 'office_east_1', 22, -36, 15, 18, 0, 7.5, '#27272a');
    addBuildingWithRoof(boxes, ramps, 'plaza_pavilion', -4, -72, 14, 14, 0, 4.5, '#3f3f46');
    addBuildingWithRoof(boxes, ramps, 'meridian_tower_annex', -22, -108, 16, 20, 0, 9.0, '#1e293b');
    addBuildingWithRoof(boxes, ramps, 'meridian_penthouse', 8, -138, 24, 18, 0, 10.0, '#18181b');
    addWatchtower(boxes, ramps, 'rooftop_scaffolding', 26, -92, 0, 8.5, '#52525b');

    barrels.push(
      { id: 'u_brl_1', x: -8, y: 0, z: -28, exploded: false },
      { id: 'u_brl_2', x: 10, y: 0, z: -72, exploded: false },
      { id: 'u_brl_3', x: -6, y: 0, z: -126, exploded: false }
    );
  }

  // Scatter waist-high tactical cover blocks along mid-field so patrols can take cover
  const midCovers: [number, number][] = [
    [-8, -14],
    [9, -18],
    [0, -44],
    [-12, -66],
    [13, -88],
    [-4, -84],
    [6, -110],
  ];
  midCovers.forEach(([cx, cz], idx) => {
    const gy = getTerrainHeight(biome, cx, cz);
    boxes.push(
      makeBox(
        `mid_cover_${idx}`,
        cx + ((seedOffset % 3) - 1) * 1.2,
        cz,
        3.4,
        1.1,
        gy - 0.3,
        1.35,
        biome === 'desert_base' ? '#927852' : '#475569',
        'concrete',
        true,
        true
      )
    );
  });

  // Scatter instanced trees & boulders outside structure footprints
  if (palette.treeType !== 'none') {
    for (let i = 0; i < 68; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const tx = side * (30 + ((i * 17) % 45));
      const tz = 85 - ((i * 29) % 300);
      const ty = getTerrainHeight(biome, tx, tz);
      const hScale = 0.85 + ((i * 13) % 10) * 0.08;
      trees.push({
        x: tx,
        y: ty,
        z: tz,
        scale: [hScale, hScale * (palette.treeType === 'desert_scrub' ? 0.45 : 1.15), hScale],
        rotY: (i * 1.7) % 6.28,
        color:
          palette.treeType === 'snow_pine'
            ? '#cbd5e1'
            : palette.treeType === 'desert_scrub'
            ? '#6d6846'
            : '#234229',
      });
    }
  }

  for (let r = 0; r < 34; r++) {
    const rx = (r % 2 === 0 ? -1 : 1) * (24 + ((r * 23) % 42));
    const rz = 75 - ((r * 37) % 280);
    const ry = getTerrainHeight(biome, rx, rz);
    rocks.push({
      x: rx,
      y: ry - 0.25,
      z: rz,
      scale: [1.5 + (r % 4) * 0.6, 1.0 + (r % 3) * 0.5, 1.4 + (r % 5) * 0.5],
      rotY: r * 0.9,
      color: biome === 'desert_base' ? '#9c7c54' : biome === 'mountain_frontier' ? '#94a3b8' : '#57534e',
    });
  }

  return {
    biome,
    palette,
    boxes,
    ramps,
    trees,
    rocks,
    barrels,
    signs,
  };
}

/**
 * Computes walkable floor elevation at (x, z) taking terrain, walkable building/container roofs,
 * and inclined ramps into account with smooth step-up clearance.
 */
export function getSupportFloorHeight(
  world: GeneratedWorld,
  x: number,
  z: number,
  currentFeetY: number
): number {
  let bestY = getTerrainHeight(world.biome, x, z);

  for (let i = 0; i < world.ramps.length; i++) {
    const r = world.ramps[i];
    const halfW = r.width / 2;
    const halfL = r.length / 2;
    if (x >= r.x - halfW && x <= r.x + halfW && z >= r.z - halfL && z <= r.z + halfL) {
      let t = 0;
      if (r.dir === 'north') {
        t = (r.z + halfL - z) / r.length;
      } else if (r.dir === 'south') {
        t = (z - (r.z - halfL)) / r.length;
      } else if (r.dir === 'east') {
        t = (x - (r.x - halfW)) / r.width;
      } else {
        t = (r.x + halfW - x) / r.width;
      }
      t = Math.max(0, Math.min(1, t));
      const rampY = r.yBottom + t * (r.yTop - r.yBottom);
      if (rampY <= currentFeetY + 1.15 && rampY > bestY) {
        bestY = rampY;
      }
    }
  }

  for (let i = 0; i < world.boxes.length; i++) {
    const b = world.boxes[i];
    if (!b.walkableTop) continue;
    if (x >= b.minX - 0.25 && x <= b.maxX + 0.25 && z >= b.minZ - 0.25 && z <= b.maxZ + 0.25) {
      if (b.maxY <= currentFeetY + 1.05 && b.maxY > bestY) {
        bestY = b.maxY;
      }
    }
  }

  return bestY;
}

/**
 * Resolves horizontal cylinder-vs-AABB collisions for player/AI characters.
 */
export function resolveHorizontalCollision(
  world: GeneratedWorld,
  nextX: number,
  nextZ: number,
  feetY: number,
  radius = 0.48
): { x: number; z: number } {
  let x = Math.max(-72, Math.min(72, nextX));
  let z = Math.max(-215, Math.min(92, nextZ));

  for (let i = 0; i < world.boxes.length; i++) {
    const b = world.boxes[i];
    // Ignore boxes that are below knee step height or overhead roofs above head height
    if (b.maxY <= feetY + 0.75 || b.minY >= feetY + 1.75) continue;

    const closestX = Math.max(b.minX, Math.min(x, b.maxX));
    const closestZ = Math.max(b.minZ, Math.min(z, b.maxZ));
    const dx = x - closestX;
    const dz = z - closestZ;
    const distSq = dx * dx + dz * dz;

    if (distSq < radius * radius) {
      if (distSq > 0.00001) {
        const dist = Math.sqrt(distSq);
        const push = radius - dist;
        x += (dx / dist) * push;
        z += (dz / dist) * push;
      } else {
        // Inside AABB center fallback push out nearest side
        x = b.maxX + radius;
      }
    }
  }

  return { x, z };
}

/**
 * Slab-method ray-vs-AABB intersection returning parametric `t` in [0, 1] along segment A -> B.
 */
export function segmentIntersectsAABB(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  box: WorldBox
): number | null {
  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;

  let tmin = 0;
  let tmax = 1;

  if (Math.abs(dx) < 1e-8) {
    if (ax < box.minX || ax > box.maxX) return null;
  } else {
    const inv = 1 / dx;
    let t1 = (box.minX - ax) * inv;
    let t2 = (box.maxX - ax) * inv;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }

  if (Math.abs(dy) < 1e-8) {
    if (ay < box.minY || ay > box.maxY) return null;
  } else {
    const inv = 1 / dy;
    let t1 = (box.minY - ay) * inv;
    let t2 = (box.maxY - ay) * inv;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }

  if (Math.abs(dz) < 1e-8) {
    if (az < box.minZ || az > box.maxZ) return null;
  } else {
    const inv = 1 / dz;
    let t1 = (box.minZ - az) * inv;
    let t2 = (box.maxZ - az) * inv;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }

  return tmin;
}

/**
 * Checks whether a 3D line segment hits any solid world collider or terrain.
 * Used both for projectile wall impacts and for AI line-of-sight wall occlusion.
 */
export function castWorldSegment(
  world: GeneratedWorld,
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  sightOnly = false
): { hit: boolean; t: number; point: [number, number, number]; material: WorldBox['materialType'] } | null {
  let closestT = 1.001;
  let hitMat: WorldBox['materialType'] = 'concrete';

  for (let i = 0; i < world.boxes.length; i++) {
    const box = world.boxes[i];
    if (sightOnly && !box.blocksSight) continue;
    const t = segmentIntersectsAABB(ax, ay, az, bx, by, bz, box);
    if (t !== null && t < closestT) {
      closestT = t;
      hitMat = box.materialType;
    }
  }

  // Coarse terrain check along segment
  const steps = 6;
  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    if (t >= closestT) break;
    const px = ax + (bx - ax) * t;
    const py = ay + (by - ay) * t;
    const pz = az + (bz - az) * t;
    const groundY = getTerrainHeight(world.biome, px, pz);
    if (py <= groundY) {
      closestT = t;
      hitMat = 'rock';
      break;
    }
  }

  if (closestT <= 1.0) {
    return {
      hit: true,
      t: closestT,
      point: [ax + (bx - ax) * closestT, ay + (by - ay) * closestT, az + (bz - az) * closestT],
      material: hitMat,
    };
  }
  return null;
}
