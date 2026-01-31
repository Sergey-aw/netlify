/**
 * Phase 8.3: Submit Sentence Practice Hook
 * Mutation hook for submitting sentence practice audio to SpeechSuper
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Phoneme data from SpeechSuper
export interface SentencePhonemeResult {
  phoneme: string;
  score: number;
  readType: number;
  soundLike?: string;
  insertedBefore?: string[];
  insertedAfter?: string[];
}

// Word-level result from sentence evaluation
export interface SentenceWordResult {
  text: string;
  score: number;
  phonemes: SentencePhonemeResult[];
}

// Phase 9: Extended result with baseline and session completion info
export interface SentencePracticeResult {
  success: boolean;
  result_id: string;
  pronunciation_score: number;
  overall_score?: number;
  fluency_score?: number;
  integrity_score?: number;
  was_correct: boolean;
  attempt_number: number;
  sentence: string;
  words: SentenceWordResult[];
  is_baseline?: boolean;
  session_completed?: boolean;
  completed_items?: number;
  total_items?: number;
  raw_response?: unknown;
}

interface SubmitSentencePracticeParams {
  practiceItemId: string;
  audioBlob: Blob;
}

export function useSubmitSentencePractice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ practiceItemId, audioBlob }: SubmitSentencePracticeParams): Promise<SentencePracticeResult> => {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      // Create form data
      const formData = new FormData();
      formData.append('practice_item_id', practiceItemId);
      formData.append('audio', audioBlob, 'practice.wav');

      // Submit to edge function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pronunciation-submit-sentence-practice`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          },
          body: formData
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit sentence practice');
      }

      return result as SentencePracticeResult;
    },
    onSuccess: () => {
      // Invalidate relevant queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ['pronunciation-practice-items'] });
      queryClient.invalidateQueries({ queryKey: ['pronunciation-active-sessions'] });
    },
  });
}
