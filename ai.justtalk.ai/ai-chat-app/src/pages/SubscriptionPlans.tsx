import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { useFeatureFlagVariant, usePostHogTracking } from '@/hooks/usePostHog';
import { useFeatureFlagVariantKey, usePostHog } from 'posthog-js/react';
import { Check, AlertCircle, Crown, ChessQueen, CreditCard, Infinity, Mic, MessageSquare, BookOpen, BarChart, Sparkles, Zap, Volume2, TrendingUp, Target, Brain, Users, Globe, Trophy, Star, CheckCircle2, Award, GraduationCap, Heart, Briefcase, ArrowLeft, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/hooks/useSession';
import { updateOnboardingStep, getPricingVariant, isValidPricingVariant } from '@/lib/onboarding-state';
import { trackPaywallViewed, trackPlanSelected, trackCheckoutStarted, trackTrialOfferShown, type TrialConfig } from '@/lib/posthog';
import type { SubscriptionPlan, PricingVariant } from '@/lib/justai-types';
import { AppSidebar } from '@/components/AppSidebar';
import bgWelcome from '@/assets/bg_welcome.jpg';

export default function SubscriptionPlans() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [billingCycle, setBillingCycle] = useState<'weekly' | 'monthly' | 'annual'>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [selectedPlanName, setSelectedPlanName] = useState<string | null>(null);
  const [showCanceledMessage, setShowCanceledMessage] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  
  // ========================================
  // PRICING VARIANT A/B TEST LOGIC
  // ========================================
  
  // 1. Extract URL ref parameter (highest priority)
  const refParam = searchParams.get('ref');
  
  // 2. Get PostHog feature flag for pricing variant (fallback)
  const posthogPricingVariant = useFeatureFlagVariantKey('pricing-test-landing');
  
  // 3. Resolve effective pricing variant with priority:
  //    URL ref > localStorage (from landing page) > PostHog feature flag > default 'control'
  const getEffectivePricingVariant = (): PricingVariant => {
    // Priority 1: URL ref parameter (for direct links)
    if (isValidPricingVariant(refParam)) {
      console.log('[Pricing Variant] Using URL ref parameter:', refParam);
      return refParam;
    }
    
    // Priority 2: localStorage (from landing page - preserved through onboarding)
    const storedVariant = getPricingVariant();
    if (storedVariant) {
      console.log('[Pricing Variant] Using stored variant from localStorage:', storedVariant);
      return storedVariant;
    }
    
    // Priority 3: PostHog feature flag (for organic traffic)
    if (posthogPricingVariant && isValidPricingVariant(posthogPricingVariant as string)) {
      console.log('[Pricing Variant] Using PostHog feature flag:', posthogPricingVariant);
      return posthogPricingVariant as PricingVariant;
    }
    
    // Priority 4: Default to control
    console.log('[Pricing Variant] Using default: control');
    return 'control';
  };
  
  const effectivePricingVariant = getEffectivePricingVariant();
  
  // Log pricing variant resolution
  useEffect(() => {
    const storedVariant = getPricingVariant();
    console.log('[Pricing Variant] Resolved:', {
      effectiveVariant: effectivePricingVariant,
      urlRef: refParam,
      storedVariant: storedVariant,
      posthogVariant: posthogPricingVariant,
      source: refParam && isValidPricingVariant(refParam) ? 'url' :
              storedVariant ? 'localStorage' :
              posthogPricingVariant && isValidPricingVariant(posthogPricingVariant as string) ? 'posthog' : 'default',
    });
  }, [effectivePricingVariant, refParam, posthogPricingVariant]);
  
  // ========================================
  // TRIAL PERIOD EXPERIMENT (existing)
  // ========================================
  
  // Trial period experiment - use official PostHog hooks
  const trialVariant = useFeatureFlagVariantKey('trial-period-experiment');
  
  // Compute trial config from variant (handle boolean variant edge case)
  const trialConfig: TrialConfig | null = trialVariant && typeof trialVariant === 'string'
    ? {
        variant: trialVariant,
        trial_days: 
          trialVariant === 'control' ? 0 :
          trialVariant === 'plan-a' ? 3 :
          trialVariant === 'plan-b' ? 5 :
          trialVariant === 'plan-c' ? 7 :
          0
      }
    : null;
  
  // Track user's manual selections per billing cycle
  const [userSelections, setUserSelections] = useState<Record<'weekly' | 'monthly' | 'annual', string | null>>({
    weekly: null,
    monthly: null,
    annual: null,
  });
  
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
  
  // Get PostHog instance from React context
  const posthog = usePostHog();
  
  // Explicitly evaluate trial experiment feature flag when paywall loads
  useEffect(() => {
    if (posthog) {
      // Explicitly call getFeatureFlag to ensure it's tracked in PostHog activity
      const variant = posthog.getFeatureFlag('trial-period-experiment');
      console.log('[Trial Experiment] Feature flag explicitly evaluated on paywall load:', {
        variant,
        timestamp: new Date().toISOString(),
      });
    }
  }, [posthog]); // Run once when posthog is available
  
  // Log trial config changes for debugging
  useEffect(() => {
    console.log('[Trial Experiment] Trial config updated:', {
      trialConfig,
      hasConfig: !!trialConfig,
      trial_days: trialConfig?.trial_days,
      variant: trialConfig?.variant,
      timestamp: new Date().toISOString(),
    });
    
    // Force a small re-render to ensure UI updates
    console.log('[Trial Experiment] Current billing cycle:', billingCycle);
    console.log('[Trial Experiment] Will show trial badges:', 
      billingCycle === 'monthly' && !!trialConfig && trialConfig.trial_days > 0
    );
  }, [trialConfig, billingCycle]);
  
  // PostHog feature flag for A/B test - get variant key
  const layoutVariant = useFeatureFlagVariant('subscription-plans-vertical-layout', 'false');
  
  // Check if user is in vertical layout variant (variant A = control)
  const isVerticalLayout = layoutVariant === 'control';
  
  // PostHog feature flag for weekly plan visibility
  const weeklyPlanVariant = useFeatureFlagVariant('weekly-plan-show-paywall', 'hidden');
  const showWeeklyPlan = weeklyPlanVariant === 'control';
  
  const { trackEvent, identifyUser } = usePostHogTracking();

  // Icon mapping for features
  const getFeatureIcon = (iconName: string): LucideIcon => {
    const iconMap: Record<string, LucideIcon> = {
      'MessageSquare': MessageSquare,
      'Sparkles': Sparkles,
      'Globe': Globe,
      'Zap': Zap,
      'BookOpen': BookOpen,
      'Trophy': Trophy,
      'TrendingUp': TrendingUp,
      'Users': Users,
      'Star': Star,
      'Crown': Crown,
      'Target': Target,
      'Award': Award,
      'Briefcase': Briefcase,
      'GraduationCap': GraduationCap,
      'Heart': Heart,
      'Mic': Mic,
      'Volume2': Volume2,
      'CheckCircle2': CheckCircle2,
      'Brain': Brain,
      'BarChart': BarChart,
      'Infinity': Infinity,
    };
    return iconMap[iconName] || Sparkles; // Default to Sparkles if icon not found
  };

  // Debug: Log feature flag value
  useEffect(() => {
    console.log('[A/B Test] Feature flag loaded:', {
      layoutVariant,
      type: typeof layoutVariant,
      isVerticalLayout,
      variant: isVerticalLayout ? 'A (vertical)' : 'B (horizontal)',
    });
  }, [layoutVariant, isVerticalLayout]);

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
  // HIDDEN: New Year deal banner disabled
  // useEffect(() => {
  //   const timer = setTimeout(() => {
  //     setShowBanner(true);
  //   }, 3000);
  //   return () => clearTimeout(timer);
  // }, []);

  // Track page view and identify user
  useEffect(() => {
    if (user?.id) {
      identifyUser(user.id, {
        email: user.email,
        isAnonymous,
      });
    }
    
    trackPaywallViewed(billingCycle);
    trackEvent('subscription_plan_viewed', {
      layout_variant: layoutVariant,
      is_vertical_layout: isVerticalLayout,
      isAuthenticated,
      isAnonymous,
      billing_cycle: billingCycle,
      trial_variant: trialVariant,
      trial_days: trialConfig?.trial_days,
      pricing_variant: effectivePricingVariant,
      pricing_variant_source: refParam && isValidPricingVariant(refParam) ? 'url' : 
                              posthogPricingVariant && isValidPricingVariant(posthogPricingVariant as string) ? 'posthog' : 'default',
    });
  }, [user?.id, layoutVariant, isVerticalLayout, isAuthenticated, isAnonymous, billingCycle, trialVariant, trialConfig, effectivePricingVariant]);

  // Show banner again when Premium plan is selected (but don't reset dismissed state)
  // HIDDEN: New Year deal banner disabled
  // useEffect(() => {
  //   if (selectedPlanName === 'Premium' && bannerDismissed) {
  //     setShowBanner(true);
  //   }
  // }, [selectedPlanName, bannerDismissed]);

  // Fetch monthly plans with pricing variant filter
  const { data: monthlyPlans, isLoading: isLoadingMonthly } = useQuery({
    queryKey: ['subscription-plans', 'monthly', effectivePricingVariant],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('justai_subscription_plans')
        .select('*')
        .eq('is_active', true)
        .eq('billing_period', 'monthly')
        .eq('pricing_variant', effectivePricingVariant)
        .order('display_order');

      if (error) throw error;
      return data as SubscriptionPlan[];
    },
  });

  // Fetch annual plans with pricing variant filter
  const { data: annualPlans, isLoading: isLoadingAnnual } = useQuery({
    queryKey: ['subscription-plans', 'annual', effectivePricingVariant],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('justai_subscription_plans')
        .select('*')
        .eq('is_active', true)
        .eq('billing_period', 'annual')
        .eq('pricing_variant', effectivePricingVariant)
        .order('display_order');

      if (error) throw error;
      return data as SubscriptionPlan[];
    },
  });

  // Fetch weekly plans (always use 'control' variant - weekly plans don't have variants)
  const { data: weeklyPlans, isLoading: isLoadingWeekly } = useQuery({
    queryKey: ['subscription-plans', 'weekly', 'control'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('justai_subscription_plans')
        .select('*')
        .eq('is_active', true)
        .eq('billing_period', 'weekly')
        .eq('pricing_variant', 'control') // Weekly plans only exist for control variant
        .order('display_order');

      if (error) throw error;
      return data as SubscriptionPlan[];
    },
    enabled: showWeeklyPlan, // Only fetch if feature flag is enabled
  });

  // Select plans based on current billing cycle
  const plans = billingCycle === 'weekly' ? weeklyPlans : billingCycle === 'monthly' ? monthlyPlans : annualPlans;
  const isLoading = isLoadingMonthly || isLoadingAnnual || isLoadingWeekly;

  // Track trial offer shown when plans are loaded and trial config is available
  useEffect(() => {
    if (!plans || plans.length === 0) return;
    if (!trialConfig || !trialConfig.trial_days) return;
    if (billingCycle !== 'monthly') return; // Only track for monthly plans
    
    // Track trial offer shown for each eligible plan
    const eligiblePlanTypes = ['basic', 'premium'];
    const eligiblePlans = plans.filter(plan => 
      eligiblePlanTypes.includes(plan.plan_type.toLowerCase())
    );
    
    if (eligiblePlans.length > 0) {
      console.log('[Trial Experiment] Trial offers visible on paywall:', {
        variant: trialConfig.variant,
        trial_days: trialConfig.trial_days,
        eligible_plans: eligiblePlans.map(p => p.plan_type),
        billing_cycle: billingCycle,
      });
      
      // Track for each eligible plan
      eligiblePlans.forEach(plan => {
        trackTrialOfferShown(
          trialConfig.variant,
          trialConfig.trial_days,
          plan.billing_period,
          plan.plan_type
        );
      });
    }
  }, [plans, trialConfig, billingCycle]);

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
    if (plans && plans.length > 0) {
      // Check if user has manually selected a plan for this billing cycle
      const userSelection = userSelections[billingCycle];
      if (userSelection) {
        const userSelectedPlan = plans.find(plan => plan.plan_name === userSelection);
        if (userSelectedPlan) {
          setSelectedPlan(userSelectedPlan.id);
          setSelectedPlanName(userSelectedPlan.plan_name);
          return;
        }
      }
      
      // No user selection - apply defaults
      if (billingCycle === 'weekly') {
        const startPlan = plans.find(plan => plan.plan_name === 'Start');
        if (startPlan) {
          setSelectedPlan(startPlan.id);
          setSelectedPlanName(startPlan.plan_name);
          return;
        }
      }
      
      // For monthly/annual, default to Premium
      const premiumPlan = plans.find(plan => plan.plan_name === 'Premium');
      if (premiumPlan) {
        setSelectedPlan(premiumPlan.id);
        setSelectedPlanName(premiumPlan.plan_name);
      }
    }
  }, [billingCycle, plans, userSelections]);

  const handleSelectPlan = async (priceId: string, planId: string) => {
    try {
      setSelectedPlan(planId);
      
      // Find the plan details for tracking
      const plan = plans?.find(p => p.id === planId);
      if (plan) {
        trackPlanSelected(
          plan.plan_type,
          priceId,
          plan.price_cents,
          plan.billing_period,
          {
            plan_name: plan.plan_name,
            voice_minutes_limit: (plan as any).voice_minutes_limit,
          }
        );
      }
      
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
      
      // Track checkout started
      if (plan) {
        trackCheckoutStarted(
          plan.plan_type,
          priceId,
          plan.price_cents,
          plan.billing_period
        );
      }
      
      // Check trial experiment eligibility: only for monthly billing
      let trialDays: number | undefined;
      let trialVariant: string | undefined;
      
      if (plan && plan.billing_period === 'monthly' && trialConfig && trialConfig.trial_days > 0) {
        // Check if plan is Basic or Premium (exclude Unlimited or other tiers)
        const eligiblePlanTypes = ['basic', 'premium'];
        
        if (eligiblePlanTypes.includes(plan.plan_type.toLowerCase())) {
          trialDays = trialConfig.trial_days;
          trialVariant = trialConfig.variant;
          
          console.log('[Trial Experiment] Applying trial to checkout:', { trialDays, trialVariant, planType: plan.plan_type });
          
          // Note: Trial offer shown is tracked when paywall loads, not here
          // This is just preparing the trial parameters for the checkout session
        }
      }
      
      // Check if authenticated
      // (!isAuthenticated) {
      //   alert('Please sign in to subscribe. Your session has expired.');
      //   navigate('/login');
      //   setSelectedPlan(null);
      //   return;
      // }
      
      // Anonymous users can subscribe - their email is already in the profile
      // They can verify later if they want to access their account from another device
      
      // Update onboarding state to track payment in progress
      updateOnboardingStep('subscription-payment');
      
      console.log('Calling createCheckoutSession with priceId:', priceId, 'trialDays:', trialDays);
      
      // Navigate to embedded checkout page with plan details
      const checkoutParams = new URLSearchParams({
        priceId,
        planName: plan?.plan_name || 'Selected Plan',
        planPrice: plan?.price_cents.toString() || '0',
        billingPeriod: plan?.billing_period || 'monthly',
        pricingVariant: effectivePricingVariant, // Pass pricing variant for tracking
      });
      
      if (trialDays) {
        checkoutParams.set('trialDays', trialDays.toString());
      }
      if (trialVariant) {
        checkoutParams.set('trialVariant', trialVariant);
      }
      
      navigate(`/checkout?${checkoutParams.toString()}`);
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

      {/* Glassmorphism Banner - New Year Special - HIDDEN */}
      {/* <AnimatePresence>
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
              <div
                className="relative px-4 py-2 flex items-center gap-2.4"
                style={{
                  background: 'rgba(129, 190, 255, 0.2)',
                  backdropFilter: 'blur(12px) saturate(140%)',
                  WebkitBackdropFilter: 'blur(12px) saturate(140%)',
                  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.18)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                }}
              >
                <div className="relative z-10 flex items-center justify-center p-1 rounded-lg shrink-0">
                  <span className="text-2xl leading-none">🥳</span>
                </div>
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
                  style={{ color: '#064589', fontSize: '20px', fontWeight: 500 }}
                >
                  ×
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence> */}

      {/* Main Content Container */}
      <div className="relative flex flex-col min-h-screen px-6 py-0 pb-12 max-w-xl mx-auto">
        {/* Header Section with Back Button */}
        <div className="flex items-center pt-6 pb-0 mb-8">
          <button
            onClick={() => navigate('/ai-chat')}
            className="p-2 -ml-2 hover:bg-white/20 rounded-lg transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5 text-[#39597d]" />
          </button>
          <h1 className="flex-1 text-center text-[32px] font-bold text-[#39597d] leading-[1.076] pr-9">
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
              <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-500 flex-shrink-0 mt-0.4" />
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
              <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.4" />
              <div>
                <p className="font-medium text-yellow-900 dark:text-yellow-100">Checkout Canceled</p>
                <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-1">
                  No worries! You can select a plan whenever you're ready.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Benefits Section - Only shown in horizontal layout */}
        {!isVerticalLayout && (
        <div className="flex flex-col gap-0 mb-6 h-[280px] relative overflow-hidden">
          {selectedPlanName && plans ? (() => {
            const selectedPlan = plans.find(p => p.plan_name === selectedPlanName);
            const features = selectedPlan?.features;
            const isStructured = features && typeof features === 'object' && !Array.isArray(features) && 'items' in features;
            
            return isStructured ? (
              <div className="px-3 py-1">
                <div className="space-y-3">
                  {features.items.slice(0, 3).map((item, idx) => {
                    // Default icons based on index if icon property doesn't exist
                    const defaultIcons = [Sparkles, Users, Target];
                    const IconComponent = item.icon ? getFeatureIcon(item.icon) : defaultIcons[idx];
                    return (
                      <div key={idx} className="flex items-start">
                        <div className="w-16 h-16 flex items-center justify-center overflow-hidden rounded-lg shrink-0">
                          <div className="w-12 h-12 rounded-lg flex items-start justify-center -mt-3">
                            <IconComponent className="w-6 h-6 text-orange-500" />
                          </div>
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
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="px-3 py-1 space-y-3">
                {(features as string[])?.slice(0, 3).map((feature, idx) => {
                  const defaultIcons = [CheckCircle2, Star, Zap];
                  const IconComponent = defaultIcons[idx] || CheckCircle2;
                  return (
                    <div key={idx} className="flex gap-[10px] items-start">
                      <div className="w-16 h-[63px] bg-white flex items-center justify-center overflow-hidden rounded-lg shrink-0">
                        <div className="w-12 h-12 bg-gradient-to-br from-orange-200 to-pink-300 rounded-lg flex items-center justify-center">
                          <IconComponent className="w-6 h-6 text-orange-600" />
                        </div>
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
                  );
                })}
              </div>
            );
          })() : (
            <div className="px-8 py-3 space-y-3">
              {[1, 2, 3].map((idx) => {
                const placeholderIcons = [Sparkles, Star, Trophy];
                const IconComponent = placeholderIcons[idx - 1];
                return (
                  <div key={idx} className="flex gap-[10px] items-start">
                    <div className="w-16 h-[63px] bg-white flex items-center justify-center overflow-hidden rounded-lg shrink-0">
                      <div className="w-12 h-12 bg-gradient-to-br from-orange-200 to-pink-300 rounded-lg flex items-center justify-center">
                        <IconComponent className="w-6 h-6 text-orange-600" />
                      </div>
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
                );
              })}
            </div>
          )}
        </div>
        )}

        {/* Plan Selection Section */}
        <div className="flex flex-col gap-4 px-0 py-[3px] flex-1">
          {/* Section Title */}
          {/* <div className="flex justify-center items-center w-full">
            <p className="text-[16px] font-semibold text-black">
              Choose the plan fits your needs
            </p>
          </div> */}

          {/* Tabs Component */}
          <div className="flex justify-center w-full px-4 sm:px-8 md:px-[60px]">
            <div className="w-full bg-muted rounded-md p-2 relative">
              {/* Discount badge - show only on annual */}
              {billingCycle === 'annual' && (
                <Badge 
                  variant="default" 
                  className="absolute -top-2 -right-4 bg-blue-500 hover:rotate-6 text-white text-[10px] px-1 py-0.4 shadow-sm z-20 rotate-[20deg]"
                >
                  -34%
                </Badge>
              )}
              {/* Sliding background */}
              <motion.div
                className="absolute top-1 bottom-1 bg-background rounded-sm shadow-sm"
                initial={false}
                animate={{
                  left: showWeeklyPlan 
                    ? (billingCycle === 'weekly' ? '8px' : billingCycle === 'monthly' ? 'calc(33.33% + 4px)' : 'calc(66.66% + 2px)')
                    : (billingCycle === 'monthly' ? '8px' : 'calc(50% + 4px)'),
                  width: showWeeklyPlan ? 'calc(33.33% - 8px)' : 'calc(50% - 8px)',
                }}
                transition={{
                  type: 'spring',
                  stiffness: 500,
                  damping: 30,
                }}
              />
              
              {/* Tab buttons */}
              <div className="relative flex">
                {showWeeklyPlan && (
                  <button
                    onClick={() => {
                      setBillingCycle('weekly');
                      trackEvent('subscription_billing_cycle_changed', {
                        variant: isVerticalLayout ? 'vertical' : 'horizontal',
                        billing_cycle: 'weekly',
                        selected_plan: selectedPlanName,
                      });
                    }}
                    className={cn(
                      "flex-1 px-3 py-1.4 text-sm font-medium rounded-sm transition-colors relative z-10",
                      billingCycle === 'weekly' ? 'text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    Weekly
                  </button>
                )}
                <button
                  onClick={() => {
                    setBillingCycle('monthly');
                    trackEvent('subscription_billing_cycle_changed', {
                      variant: isVerticalLayout ? 'vertical' : 'horizontal',
                      billing_cycle: 'monthly',
                      selected_plan: selectedPlanName,
                    });
                  }}
                  className={cn(
                    "flex-1 px-3 py-1.4 text-sm font-medium rounded-sm transition-colors relative z-10",
                    billingCycle === 'monthly' ? 'text-foreground' : 'text-muted-foreground'
                  )}
                >
                  Monthly
                </button>
                <button
                  onClick={() => {
                    setBillingCycle('annual');
                    trackEvent('subscription_billing_cycle_changed', {
                      variant: isVerticalLayout ? 'vertical' : 'horizontal',
                      billing_cycle: 'annual',
                      selected_plan: selectedPlanName,
                    });
                  }}
                  className={cn(
                    "flex-1 px-3 py-1.4 text-sm font-medium rounded-sm transition-colors relative z-10",
                    billingCycle === 'annual' ? 'text-foreground' : 'text-muted-foreground'
                  )}
                >
                  Annual
                </button>
              </div>
            </div>
          </div>

          {/* Plan Cards - Centered */}
          <div className={cn(
            "flex justify-center px-6 py-4 plan-cards-container",
            isVerticalLayout ? "flex-col gap-4 items-stretch" : "flex-row gap-6"
          )}>
            {plans?.map((plan) => {
              // Calculate display price based on billing cycle
              const monthlyPrice = billingCycle === 'annual'
                ? plan.monthly_equivalent_cents / 100
                : billingCycle === 'weekly'
                ? plan.price_cents / 100  // For weekly, show the weekly price directly
                : plan.price_cents / 100; // For monthly, show the monthly price
              const isSelected = selectedPlan === plan.id;
              
              // Check if trial applies to this plan
              const eligibleForTrial = billingCycle === 'monthly' && 
                ['basic', 'premium'].includes(plan.plan_type.toLowerCase()) &&
                trialConfig !== null && 
                trialConfig !== undefined &&
                trialConfig.trial_days > 0;
              
              // Debug log for trial eligibility
              if (billingCycle === 'monthly') {
                console.log('[Trial Experiment] Plan eligibility check:', {
                  plan_name: plan.plan_name,
                  plan_type: plan.plan_type,
                  billing_cycle: billingCycle,
                  is_eligible_type: ['basic', 'premium'].includes(plan.plan_type.toLowerCase()),
                  has_trial_config: trialConfig !== null,
                  trial_config_value: trialConfig,
                  trial_days: trialConfig?.trial_days,
                  eligibleForTrial,
                  render_time: new Date().toISOString(),
                });
              }
              
              // Get features list
              const features = plan.features;
              const isStructured = features && typeof features === 'object' && !Array.isArray(features) && 'items' in features;
              const featuresList = isStructured ? features.items : (Array.isArray(features) ? features : []);

              return (
                <motion.div
                  key={plan.id}
                  onClick={() => {
                    setSelectedPlan(plan.id);
                    setSelectedPlanName(plan.plan_name);
                    // Save user's manual selection for this billing cycle
                    setUserSelections(prev => ({
                      ...prev,
                      [billingCycle]: plan.plan_name,
                    }));
                    trackEvent('subscription_plan_selected', {
                      variant: isVerticalLayout ? 'vertical' : 'horizontal',
                      plan_name: plan.plan_name,
                      billing_cycle: billingCycle,
                      price: monthlyPrice,
                    });
                  }}
                  className={cn(
                    'flex-shrink-0 snap-center bg-white rounded-2xl flex flex-col shadow-[0px_2px_15px_0px_rgba(0,0,0,0.1)] cursor-pointer relative border-2',
                    isVerticalLayout ? 'w-full p-6 gap-4' : 'w-1/2 p-4 gap-[14px]',
                    isSelected ? 'border-[#78b9ff] shadow-[0px_0px_8px_0px_rgba(0,122,255,0.4)]' : 'border-transparent'
                  )}
                  whileTap={{ scale: 0.98 }}
                  transition={{
                    type: 'spring',
                    stiffness: 400,
                    damping: 17,
                  }}
                >
                  {isSelected && !isVerticalLayout && (
                    <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[hsl(var(--brand-blue))] flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                  
                  {/* Compact horizontal card (Version A) */}
                  {!isVerticalLayout && (
                    <>
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
                          <div className="flex items-baseline gap-0.4">
                            <span className="text-[18px] font-semibold text-black">
                              ${monthlyPrice.toFixed(2)}
                            </span>
                            <span className="text-[12px] font-medium text-black">/</span>
                            <span className="text-[12px] font-normal text-black">
                              {billingCycle === 'weekly' ? 'wk' : 'mo'}
                            </span>
                          </div>
                          {eligibleForTrial ? (
                            <span className="text-[12px] font-medium text-blue-500">
                              {trialConfig!.trial_days}-day free trial
                            </span>
                          ) : (
                            <span className='text-[12px] font-normal text-gray-500'>
                              {billingCycle === 'weekly' ? 'billed weekly' : billingCycle === 'annual' ? 'billed yearly' : 'billed monthly'}
                            </span>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                  
                  {/* Full detailed vertical card (Version B) */}
                  {isVerticalLayout && (
                    <>
                      {/* Plan name at top */}
                      <div className="flex items-center gap-2">
                        {plan.plan_name === 'Unlimited' ? (
                          <Infinity className="w-4 h-4 text-gray-700" />
                        ) : plan.plan_name === 'Premium' ? (
                          <ChessQueen className="w-4 h-4 text-gray-700" />
                        ) : (
                          <Crown className="w-4 h-4 text-gray-700" />
                        )}
                        <p className={cn(
                          "text-[18px] font-semibold",
                          plan.plan_name === 'Premium' 
                            ? 'text-blue-500' 
                            : 'text-black'
                        )}>
                          {plan.plan_name}
                        </p>
                      </div>
                      
                      {/* Price and plan name at top */}
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="flex items-baseline gap-1">
                            <span className="text-[20px] font-semibold text-black leading-none">
                              ${billingCycle === 'annual' 
                                ? (plan.price_cents / 100).toFixed(2)
                                : monthlyPrice.toFixed(2)}
                            </span>
                            <span className="text-[14px] text-gray-600">
                              / {billingCycle === 'weekly' ? 'week' : billingCycle === 'annual' ? 'year' : 'month'}
                            </span>
                          </div>
                          {eligibleForTrial && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 border border-green-200 rounded-md text-[12px] font-medium text-green-700">
                              <Sparkles className="w-3 h-3 text-green-600" />
                              {trialConfig!.trial_days}-day free trial
                            </span>
                          )}
                        </div>
                        {/* <p className="text-[14px] text-gray-700 font-normal">
                          {plan.plan_name} monthly usage
                        </p> */}
                      </div>
                      
                      {/* Get started button inside card */}
                      <Button
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent card click
                          trackEvent('subscription_checkout_started', {
                            variant: 'vertical',
                            plan_name: plan.plan_name,
                            billing_cycle: billingCycle,
                            price: monthlyPrice,
                          });
                          handleSelectPlan(plan.stripe_price_id, plan.id);
                        }}
                        className="w-full bg-[#111] hover:bg-[#222] text-white text-[15px] font-normal rounded-xl"
                      >
                        Get started
                      </Button>
                      
                      {/* Features list */}
                      <div className="flex flex-col gap-3 pt-2">
                        {isStructured ? (
                          featuresList.map((item: any, idx: number) => {
                            // Map feature names to appropriate icons
                            const getFeatureIcon = (name: string) => {
                              const nameLower = name.toLowerCase();
                              if (nameLower.includes('voice') || nameLower.includes('speak') || nameLower.includes('ai voice')) {
                                return <Mic className="w-4 h-4 text-gray-700 flex-shrink-0 mt-0.4" />;
                              } else if (nameLower.includes('feedback') || nameLower.includes('personalized')) {
                                return <MessageSquare className="w-4 h-4 text-gray-700 flex-shrink-0 mt-0.4" />;
                              } else if (nameLower.includes('vocabulary') || nameLower.includes('word')) {
                                return <BookOpen className="w-4 h-4 text-gray-700 flex-shrink-0 mt-0.4" />;
                              } else if (nameLower.includes('tracking') || nameLower.includes('progress') || nameLower.includes('analytics')) {
                                return <BarChart className="w-4 h-4 text-gray-700 flex-shrink-0 mt-0.4" />;
                              } else if (nameLower.includes('unlimited') || nameLower.includes('credits')) {
                                return <Infinity className="w-4 h-4 text-gray-700 flex-shrink-0 mt-0.4" />;
                              } else if (nameLower.includes('ai') || nameLower.includes('smart') || nameLower.includes('intelligent')) {
                                return <Sparkles className="w-4 h-4 text-gray-700 flex-shrink-0 mt-0.4" />;
                              } else if (nameLower.includes('pronunciation') || nameLower.includes('accent')) {
                                return <Volume2 className="w-4 h-4 text-gray-700 flex-shrink-0 mt-0.4" />;
                              } else if (nameLower.includes('conversation') || nameLower.includes('chat')) {
                                return <Users className="w-4 h-4 text-gray-700 flex-shrink-0 mt-0.4" />;
                              } else if (nameLower.includes('fluency') || nameLower.includes('goal') || nameLower.includes('target')) {
                                return <Target className="w-4 h-4 text-gray-700 flex-shrink-0 mt-0.4" />;
                              } else if (nameLower.includes('learning') || nameLower.includes('coach') || nameLower.includes('adaptive')) {
                                return <Brain className="w-4 h-4 text-gray-700 flex-shrink-0 mt-0.4" />;
                              } else if (nameLower.includes('language') || nameLower.includes('translation')) {
                                return <Globe className="w-4 h-4 text-gray-700 flex-shrink-0 mt-0.4" />;
                              } else if (nameLower.includes('improve') || nameLower.includes('boost')) {
                                return <TrendingUp className="w-4 h-4 text-gray-700 flex-shrink-0 mt-0.4" />;
                              } else {
                                return <Zap className="w-4 h-4 text-gray-700 flex-shrink-0 mt-0.4" />;
                              }
                            };
                            
                            return (
                              <div key={idx} className="flex items-start gap-2">
                                {getFeatureIcon(item.name)}
                                <span className="text-[14px] text-gray-800 leading-tight">
                                  {item.name}
                                </span>
                              </div>
                            );
                          })
                        ) : (
                          (featuresList as string[]).map((feature: string, idx: number) => {
                            // Map feature names to appropriate icons
                            const getFeatureIcon = (name: string) => {
                              const nameLower = name.toLowerCase();
                              if (nameLower.includes('voice') || nameLower.includes('speak') || nameLower.includes('ai voice')) {
                                return <Mic className="w-4 h-4 text-gray-700 flex-shrink-0 mt-0.4" />;
                              } else if (nameLower.includes('feedback') || nameLower.includes('personalized')) {
                                return <MessageSquare className="w-4 h-4 text-gray-700 flex-shrink-0 mt-0.4" />;
                              } else if (nameLower.includes('vocabulary') || nameLower.includes('word')) {
                                return <BookOpen className="w-4 h-4 text-gray-700 flex-shrink-0 mt-0.4" />;
                              } else if (nameLower.includes('tracking') || nameLower.includes('progress') || nameLower.includes('analytics')) {
                                return <BarChart className="w-4 h-4 text-gray-700 flex-shrink-0 mt-0.4" />;
                              } else if (nameLower.includes('unlimited') || nameLower.includes('credits')) {
                                return <Infinity className="w-4 h-4 text-gray-700 flex-shrink-0 mt-0.4" />;
                              } else if (nameLower.includes('ai') || nameLower.includes('smart') || nameLower.includes('intelligent')) {
                                return <Sparkles className="w-4 h-4 text-gray-700 flex-shrink-0 mt-0.4" />;
                              } else if (nameLower.includes('pronunciation') || nameLower.includes('accent')) {
                                return <Volume2 className="w-4 h-4 text-gray-700 flex-shrink-0 mt-0.4" />;
                              } else if (nameLower.includes('conversation') || nameLower.includes('chat')) {
                                return <Users className="w-4 h-4 text-gray-700 flex-shrink-0 mt-0.4" />;
                              } else if (nameLower.includes('fluency') || nameLower.includes('goal') || nameLower.includes('target')) {
                                return <Target className="w-4 h-4 text-gray-700 flex-shrink-0 mt-0.4" />;
                              } else if (nameLower.includes('learning') || nameLower.includes('coach') || nameLower.includes('adaptive')) {
                                return <Brain className="w-4 h-4 text-gray-700 flex-shrink-0 mt-0.4" />;
                              } else if (nameLower.includes('language') || nameLower.includes('translation')) {
                                return <Globe className="w-4 h-4 text-gray-700 flex-shrink-0 mt-0.4" />;
                              } else if (nameLower.includes('improve') || nameLower.includes('boost')) {
                                return <TrendingUp className="w-4 h-4 text-gray-700 flex-shrink-0 mt-0.4" />;
                              } else {
                                return <Zap className="w-4 h-4 text-gray-700 flex-shrink-0 mt-0.4" />;
                              }
                            };
                            
                            return (
                              <div key={idx} className="flex items-start gap-3">
                                {getFeatureIcon(feature)}
                                <span className="text-[14px] text-gray-800 leading-normal">
                                  {feature}
                                </span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </>
                  )}
                </motion.div>
              );
            })}
          </div>
          
          {/* Trial message - shown when any plan has trial */}
          {billingCycle === 'monthly' && trialConfig && trialConfig.trial_days > 0 && (
            <div className="flex justify-center -mt-2">
              <p className="text-sm text-gray-400">
                You won't be charged today
              </p>
            </div>
          )}
        </div>

        {/* Continue Button - Only shown in horizontal layout */}
        {!isVerticalLayout && (
          <div className="mt-auto pt-2">
            <Button 
              onClick={() => {
                if (selectedPlan && plans) {
                  const plan = plans.find(p => p.id === selectedPlan);
                  if (plan) {
                    trackEvent('subscription_checkout_started', {
                      variant: isVerticalLayout ? 'vertical' : 'horizontal',
                      plan_name: plan.plan_name,
                      billing_cycle: billingCycle,
                      price: billingCycle === 'annual' ? plan.monthly_equivalent_cents / 100 : plan.price_cents / 100,
                    });
                    handleSelectPlan(plan.stripe_price_id, plan.id);
                  }
                }
              }}
              disabled={!selectedPlan}
              className="w-full h-12 bg-[#111] hover:bg-[#222] text-white text-[18px] font-medium rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <CreditCard className="w-4 h-4" />
              Subscribe
            </Button>
          </div>
        )}
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
