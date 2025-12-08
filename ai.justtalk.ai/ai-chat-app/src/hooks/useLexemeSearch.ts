import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { searchLexemesForGoals } from '@/lib/goals';

interface UseLexemeSearchOptions {
  studentId?: string;
  enabled?: boolean;
}

export function useLexemeSearch({
  studentId,
  enabled = true
}: UseLexemeSearchOptions = {}) {
  const { user } = useAuth();
  const effectiveStudentId = studentId || user?.id;
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Search query
  const {
    data: results = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['lexeme-search', effectiveStudentId, debouncedSearchTerm],
    queryFn: () => searchLexemesForGoals(effectiveStudentId!, debouncedSearchTerm, 50),
    enabled: enabled && !!effectiveStudentId && debouncedSearchTerm.length >= 2,
    staleTime: 30000,
  });

  return {
    searchTerm,
    setSearchTerm,
    results,
    isLoading,
    error,
    refetch,
    isSearching: debouncedSearchTerm.length >= 2,
  };
}
