// Edge Function: elevenlabs-get-voices
// Deploy this to your main Supabase repo at: supabase/functions/elevenlabs-get-voices/index.ts
// 
// Purpose: Get voices configured in the ElevenLabs agent (Eric, Brian, etc.)
// 
// Required Secrets (set in Supabase Dashboard):
// - ELEVENLABS_API_KEY
// - ELEVENLABS_AGENT_ID

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

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
    const agentId = Deno.env.get('ELEVENLABS_AGENT_ID')

    if (!apiKey || !agentId) {
      throw new Error('ELEVENLABS_API_KEY or ELEVENLABS_AGENT_ID is not set')
    }

    // Fetch the agent configuration
    const agentResponse = await fetch(
      `https://api.elevenlabs.io/v1/convai/agents/${agentId}`,
      {
        method: 'GET',
        headers: {
          'xi-api-key': apiKey,
        },
      }
    )

    if (!agentResponse.ok) {
      const errorText = await agentResponse.text()
      console.error('Agent API error:', errorText)
      throw new Error(`Failed to get agent: ${agentResponse.status}`)
    }

    const agentData = await agentResponse.json()
    console.log('Agent data structure:', JSON.stringify(agentData, null, 2))

    // Extract voices from the agent configuration
    // Primary voice from tts.voice_id
    const primaryVoiceId = agentData.conversation_config?.tts?.voice_id
    
    // Additional voices from tts.supported_voices
    const supportedVoices = agentData.conversation_config?.tts?.supported_voices || []

    if (!primaryVoiceId && supportedVoices.length === 0) {
      throw new Error('No voices found in agent configuration')
    }

    // Collect all voice IDs (primary + supported)
    const allVoiceIds = [primaryVoiceId, ...supportedVoices.map((v: any) => v.voice_id)].filter(Boolean)
    
    // Fetch details for all voices from ElevenLabs API
    const voicesWithDetails = await Promise.all(
      allVoiceIds.map(async (voiceId: string, index: number) => {
        try {
          const voiceResponse = await fetch(
            `https://api.elevenlabs.io/v1/voices/${voiceId}`,
            {
              method: 'GET',
              headers: {
                'xi-api-key': apiKey,
              },
            }
          )

          if (!voiceResponse.ok) {
            console.error(`Failed to fetch voice ${voiceId}`)
            return null
          }

          const voiceData = await voiceResponse.json()
          
          return {
            voice_id: voiceData.voice_id,
            name: voiceData.name,
            category: voiceData.category,
            labels: voiceData.labels,
            preview_url: voiceData.preview_url,
            is_primary: index === 0, // First voice (primary) is marked
          }
        } catch (error) {
          console.error(`Error fetching voice ${voiceId}:`, error)
          return null
        }
      })
    )

    // Filter out any failed voice fetches
    const validVoices = voicesWithDetails.filter(v => v !== null)

    // Return the configured voices from the agent
    return new Response(
      JSON.stringify({
        voices: validVoices,
        agent_id: agentId,
        total: validVoices.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error fetching agent voices:', error)
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        voices: []
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
