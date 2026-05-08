/**
 * Onboarding State Management
 * Tracks user progress through signup, onboarding, and subscription
 */

export type OnboardingStep =
  | 'pronunciation-assessment' // Pronunciation test
  | 'onboarding-age'        // Age selection
  | 'onboarding-native-language' // Native language
  | 'onboarding-speaking-confidence' // Speaking confidence
  | 'onboarding-current-learning' // Current learning methods
  | 'onboarding-daily-usage' // Daily English usage
  | 'onboarding-pain-points' // Speaking pain points
  | 'onboarding-motivation' // Why improve English
  | 'onboarding-goals'      // Learning goals
  | 'onboarding-interests'  // Interests
  | 'onboarding-preferences' // Preferences (CEFR level, etc)
  | 'email-entry'           // Email signup (after onboarding screens)
  | 'subscription-selection' // Choose a plan
  | 'subscription-payment'   // Payment in progress
  | 'email-verification'     // Waiting for email verification
  | 'completed';             // Fully onboarded

export interface OnboardingState {
  currentStep: OnboardingStep;
  email: string | null;
  hasCompletedOnboarding: boolean;
  hasActiveSubscription: boolean;
  userId: string | null;
  lastUpdated: number; // timestamp
}

const STORAGE_KEY = 'justai_onboarding_state';

/**
 * Get current onboarding state from localStorage
 */
export function getOnboardingState(): OnboardingState | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    
    const state = JSON.parse(stored) as OnboardingState;
    
    // Check if state is older than 7 days, if so, clear it
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    if (state.lastUpdated < sevenDaysAgo) {
      clearOnboardingState();
      return null;
    }
    
    return state;
  } catch (error) {
    console.error('Error reading onboarding state:', error);
    return null;
  }
}

/**
 * Save onboarding state to localStorage
 */
export function saveOnboardingState(state: Partial<OnboardingState>): void {
  try {
    const current = getOnboardingState();
    const updated: OnboardingState = {
      currentStep: state.currentStep ?? current?.currentStep ?? 'pronunciation-assessment',
      email: state.email ?? current?.email ?? null,
      hasCompletedOnboarding: state.hasCompletedOnboarding ?? current?.hasCompletedOnboarding ?? false,
      hasActiveSubscription: state.hasActiveSubscription ?? current?.hasActiveSubscription ?? false,
      userId: state.userId ?? current?.userId ?? null,
      lastUpdated: Date.now(),
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Error saving onboarding state:', error);
  }
}

/**
 * Clear onboarding state
 */
export function clearOnboardingState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing onboarding state:', error);
  }
}

/**
 * Update specific onboarding step
 */
export function updateOnboardingStep(step: OnboardingStep): void {
  saveOnboardingState({ currentStep: step });
}

/**
 * Mark onboarding as completed
 */
export function markOnboardingComplete(): void {
  saveOnboardingState({ 
    hasCompletedOnboarding: true,
    currentStep: 'subscription-selection'
  });
}

/**
 * Mark subscription as active
 */
export function markSubscriptionActive(): void {
  saveOnboardingState({ 
    hasActiveSubscription: true,
    currentStep: 'email-verification'
  });
}

/**
 * Get the next route based on onboarding state
 */
export function getResumeRoute(state: OnboardingState): string {
  // If fully completed, go to app
  if (state.hasCompletedOnboarding && state.hasActiveSubscription) {
    return '/email-verification';
  }
  
  // If completed onboarding but no subscription
  if (state.hasCompletedOnboarding && !state.hasActiveSubscription) {
    return '/subscription-plans';
  }
  
  // Resume at current step
  switch (state.currentStep) {
    case 'pronunciation-assessment':
      return '/onboarding/pronunciation';
    case 'onboarding-age':
      return '/onboarding/age';
    case 'onboarding-native-language':
      return '/onboarding/native-language';
    case 'onboarding-speaking-confidence':
      return '/onboarding/speaking-confidence';
    case 'onboarding-current-learning':
      return '/onboarding/current-learning';
    case 'onboarding-daily-usage':
      return '/onboarding/daily-usage';
    case 'onboarding-pain-points':
      return '/onboarding/pain-points';
    case 'onboarding-motivation':
      return '/onboarding/motivation';
    case 'onboarding-goals':
      return '/onboarding/goals';
    case 'onboarding-interests':
      return '/onboarding/interests';
    case 'onboarding-preferences':
      return '/onboarding/preferences';
    case 'email-entry':
      return '/login';
    case 'subscription-selection':
    case 'subscription-payment':
      return '/subscription-plans';
    case 'email-verification':
      return '/email-verification';
    case 'completed':
      return '/ai-chat';
    default:
      return '/welcome';
  }
}

/**
 * Check if user should be redirected to continue onboarding
 */
export function shouldResumeOnboarding(): { shouldResume: boolean; route: string } {
  const state = getOnboardingState();
  
  if (!state || state.currentStep === 'completed') {
    return { shouldResume: false, route: '/welcome' };
  }
  
  return {
    shouldResume: true,
    route: getResumeRoute(state),
  };
}

// ========================================
// PRICING VARIANT PERSISTENCE
// ========================================

/**
 * Valid pricing variants for A/B testing
 */
export type PricingVariant = 'control' | 'plan-a' | 'plan-b';

const PRICING_VARIANT_KEY = 'justai_pricing_variant';

/**
 * Check if a value is a valid pricing variant
 */
export function isValidPricingVariant(value: string | null): value is PricingVariant {
  return value !== null && ['control', 'plan-a', 'plan-b'].includes(value);
}

/**
 * Save pricing variant from landing page URL
 * This should be called when user first lands on the welcome page
 */
export function savePricingVariant(variant: PricingVariant): void {
  try {
    localStorage.setItem(PRICING_VARIANT_KEY, variant);
    console.log('[Pricing Variant] Saved to localStorage:', variant);
  } catch (error) {
    console.error('Error saving pricing variant:', error);
  }
}

/**
 * Get stored pricing variant from localStorage
 * Returns null if not found or invalid
 */
export function getPricingVariant(): PricingVariant | null {
  try {
    const stored = localStorage.getItem(PRICING_VARIANT_KEY);
    if (stored && isValidPricingVariant(stored)) {
      return stored;
    }
    return null;
  } catch (error) {
    console.error('Error reading pricing variant:', error);
    return null;
  }
}

/**
 * Clear stored pricing variant
 * Should be called after successful subscription
 */
export function clearPricingVariant(): void {
  try {
    localStorage.removeItem(PRICING_VARIANT_KEY);
    console.log('[Pricing Variant] Cleared from localStorage');
  } catch (error) {
    console.error('Error clearing pricing variant:', error);
  }
}
