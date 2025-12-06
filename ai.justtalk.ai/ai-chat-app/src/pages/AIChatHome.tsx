import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Menu,
  Sparkles,
  MessageSquare,
  MessageCircle,
  BookOpen,
  User,
  Settings2,
} from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { VoiceButtonTransition } from '@/components/VoiceButtonTransition';
import { supabase } from '@/lib/supabase';
import { checkSubscriptionAccess } from '@/lib/justai-api';
import LogoBars from '@/assets/logo_bars.svg';
import Logo from '@/assets/logo.svg';

const SCENARIO_ICONS: Record<string, string> = {
  career: '✏️',
  travel: '🧑‍💻',
  academic: '🎓',
  conversation: '🗣️',
  test_prep: '📝',
  kids: '🎨',
};

const SCENARIO_NAMES: Record<string, string> = {
  career: 'Writing',
  travel: 'Programming',
  academic: 'Education',
  conversation: 'Conversation',
  test_prep: 'Test Prep',
  kids: 'Kids',
};

export default function AIChatHome() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionStart, setTransitionStart] = useState<{ x: number; y: number } | undefined>();
  const voiceButtonRef = useRef<HTMLButtonElement>(null);

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

  // Get agent config for learning goals
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

  // Check subscription status
  const { data: hasAccess } = useQuery({
    queryKey: ['subscription-access'],
    queryFn: checkSubscriptionAccess,
  });

  // Redirect to subscription if no access
  useEffect(() => {
    if (hasAccess !== undefined && !hasAccess) {
      navigate('/subscription/plans');
    }
  }, [hasAccess, navigate]);

  const handleStartScenario = (scenario: string) => {
    navigate('/ai-chat/conversation/new', { state: { scenario } });
  };

  const handleVoiceClick = () => {
    if (voiceButtonRef.current) {
      const rect = voiceButtonRef.current.getBoundingClientRect();
      setTransitionStart({
        x: rect.left,
        y: rect.top,
      });
      setIsTransitioning(true);
      
      // Navigate after a short delay to let the animation start
      setTimeout(() => {
        navigate('/ai-chat/voice/new', { state: { fromTransition: true } });
      }, 50);
    }
  };

  return (
    <div className="h-[95vh] bg-white page-enter flex flex-col">
      {/* Voice Button Transition Overlay */}
      <VoiceButtonTransition
        isTransitioning={isTransitioning}
        startPosition={transitionStart}
        onTransitionComplete={() => setIsTransitioning(false)}
      />

      {/* Header */}
      <header className="bg-white px-4 py-4">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <Button variant="ghost" size="icon" className="-ml-2">
            <Menu className="w-6 h-6 text-gray-600" />
          </Button>
          <Button
            onClick={() => navigate('/subscription/plans')}
            variant="ghost"
            size="sm"
            className="rounded-full border border-gray-200 bg-white hover:bg-gray-50 px-4"
          >
            <Sparkles className="w-4 h-4 text-blue-500" />
            <span className="text-gray-700 font-medium">Upgrade</span>
          </Button>
          <Avatar className="w-10 h-10 cursor-pointer" onClick={() => navigate('/profile')}>
            <AvatarImage src={user?.avatar_url} />
            <AvatarFallback>{user?.display_name?.[0] || 'U'}</AvatarFallback>
          </Avatar>
        </div>
      </header>

      {/* Main Content Container with Gray Background */}
      <div className="flex-1 bg-gray-100 rounded-[40px] pt-8 pb-6 m-2 flex flex-col">
         <div className="flex justify-center">
              <img src={Logo} alt="JustTalk AI" className="h-8" />
            </div>
        {/* Main Content - Centered */}
        <main className="flex-1 flex flex-col justify-center max-w-2xl mx-auto px-6 w-full">
          {/* Greeting */}
          <div className="text-center mb-12">
            {userLoading ? (
              <div className="text-gray-400">Loading...</div>
            ) : (
              <>
                <h1 className="text-4xl font-semibold text-gray-900">
                  Good to see you,
                </h1>
                <h2 className="text-4xl font-semibold text-gray-400 mb-6">
                  {user?.display_name || 'Student'}.
                </h2>
                <p className="text-gray-500 text-base">
                  JustTalk AI your personal AI Teacher.
                </p>
              </>
            )}
          </div>

          {/* Scenario Cards */}
          <div className="mb-6">
            <div className="flex flex-wrap gap-3 justify-center">
              {(agentConfig?.learning_goals || ['conversation']).map((goal: string) => (
                <Card
                  key={goal}
                  className="px-3 py-1 cursor-pointer hover:shadow-md hover:border-gray-300 transition-all bg-white border border-gray-200 shadow-sm"
                  onClick={() => handleStartScenario(goal)}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">{SCENARIO_ICONS[goal]}</span>
                    <p className="text-base font-normal text-gray-700">{SCENARIO_NAMES[goal]}</p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </main>

        {/* Bottom Input Bar - Inside Gray Container */}
        <div className="px-5 pb-0">
          <div className="max-w-2xl mx-auto">
            <Card className="shadow-lg border-gray-200 rounded-3xl">
            <div className="flex flex-col gap-0 px-5 py-4">
              <textarea
                placeholder="How can I help you today?"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onFocus={() => navigate('/ai-chat/conversation/new')}
                rows={2}
                className="w-full bg-transparent outline-none text-gray-900 placeholder:text-gray-400 text-base resize-none"
              />
              
              <div className="flex items-center justify-between">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                      <Settings2 className="w-6 h-6" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    className="w-40 rounded-2xl" 
                    align="start" 
                    side="top"
                    sideOffset={12}
                  >
                    <DropdownMenuItem
                      onClick={() => navigate('/ai-chat')}
                      className="flex items-center gap-3 px-3 py-1.5 cursor-pointer"
                    >
                      <MessageSquare className="w-5 h-5 text-gray-600" />
                      <span className="text-sm font-medium text-gray-700">Chat</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => navigate('/role-plays')}
                      className="flex items-center gap-3 px-3 py-1.5 cursor-pointer"
                    >
                      <MessageCircle className="w-5 h-5 text-gray-600" />
                      <span className="text-sm font-medium text-gray-700">Role-plays</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => navigate('/dictionary')}
                      className="flex items-center gap-3 px-3 py-1.5 cursor-pointer"
                    >
                      <BookOpen className="w-5 h-5 text-gray-600" />
                      <span className="text-sm font-medium text-gray-700">Dictionary</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => navigate('/profile')}
                      className="flex items-center gap-3 px-3 py-1.5 cursor-pointer"
                    >
                      <User className="w-5 h-5 text-gray-600" />
                      <span className="text-sm font-medium text-gray-700">Profile</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <button
                  onClick={handleVoiceClick}
                  ref={voiceButtonRef}
                  className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-all hover:scale-105 active:scale-95"
                >
                  <img src={LogoBars} alt="Voice" className="w-4 h-4 brightness-0 invert" />
                </button>
              </div>
            </div>
          </Card>
        </div>
        </div>
      </div>
    </div>
  );
}
