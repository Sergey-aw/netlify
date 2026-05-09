import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

interface CEFRProgress {
  acquired: number;
  total: number;
  pct: number;
}

export interface StudentVocabularyOverview {
  total_words: number;
  unique_words: number;
  in_progress_count: number;
  acquired_count: number;
  cefr_progress: {
    [level: string]: CEFRProgress;
  };
}

export function useStudentVocabularyOverview(studentId?: string) {
  return useQuery({
    queryKey: ['student-vocabulary-overview', studentId],
    queryFn: async () => {
      if (!studentId) {
        throw new Error('Student ID is required');
      }

      const { data, error } = await supabase.rpc('get_student_vocab_overview_v4', {
        student_uuid: studentId,
      });

      if (error) {
        console.error('Error fetching vocabulary overview:', error);
        throw error;
      }

      return data as StudentVocabularyOverview;
    },
    enabled: !!studentId,
    staleTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
  });
}
