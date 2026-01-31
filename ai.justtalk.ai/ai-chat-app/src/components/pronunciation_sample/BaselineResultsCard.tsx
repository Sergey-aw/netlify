/**
 * Phase 9: Baseline Results Card
 * Shows baseline workout completion status and scores
 * Displayed after baseline is complete, before practice begins
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, RotateCcw, AlertTriangle, Target } from 'lucide-react';
import { useBaselineSummary } from './hooks/useBaselineSummary';
import { format } from 'date-fns';

interface BaselineResultsCardProps {
  studentId: string;
  onRetakeBaseline?: () => void;
}

export function BaselineResultsCard({ studentId, onRetakeBaseline }: BaselineResultsCardProps) {
  const { summary, phonemeStats, isLoading, hasValidBaseline, needsRetake } = useBaselineSummary(studentId);

  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
            <div className="space-y-2">
              <div className="h-4 w-32 bg-muted animate-pulse rounded" />
              <div className="h-3 w-48 bg-muted animate-pulse rounded" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No baseline completed yet
  if (!summary) {
    return null;
  }

  // Invalid baseline - needs retake
  if (needsRetake) {
    return (
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Baseline Needs Retake
            </CardTitle>
            <Badge variant="outline" className="border-amber-500/50 text-amber-600">
              Incomplete
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            We need a clearer sample to identify your Focus Sounds accurately. 
            Only {summary.counted_sentences} of {summary.total_sentences} sentences met quality standards.
          </p>
          <div className="bg-muted/50 p-3 rounded-lg">
            <p className="text-sm text-muted-foreground">
              For best results, find a quiet space and speak clearly at a natural pace.
            </p>
          </div>
          {onRetakeBaseline && (
            <Button onClick={onRetakeBaseline} className="w-full" variant="outline">
              <RotateCcw className="mr-2 h-4 w-4" />
              Retake Baseline Workout
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // Valid baseline - show results
  const problemPhonemes = phonemeStats.filter(p => p.severity_bucket !== 'stable');
  const criticalCount = phonemeStats.filter(p => p.severity_bucket === 'critical').length;
  const warningCount = phonemeStats.filter(p => p.severity_bucket === 'warning').length;

  return (
    <Card className="border-green-500/30 bg-green-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Baseline Complete
          </CardTitle>
          <Badge variant="outline" className="border-green-500/50 text-green-600">
            Active
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score Summary */}
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="text-center">
            <p className="text-muted-foreground text-xs">Overall</p>
            <p className="text-lg font-semibold">{summary.avg_overall?.toFixed(0) ?? '—'}</p>
          </div>
          <div className="text-center">
            <p className="text-muted-foreground text-xs">Pronunciation</p>
            <p className="text-lg font-semibold">{summary.avg_pronunciation?.toFixed(0) ?? '—'}</p>
          </div>
          <div className="text-center">
            <p className="text-muted-foreground text-xs">Fluency</p>
            <p className="text-lg font-semibold">{summary.avg_fluency?.toFixed(0) ?? '—'}</p>
          </div>
        </div>

        {/* Metadata */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Counted {summary.counted_sentences} of {summary.total_sentences} sentences
          </span>
          <span>
            {format(new Date(summary.completed_at), 'MMM d, yyyy')}
          </span>
        </div>

        {/* Focus Sounds Summary */}
        {problemPhonemes.length > 0 && (
          <div className="bg-muted/50 p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Focus Sounds Identified</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {criticalCount > 0 && `${criticalCount} critical`}
              {criticalCount > 0 && warningCount > 0 && ', '}
              {warningCount > 0 && `${warningCount} need work`}
            </p>
          </div>
        )}

        {/* Retake Option */}
        {onRetakeBaseline && (
          <Button 
            onClick={onRetakeBaseline} 
            variant="ghost" 
            size="sm"
            className="w-full text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Retake Baseline
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
