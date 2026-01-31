/**
 * Phase 8.3: Practice Session Flow Component
 * Phase 8.5: Added session lifecycle callbacks for completion
 * 
 * Orchestrates the "record-all-then-results" practice workflow:
 * 1. Recording Phase: User goes through all 12 items in order
 * 2. Results Phase: Show per-phoneme breakdown after all items recorded
 */

import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Volume2, ChevronRight, CheckCircle } from 'lucide-react';
import { usePracticeItemProgress } from './hooks/usePronunciationData';
import { WordPracticeRecorder } from './WordPracticeRecorder';
import { SentencePracticeRecorder } from './SentencePracticeRecorder';
import { SessionResultsScreen } from './SessionResultsScreen';
import type { ActivePracticeSession, PracticeItemProgress } from './types';
import { cn } from '@/lib/utils';

interface PracticeSessionFlowProps {
  session: ActivePracticeSession;
  studentId: string;
  onClose: () => void;
  onStartNew?: () => void;
  onPracticeAgain?: (targets: string[]) => void;
  onChooseDifferent?: () => void;
}

type FlowPhase = 'recording' | 'results';

interface RecordedItem {
  itemId: string;
  score: number | null;
  wasCorrect: boolean | null;
}

export function PracticeSessionFlow({ session, studentId, onClose, onStartNew, onPracticeAgain, onChooseDifferent }: PracticeSessionFlowProps) {
  const { data: items, isLoading, refetch } = usePracticeItemProgress(session.session_id);
  
  const [phase, setPhase] = useState<FlowPhase>('recording');
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [recordedItems, setRecordedItems] = useState<Map<string, RecordedItem>>(new Map());
  const [isRecording, setIsRecording] = useState(false);

  // Get sorted items (words first, then sentences)
  const sortedItems = (items || []).sort((a, b) => a.item_order - b.item_order);
  const currentItem = sortedItems[currentItemIndex];
  const totalItems = sortedItems.length;
  const completedCount = recordedItems.size;

  // Check if all items have been recorded
  useEffect(() => {
    if (totalItems > 0 && completedCount >= totalItems) {
      setPhase('results');
    }
  }, [completedCount, totalItems]);

  const handleAttemptComplete = useCallback((itemId: string, score: number, wasCorrect: boolean) => {
    setRecordedItems(prev => {
      const next = new Map(prev);
      next.set(itemId, { itemId, score, wasCorrect });
      return next;
    });
    setIsRecording(false);
    
    // Auto-advance to next item after a brief delay
    setTimeout(() => {
      if (currentItemIndex < totalItems - 1) {
        setCurrentItemIndex(prev => prev + 1);
      }
    }, 500);
  }, [currentItemIndex, totalItems]);

  const handleStartRecording = useCallback(() => {
    setIsRecording(true);
  }, []);

  const handleCancelRecording = useCallback(() => {
    setIsRecording(false);
  }, []);

  const handleNextItem = useCallback(() => {
    if (currentItemIndex < totalItems - 1) {
      setCurrentItemIndex(prev => prev + 1);
    }
  }, [currentItemIndex, totalItems]);

  const handlePrevItem = useCallback(() => {
    if (currentItemIndex > 0) {
      setCurrentItemIndex(prev => prev - 1);
    }
  }, [currentItemIndex]);

  const handleShowResults = useCallback(() => {
    setPhase('results');
  }, []);

  const handleBackToRecording = useCallback(() => {
    setPhase('recording');
  }, []);

  if (isLoading) {
    return (
      <Card className="max-w-md mx-auto">
        <CardContent className="py-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="text-sm text-muted-foreground mt-4">Loading practice items...</p>
        </CardContent>
      </Card>
    );
  }

  if (!sortedItems.length) {
    return (
      <Card className="max-w-md mx-auto">
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No practice items found.</p>
          <Button onClick={onClose} className="mt-4">Go Back</Button>
        </CardContent>
      </Card>
    );
  }

  // Results phase
  if (phase === 'results') {
    return (
      <SessionResultsScreen
        session={session}
        items={sortedItems}
        recordedItems={recordedItems}
        onBack={handleBackToRecording}
        onDone={onClose}
        onStartNew={onStartNew}
        onPracticeAgain={onPracticeAgain}
        onChooseDifferent={onChooseDifferent}
      />
    );
  }

  // Recording phase - show individual item recorder
  if (isRecording && currentItem) {
    const itemRecorded = recordedItems.get(currentItem.item_id);
    
    if (currentItem.practice_type === 'sentence') {
      return (
        <SentencePracticeRecorder
          item={currentItem}
          session={session}
          onAttemptComplete={(result) => handleAttemptComplete(
            currentItem.item_id,
            result.pronunciation_score,
            result.was_correct
          )}
          onClose={handleCancelRecording}
        />
      );
    }
    
    return (
      <WordPracticeRecorder
        item={currentItem}
        session={session}
        onAttemptComplete={(result) => handleAttemptComplete(
          currentItem.item_id,
          result.pronunciation_score,
          result.was_correct
        )}
        onClose={handleCancelRecording}
      />
    );
  }

  // Recording phase - item list view
  return (
    <div className="space-y-4 max-w-md mx-auto">
      <Button variant="ghost" size="sm" onClick={onClose}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Exit Practice
      </Button>

      {/* Header */}
      <div className="text-center py-4">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 text-primary mb-3">
          <Volume2 className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-semibold">Practice Session</h2>
        <p className="text-sm text-muted-foreground">
          Targeting: {session.target_phonemes.join(', ')}
        </p>
      </div>

      {/* Progress */}
      <div className="px-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-medium">{completedCount} / {totalItems}</span>
        </div>
        <Progress value={(completedCount / totalItems) * 100} className="h-2" />
      </div>

      {/* Current item card */}
      {currentItem && (
        <Card className="mx-4">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Item {currentItemIndex + 1} of {totalItems}
              </CardTitle>
              <span className={cn(
                "text-xs px-2 py-1 rounded",
                currentItem.practice_type === 'sentence' 
                  ? "bg-blue-500/10 text-blue-600" 
                  : "bg-primary/10 text-primary"
              )}>
                {currentItem.practice_type === 'sentence' ? 'Sentence' : 'Word'}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center py-4 bg-muted/30 rounded-lg border">
              {currentItem.practice_type === 'sentence' ? (
                <p className="text-lg font-medium px-4 leading-relaxed">
                  {currentItem.reference_sentence}
                </p>
              ) : (
                <>
                  <p className="text-2xl font-semibold">{currentItem.word_text}</p>
                  <p className="text-sm text-muted-foreground font-mono mt-1">
                    {currentItem.word_ipa}
                  </p>
                </>
              )}
              <p className="text-xs text-primary mt-2">
                Target: {currentItem.target_ipa_symbol}
              </p>
            </div>

            {/* Recorded status */}
            {recordedItems.has(currentItem.item_id) && (
              <div className="flex items-center justify-center gap-2 text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm font-medium">
                  Recorded (Score: {Math.round(recordedItems.get(currentItem.item_id)!.score || 0)})
                </span>
              </div>
            )}

            {/* Action button */}
            <Button 
              onClick={handleStartRecording} 
              className="w-full"
              size="lg"
            >
              {recordedItems.has(currentItem.item_id) ? 'Re-record' : 'Start Recording'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between px-4">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrevItem}
          disabled={currentItemIndex === 0}
        >
          Previous
        </Button>
        
        {completedCount >= totalItems ? (
          <Button onClick={handleShowResults}>
            View Results
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={handleNextItem}
            disabled={currentItemIndex >= totalItems - 1}
          >
            Next
          </Button>
        )}
      </div>

      {/* Item overview */}
      <div className="px-4 pt-4">
        <p className="text-xs text-muted-foreground mb-2">All Items</p>
        <div className="flex flex-wrap gap-1.5">
          {sortedItems.map((item, index) => {
            const isRecorded = recordedItems.has(item.item_id);
            const isCurrent = index === currentItemIndex;
            
            return (
              <button
                key={item.item_id}
                onClick={() => setCurrentItemIndex(index)}
                className={cn(
                  "h-8 w-8 rounded-full text-xs font-medium transition-all",
                  isCurrent && "ring-2 ring-primary ring-offset-2",
                  isRecorded 
                    ? "bg-green-500 text-white" 
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {index + 1}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
