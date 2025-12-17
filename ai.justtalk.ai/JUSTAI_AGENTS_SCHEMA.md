# JustAI Agents - Optimized Single Table Schema

## Overview

This is a **simplified, single-table approach** to storing all JustAI agents (roleplay scenarios) with support for:
- ✅ Hierarchical structure (parent agents + child steps)
- ✅ Multi-step roleplays
- ✅ Single-step roleplays
- ✅ Progress tracking per agent/step
- ✅ Unlock conditions
- ✅ Conversation scoring
- ✅ Archive functionality

## Key Benefits vs. Multi-Table Approach

### 1. **Simplicity**
- **1 table** instead of 4 tables (`personalities`, `categories`, `roleplays`, `steps`)
- Category is just a string field, not a separate table
- Personality name is just a string field, not a FK reference
- Easier to understand and maintain

### 2. **Flexibility**
- Add new categories by just inserting agents with a new category value
- Change category names without migrations
- Mix single-step and multi-step agents seamlessly

### 3. **Performance**
- Fewer JOINs needed for queries
- Single query to get all agents in a category
- Recursive CTE for parent + steps in one query

### 4. **Migration-Friendly**
- Easy to seed from existing `elevenlabs-agents.ts`
- No complex FK dependencies to worry about
- Can migrate incrementally

## Schema Structure

### Main Table: `justai_agents`

```sql
CREATE TABLE justai_agents (
  id UUID PRIMARY KEY,
  
  -- Hierarchical structure
  parent_agent_id UUID,  -- NULL = parent/single, UUID = child step
  step_number INTEGER,   -- NULL = parent/single, 1,2,3... = step order
  is_multi_step BOOLEAN, -- TRUE = has child steps
  total_steps INTEGER,   -- Total number of steps (1 for single-step)
  
  -- Agent details
  name TEXT,
  description TEXT,
  icon TEXT,
  image_url TEXT,
  
  -- Category (simple string, not FK!)
  category TEXT,         -- 'Interview', 'Dating', 'Business', etc.
  personality_name TEXT, -- 'Sarah - Professional Coach', 'Maya Chen'
  
  -- ElevenLabs integration
  elevenlabs_agent_id TEXT UNIQUE,
  recommended_duration_seconds INTEGER,
  
  -- Unlock conditions
  unlock_condition_type TEXT,  -- NULL, 'previous_step', 'message_count', etc.
  unlock_condition_value INTEGER,
  
  -- Metadata
  difficulty_level TEXT,
  recommended_cefr_level TEXT,
  is_active BOOLEAN,
  is_premium BOOLEAN,
  display_order INTEGER
);
```

### Progress Table: `justai_student_progress`

```sql
CREATE TABLE justai_student_progress (
  id UUID PRIMARY KEY,
  student_id UUID REFERENCES profiles(id),
  agent_id UUID REFERENCES justai_agents(id),
  
  -- Progress
  status TEXT, -- 'locked', 'unlocked', 'in_progress', 'completed', 'archived'
  
  -- Metrics
  sessions_count INTEGER,
  total_messages_sent INTEGER,
  total_time_spent_seconds INTEGER,
  
  -- Scoring
  best_session_score INTEGER,
  latest_session_score INTEGER,
  average_session_score DECIMAL,
  
  -- Timestamps
  unlocked_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ
);
```

## Data Examples

### Single-Step Agent

```sql
INSERT INTO justai_agents (
  name, category, personality_name,
  elevenlabs_agent_id, is_multi_step, total_steps
) VALUES (
  'Tell Me About Yourself',
  'Interview',
  'Sarah - Professional Coach',
  'agent_7801kc7yfx17fqa80c7d5favvdnm',
  false, -- NOT multi-step
  1      -- Single step
);
```

### Multi-Step Agent (Parent + Steps)

```sql
-- Parent agent
INSERT INTO justai_agents (
  name, category, elevenlabs_agent_id,
  is_multi_step, total_steps
) VALUES (
  'Strengths and Weaknesses',
  'Interview',
  'agent_7101kc7yqwnyef7867pkh9epas2b',
  true,  -- IS multi-step
  3      -- Has 3 steps
) RETURNING id;

-- Step 1 (auto-unlocked)
INSERT INTO justai_agents (
  parent_agent_id, step_number, name,
  elevenlabs_agent_id, unlock_condition_type
) VALUES (
  '<parent_id>', 1, 'Initial Response',
  'agent_step1',
  NULL -- Auto-unlocked
);

-- Step 2 (unlocked after step 1)
INSERT INTO justai_agents (
  parent_agent_id, step_number, name,
  elevenlabs_agent_id, unlock_condition_type
) VALUES (
  '<parent_id>', 2, 'Deep Dive',
  'agent_step2',
  'previous_step'
);

-- Step 3 (unlocked after 20 messages in step 2)
INSERT INTO justai_agents (
  parent_agent_id, step_number, name,
  elevenlabs_agent_id, unlock_condition_type, unlock_condition_value
) VALUES (
  '<parent_id>', 3, 'STAR Method',
  'agent_step3',
  'message_count', 20
);
```

## Common Queries

### 1. Get all agents in a category

```sql
SELECT * FROM justai_agents
WHERE category = 'Interview'
  AND is_active = true
  AND parent_agent_id IS NULL  -- Only parents/singles
ORDER BY display_order;
```

### 2. Get agent with all steps

```sql
SELECT * FROM get_agent_with_steps('<agent_id>');
-- Returns parent + all child steps in order
```

### 3. Get agents with user progress

```sql
SELECT 
  a.*,
  p.status,
  p.sessions_count,
  p.best_session_score
FROM justai_agents a
LEFT JOIN justai_student_progress p 
  ON p.agent_id = a.id 
  AND p.student_id = '<user_id>'
WHERE a.category = 'Interview'
  AND a.is_active = true
  AND a.parent_agent_id IS NULL;
```

### 4. Get next unlocked step

```sql
SELECT * FROM justai_agents a
LEFT JOIN justai_student_progress p 
  ON p.agent_id = a.id 
  AND p.student_id = '<user_id>'
WHERE a.parent_agent_id = '<parent_id>'
  AND (p.status = 'unlocked' OR p.status = 'in_progress')
ORDER BY a.step_number
LIMIT 1;
```

## Categories

Categories are just strings, not a separate table. Current categories:

- **Interview** - Job interview preparation
- **Dating** - Dating and relationship scenarios
- **Business** - Business communication
- **Education** - Test prep (TOEFL, IELTS)
- **Social** - Social situations
- **Daily Life** - Everyday scenarios
- **Travel** - Travel situations
- **Practice** - General conversation practice

To add a new category, just insert agents with the new category name!

## Unlock Conditions

| Type | Description | Value |
|------|-------------|-------|
| `NULL` | Auto-unlocked (for first steps) | - |
| `previous_step` | Complete previous step | - |
| `message_count` | Send X messages in previous step | Integer (e.g., 20) |
| `time_spent` | Spend X seconds in previous step | Integer (e.g., 300) |
| `score_threshold` | Achieve X score in previous step | Integer (e.g., 80) |
| `manual_unlock` | Teacher/admin must unlock | - |

## Progress States

```
locked → unlocked → in_progress → completed
                                      ↓
                                  archived (to start fresh)
```

## Helper Functions

All implemented in the migration:

1. `get_agent_with_steps(agent_id)` - Get parent + all steps
2. `unlock_first_step(student_id, parent_agent_id)` - Unlock step 1
3. `update_student_progress(...)` - Update after session
4. `update_progress_from_feedback(conversation_id)` - Update score from AI feedback
5. `check_unlock_next_step(student_id, current_agent_id)` - Auto-unlock next step
6. `archive_roleplay_progress(student_id, parent_agent_id)` - Archive for fresh start

## Frontend Integration

### TypeScript Types

See `/ai-chat-app/src/types/agents.ts`:
- `JustAIAgent` - Main agent type
- `StudentProgress` - Progress tracking type
- `AgentWithProgress` - Agent + progress joined
- `AgentCategory` - Category grouping

### Service Layer

See `/ai-chat-app/src/services/agents.service.ts`:
- `getAgentsByCategory(userId)` - Get all agents grouped by category
- `getAgentWithSteps(agentId, userId)` - Get specific agent + steps
- `unlockFirstStep(userId, parentAgentId)` - Unlock first step
- `updateStudentProgress(...)` - Update after session
- `archiveRoleplay(userId, parentAgentId)` - Archive roleplay

## Migration Files

1. **`20241217000000_create_justai_agents_table.sql`**
   - Creates `justai_agents` table
   - Creates `justai_student_progress` table
   - Updates `justai_conversations` table
   - Adds all indexes and RLS policies
   - Implements all helper functions

2. **`20241217000001_seed_justai_agents.sql`**
   - Seeds all existing agents from `elevenlabs-agents.ts`
   - Creates multi-step structures
   - Sets up unlock conditions
   - Ready to deploy!

## Deployment Steps

1. **Apply migration:**
   ```bash
   supabase db push
   ```

2. **Verify data:**
   ```sql
   SELECT category, COUNT(*) 
   FROM justai_agents 
   WHERE parent_agent_id IS NULL 
   GROUP BY category;
   ```

3. **Update frontend:**
   - Replace `elevenlabs-agents.ts` imports with `agents.service.ts`
   - Use new types from `agents.ts`
   - Update UI components to show progress, scores, unlock status

4. **Test unlock flow:**
   - Complete a step
   - Verify next step unlocks
   - Check progress tracking

## Next Steps

1. ✅ Review and approve this schema
2. ⏳ Create missing ElevenLabs agents for multi-step scenarios
3. ⏳ Update frontend to use new service layer
4. ⏳ Test migration on staging
5. ⏳ Deploy to production

---

**This optimized approach reduces complexity while maintaining all the features from the original plan!** 🚀
