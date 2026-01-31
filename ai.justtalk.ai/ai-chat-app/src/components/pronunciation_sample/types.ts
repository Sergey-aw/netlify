/**
 * Phase 6: Pronunciation UI Types
 * These types map to the read-only database views
 * 
 * Note: Dead types removed in deprecation cleanup:
 * - PronunciationOverview (pronunciation_student_overview dropped)
 * - ProblemPhoneme (pronunciation_problem_phonemes dropped)
 * - PhonemeDetail (pronunciation_phoneme_detail dropped)
 * - PracticeReadyPhoneme (pronunciation_practice_ready dropped)
 * - CalibrationStatus (pronunciation_calibration_status dropped - Phase D.2)
 * 
 * Use IPAPracticeCandidate from useIPAPracticeCandidates.ts instead
 */

export interface ActivePracticeSession {
  session_id: string;
  student_id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'abandoned';
  target_phonemes: string[];
  total_items: number;
  completed_items: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  progress_percent: number;
  ui_status: 'completed' | 'in_progress' | 'abandoned' | 'ready_to_start';
}

export interface PracticeItemProgress {
  item_id: string;
  practice_session_id: string;
  student_id: string;
  target_ipa_symbol: string;
  practice_type: 'word' | 'minimal_pair' | 'sentence';
  word_text: string;
  word_ipa: string;
  reference_sentence: string | null; // Phase 8.3: For sentence practice items
  difficulty_tier: number;
  item_order: number;
  is_active: boolean;
  latest_score: number | null;
  latest_was_correct: boolean | null;
  attempt_count: number;
  item_status: 'mastered' | 'attempted' | 'not_started';
}

/**
 * Phase 6.5: Calibration Word Feedback
 * Word-level pronunciation scores from calibration paragraphs
 */
export interface CalibrationWordFeedback {
  student_id: string;
  session_id: string;
  calibrated_at: string;
  sentence_index: number;
  word_index: number;
  word_text: string;
  pronunciation_score: number;
  word_start_offset: number | null;
  word_end_offset: number | null;
  is_mispronounced: boolean;
  severity_bucket: 'good' | 'warning' | 'error';
}

// UX copy helpers - translating technical data to supportive language
export const statusLabels: Record<string, string> = {
  getting_worse: 'This sound needs more practice',
  getting_better: 'You\'re improving!',
  needs_work: 'Keep practicing this sound',
  on_track: 'Looking good!',
};

export const trendLabels: Record<string, string> = {
  improving: 'Getting better',
  stable: 'Steady progress',
  regressing: 'Needs attention',
};

export const progressLabels: Record<string, string> = {
  great_progress: 'Excellent improvement since your baseline workout!',
  making_progress: 'You\'re making progress',
  maintaining_well: 'Maintaining your skill well',
  steady: 'Consistent performance',
  needs_attention: 'This sound could use more practice',
  unknown: 'Keep practicing',
};

export const baselineLabels: Record<string, string> = {
  no_baseline: 'Complete the baseline workout to see comparison',
  worse_than_baseline: 'Below your baseline - keep practicing',
  better_than_baseline: 'Better than your baseline - great work!',
  similar_to_baseline: 'Similar to your starting point',
};
