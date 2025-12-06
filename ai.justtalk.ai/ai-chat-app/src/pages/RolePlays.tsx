import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, ChevronRight, Clock, Star } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BottomNav } from '@/components/BottomNav';

interface RolePlay {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  duration: string;
  icon: string;
  isPopular?: boolean;
}

const rolePlayScenarios: RolePlay[] = [
  {
    id: '1',
    title: 'Job Interview',
    description: 'Practice answering common interview questions',
    category: 'Career',
    difficulty: 'Intermediate',
    duration: '10-15 min',
    icon: '💼',
    isPopular: true,
  },
  {
    id: '2',
    title: 'Restaurant Order',
    description: 'Order food and interact with a waiter',
    category: 'Daily Life',
    difficulty: 'Beginner',
    duration: '5-10 min',
    icon: '🍽️',
    isPopular: true,
  },
  {
    id: '3',
    title: 'Travel Check-in',
    description: 'Check in at a hotel and ask for amenities',
    category: 'Travel',
    difficulty: 'Beginner',
    duration: '5-10 min',
    icon: '✈️',
  },
  {
    id: '4',
    title: 'Business Meeting',
    description: 'Present ideas and discuss with colleagues',
    category: 'Career',
    difficulty: 'Advanced',
    duration: '15-20 min',
    icon: '📊',
  },
  {
    id: '5',
    title: 'Doctor Visit',
    description: 'Describe symptoms and understand medical advice',
    category: 'Healthcare',
    difficulty: 'Intermediate',
    duration: '10-15 min',
    icon: '🏥',
  },
  {
    id: '6',
    title: 'Shopping',
    description: 'Ask for products and negotiate prices',
    category: 'Daily Life',
    difficulty: 'Beginner',
    duration: '5-10 min',
    icon: '🛍️',
  },
];

export default function RolePlays() {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categories = ['All', 'Career', 'Daily Life', 'Travel', 'Healthcare'];

  const filteredScenarios =
    selectedCategory === 'All'
      ? rolePlayScenarios
      : rolePlayScenarios.filter((rp) => rp.category === selectedCategory);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Beginner':
        return 'bg-green-100 text-green-700';
      case 'Intermediate':
        return 'bg-yellow-100 text-yellow-700';
      case 'Advanced':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24 page-enter">
      {/* Header */}
      <header className="bg-white px-4 py-6 border-b">
        <h1 className="text-2xl font-bold mb-2">Role-play Scenarios</h1>
        <p className="text-sm text-muted-foreground">
          Practice real-life conversations with AI
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
              className="rounded-full whitespace-nowrap"
            >
              {category}
            </Button>
          ))}
        </div>

        {/* Role-play Cards */}
        <div className="space-y-4">
          {filteredScenarios.map((rolePlay) => (
            <Card
              key={rolePlay.id}
              className="p-4 cursor-pointer hover:shadow-md hover:border-primary transition-all"
              onClick={() => navigate('/ai-chat/conversation/new', {
                state: { rolePlay }
              })}
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="text-4xl flex-shrink-0">{rolePlay.icon}</div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-base">{rolePlay.title}</h3>
                      {rolePlay.isPopular && (
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      )}
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  </div>

                  <p className="text-sm text-muted-foreground mb-3">
                    {rolePlay.description}
                  </p>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant="secondary"
                      className={getDifficultyColor(rolePlay.difficulty)}
                    >
                      {rolePlay.difficulty}
                    </Badge>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>{rolePlay.duration}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {rolePlay.category}
                    </Badge>
                  </div>
                </div>

                {/* Play Button */}
                <Button
                  size="icon"
                  className="rounded-full flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate('/ai-chat/conversation/new', {
                      state: { rolePlay }
                    });
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
