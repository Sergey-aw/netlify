/**
 * Phase 9: Baseline Prompt Card
 * Pre-baseline state - prompts user to start baseline workout
 * Replaces CalibrationPromptCard for the new baseline flow
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Mic, Target } from 'lucide-react';

interface BaselinePromptCardProps {
  onStartBaseline: () => void;
  isStarting?: boolean;
}

export function BaselinePromptCard({ onStartBaseline, isStarting }: BaselinePromptCardProps) {
  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Target className="h-5 w-5 text-amber-500" />
            Baseline Workout
          </CardTitle>
          <Badge variant="outline" className="border-amber-500/50 text-amber-600">
            Not Started
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Complete a quick 10-sentence workout to discover your pronunciation patterns.
          This establishes your baseline and identifies which sounds to focus on.
        </p>
        <div className="bg-muted/50 p-3 rounded-lg">
          <p className="text-sm font-medium mb-2">What to expect:</p>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Read 10 short sentences aloud</li>
            <li>Takes about 3-5 minutes</li>
            <li>Your Focus Sounds are identified automatically</li>
          </ul>
        </div>
        <Button 
          onClick={onStartBaseline} 
          className="w-full" 
          disabled={isStarting}
        >
          <Mic className="mr-2 h-4 w-4" />
          {isStarting ? 'Starting...' : 'Start Baseline Workout'}
        </Button>
      </CardContent>
    </Card>
  );
}
