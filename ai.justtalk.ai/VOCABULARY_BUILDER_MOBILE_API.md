# Vocabulary Builder Mobile API Guide

## Overview

This document provides a comprehensive guide for integrating the Vocabulary Builder feature into the mobile application. The Vocabulary Builder consists of three main sections:

1. **Active Tab** - Words actively tracked during lessons
2. **Passive Tab** - Words saved but not actively tracked
3. **Discover Tab** - Curated vocabulary sets organized by CEFR level
4. **Search Feature** - Direct lexeme search to add any word from the database

## Table of Contents

- [Key Concepts](#key-concepts)
- [Data Models](#data-models)
- [API Functions](#api-functions)
- [Active Tab Implementation](#active-tab-implementation)
- [Discover Tab Implementation](#discover-tab-implementation)
- [Lexeme Search Implementation](#lexeme-search-implementation)
- [User Workflows](#user-workflows)

---

## Key Concepts

### Word States

1. **Active** (`is_active_for_lessons: true`) - Words actively tracked and practiced during lessons
2. **Passive** (`is_active_for_lessons: false`) - Words saved but not actively tracked
3. **Archived** (`archived_at: not null`) - Removed words (soft delete)

### CEFR Levels

Words are categorized by Common European Framework of Reference levels:
- **A1, A2** - Beginner
- **B1, B2** - Intermediate  
- **C1, C2** - Advanced

### Word Acquisition Status

- **New** - Never used in lessons
- **In Progress** - Used in 1-2 lessons
- **Acquired** - Used in 3+ lessons

---

## Data Models

### VocabularyBuilderWord

```typescript
interface VocabularyBuilderWord {
  id: string;                    // Goal ID
  lexeme_id: string;              // Unique word identifier
  target_code: string;            // Word representation
  display_name: string;           // Display text
  cefr_level: string | null;      // A1, A2, B1, B2, C1, C2
  guide_word: string | null;      // Context (e.g., "IDIOM")
  is_active_for_lessons: boolean; // Active vs Passive
  last_used_at: string | null;    // Last usage timestamp
  added_by_user_id: string | null;
  added_by_name: string | null;
  created_at: string;
  archived_at: string | null;
  usage_count: number;            // Total times used
  lesson_count: number;           // Number of lessons used in
  evidence_preview: Array<{       // Usage examples
    lesson_id: string;
    segment_id: string;
    text_snippet: string;
    created_at: string;
  }>;
}
```

### StudentVocabSetProgress

```typescript
interface StudentVocabSetProgress {
  set_id: string;
  set_name: string;              // e.g., "Common Adjectives"
  set_slug: string;              // URL-friendly identifier
  set_type: string;              // CEFR level (A1, B1, etc.)
  total_words: number;           // Total words in set
  acquired_count: number;        // Words used 3+ times
  in_progress_count: number;     // Words used 1-2 times
  progress_percentage: number;   // Acquisition progress
  display_order: number;         // Sort order
}
```

### VocabSetWord

```typescript
interface VocabSetWord {
  lexeme_id: string;
  word: string;
  display_form: string;
  cefr_level: string;
  guide_word: string;
  part: string;                  // Part of speech
  topic: string;
  is_acquired: boolean;          // Used 3+ times
  is_in_progress: boolean;       // Used 1-2 times
  in_builder: boolean;           // Already added to builder
  builder_status: string | null; // 'active', 'passive', or null
  builder_goal_id: string | null;
  usage_count: number;
  lesson_count: number;
}
```

---

## API Functions

### Supabase RPC Functions

All functions use Supabase RPC calls. Import:
```typescript
import { supabase } from '@/integrations/supabase/client';
```

### 1. Fetch Vocabulary Builder Words

**Function:** `get_vocabulary_builder_words`

```typescript
const { data, error } = await supabase.rpc('get_vocabulary_builder_words', {
  student_uuid: studentId,
  search_text: searchQuery || null,    // Filter by text
  cefr_filter: cefrLevel || null,       // Filter by level (A1, B1, etc.)
  status_filter: status || 'all',       // 'active', 'passive', 'archived', 'all'
  limit_val: 50,
  offset_val: 0
});
```

**Returns:** Array of `VocabularyBuilderWord`

### 2. Fetch Builder Stats

**Function:** `get_vocab_builder_stats`

```typescript
const { data, error } = await supabase.rpc('get_vocab_builder_stats', {
  student_uuid: studentId
});
```

**Returns:**
```typescript
{
  total: number;
  active: number;
  passive: number;
  archived: number;
}
```

### 3. Toggle Word Active Status

**Function:** `toggle_vocab_active_status`

```typescript
const { data, error } = await supabase.rpc('toggle_vocab_active_status', {
  goal_uuid: goalId,
  new_active_status: true  // true = active, false = passive
});
```

**Returns:** `boolean` (success/failure)

### 4. Archive Word (Soft Delete)

**Function:** `archive_vocab_goal`

```typescript
const { data, error } = await supabase.rpc('archive_vocab_goal', {
  goal_uuid: goalId
});
```

### 5. Unarchive Word (Restore)

**Function:** `unarchive_vocab_goal`

```typescript
const { data, error } = await supabase.rpc('unarchive_vocab_goal', {
  goal_uuid: goalId
});
```

### 6. Bulk Add Words

**Direct Insert (Simplified - no target_code needed):**

```typescript
const goalsToInsert = lexemeIds.map(lexemeId => ({
  student_id: studentId,
  lexeme_id: lexemeId,
  is_active_for_lessons: isActive,  // true for Active, false for Passive
  added_by_user_id: userId
}));

const { error } = await supabase
  .from('student_goals')
  .insert(goalsToInsert)
  .select();
```

**Note:** `goal_type` is no longer required. The system automatically handles it based on `lexeme_id`.

### 7. Fetch Vocabulary Sets

**Function:** `get_student_all_vocab_sets_progress`

```typescript
const { data, error } = await supabase.rpc(
  'get_student_all_vocab_sets_progress',
  { student_uuid: studentId }
);
```

**Returns:** Array of `StudentVocabSetProgress`

### 8. Fetch Words in a Set

**Function:** `get_vocab_set_words_with_status`

```typescript
const { data, error } = await supabase.rpc(
  'get_vocab_set_words_with_status',
  { 
    student_uuid: studentId,
    set_id_param: setId
  }
);
```

**Returns:** Array of `VocabSetWord`

### 9. Search Lexemes (New Feature)

**Function:** `search_lexemes_for_goals`

Search the entire lexeme database to add any word to the vocabulary builder:

```typescript
const { data, error } = await supabase.rpc('search_lexemes_for_goals', {
  student_uuid: studentId,
  search_text: searchQuery,  // Minimum 2 characters
  limit_val: 50
});
```

**Returns:** Array of `LexemeSearchResult`

```typescript
interface LexemeSearchResult {
  lexeme_id: string;
  lemma: string;              // Base form
  pos: string;                // Part of speech
  total_count: number;        // Times student used this word
  lesson_count: number;       // Lessons where word was used
  cefr_level: string | null;  // A1, B1, etc.
  is_in_goals: boolean;       // Already in builder
  goal_id: string | null;     // Goal ID if in builder
  is_active_for_lessons: boolean | null; // Active status if in builder
}
```

---

## Lexeme Search Implementation

### Feature Overview

The Lexeme Search feature allows students and teachers to search the entire lexeme database and add any word to the vocabulary builder. This is more flexible than the curated sets in the Discover tab.

### Screen Layout

```
┌─────────────────────────────┐
│   Search Dictionary         │
├─────────────────────────────┤
│  🔍 Type to search...       │ ← Search input (min 2 chars)
├─────────────────────────────┤
│  happy (adjective)    A1    │ ← Search result
│  Used 5× in 3 lessons       │
│  ✓ Active                   │ ← Already in builder
│  [Remove] [Move to Passive] │
├─────────────────────────────┤
│  furthermore (adverb) B2    │
│  Not used yet               │
│  [+ Add to Active ▼]        │ ← Dropdown: Active/Passive
└─────────────────────────────┘
```

### Implementation

```typescript
import { useState, useEffect } from 'react';

// Debounced search
const [inputValue, setInputValue] = useState('');
const [searchTerm, setSearchTerm] = useState('');

useEffect(() => {
  const timer = setTimeout(() => {
    setSearchTerm(inputValue);
  }, 300); // Wait 300ms after user stops typing
  return () => clearTimeout(timer);
}, [inputValue]);

// Search query (only runs if 2+ characters)
const searchResults = searchTerm.length >= 2 
  ? await supabase.rpc('search_lexemes_for_goals', {
      student_uuid: userId,
      search_text: searchTerm,
      limit_val: 50
    })
  : [];
```

### Add Word from Search

```typescript
// Add new word
const addWordFromSearch = async (lexemeId: string, isActive: boolean) => {
  const { error } = await supabase.from('student_goals').insert({
    student_id: userId,
    lexeme_id: lexemeId,
    is_active_for_lessons: isActive
  });

  if (error) {
    if (error.code === '23505') {
      // Word already exists
      showToast('Word already in your builder');
    } else {
      throw error;
    }
  }
};
```

### Update Existing Word Status

```typescript
// Toggle between active/passive
const toggleWordStatus = async (goalId: string, isActive: boolean) => {
  const { error } = await supabase
    .from('student_goals')
    .update({ is_active_for_lessons: isActive })
    .eq('id', goalId);

  if (error) throw error;
};
```

### Remove Word from Builder

```typescript
// Delete from builder
const removeWord = async (goalId: string) => {
  const { error } = await supabase
    .from('student_goals')
    .delete()
    .eq('id', goalId);

  if (error) throw error;
};
```

### Display Search Results

For each result, show:
- `lemma` - Word base form
- `pos` - Part of speech badge
- `cefr_level` - Level badge (A1, B2, etc.)
- `total_count` - Usage count
- `lesson_count` - Lesson count
- `is_in_goals` - If true, show current status and actions (remove, toggle)
- If false, show "Add to Active/Passive" button

---

## Active Tab Implementation

### Screen Layout

```
┌─────────────────────────────┐
│   Vocabulary Builder        │
├─────────────────────────────┤
│  [Active: 23] [Passive: 11] │ ← Tabs with counts
├─────────────────────────────┤
│  🔍 Search words...         │ ← Search bar
│  [All levels ▼]             │ ← CEFR filter
├─────────────────────────────┤
│  ☐ Select all (23)          │ ← Bulk selection
├─────────────────────────────┤
│  ☐ mind          B1  2× used│ ← Word card
│  ☐ furthermore   B2  0× used│
│  ☐ will          A2  1× used│
│  ...                         │
└─────────────────────────────┘
│ [Move to Passive] [Archive] │ ← Bulk actions (when selected)
└─────────────────────────────┘
```

### Initial Load

```typescript
// 1. Fetch stats for tab badges
const statsResponse = await supabase.rpc('get_vocab_builder_stats', {
  student_uuid: userId
});

// 2. Fetch active words
const wordsResponse = await supabase.rpc('get_vocabulary_builder_words', {
  student_uuid: userId,
  search_text: null,
  cefr_filter: null,
  status_filter: 'active',  // Show only active words
  limit_val: 50,
  offset_val: 0
});
```

### Search and Filtering

```typescript
// Apply filters
const wordsResponse = await supabase.rpc('get_vocabulary_builder_words', {
  student_uuid: userId,
  search_text: searchQuery,       // User's search text
  cefr_filter: selectedCefr,      // 'A1', 'B1', etc. or null
  status_filter: 'active',
  limit_val: 50,
  offset_val: 0
});
```

### Single Word Actions

#### View Word Details
- Display: `display_name`, `cefr_level`, `usage_count`, `lesson_count`
- Show usage evidence: `evidence_preview` array

#### Move to Passive
```typescript
await supabase.rpc('toggle_vocab_active_status', {
  goal_uuid: word.id,
  new_active_status: false
});
```

#### Archive (Remove)
```typescript
await supabase.rpc('archive_vocab_goal', {
  goal_uuid: word.id
});
```

### Bulk Actions

#### Select Multiple Words
- Use local state to track selected word IDs
- Show selection count and action bar at bottom

#### Bulk Move to Passive
```typescript
for (const wordId of selectedWordIds) {
  await supabase.rpc('toggle_vocab_active_status', {
    goal_uuid: wordId,
    new_active_status: false
  });
}
// Refetch data
```

#### Bulk Archive
```typescript
for (const wordId of selectedWordIds) {
  await supabase.rpc('archive_vocab_goal', {
    goal_uuid: wordId
  });
}
// Refetch data
```

### Data Refresh

After any mutation:
```typescript
// Invalidate and refetch
await Promise.all([
  refetchStats(),
  refetchWords()
]);
```

---

## Discover Tab Implementation

### Screen Layout

```
┌─────────────────────────────┐
│   Discover Vocabulary       │
├─────────────────────────────┤
│  Browse curated sets by     │
│  CEFR level...              │
├─────────────────────────────┤
│ ╔═══════════════════════╗   │
│ ║ Common Adjectives  A1 ║   │
│ ║ ▓▓▓▓▓░░░░░ 45%       ║   │
│ ║ 12/27 acquired        ║   │
│ ║ [Add 15 to Active]    ║   │
│ ╚═══════════════════════╝   │
│                             │
│ ╔═══════════════════════╗   │
│ ║ Business Vocab     B2 ║   │
│ ║ ▓▓░░░░░░░░ 18%       ║   │
│ ║ 7/40 acquired         ║   │
│ ║ [Add 33 to Active]    ║   │
│ ╚═══════════════════════╝   │
└─────────────────────────────┘
```

### Initial Load

```typescript
// Fetch all vocabulary sets with progress
const { data: sets, error } = await supabase.rpc(
  'get_student_all_vocab_sets_progress',
  { student_uuid: userId }
);

// Sets are pre-sorted by display_order
```

### Set Card Display

For each set, show:
- `set_name` - e.g., "Common Adjectives"
- `set_type` - CEFR badge (A1, B2, etc.)
- Progress bar: `(acquired_count / total_words) * 100`
- Text: `${acquired_count}/${total_words} acquired`
- Button: "Add X to Active" where X = `total_words - acquired_count`

### View Set Details (Dialog/Modal)

When user taps a set card:

```typescript
// 1. Open modal/dialog
// 2. Fetch words in the set
const { data: words, error } = await supabase.rpc(
  'get_vocab_set_words_with_status',
  { 
    student_uuid: userId,
    set_id_param: set.set_id
  }
);

// 3. Display word list with:
//    - display_form
//    - cefr_level badge
//    - status badge (New/In Progress/Acquired)
//    - builder badge (Active/Passive if in_builder)
```

### Word States in Set View

Each word shows:

1. **Acquisition Status** (from lesson usage):
   - ✓ Acquired (`is_acquired: true`) - Green badge
   - ⏳ In Progress (`is_in_progress: true`) - Yellow badge
   - ◯ New - Gray badge

2. **Builder Status** (if already added):
   - ✓ Active (`builder_status: 'active'`) - Blue badge
   - ◉ Passive (`builder_status: 'passive'`) - Gray badge
   - [Not in builder] - No badge

### Add Words to Builder

#### Add Single Word to Active
```typescript
const goalsToInsert = [{
  student_id: userId,
  lexeme_id: word.lexeme_id,
  is_active_for_lessons: true,
  added_by_user_id: userId
}];

await supabase
  .from('student_goals')
  .insert(goalsToInsert);
```

**Note:** `goal_type` and `target_code` are no longer required.

#### Add Single Word to Passive
```typescript
// Same as above but set is_active_for_lessons: false
```

#### Add Multiple Selected Words
```typescript
// User selects multiple words from set
const goalsToInsert = selectedWords.map(word => ({
  student_id: userId,
  lexeme_id: word.lexeme_id,
  is_active_for_lessons: true,  // or false for passive
  added_by_user_id: userId
}));

await supabase
  .from('student_goals')
  .insert(goalsToInsert);
```

#### Add All Non-Acquired Words
```typescript
// Filter out acquired words
const wordsToAdd = words.filter(w => !w.is_acquired);

const goalsToInsert = wordsToAdd.map(word => ({
  student_id: userId,
  lexeme_id: word.lexeme_id,
  is_active_for_lessons: true,
  added_by_user_id: userId
}));

await supabase
  .from('student_goals')
  .insert(goalsToInsert);
```

### Toggle Word Status (If Already in Builder)

If word is in builder (`in_builder: true`):

```typescript
// Toggle between active and passive
await supabase.rpc('toggle_vocab_active_status', {
  goal_uuid: word.builder_goal_id,
  new_active_status: !isCurrentlyActive
});
```

---

## User Workflows

### Workflow 1: Student Adds Words from Discover Tab

```
1. Open Vocabulary Builder → Discover Tab
2. See list of vocabulary sets with progress
3. Tap on "Common Phrases (A1)" set
4. Modal opens showing 30 words in the set
5. See status:
   - "hello" - Acquired ✓ (green)
   - "goodbye" - In Progress ⏳ (yellow)  
   - "excuse me" - New ◯ (gray)
   - "furthermore" - New, Active ✓ (already in builder)
6. Select multiple new words with checkboxes
7. Tap "Add to Active" (or "Add to Passive")
8. Words added to student_goals table
9. Close modal
10. Navigate to Active Tab to see newly added words
```

### Workflow 2: Student Manages Active Words

```
1. Open Vocabulary Builder → Active Tab
2. See list of 23 active words
3. Filter by CEFR level (B1 only)
4. Search for "mind"
5. Long-press "mind" to see details:
   - Used 2 times
   - Used in 2 lessons
   - CEFR: B1
   - Evidence snippets showing usage
6. Options:
   a) Move to Passive (stops tracking in lessons)
   b) Archive (soft delete)
7. Or: Select multiple words with checkboxes
8. Use bulk actions at bottom:
   - "Move to Passive" for all selected
   - "Archive" for all selected
```

### Workflow 3: Search and Add Custom Words

```
1. Open Vocabulary Builder → Active/Passive Tab
2. Scroll down to "Search Dictionary" section
3. Type "serendip" in search box
4. After 300ms, see results:
   - "serendipity" (noun) - C2 level
   - Not used yet
   - Not in builder
5. Tap "+ Add" dropdown
6. Choose "Add to Active" or "Add to Passive"
7. Word added to builder
8. Search result now shows "✓ Active" badge
9. Can toggle status or remove directly from search
```


### Workflow 5: Bulk Add from Set

```
1. Open Discover Tab
2. Tap "Common Adjectives (A1)" set card
3. Card shows "15 not acquired"
4. Tap "Add 15 to Active" button directly on card
   (doesn't open modal, adds all non-acquired words)
5. Toast: "15 words added to Active"
6. Navigate to Active Tab to see words
```

---

## Implementation Checklist

### Active Tab
- [ ] Fetch and display active words with `status_filter: 'active'`
- [ ] Show stats badges (Active count, Passive count)
- [ ] Implement search bar with debounce
- [ ] Implement CEFR level filter dropdown
- [ ] Implement multi-select with checkboxes
- [ ] Implement "Select All" checkbox
- [ ] Show word cards with: name, CEFR badge, usage count
- [ ] Implement single word actions (view details, move to passive, archive)
- [ ] Implement bulk actions bar (appears when items selected)
- [ ] Implement bulk move to passive
- [ ] Implement bulk archive
- [ ] Implement data refresh after mutations
- [ ] Handle loading states
- [ ] Handle error states
- [ ] Implement pagination/infinite scroll

### Passive Tab
- [ ] Same as Active Tab but with `status_filter: 'passive'`
- [ ] Bulk action: "Move to Active"
- [ ] Single action: "Activate"

### Discover Tab
- [ ] Fetch vocabulary sets with progress
- [ ] Display set cards in grid/list
- [ ] Show set name, CEFR badge, progress bar, counts
- [ ] Implement "Add X to Active" quick action on card
- [ ] Implement set detail modal/dialog
- [ ] In modal: fetch and display words from set
- [ ] Show word status badges (New/In Progress/Acquired)
- [ ] Show builder status badges (Active/Passive if in builder)
- [ ] Implement word selection in modal
- [ ] Implement "Add Selected to Active/Passive" buttons
- [ ] Implement toggle for words already in builder
- [ ] Handle duplicate prevention (words already added)
- [ ] Implement data refresh after adding words
- [ ] Handle loading states
- [ ] Handle error states

### Lexeme Search Feature
- [ ] Implement search input with debounce (300ms)
- [ ] Fetch lexeme search results with `search_lexemes_for_goals`
- [ ] Display search results with lemma, POS, CEFR, usage stats
- [ ] Show "in builder" indicator if word already added
- [ ] Implement "Add to Active" button for new words
- [ ] Implement "Add to Passive" option (dropdown)
- [ ] For existing words: show Remove and Toggle Status actions
- [ ] Handle duplicate prevention (23505 error)
- [ ] Show usage statistics (total_count, lesson_count)
- [ ] Implement minimum 2-character search requirement
- [ ] Handle loading state during search
- [ ] Handle empty results state
- [ ] Limit results to 50 items

---

## Error Handling

### Duplicate Prevention

Adding words that already exist will trigger error code `23505`:

```typescript
try {
  await supabase.from('student_goals').insert(goalsToInsert);
} catch (error) {
  if (error.code === '23505') {
    // Already exists - ignore or show toast
    console.log('Some words already in builder');
  } else {
    throw error;
  }
}
```

### Network Errors

```typescript
try {
  const { data, error } = await supabase.rpc(...);
  if (error) throw error;
} catch (error) {
  // Show error toast/banner
  console.error('Failed to load vocabulary:', error);
}
```

---

## Performance Considerations

1. **Pagination**: Active tab can have 100+ words. Implement pagination or infinite scroll.

2. **Caching**: Cache vocabulary sets list (rarely changes).

3. **Optimistic Updates**: Update UI immediately, rollback on error.

4. **Debounce Search**: Wait 300ms after user stops typing before searching.

5. **Batch Operations**: When bulk adding/removing, consider batch size limits.

---

## Testing Scenarios

1. **Empty State**: New student with no words
2. **Active Words**: Student with 50+ active words
3. **Search**: Test search with various queries
4. **Filter**: Test CEFR level filtering
5. **Bulk Select**: Select all, select some, deselect
6. **Bulk Actions**: Move multiple to passive, archive multiple
7. **Discover Sets**: View sets, add words from sets
8. **Duplicates**: Try adding word that's already in builder
9. **Network Errors**: Test with poor connectivity
10. **Toggle Status**: Switch word from active to passive and back

---

## API Response Examples

### Stats Response
```json
{
  "total": 34,
  "active": 23,
  "passive": 11,
  "archived": 5
}
```

### Active Words Response
```json
[
  {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "lexeme_id": "lexeme_456",
    "target_code": "mind",
    "display_name": "mind",
    "cefr_level": "B1",
    "guide_word": null,
    "is_active_for_lessons": true,
    "last_used_at": "2025-12-07T10:30:00Z",
    "usage_count": 2,
    "lesson_count": 2,
    "created_at": "2025-12-01T08:00:00Z",
    "archived_at": null,
    "evidence_preview": [
      {
        "lesson_id": "lesson_123",
        "segment_id": "seg_456",
        "text_snippet": "I don't mind waiting",
        "created_at": "2025-12-05T14:20:00Z"
      }
    ]
  }
]
```

### Vocabulary Sets Response
```json
[
  {
    "set_id": "set_001",
    "set_name": "Common Adjectives",
    "set_slug": "common-adjectives",
    "set_type": "A1",
    "total_words": 27,
    "acquired_count": 12,
    "in_progress_count": 5,
    "progress_percentage": 44.44,
    "display_order": 1
  }
]
```

### Set Words Response
```json
[
  {
    "lexeme_id": "lex_789",
    "word": "happy",
    "display_form": "happy",
    "cefr_level": "A1",
    "guide_word": "",
    "part": "adjective",
    "topic": "emotions",
    "is_acquired": true,
    "is_in_progress": false,
    "in_builder": true,
    "builder_status": "active",
    "builder_goal_id": "goal_456",
    "usage_count": 5,
    "lesson_count": 3
  }
]
```

---

## Notes

- All timestamps are in ISO 8601 format (UTC)
- All IDs are UUIDs
- CEFR levels: A1, A2, B1, B2, C1, C2
- Status values: 'active', 'passive', 'archived', 'all'
- The system uses `lexeme_id` for precise word tracking across all usage
- **`target_code` is no longer required** - the system derives display text from lexeme data
- **`goal_type` is no longer required** - automatically set based on lexeme_id presence
- `evidence_preview` shows recent usage examples from lessons
- Words can be added by the student or by their teacher (`added_by_user_id`)
- Lexeme search requires minimum 2 characters to trigger
- Search is debounced with 300ms delay to reduce API calls

---

## Support

For questions or issues with the API, refer to:
- Web implementation: `/src/pages/student/VocabularyBuilderPage.tsx`
- Hooks: `/src/hooks/useVocabularyBuilder.ts`
- API layer: `/src/lib/goals.ts`
