# JustAI Stripe Configuration Quick Guide

## Overview

This guide shows how to configure Stripe for JustAI subscriptions using your **existing Stripe account** (same account as your lesson booking system).

---

## Secret Names (Copy-Paste Ready)

```bash
# Supabase secrets for JustAI
supabase secrets set STRIPE_SECRET_KEY=sk_live_YOUR_KEY_HERE
supabase secrets set STRIPE_JUSTAI_WEBHOOK_SECRET=whsec_YOUR_JUSTAI_WEBHOOK_SECRET_HERE
```

**Important Notes**:
- ✅ Use `STRIPE_SECRET_KEY` (shared with main app)
- ✅ Use `STRIPE_JUSTAI_WEBHOOK_SECRET` (JustAI webhook signing secret, separate from main app webhook)

---

## Step-by-Step Setup

### 1. Create Products in Stripe

Go to: **Stripe Dashboard → Products → Create Product**

Create these 5 products:

#### Product 1: JustAI Basic Text
```
Name: JustAI Basic Text
Description: 100 text messages per month
Price: $9.99/month (recurring)

Metadata:
  system: justai
  includes_voice: false
  message_limit: 100
  
Copy the Price ID: price_xxxxxxxxxxxxx
```

#### Product 2: JustAI Premium Text
```
Name: JustAI Premium Text
Description: 500 text messages per month
Price: $19.99/month (recurring)

Metadata:
  system: justai
  includes_voice: false
  message_limit: 500
  
Copy the Price ID: price_xxxxxxxxxxxxx
```

#### Product 3: JustAI Basic Plus (Voice)
```
Name: JustAI Basic Plus
Description: 100 messages + voice conversation
Price: $14.99/month (recurring)

Metadata:
  system: justai
  includes_voice: true
  message_limit: 100
  
Copy the Price ID: price_xxxxxxxxxxxxx
```

#### Product 4: JustAI Premium Plus (Voice)
```
Name: JustAI Premium Plus
Description: 500 messages + voice conversation
Price: $39.99/month (recurring)

Metadata:
  system: justai
  includes_voice: true
  message_limit: 500
  
Copy the Price ID: price_xxxxxxxxxxxxx
```

#### Product 5: JustAI Unlimited Plus (Voice)
```
Name: JustAI Unlimited Plus
Description: Unlimited messages + voice conversation
Price: $79.99/month (recurring)

Metadata:
  system: justai
  includes_voice: true
  message_limit: null
  
Copy the Price ID: price_xxxxxxxxxxxxx
```

---

### 2. Update Database with Price IDs

After creating all products, update your database:

```sql
-- Update with your actual Stripe Price IDs
UPDATE public.justai_subscription_plans
SET 
  stripe_price_id = 'price_YOUR_BASIC_TEXT_PRICE_ID',
  stripe_product_id = 'prod_YOUR_BASIC_TEXT_PRODUCT_ID'
WHERE plan_name = 'Basic Text';

UPDATE public.justai_subscription_plans
SET 
  stripe_price_id = 'price_YOUR_PREMIUM_TEXT_PRICE_ID',
  stripe_product_id = 'prod_YOUR_PREMIUM_TEXT_PRODUCT_ID'
WHERE plan_name = 'Premium Text';

UPDATE public.justai_subscription_plans
SET 
  stripe_price_id = 'price_YOUR_BASIC_PLUS_PRICE_ID',
  stripe_product_id = 'prod_YOUR_BASIC_PLUS_PRODUCT_ID'
WHERE plan_name = 'Basic Plus (Voice)';

UPDATE public.justai_subscription_plans
SET 
  stripe_price_id = 'price_YOUR_PREMIUM_PLUS_PRICE_ID',
  stripe_product_id = 'prod_YOUR_PREMIUM_PLUS_PRODUCT_ID'
WHERE plan_name = 'Premium Plus (Voice)';

UPDATE public.justai_subscription_plans
SET 
  stripe_price_id = 'price_YOUR_UNLIMITED_PLUS_PRICE_ID',
  stripe_product_id = 'prod_YOUR_UNLIMITED_PLUS_PRODUCT_ID'
WHERE plan_name = 'Unlimited Plus (Voice)';
```

---

### 3. Create Webhook Endpoint

Go to: **Stripe Dashboard → Developers → Webhooks → Add endpoint**

#### Webhook Configuration:

```
Endpoint URL:
https://YOUR_PROJECT_REF.supabase.co/functions/v1/justai_webhook

Description:
JustAI Subscription Webhooks

Events to send:
☑ customer.subscription.created
☑ customer.subscription.updated
☑ customer.subscription.deleted
☑ invoice.payment_succeeded
☑ invoice.payment_failed
☑ customer.subscription.trial_will_end

API Version: (Latest)
```

**After creating the webhook**:
1. Click on the webhook
2. Click "Reveal" next to "Signing secret"
3. Copy the secret (starts with `whsec_`)
4. Run: `supabase secrets set STRIPE_JUSTAI_WEBHOOK_SECRET=whsec_YOUR_SECRET_HERE`

---

### 4. Deploy Webhook Handler

Make sure your `justai_webhook` Edge Function is deployed:

```bash
cd supabase/functions
supabase functions deploy justai_webhook
```

Verify it's deployed:
```bash
supabase functions list
```

---

### 5. Test Webhook

#### Option A: Using Stripe CLI (Recommended)

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe  # macOS
# or download from https://stripe.com/docs/stripe-cli

# Login
stripe login

# Test webhook locally
stripe listen --forward-to https://YOUR_PROJECT_REF.supabase.co/functions/v1/justai_webhook

# In another terminal, trigger test events
stripe trigger customer.subscription.created
stripe trigger invoice.payment_succeeded
stripe trigger customer.subscription.deleted
```

#### Option B: Using Stripe Dashboard

1. Go to **Developers → Webhooks**
2. Click on your JustAI webhook
3. Click **"Send test webhook"**
4. Select event: `customer.subscription.created`
5. Click **Send test webhook**
6. Check the response (should be 200 OK)

---

### 6. Verify Secrets

```bash
# List all secrets
supabase secrets list

# You should see:
# STRIPE_SECRET_KEY
# STRIPE_JUSTAI_WEBHOOK_SECRET
# ELEVENLABS_API_KEY
# ELEVENLABS_AGENT_ID
```

---

## Troubleshooting

### Webhook Returns 400 Error

**Problem**: Webhook signature verification fails

**Solutions**:
1. Check that `STRIPE_JUSTAI_WEBHOOK_SECRET` matches the webhook signing secret
2. Verify you copied the entire secret (starts with `whsec_`)
3. Make sure the webhook endpoint URL is correct
4. Check Edge Function logs: `supabase functions logs stripe-webhook-justai`

### Subscription Not Created in Database

**Problem**: Webhook received but no database record

**Solutions**:
1. Check that Price ID in Stripe matches Price ID in `justai_subscription_plans`
2. Verify RLS policies allow service role to insert
3. Check Edge Function logs for errors
4. Make sure student has a valid `profiles` record

### Price IDs Don't Match

**Problem**: Can't find plan for subscription

**Solutions**:
1. Verify Price IDs in Stripe Dashboard
2. Copy the exact Price ID (starts with `price_`)
3. Update `justai_subscription_plans` table with correct IDs
4. Query: `SELECT plan_name, stripe_price_id FROM justai_subscription_plans;`

---

## Stripe Dashboard URLs

Quick links for your reference:

- **Products**: https://dashboard.stripe.com/products
- **Webhooks**: https://dashboard.stripe.com/webhooks
- **API Keys**: https://dashboard.stripe.com/apikeys
- **Logs**: https://dashboard.stripe.com/logs

---

## Summary Checklist

- [ ] Created 5 JustAI products in Stripe
- [ ] Added metadata to each product (`system: justai`)
- [ ] Copied all Price IDs
- [ ] Updated `justai_subscription_plans` table with Price IDs
- [ ] Created webhook endpoint in Stripe
- [ ] Selected correct webhook events
- [ ] Copied webhook signing secret
- [ ] Set `STRIPE_JUSTAI_WEBHOOK_SECRET` in Supabase
- [ ] Set `STRIPE_SECRET_KEY` in Supabase (if not already set)
- [ ] Deployed `stripe-webhook-justai` Edge Function
- [ ] Tested webhook with Stripe CLI or Dashboard
- [ ] Verified webhook returns 200 OK
- [ ] Tested subscription creation flow
- [ ] Verified database records are created correctly

---

## Final Environment Variables

Your complete Stripe setup should have:

```bash
# In Supabase Secrets
STRIPE_SECRET_KEY=sk_live_...  # or sk_test_...
STRIPE_JUSTAI_WEBHOOK_SECRET=whsec_...

# In your frontend .env (public keys)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...  # or pk_test_...
```

All done! Your JustAI Stripe integration is ready. 🎉
