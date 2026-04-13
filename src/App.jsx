import { useState } from 'react';
import Live from './screens/Live.jsx';
import Summary from './screens/Summary.jsx';
import Analytics from './screens/Analytics.jsx';
import Settings from './screens/Settings.jsx';

export default function App() {
  const [screen, setScreen] = useState('live');
  const [viewSessionId, setViewSessionId] = useState(null);

  function goLive() {
    setScreen('live');
    setViewSessionId(null);
  }

  function goSummary() {
    setScreen('summary');
    setViewSessionId(null);
  }

  function goAnalytics() {
    setScreen('analytics');
  }

  function goSettings() {
    setScreen('settings');
  }

  function handleViewSession(id) {
    setViewSessionId(id);
    setScreen('summary');
  }

  return (
    <>
      {screen === 'live' && (
        <Live
          onSummary={goSummary}
          onAnalytics={goAnalytics}
          onSettings={goSettings}
        />
      )}
      {screen === 'summary' && (
        <Summary
          onBack={goLive}
          onNewSession={goLive}
          sessionId={viewSessionId}
        />
      )}
      {screen === 'analytics' && (
        <Analytics
          onBack={goLive}
          onViewSession={handleViewSession}
        />
      )}
      {screen === 'settings' && (
        <Settings onBack={goLive} />
      )}
    </>
  );
}
