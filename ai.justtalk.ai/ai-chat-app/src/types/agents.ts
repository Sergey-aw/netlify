// JustAI Agents - Optimized Single Table Types

export interface JustAIAgent {
  id: string;
  
  // Hierarchical structure
  parent_agent_id: string | null;
  step_number: number | null;
  is_multi_step: boolean;
  total_steps: number;
  
  // Agent details
  name: string;
  description: string | null;
  icon: string | null;
  image_url: string | null;
  
  // Category & organization
  category: string;
  personality_name: string | null;
  
  // ElevenLabs integration
  elevenlabs_agent_id: string;
  recommended_duration_seconds: number;
  
  // Unlock & access
  unlock_condition_type: UnlockConditionType | null;
  unlock_condition_value: number | null;
  
  // Difficulty & targeting
  difficulty_level: DifficultyLevel | null;
  recommended_cefr_level: CEFRLevel | null;
  
  // Premium & visibility
  is_active: boolean;
  is_premium: boolean;
  display_order: number;
  
  // Metadata
  created_at: string;
  updated_at: string;
}

export type UnlockConditionType = 
  | 'previous_step'
  | 'message_count'
  | 'time_spent'
  | 'score_threshold'
  | 'manual_unlock';

export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced';

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export interface StudentProgress {
  id: string;
  student_id: string;
  agent_id: string;
  
  // Progress tracking
  status: ProgressStatus;
  
  // Session metrics
  sessions_count: number;
  total_messages_sent: number;
  total_time_spent_seconds: number;
  
  // Scoring
  best_session_score: number | null;
  latest_session_score: number | null;
  average_session_score: number | null;
  total_score_sum: number;
  best_session_conversation_id: string | null;
  
  // Timestamps
  unlocked_at: string | null;
  first_started_at: string | null;
  completed_at: string | null;
  archived_at: string | null;
  
  created_at: string;
  updated_at: string;
}

export type ProgressStatus = 
  | 'locked'
  | 'unlocked'
  | 'in_progress'
  | 'completed'
  | 'archived';

// Agent with progress (joined data)
export interface AgentWithProgress extends JustAIAgent {
  progress?: StudentProgress;
  steps?: AgentWithProgress[]; // For multi-step agents
}

// Category view (grouped agents)
export interface AgentCategory {
  category: string;
  icon: string;
  agents: AgentWithProgress[];
  totalAgents: number;
  completedAgents: number;
  unlockedAgents: number;
}

// Helper type for unlock requirements display
export interface UnlockRequirement {
  type: UnlockConditionType;
  value: number;
  label: string; // Human-readable description
  isMet: boolean; // Whether condition is satisfied
}
