/** SHADOWSTRIKE — the 2D combat scene (Phaser owns the gameplay loop). */

import Phaser from 'phaser';
import { Fighter, EMPTY_INPUT, type EquippedSkill, type FighterInput, type Hitbox } from '../entities/Fighter';
import { AIController } from '../ai/AIController';
import { BossAIController } from '../ai/BossAIController';
import { InputManager, type VirtualInput } from '../input/InputManager';
import { Effects } from '../effects/Effects';
import { SkillExecutor, type DamageOptions, type SkillWorld, DEFLECT_COOLDOWN_MS } from '../skills/SkillExecutor';
import { ArenaRenderer } from '../arena/ArenaRenderer';
import { audio } from '../audio/AudioManager';
import { gameEvents, type FighterHud, type HudSnapshot } from '../events';
import { getArena } from '../../data/arenas';
import { getWeapon } from '../../data/weapons';
import { SKILL_BY_ID } from '../../data/skills';
import { EQUIPMENT_BY_ID, type EquipSlot } from '../../data/equipment';
import { OPPONENT_BY_ID, DIFFICULTIES, type Difficulty } from '../../data/fighters';
import { getBoss, isBoss, type BossDef } from '../../data/bosses';
import type { Loadout, Settings } from '../../save/save';

export const GAME_W = 1280;
export const GAME_H = 720;

export interface TrainingOptions {
  dummyBehavior: 'idle' | 'block' | 'walk' | 'attack';
  noCooldowns: boolean;
  showHitboxes: boolean;
  showFrameData: boolean;
  slowMotion: boolean;
  infiniteHealth: boolean;
}

export interface CombatInit {
  mode: 'fight' | 'pvp' | 'training';
  arenaId: string;
  opponentId: string;
  difficulty: Difficulty;
  rounds: number;
  timeLimit: number;
  p1: { name: string; loadout: Loadout };
  p2: { name: string; loadout: Loadout };
  settings: Settings;
  training?: TrainingOptions;
  /** Optional boss encounter id. When set, p2 is the boss and the match is a single-round boss fight. */
  bossId?: string;
}

type Phase = 'intro' | 'fight' | 'roundover' | 'matchover';

export class CombatScene extends Phaser.Scene {
  private cfg!: CombatInit;
  private arena = getArena('void_dojo');
  private arenaView!: ArenaRenderer;
  private effects!: Effects;
  private executor!: SkillExecutor;
  private keys!: InputManager;
  private p1!: Fighter;
  private p2!: Fighter;
  private ai: AIController | null = null;
  private bossDef!: BossDef | undefined;
  private bossAI: BossAIController | null = null;
  private phase: Phase = 'intro';
  private phaseTime = 0;
  private timer = 0;
  private round = 1;
  private roundWins: [number, number] = [0, 0];
  private hitStopMs = 0;
  private hudAcc = 0;
  private announcement: string | null = null;
  private announceText!: Phaser.GameObjects.Text;
  private debugGfx!: Phaser.GameObjects.Graphics;
  private frameText!: Phaser.GameObjects.Text;
  private paused = false;
  private matchStart = 0;
  private trail1: { x: number; y: number }[] = [];
  private trail2: { x: number; y: number }[] = [];
  private training?: TrainingOptions;
  private reported = false;

  constructor() { super('combat'); }

  init(data: CombatInit) {
    this.cfg = data;
    this.training = data.training;
    this.phase = 'intro';
    this.phaseTime = 0;
    this.round = 1;
    this.roundWins = [0, 0];
    this.reported = false;
    this.bossDef = undefined;
    this.bossAI = null;
  }

  create() {
    const cfg = this.cfg;
    this.arena = getArena(cfg.arenaId);
    const bounds = { left: this.arena.leftBound, right: this.arena.rightBound };

    this.arenaView = new ArenaRenderer(this, this.arena, GAME_W, GAME_H);
    this.effects = new Effects(this);
    this.effects.reducedMotion = cfg.settings.reducedMotion;
    this.effects.shakeEnabled = cfg.settings.screenShake;
    this.effects.showDamageNumbers = cfg.settings.damageNumbers;
    this.effects.quality = cfg.settings.quality;

    const opp = OPPONENT_BY_ID[cfg.opponentId] ?? OPPONENT_BY_ID.kage;
    const diff = DIFFICULTIES[cfg.difficulty];

    this.p1 = new Fighter(this, {
      side: 'p1', name: cfg.p1.name || 'PLAYER',
      weapon: getWeapon(cfg.p1.loadout.weapon),
      skills: buildSkills(cfg.p1.loadout.skills, cfg.p1.loadout, this.training?.noCooldowns),
      equipment: buildEquipment(cfg.p1.loadout),
      maxHealth: 100, bodyColor: 0x0d0d14, eyeColor: 0x7fd4ff, auraColor: 0x6a7aff,
      scale: 1, x: 420, facing: 1,
      infiniteCooldowns: this.training?.noCooldowns,
    }, this.arena.floorY, bounds);

    const isBossFight = cfg.mode === 'fight' && !!cfg.bossId && isBoss(cfg.bossId);
    if (isBossFight) {
      const boss = getBoss(cfg.bossId!)!;
      this.bossDef = boss;
      this.p2 = new Fighter(this, {
        side: 'p2', name: boss.name,
        weapon: getWeapon(boss.weapon),
        skills: buildSkills(boss.skills, null, false, 3),
        equipment: buildOpponentEquipment('oblivion'),
        maxHealth: boss.maxHealth, bodyColor: boss.bodyColor, eyeColor: boss.eyeColor, auraColor: boss.auraColor,
        scale: boss.scale, x: 860, facing: -1,
        damageMul: diff.damageMul,
      }, this.arena.floorY, bounds);
      this.bossAI = new BossAIController(this.p2, this.p1, boss, diff, this.effects, Date.now() & 0xffff);
      // Slightly zoom out so the oversized boss stays fully readable.
      this.cameras.main.setZoom(0.88);
    } else if (cfg.mode === 'pvp') {
      this.p2 = new Fighter(this, {
        side: 'p2', name: cfg.p2.name || 'PLAYER 2',
        weapon: getWeapon(cfg.p2.loadout.weapon),
        skills: buildSkills(cfg.p2.loadout.skills, cfg.p2.loadout, this.training?.noCooldowns),
        equipment: buildEquipment(cfg.p2.loadout),
        maxHealth: 100, bodyColor: 0x14101c, eyeColor: 0xff5a7a, auraColor: 0xff4a7a,
        scale: 1, x: 860, facing: -1,
        infiniteCooldowns: this.training?.noCooldowns,
      }, this.arena.floorY, bounds);
    } else if (cfg.mode === 'training') {
      this.p2 = new Fighter(this, {
        side: 'p2', name: 'TRAINING DUMMY',
        weapon: getWeapon('shadow_katana'),
        skills: buildSkills(['fire_homing', 'laser_beam', 'shadow_clone'], cfg.p2.loadout, true),
        equipment: {},
        maxHealth: 999, bodyColor: 0x23232e, eyeColor: 0xaaaaaa, auraColor: 0x888888,
        scale: 1, x: 820, facing: -1, isDummy: true, infiniteCooldowns: true,
      }, this.arena.floorY, bounds);
    } else {
      this.p2 = new Fighter(this, {
        side: 'p2', name: opp.name,
        weapon: getWeapon(opp.weapon),
        skills: buildSkills(opp.skills, null, false, 3),
        equipment: buildOpponentEquipment(opp.id),
        maxHealth: opp.maxHealth, bodyColor: opp.bodyColor, eyeColor: opp.eyeColor, auraColor: opp.auraColor,
        scale: opp.scale, x: 860, facing: -1,
        damageMul: diff.damageMul,
      }, this.arena.floorY, bounds);
      this.ai = new AIController(this.p2, this.p1, opp.tuning, diff, Date.now() & 0xffff);
      this.wireCloneProbe();
    }

    if (cfg.mode === 'training' && this.training?.dummyBehavior === 'attack') {
      this.ai = new AIController(this.p2, this.p1, OPPONENT_BY_ID.kage.tuning, DIFFICULTIES.easy, 99);
      this.wireCloneProbe();
    }

    this.keys = new InputManager(cfg.settings.bindingsP1, cfg.settings.bindingsP2);

    const world: SkillWorld = {
      scene: this, effects: this.effects, fighters: [this.p1, this.p2],
      floorY: this.arena.floorY, bounds,
      dealDamage: (a, t, amt, o) => this.dealDamage(a, t, amt, o),
      hitStop: (ms) => { this.hitStopMs = Math.max(this.hitStopMs, ms); },
    };
    this.executor = new SkillExecutor(world);

    this.announceText = this.add.text(GAME_W / 2, 220, '', {
      fontFamily: 'Impact, system-ui, sans-serif', fontSize: '84px', color: '#ffffff',
      stroke: '#000000', strokeThickness: 8,
    }).setOrigin(0.5).setDepth(80).setAlpha(0);

    this.debugGfx = this.add.graphics().setDepth(70);
    this.frameText = this.add.text(16, GAME_H - 96, '', {
      fontFamily: 'monospace', fontSize: '14px', color: '#9fe8ff', backgroundColor: '#000000aa',
    }).setDepth(70).setVisible(false);

    this.timer = cfg.timeLimit;
    this.matchStart = performance.now();
    this.startRound();

    audio.startMusic('combat');

    this.events.once('shutdown', () => this.cleanup());
    this.events.once('destroy', () => this.cleanup());
  }

  private cleanup() {
    this.keys?.destroy();
    this.executor?.destroy();
    this.effects?.destroy();
    this.arenaView?.destroy();
    audio.stopMusic();
  }

  setPaused(v: boolean) {
    this.paused = v;
    this.keys?.setEnabled(!v);
    if (v) { this.keys?.clearVirtual(); audio.stopMusic(); } else audio.startMusic('combat');
  }

  /** Feed on-screen (touch) controls into the player input state. */
  setVirtualInput(player: 1 | 2, patch: Partial<VirtualInput>) {
    this.keys?.setVirtual(player, patch);
  }

  resetTraining() {
    this.p1.resetForRound(420, 1);
    this.p2.resetForRound(820, -1);
    this.executor.clear();
    this.timer = this.cfg.timeLimit;
  }

  setTrainingOptions(opts: TrainingOptions) {
    this.training = opts;
    this.cfg.training = opts;
    this.p1.infiniteCooldowns = opts.noCooldowns;
    this.frameText.setVisible(opts.showFrameData);
    if (opts.dummyBehavior === 'attack' && !this.ai) {
      this.ai = new AIController(this.p2, this.p1, OPPONENT_BY_ID.kage.tuning, DIFFICULTIES.easy, 99);
      this.wireCloneProbe();
    } else if (opts.dummyBehavior !== 'attack') {
      this.ai = null;
    }
  }

  /**
   * Give the AI a perception probe of nearby hostile clones so it can
   * occasionally switch its engagement target to an adjacent clone.
   * Only ACTIVE clones belonging to the AI's opponent are visible.
   */
  private wireCloneProbe() {
    const self = this.p2;
    this.ai?.setCloneProbe(() => {
      if (!this.executor) return null;
      let best: { x: number } | null = null;
      let bd = Infinity;
      for (const c of this.executor.getClones()) {
        if (!c.isActive || c.ownerFighter === self) continue;
        const hb = c.hurtbox;
        const cx = hb.x + hb.w / 2;
        const d = Math.abs(cx - self.x);
        if (d < bd) { bd = d; best = { x: cx }; }
      }
      return best;
    });
  }

  private startRound() {
    this.p1.resetForRound(420, 1);
    this.p2.resetForRound(860, -1);
    if (this.cfg.mode === 'training') this.p2.x = 820;
    this.executor.clear();
    this.timer = this.cfg.timeLimit;
    this.phase = 'intro';
    this.phaseTime = 0;
    this.announce(this.cfg.bossId ? `BOSS: ${this.bossDef?.name}` : this.cfg.mode === 'training' ? 'TRAINING' : `ROUND ${this.round}`);
  }

  private announce(text: string) {
    this.announcement = text;
    this.announceText.setText(text).setAlpha(1).setScale(1.4);
    this.tweens.add({ targets: this.announceText, scale: 1, duration: 320, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.announceText, alpha: 0, delay: 700, duration: 420 });
  }

  /* --------------------------------------------------------- damage core */

  dealDamage(attacker: Fighter, target: Fighter, amount: number, opts: DamageOptions = {}): number {
    if (attacker.defeated || target.defeated || this.phase === 'roundover' || this.phase === 'matchover') return 0;
    if (this.cfg.mode === 'training' && target === this.p2 && this.training?.infiniteHealth) {
      // dummy still reacts but never dies
      const r = target.takeDamage(amount * attacker.damageMul, attacker.x, opts.knockback ?? 120, opts.launch ?? 0, opts);
      target.health = target.maxHealth;
      this.onHitFeedback(attacker, target, r.damage, r.blocked, r.broke, opts);
      return r.damage;
    }
    const buff = attacker.status.damageBuff > 0 ? 1.22 : 1;
    const result = target.takeDamage(amount * attacker.damageMul * buff, attacker.x,
      opts.knockback ?? 120, opts.launch ?? 0, opts);
    this.onHitFeedback(attacker, target, result.damage, result.blocked, result.broke, opts);
    // Heavy player hits stagger the boss, opening a punish window.
    if (target === this.p2 && this.bossAI) this.bossAI.onHit(result.damage);
    return result.damage;
  }

  private onHitFeedback(attacker: Fighter, target: Fighter, dmg: number, blocked: boolean, broke: boolean, opts: DamageOptions) {
    const color = opts.color ?? 0xffffff;
    if (blocked) {
      audio.play('block');
      this.effects.hitSpark(target.x + (attacker.x < target.x ? -26 : 26), target.centerY(), 0x9fd8ff, 0.5);
      if (broke) {
        audio.play('guardbreak');
        this.effects.explosion(target.x, target.centerY(), 0xffe066, 60);
        this.effects.shake(0.014, 220);
        this.announce('GUARD BREAK');
      }
      return;
    }
    if (dmg <= 0) return;
    attacker.damageDealt += dmg;
    attacker.registerCombo();
    const heavy = dmg >= 22;
    const impactX = target.x + (attacker.x < target.x ? -20 : 20);
    const impactY = target.centerY();
    const wShape = attacker.weapon.shape;

    if (wShape === 'hammer' || wShape === 'gauntlet' || wShape === 'none') {
      this.effects.bluntImpact(impactX, impactY, color, heavy ? 2 : 1);
    } else if (wShape === 'energy') {
      this.effects.energyBurst(impactX, impactY, color, heavy ? 2 : 1);
    } else {
      this.effects.slashSpark(impactX, impactY, color, heavy ? 2 : 1);
    }

    this.effects.damageNumber(target.x, target.centerY() - 40, dmg, color, heavy);
    this.effects.shake(heavy ? 0.012 : 0.005, heavy ? 180 : 90);
    this.hitStopMs = Math.max(this.hitStopMs, heavy ? 90 : 45);
    audio.play(heavy ? 'hit_heavy' : 'hit');
    if (target.defeated) {
      this.effects.explosion(target.x, target.centerY(), 0xff3b55, 110);
      this.effects.shake(0.02, 320);
    }
  }

  /* ---------------------------------------------------------- main loop */

  update(time: number, delta: number) {
    const dtRaw = Math.min(delta, 50);
    const slow = this.training?.slowMotion ? 0.4 : 1;
    const dt = dtRaw * slow;

    this.arenaView.update(dtRaw, 0);
    this.effects.update(dtRaw);

    if (this.paused) { this.emitHud(true); return; }

    if (this.hitStopMs > 0) {
      this.hitStopMs -= dtRaw;
      this.emitHud(false);
      return;
    }

    this.keys.tick(time);
    this.phaseTime += dt;

    const introDone = this.cfg.bossId ? this.phaseTime > 2600 : this.phaseTime > 1500;
    const fighting = this.phase === 'fight';

    if (this.phase === 'intro') {
      if (this.phaseTime > 700 && this.phaseTime < 760) audio.play('countdown', 1);
      if (introDone) { this.phase = 'fight'; this.phaseTime = 0; this.announce('FIGHT'); audio.play('countdown', 1.6); }
    }

    // --- inputs
    const i1: FighterInput = fighting ? this.keys.read(1) : { ...EMPTY_INPUT, skillPressed: [false, false, false] };
    let i2: FighterInput = { ...EMPTY_INPUT, skillPressed: [false, false, false] };
    if (fighting) {
      if (this.cfg.mode === 'pvp') i2 = this.keys.read(2);
      else if (this.bossAI) i2 = this.bossAI.update(dt);
      else if (this.ai) i2 = this.ai.update(dt);
      else if (this.cfg.mode === 'training') i2 = this.dummyInput();
    }
    this.keys.endFrame();

    this.p1.update(dt, i1, this.p2.x);
    this.p2.update(dt, i2, this.p1.x);

    this.processFighterEvents(this.p1, this.trail1);
    this.processFighterEvents(this.p2, this.trail2);

    this.executor.update(dt);

    if (fighting) {
      this.resolveMelee(this.p1, this.p2);
      this.resolveMelee(this.p2, this.p1);
      this.resolveDeflections();
      this.resolveCloneHits();
      this.timer = Math.max(0, this.timer - dt / 1000);
    }

    this.updateTrails();
    this.updateDebug();
    this.updateCamera();
    this.checkRoundEnd();
    this.emitHud(false);
  }

  private dummyInput(): FighterInput {
    const b = this.training?.dummyBehavior ?? 'idle';
    const input: FighterInput = { ...EMPTY_INPUT, skillPressed: [false, false, false] };
    if (b === 'block') input.block = true;
    if (b === 'walk') {
      const phase = Math.sin(performance.now() / 1200);
      input.left = phase < -0.2;
      input.right = phase > 0.2;
    }
    return input;
  }

  private processFighterEvents(f: Fighter, trail: { x: number; y: number }[]) {
    for (const ev of f.events) {
      switch (ev.type) {
        case 'attack-start':
          audio.play(ev.charged ? 'swing_heavy' : 'swing', 1 + (f.weapon.length > 80 ? -0.2 : 0.15));
          trail.length = 0;
          break;
        case 'swing':
          this.effects.burst(ev.x, ev.y, ev.color, 4, 90);
          break;
        case 'dodge':
          audio.play('dodge');
          this.effects.trail([{ x: f.x, y: f.y - 50 }, { x: f.x - f.facing * 50, y: f.y - 50 }], 0x9fd8ff, 10, 220);
          break;
        case 'jump': audio.play('jump'); break;
        case 'land':
          this.effects.ring(f.x, f.y, 0xffffff, 26, 200, 2);
          break;
        case 'cast': {
          const sk = ev.skill as EquippedSkill;
          const kind = sk.def.kind;
          audio.play(kind === 'beam' ? 'laser' : kind === 'clone' || kind === 'summon' ? 'summon' : 'fire');
          this.executor.cast(f, sk.def, sk.cfg);
          gameEvents.emitSkillUse(sk.def.id);
          break;
        }
        case 'guard-break':
          break;
        case 'defeated':
          audio.play('explode');
          break;
      }
    }
    f.events.length = 0;
  }

  private resolveMelee(attacker: Fighter, target: Fighter) {
    const hb = attacker.getActiveHitbox();
    if (!hb || attacker.defeated) return;
    if (attacker.hitTargets.has(target)) return;
    const tb = target.hurtbox;
    if (!overlaps(hb, tb)) return;
    attacker.hitTargets.add(target);
    const a = attacker.attack!;
    const power = attacker.attackPower;
    const dmg = a.damage * power * attacker.attackPowerMul;
    this.dealDamage(attacker, target, dmg, {
      knockback: a.knockback * power,
      launch: a.launch * power,
      hitstun: a.hitstun,
      guardDamage: a.guardDamage * power,
      knockdown: a.launch > 180 && power > 1.2,
      color: attacker.weapon.trail,
      source: a.id,
    });
  }

  /**
   * Check every live projectile against the opposing fighter's deflect window.
   * A successful deflect reverses the projectile toward its original owner.
   */
  private resolveDeflections() {
    for (const proj of this.executor.getProjectiles()) {
      // Determine which fighter is the potential deflector (the one who is NOT the owner)
      for (const deflector of [this.p1, this.p2]) {
        if (proj.owner === deflector) continue;
        if (deflector.defeated) continue;
        if (!deflector.deflecting) continue;
        // Check proximity: projectile must be within the deflector's hurtbox
        const hb = deflector.hurtbox;
        if (proj.x < hb.x || proj.x > hb.x + hb.w || proj.y < hb.y || proj.y > hb.y + hb.h) continue;
        const ok = proj.tryDeflect(deflector);
        if (ok) {
          deflector.deflecting = false;
          deflector.deflectWindow = 0;
          deflector.deflectCooldown = DEFLECT_COOLDOWN_MS;
          this.effects.hitSpark(proj.x, proj.y, 0x9fd8ff, 1.6);
          this.effects.ring(proj.x, proj.y, 0xffffff, 32, 260, 4);
          this.effects.floatingText(proj.x, proj.y - 46, 'DEFLECT', '#9fd8ff');
          audio.play('deflect');
        }
      }
    }
  }

  /**
   * Clone one-hit destruction — delegated to the executor, which owns both the
   * clones and every projectile and can enforce ownership/hostility attribution.
   */
  private resolveCloneHits() {
    this.executor.resolveCloneHits([this.p1, this.p2]);
  }

  private updateTrails() {
    const track = (f: Fighter, buf: { x: number; y: number }[]) => {
      if (f.state === 'attack' && f.attackPhase === 'active') {
        const tip = f.worldWeaponTip();
        buf.push(tip);
        if (buf.length > 10) buf.shift();
        if (buf.length > 2) {
          const trailItem = f.equipment.trail;
          const color = trailItem && trailItem.style !== 'none' ? trailItem.color : f.weapon.trail;
          const shape = f.weapon.shape;
          const arc = f.attack?.arc;

          let width = 8;
          if (shape === 'greatsword' || shape === 'scythe') width = 16;
          else if (shape === 'hammer') width = 18;
          else if (shape === 'glaive') width = 13;
          else if (shape === 'energy') width = 12;
          else if (shape === 'katana' || shape === 'sabre') width = 10;
          else if (shape === 'dagger' || shape === 'claws') width = 7;

          if (arc === 'overhead' || arc === 'sweep' || arc === 'spin') width *= 1.25;

          const life = arc === 'sweep' || arc === 'spin' ? 220 : 160;
          this.effects.trail(buf, color, width, life);
        }
      } else if (buf.length) {
        buf.length = 0;
      }
    };
    track(this.p1, this.trail1);
    track(this.p2, this.trail2);
  }

  private updateDebug() {
    const g = this.debugGfx;
    g.clear();
    if (!this.training?.showHitboxes) {
      if (this.frameText.visible && !this.training?.showFrameData) this.frameText.setVisible(false);
      return;
    }
    const drawBox = (b: Hitbox, color: number, alpha = 0.35) => {
      g.fillStyle(color, alpha * 0.4);
      g.fillRect(b.x, b.y, b.w, b.h);
      g.lineStyle(2, color, alpha + 0.4);
      g.strokeRect(b.x, b.y, b.w, b.h);
    };
    for (const f of [this.p1, this.p2]) {
      drawBox(f.hurtbox, 0x33ff88, 0.25);
      const hb = f.getActiveHitbox();
      if (hb) drawBox(hb, 0xff3344, 0.5);
      // weapon range preview
      if (f.state !== 'attack') {
        const r = f.weapon.combo[0].reach * f.scale;
        g.lineStyle(1.5, 0xffe066, 0.4);
        g.strokeRect(f.x + (f.facing > 0 ? 0 : -r), f.y - 110, r, 110);
      }
    }
    if (this.training?.showFrameData) {
      this.frameText.setVisible(true);
      const f = this.p1;
      const a = f.attack;
      const lines = [
        `state: ${f.state}  facing:${f.facing > 0 ? 'R' : 'L'}  onGround:${f.onGround}`,
        a ? `attack: ${a.name} phase=${f.attackPhase} t=${Math.round(f.attackElapsed)}ms` : 'attack: —',
        a ? `frames: startup ${a.startup} / active ${a.active} / recovery ${a.recovery}` : `combo index: ${f.comboIndex}`,
        `charge: ${Math.round(f.chargeTime)}ms (threshold ${f.weapon.chargeTime}ms)`,
        `guard: ${Math.round(f.guard)}  invuln:${Math.round(f.invuln)}  hitstun:${Math.round(f.hitstun)}`,
        `skill entities: ${this.executor.activeCount}`,
      ];
      this.frameText.setText(lines.join('\n'));
    }
  }

  private updateCamera() {
    const mid = (this.p1.x + this.p2.x) / 2;
    const cam = this.cameras.main;
    const targetX = Phaser.Math.Clamp((mid - GAME_W / 2) * 0.12, -40, 40);
    cam.scrollX += (targetX - cam.scrollX) * 0.06;
  }

  private checkRoundEnd() {
    if (this.phase !== 'fight') {
      if (this.phase === 'roundover' && this.phaseTime > 2200) {
        if (this.roundWins[0] > this.cfg.rounds / 2 || this.roundWins[1] > this.cfg.rounds / 2 || this.round > this.cfg.rounds) {
          this.endMatch();
        } else {
          this.startRound();
        }
      }
      return;
    }
    const p1Dead = this.p1.defeated;
    const p2Dead = this.p2.defeated;
    const timeUp = this.timer <= 0;
    if (!p1Dead && !p2Dead && !timeUp) return;
    if (this.cfg.mode === 'training') {
      if (p2Dead) { this.p2.resetForRound(820, -1); }
      if (p1Dead) { this.p1.resetForRound(420, 1); }
      if (timeUp) this.timer = this.cfg.timeLimit;
      return;
    }
    // Boss fights are single-round: end the match immediately when either side falls.
    if (this.cfg.bossId) {
      this.endMatch();
      return;
    }

    let winner: 'p1' | 'p2' | 'draw' = 'draw';
    if (p1Dead && !p2Dead) winner = 'p2';
    else if (p2Dead && !p1Dead) winner = 'p1';
    else if (timeUp) {
      const r1 = this.p1.health / this.p1.maxHealth;
      const r2 = this.p2.health / this.p2.maxHealth;
      winner = Math.abs(r1 - r2) < 0.02 ? 'draw' : r1 > r2 ? 'p1' : 'p2';
    }
    if (winner === 'p1') { this.roundWins[0]++; this.p1.setVictory(); audio.play('victory'); }
    else if (winner === 'p2') { this.roundWins[1]++; this.p2.setVictory(); audio.play('defeat'); }
    this.announce(winner === 'draw' ? 'DRAW' : `${winner === 'p1' ? this.p1.name : this.p2.name} WINS`);
    this.round++;
    this.phase = 'roundover';
    this.phaseTime = 0;
  }

  private endMatch() {
    if (this.reported) return;
    this.reported = true;
    this.phase = 'matchover';
    const winner: 'p1' | 'p2' | 'draw' =
      this.roundWins[0] > this.roundWins[1] ? 'p1' : this.roundWins[1] > this.roundWins[0] ? 'p2' : 'draw';
    gameEvents.emitMatchOver({
      winner,
      damageDealt: Math.round(this.p1.damageDealt),
      damageTaken: Math.round(this.p1.damageTaken),
      highestCombo: this.p1.highestCombo,
      durationMs: performance.now() - this.matchStart,
      rounds: [...this.roundWins],
      bossId: this.cfg.bossId ?? undefined,
    });
  }

  /* --------------------------------------------------------------- HUD */

  private emitHud(force: boolean) {
    this.hudAcc += this.game.loop.delta;
    if (!force && this.hudAcc < 55) return;
    this.hudAcc = 0;
    const mk = (f: Fighter, idx: number): FighterHud => ({
      name: f.name,
      health: Math.max(0, Math.round(f.health)),
      maxHealth: Math.round(f.maxHealth),
      guard: Math.max(0, Math.round(f.guard)),
      maxGuard: f.maxGuard,
      combo: f.comboCount,
      charge: f.charging ? Math.min(1, f.chargeTime / f.weapon.fullChargeTime) : 0,
      weapon: f.weapon.name,
      skills: f.skills.map((s) => ({
        id: s.def.id, name: s.def.name, level: s.level,
        cooldown: Math.round(s.cooldown), cooldownMax: s.cfg.cooldown,
        color: '#' + s.def.color.toString(16).padStart(6, '0'),
      })),
      statuses: statusList(f),
      rounds: this.roundWins[idx],
    });
    const snap: HudSnapshot = {
      p1: mk(this.p1, 0),
      p2: mk(this.p2, 1),
      timer: Math.ceil(this.timer),
      round: Math.min(this.round, this.cfg.rounds),
      maxRounds: this.cfg.rounds,
      phase: this.paused ? 'paused' : this.phase,
      announcement: this.announcement,
      frameData: null,
      fps: Math.round(this.game.loop.actualFps),
      boss: this.cfg.bossId
        ? {
            id: this.cfg.bossId,
            name: this.bossDef?.name ?? '',
            health: Math.max(0, Math.round(this.p2.health)),
            maxHealth: Math.round(this.p2.maxHealth),
            phase: this.bossAI?.phaseIndexRead ?? 0,
            phaseName: this.bossAI?.phaseName ?? '',
          }
        : undefined,
    };
    gameEvents.emitHud(snap);
  }
}

function statusList(f: Fighter): string[] {
  const out: string[] = [];
  if (f.status.burn > 0) out.push('BURN');
  if (f.status.chill > 0) out.push('CHILL');
  if (f.status.slow > 0) out.push('SLOW');
  if (f.status.shield > 0) out.push('SHIELD');
  if (f.status.haste > 0) out.push('HASTE');
  if (f.status.armor > 0) out.push('ARMOR');
  if (f.status.damageBuff > 0) out.push('EMPOWERED');
  if (f.guardBreakTime > 0) out.push('BROKEN');
  return out;
}

function overlaps(a: Hitbox, b: Hitbox): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function buildSkills(
  ids: string[], loadout: Loadout | null, infinite = false, forcedLevel?: number,
): EquippedSkill[] {
  void loadout;
  const levels = readSkillLevels();
  return ids.slice(0, 3).map((id) => {
    const def = SKILL_BY_ID[id] ?? SKILL_BY_ID.fire_homing;
    const level = forcedLevel ?? levels[id] ?? 1;
    const cfg = def.levels[Math.min(5, Math.max(1, level)) - 1];
    return { def, level, cfg, cooldown: infinite ? 0 : 0 };
  });
}

/** Reads persisted skill levels without importing the React store into Phaser. */
function readSkillLevels(): Record<string, number> {
  try {
    const raw = localStorage.getItem('shadowstrike.save.v1');
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { profile?: { skillLevels?: Record<string, number> } };
    return parsed.profile?.skillLevels ?? {};
  } catch {
    return {};
  }
}

function buildEquipment(l: Loadout): Partial<Record<EquipSlot, import('../../data/equipment').EquipmentDef>> {
  const out: Partial<Record<EquipSlot, import('../../data/equipment').EquipmentDef>> = {};
  for (const [slot, id] of Object.entries(l.equipment)) {
    const item = EQUIPMENT_BY_ID[id];
    if (item) out[slot as EquipSlot] = item;
  }
  return out;
}

function buildOpponentEquipment(id: string): Partial<Record<EquipSlot, import('../../data/equipment').EquipmentDef>> {
  const presets: Record<string, string[]> = {
    kage: ['head_hood', 'trail_white'],
    raze: ['head_horns', 'armor_dragon', 'aura_ember', 'trail_flame'],
    bastion: ['armor_heavy', 'boots_titan', 'mask_visor'],
    volt: ['aura_volt', 'gloves_storm', 'trail_white'],
    vesper: ['head_topknot', 'back_scarf', 'trail_crimson'],
    glacius: ['mask_oni', 'aura_frost', 'armor_spirit'],
    nyx: ['head_hood', 'aura_void', 'trail_void'],
    tempest: ['back_scarf', 'boots_jet', 'trail_prism'],
    oblivion: ['head_crown', 'back_wings', 'aura_void', 'armor_spirit', 'trail_void', 'mask_kitsune'],
  };
  const out: Partial<Record<EquipSlot, import('../../data/equipment').EquipmentDef>> = {};
  for (const itemId of presets[id] ?? []) {
    const item = EQUIPMENT_BY_ID[itemId];
    if (item) out[item.slot] = item;
  }
  return out;
}
