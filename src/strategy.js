// ── COMPLETE STRATEGY LOGIC — CANONICAL CORRECT ─────────────────
// No forward-looking bias.
// Bet is computed from history BEFORE current spin is appended.
//
// Order per spin:
//   1. Check warmup (need WARMUP_COUNT history entries BEFORE betting)
//   2. Compute bet from history (does NOT include current spin)
//   3. Resolve outcome against that bet
//   4. THEN append current spin to history
//
// This matches real table behaviour: you decide before the wheel spins.

import { WARMUP_COUNT, getDozens, getColumn, computeBet, resolveSpin } from './engine.js';

// ── CONSTANTS ────────────────────────────────────────────────
export const STRATEGY = {
  START_WINDOW: 2,
  WIDE_WINDOW: 7,
  SWITCH_TO_WIDE_AFTER_LOSSES: 4,
  SWITCH_TO_WIDE_NET_THRESHOLD: -100,
  SWITCH_BACK_AFTER_WINS: 4,
  OBSERVE_AT_LADDER: 3,
  OBSERVE_WINDOW: 7,
  OBSERVE_WINS_NEEDED: 3,
  PW_RESET_BELOW_LADDER: 3,
  RATCHET_AFTER_WINS: 3,
  RATCHET_AMOUNT: 20,
  RATCHET_MAX: 50,
  RATCHET_RESET_ON_LOSS: 1,
};

// ── FULL SPIN PROCESSOR ──────────────────────────────────────
// CORRECT ORDER:
//   1. Check warmup from existing history
//   2. Compute bet from existing history
//   3. Resolve outcome
//   4. Append to history AFTER resolving

export function processFullSpin(num, sessionState, settings) {
  const {
    history,
    ladder,
    baseCurrent,
    window,
    consecLosses,
    consecWins,
    consecWinsOnWide,
    ratchetLevel,
    observing,
    observeBuffer,
    netPnl,
    bankroll,
    ratchetLossCount,
  } = sessionState;

  const {
    baseBet, increment,
    startWindow, wideWindow,
    switchToWideAfterLosses, switchToWideNetThreshold,
    switchBackAfterWins,
    observeAtLadder, observeWindow, observeWinsNeeded,
    pwResetBelowLadder,
    ratchetAfterWins, ratchetAmount, ratchetMax,
    ratchetResetOnLoss,
    autoswitchEnabled,
    ratchetEnabled,
  } = settings;

  // ── STEP 1: WARMUP CHECK (before appending) ────────────────
  // Need WARMUP_COUNT history entries from previous spins before we can bet
  if (history.length < WARMUP_COUNT) {
    // Append AFTER warmup check
    const newHistory = [...history];
    if (num !== 0) {
      newHistory.push({ d: getDozens(num), c: getColumn(num), n: num });
    }

    return {
      spinRecord: {
        num,
        outcome: 'WARMUP',
        pnl: 0,
        bD: 0,
        bC: 0,
        betAmt: 0,
        ladder: ladder,
        window: window,
        bankroll: bankroll,
        switched: false,
        switchedTo: null,
        observing: false,
        ratchetLevel: ratchetLevel,
        timestamp: new Date().toISOString(),
      },
      newState: { ...sessionState, history: newHistory },
    };
  }

  // ── STEP 2: COMPUTE BET from existing history (no current spin yet) ──
  const betInfo = computeBet(history, window);
  const { bD, bC } = betInfo;

  // ── STEP 3: OBSERVE-WAIT CHECK ─────────────────────────────
  let newObserving = observing;
  let newObserveBuffer = [...observeBuffer];

  if (observeAtLadder && !observing && ladder >= observeAtLadder) {
    newObserving = true;
    newObserveBuffer = [];
  }

  if (newObserving) {
    // Check if current spin would be a win against computed bet
    const dW = num !== 0 && getDozens(num) === bD;
    const cW = num !== 0 && getColumn(num) === bC;
    const obsWin = (dW || cW) && num !== 0;
    newObserveBuffer = [...newObserveBuffer, obsWin];

    let resuming = false;
    if (newObserveBuffer.length >= observeWindow) {
      const winsInBuffer = newObserveBuffer.filter(Boolean).length;
      if (winsInBuffer >= observeWinsNeeded) {
        resuming = true;
        newObserving = false;
        newObserveBuffer = [];
      } else {
        // Slide window
        newObserveBuffer = newObserveBuffer.slice(1);
      }
    }

    // Append AFTER observe check
    const newHistory = [...history];
    if (num !== 0) {
      newHistory.push({ d: getDozens(num), c: getColumn(num), n: num });
    }

    const newLadder = resuming ? 0 : ladder;
    const newBase = resuming ? baseBet + ratchetLevel * ratchetAmount : baseCurrent;

    return {
      spinRecord: {
        num,
        outcome: 'OBSERVE',
        pnl: 0,
        bD: bD,
        bC: bC,
        betAmt: 0,
        ladder: newLadder,
        window: window,
        bankroll: bankroll,
        switched: false,
        switchedTo: null,
        observing: !resuming,
        ratchetLevel: ratchetLevel,
        timestamp: new Date().toISOString(),
      },
      newState: {
        ...sessionState,
        history: newHistory,
        observing: newObserving,
        observeBuffer: newObserveBuffer,
        ladder: newLadder,
        baseCurrent: newBase,
      },
    };
  }

  // ── STEP 4: RESOLVE OUTCOME ────────────────────────────────
  const betAmt = Math.min(baseCurrent + ladder * increment, Math.floor(bankroll / 2));
  const { outcome, pnl } = resolveSpin(num, bD, bC, betAmt);

  const isWin = outcome === 'BOTH-WIN' || outcome === 'PART-WIN';
  const isLoss = !isWin;

  // ── STEP 5: APPEND TO HISTORY AFTER RESOLVING ──────────────
  const newHistory = [...history];
  if (num !== 0) {
    newHistory.push({ d: getDozens(num), c: getColumn(num), n: num });
  }

  // ── STEP 6: UPDATE LADDER ──────────────────────────────────
  let newLadder = ladder;
  if (outcome === 'BOTH-WIN') {
    newLadder = 0;
  } else if (outcome === 'PART-WIN') {
    newLadder = ladder >= pwResetBelowLadder ? Math.max(0, ladder - 1) : 0;
  } else {
    // MISS or ZERO
    newLadder = ladder + 1;
  }

  // ── STEP 7: UPDATE CONSECUTIVE COUNTERS ────────────────────
  const newConsecWins = isWin ? consecWins + 1 : 0;
  const newConsecLosses = isLoss ? consecLosses + 1 : 0;
  const newRatchetLossCount = isLoss ? (ratchetLossCount || 0) + 1 : 0;

  // ── STEP 8: RATCHET UP ─────────────────────────────────────
  let newRatchetLevel = ratchetLevel;
  let newBaseCurrent = baseCurrent;

  if (ratchetEnabled && ratchetAfterWins) {
    if (isWin && newConsecWins > 0 && newConsecWins % ratchetAfterWins === 0) {
      const maxLevels = Math.floor((ratchetMax - baseBet) / Math.max(ratchetAmount, 1));
      newRatchetLevel = Math.min(ratchetLevel + 1, maxLevels);
      newBaseCurrent = Math.min(baseBet + newRatchetLevel * ratchetAmount, ratchetMax);
    }
  }

  // ── STEP 9: RATCHET RESET ──────────────────────────────────
  if (ratchetEnabled && ratchetAfterWins && newRatchetLossCount >= ratchetResetOnLoss) {
    newRatchetLevel = 0;
    newBaseCurrent = baseBet;
  }

  // ── STEP 10: UPDATE BANKROLL ───────────────────────────────
  const newBankroll = bankroll + pnl;
  const newNetPnl = netPnl + pnl;

  // ── STEP 11: WINDOW SWITCH ─────────────────────────────────
  let newWindow = window;
  let switched = false;
  let switchedTo = null;

  let newConsecWinsOnWide = window === wideWindow
    ? (isWin ? consecWinsOnWide + 1 : 0)
    : 0;

  if (autoswitchEnabled && switchToWideAfterLosses) {
    if (window === startWindow) {
      if (newConsecLosses >= switchToWideAfterLosses && newNetPnl <= switchToWideNetThreshold) {
        newWindow = wideWindow;
        switched = true;
        switchedTo = wideWindow;
        newConsecWinsOnWide = 0;
        // Reset consec loss after switch
      }
    } else if (window === wideWindow) {
      if (newConsecWinsOnWide >= switchBackAfterWins) {
        newWindow = startWindow;
        switched = true;
        switchedTo = startWindow;
      }
    }
  }

  const spinRecord = {
    num,
    outcome,
    pnl,
    bD,
    bC,
    betAmt,
    ladder: newLadder,
    window: window,
    bankroll: newBankroll,
    switched,
    switchedTo,
    observing: false,
    ratchetLevel: newRatchetLevel,
    baseCurrent: newBaseCurrent,
    timestamp: new Date().toISOString(),
  };

  const newState = {
    ...sessionState,
    history: newHistory,
    ladder: newLadder,
    baseCurrent: newBaseCurrent,
    window: newWindow,
    consecLosses: switched ? 0 : newConsecLosses,
    consecWins: newConsecWins,
    consecWinsOnWide: newConsecWinsOnWide,
    ratchetLevel: newRatchetLevel,
    ratchetLossCount: newRatchetLossCount,
    observing: false,
    observeBuffer: [],
    bankroll: newBankroll,
    netPnl: newNetPnl,
  };

  return { spinRecord, newState };
}

// ── NEXT BET INSTRUCTION ─────────────────────────────────────
// What to show the user before they enter the next spin.
// Computed from current history (which does NOT include next spin yet).
export function getNextInstruction(sessionState, settings) {
  const { history, ladder, baseCurrent, window, observing } = sessionState;
  const { increment, observeAtLadder } = settings;
  const bankroll = sessionState.bankroll;

  // Warmup: need WARMUP_COUNT history entries before betting
  if (history.length < WARMUP_COUNT) {
    return {
      type: 'WARMUP',
      warmupDone: history.length,
      warmupTotal: WARMUP_COUNT,
    };
  }

  // Observe mode
  if (observing || (observeAtLadder && ladder >= observeAtLadder)) {
    return {
      type: 'OBSERVE',
      ladder,
      message: 'Watching - do not bet',
    };
  }

  // Compute bet from current history
  const bet = computeBet(history, window);
  if (!bet) {
    return { type: 'WARMUP', warmupDone: history.length, warmupTotal: WARMUP_COUNT };
  }

  const { bD, bC } = bet;
  const betAmt = Math.min(baseCurrent + ladder * increment, Math.floor(bankroll / 2));

  // Urgency level
  let urgency = 'base';
  if (ladder === 0) urgency = 'base';
  else if (ladder <= 2) urgency = 'mid';
  else if (ladder <= 4) urgency = 'high';
  else urgency = 'critical';

  return {
    type: 'BET',
    bD,
    bC,
    betAmt,
    ladder,
    window,
    urgency,
    baseCurrent,
  };
}

// ── INTERSECTION NUMBERS ─────────────────────────────────────
// The exact numbers to place chips on.
export function getChipNumbers(bD, bC) {
  const numbers = [];
  for (let n = 1; n <= 36; n++) {
    if (getDozens(n) === bD && getColumn(n) === bC) {
      numbers.push(n);
    }
  }
  return numbers.sort((a, b) => a - b);
}

// ── DOZEN AND COLUMN LABELS ──────────────────────────────────
export const DOZ_LABEL = { 1: 'D1', 2: 'D2', 3: 'D3', 0: '-' };
export const COL_LABEL = { 1: 'C1', 2: 'C2', 3: 'C3', 0: '-' };
