import { useStore, getActiveSpins, getNetPnl, getRoi, getWinRate } from '../store.jsx';
import { getSessionStats } from '../analytics.js';
import { DOZ_LABEL, COL_LABEL } from '../strategy.js';
import Sparkline from '../components/Sparkline.jsx';
import './Summary.css';

function StatRow({ label, value, sub, valueClass }) {
  return (
    <div className="sum__stat-row">
      <span className="sum__stat-label">{label}</span>
      <div className="sum__stat-right">
        <span className={`sum__stat-value mono ${valueClass || ''}`}>{value}</span>
        {sub && <span className="sum__stat-sub">{sub}</span>}
      </div>
    </div>
  );
}

export default function Summary({ onBack, onNewSession, sessionId }) {
  const { state, dispatch } = useStore();

  // Get session - either by ID or the most recent one
  const session = sessionId
    ? state.sessions.find(s => s.id === sessionId)
    : state.sessions[state.sessions.length - 1];

  if (!session) {
    return (
      <div className="sum sum--empty">
        <div className="sum__empty-msg">No session data yet.</div>
        <button className="sum__btn-primary" onClick={onBack}>
          Back
        </button>
      </div>
    );
  }

  const stats = getSessionStats(session);
  const active = getActiveSpins(session);
  const pnl = stats.net;
  const roi = stats.roi;

  // Export session as JSON
  function handleExport() {
    const blob = new Blob([JSON.stringify(session, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `repeater-session-${session.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleNewSession() {
    dispatch({ type: 'START_SESSION' });
    onNewSession();
  }

  const date = new Date(session.startedAt).toLocaleString();

  return (
    <div className="sum">
      {/* Header */}
      <div className="sum__header">
        <button className="sum__back" onClick={onBack}>Back</button>
        <div className="sum__header-title">SESSION SUMMARY</div>
        <button className="sum__export" onClick={handleExport}>Export</button>
      </div>

      <div className="sum__body">
        {/* Meta */}
        <div className="sum__meta">
          <span className="sum__meta-date dimmed">{date}</span>
          {session.tableName && (
            <span className="sum__meta-table mono gold">{session.tableName}</span>
          )}
          <span className="sum__meta-settings dimmed mono">
            W={session.settings.startWindow} Base=${session.settings.baseBet}
          </span>
        </div>

        {/* P&L hero */}
        <div className={`sum__hero ${pnl >= 0 ? 'sum__hero--positive' : 'sum__hero--negative'}`}>
          <div className="sum__hero-label">NET P&L</div>
          <div className="sum__hero-value mono">
            {pnl >= 0 ? '+' : ''}${Math.abs(pnl).toLocaleString()}
          </div>
          <div className="sum__hero-roi mono">
            {roi >= 0 ? '+' : ''}{roi.toFixed(1)}% ROI
          </div>
        </div>

        {/* Sparkline */}
        {session.pnlCurve && session.pnlCurve.length > 1 && (
          <div className="sum__sparkline">
            <Sparkline values={session.pnlCurve} height={80} />
          </div>
        )}

        {/* Performance stats */}
        <div className="sum__section">
          <div className="sum__section-title">PERFORMANCE</div>
          <div className="sum__stats-card">
            <StatRow
              label="Total spins"
              value={session.spins.length}
              sub={`${stats.activeSpins} active`}
            />
            <StatRow
              label="Starting bankroll"
              value={'$' + session.settings.bankroll.toLocaleString()}
            />
            <StatRow
              label="Ending bankroll"
              value={'$' + (session.settings.bankroll + pnl).toLocaleString()}
              valueClass={pnl >= 0 ? 'positive' : 'negative'}
            />
            <StatRow
              label="Peak P&L"
              value={'+$' + (session.peak - session.settings.bankroll).toLocaleString()}
              valueClass="positive"
            />
            <StatRow
              label="Max drawdown"
              value={'$' + session.maxDrawdown.toLocaleString()}
              valueClass={session.maxDrawdown > 0 ? 'negative' : ''}
            />
            <StatRow
              label="Max ladder reached"
              value={stats.maxLadder}
            />
          </div>
        </div>

        {/* Outcomes */}
        <div className="sum__section">
          <div className="sum__section-title">OUTCOMES</div>
          <div className="sum__stats-card">
            <StatRow
              label="Win rate"
              value={stats.winRate.toFixed(1) + '%'}
              valueClass={stats.winRate >= 80 ? 'positive' : stats.winRate >= 60 ? '' : 'negative'}
            />
            <StatRow
              label="Both-win"
              value={session.bothWins}
              sub={stats.bothWinRate.toFixed(1) + '%'}
              valueClass="positive"
            />
            <StatRow
              label="Part-win"
              value={session.partWins}
              valueClass="partial-col"
            />
            <StatRow
              label="Miss"
              value={session.losses - session.zeros}
              valueClass="negative"
            />
            <StatRow
              label="Zero"
              value={session.zeros}
              valueClass="zero-col"
            />
            <StatRow label="Max consec losses" value={stats.maxStreak} />
            <StatRow label="Max win run" value={stats.maxWinRun} />
          </div>
        </div>

        {/* Window breakdown */}
        <div className="sum__section">
          <div className="sum__section-title">WINDOW BREAKDOWN</div>
          <div className="sum__stats-card">
            <StatRow
              label="W=2 spins"
              value={stats.w2spins}
              sub={stats.w2pnl >= 0 ? '+$' + stats.w2pnl : '-$' + Math.abs(stats.w2pnl)}
              valueClass={stats.w2pnl >= 0 ? 'positive' : 'negative'}
            />
            <StatRow
              label="W=7 spins"
              value={stats.w7spins}
              sub={stats.w7pnl >= 0 ? '+$' + stats.w7pnl : '-$' + Math.abs(stats.w7pnl)}
              valueClass={stats.w7pnl >= 0 ? 'positive' : 'negative'}
            />
          </div>
        </div>

        {/* Ratchet performance */}
        {stats.ratchetSpins > 0 && (
          <div className="sum__section">
            <div className="sum__section-title">RATCHET PERFORMANCE</div>
            <div className="sum__stats-card">
              <StatRow
                label="Ratcheted spins"
                value={stats.ratchetSpins}
                sub={stats.ratchetPnl >= 0 ? '+$' + stats.ratchetPnl : '-$' + Math.abs(stats.ratchetPnl)}
                valueClass={stats.ratchetPnl >= 0 ? 'positive' : 'negative'}
              />
            </div>
          </div>
        )}

        {/* Switch log */}
        {session.switchLog && session.switchLog.length > 0 && (
          <div className="sum__section">
            <div className="sum__section-title">SWITCH LOG</div>
            <div className="sum__stats-card">
              {session.switchLog.map((sw, i) => (
                <div key={i} className="sum__switch-row">
                  <span className="sum__switch-spin dimmed mono">Spin {sw.spinIndex}</span>
                  <span className="sum__switch-dir">W={sw.from} → W={sw.to}</span>
                  <span className="sum__switch-reason dimmed">{sw.reason}</span>
                  <span className={`sum__switch-net mono ${sw.netAtSwitch >= 0 ? 'positive' : 'negative'}`}>
                    {sw.netAtSwitch >= 0 ? '+' : ''}${sw.netAtSwitch}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Miss streak distribution */}
        {Object.keys(stats.streakDist).length > 0 && (
          <div className="sum__section">
            <div className="sum__section-title">MISS STREAK DISTRIBUTION</div>
            <div className="sum__streak-chart">
              {Object.entries(stats.streakDist).map(([len, count]) => (
                <div key={len} className="sum__streak-bar">
                  <span className="sum__streak-label">{len}</span>
                  <div className="sum__streak-fill" style={{ width: `${Math.min(count * 20, 100)}%` }} />
                  <span className="sum__streak-count">{count}x</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Spin log */}
        <div className="sum__section">
          <div className="sum__section-title">
            SPIN LOG
            <span className="sum__section-sub">last {Math.min(25, active.length)} of {active.length}</span>
          </div>
          <div className="sum__spin-log">
            <div className="sum__spin-log-header">
              <span>#</span>
              <span>Num</span>
              <span>Bet</span>
              <span>Outcome</span>
              <span>P&L</span>
              <span>BR</span>
            </div>
            {[...active].reverse().slice(0, 25).map((s, i) => (
              <div
                key={i}
                className={`sum__spin-row sum__spin-row--${s.outcome.toLowerCase().replace('-', '')}`}
              >
                <span className="mono dimmed">{active.length - i}</span>
                <span className="mono">[{s.num}]</span>
                <span className="mono dimmed">
                  {s.bD ? DOZ_LABEL[s.bD] + '+' + COL_LABEL[s.bC] : '-'}
                </span>
                <span>
                  {s.outcome === 'BOTH-WIN' && 'BOTH'}
                  {s.outcome === 'PART-WIN' && 'PART'}
                  {s.outcome === 'MISS' && 'MISS'}
                  {s.outcome === 'ZERO' && 'ZERO'}
                </span>
                <span className="mono">
                  {s.pnl > 0 ? '+' : ''}{s.pnl !== 0 ? '$' + s.pnl : '-'}
                </span>
                <span className="mono dimmed">${s.bankroll?.toLocaleString() ?? '-'}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="sum__actions">
          <button className="sum__btn-secondary" onClick={onBack}>
            Back
          </button>
          <button className="sum__btn-primary" onClick={handleNewSession}>
            New Session
          </button>
        </div>
      </div>
    </div>
  );
}
