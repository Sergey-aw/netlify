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
import { saveOnboardingState } from '@/lib/onboarding-state';
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

      // Step 1: Sign in anonymously for immediate onboarding access
      const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously({
        options: {
          data: {
            email: trimmedEmail, // Store email in anonymous user metadata
            role: 'student',
            pending_email_verification: true, // Flag to indicate email needs verification
          }
        }
      });
      
      if (anonError) throw anonError;
      if (!anonData.user) throw new Error('No user returned from anonymous sign in');
      
      // Step 2: Update the anonymous user's email (this sends verification email)
      // This will upgrade the anonymous user to an email user once they verify
      const { error: updateError } = await supabase.auth.updateUser({
        email: trimmedEmail,
      }, {
        emailRedirectTo: `${window.location.origin}/auth/setup-password`,
      });

      if (updateError) throw updateError;
      
      console.log('Anonymous user created and email verification sent:', {
        userId: anonData.user.id,
        email: trimmedEmail,
        note: 'User will be upgraded to email user after verification'
      });
      
      // Store the email for onboarding
      saveOnboardingEmail(trimmedEmail);
      localStorage.setItem('justai_pending_email', trimmedEmail);
      
      // Save onboarding state
      saveOnboardingState({
        currentStep: 'onboarding-goals',
        email: trimmedEmail,
        hasCompletedOnboarding: false,
        hasActiveSubscription: false,
        userId: anonData.user.id,
      });
      
      console.log('User can continue onboarding immediately and will receive email to set password');

      // User now has an active anonymous session and will receive email verification
      // After verification, they can set their password
      // All data (profile, subscription, etc.) will remain with the same user ID
      // Navigate to onboarding goals (pronunciation already completed)
      navigate('/onboarding/goals');
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
