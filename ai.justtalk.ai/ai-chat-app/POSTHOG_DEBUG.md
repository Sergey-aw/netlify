# PostHog Debugging Guide

## Issue
The "Sessions Started" metric shows 0 even after testing voice sessions.

## Root Cause Found
PostHog was not being initialized in the tracking functions. The `getPostHog()` function was returning an uninitialized instance.

## Changes Made

1. **Updated `getPostHog()` in posthog.ts** - Now automatically calls `initPostHog()` if not initialized
2. **Added debug logging** - More detailed console logs to track event capture

## How to Test

1. **Open browser console** (F12 or Cmd+Option+I)

2. **Start a voice session** and look for these logs:
   ```
   📊 PostHog: voice_session_started
   📊 PostHog instance status: { isInitialized: true, hasPostHog: true, ... }
   ✅ Event captured successfully
   ```

3. **If you see a warning:**
   ```
   ⚠️ PostHog not initialized, event not tracked
   ```
   This means the API key is missing or PostHog failed to initialize.

4. **Manual test in browser console:**
   ```javascript
   // Test if PostHog is accessible
   window.posthog
   
   // Manually trigger a test event
   window.posthog.capture('test_event', { test: 'value' })
   ```

## Common Issues

### 1. Event Name Mismatch
- Check that PostHog is looking for `voice_session_started` (with underscores)
- The property for breakdown should be `agent_name` (not `agentName`)

### 2. Time Zone / Date Range
- Make sure you're looking at the correct date range in PostHog
- Events may take a few minutes to appear in PostHog dashboard

### 3. Property Filtering
- The screenshot shows "Breakdown by agent_name"
- Make sure there are no filters that might exclude the events

### 4. User Identification
- Check if PostHog requires user identification
- Events might not show if sent before user is identified

## Verify Events in PostHog

1. Go to PostHog → **Activity** → **Live Events**
2. Start a voice session
3. You should see `voice_session_started` event appear within seconds
4. Click on the event to verify properties:
   - `agent_id`
   - `agent_name`
   - `scenario`
   - `conversation_id`

## Next Steps

If events are still not showing:
1. Check the "Live Events" feed in PostHog to see if ANY events are being received
2. Verify the API key is correct: `phc_K4pdgLvsUShjRlR6BSpM8aVzdQfMffptsVy5W4syDIV`
3. Check network tab for requests to `https://us.i.posthog.com`
4. Verify you're looking at the correct project in PostHog
