# Memory & Language Feedback - Implementation Plan

## Overview
Implement structured feedback system that separates **memory** (social continuity) from **language feedback** (English coaching) using OpenAI's structured output feature.

---

## Phase 1: Database Schema (Priority: Critical)

### 1.1 Create Migration File
```bash
cd supabase
supabase migration new add_memory_feedback_columns
```

### 1.2 Add Schema Changes
**File:** `supabase/migrations/YYYYMMDDHHMMSS_add_memory_feedback_columns.sql`

```sql
-- Add JSONB columns for structured feedback
ALTER TABLE justai_conversations 
  ADD COLUMN IF NOT EXISTS session_memory JSONB,
  ADD COLUMN IF NOT EXISTS language_feedback JSONB,
  ADD COLUMN IF NOT EXISTS conversation_score INTEGER 
    CHECK (conversation_score >= 0 AND conversation_score <= 100),
  ADD COLUMN IF NOT EXISTS unlock_next_scenario BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS score_calculated_at TIMESTAMPTZ;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversations_score 
  ON justai_conversations(conversation_score) 
  WHERE conversation_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_unlock 
  ON justai_conversations(unlock_next_scenario) 
  WHERE unlock_next_scenario = true;

-- Optional: GIN indexes for JSONB queries
CREATE INDEX IF NOT EXISTS idx_conversations_memory_gin 
  ON justai_conversations USING GIN (session_memory);

CREATE INDEX IF NOT EXISTS idx_conversations_feedback_gin 
  ON justai_conversations USING GIN (language_feedback);
```

### 1.3 Create Progress Update Function

```sql
-- Function to update student progress based on conversation feedback
CREATE OR REPLACE FUNCTION update_progress_from_feedback(
  p_conversation_id UUID
) RETURNS void AS $$
DECLARE
  v_conversation RECORD;
BEGIN
  -- Get conversation details
  SELECT 
    student_id,
    roleplay_step_id,
    conversation_score,
    unlock_next_scenario
  INTO v_conversation
  FROM justai_conversations
  WHERE id = p_conversation_id;

  -- Only process if part of a roleplay scenario
  IF v_conversation.roleplay_step_id IS NULL THEN
    RETURN;
  END IF;

  -- Update student progress with scores and status
  INSERT INTO justai_student_progress (
    student_id,
    roleplay_step_id,
    latest_session_score,
    best_session_score,
    total_score_sum,
    sessions_count,
    average_session_score,
    status,
    completed_at,
    updated_at
  ) VALUES (
    v_conversation.student_id,
    v_conversation.roleplay_step_id,
    v_conversation.conversation_score,
    v_conversation.conversation_score,
    v_conversation.conversation_score,
    1,
    v_conversation.conversation_score,
    CASE 
      WHEN v_conversation.unlock_next_scenario THEN 'completed'
      ELSE 'in_progress'
    END,
    CASE 
      WHEN v_conversation.unlock_next_scenario THEN NOW()
      ELSE NULL
    END,
    NOW()
  )
  ON CONFLICT (student_id, roleplay_step_id)
  DO UPDATE SET
    latest_session_score = v_conversation.conversation_score,
    best_session_score = GREATEST(
      COALESCE(justai_student_progress.best_session_score, 0), 
      v_conversation.conversation_score
    ),
    total_score_sum = justai_student_progress.total_score_sum + v_conversation.conversation_score,
    sessions_count = justai_student_progress.sessions_count + 1,
    average_session_score = (
      justai_student_progress.total_score_sum + v_conversation.conversation_score
    )::DECIMAL / (justai_student_progress.sessions_count + 1),
    status = CASE 
      WHEN v_conversation.unlock_next_scenario THEN 'completed'
      ELSE justai_student_progress.status
    END,
    completed_at = CASE 
      WHEN v_conversation.unlock_next_scenario THEN NOW()
      ELSE justai_student_progress.completed_at
    END,
    best_session_conversation_id = CASE 
      WHEN v_conversation.conversation_score > COALESCE(justai_student_progress.best_session_score, 0) 
      THEN p_conversation_id
      ELSE justai_student_progress.best_session_conversation_id
    END,
    updated_at = NOW();

  -- If unlocked next scenario, trigger unlock logic
  IF v_conversation.unlock_next_scenario THEN
    -- Call existing unlock function if it exists
    -- PERFORM check_unlock_next_step(
    --   v_conversation.student_id,
    --   v_conversation.roleplay_step_id
    -- );
    NULL; -- Placeholder until check_unlock_next_step exists
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 1.4 Apply Migration
```bash
supabase db push
```

**Success Criteria:**
- ✅ All columns added successfully
- ✅ Indexes created
- ✅ Function compiles without errors
- ✅ Test with `SELECT * FROM justai_conversations LIMIT 1;`

---

## Phase 2: Edge Function Update (Priority: Critical)

### 2.1 Update TypeScript Interfaces

**File:** `supabase/functions/analyze-conversation-feedback/index.ts`

Add at top of file:
```typescript
interface MemoryLanguageFeedback {
  memory: {
    conversation_summary: string;
    emotional_notes: string;
    open_threads: string[];
    unlock_next_scenario: boolean;
  };
  language_feedback: {
    score: number;
    label: string;
    diagnosis: string;
    improvement_instruction: string;
    example: {
      original: string;
      better: string;
    };
  };
}
```

### 2.2 Replace LLM Feedback Generation

**Find this section** (around line 139-200):
```typescript
// Generate LLM-based feedback using OpenAI
const openaiKey = Deno.env.get('OPENAI_API_KEY')
let llmFeedback = null
// ... existing prompt and fetch logic
```

**Replace with:**
```typescript
// Generate structured feedback using OpenAI with strict schema
const openaiKey = Deno.env.get('OPENAI_API_KEY')
let memoryFeedback: MemoryLanguageFeedback | null = null

if (openaiKey && studentMessages.length > 0) {
  const conversationContext = elevenLabsConv.transcript
    .map(m => `${m.role === 'user' ? 'Student' : 'AI'}: ${m.message}`)
    .join('\n')

  const systemPrompt = `You are a dual-purpose AI analyzer for English language learning conversations.

Your task is to provide TWO separate analyses:

1. MEMORY: Track social continuity and scenario progression (never evaluate English)
   - Summarize what was discussed factually
   - Note emotional tone and interpersonal dynamics
   - List follow-up topics that could continue the conversation
   - Determine if the learner is ready to progress to next scenario

2. LANGUAGE_FEEDBACK: Evaluate English effectiveness (never reference scenario/persona)
   - Score spoken English objectively (0-100)
   - Diagnose why this score was given (one sentence)
   - Provide ONE concrete, actionable improvement
   - Show one example: original speech → better version

Be strict and objective in language evaluation. Base scores on actual performance.`

  const userPrompt = `Analyze this conversation:

${conversationContext}

Provide structured feedback following the exact schema.`

  try {
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'memory_language_feedback',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                memory: {
                  type: 'object',
                  description: 'Stores social continuity and scenario progression. Never evaluates English.',
                  properties: {
                    conversation_summary: { 
                      type: 'string', 
                      minLength: 1,
                      description: 'Factual summary, 2-4 sentences'
                    },
                    emotional_notes: { 
                      type: 'string', 
                      minLength: 1,
                      description: 'Interpersonal dynamic, emotional tone'
                    },
                    open_threads: {
                      type: 'array',
                      description: 'Follow-up topics or questions',
                      items: { type: 'string', minLength: 1 }
                    },
                    unlock_next_scenario: { 
                      type: 'boolean',
                      description: 'Whether learner is ready to progress'
                    }
                  },
                  required: ['conversation_summary', 'emotional_notes', 'open_threads', 'unlock_next_scenario'],
                  additionalProperties: false
                },
                language_feedback: {
                  type: 'object',
                  description: 'English coaching feedback. Never references scenario or persona.',
                  properties: {
                    score: { 
                      type: 'integer', 
                      minimum: 0, 
                      maximum: 100,
                      description: 'Absolute English effectiveness score'
                    },
                    label: { 
                      type: 'string',
                      description: 'Qualitative descriptor (e.g., "Good", "Excellent")'
                    },
                    diagnosis: { 
                      type: 'string',
                      description: 'One sentence explaining why this score'
                    },
                    improvement_instruction: { 
                      type: 'string',
                      description: 'One concrete, actionable improvement'
                    },
                    example: {
                      type: 'object',
                      description: 'One learner utterance: original vs better',
                      properties: {
                        original: { 
                          type: 'string',
                          description: 'Verbatim from learner'
                        },
                        better: { 
                          type: 'string',
                          description: 'Corrected/improved version'
                        }
                      },
                      required: ['original', 'better'],
                      additionalProperties: false
                    }
                  },
                  required: ['score', 'label', 'diagnosis', 'improvement_instruction', 'example'],
                  additionalProperties: false
                }
              },
              required: ['memory', 'language_feedback'],
              additionalProperties: false
            }
          }
        },
        temperature: 0.3, // Lower for consistency
      }),
    })

    if (openaiResponse.ok) {
      const openaiData = await openaiResponse.json()
      const content = openaiData.choices[0]?.message?.content
      if (content) {
        memoryFeedback = JSON.parse(content)
        console.log('✅ Structured feedback generated:', memoryFeedback)
      }
    } else {
      const errorText = await openaiResponse.text()
      console.error('OpenAI API error:', openaiResponse.status, errorText)
    }
  } catch (error) {
    console.error('Error generating structured feedback:', error)
  }
}
```

### 2.3 Save Feedback to Database

**Add after feedback generation (before returning response):**
```typescript
// Save feedback to database
if (memoryFeedback && conversationId) {
  console.log('💾 Saving feedback to database...')
  
  const { error: updateError } = await supabaseClient
    .from('justai_conversations')
    .update({
      session_memory: memoryFeedback.memory,
      language_feedback: memoryFeedback.language_feedback,
      conversation_score: memoryFeedback.language_feedback.score,
      unlock_next_scenario: memoryFeedback.memory.unlock_next_scenario,
      score_calculated_at: new Date().toISOString(),
    })
    .eq('id', conversationId)

  if (updateError) {
    console.error('❌ Error saving feedback to database:', updateError)
  } else {
    console.log('✅ Feedback saved to database')
    
    // Update student progress (if part of roleplay)
    const { error: progressError } = await supabaseClient
      .rpc('update_progress_from_feedback', {
        p_conversation_id: conversationId
      })

    if (progressError) {
      console.warn('⚠️ Could not update progress:', progressError)
    } else {
      console.log('✅ Student progress updated')
    }
  }
}
```

### 2.4 Update Response Format

**Find the feedbackData object** (around line 235):
```typescript
const feedbackData = {
  snapshot,
  vocabularyGoals: vocabularyGoalsUsed.length > 0 ? vocabularyGoalsUsed : undefined,
  vocabularySuggestions: vocabularySuggestions.length > 0 ? vocabularySuggestions : undefined,
  llmFeedback,
}
```

**Replace with:**
```typescript
const feedbackData = {
  snapshot: {
    duration: Math.round(elevenLabsConv.metadata?.call_duration_secs || 0),
    turns: elevenLabsConv.transcript?.length || 0,
    words: studentWords + aiWords,
    studentWords,
    aiWords,
  },
  memory: memoryFeedback?.memory || null,
  languageFeedback: memoryFeedback?.language_feedback || null,
  // Legacy fields (can deprecate later)
  vocabularyGoals: vocabularyGoalsUsed.length > 0 ? vocabularyGoalsUsed : undefined,
  vocabularySuggestions: vocabularySuggestions.length > 0 ? vocabularySuggestions : undefined,
}
```

### 2.5 Deploy Edge Function
```bash
supabase functions deploy analyze-conversation-feedback
```

**Success Criteria:**
- ✅ Function deploys without errors
- ✅ Test call returns structured feedback
- ✅ Database records updated correctly
- ✅ Progress tracking works

---

## Phase 3: Frontend Integration (Priority: High)

### 3.1 Update TypeScript Types

**File:** `ai-chat-app/src/types/feedback.ts` (create if doesn't exist)

```typescript
export interface FeedbackData {
  snapshot: {
    duration: number;
    turns: number;
    words: number;
    studentWords: number;
    aiWords: number;
  };
  memory?: {
    conversation_summary: string;
    emotional_notes: string;
    open_threads: string[];
    unlock_next_scenario: boolean;
  };
  languageFeedback?: {
    score: number;
    label: string;
    diagnosis: string;
    improvement_instruction: string;
    example: {
      original: string;
      better: string;
    };
  };
  // Legacy fields
  vocabularyGoals?: any[];
  vocabularySuggestions?: any[];
}
```

### 3.2 Update FeedbackDrawer Component

**File:** `ai-chat-app/src/components/FeedbackDrawer.tsx` (or similar)

Add sections for memory and language feedback:

```tsx
import { FeedbackData } from '@/types/feedback'

interface FeedbackDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  feedbackData: FeedbackData | null;
}

export function FeedbackDrawer({ isOpen, onClose, feedbackData }: FeedbackDrawerProps) {
  if (!feedbackData) return null;

  return (
    <Drawer open={isOpen} onClose={onClose}>
      <div className="p-6 space-y-6">
        {/* Snapshot Section */}
        <div className="snapshot-section">
          <h3 className="text-lg font-semibold mb-2">Session Summary</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="stat">
              <div className="text-2xl font-bold">{feedbackData.snapshot.duration}s</div>
              <div className="text-sm text-gray-500">Duration</div>
            </div>
            <div className="stat">
              <div className="text-2xl font-bold">{feedbackData.snapshot.turns}</div>
              <div className="text-sm text-gray-500">Exchanges</div>
            </div>
            <div className="stat">
              <div className="text-2xl font-bold">{feedbackData.snapshot.studentWords}</div>
              <div className="text-sm text-gray-500">Your Words</div>
            </div>
          </div>
        </div>

        {/* Memory Section */}
        {feedbackData.memory && (
          <div className="memory-section border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">Conversation Context</h3>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-sm text-gray-600 mb-1">Summary</h4>
                <p className="text-gray-800">{feedbackData.memory.conversation_summary}</p>
              </div>
              
              <div>
                <h4 className="font-medium text-sm text-gray-600 mb-1">How it went</h4>
                <p className="text-gray-800">{feedbackData.memory.emotional_notes}</p>
              </div>
              
              {feedbackData.memory.open_threads.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm text-gray-600 mb-2">Topics to continue</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {feedbackData.memory.open_threads.map((thread, i) => (
                      <li key={i} className="text-gray-800">{thread}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {feedbackData.memory.unlock_next_scenario && (
                <div className="unlock-badge bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                  <span className="text-2xl">🎉</span>
                  <span className="text-green-800 font-medium">Ready for next scenario!</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Language Feedback Section */}
        {feedbackData.languageFeedback && (
          <div className="language-section border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">English Coaching</h3>
            
            <div className="space-y-4">
              {/* Score Card */}
              <div className="score-card bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 text-center">
                <div className="text-5xl font-bold text-indigo-600 mb-2">
                  {feedbackData.languageFeedback.score}
                  <span className="text-2xl text-gray-500">/100</span>
                </div>
                <div className="text-lg font-medium text-gray-700">
                  {feedbackData.languageFeedback.label}
                </div>
              </div>
              
              {/* Diagnosis */}
              <div>
                <h4 className="font-medium text-sm text-gray-600 mb-1">Why this score</h4>
                <p className="text-gray-800">{feedbackData.languageFeedback.diagnosis}</p>
              </div>
              
              {/* Improvement */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="font-medium text-sm text-amber-800 mb-2">💡 What to improve</h4>
                <p className="text-gray-800">{feedbackData.languageFeedback.improvement_instruction}</p>
              </div>
              
              {/* Example */}
              <div>
                <h4 className="font-medium text-sm text-gray-600 mb-2">Example correction</h4>
                <div className="space-y-2">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="text-xs text-red-600 font-medium mb-1">❌ Original</div>
                    <p className="text-gray-800 italic">"{feedbackData.languageFeedback.example.original}"</p>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="text-xs text-green-600 font-medium mb-1">✅ Better</div>
                    <p className="text-gray-800 font-medium">"{feedbackData.languageFeedback.example.better}"</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
}
```

### 3.3 Test Frontend Display
- Open voice session
- Complete conversation
- Verify feedback drawer shows memory and language feedback
- Check unlock badge appears when appropriate

**Success Criteria:**
- ✅ Memory section displays correctly
- ✅ Language feedback shows score, diagnosis, improvement
- ✅ Example correction renders properly
- ✅ Unlock badge appears when `unlock_next_scenario` is true

---

## Phase 4: Testing & Validation (Priority: Critical)

### 4.1 Local Testing Checklist

- [ ] Database migration applies cleanly
- [ ] Columns exist with correct types
- [ ] Indexes created successfully
- [ ] Edge function compiles without TypeScript errors
- [ ] OpenAI API returns structured JSON
- [ ] Feedback saves to `justai_conversations` table
- [ ] `update_progress_from_feedback()` function executes
- [ ] Progress tracking updates scores correctly
- [ ] Frontend displays all feedback sections
- [ ] No console errors in browser

### 4.2 End-to-End Test Scenarios

**Test 1: Short conversation (< 10 messages)**
- Expected: Low score, unlock_next_scenario = false
- Verify: Memory captured, diagnosis explains low score

**Test 2: Good conversation (20+ messages, varied vocabulary)**
- Expected: Medium-high score (60-80), unlock_next_scenario = true
- Verify: Progress status changes to 'completed', next step unlocks

**Test 3: Excellent conversation (30+ messages, complex grammar)**
- Expected: High score (80-100), unlock_next_scenario = true
- Verify: Best score updates, average calculated correctly

**Test 4: Roleplay not linked to steps**
- Expected: Feedback generated but progress not updated
- Verify: No errors, graceful handling

### 4.3 Performance Testing
- Measure OpenAI API response time (should be < 5s)
- Check database update latency (should be < 500ms)
- Monitor edge function execution time (should be < 10s total)

---

## Phase 5: Deployment (Priority: High)

### 5.1 Pre-Deployment Checklist
- [ ] All tests passing locally
- [ ] Code reviewed
- [ ] Migration tested on staging database
- [ ] Environment variables set (OPENAI_API_KEY)
- [ ] Backup current database

### 5.2 Deployment Steps

```bash
# 1. Apply migration to production
supabase db push --linked

# 2. Deploy edge function
supabase functions deploy analyze-conversation-feedback

# 3. Verify secrets are set
supabase secrets list

# 4. Deploy frontend
# (depends on your deployment setup - Vercel, Netlify, etc.)
```

### 5.3 Post-Deployment Monitoring
- Monitor error logs in Supabase dashboard
- Check OpenAI usage/costs
- Verify first few conversations get feedback
- Monitor database performance

---

## Rollback Plan

If issues occur:

1. **Edge Function Issue:**
   ```bash
   # Redeploy previous version
   git checkout <previous-commit>
   supabase functions deploy analyze-conversation-feedback
   ```

2. **Database Issue:**
   ```sql
   -- Remove new columns if needed
   ALTER TABLE justai_conversations 
     DROP COLUMN IF EXISTS session_memory,
     DROP COLUMN IF EXISTS language_feedback,
     DROP COLUMN IF EXISTS conversation_score,
     DROP COLUMN IF EXISTS unlock_next_scenario,
     DROP COLUMN IF EXISTS score_calculated_at;
   
   -- Drop function
   DROP FUNCTION IF EXISTS update_progress_from_feedback(UUID);
   ```

3. **Frontend Issue:**
   - Revert to previous deployment
   - Ensure backward compatibility (old format still works)

---

## Success Metrics

### Technical Metrics
- ✅ 100% of conversations get structured feedback
- ✅ < 5s average OpenAI API response time
- ✅ 0 database constraint violations
- ✅ < 1% error rate on feedback generation

### User Experience Metrics
- ✅ Users can see memory context between sessions
- ✅ Language scores are consistent and understandable
- ✅ Improvement suggestions are actionable
- ✅ Progress unlocking works automatically

### Business Metrics
- ✅ OpenAI costs within budget (< $0.10 per conversation)
- ✅ Increased session completion rates
- ✅ Higher user engagement with feedback

---

## Future Enhancements

1. **Memory Chaining**: Load previous session memory to maintain continuity
2. **Score Analytics**: Dashboard showing score trends over time
3. **Adaptive Difficulty**: Adjust scenario difficulty based on scores
4. **Multi-language Support**: Extend beyond English
5. **Voice Analysis**: Include pronunciation/fluency metrics

---

## Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| 1. Database Schema | 1-2 hours | None |
| 2. Edge Function | 3-4 hours | Phase 1 |
| 3. Frontend | 2-3 hours | Phase 2 |
| 4. Testing | 2-3 hours | Phase 3 |
| 5. Deployment | 1 hour | Phase 4 |
| **Total** | **9-13 hours** | |

---

## Notes & Considerations

- **JSONB vs Columns**: Using JSONB provides flexibility for schema evolution without migrations
- **Score Calculation**: Consider caching scores for historical analysis
- **OpenAI Costs**: Monitor usage; consider switching to GPT-3.5 if costs too high
- **Privacy**: Ensure conversation data complies with privacy policies
- **Localization**: Keep in mind future multi-language support when designing prompts

---

## Ready to Start?

Begin with Phase 1 (Database Schema) and work sequentially. Each phase has clear success criteria before moving to the next.
