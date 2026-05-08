import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { trackOnboardingStep } from '@/lib/posthog';

const usageOptions = [
  { id: 'read-news', icon: '📰', label: 'Read English news' },
  { id: 'watch-shows', icon: '📺', label: 'Watch English shows' },
  { id: 'listen-music', icon: '🎧', label: 'Listen to English music' },
  { id: 'use-at-work', icon: '👨‍💻', label: 'Use English at work' },
  { id: 'chat-speakers', icon: '💬', label: 'Chat with English speakers' },
  { id: 'rarely-use', icon: '🙈', label: 'Rarely use English' },
];

const TOTAL_STEPS = 8;
const CURRENT_STEP = 2;

export default function OnboardingDailyUsage() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    trackOnboardingStep('daily-usage', 'started');
    const saved = JSON.parse(localStorage.getItem('justai_onboarding_data') || '{}');
    if (saved.dailyUsage) setSelected(saved.dailyUsage);
  }, []);

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleContinue = () => {
    if (selected.length === 0) return;

    const saved = JSON.parse(localStorage.getItem('justai_onboarding_data') || '{}');
    saved.dailyUsage = selected;
    localStorage.setItem('justai_onboarding_data', JSON.stringify(saved));

    trackOnboardingStep('daily-usage', 'completed', {
      daily_usage_selected: selected.length,
      daily_usage: selected,
    });

    navigate('/onboarding/pain-points');
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
          How do you use English{'\n'}in your daily life?
        </h1>
        <p className="text-gray-500 mb-8">Select all that apply.</p>

        <div className="space-y-3">
          {usageOptions.map((option) => (
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
