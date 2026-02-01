import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Lightbulb, Plus } from 'lucide-react';
import { getCefrLevelColor } from '@/lib/vocabulary-utils';
import type { VocabRecommendation } from '@/hooks/useVocabRecommendations';
import { cn } from '@/lib/utils';

interface VocabRecommendationsCardProps {
  recommendations: VocabRecommendation[];
  isLoading: boolean;
  onAddToGoals: (recommendation: VocabRecommendation) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  isAdding: boolean;
}

export function VocabRecommendationsCard({
  recommendations,
  isLoading,
  onAddToGoals,
  onRefresh,
  isRefreshing,
}: VocabRecommendationsCardProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Word Recommendations</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            disabled
            className="h-8 px-2 text-gray-400"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
        <Card className="bg-white border-gray-200 rounded-3xl p-5">
          <div className="text-center py-6">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400" />
            <p className="text-sm text-gray-600 mt-3">Finding perfect words...</p>
          </div>
        </Card>
      </div>
    );
  }

  if (recommendations.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-2">
          <Lightbulb className="w-5 h-5 text-orange-400 mt-1" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Recommended for You</h2>
            <p className="text-xs text-gray-500">Words chosen for you based on your goals and interests and activity</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="h-8 px-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
        >
          <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
        </Button>
      </div>

      {/* Card with Words */}
      <Card className="bg-white border border-gray-200 rounded-3xl p-4 hover:shadow-lg transition-all duration-200 cursor-pointer shadow-none">
        <div className="space-y-0">
          {recommendations.map((rec) => (
            <div
              key={rec.id}
              onClick={() => onAddToGoals(rec)}
              className="rounded-xl p-3 hover:bg-gray-50 transition-all duration-200 cursor-pointer group"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900 group-hover:text-[hsl(var(--brand-blue))] transition-colors">
                      {rec.lemma}
                    </span>
                    {rec.cefr_level && (
                      <Badge className={cn("text-xs", getCefrLevelColor(rec.cefr_level))}>
                        {rec.cefr_level}
                      </Badge>
                    )}
                  </div>
                  {rec.reason && (
                    <p className="text-xs text-gray-600 line-clamp-2">
                      {rec.reason}
                    </p>
                  )}
                </div>
                <div className="flex-shrink-0">
                  <Plus className="w-5 h-5 text-gray-400 hover:text-[hsl(var(--brand-blue))] transition-colors" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <p className="text-xs text-gray-500 text-center mt-4">
          Tap any word to add it to your goals. Explore it in your{' '}
          <span
            onClick={(e) => {
              e.stopPropagation();
              navigate('/dictionary');
            }}
            className="text-gray-900 hover:underline cursor-pointer"
          >
            Vocabulary Builder
          </span>
          
        </p>
      </Card>
    </div>
  );
}
