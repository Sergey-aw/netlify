# Session Management Quick Reference

## 🚀 Quick Start

### Use the Session Hook
```typescript
import { useSession } from '@/hooks/useSession';

function MyComponent() {
  const { user, isAuthenticated, isAnonymous, getAccessToken } = useSession();
  
  if (!isAuthenticated) {
    return <div>Please sign in</div>;
  }
  
  return <div>Hello {user?.email || 'Anonymous User'}</div>;
}
```

## 📋 Common Patterns

### Check Authentication
```typescript
const { isAuthenticated, isAnonymous } = useSession();

if (!isAuthenticated) {
  // No session at all - redirect to login
  navigate('/login');
}

if (isAnonymous) {
  // User is signed in but hasn't verified email
  // They can still use the app and subscribe
}
```

### Get Access Token for API Calls
```typescript
const { getAccessToken } = useSession();

async function callAPI() {
  const token = getAccessToken();
  
  if (!token) {
    throw new Error('Not authenticated');
  }
  
  const response = await fetch('/api/endpoint', {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
}
```

### Get User Email (handles anonymous users)
```typescript
const { getEmail } = useSession();

const email = await getEmail();
// Returns: user.email OR profile.email OR localStorage email
```

### Check Session Expiry
```typescript
const { isSessionExpiringSoon } = useSession();

if (isSessionExpiringSoon()) {
  console.warn('Session expires in < 5 minutes');
  // Optionally show a warning to user
}
```

### Manual Session Refresh (rarely needed)
```typescript
const { refreshSession } = useSession();

const newSession = await refreshSession();
```

## 🔍 Debugging

### Enable Session Logging
Already enabled in `AuthContext.tsx`:
```typescript
supabase.auth.onAuthStateChange((event, session) => {
  console.log('Auth state changed:', event, {
    hasSession: !!session,
    isAnonymous: session?.user?.is_anonymous,
    userId: session?.user?.id,
  });
});
```

### Check Current Session in Console
```javascript
// In browser console
const { data } = await supabase.auth.getSession();
console.log(data.session);

// Check user
const { data: userData } = await supabase.auth.getUser();
console.log(userData.user);
```

### Inspect LocalStorage
```javascript
// In browser console
Object.keys(localStorage).filter(k => k.includes('supabase'));
```

## ⚠️ Common Issues

### Issue: "Session expired" error
**Cause:** Session was not properly persisted or `onAuthStateChange` not registered early enough

**Fix:**
```typescript
// Make sure AuthProvider wraps entire app
<AuthProvider>
  <App />
</AuthProvider>
```

### Issue: Session doesn't persist on reload
**Cause:** localStorage blocked or cleared

**Fix:**
1. Check browser privacy settings
2. Verify localStorage is enabled
3. Check for incognito/private mode

### Issue: "Unauthorized" from Edge Functions
**Cause:** Access token not sent or invalid

**Fix:**
```typescript
// Use getAccessToken() from useSession hook
const token = getAccessToken();
console.log('Token:', token ? `${token.substring(0, 20)}...` : 'MISSING');
```

### Issue: Multiple getSession() calls
**Cause:** Not using session from context

**Fix:**
```typescript
// ❌ Don't do this
const { data: { session } } = await supabase.auth.getSession();

// ✅ Do this instead
const { session } = useSession();
```

## 📊 Session Events

| Event | When | Action |
|-------|------|--------|
| `INITIAL_SESSION` | App loads | Load user state |
| `SIGNED_IN` | User signs in | Update UI, redirect |
| `SIGNED_OUT` | User signs out | Clear data, redirect to login |
| `TOKEN_REFRESHED` | ~55 min after sign in | Session auto-renewed |
| `USER_UPDATED` | Email verified / Profile updated | Refresh user data |
| `PASSWORD_RECOVERY` | Password reset link clicked | Show reset form |

## 🔒 Security Best Practices

### ✅ DO
- Use `useSession()` hook for all session access
- Check `isAuthenticated` before protected actions
- Let Supabase handle token refresh automatically
- Store session in default localStorage
- Use access token for API authentication

### ❌ DON'T
- Don't store tokens manually in state or localStorage
- Don't copy tokens to other storage locations
- Don't disable auto token refresh
- Don't use HTTP-only cookies (unless SSR)
- Don't call `getSession()` repeatedly

## 🎯 Decision Tree

```
Need to check if user is logged in?
├─ Yes → Use `isAuthenticated` from useSession()
└─ No → Continue

Need to get user info?
├─ Basic info → Use `user` from useSession()
└─ With validation → Use `supabase.auth.getUser()`

Need to call API with auth?
├─ Supabase API → Let client handle automatically
└─ Custom API → Use `getAccessToken()` from useSession()

Need to handle anonymous users?
├─ Check status → Use `isAnonymous` from useSession()
└─ Get email → Use `getEmail()` from useSession()

Need to sign out?
└─ Use `signOut()` from useAuth() context
```

## 📚 More Info

- Full docs: [SESSION_MANAGEMENT.md](./SESSION_MANAGEMENT.md)
- Changes made: [SESSION_IMPROVEMENTS.md](./SESSION_IMPROVEMENTS.md)
- Supabase docs: https://supabase.com/docs/guides/auth/sessions
