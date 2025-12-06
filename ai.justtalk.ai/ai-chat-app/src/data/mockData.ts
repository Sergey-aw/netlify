// Mock data for AI Chat Subscription App

export interface Profile {
  id: string;
  email: string;
  display_name: string;
  name: string;
  role: 'student' | 'teacher' | 'admin';
  cefr_level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  native_language: string;
  learning_goals: string[];
  interests: string[];
  ai_onboarding_completed: boolean;
  ai_voice_preference?: string;
  ai_correction_style: 'gentle' | 'balanced' | 'strict';
  avatar_url?: string;
}

export interface AISubscription {
  id: string;
  student_id: string;
  subscription_type: 'basic' | 'premium' | 'unlimited';
  status: 'active' | 'paused' | 'canceled' | 'expired' | 'past_due';
  monthly_message_limit: number | null;
  messages_used_this_period: number;
  price_cents: number;
  currency: string;
  billing_cycle: 'monthly' | 'yearly';
  current_period_start: string;
  current_period_end: string;
  plan_name: string;
}

export interface AISubscriptionPlan {
  id: string;
  plan_name: string;
  plan_type: 'basic' | 'premium' | 'unlimited';
  description: string;
  monthly_message_limit: number | null;
  price_cents: number;
  currency: string;
  billing_cycle: 'monthly' | 'yearly';
  features: string[];
  is_active: boolean;
  is_featured: boolean;
  display_order: number;
}

export interface AIConversation {
  id: string;
  user_id: string;
  student_id: string;
  conversation_type: 'student_subscription';
  feature_name: string;
  title: string;
  is_voice_session: boolean;
  created_at: string;
  updated_at: string;
}

export interface AIMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  tokens_used?: number;
  corrections?: Array<{
    original: string;
    corrected: string;
    explanation?: string;
  }>;
}

export interface AIAgentConfig {
  id: string;
  student_id: string;
  system_prompt: string;
  learning_goals: string[];
  interests: string[];
  preferred_voice_id?: string;
  speaking_rate: number;
  correction_style: 'gentle' | 'balanced' | 'strict';
  formality_level: 'casual' | 'professional' | 'academic';
  active_scenarios: any[];
  is_active: boolean;
  onboarding_completed: boolean;
}

export interface VoiceSession {
  id: string;
  conversation_id: string;
  student_id: string;
  total_duration_seconds: number;
  student_speaking_time_seconds: number;
  ai_speaking_time_seconds: number;
  started_at: string;
  ended_at?: string;
}

export interface ConversationStarter {
  id: string;
  title: string;
  description: string;
  icon: string;
  message: string;
  scenario: string;
}

// Mock current user
export const mockCurrentUser: Profile = {
  id: '1',
  email: 'sergey.gordeev@example.com',
  display_name: 'Sergey',
  name: 'Sergey Gordeev',
  role: 'student',
  cefr_level: 'B2',
  native_language: 'Spanish',
  learning_goals: ['career', 'travel', 'conversation', 'academic', 'test_prep', 'kids'],
  interests: ['technology', 'travel', 'movies', 'cooking'],
  ai_onboarding_completed: true,
  ai_voice_preference: 'rachel',
  ai_correction_style: 'balanced',
  avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sergey'
};

// Mock subscription
export const mockSubscription: AISubscription = {
  id: 'sub_1',
  student_id: '1',
  subscription_type: 'premium',
  status: 'active',
  monthly_message_limit: 500,
  messages_used_this_period: 127,
  price_cents: 2999,
  currency: 'usd',
  billing_cycle: 'monthly',
  current_period_start: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
  current_period_end: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
  plan_name: 'Premium Plus'
};

// Mock subscription plans
export const mockSubscriptionPlans: AISubscriptionPlan[] = [
  {
    id: 'plan_basic',
    plan_name: 'Basic',
    plan_type: 'basic',
    description: 'Perfect for casual learners',
    monthly_message_limit: 100,
    price_cents: 999,
    currency: 'usd',
    billing_cycle: 'monthly',
    features: [
      '100 text messages/month',
      '24/7 availability',
      'Basic AI tutor',
      'Text-only conversations'
    ],
    is_active: true,
    is_featured: false,
    display_order: 1
  },
  {
    id: 'plan_premium',
    plan_name: 'Premium Plus',
    plan_type: 'premium',
    description: 'Best for serious learners',
    monthly_message_limit: 500,
    price_cents: 2999,
    currency: 'usd',
    billing_cycle: 'monthly',
    features: [
      '500 messages/month',
      'Voice conversation',
      'Advanced transcription',
      'Vocabulary tracking',
      'Grammar analysis',
      'Pronunciation feedback'
    ],
    is_active: true,
    is_featured: true,
    display_order: 2
  },
  {
    id: 'plan_unlimited',
    plan_name: 'Unlimited Plus',
    plan_type: 'unlimited',
    description: 'For power users',
    monthly_message_limit: null,
    price_cents: 6999,
    currency: 'usd',
    billing_cycle: 'monthly',
    features: [
      'Unlimited messages',
      'Voice conversation',
      'Advanced AI tutor',
      'Full analysis suite',
      'Priority processing',
      'Custom AI voice',
      'Dedicated support'
    ],
    is_active: true,
    is_featured: false,
    display_order: 3
  }
];

// Mock agent config
export const mockAgentConfig: AIAgentConfig = {
  id: 'agent_1',
  student_id: '1',
  system_prompt: 'You are a friendly English teacher...',
  learning_goals: ['career', 'travel', 'conversation', 'academic', 'test_prep', 'kids'],
  interests: ['technology', 'travel', 'movies', 'cooking'],
  preferred_voice_id: 'rachel',
  speaking_rate: 1.0,
  correction_style: 'balanced',
  formality_level: 'casual',
  active_scenarios: [
    { type: 'career', theme: 'interview_practice' },
    { type: 'travel', theme: 'restaurant_ordering' }
  ],
  is_active: true,
  onboarding_completed: true
};

// Mock conversations
export const mockConversations: AIConversation[] = [
  {
    id: 'conv_1',
    user_id: '1',
    student_id: '1',
    conversation_type: 'student_subscription',
    feature_name: 'ai_chat_subscription',
    title: 'Career Interview Practice',
    is_voice_session: false,
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'conv_2',
    user_id: '1',
    student_id: '1',
    conversation_type: 'student_subscription',
    feature_name: 'ai_chat_subscription',
    title: 'Travel Planning Discussion',
    is_voice_session: true,
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  }
];

// Mock messages for a conversation
export const mockMessages: AIMessage[] = [
  {
    id: 'msg_1',
    conversation_id: 'conv_1',
    role: 'assistant',
    content: "Hi Sarah! 👋 I'm Alex, your AI English teacher. I see you're interested in career development. How can I help you today?",
    created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString()
  },
  {
    id: 'msg_2',
    conversation_id: 'conv_1',
    role: 'user',
    content: "Hi! I have job interview next week and I want practice.",
    created_at: new Date(Date.now() - 29 * 60 * 1000).toISOString(),
    corrections: [
      {
        original: 'I have job interview',
        corrected: 'I have a job interview',
        explanation: 'Missing article "a" before countable noun'
      },
      {
        original: 'I want practice',
        corrected: 'I want to practice',
        explanation: 'The verb "want" requires "to" + infinitive'
      }
    ]
  },
  {
    id: 'msg_3',
    conversation_id: 'conv_1',
    role: 'assistant',
    content: "Great! I'd love to help you prepare. Just a small correction: \"I have *a* job interview next week and I want *to* practice.\" Don't worry, this is very common! Now, let's practice. I'll be the interviewer. Tell me about yourself and why you're interested in this position.",
    created_at: new Date(Date.now() - 28 * 60 * 1000).toISOString(),
    corrections: [
      {
        original: 'I have job interview',
        corrected: 'I have a job interview',
        explanation: 'We need the article "a" before countable nouns'
      },
      {
        original: 'I want practice',
        corrected: 'I want to practice',
        explanation: 'The verb "want" is followed by "to" + infinitive'
      }
    ]
  },
  {
    id: 'msg_4',
    conversation_id: 'conv_1',
    role: 'user',
    content: "I'm currently working as a software engineer at a small startup. I have been developing web applications for three years. I'm very passionate about creating user-friendly interfaces and solving complex problems. I'm interested in this position because it would allow me to work on larger scale projects and grow my technical skills.",
    created_at: new Date(Date.now() - 25 * 60 * 1000).toISOString()
  },
  {
    id: 'msg_5',
    conversation_id: 'conv_1',
    role: 'assistant',
    content: "Excellent response! 🌟 Your grammar was perfect, and your answer was well-structured. I especially liked how you mentioned your passion and connected it to what the company offers. \n\nLet's continue: Can you tell me about a challenging project you worked on and how you overcame the obstacles?",
    created_at: new Date(Date.now() - 24 * 60 * 1000).toISOString()
  },
  {
    id: 'msg_6',
    conversation_id: 'conv_1',
    role: 'user',
    content: "usually I like to travel with friend or girlfriend so we plan together and this uh should be so interesting for us maybe it could be some historical places or uh some uh nice Adventures places uh for example last weekend we plan to go by buses around some uh historical churches in our region",
    created_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    corrections: [
      {
        original: 'travel with friend',
        corrected: 'travel with a friend',
        explanation: 'Missing article "a" before singular countable noun'
      },
      {
        original: 'Adventures places',
        corrected: 'adventure places',
        explanation: '"Adventure" should be used as an adjective (not plural) when modifying "places"'
      },
      {
        original: 'we plan to go by buses',
        corrected: 'we planned to go by bus',
        explanation: 'Past tense needed for "last weekend", and "bus" (singular) is more natural in this context'
      }
    ]
  },
  {
    id: 'msg_7',
    conversation_id: 'conv_1',
    role: 'assistant',
    content: "That sounds wonderful! I love that you enjoy exploring historical places with friends. Here's a more polished version:\n\n\"Usually I like to travel with a friend or girlfriend, so we plan together. It should be interesting for us - maybe historical places or nice adventure spots. For example, last weekend we planned to go by bus to visit some historical churches in our region.\"\n\nYour meaning was clear! Just a few small grammar tweaks. Tell me more about those churches you visited!",
    created_at: new Date(Date.now() - 19 * 60 * 1000).toISOString()
  }
];

// Mock conversation starters
export const mockConversationStarters: ConversationStarter[] = [
  {
    id: 'starter_1',
    title: '💼 Practice Job Interview',
    description: "Let's prepare for your upcoming interview with realistic practice questions",
    icon: '💼',
    message: "I have a job interview coming up. Can you help me practice?",
    scenario: 'career'
  },
  {
    id: 'starter_2',
    title: '✈️ Plan Your Trip',
    description: 'Practice travel conversations: booking hotels, ordering food, asking directions',
    icon: '✈️',
    message: "I'm planning a trip and want to practice travel English.",
    scenario: 'travel'
  },
  {
    id: 'starter_3',
    title: '🎬 Discuss Movies',
    description: 'Chat about your favorite films and practice expressing opinions',
    icon: '🎬',
    message: "I just watched an amazing movie. Can we discuss it?",
    scenario: 'conversation'
  },
  {
    id: 'starter_4',
    title: '🍳 Recipe Exchange',
    description: 'Share recipes and cooking tips while learning food vocabulary',
    icon: '🍳',
    message: "I love cooking! Can we talk about recipes?",
    scenario: 'conversation'
  },
  {
    id: 'starter_5',
    title: '💻 Tech Talk',
    description: 'Discuss technology, programming, and innovation',
    icon: '💻',
    message: "I want to discuss the latest technology trends.",
    scenario: 'career'
  },
  {
    id: 'starter_6',
    title: '📚 Review Vocabulary',
    description: 'Practice words you learned in previous conversations',
    icon: '📚',
    message: "Can we review the vocabulary from my last session?",
    scenario: 'conversation'
  }
];

// Learning goal options
export const learningGoals = [
  {
    id: 'career',
    title: 'Career & Business',
    description: 'Workplace communication',
    icon: '💼',
    gradient: 'from-blue-400 to-blue-600'
  },
  {
    id: 'travel',
    title: 'Travel & Culture',
    description: 'Communicate while traveling',
    icon: '✈️',
    gradient: 'from-purple-400 to-purple-600'
  },
  {
    id: 'academic',
    title: 'Academic Success',
    description: 'University & research',
    icon: '🎓',
    gradient: 'from-green-400 to-green-600'
  },
  {
    id: 'conversation',
    title: 'Fluent Conversations',
    description: 'Natural everyday chat',
    icon: '💬',
    gradient: 'from-pink-400 to-pink-600'
  },
  {
    id: 'test_prep',
    title: 'Test Preparation',
    description: 'IELTS, TOEFL, Cambridge',
    icon: '📝',
    gradient: 'from-orange-400 to-orange-600'
  },
  {
    id: 'kids',
    title: 'Kids Learning',
    description: 'Fun for young learners',
    icon: '🎨',
    gradient: 'from-yellow-400 to-yellow-600'
  }
];

// Interest categories
export const interestCategories = {
  lifestyle: ['Travel', 'Food & Cooking', 'Fashion', 'Health & Fitness', 'Photography'],
  entertainment: ['Movies & TV', 'Music', 'Gaming', 'Reading', 'Sports'],
  professional: ['Technology', 'Business', 'Marketing', 'Design', 'Finance'],
  learning: ['Science', 'History', 'Philosophy', 'Current Events', 'Languages'],
  creative: ['Art', 'Writing', 'DIY Projects', 'Crafts', 'Architecture']
};

// Voice options
export const voiceOptions = [
  {
    id: 'rachel',
    name: 'Rachel',
    accent: 'American',
    gender: 'female',
    description: 'Warm and friendly',
    preview_url: '#'
  },
  {
    id: 'adam',
    name: 'Adam',
    accent: 'American',
    gender: 'male',
    description: 'Clear and professional',
    preview_url: '#'
  },
  {
    id: 'bella',
    name: 'Bella',
    accent: 'British',
    gender: 'female',
    description: 'Sophisticated and articulate',
    preview_url: '#'
  },
  {
    id: 'charlie',
    name: 'Charlie',
    accent: 'British',
    gender: 'male',
    description: 'Friendly and energetic',
    preview_url: '#'
  }
];

// CEFR levels
export const cefrLevels = [
  {
    level: 'A1',
    name: 'Beginner',
    description: 'Basic phrases and simple sentences'
  },
  {
    level: 'A2',
    name: 'Elementary',
    description: 'Simple conversations on familiar topics'
  },
  {
    level: 'B1',
    name: 'Intermediate',
    description: 'Most everyday situations'
  },
  {
    level: 'B2',
    name: 'Upper Intermediate',
    description: 'Complex texts and abstract topics'
  },
  {
    level: 'C1',
    name: 'Advanced',
    description: 'Sophisticated expression and nuance'
  },
  {
    level: 'C2',
    name: 'Proficient',
    description: 'Near-native speaker'
  }
];
