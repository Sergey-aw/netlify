# Pronunciation Practice Feature - Implementation Plan

## Overview
This document outlines the implementation plan for the Pronunciation Practice feature in the JustTalk AI web app. The backend infrastructure (edge functions and database) already exists as documented in `PRONUNCIATION_SYSTEM_MOBILE_API.md`.

## ✅ Completed Infrastructure

### 1. Type Definitions (`src/types/pronunciation.ts`)
- **PracticeSession**: Main session container with status tracking
- **PracticeItem**: Individual practice exercises (word/sentence)
- **PracticeResult**: Scored attempts with phoneme-level feedback
- **PhonemeResult**: Detailed phoneme scores and error types
- **API Response Types**: Typed responses for all edge function calls
- **Helper Functions**: Score categorization, color coding, read type labels

### 2. API Service (`src/services/pronunciationApi.ts`)
Wraps all existing edge functions:
- `checkBaselineStatus()` - Check if user has completed baseline
- `startBaselineWorkout()` - Create 10-sentence baseline assessment
- `getPracticeItems()` - Fetch practice items for a session
- `submitWordPractice()` - Submit word audio for evaluation
- `submitSentencePractice()` - Submit sentence audio for evaluation
- `getPracticeSession()` - Get session details
- `getPracticeProgress()` - Get progress with attempt statistics
- `getStudentSessions()` - Get all sessions for a student
- `getPhonemeStats()` - Get phoneme error statistics

### 3. Audio Recording Utility (`src/lib/audioRecorder.ts`)
Web Audio API implementation:
- **AudioRecorder class**: Browser-based WAV recording
  - Records at 16kHz, mono, PCM16 (SpeechSuper requirements)
  - Converts WebM to WAV format automatically
  - Handles resampling and mono conversion
  - Proper resource cleanup
- **validateWavFile()**: Validates WAV format before submission

## 🎯 Next Steps: UI Components

### Phase 1: Core UI Components (3-4 hours)

#### 1. `src/components/pronunciation/` directory structure
```
pronunciation/
├── BaselineIntro.tsx          # Welcome screen + start baseline
├── PracticeSession.tsx         # Main practice interface
├── ResultsDisplay.tsx          # Score display + phoneme feedback
├── ProgressDashboard.tsx       # History + stats
├── PhonemeCard.tsx            # Individual phoneme stat card
└── AudioRecordButton.tsx      # Recording button with animation
```

#### 2. BaselineIntro Component
**Purpose**: First-time user experience
- Explains the baseline workout concept
- Shows what to expect (10 sentences)
- "Start Baseline" button
- Uses `startBaselineWorkout()` API

**Design**:
- Card-based layout
- Microphone icon
- Clear, encouraging copy
- Loading state during session creation

#### 3. PracticeSession Component
**Purpose**: Main practice interface
- Displays current practice item
- Shows word/sentence to pronounce
- IPA transcription with target phoneme highlighted
- Record button (integrated with AudioRecorder)
- Submit and retry logic
- Progress indicator (e.g., "3 of 10")

**Features**:
- Visual feedback during recording (waveform/bars)
- Countdown before recording starts
- Auto-advance to next item after success
- Handle both word and sentence types

#### 4. ResultsDisplay Component
**Purpose**: Show practice results
- Overall score (prominent, color-coded)
- Phoneme breakdown table/cards
- Visual indicators (✓/✗) for each phoneme
- Detailed feedback (read type, what it sounded like)
- "Try Again" vs "Continue" buttons

**Design**:
- Green for correct (score ≥ 60)
- Red for incorrect
- Yellow for partial success
- Expandable phoneme details

#### 5. ProgressDashboard Component
**Purpose**: Long-term progress tracking
- Session history (date, type, completion status)
- Phoneme mastery cards (sorted by weakness)
- Average scores over time (line chart)
- Recommendations for next practice
- Quick stats (total sessions, mastered phonemes, avg score)

**Data Sources**:
- `getStudentSessions()`
- `getPhonemeStats()`
- `getPracticeProgress()`

### Phase 2: Main Page & Navigation (1-2 hours)

#### 6. `src/pages/PronunciationPractice.tsx`
**Layout**:
- AppSidebar integration (like VocabularyBuilder)
- Tab navigation: "Practice" | "Progress"
- Responsive design (mobile swipe gestures)

**Logic**:
- Check baseline status on load
- Show BaselineIntro if no baseline
- Show PracticeSession if active session exists
- Show ProgressDashboard in "Progress" tab

**State Management**:
- Current session ID
- Active practice item
- Recording state
- Results state

#### 7. App.tsx Route
Add protected route:
```tsx
<Route 
  path="/pronunciation-practice" 
  element={<ProtectedRoute><PronunciationPractice /></ProtectedRoute>} 
/>
```

#### 8. AppSidebar.tsx Menu Item
Add navigation item:
```tsx
<SidebarMenuItem>
  <SidebarMenuButton onClick={() => handleNavigate('/pronunciation-practice')}>
    <Mic className="w-4 h-4" />
    <span>Pronunciation</span>
  </SidebarMenuButton>
</SidebarMenuItem>
```

### Phase 3: Polish & UX Enhancements (2-3 hours)

#### 9. Error Handling
- Network errors (retry logic)
- Audio permission denied (clear messaging)
- Invalid audio format (validation feedback)
- Session not found (redirect to home)

#### 10. Loading States
- Skeleton loaders for session data
- Spinner during audio submission
- Progress bars for long operations

#### 11. Empty States
- No sessions yet (encourage baseline)
- No phoneme data (encourage practice)
- Baseline expired (re-assessment prompt)

#### 12. Mobile Optimizations
- Touch-friendly buttons
- Swipe gestures (sidebar, item navigation)
- Responsive audio controls
- Optimized for portrait mode

#### 13. Accessibility
- ARIA labels for all interactive elements
- Keyboard navigation
- Screen reader announcements
- Color contrast compliance

## 📊 Data Flow

### Baseline Workout Flow
```
User → BaselineIntro → startBaselineWorkout()
  ↓
Get sessionId + 10 sentence items
  ↓
PracticeSession (item 1) → Record → Submit → Results
  ↓
Repeat for all 10 items
  ↓
Session auto-completes → ProgressDashboard
```

### Regular Practice Flow
```
User → ProgressDashboard → View weak phonemes
  ↓
[Backend creates targeted session]
  ↓
PracticeSession → Practice weak phonemes
  ↓
Submit results → Update phoneme stats
  ↓
ProgressDashboard shows improvements
```

## 🎨 Design Guidelines

### Colors (Tailwind)
- **Excellent (85-100)**: `bg-green-100 text-green-800`
- **Good (70-84)**: `bg-blue-100 text-blue-800`
- **Fair (60-69)**: `bg-yellow-100 text-yellow-800`
- **Poor (<60)**: `bg-red-100 text-red-800`

### Typography
- **IPA Symbols**: Use `font-mono text-lg` for clarity
- **Scores**: Large, bold numbers `text-4xl font-bold`
- **Phoneme Labels**: `text-sm font-medium`

### Icons (lucide-react)
- Microphone: Practice/recording
- Target: Focus/target phoneme
- TrendingUp: Progress/improvement
- CheckCircle: Success
- XCircle: Needs work
- BarChart: Statistics

## 🔧 Technical Considerations

### Audio Recording
- Request microphone permission early
- Show permission prompt explanation
- Handle permission denial gracefully
- Test on multiple browsers (Chrome, Safari, Firefox)

### Performance
- Lazy load audio recorder
- Cache session data
- Debounce rapid submissions
- Optimize phoneme stats queries

### Error Recovery
- Auto-retry on network failures (3 attempts)
- Save progress locally (localStorage backup)
- Resume interrupted sessions
- Clear error messages

## 📱 Testing Checklist

### Functionality
- [ ] Baseline workout creation
- [ ] Audio recording (16kHz, mono, PCM16)
- [ ] Word practice submission
- [ ] Sentence practice submission
- [ ] Score display (all ranges)
- [ ] Phoneme feedback accuracy
- [ ] Session completion
- [ ] Progress tracking
- [ ] Navigation between tabs

### Cross-browser
- [ ] Chrome (desktop)
- [ ] Safari (desktop)
- [ ] Firefox (desktop)
- [ ] Safari (iOS)
- [ ] Chrome (Android)

### Edge Cases
- [ ] No microphone access
- [ ] Network offline
- [ ] Session not found
- [ ] Empty practice items
- [ ] Audio too short/long
- [ ] Multiple rapid submissions

## 🚀 Deployment Checklist

### Pre-launch
- [ ] All components implemented
- [ ] Error handling tested
- [ ] Mobile responsive verified
- [ ] Accessibility audit passed
- [ ] Performance optimized
- [ ] Analytics events added

### Post-launch
- [ ] Monitor error logs
- [ ] Track completion rates
- [ ] Gather user feedback
- [ ] A/B test UI variations
- [ ] Iterate based on data

## 📚 Key Files Reference

### Backend (Already Exists)
- **Edge Functions**:
  - `supabase/functions/pronunciation-start-baseline-workout/`
  - `supabase/functions/pronunciation-submit-word-practice/`
  - `supabase/functions/pronunciation-submit-sentence-practice/`
  - `supabase/functions/pronunciation-generate-practice/`

- **Database Tables**:
  - `pronunciation_practice_sessions`
  - `pronunciation_practice_items`
  - `pronunciation_practice_results`
  - `pronunciation_phoneme_attempts`
  - `pronunciation_sessions`
  - `pronunciation_practice_item_progress` (view)

### Frontend (To Be Created)
- **Types**: `src/types/pronunciation.ts` ✅
- **API**: `src/services/pronunciationApi.ts` ✅
- **Audio**: `src/lib/audioRecorder.ts` ✅
- **Page**: `src/pages/PronunciationPractice.tsx` ⏳
- **Components**: `src/components/pronunciation/*.tsx` ⏳

## 🎯 Success Metrics

- **User Engagement**: % of users who complete baseline
- **Session Completion**: % of practice sessions completed
- **Phoneme Mastery**: Avg # of phonemes mastered per user
- **Score Improvement**: Avg score delta over time
- **Retention**: Users returning for practice sessions

## 📝 Notes

- No backend changes needed - everything exists in production
- Focus on UX and visual polish
- Leverage existing components (AppSidebar, Card, Button, etc.)
- Follow VocabularyBuilder pattern for consistency
- Mobile-first design approach
