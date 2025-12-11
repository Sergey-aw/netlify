import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  History,
  Star,
  MessageSquare,
  BookOpen,
  User,
  Home,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
} from '@/components/ui/sheet';
import {
  SidebarProvider,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { supabase } from '@/lib/supabase';
import Logo from '@/assets/logo.svg';

interface AppSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedConversation?: string | null;
  onConversationClick?: (conversationId: string) => void;
}

export function AppSidebar({ open, onOpenChange, selectedConversation, onConversationClick }: AppSidebarProps) {
  const navigate = useNavigate();

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

  // Get previous conversations
  const { data: conversations } = useQuery({
    queryKey: ['conversations', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('justai_conversations')
        .select('id, title, scenario, created_at, last_message_at, is_voice_session')
        .eq('student_id', user.id)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    onOpenChange(false);
  };

  const handleConversationClick = (conversationId: string) => {
    if (onConversationClick) {
      onConversationClick(conversationId);
    }
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent side="left" className="p-0 w-80">
        <SidebarProvider className="flex flex-col h-full">
          {/* Logo Header */}
          <SidebarHeader className="flex-shrink-0">
            <div className="flex items-center py-2 px-2">
              <img src={Logo} alt="JustTalk AI" className="h-8" />
            </div>
          </SidebarHeader>

          {/* Navigation Menu */}
          <SidebarGroup className="pt-2 flex-shrink-0">
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => handleNavigate('/ai-chat')}
                  >
                    <Home className="w-4 h-4" />
                    <span>Home</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => handleNavigate('/ai-chat/conversation/new')}
                  >
                    <Star className="w-4 h-4" />
                    <span>JustTalk</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => handleNavigate('/role-plays')}
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Role-plays</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => handleNavigate('/dictionary')}
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>Dictionary</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => handleNavigate('/profile')}
                  >
                    <User className="w-4 h-4" />
                    <span>Profile</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarSeparator />

          {/* Conversations Section */}
          <SidebarGroup className="flex-1 min-h-0 flex flex-col">
            <SidebarGroupLabel className="px-2 flex-shrink-0">Conversations</SidebarGroupLabel>
            <SidebarGroupContent className="overflow-y-auto flex-1 min-h-0">
              <SidebarMenu>
                {conversations && conversations.length > 0 ? (
                  conversations.map((conv) => (
                    <SidebarMenuItem key={conv.id}>
                      <SidebarMenuButton
                        onClick={() => handleConversationClick(conv.id)}
                        isActive={selectedConversation === conv.id}
                        className="h-auto py-3"
                      >
                        <div className="flex items-start gap-3 w-full">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-sm truncate">
                              {conv.title || 'Untitled Conversation'}
                            </h3>
                            <p className="text-xs opacity-70">
                              {formatTime(conv.last_message_at || conv.created_at)}
                            </p>
                          </div>
                        </div>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))
                ) : (
                  <div className="text-center py-8 px-4 text-muted-foreground">
                    <History className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No conversations yet</p>
                  </div>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarProvider>
      </SheetContent>
    </Sheet>
  );
}
