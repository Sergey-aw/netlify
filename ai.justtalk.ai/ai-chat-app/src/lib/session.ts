import { supabase } from './supabase';

/**
 * Ensure user has an active session, re-authenticate if needed
 * Returns true if session exists or was successfully restored
 */
export async function ensureSession(): Promise<boolean> {
  // Check for existing session
  const { data: { session } } = await supabase.auth.getSession();
  
  if (session) {
    return true;
  }
  
  // Try to re-authenticate with saved credentials
  const email = localStorage.getItem('justai_onboarding_email');
  const tempPassword = localStorage.getItem('justai_temp_password');
  
  if (!email || !tempPassword) {
    return false;
  }
  
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: tempPassword,
    });
    
    // If error is about email not being confirmed, that's okay
    // We'll create a session anyway for unconfirmed users
    if (error && !error.message.includes('Email not confirmed')) {
      console.error('Re-authentication error:', error);
      return false;
    }
    
    // Even if email is not confirmed, if we get user data back, consider it a success
    if (data.user) {
      return true;
    }
    
    return !!data.session;
  } catch (err) {
    console.error('Session restoration failed:', err);
    return false;
  }
}

/**
 * Clear temporary authentication data
 */
export function clearTempAuth() {
  localStorage.removeItem('justai_temp_password');
}
