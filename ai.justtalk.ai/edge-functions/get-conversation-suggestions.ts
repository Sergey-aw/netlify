// Edge Function: get-conversation-suggestions
// Purpose: Get AI suggestions for conversation responses using OpenAI
// This runs server-side to avoid CORS issues and protect API keys

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TranscriptMessage {
  speaker: string;
  text: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
      throw new Error('OPENAI_API_KEY is not configured')
    }

    // Get authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    // Initialize Supabase client to verify user
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    // Parse request body
    const { transcript, vocabularyWords } = await req.json()

    if (!transcript || !Array.isArray(transcript)) {
      throw new Error('Invalid transcript data')
    }

    // Get the last 1-2 minutes of conversation (approximately last 6-10 messages)
    const recentTranscript = transcript.slice(-10)
    const transcriptText = recentTranscript
      .map((m: TranscriptMessage) => `${m.speaker === 'student' ? 'Student' : 'AI'}: ${m.text}`)
      .join('\n')

    const vocabularyList = vocabularyWords && vocabularyWords.length > 0 
      ? `\nVocabulary words the student is practicing: ${vocabularyWords.join(', ')}`
      : ''

    const prompt = `You are a speaking assistant for a language learner.
Your task is to help the student continue the conversation naturally when they get stuck.

You will receive:

1. A recent transcript excerpt (approximately the last 1–2 minutes of conversation).
2. A list of vocabulary words the student is trying to practice.

Your output:

- Produce exactly 2 or 3 natural ONE-SENTENCE responses the student could realistically say next.
- Each suggestion must be a SINGLE, complete sentence.
- The sentences must fit the conversational context and topic.
- If it feels natural, incorporate one or more of the target vocabulary words.
- Do NOT force vocabulary usage. Naturalness is more important than coverage.
- Do NOT ask questions unless questions clearly fit the flow of the conversation.
- Avoid teacher-like language, meta commentary, or unnatural phrasing.
- Keep sentences concise, spoken, and human.

Recent transcript:
${transcriptText}${vocabularyList}

Return your response as a JSON object with this exact structure:
{
  "suggestions": ["sentence 1", "sentence 2", "sentence 3"]
}`

    // Call OpenAI API with JSON mode
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
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 250,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('OpenAI API error:', error)
      throw new Error(`Failed to get suggestions from OpenAI: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content || '{}'
    
    // Parse JSON response
    let suggestions: string[] = []
    try {
      const parsed = JSON.parse(content)
      suggestions = parsed.suggestions || []
      // Ensure we have 2-3 suggestions
      suggestions = suggestions.slice(0, 3)
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', parseError)
      // Fallback to empty array
      suggestions = []
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        suggestions 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Error getting conversation suggestions:', error)
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
