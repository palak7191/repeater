// ── COMPLETE STRATEGY LOGIC — CANONICAL CORRECT ─────────────────
// Port of Python engine_correct.py - EXACT same execution order.
// No forward-looking bias.
//
// 11 STEPS PER SPIN (matching Python exactly):
//   1. Break if bankroll <= base (handled in UI)
//   2. WARMUP - check history.length < WARMUP_COUNT, append, return
//   3. COMPUTE BET from existing history (no current spin)
//   4. OBSERVE-WAIT handling
//   5. RESOLVE OUTCOME (pnl + ladder + counters inline)
//   6. UPDATE BANKROLL
//   7. UPDATE PEAK/DRAWDOWN/MAX_LADDER (tracked in session)
//   8. APPEND TO HISTORY
//   9. RATCHET UP
//  10. RATCHET RESET
//  11. WINDOW SWITCH

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
// Exact port of Python run_session() logic, one spin at a time.

export function processFullSpin(num, sessionState, settings) {
  let {
    history,
    ladder,
    baseCurrent,
    window: curWindow,
    consecLosses,
    consecWins,
    consecWinsOnWide,
    ratchetLevel,
    ratchetLossCount,
    observing,
    observeBuffer,
    netPnl,
    bankroll,
  } = sessionState;

  const {
    baseBet,
    increment,
    startWindow,
    wideWindow,
    switchToWideAfterLosses,
    switchToWideNetThreshold,
    switchBackAfterWins,
    observeAtLadder,
    observeWindow,
    observeWinsNeeded,
    pwResetBelowLadder,
    ratchetAfterWins,
    ratchetAmount,
    ratchetMax,
    ratchetResetOnLoss,
    autoswitchEnabled,
    ratchetEnabled,
  } = settings;

  // Clone history for mutation
  let newHistory = [...history];

  // ══════════════════════════════════════════════════════════════
  // STEP 2: WARMUP CHECK
  // Check warmup BEFORE appending. Need WARMUP_COUNT history
  // entries from previous spins before we can bet.
  // ══════════════════════════════════════════════════════════════
  if (newHistory.length < WARMUP_COUNT) {
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
        ladder,
        window: curWindow,
        bankroll,
        switched: false,
        switchedTo: null,
        observing: false,
        ratchetLevel,
        timestamp: new Date().toISOString(),
      },
      newState: {
        ...sessionState,
        history: newHistory,
      },
    };
  }

  // ══════════════════════════════════════════════════════════════
  // STEP 3: COMPUTE BET from existing history (no current spin yet)
  // ══════════════════════════════════════════════════════════════
  const recent = newHistory.slice(-curWindow);
  const dc = [0, 0, 0, 0];
  const cc = [0, 0, 0, 0];
  for (const h of recent) {
    dc[h.d]++;
    cc[h.c]++;
  }
  const bD = [1, 2, 3].reduce((a, b) => (dc[a] >= dc[b] ? a : b));
  const bC = [1, 2, 3].reduce((a, b) => (cc[a] >= cc[b] ? a : b));

  // ══════════════════════════════════════════════════════════════
  // STEP 4: OBSERVE-WAIT
  // ══════════════════════════════════════════════════════════════
  let newObserving = observing;
  let newObserveBuffer = [...observeBuffer];

  if (observeAtLadder && !newObserving && ladder >= observeAtLadder) {
    newObserving = true;
    newObserveBuffer = [];
  }

  if (newObserving) {
    const dW = num !== 0 && getDozens(num) === bD;
    const cW = num !== 0 && getColumn(num) === bC;
    newObserveBuffer.push((dW || cW) && num !== 0);

    let resuming = false;
    if (newObserveBuffer.length >= observeWindow) {
      if (newObserveBuffer.filter(Boolean).length >= observeWinsNeeded) {
        resuming = true;
        newObserving = false;
        ladder = 0;
        baseCurrent = baseBet + ratchetLevel * ratchetAmount;
        newObserveBuffer = [];
      } else {
        newObserveBuffer = newObserveBuffer.slice(1);
      }
    }

    // Append AFTER observe check
    if (num !== 0) {
      newHistory.push({ d: getDozens(num), c: getColumn(num), n: num });
    }

    return {
      spinRecord: {
        num,
        outcome: 'OBSERVE',
        pnl: 0,
        bD,
        bC,
        betAmt: 0,
        ladder,
        window: curWindow,
        bankroll,
        switched: false,
        switchedTo: null,
        observing: !resuming,
        ratchetLevel,
        timestamp: new Date().toISOString(),
      },
      newState: {
        ...sessionState,
        history: newHistory,
        ladder,
        baseCurrent,
        observing: newObserving,
        observeBuffer: newObserveBuffer,
      },
    };
  }

  // ══════════════════════════════════════════════════════════════
  // STEP 5: RESOLVE OUTCOME
  // Calculate pnl, update ladder, update counters (all inline like Python)
  // ══════════════════════════════════════════════════════════════
  const eb = Math.min(baseCurrent + ladder * increment, Math.floor(bankroll / 2));
  const dW = num !== 0 && getDozens(num) === bD;
  const cW = num !== 0 && getColumn(num) === bC;

  let pnl;
  let outcome;
  let newLadder = ladder;
  let newConsecWins = consecWins;
  let newConsecLosses = consecLosses;
  let newRatchetLossCount = ratchetLossCount || 0;
  let newConsecWinsOnWide = consecWinsOnWide;

  if (num === 0) {
    // ZERO
    outcome = 'ZERO';
    pnl = -(eb * 2);
    newLadder = ladder + 1;
    newConsecLosses = consecLosses + 1;
    newConsecWins = 0;
    newRatchetLossCount = newRatchetLossCount + 1;
    if (curWindow === wideWindow) newConsecWinsOnWide = 0;
  } else if (dW && cW) {
    // BOTH-WIN
    outcome = 'BOTH-WIN';
    pnl = eb * 4;
    newLadder = 0;
    newConsecWins = consecWins + 1;
    newConsecLosses = 0;
    newRatchetLossCount = 0;
    if (curWindow === wideWindow) newConsecWinsOnWide = consecWinsOnWide + 1;
  } else if (dW || cW) {
    // PART-WIN
    outcome = 'PART-WIN';
    pnl = eb;
    newLadder = ladder >= pwResetBelowLadder ? ladder - 1 : 0;
    newLadder = Math.max(0, newLadder);
    newConsecWins = consecWins + 1;
    newConsecLosses = 0;
    newRatchetLossCount = 0;
    if (curWindow === wideWindow) newConsecWinsOnWide = consecWinsOnWide + 1;
  } else {
    // MISS
    outcome = 'MISS';
    pnl = -(eb * 2);
    newLadder = ladder + 1;
    newConsecLosses = consecLosses + 1;
    newConsecWins = 0;
    newRatchetLossCount = newRatchetLossCount + 1;
    if (curWindow === wideWindow) newConsecWinsOnWide = 0;
  }

  // ══════════════════════════════════════════════════════════════
  // STEP 6: UPDATE BANKROLL
  // ══════════════════════════════════════════════════════════════
  const newBankroll = bankroll + pnl;
  const newNetPnl = netPnl + pnl;

  // ══════════════════════════════════════════════════════════════
  // STEP 7: UPDATE PEAK/DRAWDOWN/MAX_LADDER
  // (These are tracked in the session object by the reducer)
  // ══════════════════════════════════════════════════════════════

  // ══════════════════════════════════════════════════════════════
  // STEP 8: APPEND TO HISTORY AFTER RESOLVING
  // ══════════════════════════════════════════════════════════════
  if (num !== 0) {
    newHistory.push({ d: getDozens(num), c: getColumn(num), n: num });
  }

  // ══════════════════════════════════════════════════════════════
  // STEP 9: RATCHET UP
  // ══════════════════════════════════════════════════════════════
  let newRatchetLevel = ratchetLevel;
  let newBaseCurrent = baseCurrent;

  if (ratchetEnabled && ratchetAfterWins) {
    if (newConsecWins > 0 && newConsecWins % ratchetAfterWins === 0) {
      const maxLevels = Math.floor((ratchetMax - baseBet) / Math.max(ratchetAmount, 1));
      newRatchetLevel = Math.min(ratchetLevel + 1, maxLevels);
      newBaseCurrent = Math.min(baseBet + newRatchetLevel * ratchetAmount, ratchetMax);
    }
  }

  // ══════════════════════════════════════════════════════════════
  // STEP 10: RATCHET RESET
  // ══════════════════════════════════════════════════════════════
  if (ratchetEnabled && ratchetAfterWins && newRatchetLossCount >= ratchetResetOnLoss) {
    newRatchetLevel = 0;
    newBaseCurrent = baseBet;
  }

  // ══════════════════════════════════════════════════════════════
  // STEP 11: WINDOW SWITCH
  // ══════════════════════════════════════════════════════════════
  let newWindow = curWindow;
  let switched = false;
  let switchedTo = null;

  if (autoswitchEnabled && switchToWideAfterLosses) {
    if (curWindow === startWindow) {
      if (newConsecLosses >= switchToWideAfterLosses && newNetPnl <= switchToWideNetThreshold) {
        newWindow = wideWindow;
        switched = true;
        switchedTo = wideWindow;
        newConsecWinsOnWide = 0;
        newConsecLosses = 0;
      }
    } else if (curWindow === wideWindow) {
      if (newConsecWinsOnWide >= switchBackAfterWins) {
        newWindow = startWindow;
        switched = true;
        switchedTo = startWindow;
        newConsecLosses = 0;
        newConsecWinsOnWide = 0;
      }
    }
  }

  // ══════════════════════════════════════════════════════════════
  // RETURN SPIN RECORD AND NEW STATE
  // ══════════════════════════════════════════════════════════════
  const spinRecord = {
    num,
    outcome,
    pnl,
    bD,
    bC,
    betAmt: eb,
    ladder: newLadder,
    window: curWindow,
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
    consecLosses: newConsecLosses,
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
  const { history, ladder, baseCurrent, window: curWindow, observing } = sessionState;
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
  const bet = computeBet(history, curWindow);
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
    window: curWindow,
    urgency,
    baseCurrent,
  };
}

// ── INTERSECTION NUMBERS ─────────────────────────────────────
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
