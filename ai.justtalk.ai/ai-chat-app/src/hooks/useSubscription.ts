import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useSession } from './useSession';

export interface Subscription {
  id: string;
  student_id: string;
  subscription_type: 'basic' | 'plus' | 'premium';
  status: 'active' | 'past_due' | 'canceled' | 'expired';
  monthly_message_limit: number | null;
  messages_used_this_period: number;
  price_cents: number;
  currency: string;
  billing_period: 'monthly' | 'annual';
  current_period_start: string;
  current_period_end: string;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
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
 */
export function useSubscription(): SubscriptionAccess {
  const { user } = useSession();

  const { data: subscription, isLoading, error } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('justai_subscriptions')
        .select('*')
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

      return data as Subscription;
    },
    enabled: !!user?.id,
    staleTime: 60000, // Consider fresh for 1 minute
    refetchInterval: 300000, // Refetch every 5 minutes
  });

  const hasActiveSubscription = !!subscription && subscription.status === 'active';
  
  const messagesRemaining = subscription?.monthly_message_limit
    ? subscription.monthly_message_limit - subscription.messages_used_this_period
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
