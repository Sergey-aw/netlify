import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Settings, 
  Crown, 
  TrendingUp, 
  Target, 
  Award,
  ChevronRight,
  LogOut,
  PanelLeft,
  Camera,
  Loader2
} from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { AppSidebar } from '@/components/AppSidebar';
import AvatarCropModal from '@/components/AvatarCropModal';

export default function Profile() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { subscription, voiceSecondsRemaining } = useSubscription();
  const [showSidebar, setShowSidebar] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showCropModal, setShowCropModal] = useState(false);
  const [imageSrc, setImageSrc] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Add swipe gesture to open sidebar
  useSwipeGesture({
    onSwipeRight: () => {
      if (!showSidebar) {
        setShowSidebar(true);
      }
    },
    minSwipeDistance: 50,
    maxVerticalDistance: 100,
  });

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
  useQuery({
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

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB');
      return;
    }

    // Create a preview URL and show crop modal
    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
      setShowCropModal(true);
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = async (croppedImageBlob: Blob) => {
    if (!user) return;

    setUploadingAvatar(true);

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error('Not authenticated');

      // Delete old avatar if exists
      if (user.profile_photo_url) {
        const oldPath = user.profile_photo_url.split('/').pop();
        if (oldPath) {
          await supabase.storage
            .from('profile-photos')
            .remove([`${authUser.id}/${oldPath}`]);
        }
      }

      // Upload cropped avatar
      const fileName = `${Date.now()}.jpg`;
      const filePath = `${authUser.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(filePath, croppedImageBlob, {
          cacheControl: '3600',
          upsert: false,
          contentType: 'image/jpeg',
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(filePath);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ profile_photo_url: publicUrl })
        .eq('id', authUser.id);

      if (updateError) throw updateError;

      // Invalidate queries to refetch with new avatar
      queryClient.invalidateQueries({ queryKey: ['current-user'] });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      alert('Failed to upload avatar. Please try again.');
    } finally {
      setUploadingAvatar(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Format time remaining for display
  const formatTimeRemaining = (seconds: number | null): string => {
    if (seconds === null) return '∞';
    const minutes = Math.floor(seconds / 60);
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${minutes}m`;
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
      value: subscription ? `${subscription.subscription_type.charAt(0).toUpperCase() + subscription.subscription_type.slice(1)}` : 'No subscription',
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
      {/* Sidebar */}
      <AppSidebar open={showSidebar} onOpenChange={setShowSidebar} />

      {/* Avatar Crop Modal */}
      <AvatarCropModal
        open={showCropModal}
        onClose={() => setShowCropModal(false)}
        imageSrc={imageSrc}
        onCropComplete={handleCropComplete}
      />

      {/* Header */}
      <header className="px-4 py-4">
        <div className="flex items-start justify-between max-w-7xl mx-auto">
          <Button 
            variant="ghost" 
            size="icon" 
            className="-ml-2"
            onClick={() => setShowSidebar(!showSidebar)}
          >
            <PanelLeft className="w-6 h-6 text-gray-600" />
          </Button>
          {userLoading ? (
            <div className="flex-1" />
          ) : (
            <div className="flex-1 flex items-start gap-4 pt-1 pl-4">
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
              <div className="relative flex-shrink-0">
                <button
                  onClick={handleAvatarClick}
                  disabled={uploadingAvatar}
                  className="relative group"
                  title="Change profile picture"
                >
                  <Avatar className="w-20 h-20">
                    <AvatarImage src={user?.profile_photo_url} />
                    <AvatarFallback className="text-2xl">
                      {user?.display_name?.[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  {!user?.profile_photo_url && (
                    <div className="absolute bottom-0 right-0 p-1.5 bg-blue-600 rounded-full text-white shadow-lg group-hover:bg-blue-700 transition-colors">
                      {uploadingAvatar ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Camera className="w-4 h-4" />
                      )}
                    </div>
                  )}
                  {user?.profile_photo_url && uploadingAvatar && (
                    <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                    </div>
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Profile Content */}
      <div className="px-4 py-6">
        {/* Level Progress */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progress to Next Level</span>
            <span className="text-sm text-muted-foreground">65%</span>
          </div>
          <Progress value={65} className="h-2" />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mt-6">
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
        <Card className="divide-y mt-6">
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
          className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 mt-6"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Log Out
        </Button>
      </div>
    </div>
  );
}
