import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Mic,
  Square,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  PanelLeft,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { AppSidebar } from '@/components/AppSidebar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { AudioRecorder } from '@/lib/audioRecorder';
import {
  fetchIeltsTestDetail,
  startOrResumeExaminerAttempt,
  fetchAttemptResponses,
  processIeltsResponse,
  type IeltsPartDetail,
  type IeltsQuestion,
} from '@/services/ielts.service';

type RecordingState =
  | 'idle'
  | 'preparing'
  | 'recording'
  | 'uploading'
  | 'saved'
  | 'error';

const PART_TITLES: Record<1 | 2 | 3, string> = {
  1: 'Part 1 — Personal interview',
  2: 'Part 2 — Cue-card monologue',
  3: 'Part 3 — Abstract discussion',
};

export default function IELTSExaminer() {
  const { id: testId = '', partNum: partNumStr = '' } = useParams<{
    id: string;
    partNum: string;
  }>();
  const partNum = Number(partNumStr) as 1 | 2 | 3;
  const navigate = useNavigate();
  const [showSidebar, setShowSidebar] = useState(false);

  const { data: test, isPending: testLoading, error: testError } = useQuery({
    queryKey: ['ielts-test-detail', testId],
    queryFn: () => fetchIeltsTestDetail(testId),
    enabled: !!testId,
    staleTime: 60 * 1000,
  });

  const part = useMemo<IeltsPartDetail | null>(() => {
    if (!test) return null;
    return test.parts.find((p) => p.part_number === partNum) ?? null;
  }, [test, partNum]);

  // Resolve or create the active attempt for this part
  const { data: attempt, isPending: attemptLoading, error: attemptError } = useQuery({
    queryKey: ['ielts-attempt', part?.id],
    queryFn: () => startOrResumeExaminerAttempt(part!.id),
    enabled: !!part?.id,
    staleTime: 0,
  });

  // Existing responses for this attempt (to resume mid-attempt)
  const { data: existingResponses, refetch: refetchResponses } = useQuery({
    queryKey: ['ielts-attempt-responses', attempt?.id],
    queryFn: () => fetchAttemptResponses(attempt!.id),
    enabled: !!attempt?.id,
    staleTime: 0,
  });

  const answeredQuestionIds = useMemo(
    () => new Set((existingResponses ?? []).map((r) => r.question_id)),
    [existingResponses],
  );

  // Pick the first unanswered question as the cursor
  const [questionIndex, setQuestionIndex] = useState<number | null>(null);
  useEffect(() => {
    if (!part || questionIndex !== null) return;
    const idx = part.questions.findIndex((q) => !answeredQuestionIds.has(q.id));
    setQuestionIndex(idx === -1 ? part.questions.length : idx);
  }, [part, answeredQuestionIds, questionIndex]);

  const currentQuestion: IeltsQuestion | null = useMemo(() => {
    if (!part || questionIndex === null) return null;
    return part.questions[questionIndex] ?? null;
  }, [part, questionIndex]);

  const allDone = !!part && questionIndex !== null && questionIndex >= part.questions.length;

  // ------------------------------------------------------------------
  // Recorder state
  // ------------------------------------------------------------------
  const [recState, setRecState] = useState<RecordingState>('idle');
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const timerRef = useRef<number | null>(null);
  const stopOnTimeoutRef = useRef<boolean>(false);

  // Reset state when question changes
  useEffect(() => {
    setRecState('idle');
    setErrorMsg(null);
    setSecondsLeft(part?.max_response_sec ?? 0);
  }, [currentQuestion?.id, part?.max_response_sec]);

  // Cleanup recorder on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recorderRef.current?.cleanup?.();
    };
  }, []);

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleStartRecord = async () => {
    if (!part || !currentQuestion) return;
    setErrorMsg(null);
    setRecState('preparing');
    try {
      recorderRef.current = new AudioRecorder();
      await recorderRef.current.initialize();
      recorderRef.current.startRecording();
      setSecondsLeft(part.max_response_sec);
      setRecState('recording');
      stopOnTimeoutRef.current = false;

      timerRef.current = window.setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            stopOnTimeoutRef.current = true;
            // schedule stop outside this setState
            queueMicrotask(() => {
              void handleStopRecord(true);
            });
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } catch (e) {
      console.error('Recorder init failed:', e);
      setErrorMsg(e instanceof Error ? e.message : 'Microphone unavailable.');
      setRecState('error');
    }
  };

  const handleStopRecord = async (auto = false) => {
    if (!attempt || !currentQuestion || !part) return;
    if (recState !== 'recording' && !auto) return;
    stopTimer();
    setRecState('uploading');
    try {
      const wav = await recorderRef.current!.stopRecording();
      // Note: AudioRecorder yields a WAV Blob (PCM16/16k/mono)
      await processIeltsResponse(attempt.id, currentQuestion.id, wav);
      setRecState('saved');
      // Pause briefly so user sees confirmation, then advance.
      window.setTimeout(() => {
        void refetchResponses();
        setQuestionIndex((i) => (i === null ? 0 : i + 1));
      }, 700);
    } catch (e) {
      console.error('Upload/score failed:', e);
      setErrorMsg(e instanceof Error ? e.message : 'Scoring failed.');
      setRecState('error');
    } finally {
      // Release the mic stream regardless
      recorderRef.current?.cleanup?.();
      recorderRef.current = null;
    }
  };

  const retry = () => {
    setErrorMsg(null);
    setRecState('idle');
    setSecondsLeft(part?.max_response_sec ?? 0);
  };

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
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
            onClick={() => navigate(`/ielts/test/${testId}`)}
            className="p-1.5 rounded-md hover:bg-muted flex items-center gap-1.5 text-sm"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-xs text-muted-foreground leading-tight">
              {test ? `Test ${test.ordering} · ${test.theme}` : 'IELTS Examiner'}
            </div>
            <div className="text-base font-semibold truncate leading-tight">
              {PART_TITLES[partNum]}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="max-w-2xl mx-auto p-4 sm:p-6">
            {(testLoading || attemptLoading) && <RecorderSkeleton />}
            {(testError || attemptError) && (
              <ErrorBlock
                message={(testError ?? attemptError)?.message ?? 'Failed to load.'}
              />
            )}

            {part && attempt && !allDone && currentQuestion && (
              <>
                <ProgressHeader
                  current={questionIndex! + 1}
                  total={part.questions.length}
                  answered={existingResponses?.length ?? 0}
                />
                <QuestionCard
                  question={currentQuestion}
                  topicName={
                    currentQuestion.test_topic_id
                      ? part.topics.find(
                          (t) => t.id === currentQuestion.test_topic_id,
                        )?.topic_name ?? null
                      : null
                  }
                  isCueCard={part.part_number === 2}
                />
                <RecorderControls
                  state={recState}
                  secondsLeft={secondsLeft}
                  maxSeconds={part.max_response_sec}
                  errorMsg={errorMsg}
                  onStart={handleStartRecord}
                  onStop={() => void handleStopRecord(false)}
                  onRetry={retry}
                />
              </>
            )}

            {allDone && part && attempt && (
              <DonePanel
                onSeeResults={() => navigate(`/ielts/attempt/${attempt.id}/results`)}
                onBack={() => navigate(`/ielts/test/${testId}`)}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

// ====================================================================
// Sub-components
// ====================================================================

function ProgressHeader({
  current,
  total,
  answered,
}: {
  current: number;
  total: number;
  answered: number;
}) {
  const pct = Math.round((answered / total) * 100);
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
        <span>
          Question {current} of {total}
        </span>
        <span>{answered}/{total} recorded</span>
      </div>
      <Progress value={pct} className="h-1.5" />
    </div>
  );
}

function QuestionCard({
  question,
  topicName,
  isCueCard,
}: {
  question: IeltsQuestion;
  topicName: string | null;
  isCueCard: boolean;
}) {
  return (
    <Card className="mb-4">
      <CardContent className="p-5 sm:p-6">
        {topicName && (
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
            Topic — {topicName}
          </div>
        )}
        {isCueCard ? (
          <pre className="text-base whitespace-pre-wrap font-sans leading-relaxed">
            {question.question_text}
          </pre>
        ) : (
          <h2 className="text-lg sm:text-xl font-semibold leading-snug">
            {question.question_text}
          </h2>
        )}
      </CardContent>
    </Card>
  );
}

function RecorderControls({
  state,
  secondsLeft,
  maxSeconds,
  errorMsg,
  onStart,
  onStop,
  onRetry,
}: {
  state: RecordingState;
  secondsLeft: number;
  maxSeconds: number;
  errorMsg: string | null;
  onStart: () => void;
  onStop: () => void;
  onRetry: () => void;
}) {
  const elapsed = maxSeconds - secondsLeft;
  const elapsedPct = Math.round((elapsed / Math.max(1, maxSeconds)) * 100);

  return (
    <Card>
      <CardContent className="p-5 sm:p-6 flex flex-col items-center gap-4">
        {state === 'recording' && (
          <>
            <div className="text-xs text-muted-foreground">Recording…</div>
            <div className="text-4xl font-semibold tabular-nums">
              {formatMMSS(secondsLeft)}
            </div>
            <Progress value={elapsedPct} className="h-1.5 w-full" />
            <Button
              size="lg"
              variant="destructive"
              className="w-full max-w-xs gap-2"
              onClick={onStop}
            >
              <Square className="w-4 h-4 fill-current" />
              Stop &amp; submit
            </Button>
            <div className="text-[11px] text-muted-foreground">
              Auto-stops at the time limit.
            </div>
          </>
        )}

        {state === 'idle' && (
          <>
            <div className="text-xs text-muted-foreground">
              Up to {maxSeconds}s • tap to record
            </div>
            <Button
              size="lg"
              className="w-full max-w-xs gap-2 h-16 text-base"
              onClick={onStart}
            >
              <Mic className="w-5 h-5" />
              Record your answer
            </Button>
          </>
        )}

        {state === 'preparing' && (
          <>
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            <div className="text-sm text-muted-foreground">Preparing microphone…</div>
          </>
        )}

        {state === 'uploading' && (
          <>
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            <div className="text-sm text-muted-foreground">Scoring your response…</div>
          </>
        )}

        {state === 'saved' && (
          <>
            <CheckCircle2 className="w-7 h-7 text-emerald-500" />
            <div className="text-sm">Saved. Moving on…</div>
          </>
        )}

        {state === 'error' && (
          <>
            <AlertTriangle className="w-7 h-7 text-destructive" />
            <div className="text-sm text-center text-destructive max-w-sm">
              {errorMsg ?? 'Something went wrong.'}
            </div>
            <Button onClick={onRetry} variant="outline">
              Try again
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function DonePanel({
  onSeeResults,
  onBack,
}: {
  onSeeResults: () => void;
  onBack: () => void;
}) {
  return (
    <Card>
      <CardContent className="p-6 sm:p-8 flex flex-col items-center gap-4 text-center">
        <CheckCircle2 className="w-10 h-10 text-emerald-500" />
        <h2 className="text-lg font-semibold">All questions recorded</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          We're computing your Part band scores and breakdown.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 w-full max-w-sm mt-2">
          <Button onClick={onSeeResults} className="flex-1">
            See results
          </Button>
          <Button onClick={onBack} variant="outline" className="flex-1">
            Back to test
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ErrorBlock({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
      {message}
    </div>
  );
}

function RecorderSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-2 w-full" />
      <Card>
        <CardContent className="p-5 space-y-3">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-6 w-2/3" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-6 flex flex-col items-center gap-4">
          <Skeleton className="h-16 w-full max-w-xs" />
        </CardContent>
      </Card>
    </div>
  );
}

function formatMMSS(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
