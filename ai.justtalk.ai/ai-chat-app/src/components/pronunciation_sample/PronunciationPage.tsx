/**
 * Phase 6: Pronunciation Page
 * Main page combining all pronunciation UI components
 * 
 * Phase 9: Updated to use Baseline Workout instead of Calibration
 * - Uses BaselinePromptCard and BaselineResultsCard
 * - Uses BaselineWorkoutFlow for the 10-sentence workout
 * - Uses useBaselineSummary for baseline status
 */

import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BaselinePromptCard } from './BaselinePromptCard';
import { BaselineResultsCard } from './BaselineResultsCard';
import { BaselineWorkoutFlow } from './BaselineWorkoutFlow';
import { FocusSoundsSection } from './FocusSoundsSection';
import { PracticeSessionCard } from './PracticeSessionCard';
import { PracticeSessionFlow } from './PracticeSessionFlow';
import { NextPracticeSessionCard } from './NextPracticeSessionCard';
import { FocusSoundPicker } from './FocusSoundPicker';
import { LegacySessionBanner } from './LegacySessionBanner';
import { PastSessionsList } from './PastSessionsList';
import { Volume2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useActivePracticeSessions } from './hooks/usePronunciationData';
import { useBaselineSummary } from './hooks/useBaselineSummary';
import { useBaselineWorkout } from './hooks/useBaselineWorkout';
import { useNextPracticeTargets } from './hooks/useNextPracticeTargets';
import { useStartIPAPractice } from './hooks/useStartIPAPractice';
import { useArchiveSession, filterValidSessions } from './hooks/useArchiveLegacySession';
import type { ActivePracticeSession, PracticeItemProgress } from './types';

interface PronunciationPageProps {
  studentId: string;
}

type ViewState = 
  | { type: 'overview' }
  | { type: 'baseline_workout' }
  | { type: 'practice_session'; session: ActivePracticeSession }
  | { type: 'practice_flow'; session: ActivePracticeSession }
  | { type: 'practice_item'; session: ActivePracticeSession; item: PracticeItemProgress };

export function PronunciationPage({ studentId }: PronunciationPageProps) {
  const [viewState, setViewState] = useState<ViewState>({ type: 'overview' });
  const [isGeneratingSession, setIsGeneratingSession] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const queryClient = useQueryClient();
  
  // Phase 9: Get baseline status from summary view
  const { hasValidBaseline, isLoading: isLoadingBaseline } = useBaselineSummary(studentId);
  const { isStarting: isStartingBaseline } = useBaselineWorkout(studentId);
  
  // Phase 8.4: Next practice targets with rotation
  const {
    targets: nextTargets,
    targetCandidates,
    allCandidates,
    mode: targetMode,
    isLoading: isLoadingTargets,
    hasTargets,
    setManualTargets,
    clearManualTargets,
  } = useNextPracticeTargets(studentId);
  
  // Check for active sessions and filter legacy sessions
  const { data: allActiveSessions } = useActivePracticeSessions(studentId);
  const { validSessions, legacySessions } = filterValidSessions(allActiveSessions);
  
  // Use only valid sessions for UI state
  const hasActiveSession = validSessions.length > 0;
  const activeSession = validSessions[0];
  const hasLegacySessions = legacySessions.length > 0;
  
  // Archive session mutation
  const { mutate: archiveSession, isPending: isArchiving } = useArchiveSession();
  
  // Practice session action
  const { startPracticeAsync, isPending: isStartingPractice } = useStartIPAPractice(studentId);

  // Phase 8.4.1: Handle archiving legacy sessions
  const handleArchiveSession = (sessionId: string) => {
    archiveSession(sessionId, {
      onSuccess: () => {
        toast.success('Session archived. You can start a new focused practice session.');
      }
    });
  };

  const handleArchiveAllLegacy = () => {
    // Archive all legacy sessions
    legacySessions.forEach((session) => {
      archiveSession(session.session_id);
    });
    toast.success('All legacy sessions archived.');
  };

  // Phase 9: Handle starting baseline workout
  const handleStartBaseline = () => {
    setViewState({ type: 'baseline_workout' });
  };

  // Phase 9: Handle baseline workout completion
  const handleBaselineComplete = () => {
    // Invalidate all pronunciation queries to refresh data
    queryClient.invalidateQueries({ queryKey: ['pronunciation-baseline-summary'] });
    queryClient.invalidateQueries({ queryKey: ['pronunciation-baseline-phoneme-stats'] });
    queryClient.invalidateQueries({ queryKey: ['pronunciation-practice-candidates'] });
    queryClient.invalidateQueries({ queryKey: ['pronunciation-active-sessions'] });
    
    toast.success('Baseline complete! Your Focus Sounds are ready.');
    setViewState({ type: 'overview' });
  };

  const handleBaselineCancel = () => {
    setViewState({ type: 'overview' });
  };

  const handleContinueSession = (session: ActivePracticeSession) => {
    // Phase 8.3: Use new practice flow
    setViewState({ type: 'practice_flow', session });
  };

  const handleBack = () => {
    setViewState({ type: 'overview' });
  };

  // Handler when a practice session is created (from either button)
  const handlePracticeSessionCreated = (sessionId: string, targets: string[]) => {
    console.log('Practice session created:', sessionId, 'targets:', targets);
    // Invalidate to refresh session list
    queryClient.invalidateQueries({ queryKey: ['pronunciation-active-sessions'] });
  };

  const handlePracticeItem = (item: PracticeItemProgress, session: ActivePracticeSession) => {
    setViewState({ type: 'practice_item', session, item });
  };

  // Phase 8.4: Start practice with the selected targets
  const handleStartPracticeWithTargets = useCallback(async (targets?: string[]) => {
    if (!hasValidBaseline) {
      toast.error('Please complete baseline workout first');
      return;
    }
    
    const targetsToUse = targets || nextTargets;
    if (targetsToUse.length === 0) {
      toast.info('No sounds to practice right now');
      return;
    }
    
    try {
      const result = await startPracticeAsync(targetsToUse);
      
      if (result.status === 'success') {
        // Clear manual targets after successful session creation
        clearManualTargets();
        
        // Invalidate and refresh
        queryClient.invalidateQueries({ queryKey: ['pronunciation-active-sessions'] });
        queryClient.invalidateQueries({ queryKey: ['pronunciation-practice-items'] });
        queryClient.invalidateQueries({ queryKey: ['pronunciation-last-practiced-phonemes'] });
        queryClient.invalidateQueries({ queryKey: ['pronunciation-completed-sessions'] });
        
        // Fetch the new session data
        const { data: newSession } = await supabase
          .from('pronunciation_active_practice_sessions')
          .select('*')
          .eq('session_id', result.sessionId)
          .single();
        
        if (newSession) {
          setViewState({ type: 'practice_flow', session: newSession as ActivePracticeSession });
        }
      } else if (result.status === 'active_session_exists' && activeSession) {
        // If there's already an active session, continue it
        setViewState({ type: 'practice_flow', session: activeSession });
      }
    } catch (error) {
      console.error('Failed to start practice:', error);
      toast.error('Failed to create practice session');
    }
  }, [hasValidBaseline, nextTargets, startPracticeAsync, clearManualTargets, queryClient, activeSession]);

  // Phase 8.5: Handle starting a new session from results screen
  const handleStartNewSession = useCallback(() => {
    // Navigate back to overview, the NextPracticeSessionCard will handle starting
    setViewState({ type: 'overview' });
    // Trigger a fresh session creation after a brief delay for UI smoothness
    setTimeout(() => {
      handleStartPracticeWithTargets();
    }, 100);
  }, [handleStartPracticeWithTargets]);

  // Phase 8.5: Handle practicing the same phonemes again
  const handlePracticeAgain = useCallback((targets: string[]) => {
    handleStartPracticeWithTargets(targets);
  }, [handleStartPracticeWithTargets]);

  // Phase 8.4: Handle manual target selection - archive current session and create new one
  const handleConfirmManualTargets = useCallback(async (targets: string[]) => {
    setIsPickerOpen(false);
    
    // If there's an active session, archive it first
    if (activeSession) {
      archiveSession(activeSession.session_id, {
        onSuccess: () => {
          // After archiving, create new session with selected targets
          handleStartPracticeWithTargets(targets);
        }
      });
    } else {
      // No active session, just set targets and start
      setManualTargets(targets);
      handleStartPracticeWithTargets(targets);
    }
  }, [activeSession, archiveSession, handleStartPracticeWithTargets, setManualTargets]);

  // Phase 8.5: Handle choosing different sounds from results screen
  const handleChooseDifferent = useCallback(() => {
    setViewState({ type: 'overview' });
    // Open the picker after returning to overview
    setTimeout(() => setIsPickerOpen(true), 100);
  }, []);

  // Phase 9: Render baseline workout flow
  if (viewState.type === 'baseline_workout') {
    return (
      <BaselineWorkoutFlow
        studentId={studentId}
        onClose={handleBaselineCancel}
        onComplete={handleBaselineComplete}
      />
    );
  }

  // Phase 8.3: New practice session flow
  if (viewState.type === 'practice_flow') {
    return (
      <PracticeSessionFlow
        session={viewState.session}
        studentId={studentId}
        onClose={() => setViewState({ type: 'overview' })}
        onStartNew={handleStartNewSession}
        onPracticeAgain={handlePracticeAgain}
        onChooseDifferent={handleChooseDifferent}
      />
    );
  }

  // Render legacy practice session view (kept for backwards compatibility)
  if (viewState.type === 'practice_session') {
    return (
      <PracticeSessionFlow
        session={viewState.session}
        studentId={studentId}
        onClose={() => setViewState({ type: 'overview' })}
        onStartNew={handleStartNewSession}
        onPracticeAgain={handlePracticeAgain}
        onChooseDifferent={handleChooseDifferent}
      />
    );
  }

  // Default: Overview
  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary">
          <Volume2 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Pronunciation</h1>
          <p className="text-sm text-muted-foreground">
            Train your pronunciation skills
          </p>
        </div>
      </div>

      {/* Phase 9: Pre-baseline: Show setup prompt */}
      {!hasValidBaseline && (
        <BaselinePromptCard 
          onStartBaseline={handleStartBaseline} 
          isStarting={isStartingBaseline}
        />
      )}

      {/* Phase 9: Post-baseline: Show results card */}
      {hasValidBaseline && (
        <BaselineResultsCard
          studentId={studentId}
          onRetakeBaseline={handleStartBaseline}
        />
      )}

      {/* Phase 8.4.1: Legacy Session Banner - archive old format sessions */}
      {hasValidBaseline && hasLegacySessions && (
        <LegacySessionBanner
          sessions={legacySessions}
          onArchive={handleArchiveSession}
          onArchiveAll={handleArchiveAllLegacy}
          isArchiving={isArchiving}
        />
      )}

      {/* Phase 8.4: Next Practice Session Card - shows when baseline complete and has targets and no active/legacy session */}
      {hasValidBaseline && hasTargets && !hasActiveSession && !hasLegacySessions && (
        <NextPracticeSessionCard
          targets={nextTargets}
          targetCandidates={targetCandidates}
          mode={targetMode}
          isStarting={isStartingPractice}
          disabled={!hasValidBaseline || hasActiveSession}
          disabledReason={
            hasActiveSession 
              ? "Complete your current session first" 
              : !hasValidBaseline 
                ? "Complete baseline workout first" 
                : undefined
          }
          onStartPractice={() => handleStartPracticeWithTargets()}
          onChooseDifferent={() => setIsPickerOpen(true)}
          onResetToAuto={targetMode === 'manual' ? clearManualTargets : undefined}
        />
      )}

      {/* Active Session Banner - show if there's an active session */}
      {hasValidBaseline && hasActiveSession && activeSession && (
        <PracticeSessionCard
          studentId={studentId}
          onContinueSession={handleContinueSession}
          onSessionCreated={handlePracticeSessionCreated}
          onChooseDifferent={() => setIsPickerOpen(true)}
          disabled={!hasValidBaseline}
          disabledReason={!hasValidBaseline ? "Complete baseline workout to unlock practice sessions" : undefined}
        />
      )}

      {/* Your Focus Sounds - only show if baseline complete */}
      {hasValidBaseline && (
        <FocusSoundsSection studentId={studentId} />
      )}

      {/* Phase 8.5: Past Sessions - only show if baseline complete */}
      {hasValidBaseline && (
        <PastSessionsList studentId={studentId} />
      )}

      {/* Phase 8.4: Focus Sound Picker Modal */}
      <FocusSoundPicker
        open={isPickerOpen}
        onOpenChange={setIsPickerOpen}
        candidates={allCandidates}
        currentTargets={nextTargets}
        onConfirm={handleConfirmManualTargets}
      />
    </div>
  );
}
