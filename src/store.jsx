// ── STATE MANAGEMENT ─────────────────────────────────────────────
// React Context + useReducer + localStorage

import { createContext, useContext, useReducer, useEffect } from 'react';
import { processFullSpin, getNextInstruction } from './strategy.js';

// ── DEFAULT SETTINGS ─────────────────────────────────────────
export const DEFAULT_SETTINGS = {
  // Core
  baseBet: 10,
  increment: 20,
  bankroll: 10000,

  // Windows
  startWindow: 2,
  wideWindow: 7,

  // Switch conditions
  switchToWideAfterLosses: 4,
  switchToWideNetThreshold: -100,
  switchBackAfterWins: 4,

  // Observe-wait
  observeAtLadder: 3,
  observeWindow: 7,
  observeWinsNeeded: 3,

  // Part-win
  pwResetBelowLadder: 3,

  // Ratchet (conservative)
  ratchetAfterWins: 3,
  ratchetAmount: 20,
  ratchetMax: 50,
  ratchetResetOnLoss: 1,

  // Meta
  autoswitchEnabled: true,
  ratchetEnabled: true,
  tableName: '',
};

// ── INITIAL SESSION STATE ────────────────────────────────────
function createInitialSessionState(settings) {
  return {
    history: [],
    ladder: 0,
    baseCurrent: settings.baseBet,
    window: settings.startWindow,
    consecLosses: 0,
    consecWins: 0,
    consecWinsOnWide: 0,
    ratchetLevel: 0,
    ratchetLossCount: 0,
    observing: false,
    observeBuffer: [],
    bankroll: settings.bankroll,
    netPnl: 0,
  };
}

// ── INITIAL APP STATE ────────────────────────────────────────
const STORAGE_KEY = 'repeater_v2';

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
        sessions: parsed.sessions || [],
        currentSession: parsed.currentSession || null,
        sessionState: parsed.sessionState || null,
        toasts: [],
      };
    }
  } catch (e) {
    console.error('Failed to load state:', e);
  }
  return {
    settings: { ...DEFAULT_SETTINGS },
    sessions: [],
    currentSession: null,
    sessionState: null,
    toasts: [],
  };
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      settings: state.settings,
      sessions: state.sessions,
      currentSession: state.currentSession,
      sessionState: state.sessionState,
    }));
  } catch (e) {
    console.error('Failed to save state:', e);
  }
}

// ── REDUCER ──────────────────────────────────────────────────
function reducer(state, action) {
  switch (action.type) {
    case 'START_SESSION': {
      const session = {
        id: Date.now().toString(),
        tableName: state.settings.tableName,
        startedAt: new Date().toISOString(),
        endedAt: null,
        settings: { ...state.settings },
        spins: [],
        switchLog: [],
        wins: 0,
        losses: 0,
        bothWins: 0,
        partWins: 0,
        zeros: 0,
        maxLadder: 0,
        maxDrawdown: 0,
        peak: state.settings.bankroll,
        pnlCurve: [],
      };
      const sessionState = createInitialSessionState(state.settings);
      return {
        ...state,
        currentSession: session,
        sessionState,
      };
    }

    case 'RECORD_SPIN': {
      if (!state.currentSession || !state.sessionState) return state;

      const { spinRecord, newState } = processFullSpin(
        action.num,
        state.sessionState,
        state.settings
      );

      // Update session stats
      const session = { ...state.currentSession };
      session.spins = [...session.spins, spinRecord];

      // Update aggregates
      if (spinRecord.outcome === 'BOTH-WIN') {
        session.wins++;
        session.bothWins++;
      } else if (spinRecord.outcome === 'PART-WIN') {
        session.wins++;
        session.partWins++;
      } else if (spinRecord.outcome === 'MISS') {
        session.losses++;
      } else if (spinRecord.outcome === 'ZERO') {
        session.losses++;
        session.zeros++;
      }

      // Track max ladder
      session.maxLadder = Math.max(session.maxLadder, spinRecord.ladder);

      // Track peak and drawdown
      if (spinRecord.bankroll > session.peak) {
        session.peak = spinRecord.bankroll;
      }
      const dd = session.peak - spinRecord.bankroll;
      if (dd > session.maxDrawdown) {
        session.maxDrawdown = dd;
      }

      // P&L curve (only for active spins)
      if (spinRecord.outcome !== 'WARMUP' && spinRecord.outcome !== 'OBSERVE') {
        session.pnlCurve = [...session.pnlCurve, newState.netPnl];
      }

      // Switch log
      if (spinRecord.switched) {
        session.switchLog = [
          ...session.switchLog,
          {
            spinIndex: session.spins.length,
            from: state.sessionState.window,
            to: spinRecord.switchedTo,
            reason: spinRecord.switchedTo > state.sessionState.window
              ? `${state.settings.switchToWideAfterLosses} consec losses`
              : `${state.settings.switchBackAfterWins} consec wins`,
            netAtSwitch: newState.netPnl,
          },
        ];
      }

      // Create toast for switch
      let toasts = state.toasts;
      if (spinRecord.switched) {
        toasts = [
          ...toasts,
          {
            id: Date.now(),
            type: 'switch',
            message: `Window switched to W=${spinRecord.switchedTo}`,
          },
        ];
      }

      return {
        ...state,
        currentSession: session,
        sessionState: newState,
        toasts,
      };
    }

    case 'END_SESSION': {
      if (!state.currentSession) return state;

      const session = {
        ...state.currentSession,
        endedAt: new Date().toISOString(),
      };

      return {
        ...state,
        sessions: [...state.sessions, session],
        currentSession: null,
        sessionState: null,
      };
    }

    case 'DELETE_SESSION': {
      return {
        ...state,
        sessions: state.sessions.filter(s => s.id !== action.id),
      };
    }

    case 'UPDATE_SETTINGS': {
      return {
        ...state,
        settings: { ...state.settings, ...action.settings },
      };
    }

    case 'RESET_SETTINGS': {
      return {
        ...state,
        settings: { ...DEFAULT_SETTINGS },
      };
    }

    case 'DISMISS_TOAST': {
      return {
        ...state,
        toasts: state.toasts.filter(t => t.id !== action.id),
      };
    }

    case 'UNDO_SPIN': {
      if (!state.currentSession || state.currentSession.spins.length === 0) {
        return state;
      }

      // Remove last spin
      const spins = state.currentSession.spins.slice(0, -1);
      const lastSpin = state.currentSession.spins[state.currentSession.spins.length - 1];

      // Rebuild session stats
      let wins = 0, losses = 0, bothWins = 0, partWins = 0, zeros = 0;
      let maxLadder = 0;
      const pnlCurve = [];
      let runningPnl = 0;

      for (const s of spins) {
        if (s.outcome === 'BOTH-WIN') { wins++; bothWins++; }
        else if (s.outcome === 'PART-WIN') { wins++; partWins++; }
        else if (s.outcome === 'MISS') { losses++; }
        else if (s.outcome === 'ZERO') { losses++; zeros++; }
        maxLadder = Math.max(maxLadder, s.ladder);
        if (s.outcome !== 'WARMUP' && s.outcome !== 'OBSERVE') {
          runningPnl += s.pnl;
          pnlCurve.push(runningPnl);
        }
      }

      // Rebuild sessionState by replaying spins
      let sessionState = createInitialSessionState(state.settings);
      for (const s of spins) {
        const { newState } = processFullSpin(s.num, sessionState, state.settings);
        sessionState = newState;
      }

      // Recalculate peak and drawdown
      let peak = state.settings.bankroll;
      let maxDrawdown = 0;
      for (const s of spins) {
        if (s.bankroll > peak) peak = s.bankroll;
        const dd = peak - s.bankroll;
        if (dd > maxDrawdown) maxDrawdown = dd;
      }

      // Rebuild switch log
      const switchLog = state.currentSession.switchLog.filter(
        sw => sw.spinIndex <= spins.length
      );

      return {
        ...state,
        currentSession: {
          ...state.currentSession,
          spins,
          wins,
          losses,
          bothWins,
          partWins,
          zeros,
          maxLadder,
          maxDrawdown,
          peak,
          pnlCurve,
          switchLog,
        },
        sessionState,
      };
    }

    case 'MARK_BET_STATUS': {
      if (!state.currentSession || state.currentSession.spins.length === 0) {
        return state;
      }

      const spins = [...state.currentSession.spins];
      const lastIndex = spins.length - 1;
      spins[lastIndex] = { ...spins[lastIndex], betStatus: action.status };

      return {
        ...state,
        currentSession: { ...state.currentSession, spins },
      };
    }

    default:
      return state;
  }
}

// ── CONTEXT ──────────────────────────────────────────────────
const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, loadState);

  // Auto-save on state change
  useEffect(() => {
    saveState(state);
  }, [state]);

  return (
    <StoreContext.Provider value={{ state, dispatch }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within StoreProvider');
  }
  return context;
}

// ── SELECTORS ────────────────────────────────────────────────
export function getInstruction(state) {
  if (!state.sessionState) return null;
  return getNextInstruction(state.sessionState, state.settings);
}

export function getActiveSpins(session) {
  if (!session) return [];
  return session.spins.filter(s => s.outcome !== 'WARMUP' && s.outcome !== 'OBSERVE');
}

export function getNetPnl(session) {
  if (!session) return 0;
  return session.spins.reduce((a, s) => a + s.pnl, 0);
}

export function getRoi(session) {
  if (!session || !session.settings?.bankroll) return 0;
  return (getNetPnl(session) / session.settings.bankroll) * 100;
}

export function getWinRate(session) {
  if (!session) return 0;
  const total = (session.wins || 0) + (session.losses || 0);
  return total > 0 ? ((session.wins || 0) / total) * 100 : 0;
}
