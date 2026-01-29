import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCefrLevelColor, formatPoints } from '@/lib/vocabulary-utils';
import { ActivationDots } from './ActivationDots';
import type { FocusSetWord } from '@/hooks/useFocusSet';

interface FocusSetCardProps {
  word: FocusSetWord;
  onRemove?: (goalId: string) => void;
}

export function FocusSetCard({ word, onRemove }: FocusSetCardProps) {
  const points = word.focus_lesson_count || 0;
  const showPoints = points > 0;

  return (
    <Card
      className={cn(
        "p-4 transition-all hover:shadow-md relative group",
        word.is_stable && "border-green-500/50 bg-green-50/30 dark:bg-green-950/10"
      )}
    >
      {/* Remove button - shows on hover */}
      {onRemove && (
        <Button
          size="icon"
          variant="ghost"
          onClick={() => onRemove(word.id)}
          className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="h-3 w-3" />
        </Button>
      )}

      <div className="space-y-3">
        {/* Word and CEFR Badge - on one line, badge aligned right */}
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {word.lemma}
          </h3>
          {word.cefr_level && (
            <Badge className={cn("text-xs", getCefrLevelColor(word.cefr_level))}>
              {word.cefr_level}
            </Badge>
          )}
        </div>

        {/* Bottom row: Dots and Points */}
        <div className="flex items-center justify-between">
          <ActivationDots count={word.lesson_count} />
          
            {/* Focus points earned */}
        {word.focus_lesson_count > 0 && (
          <span className="text-sm font-semibold text-[hsl(var(--brand-blue))]">
            {formatPoints(word.focus_lesson_count)}
          </span>
        )}

        </div>

     
        {/* Stable indicator */}
        {word.is_stable && (
          <div className="text-xs text-green-600 dark:text-green-400 font-medium">
            ✓ Stable
          </div>
        )}
      </div>
    </Card>
  );
}
