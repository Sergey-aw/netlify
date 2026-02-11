# Pricing Variant URL Parameter Implementation Plan

## Overview
Implement dynamic pricing display on the subscription-plans page based on `pricing_variant` URL parameter. This will enable A/B testing different pricing strategies while maintaining a single codebase.

## Current State Analysis

### Database Schema (justai_subscription_plans)
**Current columns:**
- `id` (uuid)
- `plan_name` (text)
- `plan_type` (text) - e.g., "basic", "premium"
- `billing_period` (text) - "weekly", "monthly", "annual"
- `description` (text)
- `monthly_message_limit` (integer)
- `includes_voice` (boolean)
- `price_cents` (integer) - **Single price per plan**
- `monthly_equivalent_cents` (integer)
- `discount_percentage` (integer)
- `stripe_price_id` (text) - **Single Stripe price ID**
- `stripe_product_id` (text)
- `features` (jsonb)
- `is_active` (boolean)
- `is_featured` (boolean)
- `display_order` (integer)
- `voice_minutes_limit` (integer)
- `created_at`, `updated_at` (timestamp)

**Current data:**
- 5 active plans
- 2 plan types: "basic", "premium"
- 3 billing periods: "weekly", "monthly", "annual"
- Each plan has a single price point

### URL Parameter Examples
```
Control: ?plan=basic&pricing_variant=control&ref=justtalk.ai
Plan A:  ?plan=premium&pricing_variant=plan-a&ref=justtalk.ai
Plan B:  ?pricing_variant=plan-b&ref=justtalk.ai
```

### Pricing Variants
```json
{
  "control": {
    "basic_monthly": "19.99",
    "basic_annual": "149.99",
    "premium_monthly": "37.99",
    "premium_annual": "299.99"
  },
  "plan-a": {
    "basic_monthly": "9.99",
    "basic_annual": "99.99",
    "premium_monthly": "19.99",
    "premium_annual": "149.99"
  },
  "plan-b": {
    "basic_monthly": "14.99",
    "basic_annual": "149.99",
    "premium_monthly": "24.99",
    "premium_annual": "249.99"
  }
}
```

### Current Frontend Implementation
**File:** [ai-chat-app/src/pages/SubscriptionPlans.tsx](ai-chat-app/src/pages/SubscriptionPlans.tsx)

**Current behavior:**
1. Uses `useSearchParams()` to handle URL parameters
2. Currently only checks for `canceled=true` parameter
3. Fetches plans directly from Supabase by `billing_period` and `is_active`
4. No pricing variant handling
5. Uses `stripe_price_id` directly from database
6. Trial variant experiment already implemented using PostHog feature flags

**Key code sections:**
- Line 22: `const [searchParams, setSearchParams] = useSearchParams();`
- Lines 202-242: Three separate queries for weekly/monthly/annual plans
- Line 405: Checkout params construction
- Line 35: Trial variant from PostHog: `const trialVariant = useFeatureFlagVariantKey('trial-period-experiment');`

## Implementation Plan

### Approach: Multiple Database Records (Recommended)

**Rationale:**
- Clean separation of pricing variants
- Each variant has its own Stripe Price ID (required for Stripe)
- Easy to activate/deactivate variants
- Simple queries without complex joins
- Maintains data integrity
- Easy to track which variant a subscription was created with
- Supports different Stripe products per variant if needed

### Database Changes

#### Option 1: Add `pricing_variant` Column (RECOMMENDED)

**Migration:**
```sql
-- Add pricing_variant column to justai_subscription_plans
ALTER TABLE justai_subscription_plans 
ADD COLUMN pricing_variant TEXT DEFAULT 'control';

-- Add index for faster queries
CREATE INDEX idx_subscription_plans_variant 
ON justai_subscription_plans(pricing_variant, billing_period, plan_type, is_active);

-- Update existing plans to 'control' variant
UPDATE justai_subscription_plans 
SET pricing_variant = 'control';

-- Make pricing_variant NOT NULL after backfill
ALTER TABLE justai_subscription_plans 
ALTER COLUMN pricing_variant SET NOT NULL;

-- Add check constraint for valid variants
ALTER TABLE justai_subscription_plans
ADD CONSTRAINT valid_pricing_variant 
CHECK (pricing_variant IN ('control', 'plan-a', 'plan-b', 'plan-c'));
```

**Benefits:**
- Simple, clean schema
- Easy to query: `WHERE pricing_variant = 'plan-a'`
- Each variant has dedicated Stripe price IDs
- Can enable/disable variants via `is_active`
- Clear data model

**Data Structure Example:**
```
ID   | plan_type | billing_period | pricing_variant | price_cents | stripe_price_id        | is_active
-----|-----------|----------------|-----------------|-------------|------------------------|----------
1    | basic     | monthly        | control         | 1999        | price_xxx_control      | true
2    | basic     | monthly        | plan-a          | 999         | price_xxx_plan_a       | true
3    | basic     | monthly        | plan-b          | 1499        | price_xxx_plan_b       | true
4    | basic     | annual         | control         | 14999       | price_yyy_control      | true
5    | basic     | annual         | plan-a          | 9999        | price_yyy_plan_a       | true
```

#### Option 2: Complex JSONB Structure (NOT RECOMMENDED)

Store all variants in a JSONB column - would be complex to query and maintain.

### Frontend Changes

#### 1. URL Parameter Extraction
**File:** [ai-chat-app/src/pages/SubscriptionPlans.tsx](ai-chat-app/src/pages/SubscriptionPlans.tsx)

**Changes needed:**
```typescript
// After line 22 - Extract pricing_variant from URL
const pricingVariant = searchParams.get('pricing_variant') || 'control';

// Validate pricing variant
const validVariants = ['control', 'plan-a', 'plan-b'];
const effectivePricingVariant = validVariants.includes(pricingVariant) 
  ? pricingVariant 
  : 'control';

// Log for analytics
console.log('[Pricing Variant] URL parameter:', {
  raw: pricingVariant,
  effective: effectivePricingVariant,
  timestamp: new Date().toISOString()
});
```

#### 2. Update Query Functions
**Modify lines 202-242:**

```typescript
// Fetch monthly plans with pricing variant
const { data: monthlyPlans, isLoading: isLoadingMonthly } = useQuery({
  queryKey: ['subscription-plans', 'monthly', effectivePricingVariant],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('justai_subscription_plans')
      .select('*')
      .eq('is_active', true)
      .eq('billing_period', 'monthly')
      .eq('pricing_variant', effectivePricingVariant)
      .order('display_order');

    if (error) throw error;
    return data as SubscriptionPlan[];
  },
});

// Similar changes for annual and weekly plans
```

#### 3. Update TypeScript Types
**File:** [ai-chat-app/src/lib/justai-types.ts](ai-chat-app/src/lib/justai-types.ts)

**Add pricing_variant to interface (around line 15):**
```typescript
export interface SubscriptionPlan {
  id: string;
  plan_name: string;
  plan_type: 'basic' | 'premium' | 'unlimited';
  billing_period: 'weekly' | 'monthly' | 'annual';
  pricing_variant: 'control' | 'plan-a' | 'plan-b'; // NEW
  description: string;
  monthly_message_limit: number | null;
  includes_voice: boolean;
  price_cents: number;
  monthly_equivalent_cents: number;
  discount_percentage: number;
  stripe_price_id: string;
  stripe_product_id: string;
  features: PlanFeatures | string[];
  is_active: boolean;
  is_featured: boolean;
  display_order: number;
}
```

#### 4. Track Pricing Variant in Analytics
**Add tracking around line 175:**

```typescript
// Track pricing variant view
useEffect(() => {
  if (effectivePricingVariant) {
    trackEvent('pricing_variant_viewed', {
      pricing_variant: effectivePricingVariant,
      billing_cycle: billingCycle,
      user_id: user?.id,
      is_anonymous: isAnonymous,
      timestamp: new Date().toISOString()
    });
  }
}, [effectivePricingVariant, billingCycle, user?.id, isAnonymous]);
```

#### 5. Pass Variant to Checkout
**Update checkout params (around line 405):**

```typescript
const checkoutParams = new URLSearchParams({
  priceId,
  planName: plan?.plan_name || 'Selected Plan',
  planPrice: plan?.price_cents.toString() || '0',
  billingPeriod: plan?.billing_period || 'monthly',
  pricingVariant: effectivePricingVariant, // NEW
});
```

### Backend Changes

#### Edge Function Updates
**File:** [edge-functions/create-checkout-session.ts](edge-functions/create-checkout-session.ts)

**Changes needed:**
1. Accept `pricingVariant` parameter from request body
2. Verify the `stripe_price_id` matches the expected variant
3. Store `pricing_variant` in subscription metadata or a new column

**Around line 40-60:**
```typescript
const { priceId, planName, planPrice, billingPeriod, pricingVariant } = await req.json()

// Validate pricing variant
const validVariants = ['control', 'plan-a', 'plan-b'];
const effectiveVariant = validVariants.includes(pricingVariant) 
  ? pricingVariant 
  : 'control';

console.log('Creating checkout session with pricing variant:', {
  priceId,
  pricingVariant: effectiveVariant
});

// Optional: Verify price ID matches expected variant
// Query justai_subscription_plans to confirm this is correct
```

**Store variant in Stripe metadata (around line 289-300):**
```typescript
const session = await stripe.checkout.sessions.create({
  customer: customerId,
  line_items: [{
    price: priceId,
    quantity: 1,
  }],
  mode: 'subscription',
  success_url: `${frontendUrl}/subscription-status?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${frontendUrl}/subscription-plans?canceled=true`,
  metadata: {
    student_id: user.id,
    pricing_variant: effectiveVariant, // NEW - for tracking
    plan_name: planName,
    billing_period: billingPeriod,
  },
  subscription_data: {
    metadata: {
      student_id: user.id,
      pricing_variant: effectiveVariant, // NEW
    },
    trial_period_days: trialDays,
  },
})
```

### Subscription Table Changes (Optional)

**Consider adding pricing_variant tracking:**
```sql
-- Add pricing_variant to justai_subscriptions table
ALTER TABLE justai_subscriptions 
ADD COLUMN pricing_variant TEXT DEFAULT 'control';

-- Backfill from Stripe metadata via webhook
-- This will be populated by the webhook handler
```

This allows you to track which variant a user subscribed under, useful for:
- Cohort analysis
- Retention tracking by variant
- Revenue attribution

### Stripe Setup

#### Required Actions:
1. **Create Stripe Price IDs for each variant:**
   - Each pricing variant needs its own Stripe Price object
   - Link to existing Products or create variant-specific products
   - Use descriptive metadata: `pricing_variant: plan-a`

2. **Example Stripe Price Creation:**
```bash
# Basic Monthly - Plan A (9.99)
stripe prices create \
  --product prod_TXQxcVGTaRpqLG \
  --unit-amount 999 \
  --currency usd \
  --recurring[interval]=month \
  --metadata[pricing_variant]=plan-a \
  --metadata[plan_type]=basic

# Premium Monthly - Plan A (19.99)
stripe prices create \
  --product prod_TXQyGwfstY2Hf5 \
  --unit-amount 1999 \
  --currency usd \
  --recurring[interval]=month \
  --metadata[pricing_variant]=plan-a \
  --metadata[plan_type]=premium
```

3. **Update justai_subscription_plans with new Price IDs**

### Testing Plan

#### Phase 1: Database Setup
- [ ] Run migration to add `pricing_variant` column
- [ ] Verify existing plans are set to 'control'
- [ ] Create plan-a and plan-b variants with test Stripe prices

#### Phase 2: Frontend Testing
- [ ] Test URL with no variant → should default to 'control'
- [ ] Test URL with `pricing_variant=plan-a` → should show plan-a prices
- [ ] Test URL with `pricing_variant=plan-b` → should show plan-b prices
- [ ] Test URL with invalid variant → should default to 'control'
- [ ] Test switching between billing cycles preserves variant
- [ ] Verify correct Stripe price IDs are used per variant

#### Phase 3: Checkout Flow
- [ ] Test checkout with each variant
- [ ] Verify Stripe session has correct metadata
- [ ] Verify webhook creates subscription with correct pricing_variant
- [ ] Test trial period works with all variants

#### Phase 4: Analytics
- [ ] Verify PostHog tracks pricing_variant views
- [ ] Verify PostHog tracks plan selections per variant
- [ ] Verify checkout completions are attributed to variant

### Rollout Strategy

#### Week 1: Infrastructure
1. Create Stripe price objects for all variants
2. Run database migration
3. Populate database with variant records
4. Deploy edge function changes

#### Week 2: Frontend
1. Deploy frontend changes
2. Test with internal links
3. Verify analytics tracking

#### Week 3: Testing
1. Run A/B test with small percentage (5-10%)
2. Monitor conversion rates
3. Check for any errors in logs

#### Week 4: Scaling
1. Increase traffic to variants
2. Analyze results
3. Determine winning variant

### Monitoring & Analytics

#### Key Metrics to Track:
1. **View Rate:** Users who see each variant
2. **Selection Rate:** Plans selected per variant
3. **Conversion Rate:** Checkouts completed per variant
4. **Revenue:** Total and per variant
5. **Error Rate:** Any checkout failures per variant

#### PostHog Events:
```typescript
// Already implemented
- 'subscription_plan_viewed'
- 'plan_selected'
- 'checkout_started'

// New
- 'pricing_variant_viewed' {
    pricing_variant: string,
    billing_cycle: string,
    timestamp: string
  }
```

### Alternative Approaches Considered

#### ❌ Single Record with JSONB Prices
**Pros:** Fewer database records
**Cons:** 
- Complex queries
- Can't have multiple Stripe price IDs in one field
- Hard to maintain
- Difficult to toggle variants on/off

#### ❌ Frontend-Only Price Override
**Pros:** No database changes
**Cons:**
- Stripe price IDs must still match
- Risk of price/ID mismatch
- Can't track which variant in database
- Poor data integrity

#### ✅ Multiple Records with pricing_variant Column (RECOMMENDED)
**Pros:**
- Clean, simple queries
- Each variant has dedicated Stripe price ID
- Easy to enable/disable variants
- Clear audit trail
- Supports complex variant differences (not just price)
- Can have variant-specific features, descriptions, limits

**Cons:**
- More database records (minimal issue)
- Need to keep variants in sync (manageable with scripts)

## Files to Modify

### Database
- [ ] Create migration: `supabase/migrations/YYYYMMDD_add_pricing_variant.sql`

### Frontend
- [ ] [ai-chat-app/src/lib/justai-types.ts](ai-chat-app/src/lib/justai-types.ts) - Add pricing_variant type
- [ ] [ai-chat-app/src/pages/SubscriptionPlans.tsx](ai-chat-app/src/pages/SubscriptionPlans.tsx) - Main implementation
- [ ] [ai-chat-app/src/lib/posthog.ts](ai-chat-app/src/lib/posthog.ts) - Add tracking function (if exists)

### Backend
- [ ] [edge-functions/create-checkout-session.ts](edge-functions/create-checkout-session.ts) - Accept and validate variant

### Documentation
- [ ] Update README with pricing variant documentation
- [ ] Document Stripe setup process
- [ ] Add testing instructions

## Risks & Mitigations

### Risk 1: Price/Stripe ID Mismatch
**Mitigation:** 
- Validate price IDs in edge function
- Add database constraints
- Automated tests to verify price consistency

### Risk 2: Users Switch Variants Mid-Session
**Mitigation:**
- Track variant in session/localStorage
- Log variant switches for analysis
- Show clear pricing on checkout page

### Risk 3: Analytics Data Quality
**Mitigation:**
- Validate variant parameters
- Default to 'control' for invalid values
- Add comprehensive logging
- Use PostHog session recording

### Risk 4: Stripe Webhook Compatibility
**Mitigation:**
- Ensure metadata is preserved
- Test webhook with all variants
- Add fallback to 'control' if variant missing

## Success Criteria

1. ✅ Users see correct prices based on URL parameter
2. ✅ Checkouts complete with correct Stripe prices
3. ✅ Analytics accurately track variant performance
4. ✅ Zero increase in checkout errors
5. ✅ Easy to add new variants in future
6. ✅ Clear winner emerges from A/B test data

## Future Enhancements

1. **Dynamic Variant Loading:** Load variants from database config table
2. **Feature Variants:** Different features, not just prices
3. **Geographic Pricing:** Combine with geo-based variants
4. **Time-Limited Offers:** Expire variants automatically
5. **User Segment Variants:** Different pricing for different user segments
6. **Gradual Rollout:** Control variant visibility percentages in database

## Notes

- The `plan` parameter in URL is currently not used but could be used to pre-select a plan
- Trial period experiment (via PostHog) is independent and should continue working
- Weekly plan visibility is controlled by separate feature flag
- Layout variant (vertical/horizontal) is also independent
- All existing functionality must continue working with 'control' variant as default
