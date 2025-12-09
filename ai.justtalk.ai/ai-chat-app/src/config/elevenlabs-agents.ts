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
    recommendedDuration: 480, // 8 minutes
  },
  {
    id: 'Interviews: Focus on conversation',
    name: 'Interviews, conversation',
    description: 'Interviews: Focus on conversation',
    icon: '🗣️   ',
    category: 'professional',
    agentId: 'agent_0401kbzbr6z5ezb867w9h3zsthwt', // Replace with your actual agent ID
    recommendedDuration: 420, // 7 minutes
  },
   {
    id: 'Freetalk: Best for engagement',
    name: 'Freetalk, engagement',
    description: 'Freetalk: Best for engagement',
    icon: '🎙️',
    category: 'professional',
    agentId: 'agent_1201kbzc4wmef1ka9hhv3fbhqmt4', // Replace with your actual agent ID
    recommendedDuration: 600, // 10 minutes
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
