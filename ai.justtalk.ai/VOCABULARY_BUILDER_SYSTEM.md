# Vocabulary Builder and Tracking System

Technical documentation for the JustTalk vocabulary learning system, covering architecture, database schema, frontend components, and mobile app integration.

---

## Table of Contents

1. [System Architecture Overview](#system-architecture-overview)
2. [Core Concepts](#core-concepts)
3. [Database Schema](#database-schema)
4. [Frontend Components](#frontend-components)
5. [Hooks](#hooks)
6. [Edge Functions](#edge-functions)
7. [Mobile App Integration](#mobile-app-integration)
8. [Data Flow](#data-flow)
9. [Key Invariants & Business Rules](#key-invariants--business-rules)

---

## System Architecture Overview

The Vocabulary Builder system uses a **lexeme-based architecture** where `lexeme_id` (UUID) is the primary identifier for all vocabulary tracking. The system enables students to track vocabulary goals, practice words during lessons, and measure progress through a point-based system.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Frontend (React)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  VocabularyBuilderPage    │  LiveGoalsPanel    │   NextLessonGoalsCard      │
│  FocusSetSection          │  GoalPoolSection   │   FocusSummaryCards        │
├─────────────────────────────────────────────────────────────────────────────┤
│                              Hooks Layer                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  useVocabularyBuilder   │  useFocusSet   │   useLexemeSearch               │
│  useWeeklyFocusTarget   │  useActiveLessonGoals                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                           Edge Functions (Deno)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  vocab-ingest-segment  │  elevenlabs-post-call-webhook                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                           Supabase Database                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  student_goals    │  vocab_evidence    │   student_lexeme_history           │
│  lexemes          │  lesson_active_goals_snapshot                            │
│  focus_activation_events                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Concepts

### Focus Set (5-Word Limit)

The **Focus Set** is the core of intentional vocabulary practice:

- **Hard limit**: Exactly 5 words maximum, enforced at the database level
- **What it tracks**: Only words in the Focus Set earn progress during lessons
- **Stored in**: `student_goals.is_active_for_lessons = true`
- **Constraint trigger**: `enforce_focus_set_limit`

```sql
-- Focus Set constraint (simplified)
CREATE OR REPLACE FUNCTION enforce_focus_set_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM student_goals 
      WHERE student_id = NEW.student_id 
      AND is_active_for_lessons = true
      AND archived_at IS NULL) >= 5 THEN
    RAISE EXCEPTION 'Focus Set limit (5) exceeded';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Goal Pool (Wishlist)

The **Goal Pool** is an unlimited list of vocabulary goals:

- **Stored in**: `student_goals.is_active_for_lessons = false`
- **Purpose**: Words students want to learn but aren't actively tracking
- **Promotion**: Students manually move words from Goal Pool → Focus Set

### Activation Dots (Global Usage)

**Activation dots** represent global word usage across all sessions:

| Dots | State | Meaning |
|------|-------|---------|
| 0 | Not Used | Never used in any session |
| 1 | Practiced | Used in 1 distinct session |
| 2 | Activated | Used in 2 distinct sessions |
| 3 | Ready | Used in 3+ distinct sessions |

**Source**: `student_lexeme_history.lesson_count`

### Focus Points (Intentional Progress)

**Points** track usage specifically while a word is in the Focus Set:

- Earned when a word advances state while in Focus
- **Source**: `student_lexeme_history.focus_lesson_count`
- Used for Weekly Focus Target calculations

### Stabilization Rule (3+1)

A word becomes **Stable** when:

1. It has 3 global activation dots (used in 3 distinct sessions anywhere)
2. It is currently in the Focus Set
3. It is used one additional time while in the Focus Set (4 total sessions)

```
Stabilization = (lesson_count >= 3) AND (focus_lesson_count >= 3) AND in_focus_usage
```

**Upon stabilization**:
- Word is removed from Focus Set automatically
- Vocabulary Capacity increments (+1)
- Word is permanently locked out from Focus Set

### Weekly Focus Target

Point-based weekly goal (default: 10 points):

| Transition | Points |
|------------|--------|
| Not Used → Practiced | +1 |
| Practiced → Activated | +1 |
| Activated → Ready | +1 |
| Ready → Stable | +1 |

**RPC**: `get_weekly_focus_target(student_uuid)` aggregates points for the current calendar week.

---

## Database Schema

### Core Tables

#### `student_goals`

Stores vocabulary goals for students.

```sql
CREATE TABLE student_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES profiles(id),
  lexeme_id UUID NOT NULL REFERENCES lexemes(id),
  added_by_user_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  is_active_for_lessons BOOLEAN DEFAULT false,  -- Focus Set membership
  archived_at TIMESTAMPTZ,                       -- Soft delete
  UNIQUE(student_id, lexeme_id)
);
```

**RLS Policies**:
- Students: Full access to own goals
- Teachers: Access via `owner_teacher_id` OR shared lessons

#### `vocab_evidence`

Individual word usage events during lessons.

```sql
CREATE TABLE vocab_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES lessons(id),
  segment_id UUID REFERENCES lesson_transcription_segments(id),
  student_id UUID NOT NULL REFERENCES profiles(id),
  lexeme_id UUID REFERENCES lexemes(id),
  tag TEXT,                                      -- POS tag from SpaCy
  start_char INTEGER,
  end_char INTEGER,
  text_snippet TEXT,
  was_in_focus BOOLEAN DEFAULT false,           -- Focus credit flag
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `student_lexeme_history`

Aggregated vocabulary statistics per student/lexeme.

```sql
CREATE TABLE student_lexeme_history (
  student_id UUID NOT NULL REFERENCES profiles(id),
  lexeme_id UUID NOT NULL REFERENCES lexemes(id),
  lesson_count INTEGER DEFAULT 0,               -- Global usage (activation dots)
  focus_lesson_count INTEGER DEFAULT 0,         -- Focus usage (points)
  total_count INTEGER DEFAULT 0,
  first_used_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  acquired_at TIMESTAMPTZ,                      -- When stable (lesson_count >= 3)
  acquired_lesson_id UUID REFERENCES lessons(id),
  focus_acquired_at TIMESTAMPTZ,                -- When stable via Focus
  PRIMARY KEY (student_id, lexeme_id)
);
```

#### `lesson_active_goals_snapshot`

Frozen Focus Set state at lesson start.

```sql
CREATE TABLE lesson_active_goals_snapshot (
  lesson_id UUID NOT NULL REFERENCES lessons(id),
  student_id UUID NOT NULL,
  goal_id UUID NOT NULL REFERENCES student_goals(id),
  lexeme_id UUID REFERENCES lexemes(id),
  lemma TEXT,
  pos TEXT,
  cefr_level TEXT,
  lesson_count INTEGER,
  focus_lesson_count INTEGER,
  is_stable BOOLEAN,
  priority_rank INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (lesson_id, goal_id)
);
```

**Purpose**: Ensures points are only earned for words that were in Focus at lesson start.

#### `focus_activation_events`

State transition logging for points calculation.

```sql
CREATE TABLE focus_activation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES profiles(id),
  lexeme_id UUID NOT NULL REFERENCES lexemes(id),
  lesson_id UUID REFERENCES lessons(id),
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Key Triggers

#### `sync_student_lexeme_history`

Aggregates `vocab_evidence` data into `student_lexeme_history`:

```sql
CREATE OR REPLACE FUNCTION sync_student_lexeme_history()
RETURNS TRIGGER AS $$
BEGIN
  -- Aggregate counts and update history
  INSERT INTO student_lexeme_history (student_id, lexeme_id, ...)
  SELECT ... GROUP BY student_id, lexeme_id
  ON CONFLICT (student_id, lexeme_id) DO UPDATE SET ...;
  
  -- Detect state transitions and log focus_activation_events
  -- ...
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

#### `snapshot_active_goals_on_lesson_start`

Freezes Focus Set when lesson status changes to 'in_progress':

```sql
CREATE OR REPLACE FUNCTION snapshot_active_goals_on_lesson_start()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'in_progress' AND OLD.status != 'in_progress' THEN
    INSERT INTO lesson_active_goals_snapshot (...)
    SELECT ... FROM student_goals WHERE is_active_for_lessons = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Key RPCs

| RPC | Purpose |
|-----|---------|
| `get_vocabulary_builder_words` | Fetch goals with usage stats |
| `get_focus_set_for_lesson` | Unified Focus Set (live or snapshot) |
| `get_weekly_focus_target` | Weekly points aggregation |
| `search_lexemes_for_goals` | Word search with goal status overlay |
| `toggle_vocab_active_status` | Move word in/out of Focus |
| `archive_vocab_goal` / `unarchive_vocab_goal` | Soft delete/restore |

---

## Frontend Components

### VocabularyBuilderPage

**Path**: `src/pages/VocabularyBuilderPage.tsx`

Main page with two tabs:
- **Focus Tab**: Focus Set (5 slots) + Goal Pool
- **Discover Tab**: Search and vocabulary sets

### FocusSetSection

**Path**: `src/components/vocabulary/FocusSetSection.tsx`

Displays the 5 Focus Set slots with:
- Word and CEFR badge
- Activation dots (0-3)
- Points earned (+X pts)
- Empty slot placeholders

```tsx
interface FocusSetSectionProps {
  words: VocabularyBuilderWord[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onRemoveFromFocus?: (goalId: string) => void;
  isRemoving?: boolean;
  maxFocusSlots?: number;
}
```

### LiveGoalsPanel

**Path**: `src/components/lessons/LiveGoalsPanel.tsx`

In-lesson Focus Set display:
- Uses `useFocusSet` with lesson context
- Shows snapshot for in-progress/completed lessons
- Real-time updates via custom events

```tsx
interface LiveGoalsPanelProps {
  lessonId: string;
  studentId: string;
  lessonStatus?: LessonStatus;
  className?: string;
}
```

### GoalPoolSection

**Path**: `src/components/vocabulary/GoalPoolSection.tsx`

Displays all non-Focus goals with:
- Activation dots (global state)
- "Add to Focus" button
- Archive functionality

### FocusSummaryCards

**Path**: `src/components/vocabulary/FocusSummaryCards.tsx`

Dashboard cards showing:
- **Vocabulary Capacity**: Lifetime count of Stable words
- **Weekly Focus Target**: Points this week / 10

---

## Hooks

### useVocabularyBuilder

**Path**: `src/hooks/useVocabularyBuilder.ts`

Main hook for vocabulary builder data and mutations.

```typescript
interface UseVocabularyBuilderOptions {
  studentId?: string;
  filters?: VocabularyBuilderFilters;
  limit?: number;
  offset?: number;
  enabled?: boolean;
}

function useVocabularyBuilder(options: UseVocabularyBuilderOptions): {
  words: VocabularyBuilderWord[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  stats: { totalWords, activeWords, passiveWords, archivedWords };
  
  // Mutations
  addWord: (lexemeId: string, targetCode: string) => void;
  removeWord: (goalId: string) => void;
  toggleActive: (goalId: string, isActive: boolean) => void;
  swapFocus: (removeGoalId: string, addGoalId: string) => void;
  bulkAddWords: (lexemeIds: string[], targetCodes: string[], isActive: boolean) => void;
}
```

### useFocusSet

**Path**: `src/hooks/useFocusSet.ts`

Unified hook for Focus Set across all surfaces.

```typescript
interface UseFocusSetOptions {
  studentId?: string;
  lessonId?: string;
  lessonStatus?: 'scheduled' | 'in_progress' | 'completed';
  enabled?: boolean;
}

function useFocusSet(options: UseFocusSetOptions): {
  words: FocusSetWord[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  isSnapshot: boolean;  // True for historical lessons
  emptySlots: number;   // 5 - words.length
}
```

**Behavior**:
- Scheduled/future lessons: Returns live Focus Set
- In-progress/completed lessons: Returns frozen snapshot

### useLexemeSearch

**Path**: `src/hooks/useLexemeSearch.ts`

Word search with goal status overlay.

```typescript
function useLexemeSearch(studentId: string): {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  results: LexemeSearchResult[];
  isLoading: boolean;
  isSearching: boolean;
  
  // Mutations
  addToGoals: (lexemeId: string) => void;
  updateGoalStatus: (goalId: string, isActive: boolean) => void;
  removeFromGoals: (goalId: string) => void;
}
```

### useWeeklyFocusTarget

**Path**: `src/hooks/useWeeklyFocusTarget.ts`

Weekly points tracking.

```typescript
interface WeeklyFocusTarget {
  weekly_focus_points: number;
  weekly_focus_target: number;  // Default: 10
  week_start: string;
  week_end: string;
}

function useWeeklyFocusTarget(studentId: string | undefined): {
  data: WeeklyFocusTarget | undefined;
  isLoading: boolean;
  error: Error | null;
}
```

### useVocabRealTimeProcessing

**Path**: `src/hooks/useVocabRealTimeProcessing.ts`

Triggers vocabulary processing for live lessons.

```typescript
function useVocabRealTimeProcessing(): UseMutationResult<
  VocabRealTimeResponse,
  Error,
  { lessonId: string; segmentId: string; studentId: string }
>
```

Dispatches `vocab-realtime-completed` custom event on success.

---

## Edge Functions

### vocab-ingest-segment

**Path**: `supabase/functions/vocab-ingest-segment/index.ts`

Processes speech transcripts to extract vocabulary and update tracking.

#### Request

```json
{
  "lessonId": "uuid",
  "segmentId": "uuid",
  "studentId": "uuid"
}
```

#### Processing Flow

```
1. Validate JWT authentication
2. Fetch segment from lesson_transcription_segments
3. Check idempotency (vocab_processing_log)
4. Fetch Focus Set from snapshot (or live goals as fallback)
5. Call SpaCy API (/analyze) for lexeme extraction
6. Insert vocab_evidence records with was_in_focus flag
7. Log processing completion
```

#### SpaCy API Integration

Request:
```json
{
  "text": "formatted transcript text",
  "language": "en",
  "lessonId": "uuid",
  "segmentId": "uuid"
}
```

Response:
```json
{
  "detector": "spacy_analyze_v2",
  "words": [
    { "word": "hello", "tag": "UH", "lexeme_id": "uuid" },
    { "word": "world", "tag": "NN", "lexeme_id": "uuid" }
  ]
}
```

#### Focus Credit Logic

```typescript
// Check if word is in student's Focus Set
const wasInFocus = focusLexemeIds.has(word.lexeme_id);

// Insert evidence with focus flag
await supabase.from('vocab_evidence').insert({
  lesson_id: lessonId,
  segment_id: segmentId,
  student_id: studentId,
  lexeme_id: word.lexeme_id,
  was_in_focus: wasInFocus,  // Critical for points
});
```

### elevenlabs-post-call-webhook

**Path**: `supabase/functions/elevenlabs-post-call-webhook/index.ts`

Receives post-call data from ElevenLabs after conversation analysis.

#### Request (from ElevenLabs)

```json
{
  "type": "post_call_transcription",
  "event_timestamp": 1234567890,
  "data": {
    "agent_id": "string",
    "conversation_id": "string",
    "transcript": [...],
    "metadata": { "call_duration_secs": 120 },
    "analysis": {
      "evaluation_criteria_results": {...},
      "data_collection_results": {...},
      "call_successful": "true",
      "transcript_summary": "..."
    }
  }
}
```

#### Processing Flow

```
1. Validate HMAC signature (ELEVENLABS_WEBHOOK_SECRET)
2. Find voice session by elevenlabs_conversation_id
3. Transform analysis data into session_memory
4. Update justai_conversations with session_memory
5. Set unlock_next_scenario based on evaluation results
```

---

## Mobile App Integration

### How Chat Connects to Vocabulary Tracking

1. **Voice Session Creation**
   - Mobile app starts ElevenLabs conversation
   - `justai_voice_sessions` record created with `elevenlabs_conversation_id`

2. **Conversation Processing**
   - User speaks during session
   - Transcripts generated and stored

3. **Post-Call Webhook**
   - ElevenLabs sends `post_call_transcription` webhook
   - `elevenlabs-post-call-webhook` processes and stores analysis

4. **Vocabulary Processing**
   - Transcripts segmented and processed
   - `vocab-ingest-segment` called for each student segment
   - Words matched to lexemes and tracked

5. **Focus Set Integration**
   - Mobile conversations use same Focus Set as web
   - Points earned for Focus words used in chat
   - `was_in_focus` flag set based on current Focus Set

### Data Flow for Mobile Sessions

```
Mobile App (ElevenLabs SDK)
    │
    ▼
ElevenLabs API
    │
    ├── Real-time: Conversation audio/text
    │
    └── Post-call: elevenlabs-post-call-webhook
              │
              ▼
        justai_voice_sessions
        justai_conversations (session_memory)
              │
              ▼
        Transcript Processing
              │
              ▼
        vocab-ingest-segment
              │
              ▼
        vocab_evidence (was_in_focus)
              │
              ▼
        student_lexeme_history (trigger sync)
              │
              ▼
        focus_activation_events (points)
```

### Session Memory for Context Continuity

The webhook stores session memory for AI context:

```typescript
const sessionMemory = {
  transcript_summary: analysis.transcript_summary,
  call_successful: analysis.call_successful,
  next_stage_result: evaluationResults.next_stage?.result,
  next_stage_rationale: evaluationResults.next_stage?.rationale,
  collected_data: [...],  // name-value pairs
  conversation_timestamp: "...",
  extracted_at: "...",
  source: "elevenlabs_webhook"
};
```

---

## Data Flow

### Adding a Word to Goals

```
User clicks "Add to Goals"
    │
    ▼
useLexemeSearch.addToGoals(lexemeId)
    │
    ▼
INSERT INTO student_goals (student_id, lexeme_id, is_active_for_lessons: false)
    │
    ▼
Word appears in Goal Pool
```

### Promoting to Focus Set

```
User clicks "Add to Focus"
    │
    ▼
useVocabularyBuilder.toggleActive(goalId, true)
    │
    ▼
RPC: toggle_vocab_active_status
    │
    ▼
enforce_focus_set_limit trigger (checks < 5)
    │
    ▼
UPDATE student_goals SET is_active_for_lessons = true
    │
    ▼
Word appears in Focus Set
```

### Word Usage During Lesson

```
Student speaks during lesson
    │
    ▼
AssemblyAI transcription
    │
    ▼
lesson_transcription_segments INSERT
    │
    ▼
useVocabRealTimeProcessing.mutate()
    │
    ▼
vocab-ingest-segment edge function
    │
    ├── Fetch Focus Set from snapshot
    │
    ├── Call SpaCy /analyze API
    │
    └── INSERT vocab_evidence (was_in_focus)
              │
              ▼
        sync_student_lexeme_history trigger
              │
              ├── Update lesson_count
              ├── Update focus_lesson_count (if was_in_focus)
              │
              └── Log focus_activation_events (if state changed)
                        │
                        ▼
        window.dispatchEvent('vocab-realtime-completed')
              │
              ▼
        LiveGoalsPanel refetches and updates UI
```

### Stabilization Flow

```
Word reaches 3 activation dots AND is in Focus
    │
    ▼
Student uses word in Focus session (4th usage)
    │
    ▼
sync_student_lexeme_history detects:
  - lesson_count >= 3
  - focus_lesson_count >= 3
  - New usage in current session
    │
    ▼
Mark as stable:
  - UPDATE student_lexeme_history SET acquired_at = now()
  - INSERT focus_activation_event (to_state: 'stable')
    │
    ▼
Word automatically removed from Focus Set
    │
    ▼
Vocabulary Capacity increments
```

---

## Key Invariants & Business Rules

### Focus Set Rules (LOCKED)

1. **Maximum 5 words** - Enforced at database level
2. **New words default to Goal Pool** - Never auto-added to Focus
3. **Stable words never re-enter Focus** - Permanently locked out
4. **Empty slots remain open** - No auto-fill from goals

### Progress Tracking Rules

1. **Activation dots = Global usage** - All sessions count
2. **Points = Focus usage only** - Only when word was in Focus Set
3. **One state advance per session** - Anti-grind protection
4. **Snapshot-based Focus credit** - Uses lesson start snapshot

### Stabilization Rules (LOCKED)

1. **3 global dots + 1 Focus usage** = Stable (4 total)
2. **Final usage must be in Focus** - Critical requirement
3. **Automatic removal** - Stable words leave Focus
4. **Vocabulary Capacity tracks lifetime stable words**

### Data Integrity Rules

1. **Snapshot is source of truth** for historical lessons
2. **was_in_focus flag** must use snapshot, not live goals
3. **focus_activation_events** only logged for Focus words
4. **lexeme_id IS NOT NULL** required for all vocab calculations

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for admin operations |
| `SUPABASE_ANON_KEY` | Anon key for JWT validation |
| `GRAMMAR_SPACY_URL` | SpaCy API endpoint |
| `GRAMMAR_SPACY_TOKEN` | SpaCy API authentication token |
| `ELEVENLABS_WEBHOOK_SECRET` | HMAC signature validation |
| `VOCAB_DEBUG` | Enable debug logging |

---

## Related Documentation

- [Focus Set Design](./FOCUS_SET_DESIGN.md) - UI/UX specifications
- [Lexeme Migration](./LEXEME_MIGRATION.md) - Legacy system migration
- [Mobile Integration](./MOBILE_INTEGRATION.md) - Full mobile app details
