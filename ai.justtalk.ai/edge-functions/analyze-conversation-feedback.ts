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

    // Fetch agent to check recommended duration
    const { data: conversationData } = await supabaseClient
      .from('justai_conversations')
      .select('agent_id')
      .eq('id', conversationId)
      .single()
    
    let recommendedDuration = 60 // Default 60 seconds
    
    if (conversationData?.agent_id) {
      const { data: agentData } = await supabaseClient
        .from('justai_agents')
        .select('recommended_duration_seconds')
        .eq('id', conversationData.agent_id)
        .single()
      
      if (agentData?.recommended_duration_seconds) {
        recommendedDuration = agentData.recommended_duration_seconds
      }
    }
    
    console.log('⏱️ Duration check:', {
      actualDuration: snapshot.duration,
      recommendedDuration,
      meetsRequirement: snapshot.duration >= recommendedDuration
    })
    
    // If conversation is too short, return early with a prompt to continue
    if (snapshot.duration < recommendedDuration) {
      const remainingSeconds = recommendedDuration - snapshot.duration
      console.log(`⚠️ Conversation too short (${snapshot.duration}s < ${recommendedDuration}s), skipping detailed feedback`)
      
      return new Response(
        JSON.stringify({
          success: true,
          feedback: {
            snapshot,
            tooShort: true,
            remainingSeconds,
            message: `Talk for ${Math.ceil(remainingSeconds)} more seconds to unlock detailed feedback`
          }
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Fetch student's active vocabulary goals
    const { data: vocabularyGoals } = await supabaseClient.rpc('get_active_lesson_goals', {
      student_uuid: studentId,
      lesson_uuid: null
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

    // Generate structured diagnostic feedback using OpenAI
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    let llmFeedback = null

    console.log('🤖 OpenAI Analysis:', {
      hasApiKey: !!openaiKey,
      studentMessagesCount: studentMessages.length,
      willAnalyze: !!(openaiKey && studentMessages.length > 0)
    })

    if (openaiKey && studentMessages.length > 0) {
      const conversationContext = elevenLabsConv.transcript
        .map(m => `${m.role === 'user' ? 'Student' : 'Teacher'}: ${m.message}`)
        .join('\n')

      const systemPrompt = `You are a spoken-language analysis engine.

Your task is to analyze a spoken English conversation transcript and produce a structured,
DIAGNOSTIC analysis of the STUDENT's language ONLY, written directly to the student.

The transcript contains turns labeled "Teacher" and "Student" (or "User").

SCOPE (NON-NEGOTIABLE):
- Analyze ONLY Student / User language.
- Ignore Teacher language entirely.
- All scores, mistakes, quotes, and evidence MUST come exclusively from Student turns.

IMPORTANT LIMITATION:
You ONLY see text (ASR output).
You must NOT reference pronunciation, accent, intonation, or sound-based qualities.
Do NOT mention accent or suggest pronunciation issues under any circumstance.

SPOKEN-LANGUAGE CONTEXT (NON-NEGOTIABLE):
This is SPOKEN English, not written English.

DO NOT treat the following as mistakes:
- Fillers ("uh", "like", "you know", "I mean")
- Hesitations or pauses
- False starts or abandoned sentences
- Self-corrections or reformulations
- Informal phrasing or contractions
- Stylistic awkwardness
- Transcription artifacts

Mistakes must reflect CLEAR grammatical or lexical incorrectness
in the student's FINAL intended meaning.

MISTAKE CONFIDENCE GATE (MOST IMPORTANT RULE):
Before extracting ANY mistake, ask:
"Would a fluent native speaker clearly judge this as incorrect English —
not merely informal, imprecise, or awkward?"

If the answer is not clearly YES → DO NOT extract the mistake.
When in doubt → extract nothing.

MISTAKE SELECTION PRINCIPLE:
- Extract ONLY high-value mistakes.
- Fewer is better than more.
- Extract at most 5 mistakes (often 0–3).
- Do NOT rephrase the same underlying error multiple times.

ALLOWED MISTAKE CATEGORIES (FIXED LIST):
articles, prepositions, pronouns, tense, nouns, word_order, word_form,
determiners, verb_form, verb_agreement, adjectives, adverbs, particles,
plurals, conjunctions, vocabulary, other

CORRECTION RULES:
- Corrections must be minimal and conservative.
- Preserve original meaning.
- Corrections must be appropriate for spoken English.
- Every correction must be a complete grammatical sentence structurally parallel to the original.

SCORING DIMENSIONS — Score 1–3

SCORING RIGOR (CRITICAL):
- Score = 3 is RARE.
- Most intermediate learners should score 2.
- Scores MUST be conservative and defensible.

HARD CAPS (NON-NEGOTIABLE):
- If speech shows frequent hesitation, reformulation, or circumlocution, CLARITY and FLOW CANNOT be 3.
- If student relies heavily on basic vocabulary or vague phrasing, RANGE CANNOT be 3.

1. CLARITY — How easy are you to understand?
   1 = Meaning is often unclear or hard to follow
   2 = Generally clear, with occasional confusion
   3 = Consistently precise and unambiguous (RARE)

2. RANGE — How much linguistic variety do you use?
   1 = Very limited structures and vocabulary
   2 = Some variety; mix of simple and more complex forms
   3 = Broad, flexible, and sophisticated range (RARE)

3. FLOW — How smoothly do your ideas connect?
   1 = Frequent breakdowns; communication often stalls
   2 = Some friction, but you keep communicating
   3 = Natural, smooth, well-connected speech (RARE)

OVERALL SCORE:
- Compute the rounded median of clarity, range, and flow.

SCORING JUSTIFICATION RULES:
- Write directly to the student ("You…").
- Be diagnostic, not flattering.
- Explicitly explain why a higher score was NOT given.
- Supporting quotes MUST be exact verbatim student utterances.

PATTERNS:
- List 1–3 clear recurring tendencies in student speech.
- Patterns must be observable and concrete.
- Avoid praise-only or vague statements.

VOCABULARY LEVEL:
Choose ONE: beginner | intermediate | upper-intermediate | advanced | native-like

STRICT GUIDELINES:
- If student frequently searches for words or relies on circumlocution, vocabulary_level CANNOT be "advanced".
- If unsure between two levels, choose the LOWER one.

FLUENCY NOTES:
- Brief observations about how student manages speech in real time.
- Do NOT repeat score justifications.
- Do NOT mention correctness or mistakes here.

OUTPUT FORMAT (ONLY VALID JSON):

{
  "scores": {
    "clarity": {
      "score": 1–3,
      "justification": "Student-facing diagnostic explanation",
      "supporting_quotes": ["Exact student quote", "Exact student quote"]
    },
    "range": {
      "score": 1–3,
      "justification": "Student-facing diagnostic explanation",
      "supporting_quotes": ["Exact student quote", "Exact student quote"]
    },
    "flow": {
      "score": 1–3,
      "justification": "Student-facing diagnostic explanation",
      "supporting_quotes": ["Exact student quote", "Exact student quote"]
    },
    "overall": 1–3
  },
  "mistakes": [
    {
      "category": "articles|prepositions|pronouns|tense|nouns|word_order|word_form|determiners|verb_form|verb_agreement|adjectives|adverbs|particles|plurals|conjunctions|vocabulary|other",
      "description": "short label for the error pattern",
      "quote": "exact verbatim student quote containing the error",
      "correction": "corrected full sentence",
      "explanation": "brief, clear explanation"
    }
  ],
  "patterns": [
    "observable recurring pattern written to the student"
  ],
  "vocabulary_level": "beginner|intermediate|upper-intermediate|advanced|native-like",
  "fluency_notes": [
    "brief student-facing fluency observation"
  ]
}

FINAL SELF-CHECK (MANDATORY):
- Did you avoid pronunciation and accent entirely?
- Are all scores conservative and capped correctly?
- Would this feedback help the student improve next time?

Respond ONLY with valid JSON.`

      const userPrompt = `Analyze this spoken English conversation transcript:

${conversationContext}

Provide structured diagnostic feedback following the exact JSON schema.`

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
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.3,
          }),
        })

        if (openaiResponse.ok) {
          const openaiData = await openaiResponse.json()
          const content = openaiData.choices[0]?.message?.content
          if (content) {
            try {
              llmFeedback = JSON.parse(content)
              console.log('📊 Parsed feedback structure:', {
                hasScores: !!llmFeedback.scores,
                mistakesCount: llmFeedback.mistakes?.length || 0,
                patternsCount: llmFeedback.patterns?.length || 0,
                vocabularyLevel: llmFeedback.vocabulary_level,
                fluencyNotesCount: llmFeedback.fluency_notes?.length || 0
              })
              
              // Combine LLM feedback with vocabulary goals
              const combinedFeedback = {
                ...llmFeedback,
                vocabularyGoals: vocabularyGoalsUsed.length > 0 ? vocabularyGoalsUsed : undefined
              }
              
              // Save to database
              console.log('💾 Attempting to save feedback to database:', {
                conversationId,
                hasScores: !!llmFeedback.scores,
                overallScore: llmFeedback.scores?.overall,
                vocabularyGoalsCount: vocabularyGoalsUsed.length
              })
              
              const { data: updateData, error: updateError } = await supabaseClient
                .from('justai_conversations')
                .update({
                  language_feedback: combinedFeedback,
                  conversation_score: llmFeedback.scores?.overall || null,
                  score_calculated_at: new Date().toISOString()
                })
                .eq('id', conversationId)
                .select()
              
              if (updateError) {
                console.error('❌ Error saving feedback to database:', {
                  error: updateError,
                  message: updateError.message,
                  details: updateError.details,
                  hint: updateError.hint
                })
              } else {
                console.log('✅ Feedback saved to database successfully:', {
                  conversationId,
                  rowsUpdated: updateData?.length || 0
                })
              }
            } catch (parseError) {
              console.error('Error parsing feedback JSON:', parseError)
            }
          }
        } else {
          const errorBody = await openaiResponse.text()
          console.error('❌ OpenAI API error:', {
            status: openaiResponse.status,
            statusText: openaiResponse.statusText,
            body: errorBody
          })
        }
      } catch (error) {
        console.error('❌ Error generating LLM feedback:', error)
      }
    } else {
      if (!openaiKey) {
        console.warn('⚠️ OPENAI_API_KEY not set, skipping LLM feedback')
      }
      if (studentMessages.length === 0) {
        console.warn('⚠️ No student messages found, skipping LLM feedback')
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
