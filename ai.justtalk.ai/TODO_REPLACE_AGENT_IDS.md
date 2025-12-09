# 🎯 ACTION REQUIRED: Replace These Agent IDs

Open the file: **`ai-chat-app/src/config/elevenlabs-agents.ts`**

You'll see this:

```typescript
export const ELEVENLABS_AGENTS: ElevenLabsAgent[] = [
  {
    id: 'conversation',
    name: 'Conversation',
    description: 'Practice everyday English conversations',
    icon: '🗣️',
    category: 'general',
    agentId: 'YOUR_CONVERSATION_AGENT_ID', // ← REPLACE THIS!
  },
  {
    id: 'writing',
    name: 'Writing',
    description: 'Improve your writing skills',
    icon: '✏️',
    category: 'skills',
    agentId: 'YOUR_WRITING_AGENT_ID', // ← REPLACE THIS!
  },
  {
    id: 'programming',
    name: 'Programming',
    description: 'Learn coding and tech vocabulary',
    icon: '🧑‍💻',
    category: 'professional',
    agentId: 'YOUR_PROGRAMMING_AGENT_ID', // ← REPLACE THIS!
  },
];
```

## Replace With Your Actual Agent IDs

Go to: https://elevenlabs.io/app/conversational-ai

For each agent:
1. Click on the agent
2. Copy the agent ID from the URL or dashboard
3. Replace the placeholder in the config file

Example:
```typescript
agentId: 'agent_ZrVwGx8RQVm4k5w7dKxp', // ✅ Real agent ID
```

NOT:
```typescript
agentId: 'YOUR_CONVERSATION_AGENT_ID', // ❌ Placeholder
```

## Format

Agent IDs typically look like:
- `agent_` followed by random characters
- Example: `agent_abc123XYZ456def789`

## After Replacing

1. Save the file
2. Deploy edge function: `supabase functions deploy elevenlabs-get-signed-url`
3. Test in your app!

---

**NOTE:** You can have as many or as few agents as you want. Just add/remove entries from the array.
