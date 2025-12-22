import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { Play, Lock, ChevronRight, Trophy, Clock, PanelLeft, Archive, RotateCcw, Loader2, MessageCircle, Star, TrendingUp, Target, AlertCircle, Bookmark, X, MessagesSquare } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion, AnimatePresence } from 'motion/react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from '@/components/ui/carousel';
import { AppSidebar } from '@/components/AppSidebar';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { getAgentsByCategory, unlockFirstStep, archiveRoleplay, getPersonalitiesByCategory } from '@/services/agents.service';
import type { AgentWithProgress, StudentProgress } from '@/types/agents';

export default function RolePlaysV2() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showSidebar, setShowSidebar] = useState(false);

  // Add swipe gesture to open sidebar
  useSwipeGesture({
    onSwipeRight: () => {
      if (!showSidebar) {
        setShowSidebar(true);
      }
    },
    minSwipeDistance: 50,
    maxVerticalDistance: 100,
    ignoreSelectors: ['[data-swipe-ignore]'],
  });
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<AgentWithProgress | null>(null);
  const [showFeedbackDrawer, setShowFeedbackDrawer] = useState(false);
  const [feedbackAgentId, setFeedbackAgentId] = useState<string | null>(null);
  const [feedbackConversationId, setFeedbackConversationId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('feedback');
  const [selectedPersonality, setSelectedPersonality] = useState<string | null>(null);
  const [showPersonalityDrawer, setShowPersonalityDrawer] = useState(false);
  const [personalityForDescription, setPersonalityForDescription] = useState<{ name: string; description: string; avatar: string } | null>(null);
  const [availablePersonalities, setAvailablePersonalities] = useState<Array<{ name: string; description: string; avatar: string }>>([]);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [currentSlide, setCurrentSlide] = useState(0);

  // Get current user
  const { data: userAuth } = useQuery({
    queryKey: ['auth-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return null;
      }
      return user;
    },
  });

  const userId = userAuth?.id || null;

  // Fetch role play categories with React Query
  const { data: categories = [], isPending: loading } = useQuery({
    queryKey: ['roleplay-categories', userId, selectedPersonality],
    queryFn: async () => {
      if (!userId) return [];
      return await getAgentsByCategory(userId, selectedPersonality || undefined);
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    placeholderData: (previousData) => previousData, // Keep previous data while fetching new data
  });

  // Get current user profile
  const { data: user } = useQuery({
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

  // Query for conversation feedback
  const { data: conversationFeedback } = useQuery({
    queryKey: ['agent-conversation-feedback', feedbackAgentId, userId],
    queryFn: async () => {
      if (!feedbackAgentId || !userId) return null;
      
      // First, get the progress entry to find the best_session_conversation_id
      const { data: progressData, error: progressError } = await supabase
        .from('justai_student_progress')
        .select('best_session_conversation_id')
        .eq('agent_id', feedbackAgentId)
        .eq('student_id', userId)
        .maybeSingle();

      if (progressError) {
        console.error('Error fetching progress:', progressError);
        return null;
      }

      if (!progressData?.best_session_conversation_id) {
        // Fallback to most recent conversation with feedback
        const { data, error } = await supabase
          .from('justai_conversations')
          .select('id, language_feedback, conversation_score, session_memory')
          .eq('agent_id', feedbackAgentId)
          .eq('student_id', userId)
          .not('language_feedback', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error('Error fetching conversation feedback:', error);
          return null;
        }
        if (data) setFeedbackConversationId(data.id);
        return data;
      }

      // Get the specific conversation with the best score
      const { data, error } = await supabase
        .from('justai_conversations')
        .select('id, language_feedback, conversation_score, session_memory')
        .eq('id', progressData.best_session_conversation_id)
        .single();

      if (error) {
        console.error('Error fetching conversation feedback:', error);
        return null;
      }
      if (data) setFeedbackConversationId(data.id);
      return data;
    },
    enabled: !!feedbackAgentId && !!userId,
  });

  // Load personalities when category is selected
  useEffect(() => {
    async function loadPersonalities() {
      if (!selectedCategory) {
        setAvailablePersonalities([]);
        setSelectedPersonality(null);
        return;
      }

      try {
        const personalities = await getPersonalitiesByCategory(selectedCategory);
        setAvailablePersonalities(personalities);
        
        // Set first personality as default
        if (personalities.length > 0) {
          setSelectedPersonality(personalities[0].name);
        }
      } catch (error) {
        console.error('Error loading personalities:', error);
      }
    }

    loadPersonalities();
  }, [selectedCategory]);

  // Sync carousel with personality changes and track current slide
  useEffect(() => {
    if (!carouselApi) return;

    // Update current slide when carousel changes
    const onSelect = () => {
      setCurrentSlide(carouselApi.selectedScrollSnap());
    };

    carouselApi.on('select', onSelect);
    onSelect(); // Initial call

    return () => {
      carouselApi.off('select', onSelect);
    };
  }, [carouselApi]);

  // Update selected personality when carousel scrolls
  useEffect(() => {
    if (availablePersonalities.length > 0 && currentSlide < availablePersonalities.length) {
      const newPersonality = availablePersonalities[currentSlide];
      if (newPersonality && newPersonality.name !== selectedPersonality) {
        setSelectedPersonality(newPersonality.name);
      }
    }
  }, [currentSlide, availablePersonalities]);

  const formatDuration = (seconds?: number | null) => {
    if (!seconds) return 'Flexible';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  };

  // Generate consistent message count for each personality
  const getMessageCount = (personalityName: string) => {
    // Create a hash from the personality name for consistency
    const hash = personalityName.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    
    // Base number between 5000-15000 based on personality name (more diverse range)
    const baseNumber = 5000 + (Math.abs(hash) % 10001);
    
    // Calculate time since Dec 22, 2025
    const startDate = new Date('2025-12-22').getTime();
    const now = new Date();
    const currentTime = now.getTime();
    
    // Calculate total minutes passed since start date
    const minutesPassed = Math.floor((currentTime - startDate) / (1000 * 60));
    
    // Minute increase between 100-300 per minute
    const minuteIncrease = 100 + ((Math.abs(hash * 7) % 201));
    
    return baseNumber + Math.floor(minutesPassed * minuteIncrease);
  };

  const getStatusIcon = (status?: StudentProgress['status']) => {
    switch (status) {
      case 'completed':
        return <Trophy className="w-4 h-4 text-green-600" />;
      case 'in_progress':
        return <Play className="w-4 h-4 text-blue-600" />;
      case 'unlocked':
        return <Play className="w-4 h-4 text-primary" />;
      case 'archived':
        return <Archive className="w-4 h-4 text-gray-500" />;
      case 'locked':
      default:
        return <Lock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status?: StudentProgress['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-50 border-green-200';
      case 'in_progress':
        return 'bg-blue-50 border-blue-200';
      case 'unlocked':
        return 'bg-white border-gray-200';
      case 'archived':
        return 'bg-gray-50 border-gray-200';
      case 'locked':
      default:
        return 'bg-gray-50 border-gray-300 opacity-60';
    }
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 85) return 'bg-green-100 text-green-800 border-green-300';
    if (score >= 70) return 'bg-blue-100 text-blue-800 border-blue-300';
    if (score >= 50) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    return 'bg-red-100 text-red-800 border-red-300';
  };

  const handleStepClick = async (agent: AgentWithProgress, step: AgentWithProgress | null = null) => {
    const targetAgent = step || agent;
    const progress = targetAgent.progress;
    
    if (progress?.status === 'locked') {
      toast.error('Complete previous steps to unlock this one.');
      return;
    }

    // If completed, show feedback drawer instead of navigating
    if (progress?.status === 'completed') {
      setFeedbackAgentId(targetAgent.id);
      setShowFeedbackDrawer(true);
      return;
    }

    // If unlocking for the first time, update status
    if (!progress && userId) {
      try {
        await unlockFirstStep(userId, agent.id);
      } catch (error) {
        console.error('Error unlocking step:', error);
      }
    }

    navigate('/ai-chat/voice/new', {
      state: {
        fromTransition: true,
        agentId: targetAgent.elevenlabs_agent_id,
        agentName: targetAgent.name,
        scenario: targetAgent.description,
        agentDatabaseId: targetAgent.id,
        stepName: targetAgent.name,
      },
    });
  };

  const handleArchiveRoleplay = async (agentId: string) => {
    if (!userId) return;

    try {
      await archiveRoleplay(userId, agentId);
      
      // Reload data
      await queryClient.invalidateQueries({ queryKey: ['roleplay-categories', userId] });
      setSelectedAgent(null);
      
      toast.success('Your progress has been saved. You can now start fresh!');
    } catch (error) {
      console.error('Error archiving roleplay:', error);
      toast.error('Failed to archive roleplay. Please try again.');
    }
  };

  const handleRestartFromArchive = async (agentId: string) => {
    if (!userId) return;

    try {
      await unlockFirstStep(userId, agentId);
      
      // Reload data
      await queryClient.invalidateQueries({ queryKey: ['roleplay-categories', userId] });
      
      toast.success('You can now continue practicing!');
    } catch (error) {
      console.error('Error restarting roleplay:', error);
      toast.error('Failed to restart roleplay. Please try again.');
    }
  };

  // Calculate agent progress
  const getAgentProgress = (agent: AgentWithProgress) => {
    if (!agent.is_multi_step || !agent.steps) {
      const progress = agent.progress;
      return {
        completedSteps: progress?.status === 'completed' ? 1 : 0,
        totalSteps: 1,
        progressPercent: progress?.status === 'completed' ? 100 : 0,
        averageScore: progress?.average_session_score || null,
        isArchived: progress?.status === 'archived',
      };
    }

    const totalSteps = agent.steps.length;
    const completedSteps = agent.steps.filter(
      (s) => s.progress?.status === 'completed'
    ).length;
    const archivedSteps = agent.steps.filter(
      (s) => s.progress?.status === 'archived'
    ).length;

    const progressPercent = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

    // Calculate average score
    const scoresAvailable = agent.steps.filter(
      (s) => s.progress?.average_session_score !== null
    );
    const averageScore =
      scoresAvailable.length > 0
        ? scoresAvailable.reduce(
            (sum, s) => sum + (s.progress?.average_session_score || 0),
            0
          ) / scoresAvailable.length
        : null;

    return {
      completedSteps,
      totalSteps,
      progressPercent,
      averageScore,
      isArchived: archivedSteps > 0,
    };
  };

  const renderPersonalityDrawer = () => (
    <AnimatePresence mode="wait">
      {showPersonalityDrawer && personalityForDescription && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          style={{ willChange: 'opacity' }}
          className="fixed inset-0 z-50 bg-gray-50"
          onClick={() => setShowPersonalityDrawer(false)}
        >
          <motion.div
            layoutId={`personality-${personalityForDescription.name}`}
            className="relative w-full h-full bg-white"
            onClick={(e) => e.stopPropagation()}
            style={{ willChange: 'transform' }}
            transition={{ 
              type: "spring",
              damping: 30,
              stiffness: 300,
              mass: 0.5
            }}
          >
            <Card className="h-full bg-white border-none shadow-none">
              <CardContent className="relative h-full p-0 flex flex-col">
                {/* Close Button */}
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ 
                    delay: 0.1,
                    duration: 0.2,
                    ease: [0.4, 0, 0.2, 1]
                  }}
                  style={{ willChange: 'transform, opacity' }}
                  onClick={() => setShowPersonalityDrawer(false)}
                  className="absolute top-8 right-8 z-10 w-10 h-10 rounded-full bg-white/90 hover:bg-white flex items-center justify-center transition-colors shadow-lg"
                >
                  <X className="w-6 h-6 text-gray-600" />
                </motion.button>

                {/* Image Section - Half height */}
                <motion.div 
                  layoutId={`personality-image-${personalityForDescription.name}`}
                  className="w-full overflow-hidden"
                  style={{ height: '50%', willChange: 'transform' }}
                  transition={{ 
                    type: "spring",
                    damping: 30,
                    stiffness: 300,
                    mass: 0.5
                  }}
                >
                  <img 
                    src={personalityForDescription.avatar} 
                    alt={personalityForDescription.name}
                    className="w-full h-full object-cover"
                  />
                </motion.div>

                {/* Text Content Below Image */}
                <div className="flex-1 flex flex-col justify-start px-8 py-10">
                  {/* Name with badge */}
                  <div className="flex gap-3 mb-2">
                    <h3 className="text-2xl font-semibold text-gray-900">{personalityForDescription.name}</h3>
                   
                  </div>
                  {/* Full Description */}
                  <p className="text-md text-gray-600 text-left leading-normal max-w-2xl mx-auto">
                    {personalityForDescription.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const renderFeedbackDrawer = () => (
    <Drawer open={showFeedbackDrawer} onOpenChange={setShowFeedbackDrawer}>
      <DrawerContent className="px-6 pb-6" aria-describedby="feedback-description">
        <div className="sr-only" id="feedback-description">
          Conversation feedback and analysis
        </div>
        {conversationFeedback?.language_feedback ? (
          <>
            {/* Feedback Header */}
            <div className="pt-6 pb-4 border-b">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-3 bg-blue-100 rounded-full">
                  <MessageCircle className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex items-center gap-3 flex-1">
                  <h2 className="text-xl font-bold">Overall Score:</h2>
                  {conversationFeedback?.conversation_score && (
                    <Badge variant="default" className="text-base bg-[hsl(var(--brand-blue))] text-white hover:bg-[hsl(var(--brand-blue))]/90">
                      {conversationFeedback.conversation_score}/100
                    </Badge>
                  )}
                </div>
              </div>
              {feedbackConversationId && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setShowFeedbackDrawer(false);
                    navigate(`/ai-chat?conversation=${feedbackConversationId}`);
                  }}
                >
                  See Conversation
                </Button>
              )}
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="feedback">Language Feedback</TabsTrigger>
                <TabsTrigger value="summary">Session Summary</TabsTrigger>
              </TabsList>

              {/* Language Feedback Tab */}
              <TabsContent value="feedback" className="py-4 space-y-6 max-h-[60vh] overflow-y-auto">{/* Diagnosis */}
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
              </TabsContent>

              {/* Session Summary Tab */}
              <TabsContent value="summary" className="py-4 space-y-6 max-h-[60vh] overflow-y-auto">
                {conversationFeedback.session_memory?.unlock_next_scenario && (
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border-2 border-green-200">
                    <div className="flex items-start gap-3">
                      <Trophy className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <h3 className="text-base font-semibold text-green-900 mb-2">🎉 Next Step Unlocked!</h3>
                        <p className="text-sm text-green-800 leading-relaxed">
                          Great job! You've successfully completed this conversation and unlocked the next step in your learning journey.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {conversationFeedback.session_memory?.conversation_summary && (
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <MessageCircle className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <h3 className="text-base font-semibold text-purple-900 mb-2">Conversation Summary</h3>
                        <p className="text-sm text-purple-800 leading-relaxed">
                          {conversationFeedback.session_memory.conversation_summary}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {conversationFeedback.session_memory?.emotional_notes && (
                  <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Star className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <h3 className="text-base font-semibold text-blue-900 mb-2">Emotional Tone</h3>
                        <p className="text-sm text-blue-800 leading-relaxed">
                          {conversationFeedback.session_memory.emotional_notes}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {conversationFeedback.session_memory?.open_threads && conversationFeedback.session_memory.open_threads.length > 0 && (
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Bookmark className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <h3 className="text-base font-semibold text-amber-900 mb-2">Topics to Continue</h3>
                        <ul className="space-y-2">
                          {conversationFeedback.session_memory.open_threads.map((thread: string, index: number) => (
                            <li key={index} className="text-sm text-amber-800 flex items-start gap-2">
                              <span className="text-amber-600">•</span>
                              <span>{thread}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {!conversationFeedback.session_memory?.conversation_summary && 
                 !conversationFeedback.session_memory?.emotional_notes && 
                 (!conversationFeedback.session_memory?.open_threads || conversationFeedback.session_memory.open_threads.length === 0) && (
                  <div className="py-8 text-center">
                    <p className="text-muted-foreground">No session summary available.</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <div className="py-8 text-center">
            <p className="text-muted-foreground">No feedback available yet.</p>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );

  if (loading) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-2" />
            <p className="text-muted-foreground">Loading roleplays...</p>
          </div>
        </div>
        {renderPersonalityDrawer()}
        {renderFeedbackDrawer()}
      </>
    );
  }

  // Category view
  if (!selectedCategory) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24 page-enter">
        <AppSidebar open={showSidebar} onOpenChange={setShowSidebar} />

        {/* Header */}
        <header className="bg-white px-4 py-4 border-b">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <Button
              variant="ghost"
              size="icon"
              className="-ml-2"
              onClick={() => setShowSidebar(!showSidebar)}
            >
              <PanelLeft className="w-6 h-6 text-gray-600" />
            </Button>
            <div className="flex-1 text-center">
              <h1 className="text-xl font-semibold">Role-play Journey</h1>
            </div>
            <Avatar className="w-10 h-10 cursor-pointer" onClick={() => navigate('/profile')}>
              <AvatarImage src={user?.profile_photo_url} />
              <AvatarFallback>{user?.display_name?.[0] || 'U'}</AvatarFallback>
            </Avatar>
          </div>
        </header>

        {/* Categories */}
        <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Choose a Category</h3>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => {
              return (
                <Card
                  key={category.category}
                  className="p-6 cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-primary"
                  onClick={() => setSelectedCategory(category.category)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="text-4xl">{category.icon}</div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                  <h4 className="font-semibold text-lg mb-2">{category.category}</h4>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {category.totalAgents} scenario{category.totalAgents !== 1 ? 's' : ''}
                    </span>
                    {category.completedAgents > 0 && (
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        {category.completedAgents} completed
                      </Badge>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Agent list view
  const selectedCategoryData = categories.find((c) => c.category === selectedCategory);

  if (selectedCategoryData && !selectedAgent) {
    return (
      <>
      <div className="min-h-screen bg-gray-50 pb-24 page-enter relative">
        {/* Animated Gradient Background */}
        {/* <div className="fixed inset-0 z-0">
          <ShaderGradientCanvas
            importedFiber={{ ...reactSpring, config: reactSpring.config }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
            }}
          >
   <ShaderGradient
  animate="off"
  axesHelper="off"
  brightness={1.1}
  cAzimuthAngle={180}
  cDistance={2.91}
  cPolarAngle={120}
  cameraZoom={1}
  color1="#cfccff"
  color2="#a6e8f8"
  color3="#9cffd2"
  destination="onCanvas"
  embedMode="off"
  envPreset="city"
  format="gif"
  fov={45}
  frameRate={10}
  gizmoHelper="hide"
  grain="off"
  lightType="3d"
  pixelDensity={3}
  positionX={0}
  positionY={1.8}
  positionZ={0}
  range="disabled"
  rangeEnd={40}
  rangeStart={0}
  reflection={0.1}
  rotationX={0}
  rotationY={0}
  rotationZ={-90}
  shader="defaults"
  type="plane"
  uAmplitude={0}
  uDensity={3.6}
  uFrequency={5.5}
  uSpeed={0.3}
  uStrength={8.3}
  uTime={0.2}
  wireframe={false}
/>
          </ShaderGradientCanvas>
        </div> */}
        
        <div className="relative z-10">
        <AppSidebar open={showSidebar} onOpenChange={setShowSidebar} />

        {/* Header */}
        <header className="px-4 py-4 border-b-0" 
          style={{
            background: 'rgba(255, 255, 255, 0.3)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            boxShadow: '0 4px 16px 0 rgba(31, 38, 135, 0.1), inset 0 -1px 0 0 rgba(255, 255, 255, 0.5)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.3)',
          }}
        >
          <div className="flex items-center gap-3 max-w-7xl mx-auto">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedCategory(null)}
            >
              <ChevronRight className="w-5 h-5 rotate-180" />
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{selectedCategoryData.icon}</span>
                <h1 className="text-xl font-semibold">{selectedCategoryData.category}</h1>
              </div>
            </div>
          </div>
        </header>

        {/* Personality Carousel */}
        {availablePersonalities.length > 0 && (
          <div className="max-w-7xl mx-auto px-2 pt-2 pb-2" data-swipe-ignore>
            <div className="flex flex-col items-center">
              <Carousel
                setApi={setCarouselApi}
                className="w-full max-w-md"
                opts={{
                  align: 'center',
                  loop: true,
                }}
              >
                <CarouselContent className="-ml-2">
                  {availablePersonalities.map((personality) => (
                    <CarouselItem key={personality.name} className="pl-2">
                      <div className="p-2">
                        <motion.div
                          layoutId={`personality-${personality.name}`}
                          onClick={() => {
                            setPersonalityForDescription(personality);
                            setShowPersonalityDrawer(true);
                          }}
                          className="cursor-pointer group"
                          style={{ willChange: 'transform' }}
                          transition={{
                            type: "spring",
                            damping: 30,
                            stiffness: 300,
                            mass: 0.5,
                            velocity: 2
                          }}
                        >
                          <Card className="relative rounded-[2.5rem] transition-all duration-300 hover:shadow-md hover:shadow-white/20 border-0" 
                            style={{
                              background: 'rgba(255, 255, 255, 0.7)',
                              backdropFilter: 'blur(20px) saturate(180%)',
                              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                              boxShadow: '0 4px 12px 0 rgba(31, 38, 135, 0.12), inset 0 1px 0 0 rgba(255, 255, 255, 0.8), inset 0 -1px 0 0 rgba(255, 255, 255, 0.3)',
                              border: '1px solid rgba(255, 255, 255, 0.6)',
                            }}
                          >
                            {/* Subtle gradient overlay for shine effect */}
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                              style={{
                                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0) 50%, rgba(255, 255, 255, 0.2) 100%)',
                              }}
                            />
                            <CardContent className="flex flex-col p-2 pb-6 relative z-10 overflow-hidden rounded-[2.5rem]">
                              {/* Large Photo Section - takes most of the card */}
                              <motion.div 
                                layoutId={`personality-image-${personality.name}`}
                                className="w-full aspect-[1.5/1] overflow-hidden rounded-[2rem] mb-4"
                                style={{ willChange: 'transform' }}
                                transition={{
                                  type: "spring",
                                  damping: 30,
                                  stiffness: 300,
                                  mass: 0.5,
                                  velocity: 2
                                }}
                              >
                                <img 
                                  src={personality.avatar} 
                                  alt={personality.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    // Fallback to avatar if image fails
                                    e.currentTarget.style.display = 'none';
                                    e.currentTarget.parentElement!.innerHTML = `
                                      <div class="w-full h-full bg-gray-200 flex items-center justify-center rounded-3xl">
                                        <span class="text-gray-600 text-6xl font-medium">
                                          ${personality.name.substring(0, 2).toUpperCase()}
                                        </span>
                                      </div>
                                    `;
                                  }}
                                />
                              </motion.div>
                              {/* Text Content with inline badge */}
                              <div className="w-full pl-4 pr-4">
                                {/* Name with inline checkmark badge and message count */}
                                <div className="flex items-start justify-between gap-2 mb-3">
                                  <h3 className="text-lg font-semibold text-gray-900">{personality.name}</h3>
                                  <div className="flex items-center gap-1.5 text-gray-500 pt-1">
                                    <MessagesSquare className="w-4 h-4" />
                                    <span className="text-sm font-normal">{getMessageCount(personality.name).toLocaleString()}</span>
                                  </div>
                                </div>
                                {/* Description */}
                                <p className="text-sm text-gray-500 text-left leading-normal line-clamp-3">
                                  {personality.description}
                                </p>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious className="-left-4 hidden" />
                <CarouselNext className="-right-4 hidden" />
              </Carousel>
              
              {/* Carousel Dots */}
              <div className="flex gap-2 mt-4">
                {availablePersonalities.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => carouselApi?.scrollTo(index)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      index === currentSlide
                        ? 'bg-primary w-6'
                        : 'bg-gray-300 hover:bg-gray-400'
                    }`}
                    aria-label={`Go to slide ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Agents */}
        <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
          {selectedCategoryData.agents.map((agent) => {
            const { completedSteps, totalSteps, progressPercent, averageScore, isArchived } =
              getAgentProgress(agent);

            // Agent is only locked if all steps are explicitly locked (not just missing progress)
            // First step should never cause parent to be locked
            const isLocked = agent.is_multi_step && agent.steps?.every((s) => {
              const isFirstStep = s.step_number === 1;
              return s.progress?.status === 'locked' || (!s.progress && !isFirstStep);
            });

            return (
              <Card
                key={agent.id}
                className={`relative overflow-hidden p-6 cursor-pointer transition-all duration-300 border-0 ${
                  isLocked ? 'opacity-60' : 'hover:shadow-2xl hover:shadow-white/20'
                }`}
                style={{
                  background: 'rgba(255, 255, 255, 0.7)',
                  backdropFilter: 'blur(20px) saturate(180%)',
                  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                  boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15), inset 0 1px 0 0 rgba(255, 255, 255, 0.8), inset 0 -1px 0 0 rgba(255, 255, 255, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.6)',
                  borderRadius: '1.5rem',
                }}
                onClick={() => !isLocked && (agent.is_multi_step ? setSelectedAgent(agent) : handleStepClick(agent))}
              >
                {/* Subtle gradient overlay */}
                {!isLocked && (
                  <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                    style={{
                      background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0) 50%, rgba(255, 255, 255, 0.2) 100%)',
                    }}
                  />
                )}
                <div className="space-y-4 relative z-10">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold">{agent.name}</h3>
                        {agent.is_premium && (
                          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                            Premium
                          </Badge>
                        )}
                        {isArchived && (
                          <Badge variant="secondary" className="bg-gray-100 text-gray-800">
                            Archived
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {agent.difficulty_level && (
                          <Badge variant="outline" className="text-xs">
                            {agent.difficulty_level}
                          </Badge>
                        )}
                        {agent.recommended_cefr_level && (
                          <Badge variant="outline" className="text-xs">
                            {agent.recommended_cefr_level}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDuration(agent.recommended_duration_seconds)}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {isLocked ? (
                        <Lock className="w-6 h-6 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-6 h-6 text-gray-400" />
                      )}
                    </div>
                  </div>

                  {/* Progress */}
                  {agent.is_multi_step && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {completedSteps}/{totalSteps} steps completed
                        </span>
                        {averageScore !== null && (
                          <Badge className={`text-xs ${getScoreBadgeColor(averageScore)}`}>
                            Avg: {Math.round(averageScore)}%
                          </Badge>
                        )}
                      </div>
                      <Progress value={progressPercent} className="h-2" />
                    </div>
                  )}

                  {/* Single step score */}
                  {!agent.is_multi_step && agent.progress?.average_session_score !== null && agent.progress && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Your score:</span>
                      <Badge
                        className={`text-xs ${getScoreBadgeColor(
                          agent.progress.average_session_score
                        )}`}
                      >
                        {Math.round(agent.progress.average_session_score)}%
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        ({agent.progress.sessions_count} session
                        {agent.progress.sessions_count !== 1 ? 's' : ''})
                      </span>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
        </div>
      </div>
      {renderPersonalityDrawer()}
      {renderFeedbackDrawer()}
    </>
    );
  }

  // Step detail view
  if (selectedAgent) {
    const hasActiveProgress = selectedAgent.steps?.some(
      (s) => s.progress?.status && !['locked', 'archived'].includes(s.progress.status)
    );
    const isArchived = selectedAgent.steps?.some((s) => s.progress?.status === 'archived');

    return (
      <>
      <div className="min-h-screen bg-gray-50 pb-24 page-enter">
        <AppSidebar open={showSidebar} onOpenChange={setShowSidebar} />

        {/* Header */}
        <header className="bg-white px-4 py-4 border-b">
          <div className="flex items-center gap-3 max-w-7xl mx-auto">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedAgent(null)}
            >
              <ChevronRight className="w-5 h-5 rotate-180" />
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-semibold">{selectedAgent.name}</h1>
            </div>
          </div>
        </header>

        {/* Archive/Continue Banner */}
        {hasActiveProgress && !isArchived && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b px-4 py-4">
            <div className="max-w-7xl mx-auto">
              <Card className="p-4 bg-white/80 backdrop-blur">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-blue-900">Continue Your Journey</h4>
                    <p className="text-sm text-blue-700 mt-1">
                      You have active progress in this roleplay
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-2"
                    onClick={() => handleArchiveRoleplay(selectedAgent.id)}
                  >
                    <Archive className="w-4 h-4" />
                    Archive & Start New
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        )}

        {isArchived && (
          <div className="bg-gray-100 border-b px-4 py-4">
            <div className="max-w-7xl mx-auto">
              <Card className="p-4 bg-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900">Archived Roleplay</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      This roleplay is archived. Restart to continue practicing.
                    </p>
                  </div>
                  <Button 
                    size="sm" 
                    className="gap-2"
                    onClick={() => handleRestartFromArchive(selectedAgent.id)}
                  >
                    <RotateCcw className="w-4 h-4" />
                    Restart Roleplay
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* Steps */}
        <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {selectedAgent.is_multi_step ? 'Steps' : 'Practice Session'}
          </h3>

          <div className="space-y-3">
            {(selectedAgent.steps || [selectedAgent]).map((step) => {
              const progress = step.progress;
              // First step should never be locked if there's no progress record
              const isFirstStep = step.step_number === 1 || !selectedAgent.is_multi_step;
              const isLocked = progress?.status === 'locked' || (!progress && !isFirstStep);
              const isCompleted = progress?.status === 'completed';
              const isInProgress = progress?.status === 'in_progress';

              return (
                <Card
                  key={step.id}
                  className={`p-5 border-2 transition-all ${
                    isLocked
                      ? 'opacity-60 cursor-not-allowed'
                      : 'cursor-pointer hover:shadow-md hover:border-primary'
                  } ${getStatusColor(progress?.status)}`}
                  onClick={() => handleStepClick(selectedAgent, step)}
                >
                  <div className="flex items-start gap-4">
                    {/* Step Number */}
                    {selectedAgent.is_multi_step && step.step_number && (
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                          isCompleted
                            ? 'bg-green-600 text-white'
                            : isInProgress
                            ? 'bg-blue-600 text-white'
                            : isLocked
                            ? 'bg-gray-300 text-gray-600'
                            : 'bg-primary text-white'
                        }`}
                      >
                        {isCompleted ? '✓' : step.step_number}
                      </div>
                    )}

                    {/* Content */}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold text-lg">{step.name}</h4>
                          {step.description && (
                            <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
                          )}
                        </div>
                        {getStatusIcon(progress?.status)}
                      </div>

                      {/* Progress Stats */}
                      {progress && progress.status !== 'locked' && (
                        <div className="flex flex-wrap gap-3 pt-2">
                          {progress.sessions_count > 0 && (
                            <div className="flex items-center gap-2 text-sm">
                              <Play className="w-4 h-4 text-gray-500" />
                              <span className="text-muted-foreground">
                                {progress.sessions_count} session{progress.sessions_count !== 1 ? 's' : ''}
                              </span>
                            </div>
                          )}
                          {/* {progress.average_session_score !== null && (
                            <Badge className={getScoreBadgeColor(progress.average_session_score)}>
                              Avg: {Math.round(progress.average_session_score)}%
                            </Badge>
                          )}
                          {progress.best_session_score !== null && (
                            <Badge variant="outline" className="border-green-300 text-green-800">
                              Best: {progress.best_session_score}%
                            </Badge>
                          )} */}
                          {progress.latest_session_score !== null && (
                            <Badge variant="outline">
                              {progress.latest_session_score}%
                            </Badge>
                          )}
                        </div>
                      )}

                      {/* Lock Info */}
                      {isLocked && step.unlock_condition_type && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2">
                          <Lock className="w-4 h-4" />
                          <span>
                            {step.unlock_condition_type === 'previous_step' &&
                              'Complete previous step to unlock'}
                            {step.unlock_condition_type === 'message_count' &&
                              `Send ${step.unlock_condition_value} messages in previous step`}
                            {step.unlock_condition_type === 'time_spent' &&
                              `Spend ${Math.floor((step.unlock_condition_value || 0) / 60)} minutes in previous step`}
                            {step.unlock_condition_type === 'score_threshold' &&
                              `Achieve ${step.unlock_condition_value}% score in previous step`}
                          </span>
                        </div>
                      )}

                      {/* Duration */}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        <span>{formatDuration(step.recommended_duration_seconds)}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
      {renderPersonalityDrawer()}
      {renderFeedbackDrawer()}
    </>
    );
  }

  // This should not be reached, but keeping for safety
  return (
    <>
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
      {renderPersonalityDrawer()}
      {renderFeedbackDrawer()}
    </>
  );
}
