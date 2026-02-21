# JustTalk AI → Native Swift App: Migration Analysis & Plan

## Executive Summary

The current app is a **React/TypeScript PWA** (Progressive Web App) built with Vite, deployed on Vercel, backed by Supabase (PostgreSQL + Edge Functions) and ElevenLabs for real-time voice AI. Migrating to native Swift (iOS) is a significant but well-structured undertaking. The backend (Supabase Edge Functions, database, ElevenLabs) remains **100% reusable** — only the frontend layer changes.

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
| Voice AI | `@elevenlabs/react` WebSocket | ElevenLabs Swift SDK / URLSession WebSocket |
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
| `@elevenlabs/react` | Voice AI WebSocket | URLSessionWebSocketTask + custom Swift wrapper |
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
│   │   ├── APIClient.swift          # Edge function calls
│   │   └── ElevenLabsClient.swift   # WebSocket voice client
│   ├── Auth/
│   │   ├── AuthManager.swift        # Auth state management
│   │   └── AuthModels.swift
│   ├── Audio/
│   │   ├── AudioRecorder.swift      # AVAudioRecorder wrapper
│   │   ├── AudioPlayer.swift        # AVAudioPlayer wrapper
│   │   └── AudioVisualizer.swift    # Real-time level metering
│   └── Storage/
│       └── OnboardingState.swift    # UserDefaults wrapper
├── Features/
│   ├── Onboarding/
│   ├── Auth/
│   ├── Home/
│   ├── VoiceSession/               # Most complex feature
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

### Phase 3: Core Voice Session (Weeks 5–8) ⭐ Most Critical
**Goal:** Real-time voice conversation with ElevenLabs

This is the **hardest and most important** phase.

- [ ] `ElevenLabsWebSocketClient.swift`
  - Connect to signed URL via `URLSessionWebSocketTask`
  - Handle audio streaming (send PCM16 chunks, receive audio)
  - Parse transcript events (user/AI messages)
  - Handle connection lifecycle (connecting, connected, disconnected)
- [ ] `AudioEngine.swift`
  - Capture microphone input via `AVAudioEngine`
  - Stream PCM16 audio chunks to WebSocket
  - Play received audio via `AVAudioPlayerNode`
  - Real-time level metering for waveform visualization
- [ ] `VoiceSessionView.swift`
  - Agent avatar + name header
  - Animated waveform bars (8 bars, real-time levels)
  - Scrollable transcript with speaker labels
  - Mute / stop controls
  - Session timer
  - "Connecting..." state
- [ ] `VoiceSessionViewModel.swift`
  - Manage WebSocket + audio engine lifecycle
  - Real-time vocabulary processing (fire-and-forget API calls)
  - Real-time mistake processing
  - Session save on end
- [ ] `TranslationService.swift` — tap-to-translate words in transcript
- [ ] `ConversationSuggestionsView.swift` — AI-generated prompts overlay
- [ ] `FeedbackView.swift` — post-session analysis drawer
- [ ] `RealtimeGoalsPanelView.swift` — goals sidebar overlay

**Deliverable:** Full voice session works with real-time transcript, feedback, and vocabulary tracking

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

### 🔴 Challenge 1: ElevenLabs WebSocket Voice Streaming
**Difficulty: Very High**

The current web app uses `@elevenlabs/react` which abstracts the WebSocket protocol. In Swift, you must implement this from scratch:

```swift
// Conceptual Swift implementation
class ElevenLabsWebSocketClient: NSObject {
    private var webSocketTask: URLSessionWebSocketTask?
    private var audioEngine = AVAudioEngine()
    
    func connect(signedUrl: String) {
        let url = URL(string: signedUrl)!
        webSocketTask = URLSession.shared.webSocketTask(with: url)
        webSocketTask?.resume()
        receiveMessages()
        startAudioCapture()
    }
    
    private func startAudioCapture() {
        let inputNode = audioEngine.inputNode
        let format = AVAudioFormat(commonFormat: .pcmFormatInt16, 
                                   sampleRate: 16000, 
                                   channels: 1, 
                                   interleaved: true)!
        inputNode.installTap(onBus: 0, bufferSize: 4096, format: format) { buffer, _ in
            // Convert buffer to Data and send via WebSocket
            self.sendAudioChunk(buffer)
        }
        try? audioEngine.start()
    }
}
```

**Key issues:**
- ElevenLabs uses a specific binary protocol for audio chunks
- Must handle audio interruptions (phone calls, Siri)
- Background audio session configuration required
- Echo cancellation must be configured properly

**Mitigation:** Check if ElevenLabs has an official Swift SDK (they have a Python SDK). If not, study the `@elevenlabs/react` source code to understand the exact WebSocket message format.

---

### 🔴 Challenge 2: Audio Session Management
**Difficulty: High**

iOS audio sessions are complex:

```swift
// Required audio session setup
try AVAudioSession.sharedInstance().setCategory(
    .playAndRecord,
    mode: .voiceChat,
    options: [.defaultToSpeaker, .allowBluetooth]
)
try AVAudioSession.sharedInstance().setActive(true)
```

**Key issues:**
- Must handle interruptions (phone calls, other apps)
- Background audio requires `UIBackgroundModes: audio` in Info.plist
- Bluetooth headset routing
- AirPods switching
- Echo cancellation (`.voiceChat` mode helps)
- Microphone permission request flow

---

### 🟡 Challenge 3: Real-Time Audio Visualization
**Difficulty: Medium**

The web app uses `AnalyserNode` from Web Audio API. In Swift:

```swift
// AVAudioEngine metering approach
audioEngine.inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
    let channelData = buffer.floatChannelData![0]
    let frameLength = Int(buffer.frameLength)
    let rms = sqrt(channelData[0..<frameLength].map { $0 * $0 }.reduce(0, +) / Float(frameLength))
    DispatchQueue.main.async {
        self.audioLevel = CGFloat(rms)
    }
}
```

SwiftUI waveform bars can be animated with `withAnimation(.easeInOut(duration: 0.1))`.

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

## 7. Estimated Timeline

| Phase | Duration | Complexity |
|---|---|---|
| Phase 1: Foundation | 2 weeks | Medium |
| Phase 2: Onboarding | 2 weeks | Medium |
| Phase 3: Voice Session | 4 weeks | Very High |
| Phase 4: Home & Agents | 2 weeks | Medium |
| Phase 5: Vocabulary | 2 weeks | Medium |
| Phase 6: Pronunciation | 2 weeks | Medium-High |
| Phase 7: Subscription | 2 weeks | High |
| Phase 8: Profile/Settings | 1 week | Low |
| Phase 9: Polish & Launch | 1 week | Medium |
| **Total** | **~18 weeks** | |

With a single experienced iOS developer, this is approximately **4–5 months** of focused work.

---

## 8. Risk Assessment

### High Risks

1. **ElevenLabs WebSocket Protocol** — No official Swift SDK. Must reverse-engineer the protocol from the JS SDK. Could take 2–3 weeks alone.

2. **App Store Review** — Apple may reject the app if Stripe is used for subscriptions (digital goods). Plan for StoreKit 2 from day one.

3. **Audio Session Complexity** — iOS audio routing, interruptions, and background modes are notoriously tricky. Budget extra time.

4. **ElevenLabs SDK Availability** — Check https://elevenlabs.io/docs for any Swift/iOS SDK. If available, Phase 3 becomes much easier.

### Medium Risks

5. **Supabase Swift SDK Maturity** — The `supabase-swift` package is actively maintained but less mature than the JS SDK. Some features may need manual implementation.

6. **A/B Testing Parity** — PostHog iOS SDK supports feature flags, but the exact behavior may differ from the web SDK. Test thoroughly.

7. **Subscription Migration** — Existing web subscribers (Stripe) won't automatically have iOS access. Need a migration strategy.

### Low Risks

8. **Data Model Parity** — All data models are well-defined in TypeScript types and can be directly translated to Swift `Codable` structs.

9. **API Compatibility** — All edge functions use standard HTTP/JSON, which works identically from Swift.

---

## 9. Recommended Swift Packages

```swift
// Package.swift dependencies
dependencies: [
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

1. **Verify ElevenLabs Swift SDK** — Check https://elevenlabs.io/docs/developer-guides/conversational-ai/overview for any iOS/Swift SDK. This is the single biggest unknown.

2. **Set up Xcode project** — Create the project structure, add `supabase-swift`, configure environment.

3. **Implement Auth first** — Auth is the foundation everything else depends on. Get magic link + anonymous auth working.

4. **Prototype the WebSocket voice client** — Build a minimal proof-of-concept for ElevenLabs WebSocket before committing to the full build.

5. **Decide on StoreKit vs Stripe** — This affects the subscription architecture significantly. Make this decision before Phase 7.

6. **App Store Connect setup** — Register bundle ID, create app record, set up subscription products (if using StoreKit).

---

## 11. Code Translation Examples

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

The migration is **technically feasible** and the backend is **fully reusable**. The main challenges are:

1. **ElevenLabs WebSocket** — the core voice feature requires custom Swift implementation
2. **iOS Audio Session** — complex but well-documented
3. **StoreKit 2** — required for App Store compliance, different from Stripe
4. **Timeline** — ~18 weeks for a single experienced iOS developer

The good news: the app's architecture is clean, the API layer is well-separated, and all data models are clearly typed — making the translation to Swift `Codable` structs straightforward.
