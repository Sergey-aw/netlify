# Vocabulary Capacity Feature

## Overview

**Vocabulary Capacity** is a key metric in the JustTalk vocabulary learning system that represents the total number of stable words a student has acquired through focus practice.

**Display**: Shown as a prominent card in the vocabulary dashboard with a trending-up icon.

**Definition**: Total words stabilized through focus practice.

---

## What is a "Stable" Word?

A word becomes **stable** when it meets the **"3+1 Rule"**:

1. ✅ Used in **3+ distinct lessons** (global activation)
2. ✅ Currently in the **Focus Set** (intentional practice)
3. ✅ Used **one additional time** while in Focus Set

### Technical Criteria

```
is_stable = true when:
  lesson_count >= 3 AND
  focus_lesson_count >= 3 AND
  was_in_focus = true
```

### What Happens When a Word Becomes Stable?

- ✨ Vocabulary Capacity increments by +1
- 🎯 Word is automatically removed from Focus Set
- 🔒 Word is permanently locked out from being added to Focus Set again
- 📅 Timestamp recorded in `stable_at` field
- 📝 Lesson ID recorded in `stable_lesson_id` field

---

## Data Source

### Primary Table: `student_lexeme_history`

The core data comes from the `student_lexeme_history` table:

| Column | Type | Description |
|--------|------|-------------|
| `student_id` | UUID | Student identifier |
| `lexeme_id` | UUID | Vocabulary word identifier |
| `lesson_count` | INTEGER | Total lessons where word was used (global activation dots) |
| `focus_lesson_count` | INTEGER | Lessons where word was used while in Focus Set |
| `is_stable` | BOOLEAN | Whether word has reached stable status |
| `stable_at` | TIMESTAMPTZ | When word became stable |
| `stable_lesson_id` | UUID | Lesson where word became stable |
| `total_count` | INTEGER | Total usage count across all lessons |
| `first_used_at` | TIMESTAMPTZ | First usage timestamp |
| `last_used_at` | TIMESTAMPTZ | Most recent usage timestamp |

### Calculation Logic

```sql
-- Vocabulary Capacity = count of distinct stable words
SELECT COUNT(DISTINCT lexeme_id) FILTER (WHERE is_stable = true)
FROM student_lexeme_history
WHERE student_id = :student_uuid
  AND lexeme_id IS NOT NULL
```

---

## Database Function

### `get_student_vocab_overview_v4(student_uuid)`

**Location**: `supabase/migrations/20260127165331_ca1e3a80-9ed7-46ad-ba5e-3e790f6712d9.sql`

**Returns**: JSONB object with comprehensive vocabulary statistics

```sql
CREATE OR REPLACE FUNCTION public.get_student_vocab_overview_v4(student_uuid uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
```

### Return Structure

```json
{
  "total_words": 150,           // Sum of all usage counts
  "unique_words": 45,            // Distinct lexeme_ids
  "in_progress_count": 35,       // Words used but not stable
  "acquired_count": 10,          // Vocabulary Capacity (stable words)
  "cefr_progress": {
    "A1": { "acquired": 5, "total": 10, "pct": 50.0 },
    "A2": { "acquired": 3, "total": 15, "pct": 20.0 },
    "B1": { "acquired": 2, "total": 20, "pct": 10.0 }
  }
}
```

**Key Field**: `acquired_count` is the Vocabulary Capacity value.

### Access Control

Built-in Row Level Security (RLS):

- ✅ Students can access their own data
- ✅ Teachers can access data for students they've taught
- ❌ Returns empty object `{}` for unauthorized access

---

## How to Fetch Vocabulary Capacity

### Method 1: Using the React Hook (Recommended)

**Hook**: `useStudentVocabularyOverview`

**Location**: `src/hooks/useStudentVocabularyOverview.ts`

```typescript
import { useStudentVocabularyOverview } from '@/hooks/useStudentVocabularyOverview';

function MyComponent({ studentId }: { studentId: string }) {
  const { data: overview, isLoading, error } = useStudentVocabularyOverview(studentId);
  
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading data</div>;
  
  const vocabularyCapacity = overview?.acquired_count ?? 0;
  
  return (
    <div>
      <h2>Vocabulary Capacity: {vocabularyCapacity}</h2>
    </div>
  );
}
```

**Features**:
- ✅ React Query integration (automatic caching & refetching)
- ✅ 10-minute stale time
- ✅ Disabled when `studentId` is undefined
- ✅ No refetch on window focus

### Method 2: Direct RPC Call

```typescript
import { supabase } from '@/integrations/supabase/client';

async function fetchVocabularyCapacity(studentId: string) {
  const { data, error } = await supabase.rpc(
    'get_student_vocab_overview_v4',
    { student_uuid: studentId }
  );
  
  if (error) {
    console.error('Error fetching vocabulary overview:', error);
    throw error;
  }
  
  return data.acquired_count; // Returns the vocabulary capacity
}
```

### Method 3: Direct SQL Query (Backend/Edge Functions)

```sql
SELECT COUNT(DISTINCT slha.lexeme_id) FILTER (WHERE slha.is_stable = true)::int AS vocabulary_capacity
FROM public.student_lexeme_history slha
WHERE slha.student_id = :student_uuid
  AND slha.lexeme_id IS NOT NULL;
```

---

## UI Implementation

### Display Component

**Component**: `FocusSummaryCards`

**Location**: `src/components/vocabulary/FocusSummaryCards.tsx`

```tsx
export function FocusSummaryCards({ studentId }: FocusSummaryCardsProps) {
  const { data: overview, isLoading } = useStudentVocabularyOverview(studentId);
  
  const acquiredCount = overview?.acquired_count ?? 0;
  
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-4xl font-bold text-foreground mb-1">
              {acquiredCount}
            </div>
            <div className="text-sm font-medium text-foreground mb-1">
              Vocabulary Capacity
            </div>
            <p className="text-xs text-muted-foreground">
              Total words stabilized through focus practice.
            </p>
          </div>
          <div className="p-2 rounded-full bg-primary/10">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

### Visual Design

```
┌─────────────────────────────────────┐
│  2                              📈  │
│  Vocabulary Capacity                │
│  Total words stabilized through     │
│  focus practice.                    │
└─────────────────────────────────────┘
```

---

## Related Data Flow

### Word Progression to Stability

```
┌──────────────┐
│  Word Added  │
│  to Focus    │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Not Used   │ ← Initial state
└──────┬───────┘
       │ Use in lesson while in Focus
       ▼
┌──────────────┐
│  Practiced   │ ← focus_lesson_count = 1
└──────┬───────┘
       │ Use in 2nd lesson while in Focus
       ▼
┌──────────────┐
│  Activated   │ ← focus_lesson_count = 2
└──────┬───────┘
       │ Use in 3rd lesson while in Focus (if lesson_count >= 3)
       ▼
┌──────────────┐
│    Ready     │ ← focus_lesson_count = 3, lesson_count >= 3
└──────┬───────┘
       │ Auto-removed from Focus Set
       ▼
┌──────────────┐
│   STABLE ✅   │ ← is_stable = true
│ +1 Capacity  │ ← Vocabulary Capacity increments
└──────────────┘
```

### Data Update Trigger

**Trigger**: `sync_student_lexeme_history`

**Location**: `supabase/migrations/20260127165331_ca1e3a80-9ed7-46ad-ba5e-3e790f6712d9.sql`

Automatically updates `is_stable` when:
- `vocab_evidence` records are inserted
- Word meets stability criteria
- Focus Set membership is verified

```sql
-- Simplified trigger logic
IF lesson_count >= 3 AND was_in_focus = true AND NOT is_stable THEN
  is_stable := true;
  stable_at := now();
  stable_lesson_id := current_lesson_id;
  
  -- Auto-remove from Focus Set
  UPDATE student_goals
  SET is_active_for_lessons = false
  WHERE lexeme_id = current_lexeme_id;
END IF;
```

---

## Related Features

### Weekly Focus Target

Vocabulary Capacity growth is tied to the **Weekly Focus Target** system:

- Each state transition while in Focus earns **+1 point**
- Ready → Stable transition earns the final point
- Default weekly target: **10 points**
- Resets every Monday

### CEFR Progress Breakdown

The same function provides CEFR-level breakdown of stable words:

```json
"cefr_progress": {
  "A1": { "acquired": 5, "total": 10, "pct": 50.0 },
  "A2": { "acquired": 3, "total": 15, "pct": 20.0 }
}
```

This shows how many stable words come from each proficiency level.

---

## Testing & Debugging

### Test Query

```sql
-- Check vocabulary capacity for a specific student
SELECT * FROM get_student_vocab_overview_v4('123e4567-e89b-12d3-a456-426614174000');

-- See detailed breakdown
SELECT 
  l.lemma,
  slh.lesson_count,
  slh.focus_lesson_count,
  slh.is_stable,
  slh.stable_at
FROM student_lexeme_history slh
JOIN lexemes l ON l.id = slh.lexeme_id
WHERE slh.student_id = '123e4567-e89b-12d3-a456-426614174000'
ORDER BY slh.is_stable DESC, slh.focus_lesson_count DESC;
```

### Backfill Script

Historical data was backfilled using this logic:

```sql
-- Mark existing words as stable if they meet criteria
UPDATE public.student_lexeme_history
SET is_stable = true,
    stable_at = COALESCE(focus_acquired_at, acquired_at, now())
WHERE lesson_count >= 3 
  AND focus_lesson_count >= 3
  AND COALESCE(is_stable, false) = false;
```

---

## Performance Considerations

### Caching Strategy

- **Frontend**: 10-minute stale time via React Query
- **Database**: Function is marked as `STABLE` for query optimization
- **Security**: `SECURITY DEFINER` with explicit RLS checks

### Indexing

Recommended indexes on `student_lexeme_history`:

```sql
CREATE INDEX idx_student_lexeme_history_student_stable 
ON student_lexeme_history(student_id, is_stable);

CREATE INDEX idx_student_lexeme_history_student_lexeme 
ON student_lexeme_history(student_id, lexeme_id);
```

---

## API Integration

### Mobile App / External API

```typescript
// GET endpoint response structure
interface VocabularyOverview {
  total_words: number;
  unique_words: number;
  in_progress_count: number;
  acquired_count: number;  // ← Vocabulary Capacity
  cefr_progress: {
    [level: string]: {
      acquired: number;
      total: number;
      pct: number;
    }
  };
}
```

### Documentation Reference

See `docs/VOCABULARY_BUILDER_MOBILE_API.md` for mobile integration details.

---

## Summary

**Vocabulary Capacity** is calculated by counting distinct stable words (`is_stable = true`) from the `student_lexeme_history` table. It represents genuine vocabulary acquisition through the structured Focus Set practice system, ensuring words are:

1. Used consistently (3+ sessions globally)
2. Practiced intentionally (through Focus Set)
3. Reinforced sufficiently (3+ Focus sessions)

**To fetch**: Use `useStudentVocabularyOverview(studentId)` hook and access `data.acquired_count`.
