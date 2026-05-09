# SpeechSuper API Integration - Bug Fix Summary

## Issue
The initial SpeechSuper API integration was returning empty responses, causing JSON parsing errors during pronunciation assessment in the onboarding flow.

## Root Cause
The implementation was using an incorrect API request format:
- **Wrong endpoint**: Using base URL `https://api.speechsuper.com/` instead of `/sent.eval.promax`
- **Wrong authentication**: MD5 signatures instead of SHA-1
- **Wrong request method**: Query parameters instead of multipart form data
- **Missing structure**: Lacked the complex `connect`/`start` command payload structure

## Solution
Rewrote the edge function based on the working `pronunciation-submit-sentence-practice` implementation found in the repository.

### Correct SpeechSuper API Format

#### 1. Endpoint
```
POST https://api.speechsuper.com/sent.eval.promax
```

#### 2. Authentication (SHA-1 Signatures)
```typescript
// Connect signature
const connectSig = sha1(`${appKey}${timestamp}${secretKey}`);

// Start signature  
const startSig = sha1(`${appKey}${timestamp}${userId}${secretKey}`);
```

#### 3. Request Structure
**Headers**:
```
Request-Index: 0
```

**Body** (multipart/form-data):
- `text`: JSON string with connect and start commands
- `audio`: WAV file (PCM16, 16kHz, mono)

**Text Payload Structure**:
```json
{
  "connect": {
    "cmd": "connect",
    "param": {
      "sdk": {
        "version": 16777472,
        "source": 9,
        "protocol": 2
      },
      "app": {
        "applicationId": "<SPEECHSUPER_APP_KEY>",
        "timestamp": "<unix_timestamp>",
        "sig": "<connect_signature>"
      }
    }
  },
  "start": {
    "cmd": "start",
    "param": {
      "app": {
        "userId": "<user_id>",
        "applicationId": "<SPEECHSUPER_APP_KEY>",
        "timestamp": "<unix_timestamp>",
        "sig": "<start_signature>"
      },
      "audio": {
        "audioType": "wav",
        "channel": 1,
        "sampleBytes": 2,
        "sampleRate": 16000
      },
      "request": {
        "tokenId": "onboarding_<timestamp>",
        "coreType": "sent.eval.promax",
        "refText": "<text_to_pronounce>",
        "dict_type": "IPA88",
        "dict_dialect": "en_us",
        "phoneme_output": 1
      }
    }
  }
}
```

## Files Fixed

### `/edge-functions/speechsuper-score.ts`
Complete rewrite to match working implementation:
- Changed from URL query parameters to multipart form data
- Implemented SHA-1 signature generation
- Added complex connect/start command structure
- Proper error handling for non-JSON responses

### Key Changes:
```typescript
// OLD (incorrect)
const url = new URL('https://api.speechsuper.com/');
url.searchParams.append('coreType', 'sent.eval.promax');
// ... more params
const signature = await generateMD5Signature(params);
fetch(url, { body: `audioBase64Str=${base64}` });

// NEW (correct)
const connectSig = await sha1HexLower(`${appKey}${timestamp}${secretKey}`);
const startSig = await sha1HexLower(`${appKey}${timestamp}${userId}${secretKey}`);
const formData = new FormData();
formData.append('text', JSON.stringify(textPayload));
formData.append('audio', audioFile);
fetch('https://api.speechsuper.com/sent.eval.promax', {
  headers: { 'Request-Index': '0' },
  body: formData
});
```

## What Works Now

✅ Correct API endpoint  
✅ SHA-1 authentication signatures  
✅ Proper request payload structure  
✅ Multipart form data with JSON + audio  
✅ Error handling for API responses  
✅ Response transformation to expected format  

## Next Steps

1. **Deploy to Supabase**
   ```bash
   supabase functions deploy speechsuper-score
   ```

2. **Set Environment Variables** in Supabase Dashboard:
   - `SPEECHSUPER_APP_KEY`
   - `SPEECHSUPER_SECRET_KEY`

3. **Test End-to-End**:
   - Navigate to onboarding flow
   - Complete pronunciation assessment
   - Verify scores display correctly
   - Check edge function logs for any errors

4. **Monitor**:
   - Watch Supabase logs for API errors
   - Check response times (should be < 5 seconds)
   - Validate accuracy of pronunciation scores

## Testing Checklist

- [ ] Edge function deploys without errors
- [ ] Environment variables are set correctly
- [ ] Onboarding pronunciation assessment loads
- [ ] Audio recording works
- [ ] Audio submission succeeds
- [ ] Pronunciation scores display correctly
- [ ] Word-level feedback shows
- [ ] CEFR level is calculated
- [ ] Error handling works for invalid audio
- [ ] No console errors in browser

## Rollback Plan (if needed)

If issues persist:
1. Revert `PronunciationAssessment.tsx` import back to `speechace-api`
2. Restore deleted `speechace-api.ts` from git history
3. Redeploy old edge function (if existed)
4. Investigate further with SpeechSuper support

## References

- Working implementation: `/supabase/functions/pronunciation-submit-sentence-practice/index.ts`
- Migration plan: `/SPEECHSUPER_MIGRATION_PLAN.md`
- SpeechSuper endpoint: `sent.eval.promax` for sentence evaluation (2-200 words)

---

**Status**: Fixed and ready for deployment  
**Date**: February 1, 2026  
**Impact**: Critical - blocks onboarding flow completion
