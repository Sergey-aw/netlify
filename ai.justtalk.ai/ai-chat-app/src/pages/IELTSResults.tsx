import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  PanelLeft,
  GraduationCap,
  CheckCircle2,
  Loader2,
  MessageCircle,
  AlertCircle,
} from 'lucide-react';
import { AppSidebar } from '@/components/AppSidebar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BandGauge, CefrChip } from '@/components/ielts/BandGauge';
import {
  averageCefr,
  fetchAttemptResultBundle,
  finalizeIeltsPart,
  finalizeIeltsTest,
  overallBand,
  type AttemptResultBundle,
  type CefrLevel,
  type ResponseDetail,
} from '@/services/ielts.service';

const PART_TITLES: Record<1 | 2 | 3, string> = {
  1: 'Part 1 — Personal interview',
  2: 'Part 2 — Cue-card monologue',
  3: 'Part 3 — Abstract discussion',
};

export default function IELTSResults() {
  const { attemptId = '' } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showSidebar, setShowSidebar] = useState(false);

  const {
    data: bundle,
    isPending,
    error,
    refetch,
  } = useQuery({
    queryKey: ['ielts-attempt-result', attemptId],
    queryFn: () => fetchAttemptResultBundle(attemptId),
    enabled: !!attemptId,
    staleTime: 30 * 1000,
  });

  // If we have an attempt with responses but no score yet, run finalize once.
  const finalize = useMutation({
    mutationFn: () => finalizeIeltsPart(attemptId),
    onSuccess: async () => {
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['ielts-test-detail'] });
      queryClient.invalidateQueries({ queryKey: ['ielts-catalog'] });
    },
  });

  // After finalize-part succeeds, opportunistically attempt the test-level
  // aggregate. Returns { pending: true } silently if the user hasn't done all
  // 3 Parts yet — no UI noise.
  useEffect(() => {
    const testId = bundle?.attempt.test_part.test.id;
    if (!testId || !bundle?.score) return;
    finalizeIeltsTest(testId)
      .then((res) => {
        if (!res.pending) {
          queryClient.invalidateQueries({ queryKey: ['ielts-test-detail'] });
          queryClient.invalidateQueries({ queryKey: ['ielts-catalog'] });
        }
      })
      .catch((err) => {
        console.warn('finalize-test failed (non-fatal):', err);
      });
  }, [bundle?.score, bundle?.attempt.test_part.test.id, queryClient]);

  useEffect(() => {
    if (
      bundle &&
      !bundle.score &&
      bundle.responses.length > 0 &&
      !finalize.isPending &&
      !finalize.isError
    ) {
      finalize.mutate();
    }
  }, [bundle, finalize]);

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
          {bundle?.attempt && (
            <button
              onClick={() => navigate(`/ielts/test/${bundle.attempt.test_part.test.id}`)}
              className="p-1.5 rounded-md hover:bg-muted flex items-center gap-1.5 text-sm"
              aria-label="Back to test"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back to test</span>
            </button>
          )}
          <GraduationCap className="w-5 h-5 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="text-xs text-muted-foreground leading-tight">
              {bundle?.attempt
                ? `Test ${bundle.attempt.test_part.test.ordering} · ${bundle.attempt.test_part.test.theme}`
                : 'Results'}
            </div>
            <div className="text-base font-semibold truncate leading-tight">
              {bundle?.attempt
                ? PART_TITLES[bundle.attempt.test_part.part_number]
                : 'IELTS Results'}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="max-w-4xl mx-auto p-4 sm:p-6">
            {(isPending || finalize.isPending) && <PageSkeleton />}

            {error && (
              <ErrorBlock message={(error as Error).message} />
            )}

            {finalize.isError && (
              <ErrorBlock
                message={`Couldn't finalize: ${(finalize.error as Error).message}`}
                onRetry={() => finalize.mutate()}
              />
            )}

            {bundle && bundle.score && !isPending && (
              <ResultsBody bundle={bundle} />
            )}

            {bundle && !bundle.score && !finalize.isPending && !finalize.isError && (
              <PageSkeleton />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

// =======================================================================
// Body
// =======================================================================

function ResultsBody({ bundle }: { bundle: AttemptResultBundle }) {
  const navigate = useNavigate();
  const { score, responses, attempt } = bundle;
  if (!score) return null;

  const overall = overallBand(score);
  const aggregates = useMemo(() => aggregate(responses), [responses]);

  return (
    <div className="space-y-6">
      {/* Hero — overall band */}
      <Card className="bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-950/30 dark:to-blue-950/30 border-cyan-200/50 dark:border-cyan-900/40">
        <CardContent className="p-6 sm:p-8 flex flex-col items-center gap-3 text-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Overall band
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-5xl font-bold tabular-nums">
              {overall.toFixed(1)}
            </span>
            <span className="text-lg text-muted-foreground">/9.0</span>
          </div>
          <div className="text-sm text-muted-foreground">
            Across {responses.length}{' '}
            {responses.length === 1 ? 'response' : 'responses'} · attempt #
            {attempt.attempt_number}
          </div>
        </CardContent>
      </Card>

      {/* Four criterion gauges */}
      <Card>
        <CardContent className="p-6 sm:p-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-8 justify-items-center">
            <BandGauge value={score.pronunciation_band} label="Pronunciation" />
            <BandGauge value={score.fluency_band} label="Fluency & Coherence" />
            <BandGauge value={score.lexical_band} label="Lexical Resource" />
            <BandGauge value={score.grammar_band} label="Grammar" />
          </div>
        </CardContent>
      </Card>

      {/* Tabbed breakdowns */}
      <Tabs defaultValue="pronunciation">
        {/* Single-row tab bar — horizontally scrollable when it overflows */}
        <div
          className="-mx-4 sm:mx-0 overflow-x-auto scrollbar-hide"
          data-swipe-ignore
        >
          <TabsList className="inline-flex w-max min-w-full justify-start mx-4 sm:mx-0">
            <TabsTrigger value="pronunciation" className="whitespace-nowrap text-sm">
              Pronunciation
            </TabsTrigger>
            <TabsTrigger value="fluency" className="whitespace-nowrap text-sm">
              Fluency &amp; Coherence
            </TabsTrigger>
            <TabsTrigger value="lexical" className="whitespace-nowrap text-sm">
              Lexical Resource
            </TabsTrigger>
            <TabsTrigger value="grammar" className="whitespace-nowrap text-sm">
              Grammar
            </TabsTrigger>
            <TabsTrigger value="cefr" className="whitespace-nowrap text-sm">
              CEFR
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="pronunciation" className="mt-4">
          <PronunciationSection
            band={score.pronunciation_band}
            responses={responses}
            agg={aggregates}
          />
        </TabsContent>
        <TabsContent value="fluency" className="mt-4">
          <FluencySection band={score.fluency_band} agg={aggregates} />
        </TabsContent>
        <TabsContent value="lexical" className="mt-4">
          <VocabularySection band={score.lexical_band} agg={aggregates} />
        </TabsContent>
        <TabsContent value="grammar" className="mt-4">
          <GrammarSection
            band={score.grammar_band}
            agg={aggregates}
            testId={attempt.test_part.test.id}
            partNumber={attempt.test_part.part_number}
          />
        </TabsContent>
        <TabsContent value="cefr" className="mt-4">
          <CefrSection agg={aggregates} />
        </TabsContent>
      </Tabs>

      {/* Actions */}
      <Card>
        <CardContent className="p-5 flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
          <Button
            variant="outline"
            onClick={() => navigate(`/ielts/test/${attempt.test_part.test.id}`)}
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back to test
          </Button>
          <Button
            onClick={() =>
              navigate(
                `/ielts/test/${attempt.test_part.test.id}/part/${attempt.test_part.part_number}/coach`,
              )
            }
          >
            <MessageCircle className="w-4 h-4 mr-1.5" />
            Talk to Coach
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// =======================================================================
// Aggregates from per-response SpeechSuper jsonb
// =======================================================================

interface SentenceWord {
  word: string;
  pronunciation: number;
  start: number;
  end: number;
  pause?: { type: number; duration: number };
  level?: string;
}

interface SentenceObj {
  sentence?: string;
  pronunciation?: number;
  start?: number;
  end?: number;
  details?: SentenceWord[];
  grammar?: {
    corrected?: string;
  };
}

interface AggregatedMetrics {
  // Pronunciation
  goodPct: number;
  fairPct: number;
  poorPct: number;
  totalWords: number;
  // Fluency
  totalSpeechSeconds: number;
  totalDurationSeconds: number;
  averageWpm: number;
  totalPauses: number;
  fillerCounts: Record<string, number>;
  // Vocabulary
  vocabWords: number;
  vocabUnique: number;
  cefrDistribution: Record<'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2', number>; // percentages, averaged
  academicWords: string[];
  // Grammar
  grammarSuggestions: Array<{
    questionText: string;
    original: string;
    corrected: string;
  }>;
  // Relevance
  averageRelevance: number;
  // CEFR per criterion + overall (averaged from SpeechSuper's per-question cefr_levels)
  cefr: {
    overall: CefrLevel | null;
    pronunciation: CefrLevel | null;
    fluency: CefrLevel | null;
    lexical: CefrLevel | null;
    grammar: CefrLevel | null;
  };
}

function aggregate(responses: ResponseDetail[]): AggregatedMetrics {
  const out: AggregatedMetrics = {
    goodPct: 0,
    fairPct: 0,
    poorPct: 0,
    totalWords: 0,
    totalSpeechSeconds: 0,
    totalDurationSeconds: 0,
    averageWpm: 0,
    totalPauses: 0,
    fillerCounts: {},
    vocabWords: 0,
    vocabUnique: 0,
    cefrDistribution: { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 },
    academicWords: [],
    grammarSuggestions: [],
    averageRelevance: 0,
    cefr: {
      overall: null,
      pronunciation: null,
      fluency: null,
      lexical: null,
      grammar: null,
    },
  };

  if (responses.length === 0) return out;

  const goodPcts: number[] = [];
  const fairPcts: number[] = [];
  const poorPcts: number[] = [];
  const wpms: number[] = [];
  const cefrSums: Record<'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2', number[]> = {
    A1: [], A2: [], B1: [], B2: [], C1: [], C2: [],
  };
  const academicSet = new Set<string>();
  const relevances: number[] = [];
  // Collect per-question SpeechSuper CEFR per criterion for later averaging.
  const cefrSamples = {
    overall: [] as string[],
    pronunciation: [] as string[],
    fluency: [] as string[],
    lexical: [] as string[],
    grammar: [] as string[],
  };

  for (const r of responses) {
    const ss = r.speechsuper_response as Record<string, unknown> | null;
    const result = (ss?.result ?? {}) as Record<string, unknown>;

    const pronStats = result.pronunciation_stats as
      | { good_word_pct?: number; fair_word_pct?: number; poor_word_pct?: number }
      | undefined;
    if (pronStats) {
      if (typeof pronStats.good_word_pct === 'number') goodPcts.push(pronStats.good_word_pct);
      if (typeof pronStats.fair_word_pct === 'number') fairPcts.push(pronStats.fair_word_pct);
      if (typeof pronStats.poor_word_pct === 'number') poorPcts.push(pronStats.poor_word_pct);
    }

    if (typeof result.numeric_duration === 'number') {
      out.totalDurationSeconds += result.numeric_duration as number;
    }
    if (typeof result.effective_speech_length === 'number') {
      out.totalSpeechSeconds += result.effective_speech_length as number;
    }
    if (typeof result.speed === 'number') {
      wpms.push(result.speed as number);
    }

    const fluencyStats = result.fluency_stats as { pause_cnt?: number } | undefined;
    if (fluencyStats && typeof fluencyStats.pause_cnt === 'number') {
      out.totalPauses += fluencyStats.pause_cnt;
    }

    const fillers = result.pause_filler as Record<string, number> | undefined;
    if (fillers) {
      for (const [k, v] of Object.entries(fillers)) {
        out.fillerCounts[k] = (out.fillerCounts[k] ?? 0) + (typeof v === 'number' ? v : 0);
      }
    }

    const vocab = result.vocabulary_stats as
      | {
          word_cnt?: number;
          unique_word_cnt?: number;
          academic_words?: string[];
          CEFR_A1_pct?: number;
          CEFR_A2_pct?: number;
          CEFR_B1_pct?: number;
          CEFR_B2_pct?: number;
          CEFR_C1_pct?: number;
          CEFR_C2_pct?: number;
        }
      | undefined;
    if (vocab) {
      out.vocabWords += vocab.word_cnt ?? 0;
      out.vocabUnique += vocab.unique_word_cnt ?? 0;
      (['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const).forEach((lvl) => {
        const v = (vocab as Record<string, number | undefined>)[`CEFR_${lvl}_pct`];
        if (typeof v === 'number') cefrSums[lvl].push(v);
      });
      for (const w of vocab.academic_words ?? []) academicSet.add(w);
    }

    if (typeof result.relevance === 'number') {
      relevances.push(result.relevance);
    }

    // SpeechSuper per-criterion CEFR for this question.
    const equiv = result.equivalent_scores as
      | { cefr_levels?: Record<string, string> }
      | undefined;
    const cefr = equiv?.cefr_levels;
    if (cefr) {
      if (typeof cefr.overall === 'string') cefrSamples.overall.push(cefr.overall);
      if (typeof cefr.pronunciation === 'string') cefrSamples.pronunciation.push(cefr.pronunciation);
      if (typeof cefr.fluency === 'string') cefrSamples.fluency.push(cefr.fluency);
      if (typeof cefr.vocab === 'string') cefrSamples.lexical.push(cefr.vocab);
      if (typeof cefr.grammar === 'string') cefrSamples.grammar.push(cefr.grammar);
    }

    // Total words from sentence-level details
    const sentences = (result.sentences ?? []) as SentenceObj[];
    for (const s of sentences) {
      out.totalWords += s.details?.length ?? 0;
      if (s.grammar?.corrected && s.sentence && s.sentence !== s.grammar.corrected) {
        out.grammarSuggestions.push({
          questionText: r.question?.question_text ?? '',
          original: s.sentence,
          corrected: s.grammar.corrected,
        });
      }
    }
  }

  out.goodPct = avg(goodPcts);
  out.fairPct = avg(fairPcts);
  out.poorPct = avg(poorPcts);
  out.averageWpm = Math.round(avg(wpms));
  (['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const).forEach((lvl) => {
    out.cefrDistribution[lvl] = Math.round(avg(cefrSums[lvl]));
  });
  out.academicWords = Array.from(academicSet).sort();
  out.averageRelevance = Math.round(avg(relevances));

  out.cefr = {
    overall: averageCefr(cefrSamples.overall),
    pronunciation: averageCefr(cefrSamples.pronunciation),
    fluency: averageCefr(cefrSamples.fluency),
    lexical: averageCefr(cefrSamples.lexical),
    grammar: averageCefr(cefrSamples.grammar),
  };

  return out;
}

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

// =======================================================================
// Section components
// =======================================================================

function SectionHeader({
  title,
  band,
  caption,
}: {
  title: string;
  band: number;
  caption?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 mb-4">
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        {caption && (
          <p className="text-xs text-muted-foreground mt-0.5">{caption}</p>
        )}
      </div>
      <div className="flex items-baseline gap-1 shrink-0">
        <span className="text-2xl font-bold tabular-nums">{band.toFixed(1)}</span>
        <span className="text-xs text-muted-foreground">/9.0</span>
      </div>
    </div>
  );
}

function PronunciationSection({
  band,
  responses,
  agg,
}: {
  band: number;
  responses: ResponseDetail[];
  agg: AggregatedMetrics;
}) {
  // Render each response with color-coded words from SpeechSuper sentences[].details.
  return (
    <Card>
      <CardContent className="p-5 sm:p-6">
        <SectionHeader title="Pronunciation" band={band} />

        {/* Good/Fair/Poor distribution bar */}
        <div className="mb-5">
          <div className="text-xs text-muted-foreground mb-2">
            Word-level distribution across all responses
          </div>
          <StackedBar
            segments={[
              { value: agg.goodPct, color: 'bg-emerald-500', label: `Good ${Math.round(agg.goodPct)}%` },
              { value: agg.fairPct, color: 'bg-amber-500', label: `Fair ${Math.round(agg.fairPct)}%` },
              { value: agg.poorPct, color: 'bg-rose-500', label: `Poor ${Math.round(agg.poorPct)}%` },
            ]}
          />
          <div className="flex gap-3 mt-2 text-[11px] text-muted-foreground flex-wrap">
            <LegendDot color="bg-emerald-500" label="Good (≥80%)" />
            <LegendDot color="bg-amber-500" label="Fair (70–80%)" />
            <LegendDot color="bg-rose-500" label="Needs work (&lt;70%)" />
          </div>
        </div>

        {/* Per-response color-coded transcripts */}
        <div className="space-y-3">
          {responses.map((r) => (
            <ColoredTranscript key={r.id} response={r} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ColoredTranscript({ response }: { response: ResponseDetail }) {
  const result = (response.speechsuper_response?.result ?? {}) as Record<string, unknown>;
  const sentences = (result.sentences ?? []) as SentenceObj[];
  const question = response.question?.question_text ?? '';

  if (sentences.length === 0) {
    return (
      <div className="rounded-md border bg-muted/30 p-3 text-sm">
        <div className="text-xs text-muted-foreground mb-1">{question}</div>
        <div className="text-foreground/80">
          {response.transcript || <span className="italic">No transcript.</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="text-xs text-muted-foreground mb-1.5">{question}</div>
      <p className="text-sm leading-relaxed">
        {sentences.flatMap((s, si) =>
          (s.details ?? []).map((w, wi) => (
            <span key={`${si}-${wi}`} className={wordColorClass(w.pronunciation)}>
              {w.word}{' '}
            </span>
          )),
        )}
      </p>
    </div>
  );
}

function wordColorClass(score: number): string {
  if (score >= 80) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 70) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

function FluencySection({
  band,
  agg,
}: {
  band: number;
  agg: AggregatedMetrics;
}) {
  // Speaking-rate bar: too-slow (<120) / moderate (120-150) / too-fast (>150)
  const wpm = agg.averageWpm;
  let zoneLabel = 'moderate';
  if (wpm < 120) zoneLabel = 'too slow';
  else if (wpm > 150) zoneLabel = 'too fast';
  const wpmPct = Math.max(0, Math.min(100, ((wpm - 60) / (200 - 60)) * 100));

  return (
    <Card>
      <CardContent className="p-5 sm:p-6">
        <SectionHeader title="Fluency & Coherence" band={band} />

        <div className="space-y-4">
          <MetricRow label="Speech length">
            <span className="text-sm">
              {agg.totalSpeechSeconds.toFixed(1)} s effective
              {agg.totalDurationSeconds > 0 && (
                <span className="text-muted-foreground">
                  {' '}
                  · {agg.totalDurationSeconds.toFixed(1)} s recorded
                </span>
              )}
            </span>
          </MetricRow>

          <div>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-sm text-muted-foreground">Speaking rate</span>
              <span className="text-sm font-medium">
                {wpm} wpm <span className="text-muted-foreground">· {zoneLabel}</span>
              </span>
            </div>
            <div className="relative h-2 rounded-full bg-gradient-to-r from-rose-300 via-emerald-300 to-sky-300 dark:from-rose-900/60 dark:via-emerald-900/60 dark:to-sky-900/60">
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-foreground border-2 border-background shadow"
                style={{ left: `calc(${wpmPct}% - 6px)` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>60</span>
              <span>120</span>
              <span>150</span>
              <span>200</span>
            </div>
          </div>

          <MetricRow label="Pauses">
            <span className="text-sm">{agg.totalPauses} total</span>
          </MetricRow>

          <MetricRow label="Fillers">
            {Object.keys(agg.fillerCounts).length === 0 ? (
              <span className="text-sm text-muted-foreground">None detected</span>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(agg.fillerCounts).map(([k, v]) => (
                  <span
                    key={k}
                    className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
                  >
                    <span className="font-medium">{k}</span>
                    <span className="text-muted-foreground">× {v}</span>
                  </span>
                ))}
              </div>
            )}
          </MetricRow>
        </div>
      </CardContent>
    </Card>
  );
}

function VocabularySection({
  band,
  agg,
}: {
  band: number;
  agg: AggregatedMetrics;
}) {
  return (
    <Card>
      <CardContent className="p-5 sm:p-6">
        <SectionHeader title="Lexical Resource" band={band} />

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
          <Stat label="Words spoken" value={agg.vocabWords.toLocaleString()} />
          <Stat label="Unique words" value={agg.vocabUnique.toLocaleString()} />
          <Stat
            label="Academic words"
            value={agg.academicWords.length.toLocaleString()}
          />
        </div>

        {/* CEFR distribution bar */}
        <div className="mb-5">
          <div className="text-xs text-muted-foreground mb-2">
            CEFR distribution (averaged across responses)
          </div>
          <StackedBar
            segments={(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const).map((lvl) => ({
              value: agg.cefrDistribution[lvl],
              color: cefrColor(lvl),
              label: `${lvl} ${agg.cefrDistribution[lvl]}%`,
            }))}
          />
          <div className="flex gap-3 mt-2 text-[11px] text-muted-foreground flex-wrap">
            {(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const).map((lvl) => (
              <LegendDot key={lvl} color={cefrColor(lvl)} label={`${lvl} ${agg.cefrDistribution[lvl]}%`} />
            ))}
          </div>
        </div>

        {agg.academicWords.length > 0 && (
          <div>
            <div className="text-xs text-muted-foreground mb-1.5">Academic words used</div>
            <div className="flex flex-wrap gap-1.5">
              {agg.academicWords.map((w) => (
                <span
                  key={w}
                  className="inline-flex rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-xs"
                >
                  {w}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function cefrColor(level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'): string {
  switch (level) {
    case 'A1': return 'bg-sky-200 dark:bg-sky-900/60';
    case 'A2': return 'bg-sky-400';
    case 'B1': return 'bg-emerald-400';
    case 'B2': return 'bg-emerald-600';
    case 'C1': return 'bg-violet-500';
    case 'C2': return 'bg-violet-700';
  }
}

function GrammarSection({
  band,
  agg,
  testId,
  partNumber,
}: {
  band: number;
  agg: AggregatedMetrics;
  testId: string;
  partNumber: 1 | 2 | 3;
}) {
  const navigate = useNavigate();
  return (
    <Card>
      <CardContent className="p-5 sm:p-6">
        <SectionHeader
          title="Grammatical Range & Accuracy"
          band={band}
          caption={
            agg.grammarSuggestions.length === 0
              ? 'No grammar suggestions across this attempt.'
              : `${agg.grammarSuggestions.length} suggestion${agg.grammarSuggestions.length === 1 ? '' : 's'}`
          }
        />

        {agg.grammarSuggestions.length === 0 ? (
          <div className="text-sm text-muted-foreground italic">
            Nothing flagged. Nice work.
          </div>
        ) : (
          <ol className="space-y-3">
            {agg.grammarSuggestions.map((s, i) => (
              <li key={i} className="rounded-md border bg-muted/30 p-3 text-sm">
                {s.questionText && (
                  <div className="text-[11px] text-muted-foreground mb-1.5">
                    {s.questionText}
                  </div>
                )}
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Original
                  </span>
                  <div className="text-foreground/80">{s.original}</div>
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Corrected
                  </span>
                  <div className="text-emerald-700 dark:text-emerald-400">
                    {s.corrected}
                  </div>
                </div>
                <div className="mt-2.5 flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() =>
                      navigate(
                        `/ielts/test/${testId}/part/${partNumber}/coach/retry`,
                        {
                          state: {
                            targetMoment: {
                              quote: s.original,
                              category: 'grammatical_correction',
                              rationale: `Stronger version: "${s.corrected}"`,
                              question_text: s.questionText,
                            },
                          },
                        },
                      )
                    }
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    Retry with Coach
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function CefrSection({ agg }: { agg: AggregatedMetrics }) {
  const rows: Array<{ label: string; level: CefrLevel | null }> = [
    { label: 'Pronunciation', level: agg.cefr.pronunciation },
    { label: 'Fluency & Coherence', level: agg.cefr.fluency },
    { label: 'Lexical Resource', level: agg.cefr.lexical },
    { label: 'Grammatical Range & Accuracy', level: agg.cefr.grammar },
  ];

  return (
    <Card>
      <CardContent className="p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
          {/* Overall CEFR ring on the left (mobile: stacked above) */}
          <div className="flex flex-col items-center gap-2 shrink-0">
            <div className="relative w-32 h-32 rounded-full border-4 border-primary flex items-center justify-center">
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Overall</div>
                <div className="text-4xl font-bold leading-none mt-1">
                  {agg.cefr.overall ?? '—'}
                </div>
              </div>
            </div>
            {agg.averageRelevance > 0 && (
              <div className="text-xs text-muted-foreground">
                Topic relevance: <span className="font-semibold text-foreground">{agg.averageRelevance}%</span>
              </div>
            )}
          </div>

          {/* Per-criterion bars on the right */}
          <div className="flex-1 w-full space-y-4">
            {rows.map((r) => (
              <CefrRow key={r.label} label={r.label} level={r.level} />
            ))}
          </div>
        </div>

      </CardContent>
    </Card>
  );
}

const CEFR_INDEX: Record<string, number> = {
  A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6,
};

function CefrRow({
  label,
  level,
}: {
  label: string;
  level: CefrLevel | null;
}) {
  const idx = level ? CEFR_INDEX[level] : 0;
  const pct = (idx / 6) * 100;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-sm font-medium">{label}</span>
        {level ? (
          <CefrChip level={level} />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
        <span>A1</span>
        <span>A2</span>
        <span>B1</span>
        <span>B2</span>
        <span>C1</span>
        <span>C2</span>
      </div>
    </div>
  );
}

// =======================================================================
// UI atoms
// =======================================================================

function StackedBar({
  segments,
}: {
  segments: { value: number; color: string; label?: string }[];
}) {
  const total = segments.reduce((a, b) => a + (b.value || 0), 0);
  return (
    <div className="flex h-3 w-full rounded-full overflow-hidden bg-muted">
      {segments.map((s, i) => {
        if (!s.value || total === 0) return null;
        const pct = (s.value / total) * 100;
        return (
          <div
            key={i}
            className={`${s.color} h-full`}
            style={{ width: `${pct}%` }}
            title={s.label ?? `${pct.toFixed(1)}%`}
          />
        );
      })}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block w-2.5 h-2.5 rounded-full ${color}`} />
      <span>{label}</span>
    </span>
  );
}

function MetricRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="text-right">{children}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-xl font-semibold tabular-nums mt-0.5">{value}</div>
    </div>
  );
}

function ErrorBlock({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive flex items-start gap-3">
      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
      <div className="flex-1">
        <div>{message}</div>
        {onRetry && (
          <Button variant="link" className="p-0 h-auto mt-1" onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-8 flex flex-col items-center gap-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-12 w-32" />
          <Skeleton className="h-3 w-40" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-6 grid grid-cols-4 gap-6">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <Skeleton className="h-20 w-20 rounded-full" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Finalizing your score…
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
