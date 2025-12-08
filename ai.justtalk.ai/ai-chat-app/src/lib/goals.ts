import { supabase } from '@/lib/supabase';

export interface Goal {
  id: string;
  goal_type: 'vocab' | 'grammar';
  target_code: string;
  lexeme_id?: string;
  level?: string;
  note?: string;
  created_at: string;
}

export interface LessonGoal extends Goal {
  is_completed: boolean;
  completion_count: number;
  display_name: string;
}

// ============================================================================
// NEW: Vocabulary Builder Interfaces
// ============================================================================

export interface VocabularyBuilderWord {
  id: string;
  lexeme_id: string;
  lemma: string;
  pos: string;
  cefr_level: string | null;
  is_active_for_lessons: boolean;
  last_used_at: string | null;
  added_by_user_id: string | null;
  added_by_name: string | null;
  created_at: string;
  archived_at: string | null;
  usage_count: number;
  lesson_count: number;
  evidence_preview: Array<{
    lesson_id: string;
    created_at: string;
  }>;
}

export interface ActiveLessonGoal {
  id: string;
  lexeme_id: string;
  lemma: string;
  pos: string;
  cefr_level: string | null;
  last_used_at: string | null;
  priority_rank: number;
  usage_count: number;
  lesson_usage_count: number;
  is_completed_in_lesson: boolean;
}

export interface DictionaryWord {
  lemma_lower: string;
  display_form: string;
  word_level: string;
  part_norm?: string;
  topic_norm?: string;
  definition?: string;
  example?: string;
  in_goals: boolean;
  status?: string;
  total_count: number;
}

/**
 * Fetch all goals for a student, optionally filtered by type
 */
export async function fetchGoals(studentId: string, goalType?: 'vocab' | 'grammar'): Promise<Goal[]> {
  const { data, error } = await (supabase as any).rpc('get_student_goals', {
    student_uuid: studentId,
    goal_type_filter: goalType || null
  });

  if (error) {
    console.error('Error fetching goals:', error);
    throw error;
  }

  return (data || []) as Goal[];
}

/**
 * Fetch lesson goals with completion status
 */
export async function fetchLessonGoals(lessonId: string, studentId: string): Promise<LessonGoal[]> {
  const { data, error } = await (supabase as any).rpc('get_lesson_goals_with_completion_v2', {
    lesson_uuid: lessonId,
    student_uuid: studentId
  });

  if (error) {
    console.error('Error fetching lesson goals:', error);
    throw error;
  }

  return (data || []) as LessonGoal[];
}

/**
 * Add a vocabulary goal using lexeme_id for precise word tracking.
 * @param addedByUserId - Optional user ID of who added the goal (for teacher adding to student)
 */
export async function addVocabGoal(
  studentId: string, 
  lexemeId: string, 
  _targetCode?: string, // kept for backward compatibility but not used
  addedByUserId?: string
): Promise<{ id: string } | null> {
  try {
    const insertData: any = { 
      student_id: studentId, 
      lexeme_id: lexemeId
    };

    // Include added_by_user_id if provided (teacher adding for student)
    if (addedByUserId) {
      insertData.added_by_user_id = addedByUserId;
    }

    const { data, error } = await (supabase as any)
      .from('student_goals')
      .insert([insertData])
      .select('id')
      .maybeSingle();

    if (error) {
      // If it's a unique constraint violation, treat as success (already exists)
      if (error.code === '23505') {
        return null; // Already exists
      }
      throw error;
    }

    return data as { id: string } | null;
  } catch (error) {
    console.error('Error adding vocab goal:', error);
    throw error;
  }
}

/**
 * Add a grammar goal. Returns the new goal ID or null if already existed.
 * Note: Grammar goals are deprecated in the lexeme-based system
 */
export async function addGrammarGoal(_studentId: string, _structureCode: string, _level?: string): Promise<{ id: string } | null> {
  console.warn('addGrammarGoal is deprecated - the system no longer uses goal_type for grammar');
  return null;
}

/**
 * Remove a goal by type and lexeme_id (for vocab goals)
 */
export async function removeVocabGoal(studentId: string, lexemeId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('student_goals')
    .delete()
    .eq('student_id', studentId)
    .eq('lexeme_id', lexemeId);

  if (error) {
    console.error('Error removing vocab goal by lexeme_id:', error);
    throw error;
  }
}

/**
 * Remove a grammar goal by structure code
 * Note: Grammar goals are deprecated in the lexeme-based system
 */
export async function removeGrammarGoal(_studentId: string, _structureCode: string): Promise<void> {
  console.warn('removeGrammarGoal is deprecated - the system no longer uses goal_type');
  // No-op since grammar goals no longer exist in the schema
}

/**
 * Legacy function for backward compatibility - add vocab goal with lemma
 * Note: This is deprecated. Use addVocabGoal() with proper lexeme_id instead.
 */
export async function addGoal(studentId: string, lemma: string): Promise<{ id: string } | null> {
  console.warn('addGoal() is deprecated. Use addVocabGoal() with proper lexeme_id instead.');
  
  // Try to find the lexeme_id from lexemes table
  const { data: lexemeEntry, error } = await supabase
    .from('lexemes')
    .select('id')
    .ilike('lemma', lemma)
    .limit(1)
    .maybeSingle();
  
  if (!error && lexemeEntry?.id) {
    // Use the proper lexeme_id if found
    return addVocabGoal(studentId, lexemeEntry.id);
  } else {
    console.warn('Could not find lexeme for lemma:', lemma);
    return null;
  }
}

// ============================================================================
// NEW: Vocabulary Builder Functions
// ============================================================================

export interface VocabularyBuilderFilters {
  search?: string;
  cefr?: string;
  status?: 'active' | 'passive' | 'archived' | 'all';
}

/**
 * Fetch vocabulary builder words with usage stats and evidence
 */
export async function fetchVocabularyBuilder(
  studentId: string,
  filters: VocabularyBuilderFilters = {},
  limit: number = 50,
  offset: number = 0
): Promise<VocabularyBuilderWord[]> {
  const { data, error } = await (supabase as any).rpc('get_vocabulary_builder_words', {
    student_uuid: studentId,
    search_text: filters.search || null,
    cefr_filter: filters.cefr || null,
    status_filter: filters.status || 'all',
    limit_val: limit,
    offset_val: offset
  });

  if (error) {
    console.error('Error fetching vocabulary builder:', error);
    throw error;
  }

  return (data || []) as VocabularyBuilderWord[];
}

/**
 * Archive a vocabulary goal (soft delete)
 */
export async function archiveVocabGoal(goalId: string): Promise<boolean> {
  const { data, error } = await (supabase as any).rpc('archive_vocab_goal', {
    goal_uuid: goalId
  });

  if (error) {
    console.error('Error archiving vocab goal:', error);
    throw error;
  }

  return data;
}

/**
 * Unarchive a vocabulary goal (restore to passive state)
 */
export async function unarchiveVocabGoal(goalId: string): Promise<boolean> {
  const { data, error } = await (supabase as any).rpc('unarchive_vocab_goal', {
    goal_uuid: goalId
  });

  if (error) {
    console.error('Error unarchiving vocab goal:', error);
    throw error;
  }

  return data;
}

/**
 * Fetch vocabulary builder stats for badge counts
 */
export async function fetchVocabBuilderStats(studentId: string): Promise<{
  total: number;
  active: number;
  passive: number;
  archived: number;
}> {
  const { data, error } = await (supabase as any).rpc('get_vocab_builder_stats', {
    student_uuid: studentId
  });

  if (error) {
    console.error('Error fetching vocab builder stats:', error);
    throw error;
  }

  return data || { total: 0, active: 0, passive: 0, archived: 0 };
}

/**
 * Fetch all active lesson goals sorted by recency
 */
export async function fetchActiveLessonGoals(
  studentId: string,
  lessonId?: string
): Promise<ActiveLessonGoal[]> {
  const { data, error } = await (supabase as any).rpc('get_active_lesson_goals', {
    student_uuid: studentId,
    lesson_uuid: lessonId || null
  });

  if (error) {
    console.error('Error fetching active lesson goals:', error);
    throw error;
  }

  // Map the RPC response to ActiveLessonGoal interface
  return (data || []).map((row: any) => ({
    id: row.id,
    lexeme_id: row.lexeme_id,
    lemma: row.lemma,
    pos: row.pos,
    cefr_level: row.cefr_level,
    last_used_at: row.last_used_at,
    priority_rank: row.priority_rank,
    usage_count: row.usage_count,
    lesson_usage_count: row.lesson_usage_count,
    is_completed_in_lesson: row.is_completed_in_lesson
  })) as ActiveLessonGoal[];
}

/**
 * Toggle whether a vocabulary word is active for lesson goals
 */
export async function toggleVocabActiveStatus(
  goalId: string,
  isActive: boolean
): Promise<boolean> {
  const { data, error } = await (supabase as any).rpc('toggle_vocab_active_status', {
    goal_uuid: goalId,
    new_active_status: isActive
  });

  if (error) {
    console.error('Error toggling vocab active status:', error);
    throw error;
  }

  return data;
}

/**
 * Bulk add vocabulary goals by lexeme IDs
 */
export async function bulkAddVocabGoals(
  studentId: string,
  lexemeIds: string[],
  _targetCodes: string[], // kept for backward compatibility but not used
  isActive: boolean = false,
  addedBy?: string
): Promise<void> {
  if (lexemeIds.length === 0) return;

  const goalsToInsert = lexemeIds.map((lexemeId) => ({
    student_id: studentId,
    lexeme_id: lexemeId,
    is_active_for_lessons: isActive,
    added_by_user_id: addedBy || studentId
  }));

  const { error } = await (supabase as any)
    .from('student_goals')
    .insert(goalsToInsert)
    .select();


  if (error) {
    // Ignore duplicate key errors
    if (error.code !== '23505') {
      console.error('Error bulk adding vocab goals:', error);
      throw error;
    }
  }
}

/**
 * Add default vocabulary goals for new students (common phrases, active by default)
 */
export async function addDefaultVocabGoals(_studentId: string): Promise<void> {
  // Note: This function is deprecated since we no longer have raw_id mapping
  // Default goals should be added using lexeme_id instead
  console.warn('addDefaultVocabGoals is deprecated - lexeme_id mapping required');
}

// ============================================================================
// NEW: Lexeme Search & Vocabulary Sets
// ============================================================================

export interface LexemeSearchResult {
  lexeme_id: string;
  lemma: string;
  pos: string;
  total_count: number;
  lesson_count: number;
  cefr_level: string | null;
  is_in_goals: boolean;
  goal_id: string | null;
  is_active_for_lessons: boolean | null;
}

export interface VocabSet {
  set_id: string;
  set_name: string;
  set_slug: string;
  set_type: string;
  total_words: number;
  acquired_count: number;
  in_progress_count: number;
  progress_percentage: number;
  display_order: number;
}

export interface VocabSetWord {
  lexeme_id: string;
  word: string;
  display_form: string;
  cefr_level: string;
  guide_word: string;
  part: string;
  topic: string;
  is_acquired: boolean;
  is_in_progress: boolean;
  in_builder: boolean;
  builder_status: string | null;
  builder_goal_id: string | null;
  usage_count: number;
  lesson_count: number;
}

/**
 * Search lexemes for adding to vocabulary builder
 */
export async function searchLexemesForGoals(
  studentId: string,
  searchText: string,
  limit: number = 50
): Promise<LexemeSearchResult[]> {
  if (!searchText || searchText.length < 2) {
    return [];
  }

  const { data, error } = await (supabase as any).rpc('search_lexemes_for_goals', {
    student_uuid: studentId,
    search_text: searchText,
    limit_val: limit
  });

  if (error) {
    console.error('Error searching lexemes:', error);
    throw error;
  }

  return (data || []) as LexemeSearchResult[];
}

/**
 * Fetch all vocabulary sets with student progress
 */
export async function fetchVocabSets(studentId: string): Promise<VocabSet[]> {
  const { data, error } = await (supabase as any).rpc(
    'get_student_all_vocab_sets_progress',
    { student_uuid: studentId }
  );

  if (error) {
    console.error('Error fetching vocab sets:', error);
    throw error;
  }

  return (data || []) as VocabSet[];
}

/**
 * Fetch words in a specific vocabulary set with student status
 */
export async function fetchVocabSetWords(
  studentId: string,
  setId: string
): Promise<VocabSetWord[]> {
  const { data, error } = await (supabase as any).rpc(
    'get_vocab_set_words_with_status',
    { 
      student_uuid: studentId,
      set_id_param: setId
    }
  );

  if (error) {
    console.error('Error fetching vocab set words:', error);
    throw error;
  }

  return (data || []) as VocabSetWord[];
}