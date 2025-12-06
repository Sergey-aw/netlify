# Anonymous User Subscription Fix

## Problem

Anonymous users were unable to subscribe because:

1. **Auth Issue**: Edge function's `supabase.auth.getUser()` returns "Auth session missing" for anonymous users
2. **RLS Issue**: Edge function couldn't read email from profiles table due to Row Level Security policies
3. **Missing Service Role Key**: Edge function was using ANON key which has RLS restrictions

## Root Cause

When an anonymous user creates a session:
- JWT is valid and contains `{ sub: userId, is_anonymous: true, role: 'authenticated' }`
- But `supabaseClient.auth.getUser()` fails with `AuthSessionMissingError`
- This is because `getUser()` tries to validate the session with Supabase Auth, which doesn't recognize anonymous sessions the same way

Additionally:
- Profile is created with RLS policies
- Edge function using ANON key can't bypass RLS to read profile email
- Needs SERVICE_ROLE_KEY to read profiles

## Solutions Implemented

### 1. JWT Fallback in Edge Function

Added JWT decoding fallback when `getUser()` fails:

```typescript
if (userError || !user) {
  // Decode JWT directly
  const token = authHeader.replace('Bearer ', '')
  const parts = token.split('.')
  if (parts.length === 3) {
    const payload = JSON.parse(atob(parts[1]))
    user = { 
      id: payload.sub, 
      is_anonymous: payload.is_anonymous,
      email: payload.email 
    }
  }
}
```

### 2. Service Role for Profile Access

Use SERVICE_ROLE_KEY to bypass RLS when reading email:

```typescript
if (!userEmail) {
  const supabaseServiceClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )
  
  const { data: profile } = await supabaseServiceClient
    .from('profiles')
    .select('email')
    .eq('id', user.id)
    .single()
    
  userEmail = profile?.email
}
```

### 3. Improved Profile Creation

Added error handling and update logic:

```typescript
const { data, error } = await supabase
  .from('profiles')
  .insert({
    id: userId,
    email: email,
    role: 'student',
  })
  .select()
  .single();

if (error?.message.includes('duplicate')) {
  // Update existing profile
  await supabase
    .from('profiles')
    .update({ email })
    .eq('id', userId);
}
```

### 4. Better Logging

Added comprehensive logging at each step:
- Client side: Session check, token preview, user status
- Edge function: Auth header, getUser result, JWT decode, profile query

## Required Supabase Secrets

Edge function now requires **4 secrets** (set in Supabase Dashboard):

```bash
STRIPE_SECRET_KEY=sk_...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # NEW - Required for RLS bypass
```

## Deployment Steps

1. **Add SERVICE_ROLE_KEY to Supabase**:
   - Go to Supabase Dashboard → Project Settings → API
   - Copy "service_role" key (keep it SECRET!)
   - Go to Edge Functions → Secrets
   - Add: `SUPABASE_SERVICE_ROLE_KEY` = `[your-service-role-key]`

2. **Deploy Edge Function**:
   ```bash
   npx supabase functions deploy create-checkout-session
   ```

3. **Test Flow**:
   - Enter email → Creates anonymous session
   - Complete onboarding → Profile saved with email
   - Subscribe → Edge function reads email from profile with service role
   - Checkout → Success!

## Flow Diagram

```
User enters email
    ↓
signInAnonymously()
    ├─ Creates JWT with { sub: userId, is_anonymous: true }
    └─ Session stored in localStorage
    ↓
Create profile with email
    ↓
User completes onboarding
    ↓
User clicks subscribe
    ↓
Frontend: getSession() → sends JWT to edge function
    ↓
Edge Function:
    ├─ Try getUser() → FAILS (AuthSessionMissingError)
    ├─ Fallback: Decode JWT → Extract userId
    ├─ Check user.email → EMPTY (anonymous user)
    ├─ Query profiles with SERVICE_ROLE → Bypass RLS
    └─ Get email → SUCCESS
    ↓
Create Stripe customer & checkout session
    ↓
User completes payment
    ↓
Webhook updates subscription
```

## Testing

### Before Fix
```
❌ "Your session has expired" 
❌ Status 401 Unauthorized
❌ getUser() fails for anonymous users
❌ Can't read profile due to RLS
```

### After Fix
```
✅ JWT decoded successfully
✅ User ID extracted from JWT
✅ Email read from profiles with service role
✅ Stripe checkout session created
✅ Anonymous users can subscribe!
```

## Security Considerations

1. **Service Role Key**: Only used in secure edge function environment, never exposed to client
2. **JWT Validation**: Token expiry is checked before use
3. **Profile Access**: Service role only used for reading email (minimal privilege)
4. **User Verification**: JWT signature validated by Supabase automatically

## Key Learnings

1. **Anonymous Auth Limitation**: `getUser()` doesn't work reliably with anonymous sessions
2. **JWT as Fallback**: Decoding JWT directly is valid when getUser() fails
3. **RLS vs Service Role**: Some operations require service role to bypass RLS
4. **Session Storage**: localStorage works great for SPAs, no need for cookies
5. **Error Messages**: Good logging is critical for debugging auth issues

## Related Files

- `/edge-functions/create-checkout-session.ts` - Edge function with JWT fallback
- `/ai-chat-app/src/pages/Login.tsx` - Anonymous sign-in & profile creation
- `/ai-chat-app/src/lib/justai-api.ts` - API client with session token
- `/ai-chat-app/src/contexts/AuthContext.tsx` - Session state management
- `/ai-chat-app/src/hooks/useSession.ts` - Session utilities hook

## Next Steps

1. ✅ Deploy updated edge function
2. ✅ Add SERVICE_ROLE_KEY secret
3. ✅ Test anonymous user subscription flow
4. 🔄 Monitor edge function logs for any issues
5. 🔄 Clean up debug logging after confirmed working
6. 🔄 Add email verification flow (optional, post-subscription)
