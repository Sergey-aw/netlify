import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useConversation } from '@elevenlabs/react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  Mic,
  MicOff,
  X,
  Loader2,
  AlertTriangle,
  MessageCircle,
  GraduationCap,
  AudioWaveform,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { VoiceBars } from '@/components/VoiceBars';
import { cn } from '@/lib/utils';
import bgWelcome from '@/assets/bg_welcome.jpg';
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
  const targetMoment = (location.state as { targetMoment?: CoachTargetMoment } | null)?.targetMoment;

  // ============================================================
  // Test + attempt resolution
  // ============================================================
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

  const canStart = mode === 'mock_review' ? !!test : !!latestAttempt;

  // ============================================================
  // Session state
  // ============================================================
  const [phase, setPhase] = useState<Phase>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [coachStart, setCoachStart] = useState<CoachStartResult | null>(null);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const startedAtRef = useRef<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const elevenConvIdRef = useRef<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  // ============================================================
  // Audio analyzer — drives the voice bars in the header.
  // ============================================================
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [audioLevels, setAudioLevels] = useState<number[]>([]);

  const initAudioAnalyzer = () => {
    try {
      if (audioContextRef.current) return;
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioContextRef.current = new Ctx();
      analyzerRef.current = audioContextRef.current.createAnalyser();
      analyzerRef.current.fftSize = 32;
      analyzerRef.current.smoothingTimeConstant = 0.8;

      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          micStreamRef.current = stream;
          const source = audioContextRef.current!.createMediaStreamSource(stream);
          source.connect(analyzerRef.current!);
          updateAudioLevels();
        })
        .catch((err) => {
          console.warn('[ielts-coach] mic analyzer denied:', err);
        });
    } catch (err) {
      console.error('[ielts-coach] analyzer init failed:', err);
    }
  };

  const updateAudioLevels = () => {
    if (!analyzerRef.current) return;
    const dataArray = new Uint8Array(analyzerRef.current.frequencyBinCount);
    const analyze = () => {
      if (!analyzerRef.current) return;
      analyzerRef.current.getByteFrequencyData(dataArray);
      const levels = Array.from(dataArray.slice(0, 8)).map((v) =>
        Math.max(0.2, v / 255),
      );
      setAudioLevels(levels);
      animationFrameRef.current = requestAnimationFrame(analyze);
    };
    analyze();
  };

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      audioContextRef.current?.close().catch(() => {});
    };
  }, []);

  // ============================================================
  // ElevenLabs voice hook
  // ============================================================
  const conversation = useConversation({
    onConnect: () => {
      console.log('[ielts-coach] onConnect');
      setPhase('in_session');
      startedAtRef.current = Date.now();
      initAudioAnalyzer();
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

  // In-session timer
  useEffect(() => {
    if (phase !== 'in_session') return;
    const i = window.setInterval(() => {
      if (startedAtRef.current) {
        setElapsedSec(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }
    }, 500);
    return () => clearInterval(i);
  }, [phase]);

  // Phase transitions
  useEffect(() => {
    if (canStart && phase === 'idle') setPhase('ready');
  }, [canStart, phase]);

  useEffect(() => {
    if (mode === 'retry' && !targetMoment) {
      setErrorMsg(
        'Retry needs a specific moment to practise. Go back to the results page and tap "Retry with Coach" on a flagged moment.',
      );
      setPhase('error');
    }
  }, [mode, targetMoment]);

  // Finalize on disconnect
  useEffect(() => {
    if (phase !== 'ended' || !coachStart) return;
    const attemptToMark = mode === 'mock_review' ? null : latestAttempt?.id ?? null;
    endCoachSession(coachStart.coach_session_id, attemptToMark).catch((e) => {
      console.warn('[ielts-coach] endCoachSession failed:', e);
    });
  }, [phase, coachStart, latestAttempt, mode]);

  // ============================================================
  // Handlers
  // ============================================================
  const handleStart = async () => {
    if (!canStart || phase === 'connecting' || phase === 'in_session') return;
    setPhase('connecting');
    setErrorMsg(null);
    setTranscript([]);

    try {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
      } catch (permErr) {
        throw new Error(
          permErr instanceof Error
            ? `Microphone access blocked: ${permErr.message}`
            : 'Microphone access blocked.',
        );
      }

      const res = await startIeltsCoachSession(
        mode === 'mock_review'
          ? { mode: 'mock_review', testId }
          : mode === 'retry'
            ? { mode: 'retry', attemptId: latestAttempt!.id, targetMoment }
            : { mode: 'part_review', attemptId: latestAttempt!.id },
      );
      setCoachStart(res);

      const sessionInfo = await conversation.startSession({
        signedUrl: res.signed_url,
        dynamicVariables: res.dynamic_variables,
      });

      if (sessionInfo && typeof sessionInfo === 'string') {
        elevenConvIdRef.current = sessionInfo;
        await updateCoachSessionConversationId(res.coach_session_id, sessionInfo).catch(
          (e) => console.warn('[ielts-coach] persist conv id failed:', e),
        );
      } else {
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

  const handleEnd = async () => {
    try {
      await conversation.endSession();
    } catch (e) {
      console.warn('[ielts-coach] endSession error:', e);
    }
  };

  const handleBack = async () => {
    if (phase === 'in_session') {
      await handleEnd();
    }
    navigate(`/ielts/test/${testId}`);
  };

  const handleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    micStreamRef.current?.getAudioTracks().forEach((t) => {
      if ('enabled' in t) t.enabled = !next;
    });
  };

  const isRecording = phase === 'in_session' && !isMuted;
  const isAISpeaking = phase === 'in_session' && conversation.isSpeaking === true;

  const coachTitle =
    mode === 'mock_review'
      ? 'Coach · Full mock review'
      : mode === 'retry'
        ? `Coach · Retry`
        : 'Coach';
  const coachSubtitle =
    mode === 'mock_review'
      ? test?.theme ?? 'Mock test debrief'
      : `${PART_TITLES[partNum] ?? ''}${test ? ` · ${test.theme}` : ''}`;

  // ============================================================
  // Render — full-screen immersive layout (no AppSidebar)
  // ============================================================
  return (
    <div
      className="h-screen bg-cover bg-center bg-no-repeat flex flex-col page-enter"
      style={{ backgroundImage: `url(${bgWelcome})` }}
    >
      {/* Header */}
      <motion.header
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut', delay: 0.1 }}
        className="px-4 py-4 flex items-center justify-between"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className="rounded-full -ml-2 h-10 w-10 bg-white/80 hover:bg-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>

          <Avatar className="w-14 h-14 border-2 border-white shadow-md">
            <AvatarFallback className="bg-gradient-to-br from-[hsl(var(--brand-blue,217_91%_60%))] to-violet-500 text-white">
              <GraduationCap className="w-7 h-7" />
            </AvatarFallback>
          </Avatar>

          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-base leading-tight truncate">
              {coachTitle}
            </span>
            <span className="text-xs text-foreground/70 truncate">
              {coachSubtitle}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {(isRecording || isAISpeaking) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              <VoiceBars
                levels={audioLevels}
                isActive={isRecording || isAISpeaking}
                color={isAISpeaking ? 'blue' : 'green'}
                size="md"
              />
            </motion.div>
          )}

          {phase === 'in_session' && (
            <div className="bg-white rounded-full px-3 py-1.5 min-w-[64px] flex items-center justify-center shadow-sm">
              <span className="text-sm font-medium tabular-nums">
                {formatMMSS(elapsedSec)}
              </span>
            </div>
          )}
        </div>
      </motion.header>

      {/* Main content area */}
      <div className="flex-1 mx-2 mb-2 overflow-hidden">
        <div className="h-full bg-gray-100 rounded-[40px] flex flex-col overflow-hidden">
          {testLoading && <CenteredSkeleton />}
          {testError && (
            <CenteredError message={(testError as Error).message ?? 'Failed to load.'} />
          )}

          {!testLoading && !testError && mode !== 'mock_review' && !latestAttempt && (
            <CenteredCard>
              <NoAttemptBlock onBack={() => navigate(`/ielts/test/${testId}`)} />
            </CenteredCard>
          )}

          {phase === 'ready' && (
            <CenteredCard>
              <ReadyBlock
                mode={mode}
                partLabel={
                  mode === 'mock_review' ? 'Full mock review' : PART_TITLES[partNum]
                }
                targetMoment={targetMoment}
                onStart={handleStart}
              />
            </CenteredCard>
          )}

          {phase === 'connecting' && (
            <CenteredCard>
              <ConnectingBlock />
            </CenteredCard>
          )}

          {phase === 'error' && (
            <CenteredCard>
              <ErrorBlock
                message={errorMsg ?? 'Something went wrong.'}
                onRetry={
                  mode === 'retry' && !targetMoment
                    ? undefined
                    : () => {
                        setPhase('ready');
                        setErrorMsg(null);
                        setCoachStart(null);
                      }
                }
              />
            </CenteredCard>
          )}

          {(phase === 'in_session' || phase === 'ended') && (
            <TranscriptView transcript={transcript} ended={phase === 'ended'} />
          )}

          {/* End-of-session footer */}
          {phase === 'ended' && (
            <div className="px-5 py-4 border-t bg-white flex flex-col sm:flex-row items-stretch sm:items-center gap-3 justify-between">
              <span className="text-sm text-muted-foreground">
                Session ended.
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
                    latestAttempt
                      ? navigate(`/ielts/attempt/${latestAttempt.id}/results`)
                      : navigate(`/ielts/test/${testId}`)
                  }
                >
                  {latestAttempt ? 'See results' : 'Back to test'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom controls — visible only during the active session */}
      {(phase === 'in_session' || phase === 'connecting') && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="px-5 pb-6"
        >
          <div className="flex items-center gap-3 justify-center">
            <button
              className="flex-shrink-0 w-12 h-12 rounded-full bg-white shadow-md flex items-center justify-center text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              onClick={handleMute}
              disabled={phase !== 'in_session'}
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            <div className="text-xs text-foreground/80 bg-white/90 backdrop-blur rounded-full px-3 py-1.5 shadow-sm">
              {phase === 'in_session'
                ? isMuted
                  ? 'Muted — tap mic to resume'
                  : 'Listening… speak naturally'
                : 'Connecting…'}
            </div>

            <button
              className="flex-shrink-0 w-12 h-12 rounded-full bg-rose-500 text-white shadow-md flex items-center justify-center hover:bg-rose-600 transition-colors"
              onClick={handleEnd}
              aria-label="End session"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </motion.div>
      )}
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex-1 overflow-y-auto px-5 sm:px-6 py-6 space-y-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
    >
      {transcript.length === 0 && !ended && (
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-muted-foreground">
            <AudioWaveform className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Your Coach is preparing your debrief…</p>
          </div>
        </div>
      )}

      {transcript.map((line, idx) => (
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className={cn(
            'flex gap-3',
            line.speaker === 'student' ? 'justify-end' : 'justify-start',
          )}
        >
          {line.speaker === 'coach' && (
            <Avatar className="w-8 h-8 flex-shrink-0">
              <AvatarFallback className="bg-gradient-to-br from-[hsl(var(--brand-blue,217_91%_60%))] to-violet-500 text-white">
                <GraduationCap className="w-4 h-4" />
              </AvatarFallback>
            </Avatar>
          )}
          <div
            className={cn(
              'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm transition-all duration-300 ease-in-out',
              line.speaker === 'student'
                ? 'bg-[hsl(var(--brand-blue,217_91%_60%))] text-white rounded-tr-sm'
                : 'bg-white text-gray-900 shadow-sm rounded-tl-sm',
            )}
          >
            <p className="leading-relaxed whitespace-pre-wrap">{line.text}</p>
          </div>
          {line.speaker === 'student' && (
            <Avatar className="w-8 h-8 flex-shrink-0">
              <AvatarFallback className="bg-muted text-foreground/80">
                You
              </AvatarFallback>
            </Avatar>
          )}
        </motion.div>
      ))}

      {ended && transcript.length === 0 && (
        <div className="flex items-center justify-center h-full">
          <p className="text-sm text-muted-foreground">
            Session ended before any messages were exchanged.
          </p>
        </div>
      )}

      <div ref={endRef} />
    </motion.div>
  );
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex items-center justify-center px-5 py-6">
      <div className="w-full max-w-md">{children}</div>
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
    <Card className="border-0 shadow-xl">
      <CardContent className="p-6 sm:p-8 flex flex-col items-center gap-5 text-center">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[hsl(var(--brand-blue,217_91%_60%))] to-violet-500 text-white flex items-center justify-center shadow-md">
          <GraduationCap className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <div className="text-base font-semibold">Ready to talk with your Coach?</div>
          <div className="text-sm text-muted-foreground">{pitchByMode[mode]}</div>
        </div>

        {mode === 'retry' && targetMoment && (
          <div className="w-full rounded-md border bg-muted/40 p-3 text-left text-sm space-y-1">
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

        <Button size="lg" onClick={onStart} className="gap-2 w-full">
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
    <Card className="border-0 shadow-xl">
      <CardContent className="p-8 flex flex-col items-center gap-3 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        <div className="text-sm font-medium">Connecting you with your Coach…</div>
        <div className="text-xs text-muted-foreground max-w-xs">
          Packaging your session transcript and scores so your Coach can start
          with specific feedback.
        </div>
      </CardContent>
    </Card>
  );
}

function NoAttemptBlock({ onBack }: { onBack: () => void }) {
  return (
    <Card className="border-0 shadow-xl">
      <CardContent className="p-6 sm:p-8 flex flex-col items-center gap-4 text-center">
        <AlertTriangle className="w-8 h-8 text-amber-500" />
        <div className="text-base font-semibold">No finished attempt yet</div>
        <p className="text-sm text-muted-foreground">
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
    <Card className="border-0 shadow-xl">
      <CardContent className="p-6 sm:p-8 flex flex-col items-center gap-4 text-center">
        <AlertTriangle className="w-8 h-8 text-destructive" />
        <div className="text-sm text-destructive">{message}</div>
        {onRetry && (
          <Button variant="outline" onClick={onRetry}>
            Try again
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function CenteredError({ message }: { message: string }) {
  return (
    <CenteredCard>
      <ErrorBlock message={message} />
    </CenteredCard>
  );
}

function CenteredSkeleton() {
  return (
    <CenteredCard>
      <Card className="border-0 shadow-xl">
        <CardContent className="p-6 space-y-3">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-3/4" />
        </CardContent>
      </Card>
    </CenteredCard>
  );
}

function formatMMSS(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
