# Conversation Suggestions Edge Function Deployment

## Issue
The "Help me answer" button was causing CORS errors because it was calling OpenAI API directly from the browser. OpenAI doesn't allow browser-side API calls for security reasons.

## Solution
Created a Supabase Edge Function `get-conversation-suggestions` that proxies OpenAI API calls server-side.

## Files Changed
1. **Created**: `edge-functions/get-conversation-suggestions.ts` - New edge function to handle OpenAI API calls
2. **Modified**: `ai-chat-app/src/lib/justai-api.ts` - Updated `getConversationSuggestions()` to call the edge function instead of OpenAI directly

## Deployment Steps

### 1. Deploy the Edge Function

Copy the edge function to your Supabase project:

```bash
# Copy the edge function
cp edge-functions/get-conversation-suggestions.ts supabase/functions/get-conversation-suggestions/index.ts

# Deploy to Supabase
supabase functions deploy get-conversation-suggestions
```

### 2. Set Required Environment Variable

In your Supabase Dashboard, set the following secret:

```bash
supabase secrets set OPENAI_API_KEY=your_openai_api_key_here
```

Or via CLI:
```bash
echo "OPENAI_API_KEY=your_openai_api_key_here" | supabase secrets set --env-file /dev/stdin
```

### 3. Verify Deployment

Test the function:
```bash
curl -i --location --request POST 'https://[YOUR_PROJECT_REF].supabase.co/functions/v1/get-conversation-suggestions' \
  --header 'Authorization: Bearer [YOUR_ANON_KEY]' \
  --header 'Content-Type: application/json' \
  --data '{"transcript":[{"speaker":"student","text":"Hello"}],"vocabularyWords":[]}'
```

### 4. Deploy Frontend

The frontend changes are already in `ai-chat-app/src/lib/justai-api.ts`. Just deploy as usual:

```bash
cd ai-chat-app
npm run build
# Deploy to Vercel/Netlify/etc.
```

## Security Improvements

✅ **API Key Protection**: OpenAI API key is now stored server-side only
✅ **CORS Resolved**: No more browser-side API calls to OpenAI
✅ **Authentication**: Edge function verifies user authentication before processing requests

## Testing

1. Start a voice conversation in the app
2. Click the "Help me answer" button during the conversation
3. Verify that suggestions appear without CORS errors
4. Check browser console - should see no CORS errors
5. Check Supabase Edge Function logs for successful requests

## Notes

- The edge function limits suggestions to the last 10 transcript messages to keep context relevant
- Maximum 3 suggestions are returned
- The function uses GPT-4o-mini model for cost efficiency
- User authentication is required to use this endpoint
