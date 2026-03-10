# JustTalk AI → Native Swift App: Migration Analysis & Plan

## Executive Summary

The current app is a **React/TypeScript PWA** (Progressive Web App) built with Vite, deployed on Vercel, backed by Supabase (PostgreSQL + Edge Functions) and ElevenLabs for real-time voice AI. Migrating to native Swift (iOS) is a significant but well-structured undertaking. The backend (Supabase Edge Functions, database, ElevenLabs) remains **100% reusable** — only the frontend layer changes.

### 🎉 Major Update: ElevenLabs Official Swift SDK

**ElevenLabs now provides an official Swift SDK** (`elevenlabs-swift-sdk`) for Conversational AI, which dramatically simplifies the migration:

- **Repository**: https://github.com/elevenlabs/elevenlabs-swift-sdk
- **Starter Kit**: https://github.com/elevenlabs/voice-starterkit-swift
- **UI Components**: https://github.com/elevenlabs/components-swift
- **Features**:
  - Ultra-low latency via LiveKit WebRTC
  - Full Swift Concurrency support (Async/Await)
  - SwiftUI observation for reactive UI
  - Client Tools and MCP support
  - Built-in audio visualization components (OrbVisualizer)
  - iOS 13.0+, macOS 10.15+, visionOS 1.0+ support

This eliminates the **biggest migration risk** — implementing the WebSocket voice client from scratch.

---

## 1. Current App Architecture Analysis

### 1.1 Tech Stack

| Layer | Current (Web) | Swift Equivalent |
|---|---|---|
| Framework | React 19 + TypeScript | SwiftUI + Swift 5.9+ |
| Routing | react-router-dom v7 | NavigationStack / TabView |
| State Management | React Query (TanStack) + useState | SwiftData / Combine / @Observable |
| Auth | Supabase JS SDK | Supabase Swift SDK / URLSession |
| Database | Supabase JS client | Supabase Swift SDK |
| Voice AI | `@elevenlabs/react` WebSocket | **ElevenLabs Swift SDK** (official) ✅ |
| Payments | Stripe JS + Stripe React | StoreKit 2 (IAP) or Stripe iOS SDK |
| Analytics | PostHog JS | PostHog iOS SDK |
| UI Components | Radix UI + shadcn/ui + Tailwind | SwiftUI native components |
| Animations | Framer Motion / motion | SwiftUI animations + Lottie |
| Audio Recording | Web Audio API + MediaRecorder | AVFoundation + AVAudioRecorder |
| HTTP Client | fetch() | URLSession / Alamofire |
| Build Tool | Vite | Xcode |
| Deployment | Vercel | App Store Connect |

### 1.2 Application Screens / Routes

The app has **~25 screens** organized into these flows:

#### Auth Flow
- `/welcome` → `WelcomeProgress` (4-step animated onboarding carousel)
- `/welcome/features` → `WelcomeFeatures`
- `/welcome/sync` → `WelcomeSync`
- `/login` → `Login` (email + magic link)
- `/signin` → `SignIn`
- `/forgot-password` → `ForgotPassword`
- `/email-verification` → `EmailVerification`
- `/auth/callback` → `AuthCallback` (OAuth deep link handler)
- `/auth/setup-password` → `SetupPassword`

#### Onboarding Flow
- `/onboarding/pronunciation` → `PronunciationAssessment`
- `/onboarding/goals` → `OnboardingGoals`
- `/onboarding/interests` → `OnboardingInterests`
- `/onboarding/preferences` → `OnboardingPreferences`

#### Main App (Tab Bar)
- `/ai-chat` → `AIChatHome` (agent browser, home screen)
- `/ai-chat/conversation/:id` → `AIChatConversation` (text chat)
- `/ai-chat/voice/:id` → `AIChatVoice` ⭐ **Core feature** — real-time voice session
- `/role-plays` → `RolePlaysV2` (scenario browser)
- `/dictionary` → `VocabularyBuilder` (focus set + word pool)
- `/pronunciation-practice` → `PronunciationPractice`

#### Settings / Account
- `/profile` → `Profile`
- `/settings` → `Settings`
- `/contact-support` → `ContactSupport`
- `/subscription-plans` → `SubscriptionPlans` (A/B tested paywall)
- `/subscription-status` → `SubscriptionStatus`
- `/subscription/manage` → `SubscriptionManagement`
- `/checkout` → `CheckoutPage` (Stripe embedded)

### 1.3 Core Features

#### 🎙️ Real-Time Voice Sessions (`AIChatVoice.tsx` — 77K chars, most complex)
- Connects to ElevenLabs via **WebSocket** (signed URL from edge function)
- Real-time audio visualization (8-bar waveform)
- Live transcript with speaker labels
- Inline word translation (tap-to-translate)
- Conversation suggestions (AI-generated)
- Real-time vocabulary ingestion (fire-and-forget to edge functions)
- Real-time mistake processing
- Session timer + recommended duration
- Post-session feedback drawer with LLM analysis
- Goals panel (sidebar overlay)
- Mute/unmute, stop session controls

#### 📚 Vocabulary Builder (`VocabularyBuilder.tsx`)
- Focus Set (max 5 active words)
- Goal Pool (unlimited words)
- Word discovery / recommendations
- CEFR level display
- Swap focus words dialog
- Lexeme search

#### 🗣️ Pronunciation Practice (`PronunciationPractice.tsx`)
- Baseline assessment (10 sentences)
- Targeted practice sessions
- Audio recording → WAV conversion → SpeechSuper API
- Phoneme-level scoring
- Progress dashboard

#### 💳 Subscription / Paywall (`SubscriptionPlans.tsx` — 54K chars)
- A/B tested pricing variants (control / plan-a / plan-b)
- PostHog feature flags
- Weekly / Monthly / Annual billing cycles
- Stripe checkout (embedded + redirect)
- Trial day logic

#### 🧭 Onboarding
- Multi-step animated welcome carousel
- Pronunciation baseline during onboarding
- Goals, interests, preferences collection
- Onboarding state persisted in `localStorage`
- Resume-from-interruption logic

### 1.4 Backend Services (All Reusable)

All backend logic lives in **Supabase Edge Functions** (Deno/TypeScript). These are **not changing**:

| Edge Function | Purpose |
|---|---|
| `elevenlabs-get-signed-url` | Get WebSocket signed URL for voice session |
| `get-context-memory` | Retrieve conversation memory for agent |
| `elevenlabs-get-conversation` | Fetch transcript from ElevenLabs |
| `create-checkout-session` | Stripe checkout session creation |
| `check-email-exists` | Pre-signup email validation |
| `get-conversation-suggestions` | AI-generated conversation prompts |
| `vocab-ingest-segment` | Real-time vocabulary extraction |
| `process-segment-mistakes-db` | Real-time grammar mistake detection |
| `pronunciation-start-baseline-workout` | Start pronunciation assessment |
| `pronunciation-submit-*` | Submit audio for scoring |

### 1.5 Key Dependencies to Replace

| Web Dependency | Purpose | Swift Replacement |
|---|---|---|
| `@elevenlabs/react` | Voice AI WebSocket | **ElevenLabs Swift SDK** (official) ✅ |
| `@supabase/supabase-js` | Auth + DB | `supabase-swift` (official) |
| `@stripe/react-stripe-js` | Payments | StoreKit 2 (preferred) or Stripe iOS SDK |
| `posthog-js` | Analytics | PostHog iOS SDK |
| `react-easy-crop` | Avatar cropping | `UIImagePickerController` + `CIFilter` |
| `embla-carousel-react` | Carousels | SwiftUI `TabView` with `PageTabViewStyle` |
| `motion/react` (Framer) | Animations | SwiftUI `.animation()` + `withAnimation` |
| `react-markdown` | Markdown rendering | `AttributedString` or `swift-markdown-ui` |
| `vaul` | Bottom drawers | SwiftUI `.sheet` with `presentationDetents` |
| `sonner` | Toast notifications | Custom SwiftUI overlay or `AlertToast` |
| `Web Audio API` | Audio visualization | AVAudioEngine + `AVAudioPCMBuffer` |
| `MediaRecorder` | Audio recording | `AVAudioRecorder` |
| `localStorage` | Onboarding state | `UserDefaults` |
| `react-router-dom` | Navigation | `NavigationStack` + `TabView` |
| `@tanstack/react-query` | Data fetching/caching | `@Observable` + async/await + `SwiftData` |
| `@shadergradient/react` | 3D gradient backgrounds | `Metal` shader or `MeshGradient` (iOS 18) |
| `three.js` | 3D rendering | `SceneKit` / `RealityKit` |

---

## 2. Migration Strategy

### Recommended Approach: **Parallel Native Build**

Do NOT attempt to wrap the web app in WKWebView — this defeats the purpose of going native. Build a fresh Swift app that calls the same Supabase backend.

**Architecture for Swift App:**
```
JustTalkAI (iOS)
├── App/
│   ├── JustTalkAIApp.swift          # @main entry point
│   └── AppState.swift               # Global app state (@Observable)
├── Core/
│   ├── Network/
│   │   ├── SupabaseClient.swift     # Supabase SDK wrapper
│   │   └── APIClient.swift          # Edge function calls
│   ├── Auth/
│   │   ├── AuthManager.swift        # Auth state management
│   │   └── AuthModels.swift
│   ├── Audio/
│   │   └── AudioRecorder.swift      # AVAudioRecorder for pronunciation
│   └── Storage/
│       └── OnboardingState.swift    # UserDefaults wrapper
├── Features/
│   ├── Onboarding/
│   ├── Auth/
│   ├── Home/
│   ├── VoiceSession/               # Uses ElevenLabs Swift SDK ✅
│   │   ├── VoiceSessionView.swift
│   │   ├── VoiceSessionViewModel.swift
│   │   └── TranscriptView.swift
│   ├── Vocabulary/
│   ├── Pronunciation/
│   ├── RolePlays/
│   ├── Profile/
│   └── Subscription/
├── Shared/
│   ├── Components/                  # Reusable SwiftUI views
│   ├── Extensions/
│   └── Models/                      # Codable data models
└── Resources/
    ├── Assets.xcassets
    └── Localizable.strings
```

**Note:** The `ElevenLabsClient.swift` and `AudioVisualizer.swift` are no longer needed — the official SDK handles all voice session complexity including audio capture, playback, and visualization (via `components-swift`).

---

## 3. Migration Steps (Phased)

### Phase 1: Foundation (Weeks 1–2)
**Goal:** Project setup, auth, navigation skeleton

- [ ] Create new Xcode project (SwiftUI, iOS 17+ minimum)
- [ ] Integrate `supabase-swift` package
- [ ] Implement `AuthManager` (sign in, sign out, magic link, anonymous auth)
- [ ] Build `NavigationStack` + `TabView` structure matching current routes
- [ ] Implement `OnboardingState` with `UserDefaults` (mirrors `onboarding-state.ts`)
- [ ] Set up environment configuration (`.xcconfig` for Supabase URL/keys)
- [ ] Implement deep link handling for `/auth/callback` (OAuth)
- [ ] Basic `APIClient` for edge function calls

**Deliverable:** App launches, user can sign in/out, navigation skeleton works

---

### Phase 2: Onboarding Flow (Weeks 3–4)
**Goal:** Complete onboarding from welcome to subscription

- [ ] `WelcomeProgressView` — animated 4-step carousel with `TabView(PageTabViewStyle)`
- [ ] `WelcomeFeaturesView`
- [ ] `LoginView` — email input + magic link
- [ ] `SignInView`
- [ ] `EmailVerificationView`
- [ ] `OnboardingGoalsView`
- [ ] `OnboardingInterestsView`
- [ ] `OnboardingPreferencesView`
- [ ] `PronunciationAssessmentView` (onboarding version)
- [ ] Onboarding resume logic (check `UserDefaults` on launch)

**Deliverable:** Full onboarding flow works end-to-end

---

### Phase 3: Core Voice Session (Weeks 5–6) ⭐ Most Critical — NOW SIMPLIFIED
**Goal:** Real-time voice conversation with ElevenLabs

**🎉 Major Simplification: ElevenLabs Swift SDK**

The official ElevenLabs Swift SDK (`elevenlabs-swift-sdk`) handles all the complex WebSocket and audio management:

```swift
import ElevenLabs
import SwiftUI

@MainActor
class VoiceSessionViewModel: ObservableObject {
    @Published var conversation: Conversation?
    @Published var messages: [Message] = []
    
    func startSession(agentId: String) async {
        do {
            conversation = try await ElevenLabs.startConversation(agentId: agentId)
            // Messages automatically update via SwiftUI observation
        } catch {
            print("Failed to start: \(error)")
        }
    }
    
    func endSession() async {
        await conversation?.endConversation()
    }
}
```

**Tasks:**

- [ ] Add ElevenLabs Swift SDK via SPM:
  ```swift
  .package(url: "https://github.com/elevenlabs/elevenlabs-swift-sdk.git", from: "2.1.0")
  ```
- [ ] Add UI components package:
  ```swift
  .package(url: "https://github.com/elevenlabs/components-swift.git", from: "0.1.3")
  ```
- [ ] Add `NSMicrophoneUsageDescription` to `Info.plist`
- [ ] `VoiceSessionView.swift`
  - Agent avatar + name header
  - Use `OrbVisualizer` from components-swift for audio visualization
  - Scrollable transcript with speaker labels (from `conversation.messages`)
  - Mute / stop controls
  - Session timer
- [ ] `VoiceSessionViewModel.swift`
  - Use SDK's `Conversation` object
  - Observe `conversation.messages` for real-time transcript
  - Observe `conversation.state` for connection status
  - Real-time vocabulary processing (fire-and-forget API calls)
  - Real-time mistake processing
- [ ] `TranslationService.swift` — tap-to-translate words in transcript
- [ ] `ConversationSuggestionsView.swift` — AI-generated prompts overlay
- [ ] `FeedbackView.swift` — post-session analysis drawer
- [ ] `RealtimeGoalsPanelView.swift` — goals sidebar overlay
- [ ] Token generation integration with existing edge function

**Deliverable:** Full voice session works with real-time transcript, feedback, and vocabulary tracking

**Time Saved:** ~2 weeks (was 4 weeks, now 2 weeks)

---

### Phase 4: Home & Agent Browser (Weeks 9–10)
**Goal:** Main home screen and agent selection

- [ ] `HomeView.swift` — main tab, agent list
- [ ] `AgentCardView.swift` — agent avatar, name, category badge
- [ ] `AgentCategoryView.swift` — grouped by category
- [ ] `PersonalityCarouselView.swift` — horizontal scroll of personalities
- [ ] `RolePlayCarouselView.swift` — scenario cards
- [ ] `FeatureCardGalleryView.swift` — feature highlights
- [ ] `AppSidebarView.swift` — slide-in navigation drawer
- [ ] `BottomNavView.swift` — tab bar (Home, Vocabulary, Pronunciation, Profile)
- [ ] `VocabRecommendationsCardView.swift`

**Deliverable:** Home screen with agent browsing and navigation

---

### Phase 5: Vocabulary Builder (Weeks 11–12)
**Goal:** Full vocabulary management

- [ ] `VocabularyBuilderView.swift` — Focus Set + Goal Pool tabs
- [ ] `FocusSetView.swift` — max 5 active words with activation dots
- [ ] `GoalPoolView.swift` — unlimited word list
- [ ] `WordCardView.swift` — CEFR level, lemma, POS
- [ ] `SwapFocusDialogView.swift` — swap focus words
- [ ] `LexemeSearchView.swift` — search and add words
- [ ] `VocabRecommendationsView.swift` — AI-suggested words
- [ ] `DiscoverView.swift` — word discovery with bulk add

**Deliverable:** Full vocabulary management works

---

### Phase 6: Pronunciation Practice (Weeks 13–14)
**Goal:** Pronunciation assessment and practice

- [ ] `PronunciationPracticeView.swift` — main container
- [ ] `BaselineIntroView.swift` — intro screen
- [ ] `PracticeSessionView.swift` — active practice with recording
  - `AVAudioRecorder` → WAV (16kHz, mono, PCM16)
  - Upload to edge function
  - Display phoneme-level results
- [ ] `ResultsDisplayView.swift` — phoneme scores with color coding
- [ ] `ProgressDashboardView.swift` — charts and trends
- [ ] `ActiveSessionsListView.swift`
- [ ] `PastSessionsListView.swift`
- [ ] `TargetedPracticeStarterView.swift`

**Deliverable:** Full pronunciation practice with audio recording and scoring

---

### Phase 7: Subscription & Paywall (Weeks 15–16)
**Goal:** Monetization

Two options — choose based on business requirements:

**Option A: StoreKit 2 (Recommended for App Store)**
- [ ] Configure App Store Connect products (weekly/monthly/annual)
- [ ] `SubscriptionManager.swift` using `StoreKit.Product`
- [ ] `SubscriptionPlansView.swift` — native paywall UI
- [ ] Server-side receipt validation via Supabase edge function
- [ ] Sync StoreKit subscription status to `justai_subscriptions` table

**Option B: Stripe iOS SDK (Keep existing Stripe)**
- [ ] Integrate `stripe-ios` SDK
- [ ] `CheckoutView.swift` using `STPPaymentSheet`
- [ ] Reuse existing `create-checkout-session` edge function
- [ ] Note: Apple takes 30% cut on in-app purchases regardless

**Recommendation:** Use StoreKit 2 for subscriptions (required for App Store compliance for digital goods). Stripe can be kept for web.

- [ ] `SubscriptionStatusView.swift`
- [ ] `SubscriptionManagementView.swift`
- [ ] A/B test pricing variants (use PostHog iOS SDK feature flags)

**Deliverable:** Users can subscribe and manage subscriptions

---

### Phase 8: Profile, Settings & Support (Week 17)
**Goal:** Account management

- [ ] `ProfileView.swift` — avatar, name, stats
- [ ] `AvatarCropView.swift` — `UIImagePickerController` + crop
- [ ] `SettingsView.swift` — preferences, notifications, language
- [ ] `ContactSupportView.swift`

**Deliverable:** Full account management

---

### Phase 9: Polish & Analytics (Week 18)
**Goal:** Production readiness

- [ ] Integrate PostHog iOS SDK
- [ ] Implement all analytics events (mirror `posthog.ts` events)
- [ ] Push notifications (session reminders, vocabulary review)
- [ ] Haptic feedback throughout
- [ ] Accessibility (VoiceOver, Dynamic Type)
- [ ] Dark mode support
- [ ] iPad layout (optional)
- [ ] App Store screenshots and metadata
- [ ] TestFlight beta

---

## 4. Key Technical Challenges

### ✅ ~~Challenge 1: ElevenLabs WebSocket Voice Streaming~~ — SOLVED

**Status: SOLVED by Official ElevenLabs Swift SDK**

The ElevenLabs Swift SDK (`elevenlabs-swift-sdk`) now provides:
- Complete WebSocket management via LiveKit WebRTC
- Audio capture and playback
- Real-time transcript with speaker labels
- Connection state management
- Client Tools support for app actions

**What you get out of the box:**
```swift
// Start a conversation with just 2 lines
let conversation = try await ElevenLabs.startConversation(agentId: "your-agent-id")

// Observe messages in real-time
ForEach(conversation.messages) { msg in
    Text("**\(msg.role)**: \(msg.content)")
}
```

**Remaining work:** Token generation for private agents (use existing edge function).

---

### 🟡 Challenge 2: Audio Session Management — SIMPLIFIED
**Difficulty: Medium (was High)**

The ElevenLabs SDK handles most audio session complexity internally. You still need:

- [ ] Add `NSMicrophoneUsageDescription` to `Info.plist`
- [ ] Add `UIBackgroundModes: audio` for background sessions
- [ ] Handle interruptions (phone calls) — SDK provides callbacks

```swift
// SDK handles audio session setup automatically
// You just observe the state:
switch conversation.state {
case .active(let info): print("Connected to: \(info.agentId)")
case .error(let err): print("Error: \(err)")
default: break
}
```

---

### ✅ ~~Challenge 3: Real-Time Audio Visualization~~ — SOLVED

**Status: SOLVED by ElevenLabs Components Swift**

The `components-swift` package provides a ready-to-use `OrbVisualizer`:

```swift
import ElevenLabsComponents

OrbVisualizer(
    inputTrack: conversation?.inputTrack,   // Microphone levels
    outputTrack: conversation?.outputTrack, // Agent audio levels
    agentState: .listening,                  // .thinking, .speaking
    colors: (Color.blue, Color.purple)       // Custom gradient
)
```

This replaces the custom 8-bar waveform visualization in the web app.

---

### 🟡 Challenge 4: Supabase Auth with Magic Links
**Difficulty: Medium**

Magic links require deep link handling:

```swift
// In App.swift
.onOpenURL { url in
    Task {
        try await supabase.auth.session(from: url)
    }
}
```

**Key issues:**
- Configure Universal Links or Custom URL Scheme
- Handle `justai://auth/callback` deep link
- Anonymous user → identified user upgrade flow
- Token refresh in background

---

### 🟡 Challenge 5: Subscription / StoreKit vs Stripe
**Difficulty: Medium-High**

Apple requires StoreKit for in-app purchases of digital subscriptions. Using Stripe for subscriptions in an iOS app violates App Store guidelines (Section 3.1.1).

**Options:**
1. **StoreKit 2 only** — Cleanest, App Store compliant, but requires new product setup in App Store Connect and server-side receipt validation
2. **Stripe for web, StoreKit for iOS** — Dual billing system, complex to manage, but allows different pricing
3. **Stripe with "reader" app exception** — Only valid if the app is a "reader" app (not applicable here)

**Recommendation:** Implement StoreKit 2 for iOS. Sync subscription status to Supabase via a new edge function `validate-storekit-receipt`.

---

### 🟡 Challenge 6: Onboarding State (localStorage → UserDefaults)
**Difficulty: Low-Medium**

Direct mapping:

```swift
// Swift equivalent of onboarding-state.ts
class OnboardingStateManager {
    private let defaults = UserDefaults.standard
    
    var currentStep: OnboardingStep {
        get { OnboardingStep(rawValue: defaults.string(forKey: "onboarding_step") ?? "email-entry") ?? .emailEntry }
        set { defaults.set(newValue.rawValue, forKey: "onboarding_step") }
    }
    
    var pricingVariant: PricingVariant? {
        get { PricingVariant(rawValue: defaults.string(forKey: "pricing_variant") ?? "") }
        set { defaults.set(newValue?.rawValue, forKey: "pricing_variant") }
    }
}
```

---

### 🟡 Challenge 7: A/B Testing with PostHog Feature Flags
**Difficulty: Medium**

PostHog has an iOS SDK. Feature flags work similarly:

```swift
import PostHog

PostHogSDK.shared.isFeatureEnabled("pricing-test-landing") // Bool
PostHogSDK.shared.getFeatureFlag("pricing-test-landing") // Any?
```

---

### 🟢 Challenge 8: Vocabulary Builder UI
**Difficulty: Low-Medium**

The vocabulary builder is data-heavy but UI-straightforward. SwiftUI `List`, `LazyVGrid`, and custom card views map well to the current Tailwind/Radix UI components.

---

### 🟢 Challenge 9: Pronunciation Recording (WAV)
**Difficulty: Low-Medium**

The web app manually converts WebM → WAV. In Swift, `AVAudioRecorder` can record directly to WAV (PCM16, 16kHz, mono):

```swift
let settings: [String: Any] = [
    AVFormatIDKey: kAudioFormatLinearPCM,
    AVSampleRateKey: 16000.0,
    AVNumberOfChannelsKey: 1,
    AVLinearPCMBitDepthKey: 16,
    AVLinearPCMIsFloatKey: false,
    AVLinearPCMIsBigEndianKey: false
]
```

This is actually **simpler** in Swift than in the browser.

---

### 🟢 Challenge 10: Markdown Rendering (Feedback Drawer)
**Difficulty: Low**

The feedback drawer renders LLM markdown output. Options:
- `swift-markdown-ui` package (GitHub: gonzalezreal/swift-markdown-ui)
- `AttributedString` with markdown support (iOS 15+)
- Custom regex-based renderer for simple cases

---

## 5. What Stays the Same (Backend Reuse)

The following are **100% reusable** without any changes:

✅ All Supabase Edge Functions  
✅ PostgreSQL database schema  
✅ All RPC functions (`check_justai_subscription_access`, `get_messages_used_in_period`, etc.)  
✅ ElevenLabs agent configurations  
✅ SpeechSuper API integration (called from edge functions)  
✅ Stripe webhook handling  
✅ PostHog event schema (same event names)  
✅ All business logic in edge functions  

---

## 6. New iOS-Specific Features to Add

These are native capabilities not available in the web app:

| Feature | iOS API | Priority |
|---|---|---|
| Push notifications (session reminders) | `UserNotifications` | High |
| Haptic feedback | `UIImpactFeedbackGenerator` | High |
| Siri Shortcuts ("Start a conversation") | `AppIntents` | Medium |
| Widget (daily streak, vocabulary) | `WidgetKit` | Medium |
| Background audio (continue session when screen off) | `AVAudioSession` background mode | High |
| Face ID / Touch ID for quick login | `LocalAuthentication` | Medium |
| Share sheet (share progress) | `UIActivityViewController` | Low |
| Spotlight search (find agents) | `CoreSpotlight` | Low |
| Dynamic Island (live session indicator) | `ActivityKit` | Low |

---

## 7. Estimated Timeline — UPDATED

| Phase | Duration | Complexity | Notes |
|---|---|---|---|
| Phase 1: Foundation | 2 weeks | Medium | Auth, navigation, Supabase setup |
| Phase 2: Onboarding | 2 weeks | Medium | Welcome flow, preferences |
| Phase 3: Voice Session | **2 weeks** | ~~Very High~~ → **Medium** | ✅ **SDK simplifies drastically** |
| Phase 4: Home & Agents | 2 weeks | Medium | Agent browser, carousels |
| Phase 5: Vocabulary | 2 weeks | Medium | Focus set, word pool |
| Phase 6: Pronunciation | 2 weeks | Medium-High | Audio recording, scoring |
| Phase 7: Subscription | 2 weeks | High | StoreKit 2 integration |
| Phase 8: Profile/Settings | 1 week | Low | Account management |
| Phase 9: Polish & Launch | 1 week | Medium | Analytics, App Store |
| **Total** | **~16 weeks** | | **2 weeks saved** |

With a single experienced iOS developer, this is approximately **4 months** of focused work (down from 4–5 months).

### Timeline Comparison

| Metric | Before SDK | After SDK |
|---|---|---|
| Voice Session Phase | 4 weeks | 2 weeks |
| Overall Timeline | 18 weeks | 16 weeks |
| Risk Level | High | Medium |
| Custom Code for Voice | ~2000 lines | ~200 lines |

---

## 8. Risk Assessment

### ~~High Risks~~ → Now Medium/Low

1. ~~**ElevenLabs WebSocket Protocol**~~ — ✅ **SOLVED** by official Swift SDK. No reverse-engineering needed.

2. **App Store Review** — Apple may reject the app if Stripe is used for subscriptions (digital goods). Plan for StoreKit 2 from day one. **Risk Level: Medium**

3. ~~**Audio Session Complexity**~~ — ✅ **SIMPLIFIED** by SDK. Only need Info.plist permissions. **Risk Level: Low**

4. ~~**ElevenLabs SDK Availability**~~ — ✅ **CONFIRMED** Official SDK available at https://github.com/elevenlabs/elevenlabs-swift-sdk

### Medium Risks

5. **Supabase Swift SDK Maturity** — The `supabase-swift` package is actively maintained but less mature than the JS SDK. Some features may need manual implementation.

6. **A/B Testing Parity** — PostHog iOS SDK supports feature flags, but the exact behavior may differ from the web SDK. Test thoroughly.

7. **Subscription Migration** — Existing web subscribers (Stripe) won't automatically have iOS access. Need a migration strategy.

### Low Risks

8. **Data Model Parity** — All data models are well-defined in TypeScript types and can be directly translated to Swift `Codable` structs.

9. **API Compatibility** — All edge functions use standard HTTP/JSON, which works identically from Swift.

10. **Token Generation** — Existing edge function `elevenlabs-get-signed-url` can be adapted to generate conversation tokens for the SDK.

---

## 9. Recommended Swift Packages

```swift
// Package.swift dependencies
dependencies: [
    // ElevenLabs Voice AI (NEW - Official SDK) ✅
    .package(url: "https://github.com/elevenlabs/elevenlabs-swift-sdk.git", from: "2.1.0"),
    
    // ElevenLabs UI Components (Orb visualizer, etc.) ✅
    .package(url: "https://github.com/elevenlabs/components-swift.git", from: "0.1.3"),
    
    // Supabase
    .package(url: "https://github.com/supabase/supabase-swift", from: "2.0.0"),
    
    // PostHog Analytics
    .package(url: "https://github.com/PostHog/posthog-ios", from: "3.0.0"),
    
    // Markdown rendering
    .package(url: "https://github.com/gonzalezreal/swift-markdown-ui", from: "2.0.0"),
    
    // Image caching (for agent avatars)
    .package(url: "https://github.com/onevcat/Kingfisher", from: "7.0.0"),
    
    // Lottie animations (optional, for onboarding)
    .package(url: "https://github.com/airbnb/lottie-spm", from: "4.0.0"),
    
    // Stripe (if not using StoreKit)
    // .package(url: "https://github.com/stripe/stripe-ios", from: "23.0.0"),
]
```

---

## 10. Immediate Next Steps

1. ~~**Verify ElevenLabs Swift SDK**~~ — ✅ **CONFIRMED** SDK is available and production-ready at https://github.com/elevenlabs/elevenlabs-swift-sdk

2. **Set up Xcode project** — Create the project structure, add `supabase-swift` and `elevenlabs-swift-sdk`, configure environment.

3. **Implement Auth first** — Auth is the foundation everything else depends on. Get magic link + anonymous auth working.

4. ~~**Prototype the WebSocket voice client**~~ — ✅ **NO LONGER NEEDED** Use the official SDK directly.

5. **Decide on StoreKit vs Stripe** — This affects the subscription architecture significantly. Make this decision before Phase 7.

6. **App Store Connect setup** — Register bundle ID, create app record, set up subscription products (if using StoreKit).

7. **Clone the starter kit** — Use https://github.com/elevenlabs/voice-starterkit-swift as a reference for voice session implementation.

---

## 11. Code Translation Examples

### ElevenLabs Voice Session: Web vs Swift

**TypeScript (current web app):**
```typescript
// Complex WebSocket management with @elevenlabs/react
import { useConversation } from '@elevenlabs/react';

const { startSession, endSession, status, messages } = useConversation({
  onConnect: () => console.log('Connected'),
  onDisconnect: () => console.log('Disconnected'),
  onMessage: (message) => console.log('Message:', message),
  onError: (error) => console.error('Error:', error),
});

// Start session with signed URL from edge function
const signedUrl = await getElevenLabsSignedUrl(agentId);
await startSession({ signedUrl });
```

**Swift (with official SDK):**
```swift
import ElevenLabs
import SwiftUI

@MainActor
class VoiceSessionViewModel: ObservableObject {
    @Published var conversation: Conversation?
    
    func startSession(agentId: String) async {
        do {
            // SDK handles everything - just pass agent ID
            conversation = try await ElevenLabs.startConversation(
                agentId: agentId
            )
        } catch {
            print("Failed to start: \(error)")
        }
    }
    
    func endSession() async {
        await conversation?.endConversation()
    }
}

// SwiftUI View - observe conversation directly
struct VoiceSessionView: View {
    @StateObject var vm = VoiceSessionViewModel()
    
    var body: some View {
        VStack {
            if let conversation = vm.conversation {
                // Connection state
                switch conversation.state {
                case .connecting:
                    ProgressView("Connecting...")
                case .active(let info):
                    Text("Connected to: \(info.agentId)")
                case .error(let err):
                    Text("Error: \(err)")
                default:
                    EmptyView()
                }
                
                // Real-time transcript
                ScrollView {
                    ForEach(conversation.messages) { msg in
                        Text("**\(msg.role)**: \(msg.content)")
                    }
                }
                
                Button("End Session") {
                    Task { await vm.endSession() }
                }
            } else {
                Button("Start Voice Chat") {
                    Task { await vm.startSession(agentId: "your-agent-id") }
                }
            }
        }
    }
}
```

### TypeScript → Swift: Data Models

```typescript
// TypeScript (current)
export interface JustAIAgent {
  id: string;
  name: string;
  description: string | null;
  elevenlabs_agent_id: string;
  category: string;
  image_url: string | null;
  is_premium: boolean;
  recommended_duration_seconds: number;
}
```

```swift
// Swift equivalent
struct JustAIAgent: Codable, Identifiable {
    let id: UUID
    let name: String
    let description: String?
    let elevenLabsAgentId: String
    let category: String
    let imageUrl: URL?
    let isPremium: Bool
    let recommendedDurationSeconds: Int
    
    enum CodingKeys: String, CodingKey {
        case id, name, description, category
        case elevenLabsAgentId = "elevenlabs_agent_id"
        case imageUrl = "image_url"
        case isPremium = "is_premium"
        case recommendedDurationSeconds = "recommended_duration_seconds"
    }
}
```

### TypeScript → Swift: API Call

```typescript
// TypeScript (current)
export async function getElevenLabsSignedUrl(params: {...}) {
  const session = await supabase.auth.getSession();
  const response = await fetch(`${SUPABASE_URL}/functions/v1/elevenlabs-get-signed-url`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}` },
    body: JSON.stringify(requestBody),
  });
  return response.json();
}
```

```swift
// Swift equivalent
func getElevenLabsSignedUrl(conversationId: String, agentId: String?) async throws -> SignedUrlResponse {
    let session = try await supabase.auth.session
    let response: SignedUrlResponse = try await supabase.functions
        .invoke("elevenlabs-get-signed-url", options: .init(
            headers: ["Authorization": "Bearer \(session.accessToken)"],
            body: ["conversation_id": conversationId, "agentId": agentId as Any]
        ))
    return response
}
```

### TypeScript → Swift: Auth Context

```typescript
// TypeScript (current)
export function AuthProvider({ children }) {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });
  }, []);
}
```

```swift
// Swift equivalent
@Observable
class AuthManager {
    var user: User?
    var session: Session?
    
    init() {
        Task {
            for await (event, session) in supabase.auth.authStateChanges {
                self.session = session
                self.user = session?.user
            }
        }
    }
}
```

---

## Summary

The migration is **technically feasible** and the backend is **fully reusable**. With the official ElevenLabs Swift SDK now available, the main challenges are significantly reduced:

### Before vs After ElevenLabs Swift SDK

| Challenge | Before | After |
|---|---|---|
| Voice WebSocket | ❌ Custom implementation (~2000 lines) | ✅ Official SDK (~50 lines) |
| Audio Session | ❌ Complex AVAudioEngine setup | ✅ SDK handles automatically |
| Audio Visualization | ❌ Custom waveform bars | ✅ OrbVisualizer component |
| Timeline | 18 weeks | **16 weeks** |
| Risk Level | High | **Medium** |

### Remaining Challenges

1. **StoreKit 2** — required for App Store compliance, different from Stripe
2. **Supabase Swift SDK** — slightly less mature than JS SDK
3. **Subscription Migration** — existing web subscribers need access strategy

### Key Resources

- **ElevenLabs Swift SDK**: https://github.com/elevenlabs/elevenlabs-swift-sdk
- **Voice Starter Kit**: https://github.com/elevenlabs/voice-starterkit-swift
- **UI Components**: https://github.com/elevenlabs/components-swift
- **Supabase Swift**: https://github.com/supabase/supabase-swift

The good news: the app's architecture is clean, the API layer is well-separated, and all data models are clearly typed — making the translation to Swift `Codable` structs straightforward. The ElevenLabs Swift SDK eliminates the biggest technical risk.
