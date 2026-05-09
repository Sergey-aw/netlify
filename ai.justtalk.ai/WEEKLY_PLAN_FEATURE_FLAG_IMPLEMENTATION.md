# Weekly Plan Feature Flag Implementation

## Overview

Implemented a PostHog feature flag controlled weekly subscription plan option for the JustAI subscription paywall. The weekly plan appears as a separate tab alongside Monthly and Annual plans.

## Feature Flag Details

**Feature Flag Name**: `weekly-plan-show-paywall`

**Variants**:
- `control` - Shows the weekly plan tab
- `hidden` - Hides the weekly plan tab (default)

## Changes Made

### 1. Type Definitions (`ai-chat-app/src/lib/justai-types.ts`)

Updated subscription types to support weekly billing:

```typescript
// Updated SubscriptionPlan interface
billing_period: 'weekly' | 'monthly' | 'annual';

// Updated Subscription interface
billing_period: 'weekly' | 'monthly' | 'annual';
```

### 2. Subscription Plans Component (`ai-chat-app/src/pages/SubscriptionPlans.tsx`)

#### Feature Flag Integration
```typescript
// Add PostHog feature flag check
const weeklyPlanVariant = useFeatureFlagVariant('weekly-plan-show-paywall', 'hidden');
const showWeeklyPlan = weeklyPlanVariant === 'control';
```

#### Billing Cycle State
```typescript
const [billingCycle, setBillingCycle] = useState<'weekly' | 'monthly' | 'annual'>('monthly');
```

#### Weekly Plans Query
```typescript
const { data: weeklyPlans, isLoading: isLoadingWeekly } = useQuery({
  queryKey: ['subscription-plans', 'weekly'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('justai_subscription_plans')
      .select('*')
      .eq('is_active', true)
      .eq('billing_period', 'weekly')
      .order('display_order');

    if (error) throw error;
    return data as SubscriptionPlan[];
  },
  enabled: showWeeklyPlan, // Only fetch if feature flag is enabled
});
```

#### Tab Component
- Updated to show 3 tabs when `showWeeklyPlan` is true
- Animated sliding background adjusts width and position based on number of tabs
- Conditional rendering of Weekly tab

#### Price Display
- Horizontal layout: Shows `$X.XX/wk` for weekly plans
- Vertical layout: Shows `$X.XX / week` for weekly plans
- Billing text: "billed weekly", "billed monthly", or "billed yearly"

### 3. PostHog Tracking (`ai-chat-app/src/lib/posthog.ts`)

Updated tracking functions to support weekly billing:

```typescript
export const trackPaywallViewed = (billingCycle?: 'weekly' | 'monthly' | 'annual')
export const trackPlanSelected = (..., billingPeriod: 'weekly' | 'monthly' | 'annual', ...)
export const trackCheckoutStarted = (..., billingPeriod: 'weekly' | 'monthly' | 'annual')
```

## Setting Up the Weekly Plan

### Step 1: Configure PostHog Feature Flag

1. Go to PostHog dashboard
2. Navigate to Feature Flags
3. Create or edit feature flag: `weekly-plan-show-paywall`
4. Set variants:
   - `control` - Show weekly plan
   - `hidden` - Hide weekly plan (default)
5. Configure rollout percentage (e.g., 50% to control, 50% to hidden for A/B test)

### Step 2: Create Stripe Product (Weekly Plan)

```bash
# Using Stripe CLI or Dashboard
stripe products create \
  --name "JustAI Weekly Basic" \
  --description "Basic plan with $4.99/week billing" \
  --metadata[system]="justai" \
  --metadata[plan_type]="basic" \
  --metadata[includes_voice]="true" \
  --metadata[message_limit]="25"

# Create price
stripe prices create \
  --product <PRODUCT_ID> \
  --currency usd \
  --unit-amount 499 \
  --recurring[interval]=week \
  --nickname "JustAI Weekly Basic" \
  --metadata[billing_period]="weekly"
```

### Step 3: Add Weekly Plan to Database

```sql
INSERT INTO public.justai_subscription_plans (
  plan_name,
  plan_type,
  billing_period,
  description,
  monthly_message_limit,
  includes_voice,
  price_cents,
  monthly_equivalent_cents,
  discount_percentage,
  stripe_price_id,
  stripe_product_id,
  features,
  is_active,
  is_featured,
  display_order
) VALUES (
  'Basic',
  'basic',
  'weekly',
  'Get started with AI-powered English learning',
  25, -- ~100 per month
  true,
  499, -- $4.99/week
  1996, -- $4.99 * 4 weeks ≈ $19.96/month
  0,
  'price_YOUR_WEEKLY_PRICE_ID',
  'prod_YOUR_WEEKLY_PRODUCT_ID',
  '{
    "items": [
      {"name": "25 AI Voice Conversations", "description": "Practice speaking with AI teacher"},
      {"name": "Real-time Feedback", "description": "Get instant corrections and suggestions"},
      {"name": "Vocabulary Builder", "description": "Track and review new words"}
    ]
  }'::jsonb,
  true,
  false,
  1
);
```

## Testing

### Test Scenarios

1. **Feature Flag = `hidden`** (default)
   - Only Monthly and Annual tabs appear
   - 2-tab layout with sliding indicator
   - No weekly plans fetched

2. **Feature Flag = `control`**
   - Weekly, Monthly, and Annual tabs appear
   - 3-tab layout with sliding indicator adjusting to 33% width
   - Weekly plans fetched and displayed

3. **Both Layouts**
   - Test horizontal layout (variant = `false`)
   - Test vertical layout (variant = `control`)
   - Verify price display shows "wk" or "week" correctly

### Testing the Feature Flag

```javascript
// In browser console (with PostHog initialized)
window.posthog.getFeatureFlag('weekly-plan-show-paywall')
// Returns: 'control' or 'hidden'

// Force variant for testing
window.posthog.featureFlags.override({'weekly-plan-show-paywall': 'control'})
```

## UI Behavior

### Tab Animation
- Smooth spring animation for tab indicator
- Position calculations:
  - 2 tabs: `left: 50%` for second tab
  - 3 tabs: 
    - Weekly: `left: 4px`
    - Monthly: `left: calc(33.33% + 2px)`
    - Annual: `left: calc(66.66% + 1px)`

### Price Display
```
Weekly: $4.99/wk (billed weekly)
Monthly: $14.99/mo (billed monthly)
Annual: $12.49/mo (billed yearly)
```

## Rollout Strategy

### Recommended Approach

1. **Phase 1: Internal Testing** (Feature Flag = 0% rollout)
   - Set flag to `control` for internal team emails
   - Test checkout flow end-to-end
   - Verify Stripe webhook handling

2. **Phase 2: Limited Beta** (Feature Flag = 10% to `control`)
   - Monitor conversion rates
   - Track events: `subscription_billing_cycle_changed`, `subscription_plan_selected`
   - Collect user feedback

3. **Phase 3: A/B Test** (Feature Flag = 50% to `control`)
   - Compare metrics between control and hidden groups
   - Monitor: conversion rate, ARPU, churn rate

4. **Phase 4: Full Rollout** (Feature Flag = 100% to `control`)
   - If weekly plan shows positive results
   - Or remove feature flag and make it permanent

## Monitoring & Analytics

### PostHog Events to Track

```javascript
// Automatic tracking
'paywall_viewed' { billing_cycle: 'weekly' | 'monthly' | 'annual' }
'subscription_billing_cycle_changed' { billing_cycle: 'weekly', ... }
'subscription_plan_selected' { plan_name: 'Basic', billing_cycle: 'weekly', ... }
'subscription_checkout_started' { billing_period: 'weekly', ... }
```

### Key Metrics

- Weekly plan selection rate
- Conversion rate by billing cycle
- Average revenue per user (ARPU)
- Customer lifetime value (CLV)
- Churn rate by billing cycle

## Database Schema Reference

```sql
-- justai_subscription_plans table structure
CREATE TABLE justai_subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_name text NOT NULL,
  plan_type text NOT NULL CHECK (plan_type IN ('basic', 'premium', 'unlimited')),
  billing_period text NOT NULL CHECK (billing_period IN ('weekly', 'monthly', 'annual')),
  description text,
  monthly_message_limit integer,
  includes_voice boolean DEFAULT false,
  price_cents integer NOT NULL,
  monthly_equivalent_cents integer NOT NULL,
  discount_percentage numeric DEFAULT 0,
  stripe_price_id text NOT NULL,
  stripe_product_id text NOT NULL,
  features jsonb,
  is_active boolean DEFAULT true,
  is_featured boolean DEFAULT false,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

## Notes

- Price for weekly plan: **$4.99/week**
- Weekly plans only show when feature flag is set to `control`
- The implementation supports both horizontal and vertical layout variants
- Tab sliding animation automatically adjusts based on number of tabs shown
