import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { saveOnboardingEmail } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { checkEmailExists } from '@/lib/justai-api';
import { Loader2, AlertCircle, Lock, Mail, Shield } from 'lucide-react';
import { saveOnboardingState } from '@/lib/onboarding-state';
import { trackEmailEntered } from '@/lib/posthog';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [wantsTips, setWantsTips] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { exists } = await checkEmailExists(email);

      if (exists) {
        setError('An account with this email already exists. Please sign in instead.');
        setLoading(false);
        setTimeout(() => navigate('/signin'), 2000);
        return;
      }

      const trimmedEmail = email.trim().toLowerCase();

      const { data: { session } } = await supabase.auth.getSession();
      let userId: string;

      if (session?.user) {
        userId = session.user.id;
      } else {
        const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously({
          options: { data: { role: 'student' } }
        });
        if (anonError) throw anonError;
        if (!anonData.user) throw new Error('No user returned from anonymous sign in');
        userId = anonData.user.id;
      }

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

      saveOnboardingEmail(trimmedEmail);
      localStorage.setItem('justai_pending_email', trimmedEmail);

      trackEmailEntered(trimmedEmail, true);

      // Save available onboarding data to profile now
      const onboardingData = JSON.parse(localStorage.getItem('justai_onboarding_data') || '{}');
      const preferences = JSON.parse(localStorage.getItem('justai_onboarding_preferences') || '{}');

      const profileUpdate: Record<string, unknown> = {
        email: trimmedEmail,
      };
      if (onboardingData.name) {
        profileUpdate.name = onboardingData.name;
        profileUpdate.display_name = onboardingData.name;
      }
      if (onboardingData.nativeLanguage) profileUpdate.native_language = onboardingData.nativeLanguage;
      if (preferences.cefrLevel) profileUpdate.cefr_level = preferences.cefrLevel;
      if (wantsTips) profileUpdate.justai_wants_tips = true;

      await supabase.from('profiles').update(profileUpdate).eq('id', userId);

      saveOnboardingState({
        currentStep: 'onboarding-vocab-result',
        email: trimmedEmail,
        userId: userId,
      });

      navigate('/onboarding/vocab-result');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign up');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Blurred results preview */}
      <div className="relative pt-12 pb-8">
        <div className="blur-md opacity-40 pointer-events-none px-6">
          <p className="text-center text-gray-500 text-sm mb-1">Your vocabulary level</p>
          <h2 className="text-center text-3xl font-bold text-gray-900 mb-1">Intermediate</h2>
          <p className="text-center text-gray-400 text-sm">24 of 40 words</p>

          <div className="flex gap-1.5 mt-4 max-w-xs mx-auto">
            {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((level, i) => (
              <div key={level} className="flex-1 flex flex-col items-center gap-1">
                <div className={`w-full h-2 rounded-full ${i <= 2 ? 'bg-blue-500' : 'bg-gray-200'}`} />
                <span className="text-xs text-gray-400">{level}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Divider line */}
        <div className="border-t border-gray-100 mt-6" />
      </div>

      {/* Unlock section */}
      <div className="flex-1 flex flex-col items-center px-6">
        <Lock className="w-10 h-10 text-blue-500 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
          Unlock your full assessment
        </h1>
        <p className="text-gray-500 text-center text-sm mb-6">
          Enter your email to see your detailed English analysis.
        </p>

        {/* Privacy note */}
        <div className="w-full max-w-sm bg-gray-50 rounded-2xl px-4 py-3 flex items-start gap-3 mb-6">
          <Shield className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-gray-500">
            Your privacy is our priority. Your data is securely stored and never shared.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
          {/* Email input */}
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              disabled={loading}
              required
              autoFocus
              className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-gray-200 bg-white text-gray-900 text-base placeholder:text-gray-400 focus:border-blue-500 focus:outline-none transition-colors"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Submit */}
          <Button
            type="submit"
            size="lg"
            className="w-full py-6 text-lg rounded-2xl"
            disabled={loading || !email.trim()}
          >
            {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
            {loading ? 'Creating Account...' : 'Show My Results'}
          </Button>

          {/* Tips checkbox */}
          <label className="flex items-center justify-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={wantsTips}
              onChange={(e) => setWantsTips(e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-500">I want learning tips and updates</span>
          </label>
        </form>

        {/* Sign in link */}
        <div className="mt-6 text-center text-sm">
          <span className="text-gray-400">Already have an account? </span>
          <Link to="/signin" className="text-gray-900 underline font-medium hover:no-underline">
            Sign in
          </Link>
        </div>
      </div>

      {/* Footer */}
      <div className="py-4 text-center text-xs text-gray-400">
        <span>By continuing, you agree to our </span>
        <Link to="/terms" className="underline hover:no-underline">Terms</Link>
        <span> and </span>
        <Link to="/privacy" className="underline hover:no-underline">Privacy Policy</Link>
      </div>
    </div>
  );
}
