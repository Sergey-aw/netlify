import { useState, useEffect, useCallback, useRef } from 'react';
import { useSubscription } from './useSubscription';
import { useFreeTrial, FREE_TRIAL_VOICE_SECONDS_LIMIT } from './useFreeTrial';

export interface VoiceTimeLimitState {
  isLimited: boolean;
  secondsRemaining: number;
  hasExceededLimit: boolean;
  isFreeTrial: boolean;
  sessionElapsedSeconds: number;
  startTracking: () => void;
  stopTracking: () => void;
}

/**
 * Hook to track and enforce voice time limits
 * 
 * For subscribed users: Uses subscription voice limits
 * For free trial users: Uses 5-minute cumulative limit (tracked via justai_voice_sessions)
 */
export function useVoiceTimeLimit(): VoiceTimeLimitState {
  const { hasActiveSubscription, voiceSecondsRemaining: subSecondsRemaining, voiceSecondsUsed } = useSubscription();
  const { isFreeTrial, voiceSecondsRemaining: freeTrialSecondsRemaining } = useFreeTrial();
  
  const [sessionElapsedSeconds, setSessionElapsedSeconds] = useState(0);
  const [isTracking, setIsTracking] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionStartTimeRef = useRef<number | null>(null);

  // Calculate remaining seconds based on subscription status
  const baseSecondsRemaining = isFreeTrial 
    ? freeTrialSecondsRemaining 
    : (subSecondsRemaining ?? Infinity);
  
  const secondsRemaining = Math.max(0, baseSecondsRemaining - sessionElapsedSeconds);
  const hasExceededLimit = secondsRemaining <= 0;
  const isLimited = isFreeTrial || (subSecondsRemaining !== null);

  // Start tracking voice session time
  const startTracking = useCallback(() => {
    if (isTracking) return;
    
    setIsTracking(true);
    sessionStartTimeRef.current = Date.now();
    setSessionElapsedSeconds(0);
    
    intervalRef.current = setInterval(() => {
      if (sessionStartTimeRef.current) {
        const elapsed = Math.floor((Date.now() - sessionStartTimeRef.current) / 1000);
        setSessionElapsedSeconds(elapsed);
      }
    }, 1000);
  }, [isTracking]);

  // Stop tracking and return session duration
  const stopTracking = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsTracking(false);
    return sessionElapsedSeconds;
  }, [sessionElapsedSeconds]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    isLimited,
    secondsRemaining,
    hasExceededLimit,
    isFreeTrial,
    sessionElapsedSeconds,
    startTracking,
    stopTracking,
  };
}

/**
 * Format seconds to MM:SS display
 */
export function formatTimeRemaining(seconds: number): string {
  if (seconds === Infinity || seconds < 0) {
    return '∞';
  }
  
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
