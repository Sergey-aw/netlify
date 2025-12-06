# Session Management with Supabase Auth

## Overview

This document explains how session management works in this application using Supabase Auth best practices.

## Architecture

### Session Storage

**Default Storage: localStorage** (recommended for SPAs)
- Access tokens and refresh tokens are automatically stored in browser localStorage
- Supabase client library handles all storage operations automatically
- No manual session management needed for basic use cases

### Session Components

1. **Access Token (JWT)**
   - Short-lived (~1 hour by default)
   - Contains user identity and claims
   - Automatically included in Supabase client API calls
   - Used for Row Level Security (RLS) policies

2. **Refresh Token**
   - Long-lived (effectively permanent until explicitly revoked)
   - Used to obtain new access/refresh token pairs
   - Single-use only (new refresh token issued on each refresh)
   - Automatically handled by Supabase client

### Session Flow

```
User Signs In
    ↓
Session Created (access + refresh tokens stored in localStorage)
    ↓
Access Token Expires (~1 hour)
    ↓
Client Auto-Refreshes Session (using refresh token)
    ↓
New Access + Refresh Tokens Stored
    ↓
onAuthStateChange fires with TOKEN_REFRESHED event
```

## Implementation

### 1. AuthContext Setup (✅ Current Implementation)

```typescript
// src/contexts/AuthContext.tsx
export function AuthProvider({ children }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Handle specific events
        if (event === 'SIGNED_OUT') {
          // Clean up app-specific data
          localStorage.removeItem('justai_onboarding_email');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);
}
```

### 2. Auth State Change Events

The `onAuthStateChange` listener will fire for these events:

- **INITIAL_SESSION**: First session check on page load
- **SIGNED_IN**: User signs in
- **SIGNED_OUT**: User signs out
- **TOKEN_REFRESHED**: Access token automatically refreshed
- **USER_UPDATED**: User metadata or profile changed
- **PASSWORD_RECOVERY**: Password reset initiated

### 3. Using Session in Components

```typescript
// Access user and session from context
const { user, session, loading } = useAuth();

// Check if user is anonymous
if (user?.is_anonymous) {
  // Handle anonymous user
}

// Use session for API calls
const accessToken = session?.access_token;
```

### 4. Making Authenticated API Calls

**Option A: Let Supabase client handle it (recommended)**
```typescript
// Supabase automatically includes access token
const { data, error } = await supabase
  .from('table')
  .select('*');
```

**Option B: Manual token passing (for custom APIs)**
```typescript
const { data: { session } } = await supabase.auth.getSession();
const accessToken = session?.access_token;

const response = await fetch('/api/endpoint', {
  headers: {
    'Authorization': `Bearer ${accessToken}`,
  },
});
```

## Best Practices

### ✅ DO

1. **Register onAuthStateChange Early**
   - Set up listener as early as possible in app lifecycle
   - Preferably in root component or context provider

2. **Use Context for Session State**
   - Share session state across components via React Context
   - Avoids multiple `getSession()` calls

3. **Handle Anonymous Users**
   - Check `user.is_anonymous` flag
   - Anonymous users have valid sessions but need email verification for full access

4. **Clean Up on Sign Out**
   ```typescript
   if (event === 'SIGNED_OUT') {
     // Clear app-specific localStorage
     localStorage.removeItem('app_specific_data');
   }
   ```

5. **Use getSession() for Current State**
   ```typescript
   // Good: Check current session state
   const { data: { session } } = await supabase.auth.getSession();
   ```

6. **Use getUser() for Validation**
   ```typescript
   // Validates JWT and checks if session is still valid
   const { data: { user }, error } = await supabase.auth.getUser();
   if (error) {
     // Session is invalid
   }
   ```

### ❌ DON'T

1. **Don't Store Tokens Manually**
   - Let Supabase client handle storage
   - Don't copy tokens to other storage locations

2. **Don't Use Short JWT Expiration**
   - Keep default 1 hour expiration
   - Values below 5 minutes cause issues

3. **Don't Call getSession() Repeatedly**
   - Use AuthContext to share state
   - Avoid calling in every component

4. **Don't Use localStorage.getItem() for Tokens**
   - Use Supabase client methods
   - Direct localStorage access bypasses token refresh logic

5. **Don't Ignore onAuthStateChange Events**
   - Always handle SIGNED_OUT
   - Log events in development for debugging

## Anonymous Users

### Flow for This Application

```
1. User visits welcome screens (no auth)
2. User enters email
3. signInAnonymously() creates temporary session
4. User completes onboarding
5. User can subscribe with anonymous session
6. Email verification converts anonymous → permanent user
```

### Anonymous User Properties

```typescript
{
  id: "uuid",
  is_anonymous: true,
  email: undefined, // No email on auth.users
  user_metadata: {},
  app_metadata: { provider: "email", providers: ["email"] }
}
```

### Converting Anonymous to Permanent

```typescript
// Link email to anonymous user
const { error } = await supabase.auth.updateUser({
  email: 'user@example.com',
});

// Or use linkIdentity (if supported)
```

## Debugging Session Issues

### Enable Debug Logging

```typescript
supabase.auth.onAuthStateChange((event, session) => {
  console.log('Auth Event:', event);
  console.log('Session:', {
    hasSession: !!session,
    userId: session?.user?.id,
    isAnonymous: session?.user?.is_anonymous,
    expiresAt: session?.expires_at,
  });
});
```

### Common Issues

**Issue: "Session expired" errors**
- Check `session.expires_at` timestamp
- Verify `onAuthStateChange` is registered early
- Check for bugs in the listener callback

**Issue: Session not persisting across page reloads**
- Ensure localStorage is enabled
- Check browser privacy settings
- Verify Supabase client is initialized correctly

**Issue: "Unauthorized" from Edge Functions**
- Check if access token is being sent
- Verify Edge Function receives Authorization header
- Check if user exists in database

## Server-Side Rendering (Future Consideration)

If migrating to SSR (Next.js, SvelteKit, etc.):

1. **Install @supabase/ssr package**
   ```bash
   npm install @supabase/ssr
   ```

2. **Use Cookie Storage**
   - Cookies shared between client and server
   - Requires custom storage adapter

3. **Use PKCE Flow**
   - More secure for SSR environments
   - Requires code exchange on callback

4. **Example:**
   ```typescript
   import { createServerClient } from '@supabase/ssr';
   
   const supabase = createServerClient(url, key, {
     cookies: {
       getAll: () => parseCookieHeader(req.headers.cookie),
       setAll: (cookies) => cookies.forEach(c => res.cookie(c.name, c.value))
     }
   });
   ```

## Security Considerations

1. **Access Tokens Are Public**
   - JWTs can be decoded by anyone
   - Don't store sensitive data in user_metadata
   - Use app_metadata for admin-only data

2. **Refresh Tokens Are Sensitive**
   - Never expose in logs
   - Single-use only
   - Revoked on reuse detection

3. **RLS Policies**
   - Use `auth.uid()` in policies
   - Check `session_id` for strict validation
   - Test policies thoroughly

4. **Session Validation**
   ```sql
   -- Check if session is still active
   SELECT EXISTS(
     SELECT 1 FROM auth.sessions 
     WHERE id = auth.jwt()->>'session_id'
   );
   ```

## Monitoring

### Track Session Events

```typescript
supabase.auth.onAuthStateChange((event, session) => {
  // Send to analytics
  if (event === 'SIGNED_IN') {
    analytics.track('User Signed In', {
      userId: session?.user?.id,
      isAnonymous: session?.user?.is_anonymous,
    });
  }
  
  if (event === 'TOKEN_REFRESHED') {
    console.log('Token refreshed at:', new Date().toISOString());
  }
});
```

## Resources

- [Supabase Auth Sessions Docs](https://supabase.com/docs/guides/auth/sessions)
- [onAuthStateChange Reference](https://supabase.com/docs/reference/javascript/auth-onauthstatechange)
- [Anonymous Sign-In](https://supabase.com/docs/reference/javascript/auth-signinanonymously)
- [Server-Side Auth](https://supabase.com/docs/guides/auth/server-side)
