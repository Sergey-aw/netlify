/**
 * Phase 9: Baseline Workout Hook
 * Starts and manages baseline workout sessions
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface BaselineWorkoutItem {
  item_id: string;
  reference_sentence: string;
  item_order: number;
}

export interface BaselineWorkoutSession {
  session_id: string;
  is_existing: boolean;
  total_items: number;
  completed_items: number;
  items: BaselineWorkoutItem[];
}

export interface ExistingBaselineSession {
  id: string;
  status: string;
  created_at: string;
  total_items: number;
  completed_items: number;
}

export function useBaselineWorkout(studentId: string | undefined) {
  const queryClient = useQueryClient();

  // Query for existing active baseline session
  const existingSessionQuery = useQuery({
    queryKey: ['pronunciation-baseline-session', studentId],
    queryFn: async (): Promise<ExistingBaselineSession | null> => {
      if (!studentId) return null;

      const { data, error } = await supabase
        .from('pronunciation_practice_sessions')
        .select('id, status, created_at, total_items, completed_items')
        .eq('student_id', studentId)
        .eq('is_baseline', true)
        .in('status', ['pending', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching baseline session:', error);
        throw error;
      }

      return data;
    },
    enabled: !!studentId,
    staleTime: 30000,
  });

  // Mutation to start baseline workout
  const startMutation = useMutation({
    mutationFn: async (): Promise<BaselineWorkoutSession> => {
      const { data, error } = await supabase.functions.invoke(
        'pronunciation-start-baseline-workout'
      );

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Failed to start baseline workout');
      }

      return {
        session_id: data.session_id,
        is_existing: data.is_existing,
        total_items: data.total_items,
        completed_items: data.completed_items,
        items: data.items,
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pronunciation-baseline-session'] });
      queryClient.invalidateQueries({ queryKey: ['pronunciation-active-sessions'] });
      
      if (data.is_existing) {
        toast.info('Resuming your baseline workout');
      } else {
        toast.success('Baseline Workout started');
      }
    },
    onError: (error) => {
      console.error('Failed to start baseline workout:', error);
      toast.error('Failed to start baseline workout');
    },
  });

  return {
    existingSession: existingSessionQuery.data,
    isLoading: existingSessionQuery.isLoading,
    hasActiveBaseline: !!existingSessionQuery.data,
    startBaselineWorkout: startMutation.mutateAsync,
    isStarting: startMutation.isPending,
  };
}
