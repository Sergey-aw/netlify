# JustAI Post-Deployment Verification & Next Steps

## ✅ Deployment Status

Congratulations! You've completed:
- ✅ Database migrations applied (all `justai_*` tables created)
- ✅ Edge Functions deployed to Supabase

---

## Step 1: Verify Database Tables

Check that all tables were created successfully:

```bash
# Connect to your Supabase project
supabase db execute "
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'justai_%'
ORDER BY table_name;
"
```

**Expected Output** (7 tables):
```
justai_agent_configs
justai_conversations
justai_messages
justai_subscription_plans
justai_subscriptions
justai_usage_log
justai_voice_sessions
```

---

## Step 2: Verify Database Functions

Check that RPC functions were created:

```bash
supabase db execute "
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%justai%'
ORDER BY routine_name;
"
```

**Expected Output** (4 functions):
```
check_justai_subscription_access
get_active_justai_subscription
log_justai_message_usage
reset_justai_subscription_period
```

---

## Step 3: Verify Edge Functions

List deployed functions:

```bash
supabase functions list
```

**Expected JustAI Functions**:
- `elevenlabs-get-signed-url`
- `elevenlabs-get-conversation`
- `justai_webhook` (if created)

Test a function:

```bash
# Get your project URL and anon key
supabase status

# Test elevenlabs-get-signed-url (will fail without valid data, but checks deployment)
curl -X POST \
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/elevenlabs-get-signed-url' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"student_id": "test"}'
```

---

## Step 4: Verify Environment Secrets

Check that all required secrets are set:

```bash
supabase secrets list
```

**Required Secrets**:
- ✅ `ELEVENLABS_API_KEY`
- ✅ `ELEVENLABS_AGENT_ID`
- ✅ `STRIPE_SECRET_KEY`
- ✅ `STRIPE_JUSTAI_WEBHOOK_SECRET`

**Missing any?** Set them now:

```bash
supabase secrets set ELEVENLABS_API_KEY=sk_your_key
supabase secrets set ELEVENLABS_AGENT_ID=agent_your_id
supabase secrets set STRIPE_SECRET_KEY=sk_live_or_test_key
supabase secrets set STRIPE_JUSTAI_WEBHOOK_SECRET=whsec_your_secret
```

---

## Step 5: Seed Subscription Plans (If Not Done)

Insert the sample subscription plans:

```sql
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
  'price_PLACEHOLDER_basic_text',
  'prod_PLACEHOLDER_basic_text',
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
  'price_PLACEHOLDER_premium_text',
  'prod_PLACEHOLDER_premium_text',
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
  'price_PLACEHOLDER_basic_plus',
  'prod_PLACEHOLDER_basic_plus',
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
  'price_PLACEHOLDER_premium_plus',
  'prod_PLACEHOLDER_premium_plus',
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
  'price_PLACEHOLDER_unlimited_plus',
  'prod_PLACEHOLDER_unlimited_plus',
  '["Unlimited messages", "Voice conversation", "Advanced AI tutor", "Full analysis suite", "Priority processing"]'::jsonb,
  true,
  true,
  5
)
ON CONFLICT (plan_name) DO NOTHING;
```

Run it:

```bash
supabase db execute -f path/to/seed_plans.sql
# OR paste the SQL directly in Supabase Dashboard → SQL Editor
```

Verify:

```bash
supabase db execute "SELECT plan_name, price_cents, includes_voice FROM justai_subscription_plans ORDER BY display_order;"
```

---

## Step 6: Configure Stripe (CRITICAL)

### A. Create Products in Stripe Dashboard

1. Go to: https://dashboard.stripe.com/products
2. Click **"Add product"**
3. Create each of the 5 JustAI products:
   - JustAI Basic Text ($9.99/month)
   - JustAI Premium Text ($19.99/month)
   - JustAI Basic Plus ($14.99/month) - with voice
   - JustAI Premium Plus ($39.99/month) - with voice
   - JustAI Unlimited Plus ($79.99/month) - with voice

4. **Important**: Add metadata to each product:
   ```
   system: justai
   includes_voice: true or false
   message_limit: 100, 500, or null
   ```

5. **Copy Price IDs** from each product (starts with `price_`)

### B. Update Database with Real Price IDs

```sql
-- Replace PLACEHOLDER with your actual Stripe Price IDs
UPDATE public.justai_subscription_plans
SET 
  stripe_price_id = 'price_YOUR_ACTUAL_BASIC_TEXT_ID',
  stripe_product_id = 'prod_YOUR_ACTUAL_BASIC_TEXT_ID'
WHERE plan_name = 'Basic Text';

UPDATE public.justai_subscription_plans
SET 
  stripe_price_id = 'price_YOUR_ACTUAL_PREMIUM_TEXT_ID',
  stripe_product_id = 'prod_YOUR_ACTUAL_PREMIUM_TEXT_ID'
WHERE plan_name = 'Premium Text';

UPDATE public.justai_subscription_plans
SET 
  stripe_price_id = 'price_YOUR_ACTUAL_BASIC_PLUS_ID',
  stripe_product_id = 'prod_YOUR_ACTUAL_BASIC_PLUS_ID'
WHERE plan_name = 'Basic Plus (Voice)';

UPDATE public.justai_subscription_plans
SET 
  stripe_price_id = 'price_YOUR_ACTUAL_PREMIUM_PLUS_ID',
  stripe_product_id = 'prod_YOUR_ACTUAL_PREMIUM_PLUS_ID'
WHERE plan_name = 'Premium Plus (Voice)';

UPDATE public.justai_subscription_plans
SET 
  stripe_price_id = 'price_YOUR_ACTUAL_UNLIMITED_PLUS_ID',
  stripe_product_id = 'prod_YOUR_ACTUAL_UNLIMITED_PLUS_ID'
WHERE plan_name = 'Unlimited Plus (Voice)';
```

### C. Create Stripe Webhook

1. Go to: https://dashboard.stripe.com/webhooks
2. Click **"Add endpoint"**
3. **Endpoint URL**:
   ```
   https://YOUR_PROJECT_REF.supabase.co/functions/v1/justai_webhook
   ```
4. **Select events**:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. **Copy webhook signing secret** (starts with `whsec_`)
6. **Set in Supabase**:
   ```bash
   supabase secrets set STRIPE_JUSTAI_WEBHOOK_SECRET=whsec_YOUR_SECRET
   ```

### D. Test Webhook

```bash
# Install Stripe CLI (if not installed)
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Test webhook
stripe trigger customer.subscription.created
```

---

## Step 7: Configure ElevenLabs Agent

### A. Create Agent in ElevenLabs

1. Go to: https://elevenlabs.io/app/agents
2. Click **"Create Agent"**
3. Configure:
   - **Name**: AI English Teacher
   - **Voice**: Choose a teacher voice (e.g., Rachel - American English)
   - **Language**: English
   - **LLM**: GPT-4 or Claude
   - **System Prompt**: (Basic template - will be overridden per student)
     ```
     You are Alex, a friendly and encouraging English teacher.
     Help students practice English conversation naturally.
     ```

4. **Copy Agent ID** (from URL or settings)
5. **Get API Key**: Settings → API Keys
6. **Set in Supabase**:
   ```bash
   supabase secrets set ELEVENLABS_AGENT_ID=agent_YOUR_ID
   supabase secrets set ELEVENLABS_API_KEY=sk_YOUR_KEY
   ```

### B. Test Agent

You can test directly in ElevenLabs dashboard before integrating.

---

## Step 8: Test Database Access with Real User

### Create Test Student

```sql
-- Get a real student ID from your profiles table
SELECT id, email, display_name, cefr_level 
FROM profiles 
WHERE role = 'student' 
LIMIT 1;
```

### Create Test Agent Config

```sql
INSERT INTO public.justai_agent_configs (
  student_id,
  learning_goals,
  interests,
  cefr_level,
  preferred_voice_id,
  correction_style,
  formality_level,
  system_prompt_template,
  onboarding_completed
) VALUES (
  'YOUR_STUDENT_ID_HERE',
  ARRAY['conversation', 'career'],
  ARRAY['technology', 'movies', 'travel'],
  'B1',
  '21m00Tcm4TlvDq8ikWAM',
  'balanced',
  'casual',
  'Default system prompt',
  true
);
```

### Test Subscription Access Function

```sql
SELECT * FROM check_justai_subscription_access('YOUR_STUDENT_ID_HERE');
```

**Expected**: Returns no subscription (all false/null) since student doesn't have one yet.

---

## Step 9: Frontend Integration Preparation

### A. Get Your Supabase Credentials

```bash
# Project URL
supabase status | grep "API URL"

# Anon Key (public)
supabase status | grep "anon key"
```

### B. Frontend Environment Variables

Create/update `.env.local` in your React app:

```bash
# Supabase (same as your existing app)
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

# Stripe (public key)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_or_test_your_key

# ElevenLabs (if needed on frontend)
NEXT_PUBLIC_ELEVENLABS_AGENT_ID=agent_YOUR_ID
```

### C. Install Required Packages

```bash
# In your React app directory
npm install @elevenlabs/react
npm install @stripe/stripe-js
```

---

## Step 10: Test End-to-End Flow

### Test 1: Check Subscription Plans

```bash
curl https://YOUR_PROJECT_REF.supabase.co/rest/v1/justai_subscription_plans?is_active=eq.true \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

**Expected**: Returns 5 subscription plans

### Test 2: Test ElevenLabs Signed URL

```bash
curl -X POST \
  https://YOUR_PROJECT_REF.supabase.co/functions/v1/elevenlabs-get-signed-url \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": "YOUR_STUDENT_ID",
    "conversation_id": "test-conv-id",
    "scenario": "conversation"
  }'
```

**Expected**: Returns signed URL and system prompt

### Test 3: Check Function Logs

```bash
supabase functions logs elevenlabs-get-signed-url --tail
```

Look for any errors.

---

## Common Issues & Solutions

### Issue 1: "Function returned an error"

**Check**:
```bash
supabase functions logs elevenlabs-get-signed-url
```

**Common causes**:
- Missing environment secrets
- Invalid student_id (no profile exists)
- No agent config for student

### Issue 2: Stripe webhook fails

**Check**:
- Webhook signing secret is correct
- Webhook URL is correct
- Events are selected correctly
- Check Stripe Dashboard → Webhooks → Logs

### Issue 3: No subscription plans returned

**Check**:
```sql
SELECT * FROM justai_subscription_plans;
```

**Solution**: Run seed data script again

### Issue 4: RLS policy blocks access

**Check policies**:
```sql
SELECT * FROM pg_policies WHERE tablename LIKE 'justai_%';
```

**Test with service role** (bypasses RLS) to verify issue is RLS-related.

---

## Next Steps

### Immediate (Required for MVP):

1. **Complete Stripe Setup**:
   - [ ] Create 5 products in Stripe
   - [ ] Add metadata to products
   - [ ] Copy Price IDs
   - [ ] Update `justai_subscription_plans` table
   - [ ] Create webhook endpoint
   - [ ] Test webhook with Stripe CLI

2. **Complete ElevenLabs Setup**:
   - [ ] Create agent in dashboard
   - [ ] Copy Agent ID
   - [ ] Get API key
   - [ ] Set secrets in Supabase
   - [ ] Test agent in dashboard

3. **Frontend Development**:
   - [ ] Create JustAI pages/components
   - [ ] Implement subscription checkout
   - [ ] Build voice chat interface
   - [ ] Test end-to-end flow

### Medium Term (Post-MVP):

4. **Create Additional Edge Functions**:
   - [ ] `justai-text-chat` - Handle text-only conversations
   - [ ] `justai-subscription-create` - Create Stripe checkout sessions
   - [ ] `justai-subscription-manage` - Cancel/update subscriptions

5. **Monitoring & Analytics**:
   - [ ] Set up usage tracking
   - [ ] Monitor costs (ElevenLabs + Stripe)
   - [ ] Add error alerting
   - [ ] Track user engagement

6. **Testing & QA**:
   - [ ] Test all subscription flows
   - [ ] Test voice conversations
   - [ ] Test usage limits
   - [ ] Test billing periods/resets

---

## Quick Reference Commands

```bash
# Check database tables
supabase db execute "SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'justai_%';"

# Check functions
supabase db execute "SELECT routine_name FROM information_schema.routines WHERE routine_name LIKE '%justai%';"

# List Edge Functions
supabase functions list

# View function logs
supabase functions logs <function-name> --tail

# List secrets
supabase secrets list

# Set secret
supabase secrets set KEY_NAME=value

# Test subscription access
supabase db execute "SELECT * FROM check_justai_subscription_access('student-uuid-here');"

# Get subscription plans
supabase db execute "SELECT plan_name, price_cents/100.0 as price_usd FROM justai_subscription_plans;"
```

---

## Support & Documentation

- **Main Architecture**: `voice-interaction-architecture-updated.md`
- **Deployment Guide**: `justai-deployment-guide.md`
- **Naming Conventions**: `justai-naming-conventions.md`
- **Stripe Setup**: `justai-stripe-setup-guide.md`

- **Supabase Docs**: https://supabase.com/docs
- **ElevenLabs Docs**: https://elevenlabs.io/docs
- **Stripe Docs**: https://stripe.com/docs

---

## Status Summary

✅ **Completed**:
- Database schema deployed
- Edge Functions deployed
- RLS policies in place
- Database functions created

🔄 **In Progress** (Do These Next):
- Configure Stripe products
- Set up ElevenLabs agent
- Update database with real Price IDs
- Create Stripe webhook

❌ **Not Started**:
- Frontend integration
- End-to-end testing
- Production deployment

---

**Current Status**: Backend infrastructure is deployed! 🎉  
**Next Critical Step**: Complete Stripe configuration (see Step 6 above)

Good luck! 🚀
