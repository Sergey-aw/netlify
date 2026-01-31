/**
 * Phase 7: Pronunciation Overview Card
 * High-level summary using IPA error aggregation data
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, Volume2 } from 'lucide-react';
import { useIPAOverviewStats, useProblemIPAPhonemes } from './hooks/useIPAErrorSummary';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface PronunciationOverviewCardProps {
  studentId: string;
  onViewDetails?: () => void;
}

export function PronunciationOverviewCard({ studentId, onViewDetails }: PronunciationOverviewCardProps) {
  const { stats, isLoading: statsLoading } = useIPAOverviewStats(studentId);
  const { data: problemPhonemes, isLoading: phonemesLoading } = useProblemIPAPhonemes(studentId);

  const isLoading = statsLoading || phonemesLoading;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="space-y-4">
            <div className="h-6 w-48 bg-muted animate-pulse rounded" />
            <div className="flex gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 w-10 bg-muted animate-pulse rounded-full" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No data yet - need to complete baseline workout
  if (!stats.hasData) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Volume2 className="h-5 w-5 text-muted-foreground" />
            Pronunciation Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Complete the baseline workout to see your pronunciation insights.
          </p>
        </CardContent>
      </Card>
    );
  }

  const hasProblemSounds = problemPhonemes && problemPhonemes.length > 0;

  return (
    <Card 
      className={cn(
        "transition-colors",
        onViewDetails && "cursor-pointer hover:border-primary/50"
      )} 
      onClick={onViewDetails}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Volume2 className="h-5 w-5 text-primary" />
            Pronunciation Insights
          </CardTitle>
          {stats.lastUpdated && (
            <span className="text-xs text-muted-foreground">
              Updated {formatDistanceToNow(new Date(stats.lastUpdated), { addSuffix: true })}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Problem sounds preview */}
        {hasProblemSounds ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span>
                {problemPhonemes.length} sound{problemPhonemes.length !== 1 ? 's' : ''} need practice
              </span>
            </div>
            
            {/* IPA sound tiles */}
            <div className="flex flex-wrap gap-2">
              {problemPhonemes.slice(0, 5).map((phoneme) => (
                <div
                  key={phoneme.ipa_symbol}
                  className={cn(
                    "flex flex-col items-center justify-center min-w-[56px] p-2 rounded-lg border",
                    phoneme.severity_bucket === 'critical' 
                      ? "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800"
                      : "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800"
                  )}
                >
                  <span className="font-mono text-lg font-semibold">
                    {phoneme.ipa_symbol}
                  </span>
                  <span className={cn(
                    "text-xs font-medium",
                    phoneme.severity_bucket === 'critical' ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"
                  )}>
                    {Math.round(phoneme.avg_score || 0)}%
                  </span>
                </div>
              ))}
              {problemPhonemes.length > 5 && (
                <div className="flex items-center justify-center min-w-[56px] p-2 rounded-lg border bg-muted/50">
                  <span className="text-sm text-muted-foreground">
                    +{problemPhonemes.length - 5}
                  </span>
                </div>
              )}
            </div>

            {/* Example words */}
            {problemPhonemes[0]?.example_words && problemPhonemes[0].example_words.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Found in: {problemPhonemes[0].example_words.slice(0, 3).join(', ')}
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <CheckCircle className="h-4 w-4" />
            <span>All sounds are on track! Keep practicing to maintain your skills.</span>
          </div>
        )}

        {/* Stats summary */}
        <div className="flex gap-3 pt-2 border-t">
          <Badge variant="outline" className="text-xs">
            {stats.totalPhonemes} sounds tracked
          </Badge>
          {stats.criticalCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {stats.criticalCount} critical
            </Badge>
          )}
          {stats.warningCount > 0 && (
            <Badge className="text-xs bg-amber-500 hover:bg-amber-600">
              {stats.warningCount} warning
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}