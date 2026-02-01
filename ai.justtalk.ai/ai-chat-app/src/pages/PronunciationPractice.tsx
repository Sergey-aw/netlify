import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Target, TrendingUp, PanelLeft, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { AppSidebar } from '@/components/AppSidebar';
import { BaselineIntro } from '@/components/pronunciation/BaselineIntro';
import { PracticeSession } from '@/components/pronunciation/PracticeSession';
import { ProgressDashboard } from '@/components/pronunciation/ProgressDashboard';
import { ActiveSessionsList } from '@/components/pronunciation/ActiveSessionsList';
import { TargetedPracticeStarter } from '@/components/pronunciation/TargetedPracticeStarter';
import { PastSessionsList } from '@/components/pronunciation/PastSessionsList';
import { checkBaselineStatus, generatePracticeSession, getPracticeItemsWithResults, getPracticeCandidates, getBaselineSummary } from '@/services/pronunciationApi';
import { supabase } from '@/lib/supabase';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { toast } from '@/hooks/use-toast';
import { useCompletePracticeSession } from '@/hooks/useCompletePracticeSession';
import type { PracticeItem, PracticeResult } from '@/types/pronunciation';
import { useEffect } from 'react';

export default function PronunciationPractice() {
  const navigate = useNavigate();
  const location = useLocation();
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
  const [autoOpenDrawer, setAutoOpenDrawer] = useState(false);

  // Check if we should auto-open the sound selector from navigation state
  useEffect(() => {
    if (location.state?.autoOpenSoundSelector) {
      setAutoOpenDrawer(true);
      // Clear the state
      window.history.replaceState({}, '', '/pronunciation-practice');
    }
  }, [location.state]);

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

  // Fetch baseline summary for isValidBaseline
  const { data: baselineSummary } = useQuery({
    queryKey: ['baseline-summary', user?.id],
    queryFn: () => getBaselineSummary(user!.id),
    enabled: !!user?.id && !!baselineStatus?.hasBaseline,
  });

  // Fetch practice candidates for targeted practice
  const { data: practiceCandidates } = useQuery({
    queryKey: ['pronunciation-practice-candidates', user?.id],
    queryFn: () => getPracticeCandidates(user!.id),
    enabled: !!user?.id && !!baselineStatus?.hasBaseline,
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
    <div className="min-h-screen bg-gray-50 pb-24 page-enter">
      <AppSidebar
        open={showSidebar}
        onOpenChange={setShowSidebar}
      />

      {/* Header */}
      <header className="bg-white px-4 py-4 border-b sticky top-0 z-10">
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
            <h1 className="text-lg font-medium">Pronunciation Practice</h1>
          </div>
          <Avatar className="w-10 h-10 cursor-pointer" onClick={() => navigate('/profile')}>
            <AvatarImage src={user?.profile_photo_url} />
            <AvatarFallback>{user?.display_name?.[0] || 'U'}</AvatarFallback>
          </Avatar>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('practice')}
            className={cn(
              'flex-1 py-2 px-4 rounded-lg font-medium transition-colors',
              activeTab === 'practice'
                ? 'bg-[hsl(var(--brand-blue))] text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
            )}
          >
            <div className="flex items-center justify-center gap-2">
              <Target className="w-4 h-4" />
              <span>Practice</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('progress')}
            className={cn(
              'flex-1 py-2 px-4 rounded-lg font-medium transition-colors',
              activeTab === 'progress'
                ? 'bg-[hsl(var(--brand-blue))] text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
            )}
          >
            <div className="flex items-center justify-center gap-2">
              <TrendingUp className="w-4 h-4" />
              <span>Progress</span>
            </div>
          </button>
        </div>

        {activeTab === 'practice' ? (
          <>
            {/* Show generating state */}
            {isGeneratingPractice ? (
              <Card>
                <CardContent className="pt-6 text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">Generating targeted practice session...</p>
                </CardContent>
              </Card>
            ) : /* Show active sessions list if multiple sessions available */
            activeSessions && activeSessions.length >= 1 && !currentSessionId ? (
              <div className="space-y-6">
                {/* Show TargetedPracticeStarter FIRST */}
                {baselineStatus?.hasBaseline && (
                  <>
                    {baselineSummary?.is_valid_baseline && practiceCandidates && practiceCandidates.length > 0 ? (
                      <TargetedPracticeStarter 
                        practiceCandidates={practiceCandidates}
                        onStartPractice={handleStartTargetedPractice}
                        initialDrawerOpen={autoOpenDrawer}
                      />
                    ) : !baselineSummary?.is_valid_baseline ? (
                      <Alert className="border-red-200 bg-red-50">
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        <AlertTitle className="text-red-900">Baseline Assessment Incomplete</AlertTitle>
                        <AlertDescription className="text-red-800">
                          Your baseline assessment had fewer than 6 valid sentences (integrity score ≥60). 
                          Please retake the baseline assessment for more accurate results.
                        </AlertDescription>
                      </Alert>
                    ) : null}
                  </>
                )}
                <ActiveSessionsList
                  sessions={activeSessions}
                  onSelectSession={handleSelectSession}
                />
                <PastSessionsList studentId={user.id} limit={10} />
              </div>
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
            ) : /* If baseline exists, show targeted practice starter */
            baselineStatus?.hasBaseline ? (
              <>
                {baselineSummary?.is_valid_baseline && practiceCandidates && practiceCandidates.length > 0 ? (
                  <TargetedPracticeStarter 
                    practiceCandidates={practiceCandidates}
                    onStartPractice={handleStartTargetedPractice}
                    initialDrawerOpen={autoOpenDrawer}
                  />
                ) : !baselineSummary?.is_valid_baseline ? (
                  <Alert className="border-red-200 bg-red-50">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <AlertTitle className="text-red-900">Baseline Assessment Incomplete</AlertTitle>
                    <AlertDescription className="text-red-800">
                      Your baseline assessment had fewer than 6 valid sentences (integrity score ≥60). 
                      Please retake the baseline assessment for more accurate results.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Card>
                    <CardContent className="pt-6 text-center">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">Loading practice options...</p>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : null}
          </>
        ) : (
          <ProgressDashboard 
            studentId={user.id}
            onStartPractice={handleStartTargetedPractice}
          />
        )}
      </div>
    </div>
  );
}
