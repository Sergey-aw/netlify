/**
 * Phase 8.1: Focus Sounds Hook
 * Transforms practice candidates into a unified focus sounds display
 */

import { useIPAPracticeCandidates } from './useIPAPracticeCandidates';

export interface FocusSound {
  ipaSymbol: string;
  severityLabel: 'Critical' | 'Warning';
  severityBucket: 'critical' | 'warning';
  displayScore: number;
  errorRate: number;
  exampleWord: string | null;
}

interface UseFocusSoundsResult {
  focusSounds: FocusSound[];
  totalCandidates: number;
  isLoading: boolean;
  isEmpty: boolean;
}

/**
 * Fetches and transforms practice candidates into focus sounds
 * Returns top N sounds with derived display properties
 */
export function useFocusSounds(
  studentId: string | undefined,
  maxSounds = 5
): UseFocusSoundsResult {
  const { data: candidates, isLoading } = useIPAPracticeCandidates(studentId);

  // Transform candidates to focus sounds
  const focusSounds: FocusSound[] = (candidates || [])
    .slice(0, maxSounds)
    .map((candidate) => ({
      ipaSymbol: candidate.ipa_symbol,
      severityLabel: candidate.severity_bucket === 'critical' ? 'Critical' : 'Warning',
      severityBucket: candidate.severity_bucket,
      displayScore: Math.round(candidate.avg_score || 0),
      errorRate: candidate.error_rate,
      exampleWord: candidate.example_words?.[0] || null,
    }));

  return {
    focusSounds,
    totalCandidates: candidates?.length || 0,
    isLoading,
    isEmpty: !isLoading && focusSounds.length === 0,
  };
}
