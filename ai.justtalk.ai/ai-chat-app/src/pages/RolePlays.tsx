import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, ChevronRight, Clock, PanelLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ELEVENLABS_AGENTS } from '@/config/elevenlabs-agents';
import { supabase } from '@/lib/supabase';
import { AppSidebar } from '@/components/AppSidebar';

export default function RolePlays() {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [showSidebar, setShowSidebar] = useState(false);

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

  // Extract unique categories from agents
  const categories = ['All', ...Array.from(new Set(ELEVENLABS_AGENTS.map(agent => agent.category)))];

  const filteredAgents =
    selectedCategory === 'All'
      ? ELEVENLABS_AGENTS
      : ELEVENLABS_AGENTS.filter((agent) => agent.category === selectedCategory);

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'Flexible';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  };

  const handleAgentClick = (agentId: string, agentElevenLabsId: string, agentName: string, scenario: string, description: string) => {
    console.log('🎯 Role-play agent clicked:', {
      agentId,
      agentElevenLabsId,
      agentName,
      scenario,
      description,
    });
    
    // Navigate to voice chat with agent information
    // Using the ElevenLabs agent ID from the config
    navigate('/ai-chat/voice/new', { 
      state: { 
        fromTransition: true,
        agentId: agentElevenLabsId, // This is the correct ElevenLabs agent ID
        agentName: agentName,
        scenario: description, // Use description as scenario for better context
      } 
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24 page-enter">
      {/* Sidebar */}
      <AppSidebar open={showSidebar} onOpenChange={setShowSidebar} />

      {/* Header */}
      <header className="bg-white px-4 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <Button 
            variant="ghost" 
            size="icon" 
            className="-ml-2"
            onClick={() => setShowSidebar(!showSidebar)}
          >
            <PanelLeft className="w-6 h-6 text-gray-600" />
          </Button>
          <div className="flex-1 text-center">
            <h1 className="text-xl font-semibold">Role-play Scenarios</h1>
          </div>
          <Avatar className="w-10 h-10 cursor-pointer" onClick={() => navigate('/profile')}>
            <AvatarImage src={user?.profile_photo_url} />
            <AvatarFallback>{user?.display_name?.[0] || 'U'}</AvatarFallback>
          </Avatar>
        </div>
        <p className="text-sm text-muted-foreground text-center mt-2">
          Practice real-life conversations with AI voice agents
        </p>
      </header>

      <main className="px-4 py-6 max-w-4xl mx-auto">
        {/* Category Filter */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide">
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(category)}
              className="rounded-full whitespace-nowrap capitalize"
            >
              {category}
            </Button>
          ))}
        </div>

        {/* Role-play Cards */}
        <div className="space-y-4">
          {filteredAgents.map((agent) => (
            <Card
              key={agent.id}
              className="p-4 cursor-pointer hover:shadow-md hover:border-primary transition-all"
              onClick={() => handleAgentClick(agent.id, agent.agentId, agent.name, agent.id, agent.description)}
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="text-4xl flex-shrink-0">{agent.icon}</div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-base">{agent.name}</h3>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  </div>

                  <p className="text-sm text-muted-foreground mb-3">
                    {agent.description}
                  </p>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs capitalize">
                      {agent.category}
                    </Badge>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>{formatDuration(agent.recommendedDuration)}</span>
                    </div>
                  </div>
                </div>

                {/* Play Button */}
                <Button
                  size="icon"
                  className="rounded-full flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAgentClick(agent.id, agent.agentId, agent.name, agent.id, agent.description);
                  }}
                >
                  <Play className="w-5 h-5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
