import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, ChevronRight, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BottomNav } from '@/components/BottomNav';
import { ELEVENLABS_AGENTS } from '@/config/elevenlabs-agents';

export default function RolePlays() {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

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

  const handleAgentClick = (agentId: string, agentElevenLabsId: string, agentName: string, scenario: string) => {
    console.log('🎯 Role-play agent clicked:', {
      agentId,
      agentElevenLabsId,
      agentName,
      scenario,
    });
    
    // Navigate to voice chat with agent information
    navigate('/ai-chat/voice/new', { 
      state: { 
        fromTransition: true,
        agentId: agentElevenLabsId,
        agentName: agentName,
        scenario: scenario,
      } 
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24 page-enter">
      {/* Header */}
      <header className="bg-white px-4 py-6 border-b">
        <h1 className="text-2xl font-bold mb-2">Role-play Scenarios</h1>
        <p className="text-sm text-muted-foreground">
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
              onClick={() => handleAgentClick(agent.id, agent.agentId, agent.name, agent.id)}
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
                    handleAgentClick(agent.id, agent.agentId, agent.name, agent.id);
                  }}
                >
                  <Play className="w-5 h-5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
