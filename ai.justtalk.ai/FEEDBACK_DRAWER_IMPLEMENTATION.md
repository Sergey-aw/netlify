# Feedback Drawer Implementation

## Overview

This implementation adds a comprehensive feedback system for voice conversations, showing insights after each session. The system intelligently determines whether to show full feedback or prompt users to continue talking based on the conversation duration.

## Features Implemented

### 1. **Conversation Duration Tracking**
- Each agent in `elevenlabs-agents.ts` now has a `recommendedDuration` field (in seconds)
- Default durations:
  - Interview (Feedback): 5 minutes (300s)
  - Interview (Practice): 8 minutes (480s)
  - Interview (Conversation): 7 minutes (420s)
  - Freetalk (Engagement): 10 minutes (600s)

### 2. **Smart Feedback Display**
The system shows different feedback based on conversation length:

#### Short Sessions (< recommended duration)
- Shows "Keep Going!" prompt
- Encourages user to continue talking
- Options: "End Session" or "Continue Talking"
- No detailed insights shown yet

#### Full Sessions (≥ recommended duration)
- Shows comprehensive feedback drawer with 4 tabs:

### 3. **Feedback Tabs**

#### Tab 1: Summary/Snapshot
- **Duration**: Total conversation time (MM:SS format)
- **Turns**: Number of conversation exchanges
- **Total Words**: Combined word count
- **You**: Student's word count (green highlight)
- **AI**: AI teacher's word count (blue highlight)

#### Tab 2: Vocabulary Goals
- Shows words from user's vocabulary goals that were used
- For each word:
  - ✅ Correct usage indicator
  - Part of speech badge
  - Context sentence showing how it was used
  - Optional note about usage quality

#### Tab 3: Vocabulary Suggestions
- Words that would enhance the conversation
- Two types:
  - 💡 **Useful words**: Relevant vocabulary for the conversation topic
  - 🔄 **Synonyms**: Alternatives for overused words
- Example usage provided for each suggestion

#### Tab 4: LLM Feedback
- **Performance Scores**: Visual bars for multiple categories
  - Interview clarity
  - Grammar accuracy
  - Vocabulary range
  - Fluency
  - Color-coded: Green (80%+), Yellow (60-79%), Orange (<60%)
  
- **Personalized Advice**: Specific, actionable feedback for each category

## Technical Architecture

### Components

#### `FeedbackDrawer.tsx`
- Location: `ai-chat-app/src/components/FeedbackDrawer.tsx`
- Props:
  - `open`: Control drawer visibility
  - `onOpenChange`: Handle drawer close
  - `isLoading`: Show loading state
  - `feedbackData`: Full feedback data object
  - `onContinue`: Handler for "Continue Talking" button
  - `showContinuePrompt`: Boolean to show short session prompt

#### Data Types
```typescript
interface ConversationSnapshot {
  duration: number;
  turns: number;
  words: number;
  studentWords: number;
  aiWords: number;
}

interface VocabularyGoalUsed {
  lemma: string;
  pos: string;
  usedCorrectly: boolean;
  context: string;
  note?: string;
}

interface VocabularySuggestion {
  lemma: string;
  pos: string;
  reason: 'useful' | 'synonym';
  context?: string;
  overusedWord?: string;
}

interface LLMFeedback {
  scores: Array<{
    category: string;
    score: number;
    maxScore: number;
  }>;
  advice: Array<{
    category: string;
    feedback: string;
  }>;
}
```

### Edge Function

#### `analyze-conversation-feedback.ts`
- Location: `edge-functions/analyze-conversation-feedback.ts`
- Purpose: Analyze conversation and generate all feedback types
- Process:
  1. Fetches conversation from ElevenLabs API
  2. Calculates basic metrics (duration, turns, word counts)
  3. Queries student's active vocabulary goals from database
  4. Matches vocabulary goals against conversation text
  5. Detects overused words and suggests synonyms
  6. Uses OpenAI GPT-4 to generate personalized feedback
  7. Returns structured feedback data

#### Required Environment Variables
- `ELEVENLABS_API_KEY`: For fetching conversation details
- `OPENAI_API_KEY`: For LLM-based feedback generation
- `SUPABASE_URL`: Database connection
- `SUPABASE_ANON_KEY`: Database authentication

### Integration in AIChatVoice

#### State Management
```typescript
const [showFeedbackDrawer, setShowFeedbackDrawer] = useState(false);
const [feedbackData, setFeedbackData] = useState<FeedbackData | null>(null);
const [isFetchingFeedback, setIsFetchingFeedback] = useState(false);
const [showContinuePrompt, setShowContinuePrompt] = useState(false);
```

#### Flow on Session End
1. User taps "End Session" button
2. System ends ElevenLabs conversation
3. Saves session data to database
4. Checks actual duration vs recommended duration
5. If duration < recommended:
   - Shows "Keep Going" prompt
   - User can continue or end
6. If duration ≥ recommended:
   - Fetches feedback from edge function
   - Shows full feedback drawer
   - User reviews insights before leaving

## Database Integration

### Required Functions
- `get_active_vocabulary_goals(p_student_id)`: Fetches student's active vocabulary goals
- Should return: `{ lemma, pos, lexeme_id }`

### Tables Used
- `justai_voice_sessions`: Stores session metadata
- `justai_conversations`: Conversation records
- `student_lexeme_history`: Vocabulary usage tracking (via existing triggers)
- `vocab_evidence`: Evidence of word usage

## Future Enhancements

### Possible Improvements
1. **Grammar Analysis**: Add specific grammar mistake detection
2. **Pronunciation Scoring**: Integrate pronunciation assessment
3. **Progress Tracking**: Show improvement over multiple sessions
4. **Goal Setting**: Allow users to set speaking goals
5. **Vocabulary Deep Dive**: Click words for detailed definitions
6. **Export Reports**: Download feedback as PDF
7. **Notification System**: Alert when vocab goals are achieved
8. **Comparative Analysis**: Compare with previous sessions

### Data Sources to Explore
1. **ElevenLabs Analysis API**: If they add more detailed analytics
2. **Grammar Check APIs**: Integrate third-party grammar checking
3. **Speech Recognition Confidence**: Use transcription confidence scores
4. **Sentiment Analysis**: Analyze conversation tone and engagement

## Testing

### Manual Testing Steps
1. Start a voice conversation with any agent
2. Talk for less than recommended duration (e.g., 2 minutes)
3. End session - should see "Keep Going" prompt
4. Start another conversation
5. Talk for longer than recommended duration (e.g., 6+ minutes)
6. End session - should see full feedback with all tabs
7. Verify all data displays correctly in each tab

### Edge Cases
- No vocabulary goals set → Tab 2 not shown
- Very short conversation (< 30 seconds) → Minimal data
- API failures → Graceful error handling needed
- Missing OpenAI key → LLM feedback tab not shown

## Deployment

### Steps
1. Deploy edge function:
   ```bash
   supabase functions deploy analyze-conversation-feedback
   ```

2. Set required secrets:
   ```bash
   supabase secrets set ELEVENLABS_API_KEY=your_key
   supabase secrets set OPENAI_API_KEY=your_key
   ```

3. Verify database function exists:
   ```sql
   SELECT * FROM pg_proc WHERE proname = 'get_active_vocabulary_goals';
   ```

4. Test frontend in development
5. Deploy frontend to production

## Notes

- The LLM feedback uses GPT-4o-mini for cost efficiency
- Feedback is generated on-demand, not pre-computed
- All feedback is ephemeral (not stored in database currently)
- Consider caching feedback data for future reference
- The vocabulary matching is case-insensitive and looks for exact lemma matches
