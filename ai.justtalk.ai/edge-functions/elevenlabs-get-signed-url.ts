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

    // Get request body (conversation_id, scenario, voiceId, voiceName, agentId, and dynamicVariables are optional)
    const body = await req.json().catch(() => ({}))
    console.log('Request body:', body)
    console.log('body.voiceId:', body.voiceId)
    console.log('body.voiceName:', body.voiceName)
    console.log('body.agentId:', body.agentId)
    console.log('body.dynamicVariables:', body.dynamicVariables)

    // Use provided agentId or fall back to default from ELEVENLABS_AGENT_ID secret
    const agentId = body.agentId || defaultAgentId
    
    if (!agentId) {
      throw new Error('No agent ID provided and ELEVENLABS_AGENT_ID is not set')
    }

    console.log('Using agent ID:', agentId, body.agentId ? '(from request)' : '(from default ELEVENLABS_AGENT_ID)')

    // Build URL with agent_id
    const url = new URL(`https://api.elevenlabs.io/v1/convai/conversation/get_signed_url`)
    url.searchParams.append('agent_id', agentId)

    // Build conversation config override with voice and dynamic variables
    const configOverride: any = {}
    
    // Add voice override if provided
    if (body.voiceId) {
      configOverride.tts = {
        voice_id: body.voiceId,
      }
      console.log('Adding voice override:', body.voiceId)
    }
    
    // Add dynamic variables if provided (context from previous step)
    if (body.dynamicVariables) {
      // ElevenLabs expects dynamic variable values to be plain strings.
      // If a JSON/object was passed, convert values to strings (JSON.stringify for objects).
      const dv = body.dynamicVariables;
      let normalized: Record<string, string> | string;

      if (typeof dv === 'string') {
        // If a single string was passed, use it directly (legacy/simple case)
        normalized = dv;
      } else if (typeof dv === 'object' && dv !== null) {
        normalized = Object.keys(dv).reduce((acc: Record<string, string>, key: string) => {
          const val = dv[key];
          if (val === null || val === undefined) {
            acc[key] = '';
          } else if (typeof val === 'string') {
            acc[key] = val;
          } else if (typeof val === 'object') {
            try {
              acc[key] = JSON.stringify(val);
            } catch (e) {
              acc[key] = String(val);
            }
          } else {
            acc[key] = String(val);
          }
          return acc;
        }, {} as Record<string, string>);
      } else {
        // Fallback: stringify anything else
        normalized = String(dv);
      }

      configOverride.agent = {
        prompt: {
          dynamic_variables: normalized,
        },
      };
      console.log('Adding dynamic variables (normalized):', normalized);
    }
    
    // Apply override if we have any configuration
    if (Object.keys(configOverride).length > 0) {
      url.searchParams.append('conversation_config_override', JSON.stringify(configOverride))
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
