// Subscription Status Component - Display current subscription info
import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Badge } from '../components/ui/badge';
import { CheckCircle, ArrowLeft } from 'lucide-react';
import { useSubscription } from '../hooks/useSubscription';
import { useSession } from '../hooks/useSession';
import { trackSubscriptionActivated, identifyUser } from '@/lib/posthog';

export default function SubscriptionStatus() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [hasTrackedActivation, setHasTrackedActivation] = useState(false);
  const { subscription, voiceSecondsUsed, voiceSecondsRemaining, voiceMinutesLimit, isLoading } = useSubscription();
  const { user, getEmail } = useSession();

  // Handle success parameter
  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      setShowSuccessMessage(true);
      // Clear the parameter after showing message
      const timer = setTimeout(() => {
        setSearchParams({});
        setShowSuccessMessage(false);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [searchParams, setSearchParams]);

  // Track subscription activation when subscription data loads after Stripe success
  useEffect(() => {
    const trackActivation = async () => {
      if (searchParams.get('success') === 'true' && subscription && !hasTrackedActivation && user?.id) {
        // First, ensure PostHog has the user's email
        const email = await getEmail();
        
        // Identify user with email before tracking subscription event
        identifyUser(user.id, {
          email: email || undefined,
          isAnonymous: user.is_anonymous,
        });
        
        // Now track the subscription activation
        trackSubscriptionActivated(
          subscription.subscription_type,
          'stripe_price_id_from_subscription', // Price ID not stored in subscription table
          subscription.price_cents,
          subscription.billing_period,
          subscription.stripe_subscription_id || undefined
        );
        setHasTrackedActivation(true);
      }
    };
    
    trackActivation();
  }, [searchParams, subscription, hasTrackedActivation, user, getEmail]);

  if (isLoading) {
    return <div className="flex items-center justify-center p-8">Loading...</div>;
  }

  if (!subscription) {
    return (
      <div className="container mx-auto py-8 px-4">
        {/* Success Message */}
        {showSuccessMessage && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-start gap-3 mb-6">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-green-900 dark:text-green-100">Subscription Activated!</p>
              <p className="text-sm text-green-800 dark:text-green-200 mt-1">
                Your subscription is being processed. Refresh in a moment to see your plan details.
              </p>
            </div>
          </div>
        )}
        <Card>
          <CardHeader>
            <CardTitle>No Active Subscription</CardTitle>
            <CardDescription>
              Subscribe to JustAI to start practicing English with AI voice conversations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/subscription-plans')}>
              View Plans
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Format seconds to human-readable time
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${minutes}m`;
  };

  const voiceLimitSeconds = voiceMinutesLimit ? voiceMinutesLimit * 60 : null;
  const usagePercentage = voiceLimitSeconds
    ? (voiceSecondsUsed / voiceLimitSeconds) * 100
    : 0;

  const periodEnd = new Date(subscription.current_period_end);
  const daysRemaining = Math.ceil(
    (periodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  const planName = subscription.subscription_type.charAt(0).toUpperCase() + subscription.subscription_type.slice(1);

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Success Message */}
      {showSuccessMessage && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-start gap-3 mb-6">
          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-green-900 dark:text-green-100">Payment Successful!</p>
            <p className="text-sm text-green-800 dark:text-green-200 mt-1">
              Your subscription is now active. Enjoy unlimited access to JustAI!
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/ai-chat')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-3xl font-bold">My Subscription</h1>
      </div>

      <div className="space-y-6">
        {/* Plan Info */}
        <Card className="bg-[hsl(var(--brand-blue))] text-white border-0">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white">JustAI {planName}</CardTitle>
                <CardDescription className="text-white/80">
                  {subscription.cancel_at_period_end 
                    ? `Cancels on ${periodEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
                    : `${subscription.billing_period === 'annual' ? 'Annual' : 'Monthly'} Plan`
                  }
                </CardDescription>
              </div>
              <Badge
                className={subscription.cancel_at_period_end ? 'bg-blue-100 text-blue-600' : 'bg-white/20 text-white border-0'}
              >
                {subscription.cancel_at_period_end ? 'Canceling' : subscription.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Price */}
            {!subscription.cancel_at_period_end && (
              <div>
                <div className="text-2xl font-bold text-white">
                  ${(subscription.price_cents / 100).toFixed(2)}
                </div>
                <div className="text-sm text-white/80">
                  {subscription.billing_period === 'annual' ? 'per year' : 'per month'}
                </div>
              </div>
            )}

            {/* Renewal Date or Active Until */}
            <div>
              <div className="text-sm font-medium text-white">
                {subscription.cancel_at_period_end ? 'Active until' : 'Next billing date'}
              </div>
              <div className="text-white/80">
                {periodEnd.toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
                {' '}
                ({daysRemaining} days remaining)
              </div>
              {subscription.cancel_at_period_end && (
                <div className="text-sm text-white/80 mt-1">
                  No further charges will be made
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Voice Time Usage */}
        {voiceMinutesLimit && (
          <Card>
            <CardHeader>
              <CardTitle>Voice Time This Period</CardTitle>
              <CardDescription>
                {subscription.cancel_at_period_end 
                  ? `Time used: ${formatTime(voiceSecondsUsed)} of ${formatTime(voiceMinutesLimit * 60)} (will not reset)`
                  : `Time used: ${formatTime(voiceSecondsUsed)} of ${formatTime(voiceMinutesLimit * 60)}`
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={usagePercentage} />
              
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {formatTime(voiceSecondsRemaining ?? 0)} remaining
                </span>
                <span className="font-medium">
                  {usagePercentage.toFixed(0)}% used
                </span>
              </div>

              {usagePercentage > 80 && (
                <div className="text-sm text-amber-600">
                  You're running low on voice time. Consider upgrading to get more.
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {!voiceMinutesLimit && (
          <Card>
            <CardContent className="py-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600 mb-2">
                  ♾️ Unlimited Voice Time
                </div>
                <p className="text-muted-foreground">
                  You have unlimited access to all JustAI voice features
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Features */}
        <Card>
          <CardHeader>
            <CardTitle>Your Benefits</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-green-600">✓</span>
                <span className="text-sm">AI-powered conversation practice</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600">✓</span>
                <span className="text-sm">Real-time pronunciation feedback</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600">✓</span>
                <span className="text-sm">Personalized learning path</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600">✓</span>
                <span className="text-sm">{voiceMinutesLimit ? `${formatTime(voiceMinutesLimit * 60)} voice time per ${subscription.billing_period === 'weekly' ? 'week' : subscription.billing_period === 'annual' ? 'month' : 'month'}` : 'Unlimited voice time'}</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Manage Subscription</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => navigate('/subscription/manage')}
            >
              View Full Details
            </Button>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => navigate('/subscription/manage')}
            >
              Change Plan
            </Button>
            {subscription.cancel_at_period_end ? (
              <Button 
                variant="outline" 
                className="w-full text-green-600"
                onClick={() => navigate('/subscription/manage')}
              >
                Reactivate Subscription
              </Button>
            ) : (
              <Button 
                variant="outline" 
                className="w-full text-destructive"
                onClick={() => navigate('/subscription/manage')}
              >
                Cancel Subscription
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
