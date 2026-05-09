# Real-Time Vocabulary Processing for AI Voice Sessions

**Last Updated:** January 29, 2026  
**Status:** Implementation Plan  
**Related Docs:** [FOCUS_SET_VOCABULARY_TRACKING.md](FOCUS_SET_VOCABULARY_TRACKING.md), [VOICE_SESSION_PROCESSING.md](VOICE_SESSION_PROCESSING.md)

---

## Table of Contents

1. [Overview](#overview)
2. [Current Architecture Problems](#current-architecture-problems)
3. [Proposed Architecture](#proposed-architecture)
4. [Implementation Plan](#implementation-plan)
5. [Database Changes](#database-changes)
6. [Frontend Changes](#frontend-changes)
7. [Backend Changes](#backend-changes)
8. [Testing Strategy](#testing-strategy)
9. [Rollout Plan](#rollout-plan)

---

## Overview

This document outlines the architectural changes needed to enable **real-time Focus Set vocabulary tracking** during AI voice chat sessions. The current implementation only processes vocabulary at the end of conversations, which prevents Focus Set snapshots from being created and tracked properly.

### Goals

- ✅ Enable Focus Set tracking for AI voice sessions
- ✅ Create virtual lesson + snapshot at session START (not end)
- ✅ Process vocabulary in real-time as user speaks
- ✅ Show live progress updates in UI
- ✅ Maintain backward compatibility with existing flows

---

## Current Architecture Problems

### Problem 1: No Virtual Lesson Until Session Ends

**Current Flow:**
```
Session Start → justai_conversations created → 
  User chats → Session ends → 
  process-voice-session runs → 
  Virtual lesson created → 
  Segments created → 
  Vocabulary processed
```

**Issue:** Without a lesson ID at session start, there's no way to:
- Create a Focus Set snapshot
- Track `was_in_focus` flag accurately
- Show real-time progress in LiveGoalsPanel

### Problem 2: Messages Stored Without Lesson Context

User messages are saved to `justai_messages` during the conversation, but they're not linked to any lesson until post-processing. This means:

- No `lesson_transcription_segments` created during session
- No way to call `vocab-ingest-segment` in real-time
- All vocabulary processing is batched at the end

### Problem 3: No Focus Snapshot Mechanism

The `lesson_focus_snapshots` table requires a lesson to exist with `status='in_progress'`. Currently:

- Lesson is created with `status='completed'` after session ends
- No trigger fires to create snapshot
- `was_in_focus` flag cannot be determined correctly

### Problem 4: Batch Processing Only

`process-voice-session` fetches the entire transcript from ElevenLabs at the end and processes all segments in a loop. This is:

- Inefficient (duplicate API calls)
- Delayed (user sees no progress during session)
- Fragile (if edge function times out, all processing fails)

---

## Proposed Architecture

### New Flow Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                     REAL-TIME VOCAB PROCESSING                        │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  1. Session Initialization (CHANGES)                                 │
│     ├── Create justai_conversations                                  │
│     ├── Create virtual lesson (status='in_progress') ◄─── NEW        │
│     ├── Trigger snapshot via database trigger       ◄─── NEW        │
│     ├── Create justai_voice_sessions record         ◄─── NEW        │
│     └── Store virtualLessonId in state              ◄─── NEW        │
│                                                                       │
│  2. During Conversation (CHANGES)                                    │
│     ├── User speaks → onMessage callback                             │
│     ├── Save to justai_messages (existing)                           │
│     ├── Create lesson_transcription_segment         ◄─── NEW        │
│     ├── Call vocab-ingest-segment immediately       ◄─── NEW        │
│     ├── Dispatch vocab-realtime-completed event     ◄─── NEW        │
│     └── UI updates (LiveGoalsPanel if rendered)     ◄─── NEW        │
│                                                                       │
│  3. Session End (CHANGES)                                            │
│     ├── Update justai_voice_sessions                                 │
│     ├── Update lesson status to 'completed'         ◄─── MODIFIED   │
│     ├── Call process-voice-session with flag        ◄─── MODIFIED   │
│     └── Finalize metadata (skip vocab processing)   ◄─── MODIFIED   │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### Key Architectural Changes

| Component | Current | Proposed |
|-----------|---------|----------|
| **Lesson Creation** | End of session | Start of session |
| **Lesson Status** | 'completed' immediately | 'in_progress' → 'completed' |
| **Snapshot Creation** | Never (no trigger fires) | Automatic via trigger |
| **Segment Creation** | Batch at end | Real-time per message |
| **Vocab Processing** | Batch at end | Real-time per message |
| **UI Updates** | None during session | Live updates via events |

---

## Implementation Plan

### Phase 1: Database Schema Verification

**Objective:** Ensure all required tables and triggers exist

#### 1.1 Verify `lesson_focus_snapshots` Table

```sql
-- Check if table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'lesson_focus_snapshots'
);

-- If not exists, create it
CREATE TABLE IF NOT EXISTS lesson_focus_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lexeme_id UUID NOT NULL REFERENCES lexemes(id) ON DELETE CASCADE,
  snapshot_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(lesson_id, student_id, lexeme_id)
);

CREATE INDEX IF NOT EXISTS idx_focus_snapshots_lesson 
  ON lesson_focus_snapshots(lesson_id);

CREATE INDEX IF NOT EXISTS idx_focus_snapshots_student 
  ON lesson_focus_snapshots(student_id);
```

#### 1.2 Create/Verify Snapshot Trigger

```sql
CREATE OR REPLACE FUNCTION snapshot_active_goals_on_lesson_start()
RETURNS TRIGGER AS $$
BEGIN
  -- Only snapshot when status changes TO 'in_progress'
  IF NEW.status = 'in_progress' AND 
     (OLD IS NULL OR OLD.status IS NULL OR OLD.status != 'in_progress') THEN
    
    -- Delete existing snapshot if any (idempotency)
    DELETE FROM lesson_focus_snapshots 
    WHERE lesson_id = NEW.id;
    
    -- Insert snapshot of current Focus Set
    INSERT INTO lesson_focus_snapshots (
      lesson_id,
      student_id,
      lexeme_id,
      snapshot_data,
      created_at
    )
    SELECT 
      NEW.id,
      NEW.student_id,
      sg.lexeme_id,
      jsonb_build_object(
        'lemma', l.lemma,
        'pos', l.pos,
        'cefr_level', l.cefr_level,
        'lesson_count', COALESCE(slh.lesson_count, 0),
        'focus_lesson_count', COALESCE(slh.focus_lesson_count, 0),
        'is_stable', COALESCE(slh.is_stable, false)
      ),
      now()
    FROM student_goals sg
    JOIN lexemes l ON sg.lexeme_id = l.id
    LEFT JOIN student_lexeme_history slh 
      ON sg.student_id = slh.student_id 
      AND sg.lexeme_id = slh.lexeme_id
    WHERE sg.student_id = NEW.student_id
      AND sg.is_active_for_lessons = true
      AND sg.archived_at IS NULL
      AND COALESCE(slh.is_stable, false) = false
    ORDER BY sg.created_at ASC
    LIMIT 5;
    
    RAISE NOTICE 'Focus Set snapshot created for lesson % (% words)', 
      NEW.id, (SELECT COUNT(*) FROM lesson_focus_snapshots WHERE lesson_id = NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate trigger to ensure it's up to date
DROP TRIGGER IF EXISTS trg_snapshot_focus_on_lesson_start ON lessons;

CREATE TRIGGER trg_snapshot_focus_on_lesson_start
AFTER INSERT OR UPDATE OF status ON lessons
FOR EACH ROW
EXECUTE FUNCTION snapshot_active_goals_on_lesson_start();
```

#### 1.3 Update `justai_voice_sessions` Table

```sql
-- Ensure virtual_lesson_id is nullable and can be set early
ALTER TABLE justai_voice_sessions 
  ALTER COLUMN virtual_lesson_id DROP NOT NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_voice_sessions_lesson 
  ON justai_voice_sessions(virtual_lesson_id);

-- Add index for conversation lookups
CREATE INDEX IF NOT EXISTS idx_voice_sessions_conversation 
  ON justai_voice_sessions(conversation_id);
```

---

### Phase 2: Frontend Changes

#### 2.1 Add State for Virtual Lesson ID

**File:** `ai-chat-app/src/pages/AIChatVoice.tsx`

```typescript
// Add near other state declarations
const [virtualLessonId, setVirtualLessonId] = useState<string | null>(null);
const [voiceSessionId, setVoiceSessionId] = useState<string | null>(null);
```

#### 2.2 Create Virtual Lesson at Session Start

**File:** `ai-chat-app/src/pages/AIChatVoice.tsx` (in `initConversation` function)

```typescript
// After creating conversation record (around line 420)
const { data: convData, error: convError } = await supabase
  .from('justai_conversations')
  .insert({
    student_id: user.id,
    conversation_type: 'voice_session',
    is_voice_session: true,
    title: `Voice Chat: ${selectedAgentName}`,
    scenario: selectedScenario,
    agent_id: agentDatabaseId || null,
    is_retry_attempt: location.state?.isRetryAttempt || false,
  })
  .select()
  .single();

if (convError) throw convError;
setConversationId(convData.id);

// 🆕 NEW: Create virtual lesson immediately
console.log('📚 Creating virtual lesson for real-time vocab tracking...');

const AI_TEACHER_ID = '00000000-0000-0000-0000-000000000001';

// Helper function to round time to nearest half hour
const roundToHalfHour = (date: Date) => {
  const rounded = new Date(date);
  const minutes = rounded.getMinutes();
  if (minutes < 15) {
    rounded.setMinutes(0, 0, 0);
  } else if (minutes < 45) {
    rounded.setMinutes(30, 0, 0);
  } else {
    rounded.setMinutes(0, 0, 0);
    rounded.setHours(rounded.getHours() + 1);
  }
  return rounded;
};

const lessonStartTime = new Date();
const roundedStartTime = roundToHalfHour(lessonStartTime);
let roundedEndTime = new Date(roundedStartTime.getTime() + 30 * 60 * 1000);

// Ensure end time is after start time
if (roundedEndTime <= roundedStartTime) {
  roundedEndTime = new Date(roundedStartTime.getTime() + 30 * 60 * 1000);
}

const { data: virtualLesson, error: lessonError } = await supabase
  .from('lessons')
  .insert({
    teacher_id: AI_TEACHER_ID,
    student_id: user.id,
    starts_at: roundedStartTime.toISOString(),
    ends_at: roundedEndTime.toISOString(),
    title: `AI Voice Session - ${lessonStartTime.toLocaleDateString()}`,
    status: 'in_progress', // 🔑 This triggers snapshot creation
    is_ai_session: true,
  })
  .select()
  .single();

if (lessonError) {
  console.error('❌ Failed to create virtual lesson:', lessonError);
  throw lessonError;
}

console.log('✅ Virtual lesson created:', virtualLesson.id);
setVirtualLessonId(virtualLesson.id);

// 🆕 Create voice session record linking everything together
const { data: voiceSession, error: voiceSessionError } = await supabase
  .from('justai_voice_sessions')
  .insert({
    conversation_id: convData.id,
    student_id: user.id,
    elevenlabs_conversation_id: null, // Will be set when we get it from ElevenLabs
    virtual_lesson_id: virtualLesson.id,
    total_duration_seconds: 0,
    student_speaking_time_seconds: 0,
    ai_speaking_time_seconds: 0,
    started_at: lessonStartTime.toISOString(),
  })
  .select()
  .single();

if (voiceSessionError) {
  console.error('❌ Failed to create voice session record:', voiceSessionError);
  throw voiceSessionError;
}

console.log('✅ Voice session record created:', voiceSession.id);
setVoiceSessionId(voiceSession.id);

// Wait a moment for snapshot trigger to complete
await new Promise(resolve => setTimeout(resolve, 500));

// Verify snapshot was created
const { data: snapshotCheck } = await supabase
  .from('lesson_focus_snapshots')
  .select('lexeme_id')
  .eq('lesson_id', virtualLesson.id)
  .eq('student_id', user.id);

console.log(`✅ Focus Set snapshot created: ${snapshotCheck?.length || 0} words`);
```

#### 2.3 Real-Time Vocabulary Processing Per Message

**File:** `ai-chat-app/src/pages/AIChatVoice.tsx` (in `onMessage` callback)

```typescript
onMessage: async (message) => {
  console.log('Message received:', message);
  
  if (message.source === 'user' && message.message) {
    const segment: TranscriptSegment = {
      speaker: 'student',
      text: stripVoiceTags(message.message),
      timestamp: Date.now(),
    };
    setTranscript((prev) => [...prev, segment]);
    
    // Save to database
    if (conversationId && user?.id) {
      // [... existing subscription limit checks ...]
      
      // Save user message
      const { data: messageData, error: messageError } = await supabase
        .from('justai_messages')
        .insert({
          conversation_id: conversationId,
          role: 'user',
          content: stripVoiceTags(message.message),
          is_voice_message: true,
        })
        .select()
        .single();
      
      if (messageError) {
        console.error('❌ Error saving message:', messageError);
        return;
      }
      
      // 🆕 NEW: Process vocabulary in real-time if we have a virtual lesson
      if (virtualLessonId && messageData) {
        try {
          console.log('📝 Creating transcription segment for real-time vocab processing...');
          
          // Create transcription segment for this message
          const segmentStartTime = new Date(segment.timestamp);
          const segmentEndTime = new Date(segment.timestamp + 5000); // Estimate 5 seconds
          
          const { data: segmentData, error: segmentError } = await supabase
            .from('lesson_transcription_segments')
            .insert({
              lesson_id: virtualLessonId,
              speaker_id: user.id,
              speaker_role: 'student',
              start_time: segmentStartTime.toISOString(),
              end_time: segmentEndTime.toISOString(),
              transcript: segment.text,
              formatted_text: segment.text,
              final_sentence_transcription: true,
            })
            .select()
            .single();
          
          if (segmentError) {
            console.error('❌ Error creating segment:', segmentError);
            return;
          }
          
          console.log('✅ Segment created:', segmentData.id);
          
          // Process vocabulary immediately (non-blocking fire-and-forget)
          processVocabularySegment(virtualLessonId, segmentData.id, user.id)
            .catch(error => {
              console.error('❌ Background vocab processing error:', error);
              // Don't block the conversation on vocab errors
            });
          
        } catch (error) {
          console.error('❌ Error in real-time vocabulary setup:', error);
          // Don't block the conversation on vocab processing errors
        }
      }
    }
  } else if (message.source === 'ai' && message.message) {
    // [... existing AI message handling ...]
  }
},
```

#### 2.4 Add Helper Function for Async Vocab Processing

**File:** `ai-chat-app/src/pages/AIChatVoice.tsx` (outside component)

```typescript
// Helper function for async vocabulary processing (fire-and-forget)
async function processVocabularySegment(
  lessonId: string,
  segmentId: string,
  studentId: string
): Promise<void> {
  try {
    console.log(`🔍 Processing vocabulary for segment ${segmentId}...`);
    
    const session = await supabase.auth.getSession();
    if (!session.data.session?.access_token) {
      console.error('❌ No auth token for vocab processing');
      return;
    }
    
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vocab-ingest-segment`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.data.session.access_token}`,
        },
        body: JSON.stringify({
          lessonId,
          segmentId,
          studentId,
        }),
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Vocab processing API error (${response.status}):`, errorText);
      return;
    }
    
    const result = await response.json();
    console.log(`✅ Vocabulary processed:`, {
      segment: segmentId,
      words: result.wordsInserted,
      tokens: result.tokensProcessed,
      evidence: result.evidenceInserted,
    });
    
    // Dispatch event for UI updates (LiveGoalsPanel can listen)
    window.dispatchEvent(new CustomEvent('vocab-realtime-completed', {
      detail: { 
        lessonId, 
        segmentId, 
        studentId, 
        result 
      }
    }));
    
  } catch (error) {
    console.error('❌ Exception in vocabulary processing:', error);
    // Don't throw - this is fire-and-forget
  }
}
```

#### 2.5 Update Session End Flow

**File:** `ai-chat-app/src/pages/AIChatVoice.tsx` (in `saveSession` function)

```typescript
const saveSession = async () => {
  if (!conversationId || !elevenLabsConvId || !user?.id || !sessionStartTime.current) {
    console.warn('⚠️ Cannot save session - missing required data');
    return;
  }

  if (sessionSaved.current) {
    console.log('ℹ️ Session already saved, skipping');
    return;
  }

  try {
    sessionSaved.current = true;
    const sessionEndTime = new Date();
    
    console.log('💾 Saving session...');
    
    // Update voice session with ElevenLabs conversation ID and end time
    if (voiceSessionId) {
      await supabase
        .from('justai_voice_sessions')
        .update({
          elevenlabs_conversation_id: elevenLabsConvId,
          ended_at: sessionEndTime.toISOString(),
          total_duration_seconds: sessionDuration,
        })
        .eq('id', voiceSessionId);
    }
    
    // Update virtual lesson status to completed
    if (virtualLessonId) {
      await supabase
        .from('lessons')
        .update({
          status: 'completed',
          ends_at: sessionEndTime.toISOString(),
        })
        .eq('id', virtualLessonId);
      
      console.log('✅ Virtual lesson marked as completed');
    }
    
    // 🆕 MODIFIED: Call process-voice-session but skip duplicate vocab processing
    console.log('📞 Calling process-voice-session for metadata finalization...');
    
    fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-voice-session`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          voiceSessionId: voiceSessionId,
          skipVocabProcessing: true, // 🔑 Skip vocab - already done in real-time
          skipSegmentCreation: true,  // 🔑 Skip segments - already created
        }),
      }
    ).then(async (response) => {
      if (!response.ok) {
        const error = await response.text();
        console.error('❌ process-voice-session error:', error);
        return;
      }
      
      const result = await response.json();
      console.log('✅ Session finalized:', result);
      
    }).catch((error) => {
      console.error('❌ Failed to finalize session:', error);
    });
    
    console.log('✅ Session saved successfully');
    
  } catch (error) {
    console.error('❌ Error saving session:', error);
    sessionSaved.current = false; // Reset on error so we can retry
  }
};
```

---

### Phase 3: Backend Changes

#### 3.1 Update vocab-ingest-segment Edge Function

**File:** `supabase/functions/vocab-ingest-segment/index.ts`

**Verification:** Ensure the function uses `lesson_focus_snapshots` for `was_in_focus` determination.

```typescript
// Around line 400-450 in processEnhancedVocabulary function

// Fetch Focus Set snapshot for this lesson
const { data: focusSnapshot } = await supabase
  .from('lesson_focus_snapshots')
  .select('lexeme_id')
  .eq('lesson_id', lessonId)
  .eq('student_id', studentId);

const focusLexemeIds = new Set(
  focusSnapshot?.map(s => s.lexeme_id) || []
);

if (vocabDebug) {
  console.log(`[vocab-ingest-segment:${requestId}] Focus Set snapshot:`, {
    lessonId,
    focusWordsCount: focusLexemeIds.size,
    focusWords: Array.from(focusLexemeIds),
  });
}

// When inserting vocab_evidence, check snapshot
for (const word of words) {
  if (word.tag === '.' || !word.lexeme_id) continue;
  
  const wasInFocus = focusLexemeIds.has(word.lexeme_id);
  
  if (vocabDebug && wasInFocus) {
    console.log(`[vocab-ingest-segment:${requestId}] Focus word detected:`, {
      word: word.word,
      lexeme_id: word.lexeme_id,
      wasInFocus: true,
    });
  }
  
  // Insert evidence with was_in_focus flag
  const { error: evidenceError } = await supabase
    .from('vocab_evidence')
    .insert({
      lesson_id: lessonId,
      segment_id: segmentId,
      student_id: studentId,
      tag: word.tag,
      lexeme_id: word.lexeme_id,
      start_char: wordStart >= 0 ? wordStart : null,
      end_char: wordStart >= 0 ? wordStart + word.word.length : null,
      text_snippet: textSnippet,
      was_in_focus: wasInFocus, // 🔑 Critical for points calculation
    });
  
  // ... error handling
}
```

#### 3.2 Update process-voice-session Edge Function

**File:** `edge-functions/process-voice-session.ts`

Add support for skipping already-completed processing:

```typescript
// At the beginning of the request handler (around line 60)
const { 
  voiceSessionId, 
  skipVocabProcessing = false,
  skipSegmentCreation = false 
} = await req.json();

if (!voiceSessionId) {
  return new Response(
    JSON.stringify({ error: 'voiceSessionId is required' }),
    {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

// Get voice session data
const { data: voiceSession, error: sessionError } = await supabase
  .from('justai_voice_sessions')
  .select('*, justai_conversations(*)')
  .eq('id', voiceSessionId)
  .single();

if (sessionError || !voiceSession) {
  throw new Error(`Voice session not found: ${sessionError?.message}`);
}

// 🆕 NEW: If vocab was processed in real-time, skip duplicate processing
if (skipVocabProcessing && skipSegmentCreation) {
  console.log('⏩ Skipping segment/vocab processing (already done in real-time)');
  console.log('📊 Fetching metadata from ElevenLabs for finalization...');
  
  // Still need to fetch ElevenLabs metadata for costs/duration
  if (!voiceSession.elevenlabs_conversation_id) {
    throw new Error('No ElevenLabs conversation ID found');
  }
  
  // Wait for ElevenLabs to process
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  const elevenLabsResponse = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversations/${voiceSession.elevenlabs_conversation_id}`,
    {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
      },
    }
  );
  
  if (!elevenLabsResponse.ok) {
    const errorText = await elevenLabsResponse.text();
    throw new Error(`ElevenLabs API error: ${elevenLabsResponse.status} - ${errorText}`);
  }
  
  const elevenLabsData = await elevenLabsResponse.json();
  const metadata = elevenLabsData.metadata || {};
  const charging = metadata.charging || {};
  
  // Calculate costs
  const totalCost = metadata.cost || 0;
  const callCharge = charging.call_charge || 0;
  const llmCharge = charging.llm_charge || 0;
  const callDurationSecs = metadata.call_duration_secs || 0;
  const costPerThousandCredits = 30; // cents
  const totalCostCents = Math.ceil((totalCost / 1000) * costPerThousandCredits);
  
  // Count characters from transcript
  const transcript = elevenLabsData.transcript || [];
  let totalCharacters = 0;
  for (const entry of transcript) {
    if (entry.role === 'agent') {
      totalCharacters += stripVoiceTags(entry.message || '').length;
    }
  }
  
  // Calculate speaking times
  let userSpeakingTimeSecs = 0;
  let agentSpeakingTimeSecs = 0;
  for (let i = 0; i < transcript.length; i++) {
    const entry = transcript[i];
    const nextEntry = transcript[i + 1];
    const startTime = entry.time_in_call_secs || 0;
    const endTime = nextEntry ? nextEntry.time_in_call_secs : callDurationSecs;
    const duration = Math.max(0, endTime - startTime);
    
    if (entry.role === 'user') {
      userSpeakingTimeSecs += duration;
    } else if (entry.role === 'agent') {
      agentSpeakingTimeSecs += duration;
    }
  }
  
  // Update voice session with final metadata
  await supabase
    .from('justai_voice_sessions')
    .update({
      elevenlabs_character_count: totalCharacters,
      elevenlabs_cost_cents: totalCostCents,
      elevenlabs_credits_used: totalCost,
      elevenlabs_tts_credits: callCharge,
      elevenlabs_llm_credits: llmCharge,
      student_speaking_time_seconds: userSpeakingTimeSecs,
      ai_speaking_time_seconds: agentSpeakingTimeSecs,
      total_duration_seconds: callDurationSecs,
      transcription_complete: true,
      vocabulary_processed: true, // Already processed in real-time
      updated_at: new Date().toISOString(),
    })
    .eq('id', voiceSessionId);
  
  console.log('✅ Session finalized with metadata (vocab already processed)');
  
  return new Response(
    JSON.stringify({
      success: true,
      message: 'Session finalized (vocab already processed in real-time)',
      voiceSessionId,
      costs: {
        total: totalCost,
        tts: callCharge,
        llm: llmCharge,
        totalCents: totalCostCents,
      },
      duration: {
        total: callDurationSecs,
        userSpeaking: userSpeakingTimeSecs,
        agentSpeaking: agentSpeakingTimeSecs,
      },
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

// 🔄 EXISTING: Fall through to normal processing if flags not set
console.log('📝 Processing session with full transcript extraction...');
// [... rest of existing logic for backward compatibility ...]
```

---

### Phase 4: UI Components (Optional Enhancement)

#### 4.1 Display LiveGoalsPanel in Voice Chat

**File:** `ai-chat-app/src/pages/AIChatVoice.tsx`

Add an optional sidebar or overlay to show Focus Set progress during conversation:

```typescript
// Add state for showing goals panel
const [showGoalsPanel, setShowGoalsPanel] = useState(false);

// In the render section, add a toggle button
<Button
  variant="ghost"
  size="sm"
  onClick={() => setShowGoalsPanel(!showGoalsPanel)}
  className="fixed top-4 right-4 z-50"
>
  <Sparkles className="w-5 h-5" />
  {showGoalsPanel ? 'Hide' : 'Show'} Goals
</Button>

{/* Goals panel overlay */}
{showGoalsPanel && virtualLessonId && (
  <div className="fixed right-0 top-0 h-screen w-80 bg-white dark:bg-gray-900 shadow-lg z-40 overflow-y-auto p-4">
    <LiveGoalsPanel
      lessonId={virtualLessonId}
      studentId={user.id}
      lessonStatus="in_progress"
    />
  </div>
)}
```

**File:** Create/verify `ai-chat-app/src/components/lessons/LiveGoalsPanel.tsx`

This component should already exist based on FOCUS_SET_VOCABULARY_TRACKING.md. Ensure it:
- Uses `useFocusSet` hook with lesson context
- Listens for `vocab-realtime-completed` events
- Refetches data on event
- Shows "Frozen" badge for snapshot mode

---

## Database Changes

### Migration Script

Create a new migration file: `supabase/migrations/20260129000000_enable_realtime_vocab_tracking.sql`

```sql
-- Enable real-time vocabulary tracking for AI voice sessions
-- Created: January 29, 2026

-- 1. Ensure lesson_focus_snapshots table exists
CREATE TABLE IF NOT EXISTS lesson_focus_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lexeme_id UUID NOT NULL REFERENCES lexemes(id) ON DELETE CASCADE,
  snapshot_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(lesson_id, student_id, lexeme_id)
);

-- 2. Create indexes
CREATE INDEX IF NOT EXISTS idx_focus_snapshots_lesson 
  ON lesson_focus_snapshots(lesson_id);
CREATE INDEX IF NOT EXISTS idx_focus_snapshots_student 
  ON lesson_focus_snapshots(student_id);

-- 3. Create snapshot trigger function
CREATE OR REPLACE FUNCTION snapshot_active_goals_on_lesson_start()
RETURNS TRIGGER AS $$
BEGIN
  -- Only snapshot when status changes TO 'in_progress'
  IF NEW.status = 'in_progress' AND 
     (OLD IS NULL OR OLD.status IS NULL OR OLD.status != 'in_progress') THEN
    
    -- Delete existing snapshot if any (idempotency)
    DELETE FROM lesson_focus_snapshots 
    WHERE lesson_id = NEW.id;
    
    -- Insert snapshot of current Focus Set
    INSERT INTO lesson_focus_snapshots (
      lesson_id,
      student_id,
      lexeme_id,
      snapshot_data,
      created_at
    )
    SELECT 
      NEW.id,
      NEW.student_id,
      sg.lexeme_id,
      jsonb_build_object(
        'lemma', l.lemma,
        'pos', l.pos,
        'cefr_level', l.cefr_level,
        'lesson_count', COALESCE(slh.lesson_count, 0),
        'focus_lesson_count', COALESCE(slh.focus_lesson_count, 0),
        'is_stable', COALESCE(slh.is_stable, false)
      ),
      now()
    FROM student_goals sg
    JOIN lexemes l ON sg.lexeme_id = l.id
    LEFT JOIN student_lexeme_history slh 
      ON sg.student_id = slh.student_id 
      AND sg.lexeme_id = slh.lexeme_id
    WHERE sg.student_id = NEW.student_id
      AND sg.is_active_for_lessons = true
      AND sg.archived_at IS NULL
      AND COALESCE(slh.is_stable, false) = false
    ORDER BY sg.created_at ASC
    LIMIT 5;
    
    RAISE NOTICE 'Focus Set snapshot created for lesson % (% words)', 
      NEW.id, (SELECT COUNT(*) FROM lesson_focus_snapshots WHERE lesson_id = NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Attach trigger to lessons table
DROP TRIGGER IF EXISTS trg_snapshot_focus_on_lesson_start ON lessons;

CREATE TRIGGER trg_snapshot_focus_on_lesson_start
AFTER INSERT OR UPDATE OF status ON lessons
FOR EACH ROW
EXECUTE FUNCTION snapshot_active_goals_on_lesson_start();

-- 5. Update justai_voice_sessions table
ALTER TABLE justai_voice_sessions 
  ALTER COLUMN virtual_lesson_id DROP NOT NULL;

-- 6. Add helpful indexes
CREATE INDEX IF NOT EXISTS idx_voice_sessions_lesson 
  ON justai_voice_sessions(virtual_lesson_id);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_conversation 
  ON justai_voice_sessions(conversation_id);

-- 7. Add comment
COMMENT ON TABLE lesson_focus_snapshots IS 
  'Frozen snapshot of student Focus Set at lesson start. Used to determine was_in_focus flag for vocabulary tracking.';

COMMENT ON FUNCTION snapshot_active_goals_on_lesson_start() IS 
  'Automatically creates Focus Set snapshot when lesson status changes to in_progress. Max 5 words.';
```

---

## Testing Strategy

### Test Cases

#### Test 1: Session Initialization

**Objective:** Verify virtual lesson and snapshot are created at session start

**Steps:**
1. Start AI voice chat session
2. Check database for:
   - `justai_conversations` record
   - `lessons` record with `status='in_progress'` and `is_ai_session=true`
   - `justai_voice_sessions` record with `virtual_lesson_id` set
   - `lesson_focus_snapshots` records (max 5)

**Expected Result:**
- All records created
- Snapshot contains student's current Focus Set
- Snapshot count ≤ 5 words
- Console shows "Focus Set snapshot created: X words"

#### Test 2: Real-Time Vocabulary Processing

**Objective:** Verify vocabulary is processed as user speaks

**Steps:**
1. Start session (verify snapshot created)
2. Speak a sentence containing Focus Set words
3. Monitor console logs
4. Check database for:
   - `lesson_transcription_segments` record
   - `vocab_evidence` records with correct `was_in_focus` flag
   - `student_lexeme_history` updated

**Expected Result:**
- Segment created immediately
- `vocab-ingest-segment` called within 1 second
- Console shows "Vocabulary processed: X words"
- `was_in_focus` flag matches snapshot
- Event `vocab-realtime-completed` dispatched

#### Test 3: UI Updates (If LiveGoalsPanel Shown)

**Objective:** Verify UI updates in real-time

**Steps:**
1. Start session
2. Open LiveGoalsPanel (if available)
3. Speak Focus Set words
4. Observe UI

**Expected Result:**
- Activation dots increment
- Points counter updates
- "Frozen" badge shown
- Updates appear within 2-3 seconds

#### Test 4: Session Finalization

**Objective:** Verify session ends correctly without duplicate processing

**Steps:**
1. Complete a conversation
2. End session
3. Check console logs
4. Verify `process-voice-session` called with `skipVocabProcessing: true`
5. Check database for:
   - Lesson status = 'completed'
   - Voice session metadata updated
   - No duplicate vocab_evidence records

**Expected Result:**
- Session finalizes successfully
- Metadata (costs, duration) saved
- No duplicate vocabulary processing
- Console shows "Session finalized (vocab already processed)"

#### Test 5: Snapshot Consistency

**Objective:** Verify snapshot doesn't change mid-session

**Steps:**
1. Add word to Focus Set
2. Start session (snapshot created)
3. During session: Remove word from Focus Set
4. Continue speaking
5. Check `was_in_focus` flag for removed word

**Expected Result:**
- Removed word still earns credit (in snapshot)
- `was_in_focus = true` for removed word during this session
- Next session will use new Focus Set

#### Test 6: Error Handling

**Objective:** Verify session continues if vocab processing fails

**Steps:**
1. Start session
2. Simulate vocab API failure (temporarily break endpoint)
3. Continue conversation
4. End session

**Expected Result:**
- Conversation continues normally
- Console shows errors but doesn't crash
- Messages still saved
- Session can be finalized

#### Test 7: Backward Compatibility

**Objective:** Verify old sessions still work

**Steps:**
1. Trigger `process-voice-session` without skip flags
2. Verify full transcript processing happens
3. Check segments and vocab created

**Expected Result:**
- Old flow still works
- Falls back to batch processing
- All vocabulary tracked correctly

---

## Rollout Plan

### Phase 1: Database Migration (Week 1)

- [ ] Create and test migration script
- [ ] Deploy to staging environment
- [ ] Verify trigger fires correctly
- [ ] Test snapshot creation manually
- [ ] Deploy to production during low-traffic window

### Phase 2: Backend Updates (Week 1-2)

- [ ] Update `vocab-ingest-segment` (verify snapshot usage)
- [ ] Update `process-voice-session` (add skip flags)
- [ ] Test edge functions in staging
- [ ] Deploy to production

### Phase 3: Frontend Updates (Week 2)

- [ ] Update AIChatVoice.tsx session initialization
- [ ] Add real-time vocab processing per message
- [ ] Update session end flow
- [ ] Test thoroughly in development
- [ ] Deploy behind feature flag

### Phase 4: Optional UI Enhancement (Week 3)

- [ ] Create/update LiveGoalsPanel component
- [ ] Add toggle to show/hide during voice chat
- [ ] Test real-time updates
- [ ] Deploy as optional feature

### Phase 5: Monitoring & Optimization (Week 3-4)

- [ ] Monitor error rates
- [ ] Check API latency
- [ ] Verify snapshot creation success rate
- [ ] Optimize if needed
- [ ] Gather user feedback

---

## Benefits & Trade-offs

### Benefits ✅

1. **Focus Set Tracking Works:** Students can now track vocabulary goals during AI chats
2. **Real-Time Progress:** See word activation and points immediately
3. **Accurate Attribution:** `was_in_focus` flag uses frozen snapshot
4. **Better UX:** No waiting for post-processing to see progress
5. **Resilient:** If real-time fails, fallback to batch processing
6. **Consistent:** Same vocab tracking system for regular lessons and AI chats

### Trade-offs ⚠️

1. **Increased API Calls:** One `vocab-ingest-segment` call per user message
   - **Mitigation:** Fire-and-forget async, doesn't block conversation
   
2. **Early Lesson Creation:** Lesson exists even if session disconnects early
   - **Mitigation:** Mark with `is_ai_session=true`, filter from regular lesson queries
   
3. **Snapshot May Be Empty:** If student has no Focus Set
   - **Mitigation:** Still tracks global usage (lesson_count), just no focus points
   
4. **Complexity:** More moving parts during session initialization
   - **Mitigation:** Comprehensive error handling, fallback to batch processing

---

## Monitoring & Metrics

### Key Metrics to Track

1. **Snapshot Creation Success Rate**
   ```sql
   SELECT 
     COUNT(DISTINCT l.id) as total_ai_lessons,
     COUNT(DISTINCT lfs.lesson_id) as lessons_with_snapshot,
     ROUND(100.0 * COUNT(DISTINCT lfs.lesson_id) / NULLIF(COUNT(DISTINCT l.id), 0), 2) as success_rate
   FROM lessons l
   LEFT JOIN lesson_focus_snapshots lfs ON l.id = lfs.lesson_id
   WHERE l.is_ai_session = true
     AND l.created_at > now() - interval '7 days';
   ```

2. **Real-Time Processing Latency**
   - Monitor `vocab-ingest-segment` response times
   - Alert if p95 > 3 seconds

3. **Error Rates**
   ```sql
   SELECT 
     DATE(created_at) as date,
     COUNT(*) as total_segments,
     COUNT(*) FILTER (WHERE EXISTS (
       SELECT 1 FROM vocab_evidence ve 
       WHERE ve.segment_id = lts.id
     )) as processed_segments
   FROM lesson_transcription_segments lts
   JOIN lessons l ON lts.lesson_id = l.id
   WHERE l.is_ai_session = true
     AND lts.created_at > now() - interval '7 days'
   GROUP BY DATE(created_at)
   ORDER BY date DESC;
   ```

4. **Focus Point Attribution**
   ```sql
   SELECT 
     COUNT(*) as total_evidence,
     COUNT(*) FILTER (WHERE was_in_focus) as focus_evidence,
     ROUND(100.0 * COUNT(*) FILTER (WHERE was_in_focus) / COUNT(*), 2) as focus_rate
   FROM vocab_evidence ve
   JOIN lessons l ON ve.lesson_id = l.id
   WHERE l.is_ai_session = true
     AND ve.created_at > now() - interval '7 days';
   ```

---

## Troubleshooting Guide

### Issue: Snapshot Not Created

**Symptoms:**
- `lesson_focus_snapshots` table empty for new lessons
- Console doesn't show "Focus Set snapshot created"

**Diagnosis:**
```sql
-- Check if trigger exists
SELECT * FROM pg_trigger WHERE tgname = 'trg_snapshot_focus_on_lesson_start';

-- Check if function exists
SELECT proname FROM pg_proc WHERE proname = 'snapshot_active_goals_on_lesson_start';

-- Manually test function
SELECT snapshot_active_goals_on_lesson_start() FROM lessons WHERE id = 'lesson-uuid';
```

**Solution:**
- Re-run migration script
- Verify trigger is attached to `lessons` table
- Check PostgreSQL logs for errors

### Issue: Vocabulary Not Processing

**Symptoms:**
- No `vocab_evidence` records created
- Console shows API errors

**Diagnosis:**
```sql
-- Check if segments are being created
SELECT * FROM lesson_transcription_segments 
WHERE lesson_id = 'lesson-uuid' 
ORDER BY created_at DESC;

-- Check vocab processing log
SELECT * FROM vocab_processing_log 
WHERE lesson_id = 'lesson-uuid';
```

**Solution:**
- Verify `vocab-ingest-segment` endpoint is working
- Check auth token is valid
- Verify SpaCy API is accessible
- Check for rate limiting

### Issue: Duplicate Processing

**Symptoms:**
- Vocabulary processed twice
- Double points earned

**Diagnosis:**
```sql
-- Check for duplicate evidence
SELECT 
  lesson_id,
  student_id,
  lexeme_id,
  COUNT(*) as count
FROM vocab_evidence
WHERE lesson_id = 'lesson-uuid'
GROUP BY lesson_id, student_id, lexeme_id
HAVING COUNT(*) > 1;
```

**Solution:**
- Verify `skipVocabProcessing: true` flag is set in `saveSession()`
- Check `process-voice-session` logs
- Ensure idempotency keys working correctly

---

## Appendix

### Related Documentation

- [FOCUS_SET_VOCABULARY_TRACKING.md](FOCUS_SET_VOCABULARY_TRACKING.md) - Focus Set system overview
- [VOICE_SESSION_PROCESSING.md](VOICE_SESSION_PROCESSING.md) - Voice session processing flow
- [VOCABULARY_BUILDER_SYSTEM.md](VOCABULARY_BUILDER_SYSTEM.md) - Vocabulary builder architecture
- [VOCABULARY_PROGRESS_PROCESSING.md](VOCABULARY_PROGRESS_PROCESSING.md) - Vocabulary processing guide

### Database Schema Reference

```sql
-- Key tables for real-time vocab tracking
lesson_focus_snapshots (
  lesson_id -> lessons.id,
  student_id -> profiles.id,
  lexeme_id -> lexemes.id,
  snapshot_data JSONB
)

vocab_evidence (
  lesson_id -> lessons.id,
  segment_id -> lesson_transcription_segments.id,
  student_id -> profiles.id,
  lexeme_id -> lexemes.id,
  was_in_focus BOOLEAN
)

student_lexeme_history (
  student_id -> profiles.id,
  lexeme_id -> lexemes.id,
  lesson_count INTEGER,
  focus_lesson_count INTEGER
)
```

### API Endpoints Reference

```
POST /functions/v1/vocab-ingest-segment
Body: { lessonId, segmentId, studentId }
Returns: { ok, wordsInserted, tokensProcessed, evidenceInserted }

POST /functions/v1/process-voice-session
Body: { voiceSessionId, skipVocabProcessing?, skipSegmentCreation? }
Returns: { success, message, voiceSessionId, costs, duration }

RPC get_focus_set_for_lesson(student_uuid, lesson_uuid, lesson_status)
Returns: Array<FocusSetWord>
```

---

**End of Document**

---

**Change Log:**
- 2026-01-29: Initial document created
- Document status: Implementation Plan (not yet deployed)
