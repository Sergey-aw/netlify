#!/usr/bin/env node

/**
 * Test script to send events to PostHog
 * Usage: node test-posthog.js
 */

import { PostHog } from 'posthog-node';

const apiKey = process.env.VITE_POSTHOG_API_KEY;
const host = process.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

if (!apiKey) {
  console.error('Error: VITE_POSTHOG_API_KEY environment variable not set');
  console.log('Please set it in your .env file or run:');
  console.log('VITE_POSTHOG_API_KEY=your_key node test-posthog.js');
  process.exit(1);
}

const client = new PostHog(apiKey, { host });

// Test user ID (use a test user or your own user ID)
const testUserId = 'test-user-' + Date.now();

console.log('Sending test events to PostHog...');
console.log('User ID:', testUserId);
console.log('Host:', host);

// Test subscription_activated event
client.capture({
  distinctId: testUserId,
  event: 'subscription_activated',
  properties: {
    subscription_type: 'Premium',
    price_id: 'price_test123',
    price_cents: 999,
    price_usd: '9.99',
    billing_period: 'monthly',
    stripe_subscription_id: 'sub_test_' + Date.now(),
    test_event: true,
  },
});

console.log('✓ Sent: subscription_activated');

// Test custom event
client.capture({
  distinctId: testUserId,
  event: 'test_event',
  properties: {
    test_property: 'test_value',
    timestamp: new Date().toISOString(),
    source: 'cli_test_script',
  },
});

console.log('✓ Sent: test_event');

// Set user properties
client.identify({
  distinctId: testUserId,
  properties: {
    email: 'test@example.com',
    subscription_type: 'Premium',
    subscription_status: 'active',
    test_user: true,
  },
});

console.log('✓ Set user properties');

// Flush events and close
await client.shutdown();

console.log('\n✅ All events sent successfully!');
console.log('Check your PostHog dashboard at:', host);
console.log('Look for user:', testUserId);
