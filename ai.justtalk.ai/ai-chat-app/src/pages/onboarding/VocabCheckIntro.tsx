import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { updateOnboardingStep } from '@/lib/onboarding-state';
import { trackOnboardingStep } from '@/lib/posthog';

const TOTAL_STEPS = 15;
const CURRENT_STEP = 10;

export default function VocabCheckIntro() {
  const navigate = useNavigate();

  useEffect(() => {
    trackOnboardingStep('vocab-intro', 'started');
    updateOnboardingStep('onboarding-vocab-intro');
  }, []);

  const handleContinue = () => {
    trackOnboardingStep('vocab-intro', 'completed');
    navigate('/onboarding/name');
  };

  return (
    <div className="min-h-screen bg-white flex justify-center"><div className="w-full max-w-md flex flex-col">
      {/* Header */}
      <div className="px-4 py-6">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${(CURRENT_STEP / TOTAL_STEPS) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="w-20 h-20 rounded-3xl bg-blue-100 flex items-center justify-center mb-6">
          <span className="text-4xl">📚</span>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 text-center mb-3">
          Let's check your vocabulary!
        </h1>

        <p className="text-gray-500 text-center text-base mb-4 max-w-sm">
          We'll show you 40 English words. Tap the ones you know — it takes about a minute.
        </p>

        <div className="w-full max-w-sm bg-gray-50 rounded-2xl p-5 mt-4">
          <div className="flex items-start gap-3">
            <span className="text-gray-400 text-lg mt-0.5">💡</span>
            <p className="text-sm text-gray-500">
              This helps us estimate your current level and personalize conversations to match your vocabulary.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Button */}
      <div className="px-4 py-6">
        <Button
          onClick={handleContinue}
          size="lg"
          className="w-full py-6 text-lg rounded-2xl"
        >
          Start
        </Button>
      </div>
    </div></div>
  );
}
