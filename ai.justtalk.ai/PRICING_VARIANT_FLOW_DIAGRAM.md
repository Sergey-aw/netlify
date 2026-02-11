# Pricing Variant Implementation Flow

## Complete User Journey with Pricing Variants

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          MARKETING CAMPAIGN                              │
│  Different landing pages send users with different pricing_variant       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
        ┌──────────────────┬──────────────────┬──────────────────┐
        │   Control Group  │    Plan A Test   │    Plan B Test   │
        │                  │                  │                  │
        │  ?pricing_       │  ?pricing_       │  ?pricing_       │
        │   variant=       │   variant=       │   variant=       │
        │   control        │   plan-a         │   plan-b         │
        │                  │                  │                  │
        │  $19.99/mo       │  $9.99/mo        │  $14.99/mo       │
        │  $149.99/yr      │  $99.99/yr       │  $149.99/yr      │
        └──────────────────┴──────────────────┴──────────────────┘
                                    │
                                    ▼
        ┌─────────────────────────────────────────────────────────┐
        │         USER LANDS ON SUBSCRIPTION PLANS PAGE           │
        │      https://chat.justtalk.ai/subscription-plans        │
        │             ?pricing_variant=[control|plan-a|plan-b]    │
        └─────────────────────────────────────────────────────────┘
                                    │
                                    ▼
        ┌─────────────────────────────────────────────────────────┐
        │              FRONTEND (SubscriptionPlans.tsx)           │
        │  1. Extract pricing_variant from URL                    │
        │  2. Validate: ['control', 'plan-a', 'plan-b']          │
        │  3. Default to 'control' if invalid                     │
        │  4. Track view event in PostHog                         │
        └─────────────────────────────────────────────────────────┘
                                    │
                                    ▼
        ┌─────────────────────────────────────────────────────────┐
        │               DATABASE QUERY (Supabase)                 │
        │                                                          │
        │  SELECT * FROM justai_subscription_plans                │
        │  WHERE pricing_variant = 'plan-a'                       │
        │    AND billing_period = 'monthly'                       │
        │    AND is_active = true                                 │
        │  ORDER BY display_order;                                │
        └─────────────────────────────────────────────────────────┘
                                    │
                                    ▼
        ┌─────────────────────────────────────────────────────────┐
        │              PLANS RENDERED ON PAGE                     │
        │                                                          │
        │  ┌─────────────────┐    ┌─────────────────┐           │
        │  │  Basic Plan     │    │  Premium Plan   │           │
        │  │  $9.99/month    │    │  $19.99/month   │           │
        │  │  (plan-a price) │    │  (plan-a price) │           │
        │  │                 │    │                 │           │
        │  │  [Select Plan]  │    │  [Select Plan]  │           │
        │  └─────────────────┘    └─────────────────┘           │
        └─────────────────────────────────────────────────────────┘
                                    │
                              User selects plan
                                    │
                                    ▼
        ┌─────────────────────────────────────────────────────────┐
        │            PLAN SELECTED - Track in PostHog             │
        │                                                          │
        │  trackEvent('plan_selected', {                          │
        │    pricing_variant: 'plan-a',                           │
        │    plan_type: 'premium',                                │
        │    billing_period: 'monthly',                           │
        │    price_cents: 1999                                    │
        │  });                                                    │
        └─────────────────────────────────────────────────────────┘
                                    │
                                    ▼
        ┌─────────────────────────────────────────────────────────┐
        │          NAVIGATE TO CHECKOUT WITH PARAMS               │
        │                                                          │
        │  /checkout?priceId=price_xxx_plan_a                     │
        │           &planName=Premium                             │
        │           &planPrice=1999                               │
        │           &billingPeriod=monthly                        │
        │           &pricingVariant=plan-a      ← NEW             │
        └─────────────────────────────────────────────────────────┘
                                    │
                                    ▼
        ┌─────────────────────────────────────────────────────────┐
        │            CHECKOUT PAGE (CheckoutPage.tsx)             │
        │  - Displays selected plan details                       │
        │  - Shows price from plan-a variant                      │
        │  - Calls create-checkout-session edge function          │
        └─────────────────────────────────────────────────────────┘
                                    │
                                    ▼
        ┌─────────────────────────────────────────────────────────┐
        │      EDGE FUNCTION (create-checkout-session.ts)         │
        │                                                          │
        │  1. Receive pricingVariant parameter                    │
        │  2. Validate variant                                    │
        │  3. Create Stripe checkout session with:                │
        │     - price_xxx_plan_a (Stripe Price ID)               │
        │     - metadata: { pricing_variant: 'plan-a' }          │
        │     - subscription_data.metadata: { pricing_variant }   │
        └─────────────────────────────────────────────────────────┘
                                    │
                                    ▼
        ┌─────────────────────────────────────────────────────────┐
        │              STRIPE CHECKOUT SESSION                    │
        │                                                          │
        │  User completes payment on Stripe                       │
        │  - Session contains pricing_variant in metadata         │
        │  - Subscription created with correct price              │
        └─────────────────────────────────────────────────────────┘
                                    │
                                    ▼
        ┌─────────────────────────────────────────────────────────┐
        │              STRIPE WEBHOOK FIRES                       │
        │                                                          │
        │  Event: checkout.session.completed                      │
        │  - Extract pricing_variant from metadata                │
        │  - Create subscription record in DB                     │
        │  - Store pricing_variant for analytics                  │
        └─────────────────────────────────────────────────────────┘
                                    │
                                    ▼
        ┌─────────────────────────────────────────────────────────┐
        │          SUBSCRIPTION CREATED IN DATABASE               │
        │                                                          │
        │  justai_subscriptions table:                            │
        │  - student_id                                           │
        │  - plan_id (points to plan-a variant record)           │
        │  - pricing_variant: 'plan-a'                           │
        │  - stripe_subscription_id                               │
        │  - status: 'active'                                     │
        └─────────────────────────────────────────────────────────┘
                                    │
                                    ▼
        ┌─────────────────────────────────────────────────────────┐
        │          USER REDIRECTED TO SUCCESS PAGE                │
        │                                                          │
        │  /subscription-status?session_id=xxx                    │
        │  - Shows subscription details                           │
        │  - Track conversion in PostHog                          │
        └─────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

```
┌──────────────┐
│   URL Param  │  pricing_variant=plan-a
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│  Frontend Validation & Query Construction                │
│                                                           │
│  const effectiveVariant =                                │
│    validVariants.includes(urlVariant)                    │
│      ? urlVariant                                        │
│      : 'control';                                        │
│                                                           │
│  queryKey: ['plans', 'monthly', effectiveVariant]       │
└──────┬───────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│  Supabase Query                                          │
│                                                           │
│  .from('justai_subscription_plans')                      │
│  .select('*')                                            │
│  .eq('pricing_variant', effectiveVariant)    ◄── Filter │
│  .eq('billing_period', billingCycle)                     │
│  .eq('is_active', true)                                  │
│  .order('display_order')                                 │
└──────┬───────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│  Database Response                                       │
│                                                           │
│  [                                                       │
│    {                                                     │
│      id: 'uuid-1',                                      │
│      plan_type: 'basic',                                │
│      pricing_variant: 'plan-a',                         │
│      price_cents: 999,                 ◄── plan-a price │
│      stripe_price_id: 'price_xxx_plan_a'  ◄── plan-a ID│
│    },                                                    │
│    {                                                     │
│      id: 'uuid-2',                                      │
│      plan_type: 'premium',                              │
│      pricing_variant: 'plan-a',                         │
│      price_cents: 1999,                ◄── plan-a price │
│      stripe_price_id: 'price_yyy_plan_a'  ◄── plan-a ID│
│    }                                                     │
│  ]                                                       │
└──────┬───────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│  React Component Renders                                 │
│                                                           │
│  plans.map(plan => (                                     │
│    <PlanCard                                             │
│      price={plan.price_cents / 100}    ◄── $9.99        │
│      stripePriceId={plan.stripe_price_id}               │
│      pricingVariant={plan.pricing_variant}              │
│    />                                                    │
│  ))                                                      │
└──────┬───────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│  User Sees UI                                            │
│                                                           │
│  💳 Basic Plan           💎 Premium Plan                │
│     $9.99/month             $19.99/month                 │
│     [Select]                [Select]                     │
└──────────────────────────────────────────────────────────┘
```

---

## State Management Flow

```
┌────────────────────────────────────────────────────────────┐
│           Component State (SubscriptionPlans.tsx)          │
└────────────────────────────────────────────────────────────┘

On Mount:
  ┌─────────────────────────────────────────┐
  │ 1. Parse URL Parameters                 │
  │    const [searchParams] =               │
  │      useSearchParams()                  │
  │                                         │
  │    const urlVariant =                   │
  │      searchParams.get('pricing_variant')│
  └────────────┬────────────────────────────┘
               │
               ▼
  ┌─────────────────────────────────────────┐
  │ 2. Validate Variant                     │
  │    const validVariants =                │
  │      ['control', 'plan-a', 'plan-b']   │
  │                                         │
  │    const effectiveVariant =             │
  │      validVariants.includes(urlVariant) │
  │        ? urlVariant                     │
  │        : 'control'                      │
  └────────────┬────────────────────────────┘
               │
               ▼
  ┌─────────────────────────────────────────┐
  │ 3. Store in Component State             │
  │    const [pricingVariant, setVariant] = │
  │      useState(effectiveVariant)         │
  └────────────┬────────────────────────────┘
               │
               ▼
  ┌─────────────────────────────────────────┐
  │ 4. Trigger Data Fetch                   │
  │    useQuery({                           │
  │      queryKey: [                        │
  │        'plans',                         │
  │        billingCycle,                    │
  │        pricingVariant  ◄── dependency   │
  │      ],                                 │
  │      queryFn: fetchPlans                │
  │    })                                   │
  └────────────┬────────────────────────────┘
               │
               ▼
  ┌─────────────────────────────────────────┐
  │ 5. Track View Event                     │
  │    useEffect(() => {                    │
  │      trackEvent('pricing_variant_viewed'│
  │        { variant: pricingVariant })     │
  │    }, [pricingVariant])                 │
  └─────────────────────────────────────────┘

On Billing Cycle Change:
  ┌─────────────────────────────────────────┐
  │ User clicks "Monthly" or "Annual"       │
  │   → setBillingCycle('monthly')          │
  │   → pricingVariant stays same           │
  │   → Query re-runs with new cycle        │
  │   → Fetches monthly plans for variant   │
  └─────────────────────────────────────────┘

On Plan Selection:
  ┌─────────────────────────────────────────┐
  │ User clicks "Select Plan" button        │
  │   → handleSubscribe(plan)               │
  │   → Track selection with variant        │
  │   → Navigate to checkout with variant   │
  └─────────────────────────────────────────┘
```

---

## React Query Cache Structure

```
Query Cache:
{
  ['subscription-plans', 'monthly', 'control']: {
    data: [{ id: '...', price_cents: 1999, ... }],
    status: 'success',
    fetchedAt: timestamp
  },
  
  ['subscription-plans', 'monthly', 'plan-a']: {
    data: [{ id: '...', price_cents: 999, ... }],
    status: 'success',
    fetchedAt: timestamp
  },
  
  ['subscription-plans', 'monthly', 'plan-b']: {
    data: [{ id: '...', price_cents: 1499, ... }],
    status: 'success',
    fetchedAt: timestamp
  },
  
  ['subscription-plans', 'annual', 'control']: {
    data: [{ id: '...', price_cents: 14999, ... }],
    status: 'success',
    fetchedAt: timestamp
  },
  
  // ... etc for each combination
}

Benefits:
✅ Cached per variant - fast switching
✅ Automatic revalidation
✅ Stale-while-revalidate pattern
✅ No redundant fetches
```

---

## PostHog Event Tracking Flow

```
Page Load:
  pricing_variant_viewed
  ├─ pricing_variant: 'plan-a'
  ├─ billing_cycle: 'monthly'
  ├─ user_id: 'uuid'
  ├─ is_anonymous: false
  └─ timestamp: '2026-02-06T...'

Plan Selection:
  plan_selected
  ├─ pricing_variant: 'plan-a'
  ├─ plan_type: 'premium'
  ├─ billing_period: 'monthly'
  ├─ price_cents: 1999
  └─ plan_name: 'Premium'

Checkout Started:
  checkout_started
  ├─ pricing_variant: 'plan-a'
  ├─ plan_type: 'premium'
  ├─ billing_period: 'monthly'
  ├─ price_cents: 1999
  ├─ stripe_price_id: 'price_yyy_plan_a'
  └─ trial_days: 0

Checkout Completed:
  checkout_completed
  ├─ pricing_variant: 'plan-a'
  ├─ plan_type: 'premium'
  ├─ subscription_id: 'sub_xxx'
  └─ revenue: 19.99

Subscription Created:
  subscription_created
  ├─ pricing_variant: 'plan-a'
  ├─ plan_type: 'premium'
  ├─ billing_period: 'monthly'
  └─ subscription_id: 'sub_xxx'
```

### PostHog Funnel Analysis

```
Pricing Variant Funnel:
┌─────────────────────────────────────────────────┐
│  Control Variant                                │
├─────────────────────────────────────────────────┤
│  1. View Paywall         │ 1000 users   100%   │
│  2. Select Plan          │  300 users    30%   │
│  3. Start Checkout       │  250 users    25%   │
│  4. Complete Purchase    │  200 users    20%   │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  Plan-A Variant (50% discount)                  │
├─────────────────────────────────────────────────┤
│  1. View Paywall         │ 1000 users   100%   │
│  2. Select Plan          │  500 users    50%   │
│  3. Start Checkout       │  450 users    45%   │
│  4. Complete Purchase    │  400 users    40%   │
└─────────────────────────────────────────────────┘

Result: Plan-A has 2x conversion rate! 🎉
But: 50% less revenue per user
Net: (400 users × $9.99) vs (200 users × $19.99)
     = $3,996 vs $3,998 → Almost equal revenue
```

---

## Error Handling Flow

```
┌─────────────────────────────────────────────────┐
│  Invalid Variant in URL                         │
│  ?pricing_variant=invalid-xyz                   │
└──────────────┬──────────────────────────────────┘
               │
               ▼
   ┌───────────────────────────┐
   │  Validation Check         │
   │  validVariants.includes() │
   └───────────┬───────────────┘
               │ false
               ▼
   ┌───────────────────────────┐
   │  Default to 'control'     │
   │  effectiveVariant =       │
   │    'control'              │
   └───────────┬───────────────┘
               │
               ▼
   ┌───────────────────────────┐
   │  Log Warning              │
   │  console.warn()           │
   └───────────┬───────────────┘
               │
               ▼
   ┌───────────────────────────┐
   │  Continue with control    │
   │  User sees control prices │
   └───────────────────────────┘


┌─────────────────────────────────────────────────┐
│  No Plans Found for Variant                     │
│  (Database query returns empty)                 │
└──────────────┬──────────────────────────────────┘
               │
               ▼
   ┌───────────────────────────┐
   │  Query Error Handler      │
   │  if (!data || !data.length│
   └───────────┬───────────────┘
               │
               ▼
   ┌───────────────────────────┐
   │  Fallback to control      │
   │  Re-query with 'control'  │
   └───────────┬───────────────┘
               │
               ▼
   ┌───────────────────────────┐
   │  Show control plans       │
   │  + Error toast            │
   └───────────────────────────┘


┌─────────────────────────────────────────────────┐
│  Variant Inactive (is_active = false)           │
└──────────────┬──────────────────────────────────┘
               │
               ▼
   ┌───────────────────────────┐
   │  Database filters out     │
   │  WHERE is_active = true   │
   └───────────┬───────────────┘
               │
               ▼
   ┌───────────────────────────┐
   │  Returns empty result     │
   │  Same as "No Plans" flow  │
   └───────────────────────────┘
```

---

## Testing Scenarios

### Scenario 1: Normal Flow
```
Input:  ?pricing_variant=plan-a
Step 1: Extract → 'plan-a'
Step 2: Validate → valid ✓
Step 3: Query DB → success ✓
Step 4: Render → $9.99 plans ✓
Result: ✅ Success
```

### Scenario 2: Invalid Variant
```
Input:  ?pricing_variant=xyz
Step 1: Extract → 'xyz'
Step 2: Validate → invalid ✗
Step 3: Fallback → 'control'
Step 4: Query DB → success ✓
Step 5: Render → $19.99 plans ✓
Result: ✅ Fallback works
```

### Scenario 3: Missing Variant
```
Input:  (no parameter)
Step 1: Extract → null
Step 2: Default → 'control'
Step 3: Query DB → success ✓
Step 4: Render → $19.99 plans ✓
Result: ✅ Default works
```

### Scenario 4: Variant Toggle
```
Start:  User on plan-a
Action: User changes cycle monthly → annual
Step 1: billingCycle changes
Step 2: pricingVariant stays 'plan-a'
Step 3: Re-query with ('annual', 'plan-a')
Step 4: Render → $99.99 annual plan-a ✓
Result: ✅ Variant persists across cycles
```

### Scenario 5: Direct Navigation
```
Start:  User types URL directly
Input:  /subscription-plans?pricing_variant=plan-b
Step 1: Component mounts
Step 2: Extract variant → 'plan-b'
Step 3: Validate → valid ✓
Step 4: Fetch & render → $14.99 plans ✓
Result: ✅ Deep linking works
```

---

## Performance Considerations

### Query Optimization
```
WITHOUT INDEX:
  Seq Scan on justai_subscription_plans
  Filter: (pricing_variant = 'plan-a' AND ...)
  Time: ~10ms for 100 rows

WITH INDEX:
  Index Scan using idx_subscription_plans_variant
  Index Cond: (pricing_variant = 'plan-a' AND ...)
  Time: ~0.5ms for 100 rows

Improvement: 20x faster ⚡
```

### Caching Strategy
```
React Query Cache:
  - staleTime: 5 minutes
  - cacheTime: 30 minutes
  - refetchOnWindowFocus: true
  - refetchOnReconnect: true

Result:
  ✅ Instant switching between cached variants
  ✅ Automatic background refresh
  ✅ Offline support with cached data
```

### Bundle Size Impact
```
Code additions:
  - Variant validation: ~50 bytes
  - Query parameter logic: ~100 bytes
  - Additional type definitions: ~50 bytes
  
Total impact: ~200 bytes (negligible)
```

---

## Rollout Timeline

```
Week 1: Infrastructure Setup
├─ Day 1-2: Create Stripe price IDs
├─ Day 3-4: Database migration
├─ Day 5: Populate variant data
└─ Day 6-7: Deploy edge function changes

Week 2: Frontend Development
├─ Day 1-2: Implement URL parsing
├─ Day 3-4: Update queries & types
├─ Day 5: Add analytics tracking
└─ Day 6-7: Testing & bug fixes

Week 3: Testing & Soft Launch
├─ Day 1-2: Internal testing
├─ Day 3-4: QA on staging
├─ Day 5-6: Deploy to 5% of traffic
└─ Day 7: Monitor metrics

Week 4: Full Rollout
├─ Day 1-2: Increase to 25% traffic
├─ Day 3-4: Increase to 50% traffic
├─ Day 5-6: Full rollout
└─ Day 7: Analysis & optimization
```

---

## Success Metrics Dashboard

```
┌──────────────────────────────────────────────────────┐
│  Pricing Variant Performance Dashboard               │
├──────────────────────────────────────────────────────┤
│                                                       │
│  Variant   │ Views │ Selections │ Conversions │ Rev  │
│  ─────────────────────────────────────────────────── │
│  Control   │ 1000  │ 300 (30%) │ 200 (20%)  │ $4000│
│  Plan-A    │ 1000  │ 500 (50%) │ 400 (40%)  │ $4000│
│  Plan-B    │ 1000  │ 400 (40%) │ 300 (30%)  │ $4500│
│                                                       │
│  Winner: Plan-B (highest conversion × revenue) 🏆    │
└──────────────────────────────────────────────────────┘

Statistical Significance:
  ✅ Sample size: 3000+ users
  ✅ Duration: 4+ weeks
  ✅ P-value: <0.05
  
Decision: Deploy Plan-B as new default
```
