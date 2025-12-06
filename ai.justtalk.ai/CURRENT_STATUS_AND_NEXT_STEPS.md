# JustAI Setup - Next Steps Checklist

## ✅ Completed So Far

- ✅ Database migrations applied (all `justai_*` tables created)
- ✅ Stripe products created (3 products with 6 prices)
- ✅ Database updated with real Stripe Price IDs
- ✅ `STRIPE_JUSTAI_WEBHOOK_SECRET` set in Supabase
- ✅ `stripe-webhook-justai` Edge Function deployed

---

## 🎯 NEXT: Configure Stripe Webhook

### Step 1: Create Webhook Endpoint in Stripe

1. **Go to Stripe Dashboard**:
   ```
   https://dashboard.stripe.com/webhooks
   ```

2. **Click "Add endpoint"**

3. **Enter Endpoint URL**:
   ```
   https://bcsyrxkfeatnbaqlnxgr.supabase.co/functions/v1/stripe-webhook-justai
   ```

4. **Description**: `JustAI Subscription Webhooks`

5. **Select Events to Send**:
   - ✅ `customer.subscription.created`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
   - ✅ `invoice.payment_succeeded`
   - ✅ `invoice.payment_failed`

6. **Click "Add endpoint"**

### Step 2: Get Webhook Signing Secret

1. Click on the webhook you just created
2. Click **"Reveal"** next to "Signing secret"
3. Copy the secret (starts with `whsec_`)

### Step 3: Update Supabase Secret (if different from before)

If the signing secret is different from what you set earlier:

```bash
supabase secrets set STRIPE_JUSTAI_WEBHOOK_SECRET=whsec_YOUR_NEW_SECRET_HERE
```

### Step 4: Test the Webhook

#### Option A: Test via Stripe Dashboard (Easiest)

1. In Stripe Dashboard → Webhooks
2. Click on your `stripe-webhook-justai` endpoint
3. Click **"Send test webhook"**
4. Select event: `customer.subscription.created`
5. Click **"Send test webhook"**
6. ✅ Should see **200 OK** response

#### Option B: Test with Stripe CLI (More thorough)

```bash
# Install Stripe CLI (if not installed)
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Trigger test events
stripe trigger customer.subscription.created
stripe trigger customer.subscription.updated
stripe trigger invoice.payment_succeeded
```

---

## 🔍 Verify Webhook is Working

### Check Function Logs

If you have Supabase CLI:
```bash
supabase functions logs stripe-webhook-justai --tail
```

Or check in Supabase Dashboard:
- Go to: https://supabase.com/dashboard/project/bcsyrxkfeatnbaqlnxgr/functions
- Click on `stripe-webhook-justai`
- View logs

### Check Stripe Dashboard

1. Go to: https://dashboard.stripe.com/webhooks
2. Click on your webhook
3. Check **"Recent deliveries"** tab
4. Look for successful deliveries (green checkmarks)

---

## 🚧 Remaining Setup Tasks

### 1. ElevenLabs Setup (REQUIRED for voice features)

**What you need**:
- [ ] Create an AI agent in ElevenLabs dashboard
- [ ] Get Agent ID
- [ ] Get API Key
- [ ] Set secrets in Supabase

**Steps**:
1. Go to: https://elevenlabs.io/app/agents
2. Click **"Create Agent"**
3. Configure:
   - Name: AI English Teacher
   - Voice: Choose a teacher voice (e.g., Rachel)
   - Language: English
   - LLM: GPT-4 or Claude
   - System Prompt: "You are a friendly English teacher..."
4. Copy Agent ID (from URL or settings)
5. Get API Key from Settings → API Keys
6. Set in Supabase:
   ```bash
   supabase secrets set ELEVENLABS_AGENT_ID=agent_YOUR_ID
   supabase secrets set ELEVENLABS_API_KEY=sk_YOUR_KEY
   ```

### 2. Deploy ElevenLabs Edge Functions

These should already be in your main repo:
- [ ] `elevenlabs-get-signed-url`
- [ ] `elevenlabs-get-conversation`

If not deployed yet, deploy them:
```bash
supabase functions deploy elevenlabs-get-signed-url
supabase functions deploy elevenlabs-get-conversation
```

### 3. Frontend Integration

**Environment variables** for your React app (`.env.local`):
```bash
# Supabase (same as existing)
VITE_SUPABASE_URL=https://bcsyrxkfeatnbaqlnxgr.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Stripe (public key)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_... (or pk_live_...)

# ElevenLabs (optional - if used on frontend)
VITE_ELEVENLABS_AGENT_ID=agent_YOUR_ID
```

**Install packages** (if not already):
```bash
npm install @elevenlabs/react @stripe/stripe-js
```

### 4. Test Complete Flow

- [ ] Test subscription plans display
- [ ] Test checkout session creation
- [ ] Test webhook receives subscription.created
- [ ] Verify subscription appears in database
- [ ] Test voice conversation initiation
- [ ] Test usage limit enforcement

---

## 📊 Current Status Summary

| Component | Status | Notes |
|-----------|--------|-------|
| Database Schema | ✅ Complete | All `justai_*` tables created |
| Stripe Products | ✅ Complete | 3 products, 6 prices |
| Stripe Price IDs | ✅ Complete | Updated in database |
| Webhook Function | ✅ Deployed | `stripe-webhook-justai` |
| Webhook Endpoint | ⏳ **NEXT** | Need to create in Stripe Dashboard |
| Webhook Secret | ✅ Set | `STRIPE_JUSTAI_WEBHOOK_SECRET` |
| ElevenLabs Agent | ❌ TODO | Need to create agent |
| ElevenLabs Secrets | ❌ TODO | Need to set in Supabase |
| ElevenLabs Functions | ❓ Unknown | Check if deployed |
| Frontend Integration | ❌ TODO | Not started |

---

## 🎯 Immediate Next Action

**CREATE THE STRIPE WEBHOOK ENDPOINT** (5 minutes):

1. Open: https://dashboard.stripe.com/webhooks
2. Click "Add endpoint"
3. URL: `https://bcsyrxkfeatnbaqlnxgr.supabase.co/functions/v1/stripe-webhook-justai`
4. Select events listed above
5. Save and copy signing secret
6. Update Supabase secret if needed
7. Send test webhook
8. ✅ Verify 200 OK response

---

## 📞 Need Help?

- **Stripe webhook issues**: Check function logs and Stripe Dashboard → Webhooks → Recent deliveries
- **Database issues**: Run `quick-verify.sql` in Supabase SQL Editor
- **Function errors**: Check logs: `supabase functions logs stripe-webhook-justai`
- **Documentation**: See `STRIPE_WEBHOOK_IMPLEMENTATION_GUIDE.md` for detailed troubleshooting

---

**Status**: 70% Complete - Webhook endpoint creation is the next critical step! 🚀
