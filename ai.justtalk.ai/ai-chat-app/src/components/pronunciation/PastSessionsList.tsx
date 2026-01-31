import { useState } from 'react';
import { format } from 'date-fns';
import { ChevronDown, ChevronRight, CheckCircle, XCircle, History } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useCompletedPracticeSessions } from '@/hooks/useCompletedPracticeSessions';
import type { CompletedPracticeSession } from '@/hooks/useCompletedPracticeSessions';

interface PastSessionsListProps {
  studentId: string;
  limit?: number;
}

const getScoreColor = (score: number | null) => {
  if (score === null) return 'text-muted-foreground';
  if (score >= 80) return 'text-green-500';
  if (score >= 60) return 'text-amber-600';
  return 'text-red-600';
};

function PastSessionCard({ session }: { session: CompletedPracticeSession }) {
  const [isOpen, setIsOpen] = useState(false);

  const completedDate = session.completed_at
    ? format(new Date(session.completed_at), 'MMM d, yyyy')
    : 'Unknown';

  const completedTime = session.completed_at
    ? format(new Date(session.completed_at), 'h:mm a')
    : '';

  const items = session.items || [];
  
  // Group items by phoneme
  const itemsByPhoneme = items.reduce((acc, item) => {
    const phoneme = item.target_ipa_symbol;
    if (!acc[phoneme]) {
      acc[phoneme] = [];
    }
    acc[phoneme].push(item);
    return acc;
  }, {} as Record<string, typeof items>);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={cn(
        "transition-all shadow-none border",
        isOpen && "ring-1 ring-primary/20"
      )}>
        <CollapsibleTrigger asChild>
          <CardContent className="py-3 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <div className="flex items-center gap-2">
                  {session.target_phonemes.map((phoneme) => (
                    <Badge key={phoneme} variant="outline" className="font-mono text-base font-medium px-2 py-0.5 bg-slate-100">
                      {phoneme}
                    </Badge>
                  ))}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{completedDate}</p>
                  <p className="text-xs text-muted-foreground">{completedTime}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={cn(
                  "text-base font-medium",
                  getScoreColor(session.overall_avg_score)
                )}>
                  {session.overall_avg_score !== null ? `${session.overall_avg_score}%` : '—'}
                </span>
              </div>
            </div>
          </CardContent>
        </CollapsibleTrigger>

        <CollapsibleContent forceMount>
          <AnimatePresence initial={false}>
            {isOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                style={{ overflow: "hidden" }}
              >
                <CardContent className="pt-0 pb-3 space-y-4">
            {Object.entries(itemsByPhoneme).map(([phoneme, phoneItems]) => (
              <div key={phoneme} className="space-y-2">
                <div className="flex items-center gap-2 pt-2">
                  <span className="font-mono text-lg font-semibold">{phoneme}</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                
                <div className="space-y-2">
                  {/* Words */}
                  {phoneItems
                    .filter(item => item.practice_type === 'word')
                    .map((item, idx) => (
                      <div key={`word-${idx}`} className="flex items-center justify-between text-sm py-1.5 px-2 rounded hover:bg-muted/50">
                        <div className="flex items-center gap-2">
                          {item.was_correct ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600" />
                          )}
                          <span className="font-medium">{item.word_text}</span>
                        </div>
                        <span className={cn("font-medium", getScoreColor(item.pronunciation_score))}>
                          {item.pronunciation_score !== null ? Math.round(item.pronunciation_score) : '—'}
                        </span>
                      </div>
                    ))}
                  
                  {/* Sentences */}
                  {phoneItems
                    .filter(item => item.practice_type === 'sentence')
                    .map((item, idx) => (
                      <div key={`sentence-${idx}`} className="flex items-start justify-between gap-3 text-sm py-2 px-2 rounded">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          {item.was_correct ? (
                            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                          )}
                          <span className="break-words font-medium">
                            {item.reference_sentence || item.word_text}
                          </span>
                        </div>
                        <span className={cn("font-medium flex-shrink-0", getScoreColor(item.pronunciation_score))}>
                          {item.pronunciation_score !== null ? Math.round(item.pronunciation_score) : '—'}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            ))}
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
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
