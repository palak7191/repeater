import { useState } from 'react';
import { useStore } from '../store.jsx';
import { getSessionStats, getCrossSessionStats, getTableRanking } from '../analytics.js';
import Sparkline from '../components/Sparkline.jsx';
import './Analytics.css';

export default function Analytics({ onBack, onViewSession }) {
  const { state, dispatch } = useStore();
  const { sessions } = state;
  const [tab, setTab] = useState('sessions');

  function handleDelete(id) {
    if (window.confirm('Delete this session?')) {
      dispatch({ type: 'DELETE_SESSION', id });
    }
  }

  const crossStats = sessions.length > 0 ? getCrossSessionStats(sessions) : null;
  const tableRanking = sessions.length > 0 ? getTableRanking(sessions) : [];

  return (
    <div className="ana">
      {/* Header */}
      <div className="ana__header">
        <button className="ana__back" onClick={onBack}>Back</button>
        <div className="ana__title">ANALYTICS</div>
        <div style={{ width: 60 }} />
      </div>

      {/* Tabs */}
      <div className="ana__tabs">
        <button
          className={`ana__tab ${tab === 'sessions' ? 'ana__tab--active' : ''}`}
          onClick={() => setTab('sessions')}
        >
          Sessions
        </button>
        <button
          className={`ana__tab ${tab === 'cross' ? 'ana__tab--active' : ''}`}
          onClick={() => setTab('cross')}
        >
          Cross-Table
        </button>
      </div>

      <div className="ana__body">
        {sessions.length === 0 && (
          <div className="ana__empty">
            <div className="ana__empty-icon">◆</div>
            <div className="ana__empty-msg">No sessions recorded yet.</div>
            <button className="ana__btn" onClick={onBack}>
              Start a session
            </button>
          </div>
        )}

        {/* Sessions tab */}
        {tab === 'sessions' && sessions.length > 0 && (
          <div className="ana__sessions">
            {[...sessions].reverse().map(s => {
              const stats = getSessionStats(s);
              const date = new Date(s.startedAt).toLocaleDateString();
              const time = new Date(s.startedAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div key={s.id} className="ana__session-card">
                  <div className="ana__session-top">
                    <div className="ana__session-meta">
                      {s.tableName && (
                        <span className="ana__session-table">{s.tableName}</span>
                      )}
                      <span className="ana__session-date mono">{date} {time}</span>
                      <span className="ana__session-spins dimmed">
                        {stats.activeSpins} active spins
                      </span>
                    </div>
                    <div className={`ana__session-pnl mono ${stats.net >= 0 ? 'positive' : 'negative'}`}>
                      {stats.net >= 0 ? '+' : ''}${stats.net.toLocaleString()}
                    </div>
                  </div>

                  <div className="ana__session-stats">
                    <span className="ana__session-stat">
                      <span className="dimmed">ROI</span>
                      <span className={`mono ${stats.roi >= 0 ? 'positive' : 'negative'}`}>
                        {stats.roi >= 0 ? '+' : ''}{stats.roi.toFixed(1)}%
                      </span>
                    </span>
                    <span className="ana__session-stat">
                      <span className="dimmed">W%</span>
                      <span className="mono">{stats.winRate.toFixed(0)}%</span>
                    </span>
                    <span className="ana__session-stat">
                      <span className="dimmed">W/L</span>
                      <span className="mono">{s.wins}/{s.losses}</span>
                    </span>
                    <span className="ana__session-stat">
                      <span className="dimmed">MaxDD</span>
                      <span className="mono negative">${s.maxDrawdown?.toLocaleString() || 0}</span>
                    </span>
                  </div>

                  <div className="ana__session-actions">
                    <button className="ana__view-btn" onClick={() => onViewSession(s.id)}>
                      View
                    </button>
                    <button className="ana__del-btn" onClick={() => handleDelete(s.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Cross-table analysis tab */}
        {tab === 'cross' && crossStats && (
          <div className="ana__cross">
            {/* Aggregate stats */}
            <div className="ana__section-title">AGGREGATE</div>
            <div className="ana__agg-grid">
              <div className="ana__agg-card">
                <span className="ana__agg-label">Sessions</span>
                <span className="ana__agg-value mono">{crossStats.totalSessions}</span>
              </div>
              <div className="ana__agg-card">
                <span className="ana__agg-label">Profitable</span>
                <span className={`ana__agg-value mono ${crossStats.profitable === crossStats.totalSessions ? 'positive' : ''}`}>
                  {crossStats.profitable}/{crossStats.totalSessions}
                </span>
              </div>
              <div className="ana__agg-card">
                <span className="ana__agg-label">Total P&L</span>
                <span className={`ana__agg-value mono ${crossStats.totalNet >= 0 ? 'positive' : 'negative'}`}>
                  {crossStats.totalNet >= 0 ? '+' : ''}${Math.abs(crossStats.totalNet).toLocaleString()}
                </span>
              </div>
              <div className="ana__agg-card">
                <span className="ana__agg-label">Avg P&L</span>
                <span className={`ana__agg-value mono ${crossStats.avgNet >= 0 ? 'positive' : 'negative'}`}>
                  {crossStats.avgNet >= 0 ? '+' : ''}${Math.abs(crossStats.avgNet).toFixed(0)}
                </span>
              </div>
              <div className="ana__agg-card">
                <span className="ana__agg-label">Avg ROI</span>
                <span className={`ana__agg-value mono ${crossStats.avgRoi >= 0 ? 'positive' : 'negative'}`}>
                  {crossStats.avgRoi >= 0 ? '+' : ''}{crossStats.avgRoi.toFixed(1)}%
                </span>
              </div>
              <div className="ana__agg-card">
                <span className="ana__agg-label">Overall W%</span>
                <span className="ana__agg-value mono">
                  {crossStats.overallWinRate.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* P&L trend */}
            {crossStats.pnlTrend.length > 1 && (
              <>
                <div className="ana__section-title">P&L TREND</div>
                <div className="ana__chart-card">
                  <Sparkline values={crossStats.pnlTrend} height={100} />
                </div>
              </>
            )}

            {/* Table ranking */}
            {tableRanking.length > 0 && (
              <>
                <div className="ana__section-title">TABLE RANKING</div>
                <div className="ana__table-ranking">
                  {tableRanking.map((t, i) => (
                    <div key={t.name} className="ana__table-row">
                      <span className="ana__table-rank">#{i + 1}</span>
                      <span className="ana__table-name">{t.name}</span>
                      <span className="ana__table-sessions dimmed">{t.sessions} sessions</span>
                      <span className={`ana__table-pnl mono ${t.totalPnl >= 0 ? 'positive' : 'negative'}`}>
                        {t.totalPnl >= 0 ? '+' : ''}${t.totalPnl.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Window effectiveness */}
            <div className="ana__section-title">WINDOW EFFECTIVENESS</div>
            <div className="ana__window-compare">
              <div className="ana__window-card">
                <span className="ana__window-label">W=2 Total</span>
                <span className={`ana__window-value mono ${crossStats.totalW2Pnl >= 0 ? 'positive' : 'negative'}`}>
                  {crossStats.totalW2Pnl >= 0 ? '+' : ''}${crossStats.totalW2Pnl.toLocaleString()}
                </span>
                <span className="ana__window-sub dimmed">{crossStats.totalW2Spins} spins</span>
              </div>
              <div className="ana__window-card">
                <span className="ana__window-label">W=7 Total</span>
                <span className={`ana__window-value mono ${crossStats.totalW7Pnl >= 0 ? 'positive' : 'negative'}`}>
                  {crossStats.totalW7Pnl >= 0 ? '+' : ''}${crossStats.totalW7Pnl.toLocaleString()}
                </span>
                <span className="ana__window-sub dimmed">{crossStats.totalW7Spins} spins</span>
              </div>
            </div>

            {/* Switch stats */}
            <div className="ana__section-title">SWITCH STATS</div>
            <div className="ana__switch-stats">
              <div className="ana__switch-stat">
                <span className="dimmed">Total switches</span>
                <span className="mono">{crossStats.switchCount}</span>
              </div>
              <div className="ana__switch-stat">
                <span className="dimmed">W2 → W7</span>
                <span className="mono">{crossStats.w2ToW7Count}</span>
              </div>
              <div className="ana__switch-stat">
                <span className="dimmed">W7 → W2</span>
                <span className="mono">{crossStats.w7ToW2Count}</span>
              </div>
            </div>

            {/* Ratchet effectiveness */}
            {crossStats.totalRatchetSpins > 0 && (
              <>
                <div className="ana__section-title">RATCHET EFFECTIVENESS</div>
                <div className="ana__ratchet-stats">
                  <div className="ana__ratchet-stat">
                    <span className="dimmed">Ratcheted spins</span>
                    <span className="mono">{crossStats.totalRatchetSpins}</span>
                  </div>
                  <div className="ana__ratchet-stat">
                    <span className="dimmed">Ratchet P&L</span>
                    <span className={`mono ${crossStats.totalRatchetPnl >= 0 ? 'positive' : 'negative'}`}>
                      {crossStats.totalRatchetPnl >= 0 ? '+' : ''}${crossStats.totalRatchetPnl.toLocaleString()}
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* Miss streak profile */}
            {Object.keys(crossStats.allStreaks).length > 0 && (
              <>
                <div className="ana__section-title">MISS STREAK PROFILE</div>
                <div className="ana__streak-chart">
                  {Object.entries(crossStats.allStreaks)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([len, count]) => (
                      <div key={len} className="ana__streak-bar">
                        <span className="ana__streak-label">{len}</span>
                        <div
                          className="ana__streak-fill"
                          style={{ width: `${Math.min(count * 10, 100)}%` }}
                        />
                        <span className="ana__streak-count">{count}x</span>
                      </div>
                    ))}
                </div>
              </>
            )}

            {/* Best/Worst */}
            <div className="ana__section-title">HIGHLIGHTS</div>
            <div className="ana__highlights">
              {crossStats.bestSession && (
                <div
                  className="ana__highlight ana__highlight--best"
                  onClick={() => onViewSession(crossStats.bestSession.id)}
                >
                  <span className="ana__hl-label">BEST</span>
                  <span className="ana__hl-table">{crossStats.bestSession.tableName || 'Unknown'}</span>
                  <span className="ana__hl-date">
                    {new Date(crossStats.bestSession.startedAt).toLocaleDateString()}
                  </span>
                  <span className="ana__hl-val mono positive">
                    +${getSessionStats(crossStats.bestSession).net.toLocaleString()}
                  </span>
                </div>
              )}
              {crossStats.worstSession && crossStats.worstSession.id !== crossStats.bestSession?.id && (
                <div
                  className="ana__highlight ana__highlight--worst"
                  onClick={() => onViewSession(crossStats.worstSession.id)}
                >
                  <span className="ana__hl-label">WORST</span>
                  <span className="ana__hl-table">{crossStats.worstSession.tableName || 'Unknown'}</span>
                  <span className="ana__hl-date">
                    {new Date(crossStats.worstSession.startedAt).toLocaleDateString()}
                  </span>
                  <span className={`ana__hl-val mono ${getSessionStats(crossStats.worstSession).net >= 0 ? 'positive' : 'negative'}`}>
                    {getSessionStats(crossStats.worstSession).net >= 0 ? '+' : ''}
                    ${Math.abs(getSessionStats(crossStats.worstSession).net).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
