# Pronunciation Baseline Assessment System

**Last Updated:** January 31, 2026  
**Platform:** JustTalk.ai Web & Mobile Apps  
**Purpose:** Complete documentation of the baseline pronunciation assessment workflow

---

## Table of Contents

1. [Overview](#overview)
2. [What is Baseline Assessment?](#what-is-baseline-assessment)
3. [Complete System Architecture](#complete-system-architecture)
4. [Step-by-Step Flow](#step-by-step-flow)
5. [Database Schema](#database-schema)
6. [API Endpoints](#api-endpoints)
7. [Frontend Implementation](#frontend-implementation)
8. [Results & Analytics](#results--analytics)
9. [Mobile Integration Guide](#mobile-integration-guide)
10. [Testing & Validation](#testing--validation)

---

## Overview

The **Baseline Assessment** is the entry point to JustTalk's pronunciation practice system. It's a 10-sentence diagnostic test that:

- ✅ Identifies pronunciation weaknesses across common English phonemes
- ✅ Establishes a performance baseline for tracking improvement
- ✅ Generates personalized practice recommendations
- ✅ Uses phonetically diverse sentences (CEFR A2-B1)
- ✅ Evaluates pronunciation, fluency, and integrity

**Duration**: ~5-7 minutes  
**Format**: 10 pre-selected sentences  
**Evaluation**: Powered by SpeechSuper API  
**One-time**: Only required once per student

---

## What is Baseline Assessment?

### Purpose

The baseline workout serves as:

1. **Diagnostic Tool** → Identifies which IPA phonemes the student struggles with
2. **Performance Baseline** → Establishes starting scores for tracking improvement
3. **Practice Generator** → Feeds data to targeted practice recommendation engine
4. **Progress Benchmark** → Future practice sessions compare against baseline performance

### Key Characteristics

| Property | Value |
|----------|-------|
| **Number of Items** | 10 sentences (fixed) |
| **Sentence Length** | 8-14 words |
| **CEFR Level** | A2-B1 (elementary to intermediate) |
| **Phoneme Coverage** | Broad spectrum of English phonemes |
| **Target Phonemes** | None (comprehensive assessment) |
| **Scoring Metrics** | Overall, Pronunciation, Fluency, Integrity |
| **Validity Threshold** | ≥6 sentences with integrity score ≥60 |

### When to Take Baseline

- **First-time users**: Before accessing pronunciation practice features
- **Returning users**: If no valid baseline exists
- **Optional retake**: If performance was poor (auto-suggested by system)

---

## Complete System Architecture

### High-Level Components

```
┌─────────────────────────────────────────────────────────────────────┐
│                     BASELINE ASSESSMENT SYSTEM                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐       │
│  │   Frontend   │────▶│ Edge Function│────▶│   Database   │       │
│  │   (React)    │     │   (Deno)     │     │ (PostgreSQL) │       │
│  └──────────────┘     └──────────────┘     └──────────────┘       │
│         │                     │                     │               │
│         │                     ▼                     │               │
│         │            ┌──────────────┐               │               │
│         │            │ SpeechSuper  │               │               │
│         │            │     API      │               │               │
│         │            └──────────────┘               │               │
│         │                     │                     │               │
│         │                     ▼                     │               │
│         │            ┌──────────────┐               │               │
│         │            │   Phoneme    │               │               │
│         └───────────▶│   Analysis   │──────────────▶│               │
│                      └──────────────┘               │               │
│                              │                      │               │
│                              ▼                      ▼               │
│                     ┌──────────────────────────────────┐           │
│                     │  Summary Views & Statistics      │           │
│                     └──────────────────────────────────┘           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow Diagram

```
START
  │
  ├─→ Frontend: Check for existing baseline
  │   └─→ Query: pronunciation_practice_sessions (is_baseline=true, status=pending/in_progress)
  │
  ├─→ Has active baseline?
  │   ├─ YES → Resume existing session
  │   └─ NO → Continue to create new
  │
  ├─→ Edge Function: pronunciation-start-baseline-workout
  │   ├─→ Create session: pronunciation_practice_sessions (is_baseline=true)
  │   ├─→ Create 10 items: pronunciation_practice_items (practice_type=sentence)
  │   └─→ Return: session_id + items array
  │
  ├─→ Frontend: Present sentence #1
  │   └─→ Display: reference_sentence
  │
  ├─→ Student: Record audio (WAV, 16kHz, mono, PCM16)
  │   └─→ WAV Recorder: createWavRecorder()
  │
  ├─→ Frontend: Submit audio for evaluation
  │   └─→ Edge Function: pronunciation-submit-sentence-practice
  │       ├─→ Validate: WAV format check
  │       ├─→ Create: pronunciation_sessions record
  │       ├─→ Call: SpeechSuper sent.eval.promax API
  │       ├─→ Store: pronunciation_practice_results (with extended scores)
  │       ├─→ Store: pronunciation_phoneme_attempts (all phonemes)
  │       ├─→ Store: pronunciation_raw_payloads (forensic data)
  │       ├─→ Update: session.completed_items += 1
  │       └─→ Return: scores + phoneme breakdown
  │
  ├─→ Frontend: Display results & progress
  │   ├─→ Show: pronunciation_score, fluency_score, integrity_score
  │   └─→ Progress: 1/10 sentences complete
  │
  ├─→ Repeat for sentences 2-10
  │   └─→ Loop until completed_items == total_items
  │
  ├─→ Edge Function: Mark session complete
  │   └─→ Update: status='completed', completed_at=now()
  │
  ├─→ Database: Generate summary views
  │   ├─→ pronunciation_baseline_workout_summary (session-level stats)
  │   └─→ pronunciation_baseline_phoneme_stats (phoneme error analysis)
  │
  ├─→ Frontend: Display results screen
  │   ├─→ Show: avg_overall, avg_pronunciation, avg_fluency
  │   ├─→ Show: Top error phonemes with severity buckets
  │   └─→ Validate: is_valid_baseline (≥6 sentences with integrity ≥60)
  │
  └─→ END: Baseline complete → Enable practice features
```

---

## Step-by-Step Flow

### Phase 1: Check Existing Baseline

**Location**: Frontend (React Hook)  
**Hook**: `useBaselineWorkout`  
**File**: `src/components/pronunciation/hooks/useBaselineWorkout.ts`

```typescript
// Query for existing active baseline
const existingSessionQuery = useQuery({
  queryKey: ['pronunciation-baseline-session', studentId],
  queryFn: async (): Promise<ExistingBaselineSession | null> => {
    const { data } = await supabase
      .from('pronunciation_practice_sessions')
      .select('id, status, created_at, total_items, completed_items')
      .eq('student_id', studentId)
      .eq('is_baseline', true)
      .in('status', ['pending', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    return data;
  }
});
```

**Decision Tree**:

```
Has existing active baseline?
├─ YES → Resume at completed_items index
└─ NO → Continue to Phase 2
```

---

### Phase 2: Start Baseline Workout

**Endpoint**: `POST /functions/v1/pronunciation-start-baseline-workout`

**Edge Function**: `supabase/functions/pronunciation-start-baseline-workout/index.ts`

#### Fixed Sentences (v1)

```typescript
const BASELINE_SENTENCES_V1 = [
  "The weather forecast says it will be sunny and warm tomorrow.",
  "My brother enjoys playing basketball with his friends after school.",
  "She bought a beautiful dress from the new store downtown.",
  "Can you help me find the nearest bus stop please?",
  "The children were laughing and running in the park all afternoon.",
  "I usually drink coffee with breakfast but today I want tea.",
  "They decided to watch a movie together on Friday night.",
  "Please remember to bring your umbrella because it might rain.",
  "The restaurant serves delicious food at very reasonable prices.",
  "We need to finish this project before the deadline next week.",
];
```

**Why these sentences?**
- 🎯 Phonetically diverse (cover common English phonemes)
- 📚 CEFR A2-B1 (accessible but challenging)
- 🗣️ Natural conversational language
- ⚖️ Balanced word count (8-14 words)

#### Database Operations

```sql
-- 1. Create session
INSERT INTO pronunciation_practice_sessions (
  student_id,
  status,
  is_baseline,
  target_phonemes,
  total_items,
  completed_items
) VALUES (
  :student_id,
  'pending',
  true,
  '{}',  -- Empty array (no specific targets)
  10,
  0
);

-- 2. Create practice items (10 sentences)
INSERT INTO pronunciation_practice_items (
  student_id,
  practice_session_id,
  practice_type,
  reference_sentence,
  target_ipa_symbol,
  item_order,
  difficulty_tier,
  is_active,
  word_text,
  word_ipa
) VALUES
  (:student_id, :session_id, 'sentence', 'The weather forecast...', NULL, 1, 2, true, NULL, NULL),
  (:student_id, :session_id, 'sentence', 'My brother enjoys...', NULL, 2, 2, true, NULL, NULL),
  -- ... 8 more sentences ...
```

#### Response Format

```typescript
{
  success: true,
  session_id: "uuid",
  is_existing: false,  // true if resuming
  total_items: 10,
  completed_items: 0,  // Start index
  items: [
    {
      item_id: "uuid",
      reference_sentence: "The weather forecast says...",
      item_order: 1
    },
    // ... 9 more items ...
  ]
}
```

---

### Phase 3: Present Sentence to Student

**Component**: `BaselineWorkoutFlow`  
**File**: `src/components/pronunciation/BaselineWorkoutFlow.tsx`

#### UI Elements

1. **Progress Bar** → Shows N/10 completion
2. **Sentence Display** → Large, readable text
3. **Record Button** → Red circle microphone icon
4. **Instructions** → "Tap to record"

```tsx
<div className="bg-muted/30 p-4 rounded-lg border">
  <p className="text-base leading-relaxed text-center">
    "{currentItem?.reference_sentence}"
  </p>
</div>

<Button 
  size="lg" 
  onClick={startRecording}
  className="h-16 w-16 rounded-full"
>
  <Mic className="h-8 w-8" />
</Button>
```

---

### Phase 4: Record Audio

**Audio Recorder**: `createWavRecorder`  
**File**: `src/components/pronunciation/wavRecorder.ts`

#### Technical Requirements

| Parameter | Value | Why |
|-----------|-------|-----|
| **Format** | WAV (RIFF/WAVE) | SpeechSuper requirement |
| **Encoding** | PCM16 | 16-bit signed integer |
| **Sample Rate** | 16,000 Hz | Locked per SpeechSuper contract |
| **Channels** | Mono (1) | Stereo rejected by API |

#### Recording Flow

```typescript
// 1. Request microphone permission
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

// 2. Create WAV recorder
const wavRecorder = createWavRecorder(stream, { 
  targetSampleRate: 16000, 
  numChannels: 1 
});

// 3. Start recording
await wavRecorder.start();

// 4. Stop and get blob
const audioBlob = await wavRecorder.stop();
```

#### WAV File Structure

```
Byte 0-3:   "RIFF" (chunk ID)
Byte 4-7:   File size - 8
Byte 8-11:  "WAVE" (format)
Byte 12-15: "fmt " (subchunk1 ID)
Byte 16-19: 16 (PCM format)
Byte 20-21: 1 (audio format: PCM)
Byte 22-23: 1 (channels: mono)
Byte 24-27: 16000 (sample rate)
Byte 28-31: 32000 (byte rate)
Byte 32-33: 2 (block align)
Byte 34-35: 16 (bits per sample)
Byte 36-39: "data" (subchunk2 ID)
Byte 40-43: Data size
Byte 44+:   Audio samples (16-bit signed integers)
```

---

### Phase 5: Submit Audio for Evaluation

**Endpoint**: `POST /functions/v1/pronunciation-submit-sentence-practice`

**Edge Function**: `supabase/functions/pronunciation-submit-sentence-practice/index.ts`

#### Request Format

```typescript
// multipart/form-data
const formData = new FormData();
formData.append('practice_item_id', currentItem.item_id);
formData.append('audio', audioBlob, 'baseline.wav');

const response = await fetch(
  `${SUPABASE_URL}/functions/v1/pronunciation-submit-sentence-practice`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`
    },
    body: formData
  }
);
```

#### Edge Function Processing Steps

```
1. Authenticate user
   └─→ Verify JWT token
   └─→ Extract user.id

2. Fetch practice item
   └─→ Query: pronunciation_practice_items + pronunciation_practice_sessions
   └─→ Verify: student_id matches user.id
   └─→ Check: is_baseline flag
   └─→ Extract: reference_sentence

3. Validate audio format
   └─→ Read first 12 bytes
   └─→ Check: RIFF header + WAVE format
   └─→ Reject if not WAV

4. Create pronunciation session
   └─→ INSERT INTO pronunciation_sessions
   └─→ source_type = 'baseline_workout'
   └─→ provider_api = 'sent.eval.promax'
   └─→ dict_type = 'IPA88'
   └─→ dict_dialect = 'en_us'

5. Call SpeechSuper API
   └─→ Generate timestamp + signatures (SHA1)
   └─→ Build JSON payload with connect + start commands
   └─→ POST to api.speechsuper.com/sent.eval.promax
   └─→ Attach audio as multipart form field

6. Parse SpeechSuper response
   └─→ Check: eof == 1 (final result)
   └─→ Extract: overall, pronunciation, fluency, integrity scores
   └─→ Extract: words array with phoneme details

7. Store practice result
   └─→ INSERT INTO pronunciation_practice_results
   └─→ Fields: pronunciation_score, overall_score, fluency_score, integrity_score
   └─→ Calculate: attempt_number

8. Store phoneme attempts
   └─→ INSERT INTO pronunciation_phoneme_attempts (bulk)
   └─→ For each phoneme in each word:
   └─→   - ipa_symbol, score, read_type, sound_like
   └─→   - is_target_phoneme = false (baseline has no targets)
   └─→   - target_ipa = null

9. Store raw payload
   └─→ INSERT INTO pronunciation_raw_payloads
   └─→ Fields: request_payload, response_payload
   └─→ Purpose: Forensic debugging

10. Update session progress
    └─→ UPDATE pronunciation_practice_sessions
    └─→ SET completed_items += 1
    └─→ SET status = 'in_progress'
    └─→ SET started_at = now() (if first item)

11. Check for completion
    └─→ IF completed_items >= total_items:
    └─→   SET status = 'completed'
    └─→   SET completed_at = now()

12. Return response to client
```

#### Response Format

```typescript
{
  success: true,
  result_id: "uuid",
  pronunciation_score: 78,    // 0-100
  overall_score: 75,           // 0-100
  fluency_score: 82,           // 0-100
  integrity_score: 88,         // 0-100 (how well it matches reference)
  was_correct: true,           // pronunciation_score >= 60
  attempt_number: 1,
  sentence: "The weather forecast says...",
  words: [
    {
      text: "weather",
      score: 85,
      phonemes: [
        {
          phoneme: "w",
          score: 92,
          readType: 0,  // 0=correct
        },
        {
          phoneme: "ɛ",
          score: 78,
          readType: 1,  // 1=mispronounced
          soundLike: "ɪ"
        },
        // ... more phonemes ...
      ]
    },
    // ... more words ...
  ],
  is_baseline: true,
  session_completed: false,  // true after 10th sentence
  completed_items: 1,
  total_items: 10,
  raw_response: { /* full SpeechSuper response */ }
}
```

---

### Phase 6: Display Results & Continue

**Component**: `BaselineWorkoutFlow`

#### Result Display Elements

1. **Score Badge** → Green checkmark if score ≥ 60
2. **Phoneme Breakdown** → Visual indicators for each sound
3. **Re-record Button** → Allow retry
4. **Next Button** → Move to next sentence

```tsx
<div className="flex items-center justify-center gap-2 text-green-600">
  <CheckCircle className="h-5 w-5" />
  <span className="font-medium">Recording complete</span>
</div>

<div className="flex gap-3">
  <Button variant="outline" onClick={handleReRecord}>
    Re-record
  </Button>
  <Button onClick={submitRecording}>
    Next <ChevronRight className="ml-2" />
  </Button>
</div>
```

#### Progress Update

```tsx
<Progress value={(currentIndex / items.length) * 100} />
<span className="text-sm text-muted-foreground">
  {currentIndex + 1} / {items.length}
</span>
```

**Loop**: Repeat steps 3-6 for all 10 sentences

---

### Phase 7: Session Completion

**Trigger**: `completed_items == total_items` (after 10th submission)

#### Automatic Actions

```sql
-- 1. Mark session as completed
UPDATE pronunciation_practice_sessions
SET 
  status = 'completed',
  completed_at = now()
WHERE id = :session_id;

-- 2. Trigger materialized view refreshes (if used)
-- Views auto-update based on completed_at timestamp

-- 3. Make data available to summary views
-- pronunciation_baseline_workout_summary
-- pronunciation_baseline_phoneme_stats
```

#### Frontend Transitions

```typescript
// Detect completion
if (result.session_completed) {
  // Invalidate queries to refresh summary
  queryClient.invalidateQueries({ 
    queryKey: ['pronunciation-baseline-summary'] 
  });
  queryClient.invalidateQueries({ 
    queryKey: ['pronunciation-baseline-phoneme-stats'] 
  });
  
  // Navigate to results screen
  setFlowState({ type: 'results' });
}
```

---

### Phase 8: Generate Summary Views

**Views**: Auto-generated by PostgreSQL upon completion

#### View 1: `pronunciation_baseline_workout_summary`

**Purpose**: Session-level aggregate statistics

```sql
SELECT
  student_id,
  baseline_session_id,
  completed_at,
  total_sentences,           -- Always 10
  counted_sentences,         -- Sentences with integrity ≥60
  avg_overall,               -- Average overall score
  avg_pronunciation,         -- Average pronunciation score
  avg_fluency,              -- Average fluency score
  is_valid_baseline         -- TRUE if counted_sentences ≥ 6
FROM pronunciation_baseline_workout_summary
WHERE student_id = :student_id;
```

**Key Logic**:

```sql
-- Filter for integrity
(COALESCE(ppr.integrity_score, 0) >= 60) AS is_counted

-- Calculate averages only from counted sentences
ROUND(AVG(pronunciation_score) FILTER (WHERE is_counted), 1)

-- Validity check
(COUNT(*) FILTER (WHERE is_counted) >= 6) AS is_valid_baseline
```

**Example Result**:

```json
{
  "student_id": "uuid",
  "baseline_session_id": "uuid",
  "completed_at": "2026-01-31T10:00:00Z",
  "total_sentences": 10,
  "counted_sentences": 8,
  "avg_overall": 75.3,
  "avg_pronunciation": 78.1,
  "avg_fluency": 82.5,
  "is_valid_baseline": true
}
```

---

#### View 2: `pronunciation_baseline_phoneme_stats`

**Purpose**: Phoneme-level error analysis

```sql
SELECT
  student_id,
  baseline_session_id,
  baseline_completed_at,
  ipa_symbol,              -- e.g., "θ", "ð", "ɹ"
  exposures,               -- How many times phoneme appeared
  avg_score,               -- Average pronunciation score
  error_count,             -- Times phoneme had error
  error_rate,              -- error_count / exposures * 100
  severity_bucket          -- 'critical', 'warning', or 'stable'
FROM pronunciation_baseline_phoneme_stats
WHERE student_id = :student_id
ORDER BY error_rate DESC;
```

**Error Detection Logic**:

```sql
CASE
  WHEN ppa.read_type IN (3, 6) THEN true  -- Added/omitted
  WHEN ppa.score < 60 THEN true           -- Low score
  ELSE false
END AS is_error
```

**Severity Buckets**:

```sql
CASE
  WHEN error_rate >= 40 THEN 'critical'  -- ≥40% errors
  WHEN error_rate >= 20 THEN 'warning'   -- 20-39% errors
  ELSE 'stable'                          -- <20% errors
END AS severity_bucket
```

**Example Results**:

```json
[
  {
    "ipa_symbol": "θ",
    "exposures": 8,
    "avg_score": 52.3,
    "error_count": 6,
    "error_rate": 75.0,
    "severity_bucket": "critical"
  },
  {
    "ipa_symbol": "ð",
    "exposures": 5,
    "avg_score": 68.2,
    "error_count": 2,
    "error_rate": 40.0,
    "severity_bucket": "critical"
  },
  {
    "ipa_symbol": "ɹ",
    "exposures": 12,
    "avg_score": 78.5,
    "error_count": 3,
    "error_rate": 25.0,
    "severity_bucket": "warning"
  }
]
```

---

### Phase 9: Display Final Results

**Component**: `BaselineResultsScreen`  
**File**: `src/components/pronunciation/BaselineResultsScreen.tsx`

#### Results Screen Elements

1. **Overall Stats Card**
   - Average Overall Score
   - Average Pronunciation Score
   - Average Fluency Score
   - Validity badge (✓ or ⚠️)

2. **Top Error Phonemes**
   - List of 5-10 worst phonemes
   - Color-coded by severity
   - Error rate percentage
   - Example words with that sound

3. **Action Buttons**
   - "Start Practice" → Begin targeted practice
   - "Retake Baseline" → Redo assessment (if invalid)

```tsx
<Card>
  <CardHeader>
    <CardTitle>Baseline Complete</CardTitle>
    {summary.is_valid_baseline ? (
      <Badge variant="success">✓ Valid Baseline</Badge>
    ) : (
      <Badge variant="warning">⚠️ Needs Retake</Badge>
    )}
  </CardHeader>
  <CardContent>
    <div className="grid gap-4">
      <StatCard 
        label="Overall Score" 
        value={summary.avg_overall} 
      />
      <StatCard 
        label="Pronunciation" 
        value={summary.avg_pronunciation} 
      />
      <StatCard 
        label="Fluency" 
        value={summary.avg_fluency} 
      />
    </div>

    <div className="mt-6">
      <h3 className="font-semibold mb-3">Focus Areas</h3>
      {phonemeStats.slice(0, 5).map(phoneme => (
        <PhonemeErrorCard
          key={phoneme.ipa_symbol}
          phoneme={phoneme.ipa_symbol}
          errorRate={phoneme.error_rate}
          severity={phoneme.severity_bucket}
        />
      ))}
    </div>

    <Button onClick={onComplete} className="w-full mt-6">
      Start Targeted Practice
    </Button>
  </CardContent>
</Card>
```

---

### Phase 10: Enable Practice Features

**Hook**: `useBaselineSummary`  
**File**: `src/components/pronunciation/hooks/useBaselineSummary.ts`

#### Query for Baseline Status

```typescript
const { 
  summary, 
  phonemeStats, 
  hasValidBaseline, 
  needsRetake 
} = useBaselineSummary(studentId);

// summary.is_valid_baseline → true/false
// phonemeStats → array of error phonemes
```

#### Feature Unlocking Logic

```typescript
if (!hasValidBaseline) {
  return (
    <div>
      <p>Complete the baseline workout to access practice features.</p>
      <Button onClick={startBaseline}>Start Baseline</Button>
    </div>
  );
}

// Baseline valid → Show practice dashboard
return <PracticeDashboard phonemeStats={phonemeStats} />;
```

---

## Database Schema

### Core Tables

#### `pronunciation_practice_sessions`

```sql
CREATE TABLE pronunciation_practice_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES profiles(id),
  status TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'abandoned')),
  is_baseline BOOLEAN NOT NULL DEFAULT false,  -- TRUE for baseline
  target_phonemes TEXT[],                       -- Empty for baseline
  total_items INTEGER NOT NULL,                 -- Always 10 for baseline
  completed_items INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_baseline_sessions 
  ON pronunciation_practice_sessions(student_id, is_baseline, status, completed_at DESC);
```

---

#### `pronunciation_practice_items`

```sql
CREATE TABLE pronunciation_practice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_session_id UUID REFERENCES pronunciation_practice_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id),
  practice_type TEXT CHECK (practice_type IN ('word', 'sentence')),
  target_ipa_symbol TEXT,                -- NULL for baseline
  word_text TEXT,                         -- NULL for baseline (sentence-level)
  word_ipa TEXT,                          -- NULL for baseline
  reference_sentence TEXT NOT NULL,       -- The sentence to read
  difficulty_tier INTEGER,                -- 2 for baseline (medium)
  phoneme_position INTEGER,               -- NULL for baseline
  item_order INTEGER NOT NULL,            -- 1-10 for baseline
  is_active BOOLEAN DEFAULT true,
  selection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_practice_items_session 
  ON pronunciation_practice_items(practice_session_id, item_order);
```

---

#### `pronunciation_practice_results`

```sql
CREATE TABLE pronunciation_practice_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_session_id UUID REFERENCES pronunciation_practice_sessions(id),
  practice_item_id UUID REFERENCES pronunciation_practice_items(id),
  pronunciation_session_id UUID REFERENCES pronunciation_sessions(id),
  pronunciation_score NUMERIC(5,2) NOT NULL,    -- 0-100
  overall_score NUMERIC(5,2),                    -- 0-100 (sentences)
  fluency_score NUMERIC(5,2),                    -- 0-100 (sentences)
  integrity_score NUMERIC(5,2),                  -- 0-100 (sentences)
  was_correct BOOLEAN DEFAULT false,             -- score >= 60
  phoneme_was_correct BOOLEAN,                   -- NULL for sentences
  attempt_number INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_practice_results_session 
  ON pronunciation_practice_results(practice_session_id, created_at);
```

---

#### `pronunciation_phoneme_attempts`

```sql
CREATE TABLE pronunciation_phoneme_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES profiles(id),
  pronunciation_session_id UUID REFERENCES pronunciation_sessions(id),
  practice_result_id UUID REFERENCES pronunciation_practice_results(id),
  practice_item_id UUID REFERENCES pronunciation_practice_items(id),
  practice_type TEXT NOT NULL,
  utterance_text TEXT NOT NULL,          -- Full sentence
  token_text TEXT NOT NULL,              -- Individual word
  word_text TEXT NOT NULL,               -- Same as token_text
  ipa_symbol TEXT NOT NULL,              -- Phoneme (e.g., "θ")
  position_in_word INTEGER NOT NULL,
  score NUMERIC(5,2) NOT NULL,          -- 0-100
  read_type INTEGER,                     -- 0=correct, 1=mispronounced, 2=omitted, 3=added
  sound_like TEXT,                       -- What it sounded like
  inserted_before TEXT[],
  inserted_after TEXT[],
  is_target_phoneme BOOLEAN DEFAULT false,  -- Always false for baseline
  target_ipa TEXT,                           -- Always NULL for baseline
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_phoneme_attempts_student_phoneme 
  ON pronunciation_phoneme_attempts(student_id, ipa_symbol);

CREATE INDEX idx_phoneme_attempts_baseline 
  ON pronunciation_phoneme_attempts(practice_session_id, ipa_symbol)
  WHERE is_target_phoneme = false;  -- Optimize baseline queries
```

---

### Summary Views

#### `pronunciation_baseline_workout_summary`

```sql
CREATE OR REPLACE VIEW pronunciation_baseline_workout_summary AS
WITH latest_baseline AS (
  SELECT DISTINCT ON (pps.student_id)
    pps.id AS session_id,
    pps.student_id,
    pps.completed_at
  FROM pronunciation_practice_sessions pps
  WHERE pps.status = 'completed'
    AND pps.is_baseline = true
  ORDER BY pps.student_id, pps.completed_at DESC
),
sentence_scores AS (
  SELECT
    lb.student_id,
    lb.session_id,
    lb.completed_at,
    ppr.overall_score,
    ppr.pronunciation_score,
    ppr.fluency_score,
    ppr.integrity_score,
    (COALESCE(ppr.integrity_score, 0) >= 60) AS is_counted
  FROM latest_baseline lb
  JOIN pronunciation_practice_results ppr ON ppr.practice_session_id = lb.session_id
  JOIN pronunciation_practice_items ppi ON ppi.id = ppr.practice_item_id
  WHERE ppi.practice_type = 'sentence'
)
SELECT
  student_id,
  session_id AS baseline_session_id,
  completed_at,
  COUNT(*)::int AS total_sentences,
  COUNT(*) FILTER (WHERE is_counted)::int AS counted_sentences,
  ROUND(AVG(overall_score) FILTER (WHERE is_counted), 1) AS avg_overall,
  ROUND(AVG(pronunciation_score) FILTER (WHERE is_counted), 1) AS avg_pronunciation,
  ROUND(AVG(fluency_score) FILTER (WHERE is_counted), 1) AS avg_fluency,
  (COUNT(*) FILTER (WHERE is_counted) >= 6) AS is_valid_baseline
FROM sentence_scores
GROUP BY student_id, session_id, completed_at;
```

---

#### `pronunciation_baseline_phoneme_stats`

```sql
CREATE OR REPLACE VIEW pronunciation_baseline_phoneme_stats AS
WITH latest_baseline AS (
  SELECT DISTINCT ON (pps.student_id)
    pps.id AS session_id,
    pps.student_id,
    pps.completed_at
  FROM pronunciation_practice_sessions pps
  WHERE pps.status = 'completed'
    AND pps.is_baseline = true
  ORDER BY pps.student_id, pps.completed_at DESC
),
baseline_phonemes AS (
  SELECT
    lb.student_id,
    lb.session_id AS baseline_session_id,
    lb.completed_at AS baseline_completed_at,
    ppa.ipa_symbol,
    ppa.score,
    ppa.read_type,
    CASE
      WHEN ppa.read_type IN (3, 6) THEN true
      WHEN ppa.score < 60 THEN true
      ELSE false
    END AS is_error
  FROM latest_baseline lb
  JOIN pronunciation_practice_results ppr ON ppr.practice_session_id = lb.session_id
  JOIN pronunciation_phoneme_attempts ppa ON ppa.practice_result_id = ppr.id
)
SELECT
  student_id,
  baseline_session_id,
  baseline_completed_at,
  ipa_symbol,
  COUNT(*)::int AS exposures,
  ROUND(AVG(score), 1) AS avg_score,
  COUNT(*) FILTER (WHERE is_error)::int AS error_count,
  ROUND(
    (COUNT(*) FILTER (WHERE is_error)::numeric / NULLIF(COUNT(*), 0)) * 100,
    1
  ) AS error_rate,
  CASE
    WHEN (COUNT(*) FILTER (WHERE is_error)::numeric / NULLIF(COUNT(*), 0)) >= 0.4 THEN 'critical'
    WHEN (COUNT(*) FILTER (WHERE is_error)::numeric / NULLIF(COUNT(*), 0)) >= 0.2 THEN 'warning'
    ELSE 'stable'
  END AS severity_bucket
FROM baseline_phonemes
GROUP BY student_id, baseline_session_id, baseline_completed_at, ipa_symbol
HAVING COUNT(*) >= 2;  -- Require at least 2 exposures
```

---

## API Endpoints

### 1. Start Baseline Workout

**Endpoint**: `POST /functions/v1/pronunciation-start-baseline-workout`

**Authentication**: Required (JWT Bearer token)

**Request Body**: None (student ID extracted from auth token)

**Response**:
```typescript
{
  success: boolean;
  session_id: string;
  is_existing: boolean;
  total_items: number;
  completed_items: number;
  items: Array<{
    item_id: string;
    reference_sentence: string;
    item_order: number;
  }>;
}
```

**Example**:
```bash
curl -X POST \
  https://your-project.supabase.co/functions/v1/pronunciation-start-baseline-workout \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json'
```

---

### 2. Submit Sentence Practice

**Endpoint**: `POST /functions/v1/pronunciation-submit-sentence-practice`

**Authentication**: Required

**Request**: `multipart/form-data`

**Form Fields**:
- `practice_item_id`: UUID (required)
- `audio`: WAV file (required)

**Response**:
```typescript
{
  success: boolean;
  result_id: string;
  pronunciation_score: number;
  overall_score: number;
  fluency_score: number;
  integrity_score: number;
  was_correct: boolean;
  attempt_number: number;
  sentence: string;
  words: Array<{
    text: string;
    score: number;
    phonemes: Array<{
      phoneme: string;
      score: number;
      readType: number;
      soundLike?: string;
    }>;
  }>;
  is_baseline: boolean;
  session_completed: boolean;
  completed_items: number;
  total_items: number;
}
```

**Example**:
```typescript
const formData = new FormData();
formData.append('practice_item_id', itemId);
formData.append('audio', audioBlob, 'baseline.wav');

const response = await fetch(
  `${SUPABASE_URL}/functions/v1/pronunciation-submit-sentence-practice`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`
    },
    body: formData
  }
);
```

---

## Frontend Implementation

### React Hook: useBaselineWorkout

```typescript
import { useBaselineWorkout } from '@/components/pronunciation/hooks/useBaselineWorkout';

function PronunciationPage() {
  const studentId = useAuth().user?.id;
  const {
    existingSession,
    hasActiveBaseline,
    startBaselineWorkout,
    isStarting
  } = useBaselineWorkout(studentId);

  const handleStart = async () => {
    const session = await startBaselineWorkout();
    console.log('Session started:', session.session_id);
    // Navigate to baseline flow
  };

  return (
    <div>
      {hasActiveBaseline ? (
        <Button onClick={() => navigate(`/baseline/${existingSession.id}`)}>
          Resume Baseline ({existingSession.completed_items}/10)
        </Button>
      ) : (
        <Button onClick={handleStart} disabled={isStarting}>
          Start Baseline Workout
        </Button>
      )}
    </div>
  );
}
```

---

### React Component: BaselineWorkoutFlow

```typescript
import { BaselineWorkoutFlow } from '@/components/pronunciation/BaselineWorkoutFlow';

function BaselinePage() {
  const studentId = useAuth().user?.id;
  const navigate = useNavigate();

  return (
    <BaselineWorkoutFlow
      studentId={studentId}
      onClose={() => navigate('/pronunciation')}
      onComplete={() => navigate('/pronunciation/practice')}
    />
  );
}
```

**Component State Machine**:

```
type FlowState = 
  | { type: 'loading' }
  | { type: 'recording'; currentIndex: number; items: Item[] }
  | { type: 'submitting'; currentIndex: number; items: Item[] }
  | { type: 'results' }
  | { type: 'error'; message: string };
```

---

## Results & Analytics

### Query Baseline Summary

```typescript
import { useBaselineSummary } from '@/components/pronunciation/hooks/useBaselineSummary';

function BaselineResultsScreen({ studentId }) {
  const { 
    summary, 
    phonemeStats, 
    hasValidBaseline, 
    needsRetake 
  } = useBaselineSummary(studentId);

  if (!summary) {
    return <p>No baseline found</p>;
  }

  return (
    <div>
      <h2>Baseline Results</h2>
      {hasValidBaseline ? (
        <Badge variant="success">✓ Valid</Badge>
      ) : (
        <Badge variant="warning">⚠️ Needs Retake</Badge>
      )}

      <div className="stats">
        <Stat label="Overall" value={summary.avg_overall} />
        <Stat label="Pronunciation" value={summary.avg_pronunciation} />
        <Stat label="Fluency" value={summary.avg_fluency} />
      </div>

      <h3>Top Error Phonemes</h3>
      {phonemeStats.slice(0, 5).map(phoneme => (
        <PhonemeCard
          key={phoneme.ipa_symbol}
          phoneme={phoneme.ipa_symbol}
          errorRate={phoneme.error_rate}
          severity={phoneme.severity_bucket}
        />
      ))}
    </div>
  );
}
```

---

### Validity Rules

**Valid Baseline Requirements**:
1. ✅ All 10 sentences submitted
2. ✅ At least 6 sentences with `integrity_score >= 60`
3. ✅ Session status = 'completed'

**Why Integrity Threshold?**
- Filters out off-topic or misread sentences
- Ensures student actually read the reference sentence
- Prevents gaming the system with random audio

---

## Mobile Integration Guide

### Complete Baseline Flow (React Native)

```typescript
import { supabase } from '@/lib/supabase';
import AudioRecord from 'react-native-audio-record';

class BaselineWorkout {
  private sessionId: string | null = null;
  private items: BaselineItem[] = [];
  private currentIndex: number = 0;

  async start() {
    // 1. Start baseline workout
    const { data } = await supabase.functions.invoke(
      'pronunciation-start-baseline-workout'
    );
    
    this.sessionId = data.session_id;
    this.items = data.items;
    this.currentIndex = data.completed_items;
  }

  getCurrentItem() {
    return this.items[this.currentIndex];
  }

  async recordAndSubmit() {
    // 2. Configure audio recorder
    const options = {
      sampleRate: 16000,
      channels: 1,
      bitsPerSample: 16,
      wavFile: 'baseline.wav'
    };
    
    AudioRecord.init(options);
    
    // 3. Start recording
    AudioRecord.start();
    
    // Wait for user to stop...
    
    // 4. Stop recording
    const audioFile = await AudioRecord.stop();
    const audioBlob = await fetch(audioFile).then(r => r.blob());
    
    // 5. Submit to API
    const formData = new FormData();
    formData.append('practice_item_id', this.getCurrentItem().item_id);
    formData.append('audio', audioBlob);
    
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/pronunciation-submit-sentence-practice`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        },
        body: formData
      }
    );
    
    const result = await response.json();
    
    // 6. Check completion
    if (result.session_completed) {
      return { done: true, result };
    }
    
    // 7. Move to next
    this.currentIndex++;
    return { done: false, result };
  }

  getProgress() {
    return {
      current: this.currentIndex + 1,
      total: this.items.length,
      percentage: ((this.currentIndex + 1) / this.items.length) * 100
    };
  }
}

// Usage
const workout = new BaselineWorkout();
await workout.start();

while (true) {
  const item = workout.getCurrentItem();
  console.log(`Read: ${item.reference_sentence}`);
  
  const { done, result } = await workout.recordAndSubmit();
  console.log(`Score: ${result.pronunciation_score}`);
  
  if (done) {
    console.log('Baseline complete!');
    break;
  }
}
```

---

## Testing & Validation

### Test Baseline Workflow

```typescript
describe('Baseline Assessment', () => {
  it('should complete full baseline workflow', async () => {
    // 1. Start baseline
    const { data: session } = await supabase.functions.invoke(
      'pronunciation-start-baseline-workout'
    );
    
    expect(session.total_items).toBe(10);
    expect(session.completed_items).toBe(0);
    expect(session.items).toHaveLength(10);
    
    // 2. Submit each sentence
    for (const item of session.items) {
      const audio = generateTestWav();
      const result = await submitAudio(item.item_id, audio);
      
      expect(result.pronunciation_score).toBeGreaterThanOrEqual(0);
      expect(result.pronunciation_score).toBeLessThanOrEqual(100);
      expect(result.is_baseline).toBe(true);
    }
    
    // 3. Verify completion
    const { data: summary } = await supabase
      .from('pronunciation_baseline_workout_summary')
      .select('*')
      .eq('student_id', studentId)
      .single();
    
    expect(summary.total_sentences).toBe(10);
    expect(summary.is_valid_baseline).toBeDefined();
  });
});
```

---

## Common Issues & Solutions

### Issue 1: Invalid Baseline (< 6 sentences passed)

**Symptom**: `is_valid_baseline = false`

**Causes**:
- Poor audio quality (background noise)
- Student didn't read reference sentence correctly
- Microphone issues

**Solution**:
```typescript
if (needsRetake) {
  return (
    <Alert variant="warning">
      <p>Your baseline needs to be retaken for accurate results.</p>
      <p>Please find a quiet space and read each sentence carefully.</p>
      <Button onClick={handleRetake}>Retake Baseline</Button>
    </Alert>
  );
}
```

---

### Issue 2: Session Not Completing

**Symptom**: `session_completed = false` after 10th sentence

**Diagnosis**:
```sql
-- Check session progress
SELECT completed_items, total_items, status
FROM pronunciation_practice_sessions
WHERE id = :session_id;

-- Check submitted results
SELECT COUNT(*) 
FROM pronunciation_practice_results
WHERE practice_session_id = :session_id;
```

**Solution**: Verify completed_items increments correctly in edge function

---

### Issue 3: Audio Format Rejection

**Symptom**: `"Practice audio must be WAV (RIFF/WAVE)"`

**Validation**:
```typescript
async function validateWav(file: File): Promise<boolean> {
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);
  
  // Check RIFF
  const riff = String.fromCharCode(
    view.getUint8(0),
    view.getUint8(1),
    view.getUint8(2),
    view.getUint8(3)
  );
  
  // Check WAVE
  const wave = String.fromCharCode(
    view.getUint8(8),
    view.getUint8(9),
    view.getUint8(10),
    view.getUint8(11)
  );
  
  // Check sample rate
  const sampleRate = view.getUint32(24, true);
  
  return riff === 'RIFF' && wave === 'WAVE' && sampleRate === 16000;
}
```

---

## Summary

### Baseline Assessment Purpose

- 🎯 **Diagnostic**: Identify pronunciation weaknesses
- 📊 **Baseline**: Establish performance metrics
- 🚀 **Enabler**: Unlock targeted practice features
- 📈 **Tracking**: Measure improvement over time

### Key Requirements

- **10 sentences**: Fixed, phonetically diverse
- **WAV audio**: 16kHz, mono, PCM16
- **≥6 valid**: Integrity score ≥60 required
- **One-time**: Per student (can retake if invalid)

### Data Flow

```
Frontend → Edge Function → SpeechSuper API → Database → Summary Views → Frontend
```

### Mobile Integration

- Use `pronunciation-start-baseline-workout` endpoint
- Record WAV audio (16kHz, mono)
- Submit via `pronunciation-submit-sentence-practice`
- Query `pronunciation_baseline_workout_summary` for results

### Next Steps

After baseline completion:
1. ✅ View phoneme error analysis
2. ✅ Start targeted practice sessions
3. ✅ Track improvement over time

---

**End of Documentation**
