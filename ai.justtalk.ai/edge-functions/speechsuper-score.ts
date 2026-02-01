/**
 * SpeechSuper Pronunciation Score Edge Function
 * Handles pronunciation assessment for onboarding flow
 * Uses SpeechSuper sent.eval.promax API
 * 
 * Based on working implementation from pronunciation-submit-sentence-practice
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { crypto } from 'jsr:@std/crypto@1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SPEECHSUPER_API_URL = 'https://api.speechsuper.com/sent.eval.promax';
const SPEECHSUPER_APP_KEY = Deno.env.get('SPEECHSUPER_APP_KEY') || '';
const SPEECHSUPER_SECRET_KEY = Deno.env.get('SPEECHSUPER_SECRET_KEY') || '';

// Locked provider parameters
const DICT_TYPE = 'IPA88';
const DICT_DIALECT = 'en_us';

/**
 * Generate SHA-1 signature for SpeechSuper API authentication
 */
async function sha1HexLower(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').toLowerCase();
}

async function generateConnectSig(appKey: string, secretKey: string, timestamp: number): Promise<string> {
  return sha1HexLower(`${appKey}${timestamp}${secretKey}`);
}

async function generateStartSig(appKey: string, secretKey: string, timestamp: number, userId: string): Promise<string> {
  return sha1HexLower(`${appKey}${timestamp}${userId}${secretKey}`);
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate credentials
    if (!SPEECHSUPER_APP_KEY || !SPEECHSUPER_SECRET_KEY) {
      return new Response(
        JSON.stringify({ error: 'SpeechSuper credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Parse multipart form data
    const formData = await req.formData();
    const text = formData.get('text') as string;
    const audioFile = formData.get('user_audio_file') as File;

    if (!text || !audioFile) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: text and user_audio_file' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log audio file details for debugging
    console.log('Received audio file:', {
      name: audioFile.name,
      type: audioFile.type,
      size: audioFile.size,
    });

    // Validate WAV format
    const buffer = await audioFile.arrayBuffer();
    const view = new DataView(buffer);
    
    // Check RIFF/WAVE headers
    const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
    const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
    
    if (riff !== 'RIFF' || wave !== 'WAVE') {
      console.error('Invalid audio format:', { riff, wave });
      return new Response(
        JSON.stringify({ 
          error: 'Invalid audio format. Expected WAV (RIFF/WAVE)',
          details: `Received: ${riff}/${wave}`
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check sample rate, channels, bits per sample
    const sampleRate = view.getUint32(24, true);
    const channels = view.getUint16(22, true);
    const bitsPerSample = view.getUint16(34, true);

    console.log('Audio format validation:', {
      sampleRate,
      channels,
      bitsPerSample,
      isValid: sampleRate === 16000 && channels === 1 && bitsPerSample === 16,
    });

    if (sampleRate !== 16000 || channels !== 1 || bitsPerSample !== 16) {
      console.warn('Audio format warning:', {
        sampleRate: `${sampleRate} (expected 16000)`,
        channels: `${channels} (expected 1)`,
        bitsPerSample: `${bitsPerSample} (expected 16)`,
      });
    }

    // Get user ID or use anonymous identifier
    let userId = 'onboarding_user';
    try {
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (user) {
        userId = user.id.substring(0, 32); // SpeechSuper userId limit
      }
    } catch {
      // User might not be authenticated during onboarding
    }

    // Generate timestamp and signatures
    const timestamp = Math.floor(Date.now() / 1000);
    const connectSig = await generateConnectSig(SPEECHSUPER_APP_KEY, SPEECHSUPER_SECRET_KEY, timestamp);
    const startSig = await generateStartSig(SPEECHSUPER_APP_KEY, SPEECHSUPER_SECRET_KEY, timestamp, userId);

    const audioMeta = {
      audioType: 'wav',
      channel: 1,
      sampleBytes: 2,
      sampleRate: 16000,
    };

    // Build SpeechSuper request payload
    const textPayload = {
      connect: {
        cmd: 'connect',
        param: {
          sdk: {
            version: 16777472,
            source: 9,
            protocol: 2,
          },
          app: {
            applicationId: SPEECHSUPER_APP_KEY,
            timestamp: timestamp.toString(),
            sig: connectSig,
          },
        },
      },
      start: {
        cmd: 'start',
        param: {
          app: {
            userId: userId,
            applicationId: SPEECHSUPER_APP_KEY,
            timestamp: timestamp.toString(),
            sig: startSig,
          },
          audio: audioMeta,
          request: {
            tokenId: `onboarding_${Date.now()}`,
            coreType: 'sent.eval.promax',
            refText: text,
            dict_type: DICT_TYPE,
            dict_dialect: DICT_DIALECT,
            phoneme_output: 1, // Request phoneme-level details
          },
        },
      },
    };

    // Create form data for SpeechSuper API
    const speechSuperFormData = new FormData();
    speechSuperFormData.append('text', JSON.stringify(textPayload));
    speechSuperFormData.append('audio', audioFile, 'recording.wav');

    console.log('Sending audio to SpeechSuper:', {
      userId,
      refText: text,
      audioSize: audioFile.size,
      timestamp,
    });

    // Make request to SpeechSuper API
    const speechSuperResponse = await fetch(SPEECHSUPER_API_URL, {
      method: 'POST',
      headers: {
        'Request-Index': '0',
      },
      body: speechSuperFormData,
    });

    if (!speechSuperResponse.ok) {
      const errorText = await speechSuperResponse.text();
      console.error('SpeechSuper API HTTP error:', speechSuperResponse.status, errorText.substring(0, 200));
      return new Response(
        JSON.stringify({
          error: `SpeechSuper API returned HTTP ${speechSuperResponse.status}`,
          details: errorText.substring(0, 500),
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const contentType = speechSuperResponse.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const errorText = await speechSuperResponse.text();
      console.error('SpeechSuper returned non-JSON response:', contentType, errorText.substring(0, 200));
      return new Response(
        JSON.stringify({
          error: 'SpeechSuper API returned non-JSON response',
          details: errorText.substring(0, 500),
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const speechSuperData = await speechSuperResponse.json();

    console.log('SpeechSuper response eof:', speechSuperData.eof);

    // Check if this is a final result (eof = 1)
    if (speechSuperData.eof !== 1) {
      console.log('Received intermediate result (eof != 1), ignoring');
      return new Response(
        JSON.stringify({
          error: 'Received intermediate result, please retry',
          eof: speechSuperData.eof,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for API errors
    if (speechSuperData.error) {
      console.error('SpeechSuper API error:', speechSuperData.error);
      return new Response(
        JSON.stringify({
          error: 'SpeechSuper evaluation failed',
          details: speechSuperData.error,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract result data - using exact field names from SpeechSuper API
    const result = speechSuperData.result || {};
    const words = result.words || [];
    
    // Transform to format expected by client (speechsuper-api.ts)
    // Per docs: https://docs.speechsuper.com/#/./Languages/English/sent.eval.promax
    // - result.overall, result.pronunciation, result.fluency, result.integrity
    // - words[i].scores.pronunciation (word-level score)
    // - words[i].phonemes[j].pronunciation (phoneme-level score)
    const transformedResult = {
      overall: result.overall || 0,
      pronunciation: result.pronunciation || result.overall || 0,
      fluency: result.fluency || 0,
      completeness: result.integrity || 0, // SpeechSuper uses 'integrity', client expects 'completeness'
      words: words.map((word: any) => ({
        word: word.word || '', // Per docs: word.word is the word text
        quality_score: word.scores?.pronunciation || word.scores?.overall || 0, // Per docs: word.scores.pronunciation
        phone_score_list: (word.phonemes || []).map((phoneme: any) => ({
          phone: phoneme.phoneme || '', // Per docs: phoneme.phoneme (IPA symbol)
          quality_score: Math.round(phoneme.pronunciation || 0), // Per docs: phoneme.pronunciation
          readType: phoneme.readType ?? 0,
          soundLike: phoneme.sound_like || undefined,
          insertedBefore: phoneme.inserted_before || undefined,
          insertedAfter: phoneme.inserted_after || undefined,
        })),
      })),
    };

    console.log('SpeechSuper result:', {
      eof: speechSuperData.eof,
      overall: transformedResult.overall,
      pronunciation: transformedResult.pronunciation,
      fluency: transformedResult.fluency,
      integrity: transformedResult.completeness,
      wordCount: transformedResult.words.length,
      sampleWordScores: transformedResult.words.slice(0, 3).map(w => ({
        word: w.word,
        score: w.quality_score,
      })),
    });

    return new Response(JSON.stringify(transformedResult), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
});
