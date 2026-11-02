// Canonical roster: exactly 30 unique Mechanimo identities (Phase 5A).
// Species identity is separated from ownership/location/discovery state.
// The six legacy prototype species (SPECIES in data.ts) are mapped onto
// canonical ids via LEGACY_TO_CANONICAL; legacy data is never deleted.

import { SPECIES, CARD_IDS, TRAINER_NAMES } from './data';
import type { CardId, CrestId, SpeciesId, TraitId } from './types';

export const CANONICAL_IDS = [
  'm01', 'm02', 'm03', 'm04', 'm05', 'm06',
  'm07', 'm08', 'm09', 'm10', 'm11', 'm12',
  'm13', 'm14', 'm15', 'm16', 'm17', 'm18',
  'm19', 'm20', 'm21', 'm22', 'm23', 'm24',
  'm25', 'm26', 'm27', 'm28', 'm29', 'm30',
] as const;

export type MechanimoId = (typeof CANONICAL_IDS)[number];

export const TRAIT_IDS: TraitId[] = ['fury', 'static', 'plating', 'phase', 'crit', 'regen'];

export type CombatRole = 'attack' | 'defense' | 'stamina' | 'balanced';

export type DiscoveryCategory = 'common' | 'uncommon' | 'rare';

export type DiscoveryMode = 'wild' | 'trainer';

export interface DiscoveryCondition {
  mode: DiscoveryMode;
  winsRequired: number;
}

export interface CarFormVisual {
  body: string;
  dark: string;
  accent: string;
  glass: string;
}

export interface RobotFormVisual {
  crest: CrestId;
}

export interface Visuals {
  carForm: CarFormVisual;
  robotForm: RobotFormVisual;
}

export interface TransformMeta {
  style: 'morph';
}

export interface MechanimoDef {
  id: MechanimoId;
  name: string;
  status: 'defined' | 'scaffold';
  role: CombatRole;
  rarity: 1 | 2 | 3;
  discoveryCategory: DiscoveryCategory;
  hp: number;
  atk: number;
  trait: TraitId;
  traitDesc: string;
  compatibleCards: CardId[];
  visuals: Visuals | null;
  transform: TransformMeta | null;
  discovery: DiscoveryCondition;
  legacySpecies: SpeciesId | null;
}

export const LEGACY_TO_CANONICAL: Record<SpeciesId, MechanimoId> = {
  blaze: 'm01',
  voltox: 'm02',
  terradon: 'm03',
  nimbra: 'm04',
  ferrion: 'm05',
  aquella: 'm06',
};

export const CANONICAL_TO_LEGACY: Record<MechanimoId, SpeciesId | null> = {
  m01: 'blaze', m02: 'voltox', m03: 'terradon',
  m04: 'nimbra', m05: 'ferrion', m06: 'aquella',
  m07: null, m08: null, m09: null, m10: null,
  m11: null, m12: null, m13: null, m14: null,
  m15: null, m16: null, m17: null, m18: null,
  m19: null, m20: null, m21: null, m22: null,
  m23: null, m24: null, m25: null, m26: null,
  m27: null, m28: null, m29: null, m30: null,
};

export function canonicalIdFor(species: SpeciesId): MechanimoId {
  return LEGACY_TO_CANONICAL[species];
}

const LEGACY_ROLE: Record<SpeciesId, CombatRole> = {
  blaze: 'attack',
  voltox: 'balanced',
  terradon: 'defense',
  nimbra: 'balanced',
  ferrion: 'attack',
  aquella: 'stamina',
};

function legacyDef(species: SpeciesId): MechanimoDef {
  const sp = SPECIES[species];
  const cat: DiscoveryCategory =
    sp.rarity === 3 ? 'rare' : sp.rarity === 2 ? 'uncommon' : 'common';
  return {
    id: LEGACY_TO_CANONICAL[species],
    name: sp.name,
    status: 'defined',
    role: LEGACY_ROLE[species],
    rarity: sp.rarity as 1 | 2 | 3,
    discoveryCategory: cat,
    hp: sp.hp,
    atk: sp.atk,
    trait: sp.trait,
    traitDesc: sp.traitDesc,
    compatibleCards: [...CARD_IDS],
    visuals: {
      carForm: { body: sp.body, dark: sp.dark, accent: sp.accent, glass: sp.glass },
      robotForm: { crest: sp.crest },
    },
    transform: { style: 'morph' },
    discovery: { mode: 'wild', winsRequired: species === 'ferrion' || species === 'aquella' ? 2 : 0 },
    legacySpecies: species,
  };
}

function scaffoldDef(id: MechanimoId, index: number): MechanimoDef {
  return {
    id,
    name: 'UNASSIGNED',
    status: 'scaffold',
    role: 'balanced',
    rarity: 1,
    discoveryCategory: 'common',
    hp: 100,
    atk: 1.0,
    trait: 'fury',
    traitDesc: 'TBD',
    compatibleCards: [...CARD_IDS],
    visuals: null,
    transform: null,
    discovery: { mode: 'wild', winsRequired: index },
    legacySpecies: null,
  };
}

const definedRoster: MechanimoDef[] = (Object.keys(SPECIES) as SpeciesId[]).map(legacyDef);
const scaffoldRoster: MechanimoDef[] = CANONICAL_IDS.slice(6).map((id, i) => scaffoldDef(id, i + 7));

export const ROSTER: MechanimoDef[] = [...definedRoster, ...scaffoldRoster];

const ROSTER_BY_ID: Map<MechanimoId, MechanimoDef> = new Map(ROSTER.map((d) => [d.id, d]));

export function getMechanimo(id: string): MechanimoDef | undefined {
  return ROSTER_BY_ID.get(id as MechanimoId);
}

export function rosterStatus(): { total: number; defined: number; scaffold: number } {
  const defined = ROSTER.filter((d) => d.status === 'defined').length;
  return { total: ROSTER.length, defined, scaffold: ROSTER.length - defined };
}

export const LOCATION_REFS: string[] = ['world'];
export const FACTION_IDS: string[] = [];

export type OwnerRef =
  | 'wild'
  | 'player'
  | { kind: 'rival'; name: string }
  | { kind: 'faction'; id: string };

export interface MechanimoInstance {
  speciesId: MechanimoId;
  owner: OwnerRef;
  location: string;
  discovered: boolean;
  uid?: number;
  level?: number;
}

const RIVAL_NAMES: Set<string> = new Set(TRAINER_NAMES);

export function validateMechanimoDef(def: MechanimoDef): void {
  if (!CANONICAL_IDS.includes(def.id)) throw new Error(`unknown canonical id: ${def.id}`);
  if (!def.name.trim()) throw new Error(`empty name for ${def.id}`);
  if (def.status !== 'defined' && def.status !== 'scaffold') {
    throw new Error(`invalid status for ${def.id}`);
  }
  if (!['attack', 'defense', 'stamina', 'balanced'].includes(def.role)) {
    throw new Error(`invalid role for ${def.id}: ${def.role}`);
  }
  if (![1, 2, 3].includes(def.rarity)) throw new Error(`invalid rarity for ${def.id}`);
  if (!['common', 'uncommon', 'rare'].includes(def.discoveryCategory)) {
    throw new Error(`invalid discoveryCategory for ${def.id}`);
  }
  if (!Number.isFinite(def.hp) || def.hp < 50 || def.hp > 300) {
    throw new Error(`hp out of range for ${def.id}: ${def.hp}`);
  }
  if (!Number.isFinite(def.atk) || def.atk < 0.5 || def.atk > 2) {
    throw new Error(`atk out of range for ${def.id}: ${def.atk}`);
  }
  if (!TRAIT_IDS.includes(def.trait)) throw new Error(`unknown trait for ${def.id}: ${def.trait}`);
  for (const c of def.compatibleCards) {
    if (!CARD_IDS.includes(c)) throw new Error(`unknown card for ${def.id}: ${c}`);
  }
  if (def.status === 'defined') {
    if (!def.traitDesc.trim()) throw new Error(`missing traitDesc for ${def.id}`);
    if (!def.visuals) throw new Error(`missing visuals for ${def.id}`);
    if (!def.transform) throw new Error(`missing transform for ${def.id}`);
    if (def.legacySpecies && SPECIES[def.legacySpecies].name !== def.name) {
      throw new Error(`name drifted from legacy species for ${def.id}`);
    }
  }
  if (def.discovery.mode !== 'wild' && def.discovery.mode !== 'trainer') {
    throw new Error(`invalid discovery mode for ${def.id}`);
  }
  if (!Number.isInteger(def.discovery.winsRequired) || def.discovery.winsRequired < 0) {
    throw new Error(`invalid winsRequired for ${def.id}`);
  }
}

export function validateRoster(defs: MechanimoDef[] = ROSTER): void {
  if (defs.length !== CANONICAL_IDS.length) {
    throw new Error(`roster must contain exactly ${CANONICAL_IDS.length} entries (got ${defs.length})`);
  }
  const seen = new Set<string>();
  for (const def of defs) {
    if (seen.has(def.id)) throw new Error(`duplicate canonical id: ${def.id}`);
    seen.add(def.id);
    validateMechanimoDef(def);
  }
  for (const id of CANONICAL_IDS) {
    if (!seen.has(id)) throw new Error(`missing canonical id: ${id}`);
  }
}

export function validateInstance(inst: MechanimoInstance): void {
  if (!ROSTER_BY_ID.has(inst.speciesId)) {
    throw new Error(`instance references unknown species: ${inst.speciesId}`);
  }
  if (!LOCATION_REFS.includes(inst.location)) {
    throw new Error(`instance references unknown location: ${inst.location}`);
  }
  const o = inst.owner;
  if (o !== 'wild' && o !== 'player') {
    if (o.kind === 'rival') {
      if (!RIVAL_NAMES.has(o.name)) throw new Error(`instance references unknown rival: ${o.name}`);
    } else if (o.kind === 'faction') {
      if (!FACTION_IDS.includes(o.id)) throw new Error(`instance references unknown faction: ${o.id}`);
    } else {
      throw new Error(`invalid owner for ${inst.speciesId}`);
    }
  }
  const owned = o === 'player';
  if (inst.uid !== undefined && !owned) throw new Error(`uid only allowed on player-owned ${inst.speciesId}`);
  if (inst.level !== undefined && (!owned || inst.level < 1 || inst.level > 99)) {
    throw new Error(`invalid level for ${inst.speciesId}: ${inst.level}`);
  }
}

export function createInstance(speciesId: string, owner: OwnerRef, uid?: number, level?: number): MechanimoInstance {
  const inst: MechanimoInstance = {
    speciesId: speciesId as MechanimoId,
    owner,
    location: 'world',
    discovered: owner === 'player',
    uid,
    level,
  };
  validateInstance(inst);
  return inst;
}

validateRoster();
