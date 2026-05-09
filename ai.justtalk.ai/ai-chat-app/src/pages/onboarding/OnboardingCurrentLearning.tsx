import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { trackOnboardingStep } from '@/lib/posthog';

const learningMethods = [
  { id: 'classes', icon: '📚', label: 'Classes or courses' },
  { id: 'apps', icon: '🎯', label: 'Learning apps' },
  { id: 'videos', icon: '🎬', label: 'Videos or movies' },
  { id: 'podcasts', icon: '🎧', label: 'Podcasts or audiobooks' },
  { id: 'speaking', icon: '🤝', label: 'Speaking with others' },
  { id: 'not-learning', icon: '❌', label: 'Not learning right now' },
];

const TOTAL_STEPS = 15;
const CURRENT_STEP = 4;

export default function OnboardingCurrentLearning() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    trackOnboardingStep('current-learning', 'started');
    const saved = JSON.parse(localStorage.getItem('justai_onboarding_data') || '{}');
    if (saved.currentLearning) setSelected(saved.currentLearning);
  }, []);

  const toggle = (id: string) => {
    if (id === 'not-learning') {
      setSelected((prev) => (prev.includes('not-learning') ? [] : ['not-learning']));
      return;
    }
    setSelected((prev) => {
      const without = prev.filter((i) => i !== 'not-learning');
      return without.includes(id) ? without.filter((i) => i !== id) : [...without, id];
    });
  };

  const handleContinue = () => {
    if (selected.length === 0) return;

    const saved = JSON.parse(localStorage.getItem('justai_onboarding_data') || '{}');
    saved.currentLearning = selected;
    localStorage.setItem('justai_onboarding_data', JSON.stringify(saved));

    trackOnboardingStep('current-learning', 'completed', {
      current_learning_selected: selected.length,
      current_learning: selected,
    });

    navigate('/onboarding/retention-stats');
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
          How are you currently improving your English?
        </h1>
        <p className="text-gray-500 mb-8">Select all that apply.</p>

        <div className="space-y-3">
          {learningMethods.map((method) => (
            <button
              key={method.id}
              onClick={() => toggle(method.id)}
              className={cn(
                'w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left',
                selected.includes(method.id)
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              )}
            >
              <span className="text-2xl">{method.icon}</span>
              <span className="flex-1 font-medium text-gray-900">{method.label}</span>
              <div
                className={cn(
                  'w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all',
                  selected.includes(method.id)
                    ? 'bg-blue-500 border-blue-500'
                    : 'border-gray-300'
                )}
              >
                {selected.includes(method.id) && (
                  <Check className="w-4 h-4 text-white" />
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Bottom Button */}
      <div className="px-4 py-6">
        <Button
          onClick={handleContinue}
          disabled={selected.length === 0}
          size="lg"
          className="w-full py-6 text-lg rounded-2xl"
        >
          Continue
        </Button>
      </div>
    </div></div>
  );
}
