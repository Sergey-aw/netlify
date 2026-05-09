import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

interface WeeklyFocusTarget {
  weekly_focus_points: number;
  weekly_focus_target: number;
  week_start: string;
  week_end: string;
}

export function useWeeklyFocusTarget(studentId?: string) {
  const { user } = useAuth();
  const effectiveStudentId = studentId || user?.id;

  return useQuery({
    queryKey: ['weekly-focus-target', effectiveStudentId],
    queryFn: async () => {
      if (!effectiveStudentId) throw new Error('Student ID required');
      
      const { data, error } = await supabase.rpc('get_weekly_focus_target', {
        student_uuid: effectiveStudentId,
      });

      if (error) throw error;
      
      // Fallback if RPC doesn't exist yet
      if (!data) {
        return {
          weekly_focus_points: 0,
          weekly_focus_target: 10,
          week_start: new Date().toISOString(),
          week_end: new Date().toISOString(),
        };
      }
      
      return data as WeeklyFocusTarget;
    },
    enabled: !!effectiveStudentId,
    staleTime: 60000, // 1 minute
  });
}
