import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { getOnboardingData, completeOnboarding, clearOnboardingData } from '@/lib/auth';
import { Loader2 } from 'lucide-react';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'error' | 'success'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Exchange code for session
        const code = searchParams.get('code');
        if (!code) {
          setErrorMessage('Invalid authentication link');
          setStatus('error');
          return;
        }

        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) throw exchangeError;

        // Get user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!user) {
          setErrorMessage('User not found');
          setStatus('error');
          return;
        }

        // Check if profile exists
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('justai_onboarding_completed')
          .eq('id', user.id)
          .single();

        // If profile doesn't exist, create it
        if (!existingProfile) {
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: user.id,
              justai_onboarding_completed: false,
            });

          if (profileError) throw profileError;
        }

        // Check if there's onboarding data in localStorage
        const onboardingData = getOnboardingData();
        const hasOnboardingData = Object.keys(onboardingData).length > 0;

        // If user has onboarding data in localStorage and hasn't completed onboarding
        if (hasOnboardingData && !existingProfile?.justai_onboarding_completed) {
          await completeOnboarding(user.id, onboardingData);
          setStatus('success');
          setTimeout(() => navigate('/ai-chat'), 1500);
        } 
        // If user already completed onboarding
        else if (existingProfile?.justai_onboarding_completed) {
          clearOnboardingData();
          setStatus('success');
          setTimeout(() => navigate('/ai-chat'), 1500);
        }
        // If user hasn't completed onboarding and no localStorage data - start onboarding
        else {
          setStatus('success');
          setTimeout(() => navigate('/onboarding/goals'), 1500);
        }
      } catch (err) {
        console.error('Auth callback error:', err);
        setErrorMessage(err instanceof Error ? err.message : 'Authentication failed');
        setStatus('error');
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50">
        <Loader2 className="h-12 w-12 animate-spin text-purple-600 mb-4" />
        <p className="text-lg text-gray-700">Signing you in...</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50 p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <div className="text-red-600 text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Authentication Error</h2>
          <p className="text-gray-600 mb-6">{errorMessage}</p>
          <button
            onClick={() => navigate('/login')}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
        <div className="text-green-600 text-5xl mb-4">✓</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Success!</h2>
        <p className="text-gray-600">Redirecting you...</p>
      </div>
    </div>
  );
}
