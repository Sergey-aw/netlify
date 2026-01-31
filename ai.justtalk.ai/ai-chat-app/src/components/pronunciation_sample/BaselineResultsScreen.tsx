/**
 * Phase 9: Baseline Results Screen
 * Shows after baseline workout completion with scores and Focus Sounds
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Target, RotateCcw, ArrowRight, AlertTriangle } from 'lucide-react';
import { useBaselineSummary, type BaselinePhonemeStats } from './hooks/useBaselineSummary';

interface BaselineResultsScreenProps {
  studentId: string;
  onComplete: () => void;
  onRetake: () => void;
}

function PhonemeChip({ stat }: { stat: BaselinePhonemeStats }) {
  const colorClass = stat.severity_bucket === 'critical' 
    ? 'bg-red-500/10 text-red-600 border-red-500/30'
    : stat.severity_bucket === 'warning'
    ? 'bg-amber-500/10 text-amber-600 border-amber-500/30'
    : 'bg-green-500/10 text-green-600 border-green-500/30';

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${colorClass}`}>
      <span className="font-mono text-lg">{stat.ipa_symbol}</span>
      <div className="text-xs">
        <div className="font-medium">
          {stat.severity_bucket === 'critical' ? 'Critical' : stat.severity_bucket === 'warning' ? 'Needs Work' : 'Good'}
        </div>
        <div className="text-muted-foreground">
          {stat.error_rate.toFixed(0)}% errors
        </div>
      </div>
    </div>
  );
}

export function BaselineResultsScreen({ studentId, onComplete, onRetake }: BaselineResultsScreenProps) {
  const { summary, phonemeStats, isLoading, hasValidBaseline, needsRetake } = useBaselineSummary(studentId);

  if (isLoading) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="py-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading your results...</p>
        </CardContent>
      </Card>
    );
  }

  // Invalid baseline
  if (needsRetake && summary) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="py-8 space-y-4 text-center">
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
            <div className="space-y-2">
              <h3 className="text-xl font-medium">We Need a Clearer Sample</h3>
              <p className="text-muted-foreground text-sm max-w-md mx-auto">
                Only {summary.counted_sentences} of {summary.total_sentences} sentences met quality standards.
                For accurate Focus Sound identification, we need at least 6 clear sentences.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="bg-muted/50 p-4 rounded-lg">
          <p className="text-sm font-medium mb-2">Tips for a better recording:</p>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Find a quiet room with minimal background noise</li>
            <li>Speak clearly at a natural, relaxed pace</li>
            <li>Hold your device at a consistent distance</li>
          </ul>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onComplete} className="flex-1">
            Continue Anyway
          </Button>
          <Button onClick={onRetake} className="flex-1">
            <RotateCcw className="mr-2 h-4 w-4" />
            Retake Workout
          </Button>
        </div>
      </div>
    );
  }

  // Valid baseline - show full results
  const criticalPhonemes = phonemeStats.filter(p => p.severity_bucket === 'critical');
  const warningPhonemes = phonemeStats.filter(p => p.severity_bucket === 'warning');
  const focusPhonemes = [...criticalPhonemes, ...warningPhonemes].slice(0, 5);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Success header */}
      <Card className="border-green-500/30 bg-green-500/5">
        <CardContent className="py-8 space-y-4 text-center">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
          <div className="space-y-2">
            <h3 className="text-xl font-medium">Baseline Complete!</h3>
            <p className="text-muted-foreground text-sm">
              Your pronunciation profile is ready. 
              {summary && ` Analyzed ${summary.counted_sentences} of ${summary.total_sentences} sentences.`}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Score Summary */}
      {summary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your Scores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 bg-muted/30 rounded-lg">
                <p className="text-2xl font-bold">{summary.avg_overall?.toFixed(0) ?? '—'}</p>
                <p className="text-xs text-muted-foreground">Overall</p>
              </div>
              <div className="p-4 bg-muted/30 rounded-lg">
                <p className="text-2xl font-bold">{summary.avg_pronunciation?.toFixed(0) ?? '—'}</p>
                <p className="text-xs text-muted-foreground">Pronunciation</p>
              </div>
              <div className="p-4 bg-muted/30 rounded-lg">
                <p className="text-2xl font-bold">{summary.avg_fluency?.toFixed(0) ?? '—'}</p>
                <p className="text-xs text-muted-foreground">Fluency</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Focus Sounds */}
      {focusPhonemes.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Your Focus Sounds</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Based on your baseline, these sounds would benefit from focused practice:
            </p>
            <div className="flex flex-wrap gap-2">
              {focusPhonemes.map((stat) => (
                <PhonemeChip key={stat.ipa_symbol} stat={stat} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No focus sounds - all good! */}
      {focusPhonemes.length === 0 && (
        <Card className="border-green-500/20">
          <CardContent className="py-6 text-center">
            <p className="text-sm text-muted-foreground">
              Great job! Your pronunciation is solid across all sounds we tested.
              Continue practicing to maintain and improve your skills.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={onRetake} className="flex-1">
          <RotateCcw className="mr-2 h-4 w-4" />
          Retake Baseline
        </Button>
        <Button onClick={onComplete} className="flex-1">
          Start Practicing
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
