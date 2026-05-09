import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trackOnboardingStep } from '@/lib/posthog';

const confidenceLevels = [
  { id: 'anxious', icon: '😰', label: 'I get anxious and start sweating' },
  { id: 'freeze', icon: '🥶', label: 'I freeze and forget words' },
  { id: 'avoid', icon: '🙈', label: 'I avoid speaking if possible' },
  { id: 'embarrassed', icon: '😬', label: 'I speak, but feel embarrassed' },
  { id: 'confident', icon: '😎', label: 'I feel confident enough' },
];

const TOTAL_STEPS = 15;
const CURRENT_STEP = 3;

export default function OnboardingSpeakingConfidence() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState('');

  useEffect(() => {
    trackOnboardingStep('speaking-confidence', 'started');
    const saved = JSON.parse(localStorage.getItem('justai_onboarding_data') || '{}');
    if (saved.speakingConfidence) setSelected(saved.speakingConfidence);
  }, []);

  const handleSelect = (id: string) => {
    setSelected(id);

    const saved = JSON.parse(localStorage.getItem('justai_onboarding_data') || '{}');
    saved.speakingConfidence = id;
    localStorage.setItem('justai_onboarding_data', JSON.stringify(saved));

    trackOnboardingStep('speaking-confidence', 'completed', { speaking_confidence: id });

    setTimeout(() => navigate('/onboarding/current-learning'), 200);
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
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          How do you feel when you need to speak English?
        </h1>

        <div className="grid grid-cols-2 gap-3">
          {confidenceLevels.map((level, index) => (
            <button
              key={level.id}
              onClick={() => handleSelect(level.id)}
              className={cn(
                'p-5 rounded-2xl border-2 transition-all text-left',
                index === confidenceLevels.length - 1 ? 'col-span-1' : '',
                selected === level.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              )}
            >
              <span className="text-3xl block mb-3">{level.icon}</span>
              <span className="font-medium text-gray-900 text-sm leading-snug">{level.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div></div>
  );
}
