import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

/**
 * Hook to access session and related utilities
 * 
 * @example
 * const { session, user, isAnonymous, getAccessToken, isAuthenticated } = useSession();
 * 
 * if (isAnonymous) {
 *   // Handle anonymous user
 * }
 */
export function useSession() {
  const { session, user, loading } = useAuth();

  /**
   * Get current access token
   * Returns null if no session
   */
  const getAccessToken = (): string | null => {
    return session?.access_token ?? null;
  };

  /**
   * Check if user is anonymous
   */
  const isAnonymous = user?.is_anonymous ?? false;

  /**
   * Check if user is authenticated (has any session)
   */
  const isAuthenticated = !!session && !!user;

  /**
   * Check if user is fully authenticated (not anonymous)
   */
  const isFullyAuthenticated = isAuthenticated && !isAnonymous;

  /**
   * Get user email
   * For anonymous users, check profiles table or localStorage
   */
  const getEmail = async (): Promise<string | null> => {
    // Check auth user email first
    if (user?.email) {
      return user.email;
    }

    // For anonymous users, check profiles table
    if (isAnonymous && user?.id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', user.id)
        .single();
      
      if (profile?.email) {
        return profile.email;
      }
    }

    // Fallback to localStorage
    return localStorage.getItem('justai_pending_email');
  };

  /**
   * Check if session is expiring soon (within 5 minutes)
   */
  const isSessionExpiringSoon = (): boolean => {
    if (!session?.expires_at) return false;
    
    const expiresAt = new Date(session.expires_at * 1000);
    const now = new Date();
    const fiveMinutes = 5 * 60 * 1000;
    
    return (expiresAt.getTime() - now.getTime()) < fiveMinutes;
  };

  /**
   * Manually refresh the session
   * Usually not needed as Supabase auto-refreshes
   */
  const refreshSession = async () => {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
      console.error('Failed to refresh session:', error);
      return null;
    }
    return data.session;
  };

  return {
    session,
    user,
    loading,
    isAnonymous,
    isAuthenticated,
    isFullyAuthenticated,
    getAccessToken,
    getEmail,
    isSessionExpiringSoon,
    refreshSession,
  };
}
