import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Clock, Target } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PracticeSession {
  id: string;
  target_phonemes: string[];
  status: string;
  total_items: number;
  created_at: string;
  completed_items?: number;
}

interface ActiveSessionsListProps {
  sessions: PracticeSession[];
  onSelectSession: (sessionId: string) => void;
}

export function ActiveSessionsList({ sessions, onSelectSession }: ActiveSessionsListProps) {
  if (sessions.length === 0) {
    return null;
  }

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-4">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          You have {sessions.length} active practice session{sessions.length > 1 ? 's' : ''}. Select one to continue.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4">
        {sessions.map((session) => (
          <Card key={session.id} className="hover:border-primary/50 transition-colors">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">Practice Session</CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-1">
                    <Clock className="h-3 w-3" />
                    Started {formatDate(session.created_at)}
                  </CardDescription>
                </div>
                <Badge variant={session.status === 'in_progress' ? 'default' : 'secondary'} className='bg-gray-900'>
                  {session.status === 'in_progress' ? 'In Progress' : 'Pending'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Target sounds:</span>
                <div className="flex gap-1 flex-wrap">
                  {session.target_phonemes.map((phoneme, idx) => (
                    <Badge key={idx} variant="outline" className="font-mono">
                      /{phoneme}/
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-sm text-muted-foreground">
                  {session.total_items} items total
                </span>
                <Button 
                  onClick={() => onSelectSession(session.id)}
                  variant="outline"
                >
                  Continue Practice
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
