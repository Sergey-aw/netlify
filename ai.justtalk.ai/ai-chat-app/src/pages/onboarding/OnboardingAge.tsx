import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trackOnboardingStep } from '@/lib/posthog';

const ageGroups = [
  { id: 'under-20', label: '<20' },
  { id: '20s', label: '20s' },
  { id: '30s', label: '30s' },
  { id: '40s', label: '40s' },
  { id: '50s', label: '50s' },
  { id: '60-plus', label: '60+' },
];

const TOTAL_STEPS = 8;
const CURRENT_STEP = 1;

export default function OnboardingAge() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState('');

  useEffect(() => {
    trackOnboardingStep('age', 'started');
    const saved = JSON.parse(localStorage.getItem('justai_onboarding_data') || '{}');
    if (saved.ageGroup) setSelected(saved.ageGroup);
  }, []);

  const handleSelect = (id: string) => {
    setSelected(id);

    const saved = JSON.parse(localStorage.getItem('justai_onboarding_data') || '{}');
    saved.ageGroup = id;
    localStorage.setItem('justai_onboarding_data', JSON.stringify(saved));

    trackOnboardingStep('age', 'completed', { age_group: id });

    setTimeout(() => navigate('/onboarding/daily-usage'), 200);
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          What is your age?
        </h1>
        <p className="text-gray-500 mb-8">
          Each age group learns differently. We'll adapt your practice to work best for you.
        </p>

        <div className="grid grid-cols-3 gap-3">
          {ageGroups.map((age) => (
            <button
              key={age.id}
              onClick={() => handleSelect(age.id)}
              className={cn(
                'py-8 rounded-2xl border-2 text-xl font-semibold transition-all',
                selected === age.id
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              )}
            >
              {age.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
