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

    if (!apiKey) {
      throw new Error('ELEVENLABS_API_KEY is not set')
    }

    // Fetch voices from the "Agents Voices" collection
    const voicesResponse = await fetch(
      `https://api.elevenlabs.io/v2/voices?collection_id=4844zEjQaj8zg0a0JKrm&page_size=100`,
      {
        method: 'GET',
        headers: {
          'xi-api-key': apiKey,
        },
      }
    )

    if (!voicesResponse.ok) {
      const errorText = await voicesResponse.text()
      console.error('Voices API error:', errorText)
      throw new Error(`Failed to get voices: ${voicesResponse.status}`)
    }

    const voicesData = await voicesResponse.json()
    console.log('Voices data:', JSON.stringify(voicesData, null, 2))

    // Extract relevant voice information
    const voices = voicesData.voices.map((voice: any) => ({
      voice_id: voice.voice_id,
      name: voice.name,
      category: voice.category,
      labels: voice.labels,
      preview_url: voice.preview_url,
      description: voice.description,
    }))

    // Return the voices from the account
    return new Response(
      JSON.stringify({
        voices: voices,
        total: voices.length,
        has_more: voicesData.has_more,
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
