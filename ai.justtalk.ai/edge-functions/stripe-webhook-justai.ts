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

// @ts-ignore: Runtime imports for Deno
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @ts-ignore: Runtime imports for Deno
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
// @ts-ignore: Runtime imports for Deno
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

// Declare Deno globally for local typecheck
declare const Deno: any;

// =============================================================================
// ENVIRONMENT VARIABLES
// =============================================================================

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
const STRIPE_JUSTAI_WEBHOOK_SECRET = Deno.env.get('STRIPE_JUSTAI_WEBHOOK_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// Validate required environment variables
if (!STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY environment variable');
}
if (!STRIPE_JUSTAI_WEBHOOK_SECRET) {
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
function getStudentId(subscription: any): string | null {
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
function getBillingPeriod(subscription: any): 'monthly' | 'annual' {
  const interval = subscription.items.data[0]?.price?.recurring?.interval;
  return interval === 'year' ? 'annual' : 'monthly';
}

/**
 * Convert Stripe subscription status to our status enum
 */
function mapStripeStatus(
  stripeStatus: string
): 'active' | 'past_due' | 'canceled' | 'expired' {
  switch (stripeStatus) {
    case 'active':
    case 'trialing': // Trial subscriptions should be active
      return 'active';
    case 'past_due':
      return 'past_due';
    case 'canceled':
    case 'unpaid':
      return 'canceled';
    case 'incomplete':
    case 'incomplete_expired':
      return 'expired';
    default:
      console.warn('Unknown Stripe status, defaulting to expired:', stripeStatus);
      return 'expired';
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
  subscription: any
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
  const { data: plan } = await supabase
    .from('justai_subscription_plans')
    .select('*')
    .eq('stripe_price_id', priceId)
    .single();

  if (!plan) {
    console.error('❌ Could not find plan for price_id:', priceId);
    return {
      received: true,
      error: `Plan not found for price_id: ${priceId}`,
    };
  }

  // Determine billing period
  const billingPeriod = getBillingPeriod(subscription);

  // Get timestamps from subscription item (Stripe API structure)
  const subscriptionItem = subscription.items?.data?.[0];
  const periodStart = subscriptionItem?.current_period_start;
  const periodEnd = subscriptionItem?.current_period_end;
  
  if (!periodStart || !periodEnd) {
    console.error('❌ Missing period timestamps in subscription item');
    return {
      received: true,
      error: 'Missing current_period_start or current_period_end in subscription item',
    };
  }

  // Create subscription record
  const { data, error } = await supabase
    .from('justai_subscriptions')
    .insert({
      student_id: studentId,
      subscription_type: plan.plan_type,
      monthly_message_limit: plan.monthly_message_limit,
      price_cents: plan.price_cents,
      currency: 'usd',
      billing_cycle: billingPeriod,
      billing_period: billingPeriod,
      status: mapStripeStatus(subscription.status),
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer as string,
      stripe_price_id: priceId,
      current_period_start: new Date(periodStart * 1000).toISOString(),
      current_period_end: new Date(periodEnd * 1000).toISOString(),
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
  subscription: any
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
  const { data: plan } = await supabase
    .from('justai_subscription_plans')
    .select('*')
    .eq('stripe_price_id', priceId)
    .single();

  // Determine billing period
  const billingPeriod = getBillingPeriod(subscription);

  // Get timestamps from subscription item
  const subscriptionItem = subscription.items?.data?.[0];
  const periodStart = subscriptionItem?.current_period_start;
  const periodEnd = subscriptionItem?.current_period_end;

  // Build update object
  const updateData: any = {
    billing_period: billingPeriod,
    status: mapStripeStatus(subscription.status),
    updated_at: new Date().toISOString(),
  };

  // Add period dates if available
  if (periodStart && periodEnd) {
    updateData.current_period_start = new Date(periodStart * 1000).toISOString();
    updateData.current_period_end = new Date(periodEnd * 1000).toISOString();
  }

  // If plan changed, update plan details
  if (plan) {
    updateData.subscription_type = plan.plan_type;
    updateData.monthly_message_limit = plan.monthly_message_limit;
    updateData.price_cents = plan.price_cents;
    updateData.stripe_price_id = priceId;
  }

  // Update subscription record
  const { data, error } = await supabase
    .from('justai_subscriptions')
    .update(updateData)
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
  subscription: any
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
      updated_at: new Date().toISOString(),
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
  invoice: any
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

  // Get timestamps from subscription item
  const subscriptionItem = subscription.items?.data?.[0];
  const periodStart = subscriptionItem?.current_period_start;
  const periodEnd = subscriptionItem?.current_period_end;

  // Update subscription: mark as active and reset message usage
  const updateData: any = {
    status: 'active',
    messages_used_this_period: 0, // Reset usage for new period
    updated_at: new Date().toISOString(),
  };

  // Add period dates if available
  if (periodStart && periodEnd) {
    updateData.current_period_start = new Date(periodStart * 1000).toISOString();
    updateData.current_period_end = new Date(periodEnd * 1000).toISOString();
  }

  const { data, error } = await supabase
    .from('justai_subscriptions')
    .update(updateData)
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
  invoice: any
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
      updated_at: new Date().toISOString(),
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
    let event: any;
    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        STRIPE_JUSTAI_WEBHOOK_SECRET!
      );
      console.log('✅ Webhook signature verified');
    } catch (err: any) {
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
        result = await handleSubscriptionCreated(event.data.object);
        break;

      case 'customer.subscription.updated':
        result = await handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        result = await handleSubscriptionDeleted(event.data.object);
        break;

      case 'invoice.payment_succeeded':
        result = await handlePaymentSucceeded(event.data.object);
        break;

      case 'invoice.payment_failed':
        result = await handlePaymentFailed(event.data.object);
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

  } catch (error: any) {
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
