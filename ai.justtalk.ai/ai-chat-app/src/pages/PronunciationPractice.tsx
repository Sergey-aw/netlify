import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Target, TrendingUp, Mic, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { AppSidebar } from '@/components/AppSidebar';
import { BaselineIntro } from '@/components/pronunciation/BaselineIntro';
import { PracticeSession } from '@/components/pronunciation/PracticeSession';
import { ProgressDashboard } from '@/components/pronunciation/ProgressDashboard';
import { ActiveSessionsList } from '@/components/pronunciation/ActiveSessionsList';
import { checkBaselineStatus, generatePracticeSession, getPracticeItems, getPracticeItemsWithResults } from '@/services/pronunciationApi';
import { supabase } from '@/lib/supabase';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { toast } from '@/hooks/use-toast';
import { useCompletePracticeSession } from '@/hooks/useCompletePracticeSession';
import type { PracticeItem, PracticeResult } from '@/types/pronunciation';
import { useEffect } from 'react';

export default function PronunciationPractice() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { mutateAsync: completeSession } = useCompletePracticeSession();
  const [activeTab, setActiveTab] = useState<'practice' | 'progress'>('practice');
  const [showSidebar, setShowSidebar] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [practiceItems, setPracticeItems] = useState<PracticeItem[]>([]);
  const [existingResults, setExistingResults] = useState<Map<string, PracticeResult>>(new Map());
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [isGeneratingPractice, setIsGeneratingPractice] = useState(false);

  // Add swipe gesture to open sidebar
  useSwipeGesture({
    onSwipeRight: () => {
      if (!showSidebar) {
        setShowSidebar(true);
      }
    },
    minSwipeDistance: 50,
    maxVerticalDistance: 100,
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

  // Check baseline status
  const { data: baselineStatus, isLoading: baselineLoading, refetch: refetchBaseline } = useQuery({
    queryKey: ['baseline-status', user?.id],
    queryFn: () => checkBaselineStatus(user!.id),
    enabled: !!user?.id,
  });

  // Check for active practice sessions
  const { data: activeSessions, isLoading: sessionLoading } = useQuery({
    queryKey: ['active-practice-session', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pronunciation_practice_sessions')
        .select('*')
        .eq('student_id', user!.id)
        .in('status', ['pending', 'in_progress'])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching active sessions:', error);
        return [];
      }

      return data || [];
    },
    enabled: !!user?.id,
  });

  // Auto-load if there's exactly one active session
  useEffect(() => {
    if (activeSessions && activeSessions.length === 1 && !currentSessionId) {
      // Found exactly one active session that's not loaded yet
      const session = activeSessions[0];
      console.log('📝 Auto-loading single active session:', session.id);
      setCurrentSessionId(session.id);
      setIsLoadingItems(true);
      
      getPracticeItemsWithResults(session.id)
        .then(async ({ items, results }) => {
          console.log('✅ Loaded', items.length, 'items with', results.size, 'existing results');
          setPracticeItems(items);
          setExistingResults(results);
          
          // Check if all items are completed
          if (results.size === items.length) {
            console.log('✅ All items completed - marking session as complete');
            try {
              await completeSession(session.id);
              toast({
                title: 'Session Complete!',
                description: 'Your practice session has been completed.',
              });
              // Refresh the active sessions list
              queryClient.invalidateQueries({ queryKey: ['active-practice-session', user?.id] });
              setCurrentSessionId(null);
              setPracticeItems([]);
              setActiveTab('progress');
            } catch (error) {
              console.error('Failed to complete session:', error);
              // Still allow user to see the session even if completion fails
              setCurrentItemIndex(items.length - 1);
            }
          } else {
            // Find first item without a result to continue from there
            const firstIncompleteIndex = items.findIndex(item => !results.has(item.id));
            if (firstIncompleteIndex >= 0) {
              setCurrentItemIndex(firstIncompleteIndex);
              console.log('📍 Resuming from item', firstIncompleteIndex + 1);
            }
          }
          
          setIsLoadingItems(false);
        })
        .catch(error => {
          console.error('❌ Failed to load items:', error);
          setIsLoadingItems(false);
          toast({
            title: 'Error',
            description: 'Failed to load practice items',
            variant: 'destructive',
          });
        });
    }
  }, [activeSessions, currentSessionId]);

  // Items are provided directly from startBaselineWorkout response

  const handleSessionCreated = (sessionId: string, items: PracticeItem[]) => {
    console.log('Session created:', sessionId, 'Items:', items.length);
    setCurrentSessionId(sessionId);
    setPracticeItems(items);
    setCurrentItemIndex(0);
    setIsLoadingItems(false);
  };

  const handleNextItem = () => {
    setCurrentItemIndex(prev => prev + 1);
  };

  const handlePreviousItem = () => {
    setCurrentItemIndex(prev => Math.max(0, prev - 1));
  };

  const handleExitPractice = () => {
    // Exit practice session but keep state saved
    // Just clear local state and switch to progress tab
    setCurrentSessionId(null);
    setPracticeItems([]);
    setCurrentItemIndex(0);
    setActiveTab('progress');
    
    toast({
      title: 'Practice Saved',
      description: 'You can continue this session later from the Practice tab.',
    });
  };

  const handleSessionComplete = () => {
    // Reset state and refetch baseline
    setCurrentSessionId(null);
    setPracticeItems([]);
    setCurrentItemIndex(0);
    
    // Invalidate queries
    queryClient.invalidateQueries({ queryKey: ['baseline-status', user?.id] });
    queryClient.invalidateQueries({ queryKey: ['active-practice-session', user?.id] });
    queryClient.invalidateQueries({ queryKey: ['pronunciation-practice-candidates', user?.id] });
    refetchBaseline();
    
    // Switch to progress tab
    setActiveTab('progress');
  };

  const handleStartTargetedPractice = async (targetPhonemes: string[]) => {
    if (!user?.id) return;
    
    try {
      setIsGeneratingPractice(true);
      console.log('🎯 Generating targeted practice for phonemes:', targetPhonemes);
      
      const response = await generatePracticeSession(user.id, targetPhonemes);
      console.log('✅ Practice session generated:', response);
      
      // Start the practice session
      handleSessionCreated(response.session_id, response.items);
      
      // Invalidate active session query
      queryClient.invalidateQueries({ queryKey: ['active-practice-session', user.id] });
      
      // Switch to practice tab
      setActiveTab('practice');
      
      toast({
        title: 'Practice Session Ready',
        description: `Created ${response.total_items} practice items for ${targetPhonemes.length} phoneme(s)`,
      });
    } catch (error) {
      console.error('❌ Error generating practice:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate practice session. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingPractice(false);
    }
  };

  const handleSelectSession = async (sessionId: string) => {
    console.log('📝 Loading selected session:', sessionId);
    setIsLoadingItems(true);
    
    try {
      const { items, results } = await getPracticeItemsWithResults(sessionId);
      console.log('✅ Loaded', items.length, 'items with', results.size, 'existing results');
      handleSessionCreated(sessionId, items);
      setExistingResults(results);
      
      // Find first item without a result
      const firstIncompleteIndex = items.findIndex(item => !results.has(item.id));
      if (firstIncompleteIndex >= 0) {
        setCurrentItemIndex(firstIncompleteIndex);
      }
      
      setActiveTab('practice');
    } catch (error) {
      console.error('❌ Failed to load items:', error);
      toast({
        title: 'Error',
        description: 'Failed to load practice items',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingItems(false);
    }
  };

  const isLoading = userLoading || baselineLoading || sessionLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    navigate('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar
        open={showSidebar}
        onOpenChange={setShowSidebar}
      />

      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSidebar(true)}
                className="md:hidden"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </Button>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <Mic className="w-6 h-6" />
                  Pronunciation Practice
                </h1>
          
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'practice' | 'progress')}>
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-6">
            <TabsTrigger value="practice" className="gap-2">
              <Target className="w-4 h-4" />
              Practice
            </TabsTrigger>
            <TabsTrigger value="progress" className="gap-2">
              <TrendingUp className="w-4 h-4" />
              Progress
            </TabsTrigger>
          </TabsList>

          <TabsContent value="practice">
            {/* Show generating state */}
            {isGeneratingPractice ? (
              <Card>
                <CardContent className="pt-6 text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">Generating targeted practice session...</p>
                </CardContent>
              </Card>
            ) : /* Show active sessions list if multiple sessions available */
            activeSessions && activeSessions.length > 1 && !currentSessionId ? (
              <ActiveSessionsList
                sessions={activeSessions}
                onSelectSession={handleSelectSession}
              />
            ) : /* Show baseline intro if no baseline and no active session */
            !currentSessionId && !baselineStatus?.hasBaseline ? (
              <BaselineIntro
                studentId={user.id}
                onSessionCreated={handleSessionCreated}
              />
            ) : /* Show practice session if items are loaded */
            currentSessionId && practiceItems.length > 0 ? (
              <PracticeSession
                items={practiceItems}
                currentIndex={currentItemIndex}
                sessionId={currentSessionId}
                existingResults={existingResults}
                onComplete={handleSessionComplete}
                onNext={handleNextItem}
                onPrevious={handlePreviousItem}
                onExit={handleExitPractice}
              />
            ) : /* Show loading state while fetching items */
            currentSessionId && isLoadingItems ? (
              <Card>
                <CardContent className="pt-6 text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">Loading practice session...</p>
                </CardContent>
              </Card>
            ) : /* If baseline exists, show continue/new session UI */
            baselineStatus?.hasBaseline ? (
              <Card>
                <CardContent className="pt-6 text-center space-y-4">
                  <p className="text-muted-foreground">Ready to practice!</p>
                  <p className="text-sm text-muted-foreground">
                    Check the Progress tab to see your stats and recommended phonemes.
                  </p>
                  <Button onClick={() => setActiveTab('progress')}>
                    View Progress
                  </Button>
                </CardContent>
              </Card>
            ) : null}
          </TabsContent>

          <TabsContent value="progress">
            <ProgressDashboard 
              studentId={user.id}
              onStartPractice={handleStartTargetedPractice}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
