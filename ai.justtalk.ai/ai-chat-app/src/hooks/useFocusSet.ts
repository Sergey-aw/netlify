import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export interface FocusSetWord {
  id: string;
  lexeme_id: string;
  lemma: string;
  pos: string;
  cefr_level: string | null;
  lesson_count: number;       // Global usage (activation dots)
  focus_lesson_count: number; // Focus usage (points)
  is_stable: boolean;
  priority_rank: number;
}

export type LessonStatus = 'scheduled' | 'in_progress' | 'completed';

interface UseFocusSetOptions {
  studentId?: string;
  lessonId?: string;
  lessonStatus?: LessonStatus;
  enabled?: boolean;
}

/**
 * Unified hook for Focus Set display across all surfaces.
 * 
 * Behavior:
 * - For scheduled/future lessons or no lesson context: returns live Focus Set
 * - For in_progress or completed lessons: returns snapshot frozen at lesson start
 * 
 * Invariant: Stable words are never returned (filtered at RPC level)
 */
export function useFocusSet({
  studentId,
  lessonId,
  lessonStatus = 'scheduled',
  enabled = true
}: UseFocusSetOptions = {}) {
  const { user } = useAuth();
  const effectiveStudentId = studentId || user?.id;

  const {
    data: words = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['focus-set', effectiveStudentId, lessonId, lessonStatus],
    queryFn: async (): Promise<FocusSetWord[]> => {
      if (!effectiveStudentId) return [];

      const { data, error } = await (supabase as any).rpc('get_focus_set_for_lesson', {
        student_uuid: effectiveStudentId,
        lesson_uuid: lessonId || null,
        lesson_status: lessonStatus
      });

      if (error) {
        console.error('Error fetching focus set:', error);
        throw error;
      }

      // Map RPC response to FocusSetWord interface
      return (data || []).map((row: any) => ({
        id: row.id,
        lexeme_id: row.lexeme_id,
        lemma: row.lemma,
        pos: row.pos,
        cefr_level: row.cefr_level,
        lesson_count: row.lesson_count ?? 0,
        focus_lesson_count: row.focus_lesson_count ?? 0,
        is_stable: row.is_stable ?? false,
        priority_rank: row.priority_rank ?? 0
      }));
    },
    enabled: enabled && !!effectiveStudentId,
    staleTime: 30000,
  });

  // Determine if this is a snapshot view (read-only historical data)
  const isSnapshot = !!lessonId && (lessonStatus === 'in_progress' || lessonStatus === 'completed');

  return {
    words,
    isLoading,
    error,
    refetch,
    isSnapshot,
    emptySlots: Math.max(0, 5 - words.length),
    isFull: words.length >= 5,
  };
}
