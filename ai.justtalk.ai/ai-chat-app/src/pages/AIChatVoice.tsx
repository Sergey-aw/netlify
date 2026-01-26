import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  X,
  Mic,
  MicOff,
  AudioWaveform,
  Volume2,
  CircleStop,
  Languages,
} from 'lucide-react';
import { useConversation } from '@elevenlabs/react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { getElevenLabsSignedUrl, getContextMemory, getConversationSuggestions } from '@/lib/justai-api';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/hooks/useSession';
import { FeedbackDrawer, type FeedbackData } from '@/components/FeedbackDrawer';
import { VoiceBars } from '@/components/VoiceBars';
import { CenteredAgentIntro } from '@/components/CenteredAgentIntro';
import bgWelcome from '@/assets/bg_welcome.jpg';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';
import { trackVoiceSessionStarted, trackVoiceSessionEnded } from '@/lib/posthog';

interface TranscriptSegment {
  speaker: 'student' | 'ai';
  text: string;
  timestamp: number;
}

// Helper function to remove voice tags like <Narrator>...</Narrator> from ElevenLabs transcripts
function stripVoiceTags(text: string): string {
  // Remove XML-style voice tags used by ElevenLabs multi-voice feature
  return text.replace(/<[^>]+>/g, '');
}

export default function AIChatVoice() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useSession();
  const [isRecording, setIsRecording] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [audioLevels, setAudioLevels] = useState<number[]>(Array(8).fill(0.2));
  const [isConnecting, setIsConnecting] = useState(true);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [elevenLabsConvId, setElevenLabsConvId] = useState<string | null>(null);
  const sessionStartTime = useRef<Date | null>(null);
  const sessionSaved = useRef(false);
  const [showFeedbackDrawer, setShowFeedbackDrawer] = useState(false);
  const [feedbackData, setFeedbackData] = useState<FeedbackData | null>(null);
  const [isFetchingFeedback, setIsFetchingFeedback] = useState(false);
  const [showContinuePrompt, setShowContinuePrompt] = useState(false);
  const [recommendedDuration, setRecommendedDuration] = useState(60); // Fetched from DB, default 60 seconds
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [visibleTranslations, setVisibleTranslations] = useState<Set<string>>(new Set());
  const [loadingTranslation, setLoadingTranslation] = useState<Record<string, boolean>>({});
  const [playingAudio, setPlayingAudio] = useState<Record<string, boolean>>({});
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showWordDrawer, setShowWordDrawer] = useState(false);
  const [selectedWord, setSelectedWord] = useState<{
    word: string;
    lemma: string;
    pos: string;
    definitions: Array<{ definition: string; example: string; score: number }>;
    synonyms: Record<string, number>;
    translations: Record<string, number>;
  } | null>(null);
  const [loadingWord, setLoadingWord] = useState(false);
  const [wordDefinitions, setWordDefinitions] = useState<Record<string, any>>({});
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [currentSuggestionIndex, setCurrentSuggestionIndex] = useState(0);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionsUsedCount, setSuggestionsUsedCount] = useState(0);
  const MAX_SUGGESTIONS_PER_SESSION = 5;

  // Get agent info from navigation state
  const selectedAgentId = location.state?.agentId; // ElevenLabs agent ID (undefined = use default)
  const selectedAgentName = location.state?.agentName || 'AI Teacher';
  const selectedScenario = location.state?.scenario || 'general_conversation';
  const agentDatabaseId = location.state?.agentDatabaseId; // Database ID from justai_agents table
  const passedSessionMemory = location.state?.sessionMemory; // Session memory from previous conversation (for replays)
  
  // Log agent selection only once when component mounts or agent changes
  useEffect(() => {
    console.log('🤖 Selected Agent:', {
      agentId: selectedAgentId || 'DEFAULT (from Supabase secrets)',
      agentName: selectedAgentName,
      scenario: selectedScenario,
      agentDatabaseId: agentDatabaseId || 'None (no progress tracking)',
      hasSessionMemory: !!passedSessionMemory,
    });
  }, [selectedAgentId, selectedAgentName, selectedScenario, agentDatabaseId, passedSessionMemory]);

  // Get user's preferred voice
  const { data: userProfile } = useQuery({
    queryKey: ['user-profile-voice', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('justai_preferred_voice, display_name, profile_photo_url, native_language')
        .eq('id', user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Get agent data for avatar
  const { data: agentData } = useQuery({
    queryKey: ['agent-data', agentDatabaseId],
    queryFn: async () => {
      if (!agentDatabaseId) return null;
      
      const { data, error } = await supabase
        .from('justai_agents')
        .select('image_url, name, description')
        .eq('id', agentDatabaseId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!agentDatabaseId,
  });

  // Helper function to convert image URL to use _avatar suffix
  const getAvatarUrl = (imageUrl: string | null | undefined): string | undefined => {
    if (!imageUrl) return undefined;
    
    const lastDotIndex = imageUrl.lastIndexOf('.');
    const lastSlashIndex = imageUrl.lastIndexOf('/');
    
    if (lastDotIndex > lastSlashIndex && lastDotIndex !== -1) {
      const basePath = imageUrl.substring(0, lastDotIndex);
      const extension = imageUrl.substring(lastDotIndex);
      
      const filename = basePath.substring(lastSlashIndex + 1);
      if (filename.startsWith('dating_')) {
        return `${basePath}_avatar${extension}`;
      }
      
      return imageUrl;
    }
    
    return imageUrl;
  };

  // Initialize audio analyzer for live voice bars
  const initAudioAnalyzer = () => {
    try {
      if (!audioContextRef.current) {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioContext();
        analyzerRef.current = audioContextRef.current.createAnalyser();
        analyzerRef.current.fftSize = 32;
        analyzerRef.current.smoothingTimeConstant = 0.8;
        
        // Get microphone stream
        navigator.mediaDevices.getUserMedia({ audio: true })
          .then((stream) => {
            micStreamRef.current = stream;
            const source = audioContextRef.current!.createMediaStreamSource(stream);
            source.connect(analyzerRef.current!);
            updateAudioLevels();
          })
          .catch((err) => {
            console.warn('Microphone access denied, using fallback animation:', err);
          });
      }
    } catch (error) {
      console.error('Failed to initialize audio analyzer:', error);
    }
  };

  // Update audio levels from analyzer
  const updateAudioLevels = () => {
    if (!analyzerRef.current) return;
    
    const dataArray = new Uint8Array(analyzerRef.current.frequencyBinCount);
    
    const analyze = () => {
      if (!analyzerRef.current) return;
      
      analyzerRef.current.getByteFrequencyData(dataArray);
      
      // Convert to normalized values (0-1) and take first 8 bins
      const levels = Array.from(dataArray.slice(0, 8)).map(value => {
        const normalized = value / 255;
        return Math.max(0.2, normalized); // Minimum height of 20%
      });
      
      setAudioLevels(levels);
      animationFrameRef.current = requestAnimationFrame(analyze);
    };
    
    analyze();
  };

  // Cleanup audio analyzer on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // ElevenLabs conversation hook
  const conversation = useConversation({
    onConnect: () => {
      console.log('🟢 Connected to ElevenLabs');
      setIsConnecting(false);
      
      // Initialize audio analyzer
      initAudioAnalyzer();
      
      // Inspect the entire conversation object to find where ElevenLabs stores the conversation ID
      console.log('🔍 Full conversation object:', conversation);
      console.log('🔍 conversation keys:', Object.keys(conversation));
      console.log('🔍 conversation.id:', (conversation as any).id);
      console.log('🔍 conversation.conversationId:', (conversation as any).conversationId);
      console.log('🔍 conversation._conversationId:', (conversation as any)._conversationId);
      console.log('🔍 conversation.session:', (conversation as any).session);
      console.log('🔍 conversation.config:', (conversation as any).config);
      
      // Try to extract conversation ID from the connection
      if (conversation && !elevenLabsConvId) {
        const convId = (conversation as any).conversationId || (conversation as any).id || (conversation as any)._conversationId;
        if (convId) {
          console.log('✅ Extracted ElevenLabs conversation ID on connect:', convId);
          setElevenLabsConvId(convId);
        } else {
          console.warn('⚠️ Could not find conversation ID in conversation object');
        }
      }
    },
    onDisconnect: () => {
      console.log('Disconnected from ElevenLabs');
    },
    onMessage: async (message) => {
      console.log('Message received:', message);
      
      // Add message to transcript based on role
      if (message.source === 'user' && message.message) {
        const segment: TranscriptSegment = {
          speaker: 'student',
          text: stripVoiceTags(message.message),
          timestamp: Date.now(),
        };
        setTranscript((prev) => [...prev, segment]);
        
        // Save to database
        if (conversationId && user?.id) {
          // Check subscription limit before saving using database function
          const { data: subscription } = await supabase
            .from('justai_subscriptions')
            .select('id, monthly_message_limit, current_period_start, current_period_end')
            .eq('student_id', user.id)
            .eq('status', 'active')
            .single();

          if (!subscription) {
            alert('No active subscription found. Ending session.');
            await endSession();
            return;
          }

          // Check message limit using real-time count from justai_messages
          if (subscription.monthly_message_limit) {
            const { data: limitCheck } = await supabase.rpc('check_message_limit', {
              p_student_id: user.id,
              p_subscription_id: subscription.id,
            });

            if (limitCheck === false) {
              alert('You have reached your monthly message limit. Ending session.');
              await endSession();
              return;
            }
          }

          // Save user message (usage is automatically tracked via justai_usage_log_view)
          await supabase
            .from('justai_messages')
            .insert({
              conversation_id: conversationId,
              role: 'user',
              content: stripVoiceTags(message.message),
              is_voice_message: true,
            });
        }
      } else if (message.source === 'ai' && message.message) {
        const segment: TranscriptSegment = {
          speaker: 'ai',
          text: stripVoiceTags(message.message),
          timestamp: Date.now(),
        };
        setTranscript((prev) => [...prev, segment]);
        
        // Save to database (AI messages don't count toward user's limit)
        if (conversationId) {
          await supabase.from('justai_messages').insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: stripVoiceTags(message.message),
            is_voice_message: true,
          });
        }
      }
    },
    onError: (error) => {
      console.error('ElevenLabs error:', error);
      alert('Voice connection error. Please try again.');
    },
  });

  // Update speaking states based on ElevenLabs status
  useEffect(() => {
    setIsRecording(conversation.isSpeaking);
    setIsAISpeaking(conversation.status === 'connected' && !conversation.isSpeaking);
  }, [conversation.isSpeaking, conversation.status]);

  // Auto-scroll to bottom when transcript or suggestions change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, showSuggestions, suggestions]);

  // Initialize ElevenLabs connection
  useEffect(() => {
    const initConversation = async () => {
      try {
        setIsConnecting(true);
        
        if (!user?.id) {
          throw new Error('User not authenticated');
        }

        // Wait for user profile to load
        if (!userProfile) {
          return;
        }

        // Check subscription status and limits using real-time count
        const { data: subscription, error: subError } = await supabase
          .from('justai_subscriptions')
          .select('id, subscription_type, voice_minutes_limit, current_period_start, current_period_end')
          .eq('student_id', user.id)
          .eq('status', 'active')
          .single();

        if (subError || !subscription) {
          alert('No active subscription found. Please subscribe to use voice chat.');
          navigate('/subscription-plans');
          return;
        }

        // Check if user has exceeded their voice time limit using database function
        if (subscription.voice_minutes_limit) {
          const { data: limitCheck } = await supabase.rpc('check_voice_time_limit', {
            p_student_id: user.id,
            p_subscription_id: subscription.id,
          });

          if (limitCheck === false) {
            const limitMinutes = subscription.voice_minutes_limit;
            const limitDisplay = limitMinutes >= 60 
              ? `${Math.floor(limitMinutes / 60)} hour${Math.floor(limitMinutes / 60) > 1 ? 's' : ''}` 
              : `${limitMinutes} minutes`;
            alert(
              `You've reached your voice conversation limit (${limitDisplay}). Please upgrade your plan or wait until next billing cycle.`
            );
            navigate('/subscription-plans');
            return;
          }
        }

        // Create conversation record in database
        const { data: convData, error: convError } = await supabase
          .from('justai_conversations')
          .insert({
            student_id: user.id,
            conversation_type: 'voice_session',
            is_voice_session: true,
            title: `Voice Chat: ${selectedAgentName}`,
            scenario: selectedScenario,
            agent_id: agentDatabaseId || null, // Link to agent for progress tracking
            is_retry_attempt: location.state?.isRetryAttempt || false, // Mark retry attempts
          })
          .select()
          .single();

        if (convError) throw convError;
        setConversationId(convData.id);
        
        // Fetch agent's recommended duration for feedback
        if (agentDatabaseId) {
          const { data: agentData } = await supabase
            .from('justai_agents')
            .select('recommended_duration_seconds')
            .eq('id', agentDatabaseId)
            .single();
          
          if (agentData?.recommended_duration_seconds) {
            setRecommendedDuration(agentData.recommended_duration_seconds);
            console.log('⏱️ Agent recommended duration:', agentData.recommended_duration_seconds);
          }
        }
        
        // Get context memory from all previous conversations in the roleplay series
        // Or use passed session memory if this is a replay of a completed agent
        let contextMemory = '';
        
        // If sessionMemory was passed (replay of completed agent), use it directly
        if (passedSessionMemory) {
          console.log('📚 Using passed session memory for replay:', {
            type: typeof passedSessionMemory,
            isObject: typeof passedSessionMemory === 'object',
            sessionsCount: passedSessionMemory.sessions_count,
          });
          // Convert combined session_memory object to string format for the agent
          if (typeof passedSessionMemory === 'object') {
            const memoryParts: string[] = [];
            
            // Handle combined memory format (multiple sessions)
            if (passedSessionMemory.conversation_summaries?.length > 0) {
              memoryParts.push(`Previous conversation history:\n${passedSessionMemory.conversation_summaries.join('\n')}`);
            }
            if (passedSessionMemory.emotional_notes?.length > 0) {
              memoryParts.push(`Emotional journey:\n${passedSessionMemory.emotional_notes.join('\n')}`);
            }
            if (passedSessionMemory.open_threads?.length > 0) {
              memoryParts.push(`Topics to potentially revisit: ${passedSessionMemory.open_threads.join(', ')}`);
            }
            
            // Also handle single session memory format (backward compatibility)
            if (passedSessionMemory.conversation_summary) {
              memoryParts.push(`Previous conversation summary: ${passedSessionMemory.conversation_summary}`);
            }
            if (passedSessionMemory.emotional_notes && typeof passedSessionMemory.emotional_notes === 'string') {
              memoryParts.push(`Emotional notes: ${passedSessionMemory.emotional_notes}`);
            }
            if (passedSessionMemory.open_threads?.length > 0 && !passedSessionMemory.conversation_summaries) {
              memoryParts.push(`Open discussion threads: ${passedSessionMemory.open_threads.join(', ')}`);
            }
            
            contextMemory = memoryParts.join('\n\n');
          } else {
            contextMemory = String(passedSessionMemory);
          }
          console.log('✅ Session memory formatted for replay:', {
            length: contextMemory.length,
            preview: contextMemory.substring(0, 300),
          });
        } else if (agentDatabaseId) {
          try {
            console.log('📚 Fetching context memory for agent:', agentDatabaseId);
            contextMemory = await getContextMemory(agentDatabaseId);
            
            if (contextMemory) {
              console.log('✅ Context memory retrieved:', {
                type: typeof contextMemory,
                isString: typeof contextMemory === 'string',
                length: contextMemory.length,
                preview: contextMemory.substring(0, 200),
              });
            } else {
              console.log('ℹ️ No previous context memory found (first conversation or no memory stored)');
            }
          } catch (error) {
            console.error('❌ Error fetching context memory:', error);
            // Continue without context memory
          }
        }
        
        // Get signed URL from backend with voice override and agent ID
        const { signedUrl } = await getElevenLabsSignedUrl({
          conversationId: 'temp-' + crypto.randomUUID(), // Temporary ID for signed URL
          voiceId: userProfile.justai_preferred_voice,
          voiceName: selectedAgentName,
          agentId: selectedAgentId, // Pass the selected agent ID
          // Pass dynamic variables (context memory) to the edge function so the
          // signed URL includes the conversation_config_override on the server.
          ...(contextMemory && {
            dynamicVariables: {
              context_memory: contextMemory,
            },
          }),
        });
        // Log the actual context memory being sent (preview + snippet) for browser debugging
        if (contextMemory) {
          console.log('📤 Sending contextMemory to edge function:', {
            type: typeof contextMemory,
            isString: typeof contextMemory === 'string',
            length: contextMemory.length,
            preview: contextMemory.substring(0, 200),
            snippet1000: contextMemory.substring(0, 1000),
          });
        } else {
          console.log('📤 No contextMemory to send to edge function');
        }
        
        console.log('🔍 Signed URL received:', signedUrl);
        if (contextMemory) {
          console.log('📝 Context memory will be passed as dynamic variable to session');
          console.log('🔍 Dynamic variables object:', {
            context_memory: {
              type: typeof contextMemory,
              isString: typeof contextMemory === 'string',
              valuePreview: contextMemory.substring(0, 100)
            }
          });
        }
        console.log('🎤 Using voice ID:', userProfile.justai_preferred_voice || 'default agent voice');
        console.log('🤖 Using agent ID:', selectedAgentId || 'default agent');
        
        // Extract conversation ID from signed URL
        // URL format: wss://api.elevenlabs.io/v1/convai/conversation?agent_id=...&conversation_id=...
        try {
          const url = new URL(signedUrl.replace('wss://', 'https://'));
          console.log('🔍 Parsed URL search params:', url.search);
          console.log('🔍 All query params:', Object.fromEntries(url.searchParams.entries()));
          const convIdFromUrl = url.searchParams.get('conversation_id');
          console.log('🔍 conversation_id param:', convIdFromUrl);
          if (convIdFromUrl) {
            setElevenLabsConvId(convIdFromUrl);
            console.log('✅ Extracted ElevenLabs conversation ID from URL:', convIdFromUrl);
          } else {
            console.warn('⚠️ No conversation_id found in signed URL query params');
          }
        } catch (err) {
          console.error('❌ Failed to extract conversation ID from signed URL:', err);
        }
        
        // Start conversation with ElevenLabs
        // Pass dynamic variables at top level as per ElevenLabs SDK
        const sessionInfo = await conversation.startSession({
          signedUrl,
          ...(contextMemory && {
            dynamicVariables: {
              context_memory: contextMemory,
            },
          }),
          ...((!selectedAgentId && userProfile?.justai_preferred_voice) && {
            overrides: {
              tts: {
                voiceId: userProfile.justai_preferred_voice,
              },
            },
          }),
        });

        // sessionInfo is the ElevenLabs conversation ID (e.g., "conv_4301kbt9pxksf9cvhpspb1788w09")
        console.log('✅ ElevenLabs session started, conversation ID:', sessionInfo);
        
        if (sessionInfo && typeof sessionInfo === 'string') {
          setElevenLabsConvId(sessionInfo);
          console.log('✅ Stored ElevenLabs conversation ID:', sessionInfo);
        }

        sessionStartTime.current = new Date();
        
        // Reset suggestions counter for new session
        setSuggestionsUsedCount(0);
        
        // Track voice session started (use convData.id directly, not state)
        trackVoiceSessionStarted(
          selectedAgentId || 'default',
          selectedAgentName,
          selectedScenario,
          convData.id
        );

        // Add welcome message
        setTranscript([
          {
            speaker: 'ai',
            text: "Hi! I'm ready to chat. Press the button to start speaking!",
            timestamp: Date.now(),
          },
        ]);
      } catch (error) {
        console.error('Failed to initialize conversation:', error);
        setIsConnecting(false);
        alert('Failed to connect to voice chat. Please try again.');
      }
    };

    if (userProfile !== undefined) {
      initConversation();
    }

    // Cleanup on unmount
    return () => {
      if (conversation.status === 'connected') {
        conversation.endSession();
        // Save session data even if user navigates away
        saveAndProcessSession();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRecording || isAISpeaking) {
      interval = setInterval(() => {
        setSessionDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording, isAISpeaking]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };



  const handleTranslate = async (messageId: string, content: string) => {
    if (visibleTranslations.has(messageId)) {
      setVisibleTranslations((prev) => {
        const newSet = new Set(prev);
        newSet.delete(messageId);
        return newSet;
      });
      return;
    }

    if (translations[messageId]) {
      setVisibleTranslations((prev) => new Set(prev).add(messageId));
      return;
    }

    setLoadingTranslation((prev) => ({ ...prev, [messageId]: true }));
    
    try {
      const nativeLanguage = userProfile?.native_language || 'Russian';
      const session = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/translate-text`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.data.session?.access_token}`,
          },
          body: JSON.stringify({
            text: content,
            targetLanguage: nativeLanguage,
          }),
        }
      );

      if (!response.ok) throw new Error('Translation failed');

      const data = await response.json();
      setTranslations((prev) => ({ ...prev, [messageId]: data.translation || 'Translation failed' }));
      setVisibleTranslations((prev) => new Set(prev).add(messageId));
    } catch (error) {
      console.error('Translation error:', error);
    } finally {
      setLoadingTranslation((prev) => ({ ...prev, [messageId]: false }));
    }
  };

  const handlePlayAudio = async (messageId: string, content: string) => {
    if (playingAudio[messageId] && audioRefs.current[messageId]) {
      audioRefs.current[messageId].pause();
      audioRefs.current[messageId].currentTime = 0;
      delete audioRefs.current[messageId];
      setPlayingAudio((prev) => ({ ...prev, [messageId]: false }));
      return;
    }

    setPlayingAudio((prev) => ({ ...prev, [messageId]: true }));

    try {
      const session = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-text-to-speech`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.data.session?.access_token}`,
          },
          body: JSON.stringify({ text: content }),
        }
      );

      if (!response.ok) throw new Error('Failed to generate audio');

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      audioRefs.current[messageId] = audio;
      
      audio.onended = () => {
        setPlayingAudio((prev) => ({ ...prev, [messageId]: false }));
        delete audioRefs.current[messageId];
        URL.revokeObjectURL(audioUrl);
      };

      audio.onerror = () => {
        setPlayingAudio((prev) => ({ ...prev, [messageId]: false }));
        delete audioRefs.current[messageId];
        URL.revokeObjectURL(audioUrl);
      };

      await audio.play();
    } catch (error) {
      console.error('Audio playback error:', error);
      setPlayingAudio((prev) => ({ ...prev, [messageId]: false }));
      delete audioRefs.current[messageId];
    }
  };

  const handleWordClick = async (word: string, messageContent: string) => {
    const cleanWord = word.replace(/[.,!?;:]/g, '').trim();
    if (!cleanWord || loadingWord) return;

    // Create a cache key based on word and target language
    const cacheKey = `${cleanWord.toLowerCase()}_${userProfile?.native_language?.toLowerCase() || 'ru'}`;

    // Check if word definition exists in cache
    if (wordDefinitions[cacheKey]) {
      setSelectedWord(wordDefinitions[cacheKey]);
      setShowWordDrawer(true);
      return;
    }

    setLoadingWord(true);
    setShowWordDrawer(true);

    try {
      const session = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/word-analyze`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.data.session?.access_token}`,
          },
          body: JSON.stringify({
            text: messageContent,
            target_word: cleanWord,
            language: 'en',
            target_language: userProfile?.native_language?.toLowerCase() || 'ru',
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to analyze word');
      }

      const data = await response.json();
      const wordData = {
        word: data.word[0]?.word || cleanWord,
        lemma: data.word[0]?.lemma || cleanWord,
        pos: data.word[0]?.pos || 'UNKNOWN',
        definitions: data.definitions || [],
        synonyms: data.synonyms_wordnet || {},
        translations: data.translations || {},
      };

      setSelectedWord(wordData);

      // Cache the word definition
      setWordDefinitions((prev) => {
        const newDefinitions = { ...prev, [cacheKey]: wordData };
        localStorage.setItem('ai-chat-word-definitions', JSON.stringify(newDefinitions));
        return newDefinitions;
      });
    } catch (error) {
      console.error('Word analysis error:', error);
      setShowWordDrawer(false);
    } finally {
      setLoadingWord(false);
    }
  };

  // Handle "Help me answer" button click
  const handleHelpMeAnswer = async () => {
    if (loadingSuggestions || transcript.length === 0 || suggestionsUsedCount >= MAX_SUGGESTIONS_PER_SESSION) return;

    setLoadingSuggestions(true);
    setShowSuggestions(true);

    try {
      // Get active vocabulary goals for the user
      const { data: vocabularyGoals } = await supabase.rpc('get_active_lesson_goals', {
        student_uuid: user?.id,
        lesson_uuid: null,
      });

      const vocabularyWords = vocabularyGoals?.map((v: any) => v.lemma) || [];

      // Convert transcript to the format expected by the API
      const transcriptMessages = transcript.map(segment => ({
        speaker: segment.speaker,
        text: segment.text,
      }));

      // Get suggestions from API
      const suggestionsList = await getConversationSuggestions({
        transcript: transcriptMessages,
        vocabularyWords,
      });

      setSuggestions(suggestionsList);
      setCurrentSuggestionIndex(0); // Reset to first suggestion
      
      // Increment usage count
      setSuggestionsUsedCount(prev => prev + 1);
    } catch (error) {
      console.error('Failed to get suggestions:', error);
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  // Handle suggestion click - send to ElevenLabs agent
  const handleSuggestionClick = async (suggestion: string) => {
    try {
      // Hide suggestions
      setShowSuggestions(false);
      setSuggestions([]);

      // Immediately add suggestion to transcript as user message
      const segment: TranscriptSegment = {
        speaker: 'student',
        text: suggestion,
        timestamp: Date.now(),
      };
      setTranscript((prev) => [...prev, segment]);

      // Save to database
      if (conversationId && user?.id) {
        await supabase.from('justai_messages').insert({
          conversation_id: conversationId,
          role: 'user',
          content: suggestion,
          is_voice_message: false, // This is a text suggestion
        });
      }

      // Send the text message to ElevenLabs conversation to get AI response
      if (conversation.status === 'connected') {
        conversation.sendUserMessage(suggestion);
      } else {
        console.warn('Conversation not connected, cannot get AI response');
      }
    } catch (error) {
      console.error('Failed to send suggestion:', error);
    }
  };

  // Save session data and trigger processing
  const saveAndProcessSession = async () => {
    if (sessionSaved.current) {
      console.log('Session already saved, skipping');
      return;
    }
    
    if (conversationId && elevenLabsConvId && user?.id && sessionStartTime.current) {
      sessionSaved.current = true;
      try {
        const endTime = new Date();
        const durationSeconds = Math.floor(
          (endTime.getTime() - sessionStartTime.current.getTime()) / 1000
        );
        
        // Track voice session ended
        if (conversationId) {
          trackVoiceSessionEnded(
            selectedAgentId || 'default',
            selectedAgentName,
            selectedScenario,
            conversationId,
            durationSeconds,
            transcript.length,
            elevenLabsConvId || undefined
          );
        }

        console.log('🔵 Saving voice session:', {
          conversationId,
          elevenLabsConvId,
          durationSeconds,
          startTime: sessionStartTime.current,
          endTime,
        });

        const { data: voiceSessionData } = await supabase
          .from('justai_voice_sessions')
          .insert({
            conversation_id: conversationId,
            student_id: user.id,
            elevenlabs_conversation_id: elevenLabsConvId,
            total_duration_seconds: durationSeconds,
            started_at: sessionStartTime.current.toISOString(),
            ended_at: endTime.toISOString(),
          })
          .select()
          .single();

        // Update conversation with final message time
        await supabase
          .from('justai_conversations')
          .update({
            last_message_at: endTime.toISOString(),
            voice_session_duration: durationSeconds,
          })
          .eq('id', conversationId);

        // Trigger background processing (transcript, vocab, grammar, costs)
        // This is non-blocking - we don't wait for it to complete
        if (voiceSessionData) {
          console.log('🚀 Triggering process-voice-session for:', voiceSessionData.id);
          const session = await supabase.auth.getSession();
          fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-voice-session`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.data.session?.access_token}`,
              },
              body: JSON.stringify({
                voiceSessionId: voiceSessionData.id,
              }),
            }
          ).then(async (response) => {
            console.log('✅ Process function response:', response.status);
            if (!response.ok) {
              throw new Error(`Process function failed: ${response.status}`);
            }
            return response.json();
          }).then(async (result) => {
            console.log('✅ Process function result:', result);
            console.log('🔍 result.studentSegmentIds:', result.studentSegmentIds);
            console.log('🔍 studentSegmentIds length:', result.studentSegmentIds?.length);
            
            // Process vocabulary for student segments
            if (result.success && result.studentSegmentIds && result.studentSegmentIds.length > 0) {
              console.log(`🎯 Processing vocabulary for ${result.studentSegmentIds.length} student segments`);
              
              // Process each segment in parallel
              const vocabPromises = result.studentSegmentIds.map(async (segmentId: string) => {
                try {
                  const vocabResponse = await fetch(
                    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vocab-ingest-segment`,
                    {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.data.session?.access_token}`,
                      },
                      body: JSON.stringify({
                        lessonId: result.lessonId,
                        segmentId: segmentId,
                        studentId: user.id,
                      }),
                    }
                  );
                  
                  if (!vocabResponse.ok) {
                    const error = await vocabResponse.text();
                    console.error(`❌ Vocab processing failed for segment ${segmentId}:`, error);
                    return { segmentId, success: false, error };
                  }
                  
                  const vocabResult = await vocabResponse.json();
                  console.log(`✅ Vocab processed for segment ${segmentId}:`, vocabResult);
                  return { segmentId, success: true, ...vocabResult };
                } catch (error) {
                  console.error(`❌ Error processing vocab for segment ${segmentId}:`, error);
                  return { segmentId, success: false, error };
                }
              });
              
              const vocabResults = await Promise.all(vocabPromises);
              const successCount = vocabResults.filter(r => r.success).length;
              console.log(`✅ Vocabulary processing complete: ${successCount}/${result.studentSegmentIds.length} successful`);
            }
          }).catch((error) => {
            console.error('❌ Failed to trigger voice session processing:', error);
          });
        }
      } catch (error) {
        console.error('❌ Error saving session:', error);
        sessionSaved.current = false; // Reset on error so we can retry
      }
    } else {
      console.warn('⚠️ Cannot save session - missing required data:', {
        conversationId,
        elevenLabsConvId,
        userId: user?.id,
        hasStartTime: !!sessionStartTime.current,
      });
    }
  };

  const endSession = async () => {
    try {
      // Check if session is long enough for feedback BEFORE ending
      const actualDuration = sessionDuration;
      const isShortSession = actualDuration < recommendedDuration;
      
      if (isShortSession) {
        // Show "talk more" prompt WITHOUT ending the session
        setShowContinuePrompt(true);
        setShowFeedbackDrawer(true);
      } else {
        // Session is long enough - end it and show feedback
        await finalizeAndShowFeedback();
      }
    } catch (error) {
      console.error('Error ending session:', error);
      // Still navigate back on error
      navigateBack();
    }
  };
  
  const finalizeAndShowFeedback = async () => {
    try {
      // Show drawer with loading state first
      setShowFeedbackDrawer(true);
      setIsFetchingFeedback(true);
      
      // End ElevenLabs session
      if (conversation.status === 'connected') {
        await conversation.endSession();
      }

      // Save session data and wait for completion
      await saveAndProcessSession();
      
      // Wait longer for ElevenLabs to process the conversation
      // Their API needs time to finalize the transcript
      console.log('⏳ Waiting for ElevenLabs to process conversation...');
      await new Promise(resolve => setTimeout(resolve, 3000)); // 3 seconds
      
      // Fetch and show full feedback
      await fetchFeedback();
    } catch (error) {
      console.error('Error finalizing session:', error);
      setIsFetchingFeedback(false);
      throw error;
    }
  };
  
  const fetchFeedback = async () => {
    if (!conversationId || !elevenLabsConvId || !user?.id) {
      console.warn('Missing required data for feedback');
      return;
    }
    
    console.log('🔍 Fetching feedback for:', { conversationId, elevenLabsConvId, userId: user.id });
    
    setIsFetchingFeedback(true);
    try {
      const session = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-conversation-feedback`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.data.session?.access_token}`,
          },
          body: JSON.stringify({
            conversationId,
            elevenLabsConvId,
            studentId: user.id,
          }),
        }
      );
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Feedback result:', result);
        if (result.success && result.feedback) {
          // Check if conversation was too short
          if (result.feedback.tooShort) {
            console.log('⏱️ Conversation too short, showing continue prompt');
            setShowContinuePrompt(true);
            setShowFeedbackDrawer(true);
          } else {
            setFeedbackData(result.feedback);
            setShowContinuePrompt(false);
          }
        } else {
          console.error('Feedback result missing data:', result);
        }
      } else {
        const errorText = await response.text();
        console.error('Failed to fetch feedback:', response.status, errorText);
      }
    } catch (error) {
      console.error('Error fetching feedback:', error);
    } finally {
      setIsFetchingFeedback(false);
    }
  };
  
  const navigateBack = () => {
    if (conversationId) {
      navigate(`/ai-chat?conversation=${conversationId}`);
    } else {
      navigate('/ai-chat');
    }
  };
  
  const handleFeedbackClose = () => {
    setShowFeedbackDrawer(false);
    
    // If it was a short session prompt, actually end and save the session now
    if (showContinuePrompt) {
      setShowContinuePrompt(false);
      // End the session and navigate
      finalizeAndNavigate();
    } else {
      // Full feedback was shown, just navigate
      navigateBack();
    }
  };
  
  const finalizeAndNavigate = async () => {
    try {
      // End ElevenLabs session
      if (conversation.status === 'connected') {
        await conversation.endSession();
      }

      // Save session data
      await saveAndProcessSession();
      
      // Small delay for DB operations
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      console.error('Error finalizing session:', error);
    } finally {
      navigateBack();
    }
  };
  
  const handleContinueTalking = () => {
    // Close drawer and let user continue talking
    setShowFeedbackDrawer(false);
    setShowContinuePrompt(false);
    // Session remains active - user can keep talking
  };

  return (
    <div 
      className="h-screen bg-cover bg-center bg-no-repeat flex flex-col page-enter"
      style={{ backgroundImage: `url(${bgWelcome})` }}
    >
      <AnimatePresence mode="wait">
        {isConnecting ? (
          /* Centered Agent Introduction Screen */
          <CenteredAgentIntro
            agentName={selectedAgentName}
            agentDescription={agentData?.description || selectedScenario}
            agentImageUrl={getAvatarUrl(agentData?.image_url)}
          />
        ) : (
          /* Connected State - Full Chat Interface matching Figma */
          <motion.div
            key="connected"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col h-full"
          >
            {/* Header with Agent Info and Voice Bars - Transparent Background */}
            <motion.header
              initial={{ y: -100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
              className="px-4 py-4 flex items-center justify-between"
            >
              {/* Left Side: Back + Avatar + Name */}
              <div className="flex items-center gap-3 flex-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    // If a session has been started (has conversation ID), end it properly
                    if (conversationId || sessionStartTime.current) {
                      endSession();
                    } else {
                      navigate(-1);
                    }
                  }}
                  className="rounded-full -ml-2 h-10 w-10"
                >
                  <ArrowLeft className="w-6 h-6" />
                </Button>
                
                {/* Agent Avatar */}
                <Avatar className="w-14 h-14 border-2 border-white shadow-md">
                  <AvatarImage src={getAvatarUrl(agentData?.image_url)} />
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-500 text-white text-xl">
                    👤
                  </AvatarFallback>
                </Avatar>
                
                {/* Agent Name + Subtitle */}
                <div className="flex flex-col">
                  <span className="font-semibold text-md leading-tight">{selectedAgentName}</span>
                  {/* <span className="text-sm text-gray-600">{selectedScenario.replace('_', ' ')}</span> */}
                </div>
              </div>

              {/* Right Side: Voice Bars + Timer */}
              <div className="flex items-center gap-3">
                {/* Live Voice Bars */}
                {(isRecording || isAISpeaking) && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                  >
                    <VoiceBars
                      levels={audioLevels}
                      isActive={isRecording || isAISpeaking}
                      color={isRecording ? 'green' : 'blue'}
                      size="md"
                    />
                  </motion.div>
                )}
                
                {/* Timer with fixed height */}
                <div className={cn(
                  "bg-white rounded-full px-4 py-2 min-w-[70px] flex items-center justify-center transition-colors",
                  sessionDuration >= recommendedDuration && "bg-green-50 ring-2 ring-green-500"
                )}>
                  <span className={cn(
                    "text-sm font-medium tabular-nums",
                    sessionDuration >= recommendedDuration && "text-green-700"
                  )}>
                    {formatDuration(sessionDuration)}
                    {sessionDuration >= recommendedDuration && " ✓"}
                  </span>
                </div>
              </div>
            </motion.header>

            {/* Main Content Area with Rounded Container - matching AIChatHome */}
            <div className="flex-1 bg-gray-100 rounded-[40px] m-2 flex flex-col overflow-hidden">
              {/* Chat Messages Area (Scrollable) */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.5 }}
                className="flex-1 overflow-y-auto px-6 py-6 space-y-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
              >
                {transcript.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center text-muted-foreground">
                      <AudioWaveform className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">Start speaking to begin the conversation</p>
                    </div>
                  </div>
                ) : (
                  transcript.map((segment, idx) => {
                    const messageId = `${segment.timestamp}-${idx}`;
                    return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className={cn(
                        'flex gap-3',
                        segment.speaker === 'student' ? 'justify-end' : 'justify-start'
                      )}
                    >
                      {segment.speaker === 'ai' && (
                        <Avatar className="w-8 h-8 flex-shrink-0">
                          <AvatarImage src={getAvatarUrl(agentData?.image_url)} />
                          <AvatarFallback>🤖</AvatarFallback>
                        </Avatar>
                      )}
                      <div className="flex flex-col gap-2 pt-0">
                        <div
                          className={cn(
                            'px-4 py-3 rounded-2xl transition-all duration-300 ease-in-out',
                            segment.speaker === 'student'
                              ? 'bg-[hsl(var(--brand-blue))] text-white'
                              : 'bg-white text-gray-900 shadow-sm'
                          )}
                        >
                          {segment.speaker === 'ai' ? (
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">
                              {segment.text.split(' ').map((word, index) => (
                                <span key={index}>
                                  <span
                                    onClick={() => handleWordClick(word, segment.text)}
                                    className="cursor-pointer hover:bg-blue-100 hover:text-blue-700 rounded transition-colors"
                                  >
                                    {word}
                                  </span>
                                  {index < segment.text.split(' ').length - 1 ? ' ' : ''}
                                </span>
                              ))}
                            </p>
                          ) : (
                            <p className="text-sm whitespace-pre-wrap">{segment.text}</p>
                          )}
                          <div 
                            className={cn(
                              "grid transition-all duration-300 ease-in-out",
                              (visibleTranslations.has(messageId) || loadingTranslation[messageId]) 
                                ? "grid-rows-[1fr] opacity-100" 
                                : "grid-rows-[0fr] opacity-0"
                            )}
                          >
                            <div className="overflow-hidden">
                              <div className="mt-2 pt-2 border-t border-gray-200">
                                {loadingTranslation[messageId] ? (
                                  <div className="space-y-2">
                                    <Skeleton className="h-3 w-full" />
                                    <Skeleton className="h-3 w-3/4" />
                                  </div>
                                ) : visibleTranslations.has(messageId) && translations[messageId] ? (
                                  <p className="text-sm text-gray-600">{translations[messageId]}</p>
                                ) : null}
                              </div>
                            </div>
                          </div>
                          <p
                            className={cn(
                              'text-xs mt-1',
                              segment.speaker === 'student' ? 'text-blue-100' : 'text-gray-400'
                            )}
                          >
                            {new Date(segment.timestamp).toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                        
                        {/* Action buttons for AI messages */}
                        {segment.speaker === 'ai' && (
                            <div className="flex gap-2 ml-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-gray-500 hover:text-gray-700"
                              onClick={() => handlePlayAudio(messageId, segment.text)}
                            >
                              {playingAudio[messageId] ? (
                                <CircleStop className="w-4 h-4" />
                              ) : (
                                <Volume2 className="w-4 h-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-0 text-gray-500 hover:text-gray-700"
                              onClick={() => handleTranslate(messageId, segment.text)}
                              disabled={loadingTranslation[messageId]}
                            >
                              <Languages className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                      {segment.speaker === 'student' && (
                        <Avatar className="w-8 h-8 flex-shrink-0">
                          <AvatarImage src={userProfile?.profile_photo_url} />
                          <AvatarFallback>{userProfile?.display_name?.[0] || 'U'}</AvatarFallback>
                        </Avatar>
                      )}
                    </motion.div>
                  );
                })
                )}
                
                {/* Suggestions - shown inline when help me answer is clicked */}
                {showSuggestions && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="px-3 pt-2 pb-4"
                  >
                    <p className="text-xs text-gray-500 font-medium mb-2">Suggested response:</p>
                    {loadingSuggestions ? (
                      <Skeleton className="h-12 w-3/4 rounded-2xl" />
                    ) : suggestions.length > 0 ? (
                      <div className="flex gap-2 items-start">
                        <button
                          onClick={() => handleSuggestionClick(suggestions[currentSuggestionIndex])}
                          className="flex-1 px-4 py-3 bg-white border border-gray-200 rounded-2xl text-left text-sm text-gray-700 hover:bg-blue-50 hover:border-blue-300 transition-all duration-200 shadow-sm hover:shadow"
                        >
                          <AnimatePresence mode="wait">
                            <motion.span
                              key={currentSuggestionIndex}
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -5 }}
                              transition={{ duration: 0.15 }}
                              className="block"
                            >
                              {suggestions[currentSuggestionIndex]}
                            </motion.span>
                          </AnimatePresence>
                        </button>
                        {suggestions.length > 1 && (
                          <Button
                            variant="outline"
                            size="icon"
                            className="flex-shrink-0 h-10 w-10 rounded-2xl border-gray-200 hover:bg-blue-50 hover:border-blue-300 transition-all duration-200"
                            onClick={() => setCurrentSuggestionIndex((prev) => (prev + 1) % suggestions.length)}
                            title="Show next suggestion"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                            </svg>
                          </Button>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 text-center py-2">No suggestions available</p>
                    )}
                    {suggestions.length > 1 && (
                      <p className="text-xs text-gray-400 mt-2 text-center">
                        {currentSuggestionIndex + 1} of {suggestions.length}
                      </p>
                    )}
                  </motion.div>
                )}
                {/* Scroll anchor */}
                <div ref={messagesEndRef} />
              </motion.div>
            </div>

            {/* Bottom Bar - OUTSIDE the rounded container */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="px-5 pb-6"
            >
              <div className="flex items-center gap-3">
                {/* Microphone Button (Mute/Unmute) - Just icon */}
                <button
                  className="flex-shrink-0 text-gray-700 hover:text-gray-900 transition-colors disabled:opacity-50"
                  onClick={() => {
                    const newMutedState = !isMuted;
                    setIsMuted(newMutedState);
                    
                    // Mute/unmute the microphone input to prevent/allow sending voice to agent
                    if (micStreamRef.current) {
                      micStreamRef.current.getAudioTracks().forEach(track => {
                        // Use the track's muted property to mute audio device
                        if ('enabled' in track) {
                          track.enabled = !newMutedState;
                        }
                      });
                    }
                  }}
                  disabled={conversation.status !== 'connected'}
                >
                  {isMuted ? (
                    <MicOff className="w-7 h-7" />
                  ) : (
                    <Mic className="w-7 h-7" />
                  )}
                </button>

                {/* Help me answer Button - rounded pill */}
                <Button
                  variant="outline"
                  className="flex-1 h-12 rounded-full bg-white border-gray-300 text-gray-600 text-sm disabled:opacity-50 relative"
                  onClick={handleHelpMeAnswer}
                  disabled={loadingSuggestions || transcript.length === 0 || conversation.status !== 'connected' || suggestionsUsedCount >= MAX_SUGGESTIONS_PER_SESSION}
                >
                  {loadingSuggestions 
                    ? 'Getting suggestions...' 
                    : suggestionsUsedCount >= MAX_SUGGESTIONS_PER_SESSION
                      ? 'No suggestions left'
                      : 'Help me answer'
                  }
                  {!loadingSuggestions && suggestionsUsedCount < MAX_SUGGESTIONS_PER_SESSION && (
                    <span className="-top-1 -right-1 bg-gray-700 text-white text-xs font-semibold w-5 h-5 rounded-full flex items-center justify-center">
                      {MAX_SUGGESTIONS_PER_SESSION - suggestionsUsedCount}
                    </span>
                  )}
                </Button>

                {/* Close/Cancel Button - Just icon */}
                <button
                  className="flex-shrink-0 text-gray-700 hover:text-gray-900 transition-colors"
                  onClick={endSession}
                >
                  <X className="w-7 h-7" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Word Analysis Drawer */}
      <Drawer open={showWordDrawer} onOpenChange={setShowWordDrawer}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle className="text-2xl font-bold">
              {loadingWord ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                selectedWord?.word
              )}
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-8 overflow-y-auto">
            {loadingWord ? (
              <div className="space-y-4">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : selectedWord ? (
              <div className="space-y-6">
                {/* Word Info */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="text-xs">
                      {selectedWord.pos}
                    </Badge>
                    {selectedWord.lemma !== selectedWord.word && (
                      <span className="text-sm text-gray-500">→ {selectedWord.lemma}</span>
                    )}
                  </div>
                </div>

                {/* Translations */}
                {Object.keys(selectedWord.translations).length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2 text-gray-700">Translations</h3>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(selectedWord.translations)
                        .sort(([, a], [, b]) => (b as number) - (a as number))
                        .slice(0, 5)
                        .map(([trans]) => (
                          <Badge key={trans} variant="outline">
                            {trans}
                          </Badge>
                        ))}
                    </div>
                  </div>
                )}

                {/* Definitions */}
                {selectedWord.definitions.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2 text-gray-700">Definitions</h3>
                    <div className="space-y-3">
                      {selectedWord.definitions.slice(0, 3).map((def, idx) => (
                        <div key={idx} className="pl-3 border-l-2 border-blue-200">
                          <p className="text-sm text-gray-700 mb-1">{def.definition}</p>
                          {def.example && (
                            <p className="text-xs text-gray-500 italic">"{def.example}"</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Synonyms */}
                {Object.keys(selectedWord.synonyms).length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2 text-gray-700">Synonyms</h3>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(selectedWord.synonyms)
                        .sort(([, a], [, b]) => (b as number) - (a as number))
                        .slice(0, 10)
                        .map(([syn]) => (
                          <Badge key={syn} variant="secondary" className="text-xs">
                            {syn}
                          </Badge>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Feedback Drawer */}
      <FeedbackDrawer
        open={showFeedbackDrawer}
        onOpenChange={handleFeedbackClose}
        conversationId={conversationId}
        elevenLabsConvId={elevenLabsConvId}
        isLoading={isFetchingFeedback}
        feedbackData={feedbackData}
        onContinue={handleContinueTalking}
        showContinuePrompt={showContinuePrompt}
      />
    </div>
  );
}
