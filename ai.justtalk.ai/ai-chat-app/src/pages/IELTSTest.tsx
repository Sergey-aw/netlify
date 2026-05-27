import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  PanelLeft,
  ArrowLeft,
  GraduationCap,
  Lock,
  CheckCircle2,
  Play,
  RotateCcw,
  MessageCircle,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useSubscription } from '@/hooks/useSubscription';
import { AppSidebar } from '@/components/AppSidebar';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from '@/components/ui/carousel';
import {
  fetchIeltsTestDetail,
  latestFinalizedAttempt,
  overallBand,
  themeSlug,
  type IeltsAttempt,
  type IeltsPartDetail,
  type IeltsTestDetail,
} from '@/services/ielts.service';

const PART_TITLES: Record<1 | 2 | 3, string> = {
  1: 'Personal interview',
  2: 'Cue-card monologue',
  3: 'Abstract discussion',
};

const PART_DESCRIPTIONS: Record<1 | 2 | 3, string> = {
  1: 'Short answers about familiar topics — work, home, hobbies.',
  2: 'A single cue card. Speak for up to 2 minutes.',
  3: 'Open-ended discussion building on Part 2.',
};

export default function IELTSTest() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showSidebar, setShowSidebar] = useState(false);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [currentSlide, setCurrentSlide] = useState(0);

  useSwipeGesture({
    onSwipeRight: () => {
      if (!showSidebar) setShowSidebar(true);
    },
    minSwipeDistance: 50,
    maxVerticalDistance: 100,
    ignoreSelectors: ['[data-swipe-ignore]'],
  });

  const { data: test, isPending, error } = useQuery({
    queryKey: ['ielts-test-detail', id],
    queryFn: () => fetchIeltsTestDetail(id),
    enabled: !!id,
    staleTime: 30 * 1000,
  });

  useEffect(() => {
    if (!carouselApi) return;
    const onSelect = () => setCurrentSlide(carouselApi.selectedScrollSnap());
    carouselApi.on('select', onSelect);
    onSelect();
    return () => {
      carouselApi.off('select', onSelect);
    };
  }, [carouselApi]);

  const backToCategory = () => {
    if (test) navigate(`/ielts/category/${themeSlug(test.theme)}`);
    else navigate('/ielts');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <AppSidebar open={showSidebar} onOpenChange={setShowSidebar} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="p-4 border-b bg-white flex items-center gap-3 shrink-0">
          <button
            onClick={() => setShowSidebar(true)}
            className="p-1.5 rounded-md hover:bg-muted"
            aria-label="Open menu"
          >
            <PanelLeft className="w-5 h-5" />
          </button>
          <button
            onClick={backToCategory}
            className="p-1.5 rounded-md hover:bg-muted flex items-center gap-1.5 text-sm"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
          </button>
          <GraduationCap className="w-5 h-5 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="text-xs text-muted-foreground leading-tight">
              {test ? `Test ${test.ordering}` : 'Test'}
            </div>
            <div className="text-base font-semibold truncate leading-tight">
              {test?.theme ?? 'IELTS Speaking'}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="max-w-5xl mx-auto p-4 sm:p-6">
            {isPending && <DetailSkeleton />}

            {error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                Couldn't load test. {(error as Error).message}
              </div>
            )}

            {test && !isPending && (
              <>
                <Carousel
                  setApi={setCarouselApi}
                  opts={{ align: 'start' }}
                  className="w-full"
                >
                  <CarouselContent>
                    {test.parts.map((part) => (
                      <CarouselItem
                        key={part.id || part.part_number}
                        className="md:basis-2/3 lg:basis-1/2"
                      >
                        <PartCard test={test} part={part} />
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  <CarouselPrevious className="hidden sm:flex" />
                  <CarouselNext className="hidden sm:flex" />
                </Carousel>

                {/* Slide dots (mobile-friendly) */}
                <div className="flex justify-center gap-1.5 mt-4">
                  {test.parts.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => carouselApi?.scrollTo(i)}
                      className={`h-1.5 rounded-full transition-all ${
                        currentSlide === i
                          ? 'w-6 bg-foreground'
                          : 'w-1.5 bg-muted-foreground/30'
                      }`}
                      aria-label={`Go to Part ${i + 1}`}
                    />
                  ))}
                </div>

                {/* Mock review CTA — appears only when all 3 Parts have at least one finalized attempt. */}
                <MockReviewCta test={test} />
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function MockReviewCta({ test }: { test: IeltsTestDetail }) {
  const navigate = useNavigate();
  const allDone = test.parts.every((p) =>
    p.attempts.some(
      (a) => a.status === 'examiner_complete' || a.status === 'coach_complete',
    ),
  );
  if (!allDone) return null;
  return (
    <Card className="mt-6 bg-primary/5 border-primary/20">
      <CardContent className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <MessageCircle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold">Full mock review with Coach</div>
            <div className="text-sm text-muted-foreground">
              Voice debrief covering all three Parts — strengths, biggest leaks,
              and what to work on next.
            </div>
          </div>
        </div>
        <Button
          onClick={() => navigate(`/ielts/test/${test.id}/coach/mock`)}
          className="shrink-0"
        >
          Start full review
          <ChevronRight className="w-4 h-4 ml-1.5" />
        </Button>
      </CardContent>
    </Card>
  );
}

function PartCard({
  test,
  part,
}: {
  test: IeltsTestDetail;
  part: IeltsPartDetail;
}) {
  const navigate = useNavigate();
  const { hasActiveSubscription } = useSubscription();
  const latest = latestFinalizedAttempt(part.attempts);
  const examinerComplete = part.attempts.some(
    (a) => a.status === 'examiner_complete' || a.status === 'coach_complete'
  );
  const coachComplete = part.attempts.some(
    (a) => a.status === 'coach_complete'
  );
  const inProgress = part.attempts.some((a) => a.status === 'in_progress');
  // Locked only when the Part is paid-tier AND the user has no active subscription.
  const isLocked = part.access_tier === 'paid' && !hasActiveSubscription;

  // All finalized attempts (newest first), excluding `latest` which renders separately.
  const finalizedAttempts = useMemo(() => {
    return [...part.attempts]
      .filter(
        (a) =>
          (a.status === 'examiner_complete' || a.status === 'coach_complete') &&
          a.ielts_score,
      )
      .sort((a, b) => {
        const ta = a.finalized_at ? Date.parse(a.finalized_at) : 0;
        const tb = b.finalized_at ? Date.parse(b.finalized_at) : 0;
        if (ta !== tb) return tb - ta;
        return b.attempt_number - a.attempt_number;
      });
  }, [part.attempts]);

  const olderAttempts = useMemo(
    () => finalizedAttempts.filter((a) => a.id !== latest?.id),
    [finalizedAttempts, latest],
  );

  const examinerLabel = inProgress
    ? 'Resume Examiner'
    : examinerComplete
      ? 'Retake Examiner'
      : 'Start Examiner';

  const examinerIcon = inProgress ? Play : examinerComplete ? RotateCcw : Play;

  const startExaminer = () =>
    navigate(`/ielts/test/${test.id}/part/${part.part_number}/examiner`);
  const startCoach = () =>
    navigate(`/ielts/test/${test.id}/part/${part.part_number}/coach`);
  const viewResults = () => {
    if (latest) navigate(`/ielts/attempt/${latest.id}/results`);
  };

  // For Parts 1 & 3, group questions by topic for the preview list.
  // For Part 2, the single cue card lives as a question with test_topic_id = null.
  const orphanQuestions = part.questions.filter((q) => !q.test_topic_id);

  return (
    <Card className="h-full">
      <CardContent className="p-5 sm:p-6 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Part {part.part_number}
            </div>
            <h2 className="text-xl font-semibold mt-0.5">
              {PART_TITLES[part.part_number]}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {PART_DESCRIPTIONS[part.part_number]}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {examinerComplete && (
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            )}
            {part.access_tier === 'paid' && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                Pro
              </Badge>
            )}
          </div>
        </div>

        {/* Meta line */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            up to {part.max_response_sec}s per response
          </span>
          <span>•</span>
          <span>
            {part.questions.length}{' '}
            {part.questions.length === 1 ? 'prompt' : 'questions'}
          </span>
        </div>

        {/* Latest score */}
        {latest?.ielts_score && (
          <button
            type="button"
            onClick={viewResults}
            className="text-left w-full rounded-md cursor-pointer hover:opacity-90 transition-opacity"
            aria-label="View detailed results"
          >
            <ScoreSummary score={latest.ielts_score} />
            <div className="text-[11px] text-muted-foreground text-center mt-1">
              Tap to view detailed results →
            </div>
          </button>
        )}

        {/* Past attempts (everything finalized before the latest one) */}
        {olderAttempts.length > 0 && (
          <PastAttemptsList attempts={olderAttempts} />
        )}

        {/* Topics / cue card preview */}
        <div className="rounded-md border bg-muted/30 p-3 space-y-2">
          {part.part_number === 2 && orphanQuestions.length > 0 ? (
            <pre className="text-xs whitespace-pre-wrap font-sans text-foreground/80">
              {orphanQuestions[0].question_text}
            </pre>
          ) : (
            <div className="space-y-1.5">
              {part.topics.map((topic) => {
                const qCount = part.questions.filter(
                  (q) => q.test_topic_id === topic.id
                ).length;
                return (
                  <div
                    key={topic.id}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="font-medium">{topic.topic_name}</span>
                    <span className="text-muted-foreground">
                      {qCount} {qCount === 1 ? 'question' : 'questions'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 mt-auto">
          <Button
            onClick={startExaminer}
            disabled={isLocked && !examinerComplete}
            className="w-full justify-between"
          >
            <span className="inline-flex items-center gap-2">
              {(() => {
                const Icon = examinerIcon;
                return <Icon className="w-4 h-4" />;
              })()}
              {examinerLabel}
            </span>
            <ChevronRight className="w-4 h-4" />
          </Button>

          <Button
            variant={examinerComplete ? 'outline' : 'ghost'}
            onClick={startCoach}
            disabled={!examinerComplete}
            className="w-full justify-between"
          >
            <span className="inline-flex items-center gap-2">
              {examinerComplete ? (
                <MessageCircle className="w-4 h-4" />
              ) : (
                <Lock className="w-4 h-4" />
              )}
              {coachComplete
                ? 'Talk to Coach again'
                : examinerComplete
                  ? 'Talk to Coach'
                  : 'Coach locked'}
            </span>
            {examinerComplete && <ChevronRight className="w-4 h-4" />}
          </Button>

          {part.attempts.length > 0 && (
            <div className="text-[11px] text-muted-foreground text-center pt-1">
              {part.attempts.filter(
                (a) =>
                  a.status === 'examiner_complete' ||
                  a.status === 'coach_complete'
              ).length}{' '}
              completed{' '}
              {part.attempts.filter(
                (a) =>
                  a.status === 'examiner_complete' ||
                  a.status === 'coach_complete'
              ).length === 1
                ? 'attempt'
                : 'attempts'}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PastAttemptsList({ attempts }: { attempts: IeltsAttempt[] }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? attempts : attempts.slice(0, 0);

  return (
    <div className="border-t pt-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors"
        aria-expanded={expanded}
      >
        <span>
          {attempts.length} past {attempts.length === 1 ? 'attempt' : 'attempts'}
        </span>
        <span className="text-[11px]">{expanded ? 'Hide' : 'Show'}</span>
      </button>
      {expanded && (
        <ul className="mt-2 space-y-1.5">
          {visible.map((a) => {
            const band = a.ielts_score ? overallBand(a.ielts_score) : null;
            const ts = a.finalized_at ? new Date(a.finalized_at) : null;
            return (
              <li
                key={a.id}
                className="flex items-center justify-between gap-2 text-xs rounded-md border bg-muted/30 px-2.5 py-1.5"
              >
                <div className="min-w-0">
                  <div className="font-medium">Attempt #{a.attempt_number}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {ts
                      ? ts.toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : '—'}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {band != null && (
                    <span className="text-sm font-semibold tabular-nums">
                      {band.toFixed(1)}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => navigate(`/ielts/attempt/${a.id}/results`)}
                    className="text-[10px] text-primary hover:underline"
                  >
                    View
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ScoreSummary({
  score,
}: {
  score: {
    pronunciation_band: number;
    fluency_band: number;
    lexical_band: number;
    grammar_band: number;
  };
}) {
  const overall = overallBand(score);
  return (
    <div className="rounded-md border bg-emerald-50/50 dark:bg-emerald-950/20 p-3">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground">
          Latest score
        </span>
        <span className="text-lg font-semibold">
          Band {overall.toFixed(1)}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2 text-[11px]">
        <Criterion label="Pron" value={score.pronunciation_band} />
        <Criterion label="Flu" value={score.fluency_band} />
        <Criterion label="Lex" value={score.lexical_band} />
        <Criterion label="Gra" value={score.grammar_band} />
      </div>
    </div>
  );
}

function Criterion({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value.toFixed(1)}</span>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-6 space-y-4">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
