// Pronunciation Practice Types
// Based on PRONUNCIATION_SYSTEM_MOBILE_API.md

export type PracticeType = 'word' | 'sentence';
export type SessionStatus = 'active' | 'completed' | 'abandoned';
export type SelectionReason = 
  | 'high_error_rate' 
  | 'regressing_trend' 
  | 'baseline_regression' 
  | 'calibration_priority' 
  | 'manual_selection';

// Practice Session
export interface PracticeSession {
  id: string;
  student_id: string;
  status: SessionStatus;
  target_phonemes: string[]; // IPA symbols like ['θ', 'ð', 'ɹ']
  is_baseline: boolean;
  total_items: number;
  completed_items: number;
  started_at: string; // ISO timestamp
  completed_at?: string;
  created_at: string;
}

// Practice Item
export interface PracticeItem {
  id: string;
  practice_session_id: string;
  student_id: string;
  practice_type: PracticeType;
  target_ipa_symbol: string | null;  // NULL for baseline
  word_text: string | null;  // NULL for sentence practice
  word_ipa: string | null;  // NULL for sentence practice
  reference_sentence: string | null;  // NULL for word practice, populated for sentence practice
  difficulty_tier: number;
  phoneme_position: number | null;
  item_order: number;
  is_active: boolean;
  selection_reason: SelectionReason;
  created_at: string;
}

// Phoneme Result
export interface PhonemeResult {
  phoneme: string; // IPA symbol
  score: number; // 0-100
  readType: number; // 0=correct, 1=mispronounced, 2=omitted, 3=added
  soundLike?: string; // What it sounded like (if mispronounced)
  insertedBefore?: string[]; // Phonemes inserted before this one
  insertedAfter?: string[]; // Phonemes inserted after this one
}

// Word Result (from sentence evaluation)
export interface WordResult {
  text: string;
  score: number;
  phonemes: PhonemeResult[];
}

// Practice Result
export interface PracticeResult {
  id: string;
  practice_item_id: string;
  practice_session_id: string;
  student_id: string;
  pronunciation_session_id: string;
  attempt_number: number;
  pronunciation_score: number; // 0-100
  overall_score?: number; // 0-100 (sentences only)
  fluency_score?: number; // 0-100 (sentences only)
  integrity_score?: number; // 0-100 (sentences only)
  word_results?: WordResult[];
  metadata?: any;
  created_at: string;
}

// Practice Item Progress (view)
export interface PracticeItemProgress {
  practice_item_id: string;
  attempt_count: number;
  best_score: number;
  latest_score: number;
  avg_score: number;
  is_mastered: boolean; // best_score >= 85
}

// Phoneme Attempt (detailed error tracking)
export interface PhonemeAttempt {
  id: string;
  student_id: string;
  pronunciation_session_id: string;
  practice_result_id: string;
  practice_item_id: string;
  target_ipa_symbol: string;
  phoneme_score: number; // 0-100
  read_type: number; // 0-3
  sound_like?: string;
  inserted_before?: string[];
  inserted_after?: string[];
  word_context: string;
  is_target: boolean; // True if this is the phoneme being practiced
  is_baseline: boolean;
  created_at: string;
}

// API Response Types

export interface StartBaselineResponse {
  success: boolean;
  session_id: string;
  is_existing: boolean;
  total_items: number;
  completed_items: number;
  items: PracticeItem[];
}

export interface SubmitWordPracticeResponse {
  resultId: string;
  attemptNumber: number;
  pronunciationScore: number;
  isCorrect: boolean;
  phonemes: PhonemeResult[];
  sessionId: string;
}

export interface SubmitSentencePracticeResponse {
  resultId: string;
  attemptNumber: number;
  pronunciationScore: number;
  overallScore: number;
  fluencyScore: number;
  integrityScore: number;
  isCorrect: boolean;
  wordResults: WordResult[];
  sessionId: string;
  sessionCompleted: boolean;
}

export interface GeneratePracticeResponse {
  sessionId: string;
  itemsCreated: number;
  items: PracticeItem[];
}

export interface PracticeCandidate {
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

// UI State Types
export interface PracticeProgress {
  current: number;
  total: number;
  percentage: number;
}

// Read Type Helper
export const ReadTypeLabels = {
  0: 'Correct',
  1: 'Mispronounced',
  2: 'Omitted',
  3: 'Added'
} as const;

// Score Categories
export function getScoreCategory(score: number): 'excellent' | 'good' | 'fair' | 'poor' {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 60) return 'fair';
  return 'poor';
}

// Score Color Helper
export function getScoreColor(score: number): string {
  const category = getScoreCategory(score);
  switch (category) {
    case 'excellent': return 'text-green-600';
    case 'good': return 'text-blue-600';
    case 'fair': return 'text-yellow-600';
    case 'poor': return 'text-red-600';
  }
}
