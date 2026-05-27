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
  RefreshCw,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { VoiceBars } from '@/components/VoiceBars';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
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
  const navState = (location.state ?? null) as {
    targetMoment?: CoachTargetMoment;
    attemptId?: string;
  } | null;
  const targetMoment = navState?.targetMoment;
  // If the caller passed a specific attempt (e.g. from a past-attempt's results
  // page), coach on THAT attempt — not the latest one for this Part.
  const requestedAttemptId = navState?.attemptId ?? null;

  // ============================================================
  // Current user's profile (avatar + display name)
  // ============================================================
  const { data: userProfile } = useQuery({
    queryKey: ['ielts-coach-current-user'],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data } = await supabase
        .from('profiles')
        .select('display_name, name, username, profile_photo_url')
        .eq('id', auth.user.id)
        .maybeSingle();
      return data as {
        display_name?: string | null;
        name?: string | null;
        username?: string | null;
        profile_photo_url?: string | null;
      } | null;
    },
    staleTime: 5 * 60 * 1000,
  });

  const userInitial = useMemo(() => {
    const n =
      userProfile?.display_name ||
      userProfile?.name ||
      userProfile?.username ||
      'You';
    return n.trim().charAt(0).toUpperCase() || 'U';
  }, [userProfile]);

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

  /**
   * The attempt this Coach session debriefs.
   *   - If the caller passed a specific `attemptId` via navigation state (e.g.
   *     from a past attempt's Results page), use that exact one.
   *   - Otherwise fall back to the latest finalized attempt for this Part.
   * Kept under `latestAttempt` name so the rest of the page stays untouched.
   */
  const latestAttempt = useMemo(() => {
    if (!part) return null;
    if (requestedAttemptId) {
      const explicit = part.attempts.find((a) => a.id === requestedAttemptId);
      if (explicit) return explicit;
      // If the requested attempt isn't on this Part (data race / wrong link),
      // fall through to the latest so the user still gets a session.
      console.warn('[ielts-coach] requested attempt not found on part; using latest', { requestedAttemptId });
    }
    return latestFinalizedAttempt(part.attempts);
  }, [part, requestedAttemptId]);

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

  // ============================================================
  // Suggestion pool — 50+ prompts per mode, 4 visible at a time,
  // rotated on each Coach turn / tap / manual reshuffle.
  // ============================================================
  const SUGGESTIONS_VISIBLE = 4;
  const pool = useMemo(() => buildSuggestionPool(mode), [mode]);
  const [usedSuggestions, setUsedSuggestions] = useState<Set<string>>(new Set());
  const [visibleSuggestions, setVisibleSuggestions] = useState<string[]>([]);

  // Initialize / re-initialize the visible set when mode (=pool) changes.
  useEffect(() => {
    setUsedSuggestions(new Set());
    setVisibleSuggestions(pickN(pool, SUGGESTIONS_VISIBLE, new Set(), []));
  }, [pool]);

  // Rotate ONE visible chip every time the Coach posts a new message —
  // keeps the prompt strip feeling alive without churning everything.
  const lastCoachTsRef = useRef<number>(0);
  useEffect(() => {
    if (transcript.length === 0) return;
    const last = transcript[transcript.length - 1];
    if (last.speaker !== 'coach') return;
    if (last.ts <= lastCoachTsRef.current) return;
    lastCoachTsRef.current = last.ts;

    setVisibleSuggestions((prev) => {
      if (prev.length === 0) return prev;
      const fresh = pickN(pool, 1, usedSuggestions, prev);
      if (fresh.length === 0) return prev;
      const swapIdx = Math.floor(Math.random() * prev.length);
      const next = [...prev];
      next[swapIdx] = fresh[0];
      return next;
    });
  }, [transcript, pool, usedSuggestions]);

  /**
   * Send a suggested question to the Coach as a typed user message.
   * Pushes it into the local transcript too so the user sees what was sent.
   * @elevenlabs/react v0.12 exposes `sendUserMessage` on the conversation object.
   * Also marks the suggestion used and slots a fresh one in.
   */
  const handleSendSuggestion = (text: string) => {
    if (phase !== 'in_session' || !text.trim()) return;
    setTranscript((prev) => [
      ...prev,
      { speaker: 'student', text, ts: Date.now() },
    ]);
    try {
      const sendFn = (
        conversation as unknown as { sendUserMessage?: (s: string) => void }
      ).sendUserMessage;
      if (typeof sendFn === 'function') {
        sendFn.call(conversation, text);
      } else {
        console.warn('[ielts-coach] sendUserMessage not available on SDK; suggestion was not delivered.');
      }
    } catch (e) {
      console.warn('[ielts-coach] sendUserMessage failed:', e);
    }
    // Mark used + replace in visible set
    setUsedSuggestions((prev) => {
      const nextUsed = new Set(prev);
      nextUsed.add(text);
      setVisibleSuggestions((prevVis) => {
        const fresh = pickN(pool, 1, nextUsed, prevVis.filter((p) => p !== text));
        return prevVis.map((p) => (p === text ? fresh[0] ?? p : p));
      });
      return nextUsed;
    });
  };

  const handleReshuffleSuggestions = () => {
    setVisibleSuggestions(pickN(pool, SUGGESTIONS_VISIBLE, usedSuggestions, []));
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
            <TranscriptView
              transcript={transcript}
              ended={phase === 'ended'}
              userPhotoUrl={userProfile?.profile_photo_url ?? undefined}
              userInitial={userInitial}
            />
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
          className="px-3 sm:px-5 pb-6 space-y-3"
        >
          {/* Suggestion chips — tap to ask the Coach something useful */}
          {phase === 'in_session' && visibleSuggestions.length > 0 && (
            <div
              className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-3 sm:mx-0 px-3 sm:px-0"
              data-swipe-ignore
            >
              {visibleSuggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleSendSuggestion(s)}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-white/95 backdrop-blur px-3 py-1.5 text-xs text-gray-800 shadow-sm hover:bg-white hover:shadow transition-all active:scale-95 max-w-[260px]"
                  title={s}
                >
                  <MessageCircle className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="truncate">{s}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={handleReshuffleSuggestions}
                className="shrink-0 w-8 h-8 rounded-full bg-white/95 backdrop-blur flex items-center justify-center text-gray-600 hover:text-gray-900 shadow-sm hover:bg-white transition-all active:rotate-90"
                aria-label="Shuffle suggestions"
                title="Shuffle suggestions"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

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
  userPhotoUrl,
  userInitial,
}: {
  transcript: TranscriptLine[];
  ended: boolean;
  userPhotoUrl?: string;
  userInitial: string;
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
              {userPhotoUrl && <AvatarImage src={userPhotoUrl} alt="You" />}
              <AvatarFallback className="bg-muted text-foreground/80 text-xs font-semibold">
                {userInitial}
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

/**
 * Pick `n` items from `pool` at random, excluding anything already used
 * or currently visible. Returns up to `n` items.
 */
function pickN(
  pool: string[],
  n: number,
  used: Set<string>,
  visible: string[],
): string[] {
  const visibleSet = new Set(visible);
  const available = pool.filter((p) => !used.has(p) && !visibleSet.has(p));
  // Fisher-Yates partial shuffle is overkill for ~50 items — naive sort is fine.
  const shuffled = available
    .map((s) => [Math.random(), s] as const)
    .sort((a, b) => a[0] - b[0])
    .map(([, s]) => s);
  return shuffled.slice(0, n);
}

/**
 * Curated suggestion *pool* per mode. The visible chip strip shows 4 at a
 * time and rotates as the conversation progresses.
 */
function buildSuggestionPool(mode: CoachMode): string[] {
  const universal = [
    "What's my highest-impact fix?",
    'How do I get to band 7?',
    'How do I get to band 8?',
    'What does the examiner listen for in fluency?',
    'What does the examiner listen for in vocabulary?',
    'What does the examiner listen for in grammar?',
    'What does the examiner listen for in pronunciation?',
    'Show me a stronger version of what I said',
    "What's a band-7 model answer for this?",
    "What's a band-8 model answer for this?",
    'Give me 3 collocations I should try',
    'Give me 3 discourse markers I should try',
    'Am I using fillers too much?',
    'Do I sound natural or rehearsed?',
    'Was my speech rate okay?',
    'Compare me to a band-7 candidate',
    'Compare me to a band-8 candidate',
    "What's the difference between band 6 and band 7?",
    "What's the difference between band 7 and band 8?",
    'Should I memorise answers?',
    'Which idioms are safe in IELTS Speaking?',
    'Which idioms should I avoid?',
    'How do I improve my /th/ sound?',
    'How do I improve my stress patterns?',
    'How do I improve my intonation?',
    "What's one specific thing I should fix today?",
    'Tell me something I did well that I should keep doing',
    'Am I making any L1 interference mistakes?',
    'Should I use idioms?',
    'What grammar should I practise next?',
    'What vocabulary range am I missing?',
    'Did I sound confident?',
    'Are my sentences too short?',
    'Are my sentences too long?',
    'Give me a quick warm-up speaking task',
    'How do I avoid sounding rehearsed?',
    'Did I repeat myself too much?',
    "What's a stronger way to start an answer?",
    "What's a stronger way to end an answer?",
    "What's one phrase I should never use?",
    'Give me one upgrade phrase to try',
    'How should I handle a question I don\'t know?',
    'What if I run out of ideas mid-answer?',
    'Quick fire: ask me three new questions',
    'What was my best grammar move?',
    'What was my worst grammar mistake?',
  ];

  if (mode === 'mock_review') {
    return [
      'Which Part needs the most work?',
      'What single thing would lift my overall band?',
      'Compare my Part 1 vs Part 3',
      'Compare my Part 2 vs the rest',
      'Which Part was my strongest?',
      'Which Part was my weakest?',
      "What's a realistic overall band target?",
      'Was my Part 2 long enough?',
      'Did I stay on topic in Part 2?',
      'Was my Part 3 abstract enough?',
      'Did I show range across all 3 Parts?',
      "What's my biggest pattern across the test?",
      'Did I repeat the same phrases too much?',
      'Which criterion lifts fastest with practice?',
      'Plan my next 2 weeks of practice',
      'Plan my next session for me',
      'What kind of test should I take next?',
      'Should I retake this test or move on?',
      "What's the gap to band 7?",
      "What's the gap to band 8?",
      'Did I sound more natural in any one Part?',
      'How should I open Part 1 strongly?',
      'How should I open Part 2 strongly?',
      'How should I open Part 3 strongly?',
      'Show me a stronger Part 2 answer',
      'Show me a stronger Part 3 answer',
      'Am I making the same mistake across Parts?',
      'Should I focus on grammar or vocabulary next?',
      'Should I focus on fluency or pronunciation next?',
      'What was my best moment in the whole test?',
      'What was my weakest moment in the whole test?',
      ...universal,
    ];
  }

  if (mode === 'retry') {
    return [
      'Give me a hint',
      'Which grammar should I use here?',
      'Show me a stronger version',
      'What was wrong with my last answer?',
      'Try the same question again',
      'Try a similar question',
      'Give me a band-7 model for this moment',
      'Walk me through the structure',
      "What's a useful opening for this?",
      "What's a useful closing for this?",
      'Which discourse marker fits here?',
      'Which tense should I use?',
      'Suggest a collocation I can use',
      'Replay just the part I struggled with',
      'Tell me what went well first',
      'Slow it down for me',
      'Quick-fire: push me harder',
      'Ease me in — start easy',
      'Give me one new word to use',
      'Give me one new phrase to use',
      'Should I add an example?',
      'Should I keep my answer short?',
      'Show me how a band-9 candidate would answer',
      'Critique each sentence',
      'Just give me the verdict — better or not?',
      "What's one thing I improved?",
      "What's still missing?",
      'Try once more, no hints',
      'Move on to the next moment',
      'Was my fix natural or forced?',
      ...universal,
    ];
  }

  // part_review
  return [
    'Which of my answers was the strongest?',
    'Which of my answers was the weakest?',
    'Why did I lose points on grammar?',
    'Why did I lose points on vocabulary?',
    'Why did I lose points on fluency?',
    'Why did I lose points on pronunciation?',
    'Was my answer relevant to the question?',
    'Did I go off topic anywhere?',
    'Did I use enough discourse markers?',
    'Roleplay the examiner for one question',
    'Can you score me again pretending you\'re a real examiner?',
    ...universal,
  ];
}
