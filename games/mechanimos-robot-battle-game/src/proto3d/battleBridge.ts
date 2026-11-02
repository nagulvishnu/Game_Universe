/**
 * Phase 7 — BattleBridge: thin adapter over the existing canonical battle rules.
 *
 * Reuses the exact same dealDamage / card-effect / status logic from BattleScene
 * by extracting the pure-logic parts. The 3D presentation (camera, animations,
 * HP bars) is handled by Proto3DApp; this module owns only the game-state.
 *
 * Card-lock invariant (enforced here):
 *   - Exactly 3 cards are selected before battle and locked for its duration.
 *   - They are NOT consumed on use; they can be replayed subject to cooldown.
 *   - Cooldowns tick by 1 each time the player's turn begins.
 *   - A new selection is only possible after the battle ends.
 */

import { CARDS } from '../game/data';
import type { CardId, SpeciesDef } from '../game/types';

export interface Combatant {
  label: string;
  species: SpeciesDef;
  level: number;
  hp: number;
  maxHp: number;
  burn: number;       // turns remaining
  stun: boolean;
  shield: number;     // 0..1 damage reduction
}

export type BattleEvent =
  | { kind: 'damage';  target: 'player' | 'opponent'; amount: number; crit: boolean; blocked: boolean }
  | { kind: 'miss';    target: 'player' | 'opponent' }
  | { kind: 'heal';    target: 'player' | 'opponent'; amount: number }
  | { kind: 'shield';  target: 'player' | 'opponent' }
  | { kind: 'stun';    target: 'player' | 'opponent' }
  | { kind: 'burn';    target: 'player' | 'opponent' }
  | { kind: 'burnTick'; target: 'player' | 'opponent'; amount: number }
  | { kind: 'stunSkip'; target: 'player' | 'opponent' }
  | { kind: 'victory' }
  | { kind: 'defeat' };

export interface TurnResult {
  events: BattleEvent[];
  battleOver: boolean;
  playerWon: boolean | null;
}

function rand(lo: number, hi: number): number {
  return lo + Math.random() * (hi - lo);
}

function makeCombatant(species: SpeciesDef, level: number, label: string): Combatant {
  const maxHp = Math.round(species.hp + (level - 1) * 7);
  return { label, species, level, hp: maxHp, maxHp, burn: 0, stun: false, shield: 0 };
}

/** Pure damage calculation — identical logic to BattleScene.dealDamage. */
function calcDamage(
  atk: Combatant, def: Combatant,
  base: number, acc: number, stunChance: number, burns: boolean,
): { dmg: number; dodged: boolean; crit: boolean; blocked: boolean; stunned: boolean; burned: boolean } {
  if (Math.random() > acc) return { dmg: 0, dodged: true, crit: false, blocked: false, stunned: false, burned: false };
  if (def.species.trait === 'phase' && Math.random() < 0.16) return { dmg: 0, dodged: true, crit: false, blocked: false, stunned: false, burned: false };

  const atkScale = (1 + (atk.level - 1) * 0.05) * atk.species.atk;
  let dmg = base * atkScale * rand(0.9, 1.12);
  let crit = false;
  if (atk.species.trait === 'fury') dmg *= 1.15;
  if (atk.species.trait === 'crit' && Math.random() < 0.22) { crit = true; dmg *= 2; }
  if (def.species.trait === 'plating') dmg *= 0.85;
  let blocked = false;
  if (def.shield > 0) { blocked = true; dmg *= 1 - def.shield; def.shield = 0; }
  const finalDmg = Math.max(2, Math.round(dmg));
  def.hp = Math.max(0, def.hp - finalDmg);

  let sc = stunChance;
  if (atk.species.trait === 'static') sc += 0.2;
  const stunned = sc > 0 && Math.random() < sc && def.hp > 0;
  if (stunned) def.stun = true;
  const burned = burns && def.hp > 0;
  if (burned) def.burn = 2;

  return { dmg: finalDmg, dodged: false, crit, blocked, stunned, burned };
}

/** AI card picker — same table as BattleScene.pickEnemyCard. */
function pickAiCard(foe: Combatant): CardId {
  const low = foe.hp / foe.maxHp < 0.32;
  if (low && Math.random() < 0.4) return 'nanite';
  const table: Record<string, CardId[]> = {
    blaze:    ['flame', 'ram', 'punch', 'ram'],
    voltox:   ['volt', 'volt', 'ram', 'punch'],
    terradon: ['aegis', 'ram', 'punch', 'ram'],
    nimbra:   ['punch', 'volt', 'ram', 'punch'],
    ferrion:  ['punch', 'punch', 'ram', 'flame'],
    aquella:  ['nanite', 'ram', 'volt', 'punch'],
  };
  const list = table[foe.species.id] ?? ['ram', 'punch'];
  return list[Math.floor(Math.random() * list.length)];
}

function executeCard(cardId: CardId, atk: Combatant, def: Combatant, events: BattleEvent[], target: 'player' | 'opponent') {
  const card = CARDS[cardId];
  if (card.kind === 'heal') {
    const before = atk.hp;
    atk.hp = Math.min(atk.maxHp, atk.hp + card.power);
    events.push({ kind: 'heal', target: target === 'player' ? 'opponent' : 'player', amount: atk.hp - before });
    return;
  }
  if (card.kind === 'defense') {
    atk.shield = 0.75;
    const before = atk.hp;
    atk.hp = Math.min(atk.maxHp, atk.hp + 6);
    events.push({ kind: 'shield', target: target === 'player' ? 'opponent' : 'player' });
    if (atk.hp > before) events.push({ kind: 'heal', target: target === 'player' ? 'opponent' : 'player', amount: atk.hp - before });
    return;
  }
  // attacks
  let acc = 1, stunChance = 0, burns = false;
  if (cardId === 'punch') acc = 0.8;
  if (cardId === 'volt') stunChance = 0.45;
  if (cardId === 'flame') burns = true;
  const r = calcDamage(atk, def, card.power, acc, stunChance, burns);
  if (r.dodged) { events.push({ kind: 'miss', target }); return; }
  events.push({ kind: 'damage', target, amount: r.dmg, crit: r.crit, blocked: r.blocked });
  if (r.stunned) events.push({ kind: 'stun', target });
  if (r.burned) events.push({ kind: 'burn', target });
}

function startOfTurnTicks(b: Combatant, target: 'player' | 'opponent', events: BattleEvent[]): boolean {
  // regen
  if (b.species.trait === 'regen' && b.hp > 0 && b.hp < b.maxHp) {
    b.hp = Math.min(b.maxHp, b.hp + 4);
    events.push({ kind: 'heal', target, amount: 4 });
  }
  // burn
  if (b.burn > 0 && b.hp > 0) {
    b.burn--;
    b.hp = Math.max(0, b.hp - 6);
    events.push({ kind: 'burnTick', target, amount: 6 });
    if (b.hp <= 0) return true; // battle over
  }
  // stun
  if (b.stun && b.hp > 0) {
    b.stun = false;
    events.push({ kind: 'stunSkip', target });
    return true; // skip turn
  }
  return false;
}

export class BattleBridge {
  readonly player: Combatant;
  readonly opponent: Combatant;
  /** Locked cards — set once via lockCards(), never changed until battle ends. */
  private _lockedCards: CardId[] | null = null;
  private _cooldowns: [number, number, number] = [0, 0, 0];
  private _playerTurn = false;
  private _over = false;
  private _playerWon: boolean | null = null;

  constructor(
    playerSpecies: SpeciesDef,
    playerLevel: number,
    opponentSpecies: SpeciesDef,
    opponentLevel: number,
  ) {
    this.player = makeCombatant(playerSpecies, playerLevel, playerSpecies.name);
    this.opponent = makeCombatant(opponentSpecies, opponentLevel, `SENTINEL-X`);
  }

  get lockedCards(): CardId[] | null { return this._lockedCards; }
  get cooldowns(): [number, number, number] { return [...this._cooldowns] as [number, number, number]; }
  get playerTurn(): boolean { return this._playerTurn; }
  get over(): boolean { return this._over; }
  get playerWon(): boolean | null { return this._playerWon; }

  /**
   * Lock exactly 3 cards for the battle.
   * Must be called before beginPlayerTurn(). Throws if already locked or wrong count.
   */
  lockCards(cards: CardId[]): void {
    if (this._lockedCards !== null) throw new Error('Cards already locked for this battle');
    if (cards.length !== 3) throw new Error(`Must select exactly 3 cards (got ${cards.length})`);
    this._lockedCards = [...cards];
    this._cooldowns = [0, 0, 0];
  }

  /** Begin the player's turn: tick cooldowns, apply start-of-turn effects. Returns events. */
  beginPlayerTurn(): TurnResult {
    if (this._over || !this._lockedCards) return { events: [], battleOver: false, playerWon: null };
    // tick cooldowns
    for (let i = 0; i < 3; i++) this._cooldowns[i] = Math.max(0, this._cooldowns[i] - 1);
    const events: BattleEvent[] = [];
    const skip = startOfTurnTicks(this.player, 'player', events);
    if (this.player.hp <= 0) {
      this._over = true; this._playerWon = false;
      events.push({ kind: 'defeat' });
      return { events, battleOver: true, playerWon: false };
    }
    if (!skip) this._playerTurn = true;
    return { events, battleOver: false, playerWon: null };
  }

  /**
   * Player plays a card by index (0–2).
   * Cards are NOT consumed — they can be replayed when cooldown reaches 0.
   * Returns the turn result including all events.
   */
  playCard(idx: number): TurnResult {
    if (this._over || !this._playerTurn || !this._lockedCards) return { events: [], battleOver: false, playerWon: null };
    if (idx < 0 || idx > 2) return { events: [], battleOver: false, playerWon: null };
    if (this._cooldowns[idx] > 0) return { events: [], battleOver: false, playerWon: null };

    this._playerTurn = false;
    this._cooldowns[idx] = 2; // 2-turn cooldown, same as BattleScene

    const events: BattleEvent[] = [];
    executeCard(this._lockedCards[idx], this.player, this.opponent, events, 'opponent');

    if (this.opponent.hp <= 0) {
      this._over = true; this._playerWon = true;
      events.push({ kind: 'victory' });
      return { events, battleOver: true, playerWon: true };
    }
    return { events, battleOver: false, playerWon: null };
  }

  /** Execute the opponent's turn. Returns events. */
  opponentTurn(): TurnResult {
    if (this._over) return { events: [], battleOver: false, playerWon: null };
    const events: BattleEvent[] = [];
    const skip = startOfTurnTicks(this.opponent, 'opponent', events);
    if (this.opponent.hp <= 0) {
      this._over = true; this._playerWon = true;
      events.push({ kind: 'victory' });
      return { events, battleOver: true, playerWon: true };
    }
    if (!skip) {
      const card = pickAiCard(this.opponent);
      executeCard(card, this.opponent, this.player, events, 'player');
      if (this.player.hp <= 0) {
        this._over = true; this._playerWon = false;
        events.push({ kind: 'defeat' });
        return { events, battleOver: true, playerWon: false };
      }
    }
    return { events, battleOver: false, playerWon: null };
  }
}
