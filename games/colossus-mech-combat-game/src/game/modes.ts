// Game mode flow: campaign missions, arena waves, boss assault, survival, city defense
import * as THREE from 'three';
import { MISSIONS, MONSTER_LIST, BOSS_LIST, MONSTERS, type Mission } from './data';
import { useHud } from './store';
import { spawnEnemy, killEnemy, type Enemy } from './enemies';
import { audio } from './audio';
import type { Game } from './engine';

export interface ModeState { phase: string; wave: number; total: number; queue: string[]; inter: number; mission?: Mission; bossId?: string; bossDown: boolean; spawnT: number; cityMin: number; choices: { id: string; name: string; desc: string }[] | null; waiting: boolean; endT: number; hudT: number; bossWave: boolean; hpScale: number; cur: string[] }
const UPGRADES = [
  { id: 'hull', name: 'Reinforced Plating', desc: '+15% max hull and repairs 30%' }, { id: 'core', name: 'Overcharged Core', desc: '+20% max energy, +15% regen' },
  { id: 'dmg', name: 'Weapon Calibration', desc: '+15% damage output' }, { id: 'speed', name: 'Servo Boost', desc: '+8% movement speed' }, { id: 'regen', name: 'Nano Repair Swarm', desc: 'Regenerate 4 hull per second' },
  { id: 'beacon', name: 'Beacon Fortification', desc: 'Restore 50% beacon integrity' }, { id: 'ult', name: 'Ultimate Charge', desc: '+60% ultimate charge' }, { id: 'armor', name: 'Ablative Armor', desc: 'Refill armor, +25% armor pool' },
];
const NAMES: Record<string, string> = { arena: 'ARENA MAYHEM', survival: 'SURVIVAL', city: 'CITY DEFENSE', boss: 'BOSS ASSAULT', campaign: 'CAMPAIGN' };

export function initMode(g: Game) {
  const c = g.cfg; const M: ModeState = { phase: 'intro', wave: 0, total: 0, queue: [], inter: 0, bossDown: false, spawnT: 0, cityMin: 0, choices: null, waiting: false, endT: 0, hudT: 0, bossWave: false, hpScale: 1, cur: [] }; g.M = M;
  if (c.mode === 'campaign') { M.mission = MISSIONS[c.mission || 0]; M.total = M.mission.waves.length + (M.mission.boss ? 1 : 0); if (M.mission.cityDefense) M.cityMin = 25; M.bossId = M.mission.boss; }
  else if (c.mode === 'boss') { M.total = 1; M.bossId = c.boss || 'abyssalrex'; }
  else if (c.mode === 'city') { M.total = 8; M.cityMin = 35; }
  else if (c.mode === 'survival') makeBeacon(g);
  const title = M.mission ? M.mission.name : c.mode === 'boss' ? MONSTERS[M.bossId!].name : NAMES[c.mode];
  const sub = M.mission ? `MISSION ${M.mission.id} — ${g.theme.name.split('—')[0].trim().toUpperCase()}` : g.theme.name.toUpperCase();
  g.title = { t: title, s: sub }; g.titleT = 3.4; g.cineStart('intro', 3.4); audio.music(c.mode === 'boss' ? 'menu' : 'battle'); if (c.mode === 'boss') audio.music('battle');
  useHud.setState({ mode: c.mode, waves: M.total, wave: 0, bonus: M.mission ? M.mission.bonus.desc : '', objective: M.mission?.obj || '', choices: null, countdown: 0 });
}
function makeBeacon(g: Game) {
  const grp = new THREE.Group(); const base = new THREE.Mesh(new THREE.CylinderGeometry(5, 7, 4, 8), new THREE.MeshStandardMaterial({ color: '#4a5468', flatShading: true, metalness: 0.6, roughness: 0.4 }));
  base.position.y = 2; const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(4, 0), new THREE.MeshStandardMaterial({ color: '#ffc84a', emissive: '#ffa020', emissiveIntensity: 2, flatShading: true })); crystal.scale.y = 2; crystal.position.y = 14;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(7, 0.35, 6, 32), new THREE.MeshBasicMaterial({ color: '#ffc84a' })); ring.rotation.x = Math.PI / 2; ring.position.y = 14; grp.add(base, crystal, ring); grp.traverse(o => { o.castShadow = true; }); g.scene.add(grp);
  g.beacon = { group: grp, pos: new THREE.Vector3(0, 0, 0), hp: 4500, max: 4500, dead: false };
}
function compose(g: Game, n: number): string[] {
  const mode = g.cfg.mode; const maxT = Math.min(5, 1 + Math.floor(n / 2.3)); const pool = MONSTER_LIST.filter(m => m.id !== 'riftspawn' && m.threat <= maxT && (mode !== 'city' || m.ai !== 'burrow'));
  const count = Math.min(2 + Math.floor(n * 0.75), 9); const out: string[] = []; for (let i = 0; i < count; i++) out.push(pool[Math.floor(Math.random() * pool.length)].id);
  if (n % 5 === 0) out.push(BOSS_LIST[(n / 5 - 1) % BOSS_LIST.length].id); return out;
}
function spawnPos(g: Game, id: string): THREE.Vector3 {
  const P = g.P; const h = g.world.half - 12; const p = new THREE.Vector3(); const d = MONSTERS[id]; for (let i = 0; i < 12; i++) { const a = Math.random() * Math.PI * 2; const r = 70 + Math.random() * 50; p.set(Math.cos(a) * r, 0, Math.sin(a) * r); p.x = THREE.MathUtils.clamp(p.x, -h, h); p.z = THREE.MathUtils.clamp(p.z, -h, h); if (Math.hypot(p.x - P.pos.x, p.z - P.pos.z) > 65) break; } void d; return p;
}
function startWave(g: Game) {
  const M = g.M; M.wave++; const c = g.cfg; M.bossWave = false;
  if (M.mission) { const ws = M.mission.waves; if (M.wave <= ws.length) M.queue = [...ws[M.wave - 1]]; else { M.queue = []; M.bossWave = true; } }
  else if (c.mode === 'boss') { M.queue = []; M.bossWave = true; }
  else M.queue = compose(g, M.wave);
  M.cur = [...M.queue]; M.hpScale = c.mode === 'arena' || c.mode === 'survival' || c.mode === 'city' ? 1 + (M.wave - 1) * 0.07 : 1; M.phase = 'fight'; M.spawnT = 0.3;
  g.msg(M.bossWave ? 'WARNING — MASSIVE SIGNATURE' : `WAVE ${M.wave}${M.total ? ' / ' + M.total : ''}`, 2.4); audio.sfx('warn', 0.8);
  if (M.bossWave) spawnBoss(g, M.bossId!, 1);
  else if (M.queue.some(id => MONSTERS[id].boss)) { const bi = M.queue.findIndex(id => MONSTERS[id].boss); const id = M.queue.splice(bi, 1)[0]; spawnBoss(g, id, 0.55); }
}
function spawnBoss(g: Game, id: string, hpMult: number) {
  const P = g.P; const f = new THREE.Vector3(Math.sin(g.camYaw), 0, Math.cos(g.camYaw)); const h = g.world.half - 25; const pos = P.pos.clone().addScaledVector(f, 100); pos.x = THREE.MathUtils.clamp(pos.x, -h, h); pos.z = THREE.MathUtils.clamp(pos.z, -h, h);
  if (Math.hypot(pos.x - P.pos.x, pos.z - P.pos.z) < 60) { pos.copy(P.pos).addScaledVector(f, -100); pos.x = THREE.MathUtils.clamp(pos.x, -h, h); pos.z = THREE.MathUtils.clamp(pos.z, -h, h); }
  const e = spawnEnemy(g, id, pos, { hpMult }); e.group.updateWorldMatrix(true, true); g.cineStart('boss', 5.6, e); g.sched(1.4, () => audio.roar(e.def.voice, 1)); g.sched(3.4, () => { audio.roar(e.def.voice, 1); g.shakeAdd(1.2); });
}
function trySpawn(g: Game, dt: number) {
  const M = g.M; M.spawnT -= dt; if (!M.queue.length || M.spawnT > 0) return; const alive = g.enemies.filter(e => !e.dead && !e.minion && !e.isBoss).length; if (alive >= g.maxEnemies) return;
  const id = M.queue.shift()!; const e = spawnEnemy(g, id, spawnPos(g, id), { hpMult: M.hpScale }); e.dmgMult *= 1 + (M.wave - 1) * (g.cfg.mode === 'campaign' ? 0 : 0.03); M.spawnT = 0.7;
}
export function modeOnKill(g: Game, e: Enemy) {
  const M = g.M; if (!e.isBoss) return; const finalBoss = !!(M.bossId && e.def.id === M.bossId && (M.mission || g.cfg.mode === 'boss'));
  if (finalBoss) { M.bossDown = true; M.phase = 'victory'; M.endT = 5.6; g.cineStart('bossDeath', 5.2, e); audio.music(null); g.enemies.forEach(m => { if (m !== e && !m.dead) { m.xpMult = 0; killEnemy(g, m); } }); g.msg('TARGET ELIMINATED', 4); g.sched(0.5, () => audio.sfx('bigExplode', 1)); }
  else { g.slowMo(0.4, 1.6); }
}
export function modeApplyUpgrade(g: Game, id: string) {
  const P = g.P; const M = g.M; switch (id) {
    case 'hull': P.maxHp *= 1.15; P.hp = Math.min(P.maxHp, P.hp + P.maxHp * 0.3); break; case 'core': P.maxEn *= 1.2; P.enRegen *= 1.15; break; case 'dmg': g.upgrades.dmg *= 1.15; break; case 'speed': P.baseSpeed *= 1.08; break;
    case 'regen': g.upgrades.regen += 4; break; case 'beacon': if (g.beacon) g.beacon.hp = Math.min(g.beacon.max, g.beacon.hp + g.beacon.max * 0.5); break; case 'ult': P.ult = Math.min(100, P.ult + 60); break; case 'armor': P.maxArmor *= 1.25; P.armor = P.maxArmor; break;
  }
  audio.sfx('pickup', 1); M.choices = null; M.waiting = false; M.inter = 2.2; useHud.setState({ choices: null }); g.msg('UPGRADE INSTALLED', 1.5);
}
function waveCleared(g: Game) {
  const M = g.M; const c = g.cfg; const P = g.P;
  if (M.mission || c.mode === 'boss') { const last = M.wave >= M.total; if (last || M.bossDown) { M.phase = 'victory'; M.endT = 2.6; g.msg(M.mission ? 'MISSION COMPLETE' : 'VICTORY', 3); audio.music(null); audio.sfx('victory', 1); return; } }
  if (c.mode === 'city' && M.wave >= M.total) { M.phase = 'victory'; M.endT = 2.6; g.msg('CITY DEFENDED', 3); audio.music(null); audio.sfx('victory', 1); return; }
  M.phase = 'inter'; M.inter = c.mode === 'campaign' ? 3.5 : 5; P.hp = Math.min(P.maxHp, P.hp + P.maxHp * 0.15); P.en = P.maxEn; P.ult = Math.min(100, P.ult + 15); g.msg(`WAVE ${M.wave} CLEARED`, 2.5);
  if (c.mode === 'survival') { const pool = [...UPGRADES].filter(u => u.id !== 'beacon' || g.beacon); const pick: typeof UPGRADES = []; while (pick.length < 3 && pool.length) pick.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]); M.choices = pick; M.waiting = true; useHud.setState({ choices: pick }); M.inter = 30; }
  for (let i = 0; i < 2; i++) g.dropPickup(P.pos, i ? 'energy' : 'repair', i + 1);
}
export function updateMode(g: Game, dt: number) {
  const M = g.M; const c = g.cfg; M.hudT -= dt;
  if (M.hudT <= 0) {
    M.hudT = 0.2; let obj = M.mission?.obj || ''; if (c.mode === 'arena') obj = 'Survive the onslaught — defeat every wave'; if (c.mode === 'survival') obj = 'Defend the beacon and survive'; if (c.mode === 'city') obj = `Protect the city — keep integrity above ${M.cityMin}%`; if (c.mode === 'boss') obj = `Defeat ${MONSTERS[M.bossId!].name}`;
    if (M.mission?.cityDefense) obj += ` (integrity ≥ ${M.cityMin}%)`; const left = g.enemies.filter(e => !e.dead).length + M.queue.length; useHud.setState({ wave: M.wave, waves: M.total, objective: obj, countdown: M.phase === 'inter' && !M.waiting ? Math.ceil(M.inter) : 0, enemies: left, choices: M.choices });
  }
  if (g.P.dead) return;
  switch (M.phase) {
    case 'intro': if (!g.cine) { startWave(g); } break;
    case 'fight': {
      trySpawn(g, dt); const alive = g.enemies.some(e => !e.dead); if (!M.queue.length && !alive && !g.cine && !M.bossWave) waveCleared(g); else if (M.bossWave && !alive && !M.bossDown && g.enemies.length === 0 && !g.cine) { M.bossDown = true; waveCleared(g); }
      if (M.cityMin && g.world.integrity() < M.cityMin) { g.msg('CITY LOST', 3); g.sched(1.5, () => g.finish(false)); M.phase = 'lost'; }
      if (g.beacon && g.beacon.dead) { g.msg('BEACON DESTROYED', 3); g.sched(1.5, () => g.finish(false)); M.phase = 'lost'; }
      break;
    }
    case 'inter': { M.inter -= dt; if (M.waiting) { if (M.inter <= 0 && M.choices) modeApplyUpgrade(g, M.choices[0].id); break; } if (M.inter <= 0) startWave(g); break; }
    case 'victory': { M.endT -= dt; if (M.endT <= 0) g.finish(true); break; }
  }
}
