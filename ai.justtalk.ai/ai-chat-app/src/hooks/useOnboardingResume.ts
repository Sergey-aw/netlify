import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSession } from './useSession';
import { useSubscription } from './useSubscription';
import { getOnboardingState, saveOnboardingState, markSubscriptionActive } from '@/lib/onboarding-state';

/**
 * Hook to manage onboarding resume logic
 * Automatically redirects users to their last onboarding step
 */
export function useOnboardingResume() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useSession();
  const { hasActiveSubscription, isLoading: subscriptionLoading } = useSubscription();

  useEffect(() => {
    // Don't run on initial mount or if already on auth pages
    if (!isAuthenticated || subscriptionLoading) return;
    
    // Don't redirect if on specific pages
    const noRedirectPages = [
      '/login',
      '/signin',
      '/onboarding/goals',
      '/onboarding/interests',
      '/onboarding/preferences',
      '/subscription-plans',
      '/subscription-status',
      '/email-verification',
      '/ai-chat',
      '/ai-chat/voice',
      '/ai-chat/conversation',
      '/profile',
      '/dictionary',
      '/role-plays',
    ];
    
    if (noRedirectPages.some(path => location.pathname.startsWith(path))) {
      return;
    }

    const state = getOnboardingState();
    
    // Update subscription status in state if it changed
    if (hasActiveSubscription && state && !state.hasActiveSubscription) {
      markSubscriptionActive();
    }
    
    // If state exists and user is not fully onboarded, resume onboarding
    if (state && (!state.hasCompletedOnboarding || !state.hasActiveSubscription)) {
      let resumeRoute: string | null = null;
      
      // Determine where to resume
      if (!state.hasCompletedOnboarding) {
        // Resume onboarding at last step
        switch (state.currentStep) {
          case 'email-entry':
            resumeRoute = '/login';
            break;
          case 'onboarding-goals':
            resumeRoute = '/onboarding/goals';
            break;
          case 'onboarding-interests':
            resumeRoute = '/onboarding/interests';
            break;
          case 'onboarding-preferences':
            resumeRoute = '/onboarding/preferences';
            break;
          default:
            resumeRoute = '/subscription-plans';
        }
      } else if (!state.hasActiveSubscription && !hasActiveSubscription) {
        // Onboarding complete but no subscription
        resumeRoute = '/subscription-plans';
      } else if (hasActiveSubscription && !state.hasActiveSubscription) {
        // Has subscription but hasn't verified email
        resumeRoute = '/email-verification';
      }
      
      if (resumeRoute && resumeRoute !== location.pathname) {
        console.log('Resuming onboarding at:', resumeRoute);
        navigate(resumeRoute);
      }
    }
    
    // Update user ID in state if changed
    if (user && state && state.userId !== user.id) {
      saveOnboardingState({ userId: user.id });
    }
    
  }, [isAuthenticated, hasActiveSubscription, subscriptionLoading, navigate, location.pathname, user]);
}
