import type { Applicant, Bike, Branding, Branch, Company, DistrictId, Employee, GameState, Loan, ScheduleRow, ShiftType, StaffRole } from '../types';
import { BIKE_MODELS, COMPANY_MODEL_MAX_PRICE, modelOf, REGISTRATION_COSTS, REGISTRATION_TOTAL, ROLE_INFO, SAVINGS_TARGET, SECURITY_DEPOSIT } from '../data';
import { adjustRep, bikeCondition, companyTx, dayNow, depositLiability, makeBike, notify, rint, rnd, savingsTx, walletTx } from '../state';
import { DISTRICT_ORDER, DISTRICTS, poiById, branchPoiId } from '../world/city';
import { generateApplicant, riderEligibility } from './people';
import { COMPETITORS } from '../data';

export function canRegister(s: GameState): { ok: boolean; reason: string } {
  if (s.company) return { ok: false, reason: 'Company already registered' };
  if (s.savings < SAVINGS_TARGET) return { ok: false, reason: `Personal savings must reach ₹${SAVINGS_TARGET.toLocaleString('en-IN')} (you have ₹${s.savings.toLocaleString('en-IN')})` };
  return { ok: true, reason: '' };
}

export function validateCompanyName(name: string): string | null {
  const n = name.trim();
  if (n.length < 3 || n.length > 28) return 'Company name must be 3–28 characters';
  if (!/^[A-Za-z0-9 &'.-]+$/.test(n)) return 'Use letters, numbers and basic punctuation only';
  if (COMPETITORS.some((c) => c.name.toLowerCase() === n.toLowerCase()) || /pillion\s*go/i.test(n)) return 'Name already taken by another company';
  return null;
}

export function registerCompany(s: GameState, b: Branding): { ok: boolean; message: string } {
  const can = canRegister(s);
  if (!can.ok) return { ok: false, message: can.reason };
  const err = validateCompanyName(b.name);
  if (err) return { ok: false, message: err };
  if (s.savings < REGISTRATION_TOTAL) return { ok: false, message: 'Insufficient savings' };
  const day = dayNow(s);
  REGISTRATION_COSTS.forEach((c) => savingsTx(s, -c.amount, 'company-setup', c.label));
  const capital = s.savings;
  savingsTx(s, -capital, 'company-capital', 'Transferred remaining savings as company starting capital');
  const c: Company = {
    branding: { ...b, name: b.name.trim() }, registeredDay: day, bank: 0, reputation: 50, credit: 650, ratingSum: 0, ratingCount: 0,
    loans: [], employees: [], applicants: [], bikes: [], branches: [], complaints: [], nextBillingDay: day + 30, ownerDraws: 0, appBuilt: true,
    fuelPolicy: 'company', accidentsTotal: 0, violationsTotal: 0, ridesTotal: 0, revenueTotal: 0, uniformsStock: 5, seizedBikes: 0,
    lastApplicantDay: day, insuranceClaimsPaid: 0,
  };
  s.company = c;
  c.branches.push({ id: 'hq', district: 'central', name: `${c.branding.name} HQ`, poiId: 'hq', status: 'open', openedDay: day, revenue: 0, expenses: 0, rides: 0, rentMonthly: 12000 });
  companyTx(s, capital, 'capital', 'starting-capital', 'Starting capital from founder savings');
  for (let i = 0; i < 4; i++) c.applicants.push(generateApplicant(s, 'rider'));
  ['company', 'customerPortal', 'employeePortal', 'adminPortal'].forEach((u) => { if (!s.unlocks.includes(u)) s.unlocks.push(u); });
  notify(s, `${c.branding.name} is registered! Capital ₹${capital.toLocaleString('en-IN')}. Visit the bank for a fleet loan.`, 'good');
  return { ok: true, message: 'Company registered' };
}

// ---------------- Loans ----------------
export function emiFor(principal: number, annualPct: number, months: number): number {
  const r = annualPct / 12 / 100;
  if (r === 0) return Math.round(principal / months);
  const f = Math.pow(1 + r, months);
  return Math.round((principal * r * f) / (f - 1));
}

export function buildSchedule(principal: number, annualPct: number, months: number, firstDue: number): ScheduleRow[] {
  const emi = emiFor(principal, annualPct, months);
  const r = annualPct / 12 / 100;
  let bal = principal;
  const rows: ScheduleRow[] = [];
  for (let n = 1; n <= months; n++) {
    const interest = Math.round(bal * r);
    let prin = emi - interest;
    let e = emi;
    if (n === months) { prin = bal; e = bal + interest; }
    bal -= prin;
    rows.push({ n, dueDay: firstDue + (n - 1) * 30, emi: e, principalPart: prin, interestPart: interest, status: 'pending', lateFee: 0 });
  }
  return rows;
}

export const outstandingLoans = (c: Company) => c.loans.filter((l) => l.status !== 'closed').reduce((a, l) => a + l.outstanding, 0);
export function trailingRevenue(s: GameState, days = 30): number {
  const from = s.time - days * 1440;
  return s.ledger.filter((l) => l.account === 'company' && l.kind === 'income' && l.time >= from).reduce((a, l) => a + l.amount, 0);
}
export function loanRate(credit: number): number { return Math.round(Math.max(10, Math.min(20, 18 - ((credit - 500) / 350) * 8)) * 10) / 10; }
export function maxLoan(s: GameState): number {
  const c = s.company;
  if (!c || c.credit < 500 || c.loans.some((l) => l.status === 'defaulted')) return 0;
  const base = (150000 + 6 * trailingRevenue(s)) * Math.max(0.3, (c.credit - 400) / 400);
  return Math.max(0, Math.min(2000000, Math.round((base - outstandingLoans(c)) / 5000) * 5000));
}

export function applyForLoan(s: GameState, amount: number, months: number): { ok: boolean; message: string } {
  const c = s.company;
  if (!c) return { ok: false, message: 'Register your company first' };
  if (amount < 20000) return { ok: false, message: 'Minimum loan is ₹20,000' };
  if (![12, 18, 24, 36].includes(months)) return { ok: false, message: 'Invalid tenure' };
  if (c.loans.some((l) => l.status === 'defaulted')) return { ok: false, message: 'Rejected: existing loan in default' };
  if (c.credit < 500) return { ok: false, message: `Rejected: credit score ${c.credit} is below 500` };
  const cap = maxLoan(s);
  if (amount > cap) return { ok: false, message: `Rejected: requested ₹${amount.toLocaleString('en-IN')} exceeds your eligible limit ₹${cap.toLocaleString('en-IN')}` };
  const rate = loanRate(c.credit);
  const day = dayNow(s);
  const emi = emiFor(amount, rate, months);
  const loan: Loan = {
    id: `L${c.loans.length + 1}`, principal: amount, ratePct: rate, months, emi, outstanding: amount, takenDay: day, nextDueDay: day + 30, paidCount: 0,
    schedule: buildSchedule(amount, rate, months, day + 30), status: 'active', overdueCount: 0, lateFees: 0, totalInterestPaid: 0,
  };
  c.loans.push(loan);
  companyTx(s, amount, 'financing', 'loan-proceeds', `Loan ${loan.id} disbursed @${rate}% · ${months} mo`);
  const fee = Math.round(amount * 0.01);
  companyTx(s, -fee, 'expense', 'loan-fee', `Loan processing fee 1% (${loan.id})`, { allowNegative: true });
  notify(s, `Loan approved: ₹${amount.toLocaleString('en-IN')} @ ${rate}% · EMI ₹${emi.toLocaleString('en-IN')} auto-debited every 30 days from the COMPANY account.`, 'good');
  return { ok: true, message: 'Loan approved' };
}

/** Automatic EMI deduction. Called every simulation step; works for any elapsed time (sleep/offline). */
export function processEmis(s: GameState): { paid: number } {
  const c = s.company;
  let paid = 0;
  if (!c) return { paid };
  const day = dayNow(s);
  for (const loan of c.loans) {
    if (loan.status === 'closed') continue;
    for (const row of loan.schedule) {
      if (row.status === 'paid' || row.dueDay > day) continue;
      if (row.status === 'pending') {
        // due date reached – attempt automatic debit
        if (c.bank >= row.emi) {
          payRow(s, loan, row, 0); // books principal (financing) and interest (expense) separately
          paid += row.emi;
        } else {
          row.status = 'overdue';
          row.lateFee = Math.max(250, Math.round(row.emi * 0.02));
          loan.overdueCount += 1; loan.lateFees += row.lateFee;
          c.credit = Math.max(300, c.credit - 25);
          adjustRep(s, -2);
          notify(s, `EMI ${row.n} of loan ${loan.id} OVERDUE — insufficient company funds. Late fee ₹${row.lateFee}. Credit score ↓`, 'bad');
        }
      } else if (row.status === 'overdue') {
        const need = row.emi + row.lateFee;
        if (c.bank >= need) { payRow(s, loan, row, row.lateFee); paid += need; loan.overdueCount = Math.max(0, loan.overdueCount - 1); c.credit = Math.min(900, c.credit + 10); notify(s, `Overdue EMI ${row.n} cleared (incl. late fee ₹${row.lateFee}).`, 'good'); }
      }
    }
    if (loan.status === 'active' && loan.overdueCount >= 3) defaultLoan(s, loan);
    else if (loan.status === 'defaulted' && loan.overdueCount < 3) loan.status = 'active';
    if (loan.schedule.every((r) => r.status === 'paid')) { loan.status = 'closed'; c.credit = Math.min(900, c.credit + 40); notify(s, `Loan ${loan.id} fully repaid. Credit score ↑`, 'good'); }
    const next = loan.schedule.find((r) => r.status !== 'paid');
    if (next) loan.nextDueDay = next.dueDay;
  }
  return { paid };
}

function payRow(s: GameState, loan: Loan, row: ScheduleRow, lateFee: number) {
  const c = s.company!;
  companyTx(s, -row.principalPart, 'financing', 'loan-principal', `EMI ${row.n}/${loan.months} principal (${loan.id})`, { allowNegative: true });
  if (row.interestPart > 0) companyTx(s, -row.interestPart, 'expense', 'loan-interest', `EMI ${row.n}/${loan.months} interest (${loan.id})`, { allowNegative: true });
  if (lateFee > 0) companyTx(s, -lateFee, 'expense', 'late-fee', `Late fee EMI ${row.n} (${loan.id})`, { allowNegative: true });
  row.status = 'paid'; row.paidDay = dayNow(s);
  loan.outstanding = Math.max(0, loan.outstanding - row.principalPart);
  loan.paidCount += 1; loan.totalInterestPaid += row.interestPart;
  if (loan.paidCount === 1) notify(s, `First EMI paid automatically: ₹${row.emi.toLocaleString('en-IN')} 🎉`, 'good');
  void c;
}

function defaultLoan(s: GameState, loan: Loan) {
  const c = s.company!;
  loan.status = 'defaulted';
  c.credit = Math.max(300, c.credit - 80);
  adjustRep(s, -10);
  const bike = [...c.bikes].filter((b) => b.status !== 'seized').sort((a, b) => (a.assignedEmployeeId ? 1 : 0) - (b.assignedEmployeeId ? 1 : 0))[0];
  let proceeds = 0;
  if (bike) {
    proceeds = Math.round(modelOf(bike.modelId).price * 0.6 * (1 - bike.damage / 200));
    const emp = c.employees.find((e) => e.id === bike.assignedEmployeeId);
    if (emp) { emp.bikeId = undefined; emp.state = 'noBike'; emp.online = false; emp.notifications.push('Your bike was seized by the bank.'); }
    c.bikes = c.bikes.filter((b) => b.id !== bike.id);
    c.seizedBikes += 1;
  }
  for (const row of loan.schedule) {
    if (row.status === 'overdue' && proceeds >= row.emi + row.lateFee) { proceeds -= row.emi + row.lateFee; row.status = 'paid'; row.paidDay = dayNow(s); loan.outstanding = Math.max(0, loan.outstanding - row.principalPart); loan.overdueCount = Math.max(0, loan.overdueCount - 1); }
  }
  notify(s, `LOAN DEFAULT (${loan.id}): bank seized a motorcycle and recovered dues. Credit score and reputation damaged.`, 'bad');
}

// ---------------- Fleet ----------------
export const bikePurchaseCost = (modelId: string) => modelOf(modelId).price + 2500;
export function buyCompanyBike(s: GameState, modelId: string, branchId: string): { ok: boolean; message: string } {
  const c = s.company;
  const m = BIKE_MODELS.find((x) => x.id === modelId);
  const br = c?.branches.find((b) => b.id === branchId);
  if (!c || !m || !br) return { ok: false, message: 'Invalid purchase' };
  if (m.price > COMPANY_MODEL_MAX_PRICE) return { ok: false, message: 'Fleet policy: company buys commuter/street bikes up to ₹1.3 lakh' };
  const total = bikePurchaseCost(modelId) + 350;
  if (c.bank < total) return { ok: false, message: `Company account needs ₹${total.toLocaleString('en-IN')} (bike + registration/road tax + first insurance month)` };
  companyTx(s, -m.price, 'expense', 'bike-purchase', `Purchase ${m.name}`, { branchId });
  companyTx(s, -2500, 'expense', 'registration', `Registration & road tax`, { branchId });
  companyTx(s, -350, 'expense', 'insurance', `Insurance (basic) first month`, { branchId });
  const p = poiById.get(br.poiId)!;
  const b = makeBike(s, 'company', modelId, p.x, p.z, { branchId, color: c.branding.primary, insurance: { plan: 'basic', expiresDay: dayNow(s) + 30 } });
  c.bikes.push(b);
  notify(s, `New company motorcycle ${b.plate} (${m.name}) added to ${br.name}.`, 'good');
  return { ok: true, message: `Bought ${m.name} ${b.plate}` };
}

export function serviceCost(kind: 'service' | 'tyres' | 'brakes' | 'repair', b: Bike, discount = 0): number {
  const base = kind === 'service' ? 800 : kind === 'tyres' ? 1800 : kind === 'brakes' ? 700 : Math.round(b.damage * 40);
  return Math.round(base * (1 - discount));
}
export function hasStaff(s: GameState, role: StaffRole, branchId?: string): boolean {
  return !!s.company?.employees.some((e) => e.role === role && e.status === 'active' && (!branchId || e.branchId === branchId));
}
export function serviceCompanyBike(s: GameState, bikeId: string, kind: 'service' | 'tyres' | 'brakes' | 'repair'): { ok: boolean; message: string } {
  const c = s.company;
  const b = c?.bikes.find((x) => x.id === bikeId);
  if (!c || !b) return { ok: false, message: 'Bike not found' };
  const emp = c.employees.find((e) => e.id === b.assignedEmployeeId);
  if (emp?.rideId) return { ok: false, message: 'Bike is on an active ride' };
  if (kind === 'repair' && b.damage < 1) return { ok: false, message: 'No damage to repair' };
  const cost = serviceCost(kind, b, hasStaff(s, 'mechanic') ? 0.2 : 0);
  if (!companyTx(s, -cost, 'expense', kind === 'repair' ? 'repairs' : 'servicing', `${kind} ${b.plate}`, { branchId: b.branchId })) return { ok: false, message: 'Insufficient company funds' };
  if (kind === 'service') b.oil = 100; if (kind === 'tyres') b.tyres = 100; if (kind === 'brakes') b.brakes = 100;
  if (kind === 'repair') b.damage = 0;
  b.serviceHistory.push({ day: dayNow(s), kind, cost });
  b.status = 'repair'; b.repairUntil = s.time + (kind === 'repair' ? 180 : 60);
  return { ok: true, message: `${kind} done on ${b.plate} (₹${cost})` };
}
export function setInsurance(s: GameState, bikeId: string, plan: 'none' | 'basic' | 'comprehensive') {
  const b = s.company?.bikes.find((x) => x.id === bikeId);
  if (!b) return;
  b.insurance = { plan, expiresDay: plan === 'none' ? 0 : Math.max(b.insurance.expiresDay, dayNow(s) + 1) };
}
export const PREMIUM = { none: 0, basic: 350, comprehensive: 800 } as const;

// ---------------- Recruitment & employees ----------------
export function interviewApplicant(s: GameState, id: string) {
  const a = s.company?.applicants.find((x) => x.id === id);
  if (a && a.status === 'pending') { a.status = 'interview'; a.interviewed = true; }
}
export function rejectApplicant(s: GameState, id: string) {
  const c = s.company;
  if (c) c.applicants = c.applicants.filter((a) => a.id !== id);
}

function makeEmployee(s: GameState, a: Applicant, branchId: string, shift: ShiftType, bike?: Bike): Employee {
  const br = s.company!.branches.find((b) => b.id === branchId)!;
  const p = poiById.get(br.poiId)!;
  const uname = a.name.toLowerCase().replace(/[^a-z]/g, '.').replace(/\.+/g, '.') + rint(s, 10, 99);
  return {
    id: `E${Math.floor(rnd(s) * 1e9).toString(36)}`, name: a.name, age: a.age, role: a.role, licence: a.licence, experience: a.experience,
    skill: a.skill, service: a.service, safety: a.safety, reliability: a.reliability, accidents: a.accidents, rating: 4.2, ratingCount: 0,
    branchId, shift, bikeId: bike?.id, uniform: true, username: uname, password: String(rint(s, 100000, 999999)), status: 'active',
    online: false, fatigue: 0, state: a.role === 'rider' ? 'offline' : 'idle', posX: p.x, posZ: p.z,
    deposit: a.role === 'rider' ? SECURITY_DEPOSIT : 0, salary: a.role === 'rider' ? 0 : a.expectedSalary, joinedDay: dayNow(s),
    wallet: 0, totalEarned: 0, ridesDone: 0, earnings: [], attendance: [], leave: [], notifications: [`Welcome to ${s.company!.branding.name}! Login: ${uname}`],
    violations: 0, complaints: 0, bikeReports: [], history: [{ day: dayNow(s), text: 'Joined the company' }],
  };
}

export function approveApplicant(s: GameState, applicantId: string, branchId: string, shift: ShiftType): { ok: boolean; message: string } {
  const c = s.company;
  const a = c?.applicants.find((x) => x.id === applicantId);
  if (!c || !a) return { ok: false, message: 'Applicant not found' };
  const br = c.branches.find((b) => b.id === branchId);
  if (!br) return { ok: false, message: 'Choose a branch' };
  const day = dayNow(s);
  // HARD RULE: licence check is enforced here regardless of what the UI showed.
  const el = riderEligibility(a, day);
  if (!el.ok) return { ok: false, message: el.reason };
  if (a.role === 'manager' && br.managerId) return { ok: false, message: 'Branch already has a manager' };
  let bike: Bike | undefined;
  if (a.role === 'rider') {
    bike = c.bikes.find((b) => !b.assignedEmployeeId && b.status === 'parked' && b.branchId === branchId) ?? c.bikes.find((b) => !b.assignedEmployeeId && b.status === 'parked');
    if (!bike) return { ok: false, message: 'No free company motorcycle available — buy one first' };
  }
  if (a.role !== 'rider' && a.expectedSalary > 0 && c.bank < a.expectedSalary) return { ok: false, message: 'Company needs at least one month of salary in the bank' };
  if (c.uniformsStock <= 0) { if (!companyTx(s, -600, 'expense', 'uniform', 'Extra uniform', { branchId })) return { ok: false, message: 'No uniforms left and no funds to buy more' }; } else c.uniformsStock -= 1;
  const e = makeEmployee(s, a, branchId, shift, bike);
  if (a.role === 'rider') companyTx(s, SECURITY_DEPOSIT, 'liability', 'security-deposit', `Refundable security deposit · ${e.name}`, { branchId });
  if (bike) { bike.assignedEmployeeId = e.id; bike.branchId = branchId; bike.baselineWear = bike.damage; const p = poiById.get(br.poiId)!; bike.x = p.x; bike.z = p.z; }
  if (a.role === 'manager') { br.managerId = e.id; if (br.status === 'needsManager') { br.status = 'open'; notify(s, `${br.name} is now OPEN under manager ${e.name}.`, 'good'); } }
  c.employees.push(e);
  c.applicants = c.applicants.filter((x) => x.id !== applicantId);
  notify(s, `${e.name} joined as ${ROLE_INFO[e.role].label}${bike ? ` · bike ${bike.plate}` : ''}. Login: ${e.username}`, 'good');
  return { ok: true, message: `Approved ${e.name}` };
}

export function separateEmployee(s: GameState, empId: string, reason: 'resign' | 'terminate'): { ok: boolean; message: string } {
  const c = s.company;
  const e = c?.employees.find((x) => x.id === empId);
  if (!c || !e) return { ok: false, message: 'Employee not found' };
  if (e.status === 'resigned' || e.status === 'terminated') return { ok: false, message: 'Already separated' };
  if (e.rideId) return { ok: false, message: 'Employee is on an active ride — wait until it finishes' };
  let deduction = 0;
  const bike = c.bikes.find((b) => b.id === e.bikeId);
  if (bike) {
    const dmg = Math.max(0, bike.damage - (bike.baselineWear ?? 0));
    deduction += Math.min(Math.round(dmg * 20), e.deposit);
    bike.assignedEmployeeId = undefined; bike.baselineWear = undefined;
    const hq = poiById.get('hq')!;
    bike.x = hq.x; bike.z = hq.z;
  }
  if (!e.uniform || rnd(s) < 0.08) deduction += 600;
  deduction = Math.min(deduction, e.deposit);
  const refund = e.deposit - deduction;
  if (refund > 0) companyTx(s, -refund, 'liability', 'deposit-refund', `Deposit refund · ${e.name} (deductions ₹${deduction})`, { branchId: e.branchId, allowNegative: true });
  const br = c.branches.find((b) => b.id === e.branchId);
  if (br && br.managerId === e.id) { br.managerId = undefined; if (br.id !== 'hq') br.status = 'needsManager'; }
  e.history.push({ day: dayNow(s), text: `${reason === 'resign' ? 'Resigned' : 'Terminated'}; deposit refund ₹${refund}, deductions ₹${deduction}` });
  e.status = reason === 'resign' ? 'resigned' : 'terminated';
  e.online = false; e.state = 'offline'; e.bikeId = undefined; e.uniform = false;
  e.deposit = 0;
  if (reason === 'terminate') adjustRep(s, 0);
  return { ok: true, message: `${e.name} ${reason === 'resign' ? 'resigned' : 'terminated'}: bike & uniform returned, deposit refund ₹${refund}${deduction ? ` (₹${deduction} deducted)` : ''}` };
}

export function renewEmployeeLicence(s: GameState, empId: string): { ok: boolean; message: string } {
  const e = s.company?.employees.find((x) => x.id === empId);
  if (!e || !e.licence) return { ok: false, message: 'No licence on file' };
  if (e.licence.state !== 'expired' && e.licence.expiryDay > dayNow(s)) return { ok: false, message: 'Licence still valid' };
  e.licence = { ...e.licence, state: 'valid', expiryDay: dayNow(s) + 1500 };
  if (e.status === 'licenceExpired') e.status = 'active';
  e.history.push({ day: dayNow(s), text: 'Licence renewed at RTO' });
  return { ok: true, message: 'Licence renewed — you may resume work' };
}

export function setEmployeeShift(s: GameState, empId: string, shift: ShiftType) {
  const e = s.company?.employees.find((x) => x.id === empId);
  if (e) e.shift = shift;
}
export function decideLeave(s: GameState, empId: string, leaveId: string, ok: boolean) {
  const e = s.company?.employees.find((x) => x.id === empId);
  const l = e?.leave.find((x) => x.id === leaveId);
  if (e && l) { l.status = ok ? 'approved' : 'rejected'; e.notifications.push(`Leave ${l.status}`); }
}
export function requestLeave(s: GameState, empId: string, days: number, reason: string) {
  const e = s.company?.employees.find((x) => x.id === empId);
  if (!e) return;
  const d = dayNow(s) + 1;
  e.leave.push({ id: `LV${e.leave.length + 1}${d}`, fromDay: d, toDay: d + Math.max(0, days - 1), reason, status: 'pending' });
}
export function fileBikeReport(s: GameState, empId: string, text: string) {
  const e = s.company?.employees.find((x) => x.id === empId);
  if (e) { e.bikeReports.push({ day: dayNow(s), text }); const b = s.company!.bikes.find((x) => x.id === e.bikeId); if (b && /brake|tyre|oil/i.test(text)) { /* flagged for mechanic */ } }
}
export function employeeSetOnline(s: GameState, empId: string, online: boolean): { ok: boolean; message: string } {
  const e = s.company?.employees.find((x) => x.id === empId);
  if (!e || e.role !== 'rider') return { ok: false, message: 'Not a rider' };
  if (online) {
    const el = riderEligibility(e, dayNow(s));
    if (!el.ok || e.status !== 'active') return { ok: false, message: e.status !== 'active' ? `Cannot go online: ${e.status}` : el.reason };
    if (!e.bikeId) return { ok: false, message: 'No company motorcycle assigned' };
    if (e.shift !== 'flex' && !inShift(e.shift, (s.time % 1440) / 60)) return { ok: false, message: `Outside your ${e.shift} shift` };
  }
  e.online = online;
  e.state = online ? 'idle' : 'offline';
  return { ok: true, message: online ? 'You are online' : 'You are offline' };
}
export function inShift(shift: ShiftType, hour: number): boolean {
  if (shift === 'morning') return hour >= 6 && hour < 14;
  if (shift === 'evening') return hour >= 14 && hour < 22;
  return hour >= 6 && hour < 23;
}

// ---------------- Branches ----------------
export function branchCost(d: DistrictId) { return 40000 + DISTRICTS[d].order * 15000; }
export function branchRequirements(s: GameState, d: DistrictId) {
  const c = s.company!;
  const idx = DISTRICTS[d].order;
  const prevD = DISTRICT_ORDER[idx - 1];
  const prevOpen = !prevD || c.branches.some((b) => b.district === prevD && b.status === 'open');
  const riders = c.employees.filter((e) => e.role === 'rider' && e.status !== 'resigned' && e.status !== 'terminated').length;
  const cost = branchCost(d);
  return [
    { label: `Previous zone (${prevD ? DISTRICTS[prevD].name : 'HQ'}) fully open`, ok: prevOpen },
    { label: `Company funds ≥ ₹${(cost + 20000).toLocaleString('en-IN')} (setup ₹${cost.toLocaleString('en-IN')} + buffer)`, ok: c.bank >= cost + 20000 },
    { label: `Reputation ≥ ${52 + idx * 4}`, ok: c.reputation >= 52 + idx * 4 },
    { label: `Employees (riders) ≥ ${2 + idx}`, ok: riders >= 2 + idx },
    { label: `Motorcycles ≥ ${2 + idx}`, ok: c.bikes.length >= 2 + idx },
    { label: `Completed company rides ≥ ${20 + idx * 40}`, ok: c.ridesTotal >= 20 + idx * 40 },
  ];
}
export function openBranch(s: GameState, d: DistrictId): { ok: boolean; message: string } {
  const c = s.company;
  if (!c) return { ok: false, message: 'No company' };
  if (c.branches.some((b) => b.district === d)) return { ok: false, message: 'Branch already exists' };
  const req = branchRequirements(s, d);
  const bad = req.find((r) => !r.ok);
  if (bad) return { ok: false, message: `Requirement not met: ${bad.label}` };
  const cost = branchCost(d);
  companyTx(s, -cost, 'expense', 'branch-setup', `Branch setup · ${DISTRICTS[d].name} (registration, office, garage)`);
  const br: Branch = { id: `br-${d}`, district: d, name: `${c.branding.name} — ${DISTRICTS[d].name}`, poiId: branchPoiId(d), status: 'needsManager', openedDay: dayNow(s), revenue: 0, expenses: 0, rides: 0, rentMonthly: 9000 + DISTRICTS[d].order * 1500 };
  c.branches.push(br);
  for (let i = 0; i < 2; i++) c.applicants.push(generateApplicant(s, 'rider'));
  c.applicants.push(generateApplicant(s, 'manager'));
  notify(s, `${br.name} registered. Hire a Branch Manager to open it.`, 'good');
  return { ok: true, message: 'Branch registered' };
}

export function ownerDraw(s: GameState, amount: number): { ok: boolean; message: string } {
  const c = s.company;
  if (!c) return { ok: false, message: 'No company' };
  amount = Math.round(amount);
  if (amount <= 0) return { ok: false, message: 'Invalid amount' };
  const nextEmis = c.loans.filter((l) => l.status !== 'closed').reduce((a, l) => a + l.emi, 0);
  const reserve = depositLiability(s) + nextEmis * 2 + 20000;
  if (c.bank - amount < reserve) return { ok: false, message: `Must keep reserve ₹${reserve.toLocaleString('en-IN')} (employee deposits + 2 EMIs + buffer)` };
  companyTx(s, -amount, 'financing', 'owner-draw', 'Owner drawings to personal wallet');
  walletTx(s, amount, 'owner-draw', 'Owner drawings from company', 'transfer');
  c.ownerDraws += amount;
  return { ok: true, message: `Transferred ₹${amount.toLocaleString('en-IN')} to your personal wallet` };
}

// ---------------- Monthly billing ----------------
export function processBilling(s: GameState): { expenses: number } {
  const c = s.company;
  let total = 0;
  if (!c) return { expenses: 0 };
  const day = dayNow(s);
  while (day >= c.nextBillingDay) {
    const pay = (amt: number, cat: string, label: string, branchId?: string) => { companyTx(s, -amt, 'expense', cat, label, { branchId, allowNegative: true }); total += amt; };
    for (const e of c.employees) if (e.salary > 0 && e.status !== 'resigned' && e.status !== 'terminated') pay(e.salary, 'salaries', `Salary · ${e.name} (${ROLE_INFO[e.role].label})`, e.branchId);
    for (const b of c.branches) pay(b.rentMonthly, 'rent', `Office rent · ${b.name}`, b.id);
    for (const b of c.bikes) {
      const prem = PREMIUM[b.insurance.plan];
      if (prem > 0) { pay(prem, 'insurance', `Insurance premium ${b.plate} (${b.insurance.plan})`, b.branchId); b.insurance.expiresDay = c.nextBillingDay + 30; }
    }
    const monthRev = s.ledger.filter((l) => l.account === 'company' && l.kind === 'income' && l.time >= (c.nextBillingDay - 30) * 1440).reduce((a, l) => a + l.amount, 0);
    const taxBase = 1500 + monthRev * 0.02;
    pay(Math.round(taxBase * (hasStaff(s, 'accountant') ? 0.75 : 1)), 'taxes', 'Taxes, GST filing & registration renewals');
    const mk = 500 * c.branches.length;
    pay(mk, 'marketing', 'Local marketing & app hosting');
    c.nextBillingDay += 30;
    if (c.bank < 0) { c.credit = Math.max(300, c.credit - 10); adjustRep(s, -1); notify(s, 'Company account is OVERDRAWN after monthly billing!', 'bad'); }
    else notify(s, `Monthly billing processed: ₹${total.toLocaleString('en-IN')} (salaries, rent, insurance, taxes).`, 'info');
    if (c.reputation < 40 && rnd(s) < 0.0) break;
  }
  return { expenses: total };
}

export { bikeCondition };
