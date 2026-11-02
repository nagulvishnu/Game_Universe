// Lightweight Phase 5A roster tests. No test framework: plain asserts,
// bundled with the esbuild already shipped inside Vite, then run by Node.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ROSTER, CANONICAL_IDS, LEGACY_TO_CANONICAL, TRAIT_IDS, rosterStatus, validateRoster, validateMechanimoDef, validateInstance, createInstance, getMechanimo, canonicalIdFor } from '../src/game/roster';
import type { MechanimoDef } from '../src/game/roster';
import { SPECIES, CARD_IDS } from '../src/game/data';
import type { SpeciesId } from '../src/game/types';

// ---- 1. exactly 30 unique canonical IDs ----
assert.strictEqual(ROSTER.length, 30, 'roster must contain exactly 30 entries');
const ids = ROSTER.map((d) => d.id);
assert.strictEqual(new Set(ids).size, 30, 'all canonical ids must be unique');
for (const id of CANONICAL_IDS) assert.ok(ids.includes(id), `missing canonical id ${id}`);
validateRoster(); // full validator pass

// ---- 2. no duplicate species definitions (names may not fork identities) ----
const legacyIds = Object.values(LEGACY_TO_CANONICAL);
assert.strictEqual(new Set(legacyIds).size, 6, 'legacy mapping must be 1:1 onto six distinct canonical ids');
const legacyNames = new Set<string>();
for (const d of ROSTER) {
  if (d.status !== 'defined') continue;
  assert.ok(!legacyNames.has(d.name), `duplicate defined species name: ${d.name}`);
  legacyNames.add(d.name);
}

// ---- 3. every ability reference resolves ----
for (const d of ROSTER) {
  assert.ok(TRAIT_IDS.includes(d.trait), `${d.id} trait must resolve: ${d.trait}`);
  assert.ok(d.compatibleCards.length > 0, `${d.id} must support at least one card`);
  for (const c of d.compatibleCards) {
    assert.ok(CARD_IDS.includes(c), `${d.id} card must resolve: ${c}`);
  }
}

// ---- 4. every ownership/location reference resolves ----
const owners = [
  'wild' as const,
  'player' as const,
  { kind: 'rival' as const, name: 'VEX' },
  { kind: 'faction' as const, id: 'x' },
];
for (const d of ROSTER) {
  if (d.status === 'scaffold') continue; // faction ids are Phase 5B canon
  for (const o of owners) {
    if (typeof o === 'object' && o.kind === 'faction') continue;
    const inst = createInstance(d.id, o, o === 'player' ? 1 : undefined, o === 'player' ? 1 : undefined);
    assert.strictEqual(inst.speciesId, d.id, 'instance keeps the canonical identity');
    assert.strictEqual(getMechanimo(inst.speciesId)?.id, d.id, 'instance resolves back to roster');
    validateInstance(inst);
  }
}

// ---- 5. invalid stats and unknown IDs are rejected ----
const base: MechanimoDef = { ...ROSTER[0] };
assert.throws(() => validateMechanimoDef({ ...base, hp: 49 }), /hp out of range/);
assert.throws(() => validateMechanimoDef({ ...base, hp: 301 }), /hp out of range/);
assert.throws(() => validateMechanimoDef({ ...base, atk: 0.4 }), /atk out of range/);
assert.throws(() => validateMechanimoDef({ ...base, atk: 2.1 }), /atk out of range/);
assert.throws(() => validateMechanimoDef({ ...base, rarity: 4 as 1 }), /invalid rarity/);
assert.throws(() => validateMechanimoDef({ ...base, role: 'heal' as 'attack' }), /invalid role/);
assert.throws(() => validateMechanimoDef({ ...base, trait: 'lifesteal' as 'fury' }), /unknown trait/);
assert.throws(() => validateMechanimoDef({ ...base, compatibleCards: ['soulswap' as 'ram'] }), /unknown card/);
assert.throws(() => validateRoster([...ROSTER.slice(0, 29)]), /exactly 30/);
assert.throws(() => validateRoster([...ROSTER.slice(1)]), /exactly 30/);
assert.throws(() => validateRoster([...ROSTER, { ...ROSTER[0] }]), /exactly 30/);
const dupRoster = [...ROSTER];
dupRoster[6] = { ...dupRoster[6], id: dupRoster[0].id };
assert.throws(() => validateRoster(dupRoster), /duplicate canonical id|missing canonical id/);
assert.throws(() => createInstance('m31', 'wild'), /unknown species/);
assert.throws(() => createInstance('blaze', 'wild'), /unknown species/); // raw legacy name is not a canonical id
assert.throws(() => validateInstance({ speciesId: ROSTER[0].id, owner: 'wild', location: 'vault', discovered: false }), /unknown location/);
assert.throws(() => validateInstance({ speciesId: ROSTER[0].id, owner: { kind: 'rival', name: 'ZORB' }, location: 'world', discovered: false }), /unknown rival/);
assert.throws(() => validateInstance({ speciesId: ROSTER[0].id, owner: 'wild', location: 'world', discovered: false, uid: 9 }), /uid only allowed/);

// ---- 6. ownership/spawn never creates new identities ----
for (const s of Object.keys(SPECIES) as SpeciesId[]) {
  const cid = canonicalIdFor(s);
  const again = createInstance(cid, { kind: 'rival', name: 'JUNO' });
  assert.strictEqual(again.speciesId, cid, 'spawning under a rival must reuse the identity');
  const asPlayer = createInstance(cid, 'player', 7, 3);
  assert.strictEqual(asPlayer.speciesId, cid, 'ownership transfer must reuse the identity');
}
// two wild spawns of the same species share one identity
const a = createInstance(canonicalIdFor('blaze'), 'wild');
const b = createInstance(canonicalIdFor('blaze'), 'wild');
assert.strictEqual(a.speciesId, b.speciesId, 'two spawns of one species must not fork identity');

// ---- 7. legacy prototype species still resolve end-to-end ----
for (const s of Object.keys(SPECIES) as SpeciesId[]) {
  const def = getMechanimo(canonicalIdFor(s));
  assert.ok(def, `legacy species ${s} must map into the roster`);
  assert.strictEqual(def.name, SPECIES[s].name, 'legacy display name preserved');
  assert.strictEqual(def.hp, SPECIES[s].hp, 'legacy hp preserved');
  assert.strictEqual(def.atk, SPECIES[s].atk, 'legacy atk preserved');
  assert.strictEqual(def.trait, SPECIES[s].trait, 'legacy trait preserved');
  assert.strictEqual(def.rarity, SPECIES[s].rarity, 'legacy rarity preserved');
}
const st = rosterStatus();
assert.strictEqual(st.total, 30, 'status total');
assert.strictEqual(st.defined, 6, 'six legacy species defined');
assert.strictEqual(st.scaffold, 24, '24 scaffold entries');

// ---- 8. save compatibility: score save shape untouched by this phase ----
const scoresSrc = readFileSync(join(process.cwd(), 'src', 'ui', 'scores.ts'), 'utf8');
assert.ok(scoresSrc.includes("'mechanimos_hiscores_v1'"), 'hiscore key must stay stable');
const engineSrc = readFileSync(join(process.cwd(), 'src', 'game', 'engine.ts'), 'utf8');
assert.ok(engineSrc.includes("'mech_best'"), 'best-score key must stay stable');
assert.ok(!/\bROSTER\b|roster/.test(scoresSrc), 'scores module must not depend on the roster');

console.log('PASS roster tests: 8/8 groups', JSON.stringify(st));
