import type { Applicant, Employee, GameState, Licence, StaffRole } from '../types';
import { FIRST_NAMES, LAST_NAMES, ROLE_INFO } from '../data';
import { dayNow, pick, rint, rnd } from '../state';
import { clamp } from '../util';

export function licenceValid(l: Licence | null | undefined, day: number): boolean {
  return !!l && l.state === 'valid' && l.expiryDay > day;
}
export function licenceStatusText(l: Licence | null | undefined, day: number): string {
  if (!l || l.state === 'none') return 'No licence';
  if (l.state === 'forged') return 'FORGED / invalid document';
  if (l.expiryDay <= day) return `Expired ${day - l.expiryDay} day(s) ago`;
  return `Valid for ${l.expiryDay - day} more days`;
}

/** Hard rule enforced by the simulation: only valid-licence riders may be activated or operate company bikes. */
export function riderEligibility(a: { role: StaffRole; licence: Licence | null }, day: number): { ok: boolean; reason: string } {
  if (a.role !== 'rider') return { ok: true, reason: '' };
  if (!a.licence || a.licence.state === 'none') return { ok: false, reason: 'No motorcycle driving licence — cannot be approved.' };
  if (a.licence.state === 'forged') return { ok: false, reason: 'Licence verification failed (forged document).' };
  if (a.licence.expiryDay <= day) return { ok: false, reason: 'Licence expired — renew before activation.' };
  return { ok: true, reason: '' };
}

export function canOperate(e: Employee, day: number): boolean {
  return e.role === 'rider' && e.status === 'active' && licenceValid(e.licence, day);
}

function stat(s: GameState, lo: number, hi: number, bias = 0) {
  return clamp(Math.round(lo + (rnd(s) + rnd(s)) / 2 * (hi - lo) + bias), 5, 99);
}

export function generateApplicant(s: GameState, role: StaffRole): Applicant {
  const day = dayNow(s);
  const rep = s.company?.reputation ?? 50;
  const age = rint(s, role === 'manager' ? 30 : 20, role === 'manager' ? 52 : 44);
  const experience = Math.max(0, Math.min(age - 19, rint(s, 0, role === 'manager' ? 12 : 9)));
  let licence: Licence | null = null;
  if (role === 'rider' || rnd(s) < 0.5) {
    const r = rnd(s);
    const vp = 0.62 + rep / 350;
    const num = `TN${rint(s, 10, 99)}${2010 + rint(s, 0, 14)}${rint(s, 1000000, 9999999)}`;
    if (r < vp) licence = { number: num, state: 'valid', expiryDay: day + rint(s, 60, 1500) };
    else if (r < vp + 0.12) licence = { number: num, state: 'expired', expiryDay: day - rint(s, 3, 240) };
    else if (r < vp + 0.2) licence = null;
    else licence = { number: num, state: 'forged', expiryDay: day + 400 };
  }
  const salary = ROLE_INFO[role].salary;
  const q = ROLE_INFO[role].qual;
  return {
    id: `A${Math.floor(rnd(s) * 1e9).toString(36)}`, name: `${pick(s, FIRST_NAMES)} ${pick(s, LAST_NAMES)}`, age, role, qualification: q,
    licence, experience, skill: stat(s, 35, 90, experience * 1.5), service: stat(s, 35, 95), safety: stat(s, 35, 95),
    reliability: stat(s, 35, 95), accidents: rnd(s) < 0.35 ? rint(s, 1, 3) : 0, availability: pick(s, ['morning', 'evening', 'flex'] as const),
    expectedSalary: role === 'rider' ? 0 : Math.round((salary * (0.9 + rnd(s) * 0.3)) / 500) * 500, status: 'pending', interviewed: false,
    licenceVerified: false, appliedDay: day,
  };
}

export function verifyLicence(s: GameState, a: Applicant): string {
  a.licenceVerified = true;
  const day = dayNow(s);
  const text = !a.licence ? 'No licence on record (RTO)' : a.licence.state === 'forged' ? 'RTO check: licence number NOT FOUND — forged' : a.licence.expiryDay <= day ? `RTO check: licence expired ${day - a.licence.expiryDay} days ago` : 'RTO check: licence valid (MCWG)';
  a.verifiedResult = text;
  return text;
}
