import { supabase } from '@/lib/supabase';
import { getConversationTranscript } from '@/lib/justai-api';

export interface JustTalkStartResult {
  session_id: string;
  signed_url: string;
  dynamic_variables: Record<string, string>;
}

export interface JustTalkSessionRow {
  id: string;
  elevenlabs_conversation_id: string | null;
  title: string | null;
  transcript_summary: string | null;
  collected_data: Array<{ name: string; value: unknown; rationale?: string }> | null;
  started_at: string;
  ended_at: string | null;
}

/** Start a JustTalk session — server builds snapshot + memory and returns a signed URL. */
export async function startJustTalkSession(): Promise<JustTalkStartResult> {
  const { data, error } = await supabase.functions.invoke<JustTalkStartResult>(
    'justtalk-start',
    { body: {} },
  );
  if (error) throw error;
  if (!data) throw new Error('Empty response from justtalk-start.');
  return data;
}

/** Persist the ElevenLabs conversation_id once the live session connects (RLS-gated). */
export async function updateJustTalkConversationId(
  sessionId: string,
  conversationId: string,
): Promise<void> {
  const { error } = await supabase
    .from('justtalk_session')
    .update({ elevenlabs_conversation_id: conversationId })
    .eq('id', sessionId);
  if (error) throw error;
}

/** List the student's past JustTalk sessions, most recent first (RLS-scoped). */
export async function listJustTalkSessions(): Promise<JustTalkSessionRow[]> {
  const { data, error } = await supabase
    .from('justtalk_session')
    .select('id, elevenlabs_conversation_id, title, transcript_summary, collected_data, started_at, ended_at')
    .order('started_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as JustTalkSessionRow[];
}

/** Fetch a past conversation's full transcript on demand from ElevenLabs. */
export async function getJustTalkTranscript(elevenConvId: string) {
  return getConversationTranscript(elevenConvId);
}
