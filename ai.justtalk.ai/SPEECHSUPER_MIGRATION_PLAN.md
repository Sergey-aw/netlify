# SpeechSuper API Migration Plan

## Overview
Migrate pronunciation assessment from Speechace to SpeechSuper API while maintaining the same UI and user flow in the onboarding process.

## Current Implementation Analysis

### Current Stack (Speechace)
- **Frontend**: React component `PronunciationAssessment.tsx`
- **API Client**: `src/lib/speechace-api.ts`
- **Edge Function**: `speechace-score` (via Supabase)
- **Data Flow**: 
  1. User records audio (browser MediaRecorder API)
  2. Audio blob sent to Supabase edge function
  3. Edge function calls Speechace API
  4. Results processed and returned to frontend

### Current Features Used
- Word-level pronunciation scoring
- Overall pronunciation score (0-100)
- CEFR level assessment
- Phoneme-level analysis
- Accuracy percentage calculation
- Words to improve identification (score < 75)

### Current API Response Structure (Speechace)
```typescript
interface SpeechaceResponse {
  status: string;
  text_score: {
    text: string;
    word_score_list: SpeechaceWordScore[];
    speechace_score: {
      pronunciation: number;
    };
    cefr_score: {
      pronunciation: string;
    };
  };
}
```

## SpeechSuper API Research

### Recommended API Endpoint
Based on our use case (2-3 sentence pronunciation assessment):
- **API Type**: `sent.eval.promax` (Scripted Short Text)
- **Reason**: 
  - Supports 2-200 words ✅
  - Provides phoneme-level scores ✅
  - Provides word-level scores ✅
  - Includes fluency scoring ✅
  - Supports CEFR-like overall scoring ✅

### Key Features Available
- Overall pronunciation score
- Word-level accuracy scores
- Phoneme-level detailed analysis
- Fluency metrics
- Completeness scoring
- Linking and loss of plosion (English)

### API Structure (Expected)
Based on SpeechSuper documentation patterns:
```typescript
interface SpeechSuperRequest {
  coreType: "sent.eval.promax";
  refText: string; // Reference text to read
  audioType: "base64" | "url";
  audioData: string; // Base64 encoded audio
  userId: string;
  // Additional parameters as needed
}

interface SpeechSuperResponse {
  result: {
    overall: number; // Overall score 0-100
    words: Array<{
      text: string;
      score: number;
      phonemes: Array<{
        phone: string;
        score: number;
      }>;
    }>;
    fluency: number;
    completeness: number;
    // CEFR mapping may need custom calculation
  };
}
```

## Migration Steps

### Phase 1: Setup and Research (Day 1)
1. ✅ Document current implementation
2. ⏳ Obtain SpeechSuper API credentials (trial account)
3. ⏳ Access complete SpeechSuper API documentation
4. ⏳ Test API with sample audio files
5. ⏳ Map response structure to current UI requirements

### Phase 2: Backend Implementation (Day 2-3)
1. Create new edge function `speechsuper-score.ts`
   ```typescript
   // Location: edge-functions/speechsuper-score.ts
   // Purpose: Proxy requests to SpeechSuper API
   ```
2. Implement audio format conversion if needed
   - SpeechSuper accepts: WAV, MP3, or base64
   - Current: Recording as WAV blob
3. Add authentication handling
   - Store API keys in Supabase secrets
   - Implement request signing if required
4. Transform response to match `PronunciationResult` interface

### Phase 3: Frontend API Client (Day 3)
1. Create new API client `src/lib/speechsuper-api.ts`
   ```typescript
   export async function scorePronunciation(
     audioBlob: Blob,
     text: string
   ): Promise<PronunciationResult>
   ```
2. Keep same interface as speechace-api.ts
3. Update imports in PronunciationAssessment.tsx
4. No UI changes required ✅

### Phase 4: CEFR Mapping (Day 4)
Since SpeechSuper may not provide direct CEFR levels:
1. Research SpeechSuper's scoring scale
2. Implement mapping logic:
   ```typescript
   function mapScoreToCEFR(score: number): string {
     if (score >= 90) return "C2";
     if (score >= 80) return "C1";
     if (score >= 70) return "B2";
     if (score >= 60) return "B1";
     if (score >= 50) return "A2";
     return "A1";
   }
   ```
3. Validate mapping with sample data

### Phase 5: Testing (Day 5)
1. Unit tests for API client
2. Integration tests with edge function
3. End-to-end testing in onboarding flow
4. Performance benchmarking
5. Validate scoring accuracy with sample data

### Phase 6: Deployment & Cleanup (Day 6)
1. Deploy edge function to Supabase
2. Update environment variables
3. Deploy frontend changes
4. Delete Speechace edge function
5. Remove speechace-api.ts file
6. Clean up Speechace environment variables
7. Monitor error rates and performance

## Technical Considerations

### Audio Format
- **Current**: Browser MediaRecorder outputs WAV/WebM
- **SpeechSuper**: Accepts WAV, MP3, base64
- **Action**: May need format conversion in edge function

### Rate Limiting
- Research SpeechSuper rate limits
- Implement exponential backoff
- Add request queuing if needed

### Error Handling
- Map SpeechSuper error codes to user-friendly messages
- Implement fallback for API failures
- Add retry logic for transient failures

### Performance
- Target: < 5 seconds for analysis (same as current)
- Monitor API response times
- Consider caching for duplicate requests

### Cost Analysis
- Compare pricing: Speechace vs SpeechSuper
- Estimate monthly usage based on onboarding volume
- Factor in trial limitations

## Code Changes Required

### File Replacements
```typescript
// DELETE: src/lib/speechace-api.ts
// CREATE: src/lib/speechsuper-api.ts

// UPDATE: PronunciationAssessment.tsx
// Before
import { scorePronunciation } from '@/lib/speechace-api';

// After
import { scorePronunciation } from '@/lib/speechsuper-api';
```

### Edge Function Replacement
```typescript
// DELETE: edge-functions/speechace-score.ts (if exists)
// CREATE: edge-functions/speechsuper-score.ts
```

### Environment Variables
```bash
# REMOVE:
VITE_SPEECHACE_API_KEY

# ADD:
SPEECHSUPER_APP_KEY
SPEECHSUPER_SECRET_KEY
# (or whatever SpeechSuper requires)
```

### No UI Changes Needed
- PronunciationAssessment.tsx UI remains unchanged ✅
- Same PronunciationResult interface ✅
- Same user flow and experience ✅

## Risk Mitigation

### Risks
1. **API Response Differences**: SpeechSuper scoring scale may differ
2. **CEFR Accuracy**: Custom CEFR mapping may be less accurate
3. **Phoneme Coverage**: Different phoneme sets between services
4. **Documentation Gaps**: Limited public documentation

### Mitigation Strategies
1. Thorough testing with diverse audio samples
2. Validate CEFR mapping against known benchmarks
3. Comprehensive logging and monitoring
4. Staged deployment (dev → staging → production)
5. Clear rollback procedure documented

## Success Metrics

### Performance
- ✅ API response time < 5 seconds
- ✅ Error rate < 1%
- ✅ User completion rate maintained

### Quality
- ✅ Scoring consistency (compared to Speechace baseline)
- ✅ CEFR level accuracy validation
- ✅ User satisfaction (no complaints about assessment)

### Business
- ✅ Cost reduction (if applicable)
- ✅ Feature parity maintained
- ✅ No increase in support tickets

## Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Setup & Research | 1 day | API access |
| Backend Implementation | 2 days | Complete API docs |
| Frontend Client | 1 day | Backend complete |
| CEFR Mapping | 1 day | Scoring data |
| Testing | 1 day | All above |
| Deployment | 1 day | Testing passed |
| **Total** | **7 days** | |

## Next Steps

1. **Immediate**: 
   - [ ] Request SpeechSuper trial account
   - [ ] Access full API documentation
   - [ ] Set up development environment

2. **Short-term**:
   - [ ] Create proof-of-concept edge function
   - [ ] Test with sample audio files
   - [ ] Validate response structure

3. **Before Implementation**:
   - [ ] Get API credentials in production
   - [ ] Review pricing and confirm budget
   - [ ] Finalize CEFR mapping strategy
   - [ ] Prepare rollback procedure (re-deploy old code if needed)

## Files to Create/Update/Delete

### Create
- `edge-functions/speechsuper-score.ts` - New edge function
- `src/lib/speechsuper-api.ts` - New API client

### Update
- `src/pages/onboarding/PronunciationAssessment.tsx` - Update import only
- `.env` files - Update API keys

### Delete
- `src/lib/speechace-api.ts` - Remove old API client
- `edge-functions/speechace-score.ts` - Remove old edge function (if exists)
- Environment variable: `VITE_SPEECHACE_API_KEY`

## Documentation Updates Needed

- Update PRONUNCIATION_ASSESSMENT.md
- Create SpeechSuper integration guide
- Update environment variables documentation
- Add API error code reference

## Questions to Resolve

1. Does SpeechSuper provide CEFR levels directly, or do we need custom mapping?
2. What audio formats are supported? Any preprocessing required?
3. What are the exact rate limits and pricing tiers?
4. Is there an SDK/library we should use instead of raw HTTP?
5. How does scoring compare between services for the same audio?
6. Are there any geographic restrictions or latency considerations?

---

**Status**: ✅ **Implementation Complete - Bug Fixed**  
**Last Updated**: February 1, 2026  
**Owner**: Development Team

---

## Implementation Status Update

### ✅ Completed (Day 1)

1. **Edge Function Created**: `speechsuper-score.ts`
   - ~~Initial implementation with MD5 signatures~~ ❌ (incorrect)
   - **Fixed**: SHA-1 signatures with correct request format ✅
   
2. **API Client Created**: `ai-chat-app/src/lib/speechsuper-api.ts`
   - Maintains same interface as Speechace ✅
   - Calls new edge function ✅
   - Transforms response to expected format ✅

3. **Component Updated**: `PronunciationAssessment.tsx`
   - Import changed from `speechace-api` to `speechsuper-api` ✅
   - No UI changes required ✅

4. **Old Code Removed**: `speechace-api.ts` deleted ✅

### 🔧 Bug Fix - SpeechSuper API Integration

**Issue Discovered**: Initial implementation returned empty response from SpeechSuper API

**Root Cause Analysis**:
- ❌ Using base URL `https://api.speechsuper.com/` instead of full endpoint
- ❌ Using MD5 signatures instead of SHA-1
- ❌ Using URL query parameters instead of multipart form data
- ❌ Missing complex connect/start command structure required by SpeechSuper

**Solution Implemented**: Based implementation on working `pronunciation-submit-sentence-practice` function

**Fixed Implementation**:
- ✅ Correct endpoint: `https://api.speechsuper.com/sent.eval.promax`
- ✅ SHA-1 signature authentication:
  - `connectSig = sha1(appKey + timestamp + secretKey)`
  - `startSig = sha1(appKey + timestamp + userId + secretKey)`
- ✅ Complex JSON payload with `connect` and `start` commands
- ✅ Multipart form data: `text` (JSON payload) + `audio` (WAV file)
- ✅ Request-Index header: `'Request-Index': '0'`
- ✅ Proper error handling and response validation

**Key Code Structure**:
```typescript
// Authentication signatures
const connectSig = await sha1HexLower(`${appKey}${timestamp}${secretKey}`);
const startSig = await sha1HexLower(`${appKey}${timestamp}${userId}${secretKey}`);

// Request payload structure
const textPayload = {
  connect: {
    cmd: 'connect',
    param: {
      sdk: { version: 16777472, source: 9, protocol: 2 },
      app: { applicationId, timestamp, sig: connectSig }
    }
  },
  start: {
    cmd: 'start',
    param: {
      app: { userId, applicationId, timestamp, sig: startSig },
      audio: { audioType: 'wav', channel: 1, sampleBytes: 2, sampleRate: 16000 },
      request: {
        tokenId: `onboarding_${Date.now()}`,
        coreType: 'sent.eval.promax',
        refText: text,
        dict_type: 'IPA88',
        dict_dialect: 'en_us',
        phoneme_output: 1
      }
    }
  }
};

// Form data construction
const formData = new FormData();
formData.append('text', JSON.stringify(textPayload));
formData.append('audio', audioFile, 'recording.wav');

// API request
fetch(SPEECHSUPER_API_URL, {
  method: 'POST',
  headers: { 'Request-Index': '0' },
  body: formData
});
```

### 📋 Next Steps

1. **Deploy Edge Function**
   - [ ] Deploy `speechsuper-score.ts` to Supabase
   - [ ] Set environment variables in Supabase dashboard:
     - `SPEECHSUPER_APP_KEY`
     - `SPEECHSUPER_SECRET_KEY`

2. **Test End-to-End**
   - [ ] Test pronunciation assessment in onboarding flow
   - [ ] Verify scores and word-level feedback display
   - [ ] Test error handling with invalid audio
   - [ ] Verify CEFR level mapping

3. **Monitor Production**
   - [ ] Watch for API errors in Supabase logs
   - [ ] Check response times (should be < 5s)
   - [ ] Validate score accuracy with test users
   - [ ] Monitor SpeechSuper API usage/costs

### Files Changed

**Created**:
- ✅ `edge-functions/speechsuper-score.ts`
- ✅ `ai-chat-app/src/lib/speechsuper-api.ts`

**Modified**:
- ✅ `ai-chat-app/src/pages/onboarding/PronunciationAssessment.tsx`

**Deleted**:
- ✅ `ai-chat-app/src/lib/speechace-api.ts`

### Environment Variables Required

Remove:
- ~~`VITE_SPEECHACE_API_KEY`~~

Add to Supabase Edge Function Secrets:
- `SPEECHSUPER_APP_KEY` (from SpeechSuper dashboard)
- `SPEECHSUPER_SECRET_KEY` (from SpeechSuper dashboard)

---

**Migration Status**: Implementation complete, pending deployment and testing  
**Blockers**: None  
**Risk Level**: Low (based on working reference implementation)
