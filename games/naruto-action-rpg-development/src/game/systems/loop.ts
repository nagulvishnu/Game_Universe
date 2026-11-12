import { rt } from '../runtime';
import { useGame } from '../store';
import { useHud } from '../hudStore';
import { input } from '../input';
import { audio } from '../audio';
import { updatePlayer } from './player';
import { updateAllies } from './allies';
import { updateEnemies, updateTelegraphs } from './enemies';
import { updateProjectiles, updateDots } from './combat';
import { updateSummon } from './abilities';
import { updateFx } from './fx';
import { updateWorld } from './missions';
import { updateHud } from './hud';

let combatT = 0; let musicT = 0; let ambT = 0;

/** Single authoritative simulation step; called once per frame from the R3F loop. */
export function gameTick(rawDt: number) {
  const g = useGame.getState();
  if (!rt.playing) { input.endFrame(); return; }
  rawDt = Math.min(rawDt, 0.1);
  // UI overlays pause the simulation (but visuals keep animating)
  if (g.overlay !== null) { rt.paused = true; if (audio.ctx) audio.charge(false); input.endFrame(); updateHud(0, rawDt); return; }
  rt.paused = false;
  let dt = Math.min(rawDt, 0.05);
  if (rt.hitStop > 0) { rt.hitStop -= rawDt; dt *= 0.04; }
  if (rt.slowT > 0) { rt.slowT -= rawDt; dt *= 0.32; }
  rt.t += dt; rt.playtime += rawDt;
  rt.timeOfDay = (rt.timeOfDay + dt / 600) % 1; // one in-game day = 10 minutes
  // scheduled callbacks
  for (let i = rt.sched.length - 1; i >= 0; i--) { rt.sched[i].t -= dt; if (rt.sched[i].t <= 0) { const f = rt.sched[i].fn; rt.sched.splice(i, 1); f(); } }
  // cinematic camera timer (real time)
  if (rt.cine) { rt.cine.t += rawDt; if (rt.cine.t >= rt.cine.dur) { rt.cine = null; } }
  const lb = !!rt.cine && (rt.cine.kind === 'boss' || rt.cine.kind === 'form' || rt.cine.kind === 'victory' || rt.cine.kind === 'ult');
  if (useHud.getState().letterbox !== lb) useHud.setState({ letterbox: lb });

  updatePlayer(dt);
  updateAllies(dt);
  updateEnemies(dt);
  updateProjectiles(dt);
  updateDots(dt);
  updateTelegraphs(dt);
  updateSummon(dt);
  updateWorld(dt);
  updateFx(dt);
  for (let i = rt.floaters.length - 1; i >= 0; i--) { const f = rt.floaters[i]; f.t += dt; f.y += f.vy * dt; f.vy *= 0.94; if (f.t > 1.2) rt.floaters.splice(i, 1); }
  for (let i = rt.logs.length - 1; i >= 0; i--) { rt.logs[i].t += dt; if (rt.logs[i].t > 0.8) rt.logs.splice(i, 1); }
  rt.shake = Math.max(0, rt.shake - rawDt * 2.2); rt.flash = Math.max(0, rt.flash - rawDt * 1.6); rt.mistT = Math.max(0, rt.mistT - dt);

  // adaptive music / ambience
  let near = false;
  for (const e of rt.enemies) if (e.def.tier !== 'dummy' && e.state !== 'dead' && (e.state === 'chase' || e.state === 'windup' || e.state === 'attack' || e.state === 'recover') && Math.hypot(e.pos.x - rt.player.pos.x, e.pos.z - rt.player.pos.z) < 28) { near = true; break; }
  combatT = near ? 4 : Math.max(0, combatT - rawDt);
  musicT -= rawDt; if (musicT <= 0) {
    musicT = 0.4;
    audio.setMusic(rt.boss && rt.boss.state !== 'dead' ? 'boss' : combatT > 0 ? 'battle' : rt.zone.music);
  }
  ambT -= rawDt; if (ambT <= 0) { ambT = 1; const sun = Math.sin((rt.timeOfDay - 0.25) * Math.PI * 2); audio.setAmbience(rt.zone.id, sun < -0.05); }
  updateHud(dt, rawDt);
  input.endFrame();
}
