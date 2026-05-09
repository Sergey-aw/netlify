import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSession } from './useSession';

export interface Subscription {
  id: string;
  student_id: string;
  subscription_type: 'basic' | 'plus' | 'premium';
  status: 'active' | 'past_due' | 'canceled' | 'expired';
  voice_minutes_limit: number | null;
  price_cents: number;
  currency: string;
  billing_period: 'weekly' | 'monthly' | 'annual';
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
  trial_days?: number | null;
  trial_variant?: string | null;
  // Computed fields - not from database
  voice_seconds_used?: number;
}

export interface SubscriptionAccess {
  hasActiveSubscription: boolean;
  subscription: Subscription | null;
  canSendMessage: boolean;
  // Time-based limits
  voiceMinutesLimit: number | null;
  voiceSecondsUsed: number;
  voiceSecondsRemaining: number | null;
  canStartVoiceSession: boolean;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Hook to check user's subscription status and message/time limits
 * Uses database functions to calculate real-time usage
 */
export function useSubscription(): SubscriptionAccess {
  const { user } = useSession();

  const { data: subscriptionData, isLoading, error, refetch } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('justai_subscriptions')
        .select('id, student_id, subscription_type, status, voice_minutes_limit, price_cents, currency, billing_period, current_period_start, current_period_end, cancel_at_period_end, stripe_subscription_id, stripe_customer_id, created_at, updated_at, trial_variant')
        .eq('student_id', user.id)
        .eq('status', 'active')
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned - user has no active subscription
          return null;
        }
        throw error;
      }

      // Get real-time voice duration used
      const { data: voiceDuration, error: voiceError } = await supabase.rpc(
        'get_voice_duration_used_in_period',
        {
          p_student_id: user.id,
          p_period_start: data.current_period_start,
          p_period_end: data.current_period_end,
        }
      );

      if (voiceError) {
        console.error('Failed to get voice duration:', voiceError);
      }

      return {
        ...data,
        voice_seconds_used: voiceDuration || 0,
      } as Subscription;
    },
    enabled: !!user?.id,
    staleTime: 30000, // Consider fresh for 30 seconds
    refetchInterval: 60000, // Refetch every minute to keep usage current
  });

  const subscription = subscriptionData ?? null;
  const hasActiveSubscription = !!subscription && subscription.status === 'active';

  // Voice-based limits
  const voiceMinutesLimit = subscription?.voice_minutes_limit ?? null;
  const voiceSecondsUsed = subscription?.voice_seconds_used ?? 0;
  const voiceLimitSeconds = voiceMinutesLimit ? voiceMinutesLimit * 60 : null;
  const voiceSecondsRemaining = voiceLimitSeconds !== null 
    ? Math.max(0, voiceLimitSeconds - voiceSecondsUsed)
    : null;
  const canStartVoiceSession = hasActiveSubscription && (
    voiceSecondsRemaining === null || // Unlimited
    voiceSecondsRemaining > 0 // Has time left
  );

  // canSendMessage is based on voice session availability (voice is the primary interaction)
  const canSendMessage = canStartVoiceSession;

  return {
    hasActiveSubscription,
    subscription,
    canSendMessage,
    voiceMinutesLimit,
    voiceSecondsUsed,
    voiceSecondsRemaining,
    canStartVoiceSession,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}
