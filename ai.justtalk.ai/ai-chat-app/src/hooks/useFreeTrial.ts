import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSession } from './useSession';
import { useSubscription } from './useSubscription';

// Free trial limits
export const FREE_TRIAL_VOICE_SECONDS_LIMIT = 300; // 5 minutes

// Categories locked during free trial
export const LOCKED_CATEGORIES = ['Business', 'Interview', 'Education', 'Travel'];
export const UNLOCKED_CATEGORIES = ['Daily Life', 'Social', 'Dating'];

export interface FreeTrialState {
  isFreeTrial: boolean;           // true if no active subscription
  isEmailConfirmed: boolean;      // true if email_confirmed_at is set
  voiceSecondsUsed: number;       // from justai_voice_sessions.total_duration_seconds
  voiceSecondsLimit: number;      // 300 (5 minutes)
  voiceSecondsRemaining: number;  // limit - used
  canStartVoiceSession: boolean;  // remaining > 0
  canAccessPronunciationPractice: boolean; // false for free trial
  lockedCategories: string[];     // categories locked for free trial
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Hook to manage free trial state and access control
 * 
 * Free trial users get:
 * - 5 minutes total voice conversation time (cumulative)
 * - Access to Daily Life and Social role-play categories only
 * - Pronunciation baseline assessment only (no phoneme practice)
 * - Unlimited text chat and vocabulary builder
 */
export function useFreeTrial(): FreeTrialState {
  const { user } = useSession();
  const { hasActiveSubscription } = useSubscription();

  // Fetch free trial usage from justai_voice_sessions table
  const { data: freeTrialData, isLoading, error, refetch } = useQuery({
    queryKey: ['freeTrial', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // Get total voice duration from justai_voice_sessions
      const { data, error } = await supabase
        .from('justai_voice_sessions')
        .select('total_duration_seconds')
        .eq('student_id', user.id);

      if (error) {
        console.error('Failed to fetch free trial data:', error);
        return null;
      }

      // Sum up all session durations
      const totalSeconds = data?.reduce((sum, session) => sum + (session.total_duration_seconds || 0), 0) || 0;

      return {
        voiceSecondsUsed: totalSeconds,
      };
    },
    enabled: !!user?.id && !hasActiveSubscription,
    staleTime: 30000, // Consider fresh for 30 seconds
  });

  // Check if email is confirmed
  const isEmailConfirmed = user?.email_confirmed_at != null;

  // Calculate derived state
  const isFreeTrial = !hasActiveSubscription;
  const voiceSecondsUsed = freeTrialData?.voiceSecondsUsed || 0;
  const voiceSecondsRemaining = Math.max(0, FREE_TRIAL_VOICE_SECONDS_LIMIT - voiceSecondsUsed);
  const canStartVoiceSession = isFreeTrial ? voiceSecondsRemaining > 0 : true;
  const canAccessPronunciationPractice = hasActiveSubscription;

  return {
    isFreeTrial,
    isEmailConfirmed,
    voiceSecondsUsed,
    voiceSecondsLimit: FREE_TRIAL_VOICE_SECONDS_LIMIT,
    voiceSecondsRemaining,
    canStartVoiceSession,
    canAccessPronunciationPractice,
    lockedCategories: isFreeTrial ? LOCKED_CATEGORIES : [],
    isLoading,
    error: error as Error | null,
    refetch,
  };
}
