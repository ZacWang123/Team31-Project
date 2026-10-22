import { useState, useEffect, useRef, useCallback } from 'react';

// This custom hook manages an inactivity timer that tracks user activity and triggers a warning modal after a specified idle timeout. It provides a countdown for the warning duration and allows the user to reset the session by interacting with the page.
export const useInactivityTimer = ({
  idleTimeoutMs = 90000,
  warningDurationSec = 30,
  onResetSession,
  enabled = true
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
    if (!enabled) return; 

    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    setShowWarning(false);
    showWarningRef.current = false;
    setCountdown(warningDurationSec);

    idleTimerRef.current = setTimeout(() => {
      if (enabled) {
        setShowWarning(true);
        showWarningRef.current = true;
      }
    }, idleTimeoutMs);
  }, [idleTimeoutMs, warningDurationSec, enabled]);

  // Handle warning countdown
  useEffect(() => {
    if (!enabled) {
      // Clean up warning state immediately if disabled
      setShowWarning(false);
      showWarningRef.current = false;
      setCountdown(warningDurationSec);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      return;
    }

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
  }, [showWarning, warningDurationSec, enabled]);

  // Setup user activity listeners
  useEffect(() => {
    if (!enabled) {
      // Clear idle timer and don't listen to events if disabled
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      setShowWarning(false);
      showWarningRef.current = false;
      return;
    }

    const handleUserActivity = () => {
      if (!showWarningRef.current && enabled) {
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
  }, [resetIdleTimer, enabled]);

  return {
    showWarning,
    countdown,
    keepExploring: resetIdleTimer
  };
};

export default useInactivityTimer;