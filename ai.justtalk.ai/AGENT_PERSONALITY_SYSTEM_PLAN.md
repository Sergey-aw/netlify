# Agent Personality System - Implementation Plan

## ⚡ OPTIMIZED APPROACH - Single Table Schema

**See `JUSTAI_AGENTS_SCHEMA.md` for full details of the optimized implementation.**

### Key Changes from Original Plan:
- ✅ **1 table instead of 4** (`justai_agents` stores everything)
- ✅ **Categories are strings**, not separate table (simpler, more flexible)
- ✅ **Personality names are strings**, not FK references
- ✅ **Hierarchical via self-reference** (parent_agent_id)
- ✅ **Easier migration** from existing `elevenlabs-agents.ts`
- ✅ **Fewer JOINs** needed for queries

---

## Executive Summary

Simplified agent-based roleplay system where:
- **Categories** are defined in agent configuration (e.g., Interview, Dating, Business)
- Each category has a **pre-selected persona** (represented by an ElevenLabs agent ID with defined behavior)
- Each persona has multiple **role-play scenarios** within the category
- Role-plays can have **multi-step progressions** (e.g., 5-step interview)
- Each **step is represented by its own ElevenLabs agent ID**
- Steps are **unlocked progressively** based on conversation milestones
- User **progress is tracked** per scenario and step

---

## Current System Analysis

### What We Have Now:
1. **Flat Agent List**: All agents in one array with category tags
2. **No Progress Tracking**: Users can access any role-play anytime
3. **Single-Step Role-plays**: Each agent = one conversation session
4. **No Persona Context**: Agents lack character/personality framing

### What Changes:
1. **Category-Based Organization**: Categories come from agent config, displayed first
2. **Pre-Selected Personas**: Each category has a default persona (agent ID with defined behavior on ElevenLabs)
3. **Hierarchical Structure**: Category → Persona → Scenarios → Steps (each step = agent_id)
4. **Progress Tracking**: Database tracks completed steps and unlock conditions
5. **Multi-Step Role-plays**: Role-plays can have sequential steps with unlock requirements
6. **Agent-Based Architecture**: Each persona and step is represented by an ElevenLabs agent ID

---

## System Architecture

### Data Model Hierarchy

```
Category (from agent config: Interview, Dating, Business, etc.)
├── Persona (Pre-selected, represented by agent_id)
│   ├── Character Description (additional context)
│   └── Default Behavior (defined in ElevenLabs agent)
└── Role-Play Scenarios
    └── Steps (Step 1, Step 2, ..., Step N)
        └── ElevenLabs Agent ID (each step = unique agent)
```

### Example Structure

```
Interview Preparation (Category - from agent config)
├── Persona: Sarah - Professional Coach [agent_sarah_interview_001]
│   └── Character: "Experienced career coach, encouraging style, patient and detail-oriented"
└── Role-Play Scenarios:
    ├── Tell Me About Yourself (Role-play)
    │   └── Step 1: Introduction [agent_abc123]
    ├── Strengths and Weaknesses (Role-play)
    │   ├── Step 1: Initial Response [agent_def456]
    │   ├── Step 2: Deep Dive [agent_ghi789] 🔒 (requires Step 1)
    │   └── Step 3: STAR Method [agent_jkl012] 🔒 (requires Step 2 + 50 messages)
    └── 5-Step Mock Interview (Role-play)
        ├── Step 1: Introduction & Small Talk [agent_xxx111]
        ├── Step 2: Background Questions [agent_xxx222] 🔒
        ├── Step 3: Behavioral Questions [agent_xxx333] 🔒
        ├── Step 4: Technical Questions [agent_xxx444] 🔒
        └── Step 5: Closing & Questions [agent_xxx555] 🔒

Dating & Relationships (Category - from agent config)
├── Persona: Maya Chen - Dating Expert [agent_maya_dating_001]
│   └── Character: "Warm dating coach, gentle style, empathetic and supportive"
└── Role-Play Scenarios:
    ├── Coffee Shop Meet (Role-play)
    │   ├── Step 1: Initial Meeting [agent_zzz111]
    │   └── Step 2: Deeper Connection [agent_zzz222] 🔒
    └── Restaurant Date (Role-play)
        └── Step 1: Dinner Conversation [agent_www111]

Business Communication (Category - from agent config)
├── Persona: Sarah - Professional Coach [agent_sarah_business_001]
│   └── Character: "Same persona as Interview, different context"
└── Role-Play Scenarios:
    └── Status Updates (Role-play)
        └── Step 1: Weekly Report [agent_yyy111]
```

---

## Database Schema Changes

### 1. New Table: `justai_personalities`

Replaces the need for multiple voice preferences.

```sql
CREATE TABLE public.justai_personalities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Personality details
  name TEXT NOT NULL, -- "Sarah - Professional Coach", "Maya - Dating Expert"
  short_name TEXT NOT NULL, -- "Sarah", "Maya"
  description TEXT NOT NULL, -- "Experienced career coach specializing in interviews"
  avatar_url TEXT, -- URL to personality avatar image
  
  -- Personality traits (for system prompt generation)
  teaching_style TEXT, -- "encouraging", "direct", "gentle"
  expertise_areas TEXT[], -- ["interviews", "business", "networking"]
  personality_traits TEXT[], -- ["patient", "detail-oriented", "motivating"]
  
  -- NOTE: Voice is determined at the roleplay_step level, not personality level
  -- Each scenario/step can have different voices while maintaining the same personality
  
  -- Metadata
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sample data
INSERT INTO justai_personalities (name, short_name, description, teaching_style, expertise_areas) VALUES
  ('Sarah - Professional Coach', 'Sarah', 'Experienced career coach specializing in interviews and business communication', 'encouraging', ARRAY['interviews', 'business', 'networking']),
  ('Maya - Dating Expert', 'Maya', 'Warm and empathetic dating coach helping you build meaningful connections', 'gentle', ARRAY['dating', 'relationships', 'social']);
```

### 2. New Table: `justai_roleplay_categories`

Organize role-plays into categories within each personality.

```sql
CREATE TABLE public.justai_roleplay_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  personality_id UUID NOT NULL REFERENCES justai_personalities(id) ON DELETE CASCADE,
  
  -- Category details
  name TEXT NOT NULL, -- "Interview Preparation", "Dating Scenarios"
  description TEXT,
  icon TEXT, -- Emoji or icon identifier
  
  -- Metadata
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(personality_id, name)
);

CREATE INDEX idx_roleplay_categories_personality ON justai_roleplay_categories(personality_id);
```

### 3. New Table: `justai_roleplays`

Individual role-play scenarios (can be single or multi-step).

```sql
CREATE TABLE public.justai_roleplays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES justai_roleplay_categories(id) ON DELETE CASCADE,
  
  -- Role-play details
  name TEXT NOT NULL, -- "Tell Me About Yourself", "5-Step Mock Interview"
  description TEXT NOT NULL,
  scenario_context TEXT, -- Additional context for the role-play
  
  -- Structure
  is_multi_step BOOLEAN NOT NULL DEFAULT false,
  total_steps INTEGER NOT NULL DEFAULT 1,
  estimated_duration_minutes INTEGER, -- Total estimated time
  
  -- Difficulty & Requirements
  difficulty_level TEXT CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
  recommended_cefr_level TEXT, -- 'A1', 'B2', etc.
  
  -- Metadata
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_premium BOOLEAN NOT NULL DEFAULT false, -- Require premium subscription
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_roleplays_category ON justai_roleplays(category_id);
CREATE INDEX idx_roleplays_active ON justai_roleplays(is_active);
```

### 4. New Table: `justai_roleplay_steps`

Individual steps within a role-play (each maps to an ElevenLabs agent).

```sql
CREATE TABLE public.justai_roleplay_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roleplay_id UUID NOT NULL REFERENCES justai_roleplays(id) ON DELETE CASCADE,
  
  -- Step details
  step_number INTEGER NOT NULL, -- 1, 2, 3, 4, 5
  name TEXT NOT NULL, -- "Introduction", "Deep Dive Questions"
  description TEXT,
  instructions TEXT, -- Instructions shown to user before starting this step
  
  -- ElevenLabs integration
  elevenlabs_agent_id TEXT NOT NULL, -- The actual ElevenLabs agent ID (includes voice config)
  estimated_duration_minutes INTEGER,
  
  -- Voice is embedded in the ElevenLabs agent configuration
  -- Each agent_id represents a unique combination of:
  --   - Personality/character
  --   - Voice (tone, style, accent)
  --   - Scenario context
  --   - Conversation goals
  
  -- Unlock requirements (NULL = unlocked by default)
  unlock_condition_type TEXT CHECK (unlock_condition_type IN (
    'previous_step', -- Complete previous step
    'message_count', -- Send X messages in previous step
    'time_spent', -- Spend X minutes in previous step
    'score_threshold', -- Achieve X score in previous step
    'manual_unlock' -- Teacher/admin manually unlocks
  )),
  unlock_condition_value INTEGER, -- The threshold value (e.g., 50 messages)
  unlock_previous_step_id UUID REFERENCES justai_roleplay_steps(id), -- Which step must be completed
  
  -- Metadata
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(roleplay_id, step_number)
);

CREATE INDEX idx_roleplay_steps_roleplay ON justai_roleplay_steps(roleplay_id);
CREATE INDEX idx_roleplay_steps_agent ON justai_roleplay_steps(elevenlabs_agent_id);
```

### 5. New Table: `justai_student_progress`

Track user progress through personalities, role-plays, and steps.

```sql
CREATE TABLE public.justai_student_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  roleplay_step_id UUID NOT NULL REFERENCES justai_roleplay_steps(id) ON DELETE CASCADE,
  
  -- Progress tracking
  status TEXT NOT NULL DEFAULT 'locked' CHECK (status IN (
    'locked',     -- Not yet unlocked
    'unlocked',   -- Available to start
    'in_progress', -- Started but not completed
    'completed',  -- Finished
    'archived'    -- Completed and archived to start a new roleplay
  )),
  
  -- Completion metrics
  sessions_count INTEGER NOT NULL DEFAULT 0, -- How many times user practiced this step
  total_messages_sent INTEGER NOT NULL DEFAULT 0,
  total_time_spent_seconds INTEGER NOT NULL DEFAULT 0,
  
  -- Scoring (NEW: Track scores across all sessions)
  best_session_score INTEGER, -- 0-100 score from AI analysis (highest score achieved)
  latest_session_score INTEGER, -- 0-100 score from most recent session
  average_session_score DECIMAL(5,2), -- Average score across all sessions
  total_score_sum INTEGER NOT NULL DEFAULT 0, -- Sum of all session scores (for calculating average)
  best_session_conversation_id UUID REFERENCES justai_conversations(id),
  
  -- Unlock tracking
  unlocked_at TIMESTAMPTZ,
  first_started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ, -- NEW: When roleplay was archived
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(student_id, roleplay_step_id)
);

CREATE INDEX idx_student_progress_student ON justai_student_progress(student_id);
CREATE INDEX idx_student_progress_step ON justai_student_progress(roleplay_step_id);
CREATE INDEX idx_student_progress_status ON justai_student_progress(student_id, status);
CREATE INDEX idx_student_progress_archived ON justai_student_progress(student_id, archived_at) WHERE archived_at IS NOT NULL;
```

### 6. Modified Table: `profiles`

Replace voice preference with personality preference.

```sql
-- Remove old column (after migration)
ALTER TABLE profiles DROP COLUMN IF EXISTS justai_preferred_voice;

-- Add new column
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS justai_preferred_personality UUID 
  REFERENCES justai_personalities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_personality ON profiles(justai_preferred_personality);
```

### 7. Modified Table: `justai_conversations`

Add references to personality, role-play step, and conversation score.

```sql
ALTER TABLE justai_conversations 
  ADD COLUMN IF NOT EXISTS personality_id UUID REFERENCES justai_personalities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS roleplay_step_id UUID REFERENCES justai_roleplay_steps(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS conversation_score INTEGER CHECK (conversation_score >= 0 AND conversation_score <= 100),
  ADD COLUMN IF NOT EXISTS score_calculated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_conversations_personality ON justai_conversations(personality_id);
CREATE INDEX IF NOT EXISTS idx_conversations_roleplay_step ON justai_conversations(roleplay_step_id);
CREATE INDEX IF NOT EXISTS idx_conversations_score ON justai_conversations(conversation_score) WHERE conversation_score IS NOT NULL;
```

---

## System Flow Diagrams

### Diagram 1: User Onboarding Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    ONBOARDING FLOW                          │
└─────────────────────────────────────────────────────────────┘

User Signs Up
     │
     ▼
┌─────────────────────┐
│ Select Personality  │ ← NEW: Replace voice selection
│   - Sarah (Coach)   │
│   - Maya (Dating)   │
│   - Alex (Travel)   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Set Profile Prefs   │
│  - CEFR Level       │
│  - Learning Goals   │
│  - Correction Style │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Save to Database    │
│  profiles table:    │
│  - preferred_       │
│    personality_id   │
└──────────┬──────────┘
           │
           ▼
    Home Screen
```

### Diagram 2: Role-Play Selection Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                   ROLE-PLAY SELECTION FLOW                       │
└──────────────────────────────────────────────────────────────────┘

User Opens "Role-plays"
     │
     ▼
┌──────────────────────────────────────────┐
│ Display Categories (from agent config)   │
│  ┌─────────────────────────────────────┐ │
│  │ 📋 Interview Preparation            │ │
│  │ 💼 Business Communication           │ │
│  │ 💕 Dating & Relationships           │ │
│  │ 🌏 Travel Scenarios                 │ │
│  │ 🏥 Daily Life                       │ │
│  └─────────────────────────────────────┘ │
└────────────┬─────────────────────────────┘
             │
             ▼ (User taps category)
┌──────────────────────────────────────────┐
│ Display Pre-Selected Persona             │
│  ┌─────────────────────────────────────┐ │
│  │ 👩‍💼 Sarah - Professional Coach       │ │
│  │ "Encouraging career coach            │ │
│  │  specializing in interviews"         │ │
│  │                                      │ │
│  │ [agent_sarah_interview_001]          │ │
│  └─────────────────────────────────────┘ │
└────────────┬─────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────┐
│ Fetch Role-plays in Category             │
│ + Join with student_progress             │
└────────────┬─────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────┐
│ Display Scenarios with Progress                      │
│  ┌──────────────────────────────────────────────┐   │
│  │ ✅ Tell Me About Yourself (Completed)        │   │
│  │    [agent_abc123]                            │   │
│  ├──────────────────────────────────────────────┤   │
│  │ 🔓 Strengths & Weaknesses (1/3 steps)        │   │
│  │    Progress: ▓▓▓▓░░░░░░ 33%                  │   │
│  │    Step 1: [agent_def456] ✅                 │   │
│  │    Step 2: [agent_ghi789] 🔓                 │   │
│  │    Step 3: [agent_jkl012] 🔒                 │   │
│  ├──────────────────────────────────────────────┤   │
│  │ 🔒 5-Step Mock Interview (Locked)            │   │
│  │    Complete "Strengths" first                │   │
│  └──────────────────────────────────────────────┘   │
└────────────┬─────────────────────────────────────────┘
             │
             ▼ (User taps unlocked step)
┌──────────────────────────────────────────┐
│ Start Conversation with Step Agent       │
│ Load agent_id for selected step          │
└────────────┬─────────────────────────────┘
             │
             ▼
    Voice Conversation Session
```

### Diagram 3: Multi-Step Role-Play Progress Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│              MULTI-STEP ROLE-PLAY PROGRESSION                        │
└─────────────────────────────────────────────────────────────────────┘

User Selects "5-Step Mock Interview"
     │
     ▼
┌────────────────────────────────────────────────────────────┐
│ Fetch All Steps + Progress                                 │
│                                                             │
│  Step 1: Introduction ✅ (Completed)                       │
│  Step 2: Background ✅ (Completed)                         │
│  Step 3: Behavioral 🔓 (Unlocked - Current)                │
│  Step 4: Technical 🔒 (Locked: Complete Step 3)            │
│  Step 5: Closing 🔒 (Locked: Complete Step 4 + 50 msgs)    │
└────────────┬───────────────────────────────────────────────┘
             │
             ▼ (User starts Step 3)
┌────────────────────────────────────────────────────────────┐
│ Load ElevenLabs Agent for Step 3                           │
│  - Get elevenlabs_agent_id from roleplay_steps             │
│  - Pass to conversation initialization                     │
└────────────┬───────────────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────────┐
│ Start Voice Conversation                                   │
│  - Create justai_conversations record                      │
│  - Link to roleplay_step_id, personality_id                │
│  - Update student_progress.status = 'in_progress'          │
└────────────┬───────────────────────────────────────────────┘
             │
             ▼
     User Practices
     (conversation happens)
             │
             ▼
┌────────────────────────────────────────────────────────────┐
│ End Session                                                 │
│  - Save conversation transcript                            │
│  - Update student_progress:                                │
│    • sessions_count += 1                                   │
│    • total_messages_sent += X                              │
│    • total_time_spent_seconds += Y                         │
└────────────┬───────────────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────────┐
│ Check Completion Criteria                                  │
│  - Did user complete the step? (e.g., 20+ messages)        │
│  - Update status = 'completed'                             │
│  - Set completed_at timestamp                              │
└────────────┬───────────────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────────┐
│ Check & Unlock Next Step                                   │
│                                                             │
│  IF Step 3 completed:                                      │
│    → Unlock Step 4                                         │
│    → Update student_progress.status = 'unlocked'           │
│    → Set unlocked_at timestamp                             │
│                                                             │
│  IF Step 4 completed + user sent 50+ total messages:      │
│    → Unlock Step 5                                         │
└────────────┬───────────────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────────┐
│ Show Progress Update                                       │
│  "🎉 Step 3 completed! Step 4 unlocked."                   │
└────────────────────────────────────────────────────────────┘
```

### Diagram 4: Database Relationships

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DATABASE SCHEMA                                 │
                          justai_personalities
                          ├── id (PK)
                          ├── name
                          ├── teaching_style
                          └── expertise_areas
                                    │
                                    │ (personality has many agents)
                                    │ (through categories → roleplays → steps)
                                    │
                                    ▼
                          justai_personalities
                          ├── id (PK)
                          ├── name
                          ├── voice_id
                          └── teaching_style
                                    │
                                    │ 1:N
                                    ▼
                          justai_roleplay_categories
                          ├── id (PK)
                          ├── personality_id (FK)
                          └── name
                                    │
                                    │ 1:N
                                    ▼
                          justai_roleplays
                          ├── id (PK)
                          ├── category_id (FK)
                          ├── is_multi_step
                          └── total_steps
                                    │
                                    │ 1:N
                                    ▼
                          justai_roleplay_steps
                          ├── id (PK)
                          ├── roleplay_id (FK)
                          ├── step_number
                          ├── elevenlabs_agent_id ←── MAPS TO AGENT
                          ├── unlock_condition_type
                          └── unlock_condition_value
                                    │
                                    │ 1:N
                                    ▼
                          justai_student_progress
                          ├── id (PK)
                          ├── student_id (FK → profiles)
                          ├── roleplay_step_id (FK)
                          ├── status (locked/unlocked/in_progress/completed)
                          ├── sessions_count
                          ├── total_messages_sent
                          └── completed_at

                          justai_conversations
                          ├── id (PK)
                          ├── student_id (FK)
                          ├── personality_id (FK) ──┐
                          └── roleplay_step_id (FK) │
                                                     │
                                                     └──→ Links conversations
                                                          to specific steps
```

---

## Implementation Steps

### Phase 1: Database Setup (Week 1)

**Priority: Critical**

1. **Create Migration File**
   ```bash
   # Create new migration
   supabase migration new agent_personality_system
   ```

2. **Add Tables in Order** (due to FK dependencies):
   - ✅ `justai_personalities`
   - ✅ `justai_roleplay_categories`
   - ✅ `justai_roleplays`
   - ✅ `justai_roleplay_steps`
   - ✅ `justai_student_progress`

3. **Modify Existing Tables**:
   - ✅ `profiles` - add `justai_preferred_personality`
   - ✅ `justai_conversations` - add `personality_id`, `roleplay_step_id`

4. **Enable RLS Policies**:
   ```sql
   -- Students can view active personalities
   CREATE POLICY "Students can view active personalities"
     ON justai_personalities FOR SELECT
     USING (is_active = true);

   -- Students can view their own progress
   CREATE POLICY "Students can view own progress"
     ON justai_student_progress FOR SELECT
     USING (auth.uid() = student_id);

   -- Students can update their own progress
   CREATE POLICY "Students can update own progress"
     ON justai_student_progress FOR UPDATE
     USING (auth.uid() = student_id);
   ```

5. **Create Helper Functions**:
   ```sql
   -- Function to auto-unlock first step of any role-play
   CREATE OR REPLACE FUNCTION unlock_roleplay_first_step(
     p_student_id UUID,
     p_roleplay_id UUID
   ) RETURNS void AS $$
   BEGIN
     INSERT INTO justai_student_progress (
       student_id, 
       roleplay_step_id, 
       status, 
       unlocked_at
     )
     SELECT 
       p_student_id,
       id,
       'unlocked',
       NOW()
     FROM justai_roleplay_steps
     WHERE roleplay_id = p_roleplay_id
       AND step_number = 1
     ON CONFLICT (student_id, roleplay_step_id) 
     DO NOTHING;
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;

   -- Function to archive current roleplay progress
   CREATE OR REPLACE FUNCTION archive_roleplay_progress(
     p_student_id UUID,
     p_roleplay_id UUID
   ) RETURNS void AS $$
   BEGIN
     -- Archive all steps in the roleplay
     UPDATE justai_student_progress
     SET 
       status = 'archived',
       archived_at = NOW(),
       updated_at = NOW()
     WHERE student_id = p_student_id
       AND roleplay_step_id IN (
         SELECT id FROM justai_roleplay_steps
         WHERE roleplay_id = p_roleplay_id
       )
       AND status IN ('unlocked', 'in_progress', 'completed');
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;

   -- Function to update conversation score and progress
   CREATE OR REPLACE FUNCTION update_conversation_score(
     p_conversation_id UUID,
     p_score INTEGER
   ) RETURNS void AS $$
   DECLARE
     v_student_id UUID;
     v_roleplay_step_id UUID;
     v_current_sessions_count INTEGER;
   BEGIN
     -- Get conversation details
     SELECT student_id, roleplay_step_id
     INTO v_student_id, v_roleplay_step_id
     FROM justai_conversations
     WHERE id = p_conversation_id;

     -- Update conversation score
     UPDATE justai_conversations
     SET 
       conversation_score = p_score,
       score_calculated_at = NOW()
     WHERE id = p_conversation_id;

     -- Update student progress with score
     IF v_roleplay_step_id IS NOT NULL THEN
       -- Get current sessions count
       SELECT sessions_count INTO v_current_sessions_count
       FROM justai_student_progress
       WHERE student_id = v_student_id
         AND roleplay_step_id = v_roleplay_step_id;

       UPDATE justai_student_progress
       SET
         latest_session_score = p_score,
         best_session_score = GREATEST(COALESCE(best_session_score, 0), p_score),
         total_score_sum = total_score_sum + p_score,
         average_session_score = (total_score_sum + p_score)::DECIMAL / GREATEST(v_current_sessions_count, 1),
         best_session_conversation_id = CASE 
           WHEN p_score > COALESCE(best_session_score, 0) THEN p_conversation_id
           ELSE best_session_conversation_id
         END,
         updated_at = NOW()
       WHERE student_id = v_student_id
         AND roleplay_step_id = v_roleplay_step_id;
     END IF;
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;

   -- Function to check and unlock next step
   CREATE OR REPLACE FUNCTION check_unlock_next_step(
     p_student_id UUID,
     p_current_step_id UUID
   ) RETURNS void AS $$
   DECLARE
     v_current_step justai_roleplay_steps;
     v_next_step justai_roleplay_steps;
     v_progress justai_student_progress;
     v_should_unlock BOOLEAN;
   BEGIN
     -- Get current step info
     SELECT * INTO v_current_step
     FROM justai_roleplay_steps
     WHERE id = p_current_step_id;

     -- Get next step in sequence
     SELECT * INTO v_next_step
     FROM justai_roleplay_steps
     WHERE roleplay_id = v_current_step.roleplay_id
       AND step_number = v_current_step.step_number + 1;

     IF v_next_step.id IS NULL THEN
       -- No next step, this was the last one
       RETURN;
     END IF;

     -- Get current step progress
     SELECT * INTO v_progress
     FROM justai_student_progress
     WHERE student_id = p_student_id
       AND roleplay_step_id = p_current_step_id;

     -- Check unlock condition
     v_should_unlock := false;

     CASE v_next_step.unlock_condition_type
       WHEN 'previous_step' THEN
         v_should_unlock := (v_progress.status = 'completed');
       
       WHEN 'message_count' THEN
         v_should_unlock := (
           v_progress.status = 'completed' AND
           v_progress.total_messages_sent >= v_next_step.unlock_condition_value
         );
       
       WHEN 'time_spent' THEN
         v_should_unlock := (
           v_progress.status = 'completed' AND
           v_progress.total_time_spent_seconds >= (v_next_step.unlock_condition_value * 60)
         );
       
       ELSE
         v_should_unlock := false;
     END CASE;

     -- Unlock if conditions met
     IF v_should_unlock THEN
       INSERT INTO justai_student_progress (
         student_id,
         roleplay_step_id,
         status,
         unlocked_at
       ) VALUES (
         p_student_id,
         v_next_step.id,
         'unlocked',
         NOW()
       )
       ON CONFLICT (student_id, roleplay_step_id)
       DO UPDATE SET
         status = 'unlocked',
         unlocked_at = NOW();
     END IF;
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;
   ```

6. **Deploy Migration**:
   ```bash
   supabase db push
   ```

---

### Phase 2: Seed Data (Week 1)

**Priority: Critical**

1. **Create Personalities**
   ```sql
   -- File: seed-personalities.sql
   INSERT INTO justai_personalities (name, short_name, description, voice_id, teaching_style, expertise_areas) VALUES
     (
       'Sarah - Professional Coach',
       'Sarah',
       'Experienced career coach specializing in interviews and business communication',
       'EXAVITQu4vr4xnSDxMaL', -- Replace with actual voice ID
       'encouraging',
       ARRAY['interviews', 'business', 'networking']
     ),
     (
       'Maya - Dating Expert',
       'Maya',
       'Warm and empathetic dating coach helping you build meaningful connections',
       'pNInz6obpgDQGcFmaJgB', -- Replace with actual voice ID
       'gentle',
       ARRAY['dating', 'relationships', 'social']
     );
   ```

2. **Migrate Existing Agents to New Structure**

   Create a script to convert the current flat agent list into the hierarchical structure:

   ```typescript
   // scripts/migrate-agents-to-personalities.ts
   
   const agentMapping = {
     'Sarah - Professional Coach': {
       categories: {
         'Interview Preparation': [
           {
             roleplay: 'Tell Me About Yourself',
             steps: [
               { name: 'Introduction', agentId: 'agent_7801kc7yfx17fqa80c7d5favvdnm' }
             ]
           },
           {
             roleplay: 'Strengths and Weaknesses',
             steps: [
               { name: 'Step 1: Initial Response', agentId: 'agent_7101kc7yqwnyef7867pkh9epas2b' },
               { name: 'Step 2: Deep Dive', agentId: 'agent_NEW_123', unlock: 'previous_step' },
               { name: 'Step 3: STAR Method', agentId: 'agent_NEW_456', unlock: 'message_count', unlockValue: 50 }
             ]
           },
           {
             roleplay: '5-Step Mock Interview',
             isMultiStep: true,
             steps: [
               { name: 'Introduction & Small Talk', agentId: 'agent_0401kbzbr6z5ezb867w9h3zsthwt' },
               { name: 'Background Questions', agentId: 'agent_6301kbzbpp6xfezsw2zrf71vvkah', unlock: 'previous_step' },
               { name: 'Behavioral Questions', agentId: 'agent_9401kbzbmks4f4btzs4yy7ny36qp', unlock: 'previous_step' },
               { name: 'Technical Questions', agentId: 'agent_NEW_789', unlock: 'previous_step' },
               { name: 'Closing & Questions', agentId: 'agent_NEW_012', unlock: 'message_count', unlockValue: 50 }
             ]
           }
         ],
         'Business Communication': [
           {
             roleplay: 'Giving a Status Update',
             steps: [
               { name: 'Weekly Report', agentId: 'agent_7101kc805a5tes7r911sebmqcyzs' }
             ]
           }
         ]
       }
     },
     'Maya - Dating Expert': {
       categories: {
         'Dating Scenarios': [
           {
             roleplay: 'First Date - Coffee Shop',
             isMultiStep: true,
             steps: [
               { name: 'Initial Meeting', agentId: 'agent_8801kc9vqcphf2c8h1ft1z2jbmng' },
               { name: 'Deeper Connection', agentId: 'agent_4501kca0jwe6fvbv74amm8fp9bf4', unlock: 'previous_step' }
             ]
           }
         ]
       }
     }
   };
   ```

3. **Insert Seed Data via Script**
   ```bash
   # Run seed script
   npm run seed:personalities
   ```

---

   -- Function to update progress after session
   CREATE OR REPLACE FUNCTION update_student_progress(
     p_student_id UUID,
     p_roleplay_step_id UUID,
     p_messages_sent INTEGER,
     p_time_spent_seconds INTEGER,
     p_conversation_id UUID DEFAULT NULL
   ) RETURNS void AS $$
   DECLARE
     v_current_status TEXT;
   BEGIN
     -- Get current status
     SELECT status INTO v_current_status
     FROM justai_student_progress
     WHERE student_id = p_student_id
       AND roleplay_step_id = p_roleplay_step_id;

     INSERT INTO justai_student_progress (
       student_id,
       roleplay_step_id,
       status,
       sessions_count,
       total_messages_sent,
       total_time_spent_seconds,
       first_started_at
     ) VALUES (
       p_student_id,
       p_roleplay_step_id,
       'in_progress',
       1,
       p_messages_sent,
       p_time_spent_seconds,
       NOW()
     )
     ON CONFLICT (student_id, roleplay_step_id)
     DO UPDATE SET
       sessions_count = justai_student_progress.sessions_count + 1,
       total_messages_sent = justai_student_progress.total_messages_sent + p_messages_sent,
       total_time_spent_seconds = justai_student_progress.total_time_spent_seconds + p_time_spent_seconds,
       status = CASE 
         -- Don't change status if already completed or archived
         WHEN justai_student_progress.status IN ('completed', 'archived') THEN justai_student_progress.status
         ELSE 'in_progress'
       END,
       updated_at = NOW();

     -- If conversation_id provided, fetch and update score
     IF p_conversation_id IS NOT NULL THEN
       PERFORM update_conversation_score(p_conversation_id, 
         (SELECT conversation_score FROM justai_conversations WHERE id = p_conversation_id)
       );
     END IF;
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;
     return structure;
   }
   ```

2. **Update Edge Function: `process-voice-session`**

   Add logic to update student progress and score after session ends.

   ```typescript
   // After saving transcript and usage...
   
   // Calculate conversation score (0-100) using AI analysis
   const conversationScore = await calculateConversationScore({
     transcript,
     scenario,
     messageCount,
     grammarErrors,
     vocabularyUsed
   });
   
   // Save score to conversation
   await supabase
     .from('justai_conversations')
     .update({ 
       conversation_score: conversationScore,
       score_calculated_at: new Date().toISOString()
     })
     .eq('id', conversationId);
   
   // Update progress with score
   await supabase.rpc('update_student_progress', {
     p_student_id: studentId,
     p_roleplay_step_id: roleplayStepId,
     p_messages_sent: messageCount,
     p_time_spent_seconds: sessionDuration,
     p_conversation_id: conversationId
   });
   
   // Check if step is completed (e.g., 20+ messages)
   if (messageCount >= 20) {
     await supabase.rpc('mark_step_completed', {
       p_student_id: studentId,
       p_roleplay_step_id: roleplayStepId
     });
     
     // Try to unlock next step
     await supabase.rpc('check_unlock_next_step', {
       p_student_id: studentId,
       p_current_step_id: roleplayStepId
     });
   }
   ```

3. **Create Database Functions**:
   ```sql
   -- Function to update progress after session
   CREATE OR REPLACE FUNCTION update_student_progress(
     p_student_id UUID,
     p_roleplay_step_id UUID,
     p_messages_sent INTEGER,
     p_time_spent_seconds INTEGER
   ) RETURNS void AS $$
   BEGIN
     INSERT INTO justai_student_progress (
       student_id,
       roleplay_step_id,
       status,
       sessions_count,
       total_messages_sent,
       total_time_spent_seconds,
       first_started_at
     ) VALUES (
       p_student_id,
       p_roleplay_step_id,
       'in_progress',
       1,
       p_messages_sent,
       p_time_spent_seconds,
       NOW()
     )
     ON CONFLICT (student_id, roleplay_step_id)
     DO UPDATE SET
       sessions_count = justai_student_progress.sessions_count + 1,
       total_messages_sent = justai_student_progress.total_messages_sent + p_messages_sent,
       total_time_spent_seconds = justai_student_progress.total_time_spent_seconds + p_time_spent_seconds,
       updated_at = NOW();
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;

   -- Function to mark step as completed
   CREATE OR REPLACE FUNCTION mark_step_completed(
     p_student_id UUID,
     p_roleplay_step_id UUID
   ) RETURNS void AS $$
   BEGIN
     UPDATE justai_student_progress
     SET 
       status = 'completed',
       completed_at = NOW(),
       updated_at = NOW()
     WHERE student_id = p_student_id
       AND roleplay_step_id = p_roleplay_step_id
       AND status != 'completed';
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;
   ```

---

### Phase 4: Frontend Updates (Week 2-3)

**Priority: High**

#### 4.1 Update Configuration

1. **Deprecate `elevenlabs-agents.ts`**
   
   Keep for reference but fetch data from database instead.

2. **Create New Types**
   
   ```typescript
   // src/types/roleplay.ts
   
   export interface Personality {
     id: string;
     name: string;
     short_name: string;
     description: string;
     avatar_url: string | null;
     voice_id: string;
     teaching_style: string;
     expertise_areas: string[];
   }
   
   export interface RoleplayCategory {
     id: string;
     personality_id: string;
     name: string;
     description: string | null;
     icon: string | null;
     display_order: number;
   }
   
   export interface Roleplay {
   export interface StudentProgress {
     id: string;
     student_id: string;
     roleplay_step_id: string;
     status: 'locked' | 'unlocked' | 'in_progress' | 'completed' | 'archived';
     sessions_count: number;
     total_messages_sent: number;
     total_time_spent_seconds: number;
     best_session_score: number | null;
     latest_session_score: number | null;
     average_session_score: number | null;
     completed_at: string | null;
     archived_at: string | null;
   }
   export interface RoleplayStep {
     id: string;
     roleplay_id: string;
     step_number: number;
     name: string;
     description: string | null;
     elevenlabs_agent_id: string;
     unlock_condition_type: string | null;
     unlock_condition_value: number | null;
   }
   
   export interface StudentProgress {
     id: string;
     student_id: string;
     roleplay_step_id: string;
     status: 'locked' | 'unlocked' | 'in_progress' | 'completed';
     sessions_count: number;
     total_messages_sent: number;
     total_time_spent_seconds: number;
     completed_at: string | null;
   }
   ```

#### 4.2 Update Onboarding

1. **Replace Voice Selection with Personality Selection**
   
   ```tsx
   // src/pages/onboarding/OnboardingPreferences.tsx
   
   export default function OnboardingPreferences() {
     const [selectedPersonality, setSelectedPersonality] = useState<string>('');
     
     const { data: personalities } = useQuery({
       queryKey: ['personalities'],
       queryFn: async () => {
         const { data } = await supabase
           .from('justai_personalities')
           .select('*')
           .eq('is_active', true)
           .order('display_order');
         return data;
       }
     });
     
     return (
       <div className="personality-selection">
         <h2>Choose Your AI Teacher</h2>
         <div className="personality-grid">
           {personalities?.map(p => (
             <PersonalityCard
               key={p.id}
               personality={p}
               selected={selectedPersonality === p.id}
               onSelect={() => setSelectedPersonality(p.id)}
             />
           ))}
         </div>
       </div>
     );
   }
   ```

2. **Save Personality to Profile**
   
   ```typescript
   await supabase
     .from('profiles')
     .update({ justai_preferred_personality: selectedPersonality })
     .eq('id', user.id);
   ```

#### 4.3 Update Role-Plays Page

1. **Fetch Hierarchical Data**
   
   ```tsx
   // src/pages/RolePlays.tsx
   
   export default function RolePlays() {
     const { data: structure } = useQuery({
       queryKey: ['roleplay-structure'],
       queryFn: async () => {
         const { data: { user } } = await supabase.auth.getUser();
         
         // Get user's personality
         const { data: profile } = await supabase
           .from('profiles')
           .select('justai_preferred_personality')
           .eq('id', user.id)
           .single();
         
         // Fetch structure from edge function
         const response = await fetch(
           `${SUPABASE_URL}/functions/v1/get-roleplay-structure`,
           {
             method: 'POST',
             headers: {
               'Authorization': `Bearer ${accessToken}`,
               'Content-Type': 'application/json'
             },
             body: JSON.stringify({
               personality_id: profile.justai_preferred_personality
             })
           }
         );
         
2. **Display Progress, Lock Status & Scores**
   
   ```tsx
   // src/components/RoleplayCard.tsx
   
   function RoleplayCard({ roleplay, steps }) {
     const totalSteps = steps.length;
     const completedSteps = steps.filter(s => s.progress?.status === 'completed').length;
     const archivedSteps = steps.filter(s => s.progress?.status === 'archived').length;
     const unlockedSteps = steps.filter(s => s.progress?.status === 'unlocked').length;
     const progressPercent = (completedSteps / totalSteps) * 100;
     
     const isLocked = unlockedSteps === 0 && completedSteps === 0 && archivedSteps === 0;
     const isArchived = archivedSteps > 0;
     
     // Calculate average score across all steps
     const scoresAvailable = steps.filter(s => s.progress?.average_session_score);
     const averageScore = scoresAvailable.length > 0
       ? scoresAvailable.reduce((sum, s) => sum + (s.progress?.average_session_score || 0), 0) / scoresAvailable.length
       : null;
     
     return (
       <Card className={isLocked ? 'opacity-50' : ''}>
         <div className="flex items-center justify-between">
           <div>
             <h3>{roleplay.name}</h3>
             {roleplay.is_multi_step && (
               <p className="text-sm text-muted-foreground">
                 {completedSteps}/{totalSteps} steps completed
                 {isArchived && ' (Archived)'}
               </p>
             )}
             {averageScore && (
               <div className="flex items-center gap-2 mt-1">
                 <span className="text-xs font-medium">Avg Score:</span>
                 <ScoreBadge score={averageScore} />
               </div>
             )}
           </div>
           
3. **Step Selection Screen with Archive/Continue Options**
   
   ```tsx
   // src/pages/RoleplaySteps.tsx
   
   function RoleplaySteps({ roleplayId }) {
     const { data: steps } = useQuery({
       queryKey: ['roleplay-steps', roleplayId],
       queryFn: async () => {
         // Fetch steps with progress
         const { data } = await supabase
           .from('justai_roleplay_steps')
           .select(`
             *,
             progress:justai_student_progress(*)
           `)
           .eq('roleplay_id', roleplayId)
           .order('step_number');
         
         return data;
       }
     });
     
     const hasActiveProgress = steps?.some(s => 
       s.progress?.status && !['locked', 'archived'].includes(s.progress.status)
     );
     
     const isArchived = steps?.some(s => s.progress?.status === 'archived');
     
     const handleStartStep = (step) => {
       if (step.progress?.status === 'locked') {
         toast.error('This step is locked. Complete previous steps first.');
         return;
       }
       
       navigate('/ai-chat/voice/new', {
         state: {
           agentId: step.elevenlabs_agent_id,
           roleplayStepId: step.id,
           stepName: step.name
         }
       });
     };
     
     const handleArchiveRoleplay = async () => {
       const confirmed = await confirm(
         'Archive this roleplay? Your progress will be saved, but you can start a new roleplay journey.'
       );
       
       if (confirmed) {
         await supabase.rpc('archive_roleplay_progress', {
           p_student_id: user.id,
           p_roleplay_id: roleplayId
         });
         
         toast.success('Roleplay archived. You can now start fresh!');
       }
     };
     
     const handleRestartFromArchive = async () => {
       // Unlock first step again to continue
       await supabase.rpc('unlock_roleplay_first_step', {
         p_student_id: user.id,
         p_roleplay_id: roleplayId
       });
       
       toast.success('Roleplay reactivated!');
     };
     
     return (
       <div>
         {/* Archive/Continue options */}
         {hasActiveProgress && !isArchived && (
           <Card className="mb-4 p-4 bg-blue-50">
             <div className="flex items-center justify-between">
               <div>
                 <h4 className="font-medium">Continue Your Journey</h4>
                 <p className="text-sm text-muted-foreground">
                   You have active progress in this roleplay
                 </p>
               </div>
               <Button variant="outline" onClick={handleArchiveRoleplay}>
                 Archive & Start New
               </Button>
             </div>
           </Card>
         )}
         
         {isArchived && (
           <Card className="mb-4 p-4 bg-gray-50">
             <div className="flex items-center justify-between">
               <div>
                 <h4 className="font-medium">Archived Roleplay</h4>
                 <p className="text-sm text-muted-foreground">
                   This roleplay is archived. Restart to continue practicing.
                 </p>
               </div>
               <Button onClick={handleRestartFromArchive}>
2. **Update Progress and Score on Session End**
   
   ```tsx
   const endSession = async () => {
     // ... existing code to save session ...
     
     // Calculate and save conversation score
     const messageCount = transcript.filter(t => t.speaker === 'student').length;
     const conversationScore = await calculateScore(transcript);
     
     await supabase
       .from('justai_conversations')
       .update({ 
         conversation_score: conversationScore,
         score_calculated_at: new Date().toISOString()
       })
       .eq('id', conversationId);
     
     // Update progress if this was a role-play step
     if (roleplayStepId) {
       await supabase.rpc('update_student_progress', {
         p_student_id: user.id,
         p_roleplay_step_id: roleplayStepId,
         p_messages_sent: messageCount,
         p_time_spent_seconds: sessionDuration,
         p_conversation_id: conversationId
       });
       
       // Check completion
       if (messageCount >= 20) {
         await supabase.rpc('mark_step_completed', {
           p_student_id: user.id,
           p_roleplay_step_id: roleplayStepId
         });
         
         await supabase.rpc('check_unlock_next_step', {
           p_student_id: user.id,
           p_current_step_id: roleplayStepId
         });
         
         // Show score and completion message
         toast.success(
           `🎉 Step completed! Score: ${conversationScore}/100. Check if new steps unlocked.`
         );
       } else {
         // Just show score
         toast.success(`Session saved! Your score: ${conversationScore}/100`);
       }
     }
   };
   ```   toast.error('This step is locked. Complete previous steps first.');
         return;
       }
       
       navigate('/ai-chat/voice/new', {
         state: {
           agentId: step.elevenlabs_agent_id,
           roleplayStepId: step.id,
           stepName: step.name
         }
       });
     };
     
     return (
       <div>
         {steps.map((step, index) => (
           <StepCard
             key={step.id}
             step={step}
             stepNumber={index + 1}
             onStart={() => handleStartStep(step)}
           />
         ))}
       </div>
     );
   }
   ```

#### 4.4 Update Voice Chat Page

1. **Save Roleplay Context**
   
   ```tsx
   // src/pages/AIChatVoice.tsx
   
   const roleplayStepId = location.state?.roleplayStepId;
   const personalityId = location.state?.personalityId;
   
   // When creating conversation:
   const { data: convData } = await supabase
     .from('justai_conversations')
     .insert({
       student_id: user.id,
       conversation_type: 'voice_session',
       is_voice_session: true,
       title: `${stepName} - ${selectedAgentName}`,
       scenario: selectedScenario,
       personality_id: personalityId,
       roleplay_step_id: roleplayStepId
     })
     .select()
     .single();
   ```

2. **Update Progress on Session End**
   
   ```tsx
   const endSession = async () => {
     // ... existing code to save session ...
## Success Metrics

### User Experience
- ✅ Users can select and switch personalities
- ✅ Role-plays are organized by category
- ✅ Progress is visible and encouraging
- ✅ Steps unlock smoothly without confusion
- ✅ Locked steps show clear unlock requirements
- ✅ **Scores provide clear performance feedback**
- ✅ **Users can archive and restart roleplays for continuous learning**
- ✅ **Average scores show improvement over time**

### Technical
- ✅ Database queries are optimized (< 200ms)
- ✅ Progress updates happen reliably
- ✅ No race conditions in unlock logic
- ✅ RLS policies prevent data leaks
- ✅ **Score calculations are consistent and accurate**
- ✅ **Archive functionality preserves all historical data**

### Business
- ✅ Premium role-plays drive subscription upgrades
- ✅ Multi-step journeys increase engagement
- ✅ Progress tracking reduces churn
- ✅ Personality-based branding strengthens product identity
- ✅ **Score tracking encourages repeated practice**
- ✅ **Archive feature enables long-term user retention**
           p_current_step_id: roleplayStepId
         });
         
         toast.success('🎉 Step completed! Check if new steps unlocked.');
       }
     }
   };
   ```

---

### Phase 5: Admin UI (Week 4)

**Priority: Medium**

Create admin panel to manage personalities, role-plays, and steps.

1. **Admin Routes**
   - `/admin/personalities` - Manage personalities
   - `/admin/personalities/:id/categories` - Manage categories
   - `/admin/roleplays/:id/steps` - Manage role-play steps

2. **CRUD Operations**
   - Create/Edit/Delete personalities
   - Create/Edit/Delete categories
   - Create/Edit/Delete role-plays
   - Create/Edit/Delete steps
   - Configure unlock conditions

---

### Phase 6: Migration & Data Cleanup (Week 4)

**Priority: High**

1. **Migrate Existing Users**
   
   ```sql
   -- Assign default personality to existing users
   UPDATE profiles
   SET justai_preferred_personality = (
     SELECT id FROM justai_personalities WHERE short_name = 'Sarah' LIMIT 1
   )
   WHERE justai_preferred_personality IS NULL;
   ```

2. **Link Existing Conversations**
   
   ```sql
   -- Attempt to link old conversations to new structure
   -- Based on conversation title or scenario
   UPDATE justai_conversations
   SET 
     personality_id = /* derive from scenario */,
     roleplay_step_id = /* match based on title pattern */
   WHERE personality_id IS NULL;
   ```

3. **Remove Deprecated Code**
   - Remove `justai_preferred_voice` column (after confirming migration)
   - Archive `elevenlabs-agents.ts` file
## Questions to Resolve

1. **Completion Criteria**: How do we determine when a step is "completed"?
   - Option A: Message count (e.g., 20 messages)
   - Option B: Time spent (e.g., 5 minutes)
   - Option C: AI-evaluated score (requires new analysis)
   - **✅ RESOLVED**: Use message count (20+) as primary completion trigger. Scores are tracked separately for performance evaluation.

2. **Unlock Timing**: When should next step unlock?
   - Option A: Immediately after completing previous step
   - Option B: After 24 hours (to encourage spaced practice)
   - **Recommendation**: Immediate unlock, add "practice again" option

3. **Premium Steps**: Should some steps be premium-only?
   - **Recommendation**: Yes, mark advanced steps as `is_premium = true`

4. **Personality Switching**: Can users change personalities?
   - **Recommendation**: Yes, but warn they'll lose progress in current personality

5. **Progress Reset**: Can users restart role-plays?
   - **✅ RESOLVED**: Yes, users can archive current roleplay and start fresh. Archived progress is preserved with all scores.

6. **Score Calculation**: What factors determine the conversation score?
   - **Recommendation**: 
     - Grammar accuracy (25%)
     - Vocabulary usage (25%)
     - Fluency/conversation flow (25%)
     - Task completion (25%)
   - Score range: 0-100

7. **Archive vs Delete**: What happens to archived roleplays?
   - **✅ RESOLVED**: 
     - Archived roleplays preserve all progress and scores
     - Users can view archived roleplay history
     - Users can restart archived roleplays to continue practice
     - Archiving allows starting new roleplays without losing previous work
- ✅ Progress tracking reduces churn
- ✅ Personality-based branding strengthens product identity

---

## Risk Mitigation

### Risk 1: Complex Migration
**Mitigation**: 
- Test migration on staging environment first
- Create rollback scripts
- Migrate in phases (new users first)

### Risk 2: Performance Issues
**Mitigation**:
- Index all foreign keys
- Use edge function for complex queries
- Implement caching for personality structure

### Risk 3: User Confusion
**Mitigation**:
- Clear onboarding flow
- In-app tooltips explaining unlock system
- Progress indicators on every screen

### Risk 4: Unlock Logic Bugs
**Mitigation**:
- Comprehensive unit tests for unlock functions
- Manual QA of multi-step flows
- Soft launch with beta users

---

## Timeline Summary

| Phase | Duration | Dependencies | Risk Level |
|-------|----------|--------------|------------|
| 1. Database Setup | 3-4 days | None | Low |
| 2. Seed Data | 2 days | Phase 1 | Low |
| 3. Backend APIs | 4-5 days | Phase 1, 2 | Medium |
| 4. Frontend Updates | 7-10 days | Phase 3 | Medium |
| 5. Admin UI | 4-5 days | Phase 1 | Low |
| 6. Migration & Cleanup | 2-3 days | Phase 4 | High |
| **Total** | **~4 weeks** | | |

---

## Next Steps

**Before Implementation:**
1. ✅ Review and approve this plan
2. ✅ Confirm ElevenLabs agent IDs for multi-step scenarios
3. ✅ Decide on completion criteria (e.g., 20 messages = completed?)
4. ✅ Design mockups for new UI components
5. ✅ Set up staging environment for testing

**To Begin:**
1. Create the database migration file
2. Start with Phase 1 (Database Setup)
3. Test each phase before moving to next

---

## Questions to Resolve

1. **Completion Criteria**: How do we determine when a step is "completed"?
   - Option A: Message count (e.g., 20 messages)
   - Option B: Time spent (e.g., 5 minutes)
   - Option C: AI-evaluated score (requires new analysis)
   - **Recommendation**: Start with message count, add scoring later

2. **Unlock Timing**: When should next step unlock?
   - Option A: Immediately after completing previous step
   - Option B: After 24 hours (to encourage spaced practice)
   - **Recommendation**: Immediate unlock, add "practice again" option

3. **Premium Steps**: Should some steps be premium-only?
   - **Recommendation**: Yes, mark advanced steps as `is_premium = true`

4. **Personality Switching**: Can users change personalities?
   - **Recommendation**: Yes, but warn they'll lose progress in current personality

5. **Progress Reset**: Can users restart role-plays?
   - **Recommendation**: Yes, add "Reset Progress" button (keeps best score)

---

This plan provides a complete roadmap for transitioning from the current flat agent system to a rich, personality-based learning journey with multi-step role-plays and progress tracking. Ready for implementation! 🚀
