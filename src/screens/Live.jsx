import { useStore, getInstruction, getNetPnl, getWinRate, getActiveSpins } from '../store.jsx';
import { DOZ_LABEL, COL_LABEL } from '../strategy.js';
import NumberPad from '../components/NumberPad.jsx';
import BetCard from '../components/BetCard.jsx';
import Sparkline from '../components/Sparkline.jsx';
import Toast from '../components/Toast.jsx';
import './Live.css';

export default function Live({ onSummary, onAnalytics, onSettings }) {
  const { state, dispatch } = useStore();
  const { currentSession, sessionState, settings, toasts } = state;

  const instruction = currentSession ? getInstruction(state) : null;
  const hasSession = !!currentSession;

  function handleNumber(num) {
    if (!hasSession) return;
    dispatch({ type: 'RECORD_SPIN', num });
  }

  function handleStartSession() {
    dispatch({ type: 'START_SESSION' });
  }

  function handleEndSession() {
    if (window.confirm('End this session?')) {
      dispatch({ type: 'END_SESSION' });
      onSummary();
    }
  }

  function handleUndo() {
    if (currentSession?.spins.length > 0) {
      dispatch({ type: 'UNDO_SPIN' });
    }
  }

  function handleMissedBet() {
    dispatch({ type: 'MARK_BET_STATUS', status: 'missed' });
  }

  function handlePartialBet() {
    dispatch({ type: 'MARK_BET_STATUS', status: 'partial' });
  }

  function handleDismissToast(id) {
    dispatch({ type: 'DISMISS_TOAST', id });
  }

  // Stats
  const net = currentSession ? getNetPnl(currentSession) : 0;
  const roi = currentSession && settings.bankroll
    ? (net / settings.bankroll) * 100
    : 0;
  const wr = currentSession ? getWinRate(currentSession) : 0;
  const active = currentSession ? getActiveSpins(currentSession) : [];
  const bankroll = sessionState?.bankroll ?? settings.bankroll;

  // Recent spins (last 25)
  const recentSpins = currentSession
    ? [...currentSession.spins].reverse().slice(0, 25)
    : [];

  return (
    <div className="live">
      <Toast toasts={toasts} onDismiss={handleDismissToast} />

      {/* Header */}
      <div className="live__header">
        <button className="live__nav-btn" onClick={onAnalytics}>
          Analytics
        </button>
        <div className="live__title">REPEATER</div>
        <button className="live__nav-btn" onClick={onSettings}>
          Settings
        </button>
      </div>

      {/* Stats bar */}
      <div className="live__stats">
        <div className="live__stat">
          <span className="live__stat-label">BANKROLL</span>
          <span className="live__stat-value mono">${bankroll.toLocaleString()}</span>
        </div>
        <div className="live__stat">
          <span className="live__stat-label">NET</span>
          <span className={`live__stat-value mono ${net >= 0 ? 'positive' : 'negative'}`}>
            {net >= 0 ? '+' : ''}${net.toLocaleString()}
          </span>
        </div>
        <div className="live__stat">
          <span className="live__stat-label">ROI</span>
          <span className={`live__stat-value mono ${roi >= 0 ? 'positive' : 'negative'}`}>
            {roi >= 0 ? '+' : ''}{roi.toFixed(1)}%
          </span>
        </div>
        <div className="live__stat">
          <span className="live__stat-label">WIN%</span>
          <span className="live__stat-value mono">{wr.toFixed(0)}%</span>
        </div>
        <div className="live__stat">
          <span className="live__stat-label">SPINS</span>
          <span className="live__stat-value mono">{active.length}</span>
        </div>
        <div className="live__stat">
          <span className="live__stat-label">W/L</span>
          <span className="live__stat-value mono">
            {currentSession?.wins || 0}/{currentSession?.losses || 0}
          </span>
        </div>
        {sessionState?.ratchetLevel > 0 && (
          <div className="live__stat">
            <span className="live__stat-label">RATCHET</span>
            <span className="live__stat-value mono positive">+{sessionState.ratchetLevel}</span>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="live__main">
        {/* Left panel */}
        <div className="live__left">
          {/* Sparkline */}
          {currentSession?.pnlCurve && currentSession.pnlCurve.length > 1 && (
            <div className="live__sparkline">
              <Sparkline values={currentSession.pnlCurve} height={80} />
            </div>
          )}

          {/* Number pad */}
          <NumberPad
            onNumber={handleNumber}
            betD={instruction?.type === 'BET' ? instruction.bD : null}
            betC={instruction?.type === 'BET' ? instruction.bC : null}
            disabled={!hasSession}
          />

          {/* Session controls */}
          <div className="live__controls">
            {!hasSession ? (
              <button className="live__btn live__btn--start" onClick={handleStartSession}>
                Start Session
              </button>
            ) : (
              <>
                <button
                  className="live__btn live__btn--undo"
                  onClick={handleUndo}
                  disabled={currentSession.spins.length === 0}
                >
                  Undo
                </button>
                <button className="live__btn live__btn--end" onClick={handleEndSession}>
                  End Session
                </button>
              </>
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="live__right">
          {/* Bet card */}
          <BetCard
            instruction={instruction}
            settings={settings}
            onMissedBet={handleMissedBet}
            onPartialBet={handlePartialBet}
          />

          {/* Recent spins */}
          {recentSpins.length > 0 && (
            <div className="live__spins">
              <div className="live__spins-header">
                <span>RECENT SPINS</span>
                <span className="dimmed">last {Math.min(25, recentSpins.length)}</span>
              </div>
              <div className="live__spins-list">
                {recentSpins.map((s, i) => (
                  <div
                    key={i}
                    className={`live__spin live__spin--${s.outcome.toLowerCase().replace('-', '')}`}
                  >
                    <span className="live__spin-num">[{s.num}]</span>
                    <span className="live__spin-bet">
                      {s.bD ? `${DOZ_LABEL[s.bD]}+${COL_LABEL[s.bC]}` : '-'}
                    </span>
                    <span className="live__spin-outcome">
                      {s.outcome === 'BOTH-WIN' && '★'}
                      {s.outcome === 'PART-WIN' && '✓'}
                      {s.outcome === 'MISS' && '✗'}
                      {s.outcome === 'ZERO' && '○'}
                      {s.outcome === 'WARMUP' && '·'}
                      {s.outcome === 'OBSERVE' && '👁'}
                    </span>
                    <span className="live__spin-pnl">
                      {s.pnl !== 0 ? (s.pnl > 0 ? '+' : '') + '$' + s.pnl : '-'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
