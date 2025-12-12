import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Check, AlertCircle, PanelLeft } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { createCheckoutSession } from '@/lib/justai-api';
import { useSession } from '@/hooks/useSession';
import { updateOnboardingStep } from '@/lib/onboarding-state';
import type { SubscriptionPlan } from '@/lib/justai-types';
import { AppSidebar } from '@/components/AppSidebar';

export default function SubscriptionPlans() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [showCanceledMessage, setShowCanceledMessage] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  
  // Use session hook for better session management
  const { session, user, isAuthenticated, isAnonymous } = useSession();

  // Handle URL parameters
  useEffect(() => {
    if (searchParams.get('canceled') === 'true') {
      setShowCanceledMessage(true);
      // Clear the parameter after showing message
      const timer = setTimeout(() => {
        setSearchParams({});
        setShowCanceledMessage(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [searchParams, setSearchParams]);

  // Fetch real subscription plans from Supabase
  const { data: plans, isLoading } = useQuery({
    queryKey: ['subscription-plans', billingCycle],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('justai_subscription_plans')
        .select('*')
        .eq('is_active', true)
        .eq('billing_period', billingCycle)
        .order('display_order');

      if (error) throw error;
      return data as SubscriptionPlan[];
    },
  });

  // Get current user for header
  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const handleSelectPlan = async (priceId: string, planId: string) => {
    try {
      setSelectedPlan(planId);
      
      console.log('Subscription attempt:', { 
        hasSession: !!session,
        sessionExpiresAt: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : 'N/A',
        hasUser: !!user,
        isAnonymous: isAnonymous,
        userId: user?.id,
        emailConfirmed: user?.email_confirmed_at,
        userEmail: user?.email,
        accessToken: session?.access_token ? `${session.access_token.substring(0, 30)}...` : 'MISSING'
      });
      
      // Check if authenticated
      if (!isAuthenticated) {
        alert('Please sign in to subscribe. Your session has expired.');
        navigate('/login');
        setSelectedPlan(null);
        return;
      }
      
      // Anonymous users can subscribe - their email is already in the profile
      // They can verify later if they want to access their account from another device
      
      // Update onboarding state to track payment in progress
      updateOnboardingStep('subscription-payment');
      
      console.log('Calling createCheckoutSession with priceId:', priceId);
      
      // Create checkout session
      const checkoutUrl = await createCheckoutSession(priceId);
      
      console.log('Checkout URL received:', checkoutUrl);
      window.location.href = checkoutUrl;
    } catch (error) {
      console.error('Subscription error caught:', error);
      
      // Better error messaging
      const errorMessage = error instanceof Error ? error.message : 'Failed to start subscription';
      
      console.error('Full error details:', {
        message: errorMessage,
        error: error
      });
      
      if (errorMessage.includes('Unauthorized') || errorMessage.includes('Not authenticated') || errorMessage.includes('JWT')) {
        alert('Your session has expired. Please refresh the page and try again.');
        window.location.reload();
      } else if (errorMessage.includes('email not found')) {
        alert('Please provide your email address to subscribe. Go back to the signup page.');
        navigate('/login');
      } else {
        alert(`Failed to start subscription: ${errorMessage}`);
      }
      
      setSelectedPlan(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading plans...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Sidebar */}
      <AppSidebar open={showSidebar} onOpenChange={setShowSidebar} />

      {/* Header */}
      <header className="bg-background px-4 py-4 border-b">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <Button 
            variant="ghost" 
            size="icon" 
            className="-ml-2"
            onClick={() => setShowSidebar(!showSidebar)}
          >
            <PanelLeft className="w-6 h-6 text-gray-600" />
          </Button>
          <div className="flex-1 text-center">
            <h1 className="text-xl font-semibold">Subscription Plans</h1>
          </div>
          <Avatar className="w-10 h-10 cursor-pointer" onClick={() => navigate('/profile')}>
            <AvatarImage src={currentUser?.profile_photo_url} />
            <AvatarFallback>{currentUser?.display_name?.[0] || 'U'}</AvatarFallback>
          </Avatar>
        </div>
      </header>

      {/* Email Verification Notice */}
      {isAuthenticated === false && (
        <div className="px-4 pt-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-blue-900 dark:text-blue-100">Verify Your Email</p>
              <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                Check your email to verify your account and set up your password. You can still browse plans!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Canceled Message */}
      {showCanceledMessage && (
        <div className="px-4 pt-4">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-900 dark:text-yellow-100">Checkout Canceled</p>
              <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-1">
                No worries! You can select a plan whenever you're ready.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="px-4 py-6 max-w-4xl mx-auto">
        {/* Title */}
        <h1 className="text-3xl font-bold mb-2">Choose your plan</h1>
        <p className="text-muted-foreground mb-6">Start learning with AI today</p>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <Button
            variant={billingCycle === 'monthly' ? 'default' : 'outline'}
            onClick={() => setBillingCycle('monthly')}
            className="rounded-full px-6"
          >
            Monthly
          </Button>
          <Button
            variant={billingCycle === 'annual' ? 'default' : 'outline'}
            onClick={() => setBillingCycle('annual')}
            className="rounded-full px-6 relative"
          >
            Yearly
            <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-green-500 text-white text-xs rounded-full">
              Save 17%
            </span>
          </Button>
        </div>

        {/* Plans */}
        <div className="space-y-4">
          {plans?.map((plan) => {
            const monthlyPrice = billingCycle === 'annual'
              ? plan.monthly_equivalent_cents / 100
              : plan.price_cents / 100;
            const totalPrice = plan.price_cents / 100;

            return (
              <div
                key={plan.id}
                className={cn(
                  'relative bg-card rounded-3xl p-6 border-2 transition-all',
                  selectedPlan === plan.id
                    ? 'border-primary shadow-xl'
                    : 'border-border',
                  plan.is_featured && 'ring-2 ring-primary ring-offset-2'
                )}
              >
                {/* Popular Badge */}
                {plan.is_featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-full">
                    MOST POPULAR
                  </div>
                )}

                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold mb-1">
                      {plan.plan_name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {plan.monthly_message_limit
                        ? `${plan.monthly_message_limit} messages/month`
                        : 'Unlimited messages'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold">
                      ${monthlyPrice.toFixed(2)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      /month
                    </p>
                    {billingCycle === 'annual' && (
                      <p className="text-xs text-green-600">
                        ${totalPrice}/year
                      </p>
                    )}
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-2 mb-6">
                  {plan.features.map((feature: string, idx: number) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 text-sm"
                    >
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* Select Button */}
                <Button
                  onClick={() => handleSelectPlan(plan.stripe_price_id, plan.id)}
                  variant={selectedPlan === plan.id || plan.is_featured ? 'default' : 'secondary'}
                  className="w-full rounded-xl"
                  disabled={selectedPlan !== null}
                >
                  {selectedPlan === plan.id ? 'Processing...' : 'Select Plan'}
                </Button>
              </div>
            );
          })}
        </div>

        {/* Trust Badges */}
        <div className="mt-8 text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            ✓ Cancel anytime · ✓ No commitments · ✓ Secure payment
          </p>
        </div>
      </div>
    </div>
  );
}
