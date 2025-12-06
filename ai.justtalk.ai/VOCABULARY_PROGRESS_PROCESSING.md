# Vocabulary Progress Processing Guide

## Overview

This guide documents the vocabulary tracking system for processing student lexeme usage from lesson transcriptions. This system tracks student vocabulary growth by recording evidence of word usage from lessons and voice sessions.

The system uses database triggers to automatically update vocabulary statistics when evidence is recorded. External AI applications should insert records into `vocab_evidence` table, and the database will automatically maintain `student_lexeme_history`.

---

## Database Schema

### Key Tables

#### 1. `lesson_transcription_segments`
Stores individual segments from lesson transcriptions with speaker identification.

```sql
CREATE TABLE lesson_transcription_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  segment_index integer NOT NULL,
  speaker text NOT NULL CHECK (speaker IN ('student', 'teacher')),
  text text NOT NULL,
  start_time numeric,
  end_time numeric,
  created_at timestamptz DEFAULT now()
);

-- Index for fast lesson lookups
CREATE INDEX idx_segments_lesson ON lesson_transcription_segments(lesson_id, segment_index);
CREATE INDEX idx_segments_speaker ON lesson_transcription_segments(lesson_id, speaker);
```

#### 2. `vocab_evidence`
Records evidence of vocabulary usage by students during lessons.

```sql
CREATE TABLE vocab_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lexeme_id uuid NOT NULL REFERENCES lexemes(id) ON DELETE CASCADE,
  lesson_id uuid REFERENCES lessons(id) ON DELETE SET NULL,
  virtual_lesson_id uuid,  -- For JustAI voice sessions
  evidence_type text NOT NULL CHECK (evidence_type IN ('spoken', 'written', 'recognized')),
  context_sentence text,
  was_correct boolean,
  correction_given text,
  created_at timestamptz DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_vocab_evidence_student ON vocab_evidence(student_id, created_at DESC);
CREATE INDEX idx_vocab_evidence_lexeme ON vocab_evidence(lexeme_id, student_id);
CREATE INDEX idx_vocab_evidence_lesson ON vocab_evidence(lesson_id);
CREATE INDEX idx_vocab_evidence_virtual_lesson ON vocab_evidence(virtual_lesson_id);
```

#### 3. `student_lexeme_history`
Tracks student's relationship with each lexeme over time. **Automatically maintained by database trigger**.

```sql
CREATE TABLE student_lexeme_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lexeme_id uuid NOT NULL REFERENCES lexemes(id) ON DELETE CASCADE,
  total_count integer NOT NULL DEFAULT 0,
  lesson_count integer NOT NULL DEFAULT 0,
  first_used_at timestamptz,
  last_used_at timestamptz,
  acquired_at timestamptz,  -- Set when word appears in 3rd lesson
  
  UNIQUE(student_id, lexeme_id)
);

-- Database trigger automatically updates this table
-- when records are inserted into vocab_evidence
CREATE TRIGGER trg_sync_student_lexeme_history
AFTER INSERT ON vocab_evidence
FOR EACH ROW
EXECUTE FUNCTION sync_student_lexeme_history();
```

#### 4. `lexemes`
Core vocabulary items (base forms of words).

```sql
-- Assumed structure (adapt to your schema)
CREATE TABLE lexemes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_form text NOT NULL UNIQUE,
  part_of_speech text,
  cefr_level text CHECK (cefr_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  frequency_rank integer,
  created_at timestamptz DEFAULT now()
);
```

---

## Processing Workflow

### Step 1: Extract Student Utterances

After a lesson/session completes with transcription, extract all student segments:

```sql
-- For regular lessons: Get all student segments
SELECT 
  id,
  segment_index,
  text,
  start_time,
  end_time
FROM lesson_transcription_segments
WHERE lesson_id = :lesson_id
  AND speaker = 'student'
ORDER BY segment_index;

-- For JustAI sessions: Get all user messages
SELECT 
  m.id,
  m.content,
  m.created_at
FROM justai_messages m
JOIN justai_conversations c ON c.id = m.conversation_id
WHERE c.virtual_lesson_id = :virtual_lesson_id
  AND m.role = 'user'
ORDER BY m.created_at;
```

### Step 2: Linguistic Analysis (External NLP Service)

External AI application should analyze each student utterance to extract lexemes (base word forms). This is done outside of Supabase using NLP tools.

Required analysis:
- **Tokenization** - Split text into words
- **Lemmatization** - Convert to base form (e.g., "went" → "go", "flowers" → "flower")
- **POS Tagging** - Identify part of speech (optional, for filtering)

### Step 3: Match Lexemes in Database

For each extracted lemma, look up the corresponding lexeme:

```sql
-- Find lexeme by base form
SELECT id, base_form, part_of_speech, cefr_level
FROM lexemes
WHERE base_form = :lemma
LIMIT 1;
```

### Step 4: Insert Vocabulary Evidence

For each lexeme used by the student, insert evidence record. **The database trigger will automatically update `student_lexeme_history`**.

```sql
-- Insert single evidence record
INSERT INTO vocab_evidence (
  student_id,
  lexeme_id,
  lesson_id,           -- For regular lessons
  virtual_lesson_id,   -- For JustAI sessions (use NULL for regular lessons)
  evidence_type,       -- 'spoken' for voice, 'written' for text
  context_sentence,
  was_correct,
  created_at
) VALUES (
  :student_id,
  :lexeme_id,
  :lesson_id,
  :virtual_lesson_id,
  'spoken',
  :full_sentence,
  true,
  now()
);

-- Or batch insert multiple evidence records
INSERT INTO vocab_evidence (
  student_id, lexeme_id, lesson_id, evidence_type, 
  context_sentence, was_correct, created_at
)
VALUES
  (:student_id, :lexeme_id_1, :lesson_id, 'spoken', 'I went to the park yesterday.', true, now()),
  (:student_id, :lexeme_id_2, :lesson_id, 'spoken', 'I saw many beautiful flowers.', true, now()),
  (:student_id, :lexeme_id_3, :lesson_id, 'spoken', 'The weather was amazing!', true, now());
```

**Important:** The `sync_student_lexeme_history()` trigger function automatically:
- Counts total occurrences per lexeme
- Counts distinct lessons where lexeme was used
- Tracks first and last usage timestamps
- Sets `acquired_at` when word appears in 3rd lesson

---

## Existing Database Functions

The system includes several pre-built functions for querying vocabulary data. External applications can call these via Supabase RPC.

### Available Functions

1. **`get_student_vocab_overview_v4(student_uuid)`** - Get comprehensive vocabulary statistics
2. **`get_lesson_vocab_list_enhanced(...)`** - Get vocabulary from specific lesson with student history
3. **`get_lesson_vocab_stats_v3(...)`** - Get vocabulary statistics for a lesson
4. **`get_student_lexeme_list_v2(...)`** - Get paginated list of student's lexemes
5. **`get_lesson_lexeme_history_v2(...)`** - Get lexeme usage history for a lesson
6. **`get_student_all_vocab_sets_progress(student_uuid)`** - Get progress across all vocabulary sets

### Example: Get Student Vocabulary Overview

```sql
-- Call via SQL
SELECT * FROM get_student_vocab_overview_v4('123e4567-e89b-12d3-a456-426614174000');
```

Or via Supabase client:

```typescript
const { data, error } = await supabase.rpc('get_student_vocab_overview_v4', {
  student_uuid: userId
});
```

---

## Edge Functions for Vocabulary Processing

The system includes Edge Functions deployed to Supabase for real-time vocabulary processing.

### 1. `vocab-ingest-segment`

**Purpose:** Process a single transcription segment to extract and record vocabulary usage

**Endpoint:** `https://bcsyrxkfeatnbaqlnxgr.supabase.co/functions/v1/vocab-ingest-segment`

**Usage:**
```typescript
const response = await fetch(
  'https://bcsyrxkfeatnbaqlnxgr.supabase.co/functions/v1/vocab-ingest-segment',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({
      lessonId: 'lesson-uuid',
      segmentId: 'segment-uuid',
      studentId: 'student-uuid'
    })
  }
);
```

**What it does:**
1. Fetches segment text from `lesson_transcription_segments`
2. Calls external NLP API (spaCy) to analyze text and extract lemmas
3. Looks up lexeme IDs from `lexemes` table
4. Inserts records into `vocab_evidence` table
5. Database trigger auto-updates `student_lexeme_history`

**Environment Variables Required:**
- `SUPABASE_URL` (automatic)
- `SUPABASE_SERVICE_ROLE_KEY` (automatic)
- `GRAMMAR_SPACY_URL` - URL of spaCy NLP service
- `GRAMMAR_SPACY_TOKEN` - Authentication token for NLP service

---

### 2. `vocab-process-final-segment`

**Purpose:** Finalize vocabulary processing for an entire lesson after all segments are processed

**Endpoint:** `https://bcsyrxkfeatnbaqlnxgr.supabase.co/functions/v1/vocab-process-final-segment`

**Usage:**
```typescript
const response = await fetch(
  'https://bcsyrxkfeatnbaqlnxgr.supabase.co/functions/v1/vocab-process-final-segment',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
      'x-internal-token': internalVocabToken
    },
    body: JSON.stringify({
      lessonId: 'lesson-uuid',
      mode: 'final' // Optional
    })
  }
);
```

**What it does:**
1. Aggregates all vocabulary evidence from the lesson
2. Calculates final statistics
3. Marks lesson as processed
4. Can be used for batch reprocessing

**Security:** Requires `x-internal-token` header to prevent unauthorized access

---

### 3. `process-segment-mistakes`

**Purpose:** Analyze grammar mistakes in student transcription segments

**Endpoint:** `https://bcsyrxkfeatnbaqlnxgr.supabase.co/functions/v1/process-segment-mistakes`

**Usage:**
```typescript
const response = await fetch(
  'https://bcsyrxkfeatnbaqlnxgr.supabase.co/functions/v1/process-segment-mistakes',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({
      lessonId: 'lesson-uuid',
      segmentId: 'segment-uuid',
      speakerId: 'student-uuid',
      speakerRole: 'student',
      transcript: 'The text to analyze for mistakes'
    })
  }
);
```

**What it does:**
1. Sends transcript to Sapling API for grammar analysis
2. Extracts grammar mistakes and corrections
3. Inserts mistakes into database for tracking

**Environment Variables Required:**
- `SAPLING_API_KEY` - API key for Sapling grammar checker

---

### 4. `process-voice-session` (JustAI)

**Purpose:** Post-process JustAI voice chat session after it ends

**Endpoint:** `https://bcsyrxkfeatnbaqlnxgr.supabase.co/functions/v1/process-voice-session`

**Usage:**
```typescript
const response = await fetch(
  'https://bcsyrxkfeatnbaqlnxgr.supabase.co/functions/v1/process-voice-session',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      voiceSessionId: 'voice-session-uuid'
    })
  }
);
```

**What it does:**
1. Fetches conversation transcript from ElevenLabs API
2. Extracts user and assistant messages
3. Saves messages to `justai_messages` table
4. Updates `justai_voice_sessions` with costs and duration
5. Marks session as `transcription_complete`

**For vocabulary processing:** After this function completes, call external NLP service to:
1. Extract lemmas from user messages
2. Insert into `vocab_evidence` with `virtual_lesson_id`
3. Database trigger will auto-update `student_lexeme_history`

**Environment Variables Required:**
- `ELEVENLABS_API_KEY` - API key for ElevenLabs

---

### 5. `vocab-backfill-lesson`

**Purpose:** Reprocess vocabulary for an existing lesson (backfill or fix)

**Endpoint:** `https://bcsyrxkfeatnbaqlnxgr.supabase.co/functions/v1/vocab-backfill-lesson`

**Usage:**
```typescript
const response = await fetch(
  'https://bcsyrxkfeatnbaqlnxgr.supabase.co/functions/v1/vocab-backfill-lesson',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({
      lessonId: 'lesson-uuid'
    })
  }
);
```

**What it does:**
1. Clears existing vocab evidence for the lesson
2. Reprocesses all student segments
3. Rebuilds vocabulary history

**Use case:** Fix incorrect vocabulary data or reprocess after NLP improvements

---

## Vocabulary Processing Flow with Edge Functions

### For Regular Lessons

```
1. Lesson completes → transcription_segments created
2. Call vocab-ingest-segment for each student segment
3. Call vocab-process-final-segment when all segments done
4. Database trigger updates student_lexeme_history automatically
```

### For JustAI Voice Sessions

```
1. Voice session ends
2. Call process-voice-session → saves messages to justai_messages
3. External NLP analyzes user messages → extracts lemmas
4. Insert into vocab_evidence with virtual_lesson_id
5. Database trigger updates student_lexeme_history automatically
```

### Webhook Integration

For external AI systems, create a webhook endpoint that:

```typescript
// Pseudocode for external webhook
app.post('/webhook/lesson-completed', async (req) => {
  const { lessonId, studentId } = req.body;
  
  // Get all student segments
  const segments = await getStudentSegments(lessonId);
  
  // Process each segment
  for (const segment of segments) {
    await fetch('https://bcsyrxkfeatnbaqlnxgr.supabase.co/functions/v1/vocab-ingest-segment', {
      method: 'POST',
      body: JSON.stringify({
        lessonId,
        segmentId: segment.id,
        studentId
      })
    });
  }
  
  // Finalize
  await fetch('https://bcsyrxkfeatnbaqlnxgr.supabase.co/functions/v1/vocab-process-final-segment', {
    method: 'POST',
    body: JSON.stringify({ lessonId })
  });
});
```

---

## Simple Integration Example

External AI application only needs to:

1. **Extract text** from lesson transcriptions or JustAI messages
2. **Analyze with NLP** to get base word forms (lemmas)
3. **Look up lexeme IDs** from database
4. **Insert into `vocab_evidence`** - database trigger handles the rest

```typescript
// Example: Process vocabulary for a lesson
async function processLessonVocabulary(lessonId: string, studentId: string) {
  // 1. Get student utterances
  const { data: segments } = await supabase
    .from('lesson_transcription_segments')
    .select('text')
    .eq('lesson_id', lessonId)
    .eq('speaker', 'student');
  
  for (const segment of segments) {
    // 2. Analyze text with your NLP service (external)
    const lemmas = await yourNLPService.extractLemmas(segment.text);
    // Returns: ['go', 'park', 'see', 'flower', ...]
    
    // 3. Look up lexeme IDs
    const { data: lexemes } = await supabase
      .from('lexemes')
      .select('id, base_form')
      .in('base_form', lemmas);
    
    // 4. Insert evidence (trigger auto-updates student_lexeme_history)
    const evidenceRecords = lexemes.map(lex => ({
      student_id: studentId,
      lexeme_id: lex.id,
      lesson_id: lessonId,
      evidence_type: 'spoken',
      context_sentence: segment.text,
      was_correct: true
    }));
    
    await supabase
      .from('vocab_evidence')
      .insert(evidenceRecords);
  }
}
```

---

## Monitoring Queries

### Check Processing Status

```sql
-- Count evidence records per lesson
SELECT 
  lesson_id,
  COUNT(*) as evidence_count,
  COUNT(DISTINCT lexeme_id) as unique_lexemes,
  COUNT(*) FILTER (WHERE was_correct = true) as correct_count,
  COUNT(*) FILTER (WHERE was_correct = false) as incorrect_count
FROM vocab_evidence
WHERE student_id = :student_id
GROUP BY lesson_id
ORDER BY MAX(created_at) DESC
LIMIT 10;
```

### Recent Vocabulary Activity

```sql
-- Recent vocabulary evidence for a student
SELECT 
  ve.created_at,
  l.base_form as word,
  l.cefr_level,
  ve.evidence_type,
  ve.context_sentence,
  ve.was_correct
FROM vocab_evidence ve
JOIN lexemes l ON l.id = ve.lexeme_id
WHERE ve.student_id = :student_id
ORDER BY ve.created_at DESC
LIMIT 20;
```

### Vocabulary Growth Over Time

```sql
-- Track unique lexemes seen per month
SELECT 
  DATE_TRUNC('month', first_used_at) as month,
  COUNT(*) as new_lexemes_learned
FROM student_lexeme_history
WHERE student_id = :student_id
GROUP BY DATE_TRUNC('month', first_used_at)
ORDER BY month;
```

### Words Acquired (Seen in 3+ Lessons)

```sql
-- Get words the student has acquired (appeared in 3+ lessons)
SELECT 
  l.base_form,
  l.cefr_level,
  slh.total_count,
  slh.lesson_count,
  slh.acquired_at,
  slh.first_used_at
FROM student_lexeme_history slh
JOIN lexemes l ON l.id = slh.lexeme_id
WHERE slh.student_id = :student_id
  AND slh.acquired_at IS NOT NULL
ORDER BY slh.acquired_at DESC;
```

---

## Performance Considerations

1. **Batch Inserts**: Insert multiple evidence records in one query using array syntax
2. **Async Processing**: Run vocabulary analysis in background after lesson completes
3. **Database Trigger**: The `sync_student_lexeme_history()` trigger automatically maintains history - no manual updates needed
4. **Indexes**: All foreign keys and common query columns are already indexed

---

## Summary

This vocabulary processing system:
1. ✅ Extracts student utterances from `lesson_transcription_segments` or `justai_messages`
2. ✅ External NLP service analyzes text to identify lexemes
3. ✅ Application inserts records into `vocab_evidence` table
4. ✅ **Database trigger automatically updates `student_lexeme_history`**
5. ✅ Pre-built functions available for querying statistics via Supabase RPC
6. ✅ Supports both regular lessons and JustAI voice sessions

**Key Point:** External applications only need to insert into `vocab_evidence`. The database automatically:
- Counts total occurrences per lexeme
- Counts distinct lessons
- Tracks first/last usage
- Sets `acquired_at` when word appears in 3rd lesson
