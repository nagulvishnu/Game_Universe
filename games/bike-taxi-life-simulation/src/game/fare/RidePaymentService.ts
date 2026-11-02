import type { Employee, GameState, PaymentRecord, RideRecord } from '../types';
import { FARE_RULES } from './rules';
import { companyTx, walletTx } from '../state';

/** Employee 70% / company 30%. Company share is the remainder so the two always add up exactly. */
export function splitEmployeeRevenue(total: number): { driver: number; company: number } {
  const t = Math.max(0, Math.round(total));
  const driver = Math.round(t * FARE_RULES.employeeShare);
  return { driver, company: t - driver };
}

let paySeq = 1;
function rec(s: GameState, ride: RideRecord, kind: PaymentRecord['kind'], amount: number, account: PaymentRecord['account'], note: string) {
  ride.payments.push({ id: `P${paySeq++}`, rideId: ride.id, kind, amount, account, at: s.time, note });
}

/** Personal independent ride: 100% of the fare is credited to the player's PERSONAL wallet. */
export function settlePersonalRide(s: GameState, ride: RideRecord, total: number) {
  walletTx(s, total, 'ride', `Ride: ${ride.pickup.label} → ${ride.dest.label}`, 'income');
  rec(s, ride, 'earning', total, 'wallet', 'Personal ride income');
}

/** Company ride: split 70/30; the 30% reaches the COMPANY bank only. */
export function settleCompanyRide(s: GameState, ride: RideRecord, emp: Employee, total: number) {
  const sp = splitEmployeeRevenue(total);
  emp.wallet += sp.driver;
  emp.totalEarned += sp.driver;
  emp.ridesDone += 1;
  emp.earnings.push({ day: Math.floor(s.time / 1440), amount: sp.driver, rideId: ride.id });
  if (emp.earnings.length > 400) emp.earnings.splice(0, emp.earnings.length - 400);
  companyTx(s, sp.company, 'income', 'ride-commission', `30% commission · ${emp.name}`, { branchId: ride.branchId });
  if (s.company) s.company.revenueTotal += sp.company;
  ride.split = sp;
  rec(s, ride, 'earning', sp.driver, 'employee', `Employee share (70%)`);
  rec(s, ride, 'commission', sp.company, 'company', `Company share (30%)`);
}

// ----- customer-app prepayment from the player's personal wallet (player acting as a customer) -----
export function holdCustomerPayment(s: GameState, ride: RideRecord): boolean {
  const amt = ride.estimate.total;
  if (!walletTx(s, -amt, 'customer-ride', `Company app booking (hold) ${ride.id}`, 'expense')) return false;
  ride.prepaid = amt;
  rec(s, ride, 'charge', amt, 'wallet', 'Estimated fare charged at booking');
  return true;
}

/** Settle final vs prepaid; returns settlement note. */
export function settleCustomerAdjustment(s: GameState, ride: RideRecord, finalTotal: number): string {
  const held = ride.prepaid ?? 0;
  const diff = finalTotal - held;
  if (diff > 0) {
    const take = Math.min(diff, s.wallet);
    if (take > 0) walletTx(s, -take, 'customer-ride', `Fare adjustment ${ride.id}`, 'expense');
    rec(s, ride, 'adjustment', take, 'wallet', `Extra charge ₹${take}`);
    ride.prepaid = held + take;
    return take < diff ? `Extra ₹${take} charged (₹${diff - take} waived: insufficient wallet)` : `Extra ₹${take} charged`;
  }
  if (diff < 0) {
    walletTx(s, -diff, 'customer-ride', `Fare refund ${ride.id}`, 'income');
    rec(s, ride, 'refund', -diff, 'wallet', `Refund ₹${-diff} (final fare below estimate)`);
    ride.prepaid = finalTotal;
    ride.refunded = (ride.refunded ?? 0) - diff;
    return `Refunded ₹${-diff}`;
  }
  return 'No adjustment';
}

/** Customer cancellation: fee (if any) split 70/30 when a driver was assigned; remainder refunded. */
export function settleCancellation(s: GameState, ride: RideRecord, fee: number, emp?: Employee) {
  const held = ride.prepaid ?? 0;
  const f = Math.min(fee, held);
  const refund = held - f;
  if (refund > 0) {
    walletTx(s, refund, 'customer-ride', `Cancellation refund ${ride.id}`, 'income');
    rec(s, ride, 'refund', refund, 'wallet', `Refund ₹${refund}`);
    ride.refunded = refund;
  }
  if (f > 0) {
    rec(s, ride, 'cancelFee', f, 'wallet', `Cancellation fee ₹${f}`);
    if (emp && s.company) {
      const sp = splitEmployeeRevenue(f);
      emp.wallet += sp.driver; emp.totalEarned += sp.driver;
      companyTx(s, sp.company, 'income', 'cancellation-fee', `Cancellation fee share ${ride.id}`, { branchId: ride.branchId });
      s.company.revenueTotal += sp.company;
    }
  }
  ride.cancelFee = f;
  ride.prepaid = f;
}

/** Complaint refund on a completed ride: reverses the money consistently across all parties. */
export function refundCompletedRide(s: GameState, ride: RideRecord, amount: number, emp?: Employee) {
  const total = ride.final?.total ?? 0;
  const amt = Math.min(Math.max(0, Math.round(amount)), total - (ride.refunded ?? 0));
  if (amt <= 0) return 0;
  const sp = splitEmployeeRevenue(amt);
  if (ride.source === 'customerApp') { walletTx(s, amt, 'customer-ride', `Complaint refund ${ride.id}`, 'income'); rec(s, ride, 'refund', amt, 'wallet', 'Complaint refund'); }
  if (s.company && ride.split) {
    companyTx(s, -sp.company, 'expense', 'refund', `Refund share ${ride.id}`, { branchId: ride.branchId, allowNegative: true });
    if (emp) emp.wallet -= sp.driver;
  }
  ride.refunded = (ride.refunded ?? 0) + amt;
  return amt;
}
