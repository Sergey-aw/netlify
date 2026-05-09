# ElevenLabs Webhook Data Storage Plan

## Overview

Based on the actual webhook data received from ElevenLabs, we need to replace the OpenAI-generated `session_memory` with the structured data from ElevenLabs' `analysis` field.

## Current State

### What We Have Now
- `justai_conversations.session_memory` (JSONB) - Currently stores OpenAI-generated memory data
- `justai_conversations.language_feedback` (JSONB) - Stores OpenAI language feedback
- `justai_conversations.conversation_score` (INTEGER) - Score from OpenAI
- `justai_conversations.unlock_next_scenario` (BOOLEAN) - From OpenAI analysis

### What OpenAI Currently Stores
```json
{
  "memory": {
    "conversation_summary": "string",
    "emotional_notes": "string", 
    "open_threads": ["array of strings"],
    "unlock_next_scenario": boolean
  }
}
```

## ElevenLabs Webhook Data Structure

### What We Receive from ElevenLabs
```json
{
  "analysis": {
    "transcript_summary": "Shane and Alina met during a speed dating event...",
    "call_successful": "success",
    "evaluation_criteria_results": {
      "next_stage": {
        "criteria_id": "next_stage",
        "result": "success",
        "rationale": "The conversation ended with an agreement..."
      }
    },
    "data_collection_results": {
      "Name": {
        "value": "Shane",
        "json_schema": { /* ... schema definition - NOT STORED */ },
        "rationale": "The user explicitly states their name..."  // NOT STORED
      },
      "user_location": {
        "value": "San Francisco",
        "json_schema": { /* ... */ },  // NOT STORED
        "rationale": "..."  // NOT STORED
      },
      "user_job_or_field": {
        "value": "electrical engineer",
        "json_schema": { /* ... */ },  // NOT STORED
        "rationale": "..."  // NOT STORED
      }
      // ... more fields
    }
  }
}
```

## Data Mapping Plan

### Strategy: Replace OpenAI Memory with ElevenLabs Data

Instead of storing OpenAI's memory structure, we'll store ElevenLabs' more structured data:

```typescript
// NEW structure for session_memory (from ElevenLabs webhook)
session_memory: {
  // Basic conversation info
  transcript_summary: string,
  call_successful: string,  // "success", "failure", etc.
  
  // Evaluation criteria (next_stage result)
  next_stage_result: string,  // "success", "failure"
  next_stage_rationale: string,
  
  // Collected data (keep as name-value pairs for context_memory)
  collected_data: [
    { name: "Name", value: "Shane" },
    { name: "user_location", value: "San Francisco" },
    { name: "user_job_or_field", value: "electrical engineer" },
    { name: "memorable_quote", value: "It's show chain." },
    { name: "conversation_vibe", value: "warm" }
    // ... any other custom fields
  ],
  
  // Metadata
  conversation_timestamp: "2026-01-14T10:30:00Z",  // When conversation happened
  extracted_at: timestamp,
  source: "elevenlabs_webhook"
}
```

### Column Usage

#### 1. `session_memory` (JSONB) - Primary Storage
Store the structured ElevenLabs analysis data as shown above.

#### 2. `unlock_next_scenario` (BOOLEAN) - Quick Access
Extract from `evaluation_criteria_results.next_stage.result === "success"`

#### 3. Keep `language_feedback` for Now
Continue using OpenAI for language-specific feedback (scores, diagnosis, improvements) since ElevenLabs doesn't provide this level of English coaching.

## Agent Structure (Multi-Step Roleplay Scenarios)

### Hierarchical Agent Organization

Agents are organized in a parent-child hierarchy for multi-step roleplay scenarios:

```
Parent Agent (is_multi_step = true)
├── Step 1 Agent (parent_agent_id → Parent, step_number = 1)
├── Step 2 Agent (parent_agent_id → Parent, step_number = 2)
├── Step 3 Agent (parent_agent_id → Parent, step_number = 3)
├── Step 4 Agent (parent_agent_id → Parent, step_number = 4)
└── Step 5 Agent (parent_agent_id → Parent, step_number = 5)
```

**Example from database:**
```
Parent: "Dating: Noah Rivers" (id: 0c4691d6-...)
  ├── Step 1: "Speed Date" (step_number: 1)
  ├── Step 2: "Calling to Schedule a Date" (step_number: 2)
  ├── Step 3: "Second Date" (step_number: 3)
  ├── Step 4: "Post Date Chat" (step_number: 4)
  └── Step 5: "Freetalk" (step_number: 5)
```

### Memory Continuity Across Steps

When a student progresses through a multi-step roleplay:
- **Step 1** conversation → stores memory
- **Step 2** conversation → receives memory from Step 1 + stores new memory
- **Step 3** conversation → receives memory from Steps 1 & 2 + stores new memory
- **Step 4** conversation → receives memory from Steps 1, 2 & 3 + stores new memory
- **Step 5** conversation → receives ALL previous memories from Steps 1-4

This creates continuity where each agent in the series has access to ALL previous conversation context.

## Implementation Plan

### Phase 1: Update Webhook Handler ✅ CURRENT
- ✅ Receive webhook data
- ✅ Log all fields
- ⏳ Transform and store in database

### Phase 2: Transform & Store Data
1. Extract `next_stage` result from `evaluation_criteria_results`
2. Flatten `data_collection_results` into simple key-value pairs
3. Store in `session_memory` JSONB column
4. Set `unlock_next_scenario` boolean for quick queries

### Phase 3: Use Memory in Next Conversation
1. Retrieve previous session_memory for ALL steps in the roleplay series
2. Find parent_agent_id to identify all sibling agents in the series
3. Format as plain text string with name-value pairs
4. Pass as `context_memory` dynamic variable when starting new conversation
5. Include conversation timestamp in the memory

### Phase 4: Update Frontend
1. Update FeedbackDrawer to display ElevenLabs data instead of OpenAI memory
2. Show collected data (name, location, job, etc.)
3. Show next_stage result

### Phase 5: Keep Hybrid Approach
- **ElevenLabs** → Memory/context data (from webhook)
- **OpenAI** → Language feedback (scores, improvements)
- Both stored separately in database

## Code Changes Needed

### 1. Webhook Handler (`elevenlabs-post-call-webhook/index.ts`)

```typescript
// Transform ElevenLabs analysis into our storage format
function transformAnalysisData(analysis: any, conversationTimestamp: string) {
  const evaluationResults = analysis.evaluation_criteria_results || {}
  const dataCollection = analysis.data_collection_results || {}
  
  // Extract next_stage evaluation
  const nextStage = evaluationResults.next_stage || {}
  
  // Keep data collection as name-value pairs (for context_memory dynamic variable)
  // ONLY store the 'value' field, exclude 'json_schema' and 'rationale'
  const collectedData: Array<{name: string, value: any}> = []
  for (const [key, data] of Object.entries(dataCollection)) {
    const value = (data as any).value
    if (value !== null && value !== undefined) {
      collectedData.push({ name: key, value })
    }
  }
  
  return {
    transcript_summary: analysis.transcript_summary || null,
    call_successful: analysis.call_successful || null,
    
    // Evaluation
    next_stage_result: nextStage.result || null,
    
    
    // Collected data (name-value pairs for context_memory)
    collected_data: collectedData,
    
    // Metadata
    conversation_timestamp: conversationTimestamp,
    extracted_at: new Date().toISOString(),
    source: 'elevenlabs_webhook'
  }
}

// Store in database
const conversationTimestamp = voiceSession.created_at || new Date().toISOString()
const sessionMemory = transformAnalysisData(data.analysis, conversationTimestamp)
const unlockNextScenario = sessionMemory.next_stage_result === 'success'

await supabase
  .from('justai_conversations')
  .update({
    session_memory: sessionMemory,
    unlock_next_scenario: unlockNextScenario,
    updated_at: new Date().toISOString(),
  })
  .eq('id', voiceSession.conversation_id)
```

### 2. Frontend (`FeedbackDrawer.tsx`)

```tsx
// Display ElevenLabs memory data
{feedbackData.session_memory?.transcript_summary && (
  <Card>
    <h4>Conversation Summary</h4>
    <p>{feedbackData.session_memory.transcript_summary}</p>
  </Card>
)}

{feedbackData.session_memory?.collected_data && (
  <Card>
    <h4>Information Collected</h4>
    {feedbackData.session_memory.collected_data.map(({ name, value }) => (
      value && (
        <div key={name}>
          <strong>{formatKey(name)}:</strong> {value}
        </div>
      )
    ))}
  </Card>
)}

{feedbackData.session_memory?.next_stage_result && (
  <Card>
    <h4>Progress</h4>
    <p><strong>Status:</strong> {feedbackData.session_memory.next_stage_result}</p>
    {feedbackData.session_memory.next_stage_rationale && (
      <p>{feedbackData.session_memory.next_stage_rationale}</p>
    )}
  </Card>
)}
```

### 3. Passing Memory to Next Conversation

When starting a new ElevenLabs conversation, retrieve ALL previous conversation memories for this agent and format as plain text:

```typescript
// In your conversation start handler
async function startConversation(studentId: string, agentId: string) {
  // 1. Get the agent details to find parent_agent_id (for multi-step scenarios)
  const { data: currentAgent } = await supabase
    .from('justai_agents')
    .select('id, parent_agent_id, is_multi_step, step_number')
    .eq('id', agentId)
    .single()
  
  if (!currentAgent) {
    throw new Error('Agent not found')
  }
  
  // 2. Determine the parent agent ID
  // - If this is a parent agent (is_multi_step = true), use its own ID
  // - If this is a child step (parent_agent_id is set), use parent_agent_id
  const parentAgentId = currentAgent.parent_agent_id || currentAgent.id
  
  // 3. Get ALL sibling agent IDs in this roleplay series
  const { data: siblingAgents } = await supabase
    .from('justai_agents')
    .select('id')
    .or(`id.eq.${parentAgentId},parent_agent_id.eq.${parentAgentId}`)
  
  const agentIdsInSeries = siblingAgents?.map(a => a.id) || []
  
  // 4. Get ALL previous conversations for this roleplay series (all steps)
  const { data: previousConversations } = await supabase
    .from('justai_conversations')
    .select('session_memory, created_at, agent_id')
    .eq('student_id', studentId)
    .in('agent_id', agentIdsInSeries)
    .order('created_at', { ascending: true })  // Chronological order
    .not('session_memory', 'is', null)
  
  // 2. Format ALL memories as plain text string
  let contextMemory = ''
  
  if (previousConversations && previousConversations.length > 0) {
    contextMemory = previousConversations.map(conv => {
      const memory = conv.session_memory
      const timestamp = memory.conversation_timestamp || conv.created_at
      
      // Start with timestamp
      let memoryBlock = timestamp + '\n'
      
      // Add all collected data as "name: value," pairs
      if (memory.collected_data && memory.collected_data.length > 0) {
        const dataLines = memory.collected_data
          .filter(item => item.value !== null && item.value !== undefined)
          .map(item => `${item.name}: ${item.value}`)
          .join(',\n')
        
        memoryBlock += dataLines
      }
      
      return memoryBlock
    }).join('\n\n')  // Separate conversations with blank line
  }
  
  // 3. Start ElevenLabs conversation with context_memory
  const response = await fetch('https://api.elevenlabs.io/v1/convai/conversation', {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      agent_id: agentId,
      // Pass combined memory as dynamic variable (plain text string)
      dynamic_variables: contextMemory ? {
        context_memory: contextMemory
      } : undefined
    })
  })
  
  return response.json()
}
```

**Example of formatted `context_memory` string:**
```
2026-01-14T10:30:00Z
Name: Shane,
user_location: San Francisco,
user_job_or_field: electrical engineer,
memorable_quote: It's show chain.,
conversation_vibe: warm

2026-01-14T11:45:00Z
user_hobby: hiking,
favorite_food: sushi,
weekend_plans: visit Golden Gate Park
```

### 4. ElevenLabs Agent Configuration

In your ElevenLabs agent setup, configure the `context_memory` dynamic variable:

```json
{
  "agent_id": "your_agent_id",
  "dynamic_variables": [
    {
      "name": "context_memory",
      "value": "",  // Will be populated at conversation start
      "description": "All previous conversation memories from earlier steps, formatted as timestamp + name-value pairs"
    }
  ],
  "first_message": "Welcome back! I can see from our previous conversations:\n{{context_memory}}"
}
```

The agent will receive all historical context in a simple, readable format with timestamps and collected data from each previous step.

## Benefits of Using ElevenLabs Data

### Advantages
✅ **Structured Data** - Pre-defined schema from agent configuration  
✅ **Custom Fields** - Can configure what data to collect per agent  
✅ **Automatic Extraction** - No OpenAI API call needed for memory  
✅ **Evaluation Criteria** - Built-in success/failure determination  
✅ **Cost Savings** - Reduce OpenAI usage  
✅ **Consistent Format** - Same structure for all conversations  
✅ **Clean Storage** - Only store values, not schema/rationale metadata
✅ **Memory Continuity** - Pass ALL previous conversation context to next agent
✅ **Name-Value Pairs** - Easy to read and parse in plain text format
✅ **Multi-Step Context** - Combine memories from all previous steps in scenario

### What We Store vs What We Ignore
**Store:**
- ✅ `value` - The actual collected data (name, location, etc.)

**Ignore:**
- ❌ `json_schema` - Schema definition (not needed in DB)
- ❌ `rationale` - Why data was extracted (debug info only)

### What We Lose
❌ **Language Feedback** - ElevenLabs doesn't provide English coaching  
❌ **Custom Memory Format** - Must use ElevenLabs' structure  

## Hybrid Solution (Recommended)

### Use Both Systems
1. **ElevenLabs Webhook** → `session_memory`
   - Conversation context across all steps in roleplay series
   - Collected data (name, location, etc.) from each conversation
   - Progress evaluation (next_stage)
   - Transcript summary
   - Combined from ALL sibling agents (steps) and passed to next step via `context_memory`

2. **OpenAI Analysis** → `language_feedback`
   - Language quality score
   - Grammar/fluency diagnosis
   - Improvement suggestions
   - Example corrections

This gives us:
- Structured memory from ElevenLabs (free with agents) - accumulated across all steps in roleplay
- English coaching from OpenAI (pay per use)
- Best of both worlds

## Migration Steps

### Step 1: Update Webhook Handler
Add transformation and storage logic to `elevenlabs-post-call-webhook/index.ts`

### Step 2: Test with Real Webhook
Make a conversation, verify data is stored correctly

### Step 3: Update Frontend
Modify FeedbackDrawer to display ElevenLabs memory structure

### Step 4: Keep OpenAI for Language Feedback
Continue calling `analyze-conversation-feedback` for language coaching

### Step 5: Update Documentation
Document the new hybrid approach

## Database Schema (No Changes Needed)

Current schema already supports this:

```sql
-- justai_conversations table (EXISTING)
session_memory JSONB,              -- Store ElevenLabs analysis
language_feedback JSONB,           -- Store OpenAI language feedback  
conversation_score INTEGER,        -- From OpenAI
unlock_next_scenario BOOLEAN,      -- From ElevenLabs next_stage
score_calculated_at TIMESTAMPTZ
```

## Example Queries

### 1. Get conversations that unlocked next scenario
```sql
SELECT 
  id,
  session_memory->>'transcript_summary' as summary,
  session_memory->>'conversation_timestamp' as conversation_time,
  session_memory->>'next_stage_result' as progress,
  unlock_next_scenario
FROM justai_conversations
WHERE unlock_next_scenario = true;
```

### 2. Get collected data for a user (name-value pairs)
```sql
SELECT 
  session_memory->'collected_data' as collected_info
FROM justai_conversations
WHERE id = 'xxx';

-- Returns: [{"name": "Name", "value": "Shane"}, {"name": "user_location", "value": "San Francisco"}, ...]
```

### 3. Get user's most recent memory for context_memory variable
```sql
-- Get ALL previous memories for a roleplay series (all steps)
-- Step 1: Find parent_agent_id for current agent
WITH current_agent AS (
  SELECT 
    id,
    COALESCE(parent_agent_id, id) as parent_id
  FROM justai_agents
  WHERE id = 'current_agent_uuid'
),
-- Step 2: Get all agents in this series
agents_in_series AS (
  SELECT id 
  FROM justai_agents
  WHERE id = (SELECT parent_id FROM current_agent)
     OR parent_agent_id = (SELECT parent_id FROM current_agent)
)
-- Step 3: Get all conversations from these agents
SELECT 
  c.created_at,
  c.session_memory->'collected_data' as collected_data,
  c.session_memory->>'conversation_timestamp' as conversation_timestamp,
  a.name as agent_name,
  a.step_number
FROM justai_conversations c
JOIN justai_agents a ON c.agent_id = a.id
WHERE c.student_id = 'student123'
  AND c.agent_id IN (SELECT id FROM agents_in_series)
  AND c.session_memory IS NOT NULL
ORDER BY c.created_at ASC;

-- This will be formatted as plain text string:
-- timestamp
-- name: value,
-- name: value,...
-- 
-- timestamp
-- name: value,
-- ...
```

## Next Steps

1. ✅ **Webhook created** - Receiving and logging data
2. ⏳ **Add transformation** - Convert ElevenLabs format to name-value pairs with timestamp
3. ⏳ **Add storage logic** - Save to `session_memory` column
4. ⏳ **Test with real conversation** - Verify data structure
5. ⏳ **Implement context_memory** - Combine ALL previous memories and pass to next agent
6. ⏳ **Format as plain text** - timestamp + name-value pairs for each conversation
7. ⏳ **Update frontend** - Display ElevenLabs memory data
8. ⏳ **Keep OpenAI option** - For language feedback only

## Questions to Resolve

1. **Should we still use OpenAI?**
   - **Recommendation**: Yes, but only for language feedback, not memory

2. **What about the `language_feedback` column?**
   - **Keep it** - OpenAI provides English coaching ElevenLabs doesn't

3. **How to handle custom fields in data_collection?**
   - **Dynamic** - Store whatever ElevenLabs sends as name-value pairs

4. **What if next_stage is not configured?**
   - **Fallback** - Use `call_successful` field or set to null

5. **How to pass memory to agent?**
   - **Solution** - Use `context_memory` dynamic variable with plain text string combining ALL previous conversation memories from the roleplay series
   - **Format** - timestamp + name-value pairs, separated by blank lines between conversations
   - **Scope** - All conversations within the same roleplay series (parent_agent_id), including all steps (1,2,3,4,5), chronologically ordered
