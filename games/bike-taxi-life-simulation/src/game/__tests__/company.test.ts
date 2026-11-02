import { describe, expect, it } from 'vitest';
import { newGameState, companyTx, depositLiability, dayNow } from '../state';
import type { Branding, GameState } from '../types';
import { REGISTRATION_TOTAL, SAVINGS_TARGET } from '../data';
import { applyForLoan, approveApplicant, buyCompanyBike, canRegister, emiFor, buildSchedule, processEmis, registerCompany, separateEmployee, ownerDraw } from '../logic/company';
import { generateApplicant } from '../logic/people';
import { stepSim, simulateOffline } from '../logic/sim';
import { eat, sleep, transferToSavings } from '../logic/life';
import { splitEmployeeRevenue } from '../fare/RidePaymentService';
import { migrate } from '../persistence';

const brand: Branding = { name: 'Rocket Pillion', tagline: 't', primary: '#ff0000', secondary: '#ffffff', logoShape: 'shield', logoIcon: '⚡', uniformStyle: 'stripe', shirt: '#ff0000' };

function founded(seed = 1, savings = 120000): GameState {
  const s = newGameState(seed);
  s.savings = savings;
  const r = registerCompany(s, brand);
  expect(r.ok).toBe(true);
  return s;
}
function withFleet(s: GameState, n = 2) {
  companyTx(s, 400000, 'capital', 'test', 'test funds');
  for (let i = 0; i < n; i++) expect(buyCompanyBike(s, 'kaveri100', 'hq').ok).toBe(true);
}
const goodRider = (s: GameState) => {
  const a = generateApplicant(s, 'rider');
  a.licence = { number: 'TN1', state: 'valid', expiryDay: 900 };
  a.skill = 70; a.service = 70; a.safety = 80; a.reliability = 90; a.accidents = 0;
  s.company!.applicants.push(a);
  return a;
};

describe('Opening progression', () => {
  it('new player: one basic bike, no company, third-party platform unlocked', () => {
    const s = newGameState(3);
    expect(s.bikes).toHaveLength(1);
    expect(s.bikes[0].owner).toBe('player');
    expect(s.company).toBeNull();
    expect(s.unlocks).toContain('taxiPlatform');
  });
  it('registration is locked below ₹1,00,000 and unlocked at the target', () => {
    const s = newGameState(3);
    s.savings = SAVINGS_TARGET - 1;
    expect(canRegister(s).ok).toBe(false);
    expect(registerCompany(s, brand).ok).toBe(false);
    s.savings = SAVINGS_TARGET;
    expect(canRegister(s).ok).toBe(true);
  });
  it('wallet → savings transfer and food expense', () => {
    const s = newGameState(3);
    const w = s.wallet;
    expect(transferToSavings(s, 500).ok).toBe(true);
    expect(s.wallet).toBe(w - 500); expect(s.savings).toBe(500);
    s.needs.hunger = 20;
    const w2 = s.wallet;
    eat(s, 'lunch');
    expect(s.needs.hunger).toBeGreaterThan(60); expect(s.wallet).toBeLessThan(w2);
  });
});

describe('Company registration & three accounts', () => {
  it('setup costs come from savings; remainder becomes company capital; wallet untouched', () => {
    const s = newGameState(4);
    s.savings = 100000; const wallet = s.wallet;
    registerCompany(s, brand);
    expect(s.savings).toBe(0);
    expect(s.company!.bank).toBe(100000 - REGISTRATION_TOTAL);
    expect(s.wallet).toBe(wallet);
    expect(s.company!.branding.name).toBe('Rocket Pillion');
    expect(s.company!.branches[0].id).toBe('hq');
  });
  it('rejects duplicate/invalid names', () => {
    const s = newGameState(4); s.savings = 100000;
    expect(registerCompany(s, { ...brand, name: 'ZipPillion' }).ok).toBe(false);
    expect(registerCompany(s, { ...brand, name: 'x' }).ok).toBe(false);
  });
});

describe('Loans & automatic EMI', () => {
  it('EMI maths and amortisation schedule', () => {
    const emi = emiFor(100000, 12, 12);
    expect(emi).toBe(8885);
    const sch = buildSchedule(100000, 12, 12, 30);
    expect(sch.reduce((a, r) => a + r.principalPart, 0)).toBe(100000);
    expect(sch[0].interestPart).toBe(1000);
  });
  it('approval, disbursal to COMPANY account only, and auto EMI deduction on due date', () => {
    const s = founded(2);
    const wallet = s.wallet, sav = s.savings, bank0 = s.company!.bank;
    expect(applyForLoan(s, 80000, 12).ok).toBe(true);
    const loan = s.company!.loans[0];
    expect(s.company!.bank).toBe(bank0 + 80000 - 800);
    expect(s.wallet).toBe(wallet); expect(s.savings).toBe(sav);
    s.time = loan.nextDueDay * 1440 + 60;
    const bank1 = s.company!.bank;
    processEmis(s);
    expect(s.company!.bank).toBe(bank1 - loan.emi);
    expect(loan.paidCount).toBe(1);
    expect(loan.outstanding).toBe(80000 - loan.schedule[0].principalPart);
    expect(s.wallet).toBe(wallet);
    expect(loan.nextDueDay).toBe(loan.schedule[1].dueDay);
  });
  it('insufficient funds → overdue, late fee, credit drop; recovered later', () => {
    const s = founded(2);
    applyForLoan(s, 80000, 12);
    const loan = s.company!.loans[0];
    const credit = s.company!.credit;
    companyTx(s, -(s.company!.bank - 100), 'expense', 'test', 'drain', { allowNegative: true });
    s.time = loan.nextDueDay * 1440 + 60;
    processEmis(s);
    const row = loan.schedule[0];
    expect(row.status).toBe('overdue');
    expect(row.lateFee).toBeGreaterThanOrEqual(250);
    expect(s.company!.credit).toBeLessThan(credit);
    expect(loan.paidCount).toBe(0);
    companyTx(s, 50000, 'income', 'test', 'revenue');
    const bank = s.company!.bank;
    processEmis(s);
    expect(row.status).toBe('paid');
    expect(s.company!.bank).toBe(bank - row.emi - row.lateFee);
  });
  it('repeated default triggers serious consequences', () => {
    const s = founded(2); withFleet(s, 1);
    applyForLoan(s, 60000, 12);
    const loan = s.company!.loans[0];
    companyTx(s, -(s.company!.bank - 10), 'expense', 'test', 'drain', { allowNegative: true });
    const rep = s.company!.reputation;
    for (let m = 1; m <= 3; m++) { s.time = (loan.takenDay + 30 * m) * 1440 + 10; processEmis(s); }
    expect(s.company!.seizedBikes).toBe(1);
    expect(s.company!.reputation).toBeLessThan(rep);
    expect(applyForLoan(s, 20000, 12).ok).toBe(false);
  });
});

describe('Recruitment, licence, deposits', () => {
  it('unlicensed / expired / forged applicants can never be approved or activated', () => {
    const s = founded(5); withFleet(s, 2);
    for (const lic of [null, { number: 'X', state: 'none' as const, expiryDay: 999 }, { number: 'X', state: 'expired' as const, expiryDay: -3 }, { number: 'X', state: 'forged' as const, expiryDay: 999 }, { number: 'X', state: 'valid' as const, expiryDay: -1 }]) {
      const a = generateApplicant(s, 'rider'); a.licence = lic; s.company!.applicants.push(a);
      const r = approveApplicant(s, a.id, 'hq', 'flex');
      expect(r.ok).toBe(false);
    }
    expect(s.company!.employees).toHaveLength(0);
  });
  it('valid rider: ₹5,000 refundable deposit (liability), company bike, uniform, credentials', () => {
    const s = founded(6); withFleet(s, 1);
    const a = goodRider(s);
    const bank = s.company!.bank, rev = s.company!.revenueTotal;
    const r = approveApplicant(s, a.id, 'hq', 'morning');
    expect(r.ok).toBe(true);
    const e = s.company!.employees[0];
    expect(e.deposit).toBe(5000);
    expect(depositLiability(s)).toBe(5000);
    expect(s.company!.bank).toBe(bank + 5000);
    expect(s.company!.revenueTotal).toBe(rev); // deposit is NOT revenue
    expect(e.bikeId).toBeTruthy();
    expect(s.company!.bikes.find((b) => b.id === e.bikeId)!.owner).toBe('company');
    expect(e.uniform).toBe(true); expect(e.username.length).toBeGreaterThan(3); expect(e.password).toHaveLength(6);
  });
  it('cannot approve a rider without a free company bike', () => {
    const s = founded(6); const a = goodRider(s);
    expect(approveApplicant(s, a.id, 'hq', 'flex').ok).toBe(false);
  });
  it('resignation returns bike & refunds deposit minus legitimate deductions', () => {
    const s = founded(7); withFleet(s, 1);
    const a = goodRider(s); approveApplicant(s, a.id, 'hq', 'flex');
    const e = s.company!.employees[0]; const bike = s.company!.bikes[0];
    const bank = s.company!.bank;
    bike.damage += 10; // damaged during tenure: 10 × ₹20 = ₹200
    const r = separateEmployee(s, e.id, 'resign');
    expect(r.ok).toBe(true);
    expect(bike.assignedEmployeeId).toBeUndefined();
    expect(e.bikeId).toBeUndefined();
    expect(s.company!.bank).toBe(bank - 4800);
    expect(depositLiability(s)).toBe(0);
  });
});

describe('Autonomous company simulation', () => {
  function runningCompany() {
    const s = founded(11); withFleet(s, 2);
    const emps = [goodRider(s), goodRider(s)];
    emps.forEach((a) => approveApplicant(s, a.id, 'hq', 'flex'));
    s.time = 7 * 60 + 1440; // next morning
    return s;
  }
  it('employees work on their own, earn 70/30 and bank reconciles with the ledger', () => {
    const s = runningCompany();
    const opening = s.ledger.filter((l) => l.account === 'company').reduce((a, l) => a + l.amount, 0);
    expect(s.company!.bank).toBe(opening);
    stepSim(s, 60 * 12, { step: 5 });
    const c = s.company!;
    expect(c.ridesTotal).toBeGreaterThan(0);
    const completed = s.rides.filter((r) => r.status === 'completed' && r.split);
    expect(completed.length).toBeGreaterThan(0);
    for (const r of completed) {
      expect(r.split!.driver + r.split!.company).toBe(r.final!.total);
      expect(r.split!.driver).toBe(splitEmployeeRevenue(r.final!.total).driver);
    }
    const empTotal = c.employees.reduce((a, e) => a + e.totalEarned, 0);
    const commission = s.ledger.filter((l) => l.category === 'ride-commission').reduce((a, l) => a + l.amount, 0);
    expect(empTotal).toBeGreaterThan(0);
    expect(Math.abs(empTotal / (empTotal + commission) - 0.7)).toBeLessThan(0.02);
    // ledger reconciliation: bank equals the sum of all company ledger entries
    const sum = s.ledger.filter((l) => l.account === 'company').reduce((a, l) => a + l.amount, 0);
    expect(c.bank).toBe(sum);
    // personal accounts untouched by company operations
    expect(s.savings).toBe(0);
  });
  it('a month passes: EMI auto-deducted + monthly billing recorded', () => {
    const s = runningCompany();
    expect(applyForLoan(s, 90000, 12).ok).toBe(true);
    stepSim(s, 1440 * 31, { step: 30 });
    const loan = s.company!.loans[0];
    expect(loan.paidCount + loan.schedule.filter((r) => r.status === 'overdue').length).toBeGreaterThanOrEqual(1);
    expect(s.ledger.some((l) => l.category === 'rent')).toBe(true);
    const sum = s.ledger.filter((l) => l.account === 'company').reduce((a, l) => a + l.amount, 0);
    expect(s.company!.bank).toBe(sum);
  });
  it('licence expiry removes rider from duty (enforced by simulation)', () => {
    const s = runningCompany();
    const e = s.company!.employees[0];
    e.licence!.expiryDay = dayNow(s) + 1;
    stepSim(s, 1440 * 3, { step: 30 });
    expect(e.status).toBe('licenceExpired');
    expect(e.online).toBe(false);
    s.rides.filter((r) => r.driverId === e.id && (r.startedAt ?? 0) > (dayNow(s) - 1) * 1440 + 1440).forEach((r) => expect(r.status).not.toBe('inprogress'));
  });
  it('offline progression is capped and reported', () => {
    const s = runningCompany();
    const rep = simulateOffline(s, 1000 * 60 * 60 * 72); // 72 real hours away
    expect(rep).not.toBeNull();
    expect(rep!.capped).toBe(true);
    expect(rep!.simulatedGameMin).toBe(18 * 60);
    expect(rep!.rides).toBeLessThan(200);
    expect(simulateOffline(s, 1000 * 30)).toBeNull();
  });
  it('owner draw respects reserve (no unlimited money)', () => {
    const s = runningCompany();
    expect(ownerDraw(s, s.company!.bank).ok).toBe(false);
  });
});

describe('Life simulation & persistence', () => {
  it('needs decay with time; sleeping advances time to morning and restores energy', () => {
    const s = newGameState(9);
    s.time = 22 * 60;
    stepSim(s, 120);
    expect(s.needs.hunger).toBeLessThan(70);
    s.needs.energy = 20;
    const t0 = s.time;
    const r = sleep(s);
    expect(r.ok).toBe(true);
    expect(s.time).toBeGreaterThan(t0 + 5 * 60);
    expect(Math.floor((s.time % 1440) / 60)).toBeGreaterThanOrEqual(6);
    expect(s.needs.energy).toBeGreaterThan(80);
  });
  it('save round-trips through JSON + migration with company state intact', () => {
    const s = founded(12); withFleet(s, 1);
    const json = JSON.parse(JSON.stringify(s));
    const m = migrate(json)!;
    expect(m.company!.bank).toBe(s.company!.bank);
    expect(m.company!.branding.name).toBe('Rocket Pillion');
    expect(m.bikes[0].x).toBe(s.bikes[0].x);
    expect(migrate({ version: 99 } as never)).toBeNull();
    expect(migrate({ version: 3, time: NaN } as never)).toBeNull();
  });
});
