import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Sparkles, Calendar, CreditCard, TrendingUp, AlertCircle, Check } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useSubscription } from '@/hooks/useSubscription';
import { useSession } from '@/hooks/useSession';
import { markSubscriptionActive } from '@/lib/onboarding-state';
import { supabase } from '@/lib/supabase';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/hooks/use-toast';

interface SubscriptionPlan {
  id: string;
  plan_name: string;
  plan_type: 'basic' | 'premium' | 'unlimited';
  billing_period: 'weekly' | 'monthly' | 'annual';
  monthly_message_limit: number | null;
  price_cents: number;
  stripe_price_id: string;
  features: string[];
  monthly_equivalent_cents?: number;
  discount_percentage?: number;
}

// Helper function to format seconds to human-readable time
const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  return `${minutes}m`;
};

export default function SubscriptionManagement() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { subscription, hasActiveSubscription, voiceSecondsUsed, voiceSecondsRemaining, voiceMinutesLimit } = useSubscription();
  const { getAccessToken } = useSession();
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [prorationPreview, setProrationPreview] = useState<{
    immediate_charge_cents: number;
    immediate_charge_usd: string;
    subtotal_cents: number;
    total_cents: number;
    currency: string;
    proration_details?: Array<{
      description: string | null;
      amount_cents: number;
      amount_usd: string;
    }>;
    new_plan_prorated?: {
      description: string | null;
      amount_cents: number;
      amount_usd: string;
    } | null;
    billing_cycle_anchor: number;
  } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Mark subscription as active in onboarding state when confirmed
  useEffect(() => {
    if (hasActiveSubscription) {
      markSubscriptionActive();
    }
  }, [hasActiveSubscription]);

  // Fetch available plans
  const { data: plans = [] } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('justai_subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (error) throw error;
      return data as SubscriptionPlan[];
    },
  });

  // Upgrade mutation
  const upgradeMutation = useMutation({
    mutationFn: async (newPriceId: string) => {
      const accessToken = getAccessToken();
      if (!accessToken) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upgrade-subscription`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ newPriceId }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        
        // Handle specific payment errors
        if (response.status === 402) {
          throw new Error(error.details || error.error || 'Payment failed. Please check your payment method.');
        }
        
        throw new Error(error.details || error.error || 'Failed to upgrade subscription');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      setUpgradeDialogOpen(false);
      setSelectedPlan(null);
      toast({
        title: 'Subscription upgraded!',
        description: 'Your subscription has been upgraded successfully.',
        variant: 'default',
      });
    },
    onError: (error: Error) => {
      console.error('Upgrade failed:', error);
      toast({
        title: 'Upgrade failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Cancel mutation - session check:', { hasSession: !!session, token: session?.access_token?.substring(0, 20) });
      
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cancel-subscription`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || error.error || 'Failed to cancel subscription');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      setCancelDialogOpen(false);
      toast({
        title: 'Subscription canceled',
        description: 'Your subscription will remain active until the end of the billing period.',
        variant: 'default',
      });
    },
    onError: (error: Error) => {
      console.error('Cancellation failed:', error);
      toast({
        title: 'Cancellation failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Reactivate mutation
  const reactivateMutation = useMutation({
    mutationFn: async () => {
      const accessToken = getAccessToken();
      if (!accessToken) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reactivate-subscription`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || error.error || 'Failed to reactivate subscription');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      toast({
        title: 'Subscription reactivated',
        description: 'Your subscription will continue as normal.',
        variant: 'default',
      });
    },
    onError: (error: Error) => {
      console.error('Reactivation failed:', error);
      toast({
        title: 'Reactivation failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleUpgradeClick = async (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    setUpgradeDialogOpen(true);
    setLoadingPreview(true);
    setProrationPreview(null);

    try {
      const accessToken = getAccessToken();
      if (!accessToken) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/preview-subscription-upgrade`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ newPriceId: plan.stripe_price_id }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setProrationPreview(data.preview);
      }
    } catch (error) {
      console.error('Failed to fetch proration preview:', error);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleConfirmUpgrade = () => {
    if (selectedPlan) {
      upgradeMutation.mutate(selectedPlan.stripe_price_id);
    }
  };

  if (!subscription) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <header className="bg-white px-4 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-semibold">Subscription</h1>
          </div>
        </header>
        <div className="px-4 py-12 text-center">
          <p className="text-gray-500">No active subscription found</p>
          <Button onClick={() => navigate('/subscription/plans')} className="mt-4">
            View Plans
          </Button>
        </div>
      </div>
    );
  }

  // Time-based usage calculation
  const voiceLimitSeconds = voiceMinutesLimit ? voiceMinutesLimit * 60 : null;
  const percentage = voiceLimitSeconds
    ? (voiceSecondsUsed / voiceLimitSeconds) * 100
    : 0;

  // Get current plan tier
  const planTiers: Record<'basic' | 'premium' | 'unlimited' | 'plus', number> = {
    basic: 1,
    premium: 2,
    unlimited: 3,
    plus: 2, // Same tier as premium
  };
  const currentTier = planTiers[subscription.subscription_type];

  // Filter upgrade options (higher tiers only, same billing period)
  const upgradeOptions = plans.filter(
    (plan) =>
      planTiers[plan.plan_type] > currentTier &&
      plan.billing_period === subscription.billing_period
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header className="bg-white px-4 py-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-semibold">Subscription</h1>
        </div>
      </header>

      <div className="px-4 py-6 max-w-2xl mx-auto space-y-4">
        {/* Current Plan Card */}
        <Card className="bg-[hsl(var(--brand-blue))] text-white border-0">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardDescription className="text-white/80">
                  {subscription.cancel_at_period_end 
                    ? `Cancels on ${new Date(subscription.current_period_end).toLocaleDateString()}`
                    : 'Your Plan'
                  }
                </CardDescription>
                <CardTitle className="text-2xl capitalize">
                  {subscription.subscription_type}
                  <Badge className="ml-2 bg-white/20 text-white border-0">
                    {subscription.billing_period === 'annual' ? 'Annual' : 'Monthly'}
                  </Badge>
                </CardTitle>
              </div>
              <Sparkles className="w-8 h-8 opacity-80" />
            </div>
          </CardHeader>
          <CardContent>
            {voiceMinutesLimit !== null ? (
              <>
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span>{formatTime(voiceSecondsUsed)} used</span>
                    <span>{formatTime(voiceSecondsRemaining ?? 0)} left</span>
                  </div>
                  <Progress value={percentage} className="h-2 bg-white/20" />
                </div>
                {!subscription.cancel_at_period_end && (
                  <p className="text-xs opacity-90">
                    Resets {new Date(subscription.current_period_end).toLocaleDateString()}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm opacity-90">
                Unlimited voice time · {formatTime(voiceSecondsUsed)} this period
              </p>
            )}
          </CardContent>
        </Card>

        {/* Upgrade Options */}
        {upgradeOptions.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                <CardTitle>Upgrade Options</CardTitle>
              </div>
              <CardDescription>
                Get more voice time and unlock additional features
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {upgradeOptions.map((plan) => (
                <div
                  key={plan.id}
                  className="border rounded-lg p-4 hover:border-blue-500 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-semibold capitalize">{plan.plan_type}</h4>
                      <p className="text-sm text-gray-600">
                        {(plan as any).voice_minutes_limit
                          ? `${formatTime((plan as any).voice_minutes_limit * 60)} voice time/${plan.billing_period === 'weekly' ? 'week' : 'period'}`
                          : 'Unlimited voice time'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">
                        ${(plan.price_cents / 100).toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-500">
                        /{plan.billing_period === 'annual' ? 'year' : 'month'}
                      </p>
                    </div>
                  </div>
                  {plan.features && plan.features.length > 0 && (
                    <ul className="space-y-1 mb-3">
                      {plan.features.slice(0, 3).map((feature, idx) => (
                        <li key={idx} className="text-sm text-gray-600 flex items-center gap-2">
                          <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Button
                    onClick={() => handleUpgradeClick(plan)}
                    className="w-full bg-black hover:bg-gray-900 text-white"
                    size="sm"
                  >
                    Upgrade Now
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Billing Details */}
        <Card>
          <CardHeader>
            <CardTitle>Billing Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5 text-gray-500" />
                <div>
                  <p className="font-medium">Payment Method</p>
                  <p className="text-sm text-gray-500">Managed by Stripe</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // TODO: Open Stripe customer portal
                  window.open('https://billing.stripe.com/p/login/test_', '_blank');
                }}
              >
                Manage
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-gray-500" />
                <div>
                  <p className="font-medium">
                    {subscription.cancel_at_period_end ? 'Active Until' : 'Next Billing Date'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {new Date(subscription.current_period_end).toLocaleDateString()}
                  </p>
                </div>
              </div>
              {subscription.cancel_at_period_end ? (
                <p className="text-sm text-gray-600">No charge</p>
              ) : (
                <p className="font-semibold">${(subscription.price_cents / 100).toFixed(2)}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="space-y-2">
          {subscription.cancel_at_period_end ? (
            <Button
              variant="outline"
              className="w-full text-green-600 hover:bg-green-50 hover:text-green-700"
              onClick={() => reactivateMutation.mutate()}
              disabled={reactivateMutation.isPending}
            >
              {reactivateMutation.isPending ? 'Reactivating...' : 'Reactivate Subscription'}
            </Button>
          ) : (
            <Button
              variant="outline"
              className="w-full text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => setCancelDialogOpen(true)}
            >
              Cancel Subscription
            </Button>
          )}
        </div>
      </div>

      {/* Upgrade Confirmation Dialog */}
      <Dialog open={upgradeDialogOpen} onOpenChange={setUpgradeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Upgrade</DialogTitle>
            <DialogDescription>
              Upgrade your subscription to get more features
            </DialogDescription>
          </DialogHeader>

          {selectedPlan && (
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>How this works:</strong>
                  <ul className="mt-2 space-y-1 text-sm">
                    <li>• Your voice time used ({formatTime(voiceSecondsUsed)}) will be preserved</li>
                    <li>
                      • You'll immediately get access to{' '}
                      {(selectedPlan as any).voice_minutes_limit
                        ? `${formatTime(((selectedPlan as any).voice_minutes_limit * 60) - voiceSecondsUsed)} additional voice time`
                        : 'unlimited voice time'}
                    </li>
                    <li>• You'll be charged a prorated amount for the remaining billing period</li>
                    <li>• Your billing date stays the same</li>
                  </ul>
                </AlertDescription>
              </Alert>

              <div className="border rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Current Plan</span>
                  <span className="text-sm font-medium capitalize">{subscription.subscription_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">New Plan</span>
                  <span className="text-sm font-medium capitalize">{selectedPlan.plan_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">New Price</span>
                  <span className="text-sm font-medium">
                    ${(selectedPlan.price_cents / 100).toFixed(2)}/{selectedPlan.billing_period === 'annual' ? 'year' : 'month'}
                  </span>
                </div>
                {loadingPreview ? (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Prorated Charge Today</span>
                    <span className="text-sm text-gray-400">Calculating...</span>
                  </div>
                ) : prorationPreview ? (
                  <div className="flex justify-between border-t pt-2 mt-2">
                    <span className="text-sm font-semibold">Prorated Charge Today</span>
                    <span className="text-sm font-semibold text-blue-600">
                      ${(prorationPreview.immediate_charge_cents / 100).toFixed(2)}
                    </span>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Voice Time After Upgrade</span>
                  <span className="text-sm font-medium">
                    {(selectedPlan as any).voice_minutes_limit
                      ? formatTime(((selectedPlan as any).voice_minutes_limit * 60) - voiceSecondsUsed)
                      : 'Unlimited'}
                  </span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUpgradeDialogOpen(false)}
              disabled={upgradeMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmUpgrade}
              disabled={upgradeMutation.isPending}
            >
              {upgradeMutation.isPending ? 'Upgrading...' : 'Confirm Upgrade'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Subscription</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel your subscription?
            </DialogDescription>
          </DialogHeader>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Your subscription will remain active until{' '}
              {new Date(subscription.current_period_end).toLocaleDateString()}.
              After that, you won't be able to start voice conversations.
            </AlertDescription>
          </Alert>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)} disabled={cancelMutation.isPending}>
              Keep Subscription
            </Button>
            <Button
              variant="destructive"
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? 'Canceling...' : 'Cancel Subscription'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
