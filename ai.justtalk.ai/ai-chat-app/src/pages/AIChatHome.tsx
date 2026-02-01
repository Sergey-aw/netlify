import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import {
  PanelLeft,
  ChevronLeft,
  Volume2,
  CircleStop,
  Languages,
  MessageCircle,
  Bookmark,
  Star,
  Check,
  Play,
  Coffee,
  Briefcase,
  GraduationCap,
  Heart,
  Plane,
  ShoppingBag,
  Users,
  BookOpen,
  Home,
  Utensils,
} from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { AppSidebar } from '@/components/AppSidebar';
import { VoiceButtonTransition } from '@/components/VoiceButtonTransition';
import { FeatureCardGallery } from '@/components/FeatureCardGallery';
import { FeedbackDrawer } from '@/components/FeedbackDrawer';
import { supabase } from '@/lib/supabase';
import { checkSubscriptionAccess } from '@/lib/justai-api';
import { getAgentsByCategory } from '@/services/agents.service';
import { toast } from 'sonner';
// import LogoBars from '@/assets/logo_bars.svg';
import Logo from '@/assets/logo.svg';
import { cn } from '@/lib/utils';

// Helper function to convert image URL to use _avatar suffix
const getAvatarUrl = (imageUrl: string | null | undefined): string | undefined => {
  if (!imageUrl) return undefined;
  
  // Split the path and filename
  const lastDotIndex = imageUrl.lastIndexOf('.');
  const lastSlashIndex = imageUrl.lastIndexOf('/');
  
  if (lastDotIndex > lastSlashIndex && lastDotIndex !== -1) {
    const basePath = imageUrl.substring(0, lastDotIndex);
    const extension = imageUrl.substring(lastDotIndex);
    
    // Check if it's a dating_ prefixed image (male characters have _avatar versions)
    const filename = basePath.substring(lastSlashIndex + 1);
    if (filename.startsWith('dating_')) {
      return `${basePath}_avatar${extension}`;
    }
    
    // For other images (female characters: Alina, Clara, Imani, Lucia, Naomi)
    // they don't have _avatar versions, so just return the original
    return imageUrl;
  }
  
  return imageUrl;
};

// Category icon and color mapping
const getCategoryStyle = (category: string | undefined) => {
  const categoryMap: Record<string, { icon: any; bgColor: string; textColor: string; borderColor: string }> = {
    'Daily Life': { icon: Coffee, bgColor: 'bg-blue-50', textColor: 'text-blue-700', borderColor: 'border-blue-200' },
    'Education': { icon: GraduationCap, bgColor: 'bg-purple-50', textColor: 'text-purple-700', borderColor: 'border-purple-200' },
    'Business': { icon: Briefcase, bgColor: 'bg-indigo-50', textColor: 'text-indigo-700', borderColor: 'border-indigo-200' },
    'Dating': { icon: Heart, bgColor: 'bg-pink-50', textColor: 'text-pink-700', borderColor: 'border-pink-200' },
    'Travel': { icon: Plane, bgColor: 'bg-sky-50', textColor: 'text-sky-700', borderColor: 'border-sky-200' },
    'Shopping': { icon: ShoppingBag, bgColor: 'bg-emerald-50', textColor: 'text-emerald-700', borderColor: 'border-emerald-200' },
    'Social': { icon: Users, bgColor: 'bg-amber-50', textColor: 'text-amber-700', borderColor: 'border-amber-200' },
    'Interview': { icon: Briefcase, bgColor: 'bg-slate-50', textColor: 'text-slate-700', borderColor: 'border-slate-200' },
    'Restaurant': { icon: Utensils, bgColor: 'bg-orange-50', textColor: 'text-orange-700', borderColor: 'border-orange-200' },
    'Learning': { icon: BookOpen, bgColor: 'bg-violet-50', textColor: 'text-violet-700', borderColor: 'border-violet-200' },
    'Home': { icon: Home, bgColor: 'bg-teal-50', textColor: 'text-teal-700', borderColor: 'border-teal-200' },
  };
  
  return categoryMap[category || ''] || { icon: BookOpen, bgColor: 'bg-gray-50', textColor: 'text-gray-700', borderColor: 'border-gray-200' };
};

export default function AIChatHome() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionStart] = useState<{ x: number; y: number } | undefined>();
  const [showSidebar, setShowSidebar] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [showFeedbackDrawer, setShowFeedbackDrawer] = useState(false);

  // Add swipe gesture to open sidebar
  useSwipeGesture({
    onSwipeRight: () => {
      if (!showSidebar) {
        setShowSidebar(true);
      }
    },
    minSwipeDistance: 50,
    maxVerticalDistance: 100,
    ignoreSelectors: ['[data-swipe-ignore="true"]'],
  });

  // Handle URL query parameter or location state for auto-selecting conversation
  useEffect(() => {
    // Check if we should clear selection (from Home navigation)
    if (location.state?.clearSelection) {
      setSelectedConversation(null);
      // Clear the state
      window.history.replaceState({}, '', '/ai-chat');
      return;
    }
    
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
    } else if (!conversationId && !stateConversationId) {
      // Clear selection when navigating to clean home
      setSelectedConversation(null);
    }
  }, [queryClient, location.state, location.search]);
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
  // const voiceButtonRef = useRef<HTMLButtonElement>(null);

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
        .select('language_feedback, conversation_score, session_memory, agent_id, justai_agents(image_url, name)')
        .eq('id', selectedConversation)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!selectedConversation,
  });

  // Get agent details and related steps/agents for the bottom bar
  const { data: agentSteps } = useQuery({
    queryKey: ['agent-steps', conversationFeedback?.agent_id, user?.id],
    queryFn: async () => {
      if (!conversationFeedback?.agent_id || !user?.id) return null;
      
      const agentId = conversationFeedback.agent_id;
      
      // First, get the current agent details
      const { data: currentAgent, error: agentError } = await supabase
        .from('justai_agents')
        .select('*')
        .eq('id', agentId)
        .single();
      
      if (agentError) throw agentError;
      
      let relatedAgents = [];
      
      // If this is a multi-step agent or a step within a multi-step series
      if (currentAgent.is_multi_step || currentAgent.parent_agent_id) {
        const parentId = currentAgent.parent_agent_id || agentId;
        
        // Get all steps in this series with progress
        const { data: steps, error: stepsError } = await supabase
          .from('justai_agents')
          .select(`
            *,
            progress:justai_student_progress(
              status,
              average_session_score,
              best_session_score
            )
          `)
          .eq('parent_agent_id', parentId)
          .eq('progress.student_id', user.id)
          .order('step_number', { ascending: true });
        
        if (!stepsError && steps) {
          relatedAgents = steps;
        }
      } else {
        // Single-step agent: get other agents from the same category
        const { data: categoryAgents, error: categoryError } = await supabase
          .from('justai_agents')
          .select(`
            *,
            progress:justai_student_progress(
              status,
              average_session_score,
              best_session_score
            )
          `)
          .eq('category', currentAgent.category)
          .eq('progress.student_id', user.id)
          .is('parent_agent_id', null)
          .order('display_order', { ascending: true })
          .limit(10);
        
        if (!categoryError && categoryAgents) {
          relatedAgents = categoryAgents;
        }
      }
      
      return {
        currentAgent,
        relatedAgents,
        isMultiStep: currentAgent.is_multi_step || !!currentAgent.parent_agent_id,
      };
    },
    enabled: !!conversationFeedback?.agent_id && !!user?.id,
  });

  // Get recent agent interactions for home screen
  const { data: recentAgents, isLoading: agentsLoading } = useQuery({
    queryKey: ['recent-agents', user?.id],
    queryFn: async () => {
      if (!user?.id) return { personal: [], multiStep: [], singleStep: [] };
      
      // Get recent conversations with agent details
      const { data: conversations, error } = await supabase
        .from('justai_conversations')
        .select(`
          id,
          agent_id,
          created_at,
          conversation_score,
          justai_agents (
            id,
            name,
            description,
            image_url,
            icon,
            elevenlabs_agent_id,
            category,
            parent_agent_id,
            step_number,
            teacher_id,
            student_id
          )
        `)
        .eq('student_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) {
        console.error('Error fetching conversations:', error);
        return { personal: [], multiStep: [], singleStep: [] };
      }
      
      if (!conversations || conversations.length === 0) {
        console.log('No conversations found for user');
        return { personal: [], multiStep: [], singleStep: [] };
      }
      
      console.log('Found conversations:', conversations.length);
      
      // Group by agent_id and get most recent for each
      const agentMap = new Map();
      conversations?.forEach((conv: any) => {
        const agent = conv.justai_agents;
        if (!agent || agentMap.has(agent.id)) return;
        
        agentMap.set(agent.id, {
          ...agent,
          lastConversationDate: conv.created_at,
          lastConversationId: conv.id,
          bestScore: conv.conversation_score,
        });
      });
      
      const uniqueAgents = Array.from(agentMap.values());
      
      // Get progress for all agents
      const { data: progressData } = await supabase
        .from('justai_student_progress')
        .select('*')
        .eq('student_id', user.id)
        .in('agent_id', uniqueAgents.map((a: any) => a.id));
      
      // Attach progress to agents
      const agentsWithProgress = uniqueAgents.map((agent: any) => ({
        ...agent,
        progress: progressData?.find((p: any) => p.agent_id === agent.id) || null,
      }));
      
      // Categorize agents
      const personal: any[] = [];
      const multiStepMap = new Map();
      const singleStep: any[] = [];
      
      for (const agent of agentsWithProgress) {
        // Personal agents have teacher_id or student_id set
        const isPersonal = agent.teacher_id || (agent.student_id && agent.student_id.length > 0);
        
        if (isPersonal) {
          personal.push(agent);
        } else if (agent.parent_agent_id) {
          // This is a step in a multi-step agent - group by parent
          if (!multiStepMap.has(agent.parent_agent_id)) {
            multiStepMap.set(agent.parent_agent_id, []);
          }
          multiStepMap.get(agent.parent_agent_id).push(agent);
        } else {
          // Check if this agent has child steps
          const hasSteps = agentsWithProgress.some((a: any) => a.parent_agent_id === agent.id);
          if (hasSteps) {
            multiStepMap.set(agent.id, [agent]);
          } else {
            singleStep.push(agent);
          }
        }
      }
      
      // Build complete multi-step agent data with all steps
      const multiStep: any[] = [];
      for (const [parentId] of multiStepMap) {
        const { data: allSteps } = await supabase
          .from('justai_agents')
          .select('*')
          .or(`id.eq.${parentId},parent_agent_id.eq.${parentId}`)
          .order('step_number', { ascending: true });
        
        if (allSteps && allSteps.length > 0) {
          const parentAgent = allSteps.find((s: any) => !s.parent_agent_id) || allSteps[0];
          const steps = allSteps.filter((s: any) => s.parent_agent_id === parentId);
          
          // Get progress for all steps
          const { data: stepsProgress } = await supabase
            .from('justai_student_progress')
            .select('*')
            .eq('student_id', user.id)
            .in('agent_id', steps.map((s: any) => s.id));
          
          const stepsWithProgress = steps.map((step: any) => ({
            ...step,
            progress: stepsProgress?.find((p: any) => p.agent_id === step.id) || null,
          }));
          
          // Find current step (first incomplete or last completed)
          let currentStepIndex = stepsWithProgress.findIndex(
            (s: any) => s.progress?.status !== 'completed'
          );
          if (currentStepIndex === -1) currentStepIndex = stepsWithProgress.length - 1;
          
          multiStep.push({
            ...parentAgent,
            steps: stepsWithProgress,
            currentStepIndex,
            lastConversationDate: agentsWithProgress.find((a: any) => a.id === parentId)?.lastConversationDate,
          });
        }
      }
      
      return {
        personal: personal.sort((a: any, b: any) => 
          new Date(b.lastConversationDate).getTime() - new Date(a.lastConversationDate).getTime()
        ).slice(0, 6),
        multiStep: multiStep.sort((a: any, b: any) => 
          new Date(b.lastConversationDate || 0).getTime() - new Date(a.lastConversationDate || 0).getTime()
        ).slice(0, 4),
        singleStep: singleStep.sort((a: any, b: any) => 
          new Date(b.lastConversationDate).getTime() - new Date(a.lastConversationDate).getTime()
        ).slice(0, 6),
      };
      
      const result = {
        personal: personal.sort((a: any, b: any) => 
          new Date(b.lastConversationDate).getTime() - new Date(a.lastConversationDate).getTime()
        ).slice(0, 6),
        multiStep: multiStep.sort((a: any, b: any) => 
          new Date(b.lastConversationDate || 0).getTime() - new Date(a.lastConversationDate || 0).getTime()
        ).slice(0, 4),
        singleStep: singleStep.sort((a: any, b: any) => 
          new Date(b.lastConversationDate).getTime() - new Date(a.lastConversationDate).getTime()
        ).slice(0, 6),
      };
      
      console.log('Recent agents result:', {
        personal: result.personal.length,
        multiStep: result.multiStep.length,
        singleStep: result.singleStep.length,
      });
      
      return result;
    },
    enabled: !!user?.id,
    placeholderData: (previousData) => previousData, // Keep previous data while refetching
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

  const handleRetryScenario = async () => {
    if (!conversationFeedback?.agent_id) {
      toast.error('Agent information not available');
      return;
    }
    
    try {
      // Fetch agent details including elevenlabs_agent_id
      const { data: agent, error } = await supabase
        .from('justai_agents')
        .select('id, name, elevenlabs_agent_id, description')
        .eq('id', conversationFeedback.agent_id)
        .single();

      if (error) throw error;
      if (!agent) {
        toast.error('Agent not found');
        return;
      }

      // Close feedback drawer
      setShowFeedbackDrawer(false);

      // Navigate to voice chat with agent data
      navigate('/ai-chat/voice/new', {
        state: {
          fromTransition: true,
          agentId: agent.elevenlabs_agent_id,
          agentName: agent.name,
          scenario: agent.description || 'Conversation scenario',
          agentDatabaseId: agent.id,
          isRetryAttempt: true, // Mark as retry to prevent session_memory reuse
        },
      });
    } catch (error) {
      console.error('Error retrying scenario:', error);
      toast.error('Failed to restart scenario. Please try again.');
    }
  };

  const handleAgentCardClick = async (agent: any) => {
    try {
      // For multi-step agents, navigate to the current step
      let targetAgent = agent;
      if (agent.steps && agent.currentStepIndex !== undefined) {
        targetAgent = agent.steps[agent.currentStepIndex];
      }
      
      navigate('/ai-chat/voice/new', {
        state: {
          fromTransition: true,
          agentId: targetAgent.elevenlabs_agent_id,
          agentName: targetAgent.name,
          scenario: targetAgent.description || '',
          agentDatabaseId: targetAgent.id,
        },
      });
    } catch (error) {
      console.error('Error starting conversation:', error);
      toast.error('Failed to start conversation. Please try again.');
    }
  };

  const formatLastInteraction = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 85) return 'bg-green-100 text-green-800 border-green-300';
    if (score >= 70) return 'bg-blue-100 text-blue-800 border-blue-300';
    if (score >= 50) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    return 'bg-red-100 text-red-800 border-red-300';
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
        <div className={cn(
          "flex items-center max-w-7xl mx-auto",
          selectedConversation ? "justify-between" : ""
        )}>
          <Button 
            variant="ghost" 
            size="icon" 
            className="-ml-2 flex-shrink-0"
            onClick={() => setShowSidebar(!showSidebar)}
          >
            {showSidebar ? <ChevronLeft className="w-6 h-6 text-gray-600" /> : <PanelLeft className="w-6 h-6 text-gray-600" />}
          </Button>
          
          {!selectedConversation && (
            <div className="flex-1 flex justify-center">
              <img src={Logo} alt="JustTalk AI" className="h-7" />
            </div>
          )}

          {selectedConversation && conversationFeedback?.language_feedback && (
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
          )}

          <Avatar className={cn(
            "w-10 h-10 cursor-pointer flex-shrink-0",
            !selectedConversation && "ml-auto"
          )} onClick={() => navigate('/profile')}>
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
        <div className="h-full bg-gray-100 rounded-[40px] pt-0 pb-0 m-2 flex flex-col relative">
          {selectedConversation && messages ? (
            // Conversation View
            <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-6 overflow-hidden">
              {/* Messages - Scrollable */}
              <div className="flex-1 overflow-y-auto space-y-4 pt-6 pb-24 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
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
                        <AvatarImage src={getAvatarUrl((conversationFeedback?.justai_agents as any)?.[0]?.image_url || (conversationFeedback?.justai_agents as any)?.image_url)} />
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
            // Default Home View - Show recent agents if available
            <>
              {/* <div className="flex justify-center pt-8">
                <img src={Logo} alt="JustTalk AI" className="h-8" />
              </div> */}
              <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-4 overflow-y-auto">
                {agentsLoading || userLoading ? (
                  // Loading skeleton
                  <div className="py-8 space-y-6">
                    <div className="space-y-3">
                      <Skeleton className="h-6 w-48 mx-auto" />
                      <Skeleton className="h-8 w-64 mx-auto" />
                    </div>
                    <div className="space-y-3">
                      <Skeleton className="h-40 w-full rounded-3xl" />
                      <Skeleton className="h-40 w-full rounded-3xl" />
                      <Skeleton className="h-40 w-full rounded-3xl" />
                    </div>
                  </div>
                ) : recentAgents && (recentAgents.personal?.length > 0 || recentAgents.multiStep?.length > 0 || recentAgents.singleStep?.length > 0) ? (
                  // Recent Agents View - Categorized
                  <div className="py-8 space-y-4">
                    {/* Welcome Header */}
                    {/* <div className="text-center">
                   
                      <p className="text-gray-500 text-sm">
                        Continue your learning journey
                      </p>
                    </div> */}

                    {/* Personal Agents */}
                    {recentAgents.personal && recentAgents.personal.length > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                          <h2 className="text-lg font-semibold text-gray-900">Personal Scenarios</h2>
                        </div>
                        <div className="space-y-3">
                          {recentAgents.personal.map((agent: any) => (
                            <div
                              key={agent.id}
                              onClick={() => handleAgentCardClick(agent)}
                              className="bg-white border border-gray-200 rounded-3xl p-4 hover:shadow-lg transition-all duration-200 cursor-pointer group"
                            >
                              <div className="flex gap-4">
                                <div className="relative flex-shrink-0">
                                  <Avatar className="w-16 h-16">
                                    <AvatarImage src={getAvatarUrl(agent.image_url)} />
                                    <AvatarFallback>{agent.icon || agent.name?.[0] || '🤖'}</AvatarFallback>
                                  </Avatar>
                                  {agent.bestScore && (
                                    <div className={cn(
                                      "absolute -bottom-1 -right-1 text-xs font-semibold px-2 py-0.5 rounded-full border",
                                      getScoreBadgeColor(agent.bestScore)
                                    )}>
                                      ★{agent.bestScore}
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2 mb-0">
                                    <h3 className="font-medium text-gray-900 group-hover:text-[hsl(var(--brand-blue))] transition-colors">
                                      {agent.name}
                                    </h3>
                                    <div className="flex flex-col items-end gap-1">
                                      <span className="text-xs text-gray-400">
                                        {formatLastInteraction(agent.lastConversationDate)}
                                      </span>
                                    </div>
                                  </div>
                                  <p className="text-sm text-gray-500 line-clamp-2">
                                    {agent.description}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Multi-Step Agents */}
                    {recentAgents.multiStep && recentAgents.multiStep.length > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <Play className="w-5 h-5 text-blue-500" />
                          <h2 className="text-lg font-semibold text-gray-900">Learning Paths</h2>
                        </div>
                        <div className="space-y-4">
                          {recentAgents.multiStep.map((agent: any) => {
                            const currentStep = agent.steps[agent.currentStepIndex];
                            const completedSteps = agent.steps.filter((s: any) => s.progress?.status === 'completed').length;
                            
                            return (
                              <div
                                key={agent.id}
                                onClick={() => handleAgentCardClick(agent)}
                                className="bg-white border border-gray-200 rounded-3xl p-4 hover:shadow-lg transition-all duration-200 cursor-pointer group"
                              >
                                <div className="space-y-4">
                                  {/* Header with current step info */}
                                  <div className="flex gap-4">
                                    <div className="relative flex-shrink-0">
                                      <Avatar className="w-16 h-16">
                                        <AvatarImage src={getAvatarUrl(currentStep.image_url)} />
                                        <AvatarFallback><Play className="w-6 h-6 text-blue-500" /></AvatarFallback>
                                      </Avatar>
                                   
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="text-xs text-gray-500 mb-1">{agent.name}</div>
                                      <h3 className="font-medium text-gray-900 group-hover:text-[hsl(var(--brand-blue))] transition-colors mb-0">
                                        {currentStep.name}
                                      </h3>
                                      <p className="text-sm text-gray-500 line-clamp-2">
                                        {currentStep.description}
                                      </p>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                      <span className="text-xs text-gray-400">
                                        {formatLastInteraction(agent.lastConversationDate)}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Progress Bar */}
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs">
                                      <span className="text-gray-600">Progress</span>
                                      <span className="font-medium text-gray-900">
                                        {completedSteps}/{agent.steps.length} completed
                                      </span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                      <div
                                        className="bg-[HSL(var(--brand-blue))] h-full rounded-full transition-all duration-300"
                                        style={{ width: `${(completedSteps / agent.steps.length) * 100}%` }}
                                      />
                                    </div>
                                  </div>

                                  {/* Steps List */}
                                  <div className="space-y-1.5">
                                    {agent.steps.map((step: any, idx: number) => {
                                      const isCompleted = step.progress?.status === 'completed';
                                      const isCurrent = idx === agent.currentStepIndex;
                                      
                                      return (
                                        <div
                                          key={step.id}
                                          className={cn(
                                            "flex items-center gap-2 px-3 py-2 rounded-lg transition-all",
                                            isCurrent && "bg-blue-50 border border-blue-200",
                                            !isCurrent && "bg-gray-50"
                                          )}
                                        >
                                          <div className={cn(
                                            "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border",
                                            isCompleted && "bg-green-100 border-green-400",
                                            isCurrent && !isCompleted && "bg-blue-100 border-blue-400",
                                            !isCurrent && !isCompleted && "bg-gray-200 border-gray-300"
                                          )}>
                                            {isCompleted ? (
                                              <Check className="w-3 h-3 text-green-600" />
                                            ) : (
                                              <span className={cn(
                                                "text-[10px] font-medium",
                                                isCurrent ? "text-blue-600" : "text-gray-500"
                                              )}>
                                                {idx + 1}
                                              </span>
                                            )}
                                          </div>
                                          <span className={cn(
                                            "text-xs flex-1 truncate",
                                            isCurrent && "font-medium text-gray-900",
                                            !isCurrent && "text-gray-600"
                                          )}>
                                            {step.name}
                                          </span>
                                          {step.progress?.best_score && (
                                            <span className="text-xs text-yellow-600 font-medium">
                                              ★{step.progress.best_score}
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Single-Step Agents */}
                    {recentAgents.singleStep && recentAgents.singleStep.length > 0 && (
                      <div className="space-y-4">
                        <h2 className="text-lg font-semibold text-gray-900">Continue Learning</h2>
                        <div className="space-y-3">
                          {recentAgents.singleStep.map((agent: any) => {
                            const categoryStyle = getCategoryStyle(agent.category);
                            const CategoryIcon = categoryStyle.icon;
                            
                            return (
                            <div
                              key={agent.id}
                              onClick={() => handleAgentCardClick(agent)}
                              className="bg-white border border-gray-200 rounded-3xl p-4 hover:shadow-lg transition-all duration-200 cursor-pointer group"
                            >
                              <div className="flex gap-4">
                                <div className="relative flex-shrink-0">
                                  <Avatar className="w-16 h-16">
                                    <AvatarImage src={getAvatarUrl(agent.image_url)} />
                                    <AvatarFallback className={cn(categoryStyle.bgColor, categoryStyle.textColor)}>
                                      <CategoryIcon className="w-6 h-6" />
                                    </AvatarFallback>
                                  </Avatar>
                                  {agent.bestScore && (
                                    <div className={cn(
                                      "absolute -bottom-1 -right-1 text-xs font-semibold px-2 py-0.5 rounded-full border",
                                      getScoreBadgeColor(agent.bestScore)
                                    )}>
                                      ★{agent.bestScore}
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2 mb-2">
                                    <h3 className="font-semibold text-gray-900 group-hover:text-[hsl(var(--brand-blue))] transition-colors">
                                      {agent.name}
                                    </h3>
                                    <div className="flex flex-col items-end gap-1">
                                      <span className="text-xs text-gray-400">
                                        {formatLastInteraction(agent.lastConversationDate)}
                                      </span>
                                      {agent.category && (
                                        <div className={cn(
                                          "flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border",
                                          categoryStyle.bgColor,
                                          categoryStyle.textColor,
                                          categoryStyle.borderColor
                                        )}>
                                          <CategoryIcon className="w-3 h-3" />
                                          <span>{agent.category}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <p className="text-sm text-gray-500 line-clamp-2">
                                    {agent.description}
                                  </p>
                             
                                </div>
                              </div>
                            </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Explore More Button */}
                    <div className="text-center pt-4 pb-8">
                      <Button
                        variant="outline"
                        onClick={() => navigate('/role-plays')}
                        className="rounded-full"
                      >
                        Explore More Agents
                      </Button>
                    </div>
                  </div>
                ) : (
                  // Empty State - No Recent Conversations
                  <div className="text-center flex-1 flex flex-col justify-center px-0 pb-16">
                    <h1 className="text-lg font-semibold text-gray-700">
                      Good to see you,
                    </h1>
                    <h2 className="text-2xl font-semibold text-gray-400 mb-2">
                      {user?.display_name || 'Student'}
                    </h2>
                    {/* <p className="text-gray-500 text-base">
                      JustTalk AI your personal AI Teacher.
                    </p> */}

                    {/* Feature Card Gallery */}
                    <div className="mt-12 -mx-4">
                      <FeatureCardGallery onNavigate={(route) => navigate(route)} />
                    </div>
                  </div>
                )}
              </main>
            </>
          )}

          {/* Bottom Bar - Related Steps/Agents (Outside Dialogue Box) */}
          {selectedConversation && agentSteps && agentSteps.relatedAgents && agentSteps.relatedAgents.length > 0 && (
            <div className="absolute pt-2 bottom-0 left-0 right-0 bg-white border-t -px-2 pb-3 rounded-b-[40px]">
              <div className="max-w-4xl mx-auto">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-gray-500">
                    {agentSteps.isMultiStep ? 'Continue with following steps' : 'Similar Scenarios'}
                  </span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  {agentSteps.relatedAgents.map((agent: any) => {
                    const isCurrentAgent = agent.id === conversationFeedback?.agent_id;
                    const progress = agent.progress?.[0];
                    const isLocked = progress?.status === 'locked' || (!progress && agent.step_number && agent.step_number > 1);
                    const isCompleted = progress?.status === 'completed';
                    
                    return (
                      <div
                        key={agent.id}
                        className={cn(
                          'flex-shrink-0 rounded-xl px-4 py-2 min-w-[120px] transition-all cursor-pointer',
                          isCurrentAgent
                            ? 'bg-[hsl(var(--brand-blue))] text-white shadow-md'
                            : isLocked
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-60'
                            : isCompleted
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                        )}
                        onClick={() => {
                          if (!isLocked && !isCurrentAgent) {
                            navigate('/ai-chat/voice/new', {
                              state: {
                                agentId: agent.id,
                                agentName: agent.name,
                                elevenLabsAgentId: agent.elevenlabs_agent_id,
                              },
                            });
                          }
                        }}
                      >
                        <div className="flex items-center gap-1.5">
                          {agentSteps.isMultiStep && agent.step_number && (
                            <span className={cn(
                              'text-xs font-bold',
                              isCurrentAgent ? 'text-white' : isLocked ? 'text-gray-400' : 'text-gray-500'
                            )}>
                              {agent.step_number}.
                            </span>
                          )}
                          <span className="text-sm font-medium line-clamp-1">
                            {agent.name}
                          </span>
                          {isLocked && (
                            <span className="text-xs ml-1">🔒</span>
                          )}
                          {isCompleted && !isCurrentAgent && (
                            <span className="text-xs ml-1">✓</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
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

      {/* Feedback Drawer - Using FeedbackDrawer component */}
      <FeedbackDrawer
        open={showFeedbackDrawer}
        onOpenChange={setShowFeedbackDrawer}
        conversationId={selectedConversation}
        elevenLabsConvId={null}
        isLoading={false}
        feedbackData={conversationFeedback?.language_feedback ? {
          snapshot: {
            duration: 0, // Not available from stored data
            turns: 0,
            words: 0,
            studentWords: 0,
            aiWords: 0,
          },
          vocabularyGoals: conversationFeedback.language_feedback.vocabularyGoals,
          llmFeedback: {
            ...conversationFeedback.language_feedback,
            memory: conversationFeedback.session_memory || undefined,
          },
        } : null}
        agentId={conversationFeedback?.agent_id}
        onRetry={handleRetryScenario}
      />
    </div>
  );
}
