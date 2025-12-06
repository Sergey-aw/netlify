# JustAI Deployment Guide for Main Supabase Project

## Overview

This guide provides step-by-step instructions for deploying the JustAI (student-facing AI chat subscription) features to your **main Supabase project** that already has existing lesson booking, teacher-side AI features, and other functionality.

**Important**: The JustAI system uses the `justai_` prefix for all tables, functions, and Edge Functions to keep it completely separate from existing features.

---

## Prerequisites

### 1. Supabase CLI Setup

Ensure you have the Supabase CLI installed and linked to your main project:

```bash
# Install Supabase CLI (if not already installed)
npm install -g supabase

# Link to your main project
cd /path/to/your/main/supabase/project
supabase link --project-ref YOUR_PROJECT_REF

# Verify connection
supabase status
```

### 2. Required Environment Variables

Add these to your Supabase project secrets:

```bash
# ElevenLabs API
supabase secrets set ELEVENLABS_API_KEY=sk_your_key_here
supabase secrets set ELEVENLABS_AGENT_ID=agent_your_id_here

# Stripe (for JustAI subscriptions)
# Note: Use the same Stripe account as your main app, but separate webhook endpoints
supabase secrets set STRIPE_SECRET_KEY=sk_live_or_test_your_key_here
supabase secrets set STRIPE_JUSTAI_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Verify secrets
supabase secrets list
```

**Important Notes about Stripe Configuration:**

1. **Use the SAME Stripe account** as your existing lesson booking system
2. **Create a SEPARATE webhook endpoint** for JustAI subscriptions:
   - Go to Stripe Dashboard → Developers → Webhooks
   - Add endpoint: `https://your-project-ref.supabase.co/functions/v1/stripe-webhook-justai`
   - Select events: `customer.subscription.*`, `invoice.payment_succeeded`, `invoice.payment_failed`
   - Copy the webhook signing secret and use it for `STRIPE_WEBHOOK_SECRET`

3. **Secret Naming**:
   - ✅ `STRIPE_SECRET_KEY` - Your Stripe API secret key (shared with main app)
   - ✅ `STRIPE_WEBHOOK_SECRET` - Webhook signing secret for JustAI endpoint
   - ❌ Don't use `STRIPE_JUSTAI_WEBHOOK_SECRET` (not needed, keep it simple)

4. **Products and Prices**:
   - Create separate Stripe Products for JustAI subscriptions
   - Tag them with metadata: `system: justai` for easy filtering
   - Use the price IDs in your `justai_subscription_plans` table

---

## Part 1: Database Schema Deployment

### Step 1: Create Migration Files

Create a new migration in your main project:

```bash
cd /path/to/your/main/supabase/project
supabase migration new create_justai_tables
```

This will create a file like `supabase/migrations/20241203000001_create_justai_tables.sql`

### Step 2: Copy SQL Schema

Copy the following SQL into your new migration file:

```sql
-- ============================================
-- JustAI Student Chat Subscription System
-- ============================================
-- This migration creates all tables for the student-facing AI chat feature
-- All tables use the justai_ prefix to avoid conflicts with existing ai_ tables

-- 1. JustAI Subscriptions
-- ============================================
CREATE TABLE IF NOT EXISTS public.justai_subscriptions (
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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT messages_used_check CHECK (messages_used_this_period >= 0)
);

CREATE INDEX IF NOT EXISTS idx_justai_subscriptions_student ON public.justai_subscriptions(student_id);
CREATE INDEX IF NOT EXISTS idx_justai_subscriptions_status ON public.justai_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_justai_subscriptions_stripe ON public.justai_subscriptions(stripe_subscription_id);

-- 2. JustAI Conversations
-- ============================================
CREATE TABLE IF NOT EXISTS public.justai_conversations (
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

CREATE INDEX IF NOT EXISTS idx_justai_conversations_student ON public.justai_conversations(student_id);
CREATE INDEX IF NOT EXISTS idx_justai_conversations_type ON public.justai_conversations(conversation_type);
CREATE INDEX IF NOT EXISTS idx_justai_conversations_status ON public.justai_conversations(status);

-- 3. JustAI Messages
-- ============================================
CREATE TABLE IF NOT EXISTS public.justai_messages (
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

CREATE INDEX IF NOT EXISTS idx_justai_messages_conversation ON public.justai_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_justai_messages_created ON public.justai_messages(created_at DESC);

-- 4. JustAI Voice Sessions
-- ============================================
CREATE TABLE IF NOT EXISTS public.justai_voice_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.justai_conversations(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- ElevenLabs conversation ID
  elevenlabs_conversation_id TEXT NOT NULL UNIQUE,
  
  -- Virtual lesson for transcription storage (reuses existing lessons table)
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

CREATE INDEX IF NOT EXISTS idx_justai_voice_sessions_conversation ON public.justai_voice_sessions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_justai_voice_sessions_elevenlabs ON public.justai_voice_sessions(elevenlabs_conversation_id);
CREATE INDEX IF NOT EXISTS idx_justai_voice_sessions_student ON public.justai_voice_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_justai_voice_sessions_lesson ON public.justai_voice_sessions(virtual_lesson_id);

-- 5. JustAI Agent Configs
-- ============================================
CREATE TABLE IF NOT EXISTS public.justai_agent_configs (
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

CREATE INDEX IF NOT EXISTS idx_justai_agent_configs_student ON public.justai_agent_configs(student_id);
CREATE INDEX IF NOT EXISTS idx_justai_agent_configs_active ON public.justai_agent_configs(is_active) WHERE is_active = true;

-- 6. JustAI Usage Log
-- ============================================
CREATE TABLE IF NOT EXISTS public.justai_usage_log (
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

CREATE INDEX IF NOT EXISTS idx_justai_usage_subscription ON public.justai_usage_log(subscription_id);
CREATE INDEX IF NOT EXISTS idx_justai_usage_student ON public.justai_usage_log(student_id);
CREATE INDEX IF NOT EXISTS idx_justai_usage_period ON public.justai_usage_log(billing_period_start, billing_period_end);

-- 7. JustAI Subscription Plans
-- ============================================
CREATE TABLE IF NOT EXISTS public.justai_subscription_plans (
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

CREATE INDEX IF NOT EXISTS idx_justai_plans_active ON public.justai_subscription_plans(is_active) WHERE is_active = true;

-- 8. Optional: Extend profiles table
-- ============================================
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS justai_onboarding_completed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS justai_preferred_voice TEXT,
ADD COLUMN IF NOT EXISTS justai_correction_style TEXT CHECK (justai_correction_style IN ('gentle', 'balanced', 'strict')) DEFAULT 'balanced';

-- 9. Optional: Add flag to lessons table for AI sessions
-- ============================================
ALTER TABLE public.lessons
ADD COLUMN IF NOT EXISTS is_ai_session BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_lessons_ai_session ON public.lessons(is_ai_session) WHERE is_ai_session = true;
```

### Step 3: Apply Migration

```bash
# Push migration to your Supabase project
supabase db push

# Or if you prefer to review first:
supabase db diff
supabase db push
```

### Step 4: Create RLS Policies

Create another migration for Row Level Security:

```bash
supabase migration new create_justai_rls_policies
```

Add this SQL:

```sql
-- ============================================
-- JustAI Row Level Security Policies
-- ============================================

-- 1. justai_subscriptions
-- ============================================
ALTER TABLE public.justai_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view their own subscriptions"
ON public.justai_subscriptions FOR SELECT
USING (student_id = auth.uid());

CREATE POLICY "Students can update their own subscriptions"
ON public.justai_subscriptions FOR UPDATE
USING (student_id = auth.uid());

CREATE POLICY "Admins can manage all subscriptions"
ON public.justai_subscriptions FOR ALL
USING (public.is_admin()); -- Assumes you have an is_admin() function

-- 2. justai_conversations
-- ============================================
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

-- 3. justai_messages
-- ============================================
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

-- 4. justai_voice_sessions
-- ============================================
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

-- 5. justai_agent_configs
-- ============================================
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

-- 6. justai_usage_log
-- ============================================
ALTER TABLE public.justai_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view their own usage"
ON public.justai_usage_log FOR SELECT
USING (student_id = auth.uid());

CREATE POLICY "System can insert usage logs"
ON public.justai_usage_log FOR INSERT
WITH CHECK (true); -- Service role will insert

-- 7. justai_subscription_plans
-- ============================================
ALTER TABLE public.justai_subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active plans"
ON public.justai_subscription_plans FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage plans"
ON public.justai_subscription_plans FOR ALL
USING (public.is_admin());
```

Apply the RLS migration:

```bash
supabase db push
```

### Step 5: Create Database Functions

Create another migration for PostgreSQL functions:

```bash
supabase migration new create_justai_functions
```

Add this SQL:

```sql
-- ============================================
-- JustAI Database Functions
-- ============================================

-- 1. Check Subscription Access
-- ============================================
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
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;

-- 2. Log Message Usage
-- ============================================
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
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sub RECORD;
BEGIN
  -- Get subscription details
  SELECT * INTO v_sub
  FROM public.justai_subscriptions
  WHERE id = p_subscription_id;
  
  IF v_sub IS NULL THEN
    RAISE EXCEPTION 'Subscription not found';
  END IF;
  
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
$$;

-- 3. Reset Subscription Period
-- ============================================
CREATE OR REPLACE FUNCTION public.reset_justai_subscription_period(
  p_subscription_id UUID,
  p_new_period_start TIMESTAMPTZ,
  p_new_period_end TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.justai_subscriptions
  SET 
    messages_used_this_period = 0,
    current_period_start = p_new_period_start,
    current_period_end = p_new_period_end,
    updated_at = NOW()
  WHERE id = p_subscription_id;
END;
$$;

-- 4. Get Active Subscription
-- ============================================
CREATE OR REPLACE FUNCTION public.get_active_justai_subscription(
  p_student_id UUID
)
RETURNS TABLE(
  subscription_id UUID,
  subscription_type TEXT,
  status TEXT,
  monthly_message_limit INTEGER,
  messages_used INTEGER,
  messages_remaining INTEGER,
  period_end TIMESTAMPTZ,
  stripe_subscription_id TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    id,
    subscription_type,
    status,
    monthly_message_limit,
    messages_used_this_period,
    CASE 
      WHEN monthly_message_limit IS NULL THEN NULL
      ELSE monthly_message_limit - messages_used_this_period
    END,
    current_period_end,
    stripe_subscription_id
  FROM public.justai_subscriptions
  WHERE student_id = p_student_id
    AND status = 'active'
    AND current_period_end > NOW()
  ORDER BY created_at DESC
  LIMIT 1;
END;
$$;
```

Apply the functions migration:

```bash
supabase db push
```

---

## Part 2: Edge Functions Deployment

### Step 1: Create Edge Function Directories

In your main Supabase project:

```bash
cd supabase/functions

# Create JustAI Edge Functions
mkdir -p elevenlabs-get-signed-url
mkdir -p elevenlabs-get-conversation
mkdir -p justai-subscription-create
mkdir -p justai-text-chat
mkdir -p stripe-webhook-justai
```

### Step 2: Deploy ElevenLabs Signed URL Function

Create `supabase/functions/elevenlabs-get-signed-url/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { student_id, conversation_id, virtual_lesson_id, scenario } = await req.json();
    
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // Fetch student profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('display_name, cefr_level, native_language')
      .eq('id', student_id)
      .single();
    
    if (profileError) throw profileError;
    
    // Fetch agent config
    const { data: agentConfig, error: configError } = await supabase
      .from('justai_agent_configs')
      .select('*')
      .eq('student_id', student_id)
      .eq('is_active', true)
      .single();
    
    if (configError) throw configError;
    
    // Build personalized system prompt
    const systemPrompt = buildSystemPrompt(profile, agentConfig, scenario);
    
    // Get signed URL from ElevenLabs
    const agentId = Deno.env.get('ELEVENLABS_AGENT_ID');
    const apiKey = Deno.env.get('ELEVENLABS_API_KEY');
    
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`,
      {
        method: 'GET',
        headers: {
          'xi-api-key': apiKey!,
        },
      }
    );
    
    if (!response.ok) {
      throw new Error('Failed to get signed URL from ElevenLabs');
    }
    
    const { signed_url } = await response.json();
    
    return new Response(
      JSON.stringify({ 
        signed_url,
        system_prompt: systemPrompt,
        agent_config: agentConfig
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function buildSystemPrompt(profile: any, config: any, scenario?: string): string {
  const scenarioPrompts: Record<string, string> = {
    career: 'Focus on professional English, job interviews, and workplace communication.',
    travel: 'Focus on travel scenarios, ordering food, asking for directions, cultural exchange.',
    academic: 'Focus on academic discussions, critical thinking, and formal language.',
    conversation: 'Engage in natural, casual conversation about everyday topics.',
    test_prep: 'Practice IELTS/TOEFL speaking tasks with structured feedback.',
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
- Use ${config.correction_style} error correction
- Maintain ${config.formality_level} tone
- ${scenarioInstruction}
- Ask follow-up questions to keep conversation flowing
- Be encouraging and supportive

Remember: Build their confidence while helping them improve!`;
}
```

### Step 3: Deploy ElevenLabs Get Conversation Function

Create `supabase/functions/elevenlabs-get-conversation/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { conversation_id } = await req.json();
    
    const apiKey = Deno.env.get('ELEVENLABS_API_KEY');
    
    // Fetch conversation details from ElevenLabs
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${conversation_id}`,
      {
        headers: {
          'xi-api-key': apiKey!,
        },
      }
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch conversation from ElevenLabs');
    }
    
    const conversationData = await response.json();
    
    return new Response(
      JSON.stringify(conversationData),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
```

### Step 4: Deploy Edge Functions

```bash
# Deploy all JustAI Edge Functions
supabase functions deploy elevenlabs-get-signed-url
supabase functions deploy elevenlabs-get-conversation

# If you create additional functions:
# supabase functions deploy justai-subscription-create
# supabase functions deploy justai-text-chat
# supabase functions deploy stripe-webhook-justai
```

### Step 5: Verify Deployment

```bash
# List all deployed functions
supabase functions list

# Check function logs
supabase functions logs elevenlabs-get-signed-url
```

---

## Part 3: Seed Data (Optional)

### Create Subscription Plans

Create a seed file or run this SQL directly:

```sql
-- Insert sample subscription plans
INSERT INTO public.justai_subscription_plans (
  plan_name,
  plan_type,
  description,
  monthly_message_limit,
  includes_voice,
  price_cents,
  stripe_price_id,
  stripe_product_id,
  features,
  is_active,
  is_featured,
  display_order
) VALUES 
(
  'Basic Text',
  'basic',
  'Perfect for casual learners',
  100,
  false,
  999,
  'price_basic_text_monthly',
  'prod_basic_text',
  '["100 text messages/month", "24/7 availability", "Basic AI tutor"]'::jsonb,
  true,
  false,
  1
),
(
  'Premium Text',
  'premium',
  'For serious learners',
  500,
  false,
  1999,
  'price_premium_text_monthly',
  'prod_premium_text',
  '["500 text messages/month", "Priority support", "Advanced AI tutor", "Conversation history"]'::jsonb,
  true,
  false,
  2
),
(
  'Basic Plus (Voice)',
  'basic',
  'Text + Voice conversations',
  100,
  true,
  1499,
  'price_basic_plus_monthly',
  'prod_basic_plus',
  '["100 messages/month", "Voice conversation", "Real-time transcription", "Vocabulary tracking"]'::jsonb,
  true,
  true,
  3
),
(
  'Premium Plus (Voice)',
  'premium',
  'Full-featured language learning',
  500,
  true,
  3999,
  'price_premium_plus_monthly',
  'prod_premium_plus',
  '["500 messages/month", "Voice conversation", "Advanced transcription", "Full vocabulary tracking", "Grammar analysis"]'::jsonb,
  true,
  true,
  4
),
(
  'Unlimited Plus (Voice)',
  'unlimited',
  'Unlimited learning',
  NULL,
  true,
  7999,
  'price_unlimited_plus_monthly',
  'prod_unlimited_plus',
  '["Unlimited messages", "Voice conversation", "Advanced AI tutor", "Full analysis suite", "Priority processing"]'::jsonb,
  true,
  true,
  5
)
ON CONFLICT (plan_name) DO NOTHING;
```

---

## Part 3.5: Stripe Configuration

### Step 1: Create JustAI Products in Stripe

1. **Go to Stripe Dashboard** → Products → Create Product

2. **Create products with metadata**:

   For each plan, create a product with:
   - **Name**: "JustAI Basic Text", "JustAI Premium Plus", etc.
   - **Description**: Your plan description
   - **Metadata** (Important!):
     - `system`: `justai`
     - `includes_voice`: `true` or `false`
     - `message_limit`: `100`, `500`, or `null` for unlimited
   
3. **Create recurring prices**:
   - **Billing Period**: Monthly
   - **Price**: Amount in your currency
   - Copy the Price ID (starts with `price_`)

4. **Example Product Setup**:

   ```
   Product: JustAI Basic Text
   Price: $9.99/month
   Price ID: price_1234567890abcdef
   Metadata:
     - system: justai
     - includes_voice: false
     - message_limit: 100
   ```

### Step 2: Update Subscription Plans Table

After creating Stripe products, update your SQL seed data with the real price IDs:

```sql
UPDATE public.justai_subscription_plans
SET 
  stripe_price_id = 'price_YOUR_REAL_PRICE_ID',
  stripe_product_id = 'prod_YOUR_REAL_PRODUCT_ID'
WHERE plan_name = 'Basic Text';

-- Repeat for all plans
```

### Step 3: Create Webhook Endpoint

1. **Go to Stripe Dashboard** → Developers → Webhooks → Add endpoint

2. **Endpoint URL**:
   ```
   https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook-justai
   ```

3. **Select Events to Listen To**:
   - ✅ `customer.subscription.created`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
   - ✅ `invoice.payment_succeeded`
   - ✅ `invoice.payment_failed`
   - ✅ `customer.subscription.trial_will_end`

4. **Copy Webhook Signing Secret** (starts with `whsec_`)

5. **Add to Supabase Secrets**:
   ```bash
   supabase secrets set STRIPE_JUSTAI_WEBHOOK_SECRET=whsec_your_signing_secret_here
   ```

### Step 4: Create Stripe Webhook Handler Function

Create `supabase/functions/stripe-webhook-justai/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
});

serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  const webhookSecret = Deno.env.get('STRIPE_JUSTAI_WEBHOOK_SECRET');

  if (!signature || !webhookSecret) {
    return new Response('Missing signature or secret', { status: 400 });
  }

  try {
    const body = await req.text();
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(supabase, subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCanceled(supabase, subscription);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentSucceeded(supabase, invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(supabase, invoice);
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Webhook error:', err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }
});

async function handleSubscriptionUpdate(supabase: any, subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const priceId = subscription.items.data[0]?.price.id;

  // Get plan details
  const { data: plan } = await supabase
    .from('justai_subscription_plans')
    .select('*')
    .eq('stripe_price_id', priceId)
    .single();

  if (!plan) {
    console.error('Plan not found for price:', priceId);
    return;
  }

  // Find student by Stripe customer ID
  const { data: existingSub } = await supabase
    .from('justai_subscriptions')
    .select('student_id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (existingSub) {
    // Update existing subscription
    await supabase
      .from('justai_subscriptions')
      .update({
        subscription_type: plan.plan_type,
        status: subscription.status === 'active' ? 'active' : subscription.status,
        monthly_message_limit: plan.monthly_message_limit,
        price_cents: plan.price_cents,
        stripe_subscription_id: subscription.id,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_customer_id', customerId);
  }
}

async function handleSubscriptionCanceled(supabase: any, subscription: Stripe.Subscription) {
  await supabase
    .from('justai_subscriptions')
    .update({
      status: 'canceled',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);
}

async function handlePaymentSucceeded(supabase: any, invoice: Stripe.Invoice) {
  const subscriptionId = invoice.subscription as string;

  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    // Reset usage for new billing period
    await supabase.rpc('reset_justai_subscription_period', {
      p_subscription_id: subscriptionId,
      p_new_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      p_new_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    });
  }
}

async function handlePaymentFailed(supabase: any, invoice: Stripe.Invoice) {
  const subscriptionId = invoice.subscription as string;

  if (subscriptionId) {
    await supabase
      .from('justai_subscriptions')
      .update({
        status: 'past_due',
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', subscriptionId);
  }
}
```

Deploy the webhook function:

```bash
supabase functions deploy stripe-webhook-justai
```

### Step 5: Test Webhook

Use Stripe CLI to test locally:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login to Stripe
stripe login

# Forward webhooks to local function
stripe listen --forward-to https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook-justai

# Trigger test events
stripe trigger customer.subscription.created
stripe trigger invoice.payment_succeeded
```

### Step 6: Environment Variable Summary

Your final Stripe-related secrets should be:

```bash
# Required Stripe Secrets
STRIPE_SECRET_KEY=sk_live_... # or sk_test_...
STRIPE_JUSTAI_WEBHOOK_SECRET=whsec_...

# Verify
supabase secrets list
```

**Note**: You're using the SAME Stripe account as your existing lesson booking system, just with separate products and a separate webhook endpoint for JustAI subscriptions.

---

## Part 4: Testing

### Test Database Access

```bash
# Test subscription access function
supabase db execute "
SELECT * FROM check_justai_subscription_access('your-student-uuid');
"

# Check tables
supabase db execute "
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'justai_%';
"
```

### Test Edge Functions

```bash
# Test elevenlabs-get-signed-url
curl -X POST \
  'https://your-project-ref.supabase.co/functions/v1/elevenlabs-get-signed-url' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "student_id": "your-student-uuid",
    "conversation_id": "your-conversation-uuid",
    "scenario": "conversation"
  }'
```

---

## Part 5: Rollback Plan

If you need to rollback the changes:

```bash
# Rollback last migration
supabase db reset

# Or drop specific tables
supabase db execute "
DROP TABLE IF EXISTS public.justai_usage_log CASCADE;
DROP TABLE IF EXISTS public.justai_voice_sessions CASCADE;
DROP TABLE IF EXISTS public.justai_messages CASCADE;
DROP TABLE IF EXISTS public.justai_conversations CASCADE;
DROP TABLE IF EXISTS public.justai_agent_configs CASCADE;
DROP TABLE IF EXISTS public.justai_subscription_plans CASCADE;
DROP TABLE IF EXISTS public.justai_subscriptions CASCADE;
"
```

---

## Troubleshooting

### Common Issues

**1. Migration fails due to missing `is_admin()` function**

If your project doesn't have an `is_admin()` function, either:
- Create one: 
  ```sql
  CREATE OR REPLACE FUNCTION public.is_admin()
  RETURNS BOOLEAN AS $$
  BEGIN
    RETURN auth.jwt() -> 'user_metadata' ->> 'role' = 'admin';
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;
  ```
- Or replace `public.is_admin()` with your existing admin check function

**2. Edge Function deployment fails**

```bash
# Check Supabase CLI version
supabase --version

# Update if needed
npm install -g supabase@latest

# Re-link project
supabase link --project-ref YOUR_PROJECT_REF
```

**3. ElevenLabs signed URL fails**

```bash
# Verify secrets are set
supabase secrets list

# Check if they're accessible
supabase functions logs elevenlabs-get-signed-url --tail
```

---

## Post-Deployment Checklist

- [ ] All migrations applied successfully
- [ ] RLS policies created and tested
- [ ] Database functions working correctly
- [ ] Edge Functions deployed
- [ ] Environment variables/secrets configured
- [ ] Sample subscription plans created
- [ ] Test student can access JustAI features
- [ ] Stripe webhook configured (if using subscriptions)
- [ ] Monitoring/logging set up
- [ ] Documentation updated for team

---

## Next Steps

After deploying to your main Supabase project:

1. **Configure Stripe** (PRIORITY):
   - Create JustAI products in Stripe Dashboard
   - Add metadata: `system: justai` to each product
   - Copy Price IDs and update `justai_subscription_plans` table
   - Create webhook endpoint: `stripe-webhook-justai`
   - Copy webhook signing secret
   - Set `STRIPE_JUSTAI_WEBHOOK_SECRET` in Supabase secrets
   - Deploy `stripe-webhook-justai` Edge Function
   - Test webhooks with Stripe CLI

2. **Create ElevenLabs Agent**: 
   - Set up your ElevenLabs agent in their dashboard
   - Configure base voice and settings
   - Copy Agent ID to `ELEVENLABS_AGENT_ID` secret
   
3. **Update Frontend**: 
   - Point your React app to use the deployed Edge Functions
   - Update API URLs in environment variables
   - Test subscription checkout flow
   
4. **Test End-to-End**: 
   - Test subscription purchase flow
   - Test text chat
   - Test voice conversation
   - Verify transcript capture
   - Check usage tracking
   
5. **Monitor Usage**: 
   - Set up alerts for usage and costs
   - Monitor Stripe webhook logs
   - Track ElevenLabs API usage

---

## Support

If you encounter issues:

1. **Supabase Issues**:
   - Check function logs: `supabase functions logs <function-name>`
   - Verify RLS policies: `SELECT * FROM pg_policies WHERE tablename LIKE 'justai_%';`
   - Test database functions directly via SQL

2. **Stripe Issues**:
   - Check webhook logs in Stripe Dashboard → Developers → Webhooks
   - Verify webhook secret matches: `supabase secrets list`
   - Test with Stripe CLI: `stripe listen --forward-to ...`
   - Check that products have correct metadata: `system: justai`
   - Verify Price IDs match in database

3. **ElevenLabs Issues**:
   - Check API status: https://status.elevenlabs.io
   - Verify Agent ID is correct
   - Test signed URL generation manually
   - Check function logs for API errors

4. **General Debugging**:
   - Enable verbose logging in Edge Functions
   - Check CORS headers for frontend requests
   - Verify all secrets are set correctly
   - Test with curl commands first before frontend integration

---

## Summary

You've now deployed:
- ✅ 7 new database tables with `justai_` prefix
- ✅ Row Level Security policies
- ✅ 4 database functions for subscription management
- ✅ Edge Functions for ElevenLabs integration
- ✅ Stripe webhook handler for subscriptions
- ✅ Sample subscription plans

**Environment Variables Configured**:
- ✅ `STRIPE_SECRET_KEY` - Your Stripe API key
- ✅ `STRIPE_JUSTAI_WEBHOOK_SECRET` - JustAI webhook signing secret
- ✅ `ELEVENLABS_API_KEY` - ElevenLabs API key
- ✅ `ELEVENLABS_AGENT_ID` - Your ElevenLabs agent ID

**Stripe Configuration**:
- ✅ JustAI products created with metadata
- ✅ Webhook endpoint configured: `stripe-webhook-justai`
- ✅ Events monitored: subscriptions, invoices, payments

All features are isolated from existing teacher-side AI functionality and ready for frontend integration! 🚀

---

## Quick Reference: Stripe Secret Names

For easy copy-paste when setting up:

```bash
# Set Stripe secrets (same account as main app, different webhook)
supabase secrets set STRIPE_SECRET_KEY=sk_live_YOUR_KEY
supabase secrets set STRIPE_JUSTAI_WEBHOOK_SECRET=whsec_YOUR_JUSTAI_WEBHOOK_SECRET
```

**Important**: 
- Use `STRIPE_JUSTAI_WEBHOOK_SECRET` (separate from main app's webhook secret)
- This is the signing secret from your JustAI webhook endpoint
- Different from your main app's webhook secret (if you have one)
