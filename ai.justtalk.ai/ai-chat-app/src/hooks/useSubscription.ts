import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSession } from './useSession';

export interface Subscription {
  id: string;
  student_id: string;
  subscription_type: 'basic' | 'plus' | 'premium';
  status: 'active' | 'past_due' | 'canceled' | 'expired';
  monthly_message_limit: number | null;
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
  // Computed field - not from database
  messages_used_this_period?: number;
}

export interface SubscriptionAccess {
  hasActiveSubscription: boolean;
  subscription: Subscription | null;
  canSendMessage: boolean;
  messagesRemaining: number | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to check user's subscription status and message limits
 * Now uses database functions to calculate real-time usage from justai_messages
 */
export function useSubscription(): SubscriptionAccess {
  const { user } = useSession();

  const { data: subscription, isLoading, error } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('justai_subscriptions')
        .select('id, student_id, subscription_type, status, monthly_message_limit, price_cents, currency, billing_period, current_period_start, current_period_end, cancel_at_period_end, stripe_subscription_id, stripe_customer_id, created_at, updated_at')
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

      // Get real-time message count using database function
      const { data: messageCount, error: countError } = await supabase.rpc(
        'get_messages_used_in_period',
        {
          p_student_id: user.id,
          p_period_start: data.current_period_start,
          p_period_end: data.current_period_end,
        }
      );

      if (countError) {
        console.error('Failed to get message count:', countError);
      }

      return {
        ...data,
        messages_used_this_period: messageCount || 0,
      } as Subscription;
    },
    enabled: !!user?.id,
    staleTime: 30000, // Consider fresh for 30 seconds (shorter for real-time updates)
    refetchInterval: 60000, // Refetch every 1 minute to keep usage current
  });

  const hasActiveSubscription = !!subscription && subscription.status === 'active';
  
  const messagesRemaining = subscription?.monthly_message_limit
    ? subscription.monthly_message_limit - (subscription.messages_used_this_period || 0)
    : null;

  const canSendMessage = hasActiveSubscription && (
    messagesRemaining === null || // Unlimited
    messagesRemaining > 0 // Has messages left
  );

  return {
    hasActiveSubscription,
    subscription: subscription ?? null,
    canSendMessage,
    messagesRemaining,
    isLoading,
    error: error as Error | null,
  };
}
