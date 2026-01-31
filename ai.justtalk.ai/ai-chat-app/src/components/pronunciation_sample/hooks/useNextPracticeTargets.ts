/**
 * Phase 8.4: Next Practice Targets Hook
 * Handles auto-rotation and manual target selection for practice sessions
 * 
 * Rotation Rules:
 * 1. Avoid repeating the same 2 phonemes from the last session
 * 2. Priority: critical > warning, higher error_rate, higher occurrences
 * 3. Manual selection overrides auto and is persisted
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useIPAPracticeCandidates, type IPAPracticeCandidate } from './useIPAPracticeCandidates';

const MAX_TARGETS = 2;
const STORAGE_KEY = 'pronunciation_manual_targets';

interface ManualTargetState {
  studentId: string;
  targets: string[];
  timestamp: number;
}

export interface NextPracticeTargetsResult {
  targets: string[];
  targetCandidates: IPAPracticeCandidate[];
  allCandidates: IPAPracticeCandidate[];
  mode: 'auto' | 'manual';
  isLoading: boolean;
  hasTargets: boolean;
  setManualTargets: (targets: string[]) => void;
  clearManualTargets: () => void;
  lastPracticedPhonemes: string[];
}

/**
 * Fetch the last completed practice session's target phonemes
 */
function useLastPracticedPhonemes(studentId: string | undefined) {
  return useQuery({
    queryKey: ['pronunciation-last-practiced-phonemes', studentId],
    queryFn: async () => {
      if (!studentId) return [];
      
      // Get the most recent completed or in_progress session
      const { data, error } = await supabase
        .from('pronunciation_practice_sessions')
        .select('target_phonemes, completed_at, created_at')
        .eq('student_id', studentId)
        .in('status', ['completed', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching last practiced phonemes:', error);
        return [];
      }
      
      return (data?.target_phonemes as string[]) || [];
    },
    enabled: !!studentId,
    staleTime: 30000,
  });
}

/**
 * Load manual targets from localStorage
 */
function loadManualTargets(studentId: string): string[] | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    
    const state: ManualTargetState = JSON.parse(stored);
    
    // Only use if same student and less than 24h old
    const isValid = 
      state.studentId === studentId && 
      state.targets.length === MAX_TARGETS &&
      (Date.now() - state.timestamp) < 24 * 60 * 60 * 1000;
    
    return isValid ? state.targets : null;
  } catch {
    return null;
  }
}

/**
 * Save manual targets to localStorage
 */
function saveManualTargets(studentId: string, targets: string[]) {
  const state: ManualTargetState = {
    studentId,
    targets,
    timestamp: Date.now(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/**
 * Clear manual targets from localStorage
 */
function clearStoredManualTargets() {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Select targets with rotation logic
 * Avoids repeating the same 2 phonemes from last session when alternatives exist
 */
function selectAutoTargets(
  candidates: IPAPracticeCandidate[],
  lastPracticed: string[]
): string[] {
  if (candidates.length === 0) return [];
  if (candidates.length <= MAX_TARGETS) {
    return candidates.map(c => c.ipa_symbol);
  }
  
  // Sort candidates by priority (should already be sorted, but ensure consistency)
  const sortedCandidates = [...candidates].sort((a, b) => {
    // Critical before warning
    const severityOrder = { critical: 0, warning: 1 };
    const aSeverity = severityOrder[a.severity_bucket] ?? 2;
    const bSeverity = severityOrder[b.severity_bucket] ?? 2;
    if (aSeverity !== bSeverity) return aSeverity - bSeverity;
    
    // Higher error_rate first
    if ((b.error_rate ?? 0) !== (a.error_rate ?? 0)) {
      return (b.error_rate ?? 0) - (a.error_rate ?? 0);
    }
    
    // Higher occurrences first
    return (b.total_occurrences ?? 0) - (a.total_occurrences ?? 0);
  });
  
  // If no last practiced, just take top 2
  if (lastPracticed.length === 0) {
    return sortedCandidates.slice(0, MAX_TARGETS).map(c => c.ipa_symbol);
  }
  
  // Try to avoid exact repeat of last 2 phonemes
  const lastPracticedSet = new Set(lastPracticed);
  
  // Filter out phonemes that were in the last session
  const nonRepeats = sortedCandidates.filter(c => !lastPracticedSet.has(c.ipa_symbol));
  
  // If we have enough non-repeats, use them
  if (nonRepeats.length >= MAX_TARGETS) {
    return nonRepeats.slice(0, MAX_TARGETS).map(c => c.ipa_symbol);
  }
  
  // If we only have some non-repeats, mix with highest priority repeats
  if (nonRepeats.length > 0) {
    const needed = MAX_TARGETS - nonRepeats.length;
    const repeats = sortedCandidates.filter(c => lastPracticedSet.has(c.ipa_symbol));
    return [
      ...nonRepeats.slice(0, nonRepeats.length).map(c => c.ipa_symbol),
      ...repeats.slice(0, needed).map(c => c.ipa_symbol)
    ];
  }
  
  // No alternatives available, use top 2 despite repeat
  return sortedCandidates.slice(0, MAX_TARGETS).map(c => c.ipa_symbol);
}

/**
 * Main hook for managing next practice targets
 */
export function useNextPracticeTargets(studentId: string | undefined): NextPracticeTargetsResult {
  const { data: candidates, isLoading: isLoadingCandidates } = useIPAPracticeCandidates(studentId);
  const { data: lastPracticed, isLoading: isLoadingLast } = useLastPracticedPhonemes(studentId);
  
  const [manualTargets, setManualTargetsState] = useState<string[] | null>(() => {
    return studentId ? loadManualTargets(studentId) : null;
  });
  
  // Reload manual targets when studentId changes
  useEffect(() => {
    if (studentId) {
      const stored = loadManualTargets(studentId);
      setManualTargetsState(stored);
    }
  }, [studentId]);
  
  // Compute auto targets with rotation
  const autoTargets = useMemo(() => {
    if (!candidates) return [];
    return selectAutoTargets(candidates, lastPracticed || []);
  }, [candidates, lastPracticed]);
  
  // Use manual targets if set and valid
  const mode = manualTargets !== null ? 'manual' : 'auto';
  const targets = manualTargets ?? autoTargets;
  
  // Get full candidate objects for the selected targets
  const targetCandidates = useMemo(() => {
    if (!candidates) return [];
    const targetSet = new Set(targets);
    return candidates.filter(c => targetSet.has(c.ipa_symbol));
  }, [candidates, targets]);
  
  // Set manual targets
  const setManualTargets = useCallback((newTargets: string[]) => {
    if (!studentId) return;
    if (newTargets.length !== MAX_TARGETS) {
      console.warn(`Manual targets must be exactly ${MAX_TARGETS}`);
      return;
    }
    setManualTargetsState(newTargets);
    saveManualTargets(studentId, newTargets);
  }, [studentId]);
  
  // Clear manual targets (revert to auto)
  const clearManualTargets = useCallback(() => {
    setManualTargetsState(null);
    clearStoredManualTargets();
  }, []);
  
  return {
    targets,
    targetCandidates,
    allCandidates: candidates || [],
    mode,
    isLoading: isLoadingCandidates || isLoadingLast,
    hasTargets: targets.length > 0,
    setManualTargets,
    clearManualTargets,
    lastPracticedPhonemes: lastPracticed || [],
  };
}
