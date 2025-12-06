# JustAI Edge Functions

This folder contains Edge Functions for the JustAI application. These should be deployed to your main Supabase repository.

## Functions Overview

### 1. `create-checkout-session`
Creates a Stripe checkout session for subscription plans.

**Deploy to:** `supabase/functions/create-checkout-session/index.ts`

**Required Secrets:**
- `STRIPE_SECRET_KEY` - Your Stripe secret key
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Your Supabase anon key

**Usage:**
```typescript
const { url } = await createCheckoutSession('price_xxxxx')
window.location.href = url
```

---

### 2. `elevenlabs-get-signed-url`
Gets a signed WebSocket URL for ElevenLabs Conversational AI.

**Deploy to:** `supabase/functions/elevenlabs-get-signed-url/index.ts`

**Required Secrets:**
- `ELEVENLABS_API_KEY` - Your ElevenLabs API key
- `ELEVENLABS_AGENT_ID` - Your ElevenLabs agent ID

**Usage:**
```typescript
const { signedUrl } = await getElevenLabsSignedUrl()
// Use signedUrl to establish WebSocket connection
```

---

### 3. `elevenlabs-get-conversation`
Fetches conversation transcript from ElevenLabs.

**Deploy to:** `supabase/functions/elevenlabs-get-conversation/index.ts`

**Required Secrets:**
- `ELEVENLABS_API_KEY` - Your ElevenLabs API key

**Usage:**
```typescript
const conversation = await getConversationTranscript('conversation_id')
```

---

### 4. `stripe-webhook-justai` *(Already Deployed)*
Handles Stripe webhook events for subscription lifecycle.

**Deploy to:** `supabase/functions/stripe-webhook-justai/index.ts`

**Required Secrets:**
- `STRIPE_SECRET_KEY` - Your Stripe secret key
- `STRIPE_JUSTAI_WEBHOOK_SECRET` - Your Stripe webhook signing secret
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key

---

## Deployment Instructions

1. **Copy functions to your main Supabase repo:**
   ```bash
   # From this repo root
   cd /path/to/your/main/supabase/repo
   
   # Create function directories
   mkdir -p supabase/functions/create-checkout-session
   mkdir -p supabase/functions/elevenlabs-get-signed-url
   mkdir -p supabase/functions/elevenlabs-get-conversation
   
   # Copy the function files (rename .ts to index.ts)
   cp /path/to/this/repo/edge-functions/create-checkout-session.ts supabase/functions/create-checkout-session/index.ts
   cp /path/to/this/repo/edge-functions/elevenlabs-get-signed-url.ts supabase/functions/elevenlabs-get-signed-url/index.ts
   cp /path/to/this/repo/edge-functions/elevenlabs-get-conversation.ts supabase/functions/elevenlabs-get-conversation/index.ts
   ```

2. **Deploy functions:**
   ```bash
   supabase functions deploy create-checkout-session
   supabase functions deploy elevenlabs-get-signed-url
   supabase functions deploy elevenlabs-get-conversation
   ```

3. **Set secrets (if not already set):**
   ```bash
   # Stripe secrets (likely already set for stripe-webhook-justai)
   supabase secrets set STRIPE_SECRET_KEY=sk_test_xxxxx
   
   # ElevenLabs secrets
   supabase secrets set ELEVENLABS_API_KEY=your_api_key
   supabase secrets set ELEVENLABS_AGENT_ID=your_agent_id
   ```

---

## Frontend Integration

These functions are called from the frontend via `/ai-chat-app/src/lib/justai-api.ts`:

```typescript
// Get signed URL for voice chat
const { signedUrl } = await getElevenLabsSignedUrl()

// Create checkout session
const checkoutUrl = await createCheckoutSession(priceId)

// Get conversation transcript
const transcript = await getConversationTranscript(conversationId)
```

All functions handle CORS and require proper authentication headers from the frontend.
