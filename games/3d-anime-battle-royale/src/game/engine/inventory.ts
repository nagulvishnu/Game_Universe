import { ARMOR_TIERS, HELMET_TIERS, ITEMS, PACK_TIERS } from '../data/items';
import { ATTACHMENTS, AMMO_WEIGHT, WEAPONS, WeaponInst, newWeapon, weaponStats, AttachSlot } from '../data/weapons';
import { Fighter, Loot } from './types';
import type { Game } from './Game';

export const capacity = (f: Fighter) => PACK_TIERS[f.pack].cap;
export function load(f: Fighter) {
  let w = (f.ammo.light + f.ammo.rifle + f.ammo.sniper + f.ammo.shell) * AMMO_WEIGHT;
  w += f.heal.bandage * 1 + f.heal.medkit * 5 + f.throws.frag * 3 + f.throws.smoke * 2 + f.throws.flash * 2;
  for (const k in f.atts) w += (f.atts[k] || 0) * ATTACHMENTS[k].weight;
  return w;
}
export const free = (f: Fighter) => Math.max(0, capacity(f) - load(f));

export function equipSlot(g: Game, f: Fighter, slot: number) {
  if (slot === f.cur || !f.slots[slot] || f.state !== 'ground') return;
  f.reloadT = 0; f.healT = 0; f.healItem = ''; f.burstLeft = 0;
  f.cur = slot; f.switchT = 0.5;
  if (f.isPlayer) g.sound({ k: 'click' });
}

function placeWeapon(g: Game, f: Fighter, inst: WeaponInst): string {
  const d = WEAPONS[inst.id];
  const isPistol = d.cat === 'PISTOL';
  let slot = -1;
  if (isPistol) slot = 2;
  else if (!f.slots[0]) slot = 0;
  else if (!f.slots[1]) slot = 1;
  else slot = f.cur === 2 || f.cur > 1 ? 0 : f.cur;
  const old = f.slots[slot];
  if (old) dropWeaponInst(g, f, old);
  f.slots[slot] = inst;
  if (!f.slots[f.cur] || f.cur === 2 || slot === f.cur || f.slots[f.cur] === null) { f.cur = slot; f.switchT = 0.5; f.reloadT = 0; }
  return d.name;
}

export function dropWeaponInst(g: Game, f: Fighter, inst: WeaponInst) {
  g.dropHint = f.pos.y;
  const a = Math.random() * 6.28;
  g.spawnLoot(f.pos.x + Math.cos(a) * 1.4, f.pos.z + Math.sin(a) * 1.4, 'w_' + inst.id, 1, inst);
}

export function dropSlot(g: Game, f: Fighter, slot: number) {
  const w = f.slots[slot];
  if (!w) return;
  f.slots[slot] = null;
  f.reloadT = 0;
  dropWeaponInst(g, f, w);
  if (f.cur === slot) { const n = f.slots.findIndex((s) => !!s); f.cur = n < 0 ? 0 : n; }
}

export function pickup(g: Game, f: Fighter, l: Loot): string | null {
  g.dropHint = f.pos.y;
  const def = ITEMS[l.item];
  if (!def) return null;
  switch (def.kind) {
    case 'weapon': {
      const inst = l.inst ?? newWeapon(def.ref!);
      const nm = placeWeapon(g, f, inst);
      g.removeLoot(l);
      return nm;
    }
    case 'ammo': {
      const t = def.ref as 'light' | 'rifle' | 'sniper' | 'shell';
      const can = Math.floor(free(f) / AMMO_WEIGHT + 1e-6);
      const take = Math.min(can, l.qty);
      if (take <= 0) return null;
      f.ammo[t] += take; l.qty -= take;
      if (l.qty <= 0) g.removeLoot(l);
      return `${def.name} x${take}`;
    }
    case 'armor': {
      const lv = def.level!;
      if (lv <= f.armor && f.armorHp > 0) return null;
      if (f.armor > 0 && f.armorHp > 0) g.spawnLoot(f.pos.x + 1, f.pos.z + 1, 'armor_' + f.armor, 1, undefined, f.armorHp);
      f.armor = lv; f.armorHp = l.cond ?? ARMOR_TIERS[lv].hp;
      g.removeLoot(l);
      return def.name;
    }
    case 'helmet': {
      const lv = def.level!;
      if (lv <= f.helmet && f.helmetHp > 0) return null;
      if (f.helmet > 0 && f.helmetHp > 0) g.spawnLoot(f.pos.x + 1, f.pos.z + 1, 'helmet_' + f.helmet, 1, undefined, f.helmetHp);
      f.helmet = lv; f.helmetHp = l.cond ?? HELMET_TIERS[lv].hp;
      g.removeLoot(l);
      return def.name;
    }
    case 'backpack': {
      const lv = def.level!;
      if (lv <= f.pack) return null;
      if (f.pack > 0) g.spawnLoot(f.pos.x + 1, f.pos.z + 1, 'pack_' + f.pack, 1);
      f.pack = lv;
      g.removeLoot(l);
      return def.name;
    }
    case 'heal': case 'throw': case 'attach': {
      const w = def.weight || 1;
      const can = Math.floor(free(f) / w + 1e-6);
      const take = Math.min(can, l.qty);
      if (take <= 0) return null;
      if (def.kind === 'heal') f.heal[def.id] += take;
      else if (def.kind === 'throw') f.throws[def.id] += take;
      else f.atts[def.ref!] = (f.atts[def.ref!] || 0) + take;
      l.qty -= take;
      if (l.qty <= 0) g.removeLoot(l);
      return `${def.name}${take > 1 ? ' x' + take : ''}`;
    }
  }
  return null;
}

export function dropItem(g: Game, f: Fighter, kind: string, id: string) {
  g.dropHint = f.pos.y;
  const a = Math.random() * 6.28, x = f.pos.x + Math.cos(a) * 1.3, z = f.pos.z + Math.sin(a) * 1.3;
  if (kind === 'ammo' && f.ammo[id as 'light'] > 0) { const q = Math.min(30, f.ammo[id as 'light']); f.ammo[id as 'light'] -= q; g.spawnLoot(x, z, 'ammo_' + id, q); }
  else if (kind === 'heal' && f.heal[id] > 0) { f.heal[id]--; g.spawnLoot(x, z, id, 1); }
  else if (kind === 'throw' && f.throws[id] > 0) { f.throws[id]--; g.spawnLoot(x, z, id, 1); }
  else if (kind === 'attach' && f.atts[id] > 0) { f.atts[id]--; g.spawnLoot(x, z, 'att_' + id, 1); }
  else if (kind === 'armor' && f.armor > 0) { g.spawnLoot(x, z, 'armor_' + f.armor, 1, undefined, f.armorHp); f.armor = 0; f.armorHp = 0; }
  else if (kind === 'helmet' && f.helmet > 0) { g.spawnLoot(x, z, 'helmet_' + f.helmet, 1, undefined, f.helmetHp); f.helmet = 0; f.helmetHp = 0; }
  else if (kind === 'backpack' && f.pack > 0) { g.spawnLoot(x, z, 'pack_' + f.pack, 1); f.pack = 0; }
}

export function attach(f: Fighter, slot: number, attId: string): boolean {
  const w = f.slots[slot];
  const a = ATTACHMENTS[attId];
  if (!w || !a || !(f.atts[attId] > 0)) return false;
  const d = WEAPONS[w.id];
  if (a.cats && !a.cats.includes(d.cat)) return false;
  const old = w.att[a.slot as AttachSlot];
  if (old) f.atts[old] = (f.atts[old] || 0) + 1;
  w.att[a.slot as AttachSlot] = attId;
  f.atts[attId]--;
  return true;
}

export function detach(f: Fighter, slot: number, s: AttachSlot) {
  const w = f.slots[slot];
  if (!w || !w.att[s]) return;
  const id = w.att[s]!;
  f.atts[id] = (f.atts[id] || 0) + 1;
  delete w.att[s];
  const max = weaponStats(w).magSize;
  if (w.mag > max) { f.ammo[WEAPONS[w.id].ammo] += w.mag - max; w.mag = max; }
}

export function startReload(g: Game, f: Fighter) {
  const w = f.weapon;
  if (!w || f.reloadT > 0 || f.state !== 'ground' || f.healT > 0) return false;
  const st = weaponStats(w);
  if (w.mag >= st.magSize || f.ammo[st.def.ammo] <= 0) return false;
  f.reloadTotal = st.def.reloadEach ?? st.def.reload;
  f.reloadT = f.reloadTotal;
  f.burstLeft = 0;
  g.sound({ k: 'reload', x: f.pos.x, y: f.pos.y, z: f.pos.z });
  return true;
}

export function updateTimers(g: Game, f: Fighter, dt: number) {
  f.fireCd -= dt; f.switchT -= dt; f.hitT -= dt; f.landT -= dt; f.kickT -= dt; f.flashT -= dt;
  f.bloom = Math.max(0, f.bloom - dt * 1.8);
  if (f.reloadT > 0) {
    f.reloadT -= dt;
    const w = f.weapon;
    if (!w) f.reloadT = 0;
    else if (f.reloadT <= 0) {
      const st = weaponStats(w);
      if (st.def.reloadEach) {
        if (w.mag < st.magSize && f.ammo[st.def.ammo] > 0) {
          w.mag++; f.ammo[st.def.ammo]--;
          g.sound({ k: 'reload', x: f.pos.x, y: f.pos.y, z: f.pos.z });
          if (w.mag < st.magSize && f.ammo[st.def.ammo] > 0) f.reloadT = st.def.reloadEach;
        }
      } else {
        const take = Math.min(st.magSize - w.mag, f.ammo[st.def.ammo]);
        w.mag += take; f.ammo[st.def.ammo] -= take;
      }
    }
  }
  // healing channel
  if (f.healT > 0) {
    if (f.cmd.fire || f.cmd.sprint || f.state !== 'ground') { f.healT = 0; f.healItem = ''; }
    else {
      f.healT -= dt;
      if (f.healT <= 0 && f.healItem) {
        const it = f.healItem;
        if (f.heal[it] > 0) {
          f.heal[it]--;
          f.hp = it === 'bandage' ? Math.max(f.hp, Math.min(75, f.hp + 15)) : 100;
          if (f.isPlayer) g.sound({ k: 'heal' });
        }
        f.healItem = '';
      }
    }
  }
}

export function startHeal(g: Game, f: Fighter, item: string) {
  if (f.state !== 'ground' || f.healT > 0 || f.heal[item] <= 0 || f.reloadT > 0) return false;
  if (item === 'bandage' && f.hp >= 75) return false;
  if (item === 'medkit' && f.hp >= 100) return false;
  f.healItem = item; f.healT = item === 'bandage' ? 2.2 : 4.2;
  return true;
}

export function giveAll(f: Fighter) {
  f.slots[0] = newWeapon('ar01'); f.slots[1] = newWeapon('longshot'); f.slots[2] = newWeapon('strike9');
  f.ammo = { light: 400, rifle: 400, sniper: 100, shell: 100 };
  f.heal = { bandage: 5, medkit: 3 }; f.throws = { frag: 3, smoke: 2, flash: 2 };
  f.pack = 3; f.armor = 3; f.armorHp = ARMOR_TIERS[3].hp; f.helmet = 3; f.helmetHp = HELMET_TIERS[3].hp;
  f.atts = { reddot: 1, scope4: 1, scope8: 1, extmag: 2, suppressor: 1, compensator: 1, foregrip: 1 };
}
