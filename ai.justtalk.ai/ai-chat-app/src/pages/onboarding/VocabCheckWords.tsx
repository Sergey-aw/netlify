import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { updateOnboardingStep } from '@/lib/onboarding-state';
import { trackOnboardingStep } from '@/lib/posthog';

interface VocabWord {
  id: string;
  lemma: string;
  cefr_level: string;
}

const CEFR_SAMPLE: Record<string, number> = {
  A1: 6,
  A2: 7,
  B1: 7,
  B2: 8,
  C1: 7,
  C2: 5,
};

const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const WORDS_PER_PAGE = 20;
const TOTAL_STEPS = 15;
const ANALYZING_DURATION = 5000;

type Phase = 'loading' | 'page1' | 'page2' | 'analyzing';

async function fetchRandomWords(): Promise<VocabWord[]> {
  const queries = Object.entries(CEFR_SAMPLE).map(([level, count]) =>
    supabase.rpc('get_random_lexemes', { level, count_limit: count })
  );

  const results = await Promise.all(queries);
  const words: VocabWord[] = [];

  for (const result of results) {
    if (result.data) {
      words.push(...result.data);
    }
  }

  return words.sort(() => Math.random() - 0.5);
}

function estimateCefrLevel(wordResults: { cefrLevel: string; known: boolean }[]): string {
  const scores: Record<string, number> = {};
  for (const level of CEFR_ORDER) {
    const levelWords = wordResults.filter((w) => w.cefrLevel === level);
    scores[level] = levelWords.length === 0 ? 0 : levelWords.filter((w) => w.known).length / levelWords.length;
  }

  const weights = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 };
  let totalScore = 0;
  let maxPossible = 0;
  for (const level of CEFR_ORDER) {
    const weight = weights[level as keyof typeof weights];
    totalScore += scores[level] * weight;
    maxPossible += weight;
  }

  const normalizedScore = totalScore / maxPossible;
  if (normalizedScore >= 0.85) return 'C2';
  if (normalizedScore >= 0.70) return 'C1';
  if (normalizedScore >= 0.55) return 'B2';
  if (normalizedScore >= 0.40) return 'B1';
  if (normalizedScore >= 0.25) return 'A2';
  return 'A1';
}

const REVIEWS = [
  { name: 'Grace Rouw', date: '17 May 2025', title: 'Never felt more confident in my English practices!', text: 'AI tutor gives me more freedom to speak knowing that nobody will judge or push too hard on my mistakes in my practice.' },
  { name: 'Marco Silva', date: '2 Apr 2025', title: 'My speaking improved dramatically in just 3 weeks', text: 'I used to freeze in meetings. Now I lead presentations in English. The real-time corrections are incredibly helpful.' },
  { name: 'Yuki Tanaka', date: '28 Mar 2025', title: 'Better than any language school I\'ve tried', text: 'Practicing at my own pace without the pressure of a classroom made all the difference. I actually enjoy learning now.' },
  { name: 'Anna Kowalski', date: '15 Mar 2025', title: 'Finally broke through my intermediate plateau!', text: 'I was stuck at B1 for years. The personalized conversations pushed me to use vocabulary I\'d never practice otherwise.' },
  { name: 'Carlos Mendez', date: '8 Mar 2025', title: 'Perfect for busy professionals', text: 'I practice during my commute. 15 minutes a day and my colleagues noticed the improvement within a month.' },
  { name: 'Sophie Laurent', date: '22 Feb 2025', title: 'The vocabulary builder is a game changer', text: 'Learning words in context through conversation sticks so much better than flashcards. I remember everything now.' },
  { name: 'David Chen', date: '14 Feb 2025', title: 'Helped me ace my IELTS speaking test', text: 'Scored an 8.0 on speaking after two months of daily practice. The AI pushed me to use more complex structures naturally.' },
  { name: 'Elena Petrova', date: '3 Feb 2025', title: 'My kids love practicing with it too', text: 'Started using it myself but now the whole family practices. It adapts perfectly to different levels.' },
  { name: 'James O\'Brien', date: '25 Jan 2025', title: 'Worth every penny for career growth', text: 'Got promoted to a global role thanks to my improved English. This app was the turning point in my career.' },
  { name: 'Fatima Al-Hassan', date: '12 Jan 2025', title: 'So much better than talking to myself in the mirror!', text: 'Having a real conversation partner available 24/7 is amazing. I practice whenever inspiration strikes.' },
];

const STATUS_MESSAGES = [
  'Analyzing your vocabulary knowledge depth',
  'Comparing with CEFR reference levels',
  'Calculating your proficiency score',
  'Preparing personalized recommendations',
];

function AnalyzingScreen({ duration }: { duration: number }) {
  const [progress, setProgress] = useState(0);
  const [statusIndex, setStatusIndex] = useState(0);
  const [currentReview, setCurrentReview] = useState(0);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    const interval = 50;
    const steps = duration / interval;
    let current = 0;
    const timer = setInterval(() => {
      current++;
      setProgress(Math.min((current / steps) * 100, 100));
      if (current >= steps) clearInterval(timer);
    }, interval);
    return () => clearInterval(timer);
  }, [duration]);

  useEffect(() => {
    const interval = duration / STATUS_MESSAGES.length;
    const timer = setInterval(() => {
      setStatusIndex((prev) => Math.min(prev + 1, STATUS_MESSAGES.length - 1));
    }, interval);
    return () => clearInterval(timer);
  }, [duration]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentReview((prev) => (prev + 1) % REVIEWS.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const review = REVIEWS[currentReview];

  return (
    <div className="min-h-screen bg-white flex justify-center"><div className="w-full max-w-md flex flex-col items-center pt-16 px-6">
      <h1 className="text-gray-900 text-3xl font-bold text-center mb-10 leading-tight">
        Evaluating your<br />vocabulary skills
      </h1>

      <div className="relative w-40 h-40 mb-6">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="8" />
          <circle
            cx="60" cy="60" r={radius}
            fill="none" stroke="#3b82f6" strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - (progress / 100) * circumference}
            className="transition-[stroke-dashoffset] duration-100 ease-linear"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-3xl font-bold text-gray-900">{Math.round(progress)}%</span>
        </div>
      </div>

      <p className="text-gray-500 text-center text-base mb-12 transition-opacity duration-300">
        {STATUS_MESSAGES[statusIndex]}
      </p>

      <div
        key={currentReview}
        className="w-full max-w-sm bg-gray-50 border border-gray-200 rounded-2xl p-5 animate-in fade-in slide-in-from-bottom-4 duration-500"
      >
        <h3 className="text-gray-900 font-semibold text-base mb-2">{review.title}</h3>
        <p className="text-gray-500 text-sm leading-relaxed mb-4">{review.text}</p>
        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-sm">{review.name} · {review.date}</span>
          <div className="flex gap-0.5">
            {[...Array(5)].map((_, i) => (
              <span key={i} className="text-blue-500 text-sm">★</span>
            ))}
          </div>
        </div>
      </div>
    </div></div>
  );
}

export default function VocabCheckWords() {
  const navigate = useNavigate();
  const [words, setWords] = useState<VocabWord[]>([]);
  const [knownIds, setKnownIds] = useState<Set<string>>(new Set());
  const [phase, setPhase] = useState<Phase>('loading');

  useEffect(() => {
    trackOnboardingStep('vocab-check', 'started');
    updateOnboardingStep('onboarding-vocab-check');

    const saved = JSON.parse(localStorage.getItem('justai_onboarding_data') || '{}');
    if (saved.vocabCheck?.words?.length >= WORDS_PER_PAGE * 2) {
      setWords(saved.vocabCheck.words.map((w: { id: string; lemma: string; cefrLevel: string }) => ({
        id: w.id,
        lemma: w.lemma,
        cefr_level: w.cefrLevel,
      })));
      setKnownIds(new Set(
        saved.vocabCheck.words.filter((w: { known: boolean }) => w.known).map((w: { id: string }) => w.id)
      ));
      setPhase('page1');
      return;
    }

    fetchRandomWords().then((fetched) => {
      setWords(fetched);
      setPhase('page1');
    });
  }, []);

  const toggleWord = (id: string) => {
    setKnownIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const saveAndNavigate = useCallback(() => {
    const wordResults = words.map((w) => ({
      id: w.id,
      lemma: w.lemma,
      cefrLevel: w.cefr_level,
      known: knownIds.has(w.id),
    }));

    const estimatedLevel = estimateCefrLevel(wordResults);

    const saved = JSON.parse(localStorage.getItem('justai_onboarding_data') || '{}');
    saved.vocabCheck = {
      words: wordResults,
      estimatedCefrLevel: estimatedLevel,
      knownCount: knownIds.size,
      totalCount: words.length,
    };
    localStorage.setItem('justai_onboarding_data', JSON.stringify(saved));

    const preferences = JSON.parse(localStorage.getItem('justai_onboarding_preferences') || '{}');
    preferences.cefrLevel = estimatedLevel;
    localStorage.setItem('justai_onboarding_preferences', JSON.stringify(preferences));

    trackOnboardingStep('vocab-check', 'completed', {
      known_count: knownIds.size,
      total_count: words.length,
      estimated_cefr: estimatedLevel,
    });

    navigate('/login');
  }, [words, knownIds, navigate]);

  useEffect(() => {
    if (phase !== 'analyzing') return;
    const timer = setTimeout(saveAndNavigate, ANALYZING_DURATION);
    return () => clearTimeout(timer);
  }, [phase, saveAndNavigate]);

  const handleContinuePage1 = () => {
    setPhase('page2');
    window.scrollTo(0, 0);
  };

  const handleContinuePage2 = () => {
    setPhase('analyzing');
  };

  const handleBack = () => {
    if (phase === 'page2') {
      setPhase('page1');
    } else {
      navigate(-1);
    }
  };

  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (phase === 'analyzing') {
    return <AnalyzingScreen duration={ANALYZING_DURATION} />;
  }

  const isPage1 = phase === 'page1';
  const currentStep = isPage1 ? 11 : 12;
  const pageWords = isPage1
    ? words.slice(0, WORDS_PER_PAGE)
    : words.slice(WORDS_PER_PAGE, WORDS_PER_PAGE * 2);
  const pageKnownCount = pageWords.filter((w) => knownIds.has(w.id)).length;

  return (
    <div className="min-h-screen bg-white flex justify-center"><div className="w-full max-w-md flex flex-col">
      {/* Header */}
      <div className="px-4 py-6">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={handleBack} className="text-gray-400 hover:text-gray-600">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${(currentStep / TOTAL_STEPS) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 overflow-y-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Tap words you know
        </h1>
        <p className="text-gray-500 mb-6">
          {isPage1 ? 'Part 1 of 2 — ' : 'Part 2 of 2 — '}
          select all the words you understand
        </p>

        <div className="flex flex-wrap gap-3">
          {pageWords.map((word) => (
            <button
              key={word.id}
              onClick={() => toggleWord(word.id)}
              className={cn(
                'px-5 py-3 rounded-2xl text-base font-medium transition-all border-2',
                knownIds.has(word.id)
                  ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              )}
            >
              {word.lemma}
            </button>
          ))}
        </div>

        <p className="text-center text-sm text-gray-400 mt-6">
          {pageKnownCount} of {pageWords.length} selected
        </p>
      </div>

      {/* Bottom Button */}
      <div className="px-4 py-6">
        <Button
          onClick={isPage1 ? handleContinuePage1 : handleContinuePage2}
          size="lg"
          className="w-full py-6 text-lg rounded-2xl"
        >
          {isPage1 ? 'Continue' : 'Analyze My Vocabulary'}
        </Button>
      </div>
    </div></div>
  );
}
