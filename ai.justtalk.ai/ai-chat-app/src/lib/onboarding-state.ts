/**
 * Onboarding State Management
 * Tracks user progress through signup, onboarding, and subscription
 */

export type OnboardingStep = 
  | 'email-entry'           // Initial email entry
  | 'onboarding-goals'      // Step 1: Learning goals
  | 'onboarding-interests'  // Step 2: Interests
  | 'onboarding-preferences' // Step 3: Preferences (CEFR level, etc)
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
      currentStep: state.currentStep ?? current?.currentStep ?? 'email-entry',
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
    case 'email-entry':
      return '/login';
    case 'onboarding-goals':
      return '/onboarding/goals';
    case 'onboarding-interests':
      return '/onboarding/interests';
    case 'onboarding-preferences':
      return '/onboarding/preferences';
    case 'subscription-selection':
    case 'subscription-payment':
      return '/subscription-plans';
    case 'email-verification':
      return '/email-verification';
    case 'completed':
      return '/ai-chat';
    default:
      return '/login';
  }
}

/**
 * Check if user should be redirected to continue onboarding
 */
export function shouldResumeOnboarding(): { shouldResume: boolean; route: string } {
  const state = getOnboardingState();
  
  if (!state || state.currentStep === 'completed') {
    return { shouldResume: false, route: '/login' };
  }
  
  return {
    shouldResume: true,
    route: getResumeRoute(state),
  };
}
