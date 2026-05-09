import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trackOnboardingStep } from '@/lib/posthog';

const TOTAL_STEPS = 15;
const CURRENT_STEP = 5;

export default function OnboardingRetentionStats() {
  const navigate = useNavigate();

  useEffect(() => {
    trackOnboardingStep('retention-stats', 'started');
  }, []);

  const handleContinue = () => {
    trackOnboardingStep('retention-stats', 'completed');
    navigate('/onboarding/daily-usage');
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
        <p className="text-gray-500 text-lg font-medium mb-2">You'll remember</p>
        <h1 className="text-6xl font-black text-gray-900 mb-4">1.5x more</h1>
        <p className="text-gray-500 text-center text-sm mb-10 max-w-xs">
          Active recall leads to better 1-week retention than passive studying
        </p>

        {/* Chart Card */}
        <div className="w-full max-w-sm bg-gray-50 rounded-3xl p-6">
          <p className="text-sm font-medium text-gray-600 mb-6">Remember after 1 week</p>

          <div className="flex items-end justify-center gap-12 mb-6">
            {/* Passive bar */}
            <div className="flex flex-col items-center">
              <span className="text-sm font-semibold text-gray-400 mb-2">40%</span>
              <div className="w-16 h-24 rounded-xl bg-gray-200" />
              <span className="text-xs text-gray-500 mt-2">Passive studying</span>
            </div>

            {/* JustTalk bar */}
            <div className="flex flex-col items-center">
              <span className="text-sm font-semibold text-blue-600 mb-2">61%</span>
              <div className="w-16 h-36 rounded-xl bg-gradient-to-b from-blue-400 to-blue-600" />
              <span className="text-xs text-blue-600 font-medium mt-2">JustTalk</span>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
              <span className="text-blue-500 text-sm font-bold">&raquo;</span>
            </div>
            <p className="text-xs text-gray-500">
              JustTalk conversations train active recall in real time.
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
          Continue
        </Button>
      </div>
    </div></div>
  );
}
