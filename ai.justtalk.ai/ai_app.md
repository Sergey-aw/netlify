# AI Chat Subscription Architecture

## Executive Summary

This document describes the architecture for adding an **AI-powered chat subscription feature** to JustTalk.ai - allowing students to chat with an AI teacher-like assistant on a subscription basis, separate from the existing human teacher lesson booking system.

---

## Current Architecture Analysis

### User & Profile System

#### Profiles Table
- **Core Identity**: `profiles` table extends `auth.users`
- **Key Fields**:
  - `id` (UUID) - references auth.users
  - `role` (text) - CHECK constraint: 'teacher', 'student', 'admin'
  - `owner_teacher_id` (UUID) - for student-teacher relationships
  - `email`, `display_name`, `name`
  - Learning-related: `cefr_level`, `learning_goals`, `native_language`
  - Teacher-specific: `hourly_rate`, `teaching_languages`, `is_certified_teacher`

#### Multi-Role System
- **user_roles** table enables multiple roles per user
  - `app_role` enum: 'admin', 'teacher', 'student'
  - A user can be both teacher AND student simultaneously
  - Primary role stored in `profiles.role` (legacy)

#### Teacher-Student Relationships
- **teacher_student_links** table: Many-to-many relationship
  - Links teachers to their students
  - Used for access control and data visibility
  - Created via invite system

### Lesson & Booking System

#### Lessons Table
- **Core Fields**:
  - `teacher_id` (UUID) - references profiles
  - `student_id` (UUID) - references profiles
  - `starts_at`, `ends_at` (timestamptz)
  - `status` - 'scheduled', 'completed', 'canceled'
  - `is_free_lesson` (boolean)
  - `title`, `notes`

#### Payment Flow
1. **Student Credits System**:
   - `student_credits` table tracks purchased lesson packages
   - Credits have: `total_credits`, `used_credits`, `remaining_credits`
   - Tied to specific teacher via `teacher_id`
   - Can be purchased via Stripe (`stripe_payment_intent_id`)
   - Can expire (`expires_at`)

2. **Lesson Payments**:
   - `lesson_payments` table links lessons to credit usage
   - Created when lesson is completed
   - References the credit package used
   - Has 24-hour hold before release to teacher

3. **Teacher Earnings**:
   - `teacher_earnings` table tracks net earnings after commission
   - Commission rate applied (platform fee)
   - Available for payout after release period

4. **Transactions**:
   - `student_credit_transactions` - tracks credit purchases and debits
   - `teacher_earning_transactions` - tracks teacher income flow

### AI Features (Existing)

#### AI Feature Access System
- **ai_feature_access** table: Controls AI feature access per user
  - `feature_name` - e.g., 'student_insights', 'lesson_planning'
  - `is_enabled` (boolean)
  - Token limits: `daily_token_limit`, `monthly_token_limit`
  - `expires_at` - optional expiration
  - `preferred_model` - GPT model selection
  - `granted_by` - admin who granted access

#### AI Interaction Tracking
- **ai_interactions** table: Logs every AI API call
  - Token usage: `input_tokens`, `output_tokens`, `total_tokens`
  - Cost tracking: `estimated_cost_usd`
  - Performance: `response_time_ms`
  - Success tracking: `was_successful`, `error_message`
  - Context: `session_id`, `student_id`, `feature_name`

#### AI Chat System (Existing)
- **ai_chat_conversations** table:
  - `session_id`, `user_id`, `student_id`
  - `feature_name` - which AI feature
  - `title` - conversation title

- **ai_chat_messages** table:
  - `conversation_id` (FK to conversations)
  - `role` - 'user', 'assistant', 'system'
  - `content` - message text
  - `tokens_used`

**Current Use**: These tables are used for teacher-facing AI features (student insights), not student-facing chat.

---

## Proposed Architecture: AI Chat Subscription

### Overview

Create a **subscription-based AI chat service** where students can:
- Chat with an AI teacher assistant anytime
- Subscribe monthly for unlimited/limited chat access
- Track usage and costs separately from human lessons
- Manage subscription via Stripe

### Database Schema Changes

#### 1. New Table: `ai_subscriptions`

```sql
CREATE TABLE public.ai_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Subscription details
  subscription_type TEXT NOT NULL CHECK (subscription_type IN ('basic', 'premium', 'unlimited')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'canceled', 'expired', 'past_due')),
  
  -- Limits
  monthly_message_limit INTEGER, -- NULL for unlimited
  messages_used_this_period INTEGER NOT NULL DEFAULT 0,
  
  -- Billing
  price_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
  
  -- Stripe integration
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  stripe_price_id TEXT,
  
  -- Dates
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL,
  canceled_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  
  CONSTRAINT messages_used_check CHECK (messages_used_this_period >= 0)
);

-- Indexes
CREATE INDEX idx_ai_subscriptions_student ON public.ai_subscriptions(student_id);
CREATE INDEX idx_ai_subscriptions_status ON public.ai_subscriptions(status);
CREATE INDEX idx_ai_subscriptions_stripe_sub ON public.ai_subscriptions(stripe_subscription_id);
CREATE INDEX idx_ai_subscriptions_period ON public.ai_subscriptions(current_period_end);
```

**Subscription Tiers Example**:
- **Basic**: $9.99/month, 100 messages
- **Premium**: $19.99/month, 500 messages
- **Unlimited**: $49.99/month, unlimited messages

#### 2. Extend: `ai_chat_conversations`

Add fields to distinguish conversation types and track voice sessions:

```sql
ALTER TABLE public.ai_chat_conversations
ADD COLUMN conversation_type TEXT NOT NULL DEFAULT 'teacher_insights' 
  CHECK (conversation_type IN ('teacher_insights', 'student_subscription', 'ai_lesson')),
ADD COLUMN is_voice_session BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN voice_session_duration INTEGER, -- seconds
ADD COLUMN ai_voice_id TEXT; -- ElevenLabs voice ID used

-- For subscription chats:
-- conversation_type = 'student_subscription'
-- user_id = student's user id
-- student_id = same as user_id (for consistency)
-- feature_name = 'ai_chat_subscription'
-- is_voice_session = true for voice conversations
```

#### 3. Reuse: `lesson_transcription_segments`

The existing transcription infrastructure will be reused for AI voice sessions:

```sql
-- EXISTING TABLE - No changes needed
-- lesson_transcription_segments already has:
-- - lesson_id (we'll create a "virtual lesson" for AI sessions)
-- - speaker_id (student's ID)
-- - speaker_role ('student' or 'ai_teacher')
-- - transcript (the actual text)
-- - start_time, end_time
-- - audio_file_path (stored in Supabase Storage)
```

**Approach**: Create a virtual "AI lesson" record for each voice conversation session to leverage existing transcription and analysis infrastructure.

#### 4. New Table: `ai_voice_sessions`

Link AI conversations to virtual lessons for transcription processing:

```sql
CREATE TABLE public.ai_voice_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ai_chat_conversations(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Virtual lesson for transcription storage
  virtual_lesson_id UUID REFERENCES public.lessons(id) ON DELETE SET NULL,
  
  -- Voice details
  total_duration_seconds INTEGER NOT NULL DEFAULT 0,
  student_speaking_time_seconds INTEGER NOT NULL DEFAULT 0,
  ai_speaking_time_seconds INTEGER NOT NULL DEFAULT 0,
  
  -- ElevenLabs usage
  elevenlabs_character_count INTEGER NOT NULL DEFAULT 0,
  elevenlabs_cost_cents INTEGER NOT NULL DEFAULT 0,
  ai_voice_id TEXT, -- Which ElevenLabs voice was used
  
  -- Session metadata
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  
  -- Analysis flags
  transcription_complete BOOLEAN NOT NULL DEFAULT false,
  vocabulary_processed BOOLEAN NOT NULL DEFAULT false,
  grammar_processed BOOLEAN NOT NULL DEFAULT false,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_voice_sessions_conversation ON public.ai_voice_sessions(conversation_id);
CREATE INDEX idx_ai_voice_sessions_student ON public.ai_voice_sessions(student_id);
CREATE INDEX idx_ai_voice_sessions_lesson ON public.ai_voice_sessions(virtual_lesson_id);
CREATE INDEX idx_ai_voice_sessions_started ON public.ai_voice_sessions(started_at DESC);
```

#### 5. New Table: `ai_subscription_usage_log`

Track message usage for billing and analytics:

```sql
CREATE TABLE public.ai_subscription_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.ai_subscriptions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Message details
  message_id UUID REFERENCES public.ai_chat_messages(id),
  conversation_id UUID REFERENCES public.ai_chat_conversations(id),
  
  -- Usage tracking
  tokens_used INTEGER NOT NULL DEFAULT 0,
  cost_cents INTEGER NOT NULL DEFAULT 0,
  
  -- Voice usage (if applicable)
  is_voice_message BOOLEAN NOT NULL DEFAULT false,
  elevenlabs_characters INTEGER DEFAULT 0,
  
  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Period tracking
  billing_period_start TIMESTAMPTZ NOT NULL,
  billing_period_end TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_ai_subscription_usage_subscription ON public.ai_subscription_usage_log(subscription_id);
CREATE INDEX idx_ai_subscription_usage_student ON public.ai_subscription_usage_log(student_id);
CREATE INDEX idx_ai_subscription_usage_period ON public.ai_subscription_usage_log(billing_period_start, billing_period_end);
```

#### 6. Reuse: `student_vocabulary` & Related Tables

The existing vocabulary and grammar tracking system will automatically work with AI voice sessions:

```sql
-- EXISTING TABLES - No changes needed
-- student_vocabulary - tracks words learned/encountered
-- vocabulary_reviews - spaced repetition system
-- student_goals - learning objectives
-- student_grammar_topics - grammar concepts covered
```

**Integration**: Once transcription segments are stored in `lesson_transcription_segments` with the virtual `lesson_id`, the existing Edge Functions will process them:
- `process-completed-lessons` - extracts vocabulary and grammar
- Vocabulary gets added to student's personal dictionary
- Grammar topics get tracked for progress
- Spaced repetition reviews get scheduled

#### 7. New Table: `ai_subscription_plans`

Define available subscription plans:

```sql
CREATE TABLE public.ai_subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Plan details
  plan_name TEXT NOT NULL UNIQUE,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('basic', 'premium', 'unlimited')),
  description TEXT,
  
  -- Limits
  monthly_message_limit INTEGER, -- NULL for unlimited
  daily_message_limit INTEGER,   -- Optional daily cap
  
  -- Pricing
  price_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  
  -- Stripe
  stripe_price_id TEXT NOT NULL UNIQUE,
  stripe_product_id TEXT,
  
  -- Features (JSONB for flexibility)
  features JSONB DEFAULT '[]'::jsonb,
  -- e.g. ["Unlimited messages", "Priority response", "Custom AI personality"]
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sample data
INSERT INTO public.ai_subscription_plans (plan_name, plan_type, monthly_message_limit, price_cents, stripe_price_id, features)
VALUES 
  ('Basic', 'basic', 100, 999, 'price_basic_monthly', '["100 text messages/month", "24/7 availability", "Basic AI tutor", "Text-only"]'),
  ('Premium', 'premium', 500, 1999, 'price_premium_monthly', '["500 text messages/month", "Priority support", "Advanced AI tutor", "Conversation history", "Text-only"]'),
  ('Unlimited Text', 'unlimited', NULL, 4999, 'price_unlimited_text_monthly', '["Unlimited text messages", "Priority support", "Advanced AI tutor", "Full history", "Custom learning plans"]'),
  ('Basic Plus', 'basic', 100, 1499, 'price_basic_plus_monthly', '["100 messages/month", "Voice conversation", "Real-time transcription", "Vocabulary tracking", "Grammar analysis"]'),
  ('Premium Plus', 'premium', 500, 2999, 'price_premium_plus_monthly', '["500 messages/month", "Voice conversation", "Advanced transcription", "Full vocabulary tracking", "Pronunciation feedback"]'),
  ('Unlimited Plus', 'unlimited', NULL, 6999, 'price_unlimited_plus_monthly', '["Unlimited messages", "Voice conversation", "Advanced AI tutor", "Full analysis suite", "Priority voice processing", "Custom AI voice"]');
```

#### 8. New Table: `ai_agent_configs`

Store personalized AI agent configurations for each student:

```sql
CREATE TABLE public.ai_agent_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Configuration
  system_prompt TEXT NOT NULL,
  learning_goals TEXT[] NOT NULL, -- ['career', 'travel', etc.]
  interests TEXT[] NOT NULL,
  
  -- Voice preferences
  preferred_voice_id TEXT,
  speaking_rate DECIMAL(3,2) DEFAULT 1.0,
  
  -- Teaching style
  correction_style TEXT CHECK (correction_style IN ('gentle', 'balanced', 'strict')) DEFAULT 'balanced',
  formality_level TEXT CHECK (formality_level IN ('casual', 'professional', 'academic')) DEFAULT 'casual',
  
  -- Scenario settings
  active_scenarios JSONB DEFAULT '[]'::jsonb,
  -- e.g. [{"type": "career", "theme": "interview_practice", "context": {...}}]
  
  -- MCP settings
  mcp_enabled BOOLEAN NOT NULL DEFAULT true,
  mcp_tools_allowed TEXT[] DEFAULT ARRAY['get_student_profile', 'get_student_vocabulary', 'get_student_grammar_topics', 'get_recent_lessons'],
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  
  -- Ensure one active config per student
  CONSTRAINT unique_active_config UNIQUE (student_id, is_active)
);

CREATE INDEX idx_ai_agent_configs_student ON public.ai_agent_configs(student_id);
CREATE INDEX idx_ai_agent_configs_active ON public.ai_agent_configs(is_active) WHERE is_active = true;
```

#### 9. Extend: `profiles` Table

Add AI-related fields to existing profiles:

```sql
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS ai_onboarding_completed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_voice_preference TEXT,
ADD COLUMN IF NOT EXISTS ai_correction_style TEXT CHECK (ai_correction_style IN ('gentle', 'balanced', 'strict')) DEFAULT 'balanced',
ADD COLUMN IF NOT EXISTS interests TEXT; -- Comma-separated list
```

### Row Level Security (RLS)

```sql
-- ai_subscriptions
ALTER TABLE public.ai_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view their own subscriptions"
ON public.ai_subscriptions FOR SELECT
USING (student_id = auth.uid());

CREATE POLICY "Students can update their own subscriptions"
ON public.ai_subscriptions FOR UPDATE
USING (student_id = auth.uid());

-- Admins can view/update all
CREATE POLICY "Admins can manage all subscriptions"
ON public.ai_subscriptions FOR ALL
USING (public.is_admin());

-- ai_subscription_usage_log
ALTER TABLE public.ai_subscription_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view their own usage"
ON public.ai_subscription_usage_log FOR SELECT
USING (student_id = auth.uid());

CREATE POLICY "System can insert usage logs"
ON public.ai_subscription_usage_log FOR INSERT
WITH CHECK (true); -- System service will insert

-- ai_subscription_plans
ALTER TABLE public.ai_subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active plans"
ON public.ai_subscription_plans FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage plans"
ON public.ai_subscription_plans FOR ALL
USING (public.is_admin());

-- ai_chat_conversations (extend existing policies)
-- Students can view/create their own subscription conversations
CREATE POLICY "Students can manage subscription conversations"
ON public.ai_chat_conversations FOR ALL
USING (
  conversation_type = 'student_subscription' 
  AND user_id = auth.uid()
);

-- ai_agent_configs
ALTER TABLE public.ai_agent_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view their own agent configs"
ON public.ai_agent_configs FOR SELECT
USING (student_id = auth.uid());

CREATE POLICY "Students can update their own agent configs"
ON public.ai_agent_configs FOR UPDATE
USING (student_id = auth.uid());

CREATE POLICY "Students can insert their own agent configs"
ON public.ai_agent_configs FOR INSERT
WITH CHECK (student_id = auth.uid());

CREATE POLICY "Admins can manage all agent configs"
ON public.ai_agent_configs FOR ALL
USING (public.is_admin());
```

### Database Functions

#### 1. Check Subscription Access

```sql
CREATE OR REPLACE FUNCTION public.check_ai_subscription_access(
  p_student_id UUID
)
RETURNS TABLE(
  has_subscription BOOLEAN,
  subscription_status TEXT,
  can_send_message BOOLEAN,
  messages_remaining INTEGER,
  reset_date TIMESTAMPTZ,
  subscription_id UUID
) AS $$
DECLARE
  v_sub RECORD;
  v_messages_used INTEGER;
  v_limit INTEGER;
BEGIN
  -- Get active subscription
  SELECT * INTO v_sub
  FROM public.ai_subscriptions
  WHERE student_id = p_student_id
    AND status = 'active'
    AND current_period_end > NOW()
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- No active subscription
  IF v_sub IS NULL THEN
    RETURN QUERY SELECT 
      false, 
      'none'::TEXT, 
      false, 
      0, 
      NULL::TIMESTAMPTZ,
      NULL::UUID;
    RETURN;
  END IF;
  
  -- Check message limit
  v_messages_used := v_sub.messages_used_this_period;
  v_limit := v_sub.monthly_message_limit;
  
  -- Unlimited plan
  IF v_limit IS NULL THEN
    RETURN QUERY SELECT 
      true,
      v_sub.status::TEXT,
      true,
      -1, -- -1 indicates unlimited
      v_sub.current_period_end,
      v_sub.id;
    RETURN;
  END IF;
  
  -- Limited plan
  RETURN QUERY SELECT 
    true,
    v_sub.status::TEXT,
    v_messages_used < v_limit,
    GREATEST(0, v_limit - v_messages_used),
    v_sub.current_period_end,
    v_sub.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### 2. Log Subscription Message

```sql
CREATE OR REPLACE FUNCTION public.log_ai_subscription_message(
  p_subscription_id UUID,
  p_student_id UUID,
  p_message_id UUID,
  p_conversation_id UUID,
  p_tokens_used INTEGER,
  p_cost_cents INTEGER
)
RETURNS VOID AS $$
DECLARE
  v_sub RECORD;
BEGIN
  -- Get subscription details
  SELECT * INTO v_sub
  FROM public.ai_subscriptions
  WHERE id = p_subscription_id;
  
  -- Insert usage log
  INSERT INTO public.ai_subscription_usage_log (
    subscription_id,
    student_id,
    message_id,
    conversation_id,
    tokens_used,
    cost_cents,
    billing_period_start,
    billing_period_end
  ) VALUES (
    p_subscription_id,
    p_student_id,
    p_message_id,
    p_conversation_id,
    p_tokens_used,
    p_cost_cents,
    v_sub.current_period_start,
    v_sub.current_period_end
  );
  
  -- Increment messages used
  UPDATE public.ai_subscriptions
  SET 
    messages_used_this_period = messages_used_this_period + 1,
    updated_at = NOW()
  WHERE id = p_subscription_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### 3. Reset Subscription Period

```sql
CREATE OR REPLACE FUNCTION public.reset_ai_subscription_period(
  p_subscription_id UUID,
  p_new_period_start TIMESTAMPTZ,
  p_new_period_end TIMESTAMPTZ
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.ai_subscriptions
  SET 
    messages_used_this_period = 0,
    current_period_start = p_new_period_start,
    current_period_end = p_new_period_end,
    updated_at = NOW()
  WHERE id = p_subscription_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Voice Interaction Architecture

### Overview

Voice interaction transforms the AI chat subscription into a virtual language tutoring experience, mimicking real teacher-student lessons. Students can speak naturally, hear AI responses in a natural voice, and have their conversations automatically transcribed and analyzed for vocabulary and grammar learning.

### Technology Stack

#### ElevenLabs Conversational AI (Primary Solution)
**Complete Voice Agent Platform**
- ✅ End-to-end speech-to-speech conversations (no stitching required)
- ✅ Sub-100ms latency for natural real-time conversations
- ✅ Automatic transcription included (both student and AI)
- ✅ Most natural-sounding AI voices available
- ✅ Handles interruptions automatically
- ✅ Supports 32+ languages with native accents
- ✅ WebSocket connection for streaming audio
- ✅ Custom knowledge base and conversation flows
- ✅ Built-in conversation analytics and testing tools
- 💰 Pricing: Usage-based, ~$0.30/1K characters output

**Why ElevenLabs Conversational AI?**
1. **Purpose-Built for Voice Agents**: Designed specifically for conversational AI applications
2. **Superior Voice Quality**: Industry-leading natural voice synthesis
3. **Built-in Transcription**: Automatic transcripts for both student and AI speech accessible via API
4. **Low Latency**: Sub-100ms response time for natural conversation flow
5. **Interruption Handling**: Natural barge-in capabilities for realistic conversations
6. **Language Learning Focus**: Used by Speak and other language learning apps
7. **Simple Integration**: Single API for entire voice conversation stack
8. **Multimodal**: Supports voice and text inputs/outputs

#### Audio Storage
**Supabase Storage**
- Store audio segments in `voice-sessions` bucket
- Path structure: `{student_id}/{session_id}/{segment_id}.mp3`
- ElevenLabs provides audio data and transcripts via WebSocket events
- Reuse existing storage policies and structure

#### Connection Methods
**WebSocket** (Primary)
- ElevenLabs Conversational AI uses WebSocket for bidirectional streaming
- Send audio chunks as student speaks
- Receive AI audio responses and transcriptions in real-time
- Handle conversation state and turn management
- Built-in support for interruptions and barge-ins

**REST API** (Alternative for async)
- Submit complete audio files for processing
- Good for recorded sessions or batch processing
- Get complete transcripts and responses

### Database Schema Extensions

Already covered in previous sections:
- ✅ `ai_voice_sessions` - tracks voice session metadata
- ✅ `ai_chat_conversations.is_voice_session` - flags voice conversations
- ✅ Reuses `lesson_transcription_segments` - stores all transcripts
- ✅ Reuses `lessons` - creates virtual lesson records for analysis

### Voice Session Flow

#### 1. Starting a Voice Session with ElevenLabs

```typescript
// Frontend: Initialize ElevenLabs Conversational AI
const startVoiceSession = async () => {
  // 1. Check subscription access
  const access = await checkSubscriptionAccess();
  if (!access.can_send_message) {
    throw new Error('Message limit reached');
  }
  
  // 2. Create conversation (or reuse existing)
  const { data: conversation } = await supabase
    .from('ai_chat_conversations')
    .insert({
      user_id: studentId,
      student_id: studentId,
      conversation_type: 'student_subscription',
      feature_name: 'ai_chat_subscription',
      is_voice_session: true,
      title: 'Voice Chat ' + new Date().toLocaleString()
    })
    .select()
    .single();
  
  // 3. Create virtual lesson for transcription storage
  const { data: virtualLesson } = await supabase
    .from('lessons')
    .insert({
      teacher_id: AI_TEACHER_ID, // Special UUID for AI teacher
      student_id: studentId,
      starts_at: new Date().toISOString(),
      ends_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours max
      title: 'AI Voice Session',
      status: 'scheduled',
      is_free_lesson: true // Not charged as regular lesson
    })
    .select()
    .single();
  
  // 4. Create voice session record
  const { data: voiceSession } = await supabase
    .from('ai_voice_sessions')
    .insert({
      conversation_id: conversation.id,
      student_id: studentId,
      virtual_lesson_id: virtualLesson.id,
      ai_voice_id: selectedVoiceId // User's chosen ElevenLabs voice
    })
    .select()
    .single();
  
  // 5. Get ElevenLabs signed URL from backend
  const { data: signedUrl } = await supabase.functions.invoke(
    'elevenlabs-conversation-init',
    { body: { voiceSessionId: voiceSession.id, agentId: ELEVENLABS_AGENT_ID } }
  );
  
  // 6. Connect to ElevenLabs WebSocket
  const ws = new WebSocket(signedUrl.url);
  const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  
  return { conversation, voiceSession, ws, mediaStream };
};
```

#### 2. Real-Time Audio Streaming with ElevenLabs

```typescript
// Frontend: Handle WebSocket connection with ElevenLabs
const handleElevenLabsConnection = (ws: WebSocket, mediaStream: MediaStream) => {
  const audioContext = new AudioContext({ sampleRate: 16000 });
  const source = audioContext.createMediaStreamSource(mediaStream);
  const processor = audioContext.createScriptProcessor(4096, 1, 1);
  
  // Send student audio to ElevenLabs
  processor.onaudioprocess = (event) => {
    const inputData = event.inputBuffer.getChannelData(0);
    const pcm16 = convertFloat32ToPCM16(inputData);
    
    ws.send(JSON.stringify({
      type: 'audio',
      audio: base64Encode(pcm16)
    }));
  };
  
  source.connect(processor);
  processor.connect(audioContext.destination);
  
  // Receive AI responses from ElevenLabs
  ws.onmessage = async (event) => {
    const message = JSON.parse(event.data);
    
    switch (message.type) {
      case 'audio':
        // Play AI voice response
        await playAudioChunk(base64Decode(message.audio));
        break;
        
      case 'transcript':
        // Handle transcription (both student and AI)
        await handleTranscript(message);
        break;
        
      case 'metadata':
        // Track conversation metadata
        updateConversationState(message);
        break;
        
      case 'interruption':
        // Handle when student interrupts AI
        stopCurrentPlayback();
        break;
    }
  };
};

const handleTranscript = async (message: any) => {
  const { speaker, text, timestamp, audio_url } = message;
  
  // Store in database
  await supabase
    .from('lesson_transcription_segments')
    .insert({
      lesson_id: virtualLessonId,
      speaker_id: speaker === 'user' ? studentId : AI_TEACHER_ID,
      speaker_role: speaker === 'user' ? 'student' : 'teacher',
      transcript: text,
      start_time: timestamp,
      end_time: timestamp + estimateDuration(text),
      audio_file_path: audio_url // ElevenLabs provides audio URLs
    });
  
  // Save to chat messages
  await supabase
    .from('ai_chat_messages')
    .insert({
      conversation_id: conversationId,
      role: speaker === 'user' ? 'user' : 'assistant',
      content: text
    });
  
  // Update UI
  setTranscript(prev => [...prev, { speaker, text, timestamp }]);
};
```

#### 3. Backend: ElevenLabs Agent Configuration

```typescript
// Backend: Edge Function - elevenlabs-conversation-init
export default async function handler(req: Request) {
  const { voiceSessionId, agentId } = await req.json();
  
  // Get voice session details
  const { data: session } = await supabase
    .from('ai_voice_sessions')
    .select('*, student:profiles!inner(*)')
    .eq('id', voiceSessionId)
    .single();
  
  // Configure ElevenLabs agent with custom instructions
  const agentConfig = {
    agent_id: agentId,
    custom_llm_extra_body: {
      // System prompt for language teaching
      system_prompt: `You are a friendly English teacher named Alex. 
        Student level: ${session.student.cefr_level}
        Native language: ${session.student.native_language}
        Learning goals: ${session.student.learning_goals}
        
        Instructions:
        - Speak clearly and naturally at an appropriate pace for their level
        - Correct errors gently and provide better alternatives
        - Ask follow-up questions to encourage conversation
        - Introduce new vocabulary contextually
        - Keep responses conversational (2-4 sentences)
        - Be encouraging and supportive`,
      
      // Conversation settings
      temperature: 0.7,
      max_tokens: 150
    },
    
    // Voice settings based on student level
    voice_settings: getVoiceSettingsForLevel(session.student.cefr_level),
    
    // Metadata for tracking
    metadata: {
      student_id: session.student_id,
      voice_session_id: voiceSessionId,
      virtual_lesson_id: session.virtual_lesson_id
    }
  };
  
  // Get signed WebSocket URL from ElevenLabs
  const response = await fetch('https://api.elevenlabs.io/v1/convai/conversation', {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(agentConfig)
  });
  
  const { signed_url } = await response.json();
  
  return new Response(JSON.stringify({ url: signed_url }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

const getVoiceSettingsForLevel = (level: string) => {
  const settings = {
    'A1': { stability: 0.8, similarity_boost: 0.7, speaking_rate: 0.85 },
    'A2': { stability: 0.7, similarity_boost: 0.75, speaking_rate: 0.9 },
    'B1': { stability: 0.6, similarity_boost: 0.8, speaking_rate: 0.95 },
    'B2': { stability: 0.5, similarity_boost: 0.8, speaking_rate: 1.0 },
    'C1': { stability: 0.5, similarity_boost: 0.85, speaking_rate: 1.05 },
    'C2': { stability: 0.4, similarity_boost: 0.85, speaking_rate: 1.1 }
  };
  return settings[level] || settings['B1'];
};
```

#### 4. Ending Voice Session & Analysis

```typescript
const endVoiceSession = async () => {
  // 1. Close WebSocket connection
  ws.close();
  
  // 2. Get final conversation metadata from ElevenLabs
  const { data: conversationData } = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`,
    {
      headers: { 'xi-api-key': ELEVENLABS_API_KEY }
    }
  ).then(r => r.json());
  
  // 3. Update lesson status
  await supabase
    .from('lessons')
    .update({
      status: 'completed',
      ends_at: new Date().toISOString()
    })
    .eq('id', virtualLessonId);
  
  // 4. Update voice session with final metrics
  await supabase
    .from('ai_voice_sessions')
    .update({
      ended_at: new Date().toISOString(),
      total_duration_seconds: conversationData.duration_seconds,
      student_speaking_time_seconds: conversationData.user_speaking_time,
      ai_speaking_time_seconds: conversationData.agent_speaking_time,
      elevenlabs_character_count: conversationData.total_characters,
      elevenlabs_cost_cents: Math.ceil(conversationData.total_characters * 0.03),
      transcription_complete: true
    })
    .eq('id', voiceSessionId);
  
  // 5. Trigger vocabulary and grammar processing
  await supabase.functions.invoke('process-completed-lessons', {
    body: { lessonId: virtualLessonId }
  });
  
  // This will:
  // - Extract vocabulary from transcripts (already stored during conversation)
  // - Identify grammar patterns
  // - Add words to student's dictionary
  // - Schedule spaced repetition reviews
  // - Update student progress metrics
};
```

### Frontend Components

#### Mobile-First Design Philosophy

**Design Inspiration**: Clean, modern UI similar to Voxle AI assistant
- **Mobile-first**: Optimized for touch interactions
- **Minimalist**: Focus on conversation, minimal chrome
- **Responsive**: Adapts seamlessly from mobile to desktop
- **Accessible**: Large touch targets, clear typography
- **Voice-centric**: Prominent voice button, waveform feedback

#### 1. Main AI Chat Home Screen

**`src/pages/AIChatHome.tsx`**

```typescript
export function AIChatHome() {
  const { profile } = useProfile();
  const { subscription } = useAISubscription();
  const [conversationStarters, setConversationStarters] = useState([]);
  
  return (
    <div className="ai-chat-home min-h-screen bg-gray-50 pb-safe">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <button className="p-2 -ml-2">
            <Menu className="w-6 h-6" />
          </button>
          <button className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full text-sm font-medium">
            ✨ Upgrade
          </button>
          <Avatar className="w-10 h-10">
            <AvatarImage src={profile.avatar_url} />
            <AvatarFallback>{profile.display_name?.[0]}</AvatarFallback>
          </Avatar>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="px-4 py-8 max-w-4xl mx-auto">
        {/* Greeting */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            Good to see you,
            <br />
            <span className="text-gray-500">{profile.display_name}.</span>
          </h1>
          <p className="text-gray-600 text-sm md:text-base">
            Your personal AI English teacher for any conversation
            <br />
            you can imagine.
          </p>
        </div>
        
        {/* Learning Scenario Pills */}
        <div className="flex flex-wrap gap-2 justify-center mb-8">
          {profile.learning_goals?.map(goal => (
            <button
              key={goal}
              onClick={() => startScenario(goal)}
              className="px-4 py-2 bg-white rounded-full border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors flex items-center gap-2 text-sm"
            >
              <span className="text-lg">{SCENARIO_ICONS[goal]}</span>
              <span className="font-medium">{SCENARIO_NAMES[goal]}</span>
            </button>
          ))}
        </div>
        
        {/* Conversation Starters */}
        <div className="space-y-3 mb-24">
          {conversationStarters.map((starter, idx) => (
            <button
              key={idx}
              onClick={() => startConversation(starter.message)}
              className="w-full p-4 bg-white rounded-2xl border border-gray-200 hover:border-blue-500 hover:shadow-md transition-all text-left"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{starter.icon}</span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 mb-1">
                    {starter.title}
                  </h3>
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {starter.description}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
              </div>
            </button>
          ))}
        </div>
      </main>
      
      {/* Bottom Input Bar - Fixed */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 pb-safe">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 bg-gray-100 rounded-full px-4 py-3">
            <button className="p-1 hover:bg-gray-200 rounded-full transition-colors">
              <Plus className="w-5 h-5 text-gray-600" />
            </button>
            
            <input
              type="text"
              placeholder="How can I help you today?"
              className="flex-1 bg-transparent outline-none text-gray-900 placeholder:text-gray-500"
              onFocus={() => navigate('/ai-chat/conversation')}
            />
            
            <button className="p-1 hover:bg-gray-200 rounded-full transition-colors">
              <Sparkles className="w-5 h-5 text-gray-600" />
            </button>
            
            <button className="p-1 hover:bg-gray-200 rounded-full transition-colors">
              <Mic className="w-5 h-5 text-gray-600" />
            </button>
            
            <button 
              onClick={() => navigate('/ai-chat/voice')}
              className="px-6 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full font-medium hover:shadow-lg transition-all flex items-center gap-2"
            >
              <AudioWaveform className="w-4 h-4" />
              <span>Talk</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const SCENARIO_ICONS = {
  career: '💼',
  travel: '✈️',
  academic: '🎓',
  conversation: '💬',
  test_prep: '📝',
  kids: '🎨'
};

const SCENARIO_NAMES = {
  career: 'Career',
  travel: 'Travel',
  academic: 'Academic',
  conversation: 'Chat',
  test_prep: 'Test Prep',
  kids: 'Kids'
};
```

#### 2. Voice Chat Interface (Mobile-Optimized)

**`src/pages/AIChatVoice.tsx`**

```typescript
export function AIChatVoice() {
  const [isRecording, setIsRecording] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  
  return (
    <div className="ai-voice-chat h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col">
      {/* Header */}
      <header className="px-4 py-3 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-medium text-gray-700">
            {formatDuration(sessionDuration)}
          </span>
        </div>
        <button className="p-2 -mr-2">
          <MoreVertical className="w-6 h-6" />
        </button>
      </header>
      
      {/* AI Avatar / Waveform Visualization */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="text-center">
          {/* AI Avatar */}
          <div className={cn(
            "w-32 h-32 mx-auto mb-6 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center shadow-2xl transition-transform",
            isAISpeaking && "scale-110 animate-pulse"
          )}>
            <div className="text-6xl">
              {isAISpeaking ? '🗣️' : '👋'}
            </div>
          </div>
          
          {/* Status Text */}
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {isRecording ? 'Listening...' : 
             isAISpeaking ? 'Speaking...' : 
             'Ready to chat!'}
          </h2>
          <p className="text-sm text-gray-600">
            {isRecording ? 'Go ahead, I\'m listening' :
             isAISpeaking ? 'Just a moment...' :
             'Tap the button to start talking'}
          </p>
          
          {/* Real-time Waveform */}
          {(isRecording || isAISpeaking) && (
            <div className="mt-8 flex items-center justify-center gap-1 h-16">
              {waveformData.map((height, i) => (
                <div
                  key={i}
                  className="w-1 bg-blue-500 rounded-full transition-all"
                  style={{ 
                    height: `${height * 100}%`,
                    opacity: isRecording ? 1 : 0.5
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Transcript Display (Scrollable) */}
      <div className="max-h-48 overflow-y-auto px-4 mb-4 space-y-3">
        {transcript.slice(-5).map((segment, idx) => (
          <div
            key={idx}
            className={cn(
              "flex gap-2",
              segment.speaker === 'student' ? 'justify-end' : 'justify-start'
            )}
          >
            <div
              className={cn(
                "max-w-[80%] px-4 py-2 rounded-2xl",
                segment.speaker === 'student'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-900'
              )}
            >
              <p className="text-sm">{segment.text}</p>
            </div>
          </div>
        ))}
      </div>
      
      {/* Bottom Controls */}
      <div className="px-4 pb-8 pb-safe">
        <div className="flex items-center justify-center gap-6">
          {/* Secondary Actions */}
          <button 
            className="p-4 bg-white rounded-full shadow-lg"
            onClick={toggleMute}
          >
            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>
          
          {/* Main Voice Button */}
          <button
            className={cn(
              "w-20 h-20 rounded-full flex items-center justify-center shadow-2xl transition-all",
              isRecording
                ? "bg-red-500 scale-110"
                : "bg-gradient-to-br from-blue-500 to-purple-500 hover:scale-105"
            )}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            onClick={toggleRecording}
          >
            {isRecording ? (
              <Square className="w-8 h-8 text-white" />
            ) : (
              <AudioWaveform className="w-8 h-8 text-white" />
            )}
          </button>
          
          {/* End Session */}
          <button 
            className="p-4 bg-white rounded-full shadow-lg"
            onClick={endSession}
          >
            <X className="w-6 h-6 text-red-500" />
          </button>
        </div>
        
        <p className="text-center text-xs text-gray-500 mt-4">
          {isRecording ? 'Release to send' : 'Hold to speak'}
        </p>
      </div>
    </div>
  );
}
```

#### 3. Text Chat Interface (Mobile-Optimized)

**`src/pages/AIChatConversation.tsx`**

```typescript
export function AIChatConversation() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  return (
    <div className="ai-text-chat h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
              <span className="text-xl">🤖</span>
            </div>
            <div className="flex-1">
              <h1 className="font-semibold text-gray-900">AI Teacher</h1>
              <p className="text-xs text-gray-500">
                {isTyping ? 'Typing...' : 'Online'}
              </p>
            </div>
          </div>
          <button className="p-2 -mr-2">
            <MoreVertical className="w-6 h-6" />
          </button>
        </div>
      </header>
      
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.map((message, idx) => (
          <div
            key={idx}
            className={cn(
              "flex gap-2",
              message.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            {/* AI Avatar */}
            {message.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center flex-shrink-0">
                <span className="text-sm">🤖</span>
              </div>
            )}
            
            {/* Message Bubble */}
            <div
              className={cn(
                "max-w-[75%] rounded-2xl px-4 py-3",
                message.role === 'user'
                  ? 'bg-blue-500 text-white rounded-br-sm'
                  : 'bg-gray-100 text-gray-900 rounded-bl-sm'
              )}
            >
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {message.content}
              </p>
              
              {/* Corrections (if any) */}
              {message.corrections && message.corrections.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  {message.corrections.map((correction, i) => (
                    <div key={i} className="text-xs text-gray-600 mb-1">
                      <span className="line-through">{correction.original}</span>
                      {' → '}
                      <span className="font-medium text-green-600">
                        {correction.corrected}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Timestamp */}
              <p className={cn(
                "text-xs mt-1",
                message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
              )}>
                {formatTime(message.created_at)}
              </p>
            </div>
            
            {/* Student Avatar */}
            {message.role === 'user' && (
              <Avatar className="w-8 h-8 flex-shrink-0">
                <AvatarImage src={profile.avatar_url} />
                <AvatarFallback>{profile.display_name?.[0]}</AvatarFallback>
              </Avatar>
            )}
          </div>
        ))}
        
        {/* Typing Indicator */}
        {isTyping && (
          <div className="flex gap-2 justify-start">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
              <span className="text-sm">🤖</span>
            </div>
            <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input Bar - Fixed Bottom */}
      <div className="border-t border-gray-200 px-4 py-3 pb-safe bg-white">
        <div className="flex items-end gap-2">
          <button className="p-2 hover:bg-gray-100 rounded-full">
            <Plus className="w-6 h-6 text-gray-600" />
          </button>
          
          <div className="flex-1 flex items-end bg-gray-100 rounded-3xl px-4 py-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Type your message..."
              className="flex-1 bg-transparent outline-none resize-none max-h-32 text-gray-900 placeholder:text-gray-500"
              rows={1}
              style={{ minHeight: '24px' }}
            />
            
            <button className="p-1 hover:bg-gray-200 rounded-full ml-2">
              <Sparkles className="w-5 h-5 text-gray-600" />
            </button>
          </div>
          
          <button
            onClick={() => navigate('/ai-chat/voice')}
            className="p-3 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
          >
            <Mic className="w-6 h-6 text-gray-600" />
          </button>
          
          {input.trim() ? (
            <button
              onClick={sendMessage}
              className="p-3 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full hover:shadow-lg transition-all"
            >
              <Send className="w-6 h-6 text-white" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
```

#### 4. Onboarding Screens (Mobile-Optimized)

**`src/pages/AIOnboarding/GoalsScreen.tsx`**

```typescript
export function GoalsScreen() {
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  
  const learningGoals = [
    {
      id: 'career',
      title: 'Career & Business',
      description: 'Workplace communication',
      icon: '💼',
      gradient: 'from-blue-400 to-blue-600'
    },
    {
      id: 'travel',
      title: 'Travel & Culture',
      description: 'Communicate while traveling',
      icon: '✈️',
      gradient: 'from-purple-400 to-purple-600'
    },
    {
      id: 'academic',
      title: 'Academic Success',
      description: 'University & research',
      icon: '🎓',
      gradient: 'from-green-400 to-green-600'
    },
    {
      id: 'conversation',
      title: 'Fluent Conversations',
      description: 'Natural everyday chat',
      icon: '💬',
      gradient: 'from-pink-400 to-pink-600'
    },
    {
      id: 'test_prep',
      title: 'Test Preparation',
      description: 'IELTS, TOEFL, Cambridge',
      icon: '📝',
      gradient: 'from-orange-400 to-orange-600'
    },
    {
      id: 'kids',
      title: 'Kids Learning',
      description: 'Fun for young learners',
      icon: '🎨',
      gradient: 'from-yellow-400 to-yellow-600'
    }
  ];
  
  return (
    <div className="onboarding-screen min-h-screen bg-white flex flex-col">
      {/* Progress Indicator */}
      <div className="px-4 py-6">
        <div className="flex gap-1.5 mb-4">
          <div className="h-1 flex-1 bg-blue-500 rounded-full" />
          <div className="h-1 flex-1 bg-gray-200 rounded-full" />
          <div className="h-1 flex-1 bg-gray-200 rounded-full" />
        </div>
        <p className="text-sm text-gray-500">Step 1 of 3</p>
      </div>
      
      {/* Content */}
      <div className="flex-1 px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">
          What are your<br />learning goals?
        </h1>
        <p className="text-gray-600 mb-8">
          Select one or more to personalize your AI teacher
        </p>
        
        {/* Goals Grid */}
        <div className="grid grid-cols-2 gap-3">
          {learningGoals.map(goal => (
            <button
              key={goal.id}
              onClick={() => toggleGoal(goal.id)}
              className={cn(
                "relative p-4 rounded-2xl border-2 transition-all text-left",
                selectedGoals.includes(goal.id)
                  ? 'border-blue-500 bg-blue-50 shadow-lg scale-95'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              )}
            >
              {/* Checkmark */}
              {selectedGoals.includes(goal.id) && (
                <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
              
              {/* Icon */}
              <div className={cn(
                "w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center mb-3",
                goal.gradient
              )}>
                <span className="text-2xl">{goal.icon}</span>
              </div>
              
              {/* Text */}
              <h3 className="font-semibold text-gray-900 text-sm mb-1">
                {goal.title}
              </h3>
              <p className="text-xs text-gray-500">
                {goal.description}
              </p>
            </button>
          ))}
        </div>
      </div>
      
      {/* Bottom Button */}
      <div className="px-4 pb-8 pb-safe">
        <Button
          onClick={() => saveAndContinue(selectedGoals)}
          disabled={selectedGoals.length === 0}
          size="lg"
          className="w-full py-6 text-lg rounded-2xl"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
```

#### 5. Subscription Plans (Mobile-Optimized)

**`src/pages/AISubscriptionPlans.tsx`**

```typescript
export function AISubscriptionPlans() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  
  const plans = [
    {
      id: 'basic',
      name: 'Basic',
      price: billingCycle === 'monthly' ? 9.99 : 99,
      messages: 100,
      features: ['100 text messages/month', '24/7 availability', 'Basic AI tutor'],
      popular: false
    },
    {
      id: 'premium',
      name: 'Premium Plus',
      price: billingCycle === 'monthly' ? 29.99 : 299,
      messages: 500,
      features: ['500 messages/month', 'Voice conversation', 'Vocabulary tracking', 'Grammar analysis'],
      popular: true
    },
    {
      id: 'unlimited',
      name: 'Unlimited Plus',
      price: billingCycle === 'monthly' ? 69.99 : 699,
      messages: null,
      features: ['Unlimited messages', 'Voice conversation', 'Priority processing', 'Custom AI voice'],
      popular: false
    }
  ];
  
  return (
    <div className="subscription-plans min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white px-4 py-4 border-b border-gray-200">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2">
          <ArrowLeft className="w-6 h-6" />
        </button>
      </header>
      
      <div className="px-4 py-6 max-w-4xl mx-auto">
        {/* Title */}
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Choose your plan
        </h1>
        <p className="text-gray-600 mb-6">
          Start learning with AI today
        </p>
        
        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={cn(
              "px-6 py-3 rounded-full font-medium transition-all",
              billingCycle === 'monthly'
                ? 'bg-blue-500 text-white shadow-lg'
                : 'bg-white text-gray-600'
            )}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle('yearly')}
            className={cn(
              "px-6 py-3 rounded-full font-medium transition-all relative",
              billingCycle === 'yearly'
                ? 'bg-blue-500 text-white shadow-lg'
                : 'bg-white text-gray-600'
            )}
          >
            Yearly
            <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-green-500 text-white text-xs rounded-full">
              Save 20%
            </span>
          </button>
        </div>
        
        {/* Plans */}
        <div className="space-y-4">
          {plans.map(plan => (
            <div
              key={plan.id}
              className={cn(
                "relative bg-white rounded-3xl p-6 border-2 transition-all",
                selectedPlan === plan.id
                  ? 'border-blue-500 shadow-xl'
                  : 'border-gray-200',
                plan.popular && 'ring-2 ring-blue-500 ring-offset-2'
              )}
            >
              {/* Popular Badge */}
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs font-bold rounded-full">
                  MOST POPULAR
                </div>
              )}
              
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-1">
                    {plan.name}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {plan.messages ? `${plan.messages} messages` : 'Unlimited'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-gray-900">
                    ${plan.price}
                  </p>
                  <p className="text-sm text-gray-500">
                    /{billingCycle === 'monthly' ? 'month' : 'year'}
                  </p>
                </div>
              </div>
              
              {/* Features */}
              <ul className="space-y-2 mb-6">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              
              {/* Select Button */}
              <Button
                onClick={() => selectPlan(plan.id)}
                className={cn(
                  "w-full py-3 rounded-xl font-medium transition-all",
                  selectedPlan === plan.id || plan.popular
                    ? 'bg-gradient-to-r from-blue-500 to-purple-500 hover:shadow-lg'
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                )}
              >
                {selectedPlan === plan.id ? 'Selected' : 'Select Plan'}
              </Button>
            </div>
          ))}
        </div>
        
        {/* Trust Badges */}
        <div className="mt-8 text-center space-y-2">
          <p className="text-sm text-gray-500">
            ✓ Cancel anytime · ✓ No commitments · ✓ Secure payment
          </p>
        </div>
      </div>
    </div>
  );
}
```

#### 6. Usage Dashboard (Mobile Widget)

**`src/components/ai-subscription/UsageWidget.tsx`**

```typescript
export function UsageWidget() {
  const { subscription, usage } = useAISubscription();
  
  const percentage = subscription.monthly_message_limit
    ? (usage.used / subscription.monthly_message_limit) * 100
    : 0;
  
  return (
    <Card className="bg-gradient-to-br from-blue-500 to-purple-600 text-white border-0">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm opacity-90">Your Plan</p>
            <h3 className="text-xl font-bold">{subscription.plan_name}</h3>
          </div>
          <Sparkles className="w-8 h-8 opacity-80" />
        </div>
        
        {subscription.monthly_message_limit ? (
          <>
            <div className="mb-2">
              <div className="flex justify-between text-sm mb-1">
                <span>{usage.used} used</span>
                <span>{usage.remaining} left</span>
              </div>
              <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
            <p className="text-xs opacity-75">
              Resets {formatDate(subscription.current_period_end)}
            </p>
          </>
        ) : (
          <p className="text-sm opacity-90">
            Unlimited messages · {usage.used} this month
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

**`src/components/ai-chat/AudioVisualizer.tsx`**
```typescript
// Real-time waveform visualization during recording
export function AudioVisualizer({ isRecording }: { isRecording: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  
  useEffect(() => {
    if (isRecording) {
      // Initialize Web Audio API
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      // Draw waveform on canvas...
    }
  }, [isRecording]);
  
  return (
    <canvas 
      ref={canvasRef} 
      className="audio-waveform"
      width={300}
      height={100}
    />
  );
}
```

**`src/components/ai-chat/VoiceSessionSummary.tsx`**
```typescript
// Post-session summary with vocabulary learned
export function VoiceSessionSummary({ sessionId }: { sessionId: string }) {
  const { data: session } = useQuery({
    queryKey: ['voice-session', sessionId],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_voice_sessions')
        .select(`
          *,
          virtual_lesson:lessons(
            title,
            starts_at,
            ends_at
          )
        `)
        .eq('id', sessionId)
        .single();
      return data;
    }
  });
  
  const { data: vocabulary } = useQuery({
    queryKey: ['session-vocabulary', session?.virtual_lesson_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('student_vocabulary')
        .select('*')
        .eq('lesson_id', session.virtual_lesson_id)
        .order('created_at', { ascending: false });
      return data;
    },
    enabled: !!session?.virtual_lesson_id
  });
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Session Summary</CardTitle>
        <CardDescription>
          {formatDuration(session.total_duration_seconds)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <h3>Speaking Time</h3>
            <div className="flex gap-4">
              <div>
                <span className="text-sm text-muted-foreground">You:</span>
                <span className="font-bold ml-2">
                  {formatDuration(session.student_speaking_time_seconds)}
                </span>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">AI Teacher:</span>
                <span className="font-bold ml-2">
                  {formatDuration(session.ai_speaking_time_seconds)}
                </span>
              </div>
            </div>
          </div>
          
          <div>
            <h3>New Vocabulary</h3>
            <div className="flex flex-wrap gap-2">
              {vocabulary?.map(word => (
                <Badge key={word.id} variant="secondary">
                  {word.word}
                </Badge>
              ))}
            </div>
          </div>
          
          <Button 
            onClick={() => navigate(`/lesson/${session.virtual_lesson_id}`)}
          >
            View Full Analysis
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

### Voice-Specific Features

#### 1. Pronunciation Feedback

Use existing pronunciation analysis from live lessons:

```typescript
// After transcription, compare expected vs actual
const analyzePronunciation = async (segment: TranscriptSegment) => {
  // This can reuse existing pronunciation analysis
  // that may already exist for live lessons
  const analysis = await supabase.functions.invoke(
    'analyze-pronunciation',
    { body: { segmentId: segment.id } }
  );
  
  return {
    accuracy: analysis.accuracy,
    mispronunciations: analysis.issues,
    suggestions: analysis.tips
  };
};
```

#### 2. Conversation Pacing

AI adjusts speaking speed based on student level:

```typescript
const getVoiceSettings = (studentLevel: string) => {
  const settings = {
    'beginner': {
      stability: 0.7,      // More consistent
      similarity_boost: 0.6,
      speaking_rate: 0.9   // Slower
    },
    'intermediate': {
      stability: 0.5,
      similarity_boost: 0.75,
      speaking_rate: 1.0   // Normal
    },
    'advanced': {
      stability: 0.4,      // More varied
      similarity_boost: 0.8,
      speaking_rate: 1.1   // Slightly faster
    }
  };
  return settings[studentLevel] || settings.intermediate;
};
```

#### 3. Voice Selection

Students can choose AI teacher voice:

```typescript
const AVAILABLE_VOICES = [
  {
    id: 'rachel',
    name: 'Rachel',
    accent: 'American',
    gender: 'female',
    description: 'Warm and friendly'
  },
  {
    id: 'adam',
    name: 'Adam', 
    accent: 'American',
    gender: 'male',
    description: 'Clear and professional'
  },
  {
    id: 'bella',
    name: 'Bella',
    accent: 'British',
    gender: 'female',
    description: 'Sophisticated and articulate'
  }
];
```

### Cost Management

#### ElevenLabs Cost Control

```typescript
const COST_LIMITS = {
  basic: {
    maxCharsPerMonth: 10000,      // ~$3/month at $0.30/1K
    maxCharsPerMessage: 500
  },
  premium: {
    maxCharsPerMonth: 30000,      // ~$9/month
    maxCharsPerMessage: 1000
  },
  unlimited: {
    maxCharsPerMonth: 100000,     // ~$30/month
    maxCharsPerMessage: 2000
  }
};

const checkVoiceUsageLimit = async (subscriptionType: string) => {
  const limit = COST_LIMITS[subscriptionType];
  const usage = await getCurrentMonthUsage();
  
  if (usage.elevenlabs_characters >= limit.maxCharsPerMonth) {
    return {
      canUseVoice: false,
      reason: 'Monthly voice limit reached',
      fallbackToText: true
    };
  }
  
  return { canUseVoice: true };
};
```

#### Graceful Degradation

If voice limits reached, fall back to text-only:

```typescript
const sendMessage = async (text: string, preferVoice: boolean) => {
  const voiceCheck = await checkVoiceUsageLimit(subscriptionType);
  
  if (preferVoice && voiceCheck.canUseVoice) {
    return await sendVoiceMessage(text);
  } else {
    // Fall back to text-only
    return await sendTextMessage(text);
  }
};
```

### Analytics & Insights

#### Voice Session Metrics

```sql
-- Track voice usage
SELECT 
  DATE_TRUNC('day', created_at) as date,
  COUNT(*) as sessions,
  AVG(total_duration_seconds) as avg_duration,
  SUM(elevenlabs_character_count) as total_chars,
  SUM(elevenlabs_cost_cents) / 100.0 as total_cost
FROM ai_voice_sessions
GROUP BY date
ORDER BY date DESC;

-- Student engagement
SELECT 
  student_id,
  COUNT(*) as voice_sessions,
  SUM(student_speaking_time_seconds) as total_speaking_time,
  AVG(student_speaking_time_seconds) as avg_speaking_per_session
FROM ai_voice_sessions
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY student_id
ORDER BY voice_sessions DESC;
```

### Integration with Existing Systems

#### Vocabulary Learning Flow

```
1. Student speaks → Transcribed to text
2. Text saved in lesson_transcription_segments
3. Edge function processes lesson
4. New vocabulary extracted and added to student_vocabulary
5. Spaced repetition reviews scheduled
6. Student sees new words in vocabulary dashboard
```

#### Grammar Analysis Flow

```
1. AI conversation transcribed
2. Grammar patterns identified
3. Errors detected and logged
4. Topics added to student_grammar_topics
5. Recommendations generated
6. Student sees progress in grammar dashboard
```

#### Progress Tracking

All voice sessions count toward:
- Total learning time
- Speaking practice hours
- Vocabulary growth
- Grammar mastery
- Overall progress metrics

---

## AI Teacher Scenarios & Personalization

### Overview

The AI teacher adapts to each student's learning goals, interests, and progress using **Model Context Protocol (MCP)** to fetch real-time data about the student's history, vocabulary, grammar weaknesses, and preferences. This creates deeply personalized learning experiences that feel tailored to each individual.

### MCP Integration

#### Available MCP Tools

The AI teacher has access to these MCP tools to personalize conversations:

1. **`get_student_profile`**
   - Returns: CEFR level, native language, learning goals, interests
   - Use: Tailor conversation difficulty and topics

2. **`get_student_vocabulary`**
   - Returns: Words learned, mastery levels, due for review
   - Use: Incorporate recent vocabulary, avoid overused words

3. **`get_student_grammar_topics`**
   - Returns: Grammar concepts covered, weaknesses, strengths
   - Use: Focus on weak areas, reinforce concepts

4. **`get_recent_lessons`**
   - Returns: Topics discussed with human teachers, conversation themes
   - Use: Continue conversations, build on previous topics

5. **`get_student_progress`**
   - Returns: Speaking time, vocabulary growth, session frequency
   - Use: Provide encouraging feedback, set goals

6. **`get_learning_recommendations`**
   - Returns: AI-generated next steps based on progress
   - Use: Suggest focus areas, new topics

#### MCP Function Calling Flow

```typescript
// ElevenLabs agent configuration with MCP tools
const agentConfig = {
  agent_id: ELEVENLABS_AGENT_ID,
  
  // Enable function calling
  tools: [
    {
      name: 'get_student_profile',
      description: 'Get student learning profile, goals, and interests',
      parameters: {
        type: 'object',
        properties: {
          student_id: { type: 'string' }
        }
      }
    },
    {
      name: 'get_student_vocabulary',
      description: 'Get student vocabulary list and mastery levels',
      parameters: {
        type: 'object',
        properties: {
          student_id: { type: 'string' },
          limit: { type: 'number', default: 20 }
        }
      }
    },
    {
      name: 'get_student_grammar_topics',
      description: 'Get grammar topics student has studied and their proficiency',
      parameters: {
        type: 'object',
        properties: {
          student_id: { type: 'string' }
        }
      }
    },
    {
      name: 'get_recent_lessons',
      description: 'Get recent lesson topics and conversation themes',
      parameters: {
        type: 'object',
        properties: {
          student_id: { type: 'string' },
          limit: { type: 'number', default: 5 }
        }
      }
    }
  ],
  
  // System prompt with MCP context
  custom_llm_extra_body: {
    system_prompt: `You are Alex, a friendly and adaptive English teacher.
    
    You have access to tools that let you understand the student's learning history.
    ALWAYS call get_student_profile at the start of a new conversation.
    Use the tools to personalize your teaching approach.
    
    When you learn about the student:
    - Adjust your speaking pace to their CEFR level
    - Discuss topics related to their interests
    - Practice vocabulary they're learning
    - Focus on grammar areas they struggle with
    - Reference previous lessons naturally
    
    Be conversational, encouraging, and adaptive.`
  }
};

// Backend: Handle MCP function calls from ElevenLabs
const handleMCPFunctionCall = async (functionName: string, args: any) => {
  switch (functionName) {
    case 'get_student_profile':
      const { data: profile } = await supabase
        .from('profiles')
        .select('cefr_level, native_language, learning_goals, interests')
        .eq('id', args.student_id)
        .single();
      return profile;
      
    case 'get_student_vocabulary':
      const { data: vocab } = await supabase
        .from('student_vocabulary')
        .select('word, proficiency_level, times_reviewed, last_reviewed_at')
        .eq('student_id', args.student_id)
        .order('created_at', { ascending: false })
        .limit(args.limit || 20);
      return vocab;
      
    case 'get_student_grammar_topics':
      const { data: grammar } = await supabase
        .from('student_grammar_topics')
        .select('topic, proficiency_level, last_practiced_at')
        .eq('student_id', args.student_id)
        .order('proficiency_level', { ascending: true });
      return grammar;
      
    case 'get_recent_lessons':
      const { data: lessons } = await supabase
        .from('lessons')
        .select('title, notes, starts_at, lesson_transcription_segments(transcript)')
        .eq('student_id', args.student_id)
        .eq('status', 'completed')
        .order('starts_at', { ascending: false })
        .limit(args.limit || 5);
      return lessons;
      
    default:
      return { error: 'Unknown function' };
  }
};
```

### Personalized Learning Scenarios

Based on student learning goals and interests, the AI teacher adapts to different conversation modes:

#### 1. **Career & Business English**
*For professionals improving workplace communication*

**Scenario Setup**:
```typescript
const careerScenario = {
  goal: 'career_advancement',
  interests: ['business', 'presentations', 'networking'],
  cefr_level: 'B2',
  
  conversation_themes: [
    'Job interviews and resume discussions',
    'Meeting participation and facilitation',
    'Email writing and professional correspondence',
    'Presentation practice and public speaking',
    'Networking and small talk',
    'Negotiation and persuasion',
    'Industry-specific vocabulary'
  ],
  
  teaching_approach: {
    formality: 'professional',
    vocabulary_focus: 'business_terminology',
    grammar_focus: ['conditionals', 'passive_voice', 'formal_structures'],
    pronunciation: 'clear_professional_speech'
  }
};
```

**Example Conversation Flow**:
```
AI: Hi! I see you're preparing for job interviews. Let's practice! 
    I'll be the interviewer. Tell me about your current role.

Student: I work as software engineer at tech company...

AI: Great start! Just a small tip - we say "a software engineer" and 
    "a tech company." Now, can you tell me about a challenging project 
    you've worked on and how you overcame obstacles?

[Uses get_student_vocabulary to incorporate business terms they're learning]
[Uses get_student_grammar_topics to focus on complex sentence structures]
```

#### 2. **Travel & Cultural Exchange**
*For travelers and cultural explorers*

**Scenario Setup**:
```typescript
const travelScenario = {
  goal: 'travel_communication',
  interests: ['travel', 'culture', 'food', 'adventure'],
  cefr_level: 'A2',
  
  conversation_themes: [
    'Airport and transportation',
    'Hotel check-in and services',
    'Restaurant ordering and food vocabulary',
    'Asking for directions',
    'Shopping and bargaining',
    'Emergency situations',
    'Making friends and social situations',
    'Cultural customs and etiquette'
  ],
  
  teaching_approach: {
    formality: 'casual',
    vocabulary_focus: 'practical_survival_phrases',
    grammar_focus: ['questions', 'imperatives', 'present_tense'],
    pronunciation: 'clear_everyday_speech'
  }
};
```

**Example Conversation Flow**:
```
AI: Hey! I heard you're planning a trip to New York! Let's practice 
    ordering at a restaurant. I'll be the waiter. What would you like?

Student: I want hamburger please.

AI: Perfect! Just one small change - "I'd like a hamburger, please" 
    sounds more natural. Now, how would you like it cooked?

[Simulates real travel scenarios]
[Introduces cultural notes about American dining]
```

#### 3. **Academic English**
*For students preparing for university or exams*

**Scenario Setup**:
```typescript
const academicScenario = {
  goal: 'academic_success',
  interests: ['education', 'research', 'writing', 'critical_thinking'],
  cefr_level: 'B2',
  
  conversation_themes: [
    'Discussing academic topics',
    'Analyzing articles and research',
    'Essay structure and argumentation',
    'Debate and critical thinking',
    'Presentation of research',
    'Academic vocabulary building',
    'Paraphrasing and summarizing',
    'Test preparation (IELTS, TOEFL)'
  ],
  
  teaching_approach: {
    formality: 'academic',
    vocabulary_focus: 'academic_word_list',
    grammar_focus: ['complex_sentences', 'academic_phrases', 'reporting_verbs'],
    pronunciation: 'clear_formal_speech'
  }
};
```

**Example Conversation Flow**:
```
AI: Let's discuss an interesting topic - climate change. What's your 
    opinion on renewable energy?

Student: I think is very important for future...

AI: Good start! Let me help refine that: "I think IT'S very important 
    for THE future." In academic English, we might say: "Renewable 
    energy plays a crucial role in our future." Can you elaborate on why?

[Encourages critical thinking and complex responses]
[Introduces academic vocabulary naturally]
```

#### 4. **Conversational Fluency**
*For casual learners wanting natural conversation*

**Scenario Setup**:
```typescript
const conversationalScenario = {
  goal: 'general_fluency',
  interests: ['hobbies', 'entertainment', 'daily_life', 'current_events'],
  cefr_level: 'B1',
  
  conversation_themes: [
    'Hobbies and interests',
    'Movies, TV shows, and entertainment',
    'Sports and fitness',
    'Technology and social media',
    'Current events and news',
    'Personal experiences and stories',
    'Making plans and invitations',
    'Expressing opinions and preferences'
  ],
  
  teaching_approach: {
    formality: 'friendly_casual',
    vocabulary_focus: 'everyday_expressions',
    grammar_focus: ['phrasal_verbs', 'idioms', 'natural_patterns'],
    pronunciation: 'natural_connected_speech'
  }
};
```

**Example Conversation Flow**:
```
AI: Hey! What did you do this weekend?

Student: I watch movie with my friends.

AI: Nice! Just a quick correction - "I watchED a movie" (past tense). 
    What movie did you see? Was it good?

[Natural back-and-forth like talking to a friend]
[Focuses on fluency over perfect accuracy]
```

#### 5. **Test Preparation (IELTS/TOEFL)**
*For exam-focused learners*

**Scenario Setup**:
```typescript
const testPrepScenario = {
  goal: 'test_preparation',
  interests: ['IELTS', 'TOEFL', 'academic_success'],
  cefr_level: 'B2',
  
  conversation_themes: [
    'IELTS Speaking Part 1, 2, 3 practice',
    'TOEFL independent speaking tasks',
    'Describing graphs and data',
    'Expressing and justifying opinions',
    'Comparing and contrasting',
    'Hypothetical situations',
    'Time management in responses',
    'Common test topics and questions'
  ],
  
  teaching_approach: {
    formality: 'test_appropriate',
    vocabulary_focus: 'high_frequency_test_words',
    grammar_focus: ['range', 'accuracy', 'complexity'],
    pronunciation: 'clarity_for_scoring'
  }
};
```

**Example Conversation Flow**:
```
AI: Let's practice IELTS Speaking Part 2. You have one minute to prepare 
    and two minutes to speak. Describe a place you'd like to visit. I'll 
    time you. Ready?

[Provides structured test practice]
[Gives band score estimates and improvement tips]
```

#### 6. **Kid-Friendly English**
*For young learners (8-14 years old)*

**Scenario Setup**:
```typescript
const kidsScenario = {
  goal: 'early_learning',
  interests: ['games', 'stories', 'animals', 'school'],
  cefr_level: 'A1',
  
  conversation_themes: [
    'Colors, numbers, and shapes',
    'Animals and nature',
    'Family and friends',
    'School and hobbies',
    'Food and favorites',
    'Simple stories and adventures',
    'Songs and rhymes',
    'Games and activities'
  ],
  
  teaching_approach: {
    formality: 'very_friendly_encouraging',
    vocabulary_focus: 'basic_words_with_repetition',
    grammar_focus: ['simple_present', 'basic_questions'],
    pronunciation: 'slow_clear_patient'
  }
};
```

**Example Conversation Flow**:
```
AI: Hi friend! Let's play a game! I'll describe an animal and you 
    guess what it is. Ready? This animal is big, gray, and has a 
    long nose called a trunk. What is it?

[Uses simple language, lots of encouragement]
[Incorporates games and fun activities]
```

### Three-Screen Onboarding Flow

Before accessing AI Chat for the first time, students complete a personalized onboarding:

#### Screen 1: Learning Goals
**`src/pages/AIOnboarding/GoalsScreen.tsx`**

```typescript
export function GoalsScreen() {
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  
  const learningGoals = [
    {
      id: 'career',
      title: 'Career & Business',
      description: 'Improve workplace communication, interviews, presentations',
      icon: <Briefcase />
    },
    {
      id: 'travel',
      title: 'Travel & Culture',
      description: 'Communicate while traveling, understand different cultures',
      icon: <Plane />
    },
    {
      id: 'academic',
      title: 'Academic Success',
      description: 'University preparation, research, essay writing',
      icon: <GraduationCap />
    },
    {
      id: 'conversation',
      title: 'Conversational Fluency',
      description: 'Natural everyday conversations, make friends',
      icon: <MessageCircle />
    },
    {
      id: 'test_prep',
      title: 'Test Preparation',
      description: 'IELTS, TOEFL, Cambridge exams',
      icon: <FileText />
    },
    {
      id: 'kids',
      title: 'Kids Learning',
      description: 'Fun English for young learners',
      icon: <Sparkles />
    }
  ];
  
  return (
    <div className="onboarding-screen">
      <h1>What are your learning goals?</h1>
      <p>Select one or more goals to personalize your AI teacher</p>
      
      <div className="goals-grid">
        {learningGoals.map(goal => (
          <Card
            key={goal.id}
            className={cn(
              "goal-card cursor-pointer",
              selectedGoals.includes(goal.id) && "selected"
            )}
            onClick={() => toggleGoal(goal.id)}
          >
            <div className="icon">{goal.icon}</div>
            <h3>{goal.title}</h3>
            <p>{goal.description}</p>
          </Card>
        ))}
      </div>
      
      <Button
        onClick={() => saveAndContinue(selectedGoals)}
        disabled={selectedGoals.length === 0}
        size="lg"
      >
        Continue
      </Button>
    </div>
  );
}
```

#### Screen 2: Interests & Topics
**`src/pages/AIOnboarding/InterestsScreen.tsx`**

```typescript
export function InterestsScreen() {
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [customInterests, setCustomInterests] = useState('');
  
  const interestCategories = {
    lifestyle: ['Travel', 'Food & Cooking', 'Fashion', 'Health & Fitness'],
    entertainment: ['Movies & TV', 'Music', 'Gaming', 'Books & Reading'],
    professional: ['Technology', 'Business', 'Marketing', 'Finance'],
    hobbies: ['Sports', 'Photography', 'Art & Design', 'Gardening'],
    learning: ['Science', 'History', 'Philosophy', 'Current Events']
  };
  
  return (
    <div className="onboarding-screen">
      <h1>What topics interest you?</h1>
      <p>Your AI teacher will create conversations around your interests</p>
      
      {Object.entries(interestCategories).map(([category, interests]) => (
        <div key={category} className="interest-category">
          <h3>{category}</h3>
          <div className="interests-chips">
            {interests.map(interest => (
              <Badge
                key={interest}
                variant={selectedInterests.includes(interest) ? 'default' : 'outline'}
                onClick={() => toggleInterest(interest)}
                className="cursor-pointer"
              >
                {interest}
              </Badge>
            ))}
          </div>
        </div>
      ))}
      
      <div className="custom-interests">
        <Label>Or add your own interests</Label>
        <Input
          placeholder="e.g., Japanese anime, sustainable living, cryptocurrency"
          value={customInterests}
          onChange={(e) => setCustomInterests(e.target.value)}
        />
      </div>
      
      <div className="navigation-buttons">
        <Button variant="outline" onClick={goBack}>
          Back
        </Button>
        <Button
          onClick={() => saveAndContinue(selectedInterests, customInterests)}
          size="lg"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
```

#### Screen 3: Current Level & Preferences
**`src/pages/AIOnboarding/PreferencesScreen.tsx`**

```typescript
export function PreferencesScreen() {
  const [cefrLevel, setCefrLevel] = useState('');
  const [voicePreference, setVoicePreference] = useState('');
  const [correctionStyle, setCorrectionStyle] = useState('balanced');
  
  const levelDescriptions = {
    'A1': 'Beginner - Basic phrases and simple sentences',
    'A2': 'Elementary - Can handle simple conversations',
    'B1': 'Intermediate - Can discuss familiar topics',
    'B2': 'Upper-Intermediate - Can express ideas fluently',
    'C1': 'Advanced - Can use language flexibly',
    'C2': 'Proficient - Near-native speaker'
  };
  
  const voiceOptions = [
    { id: 'rachel', name: 'Rachel', accent: 'American', gender: 'female' },
    { id: 'adam', name: 'Adam', accent: 'American', gender: 'male' },
    { id: 'bella', name: 'Bella', accent: 'British', gender: 'female' },
    { id: 'charlie', name: 'Charlie', accent: 'British', gender: 'male' }
  ];
  
  const correctionStyles = [
    {
      id: 'gentle',
      title: 'Gentle',
      description: 'Only correct major errors, focus on fluency'
    },
    {
      id: 'balanced',
      title: 'Balanced',
      description: 'Correct important mistakes naturally'
    },
    {
      id: 'strict',
      title: 'Detailed',
      description: 'Correct all errors for maximum learning'
    }
  ];
  
  return (
    <div className="onboarding-screen">
      <h1>Let's personalize your experience</h1>
      
      <div className="preference-section">
        <h3>What's your current level?</h3>
        <Select value={cefrLevel} onValueChange={setCefrLevel}>
          <SelectTrigger>
            <SelectValue placeholder="Select your level" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(levelDescriptions).map(([level, desc]) => (
              <SelectItem key={level} value={level}>
                <div>
                  <div className="font-bold">{level}</div>
                  <div className="text-sm text-muted-foreground">{desc}</div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div className="preference-section">
        <h3>Choose your AI teacher's voice</h3>
        <div className="voice-options">
          {voiceOptions.map(voice => (
            <Card
              key={voice.id}
              className={cn(
                "voice-card cursor-pointer",
                voicePreference === voice.id && "selected"
              )}
              onClick={() => setVoicePreference(voice.id)}
            >
              <div className="voice-avatar">
                {voice.gender === 'female' ? '👩‍🏫' : '👨‍🏫'}
              </div>
              <h4>{voice.name}</h4>
              <p>{voice.accent} · {voice.gender}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  playVoiceSample(voice.id);
                }}
              >
                <Play className="w-4 h-4" /> Preview
              </Button>
            </Card>
          ))}
        </div>
      </div>
      
      <div className="preference-section">
        <h3>How should I correct your mistakes?</h3>
        <RadioGroup value={correctionStyle} onValueChange={setCorrectionStyle}>
          {correctionStyles.map(style => (
            <div key={style.id} className="correction-style-option">
              <RadioGroupItem value={style.id} id={style.id} />
              <Label htmlFor={style.id} className="cursor-pointer">
                <div className="font-bold">{style.title}</div>
                <div className="text-sm text-muted-foreground">
                  {style.description}
                </div>
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>
      
      <div className="navigation-buttons">
        <Button variant="outline" onClick={goBack}>
          Back
        </Button>
        <Button
          onClick={() => completeOnboarding({
            cefrLevel,
            voicePreference,
            correctionStyle
          })}
          size="lg"
        >
          Start Learning!
        </Button>
      </div>
    </div>
  );
}
```

#### Backend: Save Onboarding Data

```typescript
// Edge Function: save-ai-onboarding
export default async function handler(req: Request) {
  const {
    student_id,
    learning_goals,
    interests,
    cefr_level,
    voice_preference,
    correction_style
  } = await req.json();
  
  // Update student profile
  await supabase
    .from('profiles')
    .update({
      learning_goals: learning_goals,
      interests: interests.join(', '),
      cefr_level: cefr_level,
      ai_voice_preference: voice_preference,
      ai_correction_style: correction_style,
      ai_onboarding_completed: true,
      updated_at: new Date().toISOString()
    })
    .eq('id', student_id);
  
  // Create personalized AI agent configuration
  const agentConfig = createPersonalizedAgent({
    learning_goals,
    interests,
    cefr_level,
    correction_style
  });
  
  // Store agent configuration
  await supabase
    .from('ai_agent_configs')
    .insert({
      student_id,
      config: agentConfig,
      created_at: new Date().toISOString()
    });
  
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

const createPersonalizedAgent = (onboardingData) => {
  // Map learning goals to conversation scenarios
  const scenarios = onboardingData.learning_goals.map(goal => 
    SCENARIO_TEMPLATES[goal]
  );
  
  // Build custom system prompt
  const systemPrompt = `You are Alex, an adaptive English teacher.
  
Student Profile:
- Level: ${onboardingData.cefr_level}
- Goals: ${onboardingData.learning_goals.join(', ')}
- Interests: ${onboardingData.interests.join(', ')}
- Correction style: ${onboardingData.correction_style}

Conversation Scenarios:
${scenarios.map(s => `- ${s.theme}: ${s.description}`).join('\n')}

Teaching Instructions:
- Adapt difficulty to ${onboardingData.cefr_level} level
- Discuss topics related to: ${onboardingData.interests.slice(0, 3).join(', ')}
- Use ${onboardingData.correction_style} correction approach
- Reference their learning goals naturally in conversations
- Use MCP tools to access their progress and vocabulary

Be encouraging, natural, and personalized!`;

  return {
    system_prompt: systemPrompt,
    scenarios: scenarios,
    mcp_enabled: true
  };
};
```

### Dynamic Conversation Starters

Based on onboarding data and MCP insights, generate personalized conversation starters:

```typescript
// Frontend: Generate conversation starters
const generateConversationStarters = async (studentId: string) => {
  // Fetch student profile and progress
  const profile = await fetchStudentProfile(studentId);
  const recentLessons = await fetchRecentLessons(studentId);
  const vocabularyDue = await fetchVocabularyDueForReview(studentId);
  
  const starters = [];
  
  // Goal-based starters
  if (profile.learning_goals.includes('career')) {
    starters.push({
      title: '💼 Interview Practice',
      message: "Let's practice for your upcoming interview! I'll ask you common questions."
    });
  }
  
  if (profile.learning_goals.includes('travel')) {
    starters.push({
      title: '✈️ Travel Conversation',
      message: "You're planning a trip! Let's practice asking for directions and ordering food."
    });
  }
  
  // Interest-based starters
  if (profile.interests.includes('movies')) {
    starters.push({
      title: '🎬 Movie Discussion',
      message: "Have you seen any good movies lately? Let's talk about them!"
    });
  }
  
  // Progress-based starters
  if (recentLessons.length > 0) {
    const lastTopic = recentLessons[0].title;
    starters.push({
      title: '🔄 Continue Last Topic',
      message: `Last time you discussed ${lastTopic}. Want to continue that conversation?`
    });
  }
  
  // Vocabulary review starter
  if (vocabularyDue.length > 0) {
    starters.push({
      title: '📚 Vocabulary Practice',
      message: `You have ${vocabularyDue.length} words due for review. Let's use them in conversation!`
    });
  }
  
  // Always include free conversation
  starters.push({
    title: '💬 Free Conversation',
    message: "Let's just chat! What's on your mind today?"
  });
  
  return starters;
};
```

### Scenario Switching During Conversation

Students can switch scenarios mid-conversation:

```typescript
// Voice command or UI button
Student: "Can we practice for my job interview instead?"

AI: [Detects intent to switch scenario]
    "Of course! Let's switch to interview practice. I'll be the interviewer. 
     Tell me, why do you want this position?"

[ElevenLabs agent receives context update via MCP]
[Adjusts formality, vocabulary, and teaching approach]
```

---

## Application Layer Architecture

### API Layer (Supabase Edge Functions)

#### 1. Subscription Management

**`supabase/functions/ai-subscription-create/index.ts`**
```typescript
// Create new subscription via Stripe
// - Validates student has no active subscription
// - Creates Stripe subscription
// - Creates ai_subscriptions record
// - Returns checkout URL
```

**`supabase/functions/ai-subscription-manage/index.ts`**
```typescript
// Manage existing subscription
// - Cancel/pause/resume
// - Upgrade/downgrade plan
// - Update payment method
```

**`supabase/functions/stripe-webhook-ai-subscription/index.ts`**
```typescript
// Handle Stripe webhooks
// - subscription.created
// - subscription.updated
// - subscription.deleted
// - invoice.paid
// - invoice.payment_failed
// - Update ai_subscriptions status
// - Reset usage counters on renewal
```

#### 2. Chat API

**`supabase/functions/ai-chat-subscription/index.ts`**
```typescript
// Handle student chat messages
// 1. Check subscription access (check_ai_subscription_access)
// 2. Verify message limit not exceeded
// 3. Send to OpenAI API
// 4. Save conversation/messages
// 5. Log usage (log_ai_subscription_message)
// 6. Track tokens/costs
// 7. Return AI response
```

### Frontend Components

#### 1. Subscription Management UI

**`src/pages/AISubscription.tsx`**
- View current subscription status
- See usage stats (messages used, remaining)
- Manage subscription (cancel, upgrade)
- View billing history

**`src/components/ai-subscription/PricingPlans.tsx`**
- Display available plans
- Feature comparison
- Subscribe button → Stripe Checkout

**`src/components/ai-subscription/SubscriptionStatus.tsx`**
- Current plan badge
- Usage progress bar
- Renewal date
- Quick actions (upgrade, cancel)

#### 2. AI Chat Interface

**`src/pages/AIChatSubscription.tsx`**
- Chat interface (similar to lesson chat)
- Message history
- Typing indicators
- Usage indicator (messages remaining)
- Upsell prompts when limit approached

**`src/components/ai-chat/AIMessageBubble.tsx`**
- Styled message bubbles
- Markdown support
- Code highlighting
- Audio playback (if TTS added)

**`src/hooks/useAISubscription.ts`**
```typescript
export function useAISubscription() {
  // Check access
  const { data: access } = useQuery({
    queryKey: ['ai-subscription-access'],
    queryFn: async () => {
      const { data } = await supabase
        .rpc('check_ai_subscription_access', {
          p_student_id: userId
        });
      return data;
    }
  });
  
  // Send message
  const sendMessage = useMutation({
    mutationFn: async ({ message, conversationId }) => {
      const { data } = await supabase.functions.invoke(
        'ai-chat-subscription',
        { body: { message, conversationId } }
      );
      return data;
    }
  });
  
  return { access, sendMessage };
}
```

### Integration Points

#### Student Profile
- Add subscription status badge
- Link to AI Chat from dashboard
- Show usage stats in sidebar

#### Navigation
- New menu item: "AI Tutor" (for subscribed students)
- Prominent CTA for non-subscribed students

#### Onboarding
- Introduce AI subscription option during student onboarding
- Offer trial period (e.g., 7 days free)

---

## Payment Flow

### Subscription Purchase Flow

1. **Student browses plans** → `AISubscription.tsx`
2. **Selects plan** → Click "Subscribe" button
3. **Create Stripe Checkout Session**:
   ```typescript
   const { data } = await supabase.functions.invoke(
     'ai-subscription-create',
     { body: { planId, successUrl, cancelUrl } }
   );
   // Redirect to Stripe Checkout
   window.location.href = data.checkoutUrl;
   ```

4. **Stripe handles payment** → Customer enters payment info
5. **Stripe webhook fires** → `stripe-webhook-ai-subscription`
6. **Create subscription record**:
   ```typescript
   await supabase.from('ai_subscriptions').insert({
     student_id: userId,
     subscription_type: plan.plan_type,
     status: 'active',
     monthly_message_limit: plan.monthly_message_limit,
     price_cents: plan.price_cents,
     stripe_subscription_id: subscription.id,
     stripe_customer_id: customer.id,
     current_period_end: new Date(subscription.current_period_end * 1000)
   });
   ```

7. **Redirect to success page** → Student can start chatting

### Message Usage Flow

1. **Student sends message** in chat UI
2. **Check access**:
   ```typescript
   const access = await supabase.rpc('check_ai_subscription_access', {
     p_student_id: userId
   });
   
   if (!access.can_send_message) {
     throw new Error('Message limit exceeded');
   }
   ```

3. **Save user message**:
   ```typescript
   const { data: message } = await supabase
     .from('ai_chat_messages')
     .insert({
       conversation_id,
       role: 'user',
       content: userMessage
     })
     .select()
     .single();
   ```

4. **Call OpenAI API** (via Edge Function)
5. **Save AI response**:
   ```typescript
   const { data: aiMessage } = await supabase
     .from('ai_chat_messages')
     .insert({
       conversation_id,
       role: 'assistant',
       content: aiResponse,
       tokens_used: tokensUsed
     })
     .select()
     .single();
   ```

6. **Log usage**:
   ```typescript
   await supabase.rpc('log_ai_subscription_message', {
     p_subscription_id: subscriptionId,
     p_student_id: userId,
     p_message_id: aiMessage.id,
     p_conversation_id: conversationId,
     p_tokens_used: tokensUsed,
     p_cost_cents: estimatedCostCents
   });
   ```

7. **Return response** to UI

### Subscription Renewal Flow

1. **Stripe automatically charges** customer on renewal date
2. **Webhook received** → `invoice.paid` event
3. **Reset usage counter**:
   ```typescript
   await supabase.rpc('reset_ai_subscription_period', {
     p_subscription_id: subscriptionId,
     p_new_period_start: new Date(period.start * 1000),
     p_new_period_end: new Date(period.end * 1000)
   });
   ```

4. **Update subscription status** (if needed)
5. **Send confirmation email** (optional)

---

## Cost & Revenue Model

### Cost Structure

#### Text-Based Chat Costs (OpenAI GPT-4)
- Input: $0.01 per 1K tokens
- Output: $0.03 per 1K tokens

**Average Text Conversation**:
- User message: ~50-150 tokens
- AI response: ~200-400 tokens
- Total per exchange: ~250-550 tokens
- Cost per message: ~$0.0075 - $0.015

#### Voice Conversation Costs (ElevenLabs Conversational AI)
**ElevenLabs Pricing**:
- ~$0.30 per 1K characters generated
- Includes: Speech-to-text (input), LLM processing, Text-to-speech (output)
- No separate STT charges

**Average Voice Conversation Exchange**:
- Student speaks 30 seconds → transcribed (included in platform)
- AI responds ~200 characters → $0.06
- **Total cost per exchange: ~$0.06** (all-in-one pricing)

**Comparison to Separate Services**:
- Old approach: STT ($0.006) + GPT-4 ($0.0075) + TTS ($0.06) = ~$0.0735
- ElevenLabs: ~$0.06 (simpler, 18% cheaper, better quality)

### Monthly Cost Projections

#### Text-Only Plans (GPT-4)
- **Basic** (100 msg): ~$0.75 - $1.50/month
- **Premium** (500 msg): ~$3.75 - $7.50/month  
- **Unlimited** (avg 1000 msg): ~$7.50 - $15/month

#### Voice-Enabled Plans (ElevenLabs Conversational AI)
- **Basic** (100 msg): ~$6.00/month (100 exchanges × $0.06)
- **Premium** (500 msg): ~$30.00/month (500 exchanges × $0.06)
- **Unlimited** (avg 1000 msg): ~$60.00/month (1000 exchanges × $0.06)

#### Hybrid Usage (50% voice, 50% text)
- **Basic** (100 msg): ~$3.38/month (50 text + 50 voice)
- **Premium** (500 msg): ~$16.88/month (250 text + 250 voice)
- **Unlimited** (avg 1000 msg): ~$33.75/month (500 text + 500 voice)

**Note**: ElevenLabs all-in-one pricing simplifies cost management and provides better margins than separate STT/TTS services.

### Revenue Model

**Subscription Pricing** (Updated with voice):

#### Text-Only Tiers
- **Basic**: $9.99/month (100 messages)
- **Premium**: $19.99/month (500 messages)
- **Unlimited**: $49.99/month (unlimited text)

#### Voice-Enabled Tiers
- **Basic Plus**: $14.99/month (100 messages, voice included)
- **Premium Plus**: $29.99/month (500 messages, voice included)
- **Unlimited Plus**: $69.99/month (unlimited text + voice)

**Gross Margins**:
- **Text Basic**: 85-92% ($9.99 revenue, ~$1.13 cost)
- **Text Premium**: 81-88% ($19.99 revenue, ~$5.63 cost)
- **Text Unlimited**: 70-80% ($49.99 revenue, ~$11.25 cost)
- **Voice Basic**: 60% ($14.99 revenue, ~$6.00 cost)
- **Voice Premium**: 50% ($29.99 revenue, ~$30.00 cost) *needs adjustment*
- **Voice Unlimited**: 14% ($69.99 revenue, ~$60.00 cost)

**Optimized Pricing Strategy**:
1. **Voice Basic**: $14.99 for 100 messages - Good margin (60%)
2. **Voice Premium**: $39.99 for 500 messages - Better margin (25%)
3. **Voice Unlimited**: $79.99 for unlimited - Lower margin but scalable (25%+)

**ElevenLabs Benefits**:
- Simpler cost structure (one vendor vs three)
- Better voice quality = higher perceived value
- Built-in transcription = no additional STT costs
- Sub-100ms latency = better user experience
- Easier to implement and maintain

### Additional Revenue Streams

1. **Voice Add-Ons**:
   - Extra 50 voice messages: $9.99
   - Pronunciation analysis: $4.99/month
   - Custom AI voice (cloned): $19.99/month

2. **Upsells**:
   - Upgrade prompts when text limit reached
   - "Try voice for free" (5 messages)
   - Volume discounts for annual plans

3. **Premium Features**:
   - Conversation history export: $4.99/month
   - Advanced grammar analysis: $7.99/month
   - Personalized learning plans: $9.99/month

4. **B2B Licensing**:
   - School/institution bulk pricing
   - White-label options for language schools

---

## Analytics & Monitoring

### Key Metrics to Track

#### Subscription Metrics
- Active subscriptions by plan
- Monthly Recurring Revenue (MRR)
- Churn rate
- Upgrade/downgrade rate
- Average lifetime value (LTV)

#### Usage Metrics
- Messages per subscription per month
- Average messages per user
- Daily/weekly active users
- Peak usage times

#### Financial Metrics
- Token costs per plan
- Gross margin per plan
- Customer acquisition cost (CAC)
- LTV/CAC ratio

### Dashboard Queries

```sql
-- Active subscriptions by plan
SELECT 
  subscription_type,
  COUNT(*) as active_count,
  SUM(price_cents) / 100.0 as mrr
FROM ai_subscriptions
WHERE status = 'active'
GROUP BY subscription_type;

-- Usage distribution
SELECT 
  subscription_type,
  AVG(messages_used_this_period) as avg_messages,
  MAX(messages_used_this_period) as max_messages,
  MIN(messages_used_this_period) as min_messages
FROM ai_subscriptions
WHERE status = 'active'
GROUP BY subscription_type;

-- Cost analysis
SELECT 
  DATE_TRUNC('month', created_at) as month,
  SUM(cost_cents) / 100.0 as total_cost,
  COUNT(DISTINCT student_id) as unique_users,
  COUNT(*) as total_messages
FROM ai_subscription_usage_log
GROUP BY month
ORDER BY month DESC;
```

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- [ ] Create database schema (tables, indexes, RLS)
- [ ] Implement database functions
- [ ] Set up Stripe products and prices
- [ ] Create Edge Functions for subscription management

### Phase 2: Core Functionality (Week 3-4)
- [ ] Build chat Edge Function with OpenAI integration
- [ ] Implement usage tracking and limits
- [ ] Create webhook handler for Stripe events
- [ ] Build subscription management UI

### Phase 3: Chat Interface (Week 5)
- [ ] Build chat UI component
- [ ] Implement real-time messaging
- [ ] Add usage indicators
- [ ] Create conversation history view

### Phase 4: Voice Integration (Week 6-7)
- [ ] Set up ElevenLabs Conversational AI account and create agent
- [ ] Build Edge Function to generate signed WebSocket URLs
- [ ] Configure agent with language teaching instructions and student context
- [ ] Implement WebSocket connection handling in frontend
- [ ] Build audio streaming pipeline (microphone → ElevenLabs → speakers)
- [ ] Handle real-time transcription events from ElevenLabs
- [ ] Store transcriptions in lesson_transcription_segments as they arrive
- [ ] Process transcriptions through vocab/grammar analysis
- [ ] Create voice lesson summary reports
- [ ] Implement interruption handling and conversation state management

### Phase 5: Polish & Launch (Week 8)
- [ ] Add pricing page
- [ ] Implement upsell flows
- [ ] Add analytics dashboard (admin)
- [ ] Testing and bug fixes
- [ ] Soft launch to beta users

### Phase 5: Enhancements (Post-Launch)
- [ ] Custom AI personalities
- [ ] Learning path recommendations
- [ ] Social features (share conversations)
- [ ] Group chat rooms with AI

---

## Security Considerations

### Access Control
- ✅ RLS policies enforce subscription ownership
- ✅ Edge Functions validate subscription before API calls
- ✅ Rate limiting to prevent abuse
- ✅ Token usage caps to control costs

### Data Privacy
- ✅ Conversations are private to student
- ✅ No sharing with teachers unless student opts in
- ✅ GDPR compliance (right to delete)
- ✅ Secure Stripe integration (no card data stored)

### Cost Protection
- ✅ Message limits prevent runaway costs
- ✅ Daily caps in addition to monthly limits
- ✅ Alerts when usage exceeds thresholds
- ✅ Automatic suspension if payment fails

---

## Alignment with Current Architecture

### ✅ Fits Existing Patterns

1. **User System**: Uses existing `profiles` table, students already exist
2. **Multi-Role Support**: Students can have both human teacher lessons AND AI subscription
3. **Payment Infrastructure**: Extends existing Stripe integration (credits, earnings)
4. **AI System**: Reuses `ai_chat_conversations` and `ai_chat_messages` tables
5. **Token Tracking**: Builds on existing `ai_interactions` and `ai_feature_access` patterns
6. **RLS Security**: Follows same security model as lessons and profiles

### 🆕 New Patterns

1. **Subscription Management**: New concept for platform (recurring billing)
2. **Message-Based Limits**: Different from credit-based lesson system
3. **Student-Facing AI**: Existing AI features are teacher-facing only
4. **Direct-to-Consumer**: Students subscribe independently (no teacher involved)

### 🔄 Minimal Changes Required

- ✅ No changes to `profiles` or `lessons` tables
- ✅ No changes to existing lesson booking flow
- ✅ Extends `ai_chat_conversations` with new type (backward compatible)
- ✅ Reuses existing UI components and patterns

---

## Conclusion

The proposed AI Chat Subscription architecture with voice integration:

### Core Value Proposition

1. **True Language Learning Experience**
   - Students can **speak** naturally with an AI teacher
   - Get **instant voice responses** in natural-sounding speech
   - Practice **real conversations** anytime, anywhere

2. **Complete Learning Loop**
   - 🎤 Speak → 📝 Transcribed → 🤖 AI Responds → 🔊 Voice Output
   - 📊 Automatic vocabulary extraction
   - 📈 Grammar analysis and tracking
   - 🎯 Spaced repetition for retention
   - 📉 Progress tracking over time

3. **Seamless Integration**
   - ✅ Reuses existing `lesson_transcription_segments` infrastructure
   - ✅ Leverages existing vocabulary and grammar systems
   - ✅ Creates "virtual lessons" for consistent data model
   - ✅ Same analytics and insights as live teacher lessons
   - ✅ Works alongside human teacher lessons

### Technical Advantages

**Voice Architecture with ElevenLabs**:
- 🎙️ **ElevenLabs Conversational AI** - Complete speech-to-speech platform
- � **Sub-100ms latency** - Natural conversation flow
- � **Built-in transcription** - Automatic transcripts included
- 🎯 **Single vendor** - Simpler integration and billing
- 💰 **Cost-effective** - $0.06/exchange vs $0.0735 with separate services
- �️ **Best-in-class voices** - Industry-leading natural speech
- 🌍 **32+ languages** - Native accent support
- ⚡ **Interruption handling** - Natural barge-in capabilities

**Cost Efficiency**:
- Text-only plans: 85-92% margins
- Voice plans: 25-60% margins (improved with ElevenLabs)
- All-in-one pricing simplifies cost management
- No need to manage multiple AI service vendors

**Scalability**:
- Edge Functions handle processing
- Async vocabulary/grammar analysis
- Storage scales automatically
- Stripe manages billing

### Business Model

**Multiple Tiers**:
- 💬 **Text-Only**: $9.99-49.99/month (low cost, high margin)
- 🎤 **Voice-Enabled**: $14.99-69.99/month (premium feature)
- 📦 **Add-Ons**: Extra voice messages, custom voices, advanced features

**Revenue Streams**:
1. Monthly subscriptions (primary)
2. Voice add-on packs
3. Premium features (pronunciation, custom voices)
4. Annual plans (better retention)
5. B2B/institutional licensing

**Market Positioning**:
- Complements human teacher lessons
- 24/7 availability between scheduled lessons
- Practice without pressure
- Affordable alternative to private tutoring
- Bridges gap between apps (Duolingo) and live tutoring

### Implementation Readiness

**Phase 1** (Weeks 1-2): Database + Stripe setup ✅
**Phase 2** (Weeks 3-4): Core chat functionality ✅  
**Phase 3** (Week 5): Chat UI ✅
**Phase 4** (Weeks 6-7): Voice integration 🎤
**Phase 5** (Week 8): Launch 🚀

**Minimal Breaking Changes**:
- ✅ No changes to existing tables (only additions)
- ✅ Extends `ai_chat_conversations` (backward compatible)
- ✅ Reuses transcription system (already battle-tested)
- ✅ Separate from lesson booking (no conflicts)

### Competitive Advantages

1. **Only platform combining**:
   - Live human teachers
   - AI chat practice
   - Voice conversation
   - Automatic transcription
   - Vocabulary/grammar tracking
   - Spaced repetition

2. **Better than pure AI apps** (ChatGPT, Claude):
   - Voice-first design for language learning
   - Automatic vocabulary extraction
   - Grammar tracking and progress
   - Integration with human lessons
   - Structured learning plans

3. **Better than traditional apps** (Duolingo, Babbel):
   - Natural conversation (not scripted)
   - Voice interaction (not TTS reading)
   - Personalized to student level
   - Real-time transcription
   - Connection to live teachers

### Long-term Vision

**Near-term** (3-6 months):
- Launch text + voice subscriptions
- Build user base of 100-500 students
- Refine AI prompts and voice quality
- Gather feedback and iterate

**Mid-term** (6-12 months):
- Add pronunciation scoring
- Custom AI voice cloning
- Multi-language support
- Advanced conversation scenarios
- Mobile app (React Native)

**Long-term** (12+ months):
- AI-powered curriculum generation
- Adaptive difficulty adjustment
- Social features (group conversations)
- VR/AR integration
- White-label for schools
- Enterprise/B2B offerings

This creates a **comprehensive language learning ecosystem** where students can:
- 📅 Book live lessons with teachers
- 🤖 Practice with AI between lessons
- 🎤 Speak naturally via voice
- 📊 Track progress automatically
- 🎯 Review vocabulary with spaced repetition
- 🏆 Achieve fluency faster

**Bottom line**: The AI Chat Subscription with voice integration transforms JustTalk from a "lesson booking platform" into a "complete language learning solution" that maximizes student engagement, retention, and outcomes while creating sustainable recurring revenue.
