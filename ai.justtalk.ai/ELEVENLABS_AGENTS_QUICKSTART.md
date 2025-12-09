# Multiple ElevenLabs Agents - Quick Start

## 🎯 What You Need To Do

1. **Get your ElevenLabs Agent IDs** from https://elevenlabs.io/app/conversational-ai
2. **Open this file:** `ai-chat-app/src/config/elevenlabs-agents.ts`
3. **Replace the placeholder IDs** with your actual agent IDs
4. **Deploy the edge function:** `supabase functions deploy elevenlabs-get-signed-url`
5. **Test!**

## 📝 Example Configuration

```typescript
export const ELEVENLABS_AGENTS: ElevenLabsAgent[] = [
  {
    id: 'conversation',
    name: 'Conversation',
    description: 'Practice everyday English conversations',
    icon: '🗣️',
    category: 'general',
    agentId: 'agent_abc123xyz456', // ← Replace this!
  },
  {
    id: 'writing',
    name: 'Writing',
    description: 'Improve your writing skills',
    icon: '✏️',
    category: 'skills',
    agentId: 'agent_def789uvw012', // ← Replace this!
  },
  {
    id: 'programming',
    name: 'Programming',
    description: 'Learn coding and tech vocabulary',
    icon: '🧑‍💻',
    category: 'professional',
    agentId: 'agent_ghi345rst678', // ← Replace this!
  },
];
```

## 🎨 Customization Options

### Change Icons
Use any emoji:
- 🎓 Education
- 🌍 Travel  
- 💼 Business
- 📚 Reading
- 🎮 Gaming
- 🎵 Music
- 🍳 Cooking
- ⚽ Sports

### Change Names
Match your brand:
```typescript
name: 'Daily Conversations'  // Instead of 'Conversation'
name: 'Code Mentor'          // Instead of 'Programming'
name: 'Essay Master'         // Instead of 'Writing'
```

### Add More Agents
Just copy-paste a new entry:
```typescript
{
  id: 'business',
  name: 'Business English',
  description: 'Master workplace communication',
  icon: '💼',
  category: 'professional',
  agentId: 'agent_YOUR_NEW_AGENT_ID',
},
```

## 🔍 How To Find Your Agent IDs

1. Go to https://elevenlabs.io/app/conversational-ai
2. Click on an agent
3. The URL will look like: `...conversational-ai/agent_abc123...`
4. Copy everything after `conversational-ai/` (including `agent_`)
5. That's your agent ID!

Example:
- URL: `https://elevenlabs.io/app/conversational-ai/agent_abc123xyz456/edit`
- Agent ID: `agent_abc123xyz456` ✅

## ✅ Testing

After setup:

1. Start dev server: `npm run dev` (from ai-chat-app directory)
2. Open home screen
3. You should see 3 cards with your agent names and icons
4. Click each card
5. Voice chat should start with that specific agent
6. Check console logs for confirmation:
   ```
   🤖 Selected Agent: { agentId: "agent_...", agentName: "..." }
   ```

## 🚀 Production Deployment

1. Deploy edge function:
   ```bash
   supabase functions deploy elevenlabs-get-signed-url
   ```

2. Deploy frontend (depends on your setup):
   ```bash
   npm run build
   # Then deploy to Vercel/Netlify/etc
   ```

## 📊 Visual Flow

```
┌─────────────────────────────┐
│      Home Screen            │
│                             │
│  ┌─────┐  ┌─────┐  ┌─────┐ │
│  │ 🗣️  │  │ ✏️  │  │🧑‍💻 │ │
│  │ Conv│  │Write│  │ Code│ │
│  └─────┘  └─────┘  └─────┘ │
│         (Cards)             │
└──────────┬──────────────────┘
           │ User clicks "Conv"
           ▼
┌─────────────────────────────┐
│   Navigation with Agent     │
│   agentId: agent_abc123     │
│   agentName: Conversation   │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│     Voice Chat Screen       │
│  "Chat with Conversation"   │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│   Get Signed URL (API)      │
│   + Pass agentId            │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│   Edge Function             │
│   Uses agent_abc123         │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│   ElevenLabs API            │
│   Creates WebSocket with    │
│   specific agent            │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│   User talks with selected  │
│   AI teacher! 🎉            │
└─────────────────────────────┘
```

## 🛟 Help

**Cards not showing?**
- Check `elevenlabs-agents.ts` for syntax errors
- Look in browser console for error messages

**Wrong agent responding?**
- Verify agent IDs in config match ElevenLabs dashboard
- Check console logs for which agent was selected

**Connection failing?**
- Verify agent is published in ElevenLabs
- Check edge function logs in Supabase dashboard
- Verify `ELEVENLABS_API_KEY` is set in Supabase

## 📚 Full Documentation

See `ELEVENLABS_AGENTS_SETUP.md` for complete details, troubleshooting, and advanced configuration.

---

**That's it! Replace the IDs and you're ready to go!** 🚀
