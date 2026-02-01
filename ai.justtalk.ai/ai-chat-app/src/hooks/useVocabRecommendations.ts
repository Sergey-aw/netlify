import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import { addVocabGoal } from '@/lib/goals';

export interface VocabRecommendation {
  id: number;
  lemma: string;
  pos: string;
  cefr_level: string | null;
  lexeme_id: string;
  reason: string;
}

interface UseVocabRecommendationsResult {
  recommendations: VocabRecommendation[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  addToGoals: (recommendation: VocabRecommendation) => Promise<void>;
  isRefreshing: boolean;
  isAdding: boolean;
  isEmpty: boolean;
}

export function useVocabRecommendations(
  studentId?: string
): UseVocabRecommendationsResult {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const effectiveStudentId = studentId || user?.id;

  // Fetch existing recommendations
  const {
    data: recommendations = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['vocab-recommendations', effectiveStudentId],
    queryFn: async () => {
      if (!effectiveStudentId) return [];

      // First, try to get existing recommendations
      const { data, error } = await supabase.rpc('get_ready_recommendations', {
        student_uuid: effectiveStudentId,
        limit_val: 5,
      });

      if (error) throw error;

      // If we have recommendations, return them
      if (data && data.length > 0) {
        return data.map((rec: any) => ({
          id: rec.id,
          lemma: rec.lemma,
          pos: rec.pos,
          cefr_level: rec.cefr_level,
          lexeme_id: rec.lexeme_id,
          reason: rec.reason?.text || '',
        }));
      }

      // If no recommendations exist, trigger AI selection
      // This will be handled by the refresh mutation on initial mount
      return [];
    },
    enabled: !!effectiveStudentId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Mutation to trigger AI selection (initial or refresh)
  const refreshMutation = useMutation({
    mutationFn: async (action: 'select' | 'refresh' = 'select') => {
      if (!effectiveStudentId) throw new Error('No student ID');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vocab-select-recommendations`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            studentId: effectiveStudentId,
            action,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to get recommendations');
      }

      const result = await response.json();
      return result.recommendations;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['vocab-recommendations', effectiveStudentId],
      });
    },
    onError: (error: any) => {
      console.error('Error getting recommendations:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to get recommendations',
        variant: 'destructive',
      });
    },
  });

  // Mutation to add recommendation to goals
  const addToGoalsMutation = useMutation({
    mutationFn: async (recommendation: VocabRecommendation) => {
      if (!effectiveStudentId) throw new Error('No student ID');

      // Add to student_goals
      await addVocabGoal(effectiveStudentId, recommendation.lexeme_id);

      // Mark recommendation as 'added'
      const { error } = await supabase.rpc('mark_recommendation_status', {
        rec_id: recommendation.id,
        new_status: 'added',
      });

      if (error) throw error;

      return recommendation;
    },
    onSuccess: (recommendation) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({
        queryKey: ['vocab-recommendations', effectiveStudentId],
      });
      queryClient.invalidateQueries({
        queryKey: ['vocabulary-builder', effectiveStudentId],
      });
      queryClient.invalidateQueries({
        queryKey: ['vocabulary-builder-stats', effectiveStudentId],
      });

      toast({
        title: 'Added to Goals',
        description: `"${recommendation.lemma}" added to your Goal Pool`,
      });
    },
    onError: (error: any) => {
      // Ignore duplicate key errors (23505)
      if (error.code === '23505') {
        toast({
          title: 'Already in Goals',
          description: 'This word is already in your Goal Pool',
        });
        return;
      }

      console.error('Error adding to goals:', error);
      toast({
        title: 'Error',
        description: 'Failed to add word to goals',
        variant: 'destructive',
      });
    },
  });

  // Trigger initial AI selection if no recommendations exist
  const isEmpty = !isLoading && recommendations.length === 0;

  // Auto-trigger AI selection on first mount if empty
  if (isEmpty && !refreshMutation.isPending && !refreshMutation.isSuccess) {
    refreshMutation.mutate('select');
  }

  return {
    recommendations,
    isLoading: isLoading || (isEmpty && refreshMutation.isPending),
    error: error as Error | null,
    refresh: async () => {
      await refreshMutation.mutateAsync('refresh');
    },
    addToGoals: async (recommendation: VocabRecommendation) => {
      await addToGoalsMutation.mutateAsync(recommendation);
    },
    isRefreshing: refreshMutation.isPending,
    isAdding: addToGoalsMutation.isPending,
    isEmpty,
  };
}
