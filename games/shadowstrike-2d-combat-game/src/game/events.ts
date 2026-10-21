/** Lightweight typed bridge between the Phaser gameplay loop and React UI. */

export interface SkillHudState {
  id: string;
  name: string;
  level: number;
  cooldown: number;     // ms remaining
  cooldownMax: number;  // ms total
  color: string;
}

export interface FighterHud {
  name: string;
  health: number;
  maxHealth: number;
  guard: number;
  maxGuard: number;
  combo: number;
  charge: number;       // 0..1
  weapon: string;
  skills: SkillHudState[];
  statuses: string[];
  rounds: number;
}

export interface HudSnapshot {
  p1: FighterHud;
  p2: FighterHud;
  timer: number;
  round: number;
  maxRounds: number;
  phase: 'intro' | 'fight' | 'roundover' | 'matchover' | 'paused';
  announcement: string | null;
  frameData: string | null;
  fps: number;
  /** Present only during a boss encounter. */
  boss?: {
    id: string;
    name: string;
    health: number;
    maxHealth: number;
    phase: number;
    phaseName: string;
  };
}

export interface MatchOverPayload {
  winner: 'p1' | 'p2' | 'draw';
  damageDealt: number;
  damageTaken: number;
  highestCombo: number;
  durationMs: number;
  rounds: [number, number];
  /** Set when the match was a boss encounter. */
  bossId?: string;
}

type Handler<T> = (payload: T) => void;

class Emitter {
  private hud: Handler<HudSnapshot>[] = [];
  private over: Handler<MatchOverPayload>[] = [];
  private pause: Handler<boolean>[] = [];
  private skillUse: Handler<string>[] = [];

  onHud(h: Handler<HudSnapshot>) { this.hud.push(h); return () => { this.hud = this.hud.filter((x) => x !== h); }; }
  emitHud(p: HudSnapshot) { for (const h of this.hud) h(p); }

  onMatchOver(h: Handler<MatchOverPayload>) { this.over.push(h); return () => { this.over = this.over.filter((x) => x !== h); }; }
  emitMatchOver(p: MatchOverPayload) { for (const h of this.over) h(p); }

  onPause(h: Handler<boolean>) { this.pause.push(h); return () => { this.pause = this.pause.filter((x) => x !== h); }; }
  emitPause(p: boolean) { for (const h of this.pause) h(p); }

  onSkillUse(h: Handler<string>) { this.skillUse.push(h); return () => { this.skillUse = this.skillUse.filter((x) => x !== h); }; }
  emitSkillUse(id: string) { for (const h of this.skillUse) h(id); }

  clear() { this.hud = []; this.over = []; this.pause = []; this.skillUse = []; }
}

export const gameEvents = new Emitter();
