import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface PracticeItemWithResult {
  id: string;
  word_text: string | null;
  reference_sentence: string | null;
  practice_type: 'word' | 'sentence';
  target_ipa_symbol: string;
  pronunciation_score: number | null;
  was_correct: boolean | null;
}

export interface CompletedPracticeSession {
  session_id: string;
  student_id: string;
  target_phonemes: string[];
  total_items: number;
  created_at: string;
  completed_at: string;
  overall_avg_score: number | null;
  items: PracticeItemWithResult[];
}

/**
 * Fetch completed practice sessions for a student with detailed items
 */
export function useCompletedPracticeSessions(
  studentId: string | undefined,
  limit = 10
) {
  return useQuery({
    queryKey: ['pronunciation-completed-sessions-with-items', studentId, limit],
    queryFn: async () => {
      if (!studentId) return [];

      // First, get the completed sessions
      const { data: sessions, error: sessionsError } = await supabase
        .from('pronunciation_practice_sessions')
        .select('id, student_id, target_phonemes, total_items, created_at, completed_at')
        .eq('student_id', studentId)
        .eq('status', 'completed')
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(limit);

      if (sessionsError) {
        console.error('Error fetching completed sessions:', sessionsError);
        throw sessionsError;
      }

      if (!sessions || sessions.length === 0) {
        return [];
      }

      // For each session, fetch its items with results
      const sessionsWithItems = await Promise.all(
        sessions.map(async (session) => {
          // Fetch items for this session
          const { data: items, error: itemsError } = await supabase
            .from('pronunciation_practice_items')
            .select('id, word_text, reference_sentence, practice_type, target_ipa_symbol')
            .eq('practice_session_id', session.id)
            .order('created_at', { ascending: true });

          if (itemsError) {
            console.error('Error fetching items:', itemsError);
            return {
              session_id: session.id,
              student_id: session.student_id,
              target_phonemes: session.target_phonemes,
              total_items: session.total_items,
              created_at: session.created_at,
              completed_at: session.completed_at,
              overall_avg_score: null,
              items: [],
            };
          }

          // For each item, get its latest result
          const itemsWithResults = await Promise.all(
            (items || []).map(async (item) => {
              const { data: result } = await supabase
                .from('pronunciation_practice_results')
                .select('pronunciation_score, was_correct')
                .eq('practice_item_id', item.id)
                .order('attempt_number', { ascending: false })
                .limit(1)
                .maybeSingle();

              return {
                ...item,
                pronunciation_score: result?.pronunciation_score || null,
                was_correct: result?.was_correct || null,
              };
            })
          );

          // Calculate overall average score
          const scores = itemsWithResults
            .map(item => item.pronunciation_score)
            .filter((score): score is number => score !== null);
          
          const overall_avg_score = scores.length > 0
            ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
            : null;

          return {
            session_id: session.id,
            student_id: session.student_id,
            target_phonemes: session.target_phonemes,
            total_items: session.total_items,
            created_at: session.created_at,
            completed_at: session.completed_at,
            overall_avg_score,
            items: itemsWithResults,
          };
        })
      );

      return sessionsWithItems as CompletedPracticeSession[];
    },
    enabled: !!studentId,
    staleTime: 30000,
  });
}
