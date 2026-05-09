import { useNavigate, useLocation } from 'react-router-dom';
import { MessageCircle, BookOpen, User, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    {
      path: '/ai-chat',
      icon: MessageSquare,
      label: 'Chat',
    },
    {
      path: '/role-plays',
      icon: MessageCircle,
      label: 'Role-plays',
    },
    {
      path: '/dictionary',
      icon: BookOpen,
      label: 'Vocabulary Builder',
    },
    {
      path: '/profile',
      icon: User,
      label: 'Profile',
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 z-40">
      <div className="max-w-4xl mx-auto flex items-center justify-around">
        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.path);
          const Icon = item.icon;
          
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                'flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors',
                isActive
                  ? 'text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              <Icon className="w-6 h-6" />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
