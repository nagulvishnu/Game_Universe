import { rt } from '../runtime';
import { useHud, type CdInfo } from '../hudStore';
import { useGame } from '../store';
import { CHARACTERS } from '../data/characters';
import { ABILITIES } from '../data/abilities';
import { xpForLevel, isAbilityUnlocked } from '../logic/stats';
import { ultFor, abilityCost, cooldownOf } from './abilities';
import { input } from '../input';

export function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3); if (code.startsWith('Digit')) return code.slice(5);
  const m: Record<string, string> = { Space: 'Space', ShiftLeft: 'Shift', ShiftRight: 'Shift', ControlLeft: 'Ctrl', Tab: 'Tab', Escape: 'Esc', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Enter: 'Enter' };
  return m[code] ?? code;
}

let acc = 0; let frames = 0; let fpsAcc = 0;
export function updateHud(_dt: number, rawDt: number) {
  frames++; fpsAcc += rawDt;
  acc += rawDt; if (acc < 1 / 15) return; acc = 0;
  const fps = Math.round(frames / fpsAcc); frames = 0; fpsAcc = 0;
  const p = rt.player; const g = useGame.getState(); const prof = g.profile; const c = prof.chars[prof.charId]; const ch = CHARACTERS[prof.charId]; const b = g.settings.bindings;
  const mk = (id: string, key: string, ult = false): CdInfo => {
    const a = ult ? ultFor() : ABILITIES[id];
    if (!a) return { id: '', name: '-', icon: '·', key, rem: 0, total: 1, cost: 0, locked: true, color: '#666' };
    const locked = !(isAbilityUnlocked(a.id, c.level, prof.flags)) && !a.needsForm;
    return { id: a.id, name: a.name, icon: a.icon, key, rem: ult ? Math.max(0, 100 - p.ult) : p.cd[a.id] ?? 0, total: ult ? 100 : Math.max(0.1, cooldownOf(a)), cost: abilityCost(a), locked, color: a.color };
  };
  const slots: CdInfo[] = [mk(c.equipped[0], keyLabel(b.a1)), mk(c.equipped[1], keyLabel(b.a2)), mk(c.equipped[2], keyLabel(b.a3)), mk(c.equipped[3], keyLabel(b.a4)), mk(ch.special, keyLabel(b.special)), mk('', keyLabel(b.ultimate), true)];
  let target: ReturnType<typeof useHud.getState>['target'] = null;
  let te = rt.lock;
  if (!te || te.state === 'dead') { te = null; let bd = 14; for (const e of rt.enemies) { if (e.state === 'dead' || e.hp >= e.maxHp || e === rt.boss) continue; const d = Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z); if (d < bd) { bd = d; te = e; } } }
  if (te && te !== rt.boss) target = { name: te.def.name, hp: Math.max(0, te.hp), max: te.maxHp, tier: te.def.tier, level: te.lv, status: (['stun', 'confuse', 'burn', 'slow'] as const).filter((s) => te!.status[s] > 0) };
  const bs = rt.boss;
  const boss = bs && bs.def.tier === 'boss' ? { name: bs.def.name, title: bs.def.title ?? '', hp: Math.max(0, bs.hp), max: bs.maxHp, phase: bs.phase, shield: bs.shield / Math.max(1, bs.maxHp) } : null;
  const t = rt.timeOfDay * 24; const hh = Math.floor(t), mm = Math.floor((t - hh) * 60);
  const sun = Math.sin((rt.timeOfDay - 0.25) * Math.PI * 2);
  const prompt = rt.interact ? `${keyLabel(b.interact)} — ${rt.interact.label}` : null;
  useHud.setState({
    hp: p.hp, maxHp: p.stats.maxHp, chakra: p.chakra, maxChakra: p.stats.maxChakra, stamina: p.stamina, ult: p.ult, slots, form: p.form, formRem: p.formT, formTotal: p.formDur,
    target, boss, prompt, clock: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, night: sun < -0.05, combo: rt.comboCount, genjutsu: p.confuseT > 0, locked: !!rt.lock,
    guard: p.blocking, charging: p.charging, fps, level: c.level, xp: c.xp, xpNeed: xpForLevel(c.level), charName: ch.name.split(' ')[0], charColor: ch.color, ryo: prof.ryo,
    pointerLocked: input.locked || input.lockFailed,
  });
}
