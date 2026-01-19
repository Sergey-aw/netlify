import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { clearTempAuth } from '@/lib/session';
import { Loader2, Eye, EyeOff } from 'lucide-react';

export default function SetupPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [isPasswordReset, setIsPasswordReset] = useState(false);

  useEffect(() => {
    // Check if we have verification parameters OR an active session
    const code = searchParams.get('code');
    const tokenHash = searchParams.get('token_hash');
    const type = searchParams.get('type');
    
    // Check if this is a password recovery flow
    if (type === 'recovery' || type === 'password_recovery') {
      setIsPasswordReset(true);
    }
    
    // Also check URL hash (Supabase sometimes uses hash fragments)
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const hashCode = hashParams.get('code');
    const hashTokenHash = hashParams.get('token_hash');
    const hashType = hashParams.get('type');
    
    if (hashType === 'recovery' || hashType === 'password_recovery') {
      setIsPasswordReset(true);
    }
    const hashAccessToken = hashParams.get('access_token');
    
    console.log('Setup password params:', { 
      query: { code, tokenHash, type },
      hash: { hashCode, hashTokenHash, hashType, hashAccessToken },
      fullUrl: window.location.href 
    });
    
    // Check for active session as a fallback
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!code && !tokenHash && !hashCode && !hashTokenHash && !hashAccessToken && !session) {
        setError('Invalid verification link - missing required parameters');
      } else if (session || hashAccessToken) {
        console.log('User has active session or access token, proceeding with password setup');
        // Clear the error if we have a valid session
        setError('');
      }
    });
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      setLoading(false);
      return;
    }

    try {
      // Handle different token formats from Supabase
      const code = searchParams.get('code');
      const tokenHash = searchParams.get('token_hash');
      const type = searchParams.get('type');
      
      // Check if user already has a session (came from temp password login)
      const { data: { session } } = await supabase.auth.getSession();
      
      if (code) {
        // PKCE flow - exchange code for session
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) throw exchangeError;
      } else if (tokenHash && type) {
        // Token hash flow - verify OTP
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type as any,
        });
        if (verifyError) throw verifyError;
      } else if (!session) {
        // No verification parameters and no active session
        throw new Error('Invalid verification link - missing required parameters');
      }
      // If we have a session but no verification params, that's okay
      // User might have logged in with temp password and is now setting permanent password

      // Update user password and metadata
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
        data: {
          full_name: name,
          temp_password: false, // Mark that permanent password is set
        }
      });

      if (updateError) throw updateError;

      // Get user and update profile
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      // Find the anonymous user's onboarding data if it exists
      const pendingEmail = localStorage.getItem('justai_pending_email');
      const emailUserIdFromAnon = localStorage.getItem('justai_email_user_id');
      
      console.log('Setup password - linking accounts:', {
        currentUserId: user.id,
        linkedAnonUserId: emailUserIdFromAnon,
        pendingEmail
      });

      // Update profile with name and role
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: name,
          role: 'student',
          email: user.email, // Ensure email is set
        })
        .eq('id', user.id);

      if (profileError) {
        console.error('Profile update error:', profileError);
        // Don't throw - profile might already exist with correct data
      }

      // Try to get onboarding data from localStorage
      // Data might be stored under the email key from the anonymous session
      const emailKey = user.email?.toLowerCase();
      const onboardingData = localStorage.getItem('justai_onboarding_data') || 
                            localStorage.getItem(`justai_onboarding_data_${emailKey}`);
      const preferencesData = localStorage.getItem('justai_onboarding_preferences') ||
                             localStorage.getItem(`justai_onboarding_preferences_${emailKey}`);
      
      console.log('Looking for onboarding data:', {
        email: emailKey,
        hasData: !!onboardingData,
        hasPrefs: !!preferencesData,
      });
      
      // If this is a password reset (not initial signup), skip onboarding data transfer
      if (isPasswordReset) {
        console.log('Password reset flow - skipping onboarding data transfer');
        // Just redirect to main app
        navigate('/ai-chat');
        return;
      }
      
      if (onboardingData || preferencesData) {
        const data = JSON.parse(onboardingData || '{}');
        const prefs = JSON.parse(preferencesData || '{}');
        
        console.log('Found onboarding data to transfer:', { data, prefs });
        
        // Update profile with onboarding data
        await supabase
          .from('profiles')
          .update({
            learning_goals: data.goals || [],
            interests: data.interests || [],
            cefr_level: prefs.cefrLevel,
            justai_correction_style: prefs.correctionStyle,
            justai_onboarding_completed: true,
          })
          .eq('id', user.id);

        // Create agent config
        await supabase
          .from('justai_agent_configs')
          .upsert({
            student_id: user.id,
            learning_goals: data.goals || [],
            interests: data.interests || [],
            cefr_level: prefs.cefrLevel || 'B1',
            correction_style: prefs.correctionStyle || 'balanced',
            system_prompt_template: 'default',
            onboarding_completed: true,
          });

        // Clear all variations of localStorage keys
        localStorage.removeItem('justai_onboarding_data');
        localStorage.removeItem('justai_onboarding_preferences');
        localStorage.removeItem(`justai_onboarding_data_${emailKey}`);
        localStorage.removeItem(`justai_onboarding_preferences_${emailKey}`);
        localStorage.removeItem('justai_onboarding_email');
        localStorage.removeItem('justai_pending_email');
        localStorage.removeItem('justai_email_user_id');
        clearTempAuth(); // Clear temporary password
      } else {
        console.log('No onboarding data found - user may need to complete onboarding');
      }

      // Check if user has active subscription
      const { data: subscription } = await supabase
        .from('justai_subscriptions')
        .select('id, status')
        .eq('student_id', user.id)
        .eq('status', 'active')
        .single();

      // Redirect based on subscription status
      if (subscription) {
        navigate('/ai-chat');
      } else {
        navigate('/subscription/plans');
      }
    } catch (err) {
      console.error('Setup password error:', err);
      setError(err instanceof Error ? err.message : 'Failed to set up password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{isPasswordReset ? 'Reset Your Password' : 'Set Up Your Account'}</CardTitle>
          <CardDescription>
            {isPasswordReset 
              ? 'Enter your new password below' 
              : 'Choose a password to secure your account'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isPasswordReset && (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Your Name
                </label>
                <Input
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Password
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter password"
                  value={password}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">At least 8 characters</p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Confirm Password
              </label>
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? 'Setting up...' : 'Complete Setup'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
