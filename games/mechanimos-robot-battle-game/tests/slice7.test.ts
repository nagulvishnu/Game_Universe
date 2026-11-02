// Phase 7 — focused tests for state transitions and card-lock invariant.
import assert from 'node:assert';
import { makeSliceState, canTransition } from '../src/proto3d/sliceState';
import { BattleBridge } from '../src/proto3d/battleBridge';
import { SPECIES } from '../src/game/data';
import type { CardId } from '../src/game/types';

// ---- 1. Initial state ----
const s0 = makeSliceState();
assert.strictEqual(s0.phase, 'explore', 'initial phase is explore');
assert.strictEqual(s0.lockedCards, null, 'no cards locked initially');
assert.strictEqual(s0.encounterCooldown, false, 'no cooldown initially');

// ---- 2. Legal transitions ----
const s1 = makeSliceState();
assert.ok(canTransition(s1, 'encounterIntro'), 'explore -> encounterIntro allowed');
assert.ok(!canTransition(s1, 'toRobot'), 'explore -> toRobot not allowed directly');
assert.ok(!canTransition(s1, 'battle'), 'explore -> battle not allowed directly');
assert.ok(!canTransition(s1, 'battleResult'), 'explore -> battleResult not allowed');
assert.ok(!canTransition(s1, 'toCar'), 'explore -> toCar not allowed');

s1.phase = 'encounterIntro';
assert.ok(canTransition(s1, 'toRobot'), 'encounterIntro -> toRobot allowed');
assert.ok(canTransition(s1, 'explore'), 'encounterIntro -> explore (cancel) allowed');
assert.ok(!canTransition(s1, 'battle'), 'encounterIntro -> battle not allowed directly');

s1.phase = 'toRobot';
assert.ok(canTransition(s1, 'battle'), 'toRobot -> battle allowed');
assert.ok(!canTransition(s1, 'explore'), 'toRobot -> explore not allowed');

s1.phase = 'battle';
assert.ok(canTransition(s1, 'battleResult'), 'battle -> battleResult allowed');
assert.ok(!canTransition(s1, 'toCar'), 'battle -> toCar not allowed directly');

s1.phase = 'battleResult';
assert.ok(canTransition(s1, 'toCar'), 'battleResult -> toCar allowed');
assert.ok(!canTransition(s1, 'explore'), 'battleResult -> explore not allowed directly');

s1.phase = 'toCar';
assert.ok(canTransition(s1, 'explore'), 'toCar -> explore allowed');
assert.ok(!canTransition(s1, 'battle'), 'toCar -> battle not allowed');

// ---- 3. Encounter cooldown blocks re-trigger ----
const s2 = makeSliceState();
s2.encounterCooldown = true;
assert.ok(!canTransition(s2, 'encounterIntro'), 'cooldown blocks encounterIntro');
s2.encounterCooldown = false;
assert.ok(canTransition(s2, 'encounterIntro'), 'no cooldown allows encounterIntro');

// ---- 4. BattleBridge: card-lock invariant ----
const bridge = new BattleBridge(SPECIES['blaze'], 3, SPECIES['ferrion'], 3);

assert.throws(() => bridge.lockCards(['ram', 'punch'] as CardId[]), /exactly 3/, '2 cards rejected');
assert.throws(() => bridge.lockCards(['ram', 'punch', 'volt', 'flame'] as CardId[]), /exactly 3/, '4 cards rejected');

const cards: CardId[] = ['ram', 'punch', 'volt'];
bridge.lockCards(cards);
assert.deepStrictEqual(bridge.lockedCards, cards, 'locked cards stored correctly');

assert.throws(() => bridge.lockCards(['flame', 'aegis', 'nanite'] as CardId[]), /already locked/, 'double-lock rejected');

// ---- 5. Card reuse: same card can be played again after cooldown ----
bridge.beginPlayerTurn();
assert.ok(bridge.playerTurn, 'player turn active after beginPlayerTurn');

const r1 = bridge.playCard(0);
assert.ok(!bridge.playerTurn, 'player turn ends after playing');
assert.strictEqual(bridge.cooldowns[0], 2, 'card 0 on cooldown 2');
assert.ok(!r1.battleOver || r1.playerWon !== undefined, 'result has valid battleOver');

if (!r1.battleOver) {
  bridge.opponentTurn();
  bridge.beginPlayerTurn();
  assert.strictEqual(bridge.cooldowns[0], 1, 'cooldown ticked to 1');
  const r2 = bridge.playCard(0);
  assert.deepStrictEqual(r2.events, [], 'cannot play card on cooldown');
  const r3 = bridge.playCard(1);
  assert.ok(r3.events.length > 0 || bridge.over, 'card 1 played or battle over');
}

// ---- 6. Card reuse after full cooldown cycle ----
const bridge2 = new BattleBridge(SPECIES['aquella'], 5, SPECIES['terradon'], 2);
bridge2.lockCards(['ram', 'aegis', 'nanite'] as CardId[]);
bridge2.beginPlayerTurn();
bridge2.playCard(0);
if (!bridge2.over) {
  bridge2.opponentTurn();
  bridge2.beginPlayerTurn();
  bridge2.playCard(1);
  if (!bridge2.over) {
    bridge2.opponentTurn();
    bridge2.beginPlayerTurn();
    assert.strictEqual(bridge2.cooldowns[0], 0, 'ram cooldown expired after 2 turns');
    const r = bridge2.playCard(0);
    assert.ok(r.events.length > 0 || bridge2.over, 'ram reused successfully');
  }
}

// ---- 7. Locked cards unchanged throughout battle ----
const bridge3 = new BattleBridge(SPECIES['voltox'], 2, SPECIES['nimbra'], 2);
const lockedSet: CardId[] = ['volt', 'flame', 'aegis'];
bridge3.lockCards(lockedSet);
const snapBefore = [...bridge3.lockedCards!];
for (let turn = 0; turn < 6 && !bridge3.over; turn++) {
  bridge3.beginPlayerTurn();
  if (bridge3.playerTurn) {
    const avail = bridge3.cooldowns.findIndex((cd) => cd === 0);
    if (avail >= 0) bridge3.playCard(avail);
  }
  if (!bridge3.over) bridge3.opponentTurn();
}
assert.deepStrictEqual(bridge3.lockedCards, snapBefore, 'locked cards unchanged after battle turns');

// ---- 8. Victory / defeat detection ----
const bridge4 = new BattleBridge(SPECIES['blaze'], 1, SPECIES['ferrion'], 10);
bridge4.lockCards(['ram', 'punch', 'volt'] as CardId[]);
bridge4.player.hp = 1;
bridge4.beginPlayerTurn();
bridge4.playCard(0);
if (!bridge4.over) {
  const oppResult = bridge4.opponentTurn();
  if (oppResult.battleOver) {
    assert.strictEqual(oppResult.playerWon, false, 'defeat detected correctly');
    assert.ok(oppResult.events.some((e) => e.kind === 'defeat'), 'defeat event emitted');
  }
}

console.log('PASS slice7 tests: 8/8 groups');
