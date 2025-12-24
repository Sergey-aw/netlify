import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { Check, AlertCircle, Crown, ChessQueen, CreditCard, Infinity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { createCheckoutSession } from '@/lib/justai-api';
import { useSession } from '@/hooks/useSession';
import { updateOnboardingStep } from '@/lib/onboarding-state';
import type { SubscriptionPlan } from '@/lib/justai-types';
import { AppSidebar } from '@/components/AppSidebar';
import bgWelcome from '@/assets/bg_welcome.jpg';

export default function SubscriptionPlans() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [selectedPlanName, setSelectedPlanName] = useState<string | null>(null);
  const [showCanceledMessage, setShowCanceledMessage] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  
  // Add swipe gesture to open sidebar
  useSwipeGesture({
    onSwipeRight: () => {
      if (!showSidebar) {
        setShowSidebar(true);
      }
    },
    minSwipeDistance: 50,
    maxVerticalDistance: 100,
    ignoreSelectors: ['.plan-cards-container'],
  });
  
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

  // Show banner after 3 seconds delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowBanner(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  // Show banner again when Premium plan is selected (but don't reset dismissed state)
  useEffect(() => {
    if (selectedPlanName === 'Premium' && bannerDismissed) {
      setShowBanner(true);
    }
  }, [selectedPlanName, bannerDismissed]);

  // Fetch monthly plans
  const { data: monthlyPlans, isLoading: isLoadingMonthly } = useQuery({
    queryKey: ['subscription-plans', 'monthly'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('justai_subscription_plans')
        .select('*')
        .eq('is_active', true)
        .eq('billing_period', 'monthly')
        .order('display_order');

      if (error) throw error;
      return data as SubscriptionPlan[];
    },
  });

  // Fetch annual plans
  const { data: annualPlans, isLoading: isLoadingAnnual } = useQuery({
    queryKey: ['subscription-plans', 'annual'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('justai_subscription_plans')
        .select('*')
        .eq('is_active', true)
        .eq('billing_period', 'annual')
        .order('display_order');

      if (error) throw error;
      return data as SubscriptionPlan[];
    },
  });

  // Select plans based on current billing cycle
  const plans = billingCycle === 'monthly' ? monthlyPlans : annualPlans;
  const isLoading = isLoadingMonthly || isLoadingAnnual;

  // Set Premium monthly plan as default selection when plans load
  useEffect(() => {
    if (monthlyPlans && !selectedPlan) {
      const premiumPlan = monthlyPlans.find(plan => plan.plan_name === 'Premium');
      if (premiumPlan) {
        setSelectedPlan(premiumPlan.id);
        setSelectedPlanName(premiumPlan.plan_name);
      }
    }
  }, [monthlyPlans, selectedPlan]);

  // Sync selected plan when billing cycle changes
  useEffect(() => {
    if (selectedPlanName && plans) {
      const matchingPlan = plans.find(plan => plan.plan_name === selectedPlanName);
      if (matchingPlan) {
        setSelectedPlan(matchingPlan.id);
      }
    }
  }, [billingCycle, plans, selectedPlanName]);

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
    <div 
      className="min-h-screen relative overflow-hidden bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${bgWelcome})` }}
    >
      {/* Sidebar */}
      <AppSidebar open={showSidebar} onOpenChange={setShowSidebar} />

      {/* Glassmorphism Banner - New Year Special */}
      <AnimatePresence>
        {showBanner && (
          <motion.div
            initial={{ y: -250, x: '-50%', opacity: 1, scale: 0.9 }}
            animate={{ y: 0, x: '-50%', opacity: 1, scale: 1 }}
            exit={{ y: -250, x: '-50%', opacity: 0, scale: 0.9 }}
            transition={{
              type: 'spring',
              stiffness: 120,
              damping: 15,
              mass: 0.8,
            }}
            style={{
              position: 'fixed',
              top: '16px',
              left: '50%',
              zIndex: 50,
              width: 'calc(100% - 32px)',
              maxWidth: '390px',
            }}
          >
         
            <div className="relative overflow-hidden rounded-2xl glass-container">
              {/* Glass effect base */}
              <div 
                className="relative px-4 py-2 flex items-center gap-2.5"
                style={{
                  background: 'rgba(129, 190, 255, 0.2)',
                  backdropFilter: 'blur(12px) saturate(140%)',
                  WebkitBackdropFilter: 'blur(12px) saturate(140%)',
                  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.18)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                }}
              >
                {/* Glossy highlight layer */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.35), rgba(255, 255, 255, 0.06) 40%, rgba(255, 255, 255, 0.02))',
                    mixBlendMode: 'overlay',
                  }}
                />
                
                {/* Gradient border effect */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    borderRadius: 'inherit',
                    padding: '1px',
                    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.4), rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.2))',
                    WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                    WebkitMaskComposite: 'xor',
                    maskComposite: 'exclude',
                  }}
                />
                
                {/* Emoji */}
                <div className="relative z-10 flex items-center justify-center p-1 rounded-lg shrink-0">
                  <span className="text-2xl leading-none">🥳</span>
                </div>
                
                {/* Content */}
                <div className="relative z-10 flex-1 min-w-0">
                  <p className="text-sm font-medium leading-normal" style={{ color: '#064589' }}>
                    Use code <span style={{ color: '#007aff' }}>JUST-2026</span> to get <span style={{ color: '#007aff' }}>Premium</span> for the price of Basic.
                  </p>
                </div>
                
                <button
                  onClick={() => {
                    setShowBanner(false);
                    setBannerDismissed(true);
                  }}
                  className="relative z-10 w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors shrink-0"
                  style={{
                    color: '#064589',
                    fontSize: '20px',
                    fontWeight: 500,
                  }}
                >
                  ×
                </button>
              </div>
                 {/* Small Green Badge - Centered */}
           

            </div>
             <div 
              className="relative flex items-center justify-center px-2.5 py-1 rounded-lg -mb-2  -inset-y-2"
              style={{
                background: 'rgba(13, 255, 0, 0.15)',
                backdropFilter: 'blur(8px) saturate(140%)',
                WebkitBackdropFilter: 'blur(8px) saturate(140%)',
                width: 'fit-content',
                margin: '0 auto 8px auto',
              }}
            >
              {/* Gradient border effect */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  borderRadius: 'inherit',
                  padding: '1px',
                  background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.4), rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.2))',
                  WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                  WebkitMaskComposite: 'xor',
                  maskComposite: 'exclude',
                }}
              />
              <p className="text-xs font-medium text-[#035f07] whitespace-nowrap relative z-10">
                New Year special
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Container */}
      <div className="relative flex flex-col min-h-screen px-6 py-0 pb-12">
        {/* Header Section */}
        <div className="flex flex-col items-center text-center pt-8 pb-0 px-8 gap-[21px] mb-8">
          <h1 className="text-[32px] font-bold text-[#39597d] leading-[1.076]">
            Choose your plan
          </h1>
          {/* <p className="text-[16px] font-medium text-[#5983b3]">
            Start learning today
          </p> */}
        </div>

        {/* Alert Messages */}
        {isAuthenticated === false && (
          <div className="mb-4">
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

        {showCanceledMessage && (
          <div className="mb-4">
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

        {/* Benefits Section */}
        <div className="flex flex-col gap-0 mb-6 h-[280px] relative overflow-hidden">
          {selectedPlanName && plans ? (() => {
            const selectedPlan = plans.find(p => p.plan_name === selectedPlanName);
            const features = selectedPlan?.features;
            const isStructured = features && typeof features === 'object' && !Array.isArray(features) && 'items' in features;
            
            return isStructured ? (
              <div className="px-3 py-1">
                <div className="space-y-3">
                  {features.items.slice(0, 3).map((item, idx) => (
                    <div key={idx} className="flex gap-[10px] items-start">
                      <div className="w-16 h-[63px] bg-white flex flex-col items-center overflow-hidden rounded-lg shrink-0">
                        <div className="w-12 h-12 bg-gradient-to-br from-orange-200 to-pink-300 rounded-lg mt-1.5" />
                      </div>
                      <div className="flex-1 flex flex-col gap-1 min-w-0">
                        <p className="text-base font-medium text-black leading-normal">
                          {item.name}
                        </p>
                        <p className="text-sm font-medium text-[#7b7b7b] leading-normal">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="px-3 py-1 space-y-3">
                {(features as string[])?.slice(0, 3).map((feature, idx) => (
                  <div key={idx} className="flex gap-[10px] items-start">
                    <div className="w-16 h-[63px] bg-white flex flex-col items-center overflow-hidden rounded-lg shrink-0">
                      <div className="w-12 h-12 bg-gradient-to-br from-orange-200 to-pink-300 rounded-lg mt-1.5" />
                    </div>
                    <div className="flex-1 flex flex-col gap-1 min-w-0">
                      <p className="text-base font-semibold text-black leading-normal whitespace-nowrap">
                        Feature {idx + 1}
                      </p>
                      <p className="text-sm font-medium text-[#7b7b7b] leading-normal min-w-full">
                        {feature}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            );
          })() : (
            <div className="px-8 py-3 space-y-3">
              {[1, 2, 3].map((idx) => (
                <div key={idx} className="flex gap-[10px] items-start">
                  <div className="w-16 h-[63px] bg-white flex flex-col items-center overflow-hidden rounded-lg shrink-0">
                    <div className="w-12 h-12 bg-gradient-to-br from-orange-200 to-pink-300 rounded-lg mt-1.5" />
                  </div>
                  <div className="flex-1 flex flex-col gap-1 min-w-0">
                    <p className="text-[16px] font-semibold text-black leading-normal whitespace-nowrap">
                      Select a plan
                    </p>
                    <p className="text-[16px] font-medium text-[#7b7b7b] leading-normal min-w-full">
                      Choose your plan to see features
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Plan Selection Section */}
        <div className="flex flex-col gap-4 px-0 py-[3px] flex-1">
          {/* Section Title */}
          {/* <div className="flex justify-center items-center w-full">
            <p className="text-[16px] font-semibold text-black">
              Choose the plan fits your needs
            </p>
          </div> */}

          {/* Tabs Component */}
          <div className="flex justify-center w-full px-[60px]">
            <div className="w-full bg-muted rounded-md p-1 relative">
              {/* Discount badge */}
              <Badge 
                variant="default" 
                className="absolute -top-2 -right-4 bg-blue-500 hover:rotate-6 text-white text-[10px] px-1.5 py-0.5 shadow-sm z-20 rotate-[20deg]"
              >
                -75%
              </Badge>
              {/* Sliding background */}
              <motion.div
                className="absolute top-1 bottom-1 bg-background rounded-sm shadow-sm"
                initial={false}
                animate={{
                  left: billingCycle === 'monthly' ? '4px' : '50%',
                  width: 'calc(50% - 4px)',
                }}
                transition={{
                  type: 'spring',
                  stiffness: 500,
                  damping: 30,
                }}
              />
              
              {/* Tab buttons */}
              <div className="relative flex">
                <button
                  onClick={() => setBillingCycle('monthly')}
                  className={cn(
                    "flex-1 px-3 py-1.5 text-sm font-medium rounded-sm transition-colors relative z-10",
                    billingCycle === 'monthly' ? 'text-foreground' : 'text-muted-foreground'
                  )}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingCycle('annual')}
                  className={cn(
                    "flex-1 px-3 py-1.5 text-sm font-medium rounded-sm transition-colors relative z-10",
                    billingCycle === 'annual' ? 'text-foreground' : 'text-muted-foreground'
                  )}
                >
                  Annual
                </button>
              </div>
            </div>
          </div>

          {/* Plan Cards - Centered */}
          <div className="flex gap-6 justify-center px-6 py-4 plan-cards-container">
            {plans?.map((plan) => {
              const monthlyPrice = billingCycle === 'annual'
                ? plan.monthly_equivalent_cents / 100
                : plan.price_cents / 100;
              const isSelected = selectedPlan === plan.id;

              return (
                <motion.div
                  key={plan.id}
                  onClick={() => {
                    setSelectedPlan(plan.id);
                    setSelectedPlanName(plan.plan_name);
                  }}
                  className={cn(
                    'flex-shrink-0 w-1/2 snap-center bg-white rounded-2xl p-4 flex flex-col gap-[14px] shadow-[0px_2px_15px_0px_rgba(0,0,0,0.1)] cursor-pointer relative border-2',
                    isSelected ? 'border-[#78b9ff] shadow-[0px_0px_8px_0px_rgba(0,122,255,0.5)]' : 'border-transparent'
                  )}
                  whileTap={{ scale: 0.92 }}
                  transition={{
                    type: 'spring',
                    stiffness: 400,
                    damping: 17,
                  }}
                >
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[hsl(var(--brand-blue))] flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                  <div className="flex flex-col gap-[14px]">
                    {plan.plan_name === 'Unlimited' ? (
                      <Infinity className="w-4 h-4 text-slate-800" />
                    ) : plan.plan_name === 'Premium' ? (
                      <ChessQueen className="w-4 h-4 text-slate-800" />
                    ) : (
                      <Crown className="w-4 h-4 text-slate-800" />
                    )}
                    <div className="flex flex-col gap-1">
                      <p className={cn(
                        "text-[14px] font-normal leading-[1.076]",
                        plan.plan_name === 'Premium' 
                          ? 'text-blue-500 drop-shadow-[0_0_1px_rgba(0,122,255,0.3)]' 
                          : 'text-black'
                      )}>
                        {plan.plan_name}
                      </p>
                      <div className="flex items-baseline gap-0.5">
                        <span className="text-[18px] font-semibold text-black">
                          ${monthlyPrice.toFixed(2)}
                        </span>
                        <span className="text-[12px] font-medium text-black">/</span>
                        <span className="text-[12px] font-normal text-black">mo</span>
                      </div>
                    </div>
                  </div>
                  {/* <p className="text-[12px] font-medium text-black leading-[1.076]">
                    Free 7-day trial
                  </p> */}
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Continue Button */}
        <div className="mt-auto pt-2">
          <Button 
            onClick={() => {
              if (selectedPlan && plans) {
                const plan = plans.find(p => p.id === selectedPlan);
                if (plan) {
                  handleSelectPlan(plan.stripe_price_id, plan.id);
                }
              }
            }}
            disabled={!selectedPlan}
            className="w-full h-12 bg-[#111] hover:bg-[#222] text-white text-[18px] font-medium rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <CreditCard className="w-5 h-5" />
            Subscribe
          </Button>
        </div>
      </div>

      {/* Add scrollbar hide utility */}
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        
        /* Glassmorphism banner styles removed - using Framer Motion animations */
        
        /* Fallback if backdrop-filter is not supported */
        @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
          .glass-banner > div > div {
            background: rgba(255, 255, 255, 0.25) !important;
          }
        }
      `}</style>
    </div>
  );
}
