// ElevenLabs Agent Configurations
// Each agent represents a different AI teacher with specific characteristics

export interface ElevenLabsAgent {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  agentId: string; // ElevenLabs agent ID
  recommendedDuration?: number; // Recommended duration in seconds
}

export const ELEVENLABS_AGENTS: ElevenLabsAgent[] = [
  {
    id: 'Interview: Focus on feedback',
    name: 'Interview, feedback',
    description: 'Interview: Focus on feedback',
    icon: '🙋🏻‍♂️',
    category: 'general',
    agentId: 'agent_9401kbzbmks4f4btzs4yy7ny36qp', // Replace with your actual agent ID
    recommendedDuration: 60, // 1 minute
  },
  {
    id: 'Interviews: Focus on practice',
    name: 'Interviews, practice',
    description: 'Interviews: Focus on practice',
    icon: '🗣️',
    category: 'skills',
    agentId: 'agent_6301kbzbpp6xfezsw2zrf71vvkah', // Replace with your actual agent ID
    recommendedDuration: 60, // 8 minutes
  },
  {
    id: 'Interviews: Focus on conversation',
    name: 'Interviews, conversation',
    description: 'Interviews: Focus on conversation',
    icon: '🗣️   ',
    category: 'professional',
    agentId: 'agent_0401kbzbr6z5ezb867w9h3zsthwt', // Replace with your actual agent ID
    recommendedDuration: 60, // 7 minutes
  },
   {
    id: 'Freetalk: Best for engagement',
    name: 'Freetalk, engagement',
    description: 'Freetalk: Best for engagement',
    icon: '🎙️',
    category: 'professional',
    agentId: 'agent_1201kbzc4wmef1ka9hhv3fbhqmt4', // Replace with your actual agent ID
    recommendedDuration: 60, // 10 minutes
  },
  {
    id: 'Dating & Relationships: Maya Chen',
    name: 'Dating & Relationships, Maya Chen',
    description: 'Dating & Relationships: Maya Chen',
    icon: '🎙️',
    category: 'dating',
    agentId: 'agent_8801kc9vqcphf2c8h1ft1z2jbmng', // Replace with your actual agent ID
    recommendedDuration: 60, // 10 minutes
  },
  {
    id: 'Dating & Relationships: Maya Chen Second Date',
    name: 'Dating & Relationships, Maya Chen Second Date',
    description: 'Dating & Relationships: Maya Chen Second Date',
    icon: '🎙️',
    category: 'dating',
    agentId: 'agent_4501kca0jwe6fvbv74amm8fp9bf4', // Replace with your actual agent ID
    recommendedDuration: 60, // 10 minutes
  },
   {
    id: 'TOEFL: Task 1 - Describe Graph',
    name: 'TOEFL: Task 1 - Describe Graph',
    description: 'TOEFL: Task 1 - Describe Graph',
    icon: '🎙️',
    category: 'education',
    agentId: 'agent_4301kc80gab4fksvn8dzqvkkzs9r', // Replace with your actual agent ID
    recommendedDuration: 60, // 10 minutes
  },
  {
    id: 'IELTS: Part 1',
    name: 'IELTS: Part 1',
    description: 'IELTS: Part 1',
    icon: '🎙️',
    category: 'education',
    agentId: 'agent_7101kc80c55ge9pr8rc29fkdy0jm', // Replace with your actual agent ID
    recommendedDuration: 60, // 10 minutes
  },
  {
    id: 'Business: Giving a Status Update',
    name: 'Business: Giving a Status Update',
    description: 'Business: Giving a Status Update',
    icon: '🎙️',
    category: 'education',
    agentId: 'agent_7101kc805a5tes7r911sebmqcyzs', // Replace with your actual agent ID
    recommendedDuration: 60, // 10 minutes
  },
  {
    id: 'Social: Describing Childhood',
    name: 'Social: Describing Childhood',
    description: 'Social: Describing Childhood',
    icon: '🎙️',
    category: 'social',
    agentId: 'agent_0401kc7zwbrceh08t39c3xcbcwqz', // Replace with your actual agent ID
    recommendedDuration: 60, // 10 minutes
  },
  {
    id: 'Social: Meeting someone new at a party',
    name: 'Social: Meeting someone new at a party',
    description: 'Social: Meeting someone new at a party',
    icon: '🎙️',
    category: 'social',
    agentId: 'agent_0001kc7zb0kmfy5tn4aw6xqz9bmj', // Replace with your actual agent ID
    recommendedDuration: 60, // 10 minutes
  },
   {
    id: 'Daily Life: Changing rooms (Clothes)',
    name: 'Daily Life: Changing rooms (Clothes)',
    description: 'Daily Life: Changing rooms (Clothes)',
    icon: '🎙️',
    category: 'Daily Life',
    agentId: 'agent_0901kc7z3yewfhysrbb1zkztx8bg', // Replace with your actual agent ID
    recommendedDuration: 60, // 10 minutes
  },
  {
    id: 'Travel: Airport check-in',
    name: 'Travel: Airport check-in',
    description: 'Travel: Airport check-in',
    icon: '🎙️',
    category: 'Travel',
    agentId: 'agent_8901kc7yzafzf8kvzmrz92444mje', // Replace with your actual agent ID
    recommendedDuration: 60, // 10 minutes
  },
   {
    id: 'Interview: Strengths and Weaknesses',
    name: 'Interview: Strengths and Weaknesses',
    description: 'Interview: Strengths and Weaknesses',
    icon: '🎙️',
    category: 'Interview',
    agentId: 'agent_7101kc7yqwnyef7867pkh9epas2b', // Replace with your actual agent ID
    recommendedDuration: 60, // 10 minutes
  },
  {
    id: 'Interview: Tell me about yourself',
    name: 'Interview: Tell me about yourself',
    description: 'Interview: Tell me about yourself',
    icon: '🎙️',
    category: 'Interview',
    agentId: 'agent_7801kc7yfx17fqa80c7d5favvdnm', // Replace with your actual agent ID
    recommendedDuration: 60, // 10 minutes
  },
  {
    id: 'Daily Life: Visiting a doctor',
    name: 'Daily Life: Visiting a doctor',
    description: 'Daily Life: Visiting a doctor',
    icon: '🎙️',
    category: 'Daily Life',
    agentId: 'agent_6601kc7xzfnde2hs8vnr9757y25c', // Replace with your actual agent ID
    recommendedDuration: 60, // 10 minutes
  },
   {
    id: 'Daily Life: Returning an item / asking for a refund',
    name: 'Daily Life: Returning an item / asking for a refund',
    description: 'Daily Life: Returning an item / asking for a refund',
    icon: '🎙️',
    category: 'Daily Life',
    agentId: 'agent_2601kc7xm849es58ftg0rjwptveq', // Replace with your actual agent ID
    recommendedDuration: 60, // 10 minutes
  },
  {
    id: 'Daily Life: Ordering at a Cafe',
    name: 'Daily Life: Ordering at a Cafe',
    description: 'Daily Life: Ordering at a Cafe',
    icon: '🎙️',
    category: 'Daily Life',
    agentId: 'agent_2001kc7qrf91eabrk82nqjnrvxrd', // Replace with your actual agent ID
    recommendedDuration: 60, // 10 minutes
  },
];

// Helper function to get agent by ID
export function getAgentById(agentId: string): ElevenLabsAgent | undefined {
  return ELEVENLABS_AGENTS.find(agent => agent.id === agentId);
}

// Helper function to get agent by ElevenLabs agent ID
export function getAgentByElevenLabsId(elevenLabsAgentId: string): ElevenLabsAgent | undefined {
  return ELEVENLABS_AGENTS.find(agent => agent.agentId === elevenLabsAgentId);
}

// Default agent (fallback)
export const DEFAULT_AGENT = ELEVENLABS_AGENTS[0];
