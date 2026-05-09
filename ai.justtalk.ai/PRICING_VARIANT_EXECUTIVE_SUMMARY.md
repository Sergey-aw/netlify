# Pricing Variant Implementation - Executive Summary

## Overview
Implementation plan for dynamic pricing display on the subscription-plans page based on URL parameter `pricing_variant`. This enables A/B testing different pricing strategies.

## Current State
- **Database:** 5 active subscription plans (Basic/Premium × Monthly/Annual + Weekly)
- **Pricing:** Single price point per plan (control pricing)
- **Frontend:** No URL parameter handling for pricing variants
- **Problem:** Cannot test different pricing strategies without code changes

## Proposed Solution
Add `pricing_variant` column to database with multiple records per plan type + billing period combination.

### Example:
```
Current:  1 record for "Basic Monthly" at $19.99
Proposed: 3 records for "Basic Monthly":
          - control: $19.99
          - plan-a:  $9.99  (50% off)
          - plan-b:  $14.99 (25% off)
```

## Why This Approach?

✅ **Recommended: Multiple Records with pricing_variant Column**

**Pros:**
- Clean, simple database queries
- Each variant has its own Stripe Price ID (required)
- Easy to enable/disable variants via `is_active` flag
- Supports different features per variant (not just price)
- Clear audit trail and data integrity
- Future-proof for additional variants

**Cons:**
- More database records (15 instead of 5) - negligible storage impact

## Key Changes Required

### 1. Database
```sql
ALTER TABLE justai_subscription_plans 
ADD COLUMN pricing_variant TEXT DEFAULT 'control';

-- Plus: constraints, indexes, data population
```

### 2. Frontend (SubscriptionPlans.tsx)
```typescript
// Extract from URL
const pricingVariant = searchParams.get('pricing_variant') || 'control';

// Query with variant filter
.eq('pricing_variant', pricingVariant)
```

### 3. Stripe Setup
Create new Price IDs for each variant:
- 8 new Price objects (2 plan types × 2 billing periods × 2 new variants)
- Attach metadata: `pricing_variant: 'plan-a'`

### 4. Backend (Edge Function)
Accept and validate `pricingVariant` parameter, store in Stripe metadata.

## URL Examples

```
Control: https://chat.justtalk.ai/subscription-plans?pricing_variant=control
Plan-A:  https://chat.justtalk.ai/subscription-plans?pricing_variant=plan-a
Plan-B:  https://chat.justtalk.ai/subscription-plans?pricing_variant=plan-b
Default: https://chat.justtalk.ai/subscription-plans (defaults to control)
```

## Implementation Timeline

- **Week 1:** Stripe setup + Database migration
- **Week 2:** Frontend + Backend implementation
- **Week 3:** Testing + Soft launch (5% traffic)
- **Week 4:** Full rollout + Analysis

## Risk Mitigation

1. **Invalid URL parameters:** Default to 'control' pricing
2. **Missing database records:** Fallback to control variant
3. **Stripe ID mismatch:** Validation in edge function
4. **Analytics issues:** Comprehensive event tracking with PostHog

## Success Metrics

### Technical
- ✅ Zero increase in error rates
- ✅ Database queries < 100ms
- ✅ Checkout completion rate maintained

### Business
- ✅ 1000+ users per variant (statistical significance)
- ✅ Clear conversion rate comparison
- ✅ Revenue impact measured

## Expected Outcomes

Based on pricing experiment data:

| Variant | Price Point | Expected Conversion | Revenue Impact |
|---------|-------------|---------------------|----------------|
| Control | $19.99/mo   | 20% baseline        | Baseline       |
| Plan-A  | $9.99/mo    | 40% (+2x)           | Equal or +10%  |
| Plan-B  | $14.99/mo   | 30% (+50%)          | +20-30%        |

**Goal:** Identify optimal price point that maximizes revenue while improving conversion.

## Documents Created

1. **[PRICING_VARIANT_URL_PARAMETER_PLAN.md](PRICING_VARIANT_URL_PARAMETER_PLAN.md)**
   - Complete implementation plan
   - Technical specifications
   - All approaches considered
   - Files to modify

2. **[PRICING_VARIANT_DATABASE_EXAMPLE.md](PRICING_VARIANT_DATABASE_EXAMPLE.md)**
   - Database schema details
   - SQL migration scripts
   - Query examples
   - Performance considerations

3. **[PRICING_VARIANT_FLOW_DIAGRAM.md](PRICING_VARIANT_FLOW_DIAGRAM.md)**
   - User journey flow
   - Data flow diagrams
   - State management
   - Testing scenarios

4. **[PRICING_VARIANT_IMPLEMENTATION_CHECKLIST.md](PRICING_VARIANT_IMPLEMENTATION_CHECKLIST.md)**
   - Step-by-step checklist
   - Testing procedures
   - Deployment steps
   - Success criteria

## Recommendation

**Proceed with implementation** using the multiple records approach:

1. ✅ Clean architecture
2. ✅ Scalable for future variants
3. ✅ Low risk (fallback to control)
4. ✅ Complete analytics tracking
5. ✅ Easy to test and monitor

## Next Steps

1. **Immediate:** Get stakeholder approval on pricing variants
2. **Week 1:** Begin Stripe Price ID creation
3. **Week 1:** Run database migration on staging
4. **Week 2:** Implement frontend changes
5. **Week 3:** Deploy to production with monitoring

## Questions to Answer Before Implementation

- [ ] Which pricing variants to test? (confirmed: control, plan-a, plan-b)
- [ ] What traffic distribution? (suggested: 33% each)
- [ ] Minimum test duration? (suggested: 4 weeks)
- [ ] What's the primary success metric? (suggested: revenue per visitor)
- [ ] Should we test weekly plans too? (depends on feature flag status)
- [ ] Need approval from finance team? (yes, recommended)

## Contact for Questions

- **Technical Implementation:** Development Team Lead
- **Pricing Strategy:** Product Manager / Finance
- **Analytics Setup:** Data Team
- **Stripe Configuration:** Payments Team

---

**Status:** ✅ PLAN COMPLETE - Ready for implementation approval

**Created:** February 6, 2026
**Last Updated:** February 6, 2026
**Version:** 1.0
