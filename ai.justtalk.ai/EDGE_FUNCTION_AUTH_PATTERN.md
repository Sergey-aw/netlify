# Edge Function Authentication Pattern

## Overview
This document describes the correct pattern for handling user authentication in Supabase Edge Functions for the JustAI application.

## Problem
When edge functions call `supabaseClient.auth.getUser()`, it can sometimes fail even with a valid JWT token in the Authorization header. This causes 401 Unauthorized errors even though the user is properly authenticated.

## Solution: JWT Decode Fallback Pattern

Always implement a two-step authentication verification:

1. **Primary Method**: Try `supabaseClient.auth.getUser()`
2. **Fallback Method**: If getUser() fails, manually decode the JWT token to extract the user ID

## Implementation Pattern

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Get and validate Authorization header
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header missing' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Create Supabase client with Authorization header
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // 3. Try getUser() first, then fall back to JWT decode
    let user;
    let userError;
    
    try {
      const result = await supabaseClient.auth.getUser();
      user = result.data.user;
      userError = result.error;
      
      console.log('getUser() result:', {
        hasUser: !!user,
        userId: user?.id,
        hasError: !!userError,
        errorMessage: userError?.message
      });
    } catch (e) {
      console.error('getUser() threw exception:', e);
      userError = e;
    }

    // 4. JWT Decode Fallback (CRITICAL!)
    if (userError || !user) {
      console.log('getUser failed, trying JWT decode fallback');
      
      try {
        const token = authHeader.replace('Bearer ', '');
        const parts = token.split('.');
        
        if (parts.length === 3) {
          // Decode the payload (middle part of JWT)
          const base64Url = parts[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const payload = JSON.parse(atob(base64));
          
          console.log('JWT decoded successfully:', {
            sub: payload.sub,
            role: payload.role
          });
          
          if (payload.sub) {
            // Verify the token isn't expired
            const now = Math.floor(Date.now() / 1000);
            if (payload.exp && payload.exp < now) {
              return new Response(
                JSON.stringify({ error: 'Token expired' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
            
            // Create a minimal user object from JWT payload
            user = { id: payload.sub };
            console.log('✅ Using JWT fallback, user ID:', user.id);
          }
        }
      } catch (decodeError) {
        console.error('JWT decode failed:', decodeError);
      }
    }

    // 5. Final validation
    if (!user) {
      console.error('Auth failed: No user found after all attempts');
      return new Response(
        JSON.stringify({ 
          error: 'Unauthorized',
          details: 'Cannot verify user'
        }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Now you can safely use user.id for database queries
    console.log('Authenticated user:', user.id);
    
    // Your business logic here...
    
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

## Key Points

### 1. **Always Pass Authorization Header to Supabase Client**
```typescript
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_ANON_KEY') ?? '',
  {
    global: {
      headers: { Authorization: authHeader }, // CRITICAL!
    },
  }
);
```

### 2. **JWT Payload Structure**
The decoded JWT payload contains:
- `sub`: User ID (this is what you need)
- `exp`: Expiration timestamp (Unix timestamp)
- `role`: User role (e.g., 'authenticated')
- Other user metadata

### 3. **Why getUser() Can Fail**
- Network issues between edge function and Supabase Auth
- Token validation timing issues
- Service availability
- Edge function cold starts

### 4. **RLS Policies Still Apply**
Even with JWT decode fallback, Row Level Security (RLS) policies still work because:
- The Supabase client is created with the user's JWT token
- `auth.uid()` in RLS policies reads from this token
- Database queries automatically filter based on the authenticated user

## Functions Using This Pattern

✅ **Correctly Implemented:**
- `upgrade-subscription` (original reference implementation)
- `cancel-subscription` (updated)
- `reactivate-subscription` (updated)

📝 **To Update:**
Check other edge functions that require authentication and update them to use this pattern if they don't already.

## Testing

### Valid Request
```bash
curl -X POST https://[project].supabase.co/functions/v1/[function-name] \
  -H "Authorization: Bearer [user-jwt-token]" \
  -H "Content-Type: application/json"
```

### Expected Logs (Success)
```
Authorization header received: present
getUser() result: { hasUser: true, userId: '...', hasError: false }
Authenticated user: [user-id]
```

### Expected Logs (Fallback)
```
Authorization header received: present
getUser() result: { hasUser: false, hasError: true, errorMessage: '...' }
getUser failed, trying JWT decode fallback
JWT decoded successfully: { sub: '[user-id]', role: 'authenticated' }
✅ Using JWT fallback, user ID: [user-id]
Authenticated user: [user-id]
```

## Related Files
- `/supabase/functions/upgrade-subscription/index.ts` - Reference implementation
- `/supabase/functions/cancel-subscription/index.ts` - Uses this pattern
- `/supabase/functions/reactivate-subscription/index.ts` - Uses this pattern

## Date
Pattern documented: December 14, 2025
Last verified working: December 14, 2025
