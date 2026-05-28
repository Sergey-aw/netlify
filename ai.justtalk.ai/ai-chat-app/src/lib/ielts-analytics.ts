import { getPostHog } from './posthog';
import type { CoachMode, IeltsScore } from '@/services/ielts.service';

/**
 * IELTS Speaking analytics. Thin wrappers over PostHog `capture`, kept together
 * so the IELTS funnel (catalog → test → examiner → results → coach) is easy to
 * reason about. Property names are snake_case to match the rest of the project's
 * events.
 */

function capture(event: string, properties?: Record<string, unknown>) {
  const ph = getPostHog();
  ph?.capture(event, properties);
}

function bandProps(score: IeltsScore) {
  const overall =
    Math.round(
      ((score.pronunciation_band +
        score.fluency_band +
        score.lexical_band +
        score.grammar_band) /
        4) *
        2,
    ) / 2;
  return {
    overall_band: overall,
    pronunciation_band: score.pronunciation_band,
    fluency_band: score.fluency_band,
    lexical_band: score.lexical_band,
    grammar_band: score.grammar_band,
  };
}

// ============================================================
// Catalog / navigation
// ============================================================

export const trackIeltsCatalogViewed = (themeCount: number) =>
  capture('ielts_catalog_viewed', { theme_count: themeCount });

export const trackIeltsCategoryViewed = (
  slug: string,
  theme: string,
  testCount: number,
) =>
  capture('ielts_category_viewed', {
    slug,
    theme,
    test_count: testCount,
  });

export const trackIeltsTestViewed = (
  testId: string,
  theme: string,
  ordering: number,
) =>
  capture('ielts_test_viewed', {
    test_id: testId,
    theme,
    ordering,
  });

// ============================================================
// Examiner
// ============================================================

export const trackIeltsExaminerStarted = (p: {
  testId: string;
  theme: string;
  partNumber: 1 | 2 | 3;
  attemptId: string;
  attemptNumber: number;
  resumed: boolean;
  totalQuestions: number;
}) =>
  capture('ielts_examiner_started', {
    test_id: p.testId,
    theme: p.theme,
    part_number: p.partNumber,
    attempt_id: p.attemptId,
    attempt_number: p.attemptNumber,
    resumed: p.resumed,
    total_questions: p.totalQuestions,
  });

export const trackIeltsRecordingStarted = (p: {
  testId: string;
  partNumber: 1 | 2 | 3;
  attemptId: string;
  questionId: string;
  questionIndex: number;
}) =>
  capture('ielts_recording_started', {
    test_id: p.testId,
    part_number: p.partNumber,
    attempt_id: p.attemptId,
    question_id: p.questionId,
    question_index: p.questionIndex,
  });

export const trackIeltsAnswerRecorded = (p: {
  testId: string;
  partNumber: 1 | 2 | 3;
  attemptId: string;
  questionId: string;
  questionIndex: number;
  autoStopped: boolean;
}) =>
  capture('ielts_answer_recorded', {
    test_id: p.testId,
    part_number: p.partNumber,
    attempt_id: p.attemptId,
    question_id: p.questionId,
    question_index: p.questionIndex,
    auto_stopped: p.autoStopped,
  });

export const trackIeltsResponseScored = (p: {
  attemptId: string;
  questionId: string;
  success: boolean;
  error?: string;
}) =>
  capture('ielts_response_scored', {
    attempt_id: p.attemptId,
    question_id: p.questionId,
    success: p.success,
    ...(p.error ? { error: p.error } : {}),
  });

export const trackIeltsExaminerCompleted = (p: {
  testId: string;
  partNumber: 1 | 2 | 3;
  attemptId: string;
  totalQuestions: number;
  scoredCount: number;
}) =>
  capture('ielts_examiner_completed', {
    test_id: p.testId,
    part_number: p.partNumber,
    attempt_id: p.attemptId,
    total_questions: p.totalQuestions,
    scored_count: p.scoredCount,
  });

// ============================================================
// Results
// ============================================================

export const trackIeltsResultsViewed = (p: {
  attemptId: string;
  testId: string;
  partNumber: 1 | 2 | 3;
  attemptNumber: number;
  responseCount: number;
  score: IeltsScore;
}) =>
  capture('ielts_results_viewed', {
    attempt_id: p.attemptId,
    test_id: p.testId,
    part_number: p.partNumber,
    attempt_number: p.attemptNumber,
    response_count: p.responseCount,
    ...bandProps(p.score),
  });

export const trackIeltsPartFinalized = (p: {
  attemptId: string;
  testId: string;
  partNumber: 1 | 2 | 3;
  score: IeltsScore;
}) =>
  capture('ielts_part_finalized', {
    attempt_id: p.attemptId,
    test_id: p.testId,
    part_number: p.partNumber,
    ...bandProps(p.score),
  });

export const trackIeltsTestFinalized = (p: {
  testId: string;
  score: IeltsScore;
}) =>
  capture('ielts_test_finalized', {
    test_id: p.testId,
    ...bandProps(p.score),
  });

// ============================================================
// Coach
// ============================================================

export const trackIeltsCoachOpened = (p: {
  mode: CoachMode;
  testId: string;
  partNumber?: 1 | 2 | 3;
  hasTargetMoment?: boolean;
}) =>
  capture('ielts_coach_opened', {
    mode: p.mode,
    test_id: p.testId,
    ...(p.partNumber ? { part_number: p.partNumber } : {}),
    ...(p.hasTargetMoment != null ? { has_target_moment: p.hasTargetMoment } : {}),
  });

export const trackIeltsCoachSessionStarted = (p: {
  mode: CoachMode;
  coachSessionId: string;
  testId: string;
  partNumber?: 1 | 2 | 3;
  attemptId?: string | null;
}) =>
  capture('ielts_coach_session_started', {
    mode: p.mode,
    coach_session_id: p.coachSessionId,
    test_id: p.testId,
    ...(p.partNumber ? { part_number: p.partNumber } : {}),
    ...(p.attemptId ? { attempt_id: p.attemptId } : {}),
  });

export const trackIeltsCoachSessionEnded = (p: {
  mode: CoachMode;
  coachSessionId: string;
  testId: string;
  partNumber?: 1 | 2 | 3;
  durationSeconds: number;
  coachMessageCount: number;
  studentMessageCount: number;
}) =>
  capture('ielts_coach_session_ended', {
    mode: p.mode,
    coach_session_id: p.coachSessionId,
    test_id: p.testId,
    ...(p.partNumber ? { part_number: p.partNumber } : {}),
    duration_seconds: p.durationSeconds,
    duration_minutes: Math.round(p.durationSeconds / 60),
    coach_message_count: p.coachMessageCount,
    student_message_count: p.studentMessageCount,
    message_count: p.coachMessageCount + p.studentMessageCount,
  });

export const trackIeltsCoachSessionError = (p: {
  mode: CoachMode;
  testId: string;
  partNumber?: 1 | 2 | 3;
  error: string;
}) =>
  capture('ielts_coach_session_error', {
    mode: p.mode,
    test_id: p.testId,
    ...(p.partNumber ? { part_number: p.partNumber } : {}),
    error: p.error,
  });

export const trackIeltsCoachSuggestionSent = (p: {
  mode: CoachMode;
  suggestion: string;
}) =>
  capture('ielts_coach_suggestion_sent', {
    mode: p.mode,
    suggestion: p.suggestion,
  });

export const trackIeltsCoachRetryRequested = (p: {
  testId: string;
  partNumber: 1 | 2 | 3;
  attemptId: string;
  category?: string;
}) =>
  capture('ielts_coach_retry_requested', {
    test_id: p.testId,
    part_number: p.partNumber,
    attempt_id: p.attemptId,
    ...(p.category ? { category: p.category } : {}),
  });
