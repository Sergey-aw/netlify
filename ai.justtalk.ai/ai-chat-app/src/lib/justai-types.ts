// JustAI Supabase client types and utilities

export interface SubscriptionPlan {
  id: string;
  plan_name: string;
  plan_type: 'basic' | 'premium' | 'unlimited';
  billing_period: 'monthly' | 'annual';
  description: string;
  monthly_message_limit: number | null;
  includes_voice: boolean;
  price_cents: number;
  monthly_equivalent_cents: number;
  discount_percentage: number;
  stripe_price_id: string;
  stripe_product_id: string;
  features: string[];
  is_active: boolean;
  is_featured: boolean;
  display_order: number;
}

export interface Subscription {
  id: string;
  student_id: string;
  plan_id: string;
  billing_period: 'monthly' | 'annual';
  status: 'active' | 'past_due' | 'canceled' | 'incomplete';
  stripe_subscription_id: string;
  stripe_customer_id: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  messages_used_this_period: number;
  created_at: string;
  updated_at: string;
  plan?: SubscriptionPlan;
}

export interface AgentConfig {
  id: string;
  student_id: string;
  learning_goals: string[];
  interests: string[];
  cefr_level: string;
  preferred_voice_id: string;
  correction_style: 'strict' | 'balanced' | 'encouraging';
  formality_level: 'casual' | 'neutral' | 'formal';
  system_prompt_template: string;
  onboarding_completed: boolean;
}

export interface VoiceSession {
  id: string;
  student_id: string;
  conversation_id: string;
  elevenlabs_conversation_id: string;
  scenario: string;
  duration_seconds: number | null;
  started_at: string;
  ended_at: string | null;
  message_count: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  student_id: string;
  role: 'user' | 'assistant';
  content: string;
  tokens_used: number | null;
  created_at: string;
}
