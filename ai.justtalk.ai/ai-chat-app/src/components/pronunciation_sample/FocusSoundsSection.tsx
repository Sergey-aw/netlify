/**
 * Phase 8.1: Focus Sounds Section
 * Unified display of pronunciation focus sounds (read-only)
 * Replaces redundant PronunciationOverviewCard + ProblemSoundsList
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Target } from 'lucide-react';
import { useFocusSounds, type FocusSound } from './hooks/useFocusSounds';
import { cn } from '@/lib/utils';

interface FocusSoundsSectionProps {
  studentId: string;
}

export function FocusSoundsSection({ studentId }: FocusSoundsSectionProps) {
  const { focusSounds, totalCandidates, isLoading, isEmpty } = useFocusSounds(studentId, 5);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Your Focus Sounds
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="flex flex-col items-center justify-center p-4 rounded-lg border bg-muted/30 animate-pulse"
              >
                <div className="h-8 w-12 bg-muted rounded mb-2" />
                <div className="h-4 w-16 bg-muted rounded mb-1" />
                <div className="h-3 w-10 bg-muted rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty state - all sounds on track
  if (isEmpty) {
    return (
      <Card className="border-green-500/30 bg-green-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Target className="h-5 w-5 text-green-600 dark:text-green-400" />
            Your Focus Sounds
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <CheckCircle className="h-4 w-4" />
            <span>Key sounds are on track. Keep practicing to maintain progress.</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Your Focus Sounds
            </CardTitle>
            <CardDescription className="mt-1">
              These sounds need the most attention
            </CardDescription>
          </div>
          {totalCandidates > 5 && (
            <Badge variant="secondary" className="text-xs">
              Showing 5 of {totalCandidates}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {focusSounds.map((sound) => (
            <FocusSoundTile key={sound.ipaSymbol} sound={sound} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface FocusSoundTileProps {
  sound: FocusSound;
}

function FocusSoundTile({ sound }: FocusSoundTileProps) {
  const isCritical = sound.severityBucket === 'critical';

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-4 rounded-lg border transition-colors",
        isCritical
          ? "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800"
          : "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800"
      )}
    >
      {/* IPA Symbol */}
      <span className="font-mono text-2xl font-semibold">
        {sound.ipaSymbol}
      </span>

      {/* Severity Badge */}
      <Badge
        variant="outline"
        className={cn(
          "mt-2 text-xs",
          isCritical
            ? "border-red-300 text-red-700 dark:border-red-700 dark:text-red-400"
            : "border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400"
        )}
      >
        {sound.severityLabel}
      </Badge>

      {/* Display Score */}
      <span
        className={cn(
          "text-lg font-medium mt-2",
          isCritical
            ? "text-red-600 dark:text-red-400"
            : "text-amber-600 dark:text-amber-400"
        )}
      >
        {sound.displayScore}%
      </span>

      {/* Example Word */}
      {sound.exampleWord && (
        <span className="text-xs text-muted-foreground mt-1 italic truncate max-w-full">
          "{sound.exampleWord}"
        </span>
      )}
    </div>
  );
}
