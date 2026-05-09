# Vocabulary Recommendation System: Mobile / Chat Implementation Guide
> **Purpose**: This document enables re-implementing the JustTalk Vocabulary Recommendation experience inside a chat-based mobile application using the **same Supabase backend, edge functions, and data models** as the existing web app.
---
## Table of Contents
1. [High-Level Recommendation Flow](#1-high-level-recommendation-flow)
2. [Supabase Edge Functions](#2-supabase-edge-functions)
3. [LLM Prompting Logic](#3-llm-prompting-logic)
4. [Database Tables & Views](#4-database-tables--views)
5. [Frontend Hooks & Integration Points](#5-frontend-hooks--integration-points)
6. [Chat / Mobile UI Adaptation Notes](#6-chat--mobile-ui-adaptation-notes)
7. [Re-creation Checklist](#7-re-creation-checklist)
---
## 1. High-Level Recommendation Flow
### 1.1 System Overview
The Vocabulary Recommendation System is a **two-stage personalization pipeline**:
1. **Stage 1 (Backend/Deterministic)**: A precomputed pool of ~150 CEFR-appropriate candidate words is generated per student and stored in the `vocab_recommendations` table.
2. **Stage 2 (Edge Function/LLM)**: An AI model (Gemini-3-flash) selects exactly 5 words from that pool based on the student's interests and learning goals, generating a personalized reason for each.
### 1.2 End-to-End Flow Diagram
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ VOCABULARY RECOMMENDATION FLOW                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [Initial Page Load / Chat "Discover" Command]                              │
│                    │                                                        │
│                    ▼                                                        │
│  Frontend: Check for existing recommendations                               │
│  → RPC: get_ready_recommendations(studentId, 5)                             │
│                    │                                                        │
│         ┌─────────┴─────────┐                                               │
│         │                   │                                               │
│    Has 5 recs?          Empty?                                              │
│         │                   │                                               │
│         ▼                   ▼                                               │
│    Display them      Trigger AI selection                                   │
│                            │                                                │
│                            ▼                                                │
│              vocab-select-recommendations                                   │
│              (Edge Function)                                                │
│                            │                                                │
│           ┌────────────────┼────────────────┐                               │
│           │                │                │                               │
│           ▼                ▼                ▼                               │
│    get_pending_    Fetch student     Build candidate                        │
│    recommendations   profile          list for LLM                          │
│    (150 words)                                                              │
│           │                │                │                               │
│           └────────────────┴────────────────┘                               │
│                            │                                                │
│                            ▼                                                │
│              Call Lovable AI Gateway                                        │
│              (Gemini-3-flash-preview)                                       │
│                            │                                                │
│                            ▼                                                │
│              Parse JSON response                                            │
│              → 5 selections with reasons                                    │
│                            │                                                │
│                            ▼                                                │
│              save_recommendation_reasons()                                  │
│              → Marks as 'selected', saves reason                            │
│                            │                                                │
│                            ▼                                                │
│              Return recommendations to frontend                             │
│                            │                                                │
│                            ▼                                                │
│              Display 5 words with reasons                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```
### 1.3 User Actions
| Action | What Happens |
|--------|--------------|
| **View Discover tab** | Fetch existing recommendations; if empty, trigger AI selection |
| **Tap "Refresh"** | Mark current 5 as `'refreshed'`, select 5 new words from pool |
| **Tap "Add to Goals"** | Insert into `student_goals`, mark recommendation as `'added'` |
| **Skip word** | (Optional) Mark as `'skipped'` to exclude from future pools |
### 1.4 Key Principle
> **The chat app is a different UI surface, NOT a different backend.** All edge functions, database RPCs, and business logic remain identical. The chat merely translates user intents into the same API calls.
---
## 2. Supabase Edge Functions
### 2.1 `vocab-select-recommendations`
| Field | Value |
|-------|-------|
| **Purpose** | Selects 5 personalized words from the candidate pool using AI |
| **Deterministic** | ❌ No — uses LLM for selection and reason generation |
| **When Called** | On page load (if no recommendations exist), or on "Refresh" action |
#### Request
```http
POST /functions/v1/vocab-select-recommendations
Authorization: Bearer <anon_key>
Content-Type: application/json
{
  "studentId": "uuid-of-student",
  "action": "select" | "refresh"
}
```
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `studentId` | UUID | Yes | The student's user ID |
| `action` | string | No | `"select"` (default) or `"refresh"` |
#### Response (Success)
```json
{
  "recommendations": [
    {
      "id": 12345,
      "lexeme_id": "uuid-of-lexeme",
      "lemma": "negotiate",
      "pos": "verb",
      "cefr_level": "B2",
      "reason": "Useful in professional conversations.",
      "tags": { "domain": ["business"], "topic": ["meetings"] }
    },
    // ... 4 more
  ]
}
```
#### Response (Errors)
| Status | Body | Meaning |
|--------|------|---------|
| 400 | `{ "error": "studentId is required" }` | Missing required parameter |
| 429 | `{ "error": "Rate limits exceeded..." }` | AI gateway rate limit |
| 402 | `{ "error": "Payment required..." }` | AI credits exhausted |
| 500 | `{ "error": "..." }` | Server error |
#### Side Effects
1. **If `action === "refresh"`**: Marks current selected recommendations as `status='refreshed'`
2. **Reads** candidate pool via `get_pending_recommendations` RPC
3. **Reads** student profile from `profiles` and `justai_agent_configs`
4. **Calls** Lovable AI Gateway (Gemini-3-flash-preview)
5. **Writes** AI selections via `save_recommendation_reasons` RPC (sets `status='selected'`, saves `reason`)
6. **Returns** final recommendations via `get_ready_recommendations` RPC
---
## 3. LLM Prompting Logic
### 3.1 Overview
The edge function uses the Lovable AI Gateway to call `google/gemini-3-flash-preview` with a strictly constrained prompt.
### 3.2 System Prompt
```
You are an LLM that selects and explains vocabulary recommendations for an ESL student.
Context you must follow exactly:
- You are given a precomputed pool of candidate words (≈150).
- This pool is already filtered by the backend using CEFR level, usage history, and goals.
- You MUST NOT generate explanations for all candidates.
- You MUST select exactly 5 words from the pool.
- You MUST generate a reason ONLY for the 5 selected words.
Your task:
Select exactly 5 words that are:
- Appropriate for the student's CEFR level
- Relevant to the student's interests and learning goals
- Practical for real-world communication
- Not overly generic and not overly obscure
For each selected word, write ONE very short reason explaining why it is useful.
- As concise as possible
- Prefer 5–8 words
- No filler, no adjectives unless necessary
- The reason appears directly in the UI
Do not repeat words.
Do not include emojis.
Do not use markdown, lists, or extra text.
Output JSON only, in the exact format specified.
You may internally use tags (domain, topic, register), CEFR, and other metadata to decide—but do not mention them explicitly.
Output format (must match exactly):
{
  "selections": [
    { "id": 123, "reason": "Used in professional conversations." }
  ]
}
```
### 3.3 User Prompt
```
Student Profile:
- CEFR Level: B1
- Interests: travel, technology
- Learning Goals: improve speaking fluency
Candidate Pool (147 words):
Each item is a possible recommendation. Reasons must NOT be generated for all of them.
Format:
id | lemma (POS) | CEFR | domain: x; topic: y; register: z
1. id=12345 | negotiate (verb) | B2 | domain: business; topic: meetings
2. id=12346 | adventure (noun) | B1 | domain: travel; topic: activities
...
Instructions:
- Select exactly 5 words from the candidate pool.
- Provide one very short reason for each selected word.
- Reasons should explain usefulness for THIS student.
- Output JSON only in the specified format.
```
### 3.4 Candidate Formatting
Each candidate is formatted as:
```
{index}. id={db_id} | {lemma} ({pos}) | {cefr_level} | {tags_string}
```
Where `tags_string` is constructed from the `tags` JSONB field:
```
domain: business, finance; topic: meetings; register: formal
```
### 3.5 Output Contract
| Rule | Enforcement |
|------|-------------|
| Exactly 5 selections | Validated in edge function (returns empty if 0) |
| Each selection has `id` (number) | Parsed from JSON |
| Each selection has `reason` (string) | Parsed from JSON |
| No markdown | Stripped via regex before parsing |
| IDs must exist in candidate pool | Implicitly enforced by database update |
### 3.6 Output Validation
```typescript
// Remove potential markdown code blocks
const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
const parsed = JSON.parse(cleanContent);
selections = parsed.selections || [];
```
### 3.7 Mapping Back to Database
The `save_recommendation_reasons` RPC accepts the AI output directly:
```sql
FOR rec IN SELECT * FROM jsonb_array_elements(recommendations)
LOOP
  UPDATE vocab_recommendations
  SET 
    reason = jsonb_build_object('text', rec->>'reason'),
    status = 'selected',
    acted_at = NOW()
  WHERE id = (rec->>'id')::BIGINT;
END LOOP;
```
---
## 4. Database Tables & Views
### 4.1 Core Tables
| Table | Purpose | Read/Write | Used By |
|-------|---------|------------|---------|
| `vocab_recommendations` | Per-student candidate pool with status tracking | R/W | Edge function, RPCs |
| `recommendation_lexicon` | Master word list with metadata (lemma, pos, cefr, tags) | Read-only | RPCs (joined with vocab_recommendations) |
| `profiles` | Student profile (interests, learning_goals, cefr_level) | Read-only | Edge function |
| `justai_agent_configs` | Authoritative CEFR level for students | Read-only | Edge function |
| `student_goals` | Student's vocabulary goals (wishlist + focus set) | Write | addToGoals mutation |
| `lexemes` | Canonical lexeme data | Read-only | Referenced by lexeme_id |
### 4.2 `vocab_recommendations` Schema
| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGINT | Primary key (used in AI selection) |
| `student_id` | UUID | Foreign key to profiles |
| `lexeme_id` | UUID | Foreign key to lexemes |
| `recommendation_lexicon_id` | BIGINT | Foreign key to recommendation_lexicon |
| `status` | TEXT | `'suggested'`, `'selected'`, `'added'`, `'skipped'`, `'refreshed'` |
| `reason` | JSONB | `{ "text": "AI-generated reason" }` (null until selected) |
| `created_at` | TIMESTAMPTZ | When candidate was added to pool |
| `acted_at` | TIMESTAMPTZ | When status last changed |
### 4.3 Status Values
| Status | Meaning | Included in Pool? |
|--------|---------|-------------------|
| `suggested` | Fresh candidate, never shown | ✅ Yes (priority 1) |
| `refreshed` | Was shown, user clicked Refresh | ✅ Yes (priority 2) |
| `selected` | Currently shown to user | ❌ No |
| `added` | User added to goals | ❌ No |
| `skipped` | User explicitly skipped | ❌ No |
### 4.4 Database RPCs
| RPC | Purpose | Called By |
|-----|---------|-----------|
| `get_pending_recommendations(student_uuid, limit_val)` | Returns ~150 candidates with status `'suggested'` | Edge function |
| `get_ready_recommendations(student_uuid, limit_val)` | Returns up to 5 with status `'selected'` and reason | Frontend hook, Edge function |
| `mark_recommendation_status(rec_id, new_status)` | Updates single recommendation status | Frontend hook (addToGoals), Edge function (refresh) |
| `save_recommendation_reasons(recommendations)` | Batch updates from AI output | Edge function |
---
## 5. Frontend Hooks & Integration Points
### 5.1 `useVocabRecommendations`
| Field | Value |
|-------|-------|
| **Purpose** | Manages the full recommendation lifecycle |
| **Location** | `src/hooks/useVocabRecommendations.ts` |
#### What It Does
1. **On mount**: Queries `get_ready_recommendations` for existing selections
2. **If empty**: Automatically triggers `vocab-select-recommendations` edge function
3. **On refresh**: Calls edge function with `action: 'refresh'`
4. **On add**: Inserts to `student_goals`, marks recommendation as `'added'`
#### Edge Functions Called
- `vocab-select-recommendations` (via direct `fetch`)
#### Inputs
```typescript
useVocabRecommendations(studentId: string | undefined)
```
#### Outputs
```typescript
interface UseVocabRecommendationsResult {
  recommendations: Recommendation[];  // Current 5 displayed words
  isLoading: boolean;                 // Initial load or AI selection in progress
  isRefreshing: boolean;              // Refresh action in progress
  error: Error | null;
  refresh: () => void;                // Trigger new AI selection
  addToGoals: (rec: Recommendation) => Promise<void>;  // Add word to goals
  isAddingToGoals: boolean;
  isEmpty: boolean;                   // No recommendations available
}
interface Recommendation {
  id: number;           // vocab_recommendations.id
  lexeme_id: string;    // UUID for student_goals insertion
  lemma: string;        // Display word
  pos: string | null;   // Part of speech
  cefr_level: string | null;
  reason: string;       // AI-generated personalized reason
}
```
#### Query Keys
| Key | Purpose |
|-----|---------|
| `['vocab-recommendations', studentId]` | Cached recommendations |
| `['vocabulary-builder', studentId]` | Invalidated on addToGoals |
| `['vocabulary-builder-stats', studentId]` | Invalidated on addToGoals |
### 5.2 Chat Integration
> **These hooks must be reused in the chat/mobile app.** The chat app does NOT re-implement recommendation logic. It only calls the same Supabase functions.
The chat app should:
1. Import or replicate the `useVocabRecommendations` hook logic
2. Call the same edge function URL
3. Use the same RPC functions for status updates
4. Write to the same `student_goals` table
---
## 6. Chat / Mobile UI Adaptation Notes
### 6.1 Triggering Recommendations
| Trigger | Implementation |
|---------|----------------|
| User says "suggest words" | Call `useVocabRecommendations` or equivalent |
| User enters Discover section | Auto-load on mount (same as web) |
| Bot proactively suggests | Check `get_ready_recommendations` on session start |
| User says "refresh" | Call `refresh()` function |
### 6.2 Chat Message Rendering
**Recommendation Display**
```
Bot: Here are 5 words recommended for you:
1. **negotiate** (B2, verb)
   "Useful in professional conversations."
   [Add to Goals]
2. **adventure** (B1, noun)
   "Matches your interest in travel."
   [Add to Goals]
...
[🔄 Refresh for new words]
```
**After Adding a Word**
```
User: [taps "Add to Goals" on "negotiate"]
Bot: ✓ Added "negotiate" to your vocabulary goals!
     You now have 23 words in your Goal Pool.
```
### 6.3 Action Mapping
| Chat Action | Hook/Function Call |
|-------------|-------------------|
| View recommendations | `useVocabRecommendations(studentId)` → display `recommendations` |
| Tap "Add to Goals" | `addToGoals(recommendation)` |
| Tap "Refresh" | `refresh()` |
| Dismiss/Skip | (Optional) `mark_recommendation_status(id, 'skipped')` |
### 6.4 Latency Considerations
| Scenario | Expected Latency | Mitigation |
|----------|------------------|------------|
| Initial load with existing recs | ~200ms | Cache with staleTime: 5 min |
| AI selection (first time) | 2-5 seconds | Show "Finding perfect words for you..." |
| Refresh | 2-5 seconds | Show spinner on Refresh button |
| Add to Goals | ~100ms | Optimistic UI update |
### 6.5 Error Handling in Chat
| Error | Chat Response |
|-------|---------------|
| Rate limit (429) | "I'm getting a lot of requests right now. Please try again in a moment." |
| Credits exhausted (402) | "Word recommendations are temporarily unavailable. Try again later." |
| Empty pool | "You've explored all the recommended words! Great progress." |
| Network error | "Couldn't load recommendations. Check your connection and try again." |
### 6.6 State Synchronization
If the user adds a word via chat, the web app's Vocabulary Builder should reflect the change:
1. Both apps share the same `student_goals` table
2. Query invalidation happens via `queryClient.invalidateQueries`
3. If using real-time subscriptions, listen to `student_goals` changes
---
## 7. Re-creation Checklist
### Edge Function Deployment
- [ ] `vocab-select-recommendations` deployed and accessible
- [ ] `LOVABLE_API_KEY` environment variable set
- [ ] `SUPABASE_SERVICE_ROLE_KEY` environment variable set
- [ ] CORS headers allow requests from mobile app origin
### Database RPCs
- [ ] `get_pending_recommendations` returns ~150 candidates
- [ ] `get_ready_recommendations` returns up to 5 selected words
- [ ] `mark_recommendation_status` updates status correctly
- [ ] `save_recommendation_reasons` batch updates work
### Hook Implementation
- [ ] `useVocabRecommendations` equivalent implemented in chat app
- [ ] Initial load queries `get_ready_recommendations`
- [ ] Empty state triggers AI selection
- [ ] Refresh action marks old as `'refreshed'` and fetches new
- [ ] Add to Goals inserts into `student_goals` and marks as `'added'`
### Recommendation Display
- [ ] 5 words displayed with lemma, POS, CEFR level, reason
- [ ] "Add to Goals" action visible per word
- [ ] "Refresh" action visible
- [ ] Loading states during AI selection
- [ ] Error states with retry option
### Goal Integration
- [ ] Added words appear in Goal Pool (is_active_for_lessons = false)
- [ ] Added words visible in Vocabulary Builder
- [ ] Duplicate insertions handled gracefully (ignore 23505 errors)
- [ ] Query cache invalidated after add
### Cross-Platform Sync
- [ ] Words added via chat appear in web app
- [ ] Words added via web app not re-recommended in chat
- [ ] Shared `student_goals` table as source of truth
- [ ] No duplicate recommendation logic between web and chat
---
## Appendix: Candidate Pool Generation
### Pool Requirements
The `vocab_recommendations` table is pre-populated with ~150 candidates per student. The generation logic (not covered in detail here) filters by:
- CEFR level (matching or slightly above student's level)
- Not already in student's goals
- Not already used extensively by student
- Has useful metadata (domain, topic, register tags)
### Pool Refresh Strategy
The pool is a **fixed set** generated at onboarding or periodically. The AI selects from this pool; it does not generate new words. When the user clicks "Refresh":
1. Current 5 `'selected'` words are marked `'refreshed'`
2. `'refreshed'` words go back into the pool (lower priority than `'suggested'`)
3. AI selects 5 new words from the remaining pool
4. If pool is exhausted (all words `'added'` or `'skipped'`), recommendations return empty
---
## Appendix: Student Profile Sources
| Field | Primary Source | Fallback |
|-------|----------------|----------|
| CEFR Level | `justai_agent_configs.cefr_level` | `profiles.cefr_level` → `"B1"` |
| Interests | `profiles.interests` | `["general topics"]` |
| Learning Goals | `profiles.learning_goals` | `["improve English"]` |
---
## Appendix: API Constants
| Constant | Value |
|----------|-------|
| AI Gateway URL | `https://ai.gateway.lovable.dev/v1/chat/completions` |
| AI Model | `google/gemini-3-flash-preview` |
| Temperature | `0.7` |
| Candidate Pool Size | 150 |
| Selection Count | 5 |
| Cache staleTime | 5 minutes |
---
*Document generated: 2026-02-01*
*Source: JustTalk Web Application Codebase*