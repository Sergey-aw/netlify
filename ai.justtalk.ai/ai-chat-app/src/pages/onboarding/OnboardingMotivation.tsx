import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trackOnboardingStep } from '@/lib/posthog';

const motivations = [
  { id: 'work', icon: '🎯', label: 'Speak confidently at work' },
  { id: 'new-job', icon: '💼', label: 'Find a new job' },
  { id: 'abroad', icon: '🌍', label: 'Live comfortably abroad' },
  { id: 'travel', icon: '✈️', label: 'Travel with ease' },
  { id: 'skills', icon: '🚀', label: 'Expand my skills' },
  { id: 'connect', icon: '🫶', label: 'Connect with family & friends' },
];

const TOTAL_STEPS = 15;
const CURRENT_STEP = 8;

export default function OnboardingMotivation() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState('');

  useEffect(() => {
    trackOnboardingStep('motivation', 'started');
    const saved = JSON.parse(localStorage.getItem('justai_onboarding_data') || '{}');
    if (saved.motivation) setSelected(saved.motivation);
  }, []);

  const handleSelect = (id: string) => {
    setSelected(id);

    const saved = JSON.parse(localStorage.getItem('justai_onboarding_data') || '{}');
    saved.motivation = id;
    localStorage.setItem('justai_onboarding_data', JSON.stringify(saved));

    trackOnboardingStep('motivation', 'completed', { motivation: id });

    setTimeout(() => navigate('/onboarding/motivation-stats'), 200);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
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
          Why do you want to{'\n'}improve your English?
        </h1>

        <div className="space-y-3">
          {motivations.map((option) => (
            <button
              key={option.id}
              onClick={() => handleSelect(option.id)}
              className={cn(
                'w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left',
                selected === option.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              )}
            >
              <span className="text-2xl">{option.icon}</span>
              <span className="flex-1 font-medium text-gray-900">{option.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
