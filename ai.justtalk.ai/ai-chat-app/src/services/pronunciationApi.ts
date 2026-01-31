// Pronunciation API Service
// Calls existing edge functions documented in PRONUNCIATION_SYSTEM_MOBILE_API.md

import { supabase } from '@/lib/supabase';
import type {
  PracticeSession,
  PracticeItem,
  PracticeResult,
  StartBaselineResponse,
  SubmitWordPracticeResponse,
  SubmitSentencePracticeResponse,
  PracticeItemProgress,
  PracticeCandidate
} from '@/types/pronunciation';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

/**
 * Check if user has completed a baseline workout
 */
export async function checkBaselineStatus(studentId: string): Promise<{
  hasBaseline: boolean;
  session: PracticeSession | null;
}> {
  const { data, error } = await supabase
    .from('pronunciation_practice_sessions')
    .select('*')
    .eq('student_id', studentId)
    .eq('is_baseline', true)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Error checking baseline status:', error);
    throw error;
  }

  if (!data || data.length === 0) {
    return { hasBaseline: false, session: null };
  }

  const baseline = data[0] as PracticeSession;
  
  // Check if baseline was completed in last 30 days
  const completedAt = baseline.completed_at ? new Date(baseline.completed_at) : null;
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const isRecent = completedAt && completedAt > thirtyDaysAgo;
  
  return {
    hasBaseline: baseline.status === 'completed' && !!isRecent,
    session: baseline
  };
}

/**
 * Start a new baseline workout (10 sentences)
 */
export async function startBaselineWorkout(studentId: string): Promise<StartBaselineResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/pronunciation-start-baseline-workout`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ studentId })
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to start baseline workout');
  }

  return await response.json();
}

/**
 * Generate targeted practice session
 * Creates practice items based on identified weak phonemes
 */
export async function generatePracticeSession(
  studentId: string,
  targetPhonemes: string[]
): Promise<{
  session_id: string;
  total_items: number;
  items: PracticeItem[];
}> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  // Normalize IPA symbols by removing length markers (: or ː)
  // The baseline stats may include length markers but ipa_lexicon uses base symbols
  const normalizedPhonemes = targetPhonemes.map(p => p.replace(/[ːː:]/g, ''));

  console.log('🎯 Original phonemes:', targetPhonemes);
  console.log('🎯 Normalized phonemes:', normalizedPhonemes);

  // Step 1: Create a session record with target phonemes (use normalized)
  const { data: newSession, error: sessionError } = await supabase
    .from('pronunciation_practice_sessions')
    .insert({
      student_id: studentId,
      is_baseline: false,
      target_phonemes: normalizedPhonemes,
      status: 'in_progress',
      started_at: new Date().toISOString()
    })
    .select()
    .single();

  if (sessionError || !newSession) {
    throw new Error('Failed to create practice session: ' + sessionError?.message);
  }

  // Step 2: Call edge function to generate practice items
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/pronunciation-generate-practice`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        sessionId: newSession.id
      })
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to generate practice items');
  }

  const result = await response.json();
  
  // Step 3: Fetch the generated items from the database
  const { data: items, error: itemsError } = await supabase
    .from('pronunciation_practice_items')
    .select('*')
    .eq('practice_session_id', newSession.id)
    .eq('is_active', true)
    .order('item_order');

  if (itemsError) {
    console.error('Error fetching generated items:', itemsError);
    throw new Error('Failed to fetch practice items: ' + itemsError.message);
  }
  
  return {
    session_id: newSession.id,
    total_items: result.totalItems || items?.length || 0,
    items: items || []
  };
}

/**
 * Get practice items for a session
 */
export async function getPracticeItems(sessionId: string): Promise<PracticeItem[]> {
  const { data, error } = await supabase
    .from('pronunciation_practice_items')
    .select('*')
    .eq('practice_session_id', sessionId)
    .eq('is_active', true)
    .order('item_order');

  if (error) {
    console.error('Error fetching practice items:', error);
    throw error;
  }

  return data as PracticeItem[];
}

/**
 * Get practice items with their latest results
 */
export async function getPracticeItemsWithResults(sessionId: string): Promise<{
  items: PracticeItem[];
  results: Map<string, PracticeResult>;
}> {
  // Fetch items
  const items = await getPracticeItems(sessionId);
  
  // Fetch all results for this session
  const { data: resultsData, error: resultsError } = await supabase
    .from('pronunciation_practice_results')
    .select('*')
    .eq('practice_session_id', sessionId)
    .order('created_at', { ascending: false });

  if (resultsError) {
    console.error('Error fetching practice results:', resultsError);
    throw resultsError;
  }

  // Build a map of item_id -> latest result
  const results = new Map<string, PracticeResult>();
  const seenItems = new Set<string>();
  
  for (const result of (resultsData || [])) {
    if (!seenItems.has(result.practice_item_id)) {
      results.set(result.practice_item_id, result as PracticeResult);
      seenItems.add(result.practice_item_id);
    }
  }

  console.log(`Loaded ${items.length} items with ${results.size} existing results`);
  
  return { items, results };
}

/**
 * Submit word practice audio
 */
export async function submitWordPractice(
  practiceItemId: string,
  audioBlob: Blob
): Promise<SubmitWordPracticeResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const formData = new FormData();
  formData.append('practice_item_id', practiceItemId);
  formData.append('audio', audioBlob, 'recording.wav');

  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/pronunciation-submit-word-practice`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      },
      body: formData
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to submit word practice');
  }

  return await response.json();
}

/**
 * Submit sentence practice audio
 */
export async function submitSentencePractice(
  practiceItemId: string,
  audioBlob: Blob
): Promise<SubmitSentencePracticeResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const formData = new FormData();
  formData.append('practice_item_id', practiceItemId);
  formData.append('audio', audioBlob, 'recording.wav');

  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/pronunciation-submit-sentence-practice`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      },
      body: formData
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to submit sentence practice');
  }

  return await response.json();
}

/**
 * Get practice session details
 */
export async function getPracticeSession(sessionId: string): Promise<PracticeSession | null> {
  const { data, error } = await supabase
    .from('pronunciation_practice_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (error) {
    console.error('Error fetching session:', error);
    return null;
  }

  return data as PracticeSession;
}

/**
 * Get practice progress for items
 */
export async function getPracticeProgress(sessionId: string): Promise<{
  items: Array<PracticeItem & { progress?: PracticeItemProgress }>;
  session: PracticeSession;
}> {
  // Get session
  const session = await getPracticeSession(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  // Get items
  const items = await getPracticeItems(sessionId);

  // Get progress for each item from view
  const { data: progressData, error: progressError } = await supabase
    .from('pronunciation_practice_item_progress')
    .select('*')
    .in('practice_item_id', items.map(i => i.id));

  if (progressError) {
    console.error('Error fetching progress:', progressError);
  }

  // Merge progress with items
  const progressMap = new Map(
    (progressData || []).map((p: any) => [p.practice_item_id, p])
  );

  const itemsWithProgress = items.map(item => ({
    ...item,
    progress: progressMap.get(item.id)
  }));

  return { items: itemsWithProgress, session };
}

/**
 * Get all practice sessions for a student
 */
export async function getStudentSessions(studentId: string): Promise<PracticeSession[]> {
  const { data, error } = await supabase
    .from('pronunciation_practice_sessions')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching sessions:', error);
    throw error;
  }

  return data as PracticeSession[];
}

/**
 * Get baseline workout summary for a student
 */
export async function getBaselineSummary(studentId: string) {
  const { data, error } = await supabase
    .from('pronunciation_baseline_workout_summary')
    .select('*')
    .eq('student_id', studentId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching baseline summary:', error);
    throw error;
  }

  return data;
}

/**
 * Get practice candidates for targeted practice
 * Uses pronunciation_ipa_practice_candidates view (aggregates all attempts, not just baseline)
 */
export async function getPracticeCandidates(studentId: string): Promise<PracticeCandidate[]> {
  const { data, error } = await supabase
    .from('pronunciation_ipa_practice_candidates')
    .select('*')
    .eq('student_id', studentId)
    .order('error_rate', { ascending: false });

  if (error) {
    console.error('Error fetching practice candidates:', error);
    throw error;
  }

  return (data || []) as PracticeCandidate[];
}

/**
 * Get baseline phoneme error statistics for a student
 */
export async function getBaselinePhonemeStats(studentId: string) {
  const { data, error } = await supabase
    .from('pronunciation_baseline_phoneme_stats')
    .select('*')
    .eq('student_id', studentId)
    .order('error_rate', { ascending: false });

  if (error) {
    console.error('Error fetching baseline phoneme stats:', error);
    throw error;
  }

  return data || [];
}

/**
 * Legacy function - kept for compatibility
 * @deprecated Use getPracticeCandidates for ongoing practice or getBaselinePhonemeStats for baseline review
 */
export async function getPhonemeStats(_studentId: string): Promise<Array<{
  phoneme: string;
  avg_score: number;
  attempt_count: number;
  success_rate: number;
}>> {
  console.warn('getPhonemeStats is deprecated, use getPracticeCandidates or getBaselinePhonemeStats');
  return [];
}
