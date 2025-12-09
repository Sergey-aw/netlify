import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Menu,
  Sparkles,
  MessageSquare,
  MessageCircle,
  BookOpen,
  User,
  Settings2,
  History,
  ChevronLeft,
  ChevronRight,
  Volume2,
  CircleStop,
  Languages,
  Bookmark,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { VoiceButtonTransition } from '@/components/VoiceButtonTransition';
import { supabase } from '@/lib/supabase';
import { checkSubscriptionAccess } from '@/lib/justai-api';
import LogoBars from '@/assets/logo_bars.svg';
import Logo from '@/assets/logo.svg';
import { cn } from '@/lib/utils';
import OpenAI from 'openai';
import { ELEVENLABS_AGENTS } from '@/config/elevenlabs-agents';

export default function AIChatHome() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionStart, setTransitionStart] = useState<{ x: number; y: number } | undefined>();
  const [showSidebar, setShowSidebar] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);

  // Handle URL query parameter for auto-selecting conversation
  useEffect(() => {
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
  }, [queryClient]);
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

  // Initialize OpenAI client
  const openai = new OpenAI({
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    dangerouslyAllowBrowser: true,
  });

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

  // Get previous conversations
  const { data: conversations } = useQuery({
    queryKey: ['conversations', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('justai_conversations')
        .select('id, title, scenario, created_at, last_message_at, is_voice_session')
        .eq('student_id', user.id)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
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

  const handleAgentClick = (agentId: string, agentElevenLabsId: string, agentName: string) => {
    console.log('🎯 Agent card clicked:', {
      agentId,
      agentElevenLabsId,
      agentName,
    });
    
    if (voiceButtonRef.current) {
      const rect = voiceButtonRef.current.getBoundingClientRect();
      setTransitionStart({
        x: rect.left,
        y: rect.top,
      });
      setIsTransitioning(true);
      
      // Navigate with agent information
      setTimeout(() => {
        console.log('🚀 Navigating to voice chat with agent:', agentElevenLabsId);
        navigate('/ai-chat/voice/new', { 
          state: { 
            fromTransition: true,
            agentId: agentElevenLabsId, // This is the ElevenLabs agent ID
            agentName: agentName,
            scenario: agentId,
          } 
        });
      }, 50);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const handleConversationClick = (conversationId: string) => {
    setSelectedConversation(conversationId);
    setShowSidebar(false);
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
      
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a professional translator. Translate the following English text to ${nativeLanguage}. Only return the translation, no explanations.`,
          },
          {
            role: 'user',
            content: content,
          },
        ],
        temperature: 0.3,
      });

      const translation = completion.choices[0]?.message?.content || 'Translation failed';
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
            {showSidebar ? <ChevronLeft className="w-6 h-6 text-gray-600" /> : <Menu className="w-6 h-6 text-gray-600" />}
          </Button>
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
          <Avatar className="w-10 h-10 cursor-pointer" onClick={() => navigate('/profile')}>
            <AvatarImage src={user?.profile_photo_url} />
            <AvatarFallback>{user?.display_name?.[0] || 'U'}</AvatarFallback>
          </Avatar>
        </div>
      </header>

      {/* Main Content Container with Sidebar */}
      <div className="flex-1 relative overflow-hidden">
        {/* Sidebar - Conversations List (Overlay) */}
        <div
          className={cn(
            'absolute top-0 left-0 h-full z-20 bg-white border-r overflow-y-auto shadow-lg transition-transform duration-300',
            'w-80',
            showSidebar ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Conversations</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSidebar(false)}
                className="rounded-full"
              >
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </Button>
            </div>
            
            <div className="space-y-1">
              {conversations && conversations.length > 0 ? (
                conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={cn(
                      'p-3 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors',
                      selectedConversation === conv.id && 'bg-blue-50'
                    )}
                    onClick={() => handleConversationClick(conv.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-2xl flex-shrink-0">
                        {conv.is_voice_session ? '🎤' : '💬'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm text-gray-900 truncate">
                          {conv.title || 'Untitled Conversation'}
                        </h3>
                        <p className="text-xs text-gray-500">
                          {formatTime(conv.last_message_at || conv.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <History className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No conversations yet</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="h-full bg-gray-100 rounded-[40px] pt-0 pb-6 m-2 flex flex-col overflow-hidden">
          {selectedConversation && messages ? (
            // Conversation View
            <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-6 overflow-hidden">
              {/* Messages - Scrollable */}
              <div className="flex-1 overflow-y-auto space-y-4 pt-0 pb-4">
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
                        <AvatarFallback>🤖</AvatarFallback>
                      </Avatar>
                    )}
                    <div className="flex flex-col gap-2">
                      <div
                        className={cn(
                          'px-4 py-3 rounded-2xl transition-all duration-300 ease-in-out',
                          message.role === 'user'
                            ? 'bg-blue-600 text-white'
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

                {/* Scenario Cards */}
                <div className="mb-6">
                  <div className="flex flex-wrap gap-3 justify-center">
                    {ELEVENLABS_AGENTS.map((agent) => (
                      <Card
                        key={agent.id}
                        className="px-3 py-1 cursor-pointer hover:shadow-md hover:border-gray-300 transition-all bg-white border border-gray-200 shadow-sm"
                        onClick={() => handleAgentClick(agent.id, agent.agentId, agent.name)}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-xl">{agent.icon}</span>
                          <p className="text-base font-normal text-gray-700">{agent.name}</p>
                        </div>
                      </Card>
                    ))}
                  </div>
                  <p className="text-center text-sm text-gray-500 mt-3">
                    Choose the role play to start voice conversation
                  </p>
                </div>
              </main>
            </>
          )}

          {/* Bottom Input Bar - Inside Gray Container */}
          <div className="px-5 pb-0">
            <div className="max-w-2xl mx-auto">
              <Card className="shadow-lg border-gray-200 rounded-3xl">
              <div className="flex flex-col gap-0 px-5 py-4">
                <textarea
                  placeholder="How can I help you today?"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onFocus={() => navigate('/ai-chat/conversation/new')}
                  rows={2}
                  className="w-full bg-transparent outline-none text-gray-900 placeholder:text-gray-400 text-base resize-none"
                />
                
                <div className="flex items-center justify-between">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                        <Settings2 className="w-6 h-6" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent 
                      className="w-40 rounded-2xl" 
                      align="start" 
                      side="top"
                      sideOffset={12}
                    >
                      <DropdownMenuItem
                        onClick={() => navigate('/ai-chat')}
                        className="flex items-center gap-3 px-3 py-1.5 cursor-pointer"
                      >
                        <MessageSquare className="w-5 h-5 text-gray-600" />
                        <span className="text-sm font-medium text-gray-700">Chat</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => navigate('/role-plays')}
                        className="flex items-center gap-3 px-3 py-1.5 cursor-pointer"
                      >
                        <MessageCircle className="w-5 h-5 text-gray-600" />
                        <span className="text-sm font-medium text-gray-700">Role-plays</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => navigate('/dictionary')}
                        className="flex items-center gap-3 px-3 py-1.5 cursor-pointer"
                      >
                        <BookOpen className="w-5 h-5 text-gray-600" />
                        <span className="text-sm font-medium text-gray-700">Dictionary</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => navigate('/profile')}
                        className="flex items-center gap-3 px-3 py-1.5 cursor-pointer"
                      >
                        <User className="w-5 h-5 text-gray-600" />
                        <span className="text-sm font-medium text-gray-700">Profile</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <button
                    onClick={handleVoiceClick}
                    ref={voiceButtonRef}
                    className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-all hover:scale-105 active:scale-95"
                  >
                    <img src={LogoBars} alt="Voice" className="w-4 h-4 brightness-0 invert" />
                  </button>
                </div>
              </div>
            </Card>
          </div>
          </div>
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
                        className="rounded-full bg-purple-100 hover:bg-purple-200 text-purple-700"
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
                        className="rounded-full bg-purple-100 hover:bg-purple-200 text-purple-700"
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
    </div>
  );
}
