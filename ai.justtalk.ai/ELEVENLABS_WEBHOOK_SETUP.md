# ElevenLabs Post-Call Webhook Setup Guide

## Overview

ElevenLabs sends a webhook after each conversation ends with comprehensive analysis data including:
- Complete transcript with timestamps
- **Analysis results** (evaluation_criteria_results, data_collection_results, transcript_summary)
- Metadata (duration, costs, charging details)
- Call success status

This webhook provides the `analysis` field that we previously thought was missing from the API.

## Current Status

✅ **Webhook handler created** - Logs all received data  
⏳ **Database storage** - Not implemented yet (logging only for now)  
⏳ **Testing** - Needs real webhook from ElevenLabs

## Setup Instructions

### 1. Deploy the Webhook Function

```bash
cd /Users/sergeygordeev/SF/ai.justtalk.ai
supabase functions deploy elevenlabs-post-call-webhook
```

### 2. Configure Webhook in ElevenLabs Dashboard

1. Go to [ElevenLabs Agents Settings](https://elevenlabs.io/app/agents/settings)
2. Navigate to "Post-call webhooks" section
3. Enable "Transcription webhooks" (`post_call_transcription`)
4. Enter your webhook URL:
   ```
   https://[your-project].supabase.co/functions/v1/elevenlabs-post-call-webhook
   ```
5. Save the generated **Shared Secret** (for HMAC signature validation)

### 3. Set Environment Variable

```bash
# Set the webhook secret for signature validation
supabase secrets set ELEVENLABS_WEBHOOK_SECRET=your_shared_secret_here
```

**Important:** Store the shared secret securely. It's used to validate that webhooks actually come from ElevenLabs.

### 4. Optional: IP Whitelisting

For additional security, whitelist ElevenLabs IPs in your firewall:

**US (Default):**
- 34.67.146.145
- 34.59.11.47

**EU:**
- 35.204.38.71
- 34.147.113.54

**Asia:**
- 35.185.187.110
- 35.247.157.189

## Webhook Data Structure

### Top-Level Fields
```typescript
{
  type: 'post_call_transcription',
  event_timestamp: 1739537297,
  data: {
    agent_id: string,
    conversation_id: string,
    status: 'done',
    user_id?: string,
    transcript: [...],
    metadata: {...},
    analysis: {...},  // 🎯 This is what we need!
    conversation_initiation_client_data: {...}
  }
}
```

### Analysis Field (The Key Data)
```typescript
analysis: {
  evaluation_criteria_results: {},  // Custom evaluation results
  data_collection_results: {},      // Custom data collection
  call_successful: 'success',       // Call outcome
  transcript_summary: string        // AI-generated summary
}
```

## Testing

### 1. Make a Test Call

1. Start a voice conversation in your app
2. Talk for at least 30 seconds
3. End the conversation
4. Wait for ElevenLabs to process (5-10 seconds)

### 2. Check Logs

View the webhook logs in Supabase:

```bash
supabase functions logs elevenlabs-post-call-webhook --follow
```

Look for these log entries:
- `📥 Received ElevenLabs webhook`
- `✅ Found voice session`
- `🎯 COMPLETE WEBHOOK PAYLOAD` - Full JSON
- `📊 TRANSCRIPT DATA` - Message details
- `📈 METADATA` - Duration and costs
- `🧠 ANALYSIS FIELD` - **Analysis results including transcript_summary**
- `⚙️ CONVERSATION INITIATION DATA` - Dynamic variables

### 3. Verify Data

Check that the logs show:
- ✅ Webhook signature validated successfully
- ✅ Voice session found in database
- ✅ `analysis` field exists and contains data
- ✅ `transcript_summary` is present

## What We'll Store Later

Once we verify the webhook structure, we'll store:

1. **In `justai_conversations.session_memory`:**
   ```json
   {
     "conversation_summary": "analysis.transcript_summary",
     "call_successful": "analysis.call_successful",
     "evaluation_results": "analysis.evaluation_criteria_results",
     "data_collection": "analysis.data_collection_results",
     "extracted_at": "timestamp"
   }
   ```

2. **Webhook tracking:**
   - Add `webhook_received_at` timestamp to `justai_voice_sessions`
   - Track webhook delivery success

## Benefits of Using Webhooks vs Polling

### Current Approach (process-voice-session)
❌ Must poll ElevenLabs API immediately after call  
❌ Analysis might not be ready yet  
❌ No `analysis` field in immediate API response  
❌ Requires 5-second delay + retry logic  

### Webhook Approach
✅ ElevenLabs sends data AFTER analysis is complete  
✅ Guaranteed to include `analysis` field  
✅ No polling or waiting needed  
✅ More reliable and efficient  
✅ Lower API costs  

## Architecture Comparison

### Before (Current):
```
Call Ends → Client calls process-voice-session 
         → Edge function polls ElevenLabs API
         → API returns transcript (no analysis)
         → Must use OpenAI to extract memory
```

### After (With Webhook):
```
Call Ends → ElevenLabs processes internally
         → Analysis complete
         → Webhook sent to our endpoint
         → Receive transcript + analysis together
         → Store analysis directly (no OpenAI needed for basic summary)
```

## Migration Plan

### Phase 1: Logging (Current)
- ✅ Webhook receives and logs all data
- ✅ Verify structure and fields
- ✅ Validate HMAC signatures
- ✅ Test with real conversations

### Phase 2: Storage (Next)
- Store `analysis` data in `session_memory`
- Add `webhook_received_at` tracking
- Handle duplicate webhooks gracefully
- Update progress tracking logic

### Phase 3: Replace Polling (Future)
- Remove 5-second delay from `process-voice-session`
- Keep `process-voice-session` for transcript/messages
- Use webhook for analysis data
- Hybrid approach: API for immediate data, webhook for analysis

## Webhook Reliability

ElevenLabs webhook reliability features:
- ✅ HMAC signature validation
- ✅ Automatic retries on failure (up to 10 times)
- ✅ Timestamps to prevent replay attacks
- ⚠️ Auto-disabled after 10 consecutive failures or 7 days without success
- ⚠️ **HIPAA compliance**: No retries if webhook fails (for privacy)

## Troubleshooting

### Webhook not received
1. Check ElevenLabs dashboard webhook settings
2. Verify webhook URL is correct
3. Check function is deployed: `supabase functions list`
4. Check function logs for errors

### Signature validation failing
1. Verify `ELEVENLABS_WEBHOOK_SECRET` is set correctly
2. Check secret matches ElevenLabs dashboard
3. Check timestamp isn't too old (>30 minutes)

### Session not found
1. Ensure `elevenlabs_conversation_id` is saved correctly
2. Check voice session was created before webhook arrives
3. Verify conversation ID format matches

## Next Steps

1. **Test the webhook** - Make a real call and verify logs
2. **Review the data** - Check what's in `analysis` field
3. **Design storage** - Decide which fields to store where
4. **Implement storage** - Add database updates
5. **Update process-voice-session** - Remove redundant logic
6. **Compare with OpenAI** - Decide if we still need OpenAI for memory extraction

## Related Documentation

- [ElevenLabs Webhook Docs](https://elevenlabs.io/docs/agents-platform/workflows/post-call-webhooks)
- [process-voice-session.ts](edge-functions/process-voice-session.ts)
- [analyze-conversation-feedback/index.ts](supabase/functions/analyze-conversation-feedback/index.ts)
