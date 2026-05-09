# Database Schema Example: Pricing Variants

## Current Database Structure (Before Implementation)

```
justai_subscription_plans
┌──────────────────────────┬─────────────┬────────────────┬─────────────┬──────────────────────────┬───────────┐
│ id                       │ plan_type   │ billing_period │ price_cents │ stripe_price_id          │ is_active │
├──────────────────────────┼─────────────┼────────────────┼─────────────┼──────────────────────────┼───────────┤
│ bb7ec028-...             │ basic       │ monthly        │ 1999        │ price_1SlTYf...          │ true      │
│ 4ac367b2-...             │ basic       │ annual         │ 14999       │ price_1SaM65...          │ true      │
│ 45ee5fa9-...             │ premium     │ monthly        │ 3799        │ price_1SlTmj...          │ true      │
│ 06bb3d4f-...             │ premium     │ annual         │ 29999       │ price_1SaM67...          │ true      │
│ baf4bb45-...             │ basic       │ weekly         │ 499         │ price_1SqxwU...          │ true      │
└──────────────────────────┴─────────────┴────────────────┴─────────────┴──────────────────────────┴───────────┘
Total: 5 plans (single pricing strategy)
```

**Problem:** Only one price per plan type + billing period combination. Can't A/B test different prices.

---

## Proposed Database Structure (After Implementation)

### Option 1: Add `pricing_variant` Column (RECOMMENDED ✅)

```
justai_subscription_plans
┌──────────────┬───────────┬────────────────┬─────────────────┬─────────────┬──────────────────────────┬───────────┐
│ id           │ plan_type │ billing_period │ pricing_variant │ price_cents │ stripe_price_id          │ is_active │
├──────────────┼───────────┼────────────────┼─────────────────┼─────────────┼──────────────────────────┼───────────┤
│ uuid-1       │ basic     │ monthly        │ control         │ 1999        │ price_xxx_control        │ true      │
│ uuid-2       │ basic     │ monthly        │ plan-a          │ 999         │ price_xxx_plan_a         │ true      │
│ uuid-3       │ basic     │ monthly        │ plan-b          │ 1499        │ price_xxx_plan_b         │ true      │
├──────────────┼───────────┼────────────────┼─────────────────┼─────────────┼──────────────────────────┼───────────┤
│ uuid-4       │ basic     │ annual         │ control         │ 14999       │ price_yyy_control        │ true      │
│ uuid-5       │ basic     │ annual         │ plan-a          │ 9999        │ price_yyy_plan_a         │ true      │
│ uuid-6       │ basic     │ annual         │ plan-b          │ 14999       │ price_yyy_plan_b         │ true      │
├──────────────┼───────────┼────────────────┼─────────────────┼─────────────┼──────────────────────────┼───────────┤
│ uuid-7       │ premium   │ monthly        │ control         │ 3799        │ price_zzz_control        │ true      │
│ uuid-8       │ premium   │ monthly        │ plan-a          │ 1999        │ price_zzz_plan_a         │ true      │
│ uuid-9       │ premium   │ monthly        │ plan-b          │ 2499        │ price_zzz_plan_b         │ true      │
├──────────────┼───────────┼────────────────┼─────────────────┼─────────────┼──────────────────────────┼───────────┤
│ uuid-10      │ premium   │ annual         │ control         │ 29999       │ price_aaa_control        │ true      │
│ uuid-11      │ premium   │ annual         │ plan-a          │ 14999       │ price_aaa_plan_a         │ true      │
│ uuid-12      │ premium   │ annual         │ plan-b          │ 24999       │ price_aaa_plan_b         │ true      │
└──────────────┴───────────┴────────────────┴─────────────────┴─────────────┴──────────────────────────┴───────────┘
Total: 12 plans (3 variants × 2 plan types × 2 billing periods) + weekly if enabled
```

**Query Example:**
```sql
-- Get plans for "plan-a" variant, monthly billing
SELECT * FROM justai_subscription_plans
WHERE pricing_variant = 'plan-a'
  AND billing_period = 'monthly'
  AND is_active = true
ORDER BY display_order;

-- Result: Returns Basic Monthly ($9.99) and Premium Monthly ($19.99) for plan-a
```

---

## Price Mapping Table

### Control Variant (Current Pricing)
| Plan Type | Billing Period | Price (USD) | Price (cents) | Stripe Price ID       |
|-----------|----------------|-------------|---------------|-----------------------|
| Basic     | Monthly        | $19.99      | 1999          | price_1SlTYf...       |
| Basic     | Annual         | $149.99     | 14999         | price_1SaM65...       |
| Premium   | Monthly        | $37.99      | 3799          | price_1SlTmj...       |
| Premium   | Annual         | $299.99     | 29999         | price_1SaM67...       |

### Plan-A Variant (50% Off)
| Plan Type | Billing Period | Price (USD) | Price (cents) | Stripe Price ID       |
|-----------|----------------|-------------|---------------|-----------------------|
| Basic     | Monthly        | $9.99       | 999           | price_NEW_plan_a_1    |
| Basic     | Annual         | $99.99      | 9999          | price_NEW_plan_a_2    |
| Premium   | Monthly        | $19.99      | 1999          | price_NEW_plan_a_3    |
| Premium   | Annual         | $149.99     | 14999         | price_NEW_plan_a_4    |

### Plan-B Variant (25% Off)
| Plan Type | Billing Period | Price (USD) | Price (cents) | Stripe Price ID       |
|-----------|----------------|-------------|---------------|-----------------------|
| Basic     | Monthly        | $14.99      | 1499          | price_NEW_plan_b_1    |
| Basic     | Annual         | $149.99     | 14999         | price_NEW_plan_b_2    |
| Premium   | Monthly        | $24.99      | 2499          | price_NEW_plan_b_3    |
| Premium   | Annual         | $249.99     | 24999         | price_NEW_plan_b_4    |

---

## URL to Database Query Flow

### Example 1: Control Variant
```
URL: https://chat.justtalk.ai/?pricing_variant=control
                                  └─────────────┬────────────┘
                                                │
                                                ▼
Frontend extracts: effectivePricingVariant = 'control'
                                                │
                                                ▼
Query: SELECT * FROM justai_subscription_plans
       WHERE pricing_variant = 'control'
         AND billing_period = 'monthly'
         AND is_active = true
                                                │
                                                ▼
Returns: Basic ($19.99), Premium ($37.99)
```

### Example 2: Plan-A Variant
```
URL: https://chat.justtalk.ai/?pricing_variant=plan-a
                                  └────────────┬───────────┘
                                               │
                                               ▼
Frontend extracts: effectivePricingVariant = 'plan-a'
                                               │
                                               ▼
Query: SELECT * FROM justai_subscription_plans
       WHERE pricing_variant = 'plan-a'
         AND billing_period = 'monthly'
         AND is_active = true
                                               │
                                               ▼
Returns: Basic ($9.99), Premium ($19.99)
```

### Example 3: Invalid Variant (Fallback)
```
URL: https://chat.justtalk.ai/?pricing_variant=xyz
                                  └──────────┬────────┘
                                             │
                                             ▼
Frontend validation: 'xyz' not in ['control', 'plan-a', 'plan-b']
                                             │
                                             ▼
Fallback: effectivePricingVariant = 'control'
                                             │
                                             ▼
Query: SELECT * FROM justai_subscription_plans
       WHERE pricing_variant = 'control'
         AND billing_period = 'monthly'
         AND is_active = true
                                             │
                                             ▼
Returns: Basic ($19.99), Premium ($37.99)
```

---

## Migration Script

```sql
-- Step 1: Add the pricing_variant column with default
ALTER TABLE justai_subscription_plans 
ADD COLUMN pricing_variant TEXT DEFAULT 'control';

-- Step 2: Backfill existing records
UPDATE justai_subscription_plans 
SET pricing_variant = 'control'
WHERE pricing_variant IS NULL;

-- Step 3: Make it NOT NULL
ALTER TABLE justai_subscription_plans 
ALTER COLUMN pricing_variant SET NOT NULL;

-- Step 4: Add constraint for valid values
ALTER TABLE justai_subscription_plans
ADD CONSTRAINT valid_pricing_variant 
CHECK (pricing_variant IN ('control', 'plan-a', 'plan-b'));

-- Step 5: Add composite index for efficient queries
CREATE INDEX idx_subscription_plans_variant 
ON justai_subscription_plans(pricing_variant, billing_period, plan_type, is_active);

-- Step 6: Update unique constraint to include pricing_variant
-- (If you had one on plan_type + billing_period, update it)
ALTER TABLE justai_subscription_plans
DROP CONSTRAINT IF EXISTS unique_plan_billing_period;

ALTER TABLE justai_subscription_plans
ADD CONSTRAINT unique_plan_variant_billing 
UNIQUE (plan_type, billing_period, pricing_variant);
```

---

## Data Insertion Example

```sql
-- Insert Basic Monthly plans for all variants
INSERT INTO justai_subscription_plans 
  (plan_name, plan_type, billing_period, pricing_variant, price_cents, stripe_price_id, stripe_product_id, description, includes_voice, is_active, display_order, monthly_message_limit, voice_minutes_limit, features)
VALUES
  -- Plan-A variant
  ('Basic', 'basic', 'monthly', 'plan-a', 999, 'price_xxx_plan_a', 'prod_TXQxcVGTaRpqLG', 'Perfect for casual learners', true, true, 1, 100, 120, 
   '{"title": "What''s included", "items": [{"name": "Natural AI voice practice", "description": "Speak naturally with high-quality AI voices"}]}'),
  
  -- Plan-B variant  
  ('Basic', 'basic', 'monthly', 'plan-b', 1499, 'price_xxx_plan_b', 'prod_TXQxcVGTaRpqLG', 'Perfect for casual learners', true, true, 1, 100, 120, 
   '{"title": "What''s included", "items": [{"name": "Natural AI voice practice", "description": "Speak naturally with high-quality AI voices"}]}');

-- Repeat for Premium plans and other billing periods...
```

---

## Query Performance

### With Index (Recommended)
```sql
CREATE INDEX idx_subscription_plans_variant 
ON justai_subscription_plans(pricing_variant, billing_period, plan_type, is_active);
```

**Query Plan:**
```
Index Scan using idx_subscription_plans_variant
  Index Cond: ((pricing_variant = 'plan-a') AND (billing_period = 'monthly') AND (is_active = true))
  Cost: 0.15..8.17 rows=1 width=XX
```
⚡ **Fast:** Direct index lookup, O(log n) complexity

### Without Index
**Query Plan:**
```
Seq Scan on justai_subscription_plans
  Filter: (pricing_variant = 'plan-a' AND billing_period = 'monthly' AND is_active = true)
  Rows Removed by Filter: 100+
  Cost: 0.00..XX.XX rows=1 width=XX
```
🐌 **Slow:** Full table scan, O(n) complexity

---

## Comparison: Single Record vs Multiple Records

### ❌ Single Record Approach (JSONB)
```sql
-- Complex JSONB structure (NOT RECOMMENDED)
{
  "pricing_variants": {
    "control": {
      "price_cents": 1999,
      "stripe_price_id": "price_xxx_control"
    },
    "plan-a": {
      "price_cents": 999,
      "stripe_price_id": "price_xxx_plan_a"
    }
  }
}

-- Query becomes complex
SELECT *, 
       (pricing_variants->'plan-a'->>'price_cents')::int as price_cents,
       pricing_variants->'plan-a'->>'stripe_price_id' as stripe_price_id
FROM justai_subscription_plans
WHERE ...
```

**Problems:**
- Complex queries
- Hard to index
- Difficult to maintain data integrity
- Can't use foreign keys easily
- Type safety issues
- Hard to add constraints

### ✅ Multiple Records Approach (RECOMMENDED)
```sql
-- Simple, clean query
SELECT * FROM justai_subscription_plans
WHERE pricing_variant = 'plan-a'
  AND billing_period = 'monthly'
  AND is_active = true;
```

**Benefits:**
- Simple queries
- Easy to index
- Data integrity via constraints
- Type safety
- Easy to audit
- Clear relationships
- Can toggle variants via is_active

---

## Storage Calculation

### Current: 5 plans
- Storage: ~5 KB (assuming ~1KB per row with JSONB features)

### After Implementation: 15 plans (3 variants)
- Storage: ~15 KB
- **Increase: 10 KB** (negligible)

### With 10 variants: 50 plans
- Storage: ~50 KB
- **Still negligible for modern databases**

**Conclusion:** Storage is not a concern. Clarity and maintainability are more important.

---

## Complete Example Query Comparison

### Fetching Monthly Plans - Before
```typescript
const { data, error } = await supabase
  .from('justai_subscription_plans')
  .select('*')
  .eq('is_active', true)
  .eq('billing_period', 'monthly')
  .order('display_order');

// Returns: 2 plans (Basic, Premium) with control pricing
```

### Fetching Monthly Plans - After
```typescript
const pricingVariant = searchParams.get('pricing_variant') || 'control';

const { data, error } = await supabase
  .from('justai_subscription_plans')
  .select('*')
  .eq('is_active', true)
  .eq('billing_period', 'monthly')
  .eq('pricing_variant', pricingVariant)  // NEW LINE
  .order('display_order');

// Returns: 2 plans (Basic, Premium) with variant-specific pricing
```

**Difference:** One additional `.eq()` filter. Simple and clean!

---

## Rollback Strategy

If pricing variants don't work out or you need to rollback:

```sql
-- Option 1: Deactivate non-control variants
UPDATE justai_subscription_plans
SET is_active = false
WHERE pricing_variant != 'control';

-- Option 2: Delete non-control variants
DELETE FROM justai_subscription_plans
WHERE pricing_variant != 'control';

-- Option 3: Drop column entirely (destructive)
ALTER TABLE justai_subscription_plans
DROP COLUMN pricing_variant;
```

All existing functionality continues with control variant.
