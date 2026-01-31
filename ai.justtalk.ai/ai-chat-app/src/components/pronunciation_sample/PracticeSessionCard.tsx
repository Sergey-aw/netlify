/**
 * Phase 7.2: Practice Session Card
 * Shows active practice sessions with progress
 * Uses unified useStartIPAPractice action
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Play, CheckCircle, Clock, Mic, Loader2, Pencil } from 'lucide-react';
import { useActivePracticeSessions } from './hooks/usePronunciationData';
import { useStartIPAPractice } from './hooks/useStartIPAPractice';
import { formatDistanceToNow } from 'date-fns';
import type { ActivePracticeSession } from './types';

interface PracticeSessionCardProps {
  studentId: string;
  onContinueSession?: (session: ActivePracticeSession) => void;
  onSessionCreated?: (sessionId: string, targets: string[]) => void;
  onChooseDifferent?: () => void;
  disabled?: boolean;
  disabledReason?: string;
}

export function PracticeSessionCard({ 
  studentId, 
  onContinueSession, 
  onSessionCreated,
  onChooseDifferent,
  disabled = false,
  disabledReason: externalDisabledReason
}: PracticeSessionCardProps) {
  const { data: sessions, isLoading: isLoadingSessions } = useActivePracticeSessions(studentId);
  
  // Use the unified practice action
  const { 
    startPracticeAsync, 
    isPending, 
    canStartPractice, 
    disabledReason: practiceDisabledReason,
    candidateCount
  } = useStartIPAPractice(studentId);

  // Combine external disabled state with practice eligibility
  const effectivelyDisabled = disabled || !canStartPractice || isPending;
  const effectiveDisabledReason = disabled 
    ? externalDisabledReason 
    : practiceDisabledReason;

  const handleStartNewSession = async () => {
    const result = await startPracticeAsync(undefined);
    
    if (result.status === 'success') {
      onSessionCreated?.(result.sessionId, result.targets);
    }
  };

  if (isLoadingSessions) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="space-y-3">
            <div className="h-4 w-32 bg-muted animate-pulse rounded" />
            <div className="h-3 w-48 bg-muted animate-pulse rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // No active sessions
  if (!sessions || sessions.length === 0) {
    return (
      <Card className={effectivelyDisabled ? "border-dashed opacity-70" : "border-dashed"}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Mic className="h-5 w-5 text-muted-foreground" />
            Practice Sessions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {effectivelyDisabled && effectiveDisabledReason ? (
            <p className="text-sm text-muted-foreground">
              {effectiveDisabledReason}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              No active practice sessions. 
              {candidateCount > 0 
                ? ` Start one to practice ${candidateCount} sounds that need attention.`
                : ' Complete the baseline workout to identify sounds to practice.'}
            </p>
          )}
          <Button 
            onClick={handleStartNewSession} 
            variant="outline" 
            className="w-full"
            disabled={effectivelyDisabled}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Session...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Start Practice Session
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Has active sessions
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Mic className="h-5 w-5 text-primary" />
            Practice Sessions
          </CardTitle>
          {/* Don't show "+ New" when there's already an active session */}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {sessions.map((session) => (
          <SessionItem
            key={session.session_id}
            session={session}
            onContinue={onContinueSession}
            onChooseDifferent={onChooseDifferent}
          />
        ))}
      </CardContent>
    </Card>
  );
}

interface SessionItemProps {
  session: ActivePracticeSession;
  onContinue?: (session: ActivePracticeSession) => void;
  onChooseDifferent?: () => void;
}

function SessionItem({ session, onContinue, onChooseDifferent }: SessionItemProps) {
  const isInProgress = session.status === 'in_progress';
  const isPending = session.status === 'pending';
  const canChangeSounds = isPending && session.progress_percent === 0;

  return (
    <div className="p-3 rounded-lg border border-border/50 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isInProgress ? (
            <Clock className="h-4 w-4 text-amber-500" />
          ) : isPending ? (
            <Play className="h-4 w-4 text-primary" />
          ) : (
            <CheckCircle className="h-4 w-4 text-green-500" />
          )}
          <span className="text-sm font-medium">
            {session.target_phonemes.map(p => `/${p}/`).join(', ')}
          </span>
        </div>
        <Badge variant={isInProgress ? 'default' : 'secondary'} className="text-xs">
          {session.ui_status === 'ready_to_start' ? 'Ready' : 
           session.ui_status === 'in_progress' ? 'In Progress' : 
           session.ui_status}
        </Badge>
      </div>

      {/* Progress */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{session.completed_items} of {session.total_items} items</span>
          <span>{session.progress_percent}%</span>
        </div>
        <Progress value={session.progress_percent} className="h-1.5" />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Created {formatDistanceToNow(new Date(session.created_at), { addSuffix: true })}
        </span>
        <div className="flex items-center gap-2">
          {/* Choose Different - only when session hasn't started */}
          {canChangeSounds && onChooseDifferent && (
            <Button 
              size="sm" 
              variant="ghost"
              onClick={onChooseDifferent}
            >
              <Pencil className="mr-1 h-3 w-3" />
              Change
            </Button>
          )}
          {onContinue && (isInProgress || isPending) && (
            <Button 
              size="sm" 
              variant={isInProgress ? 'default' : 'outline'}
              onClick={() => onContinue(session)}
            >
              {isInProgress ? 'Continue' : 'Start'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
