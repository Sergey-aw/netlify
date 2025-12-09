// Edge Function: elevenlabs-get-signed-url
// Deploy this to your main Supabase repo at: supabase/functions/elevenlabs-get-signed-url/index.ts
// 
// Purpose: Get a signed WebSocket URL for ElevenLabs Conversational AI
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
    const defaultAgentId = Deno.env.get('ELEVENLABS_AGENT_ID')

    if (!apiKey) {
      throw new Error('ELEVENLABS_API_KEY is not set')
    }

    // Get request body (conversation_id, scenario, voiceId, voiceName, and agentId are optional)
    const body = await req.json().catch(() => ({}))
    console.log('Request body:', body)
    console.log('body.voiceId:', body.voiceId)
    console.log('body.voiceName:', body.voiceName)
    console.log('body.agentId:', body.agentId)

    // Use provided agentId or fall back to default from ELEVENLABS_AGENT_ID secret
    const agentId = body.agentId || defaultAgentId
    
    if (!agentId) {
      throw new Error('No agent ID provided and ELEVENLABS_AGENT_ID is not set')
    }

    console.log('Using agent ID:', agentId, body.agentId ? '(from request)' : '(from default ELEVENLABS_AGENT_ID)')

    // Build URL with agent_id
    const url = new URL(`https://api.elevenlabs.io/v1/convai/conversation/get_signed_url`)
    url.searchParams.append('agent_id', agentId)

    // If voiceId is provided, override the agent's voice configuration
    if (body.voiceId) {
      const override = JSON.stringify({
        tts: {
          voice_id: body.voiceId,
        },
      })
      url.searchParams.append('conversation_config_override', override)
      console.log('Adding voice override:', body.voiceId)
    }

    // Create signed URL for WebSocket connection (GET request)
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()

    // Return signed URL
    return new Response(
      JSON.stringify({
        signed_url: data.signed_url,
        system_prompt: body.scenario || 'conversation',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error getting signed URL:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
