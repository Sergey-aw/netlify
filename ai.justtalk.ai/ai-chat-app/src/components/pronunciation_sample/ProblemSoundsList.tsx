/**
 * Phase 7.2: Sounds to Practice List
 * Data-driven from pronunciation_ipa_practice_candidates view
 * Uses unified useStartIPAPractice action
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, CheckCircle, Loader2 } from 'lucide-react';
import { useIPAPracticeCandidates, type IPAPracticeCandidate } from './hooks/useIPAPracticeCandidates';
import { useStartIPAPractice } from './hooks/useStartIPAPractice';
import { cn } from '@/lib/utils';

interface ProblemSoundsListProps {
  studentId: string;
  onPracticeStart?: (sessionId: string, targets: string[]) => void;
  maxItems?: number;
}

export function ProblemSoundsList({ 
  studentId, 
  onPracticeStart,
  maxItems = 10 
}: ProblemSoundsListProps) {
  const { data: candidates, isLoading } = useIPAPracticeCandidates(studentId);
  
  // Use the unified practice action
  const { 
    startPracticeAsync, 
    isPending, 
    canStartPractice, 
    disabledReason,
    hasActiveSession 
  } = useStartIPAPractice(studentId);

  // Debug: log the button state on every render
  console.log('[ProblemSoundsList] Render state:', { 
    studentId,
    candidatesCount: candidates?.length,
    isLoading,
    canStartPractice, 
    isPending, 
    hasActiveSession,
    disabledReason,
    buttonDisabled: !canStartPractice || isPending
  });

  const handleStartPractice = async () => {
    console.log('[ProblemSoundsList] Start Practice clicked', { 
      canStartPractice, 
      isPending, 
      hasActiveSession,
      disabledReason 
    });
    
    try {
      const result = await startPracticeAsync(undefined);
      console.log('[ProblemSoundsList] Practice result:', result);
      
      if (result.status === 'success') {
        onPracticeStart?.(result.sessionId, result.targets);
      }
    } catch (error) {
      console.error('[ProblemSoundsList] Practice error:', error);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Sounds to Practice</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 animate-pulse">
                <div className="h-12 w-12 rounded-lg bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-16 bg-muted rounded" />
                  <div className="h-3 w-24 bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // No candidates = all sounds on track
  if (!candidates || candidates.length === 0) {
    return (
      <Card className="border-green-500/30 bg-green-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Sounds to Practice</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <CheckCircle className="h-4 w-4" />
            <span>No sounds need extra attention right now. Keep practicing to maintain your skills!</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const displayCandidates = candidates.slice(0, maxItems);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">
            Sounds to Practice ({candidates.length})
          </CardTitle>
          <Button
            size="sm"
            onClick={() => {
              console.log('[ProblemSoundsList] Button clicked!');
              handleStartPractice();
            }}
            disabled={!canStartPractice || isPending}
            title={disabledReason}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Starting...
              </>
            ) : hasActiveSession ? (
              'Session Active'
            ) : (
              <>
                <Play className="h-4 w-4 mr-1" />
                Start Practice
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {displayCandidates.map((candidate) => (
            <IPASoundTile key={candidate.ipa_symbol} candidate={candidate} />
          ))}
        </div>
        
        {candidates.length > maxItems && (
          <p className="text-xs text-muted-foreground text-center pt-2">
            +{candidates.length - maxItems} more sounds
          </p>
        )}
      </CardContent>
    </Card>
  );
}

interface IPASoundTileProps {
  candidate: IPAPracticeCandidate;
}

function IPASoundTile({ candidate }: IPASoundTileProps) {
  const isCritical = candidate.severity_bucket === 'critical';
  
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-3 rounded-lg border transition-colors",
        isCritical
          ? "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800"
          : "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800"
      )}
    >
      {/* IPA Symbol */}
      <span className="font-mono text-xl font-semibold">
        /{candidate.ipa_symbol}/
      </span>
      
      {/* Score */}
      <span className={cn(
        "text-sm font-medium",
        isCritical ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"
      )}>
        {Math.round(candidate.avg_score || 0)}%
      </span>
      
      {/* Error info */}
      <span className="text-xs text-muted-foreground mt-1">
        {candidate.error_count}/{candidate.total_occurrences} errors
      </span>
      
      {/* Example word */}
      {candidate.example_words && candidate.example_words.length > 0 && (
        <span className="text-xs text-muted-foreground italic truncate max-w-full">
          e.g. "{candidate.example_words[0]}"
        </span>
      )}
    </div>
  );
}
