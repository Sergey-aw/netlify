import { getPostHog } from './posthog';

/**
 * JustTalk analytics. Thin wrappers over PostHog `capture`, mirroring the IELTS
 * coach events. Property names are snake_case to match the rest of the project.
 */

function capture(event: string, properties?: Record<string, unknown>) {
  const ph = getPostHog();
  ph?.capture(event, properties);
}

export const trackJustTalkOpened = () => capture('justtalk_opened');

export const trackJustTalkSessionStarted = (p: { sessionId: string }) =>
  capture('justtalk_session_started', { session_id: p.sessionId });

export const trackJustTalkSessionEnded = (p: {
  sessionId: string;
  durationSeconds: number;
  coachMessageCount: number;
  studentMessageCount: number;
}) =>
  capture('justtalk_session_ended', {
    session_id: p.sessionId,
    duration_seconds: p.durationSeconds,
    coach_message_count: p.coachMessageCount,
    student_message_count: p.studentMessageCount,
  });

export const trackJustTalkSessionError = (p: { error: string }) =>
  capture('justtalk_session_error', { error: p.error });

export const trackJustTalkTranscriptViewed = (p: { sessionId: string }) =>
  capture('justtalk_transcript_viewed', { session_id: p.sessionId });
