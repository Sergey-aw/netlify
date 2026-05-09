import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Lightbulb } from 'lucide-react';
import { getCefrLevelColor } from '@/lib/vocabulary-utils';
import type { VocabRecommendation } from '@/hooks/useVocabRecommendations';
import { cn } from '@/lib/utils';

interface VocabRecommendationsSectionProps {
  recommendations: VocabRecommendation[];
  isLoading: boolean;
  onAddToGoals: (recommendation: VocabRecommendation) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  isAdding: boolean;
}

export function VocabRecommendationsSection({
  recommendations,
  isLoading,
  onAddToGoals,
  onRefresh,
  isRefreshing,
}: VocabRecommendationsSectionProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-[hsl(var(--brand-blue))]" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Recommended for You
            </h2>
          </div>
        </div>
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[hsl(var(--brand-blue))]" />
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
            Finding perfect words for you...
          </p>
        </div>
      </div>
    );
  }

  if (recommendations.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-[hsl(var(--brand-blue))]" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Recommended for You
          </h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="text-gray-600 dark:text-gray-400"
        >
          <RefreshCw className={cn('w-4 h-4 mr-1', isRefreshing && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400">
        Personalized word suggestions based on your interests and learning goals.
      </p>

      {/* Recommendations Grid */}
      <div className="space-y-2">
        {recommendations.map((rec) => (
          <Card 
            key={rec.id} 
            className="p-4 hover:shadow-sm transition-all cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
            onClick={() => onAddToGoals(rec)}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                {/* Word and badges */}
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {rec.lemma}
                  </span>
                  {rec.cefr_level && (
                    <Badge className={cn("text-xs", getCefrLevelColor(rec.cefr_level))}>
                      {rec.cefr_level}
                    </Badge>
                  )}
                </div>

                {/* Reason */}
                {rec.reason && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {rec.reason}
                  </p>
                )}
              </div>

              {/* Add icon */}
              <div className="flex-shrink-0">
                <span className="text-2xl text-gray-600 dark:text-gray-400">+</span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Helper text */}
      <p className="text-xs text-gray-500 dark:text-gray-500 text-center pt-2">
        Add words to your Goal Pool, then promote them to your Focus Set to start tracking progress
      </p>
    </div>
  );
}
