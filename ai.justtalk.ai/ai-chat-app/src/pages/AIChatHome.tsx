import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  PanelLeft,
  Sparkles,
  ChevronLeft,
  Volume2,
  CircleStop,
  Languages,
  Bookmark,
  MessageCircle,
  Star,
  TrendingUp,
  Target,
  AlertCircle,
} from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Drawer,
  DrawerContent,
} from '@/components/ui/drawer';
import { AppSidebar } from '@/components/AppSidebar';
import { VoiceButtonTransition } from '@/components/VoiceButtonTransition';
import { supabase } from '@/lib/supabase';
import { checkSubscriptionAccess } from '@/lib/justai-api';
import { getAgentsByCategory } from '@/services/agents.service';
import LogoBars from '@/assets/logo_bars.svg';
import Logo from '@/assets/logo.svg';
import { cn } from '@/lib/utils';

export default function AIChatHome() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionStart, setTransitionStart] = useState<{ x: number; y: number } | undefined>();
  const [showSidebar, setShowSidebar] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [showFeedbackDrawer, setShowFeedbackDrawer] = useState(false);

  // Handle URL query parameter or location state for auto-selecting conversation
  useEffect(() => {
    // Check location state first (from sidebar navigation)
    const stateConversationId = location.state?.selectedConversation;
    if (stateConversationId) {
      setSelectedConversation(stateConversationId);
      // Invalidate and refetch messages for this conversation
      queryClient.invalidateQueries({ queryKey: ['conversation-messages', stateConversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      // Clear the state
      window.history.replaceState({}, '', '/ai-chat');
      return;
    }
    
    // Fall back to URL query parameter
    const params = new URLSearchParams(window.location.search);
    const conversationId = params.get('conversation');
    if (conversationId) {
      setSelectedConversation(conversationId);
      // Invalidate and refetch messages for this conversation
      queryClient.invalidateQueries({ queryKey: ['conversation-messages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      // Clean up URL without refreshing
      window.history.replaceState({}, '', '/ai-chat');
    }
  }, [queryClient, location.state]);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [visibleTranslations, setVisibleTranslations] = useState<Set<string>>(new Set());
  const [loadingTranslation, setLoadingTranslation] = useState<Record<string, boolean>>({});
  const [playingAudio, setPlayingAudio] = useState<Record<string, boolean>>({});
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
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});
  const voiceButtonRef = useRef<HTMLButtonElement>(null);

  // Load cached translations from localStorage
  useEffect(() => {
    const cached = localStorage.getItem('ai-chat-translations');
    if (cached) {
      try {
        setTranslations(JSON.parse(cached));
      } catch (e) {
        console.error('Failed to parse cached translations:', e);
      }
    }
  }, []);

  // Load cached word definitions from localStorage
  const [wordDefinitions, setWordDefinitions] = useState<Record<string, any>>({});
  
  useEffect(() => {
    const cached = localStorage.getItem('ai-chat-word-definitions');
    if (cached) {
      try {
        setWordDefinitions(JSON.parse(cached));
      } catch (e) {
        console.error('Failed to parse cached word definitions:', e);
      }
    }
  }, []);

  // Get current user
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Prefetch roleplay categories in the background
  useQuery({
    queryKey: ['roleplay-categories', user?.id, undefined],
    queryFn: async () => {
      if (!user?.id) return [];
      return await getAgentsByCategory(user.id);
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Get messages for selected conversation
  const { data: messages } = useQuery({
    queryKey: ['conversation-messages', selectedConversation],
    queryFn: async () => {
      if (!selectedConversation) return [];
      
      const { data, error } = await supabase
        .from('justai_messages')
        .select('id, role, content, created_at, is_voice_message')
        .eq('conversation_id', selectedConversation)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedConversation,
  });

  // Get conversation feedback and agent info (if available)
  const { data: conversationFeedback } = useQuery({
    queryKey: ['conversation-feedback', selectedConversation],
    queryFn: async () => {
      if (!selectedConversation) return null;
      
      const { data, error } = await supabase
        .from('justai_conversations')
        .select('language_feedback, conversation_score, agent_id, justai_agents(image_url, name)')
        .eq('id', selectedConversation)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!selectedConversation,
  });

  // Check subscription status
  const { data: hasAccess } = useQuery({
    queryKey: ['subscription-access'],
    queryFn: checkSubscriptionAccess,
  });

  // Redirect to subscription if no access
  useEffect(() => {
    if (hasAccess !== undefined && !hasAccess) {
      navigate('/subscription/plans');
    }
  }, [hasAccess, navigate]);

  const handleVoiceClick = () => {
    console.log('🎤 Free speech button clicked - using default agent from Supabase secrets');
    
    if (voiceButtonRef.current) {
      const rect = voiceButtonRef.current.getBoundingClientRect();
      setTransitionStart({
        x: rect.left,
        y: rect.top,
      });
      setIsTransitioning(true);
      
      // Navigate after a short delay to let the animation start
      // NOTE: No agentId passed - will use default ELEVENLABS_AGENT_ID from Supabase secrets
      setTimeout(() => {
        navigate('/ai-chat/voice/new', { state: { fromTransition: true } });
      }, 50);
    }
  };

  const handleConversationClick = (conversationId: string) => {
    setSelectedConversation(conversationId);
  };

  const handleTranslate = async (messageId: string, content: string) => {
    // Check if translation is currently visible - toggle it off
    if (visibleTranslations.has(messageId)) {
      setVisibleTranslations((prev) => {
        const newSet = new Set(prev);
        newSet.delete(messageId);
        return newSet;
      });
      return;
    }

    // Check if translation already exists in cache
    if (translations[messageId]) {
      // Show cached translation immediately without loading state
      setVisibleTranslations((prev) => new Set(prev).add(messageId));
      return;
    }

    // Check if translation exists in localStorage but not in state
    const cached = localStorage.getItem('ai-chat-translations');
    if (cached) {
      try {
        const cachedTranslations = JSON.parse(cached);
        if (cachedTranslations[messageId]) {
          // Load into state and show immediately
          setTranslations((prev) => ({ ...prev, [messageId]: cachedTranslations[messageId] }));
          setVisibleTranslations((prev) => new Set(prev).add(messageId));
          return;
        }
      } catch (e) {
        console.error('Failed to parse cached translations:', e);
      }
    }

    // Fetch new translation
    setLoadingTranslation((prev) => ({ ...prev, [messageId]: true }));
    
    try {
      const nativeLanguage = user?.native_language || 'Russian';
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

      if (!response.ok) {
        throw new Error('Translation failed');
      }

      const data = await response.json();
      const translation = data.translation || 'Translation failed';
      
      setTranslations((prev) => {
        const newTranslations = { ...prev, [messageId]: translation };
        // Save to localStorage
        localStorage.setItem('ai-chat-translations', JSON.stringify(newTranslations));
        return newTranslations;
      });
      setVisibleTranslations((prev) => new Set(prev).add(messageId));
    } catch (error) {
      console.error('Translation error:', error);
      setTranslations((prev) => ({ ...prev, [messageId]: 'Translation error occurred' }));
    } finally {
      setLoadingTranslation((prev) => ({ ...prev, [messageId]: false }));
    }
  };

  const handlePlayAudio = async (messageId: string, content: string) => {
    // If audio is playing, stop it
    if (playingAudio[messageId] && audioRefs.current[messageId]) {
      audioRefs.current[messageId].pause();
      audioRefs.current[messageId].currentTime = 0;
      delete audioRefs.current[messageId];
      setPlayingAudio((prev) => ({ ...prev, [messageId]: false }));
      return;
    }

    setPlayingAudio((prev) => ({ ...prev, [messageId]: true }));

    try {
      // Use the agent's default voice settings by calling the backend
      // This ensures consistency with the voice chat experience
      const session = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-text-to-speech`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.data.session?.access_token}`,
          },
          body: JSON.stringify({
            text: content,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to generate audio');
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      // Store audio reference
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
    const cacheKey = `${cleanWord.toLowerCase()}_${user?.native_language?.toLowerCase() || 'ru'}`;

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
            target_language: user?.native_language?.toLowerCase() || 'ru',
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

  return (
    <div className="h-[95vh] bg-white page-enter flex flex-col">
      {/* Voice Button Transition Overlay */}
      <VoiceButtonTransition
        isTransitioning={isTransitioning}
        startPosition={transitionStart}
        onTransitionComplete={() => setIsTransitioning(false)}
      />

      {/* Header */}
      <header className="bg-white px-4 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <Button 
            variant="ghost" 
            size="icon" 
            className="-ml-2"
            onClick={() => setShowSidebar(!showSidebar)}
          >
            {showSidebar ? <ChevronLeft className="w-6 h-6 text-gray-600" /> : <PanelLeft className="w-6 h-6 text-gray-600" />}
          </Button>
          {selectedConversation && conversationFeedback?.language_feedback ? (
            <Button
              onClick={() => setShowFeedbackDrawer(true)}
              variant="ghost"
              size="sm"
              className="rounded-full border border-gray-200 bg-white hover:bg-gray-50 px-2"
            >
              <MessageCircle className="w-4 h-4 text-blue-500" />
              <span className="text-gray-700 font-medium">
                Feedback
              </span>
              {conversationFeedback?.conversation_score && (
                <Badge variant="secondary" className="rounded-full bg-[hsl(var(--brand-blue))] text-white hover:bg-[hsl(var(--brand-blue))]/90">
                  {conversationFeedback.conversation_score}
                </Badge>
              )}
            </Button>
          ) : (
            <Button
              onClick={() => navigate('/ai-chat/voice/new')}
              variant="ghost"
              size="sm"
              className="rounded-full border border-gray-200 bg-white hover:bg-gray-50 px-4"
            >
              <Sparkles className="w-4 h-4 text-blue-500" />
              <span className="text-gray-700 font-medium">
                New chat
              </span>
            </Button>
          )}
          <Avatar className="w-10 h-10 cursor-pointer" onClick={() => navigate('/profile')}>
            <AvatarImage src={user?.profile_photo_url} />
            <AvatarFallback>{user?.display_name?.[0] || 'U'}</AvatarFallback>
          </Avatar>
        </div>
      </header>

      {/* Main Content Container with Sidebar */}
      <div className="flex-1 relative overflow-hidden">
        {/* Sidebar */}
        <AppSidebar
          open={showSidebar}
          onOpenChange={setShowSidebar}
          selectedConversation={selectedConversation}
          onConversationClick={handleConversationClick}
        />

        {/* Main Content Area */}
        <div className="h-full bg-gray-100 rounded-[40px] pt-0 pb-0 m-2 flex flex-col">
          {selectedConversation && messages ? (
            // Conversation View
            <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-6 overflow-hidden">
              {/* Messages - Scrollable */}
              <div className="flex-1 overflow-y-auto space-y-4 pt-6 pb-6">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      'flex gap-3',
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    {message.role === 'assistant' && (
                      <Avatar className="w-8 h-8 flex-shrink-0">
                        <AvatarImage src={(conversationFeedback?.justai_agents as any)?.[0]?.image_url || (conversationFeedback?.justai_agents as any)?.image_url} />
                        <AvatarFallback>🤖</AvatarFallback>
                      </Avatar>
                    )}
                    <div className="flex flex-col gap-2 pt-0">
                      <div
                        className={cn(
                          'px-4 py-3 rounded-2xl transition-all duration-300 ease-in-out',
                          message.role === 'user'
                            ? 'bg-[hsl(var(--brand-blue))] text-white'
                            : 'bg-white text-gray-900 shadow-sm'
                        )}
                      >
                        {message.role === 'assistant' ? (
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">
                            {message.content.split(' ').map((word: string, index: number) => (
                              <span key={index}>
                                <span
                                  onClick={() => handleWordClick(word, message.content)}
                                  className="cursor-pointer hover:bg-blue-100 hover:text-blue-700 rounded transition-colors"
                                >
                                  {word}
                                </span>
                                {index < message.content.split(' ').length - 1 ? ' ' : ''}
                              </span>
                            ))}
                          </p>
                        ) : (
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        )}
                        <div 
                          className={cn(
                            "grid transition-all duration-300 ease-in-out",
                            (visibleTranslations.has(message.id) || loadingTranslation[message.id]) 
                              ? "grid-rows-[1fr] opacity-100" 
                              : "grid-rows-[0fr] opacity-0"
                          )}
                        >
                          <div className="overflow-hidden">
                            <div className="mt-2 pt-2 border-t border-gray-200">
                              {loadingTranslation[message.id] ? (
                                <div className="space-y-2">
                                  <Skeleton className="h-3 w-full" />
                                  <Skeleton className="h-3 w-3/4" />
                                </div>
                              ) : visibleTranslations.has(message.id) && translations[message.id] ? (
                                <p className="text-sm text-gray-600">{translations[message.id]}</p>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        <p
                          className={cn(
                            'text-xs mt-1',
                            message.role === 'user' ? 'text-blue-100' : 'text-gray-400'
                          )}
                        >
                          {new Date(message.created_at).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      
                      {/* Action buttons for AI messages */}
                      {message.role === 'assistant' && (
                          <div className="flex gap-2 ml-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-gray-500 hover:text-gray-700"
                            onClick={() => handlePlayAudio(message.id, message.content)}
                          >
                            {playingAudio[message.id] ? (
                              <CircleStop className="w-4 h-4" />
                            ) : (
                              <Volume2 className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-0 text-gray-500 hover:text-gray-700"
                            onClick={() => handleTranslate(message.id, message.content)}
                            disabled={loadingTranslation[message.id]}
                          >
                            <Languages className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                    {message.role === 'user' && (
                      <Avatar className="w-8 h-8 flex-shrink-0">
                        <AvatarImage src={user?.profile_photo_url} />
                        <AvatarFallback>{user?.display_name?.[0] || 'U'}</AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            // Default Home View
            <>
              <div className="flex justify-center pt-8">
                <img src={Logo} alt="JustTalk AI" className="h-8" />
              </div>
              <main className="flex-1 flex flex-col justify-center max-w-2xl mx-auto px-6 w-full">
                {/* Greeting */}
                <div className="text-center mb-12">
                  {userLoading ? (
                    <div className="text-gray-400">Loading...</div>
                  ) : (
                    <>
                      <h1 className="text-4xl font-semibold text-gray-900">
                        Good to see you,
                      </h1>
                      <h2 className="text-4xl font-semibold text-gray-400 mb-6">
                        {user?.display_name || 'Student'}.
                      </h2>
                      <p className="text-gray-500 text-base">
                        JustTalk AI your personal AI Teacher.
                      </p>
                    </>
                  )}
                </div>

                {/* Navigation Cards */}
                <div className="mb-6">
                  <div className="flex flex-wrap gap-3 justify-center">
                    <Card
                      className="px-3 py-1 cursor-pointer hover:shadow-md hover:border-gray-300 transition-all bg-white border border-gray-200 shadow-sm"
                      onClick={() => navigate('/ai-chat/conversation/new')}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl">⭐️</span>
                        <p className="text-base font-normal text-gray-700">JustTalk</p>
                      </div>
                    </Card>
                    <Card
                      className="px-3 py-1 cursor-pointer hover:shadow-md hover:border-gray-300 transition-all bg-white border border-gray-200 shadow-sm"
                      onClick={() => navigate('/role-plays')}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl">💭</span>
                        <p className="text-base font-normal text-gray-700">Role-plays</p>
                      </div>
                    </Card>
                    <Card
                      className="px-3 py-1 cursor-pointer hover:shadow-md hover:border-gray-300 transition-all bg-white border border-gray-200 shadow-sm"
                      onClick={() => navigate('/dictionary')}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl">📖</span>
                        <p className="text-base font-normal text-gray-700">Dictionary</p>
                      </div>
                    </Card>
                    <Card
                      className="px-3 py-1 cursor-pointer hover:shadow-md hover:border-gray-300 transition-all bg-white border border-gray-200 shadow-sm"
                      onClick={() => navigate('/profile')}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl">👤</span>
                        <p className="text-base font-normal text-gray-700">Profile</p>
                      </div>
                    </Card>
                  </div>
                  
                </div>
              </main>
            </>
          )}

          {/* Bottom Voice Button - Centered (only show when no conversation selected) */}
          {!selectedConversation && (
            <div className="px-5 pb-6">
              <div className="flex justify-center">
                <button
                  onClick={handleVoiceClick}
                  ref={voiceButtonRef}
                  className="w-16 h-16 flex items-center justify-center bg-[hsl(var(--brand-blue))] text-white rounded-full hover:bg-[hsl(var(--brand-blue))]/90 transition-all hover:scale-105 active:scale-95 shadow-lg"
                >
                  <img src={LogoBars} alt="Voice" className="w-8 h-8 brightness-0 invert" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Word Definition Drawer */}
      <Drawer open={showWordDrawer} onOpenChange={setShowWordDrawer}>
        <DrawerContent className="px-6 pb-6" aria-describedby="word-definition-description">
          <div className="sr-only" id="word-definition-description">
            Word definition and details
          </div>
          {loadingWord ? (
            <div className="py-8 space-y-4">
              <Skeleton className="h-10 w-48" />
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : selectedWord ? (
            <>
              {/* Word Header */}
              <div className="pt-6 pb-4 border-b">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-3xl font-bold capitalize">{selectedWord.word}</h2>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full bg-[hsl(var(--brand-blue))]/10 hover:bg-[hsl(var(--brand-blue))]/20 text-[hsl(var(--brand-blue))]"
                        onClick={() => {
                          const utterance = new SpeechSynthesisUtterance(selectedWord.word);
                          utterance.lang = 'en-US';
                          window.speechSynthesis.speak(utterance);
                        }}
                      >
                        <Volume2 className="w-5 h-5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full bg-[hsl(var(--brand-blue))]/10 hover:bg-[hsl(var(--brand-blue))]/20 text-[hsl(var(--brand-blue))]"
                      >
                        <Bookmark className="w-5 h-5" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-gray-200 text-gray-700">
                        {selectedWord.pos}
                      </Badge>
                      <p className="text-gray-500 text-sm">{selectedWord.lemma}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Word Content */}
              <div className="py-4 space-y-6">
                {/* Definitions */}
                {selectedWord.definitions && selectedWord.definitions.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-500 mb-3">Definitions</h3>
                    {selectedWord.definitions.map((def, index) => (
                      <div key={index} className="mb-3 last:mb-0">
                        <p className="text-base mb-1">{def.definition}</p>
                        {def.example && (
                          <p className="text-sm text-gray-600 italic">"{ def.example}"</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Synonyms */}
                {selectedWord.synonyms && Object.keys(selectedWord.synonyms).length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-500 mb-2">Synonyms</h3>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(selectedWord.synonyms)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 5)
                        .map(([syn]) => (
                          <Badge key={syn} variant="outline" className="text-sm">
                            {syn}
                          </Badge>
                        ))}
                    </div>
                  </div>
                )}

                {/* Translations */}
                {selectedWord.translations && Object.keys(selectedWord.translations).length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-500 mb-2">
                      Translations ({user?.native_language || 'Russian'})
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(selectedWord.translations)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 5)
                        .map(([trans]) => (
                          <Badge key={trans} variant="outline" className="text-sm">
                            {trans}
                          </Badge>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </DrawerContent>
      </Drawer>

      {/* Feedback Drawer */}
      <Drawer open={showFeedbackDrawer} onOpenChange={setShowFeedbackDrawer}>
        <DrawerContent className="px-6 pb-6" aria-describedby="feedback-description">
          <div className="sr-only" id="feedback-description">
            Conversation feedback and analysis
          </div>
          {conversationFeedback?.language_feedback ? (
            <>
              {/* Feedback Header */}
              <div className="pt-6 pb-4 border-b">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-100 rounded-full">
                      <MessageCircle className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">Session Feedback</h2>
                      {conversationFeedback?.conversation_score && (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-sm text-gray-600">Overall Score:</span>
                          <Badge variant="default" className="text-base bg-[hsl(var(--brand-blue))] text-white hover:bg-[hsl(var(--brand-blue))]/90">
                            {conversationFeedback.conversation_score}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Feedback Content */}
              <div className="py-4 space-y-6 max-h-[60vh] overflow-y-auto">
                {/* Diagnosis */}
                {conversationFeedback.language_feedback?.diagnosis && (
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <h3 className="text-base font-semibold text-blue-900 mb-2">Diagnosis</h3>
                        <p className="text-sm text-blue-800 leading-relaxed">
                          {conversationFeedback.language_feedback.diagnosis}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Example - Original vs Better */}
                {conversationFeedback.language_feedback?.example && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Target className="w-5 h-5 text-gray-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <h3 className="text-base font-semibold text-gray-900 mb-3">Example</h3>
                        
                        {/* Original */}
                        {conversationFeedback.language_feedback.example.original && (
                          <div className="mb-3">
                            <p className="text-xs font-medium text-gray-500 mb-1">What you said:</p>
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                              <p className="text-sm text-red-900 italic">
                                "{conversationFeedback.language_feedback.example.original}"
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Better */}
                        {conversationFeedback.language_feedback.example.better && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 mb-1">Better way to say it:</p>
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                              <p className="text-sm text-green-900 font-medium">
                                "{conversationFeedback.language_feedback.example.better}"
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Improvement Instruction */}
                {conversationFeedback.language_feedback?.improvement_instruction && (
                  <div className="bg-amber-50 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <TrendingUp className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <h3 className="text-base font-semibold text-amber-900 mb-2">How to Improve</h3>
                        <p className="text-sm text-amber-800 leading-relaxed">
                          {conversationFeedback.language_feedback.improvement_instruction}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Additional fields for other feedback formats */}
                {/* Strengths */}
                {conversationFeedback.language_feedback?.strengths && (
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Star className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <h3 className="text-base font-semibold text-green-900 mb-2">Strengths</h3>
                        <ul className="space-y-2">
                          {conversationFeedback.language_feedback.strengths.map((strength: string, index: number) => (
                            <li key={index} className="text-sm text-green-800 flex items-start gap-2">
                              <span className="text-green-600">•</span>
                              <span>{strength}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* Grammar Focus */}
                {conversationFeedback.language_feedback?.grammar_focus && (
                  <div className="bg-purple-50 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Bookmark className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <h3 className="text-base font-semibold text-purple-900 mb-2">Grammar Focus</h3>
                        <ul className="space-y-2">
                          {conversationFeedback.language_feedback.grammar_focus.map((item: string, index: number) => (
                            <li key={index} className="text-sm text-purple-800 flex items-start gap-2">
                              <span className="text-purple-600">•</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="py-12 text-center">
              <MessageCircle className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500">No feedback available for this conversation</p>
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
