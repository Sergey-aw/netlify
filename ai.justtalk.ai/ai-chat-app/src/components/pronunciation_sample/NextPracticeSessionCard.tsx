/**
 * Phase 8.4: Next Practice Session Card
 * Shows the suggested 2 target phonemes for the next practice session
 * Allows user to start practice or choose different sounds
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Loader2, Pencil, RotateCcw, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { IPAPracticeCandidate } from './hooks/useIPAPracticeCandidates';

interface NextPracticeSessionCardProps {
  targets: string[];
  targetCandidates: IPAPracticeCandidate[];
  mode: 'auto' | 'manual';
  isStarting: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onStartPractice: () => void;
  onChooseDifferent: () => void;
  onResetToAuto?: () => void;
}

export function NextPracticeSessionCard({
  targets,
  targetCandidates,
  mode,
  isStarting,
  disabled = false,
  disabledReason,
  onStartPractice,
  onChooseDifferent,
  onResetToAuto,
}: NextPracticeSessionCardProps) {
  if (targets.length === 0) {
    return null;
  }

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Next Practice Session
          </CardTitle>
          {mode === 'manual' && (
            <Badge variant="secondary" className="text-xs">
              Custom Selection
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Target Phonemes */}
        <div className="flex gap-3">
          {targetCandidates.map((candidate, idx) => (
            <PhonemeTargetTile 
              key={candidate.ipa_symbol} 
              candidate={candidate} 
              index={idx + 1}
            />
          ))}
        </div>

        {/* Disabled reason */}
        {disabled && disabledReason && (
          <p className="text-sm text-muted-foreground">{disabledReason}</p>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            onClick={onStartPractice}
            disabled={disabled || isStarting}
            className="flex-1"
          >
            {isStarting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Session...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Start Practice
              </>
            )}
          </Button>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onChooseDifferent}
              disabled={disabled || isStarting}
              className="flex-1 sm:flex-initial"
            >
              <Pencil className="mr-2 h-4 w-4" />
              Choose Different
            </Button>
            
            {mode === 'manual' && onResetToAuto && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onResetToAuto}
                disabled={disabled || isStarting}
                title="Reset to auto-suggested sounds"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface PhonemeTargetTileProps {
  candidate: IPAPracticeCandidate;
  index: number;
}

function PhonemeTargetTile({ candidate, index }: PhonemeTargetTileProps) {
  const isCritical = candidate.severity_bucket === 'critical';
  const displayScore = Math.round(candidate.avg_score || 0);

  return (
    <div
      className={cn(
        "flex-1 flex flex-col items-center justify-center p-4 rounded-lg border transition-colors",
        isCritical
          ? "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800"
          : "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800"
      )}
    >
      {/* Target Label */}
      <span className="text-xs text-muted-foreground mb-1">
        Target {index}
      </span>

      {/* IPA Symbol */}
      <span className="font-mono text-3xl font-semibold">
        {candidate.ipa_symbol}
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
        {isCritical ? 'Critical' : 'Warning'}
      </Badge>

      {/* Accuracy Score */}
      <span
        className={cn(
          "text-lg font-medium mt-2",
          isCritical
            ? "text-red-600 dark:text-red-400"
            : "text-amber-600 dark:text-amber-400"
        )}
      >
        {displayScore}%
      </span>

      {/* Example Word */}
      {candidate.example_words?.[0] && (
        <span className="text-xs text-muted-foreground mt-1 italic">
          "{candidate.example_words[0]}"
        </span>
      )}
    </div>
  );
}
