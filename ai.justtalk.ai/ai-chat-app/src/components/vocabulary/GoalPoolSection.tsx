import { Card } from '@/components/ui/card';

import { Badge } from '@/components/ui/badge';
import { List } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCefrLevelColor } from '@/lib/vocabulary-utils';
import { ActivationDots } from './ActivationDots';

interface GoalPoolSectionProps {
  words: any[];
  isLoading: boolean;
  onAddToFocus: (goalId: string, lemma: string, cefrLevel: string | null) => void;
  isAdding?: boolean;
}

export function GoalPoolSection({
  words,
  isLoading,
  onAddToFocus,
}: GoalPoolSectionProps) {
  if (isLoading) {
    return (
      <div className="text-center py-6 text-gray-500 dark:text-gray-400">
        Loading goals...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <List className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            All Goals
          </h2>
        </div>
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
          {words.length}
        </span>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400">
        Words you want to learn. Add them to your Focus Set to start tracking progress.
      </p>

      {/* Goal List */}
      <div className="space-y-2">
        {words.map((word) => (
          <Card 
            key={word.id} 
            className="p-4 hover:shadow-sm transition-all cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
            onClick={() => onAddToFocus(word.id, word.lemma, word.cefr_level)}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {word.lemma}
                    </span>
                    {word.cefr_level && (
                      <Badge className={cn("text-xs", getCefrLevelColor(word.cefr_level))}>
                        {word.cefr_level}
                      </Badge>
                    )}
                    <ActivationDots count={word.lesson_count} size="sm" />
                  </div>
                </div>
              </div>

              <div className="flex-shrink-0">
                <span className="text-2xl text-gray-600 dark:text-gray-400">+</span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {words.length === 0 && (
        <div className="text-center py-12">
          <List className="w-16 h-16 text-gray-300 dark:text-gray-700 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">
            No goals yet
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Add words from the Discover tab
          </p>
        </div>
      )}
    </div>
  );
}
