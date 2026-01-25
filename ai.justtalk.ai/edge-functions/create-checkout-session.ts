// Edge Function: create-checkout-session
// Deploy this to your main Supabase repo at: supabase/functions/create-checkout-session/index.ts
// 
// Purpose: Creates a Stripe checkout session for JustAI subscription plans
// 
// Required Secrets (set in Supabase Dashboard):
// - STRIPE_SECRET_KEY
// - SUPABASE_URL
// - SUPABASE_ANON_KEY
// - SUPABASE_SERVICE_ROLE_KEY

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import Stripe from 'https://esm.sh/stripe@14.21.0'

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
    // Get Stripe secret key
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY is not set')
    }

    // Initialize Stripe
    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    // Get authorization header
    const authHeader = req.headers.get('Authorization')
    console.log('Edge function: Auth header check', {
      hasAuthHeader: !!authHeader,
      headerPreview: authHeader ? `${authHeader.substring(0, 20)}...` : 'MISSING'
    })

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header missing' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Get Supabase client with user's auth token
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    // Get authenticated user - try getUser first, then fall back to decoding JWT
    let user
    let userError
    
    try {
      const result = await supabaseClient.auth.getUser()
      user = result.data.user
      userError = result.error
      
      console.log('Edge function: getUser() result', {
        hasUser: !!user,
        userId: user?.id,
        isAnonymous: user?.is_anonymous,
        hasError: !!userError,
        errorMessage: userError?.message
      })
    } catch (e) {
      console.error('Edge function: getUser() threw exception', e)
      userError = e
    }

    if (userError || !user) {
      console.log('Edge function: getUser failed, trying JWT decode fallback')
      console.error('Edge function: Auth error details', {
        errorName: userError?.name,
        errorMessage: userError?.message,
        errorStatus: userError?.status
      })
      
      // Try to decode JWT directly as fallback for anonymous users
      try {
        const token = authHeader.replace('Bearer ', '')
        const parts = token.split('.')
        console.log('Edge function: JWT has', parts.length, 'parts')
        
        if (parts.length === 3) {
          // Decode the payload (middle part of JWT)
          const base64Url = parts[1]
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
          const payload = JSON.parse(atob(base64))
          
          console.log('Edge function: JWT decoded successfully', {
            sub: payload.sub,
            is_anonymous: payload.is_anonymous,
            role: payload.role,
            exp: payload.exp,
            iat: payload.iat
          })
          
          if (payload.sub) {
            // Verify the token isn't expired
            const now = Math.floor(Date.now() / 1000)
            if (payload.exp && payload.exp < now) {
              console.error('Edge function: JWT is expired', {
                exp: payload.exp,
                now: now
              })
              return new Response(
                JSON.stringify({ error: 'Token expired', details: 'Your session has expired' }),
                {
                  status: 401,
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                }
              )
            }
            
            // Use the user ID from JWT
            user = { 
              id: payload.sub, 
              is_anonymous: payload.is_anonymous || false,
              email: payload.email 
            }
            console.log('Edge function: Using JWT payload as user', {
              userId: user.id,
              isAnonymous: user.is_anonymous
            })
          }
        }
      } catch (jwtError) {
        console.error('Edge function: JWT decode failed', jwtError)
      }
      
      if (!user) {
        console.error('Edge function: Both getUser and JWT decode failed')
        return new Response(
          JSON.stringify({ 
            error: 'Unauthorized', 
            details: userError?.message || 'Cannot verify user',
            hint: 'Please sign in again'
          }),
          {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }
    }

    // Parse request body
    const { priceId, coupon, trialDays, trialVariant } = await req.json()
    
    console.log('Edge function: Request body parsed', { 
      priceId, 
      coupon: coupon || 'none',
      trialDays: trialDays || 'none',
      trialVariant: trialVariant || 'none'
    })

    if (!priceId) {
      return new Response(
        JSON.stringify({ error: 'priceId is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Get user's email - for anonymous users, get it from their profile
    let userEmail = user.email
    
    console.log('Edge function: Email check', {
      userEmail: userEmail,
      userId: user.id,
      isAnonymous: user.is_anonymous
    })
    
    // Create service role client to bypass RLS when reading profile
    const supabaseServiceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )
    
    if (!userEmail) {
      console.log('Edge function: No email in user object, checking profiles table')
      
      // Try to get email from profile (for anonymous users) using service role
      const { data: profile, error: profileError } = await supabaseServiceClient
        .from('profiles')
        .select('email')
        .eq('id', user.id)
        .single()
      
      console.log('Edge function: Profile query result', {
        hasProfile: !!profile,
        profileEmail: profile?.email,
        hasError: !!profileError,
        errorMessage: profileError?.message,
        errorCode: profileError?.code
      })
      
      userEmail = profile?.email
      
      if (!userEmail) {
        console.error('Edge function: Email not found in profile')
        return new Response(
          JSON.stringify({ 
            error: 'User email not found. Please provide an email address.',
            debug: {
              userId: user.id,
              profileError: profileError?.message
            }
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }
      
      console.log('Edge function: Found email in profile', { email: userEmail })
    }

    // IMPORTANT: Get the profile ID to use as student_id
    // The subscription must be linked to the profile.id, not auth.users.id
    // Use the supabaseServiceClient that was already created above
    const { data: profile, error: profileIdError } = await supabaseServiceClient
      .from('profiles')
      .select('id, email')
      .eq('email', userEmail)
      .single()
    
    if (profileIdError || !profile) {
      console.error('Edge function: Profile not found for email', { userEmail, error: profileIdError })
      return new Response(
        JSON.stringify({ 
          error: 'Profile not found. Please complete your account setup.',
          debug: {
            email: userEmail,
            error: profileIdError?.message
          }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }
    
    const studentId = profile.id; // Use profile ID, not auth user ID
    console.log('Edge function: Using profile ID as student_id', {
      studentId,
      authUserId: user.id,
      email: userEmail
    })

    // Create or retrieve Stripe customer
    let customerId: string

    // Check if user already has a Stripe customer ID
    const { data: existingSubscription } = await supabaseClient
      .from('justai_subscriptions')
      .select('stripe_customer_id')
      .eq('student_id', studentId)
      .single()

    if (existingSubscription?.stripe_customer_id) {
      customerId = existingSubscription.stripe_customer_id
    } else {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: {
          supabase_user_id: user.id,
        },
      })
      customerId = customer.id
    }

    // Create Stripe checkout session
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${req.headers.get('origin')}/subscription-status?success=true`,
      cancel_url: `${req.headers.get('origin')}/subscription-plans?canceled=true`,
      metadata: {
        student_id: studentId, // Use profile ID from profiles table
      },
      subscription_data: {
        metadata: {
          student_id: studentId, // Use profile ID from profiles table
        },
      },
      // Allow customers to enter promotion codes during checkout
      allow_promotion_codes: true,
    }

    // Add trial period if provided
    if (trialDays && trialDays > 0) {
      console.log('Edge function: Adding trial period', { trialDays, trialVariant })
      sessionParams.subscription_data!.trial_period_days = trialDays
      // Store trial info in metadata
      sessionParams.subscription_data!.metadata!.trial_days = trialDays.toString()
      if (trialVariant) {
        sessionParams.subscription_data!.metadata!.trial_variant = trialVariant
      }
    }

    // If a coupon code was provided, apply it
    if (coupon) {
      console.log('Edge function: Applying coupon code', { coupon })
      sessionParams.discounts = [{ coupon }]
    }

    const session = await stripe.checkout.sessions.create(sessionParams)

    return new Response(
      JSON.stringify({ url: session.url }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error creating checkout session:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
