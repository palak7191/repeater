// ── ANALYTICS ENGINE ─────────────────────────────────────────────
// In-app analysis. Analyses all stored sessions.

// ── PER-SESSION STATS ────────────────────────────────────────
export function getSessionStats(session) {
  const active = session.spins.filter(s =>
    s.outcome !== 'WARMUP' && s.outcome !== 'OBSERVE'
  );
  const net = session.spins.reduce((a, s) => a + s.pnl, 0);
  const total = (session.wins || 0) + (session.losses || 0);

  // Miss streak distribution
  let curStreak = 0;
  const streaks = [];
  for (const s of active) {
    if (s.outcome === 'MISS' || s.outcome === 'ZERO') {
      curStreak++;
    } else {
      if (curStreak > 0) streaks.push(curStreak);
      curStreak = 0;
    }
  }
  if (curStreak > 0) streaks.push(curStreak);

  // Win runs
  let curRun = 0;
  const winRuns = [];
  for (const s of active) {
    if (s.outcome === 'BOTH-WIN' || s.outcome === 'PART-WIN') {
      curRun++;
    } else {
      if (curRun > 0) winRuns.push(curRun);
      curRun = 0;
    }
  }
  if (curRun > 0) winRuns.push(curRun);

  // Window performance (how did W=2 do vs W=7 periods)
  const w2spins = active.filter(s => s.window === 2);
  const w7spins = active.filter(s => s.window === 7);
  const w2pnl = w2spins.reduce((a, s) => a + s.pnl, 0);
  const w7pnl = w7spins.reduce((a, s) => a + s.pnl, 0);

  // Ratchet performance
  const ratchetSpins = active.filter(s => s.ratchetLevel > 0);
  const ratchetPnl = ratchetSpins.reduce((a, s) => a + s.pnl, 0);

  return {
    net,
    roi: session.settings?.bankroll ? (net / session.settings.bankroll) * 100 : 0,
    totalSpins: session.spins.length,
    activeSpins: active.length,
    winRate: total > 0 ? ((session.wins || 0) / total) * 100 : 0,
    bothWinRate: active.length > 0 ? ((session.bothWins || 0) / active.length) * 100 : 0,
    maxLadder: session.maxLadder || 0,
    maxDrawdown: session.maxDrawdown || 0,
    streakDist: Object.fromEntries(
      [...new Set(streaks)].sort((a, b) => a - b).map(k => [k, streaks.filter(s => s === k).length])
    ),
    maxStreak: streaks.length > 0 ? Math.max(...streaks) : 0,
    avgWinRun: winRuns.length > 0 ? winRuns.reduce((a, b) => a + b, 0) / winRuns.length : 0,
    maxWinRun: winRuns.length > 0 ? Math.max(...winRuns) : 0,
    switchCount: (session.switchLog || []).length,
    w2pnl,
    w7pnl,
    w2spins: w2spins.length,
    w7spins: w7spins.length,
    ratchetPnl,
    ratchetSpins: ratchetSpins.length,
  };
}

// ── CROSS-SESSION ANALYTICS ───────────────────────────────────
export function getCrossSessionStats(sessions) {
  if (!sessions.length) return null;

  const stats = sessions.map(getSessionStats);
  const total = stats.reduce((a, s) => a + s.net, 0);
  const profitable = stats.filter(s => s.net > 0).length;

  // Per-table performance
  const byTable = {};
  for (const s of sessions) {
    const key = s.tableName || 'Unknown';
    if (!byTable[key]) byTable[key] = [];
    byTable[key].push(s);
  }

  // Per-table stats
  const tableStats = {};
  for (const [table, tableSessions] of Object.entries(byTable)) {
    const tStats = tableSessions.map(getSessionStats);
    tableStats[table] = {
      sessions: tableSessions.length,
      avgPnl: tStats.reduce((a, s) => a + s.net, 0) / tStats.length,
      totalPnl: tStats.reduce((a, s) => a + s.net, 0),
      winRate: tStats.reduce((a, s) => a + s.winRate, 0) / tStats.length,
      best: Math.max(...tStats.map(s => s.net)),
      worst: Math.min(...tStats.map(s => s.net)),
    };
  }

  // Window switch effectiveness
  const allSwitchLogs = sessions.flatMap(s => s.switchLog || []);
  const w2ToW7 = allSwitchLogs.filter(sw => sw.to === 7);
  const w7ToW2 = allSwitchLogs.filter(sw => sw.to === 2);

  // Ratchet effectiveness
  const totalRatchetPnl = stats.reduce((a, s) => a + s.ratchetPnl, 0);
  const totalRatchetSpins = stats.reduce((a, s) => a + s.ratchetSpins, 0);

  // Miss streak profile across all sessions
  const allStreaks = {};
  for (const s of stats) {
    for (const [k, v] of Object.entries(s.streakDist)) {
      allStreaks[k] = (allStreaks[k] || 0) + v;
    }
  }

  // P&L trend across sessions
  const pnlTrend = stats.map(s => s.net);
  const movingAvg = pnlTrend.map((_, i) => {
    const windowData = pnlTrend.slice(Math.max(0, i - 2), i + 1);
    return windowData.reduce((a, b) => a + b, 0) / windowData.length;
  });

  // Best and worst sessions
  const bestIdx = stats.reduce((best, s, i) => (s.net > stats[best].net ? i : best), 0);
  const worstIdx = stats.reduce((worst, s, i) => (s.net < stats[worst].net ? i : worst), 0);

  return {
    totalSessions: sessions.length,
    profitable,
    totalNet: total,
    avgNet: total / sessions.length,
    avgRoi: stats.reduce((a, s) => a + s.roi, 0) / sessions.length,
    overallWinRate: stats.reduce((a, s) => a + s.winRate, 0) / sessions.length,
    byTable,
    tableStats,
    switchCount: allSwitchLogs.length,
    w2ToW7Count: w2ToW7.length,
    w7ToW2Count: w7ToW2.length,
    totalRatchetPnl,
    totalRatchetSpins,
    allStreaks,
    pnlTrend,
    movingAvg,
    bestSession: sessions[bestIdx],
    worstSession: sessions[worstIdx],
    // Window totals
    totalW2Pnl: stats.reduce((a, s) => a + s.w2pnl, 0),
    totalW7Pnl: stats.reduce((a, s) => a + s.w7pnl, 0),
    totalW2Spins: stats.reduce((a, s) => a + s.w2spins, 0),
    totalW7Spins: stats.reduce((a, s) => a + s.w7spins, 0),
  };
}

// ── TABLE RANKING ────────────────────────────────────────────
export function getTableRanking(sessions) {
  const byTable = {};
  for (const s of sessions) {
    const key = s.tableName || 'Unknown';
    if (!byTable[key]) byTable[key] = { sessions: [], totalPnl: 0 };
    const stats = getSessionStats(s);
    byTable[key].sessions.push(s);
    byTable[key].totalPnl += stats.net;
  }

  return Object.entries(byTable)
    .map(([name, data]) => ({
      name,
      sessions: data.sessions.length,
      totalPnl: data.totalPnl,
      avgPnl: data.totalPnl / data.sessions.length,
    }))
    .sort((a, b) => b.totalPnl - a.totalPnl);
}
