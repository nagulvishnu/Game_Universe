import { useGame } from './store';
import { defaultProfile, type Profile, type SaveData } from './logic/profile';
import { SAVE_VERSION } from './config';
import { writeSave, readSave, latestSave } from './persistence';
import { CHARACTERS } from './data/characters';
import { rt, createPlayer, bump } from './runtime';
import { input } from './input';
import { audio } from './audio';
import { bus } from './bus';
import { pushToast, useHud } from './hudStore';
import { clearFx } from './systems/fx';
import { initWorld, restoreMission, restartStage, resetMissionModule, abandonMission } from './systems/missions';
import { refreshStats } from './systems/player';
import { moveXZ } from './systems/move';
import { clearEnemies } from './systems/enemies';
import { clearAllies } from './systems/allies';
import { zoneAt } from './config';

export function snapshotProfile(): Profile {
  const s = useGame.getState().profile;
  return {
    ...s, pos: { x: rt.player.pos.x, z: rt.player.pos.z }, timeOfDay: rt.timeOfDay, playtime: rt.playtime,
    activeMission: rt.mission ? { ...rt.mission, progress: rt.mission.progress.slice() } : s.activeMission,
  };
}
function labelFor(p: Profile) {
  const c = p.chars[p.charId]; const z = zoneAt(p.pos.x, p.pos.z);
  return `${CHARACTERS[p.charId].name} Lv.${c.level} — ${z.name}`;
}

export async function saveGame(slot: string, quiet = false): Promise<boolean> {
  if (!rt.playing) return false;
  const profile = snapshotProfile();
  const data: SaveData = { version: SAVE_VERSION, savedAt: Date.now(), slot, label: labelFor(profile), profile };
  const ok = await writeSave(slot, data);
  if (!quiet) pushToast(ok ? `Game saved (${slot === 'auto' ? 'autosave' : slot.replace('slot', 'Slot ')})` : 'Save failed!', ok ? 'good' : 'warn');
  return ok;
}
let lastAuto = 0;
export async function autosave() {
  if (!rt.playing || rt.player.dead || performance.now() - lastAuto < 4000) return; lastAuto = performance.now();
  const ok = await saveGame('auto', true); if (ok) useHud.setState({ fps: useHud.getState().fps });
}
bus.on('autosave', () => { void autosave(); });
bus.on('levelup', () => { refreshStats(true); const p = rt.player; if (rt.playing) { import('./systems/fx').then((fx) => { fx.ring(p.pos.x, 0.3, p.pos.z, { color: '#ffe14a', r1: 5, life: 0.8 }); fx.burst(p.pos.x, 1, p.pos.z, { n: 40, color: '#ffe14a', color2: '#fff', speed: 6, up: 4, life: 1.1 }); }); audio.sfx('levelup'); bus.emit('autosave'); } });
bus.on('statsChanged', () => { if (rt.playing) refreshStats(); });
bus.on('charChanged', () => { if (rt.playing) { refreshStats(true); rt.player.cd = {}; rt.player.form = 'base'; rt.player.formT = 0; clearAllies({ clones: true }); pushToast(`Switched to ${CHARACTERS[useGame.getState().profile.charId].name}`, 'info'); } });
bus.on('useItem', (u: { heal?: number; chakra?: number; jutsuBuff?: number }) => {
  const p = rt.player; if (!rt.playing) return;
  if (u.heal) { p.hp = Math.min(p.stats.maxHp, p.hp + u.heal); }
  if (u.chakra) p.chakra = Math.min(p.stats.maxChakra, p.chakra + u.chakra);
  if (u.jutsuBuff) p.focusT = 90;
});
bus.on('playerDead', () => {
  const p = rt.player; if (p.dead) return;
  p.dead = true; p.hp = 0; p.action = { kind: 'dead', t: 0, dur: 99, hitAt: 99, fired: true, idx: 0 }; p.dash = null; p.orb = null; p.charging = false; audio.charge(false); audio.sfx('dead');
  rt.slowT = 1; setTimeout(() => { if (rt.playing && rt.player.dead) { input.releaseLock(); useGame.getState().setOverlay('gameover'); } }, 1500);
});

/** Called when the 3D scene mounts. Builds a fresh runtime from the store profile. */
export function initGame(showIntro: boolean) {
  const prof = useGame.getState().profile;
  rt.enemies = []; rt.allies = []; rt.projectiles = []; rt.telegraphs = []; rt.floaters = []; rt.dots = []; rt.logs = []; rt.sched = []; rt.summon = null;
  rt.lock = null; rt.cine = null; rt.boss = null; rt.mission = null; rt.waveQueue = []; rt.mistT = 0; rt.shake = 0; rt.flash = 0; rt.slowT = 0; rt.hitStop = 0; rt.timeScale = 1;
  rt.comboCount = 0; rt.interact = null; rt.chargeAcc = 0; rt.victoryT = 0;
  clearFx(); resetMissionModule();
  rt.player = createPlayer();
  const p = rt.player; p.charId = prof.charId; p.pos.x = prof.pos.x; p.pos.z = prof.pos.z; p.pos.y = 0;
  moveXZ(p.pos, 0, 0, 0.45);
  refreshStats(true); p.yaw = Math.PI; rt.camYaw = Math.PI; rt.camPitch = 0.35;
  rt.timeOfDay = prof.timeOfDay; rt.playtime = prof.playtime; rt.checkpoint = { x: p.pos.x, z: p.pos.z };
  initWorld(); restoreMission();
  rt.playing = true; bump('enemies'); bump('allies');
  input.reset();
  audio.unlock();
  if (showIntro) {
    useGame.getState().openDialogue([
      { speaker: 'Narrator', text: 'The Hidden Leaf Village, Land of Fire. The sun rises over the Hokage Monument.' },
      { speaker: 'Naruto', text: 'Today I\'m going to graduate from the Academy — believe it! Then I\'ll become Hokage!', portrait: 'naruto' },
      { speaker: 'Narrator', text: 'Walk west to the Academy and press T to talk to Iruka. Open the world map with M. Click the game to capture the mouse.' },
    ]);
  }
}

export function startSession(profile: Profile, intro = false) {
  const g = useGame.getState();
  g.setProfile(profile); g.newSession();
  rt.playing = false;
  pendingIntro = intro;
  g.setScreen('playing');
}
let pendingIntro = false;
export const consumeIntro = () => { const v = pendingIntro; pendingIntro = false; return v; };

export function newGame() { startSession(defaultProfile(), true); }
export async function continueGame(): Promise<boolean> {
  const d = await latestSave(); if (!d) return false;
  startSession(d.profile); return true;
}
export async function loadSlot(slot: string): Promise<'ok' | 'empty' | 'corrupt'> {
  const r = await readSave(slot);
  if (r.status !== 'ok') return r.status;
  startSession(r.data.profile); return 'ok';
}
export function quitToMenu() {
  if (rt.playing) void saveGame('auto', true);
  rt.playing = false; audio.stopAll(); input.releaseLock(); input.reset();
  useGame.getState().setScreen('menu');
}

/** After defeat: respawn at the checkpoint and reset the current mission stage. */
export function respawn(toVillage: boolean) {
  const p = rt.player; const g = useGame.getState();
  const spot = toVillage ? { x: 2, z: 18 } : rt.checkpoint;
  clearEnemies((e) => !e.fromMission); rt.projectiles = []; rt.telegraphs = []; rt.dots = []; clearAllies({ clones: true });
  p.dead = false; p.hp = p.stats.maxHp; p.chakra = p.stats.maxChakra; p.stamina = 100; p.action = null; p.invuln = 2; p.pos.x = spot.x; p.pos.z = spot.z; p.pos.y = 0; p.vel.x = p.vel.z = p.vel.y = 0;
  p.form = 'base'; p.formT = 0; p.cd = {}; p.confuseT = 0; rt.lock = null; rt.cine = null; rt.mistT = 0; p.ult = Math.min(p.ult, 50);
  moveXZ(p.pos, 0, 0, 0.45);
  if (rt.mission) restartStage();
  g.setOverlay(null); input.requestLock();
}
export { abandonMission };
