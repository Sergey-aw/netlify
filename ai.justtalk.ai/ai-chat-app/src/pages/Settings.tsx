import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useRef } from 'react';
import { ArrowLeft, Play, Pause, CreditCard, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { useSubscription } from '@/hooks/useSubscription';

interface Voice {
  voice_id: string;
  name: string;
  labels: {
    gender: string;
    accent: string;
    age?: string;
    use_case?: string;
  };
  preview_url: string;
  is_primary: boolean;
}

export default function Settings() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { subscription, hasActiveSubscription } = useSubscription();

  // Get current user
  const { data: user } = useQuery({
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

  // Get available voices
  const { data: voices = [], isLoading: loadingVoices } = useQuery({
    queryKey: ['elevenlabs-voices'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-get-voices`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.voices || [];
      }
      return [];
    },
  });

  // Update voice preference
  const updateVoiceMutation = useMutation({
    mutationFn: async (voiceId: string) => {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !authUser) {
        console.error('Auth error:', authError);
        throw new Error('Not authenticated');
      }

      const { error } = await supabase
        .from('profiles')
        .update({ justai_preferred_voice: voiceId })
        .eq('id', authUser.id);

      if (error) {
        console.error('Update error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-user'] });
    },
    onError: (error) => {
      console.error('Mutation error:', error);
    },
  });

  // Play voice preview
  const handlePlayVoice = (voiceId: string, previewUrl: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (playingVoice === voiceId) {
      audioRef.current?.pause();
      setPlayingVoice(null);
    } else {
      audioRef.current?.pause();
      const audio = new Audio(previewUrl);
      audioRef.current = audio;
      setPlayingVoice(voiceId);
      audio.play();
      audio.onended = () => setPlayingVoice(null);
      audio.onerror = () => setPlayingVoice(null);
    }
  };

  const handleVoiceSelect = (voiceId: string) => {
    updateVoiceMutation.mutate(voiceId);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white px-4 py-4 border-b sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold">Settings</h1>
        </div>
      </header>

      <main className="px-4 py-6 max-w-4xl mx-auto space-y-6">
        {/* Subscription Section */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Subscription</h3>
            {hasActiveSubscription && subscription && (
              <Badge variant="outline" className="capitalize">
                {subscription.subscription_type}
              </Badge>
            )}
          </div>
          
          {hasActiveSubscription && subscription ? (
            <button
              onClick={() => navigate('/subscription/manage')}
              className="w-full flex items-center justify-between p-3 rounded-lg border-2 border-gray-200 hover:border-gray-300 transition-all text-left"
            >
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5 text-gray-500" />
                <div>
                  <p className="font-medium">Manage Subscription</p>
                  <p className="text-xs text-gray-500">
                    {subscription.monthly_message_limit
                      ? `${subscription.messages_used_this_period || 0}/${subscription.monthly_message_limit} messages used`
                      : `${subscription.messages_used_this_period || 0} messages this month`}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          ) : (
            <button
              onClick={() => navigate('/subscription/plans')}
              className="w-full flex items-center justify-between p-3 rounded-lg border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 transition-all text-left"
            >
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="font-medium text-blue-900">Subscribe to JustAI</p>
                  <p className="text-xs text-blue-700">
                    Get unlimited AI conversations
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-blue-600" />
            </button>
          )}
        </Card>

        {/* Learning Preferences */}
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Learning Preferences</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Native Language</span>
              <span className="text-sm font-medium">
                {user?.native_language || 'Not set'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Target Language</span>
              <span className="text-sm font-medium">English</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Correction Style</span>
              <span className="text-sm font-medium capitalize">
                {agentConfig?.correction_style || 'Balanced'}
              </span>
            </div>
          </div>
        </Card>

        {/* Voice Selection */}
        <Card className="p-4">
          <h3 className="font-semibold mb-3">AI Voice</h3>
          {loadingVoices ? (
            <div className="text-center py-4 text-gray-500">Loading voices...</div>
          ) : (
            <div className="space-y-2">
              {voices.map((voice: Voice) => (
                <button
                  key={voice.voice_id}
                  onClick={() => handleVoiceSelect(voice.voice_id)}
                  disabled={updateVoiceMutation.isPending}
                  className={cn(
                  'w-full p-3 rounded-lg border-2 transition-all text-left relative flex items-start gap-3',
                  user?.justai_preferred_voice === voice.voice_id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300',
                    updateVoiceMutation.isPending && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {voice.name}
                      {user?.justai_preferred_voice === voice.voice_id && (
                        <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">
                          Active
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 capitalize mt-0.5">
                      {voice.labels.accent} • {voice.labels.gender}
                      {voice.labels.age && ` • ${voice.labels.age.replace('_', ' ')}`}
                    </p>
                  </div>
                  <button
                    onClick={(e) => handlePlayVoice(voice.voice_id, voice.preview_url, e)}
                    className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors flex-shrink-0"
                  >
                    {playingVoice === voice.voice_id ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </button>
                </button>
              ))}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
