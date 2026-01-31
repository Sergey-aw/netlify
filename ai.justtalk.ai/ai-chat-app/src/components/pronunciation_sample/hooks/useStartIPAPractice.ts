/**
 * Phase 7.2: Unified IPA Practice Session Action
 * 
 * This is the CANONICAL action for starting a practice session.
 * Both "Start Practice" (Sounds to Practice) and "Start Practice Session" (Practice Sessions)
 * MUST use this hook.
 * 
 * Logic:
 * 1. Check for existing active session (prevent duplicates)
 * 2. Load practice candidates from pronunciation_ipa_practice_candidates
 * 3. Select top 5 IPA symbols by severity/error_rate
 * 4. Create session record with status = 'pending' (becomes 'in_progress' when started)
 * 5. Call edge function to generate practice items (words + LLM sentences)
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useActivePracticeSessions } from './usePronunciationData';
import { useIPAPracticeCandidates } from './useIPAPracticeCandidates';

export type StartIPAPracticeResult = 
  | { status: 'success'; sessionId: string; targets: string[]; itemCount: number }
  | { status: 'no_candidates' }
  | { status: 'active_session_exists'; sessionId: string }
  | { status: 'error'; error: string };

const MAX_PRACTICE_TARGETS = 2; // Phase 8.3: Reduced from 5 to 2 for focused workout

/**
 * Core hook for starting an IPA practice session
 * Returns both the mutation and state about whether starting is allowed
 */
export function useStartIPAPractice(studentId: string | undefined) {
  const queryClient = useQueryClient();
  
  // Check for existing active sessions
  const { data: activeSessions, isLoading: isLoadingSessions } = useActivePracticeSessions(studentId);
  
  // Get practice candidates
  const { data: candidates, isLoading: isLoadingCandidates } = useIPAPracticeCandidates(studentId);
  
  // Derived state
  const hasActiveSession = (activeSessions?.length ?? 0) > 0;
  const activeSessionId = activeSessions?.[0]?.session_id;
  const hasCandidates = (candidates?.length ?? 0) > 0;
  const candidateCount = candidates?.length ?? 0;
  const isLoading = isLoadingSessions || isLoadingCandidates;
  
  // Can only start if: no active session AND has candidates AND not loading
  const canStartPractice = !isLoading && !hasActiveSession && hasCandidates;
  
  // Reason why we can't start (for UI messaging)
  const disabledReason = isLoading 
    ? 'Loading...'
    : hasActiveSession 
      ? 'Practice session already in progress'
      : !hasCandidates 
        ? 'No sounds need practice right now'
        : undefined;

const mutation = useMutation({
    mutationFn: async (providedTargets?: string[]): Promise<StartIPAPracticeResult> => {
      if (!studentId) {
        return { status: 'error', error: 'No student ID' };
      }

      // Step 1: Check for existing active session
      const { data: existingSessions, error: sessionError } = await supabase
        .from('pronunciation_practice_sessions')
        .select('id')
        .eq('student_id', studentId)
        .in('status', ['pending', 'in_progress'])
        .limit(1);
      
      if (sessionError) {
        console.error('Error checking existing sessions:', sessionError);
        return { status: 'error', error: sessionError.message };
      }
      
      if (existingSessions && existingSessions.length > 0) {
        return { status: 'active_session_exists', sessionId: existingSessions[0].id };
      }

      let ipaTargets: string[];

      // Phase 8.4: Use provided targets if available (from manual selection)
      if (providedTargets && providedTargets.length > 0) {
        ipaTargets = providedTargets.slice(0, MAX_PRACTICE_TARGETS);
        console.log('[useStartIPAPractice] Using provided targets:', ipaTargets);
      } else {
        // Step 2: Load practice candidates (auto-selection fallback)
        const { data: candidateData, error: candidateError } = await supabase
          .from('pronunciation_ipa_practice_candidates')
          .select('ipa_symbol, severity_bucket, error_rate, total_occurrences')
          .eq('student_id', studentId);
        
        if (candidateError) {
          console.error('Error loading practice candidates:', candidateError);
          return { status: 'error', error: candidateError.message };
        }
        
        if (!candidateData || candidateData.length === 0) {
          return { status: 'no_candidates' };
        }

        // Step 3: Select top N IPA targets (already ordered by view, but ensure order)
        // Order: severity_bucket (critical first), error_rate DESC, total_occurrences DESC
        const sortedCandidates = [...candidateData].sort((a, b) => {
          // Critical before warning
          const severityOrder = { critical: 0, warning: 1 };
          const aSeverity = severityOrder[a.severity_bucket as keyof typeof severityOrder] ?? 2;
          const bSeverity = severityOrder[b.severity_bucket as keyof typeof severityOrder] ?? 2;
          if (aSeverity !== bSeverity) return aSeverity - bSeverity;
          
          // Higher error_rate first
          if ((b.error_rate ?? 0) !== (a.error_rate ?? 0)) {
            return (b.error_rate ?? 0) - (a.error_rate ?? 0);
          }
          
          // Higher occurrences first
          return (b.total_occurrences ?? 0) - (a.total_occurrences ?? 0);
        });
        
        ipaTargets = sortedCandidates
          .slice(0, MAX_PRACTICE_TARGETS)
          .map(c => c.ipa_symbol);
      }

      // Step 4: Create practice session record
      const { data: newSession, error: insertError } = await supabase
        .from('pronunciation_practice_sessions')
        .insert({
          student_id: studentId,
          target_phonemes: ipaTargets,
          status: 'pending',
          total_items: 0,
          completed_items: 0,
        })
        .select('id')
        .single();
      
      if (insertError) {
        console.error('Error creating practice session:', insertError);
        return { status: 'error', error: insertError.message };
      }

      console.log('[useStartIPAPractice] Session created:', newSession.id, 'Targets:', ipaTargets);

      // Step 5: Call edge function to generate practice items
      let itemCount = 0;
      try {
        const { data: generateData, error: generateError } = await supabase.functions.invoke(
          'pronunciation-generate-practice',
          {
            body: { sessionId: newSession.id }
          }
        );

        if (generateError) {
          console.error('Error generating practice items:', generateError);
          // Don't fail the whole operation - session exists, items can be generated later
          toast.warning('Session created but practice items may still be loading');
        } else {
          itemCount = generateData?.totalItems || 0;
          console.log('[useStartIPAPractice] Practice items generated:', itemCount);
        }
      } catch (funcError) {
        console.error('Edge function call failed:', funcError);
        // Non-fatal - session still created
      }

      return { 
        status: 'success', 
        sessionId: newSession.id,
        targets: ipaTargets,
        itemCount
      };
    },
    onSuccess: (result) => {
      // Invalidate session queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ['pronunciation-active-sessions', studentId] });
      queryClient.invalidateQueries({ queryKey: ['pronunciation-practice-items'] });
      
      if (result.status === 'success') {
        const itemMsg = result.itemCount > 0 
          ? ` with ${result.itemCount} practice items`
          : '';
        toast.success(`Practice session created${itemMsg}`);
      } else if (result.status === 'active_session_exists') {
        toast.info('You already have an active practice session');
      } else if (result.status === 'no_candidates') {
        toast.info('No sounds need practice right now');
      }
    },
    onError: (error) => {
      console.error('Failed to start practice session:', error);
      toast.error('Failed to create practice session');
    },
  });

  return {
    // Mutation
    startPractice: mutation.mutate,
    startPracticeAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    
    // State
    canStartPractice,
    disabledReason,
    hasActiveSession,
    activeSessionId,
    hasCandidates,
    candidateCount,
    isLoading,
  };
}
