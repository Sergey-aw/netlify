# Focus Set Vocabulary Tracking System

**Last Updated:** January 29, 2026  
**Platform:** JustTalk.ai Web App  
**Purpose:** Reference for implementing Focus Set vocabulary tracking in mobile apps

---

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Database Schema](#database-schema)
4. [Core Hooks](#core-hooks)
5. [API Functions](#api-functions)
6. [Live Lesson Flow](#live-lesson-flow)
7. [UI Components](#ui-components)
8. [Real-time Updates](#real-time-updates)
9. [Mobile Implementation Guide](#mobile-implementation-guide)

---

## Overview

The Focus Set system allows students to select up to **5 priority vocabulary words** for active tracking during lessons. These words earn progress points when used in conversation, contributing to weekly learning goals.

### Key Concepts

- **All Goals**: Complete list of vocabulary words the student wants to learn (unlimited)
- **Focus Set**: Top 5 priority words actively tracked during lessons (max 5)
- **Passive Goals**: Goals not in Focus Set but still tracked globally
- **Activation Level**: Global usage counter (0-3 dots) across all lessons
- **Focus Points**: Points earned when using Focus words in lessons
- **Stable Words**: Mastered words (filtered out, not shown)

### Status Flow

```
┌─────────────┐
│  Add Word   │
│  to Goals   │
└──────┬──────┘
       │
       v
┌─────────────┐      Activate (max 5)      ┌─────────────┐
│  Passive    │ ────────────────────────> │ Focus Set   │
│  Goals      │ <──────────────────────── │  (Active)   │
└──────┬──────┘      Deactivate            └──────┬──────┘
       │                                           │
       │ Archive                                   │ Becomes Stable
       v                                           v
┌─────────────┐                            ┌─────────────┐
│  Archived   │                            │   Stable    │
└─────────────┘                            │  (Hidden)   │
                                           └─────────────┘
```

---

## System Architecture

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Vocabulary Tracking System                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Student Setup (Vocabulary Builder)                          │
│     ├── Browse CEFR Dictionary                                  │
│     ├── Add words to Goals                                      │
│     ├── Activate 5 words for Focus Set                          │
│     └── Organize: All/Focus/Passive/Archived tabs              │
│                                                                  │
│  2. Lesson Start                                                │
│     ├── Snapshot Focus Set (freeze at lesson start)            │
│     ├── Display in LiveGoalsPanel (sidebar)                    │
│     └── Initialize tracking state                              │
│                                                                  │
│  3. During Lesson (Real-time)                                   │
│     ├── Student speaks → Transcription segment                 │
│     ├── vocab-ingest-segment Edge Function                     │
│     │   ├── Tokenize speech                                    │
│     │   ├── Match lexemes from dictionary                      │
│     │   ├── Update student_vocab_usage                         │
│     │   ├── Update lesson_goals_evidence                       │
│     │   └── Increment counters                                 │
│     ├── Dispatch 'vocab-realtime-completed' event              │
│     └── UI refreshes → Shows updated dots + points             │
│                                                                  │
│  4. After Lesson                                                │
│     ├── Finalize vocabulary processing                         │
│     ├── Calculate weekly progress                              │
│     └── Update goal completion status                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### Core Tables

#### 1. `student_goals`
Student's vocabulary learning goals.

```sql
CREATE TABLE student_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES profiles(id),
  lexeme_id UUID NOT NULL REFERENCES lexemes(id),
  is_active_for_lessons BOOLEAN DEFAULT false,  -- TRUE = Focus Set
  added_by_user_id UUID REFERENCES profiles(id), -- Teacher who added it
  archived_at TIMESTAMPTZ DEFAULT NULL,          -- NULL = active
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(student_id, lexeme_id)
);

-- Indexes
CREATE INDEX idx_student_goals_student ON student_goals(student_id);
CREATE INDEX idx_student_goals_active ON student_goals(student_id) 
  WHERE is_active_for_lessons = true AND archived_at IS NULL;
```

**Key Fields:**
- `is_active_for_lessons = true`: Word is in Focus Set (max 5)
- `archived_at IS NOT NULL`: Word is archived (soft deleted)
- `added_by_user_id`: Tracks if teacher added the word

#### 2. `student_vocab_usage`
Tracks vocabulary word usage across all lessons.

```sql
CREATE TABLE student_vocab_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES profiles(id),
  lexeme_id UUID NOT NULL REFERENCES lexemes(id),
  lesson_count INTEGER DEFAULT 0,           -- Global usage (0-3+ dots)
  focus_lesson_count INTEGER DEFAULT 0,     -- Focus Set usage (points)
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(student_id, lexeme_id)
);

-- Indexes
CREATE INDEX idx_vocab_usage_student ON student_vocab_usage(student_id);
CREATE INDEX idx_vocab_usage_lexeme ON student_vocab_usage(lexeme_id);
```

**Key Fields:**
- `lesson_count`: Total lessons where word was used (determines activation dots)
- `focus_lesson_count`: Lessons where word was used while in Focus Set (determines points)
- `last_used_at`: Most recent usage timestamp

#### 3. `lesson_goals_evidence`
Evidence of word usage within specific lessons.

```sql
CREATE TABLE lesson_goals_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES lessons(id),
  student_id UUID NOT NULL REFERENCES profiles(id),
  lexeme_id UUID NOT NULL REFERENCES lexemes(id),
  was_in_focus BOOLEAN DEFAULT false,       -- Was it in Focus Set?
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(lesson_id, student_id, lexeme_id)
);

-- Indexes
CREATE INDEX idx_lesson_goals_lesson ON lesson_goals_evidence(lesson_id);
CREATE INDEX idx_lesson_goals_student ON lesson_goals_evidence(student_id);
```

**Key Fields:**
- `was_in_focus`: TRUE if word was in Focus Set during this lesson (earns points)

#### 4. `lexemes`
Master vocabulary dictionary.

```sql
CREATE TABLE lexemes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lemma TEXT NOT NULL,                      -- Base form: "run"
  pos TEXT NOT NULL,                        -- Part of speech: "verb"
  cefr_level TEXT,                          -- A1, A2, B1, B2, C1, C2
  definition TEXT,
  example TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_lexemes_lemma ON lexemes(lemma);
CREATE INDEX idx_lexemes_cefr ON lexemes(cefr_level);
```

#### 5. `lesson_focus_snapshots`
Frozen Focus Set state at lesson start.

```sql
CREATE TABLE lesson_focus_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES lessons(id),
  student_id UUID NOT NULL REFERENCES profiles(id),
  lexeme_id UUID NOT NULL REFERENCES lexemes(id),
  snapshot_data JSONB,                      -- Full word metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(lesson_id, student_id, lexeme_id)
);

-- Indexes
CREATE INDEX idx_focus_snapshots_lesson ON lesson_focus_snapshots(lesson_id);
```

**Purpose:** Prevents Focus Set from changing mid-lesson if student adds/removes words.

---

## Core Hooks

### 1. `useFocusSet` Hook

**Location:** `/src/hooks/useFocusSet.ts`

**Purpose:** Fetches Focus Set words with snapshot support for lessons.

```typescript
interface UseFocusSetOptions {
  studentId?: string;
  lessonId?: string;
  lessonStatus?: 'scheduled' | 'in_progress' | 'completed';
  enabled?: boolean;
}

export function useFocusSet({
  studentId,
  lessonId,
  lessonStatus = 'scheduled',
  enabled = true
}: UseFocusSetOptions = {})
```

**Behavior:**
- **No lesson context or scheduled:** Returns live Focus Set (up to 5 words)
- **in_progress or completed lesson:** Returns frozen snapshot from lesson start

**Return Type:**
```typescript
{
  words: FocusSetWord[];        // Max 5 words
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  isSnapshot: boolean;          // TRUE if frozen snapshot
  emptySlots: number;           // 5 - words.length
}

interface FocusSetWord {
  id: string;                   // Goal ID
  lexeme_id: string;
  lemma: string;                // Display name
  pos: string;                  // Part of speech
  cefr_level: string | null;    // A1-C2
  lesson_count: number;         // Global usage (0-3+ dots)
  focus_lesson_count: number;   // Focus points earned
  is_stable: boolean;           // Always false (filtered)
  priority_rank: number;        // 1-5
}
```

**Database RPC Called:**
```sql
get_focus_set_for_lesson(
  student_uuid UUID,
  lesson_uuid UUID,           -- NULL for live Focus Set
  lesson_status TEXT          -- 'scheduled', 'in_progress', 'completed'
)
```

**Example Usage:**
```typescript
// In LiveGoalsPanel during lesson
const { words, isSnapshot, emptySlots } = useFocusSet({
  studentId: 'student-uuid',
  lessonId: 'lesson-uuid',
  lessonStatus: 'in_progress'
});

// Returns frozen snapshot from lesson start
// isSnapshot = true
```

---

### 2. `useVocabularyBuilder` Hook

**Location:** `/src/hooks/useVocabularyBuilder.ts`

**Purpose:** Manages all vocabulary goals with filtering, adding, archiving.

```typescript
interface UseVocabularyBuilderOptions {
  studentId?: string;
  filters?: VocabularyBuilderFilters;
  limit?: number;
  offset?: number;
  enabled?: boolean;
}

interface VocabularyBuilderFilters {
  search?: string;              // Search lemma
  cefr?: string;                // Filter by CEFR level
  status?: 'active' | 'passive' | 'archived' | 'all';
}

export function useVocabularyBuilder({
  studentId,
  filters = {},
  limit = 1000,
  offset = 0,
  enabled = true
}: UseVocabularyBuilderOptions = {})
```

**Return Type:**
```typescript
{
  words: VocabularyBuilderWord[];     // All goals (filtered)
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  stats: {
    total: number;
    active: number;      // Focus Set count
    passive: number;     // Non-focus goals
    archived: number;
  };
  // Mutations
  addWord: (lexemeId, targetCode) => Promise<void>;
  removeWord: (goalId) => Promise<void>;
  toggleActive: (goalId, isActive) => Promise<void>;
  archiveWord: (goalId) => Promise<void>;
  unarchiveWord: (goalId) => Promise<void>;
}

interface VocabularyBuilderWord {
  id: string;
  lexeme_id: string;
  lemma: string;
  pos: string;
  cefr_level: string | null;
  is_active_for_lessons: boolean;    // TRUE = Focus Set
  last_used_at: string | null;
  added_by_user_id: string | null;
  added_by_name: string | null;
  created_at: string;
  archived_at: string | null;
  usage_count: number;               // Total usages
  lesson_count: number;              // Lessons used in
  focus_lesson_count: number;        // Focus points
  is_stable: boolean;
  evidence_preview: Array<{
    lesson_id: string;
    created_at: string;
  }>;
}
```

**Database RPC Called:**
```sql
-- Fetch words
get_vocabulary_builder_words(
  student_uuid UUID,
  search_text TEXT,
  cefr_filter TEXT,
  status_filter TEXT,
  limit_val INTEGER,
  offset_val INTEGER
)

-- Stats
get_vocab_builder_stats(student_uuid UUID)

-- Toggle Focus Set
toggle_vocab_active_status(goal_uuid UUID, new_active_status BOOLEAN)

-- Archive/Unarchive
archive_vocab_goal(goal_uuid UUID)
unarchive_vocab_goal(goal_uuid UUID)
```

---

### 3. `useVocabRealTimeProcessing` Hook

**Location:** `/src/hooks/useVocabRealTimeProcessing.ts`

**Purpose:** Processes transcription segments in real-time during lessons.

```typescript
export function useVocabRealTimeProcessing()
```

**Return Type:**
```typescript
{
  mutateAsync: (request: VocabRealTimeRequest) => Promise<VocabRealTimeResponse>;
  isLoading: boolean;
  error: Error | null;
}

interface VocabRealTimeRequest {
  lessonId: string;
  segmentId: string;       // Transcription segment UUID
  studentId: string;
}

interface VocabRealTimeResponse {
  ok: boolean;
  message: string;
  alreadyProcessed?: boolean;
  wordsInserted?: number;
  tokensProcessed?: number;
  evidenceInserted?: number;
  lexemeIdsProcessed?: number;
}
```

**Edge Function Called:**
```
POST /functions/v1/vocab-ingest-segment
Body: { lessonId, segmentId, studentId }
```

**On Success:**
Dispatches custom event:
```typescript
window.dispatchEvent(new CustomEvent('vocab-realtime-completed', {
  detail: { 
    lessonId, 
    segmentId, 
    studentId, 
    result: VocabRealTimeResponse 
  }
}));
```

---

## API Functions

### Core Library: `/src/lib/goals.ts`

#### 1. Add Vocabulary Goal

```typescript
export async function addVocabGoal(
  studentId: string, 
  lexemeId: string,
  _targetCode?: string,        // Deprecated, kept for compatibility
  addedByUserId?: string       // Teacher who added it
): Promise<{ id: string } | null>
```

**Database Operation:**
```sql
INSERT INTO student_goals (student_id, lexeme_id, added_by_user_id)
VALUES (?, ?, ?)
ON CONFLICT (student_id, lexeme_id) DO NOTHING
RETURNING id;
```

**Returns:** 
- `{ id: string }` if added successfully
- `null` if already exists (23505 unique constraint violation)

---

#### 2. Toggle Focus Set Status

```typescript
export async function toggleVocabActiveStatus(
  goalId: string,
  isActive: boolean
): Promise<boolean>
```

**Database RPC:**
```sql
toggle_vocab_active_status(goal_uuid UUID, new_active_status BOOLEAN)
```

**Validation:**
- If activating: Checks if Focus Set already has 5 words
- If limit reached: Throws error "Focus Set is full (max 5 words)"
- Updates `is_active_for_lessons` field

---

#### 3. Archive/Unarchive Goals

```typescript
export async function archiveVocabGoal(goalId: string): Promise<boolean>
export async function unarchiveVocabGoal(goalId: string): Promise<boolean>
```

**Database RPCs:**
```sql
archive_vocab_goal(goal_uuid UUID)      -- Sets archived_at = now()
unarchive_vocab_goal(goal_uuid UUID)    -- Sets archived_at = NULL
```

**Behavior:**
- Archived words are soft-deleted (not removed from DB)
- Can be restored via unarchive
- Archived words don't appear in Active/Passive tabs

---

#### 4. Fetch Focus Set

```typescript
export async function fetchFocusSet(
  studentId: string,
  lessonId?: string,
  lessonStatus?: string
): Promise<FocusSetWord[]>
```

**Database RPC:**
```sql
get_focus_set_for_lesson(
  student_uuid UUID,
  lesson_uuid UUID,
  lesson_status TEXT
)
RETURNS TABLE (
  id UUID,
  lexeme_id UUID,
  lemma TEXT,
  pos TEXT,
  cefr_level TEXT,
  lesson_count INTEGER,
  focus_lesson_count INTEGER,
  is_stable BOOLEAN,
  priority_rank INTEGER
)
```

**Logic:**
```sql
-- If lesson_uuid IS NULL OR lesson_status = 'scheduled'
  -- Return live Focus Set (is_active_for_lessons = true)
  SELECT * FROM student_goals sg
  JOIN lexemes l ON sg.lexeme_id = l.id
  LEFT JOIN student_vocab_usage svu ON sg.student_id = svu.student_id 
    AND sg.lexeme_id = svu.lexeme_id
  WHERE sg.student_id = student_uuid
    AND sg.is_active_for_lessons = true
    AND sg.archived_at IS NULL
    AND svu.is_stable = false
  ORDER BY sg.created_at ASC
  LIMIT 5;

-- If lesson_status IN ('in_progress', 'completed')
  -- Return frozen snapshot from lesson start
  SELECT * FROM lesson_focus_snapshots lfs
  JOIN lexemes l ON lfs.lexeme_id = l.id
  WHERE lfs.lesson_id = lesson_uuid
    AND lfs.student_id = student_uuid
  ORDER BY lfs.created_at ASC;
```

---

#### 5. Fetch Vocabulary Builder Words

```typescript
export async function fetchVocabularyBuilder(
  studentId: string,
  filters: VocabularyBuilderFilters = {},
  limit: number = 50,
  offset: number = 0
): Promise<VocabularyBuilderWord[]>
```

**Database RPC:**
```sql
get_vocabulary_builder_words(
  student_uuid UUID,
  search_text TEXT,
  cefr_filter TEXT,
  status_filter TEXT,      -- 'active', 'passive', 'archived', 'all'
  limit_val INTEGER,
  offset_val INTEGER
)
```

**Filtering Logic:**
```sql
-- status_filter = 'active': is_active_for_lessons = true
-- status_filter = 'passive': is_active_for_lessons = false AND archived_at IS NULL
-- status_filter = 'archived': archived_at IS NOT NULL
-- status_filter = 'all': Everything (except archived)

SELECT 
  sg.*,
  l.lemma,
  l.pos,
  l.cefr_level,
  svu.lesson_count,
  svu.focus_lesson_count,
  svu.last_used_at,
  svu.is_stable,
  p.full_name as added_by_name,
  COALESCE(
    (SELECT json_agg(json_build_object('lesson_id', lesson_id, 'created_at', created_at))
     FROM lesson_goals_evidence
     WHERE student_id = student_uuid AND lexeme_id = sg.lexeme_id
     ORDER BY created_at DESC LIMIT 3),
    '[]'::json
  ) as evidence_preview
FROM student_goals sg
JOIN lexemes l ON sg.lexeme_id = l.id
LEFT JOIN student_vocab_usage svu ON ...
LEFT JOIN profiles p ON sg.added_by_user_id = p.id
WHERE sg.student_id = student_uuid
  AND (search_text IS NULL OR l.lemma ILIKE '%' || search_text || '%')
  AND (cefr_filter IS NULL OR l.cefr_level = cefr_filter)
  AND [status_filter logic]
ORDER BY sg.created_at DESC
LIMIT limit_val OFFSET offset_val;
```

---

## Live Lesson Flow

### Step-by-Step Sequence

#### **1. Lesson Start (Frontend)**

```typescript
// Location: /src/pages/LiveLessonCall.tsx
// When lesson page loads

const LiveLessonCall = () => {
  const { lessonId, studentId } = useParams();
  
  // Render Goals tab in sidebar
  return (
    <TabsContent value="goals">
      <LiveGoalsPanel 
        lessonId={lessonId}
        studentId={studentId}
        lessonStatus="in_progress"
      />
    </TabsContent>
  );
};
```

#### **2. Load Focus Set Snapshot**

```typescript
// Location: /src/components/lessons/LiveGoalsPanel.tsx

const LiveGoalsPanel = ({ lessonId, studentId, lessonStatus }) => {
  // Fetch frozen snapshot
  const { words, isSnapshot } = useFocusSet({
    studentId,
    lessonId,
    lessonStatus: 'in_progress'
  });
  
  // words = Focus Set from lesson start (max 5)
  // isSnapshot = true
  
  return (
    <div>
      <h3>Focus Set</h3>
      <Badge>{words.length} / 5</Badge>
      {isSnapshot && <Badge>Frozen</Badge>}
      
      {words.map(word => (
        <Card key={word.id}>
          <span>{word.lemma}</span>
          <Badge>{word.cefr_level}</Badge>
          <ActivationDots count={word.lesson_count} />
          {word.focus_lesson_count > 0 && (
            <span>+{word.focus_lesson_count} pts</span>
          )}
        </Card>
      ))}
    </div>
  );
};
```

#### **3. Student Speaks → Transcription**

```typescript
// Location: /src/components/live/TranscriptionPanel.tsx

const TranscriptionPanel = ({ lessonId, studentId }) => {
  const vocabProcessing = useVocabRealTimeProcessing();
  
  // When new transcription segment arrives
  const handleNewSegment = async (segment) => {
    // Trigger real-time vocabulary processing
    await vocabProcessing.mutateAsync({
      lessonId,
      segmentId: segment.id,
      studentId
    });
  };
  
  // Listen to transcription events
  useEffect(() => {
    // Subscribe to transcription stream
    // On each new segment → handleNewSegment()
  }, []);
};
```

#### **4. Real-Time Vocabulary Processing**

```typescript
// Edge Function: /supabase/functions/vocab-ingest-segment/index.ts

Deno.serve(async (req) => {
  const { lessonId, segmentId, studentId } = await req.json();
  
  // 1. Fetch transcription segment text
  const { data: segment } = await supabase
    .from('transcription_segments')
    .select('text')
    .eq('id', segmentId)
    .single();
  
  // 2. Tokenize text (split into words)
  const tokens = tokenize(segment.text);  // ["I", "really", "like", "this", "movie"]
  
  // 3. Match tokens against lexemes dictionary
  const matchedLexemes = await matchTokensToLexemes(tokens);
  // Returns: [{ token: "like", lexeme_id: "xxx", lemma: "like", pos: "verb" }]
  
  // 4. For each matched lexeme:
  for (const match of matchedLexemes) {
    // a) Check if word is in student's goals
    const { data: goal } = await supabase
      .from('student_goals')
      .select('id, is_active_for_lessons')
      .eq('student_id', studentId)
      .eq('lexeme_id', match.lexeme_id)
      .maybeSingle();
    
    if (!goal) continue;  // Not a goal, skip
    
    // b) Upsert usage record
    await supabase.rpc('upsert_vocab_usage', {
      p_student_id: studentId,
      p_lexeme_id: match.lexeme_id,
      p_is_focus: goal.is_active_for_lessons
    });
    // Increments lesson_count (always)
    // Increments focus_lesson_count (if is_active_for_lessons = true)
    
    // c) Insert evidence record
    await supabase
      .from('lesson_goals_evidence')
      .insert({
        lesson_id: lessonId,
        student_id: studentId,
        lexeme_id: match.lexeme_id,
        was_in_focus: goal.is_active_for_lessons
      })
      .onConflict('lesson_id, student_id, lexeme_id')
      .ignore();
  }
  
  return new Response(JSON.stringify({
    ok: true,
    wordsInserted: matchedLexemes.length,
    tokensProcessed: tokens.length
  }));
});
```

**Key RPC: `upsert_vocab_usage`**

```sql
CREATE OR REPLACE FUNCTION upsert_vocab_usage(
  p_student_id UUID,
  p_lexeme_id UUID,
  p_is_focus BOOLEAN
)
RETURNS void AS $$
BEGIN
  INSERT INTO student_vocab_usage (
    student_id,
    lexeme_id,
    lesson_count,
    focus_lesson_count,
    last_used_at
  )
  VALUES (
    p_student_id,
    p_lexeme_id,
    1,
    CASE WHEN p_is_focus THEN 1 ELSE 0 END,
    now()
  )
  ON CONFLICT (student_id, lexeme_id) DO UPDATE SET
    lesson_count = student_vocab_usage.lesson_count + 1,
    focus_lesson_count = student_vocab_usage.focus_lesson_count + 
      CASE WHEN p_is_focus THEN 1 ELSE 0 END,
    last_used_at = now();
END;
$$ LANGUAGE plpgsql;
```

#### **5. Dispatch Real-Time Event**

```typescript
// After edge function completes successfully

window.dispatchEvent(new CustomEvent('vocab-realtime-completed', {
  detail: { 
    lessonId,
    segmentId,
    studentId,
    result: { ok: true, wordsInserted: 3 }
  }
}));
```

#### **6. UI Updates**

```typescript
// Location: /src/components/lessons/LiveGoalsPanel.tsx

useEffect(() => {
  const handleUpdate = (event: CustomEvent) => {
    const { lessonId: eventLessonId, studentId: eventStudentId } = event.detail;
    
    if (eventLessonId === lessonId && eventStudentId === studentId) {
      console.log('Processing completed, refreshing Focus Set');
      refetch();  // Re-fetch Focus Set data
    }
  };
  
  window.addEventListener('vocab-realtime-completed', handleUpdate);
  
  return () => {
    window.removeEventListener('vocab-realtime-completed', handleUpdate);
  };
}, [lessonId, studentId, refetch]);
```

**UI Display Updates:**

```
Before:
┌─────────────────────────────────┐
│ moreover    B2    ●○○           │  lesson_count = 1
│ example     A1    ●●○    +1 pt  │  focus_lesson_count = 1
└─────────────────────────────────┘

After speaking "moreover":
┌─────────────────────────────────┐
│ moreover    B2    ●●○    +1 pt  │  lesson_count = 2, focus_lesson_count = 1
│ example     A1    ●●○    +1 pt  │  (unchanged)
└─────────────────────────────────┘
```

---

## UI Components

### 1. LiveGoalsPanel

**Location:** `/src/components/lessons/LiveGoalsPanel.tsx`

**Purpose:** Displays Focus Set during live lessons (sidebar panel).

**Features:**
- Shows max 5 Focus Set words
- Displays CEFR level badge
- Shows activation dots (0-3 based on `lesson_count`)
- Shows points earned (`+X pts` based on `focus_lesson_count`)
- "Frozen" badge for snapshot mode
- Empty slot placeholders
- Real-time updates via event listeners

**Component Structure:**

```tsx
<div className="space-y-3">
  <div className="flex items-center gap-2">
    <Sparkles />
    <h3>Focus Set</h3>
    <Badge>{words.length} / 5</Badge>
    {isSnapshot && <Badge>Frozen</Badge>}
  </div>
  
  <p>These words earn progress when you use them in speech.</p>
  
  {words.map(word => (
    <Card key={word.id}>
      <span>{word.lemma}</span>
      <Badge>{word.cefr_level}</Badge>
      <ActivationDots count={word.lesson_count} />
      {word.focus_lesson_count > 0 && (
        <span>+{word.focus_lesson_count} pts</span>
      )}
    </Card>
  ))}
  
  {/* Empty slots */}
  {Array.from({ length: emptySlots }).map((_, i) => (
    <div className="border-dashed">Empty slot</div>
  ))}
</div>
```

---

### 2. ActivationDots Component

**Purpose:** Visual indicator of global word usage (0-3 dots).

```tsx
function ActivationDots({ count, max = 3 }: { count: number; max?: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "w-2 h-2 rounded-full",
            i < count 
              ? "bg-brand-blue"    // Filled dot
              : "bg-muted"          // Empty dot
          )}
        />
      ))}
    </div>
  );
}
```

**Example:**
- `lesson_count = 0`: `○○○` (0 filled)
- `lesson_count = 1`: `●○○` (1 filled)
- `lesson_count = 2`: `●●○` (2 filled)
- `lesson_count = 3+`: `●●●` (3 filled, maxed out)

---

### 3. FocusSetSection (Vocabulary Builder)

**Location:** `/src/components/vocabulary/FocusSetSection.tsx`

**Purpose:** Manages Focus Set in Vocabulary Builder (add/remove words).

**Features:**
- Shows current 5 Focus Set words
- Drag-to-reorder (priority ranking)
- Remove from Focus button
- Max 5 words enforcement
- Empty slot placeholders

---

### 4. GoalPoolSection (Vocabulary Builder)

**Location:** `/src/components/vocabulary/GoalPoolSection.tsx`

**Purpose:** Displays "All Goals" with tabs and filtering.

**Tabs:**
1. **All Goals**: Shows all non-archived goals
2. **Focus Set (5)**: Shows only active goals (`is_active_for_lessons = true`)
3. **Passive**: Shows non-active, non-archived goals
4. **Archived**: Shows archived goals

**Features:**
- Search by word name
- Filter by CEFR level
- Add to Focus Set button (if < 5)
- Archive button
- Usage stats (dots + points)

---

## Real-time Updates

### Event System

The system uses browser `CustomEvent` for real-time communication between components.

#### **Event: `vocab-realtime-completed`**

**Dispatched by:** `useVocabRealTimeProcessing` hook after edge function success

**Payload:**
```typescript
{
  detail: {
    lessonId: string;
    segmentId: string;
    studentId: string;
    result: VocabRealTimeResponse;
  }
}
```

**Listeners:**
- `LiveGoalsPanel` → Refetches Focus Set data
- `TranscriptionPanel` → Updates processing status
- `VocabularyBuilder` (if open) → Refetches goals

#### **Event: `grammar-realtime-completed`**

Similar to vocab, but for grammar tracking (separate system).

---

### Polling vs Events

**Current System:** Event-based (more efficient)

```typescript
// Component A: Dispatch event
window.dispatchEvent(new CustomEvent('vocab-realtime-completed', { detail }));

// Component B: Listen for event
useEffect(() => {
  const handler = (e: CustomEvent) => {
    if (e.detail.lessonId === myLessonId) {
      refetch();  // Update UI
    }
  };
  
  window.addEventListener('vocab-realtime-completed', handler);
  return () => window.removeEventListener('vocab-realtime-completed', handler);
}, []);
```

**Alternative for Mobile:** 
- Could use WebSockets for cross-device sync
- Could poll every 10-30 seconds during active lesson
- Could use Supabase Realtime subscriptions

---

## Mobile Implementation Guide

### Architecture Recommendations

#### **Option 1: REST API + Polling (Simplest)**

```
Mobile App
├── API Client (REST)
├── Local State Management (Redux/MobX)
├── Focus Set Screen
│   ├── Fetch on mount
│   ├── Poll every 15s during lesson
│   └── Update UI on response
└── Vocabulary Builder Screen
```

**Pros:**
- Simple implementation
- No WebSocket complexity
- Works offline (with cache)

**Cons:**
- Not truly real-time (15s delay)
- Increased API calls
- Battery usage

---

#### **Option 2: WebSocket + Event System (Best)**

```
Mobile App
├── WebSocket Client (Supabase Realtime)
├── Local State Management
├── Focus Set Screen
│   ├── Subscribe to vocab updates
│   ├── Listen for 'vocab_usage_updated' events
│   └── Update UI immediately
└── Real-time sync across all screens
```

**Implementation:**
```typescript
// Subscribe to student's vocab updates
const channel = supabase
  .channel('vocab-updates')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'student_vocab_usage',
    filter: `student_id=eq.${studentId}`
  }, (payload) => {
    // payload.new = updated row
    updateFocusSetUI(payload.new);
  })
  .subscribe();
```

**Pros:**
- True real-time updates
- Efficient (push vs poll)
- Better UX

**Cons:**
- More complex setup
- Requires persistent connection
- Offline handling needed

---

#### **Option 3: Hybrid (Recommended)**

```
Mobile App
├── REST API for CRUD operations
├── WebSocket for live lesson updates only
├── Local SQLite cache
└── Background sync when online
```

**Strategy:**
1. Use REST APIs for all goal management (add/remove/archive)
2. Enable WebSocket only during active lessons
3. Cache Focus Set locally
4. Sync on app resume

---

### Core API Endpoints to Implement

#### **1. Get Focus Set**

```http
GET /rest/v1/rpc/get_focus_set_for_lesson
Content-Type: application/json
Authorization: Bearer {jwt}

{
  "student_uuid": "...",
  "lesson_uuid": "...",    // null for live Focus Set
  "lesson_status": "in_progress"
}

Response:
[
  {
    "id": "...",
    "lexeme_id": "...",
    "lemma": "moreover",
    "pos": "adverb",
    "cefr_level": "B2",
    "lesson_count": 2,
    "focus_lesson_count": 1,
    "is_stable": false,
    "priority_rank": 1
  },
  ...
]
```

---

#### **2. Get Vocabulary Builder Words**

```http
GET /rest/v1/rpc/get_vocabulary_builder_words
Content-Type: application/json
Authorization: Bearer {jwt}

{
  "student_uuid": "...",
  "search_text": null,
  "cefr_filter": null,
  "status_filter": "all",    // 'active', 'passive', 'archived', 'all'
  "limit_val": 50,
  "offset_val": 0
}

Response: Array of VocabularyBuilderWord
```

---

#### **3. Add Word to Goals**

```http
POST /rest/v1/student_goals
Content-Type: application/json
Authorization: Bearer {jwt}

{
  "student_id": "...",
  "lexeme_id": "...",
  "is_active_for_lessons": false,
  "added_by_user_id": "..."
}

Response: { id: "..." }
```

---

#### **4. Toggle Focus Set**

```http
POST /rest/v1/rpc/toggle_vocab_active_status
Content-Type: application/json
Authorization: Bearer {jwt}

{
  "goal_uuid": "...",
  "new_active_status": true
}

Response: true | false
```

---

#### **5. Archive Word**

```http
POST /rest/v1/rpc/archive_vocab_goal
Content-Type: application/json
Authorization: Bearer {jwt}

{
  "goal_uuid": "..."
}

Response: true | false
```

---

#### **6. Process Transcription Segment**

```http
POST /functions/v1/vocab-ingest-segment
Content-Type: application/json
Authorization: Bearer {jwt}

{
  "lessonId": "...",
  "segmentId": "...",
  "studentId": "..."
}

Response:
{
  "ok": true,
  "message": "Processed",
  "wordsInserted": 3,
  "tokensProcessed": 15,
  "evidenceInserted": 2
}
```

---

### State Management Pattern

#### **Redux Store Structure (Example)**

```typescript
{
  focusSet: {
    words: FocusSetWord[],
    isSnapshot: boolean,
    loading: boolean,
    error: string | null,
    lastUpdated: timestamp
  },
  vocabularyBuilder: {
    allWords: VocabularyBuilderWord[],
    filters: {
      search: string,
      cefr: string | null,
      status: 'active' | 'passive' | 'archived' | 'all'
    },
    stats: {
      total: number,
      active: number,
      passive: number,
      archived: number
    },
    loading: boolean,
    error: string | null
  },
  liveLesson: {
    isActive: boolean,
    lessonId: string | null,
    realtimeConnected: boolean
  }
}
```

#### **Actions**

```typescript
// Fetch Focus Set
fetchFocusSet(studentId, lessonId?, lessonStatus?)

// Fetch Vocabulary Builder
fetchVocabularyBuilder(studentId, filters)

// Add Goal
addVocabGoal(studentId, lexemeId)

// Toggle Focus
toggleFocusSet(goalId, isActive)

// Archive/Unarchive
archiveGoal(goalId)
unarchiveGoal(goalId)

// Real-time update (from WebSocket)
updateVocabUsage(lexemeId, newCounts)
```

---

### Caching Strategy

**Recommended:** 
- Cache Focus Set for 30 seconds (stale-while-revalidate)
- Cache Vocabulary Builder words for 5 minutes
- Invalidate cache on mutations (add/remove/archive)
- Use optimistic updates for better UX

```typescript
// Optimistic update example
const toggleFocus = async (goalId: string, isActive: boolean) => {
  // 1. Update local state immediately
  dispatch(optimisticToggleFocus(goalId, isActive));
  
  // 2. Make API call
  try {
    await api.toggleVocabActiveStatus(goalId, isActive);
  } catch (error) {
    // 3. Rollback on error
    dispatch(rollbackToggleFocus(goalId));
    showError(error);
  }
};
```

---

### Testing Checklist

- [ ] Fetch Focus Set (live)
- [ ] Fetch Focus Set (snapshot for in_progress lesson)
- [ ] Fetch Focus Set (snapshot for completed lesson)
- [ ] Add word to goals
- [ ] Add word to Focus Set (activate)
- [ ] Remove word from Focus Set (deactivate)
- [ ] Archive word
- [ ] Unarchive word
- [ ] Handle "Focus Set full" error (max 5)
- [ ] Search vocabulary builder
- [ ] Filter by CEFR level
- [ ] Filter by status (active/passive/archived)
- [ ] Real-time vocab tracking during lesson
- [ ] Display activation dots (0-3)
- [ ] Display focus points earned
- [ ] Handle offline mode
- [ ] Sync after reconnection
- [ ] Optimistic UI updates

---

## Appendix

### Key Database Queries

#### Get Live Focus Set (Max 5)

```sql
SELECT 
  sg.id,
  sg.lexeme_id,
  l.lemma,
  l.pos,
  l.cefr_level,
  COALESCE(svu.lesson_count, 0) as lesson_count,
  COALESCE(svu.focus_lesson_count, 0) as focus_lesson_count,
  COALESCE(svu.is_stable, false) as is_stable,
  ROW_NUMBER() OVER (ORDER BY sg.created_at ASC) as priority_rank
FROM student_goals sg
JOIN lexemes l ON sg.lexeme_id = l.id
LEFT JOIN student_vocab_usage svu ON sg.student_id = svu.student_id 
  AND sg.lexeme_id = svu.lexeme_id
WHERE sg.student_id = $1
  AND sg.is_active_for_lessons = true
  AND sg.archived_at IS NULL
  AND COALESCE(svu.is_stable, false) = false
ORDER BY sg.created_at ASC
LIMIT 5;
```

---

#### Get Focus Set Snapshot for Lesson

```sql
SELECT 
  lfs.id,
  lfs.lexeme_id,
  lfs.snapshot_data->>'lemma' as lemma,
  lfs.snapshot_data->>'pos' as pos,
  lfs.snapshot_data->>'cefr_level' as cefr_level,
  (lfs.snapshot_data->>'lesson_count')::integer as lesson_count,
  (lfs.snapshot_data->>'focus_lesson_count')::integer as focus_lesson_count,
  false as is_stable,
  ROW_NUMBER() OVER (ORDER BY lfs.created_at ASC) as priority_rank
FROM lesson_focus_snapshots lfs
WHERE lfs.lesson_id = $1
  AND lfs.student_id = $2
ORDER BY lfs.created_at ASC;
```

---

#### Increment Vocab Usage Counters

```sql
INSERT INTO student_vocab_usage (
  student_id,
  lexeme_id,
  lesson_count,
  focus_lesson_count,
  last_used_at
)
VALUES ($1, $2, 1, $3, now())
ON CONFLICT (student_id, lexeme_id) DO UPDATE SET
  lesson_count = student_vocab_usage.lesson_count + 1,
  focus_lesson_count = student_vocab_usage.focus_lesson_count + $3,
  last_used_at = now();
  
-- $3 = 1 if word is in Focus Set, 0 otherwise
```

---

### Glossary

- **Focus Set**: Top 5 priority vocabulary words tracked during lessons
- **Activation Dots**: Visual indicator (0-3 dots) of global word usage across all lessons
- **Focus Points**: Points earned when using Focus Set words in lessons
- **Snapshot**: Frozen Focus Set state captured at lesson start
- **Stable Word**: Mastered word that's no longer tracked (hidden from UI)
- **Lexeme**: Canonical form of a word (e.g., "run" for "running", "ran", "runs")
- **CEFR Level**: Common European Framework of Reference (A1-C2 scale)

---

**End of Document**
