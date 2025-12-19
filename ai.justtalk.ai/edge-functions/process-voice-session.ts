// Edge Function: process-voice-session
// Deploy this to your main Supabase repo at: supabase/functions/process-voice-session/index.ts
// 
// Purpose: Post-process voice chat session after it ends
// - Fetch transcript and analysis from ElevenLabs
// - Save messages to justai_messages
// - Update voice session with character count and costs
// - Create vocabulary evidence for student's words
// - Mark session as processed
// 
// Required Secrets (set in Supabase Dashboard):
// - ELEVENLABS_API_KEY

/// <reference types="https://deno.land/x/types/index.d.ts" />

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

// Helper function to remove voice tags like <Naomi>...</Naomi> from ElevenLabs transcripts
function stripVoiceTags(text: string): string {
  // Remove XML-style voice tags used by ElevenLabs multi-voice feature
  return text.replace(/<[^>]+>/g, '')
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const apiKey = Deno.env.get('ELEVENLABS_API_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    if (!apiKey) {
      throw new Error('ELEVENLABS_API_KEY is not set')
    }

    // Initialize Supabase client with service role key for admin access
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get voice session ID from request body
    const { voiceSessionId } = await req.json()

    if (!voiceSessionId) {
      return new Response(
        JSON.stringify({ error: 'voiceSessionId is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Get voice session data
    const { data: voiceSession, error: sessionError } = await supabase
      .from('justai_voice_sessions')
      .select('*, justai_conversations(*)')
      .eq('id', voiceSessionId)
      .single()

    if (sessionError || !voiceSession) {
      throw new Error(`Voice session not found: ${sessionError?.message}`)
    }

    if (!voiceSession.elevenlabs_conversation_id) {
      throw new Error('No ElevenLabs conversation ID found in voice session')
    }

    // Wait a few seconds for ElevenLabs to process the conversation
    // Conversations may not be immediately available after ending
    console.log('Waiting 5 seconds for ElevenLabs to process conversation...')
    await new Promise(resolve => setTimeout(resolve, 5000))

    // Fetch conversation details from ElevenLabs
    console.log(`Fetching ElevenLabs conversation: ${voiceSession.elevenlabs_conversation_id}`)
    const elevenLabsResponse = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${voiceSession.elevenlabs_conversation_id}`,
      {
        method: 'GET',
        headers: {
          'xi-api-key': apiKey,
        },
      }
    )

    if (!elevenLabsResponse.ok) {
      const errorText = await elevenLabsResponse.text()
      
      // If conversation not found, it might need more time
      if (elevenLabsResponse.status === 404) {
        console.warn('Conversation not found yet, may need more time to process')
        throw new Error(`Conversation not ready yet (404). Try again in a few minutes. ID: ${voiceSession.elevenlabs_conversation_id}`)
      }
      
      throw new Error(`ElevenLabs API error: ${elevenLabsResponse.status} - ${errorText}`)
    }

    const elevenLabsData = await elevenLabsResponse.json()
    console.log('ElevenLabs conversation data:', JSON.stringify(elevenLabsData, null, 2))

    // Extract dynamic variables from analysis for next conversation
    const analysis = elevenLabsData.analysis || {}
    const dynamicVariables = {
      conversation_summary: analysis.conversation_summary || null,
      emotional_notes: analysis.emotional_notes || null,
      open_threads: analysis.open_threads || null,
      unlock_next_scenario: analysis.unlock_next_scenario || false,
      extracted_at: new Date().toISOString(),
    }
    console.log('Extracted dynamic variables:', dynamicVariables)

    // Extract metadata for costs and usage
    const metadata = elevenLabsData.metadata || {}
    const charging = metadata.charging || {}
    
    // ElevenLabs provides exact costs in metadata.charging
    const totalCost = metadata.cost || 0  // Total cost in credits
    const callCharge = charging.call_charge || 0  // TTS credits
    const llmCharge = charging.llm_charge || 0  // LLM credits
    const llmPrice = charging.llm_price || 0  // LLM price in dollars
    
    // Extract timing information
    const callDurationSecs = metadata.call_duration_secs || 0
    
    // Calculate speaking times from transcript
    // Each entry has time_in_call_secs indicating when that turn started
    const transcript = elevenLabsData.transcript || []
    let userSpeakingTimeSecs = 0
    let agentSpeakingTimeSecs = 0
    
    for (let i = 0; i < transcript.length; i++) {
      const entry = transcript[i]
      const nextEntry = transcript[i + 1]
      const startTime = entry.time_in_call_secs || 0
      const endTime = nextEntry ? nextEntry.time_in_call_secs : callDurationSecs
      const duration = Math.max(0, endTime - startTime)
      
      if (entry.role === 'user') {
        userSpeakingTimeSecs += duration
      } else if (entry.role === 'agent') {
        agentSpeakingTimeSecs += duration
      }
    }
    
    console.log(`Speaking times - User: ${userSpeakingTimeSecs}s, Agent: ${agentSpeakingTimeSecs}s`)

    // Extract transcript messages
    let totalCharacters = 0
    const messagesToInsert = []

    for (const entry of transcript) {
      // entry.role: "user" or "agent"
      // entry.message: the text content
      const role = entry.role === 'user' ? 'user' : 'assistant'
      // Remove voice tags like <Naomi>...</Naomi> from the message
      const content = stripVoiceTags(entry.message || '')
      
      if (content) {
        messagesToInsert.push({
          conversation_id: voiceSession.conversation_id,
          role,
          content,
          is_voice_message: true,
          created_at: entry.timestamp || new Date().toISOString(),
        })

        // Count characters for reference
        if (role === 'assistant') {
          totalCharacters += content.length
        }
      }
    }

    // Insert messages in bulk
    if (messagesToInsert.length > 0) {
      const { error: messagesError } = await supabase
        .from('justai_messages')
        .insert(messagesToInsert)

      if (messagesError) {
        console.error('Error inserting messages:', messagesError)
        throw messagesError
      }

      console.log(`Inserted ${messagesToInsert.length} messages`)
    }

    // Create AI lesson for this voice session
    const lessonStartTime = new Date(voiceSession.started_at)
    const lessonEndTime = new Date(voiceSession.ended_at || new Date())
    
    // Fixed UUID for JustTalk AI Teacher profile
    const AI_TEACHER_ID = '00000000-0000-0000-0000-000000000001'
    
    // Round times to satisfy constraint: minutes must be 00 or 30
    const roundToHalfHour = (date: Date) => {
      const rounded = new Date(date)
      const minutes = rounded.getMinutes()
      if (minutes < 15) {
        rounded.setMinutes(0, 0, 0)
      } else if (minutes < 45) {
        rounded.setMinutes(30, 0, 0)
      } else {
        rounded.setMinutes(0, 0, 0)
        rounded.setHours(rounded.getHours() + 1)
      }
      return rounded
    }
    
    const roundedStartTime = roundToHalfHour(lessonStartTime)
    let roundedEndTime = roundToHalfHour(lessonEndTime)
    
    // Ensure end time is after start time (constraint: ends_at > starts_at)
    if (roundedEndTime <= roundedStartTime) {
      // Add 30 minutes to ensure valid duration
      roundedEndTime = new Date(roundedStartTime.getTime() + 30 * 60 * 1000)
    }
    
    const { data: lessonData, error: lessonError } = await supabase
      .from('lessons')
      .insert({
        teacher_id: AI_TEACHER_ID, // Use JustTalk AI Teacher profile
        student_id: voiceSession.student_id,
        starts_at: roundedStartTime.toISOString(),
        ends_at: roundedEndTime.toISOString(),
        title: `AI Voice Session - ${lessonStartTime.toLocaleDateString()}`,
        status: 'completed',
        is_ai_session: true,
      })
      .select()
      .single()

    if (lessonError) {
      console.error('Error creating lesson:', lessonError)
      throw lessonError
    }

    console.log(`Created AI lesson: ${lessonData.id}`)

    // Create lesson transcription segments for each message
    const segmentsToInsert = []

    for (const entry of transcript) {
      const role = entry.role === 'user' ? 'student' : 'teacher' // Map to lesson speaker roles
      // Remove voice tags like <Naomi>...</Naomi> from the transcript
      const content = stripVoiceTags(entry.message || '')
      const timeInCall = entry.time_in_call_secs || 0
      
      if (content) {
        // Calculate segment timestamps based on time_in_call_secs
        const segmentStartTime = new Date(lessonStartTime.getTime() + (timeInCall * 1000))
        // Estimate end time (use next entry's time or add 5 seconds)
        const nextEntry = transcript[transcript.indexOf(entry) + 1]
        const nextTime = nextEntry ? nextEntry.time_in_call_secs : timeInCall + 5
        const segmentEndTime = new Date(lessonStartTime.getTime() + (nextTime * 1000))
        
        // Use appropriate speaker_id based on role
        // For student messages: use actual student_id
        // For teacher messages: use teacher_id from lesson (currently same as student for AI sessions)
        const speakerId = role === 'student' ? voiceSession.student_id : lessonData.teacher_id
        
        segmentsToInsert.push({
          lesson_id: lessonData.id,
          speaker_id: speakerId,
          speaker_role: role,
          start_time: segmentStartTime.toISOString(),
          end_time: segmentEndTime.toISOString(),
          transcript: content,
          formatted_text: content, // Store same text for vocabulary processing
          final_sentence_transcription: true,
        })
      }
    }

    // Insert segments in bulk
    let studentSegmentIds: string[] = []
    if (segmentsToInsert.length > 0) {
      const { data: insertedSegments, error: segmentsError } = await supabase
        .from('lesson_transcription_segments')
        .insert(segmentsToInsert)
        .select()

      if (segmentsError) {
        console.error('Error inserting lesson segments:', segmentsError)
        throw segmentsError
      }

      console.log(`Inserted ${segmentsToInsert.length} lesson transcription segments`)

      // Collect student segment IDs for client-side vocabulary processing
      const studentSegments = insertedSegments.filter((seg: any) => seg.speaker_role === 'student')
      studentSegmentIds = studentSegments.map((seg: any) => seg.id)
      
      console.log(`Created ${studentSegmentIds.length} student segments for vocabulary processing`)
    }

    // Convert ElevenLabs credits to cost in cents
    // totalCost is already in credits from ElevenLabs
    // Pricing varies by plan, estimate: 1000 credits ≈ $0.30
    const costPerThousandCredits = 30 // cents
    const totalCostCents = Math.ceil((totalCost / 1000) * costPerThousandCredits)

    // Update voice session with processing results
    const { error: updateError } = await supabase
      .from('justai_voice_sessions')
      .update({
        virtual_lesson_id: lessonData.id,
        elevenlabs_character_count: totalCharacters,
        elevenlabs_cost_cents: totalCostCents,
        elevenlabs_credits_used: totalCost,
        elevenlabs_tts_credits: callCharge,
        elevenlabs_llm_credits: llmCharge,
        student_speaking_time_seconds: userSpeakingTimeSecs,
        ai_speaking_time_seconds: agentSpeakingTimeSecs,
        total_duration_seconds: callDurationSecs || voiceSession.total_duration_seconds,
        transcription_complete: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', voiceSessionId)

    if (updateError) {
      console.error('Error updating voice session:', updateError)
      throw updateError
    }

    console.log('Voice session processing complete')

    // Save dynamic variables to conversation for context continuity
    if (Object.values(dynamicVariables).some(v => v !== null && v !== false)) {
      const { error: conversationUpdateError } = await supabase
        .from('justai_conversations')
        .update({
          session_memory: dynamicVariables,
          updated_at: new Date().toISOString(),
        })
        .eq('id', voiceSession.conversation_id)

      if (conversationUpdateError) {
        console.error('Error saving dynamic variables:', conversationUpdateError)
      } else {
        console.log('Dynamic variables saved to conversation session_memory')
      }
    }

    // Update student progress if this was a roleplay with an agent
    const conversation = voiceSession.justai_conversations
    if (conversation && conversation.agent_id) {
      console.log(`Updating student progress for agent: ${conversation.agent_id}`)
      
      const messageCount = messagesToInsert.filter(m => m.role === 'user').length
      const durationSeconds = callDurationSecs || voiceSession.total_duration_seconds || 0
      
      try {
        // Use the database function to update progress
        const { error: progressError } = await supabase.rpc('update_student_progress', {
          p_student_id: conversation.student_id,
          p_agent_id: conversation.agent_id,
          p_messages_sent: messageCount,
          p_time_spent_seconds: durationSeconds,
          p_conversation_id: conversation.id,
        })
        
        if (progressError) {
          console.error('Error updating student progress:', progressError)
          // Don't throw - progress update is non-critical
        } else {
          console.log('Student progress updated successfully')
          
          // Check if this completes a step based on ElevenLabs analysis
          // Step is completed when unlock_next_scenario is true (quality-based completion)
          if (dynamicVariables.unlock_next_scenario === true) {
            console.log('Step completion criteria met: unlock_next_scenario=true')
            
            // Mark step as completed
            const { error: completeError } = await supabase
              .from('justai_student_progress')
              .update({
                status: 'completed',
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('student_id', conversation.student_id)
              .eq('agent_id', conversation.agent_id)
              .neq('status', 'completed') // Only update if not already completed
            
            if (completeError) {
              console.error('Error marking step completed:', completeError)
            } else {
              console.log('Step marked as completed')
              
              // Try to unlock next step
              const { error: unlockError } = await supabase.rpc('check_unlock_next_step', {
                p_student_id: conversation.student_id,
                p_current_agent_id: conversation.agent_id,
              })
              
              if (unlockError) {
                console.error('Error checking unlock next step:', unlockError)
              } else {
                console.log('Checked for next step unlock')
              }
            }
          }
        }
      } catch (error) {
        console.error('Error in progress tracking:', error)
        // Don't fail the whole request
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        voiceSessionId,
        lessonId: lessonData.id,
        studentSegmentIds: studentSegmentIds || [],
        messagesProcessed: messagesToInsert.length,
        totalCharacters,
        costCents: totalCostCents,
        credits: {
          total: totalCost,
          tts: callCharge,
          llm: llmCharge,
        },
        llmPrice,
        duration: {
          total: callDurationSecs,
          userSpeaking: userSpeakingTimeSecs,
          agentSpeaking: agentSpeakingTimeSecs,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error processing voice session:', error)
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
