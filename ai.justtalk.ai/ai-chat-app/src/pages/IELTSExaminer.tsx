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
  RefreshCw,
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
import {
  trackIeltsExaminerStarted,
  trackIeltsRecordingStarted,
  trackIeltsAnswerRecorded,
  trackIeltsResponseScored,
  trackIeltsExaminerCompleted,
} from '@/lib/ielts-analytics';

// Transient state for the CURRENT question's recorder only.
type RecPhase = 'idle' | 'preparing' | 'recording';

// Background scoring job per question.
type JobStatus = 'uploading' | 'done' | 'error';
interface ScoreJob {
  questionId: string;
  questionLabel: string;
  status: JobStatus;
  error?: string;
  blob: Blob | null; // retained so a failed job can be retried
}

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

  const { data: attempt, isPending: attemptLoading, error: attemptError } = useQuery({
    queryKey: ['ielts-attempt', part?.id],
    queryFn: () => startOrResumeExaminerAttempt(part!.id),
    enabled: !!part?.id,
    staleTime: 0,
  });

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

  // ------------------------------------------------------------------
  // Background scoring jobs
  // ------------------------------------------------------------------
  const [jobs, setJobs] = useState<Record<string, ScoreJob>>({});

  const runJob = (questionId: string, questionLabel: string, blob: Blob) => {
    if (!attempt) return;
    setJobs((prev) => ({
      ...prev,
      [questionId]: { questionId, questionLabel, status: 'uploading', blob },
    }));
    processIeltsResponse(attempt.id, questionId, blob)
      .then(() => {
        setJobs((prev) => ({
          ...prev,
          [questionId]: { ...prev[questionId], status: 'done', blob: null, error: undefined },
        }));
        trackIeltsResponseScored({ attemptId: attempt.id, questionId, success: true });
        void refetchResponses();
      })
      .catch((e) => {
        console.error('[ielts-examiner] background score failed:', e);
        trackIeltsResponseScored({
          attemptId: attempt.id,
          questionId,
          success: false,
          error: e instanceof Error ? e.message : 'Scoring failed.',
        });
        setJobs((prev) => ({
          ...prev,
          [questionId]: {
            ...prev[questionId],
            status: 'error',
            error: e instanceof Error ? e.message : 'Scoring failed.',
          },
        }));
      });
  };

  const uploadingCount = useMemo(
    () => Object.values(jobs).filter((j) => j.status === 'uploading').length,
    [jobs],
  );
  const errorJobs = useMemo(
    () => Object.values(jobs).filter((j) => j.status === 'error'),
    [jobs],
  );

  // A question counts as "captured" if the server already has it (resume) or
  // we have a job for it (this session, any status).
  const capturedQuestionIds = useMemo(() => {
    const s = new Set<string>(answeredQuestionIds);
    Object.keys(jobs).forEach((id) => s.add(id));
    return s;
  }, [answeredQuestionIds, jobs]);

  // ------------------------------------------------------------------
  // Question cursor
  // ------------------------------------------------------------------
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

  const allDone =
    !!part && questionIndex !== null && questionIndex >= part.questions.length;

  // ------------------------------------------------------------------
  // Analytics — fire once per attempt / once on completion
  // ------------------------------------------------------------------
  const startedTrackedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!test || !part || !attempt) return;
    if (startedTrackedRef.current === attempt.id) return;
    startedTrackedRef.current = attempt.id;
    trackIeltsExaminerStarted({
      testId: test.id,
      theme: test.theme,
      partNumber: part.part_number,
      attemptId: attempt.id,
      attemptNumber: attempt.attempt_number,
      resumed: !attempt.created,
      totalQuestions: part.questions.length,
    });
  }, [test, part, attempt]);

  // ------------------------------------------------------------------
  // Recorder state (current question only)
  // ------------------------------------------------------------------
  const [recPhase, setRecPhase] = useState<RecPhase>('idle');
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    setRecPhase('idle');
    setErrorMsg(null);
    setSecondsLeft(part?.max_response_sec ?? 0);
  }, [currentQuestion?.id, part?.max_response_sec]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recorderRef.current?.cleanup?.();
    };
  }, []);

  // Warn before leaving while uploads are still in flight.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (uploadingCount > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [uploadingCount]);

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleStartRecord = async () => {
    if (!part || !currentQuestion) return;
    setErrorMsg(null);
    setRecPhase('preparing');
    try {
      recorderRef.current = new AudioRecorder();
      await recorderRef.current.initialize();
      recorderRef.current.startRecording();
      setSecondsLeft(part.max_response_sec);
      setRecPhase('recording');
      if (attempt) {
        trackIeltsRecordingStarted({
          testId,
          partNumber: part.part_number,
          attemptId: attempt.id,
          questionId: currentQuestion.id,
          questionIndex: questionIndex ?? 0,
        });
      }

      timerRef.current = window.setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
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
      setRecPhase('idle');
    }
  };

  /**
   * Stop recording, fire the scoring job in the BACKGROUND, and advance to the
   * next question immediately. The only thing we await is the (fast) WAV encode.
   */
  const handleStopRecord = async (auto = false) => {
    if (!attempt || !currentQuestion || !part) return;
    if (recPhase !== 'recording' && !auto) return;
    stopTimer();

    const q = currentQuestion;
    const qIndex = questionIndex ?? 0;
    try {
      const wav = await recorderRef.current!.stopRecording();
      trackIeltsAnswerRecorded({
        testId,
        partNumber: part.part_number,
        attemptId: attempt.id,
        questionId: q.id,
        questionIndex: qIndex,
        autoStopped: auto,
      });
      runJob(q.id, q.question_text, wav); // no await — scores in background
    } catch (e) {
      console.error('Recorder stop failed:', e);
      // Record a failed job so the user can retry from the Done panel.
      setJobs((prev) => ({
        ...prev,
        [q.id]: {
          questionId: q.id,
          questionLabel: q.question_text,
          status: 'error',
          blob: null,
          error: e instanceof Error ? e.message : 'Recording failed.',
        },
      }));
    } finally {
      recorderRef.current?.cleanup?.();
      recorderRef.current = null;
    }

    // Advance right away — the upload keeps running in the background.
    setRecPhase('idle');
    setQuestionIndex((i) => (i === null ? 0 : i + 1));
  };

  const retryJob = (questionId: string) => {
    const job = jobs[questionId];
    if (!job || !job.blob) return; // can't retry without the audio; user must re-record
    runJob(questionId, job.questionLabel, job.blob);
  };

  const recordedCount = capturedQuestionIds.size;
  const totalQuestions = part?.questions.length ?? 0;
  const scoredCount = useMemo(() => {
    // server rows + done jobs not yet reflected in server fetch
    const ids = new Set<string>(answeredQuestionIds);
    Object.values(jobs).forEach((j) => {
      if (j.status === 'done') ids.add(j.questionId);
    });
    return ids.size;
  }, [answeredQuestionIds, jobs]);

  const completedTrackedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!allDone || !test || !part || !attempt) return;
    if (completedTrackedRef.current === attempt.id) return;
    completedTrackedRef.current = attempt.id;
    trackIeltsExaminerCompleted({
      testId: test.id,
      partNumber: part.part_number,
      attemptId: attempt.id,
      totalQuestions: part.questions.length,
      scoredCount,
    });
  }, [allDone, test, part, attempt, scoredCount]);

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
                  total={totalQuestions}
                  recorded={recordedCount}
                  scoring={uploadingCount}
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
                  phase={recPhase}
                  secondsLeft={secondsLeft}
                  maxSeconds={part.max_response_sec}
                  errorMsg={errorMsg}
                  onStart={handleStartRecord}
                  onStop={() => void handleStopRecord(false)}
                />
                {/* Background scoring is non-blocking — let the user know. */}
                {uploadingCount > 0 && (
                  <div className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Scoring {uploadingCount} previous{' '}
                    {uploadingCount === 1 ? 'answer' : 'answers'} in the background
                  </div>
                )}
              </>
            )}

            {allDone && part && attempt && (
              <DonePanel
                total={totalQuestions}
                scored={scoredCount}
                uploading={uploadingCount}
                errorJobs={errorJobs}
                onRetry={retryJob}
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
  recorded,
  scoring,
}: {
  current: number;
  total: number;
  recorded: number;
  scoring: number;
}) {
  const pct = Math.round((recorded / Math.max(1, total)) * 100);
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
        <span>
          Question {Math.min(current, total)} of {total}
        </span>
        <span className="flex items-center gap-2">
          <span>
            {recorded}/{total} recorded
          </span>
          {scoring > 0 && (
            <span className="inline-flex items-center gap-1 text-primary">
              <Loader2 className="w-3 h-3 animate-spin" />
              {scoring} scoring
            </span>
          )}
        </span>
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
  phase,
  secondsLeft,
  maxSeconds,
  errorMsg,
  onStart,
  onStop,
}: {
  phase: RecPhase;
  secondsLeft: number;
  maxSeconds: number;
  errorMsg: string | null;
  onStart: () => void;
  onStop: () => void;
}) {
  const elapsed = maxSeconds - secondsLeft;
  const elapsedPct = Math.round((elapsed / Math.max(1, maxSeconds)) * 100);

  return (
    <Card>
      <CardContent className="p-5 sm:p-6 flex flex-col items-center gap-4">
        {phase === 'recording' && (
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
              Stop &amp; next
            </Button>
            <div className="text-[11px] text-muted-foreground">
              Auto-stops at the time limit. Scoring happens in the background.
            </div>
          </>
        )}

        {phase === 'idle' && (
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
            {errorMsg && (
              <div className="text-xs text-center text-destructive max-w-sm">
                {errorMsg}
              </div>
            )}
          </>
        )}

        {phase === 'preparing' && (
          <>
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            <div className="text-sm text-muted-foreground">Preparing microphone…</div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function DonePanel({
  total,
  scored,
  uploading,
  errorJobs,
  onRetry,
  onSeeResults,
  onBack,
}: {
  total: number;
  scored: number;
  uploading: number;
  errorJobs: ScoreJob[];
  onRetry: (questionId: string) => void;
  onSeeResults: () => void;
  onBack: () => void;
}) {
  const hasErrors = errorJobs.length > 0;
  const stillWorking = uploading > 0;
  const allScored = !stillWorking && !hasErrors;

  return (
    <Card>
      <CardContent className="p-6 sm:p-8 flex flex-col items-center gap-4 text-center">
        {allScored ? (
          <CheckCircle2 className="w-10 h-10 text-emerald-500" />
        ) : stillWorking ? (
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
        ) : (
          <AlertTriangle className="w-10 h-10 text-amber-500" />
        )}

        <h2 className="text-lg font-semibold">
          {allScored ? 'All answers recorded & scored' : 'All answers recorded'}
        </h2>

        <p className="text-sm text-muted-foreground max-w-md">
          {stillWorking
            ? `Finishing scoring — ${scored}/${total} done. This only takes a moment.`
            : hasErrors
              ? `${scored}/${total} scored. A few responses need another go before we can total your Part.`
              : "We've scored every response. Open your results for the full breakdown."}
        </p>

        {stillWorking && (
          <div className="w-full max-w-sm">
            <Progress value={Math.round((scored / Math.max(1, total)) * 100)} className="h-1.5" />
          </div>
        )}

        {hasErrors && (
          <div className="w-full max-w-sm space-y-2 text-left">
            {errorJobs.map((j) => (
              <div
                key={j.questionId}
                className="flex items-center justify-between gap-2 rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-950/20 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="text-xs font-medium truncate">{j.questionLabel}</div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {j.blob ? j.error ?? 'Scoring failed' : 'Audio lost — please re-record'}
                  </div>
                </div>
                {j.blob ? (
                  <Button size="sm" variant="outline" className="shrink-0 gap-1" onClick={() => onRetry(j.questionId)}>
                    <RefreshCw className="w-3.5 h-3.5" />
                    Retry
                  </Button>
                ) : (
                  <span className="text-[10px] text-muted-foreground shrink-0">re-record</span>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 w-full max-w-sm mt-2">
          <Button
            onClick={onSeeResults}
            className="flex-1"
            disabled={!allScored}
          >
            {stillWorking ? 'Scoring…' : 'See results'}
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
