/**
 * Phase 8.5: Complete Practice Session Hook
 * Mutation to mark a practice session as completed
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CompletePracticeSessionResult {
  sessionId: string;
  status: 'completed';
  completedAt: string;
}

/**
 * Mutation hook to mark a practice session as completed
 * Sets status to 'completed' and completed_at to now()
 */
export function useCompletePracticeSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string): Promise<CompletePracticeSessionResult> => {
      if (!sessionId) {
        throw new Error('Session ID is required');
      }

      const completedAt = new Date().toISOString();

      const { error } = await supabase
        .from('pronunciation_practice_sessions')
        .update({
          status: 'completed',
          completed_at: completedAt,
        })
        .eq('id', sessionId);

      if (error) {
        console.error('Error completing practice session:', error);
        throw error;
      }

      return {
        sessionId,
        status: 'completed',
        completedAt,
      };
    },
    onSuccess: (result) => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ['pronunciation-active-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['pronunciation-completed-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['pronunciation-practice-items'] });
      queryClient.invalidateQueries({ queryKey: ['pronunciation-practice-candidates'] });
      queryClient.invalidateQueries({ queryKey: ['pronunciation-ipa-errors'] });
      // Critical: Invalidate last practiced phonemes so rotation picks up the completed session
      queryClient.invalidateQueries({ queryKey: ['pronunciation-last-practiced-phonemes'] });
      
      console.log('Practice session completed:', result.sessionId);
    },
    onError: (error) => {
      console.error('Failed to complete practice session:', error);
      toast.error('Failed to complete session');
    },
  });
}
