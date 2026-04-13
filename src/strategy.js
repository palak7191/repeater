// ── COMPLETE STRATEGY LOGIC ─────────────────────────────────────
// All rules derived from data analysis across 7 real sessions.

import { WARMUP_COUNT, getDozens, getColumn, computeBet, resolveSpin } from './engine.js';

// ── CONSTANTS ────────────────────────────────────────────────
export const STRATEGY = {
  // Windows
  START_WINDOW: 2,
  WIDE_WINDOW: 7,

  // Window switch — downside protection
  SWITCH_TO_WIDE_AFTER_LOSSES: 4,
  SWITCH_TO_WIDE_NET_THRESHOLD: -100,
  SWITCH_BACK_AFTER_WINS: 4,

  // Observe-wait — ladder protection
  OBSERVE_AT_LADDER: 3,
  OBSERVE_WINDOW: 7,
  OBSERVE_WINS_NEEDED: 3,

  // Part-win ladder response
  PW_RESET_BELOW_LADDER: 3,

  // Ratchet up — upside extraction (CONSERVATIVE)
  RATCHET_AFTER_WINS: 3,
  RATCHET_AMOUNT: 20,
  RATCHET_MAX: 50,
  RATCHET_RESET_ON_LOSS: 1,
};

// ── FULL SPIN PROCESSOR ──────────────────────────────────────
// This is the single function called per spin.
// Takes current session state, returns updated state + spin record.

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

  // STEP 1: Append to history (before bet calculation)
  const newHistory = [...history];
  if (num !== 0) {
    newHistory.push({ d: getDozens(num), c: getColumn(num), n: num });
  }

  // STEP 2: Warmup check
  if (newHistory.length <= WARMUP_COUNT) {
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

  // STEP 3: Observe-wait mode
  let newObserving = observing;
  let newObserveBuffer = [...observeBuffer];

  if (!observing && ladder >= observeAtLadder) {
    newObserving = true;
    newObserveBuffer = [];
  }

  if (newObserving) {
    const betInfo = computeBet(newHistory, window);
    const dW = num !== 0 && betInfo && getDozens(num) === betInfo.bD;
    const cW = num !== 0 && betInfo && getColumn(num) === betInfo.bC;
    const obsWin = (dW || cW) && num !== 0;
    newObserveBuffer = [...newObserveBuffer, obsWin];

    let resuming = false;
    if (newObserveBuffer.length >= observeWindow) {
      if (newObserveBuffer.filter(Boolean).length >= observeWinsNeeded) {
        resuming = true;
        newObserving = false;
        newObserveBuffer = [];
      } else {
        newObserveBuffer = newObserveBuffer.slice(1);
      }
    }

    const newLadder = resuming ? 0 : ladder;
    const newBase = resuming ? baseBet : baseCurrent;

    return {
      spinRecord: {
        num,
        outcome: 'OBSERVE',
        pnl: 0,
        bD: 0,
        bC: 0,
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

  // STEP 4: Compute bet
  const betInfo = computeBet(newHistory, window);
  const { bD, bC } = betInfo;
  const betAmt = Math.min(baseCurrent + ladder * increment, Math.floor(bankroll / 2));

  // STEP 5: Resolve outcome
  const { outcome, pnl } = resolveSpin(num, bD, bC, betAmt);
  const isWin = outcome === 'BOTH-WIN' || outcome === 'PART-WIN';
  const isLoss = !isWin;

  // STEP 6: Update ladder
  let newLadder = ladder;
  if (outcome === 'BOTH-WIN') {
    newLadder = 0;
  } else if (outcome === 'PART-WIN') {
    newLadder = ladder < pwResetBelowLadder ? 0 : Math.max(0, ladder - 1);
  } else {
    newLadder = ladder + 1;
  }

  // STEP 7: Update ratchet
  let newRatchetLevel = ratchetLevel;
  let newBaseCurrent = baseCurrent;
  const newConsecWins = isWin ? consecWins + 1 : 0;
  const newConsecLosses = isLoss ? consecLosses + 1 : 0;

  if (ratchetEnabled) {
    if (isWin && newConsecWins % ratchetAfterWins === 0) {
      newRatchetLevel = Math.min(
        ratchetLevel + 1,
        Math.floor((ratchetMax - baseBet) / ratchetAmount)
      );
      newBaseCurrent = Math.min(baseBet + newRatchetLevel * ratchetAmount, ratchetMax);
    }
    if (isLoss && newConsecLosses >= ratchetResetOnLoss) {
      newRatchetLevel = 0;
      newBaseCurrent = baseBet;
    }
  }

  // STEP 8: Window switch
  const newBankroll = bankroll + pnl;
  const newNetPnl = netPnl + pnl;
  let newWindow = window;
  let switched = false;
  let switchedTo = null;

  const newConsecWinsOnWide = window === wideWindow
    ? (isWin ? consecWinsOnWide + 1 : 0)
    : 0;

  if (autoswitchEnabled) {
    if (window === startWindow) {
      if (newConsecLosses >= switchToWideAfterLosses && newNetPnl <= switchToWideNetThreshold) {
        newWindow = wideWindow;
        switched = true;
        switchedTo = wideWindow;
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
    consecLosses: newConsecLosses,
    consecWins: newConsecWins,
    consecWinsOnWide: newConsecWinsOnWide,
    ratchetLevel: newRatchetLevel,
    observing: false,
    observeBuffer: [],
    bankroll: newBankroll,
    netPnl: newNetPnl,
  };

  return { spinRecord, newState };
}

// ── NEXT BET INSTRUCTION ─────────────────────────────────────
// What to show the user before they enter the next spin.
export function getNextInstruction(sessionState, settings) {
  const { history, ladder, baseCurrent, window, observing, netPnl } = sessionState;
  const { increment, observeAtLadder } = settings;
  const bankroll = sessionState.bankroll;

  if (history.length <= WARMUP_COUNT) {
    return {
      type: 'WARMUP',
      warmupDone: history.length,
      warmupTotal: WARMUP_COUNT,
    };
  }

  if (observing || ladder >= observeAtLadder) {
    return {
      type: 'OBSERVE',
      ladder,
      message: 'Watching - do not bet',
    };
  }

  const bet = computeBet(history, window);
  if (!bet) return { type: 'WARMUP', warmupDone: history.length, warmupTotal: WARMUP_COUNT };

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
