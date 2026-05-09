import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { updateOnboardingStep } from '@/lib/onboarding-state';
import { trackOnboardingStep } from '@/lib/posthog';

const CEFR_LABELS: Record<string, { label: string; description: string; color: string }> = {
  A1: { label: 'Beginner', description: 'You know basic everyday words', color: 'bg-red-400' },
  A2: { label: 'Elementary', description: 'You understand common phrases', color: 'bg-orange-400' },
  B1: { label: 'Intermediate', description: 'You can discuss familiar topics', color: 'bg-yellow-400' },
  B2: { label: 'Upper Intermediate', description: 'You understand complex texts', color: 'bg-green-400' },
  C1: { label: 'Advanced', description: 'You express yourself fluently', color: 'bg-blue-400' },
  C2: { label: 'Proficient', description: 'You understand virtually everything', color: 'bg-purple-400' },
};

const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const TOTAL_STEPS = 15;
const CURRENT_STEP = 12;

export default function VocabCheckResult() {
  const navigate = useNavigate();

  const vocabData = useMemo(() => {
    const saved = JSON.parse(localStorage.getItem('justai_onboarding_data') || '{}');
    return saved.vocabCheck || { estimatedCefrLevel: 'A1', knownCount: 0, totalCount: 40, words: [] };
  }, []);

  const levelInfo = CEFR_LABELS[vocabData.estimatedCefrLevel] || CEFR_LABELS.A1;
  const currentIndex = CEFR_ORDER.indexOf(vocabData.estimatedCefrLevel);

  const levelBreakdown = useMemo(() => {
    if (!vocabData.words?.length) return [];
    return CEFR_ORDER.map((level) => {
      const levelWords = vocabData.words.filter((w: { cefrLevel: string }) => w.cefrLevel === level);
      const known = levelWords.filter((w: { known: boolean }) => w.known).length;
      return { level, known, total: levelWords.length };
    }).filter((b: { total: number }) => b.total > 0);
  }, [vocabData.words]);

  useEffect(() => {
    trackOnboardingStep('vocab-result', 'started', {
      estimated_cefr: vocabData.estimatedCefrLevel,
      known_count: vocabData.knownCount,
    });
    updateOnboardingStep('onboarding-vocab-result');
  }, [vocabData]);

  const handleContinue = () => {
    trackOnboardingStep('vocab-result', 'completed');
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
      <div className="flex-1 flex flex-col items-center px-6 pt-4">
        <h1 className="text-3xl font-bold text-gray-900 text-center mb-2">
          Your vocabulary level
        </h1>
        <p className="text-gray-500 text-center mb-8">
          Based on {vocabData.knownCount} of {vocabData.totalCount} words you recognized
        </p>

        {/* Level Badge */}
        <div className="w-full max-w-sm bg-gray-50 rounded-3xl p-6 mb-6">
          <div className="flex items-center gap-4 mb-5">
            <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center', levelInfo.color)}>
              <span className="text-white text-xl font-bold">{vocabData.estimatedCefrLevel}</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{levelInfo.label}</h2>
              <p className="text-sm text-gray-500">{levelInfo.description}</p>
            </div>
          </div>

          {/* CEFR Scale */}
          <div className="flex gap-1.5">
            {CEFR_ORDER.map((level, i) => (
              <div key={level} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className={cn(
                    'w-full h-2 rounded-full',
                    i <= currentIndex ? CEFR_LABELS[level].color : 'bg-gray-200'
                  )}
                />
                <span className={cn(
                  'text-xs font-medium',
                  i <= currentIndex ? 'text-gray-700' : 'text-gray-300'
                )}>
                  {level}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Breakdown */}
        <div className="w-full max-w-sm space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Words by level
          </h3>
          {levelBreakdown.map(({ level, known, total }) => (
            <div key={level} className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-600 w-8">{level}</span>
              <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full', CEFR_LABELS[level].color)}
                  style={{ width: total > 0 ? `${(known / total) * 100}%` : '0%' }}
                />
              </div>
              <span className="text-sm text-gray-500 w-10 text-right">{known}/{total}</span>
            </div>
          ))}
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
