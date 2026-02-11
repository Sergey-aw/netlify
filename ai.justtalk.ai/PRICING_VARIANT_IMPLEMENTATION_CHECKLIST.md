# Pricing Variant Implementation Checklist

## Pre-Implementation Checklist

### Planning & Design
- [x] Define pricing variants (control, plan-a, plan-b)
- [x] Map out pricing for each variant
- [x] Design database schema with pricing_variant column
- [x] Plan URL parameter structure
- [x] Document implementation approach
- [ ] Get stakeholder approval on pricing
- [ ] Define success metrics and KPIs

### Stripe Setup Requirements
- [ ] Identify existing Stripe Products to reuse
- [ ] Document current Stripe Price IDs (control variant)
- [ ] Plan new Stripe Price ID naming convention
- [ ] Prepare Stripe CLI or Dashboard access

---

## Implementation Checklist

### Phase 1: Stripe Configuration (Week 1)

#### Create Stripe Price Objects
- [ ] Create Basic Monthly Plan-A ($9.99)
  - Product: `prod_TXQxcVGTaRpqLG`
  - Price: `$9.99/month`
  - Metadata: `pricing_variant=plan-a`
  
- [ ] Create Basic Monthly Plan-B ($14.99)
  - Product: `prod_TXQxcVGTaRpqLG`
  - Price: `$14.99/month`
  - Metadata: `pricing_variant=plan-b`

- [ ] Create Basic Annual Plan-A ($99.99)
  - Product: `prod_TXQxcVGTaRpqLG`
  - Price: `$99.99/year`
  - Metadata: `pricing_variant=plan-a`

- [ ] Create Basic Annual Plan-B ($149.99)
  - Product: `prod_TXQxcVGTaRpqLG`
  - Price: `$149.99/year`
  - Metadata: `pricing_variant=plan-b`

- [ ] Create Premium Monthly Plan-A ($19.99)
  - Product: `prod_TXQyGwfstY2Hf5`
  - Price: `$19.99/month`
  - Metadata: `pricing_variant=plan-a`

- [ ] Create Premium Monthly Plan-B ($24.99)
  - Product: `prod_TXQyGwfstY2Hf5`
  - Price: `$24.99/month`
  - Metadata: `pricing_variant=plan-b`

- [ ] Create Premium Annual Plan-A ($149.99)
  - Product: `prod_TXQyGwfstY2Hf5`
  - Price: `$149.99/year`
  - Metadata: `pricing_variant=plan-a`

- [ ] Create Premium Annual Plan-B ($249.99)
  - Product: `prod_TXQyGwfstY2Hf5`
  - Price: `$249.99/year`
  - Metadata: `pricing_variant=plan-b`

#### Document Stripe Price IDs
```
Create file: STRIPE_PRICE_IDS.md

Control:
- basic_monthly_control: price_1SlTYfDRBhjHHfgo7UkipEHo
- basic_annual_control: price_1SaM65DRBhjHHfgo9WgDcE5a
- premium_monthly_control: price_1SlTmjDRBhjHHfgoi80E2DuM
- premium_annual_control: price_1SaM67DRBhjHHfgo1mwD3Pi2

Plan-A:
- basic_monthly_plan_a: price_xxxxxxxxxxxxxxxxxxxxx
- basic_annual_plan_a: price_xxxxxxxxxxxxxxxxxxxxx
- premium_monthly_plan_a: price_xxxxxxxxxxxxxxxxxxxxx
- premium_annual_plan_a: price_xxxxxxxxxxxxxxxxxxxxx

Plan-B:
- basic_monthly_plan_b: price_xxxxxxxxxxxxxxxxxxxxx
- basic_annual_plan_b: price_xxxxxxxxxxxxxxxxxxxxx
- premium_monthly_plan_b: price_xxxxxxxxxxxxxxxxxxxxx
- premium_annual_plan_b: price_xxxxxxxxxxxxxxxxxxxxx
```

- [ ] Document all new Stripe Price IDs
- [ ] Verify Price IDs are correct in Stripe Dashboard
- [ ] Test sample checkout with each Price ID

---

### Phase 2: Database Changes (Week 1)

#### Create Migration File
- [ ] Create: `supabase/migrations/20260206_add_pricing_variant.sql`

#### Migration Content
- [ ] Add `pricing_variant` column with DEFAULT 'control'
- [ ] Backfill existing records with 'control'
- [ ] Make column NOT NULL
- [ ] Add CHECK constraint for valid variants
- [ ] Add composite index: `idx_subscription_plans_variant`
- [ ] Update unique constraint to include pricing_variant
- [ ] Test migration on local database

#### Run Migration
- [ ] Run migration locally: `supabase db reset`
- [ ] Verify schema changes: `SELECT * FROM information_schema.columns WHERE table_name='justai_subscription_plans'`
- [ ] Check existing data: `SELECT plan_type, billing_period, pricing_variant FROM justai_subscription_plans`
- [ ] Run migration on staging: `supabase db push --project-ref staging`
- [ ] Test on staging environment
- [ ] Run migration on production: `supabase db push --project-ref bcsyrxkfeatnbaqlnxgr`
- [ ] Verify production schema

#### Populate Variant Data
- [ ] Create data insertion script: `scripts/populate_pricing_variants.sql`
- [ ] Insert Plan-A variant records (4 plans: basic/premium × monthly/annual)
- [ ] Insert Plan-B variant records (4 plans: basic/premium × monthly/annual)
- [ ] Verify total plan count: `SELECT COUNT(*) FROM justai_subscription_plans` (should be 15)
- [ ] Check each variant: `SELECT pricing_variant, COUNT(*) FROM justai_subscription_plans GROUP BY pricing_variant`
- [ ] Verify Stripe Price IDs are correct
- [ ] Set appropriate `display_order` for each variant
- [ ] Run on production

---

### Phase 3: Backend Changes (Week 1-2)

#### Edge Function: create-checkout-session.ts
- [ ] Add `pricingVariant` to request body type definition
- [ ] Extract `pricingVariant` from request JSON
- [ ] Add validation: `validVariants.includes(pricingVariant)`
- [ ] Default to 'control' if invalid
- [ ] Add to Stripe session metadata: `metadata.pricing_variant`
- [ ] Add to subscription metadata: `subscription_data.metadata.pricing_variant`
- [ ] Add logging for pricing variant
- [ ] Test locally with different variants
- [ ] Deploy to staging: `supabase functions deploy create-checkout-session --project-ref staging`
- [ ] Test on staging
- [ ] Deploy to production: `supabase functions deploy create-checkout-session --project-ref bcsyrxkfeatnbaqlnxgr`

#### Optional: Update Webhook Handler
- [ ] Check if pricing_variant needs to be extracted from Stripe metadata
- [ ] Store pricing_variant in justai_subscriptions if needed
- [ ] Update webhook tests
- [ ] Deploy webhook changes

---

### Phase 4: Frontend Changes (Week 2)

#### Type Definitions
- [ ] File: `ai-chat-app/src/lib/justai-types.ts`
- [ ] Add `pricing_variant` to `SubscriptionPlan` interface
- [ ] Update type: `pricing_variant: 'control' | 'plan-a' | 'plan-b'`
- [ ] Run TypeScript check: `npm run type-check`

#### URL Parameter Extraction
- [ ] File: `ai-chat-app/src/pages/SubscriptionPlans.tsx`
- [ ] After line 22, extract pricing_variant from searchParams
- [ ] Create `validVariants` array
- [ ] Implement validation logic
- [ ] Default to 'control' if invalid
- [ ] Add console.log for debugging
- [ ] Store in state or constant

#### Update Query Functions
- [ ] Update `monthlyPlans` query:
  - Add `effectivePricingVariant` to queryKey
  - Add `.eq('pricing_variant', effectivePricingVariant)` to query
- [ ] Update `annualPlans` query:
  - Add `effectivePricingVariant` to queryKey
  - Add `.eq('pricing_variant', effectivePricingVariant)` to query
- [ ] Update `weeklyPlans` query (if applicable):
  - Add `effectivePricingVariant` to queryKey
  - Add `.eq('pricing_variant', effectivePricingVariant)` to query
- [ ] Test query invalidation on variant change

#### Analytics Tracking
- [ ] Add `pricing_variant_viewed` event tracking
- [ ] Update `plan_selected` event to include pricing_variant
- [ ] Update `checkout_started` event to include pricing_variant
- [ ] Add useEffect hook for tracking variant views
- [ ] Test PostHog events in development

#### Checkout Navigation
- [ ] Update checkout params around line 405
- [ ] Add `pricingVariant: effectivePricingVariant` to URLSearchParams
- [ ] Verify params are passed correctly
- [ ] Test checkout flow

#### Update CheckoutPage (if needed)
- [ ] File: `ai-chat-app/src/pages/CheckoutPage.tsx`
- [ ] Extract `pricingVariant` from URL params
- [ ] Pass to edge function call
- [ ] Display variant info in UI (optional)

---

### Phase 5: Testing (Week 2-3)

#### Unit Tests
- [ ] Test URL parameter extraction with valid variant
- [ ] Test URL parameter extraction with invalid variant
- [ ] Test URL parameter extraction with missing variant
- [ ] Test variant validation logic
- [ ] Test default fallback to 'control'
- [ ] Test query key changes trigger re-fetch

#### Integration Tests
- [ ] Test full flow: URL → Query → Render for control
- [ ] Test full flow: URL → Query → Render for plan-a
- [ ] Test full flow: URL → Query → Render for plan-b
- [ ] Test switching billing cycles preserves variant
- [ ] Test direct navigation with variant parameter
- [ ] Test plan selection with each variant
- [ ] Test checkout flow for each variant
- [ ] Test Stripe session creation with correct Price ID
- [ ] Test metadata is set correctly in Stripe

#### Manual Testing Scenarios
- [ ] Test URL: `/?pricing_variant=control` → See $19.99, $37.99
- [ ] Test URL: `/?pricing_variant=plan-a` → See $9.99, $19.99
- [ ] Test URL: `/?pricing_variant=plan-b` → See $14.99, $24.99
- [ ] Test URL: `/?pricing_variant=invalid` → See $19.99, $37.99 (fallback)
- [ ] Test URL: `/subscription-plans` → See $19.99, $37.99 (default)
- [ ] Test cycle switch: Monthly → Annual preserves variant
- [ ] Test plan selection → Correct Price ID in checkout
- [ ] Test complete purchase → Subscription created with variant

#### Edge Cases
- [ ] Test with anonymous user
- [ ] Test with authenticated user
- [ ] Test with trial period enabled
- [ ] Test with weekly plan feature flag on
- [ ] Test with vertical layout variant
- [ ] Test multiple browser tabs with different variants
- [ ] Test browser back/forward with variant URLs

#### Analytics Verification
- [ ] Check PostHog: `pricing_variant_viewed` events are tracked
- [ ] Check PostHog: `plan_selected` includes pricing_variant
- [ ] Check PostHog: `checkout_started` includes pricing_variant
- [ ] Check PostHog: Events have correct variant values
- [ ] Set up PostHog dashboard for variant comparison
- [ ] Set up funnel analysis per variant

---

### Phase 6: Deployment (Week 3)

#### Staging Deployment
- [ ] Deploy frontend to staging: `npm run build && vercel --staging`
- [ ] Test on staging URL with all variants
- [ ] Verify database queries work correctly
- [ ] Check Stripe test mode checkouts
- [ ] Monitor logs for errors
- [ ] Get QA team approval

#### Production Deployment
- [ ] Create deployment plan document
- [ ] Schedule deployment during low-traffic period
- [ ] Deploy frontend to production: `npm run build && vercel --prod`
- [ ] Monitor deployment logs
- [ ] Test production URL immediately after deploy
- [ ] Check error monitoring (Sentry/etc)
- [ ] Monitor Supabase query performance
- [ ] Monitor Stripe dashboard for checkouts

#### Rollback Plan
- [ ] Document rollback procedure
- [ ] Test rollback on staging first
- [ ] Keep previous deployment version accessible
- [ ] If issues: Set all non-control variants `is_active=false`
- [ ] Alternative: Redeploy previous frontend version

---

### Phase 7: Monitoring & Optimization (Week 3-4)

#### Initial Monitoring (First 48 hours)
- [ ] Monitor error rates (should not increase)
- [ ] Check database query performance
- [ ] Verify Stripe checkout completions
- [ ] Check PostHog event tracking
- [ ] Monitor user feedback/support tickets
- [ ] Review server logs for pricing_variant errors

#### A/B Test Setup
- [ ] Create PostHog experiment for pricing variants
- [ ] Set traffic distribution (e.g., 33% each variant)
- [ ] Define primary success metric (conversion rate)
- [ ] Define secondary metrics (revenue, selection rate)
- [ ] Set experiment duration (2-4 weeks minimum)
- [ ] Set statistical significance threshold (p < 0.05)

#### Week 1 Analysis
- [ ] Check sample size for each variant
- [ ] Compare view rates across variants
- [ ] Compare selection rates across variants
- [ ] Compare conversion rates across variants
- [ ] Calculate revenue per variant
- [ ] Check for any anomalies or errors
- [ ] Adjust traffic if needed

#### Week 2 Analysis
- [ ] Update metrics dashboard
- [ ] Check statistical significance
- [ ] Identify trends
- [ ] Monitor for any drop-off points
- [ ] Review user session recordings (if available)
- [ ] Gather qualitative feedback

#### Week 3-4 Analysis
- [ ] Determine winning variant
- [ ] Calculate ROI of price changes
- [ ] Prepare final analysis report
- [ ] Make decision on permanent pricing
- [ ] Plan rollout of winning variant

---

## Post-Implementation Checklist

### Documentation
- [ ] Update README with pricing variant feature
- [ ] Document URL parameter usage
- [ ] Create internal wiki/docs for team
- [ ] Document Stripe Price ID mapping
- [ ] Add comments to code for future developers
- [ ] Update API documentation (if applicable)

### Knowledge Transfer
- [ ] Brief customer support team on pricing variants
- [ ] Train team on how to identify user's variant
- [ ] Document common issues and solutions
- [ ] Create FAQ for pricing variants

### Data Analysis
- [ ] Set up recurring reports for variant performance
- [ ] Create PostHog dashboards
- [ ] Set up alerts for conversion rate drops
- [ ] Monitor revenue impact weekly
- [ ] Track long-term retention by variant

### Future Enhancements
- [ ] Plan for additional variants (plan-c, plan-d)
- [ ] Consider geographic-based pricing
- [ ] Explore time-limited offers
- [ ] Plan A/B tests for feature differences
- [ ] Consider automated variant optimization

---

## Success Criteria

### Technical Success
- [ ] ✅ All tests passing
- [ ] ✅ Zero increase in error rates
- [ ] ✅ Database queries < 100ms
- [ ] ✅ Frontend loads < 2s
- [ ] ✅ Checkout completion rate maintained or improved
- [ ] ✅ Analytics tracking 100% of variant views

### Business Success
- [ ] ✅ Statistically significant sample size achieved (1000+ per variant)
- [ ] ✅ Clear winner identified (p < 0.05)
- [ ] ✅ Conversion rate improved OR revenue increased
- [ ] ✅ No increase in support tickets
- [ ] ✅ User satisfaction maintained (NPS/surveys)

---

## Risk Mitigation Checklist

### Before Launch
- [ ] Backup production database
- [ ] Test rollback procedure
- [ ] Set up real-time monitoring
- [ ] Prepare support team with FAQs
- [ ] Have developer on-call for first 48 hours

### During Launch
- [ ] Monitor error rates every hour
- [ ] Check Stripe dashboard for anomalies
- [ ] Review PostHog events immediately
- [ ] Test checkout manually after deploy
- [ ] Be ready to rollback quickly

### After Launch
- [ ] Daily metrics review for first week
- [ ] Weekly team sync on results
- [ ] Respond to issues within 2 hours
- [ ] Document any unexpected behaviors
- [ ] Iterate based on data

---

## Quick Reference

### Key Files Modified
```
Database:
  supabase/migrations/YYYYMMDD_add_pricing_variant.sql

Frontend:
  ai-chat-app/src/lib/justai-types.ts
  ai-chat-app/src/pages/SubscriptionPlans.tsx
  ai-chat-app/src/pages/CheckoutPage.tsx (optional)

Backend:
  edge-functions/create-checkout-session.ts

Documentation:
  PRICING_VARIANT_URL_PARAMETER_PLAN.md
  PRICING_VARIANT_DATABASE_EXAMPLE.md
  PRICING_VARIANT_FLOW_DIAGRAM.md
  STRIPE_PRICE_IDS.md (new)
```

### Test URLs
```
Control:  https://chat.justtalk.ai/subscription-plans?pricing_variant=control
Plan-A:   https://chat.justtalk.ai/subscription-plans?pricing_variant=plan-a
Plan-B:   https://chat.justtalk.ai/subscription-plans?pricing_variant=plan-b
Invalid:  https://chat.justtalk.ai/subscription-plans?pricing_variant=xyz
Default:  https://chat.justtalk.ai/subscription-plans
```

### Database Queries
```sql
-- Check variant distribution
SELECT pricing_variant, COUNT(*) 
FROM justai_subscription_plans 
GROUP BY pricing_variant;

-- Get all active variants
SELECT pricing_variant, plan_type, billing_period, price_cents 
FROM justai_subscription_plans 
WHERE is_active = true 
ORDER BY pricing_variant, plan_type, billing_period;

-- Test query for plan-a
SELECT * FROM justai_subscription_plans
WHERE pricing_variant = 'plan-a'
  AND billing_period = 'monthly'
  AND is_active = true
ORDER BY display_order;
```

### Commands
```bash
# Database migration
supabase db push --project-ref bcsyrxkfeatnbaqlnxgr

# Deploy edge function
supabase functions deploy create-checkout-session --project-ref bcsyrxkfeatnbaqlnxgr

# Build & deploy frontend
npm run build
vercel --prod

# Type check
npm run type-check

# Run tests
npm test
```

---

## Notes & Tips

1. **Always test on staging first** - Never deploy directly to production
2. **Monitor closely for first 48 hours** - Most issues surface quickly
3. **Have rollback plan ready** - Be able to revert in under 5 minutes
4. **Validate Stripe Price IDs** - Double-check before inserting into DB
5. **Use semantic commit messages** - Makes rollback easier
6. **Document everything** - Future you will thank present you
7. **Start with small traffic** - 5-10% initially, scale up gradually
8. **Trust the data** - Don't make decisions without statistical significance
9. **Consider long-term effects** - Lower prices might affect brand perception
10. **Keep it simple** - Don't over-engineer the solution

---

## Support Contacts

- **Database Issues:** Database Admin / DevOps Team
- **Stripe Issues:** Payments Team / Stripe Support
- **Frontend Issues:** Frontend Team Lead
- **Analytics Issues:** Data Team / PostHog Support
- **Customer Issues:** Customer Support Lead

---

## Completion Sign-Off

- [ ] Technical Lead Review
- [ ] Product Manager Approval
- [ ] QA Team Sign-Off
- [ ] Deployment Complete
- [ ] Monitoring Set Up
- [ ] Documentation Complete
- [ ] Team Briefed

**Date Completed:** _________________
**Deployed By:** _________________
**Production URL:** https://chat.justtalk.ai/subscription-plans

---

## Appendix: Troubleshooting

### Issue: Plans not showing for variant
**Solution:** 
1. Check database: `SELECT * FROM justai_subscription_plans WHERE pricing_variant='plan-a'`
2. Verify `is_active=true`
3. Check query in frontend matches database records

### Issue: Wrong prices displayed
**Solution:**
1. Check `price_cents` in database
2. Verify currency conversion (cents → dollars)
3. Clear React Query cache

### Issue: Checkout fails with variant
**Solution:**
1. Verify Stripe Price ID exists in Stripe Dashboard
2. Check edge function logs for errors
3. Verify pricing_variant is passed in checkout params

### Issue: Analytics not tracking
**Solution:**
1. Check PostHog integration is working
2. Verify event names match documentation
3. Check browser console for PostHog errors
4. Verify user is identified in PostHog

### Issue: Database query slow
**Solution:**
1. Verify index exists: `idx_subscription_plans_variant`
2. Run EXPLAIN ANALYZE on query
3. Check if too many plans in database
4. Consider adding more specific indexes
