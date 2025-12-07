import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  Settings, 
  Crown, 
  TrendingUp, 
  Target, 
  Award,
  ChevronRight,
  LogOut
} from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BottomNav } from '@/components/BottomNav';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';

export default function Profile() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { subscription, messagesRemaining } = useSubscription();

  // Get current user
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Get old subscription query (can be removed later)
  const { data: oldSubscription } = useQuery({
    queryKey: ['my-subscription'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data } = await supabase
        .from('justai_subscriptions')
        .select('*, plan:justai_subscription_plans(*)')
        .eq('student_id', user.id)
        .eq('status', 'active')
        .single();

      return data;
    },
  });

  // Get agent config
  const { data: agentConfig } = useQuery({
    queryKey: ['agent-config'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data } = await supabase
        .from('justai_agent_configs')
        .select('*')
        .eq('student_id', user.id)
        .single();

      return data;
    },
  });

  // Get real user stats
  const { data: userStats } = useQuery({
    queryKey: ['user-stats', user?.id],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Get conversation count
      const { count: conversationCount } = await supabase
        .from('justai_conversations')
        .select('*', { count: 'exact', head: true })
        .eq('student_id', user.id);

      // Get total voice session hours
      const { data: voiceSessions } = await supabase
        .from('justai_voice_sessions')
        .select('total_duration_seconds')
        .eq('student_id', user.id);

      const totalSeconds = voiceSessions?.reduce((sum, session) => sum + (session.total_duration_seconds || 0), 0) || 0;
      const totalHours = (totalSeconds / 3600).toFixed(1);

      // Calculate streak (days with conversations in last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: recentConversations } = await supabase
        .from('justai_conversations')
        .select('created_at')
        .eq('student_id', user.id)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false });

      // Calculate consecutive days with activity
      let streak = 0;
      if (recentConversations && recentConversations.length > 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const conversationDates = new Set(
          recentConversations.map(conv => {
            const date = new Date(conv.created_at);
            date.setHours(0, 0, 0, 0);
            return date.getTime();
          })
        );

        let checkDate = today.getTime();
        while (conversationDates.has(checkDate)) {
          streak++;
          checkDate -= 24 * 60 * 60 * 1000; // Go back one day
        }
      }

      return {
        conversationCount: conversationCount || 0,
        totalHours,
        streak,
      };
    },
    enabled: !!user?.id,
  });

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const stats = [
    { label: 'Conversations', value: userStats?.conversationCount?.toString() || '0', icon: TrendingUp },
    { label: 'Current Streak', value: `${userStats?.streak || 0} days`, icon: Target },
    { label: 'Total Hours', value: `${userStats?.totalHours || '0.0'}h`, icon: Award },
  ];

  const menuItems = [
    { 
      icon: Crown, 
      label: 'Subscription', 
      value: subscription ? `${subscription.subscription_type.charAt(0).toUpperCase() + subscription.subscription_type.slice(1)} (${messagesRemaining ?? '∞'} msgs left)` : 'No subscription',
      action: () => navigate(subscription ? '/subscription-status' : '/subscription-plans')
    },
    { 
      icon: Settings, 
      label: 'Learning Goals', 
      value: `${agentConfig?.learning_goals?.length || 0} active`,
      action: () => navigate('/onboarding/goals')
    },
    { 
      icon: Settings, 
      label: 'Settings', 
      action: () => navigate('/settings')
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-24 page-enter">
      {/* Header */}
      <header className="bg-white px-4 py-6 border-b">
        {userLoading ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        ) : (
          <div className="flex items-center gap-4 mb-6">
            <Avatar className="w-20 h-20">
              <AvatarImage src={user?.avatar_url} />
              <AvatarFallback className="text-2xl">
                {user?.display_name?.[0] || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h1 className="text-2xl font-bold mb-1">
                {user?.display_name || 'Student'}
              </h1>
              <p className="text-sm text-muted-foreground mb-2">
                {user?.email || ''}
              </p>
              <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                Intermediate Level
              </Badge>
            </div>
          </div>
        )}

        {/* Level Progress */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progress to Next Level</span>
            <span className="text-sm text-muted-foreground">65%</span>
          </div>
          <Progress value={65} className="h-2" />
        </div>
      </header>

      <main className="px-4 py-6 max-w-4xl mx-auto space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label} className="p-4 text-center">
                <Icon className="w-5 h-5 text-blue-600 mx-auto mb-2" />
                <div className="text-xl font-bold mb-1">{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </Card>
            );
          })}
        </div>

        {/* Menu Items */}
        <Card className="divide-y">
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={index}
                onClick={item.action}
                className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Icon className="w-5 h-5 text-gray-600" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-medium">{item.label}</div>
                  {item.value && (
                    <div className="text-sm text-muted-foreground">
                      {item.value}
                    </div>
                  )}
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>
            );
          })}
        </Card>



        {/* Logout Button */}
        <Button
          onClick={handleLogout}
          variant="outline"
          className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Log Out
        </Button>
      </main>

      <BottomNav />
    </div>
  );
}
