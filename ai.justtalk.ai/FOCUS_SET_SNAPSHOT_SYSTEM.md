# Focus Set Snapshot System

**Last Updated:** January 30, 2026  
**Platform:** JustTalk.ai Web & Mobile Apps  
**Purpose:** Freeze student's Focus Set vocabulary at lesson start for consistent tracking

---

## Table of Contents

1. [Overview](#overview)
2. [Why Snapshots?](#why-snapshots)
3. [System Architecture](#system-architecture)
4. [Database Schema](#database-schema)
5. [How Snapshots Work](#how-snapshots-work)
6. [Using Snapshots in Live Lessons](#using-snapshots-in-live-lessons)
7. [Frontend Implementation](#frontend-implementation)
8. [Mobile Implementation Guide](#mobile-implementation-guide)
9. [Testing & Validation](#testing--validation)

---

## Overview

The **Focus Set Snapshot System** preserves a student's 5 priority vocabulary words at the exact moment a lesson starts. This ensures:

- ✅ **Consistency:** Students and teachers see the same goals throughout the entire lesson
- ✅ **Historical Accuracy:** Can review what was targeted in past lessons
- ✅ **No Mid-Lesson Changes:** Students can't modify Focus Set during active lessons
- ✅ **Data Integrity:** Real-time usage tracking continues independently

### Key Concepts

| Term | Definition |
|------|------------|
| **Focus Set** | Student's top 5 priority vocabulary words for active learning |
| **Snapshot** | Frozen copy of Focus Set captured at lesson start |
| **Live Focus Set** | Current active goals (can be modified anytime) |
| **Snapshot Mode** | Display frozen snapshot instead of live data during lessons |
| **Historical View** | Read-only snapshot view for completed lessons |

---

## Why Snapshots?

### Problem Without Snapshots

```
Lesson starts with Focus Set:
1. moreover (B2)
2. however (B2)
3. although (B1)
4. therefore (B2)
5. furthermore (B2)

15 minutes into lesson:
- Student removes "moreover" from Focus Set
- Student adds "because" to Focus Set

UI now shows:
1. however (B2)
2. although (B1)
3. therefore (B2)
4. furthermore (B2)
5. because (A2)  ← NEW

Result:
❌ Teacher sees different goals than student practiced
❌ Can't review what was actually targeted
❌ Inconsistent lesson analytics
```

### Solution With Snapshots

```
Lesson starts → Snapshot created with 5 words

15 minutes later:
- Student modifies Focus Set
- Lesson UI continues showing original snapshot
- Backend tracks ALL word usage (both sets)

After lesson:
✅ Teacher and student see same goals in review
✅ Historical record preserved
✅ Backend has complete usage data
```

---

## System Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Focus Set Snapshot System                 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Lesson Creation                                         │
│     └─→ INSERT INTO lessons (status='scheduled')           │
│         └─→ TRIGGER: snapshot_active_goals_on_lesson_start()│
│             └─→ INSERT INTO lesson_active_goals_snapshot   │
│                                                              │
│  2. Lesson Start (Frontend)                                 │
│     └─→ LiveLessonCall component loads                     │
│         └─→ LiveGoalsPanel component                       │
│             └─→ useFocusSet(lessonId, 'in_progress')      │
│                 └─→ RPC: get_focus_set_for_lesson()        │
│                     └─→ Returns frozen snapshot            │
│                                                              │
│  3. During Lesson                                           │
│     ├─→ UI displays frozen snapshot (read-only)            │
│     └─→ Backend tracks real-time usage                     │
│         └─→ student_lexeme_history updated                 │
│                                                              │
│  4. After Lesson                                            │
│     └─→ Historical view                                     │
│         └─→ useFocusSet(lessonId, 'completed')            │
│             └─→ Returns same frozen snapshot               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### Core Tables

#### 1. `lesson_active_goals_snapshot` (Snapshot Storage)

```sql
CREATE TABLE lesson_active_goals_snapshot (
  lesson_id UUID NOT NULL,
  student_id UUID NOT NULL,
  goal_id UUID NOT NULL,
  lexeme_id UUID NOT NULL,
  lemma TEXT NOT NULL,                    -- "moreover"
  pos TEXT,                               -- "adverb"
  cefr_level TEXT,                        -- "B2"
  lesson_count INTEGER,                   -- Usage count at snapshot time
  focus_lesson_count INTEGER,             -- Focus points at snapshot time
  is_stable BOOLEAN,                      -- Mastery flag
  priority_rank INTEGER,                  -- 1-5 ranking
  created_at TIMESTAMPTZ DEFAULT now(),
  
  PRIMARY KEY (lesson_id, goal_id),
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
  FOREIGN KEY (goal_id) REFERENCES student_goals(id) ON DELETE CASCADE,
  FOREIGN KEY (lexeme_id) REFERENCES lexemes(id)
);

CREATE INDEX idx_snapshot_lesson ON lesson_active_goals_snapshot(lesson_id);
CREATE INDEX idx_snapshot_student ON lesson_active_goals_snapshot(student_id);
```

**Purpose:** Immutable historical record of Focus Set at lesson start

**Key Fields:**
- `lesson_count`: Global usage count **at the moment of snapshot** (frozen)
- `focus_lesson_count`: Focus points earned **before this lesson** (frozen)
- `priority_rank`: 1-5 ranking based on recency at snapshot time

---

#### 2. `student_goals` (Live Source)

```sql
CREATE TABLE student_goals (
  id UUID PRIMARY KEY,
  student_id UUID NOT NULL,
  lexeme_id UUID NOT NULL,
  is_active_for_lessons BOOLEAN DEFAULT false,  -- TRUE = in Focus Set
  last_used_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(student_id, lexeme_id)
);

CREATE INDEX idx_goals_active ON student_goals(student_id) 
  WHERE is_active_for_lessons = true AND archived_at IS NULL;
```

**Purpose:** Current state of student's vocabulary goals (live, mutable)

---

#### 3. `student_lexeme_history` (Real-Time Tracking)

```sql
CREATE TABLE student_lexeme_history (
  student_id UUID,
  lexeme_id UUID,
  lesson_count INTEGER,                    -- Updated in real-time
  focus_lesson_count INTEGER,              -- Updated in real-time
  last_used_at TIMESTAMPTZ,
  is_stable BOOLEAN,
  
  PRIMARY KEY (student_id, lexeme_id)
);
```

**Purpose:** Live usage tracking (updated during lessons, NOT frozen)

---

## How Snapshots Work

### Phase 1: Lesson Creation (Automatic)

**Trigger:** When a lesson is created with `status = 'scheduled'`

```sql
CREATE TRIGGER trigger_snapshot_active_goals
  AFTER INSERT OR UPDATE OF status ON lessons
  FOR EACH ROW
  EXECUTE FUNCTION snapshot_active_goals_on_lesson_start();
```

**Trigger Function Logic:**

```sql
CREATE OR REPLACE FUNCTION snapshot_active_goals_on_lesson_start()
RETURNS TRIGGER AS $$
BEGIN
  -- Trigger fires on INSERT with status='scheduled' OR 
  -- UPDATE from any status to 'in_progress'
  IF (TG_OP = 'INSERT' AND NEW.status = 'scheduled') OR 
     (TG_OP = 'UPDATE' AND NEW.status = 'in_progress' AND OLD.status != 'in_progress') 
  THEN
    
    -- Check if snapshot already exists (idempotent)
    IF NOT EXISTS (
      SELECT 1 FROM lesson_active_goals_snapshot
      WHERE lesson_id = NEW.id
    ) THEN
      
      -- Capture current Focus Set (top 5 active goals)
      INSERT INTO lesson_active_goals_snapshot (
        lesson_id,
        student_id,
        goal_id,
        lexeme_id,
        lemma,
        pos,
        cefr_level,
        lesson_count,
        focus_lesson_count,
        is_stable,
        priority_rank
      )
      SELECT
        NEW.id AS lesson_id,
        NEW.student_id,
        sg.id AS goal_id,
        sg.lexeme_id,
        l.lemma,
        l.pos,
        l.cefr_level,
        COALESCE(slh.lesson_count, 0) AS lesson_count,      -- Current count
        COALESCE(slh.focus_lesson_count, 0) AS focus_lesson_count,
        COALESCE(slh.is_stable, false) AS is_stable,
        ROW_NUMBER() OVER (ORDER BY sg.last_used_at ASC) AS priority_rank
      FROM student_goals sg
      JOIN lexemes l ON l.id = sg.lexeme_id
      LEFT JOIN student_lexeme_history slh 
        ON slh.student_id = NEW.student_id 
        AND slh.lexeme_id = sg.lexeme_id
      WHERE sg.student_id = NEW.student_id
        AND sg.is_active_for_lessons = true
        AND sg.archived_at IS NULL
        AND COALESCE(slh.is_stable, false) = false
      ORDER BY sg.last_used_at ASC
      LIMIT 5;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Result:** Snapshot is created **immediately** when lesson is scheduled, containing:
- Current top 5 active goals
- Current usage stats (frozen)
- Priority ranking

---

### Phase 2: Fetching Snapshot (Frontend)

**RPC Function:** `get_focus_set_for_lesson(student_uuid, lesson_uuid, lesson_status)`

```sql
CREATE OR REPLACE FUNCTION get_focus_set_for_lesson(
  student_uuid UUID,
  lesson_uuid UUID DEFAULT NULL,
  lesson_status TEXT DEFAULT 'scheduled'
)
RETURNS TABLE(
  id UUID,
  lexeme_id UUID,
  lemma TEXT,
  pos TEXT,
  cefr_level TEXT,
  lesson_count INT,
  focus_lesson_count INT,
  is_stable BOOLEAN,
  priority_rank INT
)
AS $$
BEGIN
  -- DECISION TREE
  
  -- Path 1: Return snapshot for in_progress or completed lessons
  IF lesson_uuid IS NOT NULL 
     AND lesson_status IN ('in_progress', 'completed') 
  THEN
    IF EXISTS (
      SELECT 1 FROM lesson_active_goals_snapshot
      WHERE lesson_id = lesson_uuid
    ) THEN
      -- Return frozen snapshot
      RETURN QUERY
      SELECT
        snap.goal_id AS id,
        snap.lexeme_id,
        snap.lemma,
        snap.pos,
        snap.cefr_level,
        snap.lesson_count,
        snap.focus_lesson_count,
        snap.is_stable,
        snap.priority_rank::INT
      FROM lesson_active_goals_snapshot snap
      WHERE snap.lesson_id = lesson_uuid
        AND snap.student_id = student_uuid
        AND snap.is_stable = false
      ORDER BY snap.priority_rank
      LIMIT 5;
      
      RETURN;  -- Exit early
    END IF;
  END IF;

  -- Path 2: Return live Focus Set (fallback or scheduled status)
  RETURN QUERY
  SELECT
    sg.id,
    sg.lexeme_id,
    l.lemma,
    l.pos,
    l.cefr_level,
    COALESCE(slh.lesson_count, 0)::INT,
    COALESCE(slh.focus_lesson_count, 0)::INT,
    COALESCE(slh.is_stable, false),
    ROW_NUMBER() OVER (ORDER BY sg.last_used_at ASC)::INT AS priority_rank
  FROM student_goals sg
  JOIN lexemes l ON l.id = sg.lexeme_id
  LEFT JOIN student_lexeme_history slh 
    ON slh.student_id = student_uuid 
    AND slh.lexeme_id = sg.lexeme_id
  WHERE sg.student_id = student_uuid
    AND sg.is_active_for_lessons = true
    AND sg.archived_at IS NULL
    AND COALESCE(slh.is_stable, false) = false
  ORDER BY sg.last_used_at ASC
  LIMIT 5;
END;
$$ LANGUAGE plpgsql;
```

**Decision Flow:**

```
get_focus_set_for_lesson() called
├─ lesson_uuid provided?
│  ├─ YES
│  │  └─ lesson_status = 'in_progress' OR 'completed'?
│  │     ├─ YES
│  │     │  └─ Snapshot exists in DB?
│  │     │     ├─ YES → Return FROZEN snapshot ✅
│  │     │     └─ NO → Return LIVE Focus Set (fallback)
│  │     └─ NO (status = 'scheduled')
│  │        └─ Return LIVE Focus Set
│  └─ NO
│     └─ Return LIVE Focus Set
```

---

## Using Snapshots in Live Lessons

### Frontend Flow

#### 1. Component Setup

**Location:** `src/pages/LiveLessonCall.tsx`

```tsx
import { LiveGoalsPanel } from '@/components/lessons/LiveGoalsPanel';

export const LiveLessonCall = () => {
  const { lessonId } = useParams();
  const lessonQuery = useLessonDetails(lessonId);
  
  return (
    <TabsContent value="goals">
      <LiveGoalsPanel
        lessonId={lessonId}
        studentId={lessonQuery.data.student_id}
        lessonStatus="in_progress"  // Critical: triggers snapshot mode
      />
    </TabsContent>
  );
};
```

---

#### 2. LiveGoalsPanel Component

**Location:** `src/components/lessons/LiveGoalsPanel.tsx`

```tsx
import { useFocusSet } from '@/hooks/useFocusSet';

interface LiveGoalsPanelProps {
  lessonId: string;
  studentId: string;
  lessonStatus: 'scheduled' | 'in_progress' | 'completed';
}

export const LiveGoalsPanel: React.FC<LiveGoalsPanelProps> = ({
  lessonId,
  studentId,
  lessonStatus = 'in_progress'
}) => {
  // Fetch snapshot (frozen data)
  const { words, isLoading, isSnapshot, emptySlots } = useFocusSet({
    studentId,
    lessonId,
    lessonStatus  // 'in_progress' → snapshot mode
  });

  return (
    <div>
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="font-medium">Focus Set</h3>
        <Badge>{words.length} / 5</Badge>
        
        {/* Indicate snapshot mode */}
        {isSnapshot && (
          <Badge variant="secondary">
            <Lock className="h-3 w-3 mr-1" />
            Frozen
          </Badge>
        )}
      </div>

      <p className="text-sm text-muted-foreground mt-2">
        These words earn progress when you use them in speech.
      </p>

      {/* Display Focus Set words */}
      {words.map(word => (
        <Card key={word.id} className="p-3 mt-2">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-medium">{word.lemma}</span>
              <Badge variant="outline" className="ml-2">
                {word.cefr_level}
              </Badge>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Activation dots (frozen count) */}
              <ActivationDots count={word.lesson_count} max={3} />
              
              {/* Focus points earned (frozen count) */}
              {word.focus_lesson_count > 0 && (
                <span className="text-sm font-medium text-primary">
                  +{word.focus_lesson_count} pts
                </span>
              )}
            </div>
          </div>
        </Card>
      ))}

      {/* Empty slots */}
      {Array.from({ length: emptySlots }).map((_, i) => (
        <div 
          key={`empty-${i}`}
          className="border-2 border-dashed border-muted rounded-lg p-3 mt-2"
        >
          <span className="text-sm text-muted-foreground">
            Empty slot
          </span>
        </div>
      ))}
    </div>
  );
};
```

---

#### 3. useFocusSet Hook

**Location:** `src/hooks/useFocusSet.ts`

```tsx
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface FocusSetWord {
  id: string;
  lexeme_id: string;
  lemma: string;
  pos: string;
  cefr_level: string | null;
  lesson_count: number;       // Frozen in snapshot mode
  focus_lesson_count: number; // Frozen in snapshot mode
  is_stable: boolean;
  priority_rank: number;
}

export type LessonStatus = 'scheduled' | 'in_progress' | 'completed';

interface UseFocusSetOptions {
  studentId?: string;
  lessonId?: string;
  lessonStatus?: LessonStatus;
  enabled?: boolean;
}

export function useFocusSet({
  studentId,
  lessonId,
  lessonStatus = 'scheduled',
  enabled = true
}: UseFocusSetOptions = {}) {
  const {
    data: words = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['focus-set', studentId, lessonId, lessonStatus],
    queryFn: async (): Promise<FocusSetWord[]> => {
      if (!studentId) return [];

      const { data, error } = await supabase.rpc('get_focus_set_for_lesson', {
        student_uuid: studentId,
        lesson_uuid: lessonId || null,
        lesson_status: lessonStatus
      });

      if (error) throw error;
      return data || [];
    },
    enabled: enabled && !!studentId,
    staleTime: 30000, // 30 seconds
  });

  // Determine if this is snapshot mode
  const isSnapshot = !!lessonId && 
    (lessonStatus === 'in_progress' || lessonStatus === 'completed');

  return {
    words,
    isLoading,
    error,
    refetch,
    isSnapshot,              // TRUE if showing frozen snapshot
    emptySlots: Math.max(0, 5 - words.length)
  };
}
```

---

### Real-Time Updates

Even though the UI shows a frozen snapshot, the backend continues tracking usage in real-time.

#### Event Listener Setup

```tsx
// In LiveGoalsPanel component
useEffect(() => {
  const handleVocabUpdate = (event: CustomEvent) => {
    const { lessonId: eventLessonId, studentId: eventStudentId } = event.detail;
    
    if (eventLessonId === lessonId && eventStudentId === studentId) {
      console.log('[LiveGoalsPanel] Vocab processed, refreshing snapshot');
      refetch();  // Re-fetch snapshot (may show updated counts in some cases)
    }
  };

  window.addEventListener('vocab-realtime-completed', handleVocabUpdate);
  
  return () => {
    window.removeEventListener('vocab-realtime-completed', handleVocabUpdate);
  };
}, [lessonId, studentId, refetch]);
```

**Note:** In snapshot mode, `refetch()` returns the same frozen data. This is by design for UI consistency. Real tracking happens in `student_lexeme_history`.

---

## Mobile Implementation Guide

### React Native / Flutter Setup

#### 1. API Call

```typescript
// TypeScript/React Native example
interface FocusSetRequest {
  student_uuid: string;
  lesson_uuid: string | null;
  lesson_status: 'scheduled' | 'in_progress' | 'completed';
}

async function fetchFocusSet(
  studentId: string,
  lessonId: string | null,
  lessonStatus: 'scheduled' | 'in_progress' | 'completed'
): Promise<FocusSetWord[]> {
  const { data, error } = await supabase.rpc('get_focus_set_for_lesson', {
    student_uuid: studentId,
    lesson_uuid: lessonId,
    lesson_status: lessonStatus
  });

  if (error) throw error;
  return data || [];
}
```

#### 2. Usage Examples

```typescript
// Vocabulary Builder (live Focus Set)
const liveWords = await fetchFocusSet(
  studentId,
  null,           // No lesson context
  'scheduled'     // Not in a lesson
);
// Returns: Current active goals (can be modified)

// During Live Lesson (snapshot)
const snapshotWords = await fetchFocusSet(
  studentId,
  lessonId,
  'in_progress'   // Triggers snapshot mode
);
// Returns: Frozen snapshot from lesson start

// Historical Review (snapshot)
const historicalWords = await fetchFocusSet(
  studentId,
  completedLessonId,
  'completed'     // Historical view
);
// Returns: Same frozen snapshot from that lesson
```

---

### State Management (Redux Example)

```typescript
// Redux slice
interface FocusSetState {
  words: FocusSetWord[];
  isSnapshot: boolean;
  loading: boolean;
  error: string | null;
}

// Action
export const fetchFocusSet = createAsyncThunk(
  'focusSet/fetch',
  async ({ studentId, lessonId, lessonStatus }: FetchParams) => {
    const { data } = await supabase.rpc('get_focus_set_for_lesson', {
      student_uuid: studentId,
      lesson_uuid: lessonId,
      lesson_status: lessonStatus
    });
    return { 
      words: data,
      isSnapshot: !!lessonId && lessonStatus !== 'scheduled'
    };
  }
);

// Reducer
const focusSetSlice = createSlice({
  name: 'focusSet',
  initialState,
  extraReducers: (builder) => {
    builder
      .addCase(fetchFocusSet.fulfilled, (state, action) => {
        state.words = action.payload.words;
        state.isSnapshot = action.payload.isSnapshot;
      });
  }
});
```

---

### UI Components (React Native)

```tsx
// FocusSetPanel.tsx
import React from 'react';
import { View, Text, Badge } from 'react-native';

interface Props {
  lessonId?: string;
  studentId: string;
  lessonStatus: 'scheduled' | 'in_progress' | 'completed';
}

export const FocusSetPanel: React.FC<Props> = ({
  lessonId,
  studentId,
  lessonStatus
}) => {
  const [words, setWords] = useState<FocusSetWord[]>([]);
  const [isSnapshot, setIsSnapshot] = useState(false);

  useEffect(() => {
    loadFocusSet();
  }, [lessonId, studentId, lessonStatus]);

  const loadFocusSet = async () => {
    const data = await fetchFocusSet(studentId, lessonId, lessonStatus);
    setWords(data);
    setIsSnapshot(!!lessonId && lessonStatus !== 'scheduled');
  };

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.title}>Focus Set</Text>
        <Badge>{words.length} / 5</Badge>
        {isSnapshot && <Badge>Frozen</Badge>}
      </View>

      {words.map(word => (
        <View key={word.id} style={styles.card}>
          <Text style={styles.word}>{word.lemma}</Text>
          <Badge>{word.cefr_level}</Badge>
          
          <View style={styles.stats}>
            <ActivationDots count={word.lesson_count} />
            {word.focus_lesson_count > 0 && (
              <Text>+{word.focus_lesson_count} pts</Text>
            )}
          </View>
        </View>
      ))}
    </View>
  );
};
```

---

## Testing & Validation

### Test Cases

#### 1. Snapshot Creation
```sql
-- Test: Snapshot is created on lesson insert
INSERT INTO lessons (id, teacher_id, student_id, starts_at, status)
VALUES (
  'test-lesson-uuid',
  'teacher-uuid',
  'student-uuid',
  now() + interval '1 hour',
  'scheduled'
);

-- Verify: Snapshot exists
SELECT COUNT(*) FROM lesson_active_goals_snapshot
WHERE lesson_id = 'test-lesson-uuid';
-- Expected: 1-5 rows (depends on student's Focus Set)

-- Verify: Contains correct data
SELECT * FROM lesson_active_goals_snapshot
WHERE lesson_id = 'test-lesson-uuid'
ORDER BY priority_rank;
```

#### 2. Snapshot Idempotency
```sql
-- Test: Multiple triggers don't create duplicates
UPDATE lessons SET status = 'in_progress'
WHERE id = 'test-lesson-uuid';

UPDATE lessons SET status = 'completed'
WHERE id = 'test-lesson-uuid';

-- Verify: Still only one snapshot per goal
SELECT goal_id, COUNT(*) as count
FROM lesson_active_goals_snapshot
WHERE lesson_id = 'test-lesson-uuid'
GROUP BY goal_id
HAVING COUNT(*) > 1;
-- Expected: 0 rows (no duplicates)
```

#### 3. Live vs Snapshot Mode
```typescript
// Test: Live mode returns current goals
const liveWords = await supabase.rpc('get_focus_set_for_lesson', {
  student_uuid: studentId,
  lesson_uuid: null,
  lesson_status: 'scheduled'
});
console.log('Live words:', liveWords.length);

// Modify Focus Set
await supabase.rpc('toggle_vocab_active_status', {
  goal_uuid: wordId,
  new_active_status: false
});

// Re-fetch live
const updatedLive = await supabase.rpc('get_focus_set_for_lesson', {
  student_uuid: studentId,
  lesson_uuid: null,
  lesson_status: 'scheduled'
});
console.log('Updated live:', updatedLive.length);
// Expected: Changed count

// Fetch snapshot (should be unchanged)
const snapshot = await supabase.rpc('get_focus_set_for_lesson', {
  student_uuid: studentId,
  lesson_uuid: lessonId,
  lesson_status: 'in_progress'
});
console.log('Snapshot words:', snapshot.length);
// Expected: Original count (frozen)
```

#### 4. Historical View
```typescript
// Test: Completed lesson shows same snapshot
const duringLesson = await fetchFocusSet(studentId, lessonId, 'in_progress');
const afterLesson = await fetchFocusSet(studentId, lessonId, 'completed');

expect(duringLesson).toEqual(afterLesson);
// Expected: Identical data
```

---

### Common Issues & Solutions

#### Issue 1: Snapshot Not Created

**Symptom:** RPC returns live Focus Set during lesson

**Diagnosis:**
```sql
-- Check if snapshot exists
SELECT * FROM lesson_active_goals_snapshot
WHERE lesson_id = 'your-lesson-id';
```

**Solutions:**
- Verify trigger is enabled: `SELECT * FROM pg_trigger WHERE tgname = 'trigger_snapshot_active_goals';`
- Manually create snapshot:
  ```sql
  -- Run snapshot function manually
  SELECT snapshot_active_goals_on_lesson_start();
  ```

#### Issue 2: Empty Snapshot

**Symptom:** Snapshot table has 0 rows for lesson

**Possible Causes:**
- Student has no active goals at lesson creation
- All active goals are stable (mastered)

**Diagnosis:**
```sql
-- Check student's active goals at time of lesson
SELECT * FROM student_goals
WHERE student_id = 'student-uuid'
  AND is_active_for_lessons = true
  AND archived_at IS NULL;
```

#### Issue 3: Snapshot Shows Wrong Data

**Symptom:** Snapshot counts don't match expectations

**Diagnosis:**
```sql
-- Compare snapshot vs current
SELECT 
  s.lemma,
  s.lesson_count as snapshot_count,
  slh.lesson_count as current_count,
  s.created_at as snapshot_time
FROM lesson_active_goals_snapshot s
LEFT JOIN student_lexeme_history slh 
  ON s.student_id = slh.student_id 
  AND s.lexeme_id = slh.lexeme_id
WHERE s.lesson_id = 'lesson-id';
```

**Expected:** Snapshot counts are lower (historical) than current counts

---

## Summary

### Key Takeaways

1. **Snapshots are automatic** → Created by database trigger on lesson creation
2. **Snapshots are immutable** → Never updated after creation
3. **Frontend decides mode** → Pass `lesson_status` to control live vs snapshot
4. **Backend tracks independently** → Real-time usage updates `student_lexeme_history`
5. **UI consistency** → Same snapshot shown during and after lesson

### Decision Matrix

| Scenario | lesson_uuid | lesson_status | Returns |
|----------|-------------|---------------|---------|
| Vocabulary Builder | `null` | `'scheduled'` | Live Focus Set ✅ |
| Scheduled Lesson | lesson_id | `'scheduled'` | Live Focus Set ✅ |
| Active Lesson | lesson_id | `'in_progress'` | Frozen Snapshot 🔒 |
| Completed Lesson | lesson_id | `'completed'` | Frozen Snapshot 🔒 |
| Historical Review | lesson_id | `'completed'` | Frozen Snapshot 🔒 |

### Mobile Integration Checklist

- [ ] Implement `fetchFocusSet()` API wrapper
- [ ] Create `FocusSetPanel` component with snapshot badge
- [ ] Pass correct `lesson_status` based on screen context
- [ ] Handle empty snapshot case (show "No goals set" message)
- [ ] Display "Frozen" indicator in snapshot mode
- [ ] Implement `ActivationDots` component for usage visualization
- [ ] Add pull-to-refresh (triggers `refetch()`)
- [ ] Cache snapshot data (30s stale time)
- [ ] Test live → snapshot → historical flow

---

**End of Document**
