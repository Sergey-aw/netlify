/**
 * Phase 9: Baseline Summary Hook
 * Reads from baseline workout summary and phoneme stats views
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BaselineSummary {
  student_id: string;
  baseline_session_id: string;
  completed_at: string;
  total_sentences: number;
  counted_sentences: number;
  avg_overall: number | null;
  avg_pronunciation: number | null;
  avg_fluency: number | null;
  is_valid_baseline: boolean;
}

export interface BaselinePhonemeStats {
  student_id: string;
  baseline_session_id: string;
  baseline_completed_at: string;
  ipa_symbol: string;
  exposures: number;
  avg_score: number | null;
  error_count: number;
  error_rate: number;
  severity_bucket: 'critical' | 'warning' | 'stable';
}

export function useBaselineSummary(studentId: string | undefined) {
  // Query for baseline workout summary
  const summaryQuery = useQuery({
    queryKey: ['pronunciation-baseline-summary', studentId],
    queryFn: async (): Promise<BaselineSummary | null> => {
      if (!studentId) return null;

      const { data, error } = await supabase
        .from('pronunciation_baseline_workout_summary')
        .select('*')
        .eq('student_id', studentId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching baseline summary:', error);
        throw error;
      }

      return data as BaselineSummary | null;
    },
    enabled: !!studentId,
    staleTime: 60000,
  });

  // Query for phoneme-level stats from baseline
  const phonemeStatsQuery = useQuery({
    queryKey: ['pronunciation-baseline-phoneme-stats', studentId],
    queryFn: async (): Promise<BaselinePhonemeStats[]> => {
      if (!studentId) return [];

      const { data, error } = await supabase
        .from('pronunciation_baseline_phoneme_stats')
        .select('*')
        .eq('student_id', studentId)
        .order('error_rate', { ascending: false });

      if (error) {
        console.error('Error fetching baseline phoneme stats:', error);
        throw error;
      }

      return (data || []) as BaselinePhonemeStats[];
    },
    enabled: !!studentId,
    staleTime: 60000,
  });

  return {
    summary: summaryQuery.data,
    phonemeStats: phonemeStatsQuery.data || [],
    isLoading: summaryQuery.isLoading || phonemeStatsQuery.isLoading,
    hasValidBaseline: summaryQuery.data?.is_valid_baseline === true,
    needsRetake: summaryQuery.data && !summaryQuery.data.is_valid_baseline,
    refetch: () => {
      summaryQuery.refetch();
      phonemeStatsQuery.refetch();
    },
  };
}
