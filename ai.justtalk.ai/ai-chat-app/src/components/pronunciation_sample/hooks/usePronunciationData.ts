/**
 * Phase 6: Pronunciation Data Hooks
 * Read-only queries to pronunciation views
 * 
 * Note: Dead hooks removed in deprecation cleanup:
 * - usePronunciationOverview (pronunciation_student_overview dropped)
 * - useProblemPhonemes (pronunciation_problem_phonemes dropped)
 * - usePhonemeDetail (pronunciation_phoneme_detail dropped)
 * - usePracticeReadyPhonemes (pronunciation_practice_ready dropped)
 * - useCalibrationStatus (pronunciation_calibration_status dropped - Phase D.2)
 * 
 * Use useIPAPracticeCandidates from useIPAPracticeCandidates.ts instead
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type {
  ActivePracticeSession,
  PracticeItemProgress,
} from '../types';

/**
 * Fetch active practice sessions
 */
export function useActivePracticeSessions(studentId: string | undefined) {
  return useQuery({
    queryKey: ['pronunciation-active-sessions', studentId],
    queryFn: async () => {
      if (!studentId) return [];
      
      const { data, error } = await supabase
        .from('pronunciation_active_practice_sessions')
        .select('*')
        .eq('student_id', studentId);
      
      if (error) throw error;
      return (data || []) as ActivePracticeSession[];
    },
    enabled: !!studentId,
    staleTime: 10000, // 10 seconds - more frequent for active sessions
  });
}

/**
 * Fetch practice item progress for a session
 */
export function usePracticeItemProgress(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['pronunciation-practice-items', sessionId],
    queryFn: async () => {
      if (!sessionId) return [];
      
      const { data, error } = await supabase
        .from('pronunciation_practice_item_progress')
        .select('*')
        .eq('practice_session_id', sessionId)
        .order('item_order', { ascending: true });
      
      if (error) throw error;
      return (data || []) as PracticeItemProgress[];
    },
    enabled: !!sessionId,
    staleTime: 5000, // 5 seconds - very fresh for active practice
  });
}
