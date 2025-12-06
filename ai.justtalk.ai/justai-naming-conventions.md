# JustAI Naming Conventions & Quick Reference

## 🎯 Critical: Naming Convention

**All new student-facing AI chat features must use the `justai_` prefix.**

### Why?

The existing platform has **teacher-side AI features** using the `ai_*` prefix:
- `ai_chat_conversations` - Teacher AI conversations (student insights)
- `ai_chat_messages` - Messages from teacher AI features
- `ai_feature_access` - Teacher AI feature permissions
- `ai_interactions` - Teacher AI usage tracking

The new **student-facing JustAI Chat Subscription** system is completely separate and uses `justai_*` to avoid conflicts.

---

## Database Tables

### ✅ Use These (JustAI - Student-Facing)

| Table Name | Purpose |
|------------|---------|
| `justai_subscriptions` | Student subscription management |
| `justai_conversations` | AI chat conversations (text & voice) |
| `justai_messages` | Chat messages and transcripts |
| `justai_voice_sessions` | Voice session metadata |
| `justai_agent_configs` | Student personalization settings |
| `justai_usage_log` | Usage tracking for billing |
| `justai_subscription_plans` | Available subscription plans |

### ❌ Do NOT Use These (Existing Teacher Features)

| Table Name | Purpose (Existing) |
|------------|-------------------|
| `ai_chat_conversations` | Teacher-side AI conversations |
| `ai_chat_messages` | Teacher-side AI messages |
| `ai_feature_access` | Teacher AI feature permissions |
| `ai_interactions` | Teacher AI usage tracking |

---

## Edge Functions

### ✅ Naming Convention

**JustAI Functions** (use `justai-` prefix):
```
supabase/functions/
├── justai-subscription-create/      # Create Stripe subscription
├── justai-subscription-manage/      # Manage subscription
├── justai-text-chat/                # Handle text chat
└── stripe-webhook-justai/           # Stripe webhooks
```

**ElevenLabs Functions** (use `elevenlabs-` prefix):
```
supabase/functions/
├── elevenlabs-get-signed-url/       # Get WebSocket signed URL
└── elevenlabs-get-conversation/     # Fetch conversation transcript
```

### ❌ Avoid Generic Names

Don't use:
- `ai-chat` (conflicts with teacher AI)
- `ai-subscription` (ambiguous)
- `create-subscription` (too generic)

---

## Frontend Components

### ✅ Naming Convention

**Pages** (use `JustAI*` prefix):
```typescript
src/pages/
├── JustAIChatHome.tsx              // Main AI chat landing page
├── JustAIChatVoice.tsx             // Voice conversation interface
├── JustAIChatConversation.tsx      // Text chat interface
├── JustAISubscriptionPlans.tsx     // Pricing & plans
├── JustAISubscriptionManagement.tsx // Manage subscription
└── JustAIOnboarding/               // Onboarding flow
    ├── GoalsScreen.tsx
    ├── InterestsScreen.tsx
    └── PreferencesScreen.tsx
```

**Components** (use `JustAI*` prefix):
```typescript
src/components/justai/
├── JustAIMessageBubble.tsx
├── JustAIVoiceControls.tsx
├── JustAITranscriptDisplay.tsx
├── JustAIUsageWidget.tsx
└── JustAIAudioVisualizer.tsx
```

**Hooks** (use `useJustAI*` prefix):
```typescript
src/hooks/
├── useJustAISubscription.ts        // Subscription management
├── useJustAIVoiceChat.ts           // Voice session handling
├── useJustAITextChat.ts            // Text chat handling
└── useJustAIAgentConfig.ts         // Agent configuration
```

### ❌ Avoid Generic Names

Don't use:
- `AIChatHome` (conflicts with teacher AI pages)
- `useAIChat` (ambiguous)
- `AIMessageBubble` (which AI system?)

---

## Database Functions (PostgreSQL)

### ✅ Function Names

```sql
-- Subscription access
public.check_justai_subscription_access(p_student_id UUID)

-- Usage logging
public.log_justai_message_usage(...)

-- Period reset
public.reset_justai_subscription_period(...)

-- Get active subscription
public.get_active_justai_subscription(p_student_id UUID)
```

### ❌ Avoid

Don't use:
- `check_ai_subscription_access` (conflicts)
- `log_ai_message` (ambiguous)

---

## Environment Variables

### ✅ Use Clear Prefixes

```bash
# ElevenLabs
ELEVENLABS_API_KEY=sk_...
ELEVENLABS_AGENT_ID=agent_...

# Stripe (JustAI specific)
STRIPE_JUSTAI_WEBHOOK_SECRET=whsec_...

# Database URLs
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...
```

---

## API Routes / RPC Functions

### ✅ Naming Pattern

**Supabase RPC Calls**:
```typescript
// Check subscription
supabase.rpc('check_justai_subscription_access', { p_student_id: userId })

// Log usage
supabase.rpc('log_justai_message_usage', { ... })

// Reset period
supabase.rpc('reset_justai_subscription_period', { ... })
```

**Edge Function Invocations**:
```typescript
// Get ElevenLabs signed URL
supabase.functions.invoke('elevenlabs-get-signed-url', { ... })

// Create subscription
supabase.functions.invoke('justai-subscription-create', { ... })

// Text chat
supabase.functions.invoke('justai-text-chat', { ... })
```

---

## File Structure Example

```
justtalk-ai/
├── supabase/
│   ├── migrations/
│   │   ├── 20240101_create_justai_subscriptions.sql
│   │   ├── 20240102_create_justai_conversations.sql
│   │   ├── 20240103_create_justai_messages.sql
│   │   ├── 20240104_create_justai_voice_sessions.sql
│   │   ├── 20240105_create_justai_agent_configs.sql
│   │   └── 20240106_create_justai_functions.sql
│   │
│   └── functions/
│       ├── justai-subscription-create/
│       ├── justai-subscription-manage/
│       ├── justai-text-chat/
│       ├── elevenlabs-get-signed-url/
│       ├── elevenlabs-get-conversation/
│       └── stripe-webhook-justai/
│
└── src/
    ├── pages/
    │   ├── JustAIChatHome.tsx
    │   ├── JustAIChatVoice.tsx
    │   ├── JustAIChatConversation.tsx
    │   ├── JustAISubscriptionPlans.tsx
    │   └── JustAIOnboarding/
    │
    ├── components/
    │   └── justai/
    │       ├── JustAIMessageBubble.tsx
    │       ├── JustAIVoiceControls.tsx
    │       └── JustAIUsageWidget.tsx
    │
    └── hooks/
        ├── useJustAISubscription.ts
        ├── useJustAIVoiceChat.ts
        └── useJustAITextChat.ts
```

---

## Quick Checklist

When creating any new JustAI feature:

- [ ] Table names start with `justai_`
- [ ] Edge functions start with `justai-` or `elevenlabs-`
- [ ] Frontend components start with `JustAI*`
- [ ] React hooks start with `useJustAI*`
- [ ] Database functions start with `justai_` or include `justai` in name
- [ ] No conflicts with existing `ai_*` teacher features
- [ ] Clear separation from teacher-side AI functionality

---

## Benefits of This Convention

1. **No Conflicts**: Teacher and student AI features are completely separate
2. **Clear Ownership**: Easy to identify which system a feature belongs to
3. **Maintainability**: Easier to debug and update specific systems
4. **Scalability**: Can evolve both systems independently
5. **Documentation**: Self-documenting code through naming

---

## Common Mistakes to Avoid

❌ **Wrong**:
```sql
CREATE TABLE ai_subscriptions (...);  -- Conflicts with teacher AI
```

✅ **Correct**:
```sql
CREATE TABLE justai_subscriptions (...);  -- Clear student-facing feature
```

❌ **Wrong**:
```typescript
export function AIChatHome() { ... }  // Ambiguous
```

✅ **Correct**:
```typescript
export function JustAIChatHome() { ... }  // Clear JustAI feature
```

❌ **Wrong**:
```bash
supabase functions deploy ai-chat
```

✅ **Correct**:
```bash
supabase functions deploy justai-text-chat
```

---

## Summary

**Golden Rule**: If it's for the **student-facing AI chat subscription system**, use the `justai_` prefix everywhere. This keeps the new JustAI system completely separate from existing teacher-side AI features and makes the codebase easier to understand and maintain.
