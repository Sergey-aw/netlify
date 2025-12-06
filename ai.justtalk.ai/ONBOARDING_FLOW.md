# Enhanced Onboarding and Auth Flow

## Overview
Comprehensive onboarding state management system that tracks user progress through signup, onboarding steps, and subscription purchase. Users can leave and resume where they left off.

## Key Features

### 1. **Persistent Onboarding State**
- Tracks current step in localStorage
- Stores email, subscription status, and completion flags
- Auto-expires after 7 days
- Resumes user at last position on return

### 2. **Multi-Step Flow**
```
Email Entry → Goals → Interests → Preferences → Subscription → Email Verification → App
```

### 3. **Auth Options**
- **New Users**: Anonymous signup with email collection → Complete onboarding → Subscribe
- **Returning Users**: Sign in with email/password at `/signin`
- **Magic Link**: Option to receive sign-in link via email

### 4. **Email Verification**
After subscribing, users see:
- Current email address
- Instructions to check email
- Resend verification button
- Alternative: Sign in with password link

## File Structure

### New Files Created

#### `/src/lib/onboarding-state.ts`
Centralized onboarding state management:
- `getOnboardingState()` - Read state from localStorage
- `saveOnboardingState()` - Update state
- `updateOnboardingStep()` - Track progression
- `markOnboardingComplete()` - Mark step 3 complete
- `markSubscriptionActive()` - Track subscription purchase
- `shouldResumeOnboarding()` - Check if resume needed
- `getResumeRoute()` - Calculate resume destination

**State Schema:**
```typescript
{
  currentStep: 'email-entry' | 'onboarding-goals' | ... | 'completed',
  email: string | null,
  hasCompletedOnboarding: boolean,
  hasActiveSubscription: boolean,
  userId: string | null,
  lastUpdated: number
}
```

#### `/src/pages/EmailVerification.tsx`
Post-subscription page showing:
- User's email address
- Verification instructions
- Resend email button
- Link to password sign-in

#### `/src/pages/SignIn.tsx`
Full-featured sign-in page:
- Email + password authentication
- Magic link option (passwordless)
- Link to signup page
- Error handling

#### `/src/components/OnboardingResumeHandler.tsx`
Auto-resume logic component:
- Runs once on app load
- Checks onboarding state
- Redirects to appropriate step
- Uses sessionStorage to prevent loops

#### `/src/hooks/useOnboardingResume.ts`
*(Optional - created but not actively used)*
Hook version of resume logic for manual control

## Updated Files

### `/src/pages/Login.tsx`
- Saves onboarding state on signup
- Links to `/signin` for existing users
- Tracks email-entry step

### `/src/pages/onboarding/OnboardingGoals.tsx`
- Updates state to `onboarding-interests`
- Preserves goal selections

### `/src/pages/onboarding/OnboardingInterests.tsx`
- Updates state to `onboarding-preferences`
- Preserves interest selections

### `/src/pages/onboarding/OnboardingPreferences.tsx`
- Calls `markOnboardingComplete()`
- Redirects to `/subscription-plans`
- Fixed route (was `/subscription/plans`)

### `/src/pages/SubscriptionPlans.tsx`
- Tracks `subscription-payment` step when checkout starts
- Imported `updateOnboardingStep`

### `/src/pages/SubscriptionManagement.tsx`
- Calls `markSubscriptionActive()` when subscription confirmed
- Uses `useSubscription` hook

### `/src/App.tsx`
- Added `/signin` route
- Added `/email-verification` route
- Integrated `<OnboardingResumeHandler />`
- Positioned before `<Routes>` but inside `<BrowserRouter>`

## User Journey Examples

### New User - Full Flow
1. Visit `/login` → Enter email → Anonymous account created
2. Save state: `{ currentStep: 'onboarding-goals', email: 'user@example.com', ... }`
3. Complete onboarding steps (each updates state)
4. Choose subscription plan → State: `subscription-payment`
5. Complete Stripe payment → Webhook marks subscription active
6. Redirect to `/email-verification` → State: `hasActiveSubscription: true`
7. Click verification link in email → Full access granted

### Returning User - Resume
1. User closed browser at onboarding step 2
2. Returns to site, visits any page
3. `OnboardingResumeHandler` checks localStorage
4. Finds `currentStep: 'onboarding-interests'`
5. Auto-redirects to `/onboarding/interests`
6. User continues from where they left off

### Existing User - Direct Sign In
1. User visits `/signin` (or clicks link from `/login`)
2. Enters email + password → Signs in
3. No onboarding state → Goes to `/ai-chat`
4. Full app access

### Completed But Not Verified
1. User completed onboarding + subscribed
2. State: `{ hasCompletedOnboarding: true, hasActiveSubscription: true }`
3. Returns to site → Redirected to `/email-verification`
4. Can use app but encouraged to verify email

## Integration Points

### Subscription Hook
The existing `useSubscription` hook tracks:
- `hasActiveSubscription` - Boolean
- `subscription` - Full subscription object
- `messagesRemaining` - Usage tracking

When subscription becomes active:
1. Webhook updates database
2. `useSubscription` detects change
3. Components call `markSubscriptionActive()`
4. State updated, user redirected appropriately

### Auth Context
Works with existing `useSession` hook:
- `isAuthenticated` - Checks valid session
- `isAnonymous` - Detects anonymous users
- `user` - Current user object

Anonymous users have full access to:
- Onboarding pages
- Subscription purchase
- App features (if subscribed)

## Configuration

### LocalStorage Keys
- `justai_onboarding_state` - Main state object
- `justai_pending_email` - Email during signup
- `justai_onboarding_data` - Onboarding selections (goals, interests, preferences)
- `justai_onboarding_preferences` - CEFR level, correction style

### SessionStorage Keys
- `justai_onboarding_checked` - Prevents resume loops (cleared on page refresh)

### State Expiration
- Onboarding state expires after 7 days
- Prevents stale data from affecting UX
- User must re-signup if returning after expiration

## Testing Checklist

- [ ] New user signup → Complete onboarding → Subscribe
- [ ] Close browser mid-onboarding → Return → Resume at correct step
- [ ] Complete onboarding → Subscribe → See email verification page
- [ ] Existing user → Visit `/signin` → Sign in with password
- [ ] Anonymous user → Subscribe → Verify subscription works
- [ ] Return after 7 days → State expired → Start fresh
- [ ] Click resend verification email → Receive new email
- [ ] Use magic link sign-in → Redirect to app

## Next Steps

1. **Deploy edge functions** with updated webhook handler
2. **Test full flow** with real Stripe checkout
3. **Add analytics** to track drop-off points
4. **Implement email verification** backend handling
5. **Add password reset** flow
6. **Consider social auth** (Google, Apple) for easier signup
7. **Add onboarding progress UI** showing "2 of 3 steps complete"
8. **Implement skip option** for some onboarding steps

## Notes

- Onboarding state is **client-side only** (localStorage)
- Database has canonical source of truth (profile, subscription tables)
- Resume logic only runs once per session to avoid redirect loops
- Anonymous users can use full app if subscribed
- Email verification is **optional** but encouraged
- Users can bypass verification by signing in with password directly
