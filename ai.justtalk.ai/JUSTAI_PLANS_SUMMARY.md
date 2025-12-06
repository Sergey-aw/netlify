# JustAI Simplified Subscription Plans

## 🎯 Overview

**3 plans, all with voice interactions, monthly + annual pricing**

All plans include:
- ✅ Voice conversations (ElevenLabs AI)
- ✅ Text chat with AI teacher
- ✅ 24/7 availability
- ✅ Conversation history

---

## 📊 Pricing Structure

| Plan | Messages/Month | Monthly Price | Annual Price | Monthly Equivalent | Annual Savings |
|------|----------------|---------------|--------------|-------------------|----------------|
| **Basic** | 100 | $14.99 | $149.99 | $12.49/mo | $30/year (17%) |
| **Premium** | 500 | $39.99 | $399.99 | $33.33/mo | $80/year (17%) |
| **Unlimited** | ∞ Unlimited | $79.99 | $799.99 | $66.67/mo | $160/year (17%) |

**Annual discount: 17% (save ~2 months)**

---

## 🎁 Plan Details

### 🟢 Basic Plan
**Target**: Casual learners, beginners

**Monthly**: $14.99/month (100 messages)  
**Annual**: $149.99/year (save $30)

**Features**:
- 100 voice & text messages per month
- Real-time voice conversations
- AI English teacher
- 24/7 availability
- Conversation history

**Use case**: Students who practice 3-4 times per week

---

### 🔵 Premium Plan ⭐ (FEATURED)
**Target**: Serious learners, intermediate to advanced

**Monthly**: $39.99/month (500 messages)  
**Annual**: $399.99/year (save $80)

**Features**:
- 500 voice & text messages per month
- Real-time voice conversations
- Advanced AI tutor
- Detailed feedback & corrections
- Vocabulary tracking
- Grammar analysis
- Priority support

**Use case**: Students who practice daily or multiple times per day

---

### 🟣 Unlimited Plan
**Target**: Power users, intensive learners, exam prep

**Monthly**: $79.99/month (unlimited)  
**Annual**: $799.99/year (save $160)

**Features**:
- 🔥 Unlimited voice & text messages
- Real-time voice conversations
- Premium AI tutor
- Detailed feedback & corrections
- Advanced vocabulary tracking
- Grammar & pronunciation analysis
- Priority processing
- VIP support

**Use case**: Students preparing for exams (TOEFL, IELTS) or immersive learning

---

## 🛠️ Setup Instructions

### Option 1: Automated Setup (RECOMMENDED)

Run the setup script to create products via Stripe API:

```bash
# 1. Edit the script and add your Stripe API key
nano justai-stripe-products-setup.sh

# 2. Make it executable
chmod +x justai-stripe-products-setup.sh

# 3. Run it
./justai-stripe-products-setup.sh
```

The script will:
- ✅ Create 3 products in Stripe
- ✅ Create 6 prices (2 per product: monthly + annual)
- ✅ Add metadata for webhook handling
- ✅ Generate SQL statements to update your database

### Option 2: Manual Setup

Follow the detailed guide: `justai-stripe-setup-guide.md`

---

## 📦 Database Schema

Run the migration to create/update the plans table:

```bash
# Apply migration
supabase db execute -f justai-simplified-migration.sql

# Or in Supabase Dashboard: SQL Editor → New Query → Paste & Run
```

**New columns added**:
- `billing_period` - 'monthly' or 'annual'
- `monthly_equivalent_cents` - For annual plans, show $/month
- `discount_percentage` - Annual discount %

**Total records**: 6 (3 plans × 2 billing periods)

---

## 🔄 Migration from Old Plans

If you already have the 5-plan structure (2 text-only + 3 voice), you can:

**Option A**: Start fresh (DESTRUCTIVE)
```sql
TRUNCATE TABLE justai_subscription_plans CASCADE;
-- Then run justai-simplified-migration.sql
```

**Option B**: Keep both (SAFE)
```sql
-- Disable old plans
UPDATE justai_subscription_plans 
SET is_active = false 
WHERE includes_voice = false OR plan_name LIKE '%Text%';

-- Then run justai-simplified-migration.sql (will insert new plans)
```

**Option C**: Manual cleanup
- Export existing subscriptions
- Delete old plans
- Run migration
- Re-create subscriptions with new plans

---

## 🧪 Testing

### 1. Verify Plans in Database

```sql
SELECT 
  plan_name,
  billing_period,
  price_cents / 100.0 AS price_usd,
  monthly_equivalent_cents / 100.0 AS monthly_equivalent,
  discount_percentage,
  monthly_message_limit,
  is_featured
FROM justai_subscription_plans
ORDER BY display_order;
```

**Expected**: 6 rows (Basic monthly/annual, Premium monthly/annual, Unlimited monthly/annual)

### 2. Check Annual Savings

```sql
SELECT 
  plan_name,
  (SELECT price_cents FROM justai_subscription_plans p2 
   WHERE p2.plan_name = p1.plan_name AND p2.billing_period = 'monthly') / 100.0 AS monthly_price,
  price_cents / 100.0 AS annual_price,
  ((SELECT price_cents FROM justai_subscription_plans p2 
    WHERE p2.plan_name = p1.plan_name AND p2.billing_period = 'monthly') * 12 - price_cents) / 100.0 AS annual_savings
FROM justai_subscription_plans p1
WHERE billing_period = 'annual';
```

**Expected**:
- Basic: $30 savings
- Premium: $80 savings
- Unlimited: $160 savings

### 3. Test Subscription Creation

```bash
# Via Stripe API or Dashboard, create a test subscription
# Then check if it appears in justai_subscriptions table

supabase db execute "
SELECT 
  s.id,
  s.student_id,
  p.plan_name,
  p.billing_period,
  s.status,
  s.current_period_end
FROM justai_subscriptions s
JOIN justai_subscription_plans p ON s.plan_id = p.id
WHERE s.student_id = 'YOUR_TEST_STUDENT_ID';
"
```

---

## 🎨 Frontend Implementation

### Display Plans with Toggle

```typescript
import { useState } from 'react';

type BillingPeriod = 'monthly' | 'annual';

function PricingPage() {
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  
  // Fetch plans filtered by billing period
  const { data: plans } = useQuery({
    queryKey: ['plans', billingPeriod],
    queryFn: async () => {
      const { data } = await supabase
        .from('justai_subscription_plans')
        .select('*')
        .eq('is_active', true)
        .eq('billing_period', billingPeriod)
        .order('display_order');
      return data;
    }
  });

  return (
    <div>
      {/* Billing Toggle */}
      <div className="flex items-center justify-center gap-4 mb-8">
        <span className={billingPeriod === 'monthly' ? 'font-bold' : ''}>
          Monthly
        </span>
        <button
          onClick={() => setBillingPeriod(
            billingPeriod === 'monthly' ? 'annual' : 'monthly'
          )}
          className="toggle-switch"
        >
          {/* Toggle UI */}
        </button>
        <span className={billingPeriod === 'annual' ? 'font-bold' : ''}>
          Annual <span className="text-green-600">Save 17%</span>
        </span>
      </div>

      {/* Plan Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        {plans?.map(plan => (
          <PlanCard 
            key={plan.id} 
            plan={plan}
            billingPeriod={billingPeriod}
          />
        ))}
      </div>
    </div>
  );
}
```

### Plan Card Component

```typescript
function PlanCard({ plan, billingPeriod }) {
  const displayPrice = billingPeriod === 'annual' 
    ? plan.monthly_equivalent_cents / 100 
    : plan.price_cents / 100;
    
  const totalPrice = plan.price_cents / 100;
  const savings = billingPeriod === 'annual' 
    ? `Save $${(plan.price_cents / 100 * 12 - plan.price_cents / 100).toFixed(0)}/year`
    : null;

  return (
    <div className={`plan-card ${plan.is_featured ? 'featured' : ''}`}>
      <h3>{plan.plan_name}</h3>
      <div className="price">
        <span className="amount">${displayPrice.toFixed(2)}</span>
        <span className="period">/month</span>
      </div>
      
      {billingPeriod === 'annual' && (
        <div className="annual-info">
          <p className="total">${totalPrice}/year</p>
          <p className="savings">{savings}</p>
        </div>
      )}
      
      <ul className="features">
        {plan.features.map((feature, i) => (
          <li key={i}>{feature}</li>
        ))}
      </ul>
      
      <button onClick={() => handleSubscribe(plan.stripe_price_id)}>
        Get Started
      </button>
    </div>
  );
}
```

---

## 🎯 Pricing Strategy

### Why 17% discount for annual?

- **Industry standard**: 15-20% annual discount
- **Psychology**: ~2 months free (12 months for price of 10)
- **Cash flow**: Upfront payment helps with costs
- **Retention**: Annual subscribers more committed

### Competitive Analysis

| Competitor | Basic | Premium | Unlimited |
|------------|-------|---------|-----------|
| Duolingo Plus | $6.99/mo | - | $12.99/mo |
| Babbel | - | $13.95/mo | - |
| Rosetta Stone | - | $11.99/mo | - |
| **JustAI** | $14.99/mo | $39.99/mo | $79.99/mo |

**JustAI differentiators**:
- ✅ Real-time voice AI (not pre-recorded)
- ✅ Personalized conversations
- ✅ Instant feedback
- ✅ 24/7 availability

---

## 📈 Revenue Projections

### Example Scenario (100 subscribers)

**Conservative Split**:
- 50% Basic
- 30% Premium
- 20% Unlimited

**Monthly Revenue**:
```
50 × $14.99 = $749.50
30 × $39.99 = $1,199.70
20 × $79.99 = $1,599.80
Total: $3,549/month = $42,588/year
```

**If 30% choose annual** (average across all plans):
```
70 pay monthly: $2,484/month
30 pay annually: $12,750 upfront
First year total: ~$42,500
```

---

## ✅ Checklist

Before going live:

- [ ] Run `justai-simplified-migration.sql` to create plans table
- [ ] Run `justai-stripe-products-setup.sh` to create Stripe products
- [ ] Copy Price IDs from script output
- [ ] Update database with real Price IDs
- [ ] Set up Stripe webhook for `justai_webhook`
- [ ] Test subscription creation (monthly)
- [ ] Test subscription creation (annual)
- [ ] Test usage limit enforcement
- [ ] Test billing period reset
- [ ] Verify webhook handles both monthly and annual
- [ ] Update frontend to show both pricing options
- [ ] Add billing period toggle UI
- [ ] Test complete checkout flow
- [ ] Add analytics tracking for plan selection

---

## 🆘 Support

For detailed Stripe setup instructions, see:
- `justai-stripe-setup-guide.md` - Comprehensive Stripe guide
- `justai-deployment-guide.md` - Full deployment walkthrough
- `justai-post-deployment-checklist.md` - Post-deploy testing

---

**Last Updated**: December 3, 2025  
**Version**: 2.0 (Simplified - 3 plans, voice-enabled, monthly + annual)
