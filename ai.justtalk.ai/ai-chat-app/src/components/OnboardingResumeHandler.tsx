import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/hooks/useSession';
import { useSubscription } from '@/hooks/useSubscription';
import { shouldResumeOnboarding } from '@/lib/onboarding-state';
import { supabase } from '@/lib/supabase';

/**
 * Component to handle onboarding resume logic and main route redirects on app load
 * Place this inside AuthProvider but outside Routes
 */
export function OnboardingResumeHandler() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isAnonymous, loading: authLoading } = useSession();
  const { hasActiveSubscription, isLoading: subLoading } = useSubscription();
  const [_isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Wait for auth and subscription to load
    if (authLoading || subLoading) {
      setIsChecking(true);
      return;
    }

    // Don't redirect if user is on auth pages (setup password, callback, etc.)
    const currentPath = window.location.pathname;
    const isAuthPage = currentPath.startsWith('/auth/') || 
                       currentPath === '/login' || 
                       currentPath === '/signin';
    
    if (isAuthPage) {
      console.log('[OnboardingResume] Skipping redirect - user is on auth page:', currentPath);
      setIsChecking(false);
      return;
    }

    // Only check root path redirect once per session
    const hasChecked = sessionStorage.getItem('justai_onboarding_checked');
    
    // Skip check if already checked AND not on root path
    if (hasChecked && currentPath !== '/') {
      setIsChecking(false);
      return;
    }

    // Mark as checked to avoid repeated redirects
    sessionStorage.setItem('justai_onboarding_checked', 'true');

    // Check if user has completed onboarding
    const checkOnboardingAndRedirect = async () => {
      if (!user) {
        console.log('[OnboardingResume] No user - checking for incomplete onboarding');
        
        // If on root path and no user, show welcome screen
        if (currentPath === '/') {
          console.log('[OnboardingResume] Redirecting to welcome screen');
          setIsChecking(false);
          navigate('/welcome');
          return;
        }
        
        const { shouldResume } = shouldResumeOnboarding();
        if (shouldResume) {
          console.log('[OnboardingResume] User needs to sign in');
          setIsChecking(false);
          navigate('/login');
        } else {
          setIsChecking(false);
        }
        return;
      }

      // If user is logged in (non-anonymous) and on root path, check if they've completed onboarding
      if (isAuthenticated && !isAnonymous && currentPath === '/') {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('justai_onboarding_completed')
            .eq('id', user.id)
            .single();

          if (profile?.justai_onboarding_completed) {
            console.log('[OnboardingResume] User completed onboarding - redirecting to /ai-chat');
            navigate('/ai-chat', { replace: true });
            setIsChecking(false);
            return;
          }
        } catch (error) {
          console.error('[OnboardingResume] Error checking onboarding status:', error);
        }
      }

      // Check if we need to resume incomplete onboarding
      const { shouldResume, route } = shouldResumeOnboarding();
      if (shouldResume && isAuthenticated) {
        console.log('[OnboardingResume] Resuming onboarding at:', route);
        navigate(route);
      } else if (shouldResume && !isAuthenticated) {
        console.log('[OnboardingResume] User needs to sign in');
        navigate('/login');
      }
      setIsChecking(false);
    };

    checkOnboardingAndRedirect();
  }, [user, isAuthenticated, isAnonymous, authLoading, hasActiveSubscription, subLoading, navigate]);

  return null; // This component doesn't render anything
}
