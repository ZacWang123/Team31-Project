import React, { useState, useCallback } from 'react';
import WorldMap from './components/WorldMap';
import WelcomeModal from './components/WelcomeModal';
import TimeoutWarningModal from './components/TimeoutWarningModal';
import { useInactivityTimer } from './components/useInactivityTimer';
import { useTravelProfile } from './context/TravelProfileContext';

function App() {
  const { resetProfile } = useTravelProfile() || {};
  const [showWelcome, setShowWelcome] = useState(true);
  const [sessionKey, setSessionKey] = useState(0);

  const handleResetSession = useCallback(() => {
    localStorage.clear();
    sessionStorage.clear();

    if (resetProfile) resetProfile();

    setSessionKey((prevKey) => prevKey + 1);

    setShowWelcome(true);

    console.log('[App] Session reset completed & Welcome modal restored.');
  }, [resetProfile]);

  const { showWarning, countdown, keepExploring } = useInactivityTimer({
    idleTimeoutMs: 90000, 
    warningDurationSec: 30,  
    onResetSession: handleResetSession
  });

  return (
    <main style={{ margin: 0, padding: 0, width: '100vw', height: '100vh', position: 'relative' }}>
      {showWelcome && <WelcomeModal onClose={() => setShowWelcome(false)} />}

      {showWarning && (
        <TimeoutWarningModal countdown={countdown} onKeepExploring={keepExploring} />
      )}

      <WorldMap key={sessionKey} />
    </main>
  );
}

export default App;