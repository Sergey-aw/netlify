# ElevenLabs Multiple Agents Setup Guide

## Overview

Your JustAI app now supports multiple ElevenLabs Conversational AI agents! Users can choose from different AI teachers on the home screen, and each card will start a voice conversation with a specific agent.

## Architecture

### 1. Agent Configuration File
**Location:** `ai-chat-app/src/config/elevenlabs-agents.ts`

This file defines all available agents with their:
- **id**: Internal identifier (e.g., 'conversation', 'writing')
- **name**: Display name shown to users
- **description**: Brief description of the agent's purpose
- **icon**: Emoji icon displayed on the card
- **category**: Grouping category
- **agentId**: ElevenLabs agent ID (the actual ID from your ElevenLabs dashboard)

### 2. Updated Components

#### Home Screen (`AIChatHome.tsx`)
- Displays agent cards from the configuration
- Each card has an onClick handler that navigates to voice chat with agent details
- Passes `agentId`, `agentName`, and `scenario` via navigation state

#### Voice Chat (`AIChatVoice.tsx`)
- Receives agent information from navigation state
- Uses the selected agent ID when requesting signed URL
- Updates conversation title and UI to show which agent is active

#### API Layer (`justai-api.ts`)
- Updated `getElevenLabsSignedUrl()` to accept optional `agentId` parameter
- Passes agent ID to the edge function

#### Edge Function (`elevenlabs-get-signed-url.ts`)
- Accepts `agentId` in request body
- Falls back to `ELEVENLABS_AGENT_ID` env variable if not provided
- Uses the specified agent ID when creating signed URL

## Setup Instructions

### Step 1: Get Your ElevenLabs Agent IDs

1. Log in to your [ElevenLabs Dashboard](https://elevenlabs.io/app/conversational-ai)
2. Go to **Conversational AI** section
3. For each agent you want to use:
   - Click on the agent
   - Copy the **Agent ID** (format: `agent_xxxxxxxxxxxxx`)
   - Note the agent's name and purpose

### Step 2: Configure Agents

Edit `ai-chat-app/src/config/elevenlabs-agents.ts`:

```typescript
export const ELEVENLABS_AGENTS: ElevenLabsAgent[] = [
  {
    id: 'conversation',
    name: 'Conversation',
    description: 'Practice everyday English conversations',
    icon: '🗣️',
    category: 'general',
    agentId: 'agent_YOUR_CONVERSATION_AGENT_ID_HERE', // Replace!
  },
  {
    id: 'writing',
    name: 'Writing',
    description: 'Improve your writing skills',
    icon: '✏️',
    category: 'skills',
    agentId: 'agent_YOUR_WRITING_AGENT_ID_HERE', // Replace!
  },
  {
    id: 'programming',
    name: 'Programming',
    description: 'Learn coding and tech vocabulary',
    icon: '🧑‍💻',
    category: 'professional',
    agentId: 'agent_YOUR_PROGRAMMING_AGENT_ID_HERE', // Replace!
  },
  // Add more agents as needed!
];
```

### Step 3: Customize Agent Cards

You can:
- **Add more agents**: Just add new objects to the array
- **Change icons**: Use any emoji (🎓, 🌍, 💼, 📚, etc.)
- **Modify names**: Change display names to match your brand
- **Update descriptions**: Add helpful descriptions for users

Example of adding a new agent:

```typescript
{
  id: 'business',
  name: 'Business English',
  description: 'Master professional communication',
  icon: '💼',
  category: 'professional',
  agentId: 'agent_YOUR_BUSINESS_AGENT_ID',
},
```

### Step 4: Deploy Edge Function

Deploy the updated edge function to Supabase:

```bash
cd /Users/sergeygordeev/SF/ai.justtalk.ai
supabase functions deploy elevenlabs-get-signed-url
```

Or copy the edge function to your main Supabase functions directory if you're using a different deployment method.

### Step 5: Test the Implementation

1. **Start your dev server:**
   ```bash
   cd ai-chat-app
   npm run dev
   ```

2. **Test each agent:**
   - Navigate to the home screen
   - Click on each agent card
   - Verify the voice conversation starts with the correct agent
   - Check browser console logs for agent information

3. **Verify logs:**
   Look for console logs like:
   ```
   🤖 Selected Agent: {
     agentId: "agent_xxxxx",
     agentName: "Conversation",
     scenario: "conversation"
   }
   🔍 Using agent ID: agent_xxxxx
   ```

## How It Works

### User Flow

1. User sees home screen with 3 agent cards (or however many you configure)
2. User clicks on "Conversation" card
3. App navigates to `/ai-chat/voice/new` with state:
   ```javascript
   {
     agentId: 'agent_xxxxx',
     agentName: 'Conversation',
     scenario: 'conversation'
   }
   ```
4. Voice chat component:
   - Extracts agent info from navigation state
   - Calls `getElevenLabsSignedUrl()` with the agent ID
   - Edge function creates signed URL using that specific agent
   - ElevenLabs connects to the selected agent
   - User talks with the chosen AI teacher!

### Data Flow

```
Home Screen (Card Click)
    ↓
Navigation State (agentId, agentName, scenario)
    ↓
AIChatVoice Component (extracts state)
    ↓
getElevenLabsSignedUrl(agentId) API call
    ↓
Edge Function (uses agentId parameter)
    ↓
ElevenLabs API (creates signed URL with agent_id)
    ↓
WebSocket Connection (connects to specific agent)
    ↓
Voice Conversation
```

## Environment Variables

### Supabase Edge Function

The edge function still uses `ELEVENLABS_AGENT_ID` as a fallback:

```bash
ELEVENLABS_API_KEY=sk_xxxxx
ELEVENLABS_AGENT_ID=agent_default_xxxxx  # Fallback agent
```

This means:
- ✅ If `agentId` is provided in the request → uses that agent
- ✅ If no `agentId` provided → falls back to env variable
- ❌ If neither exists → error

## Troubleshooting

### Agent not connecting

**Check:**
1. Is the agent ID correct in `elevenlabs-agents.ts`?
2. Is the agent published in ElevenLabs dashboard?
3. Check browser console for error messages
4. Verify edge function logs in Supabase

### Wrong agent is responding

**Check:**
1. Browser console logs for selected agent ID
2. Edge function logs to see which agent ID was used
3. Verify the agent ID matches your ElevenLabs dashboard

### Cards not showing

**Check:**
1. Is `ELEVENLABS_AGENTS` array properly exported?
2. Any syntax errors in the config file?
3. Check browser console for import errors

## Advanced Configuration

### Per-Agent Voice Settings

You can configure different voices for different agents by modifying the voice selection logic in `AIChatVoice.tsx`:

```typescript
// Example: Use different voices per agent
const getVoiceForAgent = (agentId: string) => {
  const voiceMap = {
    'conversation': 'voice_id_1',
    'writing': 'voice_id_2',
    'programming': 'voice_id_3',
  };
  return voiceMap[agentId] || userProfile.justai_preferred_voice;
};
```

### Agent Categories and Filtering

Add filtering by category on the home screen:

```typescript
const filteredAgents = ELEVENLABS_AGENTS.filter(
  agent => agent.category === selectedCategory
);
```

### Agent Metadata in Database

Consider storing agent information in conversations:

```sql
ALTER TABLE justai_conversations 
ADD COLUMN agent_id TEXT,
ADD COLUMN agent_name TEXT;
```

Then update the insert in `AIChatVoice.tsx`:

```typescript
.insert({
  student_id: user.id,
  conversation_type: 'voice_session',
  is_voice_session: true,
  title: `Voice Chat: ${selectedAgentName}`,
  scenario: selectedScenario,
  agent_id: selectedAgentId,  // Add this
  agent_name: selectedAgentName,  // Add this
})
```

## Next Steps

1. **Replace placeholder agent IDs** in `elevenlabs-agents.ts`
2. **Customize agent names and descriptions** to match your brand
3. **Test each agent** thoroughly
4. **Deploy edge function** to production
5. **Monitor usage** and user preferences
6. **Add analytics** to track which agents are most popular

## Support

If you encounter issues:
1. Check browser console logs
2. Check Supabase edge function logs
3. Verify ElevenLabs dashboard settings
4. Review the data flow diagram above

## File Reference

- **Config:** `ai-chat-app/src/config/elevenlabs-agents.ts`
- **Home Screen:** `ai-chat-app/src/pages/AIChatHome.tsx`
- **Voice Chat:** `ai-chat-app/src/pages/AIChatVoice.tsx`
- **API Layer:** `ai-chat-app/src/lib/justai-api.ts`
- **Edge Function:** `edge-functions/elevenlabs-get-signed-url.ts`

---

**Ready to go!** Just replace the agent IDs and deploy. 🚀
