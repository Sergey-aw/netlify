import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';

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
      queryClient.invalidateQueries({ queryKey: ['active-practice-session'] });
      queryClient.invalidateQueries({ queryKey: ['baseline-status'] });
      queryClient.invalidateQueries({ queryKey: ['pronunciation-practice-candidates'] });
      
      console.log('Practice session completed:', result.sessionId);
    },
    onError: (error) => {
      console.error('Failed to complete practice session:', error);
      toast({
        title: 'Error',
        description: 'Failed to complete session',
        variant: 'destructive',
      });
    },
  });
}
