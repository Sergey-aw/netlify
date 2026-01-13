# Voice Session Post-Processing

## Overview
After a voice chat session ends, the system triggers background processing to extract insights and track usage.

## Processing Flow

### 1. Session End (Client)
**File:** `ai-chat-app/src/pages/AIChatVoice.tsx`

When user clicks "End Session":
- Closes ElevenLabs WebSocket connection
- Creates `justai_voice_sessions` record with:
  - `conversation_id` - links to conversation
  - `elevenlabs_conversation_id` - ElevenLabs conversation UUID
  - `total_duration_seconds` - calculated from start/end times
  - `started_at`, `ended_at` - timestamps
- Updates `justai_conversations` with final duration
- Triggers background processing (non-blocking)
- Navigates back to home

### 2. Background Processing (Edge Function)
**File:** `edge-functions/process-voice-session.ts`

Fetches ElevenLabs conversation transcript and processes:

**Note:** Memory extraction (conversation_summary, emotional_notes, open_threads, unlock_next_scenario) is **NOT** done by ElevenLabs. This is handled separately by the `analyze-conversation-feedback` function using OpenAI when the user requests feedback from the UI.

#### A. Transcript Extraction
- Calls ElevenLabs API: `GET /v1/convai/conversations/{id}`
- Extracts messages from `transcript` array
- Saves to `justai_messages`:
  - `role`: 'user' or 'assistant'
  - `content`: message text
  - `is_voice_message`: true
  - `created_at`: from ElevenLabs timestamp

#### B. Usage Tracking
- Extracts exact credit usage from ElevenLabs metadata:
  - `metadata.cost`: Total cost in credits (1943 in example)
  - `metadata.charging.call_charge`: TTS/audio processing credits (1926)
  - `metadata.charging.llm_charge`: LLM inference credits (17)
  - `metadata.charging.llm_price`: LLM price in dollars (0.00169305)
- Extracts timing data from metadata:
  - `metadata.call_duration_secs`: total session duration (173 seconds)
- Calculates speaking times from transcript:
  - Uses `time_in_call_secs` field from each transcript entry
  - Calculates duration by subtracting consecutive timestamps
  - Sums durations by role (user vs agent)
  - Stores in `student_speaking_time_seconds` and `ai_speaking_time_seconds`
- Calculates estimated cost: `(total_credits / 1000) * $0.30` (approximate)
- Updates `justai_voice_sessions`:
  - `elevenlabs_credits_used`: total credits (metadata.cost)
  - `elevenlabs_tts_credits`: TTS credits (charging.call_charge)

#### C. Lesson & Segment Creation
- Creates an AI lesson record in `lessons` table:
  - `is_ai_session`: true (marks as AI-generated)
  - `starts_at`, `ends_at`: rounded to 30-minute slots (constraint requirement)
  - `status`: 'completed'
  - **⚠️ FUTURE TODO:** Remove 30-minute slot constraint for AI lessons to allow precise timing
- Creates `lesson_transcription_segments` for each message:
  - Links to lesson via `lesson_id`
  - Maps roles: 'user' → 'student', 'agent' → 'teacher'
  - Preserves exact timestamps from voice session
  - Sets `final_sentence_transcription`: true
- Links lesson to voice session via `virtual_lesson_id`

#### D. Real-Time Vocabulary Processing
**Immediately after segments are inserted:**
- Filters student segments (`speaker_role = 'student'`)
- Triggers `vocab-ingest-segment` edge function for each student segment in parallel
- **Non-blocking operation** - runs in background while session finalization continues
- Each segment is processed:
  1. Segment text fetched from database
  2. External NLP service (spaCy) called to extract lemmas
  3. Lexeme IDs looked up from `lexemes` table
  4. Records inserted into `vocab_evidence` table
  5. Database trigger automatically updates `student_lexeme_history`
- Processing happens asynchronously - doesn't delay session completion

#### E. Vocabulary Finalization
- After all vocabulary processing completes, calls `vocab-process-final-segment`:
  - Aggregates all vocabulary evidence for the lesson
  - Calculates final statistics
  - Marks lesson as vocabulary processed
- This is a finalization-only step (individual segments already processed)
  - `elevenlabs_llm_credits`: LLM credits (charging.llm_charge)
  - `elevenlabs_character_count`: character count (for reference)
  - `elevenlabs_cost_cents`: estimated cost
  - `student_speaking_time_seconds`: calculated from transcript timestamps
  - `ai_speaking_time_seconds`: calculated from transcript timestamps
  - `total_duration_seconds`: actual duration from ElevenLabs metadata

#### F. Processing Flags
- Sets `transcription_complete: true`
- `vocabulary_processed` is set by `vocab-process-final-segment` after aggregation completes
- `grammar_processed` remains false (for future enhancement)

### 3. Future Enhancements (TODO)

#### Vocabulary Processing ✅ IMPLEMENTED
**Current Implementation:**
- Real-time processing during session end via `vocab-ingest-segment`
- Parallel processing of all student segments
- Automatic NLP analysis and lemma extraction
- Database trigger maintains `student_lexeme_history`
- Finalization via `vocab-process-final-segment`

**Architecture:**
```
Session Ends → process-voice-session
  ↓
  Create lesson + segments
  ↓
  [Real-Time Processing - Non-blocking]
  ├─ vocab-ingest-segment (segment 1) ────→ vocab_evidence
  ├─ vocab-ingest-segment (segment 2) ────→ vocab_evidence  
  └─ vocab-ingest-segment (segment N) ────→ vocab_evidence
                                              ↓
                                      [DB Trigger Auto-Updates]
                                      student_lexeme_history
  ↓
  Calculate costs & update session
  ↓
  vocab-process-final-segment (finalize)
```

#### Grammar Processing  
Similar to regular lessons, detect grammar patterns:
- Analyze sentence structures in user messages
- Detect grammar patterns (tenses, conditionals, etc.)
- Create `grammar_evidence` entries
- Update student grammar history
- Track progress on specific structures

#### Virtual Lesson Creation
For integration with existing lesson system:
- Create "virtual" lesson record in `lessons` table with `is_ai_session: true`
- Link via `justai_voice_sessions.virtual_lesson_id`
- Enables vocab/grammar evidence to reference `lesson_id`
- Allows voice sessions to appear in student progress dashboard

#### Summary Generation
Generate AI-powered session summary:
- Use GPT to analyze conversation
- Extract key topics discussed
- Identify mistakes and corrections
- Suggest focus areas
- Save to new `justai_session_summaries` table

## Database Schema

### Existing Tables Used

**justai_conversations**
- Main conversation record
- `voice_session_duration`: total seconds

**justai_messages**  
- Individual transcript entries
- `is_voice_message`: distinguishes voice from text chat

**justai_voice_sessions**
- Voice-specific metadata
- Cost tracking
- Processing flags
- Speaking time statistics
- Links to AI lesson via `virtual_lesson_id`

**lessons**
- AI session records with `is_ai_session: true`
- **⚠️ Current Limitation:** Times must be rounded to 30-minute slots (00 or 30 minutes)
  - Constraint: `lessons_start_at_minute_00_30`
  - Constraint: `lessons_duration_valid` (ends_at > starts_at)
  - **FUTURE TODO:** Remove these constraints for AI lessons to allow precise timing
- Status set to 'completed' after processing

**lesson_transcription_segments**
- Transcript entries linked to lesson
- Preserves exact timestamps from voice session
- Maps speaker roles (user → student, agent → teacher)
- Can be processed for vocabulary and grammar analysis

**justai_usage_log**
- Per-message usage tracking
- Links to subscription for billing
- Tracks billing period

**justai_subscriptions**
- Message limits and usage
- `messages_used_this_period` incremented per user message
- Checked before session start and during session

### Future Tables (Recommendations)

**vocab_evidence** (existing, to be populated)
```sql
-- Links vocabulary usage to lesson segments
-- Fields: lesson_id, segment_id, student_id, lexeme_id, text_snippet, start_char, end_char
-- TODO: Implement vocab extraction from lesson_transcription_segments
```

**justai_session_summaries**
```sql
CREATE TABLE justai_session_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voice_session_id UUID REFERENCES justai_voice_sessions(id),
  summary TEXT NOT NULL,
  key_topics TEXT[],
  mistakes_identified JSONB,
  suggestions TEXT[],
  overall_performance_score INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## Deployment

### Edge Function Deployment
```bash
# Deploy the processing function
npx supabase functions deploy process-voice-session

# Set required secrets
npx supabase secrets set ELEVENLABS_API_KEY=your_key_here
```

### Testing
```bash
# Test locally
npx supabase functions serve process-voice-session

# Call it
curl -X POST http://localhost:54321/functions/v1/process-voice-session \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"voiceSessionId": "uuid-here"}'
```

## Monitoring

Check processing status:
```sql
-- View sessions pending processing
SELECT 
  vs.id,
  vs.elevenlabs_conversation_id,
  vs.total_duration_seconds,
  vs.transcription_complete,
  vs.vocabulary_processed,
  vs.grammar_processed,
  c.title,
  COUNT(m.id) as message_count
FROM justai_voice_sessions vs
JOIN justai_conversations c ON c.id = vs.conversation_id
LEFT JOIN justai_messages m ON m.conversation_id = vs.conversation_id
WHERE vs.transcription_complete = false
GROUP BY vs.id, c.id
ORDER BY vs.created_at DESC;
```

## Cost Tracking

ElevenLabs provides exact credit usage in the conversation metadata:

**From the API response structure:**
```json
{
  "metadata": {
    "cost": 1943,  // Total credits
    "call_duration_secs": 173,
    "charging": {
      "call_charge": 1926,  // TTS credits
      "llm_charge": 17,     // LLM credits
      "llm_price": 0.00169305,  // LLM cost in dollars
      "tier": "free"
    }
  }
}
```

**From the screenshot example:**
- Credits (call): 1926 TTS credits
- Credits (LLM): 17 LLM credits  
- Total: 1943 credits
- Connection duration: 2:53 (173 seconds)
- LLM Cost: $0.00059/min (Total: $0.00169)

**Database storage:**
Credits are tracked in `justai_voice_sessions`:
- `elevenlabs_credits_used`: total credits (metadata.cost)
- `elevenlabs_tts_credits`: TTS credits (charging.call_charge)
- `elevenlabs_llm_credits`: LLM credits (charging.llm_charge)
- `elevenlabs_cost_cents`: estimated cost based on credits

**Pricing:**
- Pricing varies by plan ("free", "starter", "pro", etc.)
- Credits roughly correlate with TTS characters
- LLM cost provided separately in `charging.llm_price`

Cost estimation formula (adjust based on actual pricing):
```javascript
cost_cents = (total_credits / 1000) * 30  // $0.30 per 1K credits estimate
```

Usage analytics query:
```sql
-- Monthly costs and usage per student
SELECT 
  p.email,
  DATE_TRUNC('month', vs.created_at) as month,
  COUNT(vs.id) as session_count,
  SUM(vs.total_duration_seconds) as total_seconds,
  ROUND(SUM(vs.total_duration_seconds)::DECIMAL / 60, 2) as total_minutes,
  SUM(vs.elevenlabs_credits_used) as total_credits,
  SUM(vs.elevenlabs_tts_credits) as tts_credits,
  SUM(vs.elevenlabs_llm_credits) as llm_credits,
  SUM(vs.elevenlabs_character_count) as total_characters,
  SUM(vs.elevenlabs_cost_cents)::DECIMAL / 100 as estimated_cost_usd
FROM justai_voice_sessions vs
JOIN profiles p ON p.id = vs.student_id
WHERE vs.transcription_complete = true
GROUP BY p.email, DATE_TRUNC('month', vs.created_at)
ORDER BY month DESC, estimated_cost_usd DESC;

-- Average credits per minute of conversation
SELECT 
  ROUND(AVG(vs.elevenlabs_credits_used::DECIMAL / NULLIF(vs.total_duration_seconds / 60.0, 0)), 2) as avg_credits_per_minute,
  ROUND(AVG(vs.elevenlabs_tts_credits::DECIMAL / NULLIF(vs.total_duration_seconds / 60.0, 0)), 2) as avg_tts_credits_per_minute,
  ROUND(AVG(vs.elevenlabs_llm_credits::DECIMAL / NULLIF(vs.total_duration_seconds / 60.0, 0)), 2) as avg_llm_credits_per_minute
FROM justai_voice_sessions vs
WHERE vs.transcription_complete = true 
  AND vs.total_duration_seconds > 0;
```
