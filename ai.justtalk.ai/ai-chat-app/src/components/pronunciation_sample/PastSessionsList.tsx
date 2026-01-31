/**
 * Phase 8.5: Past Sessions List Component
 * Displays a list of completed practice sessions
 */

import { History, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCompletedPracticeSessions } from './hooks/useCompletedPracticeSessions';
import { PastSessionCard } from './PastSessionCard';

interface PastSessionsListProps {
  studentId: string;
  limit?: number;
}

export function PastSessionsList({ studentId, limit = 10 }: PastSessionsListProps) {
  const { data: sessions, isLoading, error } = useCompletedPracticeSessions(studentId, limit);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" />
            Past Sessions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" />
            Past Sessions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Unable to load session history.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!sessions || sessions.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" />
            Past Sessions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <History className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No completed sessions yet
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Complete your first practice session to see it here
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" />
            Past Sessions
            <span className="text-sm font-normal text-muted-foreground">
              ({sessions.length})
            </span>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {sessions.map((session) => (
          <PastSessionCard key={session.session_id} session={session} />
        ))}
      </CardContent>
    </Card>
  );
}
