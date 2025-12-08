import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchVocabSets,
  fetchVocabSetWords,
  bulkAddVocabGoals
} from '@/lib/goals';

interface UseVocabSetsOptions {
  studentId?: string;
  enabled?: boolean;
}

export function useVocabSets({
  studentId,
  enabled = true
}: UseVocabSetsOptions = {}) {
  const { user } = useAuth();
  const effectiveStudentId = studentId || user?.id;

  // Fetch all vocabulary sets
  const {
    data: sets = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['vocab-sets', effectiveStudentId],
    queryFn: () => fetchVocabSets(effectiveStudentId!),
    enabled: enabled && !!effectiveStudentId,
    staleTime: 60000, // Cache for 1 minute
  });

  return {
    sets,
    isLoading,
    error,
    refetch,
  };
}

interface UseVocabSetWordsOptions {
  studentId?: string;
  setId: string;
  enabled?: boolean;
}

export function useVocabSetWords({
  studentId,
  setId,
  enabled = true
}: UseVocabSetWordsOptions) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const effectiveStudentId = studentId || user?.id;

  // Fetch words in a specific set
  const {
    data: words = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['vocab-set-words', effectiveStudentId, setId],
    queryFn: () => fetchVocabSetWords(effectiveStudentId!, setId),
    enabled: enabled && !!effectiveStudentId && !!setId,
    staleTime: 30000,
  });

  // Bulk add words from set to active goals
  const bulkAddMutation = useMutation({
    mutationFn: async ({ lexemeIds, isActive }: { lexemeIds: string[]; isActive: boolean }) => {
      if (!effectiveStudentId) throw new Error('Student ID required');
      return bulkAddVocabGoals(
        effectiveStudentId,
        lexemeIds,
        [], // target_codes not needed
        isActive
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vocabulary-builder', effectiveStudentId] });
      queryClient.invalidateQueries({ queryKey: ['vocabulary-builder-stats', effectiveStudentId] });
      queryClient.invalidateQueries({ queryKey: ['vocab-set-words', effectiveStudentId] });
      queryClient.invalidateQueries({ queryKey: ['vocab-sets', effectiveStudentId] });
    },
    onError: (error: any) => {
      console.error('Error bulk adding words:', error);
    },
  });

  return {
    words,
    isLoading,
    error,
    refetch,
    bulkAddWords: (lexemeIds: string[], isActive: boolean = true) => 
      bulkAddMutation.mutate({ lexemeIds, isActive }),
    isAdding: bulkAddMutation.isPending,
  };
}
