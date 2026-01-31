/**
 * Phase 7: IPA Error Summary Hook
 * Fetches aggregated IPA-level pronunciation errors from sentence calibration
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface IPAErrorSummary {
  student_id: string;
  ipa_symbol: string;
  total_occurrences: number;
  error_count: number;
  avg_score: number | null;
  lowest_score: number | null;
  substitution_count: number;
  deletion_count: number;
  insertion_count: number;
  last_seen_at: string | null;
  example_words: string[] | null;
  error_rate: number;
  severity_bucket: 'critical' | 'warning' | 'stable';
  is_statistically_relevant: boolean;
}

/**
 * Fetch IPA error summary for a student
 * Returns all phonemes with their error rates and severity
 */
export function useIPAErrorSummary(studentId: string | undefined) {
  return useQuery({
    queryKey: ['pronunciation-ipa-errors', studentId],
    queryFn: async () => {
      if (!studentId) return [];
      
      const { data, error } = await supabase
        .from('pronunciation_ipa_error_summary')
        .select('*')
        .eq('student_id', studentId)
        .order('error_rate', { ascending: false });
      
      if (error) {
        console.error('Error fetching IPA error summary:', error);
        throw error;
      }
      
      return (data || []) as IPAErrorSummary[];
    },
    enabled: !!studentId,
    staleTime: 30000,
  });
}

/**
 * Get only problem phonemes (critical or warning severity with sufficient data)
 */
export function useProblemIPAPhonemes(studentId: string | undefined) {
  return useQuery({
    queryKey: ['pronunciation-problem-ipa', studentId],
    queryFn: async () => {
      if (!studentId) return [];
      
      const { data, error } = await supabase
        .from('pronunciation_ipa_error_summary')
        .select('*')
        .eq('student_id', studentId)
        .in('severity_bucket', ['critical', 'warning'])
        .eq('is_statistically_relevant', true)
        .order('error_rate', { ascending: false });
      
      if (error) {
        console.error('Error fetching problem phonemes:', error);
        throw error;
      }
      
      return (data || []) as IPAErrorSummary[];
    },
    enabled: !!studentId,
    staleTime: 30000,
  });
}

/**
 * Get IPA overview stats derived from the error summary
 */
export function useIPAOverviewStats(studentId: string | undefined) {
  const { data: allPhonemes, isLoading, error } = useIPAErrorSummary(studentId);
  
  const stats = {
    totalPhonemes: 0,
    criticalCount: 0,
    warningCount: 0,
    stableCount: 0,
    avgScore: 0,
    lastUpdated: null as string | null,
    hasData: false,
  };
  
  if (allPhonemes && allPhonemes.length > 0) {
    // Only count statistically relevant phonemes for severity
    const relevant = allPhonemes.filter(p => p.is_statistically_relevant);
    
    stats.totalPhonemes = allPhonemes.length;
    stats.criticalCount = relevant.filter(p => p.severity_bucket === 'critical').length;
    stats.warningCount = relevant.filter(p => p.severity_bucket === 'warning').length;
    stats.stableCount = relevant.filter(p => p.severity_bucket === 'stable').length;
    stats.avgScore = Math.round(
      allPhonemes.reduce((sum, p) => sum + (p.avg_score || 0), 0) / allPhonemes.length
    );
    stats.lastUpdated = allPhonemes
      .map(p => p.last_seen_at)
      .filter(Boolean)
      .sort()
      .reverse()[0] || null;
    stats.hasData = true;
  }
  
  return { stats, isLoading, error };
}
