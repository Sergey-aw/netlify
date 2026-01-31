/**
 * Phase 6: Pronunciation UI Components
 * Export all pronunciation-related components
 * Phase 8.2: Added WordPracticeRecorder and useSubmitWordPractice
 * Phase 8.2b: Added PhonemeAccuracyBreakdown
 * Phase 8.3: Added PracticeSessionFlow, SentencePracticeRecorder, SessionResultsScreen
 * Phase 8.4: Added NextPracticeSessionCard, FocusSoundPicker, useNextPracticeTargets
 * Phase 9: Added Baseline Workout components (replaces Calibration)
 * 
 * DEPRECATION NOTE (Phase B):
 * - Legacy Calibration components removed from exports
 * - Legacy edge functions return 410 Gone
 * - pronunciation_phoneme_aggregates table dropped
 * - Use Baseline Workout flow for onboarding
 * - Use useIPAPracticeCandidates for phoneme stats
 */

// Types
export * from './types';

// Hooks - Active
export * from './hooks/usePronunciationData';
export * from './hooks/useSubmitWordPractice';
export * from './hooks/useSubmitSentencePractice';
export * from './hooks/useNextPracticeTargets';
export * from './hooks/useCompletePracticeSession';
export * from './hooks/useCompletedPracticeSessions';
export * from './hooks/useIPAPracticeCandidates';

// Phase 9: Baseline hooks
export * from './hooks/useBaselineWorkout';
export * from './hooks/useBaselineSummary';

// Phase 9: Baseline Workout components (primary onboarding flow)
export { BaselinePromptCard } from './BaselinePromptCard';
export { BaselineResultsCard } from './BaselineResultsCard';
export { BaselineWorkoutFlow } from './BaselineWorkoutFlow';
export { BaselineResultsScreen } from './BaselineResultsScreen';

// Active components - Focus Sounds & Practice
export { FocusSoundsSection } from './FocusSoundsSection';
export { useFocusSounds } from './hooks/useFocusSounds';
export { PracticeSessionCard } from './PracticeSessionCard';
export { PracticeItemsList } from './PracticeItemsList';
export { WordPracticeRecorder } from './WordPracticeRecorder';
export { PhonemeAccuracyBreakdown } from './PhonemeAccuracyBreakdown';
export { PronunciationPage } from './PronunciationPage';

// Phase 8.3: Session flow components
export { SentencePracticeRecorder } from './SentencePracticeRecorder';
export { PracticeSessionFlow } from './PracticeSessionFlow';
export { SessionResultsScreen } from './SessionResultsScreen';
export { SentencePhonemeResults } from './SentencePhonemeResults';

// Phase 8.4: Target selection components
export { NextPracticeSessionCard } from './NextPracticeSessionCard';
export { FocusSoundPicker } from './FocusSoundPicker';

// Phase 8.4.1: Legacy session handling
export { LegacySessionBanner } from './LegacySessionBanner';
export { useArchiveSession, filterValidSessions, isLegacySession } from './hooks/useArchiveLegacySession';

// Phase 8.5: Past sessions
export { PastSessionsList } from './PastSessionsList';
export { PastSessionCard } from './PastSessionCard';

// ============================================================
// DEPRECATED - Legacy Calibration Components (DELETED)
// ============================================================
// Phase C: Legacy calibration components have been deleted.
// The Baseline Workout flow is the only supported onboarding path.
// Legacy edge functions return HTTP 410 Gone.
// Legacy tables renamed to *_deprecated.
// ============================================================
