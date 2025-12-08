import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { saveOnboardingEmail } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { checkEmailExists } from '@/lib/justai-api';
import { Loader2 } from 'lucide-react';
import { saveOnboardingState } from '@/lib/onboarding-state';

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create Your Account</CardTitle>
          <CardDescription>
            Enter your email to get started. We'll send you a link to set up your password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                type="email"
                placeholder="your.email@example.com"
                value={email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
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
              {loading ? 'Creating Account...' : 'Continue'}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm text-gray-600">
            <p>You can complete onboarding while we verify your email</p>
            <div className="mt-2">
              <span>Already have an account? </span>
              <Link to="/signin" className="text-blue-600 hover:text-blue-700 font-medium">
                Sign In
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
