import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useConversation } from '@elevenlabs/react';
import { useQuery } from '@tanstack/react-query';
import {
  PanelLeft,
  ArrowLeft,
  GraduationCap,
  Mic,
  PhoneOff,
  Loader2,
  AlertTriangle,
  MessageCircle,
} from 'lucide-react';
import { AppSidebar } from '@/components/AppSidebar';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  endCoachSession,
  fetchIeltsTestDetail,
  latestFinalizedAttempt,
  startIeltsCoachSession,
  updateCoachSessionConversationId,
  type CoachMode,
  type CoachStartResult,
  type CoachTargetMoment,
  type IeltsPartDetail,
} from '@/services/ielts.service';

type Phase = 'idle' | 'ready' | 'connecting' | 'in_session' | 'ended' | 'error';

interface TranscriptLine {
  speaker: 'coach' | 'student';
  text: string;
  ts: number;
}

const PART_TITLES: Record<1 | 2 | 3, string> = {
  1: 'Part 1 — Personal interview',
  2: 'Part 2 — Cue-card monologue',
  3: 'Part 3 — Abstract discussion',
};

export default function IELTSCoach({ mode = 'part_review' }: { mode?: CoachMode }) {
  const { id: testId = '', partNum: partNumStr = '' } = useParams<{
    id: string;
    partNum: string;
  }>();
  const partNum = Number(partNumStr) as 1 | 2 | 3;
  const navigate = useNavigate();
  const location = useLocation();
  const [showSidebar, setShowSidebar] = useState(false);
  // Retry mode reads the moment from navigation state.
  const targetMoment = (location.state as { targetMoment?: CoachTargetMoment } | null)?.targetMoment;

  useSwipeGesture({
    onSwipeRight: () => {
      if (!showSidebar) setShowSidebar(true);
    },
    minSwipeDistance: 50,
    maxVerticalDistance: 100,
    ignoreSelectors: ['[data-swipe-ignore]'],
  });

  // 1. Find the latest finalized attempt for this user × Part — we coach on that one.
  const { data: test, isPending: testLoading, error: testError } = useQuery({
    queryKey: ['ielts-test-detail', testId],
    queryFn: () => fetchIeltsTestDetail(testId),
    enabled: !!testId,
    staleTime: 60 * 1000,
  });

  const part = useMemo<IeltsPartDetail | null>(() => {
    if (mode === 'mock_review' || !test) return null;
    return test.parts.find((p) => p.part_number === partNum) ?? null;
  }, [mode, test, partNum]);

  const latestAttempt = useMemo(() => {
    if (!part) return null;
    return latestFinalizedAttempt(part.attempts);
  }, [part]);

  // For mock_review the page is "ready" as soon as the test is loaded;
  // for part_review/retry we need a latestAttempt.
  const canStart = mode === 'mock_review' ? !!test : !!latestAttempt;

  // 2. Coach session state
  const [phase, setPhase] = useState<Phase>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [coachStart, setCoachStart] = useState<CoachStartResult | null>(null);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const startedAtRef = useRef<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const elevenConvIdRef = useRef<string | null>(null);

  // 3. ElevenLabs voice hook
  const conversation = useConversation({
    onConnect: () => {
      console.log('[ielts-coach] onConnect');
      setPhase('in_session');
      startedAtRef.current = Date.now();
    },
    onDisconnect: () => {
      console.log('[ielts-coach] onDisconnect');
      setPhase((prev) => (prev === 'connecting' ? 'error' : 'ended'));
    },
    onMessage: ({ source, message }: { source: 'user' | 'ai'; message: string }) => {
      if (!message) return;
      const speaker: TranscriptLine['speaker'] = source === 'user' ? 'student' : 'coach';
      setTranscript((prev) => [...prev, { speaker, text: message, ts: Date.now() }]);
    },
    onError: (e: unknown) => {
      console.error('[ielts-coach] ElevenLabs error:', e);
      setErrorMsg(
        typeof e === 'string'
          ? e
          : e instanceof Error
            ? e.message
            : (e as { message?: string })?.message ?? JSON.stringify(e),
      );
      setPhase('error');
    },
  });

  // Tick the in-session clock
  useEffect(() => {
    if (phase !== 'in_session') return;
    const i = window.setInterval(() => {
      if (startedAtRef.current) {
        setElapsedSec(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }
    }, 500);
    return () => clearInterval(i);
  }, [phase]);

  // Once data is loaded, mark the page as "ready to start".
  useEffect(() => {
    if (canStart && phase === 'idle') {
      setPhase('ready');
    }
  }, [canStart, phase]);

  // If we're in retry mode without a target moment in state, fail fast.
  useEffect(() => {
    if (mode === 'retry' && !targetMoment) {
      setErrorMsg(
        'Retry needs a specific moment to practise. Go back to the results page and tap "Retry with Coach" on a flagged moment.',
      );
      setPhase('error');
    }
  }, [mode, targetMoment]);

  // User-initiated start: explicit click requests mic + opens the WS session.
  const handleStart = async () => {
    if (!canStart || phase === 'connecting' || phase === 'in_session') return;
    setPhase('connecting');
    setErrorMsg(null);
    setTranscript([]);

    try {
      // Request mic permission up-front so the prompt happens in a clean
      // user-gesture context — the SDK will use the granted permission.
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // We don't need the stream ourselves; release it so the SDK can grab one.
        stream.getTracks().forEach((t) => t.stop());
      } catch (permErr) {
        throw new Error(
          permErr instanceof Error
            ? `Microphone access blocked: ${permErr.message}`
            : 'Microphone access blocked.',
        );
      }

      console.log('[ielts-coach] requesting signed URL…', { mode });
      const res = await startIeltsCoachSession(
        mode === 'mock_review'
          ? { mode: 'mock_review', testId }
          : mode === 'retry'
            ? { mode: 'retry', attemptId: latestAttempt!.id, targetMoment }
            : { mode: 'part_review', attemptId: latestAttempt!.id },
      );
      console.log('[ielts-coach] got signed URL + dynamic vars', {
        mode: res.mode,
        vars: Object.keys(res.dynamic_variables),
      });
      setCoachStart(res);

      console.log('[ielts-coach] startSession()');
      const sessionInfo = await conversation.startSession({
        signedUrl: res.signed_url,
        dynamicVariables: res.dynamic_variables,
      });
      console.log('[ielts-coach] startSession resolved with', sessionInfo);

      // ElevenLabs returns the conversation ID as the resolved value.
      if (sessionInfo && typeof sessionInfo === 'string') {
        elevenConvIdRef.current = sessionInfo;
        await updateCoachSessionConversationId(res.coach_session_id, sessionInfo).catch(
          (e) => console.warn('[ielts-coach] persist conv id failed:', e),
        );
      } else {
        // Fallback: pull from URL query
        try {
          const u = new URL(res.signed_url.replace('wss://', 'https://'));
          const fromUrl = u.searchParams.get('conversation_id');
          if (fromUrl) {
            elevenConvIdRef.current = fromUrl;
            await updateCoachSessionConversationId(res.coach_session_id, fromUrl).catch(
              (e) => console.warn('[ielts-coach] persist conv id failed:', e),
            );
          }
        } catch {
          // ignore
        }
      }
    } catch (e) {
      console.error('[ielts-coach] start failed:', e);
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setPhase('error');
    }
  };

  // Finalize on disconnect
  useEffect(() => {
    if (phase !== 'ended' || !coachStart) return;
    // For mock_review we don't bump any single attempt; for part_review / retry
    // mark the attempt coach_complete.
    const attemptToMark = mode === 'mock_review' ? null : latestAttempt?.id ?? null;
    endCoachSession(coachStart.coach_session_id, attemptToMark).catch((e) => {
      console.warn('endCoachSession failed:', e);
    });
  }, [phase, coachStart, latestAttempt, mode]);

  const handleEnd = async () => {
    try {
      await conversation.endSession();
    } catch (e) {
      console.warn('endSession error:', e);
    }
  };

  // ============================================================
  // Render
  // ============================================================
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
            aria-label="Back to test"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Test</span>
          </button>
          <GraduationCap className="w-5 h-5 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="text-xs text-muted-foreground leading-tight">
              {test ? `Test ${test.ordering} · ${test.theme}` : 'IELTS Coach'}
            </div>
            <div className="text-base font-semibold truncate leading-tight">
              {mode === 'mock_review'
                ? 'Coach — Full mock review'
                : mode === 'retry'
                  ? `Coach — Retry · ${PART_TITLES[partNum]}`
                  : `Coach — ${PART_TITLES[partNum]}`}
            </div>
          </div>
          {phase === 'in_session' && (
            <span className="text-xs text-muted-foreground tabular-nums shrink-0">
              {formatMMSS(elapsedSec)}
            </span>
          )}
        </header>

        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto">
            <div className="max-w-3xl mx-auto p-4 sm:p-6">
              {testLoading && <SetupSkeleton />}

              {testError && (
                <ErrorBlock
                  message={(testError as Error).message ?? 'Failed to load test.'}
                />
              )}

              {!testLoading && !testError && mode !== 'mock_review' && !latestAttempt && (
                <NoAttemptBlock onBack={() => navigate(`/ielts/test/${testId}`)} />
              )}

              {phase === 'ready' && (
                <ReadyBlock
                  mode={mode}
                  partLabel={
                    mode === 'mock_review'
                      ? 'Full mock review'
                      : PART_TITLES[partNum]
                  }
                  targetMoment={targetMoment}
                  onStart={handleStart}
                />
              )}

              {phase === 'connecting' && <ConnectingBlock />}

              {phase === 'error' && (
                <ErrorBlock
                  message={errorMsg ?? 'Something went wrong starting the session.'}
                  onRetry={() => {
                    setPhase('ready');
                    setErrorMsg(null);
                    setCoachStart(null);
                  }}
                />
              )}

              {(phase === 'in_session' || phase === 'ended') && (
                <TranscriptView
                  transcript={transcript}
                  ended={phase === 'ended'}
                />
              )}
            </div>
          </div>

          {/* Controls bar */}
          {(phase === 'in_session' || phase === 'connecting') && (
            <div className="border-t bg-background/95 backdrop-blur p-4 shrink-0">
              <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mic
                    className={`w-4 h-4 ${
                      phase === 'in_session'
                        ? 'text-primary animate-pulse'
                        : 'text-muted-foreground'
                    }`}
                  />
                  {phase === 'in_session' ? 'Listening… speak naturally.' : 'Connecting…'}
                </div>
                <Button
                  variant="destructive"
                  onClick={handleEnd}
                  disabled={phase !== 'in_session'}
                >
                  <PhoneOff className="w-4 h-4 mr-1.5" />
                  End session
                </Button>
              </div>
            </div>
          )}

          {phase === 'ended' && (
            <div className="border-t bg-background/95 backdrop-blur p-4 shrink-0">
              <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-3 justify-between">
                <span className="text-sm text-muted-foreground">
                  Session ended. Talk again or jump back to your results.
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setPhase('ready');
                      setCoachStart(null);
                      setTranscript([]);
                      elevenConvIdRef.current = null;
                    }}
                  >
                    <MessageCircle className="w-4 h-4 mr-1.5" />
                    Talk again
                  </Button>
                  <Button
                    onClick={() =>
                      latestAttempt &&
                      navigate(`/ielts/attempt/${latestAttempt.id}/results`)
                    }
                  >
                    See results
                  </Button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function TranscriptView({
  transcript,
  ended,
}: {
  transcript: TranscriptLine[];
  ended: boolean;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [transcript.length]);

  return (
    <div className="space-y-3">
      {transcript.length === 0 && !ended && (
        <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground text-center">
          Your Coach is preparing your debrief…
        </div>
      )}
      {transcript.map((line, i) => (
        <Line key={i} line={line} />
      ))}
      {ended && transcript.length === 0 && (
        <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground text-center">
          Session ended before any messages were exchanged.
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}

function Line({ line }: { line: TranscriptLine }) {
  const isCoach = line.speaker === 'coach';
  return (
    <div className={`flex ${isCoach ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
          isCoach
            ? 'bg-muted text-foreground rounded-tl-sm'
            : 'bg-primary text-primary-foreground rounded-tr-sm'
        }`}
      >
        {!isCoach || (
          <div className="text-[10px] uppercase tracking-wide opacity-60 mb-0.5">
            Coach
          </div>
        )}
        {line.text}
      </div>
    </div>
  );
}

function ReadyBlock({
  mode,
  partLabel,
  targetMoment,
  onStart,
}: {
  mode: CoachMode;
  partLabel: string;
  targetMoment?: CoachTargetMoment;
  onStart: () => void;
}) {
  const pitchByMode: Record<CoachMode, string> = {
    part_review: `We'll review your ${partLabel}, point out what worked, and practise the trickier moments.`,
    mock_review: `We'll debrief your full 3-Part performance — what carried you, and the highest-impact things to lift next.`,
    retry: `We'll re-attempt one specific moment from ${partLabel}, capped at three tries.`,
  };

  return (
    <Card>
      <CardContent className="p-6 sm:p-10 flex flex-col items-center gap-5 text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center">
          <MessageCircle className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <div className="text-base font-semibold">Ready to talk with your Coach?</div>
          <div className="text-sm text-muted-foreground max-w-md">
            {pitchByMode[mode]} Tap below to start — your microphone will stay
            active during the session.
          </div>
        </div>

        {mode === 'retry' && targetMoment && (
          <div className="w-full max-w-md rounded-md border bg-muted/40 p-3 text-left text-sm space-y-1">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Retry target
            </div>
            <div className="italic">"{targetMoment.quote}"</div>
            {targetMoment.rationale && (
              <div className="text-xs text-muted-foreground">
                {targetMoment.rationale}
              </div>
            )}
          </div>
        )}

        <Button size="lg" onClick={onStart} className="gap-2">
          <Mic className="w-4 h-4" />
          {mode === 'mock_review'
            ? 'Start full mock review'
            : mode === 'retry'
              ? 'Start retry'
              : 'Start Coach session'}
        </Button>
        <div className="text-[11px] text-muted-foreground">
          Speak naturally — you can interrupt, ask questions, or end any time.
        </div>
      </CardContent>
    </Card>
  );
}

function ConnectingBlock() {
  return (
    <Card>
      <CardContent className="p-8 flex flex-col items-center gap-3 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        <div className="text-sm">Connecting you with your Coach…</div>
        <div className="text-xs text-muted-foreground max-w-md">
          We're packaging your session transcript and scores so your Coach can
          start with specific feedback.
        </div>
      </CardContent>
    </Card>
  );
}

function NoAttemptBlock({ onBack }: { onBack: () => void }) {
  return (
    <Card>
      <CardContent className="p-6 sm:p-8 flex flex-col items-center gap-4 text-center">
        <AlertTriangle className="w-8 h-8 text-amber-500" />
        <div className="text-base font-semibold">No finished attempt yet</div>
        <p className="text-sm text-muted-foreground max-w-md">
          Complete the Examiner session for this Part first — the Coach uses
          your results as the starting point.
        </p>
        <Button onClick={onBack}>Back to test</Button>
      </CardContent>
    </Card>
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
    <Card>
      <CardContent className="p-6 sm:p-8 flex flex-col items-center gap-4 text-center">
        <AlertTriangle className="w-8 h-8 text-destructive" />
        <div className="text-sm text-destructive max-w-md">{message}</div>
        {onRetry && (
          <Button variant="outline" onClick={onRetry}>
            Try again
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function SetupSkeleton() {
  return (
    <Card>
      <CardContent className="p-6 space-y-3">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-3/4" />
      </CardContent>
    </Card>
  );
}

function formatMMSS(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
