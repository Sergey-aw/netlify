// Type definitions for the new personality-based roleplay system

export interface Personality {
  id: string;
  name: string;
  short_name: string;
  description: string;
  avatar_url: string | null;
  teaching_style: string;
  expertise_areas: string[];
  personality_traits: string[];
  is_active: boolean;
  display_order: number;
}

export interface RoleplayCategory {
  id: string;
  personality_id: string;
  name: string;
  description: string | null;
  icon: string | null;
  display_order: number;
  is_active: boolean;
}

export interface Roleplay {
  id: string;
  category_id: string;
  name: string;
  description: string;
  scenario_context: string | null;
  is_multi_step: boolean;
  total_steps: number;
  estimated_duration_minutes: number | null;
  difficulty_level: 'beginner' | 'intermediate' | 'advanced';
  recommended_cefr_level: string | null;
  display_order: number;
  is_active: boolean;
  is_premium: boolean;
}

export interface RoleplayStep {
  id: string;
  roleplay_id: string;
  step_number: number;
  name: string;
  description: string | null;
  instructions: string | null;
  elevenlabs_agent_id: string;
  estimated_duration_minutes: number | null;
  unlock_condition_type: 'previous_step' | 'message_count' | 'time_spent' | 'score_threshold' | 'manual_unlock' | null;
  unlock_condition_value: number | null;
  unlock_previous_step_id: string | null;
  is_active: boolean;
}

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
  total_score_sum: number;
  best_session_conversation_id: string | null;
  unlocked_at: string | null;
  first_started_at: string | null;
  completed_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RoleplayStepWithProgress {
  step: RoleplayStep;
  progress: StudentProgress | null;
}

export interface RoleplayWithSteps extends Roleplay {
  steps: RoleplayStepWithProgress[];
}

export interface CategoryWithRoleplays extends RoleplayCategory {
  roleplays: RoleplayWithSteps[];
}

export interface PersonalityStructure {
  personality: Personality;
  categories: CategoryWithRoleplays[];
}
