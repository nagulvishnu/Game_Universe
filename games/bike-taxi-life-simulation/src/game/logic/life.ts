import type { GameState } from '../types';
import { BIKE_MODELS, FOOD, HOMES, modelOf, UPGRADE_COST } from '../data';
import { dayNow, makeBike, notify, savingsTx, walletTx } from '../state';
import { poiById } from '../world/city';
import { stepSim } from './sim';
import { clamp } from '../util';

export const FUEL_PRICE = 105;

export function eat(s: GameState, itemId: string): { ok: boolean; message: string } {
  const f = FOOD.find((x) => x.id === itemId);
  if (!f) return { ok: false, message: 'Unknown item' };
  if (!walletTx(s, -f.price, 'food', `${f.name}`, 'expense')) return { ok: false, message: `Not enough money in wallet (₹${f.price})` };
  const n = s.needs;
  n.hunger = clamp(n.hunger + f.hunger, 0, 100); n.thirst = clamp(n.thirst + f.thirst, 0, 100); n.energy = clamp(n.energy + f.energy, 0, 100);
  if (f.hunger > 20) s.stats.meals += 1;
  return { ok: true, message: `Enjoyed ${f.name}` };
}

export function transferToSavings(s: GameState, amount: number): { ok: boolean; message: string } {
  amount = Math.round(amount);
  if (amount <= 0) return { ok: false, message: 'Enter a valid amount' };
  if (s.wallet < amount) return { ok: false, message: 'Not enough in wallet' };
  walletTx(s, -amount, 'savings-transfer', 'Moved to personal savings', 'transfer');
  savingsTx(s, amount, 'deposit', 'Deposit from wallet');
  return { ok: true, message: `₹${amount.toLocaleString('en-IN')} saved` };
}
export function withdrawSavings(s: GameState, amount: number): { ok: boolean; message: string } {
  amount = Math.round(amount);
  if (amount <= 0 || s.savings < amount) return { ok: false, message: 'Invalid amount' };
  savingsTx(s, -amount, 'withdraw', 'Withdrawal to wallet');
  walletTx(s, amount, 'savings-transfer', 'Withdrawn from savings', 'transfer');
  return { ok: true, message: 'Withdrawn' };
}

export function issueFine(s: GameState, amount: number, reason: string) {
  const pay = Math.min(amount, s.wallet);
  if (pay > 0) walletTx(s, -pay, 'fine', `Traffic fine: ${reason}`, 'expense');
  if (amount > pay) s.player.finesDue += amount - pay;
  s.stats.finesPaid += amount;
  notify(s, `Traffic police fine ₹${amount}: ${reason}${amount > pay ? ' (remaining due at police station)' : ''}`, 'bad');
}
export function payFines(s: GameState): { ok: boolean; message: string } {
  const due = s.player.finesDue;
  if (due <= 0) return { ok: false, message: 'No pending fines' };
  if (!walletTx(s, -due, 'fine', 'Pending fines cleared', 'expense')) return { ok: false, message: 'Not enough money' };
  s.player.finesDue = 0;
  return { ok: true, message: 'Fines cleared' };
}

export function payRentDue(s: GameState): { ok: boolean; message: string } {
  if (s.player.rentOverdue <= 0) return { ok: false, message: 'No rent due' };
  const rent = s.player.homeTier === 0 ? 700 : 2400;
  if (!walletTx(s, -rent, 'rent', 'Overdue rent', 'expense')) return { ok: false, message: `Need ₹${rent}` };
  s.player.rentOverdue = 0; s.player.rentPaidUntilDay = dayNow(s) + 7;
  return { ok: true, message: 'Rent paid' };
}

export function sleep(s: GameState): { ok: boolean; message: string; minutes?: number; companyRevenue?: number } {
  if (s.player.homeTier <= 1 && s.player.rentOverdue > 0) return { ok: false, message: 'The landlord locked the room — pay the overdue rent first (table)' };
  const t = s.time % 1440;
  let minutes: number;
  if (t >= 20 * 60) minutes = 1440 - t + 6.5 * 60;
  else if (t < 4 * 60) minutes = 6.5 * 60 - t;
  else minutes = 240;
  if (minutes < 60) minutes = 60;
  const before = s.ledgerSeq;
  const comfort = HOMES[s.player.homeTier]?.comfort ?? 1;
  stepSim(s, minutes, { sleeping: true, step: 10 });
  s.needs.energy = clamp(s.needs.energy + 40 * comfort, 0, 100);
  s.needs.energy = Math.max(s.needs.energy, minutes >= 360 ? 100 : s.needs.energy);
  s.needs.health = clamp(s.needs.health + 8 * comfort, 0, 100);
  s.stats.sleeps += 1;
  const rev = s.ledger.filter((l) => l.id >= before && l.account === 'company' && l.kind === 'income').reduce((a, l) => a + l.amount, 0);
  notify(s, `You slept ${Math.round(minutes / 60)} hours. ${s.company ? `Company earned ₹${rev.toLocaleString('en-IN')} meanwhile.` : ''}`, 'info');
  return { ok: true, message: 'Good morning!', minutes, companyRevenue: rev };
}

export function refuelPersonal(s: GameState, bikeId: string): { ok: boolean; message: string } {
  const b = s.bikes.find((x) => x.id === bikeId);
  if (!b) return { ok: false, message: 'No bike' };
  const m = modelOf(b.modelId);
  const litres = (1 - b.fuel) * m.tank;
  if (litres < 0.2) return { ok: false, message: 'Tank is already full' };
  const cost = Math.round(litres * FUEL_PRICE);
  const pay = Math.min(cost, s.wallet);
  if (pay <= 0) return { ok: false, message: 'No money for fuel' };
  walletTx(s, -pay, 'fuel', `Petrol ${litres.toFixed(1)} L`, 'expense');
  b.fuel = Math.min(1, b.fuel + (pay / FUEL_PRICE) / m.tank);
  return { ok: true, message: pay < cost ? `Partial fill: ₹${pay}` : `Filled ${litres.toFixed(1)} L for ₹${pay}` };
}

export function servicePersonal(s: GameState, bikeId: string, kind: 'oil' | 'tyres' | 'brakes' | 'repair' | 'full'): { ok: boolean; message: string } {
  const b = s.bikes.find((x) => x.id === bikeId);
  if (!b) return { ok: false, message: 'No bike' };
  const costs = { oil: 700, tyres: 1500, brakes: 600, repair: Math.round(b.damage * 35), full: 700 + (b.tyres < 60 ? 1500 : 0) + (b.brakes < 60 ? 600 : 0) + Math.round(b.damage * 35) };
  const cost = costs[kind];
  if (kind === 'repair' && b.damage < 1) return { ok: false, message: 'No damage' };
  if (!walletTx(s, -cost, 'maintenance', `Garage: ${kind}`, 'expense')) return { ok: false, message: `Need ₹${cost}` };
  if (kind === 'oil' || kind === 'full') b.oil = 100;
  if (kind === 'tyres' || (kind === 'full' && b.tyres < 60)) b.tyres = 100;
  if (kind === 'brakes' || (kind === 'full' && b.brakes < 60)) b.brakes = 100;
  if (kind === 'repair' || kind === 'full') b.damage = 0;
  b.serviceHistory.push({ day: dayNow(s), kind, cost });
  return { ok: true, message: `${kind} complete (₹${cost})` };
}

export function upgradePersonal(s: GameState, bikeId: string, part: 'engine' | 'brake' | 'suspension' | 'tyre'): { ok: boolean; message: string } {
  const b = s.bikes.find((x) => x.id === bikeId);
  if (!b) return { ok: false, message: 'No bike' };
  const lvl = b.upgrades[part];
  if (lvl >= 3) return { ok: false, message: 'Already maxed' };
  const cost = UPGRADE_COST[part][lvl];
  if (!walletTx(s, -cost, 'upgrade', `${part} upgrade L${lvl + 1}`, 'expense')) return { ok: false, message: `Need ₹${cost}` };
  b.upgrades[part] = lvl + 1;
  return { ok: true, message: `${part} upgraded to level ${lvl + 1}` };
}
export function paintPersonal(s: GameState, bikeId: string, color: string, decal: number): { ok: boolean; message: string } {
  const b = s.bikes.find((x) => x.id === bikeId);
  if (!b) return { ok: false, message: 'No bike' };
  if (!walletTx(s, -1200, 'upgrade', 'Paint & decals', 'expense')) return { ok: false, message: 'Need ₹1,200' };
  b.color = color; b.decal = decal;
  return { ok: true, message: 'Fresh paint job!' };
}

export function buyPersonalBike(s: GameState, modelId: string): { ok: boolean; message: string } {
  const m = BIKE_MODELS.find((x) => x.id === modelId);
  if (!m) return { ok: false, message: 'Unknown model' };
  if (!walletTx(s, -m.price, 'bike-purchase', `Bought ${m.name}`, 'expense')) return { ok: false, message: `Need ₹${m.price.toLocaleString('en-IN')} in wallet` };
  const d = poiById.get('dealer')!;
  const b = makeBike(s, 'player', modelId, d.x + 4, d.z + 6, { fuel: 0.6 });
  s.bikes.push(b);
  notify(s, `You bought a ${m.name} (${b.plate}). It is parked outside the showroom.`, 'good');
  return { ok: true, message: `Bought ${m.name}` };
}
export function sellPersonalBike(s: GameState, bikeId: string): { ok: boolean; message: string } {
  const mine = s.bikes.filter((b) => b.owner === 'player');
  const b = mine.find((x) => x.id === bikeId);
  if (!b || mine.length < 2) return { ok: false, message: 'You must keep at least one personal bike' };
  const value = Math.round(modelOf(b.modelId).price * 0.5 * (1 - b.damage / 200) * (0.6 + (b.oil + b.tyres + b.brakes) / 750));
  walletTx(s, value, 'bike-sale', `Sold ${modelOf(b.modelId).name}`, 'income');
  s.bikes = s.bikes.filter((x) => x.id !== bikeId);
  if (s.player.bikeId === bikeId) { s.player.bikeId = null; s.player.onBike = false; }
  return { ok: true, message: `Sold for ₹${value.toLocaleString('en-IN')}` };
}

export function buyHome(s: GameState, tier: number): { ok: boolean; message: string } {
  const h = HOMES[tier];
  if (!h || tier <= s.player.homeTier) return { ok: false, message: 'Not an upgrade' };
  const cost = h.buy > 0 ? h.buy : (h as { deposit?: number }).deposit ?? 0;
  if (!walletTx(s, -cost, 'property', `${h.buy > 0 ? 'Purchased' : 'Deposit for'} ${h.name}`, 'expense')) return { ok: false, message: `Need ₹${cost.toLocaleString('en-IN')} in PERSONAL wallet` };
  s.player.homeTier = tier;
  s.player.ownedHomes.push(h.name);
  s.player.rentOverdue = 0; s.player.rentPaidUntilDay = dayNow(s) + 7;
  notify(s, `You moved into: ${h.name}`, 'good');
  return { ok: true, message: `Moved to ${h.name}` };
}

export function medical(s: GameState): { ok: boolean; message: string } {
  const missing = 100 - s.needs.health;
  if (missing < 3) return { ok: false, message: 'You are healthy' };
  const cost = Math.round(missing * 22);
  if (!walletTx(s, -cost, 'medical', 'Hospital treatment', 'expense')) return { ok: false, message: `Treatment costs ₹${cost}` };
  s.needs.health = 100;
  return { ok: true, message: `Treated for ₹${cost}` };
}

export function faint(s: GameState) {
  const cost = Math.min(s.wallet, 1500);
  if (cost > 0) walletTx(s, -cost, 'medical', 'Emergency hospital care', 'expense');
  const h = poiById.get('hosp1')!;
  s.player.x = h.x; s.player.z = h.z + 3; s.player.onBike = false; s.player.interior = null;
  s.needs.health = 45; s.needs.energy = Math.max(s.needs.energy, 60); s.needs.hunger = Math.max(s.needs.hunger, 35); s.needs.thirst = Math.max(s.needs.thirst, 35);
  stepSim(s, 360, { step: 15, playerAway: true });
  notify(s, `You collapsed and woke up in hospital. Emergency care cost ₹${cost}.`, 'bad');
}
