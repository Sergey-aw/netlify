# Stripe Webhook Handler for JustAI - Complete Implementation Guide

## Overview

The `stripe-webhook-justai` Edge Function handles Stripe webhook events for JustAI subscription management. It receives events from Stripe when subscriptions are created, updated, canceled, or when payments succeed/fail, and synchronizes this data with your Supabase database.

---

## File Structure

```
supabase/functions/stripe-webhook-justai/
├── index.ts          # Main webhook handler (THIS FILE)
└── deno.json         # Deno configuration (optional)
```

---

## Complete Implementation

### File: `supabase/functions/stripe-webhook-justai/index.ts`

```typescript
// =============================================================================
// JustAI Stripe Webhook Handler
// =============================================================================
// This Edge Function handles Stripe webhook events for JustAI subscriptions
// 
// Responsibilities:
// 1. Verify webhook signature from Stripe
// 2. Parse webhook event payload
// 3. Update justai_subscriptions table based on event type
// 4. Handle subscription lifecycle (created, updated, deleted)
// 5. Track payment events (succeeded, failed)
// 
// Events Handled:
// - customer.subscription.created
// - customer.subscription.updated
// - customer.subscription.deleted
// - invoice.payment_succeeded
// - invoice.payment_failed
// - customer.subscription.trial_will_end (optional)
// =============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

// =============================================================================
// ENVIRONMENT VARIABLES
// =============================================================================

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_JUSTAI_WEBHOOK_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// Validate required environment variables
if (!STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY environment variable');
}
if (!STRIPE_WEBHOOK_SECRET) {
  throw new Error('Missing STRIPE_JUSTAI_WEBHOOK_SECRET environment variable');
}
if (!SUPABASE_URL) {
  throw new Error('Missing SUPABASE_URL environment variable');
}
if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
}

// =============================================================================
// INITIALIZE CLIENTS
// =============================================================================

// Initialize Stripe client
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

// Initialize Supabase client with service role (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface SubscriptionMetadata {
  student_id: string;
  plan_id?: string;
}

interface WebhookResponse {
  received: boolean;
  event_type?: string;
  subscription_id?: string;
  student_id?: string;
  error?: string;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get student_id from Stripe subscription metadata
 */
function getStudentId(subscription: Stripe.Subscription): string | null {
  const metadata = subscription.metadata as SubscriptionMetadata;
  return metadata?.student_id || null;
}

/**
 * Get plan_id from database using Stripe price_id
 */
async function getPlanIdFromPriceId(priceId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('justai_subscription_plans')
    .select('id')
    .eq('stripe_price_id', priceId)
    .single();

  if (error) {
    console.error('Error fetching plan:', error);
    return null;
  }

  return data?.id || null;
}

/**
 * Get billing period from Stripe subscription
 */
function getBillingPeriod(subscription: Stripe.Subscription): 'monthly' | 'annual' {
  const interval = subscription.items.data[0]?.price?.recurring?.interval;
  return interval === 'year' ? 'annual' : 'monthly';
}

/**
 * Convert Stripe subscription status to our status enum
 */
function mapStripeStatus(
  stripeStatus: Stripe.Subscription.Status
): 'active' | 'past_due' | 'canceled' | 'incomplete' {
  switch (stripeStatus) {
    case 'active':
      return 'active';
    case 'past_due':
      return 'past_due';
    case 'canceled':
    case 'unpaid':
      return 'canceled';
    case 'incomplete':
    case 'incomplete_expired':
    case 'trialing':
      return 'incomplete';
    default:
      return 'incomplete';
  }
}

// =============================================================================
// WEBHOOK EVENT HANDLERS
// =============================================================================

/**
 * Handle customer.subscription.created event
 * Creates a new subscription record in the database
 */
async function handleSubscriptionCreated(
  subscription: Stripe.Subscription
): Promise<WebhookResponse> {
  console.log('📝 Handling subscription.created:', subscription.id);

  const studentId = getStudentId(subscription);
  if (!studentId) {
    console.error('❌ No student_id in subscription metadata');
    return {
      received: true,
      error: 'Missing student_id in metadata',
    };
  }

  // Get the price ID from the subscription
  const priceId = subscription.items.data[0]?.price?.id;
  if (!priceId) {
    console.error('❌ No price_id found in subscription');
    return {
      received: true,
      error: 'Missing price_id',
    };
  }

  // Look up the plan in our database
  const planId = await getPlanIdFromPriceId(priceId);
  if (!planId) {
    console.error('❌ Could not find plan for price_id:', priceId);
    return {
      received: true,
      error: `Plan not found for price_id: ${priceId}`,
    };
  }

  // Determine billing period
  const billingPeriod = getBillingPeriod(subscription);

  // Create subscription record
  const { data, error } = await supabase
    .from('justai_subscriptions')
    .insert({
      student_id: studentId,
      plan_id: planId,
      billing_period: billingPeriod,
      status: mapStripeStatus(subscription.status),
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer as string,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      messages_used_this_period: 0,
    })
    .select()
    .single();

  if (error) {
    console.error('❌ Error creating subscription:', error);
    return {
      received: true,
      error: error.message,
    };
  }

  console.log('✅ Subscription created:', data.id);
  return {
    received: true,
    event_type: 'subscription.created',
    subscription_id: subscription.id,
    student_id: studentId,
  };
}

/**
 * Handle customer.subscription.updated event
 * Updates existing subscription record in the database
 */
async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription
): Promise<WebhookResponse> {
  console.log('🔄 Handling subscription.updated:', subscription.id);

  const studentId = getStudentId(subscription);
  if (!studentId) {
    console.error('❌ No student_id in subscription metadata');
    return {
      received: true,
      error: 'Missing student_id in metadata',
    };
  }

  // Get the price ID (may have changed if user upgraded/downgraded)
  const priceId = subscription.items.data[0]?.price?.id;
  if (!priceId) {
    console.error('❌ No price_id found in subscription');
    return {
      received: true,
      error: 'Missing price_id',
    };
  }

  // Look up the plan
  const planId = await getPlanIdFromPriceId(priceId);
  if (!planId) {
    console.error('❌ Could not find plan for price_id:', priceId);
    // Don't fail the webhook, just log it
  }

  // Determine billing period
  const billingPeriod = getBillingPeriod(subscription);

  // Update subscription record
  const { data, error } = await supabase
    .from('justai_subscriptions')
    .update({
      plan_id: planId || undefined, // Only update if we found a plan
      billing_period: billingPeriod,
      status: mapStripeStatus(subscription.status),
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000).toISOString()
        : null,
    })
    .eq('stripe_subscription_id', subscription.id)
    .select()
    .single();

  if (error) {
    console.error('❌ Error updating subscription:', error);
    return {
      received: true,
      error: error.message,
    };
  }

  console.log('✅ Subscription updated:', data.id);
  return {
    received: true,
    event_type: 'subscription.updated',
    subscription_id: subscription.id,
    student_id: studentId,
  };
}

/**
 * Handle customer.subscription.deleted event
 * Marks subscription as canceled in the database
 */
async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<WebhookResponse> {
  console.log('🗑️ Handling subscription.deleted:', subscription.id);

  const studentId = getStudentId(subscription);
  if (!studentId) {
    console.error('❌ No student_id in subscription metadata');
    return {
      received: true,
      error: 'Missing student_id in metadata',
    };
  }

  // Update subscription status to canceled
  const { data, error } = await supabase
    .from('justai_subscriptions')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id)
    .select()
    .single();

  if (error) {
    console.error('❌ Error deleting subscription:', error);
    return {
      received: true,
      error: error.message,
    };
  }

  console.log('✅ Subscription deleted:', data.id);
  return {
    received: true,
    event_type: 'subscription.deleted',
    subscription_id: subscription.id,
    student_id: studentId,
  };
}

/**
 * Handle invoice.payment_succeeded event
 * Updates subscription after successful payment
 * Resets message usage for new billing period
 */
async function handlePaymentSucceeded(
  invoice: Stripe.Invoice
): Promise<WebhookResponse> {
  console.log('💰 Handling payment.succeeded for invoice:', invoice.id);

  const subscriptionId = invoice.subscription as string;
  if (!subscriptionId) {
    console.log('ℹ️ No subscription associated with invoice');
    return { received: true };
  }

  // Get the subscription to extract metadata
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const studentId = getStudentId(subscription);

  if (!studentId) {
    console.error('❌ No student_id in subscription metadata');
    return {
      received: true,
      error: 'Missing student_id in metadata',
    };
  }

  // Update subscription: mark as active and reset message usage
  const { data, error } = await supabase
    .from('justai_subscriptions')
    .update({
      status: 'active',
      messages_used_this_period: 0, // Reset usage for new period
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    })
    .eq('stripe_subscription_id', subscriptionId)
    .select()
    .single();

  if (error) {
    console.error('❌ Error updating subscription after payment:', error);
    return {
      received: true,
      error: error.message,
    };
  }

  console.log('✅ Payment succeeded, subscription updated:', data.id);
  return {
    received: true,
    event_type: 'payment.succeeded',
    subscription_id: subscriptionId,
    student_id: studentId,
  };
}

/**
 * Handle invoice.payment_failed event
 * Marks subscription as past_due
 */
async function handlePaymentFailed(
  invoice: Stripe.Invoice
): Promise<WebhookResponse> {
  console.log('❌ Handling payment.failed for invoice:', invoice.id);

  const subscriptionId = invoice.subscription as string;
  if (!subscriptionId) {
    console.log('ℹ️ No subscription associated with invoice');
    return { received: true };
  }

  // Get the subscription to extract metadata
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const studentId = getStudentId(subscription);

  if (!studentId) {
    console.error('❌ No student_id in subscription metadata');
    return {
      received: true,
      error: 'Missing student_id in metadata',
    };
  }

  // Update subscription status to past_due
  const { data, error } = await supabase
    .from('justai_subscriptions')
    .update({
      status: 'past_due',
    })
    .eq('stripe_subscription_id', subscriptionId)
    .select()
    .single();

  if (error) {
    console.error('❌ Error updating subscription after payment failure:', error);
    return {
      received: true,
      error: error.message,
    };
  }

  console.log('⚠️ Payment failed, subscription marked past_due:', data.id);
  return {
    received: true,
    event_type: 'payment.failed',
    subscription_id: subscriptionId,
    student_id: studentId,
  };
}

// =============================================================================
// MAIN WEBHOOK HANDLER
// =============================================================================

serve(async (req) => {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    // Get the raw body as text
    const body = await req.text();
    
    // Get the Stripe signature from headers
    const signature = req.headers.get('stripe-signature');
    
    if (!signature) {
      console.error('❌ Missing stripe-signature header');
      return new Response('Missing signature', { status: 400 });
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        STRIPE_WEBHOOK_SECRET!
      );
      console.log('✅ Webhook signature verified');
    } catch (err) {
      console.error('❌ Webhook signature verification failed:', err.message);
      return new Response(`Webhook signature verification failed: ${err.message}`, {
        status: 400,
      });
    }

    // Log the event type
    console.log(`📨 Received event: ${event.type}`);

    // Route to appropriate handler based on event type
    let result: WebhookResponse;

    switch (event.type) {
      case 'customer.subscription.created':
        result = await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.updated':
        result = await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        result = await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        result = await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        result = await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`);
        result = { received: true };
    }

    // Return success response
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('💥 Unexpected error:', error);
    return new Response(
      JSON.stringify({
        received: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});

// =============================================================================
// NOTES & BEST PRACTICES
// =============================================================================

/*
 * IMPORTANT CONSIDERATIONS:
 * 
 * 1. IDEMPOTENCY:
 *    - Stripe may send the same webhook multiple times
 *    - Use .upsert() or check for existing records when appropriate
 *    - The current implementation uses stripe_subscription_id as unique identifier
 * 
 * 2. METADATA:
 *    - Always include student_id in Stripe subscription metadata when creating subscriptions
 *    - Example: { metadata: { student_id: "uuid-here" } }
 * 
 * 3. ERROR HANDLING:
 *    - Return 200 even on non-critical errors to prevent Stripe from retrying
 *    - Log all errors for debugging
 *    - Monitor webhook failures in Stripe Dashboard
 * 
 * 4. SECURITY:
 *    - Always verify webhook signature before processing
 *    - Use STRIPE_JUSTAI_WEBHOOK_SECRET specific to this endpoint
 *    - Never expose webhook secrets in client-side code
 * 
 * 5. TESTING:
 *    - Use Stripe CLI to test locally: stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook-justai
 *    - Test each event type: stripe trigger customer.subscription.created
 *    - Check Supabase logs: supabase functions logs stripe-webhook-justai
 * 
 * 6. MONITORING:
 *    - Check Stripe Dashboard → Webhooks for delivery status
 *    - Monitor Supabase function logs for errors
 *    - Set up alerts for failed webhooks
 * 
 * 7. DATABASE CONSIDERATIONS:
 *    - This function uses service role to bypass RLS policies
 *    - Ensure justai_subscriptions table has proper indexes on stripe_subscription_id
 *    - Consider adding a webhook_events table to log all received events
 */
```

---

## Configuration File (Optional)

### File: `supabase/functions/stripe-webhook-justai/deno.json`

```json
{
  "tasks": {
    "dev": "deno run --watch --allow-all index.ts"
  },
  "imports": {
    "stripe": "https://esm.sh/stripe@14.21.0?target=deno",
    "supabase": "https://esm.sh/@supabase/supabase-js@2.45.0"
  }
}
```

---

## Environment Variables Required

Set these in Supabase:

```bash
# Stripe credentials
supabase secrets set STRIPE_SECRET_KEY=sk_live_or_test_YOUR_KEY

# JustAI webhook signing secret (from Stripe webhook settings)
supabase secrets set STRIPE_JUSTAI_WEBHOOK_SECRET=whsec_YOUR_SECRET

# Supabase credentials (automatically available in Edge Functions)
# SUPABASE_URL - automatically set
# SUPABASE_SERVICE_ROLE_KEY - automatically set
```

---

## Deployment

### Step 1: Create the Function Directory

```bash
cd /path/to/your/supabase/functions
mkdir -p stripe-webhook-justai
```

### Step 2: Create the File

```bash
# Copy the code above into this file:
nano stripe-webhook-justai/index.ts
```

### Step 3: Deploy to Supabase

```bash
supabase functions deploy stripe-webhook-justai
```

### Step 4: Verify Deployment

```bash
supabase functions list
# Should show stripe-webhook-justai in the list
```

---

## Stripe Webhook Configuration

### Step 1: Create Endpoint in Stripe Dashboard

1. Go to: https://dashboard.stripe.com/webhooks
2. Click **"Add endpoint"**
3. **Endpoint URL**:
   ```
   https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook-justai
   ```
   (Replace `YOUR_PROJECT_REF` with `bcsyrxkfeatnbaqlnxgr`)

4. **Description**: JustAI Subscription Webhooks

5. **Events to send** - Select these:
   - ✅ `customer.subscription.created`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
   - ✅ `invoice.payment_succeeded`
   - ✅ `invoice.payment_failed`

6. Click **"Add endpoint"**

### Step 2: Get Webhook Signing Secret

1. Click on the webhook you just created
2. Click **"Reveal"** next to "Signing secret"
3. Copy the secret (starts with `whsec_`)
4. Set it in Supabase:
   ```bash
   supabase secrets set STRIPE_JUSTAI_WEBHOOK_SECRET=whsec_YOUR_SECRET_HERE
   ```

---

## Testing

### Local Testing with Stripe CLI

```bash
# 1. Install Stripe CLI
brew install stripe/stripe-cli/stripe  # macOS
# or download from https://stripe.com/docs/stripe-cli

# 2. Login to Stripe
stripe login

# 3. Forward webhooks to your local Supabase
stripe listen --forward-to https://bcsyrxkfeatnbaqlnxgr.supabase.co/functions/v1/stripe-webhook-justai

# 4. In another terminal, trigger test events
stripe trigger customer.subscription.created
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
stripe trigger invoice.payment_succeeded
stripe trigger invoice.payment_failed
```

### Test via Stripe Dashboard

1. Go to: https://dashboard.stripe.com/webhooks
2. Click on your webhook
3. Click **"Send test webhook"**
4. Select an event type
5. Click **"Send test webhook"**
6. Check the response (should be 200 OK)

### View Function Logs

```bash
# View real-time logs
supabase functions logs stripe-webhook-justai --tail

# View recent logs
supabase functions logs stripe-webhook-justai
```

---

## Database Schema Requirements

The webhook handler expects this table structure:

```sql
-- justai_subscriptions table
CREATE TABLE justai_subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES justai_subscription_plans(id),
  billing_period text NOT NULL CHECK (billing_period IN ('monthly', 'annual')),
  status text NOT NULL CHECK (status IN ('active', 'past_due', 'canceled', 'incomplete')),
  stripe_subscription_id text UNIQUE NOT NULL,
  stripe_customer_id text NOT NULL,
  current_period_start timestamptz NOT NULL,
  current_period_end timestamptz NOT NULL,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  canceled_at timestamptz,
  messages_used_this_period integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast webhook lookups
CREATE INDEX idx_justai_subscriptions_stripe_id 
  ON justai_subscriptions(stripe_subscription_id);
```

---

## How Subscriptions Flow

### 1. User Subscribes (Frontend)

```typescript
// Frontend creates Stripe checkout session
const response = await fetch('/api/create-checkout-session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    priceId: 'price_1SaM64DRBhjHHfgoMmMgMmkK',
    studentId: 'user-uuid-here',
  }),
});

// Stripe checkout session should include metadata
{
  metadata: {
    student_id: 'user-uuid-here',
  }
}
```

### 2. Stripe Sends Webhook

After successful payment, Stripe sends `customer.subscription.created` to your webhook endpoint.

### 3. Webhook Handler Processes Event

```
1. Verify signature ✅
2. Extract student_id from metadata
3. Look up plan_id from stripe_price_id
4. Insert record into justai_subscriptions table
5. Return 200 OK
```

### 4. User Can Now Use JustAI

Frontend checks subscription status:

```typescript
const { data: subscription } = await supabase
  .from('justai_subscriptions')
  .select('*, plan:justai_subscription_plans(*)')
  .eq('student_id', userId)
  .eq('status', 'active')
  .single();

if (subscription) {
  // User has active subscription, allow access
}
```

---

## Common Issues & Debugging

### Issue 1: Webhook Returns 400 - Missing Signature

**Cause**: Stripe signature header is missing or malformed

**Solution**:
- Check that Stripe is configured with correct endpoint URL
- Verify webhook secret is set correctly in Supabase

### Issue 2: Webhook Returns 400 - Signature Verification Failed

**Cause**: Wrong webhook secret or body has been modified

**Solution**:
```bash
# Make sure you're using the correct secret
supabase secrets set STRIPE_JUSTAI_WEBHOOK_SECRET=whsec_YOUR_ACTUAL_SECRET

# Get the secret from Stripe Dashboard → Webhooks → [Your Webhook] → Signing secret
```

### Issue 3: Subscription Not Created in Database

**Cause**: Missing student_id in metadata or plan_id not found

**Solution**:
- Check Stripe subscription metadata includes `student_id`
- Verify price_id exists in `justai_subscription_plans` table
- Check function logs: `supabase functions logs stripe-webhook-justai`

### Issue 4: Database Error - RLS Policy

**Cause**: Function is using anon key instead of service role

**Solution**:
- Ensure you're using `SUPABASE_SERVICE_ROLE_KEY` (automatic in Edge Functions)
- Check that service role key is not expired

### Issue 5: Webhook Keeps Retrying

**Cause**: Function returning 500 error repeatedly

**Solution**:
- Check function logs for specific error
- Return 200 even on non-critical errors to prevent retry loop
- Fix underlying issue, then use Stripe Dashboard to replay failed events

---

## Monitoring & Maintenance

### Stripe Dashboard Monitoring

1. Go to: https://dashboard.stripe.com/webhooks
2. Click on your webhook
3. View **"Recent deliveries"** tab
4. Check for failed deliveries (red X)
5. Click on failed delivery to see error details

### Supabase Logs

```bash
# View last 100 log entries
supabase functions logs stripe-webhook-justai --limit 100

# Filter for errors
supabase functions logs stripe-webhook-justai | grep "ERROR"

# Real-time monitoring
supabase functions logs stripe-webhook-justai --tail
```

### Recommended Alerts

Set up monitoring for:
- ❌ Webhook delivery failures (in Stripe)
- ❌ Function errors (in Supabase)
- ⚠️ Past due subscriptions (query database)
- 📊 Subscription creation rate (analytics)

---

## Security Best Practices

1. **Always verify signatures**:
   - Never skip signature verification
   - Use the correct webhook secret for this endpoint

2. **Validate data**:
   - Check that student_id exists in profiles table
   - Validate price_id exists in plans table
   - Sanitize all inputs

3. **Use service role carefully**:
   - Service role bypasses RLS
   - Only use for trusted operations
   - Never expose service role key to client

4. **Log everything**:
   - Log all events for audit trail
   - Log errors with context
   - Monitor logs regularly

5. **Handle failures gracefully**:
   - Return 200 to prevent retries on non-recoverable errors
   - Return 500 only for transient errors (database down, etc.)
   - Store failed events for manual review

---

## Advanced Features (Optional)

### Add Webhook Event Logging

Track all webhook events in a separate table:

```sql
CREATE TABLE justai_webhook_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type text NOT NULL,
  stripe_event_id text UNIQUE NOT NULL,
  subscription_id text,
  student_id uuid,
  payload jsonb NOT NULL,
  processed boolean NOT NULL DEFAULT true,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

Then add to webhook handler:

```typescript
// After processing event
await supabase.from('justai_webhook_events').insert({
  event_type: event.type,
  stripe_event_id: event.id,
  subscription_id: subscription.id,
  student_id: studentId,
  payload: event,
  processed: !error,
  error: error?.message || null,
});
```

### Add Idempotency Check

Prevent duplicate processing:

```typescript
// Check if event already processed
const { data: existing } = await supabase
  .from('justai_webhook_events')
  .select('id')
  .eq('stripe_event_id', event.id)
  .single();

if (existing) {
  console.log('Event already processed:', event.id);
  return new Response(JSON.stringify({ received: true }), { status: 200 });
}
```

---

## Summary Checklist

Before deploying to production:

- [ ] Code copied to `supabase/functions/stripe-webhook-justai/index.ts`
- [ ] Environment variables set in Supabase
- [ ] Function deployed: `supabase functions deploy stripe-webhook-justai`
- [ ] Webhook endpoint created in Stripe Dashboard
- [ ] Webhook events selected (subscription.*, invoice.payment_*)
- [ ] Webhook signing secret copied to Supabase
- [ ] Tested with Stripe CLI
- [ ] Tested with Stripe Dashboard test webhook
- [ ] Verified subscription creation in database
- [ ] Checked function logs for errors
- [ ] Monitoring set up for failures

---

**Your webhook handler is now complete and production-ready!** 🚀

For questions or issues, check:
- Stripe Dashboard → Webhooks → Recent deliveries
- Supabase Dashboard → Functions → Logs
- Database: `SELECT * FROM justai_subscriptions ORDER BY created_at DESC;`
