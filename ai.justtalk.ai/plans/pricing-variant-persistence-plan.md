# Pricing Variant Persistence Plan

## Problem Statement

The landing page sends users to `chat.justtalk.ai/?plan=basic&pricing_variant=${pricingVariant}&ref=justtalk.ai`, but by the time users navigate through onboarding to reach `/subscription/plans`, the URL parameters are lost. This causes users to see incorrect pricing variants.

## Current Flow

```mermaid
Landing Page --> /welcome --> /onboarding/pronunciation --> /login --> /onboarding/* --> /subscription/plans
     |                                                                                           |
     v                                                                                           v
URL params available                                                                    URL params LOST
```

## Solution: Store pricing_variant in localStorage

### Implementation Steps

#### 1. Add utility functions to `onboarding-state.ts`

Add functions to store and retrieve pricing variant:

```typescript
// Storage key for pricing variant
const PRICING_VARIANT_KEY = 'justai_pricing_variant';

// Valid pricing variants
type PricingVariant = 'control' | 'plan-a' | 'plan-b';

// Store pricing variant from landing page
export function savePricingVariant(variant: PricingVariant): void;

// Retrieve stored pricing variant
export function getPricingVariant(): PricingVariant | null;

// Clear pricing variant after subscription
export function clearPricingVariant(): void;
```

#### 2. Update `WelcomeProgress.tsx` to capture URL params

On the welcome page - the first page users land on - capture and store the pricing_variant:

```typescript
// In WelcomeProgress.tsx
import { useSearchParams } from 'react-router-dom';
import { savePricingVariant } from '@/lib/onboarding-state';

// On component mount
const [searchParams] = useSearchParams();

useEffect(() => {
  const pricingVariant = searchParams.get('pricing_variant');
  const refParam = searchParams.get('ref');
  
  // Store pricing variant if present in URL
  if (pricingVariant && isValidPricingVariant(pricingVariant)) {
    savePricingVariant(pricingVariant);
    console.log('[WelcomeProgress] Stored pricing variant:', pricingVariant);
  }
}, []);
```

#### 3. Update `SubscriptionPlans.tsx` to check localStorage

Modify the pricing variant resolution to include localStorage as a priority source:

```typescript
// Priority order for pricing variant resolution:
// 1. URL ref parameter (highest - for direct links)
// 2. localStorage (from landing page)
// 3. PostHog feature flag (for organic traffic)
// 4. Default 'control'

const getEffectivePricingVariant = (): PricingVariant => {
  // Priority 1: URL ref parameter
  if (isValidPricingVariant(refParam)) {
    return refParam;
  }
  
  // Priority 2: localStorage (from landing page)
  const storedVariant = getPricingVariant();
  if (storedVariant) {
    console.log('[Pricing Variant] Using stored variant:', storedVariant);
    return storedVariant;
  }
  
  // Priority 3: PostHog feature flag
  if (posthogPricingVariant && isValidPricingVariant(posthogPricingVariant)) {
    return posthogPricingVariant as PricingVariant;
  }
  
  // Priority 4: Default
  return 'control';
};
```

#### 4. Clear pricing variant after subscription

In the subscription success handler, clear the stored variant:

```typescript
// After successful subscription
clearPricingVariant();
```

## Files to Modify

1. **`ai-chat-app/src/lib/onboarding-state.ts`**
   - Add `savePricingVariant()`
   - Add `getPricingVariant()`
   - Add `clearPricingVariant()`

2. **`ai-chat-app/src/pages/onboarding/WelcomeProgress.tsx`**
   - Capture `pricing_variant` and `ref` from URL params
   - Store in localStorage using the new utility functions

3. **`ai-chat-app/src/pages/SubscriptionPlans.tsx`**
   - Update `getEffectivePricingVariant()` to check localStorage
   - Add localStorage as priority source between URL and PostHog

## Testing Checklist

- [ ] Landing page link with `pricing_variant=plan-a` stores variant
- [ ] Navigating through onboarding preserves variant
- [ ] SubscriptionPlans page retrieves stored variant
- [ ] PostHog fallback still works for organic traffic
- [ ] Variant is cleared after successful subscription
- [ ] Upgrade page shows correct variant plans

## Edge Cases

1. **User refreshes page mid-onboarding**: localStorage persists
2. **User returns after 7 days**: Variant still valid (no expiration needed)
3. **Multiple tabs**: Each tab has access to the same localStorage
4. **User clears browser data**: Falls back to PostHog/default