/**
 * Phase 8.5: Past Session Card Component
 * Displays a single completed practice session in the history list
 */

import { useState } from 'react';
import { format } from 'date-fns';
import { ChevronDown, ChevronRight, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { CompletedPracticeSession, PhonemeScoreSummary } from './hooks/useCompletedPracticeSessions';

interface PastSessionCardProps {
  session: CompletedPracticeSession;
}

const getScoreColor = (score: number | null) => {
  if (score === null) return 'text-muted-foreground';
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-red-600';
};

export function PastSessionCard({ session }: PastSessionCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  const completedDate = session.completed_at
    ? format(new Date(session.completed_at), 'MMM d, yyyy')
    : 'Unknown';

  const completedTime = session.completed_at
    ? format(new Date(session.completed_at), 'h:mm a')
    : '';

  const phonemeScores = session.phoneme_scores_json || [];

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={cn(
        "transition-all",
        isOpen && "ring-1 ring-primary/20"
      )}>
        <CollapsibleTrigger asChild>
          <CardContent className="py-3 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              {/* Left: Date and phonemes */}
              <div className="flex items-center gap-3">
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <div>
                  <p className="text-sm font-medium">{completedDate}</p>
                  <p className="text-xs text-muted-foreground">{completedTime}</p>
                </div>
                <div className="flex gap-1">
                  {session.target_phonemes.map((phoneme) => (
                    <Badge key={phoneme} variant="outline" className="font-mono text-xs">
                      {phoneme}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Right: Overall score */}
              <Badge 
                variant={getScoreBadgeVariant(session.overall_avg_score)}
                className="text-sm"
              >
                {session.overall_avg_score !== null 
                  ? `${Math.round(session.overall_avg_score)}%` 
                  : 'No score'}
              </Badge>
            </div>
          </CardContent>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-4">
            <div className="border-t pt-3 mt-1">
              <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">
                Per-Sound Breakdown
              </h4>
              {phonemeScores.length > 0 ? (
                <div className="space-y-0">
                  {phonemeScores.map((summary) => (
                    <PhonemeScoreRow 
                      key={summary.target_ipa_symbol} 
                      summary={summary} 
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No scores available</p>
              )}

              {/* Legend */}
              <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Volume2 className="h-3 w-3" />
                  <span>Word Avg</span>
                </div>
                <div className="flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  <span>Sentence</span>
                </div>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
