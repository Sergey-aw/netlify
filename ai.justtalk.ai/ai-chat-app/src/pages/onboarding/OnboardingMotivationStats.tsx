import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trackOnboardingStep } from '@/lib/posthog';

interface StatContent {
  highlight: string;
  rest: string;
  stat: string;
  source: string;
}

const statsByMotivation: Record<string, StatContent> = {
  work: {
    highlight: 'Business & Finance professionals',
    rest: 'with fluent English earn',
    stat: 'up to 35% more',
    source: 'Based on Preply Career Study 2025 & Pearson 2024',
  },
  'new-job': {
    highlight: 'Job seekers',
    rest: 'with strong English skills get',
    stat: '2x more interview callbacks',
    source: 'Based on LinkedIn Hiring Insights 2024',
  },
  abroad: {
    highlight: 'Expats',
    rest: 'who speak fluent English report',
    stat: '60% faster social integration',
    source: 'Based on InterNations Expat Survey 2024',
  },
  travel: {
    highlight: 'Travelers',
    rest: 'with conversational English save',
    stat: 'up to 25% on trips',
    source: 'Based on Booking.com Travel Report 2024',
  },
  skills: {
    highlight: 'Professionals',
    rest: 'who add English fluency see',
    stat: '40% more career opportunities',
    source: 'Based on EF English Proficiency Index 2024',
  },
  connect: {
    highlight: 'Multilingual families',
    rest: 'who share a common language report',
    stat: '3x stronger bonds',
    source: 'Based on Cambridge Language & Wellbeing Study 2024',
  },
};

const defaultStat: StatContent = statsByMotivation.work;

const TOTAL_STEPS = 8;
const CURRENT_STEP = 4;

export default function OnboardingMotivationStats() {
  const navigate = useNavigate();

  const stat = useMemo(() => {
    const saved = JSON.parse(localStorage.getItem('justai_onboarding_data') || '{}');
    return statsByMotivation[saved.motivation] || defaultStat;
  }, []);

  useEffect(() => {
    trackOnboardingStep('motivation-stats', 'started');
  }, []);

  const handleContinue = () => {
    trackOnboardingStep('motivation-stats', 'completed');
    navigate('/onboarding/goals');
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
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <h2 className="text-center text-2xl font-bold leading-snug">
          <span className="text-green-500">{stat.highlight}</span>{' '}
          <span className="text-gray-900">{stat.rest}</span>{' '}
          <span className="text-blue-500">{stat.stat}</span>{' '}
          <span className="text-gray-900">on average</span>
        </h2>

        <div className="mt-8 bg-gray-100 rounded-2xl px-5 py-4 flex items-start gap-3">
          <span className="text-gray-400 text-lg mt-0.5">📋</span>
          <p className="text-sm text-gray-500">{stat.source}</p>
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
    </div>
  );
}
