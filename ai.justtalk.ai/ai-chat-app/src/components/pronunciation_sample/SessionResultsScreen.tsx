/**
 * Phase 8.3: Session Results Screen
 * Phase 8.5: Added session lifecycle actions (Finish, Start New, Practice Again)
 * 
 * Shows per-phoneme breakdown after completing all practice items:
 * - Word Average (5 words per phoneme)
 * - Sentence Score (1 sentence per phoneme)
 * - Transfer gap detection
 */

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  ArrowLeft, 
  Trophy, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  CheckCircle,
  Volume2,
  MessageSquare,
  RefreshCw,
  History,
  Loader2,
  Pencil
} from 'lucide-react';
import type { ActivePracticeSession, PracticeItemProgress } from './types';
import { cn } from '@/lib/utils';
import { useCompletePracticeSession } from './hooks/useCompletePracticeSession';

interface RecordedItem {
  itemId: string;
  score: number | null;
  wasCorrect: boolean | null;
}

interface SessionResultsScreenProps {
  session: ActivePracticeSession;
  items: PracticeItemProgress[];
  recordedItems: Map<string, RecordedItem>;
  onBack: () => void;
  onDone: () => void;
  onStartNew?: () => void;
  onPracticeAgain?: (targets: string[]) => void;
  onChooseDifferent?: () => void;
}

interface PhonemeBreakdown {
  phoneme: string;
  wordScores: number[];
  wordAverage: number;
  sentenceScore: number | null;
  hasTransferGap: boolean;
  wordItems: PracticeItemProgress[];
  sentenceItem: PracticeItemProgress | null;
}

const TRANSFER_GAP_THRESHOLD = 15; // If sentence score is this much below word avg

export function SessionResultsScreen({
  session,
  items,
  recordedItems,
  onBack,
  onDone,
  onStartNew,
  onPracticeAgain,
  onChooseDifferent,
}: SessionResultsScreenProps) {
  const [isCompleting, setIsCompleting] = useState(false);
  const { mutateAsync: completeSession } = useCompletePracticeSession();
  // Calculate per-phoneme breakdown
  const phonemeBreakdowns = useMemo<PhonemeBreakdown[]>(() => {
    const breakdownMap = new Map<string, PhonemeBreakdown>();

    for (const phoneme of session.target_phonemes) {
      breakdownMap.set(phoneme, {
        phoneme,
        wordScores: [],
        wordAverage: 0,
        sentenceScore: null,
        hasTransferGap: false,
        wordItems: [],
        sentenceItem: null,
      });
    }

    // Group items by phoneme and type
    for (const item of items) {
      const phoneme = item.target_ipa_symbol;
      if (!phoneme || !breakdownMap.has(phoneme)) continue;

      const breakdown = breakdownMap.get(phoneme)!;
      const recorded = recordedItems.get(item.item_id);
      const score = recorded?.score ?? item.latest_score;

      if (item.practice_type === 'sentence') {
        breakdown.sentenceItem = item;
        if (score !== null) {
          breakdown.sentenceScore = score;
        }
      } else {
        breakdown.wordItems.push(item);
        if (score !== null) {
          breakdown.wordScores.push(score);
        }
      }
    }

    // Calculate averages and detect transfer gaps
    for (const breakdown of breakdownMap.values()) {
      if (breakdown.wordScores.length > 0) {
        breakdown.wordAverage = breakdown.wordScores.reduce((a, b) => a + b, 0) / breakdown.wordScores.length;
      }
      
      if (breakdown.sentenceScore !== null && breakdown.wordAverage > 0) {
        breakdown.hasTransferGap = breakdown.sentenceScore < (breakdown.wordAverage - TRANSFER_GAP_THRESHOLD);
      }
    }

    return Array.from(breakdownMap.values());
  }, [session.target_phonemes, items, recordedItems]);

  // Overall session stats
  const overallStats = useMemo(() => {
    const allScores = Array.from(recordedItems.values())
      .map(r => r.score)
      .filter((s): s is number => s !== null);
    
    const average = allScores.length > 0 
      ? allScores.reduce((a, b) => a + b, 0) / allScores.length 
      : 0;
    
    const correctCount = Array.from(recordedItems.values())
      .filter(r => r.wasCorrect).length;
    
    return {
      average: Math.round(average),
      correctCount,
      totalCount: recordedItems.size,
      correctRate: recordedItems.size > 0 ? Math.round((correctCount / recordedItems.size) * 100) : 0,
    };
  }, [recordedItems]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-red-600';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-500/10';
    if (score >= 60) return 'bg-amber-500/10';
    return 'bg-red-500/10';
  };

  // Complete session and execute callback
  const handleFinishSession = async () => {
    setIsCompleting(true);
    try {
      await completeSession(session.session_id);
      onDone();
    } finally {
      setIsCompleting(false);
    }
  };

  const handleStartNew = async () => {
    setIsCompleting(true);
    try {
      await completeSession(session.session_id);
      onStartNew?.();
    } finally {
      setIsCompleting(false);
    }
  };

  const handleChooseDifferent = async () => {
    setIsCompleting(true);
    try {
      await completeSession(session.session_id);
      onChooseDifferent?.();
    } finally {
      setIsCompleting(false);
    }
  };

  const handlePracticeAgain = async () => {
    setIsCompleting(true);
    try {
      await completeSession(session.session_id);
      onPracticeAgain?.(session.target_phonemes);
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <div className="space-y-4 max-w-md mx-auto">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Practice
      </Button>

      {/* Header */}
      <Card className="border-2">
        <CardContent className="pt-6 text-center">
          <div className={cn(
            "inline-flex items-center justify-center h-16 w-16 rounded-full mb-4",
            overallStats.average >= 80 ? "bg-green-500/10 text-green-600" :
            overallStats.average >= 60 ? "bg-amber-500/10 text-amber-600" :
            "bg-red-500/10 text-red-600"
          )}>
            <Trophy className="h-8 w-8" />
          </div>
          
          <h2 className="text-3xl font-bold mb-1">
            {overallStats.average}
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Average Score
          </p>

          <div className="flex justify-center gap-6 text-sm">
            <div className="text-center">
              <p className="font-semibold text-green-600">{overallStats.correctCount}</p>
              <p className="text-xs text-muted-foreground">Correct</p>
            </div>
            <div className="text-center">
              <p className="font-semibold">{overallStats.totalCount}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            <div className="text-center">
              <p className="font-semibold">{overallStats.correctRate}%</p>
              <p className="text-xs text-muted-foreground">Success Rate</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Per-phoneme breakdown */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground px-1">
          Per-Sound Breakdown
        </h3>

        {phonemeBreakdowns.map((breakdown) => (
          <Card key={breakdown.phoneme}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="font-mono text-lg">{breakdown.phoneme}</span>
                {breakdown.hasTransferGap && (
                  <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-500/10 px-2 py-1 rounded">
                    <AlertTriangle className="h-3 w-3" />
                    Transfer Gap
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Word average */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Volume2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Word Average</span>
                  <span className="text-xs text-muted-foreground">
                    ({breakdown.wordScores.length} words)
                  </span>
                </div>
                <span className={cn(
                  "text-lg font-semibold",
                  getScoreColor(breakdown.wordAverage)
                )}>
                  {Math.round(breakdown.wordAverage)}
                </span>
              </div>

              {/* Word score bar */}
              <Progress 
                value={breakdown.wordAverage} 
                className={cn("h-2", getScoreBg(breakdown.wordAverage))}
              />

              {/* Individual word scores */}
              <div className="flex flex-wrap gap-1.5">
                {breakdown.wordItems.map((item) => {
                  const recorded = recordedItems.get(item.item_id);
                  const score = recorded?.score ?? item.latest_score ?? 0;
                  return (
                    <div
                      key={item.item_id}
                      className={cn(
                        "px-2 py-0.5 rounded text-xs",
                        getScoreBg(score)
                      )}
                    >
                      <span className="font-medium">{item.word_text}</span>
                      <span className={cn("ml-1", getScoreColor(score))}>
                        {Math.round(score)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Sentence score */}
              {breakdown.sentenceItem && (
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Sentence</span>
                    </div>
                    <span className={cn(
                      "text-lg font-semibold",
                      breakdown.sentenceScore !== null 
                        ? getScoreColor(breakdown.sentenceScore)
                        : "text-muted-foreground"
                    )}>
                      {breakdown.sentenceScore !== null 
                        ? Math.round(breakdown.sentenceScore) 
                        : '—'}
                    </span>
                  </div>
                  
                  {breakdown.sentenceScore !== null && (
                    <Progress 
                      value={breakdown.sentenceScore} 
                      className={cn("h-2 mt-2", getScoreBg(breakdown.sentenceScore))}
                    />
                  )}

                  {/* Transfer gap explanation */}
                  {breakdown.hasTransferGap && (
                    <p className="text-xs text-amber-600 mt-2 bg-amber-500/5 p-2 rounded">
                      Your sentence score is lower than your word scores. This suggests 
                      you may need more practice with this sound in connected speech.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Session Complete Badge */}
      <div className="flex items-center justify-center gap-2 py-2 px-4 bg-green-500/10 rounded-lg text-green-700">
        <CheckCircle className="h-4 w-4" />
        <span className="text-sm font-medium">Session Complete</span>
      </div>

      {/* Action buttons */}
      <div className="space-y-2 pt-2">
        {/* Primary action: Start New Session with auto-rotation */}
        {onStartNew && (
          <Button 
            onClick={handleStartNew} 
            className="w-full"
            disabled={isCompleting}
          >
            {isCompleting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Start New Session
          </Button>
        )}
        
        {/* Choose different sounds */}
        {onChooseDifferent && (
          <Button 
            variant="outline" 
            onClick={handleChooseDifferent} 
            className="w-full"
            disabled={isCompleting}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Choose Different Sounds
          </Button>
        )}

        {/* Secondary actions row */}
        <div className="flex gap-2">
          {onPracticeAgain && (
            <Button 
              variant="outline" 
              onClick={handlePracticeAgain} 
              className="flex-1"
              disabled={isCompleting}
            >
              Practice Again
              <span className="ml-1 text-xs text-muted-foreground">
                (same sounds)
              </span>
            </Button>
          )}
          <Button 
            variant="ghost" 
            onClick={handleFinishSession} 
            className="flex-1"
            disabled={isCompleting}
          >
            {isCompleting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <History className="mr-2 h-4 w-4" />
            )}
            Done
          </Button>
        </div>

        {/* Back to practice for more attempts */}
        <Button variant="link" onClick={onBack} className="w-full text-muted-foreground">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Practice
        </Button>
      </div>
    </div>
  );
}
