/**
 * Phase 8.4.1: Legacy Session Banner
 * Shows when there are legacy sessions (>2 phonemes OR >12 items) that need to be archived
 */

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Archive, Loader2 } from 'lucide-react';
import type { ActivePracticeSession } from './types';

interface LegacySessionBannerProps {
  sessions: ActivePracticeSession[];
  onArchive: (sessionId: string) => void;
  onArchiveAll: () => void;
  isArchiving?: boolean;
}

export function LegacySessionBanner({ 
  sessions, 
  onArchive, 
  onArchiveAll,
  isArchiving = false 
}: LegacySessionBannerProps) {
  if (sessions.length === 0) return null;

  return (
    <Card className="border-amber-500/50 bg-amber-500/5">
      <CardContent className="py-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1 space-y-3">
            <div>
              <p className="text-sm font-medium text-foreground">
                {sessions.length === 1 
                  ? 'Legacy practice session detected'
                  : `${sessions.length} legacy practice sessions detected`}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {sessions.length === 1 
                  ? 'This session was created with the old format. Archive it to start a new focused session.'
                  : 'These sessions were created with the old format. Archive them to start new focused sessions.'}
              </p>
            </div>
            
            {/* Show individual sessions if more than one */}
            {sessions.length > 1 && (
              <div className="space-y-2">
                {sessions.map((session) => (
                  <div 
                    key={session.session_id}
                    className="flex items-center justify-between p-2 rounded bg-background/50 border border-border/50"
                  >
                    <div className="text-xs">
                      <span className="font-medium">
                        {session.target_phonemes.map(p => `/${p}/`).join(', ')}
                      </span>
                      <span className="text-muted-foreground ml-2">
                        ({session.total_items} items)
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onArchive(session.session_id)}
                      disabled={isArchiving}
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            
            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onArchiveAll}
                disabled={isArchiving}
                className="text-amber-600 border-amber-500/50 hover:bg-amber-500/10"
              >
                {isArchiving ? (
                  <>
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    Archiving...
                  </>
                ) : (
                  <>
                    <Archive className="mr-2 h-3.5 w-3.5" />
                    {sessions.length === 1 ? 'Archive & Start Fresh' : 'Archive All'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
