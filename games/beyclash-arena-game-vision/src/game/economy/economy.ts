export const START_POINTS = 5000;
export const QUALIFY_TARGET = 50000;
/** Configurable default points moved from loser to winner per official battle. */
export const DEFAULT_TRANSFER = 250;

export interface TransferResult {
  /** Points actually moved (never more than the loser owned). */
  amount: number;
  winnerAfter: number;
  loserAfter: number;
}

/** Conservative transfer: total points before === total after. Balances never go negative. */
export function transfer(winnerBalance: number, loserBalance: number, requested = DEFAULT_TRANSFER): TransferResult {
  const w = Math.max(0, Math.floor(winnerBalance));
  const l = Math.max(0, Math.floor(loserBalance));
  const amount = Math.max(0, Math.min(Math.floor(requested), l));
  return { amount, winnerAfter: w + amount, loserAfter: l - amount };
}

export const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
