// Edge Function: analyze-conversation-feedback
// Purpose: Analyze voice conversation and generate comprehensive feedback
// Including: conversation snapshot, vocabulary goals used, suggestions, and LLM feedback

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ConversationMessage {
  role: string;
  message: string;
  time_in_call_secs: number;
}

interface ConversationMetadata {
  start_time_unix_secs: number;
  call_duration_secs: number;
  agent_id: string;
}

interface ElevenLabsConversation {
  conversation_id: string;
  transcript: ConversationMessage[];
  metadata: ConversationMetadata;
  status: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { conversationId, elevenLabsConvId, studentId } = await req.json()

    if (!conversationId || !elevenLabsConvId || !studentId) {
      return new Response(
        JSON.stringify({ error: 'conversationId, elevenLabsConvId, and studentId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch conversation from ElevenLabs
    const elevenLabsKey = Deno.env.get('ELEVENLABS_API_KEY')
    const elevenLabsResponse = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${elevenLabsConvId}`,
      {
        method: 'GET',
        headers: { 'xi-api-key': elevenLabsKey! },
      }
    )

    if (!elevenLabsResponse.ok) {
      throw new Error(`ElevenLabs API error: ${elevenLabsResponse.status}`)
    }

    const elevenLabsConv: ElevenLabsConversation = await elevenLabsResponse.json()
    
    console.log('📊 ElevenLabs conversation data:', {
      conversationId: elevenLabsConv.conversation_id,
      status: elevenLabsConv.status,
      transcriptLength: elevenLabsConv.transcript?.length || 0,
      duration: elevenLabsConv.metadata?.call_duration_secs,
      hasTranscript: !!elevenLabsConv.transcript,
    })
    
    // Check if conversation is still processing
    if (elevenLabsConv.status === 'processing' || elevenLabsConv.status === 'in-progress') {
      console.warn('⚠️ Conversation still processing, transcript may be incomplete')
    }

    // Calculate snapshot metrics
    const studentMessages = elevenLabsConv.transcript?.filter(m => m.role === 'user') || []
    const aiMessages = elevenLabsConv.transcript?.filter(m => m.role === 'agent') || []
    
    console.log('💬 Message counts:', {
      studentMessages: studentMessages.length,
      aiMessages: aiMessages.length,
    })
    
    const studentWords = studentMessages.reduce((sum, m) => sum + (m.message?.split(/\s+/).length || 0), 0)
    const aiWords = aiMessages.reduce((sum, m) => sum + (m.message?.split(/\s+/).length || 0), 0)

    const snapshot = {
      duration: Math.round(elevenLabsConv.metadata?.call_duration_secs || 0),
      turns: elevenLabsConv.transcript?.length || 0,
      words: studentWords + aiWords,
      studentWords,
      aiWords,
    }
    
    console.log('📸 Snapshot:', snapshot)

    // Fetch student's active vocabulary goals
    const { data: vocabularyGoals } = await supabaseClient.rpc('get_active_vocabulary_goals', {
      p_student_id: studentId
    })

    // Analyze which vocabulary goals were used
    const vocabularyGoalsUsed = []
    if (vocabularyGoals && vocabularyGoals.length > 0) {
      const studentText = studentMessages.map(m => m.message).join(' ').toLowerCase()
      
      for (const goal of vocabularyGoals) {
        const lemma = goal.lemma.toLowerCase()
        if (studentText.includes(lemma)) {
          // Find the context where it was used
          const contextMessage = studentMessages.find(m => 
            m.message.toLowerCase().includes(lemma)
          )
          
          vocabularyGoalsUsed.push({
            lemma: goal.lemma,
            pos: goal.pos || 'unknown',
            usedCorrectly: true, // Could enhance with grammar check
            context: contextMessage?.message.substring(0, 100) || '',
            note: 'Great job using this word!',
          })
        }
      }
    }

    // Generate LLM-based feedback using OpenAI
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    let llmFeedback = null

    if (openaiKey && studentMessages.length > 0) {
      const conversationContext = elevenLabsConv.transcript
        .map(m => `${m.role === 'user' ? 'Student' : 'AI'}: ${m.message}`)
        .join('\n')

      const prompt = `You are an English language teacher analyzing a student's conversation practice. 

Conversation transcript:
${conversationContext}

Provide feedback in JSON format with:
1. scores: Array of {category, score, maxScore} - Rate the student on 3-4 relevant categories (e.g., "Clarity", "Grammar", "Vocabulary Range", "Fluency"). Use maxScore of 10.
2. advice: Array of {category, feedback} - Provide specific, encouraging advice for each scored category.

Focus on being constructive and motivating. Keep feedback concise and actionable.

Return only valid JSON, no markdown formatting.`

      try {
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'You are an expert English language teacher providing constructive feedback.' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 1000,
          }),
        })

        if (openaiResponse.ok) {
          const openaiData = await openaiResponse.json()
          const content = openaiData.choices[0]?.message?.content
          if (content) {
            // Try to parse JSON, handling potential markdown formatting
            const jsonMatch = content.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
              llmFeedback = JSON.parse(jsonMatch[0])
            }
          }
        }
      } catch (error) {
        console.error('Error generating LLM feedback:', error)
      }
    }

    // Generate vocabulary suggestions (words that would be useful)
    const vocabularySuggestions = []
    
    // This is a simplified version - could be enhanced with more sophisticated analysis
    if (studentMessages.length > 2) {
      // Check for overused words
      const wordFreq: Record<string, number> = {}
      const studentText = studentMessages.map(m => m.message).join(' ')
      const words = studentText.toLowerCase().match(/\b[a-z]{4,}\b/g) || []
      
      words.forEach(word => {
        wordFreq[word] = (wordFreq[word] || 0) + 1
      })

      // Find overused words (appeared more than 3 times)
      const overused = Object.entries(wordFreq)
        .filter(([_, count]) => count > 3)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)

      // Suggest synonyms for overused words
      const synonymMap: Record<string, string[]> = {
        'good': ['excellent', 'great', 'wonderful', 'fantastic'],
        'very': ['extremely', 'incredibly', 'remarkably'],
        'thing': ['aspect', 'element', 'matter', 'item'],
        'get': ['obtain', 'acquire', 'receive', 'gain'],
        'make': ['create', 'produce', 'construct', 'build'],
      }

      for (const [word, count] of overused) {
        const synonyms = synonymMap[word]
        if (synonyms && synonyms.length > 0) {
          vocabularySuggestions.push({
            lemma: synonyms[0],
            pos: 'verb',
            reason: 'synonym',
            overusedWord: word,
            context: `Try using "${synonyms[0]}" instead of "${word}"`,
          })
        }
      }
    }

    const feedbackData = {
      snapshot,
      vocabularyGoals: vocabularyGoalsUsed.length > 0 ? vocabularyGoalsUsed : undefined,
      vocabularySuggestions: vocabularySuggestions.length > 0 ? vocabularySuggestions : undefined,
      llmFeedback,
    }

    return new Response(
      JSON.stringify({ success: true, feedback: feedbackData }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error analyzing conversation feedback:', error)
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
