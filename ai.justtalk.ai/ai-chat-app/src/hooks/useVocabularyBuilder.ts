import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import {
  fetchVocabularyBuilder,
  fetchVocabBuilderStats,
  addVocabGoal,
  archiveVocabGoal,
  unarchiveVocabGoal,
  toggleVocabActiveStatus,
  swapFocusWords,
  bulkAddVocabGoals,
  type VocabularyBuilderFilters
} from '@/lib/goals';

interface UseVocabularyBuilderOptions {
  studentId?: string;
  filters?: VocabularyBuilderFilters;
  limit?: number;
  offset?: number;
  enabled?: boolean;
}

export function useVocabularyBuilder({
  studentId,
  filters = {},
  limit = 1000,
  offset = 0,
  enabled = true
}: UseVocabularyBuilderOptions = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const effectiveStudentId = studentId || user?.id;

  // Fetch vocabulary builder words
  const {
    data: words = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['vocabulary-builder', effectiveStudentId, filters, limit, offset],
    queryFn: () => fetchVocabularyBuilder(effectiveStudentId!, filters, limit, offset),
    enabled: enabled && !!effectiveStudentId,
    staleTime: 30000,
  });

  // Fetch stats for badge counts
  const {
    data: statsData
  } = useQuery({
    queryKey: ['vocabulary-builder-stats', effectiveStudentId],
    queryFn: () => fetchVocabBuilderStats(effectiveStudentId!),
    enabled: enabled && !!effectiveStudentId,
    staleTime: 30000,
  });

  // Add word to vocabulary builder
  const addWordMutation = useMutation({
    mutationFn: async ({ lexemeId, targetCode }: { lexemeId: string; targetCode: string }) => {
      if (!effectiveStudentId) throw new Error('Student ID required');
      // If viewing another student (teacher view), pass current user as added_by
      const addedBy = studentId && studentId !== user?.id ? user?.id : undefined;
      return addVocabGoal(effectiveStudentId, lexemeId, targetCode, addedBy);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vocabulary-builder', effectiveStudentId] });
      queryClient.invalidateQueries({ queryKey: ['active-lesson-goals', effectiveStudentId] });
    },
    onError: (error: any) => {
      console.error('Error adding word to builder:', error);
    },
  });

  // Archive word (soft delete, moves to archived tab)
  const removeWordMutation = useMutation({
    mutationFn: async (goalId: string) => {
      return archiveVocabGoal(goalId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vocabulary-builder', effectiveStudentId] });
      queryClient.invalidateQueries({ queryKey: ['vocabulary-builder-stats', effectiveStudentId] });
      queryClient.invalidateQueries({ queryKey: ['active-lesson-goals', effectiveStudentId] });
      toast({
        title: 'Word archived',
        description: 'Moved to archived tab',
      });
    },
    onError: (error: any) => {
      console.error('Error archiving word:', error);
      toast({
        title: 'Error',
        description: 'Failed to archive word',
        variant: 'destructive',
      });
    },
  });

  // Unarchive word (restore from archived tab)
  const unarchiveWordMutation = useMutation({
    mutationFn: async (goalId: string) => {
      return unarchiveVocabGoal(goalId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vocabulary-builder', effectiveStudentId] });
      queryClient.invalidateQueries({ queryKey: ['vocabulary-builder-stats', effectiveStudentId] });
      queryClient.invalidateQueries({ queryKey: ['active-lesson-goals', effectiveStudentId] });
      toast({
        title: 'Word restored',
        description: 'Moved back to passive words',
      });
    },
    onError: (error: any) => {
      console.error('Error unarchiving word:', error);
      toast({
        title: 'Error',
        description: 'Failed to restore word',
        variant: 'destructive',
      });
    },
  });

  // Toggle active status for lesson goals
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ goalId, isActive }: { goalId: string; isActive: boolean }) => {
      return toggleVocabActiveStatus(goalId, isActive);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['vocabulary-builder', effectiveStudentId] });
      queryClient.invalidateQueries({ queryKey: ['active-lesson-goals', effectiveStudentId] });
      toast({
        title: variables.isActive ? 'Goal activated' : 'Goal paused',
        description: variables.isActive 
          ? 'Word added to your active lesson goals'
          : 'Word paused from lesson goals',
      });
    },
    onError: (error: any) => {
      console.error('Error toggling active status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update goal status',
        variant: 'destructive',
      });
    },
  });

  // Swap focus words (remove one, add another atomically)
  const swapFocusMutation = useMutation({
    mutationFn: async ({ removeGoalId, addGoalId }: { removeGoalId: string; addGoalId: string }) => {
      return swapFocusWords(removeGoalId, addGoalId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vocabulary-builder', effectiveStudentId] });
      queryClient.invalidateQueries({ queryKey: ['focus-set', effectiveStudentId] });
      queryClient.invalidateQueries({ queryKey: ['active-lesson-goals', effectiveStudentId] });
    },
    onError: (error: any) => {
      console.error('Error swapping focus words:', error);
      toast({
        title: 'Error',
        description: 'Failed to swap focus words',
        variant: 'destructive',
      });
    },
  });

  // Bulk toggle active status
  const bulkToggleActiveMutation = useMutation({
    mutationFn: async ({ goalIds, isActive }: { goalIds: string[]; isActive: boolean }) => {
      return Promise.all(goalIds.map(id => toggleVocabActiveStatus(id, isActive)));
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['vocabulary-builder', effectiveStudentId] });
      queryClient.invalidateQueries({ queryKey: ['vocabulary-builder-stats', effectiveStudentId] });
      queryClient.invalidateQueries({ queryKey: ['active-lesson-goals', effectiveStudentId] });
      toast({
        title: variables.isActive ? 'Words activated' : 'Words moved to passive',
        description: `${variables.goalIds.length} word${variables.goalIds.length > 1 ? 's' : ''} updated`,
      });
    },
    onError: (error: any) => {
      console.error('Error bulk toggling active status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update some words',
        variant: 'destructive',
      });
    },
  });

  // Bulk archive words
  const bulkArchiveMutation = useMutation({
    mutationFn: async (goalIds: string[]) => {
      return Promise.all(goalIds.map(id => archiveVocabGoal(id)));
    },
    onSuccess: (_, goalIds) => {
      queryClient.invalidateQueries({ queryKey: ['vocabulary-builder', effectiveStudentId] });
      queryClient.invalidateQueries({ queryKey: ['vocabulary-builder-stats', effectiveStudentId] });
      queryClient.invalidateQueries({ queryKey: ['active-lesson-goals', effectiveStudentId] });
      toast({
        title: 'Words archived',
        description: `${goalIds.length} word${goalIds.length > 1 ? 's' : ''} moved to archived`,
      });
    },
    onError: (error: any) => {
      console.error('Error bulk archiving:', error);
      toast({
        title: 'Error',
        description: 'Failed to archive some words',
        variant: 'destructive',
      });
    },
  });

  // Bulk unarchive words
  const bulkUnarchiveMutation = useMutation({
    mutationFn: async (goalIds: string[]) => {
      return Promise.all(goalIds.map(id => unarchiveVocabGoal(id)));
    },
    onSuccess: (_, goalIds) => {
      queryClient.invalidateQueries({ queryKey: ['vocabulary-builder', effectiveStudentId] });
      queryClient.invalidateQueries({ queryKey: ['vocabulary-builder-stats', effectiveStudentId] });
      queryClient.invalidateQueries({ queryKey: ['active-lesson-goals', effectiveStudentId] });
      toast({
        title: 'Words restored',
        description: `${goalIds.length} word${goalIds.length > 1 ? 's' : ''} restored to passive`,
      });
    },
    onError: (error: any) => {
      console.error('Error bulk unarchiving:', error);
      toast({
        title: 'Error',
        description: 'Failed to restore some words',
        variant: 'destructive',
      });
    },
  });

  // Bulk add words from vocab sets
  const bulkAddWordsMutation = useMutation({
    mutationFn: async ({ 
      lexemeIds, 
      targetCodes, 
      isActive 
    }: { 
      lexemeIds: string[]; 
      targetCodes: string[]; 
      isActive: boolean 
    }) => {
      if (!effectiveStudentId) throw new Error('Student ID required');
      const addedBy = studentId && studentId !== user?.id ? user?.id : undefined;
      return bulkAddVocabGoals(effectiveStudentId, lexemeIds, targetCodes, isActive, addedBy);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['vocabulary-builder', effectiveStudentId] });
      queryClient.invalidateQueries({ queryKey: ['vocabulary-builder-stats', effectiveStudentId] });
      queryClient.invalidateQueries({ queryKey: ['active-lesson-goals', effectiveStudentId] });
      queryClient.invalidateQueries({ queryKey: ['vocab-set-words'] });
      toast({
        title: `Words added to ${variables.isActive ? 'active' : 'passive'}`,
        description: `${variables.lexemeIds.length} word${variables.lexemeIds.length > 1 ? 's' : ''} added successfully`,
      });
    },
    onError: (error: any) => {
      console.error('Error bulk adding words:', error);
      toast({
        title: 'Error',
        description: 'Failed to add some words',
        variant: 'destructive',
      });
    },
  });

  // Helper function to check if a word is in the builder
  const isInBuilder = (lexemeId: string): boolean => {
    return words.some(word => word.lexeme_id === lexemeId);
  };

  // Stats
  const stats = {
    totalWords: statsData?.total || 0,
    activeWords: statsData?.active || 0,
    passiveWords: statsData?.passive || 0,
    archivedWords: statsData?.archived || 0,
    wordsWithUsage: words.filter(w => w.usage_count > 0).length,
  };

  return {
    words,
    isLoading,
    error,
    refetch,
    stats,
    isInBuilder,
    addWord: (lexemeId: string, targetCode: string) => 
      addWordMutation.mutate({ lexemeId, targetCode }),
    removeWord: (goalId: string) => removeWordMutation.mutate(goalId),
    unarchiveWord: (goalId: string) => unarchiveWordMutation.mutate(goalId),
    toggleActive: (goalId: string, isActive: boolean) => 
      toggleActiveMutation.mutate({ goalId, isActive }),
    swapFocus: (removeGoalId: string, addGoalId: string) =>
      swapFocusMutation.mutate({ removeGoalId, addGoalId }),
    bulkToggleActive: (goalIds: string[], isActive: boolean) =>
      bulkToggleActiveMutation.mutate({ goalIds, isActive }),
    bulkArchive: (goalIds: string[]) => bulkArchiveMutation.mutate(goalIds),
    bulkUnarchive: (goalIds: string[]) => bulkUnarchiveMutation.mutate(goalIds),
    bulkAddWords: (lexemeIds: string[], targetCodes: string[], isActive: boolean) =>
      bulkAddWordsMutation.mutate({ lexemeIds, targetCodes, isActive }),
    isAdding: addWordMutation.isPending || bulkAddWordsMutation.isPending,
    isRemoving: removeWordMutation.isPending,
    isUnarchiving: unarchiveWordMutation.isPending,
    isToggling: toggleActiveMutation.isPending,
    isSwapping: swapFocusMutation.isPending,
    isBulkOperating: bulkToggleActiveMutation.isPending || 
                     bulkArchiveMutation.isPending || 
                     bulkUnarchiveMutation.isPending ||
                     bulkAddWordsMutation.isPending,
  };
}
