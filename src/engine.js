// ── REPEATER ENGINE ─────────────────────────────────────────────
// Core math functions for the Repeater roulette strategy

export const WARMUP_COUNT = 5;

// Get dozen (1-3) for a number, 0 for zero
export function getDozens(n) {
  if (n === 0) return 0;
  if (n <= 12) return 1;
  if (n <= 24) return 2;
  return 3;
}

// Get column (1-3) for a number, 0 for zero
export function getColumn(n) {
  if (n === 0) return 0;
  return ((n - 1) % 3) + 1;
}

// Compute bet from history (before current spin)
// Returns {bD, bC} or null if not enough history
export function computeBet(history, window) {
  if (history.length < window) return null;
  const recent = history.slice(-window);
  const dc = [0, 0, 0, 0];
  const cc = [0, 0, 0, 0];
  for (const h of recent) {
    dc[h.d]++;
    cc[h.c]++;
  }
  const bD = [1, 2, 3].reduce((a, b) => (dc[a] >= dc[b] ? a : b));
  const bC = [1, 2, 3].reduce((a, b) => (cc[a] >= cc[b] ? a : b));
  return { bD, bC };
}

// Resolve a single spin outcome
export function resolveSpin(num, bD, bC, betAmt) {
  if (num === 0) return { outcome: 'ZERO', pnl: -(betAmt * 2) };
  const dWin = getDozens(num) === bD;
  const cWin = getColumn(num) === bC;
  if (dWin && cWin) return { outcome: 'BOTH-WIN', pnl: betAmt * 4 };
  if (dWin || cWin) return { outcome: 'PART-WIN', pnl: betAmt };
  return { outcome: 'MISS', pnl: -(betAmt * 2) };
}

// Basic spin processor (used for simple calculations)
// CRITICAL ORDER:
// 1. Append current spin to history BEFORE computing bet
// 2. Check warmup AFTER append
// 3. Compute bet from history (which now includes current spin)
// 4. Resolve outcome
export function processSpin(num, history, window, ladder, baseBet, increment, bankroll) {
  if (num !== 0) {
    history.push({ d: getDozens(num), c: getColumn(num), n: num });
  }
  if (history.length <= WARMUP_COUNT) {
    return { outcome: 'WARMUP', pnl: 0, bD: 0, bC: 0, betAmt: 0, newLadder: ladder };
  }
  const bet = computeBet(history, window);
  const { bD, bC } = bet;
  const betAmt = Math.min(baseBet + ladder * increment, Math.floor(bankroll / 2));
  const { outcome, pnl } = resolveSpin(num, bD, bC, betAmt);
  const isWin = outcome === 'BOTH-WIN' || outcome === 'PART-WIN';
  const newLadder = isWin ? 0 : ladder + 1;
  return { outcome, pnl, bD, bC, betAmt, newLadder };
}

// Red numbers on a roulette wheel
export const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

export function isRed(n) {
  return RED_NUMBERS.includes(n);
}
