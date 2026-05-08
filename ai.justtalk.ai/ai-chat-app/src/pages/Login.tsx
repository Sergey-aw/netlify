import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { saveOnboardingEmail } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { checkEmailExists } from '@/lib/justai-api';
import { Loader2, AlertCircle } from 'lucide-react';
import { saveOnboardingState, markOnboardingComplete } from '@/lib/onboarding-state';
import { trackEmailEntered } from '@/lib/posthog';
import Logo from '@/assets/logo.svg';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Check if email already exists using edge function
      const { exists } = await checkEmailExists(email);

      if (exists) {
        // User already exists, redirect to sign in
        setError('An account with this email already exists. Please sign in instead.');
        setLoading(false);
        setTimeout(() => {
          navigate('/signin');
        }, 2000);
        return;
      }

      const trimmedEmail = email.trim().toLowerCase();

      // Get existing anonymous session or create one
      const { data: { session } } = await supabase.auth.getSession();
      let userId: string;

      if (session?.user) {
        userId = session.user.id;
      } else {
        const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously({
          options: {
            data: {
              role: 'student',
            }
          }
        });
        if (anonError) throw anonError;
        if (!anonData.user) throw new Error('No user returned from anonymous sign in');
        userId = anonData.user.id;
      }

      // Update the anonymous user's email (sends verification email)
      const { error: updateError } = await supabase.auth.updateUser({
        email: trimmedEmail,
        data: {
          email: trimmedEmail,
          role: 'student',
          pending_email_verification: true,
        },
      }, {
        emailRedirectTo: `${window.location.origin}/auth/setup-password`,
      });

      if (updateError) throw updateError;

      console.log('Email verification sent for anonymous user:', {
        userId,
        email: trimmedEmail,
      });
      
      // Store the email for onboarding
      saveOnboardingEmail(trimmedEmail);
      localStorage.setItem('justai_pending_email', trimmedEmail);

      // Track email entry in PostHog
      trackEmailEntered(trimmedEmail, true);

      // Save onboarding data to database now that we have a user
      const onboardingData = JSON.parse(localStorage.getItem('justai_onboarding_data') || '{}');
      const preferences = JSON.parse(localStorage.getItem('justai_onboarding_preferences') || '{}');

      const profileUpdate: Record<string, unknown> = {
        justai_onboarding_completed: true,
      };
      if (onboardingData.goals) profileUpdate.learning_goals = onboardingData.goals;
      if (onboardingData.interests) profileUpdate.interests = onboardingData.interests;
      if (preferences.cefrLevel) profileUpdate.cefr_level = preferences.cefrLevel;
      if (preferences.correctionStyle) profileUpdate.justai_correction_style = preferences.correctionStyle;
      if (preferences.voicePreference) profileUpdate.justai_preferred_voice = preferences.voicePreference;

      await supabase
        .from('profiles')
        .update(profileUpdate)
        .eq('id', userId);

      // Create agent config
      await supabase
        .from('justai_agent_configs')
        .upsert({
          student_id: userId,
          learning_goals: onboardingData.goals || [],
          interests: onboardingData.interests || [],
          cefr_level: preferences.cefrLevel || '',
          correction_style: preferences.correctionStyle || 'balanced',
          system_prompt_template: 'default',
          onboarding_completed: true,
        });

      // Mark onboarding as complete
      markOnboardingComplete();

      // Save onboarding state
      saveOnboardingState({
        currentStep: 'subscription-selection',
        email: trimmedEmail,
        hasCompletedOnboarding: true,
        hasActiveSubscription: false,
        userId: userId,
      });

      console.log('User can continue to subscription and will receive email to set password');

      navigate('/subscription-plans');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign up');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#F5F5F5] p-4">
      <Card className="w-full max-w-[480px] shadow-sm">
        <CardContent className="pt-12 pb-8 px-8">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <img src={Logo} alt="JustTalk" className="h-12" />
          </div>

          {/* Title */}
          <h1 className="text-center text-[#666666] text-lg font-normal mb-2">
            Create your JustTalk account
          </h1>
          <p className="text-center text-muted-foreground text-sm mb-10">
            Enter your email to get started. We'll send you a link to set up your password.
          </p>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email field */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="m@example.com"
                disabled={loading}
                required
              />
            </div>

            {/* Error message */}
            {error && (
              <div className="flex items-center space-x-2 text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            {/* Continue button */}
            <Button
              type="submit"
              className="w-full bg-[hsl(var(--brand-blue))] hover:bg-[hsl(var(--brand-blue))]/90 text-white"
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? 'Creating Account...' : 'Continue'}
            </Button>
          </form>

          {/* Info text */}
          <p className="mt-6 text-center text-sm text-muted-foreground">
            You can complete onboarding while we verify your email
          </p>

          {/* Sign in link */}
          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">Already have an account? </span>
            <Link to="/signin" className="text-foreground underline font-medium hover:no-underline">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="fixed bottom-6 left-0 right-0 text-center text-xs text-muted-foreground">
        <span>By clicking continue, you agree to our </span>
        <Link to="/terms" className="underline hover:no-underline">
          Terms of Service
        </Link>
        <span> and </span>
        <Link to="/privacy" className="underline hover:no-underline">
          Privacy Policy
        </Link>
        <span>.</span>
      </div>
    </div>
  );
}
