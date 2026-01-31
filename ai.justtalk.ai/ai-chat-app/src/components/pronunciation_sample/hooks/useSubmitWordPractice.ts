/**
 * Phase 8.2: Submit Word Practice Hook
 * Mutation hook for submitting word practice audio to SpeechSuper
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Phase 8.2b: Extended phoneme data from SpeechSuper
export interface PhonemeResult {
  phoneme: string;
  score: number;
  readType: number;
  soundLike?: string;
  insertedBefore?: string[];
  insertedAfter?: string[];
}

export interface WordPracticeResult {
  success: boolean;
  result_id: string;
  pronunciation_score: number;
  was_correct: boolean;
  phoneme_feedback: {
    target_ipa: string;
    score: number | null;
    was_correct: boolean | null;
  } | null;
  attempt_number: number;
  word?: string;
  phonemes?: PhonemeResult[];
  raw_response?: unknown;
}

interface SubmitWordPracticeParams {
  practiceItemId: string;
  audioBlob: Blob;
}

export function useSubmitWordPractice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ practiceItemId, audioBlob }: SubmitWordPracticeParams): Promise<WordPracticeResult> => {
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
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pronunciation-submit-word-practice`,
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
        throw new Error(result.error || 'Failed to submit word practice');
      }

      return result as WordPracticeResult;
    },
    onSuccess: () => {
      // Invalidate relevant queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ['pronunciation-practice-items'] });
      queryClient.invalidateQueries({ queryKey: ['pronunciation-active-sessions'] });
    },
  });
}
