// JustAI API utilities for Supabase Edge Functions
import { supabase } from './supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

/**
 * Get signed URL for ElevenLabs WebSocket connection
 */
export async function getElevenLabsSignedUrl(params: {
  conversationId: string;
  scenario?: string;
  voiceId?: string;
  voiceName?: string;
  agentId?: string; // ElevenLabs agent ID
  dynamicVariables?: Record<string, any>; // Context from previous step
}) {
  const session = await supabase.auth.getSession();
  const accessToken = session.data.session?.access_token;

  if (!accessToken) {
    throw new Error('Not authenticated');
  }

  const requestBody = {
    conversation_id: params.conversationId,
    scenario: params.scenario || 'conversation',
    voiceId: params.voiceId,
    voiceName: params.voiceName,
    agentId: params.agentId, // Pass agent ID to edge function
    dynamicVariables: params.dynamicVariables, // Pass context from previous step
  };
  
  console.log('🚀 Sending request to edge function:', requestBody);

  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/elevenlabs-get-signed-url`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get signed URL: ${error}`);
  }

  const data = await response.json();
  return {
    signedUrl: data.signed_url as string,
    systemPrompt: data.system_prompt as string,
  };
}

/**
 * Get context memory from previous conversations in the roleplay series
 */
export async function getContextMemory(agentId: string): Promise<string> {
  const session = await supabase.auth.getSession();
  const accessToken = session.data.session?.access_token;
  const user = session.data.session?.user;

  if (!accessToken || !user) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/get-context-memory`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agent_id: agentId,
        student_id: user.id,
      }),
    }
  );

  if (!response.ok) {
    console.error('Failed to get context memory, continuing without it');
    return ''; // Return empty string if fails
  }

  const data = await response.json();
  console.log('📚 Context memory retrieved:', {
    length: data.context_memory?.length || 0,
    conversationsCount: data.conversations_count || 0,
  });
  
  return data.context_memory || '';
}

/**
 * Get conversation transcript from ElevenLabs
 */
export async function getConversationTranscript(conversationId: string) {
  const session = await supabase.auth.getSession();
  const accessToken = session.data.session?.access_token;

  if (!accessToken) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/elevenlabs-get-conversation`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversation_id: conversationId,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get transcript: ${error}`);
  }

  return response.json();
}

/**
 * Create Stripe checkout session for subscription
 */
export async function createCheckoutSession(priceId: string, coupon?: string) {
  console.log('createCheckoutSession: Starting...');
  
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;

  console.log('createCheckoutSession: Session check', {
    hasSession: !!session,
    hasToken: !!accessToken,
    tokenPreview: accessToken ? `${accessToken.substring(0, 30)}...` : 'MISSING',
    userId: session?.user?.id,
    isAnonymous: session?.user?.is_anonymous,
    coupon: coupon || 'none'
  });

  if (!accessToken) {
    throw new Error('Not authenticated');
  }

  const requestBody: { priceId: string; coupon?: string } = {
    priceId: priceId,
  };
  
  // Add coupon if provided
  if (coupon) {
    requestBody.coupon = coupon;
  }

  console.log('createCheckoutSession: Sending request', {
    url: `${SUPABASE_URL}/functions/v1/create-checkout-session`,
    body: requestBody
  });

  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/create-checkout-session`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    }
  );

  console.log('createCheckoutSession: Response received', {
    status: response.status,
    statusText: response.statusText,
    ok: response.ok
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('createCheckoutSession: Error response', {
      status: response.status,
      error: error
    });
    throw new Error(`Failed to create checkout session: ${error}`);
  }

  const data = await response.json();
  console.log('createCheckoutSession: Success', { hasUrl: !!data.url });
  return data.url as string;
}

/**
 * Check subscription access and usage
 */
export async function checkSubscriptionAccess() {
  const { data: user } = await supabase.auth.getUser();
  
  if (!user.user) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase.rpc('check_justai_subscription_access', {
    p_student_id: user.user.id,
  });

  if (error) {
    throw error;
  }

  return {
    hasActiveSubscription: data[0]?.has_active_subscription || false,
    planName: data[0]?.plan_name || null,
    messageLimit: data[0]?.message_limit || null,
    messagesUsed: data[0]?.messages_used || 0,
    messagesRemaining: data[0]?.messages_remaining || 0,
    includesVoice: data[0]?.includes_voice || false,
    periodEnd: data[0]?.period_end || null,
  };
}

/**
 * Check if email already exists in profiles table
 * Used before creating anonymous user to prevent duplicates
 */
export async function checkEmailExists(email: string): Promise<{ exists: boolean; canUseMagicLink: boolean }> {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/check-email-exists`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Failed to check email:', error);
      return { exists: false, canUseMagicLink: false }; // Fail open - allow signup attempt
    }

    const data = await response.json();
    return {
      exists: data.exists || false,
      canUseMagicLink: data.canUseMagicLink || false,
    };
  } catch (error) {
    console.error('Error checking email:', error);
    return { exists: false, canUseMagicLink: false }; // Fail open - allow signup attempt
  }
}

interface TranscriptMessage {
  speaker: 'student' | 'ai';
  text: string;
}

/**
 * Get conversation suggestions from LLM based on recent transcript and vocabulary
 */
export async function getConversationSuggestions(params: {
  transcript: TranscriptMessage[];
  vocabularyWords?: string[];
}): Promise<string[]> {
  const openaiKey = import.meta.env.VITE_OPENAI_API_KEY;

  if (!openaiKey) {
    throw new Error('OpenAI API key not configured');
  }

  // Get the last 1-2 minutes of conversation (approximately last 6-10 messages)
  const recentTranscript = params.transcript.slice(-10);
  const transcriptText = recentTranscript
    .map(m => `${m.speaker === 'student' ? 'Student' : 'AI'}: ${m.text}`)
    .join('\n');

  const vocabularyList = params.vocabularyWords && params.vocabularyWords.length > 0 
    ? `\nVocabulary words the student is practicing: ${params.vocabularyWords.join(', ')}`
    : '';

  const prompt = `You are a speaking assistant for a language learner.
Your task is to help the student continue the conversation naturally when they get stuck.

You will receive:

1. A recent transcript excerpt (approximately the last 1–2 minutes of conversation).
2. A list of vocabulary words the student is trying to practice.

Your output:

- Produce exactly 2 or 3 short, natural sentences the student could realistically say next.
- The sentences must fit the conversational context and topic.
- If it feels natural, incorporate one or more of the target vocabulary words.
- Do NOT force vocabulary usage. Naturalness is more important than coverage.
- Do NOT explain, label, or comment on the sentences.
- Do NOT ask questions unless questions clearly fit the flow of the conversation.
- Avoid teacher-like language, meta commentary, or unnatural phrasing.
- Keep sentences concise, spoken, and human.

Output only the sentences. No additional text.

Recent transcript:
${transcriptText}${vocabularyList}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 200,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get suggestions: ${error}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content || '';
  
  // Split by newlines and filter out empty lines
  const suggestions = content
    .split('\n')
    .map((s: string) => s.trim())
    .filter((s: string) => s.length > 0 && !s.match(/^[\d\-\.\*]+$/))  // Remove numbered/bulleted list markers
    .map((s: string) => s.replace(/^[\d\-\.\*]+\s*/, ''))  // Clean any remaining list markers
    .slice(0, 3);  // Ensure max 3 suggestions

  return suggestions;
}

