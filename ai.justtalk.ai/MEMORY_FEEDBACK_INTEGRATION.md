# Memory & Language Feedback Integration

## Overview

This document outlines how to integrate the new OpenAI structured feedback response (with **memory** and **language_feedback**) into the existing Supabase database structure and `analyze-conversation-feedback` edge function.

---

## New OpenAI Response Schema

The system will request structured JSON from OpenAI with two distinct sections:

### 1. **Memory** (Social Continuity & Scenario Progression)
- Stores context between conversation steps in a roleplay scenario
- Never evaluates English ability
- Determines if user should progress to next step

### 2. **Language Feedback** (English Coaching)
- Strict evaluation of spoken English effectiveness
- Never references scenario, persona, or relationship
- Provides score (0-100), diagnosis, and actionable improvements

```typescript
interface MemoryLanguageFeedback {
  memory: {
    conversation_summary: string;      // 2-4 sentences, factual
    emotional_notes: string;           // Interpersonal dynamic
    open_threads: string[];            // Follow-up topics
    unlock_next_scenario: boolean;     // Progress to next step?
  };
  language_feedback: {
    score: number;                     // 0-100
    label: string;                     // "Excellent", "Good", etc.
    diagnosis: string;                 // One sentence why
    improvement_instruction: string;   // One concrete fix
    example: {
      original: string;                // Verbatim learner speech
      better: string;                  // Corrected version
    };
  };
}
```

---

## Database Schema Changes

### Option 1: Add JSONB Columns to Existing Tables (RECOMMENDED)

This approach minimizes schema changes and leverages PostgreSQL's JSONB capabilities.

```sql
-- Add memory and feedback columns to justai_conversations
ALTER TABLE justai_conversations 
  ADD COLUMN IF NOT EXISTS session_memory JSONB,
  ADD COLUMN IF NOT EXISTS language_feedback JSONB,
  ADD COLUMN IF NOT EXISTS conversation_score INTEGER CHECK (conversation_score >= 0 AND conversation_score <= 100),
  ADD COLUMN IF NOT EXISTS score_calculated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS unlock_next_scenario BOOLEAN DEFAULT false;

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_conversations_score 
  ON justai_conversations(conversation_score) 
  WHERE conversation_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_unlock 
  ON justai_conversations(unlock_next_scenario) 
  WHERE unlock_next_scenario = true;

-- Add GIN index for JSONB queries (optional, for advanced filtering)
CREATE INDEX IF NOT EXISTS idx_conversations_memory_gin 
  ON justai_conversations USING GIN (session_memory);

CREATE INDEX IF NOT EXISTS idx_conversations_feedback_gin 
  ON justai_conversations USING GIN (language_feedback);
```

**Pros:**
- Minimal schema changes
- Flexible - can add fields to JSONB without migrations
- PostgreSQL JSONB is fast and indexed
- Easy to query: `feedback->>'score'`, `memory->>'unlock_next_scenario'`

**Cons:**
- Less type-safe than dedicated columns
- Slightly more complex queries

---

### Option 2: Create Dedicated Columns (Alternative)

For stronger typing and simpler queries, create dedicated columns:

```sql
ALTER TABLE justai_conversations 
  -- Memory fields
  ADD COLUMN IF NOT EXISTS conversation_summary TEXT,
  ADD COLUMN IF NOT EXISTS emotional_notes TEXT,
  ADD COLUMN IF NOT EXISTS open_threads TEXT[], -- Array of strings
  ADD COLUMN IF NOT EXISTS unlock_next_scenario BOOLEAN DEFAULT false,
  
  -- Language feedback fields
  ADD COLUMN IF NOT EXISTS conversation_score INTEGER CHECK (conversation_score >= 0 AND conversation_score <= 100),
  ADD COLUMN IF NOT EXISTS score_label TEXT,
  ADD COLUMN IF NOT EXISTS score_diagnosis TEXT,
  ADD COLUMN IF NOT EXISTS improvement_instruction TEXT,
  ADD COLUMN IF NOT EXISTS example_original TEXT,
  ADD COLUMN IF NOT EXISTS example_better TEXT,
  ADD COLUMN IF NOT EXISTS score_calculated_at TIMESTAMPTZ;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_conversations_score ON justai_conversations(conversation_score);
CREATE INDEX IF NOT EXISTS idx_conversations_unlock ON justai_conversations(unlock_next_scenario);
```

**Pros:**
- Type-safe with proper constraints
- Simpler SQL queries
- Better for PostgreSQL query planning

**Cons:**
- More columns to maintain
- Harder to evolve schema (requires migrations)
- Verbose

---

## Recommended Approach: **Option 1 (JSONB)**

Use JSONB columns for flexibility while storing the score separately for indexing:

```sql
ALTER TABLE justai_conversations 
  ADD COLUMN IF NOT EXISTS session_memory JSONB,
  ADD COLUMN IF NOT EXISTS language_feedback JSONB,
  ADD COLUMN IF NOT EXISTS conversation_score INTEGER CHECK (conversation_score >= 0 AND conversation_score <= 100),
  ADD COLUMN IF NOT EXISTS unlock_next_scenario BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS score_calculated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_conversations_score ON justai_conversations(conversation_score);
CREATE INDEX IF NOT EXISTS idx_conversations_unlock ON justai_conversations(unlock_next_scenario);
```

**Why?**
- `session_memory` and `language_feedback` store the full structured response
- `conversation_score` is extracted for fast filtering/sorting
- `unlock_next_scenario` is extracted for progress tracking
- Future-proof: Can add new fields to JSONB without schema changes

---

## Updated Edge Function: `analyze-conversation-feedback`

### Current Implementation
The function currently:
1. Fetches ElevenLabs conversation transcript
2. Calculates snapshot metrics (duration, words, turns)
3. Checks vocabulary goals usage
4. Generates basic LLM feedback (scores + advice)
5. Returns feedback to client (NOT stored in DB)

### New Implementation

```typescript
// supabase/functions/analyze-conversation-feedback/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { conversationId, elevenLabsConvId, studentId } = await req.json()

    // ... (fetch ElevenLabs conversation - same as before)

    // Generate structured feedback using OpenAI with schema
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    let memoryFeedback: MemoryLanguageFeedback | null = null

    if (openaiKey && studentMessages.length > 0) {
      const conversationContext = elevenLabsConv.transcript
        .map(m => `${m.role === 'user' ? 'Student' : 'AI'}: ${m.message}`)
        .join('\n')

      const systemPrompt = `You are a dual-purpose AI analyzer for English language learning conversations.

Your task is to provide TWO separate analyses:

1. MEMORY: Track social continuity and scenario progression (never evaluate English)
2. LANGUAGE_FEEDBACK: Evaluate English effectiveness (never reference scenario/persona)

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
                      properties: {
                        conversation_summary: { type: 'string', minLength: 1 },
                        emotional_notes: { type: 'string', minLength: 1 },
                        open_threads: {
                          type: 'array',
                          items: { type: 'string', minLength: 1 }
                        },
                        unlock_next_scenario: { type: 'boolean' }
                      },
                      required: ['conversation_summary', 'emotional_notes', 'open_threads', 'unlock_next_scenario'],
                      additionalProperties: false
                    },
                    language_feedback: {
                      type: 'object',
                      properties: {
                        score: { type: 'integer', minimum: 0, maximum: 100 },
                        label: { type: 'string' },
                        diagnosis: { type: 'string' },
                        improvement_instruction: { type: 'string' },
                        example: {
                          type: 'object',
                          properties: {
                            original: { type: 'string' },
                            better: { type: 'string' }
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
          console.error('OpenAI API error:', openaiResponse.status)
        }
      } catch (error) {
        console.error('Error generating structured feedback:', error)
      }
    }

    // Save to database
    if (memoryFeedback && conversationId) {
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
        console.error('Error saving feedback to database:', updateError)
      } else {
        console.log('✅ Feedback saved to database')
      }
    }

    // Return response (keeping existing structure + new feedback)
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
      // Legacy fields (can be deprecated later)
      vocabularyGoals: vocabularyGoalsUsed.length > 0 ? vocabularyGoalsUsed : undefined,
      vocabularySuggestions: vocabularySuggestions.length > 0 ? vocabularySuggestions : undefined,
    }

    return new Response(
      JSON.stringify({ success: true, feedback: feedbackData }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error analyzing conversation feedback:', error)
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
```

---

## Progress Tracking Integration

### Update `justai_student_progress` Table

The scenario memory helps determine when to unlock next steps:

```sql
-- Function to update progress based on conversation feedback
CREATE OR REPLACE FUNCTION update_progress_from_feedback(
  p_conversation_id UUID
) RETURNS void AS $$
DECLARE
  v_conversation RECORD;
  v_roleplay_step_id UUID;
  v_student_id UUID;
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

  IF v_conversation.roleplay_step_id IS NULL THEN
    -- Not part of a roleplay scenario, skip
    RETURN;
  END IF;

  -- Update student progress
  UPDATE justai_student_progress
  SET
    latest_session_score = v_conversation.conversation_score,
    best_session_score = GREATEST(
      COALESCE(best_session_score, 0), 
      v_conversation.conversation_score
    ),
    total_score_sum = total_score_sum + v_conversation.conversation_score,
    sessions_count = sessions_count + 1,
    average_session_score = (total_score_sum + v_conversation.conversation_score)::DECIMAL / 
                           (sessions_count + 1),
    status = CASE 
      WHEN v_conversation.unlock_next_scenario THEN 'completed'
      ELSE 'in_progress'
    END,
    completed_at = CASE 
      WHEN v_conversation.unlock_next_scenario THEN NOW()
      ELSE completed_at
    END,
    best_session_conversation_id = CASE 
      WHEN v_conversation.conversation_score > COALESCE(best_session_score, 0) 
      THEN p_conversation_id
      ELSE best_session_conversation_id
    END,
    updated_at = NOW()
  WHERE student_id = v_conversation.student_id
    AND roleplay_step_id = v_conversation.roleplay_step_id;

  -- If unlocked next scenario, unlock the next step
  IF v_conversation.unlock_next_scenario THEN
    PERFORM check_unlock_next_step(
      v_conversation.student_id,
      v_conversation.roleplay_step_id
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Call from Edge Function

Add this after saving feedback:

```typescript
// After updating justai_conversations...

// Update student progress (if this is part of a roleplay)
const { error: progressError } = await supabaseClient
  .rpc('update_progress_from_feedback', {
    p_conversation_id: conversationId
  })

if (progressError) {
  console.warn('Could not update progress:', progressError)
}
```

---

## Frontend Integration

### Display Memory Context

```typescript
interface FeedbackData {
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
}

// In FeedbackDrawer component:
{feedbackData.memory && (
  <div className="memory-section">
    <h3>Conversation Context</h3>
    <p>{feedbackData.memory.conversation_summary}</p>
    
    <div className="emotional-notes">
      <strong>How it went:</strong>
      <p>{feedbackData.memory.emotional_notes}</p>
    </div>
    
    {feedbackData.memory.open_threads.length > 0 && (
      <div className="open-threads">
        <strong>Topics to continue:</strong>
        <ul>
          {feedbackData.memory.open_threads.map((thread, i) => (
            <li key={i}>{thread}</li>
          ))}
        </ul>
      </div>
    )}
    
    {feedbackData.memory.unlock_next_scenario && (
      <div className="unlock-badge">
        🎉 Ready for next scenario!
      </div>
    )}
  </div>
)}

{feedbackData.languageFeedback && (
  <div className="language-section">
    <h3>English Coaching</h3>
    
    <div className="score-card">
      <div className="score">{feedbackData.languageFeedback.score}/100</div>
      <div className="label">{feedbackData.languageFeedback.label}</div>
    </div>
    
    <div className="diagnosis">
      <strong>Why this score:</strong>
      <p>{feedbackData.languageFeedback.diagnosis}</p>
    </div>
    
    <div className="improvement">
      <strong>What to improve:</strong>
      <p>{feedbackData.languageFeedback.improvement_instruction}</p>
    </div>
    
    <div className="example">
      <strong>Example correction:</strong>
      <div className="original">❌ {feedbackData.languageFeedback.example.original}</div>
      <div className="better">✅ {feedbackData.languageFeedback.example.better}</div>
    </div>
  </div>
)}
```

---

## Migration Steps

### 1. Create Migration

```bash
cd supabase
supabase migration new add_memory_feedback_columns
```

### 2. Add SQL

```sql
-- Add columns to justai_conversations
ALTER TABLE justai_conversations 
  ADD COLUMN IF NOT EXISTS session_memory JSONB,
  ADD COLUMN IF NOT EXISTS language_feedback JSONB,
  ADD COLUMN IF NOT EXISTS conversation_score INTEGER CHECK (conversation_score >= 0 AND conversation_score <= 100),
  ADD COLUMN IF NOT EXISTS unlock_next_scenario BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS score_calculated_at TIMESTAMPTZ;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_conversations_score 
  ON justai_conversations(conversation_score);

CREATE INDEX IF NOT EXISTS idx_conversations_unlock 
  ON justai_conversations(unlock_next_scenario);

-- Create progress update function
CREATE OR REPLACE FUNCTION update_progress_from_feedback(
  p_conversation_id UUID
) RETURNS void AS $$
-- [Function body from above]
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 3. Apply Migration

```bash
supabase db push
```

### 4. Update Edge Function

Replace the current `analyze-conversation-feedback/index.ts` with the new implementation.

### 5. Deploy

```bash
supabase functions deploy analyze-conversation-feedback
```

---

## Benefits

✅ **Contextual Memory**: Tracks conversation continuity between roleplay steps  
✅ **Separate Concerns**: Memory vs. Language feedback are cleanly separated  
✅ **Progress Automation**: `unlock_next_scenario` automates step progression  
✅ **Actionable Feedback**: One concrete improvement instruction per session  
✅ **Structured Data**: JSONB allows flexible queries and future expansion  
✅ **Score Tracking**: Integrated with existing `justai_student_progress` table  

---

## Future Enhancements

1. **Memory Chain**: Load previous session memory to maintain continuity
2. **Adaptive Difficulty**: Use scores to adjust scenario difficulty
3. **Analytics Dashboard**: Aggregate scores across students/scenarios
4. **A/B Testing**: Compare different prompts/models for feedback quality
5. **Caching**: Store feedback in table for historical analysis

---

## Summary

**Recommended Implementation:**
- Use JSONB columns for `session_memory` and `language_feedback`
- Extract `conversation_score` and `unlock_next_scenario` as indexed columns
- Update `analyze-conversation-feedback` edge function to use structured schema
- Create database function to update progress automatically
- Display memory and language feedback separately in UI

This approach balances flexibility, performance, and maintainability while fitting seamlessly into the existing Supabase structure.
