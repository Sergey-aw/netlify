// JustAI Agents Service
// Handles fetching and managing agents with progress tracking

import { supabase } from '@/lib/supabase';
import type { 
  // JustAIAgent, 
  AgentWithProgress, 
  AgentCategory,
  UnlockRequirement,
  StudentProgress 
} from '@/types/agents';

/**
 * Get unique personalities within a category with their descriptions
 */
export async function getPersonalitiesByCategory(category: string): Promise<Array<{ name: string; description: string; avatar: string }>> {
  // Fetch top-level agents (parent agents or single agents) for this category
  const { data: agents, error } = await supabase
    .from('justai_agents')
    .select('personality_name, description, name')
    .eq('category', category)
    .eq('is_active', true)
    .is('parent_agent_id', null)
    .not('personality_name', 'is', null);

  if (error) throw error;

  // Create a map to get unique personalities with their descriptions
  const personalityMap = new Map<string, { description: string; name: string }>();
  
  agents?.forEach(agent => {
    if (agent.personality_name && !personalityMap.has(agent.personality_name)) {
      personalityMap.set(agent.personality_name, {
        description: agent.description || '',
        name: agent.name
      });
    }
  });

  // Convert to array with avatars
  return Array.from(personalityMap.entries()).map(([name, data]) => ({
    name,
    description: data.description,
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}&backgroundColor=b6e3f4`,
  }));
}

/**
 * Fetch all active agents grouped by category with user progress, optionally filtered by personality
 */
export async function getAgentsByCategory(userId: string, personalityFilter?: string): Promise<AgentCategory[]> {
  // Fetch all parent/single agents (excluding steps)
  let query = supabase
    .from('justai_agents')
    .select('*')
    .eq('is_active', true)
    .is('parent_agent_id', null)
    .order('category', { ascending: true })
    .order('display_order', { ascending: true });

  if (personalityFilter) {
    query = query.eq('personality_name', personalityFilter);
  }

  const { data: agents, error: agentsError } = await query;

  if (agentsError) throw agentsError;

  // Fetch user's progress for all agents
  const { data: progress, error: progressError } = await supabase
    .from('justai_student_progress')
    .select('*')
    .eq('student_id', userId);

  if (progressError) throw progressError;

  // Create progress map for quick lookup
  const progressMap = new Map<string, StudentProgress>();
  progress?.forEach(p => progressMap.set(p.agent_id, p));

  // Group agents by category
  const categoryMap = new Map<string, AgentWithProgress[]>();

  for (const agent of agents || []) {
    const agentWithProgress: AgentWithProgress = {
      ...agent,
      progress: progressMap.get(agent.id),
    };

    // If multi-step, fetch child steps with progress
    if (agent.is_multi_step) {
      const { data: steps } = await supabase
        .from('justai_agents')
        .select('*')
        .eq('parent_agent_id', agent.id)
        .order('step_number', { ascending: true });

      agentWithProgress.steps = steps?.map(step => ({
        ...step,
        progress: progressMap.get(step.id),
      })) || [];
    }

    const category = agent.category;
    if (!categoryMap.has(category)) {
      categoryMap.set(category, []);
    }
    categoryMap.get(category)!.push(agentWithProgress);
  }

  // Convert to array of categories
  return Array.from(categoryMap.entries()).map(([category, agents]) => {
    const completedAgents = agents.filter(a => 
      a.progress?.status === 'completed'
    ).length;
    
    const unlockedAgents = agents.filter(a => 
      !a.progress || a.progress.status === 'unlocked' || a.progress.status === 'in_progress'
    ).length;

    return {
      category,
      icon: agents[0]?.icon || '📚',
      agents,
      totalAgents: agents.length,
      completedAgents,
      unlockedAgents,
    };
  });
}

/**
 * Fetch a single agent with all its steps and progress
 */
export async function getAgentWithSteps(
  agentId: string, 
  userId: string
): Promise<AgentWithProgress | null> {
  const { data: agent, error: agentError } = await supabase
    .from('justai_agents')
    .select('*')
    .eq('id', agentId)
    .single();

  if (agentError) throw agentError;
  if (!agent) return null;

  // Get progress for this agent
  const { data: progress } = await supabase
    .from('justai_student_progress')
    .select('*')
    .eq('student_id', userId)
    .eq('agent_id', agentId)
    .single();

  const agentWithProgress: AgentWithProgress = {
    ...agent,
    progress: progress || undefined,
  };

  // If multi-step, fetch steps with progress
  if (agent.is_multi_step) {
    const { data: steps } = await supabase
      .from('justai_agents')
      .select(`
        *,
        progress:justai_student_progress(*)
      `)
      .eq('parent_agent_id', agentId)
      .eq('justai_student_progress.student_id', userId)
      .order('step_number', { ascending: true });

    agentWithProgress.steps = steps?.map(step => ({
      ...step,
      progress: Array.isArray(step.progress) ? step.progress[0] : step.progress,
    })) || [];
  }

  return agentWithProgress;
}

/**
 * Unlock the first step of a roleplay for a student
 */
export async function unlockFirstStep(
  userId: string,
  parentAgentId: string
): Promise<void> {
  const { error } = await supabase.rpc('unlock_first_step', {
    p_student_id: userId,
    p_parent_agent_id: parentAgentId,
  });

  if (error) throw error;
}

/**
 * Update student progress after a session
 */
export async function updateStudentProgress(
  userId: string,
  agentId: string,
  messagesSent: number,
  timeSpentSeconds: number,
  conversationId?: string
): Promise<void> {
  const { error } = await supabase.rpc('update_student_progress', {
    p_student_id: userId,
    p_agent_id: agentId,
    p_messages_sent: messagesSent,
    p_time_spent_seconds: timeSpentSeconds,
    p_conversation_id: conversationId || null,
  });

  if (error) throw error;
}

/**
 * Archive a roleplay and all its steps
 */
export async function archiveRoleplay(
  userId: string,
  parentAgentId: string
): Promise<void> {
  const { error } = await supabase.rpc('archive_roleplay_progress', {
    p_student_id: userId,
    p_parent_agent_id: parentAgentId,
  });

  if (error) throw error;
}

/**
 * Get unlock requirements for a step
 */
export function getUnlockRequirements(
  step: AgentWithProgress,
  previousStepProgress?: StudentProgress
): UnlockRequirement | null {
  if (!step.unlock_condition_type) return null;

  const type = step.unlock_condition_type;
  const value = step.unlock_condition_value || 0;

  let label = '';
  let isMet = false;

  switch (type) {
    case 'previous_step':
      label = 'Complete previous step';
      isMet = previousStepProgress?.status === 'completed';
      break;

    case 'message_count':
      label = `Send ${value} messages in previous step`;
      isMet = (previousStepProgress?.total_messages_sent || 0) >= value;
      break;

    case 'time_spent':
      const minutes = Math.floor(value / 60);
      label = `Spend ${minutes} minutes in previous step`;
      isMet = (previousStepProgress?.total_time_spent_seconds || 0) >= value;
      break;

    case 'score_threshold':
      label = `Achieve ${value}% score in previous step`;
      isMet = (previousStepProgress?.best_session_score || 0) >= value;
      break;

    case 'manual_unlock':
      label = 'Requires teacher approval';
      isMet = false;
      break;

    default:
      return null;
  }

  return { type, value, label, isMet };
}

/**
 * Calculate progress percentage for a multi-step agent
 */
export function calculateProgressPercentage(agent: AgentWithProgress): number {
  if (!agent.is_multi_step || !agent.steps) return 0;

  const completedSteps = agent.steps.filter(
    step => step.progress?.status === 'completed'
  ).length;

  return Math.round((completedSteps / agent.total_steps) * 100);
}

/**
 * Check if an agent is locked for the user
 */
export function isAgentLocked(agent: AgentWithProgress): boolean {
  if (!agent.progress) return true; // No progress = locked
  return agent.progress.status === 'locked';
}

/**
 * Get the next unlocked step in a multi-step agent
 */
export function getNextUnlockedStep(
  agent: AgentWithProgress
): AgentWithProgress | null {
  if (!agent.is_multi_step || !agent.steps) return null;

  return agent.steps.find(step => 
    step.progress?.status === 'unlocked' || 
    step.progress?.status === 'in_progress'
  ) || null;
}

/**
 * Format time spent in human-readable format
 */
export function formatTimeSpent(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Get score badge color based on score value
 */
export function getScoreBadgeColor(score: number): string {
  if (score >= 80) return 'bg-green-100 text-green-800';
  if (score >= 60) return 'bg-yellow-100 text-yellow-800';
  return 'bg-orange-100 text-orange-800';
}

/**
 * Get score label based on score value
 */
export function getScoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Great';
  if (score >= 70) return 'Good';
  if (score >= 60) return 'Fair';
  return 'Needs Work';
}
