/**
 * Phase 7.1: IPA Practice Candidates Hook
 * Fetches phonemes eligible for practice from pronunciation_ipa_practice_candidates
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface IPAPracticeCandidate {
  student_id: string;
  ipa_symbol: string;
  severity_bucket: 'critical' | 'warning';
  error_rate: number;
  avg_score: number | null;
  lowest_score: number | null;
  total_occurrences: number;
  error_count: number;
  last_seen_at: string | null;
  example_words: string[] | null;
}

/**
 * Fetch all IPA sounds eligible for practice
 * Source: pronunciation_ipa_practice_candidates view
 */
export function useIPAPracticeCandidates(studentId: string | undefined) {
  return useQuery({
    queryKey: ['pronunciation-practice-candidates', studentId],
    queryFn: async () => {
      if (!studentId) return [];
      
      const { data, error } = await supabase
        .from('pronunciation_ipa_practice_candidates')
        .select('*')
        .eq('student_id', studentId);
      
      if (error) {
        console.error('Error fetching practice candidates:', error);
        throw error;
      }
      
      return (data || []) as IPAPracticeCandidate[];
    },
    enabled: !!studentId,
    staleTime: 30000,
  });
}

/**
 * Get practice target selection (top N IPA symbols)
 */
export function usePracticeTargets(studentId: string | undefined, maxTargets: number = 5) {
  const { data: candidates, isLoading, error } = useIPAPracticeCandidates(studentId);
  
  // Select top N candidates ordered by severity then error_rate
  const targets = candidates?.slice(0, maxTargets) || [];
  const targetSymbols = targets.map(t => t.ipa_symbol);
  
  return {
    targets,
    targetSymbols,
    hasTargets: targets.length > 0,
    isLoading,
    error,
  };
}

/**
 * Create a practice session with selected IPA targets
 */
export function useCreatePracticeSession(studentId: string | undefined) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (targetPhonemes: string[]) => {
      if (!studentId) throw new Error('No student ID');
      if (targetPhonemes.length === 0) throw new Error('No target phonemes');
      
      // Insert into pronunciation_practice_sessions
      const { data, error } = await supabase
        .from('pronunciation_practice_sessions')
        .insert({
          student_id: studentId,
          target_phonemes: targetPhonemes,
          status: 'pending',
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error creating practice session:', error);
        throw error;
      }
      
      return data;
    },
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['pronunciation-active-sessions', studentId] });
      toast.success('Practice session created!');
    },
    onError: (error) => {
      console.error('Failed to create practice session:', error);
      toast.error('Failed to create practice session');
    },
  });
}
