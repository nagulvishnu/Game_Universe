import { drawArenaBG, drawBanner, drawHPPlate, drawMech, drawMiniCard } from './render';
import { Tweens, clamp, lerp, rand, outBack, TAU } from './fx';
import { CARDS } from './data';
import type { Battler, CardId, SpeciesDef } from './types';
import { audio } from './audio';
import type { Game } from './engine';

export interface BattleOpts {
  mySpecies: SpeciesDef;
  myLevel: number;
  foeSpecies: SpeciesDef;
  foeLevel: number;
  isTrainer: boolean;
  trainerName?: string;
  cards: CardId[];
}

export type BattleResult = 'tamed' | 'claimed' | 'released' | 'escaped' | 'lost';

type Phase = 'drivein' | 'morph' | 'battle' | 'end' | 'tameIdle' | 'taming' | 'done';

interface Proj {
  kind: 'fist' | 'bolt' | 'flame';
  color: string;
  fx: number; fy: number;
  tx: number; ty: number;
  x: number; y: number;
  t: number; dur: number;
  res: () => void;
}

interface HitInfo {
  dmg: number;
  dodged: boolean;
  crit: boolean;
  blocked: boolean;
  stunned: boolean;
  burned: boolean;
}

export class BattleScene {
  mine: Battler;
  foe: Battler;
  cards: CardId[];
  cooldowns = [0, 0, 0];
  isTrainer: boolean;
  trainerName?: string;

  phase: Phase = 'drivein';
  busy = true;
  yourTurn = false;

  // animated pose state
  morphM = 0; morphF = 0;
  xOffM = 0; xOffF = 0;
  leanM = 0; leanF = 0;
  flashM = 0; flashF = 0;
  dimM = 0; dimF = 0;
  shownM = 1; shownF = 1;
  ghostM = 1; ghostF = 1;

  projs: Proj[] = [];
  tweens = new Tweens();
  gen = 0;
  time = 0;

  banner = { text: '', sub: '', color: '#fff', k: 1, dur: 1.6 };
  tameCardAnim = { active: false, x: 0, y: 0, rot: 0, s: 1 };
  pulseCount = 0;

  constructor(private game: Game, opts: BattleOpts) {
    this.isTrainer = opts.isTrainer;
    this.trainerName = opts.trainerName;
    this.cards = opts.cards;
    this.mine = {
      species: opts.mySpecies, level: opts.myLevel,
      hp: 0, maxHp: 0, statuses: { burn: 0, stun: false, shield: 0, charge: false },
      isPlayer: true, label: opts.mySpecies.name,
    };
    this.foe = {
      species: opts.foeSpecies, level: opts.foeLevel,
      hp: 0, maxHp: 0, statuses: { burn: 0, stun: false, shield: 0, charge: false },
      isPlayer: false,
      label: opts.isTrainer ? `${opts.trainerName}'S ${opts.foeSpecies.name}` : `WILD ${opts.foeSpecies.name}`,
    };
    this.mine.maxHp = this.mine.hp = Math.round(opts.mySpecies.hp + (opts.myLevel - 1) * 7);
    this.foe.maxHp = this.foe.hp = Math.round(opts.foeSpecies.hp + (opts.foeLevel - 1) * 7);
    this.xOffM = -game.viewW * 0.55;
    this.xOffF = game.viewW * 0.55;
    void this.runIntro();
  }

  dispose() {
    this.gen++;
    this.tweens.clear();
  }

  // ---------- geometry ----------
  private geom() {
    const w = this.game.viewW;
    const h = this.game.viewH;
    const dx = clamp(w * 0.215, 100, 320);
    const u = clamp(Math.min(w, h) / 8.0, 34, 118);
    return { w, h, dx, u, gy: h * 0.79 };
  }

  private mechX(isMine: boolean) {
    const { w, dx } = this.geom();
    return w / 2 + (isMine ? -dx + this.xOffM : dx + this.xOffF);
  }

  private delay(s: number): Promise<void> {
    return this.tweens.add(s, () => undefined, (t) => t);
  }

  private setBanner(text: string, sub: string, color: string, dur = 1.8) {
    this.banner = { text, sub, color, k: 0, dur };
  }

  private syncCards() {
    this.game.emitBattleCards({
      cards: this.cards,
      cooldowns: [...this.cooldowns],
      yourTurn: this.yourTurn,
      locked: this.busy,
    });
  }

  // ---------- intro ----------
  private async runIntro() {
    const g = this.gen;
    audio.rev();
    this.phase = 'drivein';
    this.tweens.add(0.85, (k) => { this.xOffM = lerp(-this.game.viewW * 0.55, 0, k); }, outBack);
    this.tweens.add(0.9, (k) => { this.xOffF = lerp(this.game.viewW * 0.55, 0, k); }, outBack);
    await this.delay(1.0);
    if (g !== this.gen) return;

    // TRANSFORM!
    this.phase = 'morph';
    audio.transformSfx();
    setTimeout(() => audio.transformSfx(), 220);
    this.tweens.add(1.05, (k) => { this.morphM = k; }, (t) => t);
    await this.delay(0.14);
    this.tweens.add(1.05, (k) => { this.morphF = k; }, (t) => t);
    await this.delay(1.0);
    if (g !== this.gen) return;

    const { gy, u } = this.geom();
    this.game.particles.ring(this.mechX(true), gy, this.mine.species.accent, 20, 0.6);
    this.game.particles.ring(this.mechX(false), gy, this.foe.species.accent, 20, 0.6);
    this.game.particles.smoke(this.mechX(true), gy, 8);
    this.game.particles.smoke(this.mechX(false), gy, 8);
    this.game.particles.burst(this.mechX(true), gy - 2 * u, '#ffffff', 16, 380);
    this.game.particles.burst(this.mechX(false), gy - 2 * u, '#ffffff', 16, 380);
    this.game.shake(0.65);
    this.setBanner('MECHANIMO BATTLE', `${this.mine.label}  VS  ${this.foe.label}`, '#22d3ee');
    await this.delay(1.1);
    if (g !== this.gen) return;
    this.phase = 'battle';
    this.playerTurn();
  }

  // ---------- turn flow ----------
  private playerTurn() {
    if (this.phase !== 'battle') return;
    const g = this.gen;
    // cooldowns tick
    for (let i = 0; i < 3; i++) this.cooldowns[i] = Math.max(0, this.cooldowns[i] - 1);
    this.startOfTurnTicks(this.mine, true).then((skip) => {
      if (g !== this.gen || this.phase !== 'battle') return;
      if (skip) { this.enemyTurn(); return; }
      this.busy = false;
      this.yourTurn = true;
      this.syncCards();
    });
  }

  private async startOfTurnTicks(b: Battler, isMine: boolean): Promise<boolean> {
    const { gy, u } = this.geom();
    const x = this.mechX(isMine);
    // regen trait
    if (b.species.trait === 'regen' && b.hp > 0 && b.hp < b.maxHp) {
      b.hp = Math.min(b.maxHp, b.hp + 4);
      this.game.floaters.add(x, gy - 3.2 * u, '+4 REGEN', '#7dd3fc', 18);
    }
    // burn
    if (b.statuses.burn > 0 && b.hp > 0) {
      b.statuses.burn--;
      b.hp = Math.max(0, b.hp - 6);
      if (isMine) this.flashM = 0.6; else this.flashF = 0.6;
      audio.burnTick();
      this.game.floaters.add(x, gy - 2.6 * u, '-6 BURN', '#fb923c', 20);
      this.game.particles.burst(x, gy - 2 * u, '#fb923c', 8, 160);
      this.game.shake(0.15);
      await this.delay(0.45);
      if (b.hp <= 0) { await this.endSequence(!isMine); return true; }
    }
    // stun
    if (b.statuses.stun && b.hp > 0) {
      b.statuses.stun = false;
      audio.stunSfx();
      this.game.floaters.add(x, gy - 3.4 * u, 'STUNNED!', '#22d3ee', 24);
      this.game.particles.stars(x, gy - 3.2 * u, '#22d3ee', 8);
      this.setBanner(isMine ? 'YOU ARE STUNNED!' : 'FOE IS STUNNED!', '', '#22d3ee', 1.2);
      await this.delay(0.9);
      return true;
    }
    return false;
  }

  // entry from UI
  playCard(idx: number) {
    if (this.phase !== 'battle' || !this.yourTurn || this.busy) return;
    if (idx < 0 || idx > 2 || this.cooldowns[idx] > 0) return;
    const g = this.gen;
    this.yourTurn = false;
    this.busy = true;
    this.cooldowns[idx] = 2;
    this.syncCards();
    void this.executeCard(this.cards[idx], true).then(async () => {
      if (g !== this.gen || this.phase !== 'battle') return;
      await this.delay(0.35);
      if (g !== this.gen || this.phase !== 'battle') return;
      if (this.foe.hp > 0) this.enemyTurn();
    });
  }

  private enemyTurn() {
    if (this.phase !== 'battle') return;
    const g = this.gen;
    this.busy = true;
    this.yourTurn = false;
    this.syncCards();
    this.startOfTurnTicks(this.foe, false).then(async (skip) => {
      if (g !== this.gen || this.phase !== 'battle') return;
      if (skip) { this.playerTurn(); return; }
      await this.delay(0.55);
      if (g !== this.gen || this.phase !== 'battle') return;
      const card = this.pickEnemyCard();
      await this.executeCard(card, false);
      if (g !== this.gen || this.phase !== 'battle') return;
      await this.delay(0.35);
      if (g !== this.gen || this.phase !== 'battle') return;
      if (this.mine.hp > 0) this.playerTurn();
    });
  }

  private pickEnemyCard(): CardId {
    const sp = this.foe.species.id;
    const low = this.foe.hp / this.foe.maxHp < 0.32;
    if (low && Math.random() < 0.4) return 'nanite';
    const table: Record<string, CardId[]> = {
      blaze: ['flame', 'ram', 'punch', 'ram'],
      voltox: ['volt', 'volt', 'ram', 'punch'],
      terradon: ['aegis', 'ram', 'punch', 'ram'],
      nimbra: ['punch', 'volt', 'ram', 'punch'],
      ferrion: ['punch', 'punch', 'ram', 'flame'],
      aquella: ['nanite', 'ram', 'volt', 'punch'],
    };
    const list = table[sp] ?? ['ram', 'punch'];
    return list[Math.floor(Math.random() * list.length)];
  }

  // ---------- card execution ----------
  private async executeCard(cardId: CardId, isMine: boolean) {
    const card = CARDS[cardId];
    const atk = isMine ? this.mine : this.foe;
    const def = isMine ? this.foe : this.mine;
    const { gy, u } = this.geom();
    const ax = this.mechX(isMine);
    const dxPos = this.mechX(!isMine);
    const flip = isMine ? 1 : -1;

    this.setBanner(atk.label, `USES ${card.name}`, card.color, 1.1);

    if (card.kind === 'heal') {
      audio.heal();
      this.game.particles.stars(ax, gy - 2.2 * u, '#4ade80', 12);
      const before = atk.hp;
      atk.hp = Math.min(atk.maxHp, atk.hp + card.power);
      this.game.floaters.add(ax, gy - 3 * u, `+${atk.hp - before} HP`, '#4ade80', 26);
      await this.delay(0.8);
      return;
    }

    if (card.kind === 'defense') {
      audio.shieldUp();
      atk.statuses.shield = 0.75;
      const before = atk.hp;
      atk.hp = Math.min(atk.maxHp, atk.hp + 6);
      this.game.floaters.add(ax, gy - 3 * u, before === atk.hp ? 'AEGIS UP' : `+${atk.hp - before} · AEGIS`, '#60a5fa', 24);
      this.game.particles.ring(ax, gy - 1.8 * u, '#60a5fa', 26, 0.6);
      await this.delay(0.8);
      return;
    }

    // ----- attacks -----
    let acc = 1;
    let stunChance = 0;
    let burns = false;
    if (cardId === 'punch') acc = 0.8;
    if (cardId === 'volt') stunChance = 0.45;
    if (cardId === 'flame') burns = true;

    const impactX = dxPos - flip * 0.85 * u;
    const impactY = gy - 2.1 * u;
    const muzzleX = ax + flip * 0.4 * u;
    const muzzleY = gy - 2.25 * u;

    if (cardId === 'ram') {
      // dash lunge
      audio.rev();
      const startOff = isMine ? this.xOffM : this.xOffF;
      await this.tweens.add(0.22, (k) => {
        const v = Math.sin(k * Math.PI) * (u * 1.6);
        if (isMine) this.xOffM = startOff + v; else this.xOffF = startOff - v;
        if (isMine) this.leanM = 0.22 * Math.sin(k * Math.PI);
        else this.leanF = -0.22 * Math.sin(k * Math.PI);
      }, (t) => t);
      const info = this.dealDamage(atk, def, card.power, acc, stunChance, burns);
      this.applyHit(isMine, info, impactX, impactY, card.color);
    } else if (cardId === 'punch') {
      audio.laser();
      await this.fireProjectile('fist', card.color, muzzleX, muzzleY, impactX, impactY, 0.32);
      const info = this.dealDamage(atk, def, card.power, acc, stunChance, burns);
      this.applyHit(isMine, info, impactX, impactY, card.color);
    } else if (cardId === 'flame') {
      audio.flame();
      await this.fireProjectile('flame', '#fb923c', muzzleX, muzzleY, impactX, impactY, 0.38);
      const info = this.dealDamage(atk, def, card.power, acc, stunChance, burns);
      this.applyHit(isMine, info, impactX, impactY, '#fb923c');
    } else {
      // volt lash
      audio.zap();
      await this.fireProjectile('bolt', '#22d3ee', muzzleX, muzzleY, impactX, impactY, 0.24);
      const info = this.dealDamage(atk, def, card.power, acc, stunChance, burns);
      this.applyHit(isMine, info, impactX, impactY, '#22d3ee');
    }
    await this.delay(0.55);
  }

  private fireProjectile(kind: Proj['kind'], color: string, fx: number, fy: number, tx: number, ty: number, dur: number): Promise<void> {
    return new Promise((res) => {
      this.projs.push({ kind, color, fx, fy, tx, ty, x: fx, y: fy, t: 0, dur, res });
    });
  }

  private dealDamage(atk: Battler, def: Battler, base: number, acc: number, stunChance: number, burns: boolean): HitInfo {
    const info: HitInfo = { dmg: 0, dodged: false, crit: false, blocked: false, stunned: false, burned: false };
    // accuracy
    if (Math.random() > acc) { info.dodged = true; return info; }
    // phase dodge
    if (def.species.trait === 'phase' && Math.random() < 0.16) { info.dodged = true; return info; }

    const atkScale = (1 + (atk.level - 1) * 0.05) * atk.species.atk;
    let dmg = base * atkScale * rand(0.9, 1.12);
    if (atk.species.trait === 'fury') dmg *= 1.15;
    if (atk.species.trait === 'crit' && Math.random() < 0.22) { info.crit = true; dmg *= 2; }
    if (def.species.trait === 'plating') dmg *= 0.85;
    if (def.statuses.shield > 0) {
      info.blocked = true;
      dmg *= 1 - def.statuses.shield;
      def.statuses.shield = 0;
    }
    info.dmg = Math.max(2, Math.round(dmg));
    def.hp = Math.max(0, def.hp - info.dmg);

    // stun application
    let sc = stunChance;
    if (atk.species.trait === 'static') sc += 0.2;
    if (sc > 0 && Math.random() < sc && def.hp > 0) {
      def.statuses.stun = true;
      info.stunned = true;
    }
    if (burns && def.hp > 0) {
      def.statuses.burn = 2;
      info.burned = true;
    }
    return info;
  }

  private applyHit(isMineAtk: boolean, info: HitInfo, x: number, y: number, color: string) {
    const defIsMine = !isMineAtk;
    const { u, gy } = this.geom();
    const heavy = info.dmg >= 24;
    if (info.dodged) {
      audio.miss();
      this.game.floaters.add(x, y, 'MISS', '#94a3b8', 24);
      return;
    }
    audio.hit(heavy);
    if (defIsMine) { this.flashM = 1; this.leanM = -0.12; } else { this.flashF = 1; this.leanF = 0.12; }
    // knockback (decays back to slot in update)
    const kb = heavy ? 30 : 16;
    if (defIsMine) this.xOffM -= kb; else this.xOffF += kb;
    this.game.particles.burst(x, y, color, heavy ? 26 : 16, heavy ? 480 : 340);
    this.game.particles.burst(x, y, '#ffffff', 8, 260);
    this.game.particles.ring(x, y, color, 12, 0.45);
    this.game.shake(heavy ? 0.65 : 0.35);
    this.game.hitFreeze(heavy ? 0.09 : 0.05);
    this.game.floaters.add(x, y - 10, `-${info.dmg}`, info.crit ? '#ffd166' : '#ffffff', info.crit ? 34 : 26);
    if (info.crit) this.game.floaters.add(x, y - 44, 'CRIT!', '#ffd166', 22);
    if (info.blocked) this.game.floaters.add(x, y - 44, 'SHIELDED', '#60a5fa', 20);
    if (info.stunned) {
      this.game.floaters.add(x, gy - 3.6 * u, 'STUNNED!', '#22d3ee', 22);
      this.game.particles.stars(x, gy - 3.4 * u, '#22d3ee', 8);
      audio.stunSfx();
    }
    if (info.burned) this.game.floaters.add(x, gy - 3.9 * u, 'BURNING!', '#fb923c', 20);
    // end check
    const def = defIsMine ? this.mine : this.foe;
    if (def.hp <= 0) {
      const winnerIsMine = !defIsMine;
      void this.delay(0.5).then(() => this.endSequence(winnerIsMine));
    }
  }

  // ---------- end of battle ----------
  private async endSequence(playerWon: boolean) {
    if (this.phase !== 'battle') return;
    this.phase = 'end';
    this.busy = true;
    this.yourTurn = false;
    this.syncCards();
    const g = this.gen;
    const { gy, u } = this.geom();
    const loserX = this.mechX(!playerWon);

    audio.defeated();
    if (playerWon) this.dimF = 0; else this.dimM = 0;
    this.tweens.add(0.6, (k) => {
      if (playerWon) { this.dimF = k; this.leanF = -0.3 * k; }
      else { this.dimM = k; this.leanM = 0.3 * k; }
    });
    this.game.particles.smoke(loserX, gy - 1.5 * u, 10);
    this.game.shake(0.5);
    await this.delay(0.8);
    if (g !== this.gen) return;

    // demorph loser
    audio.escape();
    this.tweens.add(0.55, (k) => {
      if (playerWon) this.morphF = 1 - k; else this.morphM = 1 - k;
    });
    this.game.particles.smoke(loserX, gy - 0.6 * u, 8);
    await this.delay(0.7);
    if (g !== this.gen) return;

    if (playerWon) {
      this.game.onBattleWon(this.isTrainer);
      if (this.isTrainer) {
        // trainers surrender their mechanimo automatically
        audio.fanfare();
        this.setBanner('VICTORY!', `${this.foe.species.name} JOINS YOUR CREW`, '#ffd166', 2.2);
        this.game.claimSpecies(this.foe.species, this.foe.level);
        this.game.particles.stars(this.mechX(true), gy - 3 * u, '#ffd166', 16);
        await this.delay(2.0);
        if (g !== this.gen) return;
        this.finish('claimed');
      } else {
        // wild: prompt to tame
        if (this.game.tameCards > 0) {
          this.phase = 'tameIdle';
          this.game.onTamePrompt(true, this.foe.species);
        } else {
          this.setBanner('NO TAME CARDS!', 'THE WILD MECHANIMO FLED', '#94a3b8', 2);
          audio.escape();
          await this.delay(1.6);
          if (g !== this.gen) return;
          this.finish('escaped');
        }
      }
    } else {
      // player lost
      this.game.onBattleLost(this.isTrainer);
      if (this.isTrainer) {
        this.setBanner('DEFEATED...', `RIDER ${this.trainerName} TAMED YOUR MECHANIMO!`, '#ff5470', 2.4);
      } else {
        this.setBanner('DEFEATED...', 'THE WILD MECHANIMO ESCAPED', '#94a3b8', 2.2);
      }
      audio.gameOver();
      await this.delay(2.2);
      if (g !== this.gen) return;
      this.finish('lost');
    }
  }

  // ---------- taming ----------
  async throwTame() {
    if (this.phase !== 'tameIdle') return;
    this.phase = 'taming';
    this.game.onTamePrompt(false);
    const g = this.gen;
    const { w, h } = this.geom();
    const gy = this.geom().gy;
    const tx = this.mechX(false);
    audio.throwCard();
    const a = this.tameCardAnim;
    a.active = true;
    a.s = 1;
    // arc flight
    await this.tweens.add(0.72, (k) => {
      a.x = lerp(w / 2, tx, k);
      a.y = lerp(h + 60, gy - 40, k) - Math.sin(k * Math.PI) * h * 0.22;
      a.rot = k * TAU * 2.5;
    });
    if (g !== this.gen) return;
    audio.pickup();
    // pulse rings x3
    for (let i = 0; i < 3; i++) {
      this.game.particles.ring(tx, gy - 30, '#e879f9', 14, 0.5);
      audio.click();
      await this.delay(0.34);
      if (g !== this.gen) return;
    }
    a.active = false;
    // success!
    audio.capture();
    this.game.claimSpecies(this.foe.species, this.foe.level);
    this.game.particles.stars(tx, gy - 60, '#ffd166', 18);
    this.game.particles.burst(tx, gy - 40, '#e879f9', 24, 380);
    this.game.particles.ring(tx, gy - 40, '#ffd166', 20, 0.8);
    this.game.shake(0.3);
    this.setBanner('GOTCHA!', `${this.foe.species.name} WAS TAMED  (+${250 * this.foe.species.rarity} PTS)`, '#ffd166', 2.4);
    await this.delay(2.2);
    if (g !== this.gen) return;
    this.finish('tamed');
  }

  async releaseTame() {
    if (this.phase !== 'tameIdle') return;
    this.phase = 'taming';
    this.game.onTamePrompt(false);
    const g = this.gen;
    audio.escape();
    this.setBanner('RELEASED', 'THE WILD MECHANIMO WANDERED OFF', '#94a3b8', 1.6);
    await this.delay(1.3);
    if (g !== this.gen) return;
    this.finish('released');
  }

  private finish(result: BattleResult) {
    if (this.phase === 'done') return;
    this.phase = 'done';
    this.game.endBattle(result);
  }

  // ---------- per-frame ----------
  update(dt: number) {
    this.time += dt;
    this.tweens.update(dt);

    // decay flashes / leans
    this.flashM = Math.max(0, this.flashM - dt * 3);
    this.flashF = Math.max(0, this.flashF - dt * 3);
    this.leanM *= Math.pow(0.02, dt);
    this.leanF *= Math.pow(0.02, dt);
    this.xOffM *= Math.pow(0.001, dt);
    this.xOffF *= Math.pow(0.001, dt);

    // hp bar easing
    const tM = this.mine.hp / this.mine.maxHp;
    const tF = this.foe.hp / this.foe.maxHp;
    this.shownM += (tM - this.shownM) * Math.min(1, dt * 9);
    this.shownF += (tF - this.shownF) * Math.min(1, dt * 9);
    if (this.ghostM < tM) this.ghostM = tM; else this.ghostM += (tM - this.ghostM) * Math.min(1, dt * 2.4);
    if (this.ghostF < tF) this.ghostF = tF; else this.ghostF += (tF - this.ghostF) * Math.min(1, dt * 2.4);

    // banner progress
    if (this.banner.k < 1) this.banner.k = Math.min(1, this.banner.k + dt / this.banner.dur);

    // projectiles
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const p = this.projs[i];
      p.t += dt / p.dur;
      const k = Math.min(1, p.t);
      p.x = lerp(p.fx, p.tx, k);
      p.y = lerp(p.fy, p.ty, k) - Math.sin(k * Math.PI) * 14;
      // trail particles
      if (p.kind === 'flame') {
        this.game.particles.trail(p.x + rand(-6, 6), p.y + rand(-6, 6), Math.random() < 0.5 ? '#fb923c' : '#facc15', rand(5, 10), 0.4);
      } else if (p.kind === 'bolt') {
        this.game.particles.trail(p.x, p.y, '#a5f3fc', 3.5, 0.22);
      } else {
        this.game.particles.trail(p.x, p.y, '#ffb3c1', 3, 0.25);
      }
      if (p.t >= 1) {
        this.projs.splice(i, 1);
        p.res();
      }
    }

    // ambient embers on burning mechs
    const { gy, u } = this.geom();
    if (this.mine.statuses.burn > 0 && this.mine.hp > 0 && Math.random() < dt * 14) {
      this.game.particles.trail(this.mechX(true) + rand(-u, u), gy - rand(0.5, 3) * u, '#fb923c', rand(3, 6), 0.5);
    }
    if (this.foe.statuses.burn > 0 && this.foe.hp > 0 && Math.random() < dt * 14) {
      this.game.particles.trail(this.mechX(false) + rand(-u, u), gy - rand(0.5, 3) * u, '#fb923c', rand(3, 6), 0.5);
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    const { w, h, u, gy } = this.geom();
    drawArenaBG(ctx, w, h, this.time);

    const bob = Math.sin(this.time * 2) * 3;
    const bob2 = Math.sin(this.time * 2 + 2) * 3;

    // foe first (slightly behind)
    drawMech(ctx, this.foe.species, this.mechX(false), gy, u, -1, {
      morph: this.morphF, bob: this.phase === 'battle' && this.foe.hp > 0 ? bob2 : 0,
      lean: this.leanF * -1, flash: this.flashF, dim: this.dimF,
    }, this.time + 3);
    drawMech(ctx, this.mine.species, this.mechX(true), gy, u, 1, {
      morph: this.morphM, bob: this.phase === 'battle' && this.mine.hp > 0 ? bob : 0,
      lean: this.leanM, flash: this.flashM, dim: this.dimM,
    }, this.time);

    // shields
    const drawShield = (isMine: boolean) => {
      const b = isMine ? this.mine : this.foe;
      if (b.statuses.shield <= 0 || b.hp <= 0 || (isMine ? this.morphM : this.morphF) < 0.9) return;
      const x = this.mechX(isMine);
      ctx.save();
      ctx.globalAlpha = 0.3 + 0.12 * Math.sin(this.time * 5);
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(x, gy - 1.8 * u, 1.9 * u, 2.1 * u, 0, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = '#60a5fa';
      ctx.fill();
      ctx.restore();
    };
    drawShield(true);
    drawShield(false);

    // stun stars
    const drawStun = (isMine: boolean) => {
      const b = isMine ? this.mine : this.foe;
      if (!b.statuses.stun || b.hp <= 0) return;
      const x = this.mechX(isMine);
      const hy = gy - 3.3 * u;
      ctx.save();
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2.5;
      for (let i = 0; i < 3; i++) {
        const a = this.time * 3 + (i / 3) * TAU;
        const sx = x + Math.cos(a) * 0.7 * u;
        const sy = hy + Math.sin(a) * 0.2 * u;
        const s = 6;
        ctx.beginPath();
        ctx.moveTo(sx - s, sy); ctx.lineTo(sx + s, sy);
        ctx.moveTo(sx, sy - s); ctx.lineTo(sx, sy + s);
        ctx.stroke();
      }
      ctx.restore();
    };
    drawStun(true);
    drawStun(false);

    // projectiles
    for (const p of this.projs) {
      ctx.save();
      if (p.kind === 'fist') {
        ctx.translate(p.x, p.y);
        ctx.rotate(this.time * 12);
        ctx.fillStyle = '#c9ccdd';
        ctx.strokeStyle = 'rgba(4,2,14,.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, TAU);
        ctx.fill(); ctx.stroke();
        ctx.strokeStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(-10, -4); ctx.lineTo(10, -4);
        ctx.moveTo(-10, 4); ctx.lineTo(10, 4);
        ctx.stroke();
      } else if (p.kind === 'bolt') {
        ctx.strokeStyle = '#a5f3fc';
        ctx.lineWidth = 4;
        ctx.beginPath();
        const segs = 5;
        ctx.moveTo(p.fx, p.fy);
        for (let i = 1; i <= segs; i++) {
          const k = i / segs;
          const bx = lerp(p.fx, p.x, k);
          const by = lerp(p.fy, p.y, k) + (i === segs ? 0 : rand(-12, 12));
          ctx.lineTo(bx, by);
        }
        ctx.stroke();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        const fg = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 22);
        fg.addColorStop(0, '#fef3c7');
        fg.addColorStop(0.5, '#fb923c');
        fg.addColorStop(1, 'rgba(251,146,60,0)');
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 22, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }

    // particles + floaters (screen space)
    this.game.particles.draw(ctx);
    this.game.floaters.draw(ctx);

    // HP plates
    const plateW = Math.min(330, w * 0.44);
    drawHPPlate(ctx, 14, 14, plateW, false, this.mine.label, this.mine.level, this.shownM, this.ghostM, this.mine.species.accent, {
      burn: this.mine.statuses.burn, stun: this.mine.statuses.stun, shield: this.mine.statuses.shield,
    });
    drawHPPlate(ctx, w - 14 - plateW, 14, plateW, true, this.foe.label, this.foe.level, this.shownF, this.ghostF, this.foe.species.accent, {
      burn: this.foe.statuses.burn, stun: this.foe.statuses.stun, shield: this.foe.statuses.shield,
    });

    // turn hint
    if (this.phase === 'battle' && this.yourTurn) {
      ctx.save();
      ctx.font = '700 14px Orbitron, sans-serif';
      ctx.textAlign = 'center';
      ctx.globalAlpha = 0.7 + 0.3 * Math.sin(this.time * 5);
      ctx.fillStyle = '#22d3ee';
      ctx.fillText('YOUR MOVE — PICK A CARD', w / 2, 92);
      ctx.restore();
    }

    // tame card flying
    if (this.tameCardAnim.active) {
      drawMiniCard(ctx, this.tameCardAnim.x, this.tameCardAnim.y, this.tameCardAnim.rot, this.tameCardAnim.s);
    }

    // banner
    if (this.banner.k < 1) {
      drawBanner(ctx, w, h, this.banner.text, this.banner.sub, this.banner.color, this.banner.k);
    }

    // tame-idle dizzy hint on wild car
    if (this.phase === 'tameIdle') {
      const tx = this.mechX(false);
      ctx.save();
      ctx.font = '700 14px Rajdhani, sans-serif';
      ctx.textAlign = 'center';
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(this.time * 4);
      ctx.fillStyle = '#e879f9';
      ctx.fillText('WEAKENED — THROW A TAME CARD!', tx, gy - 80);
      ctx.restore();
    }
  }
}
