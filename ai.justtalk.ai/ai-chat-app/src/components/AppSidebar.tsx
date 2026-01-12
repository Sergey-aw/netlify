import { useNavigate } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useCallback, useState } from 'react';
import {
  History,
  Star,
  MessageSquare,
  BookOpen,
  User,
  Home,
  Loader2,
} from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
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

// Helper function to convert image URL to use _avatar suffix
const getAvatarUrl = (imageUrl: string | null | undefined): string | undefined => {
  if (!imageUrl) return undefined;
  
  // Split the path and filename
  const lastDotIndex = imageUrl.lastIndexOf('.');
  const lastSlashIndex = imageUrl.lastIndexOf('/');
  
  if (lastDotIndex > lastSlashIndex && lastDotIndex !== -1) {
    const basePath = imageUrl.substring(0, lastDotIndex);
    const extension = imageUrl.substring(lastDotIndex);
    
    // Check if it's a dating_ prefixed image (male characters have _avatar versions)
    const filename = basePath.substring(lastSlashIndex + 1);
    if (filename.startsWith('dating_')) {
      return `${basePath}_avatar${extension}`;
    }
    
    // For other images (female characters: Alina, Clara, Imani, Lucia, Naomi)
    // they don't have _avatar versions, so just return the original
    return imageUrl;
  }
  
  return imageUrl;
};

interface AppSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedConversation?: string | null;
  onConversationClick?: (conversationId: string) => void;
}

export function AppSidebar({ open, onOpenChange, selectedConversation, onConversationClick }: AppSidebarProps) {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

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

  // Get previous conversations with infinite loading
  const {
    data: conversationsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: conversationsLoading,
  } = useInfiniteQuery({
    queryKey: ['conversations', user?.id],
    queryFn: async ({ pageParam = 0 }) => {
      if (!user?.id) return { conversations: [], hasMore: false };
      
      const PAGE_SIZE = 25;
      const offset = pageParam * PAGE_SIZE;
      
      // First, get conversations
      const { data: convData, error: convError, count } = await supabase
        .from('justai_conversations')
        .select('id, title, scenario, created_at, last_message_at, is_voice_session, agent_id, conversation_score', { count: 'exact' })
        .eq('student_id', user.id)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (convError) {
        console.error('Error fetching conversations:', convError);
        throw convError;
      }

      if (!convData || convData.length === 0) return { conversations: [], hasMore: false };

      // Get unique agent IDs
      const agentIds = [...new Set(convData.map(c => c.agent_id).filter(Boolean))];

      // Fetch agent details if there are any agent IDs
      let agentsMap: { [key: string]: any } = {};
      if (agentIds.length > 0) {
        const { data: agentsData, error: agentsError } = await supabase
          .from('justai_agents')
          .select('id, image_url, name')
          .in('id', agentIds);

        if (!agentsError && agentsData) {
          agentsMap = agentsData.reduce((map, agent) => {
            map[agent.id] = agent;
            return map;
          }, {} as { [key: string]: any });
        } else if (agentsError) {
          console.error('Error fetching agents:', agentsError);
        }
      }

      // Merge agent data with conversations
      const result = convData.map(conv => ({
        ...conv,
        justai_agents: conv.agent_id ? agentsMap[conv.agent_id] : null
      }));
      
      const hasMore = count ? offset + PAGE_SIZE < count : false;
      
      return { conversations: result, hasMore };
    },
    getNextPageParam: (lastPage, pages) => {
      return lastPage.hasMore ? pages.length : undefined;
    },
    initialPageParam: 0,
    enabled: !!user?.id,
  });

  // Flatten all pages into a single array
  const conversations = conversationsData?.pages.flatMap(page => page.conversations) ?? [];

  // Setup intersection observer for infinite scroll
  useEffect(() => {
    if (!loadMoreRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    observerRef.current.observe(loadMoreRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${dateStr}, ${time}`;
  };

  const getDateGroup = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'long' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
  };

  // Group conversations by date
  const groupedConversations = conversations?.reduce((groups: { [key: string]: any[] }, conv) => {
    const group = getDateGroup(conv.last_message_at || conv.created_at);
    if (!groups[group]) {
      groups[group] = [];
    }
    groups[group].push(conv);
    return groups;
  }, {}) || {};

  // Remove "Voice Chat: " prefix from title
  const formatTitle = (title: string) => {
    return title?.replace(/^Voice Chat:\s*/i, '') || 'Untitled Conversation';
  };

  const handleNavigate = (path: string) => {
    // Close the sidebar first, then navigate
    onOpenChange(false);
    // Use setTimeout to ensure the sheet closes before navigation
    setTimeout(() => {
      // For home navigation, explicitly signal to clear selection
      if (path === '/ai-chat') {
        navigate(path, { replace: true, state: { clearSelection: true } });
      } else {
        navigate(path, { replace: true });
      }
    }, 100);
  };

  const handleConversationClick = (conversationId: string) => {
    if (onConversationClick) {
      // If callback provided (on home page), use it to select conversation in-page
      onConversationClick(conversationId);
      onOpenChange(false);
    } else {
      // If no callback (on other pages), navigate to home with conversation pre-selected
      onOpenChange(false);
      setTimeout(() => {
        navigate('/ai-chat', { state: { selectedConversation: conversationId } });
      }, 100);
    }
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
                    onClick={() => handleNavigate('/ai-chat/voice/new')}
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
            <SidebarGroupContent className="overflow-y-auto flex-1 min-h-0" ref={scrollRef}>
              {conversationsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : conversations && conversations.length > 0 ? (
                <div className="space-y-4">
                  {Object.entries(groupedConversations).map(([dateGroup, convs]) => (
                    <div key={dateGroup}>
                      <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                        {dateGroup}
                      </div>
                      <SidebarMenu>
                        {(convs as any[]).map((conv) => (
                          <SidebarMenuItem key={conv.id}>
                            <SidebarMenuButton
                              onClick={() => handleConversationClick(conv.id)}
                              isActive={selectedConversation === conv.id}
                              className="h-auto py-2"
                            >
                              <div className="flex items-center gap-3 w-full">
                                <Avatar className="w-8 h-8 flex-shrink-0">
                                  <AvatarImage src={getAvatarUrl(conv.justai_agents?.image_url)} />
                                  <AvatarFallback>
                                    <MessageSquare className="w-4 h-4" />
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <h3 className="font-medium text-sm truncate">
                                      {formatTitle(conv.title)}
                                    </h3>
                                    {conv.conversation_score && (
                                      <Badge variant="secondary" className="rounded-full bg-[hsl(var(--brand-blue))] text-white hover:bg-[hsl(var(--brand-blue))]/90 text-xs px-1.5 py-0 h-5">
                                        {conv.conversation_score}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs opacity-70">
                                    {formatTime(conv.last_message_at || conv.created_at)}
                                  </p>
                                </div>
                              </div>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        ))}
                      </SidebarMenu>
                    </div>
                  ))}
                  
                  {/* Loading indicator for pagination */}
                  <div ref={loadMoreRef} className="py-4 flex items-center justify-center">
                    {isFetchingNextPage && (
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 px-4 text-muted-foreground">
                  <History className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No conversations yet</p>
                </div>
              )}
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarProvider>
      </SheetContent>
    </Sheet>
  );
}
