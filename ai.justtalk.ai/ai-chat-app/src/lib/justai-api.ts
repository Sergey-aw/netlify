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
 * @param embedded - If true, returns clientSecret for embedded checkout; if false, returns redirect URL
 * @param pricingVariant - The A/B test variant for pricing (control, plan-a, plan-b)
 */
export async function createCheckoutSession(
  priceId: string, 
  coupon?: string, 
  trialDays?: number, 
  trialVariant?: string,
  embedded?: boolean,
  pricingVariant?: string
): Promise<{ url?: string; clientSecret?: string }> {
  console.log('createCheckoutSession: Starting...');
  
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;

  console.log('createCheckoutSession: Session check', {
    hasSession: !!session,
    hasToken: !!accessToken,
    tokenPreview: accessToken ? `${accessToken.substring(0, 30)}...` : 'MISSING',
    userId: session?.user?.id,
    isAnonymous: session?.user?.is_anonymous,
    coupon: coupon || 'none',
    trialDays: trialDays || 'none',
    trialVariant: trialVariant || 'none',
    embedded: embedded || false,
    pricingVariant: pricingVariant || 'control'
  });

  if (!accessToken) {
    throw new Error('Not authenticated');
  }

  const requestBody: { 
    priceId: string; 
    coupon?: string; 
    trialDays?: number; 
    trialVariant?: string;
    embedded?: boolean;
    pricingVariant?: string;
  } = {
    priceId: priceId,
  };
  
  // Add coupon if provided
  if (coupon) {
    requestBody.coupon = coupon;
  }
  
  // Add trial days if provided
  if (trialDays && trialDays > 0) {
    requestBody.trialDays = trialDays;
    if (trialVariant) {
      requestBody.trialVariant = trialVariant;
    }
  }

  // Add embedded flag if provided
  if (embedded) {
    requestBody.embedded = embedded;
  }

  // Add pricing variant for A/B testing
  if (pricingVariant) {
    requestBody.pricingVariant = pricingVariant;
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
  console.log('createCheckoutSession: Success', { 
    hasUrl: !!data.url, 
    hasClientSecret: !!data.clientSecret 
  });
  
  return {
    url: data.url,
    clientSecret: data.clientSecret
  };
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
 * Uses Supabase Edge Function to avoid CORS issues and protect API keys
 */
export async function getConversationSuggestions(params: {
  transcript: TranscriptMessage[];
  vocabularyWords?: string[];
}): Promise<string[]> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session');
    }

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-conversation-suggestions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          transcript: params.transcript,
          vocabularyWords: params.vocabularyWords || [],
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Failed to get suggestions: ${response.status}`);
    }

    const data = await response.json();
    return data.suggestions || [];
  } catch (error) {
    console.error('Error getting conversation suggestions:', error);
    throw new Error(`Failed to get suggestions: ${error}`);
  }
}

