import type { Employee, GameState, OfflineReport, StaffRole, Weather } from '../types';
import { adjustRep, bikeCondition, companyTx, dayNow, notify, rnd, rint, walletTx, pick } from '../state';
import { DISTRICTS, RIDE_POIS, branchPoiId } from '../world/city';
import { demandHourFactor, weatherDemandFactor } from '../fare/DemandAnalyzer';
import { categoryFor, pickDestination, planRide } from './rideBuilder';
import { dispatchRide, progressCompanyRides } from './dispatch';
import { generateApplicant, licenceValid } from './people';
import { hasStaff, inShift, processBilling, processEmis, separateEmployee, serviceCompanyBike } from './company';
import { trimRides } from './rides';
import { clamp } from '../util';

const BASE_REQ: Record<string, number> = { central: 120, residential: 90, it: 110, commercial: 100, coastal: 60, industrial: 50, airport: 70 };

function nextWeather(s: GameState): Weather {
  const hour = Math.floor((s.time % 1440) / 60);
  const r = rnd(s);
  const fogOk = hour >= 4 && hour < 9;
  if (fogOk && r < 0.22) return 'fog';
  if (r < 0.4) return 'sunny';
  if (r < 0.62) return 'cloudy';
  if (r < 0.8) return 'lightRain';
  if (r < 0.92) return 'heavyRain';
  return s.weather === 'heavyRain' || s.weather === 'lightRain' ? 'thunderstorm' : 'cloudy';
}

export function companyShare(s: GameState, district: string): number {
  const c = s.company!;
  const online = c.employees.filter((e) => e.role === 'rider' && e.online && c.branches.find((b) => b.id === e.branchId)?.district === district).length;
  const mine = (0.3 + c.reputation / 100) * (0.5 + Math.min(1, online / 8));
  const comp = s.competitors.filter((x) => x.districts.includes(district as never)).reduce((a, x) => a + (0.3 + x.reputation / 100) * (0.5 + Math.min(1, x.riders / 40)) * x.price, 0);
  return mine / (mine + Math.max(0.4, comp));
}
export function awareness(s: GameState) { return Math.min(1, 0.25 + (s.company?.ridesTotal ?? 0) / 600); }
export function demandPerHour(s: GameState, district: string, eff = 1): number {
  const c = s.company!;
  const hour = Math.floor((s.time % 1440) / 60);
  const recept = hasStaff(s, 'receptionist') ? 1.05 : 1;
  return BASE_REQ[district] * demandHourFactor(hour) * weatherDemandFactor(s.weather) * companyShare(s, district) * awareness(s) * recept * eff * (c.reputation < 25 ? 0.5 : 1);
}

function scheduleEmployees(s: GameState, dayChanged: boolean) {
  const c = s.company!;
  const day = dayNow(s);
  const hour = (s.time % 1440) / 60;
  for (const e of c.employees) {
    if (e.status === 'resigned' || e.status === 'terminated') continue;
    if (e.status === 'suspended' && e.suspendedUntilDay !== undefined && day >= e.suspendedUntilDay) { e.status = 'active'; e.suspendedUntilDay = undefined; e.notifications.push('Suspension ended. You may resume work.'); }
    if (e.role !== 'rider') { if (dayChanged) e.attendance.push({ day, present: true }); continue; }
    // licence enforcement (expired licence immediately stops operation)
    if (e.status === 'active' && !licenceValid(e.licence, day)) {
      if (!e.rideId) { e.status = 'licenceExpired'; e.online = false; e.state = 'offline'; e.notifications.push('Your licence has expired. You cannot operate until renewed.'); notify(s, `${e.name}'s licence expired — removed from duty until renewed.`, 'warn'); }
    }
    if (dayChanged) {
      const present = rnd(s) < 0.86 + e.reliability * 0.0014;
      const onLeave = e.leave.some((l) => l.status === 'approved' && day >= l.fromDay && day <= l.toDay);
      (e as Employee & { absentToday?: boolean }).absentToday = !present || onLeave;
      e.attendance.push({ day, present: present && !onLeave });
      if (e.attendance.length > 120) e.attendance.shift();
      if (e.attendance.length > 6 && e.attendance.slice(-6).filter((a) => !a.present).length >= 4 && !e.history.some((h) => h.day === day)) { e.history.push({ day, text: 'Frequent absences — warning' }); }
    }
    const absent = (e as Employee & { absentToday?: boolean }).absentToday;
    const bike = c.bikes.find((b) => b.id === e.bikeId);
    const bikeOk = !!bike && bike.status === 'parked';
    const want = e.status === 'active' && !absent && bikeOk && e.fatigue < (e.online ? 88 : 45) && (e.shift === 'flex' ? hour >= 6.5 && hour < 22.5 && (e.online || rnd(s) < 0.2) : inShift(e.shift, hour));
    if (!e.online && want) { e.online = true; e.state = 'idle'; }
    if (e.online && !want && !e.rideId) { e.online = false; e.state = 'offline'; }
    if (e.status === 'active' && !e.rideId) e.state = !bike || bike.status !== 'parked' ? 'noBike' : e.online ? 'idle' : 'offline';
    if (!e.online) e.fatigue = Math.max(0, e.fatigue - 0.15 * 5);
  }
}

function generateCompanyDemand(s: GameState, dt: number, eff: number) {
  const c = s.company!;
  for (const br of c.branches) {
    if (br.status !== 'open') continue;
    const online = c.employees.filter((e) => e.role === 'rider' && e.online && e.branchId === br.id).length;
    if (online === 0) continue;
    const lam = (demandPerHour(s, br.district, eff) * dt) / 60;
    let n = Math.floor(lam);
    if (rnd(s) < lam - n) n++;
    for (let i = 0; i < n; i++) {
      const pool = RIDE_POIS.filter((p) => p.district === br.district && !['police', 'home'].includes(p.kind));
      if (!pool.length) continue;
      const pickup = pick(s, pool);
      const cat = categoryFor(s, pickup, Math.floor((s.time % 1440) / 60));
      const dest = pickDestination(s, pickup, cat);
      const ride = planRide(s, 'company', pickup, dest, cat, { type: 'employee', fromX: pickup.x, fromZ: pickup.z }, br.id);
      s.rides.unshift(ride);
      dispatchRide(s, ride);
    }
  }
}

function dailyTasks(s: GameState) {
  const c = s.company;
  const day = dayNow(s);
  // competitors drift
  for (const k of s.competitors) {
    k.reputation = clamp(k.reputation + (rnd(s) - 0.5) * 2 + (c && c.reputation < 40 ? 0.1 : 0), 40, 88);
    k.riders = clamp(Math.round(k.riders + (rnd(s) - 0.45) * 2), 20, 70);
  }
  if (!c) return;
  // recruitment inflow
  const hrMul = hasStaff(s, 'hr') ? 2 : 1;
  const inflow = (0.5 + c.reputation / 100) * hrMul;
  let n = Math.floor(inflow);
  if (rnd(s) < inflow - n) n++;
  if (c.applicants.length < 10) for (let i = 0; i < n; i++) {
    const roles: StaffRole[] = ['rider', 'rider', 'rider', 'rider', 'mechanic', 'receptionist', 'accountant', 'support', 'hr', 'manager'];
    c.applicants.push(generateApplicant(s, pick(s, roles)));
  }
  c.applicants = c.applicants.filter((a) => day - a.appliedDay < 8);
  // fleet condition effects on reputation
  const bikes = c.bikes;
  if (bikes.length) {
    const avg = bikes.reduce((a, b) => a + bikeCondition(b), 0) / bikes.length;
    if (avg < 40) { adjustRep(s, -0.6); } else if (avg > 80) adjustRep(s, 0.12);
  }
  // autonomous maintenance by mechanics / managers
  for (const b of bikes) {
    const emp = c.employees.find((e) => e.id === b.assignedEmployeeId);
    if (emp?.rideId || b.status !== 'parked') continue;
    const br = c.branches.find((x) => x.id === b.branchId);
    const managed = hasStaff(s, 'mechanic', b.branchId) || (br?.managerId && hasStaff(s, 'manager', b.branchId));
    if (!managed) continue;
    if (b.oil < 25) serviceCompanyBike(s, b.id, 'service');
    else if (b.tyres < 20) serviceCompanyBike(s, b.id, 'tyres');
    else if (b.brakes < 20) serviceCompanyBike(s, b.id, 'brakes');
    else if (b.damage > 25) serviceCompanyBike(s, b.id, 'repair');
  }
  // support auto-resolves complaints
  if (hasStaff(s, 'support')) for (const cp of c.complaints) if (!cp.resolved && rnd(s) < 0.6) { cp.resolved = true; adjustRep(s, 0.3); }
  // employees report poor bikes
  for (const e of c.employees) {
    const b = c.bikes.find((x) => x.id === e.bikeId);
    if (b && (b.oil < 30 || b.tyres < 25 || b.brakes < 25) && e.status === 'active') e.bikeReports.push({ day, text: `Maintenance needed: oil ${Math.round(b.oil)}%, tyres ${Math.round(b.tyres)}%, brakes ${Math.round(b.brakes)}%` });
    if (e.bikeReports.length > 40) e.bikeReports.shift();
  }
  // low reputation: staff resign
  if (c.reputation < 30) for (const e of c.employees) if (e.status === 'active' && !e.rideId && rnd(s) < 0.04) { separateEmployee(s, e.id, 'resign'); notify(s, `${e.name} resigned due to the company's poor reputation.`, 'warn'); }
}

function hourlyPolice(s: GameState) {
  const c = s.company!;
  const rep = c.reputation;
  for (const e of c.employees) {
    if (e.role !== 'rider' || !e.online || e.status !== 'active') continue;
    const p = 0.025 * (1 + clamp((70 - rep) / 70, 0, 1.2));
    if (rnd(s) > p) continue;
    // documents are verified: licence validity is always enforced upstream, so documents pass
    const viol = (100 - e.safety) / 160 + (e.fatigue > 70 ? 0.1 : 0);
    if (rnd(s) < viol) {
      const types: [string, number][] = [['reckless riding', 1000], ['signal violation', 500], ['dangerous overtaking', 1000], ['over-speeding', 700]];
      const [t, fine] = pick(s, types);
      e.wallet -= fine; e.violations += 1; c.violationsTotal += 1;
      e.safety = Math.max(5, e.safety - 2);
      adjustRep(s, -1.2);
      e.history.push({ day: dayNow(s), text: `Police fine ₹${fine}: ${t}` });
      e.notifications.push(`Traffic police fined you ₹${fine} for ${t}.`);
      notify(s, `Traffic police fined ${e.name} ₹${fine} (${t}). Company reputation ↓`, 'warn');
      if (e.violations >= 6) { if (!e.rideId) { separateEmployee(s, e.id, 'terminate'); notify(s, `${e.name} terminated after repeated violations.`, 'bad'); } }
      else if (e.violations % 3 === 0) { e.status = 'suspended'; e.suspendedUntilDay = dayNow(s) + 3; e.online = false; e.notifications.push('Suspended 3 days for repeated violations.'); }
    } else { adjustRep(s, 0.1); e.history.push({ day: dayNow(s), text: 'Police document check — all clear' }); }
  }
}

export interface StepOpts { efficiency?: number; sleeping?: boolean; step?: number; playerAway?: boolean }

/** Advance the whole world by `minutes` game minutes. Used for real-time, sleeping and offline progress. */
export function stepSim(s: GameState, minutes: number, opts: StepOpts = {}) {
  const step = opts.step ?? 5;
  let left = minutes;
  while (left > 0.0001) {
    const dt = Math.min(step, left);
    left -= dt;
    const prevHour = Math.floor(s.time / 60), prevDay = dayNow(s);
    s.time += dt;
    const day = dayNow(s);
    const dayChanged = day !== prevDay;
    if (s.time >= s.weatherUntil) { s.weather = nextWeather(s); s.weatherUntil = s.time + rint(s, 90, 300); }
    if (!opts.playerAway) {
      const k = opts.sleeping ? 0.35 : 1;
      const n = s.needs;
      n.hunger = clamp(n.hunger - 0.075 * dt * k, 0, 100);
      n.thirst = clamp(n.thirst - 0.11 * dt * k, 0, 100);
      n.energy = clamp(n.energy - (opts.sleeping ? -0.15 : 0.05) * dt, 0, 100);
      if (n.hunger <= 0 || n.thirst <= 0 || n.energy <= 0) n.health = clamp(n.health - 0.05 * dt, 0, 100);
      else if (n.hunger > 40 && n.thirst > 40 && n.energy > 25) n.health = clamp(n.health + 0.02 * dt * (opts.sleeping ? 3 : 1), 0, 100);
      // weekly rent
      if (day >= s.player.rentPaidUntilDay && s.player.homeTier <= 1) {
        const rent = s.player.homeTier === 0 ? 700 : 2400;
        if (walletTx(s, -rent, 'rent', `Weekly rent`, 'expense')) { s.player.rentPaidUntilDay += 7; s.player.rentOverdue = 0; notify(s, `Rent ₹${rent} paid automatically.`, 'info'); }
        else { s.player.rentOverdue += 1; s.player.rentPaidUntilDay += 1; if (s.player.rentOverdue === 1) notify(s, `Rent ₹${rent} is DUE — earn money and pay at home (landlord).`, 'warn'); }
      }
    }
    if (s.company) {
      scheduleEmployees(s, dayChanged);
      // bikes returning from repair
      for (const b of s.company.bikes) if (b.status === 'repair' && (b.repairUntil ?? 0) <= s.time) { b.status = 'parked'; b.repairUntil = undefined; }
      generateCompanyDemand(s, dt, opts.efficiency ?? 1);
      progressCompanyRides(s);
      if (Math.floor(s.time / 60) !== prevHour) hourlyPolice(s);
      if (dayChanged) { processEmis(s); processBilling(s); }
      else if (Math.floor(s.time / 60) !== prevHour) processEmis(s); // overdue retries
    }
    if (dayChanged) dailyTasks(s);
    // personal wallet effect of defaults etc. handled elsewhere
  }
  trimRides(s);
}

/** Controlled offline progression: capped, efficiency-reduced, and reported. */
export function simulateOffline(s: GameState, elapsedRealMs: number): OfflineReport | null {
  const mins = elapsedRealMs / 60000;
  if (!s.company || mins < 2) return null;
  const OFFLINE_GAME_MIN_PER_REAL_MIN = 6;
  const CAP = 18 * 60;
  const want = mins * OFFLINE_GAME_MIN_PER_REAL_MIN;
  const sim = Math.min(CAP, want);
  const startSeq = s.ledgerSeq;
  const ridesBefore = s.company.ridesTotal;
  const emiBefore = s.company.loans.reduce((a, l) => a + l.paidCount, 0);
  stepSim(s, sim, { efficiency: 0.5, step: 15, playerAway: true });
  const entries = s.ledger.filter((l) => l.id >= startSeq && l.account === 'company');
  const revenue = entries.filter((l) => l.kind === 'income').reduce((a, l) => a + l.amount, 0);
  const expenses = -entries.filter((l) => l.kind === 'expense').reduce((a, l) => a + l.amount, 0);
  const emiAfter = s.company.loans.reduce((a, l) => a + l.paidCount, 0);
  const emiPaid = entries.filter((l) => l.category === 'loan-principal' || l.category === 'loan-interest').reduce((a, l) => a - l.amount, 0);
  const events = s.notifications.filter((n) => n.time > s.time - sim - 1).slice(-8).map((n) => n.text);
  void companyTx; void emiBefore; void emiAfter; void DISTRICTS; void branchPoiId;
  return { elapsedRealMin: Math.round(mins), simulatedGameMin: Math.round(sim), rides: s.company.ridesTotal - ridesBefore, revenue, expenses, emiPaid, events, capped: want > CAP };
}
