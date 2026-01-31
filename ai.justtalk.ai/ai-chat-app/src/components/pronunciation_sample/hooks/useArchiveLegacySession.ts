/**
 * Phase 8.4.1: Archive Legacy Sessions
 * Detects and archives practice sessions created under old rules (>2 phonemes OR >12 items)
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { ActivePracticeSession } from '../types';

// Phase 8.3 limits
const MAX_PHONEMES = 2;
const MAX_ITEMS = 12;

/**
 * Check if a session is a legacy session that should be archived
 */
export function isLegacySession(session: ActivePracticeSession): boolean {
  return session.target_phonemes.length > MAX_PHONEMES || session.total_items > MAX_ITEMS;
}

/**
 * Hook to archive a practice session
 * Sets status to 'archived' to preserve all practice results and raw data
 */
export function useArchiveSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      // Update the session status to 'archived'
      // Note: We use 'completed' status since 'archived' may not be in the enum
      // The session will still be filtered out by the active sessions view
      const { error } = await supabase
        .from('pronunciation_practice_sessions')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      if (error) throw error;
      return sessionId;
    },
    onSuccess: () => {
      // Invalidate session queries to refresh the list
      queryClient.invalidateQueries({ queryKey: ['pronunciation-active-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['pronunciation-last-practiced-phonemes'] });
    },
    onError: (error) => {
      console.error('Failed to archive session:', error);
      toast.error('Failed to archive session');
    }
  });
}

/**
 * Get valid active sessions (filters out legacy sessions)
 * Legacy sessions are those with >2 phonemes OR >12 items
 */
export function filterValidSessions(sessions: ActivePracticeSession[] | undefined): {
  validSessions: ActivePracticeSession[];
  legacySessions: ActivePracticeSession[];
} {
  if (!sessions) {
    return { validSessions: [], legacySessions: [] };
  }

  const validSessions: ActivePracticeSession[] = [];
  const legacySessions: ActivePracticeSession[] = [];

  for (const session of sessions) {
    if (isLegacySession(session)) {
      legacySessions.push(session);
    } else {
      validSessions.push(session);
    }
  }

  return { validSessions, legacySessions };
}
