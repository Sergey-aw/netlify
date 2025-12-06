# AI Chat Subscription Application 🤖💬

A comprehensive React application built based on the **JustTalk.ai AI Chat Subscription Architecture** specification. This is a **fully functional demo** using mock data only - no real database or API connections.

## 🌟 Live Demo

Open in your browser: [http://localhost:5173](http://localhost:5173)

## 📱 Application Screenshots

### Main Features
- **AI Chat Home** - Personalized conversation starters with learning goal pills
- **Text Chat** - Real-time messaging with grammar corrections
- **Voice Chat** - Simulated voice interface with waveform visualization
- **Subscription Plans** - Three-tier pricing with feature comparison
- **Usage Dashboard** - Track messages, billing, and profile

### Complete User Journey
1. **Onboarding** (3 screens) → Select goals, interests, preferences
2. **Chat Home** → Browse conversation starters by scenario
3. **Text/Voice Chat** → Interact with AI teacher
4. **Subscription Management** → View usage and billing

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:5173
```

## 🎯 What's Included

### ✅ Implemented Pages (8 Total)

| Page | Route | Description |
|------|-------|-------------|
| 🏠 Chat Home | `/ai-chat` | Main dashboard with conversation starters |
| 💬 Text Chat | `/ai-chat/conversation/:id?` | Message interface with AI teacher |
| 🎤 Voice Chat | `/ai-chat/voice/:id?` | Voice conversation with waveforms |
| 💳 Plans | `/subscription/plans` | Pricing tiers (Basic, Premium, Unlimited) |
| ⚙️ Manage | `/subscription/manage` | Usage stats, billing, profile |
| 🎯 Goals | `/onboarding/goals` | Select learning goals |
| ❤️ Interests | `/onboarding/interests` | Choose topics of interest |
| 🎨 Preferences | `/onboarding/preferences` | Set CEFR level, voice, correction style |

### 🎨 UI Components (shadcn/ui)

- Button
- Card
- Avatar
- Progress
- Badge
- Plus custom components

### 📊 Mock Data

Comprehensive mock data representing:
- Student profile (Sarah Johnson, B2 level)
- Active subscription (Premium Plus, 127/500 messages used)
- 3 subscription plans with features
- Conversation history with AI
- Sample messages with grammar corrections
- 6 conversation starters
- Learning goals, interests, voice options
- CEFR levels A1-C2

## 🛠️ Tech Stack

- **React 19** + TypeScript
- **Vite 7** - Lightning-fast build tool
- **Tailwind CSS 4** - Utility-first styling
- **shadcn/ui** - Beautiful, accessible components
- **React Router v7** - Client-side routing
- **TanStack Query** - Data fetching & caching
- **Lucide React** - Beautiful icons
- **Radix UI** - Unstyled, accessible primitives

## 📁 Project Structure

```
ai-chat-app/
├── src/
│   ├── components/
│   │   └── ui/                    # shadcn/ui components
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── avatar.tsx
│   │       ├── progress.tsx
│   │       └── badge.tsx
│   ├── data/
│   │   └── mockData.ts            # All mock data
│   ├── lib/
│   │   └── utils.ts               # Utility functions
│   ├── pages/
│   │   ├── AIChatHome.tsx         # Main dashboard
│   │   ├── AIChatConversation.tsx # Text chat
│   │   ├── AIChatVoice.tsx        # Voice chat
│   │   ├── SubscriptionPlans.tsx
│   │   ├── SubscriptionManagement.tsx
│   │   └── onboarding/
│   │       ├── OnboardingGoals.tsx
│   │       ├── OnboardingInterests.tsx
│   │       └── OnboardingPreferences.tsx
│   ├── App.tsx                    # Router configuration
│   ├── main.tsx                   # Entry point
│   └── index.css                  # Global styles
├── tailwind.config.js
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## 🎨 Key Features

### Mobile-First Design
- Optimized for touch interactions
- Responsive from mobile to desktop
- Bottom navigation bars
- Fixed input areas
- Smooth animations

### Conversation Interface
- Real-time message bubbles
- Grammar correction display
- Typing indicators
- Timestamp formatting
- Avatar display

### Voice Chat
- Waveform visualization
- Session duration tracking
- Transcript display
- Recording states
- AI speaking indicators

### Subscription Management
- Usage progress bars
- Message counters
- Billing cycle display
- Plan comparison
- Upgrade prompts

### Personalization
- Learning goal selection (6 categories)
- Interest topics (25+ options)
- CEFR level selector (A1-C2)
- Voice preference (4 voices)
- Correction style (Gentle/Balanced/Strict)

## 🔧 Development

### Requirements
- Node.js 18+
- npm 9+

### Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

### Environment
- Vite HMR enabled
- TypeScript strict mode
- ESLint configured
- Path aliases (@/*) configured

## 🎭 User Flows

### Complete Onboarding
1. **Goals** → Select 1+ learning goals
2. **Interests** → Choose topics you like
3. **Preferences** → Set level, voice, correction style
4. **Complete** → Redirect to AI Chat Home

### Start Conversation
1. Click conversation starter or type message
2. AI responds with natural language
3. See grammar corrections inline
4. Continue chatting

### Voice Practice
1. Tap "Talk" button from home
2. Start speaking (simulated)
3. See real-time transcript
4. AI responds with voice (simulated)
5. End session when done

### Manage Subscription
1. Click avatar in header
2. View usage stats
3. Check billing details
4. Upgrade plan or cancel

## 🎨 Customization

### Change Student Profile

Edit `src/data/mockData.ts`:

```typescript
export const mockCurrentUser: Profile = {
  id: '1',
  display_name: 'Your Name',
  cefr_level: 'B2', // A1-C2
  learning_goals: ['career', 'travel'],
  interests: ['technology', 'movies'],
  // ... more fields
};
```

### Add Conversation Starter

```typescript
export const mockConversationStarters: ConversationStarter[] = [
  {
    id: 'starter_new',
    title: '🎮 Gaming Chat',
    description: 'Discuss your favorite games',
    icon: '🎮',
    message: "Let's talk about video games!",
    scenario: 'conversation'
  },
  // ... existing starters
];
```

### Modify Subscription Plans

```typescript
export const mockSubscriptionPlans: AISubscriptionPlan[] = [
  {
    id: 'plan_custom',
    plan_name: 'Pro Plan',
    monthly_message_limit: 1000,
    price_cents: 4999,  // $49.99
    features: ['Your custom features'],
    // ... other props
  },
];
```

## 🏗️ Architecture Alignment

This application implements **100% of the UI/UX specifications** from the architecture document:

### ✅ Fully Implemented
- [x] Mobile-first responsive design
- [x] Conversation starters by scenario
- [x] Text chat with message bubbles
- [x] Grammar correction display
- [x] Voice chat interface with waveforms
- [x] Subscription usage tracking
- [x] Three-tier pricing plans
- [x] Three-screen onboarding flow
- [x] Learning goal selection
- [x] Interest categories
- [x] CEFR level picker
- [x] Voice preference selector
- [x] Correction style options
- [x] Gradient UI accents
- [x] Progress indicators
- [x] Avatar components

### 🎯 Key Concepts Demonstrated

From the specification:
1. **Subscription Tiers** - Basic ($9.99), Premium ($29.99), Unlimited ($69.99)
2. **Message Limits** - Monthly caps with usage tracking
3. **Voice Sessions** - Duration, transcripts, waveform visualization
4. **Personalization** - Goals, interests, CEFR levels, voices
5. **Scenario-Based Learning** - Career, travel, academic contexts
6. **Grammar Corrections** - Inline feedback with explanations
7. **Onboarding Flow** - Three-step user setup

## 🚧 Future Enhancements

If connecting to real backend:

- [ ] Supabase database integration
- [ ] Stripe payment processing
- [ ] OpenAI API for chat responses
- [ ] ElevenLabs for real voice synthesis
- [ ] WebRTC for voice recording
- [ ] WebSocket for real-time features
- [ ] Vocabulary tracking system
- [ ] Grammar analysis engine
- [ ] Spaced repetition reviews
- [ ] Progress analytics dashboard

## 📚 Resources

- [Full Architecture Spec](../ai_app.md) - Complete specification
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [shadcn/ui](https://ui.shadcn.com/) - UI components
- [React Router](https://reactrouter.com/) - Routing
- [TanStack Query](https://tanstack.com/query/) - Data fetching

## 🤝 Contributing

This is a demo application. To extend:

1. Fork the repository
2. Add features
3. Test thoroughly
4. Submit pull request

## 📄 License

MIT License - Free to use and modify

## ✨ Highlights

- 🎨 **Beautiful UI** - Modern, clean design with gradients
- 📱 **Mobile-First** - Touch-optimized, responsive
- 🚀 **Fast** - Vite HMR for instant updates
- 🎯 **Type-Safe** - Full TypeScript coverage
- ♿ **Accessible** - shadcn/ui + Radix UI primitives
- 📦 **No Backend Required** - Pure frontend demo
- 🎭 **Comprehensive** - 8 pages, all flows implemented

---

**Built with ❤️ following the JustTalk.ai AI Chat Subscription Architecture**

**Note**: This is a **demonstration application** using **mock data only**. No real API calls, database connections, or payment processing. Perfect for understanding the architecture, testing UX flows, and as a starting point for full implementation.
