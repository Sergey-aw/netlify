import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Sparkles,
  AudioWaveform,
  History,
  ChevronRight,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { VoiceBars } from '@/components/VoiceBars';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import bgWelcome from '@/assets/bg_welcome.jpg';
import {
  startJustTalkSession,
  updateJustTalkConversationId,
  listJustTalkSessions,
  getJustTalkTranscript,
  type JustTalkStartResult,
  type JustTalkSessionRow,
} from '@/services/justtalk.service';
import {
  trackJustTalkOpened,
  trackJustTalkSessionStarted,
  trackJustTalkSessionEnded,
  trackJustTalkSessionError,
  trackJustTalkTranscriptViewed,
} from '@/lib/justtalk-analytics';

type Phase = 'ready' | 'connecting' | 'in_session' | 'ended' | 'error';

interface TranscriptLine {
  speaker: 'coach' | 'student';
  text: string;
  ts: number;
}

interface ElevenTranscriptTurn {
  role: string;
  message: string | null;
  time_in_call_secs?: number;
}

export default function JustTalk() {
  const navigate = useNavigate();

  const openedTrackedRef = useRef(false);
  useEffect(() => {
    if (openedTrackedRef.current) return;
    openedTrackedRef.current = true;
    trackJustTalkOpened();
  }, []);

  // ============================================================
  // Current user profile (avatar + initial)
  // ============================================================
  const { data: userProfile } = useQuery({
    queryKey: ['justtalk-current-user'],
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
    const n = userProfile?.display_name || userProfile?.name || userProfile?.username || 'You';
    return n.trim().charAt(0).toUpperCase() || 'U';
  }, [userProfile]);

  // ============================================================
  // Session state
  // ============================================================
  const [phase, setPhase] = useState<Phase>('ready');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [start, setStart] = useState<JustTalkStartResult | null>(null);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const startedAtRef = useRef<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const elevenConvIdRef = useRef<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  // ============================================================
  // History sidebar
  // ============================================================
  const [showHistory, setShowHistory] = useState(false);
  const [reviewing, setReviewing] = useState<JustTalkSessionRow | null>(null);
  const [reviewTurns, setReviewTurns] = useState<TranscriptLine[] | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const {
    data: sessions = [],
    refetch: refetchSessions,
  } = useQuery({
    queryKey: ['justtalk-sessions'],
    queryFn: listJustTalkSessions,
    staleTime: 30 * 1000,
  });

  const handleReviewSession = async (row: JustTalkSessionRow) => {
    setReviewing(row);
    setReviewTurns(null);
    setReviewError(null);
    if (!row.elevenlabs_conversation_id) {
      setReviewError('This session has no transcript available yet.');
      return;
    }
    setReviewLoading(true);
    try {
      trackJustTalkTranscriptViewed({ sessionId: row.id });
      const conv = await getJustTalkTranscript(row.elevenlabs_conversation_id);
      const turns = ((conv?.transcript ?? []) as ElevenTranscriptTurn[])
        .filter((t) => t.message && t.message.trim())
        .map((t, i) => ({
          speaker: (t.role === 'user' ? 'student' : 'coach') as TranscriptLine['speaker'],
          text: t.message as string,
          ts: i,
        }));
      setReviewTurns(turns);
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : 'Failed to load transcript.');
    } finally {
      setReviewLoading(false);
    }
  };

  // ============================================================
  // Audio analyzer — drives the header voice bars.
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
        .catch((err) => console.warn('[justtalk] mic analyzer denied:', err));
    } catch (err) {
      console.error('[justtalk] analyzer init failed:', err);
    }
  };

  const updateAudioLevels = () => {
    if (!analyzerRef.current) return;
    const dataArray = new Uint8Array(analyzerRef.current.frequencyBinCount);
    const analyze = () => {
      if (!analyzerRef.current) return;
      analyzerRef.current.getByteFrequencyData(dataArray);
      const levels = Array.from(dataArray.slice(0, 8)).map((v) => Math.max(0.2, v / 255));
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
      setPhase('in_session');
      startedAtRef.current = Date.now();
      initAudioAnalyzer();
    },
    onDisconnect: () => {
      setPhase((prev) => (prev === 'connecting' ? 'error' : 'ended'));
    },
    onMessage: ({ source, message }: { source: 'user' | 'ai'; message: string }) => {
      if (!message) return;
      const speaker: TranscriptLine['speaker'] = source === 'user' ? 'student' : 'coach';
      setTranscript((prev) => [...prev, { speaker, text: message, ts: Date.now() }]);
    },
    onError: (e: unknown) => {
      console.error('[justtalk] ElevenLabs error:', e);
      const msg =
        typeof e === 'string'
          ? e
          : e instanceof Error
            ? e.message
            : (e as { message?: string })?.message ?? JSON.stringify(e);
      trackJustTalkSessionError({ error: msg });
      setErrorMsg(msg);
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

  // Finalize on disconnect
  const endTrackedRef = useRef<string | null>(null);
  useEffect(() => {
    if (phase !== 'ended' || !start) return;
    if (endTrackedRef.current !== start.session_id) {
      endTrackedRef.current = start.session_id;
      const durationSeconds = startedAtRef.current
        ? Math.floor((Date.now() - startedAtRef.current) / 1000)
        : 0;
      trackJustTalkSessionEnded({
        sessionId: start.session_id,
        durationSeconds,
        coachMessageCount: transcript.filter((l) => l.speaker === 'coach').length,
        studentMessageCount: transcript.filter((l) => l.speaker === 'student').length,
      });
      refetchSessions();
    }
  }, [phase, start, transcript, refetchSessions]);

  // ============================================================
  // Handlers
  // ============================================================
  const handleStart = async () => {
    if (phase === 'connecting' || phase === 'in_session') return;
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

      const res = await startJustTalkSession();
      setStart(res);
      trackJustTalkSessionStarted({ sessionId: res.session_id });

      const sessionInfo = await conversation.startSession({
        signedUrl: res.signed_url,
        dynamicVariables: res.dynamic_variables,
      });

      if (sessionInfo && typeof sessionInfo === 'string') {
        elevenConvIdRef.current = sessionInfo;
        await updateJustTalkConversationId(res.session_id, sessionInfo).catch((e) =>
          console.warn('[justtalk] persist conv id failed:', e),
        );
      } else {
        try {
          const u = new URL(res.signed_url.replace('wss://', 'https://'));
          const fromUrl = u.searchParams.get('conversation_id');
          if (fromUrl) {
            elevenConvIdRef.current = fromUrl;
            await updateJustTalkConversationId(res.session_id, fromUrl).catch((e) =>
              console.warn('[justtalk] persist conv id failed:', e),
            );
          }
        } catch {
          // ignore
        }
      }
    } catch (e) {
      console.error('[justtalk] start failed:', e);
      const msg = e instanceof Error ? e.message : String(e);
      trackJustTalkSessionError({ error: msg });
      setErrorMsg(msg);
      setPhase('error');
    }
  };

  const handleEnd = async () => {
    try {
      await conversation.endSession();
    } catch (e) {
      console.warn('[justtalk] endSession error:', e);
    }
  };

  const handleBack = async () => {
    if (phase === 'in_session') await handleEnd();
    navigate('/ai-chat');
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

  // ============================================================
  // Render
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
              <Sparkles className="w-7 h-7" />
            </AvatarFallback>
          </Avatar>

          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-base leading-tight truncate">JustTalk</span>
            <span className="text-xs text-foreground/70 truncate">Your progress coach</span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {(isRecording || isAISpeaking) && (
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}>
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
              <span className="text-sm font-medium tabular-nums">{formatMMSS(elapsedSec)}</span>
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowHistory(true)}
            className="rounded-full h-10 w-10 bg-white/80 hover:bg-white"
            aria-label="Past sessions"
          >
            <History className="w-5 h-5" />
          </Button>
        </div>
      </motion.header>

      {/* Main content area */}
      <div className="flex-1 mx-2 mb-2 overflow-hidden">
        <div className="h-full bg-gray-100 rounded-[40px] flex flex-col overflow-hidden">
          {phase === 'ready' && (
            <CenteredCard>
              <ReadyBlock lastTalkedAt={sessions[0]?.started_at ?? null} onStart={handleStart} />
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
                onRetry={() => {
                  setPhase('ready');
                  setErrorMsg(null);
                  setStart(null);
                }}
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

          {phase === 'ended' && (
            <div className="px-5 py-4 border-t bg-white flex flex-col sm:flex-row items-stretch sm:items-center gap-3 justify-between">
              <span className="text-sm text-muted-foreground">Session ended.</span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setPhase('ready');
                    setStart(null);
                    setTranscript([]);
                    elevenConvIdRef.current = null;
                  }}
                >
                  <MessageCircle className="w-4 h-4 mr-1.5" />
                  Talk again
                </Button>
                <Button onClick={() => navigate('/ai-chat')}>Back to home</Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom controls */}
      {(phase === 'in_session' || phase === 'connecting') && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="px-3 sm:px-5 pb-6"
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

      {/* History sidebar */}
      {showHistory && (
        <HistorySidebar
          sessions={sessions}
          reviewing={reviewing}
          reviewTurns={reviewTurns}
          reviewLoading={reviewLoading}
          reviewError={reviewError}
          userPhotoUrl={userProfile?.profile_photo_url ?? undefined}
          userInitial={userInitial}
          onClose={() => {
            setShowHistory(false);
            setReviewing(null);
            setReviewTurns(null);
            setReviewError(null);
          }}
          onSelect={handleReviewSession}
          onBackToList={() => {
            setReviewing(null);
            setReviewTurns(null);
            setReviewError(null);
          }}
        />
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
            <p className="text-sm">JustTalk is reviewing your progress…</p>
          </div>
        </div>
      )}

      {transcript.map((line, idx) => (
        <ChatBubble key={idx} line={line} userPhotoUrl={userPhotoUrl} userInitial={userInitial} />
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

function ChatBubble({
  line,
  userPhotoUrl,
  userInitial,
}: {
  line: TranscriptLine;
  userPhotoUrl?: string;
  userInitial: string;
}) {
  return (
    <div
      className={cn('flex gap-3', line.speaker === 'student' ? 'justify-end' : 'justify-start')}
    >
      {line.speaker === 'coach' && (
        <Avatar className="w-8 h-8 flex-shrink-0">
          <AvatarFallback className="bg-gradient-to-br from-[hsl(var(--brand-blue,217_91%_60%))] to-violet-500 text-white">
            <Sparkles className="w-4 h-4" />
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
    </div>
  );
}

function HistorySidebar({
  sessions,
  reviewing,
  reviewTurns,
  reviewLoading,
  reviewError,
  userPhotoUrl,
  userInitial,
  onClose,
  onSelect,
  onBackToList,
}: {
  sessions: JustTalkSessionRow[];
  reviewing: JustTalkSessionRow | null;
  reviewTurns: TranscriptLine[] | null;
  reviewLoading: boolean;
  reviewError: string | null;
  userPhotoUrl?: string;
  userInitial: string;
  onClose: () => void;
  onSelect: (row: JustTalkSessionRow) => void;
  onBackToList: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        className="relative w-full max-w-md bg-white h-full flex flex-col shadow-xl"
      >
        <div className="px-5 py-4 border-b flex items-center gap-3">
          {reviewing ? (
            <Button variant="ghost" size="icon" onClick={onBackToList} className="-ml-2 h-9 w-9">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          ) : (
            <History className="w-5 h-5 text-muted-foreground" />
          )}
          <span className="font-semibold flex-1 truncate">
            {reviewing ? reviewing.title || 'Past session' : 'Past sessions'}
          </span>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-9 w-9">
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!reviewing && (
            <div className="divide-y">
              {sessions.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No past sessions yet. Your conversations will show up here.
                </div>
              )}
              {sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onSelect(s)}
                  className="w-full text-left px-5 py-4 hover:bg-gray-50 transition-colors flex items-start gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {s.title || s.transcript_summary?.slice(0, 60) || 'Session'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {formatDate(s.started_at)}
                      {!s.ended_at && ' · in progress'}
                    </div>
                    {s.transcript_summary && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {s.transcript_summary}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                </button>
              ))}
            </div>
          )}

          {reviewing && (
            <div className="p-5 space-y-4">
              {reviewing.transcript_summary && (
                <div className="rounded-lg bg-muted/40 p-3 text-sm">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                    Summary
                  </div>
                  {reviewing.transcript_summary}
                </div>
              )}

              {reviewLoading && (
                <div className="flex items-center justify-center py-10 text-muted-foreground">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              )}

              {reviewError && (
                <div className="text-sm text-destructive flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  {reviewError}
                </div>
              )}

              {reviewTurns && reviewTurns.length > 0 && (
                <div className="space-y-4">
                  {reviewTurns.map((line, idx) => (
                    <ChatBubble key={idx} line={line} userPhotoUrl={userPhotoUrl} userInitial={userInitial} />
                  ))}
                </div>
              )}

              {reviewTurns && reviewTurns.length === 0 && !reviewError && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No transcript content for this session.
                </p>
              )}
            </div>
          )}
        </div>
      </motion.aside>
    </div>
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
  lastTalkedAt,
  onStart,
}: {
  lastTalkedAt: string | null;
  onStart: () => void;
}) {
  return (
    <Card className="border-0 shadow-xl">
      <CardContent className="p-6 sm:p-8 flex flex-col items-center gap-5 text-center">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[hsl(var(--brand-blue,217_91%_60%))] to-violet-500 text-white flex items-center justify-center shadow-md">
          <Sparkles className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <div className="text-base font-semibold">Ready to talk about your progress?</div>
          <div className="text-sm text-muted-foreground">
            JustTalk sees everything you've done across the app and remembers your past chats. We'll
            reflect on what's working and agree on what to focus on next.
          </div>
        </div>
        {lastTalkedAt && (
          <div className="text-xs text-muted-foreground">Last talked {formatDate(lastTalkedAt)}</div>
        )}
        <Button size="lg" onClick={onStart} className="gap-2 w-full">
          <Mic className="w-4 h-4" />
          Start talking
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
        <div className="text-sm font-medium">Getting your progress ready…</div>
        <div className="text-xs text-muted-foreground max-w-xs">
          Gathering your vocabulary, mistakes, IELTS results, and role-play history so JustTalk can
          pick up where you left off.
        </div>
      </CardContent>
    </Card>
  );
}

function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
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

function formatMMSS(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
