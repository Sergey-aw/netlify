// Check if email already exists in profiles table
// This is needed before creating anonymous user to prevent duplicates

// @ts-ignore: Runtime imports for Deno
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @ts-ignore: Runtime imports for Deno
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

// Declare Deno globally for local typecheck
declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Create Supabase client with service role to bypass RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Check BOTH:
    // 1. If profile exists with this email
    // 2. If auth.users exists with this email (for magic link to work)
    const { data: existingProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    if (profileError && profileError.code !== 'PGRST116') {
      throw profileError;
    }

    // Check if user exists in auth.users (required for magic link)
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
    
    const authUser = users?.find((u: any) => 
      u.email?.toLowerCase() === email.trim().toLowerCase()
    );

    return new Response(
      JSON.stringify({ 
        exists: !!existingProfile,
        canUseMagicLink: !!authUser && !authUser.is_anonymous, // Magic link only works for non-anonymous users
        email: existingProfile?.email || null
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error checking email:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
