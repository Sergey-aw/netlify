import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { trackOnboardingStep } from '@/lib/posthog';

const painPoints = [
  { id: 'freeze', icon: '😰', label: 'I freeze when I speak' },
  { id: 'express', icon: '🎯', label: "I can't express myself" },
  { id: 'accent', icon: '🗣', label: "My accent isn't clear" },
  { id: 'grammar', icon: '🙉', label: 'I make grammar mistakes' },
  { id: 'reply-slow', icon: '🐌', label: "I can't reply quickly" },
  { id: 'none', icon: '🚫', label: 'None of the above' },
];

const TOTAL_STEPS = 8;
const CURRENT_STEP = 3;

export default function OnboardingPainPoints() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    trackOnboardingStep('pain-points', 'started');
    const saved = JSON.parse(localStorage.getItem('justai_onboarding_data') || '{}');
    if (saved.painPoints) setSelected(saved.painPoints);
  }, []);

  const toggle = (id: string) => {
    if (id === 'none') {
      setSelected((prev) => (prev.includes('none') ? [] : ['none']));
      return;
    }
    setSelected((prev) => {
      const without = prev.filter((i) => i !== 'none');
      return without.includes(id) ? without.filter((i) => i !== id) : [...without, id];
    });
  };

  const handleContinue = () => {
    if (selected.length === 0) return;

    const saved = JSON.parse(localStorage.getItem('justai_onboarding_data') || '{}');
    saved.painPoints = selected;
    localStorage.setItem('justai_onboarding_data', JSON.stringify(saved));

    trackOnboardingStep('pain-points', 'completed', {
      pain_points_selected: selected.length,
      pain_points: selected,
    });

    navigate('/onboarding/motivation');
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
          What's stopping you when{'\n'}you speak English?
        </h1>
        <p className="text-gray-500 mb-8">Select all that apply.</p>

        <div className="space-y-3">
          {painPoints.map((option) => (
            <button
              key={option.id}
              onClick={() => toggle(option.id)}
              className={cn(
                'w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left',
                selected.includes(option.id)
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              )}
            >
              <span className="text-2xl">{option.icon}</span>
              <span className="flex-1 font-medium text-gray-900">{option.label}</span>
              <div
                className={cn(
                  'w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all',
                  selected.includes(option.id)
                    ? 'bg-blue-500 border-blue-500'
                    : 'border-gray-300'
                )}
              >
                {selected.includes(option.id) && (
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
    </div>
  );
}
