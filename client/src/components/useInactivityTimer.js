import { useState, useEffect, useRef, useCallback } from 'react';

export const useInactivityTimer = ({
  idleTimeoutMs = 90000,
  warningDurationSec = 30,
  onResetSession
} = {}) => {
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(warningDurationSec);

  const idleTimerRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const showWarningRef = useRef(false);
  const onResetRef = useRef(onResetSession);

  // Keep references current
  useEffect(() => {
    showWarningRef.current = showWarning;
  }, [showWarning]);

  useEffect(() => {
    onResetRef.current = onResetSession;
  }, [onResetSession]);

  // Restart idle timer
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    setShowWarning(false);
    showWarningRef.current = false;
    setCountdown(warningDurationSec);

    idleTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      showWarningRef.current = true;
    }, idleTimeoutMs);
  }, [idleTimeoutMs, warningDurationSec]);

  // Handle warning countdown
  useEffect(() => {
    if (showWarning) {
      setCountdown(warningDurationSec);

      countdownIntervalRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownIntervalRef.current);
            setShowWarning(false);
            showWarningRef.current = false;
            if (onResetRef.current) onResetRef.current();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [showWarning, warningDurationSec]);

  // Setup user activity listeners
  useEffect(() => {
    const handleUserActivity = () => {
      if (!showWarningRef.current) {
        resetIdleTimer();
      }
    };

    const events = ['pointerdown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((event) => window.addEventListener(event, handleUserActivity, true));

    resetIdleTimer();

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      events.forEach((event) => window.removeEventListener(event, handleUserActivity, true));
    };
  }, [resetIdleTimer]);

  return {
    showWarning,
    countdown,
    keepExploring: resetIdleTimer
  };
};

export default useInactivityTimer;