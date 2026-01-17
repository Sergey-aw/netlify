import posthog from 'posthog-js';

let isInitialized = false;

// Initialize PostHog
export const initPostHog = () => {
  if (isInitialized) {
    return posthog;
  }

  const apiKey = import.meta.env.VITE_POSTHOG_API_KEY;
  const host = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

  if (!apiKey) {
    console.warn('PostHog API key not found. Analytics disabled.');
    return null;
  }

  try {
    posthog.init(apiKey, {
      api_host: host,
      defaults: '2025-05-24',
      capture_exceptions: true,    // Enable Error Tracking
      debug: import.meta.env.DEV,   // Enable debug in development
      person_profiles: 'identified_only', // Only create profiles for identified users
      capture_pageview: false,      // We'll manually track page views
      capture_pageleave: true,
      // Enable feature flags
      bootstrap: {
        featureFlags: {},
      },
    });

    isInitialized = true;

    // Expose posthog to window for debugging in development
    if (import.meta.env.DEV) {
      (window as any).posthog = posthog;
      console.log('PostHog initialized and exposed to window.posthog for debugging');
    }
  } catch (error) {
    console.error('Failed to initialize PostHog:', error);
    return null;
  }

  return posthog;
};

// Safe getter for posthog instance
export const getPostHog = () => {
  try {
    // Ensure PostHog is initialized before returning
    if (!isInitialized) {
      initPostHog();
    }
    return posthog;
  } catch {
    return null;
  }
};

// User identification
export const identifyUser = (userId: string, properties?: Record<string, any>) => {
  const ph = getPostHog();
  if (ph) {
    ph.identify(userId, properties);
  }
};

// Page view tracking
export const trackPageView = (pageName: string, properties?: Record<string, any>) => {
  const ph = getPostHog();
  if (ph) {
    ph.capture('$pageview', {
      $current_url: window.location.href,
      page_name: pageName,
      ...properties,
    });
  }
};

// Welcome Flow Events
export const trackWelcomeStep = (step: 'progress' | 'features' | 'sync', properties?: Record<string, any>) => {
  const ph = getPostHog();
  if (ph) {
    ph.capture('welcome_step_viewed', {
      step,
      ...properties,
    });
  }
};

export const trackWelcomeCompleted = () => {
  const ph = getPostHog();
  if (ph) {
    ph.capture('welcome_flow_completed');
  }
};

// Email Entry Event
export const trackEmailEntered = (email: string, isNewUser: boolean = true) => {
  const ph = getPostHog();
  if (ph) {
    ph.capture('email_entered', {
      email,
      is_new_user: isNewUser,
    });
    // Also identify the user with their email
    ph.identify(email, {
      email,
    });
  }
};

// Onboarding Events
export const trackOnboardingStep = (
  step: 'pronunciation' | 'goals' | 'interests' | 'preferences',
  action: 'started' | 'completed',
  properties?: Record<string, any>
) => {
  const ph = getPostHog();
  if (ph) {
    ph.capture('onboarding_step', {
      step,
      action,
      ...properties,
    });
  }
};

export const trackPronunciationAssessment = (score?: number, properties?: Record<string, any>) => {
  const ph = getPostHog();
  if (ph) {
    ph.capture('pronunciation_assessment_completed', {
      score,
      ...properties,
    });
  }
};

export const trackOnboardingCompleted = (properties?: Record<string, any>) => {
  const ph = getPostHog();
  if (ph) {
    ph.capture('onboarding_completed', properties);
  }
};

// Paywall/Subscription Events
export const trackPaywallViewed = (billingCycle?: 'monthly' | 'annual') => {
  const ph = getPostHog();
  if (ph) {
    ph.capture('paywall_viewed', { billing_cycle: billingCycle });
  }
};

export const trackPlanSelected = (
  planType: string,
  priceId: string,
  priceCents: number,
  billingPeriod: 'monthly' | 'annual',
  properties?: Record<string, any>
) => {
  const ph = getPostHog();
  if (ph) {
    ph.capture('plan_selected', {
      plan_type: planType,
      price_id: priceId,
      price_cents: priceCents,
      price_usd: (priceCents / 100).toFixed(2),
      billing_period: billingPeriod,
      ...properties,
    });
  }
};

export const trackCheckoutStarted = (
  planType: string,
  priceId: string,
  priceCents: number,
  billingPeriod: 'monthly' | 'annual'
) => {
  const ph = getPostHog();
  if (ph) {
    ph.capture('checkout_started', {
      plan_type: planType,
      price_id: priceId,
      price_cents: priceCents,
      price_usd: (priceCents / 100).toFixed(2),
      billing_period: billingPeriod,
    });
  }
};

export const trackSubscriptionActivated = (
  subscriptionType: string,
  priceId: string,
  priceCents: number,
  billingPeriod: 'monthly' | 'annual',
  stripeSubscriptionId?: string
) => {
  const ph = getPostHog();
  if (ph) {
    ph.capture('subscription_activated', {
      subscription_type: subscriptionType,
      price_id: priceId,
      price_cents: priceCents,
      price_usd: (priceCents / 100).toFixed(2),
      billing_period: billingPeriod,
      stripe_subscription_id: stripeSubscriptionId,
    });
    
    // Set user properties for subscription
    ph.people?.set({
      subscription_type: subscriptionType,
      subscription_status: 'active',
      billing_period: billingPeriod,
    });
  }
};

export const trackSubscriptionCancelled = () => {
  const ph = getPostHog();
  if (ph) {
    ph.capture('subscription_cancelled');
    ph.people?.set({
      subscription_status: 'cancelled',
    });
  }
};

export const trackSubscriptionUpgraded = (
  oldPlan: string,
  newPlan: string,
  priceDifferenceCents: number
) => {
  const ph = getPostHog();
  if (ph) {
    ph.capture('subscription_upgraded', {
      old_plan: oldPlan,
      new_plan: newPlan,
      price_difference_cents: priceDifferenceCents,
      price_difference_usd: (priceDifferenceCents / 100).toFixed(2),
    });
  }
};

// Voice Interaction Events
export const trackVoiceSessionStarted = (
  agentId: string,
  agentName: string,
  scenario: string,
  conversationId: string
) => {
  const ph = getPostHog();
  if (ph) {
    ph.capture('voice_session_started', {
      agent_id: agentId,
      agent_name: agentName,
      scenario,
      conversation_id: conversationId,
    });
  }
};

export const trackVoiceSessionEnded = (
  agentId: string,
  agentName: string,
  scenario: string,
  conversationId: string,
  durationSeconds: number,
  messageCount: number,
  elevenLabsConvId?: string
) => {
  const ph = getPostHog();
  if (ph) {
    ph.capture('voice_session_ended', {
      agent_id: agentId,
      agent_name: agentName,
      scenario,
      conversation_id: conversationId,
      duration_seconds: durationSeconds,
      duration_minutes: Math.round(durationSeconds / 60),
      message_count: messageCount,
      elevenlabs_conversation_id: elevenLabsConvId,
    });
  }
};

export const trackVoiceSessionProcessed = (
  conversationId: string,
  voiceSessionId: string,
  totalCostCents: number,
  charactersProcessed: number,
  durationSeconds: number
) => {
  const ph = getPostHog();
  if (ph) {
    ph.capture('voice_session_processed', {
      conversation_id: conversationId,
      voice_session_id: voiceSessionId,
      total_cost_cents: totalCostCents,
      total_cost_usd: (totalCostCents / 100).toFixed(4),
      characters_processed: charactersProcessed,
      duration_seconds: durationSeconds,
    });
  }
};

export const trackAgentSelected = (agentId: string, agentName: string, scenario: string) => {
  const ph = getPostHog();
  if (ph) {
    ph.capture('agent_selected', {
      agent_id: agentId,
      agent_name: agentName,
      scenario,
    });
  }
};

// General Event Tracking
export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
  const ph = getPostHog();
  if (ph) {
    ph.capture(eventName, properties);
  }
};

export { posthog };