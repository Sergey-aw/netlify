import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { updateOnboardingStep } from '@/lib/onboarding-state';
import { trackOnboardingStep } from '@/lib/posthog';

const TOTAL_STEPS = 15;
const CURRENT_STEP = 11;

export default function OnboardingName() {
  const navigate = useNavigate();
  const [name, setName] = useState('');

  useEffect(() => {
    trackOnboardingStep('name', 'started');
    updateOnboardingStep('onboarding-name');
    const saved = JSON.parse(localStorage.getItem('justai_onboarding_data') || '{}');
    if (saved.name) setName(saved.name);
  }, []);

  const handleContinue = () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const saved = JSON.parse(localStorage.getItem('justai_onboarding_data') || '{}');
    saved.name = trimmed;
    localStorage.setItem('justai_onboarding_data', JSON.stringify(saved));

    trackOnboardingStep('name', 'completed', { name: trimmed });
    navigate('/onboarding/vocab-check');
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
      <div className="flex-1 px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          What should we call you?
        </h1>
        <p className="text-gray-500 mb-6">
          Let's make sure we've got your name right.
        </p>

        <div className="relative">
          <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleContinue()}
            placeholder="Name"
            autoFocus
            className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-gray-200 bg-white text-gray-900 text-base placeholder:text-gray-400 focus:border-blue-500 focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Bottom Button */}
      <div className="px-4 py-6">
        <Button
          onClick={handleContinue}
          disabled={!name.trim()}
          size="lg"
          className="w-full py-6 text-lg rounded-2xl"
        >
          Continue
        </Button>
      </div>
    </div></div>
  );
}
