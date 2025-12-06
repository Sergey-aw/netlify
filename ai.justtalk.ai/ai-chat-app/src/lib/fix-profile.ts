import { supabase } from './supabase';

/**
 * Fix missing profile for current user
 * Call this from browser console if profile wasn't created during signup
 */
export async function fixCurrentUserProfile() {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.user) {
    console.error('No active session');
    return;
  }

  const email = localStorage.getItem('justai_pending_email') || 
                localStorage.getItem('justai_onboarding_email');

  if (!email) {
    console.error('No email found in localStorage');
    return;
  }

  console.log('Fixing profile for user:', {
    userId: session.user.id,
    email: email
  });

  const { data, error } = await supabase
    .from('profiles')
    .upsert({
      id: session.user.id,
      email: email,
      role: 'student',
      justai_onboarding_completed: false,
    }, {
      onConflict: 'id'
    })
    .select()
    .single();

  if (error) {
    console.error('Error fixing profile:', error);
  } else {
    console.log('Profile fixed successfully:', data);
  }
}

// Expose to window for easy console access
if (typeof window !== 'undefined') {
  (window as any).fixProfile = fixCurrentUserProfile;
}
