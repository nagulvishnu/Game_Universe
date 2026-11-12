import type { Objective, Stage } from '../types';

export type MissionEvent =
  | { t: 'talk'; npc: string }
  | { t: 'kill'; def: string; tag?: string }
  | { t: 'collect'; kind: string }
  | { t: 'ability'; id: string }
  | { t: 'boss'; id: string }
  | { t: 'pos'; x: number; y: number; z: number }
  | { t: 'tick'; dt: number; charging: boolean };

export function objectiveRequired(o: Objective): number {
  switch (o.type) {
    case 'kill': case 'collect': case 'ability': return o.count;
    case 'checkpoints': return o.points.length;
    case 'survive': case 'charge': return o.seconds;
    default: return 1;
  }
}
export const newProgress = (stage: Stage): number[] => stage.objectives.map(() => 0);
export const objectiveDone = (o: Objective, p: number) => p >= objectiveRequired(o) - 1e-6;
export const stageComplete = (stage: Stage, progress: number[]) => stage.objectives.every((o, i) => objectiveDone(o, progress[i] ?? 0));

export function applyEvent(stage: Stage, progress: number[], ev: MissionEvent): number[] {
  const next = progress.slice();
  stage.objectives.forEach((o, i) => {
    const cur = next[i] ?? 0; const req = objectiveRequired(o);
    if (cur >= req) return;
    switch (o.type) {
      case 'talk': if (ev.t === 'talk' && ev.npc === o.npc) next[i] = 1; break;
      case 'kill':
        if (ev.t === 'kill' && (!o.def || o.def === ev.def) && (!o.tag || o.tag === ev.tag)) next[i] = cur + 1; break;
      case 'collect': if (ev.t === 'collect' && ev.kind === o.kind) next[i] = cur + 1; break;
      case 'ability': if (ev.t === 'ability' && ev.id === o.ability) next[i] = cur + 1; break;
      case 'boss': if (ev.t === 'boss' && ev.id === o.boss) next[i] = 1; break;
      case 'reach':
        if (ev.t === 'pos' && Math.hypot(ev.x - o.pos[0], ev.z - o.pos[1]) <= o.radius && (o.minY === undefined || ev.y >= o.minY)) next[i] = 1;
        break;
      case 'checkpoints':
        if (ev.t === 'pos') {
          const pt = o.points[cur];
          if (pt && Math.hypot(ev.x - pt[0], ev.z - pt[1]) <= o.radius && (pt[2] === undefined || ev.y >= pt[2] - 1.2)) next[i] = cur + 1;
        }
        break;
      case 'survive': if (ev.t === 'tick') next[i] = Math.min(req, cur + ev.dt); break;
      case 'charge': if (ev.t === 'tick' && ev.charging) next[i] = Math.min(req, cur + ev.dt); break;
    }
  });
  return next;
}

export function objectiveLabel(o: Objective, p: number): string {
  switch (o.type) {
    case 'kill': case 'collect': case 'ability': return `${o.label} (${Math.min(p, o.count)}/${o.count})`;
    case 'checkpoints': return `${o.label} (${p}/${o.points.length})`;
    case 'survive': case 'charge': return `${o.label} (${Math.floor(p)}/${o.seconds}s)`;
    default: return o.label;
  }
}

/** World-space marker for an objective (for HUD compass / map). */
export function objectiveTarget(o: Objective, p: number, npcPos: (id: string) => [number, number] | undefined): [number, number] | undefined {
  switch (o.type) {
    case 'talk': return npcPos(o.npc);
    case 'reach': return o.pos;
    case 'checkpoints': { const pt = o.points[Math.min(p, o.points.length - 1)]; return pt ? [pt[0], pt[1]] : undefined; }
    default: return undefined;
  }
}

/** Rank/level/prerequisite gate for a mission. */
export function missionAvailable(
  def: { minRank: number; minLevel?: number; requires?: string[]; status: string },
  rank: number, level: number, completed: string[],
): { ok: boolean; reason?: string } {
  if (def.status !== 'playable') return { ok: false, reason: 'Not yet playable' };
  if (rank < def.minRank) return { ok: false, reason: 'Rank too low' };
  if (def.minLevel && level < def.minLevel) return { ok: false, reason: `Requires level ${def.minLevel}` };
  if (def.requires?.some((r) => !completed.includes(r))) return { ok: false, reason: 'Complete earlier chapters first' };
  return { ok: true };
}
