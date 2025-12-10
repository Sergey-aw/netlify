# JustAI Subscription Upgrade Guide

## Overview

This guide explains how subscription upgrades work in the JustAI platform, including proration behavior, message limit handling, and billing date management.

---

## Upgrade Strategy: Option A - Immediate Upgrade with Proration

We implement **immediate upgrade with proration**, which provides the best user experience:

### Key Features

✅ **Billing Date Stays the Same** - Users keep their original billing cycle  
✅ **Message Usage Preserved** - Used messages carry over, new limit applies immediately  
✅ **Prorated Charges** - Users only pay the difference for the remaining billing period  
✅ **Instant Access** - Higher limits are available immediately after upgrade  

---

## How It Works

### Example: Upgrading from Basic to Premium

**Starting State:**
- Plan: Basic (100 messages/month)
- Used: 40 messages
- Remaining: 60 messages
- Price: $14.99/month
- Billing date: 5th of each month
- Current date: December 15th

**After Upgrade:**
- Plan: Premium (300 messages/month)
- Used: 40 messages (preserved)
- **Remaining: 260 messages** (new limit - used messages)
- Price: $29.99/month
- Billing date: **Still 5th of each month** (unchanged)
- Immediate charge: Prorated difference (~$10 for remaining 20 days)

**Next Billing Cycle (January 5th):**
- Messages reset to 0/300
- Full $29.99 charge

---

## Technical Implementation

### 1. Proration Configuration

The `create-checkout-session` function configures proration:

```typescript
subscription_data: {
  proration_behavior: 'create_prorations', // Prorate charges for upgrades
}
```

This tells Stripe to:
- Calculate the unused time on the old plan
- Calculate the cost difference between plans
- Create an immediate invoice for the prorated amount
- Keep the same billing cycle

### 2. Webhook Handler Logic

The `stripe-webhook-justai` function handles mid-cycle upgrades:

```typescript
// Detect if this is a new billing cycle or mid-cycle change
const isNewBillingCycle = currentSub && periodStart && 
  new Date(periodStart * 1000).getTime() > new Date(currentSub.current_period_start).getTime();

if (isNewBillingCycle) {
  // New billing cycle - reset usage
  updateData.messages_used_this_period = 0;
} else if (planChanged) {
  // Mid-cycle upgrade - preserve usage
  // User gets immediate access to new limit
  // Don't modify messages_used_this_period
}
```

**Logic:**
- **New billing cycle detected**: Reset `messages_used_this_period` to 0
- **Mid-cycle plan change**: Keep existing usage, update limits only
- User immediately sees new higher limit with current usage intact

### 3. Upgrade Function

The new `upgrade-subscription` function allows programmatic upgrades:

```typescript
// Endpoint: /upgrade-subscription
// Body: { newPriceId: "price_xxx" }

await stripe.subscriptions.update(subscriptionId, {
  items: [{ id: itemId, price: newPriceId }],
  proration_behavior: 'create_prorations',
  billing_cycle_anchor: 'unchanged', // Keep same billing date
});
```

---

## User Experience Flow

### Frontend Display (Recommended)

When showing upgrade options, display:

```
Current Plan: Basic
- 100 messages/month
- Used: 40 messages
- Remaining: 60 messages
- Next billing: January 5, 2026

Upgrade to Premium:
- 300 messages/month
- After upgrade: 260 messages available immediately
- Prorated cost today: ~$10.00
- Next billing: January 5, 2026 ($29.99/month)
```

### API Response

The `upgrade-subscription` function returns:

```json
{
  "success": true,
  "subscription": {
    "id": "sub_xxx",
    "status": "active",
    "current_period_end": 1735862400
  },
  "upgrade": {
    "from": "basic",
    "to": "premium",
    "messages_remaining": 260,
    "new_monthly_limit": 300,
    "billing_date_unchanged": true
  }
}
```

---

## Database Schema

The `justai_subscriptions` table tracks:

```sql
CREATE TABLE justai_subscriptions (
  id uuid PRIMARY KEY,
  student_id uuid REFERENCES profiles(id),
  subscription_type text, -- 'basic', 'premium', 'unlimited'
  monthly_message_limit integer,
  messages_used_this_period integer DEFAULT 0,
  current_period_start timestamptz,
  current_period_end timestamptz,
  stripe_subscription_id text UNIQUE,
  stripe_price_id text,
  -- ... other fields
);
```

**Key Fields for Upgrades:**
- `messages_used_this_period`: Preserved during mid-cycle upgrades
- `monthly_message_limit`: Updated to new plan's limit
- `current_period_start/end`: Only changes on new billing cycle
- `stripe_price_id`: Updated to new plan's price ID

---

## Proration Behavior Options

Stripe offers three proration behaviors:

### 1. `create_prorations` (Our Choice) ⭐
- Creates invoice for prorated difference
- Billing date stays the same
- User pays immediately for upgrade
- Best for most use cases

### 2. `always_invoice`
- Immediately invoice and restart billing cycle
- Changes billing date to today
- Not recommended for upgrades

### 3. `none`
- No immediate charge
- Changes take effect at next renewal
- Not ideal for instant upgrades

---

## Edge Cases

### Upgrading Multiple Times in One Period

If a user upgrades from Basic → Premium → Unlimited:
- Each upgrade prorates from the current plan
- Message usage carries through all upgrades
- Billing date never changes

Example:
```
Day 1: Basic (100 msgs) - Used: 0
Day 10: Upgrade to Premium (300 msgs) - Used: 30, Remaining: 270
Day 20: Upgrade to Unlimited - Used: 80, Remaining: Unlimited
Day 30 (Billing): Reset to Unlimited plan, Usage: 0
```

### Downgrading

For downgrades, you may want different behavior:
- **Immediate**: Apply new lower limit immediately (user may lose access)
- **At period end**: Wait until next billing cycle (more user-friendly)

Current implementation treats downgrades the same as upgrades. Consider adding:

```typescript
const isUpgrade = newTier > currentTier;
const isDowngrade = newTier < currentTier;

if (isDowngrade) {
  // Option: Schedule downgrade for period end
  proration_behavior: 'none'
}
```

---

## Testing

### Test Upgrade Flow

1. **Create subscription:**
```bash
# Use Stripe CLI or checkout
stripe trigger customer.subscription.created
```

2. **Simulate usage:**
```sql
UPDATE justai_subscriptions 
SET messages_used_this_period = 40 
WHERE stripe_subscription_id = 'sub_xxx';
```

3. **Trigger upgrade:**
```bash
curl -X POST https://your-project.supabase.co/functions/v1/upgrade-subscription \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"newPriceId": "price_premium_monthly"}'
```

4. **Verify:**
```sql
SELECT 
  subscription_type,
  monthly_message_limit,
  messages_used_this_period,
  current_period_end
FROM justai_subscriptions 
WHERE stripe_subscription_id = 'sub_xxx';

-- Should show:
-- subscription_type: 'premium'
-- monthly_message_limit: 300
-- messages_used_this_period: 40 (preserved!)
-- current_period_end: (same as before)
```

---

## Monitoring

Track upgrade events in your logs:

```typescript
console.log('⬆️ Mid-cycle plan change detected', {
  studentId,
  oldPlan: currentSub.subscription_type,
  newPlan: plan.plan_type,
  oldLimit: currentSub.monthly_message_limit,
  newLimit: plan.monthly_message_limit,
  messagesUsed: currentSub.messages_used_this_period,
  messagesNowAvailable: plan.monthly_message_limit - currentSub.messages_used_this_period
});
```

---

## Related Files

- `/supabase/functions/stripe-webhook-justai/index.ts` - Webhook handler
- `/supabase/functions/create-checkout-session/index.ts` - Initial subscription creation
- `/supabase/functions/upgrade-subscription/index.ts` - Programmatic upgrades
- `STRIPE_WEBHOOK_IMPLEMENTATION_GUIDE.md` - Main webhook documentation

---

## Summary

✅ **Billing Date**: Unchanged during upgrades  
✅ **Message Usage**: Preserved, new limit applies immediately  
✅ **Proration**: Automatic, user pays fair amount  
✅ **User Experience**: Seamless, instant access to new limits  

This approach provides the best balance between fair billing and great user experience.
