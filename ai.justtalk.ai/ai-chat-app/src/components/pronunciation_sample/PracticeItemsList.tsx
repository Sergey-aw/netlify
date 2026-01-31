/**
 * Phase 6: Practice Items List
 * Shows individual practice items within a session
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, Circle, PlayCircle, RotateCcw } from 'lucide-react';
import { usePracticeItemProgress } from './hooks/usePronunciationData';
import type { PracticeItemProgress } from './types';
import { cn } from '@/lib/utils';

interface PracticeItemsListProps {
  sessionId: string;
  onPracticeItem?: (item: PracticeItemProgress) => void;
  currentItemId?: string;
}

export function PracticeItemsList({ 
  sessionId, 
  onPracticeItem,
  currentItemId 
}: PracticeItemsListProps) {
  const { data: items, isLoading } = usePracticeItemProgress(sessionId);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 p-2">
                <div className="h-6 w-6 rounded-full bg-muted animate-pulse" />
                <div className="h-4 w-24 bg-muted animate-pulse rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!items || items.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center">
          <p className="text-sm text-muted-foreground">No practice items in this session.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">Practice Words</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => (
          <PracticeItem
            key={item.item_id}
            item={item}
            isActive={item.item_id === currentItemId}
            onPractice={onPracticeItem}
          />
        ))}
      </CardContent>
    </Card>
  );
}

interface PracticeItemProps {
  item: PracticeItemProgress;
  isActive: boolean;
  onPractice?: (item: PracticeItemProgress) => void;
}

function PracticeItem({ item, isActive, onPractice }: PracticeItemProps) {
  const StatusIcon = item.item_status === 'mastered' 
    ? CheckCircle 
    : item.item_status === 'attempted' 
      ? RotateCcw 
      : Circle;

  const statusColor = item.item_status === 'mastered'
    ? 'text-green-500'
    : item.item_status === 'attempted'
      ? 'text-amber-500'
      : 'text-muted-foreground';

  const difficultyLabel = 
    item.difficulty_tier === 1 ? 'Easy' :
    item.difficulty_tier === 2 ? 'Medium' : 'Hard';

  return (
    <div 
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border transition-all",
        isActive 
          ? "border-primary bg-primary/5" 
          : "border-border/50 hover:border-border",
        onPractice && "cursor-pointer"
      )}
      onClick={() => onPractice?.(item)}
    >
      {/* Status Icon */}
      <StatusIcon className={cn("h-5 w-5 shrink-0", statusColor)} />

      {/* Word */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">{item.word_text}</span>
          <span className="text-xs text-muted-foreground font-mono">
            {item.word_ipa}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <Badge variant="outline" className="text-xs py-0 px-1">
            {difficultyLabel}
          </Badge>
          {item.attempt_count > 0 && (
            <span className="text-xs text-muted-foreground">
              {item.attempt_count} attempt{item.attempt_count !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Score */}
      {item.latest_score !== null && (
        <div className="text-right shrink-0">
          <span className={cn(
            "text-lg font-semibold",
            item.latest_was_correct ? "text-green-600" : "text-amber-600"
          )}>
            {Math.round(item.latest_score)}
          </span>
        </div>
      )}

      {/* Play Button */}
      {onPractice && item.item_status !== 'mastered' && (
        <Button
          size="sm"
          variant="ghost"
          className="shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onPractice(item);
          }}
        >
          <PlayCircle className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
}
