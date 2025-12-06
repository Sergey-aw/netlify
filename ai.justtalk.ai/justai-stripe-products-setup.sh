#!/bin/bash

# JustAI Stripe Products Setup Script
# This script creates 3 subscription products with monthly and annual pricing
# All plans include voice interactions with different message limits

# Set your Stripe API key
STRIPE_API_KEY="${STRIPE_API_KEY}"  # Set this environment variable before running

echo "🚀 Creating JustAI Subscription Products in Stripe..."
echo ""

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# =============================================================================
# PLAN 1: BASIC PLAN - 100 messages/month
# =============================================================================

echo -e "${BLUE}📦 Creating Product 1: JustAI Basic${NC}"

PRODUCT_1=$(curl -s https://api.stripe.com/v1/products \
  -u "${STRIPE_API_KEY}:" \
  -d name="JustAI Basic" \
  -d description="100 voice & text messages per month with AI English teacher" \
  -d "metadata[system]"="justai" \
  -d "metadata[plan_type]"="basic" \
  -d "metadata[includes_voice]"="true" \
  -d "metadata[message_limit]"="100")

PRODUCT_1_ID=$(echo $PRODUCT_1 | grep -o '"id": *"[^"]*"' | head -1 | sed 's/"id": *"\([^"]*\)"/\1/')
echo -e "${GREEN}✓ Product created: ${PRODUCT_1_ID}${NC}"

# Create Monthly Price for Basic Plan ($14.99/month)
echo "  Creating monthly price..."
PRICE_1_MONTHLY=$(curl -s https://api.stripe.com/v1/prices \
  -u "${STRIPE_API_KEY}:" \
  -d product="${PRODUCT_1_ID}" \
  -d currency="usd" \
  -d "unit_amount"=1499 \
  -d "recurring[interval]"="month" \
  -d "nickname"="JustAI Basic Monthly" \
  -d "metadata[billing_period]"="monthly")

PRICE_1_MONTHLY_ID=$(echo $PRICE_1_MONTHLY | grep -o '"id": *"[^"]*"' | head -1 | sed 's/"id": *"\([^"]*\)"/\1/')
echo -e "${GREEN}  ✓ Monthly price: ${PRICE_1_MONTHLY_ID} ($14.99/month)${NC}"

# Create Annual Price for Basic Plan ($149.99/year = $12.49/month, 17% discount)
echo "  Creating annual price..."
PRICE_1_ANNUAL=$(curl -s https://api.stripe.com/v1/prices \
  -u "${STRIPE_API_KEY}:" \
  -d product="${PRODUCT_1_ID}" \
  -d currency="usd" \
  -d "unit_amount"=14999 \
  -d "recurring[interval]"="year" \
  -d "nickname"="JustAI Basic Annual" \
  -d "metadata[billing_period]"="annual")

PRICE_1_ANNUAL_ID=$(echo $PRICE_1_ANNUAL | grep -o '"id": *"[^"]*"' | head -1 | sed 's/"id": *"\([^"]*\)"/\1/')
echo -e "${GREEN}  ✓ Annual price: ${PRICE_1_ANNUAL_ID} ($149.99/year)${NC}"
echo ""

# =============================================================================
# PLAN 2: PREMIUM PLAN - 500 messages/month
# =============================================================================

echo -e "${BLUE}📦 Creating Product 2: JustAI Premium${NC}"

PRODUCT_2=$(curl -s https://api.stripe.com/v1/products \
  -u "${STRIPE_API_KEY}:" \
  -d name="JustAI Premium" \
  -d description="500 voice & text messages per month with AI English teacher" \
  -d "metadata[system]"="justai" \
  -d "metadata[plan_type]"="premium" \
  -d "metadata[includes_voice]"="true" \
  -d "metadata[message_limit]"="500")

PRODUCT_2_ID=$(echo $PRODUCT_2 | grep -o '"id": *"[^"]*"' | head -1 | sed 's/"id": *"\([^"]*\)"/\1/')
echo -e "${GREEN}✓ Product created: ${PRODUCT_2_ID}${NC}"

# Create Monthly Price for Premium Plan ($39.99/month)
echo "  Creating monthly price..."
PRICE_2_MONTHLY=$(curl -s https://api.stripe.com/v1/prices \
  -u "${STRIPE_API_KEY}:" \
  -d product="${PRODUCT_2_ID}" \
  -d currency="usd" \
  -d "unit_amount"=3999 \
  -d "recurring[interval]"="month" \
  -d "nickname"="JustAI Premium Monthly" \
  -d "metadata[billing_period]"="monthly")

PRICE_2_MONTHLY_ID=$(echo $PRICE_2_MONTHLY | grep -o '"id": *"[^"]*"' | head -1 | sed 's/"id": *"\([^"]*\)"/\1/')
echo -e "${GREEN}  ✓ Monthly price: ${PRICE_2_MONTHLY_ID} ($39.99/month)${NC}"

# Create Annual Price for Premium Plan ($399.99/year = $33.33/month, 17% discount)
echo "  Creating annual price..."
PRICE_2_ANNUAL=$(curl -s https://api.stripe.com/v1/prices \
  -u "${STRIPE_API_KEY}:" \
  -d product="${PRODUCT_2_ID}" \
  -d currency="usd" \
  -d "unit_amount"=39999 \
  -d "recurring[interval]"="year" \
  -d "nickname"="JustAI Premium Annual" \
  -d "metadata[billing_period]"="annual")

PRICE_2_ANNUAL_ID=$(echo $PRICE_2_ANNUAL | grep -o '"id": *"[^"]*"' | head -1 | sed 's/"id": *"\([^"]*\)"/\1/')
echo -e "${GREEN}  ✓ Annual price: ${PRICE_2_ANNUAL_ID} ($399.99/year)${NC}"
echo ""

# =============================================================================
# PLAN 3: UNLIMITED PLAN - Unlimited messages
# =============================================================================

echo -e "${BLUE}📦 Creating Product 3: JustAI Unlimited${NC}"

PRODUCT_3=$(curl -s https://api.stripe.com/v1/products \
  -u "${STRIPE_API_KEY}:" \
  -d name="JustAI Unlimited" \
  -d description="Unlimited voice & text messages with AI English teacher" \
  -d "metadata[system]"="justai" \
  -d "metadata[plan_type]"="unlimited" \
  -d "metadata[includes_voice]"="true" \
  -d "metadata[message_limit]"="")

PRODUCT_3_ID=$(echo $PRODUCT_3 | grep -o '"id": *"[^"]*"' | head -1 | sed 's/"id": *"\([^"]*\)"/\1/')
echo -e "${GREEN}✓ Product created: ${PRODUCT_3_ID}${NC}"

# Create Monthly Price for Unlimited Plan ($79.99/month)
echo "  Creating monthly price..."
PRICE_3_MONTHLY=$(curl -s https://api.stripe.com/v1/prices \
  -u "${STRIPE_API_KEY}:" \
  -d product="${PRODUCT_3_ID}" \
  -d currency="usd" \
  -d "unit_amount"=7999 \
  -d "recurring[interval]"="month" \
  -d "nickname"="JustAI Unlimited Monthly" \
  -d "metadata[billing_period]"="monthly")

PRICE_3_MONTHLY_ID=$(echo $PRICE_3_MONTHLY | grep -o '"id": *"[^"]*"' | head -1 | sed 's/"id": *"\([^"]*\)"/\1/')
echo -e "${GREEN}  ✓ Monthly price: ${PRICE_3_MONTHLY_ID} ($79.99/month)${NC}"

# Create Annual Price for Unlimited Plan ($799.99/year = $66.67/month, 17% discount)
echo "  Creating annual price..."
PRICE_3_ANNUAL=$(curl -s https://api.stripe.com/v1/prices \
  -u "${STRIPE_API_KEY}:" \
  -d product="${PRODUCT_3_ID}" \
  -d currency="usd" \
  -d "unit_amount"=79999 \
  -d "recurring[interval]"="year" \
  -d "nickname"="JustAI Unlimited Annual" \
  -d "metadata[billing_period]"="annual")

PRICE_3_ANNUAL_ID=$(echo $PRICE_3_ANNUAL | grep -o '"id": *"[^"]*"' | head -1 | sed 's/"id": *"\([^"]*\)"/\1/')
echo -e "${GREEN}  ✓ Annual price: ${PRICE_3_ANNUAL_ID} ($799.99/year)${NC}"
echo ""

# =============================================================================
# OUTPUT SUMMARY
# =============================================================================

echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}📋 SUMMARY - Copy these IDs to your database${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}PLAN 1: JustAI Basic (100 messages/month)${NC}"
echo "  Product ID: ${PRODUCT_1_ID}"
echo "  Monthly Price ID: ${PRICE_1_MONTHLY_ID} ($14.99/month)"
echo "  Annual Price ID: ${PRICE_1_ANNUAL_ID} ($149.99/year)"
echo ""
echo -e "${GREEN}PLAN 2: JustAI Premium (500 messages/month)${NC}"
echo "  Product ID: ${PRODUCT_2_ID}"
echo "  Monthly Price ID: ${PRICE_2_MONTHLY_ID} ($39.99/month)"
echo "  Annual Price ID: ${PRICE_2_ANNUAL_ID} ($399.99/year)"
echo ""
echo -e "${GREEN}PLAN 3: JustAI Unlimited (Unlimited messages)${NC}"
echo "  Product ID: ${PRODUCT_3_ID}"
echo "  Monthly Price ID: ${PRICE_3_MONTHLY_ID} ($79.99/month)"
echo "  Annual Price ID: ${PRICE_3_ANNUAL_ID} ($799.99/year)"
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Generate SQL update statements
echo -e "${BLUE}📝 SQL Update Statements (copy & paste into Supabase SQL Editor)${NC}"
echo ""

cat << EOF
-- Update JustAI Basic Plan (Monthly)
UPDATE public.justai_subscription_plans
SET 
  stripe_price_id = '${PRICE_1_MONTHLY_ID}',
  stripe_product_id = '${PRODUCT_1_ID}'
WHERE plan_name = 'Basic' AND billing_period = 'monthly';

-- Update JustAI Basic Plan (Annual)
UPDATE public.justai_subscription_plans
SET 
  stripe_price_id = '${PRICE_1_ANNUAL_ID}',
  stripe_product_id = '${PRODUCT_1_ID}'
WHERE plan_name = 'Basic' AND billing_period = 'annual';

-- Update JustAI Premium Plan (Monthly)
UPDATE public.justai_subscription_plans
SET 
  stripe_price_id = '${PRICE_2_MONTHLY_ID}',
  stripe_product_id = '${PRODUCT_2_ID}'
WHERE plan_name = 'Premium' AND billing_period = 'monthly';

-- Update JustAI Premium Plan (Annual)
UPDATE public.justai_subscription_plans
SET 
  stripe_price_id = '${PRICE_2_ANNUAL_ID}',
  stripe_product_id = '${PRODUCT_2_ID}'
WHERE plan_name = 'Premium' AND billing_period = 'annual';

-- Update JustAI Unlimited Plan (Monthly)
UPDATE public.justai_subscription_plans
SET 
  stripe_price_id = '${PRICE_3_MONTHLY_ID}',
  stripe_product_id = '${PRODUCT_3_ID}'
WHERE plan_name = 'Unlimited' AND billing_period = 'monthly';

-- Update JustAI Unlimited Plan (Annual)
UPDATE public.justai_subscription_plans
SET 
  stripe_price_id = '${PRICE_3_ANNUAL_ID}',
  stripe_product_id = '${PRODUCT_3_ID}'
WHERE plan_name = 'Unlimited' AND billing_period = 'annual';

-- Verify updates
SELECT plan_name, billing_period, price_cents/100.0 as price_usd, stripe_price_id 
FROM justai_subscription_plans 
ORDER BY display_order;
EOF

echo ""
echo -e "${GREEN}✅ All products and prices created successfully!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Run the SQL statements above in Supabase SQL Editor"
echo "2. Verify products in Stripe Dashboard: https://dashboard.stripe.com/products"
echo "3. Set up webhook endpoint (see justai-stripe-setup-guide.md)"
echo ""
