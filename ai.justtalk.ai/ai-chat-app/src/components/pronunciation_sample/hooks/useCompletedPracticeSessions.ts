/**
 * Phase 8.5: Completed Practice Sessions Hook
 * Fetches completed practice sessions for the past sessions list
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PhonemeScoreSummary {
  target_ipa_symbol: string;
  word_avg_score: number | null;
  sentence_avg_score: number | null;
  word_item_count: number;
  sentence_item_count: number;
}

export interface CompletedPracticeSession {
  session_id: string;
  student_id: string;
  target_phonemes: string[];
  total_items: number;
  created_at: string;
  completed_at: string;
  phoneme_scores_json: PhonemeScoreSummary[] | null;
  overall_avg_score: number | null;
}

/**
 * Fetch completed practice sessions for a student
 * Returns most recent sessions first
 */
export function useCompletedPracticeSessions(
  studentId: string | undefined,
  limit = 10
) {
  return useQuery({
    queryKey: ['pronunciation-completed-sessions', studentId, limit],
    queryFn: async () => {
      if (!studentId) return [];

      const { data, error } = await supabase
        .from('pronunciation_completed_practice_sessions')
        .select('*')
        .eq('student_id', studentId)
        .limit(limit);

      if (error) {
        console.error('Error fetching completed sessions:', error);
        throw error;
      }

      return (data || []) as CompletedPracticeSession[];
    },
    enabled: !!studentId,
    staleTime: 30000,
  });
}

/**
 * Fetch details for a specific completed session
 */
export function usePracticeSessionDetails(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['pronunciation-session-details', sessionId],
    queryFn: async () => {
      if (!sessionId) return null;

      const { data, error } = await supabase
        .from('pronunciation_completed_practice_sessions')
        .select('*')
        .eq('session_id', sessionId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching session details:', error);
        throw error;
      }

      return data as CompletedPracticeSession | null;
    },
    enabled: !!sessionId,
    staleTime: 60000,
  });
}
