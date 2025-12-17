import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  MoreVertical,
  Square,
  X,
  Mic,
  MicOff,
  AudioWaveform,
} from 'lucide-react';
import { useConversation } from '@elevenlabs/react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getElevenLabsSignedUrl } from '@/lib/justai-api';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/hooks/useSession';
import { FeedbackDrawer, type FeedbackData } from '@/components/FeedbackDrawer';
import { getAgentByElevenLabsId } from '@/config/elevenlabs-agents';

interface TranscriptSegment {
  speaker: 'student' | 'ai';
  text: string;
  timestamp: number;
}

export default function AIChatVoice() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useSession();
  const [isRecording, setIsRecording] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [showButton, setShowButton] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [waveformHeights, setWaveformHeights] = useState<number[]>(
    Array.from({ length: 30 }, () => 0.2)
  );
  const [isConnecting, setIsConnecting] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [elevenLabsConvId, setElevenLabsConvId] = useState<string | null>(null);
  const sessionStartTime = useRef<Date | null>(null);
  const sessionSaved = useRef(false);
  const [showFeedbackDrawer, setShowFeedbackDrawer] = useState(false);
  const [feedbackData, setFeedbackData] = useState<FeedbackData | null>(null);
  const [isFetchingFeedback, setIsFetchingFeedback] = useState(false);
  const [showContinuePrompt, setShowContinuePrompt] = useState(false);

  // Get agent info from navigation state
  const selectedAgentId = location.state?.agentId; // ElevenLabs agent ID (undefined = use default)
  const selectedAgentName = location.state?.agentName || 'AI Teacher';
  const selectedScenario = location.state?.scenario || 'general_conversation';
  const agentDatabaseId = location.state?.agentDatabaseId; // Database ID from justai_agents table
  
  // Get agent config for recommended duration
  const agentConfig = selectedAgentId 
    ? getAgentByElevenLabsId(selectedAgentId)
    : null;
  const recommendedDuration = agentConfig?.recommendedDuration || 300; // Default 5 minutes

  console.log('🤖 Selected Agent:', {
    agentId: selectedAgentId || 'DEFAULT (from Supabase secrets)',
    agentName: selectedAgentName,
    scenario: selectedScenario,
    agentDatabaseId: agentDatabaseId || 'None (no progress tracking)',
  });

  // Get user's preferred voice
  const { data: userProfile } = useQuery({
    queryKey: ['user-profile-voice', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('justai_preferred_voice')
        .eq('id', user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // ElevenLabs conversation hook
  const conversation = useConversation({
    onConnect: () => {
      console.log('🟢 Connected to ElevenLabs');
      setIsConnecting(false);
      
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
          text: message.message,
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
              content: message.message,
              is_voice_message: true,
            });
        }
      } else if (message.source === 'ai' && message.message) {
        const segment: TranscriptSegment = {
          speaker: 'ai',
          text: message.message,
          timestamp: Date.now(),
        };
        setTranscript((prev) => [...prev, segment]);
        
        // Save to database (AI messages don't count toward user's limit)
        if (conversationId) {
          await supabase.from('justai_messages').insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: message.message,
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
          .select('id, subscription_type, monthly_message_limit, current_period_start, current_period_end')
          .eq('student_id', user.id)
          .eq('status', 'active')
          .single();

        if (subError || !subscription) {
          alert('No active subscription found. Please subscribe to use voice chat.');
          navigate('/subscription-plans');
          return;
        }

        // Check if user has exceeded their monthly limit using database function
        if (subscription.monthly_message_limit) {
          const { data: limitCheck } = await supabase.rpc('check_message_limit', {
            p_student_id: user.id,
            p_subscription_id: subscription.id,
          });

          if (limitCheck === false) {
            alert(
              `You've reached your monthly message limit (${subscription.monthly_message_limit} messages). Please upgrade your plan or wait until next billing cycle.`
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
          })
          .select()
          .single();

        if (convError) throw convError;
        setConversationId(convData.id);
        
        // Fetch previous step's dynamic variables for context continuity
        let previousStepVariables = null;
        if (agentDatabaseId) {
          // Get the current agent to find parent and previous step
          const { data: currentAgent } = await supabase
            .from('justai_agents')
            .select('parent_agent_id, step_number')
            .eq('id', agentDatabaseId)
            .single();
          
          if (currentAgent?.parent_agent_id && currentAgent.step_number && currentAgent.step_number > 1) {
            // Find the previous step in this multi-step scenario
            const { data: previousStepAgent } = await supabase
              .from('justai_agents')
              .select('id')
              .eq('parent_agent_id', currentAgent.parent_agent_id)
              .eq('step_number', currentAgent.step_number - 1)
              .single();
            
            if (previousStepAgent) {
              // Get the most recent completed conversation for this agent
              const { data: previousConversation } = await supabase
                .from('justai_conversations')
                .select('session_memory')
                .eq('student_id', user.id)
                .eq('agent_id', previousStepAgent.id)
                .not('session_memory', 'is', null)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();
              
              if (previousConversation?.session_memory) {
                previousStepVariables = previousConversation.session_memory;
                console.log('Found dynamic variables from previous step:', previousStepVariables);
              }
            }
          }
        }
        
        // Get signed URL from backend with voice override and agent ID
        const { signedUrl } = await getElevenLabsSignedUrl({
          conversationId: 'temp-' + crypto.randomUUID(), // Temporary ID for signed URL
          voiceId: userProfile.justai_preferred_voice,
          voiceName: selectedAgentName,
          agentId: selectedAgentId, // Pass the selected agent ID
          dynamicVariables: previousStepVariables, // Pass context from previous step
        });
        
        console.log('🔍 Signed URL received:', signedUrl);
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
        // Only override voice for free speech (no selectedAgentId), not for roleplays
        const sessionInfo = await conversation.startSession({
          signedUrl,
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

  // Show button with animation after transition
  useEffect(() => {
    const fromTransition = location.state?.fromTransition;
    if (fromTransition) {
      // Wait for the morphing animation to complete
      setTimeout(() => setShowButton(true), 500);
    } else {
      setShowButton(true);
    }
  }, [location]);

  // Animate waveform bars
  useEffect(() => {
    let animationInterval: ReturnType<typeof setInterval>;
    if (isRecording || isAISpeaking) {
      animationInterval = setInterval(() => {
        setWaveformHeights(
          Array.from({ length: 30 }, () => Math.random() * 0.8 + 0.2)
        );
      }, 100);
    } else {
      setWaveformHeights(Array.from({ length: 30 }, () => 0.2));
    }
    return () => clearInterval(animationInterval);
  }, [isRecording, isAISpeaking]);

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

  const toggleRecording = async () => {
    if (conversation.status !== 'connected') {
      return;
    }

    if (isRecording) {
      // Stop recording - ElevenLabs will automatically process
      conversation.setVolume({ volume: isMuted ? 0 : 1 });
    } else {
      // Start recording - handled by ElevenLabs
      conversation.setVolume({ volume: isMuted ? 0 : 1 });
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
          setFeedbackData(result.feedback);
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
    <div className="h-screen bg-background flex flex-col page-enter">
      {/* Header */}
      <header className="px-4 py-3 flex items-center justify-between border-b">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="rounded-full"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-medium">
            {formatDuration(sessionDuration)}
          </span>
        </div>
        <Button variant="ghost" size="icon" className="rounded-full">
          <MoreVertical className="w-5 h-5" />
        </Button>
      </header>

      {/* AI Avatar / Waveform Visualization */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="text-center">
          {/* AI Avatar */}
          <div
            className={cn(
              'w-32 h-32 mx-auto mb-6 rounded-full bg-primary flex items-center justify-center shadow-2xl transition-all duration-300',
              isAISpeaking && 'scale-110 pulse-glow'
            )}
          >
            <div className="text-6xl">{isAISpeaking ? '🗣️' : '👋'}</div>
          </div>

          {/* Status Text */}
          <h2 className="text-xl font-semibold mb-2">
            {isConnecting
              ? 'Connecting...'
              : isRecording
              ? "I'm listening..."
              : isAISpeaking
              ? `${selectedAgentName} is speaking...`
              : `Chat with ${selectedAgentName}`}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isConnecting
              ? 'Setting up voice connection...'
              : isRecording
              ? "Go ahead, I'm listening"
              : isAISpeaking
              ? 'Just a moment...'
              : 'Tap the button to start talking'}
          </p>

          {/* Real-time Waveform - Animated */}
          {(isRecording || isAISpeaking) && (
            <div className="mt-8 flex items-center justify-center gap-1 h-20">
              {waveformHeights.map((height, i) => (
                <div
                  key={i}
                  className={cn(
                    'w-1 rounded-full transition-all duration-100 ease-in-out',
                    isAISpeaking ? 'bg-blue-500' : 'bg-green-500'
                  )}
                  style={{
                    height: `${height * 100}%`,
                    opacity: isRecording ? 1 : 0.8,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Transcript Display (Scrollable) */}
      <div className="max-h-48 overflow-y-auto px-4 mb-4 space-y-3">
        {transcript.slice(-5).map((segment, idx) => (
          <div
            key={idx}
            className={cn(
              'flex gap-2',
              segment.speaker === 'student' ? 'justify-end' : 'justify-start'
            )}
          >
            <div
              className={cn(
                'max-w-[80%] px-4 py-2 rounded-2xl',
                segment.speaker === 'student'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
              )}
            >
              <p className="text-sm">{segment.text}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Controls */}
      <div className="px-4 pb-8">
        <div className="flex flex-col items-center justify-center gap-4">
          {/* Main Voice Button - Large Circular */}
          <Button
            variant={isRecording ? "destructive" : "default"}
            size="icon"
            className={cn(
              'w-28 h-28 rounded-full shadow-2xl transition-all duration-500',
              isRecording && 'scale-110',
              showButton ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
            )}
            onClick={toggleRecording}
            disabled={isConnecting || conversation.status !== 'connected'}
          >
            {isRecording ? (
              <Square className="w-10 h-10" />
            ) : (
              <AudioWaveform className="w-12 h-12" />
            )}
          </Button>

          {/* Text below button */}
          <p className={cn(
            'text-center text-sm text-muted-foreground transition-all duration-500 delay-100',
            showButton ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          )}>
            {isRecording ? 'Release to send' : 'Hold to speak'}
          </p>
        </div>

        {/* Secondary controls - moved to top corners or hidden */}
        <div className="absolute bottom-8 left-4 right-4 flex justify-between opacity-50 hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => {
              const newMutedState = !isMuted;
              setIsMuted(newMutedState);
              conversation.setVolume({ volume: newMutedState ? 0 : 1 });
            }}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={endSession}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>
      
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
