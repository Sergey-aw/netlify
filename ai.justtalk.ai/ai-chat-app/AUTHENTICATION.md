# Authentication System

This app uses **email/password authentication** with Supabase Auth, allowing users to complete onboarding before verifying their email.

## User Flow

### New Users
1. User opens app → redirects to `/welcome` (first welcome screen)
2. User navigates through 3 welcome screens (Progress → Features → Sync)
3. After welcome screens, user is directed to `/login`
4. User enters email → account created with temporary password, verification email sent
5. User can immediately continue to `/onboarding/goals` (doesn't need to wait for email)
6. User completes onboarding steps (Goals → Interests → Preferences)
7. All onboarding data is saved to **localStorage**
8. After onboarding, user is redirected to `/subscription/plans` (paywall)
9. Meanwhile, user receives email with link to `/auth/setup-password`
10. User clicks link, sets up name and password
11. Profile is created/updated in `profiles` table
12. After password setup, user is redirected to subscription plans

### Returning Users
1. User opens app → AuthContext checks session
2. If authenticated and has subscription → redirect to `/ai-chat`
3. If authenticated but no subscription → redirect to `/subscription/plans`
4. If not authenticated → redirect to `/login`

## Key Components

### AuthContext (`src/contexts/AuthContext.tsx`)
- Manages user session state
- Listens to auth changes via `supabase.auth.onAuthStateChange()`
- Provides `user`, `loading`, and `signOut` to all components

### ProtectedRoute (`src/components/ProtectedRoute.tsx`)
- Wraps protected pages that require full authentication
- Redirects to `/login` if user is not authenticated
- Shows loading spinner while checking auth state

### Pages

#### `/welcome` - Welcome Screens
- Three screens introducing JustAI features
- No authentication required
- Navigates to `/login` at the end

#### `/login` - Sign Up Page
- Email input only
- Calls `supabase.auth.signUp()` with temporary password
- Sends verification email with link to set up password
- Immediately redirects to `/onboarding/goals` (user can continue without waiting)

#### `/auth/setup-password` - Password Setup
- User arrives here from email verification link
- Exchanges code for session
- Collects name and password
- Creates profile in database
- Redirects to subscription plans

#### `/onboarding/*` - Onboarding Pages
- Accessible without full authentication
- Saves all progress to **localStorage** (not database)
- After completion, redirects to `/subscription/plans`
- Data is only saved to database when user sets up password

#### `/subscription/plans` - Paywall
- First screen after onboarding
- Shows subscription options
- Can be accessed without authentication (shows plans)
- After subscribing, user can access main app

## Database Schema

### `profiles` table
```sql
- id (uuid) - FK to auth.users.id
- full_name (text)
- justai_onboarding_completed (boolean) - default false
- justai_preferred_voice (text)
- justai_correction_style (text) - 'gentle'|'balanced'|'strict'
- learning_goals (text[])
- interests (text[])
- cefr_level (text)
- native_language (text)
- country (text)
```

### `justai_agent_configs` table
- Created after onboarding completion (when user sets up password)
- Contains learning preferences and goals

## Environment Variables

Required in `.env`:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key
```

## Email Configuration

Verification email redirects to:
```
${window.location.origin}/auth/setup-password
```

**IMPORTANT: Configure Supabase redirect URLs**

Make sure this URL is added to Supabase Auth allowed redirect URLs:

1. Go to your Supabase Dashboard
2. Navigate to **Authentication → URL Configuration**
3. Under **Redirect URLs**, add:
   - Development: `http://localhost:5173/auth/setup-password`
   - Development (alt port): `http://localhost:5174/auth/setup-password`
   - Production: `https://yourdomain.com/auth/setup-password`

4. Under **Site URL**, set:
   - Development: `http://localhost:5173`
   - Production: `https://yourdomain.com`

5. **Email Template Configuration**:
   - Go to Authentication → Email Templates
   - Select "Confirm signup" template
   - Ensure the link uses: `{{ .ConfirmationURL }}`
   - The redirect should automatically append to this URL

**Troubleshooting Email Links:**
- If links show a different domain, check your Site URL setting
- If you get "Invalid link", verify the redirect URL is in the allowed list
- The email link will use either `?code=` or `?token_hash=` format
- Both formats are now supported in the setup-password page

## LocalStorage Keys

- `justai_onboarding_data` - Stores goals, interests, and preferences
- `justai_onboarding_email` - Stores user's email during signup
- `justai_onboarding_preferences` - Stores CEFR level and correction style

## Testing the Flow

1. Clear localStorage: `localStorage.clear()`
2. Clear Supabase session: `supabase.auth.signOut()`
3. Navigate to `/` - should redirect to `/welcome`
4. Complete welcome screens
5. Enter email at signup - account created, verification email sent
6. Complete onboarding (data saved to localStorage)
7. Redirected to subscription plans
8. Check email for "Set up your password" link
9. Click link, set name and password
10. Profile created, onboarding data transferred from localStorage to database
11. Redirected to subscription plans (or main app if already subscribed)
