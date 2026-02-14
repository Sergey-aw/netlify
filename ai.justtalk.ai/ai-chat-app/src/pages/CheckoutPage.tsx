import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import { ArrowLeft } from 'lucide-react';
import { createCheckoutSession } from '@/lib/justai-api';
import logoDark from '@/assets/logo_dark.svg';

// Initialize Stripe with publishable key
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

export default function CheckoutPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Set theme color for mobile browsers (iOS Safari requires hex color)
  useEffect(() => {
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    const brandBlue = '#0080ff'; // hsl(211 100% 50%) converted to hex
    
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', brandBlue);
    }

    // Cleanup: restore default theme color on unmount
    return () => {
      const metaThemeColor = document.querySelector('meta[name="theme-color"]');
      if (metaThemeColor) {
        metaThemeColor.setAttribute('content', '#efefef');
      }
    };
  }, []);

  // Get plan details from URL params
  const priceId = searchParams.get('priceId');
  const trialDays = searchParams.get('trialDays');
  const trialVariant = searchParams.get('trialVariant');
  const pricingVariant = searchParams.get('pricingVariant');

  // Fetch client secret for embedded checkout
  const fetchClientSecret = useCallback(async () => {
    if (!priceId) {
      setError('Missing price information. Please select a plan again.');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const result = await createCheckoutSession(
        priceId,
        undefined, // coupon
        trialDays ? parseInt(trialDays) : undefined,
        trialVariant || undefined,
        true, // embedded mode
        pricingVariant || undefined // A/B test variant
      );

      if (result.clientSecret) {
        setClientSecret(result.clientSecret);
      } else {
        throw new Error('No client secret received');
      }
    } catch (err) {
      console.error('Failed to create checkout session:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize checkout');
    } finally {
      setIsLoading(false);
    }
  }, [priceId, trialDays, trialVariant, pricingVariant]);

  useEffect(() => {
    fetchClientSecret();
  }, [fetchClientSecret]);

  // Handle missing price ID
  if (!priceId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[hsl(var(--brand-blue))]">
        <div className="text-center text-white">
          <p className="mb-4">No plan selected</p>
          <button 
            onClick={() => navigate('/subscription-plans')}
            className="underline"
          >
            View Plans
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--brand-blue))]">
      {/* Header with back arrow and centered logo */}
      <div className="flex items-center justify-between px-4 py-4">
        <button 
          onClick={() => navigate('/subscription-plans')}
          className="text-white p-2 -ml-2 hover:opacity-80 transition-opacity"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <img src={logoDark} alt="JustTalk AI" className="h-8" />
        <div className="w-10" /> {/* Spacer for centering */}
      </div>

      {/* Checkout content */}
      <div className="max-w-2xl mx-auto px-4 pb-8">
        {isLoading && (
          <div className="flex items-center justify-center h-[70vh]">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white"></div>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-[70vh]">
            <div className="text-center text-white">
              <p className="mb-4">{error}</p>
              <div className="space-x-3">
                <button onClick={fetchClientSecret} className="underline">Try Again</button>
                <button onClick={() => navigate('/subscription-plans')} className="underline">
                  Back to Plans
                </button>
              </div>
            </div>
          </div>
        )}

        {clientSecret && (
          <div className="rounded-2xl overflow-hidden">
            <EmbeddedCheckoutProvider
              stripe={stripePromise}
              options={{ clientSecret }}
            >
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>
        )}
      </div>
    </div>
  );
}
