# Voice Interaction Architecture with ElevenLabs Conversational AI

## Executive Summary

This document describes the **updated voice interaction architecture** for JustTalk.ai's AI Chat Subscription feature, leveraging **ElevenLabs Conversational AI (Agents Platform)** as a complete end-to-end solution for voice-enabled language learning conversations.

### 🎯 Important: Database Naming Convention

**All new tables use the `justai_` prefix** to distinguish this student-facing AI chat system from existing teacher-side AI features:

- ❌ **DO NOT USE**: `ai_*` tables (e.g., `ai_chat_conversations`, `ai_chat_messages`, `ai_feature_access`)
  - These are reserved for **teacher-side AI features** (student insights, lesson planning, etc.)
  
- ✅ **USE**: `justai_*` tables (e.g., `justai_conversations`, `justai_messages`, `justai_subscriptions`)
  - These are for the **new student-facing JustAI chat subscription system**

This separation ensures:
- Clear distinction between teacher and student AI features
- No conflicts in data or business logic
- Independent scaling and feature development
- Easier maintenance and debugging

---

## Key Architecture Decision: Single Agent, Multiple Users

### ✅ One Agent Can Serve All Users

After exploring the ElevenLabs Agents Platform documentation, we've confirmed that:

**One ElevenLabs Agent can be shared across all students** by using:
1. **Dynamic Variables** - Pass student-specific data at conversation start
2. **Overrides** - Customize system prompts, first messages, and voice per student
3. **User ID Tracking** - Associate each conversation with a specific student
4. **Personalization** - Agent adapts behavior based on per-conversation context

This means we **only need ONE agent** configured in ElevenLabs, not one per student.

---

## Architecture Overview

### Technology Stack

**ElevenLabs Conversational AI (Agents Platform)**
- ✅ Complete speech-to-speech conversation platform
- ✅ Integrated STT (Speech-to-Text) + LLM + TTS (Text-to-Speech)
- ✅ Sub-100ms latency for natural conversations
- ✅ Real-time transcription included (both student and AI)
- ✅ WebSocket API for streaming conversations
- ✅ REST API for conversation history and transcripts
- ✅ Built-in interruption handling and turn-taking
- ✅ 5000+ voices across 32+ languages
- ✅ Dynamic per-conversation personalization

**Supabase Backend**
- Edge Functions for signed URL generation and conversation management
- Storage for audio segments (optional, ElevenLabs stores audio)
- Database for conversation tracking and student progress

**React Frontend**
- `@elevenlabs/react` SDK for voice conversations
- WebSocket connection for real-time audio streaming
- Real-time transcript display

---

## Database Schema

### Existing Tables (No Changes)

✅ `profiles` - Student profiles with CEFR level, learning goals, interests
✅ `lessons` - Reused to create "virtual lessons" for AI voice sessions
✅ `lesson_transcription_segments` - Store transcripts from voice sessions
✅ `student_vocabulary` - Track vocabulary learned from conversations
✅ `student_grammar_topics` - Track grammar concepts covered

**Note**: We do NOT use the existing `ai_*` tables (`ai_chat_conversations`, `ai_chat_messages`, etc.) as those are for teacher-side AI features. The new student-facing JustAI system uses completely separate tables with `justai_` prefix.

### New Tables (JustAI Student Chat System)

#### 1. `justai_subscriptions`
Manages student subscriptions for AI chat access.

```sql
CREATE TABLE public.justai_subscriptions (
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
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  
  -- Stripe integration
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  stripe_price_id TEXT,
  
  -- Dates
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### 2. `justai_conversations`
Track all JustAI chat conversations (both text and voice).

```sql
CREATE TABLE public.justai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Conversation details
  title TEXT,
  conversation_type TEXT NOT NULL DEFAULT 'text_chat' 
    CHECK (conversation_type IN ('text_chat', 'voice_session')),
  scenario TEXT, -- 'career', 'travel', 'conversation', etc.
  
  -- Voice session flag
  is_voice_session BOOLEAN NOT NULL DEFAULT false,
  voice_session_duration INTEGER, -- seconds
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ
);

CREATE INDEX idx_justai_conversations_student ON public.justai_conversations(student_id);
CREATE INDEX idx_justai_conversations_type ON public.justai_conversations(conversation_type);
CREATE INDEX idx_justai_conversations_status ON public.justai_conversations(status);
```

#### 3. `justai_messages`
Store all chat messages (text and transcribed voice).

```sql
CREATE TABLE public.justai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.justai_conversations(id) ON DELETE CASCADE,
  
  -- Message content
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  
  -- Usage tracking
  tokens_used INTEGER DEFAULT 0,
  
  -- Voice-specific
  is_voice_message BOOLEAN NOT NULL DEFAULT false,
  audio_duration_seconds INTEGER,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_justai_messages_conversation ON public.justai_messages(conversation_id);
CREATE INDEX idx_justai_messages_created ON public.justai_messages(created_at DESC);
```

#### 4. `justai_voice_sessions`
Links AI conversations to virtual lessons for transcription processing.

```sql
CREATE TABLE public.justai_voice_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.justai_conversations(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- ElevenLabs conversation ID
  elevenlabs_conversation_id TEXT NOT NULL UNIQUE,
  
  -- Virtual lesson for transcription storage
  virtual_lesson_id UUID REFERENCES public.lessons(id) ON DELETE SET NULL,
  
  -- Voice session details
  total_duration_seconds INTEGER NOT NULL DEFAULT 0,
  student_speaking_time_seconds INTEGER NOT NULL DEFAULT 0,
  ai_speaking_time_seconds INTEGER NOT NULL DEFAULT 0,
  
  -- ElevenLabs usage tracking
  elevenlabs_character_count INTEGER NOT NULL DEFAULT 0,
  elevenlabs_cost_cents INTEGER NOT NULL DEFAULT 0,
  
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

CREATE INDEX idx_justai_voice_sessions_conversation ON public.justai_voice_sessions(conversation_id);
CREATE INDEX idx_justai_voice_sessions_elevenlabs ON public.justai_voice_sessions(elevenlabs_conversation_id);
CREATE INDEX idx_justai_voice_sessions_student ON public.justai_voice_sessions(student_id);
```

#### 5. `justai_agent_configs`
Store personalized AI agent configurations based on student onboarding.

```sql
CREATE TABLE public.justai_agent_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Personalization data
  learning_goals TEXT[] NOT NULL, -- ['career', 'travel', etc.]
  interests TEXT[] NOT NULL,
  cefr_level TEXT NOT NULL,
  
  -- Voice preferences
  preferred_voice_id TEXT,
  speaking_rate DECIMAL(3,2) DEFAULT 1.0,
  
  -- Teaching style
  correction_style TEXT CHECK (correction_style IN ('gentle', 'balanced', 'strict')) DEFAULT 'balanced',
  formality_level TEXT CHECK (formality_level IN ('casual', 'professional', 'academic')) DEFAULT 'casual',
  
  -- Dynamic system prompt (generated from student profile)
  system_prompt_template TEXT NOT NULL,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  
  CONSTRAINT unique_active_config UNIQUE (student_id, is_active)
);
```

#### 6. `justai_usage_log`
Track message usage for billing and analytics.

```sql
CREATE TABLE public.justai_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.justai_subscriptions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Message details
  message_id UUID REFERENCES public.justai_messages(id),
  conversation_id UUID REFERENCES public.justai_conversations(id),
  
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

CREATE INDEX idx_justai_usage_subscription ON public.justai_usage_log(subscription_id);
CREATE INDEX idx_justai_usage_student ON public.justai_usage_log(student_id);
CREATE INDEX idx_justai_usage_period ON public.justai_usage_log(billing_period_start, billing_period_end);
```

#### 7. `justai_subscription_plans`
Define available subscription plans.

```sql
CREATE TABLE public.justai_subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Plan details
  plan_name TEXT NOT NULL UNIQUE,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('basic', 'premium', 'unlimited')),
  description TEXT,
  
  -- Limits
  monthly_message_limit INTEGER, -- NULL for unlimited
  includes_voice BOOLEAN NOT NULL DEFAULT false,
  
  -- Pricing
  price_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  
  -- Stripe
  stripe_price_id TEXT NOT NULL UNIQUE,
  stripe_product_id TEXT,
  
  -- Features (JSONB for flexibility)
  features JSONB DEFAULT '[]'::jsonb,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Row Level Security (RLS)

```sql
-- justai_subscriptions
ALTER TABLE public.justai_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view their own subscriptions"
ON public.justai_subscriptions FOR SELECT
USING (student_id = auth.uid());

CREATE POLICY "Students can update their own subscriptions"
ON public.justai_subscriptions FOR UPDATE
USING (student_id = auth.uid());

CREATE POLICY "Admins can manage all subscriptions"
ON public.justai_subscriptions FOR ALL
USING (public.is_admin());

-- justai_conversations
ALTER TABLE public.justai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view their own conversations"
ON public.justai_conversations FOR SELECT
USING (student_id = auth.uid());

CREATE POLICY "Students can insert their own conversations"
ON public.justai_conversations FOR INSERT
WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students can update their own conversations"
ON public.justai_conversations FOR UPDATE
USING (student_id = auth.uid());

CREATE POLICY "Admins can view all conversations"
ON public.justai_conversations FOR SELECT
USING (public.is_admin());

-- justai_messages
ALTER TABLE public.justai_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view messages in their conversations"
ON public.justai_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.justai_conversations
    WHERE id = justai_messages.conversation_id
    AND student_id = auth.uid()
  )
);

CREATE POLICY "Students can insert messages in their conversations"
ON public.justai_messages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.justai_conversations
    WHERE id = justai_messages.conversation_id
    AND student_id = auth.uid()
  )
);

-- justai_voice_sessions
ALTER TABLE public.justai_voice_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view their own voice sessions"
ON public.justai_voice_sessions FOR SELECT
USING (student_id = auth.uid());

CREATE POLICY "Students can insert their own voice sessions"
ON public.justai_voice_sessions FOR INSERT
WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students can update their own voice sessions"
ON public.justai_voice_sessions FOR UPDATE
USING (student_id = auth.uid());

-- justai_agent_configs
ALTER TABLE public.justai_agent_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view their own agent configs"
ON public.justai_agent_configs FOR SELECT
USING (student_id = auth.uid());

CREATE POLICY "Students can update their own agent configs"
ON public.justai_agent_configs FOR UPDATE
USING (student_id = auth.uid());

CREATE POLICY "Students can insert their own agent configs"
ON public.justai_agent_configs FOR INSERT
WITH CHECK (student_id = auth.uid());

CREATE POLICY "Admins can manage all agent configs"
ON public.justai_agent_configs FOR ALL
USING (public.is_admin());

-- justai_usage_log
ALTER TABLE public.justai_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view their own usage"
ON public.justai_usage_log FOR SELECT
USING (student_id = auth.uid());

CREATE POLICY "System can insert usage logs"
ON public.justai_usage_log FOR INSERT
WITH CHECK (true);

-- justai_subscription_plans
ALTER TABLE public.justai_subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active plans"
ON public.justai_subscription_plans FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage plans"
ON public.justai_subscription_plans FOR ALL
USING (public.is_admin());
```

---

## Database Functions

### 1. Check Subscription Access

```sql
CREATE OR REPLACE FUNCTION public.check_justai_subscription_access(
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
BEGIN
  -- Get active subscription
  SELECT * INTO v_sub
  FROM public.justai_subscriptions
  WHERE student_id = p_student_id
    AND status = 'active'
    AND current_period_end > NOW()
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- No active subscription
  IF v_sub IS NULL THEN
    RETURN QUERY SELECT false, NULL::TEXT, false, 0, NULL::TIMESTAMPTZ, NULL::UUID;
    RETURN;
  END IF;
  
  -- Check message limit
  IF v_sub.monthly_message_limit IS NULL THEN
    -- Unlimited plan
    RETURN QUERY SELECT 
      true,
      v_sub.status,
      true,
      NULL::INTEGER,
      v_sub.current_period_end,
      v_sub.id;
    RETURN;
  END IF;
  
  -- Limited plan
  RETURN QUERY SELECT 
    true,
    v_sub.status,
    v_sub.messages_used_this_period < v_sub.monthly_message_limit,
    v_sub.monthly_message_limit - v_sub.messages_used_this_period,
    v_sub.current_period_end,
    v_sub.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 2. Log Message Usage

```sql
CREATE OR REPLACE FUNCTION public.log_justai_message_usage(
  p_subscription_id UUID,
  p_student_id UUID,
  p_message_id UUID,
  p_conversation_id UUID,
  p_tokens_used INTEGER,
  p_cost_cents INTEGER,
  p_is_voice BOOLEAN DEFAULT false,
  p_elevenlabs_chars INTEGER DEFAULT 0
)
RETURNS VOID AS $$
DECLARE
  v_sub RECORD;
BEGIN
  -- Get subscription details
  SELECT * INTO v_sub
  FROM public.justai_subscriptions
  WHERE id = p_subscription_id;
  
  -- Insert usage log
  INSERT INTO public.justai_usage_log (
    subscription_id,
    student_id,
    message_id,
    conversation_id,
    tokens_used,
    cost_cents,
    is_voice_message,
    elevenlabs_characters,
    billing_period_start,
    billing_period_end
  ) VALUES (
    p_subscription_id,
    p_student_id,
    p_message_id,
    p_conversation_id,
    p_tokens_used,
    p_cost_cents,
    p_is_voice,
    p_elevenlabs_chars,
    v_sub.current_period_start,
    v_sub.current_period_end
  );
  
  -- Increment messages used
  UPDATE public.justai_subscriptions
  SET 
    messages_used_this_period = messages_used_this_period + 1,
    updated_at = NOW()
  WHERE id = p_subscription_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 3. Reset Subscription Period

```sql
CREATE OR REPLACE FUNCTION public.reset_justai_subscription_period(
  p_subscription_id UUID,
  p_new_period_start TIMESTAMPTZ,
  p_new_period_end TIMESTAMPTZ
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.justai_subscriptions
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

## Extend `profiles` Table (Optional)

If you want to store JustAI preferences directly on the profile:

```sql
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS justai_onboarding_completed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS justai_preferred_voice TEXT,
ADD COLUMN IF NOT EXISTS justai_correction_style TEXT CHECK (justai_correction_style IN ('gentle', 'balanced', 'strict')) DEFAULT 'balanced';
```

---

## ElevenLabs Agent Configuration

### One Agent for All Students

**Agent ID**: Store as environment variable `ELEVENLABS_AGENT_ID`

**Base Agent Configuration** (set in ElevenLabs UI):
- **Name**: "AI English Teacher"
- **Voice**: Default teacher voice (e.g., Rachel - American English)
- **Language**: English (can be overridden per student)
- **LLM**: GPT-4 or Claude (configurable)
- **System Prompt**: Base template (will be overridden per student)

**Dynamic Personalization** (passed at conversation start):
```typescript
{
  "conversation_initiation_client_data": {
    // Override system prompt with student-specific instructions
    "conversation_config_override": {
      "agent": {
        "prompt": {
          "prompt": `You are Alex, a friendly English teacher.

Student Profile:
- Name: {{student_name}}
- Level: {{cefr_level}}
- Goals: {{learning_goals}}
- Interests: {{interests}}
- Correction Style: {{correction_style}}

Instructions:
- Adapt conversation difficulty to {{cefr_level}} level
- Discuss topics related to: {{interests}}
- Use {{correction_style}} error correction approach
- Be encouraging and supportive
- Ask follow-up questions to keep conversation flowing

Current Scenario: {{scenario_description}}`
        },
        "first_message": "Hi {{student_name}}! I'm Alex, your English teacher. {{scenario_intro}} What would you like to talk about?",
        "language": "en"
      },
      "tts": {
        "voice_id": "{{preferred_voice_id}}" // Student's chosen voice
      }
    },
    
    // Dynamic variables injected into prompt
    "dynamic_variables": {
      "student_name": "John",
      "cefr_level": "B1",
      "learning_goals": "career, travel",
      "interests": "technology, movies, food",
      "correction_style": "balanced",
      "scenario_description": "Career Interview Practice",
      "scenario_intro": "Let's practice for your upcoming job interview!",
      "preferred_voice_id": "21m00Tcm4TlvDq8ikWAM"
    },
    
    // Track which student this conversation belongs to
    "user_id": "student_uuid_here"
  }
}
```

### How It Works

1. **One Agent Definition** in ElevenLabs dashboard
2. **Per-Student Customization** via `conversation_initiation_client_data` when starting conversation
3. **Dynamic Variables** (`{{variable_name}}`) replaced at runtime
4. **Overrides** allow complete system prompt and voice customization per conversation

**Benefits**:
- ✅ Only one agent to maintain and update
- ✅ Centralized configuration and improvements
- ✅ Easy to A/B test prompts across all students
- ✅ Lower complexity than managing hundreds of agents

---

## Voice Session Flow

### Edge Functions Organization

All JustAI-related Edge Functions should be prefixed with `justai-` or use descriptive ElevenLabs-specific names:

**JustAI Functions**:
- `justai-subscription-create` - Create Stripe subscription
- `justai-subscription-manage` - Manage subscription (cancel, upgrade)
- `justai-text-chat` - Handle text-only chat messages
- `stripe-webhook-justai` - Handle Stripe webhooks for JustAI subscriptions

**ElevenLabs Functions**:
- `elevenlabs-get-signed-url` - Generate signed URL for WebSocket connection
- `elevenlabs-get-conversation` - Fetch conversation transcript from ElevenLabs

**Avoid**: Using generic names like `ai-chat` that could conflict with teacher-side AI features.

---

### 1. Start Voice Session

#### Frontend: Initialize Conversation

```typescript
// src/hooks/useVoiceChat.ts
import { useConversation } from '@elevenlabs/react';
import { supabase } from '@/lib/supabase';

export function useVoiceChat() {
  const conversation = useConversation({
    // Callbacks for real-time events
    onConnect: () => {
      console.log('Connected to ElevenLabs');
    },
    
    onMessage: (message) => {
      // Real-time transcript updates
      if (message.source === 'user') {
        handleUserTranscript(message.text);
      } else if (message.source === 'ai') {
        handleAIResponse(message.text);
      }
    },
    
    onDisconnect: () => {
      console.log('Disconnected');
      endVoiceSession();
    },
    
    onError: (error) => {
      console.error('Voice chat error:', error);
    }
  });

  const startVoiceSession = async (scenario?: string) => {
    // 1. Check subscription access
    const { data: access } = await supabase.rpc('check_justai_subscription_access', {
      p_student_id: userId
    });
    
    if (!access.can_send_message) {
      throw new Error('Message limit reached');
    }
    
    // 2. Get student profile and agent config
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    const { data: agentConfig } = await supabase
      .from('justai_agent_configs')
      .select('*')
      .eq('student_id', userId)
      .eq('is_active', true)
      .single();
    
    // 3. Create conversation record
    const { data: conversationRecord } = await supabase
      .from('justai_conversations')
      .insert({
        student_id: userId,
        conversation_type: 'voice_session',
        is_voice_session: true,
        scenario: scenario || 'conversation',
        title: scenario || 'Voice Conversation'
      })
      .select()
      .single();
    
    // 4. Create virtual lesson for transcription storage
    const { data: virtualLesson } = await supabase
      .from('lessons')
      .insert({
        teacher_id: null, // AI teacher, no human teacher
        student_id: userId,
        starts_at: new Date().toISOString(),
        ends_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour max
        status: 'scheduled',
        title: `AI Voice Session - ${scenario || 'Practice'}`,
        is_ai_session: true // New flag to distinguish AI sessions
      })
      .select()
      .single();
    
    // 5. Get signed URL from backend with personalization data
    const { data: signedUrlData } = await supabase.functions.invoke(
      'elevenlabs-get-signed-url',
      {
        body: {
          student_id: userId,
          conversation_id: conversationRecord.id,
          virtual_lesson_id: virtualLesson.id,
          scenario: scenario
        }
      }
    );
    
    // 6. Start ElevenLabs conversation with signed URL
    const elevenLabsConversationId = await conversation.startSession({
      signedUrl: signedUrlData.signed_url,
      connectionType: 'websocket',
      userId: userId // Track which student this is
    });
    
    // 7. Create voice session record
    const { data: voiceSession } = await supabase
      .from('justai_voice_sessions')
      .insert({
        conversation_id: conversationRecord.id,
        student_id: userId,
        elevenlabs_conversation_id: elevenLabsConversationId,
        virtual_lesson_id: virtualLesson.id,
        started_at: new Date().toISOString()
      })
      .select()
      .single();
    
    return {
      conversation,
      voiceSession,
      conversationRecord,
      virtualLesson
    };
  };
  
  return {
    conversation,
    startVoiceSession
  };
}
```

#### Backend: Generate Signed URL with Personalization

```typescript
// supabase/functions/elevenlabs-get-signed-url/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req: Request) => {
  try {
    const { student_id, conversation_id, virtual_lesson_id, scenario } = await req.json();
    
    // Get Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    // Fetch student profile and agent config
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, cefr_level, native_language')
      .eq('id', student_id)
      .single();
    
    const { data: agentConfig } = await supabase
      .from('justai_agent_configs')
      .select('*')
      .eq('student_id', student_id)
      .eq('is_active', true)
      .single();
    
    // Build personalized system prompt
    const systemPrompt = buildSystemPrompt(profile, agentConfig, scenario);
    const firstMessage = buildFirstMessage(profile, scenario);
    
    // Prepare conversation initialization data
    const conversationInitData = {
      conversation_config_override: {
        agent: {
          prompt: {
            prompt: systemPrompt
          },
          first_message: firstMessage,
          language: 'en'
        },
        tts: {
          voice_id: agentConfig.preferred_voice_id || '21m00Tcm4TlvDq8ikWAM'
        }
      },
      dynamic_variables: {
        student_name: profile.display_name,
        cefr_level: profile.cefr_level,
        learning_goals: agentConfig.learning_goals.join(', '),
        interests: agentConfig.interests.join(', '),
        correction_style: agentConfig.correction_style,
        formality_level: agentConfig.formality_level
      },
      user_id: student_id
    };
    
    // Get signed URL from ElevenLabs
    const agentId = Deno.env.get('ELEVENLABS_AGENT_ID');
    const apiKey = Deno.env.get('ELEVENLABS_API_KEY');
    
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`,
      {
        method: 'GET',
        headers: {
          'xi-api-key': apiKey!
        }
      }
    );
    
    if (!response.ok) {
      throw new Error('Failed to get signed URL from ElevenLabs');
    }
    
    const { signed_url } = await response.json();
    
    return new Response(
      JSON.stringify({
        signed_url,
        conversation_init_data: conversationInitData
      }),
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});

function buildSystemPrompt(profile: any, config: any, scenario?: string): string {
  const scenarioPrompts = {
    career: `Focus on professional English, job interviews, and workplace communication.`,
    travel: `Focus on travel scenarios, ordering food, asking for directions, cultural exchange.`,
    academic: `Focus on academic discussions, critical thinking, and formal language.`,
    conversation: `Engage in natural, casual conversation about everyday topics.`,
    test_prep: `Practice IELTS/TOEFL speaking tasks with structured feedback.`
  };
  
  const scenarioInstruction = scenario ? scenarioPrompts[scenario] || '' : 'Adapt to student interests.';
  
  return `You are Alex, a friendly and encouraging English teacher.

Student Profile:
- Name: ${profile.display_name}
- Level: ${profile.cefr_level} (CEFR)
- Native Language: ${profile.native_language}
- Learning Goals: ${config.learning_goals.join(', ')}
- Interests: ${config.interests.join(', ')}

Teaching Instructions:
- Adapt conversation difficulty to ${profile.cefr_level} level
- Use ${config.correction_style} error correction (gentle = only critical errors, balanced = helpful corrections, strict = all errors)
- Maintain ${config.formality_level} tone
- ${scenarioInstruction}
- Ask follow-up questions to keep conversation flowing
- Be encouraging and supportive
- Introduce vocabulary naturally from their interest areas
- If they struggle, rephrase or simplify
- Celebrate progress and effort

Remember: Your goal is to build their confidence while helping them improve!`;
}

function buildFirstMessage(profile: any, scenario?: string): string {
  const scenarioGreetings = {
    career: `Hi ${profile.display_name}! I'm Alex. Let's practice for your career goals today! What kind of job are you preparing for?`,
    travel: `Hey ${profile.display_name}! I'm Alex, your English teacher. Ready to practice some travel conversations? Where would you like to go?`,
    academic: `Hello ${profile.display_name}! I'm Alex. Let's have an academic discussion today. What topic interests you?`,
    conversation: `Hi ${profile.display_name}! I'm Alex. Let's just chat! How's your day going?`,
    test_prep: `Hi ${profile.display_name}! I'm Alex. Let's practice for your English exam. Ready to start?`
  };
  
  return scenario && scenarioGreetings[scenario]
    ? scenarioGreetings[scenario]
    : `Hi ${profile.display_name}! I'm Alex, your English teacher. What would you like to talk about today?`;
}
```

### 2. Real-Time Conversation with Transcript Capture

#### Frontend: Handle WebSocket Messages

```typescript
// Handle real-time transcript updates
const handleUserTranscript = async (text: string, timestamp: number) => {
  // Save to database immediately
  await supabase
    .from('lesson_transcription_segments')
    .insert({
      lesson_id: virtualLesson.id,
      speaker_id: userId,
      speaker_role: 'student',
      transcript: text,
      start_time: timestamp,
      end_time: timestamp + 2, // Estimated
      created_at: new Date().toISOString()
    });
  
  // Also save to chat messages for conversation view
  await supabase
    .from('justai_messages')
    .insert({
      conversation_id: conversationRecord.id,
      role: 'user',
      content: text,
      is_voice_message: true,
      tokens_used: Math.ceil(text.length / 4) // Rough estimate
    });
  
  // Update UI
  setTranscript(prev => [...prev, {
    role: 'user',
    text,
    timestamp
  }]);
};

const handleAIResponse = async (text: string, timestamp: number) => {
  // Save AI response to database
  await supabase
    .from('lesson_transcription_segments')
    .insert({
      lesson_id: virtualLesson.id,
      speaker_id: null, // AI speaker
      speaker_role: 'ai_teacher',
      transcript: text,
      start_time: timestamp,
      end_time: timestamp + (text.length * 0.1), // Estimate based on speech rate
      created_at: new Date().toISOString()
    });
  
  // Save to chat messages
  await supabase
    .from('justai_messages')
    .insert({
      conversation_id: conversationRecord.id,
      role: 'assistant',
      content: text,
      is_voice_message: true,
      tokens_used: Math.ceil(text.length / 4)
    });
  
  // Update UI
  setTranscript(prev => [...prev, {
    role: 'assistant',
    text,
    timestamp
  }]);
  
  // Log usage for subscription
  await supabase.rpc('log_justai_message_usage', {
    p_subscription_id: subscription.id,
    p_student_id: userId,
    p_message_id: null,
    p_conversation_id: conversationRecord.id,
    p_tokens_used: Math.ceil(text.length / 4),
    p_cost_cents: Math.ceil(text.length * 0.03), // ~$0.30 per 1K chars
    p_is_voice: true,
    p_elevenlabs_chars: text.length
  });
};
```

### 3. End Session and Get Full Transcript

```typescript
const endVoiceSession = async () => {
  // 1. End WebSocket connection
  await conversation.endSession();
  
  // 2. Fetch complete conversation data from ElevenLabs
  const { data: elevenLabsConvo } = await supabase.functions.invoke(
    'elevenlabs-get-conversation',
    {
      body: {
        conversation_id: voiceSession.elevenlabs_conversation_id
      }
    }
  );
  
  // 3. Update lesson status
  await supabase
    .from('lessons')
    .update({
      status: 'completed',
      ends_at: new Date().toISOString()
    })
    .eq('id', virtualLesson.id);
  
  // 4. Update voice session with final metrics
  await supabase
    .from('justai_voice_sessions')
    .update({
      ended_at: new Date().toISOString(),
      total_duration_seconds: elevenLabsConvo.metadata.call_duration_secs,
      elevenlabs_character_count: elevenLabsConvo.metadata.agent_output_character_count,
      elevenlabs_cost_cents: Math.ceil(elevenLabsConvo.metadata.agent_output_character_count * 0.03),
      transcription_complete: true
    })
    .eq('id', voiceSession.id);
  
  // 5. Trigger vocabulary and grammar processing
  await supabase.functions.invoke('process-completed-lessons', {
    body: { lessonId: virtualLesson.id }
  });
  
  // This will:
  // - Extract vocabulary from transcripts (already in lesson_transcription_segments)
  // - Identify grammar patterns
  // - Add words to student's dictionary
  // - Schedule spaced repetition reviews
  // - Update student progress metrics
};
```

#### Backend: Fetch ElevenLabs Conversation Details

```typescript
// supabase/functions/elevenlabs-get-conversation/index.ts

serve(async (req: Request) => {
  const { conversation_id } = await req.json();
  
  const apiKey = Deno.env.get('ELEVENLABS_API_KEY');
  
  // Fetch complete conversation with transcript
  const response = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversations/${conversation_id}`,
    {
      headers: {
        'xi-api-key': apiKey!
      }
    }
  );
  
  if (!response.ok) {
    throw new Error('Failed to fetch conversation from ElevenLabs');
  }
  
  const conversationData = await response.json();
  
  // conversationData includes:
  // {
  //   agent_id: string,
  //   conversation_id: string,
  //   status: 'done',
  //   transcript: [
  //     { role: 'user', message: '...', time_in_call_secs: 10 },
  //     { role: 'agent', message: '...', time_in_call_secs: 12 }
  //   ],
  //   metadata: {
  //     call_duration_secs: 300,
  //     agent_output_character_count: 1500,
  //     ...
  //   }
  // }
  
  return new Response(
    JSON.stringify(conversationData),
    {
      headers: { 'Content-Type': 'application/json' }
    }
  );
});
```

---

## Transcript Availability

### Real-Time Transcripts

✅ **During Conversation**: Transcripts are available in real-time via WebSocket events:
- `user_transcript` - Student's speech transcribed
- `agent_response` - AI's response text

These are saved to `lesson_transcription_segments` as they arrive.

### Post-Conversation Transcripts

✅ **After Conversation**: Full transcript available via REST API:

```bash
GET https://api.elevenlabs.io/v1/convai/conversations/{conversation_id}
```

**Response includes**:
```json
{
  "transcript": [
    {
      "role": "user",
      "message": "Hello, how are you?",
      "time_in_call_secs": 10
    },
    {
      "role": "agent",
      "message": "I'm doing great! How about you?",
      "time_in_call_secs": 12
    }
  ],
  "metadata": {
    "call_duration_secs": 300,
    "start_time_unix_secs": 1234567890
  }
}
```

This can be used to:
- Verify all transcripts were captured
- Fill in any missing segments
- Generate session summaries
- Analyze conversation flow

---

## Frontend Components

### Voice Chat Interface

```typescript
// src/pages/AIChatVoice.tsx

import { useVoiceChat } from '@/hooks/useVoiceChat';
import { useState, useEffect } from 'react';

export function AIChatVoice() {
  const { conversation, startVoiceSession } = useVoiceChat();
  const [isConnected, setIsConnected] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [scenario, setScenario] = useState<string>('conversation');
  
  const handleStartConversation = async () => {
    try {
      await startVoiceSession(scenario);
      setIsConnected(true);
    } catch (error) {
      console.error('Failed to start voice session:', error);
      alert(error.message);
    }
  };
  
  const handleEndConversation = async () => {
    await conversation.endSession();
    setIsConnected(false);
  };
  
  return (
    <div className="voice-chat h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3">
        <h1 className="text-xl font-semibold">AI Voice Chat</h1>
      </div>
      
      {!isConnected ? (
        // Scenario Selection Screen
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <h2 className="text-2xl font-bold mb-6">Choose a conversation topic</h2>
          
          <div className="grid grid-cols-2 gap-4 max-w-md">
            {SCENARIOS.map(s => (
              <button
                key={s.id}
                onClick={() => setScenario(s.id)}
                className={`p-6 rounded-lg border-2 ${
                  scenario === s.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                }`}
              >
                <div className="text-4xl mb-2">{s.icon}</div>
                <div className="font-semibold">{s.name}</div>
              </button>
            ))}
          </div>
          
          <button
            onClick={handleStartConversation}
            className="mt-8 px-8 py-4 bg-blue-500 text-white rounded-full text-lg font-semibold"
          >
            Start Conversation
          </button>
        </div>
      ) : (
        // Active Conversation Screen
        <>
          {/* Transcript Display */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {transcript.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] px-4 py-2 rounded-lg ${
                    msg.role === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-900'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
          </div>
          
          {/* Voice Controls */}
          <div className="bg-white border-t p-6">
            <div className="flex justify-center items-center space-x-4">
              {/* Microphone Button */}
              <button
                className={`w-20 h-20 rounded-full ${
                  conversation.isSpeaking
                    ? 'bg-green-500 animate-pulse'
                    : 'bg-blue-500'
                }`}
              >
                🎤
              </button>
              
              {/* End Call Button */}
              <button
                onClick={handleEndConversation}
                className="w-20 h-20 rounded-full bg-red-500 text-white"
              >
                ✖️
              </button>
            </div>
            
            <div className="text-center mt-4 text-sm text-gray-600">
              {conversation.isSpeaking ? 'AI is speaking...' : 'Your turn to speak'}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const SCENARIOS = [
  { id: 'career', name: 'Career', icon: '💼' },
  { id: 'travel', name: 'Travel', icon: '✈️' },
  { id: 'conversation', name: 'Chat', icon: '💬' },
  { id: 'test_prep', name: 'Test Prep', icon: '📝' }
];
```

---

## Cost Management

### ElevenLabs Pricing

**Conversational AI Pricing** (all-in-one: STT + LLM + TTS):
- ~$0.30 per 1,000 characters generated (AI output)
- Includes complete conversation infrastructure

### Monthly Cost Projections

**Average Voice Exchange**:
- Student speaks: ~30 seconds → transcribed (included)
- AI responds: ~200 characters → $0.06
- **Total per exchange: ~$0.06**

**Monthly Costs by Plan**:
- **Basic** (100 messages): ~$6/month
- **Premium** (500 messages): ~$30/month
- **Unlimited** (avg 1000 messages): ~$60/month

### Subscription Pricing

**Voice-Enabled Tiers**:
- **Basic Plus**: $14.99/month (100 voice messages) - 60% margin
- **Premium Plus**: $39.99/month (500 voice messages) - 25% margin
- **Unlimited Plus**: $79.99/month (unlimited) - 25%+ margin

---

## Key Benefits of This Architecture

### ✅ Single Agent Simplicity
- One agent to configure and maintain
- Easy to update prompts and improve teaching approach
- Centralized A/B testing and optimization
- Lower operational complexity

### ✅ Complete Transcript Access
- Real-time transcripts during conversation (WebSocket events)
- Full transcript history via REST API
- Stored in database for vocabulary/grammar analysis
- Can be reviewed and exported by students

### ✅ All-in-One Solution
- No need to manage separate STT, LLM, and TTS services
- Single vendor relationship with ElevenLabs
- Simplified cost tracking (one price per character)
- Lower latency (optimized full-stack)

### ✅ Personalization at Scale
- Each student gets personalized experience
- Dynamic prompts based on profile and goals
- Voice preference per student
- All without creating separate agents

### ✅ Seamless Integration
- Reuses existing lesson transcription infrastructure
- Works with existing vocabulary and grammar analysis
- Fits into current database schema
- Minimal changes to existing code

---

## Implementation Checklist

### Phase 1: ElevenLabs Setup
- [ ] Create ElevenLabs account
- [ ] Create ONE agent in ElevenLabs dashboard
- [ ] Configure base agent settings (name, voice, LLM)
- [ ] Test agent with sample conversations
- [ ] Get Agent ID and API key

### Phase 2: Database Schema
- [ ] Create `justai_subscriptions` table
- [ ] Create `justai_conversations` table
- [ ] Create `justai_messages` table
- [ ] Create `justai_voice_sessions` table
- [ ] Create `justai_agent_configs` table
- [ ] Create `justai_usage_log` table
- [ ] Create `justai_subscription_plans` table
- [ ] Add RLS policies for all JustAI tables
- [ ] Create database functions (`check_justai_subscription_access`, etc.)

### Phase 3: Backend (Edge Functions)
- [ ] Create `elevenlabs-get-signed-url` function
- [ ] Create `elevenlabs-get-conversation` function
- [ ] Create `justai-subscription-create` function (Stripe integration)
- [ ] Create `stripe-webhook-justai-subscription` function
- [ ] Implement system prompt generation logic
- [ ] Test personalization with different student profiles

### Phase 4: Frontend
- [ ] Install `@elevenlabs/react` SDK
- [ ] Build voice chat interface component
- [ ] Implement real-time transcript display
- [ ] Add scenario selection UI
- [ ] Test on mobile devices

### Phase 5: Integration
- [ ] Connect to vocabulary analysis pipeline
- [ ] Test grammar extraction from transcripts
- [ ] Verify spaced repetition scheduling
- [ ] Create post-session summary reports

### Phase 6: Testing
- [ ] Test with multiple students simultaneously
- [ ] Verify personalization works per student
- [ ] Check transcript accuracy and completeness
- [ ] Monitor cost per conversation
- [ ] Test subscription limit enforcement

---

## Conclusion

This architecture leverages **ElevenLabs Conversational AI** as a complete end-to-end voice conversation platform, using **one shared agent** that personalizes dynamically for each student. This approach provides:

1. **Simplicity**: One agent, not hundreds
2. **Complete Transcripts**: Real-time and post-conversation access
3. **All-in-One**: No need for separate STT/LLM/TTS services
4. **Personalization**: Each student gets tailored experience
5. **Cost-Effective**: Clear pricing, good margins
6. **Scalable**: Works for 10 or 10,000 students

### 🔑 Key Naming Conventions (Critical!)

**Database Tables**:
- ✅ Use `justai_*` prefix for all new student-facing AI tables
- ❌ Avoid `ai_*` prefix (reserved for teacher-side features)

**Edge Functions**:
- ✅ Use `justai-*` prefix for subscription/chat management
- ✅ Use `elevenlabs-*` prefix for ElevenLabs-specific operations
- ❌ Avoid generic names like `ai-chat` or `ai-subscription`

**Frontend Components/Hooks**:
- ✅ Use `JustAI*` or `useJustAI*` naming (e.g., `JustAIChatHome`, `useJustAISubscription`)
- ❌ Avoid generic `AI*` or `useAI*` naming

**Example Structure**:
```
Database:
├── justai_subscriptions
├── justai_conversations
├── justai_messages
├── justai_voice_sessions
├── justai_agent_configs
└── justai_usage_log

Edge Functions:
├── justai-subscription-create
├── justai-subscription-manage
├── justai-text-chat
├── elevenlabs-get-signed-url
├── elevenlabs-get-conversation
└── stripe-webhook-justai

Frontend:
├── src/pages/JustAIChatHome.tsx
├── src/pages/JustAIChatVoice.tsx
├── src/pages/JustAISubscriptionPlans.tsx
├── src/hooks/useJustAISubscription.ts
└── src/hooks/useJustAIVoiceChat.ts
```

This creates a **complete language learning ecosystem** where students can:
- 📅 Book live lessons with teachers
- 🤖 Practice with AI (JustAI) between lessons
- 🎤 Speak naturally via voice
- 📊 Track progress automatically
- 🎯 Review vocabulary with spaced repetition
- 🏆 Achieve fluency faster

**Bottom line**: The JustAI Chat Subscription with voice integration transforms JustTalk from a "lesson booking platform" into a "complete language learning solution" that maximizes student engagement, retention, and outcomes while creating sustainable recurring revenue - all while keeping teacher-side and student-side AI features completely separate and maintainable.

The result is a powerful, maintainable voice learning platform that feels like a personal English tutor for each student.
