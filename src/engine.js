// ── REPEATER ENGINE — CANONICAL CORRECT ─────────────────────────
// No forward-looking bias.
// Bet is computed from history BEFORE current spin is appended.
//
// Order per spin:
//   1. Compute bet from history (does NOT include current spin)
//   2. Resolve outcome against that bet
//   3. THEN append current spin to history
//
// This matches real table behaviour: you decide before the wheel spins.

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

// Compute bet from history (BEFORE current spin is appended)
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
  // Find max for dozens (1-3)
  const bD = [1, 2, 3].reduce((a, b) => (dc[a] >= dc[b] ? a : b));
  // Find max for columns (1-3)
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

// Red numbers on a roulette wheel
export const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

export function isRed(n) {
  return RED_NUMBERS.includes(n);
}
