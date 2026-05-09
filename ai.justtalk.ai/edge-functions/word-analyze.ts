import { createClient } from 'jsr:@supabase/supabase-js@2';

const WORD_ANALYSIS_API = 'http://definitions-env.eba-dfg2rfkd.us-east-1.elasticbeanstalk.com/analyze';

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
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

    // Verify user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get user's profile for target language
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('native_language')
      .eq('id', user.id)
      .single();

    // Parse request body
    const { text, target_word, message_id, conversation_id } = await req.json();

    if (!text || !target_word) {
      return new Response(JSON.stringify({ error: 'Missing required fields: text and target_word' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Determine target language code from native language name
    const languageMap: Record<string, string> = {
      'Spanish': 'es',
      'Portuguese': 'pt',
      'French': 'fr',
      'German': 'de',
      'Italian': 'it',
      'Russian': 'ru',
      'Polish': 'pl',
      'Dutch': 'nl',
      'Swedish': 'sv',
      'Danish': 'da',
      'Finnish': 'fi',
      'Norwegian': 'no',
      'Greek': 'el',
      'Turkish': 'tr',
      'Chinese': 'zh',
      'Japanese': 'ja',
      'Korean': 'ko',
      'Thai': 'th',
      'Vietnamese': 'vi',
      'Indonesian': 'id',
      'Malay': 'ms',
      'Hindi': 'hi',
      'Bengali': 'bn',
      'Tamil': 'ta',
      'Telugu': 'te',
      'Arabic': 'ar',
      'Hebrew': 'he',
      'Persian': 'fa',
      'Urdu': 'ur',
    };

    const targetLanguage = languageMap[profile?.native_language || 'Russian'] || 'ru';

    // Prepare request for word analysis API
    const analysisRequest = {
      text,
      target_word,
      language: 'en',
      target_language: targetLanguage,
      lessonId: conversation_id || 'unknown',
      segmentId: message_id || 'unknown',
      metadata: {
        source: 'api',
        max_definitions: 3,
      },
    };

    // Call word analysis API
    const response = await fetch(WORD_ANALYSIS_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(analysisRequest),
    });

    if (!response.ok) {
      throw new Error(`Word analysis API returned ${response.status}`);
    }

    const analysisData = await response.json();

    // Return the full API response structure
    // Frontend expects: word[0].word, word[0].pos, synonyms_wordnet, translations, definitions
    return new Response(JSON.stringify(analysisData), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Error in word-analyze function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
