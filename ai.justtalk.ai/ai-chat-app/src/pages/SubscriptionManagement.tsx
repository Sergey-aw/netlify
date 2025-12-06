import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Calendar, CreditCard } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { BottomNav } from '@/components/BottomNav';
import { mockSubscription, mockCurrentUser } from '@/data/mockData';
import { useSubscription } from '@/hooks/useSubscription';
import { markSubscriptionActive } from '@/lib/onboarding-state';

export default function SubscriptionManagement() {
  const navigate = useNavigate();
  const { hasActiveSubscription } = useSubscription();

  // Mark subscription as active in onboarding state when confirmed
  useEffect(() => {
    if (hasActiveSubscription) {
      markSubscriptionActive();
    }
  }, [hasActiveSubscription]);

  const percentage = mockSubscription.monthly_message_limit
    ? (mockSubscription.messages_used_this_period / mockSubscription.monthly_message_limit) * 100
    : 0;

  const messagesRemaining = mockSubscription.monthly_message_limit
    ? mockSubscription.monthly_message_limit - mockSubscription.messages_used_this_period
    : null;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header className="bg-white px-4 py-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 hover:bg-gray-100 rounded-full"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-semibold">Subscription</h1>
        </div>
      </header>

      <div className="px-4 py-6 max-w-2xl mx-auto space-y-4">
        {/* Current Plan Card */}
        <Card className="bg-gradient-to-br from-blue-500 to-purple-600 text-white border-0">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardDescription className="text-white/80">Your Plan</CardDescription>
                <CardTitle className="text-2xl">{mockSubscription.plan_name}</CardTitle>
              </div>
              <Sparkles className="w-8 h-8 opacity-80" />
            </div>
          </CardHeader>
          <CardContent>
            {messagesRemaining !== null ? (
              <>
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span>{mockSubscription.messages_used_this_period} used</span>
                    <span>{messagesRemaining} left</span>
                  </div>
                  <Progress value={percentage} className="h-2 bg-white/20" />
                </div>
                <p className="text-xs opacity-90">
                  Resets {new Date(mockSubscription.current_period_end).toLocaleDateString()}
                </p>
              </>
            ) : (
              <p className="text-sm opacity-90">
                Unlimited messages · {mockSubscription.messages_used_this_period} this month
              </p>
            )}
          </CardContent>
        </Card>

        {/* Billing Details */}
        <Card>
          <CardHeader>
            <CardTitle>Billing Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5 text-gray-500" />
                <div>
                  <p className="font-medium">Payment Method</p>
                  <p className="text-sm text-gray-500">•••• •••• •••• 4242</p>
                </div>
              </div>
              <Button variant="outline" size="sm">
                Update
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-gray-500" />
                <div>
                  <p className="font-medium">Next Billing Date</p>
                  <p className="text-sm text-gray-500">
                    {new Date(mockSubscription.current_period_end).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <p className="font-semibold">${(mockSubscription.price_cents / 100).toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Profile Info */}
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-gray-500">Name</p>
              <p className="font-medium">{mockCurrentUser.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Email</p>
              <p className="font-medium">{mockCurrentUser.email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">English Level</p>
              <p className="font-medium">{mockCurrentUser.cefr_level}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Learning Goals</p>
              <div className="flex flex-wrap gap-2 mt-1">
                {mockCurrentUser.learning_goals.map((goal) => (
                  <span
                    key={goal}
                    className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                  >
                    {goal}
                  </span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="space-y-2">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate('/subscription/plans')}
          >
            Upgrade Plan
          </Button>
          <Button variant="outline" className="w-full">
            Cancel Subscription
          </Button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
